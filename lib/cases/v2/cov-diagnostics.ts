/** Closed, server-owned vocabulary. Never copy provider messages, issue paths or values. */
const stages = {
  INPUT_SCHEMA_INVALID: 'INPUT', BINDING_MISMATCH: 'INPUT', RUNTIME_INVALID: 'INPUT',
  RUNTIME_FAILURE: 'TRANSPORT', REQUEST_INVALID: 'PROJECTION', REQUEST_TOO_LARGE: 'PROJECTION',
  RESERVATION_FAILED: 'PERSISTENCE', METADATA_FAILED: 'PERSISTENCE', STOP_RECORD_FAILED: 'PERSISTENCE',
  RESPONSE_JSON_INVALID: 'PARSE', RESPONSE_ENVELOPE_INVALID: 'ADAPTER',
  PROVIDER_SCHEMA_INVALID: 'ADAPTER', REQUEST_DIGEST_MISMATCH: 'VALIDATION',
  ADJUDICATION_SCHEMA_INVALID: 'VALIDATION', DOCUMENT_STATE_INVALID: 'VALIDATION',
  CRITERIA_DUPLICATED: 'VALIDATION', CRITERIA_UNKNOWN: 'VALIDATION', CRITERIA_MISSING: 'VALIDATION',
  REPORT_CITATION_INVALID: 'VALIDATION', SOURCE_REFERENCE_INVALID: 'VALIDATION',
  REPORT_CITATION_RANGE_INVALID: 'VALIDATION', REPORT_CITATION_OUT_OF_BOUNDS: 'VALIDATION',
  REPORT_CITATION_TEXT_MISMATCH: 'VALIDATION', REPORT_CITATION_TEXT_NOT_FOUND: 'VALIDATION',
  REPORT_CITATION_AMBIGUOUS: 'VALIDATION', REPORT_CITATION_OCCURRENCE_INVALID: 'VALIDATION',
  REPORT_CITATION_REPRESENTATION_INVALID: 'VALIDATION',
  SOURCE_CITATION_INVALID: 'VALIDATION', CRITERION_SUPPORT_MISSING: 'VALIDATION',
  SOURCE_REFERENCE_NOT_FOUND: 'VALIDATION', SOURCE_ROLE_INVALID: 'VALIDATION',
  SOURCE_CITATION_RANGE_INVALID: 'VALIDATION', SOURCE_CITATION_OUT_OF_BOUNDS: 'VALIDATION',
  SOURCE_CITATION_TEXT_MISMATCH: 'VALIDATION', SOURCE_CITATION_TEXT_NOT_FOUND: 'VALIDATION',
  SOURCE_CITATION_OCCURRENCE_INVALID: 'VALIDATION', SOURCE_CITATION_AMBIGUOUS: 'VALIDATION', SOURCE_CITATION_EMPTY: 'VALIDATION',
  DIFFICULTY_EVIDENCE_MISSING: 'VALIDATION',
  DIFFICULTY_STATE_CONFLICT: 'VALIDATION',
  LINKS_DUPLICATED: 'VALIDATION',
  CIRCUMSTANCE_NOT_PRIOR: 'VALIDATION',
  ADOPTION_NOT_PRIOR: 'VALIDATION',
  ADOPTION_SOURCE_MISSING: 'VALIDATION',
  WITHDRAWAL_NOT_LATER: 'VALIDATION',
  WITHDRAWAL_STATE_CONFLICT: 'VALIDATION',
  WITHDRAWAL_EVIDENCE_MISSING: 'VALIDATION',
  FEASIBILITY_PRECEDES_PROPOSAL: 'VALIDATION',
  PATIENT_RESPONSE_NOT_LATER: 'VALIDATION',
  PATIENT_DIFFICULTY_REFERENCE_INVALID: 'VALIDATION',
  RESPONSE_DIFFICULTY_REFERENCE_INVALID: 'VALIDATION',
  RESPONSE_NOT_AFTER_DIFFICULTY: 'VALIDATION',
  RESPONSE_PRECEDES_PROPOSAL: 'VALIDATION',
  INCOMPATIBILITY_REFERENCE_INVALID: 'VALIDATION',
  LINK_REFERENCE_INVALID: 'VALIDATION',
  CRITERION_NOT_APPLICABLE_INVALID: 'VALIDATION',
  NOT_APPLICABLE_CRITERION_TYPE_INVALID: 'VALIDATION',
  NOT_APPLICABLE_DIFFICULTY_STATE_INVALID: 'VALIDATION',
  DIFFICULTY_STATE_MISSING_OR_INVALID: 'VALIDATION',
  DIFFICULTY_SCOPE_REFERENCE_MISSING: 'VALIDATION',
  DIFFICULTY_SUMMARY_INCONSISTENT: 'VALIDATION',
  DIFFICULTY_EVIDENCE_NOT_AFTER_PROPOSAL: 'VALIDATION',
  RESPONSE_OMISSION_WITHOUT_DIFFICULTY: 'VALIDATION',
  DEMONSTRATED_AUTHORSHIP_MISSING: 'VALIDATION',
  ADAPTATION_CIRCUMSTANCE_MISSING: 'VALIDATION',
  FEASIBILITY_CHECK_MISSING: 'VALIDATION',
  DIFFICULTY_RESPONSE_MISSING: 'VALIDATION',
  CONTRADICTION_SUPPORT_MISSING: 'VALIDATION',
  CLAIM_SUPPORT_MISSING: 'VALIDATION', ADJUDICATION_INVALID: 'VALIDATION',
} as const;
export type CovDiagnosticCode = keyof typeof stages;
export const COV_FIELDS = ['OUTPUT', 'REQUEST_DIGEST', 'CRITERIA', 'CRITERION_STATUS', 'CRITERION_LINK', 'STUDENT_EVIDENCE', 'LINKS', 'CIRCUMSTANCE', 'PROPOSAL', 'ATTRIBUTION', 'PATIENT_PROPOSAL', 'STANDING', 'WITHDRAWAL', 'FEASIBILITY_CHECK', 'PATIENT_RESPONSE', 'DIFFICULTY_STATE', 'DIFFICULTY_EVIDENCE', 'RESPONSE_DIFFICULTY_REF', 'RESPONSE_ACTION', 'INCOMPATIBILITY'] as const;
const roles = ['STUDENT', 'PATIENT', 'PUBLIC', 'PATIENT_OR_PUBLIC', 'NONE'] as const;
const references = ['MESSAGE', 'PUBLIC_FIELD', 'SOURCE', 'LINK', 'CRITERION', 'STATE', 'STRUCTURE'] as const;
export type CovIssue = Readonly<{ code: CovDiagnosticCode; field: typeof COV_FIELDS[number]; stage: 'ADAPTER' | 'VALIDATION'; requiredRole: typeof roles[number]; referenceType: typeof references[number] }>;
export type CovDiagnostic = Readonly<{ version: 'cov-diagnostic/1' | 'cov-diagnostic/2' | 'cov-diagnostic/3'; stage: typeof stages[CovDiagnosticCode]; code: CovDiagnosticCode; causes?: readonly CovDiagnosticCode[]; issues?: readonly CovIssue[] }>;
const issued = new WeakMap<object, CovDiagnostic>();
export class CovDiagnosticError extends Error {
  constructor(code: CovDiagnosticCode, causes?: readonly CovDiagnosticCode[], issues?: readonly CovIssue[]) {
    const safe = Object.hasOwn(stages, code) ? code : 'RUNTIME_FAILURE';
    super(safe);
    this.name = 'CovDiagnosticError';
    const closed = causes ? Object.freeze([...new Set(causes.map(c => Object.hasOwn(stages, c) ? c : 'RUNTIME_FAILURE' as const))]) : undefined;
    // Copy only closed scalar identifiers: callers cannot attach provider keys/values through this API.
    const located = issues?.map(i => Object.freeze({ code: Object.hasOwn(stages, i.code) ? i.code : 'RUNTIME_FAILURE' as const,
      field: COV_FIELDS.includes(i.field) ? i.field : 'OUTPUT' as const,
      stage: i.stage === 'ADAPTER' ? 'ADAPTER' as const : 'VALIDATION' as const,
      requiredRole: roles.includes(i.requiredRole) ? i.requiredRole : 'NONE' as const,
      referenceType: references.includes(i.referenceType) ? i.referenceType : 'STRUCTURE' as const }));
    issued.set(this, Object.freeze({ version: located ? 'cov-diagnostic/3' : closed ? 'cov-diagnostic/2' : 'cov-diagnostic/1', stage: located?.[0]?.stage ?? stages[safe], code: safe, ...(closed ? { causes: closed } : {}), ...(located ? { issues: Object.freeze(located) } : {}) }));
  }
}
export function covDiagnostic(error: unknown, fallback: CovDiagnosticCode): CovDiagnostic {
  return (error !== null && typeof error === 'object' ? issued.get(error) : undefined)
    ?? issued.get(new CovDiagnosticError(fallback))!;
}
