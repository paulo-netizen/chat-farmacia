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
  SOURCE_CITATION_INVALID: 'VALIDATION', CRITERION_SUPPORT_MISSING: 'VALIDATION',
  CLAIM_SUPPORT_MISSING: 'VALIDATION', ADJUDICATION_INVALID: 'VALIDATION',
} as const;
export type CovDiagnosticCode = keyof typeof stages;
export type CovDiagnostic = Readonly<{ version: 'cov-diagnostic/1'; stage: typeof stages[CovDiagnosticCode]; code: CovDiagnosticCode }>;
const issued = new WeakMap<object, CovDiagnostic>();
export class CovDiagnosticError extends Error {
  constructor(code: CovDiagnosticCode) {
    const safe = Object.hasOwn(stages, code) ? code : 'RUNTIME_FAILURE';
    super(safe);
    this.name = 'CovDiagnosticError';
    issued.set(this, Object.freeze({ version: 'cov-diagnostic/1', stage: stages[safe], code: safe }));
  }
}
export function covDiagnostic(error: unknown, fallback: CovDiagnosticCode): CovDiagnostic {
  return (error !== null && typeof error === 'object' ? issued.get(error) : undefined)
    ?? issued.get(new CovDiagnosticError(fallback))!;
}
