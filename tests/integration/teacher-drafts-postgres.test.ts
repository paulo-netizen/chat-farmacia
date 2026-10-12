import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { beforeAll, beforeEach, afterAll, describe, it, expect, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { createTeacherDraftStore } from '@/lib/cases/v2/teacher-case-draft-store';
import { resolveStudentPublicCaseVersionV2 } from '@/lib/cases/v2/resolve-student-public-case-version';
const enabled=process.env.RUN_TEACHER_DRAFT_POSTGRES==='1';
const config={host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable',ssl:false as const};
let db:Pool,store:ReturnType<typeof createTeacherDraftStore>,actor:string,other:string,student:string;
async function identity() {
 const r=await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()");
 expect(r.rows).toEqual([{db:config.database,marker:'teacher-editor-20261012-disposable'}]);
}
async function user(role:string) {const r=await db.query("INSERT INTO users(email,password_hash,name,role) VALUES ($1,'synthetic','Synthetic',$2) RETURNING id",[`${role}-${crypto.randomUUID()}@example.test`,role]);return String(r.rows[0].id);}
describe.skipIf(!enabled)('teacher editor disposable PostgreSQL',()=>{
 beforeAll(async()=>{
   db=new Pool(config);await identity();
   if(!(await db.query("SELECT to_regclass('public.users') t")).rows[0].t) {
     for(const f of ['0001_v1_baseline.sql','0002_v2_case_versioning.sql','0003_v2_spfa_evaluation_persistence.sql','0004_v2_pharmaceutical_evaluation_persistence.sql','0005_v2_teacher_case_drafts.sql']) await db.query(readFileSync(`db/migrations/${f}`,'utf8'));
   }
   store=createTeacherDraftStore(db);
 },30000);
 beforeEach(async()=>{await identity();actor=await user('teacher');other=await user('teacher');student=await user('student');});
 afterAll(async()=>{await db?.end();});
 it.each(['lucia','maria'] as const)('roundtrips %s in new connection, append-only and no academic contamination',async id=>{
   const d=await store.openTemplate(actor,id);const initial=structuredClone(d.fields);
   const edited={...d.fields,title:d.fields.title+' editado'};
   const saved=await store.save(actor,d.caseId,d.versionId,edited);
   const independent=new Pool(config);
   try {expect(await createTeacherDraftStore(independent).read(actor,d.caseId)).toEqual(saved);}finally{await independent.end();}
   expect(saved.revision).toBe(2);expect(saved.status).toBe('TEACHER_DRAFT');
   const rows=(await db.query('SELECT * FROM case_versions WHERE case_id=$1 ORDER BY version_number',[d.caseId])).rows;
   expect(rows[0].content.fields).toEqual(initial);expect(rows[1].parent_version_id).toBe(rows[0].id);
   expect(()=>resolveStudentPublicCaseVersionV2(rows[1])).toThrow();
   for(const table of ['sessions','case_assignments']) expect((await db.query(`SELECT count(*)::int n FROM ${table} WHERE case_id=$1`,[d.caseId])).rows[0].n).toBe(0);
   expect((await db.query('SELECT count(*)::int n FROM case_version_status_events WHERE case_version_id=$1',[saved.versionId])).rows[0].n).toBe(1);
   expect(await store.openTemplate(actor,id)).toEqual(saved);
 });
 it('deduplicates opening and rejects a stale/concurrent save',async()=>{
   const opens=await Promise.all([store.openTemplate(actor,'lucia'),store.openTemplate(actor,'lucia')]);expect(opens[0]).toEqual(opens[1]);
   const d=opens[0];const r=await Promise.allSettled([store.save(actor,d.caseId,d.versionId,{...d.fields,title:'A'}),store.save(actor,d.caseId,d.versionId,{...d.fields,title:'B'})]);
   expect(r.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(r.find(x=>x.status==='rejected')).toMatchObject({reason:{code:'CONFLICT'}});
 });
 it('enforces database role and ownership for reads/list/writes',async()=>{
   const d=await store.openTemplate(actor,'maria');
   expect(await store.list(other)).toEqual([]);
   await expect(store.read(other,d.caseId)).rejects.toMatchObject({code:'NOT_FOUND'});
   await expect(store.save(other,d.caseId,d.versionId,d.fields)).rejects.toMatchObject({code:'NOT_FOUND'});
   for(const run of [()=>store.list(student),()=>store.read(student,d.caseId),()=>store.openTemplate(student,'lucia'),()=>store.save(student,d.caseId,d.versionId,d.fields)]) await expect(run()).rejects.toMatchObject({code:'FORBIDDEN'});
   await db.query("UPDATE users SET role='student' WHERE id=$1",[actor]);await expect(store.read(actor,d.caseId)).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('database rejects publication, historical mutation, legacy approval and academic start',async()=>{
   const d=await store.openTemplate(actor,'maria');
   await expect(db.query("UPDATE case_versions SET content='{}' WHERE id=$1",[d.versionId])).rejects.toThrow();
   await expect(db.query("UPDATE case_versions SET status='IN_REVIEW' WHERE id=$1",[d.versionId])).rejects.toThrow();
   await expect(db.query("UPDATE case_versions SET status='PUBLISHED' WHERE id=$1",[d.versionId])).rejects.toThrow();
   await expect(db.query("UPDATE cases SET status='approved' WHERE id=$1",[d.caseId])).rejects.toThrow();
   await expect(db.query("INSERT INTO sessions(user_id,case_id,case_version_id) VALUES ($1,$2,$3)",[student,d.caseId,d.versionId])).rejects.toThrow();
   expect((await store.read(actor,d.caseId)).status).toBe('TEACHER_DRAFT');
 });
 it('validates before writes and snapshots inputs before await',async()=>{
   const d=await store.openTemplate(actor,'lucia');
   expect(()=>store.save(actor,d.caseId,d.versionId,{...d.fields,title:''})).toThrow();
   const pending=store.save(actor,d.caseId,d.versionId,d.fields);d.fields.title='tampered';
   expect((await pending).fields.title).not.toBe('tampered');
 });
});
