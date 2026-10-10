import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { covGrantSchema, covManifestSchema, covHash, covReservationMicroUsd, type CovManifest } from './cov-experiment-policy';
import { covR2GrantSchema } from './cov-r2-diagnostic-policy';
export const COV_SOURCE_PENDING_IDS = Object.freeze(['R3','R-INJECTION','S1','S2','S3-ADOPT','S4-CONFLICT','P1','P2-WITHDRAW','P3-ADOPT','P4-LATE'] as const);
export const covSourceRunGrantSchema = covGrantSchema.extend({
  version: z.literal('cov-source-run-authorization/1'), purpose: z.enum(['SOURCE_R2_ONLY','SOURCE_TEN_PENDING']),
  inputCounts: z.array(covGrantSchema.shape.inputCounts.element).min(1).max(10),
  parents: z.array(covR2GrantSchema.shape.parent).min(3).max(4), accumulated: covR2GrantSchema.shape.accumulated,
}).strict();
export type CovSourceRunGrant = z.infer<typeof covSourceRunGrantSchema>;
export function validateCovSourceRunGrant(value: unknown, manifestInput: CovManifest, now = Date.now()): CovSourceRunGrant {
  try {
    const g = covSourceRunGrantSchema.parse(structuredClone(value));
    const ids = g.purpose === 'SOURCE_R2_ONLY' ? ['R2'] : COV_SOURCE_PENDING_IDS;
    const manifest = z.array(covManifestSchema.element).length(ids.length).parse(manifestInput);
    if (g.parents.length !== (ids.length === 1 ? 3 : 4) || g.inputCounts.length !== ids.length ||
      manifest.some((m,i)=>m.id!==ids[i]) || g.manifestHash!==covHash(manifest) || Date.parse(g.approvedAt)>now || Date.parse(g.expiresAt)<=now ||
      Date.parse(g.expiresAt)-Date.parse(g.approvedAt)>86400000 || g.inputCounts.some((c,i)=>c.id!==ids[i] || c.requestHash!==manifest[i].requestHash || Date.parse(c.measuredAt)>now || now-Date.parse(c.measuredAt)>86400000)) throw new Error();
    const root = resolve(g.parents[0].ledgerDirectory);
    const suffixes = ['', '-r2-diagnostic', '-literal-continuation', '-source-r2'];
    if (resolve(g.ledgerDirectory).toLowerCase() !== (root + (ids.length===1 ? '-source-r2' : '-source-pending')).toLowerCase()) throw new Error();
    let reserved = 0;
    for (const [i,p] of g.parents.entries()) {
      const dir=resolve(p.ledgerDirectory);
      if (!isAbsolute(p.ledgerDirectory) || dir.toLowerCase()!==(root+suffixes[i]).toLowerCase() || realpathSync(dir).toLowerCase()!==dir.toLowerCase() || existsSync(join(dir,'execution.lock'))) throw new Error();
      const bytes=readFileSync(join(dir,'journal.jsonl'));
      if(createHash('sha256').update(bytes).digest('hex')!==p.journalSha256 || !bytes.toString().endsWith('\n')) throw new Error();
      let previous='0'.repeat(64),stopped=false,r2Status='',r1Status=''; const sent:string[]=[];
      bytes.toString().trim().split('\n').forEach((line,seq)=>{
        const r=JSON.parse(line),{checksum,...unsigned}=r;
        if(r.seq!==seq || r.previous!==previous || covHash(unsigned)!==checksum) throw new Error(); previous=checksum;
        if(r.event.kind==='RESERVED') {if(!Number.isSafeInteger(r.event.data)||r.event.data<=0)throw new Error(); reserved+=r.event.data; sent.push(r.event.id);}
        if(r.event.kind==='RESULT'&&r.event.id==='R2') r2Status=r.event.data?.result?.status;
        if(r.event.kind==='RESULT'&&r.event.id==='R1') r1Status=r.event.data?.result?.status;
        if(r.event.kind==='STOP')stopped=true;
      });
      if(sent.join(',')!==(i===0?'R1,R2':'R2') || (i===0&&r1Status!=='REVIEW_REQUIRED') ||
        (i<3 ? !stopped||r2Status!=='TECHNICAL_FAILURE' : stopped||r2Status!=='REVIEW_REQUIRED')) throw new Error();
    }
    if(reserved!==g.accumulated.priorReservedMicroUsd || reserved+g.budgetMicroUsd>g.accumulated.inferenceCeilingMicroUsd ||
      g.inputCounts.reduce((s,c)=>s+covReservationMicroUsd(c.inputTokens),0)>g.budgetMicroUsd) throw new Error();
    return g;
  } catch {throw new Error('COV_SOURCE_RUN_AUTHORIZATION_OR_HISTORY_INVALID');}
}
