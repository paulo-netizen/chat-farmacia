import type { ConclusionId, VersionRef } from './evaluator-types';
import { scoreSpfaSessionV2 } from './score-spfa-session';
import type { SpfaScoringContextV2 } from './spfa-scoring-context-types';
import type { SpfaScoringPolicyV2 } from './spfa-scoring-policy-types';
import type {
  SpfaCriticalAlertCodeV2,
  SpfaCriticalAlertV2,
  SpfaRequirementContributionV2,
  SpfaSessionScoreV2,
} from './spfa-session-score-types';
import type { SpfaProtocolRequirementId } from './spfa-protocol-types';
import type { SessionTranscriptFingerprintV2 } from './spfa-session-evidence-types';
import type { CaseVersionId } from './types';
import {
  validateSpfaProtocolRefV2,
  validateSpfaProtocolRequirementIdV2,
} from './validate-spfa-protocol-definition';
import { validateCaseVersionId } from './validate-patient-facts';

const SESSION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CONCLUSION_ID_PATTERN = /^conclusion_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export class SpfaSessionScoreValidationError extends Error {
  constructor(public readonly path: string, message: string, public readonly cause?: unknown) {
    super(`${path}: ${message}`);
    this.name = 'SpfaSessionScoreValidationError';
  }
}

function fail(path: string, message: string, cause?: unknown): never {
  throw new SpfaSessionScoreValidationError(path, message, cause);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be an object');
  return value as Record<string, unknown>;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function exactKeys(source: Record<string, unknown>, required: readonly string[], optional: readonly string[], path: string): void {
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(source)) if (!allowed.has(key)) fail(`${path}.${key}`, 'unexpected property');
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(source, key)) fail(`${path}.${key}`, 'missing required property');
}

function controlled<const T extends readonly string[]>(value: unknown, allowed: T, path: string): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) fail(path, `must be one of: ${allowed.join(', ')}`);
  return value as T[number];
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) fail(path, 'must be a non-empty, unpadded string');
  return value;
}

function parseVersionRef(value: unknown, path: string): Readonly<VersionRef> {
  const source = record(value, path);
  exactKeys(source, ['id', 'version'], [], path);
  return { id: nonEmptyString(source.id, `${path}.id`), version: nonEmptyString(source.version, `${path}.version`) };
}

function parseSessionId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !SESSION_UUID_PATTERN.test(value)) fail(path, 'must be a canonical lowercase UUID');
  return value;
}

function parseCaseVersionId(value: unknown, path: string): CaseVersionId {
  try { return validateCaseVersionId(value, path); } catch { fail(path, 'invalid case version ID'); }
}

function parseConclusionId(value: unknown, path: string): ConclusionId {
  if (typeof value !== 'string' || !CONCLUSION_ID_PATTERN.test(value)) fail(path, 'must use conclusion_<uuid>');
  return value as ConclusionId;
}

function parseRequirementId(value: unknown, path: string): SpfaProtocolRequirementId {
  try { return validateSpfaProtocolRequirementIdV2(value, path); } catch { fail(path, 'invalid SPFA requirement ID'); }
}

function parseFingerprint(value: unknown, path: string): SessionTranscriptFingerprintV2 {
  const source = record(value, path);
  exactKeys(source, ['algorithm', 'canonicalization', 'value'], [], path);
  if (source.algorithm !== 'sha256') fail(`${path}.algorithm`, 'must be sha256');
  if (source.canonicalization !== 'session-transcript-v2/1') fail(`${path}.canonicalization`, 'must be session-transcript-v2/1');
  if (typeof source.value !== 'string' || !SHA256_PATTERN.test(source.value)) fail(`${path}.value`, 'must be a lowercase SHA-256 digest');
  return { algorithm: 'sha256', canonicalization: 'session-transcript-v2/1', value: source.value };
}

function finiteNonNegative(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) fail(path, 'must be a finite non-negative number');
  return value;
}

function count(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(path, 'must be a non-negative safe integer');
  return value;
}

function parseContribution(value: unknown, path: string): SpfaRequirementContributionV2 {
  const source = record(value, path);
  const applicability = controlled(source.applicability, ['APPLICABLE', 'NOT_APPLICABLE'] as const, `${path}.applicability`);
  exactKeys(source, [
    'carePathSpfaRef', 'protocolRef', 'requirementRef', 'requirementKind', 'applicability',
    'safetyCriticality', 'resultStatus', 'earnedPoints', 'possiblePoints', 'totalTargetCount',
    'positiveTargetCount', 'remainingTargetCount', 'uncertainTargetCount',
  ], applicability === 'APPLICABLE' ? ['effectiveImportance'] : [], path);
  let protocolRef;
  try { protocolRef = validateSpfaProtocolRefV2(source.protocolRef, `${path}.protocolRef`); } catch { fail(`${path}.protocolRef`, 'invalid protocol reference'); }
  const safety = record(source.safetyCriticality, `${path}.safetyCriticality`);
  exactKeys(safety, ['safetyCritical'], [], `${path}.safetyCriticality`);
  if (typeof safety.safetyCritical !== 'boolean') fail(`${path}.safetyCriticality.safetyCritical`, 'must be boolean');
  const common = {
    carePathSpfaRef: parseConclusionId(source.carePathSpfaRef, `${path}.carePathSpfaRef`),
    protocolRef,
    requirementRef: parseRequirementId(source.requirementRef, `${path}.requirementRef`),
    requirementKind: controlled(source.requirementKind, ['INFORMATION_REQUIREMENT', 'ACTION_REQUIREMENT'] as const, `${path}.requirementKind`),
    safetyCriticality: { safetyCritical: safety.safetyCritical },
    resultStatus: controlled(source.resultStatus, ['COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'PERFORMED', 'PARTIALLY_PERFORMED', 'NOT_PERFORMED', 'NOT_APPLICABLE'] as const, `${path}.resultStatus`),
    earnedPoints: finiteNonNegative(source.earnedPoints, `${path}.earnedPoints`),
    possiblePoints: finiteNonNegative(source.possiblePoints, `${path}.possiblePoints`),
    totalTargetCount: count(source.totalTargetCount, `${path}.totalTargetCount`),
    positiveTargetCount: count(source.positiveTargetCount, `${path}.positiveTargetCount`),
    remainingTargetCount: count(source.remainingTargetCount, `${path}.remainingTargetCount`),
    uncertainTargetCount: count(source.uncertainTargetCount, `${path}.uncertainTargetCount`),
  };
  if (common.earnedPoints > common.possiblePoints) fail(`${path}.earnedPoints`, 'must not exceed possiblePoints');
  if (common.positiveTargetCount + common.remainingTargetCount !== common.totalTargetCount) fail(path, 'positive and remaining counts must partition total targets');
  if (common.uncertainTargetCount > common.remainingTargetCount) fail(`${path}.uncertainTargetCount`, 'must not exceed remainingTargetCount');
  if (applicability === 'NOT_APPLICABLE') {
    if (common.resultStatus !== 'NOT_APPLICABLE' || common.earnedPoints !== 0 || common.possiblePoints !== 0 || common.totalTargetCount !== 0) fail(path, 'non-applicable contribution must be empty and zero-valued');
    return { ...common, applicability };
  }
  const effectiveImportance = controlled(source.effectiveImportance, ['CRITICAL', 'RELEVANT', 'OPTIONAL'] as const, `${path}.effectiveImportance`);
  if (common.resultStatus === 'NOT_APPLICABLE' || common.totalTargetCount === 0) fail(path, 'applicable contribution requires targets and an applicable result');
  return { ...common, applicability, effectiveImportance };
}

function parseAlert(value: unknown, path: string): SpfaCriticalAlertV2 {
  const source = record(value, path);
  exactKeys(source, ['carePathSpfaRef', 'requirementRef', 'code'], [], path);
  return {
    carePathSpfaRef: parseConclusionId(source.carePathSpfaRef, `${path}.carePathSpfaRef`),
    requirementRef: parseRequirementId(source.requirementRef, `${path}.requirementRef`),
    code: controlled(source.code, ['CRITICAL_OMISSION', 'CRITICAL_PARTIAL', 'CRITICAL_UNCERTAIN'] as const, `${path}.code`) as SpfaCriticalAlertCodeV2,
  };
}

function materiallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) && Array.isArray(right) && left.length === right.length && left.every((item, index) => materiallyEqual(item, right[index]));
  if (typeof left !== 'object' || left === null || typeof right !== 'object' || right === null) return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => key === rightKeys[index] && materiallyEqual(leftRecord[key], rightRecord[key]));
}

export function validateSpfaSessionScoreV2(
  value: unknown,
  context: SpfaScoringContextV2,
  policy: SpfaScoringPolicyV2,
): SpfaSessionScoreV2 {
  const path = 'spfaSessionScore';
  const source = record(value, path);
  exactKeys(source, [
    'schemaVersion', 'sessionId', 'caseVersionId', 'transcriptFingerprint', 'protocolCatalogRef',
    'scoringPolicyRef', 'status', 'rawPoints', 'possiblePoints', 'score',
    'requirementContributions', 'criticalAlerts', 'needsReview',
  ], [], path);
  if (source.schemaVersion !== '2.0') fail(`${path}.schemaVersion`, 'must be 2.0');
  const status = controlled(source.status, ['SCORED', 'REVIEW_REQUIRED', 'NOT_SCORABLE'] as const, `${path}.status`);
  const rawPoints = finiteNonNegative(source.rawPoints, `${path}.rawPoints`);
  const possiblePoints = finiteNonNegative(source.possiblePoints, `${path}.possiblePoints`);
  if (rawPoints > possiblePoints) fail(`${path}.rawPoints`, 'must not exceed possiblePoints');
  let score: number | null;
  let needsReview: boolean;
  if (status === 'NOT_SCORABLE') {
    if (source.score !== null) fail(`${path}.score`, 'must be null when NOT_SCORABLE');
    if (rawPoints !== 0 || possiblePoints !== 0) fail(path, 'NOT_SCORABLE requires zero points');
    if (source.needsReview !== false) fail(`${path}.needsReview`, 'must be false when NOT_SCORABLE');
    score = null;
    needsReview = false;
  } else {
    score = finiteNonNegative(source.score, `${path}.score`);
    if (score > 100) fail(`${path}.score`, 'must not exceed 100');
    const expectedReview = status === 'REVIEW_REQUIRED';
    if (source.needsReview !== expectedReview) fail(`${path}.needsReview`, `must be ${expectedReview}`);
    needsReview = expectedReview;
  }
  const requirementContributions = array(source.requirementContributions, `${path}.requirementContributions`).map((item, index) => parseContribution(item, `${path}.requirementContributions[${index}]`));
  const criticalAlerts = array(source.criticalAlerts, `${path}.criticalAlerts`).map((item, index) => parseAlert(item, `${path}.criticalAlerts[${index}]`));
  const alertKeys = new Set<string>();
  criticalAlerts.forEach((alert, index) => {
    const key = `${alert.carePathSpfaRef}\u0000${alert.requirementRef}\u0000${alert.code}`;
    if (alertKeys.has(key)) fail(`${path}.criticalAlerts[${index}]`, 'duplicate critical alert');
    alertKeys.add(key);
  });
  const parsedBase = {
    schemaVersion: '2.0' as const,
    sessionId: parseSessionId(source.sessionId, `${path}.sessionId`),
    caseVersionId: parseCaseVersionId(source.caseVersionId, `${path}.caseVersionId`),
    transcriptFingerprint: parseFingerprint(source.transcriptFingerprint, `${path}.transcriptFingerprint`),
    protocolCatalogRef: parseVersionRef(source.protocolCatalogRef, `${path}.protocolCatalogRef`),
    scoringPolicyRef: parseVersionRef(source.scoringPolicyRef, `${path}.scoringPolicyRef`),
    rawPoints,
    possiblePoints,
    requirementContributions,
    criticalAlerts,
  };
  const parsed: SpfaSessionScoreV2 = status === 'NOT_SCORABLE'
    ? { ...parsedBase, status, score: null, needsReview: false }
    : status === 'REVIEW_REQUIRED'
      ? { ...parsedBase, status, score: score as number, needsReview: true }
      : { ...parsedBase, status, score: score as number, needsReview: false };
  let expected: SpfaSessionScoreV2;
  try { expected = scoreSpfaSessionV2(context, policy); } catch (cause) { fail('context', 'cannot derive canonical score from context and policy', cause); }
  if (!materiallyEqual(parsed, expected)) fail(path, 'does not match the canonical score for the supplied context and policy');
  return parsed;
}
