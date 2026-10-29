import {readFileSync} from 'node:fs';
import {Pool} from 'pg';
import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createM9Fixture} from '../unit/support/m9-fixture';
import {createSessionResultsStore} from '@/lib/cases/v2/session-results-store';
import {listTeacherSessions} from '@/lib/cases/v2/teacher-session-list';
import {failSpfaEvaluationAttemptV2} from '@/lib/cases/v2/spfa-evaluation-persistence-runtime';
let db:Pool;
const request=(r:any,changes:Record<string,unknown>={})=>({expectedFingerprint:r.fingerprint,expectedRevision:r.humanRevision,action:'ACCEPT',dimension:'understanding',criterion:null,score:null,correction:'',reason:'Revisión sintética de prueba, sin aprobación académica.',...changes});
describe.skipIf(process.env.RUN_TEACHER_DRAFT_POSTGRES!=='1')('teacher review on verified disposable PostgreSQL',()=>{
 beforeAll(async()=>{db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable'});expect((await db.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe('teacher-editor-20261012-disposable');if(!(await db.query("SELECT to_regclass('session_result_reviews') t")).rows[0].t)await db.query(readFileSync('db/migrations/0014_v2_teacher_result_reviews.sql','utf8'));});
 afterAll(async()=>db?.end());
 it('lists only owned academic sessions, filters and denies other roles',async()=>{const f=await createM9Fixture(db),other=await createM9Fixture(db);await f.submit();const rows=await listTeacherSessions(db,f.teacher,{});expect(rows.map(r=>r.id)).toEqual([f.sessionId]);expect(rows.some(r=>r.id===other.sessionId)).toBe(false);expect(await listTeacherSessions(db,f.teacher,{student:'no-match',case:'',review:'ALL'})).toEqual([]);await expect(listTeacherSessions(db,f.student,{})).rejects.toMatchObject({code:'FORBIDDEN'});});
 it('accepts, corrects and releases exact revisions without modifying the automatic receipt',async()=>{const f=await createM9Fixture(db,'TEACHER_REVIEW');await f.submit();const store=createSessionResultsStore(db),original=(await db.query('SELECT grade FROM session_questionnaires WHERE session_id=$1',[f.sessionId])).rows[0];const first=await store.review(f.teacher,f.sessionId);expect(first.teacherDetails.transcript).toHaveLength(3);await store.recordReview(f.teacher,f.sessionId,request(first));const accepted:any=await store.review(f.teacher,f.sessionId);await store.release(f.teacher,f.sessionId,accepted.fingerprint);
  await store.recordReview(f.teacher,f.sessionId,request(accepted,{action:'CORRECT',criterion:'Q2',correction:'Corrección humana de prueba de la respuesta parcial.',score:75,reason:'Se documenta 75 sintético; no se cambia la clave ni la política.'}));
  expect((await store.read(f.student,f.sessionId)).status).toBe('HELD');await expect(store.release(f.teacher,f.sessionId,accepted.fingerprint)).rejects.toMatchObject({code:'CONFLICT'});
  const revised:any=await store.review(f.teacher,f.sessionId);expect(revised.dimensions.understanding.score).toBe(75);expect(revised.automaticDimensions.understanding.score).toBe(50);expect(revised.humanReviews).toHaveLength(2);await store.release(f.teacher,f.sessionId,revised.fingerprint);
  const result:any=await store.read(f.student,f.sessionId);expect(result.status).toBe('RELEASED');expect(result.teacherDetails).toBeUndefined();expect(await store.read(f.student,f.sessionId)).toEqual(result);expect((await db.query('SELECT grade FROM session_questionnaires WHERE session_id=$1',[f.sessionId])).rows[0]).toEqual(original);
  expect((await db.query('SELECT 1 FROM session_result_releases WHERE session_id=$1',[f.sessionId])).rowCount).toBe(2);await expect(db.query('DELETE FROM session_result_reviews WHERE session_id=$1',[f.sessionId])).rejects.toThrow();
 });
 it('requires new release after a correction even with AFTER_SUBMISSION',async()=>{const f=await createM9Fixture(db);await f.submit();const store=createSessionResultsStore(db),r=await store.review(f.teacher,f.sessionId);await store.recordReview(f.teacher,f.sessionId,request(r,{action:'CORRECT',score:60}));expect((await store.read(f.student,f.sessionId)).status).toBe('HELD');const revised:any=await store.review(f.teacher,f.sessionId);await store.release(f.teacher,f.sessionId,revised.fingerprint);expect((await store.read(f.student,f.sessionId)).status).toBe('RELEASED');});
 it('rejects stale concurrent writes and retains only one next revision',async()=>{const f=await createM9Fixture(db);await f.submit();const store=createSessionResultsStore(db),r=await store.review(f.teacher,f.sessionId);const results=await Promise.allSettled([store.recordReview(f.teacher,f.sessionId,request(r)),store.recordReview(f.teacher,f.sessionId,request(r))]);expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);expect((await db.query('SELECT 1 FROM session_result_reviews WHERE session_id=$1',[f.sessionId])).rowCount).toBe(1);});
 it('keeps technical failure unscored and denies foreign teacher or student corrections',async()=>{const f=await createM9Fixture(db,'TEACHER_REVIEW',true),g=await createM9Fixture(db);await f.submit();const store=createSessionResultsStore(db),r=await store.review(f.teacher,f.sessionId);await expect(store.recordReview(f.teacher,f.sessionId,request(r,{action:'CORRECT',dimension:'protocol',score:0}))).rejects.toMatchObject({code:'INVALID'});await expect(store.recordReview(g.teacher,f.sessionId,request(r))).rejects.toMatchObject({code:'NOT_FOUND'});await expect(store.recordReview(f.student,f.sessionId,request(r))).rejects.toMatchObject({code:'FORBIDDEN'});await store.recordReview(f.teacher,f.sessionId,request(r,{action:'COMMENT',dimension:'protocol',reason:'Fallo técnico conservado para investigar; sin calificación.'}));const after:any=await store.review(f.teacher,f.sessionId);expect(after.dimensions.protocol).toMatchObject({status:'TECHNICAL_FAILURE',score:null});});
 it('keeps reviews historical when their automatic composition changes',async()=>{
  const f=await createM9Fixture(db,'TEACHER_REVIEW','PENDING');await f.submit();const store=createSessionResultsStore(db);
  const initial=await store.review(f.teacher,f.sessionId);await store.recordReview(f.teacher,f.sessionId,request(initial,{action:'CORRECT',score:75}));
  const reviewed:any=await store.review(f.teacher,f.sessionId);await store.release(f.teacher,f.sessionId,reviewed.fingerprint);
  if(!f.claim||!('attemptId' in f.claim))throw Error('Missing synthetic claim');
  await failSpfaEvaluationAttemptV2({sessionId:f.sessionId,attemptId:f.claim.attemptId,attemptCount:f.claim.attemptCount,snapshotIdentity:f.claim.snapshotIdentity},new Date().toISOString(),'INTERNAL_FAILURE',db);
  const changed:any=await store.review(f.teacher,f.sessionId);
  expect(changed.humanReviews).toHaveLength(0);expect(changed.teacherDetails.history).toHaveLength(1);
  expect(changed.dimensions.understanding.score).toBe(50);expect(changed.humanRevision).toBe(1);
  expect((await store.read(f.student,f.sessionId)).status).toBe('HELD');
 });
 it.skipIf(process.env.RUN_TEACHER_REVIEW_DEMO!=='1')('prepares three persistent synthetic sessions for browser demonstration',async()=>{
  if((await db.query("SELECT 1 FROM users WHERE email='review-teacher@example.test'")).rowCount)throw Error('Demo exists; preserve it');
  const a=await createM9Fixture(db,'TEACHER_REVIEW'),b=await createM9Fixture(db,'TEACHER_REVIEW'),c=await createM9Fixture(db,'TEACHER_REVIEW',true);for(const f of [a,b,c])await f.submit();
  // Common ownership for the isolated demonstration only; no development drafts touched.
  for(const f of [b,c])await db.query('UPDATE cases SET created_by=$1 WHERE id=$2',[a.teacher,f.draft.caseId]);
  await db.query("UPDATE users SET email='review-teacher@example.test',password_hash=crypt('ReviewDemoOnly2026!',gen_salt('bf')) WHERE id=$1",[a.teacher]);
  await db.query("UPDATE users SET email='review-student@example.test',password_hash=crypt('ReviewDemoOnly2026!',gen_salt('bf')) WHERE id=$1",[b.student]);
  console.log('Teacher review demo:',{accepted:a.sessionId,corrected:b.sessionId,technical:c.sessionId});
 });
});
