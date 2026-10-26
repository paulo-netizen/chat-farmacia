import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createTeacherDraftStore} from '@/lib/cases/v2/teacher-case-draft-store';
import {createTeacherNativeStore} from '@/lib/cases/v2/teacher-native-store';
import {createTeacherPublicationStore} from '@/lib/cases/v2/teacher-publication';
import {teacherNativeProposal} from '@/lib/cases/v2/teacher-native-proposals';
let db:Pool;
const user=async(role='teacher')=>String((await db.query("INSERT INTO users(email,password_hash,name,role) VALUES ($1,'synthetic','Native test',$2) RETURNING id",[`${randomUUID()}@example.test`,role])).rows[0].id);
describe.skipIf(process.env.RUN_TEACHER_DRAFT_POSTGRES!=='1')('native conversion in verified disposable database',()=>{
 beforeAll(async()=>{
  db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable',ssl:false});
  expect((await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows).toEqual([{db:'chatusal_editor_disposable',marker:'teacher-editor-20261012-disposable'}]);
  if(!(await db.query("SELECT to_regclass('public.teacher_native_revision_once') t")).rows[0].t)await db.query(readFileSync('db/migrations/0009_v2_teacher_native_package.sql','utf8'));
 });
 afterAll(async()=>{await db?.end();});
 it.each(['lucia','maria'] as const)('saves, converts and recovers %s without approval or student effects',async template=>{
  const actor=await user(),drafts=createTeacherDraftStore(db),original=await drafts.openTemplate(actor,template);
  const d=await drafts.save(actor,original.caseId,original.versionId,teacherNativeProposal(template));
  const store=createTeacherNativeStore(db),request={expectedDraftVersionId:d.versionId};
  const [one,two]=await Promise.all([store.convert(actor,d.caseId,request),store.convert(actor,d.caseId,request)]);
  expect(one.status).toBe('READY');expect(two).toEqual(one);
  const view=await createTeacherPublicationStore(db).read(actor,d.caseId);
  expect(view.checks.canonicalPackage).toBe('PASS');expect(view.checks.clinicalAudit).toBe('PENDING');expect(view.canValidate).toBe(false);expect(view.canPublish).toBe(false);
  expect(view.candidate?.content.sourceDraft.versionId).toBe(d.versionId);
  expect((await drafts.read(actor,d.caseId)).fields).toEqual(d.fields);
  for(const role of ['student','teacher'])await expect(store.convert(await user(role),d.caseId,request)).rejects.toBeDefined();
  for(const table of ['sessions','case_assignments'])expect((await db.query(`SELECT count(*)::int n FROM ${table} WHERE case_id=$1`,[d.caseId])).rows[0].n).toBe(0);
  await expect(db.query("UPDATE case_versions SET status='VALIDATED' WHERE id=$1",[view.candidate?.versionId])).rejects.toThrow();
  await drafts.save(actor,d.caseId,d.versionId,{...d.fields,title:'Nueva revisión sin aprobar'});
  expect((await createTeacherPublicationStore(db).read(actor,d.caseId)).candidate).toBeNull();
  expect((await db.query('SELECT content FROM case_versions WHERE id=$1',[view.candidate?.versionId])).rows[0].content).toEqual(view.candidate?.content);
  await expect(store.convert(actor,d.caseId,request)).rejects.toMatchObject({code:'CONFLICT'});
 });
});
