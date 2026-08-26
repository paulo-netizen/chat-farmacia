import type { VersionRef } from './evaluator-types';
import type { SpfaScoringContextV2 } from './spfa-scoring-context-types';
import type { SpfaScoringPolicyV2 } from './spfa-scoring-policy-types';
import type { SpfaSessionEvaluationV2, SpfaSessionEvaluationValidationContextV2 } from './spfa-session-evaluation-types';
import type { SessionTranscriptFingerprintV2 } from './spfa-session-evidence-types';
import type { SpfaSessionScoreV2 } from './spfa-session-score-types';
import type { CaseVersionId } from './types';

declare const spfaEvaluationAttemptIdBrand: unique symbol;

export type SpfaEvaluationAttemptIdV2 = string & {
  readonly [spfaEvaluationAttemptIdBrand]: true;
};

export const SPFA_EVALUATION_LIFECYCLE_STATUSES_V2 = [
  'EVALUATING',
  'COMPLETED',
  'FAILED',
] as const;

export type SpfaEvaluationLifecycleStatusV2 =
  (typeof SPFA_EVALUATION_LIFECYCLE_STATUSES_V2)[number];

export const SPFA_EVALUATION_FAILURE_CODES_V2 = [
  'PROVIDER_FAILURE',
  'INVALID_PROVIDER_RESULT',
  'EVALUATION_FAILURE',
  'SNAPSHOT_DRIFT',
  'INTERNAL_FAILURE',
] as const;

export type SpfaEvaluationFailureCodeV2 =
  (typeof SPFA_EVALUATION_FAILURE_CODES_V2)[number];

/** Exact immutable identity of the clinical input frozen for one session. */
export type SpfaEvaluationSnapshotIdentityV2 = Readonly<{
  sessionId: string;
  caseVersionId: CaseVersionId;
  protocolCatalogRef: Readonly<VersionRef>;
  transcriptFingerprint: SessionTranscriptFingerprintV2;
  scoringPolicyRef: Readonly<VersionRef>;
}>;

export type SpfaCompletedEvaluationPayloadV2 = Readonly<{
  evaluation: SpfaSessionEvaluationV2;
  score: SpfaSessionScoreV2;
}>;

type SpfaEvaluationLifecycleIdentityV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
  attemptId: SpfaEvaluationAttemptIdV2;
  attemptCount: number;
  startedAt: string;
}>;

export type SpfaEvaluatingLifecycleV2 = Readonly<
  SpfaEvaluationLifecycleIdentityV2 & {
    status: 'EVALUATING';
    leaseExpiresAt: string;
    completedAt?: never;
    failedAt?: never;
    failureCode?: never;
    completedPayload?: never;
  }
>;

export type SpfaCompletedLifecycleV2 = Readonly<
  SpfaEvaluationLifecycleIdentityV2 & {
    status: 'COMPLETED';
    completedAt: string;
    completedPayload: SpfaCompletedEvaluationPayloadV2;
    leaseExpiresAt?: never;
    failedAt?: never;
    failureCode?: never;
  }
>;

export type SpfaFailedLifecycleV2 = Readonly<
  SpfaEvaluationLifecycleIdentityV2 & {
    status: 'FAILED';
    failedAt: string;
    failureCode: SpfaEvaluationFailureCodeV2;
    leaseExpiresAt?: never;
    completedAt?: never;
    completedPayload?: never;
  }
>;

export type SpfaEvaluationLifecycleV2 =
  | SpfaEvaluatingLifecycleV2
  | SpfaCompletedLifecycleV2
  | SpfaFailedLifecycleV2;

/** Context required to validate the protected payload of COMPLETED records. */
export type SpfaEvaluationLifecycleCompletionValidationContextV2 = Readonly<{
  evaluationContext: SpfaSessionEvaluationValidationContextV2;
  scoringContext: SpfaScoringContextV2;
  scoringPolicy: SpfaScoringPolicyV2;
}>;

/** Server-owned attestations that G2/G3 must guarantee atomically at first claim. */
export type SpfaEvaluationFreezePreconditionsV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
  sessionOwnership: 'VERIFIED';
  sessionStatus: 'active';
  caseVersionPinned: true;
  transcriptSnapshotCanonical: true;
  messageWritesSerialized: true;
  finishSessionAtomically: true;
}>;

export type SpfaEvaluationRetryPolicyV2 = Readonly<{
  allowFailedRetry: boolean;
}>;

export type SpfaEvaluationClaimDecisionV2 =
  | Readonly<{ decision: 'CLAIM_NEW'; nextAttemptCount: 1 }>
  | Readonly<{
      decision: 'IN_PROGRESS';
      currentAttemptId: SpfaEvaluationAttemptIdV2;
      leaseExpiresAt: string;
    }>
  | Readonly<{
      decision: 'RETURN_COMPLETED';
      completedPayload: SpfaCompletedEvaluationPayloadV2;
    }>
  | Readonly<{
      decision: 'RECOVER_EXPIRED';
      previousAttemptId: SpfaEvaluationAttemptIdV2;
      nextAttemptCount: number;
    }>
  | Readonly<{
      decision: 'RETRY_FAILED';
      previousAttemptId: SpfaEvaluationAttemptIdV2;
      nextAttemptCount: number;
    }>
  | Readonly<{ decision: 'REJECT'; reason: 'FAILED_RETRY_DISABLED' }>;
