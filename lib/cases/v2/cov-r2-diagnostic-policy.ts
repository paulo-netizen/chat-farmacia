import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { covGrantSchema, covManifestSchema, covHash, covReservationMicroUsd, type CovManifest } from './cov-experiment-policy';

export const covR2GrantSchema = covGrantSchema.extend({
  version: z.literal('cov-r2-diagnostic-authorization/1'), purpose: z.literal('R2_DIAGNOSTIC_ONLY'),
  inputCounts: z.array(covGrantSchema.shape.inputCounts.element.extend({ id: z.literal('R2') })).length(1),
  parent: z.object({ ledgerDirectory: z.string(), journalSha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  accumulated: z.object({ totalAuthorizedEur: z.literal(15), inferenceCeilingMicroUsd: z.literal(2000000),
    priorReservedMicroUsd: z.number().int().nonnegative(), countingCost: z.null(), unknownCountingCostAccepted: z.literal(true) }).strict(),
}).strict();
export type CovR2Grant = z.infer<typeof covR2GrantSchema>;

/** Read-only parent check; no locks, append or recovery on the failed batch. */
export function validateCovR2Grant(value: unknown, manifestInput: CovManifest, now = Date.now()): CovR2Grant {
  try {
    const grant = covR2GrantSchema.parse(structuredClone(value));
    const manifest = z.array(covManifestSchema.element.extend({ id: z.literal('R2') })).length(1).parse(manifestInput);
    const c = grant.inputCounts[0];
    if (grant.manifestHash !== covHash(manifest) || c.requestHash !== manifest[0].requestHash ||
      Date.parse(grant.approvedAt) > now || Date.parse(grant.expiresAt) <= now ||
      Date.parse(grant.expiresAt) - Date.parse(grant.approvedAt) > 86400000 ||
      Date.parse(c.measuredAt) > now || now - Date.parse(c.measuredAt) > 86400000) throw new Error();
    const parent = resolve(grant.parent.ledgerDirectory);
    // One fixed diagnostic slot per original journal, regardless of authorization ID changes.
    if (!isAbsolute(grant.parent.ledgerDirectory) || realpathSync(parent).toLowerCase() !== parent.toLowerCase() ||
      resolve(grant.ledgerDirectory).toLowerCase() !== (parent + '-r2-diagnostic').toLowerCase() ||
      existsSync(join(parent, 'execution.lock'))) throw new Error();
    const bytes = readFileSync(join(parent, 'journal.jsonl'));
    if (createHash('sha256').update(bytes).digest('hex') !== grant.parent.journalSha256 || !bytes.toString().endsWith('\n')) throw new Error();
    const lines = bytes.toString().trim().split('\n').map(line => JSON.parse(line));
    let previous = '0'.repeat(64), reserved = 0, failedR2 = false, stopped = false;
    const ids: string[] = [];
    lines.forEach((r, i) => {
      const { checksum, ...unsigned } = r;
      if (r.seq !== i || r.previous !== previous || covHash(unsigned) !== checksum) throw new Error();
      previous = checksum;
      if (r.event.kind === 'RESERVED') {
        if (!Number.isSafeInteger(r.event.data) || r.event.data <= 0) throw new Error();
        reserved += r.event.data; ids.push(r.event.id);
      }
      if (r.event.kind === 'RESULT' && r.event.id === 'R2' && r.event.data?.result?.status === 'TECHNICAL_FAILURE') failedR2 = true;
      if (r.event.kind === 'STOP') stopped = true;
    });
    if (!failedR2 || !stopped || ids.join(',') !== 'R1,R2' || reserved !== grant.accumulated.priorReservedMicroUsd ||
      reserved + grant.budgetMicroUsd > grant.accumulated.inferenceCeilingMicroUsd ||
      covReservationMicroUsd(c.inputTokens) > grant.budgetMicroUsd) throw new Error();
    return grant;
  } catch { throw new Error('COV_R2_AUTHORIZATION_OR_PARENT_INVALID'); }
}
