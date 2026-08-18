export const CASE_VERSION_STATUSES_V2 = [
  'AI_DRAFT',
  'TEACHER_DRAFT',
  'IN_REVIEW',
  'VALIDATED',
  'PUBLISHED',
  'ARCHIVED',
] as const;

export type CaseVersionStatusV2 =
  (typeof CASE_VERSION_STATUSES_V2)[number];

const CASE_VERSION_STATUS_SET: ReadonlySet<string> = new Set(
  CASE_VERSION_STATUSES_V2,
);

/**
 * Controls only the editorial/review state of one case version. It does not
 * authorize mutation of published content: editing a published case must
 * create a new version in a later phase.
 */
const ALLOWED_CASE_VERSION_TRANSITIONS_V2 = Object.freeze({
  AI_DRAFT: Object.freeze(
    ['TEACHER_DRAFT', 'IN_REVIEW', 'ARCHIVED'] as const,
  ),
  TEACHER_DRAFT: Object.freeze(['IN_REVIEW', 'ARCHIVED'] as const),
  IN_REVIEW: Object.freeze(
    ['TEACHER_DRAFT', 'VALIDATED', 'ARCHIVED'] as const,
  ),
  VALIDATED: Object.freeze(
    ['IN_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const,
  ),
  PUBLISHED: Object.freeze(['ARCHIVED'] as const),
  ARCHIVED: Object.freeze([] as const),
}) satisfies Readonly<
  Record<CaseVersionStatusV2, readonly CaseVersionStatusV2[]>
>;

export class CaseVersionLifecycleError extends Error {
  public readonly code = 'invalid_case_version_transition' as const;

  constructor(
    public readonly from: CaseVersionStatusV2,
    public readonly to: CaseVersionStatusV2,
  ) {
    super(`invalid case version transition ${from} -> ${to}`);
    this.name = 'CaseVersionLifecycleError';
  }
}

export function isCaseVersionStatusV2(
  value: unknown,
): value is CaseVersionStatusV2 {
  return typeof value === 'string' && CASE_VERSION_STATUS_SET.has(value);
}

export function canTransitionCaseVersionStatusV2(
  from: CaseVersionStatusV2,
  to: CaseVersionStatusV2,
): boolean {
  return ALLOWED_CASE_VERSION_TRANSITIONS_V2[from].some(
    (candidate) => candidate === to,
  );
}

export function assertCaseVersionStatusTransitionV2(
  from: CaseVersionStatusV2,
  to: CaseVersionStatusV2,
): void {
  if (!canTransitionCaseVersionStatusV2(from, to)) {
    throw new CaseVersionLifecycleError(from, to);
  }
}

/**
 * PUBLISHED is the only state available to new student sessions. ARCHIVED
 * preserves historical use but prevents any new session from starting.
 * Publication eligibility beyond this state transition belongs to a later
 * service with compliance, safety, identity, and authorization checks.
 */
export function isCaseVersionAvailableToStudentsV2(
  status: CaseVersionStatusV2,
): boolean {
  return status === 'PUBLISHED';
}
