import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,dirname,resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { runCov3DiagnosticRound } from '../../tools/cov-calibration/canonical-round';
import { createCovClientFromSdk } from '../../tools/cov-calibration/first-batch';
import { COV3_ROUND_HISTORY } from '../../lib/cases/v2/cov3-round-policy';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { COV_FIRST_CONFIG,COV_WIRE_POLICY,COV_PRICE,covHash } from '../../lib/cases/v2/cov-experiment-policy';

const dirs:string[]=[];
vi.mock('node:fs',async original=>{const actual=await original<typeof import('node:fs')>();return {...actual,fsyncSync:vi.fn(actual.fsyncSync)};});
afterEach(()=>dirs.splice(0).forEach(d=>{expect(dirname(resolve(d))).toBe(resolve(tmpdir()));rmSync(d,{recursive:true,force:true});}));
const parent=(ledgerDirectory:string)=>({ledgerDirectory,journalSha256:createHash('sha256').update(readFileSync(join(ledgerDirectory,'journal.jsonl'))).digest('hex')});
async function setup(){
  const dir=mkdtempSync(join(tmpdir(),'cov-completion-'));dirs.push(dir);const root=join(dir,'original');
  let reserved=0;
  for(const [i,suffix] of COV3_ROUND_HISTORY.entries()){
    const d=root+suffix;mkdirSync(d);let previous='0'.repeat(64);
    const ids=i===0?['R1','R2']:i<4?['R2']:i>=5?['P1']:['R3','R-INJECTION','S1','S2','S3-ADOPT','S4-CONFLICT','P1'];
    const events:any[]=[{kind:'INIT',data:'synthetic'}];
    ids.forEach(id=>{reserved+=103500;events.push({kind:'RESERVED',id,data:103500},{kind:'RESULT',id,data:{result:{status:(i<3&&id==='R2')||(i>=4&&id==='P1')?'TECHNICAL_FAILURE':'REVIEW_REQUIRED'}}});});
    if(i!==3)events.push({kind:'STOP',data:null});
    writeFileSync(join(d,'journal.jsonl'),events.map((event,seq)=>{const r={seq,previous,event};previous=covHash(r);return JSON.stringify({...r,checksum:previous});}).join('\n')+'\n');
  }
  const all=await prepareFirstCovBatch('canonical/5'),manifest=all.manifest.slice(8),now=new Date().toISOString();
  const grant={version:'cov3-canonical-diagnostic-authorization/1',purpose:'FOUR_INDEPENDENT_COV3_DIAGNOSTICS',approval:'EXPLICIT_USER_AUTHORIZATION',authorizationId:'SYNTHETIC_CANONICAL',approvedAt:now,expiresAt:new Date(Date.parse(now)+3600000).toISOString(),ledgerDirectory:root+'-canonical-four',manifestHash:covHash(manifest),config:COV_FIRST_CONFIG,wirePolicy:COV_WIRE_POLICY,priceVersion:COV_PRICE.version,currency:'USD',budgetMicroUsd:414000,
    inputCounts:manifest.map(m=>({id:m.id,requestHash:m.requestHash,source:'PROVIDER_COMPLETE_INPUT_COUNT',inputTokens:3000,measuredAt:now})),
    parents:COV3_ROUND_HISTORY.map(s=>parent(root+s)),accumulated:{totalAuthorizedEur:15,inferenceCeilingMicroUsd:2000000,priorReservedMicroUsd:reserved,countingCost:null,unknownCountingCostAccepted:true}};
  return {manifest,grant};
}
function client(kind='valid'){
  let n=0;
  const create=vi.fn(async(body:any)=>{n++;if(kind==='timeout')throw new Error('private timeout');
    const q=JSON.parse(body.input),value:any={contractVersion:'personalization-canonical-sources-adjudication/5',requestDigest:q.requestDigest,links:[],incompatibilities:[],criteria:q.requirements.configuration.elements.map((e:any)=>({requirementId:e.requirementId,status:'UNCERTAIN',linkRef:null,studentEvidence:[]}))};
    if(kind==='schema')delete value.links;
    if(kind==='validation')value.criteria[0].status='DEMONSTRATED';
    if(kind==='role'){const p=q.untrustedData.messages.find((m:any)=>m.role==='patient');value.criteria[0].studentEvidence=[{source:'STUDENT_MESSAGE',messageId:p.messageId,quote:p.content,occurrence:null}];}
    return {status:kind==='incomplete'?'incomplete':'completed',model:kind==='model'?'unexpected':body.model,service_tier:kind==='tier'?'flex':'default',id:'resp_synthetic',_request_id:'req_synthetic',usage:kind==='usage'?undefined:{input_tokens:3000,output_tokens:30},output:[{type:'message',content:[{type:'output_text',text:kind==='parse'||kind==='parse-model'?'private invalid JSON':JSON.stringify(value)}]}],...(kind==='parse-model'?{model:'unexpected'}:{})};
  });
  return {create,factory:()=>createCovClientFromSdk({baseURL:COV_WIRE_POLICY.endpoint,responses:{create}} as never)};
}
describe('four independent COV3 diagnostics, explicit policy only',()=>{
  it('blocks a failed reservation flush before any request',async()=>{
    const {grant,manifest}=await setup();const s=CovExecutionSession.openCanonicalDiagnostics(grant,manifest);
    const flush=vi.spyOn(fs,'fsyncSync').mockImplementation(()=>{throw Error('private disk error');});
    try{expect(()=>s.reserve(manifest[0].requestHash,COV_FIRST_CONFIG)).toThrow('COV_JOURNAL_WRITE_FAILED');expect(s.stopped).toBe(true);}finally{flush.mockRestore();s.close();}
    const fake=client();await expect(runCov3DiagnosticRound({mode:'live',authorization:grant,clientFactory:fake.factory})).rejects.toThrow();expect(fake.create).not.toHaveBeenCalled();
  });
  it('blocks altered journal integrity without transport',async()=>{
    const {grant,manifest}=await setup();const s=CovExecutionSession.openCanonicalDiagnostics(grant,manifest);s.close();
    writeFileSync(join(grant.ledgerDirectory,'journal.jsonl'),'broken');const fake=client();
    await expect(runCov3DiagnosticRound({mode:'live',authorization:grant,clientFactory:fake.factory})).rejects.toThrow();expect(fake.create).not.toHaveBeenCalled();
  });
  it('is dry with exactly four fixed IDs',async()=>{const r=await runCov3DiagnosticRound();expect(r.manifest?.map(m=>m.id)).toEqual(['P1','P2-WITHDRAW','P3-ADOPT','P4-LATE']);});
  it.each(['valid','schema','validation','role','parse'])('continues after received %s, persists diagnostics/usage, never repeats',async kind=>{
    const {grant}=await setup(),fake=client(kind);const r=await runCov3DiagnosticRound({mode:'live',authorization:grant,clientFactory:fake.factory});
    expect(r.stopped).toBe(false);expect(r.rows).toHaveLength(4);expect(fake.create).toHaveBeenCalledTimes(4);
    const rows=r.rows as any[];expect(rows.every(r=>r.result.status===(kind==='valid'?'REVIEW_REQUIRED':'TECHNICAL_FAILURE'))).toBe(true);
    if(kind==='role')expect(rows[0].result.diagnostic.issues[0]).toMatchObject({field:'STUDENT_EVIDENCE',code:'SOURCE_ROLE_INVALID',stage:'ADAPTER'});
    const log=readFileSync(join(grant.ledgerDirectory,'journal.jsonl'),'utf8');expect(log).toContain('req_synthetic');expect(log).toContain('inputTokens');expect(log).not.toContain('private invalid JSON');
    await runCov3DiagnosticRound({mode:'live',authorization:grant,clientFactory:()=>{throw Error();}});expect(fake.create).toHaveBeenCalledTimes(4);grant.parents.forEach(p=>expect(parent(p.ledgerDirectory)).toEqual(p));
  });
  it.each(['timeout','model','tier','usage','incomplete','parse-model'])('stops the round on %s and cannot restart',async kind=>{
    const {grant}=await setup(),fake=client(kind);const r=await runCov3DiagnosticRound({mode:'live',authorization:grant,clientFactory:fake.factory});expect(r.stopped).toBe(true);expect(r.rows).toHaveLength(1);expect(fake.create).toHaveBeenCalledTimes(1);
    await expect(runCov3DiagnosticRound({mode:'live',authorization:grant,clientFactory:fake.factory})).rejects.toThrow();expect(fake.create).toHaveBeenCalledTimes(1);
  });
  it('blocks concurrency and uncertain reservations on recovery',async()=>{
    const {grant,manifest}=await setup();const s=CovExecutionSession.openCanonicalDiagnostics(grant,manifest);
    try{expect(()=>CovExecutionSession.openCanonicalDiagnostics(grant,manifest)).toThrow();s.reserve(manifest[0].requestHash,COV_FIRST_CONFIG);}finally{s.close();}
    const fake=client();await expect(runCov3DiagnosticRound({mode:'live',authorization:grant,clientFactory:fake.factory})).rejects.toThrow();expect(fake.create).not.toHaveBeenCalled();
  });
  it.each(['budget','id','hash','history','directory','expiry','config'])('blocks incompatible %s before transport',async kind=>{
    const {grant}=await setup(),g:any=structuredClone(grant),fake=client();
    if(kind==='budget')g.budgetMicroUsd=1;if(kind==='id')g.inputCounts[0].id='R3';if(kind==='hash')g.inputCounts[0].requestHash='0'.repeat(64);if(kind==='history')g.parents[6].journalSha256='0'.repeat(64);if(kind==='directory')g.ledgerDirectory+='-again';if(kind==='expiry')g.inputCounts[0].measuredAt='2020-01-01T00:00:00Z';if(kind==='config')g.config={...g.config,maxOutputTokens:7999};
    await expect(runCov3DiagnosticRound({mode:'live',authorization:g,clientFactory:fake.factory})).rejects.toThrow();expect(fake.create).not.toHaveBeenCalled();
  });
});
