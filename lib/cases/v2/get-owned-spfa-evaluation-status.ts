import { pool } from '@/lib/db';

import { buildSpfaScoringContextV2 } from './build-spfa-scoring-context';
import { resolveSessionSpfaClinicalContentV2 } from './resolve-session-clinical-content';
import { SessionClinicalContentErrorV2 } from './session-clinical-content-types';
import type {
  SpfaEvaluationFailureCodeV2,
  SpfaEvaluationSnapshotIdentityV2,
} from './spfa-evaluation-lifecycle-types';
import type { SpfaScoringPolicyV2 } from './spfa-scoring-policy-types';
import type { SpfaSessionEvaluationV2 } from './spfa-session-evaluation-types';
import type { SpfaSessionScoreV2 } from './spfa-session-score-types';
import type { SessionTranscriptSnapshotV2 } from './spfa-session-evidence-types';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';
import {
  validateSpfaEvaluationLifecycleV2,
  validateSpfaEvaluationSnapshotIdentityV2,
  validateSpfaEvaluationTimestampV2,
} from './validate-spfa-evaluation-lifecycle';
import { validateSpfaScoringPolicyV2 } from './validate-spfa-scoring-policy';
import { validateSpfaSessionEvaluationV2 } from './validate-spfa-session-evaluation';
import type { CaseVersionId } from './types';
import { validateCaseVersionId } from './validate-patient-facts';

export type GetOwnedSpfaEvaluationStatusInputV2 = Readonly<{
  authenticatedUserId: number;
  sessionId: string;
}>;

export type OwnedSpfaEvaluationStatusV2 =
  | Readonly<{ status: 'NOT_STARTED'; sessionId: string }>
  | Readonly<{
      status: 'EVALUATING';
      sessionId: string;
      snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
    }>
  | Readonly<{
      status: 'FAILED';
      sessionId: string;
      snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
      failureCode: SpfaEvaluationFailureCodeV2;
    }>
  | Readonly<{
      status: 'COMPLETED';
      sessionId: string;
      snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
      evaluation: SpfaSessionEvaluationV2;
      score: SpfaSessionScoreV2;
    }>;

export type GetOwnedSpfaEvaluationStatusErrorCodeV2 =
  | 'invalid_input'
  | 'session_not_found_or_forbidden'
  | 'spfa_evaluation_not_available'
  | 'invalid_session_anchor'
  | 'invalid_persisted_evaluation'
  | 'evaluation_read_failed';

export class GetOwnedSpfaEvaluationStatusErrorV2 extends Error {
  constructor(
    public readonly code: GetOwnedSpfaEvaluationStatusErrorCodeV2,
    public readonly path: string,
  ) {
    super(code);
    this.name = 'GetOwnedSpfaEvaluationStatusErrorV2';
  }
}

export type SpfaEvaluationReadDatabaseV2 = Readonly<{
  query(text: string, values?: unknown[]): Promise<Readonly<{
    rows: readonly unknown[];
  }>>;
}>;

const READ_OWNED_SPFA_EVALUATION_QUERY = `
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
    cv.content AS version_content,
    r.status AS evaluation_status,
    r.result_format AS evaluation_result_format,
    r.session_id AS evaluation_session_id,
    r.case_version_id AS evaluation_case_version_id,
    r.protocol_catalog_id,
    r.protocol_catalog_version,
    r.scoring_policy_id,
    r.scoring_policy_version,
    r.transcript_fingerprint_algorithm,
    r.transcript_fingerprint_canonicalization,
    r.transcript_fingerprint_value,
    r.transcript_snapshot,
    r.scoring_policy_snapshot,
    r.attempt_id,
    r.attempt_count::text AS attempt_count,
    r.lease_expires_at,
    r.started_at,
    r.completed_at,
    r.failed_at,
    r.failure_code,
    r.evaluation_result,
    r.score_result
  FROM public.sessions AS s
  INNER JOIN public.case_versions AS cv
    ON cv.id = s.case_version_id
   AND cv.case_id = s.case_id
  LEFT JOIN public.session_evaluation_records_v2 AS r
    ON r.session_id = s.id
  WHERE s.id = $1
    AND s.user_id = $2
`;

const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;
const EVALUATION_RECORD_FIELDS = [
  'evaluation_result_format',
  'evaluation_session_id',
  'evaluation_case_version_id',
  'protocol_catalog_id',
  'protocol_catalog_version',
  'scoring_policy_id',
  'scoring_policy_version',
  'transcript_fingerprint_algorithm',
  'transcript_fingerprint_canonicalization',
  'transcript_fingerprint_value',
  'transcript_snapshot',
  'scoring_policy_snapshot',
  'attempt_id',
  'attempt_count',
  'lease_expires_at',
  'started_at',
  'completed_at',
  'failed_at',
  'failure_code',
  'evaluation_result',
  'score_result',
] as const;

function fail(
  code: GetOwnedSpfaEvaluationStatusErrorCodeV2,
  path: string,
): never {
  throw new GetOwnedSpfaEvaluationStatusErrorV2(code, path);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('invalid_session_anchor', path);
  }
  return value as Record<string, unknown>;
}

function validateInput(input: GetOwnedSpfaEvaluationStatusInputV2): void {
  const source = record(input, 'input');
  const keys = Object.keys(source).sort();
  if (keys.join('\0') !== ['authenticatedUserId', 'sessionId'].sort().join('\0')) {
    fail('invalid_input', 'input');
  }
  if (
    !Number.isSafeInteger(input.authenticatedUserId) ||
    input.authenticatedUserId <= 0
  ) {
    fail('invalid_input', 'authenticatedUserId');
  }
  if (!SESSION_UUID_PATTERN.test(input.sessionId)) {
    fail('invalid_input', 'sessionId');
  }
}

function positiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'string' || !POSITIVE_INTEGER_PATTERN.test(value)) {
    fail('invalid_session_anchor', path);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail('invalid_session_anchor', path);
  }
  return parsed;
}

function persistedPositiveInteger(value: unknown, path: string): number {
  if (typeof value !== 'string' || !POSITIVE_INTEGER_PATTERN.test(value)) {
    fail('invalid_persisted_evaluation', path);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail('invalid_persisted_evaluation', path);
  }
  return parsed;
}

function requirePersistedNull(value: unknown, path: string): void {
  if (value !== null) fail('invalid_persisted_evaluation', path);
}

function caseVersionId(value: unknown, path: string): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch {
    return fail('invalid_session_anchor', path);
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

function sameRef(
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

export async function getOwnedSpfaEvaluationStatusV2(
  input: GetOwnedSpfaEvaluationStatusInputV2,
  database: SpfaEvaluationReadDatabaseV2 = pool,
): Promise<OwnedSpfaEvaluationStatusV2> {
  validateInput(input);
  let rows: readonly unknown[];
  try {
    rows = (await database.query(READ_OWNED_SPFA_EVALUATION_QUERY, [
      input.sessionId,
      input.authenticatedUserId,
    ])).rows;
  } catch {
    return fail('evaluation_read_failed', 'evaluation');
  }
  if (rows.length === 0) {
    fail('session_not_found_or_forbidden', 'session');
  }
  if (rows.length !== 1) fail('invalid_session_anchor', 'rows');
  const row = record(rows[0], 'row');
  if (row.session_id !== input.sessionId) {
    fail('invalid_session_anchor', 'sessionId');
  }
  if (positiveInteger(row.session_user_id, 'sessionUserId') !== input.authenticatedUserId) {
    fail('invalid_session_anchor', 'sessionUserId');
  }
  const caseId = positiveInteger(row.session_case_id, 'sessionCaseId');
  if (caseId !== positiveInteger(row.version_case_id, 'versionCaseId')) {
    fail('invalid_session_anchor', 'versionCaseId');
  }
  const pinnedCaseVersionId = caseVersionId(
    row.session_case_version_id,
    'sessionCaseVersionId',
  );
  if (caseVersionId(row.version_id, 'versionId') !== pinnedCaseVersionId) {
    fail('invalid_session_anchor', 'versionId');
  }
  if (row.version_status !== 'PUBLISHED' && row.version_status !== 'ARCHIVED') {
    fail('invalid_session_anchor', 'versionStatus');
  }
  if (row.session_status !== 'active' && row.session_status !== 'finished') {
    fail('invalid_session_anchor', 'sessionStatus');
  }

  let core;
  try {
    core = resolveSessionSpfaClinicalContentV2({
      caseId,
      caseVersionId: pinnedCaseVersionId,
      sourceKind: row.version_source_kind,
      legacyStatus: row.version_legacy_status,
      contentFormat: row.version_content_format,
      content: row.version_content,
    });
  } catch (error) {
    if (
      error instanceof SessionClinicalContentErrorV2 &&
      error.code === 'spfa_evaluation_not_available'
    ) {
      return fail('spfa_evaluation_not_available', 'caseVersion');
    }
    return fail('spfa_evaluation_not_available', 'caseVersion');
  }

  if (row.evaluation_status === null) {
    if (EVALUATION_RECORD_FIELDS.some((field) => row[field] !== null)) {
      fail('invalid_persisted_evaluation', 'evaluation.missingRecord');
    }
    return { status: 'NOT_STARTED', sessionId: input.sessionId };
  }
  if (row.session_status !== 'finished') {
    fail('invalid_session_anchor', 'sessionStatus');
  }
  if (
    row.evaluation_result_format !== 'SPFA_SESSION_EVALUATION_V2' ||
    row.evaluation_session_id !== input.sessionId ||
    row.evaluation_case_version_id !== pinnedCaseVersionId
  ) {
    fail('invalid_persisted_evaluation', 'evaluation.identity');
  }

  let transcript: SessionTranscriptSnapshotV2;
  let policy: SpfaScoringPolicyV2;
  let snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
  try {
    transcript = validateSessionTranscriptSnapshotV2(row.transcript_snapshot);
    policy = validateSpfaScoringPolicyV2(row.scoring_policy_snapshot);
    snapshotIdentity = validateSpfaEvaluationSnapshotIdentityV2({
      sessionId: row.evaluation_session_id,
      caseVersionId: row.evaluation_case_version_id,
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
    transcript.sessionId !== input.sessionId ||
    transcript.caseVersionId !== pinnedCaseVersionId ||
    !sameFingerprint(transcript.fingerprint, snapshotIdentity.transcriptFingerprint) ||
    !sameRef(policy.policyRef, snapshotIdentity.scoringPolicyRef) ||
    !sameRef(core.spfaProtocolSet.catalogRef, snapshotIdentity.protocolCatalogRef)
  ) {
    fail('invalid_persisted_evaluation', 'evaluation.snapshotIdentity');
  }

  const common = {
    schemaVersion: '2.0',
    sessionId: input.sessionId,
    status: row.evaluation_status,
    snapshotIdentity,
    attemptId: row.attempt_id,
    attemptCount: persistedPositiveInteger(
      row.attempt_count,
      'evaluation.attemptCount',
    ),
    startedAt: timestamp(row.started_at, 'evaluation.startedAt'),
  };
  let lifecycleInput: unknown;
  let completionContext;
  if (row.evaluation_status === 'EVALUATING') {
    requirePersistedNull(row.completed_at, 'evaluation.completedAt');
    requirePersistedNull(row.failed_at, 'evaluation.failedAt');
    requirePersistedNull(row.failure_code, 'evaluation.failureCode');
    requirePersistedNull(row.evaluation_result, 'evaluation.evaluationResult');
    requirePersistedNull(row.score_result, 'evaluation.scoreResult');
    lifecycleInput = {
      ...common,
      leaseExpiresAt: timestamp(row.lease_expires_at, 'evaluation.leaseExpiresAt'),
    };
  } else if (row.evaluation_status === 'FAILED') {
    requirePersistedNull(row.lease_expires_at, 'evaluation.leaseExpiresAt');
    requirePersistedNull(row.completed_at, 'evaluation.completedAt');
    requirePersistedNull(row.evaluation_result, 'evaluation.evaluationResult');
    requirePersistedNull(row.score_result, 'evaluation.scoreResult');
    lifecycleInput = {
      ...common,
      failedAt: timestamp(row.failed_at, 'evaluation.failedAt'),
      failureCode: row.failure_code,
    };
  } else if (row.evaluation_status === 'COMPLETED') {
    requirePersistedNull(row.lease_expires_at, 'evaluation.leaseExpiresAt');
    requirePersistedNull(row.failed_at, 'evaluation.failedAt');
    requirePersistedNull(row.failure_code, 'evaluation.failureCode');
    const evaluationContext = {
      transcript,
      spfaProtocolSet: core.spfaProtocolSet,
    };
    let parsedEvaluation: SpfaSessionEvaluationV2;
    try {
      parsedEvaluation = validateSpfaSessionEvaluationV2(
        row.evaluation_result,
        evaluationContext,
      );
      completionContext = {
        evaluationContext,
        scoringContext: buildSpfaScoringContextV2(
          parsedEvaluation,
          core.spfaProtocolSet,
        ),
        scoringPolicy: policy,
      };
    } catch {
      return fail('invalid_persisted_evaluation', 'evaluation.completedPayload');
    }
    lifecycleInput = {
      ...common,
      completedAt: timestamp(row.completed_at, 'evaluation.completedAt'),
      completedPayload: {
        evaluation: row.evaluation_result,
        score: row.score_result,
      },
    };
  } else {
    return fail('invalid_persisted_evaluation', 'evaluation.status');
  }

  try {
    const lifecycle = validateSpfaEvaluationLifecycleV2(
      lifecycleInput,
      completionContext,
    );
    if (lifecycle.status === 'EVALUATING') {
      return { status: 'EVALUATING', sessionId: input.sessionId, snapshotIdentity };
    }
    if (lifecycle.status === 'FAILED') {
      return {
        status: 'FAILED',
        sessionId: input.sessionId,
        snapshotIdentity,
        failureCode: lifecycle.failureCode,
      };
    }
    return {
      status: 'COMPLETED',
      sessionId: input.sessionId,
      snapshotIdentity,
      evaluation: lifecycle.completedPayload.evaluation,
      score: lifecycle.completedPayload.score,
    };
  } catch {
    return fail('invalid_persisted_evaluation', 'evaluation.lifecycle');
  }
}
