import {readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {covGrantSchema,covManifestSchema,covHash,covReservationMicroUsd,type CovManifest} from './cov-experiment-policy';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
export const frameworkR3GrantSchema=covGrantSchema.extend({
 version:z.literal('cov-framework-r3/1'),purpose:z.literal('APPROVED_FRAMEWORK_R3_DIAGNOSTIC'),
 inputCounts:z.array(covGrantSchema.shape.inputCounts.element.extend({id:z.literal('R3')})).length(1),
 parents:z.array(z.object({file:z.string(),sha256:hash}).strict()).min(2),
 accumulated:z.object({totalAuthorizedEur:z.literal(15),priorReservedMicroUsd:z.number().int().nonnegative(),
  priorCalculatedMicroUsd:z.number().nonnegative(),unknownCounts:z.number().int().positive(),
  unknownCountingCostAccepted:z.literal(true),inferenceCeilingMicroUsd:z.literal(6000000)}).strict(),
}).strict();
export type FrameworkR3Grant=z.infer<typeof frameworkR3GrantSchema>;
/** One closed slot for this explicitly authorized follow-up. Historical journals remain read-only. */
export function validateFrameworkR3Grant(value:unknown,manifestInput:CovManifest,now=Date.now()):FrameworkR3Grant{
 try{
  const g=frameworkR3GrantSchema.parse(structuredClone(value));
  const m=z.array(covManifestSchema.element.extend({id:z.literal('R3')})).length(1).parse(manifestInput),c=g.inputCounts[0];
  if(g.manifestHash!==covHash(m)||c.requestHash!==m[0].requestHash||Date.parse(g.approvedAt)>now||Date.parse(g.expiresAt)<=now||Date.parse(g.expiresAt)-Date.parse(g.approvedAt)>86400000||Date.parse(c.measuredAt)>now||now-Date.parse(c.measuredAt)>86400000)throw Error();
  const root=resolve('.env.teacher-framework.local');
  if(resolve(g.ledgerDirectory).toLowerCase()!==join(root,'r3-inference').toLowerCase())throw Error();
  for(const p of g.parents){if(createHash('sha256').update(readFileSync(p.file)).digest('hex')!==p.sha256)throw Error();}
  if(!['budget.json','authorization.json','maria/budget.json'].every(file=>g.parents.some(p=>resolve(p.file).toLowerCase()===join(root,file).toLowerCase()))||existsSync(join(root,'audit.lock'))||existsSync(join(root,'maria','audit.lock')))throw Error();
  const prior=JSON.parse(readFileSync(join(root,'authorization.json'),'utf8')),lucia=JSON.parse(readFileSync(join(root,'budget.json'),'utf8')),maria=JSON.parse(readFileSync(join(root,'maria','budget.json'),'utf8'));
  const ledger={entries:[...lucia.entries,...maria.entries]};
  if(!Array.isArray(ledger.entries)||ledger.entries.some((e:any)=>!['RECEIVED','FAILED'].includes(e.state)||!Number.isSafeInteger(e.reservation)||!e.usage||typeof e.costMicroUsd!=='number')||
   g.accumulated.priorReservedMicroUsd!==prior.historicalReservedMicroUsd+ledger.entries.reduce((n:number,e:any)=>n+e.reservation,0)||
   g.accumulated.priorCalculatedMicroUsd!==prior.historicalCalculatedMicroUsd+ledger.entries.reduce((n:number,e:any)=>n+e.costMicroUsd,0)||
   g.accumulated.unknownCounts!==prior.historicalUnknownCounts+ledger.entries.length+1)throw Error();
  const maximum=covReservationMicroUsd(c.inputTokens);
  if(maximum>g.budgetMicroUsd||g.accumulated.priorReservedMicroUsd+g.budgetMicroUsd>g.accumulated.inferenceCeilingMicroUsd)throw Error();
  return g;
 }catch{throw Error('COV_FRAMEWORK_R3_AUTHORIZATION_INVALID');}
}
