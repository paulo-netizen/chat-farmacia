import type {
  SpfaCompletedLifecycleV2,
  SpfaEvaluationClaimDecisionV2,
  SpfaEvaluationLifecycleV2,
  SpfaEvaluationRetryPolicyV2,
  SpfaEvaluationSnapshotIdentityV2,
  SpfaEvaluatingLifecycleV2,
  SpfaFailedLifecycleV2,
} from './spfa-evaluation-lifecycle-types';
import { validateSpfaEvaluationTimestampV2 } from './validate-spfa-evaluation-lifecycle';

export type SpfaEvaluationLifecycleTransitionErrorCodeV2 =
  | 'INVALID_TRANSITION'
  | 'SNAPSHOT_DRIFT'
  | 'LEASE_ACTIVE'
  | 'ATTEMPT_ID_REUSED'
  | 'ATTEMPT_ID_MISMATCH'
  | 'ATTEMPT_COUNT_MISMATCH'
  | 'ATTEMPT_COUNT_EXHAUSTED'
  | 'RETRY_DISABLED';

export class SpfaEvaluationLifecycleTransitionError extends Error {
  constructor(
    public readonly code: SpfaEvaluationLifecycleTransitionErrorCodeV2,
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaEvaluationLifecycleTransitionError';
  }
}

function transitionFail(
  code: SpfaEvaluationLifecycleTransitionErrorCodeV2,
  path: string,
  message: string,
): never {
  throw new SpfaEvaluationLifecycleTransitionError(code, path, message);
}

function sameVersionRef(
  left: SpfaEvaluationSnapshotIdentityV2['protocolCatalogRef'],
  right: SpfaEvaluationSnapshotIdentityV2['protocolCatalogRef'],
): boolean {
  return left.id === right.id && left.version === right.version;
}

function sameFingerprint(
  left: SpfaEvaluationSnapshotIdentityV2['transcriptFingerprint'],
  right: SpfaEvaluationSnapshotIdentityV2['transcriptFingerprint'],
): boolean {
  return left.algorithm === right.algorithm && left.canonicalization === right.canonicalization && left.value === right.value;
}

export function assertSameSpfaEvaluationSnapshotIdentityV2(
  expected: SpfaEvaluationSnapshotIdentityV2,
  actual: SpfaEvaluationSnapshotIdentityV2,
): void {
  const comparisons: readonly [string, boolean][] = [
    ['sessionId', expected.sessionId === actual.sessionId],
    ['caseVersionId', expected.caseVersionId === actual.caseVersionId],
    ['protocolCatalogRef', sameVersionRef(expected.protocolCatalogRef, actual.protocolCatalogRef)],
    ['transcriptFingerprint', sameFingerprint(expected.transcriptFingerprint, actual.transcriptFingerprint)],
    ['scoringPolicyRef', sameVersionRef(expected.scoringPolicyRef, actual.scoringPolicyRef)],
  ];
  const mismatch = comparisons.find(([, equal]) => !equal);
  if (mismatch !== undefined) {
    transitionFail('SNAPSHOT_DRIFT', `snapshotIdentity.${mismatch[0]}`, 'must remain identical after the first claim');
  }
}

export function isSpfaEvaluationLeaseExpiredV2(
  lifecycle: SpfaEvaluatingLifecycleV2,
  now: unknown,
): boolean {
  return validateSpfaEvaluationTimestampV2(now, 'now') >= lifecycle.leaseExpiresAt;
}

export function canRecoverSpfaEvaluationV2(
  lifecycle: SpfaEvaluatingLifecycleV2,
  now: unknown,
): boolean {
  return isSpfaEvaluationLeaseExpiredV2(lifecycle, now);
}

export function canRetryFailedSpfaEvaluationV2(
  _lifecycle: SpfaFailedLifecycleV2,
  policy: SpfaEvaluationRetryPolicyV2,
): boolean {
  return policy.allowFailedRetry;
}

function sameMaterial(value: unknown, other: unknown): boolean {
  return JSON.stringify(value) === JSON.stringify(other);
}

function nextAttemptCount(current: number): number {
  if (current >= Number.MAX_SAFE_INTEGER) {
    transitionFail('ATTEMPT_COUNT_EXHAUSTED', 'attemptCount', 'cannot increment beyond the safe integer range');
  }
  return current + 1;
}

export function assertSpfaEvaluationLifecycleTransitionV2(
  previous: SpfaEvaluationLifecycleV2 | null,
  next: SpfaEvaluationLifecycleV2,
  now: unknown,
  retryPolicy: SpfaEvaluationRetryPolicyV2,
): void {
  const canonicalNow = validateSpfaEvaluationTimestampV2(now, 'now');
  if (previous === null) {
    if (next.status !== 'EVALUATING') transitionFail('INVALID_TRANSITION', 'status', 'first claim must be EVALUATING');
    if (next.attemptCount !== 1) transitionFail('ATTEMPT_COUNT_MISMATCH', 'attemptCount', 'first claim must use attemptCount 1');
    return;
  }
  assertSameSpfaEvaluationSnapshotIdentityV2(previous.snapshotIdentity, next.snapshotIdentity);
  if (previous.sessionId !== next.sessionId) transitionFail('SNAPSHOT_DRIFT', 'sessionId', 'must remain unchanged');
  if (previous.status === 'COMPLETED') {
    if (next.status === 'COMPLETED' && sameMaterial(previous, next)) return;
    transitionFail('INVALID_TRANSITION', 'status', 'COMPLETED is terminal and cannot be overwritten');
  }
  if (previous.status === 'FAILED') {
    if (next.status !== 'EVALUATING') transitionFail('INVALID_TRANSITION', 'status', 'FAILED may only transition to a retry claim');
    if (!retryPolicy.allowFailedRetry) transitionFail('RETRY_DISABLED', 'status', 'failed evaluation retry is disabled');
    if (next.attemptId === previous.attemptId) transitionFail('ATTEMPT_ID_REUSED', 'attemptId', 'retry requires a new attempt ID');
    if (next.attemptCount !== nextAttemptCount(previous.attemptCount)) transitionFail('ATTEMPT_COUNT_MISMATCH', 'attemptCount', 'retry must increment attemptCount by one');
    if (next.startedAt < previous.failedAt) transitionFail('INVALID_TRANSITION', 'startedAt', 'retry cannot start before failure');
    return;
  }
  if (next.status === 'EVALUATING') {
    if (canonicalNow < previous.leaseExpiresAt) transitionFail('LEASE_ACTIVE', 'leaseExpiresAt', 'active lease cannot be reclaimed');
    if (next.attemptId === previous.attemptId) transitionFail('ATTEMPT_ID_REUSED', 'attemptId', 'recovery requires a new attempt ID');
    if (next.attemptCount !== nextAttemptCount(previous.attemptCount)) transitionFail('ATTEMPT_COUNT_MISMATCH', 'attemptCount', 'recovery must increment attemptCount by one');
    if (next.startedAt < previous.leaseExpiresAt) transitionFail('INVALID_TRANSITION', 'startedAt', 'recovery cannot start before lease expiry');
    return;
  }
  if (next.attemptId !== previous.attemptId) transitionFail('ATTEMPT_ID_MISMATCH', 'attemptId', 'completion or failure must belong to the current attempt');
  if (next.attemptCount !== previous.attemptCount) transitionFail('ATTEMPT_COUNT_MISMATCH', 'attemptCount', 'completion or failure must preserve attemptCount');
  if (next.startedAt !== previous.startedAt) transitionFail('INVALID_TRANSITION', 'startedAt', 'completion or failure must preserve attempt startedAt');
}

export function decideSpfaEvaluationClaimV2(
  lifecycle: SpfaEvaluationLifecycleV2 | null,
  requestedSnapshot: SpfaEvaluationSnapshotIdentityV2,
  now: unknown,
  retryPolicy: SpfaEvaluationRetryPolicyV2,
): SpfaEvaluationClaimDecisionV2 {
  const canonicalNow = validateSpfaEvaluationTimestampV2(now, 'now');
  if (lifecycle === null) return { decision: 'CLAIM_NEW', nextAttemptCount: 1 };
  assertSameSpfaEvaluationSnapshotIdentityV2(lifecycle.snapshotIdentity, requestedSnapshot);
  if (lifecycle.status === 'COMPLETED') {
    return { decision: 'RETURN_COMPLETED', completedPayload: lifecycle.completedPayload };
  }
  if (lifecycle.status === 'FAILED') {
    return retryPolicy.allowFailedRetry
      ? { decision: 'RETRY_FAILED', previousAttemptId: lifecycle.attemptId, nextAttemptCount: nextAttemptCount(lifecycle.attemptCount) }
      : { decision: 'REJECT', reason: 'FAILED_RETRY_DISABLED' };
  }
  return canonicalNow < lifecycle.leaseExpiresAt
    ? { decision: 'IN_PROGRESS', currentAttemptId: lifecycle.attemptId, leaseExpiresAt: lifecycle.leaseExpiresAt }
    : { decision: 'RECOVER_EXPIRED', previousAttemptId: lifecycle.attemptId, nextAttemptCount: nextAttemptCount(lifecycle.attemptCount) };
}
