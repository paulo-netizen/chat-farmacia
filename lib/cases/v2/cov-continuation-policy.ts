import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { covGrantSchema, covManifestSchema, covHash, covReservationMicroUsd, type CovManifest } from './cov-experiment-policy';
import { covR2GrantSchema } from './cov-r2-diagnostic-policy';

export const COV_CONTINUATION_IDS = ['R2', 'R3', 'R-INJECTION', 'S1', 'S2', 'S3-ADOPT', 'S4-CONFLICT', 'P1', 'P2-WITHDRAW', 'P3-ADOPT', 'P4-LATE'] as const;
const parentSchema = covR2GrantSchema.shape.parent;
export const covContinuationGrantSchema = covGrantSchema.extend({
  version: z.literal('cov-literal-continuation-authorization/1'), purpose: z.literal('R2_THEN_TEN_PENDING'),
  inputCounts: z.array(covGrantSchema.shape.inputCounts.element).length(11),
  parents: z.tuple([parentSchema, parentSchema]), accumulated: covR2GrantSchema.shape.accumulated,
}).strict();
export type CovContinuationGrant = z.infer<typeof covContinuationGrantSchema>;

/** Read-only history. Fixed child slot prevents repeating through a new authorization identity. */
export function validateCovContinuationGrant(value: unknown, manifestInput: CovManifest, now = Date.now()): CovContinuationGrant {
  try {
    const grant = covContinuationGrantSchema.parse(structuredClone(value));
    const manifest = z.array(covManifestSchema.element).length(11).parse(manifestInput);
    if (manifest.some((m, i) => m.id !== COV_CONTINUATION_IDS[i]) || grant.manifestHash !== covHash(manifest) ||
      Date.parse(grant.approvedAt) > now || Date.parse(grant.expiresAt) <= now ||
      Date.parse(grant.expiresAt) - Date.parse(grant.approvedAt) > 86400000 ||
      grant.inputCounts.some((c, i) => c.id !== manifest[i].id || c.requestHash !== manifest[i].requestHash ||
        Date.parse(c.measuredAt) > now || now - Date.parse(c.measuredAt) > 86400000)) throw new Error();
    const root = resolve(grant.parents[0].ledgerDirectory);
    if (resolve(grant.parents[1].ledgerDirectory).toLowerCase() !== (root + '-r2-diagnostic').toLowerCase() ||
      resolve(grant.ledgerDirectory).toLowerCase() !== (root + '-literal-continuation').toLowerCase()) throw new Error();
    let reserved = 0;
    for (const [index, parent] of grant.parents.entries()) {
      const dir = resolve(parent.ledgerDirectory);
      if (!isAbsolute(parent.ledgerDirectory) || realpathSync(dir).toLowerCase() !== dir.toLowerCase() || existsSync(join(dir, 'execution.lock'))) throw new Error();
      const bytes = readFileSync(join(dir, 'journal.jsonl'));
      if (createHash('sha256').update(bytes).digest('hex') !== parent.journalSha256 || !bytes.toString().endsWith('\n')) throw new Error();
      let previous = '0'.repeat(64), stopped = false, failedR2 = false, validR1 = false;
      const ids: string[] = [];
      bytes.toString().trim().split('\n').forEach((line, seq) => {
        const r = JSON.parse(line), { checksum, ...unsigned } = r;
        if (r.seq !== seq || r.previous !== previous || covHash(unsigned) !== checksum) throw new Error();
        previous = checksum;
        if (r.event.kind === 'RESERVED') {
          if (!Number.isSafeInteger(r.event.data) || r.event.data <= 0) throw new Error();
          reserved += r.event.data; ids.push(r.event.id);
        }
        if (r.event.kind === 'RESULT' && r.event.id === 'R2' && r.event.data?.result?.status === 'TECHNICAL_FAILURE') failedR2 = true;
        if (r.event.kind === 'RESULT' && r.event.id === 'R1' && r.event.data?.result?.status === 'REVIEW_REQUIRED') validR1 = true;
        if (r.event.kind === 'STOP') stopped = true;
      });
      if (!stopped || !failedR2 || (index === 0 && !validR1) || ids.join(',') !== (index === 0 ? 'R1,R2' : 'R2')) throw new Error();
    }
    if (reserved !== grant.accumulated.priorReservedMicroUsd || reserved + grant.budgetMicroUsd > grant.accumulated.inferenceCeilingMicroUsd ||
      grant.inputCounts.reduce((sum, c) => sum + covReservationMicroUsd(c.inputTokens), 0) > grant.budgetMicroUsd) throw new Error();
    return grant;
  } catch { throw new Error('COV_CONTINUATION_AUTHORIZATION_OR_HISTORY_INVALID'); }
}
