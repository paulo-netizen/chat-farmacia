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
   const body=JSON.stringify({expectedVersionId:d.versionId});
   assert.equal((await fetch(base+'/api/teacher-drafts/'+d.caseId+'/test',{method:'POST',headers:{cookie:student,'Content-Type':'application/json',origin:base},body})).status,403);
   const created=await fetch(base+'/api/teacher-drafts/'+d.caseId+'/test',{method:'POST',headers:{cookie:teacher,'Content-Type':'application/json',origin:base},body});assert.equal(created.status,200);
   const view=await created.json();assert.equal(view.mode,'TEACHER_PREVIEW');assert.deepEqual(view.messages,[]);assert.deepEqual(Object.keys(view.identity).sort(),['edad','nombre','sexo']);assert.equal(view.projection,undefined);
   for(const method of ['GET','POST','DELETE'])assert.equal((await fetch(base+'/api/teacher-previews/'+view.id,{method,headers:{cookie:student,origin:base}})).status,403);
   const closed=await fetch(base+'/api/teacher-previews/'+view.id,{method:'DELETE',headers:{cookie:teacher,origin:base}});assert.equal(closed.status,200);assert.equal((await closed.json()).status,'CLOSED');
  }
  // Other isolated selection tests may deliberately create synthetic sessions.
  // Preview must not create academic data for either saved demonstration case.
  const cases=list.drafts.map(d=>d.caseId);
  for(const table of ['sessions','case_assignments'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} WHERE case_id=ANY($1::bigint[])`,[cases])).rows[0].n,0);
  for(const table of ['messages','evaluations'])assert.equal((await db.query(`SELECT count(*)::int n FROM ${table} r JOIN sessions s ON s.id=r.session_id WHERE s.case_id=ANY($1::bigint[])`,[cases])).rows[0].n,0);
  console.log('PASS: both saved drafts; authenticated HTTP projection; student/anonymous denied; zero academic sessions/messages/evaluations/assignments.');
 }finally{await db.end();}
})().catch(()=>{console.error('Disposable HTTP verification failed; no sensitive response recorded.');process.exitCode=1;});
