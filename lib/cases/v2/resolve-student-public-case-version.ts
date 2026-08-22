import {
  createStudentCasePublicData,
  type StudentCasePublicData,
} from '../student-session-dto';
import {
  isCaseVersionAvailableToStudentsV2,
  isCaseVersionStatusV2,
  type CaseVersionStatusV2,
} from './case-version-lifecycle';
import type { CaseVersionId } from './types';
import { validateCaseVersionId } from './validate-patient-facts';

export type StudentCaseVersionRowV2 = Readonly<{
  id: unknown;
  case_id: unknown;
  status: unknown;
  content_format: unknown;
  content: unknown;
}>;

export type ResolvedStudentPublicCaseVersionV2 = Readonly<{
  caseId: number;
  caseVersionId: CaseVersionId;
  publicCaseData: StudentCasePublicData;
}>;

export type StudentPublicCaseVersionResolutionErrorCode =
  | 'invalid_case_version_row'
  | 'case_version_not_published'
  | 'case_version_not_resumable'
  | 'unsupported_content_format'
  | 'invalid_case_version_content'
  | 'case_version_identity_mismatch';

export class StudentPublicCaseVersionResolutionError extends Error {
  constructor(
    public readonly code: StudentPublicCaseVersionResolutionErrorCode,
    public readonly path: string,
  ) {
    super(`${code} at ${path}`);
    this.name = 'StudentPublicCaseVersionResolutionError';
  }
}

function fail(
  code: StudentPublicCaseVersionResolutionErrorCode,
  path: string,
): never {
  throw new StudentPublicCaseVersionResolutionError(code, path);
}

function asRecord(
  value: unknown,
  code: StudentPublicCaseVersionResolutionErrorCode,
  path: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(code, path);
  }

  return value as Record<string, unknown>;
}

function parseCaseId(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    fail('invalid_case_version_row', 'case_id');
  }

  return value;
}

function parseCaseVersionId(
  value: unknown,
  path: string,
  code: 'invalid_case_version_row' | 'invalid_case_version_content',
): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch {
    return fail(code, path);
  }
}

function parsePublicCaseData(
  value: unknown,
  path: string,
): StudentCasePublicData {
  try {
    return Object.freeze(createStudentCasePublicData(value));
  } catch {
    return fail('invalid_case_version_content', path);
  }
}

function resolveLegacyPublicCaseData(
  content: Record<string, unknown>,
): StudentCasePublicData {
  const spec = asRecord(
    content.spec,
    'invalid_case_version_content',
    'content.spec',
  );

  return parsePublicCaseData(spec, 'content.spec');
}

function resolveGeneratedPublicCaseData(
  content: Record<string, unknown>,
  rowCaseVersionId: CaseVersionId,
): StudentCasePublicData {
  const sourceOfTruth = asRecord(
    content.sourceOfTruth,
    'invalid_case_version_content',
    'content.sourceOfTruth',
  );
  const sourceCaseVersionId = parseCaseVersionId(
    sourceOfTruth.caseVersionId,
    'content.sourceOfTruth.caseVersionId',
    'invalid_case_version_content',
  );

  if (sourceCaseVersionId !== rowCaseVersionId) {
    fail(
      'case_version_identity_mismatch',
      'content.sourceOfTruth.caseVersionId',
    );
  }

  const patientFacts = asRecord(
    sourceOfTruth.patientFacts,
    'invalid_case_version_content',
    'content.sourceOfTruth.patientFacts',
  );
  const factsCaseVersionId = parseCaseVersionId(
    patientFacts.caseVersionId,
    'content.sourceOfTruth.patientFacts.caseVersionId',
    'invalid_case_version_content',
  );

  if (factsCaseVersionId !== rowCaseVersionId) {
    fail(
      'case_version_identity_mismatch',
      'content.sourceOfTruth.patientFacts.caseVersionId',
    );
  }

  return parsePublicCaseData(
    patientFacts.publicProfile,
    'content.sourceOfTruth.patientFacts.publicProfile',
  );
}

type CaseVersionStatusPolicy = (
  status: CaseVersionStatusV2,
) => void;

const requirePublishedStatus: CaseVersionStatusPolicy = (status) => {
  if (!isCaseVersionAvailableToStudentsV2(status)) {
    fail('case_version_not_published', 'status');
  }
};

const requireResumableStatus: CaseVersionStatusPolicy = (status) => {
  if (status !== 'PUBLISHED' && status !== 'ARCHIVED') {
    fail('case_version_not_resumable', 'status');
  }
};

function resolveStudentPublicCaseVersionWithStatusPolicy(
  input: unknown,
  requireStatus: CaseVersionStatusPolicy,
): ResolvedStudentPublicCaseVersionV2 {
  const row = asRecord(input, 'invalid_case_version_row', 'input');
  const caseId = parseCaseId(row.case_id);
  const caseVersionId = parseCaseVersionId(
    row.id,
    'id',
    'invalid_case_version_row',
  );

  if (!isCaseVersionStatusV2(row.status)) {
    fail('invalid_case_version_row', 'status');
  }
  requireStatus(row.status);

  if (
    row.content_format !== 'LEGACY_V1_SNAPSHOT' &&
    row.content_format !== 'GENERATED_CASE_BUNDLE_V2'
  ) {
    fail('unsupported_content_format', 'content_format');
  }

  const content = asRecord(
    row.content,
    'invalid_case_version_content',
    'content',
  );
  const publicCaseData =
    row.content_format === 'LEGACY_V1_SNAPSHOT'
      ? resolveLegacyPublicCaseData(content)
      : resolveGeneratedPublicCaseData(content, caseVersionId);

  return Object.freeze({
    caseId,
    caseVersionId,
    publicCaseData,
  });
}

export function resolveStudentPublicCaseVersionV2(
  input: unknown,
): ResolvedStudentPublicCaseVersionV2 {
  return resolveStudentPublicCaseVersionWithStatusPolicy(
    input,
    requirePublishedStatus,
  );
}

export function resolveStudentPublicCaseVersionForResumeV2(
  input: unknown,
): ResolvedStudentPublicCaseVersionV2 {
  return resolveStudentPublicCaseVersionWithStatusPolicy(
    input,
    requireResumableStatus,
  );
}
