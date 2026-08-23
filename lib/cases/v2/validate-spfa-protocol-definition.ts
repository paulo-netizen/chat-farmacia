import type {
  DispensingSubtype,
  NonEmptyArray,
  SpfaService,
} from './evaluator-types';
import type {
  ApplicableRequirementImportance,
  SpfaActionDomain,
  SpfaActionRequirementDefinitionV2,
  SpfaApplicabilityPolicyId,
  SpfaInformationDomain,
  SpfaInformationRequirementDefinitionV2,
  SpfaProtocolDefinitionV2,
  SpfaProtocolId,
  SpfaProtocolRefV2,
  SpfaProtocolRequirementDefinitionV2,
  SpfaProtocolRequirementId,
  SpfaRequirementApplicabilityDefinitionV2,
  SpfaSafetyCriticalityV2,
} from './spfa-protocol-types';
import type { DisclosureDomain } from './types';

const UUID_BODY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SPFA_SERVICES = [
  'dispensing',
  'pharmaceutical_indication',
  'medication_adherence',
] as const satisfies readonly SpfaService[];

const DISPENSING_SUBTYPES = [
  'initial_treatment',
  'continuation',
] as const satisfies readonly DispensingSubtype[];

const APPLICABLE_IMPORTANCES = [
  'CRITICAL',
  'RELEVANT',
  'OPTIONAL',
] as const satisfies readonly ApplicableRequirementImportance[];

const DISCLOSURE_DOMAINS = [
  'initial_demand',
  'patient_identity',
  'caregiver_context',
  'health_problems',
  'clinical_history',
  'physiological_status',
  'pregnancy_lactation',
  'allergies_intolerances',
  'symptoms',
  'symptom_timing_and_evolution',
  'prior_actions',
  'medication_identity',
  'medication_purpose',
  'prescribed_medication_use',
  'actual_medication_use',
  'administration_technique',
  'special_use_conditions',
  'medication_changes',
  'perceived_effectiveness',
  'perceived_safety',
  'practical_difficulties',
  'beliefs_and_concerns',
  'strategies_already_tried',
  'lifestyle',
  'daily_context',
  'social_support',
  'professional_relationship',
  'biomedical_data',
] as const satisfies readonly DisclosureDomain[];

const PROTOCOL_INFORMATION_DOMAINS = [
  'service_context',
  'dispensing_subtype',
  'referral_criteria',
  'pharmacy_intervention_possibility',
  'additional_spfa_need',
] as const;

const ACTION_DOMAINS = [
  'safe_professional_action',
  'referral_action',
  'report_action',
  'care_path_transition',
] as const satisfies readonly SpfaActionDomain[];

export class SpfaProtocolDefinitionValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaProtocolDefinitionValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new SpfaProtocolDefinitionValidationError(path, message);
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

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
  return value;
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
  prefix: 'spfa_protocol' | 'spfa_requirement' | 'spfa_policy',
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

export function validateSpfaProtocolIdV2(
  value: unknown,
  path = 'protocolId',
): SpfaProtocolId {
  return opaqueId<SpfaProtocolId>(value, 'spfa_protocol', path);
}

export function validateSpfaProtocolRequirementIdV2(
  value: unknown,
  path = 'requirementId',
): SpfaProtocolRequirementId {
  return opaqueId<SpfaProtocolRequirementId>(
    value,
    'spfa_requirement',
    path,
  );
}

export function validateSpfaApplicabilityPolicyIdV2(
  value: unknown,
  path = 'policyRef',
): SpfaApplicabilityPolicyId {
  return opaqueId<SpfaApplicabilityPolicyId>(value, 'spfa_policy', path);
}

export function validateSpfaProtocolRefV2(
  value: unknown,
  path = 'protocolRef',
): SpfaProtocolRefV2 {
  const source = asRecord(value, path);
  assertExactKeys(source, ['protocolId', 'version'], path);
  return {
    protocolId: validateSpfaProtocolIdV2(
      source.protocolId,
      `${path}.protocolId`,
    ),
    version: nonEmptyString(source.version, `${path}.version`),
  };
}

function parseInformationDomain(
  value: unknown,
  path: string,
): SpfaInformationDomain {
  const source = asRecord(value, path);
  const kind = controlledValue(
    source.kind,
    ['patient_information', 'protocol_information'] as const,
    `${path}.kind`,
  );

  if (kind === 'patient_information') {
    assertExactKeys(source, ['kind', 'disclosureDomain'], path);
    return {
      kind,
      disclosureDomain: controlledValue(
        source.disclosureDomain,
        DISCLOSURE_DOMAINS,
        `${path}.disclosureDomain`,
      ),
    };
  }

  assertExactKeys(source, ['kind', 'domain'], path);
  return {
    kind,
    domain: controlledValue(
      source.domain,
      PROTOCOL_INFORMATION_DOMAINS,
      `${path}.domain`,
    ),
  };
}

function parseSafetyCriticality(
  value: unknown,
  path: string,
): SpfaSafetyCriticalityV2 {
  const source = asRecord(value, path);
  assertExactKeys(source, ['safetyCritical'], path);
  if (typeof source.safetyCritical !== 'boolean') {
    fail(`${path}.safetyCritical`, 'must be a boolean');
  }
  return { safetyCritical: source.safetyCritical };
}

function parseApplicability(
  value: unknown,
  path: string,
  service: SpfaService,
  protocolSubtype: DispensingSubtype | undefined,
): SpfaRequirementApplicabilityDefinitionV2 {
  const source = asRecord(value, path);
  const kind = controlledValue(
    source.kind,
    ['ALWAYS', 'DISPENSING_SUBTYPE', 'CASE_DETERMINED'] as const,
    `${path}.kind`,
  );

  if (kind === 'ALWAYS') {
    assertExactKeys(source, ['kind'], path);
    return { kind };
  }

  if (kind === 'CASE_DETERMINED') {
    assertExactKeys(source, ['kind', 'policyRef'], path);
    return {
      kind,
      policyRef: validateSpfaApplicabilityPolicyIdV2(
        source.policyRef,
        `${path}.policyRef`,
      ),
    };
  }

  assertExactKeys(source, ['kind', 'subtypes'], path);
  if (service !== 'dispensing') {
    fail(`${path}.kind`, 'is only valid for dispensing protocols');
  }
  if (protocolSubtype !== undefined) {
    fail(
      `${path}.kind`,
      'is not allowed when the dispensing protocol already fixes subtype',
    );
  }

  const rawSubtypes = asArray(source.subtypes, `${path}.subtypes`);
  if (rawSubtypes.length === 0) {
    fail(`${path}.subtypes`, 'must not be empty');
  }
  const subtypes = rawSubtypes.map((item, index) =>
    controlledValue(
      item,
      DISPENSING_SUBTYPES,
      `${path}.subtypes[${index}]`,
    ),
  );
  if (new Set(subtypes).size !== subtypes.length) {
    fail(`${path}.subtypes`, 'must not contain duplicates');
  }
  return {
    kind,
    subtypes: subtypes as unknown as NonEmptyArray<DispensingSubtype>,
  };
}

function parseCommonRequirementFields(
  source: Record<string, unknown>,
  path: string,
  service: SpfaService,
  protocolSubtype: DispensingSubtype | undefined,
) {
  return {
    requirementId: validateSpfaProtocolRequirementIdV2(
      source.requirementId,
      `${path}.requirementId`,
    ),
    teacherLabel: nonEmptyString(source.teacherLabel, `${path}.teacherLabel`),
    description: nonEmptyString(source.description, `${path}.description`),
    defaultImportance: controlledValue(
      source.defaultImportance,
      APPLICABLE_IMPORTANCES,
      `${path}.defaultImportance`,
    ),
    safetyCriticality: parseSafetyCriticality(
      source.safetyCriticality,
      `${path}.safetyCriticality`,
    ),
    applicability: parseApplicability(
      source.applicability,
      `${path}.applicability`,
      service,
      protocolSubtype,
    ),
  };
}

function parseRequirement(
  value: unknown,
  path: string,
  service: SpfaService,
  protocolSubtype: DispensingSubtype | undefined,
): SpfaProtocolRequirementDefinitionV2 {
  const source = asRecord(value, path);
  const kind = controlledValue(
    source.kind,
    ['INFORMATION_REQUIREMENT', 'ACTION_REQUIREMENT'] as const,
    `${path}.kind`,
  );

  const commonKeys = [
    'kind',
    'requirementId',
    'semanticDomain',
    'teacherLabel',
    'description',
    'defaultImportance',
    'safetyCriticality',
    'applicability',
  ] as const;
  const common = parseCommonRequirementFields(
    source,
    path,
    service,
    protocolSubtype,
  );

  if (kind === 'INFORMATION_REQUIREMENT') {
    assertExactKeys(source, [...commonKeys, 'informationGoal'], path);
    const result: SpfaInformationRequirementDefinitionV2 = {
      kind,
      requirementId: common.requirementId,
      semanticDomain: parseInformationDomain(
        source.semanticDomain,
        `${path}.semanticDomain`,
      ),
      teacherLabel: common.teacherLabel,
      description: common.description,
      defaultImportance: common.defaultImportance,
      informationGoal: nonEmptyString(
        source.informationGoal,
        `${path}.informationGoal`,
      ),
      safetyCriticality: common.safetyCriticality,
      applicability: common.applicability,
    };
    return result;
  }

  assertExactKeys(source, [...commonKeys, 'actionGoal'], path);
  const result: SpfaActionRequirementDefinitionV2 = {
    kind,
    requirementId: common.requirementId,
    semanticDomain: controlledValue(
      source.semanticDomain,
      ACTION_DOMAINS,
      `${path}.semanticDomain`,
    ),
    teacherLabel: common.teacherLabel,
    description: common.description,
    defaultImportance: common.defaultImportance,
    actionGoal: nonEmptyString(source.actionGoal, `${path}.actionGoal`),
    safetyCriticality: common.safetyCriticality,
    applicability: common.applicability,
  };
  return result;
}

export function validateSpfaProtocolDefinitionV2(
  value: unknown,
): SpfaProtocolDefinitionV2 {
  const rootPath = 'spfaProtocolDefinition';
  const source = asRecord(value, rootPath);
  assertExactKeys(
    source,
    [
      'schemaVersion',
      'protocolId',
      'version',
      'service',
      'subtype',
      'requirements',
    ],
    rootPath,
  );
  if (source.schemaVersion !== '2.0') {
    fail(`${rootPath}.schemaVersion`, 'must be 2.0');
  }

  const service = controlledValue(
    source.service,
    SPFA_SERVICES,
    `${rootPath}.service`,
  );
  let subtype: DispensingSubtype | undefined;
  if (source.subtype !== undefined) {
    if (service !== 'dispensing') {
      fail(`${rootPath}.subtype`, 'is only valid for dispensing protocols');
    }
    subtype = controlledValue(
      source.subtype,
      DISPENSING_SUBTYPES,
      `${rootPath}.subtype`,
    );
  }

  const rawRequirements = asArray(
    source.requirements,
    `${rootPath}.requirements`,
  );
  if (rawRequirements.length === 0) {
    fail(`${rootPath}.requirements`, 'must not be empty');
  }
  const requirements = rawRequirements.map((item, index) =>
    parseRequirement(
      item,
      `${rootPath}.requirements[${index}]`,
      service,
      subtype,
    ),
  );
  const seenRequirementIds = new Set<string>();
  requirements.forEach((requirement, index) => {
    if (seenRequirementIds.has(requirement.requirementId)) {
      fail(
        `${rootPath}.requirements[${index}].requirementId`,
        'must be unique within the protocol',
      );
    }
    seenRequirementIds.add(requirement.requirementId);
  });

  const result: SpfaProtocolDefinitionV2 = {
    schemaVersion: '2.0',
    protocolId: validateSpfaProtocolIdV2(
      source.protocolId,
      `${rootPath}.protocolId`,
    ),
    version: nonEmptyString(source.version, `${rootPath}.version`),
    service,
    ...(subtype === undefined ? {} : { subtype }),
    requirements: requirements as unknown as NonEmptyArray<SpfaProtocolRequirementDefinitionV2>,
  };
  return result;
}
