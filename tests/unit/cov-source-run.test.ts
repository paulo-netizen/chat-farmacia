import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,dirname,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { runCovSourcePhase } from '../../tools/cov-calibration/source-run';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { COV_FIRST_CONFIG,COV_WIRE_POLICY,COV_PRICE,covHash } from '../../lib/cases/v2/cov-experiment-policy';
const dirs:string[]=[];
afterEach(()=>dirs.splice(0).forEach(d=>{expect(dirname(resolve(d))).toBe(resolve(tmpdir()));rmSync(d,{recursive:true,force:true});}));
const parent=(ledgerDirectory:string)=>({ledgerDirectory,journalSha256:createHash('sha256').update(readFileSync(join(ledgerDirectory,'journal.jsonl'))).digest('hex')});
async function setup(){
  const dir=mkdtempSync(join(tmpdir(),'cov-source-run-'));dirs.push(dir);const root=join(dir,'original');
  for(const [i,suffix] of ['','-r2-diagnostic','-literal-continuation'].entries()){
    const d=root+suffix;mkdirSync(d);let previous='0'.repeat(64);
    const events=[{kind:'INIT',data:'synthetic'},...(i===0?[{kind:'RESERVED',id:'R1',data:101910},{kind:'RESULT',id:'R1',data:{result:{status:'REVIEW_REQUIRED'}}}]:[]),
      {kind:'RESERVED',id:'R2',data:101910},{kind:'RESULT',id:'R2',data:{result:{status:'TECHNICAL_FAILURE'}}},{kind:'STOP',data:null}];
    writeFileSync(join(d,'journal.jsonl'),events.map((event,seq)=>{const r={seq,previous,event};previous=covHash(r);return JSON.stringify({...r,checksum:previous});}).join('\n')+'\n');
  }
  const p=await prepareFirstCovBatch(),now=new Date().toISOString();
  const grant={version:'cov-source-run-authorization/1',purpose:'SOURCE_R2_ONLY',approval:'EXPLICIT_USER_AUTHORIZATION',authorizationId:'SYNTHETIC_R2',approvedAt:now,expiresAt:new Date(Date.parse(now)+3600000).toISOString(),ledgerDirectory:root+'-source-r2',manifestHash:covHash(p.manifest.slice(1,2)),config:COV_FIRST_CONFIG,wirePolicy:COV_WIRE_POLICY,priceVersion:COV_PRICE.version,currency:'USD',budgetMicroUsd:103500,
    inputCounts:p.manifest.slice(1,2).map(m=>({id:m.id,requestHash:m.requestHash,source:'PROVIDER_COMPLETE_INPUT_COUNT',inputTokens:3000,measuredAt:now})),
    parents:['','-r2-diagnostic','-literal-continuation'].map(s=>parent(root+s)),accumulated:{totalAuthorizedEur:15,inferenceCeilingMicroUsd:2000000,priorReservedMicroUsd:407640,countingCost:null,unknownCountingCostAccepted:true}};
  const pending=()=>({...grant,purpose:'SOURCE_TEN_PENDING',authorizationId:'SYNTHETIC_PENDING',ledgerDirectory:root+'-source-pending',manifestHash:covHash(p.manifest.slice(2)),budgetMicroUsd:1035000,
    inputCounts:p.manifest.slice(2).map(m=>({...grant.inputCounts[0],id:m.id,requestHash:m.requestHash})),parents:[...grant.parents,parent(grant.ledgerDirectory)],accumulated:{...grant.accumulated,priorReservedMicroUsd:511140}});
  return {grant,p,pending};
}
function client(fail=false){const parse=vi.fn(async(body:any)=>{const q=JSON.parse(body.input);return {status:'completed',model:body.model,service_tier:'default',output:[],usage:{input_tokens:3000,output_tokens:30},output_parsed:fail?{}:{contractVersion:'referral-report-sources-adjudication/3',requestDigest:q.requestDigest,documentKind:'WRITTEN_REPORT',claims:[],criteria:q.untrustedData.requirements.map((r:any)=>({contentId:r.contentId,status:'UNCERTAIN',reportEvidence:[],sourceEvidence:[]}))}};});return{parse,factory:()=>({baseURL:COV_WIRE_POLICY.endpoint,responses:{parse}}) as never};}
describe('two closed source calibration phases',()=>{
  it('defaults to R2 only and exposes a separate dry manifest for the ten pending',async()=>{
    expect((await runCovSourcePhase()).plannedCalls).toBe(1);expect((await runCovSourcePhase({phase:'PENDING'})).plannedCalls).toBe(10);
    await expect(runCovSourcePhase({phase:'R1' as never})).rejects.toThrow();
  });
  it('accepts a technically valid disagreement as the durable prerequisite, without repeating R2',async()=>{
    const {grant,p,pending}=await setup(),fake=client();
    expect((await runCovSourcePhase({mode:'live',authorization:grant,clientFactory:fake.factory})).stopped).toBe(false);
    await runCovSourcePhase({mode:'live',authorization:grant,clientFactory:()=>{throw new Error('must not create');}});expect(fake.parse).toHaveBeenCalledTimes(1);
    const s=CovExecutionSession.openSourceRun(pending(),p.manifest.slice(2));s.close();
    grant.parents.forEach(p=>expect(parent(p.ledgerDirectory)).toEqual(p));
  });
  it('does not permit the pending phase after failed R2 or any repetition of the failed call',async()=>{
    const {grant,p,pending}=await setup(),fake=client(true);
    expect((await runCovSourcePhase({mode:'live',authorization:grant,clientFactory:fake.factory})).stopped).toBe(true);
    expect(()=>CovExecutionSession.openSourceRun(pending(),p.manifest.slice(2))).toThrow();
    await expect(runCovSourcePhase({mode:'live',authorization:grant,clientFactory:fake.factory})).rejects.toThrow();expect(fake.parse).toHaveBeenCalledTimes(1);
  });
  it('blocks concurrent calls and uncertain reservation recovery',async()=>{
    const {grant,p}=await setup();const s=CovExecutionSession.openSourceRun(grant,p.manifest.slice(1,2));
    try{expect(()=>CovExecutionSession.openSourceRun(grant,p.manifest.slice(1,2))).toThrow('COV_LEDGER_LOCKED');s.reserve(p.manifest[1].requestHash,COV_FIRST_CONFIG);}finally{s.close();}
    const fake=client();await expect(runCovSourcePhase({mode:'live',authorization:grant,clientFactory:fake.factory})).rejects.toThrow();expect(fake.parse).not.toHaveBeenCalled();
  });
  it.each(['R1','budget','expired','directory','parent','phase'])('rejects invalid %s before transport',async change=>{
    const {grant}=await setup(),fake=client();
    if(change==='R1')grant.inputCounts[0].id='R1';if(change==='budget')grant.budgetMicroUsd=1;
    if(change==='expired')grant.inputCounts[0].measuredAt='2020-01-01T00:00:00Z';
    if(change==='directory')grant.ledgerDirectory+='-another';if(change==='parent')grant.parents[2].journalSha256='0'.repeat(64);
    if(change==='phase')grant.purpose='SOURCE_TEN_PENDING';
    await expect(runCovSourcePhase({mode:'live',authorization:grant,clientFactory:fake.factory})).rejects.toThrow();expect(fake.parse).not.toHaveBeenCalled();
  });
});
