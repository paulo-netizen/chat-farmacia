import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { beforeAll,afterAll,describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { createTeacherDraftStore } from '@/lib/cases/v2/teacher-case-draft-store';
import { createTeacherPreparationStore } from '@/lib/cases/v2/teacher-preparation-store';
import { createTeacherPublicationStore } from '@/lib/cases/v2/teacher-publication';
import { createTeacherClinicalAuditStore } from '@/lib/cases/v2/teacher-clinical-audit-store';
import { auditDimensions,digest } from '@/lib/cases/v2/teacher-academic-preparation';
import type { SourceKey,SourceEvidence } from '@/lib/cases/v2/teacher-academic-preparation';
let db:Pool;
const source=async(key:SourceKey):Promise<SourceEvidence>=>({key,url:'https://cima.aemps.es/',retrievedAt:new Date().toISOString(),status:'UNAVAILABLE',code:'SOURCE_UNAVAILABLE'});
async function user(role='teacher'){return String((await db.query("INSERT INTO users(email,password_hash,name,role) VALUES ($1,'synthetic','Preparation test',$2) RETURNING id",[`${randomUUID()}@example.test`,role])).rows[0].id);}
describe.skipIf(process.env.RUN_TEACHER_DRAFT_POSTGRES!=='1')('preparation in disposable PostgreSQL',()=>{
 beforeAll(async()=>{
  db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable',ssl:false});
  expect((await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows).toEqual([{db:'chatusal_editor_disposable',marker:'teacher-editor-20261012-disposable'}]);
  if(!(await db.query("SELECT to_regclass('public.teacher_academic_preparations') t")).rows[0].t)await db.query(readFileSync('db/migrations/0007_v2_teacher_preparation.sql','utf8'));
  if(!(await db.query("SELECT to_regclass('public.teacher_clinical_audits') t")).rows[0].t)await db.query(readFileSync('db/migrations/0008_v2_teacher_clinical_audits.sql','utf8'));
 });
 afterAll(async()=>{await db?.end();});
 it.each(['lucia','maria'] as const)('prepares actual %s template, recovers in publication review, stays blocked without academic side effects',async template=>{
  const actor=await user(),drafts=createTeacherDraftStore(db),d=await drafts.openTemplate(actor,template);
  const p=await createTeacherPreparationStore(db,source).prepare(actor,d.caseId,{expectedDraftVersionId:d.versionId,sourceKeys:[template==='lucia'?'metformin850':'enalapril20']});
  const state=await createTeacherPublicationStore(db).read(actor,d.caseId);
  expect(state.preparation.package).toEqual(p.package);expect(state.preparation.audit.sources.status).toBe('PENDING');expect(state.canValidate).toBe(false);expect(state.canPublish).toBe(false);
  expect((await drafts.read(actor,d.caseId)).fields).toEqual(d.fields);
  for(const table of ['sessions','case_assignments'])expect((await db.query(`SELECT count(*)::int n FROM ${table} WHERE case_id=$1`,[d.caseId])).rows[0].n).toBe(0);
  await expect(db.query("UPDATE teacher_academic_preparations SET audit='{}' WHERE id=$1",[p.id])).rejects.toThrow();
  await drafts.save(actor,d.caseId,d.versionId,{...d.fields,title:'Changed'});
  expect((await createTeacherPublicationStore(db).read(actor,d.caseId)).preparation).toBeNull();
  expect((await db.query('SELECT package FROM teacher_academic_preparations WHERE id=$1',[p.id])).rows[0].package).toEqual(p.package);
 });
 it('checks ownership/role before source access',async()=>{
  const actor=await user(),d=await createTeacherDraftStore(db).openTemplate(actor,'lucia'),fetcher=vi.fn(source),store=createTeacherPreparationStore(db,fetcher);
  for(const other of [await user(),await user('student')])await expect(store.prepare(other,d.caseId,{expectedDraftVersionId:d.versionId,sourceKeys:['metformin850']})).rejects.toBeDefined();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('detects concurrent edit after network await; request arrays are snapshotted',async()=>{
  const actor=await user(),drafts=createTeacherDraftStore(db),d=await drafts.openTemplate(actor,'maria');
  const request={expectedDraftVersionId:d.versionId,sourceKeys:['enalapril20']};let calls=0;
  const store=createTeacherPreparationStore(db,async key=>{calls++;request.sourceKeys.push('metformin850');await drafts.save(actor,d.caseId,d.versionId,{...d.fields,title:'Concurrent edit'});return source(key);});
  await expect(store.prepare(actor,d.caseId,request)).rejects.toMatchObject({code:'CONFLICT'});expect(calls).toBe(1);
  expect((await db.query('SELECT count(*)::int n FROM teacher_academic_preparations WHERE case_id=$1',[d.caseId])).rows[0].n).toBe(0);
 });
 it('detects role revocation during source lookup',async()=>{
  const actor=await user(),d=await createTeacherDraftStore(db).openTemplate(actor,'lucia');
  await expect(createTeacherPreparationStore(db,async key=>{await db.query("UPDATE users SET role='student' WHERE id=$1",[actor]);return source(key);}).prepare(actor,d.caseId,{expectedDraftVersionId:d.versionId,sourceKeys:['metformin850']})).rejects.toMatchObject({code:'FORBIDDEN'});
 });
 it('binds auditor output to immutable preparation, refuses other owners and duplicate audit; preserves historical result after edit',async()=>{
  const actor=await user(),drafts=createTeacherDraftStore(db),d=await drafts.openTemplate(actor,'maria');
  const p=await createTeacherPreparationStore(db,source).prepare(actor,d.caseId,{expectedDraftVersionId:d.versionId,sourceKeys:[]});
  const run=vi.fn(async (pkg:any)=>({version:'teacher-clinical-auditor/1',packageHash:digest(pkg),requestHash:'synthetic',model:'gpt-5.6-terra' as const,judgment:{dimensions:auditDimensions.map(id=>({id,status:'INSUFFICIENT' as const,reason:'Synthetic test only',factRefs:[],sourceKeys:[],proposal:''}))},usage:{input:0,output:0,cachedRead:0,cachedWrite:0},requestId:undefined,countRequestId:undefined,costMicroUsd:0,reservation:0,countCost:null}));
  const store=createTeacherClinicalAuditStore(db,run);
  await expect(store.audit(await user(),d.caseId,{preparationId:p.id})).rejects.toBeDefined();expect(run).not.toHaveBeenCalled();
  await store.audit(actor,d.caseId,{preparationId:p.id});
  const view=await createTeacherPublicationStore(db).read(actor,d.caseId);expect(view.preparation.clinical_result.judgment.dimensions).toHaveLength(12);expect(view.canValidate).toBe(false);
  await expect(store.audit(actor,d.caseId,{preparationId:p.id})).rejects.toMatchObject({code:'CONFLICT'});expect(run).toHaveBeenCalledTimes(1);
  await expect(db.query('DELETE FROM teacher_clinical_audits WHERE preparation_id=$1',[p.id])).rejects.toThrow();
  await drafts.save(actor,d.caseId,d.versionId,{...d.fields,title:'New revision'});
  expect((await createTeacherPublicationStore(db).read(actor,d.caseId)).preparation).toBeNull();
  expect((await db.query('SELECT count(*)::int n FROM teacher_clinical_audits WHERE preparation_id=$1',[p.id])).rows[0].n).toBe(1);
 });
});
