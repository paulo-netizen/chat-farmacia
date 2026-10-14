import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join,resolve } from 'node:path';
import { Pool } from 'pg';
import { beforeAll,beforeEach,afterAll,afterEach,describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { createTeacherDraftStore } from '@/lib/cases/v2/teacher-case-draft-store';
import { createTeacherPublicationStore } from '@/lib/cases/v2/teacher-publication';
import { resolveStudentPublicCaseVersionV2,resolveStudentPublicCaseVersionForResumeV2 } from '@/lib/cases/v2/resolve-student-public-case-version';
import { publicationFixture, publicationDraftFields } from '../unit/support/teacher-publication-fixture';
import { createTeacherPatientPreview } from '@/lib/cases/v2/teacher-patient-preview';
const enabled=process.env.RUN_TEACHER_DRAFT_POSTGRES==='1';
let db:Pool,actor:string,other:string,student:string;
const directories:string[]=[];
const review={clinical:true,solution:true,criteria:true,questionnaire:true,correspondence:true,warnings:true,note:'Fixture sintético exclusivamente técnico; no aprobación clínica.'};
async function user(role:string){return String((await db.query("INSERT INTO users(email,password_hash,name,role) VALUES ($1,'synthetic','Synthetic',$2) RETURNING id",[`${randomUUID()}@example.test`,role])).rows[0].id);}
async function prepare(audit='PASS',pending=false){
 const drafts=createTeacherDraftStore(db),d=await drafts.openTemplate(actor,'lucia');
 // A standalone synthetic fixture owned by a unique test user. Never the demonstration cases.
 const fields=publicationDraftFields();if(pending)fields.requirements[0].applicability='UNDETERMINED';
 const draft=await drafts.save(actor,d.caseId,d.versionId,fields);
 const id=`casever_${randomUUID()}`,bundle=publicationFixture(id);
 await db.query(`INSERT INTO case_versions(id,case_id,version_number,parent_version_id,status,source_kind,content_format,content,created_by)
 VALUES ($1,$2,$3,$4,'AI_DRAFT','AI_GENERATED','GENERATED_CASE_BUNDLE_V2',$5,$6)`,[id,draft.caseId,draft.revision+1,draft.versionId,bundle,actor]);
 await db.query(`INSERT INTO teacher_publication_candidates(candidate_version_id,draft_version_id,case_id,audit_status,audit_kind,audit_reference,created_by)
 VALUES ($1,$2,$3,$4,'SYNTHETIC_TEST','fixture-publication/1-not-clinical',$5)`,[id,draft.versionId,draft.caseId,audit,actor]);
 return {draft,id,store:createTeacherPublicationStore(db),action:{expectedDraftVersionId:draft.versionId,candidateVersionId:id}};
}
describe.skipIf(!enabled)('publication in verified disposable PostgreSQL only',()=>{
 beforeAll(async()=>{
  const port=process.env.TEACHER_PUBLICATION_TEST_PORT==='55452'?55452:55451;
  db=new Pool({host:'127.0.0.1',port,user:'postgres',database:'chatusal_editor_disposable',ssl:false});
  expect((await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows).toEqual([{db:'chatusal_editor_disposable',marker:'teacher-editor-20261012-disposable'}]);
  if(!(await db.query("SELECT to_regclass('public.users') t")).rows[0].t){
   for(const f of ['0001_v1_baseline.sql','0002_v2_case_versioning.sql','0003_v2_spfa_evaluation_persistence.sql','0004_v2_pharmaceutical_evaluation_persistence.sql','0005_v2_teacher_case_drafts.sql'])await db.query(readFileSync(`db/migrations/${f}`,'utf8'));
  }
  if(!(await db.query("SELECT to_regclass('public.teacher_publication_candidates') t")).rows[0].t)await db.query(readFileSync('db/migrations/0006_v2_teacher_publication.sql','utf8'));
 });
 beforeEach(async()=>{actor=await user('teacher');other=await user('teacher');student=await user('student');});
 afterAll(async()=>{await db?.end();});
 afterEach(async()=>{for(const dir of directories.splice(0)){const target=resolve(dir);if(target.startsWith(resolve(tmpdir())+'\\teacher-publication-test-')||target.startsWith(resolve(tmpdir())+'/teacher-publication-test-'))await rm(target,{recursive:true,force:true});}});
 it('publishes explicitly, resolves only three public fields, preserves source and creates no academic records',async()=>{
  const {draft,id,store,action}=await prepare();
  const directory=await mkdtemp(join(tmpdir(),'teacher-publication-test-'));directories.push(directory);
  // Conversation transport is simulated; the real preview store/DB ownership and snapshot path run.
  const previews=createTeacherPatientPreview(directory,createTeacherDraftStore(db).read,async input=>({reply:input.clinicalContent.contentFormat==='TEACHER_DRAFT_PATIENT_V1'?input.clinicalContent.initialDemand as any:'',receipt:{calls:[],totalInputTokens:0,totalOutputTokens:0,usageComplete:true}} as any));
  const preview=await previews.create(actor,draft.caseId,draft.versionId);
  const conversation=await previews.turn(actor,preview.id,{requestId:randomUUID(),expectedMessages:0});expect(conversation.messages).toEqual([{role:'patient',content:'Solicita consejo'}]);
  const initial=await store.read(actor,draft.caseId);expect(initial.canValidate).toBe(true);expect(initial.canPublish).toBe(false);
  await expect(store.act(actor,draft.caseId,{...action,action:'publish'})).rejects.toMatchObject({code:'CONFLICT'});
  const validated=await store.act(actor,draft.caseId,{...action,action:'validate',review});expect(validated.candidate?.status).toBe('VALIDATED');
  expect((await store.act(actor,draft.caseId,{...action,action:'publish'})).candidate?.status).toBe('PUBLISHED');
  const row=(await db.query('SELECT * FROM case_versions WHERE id=$1',[id])).rows[0];
  const publicData=resolveStudentPublicCaseVersionV2({...row,case_id:Number(row.case_id)}).publicCaseData;expect(Object.keys(publicData).sort()).toEqual(['edad','nombre','sexo']);
  expect((await createTeacherDraftStore(db).read(actor,draft.caseId)).versionId).toBe(draft.versionId);
  expect(await previews.read(actor,preview.id)).toEqual(conversation);
  for(const table of ['sessions','case_assignments'])expect((await db.query(`SELECT count(*)::int n FROM ${table} WHERE case_id=$1`,[draft.caseId])).rows[0].n).toBe(0);
  const events=(await db.query('SELECT to_status FROM case_version_status_events WHERE case_version_id=$1 ORDER BY id',[id])).rows.map(x=>x.to_status);
  expect(events).toEqual(['AI_DRAFT','IN_REVIEW','VALIDATED','PUBLISHED']);
 });
 it.each(['PENDING','FAIL'])('blocks %s audit in service and database',async audit=>{
  const {draft,id,store,action}=await prepare(audit);expect((await store.read(actor,draft.caseId)).canValidate).toBe(false);
  await expect(store.act(actor,draft.caseId,{...action,action:'validate',review})).rejects.toMatchObject({code:'CONFLICT'});
  await db.query("UPDATE case_versions SET status='IN_REVIEW' WHERE id=$1",[id]);
  await db.query('INSERT INTO teacher_publication_approvals(candidate_version_id,reviewer_id,note) VALUES ($1,$2,$3)',[id,actor,review.note]);
  await expect(db.query("UPDATE case_versions SET status='VALIDATED' WHERE id=$1",[id])).rejects.toThrow();
 });
 it('blocks unresolved requirement applicability without treating undetermined adherence as failure',async()=>{
  const {draft,store,action}=await prepare('PASS',true);
  const state=await store.read(actor,draft.caseId);expect(state.checks.draftStructure).toBe('PASS');expect(state.checks.requirements).toBe('PENDING');expect(state.canValidate).toBe(false);
  await expect(store.act(actor,draft.caseId,{...action,action:'validate',review})).rejects.toMatchObject({code:'CONFLICT'});
 });
 it('requires current ownership/role, no client audit replacement',async()=>{
  const {draft,store,action}=await prepare();
  await expect(store.read(student,draft.caseId)).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(store.read(other,draft.caseId)).rejects.toMatchObject({code:'NOT_FOUND'});
  await expect(store.act(other,draft.caseId,{...action,action:'validate',review})).rejects.toMatchObject({code:'NOT_FOUND'});
  await db.query("UPDATE users SET role='student' WHERE id=$1",[actor]);
  await expect(store.act(actor,draft.caseId,{...action,action:'validate',review})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('editing invalidates approval and keeps candidate/source immutable; concurrent publication cannot bypass it',async()=>{
  const {draft,id,store,action}=await prepare();await store.act(actor,draft.caseId,{...action,action:'validate',review});
  const next=await createTeacherDraftStore(db).save(actor,draft.caseId,draft.versionId,{...draft.fields,title:'New revision'});
  expect(next.revision).toBe(draft.revision+2);expect((await store.read(actor,draft.caseId)).candidate).toBeNull();
  await expect(store.act(actor,draft.caseId,{...action,action:'publish'})).rejects.toMatchObject({code:'CONFLICT'});
  await expect(db.query("UPDATE case_versions SET status='PUBLISHED' WHERE id=$1",[id])).rejects.toThrow();
  await expect(db.query("UPDATE teacher_publication_candidates SET audit_status='PASS' WHERE candidate_version_id=$1",[id])).rejects.toThrow();
  await expect(db.query("UPDATE teacher_publication_approvals SET note='changed' WHERE candidate_version_id=$1",[id])).rejects.toThrow();
 });
 it('serializes duplicate validation; a later approved publication archives but retains old version',async()=>{
  const first=await prepare();const results=await Promise.allSettled([first.store.act(actor,first.draft.caseId,{...first.action,action:'validate',review}),first.store.act(actor,first.draft.caseId,{...first.action,action:'validate',review})]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  await first.store.act(actor,first.draft.caseId,{...first.action,action:'publish'});
  const content=(await db.query('SELECT content FROM case_versions WHERE id=$1',[first.id])).rows[0].content;
  const second=await prepare();await second.store.act(actor,second.draft.caseId,{...second.action,action:'validate',review});await second.store.act(actor,second.draft.caseId,{...second.action,action:'publish'});
  const old=(await db.query('SELECT * FROM case_versions WHERE id=$1',[first.id])).rows[0];expect(old.status).toBe('ARCHIVED');expect(old.content).toEqual(content);
  expect(()=>resolveStudentPublicCaseVersionV2(old)).toThrow();expect(resolveStudentPublicCaseVersionForResumeV2({...old,case_id:Number(old.case_id)}).caseVersionId).toBe(first.id);
 });
});
