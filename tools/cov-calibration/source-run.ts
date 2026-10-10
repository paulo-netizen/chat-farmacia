import OpenAI from 'openai';
import { prepareFirstCovBatch, createCovClientFromSdk } from './first-batch';
import { evaluateFixture, measure } from './runner';
import { COV_FIRST_CONFIG, COV_WIRE_POLICY, covHash } from '../../lib/cases/v2/cov-experiment-policy';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { covSourceRunGrantSchema } from '../../lib/cases/v2/cov-source-run-policy';
import { createCovOpenAiRuntimes, type CovClient } from '../../lib/cases/v2/cov-semantic-runtime';
export async function runCovSourcePhase(options: {mode?:'dry'|'live';phase?:'R2'|'PENDING';authorization?:unknown;clientFactory?:()=>CovClient}={}) {
  const phase=options.phase??'R2',mode=options.mode??'dry';
  if(!['R2','PENDING'].includes(phase)||!['dry','live'].includes(mode))throw new Error('COV_SOURCE_PHASE_INVALID');
  const p=await prepareFirstCovBatch(),manifest=phase==='R2'?p.manifest.slice(1,2):p.manifest.slice(2),fixtures=phase==='R2'?p.fixtures.slice(1,2):p.fixtures.slice(2);
  if(mode==='dry')return {mode,phase,manifest,manifestHash:covHash(manifest),plannedCalls:manifest.length};
  const g=covSourceRunGrantSchema.safeParse(options.authorization);
  if(!g.success||g.data.purpose!==(phase==='R2'?'SOURCE_R2_ONLY':'SOURCE_TEN_PENDING'))throw new Error('COV_SOURCE_PHASE_UNAUTHORIZED');
  const session=CovExecutionSession.openSourceRun(options.authorization,manifest);
  try {
    if(session.stopped)throw new Error('COV_SOURCE_RUN_STOPPED');
    let client:CovClient|undefined;
    for(const f of fixtures){
      if(session.saved(f.id)!==undefined)continue;
      client??=options.clientFactory?options.clientFactory():createCovClientFromSdk(new OpenAI({baseURL:COV_WIRE_POLICY.endpoint,maxRetries:0,timeout:COV_FIRST_CONFIG.timeoutMs}));
      const result=await evaluateFixture(f,createCovOpenAiRuntimes(COV_FIRST_CONFIG,client,session));
      session.result(f.id,{id:f.id,result,metrics:measure(f,result)});
      if(result.status==='TECHNICAL_FAILURE'||session.stopped){session.stop();break;}
    }
    return {mode,phase,stopped:session.stopped,reservedMicroUsd:session.reservedMicroUsd,rows:fixtures.map(f=>session.saved(f.id)).filter(r=>r!==undefined)};
  } catch {session.stop();throw new Error('COV_SOURCE_RUN_STOPPED_REVIEW_JOURNAL');}
  finally {session.close();}
}
