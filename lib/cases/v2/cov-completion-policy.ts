import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { covGrantSchema, covManifestSchema, covHash, covReservationMicroUsd, type CovManifest } from './cov-experiment-policy';
import { covR2GrantSchema } from './cov-r2-diagnostic-policy';

// Deliberate diagnostic sequence only; no general retry or arbitrary example entry point.
export const COV_COMPLETION_IDS = ['P1', 'P2-WITHDRAW', 'P3-ADOPT', 'P4-LATE', 'R3'] as const;
export const covCompletionGrantSchema = covGrantSchema.extend({
  version: z.literal('cov-completion-authorization/1'), purpose: z.literal('P1_THEN_PENDING_THEN_R3'),
  exampleId: z.enum(COV_COMPLETION_IDS), inputCounts: z.array(covGrantSchema.shape.inputCounts.element).length(1),
  parents: z.array(covR2GrantSchema.shape.parent).min(5).max(9), accumulated: covR2GrantSchema.shape.accumulated,
}).strict();
export const covApplicabilityGrantSchema = covCompletionGrantSchema.extend({
  version: z.literal('cov-applicability-authorization/1'),
  parents: z.array(covR2GrantSchema.shape.parent).min(6).max(10),
}).strict();
export type CovCompletionGrant = z.infer<typeof covCompletionGrantSchema> | z.infer<typeof covApplicabilityGrantSchema>;
export const COV_COMPLETION_HISTORY = ['', '-r2-diagnostic', '-literal-continuation', '-source-r2', '-source-pending'] as const;
export function validateCovCompletionGrant(value: unknown, manifestInput: CovManifest, now = Date.now()): CovCompletionGrant {
  try {
    const g = z.union([covCompletionGrantSchema, covApplicabilityGrantSchema]).parse(structuredClone(value));
    const scoped = g.version === 'cov-applicability-authorization/1', baseCount = scoped ? 6 : 5;
    const prefix = scoped ? '-applicability-' : '-completion-';
    const index = COV_COMPLETION_IDS.indexOf(g.exampleId), manifest = z.array(covManifestSchema.element).length(1).parse(manifestInput);
    const count = g.inputCounts[0];
    if (g.parents.length !== baseCount + index || manifest[0].id !== g.exampleId || count.id !== g.exampleId ||
      count.requestHash !== manifest[0].requestHash || g.manifestHash !== covHash(manifest) ||
      Date.parse(g.approvedAt) > now || Date.parse(g.expiresAt) <= now || Date.parse(g.expiresAt) - Date.parse(g.approvedAt) > 86400000 ||
      Date.parse(count.measuredAt) > now || now - Date.parse(count.measuredAt) > 86400000) throw new Error();
    const root = resolve(g.parents[0].ledgerDirectory);
    const suffixes = [...COV_COMPLETION_HISTORY, ...(scoped ? ['-completion-P1'] : []), ...COV_COMPLETION_IDS.slice(0, index).map(id => prefix + id)];
    if (resolve(g.ledgerDirectory).toLowerCase() !== (root + prefix + g.exampleId).toLowerCase()) throw new Error();
    let reserved = 0;
    for (const [i, p] of g.parents.entries()) {
      const dir = resolve(p.ledgerDirectory);
      if (!isAbsolute(p.ledgerDirectory) || dir.toLowerCase() !== (root + suffixes[i]).toLowerCase() ||
        realpathSync(dir).toLowerCase() !== dir.toLowerCase() || existsSync(join(dir, 'execution.lock'))) throw new Error();
      const bytes = readFileSync(join(dir, 'journal.jsonl'));
      if (createHash('sha256').update(bytes).digest('hex') !== p.journalSha256 || !bytes.toString().endsWith('\n')) throw new Error();
      let previous = '0'.repeat(64), stopped = false;
      const sent: string[] = [], results = new Map<string, string>();
      bytes.toString().trim().split('\n').forEach((line, seq) => {
        const r = JSON.parse(line), { checksum, ...unsigned } = r;
        if (r.seq !== seq || r.previous !== previous || covHash(unsigned) !== checksum) throw new Error();
        previous = checksum;
        if (r.event.kind === 'RESERVED') {
          if (!Number.isSafeInteger(r.event.data) || r.event.data <= 0) throw new Error();
          reserved += r.event.data; sent.push(r.event.id);
        }
        if (r.event.kind === 'RESULT') {
          if (results.has(r.event.id)) throw new Error();
          results.set(r.event.id, r.event.data?.result?.status);
        }
        if (r.event.kind === 'STOP') stopped = true;
      });
      const expected = i === 0 ? ['R1', 'R2'] : i < 4 ? ['R2'] : i === 4
        ? ['R3', 'R-INJECTION', 'S1', 'S2', 'S3-ADOPT', 'S4-CONFLICT', 'P1'] : scoped && i === 5 ? ['P1'] : [COV_COMPLETION_IDS[i - baseCount]];
      if (sent.join(',') !== expected.join(',') || results.size !== expected.length || stopped !== (i < 3 || i === 4 || (scoped && i === 5))) throw new Error();
      for (const id of expected) {
        const status = (i < 3 && id === 'R2') || (i === 4 && id === 'P1') || (scoped && i === 5) ? 'TECHNICAL_FAILURE' : 'REVIEW_REQUIRED';
        if (results.get(id) !== status) throw new Error();
      }
    }
    if (reserved !== g.accumulated.priorReservedMicroUsd || reserved + g.budgetMicroUsd > g.accumulated.inferenceCeilingMicroUsd ||
      covReservationMicroUsd(count.inputTokens) > g.budgetMicroUsd) throw new Error();
    return g;
  } catch { throw new Error('COV_COMPLETION_AUTHORIZATION_OR_HISTORY_INVALID'); }
}
