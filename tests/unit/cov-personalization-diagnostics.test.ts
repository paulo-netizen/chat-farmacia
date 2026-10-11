import { describe, expect, it } from 'vitest';
import { buildCalibrationFixtures } from '../../tools/cov-calibration/fixtures';
import { evaluateFixture } from '../../tools/cov-calibration/runner';
import { createCovSimulatedRuntimes } from '../../lib/cases/v2/cov-semantic-runtime';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { covHash, COV_FIRST_CONFIG } from '../../lib/cases/v2/cov-experiment-policy';

function response(q: any) {
  const [p,a,v,d,w] = q.untrustedData.messages.map((m:any) => ({ messageId:m.messageId,quote:m.content,start:0,end:m.content.length }));
  return { contractVersion:'personalization-adjudication/2',requestDigest:q.requestDigest,
    difficulty:{status:'PRESENT',evidence:[d]},
    links:[{linkId:'a',circumstances:[{source:'TRANSCRIPT',...p}],proposal:a,attribution:'OWN_PROPOSAL',standing:'WITHDRAWN',withdrawal:w,
      feasibilityCheck:v,patientResponse:{kind:'DIFFICULTY_OR_REJECTION',evidence:d},responseToDifficulty:{difficulty:d,response:w}}],
    incompatibilities:[],criteria:q.requirements.configuration.elements.map((c:any)=>({requirementId:c.requirementId,status:'DEMONSTRATED',linkRef:'a',studentEvidence:[]})) };
}
async function run(change:(r:any,q:any)=>void) {
  const fixture=buildCalibrationFixtures().find(f=>f.id==='P2-WITHDRAW')!;
  return evaluateFixture(fixture,{COV3:{runtimeRef:'synthetic-diagnostics',adjudicate:async(q:any)=>{const r=response(q);change(r,q);return r;}}} as never);
}
const cases:[string,(r:any)=>void][]=[
  ['ADJUDICATION_SCHEMA_INVALID',r=>{r.links[0].unexpectedSecret='private clinical data';}],
  ['REQUEST_DIGEST_MISMATCH',r=>{r.requestDigest='0'.repeat(64);}],
  ['DIFFICULTY_EVIDENCE_MISSING',r=>{r.difficulty.evidence=[];}],
  ['DIFFICULTY_STATE_CONFLICT',r=>{r.difficulty.status='NOT_OBSERVED';}],
  ['LINKS_DUPLICATED',r=>{r.links.push(structuredClone(r.links[0]));}],
  ['CIRCUMSTANCE_NOT_PRIOR',r=>{r.links[0].circumstances=[{source:'TRANSCRIPT',...r.difficulty.evidence[0]}];}],
  ['ADOPTION_NOT_PRIOR',r=>{r.links[0].patientProposal=r.difficulty.evidence[0];}],
  ['ADOPTION_SOURCE_MISSING',r=>{r.links[0].attribution='EXPLICIT_ADOPTION';}],
  ['WITHDRAWAL_NOT_LATER',r=>{r.links[0].withdrawal=r.links[0].proposal;}],
  ['WITHDRAWAL_STATE_CONFLICT',r=>{r.links[0].standing='CURRENT';}],
  ['WITHDRAWAL_EVIDENCE_MISSING',r=>{delete r.links[0].withdrawal;}],
  ['FEASIBILITY_PRECEDES_PROPOSAL',r=>{const l=r.links[0];[l.proposal,l.feasibilityCheck]=[l.feasibilityCheck,l.proposal];}],
  ['PATIENT_RESPONSE_NOT_LATER',r=>{r.links[0].patientResponse.evidence={...r.links[0].circumstances[0]};delete r.links[0].patientResponse.evidence.source;}],
  ['PATIENT_DIFFICULTY_REFERENCE_INVALID',r=>{r.difficulty.status='UNCERTAIN';r.difficulty.evidence=[];}],
  ['RESPONSE_DIFFICULTY_REFERENCE_INVALID',r=>{r.links[0].responseToDifficulty.difficulty={...r.links[0].circumstances[0]};delete r.links[0].responseToDifficulty.difficulty.source;}],
  ['RESPONSE_NOT_AFTER_DIFFICULTY',r=>{r.links[0].responseToDifficulty.response=r.links[0].feasibilityCheck;}],
  ['RESPONSE_PRECEDES_PROPOSAL',r=>{r.links[0].proposal=r.links[0].withdrawal;delete r.links[0].withdrawal;r.links[0].standing='CURRENT';delete r.links[0].feasibilityCheck;delete r.links[0].patientResponse;r.difficulty.evidence=[{...r.links[0].circumstances[0]}];delete r.difficulty.evidence[0].source;r.links[0].responseToDifficulty={difficulty:r.difficulty.evidence[0],response:{messageId:'3',start:0,end:1,quote:'¿'}};}],
  ['INCOMPATIBILITY_REFERENCE_INVALID',r=>{r.incompatibilities=[{first:'a',second:'private-secret'}];}],
  ['CRITERIA_DUPLICATED',r=>{r.criteria[1]=r.criteria[0];}],
  ['CRITERIA_UNKNOWN',r=>{r.criteria[0].requirementId='private-secret';}],
  ['CRITERIA_MISSING',r=>{r.criteria.pop();}],
  ['LINK_REFERENCE_INVALID',r=>{r.criteria[0].linkRef='private-secret';}],
  ['CRITERION_NOT_APPLICABLE_INVALID',r=>{r.criteria[0].status='NOT_APPLICABLE';}],
  ['DEMONSTRATED_AUTHORSHIP_MISSING',r=>{r.links[0].attribution='QUOTATION';}],
  ['ADAPTATION_CIRCUMSTANCE_MISSING',r=>{r.links[0].circumstances=[];}],
  ['FEASIBILITY_CHECK_MISSING',r=>{delete r.links[0].feasibilityCheck;}],
  ['DIFFICULTY_RESPONSE_MISSING',r=>{delete r.links[0].responseToDifficulty;}],
  ['CONTRADICTION_SUPPORT_MISSING',r=>{r.criteria[0].status='CONTRADICTORY';r.criteria[0].linkRef=null;}],
];
describe('specific personalization domain diagnostics, never a reconstruction of lost P1',()=>{
  it.each(cases)('%s remains strict and safe',async(code,change)=>{
    const r=await run(change);expect(r.status).toBe('TECHNICAL_FAILURE');expect(r.diagnostic?.code).toBe(code);
    expect(JSON.stringify(r)).not.toMatch(/private|clinical data|Con ese tamaño|retir|leerlo/);
  });
  it('preserves historical adaptation/check and an evidenced response after withdrawal',async()=>{
    const r=await run(()=>{});expect(r.status).toBe('REVIEW_REQUIRED');expect(r.criteria.map(c=>c.status)).toEqual(['DEMONSTRATED','DEMONSTRATED','DEMONSTRATED']);
  });
  it('keeps P1 nullable wire fields aligned with domain optionals and conditional non-applicability',async()=>{
    const f=buildCalibrationFixtures().find(f=>f.id==='P1')!;
    const r=await evaluateFixture(f,createCovSimulatedRuntimes(COV_FIRST_CONFIG,{responses:{parse:async(body:any)=>{
      const q=JSON.parse(body.input),[p,a,v]=q.untrustedData.messages.map((m:any)=>({messageId:m.messageId,quote:m.content,occurrence:null}));
      return {status:'completed',model:COV_FIRST_CONFIG.model,output:[],output_parsed:{contractVersion:'personalization-sources-adjudication/3',requestDigest:q.requestDigest,
        difficulty:{status:'NOT_OBSERVED',evidence:[]},links:[{linkId:'a',circumstances:[{source:'TRANSCRIPT',...p}],proposal:a,attribution:'OWN_PROPOSAL',standing:'CURRENT',patientProposal:null,withdrawal:null,feasibilityCheck:v,patientResponse:null,responseToDifficulty:null}],incompatibilities:[],
        criteria:q.requirements.configuration.elements.map((c:any,i:number)=>({requirementId:c.requirementId,status:i===2?'NOT_APPLICABLE':'DEMONSTRATED',linkRef:i===2?null:'a',studentEvidence:[]}))}};
    }}} as never));
    expect(r.status).toBe('REVIEW_REQUIRED');expect(r.criteria.map(c=>c.status)).toEqual(['DEMONSTRATED','DEMONSTRATED','NOT_APPLICABLE']);
  });
  it('retains the exact previous source projection and changes only COV1 requests',async()=>{
    const old=await prepareFirstCovBatch('sources/3'),current=await prepareFirstCovBatch();
    expect(old.manifestHash).toBe('22681118fdd5c98f8b0ac143821929d6e4d892a52923e11419fb0ea526c98fc2');
    current.manifest.forEach((m,i)=>{expect(m.fixtureHash).toBe(old.manifest[i].fixtureHash);if(i<4)expect(m.requestHash).not.toBe(old.manifest[i].requestHash);else expect(m).toEqual(old.manifest[i]);});
    expect(covHash(old.requests[8].body)).toBe(current.manifest[8].requestHash);
  });
});
