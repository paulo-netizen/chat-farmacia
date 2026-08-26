import type { ConclusionId, VersionRef } from './evaluator-types';
import type {
  AppliedRequirementApplicabilityV2,
  SpfaRequirementTargetId,
} from './spfa-protocol-application-types';
import type {
  SpfaScoringContextV2,
  SpfaScoringRequirementContextV2,
  SpfaScoringRequirementKindV2,
  SpfaScoringRequirementResultStatusV2,
} from './spfa-scoring-context-types';
import type {
  ApplicableRequirementImportance,
  SpfaProtocolRequirementId,
  SpfaSafetyCriticalityV2,
} from './spfa-protocol-types';
import type { SessionTranscriptFingerprintV2 } from './spfa-session-evidence-types';
import type { CaseVersionId } from './types';
import { validateSpfaRequirementTargetIdV2 } from './validate-spfa-protocol-application';
import {
  validateSpfaApplicabilityPolicyIdV2,
  validateSpfaProtocolRefV2,
  validateSpfaProtocolRequirementIdV2,
} from './validate-spfa-protocol-definition';
import { validateCaseVersionId } from './validate-patient-facts';

const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CONCLUSION_ID_PATTERN =
  /^conclusion_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const IMPORTANCES = ['CRITICAL', 'RELEVANT', 'OPTIONAL'] as const;
const KINDS = ['INFORMATION_REQUIREMENT', 'ACTION_REQUIREMENT'] as const;
const STATUSES = [
  'COVERED',
  'PARTIALLY_COVERED',
  'NOT_COVERED',
  'PERFORMED',
  'PARTIALLY_PERFORMED',
  'NOT_PERFORMED',
  'NOT_APPLICABLE',
] as const;

export class SpfaScoringContextValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'SpfaScoringContextValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new SpfaScoringContextValidationError(path, message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function exactKeys(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[],
  path: string,
): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(`${path}.${key}`, 'missing required property');
    }
  }
}

function controlled<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(path, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T[number];
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(path, 'must be a non-empty, unpadded string');
  }
  return value;
}

function parseSessionId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !SESSION_UUID_PATTERN.test(value)) {
    fail(path, 'must be a canonical lowercase UUID');
  }
  return value;
}

function parseCaseVersionId(value: unknown, path: string): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch {
    fail(path, 'invalid case version ID');
  }
}

function parseConclusionId(value: unknown, path: string): ConclusionId {
  if (typeof value !== 'string' || !CONCLUSION_ID_PATTERN.test(value)) {
    fail(path, 'must use the opaque format conclusion_<uuid>');
  }
  return value as ConclusionId;
}

function parseVersionRef(value: unknown, path: string): Readonly<VersionRef> {
  const source = record(value, path);
  exactKeys(source, ['id', 'version'], [], path);
  return {
    id: nonEmptyString(source.id, `${path}.id`),
    version: nonEmptyString(source.version, `${path}.version`),
  };
}

function parseFingerprint(
  value: unknown,
  path: string,
): SessionTranscriptFingerprintV2 {
  const source = record(value, path);
  exactKeys(source, ['algorithm', 'canonicalization', 'value'], [], path);
  if (source.algorithm !== 'sha256') fail(`${path}.algorithm`, 'must be sha256');
  if (source.canonicalization !== 'session-transcript-v2/1') {
    fail(`${path}.canonicalization`, 'must be session-transcript-v2/1');
  }
  if (typeof source.value !== 'string' || !SHA256_PATTERN.test(source.value)) {
    fail(`${path}.value`, 'must be a lowercase SHA-256 digest');
  }
  return {
    algorithm: 'sha256',
    canonicalization: 'session-transcript-v2/1',
    value: source.value,
  };
}

function parseApplicability(
  value: unknown,
  path: string,
): AppliedRequirementApplicabilityV2 {
  const source = record(value, path);
  const status = controlled(
    source.status,
    ['APPLICABLE', 'NOT_APPLICABLE'] as const,
    `${path}.status`,
  );
  if (status === 'APPLICABLE') {
    exactKeys(source, ['status', 'effectiveImportance'], [], path);
    return {
      status,
      effectiveImportance: controlled(
        source.effectiveImportance,
        IMPORTANCES,
        `${path}.effectiveImportance`,
      ),
    };
  }
  exactKeys(source, ['status', 'reason'], [], path);
  const reason = record(source.reason, `${path}.reason`);
  const kind = controlled(
    reason.kind,
    ['DISPENSING_SUBTYPE_MISMATCH', 'CASE_DETERMINED'] as const,
    `${path}.reason.kind`,
  );
  if (kind === 'DISPENSING_SUBTYPE_MISMATCH') {
    exactKeys(reason, ['kind'], [], `${path}.reason`);
    return { status, reason: { kind } };
  }
  exactKeys(reason, ['kind', 'policyRef'], [], `${path}.reason`);
  try {
    return {
      status,
      reason: {
        kind,
        policyRef: validateSpfaApplicabilityPolicyIdV2(
          reason.policyRef,
          `${path}.reason.policyRef`,
        ),
      },
    };
  } catch {
    fail(`${path}.reason.policyRef`, 'invalid applicability policy ID');
  }
}

function parseSafetyCriticality(
  value: unknown,
  path: string,
): SpfaSafetyCriticalityV2 {
  const source = record(value, path);
  exactKeys(source, ['safetyCritical'], [], path);
  if (typeof source.safetyCritical !== 'boolean') {
    fail(`${path}.safetyCritical`, 'must be boolean');
  }
  return { safetyCritical: source.safetyCritical };
}

function parseTargetRefs(
  value: unknown,
  path: string,
): readonly SpfaRequirementTargetId[] {
  const values = array(value, path).map((item, index) => {
    try {
      return validateSpfaRequirementTargetIdV2(item, `${path}[${index}]`);
    } catch {
      fail(`${path}[${index}]`, 'invalid SPFA target ID');
    }
  });
  const seen = new Set<string>();
  values.forEach((item, index) => {
    if (seen.has(item)) fail(`${path}[${index}]`, 'duplicate target reference');
    seen.add(item);
  });
  return values;
}

function parseCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    fail(path, 'must be a non-negative safe integer');
  }
  return value;
}

function sameOrder(
  left: readonly SpfaRequirementTargetId[],
  right: readonly SpfaRequirementTargetId[],
): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function canonicalSubset(
  refs: readonly SpfaRequirementTargetId[],
  targetRefs: readonly SpfaRequirementTargetId[],
  path: string,
): void {
  const members = new Set(targetRefs);
  if (refs.some((ref) => !members.has(ref))) fail(path, 'contains a target outside targetRefs');
  const subset = new Set(refs);
  const expected = targetRefs.filter((ref) => subset.has(ref));
  if (!sameOrder(refs, expected)) fail(path, 'must follow canonical targetRefs order');
}

function parseRequirement(
  value: unknown,
  path: string,
): SpfaScoringRequirementContextV2 {
  const source = record(value, path);
  const applicabilitySource = record(source.applicability, `${path}.applicability`);
  const applicable = applicabilitySource.status === 'APPLICABLE';
  exactKeys(
    source,
    [
      'carePathSpfaRef', 'protocolRef', 'requirementRef', 'requirementKind',
      'applicability', 'safetyCriticality', 'targetRefs', 'resultStatus',
      'positiveTargetRefs', 'remainingTargetRefs', 'uncertainTargetRefs',
      'totalTargetCount', 'positiveTargetCount', 'remainingTargetCount',
      'uncertainTargetCount',
    ],
    applicable ? ['effectiveImportance'] : [],
    path,
  );
  const carePathSpfaRef = parseConclusionId(source.carePathSpfaRef, `${path}.carePathSpfaRef`);
  let protocolRef;
  let requirementRef: SpfaProtocolRequirementId;
  try {
    protocolRef = validateSpfaProtocolRefV2(source.protocolRef, `${path}.protocolRef`);
    requirementRef = validateSpfaProtocolRequirementIdV2(source.requirementRef, `${path}.requirementRef`);
  } catch {
    fail(path, 'contains an invalid protocol or requirement reference');
  }
  const requirementKind = controlled(source.requirementKind, KINDS, `${path}.requirementKind`) as SpfaScoringRequirementKindV2;
  const applicability = parseApplicability(source.applicability, `${path}.applicability`);
  let effectiveImportance: ApplicableRequirementImportance | undefined;
  if (applicability.status === 'APPLICABLE') {
    effectiveImportance = controlled(source.effectiveImportance, IMPORTANCES, `${path}.effectiveImportance`);
    if (effectiveImportance !== applicability.effectiveImportance) {
      fail(`${path}.effectiveImportance`, 'must match applicability.effectiveImportance');
    }
  }
  const safetyCriticality = parseSafetyCriticality(source.safetyCriticality, `${path}.safetyCriticality`);
  const targetRefs = parseTargetRefs(source.targetRefs, `${path}.targetRefs`);
  const resultStatus = controlled(source.resultStatus, STATUSES, `${path}.resultStatus`) as SpfaScoringRequirementResultStatusV2;
  const positiveTargetRefs = parseTargetRefs(source.positiveTargetRefs, `${path}.positiveTargetRefs`);
  const remainingTargetRefs = parseTargetRefs(source.remainingTargetRefs, `${path}.remainingTargetRefs`);
  const uncertainTargetRefs = parseTargetRefs(source.uncertainTargetRefs, `${path}.uncertainTargetRefs`);
  canonicalSubset(positiveTargetRefs, targetRefs, `${path}.positiveTargetRefs`);
  canonicalSubset(remainingTargetRefs, targetRefs, `${path}.remainingTargetRefs`);
  canonicalSubset(uncertainTargetRefs, remainingTargetRefs, `${path}.uncertainTargetRefs`);
  const positive = new Set(positiveTargetRefs);
  if (remainingTargetRefs.some((ref) => positive.has(ref))) {
    fail(`${path}.remainingTargetRefs`, 'must not overlap positiveTargetRefs');
  }
  if (positiveTargetRefs.length + remainingTargetRefs.length !== targetRefs.length) {
    fail(path, 'positive and remaining targets must partition targetRefs');
  }
  const combined = new Set([...positiveTargetRefs, ...remainingTargetRefs]);
  if (combined.size !== targetRefs.length) fail(path, 'target partition is incomplete');

  if (requirementKind === 'INFORMATION_REQUIREMENT' && ['PERFORMED', 'PARTIALLY_PERFORMED', 'NOT_PERFORMED'].includes(resultStatus)) {
    fail(`${path}.resultStatus`, 'is incompatible with an information requirement');
  }
  if (requirementKind === 'ACTION_REQUIREMENT' && ['COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED'].includes(resultStatus)) {
    fail(`${path}.resultStatus`, 'is incompatible with an action requirement');
  }
  if (applicability.status === 'NOT_APPLICABLE') {
    if (resultStatus !== 'NOT_APPLICABLE' || targetRefs.length !== 0 || positiveTargetRefs.length !== 0 || remainingTargetRefs.length !== 0 || uncertainTargetRefs.length !== 0) {
      fail(path, 'a non-applicable requirement must have NOT_APPLICABLE status and empty target partitions');
    }
  } else if (resultStatus === 'NOT_APPLICABLE' || targetRefs.length === 0) {
    fail(path, 'an applicable requirement must have targets and an applicable result status');
  }
  const expectedPositive = resultStatus === 'COVERED' || resultStatus === 'PERFORMED'
    ? targetRefs.length
    : resultStatus === 'NOT_COVERED' || resultStatus === 'NOT_PERFORMED' || resultStatus === 'NOT_APPLICABLE'
      ? 0
      : positiveTargetRefs.length;
  if (positiveTargetRefs.length !== expectedPositive) fail(`${path}.positiveTargetRefs`, 'does not match resultStatus');
  if ((resultStatus === 'COVERED' || resultStatus === 'PERFORMED') && remainingTargetRefs.length !== 0) fail(`${path}.remainingTargetRefs`, 'must be empty for a complete result');
  if ((resultStatus === 'PARTIALLY_COVERED' || resultStatus === 'PARTIALLY_PERFORMED') && (positiveTargetRefs.length === 0 || remainingTargetRefs.length === 0)) fail(path, 'a partial result requires positive and remaining targets');

  const totalTargetCount = parseCount(source.totalTargetCount, `${path}.totalTargetCount`);
  const positiveTargetCount = parseCount(source.positiveTargetCount, `${path}.positiveTargetCount`);
  const remainingTargetCount = parseCount(source.remainingTargetCount, `${path}.remainingTargetCount`);
  const uncertainTargetCount = parseCount(source.uncertainTargetCount, `${path}.uncertainTargetCount`);
  if (totalTargetCount !== targetRefs.length) fail(`${path}.totalTargetCount`, 'must be derived from targetRefs');
  if (positiveTargetCount !== positiveTargetRefs.length) fail(`${path}.positiveTargetCount`, 'must be derived from positiveTargetRefs');
  if (remainingTargetCount !== remainingTargetRefs.length) fail(`${path}.remainingTargetCount`, 'must be derived from remainingTargetRefs');
  if (uncertainTargetCount !== uncertainTargetRefs.length) fail(`${path}.uncertainTargetCount`, 'must be derived from uncertainTargetRefs');

  const common = {
    carePathSpfaRef,
    protocolRef,
    requirementRef,
    requirementKind,
    safetyCriticality,
    targetRefs,
    resultStatus,
    positiveTargetRefs,
    remainingTargetRefs,
    uncertainTargetRefs,
    totalTargetCount,
    positiveTargetCount,
    remainingTargetCount,
    uncertainTargetCount,
  };
  if (applicability.status === 'APPLICABLE') {
    return {
      ...common,
      applicability,
      effectiveImportance: applicability.effectiveImportance,
    };
  }
  return { ...common, applicability };
}

export function validateSpfaScoringContextV2(value: unknown): SpfaScoringContextV2 {
  const path = 'spfaScoringContext';
  const source = record(value, path);
  exactKeys(source, ['schemaVersion', 'sessionId', 'caseVersionId', 'protocolCatalogRef', 'transcriptFingerprint', 'requirements'], [], path);
  if (source.schemaVersion !== '2.0') fail(`${path}.schemaVersion`, 'must be 2.0');
  const requirements = array(source.requirements, `${path}.requirements`).map((item, index) => parseRequirement(item, `${path}.requirements[${index}]`));
  const identities = new Set<string>();
  requirements.forEach((requirement, index) => {
    const key = `${requirement.carePathSpfaRef}\u0000${requirement.requirementRef}`;
    if (identities.has(key)) fail(`${path}.requirements[${index}]`, 'duplicate requirement context');
    identities.add(key);
  });
  return {
    schemaVersion: '2.0',
    sessionId: parseSessionId(source.sessionId, `${path}.sessionId`),
    caseVersionId: parseCaseVersionId(source.caseVersionId, `${path}.caseVersionId`),
    protocolCatalogRef: parseVersionRef(source.protocolCatalogRef, `${path}.protocolCatalogRef`),
    transcriptFingerprint: parseFingerprint(source.transcriptFingerprint, `${path}.transcriptFingerprint`),
    requirements,
  };
}
