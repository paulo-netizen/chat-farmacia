import 'server-only';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Pool } from 'pg';
import { createTeacherPublicationStore } from './teacher-publication';
import { TeacherDraftError } from './teacher-case-draft-store';
import { digest,type AcademicReviewPackage,type SourceEvidence } from './teacher-academic-preparation';
import type { runClinicalAuditor } from './teacher-clinical-auditor';
export function createTeacherClinicalAuditStore(db:Pick<Pool,'connect'>,run:(pkg:AcademicReviewPackage,sources:SourceEvidence[])=>ReturnType<typeof runClinicalAuditor>){
 return {audit:async(actor:string,caseId:string,input:unknown)=>{
  const request=z.object({preparationId:z.string().regex(/^preparation_[0-9a-f-]{36}$/)}).strict().parse(input);
  const view=await createTeacherPublicationStore(db).read(actor,caseId),p=view.preparation;
  if(!p||p.id!==request.preparationId||p.clinical_result)throw new TeacherDraftError('CONFLICT',409);
  const result=await run(p.package,p.audit.sources.evidence);
  if(result.packageHash!==digest(p.package))throw new TeacherDraftError('INVALID',400);
  const c=await db.connect();
  try{await c.query('BEGIN');
   const role=(await c.query('SELECT role FROM users WHERE id=$1 FOR SHARE',[actor])).rows[0]?.role;
   if(!['teacher','admin'].includes(role))throw new TeacherDraftError('FORBIDDEN',403);
   if(!(await c.query('SELECT id FROM cases WHERE id=$1 AND (created_by=$2 OR $3) FOR UPDATE',[caseId,actor,role==='admin'])).rowCount)throw new TeacherDraftError('NOT_FOUND',404);
   // Keep an audit of the historical immutable preparation if it was edited during the call;
   // only the current revision is displayed as current by the publication reader.
   await c.query('INSERT INTO teacher_clinical_audits(id,preparation_id,created_by,result) VALUES($1,$2,$3,$4)',[`audit_${randomUUID()}`,p.id,actor,result]);
   await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }};
}
