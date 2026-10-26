import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {z} from 'zod';
import {caseVersionIdSchema} from './teacher-case-draft';
import {createTeacherDraftStore,TeacherDraftError} from './teacher-case-draft-store';
import {buildTeacherNativePackage,TEACHER_NATIVE_FORMAT} from './build-teacher-native-package';
export const nativeRequestSchema=z.object({expectedDraftVersionId:caseVersionIdSchema}).strict();
export function createTeacherNativeStore(db:Pick<Pool,'connect'>){
 return {convert:async(actor:string,caseId:string,input:unknown)=>{
  const request=nativeRequestSchema.parse(input);
  const draft=await createTeacherDraftStore(db).read(actor,caseId);
  if(draft.versionId!==request.expectedDraftVersionId)throw new TeacherDraftError('CONFLICT',409);
  const id=`casever_${randomUUID()}`;
  const result=buildTeacherNativePackage(draft,id);
  if(result.status==='BLOCKED')return result;
  const c=await db.connect();
  try{
   await c.query('BEGIN');
   const role=(await c.query('SELECT role FROM users WHERE id=$1 FOR SHARE',[actor])).rows[0]?.role;
   if(!['teacher','admin'].includes(role))throw new TeacherDraftError('FORBIDDEN',403);
   if(!(await c.query('SELECT id FROM cases WHERE id=$1 AND (created_by=$2 OR $3) FOR UPDATE',[caseId,actor,role==='admin'])).rowCount)throw new TeacherDraftError('NOT_FOUND',404);
   const latest=(await c.query("SELECT id FROM case_versions WHERE case_id=$1 AND content_format='TEACHER_CASE_DRAFT_V1' ORDER BY version_number DESC LIMIT 1",[caseId])).rows[0]?.id;
   if(latest!==draft.versionId)throw new TeacherDraftError('CONFLICT',409);
   const prior=(await c.query('SELECT id FROM case_versions WHERE parent_version_id=$1 AND content_format=$2',[draft.versionId,TEACHER_NATIVE_FORMAT])).rows[0];
   if(prior){await c.query('COMMIT');return {status:'READY' as const,candidateVersionId:prior.id,missing:[]};}
   const n=(await c.query('SELECT COALESCE(MAX(version_number),0)+1 n FROM case_versions WHERE case_id=$1',[caseId])).rows[0].n;
   await c.query("INSERT INTO case_versions(id,case_id,version_number,parent_version_id,status,source_kind,content_format,content,created_by) VALUES ($1,$2,$3,$4,'TEACHER_DRAFT','TEACHER_AUTHORED',$5,$6,$7)",[id,caseId,n,draft.versionId,TEACHER_NATIVE_FORMAT,result.bundle,actor]);
   await c.query("INSERT INTO teacher_publication_candidates(candidate_version_id,draft_version_id,case_id,audit_status,audit_reference,audit_kind,created_by) VALUES ($1,$2,$3,'PENDING',$4,'AUTOMATED',$5)",[id,draft.versionId,caseId,`native-authoring/1:${draft.versionId}`,actor]);
   await c.query('COMMIT');return {status:'READY' as const,candidateVersionId:id,missing:[]};
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }};
}
