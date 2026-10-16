import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createTeacherDraftStore, TeacherDraftError } from './teacher-case-draft-store';
import { caseVersionIdSchema } from './teacher-case-draft';
import { prepareAcademicReview, auditAcademicReview, preparationRequestSchema, readCimaSource } from './teacher-academic-preparation';

export function createTeacherPreparationStore(db:Pick<Pool,'connect'>,sourceReader=readCimaSource) {
  return {prepare:async(actor:string,caseId:string,input:unknown)=>{
    const request=preparationRequestSchema.parse(input);
    caseVersionIdSchema.parse(request.expectedDraftVersionId);
    const draft=await createTeacherDraftStore(db).read(actor,caseId);
    if(draft.versionId!==request.expectedDraftVersionId)throw new TeacherDraftError('CONFLICT',409);
    const pkg=prepareAcademicReview(draft);
    // No database transaction/locks are retained while contacting the official source.
    const sources=[];
    for(const key of request.sourceKeys)sources.push(await sourceReader(key));
    const audit=auditAcademicReview(pkg,sources);
    const c=await db.connect();
    try {
      await c.query('BEGIN');
      const role=(await c.query('SELECT role FROM users WHERE id=$1 FOR SHARE',[actor])).rows[0]?.role;
      if(!['teacher','admin'].includes(role))throw new TeacherDraftError('FORBIDDEN',403);
      if(!(await c.query('SELECT id FROM cases WHERE id=$1 AND (created_by=$2 OR $3) FOR UPDATE',[caseId,actor,role==='admin'])).rowCount)throw new TeacherDraftError('NOT_FOUND',404);
      const latest=(await c.query("SELECT id FROM case_versions WHERE case_id=$1 AND content_format='TEACHER_CASE_DRAFT_V1' ORDER BY version_number DESC LIMIT 1",[caseId])).rows[0]?.id;
      if(latest!==draft.versionId)throw new TeacherDraftError('CONFLICT',409);
      const id=`preparation_${randomUUID()}`;
      await c.query('INSERT INTO teacher_academic_preparations(id,case_id,draft_version_id,created_by,package,audit) VALUES ($1,$2,$3,$4,$5,$6)',[id,caseId,draft.versionId,actor,pkg,audit]);
      await c.query('COMMIT');return {id,package:pkg,audit};
    } catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  }};
}
