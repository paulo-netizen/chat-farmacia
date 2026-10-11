import { describe, expect, it } from 'vitest';
import { buildCalibrationFixtures, type CalibrationFixture } from '../../tools/cov-calibration/fixtures';
import { evaluateFixture } from '../../tools/cov-calibration/runner';
import { createCovSimulatedRuntimes } from '../../lib/cases/v2/cov-semantic-runtime';
import { createSessionTranscriptSnapshotV2 } from '../../lib/cases/v2/spfa-session-transcript';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { COV_FIRST_CONFIG } from '../../lib/cases/v2/cov-experiment-policy';

const cite=(m:any)=>({messageId:m.messageId,quote:m.content,occurrence:null});
function reply(q:any){
  const [p,a,v]=q.untrustedData.messages.map(cite);
  return {contractVersion:'personalization-proposal-sources-adjudication/4',requestDigest:q.requestDigest,
    difficulty:{status:'NOT_OBSERVED',evidence:[]},incompatibilities:[],
    links:[{linkId:'a',circumstances:[{source:'TRANSCRIPT',...p}],proposal:a,attribution:'OWN_PROPOSAL',standing:'CURRENT',patientProposal:null,withdrawal:null,
      feasibilityCheck:v,patientResponse:null,responseToDifficulty:null,difficulty:{status:'NOT_OBSERVED',evidence:[]}}],
    criteria:q.requirements.configuration.elements.map((e:any,i:number)=>({requirementId:e.requirementId,status:i===2?'NOT_APPLICABLE':'DEMONSTRATED',linkRef:'a',studentEvidence:[]}))};
}
function rejected(r:any,q:any){const d=cite(q.untrustedData.messages[3]);r.difficulty={status:'PRESENT',evidence:[d]};r.links[0].difficulty=structuredClone(r.difficulty);r.links[0].patientResponse={kind:'DIFFICULTY_OR_REJECTION',evidence:d};r.criteria[2].status='NOT_DEMONSTRATED';}
async function run(change:(r:any,q:any)=>void=()=>{},id='P1',fixture?:CalibrationFixture){
  const f=fixture??buildCalibrationFixtures().find(f=>f.id===id)!;
  return evaluateFixture(f,createCovSimulatedRuntimes(COV_FIRST_CONFIG,{responses:{parse:async(body:any)=>{
    const q=JSON.parse(body.input);expect(q.providerRepresentation).toBe('personalization-proposal-sources-adjudication/4');
    expect(body.instructions).toContain('initial circumstance can justify adaptation');
    expect(body.instructions).toContain('An absent patient reply establishes neither acceptance nor viability');
    expect(body.instructions).toContain('Return only personalization-proposal-sources-adjudication/4');
    expect(body.instructions).not.toContain('Return only personalization-adjudication/3');
    const r=reply(q);change(r,q);return{status:'completed',model:COV_FIRST_CONFIG.model,output:[],output_parsed:r};
  }}} as never,true),true);
}
describe('proposal-scoped applicability through provider adapter and final validator',()=>{
  it('does not equate initial barrier or checking without a response with difficulty about the alternative',async()=>{
    const r=await run();expect(r.status).toBe('REVIEW_REQUIRED');expect(r.criteria.map(c=>c.status)).toEqual(['DEMONSTRATED','DEMONSTRATED','NOT_APPLICABLE']);
    if('links' in r) {expect(r.links[0].patientResponse).toBeUndefined();expect(r.links[0].feasibilityCheck).toBeDefined();}
  });
  it('retains explicit difficulty and does not require acceptance for adaptation/checking',async()=>{
    const r=await run(rejected,'P2-REJECT');expect(r.status).toBe('REVIEW_REQUIRED');expect(r.criteria.map(c=>c.status)).toEqual(['DEMONSTRATED','DEMONSTRATED','NOT_DEMONSTRATED']);
  });
  it('preserves demonstrated history and reasoned withdrawal in one coherent chain',async()=>{
    const r=await run((r,q)=>{rejected(r,q);const w=cite(q.untrustedData.messages[4]);Object.assign(r.links[0],{standing:'WITHDRAWN',withdrawal:w,responseToDifficulty:{difficulty:r.difficulty.evidence[0],response:w}});r.criteria[2].status='DEMONSTRATED';},'P2-WITHDRAW');
    expect(r.status).toBe('REVIEW_REQUIRED');expect(r.criteria.every(c=>c.status==='DEMONSTRATED')).toBe(true);
  });
  it.each([
    ['NOT_APPLICABLE_CRITERION_TYPE_INVALID',(r:any)=>{r.criteria[0].status='NOT_APPLICABLE';}],
    ['NOT_APPLICABLE_DIFFICULTY_STATE_INVALID',(r:any)=>{r.difficulty.status='UNCERTAIN';r.links[0].difficulty.status='UNCERTAIN';}],
    ['DIFFICULTY_SCOPE_REFERENCE_MISSING',(r:any)=>{r.criteria[2].linkRef=null;}],
    ['DIFFICULTY_EVIDENCE_MISSING',(r:any)=>{r.difficulty.status='PRESENT';r.links[0].difficulty.status='PRESENT';}],
    ['DIFFICULTY_STATE_CONFLICT',(r:any,q:any)=>{r.links[0].difficulty.evidence=[cite(q.untrustedData.messages[0])];}],
    ['DIFFICULTY_SUMMARY_INCONSISTENT',(r:any)=>{r.difficulty.status='UNCERTAIN';}],
    ['DIFFICULTY_EVIDENCE_NOT_AFTER_PROPOSAL',(r:any,q:any)=>{r.difficulty={status:'PRESENT',evidence:[cite(q.untrustedData.messages[0])]};r.links[0].difficulty=structuredClone(r.difficulty);}],
    ['RESPONSE_OMISSION_WITHOUT_DIFFICULTY',(r:any)=>{r.criteria[2].status='NOT_DEMONSTRATED';}],
  ] as const)('rejects %s without rewriting the observation',async(code,change)=>{
    const r=await run(change);expect(r.status).toBe('TECHNICAL_FAILURE');expect(r.diagnostic?.causes).toContain(code);
    expect(JSON.stringify(r.diagnostic)).not.toMatch(/letra|leer|private/);
  });
  it('returns all independently provable applicability/state causes together',async()=>{
    const r=await run(r=>{r.criteria[0].status='NOT_APPLICABLE';r.difficulty.status='PRESENT';r.links[0].difficulty.status='PRESENT';});
    expect(r.diagnostic?.version).toBe('cov-diagnostic/2');expect(r.diagnostic?.causes).toEqual(['DIFFICULTY_EVIDENCE_MISSING','NOT_APPLICABLE_CRITERION_TYPE_INVALID','NOT_APPLICABLE_DIFFICULTY_STATE_INVALID']);
  });
  it.each(['root','link','invalid'] as const)('reports missing/invalid difficulty state at %s without arbitrary keys',async(kind)=>{
    const r=await run(r=>{if(kind==='root')delete r.difficulty;else if(kind==='link')delete r.links[0].difficulty;else r.links[0].difficulty.status='private-secret';});
    expect(r.status).toBe('TECHNICAL_FAILURE');expect(r.diagnostic?.causes).toEqual(['PROVIDER_SCHEMA_INVALID','DIFFICULTY_STATE_MISSING_OR_INVALID']);expect(JSON.stringify(r)).not.toContain('private-secret');
  });
  it('reports forbidden criterion type even when difficulty state is absent',async()=>{
    const r=await run(r=>{delete r.links[0].difficulty;r.criteria[0].status='NOT_APPLICABLE';});
    expect(r.diagnostic?.causes).toEqual(['PROVIDER_SCHEMA_INVALID','DIFFICULTY_STATE_MISSING_OR_INVALID','NOT_APPLICABLE_CRITERION_TYPE_INVALID']);
  });
  it('does not carry difficulty from one proposal into the conditional criterion of another',async()=>{
    const f=buildCalibrationFixtures().find(f=>f.id==='P2-REJECT')!;const input=f.input as any,old=input.transcript;
    input.transcript=createSessionTranscriptSnapshotV2({sessionId:old.sessionId,caseVersionId:old.caseVersionId,messages:[...old.messages,
      {messageId:'5',role:'student',content:'Para otra gestión propongo usar una tarjeta diferente.',createdAt:'2026-10-05T10:00:04Z'},
      {messageId:'6',role:'student',content:'¿Puede utilizar la tarjeta?',createdAt:'2026-10-05T10:00:05Z'}]});
    const binding={sessionId:old.sessionId,caseVersionId:old.caseVersionId,transcriptFingerprint:input.transcript.fingerprint};input.context.binding=binding;input.requirements.binding=binding;
    const r=await run((r,q)=>{rejected(r,q);const second=structuredClone(r.links[0]);Object.assign(second,{linkId:'b',proposal:cite(q.untrustedData.messages[4]),feasibilityCheck:cite(q.untrustedData.messages[5]),patientResponse:null,difficulty:{status:'NOT_OBSERVED',evidence:[]}});r.links.push(second);r.criteria[2].linkRef='b';r.criteria[2].status='NOT_APPLICABLE';},'P1',f);
    expect(r.status).toBe('REVIEW_REQUIRED');expect(r.criteria[2].status).toBe('NOT_APPLICABLE');
  });
  it('rejects borrowing a different difficulty reference even after a proposal',async()=>{
    const r=await run((r,q)=>{rejected(r,q);r.links[0].difficulty.evidence=[];r.links[0].difficulty.status='UNCERTAIN';r.difficulty=structuredClone(r.links[0].difficulty);r.criteria[2].status='UNCERTAIN';},'P2-REJECT');
    expect(r.diagnostic?.code).toBe('PATIENT_DIFFICULTY_REFERENCE_INVALID');
  });
  it('versions only the scoped personal requests; historical hashes remain reproducible',async()=>{
    const old=await prepareFirstCovBatch(),next=await prepareFirstCovBatch('proposal/4');
    for(let i=0;i<12;i++){expect(next.manifest[i].fixtureHash).toBe(old.manifest[i].fixtureHash);if(i<8)expect(next.manifest[i]).toEqual(old.manifest[i]);else expect(next.manifest[i].requestHash).not.toBe(old.manifest[i].requestHash);}
    expect((await prepareFirstCovBatch('sources/3')).manifestHash).toBe('22681118fdd5c98f8b0ac143821929d6e4d892a52923e11419fb0ea526c98fc2');
  });
});
