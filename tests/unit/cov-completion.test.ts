import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,dirname,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { runCovCompletion } from '../../tools/cov-calibration/completion';
import { COV_COMPLETION_HISTORY, COV_COMPLETION_IDS } from '../../lib/cases/v2/cov-completion-policy';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { COV_FIRST_CONFIG,COV_WIRE_POLICY,COV_PRICE,covHash } from '../../lib/cases/v2/cov-experiment-policy';
const dirs:string[]=[];
afterEach(()=>dirs.splice(0).forEach(d=>{expect(dirname(resolve(d))).toBe(resolve(tmpdir()));rmSync(d,{recursive:true,force:true});}));
const parent=(ledgerDirectory:string)=>({ledgerDirectory,journalSha256:createHash('sha256').update(readFileSync(join(ledgerDirectory,'journal.jsonl'))).digest('hex')});
async function setup(){
  const dir=mkdtempSync(join(tmpdir(),'cov-completion-'));dirs.push(dir);const root=join(dir,'original');
  let reserved=0;
  for(const [i,suffix] of COV_COMPLETION_HISTORY.entries()){
    const d=root+suffix;mkdirSync(d);let previous='0'.repeat(64);
    const ids=i===0?['R1','R2']:i<4?['R2']:['R3','R-INJECTION','S1','S2','S3-ADOPT','S4-CONFLICT','P1'];
    const events:any[]=[{kind:'INIT',data:'synthetic'}];
    ids.forEach(id=>{reserved+=103500;events.push({kind:'RESERVED',id,data:103500},{kind:'RESULT',id,data:{result:{status:(i<3&&id==='R2')||(i===4&&id==='P1')?'TECHNICAL_FAILURE':'REVIEW_REQUIRED'}}});});
    if(i!==3)events.push({kind:'STOP',data:null});
    writeFileSync(join(d,'journal.jsonl'),events.map((event,seq)=>{const r={seq,previous,event};previous=covHash(r);return JSON.stringify({...r,checksum:previous});}).join('\n')+'\n');
  }
  const p=await prepareFirstCovBatch(),now=new Date().toISOString();
  const grantFor=(id:typeof COV_COMPLETION_IDS[number])=>{const index=COV_COMPLETION_IDS.indexOf(id),manifest=p.manifest.filter(m=>m.id===id);return{
    version:'cov-completion-authorization/1',purpose:'P1_THEN_PENDING_THEN_R3',exampleId:id,approval:'EXPLICIT_USER_AUTHORIZATION',authorizationId:'SYNTHETIC_'+id,approvedAt:now,expiresAt:new Date(Date.parse(now)+3600000).toISOString(),ledgerDirectory:root+'-completion-'+id,manifestHash:covHash(manifest),config:COV_FIRST_CONFIG,wirePolicy:COV_WIRE_POLICY,priceVersion:COV_PRICE.version,currency:'USD',budgetMicroUsd:103500,
    inputCounts:manifest.map(m=>({id,requestHash:m.requestHash,source:'PROVIDER_COMPLETE_INPUT_COUNT',inputTokens:3000,measuredAt:now})),
    parents:[...COV_COMPLETION_HISTORY.map(s=>root+s),...COV_COMPLETION_IDS.slice(0,index).map(id=>root+'-completion-'+id)].map(parent),
    accumulated:{totalAuthorizedEur:15,inferenceCeilingMicroUsd:2000000,priorReservedMicroUsd:reserved+index*103500,countingCost:null,unknownCountingCostAccepted:true}};};
  return {p,grantFor};
}
function client(failure=false){const parse=vi.fn(async(body:any)=>{const q=JSON.parse(body.input);return {status:'completed',model:body.model,service_tier:'default',output:[],id:'resp_synthetic',_request_id:'req_synthetic',usage:{input_tokens:3000,output_tokens:30},output_parsed:failure?{}:q.contractVersion==='personalization-request/2'?{contractVersion:'personalization-sources-adjudication/3',requestDigest:q.requestDigest,difficulty:{status:'UNCERTAIN',evidence:[]},links:[],incompatibilities:[],criteria:q.requirements.configuration.elements.map((r:any)=>({requirementId:r.requirementId,status:'UNCERTAIN',linkRef:null,studentEvidence:[]}))}:{contractVersion:'referral-report-sources-adjudication/3',requestDigest:q.requestDigest,documentKind:'WRITTEN_REPORT',claims:[],criteria:q.untrustedData.requirements.map((r:any)=>({contentId:r.contentId,status:'UNCERTAIN',reportEvidence:[],sourceEvidence:[]}))}};});return{parse,factory:()=>({baseURL:COV_WIRE_POLICY.endpoint,responses:{parse}}) as never};}
describe('closed five-example completion sequence',()=>{
  it('is dry by default and rejects examples outside the approved five',async()=>{
    expect((await runCovCompletion()).plannedCalls).toBe(1);
    await expect(runCovCompletion({exampleId:'R2' as never})).rejects.toThrow();
  });
  it('advances once per example after valid disagreements; parents remain unchanged',async()=>{
    const {grantFor}=await setup(),fake=client();
    for(const exampleId of COV_COMPLETION_IDS){const g=grantFor(exampleId);const r=await runCovCompletion({mode:'live',exampleId,authorization:g,clientFactory:fake.factory});expect(r.stopped).toBe(false);
      await runCovCompletion({mode:'live',exampleId,authorization:g,clientFactory:()=>{throw Error();}});
      g.parents.forEach(p=>expect(parent(p.ledgerDirectory)).toEqual(p));}
    expect(fake.parse).toHaveBeenCalledTimes(5);
  });
  it('blocks all later examples after technical failure and conserves metadata',async()=>{
    const {grantFor}=await setup(),g=grantFor('P1'),fake=client(true);
    expect((await runCovCompletion({mode:'live',authorization:g,clientFactory:fake.factory})).stopped).toBe(true);
    await expect(runCovCompletion({mode:'live',authorization:g,clientFactory:fake.factory})).rejects.toThrow();
    await expect(runCovCompletion({mode:'live',exampleId:'P2-WITHDRAW',authorization:grantFor('P2-WITHDRAW'),clientFactory:fake.factory})).rejects.toThrow();
    const log=readFileSync(join(g.ledgerDirectory,'journal.jsonl'),'utf8');expect(log).toContain('req_synthetic');expect(log).toContain('PROVIDER_SCHEMA_INVALID');expect(log).toContain('inputTokens');expect(fake.parse).toHaveBeenCalledTimes(1);
  });
  it('blocks simultaneous and uncertain requests, keeping reservation',async()=>{
    const {grantFor,p}=await setup(),g=grantFor('P1'),m=p.manifest.filter(m=>m.id==='P1');
    const s=CovExecutionSession.openCompletion(g,m);try{expect(()=>CovExecutionSession.openCompletion(g,m)).toThrow();s.reserve(m[0].requestHash,COV_FIRST_CONFIG);}finally{s.close();}
    const fake=client();await expect(runCovCompletion({mode:'live',authorization:g,clientFactory:fake.factory})).rejects.toThrow();expect(fake.parse).not.toHaveBeenCalled();
  });
  it.each(['budget','expired','parent','directory','example','model'])('blocks invalid %s without transport',async kind=>{
    const {grantFor}=await setup(),g=structuredClone(grantFor('P1')),fake=client();
    if(kind==='budget')g.budgetMicroUsd=1;if(kind==='expired')g.inputCounts[0].measuredAt='2020-01-01T00:00:00Z';if(kind==='parent')g.parents[4].journalSha256='0'.repeat(64);if(kind==='directory')g.ledgerDirectory+='-again';if(kind==='example')g.exampleId='R1' as never;if(kind==='model')g.config={...g.config,model:'different' as never};
    await expect(runCovCompletion({mode:'live',authorization:g,clientFactory:fake.factory})).rejects.toThrow();expect(fake.parse).not.toHaveBeenCalled();
  });
});
