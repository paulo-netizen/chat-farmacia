import {Pool} from 'pg';
import {it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createM8Fixture} from '../unit/support/m8-postgres-fixture';
it.skipIf(process.env.RUN_M8_DEMO_SETUP!=='1')('prepares an explicitly synthetic M8 browser demonstration',async()=>{
 const db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable'});
 try{
  expect((await db.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker).toBe('teacher-editor-20261012-disposable');
  if((await db.query("SELECT 1 FROM users WHERE email='m8-student@example.test'")).rowCount)throw Error('Demo exists; preserve it');
  const f=await createM8Fixture(db);
  await db.query("UPDATE users SET email='m8-student@example.test',password_hash=crypt('M8DemoOnly2026!',gen_salt('bf')) WHERE id=$1",[f.student]);
  console.log('M8 synthetic session:',f.sessionId);
 }finally{await db.end();}
});
