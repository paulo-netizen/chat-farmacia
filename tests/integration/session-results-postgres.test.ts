import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createM9Fixture,m9Policy} from '../unit/support/m9-fixture';
import {createSessionResultsStore} from '@/lib/cases/v2/session-results-store';
import {failSpfaEvaluationAttemptV2} from '@/lib/cases/v2/spfa-evaluation-persistence-runtime';
let db:Pool;
describe.skipIf(process.env.RUN_TEACHER_DRAFT_POSTGRES!=='1')('M9 on verified disposable PostgreSQL',()=>{
 beforeAll(async()=>{db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable'});expect((await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows).toEqual([{db:'chatusal_editor_disposable',marker:'teacher-editor-20261012-disposable'}]);if(!(await db.query("SELECT to_regclass('case_result_policies') t")).rows[0].t)await db.query(readFileSync('db/migrations/0012_v2_session_results.sql','utf8'));});
 afterAll(async()=>db?.end());
 it('reveals the pinned receipt only after definitive submission and reads without writes or duplicate grading',async()=>{
  const f=await createM9Fixture(db),store=createSessionResultsStore(db);
  expect(await store.read(f.student,f.sessionId)).toMatchObject({status:'SUBMISSION_PENDING'});
  await f.submit();const before=(await db.query('SELECT * FROM session_questionnaires WHERE session_id=$1',[f.sessionId])).rows[0];
  const result=await store.read(f.student,f.sessionId);expect(result.status).toBe('RELEASED');if(!('dimensions' in result))throw Error('missing results');
  expect(result.dimensions.understanding.score).toBe(50);expect(result.dimensions.communication).toMatchObject({status:'PENDING',score:null});expect(result.performance.score).toBeNull();expect(result.questionnaire[1]).toMatchObject({selected:['A'],correct:['A','B'],outcome:'INCORRECT'});
  const repeated=await Promise.all([store.read(f.student,f.sessionId),createSessionResultsStore(db).read(f.student,f.sessionId)]);expect(repeated).toEqual([result,result]);
  expect((await db.query('SELECT * FROM session_questionnaires WHERE session_id=$1',[f.sessionId])).rows[0]).toEqual(before);
  expect((await db.query('SELECT 1 FROM session_evaluation_records_v2 WHERE session_id=$1',[f.sessionId])).rowCount).toBe(0);
  expect((await db.query('SELECT 1 FROM session_result_releases WHERE session_id=$1',[f.sessionId])).rowCount).toBe(0);
 });
 it('holds keys and scores until an authorized teacher releases this exact composition, idempotently',async()=>{
  const f=await createM9Fixture(db,'TEACHER_REVIEW'),store=createSessionResultsStore(db);await f.submit();
  const held=await store.read(f.student,f.sessionId);expect(held.status).toBe('HELD');for(const key of ['questionnaire','dimensions','score','correct','CLAVE_PRIVADA','EXPLICACION_PRIVADA'])expect(JSON.stringify(held)).not.toContain(key);
  const review=await store.review(f.teacher,f.sessionId);if(!('fingerprint' in review))throw Error('missing review');
  await expect(store.release(f.teacher,f.sessionId,'0'.repeat(64))).rejects.toMatchObject({code:'CONFLICT'});
  await store.release(f.teacher,f.sessionId,review.fingerprint);await store.release(f.teacher,f.sessionId,review.fingerprint);
  expect((await store.read(f.student,f.sessionId)).status).toBe('RELEASED');expect((await db.query('SELECT 1 FROM session_result_releases WHERE session_id=$1',[f.sessionId])).rowCount).toBe(1);
  await expect(db.query('DELETE FROM session_result_releases WHERE session_id=$1',[f.sessionId])).rejects.toThrow();
 });
 it('denies other students, non-owning teachers, role spoofing and direct unauthorized release',async()=>{
  const f=await createM9Fixture(db,'TEACHER_REVIEW'),g=await createM9Fixture(db),store=createSessionResultsStore(db);await f.submit();
  await expect(store.read(g.student,f.sessionId)).rejects.toMatchObject({code:'NOT_FOUND'});await expect(store.review(g.teacher,f.sessionId)).rejects.toMatchObject({code:'NOT_FOUND'});await expect(store.read(f.teacher,f.sessionId)).rejects.toMatchObject({code:'FORBIDDEN'});await expect(store.release(f.student,f.sessionId,'0'.repeat(64))).rejects.toMatchObject({code:'FORBIDDEN'});
  await expect(db.query('INSERT INTO session_result_releases(session_id,fingerprint,case_version_id,released_by,snapshot) VALUES($1,$2,$3,$4,$5)',[f.sessionId,'0'.repeat(64),f.request.candidateVersionId,g.teacher,{}])).rejects.toThrow();
 });
 it('keeps a technical SPFA failure separate from missing communication and the saved questionnaire score',async()=>{
  const f=await createM9Fixture(db,'AFTER_SUBMISSION',true),store=createSessionResultsStore(db);await f.submit();const r=await store.read(f.student,f.sessionId);if(!('dimensions' in r))throw Error('missing results');expect(r.dimensions.protocol).toMatchObject({status:'TECHNICAL_FAILURE',score:null});expect(r.dimensions.communication.status).toBe('PENDING');expect(r.dimensions.understanding.score).toBe(50);expect(r.performance.score).toBeNull();expect(await store.read(f.student,f.sessionId)).toEqual(r);
 });
 it('policies and versioned keys stay fixed across teacher edits',async()=>{
  const f=await createM9Fixture(db),store=createSessionResultsStore(db);await f.submit();const before=await store.read(f.student,f.sessionId);
  await f.drafts.save(f.teacher,f.draft.caseId,f.draft.versionId,{...f.draft.fields,title:'Later M9 draft'});
  expect(await store.read(f.student,f.sessionId)).toEqual(before);
  await expect(db.query('UPDATE case_result_policies SET policy=$2 WHERE case_version_id=$1',[f.request.candidateVersionId,m9Policy('TEACHER_REVIEW')])).rejects.toThrow();
 });
 it('a changed evaluation invalidates release while preserving the earlier released snapshot',async()=>{
  const f=await createM9Fixture(db,'TEACHER_REVIEW','PENDING'),store=createSessionResultsStore(db);await f.submit();const review=await store.review(f.teacher,f.sessionId);
  if(!('fingerprint' in review)||!f.claim||!('attemptId' in f.claim))throw Error('fixture missing');
  await store.release(f.teacher,f.sessionId,review.fingerprint);
  await failSpfaEvaluationAttemptV2({sessionId:f.sessionId,attemptId:f.claim.attemptId,attemptCount:f.claim.attemptCount,snapshotIdentity:f.claim.snapshotIdentity},new Date().toISOString(),'INTERNAL_FAILURE',db);
  expect((await store.read(f.student,f.sessionId)).status).toBe('HELD');await expect(store.release(f.teacher,f.sessionId,review.fingerprint)).rejects.toMatchObject({code:'CONFLICT'});
  const history=(await db.query('SELECT snapshot FROM session_result_releases WHERE session_id=$1',[f.sessionId])).rows;expect(history).toHaveLength(1);expect(history[0].snapshot.dimensions.protocol.status).toBe('PENDING');
 });
});
