import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,dirname,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { runR3Check } from '../../tools/cov-calibration/r3-check';
import { createCovClientFromSdk } from '../../tools/cov-calibration/first-batch';
import { COV_R3_CHECK_HISTORY } from '../../lib/cases/v2/cov-r3-check-policy';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { COV_FIRST_CONFIG,COV_WIRE_POLICY,COV_PRICE,covHash } from '../../lib/cases/v2/cov-experiment-policy';

const dirs:string[]=[];
vi.mock('node:fs',async original=>{const actual=await original<typeof import('node:fs')>();return {...actual,fsyncSync:vi.fn(actual.fsyncSync)};});
afterEach(()=>dirs.splice(0).forEach(d=>{expect(dirname(resolve(d))).toBe(resolve(tmpdir()));rmSync(d,{recursive:true,force:true});}));
const parent=(ledgerDirectory:string)=>({ledgerDirectory,journalSha256:createHash('sha256').update(readFileSync(join(ledgerDirectory,'journal.jsonl'))).digest('hex')});
async function setup(){
  const dir=mkdtempSync(join(tmpdir(),'cov-completion-'));dirs.push(dir);const root=join(dir,'original');
  let reserved=0;
  for(const [i,suffix] of COV_R3_CHECK_HISTORY.entries()){
    const d=root+suffix;mkdirSync(d);let previous='0'.repeat(64);
    const ids=i===7?['P1','P2-WITHDRAW','P3-ADOPT','P4-LATE']:i===0?['R1','R2']:i<4?['R2']:i>=5?['P1']:['R3','R-INJECTION','S1','S2','S3-ADOPT','S4-CONFLICT','P1'];
    const events:any[]=[{kind:'INIT',data:'synthetic'}];
    ids.forEach(id=>{reserved+=103500;events.push({kind:'RESERVED',id,data:103500},{kind:'RESULT',id,data:{result:{status:(i<3&&id==='R2')||(i>=4&&i<7&&id==='P1')?'TECHNICAL_FAILURE':'REVIEW_REQUIRED'}}});});
    if(i!==3&&i!==7)events.push({kind:'STOP',data:null});
    writeFileSync(join(d,'journal.jsonl'),events.map((event,seq)=>{const r={seq,previous,event};previous=covHash(r);return JSON.stringify({...r,checksum:previous});}).join('\n')+'\n');
  }
  const all=await prepareFirstCovBatch('canonical/5'),manifest=all.manifest.filter(m=>m.id==='R3'),now=new Date().toISOString();
  const grant={version:'cov-r3-check-authorization/1',purpose:'SINGLE_R3_CHECK_AFTER_CANONICAL',approval:'EXPLICIT_USER_AUTHORIZATION',authorizationId:'SYNTHETIC_CANONICAL',approvedAt:now,expiresAt:new Date(Date.parse(now)+3600000).toISOString(),ledgerDirectory:root+'-r3-check',manifestHash:covHash(manifest),config:COV_FIRST_CONFIG,wirePolicy:COV_WIRE_POLICY,priceVersion:COV_PRICE.version,currency:'USD',budgetMicroUsd:103500,
    inputCounts:manifest.map(m=>({id:m.id,requestHash:m.requestHash,source:'PROVIDER_COMPLETE_INPUT_COUNT',inputTokens:3000,measuredAt:now})),
    parents:COV_R3_CHECK_HISTORY.map(s=>parent(root+s)),accumulated:{totalAuthorizedEur:15,inferenceCeilingMicroUsd:2000000,priorReservedMicroUsd:reserved,countingCost:null,unknownCountingCostAccepted:true}};
  return {manifest,grant};
}
describe('single R3 check after canonical round',()=>{
  const failingClient=()=>({baseURL:COV_WIRE_POLICY.endpoint,responses:{parse:vi.fn(async()=>{throw Error('private transport');})}});
  it('defaults to dry and only R3',async()=>{const r=await runR3Check();expect(r.manifest?.map(m=>m.id)).toEqual(['R3']);});
  it.each(['id','budget','history','stale','config'])('rejects %s before client creation',async kind=>{
    const {grant}=await setup(),g:any=structuredClone(grant),factory=vi.fn();
    if(kind==='id')g.inputCounts[0].id='P1';
    if(kind==='budget')g.budgetMicroUsd=1;
    if(kind==='history')g.parents[7].journalSha256='0'.repeat(64);
    if(kind==='stale')g.inputCounts[0].measuredAt='2020-01-01T00:00:00Z';
    if(kind==='config')g.config.maxOutputTokens=7999;
    await expect(runR3Check({mode:'live',authorization:g,clientFactory:factory})).rejects.toThrow();expect(factory).not.toHaveBeenCalled();
  });
  it('transport failure is retained without retry and histories unchanged',async()=>{
    const {grant}=await setup(),c=failingClient();const r=await runR3Check({mode:'live',authorization:grant,clientFactory:()=>c as never});
    expect(r.stopped).toBe(true);expect(c.responses.parse).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(r.row)).not.toContain('private transport');
    await expect(runR3Check({mode:'live',authorization:grant,clientFactory:()=>c as never})).rejects.toThrow();expect(c.responses.parse).toHaveBeenCalledTimes(1);
    grant.parents.forEach(p=>expect(parent(p.ledgerDirectory)).toEqual(p));
  });
  it('rejects concurrent or uncertain execution and failed reservation flush',async()=>{
    const {grant,manifest}=await setup(),s=CovExecutionSession.openR3Check(grant,manifest);
    expect(()=>CovExecutionSession.openR3Check(grant,manifest)).toThrow();
    const flush=vi.spyOn(fs,'fsyncSync').mockImplementation(()=>{throw Error('disk');});
    try{expect(()=>s.reserve(manifest[0].requestHash,COV_FIRST_CONFIG)).toThrow('COV_JOURNAL_WRITE_FAILED');}finally{flush.mockRestore();s.close();}
    const factory=vi.fn();await expect(runR3Check({mode:'live',authorization:grant,clientFactory:factory})).rejects.toThrow();expect(factory).not.toHaveBeenCalled();
  });
  it('recovers a received valid result without a second call',async()=>{
    const {grant}=await setup();const parse=vi.fn(async(body:any)=>{
      const q=JSON.parse(body.input);return {status:'completed',model:body.model,service_tier:'default',id:'resp_test',_request_id:'req_test',usage:{input_tokens:3000,output_tokens:20},output:[],output_parsed:{contractVersion:'referral-report-sources-adjudication/3',requestDigest:q.requestDigest,documentKind:'WRITTEN_REPORT',criteria:q.untrustedData.requirements.map((e:any)=>({contentId:e.contentId,status:'UNCERTAIN',reportEvidence:[],sourceEvidence:[]})),claims:[]}};
    });
    const factory=()=>({baseURL:COV_WIRE_POLICY.endpoint,responses:{parse}} as never);
    const r=await runR3Check({mode:'live',authorization:grant,clientFactory:factory});
    await runR3Check({mode:'live',authorization:grant,clientFactory:()=>{throw Error();}});
    expect(r.stopped).toBe(false);expect(parse).toHaveBeenCalledTimes(1);
  });
});
