import 'server-only';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { TeacherDraftError } from './teacher-case-draft-store';
import { caseVersionIdSchema, teacherDraftFieldsSchema } from './teacher-case-draft';
import { resolveSessionPatientClinicalContentV2, resolveSessionEvaluatorClinicalContentV2, resolveSessionSpfaClinicalContentV2 } from './resolve-session-clinical-content';
import { resolveStudentPublicCaseVersionV2 } from './resolve-student-public-case-version';
import { assertCaseVersionStatusTransitionV2, type CaseVersionStatusV2 } from './case-version-lifecycle';

export const publicationActionSchema = z.object({
 action:z.enum(['validate','publish']), expectedDraftVersionId:caseVersionIdSchema, candidateVersionId:caseVersionIdSchema,
 review:z.object({clinical:z.literal(true),solution:z.literal(true),criteria:z.literal(true),questionnaire:z.literal(true),
   correspondence:z.literal(true),warnings:z.literal(true),note:z.string().trim().min(10).max(2000)}).strict().optional(),
}).strict().superRefine((v,c)=>{if(v.action==='validate'&&!v.review)c.addIssue({code:'custom',path:['review'],message:'Human review required'});});

// These are structural checks, never a substitute for clinical audit or human approval.
export function checkPublicationPackage(row: any): boolean {
 try {
  const caseId=Number(row.case_id);
  if(!Number.isSafeInteger(caseId)||caseId<=0)return false;
  const input={caseId,caseVersionId:row.id,sourceKind:row.source_kind,legacyStatus:row.legacy_status,contentFormat:row.content_format,content:row.content};
  if(row.content_format!=='GENERATED_CASE_BUNDLE_V2')return false;
  resolveSessionPatientClinicalContentV2(input);resolveSessionEvaluatorClinicalContentV2(input);resolveSessionSpfaClinicalContentV2(input);
  resolveStudentPublicCaseVersionV2({...row,case_id:caseId,status:'PUBLISHED'});
  const r=row.content.derived.complianceReport;
  return r?.hasHardFailures===false && r.counts?.failed===0 && Array.isArray(r.dimensions) && r.dimensions.every((d:any)=>Array.isArray(d.checks)&&d.checks.every((c:any)=>c.status!=='fail'));
 } catch {return false;}
}

export function createTeacherPublicationStore(db:Pick<Pool,'connect'>) {
 async function tx<T>(actor:string,caseId:string,work:(c:PoolClient)=>Promise<T>) {
  if(!/^[1-9][0-9]{0,15}$/.test(actor)||!/^[1-9][0-9]{0,15}$/.test(caseId))throw new TeacherDraftError('FORBIDDEN',403);
  const c=await db.connect();
  try {
   await c.query('BEGIN');
   const role=(await c.query('SELECT role FROM users WHERE id=$1 FOR SHARE',[actor])).rows[0]?.role;
   if(role!=='teacher'&&role!=='admin')throw new TeacherDraftError('FORBIDDEN',403);
   if(!(await c.query('SELECT id FROM cases WHERE id=$1 AND (created_by=$2 OR $3) FOR UPDATE',[caseId,actor,role==='admin'])).rowCount)throw new TeacherDraftError('NOT_FOUND',404);
   const result=await work(c);await c.query('COMMIT');return result;
  } catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async function inspect(c:PoolClient,caseId:string) {
  const draft=(await c.query("SELECT * FROM case_versions WHERE case_id=$1 AND content_format='TEACHER_CASE_DRAFT_V1' ORDER BY version_number DESC LIMIT 1",[caseId])).rows[0];
  if(!draft)throw new TeacherDraftError('NOT_FOUND',404);
  const preparation=(await c.query('SELECT p.id,p.created_at,p.package,p.audit,a.result clinical_result FROM teacher_academic_preparations p LEFT JOIN teacher_clinical_audits a ON a.preparation_id=p.id WHERE p.draft_version_id=$1 AND p.case_id=$2 ORDER BY p.created_at DESC,p.id DESC LIMIT 1',[draft.id,caseId])).rows[0]??null;
  const row=(await c.query(`SELECT v.*,p.audit_status,p.audit_kind,p.audit_reference,a.reviewed_at,a.reviewer_id,a.note
   FROM teacher_publication_candidates p JOIN case_versions v ON v.id=p.candidate_version_id
   LEFT JOIN teacher_publication_approvals a ON a.candidate_version_id=v.id
   WHERE p.draft_version_id=$1 AND p.case_id=$2 ORDER BY v.version_number DESC LIMIT 1`,[draft.id,caseId])).rows[0];
  const parsedDraft=teacherDraftFieldsSchema.safeParse(draft.content.fields);
  const validDraft=parsedDraft.success;
  const applicabilityResolved=parsedDraft.success&&parsedDraft.data.requirements.every(r=>r.applicability!=='UNDETERMINED');
  const checks={draftStructure:validDraft?'PASS':'FAIL',canonicalPackage:row?(checkPublicationPackage(row)?'PASS':'FAIL'):'MISSING',
   requirements:applicabilityResolved?'PASS':'PENDING',clinicalAudit:row?.audit_status??'PENDING',humanReview:row?.reviewed_at?'APPROVED':'PENDING'};
  const ready=checks.draftStructure==='PASS'&&checks.requirements==='PASS'&&checks.canonicalPackage==='PASS'&&['PASS','WARNING'].includes(checks.clinicalAudit);
  return {draft,row,view:{draftVersionId:draft.id,revision:draft.version_number,preparation,checks,candidate:row?{versionId:row.id,status:row.status,
    auditKind:row.audit_kind,auditReference:row.audit_reference,reviewedAt:row.reviewed_at??null,reviewerId:row.reviewer_id??null,note:row.note??null,
    // Teacher-only API. Full canonical content must be available for correspondence review.
    content:row.content}:null,
    canValidate:ready&&['AI_DRAFT','TEACHER_DRAFT','IN_REVIEW'].includes(row?.status),canPublish:ready&&row?.status==='VALIDATED'&&!!row.reviewed_at}};
 }
 async function transition(c:PoolClient,row:any,to:CaseVersionStatusV2,actor:string) {
  assertCaseVersionStatusTransitionV2(row.status,to);
  await c.query("SELECT set_config('chatusal.case_version_actor_user_id',$1,true),set_config('chatusal.case_version_reason',$2,true)",[actor,'teacher-publication/1']);
  await c.query('UPDATE case_versions SET status=$2 WHERE id=$1',[row.id,to]);row.status=to;
 }
 return {
  read:(actor:string,caseId:string)=>tx(actor,caseId,async c=>(await inspect(c,caseId)).view),
  act:(actor:string,caseId:string,input:unknown)=>{
   const action=publicationActionSchema.parse(input); // Own snapshot before await.
   return tx(actor,caseId,async c=>{
    const {draft,row,view}=await inspect(c,caseId);
    if(draft.id!==action.expectedDraftVersionId||row?.id!==action.candidateVersionId)throw new TeacherDraftError('CONFLICT',409);
    if(action.action==='validate'){
     if(!view.canValidate||!action.review)throw new TeacherDraftError('CONFLICT',409);
     if(row.status!=='IN_REVIEW')await transition(c,row,'IN_REVIEW',actor);
     await c.query('INSERT INTO teacher_publication_approvals(candidate_version_id,reviewer_id,note) VALUES ($1,$2,$3)',[row.id,actor,action.review.note]);
     await transition(c,row,'VALIDATED',actor);
    }else{
     if(!view.canPublish)throw new TeacherDraftError('CONFLICT',409);
     const old=(await c.query("SELECT * FROM case_versions WHERE case_id=$1 AND status='PUBLISHED' FOR UPDATE",[caseId])).rows;
     for(const prior of old)await transition(c,prior,'ARCHIVED',actor);
     await transition(c,row,'PUBLISHED',actor);
    }
    return (await inspect(c,caseId)).view;
   });
  },
 };
}
