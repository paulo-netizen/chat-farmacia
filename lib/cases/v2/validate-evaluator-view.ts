import type {
  AdherenceAssessment,
  AdherenceBarrier,
  AdherenceBarrierAssessment,
  AdherencePatientProfileConclusion,
  AdherenceStrategy,
  AssessmentStatus,
  BaseAdherenceStrategyCategory,
  CarePathV2,
  ConclusionId,
  EvidenceExpression,
  EvidenceLeafRef,
  EvidenceRule,
  EvaluatorConclusion,
  EvaluatorVersionsV2,
  EvaluatorViewV2,
  FollowUpEpisode,
  IncidenceAssessment,
  IncidenceFinding,
  NonEmptyArray,
  NonAdherenceTypeConclusion,
  PharmaceuticalIntervention,
  ProfessionalAction,
  PrmAssessment,
  PrmFinding,
  PrmRnmRelation,
  RnmAssessment,
  ReferralConclusion,
  ReportRequirement,
  SpfaConclusion,
  SpfaService,
  SpfaTransition,
  TaxonomyTermRef,
  VersionRef,
} from './evaluator-types';
import type {
  FactId,
  MedicationId,
  PatientRuntimeViewV2,
} from './types';
import { validateCaseVersionId } from './validate-patient-facts';

const UUID_BODY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SPFA_SERVICES = [
  'dispensing',
  'pharmaceutical_indication',
  'medication_adherence',
] as const;

const ASSESSMENT_STATUSES = [
  'none',
  'present',
  'not_determinable',
] as const;

const EVIDENCE_RULE_KINDS = new Set([
  'incidence_assessment',
  'incidence',
  'prm_assessment',
  'prm',
  'rnm_assessment',
  'adherence_assessment',
  'non_adherence_type',
  'adherence_patient_profile',
  'adherence_barrier_assessment',
  'adherence_barrier',
  'adherence_strategy',
  'professional_action',
  'pharmaceutical_intervention',
  'referral',
]);

const ADHERENCE_STATUSES = [
  'adherent',
  'non_adherent',
  'not_determinable',
] as const;

const BASE_ADHERENCE_STRATEGIES = [
  'technical',
  'behavioral',
  'educational',
  'social_family_support',
] as const;

const PROFESSIONAL_ACTION_CATEGORIES = [
  'dispense',
  'do_not_dispense',
  'pharmacological_treatment',
  'non_pharmacological_treatment',
  'hygienic_dietary_measures',
  'referral',
  'other_spfa',
] as const;

type AnyConclusion = EvaluatorConclusion<string, unknown>;

export class EvaluatorViewValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'EvaluatorViewValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new EvaluatorViewValidationError(path, message);
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

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
  return value;
}

function assertExactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) {
      fail(`${path}.${key}`, 'unexpected property');
    }
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
  prefix: 'conclusion' | 'fact' | 'med',
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

function parseConclusionId(value: unknown, path: string): ConclusionId {
  return opaqueId<ConclusionId>(value, 'conclusion', path);
}

function parseFactId(value: unknown, path: string): FactId {
  return opaqueId<FactId>(value, 'fact', path);
}

function parseMedicationId(value: unknown, path: string): MedicationId {
  return opaqueId<MedicationId>(value, 'med', path);
}

function parseVersionRef(value: unknown, path: string): VersionRef {
  const source = asRecord(value, path);
  return {
    id: nonEmptyString(source.id, `${path}.id`),
    version: nonEmptyString(source.version, `${path}.version`),
  };
}

function parseTaxonomyTermRef(
  value: unknown,
  path: string,
): TaxonomyTermRef {
  const source = asRecord(value, path);
  return {
    taxonomyId: nonEmptyString(source.taxonomyId, `${path}.taxonomyId`),
    taxonomyVersion: nonEmptyString(
      source.taxonomyVersion,
      `${path}.taxonomyVersion`,
    ),
    conceptId: nonEmptyString(source.conceptId, `${path}.conceptId`),
  };
}

function parseVersions(value: unknown): EvaluatorVersionsV2 {
  const source = asRecord(value, 'versions');
  assertExactKeys(
    source,
    [
      'evaluatorSchema',
      'protocol',
      'prmTaxonomy',
      'rnmTaxonomy',
      'adherenceFramework',
      'barrierTaxonomy',
      'professionalActionTaxonomy',
      'pharmaceuticalInterventionTaxonomy',
      'referralDestinationTaxonomy',
    ],
    'versions',
  );
  const optionalVersion = (field: keyof EvaluatorVersionsV2) =>
    source[field] === undefined
      ? undefined
      : parseVersionRef(source[field], `versions.${field}`);
  const barrierTaxonomy = optionalVersion('barrierTaxonomy');
  const professionalActionTaxonomy = optionalVersion(
    'professionalActionTaxonomy',
  );
  const pharmaceuticalInterventionTaxonomy = optionalVersion(
    'pharmaceuticalInterventionTaxonomy',
  );
  const referralDestinationTaxonomy = optionalVersion(
    'referralDestinationTaxonomy',
  );
  return {
    evaluatorSchema: parseVersionRef(
      source.evaluatorSchema,
      'versions.evaluatorSchema',
    ),
    protocol: parseVersionRef(source.protocol, 'versions.protocol'),
    prmTaxonomy: parseVersionRef(
      source.prmTaxonomy,
      'versions.prmTaxonomy',
    ),
    rnmTaxonomy: parseVersionRef(
      source.rnmTaxonomy,
      'versions.rnmTaxonomy',
    ),
    adherenceFramework: parseVersionRef(
      source.adherenceFramework,
      'versions.adherenceFramework',
    ),
    ...(barrierTaxonomy === undefined
      ? {}
      : { barrierTaxonomy }),
    ...(professionalActionTaxonomy === undefined
      ? {}
      : { professionalActionTaxonomy }),
    ...(pharmaceuticalInterventionTaxonomy === undefined
      ? {}
      : { pharmaceuticalInterventionTaxonomy }),
    ...(referralDestinationTaxonomy === undefined
      ? {}
      : { referralDestinationTaxonomy }),
  };
}

function parseSpfaConclusion(value: unknown, path: string): SpfaConclusion {
  const source = asRecord(value, path);
  if (source.kind !== 'spfa') fail(`${path}.kind`, 'must be spfa');
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const service = controlledValue(
    conclusionValue.service,
    SPFA_SERVICES,
    `${path}.value.service`,
  ) as SpfaService;

  if (service === 'dispensing') {
    return {
      conclusionId: parseConclusionId(
        source.conclusionId,
        `${path}.conclusionId`,
      ),
      kind: 'spfa',
      value: {
        service,
        subtype: controlledValue(
          conclusionValue.subtype,
          ['initial_treatment', 'continuation'] as const,
          `${path}.value.subtype`,
        ),
      },
    };
  }

  if (conclusionValue.subtype !== undefined) {
    fail(`${path}.value.subtype`, 'is only valid for dispensing');
  }
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'spfa',
    value: { service },
  };
}

function parseSpfaTransition(value: unknown, path: string): SpfaTransition {
  const source = asRecord(value, path);
  if (source.kind !== 'spfa_transition') {
    fail(`${path}.kind`, 'must be spfa_transition');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'spfa_transition',
    value: {
      fromSpfaRef: parseConclusionId(
        conclusionValue.fromSpfaRef,
        `${path}.value.fromSpfaRef`,
      ),
      toSpfaRef: parseConclusionId(
        conclusionValue.toSpfaRef,
        `${path}.value.toSpfaRef`,
      ),
    },
  };
}

function parseCarePath(value: unknown): CarePathV2 {
  const source = asRecord(value, 'carePath');
  return {
    initialSpfa: parseSpfaConclusion(source.initialSpfa, 'carePath.initialSpfa'),
    additionalSpfas: asArray(
      source.additionalSpfas,
      'carePath.additionalSpfas',
    ).map((item, index) =>
      parseSpfaConclusion(item, `carePath.additionalSpfas[${index}]`),
    ),
    transitions: asArray(source.transitions, 'carePath.transitions').map(
      (item, index) =>
        parseSpfaTransition(item, `carePath.transitions[${index}]`),
    ),
  };
}

function parseAssessment<K extends 'incidence_assessment' | 'prm_assessment'>(
  value: unknown,
  kind: K,
  path: string,
): EvaluatorConclusion<K, { status: AssessmentStatus }> {
  const source = asRecord(value, path);
  if (source.kind !== kind) fail(`${path}.kind`, `must be ${kind}`);
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind,
    value: {
      status: controlledValue(
        conclusionValue.status,
        ASSESSMENT_STATUSES,
        `${path}.value.status`,
      ) as AssessmentStatus,
    },
  };
}

function parseMedicationRefs(value: unknown, path: string): MedicationId[] {
  return asArray(value, path).map((item, index) =>
    parseMedicationId(item, `${path}[${index}]`),
  );
}

function optionalConclusionId(
  value: unknown,
  path: string,
): ConclusionId | undefined {
  return value === undefined ? undefined : parseConclusionId(value, path);
}

function parseIncidenceFinding(
  value: unknown,
  path: string,
): IncidenceFinding {
  const source = asRecord(value, path);
  if (source.kind !== 'incidence') fail(`${path}.kind`, 'must be incidence');
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'incidence',
    value: {
      spfaRef: parseConclusionId(
        conclusionValue.spfaRef,
        `${path}.value.spfaRef`,
      ),
      medicationRefs: parseMedicationRefs(
        conclusionValue.medicationRefs,
        `${path}.value.medicationRefs`,
      ),
      semanticMeaning: nonEmptyString(
        conclusionValue.semanticMeaning,
        `${path}.value.semanticMeaning`,
      ),
    },
  };
}

function parseFollowUpEpisode(
  value: unknown,
  path: string,
): FollowUpEpisode {
  const source = asRecord(value, path);
  if (source.kind !== 'follow_up_episode') {
    fail(`${path}.kind`, 'must be follow_up_episode');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'follow_up_episode',
    value: {
      incidenceRef: parseConclusionId(
        conclusionValue.incidenceRef,
        `${path}.value.incidenceRef`,
      ),
    },
  };
}

function parsePrmFinding(value: unknown, path: string): PrmFinding {
  const source = asRecord(value, path);
  if (source.kind !== 'prm') fail(`${path}.kind`, 'must be prm');
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const followUpEpisodeRef = optionalConclusionId(
    conclusionValue.followUpEpisodeRef,
    `${path}.value.followUpEpisodeRef`,
  );
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'prm',
    value: {
      classification: parseTaxonomyTermRef(
        conclusionValue.classification,
        `${path}.value.classification`,
      ),
      medicationRefs: parseMedicationRefs(
        conclusionValue.medicationRefs,
        `${path}.value.medicationRefs`,
      ),
      ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
    },
  };
}

function parseRnmAssessment(value: unknown, path: string): RnmAssessment {
  const source = asRecord(value, path);
  if (source.kind !== 'rnm_assessment') {
    fail(`${path}.kind`, 'must be rnm_assessment');
  }
  const conclusionId = parseConclusionId(
    source.conclusionId,
    `${path}.conclusionId`,
  );
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const status = controlledValue(
    conclusionValue.status,
    ['rnm', 'risk_of_rnm', 'no_rnm'] as const,
    `${path}.value.status`,
  );
  if (status === 'no_rnm') {
    if (
      conclusionValue.classification !== undefined ||
      conclusionValue.followUpEpisodeRef !== undefined ||
      conclusionValue.medicationRefs !== undefined
    ) {
      fail(
        `${path}.value`,
        'no_rnm cannot include classification, episode or medication references',
      );
    }
    return {
      conclusionId,
      kind: 'rnm_assessment',
      value: { status },
    };
  }

  const medicationRefs = parseMedicationRefs(
    conclusionValue.medicationRefs,
    `${path}.value.medicationRefs`,
  );

  const followUpEpisodeRef = optionalConclusionId(
    conclusionValue.followUpEpisodeRef,
    `${path}.value.followUpEpisodeRef`,
  );
  if (status === 'rnm') {
    return {
      conclusionId,
      kind: 'rnm_assessment',
      value: {
        status,
        classification: parseTaxonomyTermRef(
          conclusionValue.classification,
          `${path}.value.classification`,
        ),
        medicationRefs,
        ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
      },
    };
  }

  const classification =
    conclusionValue.classification === undefined
      ? undefined
      : parseTaxonomyTermRef(
          conclusionValue.classification,
          `${path}.value.classification`,
        );
  return {
    conclusionId,
    kind: 'rnm_assessment',
    value: {
      status,
      ...(classification === undefined ? {} : { classification }),
      medicationRefs,
      ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
    },
  };
}

function parsePrmRnmRelation(value: unknown, path: string): PrmRnmRelation {
  const source = asRecord(value, path);
  if (source.kind !== 'prm_rnm_relation') {
    fail(`${path}.kind`, 'must be prm_rnm_relation');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'prm_rnm_relation',
    value: {
      prmRef: parseConclusionId(
        conclusionValue.prmRef,
        `${path}.value.prmRef`,
      ),
      rnmAssessmentRef: parseConclusionId(
        conclusionValue.rnmAssessmentRef,
        `${path}.value.rnmAssessmentRef`,
      ),
      relation: controlledValue(
        conclusionValue.relation,
        ['creates_risk_of_rnm', 'contributes_to_rnm'] as const,
        `${path}.value.relation`,
      ),
    },
  };
}

function parseOptionalTaxonomyTermRef(
  value: unknown,
  path: string,
): TaxonomyTermRef | undefined {
  return value === undefined ? undefined : parseTaxonomyTermRef(value, path);
}

function parseConclusionRefs(value: unknown, path: string): ConclusionId[] {
  return asArray(value, path).map((item, index) =>
    parseConclusionId(item, `${path}[${index}]`),
  );
}

function parseAdherenceAssessment(
  value: unknown,
  path: string,
): AdherenceAssessment {
  const source = asRecord(value, path);
  assertExactKeys(source, ['conclusionId', 'kind', 'value'], path);
  if (source.kind !== 'adherence_assessment') {
    fail(`${path}.kind`, 'must be adherence_assessment');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  assertExactKeys(conclusionValue, ['medicationRefs', 'status'], `${path}.value`);
  const medicationRefs = parseMedicationRefs(
    conclusionValue.medicationRefs,
    `${path}.value.medicationRefs`,
  ).sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
  if (medicationRefs.length === 0) {
    fail(`${path}.value.medicationRefs`, 'must contain at least one medication');
  }
  return {
    conclusionId: parseConclusionId(source.conclusionId, `${path}.conclusionId`),
    kind: 'adherence_assessment',
    value: {
      medicationRefs: medicationRefs as unknown as NonEmptyArray<MedicationId>,
      status: controlledValue(
        conclusionValue.status,
        ADHERENCE_STATUSES,
        `${path}.value.status`,
      ),
    },
  };
}

function parseNonAdherenceTypeConclusion(
  value: unknown,
  path: string,
): NonAdherenceTypeConclusion {
  const source = asRecord(value, path);
  assertExactKeys(source, ['conclusionId', 'kind', 'value'], path);
  if (source.kind !== 'non_adherence_type') {
    fail(`${path}.kind`, 'must be non_adherence_type');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const status = controlledValue(
    conclusionValue.status,
    ['determined', 'not_determinable'] as const,
    `${path}.value.status`,
  );
  const adherenceAssessmentRef = parseConclusionId(
    conclusionValue.adherenceAssessmentRef,
    `${path}.value.adherenceAssessmentRef`,
  );
  const conclusionId = parseConclusionId(
    source.conclusionId,
    `${path}.conclusionId`,
  );
  if (status === 'not_determinable') {
    assertExactKeys(
      conclusionValue,
      ['adherenceAssessmentRef', 'status'],
      `${path}.value`,
    );
    return {
      conclusionId,
      kind: 'non_adherence_type',
      value: { adherenceAssessmentRef, status },
    };
  }
  assertExactKeys(
    conclusionValue,
    ['adherenceAssessmentRef', 'status', 'type'],
    `${path}.value`,
  );
  return {
    conclusionId,
    kind: 'non_adherence_type',
    value: {
      adherenceAssessmentRef,
      status,
      type: controlledValue(
        conclusionValue.type,
        ['intentional', 'unintentional', 'erratic', 'combined'] as const,
        `${path}.value.type`,
      ),
    },
  };
}

function parseAdherencePatientProfile(
  value: unknown,
  path: string,
): AdherencePatientProfileConclusion {
  const source = asRecord(value, path);
  assertExactKeys(source, ['conclusionId', 'kind', 'value'], path);
  if (source.kind !== 'adherence_patient_profile') {
    fail(`${path}.kind`, 'must be adherence_patient_profile');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const status = controlledValue(
    conclusionValue.status,
    ['determined', 'not_determinable'] as const,
    `${path}.value.status`,
  );
  const adherenceAssessmentRef = parseConclusionId(
    conclusionValue.adherenceAssessmentRef,
    `${path}.value.adherenceAssessmentRef`,
  );
  const conclusionId = parseConclusionId(
    source.conclusionId,
    `${path}.conclusionId`,
  );
  if (status === 'not_determinable') {
    assertExactKeys(
      conclusionValue,
      ['adherenceAssessmentRef', 'status'],
      `${path}.value`,
    );
    return {
      conclusionId,
      kind: 'adherence_patient_profile',
      value: { adherenceAssessmentRef, status },
    };
  }
  assertExactKeys(
    conclusionValue,
    ['adherenceAssessmentRef', 'status', 'profile'],
    `${path}.value`,
  );
  return {
    conclusionId,
    kind: 'adherence_patient_profile',
    value: {
      adherenceAssessmentRef,
      status,
      profile: controlledValue(
        conclusionValue.profile,
        ['distrustful', 'trivializing', 'confused'] as const,
        `${path}.value.profile`,
      ),
    },
  };
}

function parseAdherenceBarrierAssessment(
  value: unknown,
  path: string,
): AdherenceBarrierAssessment {
  const source = asRecord(value, path);
  assertExactKeys(source, ['conclusionId', 'kind', 'value'], path);
  if (source.kind !== 'adherence_barrier_assessment') {
    fail(`${path}.kind`, 'must be adherence_barrier_assessment');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  assertExactKeys(
    conclusionValue,
    ['adherenceAssessmentRef', 'status'],
    `${path}.value`,
  );
  return {
    conclusionId: parseConclusionId(source.conclusionId, `${path}.conclusionId`),
    kind: 'adherence_barrier_assessment',
    value: {
      adherenceAssessmentRef: parseConclusionId(
        conclusionValue.adherenceAssessmentRef,
        `${path}.value.adherenceAssessmentRef`,
      ),
      status: controlledValue(
        conclusionValue.status,
        ['identified', 'not_determinable'] as const,
        `${path}.value.status`,
      ),
    },
  };
}

function parseAdherenceBarrier(
  value: unknown,
  path: string,
): AdherenceBarrier {
  const source = asRecord(value, path);
  assertExactKeys(source, ['conclusionId', 'kind', 'value'], path);
  if (source.kind !== 'adherence_barrier') {
    fail(`${path}.kind`, 'must be adherence_barrier');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  assertExactKeys(
    conclusionValue,
    ['barrierAssessmentRef', 'role', 'category', 'classification'],
    `${path}.value`,
  );
  const classification = parseOptionalTaxonomyTermRef(
    conclusionValue.classification,
    `${path}.value.classification`,
  );
  return {
    conclusionId: parseConclusionId(source.conclusionId, `${path}.conclusionId`),
    kind: 'adherence_barrier',
    value: {
      barrierAssessmentRef: parseConclusionId(
        conclusionValue.barrierAssessmentRef,
        `${path}.value.barrierAssessmentRef`,
      ),
      role: controlledValue(
        conclusionValue.role,
        ['primary', 'secondary'] as const,
        `${path}.value.role`,
      ),
      category: controlledValue(
        conclusionValue.category,
        ['practical', 'perception'] as const,
        `${path}.value.category`,
      ),
      ...(classification === undefined ? {} : { classification }),
    },
  };
}

function parseAdherenceStrategy(
  value: unknown,
  path: string,
): AdherenceStrategy {
  const source = asRecord(value, path);
  assertExactKeys(source, ['conclusionId', 'kind', 'value'], path);
  if (source.kind !== 'adherence_strategy') {
    fail(`${path}.kind`, 'must be adherence_strategy');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const category = controlledValue(
    conclusionValue.category,
    [...BASE_ADHERENCE_STRATEGIES, 'combined'] as const,
    `${path}.value.category`,
  );
  const base = {
    adherenceAssessmentRef: parseConclusionId(
      conclusionValue.adherenceAssessmentRef,
      `${path}.value.adherenceAssessmentRef`,
    ),
    addressedBarrierRefs: parseConclusionRefs(
      conclusionValue.addressedBarrierRefs,
      `${path}.value.addressedBarrierRefs`,
    ),
  };
  const conclusionId = parseConclusionId(
    source.conclusionId,
    `${path}.conclusionId`,
  );
  if (category !== 'combined') {
    assertExactKeys(
      conclusionValue,
      ['adherenceAssessmentRef', 'addressedBarrierRefs', 'category'],
      `${path}.value`,
    );
    return {
      conclusionId,
      kind: 'adherence_strategy',
      value: { ...base, category },
    };
  }
  assertExactKeys(
    conclusionValue,
    [
      'adherenceAssessmentRef',
      'addressedBarrierRefs',
      'category',
      'componentCategories',
    ],
    `${path}.value`,
  );
  const componentCategories = asArray(
    conclusionValue.componentCategories,
    `${path}.value.componentCategories`,
  ).map((item, index) =>
    controlledValue(
      item,
      BASE_ADHERENCE_STRATEGIES,
      `${path}.value.componentCategories[${index}]`,
    ),
  ) as BaseAdherenceStrategyCategory[];
  if (componentCategories.length < 2) {
    fail(`${path}.value.componentCategories`, 'must contain at least two categories');
  }
  if (new Set(componentCategories).size !== componentCategories.length) {
    fail(`${path}.value.componentCategories`, 'must contain distinct categories');
  }
  return {
    conclusionId,
    kind: 'adherence_strategy',
    value: {
      ...base,
      category,
      componentCategories:
        componentCategories as unknown as NonEmptyArray<BaseAdherenceStrategyCategory>,
    },
  };
}

function parseProfessionalAction(
  value: unknown,
  path: string,
): ProfessionalAction {
  const source = asRecord(value, path);
  assertExactKeys(source, ['conclusionId', 'kind', 'value'], path);
  if (source.kind !== 'professional_action') {
    fail(`${path}.kind`, 'must be professional_action');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const category = controlledValue(
    conclusionValue.category,
    PROFESSIONAL_ACTION_CATEGORIES,
    `${path}.value.category`,
  );
  const commonKeys = ['spfaRef', 'category', 'classification'] as const;
  const classification = parseOptionalTaxonomyTermRef(
    conclusionValue.classification,
    `${path}.value.classification`,
  );
  const base = {
    spfaRef: parseConclusionId(
      conclusionValue.spfaRef,
      `${path}.value.spfaRef`,
    ),
    category,
    ...(classification === undefined ? {} : { classification }),
  };
  const conclusionId = parseConclusionId(
    source.conclusionId,
    `${path}.conclusionId`,
  );
  if (category === 'referral') {
    assertExactKeys(
      conclusionValue,
      [...commonKeys, 'referralRef'],
      `${path}.value`,
    );
    return {
      conclusionId,
      kind: 'professional_action',
      value: {
        ...base,
        referralRef: parseConclusionId(
          conclusionValue.referralRef,
          `${path}.value.referralRef`,
        ),
      },
    };
  }
  if (category === 'other_spfa') {
    assertExactKeys(
      conclusionValue,
      [...commonKeys, 'targetSpfaRef'],
      `${path}.value`,
    );
    return {
      conclusionId,
      kind: 'professional_action',
      value: {
        ...base,
        targetSpfaRef: parseConclusionId(
          conclusionValue.targetSpfaRef,
          `${path}.value.targetSpfaRef`,
        ),
      },
    };
  }
  assertExactKeys(conclusionValue, commonKeys, `${path}.value`);
  return {
    conclusionId,
    kind: 'professional_action',
    value: base,
  };
}

function parsePharmaceuticalIntervention(
  value: unknown,
  path: string,
): PharmaceuticalIntervention {
  const source = asRecord(value, path);
  assertExactKeys(source, ['conclusionId', 'kind', 'value'], path);
  if (source.kind !== 'pharmaceutical_intervention') {
    fail(`${path}.kind`, 'must be pharmaceutical_intervention');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  assertExactKeys(
    conclusionValue,
    [
      'spfaRef',
      'professionalActionRef',
      'target',
      'classification',
      'addressedConclusionRefs',
      'referralRef',
    ],
    `${path}.value`,
  );
  const professionalActionRef = optionalConclusionId(
    conclusionValue.professionalActionRef,
    `${path}.value.professionalActionRef`,
  );
  const classification = parseOptionalTaxonomyTermRef(
    conclusionValue.classification,
    `${path}.value.classification`,
  );
  const referralRef = optionalConclusionId(
    conclusionValue.referralRef,
    `${path}.value.referralRef`,
  );
  const addressedConclusionRefs = parseConclusionRefs(
    conclusionValue.addressedConclusionRefs,
    `${path}.value.addressedConclusionRefs`,
  );
  if (addressedConclusionRefs.length === 0) {
    fail(`${path}.value.addressedConclusionRefs`, 'must not be empty');
  }
  return {
    conclusionId: parseConclusionId(source.conclusionId, `${path}.conclusionId`),
    kind: 'pharmaceutical_intervention',
    value: {
      spfaRef: parseConclusionId(
        conclusionValue.spfaRef,
        `${path}.value.spfaRef`,
      ),
      ...(professionalActionRef === undefined ? {} : { professionalActionRef }),
      target: controlledValue(
        conclusionValue.target,
        ['treatment', 'patient_state_or_situation', 'conditions_of_use'] as const,
        `${path}.value.target`,
      ),
      ...(classification === undefined ? {} : { classification }),
      addressedConclusionRefs:
        addressedConclusionRefs as unknown as NonEmptyArray<ConclusionId>,
      ...(referralRef === undefined ? {} : { referralRef }),
    },
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

function parseReferral(value: unknown, path: string): ReferralConclusion {
  const source = asRecord(value, path);
  assertExactKeys(source, ['conclusionId', 'kind', 'value'], path);
  if (source.kind !== 'referral') fail(`${path}.kind`, 'must be referral');
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const status = controlledValue(
    conclusionValue.status,
    ['not_required', 'required'] as const,
    `${path}.value.status`,
  );
  const conclusionId = parseConclusionId(
    source.conclusionId,
    `${path}.conclusionId`,
  );
  if (status === 'not_required') {
    assertExactKeys(conclusionValue, ['status'], `${path}.value`);
    return { conclusionId, kind: 'referral', value: { status } };
  }
  assertExactKeys(
    conclusionValue,
    ['status', 'urgency', 'destination', 'reason', 'report'],
    `${path}.value`,
  );
  const destination = asRecord(
    conclusionValue.destination,
    `${path}.value.destination`,
  );
  assertExactKeys(destination, ['label', 'classification'], `${path}.value.destination`);
  const classification = parseOptionalTaxonomyTermRef(
    destination.classification,
    `${path}.value.destination.classification`,
  );
  return {
    conclusionId,
    kind: 'referral',
    value: {
      status,
      urgency: controlledValue(
        conclusionValue.urgency,
        ['non_urgent', 'urgent'] as const,
        `${path}.value.urgency`,
      ),
      destination: {
        label: nonEmptyString(
          destination.label,
          `${path}.value.destination.label`,
        ),
        ...(classification === undefined ? {} : { classification }),
      },
      reason: nonEmptyString(conclusionValue.reason, `${path}.value.reason`),
      report: parseReportRequirement(
        conclusionValue.report,
        `${path}.value.report`,
      ),
    },
  };
}

function parseEvidenceLeaf(value: unknown, path: string): EvidenceLeafRef {
  const source = asRecord(value, path);
  if (source.operator === 'fact') {
    assertExactKeys(source, ['operator', 'factRef'], path);
    return {
      operator: 'fact',
      factRef: parseFactId(source.factRef, `${path}.factRef`),
    };
  }
  if (source.operator === 'public_profile') {
    assertExactKeys(source, ['operator', 'field'], path);
    return {
      operator: 'public_profile',
      field: controlledValue(
        source.field,
        ['age', 'sex'] as const,
        `${path}.field`,
      ),
    };
  }
  fail(`${path}.operator`, 'must be fact or public_profile');
}

function parseEvidenceExpression(
  value: unknown,
  path: string,
  depth = 0,
): EvidenceExpression {
  if (depth > 32) fail(path, 'evidence expression is too deeply nested');
  const source = asRecord(value, path);
  if (source.operator === 'fact' || source.operator === 'public_profile') {
    return parseEvidenceLeaf(source, path);
  }
  if (source.operator === 'all' || source.operator === 'any') {
    assertExactKeys(source, ['operator', 'operands'], path);
    const operands = asArray(source.operands, `${path}.operands`);
    if (operands.length === 0) {
      fail(`${path}.operands`, 'must contain at least one expression');
    }
    return {
      operator: source.operator,
      operands: operands.map((operand, index) =>
        parseEvidenceExpression(
          operand,
          `${path}.operands[${index}]`,
          depth + 1,
        ),
      ) as unknown as NonEmptyArray<EvidenceExpression>,
    };
  }
  fail(
    `${path}.operator`,
    'must be fact, public_profile, all or any',
  );
}

function parseEvidenceRule(value: unknown, index: number): EvidenceRule {
  const path = `evidenceRules[${index}]`;
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    [
      'conclusionRef',
      'requiredEvidence',
      'supportingEvidenceRefs',
      'counterEvidenceRefs',
      'teacherRationale',
    ],
    path,
  );
  return {
    conclusionRef: parseConclusionId(
      source.conclusionRef,
      `${path}.conclusionRef`,
    ),
    requiredEvidence: parseEvidenceExpression(
      source.requiredEvidence,
      `${path}.requiredEvidence`,
    ),
    supportingEvidenceRefs: asArray(
      source.supportingEvidenceRefs,
      `${path}.supportingEvidenceRefs`,
    ).map((item, leafIndex) =>
      parseEvidenceLeaf(item, `${path}.supportingEvidenceRefs[${leafIndex}]`),
    ),
    counterEvidenceRefs: asArray(
      source.counterEvidenceRefs,
      `${path}.counterEvidenceRefs`,
    ).map((item, leafIndex) =>
      parseEvidenceLeaf(item, `${path}.counterEvidenceRefs[${leafIndex}]`),
    ),
    teacherRationale: nonEmptyString(
      source.teacherRationale,
      `${path}.teacherRationale`,
    ),
  };
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

function collectRuntimeIndex(runtime: PatientRuntimeViewV2): {
  facts: Map<string, string>;
  medications: Set<string>;
} {
  const facts = new Map<string, string>();
  const medications = new Set<string>();

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.factId === 'string' && typeof record.state === 'string') {
      facts.set(record.factId, record.state);
    }
    if (typeof record.medicationId === 'string') {
      medications.add(record.medicationId);
    }
    Object.values(record).forEach(visit);
  };
  visit(runtime);
  return { facts, medications };
}

function evidenceKey(reference: EvidenceLeafRef): string {
  return reference.operator === 'fact'
    ? `fact:${reference.factRef}`
    : `public_profile:${reference.field}`;
}

function expressionLeaves(expression: EvidenceExpression): EvidenceLeafRef[] {
  return expression.operator === 'all' || expression.operator === 'any'
    ? expression.operands.flatMap(expressionLeaves)
    : [expression];
}

function validateCrossReferences(
  evaluator: EvaluatorViewV2,
  runtime: PatientRuntimeViewV2,
): void {
  if (evaluator.caseVersionId !== runtime.caseVersionId) {
    fail('caseVersionId', 'must match patient runtime caseVersionId');
  }

  const conclusions = conclusionEntries(evaluator);
  const conclusionById = new Map<string, AnyConclusion>();
  conclusions.forEach((conclusion) => {
    if (conclusionById.has(conclusion.conclusionId)) {
      fail(
        'conclusions',
        `duplicate conclusion ID: ${conclusion.conclusionId}`,
      );
    }
    conclusionById.set(conclusion.conclusionId, conclusion);
  });

  const requireKind = (
    reference: ConclusionId,
    kind: string,
    path: string,
  ): AnyConclusion => {
    const conclusion = conclusionById.get(reference);
    if (conclusion === undefined) {
      fail(path, `unknown conclusion reference: ${reference}`);
    }
    if (conclusion.kind !== kind) {
      fail(path, `must reference a conclusion of kind ${kind}`);
    }
    return conclusion;
  };

  evaluator.carePath.transitions.forEach((transition, index) => {
    const path = `carePath.transitions[${index}].value`;
    requireKind(transition.value.fromSpfaRef, 'spfa', `${path}.fromSpfaRef`);
    requireKind(transition.value.toSpfaRef, 'spfa', `${path}.toSpfaRef`);
    if (transition.value.fromSpfaRef === transition.value.toSpfaRef) {
      fail(path, 'transition endpoints must be different conclusions');
    }
  });

  const { facts, medications } = collectRuntimeIndex(runtime);
  const validateMedicationRefs = (
    references: readonly MedicationId[],
    path: string,
  ) => {
    references.forEach((reference, index) => {
      if (!medications.has(reference)) {
        fail(`${path}[${index}]`, `unknown medication reference: ${reference}`);
      }
    });
  };

  const incidenceStatus = evaluator.incidence.assessment.value.status;
  if (incidenceStatus === 'present' && evaluator.incidence.findings.length === 0) {
    fail('incidence.findings', 'present assessment requires findings');
  }
  if (incidenceStatus !== 'present' && evaluator.incidence.findings.length > 0) {
    fail('incidence.findings', `${incidenceStatus} assessment forbids findings`);
  }
  evaluator.incidence.findings.forEach((finding, index) => {
    requireKind(
      finding.value.spfaRef,
      'spfa',
      `incidence.findings[${index}].value.spfaRef`,
    );
    validateMedicationRefs(
      finding.value.medicationRefs,
      `incidence.findings[${index}].value.medicationRefs`,
    );
  });
  const incidencesWithEpisode = new Set<string>();
  evaluator.incidence.followUpEpisodes.forEach((episode, index) => {
    requireKind(
      episode.value.incidenceRef,
      'incidence',
      `incidence.followUpEpisodes[${index}].value.incidenceRef`,
    );
    incidencesWithEpisode.add(episode.value.incidenceRef);
  });
  evaluator.incidence.findings.forEach((finding, index) => {
    if (!incidencesWithEpisode.has(finding.conclusionId)) {
      fail(
        `incidence.findings[${index}]`,
        'present incidence requires a follow-up episode',
      );
    }
  });

  const prmStatus = evaluator.prm.assessment.value.status;
  if (prmStatus === 'present' && evaluator.prm.findings.length === 0) {
    fail('prm.findings', 'present assessment requires findings');
  }
  if (prmStatus !== 'present' && evaluator.prm.findings.length > 0) {
    fail('prm.findings', `${prmStatus} assessment forbids findings`);
  }
  evaluator.prm.findings.forEach((finding, index) => {
    const path = `prm.findings[${index}].value`;
    validateMedicationRefs(finding.value.medicationRefs, `${path}.medicationRefs`);
    if (finding.value.followUpEpisodeRef !== undefined) {
      requireKind(
        finding.value.followUpEpisodeRef,
        'follow_up_episode',
        `${path}.followUpEpisodeRef`,
      );
    }
    if (
      finding.value.classification.taxonomyId !==
        evaluator.versions.prmTaxonomy.id ||
      finding.value.classification.taxonomyVersion !==
        evaluator.versions.prmTaxonomy.version
    ) {
      fail(`${path}.classification`, 'must use the configured PRM taxonomy');
    }
  });

  if (evaluator.rnmAssessments.length === 0) {
    fail('rnmAssessments', 'must explicitly contain an RNM assessment');
  }
  const noRnmCount = evaluator.rnmAssessments.filter(
    (assessment) => assessment.value.status === 'no_rnm',
  ).length;
  if (noRnmCount > 0 && evaluator.rnmAssessments.length !== 1) {
    fail('rnmAssessments', 'no_rnm cannot coexist with RNM or risk findings');
  }
  evaluator.rnmAssessments.forEach((assessment, index) => {
    const path = `rnmAssessments[${index}].value`;
    if (assessment.value.status === 'no_rnm') return;
    validateMedicationRefs(
      assessment.value.medicationRefs,
      `${path}.medicationRefs`,
    );
    if (assessment.value.followUpEpisodeRef !== undefined) {
      requireKind(
        assessment.value.followUpEpisodeRef,
        'follow_up_episode',
        `${path}.followUpEpisodeRef`,
      );
    }
    if (
      assessment.value.classification !== undefined &&
      (assessment.value.classification.taxonomyId !==
        evaluator.versions.rnmTaxonomy.id ||
        assessment.value.classification.taxonomyVersion !==
          evaluator.versions.rnmTaxonomy.version)
    ) {
      fail(`${path}.classification`, 'must use the configured RNM taxonomy');
    }
  });

  const relatedPrmIds = new Set<string>();
  const risksWithIncomingRelation = new Set<string>();
  evaluator.prmRnmRelations.forEach((relation, index) => {
    const path = `prmRnmRelations[${index}].value`;
    requireKind(relation.value.prmRef, 'prm', `${path}.prmRef`);
    const rnm = requireKind(
      relation.value.rnmAssessmentRef,
      'rnm_assessment',
      `${path}.rnmAssessmentRef`,
    ) as RnmAssessment;
    if (
      relation.value.relation === 'creates_risk_of_rnm' &&
      rnm.value.status !== 'risk_of_rnm'
    ) {
      fail(`${path}.relation`, 'creates_risk_of_rnm must reference a risk');
    }
    if (
      relation.value.relation === 'contributes_to_rnm' &&
      rnm.value.status !== 'rnm'
    ) {
      fail(`${path}.relation`, 'contributes_to_rnm must reference an RNM');
    }
    relatedPrmIds.add(relation.value.prmRef);
    if (relation.value.relation === 'creates_risk_of_rnm') {
      risksWithIncomingRelation.add(relation.value.rnmAssessmentRef);
    }
  });
  evaluator.prm.findings.forEach((finding, index) => {
    if (!relatedPrmIds.has(finding.conclusionId)) {
      fail(
        `prm.findings[${index}]`,
        'PRM must participate in at least one PRM-RNM relation',
      );
    }
  });
  evaluator.rnmAssessments.forEach((assessment, index) => {
    if (
      assessment.value.status === 'risk_of_rnm' &&
      !risksWithIncomingRelation.has(assessment.conclusionId)
    ) {
      fail(
        `rnmAssessments[${index}]`,
        'risk_of_rnm requires an incoming creates_risk_of_rnm relation',
      );
    }
  });

  const validateOptionalClassification = (
    classification: TaxonomyTermRef | undefined,
    configuredVersion: VersionRef | undefined,
    path: string,
  ) => {
    if (classification === undefined) return;
    if (configuredVersion === undefined) {
      fail(path, 'classification requires its configured VersionRef');
    }
    if (
      classification.taxonomyId !== configuredVersion.id ||
      classification.taxonomyVersion !== configuredVersion.version
    ) {
      fail(path, 'classification must match its configured taxonomy version');
    }
  };

  const adherenceScopes: Array<{
    key: string;
    medications: Set<string>;
    path: string;
  }> = [];
  evaluator.adherence.assessments.forEach((assessment, index) => {
    const path = `adherence.assessments[${index}].value.medicationRefs`;
    validateMedicationRefs(assessment.value.medicationRefs, path);
    const medicationSet = new Set(assessment.value.medicationRefs);
    if (medicationSet.size !== assessment.value.medicationRefs.length) {
      fail(path, 'must not contain duplicate medication references');
    }
    const key = [...medicationSet].sort().join('|');
    for (const previous of adherenceScopes) {
      if (previous.key === key) {
        fail(path, 'duplicate adherence medication scope');
      }
      if ([...medicationSet].some((medication) => previous.medications.has(medication))) {
        fail(path, `adherence medication scope overlaps ${previous.path}`);
      }
    }
    adherenceScopes.push({ key, medications: medicationSet, path });
  });

  const requireAdherenceAssessment = (
    reference: ConclusionId,
    path: string,
  ): AdherenceAssessment =>
    requireKind(reference, 'adherence_assessment', path) as AdherenceAssessment;

  const typeCount = new Map<string, number>();
  evaluator.adherence.typeConclusions.forEach((conclusion, index) => {
    const path = `adherence.typeConclusions[${index}].value.adherenceAssessmentRef`;
    const assessment = requireAdherenceAssessment(
      conclusion.value.adherenceAssessmentRef,
      path,
    );
    if (assessment.value.status !== 'non_adherent') {
      fail(path, 'non-adherence type is only valid for non_adherent assessment');
    }
    typeCount.set(
      assessment.conclusionId,
      (typeCount.get(assessment.conclusionId) ?? 0) + 1,
    );
  });

  const profileCount = new Map<string, number>();
  evaluator.adherence.patientProfiles.forEach((profile, index) => {
    const path = `adherence.patientProfiles[${index}].value.adherenceAssessmentRef`;
    const assessment = requireAdherenceAssessment(
      profile.value.adherenceAssessmentRef,
      path,
    );
    if (assessment.value.status !== 'non_adherent') {
      fail(path, 'adherence profile is only valid for non_adherent assessment');
    }
    const count = (profileCount.get(assessment.conclusionId) ?? 0) + 1;
    if (count > 1) fail(path, 'only one adherence profile is allowed per assessment');
    profileCount.set(assessment.conclusionId, count);
  });

  const barrierAssessmentCount = new Map<string, number>();
  const barrierAssessmentById = new Map<string, AdherenceBarrierAssessment>();
  evaluator.adherence.barrierAssessments.forEach((barrierAssessment, index) => {
    const path =
      `adherence.barrierAssessments[${index}].value.adherenceAssessmentRef`;
    const assessment = requireAdherenceAssessment(
      barrierAssessment.value.adherenceAssessmentRef,
      path,
    );
    if (assessment.value.status !== 'non_adherent') {
      fail(path, 'barrier assessment is only valid for non_adherent assessment');
    }
    const count =
      (barrierAssessmentCount.get(assessment.conclusionId) ?? 0) + 1;
    if (count > 1) fail(path, 'only one barrier assessment is allowed');
    barrierAssessmentCount.set(assessment.conclusionId, count);
    barrierAssessmentById.set(barrierAssessment.conclusionId, barrierAssessment);
  });

  evaluator.adherence.assessments.forEach((assessment, index) => {
    const types = typeCount.get(assessment.conclusionId) ?? 0;
    const barrierAssessments =
      barrierAssessmentCount.get(assessment.conclusionId) ?? 0;
    if (assessment.value.status === 'non_adherent') {
      if (types !== 1) {
        fail(
          `adherence.assessments[${index}]`,
          'non_adherent assessment requires exactly one type conclusion',
        );
      }
      if (barrierAssessments !== 1) {
        fail(
          `adherence.assessments[${index}]`,
          'non_adherent assessment requires exactly one barrier assessment',
        );
      }
    } else if (types !== 0 || barrierAssessments !== 0) {
      fail(
        `adherence.assessments[${index}]`,
        `${assessment.value.status} forbids type and barrier assessments`,
      );
    }
  });

  const barriersByAssessment = new Map<string, AdherenceBarrier[]>();
  evaluator.adherence.barriers.forEach((barrier, index) => {
    const path = `adherence.barriers[${index}].value`;
    const barrierAssessment = requireKind(
      barrier.value.barrierAssessmentRef,
      'adherence_barrier_assessment',
      `${path}.barrierAssessmentRef`,
    ) as AdherenceBarrierAssessment;
    const values = barriersByAssessment.get(barrierAssessment.conclusionId) ?? [];
    values.push(barrier);
    barriersByAssessment.set(barrierAssessment.conclusionId, values);
    validateOptionalClassification(
      barrier.value.classification,
      evaluator.versions.barrierTaxonomy,
      `${path}.classification`,
    );
  });
  evaluator.adherence.barrierAssessments.forEach((assessment, index) => {
    const barriers = barriersByAssessment.get(assessment.conclusionId) ?? [];
    if (assessment.value.status === 'not_determinable' && barriers.length > 0) {
      fail(
        `adherence.barrierAssessments[${index}]`,
        'not_determinable barrier assessment forbids barriers',
      );
    }
    if (assessment.value.status === 'identified') {
      if (barriers.length === 0) {
        fail(
          `adherence.barrierAssessments[${index}]`,
          'identified barrier assessment requires barriers',
        );
      }
      const primaryCount = barriers.filter(
        (barrier) => barrier.value.role === 'primary',
      ).length;
      if (primaryCount !== 1) {
        fail(
          `adherence.barrierAssessments[${index}]`,
          'identified barriers require exactly one primary barrier',
        );
      }
    }
  });

  evaluator.adherence.strategies.forEach((strategy, index) => {
    const path = `adherence.strategies[${index}].value`;
    const assessment = requireAdherenceAssessment(
      strategy.value.adherenceAssessmentRef,
      `${path}.adherenceAssessmentRef`,
    );
    const seenBarrierRefs = new Set<string>();
    strategy.value.addressedBarrierRefs.forEach((reference, referenceIndex) => {
      if (seenBarrierRefs.has(reference)) {
        fail(`${path}.addressedBarrierRefs[${referenceIndex}]`, 'duplicate barrier reference');
      }
      seenBarrierRefs.add(reference);
      const barrier = requireKind(
        reference,
        'adherence_barrier',
        `${path}.addressedBarrierRefs[${referenceIndex}]`,
      ) as AdherenceBarrier;
      const barrierAssessment = barrierAssessmentById.get(
        barrier.value.barrierAssessmentRef,
      );
      if (
        barrierAssessment === undefined ||
        barrierAssessment.value.adherenceAssessmentRef !== assessment.conclusionId
      ) {
        fail(
          `${path}.addressedBarrierRefs[${referenceIndex}]`,
          'barrier belongs to a different adherence assessment',
        );
      }
    });
    const barrierAssessment = evaluator.adherence.barrierAssessments.find(
      (candidate) =>
        candidate.value.adherenceAssessmentRef === assessment.conclusionId,
    );
    if (
      barrierAssessment?.value.status === 'not_determinable' &&
      strategy.value.addressedBarrierRefs.length > 0
    ) {
      fail(path, 'strategy cannot address barriers when they are not determinable');
    }
  });

  const requireRequiredReferral = (reference: ConclusionId, path: string) => {
    const referral = requireKind(reference, 'referral', path) as ReferralConclusion;
    if (
      referral.conclusionId !== evaluator.referral.conclusionId ||
      referral.value.status !== 'required'
    ) {
      fail(path, 'must reference the required evaluator referral');
    }
  };

  evaluator.professionalActions.forEach((action, index) => {
    const path = `professionalActions[${index}].value`;
    requireKind(action.value.spfaRef, 'spfa', `${path}.spfaRef`);
    validateOptionalClassification(
      action.value.classification,
      evaluator.versions.professionalActionTaxonomy,
      `${path}.classification`,
    );
    if (action.value.category === 'referral') {
      requireRequiredReferral(action.value.referralRef!, `${path}.referralRef`);
    }
    if (action.value.category === 'other_spfa') {
      requireKind(action.value.targetSpfaRef!, 'spfa', `${path}.targetSpfaRef`);
      if (action.value.spfaRef === action.value.targetSpfaRef) {
        fail(path, 'other_spfa origin and destination must differ');
      }
      const matchingTransition = evaluator.carePath.transitions.some(
        (transition) =>
          transition.value.fromSpfaRef === action.value.spfaRef &&
          transition.value.toSpfaRef === action.value.targetSpfaRef,
      );
      if (!matchingTransition) {
        fail(path, 'other_spfa requires a matching SPFA transition');
      }
    }
  });

  const allowedInterventionTargets = new Set([
    'incidence',
    'prm',
    'rnm_assessment',
    'adherence_assessment',
    'non_adherence_type',
    'adherence_barrier',
  ]);
  evaluator.pharmaceuticalInterventions.forEach((intervention, index) => {
    const path = `pharmaceuticalInterventions[${index}].value`;
    requireKind(intervention.value.spfaRef, 'spfa', `${path}.spfaRef`);
    if (intervention.value.professionalActionRef !== undefined) {
      const action = requireKind(
        intervention.value.professionalActionRef,
        'professional_action',
        `${path}.professionalActionRef`,
      ) as ProfessionalAction;
      if (action.value.spfaRef !== intervention.value.spfaRef) {
        fail(`${path}.professionalActionRef`, 'action belongs to a different SPFA');
      }
    }
    validateOptionalClassification(
      intervention.value.classification,
      evaluator.versions.pharmaceuticalInterventionTaxonomy,
      `${path}.classification`,
    );
    const seenAddressedRefs = new Set<string>();
    const adherenceScopeRefs = new Set<string>();
    intervention.value.addressedConclusionRefs.forEach((reference, refIndex) => {
      const referencePath = `${path}.addressedConclusionRefs[${refIndex}]`;
      if (seenAddressedRefs.has(reference)) {
        fail(referencePath, 'duplicate addressed conclusion reference');
      }
      seenAddressedRefs.add(reference);
      const conclusion = conclusionById.get(reference);
      if (conclusion === undefined) {
        fail(referencePath, `unknown conclusion reference: ${reference}`);
      }
      if (!allowedInterventionTargets.has(conclusion.kind)) {
        fail(referencePath, `conclusion kind ${conclusion.kind} cannot be addressed`);
      }
      if (
        conclusion.kind === 'rnm_assessment' &&
        (conclusion as RnmAssessment).value.status === 'no_rnm'
      ) {
        fail(referencePath, 'no_rnm cannot be addressed by an intervention');
      }
      if (conclusion.kind === 'adherence_assessment') {
        adherenceScopeRefs.add(conclusion.conclusionId);
      }
      if (conclusion.kind === 'non_adherence_type') {
        adherenceScopeRefs.add(
          (conclusion as NonAdherenceTypeConclusion).value
            .adherenceAssessmentRef,
        );
      }
      if (conclusion.kind === 'adherence_barrier') {
        const barrier = conclusion as AdherenceBarrier;
        const barrierAssessment = barrierAssessmentById.get(
          barrier.value.barrierAssessmentRef,
        );
        if (barrierAssessment === undefined) {
          fail(referencePath, 'barrier assessment reference is invalid');
        }
        adherenceScopeRefs.add(
          barrierAssessment.value.adherenceAssessmentRef,
        );
      }
    });
    if (adherenceScopeRefs.size > 1) {
      fail(path, 'intervention mixes different adherence medication scopes');
    }
    if (intervention.value.referralRef !== undefined) {
      requireRequiredReferral(
        intervention.value.referralRef,
        `${path}.referralRef`,
      );
    }
  });

  if (evaluator.referral.value.status === 'required') {
    validateOptionalClassification(
      evaluator.referral.value.destination.classification,
      evaluator.versions.referralDestinationTaxonomy,
      'referral.value.destination.classification',
    );
  }

  const validateEvidenceLeaf = (leaf: EvidenceLeafRef, path: string) => {
    if (leaf.operator === 'fact' && !facts.has(leaf.factRef)) {
      fail(path, `unknown fact reference: ${leaf.factRef}`);
    }
  };
  const rulesByConclusion = new Map<string, EvidenceRule>();
  evaluator.evidenceRules.forEach((rule, index) => {
    const path = `evidenceRules[${index}]`;
    const conclusion = conclusionById.get(rule.conclusionRef);
    if (conclusion === undefined) {
      fail(`${path}.conclusionRef`, 'unknown conclusion reference');
    }
    if (rulesByConclusion.has(rule.conclusionRef)) {
      fail(`${path}.conclusionRef`, 'duplicate EvidenceRule for conclusion');
    }
    if (!EVIDENCE_RULE_KINDS.has(conclusion.kind)) {
      fail(
        `${path}.conclusionRef`,
        `conclusion kind ${conclusion.kind} does not accept EvidenceRule`,
      );
    }
    rulesByConclusion.set(rule.conclusionRef, rule);

    const requiredLeaves = expressionLeaves(rule.requiredEvidence);
    requiredLeaves.forEach((leaf, leafIndex) =>
      validateEvidenceLeaf(leaf, `${path}.requiredEvidence.leaf[${leafIndex}]`),
    );

    const validateFlatList = (
      references: readonly EvidenceLeafRef[],
      field: 'supportingEvidenceRefs' | 'counterEvidenceRefs',
    ) => {
      const keys = new Set<string>();
      references.forEach((leaf, leafIndex) => {
        validateEvidenceLeaf(leaf, `${path}.${field}[${leafIndex}]`);
        const key = evidenceKey(leaf);
        if (keys.has(key)) {
          fail(`${path}.${field}[${leafIndex}]`, `duplicate evidence: ${key}`);
        }
        keys.add(key);
      });
      return keys;
    };
    const supportingKeys = validateFlatList(
      rule.supportingEvidenceRefs,
      'supportingEvidenceRefs',
    );
    const counterKeys = validateFlatList(
      rule.counterEvidenceRefs,
      'counterEvidenceRefs',
    );
    supportingKeys.forEach((key) => {
      if (counterKeys.has(key)) {
        fail(path, `evidence cannot be both supporting and counter: ${key}`);
      }
    });

  });

  conclusions.forEach((conclusion) => {
    if (
      EVIDENCE_RULE_KINDS.has(conclusion.kind) &&
      !rulesByConclusion.has(conclusion.conclusionId)
    ) {
      fail(
        'evidenceRules',
        `missing EvidenceRule for conclusion: ${conclusion.conclusionId}`,
      );
    }
  });
}

export type PatientUnknownOnlyEvidenceFlag = {
  conclusionRef: ConclusionId;
  code: 'ONLY_PATIENT_UNKNOWN_REQUIRED_EVIDENCE';
};

export function findPatientUnknownOnlyEvidenceFlags(
  evaluator: EvaluatorViewV2,
  runtime: PatientRuntimeViewV2,
): PatientUnknownOnlyEvidenceFlag[] {
  const { facts } = collectRuntimeIndex(runtime);
  return evaluator.evidenceRules.flatMap((rule) => {
    const leaves = expressionLeaves(rule.requiredEvidence);
    const onlyPatientUnknown = leaves.every(
      (leaf) =>
        leaf.operator === 'fact' &&
        facts.get(leaf.factRef) === 'patient_unknown',
    );
    return onlyPatientUnknown
      ? [
          {
            conclusionRef: rule.conclusionRef,
            code: 'ONLY_PATIENT_UNKNOWN_REQUIRED_EVIDENCE' as const,
          },
        ]
      : [];
  });
}

export function validateEvaluatorViewV2(
  input: unknown,
  runtime: PatientRuntimeViewV2,
): EvaluatorViewV2 {
  const source = asRecord(input, 'evaluatorView');
  if (source.schemaVersion !== '2.0') {
    fail('schemaVersion', 'must be 2.0');
  }
  const incidenceSource = asRecord(source.incidence, 'incidence');
  const prmSource = asRecord(source.prm, 'prm');
  const adherenceSource = asRecord(source.adherence, 'adherence');
  assertExactKeys(
    adherenceSource,
    [
      'assessments',
      'typeConclusions',
      'patientProfiles',
      'barrierAssessments',
      'barriers',
      'strategies',
    ],
    'adherence',
  );

  const evaluator: EvaluatorViewV2 = {
    schemaVersion: '2.0',
    caseVersionId: validateCaseVersionId(source.caseVersionId),
    versions: parseVersions(source.versions),
    carePath: parseCarePath(source.carePath),
    incidence: {
      assessment: parseAssessment(
        incidenceSource.assessment,
        'incidence_assessment',
        'incidence.assessment',
      ) as IncidenceAssessment,
      findings: asArray(incidenceSource.findings, 'incidence.findings').map(
        (item, index) =>
          parseIncidenceFinding(item, `incidence.findings[${index}]`),
      ),
      followUpEpisodes: asArray(
        incidenceSource.followUpEpisodes,
        'incidence.followUpEpisodes',
      ).map((item, index) =>
        parseFollowUpEpisode(item, `incidence.followUpEpisodes[${index}]`),
      ),
    },
    prm: {
      assessment: parseAssessment(
        prmSource.assessment,
        'prm_assessment',
        'prm.assessment',
      ) as PrmAssessment,
      findings: asArray(prmSource.findings, 'prm.findings').map((item, index) =>
        parsePrmFinding(item, `prm.findings[${index}]`),
      ),
    },
    rnmAssessments: asArray(source.rnmAssessments, 'rnmAssessments').map(
      (item, index) => parseRnmAssessment(item, `rnmAssessments[${index}]`),
    ),
    prmRnmRelations: asArray(
      source.prmRnmRelations,
      'prmRnmRelations',
    ).map((item, index) =>
      parsePrmRnmRelation(item, `prmRnmRelations[${index}]`),
    ),
    adherence: {
      assessments: asArray(
        adherenceSource.assessments,
        'adherence.assessments',
      ).map((item, index) =>
        parseAdherenceAssessment(item, `adherence.assessments[${index}]`),
      ),
      typeConclusions: asArray(
        adherenceSource.typeConclusions,
        'adherence.typeConclusions',
      ).map((item, index) =>
        parseNonAdherenceTypeConclusion(
          item,
          `adherence.typeConclusions[${index}]`,
        ),
      ),
      patientProfiles: asArray(
        adherenceSource.patientProfiles,
        'adherence.patientProfiles',
      ).map((item, index) =>
        parseAdherencePatientProfile(
          item,
          `adherence.patientProfiles[${index}]`,
        ),
      ),
      barrierAssessments: asArray(
        adherenceSource.barrierAssessments,
        'adherence.barrierAssessments',
      ).map((item, index) =>
        parseAdherenceBarrierAssessment(
          item,
          `adherence.barrierAssessments[${index}]`,
        ),
      ),
      barriers: asArray(
        adherenceSource.barriers,
        'adherence.barriers',
      ).map((item, index) =>
        parseAdherenceBarrier(item, `adherence.barriers[${index}]`),
      ),
      strategies: asArray(
        adherenceSource.strategies,
        'adherence.strategies',
      ).map((item, index) =>
        parseAdherenceStrategy(item, `adherence.strategies[${index}]`),
      ),
    },
    professionalActions: asArray(
      source.professionalActions,
      'professionalActions',
    ).map((item, index) =>
      parseProfessionalAction(item, `professionalActions[${index}]`),
    ),
    pharmaceuticalInterventions: asArray(
      source.pharmaceuticalInterventions,
      'pharmaceuticalInterventions',
    ).map((item, index) =>
      parsePharmaceuticalIntervention(
        item,
        `pharmaceuticalInterventions[${index}]`,
      ),
    ),
    referral: parseReferral(source.referral, 'referral'),
    evidenceRules: asArray(source.evidenceRules, 'evidenceRules').map(
      parseEvidenceRule,
    ),
  };

  validateCrossReferences(evaluator, runtime);
  return evaluator;
}
