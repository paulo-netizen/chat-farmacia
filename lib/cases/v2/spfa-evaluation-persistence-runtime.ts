import { pool } from '@/lib/db';

import {
  assertSameSpfaEvaluationSnapshotIdentityV2,
} from './spfa-evaluation-lifecycle';
import type {
  SpfaEvaluationAttemptIdV2,
  SpfaEvaluationFailureCodeV2,
  SpfaEvaluationSnapshotIdentityV2,
} from './spfa-evaluation-lifecycle-types';
import type { CaseVersionId } from './types';
import {
  validateSpfaEvaluationAttemptIdV2,
  validateSpfaEvaluationSnapshotIdentityV2,
} from './validate-spfa-evaluation-lifecycle';
import { validateCaseVersionId } from './validate-patient-facts';

export type SpfaEvaluationPersistenceQueryResultV2 = Readonly<{
  rows: readonly unknown[];
  rowCount: number | null;
}>;

export type SpfaEvaluationPersistenceClientV2 = Readonly<{
  query(
    text: string,
    values?: unknown[],
  ): Promise<SpfaEvaluationPersistenceQueryResultV2>;
  release(): void;
}>;

export type SpfaEvaluationPersistenceDatabaseV2 = Readonly<{
  connect(): Promise<SpfaEvaluationPersistenceClientV2>;
}>;

export type LockedSpfaSessionRowV2 = Readonly<{
  session_id: unknown;
  session_user_id: unknown;
  session_case_id: unknown;
  session_case_version_id: unknown;
  session_status: unknown;
  version_id: unknown;
  version_case_id: unknown;
  version_status: unknown;
  version_source_kind: unknown;
  version_legacy_status: unknown;
  version_content_format: unknown;
  version_content: unknown;
}>;

export type SpfaEvaluationRecordRowV2 = Readonly<Record<string, unknown>>;

export type FrozenSpfaCaseVersionRecordV2 = Readonly<{
  caseId: number;
  caseVersionId: CaseVersionId;
  sourceKind: unknown;
  legacyStatus: unknown;
  contentFormat: unknown;
  content: unknown;
}>;

export type SpfaEvaluationAttemptOwnerV2 = Readonly<{
  sessionId: string;
  attemptId: SpfaEvaluationAttemptIdV2;
  attemptCount: number;
  snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
}>;

export type SpfaEvaluationAttemptMutationResultV2 =
  | Readonly<{ outcome: 'UPDATED' }>
  | Readonly<{ outcome: 'SUPERSEDED' }>
  | Readonly<{
      outcome: 'ALREADY_COMPLETED';
      evaluationResult: unknown;
      scoreResult: unknown;
    }>;

export type SpfaEvaluationPersistenceRuntimeErrorCodeV2 =
  | 'frozen_case_version_not_found_or_forbidden'
  | 'invalid_frozen_case_version'
  | 'evaluation_record_not_found'
  | 'invalid_evaluation_record'
  | 'snapshot_drift'
  | 'attempt_write_failed';

export class SpfaEvaluationPersistenceRuntimeErrorV2 extends Error {
  constructor(
    public readonly code: SpfaEvaluationPersistenceRuntimeErrorCodeV2,
    public readonly path: string,
  ) {
    super(code);
    this.name = 'SpfaEvaluationPersistenceRuntimeErrorV2';
  }
}

const LOCK_OWNED_SESSION_QUERY = `
  SELECT
    s.id AS session_id,
    s.user_id::text AS session_user_id,
    s.case_id::text AS session_case_id,
    s.case_version_id AS session_case_version_id,
    s.status AS session_status,
    cv.id AS version_id,
    cv.case_id::text AS version_case_id,
    cv.status AS version_status,
    cv.source_kind AS version_source_kind,
    cv.legacy_status AS version_legacy_status,
    cv.content_format AS version_content_format,
    cv.content AS version_content
  FROM public.sessions AS s
  INNER JOIN public.case_versions AS cv
    ON cv.id = s.case_version_id
   AND cv.case_id = s.case_id
  WHERE s.id = $1
    AND s.user_id = $2
  FOR UPDATE OF s
`;

const SELECT_EVALUATION_RECORD_QUERY = `
  SELECT
    session_id,
    case_version_id,
    status,
    result_format,
    protocol_catalog_id,
    protocol_catalog_version,
    scoring_policy_id,
    scoring_policy_version,
    transcript_fingerprint_algorithm,
    transcript_fingerprint_canonicalization,
    transcript_fingerprint_value,
    transcript_snapshot,
    scoring_policy_snapshot,
    attempt_id,
    attempt_count::text AS attempt_count,
    lease_expires_at,
    started_at,
    completed_at,
    failed_at,
    failure_code,
    evaluation_result,
    score_result
  FROM public.session_evaluation_records_v2
  WHERE session_id = $1
  FOR UPDATE
`;

const SELECT_LEGACY_EVALUATION_QUERY = `
  SELECT 1
  FROM public.evaluations
  WHERE session_id = $1
`;

const SELECT_TRANSCRIPT_MESSAGES_QUERY = `
  SELECT
    id::text AS message_id,
    role AS message_role,
    content AS message_content,
    created_at AS message_created_at
  FROM public.messages
  WHERE session_id = $1
  ORDER BY created_at ASC, id ASC
`;

const INSERT_EVALUATION_RECORD_QUERY = `
  INSERT INTO public.session_evaluation_records_v2 (
    session_id,
    case_version_id,
    status,
    result_format,
    protocol_catalog_id,
    protocol_catalog_version,
    scoring_policy_id,
    scoring_policy_version,
    transcript_fingerprint_algorithm,
    transcript_fingerprint_canonicalization,
    transcript_fingerprint_value,
    transcript_snapshot,
    scoring_policy_snapshot,
    attempt_id,
    attempt_count,
    lease_expires_at,
    started_at
  ) VALUES (
    $1, $2, 'EVALUATING', 'SPFA_SESSION_EVALUATION_V2',
    $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 1, $13, $14
  )
`;

const FINISH_SESSION_QUERY = `
  UPDATE public.sessions
  SET
    status = 'finished',
    finished_at = $4
  WHERE id = $1
    AND user_id = $2
    AND case_version_id = $3
    AND status = 'active'
`;

const RESTART_EVALUATION_ATTEMPT_QUERY = `
  UPDATE public.session_evaluation_records_v2
  SET
    status = 'EVALUATING',
    attempt_id = $5,
    attempt_count = $6,
    lease_expires_at = $7,
    started_at = $8,
    completed_at = NULL,
    failed_at = NULL,
    failure_code = NULL,
    evaluation_result = NULL,
    score_result = NULL
  WHERE session_id = $1
    AND status = $2
    AND attempt_id = $3
    AND attempt_count = $4
`;

const SELECT_FROZEN_CASE_VERSION_QUERY = `
  SELECT
    cv.id AS case_version_id,
    cv.case_id::text AS case_id,
    cv.source_kind,
    cv.legacy_status,
    cv.content_format,
    cv.content
  FROM public.sessions AS s
  INNER JOIN public.case_versions AS cv
    ON cv.id = s.case_version_id
   AND cv.case_id = s.case_id
  WHERE s.id = $1
    AND s.user_id = $2
    AND cv.id = $3
`;

const COMPLETE_EVALUATION_ATTEMPT_QUERY = `
  UPDATE public.session_evaluation_records_v2
  SET
    status = 'COMPLETED',
    lease_expires_at = NULL,
    completed_at = $4,
    failed_at = NULL,
    failure_code = NULL,
    evaluation_result = $5,
    score_result = $6
  WHERE session_id = $1
    AND status = 'EVALUATING'
    AND attempt_id = $2
    AND attempt_count = $3
    AND case_version_id = $7
    AND protocol_catalog_id = $8
    AND protocol_catalog_version = $9
    AND transcript_fingerprint_algorithm = $10
    AND transcript_fingerprint_canonicalization = $11
    AND transcript_fingerprint_value = $12
    AND scoring_policy_id = $13
    AND scoring_policy_version = $14
`;

const FAIL_EVALUATION_ATTEMPT_QUERY = `
  UPDATE public.session_evaluation_records_v2
  SET
    status = 'FAILED',
    lease_expires_at = NULL,
    completed_at = NULL,
    failed_at = $4,
    failure_code = $5,
    evaluation_result = NULL,
    score_result = NULL
  WHERE session_id = $1
    AND status = 'EVALUATING'
    AND attempt_id = $2
    AND attempt_count = $3
    AND case_version_id = $6
    AND protocol_catalog_id = $7
    AND protocol_catalog_version = $8
    AND transcript_fingerprint_algorithm = $9
    AND transcript_fingerprint_canonicalization = $10
    AND transcript_fingerprint_value = $11
    AND scoring_policy_id = $12
    AND scoring_policy_version = $13
`;

const POSITIVE_BIGINT_TEXT_PATTERN = /^[1-9]\d*$/;

function runtimeFail(
  code: SpfaEvaluationPersistenceRuntimeErrorCodeV2,
  path: string,
): never {
  throw new SpfaEvaluationPersistenceRuntimeErrorV2(code, path);
}

function row(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    runtimeFail('invalid_evaluation_record', path);
  }
  return value as Record<string, unknown>;
}

function positiveSafeIntegerText(value: unknown, path: string): number {
  if (typeof value !== 'string' || !POSITIVE_BIGINT_TEXT_PATTERN.test(value)) {
    runtimeFail('invalid_evaluation_record', path);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    runtimeFail('invalid_evaluation_record', path);
  }
  return parsed;
}

function snapshotFromRow(source: Record<string, unknown>): SpfaEvaluationSnapshotIdentityV2 {
  try {
    return validateSpfaEvaluationSnapshotIdentityV2({
      sessionId: source.session_id,
      caseVersionId: source.case_version_id,
      protocolCatalogRef: {
        id: source.protocol_catalog_id,
        version: source.protocol_catalog_version,
      },
      transcriptFingerprint: {
        algorithm: source.transcript_fingerprint_algorithm,
        canonicalization: source.transcript_fingerprint_canonicalization,
        value: source.transcript_fingerprint_value,
      },
      scoringPolicyRef: {
        id: source.scoring_policy_id,
        version: source.scoring_policy_version,
      },
    });
  } catch {
    return runtimeFail('invalid_evaluation_record', 'evaluation.snapshotIdentity');
  }
}

function inspectAttempt(
  rows: readonly unknown[],
  owner: SpfaEvaluationAttemptOwnerV2,
):
  | Readonly<{ outcome: 'OWNED' }>
  | Exclude<SpfaEvaluationAttemptMutationResultV2, { outcome: 'UPDATED' }> {
  if (rows.length === 0) runtimeFail('evaluation_record_not_found', 'evaluation');
  if (rows.length !== 1) runtimeFail('invalid_evaluation_record', 'evaluation.rows');
  const source = row(rows[0], 'evaluation.row');
  const persistedSnapshot = snapshotFromRow(source);
  try {
    assertSameSpfaEvaluationSnapshotIdentityV2(
      owner.snapshotIdentity,
      persistedSnapshot,
    );
  } catch {
    return runtimeFail('snapshot_drift', 'evaluation.snapshotIdentity');
  }
  let persistedAttemptId: SpfaEvaluationAttemptIdV2;
  try {
    persistedAttemptId = validateSpfaEvaluationAttemptIdV2(source.attempt_id);
  } catch {
    return runtimeFail('invalid_evaluation_record', 'evaluation.attemptId');
  }
  const persistedAttemptCount = positiveSafeIntegerText(
    source.attempt_count,
    'evaluation.attemptCount',
  );
  if (source.status === 'COMPLETED') {
    return {
      outcome: 'ALREADY_COMPLETED',
      evaluationResult: source.evaluation_result,
      scoreResult: source.score_result,
    };
  }
  if (
    source.status !== 'EVALUATING' ||
    persistedAttemptId !== owner.attemptId ||
    persistedAttemptCount !== owner.attemptCount
  ) {
    return { outcome: 'SUPERSEDED' };
  }
  return { outcome: 'OWNED' };
}

function snapshotParameters(snapshot: SpfaEvaluationSnapshotIdentityV2): unknown[] {
  return [
    snapshot.caseVersionId,
    snapshot.protocolCatalogRef.id,
    snapshot.protocolCatalogRef.version,
    snapshot.transcriptFingerprint.algorithm,
    snapshot.transcriptFingerprint.canonicalization,
    snapshot.transcriptFingerprint.value,
    snapshot.scoringPolicyRef.id,
    snapshot.scoringPolicyRef.version,
  ];
}

export async function withSpfaEvaluationPersistenceTransactionV2<T>(
  work: (client: SpfaEvaluationPersistenceClientV2) => Promise<T>,
  database: SpfaEvaluationPersistenceDatabaseV2 = pool,
): Promise<T> {
  const client = await database.connect();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const result = await work(client);
    await client.query('COMMIT');
    transactionStarted = false;
    return result;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original transaction or validation failure.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function lockOwnedSpfaSessionV2(
  client: SpfaEvaluationPersistenceClientV2,
  sessionId: string,
  authenticatedUserId: number,
): Promise<readonly unknown[]> {
  return (await client.query(LOCK_OWNED_SESSION_QUERY, [
    sessionId,
    authenticatedUserId,
  ])).rows;
}

export async function selectSpfaEvaluationRecordForUpdateV2(
  client: SpfaEvaluationPersistenceClientV2,
  sessionId: string,
): Promise<readonly unknown[]> {
  return (await client.query(SELECT_EVALUATION_RECORD_QUERY, [sessionId])).rows;
}

export async function hasLegacyEvaluationV2(
  client: SpfaEvaluationPersistenceClientV2,
  sessionId: string,
): Promise<boolean> {
  return (await client.query(SELECT_LEGACY_EVALUATION_QUERY, [sessionId])).rows.length > 0;
}

export async function selectSpfaTranscriptMessageRowsV2(
  client: SpfaEvaluationPersistenceClientV2,
  sessionId: string,
): Promise<readonly unknown[]> {
  return (await client.query(SELECT_TRANSCRIPT_MESSAGES_QUERY, [sessionId])).rows;
}

export async function insertSpfaEvaluationClaimV2(
  client: SpfaEvaluationPersistenceClientV2,
  values: unknown[],
): Promise<number | null> {
  return (await client.query(INSERT_EVALUATION_RECORD_QUERY, values)).rowCount;
}

export async function finishSpfaEvaluationSessionV2(
  client: SpfaEvaluationPersistenceClientV2,
  values: unknown[],
): Promise<number | null> {
  return (await client.query(FINISH_SESSION_QUERY, values)).rowCount;
}

export async function restartSpfaEvaluationAttemptV2(
  client: SpfaEvaluationPersistenceClientV2,
  values: unknown[],
): Promise<number | null> {
  return (await client.query(RESTART_EVALUATION_ATTEMPT_QUERY, values)).rowCount;
}

export async function loadFrozenSpfaCaseVersionV2(
  input: Readonly<{
    authenticatedUserId: number;
    sessionId: string;
    caseVersionId: CaseVersionId;
  }>,
  database: SpfaEvaluationPersistenceDatabaseV2 = pool,
): Promise<FrozenSpfaCaseVersionRecordV2> {
  const client = await database.connect();
  try {
    const result = await client.query(SELECT_FROZEN_CASE_VERSION_QUERY, [
      input.sessionId,
      input.authenticatedUserId,
      input.caseVersionId,
    ]);
    if (result.rows.length === 0) {
      runtimeFail(
        'frozen_case_version_not_found_or_forbidden',
        'caseVersion',
      );
    }
    if (result.rows.length !== 1) {
      runtimeFail('invalid_frozen_case_version', 'caseVersion.rows');
    }
    const source = row(result.rows[0], 'caseVersion.row');
    const caseId = positiveSafeIntegerText(source.case_id, 'caseVersion.caseId');
    let parsedVersionId: CaseVersionId;
    try {
      parsedVersionId = validateCaseVersionId(source.case_version_id);
    } catch {
      return runtimeFail('invalid_frozen_case_version', 'caseVersion.id');
    }
    if (parsedVersionId !== input.caseVersionId) {
      runtimeFail('invalid_frozen_case_version', 'caseVersion.id');
    }
    return {
      caseId,
      caseVersionId: parsedVersionId,
      sourceKind: source.source_kind,
      legacyStatus: source.legacy_status,
      contentFormat: source.content_format,
      content: source.content,
    };
  } finally {
    client.release();
  }
}

export async function completeSpfaEvaluationAttemptV2(
  owner: SpfaEvaluationAttemptOwnerV2,
  completedAt: string,
  evaluation: unknown,
  score: unknown,
  database: SpfaEvaluationPersistenceDatabaseV2 = pool,
): Promise<SpfaEvaluationAttemptMutationResultV2> {
  return withSpfaEvaluationPersistenceTransactionV2(async (client) => {
    const inspection = inspectAttempt(
      await selectSpfaEvaluationRecordForUpdateV2(client, owner.sessionId),
      owner,
    );
    if (inspection.outcome !== 'OWNED') return inspection;
    const rowCount = (await client.query(COMPLETE_EVALUATION_ATTEMPT_QUERY, [
      owner.sessionId,
      owner.attemptId,
      owner.attemptCount,
      completedAt,
      evaluation,
      score,
      ...snapshotParameters(owner.snapshotIdentity),
    ])).rowCount;
    if (rowCount !== 1) return { outcome: 'SUPERSEDED' };
    return { outcome: 'UPDATED' };
  }, database);
}

export async function failSpfaEvaluationAttemptV2(
  owner: SpfaEvaluationAttemptOwnerV2,
  failedAt: string,
  failureCode: SpfaEvaluationFailureCodeV2,
  database: SpfaEvaluationPersistenceDatabaseV2 = pool,
): Promise<SpfaEvaluationAttemptMutationResultV2> {
  return withSpfaEvaluationPersistenceTransactionV2(async (client) => {
    const inspection = inspectAttempt(
      await selectSpfaEvaluationRecordForUpdateV2(client, owner.sessionId),
      owner,
    );
    if (inspection.outcome !== 'OWNED') return inspection;
    const rowCount = (await client.query(FAIL_EVALUATION_ATTEMPT_QUERY, [
      owner.sessionId,
      owner.attemptId,
      owner.attemptCount,
      failedAt,
      failureCode,
      ...snapshotParameters(owner.snapshotIdentity),
    ])).rowCount;
    if (rowCount !== 1) return { outcome: 'SUPERSEDED' };
    return { outcome: 'UPDATED' };
  }, database);
}
