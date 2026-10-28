import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {createSessionTranscriptSnapshotV2} from './spfa-session-transcript';
import {QuestionnaireError} from './session-questionnaire-store';
import {evaluateCommunication,communicationOutputSchema,communicationDimension,communicationRubric,communicationInstructions,CommunicationError,type CommunicationInput,type CommunicationRuntime} from './communication-evaluation';
import {emptyDimension,resultFingerprint,type ResultDimension} from './session-results';

export async function readCommunicationDimension(c:Pick<PoolClient,'query'>,s:{id:string;case_version_id:string},transcriptFingerprint:string):Promise<ResultDimension>{
 const row=(await c.query('SELECT * FROM session_communication_evaluations WHERE session_id=$1',[s.id])).rows[0];
 if(!row)return emptyDimension();
 const source={id:row.attempt_id,version:'communication-result/1',fingerprint:resultFingerprint(row)};
 if(row.status==='EVALUATING')return {...emptyDimension(),source};
 if(row.status==='FAILED')return {...emptyDimension('TECHNICAL_FAILURE'),source};
 try{
  if(row.case_version_id!==s.case_version_id||row.input.transcript.sessionId!==s.id||row.input.transcript.caseVersionId!==s.case_version_id||row.input.transcript.fingerprint.value!==transcriptFingerprint||row.input.scope!=='SYNTHETIC_TEST')throw new CommunicationError('BINDING_INVALID');
  if(resultFingerprint(row.configuration)!==resultFingerprint({rubric:communicationRubric,instructions:communicationInstructions}))throw new CommunicationError('CONFIGURATION_BLOCKED');
  return communicationDimension(row.input,row.output,row.runtime_id);
 }catch{return {...emptyDimension('TECHNICAL_FAILURE'),source};}
}

/** Explicit offline service entry; no HTTP trigger or provider installed until rubric approval.
 * No locks during adjudication. An uncertain claim/completion never permits a second execution.
 */
export function createCommunicationStore(db:Pick<Pool,'connect'>,runtime:CommunicationRuntime){
 return {async evaluate(actor:string,sessionId:string){
  if(!/^[1-9][0-9]{0,15}$/.test(actor))throw new QuestionnaireError('FORBIDDEN',403);
  z.string().uuid().parse(sessionId);
  if(runtime.mode!=='SIMULATED')throw new CommunicationError('CONFIGURATION_BLOCKED');
  const runtimeId=runtime.id,adjudicate=runtime.adjudicate.bind(runtime),attempt=randomUUID();
  let input:CommunicationInput;
  const c=await db.connect();
  try{
   await c.query('BEGIN');
   const s=(await c.query('SELECT s.*,c.created_by FROM sessions s JOIN cases c ON c.id=s.case_id WHERE s.id=$1 FOR UPDATE OF s',[sessionId])).rows[0];
   const role=(await c.query('SELECT role FROM users WHERE id=$1',[actor])).rows[0]?.role;
   if(!['teacher','admin'].includes(role))throw new QuestionnaireError('FORBIDDEN',403);
   if(!s||(role!=='admin'&&String(s.created_by)!==actor))throw new QuestionnaireError('NOT_FOUND',404);
   if(s.status!=='finished')throw new QuestionnaireError('NOT_READY',409);
   const prior=(await c.query('SELECT status FROM session_communication_evaluations WHERE session_id=$1',[sessionId])).rows[0];
   if(prior){await c.query('COMMIT');return {status:prior.status as string,recovered:true};}
   const marker=(await c.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0]?.marker;
   const policy=(await c.query('SELECT policy FROM case_result_policies WHERE case_version_id=$1',[s.case_version_id])).rows[0]?.policy;
   if(marker!=='teacher-editor-20261012-disposable'||policy?.scope!=='SYNTHETIC_TEST')throw new CommunicationError('CONFIGURATION_BLOCKED');
   const rows=(await c.query('SELECT id::text,role,content,created_at FROM messages WHERE session_id=$1 ORDER BY created_at,id',[sessionId])).rows;
   input={scope:'SYNTHETIC_TEST',capture:'COMPLETE',transcript:createSessionTranscriptSnapshotV2({sessionId,caseVersionId:s.case_version_id,messages:rows.map(m=>({messageId:m.id,role:m.role,content:m.content,createdAt:new Date(m.created_at).toISOString()}))})};
   await c.query("INSERT INTO session_communication_evaluations(session_id,case_version_id,attempt_id,status,input,runtime_id,created_by,configuration) VALUES($1,$2,$3,'EVALUATING',$4,$5,$6,$7)",[sessionId,s.case_version_id,attempt,input,runtimeId,actor,{rubric:communicationRubric,instructions:communicationInstructions}]);
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  // The snapshot passed to runtime is detached. Persist only schema-validated adjudication.
  let output:unknown=null,failure:string|null=null;
  try{
   const result=await evaluateCommunication(input!,{mode:'SIMULATED',id:runtimeId,adjudicate});
   output=communicationOutputSchema.parse({version:'communication-adjudication/1',judgments:result.judgments.map(j=>({...j,evidence:j.evidence.map(({messageId,excerpt,occurrenceIndex})=>({messageId,excerpt,occurrenceIndex})),context:j.context.map(({messageId,excerpt,occurrenceIndex})=>({messageId,excerpt,occurrenceIndex}))}))});
  }catch(e){failure=e instanceof CommunicationError?e.code:'RUNTIME_FAILURE';}
  const completion=await db.connect();
  try{
   const saved=await completion.query("UPDATE session_communication_evaluations SET status=$3,output=$4,failure_code=$5,completed_at=now() WHERE session_id=$1 AND attempt_id=$2 AND status='EVALUATING' RETURNING status",[sessionId,attempt,failure?'FAILED':'COMPLETED',output,failure]);
   if(saved.rowCount!==1)throw new QuestionnaireError('CONFLICT',409);
   return {status:failure?'FAILED':'COMPLETED',recovered:false,failure};
  }finally{completion.release();}
 }};
}
