import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createTeacherDraftStore} from '@/lib/cases/v2/teacher-case-draft-store';
import {createTeacherNativeStore} from '@/lib/cases/v2/teacher-native-store';
import {createTeacherNativeAuditStore} from '@/lib/cases/v2/teacher-native-audit-store';
import {createTeacherPublicationStore} from '@/lib/cases/v2/teacher-publication';
import {teacherNativeProposal} from '@/lib/cases/v2/teacher-native-proposals';
import {resolveStudentPublicCaseVersionV2} from '@/lib/cases/v2/resolve-student-public-case-version';
import {syntheticSources,syntheticResult} from '../unit/support/teacher-native-audit-fixture';
let db:Pool;
const review={clinical:true,solution:true,criteria:true,questionnaire:true,correspondence:true,warnings:true,note:'Solo prueba técnica sintética, sin aprobar casos reales de desarrollo.'};
const user=async(role='teacher')=>String((await db.query("INSERT INTO users(email,password_hash,name,role) VALUES ($1,'synthetic','Audit test',$2) RETURNING id",[`${randomUUID()}@example.test`,role])).rows[0].id);
async function fixture(){const actor=await user(),drafts=createTeacherDraftStore(db),d=await drafts.openTemplate(actor,'lucia'),draft=await drafts.save(actor,d.caseId,d.versionId,teacherNativeProposal('lucia')),native=await createTeacherNativeStore(db).convert(actor,d.caseId,{expectedDraftVersionId:draft.versionId});if(native.status!=='READY')throw Error('fixture');return {actor,drafts,draft,request:{candidateVersionId:native.candidateVersionId,expectedDraftVersionId:draft.versionId}};}
const reader=vi.fn(async()=>structuredClone(syntheticSources[0]));
const runner=()=>vi.fn(async(p:any,s:any)=>syntheticResult(p,s));
describe.skipIf(process.env.RUN_TEACHER_DRAFT_POSTGRES!=='1')('native audit lifecycle on verified disposable DB only',()=>{
 beforeAll(async()=>{db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable',ssl:false});expect((await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows).toEqual([{db:'chatusal_editor_disposable',marker:'teacher-editor-20261012-disposable'}]);if(!(await db.query("SELECT to_regclass('teacher_native_audit_bindings') t")).rows[0].t)await db.query(readFileSync('db/migrations/0010_v2_teacher_native_audits.sql','utf8'));});
 afterAll(async()=>{await db?.end();});
 it('prepares without inference, audits, reviews and publishes a synthetic candidate',async()=>{
  const f=await fixture(),run=runner(),store=createTeacherNativeAuditStore(db,run,reader),pub=createTeacherPublicationStore(db);
  await store.act(f.actor,f.draft.caseId,{...f.request,action:'prepare',sourceKeys:['metformin850']});expect(run).not.toHaveBeenCalled();expect((await pub.read(f.actor,f.draft.caseId)).checks.clinicalAudit).toBe('PENDING');
  await expect(pub.act(f.actor,f.draft.caseId,{...f.request,action:'validate',review})).rejects.toMatchObject({code:'CONFLICT'});
  expect(await store.act(f.actor,f.draft.caseId,{...f.request,action:'run'})).toMatchObject({execution:'COMPLETED',status:'PASS'});expect(run).toHaveBeenCalledTimes(1);
  await pub.act(f.actor,f.draft.caseId,{...f.request,action:'validate',review});await pub.act(f.actor,f.draft.caseId,{...f.request,action:'publish'});
  const row=(await db.query('SELECT * FROM case_versions WHERE id=$1',[f.request.candidateVersionId])).rows[0];expect(Object.keys(resolveStudentPublicCaseVersionV2({...row,case_id:Number(row.case_id)}).publicCaseData).sort()).toEqual(['edad','nombre','sexo']);
  for(const table of ['sessions','case_assignments','teacher_academic_preparations'])expect((await db.query(`SELECT count(*)::int n FROM ${table} WHERE case_id=$1`,[f.draft.caseId])).rows[0].n).toBe(0);
 });
 it('editing after approval blocks reuse and preserves all audit evidence',async()=>{
  const f=await fixture(),store=createTeacherNativeAuditStore(db,runner(),reader),pub=createTeacherPublicationStore(db);await store.act(f.actor,f.draft.caseId,{...f.request,action:'prepare',sourceKeys:['metformin850']});await store.act(f.actor,f.draft.caseId,{...f.request,action:'run'});await pub.act(f.actor,f.draft.caseId,{...f.request,action:'validate',review});
  const old=(await db.query('SELECT * FROM teacher_native_audit_results WHERE candidate_version_id=$1',[f.request.candidateVersionId])).rows;
  await f.drafts.save(f.actor,f.draft.caseId,f.draft.versionId,{...f.draft.fields,title:'Nueva revisión clínica'});expect((await pub.read(f.actor,f.draft.caseId)).candidate).toBeNull();await expect(pub.act(f.actor,f.draft.caseId,{...f.request,action:'publish'})).rejects.toMatchObject({code:'CONFLICT'});
  await expect(db.query("UPDATE case_versions SET status='PUBLISHED' WHERE id=$1",[f.request.candidateVersionId])).rejects.toThrow();expect((await db.query('SELECT * FROM teacher_native_audit_results WHERE candidate_version_id=$1',[f.request.candidateVersionId])).rows).toEqual(old);
  await expect(db.query("UPDATE teacher_native_audit_bindings SET request_hash=repeat('a',64) WHERE candidate_version_id=$1",[f.request.candidateVersionId])).rejects.toThrow();
 });
 it('claims once, releases locks during await, and retains historical completion after edit',async()=>{
  const f=await fixture();let enter!:()=>void,release!:()=>void;const entered=new Promise<void>(r=>enter=r),wait=new Promise<void>(r=>release=r),run=vi.fn(async(p:any,s:any)=>{enter();await wait;return syntheticResult(p,s);}),store=createTeacherNativeAuditStore(db,run,reader);
  await store.act(f.actor,f.draft.caseId,{...f.request,action:'prepare',sourceKeys:['metformin850']});const first=store.act(f.actor,f.draft.caseId,{...f.request,action:'run'});await entered;
  await expect(store.act(f.actor,f.draft.caseId,{...f.request,action:'run'})).rejects.toMatchObject({code:'CONFLICT'});
  await f.drafts.save(f.actor,f.draft.caseId,f.draft.versionId,{...f.draft.fields,title:'Editado durante auditoría'});release();await first;expect(run).toHaveBeenCalledTimes(1);expect((await createTeacherPublicationStore(db).read(f.actor,f.draft.caseId)).nativeAudit).toBeNull();expect((await db.query('SELECT count(*)::int n FROM teacher_native_audit_results WHERE candidate_version_id=$1',[f.request.candidateVersionId])).rows[0].n).toBe(1);
 });
 it.each(['FAIL','INSUFFICIENT'] as const)('blocks %s without making it teacher approval',async status=>{
  const f=await fixture(),store=createTeacherNativeAuditStore(db,async(p,s)=>syntheticResult(p,s,status),reader);await store.act(f.actor,f.draft.caseId,{...f.request,action:'prepare',sourceKeys:['metformin850']});await store.act(f.actor,f.draft.caseId,{...f.request,action:'run'});expect((await createTeacherPublicationStore(db).read(f.actor,f.draft.caseId)).canValidate).toBe(false);
 });
 it('blocks unauthorized actors and mismatched revisions before sources or runner',async()=>{
  const f=await fixture(),read=vi.fn(reader),run=runner(),store=createTeacherNativeAuditStore(db,run,read);for(const actor of [await user('student'),await user()])await expect(store.act(actor,f.draft.caseId,{...f.request,action:'prepare',sourceKeys:['metformin850']})).rejects.toBeDefined();expect(read).not.toHaveBeenCalled();expect(run).not.toHaveBeenCalled();
 });
 it('keeps failures safe and refuses restart, including a lost completion',async()=>{
  const f=await fixture(),run=vi.fn(async()=>{throw Error('SECRET_CLINICAL_RAW');}),store=createTeacherNativeAuditStore(db,run,reader);await store.act(f.actor,f.draft.caseId,{...f.request,action:'prepare',sourceKeys:['metformin850']});await store.act(f.actor,f.draft.caseId,{...f.request,action:'run'});const view=await createTeacherPublicationStore(db).read(f.actor,f.draft.caseId);expect(JSON.stringify(view.nativeAudit)).not.toContain('SECRET_CLINICAL_RAW');expect(view.nativeAudit?.execution).toBe('FAILED');await expect(createTeacherNativeAuditStore(db,run,reader).act(f.actor,f.draft.caseId,{...f.request,action:'run'})).rejects.toMatchObject({code:'CONFLICT'});expect(run).toHaveBeenCalledTimes(1);
  const g=await fixture();await store.act(g.actor,g.draft.caseId,{...g.request,action:'prepare',sourceKeys:['metformin850']});await db.query('INSERT INTO teacher_native_audit_claims(candidate_version_id,created_by) VALUES($1,$2)',[g.request.candidateVersionId,g.actor]);await expect(store.act(g.actor,g.draft.caseId,{...g.request,action:'run'})).rejects.toMatchObject({code:'CONFLICT'});
 });
});
