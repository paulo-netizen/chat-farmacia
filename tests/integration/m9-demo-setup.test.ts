import {Pool} from 'pg';
import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createM8Fixture} from '../unit/support/m8-postgres-fixture';
import {createM9Fixture,m9Policy} from '../unit/support/m9-fixture';
it.skipIf(process.env.RUN_M9_DEMO_SETUP!=='1')('prepares separate synthetic M9 browser scenarios without changing development drafts',async()=>{
 const db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable'});
 try{
  expect((await db.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe('teacher-editor-20261012-disposable');
  if((await db.query("SELECT 1 FROM users WHERE email='m9-student@example.test'")).rowCount)throw Error('Demo exists; preserve it');
  const f=await createM8Fixture(db),g=await createM9Fixture(db,'TEACHER_REVIEW',true);await g.submit();
  await db.query('INSERT INTO case_result_policies(case_version_id,policy,created_by) VALUES($1,$2,$3)',[f.request.candidateVersionId,m9Policy('AFTER_SUBMISSION'),f.teacher]);
  for(const [id,email] of [[f.student,'m9-student@example.test'],[g.student,'m9-held@example.test'],[g.teacher,'m9-teacher@example.test']])await db.query("UPDATE users SET email=$2,password_hash=crypt('M9DemoOnly2026!',gen_salt('bf')) WHERE id=$1",[id,email]);
  console.log('M9 synthetic sessions:',{afterSubmission:f.sessionId,teacherReview:g.sessionId});
 }finally{await db.end();}
});
