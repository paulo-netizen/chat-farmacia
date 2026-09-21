import { z } from 'zod';
import { scoringCanonicalJson, scoringFingerprint } from './pharmaceutical-scoring-contract-utils';

export type PharmaceuticalRecordErrorCode = 'INVALID_RECORD' | 'INVALID_ARTIFACT' | 'MISSING_ARTIFACT' |
  'INTEGRITY_MISMATCH' | 'BINDING_MISMATCH' | 'IDEMPOTENCY_CONFLICT' | 'STALE_WORKER' |
  'INVALID_TRANSITION' | 'LEASE_EXPIRED' | 'COMPLETION_CONFLICT';
export class PharmaceuticalEvaluationRecordError extends Error {
  constructor(readonly code: PharmaceuticalRecordErrorCode) {
    super(code); this.name = 'PharmaceuticalEvaluationRecordError';
  }
}
export function recordFail(code: PharmaceuticalRecordErrorCode): never { throw new PharmaceuticalEvaluationRecordError(code); }
/** No input values, caller-controlled paths or upstream errors are propagated. */
export function recordGuard<T>(code: PharmaceuticalRecordErrorCode, run: () => T): T {
  try { return run(); } catch (error) {
    if (error instanceof PharmaceuticalEvaluationRecordError) throw error;
    return recordFail(code);
  }
}
export function recordParse<S extends z.ZodTypeAny>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) recordFail('INVALID_RECORD');
  return result.data;
}
export function recordEqual(a: unknown, b: unknown, code: PharmaceuticalRecordErrorCode = 'BINDING_MISMATCH') {
  if (scoringCanonicalJson(a) !== scoringCanonicalJson(b)) recordFail(code);
}
export function recordKeys(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) recordFail('INVALID_ARTIFACT');
  recordEqual(Object.keys(value).sort(), [...keys].sort(), 'INVALID_ARTIFACT');
  return value as Record<string, unknown>;
}
export function operationalFingerprint(version: string, value: unknown) {
  return recordGuard('INVALID_RECORD', () => scoringFingerprint(version, value));
}
