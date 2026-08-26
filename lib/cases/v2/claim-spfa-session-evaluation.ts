import { randomUUID } from 'node:crypto';

import { buildSpfaScoringContextV2 } from './build-spfa-scoring-context';
import { resolveSessionSpfaClinicalContentV2 } from './resolve-session-clinical-content';
import { SessionClinicalContentErrorV2 } from './session-clinical-content-types';
import {
  assertSpfaEvaluationLifecycleTransitionV2,
  decideSpfaEvaluationClaimV2,
} from './spfa-evaluation-lifecycle';
import type {
  SpfaCompletedEvaluationPayloadV2,
  SpfaEvaluationAttemptIdV2,
  SpfaEvaluationLifecycleV2,
  SpfaEvaluationSnapshotIdentityV2,
} from './spfa-evaluation-lifecycle-types';
import {
  finishSpfaEvaluationSessionV2,
  hasLegacyEvaluationV2,
  insertSpfaEvaluationClaimV2,
  lockOwnedSpfaSessionV2,
  restartSpfaEvaluationAttemptV2,
  selectSpfaEvaluationRecordForUpdateV2,
  selectSpfaTranscriptMessageRowsV2,
  withSpfaEvaluationPersistenceTransactionV2,
} from './spfa-evaluation-persistence-runtime';
import type {
  LockedSpfaSessionRowV2,
  SpfaEvaluationPersistenceClientV2,
  SpfaEvaluationPersistenceDatabaseV2,
} from './spfa-evaluation-persistence-runtime';
import { SPFA_SCORING_POLICY_V2_2026_1 } from './spfa-scoring-policy-v2';
import type { SpfaScoringPolicyV2 } from './spfa-scoring-policy-types';
import type { SessionTranscriptSnapshotV2 } from './spfa-session-evidence-types';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from './spfa-protocol-set-types';
import {
  createSessionTranscriptSnapshotV2,
  validateSessionTranscriptSnapshotV2,
} from './spfa-session-transcript';
import type { CaseVersionId } from './types';
import {
  validateSpfaEvaluationAttemptIdV2,
  validateSpfaEvaluationFreezePreconditionsV2,
  validateSpfaEvaluationLifecycleV2,
  validateSpfaEvaluationSnapshotIdentityV2,
  validateSpfaEvaluationTimestampV2,
} from './validate-spfa-evaluation-lifecycle';
import { validateSpfaScoringPolicyV2 } from './validate-spfa-scoring-policy';
import { validateSpfaSessionEvaluationV2 } from './validate-spfa-session-evaluation';
import { validateCaseVersionId } from './validate-patient-facts';

export const SPFA_EVALUATION_LEASE_MS_V2 = 30 * 60 * 1000;

export type ClaimSpfaSessionEvaluationInputV2 = Readonly<{
  authenticatedUserId: number;
  sessionId: string;
}>;

type ClaimedResultV2 = Readonly<{
  sessionId: string;
  snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
  attemptId: SpfaEvaluationAttemptIdV2;
  attemptCount: number;
  leaseExpiresAt: string;
  transcriptSnapshot: SessionTranscriptSnapshotV2;
  scoringPolicySnapshot: SpfaScoringPolicyV2;
}>;

export type SpfaEvaluationClaimResultV2 =
  | Readonly<ClaimedResultV2 & { outcome: 'CLAIMED_NEW' }>
  | Readonly<ClaimedResultV2 & { outcome: 'RECOVERED_EXPIRED' }>
  | Readonly<ClaimedResultV2 & { outcome: 'RETRIED_FAILED' }>
  | Readonly<{
      outcome: 'IN_PROGRESS';
      sessionId: string;
      snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
      attemptId: SpfaEvaluationAttemptIdV2;
      attemptCount: number;
      leaseExpiresAt: string;
    }>
  | Readonly<{
      outcome: 'COMPLETED';
      sessionId: string;
      snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
      completedPayload: SpfaCompletedEvaluationPayloadV2;
    }>;

export type SpfaEvaluationClaimErrorCodeV2 =
  | 'invalid_input'
  | 'session_not_found_or_forbidden'
  | 'invalid_session_anchor'
  | 'invalid_session_state'
  | 'spfa_evaluation_not_available'
  | 'legacy_evaluation_exists'
  | 'invalid_session_transcript'
  | 'invalid_persisted_evaluation'
  | 'invalid_server_configuration'
  | 'evaluation_claim_write_failed'
  | 'evaluation_claim_failed';

export class SpfaEvaluationClaimErrorV2 extends Error {
  constructor(
    public readonly code: SpfaEvaluationClaimErrorCodeV2,
    public readonly path: string,
  ) {
    super(code);
    this.name = 'SpfaEvaluationClaimErrorV2';
  }
}

export type SpfaEvaluationClaimDependenciesV2 = Readonly<{
  database?: SpfaEvaluationPersistenceDatabaseV2;
  now?: () => unknown;
  attemptId?: () => unknown;
  leaseDurationMs?: number;
  scoringPolicy?: unknown;
}>;

type ValidatedInput = Readonly<{
  authenticatedUserId: number;
  sessionId: string;
}>;

type SessionAnchor = Readonly<{
  sessionId: string;
  userId: number;
  caseId: number;
  caseVersionId: CaseVersionId;
  sessionStatus: 'active' | 'finished';
  sourceKind: unknown;
  legacyStatus: unknown;
  contentFormat: unknown;
  content: unknown;
}>;

type ExistingRecord = Readonly<{
  lifecycle: SpfaEvaluationLifecycleV2;
  transcript: SessionTranscriptSnapshotV2;
  policy: SpfaScoringPolicyV2;
}>;

const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const POSITIVE_BIGINT_TEXT_PATTERN = /^[1-9]\d*$/;

function fail(code: SpfaEvaluationClaimErrorCodeV2, path: string): never {
  throw new SpfaEvaluationClaimErrorV2(code, path);
}

function record(value: unknown, code: SpfaEvaluationClaimErrorCodeV2, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(code, path);
  return value as Record<string, unknown>;
}

function exactKeys(source: Record<string, unknown>, keys: readonly string[], path: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(source)) if (!allowed.has(key)) fail('invalid_input', `${path}.${key}`);
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(source, key)) fail('invalid_input', `${path}.${key}`);
}

function validateInput(value: ClaimSpfaSessionEvaluationInputV2): ValidatedInput {
  const source = record(value, 'invalid_input', 'input');
  exactKeys(source, ['authenticatedUserId', 'sessionId'], 'input');
  if (!Number.isSafeInteger(source.authenticatedUserId) || (source.authenticatedUserId as number) <= 0) {
    fail('invalid_input', 'authenticatedUserId');
  }
  if (typeof source.sessionId !== 'string' || !SESSION_UUID_PATTERN.test(source.sessionId)) {
    fail('invalid_input', 'sessionId');
  }
  return {
    authenticatedUserId: source.authenticatedUserId as number,
    sessionId: source.sessionId,
  };
}

function positiveBigint(value: unknown, path: string): number {
  if (typeof value !== 'string' || !POSITIVE_BIGINT_TEXT_PATTERN.test(value)) fail('invalid_session_anchor', path);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) fail('invalid_session_anchor', path);
  return parsed;
}

function caseVersionId(value: unknown, path: string): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch {
    return fail('invalid_session_anchor', path);
  }
}

function parseAnchor(rows: readonly unknown[], input: ValidatedInput): SessionAnchor {
  if (rows.length === 0) fail('session_not_found_or_forbidden', 'session');
  if (rows.length !== 1) fail('invalid_session_anchor', 'session.rows');
  const row = record(
    rows[0],
    'invalid_session_anchor',
    'session.row',
  ) as unknown as LockedSpfaSessionRowV2;
  if (row.session_id !== input.sessionId) fail('invalid_session_anchor', 'session.id');
  const userId = positiveBigint(row.session_user_id, 'session.userId');
  if (userId !== input.authenticatedUserId) fail('invalid_session_anchor', 'session.userId');
  const caseId = positiveBigint(row.session_case_id, 'session.caseId');
  const versionCaseId = positiveBigint(row.version_case_id, 'caseVersion.caseId');
  if (caseId !== versionCaseId) fail('invalid_session_anchor', 'caseVersion.caseId');
  const pinnedVersion = caseVersionId(row.session_case_version_id, 'session.caseVersionId');
  if (row.version_id !== pinnedVersion) fail('invalid_session_anchor', 'caseVersion.id');
  if (row.version_status !== 'PUBLISHED' && row.version_status !== 'ARCHIVED') {
    fail('invalid_session_anchor', 'caseVersion.status');
  }
  if (row.session_status !== 'active' && row.session_status !== 'finished') {
    fail('invalid_session_anchor', 'session.status');
  }
  return {
    sessionId: input.sessionId,
    userId,
    caseId,
    caseVersionId: pinnedVersion,
    sessionStatus: row.session_status,
    sourceKind: row.version_source_kind,
    legacyStatus: row.version_legacy_status,
    contentFormat: row.version_content_format,
    content: row.version_content,
  };
}

function resolveCore(anchor: SessionAnchor): SpfaIntegratedGeneratedCaseCoreV2 {
  try {
    return resolveSessionSpfaClinicalContentV2({
      caseId: anchor.caseId,
      caseVersionId: anchor.caseVersionId,
      sourceKind: anchor.sourceKind,
      legacyStatus: anchor.legacyStatus,
      contentFormat: anchor.contentFormat,
      content: anchor.content,
    });
  } catch (error) {
    if (error instanceof SessionClinicalContentErrorV2 && error.code === 'spfa_evaluation_not_available') {
      fail('spfa_evaluation_not_available', 'caseVersion.contentFormat');
    }
    fail('spfa_evaluation_not_available', 'caseVersion.content');
  }
}

function timestamp(value: unknown, path: string): string {
  const candidate = value instanceof Date ? value.toISOString() : value;
  try {
    return validateSpfaEvaluationTimestampV2(candidate, path);
  } catch {
    return fail('invalid_persisted_evaluation', path);
  }
}

function attemptCount(value: unknown): number {
  if (typeof value !== 'string' || !POSITIVE_BIGINT_TEXT_PATTERN.test(value)) {
    fail('invalid_persisted_evaluation', 'evaluation.attemptCount');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) fail('invalid_persisted_evaluation', 'evaluation.attemptCount');
  return parsed;
}

function sameRef(left: Readonly<{ id: string; version: string }>, right: Readonly<{ id: string; version: string }>): boolean {
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

function parseExistingRecord(
  rows: readonly unknown[],
  anchor: SessionAnchor,
  core: SpfaIntegratedGeneratedCaseCoreV2,
): ExistingRecord | null {
  if (rows.length === 0) return null;
  if (rows.length !== 1) fail('invalid_persisted_evaluation', 'evaluation.rows');
  const row = record(rows[0], 'invalid_persisted_evaluation', 'evaluation.row');
  if (row.result_format !== 'SPFA_SESSION_EVALUATION_V2') fail('invalid_persisted_evaluation', 'evaluation.resultFormat');
  let transcript: SessionTranscriptSnapshotV2;
  let policy: SpfaScoringPolicyV2;
  let snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
  try {
    transcript = validateSessionTranscriptSnapshotV2(row.transcript_snapshot, 'evaluation.transcriptSnapshot');
    policy = validateSpfaScoringPolicyV2(row.scoring_policy_snapshot);
    snapshotIdentity = validateSpfaEvaluationSnapshotIdentityV2({
      sessionId: row.session_id,
      caseVersionId: row.case_version_id,
      protocolCatalogRef: {
        id: row.protocol_catalog_id,
        version: row.protocol_catalog_version,
      },
      transcriptFingerprint: {
        algorithm: row.transcript_fingerprint_algorithm,
        canonicalization: row.transcript_fingerprint_canonicalization,
        value: row.transcript_fingerprint_value,
      },
      scoringPolicyRef: {
        id: row.scoring_policy_id,
        version: row.scoring_policy_version,
      },
    });
  } catch {
    return fail('invalid_persisted_evaluation', 'evaluation.snapshot');
  }
  if (
    snapshotIdentity.sessionId !== anchor.sessionId ||
    snapshotIdentity.caseVersionId !== anchor.caseVersionId ||
    transcript.sessionId !== anchor.sessionId ||
    transcript.caseVersionId !== anchor.caseVersionId ||
    !sameFingerprint(snapshotIdentity.transcriptFingerprint, transcript.fingerprint) ||
    !sameRef(snapshotIdentity.scoringPolicyRef, policy.policyRef) ||
    !sameRef(snapshotIdentity.protocolCatalogRef, core.spfaProtocolSet.catalogRef)
  ) {
    fail('invalid_persisted_evaluation', 'evaluation.snapshotIdentity');
  }

  const common = {
    schemaVersion: '2.0',
    sessionId: anchor.sessionId,
    status: row.status,
    snapshotIdentity,
    attemptId: row.attempt_id,
    attemptCount: attemptCount(row.attempt_count),
    startedAt: timestamp(row.started_at, 'evaluation.startedAt'),
  };
  let lifecycleInput: unknown;
  let completionContext;
  if (row.status === 'EVALUATING') {
    if (
      row.completed_at !== null || row.failed_at !== null || row.failure_code !== null ||
      row.evaluation_result !== null || row.score_result !== null
    ) fail('invalid_persisted_evaluation', 'evaluation.lifecycle');
    lifecycleInput = {
      ...common,
      leaseExpiresAt: timestamp(row.lease_expires_at, 'evaluation.leaseExpiresAt'),
    };
  } else if (row.status === 'FAILED') {
    if (
      row.lease_expires_at !== null || row.completed_at !== null ||
      row.evaluation_result !== null || row.score_result !== null
    ) fail('invalid_persisted_evaluation', 'evaluation.lifecycle');
    lifecycleInput = {
      ...common,
      failedAt: timestamp(row.failed_at, 'evaluation.failedAt'),
      failureCode: row.failure_code,
    };
  } else if (row.status === 'COMPLETED') {
    if (row.lease_expires_at !== null || row.failed_at !== null || row.failure_code !== null) {
      fail('invalid_persisted_evaluation', 'evaluation.lifecycle');
    }
    const evaluationContext = { transcript, spfaProtocolSet: core.spfaProtocolSet };
    let scoringContext;
    try {
      // Build once from the persisted evaluation so the lifecycle validator can
      // independently revalidate both protected completion payloads.
      const parsedEvaluation = validateSpfaSessionEvaluationV2(
        row.evaluation_result,
        evaluationContext,
      );
      scoringContext = buildSpfaScoringContextV2(parsedEvaluation, core.spfaProtocolSet);
    } catch {
      fail('invalid_persisted_evaluation', 'evaluation.completedPayload');
    }
    completionContext = { evaluationContext, scoringContext, scoringPolicy: policy };
    lifecycleInput = {
      ...common,
      completedAt: timestamp(row.completed_at, 'evaluation.completedAt'),
      completedPayload: {
        evaluation: row.evaluation_result,
        score: row.score_result,
      },
    };
  } else {
    fail('invalid_persisted_evaluation', 'evaluation.status');
  }
  try {
    return {
      lifecycle: validateSpfaEvaluationLifecycleV2(lifecycleInput, completionContext),
      transcript,
      policy,
    };
  } catch {
    return fail('invalid_persisted_evaluation', 'evaluation.lifecycle');
  }
}

function parseMessageRows(rows: readonly unknown[], anchor: SessionAnchor): SessionTranscriptSnapshotV2 {
  const messages = rows.map((value, index) => {
    const row = record(value, 'invalid_session_transcript', `messages[${index}]`);
    return {
      messageId: row.message_id,
      role: row.message_role,
      content: row.message_content,
      createdAt: row.message_created_at instanceof Date
        ? row.message_created_at.toISOString()
        : row.message_created_at,
    };
  });
  try {
    return createSessionTranscriptSnapshotV2({
      sessionId: anchor.sessionId,
      caseVersionId: anchor.caseVersionId,
      messages,
    });
  } catch {
    return fail('invalid_session_transcript', 'messages');
  }
}

function serverNow(dependencies: SpfaEvaluationClaimDependenciesV2): string {
  const value = (dependencies.now ?? (() => new Date().toISOString()))();
  try {
    return validateSpfaEvaluationTimestampV2(value, 'now');
  } catch {
    return fail('invalid_server_configuration', 'now');
  }
}

function serverAttemptId(dependencies: SpfaEvaluationClaimDependenciesV2): SpfaEvaluationAttemptIdV2 {
  const value = (dependencies.attemptId ?? (() => `spfa_eval_attempt_${randomUUID()}`))();
  try {
    return validateSpfaEvaluationAttemptIdV2(value, 'attemptId');
  } catch {
    return fail('invalid_server_configuration', 'attemptId');
  }
}

function serverPolicy(dependencies: SpfaEvaluationClaimDependenciesV2): SpfaScoringPolicyV2 {
  try {
    return validateSpfaScoringPolicyV2(
      dependencies.scoringPolicy ?? SPFA_SCORING_POLICY_V2_2026_1,
    );
  } catch {
    return fail('invalid_server_configuration', 'scoringPolicy');
  }
}

function leaseExpiresAt(now: string, dependencies: SpfaEvaluationClaimDependenciesV2): string {
  const duration = dependencies.leaseDurationMs ?? SPFA_EVALUATION_LEASE_MS_V2;
  if (!Number.isSafeInteger(duration) || duration <= 0) {
    fail('invalid_server_configuration', 'leaseDurationMs');
  }
  return new Date(new Date(now).getTime() + duration).toISOString();
}

function claimedResult(
  outcome: 'CLAIMED_NEW' | 'RECOVERED_EXPIRED' | 'RETRIED_FAILED',
  lifecycle: Extract<SpfaEvaluationLifecycleV2, { status: 'EVALUATING' }>,
  transcript: SessionTranscriptSnapshotV2,
  policy: SpfaScoringPolicyV2,
): SpfaEvaluationClaimResultV2 {
  return {
    outcome,
    sessionId: lifecycle.sessionId,
    snapshotIdentity: lifecycle.snapshotIdentity,
    attemptId: lifecycle.attemptId,
    attemptCount: lifecycle.attemptCount,
    leaseExpiresAt: lifecycle.leaseExpiresAt,
    transcriptSnapshot: transcript,
    scoringPolicySnapshot: policy,
  };
}

async function claimWithinTransaction(
  client: SpfaEvaluationPersistenceClientV2,
  input: ValidatedInput,
  dependencies: SpfaEvaluationClaimDependenciesV2,
): Promise<SpfaEvaluationClaimResultV2> {
  const anchor = parseAnchor(
    await lockOwnedSpfaSessionV2(client, input.sessionId, input.authenticatedUserId),
    input,
  );
  const recordRows = await selectSpfaEvaluationRecordForUpdateV2(client, input.sessionId);
  const core = resolveCore(anchor);
  const existing = parseExistingRecord(recordRows, anchor, core);
  const now = serverNow(dependencies);

  if (existing !== null) {
    if (anchor.sessionStatus !== 'finished') fail('invalid_session_state', 'session.status');
    const decision = decideSpfaEvaluationClaimV2(
      existing.lifecycle,
      existing.lifecycle.snapshotIdentity,
      now,
      { allowFailedRetry: true },
    );
    if (decision.decision === 'RETURN_COMPLETED') {
      return {
        outcome: 'COMPLETED',
        sessionId: anchor.sessionId,
        snapshotIdentity: existing.lifecycle.snapshotIdentity,
        completedPayload: decision.completedPayload,
      };
    }
    if (decision.decision === 'IN_PROGRESS') {
      return {
        outcome: 'IN_PROGRESS',
        sessionId: anchor.sessionId,
        snapshotIdentity: existing.lifecycle.snapshotIdentity,
        attemptId: decision.currentAttemptId,
        attemptCount: existing.lifecycle.attemptCount,
        leaseExpiresAt: decision.leaseExpiresAt,
      };
    }
    if (decision.decision === 'REJECT' || decision.decision === 'CLAIM_NEW') {
      fail('invalid_persisted_evaluation', 'evaluation.lifecycle');
    }
    const next = validateSpfaEvaluationLifecycleV2({
      schemaVersion: '2.0',
      sessionId: anchor.sessionId,
      status: 'EVALUATING',
      snapshotIdentity: existing.lifecycle.snapshotIdentity,
      attemptId: serverAttemptId(dependencies),
      attemptCount: decision.nextAttemptCount,
      startedAt: now,
      leaseExpiresAt: leaseExpiresAt(now, dependencies),
    });
    if (next.status !== 'EVALUATING') {
      fail('invalid_persisted_evaluation', 'evaluation.nextLifecycle');
    }
    assertSpfaEvaluationLifecycleTransitionV2(
      existing.lifecycle,
      next,
      now,
      { allowFailedRetry: true },
    );
    const rowCount = await restartSpfaEvaluationAttemptV2(client, [
      anchor.sessionId,
      existing.lifecycle.status,
      decision.previousAttemptId,
      existing.lifecycle.attemptCount,
      next.attemptId,
      next.attemptCount,
      next.leaseExpiresAt,
      next.startedAt,
    ]);
    if (rowCount !== 1) fail('evaluation_claim_write_failed', 'evaluation.restart');
    return claimedResult(
      decision.decision === 'RECOVER_EXPIRED' ? 'RECOVERED_EXPIRED' : 'RETRIED_FAILED',
      next,
      existing.transcript,
      existing.policy,
    );
  }

  if (anchor.sessionStatus !== 'active') fail('invalid_session_state', 'session.status');
  if (await hasLegacyEvaluationV2(client, anchor.sessionId)) {
    fail('legacy_evaluation_exists', 'evaluation.format');
  }
  const transcript = parseMessageRows(
    await selectSpfaTranscriptMessageRowsV2(client, anchor.sessionId),
    anchor,
  );
  const policy = serverPolicy(dependencies);
  const snapshotIdentity = validateSpfaEvaluationSnapshotIdentityV2({
    sessionId: anchor.sessionId,
    caseVersionId: anchor.caseVersionId,
    protocolCatalogRef: core.spfaProtocolSet.catalogRef,
    transcriptFingerprint: transcript.fingerprint,
    scoringPolicyRef: policy.policyRef,
  });
  validateSpfaEvaluationFreezePreconditionsV2({
    schemaVersion: '2.0',
    sessionId: anchor.sessionId,
    snapshotIdentity,
    sessionOwnership: 'VERIFIED',
    sessionStatus: 'active',
    caseVersionPinned: true,
    transcriptSnapshotCanonical: true,
    messageWritesSerialized: true,
    finishSessionAtomically: true,
  });
  const decision = decideSpfaEvaluationClaimV2(null, snapshotIdentity, now, {
    allowFailedRetry: true,
  });
  if (decision.decision !== 'CLAIM_NEW') fail('evaluation_claim_failed', 'evaluation.decision');
  const lifecycle = validateSpfaEvaluationLifecycleV2({
    schemaVersion: '2.0',
    sessionId: anchor.sessionId,
    status: 'EVALUATING',
    snapshotIdentity,
    attemptId: serverAttemptId(dependencies),
    attemptCount: decision.nextAttemptCount,
    startedAt: now,
    leaseExpiresAt: leaseExpiresAt(now, dependencies),
  });
  if (lifecycle.status !== 'EVALUATING') {
    fail('evaluation_claim_failed', 'evaluation.lifecycle');
  }
  assertSpfaEvaluationLifecycleTransitionV2(
    null,
    lifecycle,
    now,
    { allowFailedRetry: true },
  );
  const inserted = await insertSpfaEvaluationClaimV2(client, [
    anchor.sessionId,
    anchor.caseVersionId,
    snapshotIdentity.protocolCatalogRef.id,
    snapshotIdentity.protocolCatalogRef.version,
    snapshotIdentity.scoringPolicyRef.id,
    snapshotIdentity.scoringPolicyRef.version,
    snapshotIdentity.transcriptFingerprint.algorithm,
    snapshotIdentity.transcriptFingerprint.canonicalization,
    snapshotIdentity.transcriptFingerprint.value,
    transcript,
    policy,
    lifecycle.attemptId,
    lifecycle.leaseExpiresAt,
    lifecycle.startedAt,
  ]);
  if (inserted !== 1) fail('evaluation_claim_write_failed', 'evaluation.insert');
  const finished = await finishSpfaEvaluationSessionV2(client, [
    anchor.sessionId,
    anchor.userId,
    anchor.caseVersionId,
    now,
  ]);
  if (finished !== 1) fail('evaluation_claim_write_failed', 'session.finish');
  return claimedResult('CLAIMED_NEW', lifecycle, transcript, policy);
}

export async function claimSpfaSessionEvaluationV2(
  input: ClaimSpfaSessionEvaluationInputV2,
  dependencies: SpfaEvaluationClaimDependenciesV2 = {},
): Promise<SpfaEvaluationClaimResultV2> {
  const validated = validateInput(input);
  try {
    return await withSpfaEvaluationPersistenceTransactionV2(
      (client) => claimWithinTransaction(client, validated, dependencies),
      dependencies.database,
    );
  } catch (error) {
    if (error instanceof SpfaEvaluationClaimErrorV2) throw error;
    throw new SpfaEvaluationClaimErrorV2('evaluation_claim_failed', 'claim');
  }
}
