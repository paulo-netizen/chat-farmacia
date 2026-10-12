// Backend HTTP checks, exclusively against the local disposable demonstration.
const {Pool}=require('pg');const assert=require('node:assert/strict');
(async()=>{
 const db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable',ssl:false});
 try{
  const r=await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()");
  assert.deepEqual(r.rows,[{db:'chatusal_editor_disposable',marker:'teacher-editor-20261012-disposable'}]);
  const base='http://127.0.0.1:3105';
  async function login(email,password){const r=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
  const teacher=await login('editor@example.test','EditorDemoOnly2026!');
  const student=await login('student@example.test','StudentDemoOnly2026!');
  assert.equal((await fetch(base+'/api/teacher-drafts')).status,401);
  assert.equal((await fetch(base+'/api/teacher-drafts',{headers:{cookie:student}})).status,403);
  const list=await (await fetch(base+'/api/teacher-drafts',{headers:{cookie:teacher}})).json();assert.equal(list.drafts.length,2);
  for(const d of list.drafts){
   for(const suffix of ['', '/preview']) assert.equal((await fetch(base+'/api/teacher-drafts/'+d.caseId+suffix,{headers:{cookie:student}})).status,403);
   const p=await fetch(base+'/api/teacher-drafts/'+d.caseId+'/preview',{headers:{cookie:teacher}});assert.equal(p.status,200);assert.equal(p.headers.get('cache-control'),'private, no-store');
   assert.deepEqual(Object.keys(await p.json()).sort(),['edad','nombre','sexo']);
   const row=(await db.query('SELECT status,content_format FROM case_versions WHERE id=$1',[d.versionId])).rows[0];assert.equal(row.status,'TEACHER_DRAFT');assert.equal(row.content_format,'TEACHER_CASE_DRAFT_V1');
  }
  for(const table of ['sessions','messages','evaluations','case_assignments']) assert.equal((await db.query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n,0);
  console.log('PASS: both saved drafts; authenticated HTTP projection; student/anonymous denied; zero academic sessions/messages/evaluations/assignments.');
 }finally{await db.end();}
})().catch(()=>{console.error('Disposable HTTP verification failed; no sensitive response recorded.');process.exitCode=1;});
