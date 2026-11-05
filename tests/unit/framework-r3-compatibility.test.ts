import {it,expect} from 'vitest';
import {buildCalibrationFixtures} from '../../tools/cov-calibration/fixtures';
import {evaluateFixture} from '../../tools/cov-calibration/runner';
import {createCovSimulatedRuntimes} from '../../lib/cases/v2/cov-semantic-runtime';
import {COV_FIRST_CONFIG} from '../../lib/cases/v2/cov-experiment-policy';
it('represents the complete R3 expectation using its actual complete one-message source, not a reconstructed response',async()=>{
 const f=buildCalibrationFixtures().find(f=>f.id==='R3')!;
 const result=await evaluateFixture(f,createCovSimulatedRuntimes(COV_FIRST_CONFIG,{responses:{parse:async(body:any)=>{
  const q=JSON.parse(body.input),source={source:'TRANSCRIPT',messageId:'1',quote:'Me mareo.',occurrence:1};
  expect(q.untrustedData.messages).toHaveLength(1);expect(q.untrustedData.messages[0].content).toBe(source.quote);
  // The entire available transcript is cited for the limited statement "onset unknown".
  // It does not assert a clinical onset or equate dizziness to spinning.
  const written=[{quote:'Presenta sensación de giro.',occurrence:1},{quote:'Inicio desconocido.',occurrence:1}];
  return {status:'completed',model:COV_FIRST_CONFIG.model,output:[],output_parsed:{contractVersion:'referral-report-sources-adjudication/3',requestDigest:q.requestDigest,documentKind:'WRITTEN_REPORT',
   criteria:q.untrustedData.requirements.map((r:any,i:number)=>({contentId:r.contentId,status:i?'DEMONSTRATED':'INSUFFICIENT',reportEvidence:[written[i]],sourceEvidence:[source]})),
   claims:written.map((reportEvidence,i)=>({status:i?'SUPPORTED':'UNSUPPORTED',reportEvidence,sourceEvidence:[source]}))}};
 }}} as never));
 expect(result.status).toBe('REVIEW_REQUIRED');expect(result.criteria.map(c=>c.status)).toEqual(['INSUFFICIENT','DEMONSTRATED']);
 expect('claims'in result&&result.claims.map(c=>c.status)).toEqual(['UNSUPPORTED','SUPPORTED']);
});
