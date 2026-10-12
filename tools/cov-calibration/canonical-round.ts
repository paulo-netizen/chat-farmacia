import OpenAI from 'openai';
import { prepareFirstCovBatch, createCovClientFromSdk } from './first-batch';
import { evaluateFixture, measure } from './runner';
import { COV_FIRST_CONFIG, COV_WIRE_POLICY, covHash } from '../../lib/cases/v2/cov-experiment-policy';
import { COV3_ROUND_IDS, validateCov3RoundGrant } from '../../lib/cases/v2/cov3-round-policy';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { createCovOpenAiRuntimes, type CovClient } from '../../lib/cases/v2/cov-semantic-runtime';

export async function prepareCov3DiagnosticRound(){
  const p=await prepareFirstCovBatch('canonical/5');
  const manifest=COV3_ROUND_IDS.map(id=>p.manifest.find(m=>m.id===id)!);
  return {manifest,manifestHash:covHash(manifest),fixtures:COV3_ROUND_IDS.map(id=>p.fixtures.find(f=>f.id===id)!),
    requests:COV3_ROUND_IDS.map(id=>p.requests[p.manifest.findIndex(m=>m.id===id)])};
}
/** Explicit closed diagnostic policy, never the default of another runner. */
export async function runCov3DiagnosticRound(options:{mode?:'dry'|'live';authorization?:unknown;clientFactory?:()=>CovClient}={}){
  const mode=options.mode??'dry';if(!['dry','live'].includes(mode))throw Error('COV3_ROUND_MODE_INVALID');
  const p=await prepareCov3DiagnosticRound();
  if(mode==='dry')return {mode,manifest:p.manifest,manifestHash:p.manifestHash,plannedCalls:4};
  const grant=validateCov3RoundGrant(options.authorization,p.manifest);
  const session=CovExecutionSession.openCanonicalDiagnostics(grant,p.manifest);
  const rows:unknown[]=[];
  try{
    if(session.stopped)throw Error('COV3_ROUND_STOPPED_OR_UNCERTAIN');
    let runtimes:ReturnType<typeof createCovOpenAiRuntimes>|undefined;
    for(const fixture of p.fixtures){
      const saved=session.saved(fixture.id);if(saved!==undefined){rows.push(saved);continue;}
      runtimes??=createCovOpenAiRuntimes(COV_FIRST_CONFIG,options.clientFactory?options.clientFactory():createCovClientFromSdk(new OpenAI({baseURL:COV_WIRE_POLICY.endpoint,maxRetries:0,timeout:COV_FIRST_CONFIG.timeoutMs})),session,'canonical');
      const result=await evaluateFixture(fixture,runtimes,'canonical');
      const row={id:fixture.id,result,metrics:measure(fixture,result)};
      session.result(fixture.id,row);rows.push(row);
      if(session.stopped)break;
    }
    return {mode,rows,stopped:session.stopped,reservedMicroUsd:session.reservedMicroUsd};
  }catch{session.stop();throw Error('COV3_ROUND_STOPPED_REVIEW_JOURNAL');}
  finally{session.close();}
}
