import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { teacherDraftTemplate } from './teacher-case-draft-templates';
import { SPFA_2026_REFERENCE, TEACHER_DRAFT_FORMAT, teacherDraftFieldsSchema, templateIdSchema, caseVersionIdSchema, type TeacherDraftFields, type TeacherDraftRecord, type TeacherDraftTemplateId } from './teacher-case-draft';

export class TeacherDraftError extends Error {
  constructor(public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'INVALID', public readonly status: number) { super(code); }
}
const caseIdValid = (v: string) => /^[1-9][0-9]{0,15}$/.test(v);
function record(row: any): TeacherDraftRecord {
  if (row.status !== 'TEACHER_DRAFT' || row.content_format !== TEACHER_DRAFT_FORMAT || row.content?.caseVersionId !== row.id || row.content?.schemaVersion !== 'teacher-case-draft/1') throw new TeacherDraftError('CONFLICT',409);
  return { caseId: String(row.case_id), versionId: caseVersionIdSchema.parse(row.id), revision: row.version_number, status: 'TEACHER_DRAFT', templateId: templateIdSchema.parse(row.content.templateId), fields: teacherDraftFieldsSchema.parse(row.content.fields) };
}
export function createTeacherDraftStore(db: Pick<Pool, 'connect'>) {
  async function transaction<T>(actorId: string, work: (c: PoolClient, admin: boolean) => Promise<T>) {
    if (!caseIdValid(actorId)) throw new TeacherDraftError('FORBIDDEN',403);
    const c = await db.connect();
    try {
      await c.query('BEGIN');
      // Check the current database role, not an arbitrary role supplied by a client.
      const user = await c.query('SELECT role FROM users WHERE id=$1 FOR SHARE', [actorId]);
      const role = user.rows[0]?.role;
      if (role !== 'teacher' && role !== 'admin') throw new TeacherDraftError('FORBIDDEN',403);
      const result = await work(c, role === 'admin');
      await c.query('COMMIT');
      return result;
    } catch (e) { await c.query('ROLLBACK'); throw e; }
    finally { c.release(); }
  }
  async function latest(c: PoolClient, caseId: string, actorId: string, admin: boolean) {
    if (!caseIdValid(caseId)) throw new TeacherDraftError('NOT_FOUND',404);
    const owner = await c.query('SELECT id FROM cases WHERE id=$1 AND (created_by=$2 OR $3) FOR UPDATE', [caseId, actorId, admin]);
    if (!owner.rowCount) throw new TeacherDraftError('NOT_FOUND',404);
    const row = (await c.query("SELECT * FROM case_versions WHERE case_id=$1 AND content_format='TEACHER_CASE_DRAFT_V1' ORDER BY version_number DESC LIMIT 1", [caseId])).rows[0];
    if (!row || row.content_format !== TEACHER_DRAFT_FORMAT) throw new TeacherDraftError('NOT_FOUND',404);
    return record(row);
  }
  async function insert(c: PoolClient, actorId: string, caseId: string, templateId: TeacherDraftTemplateId, fields: TeacherDraftFields, parent?: TeacherDraftRecord) {
    const id = `casever_${randomUUID()}`;
    const next = (await c.query('SELECT COALESCE(MAX(version_number),0)+1 n FROM case_versions WHERE case_id=$1',[caseId])).rows[0].n;
    const content = { schemaVersion: 'teacher-case-draft/1', caseVersionId: id, templateId, reference: SPFA_2026_REFERENCE, fields };
    const r = await c.query(`INSERT INTO case_versions (id,case_id,version_number,parent_version_id,status,source_kind,content_format,content,created_by)
      VALUES ($1,$2,$3,$4,'TEACHER_DRAFT','TEACHER_AUTHORED',$5,$6,$7) RETURNING *`,
      [id,caseId,next,parent?.versionId ?? null,TEACHER_DRAFT_FORMAT,content,actorId]);
    return record(r.rows[0]);
  }
  return {
    list: (actorId: string) => transaction(actorId, async (c,admin) => {
      const r = await c.query(`SELECT DISTINCT ON (v.case_id) v.* FROM case_versions v JOIN cases c ON c.id=v.case_id
        WHERE v.content_format=$1 AND (c.created_by=$2 OR $3) ORDER BY v.case_id,v.version_number DESC`, [TEACHER_DRAFT_FORMAT,actorId,admin]);
      return r.rows.filter(r => r.status === 'TEACHER_DRAFT').map(r => { const d=record(r); return { caseId:d.caseId, versionId:d.versionId, revision:d.revision, title:d.fields.title, templateId:d.templateId }; });
    }),
    read: (actorId: string, caseId: string) => transaction(actorId, (c,admin) => latest(c,caseId,actorId,admin)),
    openTemplate: (actorId: string, templateId: TeacherDraftTemplateId) => {
      const id = templateIdSchema.parse(templateId);
      return transaction(actorId, async c => {
        // Serializes double clicks/recovery without resetting existing edits.
        await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`teacher-draft:${actorId}:${id}`]);
        const found = await c.query(`SELECT v.case_id FROM case_versions v JOIN cases c ON c.id=v.case_id
          WHERE c.created_by=$1 AND v.content_format=$2 AND v.content->>'templateId'=$3 ORDER BY v.created_at DESC LIMIT 1`, [actorId,TEACHER_DRAFT_FORMAT,id]);
        if (found.rowCount) return latest(c,String(found.rows[0].case_id),actorId,false);
        const fields = teacherDraftTemplate(id);
        // Legacy status is deliberately unavailable. The editable truth lives in immutable versions.
        const created = await c.query(`INSERT INTO cases(title,description,spec,ground_truth,status,service_type,created_by)
          VALUES ($1,'Borrador docente de desarrollo','{}','{}','rejected',$2,$3) RETURNING id`, [fields.title,fields.service,actorId]);
        return insert(c,actorId,String(created.rows[0].id),id,fields);
      });
    },
    save: (actorId: string, caseId: string, expectedVersionId: string, input: unknown) => {
      const fields = teacherDraftFieldsSchema.parse(input); // snapshot before the first await
      const expected = caseVersionIdSchema.parse(expectedVersionId);
      return transaction(actorId, async (c,admin) => {
        const previous = await latest(c,caseId,actorId,admin);
        if (previous.versionId !== expected) throw new TeacherDraftError('CONFLICT',409);
        return insert(c,actorId,caseId,previous.templateId,fields,previous);
      });
    },
  };
}
