import { buildSpfaScoringContextV2 } from './build-spfa-scoring-context';
import type {
  SpfaEvaluationClaimResultV2,
} from './claim-spfa-session-evaluation';
import { claimSpfaSessionEvaluationV2 } from './claim-spfa-session-evaluation';
import {
  evaluateSpfaSessionV2,
  SpfaSessionEvaluationOrchestrationError,
  type AdjudicateSpfaRequirementV2,
} from './evaluate-spfa-session';
import {
  OpenAiSpfaSemanticAdjudicationExecutionErrorV1,
} from './execute-openai-spfa-semantic-adjudication';
import {
  createOpenAiSpfaSemanticAdjudicationRuntimeV2,
  OpenAiSpfaSemanticAdjudicationRuntimeErrorV2,
} from './openai-spfa-semantic-adjudication-runtime';
import { resolveSessionSpfaClinicalContentV2 } from './resolve-session-clinical-content';
import { scoreSpfaSessionV2 } from './score-spfa-session';
import type {
  SpfaCompletedEvaluationPayloadV2,
  SpfaEvaluationFailureCodeV2,
  SpfaEvaluationSnapshotIdentityV2,
} from './spfa-evaluation-lifecycle-types';
import {
  completeSpfaEvaluationAttemptV2,
  failSpfaEvaluationAttemptV2,
  loadFrozenSpfaCaseVersionV2,
  SpfaEvaluationPersistenceRuntimeErrorV2,
  type SpfaEvaluationAttemptMutationResultV2,
  type SpfaEvaluationAttemptOwnerV2,
} from './spfa-evaluation-persistence-runtime';
import type { SpfaScoringContextV2 } from './spfa-scoring-context-types';
import type { SpfaScoringPolicyV2 } from './spfa-scoring-policy-types';
import type { SpfaSessionEvaluationV2 } from './spfa-session-evaluation-types';
import type { SpfaSessionScoreV2 } from './spfa-session-score-types';
import type { SessionTranscriptSnapshotV2 } from './spfa-session-evidence-types';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from './spfa-protocol-set-types';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';
import {
  validateSpfaEvaluationSnapshotIdentityV2,
  validateSpfaEvaluationTimestampV2,
} from './validate-spfa-evaluation-lifecycle';
import { validateSpfaScoringContextV2 } from './validate-spfa-scoring-context';
import { validateSpfaScoringPolicyV2 } from './validate-spfa-scoring-policy';
import { validateSpfaSessionEvaluationV2 } from './validate-spfa-session-evaluation';
import { validateSpfaSessionScoreV2 } from './validate-spfa-session-score';

export type FinalizeOwnedSpfaSessionEvaluationInputV2 = Readonly<{
  authenticatedUserId: number;
  sessionId: string;
}>;

export type SpfaEvaluationFinalizationResultV2 =
  | Readonly<{
      outcome: 'COMPLETED';
      sessionId: string;
      snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
      evaluation: SpfaSessionEvaluationV2;
      score: SpfaSessionScoreV2;
    }>
  | Readonly<{
      outcome: 'IN_PROGRESS';
      sessionId: string;
      snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
      attemptId: SpfaEvaluationAttemptOwnerV2['attemptId'];
      attemptCount: number;
      leaseExpiresAt: string;
    }>
  | Readonly<{
      outcome: 'FAILED';
      sessionId: string;
      snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
      attemptId: SpfaEvaluationAttemptOwnerV2['attemptId'];
      attemptCount: number;
      failureCode: SpfaEvaluationFailureCodeV2;
    }>;

export type SpfaEvaluationFinalizationErrorCodeV2 =
  | 'snapshot_drift'
  | 'attempt_superseded'
  | 'invalid_completed_result'
  | 'completion_persistence_failed'
  | 'failure_persistence_failed';

export class SpfaEvaluationFinalizationErrorV2 extends Error {
  constructor(
    public readonly code: SpfaEvaluationFinalizationErrorCodeV2,
    public readonly path: string,
  ) {
    super(code);
    this.name = 'SpfaEvaluationFinalizationErrorV2';
  }
}

type ClaimedWork = Extract<
  SpfaEvaluationClaimResultV2,
  {
    outcome:
      | 'CLAIMED_NEW'
      | 'RECOVERED_EXPIRED'
      | 'RETRIED_FAILED';
  }
>;

type ResolveFrozenCoreV2 = (
  input: FinalizeOwnedSpfaSessionEvaluationInputV2 & {
    snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
  },
) => Promise<SpfaIntegratedGeneratedCaseCoreV2>;

export type FinalizeSpfaSessionEvaluationDependenciesV2 = Readonly<{
  claim: typeof claimSpfaSessionEvaluationV2;
  resolveFrozenCore: ResolveFrozenCoreV2;
  createAdjudicationRuntime:
    typeof createOpenAiSpfaSemanticAdjudicationRuntimeV2;
  evaluateSession: typeof evaluateSpfaSessionV2;
  buildScoringContext: typeof buildSpfaScoringContextV2;
  scoreSession: typeof scoreSpfaSessionV2;
  completeAttempt: typeof completeSpfaEvaluationAttemptV2;
  failAttempt: typeof failSpfaEvaluationAttemptV2;
  now: () => unknown;
}>;

class SnapshotDriftError extends Error {
  constructor(public readonly path: string) {
    super(path);
    this.name = 'SnapshotDriftError';
  }
}

function sameVersionRef(
  left: Readonly<{ id: string; version: string }>,
  right: Readonly<{ id: string; version: string }>,
): boolean {
  return left.id === right.id && left.version === right.version;
}

function sameFingerprint(
  left: SessionTranscriptSnapshotV2['fingerprint'],
  right: SessionTranscriptSnapshotV2['fingerprint'],
): boolean {
  return left.algorithm === right.algorithm &&
    left.canonicalization === right.canonicalization &&
    left.value === right.value;
}

function materiallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => materiallyEqual(item, right[index]));
  }
  if (
    typeof left !== 'object' || left === null ||
    typeof right !== 'object' || right === null
  ) return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return leftKeys.length === rightKeys.length && leftKeys.every(
    (key, index) => key === rightKeys[index] &&
      materiallyEqual(leftRecord[key], rightRecord[key]),
  );
}

async function defaultResolveFrozenCore(
  input: FinalizeOwnedSpfaSessionEvaluationInputV2 & {
    snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
  },
): Promise<SpfaIntegratedGeneratedCaseCoreV2> {
  const record = await loadFrozenSpfaCaseVersionV2({
    authenticatedUserId: input.authenticatedUserId,
    sessionId: input.sessionId,
    caseVersionId: input.snapshotIdentity.caseVersionId,
  });
  try {
    return resolveSessionSpfaClinicalContentV2({
      caseId: record.caseId,
      caseVersionId: record.caseVersionId,
      sourceKind: record.sourceKind,
      legacyStatus: record.legacyStatus,
      contentFormat: record.contentFormat,
      content: record.content,
    });
  } catch {
    throw new SnapshotDriftError('caseVersion.content');
  }
}

const DEFAULT_DEPENDENCIES: FinalizeSpfaSessionEvaluationDependenciesV2 =
  Object.freeze({
    claim: claimSpfaSessionEvaluationV2,
    resolveFrozenCore: defaultResolveFrozenCore,
    createAdjudicationRuntime:
      createOpenAiSpfaSemanticAdjudicationRuntimeV2,
    evaluateSession: evaluateSpfaSessionV2,
    buildScoringContext: buildSpfaScoringContextV2,
    scoreSession: scoreSpfaSessionV2,
    completeAttempt: completeSpfaEvaluationAttemptV2,
    failAttempt: failSpfaEvaluationAttemptV2,
    now: () => new Date().toISOString(),
  });

function canonicalNow(dependencies: FinalizeSpfaSessionEvaluationDependenciesV2): string {
  try {
    return validateSpfaEvaluationTimestampV2(dependencies.now(), 'now');
  } catch {
    throw new SpfaEvaluationFinalizationErrorV2(
      'failure_persistence_failed',
      'now',
    );
  }
}

function validateFrozenInputs(
  claim: ClaimedWork,
  core: SpfaIntegratedGeneratedCaseCoreV2,
): Readonly<{
  transcript: SessionTranscriptSnapshotV2;
  policy: SpfaScoringPolicyV2;
  snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
}> {
  let transcript: SessionTranscriptSnapshotV2;
  let policy: SpfaScoringPolicyV2;
  let snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
  try {
    transcript = validateSessionTranscriptSnapshotV2(claim.transcriptSnapshot);
    policy = validateSpfaScoringPolicyV2(claim.scoringPolicySnapshot);
    snapshotIdentity = validateSpfaEvaluationSnapshotIdentityV2(
      claim.snapshotIdentity,
    );
  } catch {
    throw new SnapshotDriftError('claim.snapshot');
  }
  if (
    transcript.sessionId !== claim.sessionId ||
    transcript.caseVersionId !== snapshotIdentity.caseVersionId ||
    core.caseVersionId !== snapshotIdentity.caseVersionId ||
    !sameFingerprint(transcript.fingerprint, snapshotIdentity.transcriptFingerprint) ||
    !sameVersionRef(policy.policyRef, snapshotIdentity.scoringPolicyRef) ||
    !sameVersionRef(
      core.spfaProtocolSet.catalogRef,
      snapshotIdentity.protocolCatalogRef,
    )
  ) {
    throw new SnapshotDriftError('claim.snapshotIdentity');
  }
  return { transcript, policy, snapshotIdentity };
}

function validateCompletedPayload(
  evaluationValue: unknown,
  scoreValue: unknown,
  transcript: SessionTranscriptSnapshotV2,
  core: SpfaIntegratedGeneratedCaseCoreV2,
  policy: SpfaScoringPolicyV2,
): Readonly<{
  evaluation: SpfaSessionEvaluationV2;
  scoringContext: SpfaScoringContextV2;
  score: SpfaSessionScoreV2;
}> {
  const evaluation = validateSpfaSessionEvaluationV2(
    evaluationValue,
    { transcript, spfaProtocolSet: core.spfaProtocolSet },
  );
  const scoringContext = validateSpfaScoringContextV2(
    buildSpfaScoringContextV2(evaluation, core.spfaProtocolSet),
  );
  const score = validateSpfaSessionScoreV2(
    scoreValue,
    scoringContext,
    policy,
  );
  return { evaluation, scoringContext, score };
}

function completedResult(
  sessionId: string,
  snapshotIdentity: SpfaEvaluationSnapshotIdentityV2,
  payload: SpfaCompletedEvaluationPayloadV2,
): SpfaEvaluationFinalizationResultV2 {
  return {
    outcome: 'COMPLETED',
    sessionId,
    snapshotIdentity,
    evaluation: payload.evaluation,
    score: payload.score,
  };
}

function failureCode(error: unknown): SpfaEvaluationFailureCodeV2 {
  if (error instanceof SnapshotDriftError) return 'SNAPSHOT_DRIFT';
  if (error instanceof OpenAiSpfaSemanticAdjudicationExecutionErrorV1) {
    if (
      error.code === 'openai_spfa_semantic_request_failed' ||
      error.code === 'openai_spfa_semantic_response_failed'
    ) return 'PROVIDER_FAILURE';
    if (error.code === 'invalid_openai_spfa_semantic_execution_config') {
      return 'INTERNAL_FAILURE';
    }
    return 'INVALID_PROVIDER_RESULT';
  }
  if (error instanceof SpfaSessionEvaluationOrchestrationError) {
    return error.code === 'invalid_semantic_execution_receipt'
      ? 'INVALID_PROVIDER_RESULT'
      : 'EVALUATION_FAILURE';
  }
  if (error instanceof OpenAiSpfaSemanticAdjudicationRuntimeErrorV2) {
    return 'INTERNAL_FAILURE';
  }
  if (error instanceof SpfaEvaluationPersistenceRuntimeErrorV2) {
    return error.code === 'snapshot_drift' ||
      error.code === 'invalid_frozen_case_version'
      ? 'SNAPSHOT_DRIFT'
      : 'INTERNAL_FAILURE';
  }
  if (error instanceof Error) return 'EVALUATION_FAILURE';
  return 'INTERNAL_FAILURE';
}

function ownerFromClaim(claim: ClaimedWork): SpfaEvaluationAttemptOwnerV2 {
  return {
    sessionId: claim.sessionId,
    attemptId: claim.attemptId,
    attemptCount: claim.attemptCount,
    snapshotIdentity: claim.snapshotIdentity,
  };
}

function inProgressResult(
  claim: Extract<SpfaEvaluationClaimResultV2, { outcome: 'IN_PROGRESS' }>,
): SpfaEvaluationFinalizationResultV2 {
  return {
    outcome: 'IN_PROGRESS',
    sessionId: claim.sessionId,
    snapshotIdentity: claim.snapshotIdentity,
    attemptId: claim.attemptId,
    attemptCount: claim.attemptCount,
    leaseExpiresAt: claim.leaseExpiresAt,
  };
}

function validateAlreadyCompleted(
  mutation: Extract<
    SpfaEvaluationAttemptMutationResultV2,
    { outcome: 'ALREADY_COMPLETED' }
  >,
  claim: ClaimedWork,
  transcript: SessionTranscriptSnapshotV2,
  core: SpfaIntegratedGeneratedCaseCoreV2,
  policy: SpfaScoringPolicyV2,
  expected?: SpfaCompletedEvaluationPayloadV2,
): SpfaEvaluationFinalizationResultV2 {
  let completed;
  try {
    completed = validateCompletedPayload(
      mutation.evaluationResult,
      mutation.scoreResult,
      transcript,
      core,
      policy,
    );
  } catch {
    throw new SpfaEvaluationFinalizationErrorV2(
      'invalid_completed_result',
      'evaluation.completedPayload',
    );
  }
  if (
    expected !== undefined &&
    (!materiallyEqual(completed.evaluation, expected.evaluation) ||
      !materiallyEqual(completed.score, expected.score))
  ) {
    throw new SpfaEvaluationFinalizationErrorV2(
      'invalid_completed_result',
      'evaluation.completedPayload',
    );
  }
  return completedResult(claim.sessionId, claim.snapshotIdentity, {
    evaluation: completed.evaluation,
    score: completed.score,
  });
}

async function persistFailure(
  claim: ClaimedWork,
  code: SpfaEvaluationFailureCodeV2,
  transcript: SessionTranscriptSnapshotV2 | undefined,
  core: SpfaIntegratedGeneratedCaseCoreV2 | undefined,
  policy: SpfaScoringPolicyV2 | undefined,
  dependencies: FinalizeSpfaSessionEvaluationDependenciesV2,
): Promise<SpfaEvaluationFinalizationResultV2> {
  let mutation: SpfaEvaluationAttemptMutationResultV2;
  try {
    mutation = await dependencies.failAttempt(
      ownerFromClaim(claim),
      canonicalNow(dependencies),
      code,
    );
  } catch {
    throw new SpfaEvaluationFinalizationErrorV2(
      'failure_persistence_failed',
      'evaluation.failure',
    );
  }
  if (mutation.outcome === 'SUPERSEDED') {
    throw new SpfaEvaluationFinalizationErrorV2(
      'attempt_superseded',
      'evaluation.attempt',
    );
  }
  if (mutation.outcome === 'ALREADY_COMPLETED') {
    if (transcript === undefined || core === undefined || policy === undefined) {
      throw new SpfaEvaluationFinalizationErrorV2(
        'invalid_completed_result',
        'evaluation.completedPayload',
      );
    }
    return validateAlreadyCompleted(
      mutation,
      claim,
      transcript,
      core,
      policy,
    );
  }
  return {
    outcome: 'FAILED',
    sessionId: claim.sessionId,
    snapshotIdentity: claim.snapshotIdentity,
    attemptId: claim.attemptId,
    attemptCount: claim.attemptCount,
    failureCode: code,
  };
}

export async function finalizeOwnedSpfaSessionEvaluationV2(
  input: FinalizeOwnedSpfaSessionEvaluationInputV2,
  dependencies: FinalizeSpfaSessionEvaluationDependenciesV2 =
    DEFAULT_DEPENDENCIES,
): Promise<SpfaEvaluationFinalizationResultV2> {
  const claim = await dependencies.claim(input);
  if (claim.outcome === 'COMPLETED') {
    return completedResult(
      claim.sessionId,
      claim.snapshotIdentity,
      claim.completedPayload,
    );
  }
  if (claim.outcome === 'IN_PROGRESS') return inProgressResult(claim);

  let transcript: SessionTranscriptSnapshotV2 | undefined;
  let policy: SpfaScoringPolicyV2 | undefined;
  let core: SpfaIntegratedGeneratedCaseCoreV2 | undefined;
  try {
    core = await dependencies.resolveFrozenCore({
      authenticatedUserId: input.authenticatedUserId,
      sessionId: input.sessionId,
      snapshotIdentity: claim.snapshotIdentity,
    });
    const frozen = validateFrozenInputs(claim, core);
    transcript = frozen.transcript;
    policy = frozen.policy;

    let adjudicationRuntime:
      | ReturnType<typeof createOpenAiSpfaSemanticAdjudicationRuntimeV2>
      | undefined;
    const adjudicate: AdjudicateSpfaRequirementV2 = (semanticInput) => {
      adjudicationRuntime ??= dependencies.createAdjudicationRuntime();
      return adjudicationRuntime.adjudicate(semanticInput);
    };
    const evaluation = validateSpfaSessionEvaluationV2(
      await dependencies.evaluateSession(
        { transcript, core },
        { adjudicate },
      ),
      { transcript, spfaProtocolSet: core.spfaProtocolSet },
    );
    const scoringContext = validateSpfaScoringContextV2(
      dependencies.buildScoringContext(
        evaluation,
        core.spfaProtocolSet,
      ),
    );
    const score = validateSpfaSessionScoreV2(
      dependencies.scoreSession(scoringContext, policy),
      scoringContext,
      policy,
    );
    const payload: SpfaCompletedEvaluationPayloadV2 = { evaluation, score };

    let mutation: SpfaEvaluationAttemptMutationResultV2;
    try {
      mutation = await dependencies.completeAttempt(
        ownerFromClaim(claim),
        canonicalNow(dependencies),
        evaluation,
        score,
      );
    } catch {
      throw new SpfaEvaluationFinalizationErrorV2(
        'completion_persistence_failed',
        'evaluation.completion',
      );
    }
    if (mutation.outcome === 'SUPERSEDED') {
      throw new SpfaEvaluationFinalizationErrorV2(
        'attempt_superseded',
        'evaluation.attempt',
      );
    }
    if (mutation.outcome === 'ALREADY_COMPLETED') {
      return validateAlreadyCompleted(
        mutation,
        claim,
        transcript,
        core,
        policy,
        payload,
      );
    }
    return completedResult(claim.sessionId, frozen.snapshotIdentity, payload);
  } catch (error) {
    if (error instanceof SpfaEvaluationFinalizationErrorV2) throw error;
    return persistFailure(
      claim,
      failureCode(error),
      transcript,
      core,
      policy,
      dependencies,
    );
  }
}
