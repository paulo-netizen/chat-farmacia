import { createHash } from 'node:crypto';
import { z } from 'zod';

export const PHARMACEUTICAL_SCORING_ERROR_CODES = [
  'UNSUPPORTED_VERSION', 'SOURCE_BINDING_MISMATCH', 'FINGERPRINT_MISMATCH',
  'INVALID_TARGET_COVERAGE', 'INVALID_SCORING_PLAN', 'INVALID_WEIGHT_CONFIGURATION',
  'INCOMPLETE_UPSTREAM', 'UNVALIDATED_SOURCE', 'INVALID_NUMERIC_STATE',
  'PEDAGOGICAL_CONFIGURATION_REQUIRED', 'INVALID_CONTRACT',
] as const;
export type PharmaceuticalScoringErrorCodeV2 = typeof PHARMACEUTICAL_SCORING_ERROR_CODES[number];

export class PharmaceuticalScoringValidationError extends Error {
  constructor(readonly code: PharmaceuticalScoringErrorCodeV2, readonly path: string) {
    // Only structural paths/codes: never copy source values or upstream errors.
    super(`${code}: ${path}`);
    this.name = 'PharmaceuticalScoringValidationError';
  }
}
export function scoringFail(code: PharmaceuticalScoringErrorCodeV2, path: string): never {
  throw new PharmaceuticalScoringValidationError(code, path);
}
export function parseScoring<T extends z.ZodTypeAny>(
  schema: T, value: unknown, path: string, code: PharmaceuticalScoringErrorCodeV2 = 'INVALID_CONTRACT',
): z.infer<T> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const version = issue.path.some((part) =>
      ['schemaVersion', 'contractVersion', 'rulesVersion', 'canonicalization'].includes(String(part)));
    scoringFail(version ? 'UNSUPPORTED_VERSION' : code,
      `${path}.${issue.path.map(String).join('.')}`);
  }
  return parsed.data;
}

export const scoringIdentitySchema = z.string().min(1).max(200).refine((v) => v.trim() === v);
export const scoringRefSchema = z.object({ id: scoringIdentitySchema, version: scoringIdentitySchema }).strict();
export const scoringFingerprintSchema = z.object({
  algorithm: z.literal('sha256'), canonicalization: scoringIdentitySchema,
  value: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type ScoringFingerprintV1 = z.infer<typeof scoringFingerprintSchema>;
export const scoringUnitIdSchema = z.string().regex(/^pharm_scoring_unit_[0-9a-f]{64}$/);
export const scoringTargetIdSchema = z.string().regex(/^pharm_target_[0-9a-f]{64}$/);
export const scoringGroupIdSchema = z.string().regex(/^pharm_expectation_group_[0-9a-f]{64}$/);
export const scoringIntegerStringSchema = z.string().regex(/^(0|[1-9][0-9]{0,39})$/);
export const scoringApprovalSchema = z.enum(['APPROVED', 'UNAPPROVED']);

export type DeepScoringReadonly<T> = T extends readonly (infer U)[] ? readonly DeepScoringReadonly<U>[]
  : T extends object ? { readonly [K in keyof T]: DeepScoringReadonly<T[K]> } : T;

/** JSON-only, key-sorted canonicalization; array order is defined by each contract. */
export function scoringCanonicalJson(value: unknown): string {
  function canonical(item: unknown): unknown {
    if (item === null || typeof item === 'string' || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (Array.isArray(item)) return item.map(canonical);
    if (typeof item === 'object' && item !== null && Object.getPrototypeOf(item) === Object.prototype) {
      return Object.fromEntries(Object.keys(item).sort().map((key) =>
        [key, canonical((item as Record<string, unknown>)[key])]));
    }
    return scoringFail('INVALID_CONTRACT', 'canonicalJson');
  }
  return JSON.stringify(canonical(value));
}
export function scoringFingerprint(canonicalization: string, core: unknown): ScoringFingerprintV1 {
  return { algorithm: 'sha256', canonicalization,
    value: createHash('sha256').update(scoringCanonicalJson([canonicalization, core])).digest('hex') };
}
export function scoringEqual(
  actual: unknown, expected: unknown, path: string,
  code: PharmaceuticalScoringErrorCodeV2 = 'SOURCE_BINDING_MISMATCH',
): void {
  if (scoringCanonicalJson(actual) !== scoringCanonicalJson(expected)) scoringFail(code, path);
}
export function sealScoring<T extends object>(core: T, canonicalization: string) {
  return { ...core, fingerprint: scoringFingerprint(canonicalization, core) };
}
export function checkScoringFingerprint(
  input: { fingerprint: ScoringFingerprintV1 }, core: object, canonicalization: string, path: string,
): void {
  scoringEqual(input.fingerprint, scoringFingerprint(canonicalization, core), path, 'FINGERPRINT_MISMATCH');
}
export function freezeScoring<T>(value: T): DeepScoringReadonly<T> {
  const copy = structuredClone(value);
  function freeze(item: unknown): void {
    if (item !== null && typeof item === 'object') {
      Object.values(item).forEach(freeze);
      Object.freeze(item);
    }
  }
  freeze(copy);
  return copy as DeepScoringReadonly<T>;
}
export function scoringUnique(values: readonly string[], path: string, code: PharmaceuticalScoringErrorCodeV2): void {
  if (new Set(values).size !== values.length) scoringFail(code, path);
}
export function scoringOrdinal(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }

/** Exact non-negative fractions for result SHAPES, not a score calculation. */
export const scoringFractionSchema = z.object({
  numerator: scoringIntegerStringSchema,
  denominator: scoringIntegerStringSchema.refine((v) => BigInt(v) > 0n),
}).strict();
export function scoringFraction(value: z.infer<typeof scoringFractionSchema>) {
  let a = BigInt(value.numerator), b = BigInt(value.denominator);
  while (b !== 0n) { const r = a % b; a = b; b = r; }
  return { numerator: String(BigInt(value.numerator) / a), denominator: String(BigInt(value.denominator) / a) };
}
