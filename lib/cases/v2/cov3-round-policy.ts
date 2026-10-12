import { readFileSync, realpathSync, existsSync } from 'node:fs';
import { resolve, join, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { covGrantSchema, covManifestSchema, covHash, covReservationMicroUsd, type CovManifest } from './cov-experiment-policy';
import { covR2GrantSchema } from './cov-r2-diagnostic-policy';
import type { CovDiagnostic } from './cov-diagnostics';

export const COV3_ROUND_IDS = ['P1','P2-WITHDRAW','P3-ADOPT','P4-LATE'] as const;
export const COV3_ROUND_HISTORY = ['', '-r2-diagnostic','-literal-continuation','-source-r2','-source-pending','-completion-P1','-applicability-P1'] as const;
export const cov3RoundGrantSchema = covGrantSchema.extend({
  version:z.literal('cov3-canonical-diagnostic-authorization/1'), purpose:z.literal('FOUR_INDEPENDENT_COV3_DIAGNOSTICS'),
  inputCounts:z.array(covGrantSchema.shape.inputCounts.element).length(4),
  parents:z.array(covR2GrantSchema.shape.parent).length(7), accumulated:covR2GrantSchema.shape.accumulated,
}).strict();
export type Cov3RoundGrant = z.infer<typeof cov3RoundGrantSchema>;
/** Only failures of a definitely received, compatible response may be independent. */
export function cov3ReceivedFailureIsIndependent(d: CovDiagnostic | undefined): boolean {
  return !!d && (d.code === 'RESPONSE_JSON_INVALID' || d.code === 'PROVIDER_SCHEMA_INVALID' || d.stage === 'VALIDATION' ||
    (!!d.issues?.length && d.issues.every(i=>i.stage==='ADAPTER' && i.code.startsWith('SOURCE_'))));
}
export function validateCov3RoundGrant(value:unknown,manifestInput:CovManifest,now=Date.now()):Cov3RoundGrant {
  try {
    const g=cov3RoundGrantSchema.parse(structuredClone(value));
    const manifest=z.array(covManifestSchema.element).length(4).parse(manifestInput);
    if(manifest.some((m,i)=>m.id!==COV3_ROUND_IDS[i]) || g.manifestHash!==covHash(manifest) ||
      Date.parse(g.approvedAt)>now || Date.parse(g.expiresAt)<=now || Date.parse(g.expiresAt)-Date.parse(g.approvedAt)>86400000 ||
      g.inputCounts.some((c,i)=>c.id!==manifest[i].id || c.requestHash!==manifest[i].requestHash || Date.parse(c.measuredAt)>now || now-Date.parse(c.measuredAt)>86400000))throw Error();
    const root=resolve(g.parents[0].ledgerDirectory);
    if(resolve(g.ledgerDirectory).toLowerCase()!==(root+'-canonical-four').toLowerCase())throw Error();
    let reserved=0;
    for(const [i,p] of g.parents.entries()){
      const dir=resolve(p.ledgerDirectory);
      if(!isAbsolute(p.ledgerDirectory)||dir.toLowerCase()!==(root+COV3_ROUND_HISTORY[i]).toLowerCase()||realpathSync(dir).toLowerCase()!==dir.toLowerCase()||existsSync(join(dir,'execution.lock')))throw Error();
      const bytes=readFileSync(join(dir,'journal.jsonl'));
      if(createHash('sha256').update(bytes).digest('hex')!==p.journalSha256 || !bytes.toString().endsWith('\n'))throw Error();
      let previous='0'.repeat(64),stopped=false;const sent:string[]=[],results=new Map<string,string>();
      bytes.toString().trim().split('\n').forEach((line,seq)=>{const r=JSON.parse(line),{checksum,...u}=r;if(r.seq!==seq||r.previous!==previous||covHash(u)!==checksum)throw Error();previous=checksum;
        if(r.event.kind==='RESERVED'){if(!Number.isSafeInteger(r.event.data)||r.event.data<=0)throw Error();reserved+=r.event.data;sent.push(r.event.id);}
        if(r.event.kind==='RESULT'){if(results.has(r.event.id))throw Error();results.set(r.event.id,r.event.data?.result?.status);}
        if(r.event.kind==='STOP')stopped=true;
      });
      const expected=i===0?['R1','R2']:i<4?['R2']:i===4?['R3','R-INJECTION','S1','S2','S3-ADOPT','S4-CONFLICT','P1']:['P1'];
      if(sent.join(',')!==expected.join(',')||results.size!==expected.length||stopped!==(i!==3))throw Error();
      for(const id of expected){const failed=(i<3&&id==='R2')||(i>=4&&id==='P1');if(results.get(id)!==(failed?'TECHNICAL_FAILURE':'REVIEW_REQUIRED'))throw Error();}
    }
    const maximum=g.inputCounts.reduce((n,c)=>n+covReservationMicroUsd(c.inputTokens),0);
    if(reserved!==g.accumulated.priorReservedMicroUsd||maximum>g.budgetMicroUsd||reserved+g.budgetMicroUsd>g.accumulated.inferenceCeilingMicroUsd)throw Error();
    return g;
  }catch{throw new Error('COV3_ROUND_AUTHORIZATION_OR_HISTORY_INVALID');}
}
