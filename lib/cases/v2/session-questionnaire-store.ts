import 'server-only';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {questionnaireDefinition,questionnairePublic,questionnaireWriteSchema,normalizeQuestionnaireAnswers,gradeQuestionnaire,type QuestionnaireDefinition} from './session-questionnaire';
export class QuestionnaireError extends Error {constructor(public code:'FORBIDDEN'|'NOT_FOUND'|'NOT_READY'|'NOT_CONFIGURED'|'CONFLICT'|'INVALID',public status:number){super(code);}}
const sid=z.string().uuid();
export function createSessionQuestionnaireStore(db:Pick<Pool,'connect'>){
 async function tx<T>(actor:string,sessionId:string|undefined,work:(c:PoolClient,s:any)=>Promise<T>){
  if(!/^[1-9][0-9]{0,15}$/.test(actor))throw new QuestionnaireError('FORBIDDEN',403);if(sessionId)sid.parse(sessionId);
  const c=await db.connect();try{await c.query('BEGIN');if((await c.query('SELECT role FROM users WHERE id=$1 FOR SHARE',[actor])).rows[0]?.role!=='student')throw new QuestionnaireError('FORBIDDEN',403);
   const s=sessionId?(await c.query('SELECT * FROM sessions WHERE id=$1 AND user_id=$2 FOR UPDATE',[sessionId,actor])).rows[0]:null;if(sessionId&&!s)throw new QuestionnaireError('NOT_FOUND',404);
   const r=await work(c,s);await c.query('COMMIT');return r;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 const load=async(c:PoolClient,s:any)=>{if(s.status!=='finished')throw new QuestionnaireError('NOT_READY',409);const r=(await c.query('SELECT * FROM session_questionnaires WHERE session_id=$1',[s.id])).rows[0];if(!r||r.case_version_id!==s.case_version_id)throw new QuestionnaireError('NOT_READY',409);return r;};
 const view=(r:any)=>questionnairePublic(r.definition as QuestionnaireDefinition,r.answers,r.revision,r.submitted_at?new Date(r.submitted_at).toISOString():null);
 return {
  list:(actor:string)=>tx(actor,undefined,async c=>(await c.query('SELECT q.session_id,q.submitted_at,q.updated_at FROM session_questionnaires q JOIN sessions s ON s.id=q.session_id WHERE s.user_id=$1 ORDER BY q.created_at DESC LIMIT 20',[actor])).rows.map(r=>({sessionId:r.session_id,submittedAt:r.submitted_at,updatedAt:r.updated_at}))),
  finish:(actor:string,sessionId:string)=>tx(actor,sessionId,async(c,s)=>{
   const old=(await c.query('SELECT * FROM session_questionnaires WHERE session_id=$1',[sessionId])).rows[0];if(old){if(s.status!=='finished'||s.case_version_id!==old.case_version_id)throw new QuestionnaireError('CONFLICT',409);return view(old);}
   const v=(await c.query('SELECT v.*,p.policy FROM case_versions v JOIN case_questionnaire_policies p ON p.case_version_id=v.id WHERE v.id=$1 AND v.case_id=$2',[s.case_version_id,s.case_id])).rows[0];
   if(!v)throw new QuestionnaireError('NOT_CONFIGURED',422);
   let definition:QuestionnaireDefinition;try{definition=questionnaireDefinition(v.content,v.content_format,v.id,v.policy);}catch{throw new QuestionnaireError('NOT_CONFIGURED',422);}
   // Same row lock used by the existing M5 message-write trigger: no message can cross the close.
   await c.query("UPDATE sessions SET status='finished',finished_at=coalesce(finished_at,now()) WHERE id=$1",[sessionId]);
   const row=(await c.query('INSERT INTO session_questionnaires(session_id,case_version_id,definition) VALUES($1,$2,$3) RETURNING *',[sessionId,s.case_version_id,definition])).rows[0];return view(row);
  }),
  read:(actor:string,sessionId:string)=>tx(actor,sessionId,async(c,s)=>view(await load(c,s))),
  write:(actor:string,sessionId:string,value:unknown)=>{
   const request=questionnaireWriteSchema.parse(value);return tx(actor,sessionId,async(c,s)=>{
    const r=await load(c,s),def=r.definition as QuestionnaireDefinition;let answers:ReturnType<typeof normalizeQuestionnaireAnswers>;
    try{answers=normalizeQuestionnaireAnswers(def,request.answers);}catch{throw new QuestionnaireError('INVALID',400);}
    if(r.submitted_at){if(request.action==='submit'&&JSON.stringify(answers)===JSON.stringify(normalizeQuestionnaireAnswers(def,r.answers)))return view(r);throw new QuestionnaireError('CONFLICT',409);}
    if(r.revision!==request.expectedRevision)throw new QuestionnaireError('CONFLICT',409);
    let grade=null;if(request.action==='submit'){try{grade=gradeQuestionnaire(def,answers);}catch{throw new QuestionnaireError('INVALID',400);}}
    const updated=(await c.query('UPDATE session_questionnaires SET answers=$2,revision=revision+1,grade=$3,submitted_at=CASE WHEN $3::jsonb IS NULL THEN NULL ELSE now() END,updated_at=now() WHERE session_id=$1 RETURNING *',[sessionId,JSON.stringify(answers),grade])).rows[0];return view(updated);
   });
  },
 };
}
