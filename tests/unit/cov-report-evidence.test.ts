import { describe, expect, it } from 'vitest';
import { buildCalibrationFixtures } from '../../tools/cov-calibration/fixtures';
import { evaluateFixture } from '../../tools/cov-calibration/runner';
import { createSessionTranscriptSnapshotV2 } from '../../lib/cases/v2/spfa-session-transcript';
import { createCovSimulatedRuntimes } from '../../lib/cases/v2/cov-semantic-runtime';
import { COV_FIRST_CONFIG } from '../../lib/cases/v2/cov-experiment-policy';

// These expectations check transport/contract distinctions, not a simulated semantic oracle.
describe('general report evidence instruction revision',()=>{
  it.each([
    ['Me duele la cabeza.','Dolor de cabeza pulsátil.','INSUFFICIENT','UNSUPPORTED'],
    ['Me cuesta leer.','No puede leer ninguna palabra.','INSUFFICIENT','UNSUPPORTED'],
    ['Me duele la cabeza desde ayer.','Informe sin descripción de la molestia.','NOT_DEMONSTRATED',null],
    ['La descripción de la molestia es ambigua.','Describe una molestia de interpretación ambigua.','UNCERTAIN','UNCERTAIN'],
  ] as const)('preserves %s → %s as %s without keyword rules',async(source,report,status,claim)=>{
    const f=buildCalibrationFixtures().find(f=>f.id==='R3')!;
    const input=f.input as any,old=input.transcript;
    input.transcript=createSessionTranscriptSnapshotV2({sessionId:old.sessionId,caseVersionId:old.caseVersionId,messages:[{...old.messages[0],content:source}]});
    const binding={sessionId:old.sessionId,caseVersionId:old.caseVersionId,transcriptFingerprint:input.transcript.fingerprint};
    input.context.binding=binding;input.submission.binding=binding;input.submission.delivery.text=report;
    const result=await evaluateFixture(f,createCovSimulatedRuntimes(COV_FIRST_CONFIG,{responses:{parse:async(body:any)=>{
      expect(body.instructions).toContain('related evidence exists but is not sufficient');
      expect(body.instructions).toContain('required performance is absent despite complete capture');
      expect(body.instructions).not.toMatch(/Me mareo|sensación de giro|\bR3\b/);
      expect(body.instructions).toContain('UNCERTAIN concerns uncertain interpretation');
      const q=JSON.parse(body.input);expect(q.providerInstructionsVersion).toBe('cov-report-evidence-instructions/2');
      expect(q).not.toHaveProperty('expected');
      const evidence={source:'TRANSCRIPT',messageId:'1',quote:source,occurrence:null},written={quote:report,occurrence:null};
      return {status:'completed',model:COV_FIRST_CONFIG.model,output:[],output_parsed:{contractVersion:'referral-report-sources-adjudication/3',requestDigest:q.requestDigest,documentKind:'WRITTEN_REPORT',
        criteria:q.untrustedData.requirements.map((r:any,i:number)=>({contentId:r.contentId,status:i===0?status:'UNCERTAIN',reportEvidence:i===0&&status!=='NOT_DEMONSTRATED'?[written]:[],sourceEvidence:[evidence]})),
        claims:claim?[{status:claim,reportEvidence:written,sourceEvidence:[evidence]}]:[]}};
    }}} as never));
    expect(result.status).toBe('REVIEW_REQUIRED');expect(result.criteria[0].status).toBe(status);
    expect(result.semanticAcceptance).toBe('PENDING');
  });
});
