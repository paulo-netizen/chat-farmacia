import { createHash } from 'node:crypto';
import { z } from 'zod';

export const COV_FIRST_IDS = Object.freeze(['R1', 'R2', 'R3', 'R-INJECTION', 'S1', 'S2',
  'S3-ADOPT', 'S4-CONFLICT', 'P1', 'P2-WITHDRAW', 'P3-ADOPT', 'P4-LATE'] as const);
export const COV_FIRST_CONFIG = Object.freeze({ model: 'gpt-5.6-terra' as const,
  maxOutputTokens: 8000, maxInputBytes: 20000, timeoutMs: 60000 });
export const COV_WIRE_POLICY = Object.freeze({ endpoint: 'https://api.openai.com/v1',
  serviceTier: 'default', reasoningEffort: 'medium', retries: 0, store: false });
// Rates in USD per million tokens. A proposal, never spending permission.
export const COV_PRICE = Object.freeze({ version: 'cov-price/2026-10-06', input: 2,
  cachedInput: 0.2, cacheWrite: 2.5, output: 12, currency: 'USD',
  source: 'https://developers.openai.com/api/docs/models/gpt-5.6-terra' });
export const COV_PROPOSED_BUDGET_MICRO_USD = 3000000;
export function covHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const covManifestSchema = z.array(z.object({ id: z.enum(COV_FIRST_IDS), fixtureHash: hash,
  requestHash: hash, inputBytes: z.number().int().positive().max(20000) }).strict()).length(12);
export type CovManifest = z.infer<typeof covManifestSchema>;
export const covGrantSchema = z.object({
  version: z.literal('cov-authorization/1'), purpose: z.literal('EXPLORATORY_CALIBRATION'),
  approval: z.literal('EXPLICIT_USER_AUTHORIZATION'), authorizationId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  approvedAt: z.string().datetime(), expiresAt: z.string().datetime(),
  ledgerDirectory: z.string().min(1), manifestHash: hash,
  config: z.object({ model: z.literal('gpt-5.6-terra'), maxOutputTokens: z.literal(8000),
    maxInputBytes: z.literal(20000), timeoutMs: z.literal(60000) }).strict(),
  wirePolicy: z.object({ endpoint: z.literal(COV_WIRE_POLICY.endpoint), serviceTier: z.literal('default'),
    reasoningEffort: z.literal('medium'), retries: z.literal(0), store: z.literal(false) }).strict(),
  priceVersion: z.literal(COV_PRICE.version), currency: z.literal('USD'),
  budgetMicroUsd: z.number().int().positive().max(COV_PROPOSED_BUDGET_MICRO_USD),
  // Administrative attestation of counts obtained for EXACT projected requests. Not a local estimate.
  inputCounts: z.array(z.object({ id: z.enum(COV_FIRST_IDS), requestHash: hash,
    source: z.literal('PROVIDER_COMPLETE_INPUT_COUNT'), inputTokens: z.number().int().positive().max(272000),
    measuredAt: z.string().datetime() }).strict()).length(12),
}).strict();
export type CovGrant = z.infer<typeof covGrantSchema>;
export function covReservationMicroUsd(inputTokens: number): number {
  if (!Number.isSafeInteger(inputTokens) || inputTokens <= 0 || inputTokens > 272000) throw new Error('COV_INPUT_COUNT_REQUIRED');
  // All input at the highest applicable short-context rate; no cache-hit credit.
  return Math.ceil(inputTokens * COV_PRICE.cacheWrite + COV_FIRST_CONFIG.maxOutputTokens * COV_PRICE.output);
}
export function validateCovGrant(value: unknown, manifestInput: CovManifest, now = Date.now()): CovGrant {
  try {
    const manifest = covManifestSchema.parse(structuredClone(manifestInput));
    const grant = covGrantSchema.parse(structuredClone(value));
    if (manifest.some((m, i) => m.id !== COV_FIRST_IDS[i]) || grant.manifestHash !== covHash(manifest) ||
      Date.parse(grant.approvedAt) > now || Date.parse(grant.expiresAt) <= now ||
      Date.parse(grant.expiresAt) - Date.parse(grant.approvedAt) > 86400000 ||
      grant.inputCounts.some((c, i) => c.id !== manifest[i].id || c.requestHash !== manifest[i].requestHash ||
        Date.parse(c.measuredAt) > now || now - Date.parse(c.measuredAt) > 86400000)) throw new Error();
    return grant;
  } catch { throw new Error('COV_AUTHORIZATION_OR_INPUT_COUNTS_INVALID'); }
}
