import { pool } from '@/lib/db';

import {
  resolveSessionEvaluatorClinicalContentV2,
  resolveSessionPatientClinicalContentV2,
} from './resolve-session-clinical-content';
import {
  SessionClinicalContentErrorV2,
  type SessionClinicalContentErrorCodeV2,
  type SessionEvaluatorClinicalContentV2,
  type SessionPatientClinicalContentV2,
} from './session-clinical-content-types';
import type { CaseVersionId } from './types';
import { validateCaseVersionId } from './validate-patient-facts';

export type SessionClinicalRuntimeInputV2 = Readonly<{
  authenticatedUserId: number;
  sessionId: string;
}>;

export type SessionStatusV2 = 'active' | 'finished';

export type SessionPatientClinicalRuntimeV2 = Readonly<{
  sessionId: string;
  caseId: number;
  caseVersionId: CaseVersionId;
  clinicalContent: SessionPatientClinicalContentV2;
}>;

export type SessionEvaluatorClinicalRuntimeV2 = Readonly<{
  sessionId: string;
  caseId: number;
  caseVersionId: CaseVersionId;
  sessionStatus: SessionStatusV2;
  clinicalContent: SessionEvaluatorClinicalContentV2;
}>;

export type SessionClinicalRuntimeErrorCodeV2 =
  | 'invalid_input'
  | 'session_not_found_or_forbidden'
  | 'session_not_active'
  | 'invalid_session_anchor'
  | 'invalid_case_version_status'
  | SessionClinicalContentErrorCodeV2;

export class SessionClinicalRuntimeErrorV2 extends Error {
  constructor(
    public readonly code: SessionClinicalRuntimeErrorCodeV2,
    public readonly path: string,
  ) {
    super(`${code} at ${path}`);
    this.name = 'SessionClinicalRuntimeErrorV2';
  }
}

type SessionClinicalDatabaseRowV2 = Readonly<{
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

type ValidatedSessionClinicalAnchorV2 = Readonly<{
  sessionId: string;
  caseId: number;
  caseVersionId: CaseVersionId;
  sessionStatus: SessionStatusV2;
  sourceKind: unknown;
  legacyStatus: unknown;
  contentFormat: unknown;
  content: unknown;
}>;

const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const POSITIVE_BIGINT_TEXT_PATTERN = /^[1-9]\d*$/;

const SESSION_CLINICAL_ANCHOR_QUERY = `
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
`;

function fail(
  code: SessionClinicalRuntimeErrorCodeV2,
  path: string,
): never {
  throw new SessionClinicalRuntimeErrorV2(code, path);
}

function validateBoundaryInput(input: SessionClinicalRuntimeInputV2): void {
  if (
    !Number.isSafeInteger(input.authenticatedUserId) ||
    input.authenticatedUserId <= 0
  ) {
    fail('invalid_input', 'authenticatedUserId');
  }
  if (
    typeof input.sessionId !== 'string' ||
    !SESSION_UUID_PATTERN.test(input.sessionId)
  ) {
    fail('invalid_input', 'sessionId');
  }
}

function asRow(value: unknown): SessionClinicalDatabaseRowV2 {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('invalid_session_anchor', 'row');
  }
  return value as SessionClinicalDatabaseRowV2;
}

function parseBigintText(value: unknown, path: string): number {
  if (
    typeof value !== 'string' ||
    !POSITIVE_BIGINT_TEXT_PATTERN.test(value)
  ) {
    fail('invalid_session_anchor', path);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    fail('invalid_session_anchor', path);
  }
  return parsed;
}

function parseCaseVersionId(value: unknown, path: string): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch {
    return fail('invalid_session_anchor', path);
  }
}

function validateSessionStatus(value: unknown): SessionStatusV2 {
  if (value !== 'active' && value !== 'finished') {
    fail('invalid_session_anchor', 'session_status');
  }
  return value;
}

function validateVersionStatus(value: unknown): void {
  if (value !== 'PUBLISHED' && value !== 'ARCHIVED') {
    fail('invalid_case_version_status', 'version_status');
  }
}

async function loadSessionClinicalAnchorV2(
  input: SessionClinicalRuntimeInputV2,
): Promise<ValidatedSessionClinicalAnchorV2> {
  validateBoundaryInput(input);

  const result = await pool.query(SESSION_CLINICAL_ANCHOR_QUERY, [
    input.sessionId,
    input.authenticatedUserId,
  ]);

  if (result.rows.length === 0) {
    fail('session_not_found_or_forbidden', 'session');
  }
  if (result.rows.length !== 1) {
    fail('invalid_session_anchor', 'rows');
  }

  const row = asRow(result.rows[0]);
  if (row.session_id !== input.sessionId) {
    fail('invalid_session_anchor', 'session_id');
  }

  const sessionUserId = parseBigintText(
    row.session_user_id,
    'session_user_id',
  );
  if (sessionUserId !== input.authenticatedUserId) {
    fail('invalid_session_anchor', 'session_user_id');
  }

  const sessionCaseId = parseBigintText(
    row.session_case_id,
    'session_case_id',
  );
  const versionCaseId = parseBigintText(
    row.version_case_id,
    'version_case_id',
  );
  if (sessionCaseId !== versionCaseId) {
    fail('invalid_session_anchor', 'version_case_id');
  }

  const sessionCaseVersionId = parseCaseVersionId(
    row.session_case_version_id,
    'session_case_version_id',
  );
  const versionId = parseCaseVersionId(row.version_id, 'version_id');
  if (sessionCaseVersionId !== versionId) {
    fail('invalid_session_anchor', 'version_id');
  }

  const sessionStatus = validateSessionStatus(row.session_status);
  validateVersionStatus(row.version_status);

  return {
    sessionId: input.sessionId,
    caseId: sessionCaseId,
    caseVersionId: sessionCaseVersionId,
    sessionStatus,
    sourceKind: row.version_source_kind,
    legacyStatus: row.version_legacy_status,
    contentFormat: row.version_content_format,
    content: row.version_content,
  };
}

function mapContentError(error: unknown): never {
  if (error instanceof SessionClinicalContentErrorV2) {
    throw new SessionClinicalRuntimeErrorV2(error.code, error.path);
  }
  throw error;
}

export async function resolveSessionPatientClinicalRuntimeV2(
  input: SessionClinicalRuntimeInputV2,
): Promise<SessionPatientClinicalRuntimeV2> {
  const anchor = await loadSessionClinicalAnchorV2(input);
  if (anchor.sessionStatus !== 'active') {
    fail('session_not_active', 'session_status');
  }

  try {
    const clinicalContent = resolveSessionPatientClinicalContentV2({
      caseId: anchor.caseId,
      caseVersionId: anchor.caseVersionId,
      sourceKind: anchor.sourceKind,
      legacyStatus: anchor.legacyStatus,
      contentFormat: anchor.contentFormat,
      content: anchor.content,
    });
    return {
      sessionId: anchor.sessionId,
      caseId: anchor.caseId,
      caseVersionId: anchor.caseVersionId,
      clinicalContent,
    };
  } catch (error) {
    return mapContentError(error);
  }
}

export async function resolveSessionEvaluatorClinicalRuntimeV2(
  input: SessionClinicalRuntimeInputV2,
): Promise<SessionEvaluatorClinicalRuntimeV2> {
  const anchor = await loadSessionClinicalAnchorV2(input);

  try {
    const clinicalContent = resolveSessionEvaluatorClinicalContentV2({
      caseId: anchor.caseId,
      caseVersionId: anchor.caseVersionId,
      sourceKind: anchor.sourceKind,
      legacyStatus: anchor.legacyStatus,
      contentFormat: anchor.contentFormat,
      content: anchor.content,
    });

    // 4E-D must enforce evaluation authorization and its lock/transaction;
    // this read-only status does not grant permission to evaluate or finalize.
    return {
      sessionId: anchor.sessionId,
      caseId: anchor.caseId,
      caseVersionId: anchor.caseVersionId,
      sessionStatus: anchor.sessionStatus,
      clinicalContent,
    };
  } catch (error) {
    return mapContentError(error);
  }
}
