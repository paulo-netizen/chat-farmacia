import type {
  AdherenceBarrierCategory,
  AdherencePatientProfile,
  AdherenceStatus,
  AdherenceStrategyCategory,
  BaseAdherenceStrategyCategory,
  DispensingSubtype,
  NonAdherenceType,
  NonEmptyArray,
  PharmaceuticalInterventionTarget,
  ProfessionalActionCategory,
  ReferralUrgency,
  ReportRequirement,
  SpfaService,
  TaxonomyTermRef,
} from './evaluator-types';
import type {
  AdditionalFindingsPolicy,
  AdditionalSpfaPlan,
  AdherenceAssessmentIntent,
  AdherenceBarrierIntent,
  AdherenceBarrierProposalConstraints,
  AdherenceBarrierSetIntent,
  AdherenceCaseIntent,
  AdherencePatientProfileIntent,
  AdherencePatientProfileProposalConstraints,
  AdherenceProposalConstraints,
  AdherenceStrategyAddresses,
  AdherenceStrategyApplication,
  AdherenceStrategyIntent,
  AdherenceStrategyProposalConstraints,
  AllowedValues,
  CardinalityConstraint,
  FixedSpfaIntent,
  IncidenceIntent,
  IncidenceProposalConstraints,
  InitialSpfaProposalConstraints,
  MedicationScopeIntent,
  NonAdherenceDetailsPlan,
  NonAdherenceTypeIntent,
  NonAdherenceTypeProposalConstraints,
  PharmaceuticalInterventionIntent,
  PharmaceuticalInterventionProposalConstraints,
  PrmFindingIntent,
  PrmIntent,
  PrmProposalConstraints,
  ProfessionalActionIntent,
  ProfessionalActionProposalConstraints,
  ReferralIntent,
  ReferralProposalConstraints,
  RnmFindingIntent,
  RnmIntent,
  RnmProposalConstraints,
  SpfaTransitionConstraints,
  SpfaTransitionIntent,
  TeachingBriefId,
  TeachingCaseGenerationBriefV2,
  TeachingCarePathPlanV2,
  TeachingDecision,
  TeachingDimensionPlan,
} from './teaching-brief-types';

const UUID_BODY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SPFA_SERVICES = [
  'dispensing',
  'pharmaceutical_indication',
  'medication_adherence',
] as const;
const DISPENSING_SUBTYPES = ['initial_treatment', 'continuation'] as const;
const ADHERENCE_STATUSES = [
  'adherent',
  'non_adherent',
  'not_determinable',
] as const;
const NON_ADHERENCE_TYPES = [
  'intentional',
  'unintentional',
  'erratic',
  'combined',
] as const;
const ADHERENCE_PROFILES = [
  'distrustful',
  'trivializing',
  'confused',
] as const;
const BARRIER_CATEGORIES = ['practical', 'perception'] as const;
const BASE_STRATEGIES = [
  'technical',
  'behavioral',
  'educational',
  'social_family_support',
] as const;
const STRATEGIES = [...BASE_STRATEGIES, 'combined'] as const;
const ACTION_CATEGORIES = [
  'dispense',
  'do_not_dispense',
  'pharmacological_treatment',
  'non_pharmacological_treatment',
  'hygienic_dietary_measures',
  'referral',
  'other_spfa',
] as const;
const INTERVENTION_TARGETS = [
  'treatment',
  'patient_state_or_situation',
  'conditions_of_use',
] as const;

type ParseContext = {
  taxonomyVersions: Map<string, string>;
};

type ParsedPlan<T, C> = TeachingDimensionPlan<T, C>;

export class TeachingBriefValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'TeachingBriefValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new TeachingBriefValidationError(path, message);
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
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedSet.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
  return value.trim();
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

function positiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail(path, 'must be a positive integer');
  }
  return value;
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(path, 'must be a non-negative integer');
  }
  return value;
}

function distinctControlledValues<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): NonEmptyArray<T[number]> {
  const values = asArray(value, path).map((item, index) =>
    controlledValue(item, allowed, `${path}[${index}]`),
  );
  if (values.length === 0) fail(path, 'must contain at least one value');
  if (new Set(values).size !== values.length) {
    fail(path, 'must not contain duplicate values');
  }
  return values as unknown as NonEmptyArray<T[number]>;
}

export function validateTeachingBriefId(
  value: unknown,
  path = 'briefId',
): TeachingBriefId {
  if (
    typeof value !== 'string' ||
    !value.startsWith('brief_') ||
    !UUID_BODY_PATTERN.test(value.slice('brief_'.length))
  ) {
    fail(path, 'must use the opaque format brief_<uuid>');
  }
  return value as TeachingBriefId;
}

function parseTaxonomyTermRef(
  value: unknown,
  path: string,
  context: ParseContext,
): TaxonomyTermRef {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    ['taxonomyId', 'taxonomyVersion', 'conceptId'],
    path,
  );
  const result = {
    taxonomyId: nonEmptyString(source.taxonomyId, `${path}.taxonomyId`),
    taxonomyVersion: nonEmptyString(
      source.taxonomyVersion,
      `${path}.taxonomyVersion`,
    ),
    conceptId: nonEmptyString(source.conceptId, `${path}.conceptId`),
  };
  const previous = context.taxonomyVersions.get(result.taxonomyId);
  if (previous !== undefined && previous !== result.taxonomyVersion) {
    fail(path, `taxonomy ${result.taxonomyId} uses inconsistent versions`);
  }
  context.taxonomyVersions.set(result.taxonomyId, result.taxonomyVersion);
  return result;
}

function optionalTaxonomyTermRef(
  value: unknown,
  path: string,
  context: ParseContext,
): TaxonomyTermRef | undefined {
  return value === undefined
    ? undefined
    : parseTaxonomyTermRef(value, path, context);
}

function parseTeachingDecision<T, C>(
  value: unknown,
  path: string,
  parseValue: (value: unknown, path: string) => T,
  parseConstraints?: (value: unknown, path: string) => C,
): TeachingDecision<T, C> {
  const source = asRecord(value, path);
  if (source.mode === 'teacher_fixed') {
    assertExactKeys(source, ['mode', 'value'], path);
    return {
      mode: 'teacher_fixed',
      value: parseValue(source.value, `${path}.value`),
    };
  }
  if (source.mode === 'ai_proposes') {
    assertExactKeys(
      source,
      parseConstraints === undefined ? ['mode'] : ['mode', 'constraints'],
      path,
    );
    if (source.constraints === undefined) return { mode: 'ai_proposes' };
    if (parseConstraints === undefined) {
      fail(`${path}.constraints`, 'is not allowed for this decision');
    }
    return {
      mode: 'ai_proposes',
      constraints: parseConstraints(source.constraints, `${path}.constraints`),
    };
  }
  fail(`${path}.mode`, 'must be teacher_fixed or ai_proposes');
}

function parseTeachingPlan<T, C>(
  value: unknown,
  path: string,
  parseValue: (value: unknown, path: string) => T,
  parseConstraints?: (value: unknown, path: string) => C,
  options: { allowForbidden?: boolean } = {},
): ParsedPlan<T, C> {
  const source = asRecord(value, path);
  if (source.targeting === 'targeted') {
    assertExactKeys(source, ['targeting', 'decision'], path);
    return {
      targeting: 'targeted',
      decision: parseTeachingDecision(
        source.decision,
        `${path}.decision`,
        parseValue,
        parseConstraints,
      ),
    };
  }
  if (source.targeting === 'not_targeted') {
    assertExactKeys(source, ['targeting', 'policy'], path);
    const policy = controlledValue(
      source.policy,
      ['allowed_if_clinically_coherent', 'forbidden'] as const,
      `${path}.policy`,
    );
    if (policy === 'forbidden' && options.allowForbidden === false) {
      fail(`${path}.policy`, 'forbidden is not allowed for this dimension');
    }
    return { targeting: 'not_targeted', policy };
  }
  fail(`${path}.targeting`, 'must be targeted or not_targeted');
}

function parseAllowedValues<const T extends readonly string[]>(
  value: unknown,
  path: string,
  allowed: T,
): AllowedValues<T[number]> {
  const source = asRecord(value, path);
  assertExactKeys(source, ['allowedValues'], path);
  return {
    allowedValues: distinctControlledValues(
      source.allowedValues,
      allowed,
      `${path}.allowedValues`,
    ),
  };
}

function parseSpfaService(value: unknown, path: string): SpfaService {
  return controlledValue(value, SPFA_SERVICES, path);
}

function parseDispensingSubtype(
  value: unknown,
  path: string,
): DispensingSubtype {
  return controlledValue(value, DISPENSING_SUBTYPES, path);
}

function parseFixedSpfaIntent(value: unknown, path: string): FixedSpfaIntent {
  const source = asRecord(value, path);
  const service = parseSpfaService(source.service, `${path}.service`);
  if (service === 'dispensing') {
    assertExactKeys(source, ['service', 'dispensingSubtype'], path);
    return {
      service,
      dispensingSubtype: parseTeachingDecision(
        source.dispensingSubtype,
        `${path}.dispensingSubtype`,
        parseDispensingSubtype,
        (constraints, constraintsPath) =>
          parseAllowedValues(
            constraints,
            constraintsPath,
            DISPENSING_SUBTYPES,
          ),
      ),
    };
  }
  assertExactKeys(source, ['service'], path);
  return { service };
}

function parseInitialSpfaConstraints(
  value: unknown,
  path: string,
): InitialSpfaProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    ['allowedServices', 'allowedDispensingSubtypes'],
    path,
  );
  const allowedServices =
    source.allowedServices === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedServices,
          SPFA_SERVICES,
          `${path}.allowedServices`,
        );
  const allowedDispensingSubtypes =
    source.allowedDispensingSubtypes === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedDispensingSubtypes,
          DISPENSING_SUBTYPES,
          `${path}.allowedDispensingSubtypes`,
        );
  if (
    allowedDispensingSubtypes !== undefined &&
    allowedServices !== undefined &&
    !allowedServices.includes('dispensing')
  ) {
    fail(
      `${path}.allowedDispensingSubtypes`,
      'requires dispensing to be an allowed service',
    );
  }
  return {
    ...(allowedServices === undefined ? {} : { allowedServices }),
    ...(allowedDispensingSubtypes === undefined
      ? {}
      : { allowedDispensingSubtypes }),
  };
}

function parseAdditionalSpfaPlan(
  value: unknown,
  path: string,
): AdditionalSpfaPlan {
  const source = asRecord(value, path);
  assertExactKeys(source, ['service', 'inclusion'], path);
  const service = parseSpfaService(source.service, `${path}.service`);
  if (service === 'dispensing') {
    return {
      service,
      inclusion: parseTeachingPlan(
        source.inclusion,
        `${path}.inclusion`,
        (fixedValue, fixedPath) => {
          const fixed = asRecord(fixedValue, fixedPath);
          assertExactKeys(fixed, ['dispensingSubtype'], fixedPath);
          return {
            dispensingSubtype: parseTeachingDecision(
              fixed.dispensingSubtype,
              `${fixedPath}.dispensingSubtype`,
              parseDispensingSubtype,
              (constraints, constraintsPath) =>
                parseAllowedValues(
                  constraints,
                  constraintsPath,
                  DISPENSING_SUBTYPES,
                ),
            ),
          };
        },
      ),
    };
  }
  return {
    service,
    inclusion: parseTeachingPlan(
      source.inclusion,
      `${path}.inclusion`,
      (fixedValue, fixedPath) => {
        const fixed = asRecord(fixedValue, fixedPath);
        assertExactKeys(fixed, ['include'], fixedPath);
        if (fixed.include !== true) fail(`${fixedPath}.include`, 'must be true');
        return { include: true };
      },
    ),
  };
}

function parseTransitionIntent(
  value: unknown,
  path: string,
): SpfaTransitionIntent {
  const source = asRecord(value, path);
  assertExactKeys(source, ['from', 'to'], path);
  const result = {
    from: parseSpfaService(source.from, `${path}.from`),
    to: parseSpfaService(source.to, `${path}.to`),
  };
  if (result.from === result.to) fail(path, 'transition cannot be a self-link');
  return result;
}

function parseTransitionList(
  value: unknown,
  path: string,
): SpfaTransitionIntent[] {
  const transitions = asArray(value, path).map((item, index) =>
    parseTransitionIntent(item, `${path}[${index}]`),
  );
  const keys = transitions.map((item) => `${item.from}->${item.to}`);
  if (new Set(keys).size !== keys.length) {
    fail(path, 'must not contain duplicate transitions');
  }
  return transitions;
}

function parseTransitionConstraints(
  value: unknown,
  path: string,
): SpfaTransitionConstraints {
  const source = asRecord(value, path);
  assertExactKeys(source, ['allowedTransitions', 'maximumTransitions'], path);
  const allowedTransitions =
    source.allowedTransitions === undefined
      ? undefined
      : parseTransitionList(source.allowedTransitions, `${path}.allowedTransitions`);
  if (allowedTransitions !== undefined && allowedTransitions.length === 0) {
    fail(`${path}.allowedTransitions`, 'must contain at least one transition');
  }
  const maximumTransitions =
    source.maximumTransitions === undefined
      ? undefined
      : positiveInteger(source.maximumTransitions, `${path}.maximumTransitions`);
  return {
    ...(allowedTransitions === undefined
      ? {}
      : {
          allowedTransitions:
            allowedTransitions as unknown as NonEmptyArray<SpfaTransitionIntent>,
        }),
    ...(maximumTransitions === undefined ? {} : { maximumTransitions }),
  };
}

function parseCarePath(value: unknown): TeachingCarePathPlanV2 {
  const source = asRecord(value, 'carePath');
  assertExactKeys(
    source,
    ['initialSpfa', 'additionalSpfas', 'transitions'],
    'carePath',
  );
  const initialSpfa = parseTeachingPlan(
    source.initialSpfa,
    'carePath.initialSpfa',
    parseFixedSpfaIntent,
    parseInitialSpfaConstraints,
  );
  if (initialSpfa.targeting !== 'targeted') {
    fail('carePath.initialSpfa', 'initial SPFA must be targeted');
  }
  return {
    initialSpfa,
    additionalSpfas: asArray(
      source.additionalSpfas,
      'carePath.additionalSpfas',
    ).map((item, index) =>
      parseAdditionalSpfaPlan(item, `carePath.additionalSpfas[${index}]`),
    ),
    transitions: parseTeachingPlan(
      source.transitions,
      'carePath.transitions',
      parseTransitionList,
      parseTransitionConstraints,
    ),
  };
}

function parseIncidenceIntent(value: unknown, path: string): IncidenceIntent {
  const source = asRecord(value, path);
  const status = controlledValue(
    source.status,
    ['none', 'present'] as const,
    `${path}.status`,
  );
  if (status === 'none') {
    assertExactKeys(source, ['status'], path);
    return { status };
  }
  assertExactKeys(source, ['status', 'semanticMeaning'], path);
  return {
    status,
    semanticMeaning: nonEmptyString(
      source.semanticMeaning,
      `${path}.semanticMeaning`,
    ),
  };
}

function parseIncidenceConstraints(
  value: unknown,
  path: string,
): IncidenceProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(source, ['allowedStatuses', 'semanticFocus'], path);
  const allowedStatuses =
    source.allowedStatuses === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedStatuses,
          ['none', 'present'] as const,
          `${path}.allowedStatuses`,
        );
  const semanticFocus =
    source.semanticFocus === undefined
      ? undefined
      : nonEmptyString(source.semanticFocus, `${path}.semanticFocus`);
  return {
    ...(allowedStatuses === undefined ? {} : { allowedStatuses }),
    ...(semanticFocus === undefined ? {} : { semanticFocus }),
  };
}

function parseCardinality(
  value: unknown,
  path: string,
): CardinalityConstraint {
  const source = asRecord(value, path);
  if (source.kind === 'exactly') {
    assertExactKeys(source, ['kind', 'count'], path);
    return { kind: 'exactly', count: positiveInteger(source.count, `${path}.count`) };
  }
  if (source.kind === 'at_least') {
    assertExactKeys(source, ['kind', 'min', 'max'], path);
    const min = positiveInteger(source.min, `${path}.min`);
    const max =
      source.max === undefined
        ? undefined
        : positiveInteger(source.max, `${path}.max`);
    if (max !== undefined && min > max) fail(path, 'min must be <= max');
    return { kind: 'at_least', min, ...(max === undefined ? {} : { max }) };
  }
  if (source.kind === 'between') {
    assertExactKeys(source, ['kind', 'min', 'max'], path);
    const min = positiveInteger(source.min, `${path}.min`);
    const max = positiveInteger(source.max, `${path}.max`);
    if (min > max) fail(path, 'min must be <= max');
    return { kind: 'between', min, max };
  }
  fail(`${path}.kind`, 'must be exactly, at_least or between');
}

function validateFixedFindingCount(
  quantity: CardinalityConstraint,
  fixedCount: number,
  additionalFindings: AdditionalFindingsPolicy,
  path: string,
): void {
  const maximum =
    quantity.kind === 'exactly'
      ? quantity.count
      : quantity.kind === 'between'
        ? quantity.max
        : quantity.max;
  if (maximum !== undefined && fixedCount > maximum) {
    fail(path, 'fixed findings exceed the requested cardinality');
  }
  if (additionalFindings !== 'forbidden') return;
  const valid =
    quantity.kind === 'exactly'
      ? fixedCount === quantity.count
      : quantity.kind === 'between'
        ? fixedCount >= quantity.min && fixedCount <= quantity.max
        : fixedCount >= quantity.min &&
          (quantity.max === undefined || fixedCount <= quantity.max);
  if (!valid) {
    fail(path, 'cardinality requires findings that additionalFindings forbids');
  }
}

function parseAdditionalFindings(
  value: unknown,
  path: string,
): AdditionalFindingsPolicy {
  return controlledValue(
    value,
    ['forbidden', 'allowed_if_clinically_coherent'] as const,
    path,
  );
}

function parsePrmFinding(
  value: unknown,
  path: string,
  context: ParseContext,
): PrmFindingIntent {
  const source = asRecord(value, path);
  assertExactKeys(source, ['classification', 'semanticIntent'], path);
  const classification = optionalTaxonomyTermRef(
    source.classification,
    `${path}.classification`,
    context,
  );
  const semanticIntent =
    source.semanticIntent === undefined
      ? undefined
      : nonEmptyString(source.semanticIntent, `${path}.semanticIntent`);
  if (classification === undefined && semanticIntent === undefined) {
    fail(path, 'requires classification or semanticIntent');
  }
  return {
    ...(classification === undefined ? {} : { classification }),
    ...(semanticIntent === undefined ? {} : { semanticIntent }),
  };
}

function parsePrmIntent(
  value: unknown,
  path: string,
  context: ParseContext,
): PrmIntent {
  const source = asRecord(value, path);
  const status = controlledValue(
    source.status,
    ['none', 'present'] as const,
    `${path}.status`,
  );
  if (status === 'none') {
    assertExactKeys(source, ['status'], path);
    return { status };
  }
  assertExactKeys(
    source,
    ['status', 'quantity', 'fixedFindings', 'additionalFindings'],
    path,
  );
  const quantity = parseCardinality(source.quantity, `${path}.quantity`);
  const fixedFindings = asArray(
    source.fixedFindings,
    `${path}.fixedFindings`,
  ).map((item, index) =>
    parsePrmFinding(item, `${path}.fixedFindings[${index}]`, context),
  );
  const additionalFindings = parseAdditionalFindings(
    source.additionalFindings,
    `${path}.additionalFindings`,
  );
  validateFixedFindingCount(
    quantity,
    fixedFindings.length,
    additionalFindings,
    `${path}.fixedFindings`,
  );
  return { status, quantity, fixedFindings, additionalFindings };
}

function parseTaxonomyList(
  value: unknown,
  path: string,
  context: ParseContext,
): NonEmptyArray<TaxonomyTermRef> {
  const terms = asArray(value, path).map((item, index) =>
    parseTaxonomyTermRef(item, `${path}[${index}]`, context),
  );
  if (terms.length === 0) fail(path, 'must contain at least one term');
  const keys = terms.map(
    (term) => `${term.taxonomyId}|${term.taxonomyVersion}|${term.conceptId}`,
  );
  if (new Set(keys).size !== keys.length) fail(path, 'contains duplicate terms');
  return terms as unknown as NonEmptyArray<TaxonomyTermRef>;
}

function parsePrmConstraints(
  value: unknown,
  path: string,
  context: ParseContext,
): PrmProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    ['allowedStatuses', 'quantity', 'allowedClassifications', 'semanticFocus'],
    path,
  );
  const allowedStatuses =
    source.allowedStatuses === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedStatuses,
          ['none', 'present'] as const,
          `${path}.allowedStatuses`,
        );
  const quantity =
    source.quantity === undefined
      ? undefined
      : parseCardinality(source.quantity, `${path}.quantity`);
  const allowedClassifications =
    source.allowedClassifications === undefined
      ? undefined
      : parseTaxonomyList(
          source.allowedClassifications,
          `${path}.allowedClassifications`,
          context,
        );
  const semanticFocus =
    source.semanticFocus === undefined
      ? undefined
      : nonEmptyString(source.semanticFocus, `${path}.semanticFocus`);
  return {
    ...(allowedStatuses === undefined ? {} : { allowedStatuses }),
    ...(quantity === undefined ? {} : { quantity }),
    ...(allowedClassifications === undefined
      ? {}
      : { allowedClassifications }),
    ...(semanticFocus === undefined ? {} : { semanticFocus }),
  };
}

function parseRnmFinding(
  value: unknown,
  path: string,
  context: ParseContext,
): RnmFindingIntent {
  const source = asRecord(value, path);
  assertExactKeys(source, ['outcome', 'classification', 'semanticIntent'], path);
  const outcome = controlledValue(
    source.outcome,
    ['rnm', 'risk_of_rnm'] as const,
    `${path}.outcome`,
  );
  const classification = optionalTaxonomyTermRef(
    source.classification,
    `${path}.classification`,
    context,
  );
  const semanticIntent =
    source.semanticIntent === undefined
      ? undefined
      : nonEmptyString(source.semanticIntent, `${path}.semanticIntent`);
  if (classification === undefined && semanticIntent === undefined) {
    fail(path, 'requires classification or semanticIntent');
  }
  return {
    outcome,
    ...(classification === undefined ? {} : { classification }),
    ...(semanticIntent === undefined ? {} : { semanticIntent }),
  };
}

function parseRnmIntent(
  value: unknown,
  path: string,
  context: ParseContext,
): RnmIntent {
  const source = asRecord(value, path);
  const status = controlledValue(
    source.status,
    ['no_rnm', 'findings'] as const,
    `${path}.status`,
  );
  if (status === 'no_rnm') {
    assertExactKeys(source, ['status'], path);
    return { status };
  }
  assertExactKeys(
    source,
    ['status', 'quantity', 'fixedFindings', 'additionalFindings'],
    path,
  );
  const quantity = parseCardinality(source.quantity, `${path}.quantity`);
  const fixedFindings = asArray(
    source.fixedFindings,
    `${path}.fixedFindings`,
  ).map((item, index) =>
    parseRnmFinding(item, `${path}.fixedFindings[${index}]`, context),
  );
  const additionalFindings = parseAdditionalFindings(
    source.additionalFindings,
    `${path}.additionalFindings`,
  );
  validateFixedFindingCount(
    quantity,
    fixedFindings.length,
    additionalFindings,
    `${path}.fixedFindings`,
  );
  return { status, quantity, fixedFindings, additionalFindings };
}

function parseRnmConstraints(
  value: unknown,
  path: string,
  context: ParseContext,
): RnmProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    ['allowedStatuses', 'quantity', 'allowedClassifications'],
    path,
  );
  const allowedStatuses =
    source.allowedStatuses === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedStatuses,
          ['no_rnm', 'rnm', 'risk_of_rnm'] as const,
          `${path}.allowedStatuses`,
        );
  const quantity =
    source.quantity === undefined
      ? undefined
      : parseCardinality(source.quantity, `${path}.quantity`);
  const allowedClassifications =
    source.allowedClassifications === undefined
      ? undefined
      : parseTaxonomyList(
          source.allowedClassifications,
          `${path}.allowedClassifications`,
          context,
        );
  return {
    ...(allowedStatuses === undefined ? {} : { allowedStatuses }),
    ...(quantity === undefined ? {} : { quantity }),
    ...(allowedClassifications === undefined
      ? {}
      : { allowedClassifications }),
  };
}

function normalizeScopeDescription(value: unknown, path: string): string {
  const normalized = nonEmptyString(value, path).normalize('NFKC');
  if (normalized.length === 0) fail(path, 'must be a non-empty description');
  return normalized;
}

function scopeDescriptionKey(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('es-ES');
}

function parseMedicationScope(
  value: unknown,
  path: string,
): MedicationScopeIntent {
  const source = asRecord(value, path);
  if (source.kind === 'all_relevant_medications') {
    assertExactKeys(source, ['kind'], path);
    return { kind: 'all_relevant_medications' };
  }
  if (source.kind === 'semantic_targets') {
    assertExactKeys(source, ['kind', 'descriptions'], path);
    const descriptions = asArray(
      source.descriptions,
      `${path}.descriptions`,
    ).map((item, index) =>
      normalizeScopeDescription(item, `${path}.descriptions[${index}]`),
    );
    if (descriptions.length === 0) {
      fail(`${path}.descriptions`, 'must contain at least one description');
    }
    const keys = descriptions.map(scopeDescriptionKey);
    if (new Set(keys).size !== keys.length) {
      fail(`${path}.descriptions`, 'contains duplicate normalized descriptions');
    }
    return {
      kind: 'semantic_targets',
      descriptions: descriptions as unknown as NonEmptyArray<string>,
    };
  }
  fail(`${path}.kind`, 'must be all_relevant_medications or semantic_targets');
}

function medicationScopeKey(scope: MedicationScopeIntent): string {
  return scope.kind === 'all_relevant_medications'
    ? '*'
    : scope.descriptions.map(scopeDescriptionKey).sort().join('|');
}

function medicationScopeDescriptions(scope: MedicationScopeIntent): Set<string> {
  return new Set(
    scope.kind === 'all_relevant_medications'
      ? []
      : scope.descriptions.map(scopeDescriptionKey),
  );
}

function validateDisjointScopes(
  scopes: readonly MedicationScopeIntent[],
  path: string,
): void {
  if (
    scopes.some((scope) => scope.kind === 'all_relevant_medications') &&
    scopes.length > 1
  ) {
    fail(path, 'all_relevant_medications must be the only scope');
  }
  const seen = new Set<string>();
  scopes.forEach((scope, scopeIndex) => {
    for (const description of medicationScopeDescriptions(scope)) {
      if (seen.has(description)) {
        fail(`${path}[${scopeIndex}]`, 'medication scopes must be disjoint');
      }
      seen.add(description);
    }
  });
}

function parseNonAdherenceTypeIntent(
  value: unknown,
  path: string,
): NonAdherenceTypeIntent {
  const source = asRecord(value, path);
  const status = controlledValue(
    source.status,
    ['determined', 'not_determinable'] as const,
    `${path}.status`,
  );
  if (status === 'not_determinable') {
    assertExactKeys(source, ['status'], path);
    return { status };
  }
  assertExactKeys(source, ['status', 'type'], path);
  return {
    status,
    type: controlledValue(
      source.type,
      NON_ADHERENCE_TYPES,
      `${path}.type`,
    ) as NonAdherenceType,
  };
}

function parseNonAdherenceTypeConstraints(
  value: unknown,
  path: string,
): NonAdherenceTypeProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(source, ['allowedStatuses', 'allowedTypes'], path);
  const allowedStatuses =
    source.allowedStatuses === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedStatuses,
          ['determined', 'not_determinable'] as const,
          `${path}.allowedStatuses`,
        );
  const allowedTypes =
    source.allowedTypes === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedTypes,
          NON_ADHERENCE_TYPES,
          `${path}.allowedTypes`,
        );
  if (
    allowedTypes !== undefined &&
    allowedStatuses !== undefined &&
    !allowedStatuses.includes('determined')
  ) {
    fail(`${path}.allowedTypes`, 'requires determined to be an allowed status');
  }
  return {
    ...(allowedStatuses === undefined ? {} : { allowedStatuses }),
    ...(allowedTypes === undefined ? {} : { allowedTypes }),
  };
}

function parsePatientProfileIntent(
  value: unknown,
  path: string,
): AdherencePatientProfileIntent {
  const source = asRecord(value, path);
  const status = controlledValue(
    source.status,
    ['determined', 'not_determinable'] as const,
    `${path}.status`,
  );
  if (status === 'not_determinable') {
    assertExactKeys(source, ['status'], path);
    return { status };
  }
  assertExactKeys(source, ['status', 'profile'], path);
  return {
    status,
    profile: controlledValue(
      source.profile,
      ADHERENCE_PROFILES,
      `${path}.profile`,
    ) as AdherencePatientProfile,
  };
}

function parsePatientProfileConstraints(
  value: unknown,
  path: string,
): AdherencePatientProfileProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(source, ['allowedStatuses', 'allowedProfiles'], path);
  const allowedStatuses =
    source.allowedStatuses === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedStatuses,
          ['determined', 'not_determinable'] as const,
          `${path}.allowedStatuses`,
        );
  const allowedProfiles =
    source.allowedProfiles === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedProfiles,
          ADHERENCE_PROFILES,
          `${path}.allowedProfiles`,
        );
  if (
    allowedProfiles !== undefined &&
    allowedStatuses !== undefined &&
    !allowedStatuses.includes('determined')
  ) {
    fail(
      `${path}.allowedProfiles`,
      'requires determined to be an allowed status',
    );
  }
  return {
    ...(allowedStatuses === undefined ? {} : { allowedStatuses }),
    ...(allowedProfiles === undefined ? {} : { allowedProfiles }),
  };
}

function parseBarrierCategory(
  value: unknown,
  path: string,
): AdherenceBarrierCategory {
  return controlledValue(value, BARRIER_CATEGORIES, path);
}

function parseBarrierIntent(
  value: unknown,
  path: string,
  context: ParseContext,
): AdherenceBarrierIntent {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    ['role', 'category', 'classification', 'semanticIntent'],
    path,
  );
  const classification = optionalTaxonomyTermRef(
    source.classification,
    `${path}.classification`,
    context,
  );
  const semanticIntent =
    source.semanticIntent === undefined
      ? undefined
      : nonEmptyString(source.semanticIntent, `${path}.semanticIntent`);
  return {
    role: controlledValue(
      source.role,
      ['primary', 'secondary'] as const,
      `${path}.role`,
    ),
    category: parseBarrierCategory(source.category, `${path}.category`),
    ...(classification === undefined ? {} : { classification }),
    ...(semanticIntent === undefined ? {} : { semanticIntent }),
  };
}

function parseBarrierSet(
  value: unknown,
  path: string,
  context: ParseContext,
): AdherenceBarrierSetIntent {
  const source = asRecord(value, path);
  assertExactKeys(source, ['barriers', 'additionalBarriers'], path);
  const barriers = asArray(source.barriers, `${path}.barriers`).map(
    (item, index) =>
      parseBarrierIntent(item, `${path}.barriers[${index}]`, context),
  );
  if (barriers.length === 0) fail(`${path}.barriers`, 'must not be empty');
  const primaryCount = barriers.filter((barrier) => barrier.role === 'primary').length;
  if (primaryCount !== 1) {
    fail(`${path}.barriers`, 'requires exactly one primary barrier');
  }
  return {
    barriers: barriers as unknown as NonEmptyArray<AdherenceBarrierIntent>,
    additionalBarriers: parseAdditionalFindings(
      source.additionalBarriers,
      `${path}.additionalBarriers`,
    ),
  };
}

function parseBarrierConstraints(
  value: unknown,
  path: string,
): AdherenceBarrierProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    ['allowedCategories', 'requiredPrimaryCategory', 'maximumSecondaryBarriers'],
    path,
  );
  const allowedCategories =
    source.allowedCategories === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedCategories,
          BARRIER_CATEGORIES,
          `${path}.allowedCategories`,
        );
  const requiredPrimaryCategory =
    source.requiredPrimaryCategory === undefined
      ? undefined
      : parseBarrierCategory(
          source.requiredPrimaryCategory,
          `${path}.requiredPrimaryCategory`,
        );
  if (
    requiredPrimaryCategory !== undefined &&
    allowedCategories !== undefined &&
    !allowedCategories.includes(requiredPrimaryCategory)
  ) {
    fail(
      `${path}.requiredPrimaryCategory`,
      'must be included in allowedCategories',
    );
  }
  const maximumSecondaryBarriers =
    source.maximumSecondaryBarriers === undefined
      ? undefined
      : nonNegativeInteger(
          source.maximumSecondaryBarriers,
          `${path}.maximumSecondaryBarriers`,
        );
  return {
    ...(allowedCategories === undefined ? {} : { allowedCategories }),
    ...(requiredPrimaryCategory === undefined
      ? {}
      : { requiredPrimaryCategory }),
    ...(maximumSecondaryBarriers === undefined
      ? {}
      : { maximumSecondaryBarriers }),
  };
}

function parseNonAdherenceDetails(
  value: unknown,
  path: string,
  context: ParseContext,
): NonAdherenceDetailsPlan {
  const source = asRecord(value, path);
  assertExactKeys(source, ['type', 'patientProfile', 'barriers'], path);
  return {
    type: parseTeachingPlan(
      source.type,
      `${path}.type`,
      parseNonAdherenceTypeIntent,
      parseNonAdherenceTypeConstraints,
      { allowForbidden: false },
    ) as NonAdherenceDetailsPlan['type'],
    patientProfile: parseTeachingPlan(
      source.patientProfile,
      `${path}.patientProfile`,
      parsePatientProfileIntent,
      parsePatientProfileConstraints,
    ),
    barriers: parseTeachingPlan(
      source.barriers,
      `${path}.barriers`,
      (fixed, fixedPath) => parseBarrierSet(fixed, fixedPath, context),
      parseBarrierConstraints,
    ),
  };
}

function parseAdherenceAssessment(
  value: unknown,
  path: string,
  context: ParseContext,
): AdherenceAssessmentIntent {
  const source = asRecord(value, path);
  assertExactKeys(source, ['medicationScope', 'status', 'nonAdherence'], path);
  const status = controlledValue(
    source.status,
    ADHERENCE_STATUSES,
    `${path}.status`,
  ) as AdherenceStatus;
  const medicationScope = parseMedicationScope(
    source.medicationScope,
    `${path}.medicationScope`,
  );
  if (status === 'non_adherent') {
    if (source.nonAdherence === undefined) {
      fail(`${path}.nonAdherence`, 'is required for non_adherent');
    }
    return {
      medicationScope,
      status,
      nonAdherence: parseNonAdherenceDetails(
        source.nonAdherence,
        `${path}.nonAdherence`,
        context,
      ),
    };
  }
  if (source.nonAdherence !== undefined) {
    fail(`${path}.nonAdherence`, `is forbidden for ${status}`);
  }
  return { medicationScope, status };
}

function parseAdherenceCase(
  value: unknown,
  path: string,
  context: ParseContext,
): AdherenceCaseIntent {
  const source = asRecord(value, path);
  assertExactKeys(source, ['assessments'], path);
  const assessments = asArray(source.assessments, `${path}.assessments`).map(
    (item, index) =>
      parseAdherenceAssessment(item, `${path}.assessments[${index}]`, context),
  );
  if (assessments.length === 0) {
    fail(`${path}.assessments`, 'must contain at least one assessment');
  }
  validateDisjointScopes(
    assessments.map((assessment) => assessment.medicationScope),
    `${path}.assessments`,
  );
  return {
    assessments:
      assessments as unknown as NonEmptyArray<AdherenceAssessmentIntent>,
  };
}

function parseAdherenceConstraints(
  value: unknown,
  path: string,
  context: ParseContext,
): AdherenceProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    [
      'allowedStatuses',
      'maximumAssessments',
      'allowedMedicationScopes',
      'whenNonAdherent',
    ],
    path,
  );
  const allowedStatuses =
    source.allowedStatuses === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedStatuses,
          ADHERENCE_STATUSES,
          `${path}.allowedStatuses`,
        );
  const maximumAssessments =
    source.maximumAssessments === undefined
      ? undefined
      : positiveInteger(
          source.maximumAssessments,
          `${path}.maximumAssessments`,
        );
  const allowedMedicationScopes =
    source.allowedMedicationScopes === undefined
      ? undefined
      : asArray(
          source.allowedMedicationScopes,
          `${path}.allowedMedicationScopes`,
        ).map((item, index) =>
          parseMedicationScope(
            item,
            `${path}.allowedMedicationScopes[${index}]`,
          ),
        );
  if (allowedMedicationScopes !== undefined) {
    if (allowedMedicationScopes.length === 0) {
      fail(`${path}.allowedMedicationScopes`, 'must not be empty');
    }
    validateDisjointScopes(
      allowedMedicationScopes,
      `${path}.allowedMedicationScopes`,
    );
  }
  const whenNonAdherent =
    source.whenNonAdherent === undefined
      ? undefined
      : parseNonAdherenceDetails(
          source.whenNonAdherent,
          `${path}.whenNonAdherent`,
          context,
        );
  if (
    whenNonAdherent !== undefined &&
    allowedStatuses !== undefined &&
    !allowedStatuses.includes('non_adherent')
  ) {
    fail(
      `${path}.whenNonAdherent`,
      'requires non_adherent to be an allowed status',
    );
  }
  return {
    ...(allowedStatuses === undefined ? {} : { allowedStatuses }),
    ...(maximumAssessments === undefined ? {} : { maximumAssessments }),
    ...(allowedMedicationScopes === undefined
      ? {}
      : {
          allowedMedicationScopes:
            allowedMedicationScopes as unknown as NonEmptyArray<MedicationScopeIntent>,
        }),
    ...(whenNonAdherent === undefined ? {} : { whenNonAdherent }),
  };
}

function parseStrategyApplication(
  value: unknown,
  path: string,
): AdherenceStrategyApplication {
  if (value === 'all_non_adherent_scopes') return value;
  const source = asRecord(value, path);
  assertExactKeys(source, ['medicationScope'], path);
  return {
    medicationScope: parseMedicationScope(
      source.medicationScope,
      `${path}.medicationScope`,
    ),
  };
}

function parseStrategyAddresses(
  value: unknown,
  path: string,
): AdherenceStrategyAddresses {
  if (value === 'primary_barrier' || value === 'all_identified_barriers') {
    return value;
  }
  const source = asRecord(value, path);
  assertExactKeys(source, ['semanticProblems'], path);
  const semanticProblems = asArray(
    source.semanticProblems,
    `${path}.semanticProblems`,
  ).map((item, index) =>
    nonEmptyString(item, `${path}.semanticProblems[${index}]`),
  );
  if (semanticProblems.length === 0) {
    fail(`${path}.semanticProblems`, 'must not be empty');
  }
  return {
    semanticProblems:
      semanticProblems as unknown as NonEmptyArray<string>,
  };
}

function parseStrategyIntent(
  value: unknown,
  path: string,
): AdherenceStrategyIntent {
  const source = asRecord(value, path);
  const category = controlledValue(
    source.category,
    STRATEGIES,
    `${path}.category`,
  ) as AdherenceStrategyCategory;
  const appliesTo = parseStrategyApplication(
    source.appliesTo,
    `${path}.appliesTo`,
  );
  const addresses = parseStrategyAddresses(
    source.addresses,
    `${path}.addresses`,
  );
  if (category !== 'combined') {
    assertExactKeys(source, ['category', 'appliesTo', 'addresses'], path);
    return {
      category: category as BaseAdherenceStrategyCategory,
      appliesTo,
      addresses,
    };
  }
  assertExactKeys(
    source,
    ['category', 'componentCategories', 'appliesTo', 'addresses'],
    path,
  );
  const componentCategories = distinctControlledValues(
    source.componentCategories,
    BASE_STRATEGIES,
    `${path}.componentCategories`,
  );
  if (componentCategories.length < 2) {
    fail(`${path}.componentCategories`, 'must contain at least two categories');
  }
  return { category, componentCategories, appliesTo, addresses };
}

function parseStrategyList(
  value: unknown,
  path: string,
): NonEmptyArray<AdherenceStrategyIntent> {
  const strategies = asArray(value, path).map((item, index) =>
    parseStrategyIntent(item, `${path}[${index}]`),
  );
  if (strategies.length === 0) fail(path, 'must contain at least one strategy');
  return strategies as unknown as NonEmptyArray<AdherenceStrategyIntent>;
}

function parseStrategyConstraints(
  value: unknown,
  path: string,
): AdherenceStrategyProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(source, ['allowedCategories', 'maximumStrategies'], path);
  const allowedCategories =
    source.allowedCategories === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedCategories,
          STRATEGIES,
          `${path}.allowedCategories`,
        );
  const maximumStrategies =
    source.maximumStrategies === undefined
      ? undefined
      : positiveInteger(source.maximumStrategies, `${path}.maximumStrategies`);
  return {
    ...(allowedCategories === undefined ? {} : { allowedCategories }),
    ...(maximumStrategies === undefined ? {} : { maximumStrategies }),
  };
}

function parseActionCategory(
  value: unknown,
  path: string,
): ProfessionalActionCategory {
  return controlledValue(value, ACTION_CATEGORIES, path);
}

function parseProfessionalAction(
  value: unknown,
  path: string,
  context: ParseContext,
): ProfessionalActionIntent {
  const source = asRecord(value, path);
  const category = parseActionCategory(source.category, `${path}.category`);
  const spfa = parseSpfaService(source.spfa, `${path}.spfa`);
  const classification = optionalTaxonomyTermRef(
    source.classification,
    `${path}.classification`,
    context,
  );
  if (category === 'other_spfa') {
    assertExactKeys(source, ['spfa', 'category', 'targetSpfa', 'classification'], path);
    return {
      spfa,
      category,
      targetSpfa: parseSpfaService(source.targetSpfa, `${path}.targetSpfa`),
      ...(classification === undefined ? {} : { classification }),
    };
  }
  assertExactKeys(source, ['spfa', 'category', 'classification'], path);
  return {
    spfa,
    category,
    ...(classification === undefined ? {} : { classification }),
  } as ProfessionalActionIntent;
}

function parseActionList(
  value: unknown,
  path: string,
  context: ParseContext,
): NonEmptyArray<ProfessionalActionIntent> {
  const actions = asArray(value, path).map((item, index) =>
    parseProfessionalAction(item, `${path}[${index}]`, context),
  );
  if (actions.length === 0) fail(path, 'must contain at least one action');
  return actions as unknown as NonEmptyArray<ProfessionalActionIntent>;
}

function parseActionConstraints(
  value: unknown,
  path: string,
): ProfessionalActionProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(source, ['allowedCategories', 'maximumActions'], path);
  const allowedCategories =
    source.allowedCategories === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedCategories,
          ACTION_CATEGORIES,
          `${path}.allowedCategories`,
        );
  const maximumActions =
    source.maximumActions === undefined
      ? undefined
      : positiveInteger(source.maximumActions, `${path}.maximumActions`);
  return {
    ...(allowedCategories === undefined ? {} : { allowedCategories }),
    ...(maximumActions === undefined ? {} : { maximumActions }),
  };
}

function parseIntervention(
  value: unknown,
  path: string,
  context: ParseContext,
): PharmaceuticalInterventionIntent {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    [
      'spfa',
      'target',
      'classification',
      'addressedProblems',
      'relatedActionCategory',
    ],
    path,
  );
  const classification = optionalTaxonomyTermRef(
    source.classification,
    `${path}.classification`,
    context,
  );
  const addressedProblems = asArray(
    source.addressedProblems,
    `${path}.addressedProblems`,
  ).map((item, index) =>
    nonEmptyString(item, `${path}.addressedProblems[${index}]`),
  );
  if (addressedProblems.length === 0) {
    fail(`${path}.addressedProblems`, 'must not be empty');
  }
  const relatedActionCategory =
    source.relatedActionCategory === undefined
      ? undefined
      : parseActionCategory(
          source.relatedActionCategory,
          `${path}.relatedActionCategory`,
        );
  return {
    spfa: parseSpfaService(source.spfa, `${path}.spfa`),
    target: controlledValue(
      source.target,
      INTERVENTION_TARGETS,
      `${path}.target`,
    ) as PharmaceuticalInterventionTarget,
    ...(classification === undefined ? {} : { classification }),
    addressedProblems:
      addressedProblems as unknown as NonEmptyArray<string>,
    ...(relatedActionCategory === undefined ? {} : { relatedActionCategory }),
  };
}

function parseInterventionList(
  value: unknown,
  path: string,
  context: ParseContext,
): NonEmptyArray<PharmaceuticalInterventionIntent> {
  const interventions = asArray(value, path).map((item, index) =>
    parseIntervention(item, `${path}[${index}]`, context),
  );
  if (interventions.length === 0) {
    fail(path, 'must contain at least one intervention');
  }
  return interventions as unknown as NonEmptyArray<PharmaceuticalInterventionIntent>;
}

function parseInterventionConstraints(
  value: unknown,
  path: string,
): PharmaceuticalInterventionProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(source, ['allowedTargets', 'maximumInterventions'], path);
  const allowedTargets =
    source.allowedTargets === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedTargets,
          INTERVENTION_TARGETS,
          `${path}.allowedTargets`,
        );
  const maximumInterventions =
    source.maximumInterventions === undefined
      ? undefined
      : positiveInteger(
          source.maximumInterventions,
          `${path}.maximumInterventions`,
        );
  return {
    ...(allowedTargets === undefined ? {} : { allowedTargets }),
    ...(maximumInterventions === undefined ? {} : { maximumInterventions }),
  };
}

function parseReportRequirement(
  value: unknown,
  path: string,
): ReportRequirement {
  const source = asRecord(value, path);
  assertExactKeys(source, ['status', 'essentialContents'], path);
  const status = controlledValue(
    source.status,
    ['not_required', 'appropriate', 'required'] as const,
    `${path}.status`,
  );
  const essentialContents = asArray(
    source.essentialContents,
    `${path}.essentialContents`,
  ).map((item, index) =>
    nonEmptyString(item, `${path}.essentialContents[${index}]`),
  );
  if (status === 'not_required') {
    if (essentialContents.length !== 0) {
      fail(`${path}.essentialContents`, 'must be empty when report is not required');
    }
    return { status, essentialContents: [] };
  }
  if (essentialContents.length === 0) {
    fail(`${path}.essentialContents`, 'must not be empty for this report status');
  }
  return {
    status,
    essentialContents:
      essentialContents as unknown as NonEmptyArray<string>,
  };
}

function parseReferralIntent(
  value: unknown,
  path: string,
  context: ParseContext,
): ReferralIntent {
  const source = asRecord(value, path);
  const status = controlledValue(
    source.status,
    ['not_required', 'required'] as const,
    `${path}.status`,
  );
  if (status === 'not_required') {
    assertExactKeys(source, ['status'], path);
    return { status };
  }
  assertExactKeys(
    source,
    ['status', 'destination', 'urgency', 'reason', 'report'],
    path,
  );
  const destination = asRecord(source.destination, `${path}.destination`);
  assertExactKeys(destination, ['label', 'classification'], `${path}.destination`);
  const classification = optionalTaxonomyTermRef(
    destination.classification,
    `${path}.destination.classification`,
    context,
  );
  return {
    status,
    destination: {
      label: nonEmptyString(destination.label, `${path}.destination.label`),
      ...(classification === undefined ? {} : { classification }),
    },
    urgency: controlledValue(
      source.urgency,
      ['non_urgent', 'urgent'] as const,
      `${path}.urgency`,
    ) as ReferralUrgency,
    reason: nonEmptyString(source.reason, `${path}.reason`),
    report: parseReportRequirement(source.report, `${path}.report`),
  };
}

function parseReferralConstraints(
  value: unknown,
  path: string,
  context: ParseContext,
): ReferralProposalConstraints {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    ['allowedStatuses', 'allowedUrgencies', 'allowedDestinations'],
    path,
  );
  const allowedStatuses =
    source.allowedStatuses === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedStatuses,
          ['not_required', 'required'] as const,
          `${path}.allowedStatuses`,
        );
  const allowedUrgencies =
    source.allowedUrgencies === undefined
      ? undefined
      : distinctControlledValues(
          source.allowedUrgencies,
          ['non_urgent', 'urgent'] as const,
          `${path}.allowedUrgencies`,
        );
  const allowedDestinations =
    source.allowedDestinations === undefined
      ? undefined
      : asArray(
          source.allowedDestinations,
          `${path}.allowedDestinations`,
        ).map((item, index) => {
          const destinationPath = `${path}.allowedDestinations[${index}]`;
          const destination = asRecord(item, destinationPath);
          assertExactKeys(destination, ['label', 'classification'], destinationPath);
          const classification = optionalTaxonomyTermRef(
            destination.classification,
            `${destinationPath}.classification`,
            context,
          );
          return {
            label: nonEmptyString(destination.label, `${destinationPath}.label`),
            ...(classification === undefined ? {} : { classification }),
          };
        });
  if (allowedDestinations !== undefined && allowedDestinations.length === 0) {
    fail(`${path}.allowedDestinations`, 'must not be empty');
  }
  return {
    ...(allowedStatuses === undefined ? {} : { allowedStatuses }),
    ...(allowedUrgencies === undefined ? {} : { allowedUrgencies }),
    ...(allowedDestinations === undefined
      ? {}
      : {
          allowedDestinations:
            allowedDestinations as unknown as NonEmptyArray<{
              label: string;
              classification?: TaxonomyTermRef;
            }>,
        }),
  };
}

function isForbidden(
  plan:
    | { targeting: 'targeted' }
    | {
        targeting: 'not_targeted';
        policy: 'allowed_if_clinically_coherent' | 'forbidden';
      },
): boolean {
  return plan.targeting === 'not_targeted' && plan.policy === 'forbidden';
}

function fixedValue<T, C>(
  plan: TeachingDimensionPlan<T, C>,
): T | undefined {
  return plan.targeting === 'targeted' &&
    plan.decision.mode === 'teacher_fixed'
    ? plan.decision.value
    : undefined;
}

function aiConstraints<T, C>(
  plan: TeachingDimensionPlan<T, C>,
): C | undefined {
  return plan.targeting === 'targeted' && plan.decision.mode === 'ai_proposes'
    ? plan.decision.constraints
    : undefined;
}

type CarePathIndex = {
  possibleServices: Set<SpfaService>;
  requiredServices: Set<SpfaService>;
  candidateConfigurations: Array<Set<SpfaService>>;
  transitionPossible: (from: SpfaService, to: SpfaService) => boolean;
};

function hasCycle(transitions: readonly SpfaTransitionIntent[]): boolean {
  const adjacency = new Map<SpfaService, SpfaService[]>();
  transitions.forEach(({ from, to }) => {
    const values = adjacency.get(from) ?? [];
    values.push(to);
    adjacency.set(from, values);
  });
  const visiting = new Set<SpfaService>();
  const visited = new Set<SpfaService>();
  const visit = (node: SpfaService): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return SPFA_SERVICES.some(visit);
}

function validateCarePath(carePath: TeachingCarePathPlanV2): CarePathIndex {
  const initialFixed = fixedValue(carePath.initialSpfa);
  const initialConstraints = aiConstraints(carePath.initialSpfa);
  const initialOptions: readonly SpfaService[] =
    initialFixed === undefined
      ? (initialConstraints?.allowedServices ?? SPFA_SERVICES)
      : [initialFixed.service];
  const requiredServices = new Set<SpfaService>();
  if (initialOptions.length === 1) requiredServices.add(initialOptions[0]);

  const additionalSeen = new Set<SpfaService>();
  const targetedAdditional = new Set<SpfaService>();
  const optionalAdditional = new Set<SpfaService>();
  carePath.additionalSpfas.forEach((additional, index) => {
    if (additionalSeen.has(additional.service)) {
      fail(
        `carePath.additionalSpfas[${index}].service`,
        'duplicate additional SPFA service',
      );
    }
    additionalSeen.add(additional.service);
    if (isForbidden(additional.inclusion)) return;
    if (
      initialFixed?.service === additional.service &&
      additional.inclusion.targeting === 'targeted'
    ) {
      fail(
        `carePath.additionalSpfas[${index}]`,
        'initial SPFA cannot reappear as an additional SPFA',
      );
    }
    if (additional.inclusion.targeting === 'targeted') {
      targetedAdditional.add(additional.service);
      requiredServices.add(additional.service);
    } else {
      optionalAdditional.add(additional.service);
    }
  });

  const optionalValues = [...optionalAdditional];
  const optionalSubsets: SpfaService[][] = [];
  for (let mask = 0; mask < 1 << optionalValues.length; mask += 1) {
    optionalSubsets.push(
      optionalValues.filter((_, index) => (mask & (1 << index)) !== 0),
    );
  }
  let candidateConfigurations: Array<Set<SpfaService>> = [];
  initialOptions.forEach((initial) => {
    if (targetedAdditional.has(initial)) return;
    optionalSubsets.forEach((optional) => {
      candidateConfigurations.push(
        new Set<SpfaService>([
          initial,
          ...targetedAdditional,
          ...optional.filter((service) => service !== initial),
        ]),
      );
    });
  });
  if (candidateConfigurations.length === 0) {
    fail('carePath', 'no feasible SPFA service configuration exists');
  }
  const possibleServices = new Set<SpfaService>();
  candidateConfigurations.forEach((configuration) =>
    configuration.forEach((service) => possibleServices.add(service)),
  );

  const transitionFixed = fixedValue(carePath.transitions);
  const transitionConstraints = aiConstraints(carePath.transitions);
  const explicitTransitions =
    transitionFixed ?? transitionConstraints?.allowedTransitions ?? [];
  explicitTransitions.forEach((transition, index) => {
    if (!possibleServices.has(transition.from)) {
      fail(
        `carePath.transitions[${index}].from`,
        'transition origin is not an existing or permitted SPFA',
      );
    }
    if (!possibleServices.has(transition.to)) {
      fail(
        `carePath.transitions[${index}].to`,
        'transition destination is not an existing or permitted SPFA',
      );
    }
  });
  if (hasCycle(explicitTransitions)) {
    fail('carePath.transitions', 'SPFA transitions must not contain cycles');
  }
  if (transitionFixed !== undefined) {
    candidateConfigurations = candidateConfigurations.filter((configuration) =>
      transitionFixed.every(
        ({ from, to }) => configuration.has(from) && configuration.has(to),
      ),
    );
    if (candidateConfigurations.length === 0) {
      fail('carePath.transitions', 'no feasible service configuration satisfies transitions');
    }
  }

  const explicitKeys = new Set(
    explicitTransitions.map(({ from, to }) => `${from}->${to}`),
  );
  const unrestrictedTransitions =
    (carePath.transitions.targeting === 'targeted' &&
      carePath.transitions.decision.mode === 'ai_proposes' &&
      carePath.transitions.decision.constraints?.allowedTransitions ===
        undefined) ||
    (carePath.transitions.targeting === 'not_targeted' &&
      carePath.transitions.policy === 'allowed_if_clinically_coherent');
  return {
    possibleServices,
    requiredServices,
    candidateConfigurations,
    transitionPossible: (from, to) =>
      from !== to &&
      candidateConfigurations.some(
        (configuration) => configuration.has(from) && configuration.has(to),
      ) &&
      (unrestrictedTransitions || explicitKeys.has(`${from}->${to}`)),
  };
}

function prmCanBePresent(
  plan: TeachingCaseGenerationBriefV2['prm'],
): boolean {
  if (isForbidden(plan)) return false;
  const fixed = fixedValue(plan);
  if (fixed !== undefined) return fixed.status === 'present';
  const constraints = aiConstraints(plan);
  if (constraints?.allowedStatuses !== undefined) {
    return constraints.allowedStatuses.includes('present');
  }
  return true;
}

function rnmRequiresRisk(
  plan: TeachingCaseGenerationBriefV2['rnm'],
): boolean {
  const fixed = fixedValue(plan);
  if (fixed?.status === 'findings') {
    return fixed.fixedFindings.some((finding) => finding.outcome === 'risk_of_rnm');
  }
  const constraints = aiConstraints(plan);
  return (
    constraints?.allowedStatuses !== undefined &&
    constraints.allowedStatuses.every((status) => status === 'risk_of_rnm')
  );
}

type AdherencePossibility = {
  canProduceNonAdherent: boolean;
  fixedNonAdherentScopeKeys?: Set<string>;
  allowedScopeKeys?: Set<string>;
  fixedBarrierCapabilityByScope?: Map<string, boolean>;
  proposedBarriersPossible?: boolean;
};

function barriersCanBeIdentified(details: NonAdherenceDetailsPlan): boolean {
  return !isForbidden(details.barriers);
}

function adherencePossibility(
  plan: TeachingCaseGenerationBriefV2['adherence'],
): AdherencePossibility {
  if (isForbidden(plan)) return { canProduceNonAdherent: false };
  const fixed = fixedValue(plan);
  if (fixed !== undefined) {
    const nonAdherentAssessments = fixed.assessments.filter(
      (assessment) => assessment.status === 'non_adherent',
    );
    const scopes = nonAdherentAssessments.map((assessment) =>
      medicationScopeKey(assessment.medicationScope),
    );
    return {
      canProduceNonAdherent: scopes.length > 0,
      fixedNonAdherentScopeKeys: new Set(scopes),
      fixedBarrierCapabilityByScope: new Map(
        nonAdherentAssessments.map((assessment) => [
          medicationScopeKey(assessment.medicationScope),
          barriersCanBeIdentified(assessment.nonAdherence!),
        ]),
      ),
    };
  }
  const constraints = aiConstraints(plan);
  const canProduceNonAdherent =
    constraints?.allowedStatuses === undefined ||
    constraints.allowedStatuses.includes('non_adherent');
  return {
    canProduceNonAdherent,
    proposedBarriersPossible:
      constraints?.whenNonAdherent === undefined
        ? true
        : barriersCanBeIdentified(constraints.whenNonAdherent),
    ...(constraints?.allowedMedicationScopes === undefined
      ? {}
      : {
          allowedScopeKeys: new Set(
            constraints.allowedMedicationScopes.map(medicationScopeKey),
          ),
        }),
  };
}

function validateStrategyScopes(
  strategies: TeachingCaseGenerationBriefV2['adherenceStrategies'],
  adherence: TeachingCaseGenerationBriefV2['adherence'],
): void {
  if (strategies.targeting !== 'targeted') return;
  const possibility = adherencePossibility(adherence);
  if (!possibility.canProduceNonAdherent) {
    fail(
      'adherenceStrategies',
      'targeted strategies require at least one possible non_adherent scope',
    );
  }
  const fixedStrategies = fixedValue(strategies);
  if (fixedStrategies === undefined) return;
  fixedStrategies.forEach((strategy, index) => {
    const path = `adherenceStrategies.decision.value[${index}]`;
    const scopeKey =
      strategy.appliesTo === 'all_non_adherent_scopes'
        ? undefined
        : medicationScopeKey(strategy.appliesTo.medicationScope);
    if (scopeKey !== undefined) {
      if (
        possibility.fixedNonAdherentScopeKeys !== undefined &&
        !possibility.fixedNonAdherentScopeKeys.has(scopeKey)
      ) {
        fail(
          `${path}.appliesTo`,
          'scope does not match a fixed non_adherent assessment',
        );
      }
      if (
        possibility.allowedScopeKeys !== undefined &&
        !possibility.allowedScopeKeys.has(scopeKey)
      ) {
        fail(
          `${path}.appliesTo`,
          'scope is not permitted by adherence constraints',
        );
      }
    }
    if (typeof strategy.addresses !== 'string') return;
    const barriersPossible =
      scopeKey === undefined
        ? possibility.fixedBarrierCapabilityByScope === undefined
          ? possibility.proposedBarriersPossible !== false
          : [...possibility.fixedBarrierCapabilityByScope.values()].every(Boolean)
        : possibility.fixedBarrierCapabilityByScope?.get(scopeKey) ??
          possibility.proposedBarriersPossible !== false;
    if (!barriersPossible) {
      fail(
        `${path}.addresses`,
        'barrier-based strategy requires barriers to be identifiable',
      );
    }
  });
}

function referralCanBeRequired(
  plan: TeachingCaseGenerationBriefV2['referral'],
): boolean {
  if (isForbidden(plan)) return false;
  const fixed = fixedValue(plan);
  if (fixed !== undefined) return fixed.status === 'required';
  const constraints = aiConstraints(plan);
  return (
    constraints?.allowedStatuses === undefined ||
    constraints.allowedStatuses.includes('required')
  );
}

function validateActionsAndInterventions(
  brief: TeachingCaseGenerationBriefV2,
  carePath: CarePathIndex,
): void {
  const simultaneouslyRequiredServices = new Set<SpfaService>();
  const actions = fixedValue(brief.professionalActions) ?? [];
  actions.forEach((action, index) => {
    const path = `professionalActions.decision.value[${index}]`;
    simultaneouslyRequiredServices.add(action.spfa);
    if (!carePath.possibleServices.has(action.spfa)) {
      fail(`${path}.spfa`, 'SPFA is not present or permitted by carePath');
    }
    if (action.category === 'other_spfa') {
      simultaneouslyRequiredServices.add(action.targetSpfa);
      if (action.spfa === action.targetSpfa) {
        fail(path, 'other_spfa origin and destination must differ');
      }
      if (!carePath.possibleServices.has(action.targetSpfa)) {
        fail(`${path}.targetSpfa`, 'target SPFA is not present or permitted');
      }
      if (!carePath.transitionPossible(action.spfa, action.targetSpfa)) {
        fail(path, 'other_spfa requires a possible matching transition');
      }
    }
    if (action.category === 'referral' && !referralCanBeRequired(brief.referral)) {
      fail(path, 'referral action requires referral to be able to be required');
    }
  });

  const proposedActionConstraints = aiConstraints(brief.professionalActions);
  if (
    proposedActionConstraints?.allowedCategories !== undefined &&
    proposedActionConstraints.allowedCategories.every(
      (category) => category === 'referral',
    ) &&
    !referralCanBeRequired(brief.referral)
  ) {
    fail(
      'professionalActions.decision.constraints.allowedCategories',
      'referral-only actions require referral to be able to be required',
    );
  }

  const interventions = fixedValue(brief.pharmaceuticalInterventions) ?? [];
  interventions.forEach((intervention, index) => {
    simultaneouslyRequiredServices.add(intervention.spfa);
    if (!carePath.possibleServices.has(intervention.spfa)) {
      fail(
        `pharmaceuticalInterventions.decision.value[${index}].spfa`,
        'SPFA is not present or permitted by carePath',
      );
    }
  });

  if (
    !carePath.candidateConfigurations.some((configuration) =>
      [...simultaneouslyRequiredServices].every((service) =>
        configuration.has(service),
      ),
    )
  ) {
    fail(
      'carePath',
      'no feasible service configuration satisfies all fixed actions and interventions',
    );
  }
}

function parseRevision(
  value: unknown,
  briefId: TeachingBriefId,
): TeachingCaseGenerationBriefV2['revision'] {
  const source = asRecord(value, 'revision');
  assertExactKeys(source, ['number', 'previousBriefId'], 'revision');
  const number = positiveInteger(source.number, 'revision.number');
  if (number === 1) {
    if (source.previousBriefId !== undefined) {
      fail('revision.previousBriefId', 'must be absent for revision 1');
    }
    return { number };
  }
  if (source.previousBriefId === undefined) {
    fail('revision.previousBriefId', 'is required after revision 1');
  }
  const previousBriefId = validateTeachingBriefId(
    source.previousBriefId,
    'revision.previousBriefId',
  );
  if (previousBriefId === briefId) {
    fail('revision.previousBriefId', 'must differ from briefId');
  }
  return { number, previousBriefId };
}

export function validateTeachingCaseGenerationBriefV2(
  input: unknown,
): TeachingCaseGenerationBriefV2 {
  const source = asRecord(input, 'teachingBrief');
  assertExactKeys(
    source,
    [
      'schemaVersion',
      'briefId',
      'revision',
      'generationMode',
      'complexity',
      'carePath',
      'incidence',
      'prm',
      'rnm',
      'adherence',
      'adherenceStrategies',
      'professionalActions',
      'pharmaceuticalInterventions',
      'referral',
      'teacherInstruction',
    ],
    'teachingBrief',
  );
  if (source.schemaVersion !== '2.0') {
    fail('schemaVersion', 'must be 2.0');
  }
  const briefId = validateTeachingBriefId(source.briefId);
  const context: ParseContext = { taxonomyVersions: new Map() };
  const carePath = parseCarePath(source.carePath);
  const brief: TeachingCaseGenerationBriefV2 = {
    schemaVersion: '2.0',
    briefId,
    revision: parseRevision(source.revision, briefId),
    generationMode: controlledValue(
      source.generationMode,
      ['strict', 'flexible'] as const,
      'generationMode',
    ),
    complexity: controlledValue(
      source.complexity,
      ['low', 'medium', 'high'] as const,
      'complexity',
    ),
    carePath,
    incidence: parseTeachingPlan(
      source.incidence,
      'incidence',
      parseIncidenceIntent,
      parseIncidenceConstraints,
    ),
    prm: parseTeachingPlan(
      source.prm,
      'prm',
      (value, path) => parsePrmIntent(value, path, context),
      (value, path) => parsePrmConstraints(value, path, context),
    ),
    rnm: parseTeachingPlan(
      source.rnm,
      'rnm',
      (value, path) => parseRnmIntent(value, path, context),
      (value, path) => parseRnmConstraints(value, path, context),
    ),
    adherence: parseTeachingPlan(
      source.adherence,
      'adherence',
      (value, path) => parseAdherenceCase(value, path, context),
      (value, path) => parseAdherenceConstraints(value, path, context),
    ),
    adherenceStrategies: parseTeachingPlan(
      source.adherenceStrategies,
      'adherenceStrategies',
      parseStrategyList,
      parseStrategyConstraints,
    ),
    professionalActions: parseTeachingPlan(
      source.professionalActions,
      'professionalActions',
      (value, path) => parseActionList(value, path, context),
      parseActionConstraints,
    ),
    pharmaceuticalInterventions: parseTeachingPlan(
      source.pharmaceuticalInterventions,
      'pharmaceuticalInterventions',
      (value, path) => parseInterventionList(value, path, context),
      parseInterventionConstraints,
    ),
    referral: parseTeachingPlan(
      source.referral,
      'referral',
      (value, path) => parseReferralIntent(value, path, context),
      (value, path) => parseReferralConstraints(value, path, context),
    ),
    ...(source.teacherInstruction === undefined
      ? {}
      : {
          teacherInstruction: nonEmptyString(
            source.teacherInstruction,
            'teacherInstruction',
          ),
        }),
  };

  const carePathIndex = validateCarePath(brief.carePath);
  if (
    carePathIndex.requiredServices.has('medication_adherence') &&
    isForbidden(brief.adherence)
  ) {
    fail(
      'adherence',
      'cannot be forbidden when medication_adherence is part of carePath',
    );
  }
  if (!prmCanBePresent(brief.prm) && rnmRequiresRisk(brief.rnm)) {
    fail('rnm', 'risk_of_rnm is impossible when PRM cannot be generated');
  }
  validateStrategyScopes(brief.adherenceStrategies, brief.adherence);
  validateActionsAndInterventions(brief, carePathIndex);
  return brief;
}
