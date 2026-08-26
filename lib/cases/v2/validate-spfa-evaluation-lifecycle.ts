import type { VersionRef } from './evaluator-types';
import type {
  SpfaCompletedEvaluationPayloadV2,
  SpfaEvaluationAttemptIdV2,
  SpfaEvaluationFailureCodeV2,
  SpfaEvaluationFreezePreconditionsV2,
  SpfaEvaluationLifecycleCompletionValidationContextV2,
  SpfaEvaluationLifecycleStatusV2,
  SpfaEvaluationLifecycleV2,
  SpfaEvaluationSnapshotIdentityV2,
} from './spfa-evaluation-lifecycle-types';
import {
  SPFA_EVALUATION_FAILURE_CODES_V2,
  SPFA_EVALUATION_LIFECYCLE_STATUSES_V2,
} from './spfa-evaluation-lifecycle-types';
import type { SessionTranscriptFingerprintV2 } from './spfa-session-evidence-types';
import type { CaseVersionId } from './types';
import { validateSpfaSessionEvaluationV2 } from './validate-spfa-session-evaluation';
import { validateSpfaScoringContextV2 } from './validate-spfa-scoring-context';
import { validateSpfaScoringPolicyV2 } from './validate-spfa-scoring-policy';
import { validateSpfaSessionScoreV2 } from './validate-spfa-session-score';
import { validateCaseVersionId } from './validate-patient-facts';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const ATTEMPT_ID_PATTERN = /^spfa_eval_attempt_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const EXPLICIT_INSTANT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

export class SpfaEvaluationLifecycleValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaEvaluationLifecycleValidationError';
  }
}

function fail(path: string, message: string, cause?: unknown): never {
  throw new SpfaEvaluationLifecycleValidationError(path, message, cause);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  source: Record<string, unknown>,
  required: readonly string[],
  path: string,
): void {
  const allowed = new Set(required);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      fail(`${path}.${key}`, 'missing required property');
    }
  }
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(path, 'must be a non-empty, unpadded string');
  }
  return value;
}

function parseSessionId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    fail(path, 'must be a canonical lowercase UUID');
  }
  return value;
}

function parseCaseVersionId(value: unknown, path: string): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch (cause) {
    fail(path, 'must be a valid case version ID', cause);
  }
}

function parseVersionRef(value: unknown, path: string): Readonly<VersionRef> {
  const source = record(value, path);
  exactKeys(source, ['id', 'version'], path);
  return {
    id: nonEmptyString(source.id, `${path}.id`),
    version: nonEmptyString(source.version, `${path}.version`),
  };
}

function parseFingerprint(value: unknown, path: string): SessionTranscriptFingerprintV2 {
  const source = record(value, path);
  exactKeys(source, ['algorithm', 'canonicalization', 'value'], path);
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

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
}

export function validateSpfaEvaluationTimestampV2(value: unknown, path = 'timestamp'): string {
  if (typeof value !== 'string') fail(path, 'must be a timestamp string');
  const match = EXPLICIT_INSTANT_PATTERN.exec(value);
  if (match === null) fail(path, 'must be an ISO/RFC3339 timestamp with an explicit timezone');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, timezone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    year === 0 || month < 1 || month > 12 || day < 1 ||
    day > daysInMonth(year, month) || hour > 23 || minute > 59 || second > 59
  ) {
    fail(path, 'must contain a valid calendar date and time');
  }
  if (timezone !== 'Z') {
    const offsetHour = Number(timezone.slice(1, 3));
    const offsetMinute = Number(timezone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) fail(path, 'must contain a valid timezone offset');
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail(path, 'must be a valid timestamp');
  return parsed.toISOString();
}

export function validateSpfaEvaluationAttemptIdV2(
  value: unknown,
  path = 'attemptId',
): SpfaEvaluationAttemptIdV2 {
  if (typeof value !== 'string' || !ATTEMPT_ID_PATTERN.test(value)) {
    fail(path, 'must use spfa_eval_attempt_<canonical-lowercase-uuid>');
  }
  return value as SpfaEvaluationAttemptIdV2;
}

export function validateSpfaEvaluationSnapshotIdentityV2(
  value: unknown,
  path = 'snapshotIdentity',
): SpfaEvaluationSnapshotIdentityV2 {
  const source = record(value, path);
  exactKeys(
    source,
    ['sessionId', 'caseVersionId', 'protocolCatalogRef', 'transcriptFingerprint', 'scoringPolicyRef'],
    path,
  );
  return {
    sessionId: parseSessionId(source.sessionId, `${path}.sessionId`),
    caseVersionId: parseCaseVersionId(source.caseVersionId, `${path}.caseVersionId`),
    protocolCatalogRef: parseVersionRef(source.protocolCatalogRef, `${path}.protocolCatalogRef`),
    transcriptFingerprint: parseFingerprint(source.transcriptFingerprint, `${path}.transcriptFingerprint`),
    scoringPolicyRef: parseVersionRef(source.scoringPolicyRef, `${path}.scoringPolicyRef`),
  };
}

function sameVersionRef(left: Readonly<VersionRef>, right: Readonly<VersionRef>): boolean {
  return left.id === right.id && left.version === right.version;
}

function sameFingerprint(left: SessionTranscriptFingerprintV2, right: SessionTranscriptFingerprintV2): boolean {
  return left.algorithm === right.algorithm &&
    left.canonicalization === right.canonicalization && left.value === right.value;
}

function parseAttemptCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    fail(path, 'must be a positive safe integer');
  }
  return value;
}

function isLifecycleStatus(value: string): value is SpfaEvaluationLifecycleStatusV2 {
  return (SPFA_EVALUATION_LIFECYCLE_STATUSES_V2 as readonly string[]).includes(value);
}

function isFailureCode(value: string): value is SpfaEvaluationFailureCodeV2 {
  return (SPFA_EVALUATION_FAILURE_CODES_V2 as readonly string[]).includes(value);
}

function parseCompletedPayload(
  value: unknown,
  snapshot: SpfaEvaluationSnapshotIdentityV2,
  context: SpfaEvaluationLifecycleCompletionValidationContextV2 | undefined,
  path: string,
): SpfaCompletedEvaluationPayloadV2 {
  if (context === undefined) fail(path, 'requires server-owned completion validation context');
  const source = record(value, path);
  exactKeys(source, ['evaluation', 'score'], path);
  let evaluation;
  let scoringContext;
  let scoringPolicy;
  let score;
  try {
    evaluation = validateSpfaSessionEvaluationV2(source.evaluation, context.evaluationContext);
  } catch (cause) {
    fail(`${path}.evaluation`, 'must be a valid SPFA session evaluation', cause);
  }
  try {
    scoringContext = validateSpfaScoringContextV2(context.scoringContext);
    scoringPolicy = validateSpfaScoringPolicyV2(context.scoringPolicy);
    score = validateSpfaSessionScoreV2(source.score, scoringContext, scoringPolicy);
  } catch (cause) {
    fail(`${path}.score`, 'must be a valid canonical SPFA session score', cause);
  }
  for (const [candidatePath, candidate] of [
    [`${path}.evaluation`, evaluation],
    [`${path}.score`, score],
    ['completionContext.scoringContext', scoringContext],
  ] as const) {
    if (candidate.sessionId !== snapshot.sessionId) fail(`${candidatePath}.sessionId`, 'does not match snapshot identity');
    if (candidate.caseVersionId !== snapshot.caseVersionId) fail(`${candidatePath}.caseVersionId`, 'does not match snapshot identity');
    if (!sameVersionRef(candidate.protocolCatalogRef, snapshot.protocolCatalogRef)) {
      fail(`${candidatePath}.protocolCatalogRef`, 'does not match snapshot identity');
    }
    if (!sameFingerprint(candidate.transcriptFingerprint, snapshot.transcriptFingerprint)) {
      fail(`${candidatePath}.transcriptFingerprint`, 'does not match snapshot identity');
    }
  }
  if (!sameVersionRef(scoringPolicy.policyRef, snapshot.scoringPolicyRef)) {
    fail('completionContext.scoringPolicy.policyRef', 'does not match snapshot identity');
  }
  if (!sameVersionRef(score.scoringPolicyRef, snapshot.scoringPolicyRef)) {
    fail(`${path}.score.scoringPolicyRef`, 'does not match snapshot identity');
  }
  return { evaluation, score };
}

export function validateSpfaEvaluationFreezePreconditionsV2(
  value: unknown,
  path = 'freezePreconditions',
): SpfaEvaluationFreezePreconditionsV2 {
  const source = record(value, path);
  exactKeys(source, [
    'schemaVersion', 'sessionId', 'snapshotIdentity', 'sessionOwnership', 'sessionStatus',
    'caseVersionPinned', 'transcriptSnapshotCanonical', 'messageWritesSerialized', 'finishSessionAtomically',
  ], path);
  if (source.schemaVersion !== '2.0') fail(`${path}.schemaVersion`, 'must be 2.0');
  const sessionId = parseSessionId(source.sessionId, `${path}.sessionId`);
  const snapshotIdentity = validateSpfaEvaluationSnapshotIdentityV2(source.snapshotIdentity, `${path}.snapshotIdentity`);
  if (snapshotIdentity.sessionId !== sessionId) fail(`${path}.snapshotIdentity.sessionId`, 'must match sessionId');
  if (source.sessionOwnership !== 'VERIFIED') fail(`${path}.sessionOwnership`, 'must be VERIFIED server-side');
  if (source.sessionStatus !== 'active') fail(`${path}.sessionStatus`, 'must be active for the initial freeze');
  for (const key of ['caseVersionPinned', 'transcriptSnapshotCanonical', 'messageWritesSerialized', 'finishSessionAtomically'] as const) {
    if (source[key] !== true) fail(`${path}.${key}`, 'must be true');
  }
  return {
    schemaVersion: '2.0', sessionId, snapshotIdentity,
    sessionOwnership: 'VERIFIED', sessionStatus: 'active', caseVersionPinned: true,
    transcriptSnapshotCanonical: true, messageWritesSerialized: true, finishSessionAtomically: true,
  };
}

export function validateSpfaEvaluationLifecycleV2(
  value: unknown,
  completionContext?: SpfaEvaluationLifecycleCompletionValidationContextV2,
  path = 'spfaEvaluationLifecycle',
): SpfaEvaluationLifecycleV2 {
  const source = record(value, path);
  if (source.schemaVersion !== '2.0') fail(`${path}.schemaVersion`, 'must be 2.0');
  if (typeof source.status !== 'string' || !isLifecycleStatus(source.status)) {
    fail(`${path}.status`, `must be one of: ${SPFA_EVALUATION_LIFECYCLE_STATUSES_V2.join(', ')}`);
  }
  const status = source.status;
  const statusFields = status === 'EVALUATING'
    ? ['leaseExpiresAt']
    : status === 'COMPLETED'
      ? ['completedAt', 'completedPayload']
      : ['failedAt', 'failureCode'];
  exactKeys(source, [
    'schemaVersion', 'sessionId', 'status', 'snapshotIdentity', 'attemptId', 'attemptCount', 'startedAt', ...statusFields,
  ], path);
  const sessionId = parseSessionId(source.sessionId, `${path}.sessionId`);
  const snapshotIdentity = validateSpfaEvaluationSnapshotIdentityV2(source.snapshotIdentity, `${path}.snapshotIdentity`);
  if (snapshotIdentity.sessionId !== sessionId) fail(`${path}.snapshotIdentity.sessionId`, 'must match lifecycle sessionId');
  const common = {
    schemaVersion: '2.0' as const,
    sessionId,
    snapshotIdentity,
    attemptId: validateSpfaEvaluationAttemptIdV2(source.attemptId, `${path}.attemptId`),
    attemptCount: parseAttemptCount(source.attemptCount, `${path}.attemptCount`),
    startedAt: validateSpfaEvaluationTimestampV2(source.startedAt, `${path}.startedAt`),
  };
  if (status === 'EVALUATING') {
    const leaseExpiresAt = validateSpfaEvaluationTimestampV2(source.leaseExpiresAt, `${path}.leaseExpiresAt`);
    if (leaseExpiresAt <= common.startedAt) fail(`${path}.leaseExpiresAt`, 'must be after startedAt');
    return { ...common, status, leaseExpiresAt };
  }
  if (status === 'FAILED') {
    const failedAt = validateSpfaEvaluationTimestampV2(source.failedAt, `${path}.failedAt`);
    if (failedAt < common.startedAt) fail(`${path}.failedAt`, 'must not precede startedAt');
    if (typeof source.failureCode !== 'string' || !isFailureCode(source.failureCode)) {
      fail(`${path}.failureCode`, `must be one of: ${SPFA_EVALUATION_FAILURE_CODES_V2.join(', ')}`);
    }
    return { ...common, status, failedAt, failureCode: source.failureCode };
  }
  const completedAt = validateSpfaEvaluationTimestampV2(source.completedAt, `${path}.completedAt`);
  if (completedAt < common.startedAt) fail(`${path}.completedAt`, 'must not precede startedAt');
  return {
    ...common,
    status,
    completedAt,
    completedPayload: parseCompletedPayload(source.completedPayload, snapshotIdentity, completionContext, `${path}.completedPayload`),
  };
}
