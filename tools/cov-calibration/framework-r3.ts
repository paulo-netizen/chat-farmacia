import OpenAI from 'openai';
import {prepareR3Check} from './r3-check';
import {createCovClientFromSdk} from './first-batch';
import {evaluateFixture,measure} from './runner';
import {COV_FIRST_CONFIG,COV_WIRE_POLICY} from '../../lib/cases/v2/cov-experiment-policy';
import {CovExecutionSession} from '../../lib/cases/v2/cov-execution-session';
import {createCovOpenAiRuntimes,type CovClient} from '../../lib/cases/v2/cov-semantic-runtime';
export async function runFrameworkR3(options:{authorization:unknown;clientFactory?:()=>CovClient}){
 const p=await prepareR3Check(),session=CovExecutionSession.openFrameworkR3(options.authorization,p.manifest);
 try{
  if(session.stopped)throw Error('COV_STOPPED');
  if(session.saved('R3')!==undefined)return session.saved('R3');
  const client=options.clientFactory?options.clientFactory():createCovClientFromSdk(new OpenAI({baseURL:COV_WIRE_POLICY.endpoint,maxRetries:0,timeout:COV_FIRST_CONFIG.timeoutMs}));
  const result=await evaluateFixture(p.fixture,createCovOpenAiRuntimes(COV_FIRST_CONFIG,client,session,'canonical'),'canonical');
  const row={id:'R3',result,metrics:measure(p.fixture,result)};session.result('R3',row);if(result.status==='TECHNICAL_FAILURE'||session.stopped)session.stop();return row;
 }catch{session.stop();throw Error('COV_FRAMEWORK_R3_FAILED');}finally{session.close();}
}
