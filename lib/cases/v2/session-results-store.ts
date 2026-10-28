import 'server-only';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {questionnaireDefinition,normalizeQuestionnaireAnswers} from './session-questionnaire';
import {QuestionnaireError} from './session-questionnaire-store';
import {readResultSources} from './session-result-sources';
import {emptyDimension,resultPolicySchema,resultFingerprint,performanceResult,type ResultDimension} from './session-results';

const gradeSchema=z.object({version:z.literal('questionnaire-grade/1'),policyId:z.string(),scope:z.enum(['SYNTHETIC_TEST','ACADEMIC_APPROVED']),items:z.array(z.object({questionId:z.string(),outcome:z.enum(['BLANK','CORRECT','INCORRECT']),points:z.number().finite()}).strict()),raw:z.number().finite(),maximum:z.number().positive(),score:z.number().min(0).max(100)}).strict();
export function createSessionResultsStore(db:Pick<Pool,'connect'>){
 async function tx<T>(actor:string,sessionId:string,teacher:boolean,work:(c:PoolClient,s:any)=>Promise<T>){
  if(!/^[1-9][0-9]{0,15}$/.test(actor))throw new QuestionnaireError('FORBIDDEN',403);z.string().uuid().parse(sessionId);
  const c=await db.connect();try{
   await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
   const role=(await c.query('SELECT role FROM users WHERE id=$1',[actor])).rows[0]?.role;
   if(teacher?!['teacher','admin'].includes(role):role!=='student')throw new QuestionnaireError('FORBIDDEN',403);
   const s=(await c.query('SELECT s.*,c.created_by FROM sessions s JOIN cases c ON c.id=s.case_id WHERE s.id=$1',[sessionId])).rows[0];
   if(!s||(teacher?role!=='admin'&&String(s.created_by)!==actor:String(s.user_id)!==actor))throw new QuestionnaireError('NOT_FOUND',404);
   const value=await work(c,s);await c.query('COMMIT');return value;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async function compose(c:PoolClient,s:any){
  const q=(await c.query('SELECT * FROM session_questionnaires WHERE session_id=$1',[s.id])).rows[0];
  const binding={sessionId:s.id,caseVersionId:s.case_version_id};
  if(!q?.submitted_at||s.status!=='finished')return {status:'SUBMISSION_PENDING' as const,...binding};
  const row=(await c.query('SELECT policy FROM case_result_policies WHERE case_version_id=$1',[s.case_version_id])).rows[0];
  if(!row)return {status:'POLICY_PENDING' as const,...binding};
  const policy=resultPolicySchema.parse(row.policy);
  const dimensions=await readResultSources(c,s);
  let understanding:ResultDimension=emptyDimension('TECHNICAL_FAILURE');
  let questionnaire:{id:string;prompt:string;options:{id:string;text:string}[];selected:string[];correct:string[];explanation:string;outcome:string}[]=[];
  try{
   const v=(await c.query('SELECT content,content_format FROM case_versions WHERE id=$1',[s.case_version_id])).rows[0];
   const def=questionnaireDefinition(v.content,v.content_format,s.case_version_id,q.definition.policy);
   if(q.case_version_id!==s.case_version_id||resultFingerprint(def)!==resultFingerprint(q.definition))throw Error('RESULT_BINDING_INVALID');
   const grade=gradeSchema.parse(q.grade),answers=normalizeQuestionnaireAnswers(def,q.answers);
   if(grade.policyId!==def.policy.id||grade.scope!==def.policy.scope||grade.items.length!==def.questions.length||new Set(grade.items.map(i=>i.questionId)).size!==def.questions.length||grade.items.some(i=>!def.questions.some(p=>p.id===i.questionId)))throw Error('RESULT_BINDING_INVALID');
   // Read the existing receipt; never call gradeQuestionnaire or an evaluator here.
   understanding={...emptyDimension('AVAILABLE'),score:grade.score,source:{id:s.id,version:grade.version,versions:[def.policy.version,def.policy.id,`questionnaire-revision/${q.revision}`],fingerprint:resultFingerprint({definition:q.definition,answers:q.answers,grade:q.grade,revision:q.revision,submittedAt:q.submitted_at})}};
   questionnaire=def.questions.map(p=>({id:p.id,prompt:p.prompt,options:p.options.map(o=>({id:o.id,text:o.text})),selected:answers.find(a=>a.questionId===p.id)!.optionIds,correct:[...p.correctOptionIds],explanation:p.justification,outcome:grade.items.find(i=>i.questionId===p.id)!.outcome}));
   if(policy.scope==='ACADEMIC_APPROVED'&&def.policy.scope!=='ACADEMIC_APPROVED')throw Error('RESULT_SCOPE_MISMATCH');
  }catch{understanding=emptyDimension('TECHNICAL_FAILURE');questionnaire=[];}
  const result={version:'session-results/1' as const,...binding,policyId:policy.id,policyVersion:policy.version,synthetic:policy.scope==='SYNTHETIC_TEST',releasePolicy:policy.release,dimensions:{...dimensions,understanding},performance:performanceResult(policy,dimensions),questionnaire};
  return {status:'COMPOSED' as const,...result,fingerprint:resultFingerprint({result,policy})};
 }
 async function read(c:PoolClient,s:any,teacher:boolean){
  const result=await compose(c,s);if(result.status!=='COMPOSED')return result;
  const released=result.releasePolicy==='AFTER_SUBMISSION'||Boolean((await c.query('SELECT 1 FROM session_result_releases WHERE session_id=$1 AND fingerprint=$2',[s.id,result.fingerprint])).rows.length);
  if(!teacher&&!released)return {status:'HELD' as const,sessionId:s.id,caseVersionId:s.case_version_id,synthetic:result.synthetic};
  return {...result,status:released?'RELEASED' as const:'TEACHER_REVIEW' as const};
 }
 return {
  read:(actor:string,sessionId:string)=>tx(actor,sessionId,false,(c,s)=>read(c,s,false)),
  review:(actor:string,sessionId:string)=>tx(actor,sessionId,true,(c,s)=>read(c,s,true)),
  release:(actor:string,sessionId:string,expectedFingerprint:string)=>{
   z.string().regex(/^[0-9a-f]{64}$/).parse(expectedFingerprint);
   return tx(actor,sessionId,true,async(c,s)=>{
    const result=await compose(c,s);
    if(result.status!=='COMPOSED'||result.fingerprint!==expectedFingerprint||result.releasePolicy!=='TEACHER_REVIEW')throw new QuestionnaireError('CONFLICT',409);
    await c.query('INSERT INTO session_result_releases(session_id,fingerprint,case_version_id,released_by,snapshot) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[s.id,result.fingerprint,s.case_version_id,actor,result]);
    return {...result,status:'RELEASED' as const};
   });
  },
 };
}
