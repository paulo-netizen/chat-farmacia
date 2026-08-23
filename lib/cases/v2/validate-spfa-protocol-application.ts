import type {
  ConclusionId,
  EvaluatorConclusion,
  EvaluatorViewV2,
  NonEmptyArray,
  SpfaConclusion,
  SpfaTransition,
} from './evaluator-types';
import { createPatientRuntimeViewV2 } from './patient-runtime';
import type {
  AppliedActionRequirementV2,
  AppliedInformationRequirementV2,
  AppliedNotApplicableReasonV2,
  AppliedRequirementApplicabilityV2,
  AppliedSpfaRequirementV2,
  BoundSpfaActionTargetV2,
  BoundSpfaInformationTargetV2,
  CaseSpfaProtocolApplicationV2,
  SpfaActionTargetV2,
  SpfaInformationTargetV2,
  SpfaRequirementTargetId,
} from './spfa-protocol-application-types';
import type {
  ApplicableRequirementImportance,
  SpfaProtocolDefinitionV2,
  SpfaProtocolRequirementDefinitionV2,
} from './spfa-protocol-types';
import type {
  CasePatientFactsDraftV2,
  FactId,
  MedicationId,
  MedicationLinkedFactDraftV2,
  MedicationUsePatternDraftV2,
  PatientDatum,
  PatientMedicationDraftV2,
} from './types';
import { validateEvaluatorViewV2 } from './validate-evaluator-view';
import {
  validateCasePatientFactsDraftV2,
  validateCaseVersionId,
} from './validate-patient-facts';
import {
  validateSpfaApplicabilityPolicyIdV2,
  validateSpfaProtocolDefinitionV2,
  validateSpfaProtocolRefV2,
  validateSpfaProtocolRequirementIdV2,
} from './validate-spfa-protocol-definition';

const UUID_BODY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const APPLICABLE_IMPORTANCES = [
  'CRITICAL',
  'RELEVANT',
  'OPTIONAL',
] as const satisfies readonly ApplicableRequirementImportance[];

type AnyConclusion = EvaluatorConclusion<string, unknown>;

export type CaseSpfaProtocolApplicationValidationContextV2 = Readonly<{
  protocolDefinition: SpfaProtocolDefinitionV2;
  patientFacts: CasePatientFactsDraftV2;
  evaluator: EvaluatorViewV2;
}>;

export class SpfaProtocolApplicationValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaProtocolApplicationValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new SpfaProtocolApplicationValidationError(path, message);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function assertExactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
}

function controlledValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(path, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T[number];
}

function opaqueId<T extends string>(
  value: unknown,
  prefix: 'spfa_target' | 'fact' | 'med' | 'conclusion',
  path: string,
): T {
  if (typeof value !== 'string') {
    fail(path, `must use the opaque format ${prefix}_<uuid>`);
  }
  const expectedPrefix = `${prefix}_`;
  if (
    !value.startsWith(expectedPrefix) ||
    !UUID_BODY_PATTERN.test(value.slice(expectedPrefix.length))
  ) {
    fail(path, `must use the opaque format ${prefix}_<uuid>`);
  }
  return value as T;
}

export function validateSpfaRequirementTargetIdV2(
  value: unknown,
  path = 'targetId',
): SpfaRequirementTargetId {
  return opaqueId<SpfaRequirementTargetId>(value, 'spfa_target', path);
}

function parseFactId(value: unknown, path: string): FactId {
  return opaqueId<FactId>(value, 'fact', path);
}

function parseMedicationId(value: unknown, path: string): MedicationId {
  return opaqueId<MedicationId>(value, 'med', path);
}

function parseConclusionId(value: unknown, path: string): ConclusionId {
  return opaqueId<ConclusionId>(value, 'conclusion', path);
}

function parseNotApplicableReason(
  value: unknown,
  path: string,
): AppliedNotApplicableReasonV2 {
  const source = asRecord(value, path);
  const kind = controlledValue(
    source.kind,
    ['DISPENSING_SUBTYPE_MISMATCH', 'CASE_DETERMINED'] as const,
    `${path}.kind`,
  );
  if (kind === 'DISPENSING_SUBTYPE_MISMATCH') {
    assertExactKeys(source, ['kind'], path);
    return { kind };
  }
  assertExactKeys(source, ['kind', 'policyRef'], path);
  return {
    kind,
    policyRef: parseApplicationPolicyId(
      source.policyRef,
      `${path}.policyRef`,
    ),
  };
}

function parseApplicability(
  value: unknown,
  path: string,
): AppliedRequirementApplicabilityV2 {
  const source = asRecord(value, path);
  const status = controlledValue(
    source.status,
    ['APPLICABLE', 'NOT_APPLICABLE'] as const,
    `${path}.status`,
  );
  if (status === 'APPLICABLE') {
    assertExactKeys(source, ['status', 'effectiveImportance'], path);
    return {
      status,
      effectiveImportance: controlledValue(
        source.effectiveImportance,
        APPLICABLE_IMPORTANCES,
        `${path}.effectiveImportance`,
      ),
    };
  }
  assertExactKeys(source, ['status', 'reason'], path);
  return {
    status,
    reason: parseNotApplicableReason(source.reason, `${path}.reason`),
  };
}

function parseInformationTarget(
  value: unknown,
  path: string,
): SpfaInformationTargetV2 {
  const source = asRecord(value, path);
  const kind = controlledValue(
    source.kind,
    ['FACT', 'PUBLIC_PROFILE', 'MEDICATION_ENTITY', 'MEDICATION_FACT'] as const,
    `${path}.kind`,
  );
  if (kind === 'FACT') {
    assertExactKeys(source, ['kind', 'factRef'], path);
    return { kind, factRef: parseFactId(source.factRef, `${path}.factRef`) };
  }
  if (kind === 'PUBLIC_PROFILE') {
    assertExactKeys(source, ['kind', 'field'], path);
    return {
      kind,
      field: controlledValue(source.field, ['age', 'sex'] as const, `${path}.field`),
    };
  }
  if (kind === 'MEDICATION_ENTITY') {
    assertExactKeys(source, ['kind', 'medicationRef'], path);
    return {
      kind,
      medicationRef: parseMedicationId(
        source.medicationRef,
        `${path}.medicationRef`,
      ),
    };
  }
  assertExactKeys(source, ['kind', 'medicationRef', 'factRef'], path);
  return {
    kind,
    medicationRef: parseMedicationId(
      source.medicationRef,
      `${path}.medicationRef`,
    ),
    factRef: parseFactId(source.factRef, `${path}.factRef`),
  };
}

function parseActionTarget(value: unknown, path: string): SpfaActionTargetV2 {
  const source = asRecord(value, path);
  const kind = controlledValue(
    source.kind,
    ['EVALUATOR_CONCLUSION', 'CARE_PATH_TRANSITION'] as const,
    `${path}.kind`,
  );
  if (kind === 'EVALUATOR_CONCLUSION') {
    assertExactKeys(source, ['kind', 'conclusionRef'], path);
    return {
      kind,
      conclusionRef: parseConclusionId(
        source.conclusionRef,
        `${path}.conclusionRef`,
      ),
    };
  }
  assertExactKeys(source, ['kind', 'transitionRef'], path);
  return {
    kind,
    transitionRef: parseConclusionId(
      source.transitionRef,
      `${path}.transitionRef`,
    ),
  };
}

function informationTargetKey(target: SpfaInformationTargetV2): string {
  switch (target.kind) {
    case 'FACT':
      return `FACT:${target.factRef}`;
    case 'PUBLIC_PROFILE':
      return `PUBLIC_PROFILE:${target.field}`;
    case 'MEDICATION_ENTITY':
      return `MEDICATION_ENTITY:${target.medicationRef}`;
    case 'MEDICATION_FACT':
      return `MEDICATION_FACT:${target.medicationRef}:${target.factRef}`;
  }
}

function actionTargetKey(target: SpfaActionTargetV2): string {
  return target.kind === 'EVALUATOR_CONCLUSION'
    ? `EVALUATOR_CONCLUSION:${target.conclusionRef}`
    : `CARE_PATH_TRANSITION:${target.transitionRef}`;
}

function parseInformationTargets(
  value: unknown,
  path: string,
): BoundSpfaInformationTargetV2[] {
  const targets = asArray(value, path).map((item, index) => {
    const targetPath = `${path}[${index}]`;
    const source = asRecord(item, targetPath);
    assertExactKeys(source, ['targetId', 'target'], targetPath);
    return {
      targetId: validateSpfaRequirementTargetIdV2(
        source.targetId,
        `${targetPath}.targetId`,
      ),
      target: parseInformationTarget(source.target, `${targetPath}.target`),
    };
  });
  const semanticTargets = new Set<string>();
  targets.forEach((target, index) => {
    const key = informationTargetKey(target.target);
    if (semanticTargets.has(key)) {
      fail(`${path}[${index}].target`, 'duplicate semantic target');
    }
    semanticTargets.add(key);
  });
  return targets.sort((left, right) =>
    left.targetId < right.targetId ? -1 : left.targetId > right.targetId ? 1 : 0,
  );
}

function parseActionTargets(
  value: unknown,
  path: string,
): BoundSpfaActionTargetV2[] {
  const targets = asArray(value, path).map((item, index) => {
    const targetPath = `${path}[${index}]`;
    const source = asRecord(item, targetPath);
    assertExactKeys(source, ['targetId', 'target'], targetPath);
    return {
      targetId: validateSpfaRequirementTargetIdV2(
        source.targetId,
        `${targetPath}.targetId`,
      ),
      target: parseActionTarget(source.target, `${targetPath}.target`),
    };
  });
  const semanticTargets = new Set<string>();
  targets.forEach((target, index) => {
    const key = actionTargetKey(target.target);
    if (semanticTargets.has(key)) {
      fail(`${path}[${index}].target`, 'duplicate semantic target');
    }
    semanticTargets.add(key);
  });
  return targets.sort((left, right) =>
    left.targetId < right.targetId ? -1 : left.targetId > right.targetId ? 1 : 0,
  );
}

function parseAppliedRequirement(
  value: unknown,
  path: string,
): AppliedSpfaRequirementV2 {
  const source = asRecord(value, path);
  const kind = controlledValue(
    source.kind,
    ['INFORMATION_REQUIREMENT', 'ACTION_REQUIREMENT'] as const,
    `${path}.kind`,
  );
  const requirementRef = parseApplicationRequirementId(
    source.requirementRef,
    `${path}.requirementRef`,
  );
  const applicability = parseApplicability(
    source.applicability,
    `${path}.applicability`,
  );

  if (kind === 'INFORMATION_REQUIREMENT') {
    assertExactKeys(
      source,
      ['kind', 'requirementRef', 'applicability', 'informationTargets'],
      path,
    );
    const informationTargets = parseInformationTargets(
      source.informationTargets,
      `${path}.informationTargets`,
    );
    if (applicability.status === 'APPLICABLE') {
      if (informationTargets.length === 0) {
        fail(`${path}.informationTargets`, 'must not be empty when applicable');
      }
      const result: AppliedInformationRequirementV2 = {
        kind,
        requirementRef,
        applicability,
        informationTargets:
          informationTargets as unknown as NonEmptyArray<BoundSpfaInformationTargetV2>,
      };
      return result;
    }
    if (informationTargets.length !== 0) {
      fail(`${path}.informationTargets`, 'must be empty when not applicable');
    }
    return { kind, requirementRef, applicability, informationTargets: [] };
  }

  assertExactKeys(
    source,
    ['kind', 'requirementRef', 'applicability', 'actionTargets'],
    path,
  );
  const actionTargets = parseActionTargets(
    source.actionTargets,
    `${path}.actionTargets`,
  );
  if (applicability.status === 'APPLICABLE') {
    if (actionTargets.length === 0) {
      fail(`${path}.actionTargets`, 'must not be empty when applicable');
    }
    const result: AppliedActionRequirementV2 = {
      kind,
      requirementRef,
      applicability,
      actionTargets:
        actionTargets as unknown as NonEmptyArray<BoundSpfaActionTargetV2>,
    };
    return result;
  }
  if (actionTargets.length !== 0) {
    fail(`${path}.actionTargets`, 'must be empty when not applicable');
  }
  return { kind, requirementRef, applicability, actionTargets: [] };
}

function contextErrorPath(cause: unknown): string | undefined {
  return typeof cause === 'object' && cause !== null && 'path' in cause
    ? String((cause as { path: unknown }).path)
    : undefined;
}

function externalValidationPath(cause: unknown, fallback: string): string {
  return contextErrorPath(cause) ?? fallback;
}

function parseApplicationCaseVersionId(value: unknown, path: string) {
  try {
    return validateCaseVersionId(value, path);
  } catch (cause) {
    fail(externalValidationPath(cause, path), 'invalid case version ID');
  }
}

function parseApplicationRequirementId(value: unknown, path: string) {
  try {
    return validateSpfaProtocolRequirementIdV2(value, path);
  } catch (cause) {
    fail(externalValidationPath(cause, path), 'invalid protocol requirement ID');
  }
}

function parseApplicationPolicyId(value: unknown, path: string) {
  try {
    return validateSpfaApplicabilityPolicyIdV2(value, path);
  } catch (cause) {
    fail(externalValidationPath(cause, path), 'invalid applicability policy ID');
  }
}

function parseApplicationProtocolRef(value: unknown, path: string) {
  try {
    return validateSpfaProtocolRefV2(value, path);
  } catch (cause) {
    fail(externalValidationPath(cause, path), 'invalid protocol reference');
  }
}

function validateContext(
  context: CaseSpfaProtocolApplicationValidationContextV2,
): {
  definition: SpfaProtocolDefinitionV2;
  patientFacts: CasePatientFactsDraftV2;
  evaluator: EvaluatorViewV2;
} {
  let definition: SpfaProtocolDefinitionV2;
  try {
    definition = validateSpfaProtocolDefinitionV2(context.protocolDefinition);
  } catch (cause) {
    const nestedPath = contextErrorPath(cause);
    fail(
      nestedPath === undefined
        ? 'context.protocolDefinition'
        : `context.protocolDefinition.${nestedPath}`,
      'invalid protocol definition',
    );
  }

  let patientFacts: CasePatientFactsDraftV2;
  try {
    patientFacts = validateCasePatientFactsDraftV2(context.patientFacts);
  } catch (cause) {
    const nestedPath = contextErrorPath(cause);
    fail(
      nestedPath === undefined
        ? 'context.patientFacts'
        : `context.patientFacts.${nestedPath}`,
      'invalid patient facts',
    );
  }

  let evaluator: EvaluatorViewV2;
  try {
    const runtime = createPatientRuntimeViewV2(patientFacts);
    evaluator = validateEvaluatorViewV2(context.evaluator, runtime);
  } catch (cause) {
    const nestedPath = contextErrorPath(cause);
    fail(
      nestedPath === undefined
        ? 'context.evaluator'
        : `context.evaluator.${nestedPath}`,
      'invalid evaluator context',
    );
  }
  return { definition, patientFacts, evaluator };
}

function collectFactIds(patientFacts: CasePatientFactsDraftV2): Set<string> {
  const facts = new Set<string>();
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const source = value as Record<string, unknown>;
    if (
      (source.state === 'known' ||
        source.state === 'explicit_absence' ||
        source.state === 'patient_unknown') &&
      typeof source.factId === 'string'
    ) {
      facts.add(source.factId);
    }
    Object.values(source).forEach(visit);
  };
  visit(patientFacts);
  return facts;
}

function definedFactId(datum: PatientDatum<unknown>): FactId | undefined {
  return datum.state === 'known' ||
    datum.state === 'explicit_absence' ||
    datum.state === 'patient_unknown'
    ? datum.factId
    : undefined;
}

function addDatumFact(
  target: Set<string>,
  datum: PatientDatum<unknown>,
): void {
  const factId = definedFactId(datum);
  if (factId !== undefined) target.add(factId);
}

function addMedicationOwnFacts(
  target: Set<string>,
  medication: PatientMedicationDraftV2,
): void {
  addDatumFact(target, medication.displayName);
  addDatumFact(target, medication.origin);
  addDatumFact(target, medication.purposeAsUnderstood);
  addDatumFact(target, medication.regimenBasis);
  addDatumFact(target, medication.referenceDose);
  addDatumFact(target, medication.referenceSchedule);
  addDatumFact(target, medication.referenceDuration);
  addDatumFact(target, medication.administrationMethod);
  medication.specialUseConditions.forEach((datum) =>
    addDatumFact(target, datum),
  );
}

function addMedicationUseFacts(
  target: Set<string>,
  use: MedicationUsePatternDraftV2,
): void {
  addDatumFact(target, use.actualUse);
  addDatumFact(target, use.actualDose);
  addDatumFact(target, use.actualSchedule);
  addDatumFact(target, use.frequency);
  addDatumFact(target, use.timePeriod);
  [
    ...use.circumstanceFactRefs,
    ...use.statedReasonFactRefs,
    ...use.perceivedEffectFactRefs,
    ...use.practicalDifficultyFactRefs,
    ...use.strategyTriedFactRefs,
  ].forEach((factRef) => target.add(factRef));
}

function buildMedicationIndex(patientFacts: CasePatientFactsDraftV2): {
  medications: Set<string>;
  medicationFacts: Map<string, Set<string>>;
} {
  const medications = new Set<string>();
  const medicationFacts = new Map<string, Set<string>>();
  const allMedications = [
    ...patientFacts.pharmacotherapy.prescribedMedications,
    ...patientFacts.pharmacotherapy.otherMedicinesAndProducts,
  ];
  allMedications.forEach((medication) => {
    medications.add(medication.medicationId);
    const facts = new Set<string>();
    addMedicationOwnFacts(facts, medication);
    medicationFacts.set(medication.medicationId, facts);
  });
  patientFacts.pharmacotherapy.actualMedicationUse.forEach((use) => {
    addMedicationUseFacts(medicationFacts.get(use.medicationRef)!, use);
  });
  const linkedCollections: readonly MedicationLinkedFactDraftV2[][] = [
    patientFacts.pharmacotherapy.recentChanges,
    patientFacts.pharmacotherapy.perceivedEffectiveness,
    patientFacts.pharmacotherapy.perceivedSafety,
  ];
  linkedCollections.forEach((collection) =>
    collection.forEach((linkedFact) =>
      addDatumFact(
        medicationFacts.get(linkedFact.medicationRef)!,
        linkedFact.detail,
      ),
    ),
  );
  return { medications, medicationFacts };
}

function conclusionEntries(evaluator: EvaluatorViewV2): AnyConclusion[] {
  return [
    evaluator.carePath.initialSpfa,
    ...evaluator.carePath.additionalSpfas,
    ...evaluator.carePath.transitions,
    evaluator.incidence.assessment,
    ...evaluator.incidence.findings,
    ...evaluator.incidence.followUpEpisodes,
    evaluator.prm.assessment,
    ...evaluator.prm.findings,
    ...evaluator.rnmAssessments,
    ...evaluator.prmRnmRelations,
    ...evaluator.adherence.assessments,
    ...evaluator.adherence.typeConclusions,
    ...evaluator.adherence.patientProfiles,
    ...evaluator.adherence.barrierAssessments,
    ...evaluator.adherence.barriers,
    ...evaluator.adherence.strategies,
    ...evaluator.professionalActions,
    ...evaluator.pharmaceuticalInterventions,
    evaluator.referral,
  ];
}

function validateMaterializedApplicability(
  requirement: AppliedSpfaRequirementV2,
  definition: SpfaProtocolRequirementDefinitionV2,
  spfa: SpfaConclusion,
  path: string,
): void {
  const materialized = requirement.applicability;
  const configured = definition.applicability;
  if (configured.kind === 'ALWAYS') {
    if (materialized.status !== 'APPLICABLE') {
      fail(`${path}.applicability.status`, 'ALWAYS must be APPLICABLE');
    }
  } else if (configured.kind === 'DISPENSING_SUBTYPE') {
    const matches =
      spfa.value.subtype !== undefined &&
      configured.subtypes.includes(spfa.value.subtype);
    if (matches && materialized.status !== 'APPLICABLE') {
      fail(
        `${path}.applicability.status`,
        'matching DISPENSING_SUBTYPE must be APPLICABLE',
      );
    }
    if (!matches) {
      if (materialized.status !== 'NOT_APPLICABLE') {
        fail(
          `${path}.applicability.status`,
          'nonmatching DISPENSING_SUBTYPE must be NOT_APPLICABLE',
        );
      }
      if (materialized.reason.kind !== 'DISPENSING_SUBTYPE_MISMATCH') {
        fail(
          `${path}.applicability.reason.kind`,
          'must be DISPENSING_SUBTYPE_MISMATCH',
        );
      }
    }
  } else if (materialized.status === 'NOT_APPLICABLE') {
    if (materialized.reason.kind !== 'CASE_DETERMINED') {
      fail(`${path}.applicability.reason.kind`, 'must be CASE_DETERMINED');
    }
    if (materialized.reason.policyRef !== configured.policyRef) {
      fail(
        `${path}.applicability.reason.policyRef`,
        'must match the configured applicability policy',
      );
    }
  }

  if (
    materialized.status === 'APPLICABLE' &&
    materialized.effectiveImportance !== definition.defaultImportance
  ) {
    fail(
      `${path}.applicability.effectiveImportance`,
      'must match definition defaultImportance',
    );
  }
}

function validateInformationTargets(
  requirement: AppliedInformationRequirementV2,
  facts: Set<string>,
  medications: Set<string>,
  medicationFacts: Map<string, Set<string>>,
  path: string,
): void {
  requirement.informationTargets.forEach((boundTarget, index) => {
    const targetPath = `${path}.informationTargets[${index}].target`;
    const target = boundTarget.target;
    if (target.kind === 'FACT') {
      if (!facts.has(target.factRef)) {
        fail(`${targetPath}.factRef`, 'unknown defined fact reference');
      }
      return;
    }
    if (target.kind === 'PUBLIC_PROFILE') return;
    if (!medications.has(target.medicationRef)) {
      fail(`${targetPath}.medicationRef`, 'unknown medication reference');
    }
    if (
      target.kind === 'MEDICATION_FACT' &&
      !medicationFacts.get(target.medicationRef)?.has(target.factRef)
    ) {
      fail(
        `${targetPath}.factRef`,
        'fact is not structurally linked to the referenced medication',
      );
    }
  });
}

function validateActionTargets(
  requirement: AppliedActionRequirementV2,
  definition: SpfaProtocolRequirementDefinitionV2,
  conclusions: Map<string, AnyConclusion>,
  transitions: Map<string, SpfaTransition>,
  carePathSpfaRef: ConclusionId,
  path: string,
): void {
  requirement.actionTargets.forEach((boundTarget, index) => {
    const targetPath = `${path}.actionTargets[${index}].target`;
    const target = boundTarget.target;
    if (target.kind === 'EVALUATOR_CONCLUSION') {
      const conclusion = conclusions.get(target.conclusionRef);
      if (conclusion === undefined) {
        fail(`${targetPath}.conclusionRef`, 'unknown conclusion reference');
      }
      if (conclusion.kind === 'spfa_transition') {
        fail(
          `${targetPath}.conclusionRef`,
          'SPFA transitions require CARE_PATH_TRANSITION target kind',
        );
      }
    } else {
      const transition = transitions.get(target.transitionRef);
      if (transition === undefined) {
        fail(`${targetPath}.transitionRef`, 'must reference an SPFA transition');
      }
      if (transition.value.fromSpfaRef !== carePathSpfaRef) {
        fail(
          `${targetPath}.transitionRef`,
          'transition must originate from the applied care path SPFA',
        );
      }
    }
  });

  if (definition.kind !== 'ACTION_REQUIREMENT') return;
  const hasTransition = requirement.actionTargets.some(
    (target) => target.target.kind === 'CARE_PATH_TRANSITION',
  );
  if (definition.semanticDomain === 'care_path_transition') {
    if (
      requirement.actionTargets.some(
        (target) => target.target.kind !== 'CARE_PATH_TRANSITION',
      )
    ) {
      fail(
        `${path}.actionTargets`,
        'care_path_transition requires only CARE_PATH_TRANSITION targets',
      );
    }
  } else if (hasTransition) {
    fail(
      `${path}.actionTargets`,
      `${definition.semanticDomain} forbids CARE_PATH_TRANSITION targets`,
    );
  }
}

export function validateCaseSpfaProtocolApplicationV2(
  applicationInput: unknown,
  context: CaseSpfaProtocolApplicationValidationContextV2,
): CaseSpfaProtocolApplicationV2 {
  const { definition, patientFacts, evaluator } = validateContext(context);
  const rootPath = 'caseSpfaProtocolApplication';
  const source = asRecord(applicationInput, rootPath);
  assertExactKeys(
    source,
    [
      'schemaVersion',
      'caseVersionId',
      'carePathSpfaRef',
      'protocolRef',
      'requirements',
    ],
    rootPath,
  );
  if (source.schemaVersion !== '2.0') {
    fail(`${rootPath}.schemaVersion`, 'must be 2.0');
  }
  const caseVersionId = parseApplicationCaseVersionId(
    source.caseVersionId,
    `${rootPath}.caseVersionId`,
  );
  if (caseVersionId !== patientFacts.caseVersionId) {
    fail(`${rootPath}.caseVersionId`, 'must match patient facts caseVersionId');
  }
  if (caseVersionId !== evaluator.caseVersionId) {
    fail(`${rootPath}.caseVersionId`, 'must match evaluator caseVersionId');
  }

  const carePathSpfaRef = parseConclusionId(
    source.carePathSpfaRef,
    `${rootPath}.carePathSpfaRef`,
  );
  const conclusions = new Map(
    conclusionEntries(evaluator).map((conclusion) => [
      conclusion.conclusionId,
      conclusion,
    ]),
  );
  const carePathSpfas = new Map<string, SpfaConclusion>(
    [evaluator.carePath.initialSpfa, ...evaluator.carePath.additionalSpfas].map(
      (spfa) => [spfa.conclusionId, spfa],
    ),
  );
  const boundSpfa = carePathSpfas.get(carePathSpfaRef);
  if (boundSpfa === undefined) {
    fail(
      `${rootPath}.carePathSpfaRef`,
      conclusions.has(carePathSpfaRef)
        ? 'must reference a care path SPFA conclusion'
        : 'unknown conclusion reference',
    );
  }

  const protocolRef = parseApplicationProtocolRef(
    source.protocolRef,
    `${rootPath}.protocolRef`,
  );
  if (protocolRef.protocolId !== definition.protocolId) {
    fail(`${rootPath}.protocolRef.protocolId`, 'must match protocol definition');
  }
  if (protocolRef.version !== definition.version) {
    fail(`${rootPath}.protocolRef.version`, 'must match protocol definition');
  }
  if (definition.service !== boundSpfa.value.service) {
    fail(`${rootPath}.protocolRef`, 'protocol service must match care path SPFA');
  }
  if (boundSpfa.value.service === 'dispensing' && boundSpfa.value.subtype === undefined) {
    fail(`${rootPath}.carePathSpfaRef`, 'dispensing SPFA must define subtype');
  }
  if (
    definition.subtype !== undefined &&
    definition.subtype !== boundSpfa.value.subtype
  ) {
    fail(`${rootPath}.protocolRef`, 'protocol subtype must match care path SPFA');
  }

  const rawRequirements = asArray(
    source.requirements,
    `${rootPath}.requirements`,
  );
  if (rawRequirements.length === 0) {
    fail(`${rootPath}.requirements`, 'must not be empty');
  }
  const parsedRequirements = rawRequirements.map((item, index) =>
    parseAppliedRequirement(item, `${rootPath}.requirements[${index}]`),
  );
  const requirementsByRef = new Map<string, AppliedSpfaRequirementV2>();
  parsedRequirements.forEach((requirement, index) => {
    if (requirementsByRef.has(requirement.requirementRef)) {
      fail(
        `${rootPath}.requirements[${index}].requirementRef`,
        'duplicate requirement reference',
      );
    }
    if (
      !definition.requirements.some(
        (candidate) => candidate.requirementId === requirement.requirementRef,
      )
    ) {
      fail(
        `${rootPath}.requirements[${index}].requirementRef`,
        'requirement is not present in protocol definition',
      );
    }
    requirementsByRef.set(requirement.requirementRef, requirement);
  });

  const orderedRequirements = definition.requirements.map(
    (requirementDefinition, index) => {
      const materialized = requirementsByRef.get(
        requirementDefinition.requirementId,
      );
      const path = `${rootPath}.requirements[${index}]`;
      if (materialized === undefined) {
        fail(
          `${rootPath}.requirements`,
          `missing requirement: ${requirementDefinition.requirementId}`,
        );
      }
      if (materialized.kind !== requirementDefinition.kind) {
        fail(`${path}.kind`, 'must match protocol requirement kind');
      }
      validateMaterializedApplicability(
        materialized,
        requirementDefinition,
        boundSpfa,
        path,
      );
      return materialized;
    },
  );

  const facts = collectFactIds(patientFacts);
  const { medications, medicationFacts } = buildMedicationIndex(patientFacts);
  const transitions = new Map<string, SpfaTransition>(
    evaluator.carePath.transitions.map((transition) => [
      transition.conclusionId,
      transition,
    ]),
  );
  const targetIds = new Set<string>();
  orderedRequirements.forEach((requirement, index) => {
    const path = `${rootPath}.requirements[${index}]`;
    const targets =
      requirement.kind === 'INFORMATION_REQUIREMENT'
        ? requirement.informationTargets
        : requirement.actionTargets;
    targets.forEach((target, targetIndex) => {
      if (targetIds.has(target.targetId)) {
        fail(
          `${path}.${
            requirement.kind === 'INFORMATION_REQUIREMENT'
              ? 'informationTargets'
              : 'actionTargets'
          }[${targetIndex}].targetId`,
          'targetId must be globally unique within the application',
        );
      }
      targetIds.add(target.targetId);
    });
    if (requirement.kind === 'INFORMATION_REQUIREMENT') {
      validateInformationTargets(
        requirement,
        facts,
        medications,
        medicationFacts,
        path,
      );
    } else {
      validateActionTargets(
        requirement,
        definition.requirements[index],
        conclusions,
        transitions,
        carePathSpfaRef,
        path,
      );
    }
  });

  return {
    schemaVersion: '2.0',
    caseVersionId,
    carePathSpfaRef,
    protocolRef,
    requirements:
      orderedRequirements as unknown as NonEmptyArray<AppliedSpfaRequirementV2>,
  };
}
