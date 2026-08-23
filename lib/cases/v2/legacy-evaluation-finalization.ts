import { pool } from '@/lib/db';

import {
  parsePersistedLegacyEvaluationResultV2,
  scoreLegacyEvaluationV2,
} from './legacy-evaluation';
import type {
  LegacyEvaluationAnswersV2,
  LegacyEvaluationPublicResultV2,
} from './legacy-evaluation';
import type { LegacySessionEvaluatorClinicalContentV2 } from './session-clinical-content-types';
import type { SessionEvaluatorClinicalRuntimeV2 } from './session-clinical-runtime';
import type { CaseVersionId } from './types';
import { validateCaseVersionId } from './validate-patient-facts';

export type FinalizeLegacyEvaluationInputV2 = Readonly<{
  authenticatedUserId: number;
  runtime: SessionEvaluatorClinicalRuntimeV2;
  answers: LegacyEvaluationAnswersV2;
}>;

export type LegacyEvaluationFinalizationErrorCodeV2 =
  | 'invalid_input'
  | 'unsupported_evaluation_format'
  | 'session_not_found_or_forbidden'
  | 'invalid_session_anchor'
  | 'invalid_session_state'
  | 'invalid_evaluation_state'
  | 'evaluation_write_failed';

export class LegacyEvaluationFinalizationErrorV2 extends Error {
  constructor(
    public readonly code: LegacyEvaluationFinalizationErrorCodeV2,
    public readonly path: string,
  ) {
    super(code);
    this.name = 'LegacyEvaluationFinalizationErrorV2';
  }
}

type RecordValue = Record<string, unknown>;
type SessionStatus = 'active' | 'finished';

type ValidatedInput = Readonly<{
  authenticatedUserId: number;
  sessionId: string;
  caseVersionId: CaseVersionId;
  clinicalContent: LegacySessionEvaluatorClinicalContentV2;
  answers: LegacyEvaluationAnswersV2;
}>;

const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const LOCK_OWNED_SESSION_QUERY = `
  SELECT
    s.id AS session_id,
    s.user_id::text AS session_user_id,
    s.case_version_id AS session_case_version_id,
    s.status AS session_status
  FROM public.sessions AS s
  WHERE s.id = $1
    AND s.user_id = $2
  FOR UPDATE
`;

const SELECT_EXISTING_EVALUATION_QUERY = `
  SELECT
    score,
    is_tipo_ok,
    is_barrera_ok,
    is_intervencion_ok,
    feedback
  FROM public.evaluations
  WHERE session_id = $1
`;

const INSERT_FIRST_EVALUATION_QUERY = `
  INSERT INTO public.evaluations (
    session_id,
    tipo_no_adherencia,
    barrera,
    intervenciones,
    is_tipo_ok,
    is_barrera_ok,
    is_intervencion_ok,
    score,
    feedback
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  RETURNING
    score,
    is_tipo_ok,
    is_barrera_ok,
    is_intervencion_ok,
    feedback
`;

const FINISH_ACTIVE_SESSION_QUERY = `
  UPDATE public.sessions
  SET
    status = 'finished',
    finished_at = now()
  WHERE id = $1
    AND user_id = $2
    AND case_version_id = $3
    AND status = 'active'
`;

function fail(
  code: LegacyEvaluationFinalizationErrorCodeV2,
  path: string,
): never {
  throw new LegacyEvaluationFinalizationErrorV2(code, path);
}

function record(
  value: unknown,
  code: LegacyEvaluationFinalizationErrorCodeV2,
  path: string,
): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(code, path);
  }
  return value as RecordValue;
}

function validateInput(input: FinalizeLegacyEvaluationInputV2): ValidatedInput {
  const source = record(input, 'invalid_input', 'input');
  if (
    !Number.isSafeInteger(source.authenticatedUserId) ||
    (source.authenticatedUserId as number) <= 0
  ) {
    fail('invalid_input', 'authenticatedUserId');
  }

  const runtime = record(source.runtime, 'invalid_input', 'runtime');
  if (
    typeof runtime.sessionId !== 'string' ||
    !SESSION_UUID_PATTERN.test(runtime.sessionId)
  ) {
    fail('invalid_input', 'runtime.sessionId');
  }

  let caseVersionId: CaseVersionId;
  try {
    caseVersionId = validateCaseVersionId(runtime.caseVersionId);
  } catch {
    fail('invalid_input', 'runtime.caseVersionId');
  }

  const clinicalContent = record(
    runtime.clinicalContent,
    'invalid_input',
    'runtime.clinicalContent',
  );
  if (clinicalContent.contentFormat === 'GENERATED_CASE_BUNDLE_V2') {
    fail('unsupported_evaluation_format', 'runtime.clinicalContent');
  }
  if (clinicalContent.contentFormat !== 'LEGACY_V1_SNAPSHOT') {
    fail('invalid_input', 'runtime.clinicalContent');
  }

  return {
    authenticatedUserId: source.authenticatedUserId as number,
    sessionId: runtime.sessionId,
    caseVersionId,
    clinicalContent:
      runtime.clinicalContent as LegacySessionEvaluatorClinicalContentV2,
    answers: source.answers as LegacyEvaluationAnswersV2,
  };
}

function resultRows(
  result: unknown,
  code: LegacyEvaluationFinalizationErrorCodeV2,
  path: string,
): readonly unknown[] {
  const source = record(result, code, path);
  if (!Array.isArray(source.rows)) {
    fail(code, path);
  }
  return source.rows;
}

function validateLockedSession(
  result: unknown,
  input: ValidatedInput,
): SessionStatus {
  const rows = resultRows(result, 'invalid_session_anchor', 'session.rows');
  if (rows.length === 0) {
    fail('session_not_found_or_forbidden', 'session');
  }
  if (rows.length !== 1) {
    fail('invalid_session_anchor', 'session.rows');
  }

  const row = record(rows[0], 'invalid_session_anchor', 'session.row');
  if (row.session_id !== input.sessionId) {
    fail('invalid_session_anchor', 'session.id');
  }
  if (row.session_user_id !== String(input.authenticatedUserId)) {
    fail('invalid_session_anchor', 'session.user');
  }
  if (row.session_case_version_id !== input.caseVersionId) {
    fail('invalid_session_anchor', 'session.version');
  }
  if (row.session_status !== 'active' && row.session_status !== 'finished') {
    fail('invalid_session_anchor', 'session.status');
  }
  return row.session_status;
}

function validateExistingEvaluationRows(result: unknown): readonly unknown[] {
  const rows = resultRows(
    result,
    'invalid_evaluation_state',
    'evaluation.rows',
  );
  if (rows.length > 1) {
    fail('invalid_evaluation_state', 'evaluation.rows');
  }
  return rows;
}

function validateSingleInsertedRow(result: unknown): unknown {
  const rows = resultRows(
    result,
    'evaluation_write_failed',
    'evaluation.insert',
  );
  if (rows.length !== 1) {
    fail('evaluation_write_failed', 'evaluation.insert');
  }
  return rows[0];
}

function validateSingleSessionUpdate(result: unknown): void {
  const source = record(
    result,
    'evaluation_write_failed',
    'session.update',
  );
  if (source.rowCount !== 1) {
    fail('evaluation_write_failed', 'session.update');
  }
}

export async function finalizeLegacyEvaluationV2(
  input: FinalizeLegacyEvaluationInputV2,
): Promise<LegacyEvaluationPublicResultV2> {
  const validated = validateInput(input);
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const sessionResult = await client.query(LOCK_OWNED_SESSION_QUERY, [
      validated.sessionId,
      validated.authenticatedUserId,
    ]);
    const lockedStatus = validateLockedSession(sessionResult, validated);

    const evaluationResult = await client.query(
      SELECT_EXISTING_EVALUATION_QUERY,
      [validated.sessionId],
    );
    const existingRows = validateExistingEvaluationRows(evaluationResult);
    const existingResult = existingRows.length === 1
      ? parsePersistedLegacyEvaluationResultV2(existingRows[0])
      : undefined;

    if (lockedStatus === 'finished') {
      if (!existingResult) {
        fail('invalid_session_state', 'session.state');
      }
      await client.query('COMMIT');
      transactionStarted = false;
      return existingResult;
    }

    if (existingResult) {
      const updateResult = await client.query(FINISH_ACTIVE_SESSION_QUERY, [
        validated.sessionId,
        validated.authenticatedUserId,
        validated.caseVersionId,
      ]);
      validateSingleSessionUpdate(updateResult);
      await client.query('COMMIT');
      transactionStarted = false;
      return existingResult;
    }

    const candidate = scoreLegacyEvaluationV2(
      validated.answers,
      validated.clinicalContent,
    );
    const insertResult = await client.query(INSERT_FIRST_EVALUATION_QUERY, [
      validated.sessionId,
      candidate.tipo_no_adherencia,
      candidate.barrera,
      [...candidate.intervenciones],
      candidate.isTipoOk,
      candidate.isBarreraOk,
      candidate.isIntervOk,
      candidate.score,
      candidate.feedback,
    ]);
    const publicResult = parsePersistedLegacyEvaluationResultV2(
      validateSingleInsertedRow(insertResult),
    );

    const updateResult = await client.query(FINISH_ACTIVE_SESSION_QUERY, [
      validated.sessionId,
      validated.authenticatedUserId,
      validated.caseVersionId,
    ]);
    validateSingleSessionUpdate(updateResult);
    await client.query('COMMIT');
    transactionStarted = false;
    return publicResult;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // Preserve the original transaction or validation error.
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
