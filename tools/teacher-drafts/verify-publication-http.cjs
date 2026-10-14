// Deliberately creates ONE synthetic student session in the verified disposable DB.
// This is selection testing, never a side effect of teacher preview/publication.
const {Pool}=require('pg'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
(async()=>{
 const db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable',ssl:false});
 try{
  assert.deepEqual((await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows,[{db:'chatusal_editor_disposable',marker:'teacher-editor-20261012-disposable'}]);
  const target=(await db.query(`SELECT v.id,v.case_id FROM case_versions v JOIN cases c ON c.id=v.case_id JOIN users u ON u.id=c.created_by
   WHERE u.email='publication@example.test' AND v.status='PUBLISHED'`)).rows;assert.equal(target.length,1);
  const email=`publication-selection-${randomUUID()}@example.test`,password='SelectionDemoOnly2026!';
  const user=(await db.query("INSERT INTO users(email,password_hash,name,role) VALUES ($1,crypt($2,gen_salt('bf')),'Synthetic selection','student') RETURNING id",[email,password])).rows[0];
  // The existing selector excludes cases previously assigned to THIS new synthetic user.
  await db.query(`INSERT INTO case_assignments(student_id,case_id,completed_at) SELECT $1,case_id,now() FROM case_versions WHERE status='PUBLISHED' AND case_id<>$2`,[user.id,target[0].case_id]);
  const base='http://127.0.0.1:3105';
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  for(const method of ['GET','POST'])assert.equal((await fetch(base+`/api/teacher-drafts/${target[0].case_id}/review`,{method,headers:{cookie,origin:base}})).status,403);
  const res=await fetch(base+'/api/sessions',{method:'POST',headers:{cookie}});assert.equal(res.status,200);
  const dto=await res.json();assert.deepEqual(Object.keys(dto).sort(),['edad','nombre','sessionId','sexo']);
  const session=(await db.query('SELECT case_version_id,case_id FROM sessions WHERE id=$1 AND user_id=$2',[dto.sessionId,user.id])).rows[0];
  assert.equal(session.case_version_id,target[0].id);assert.equal(String(session.case_id),String(target[0].case_id));
  const again=await (await fetch(base+'/api/sessions',{method:'POST',headers:{cookie}})).json();assert.equal(again.sessionId,dto.sessionId);
  assert.equal((await db.query('SELECT count(*)::int n FROM messages WHERE session_id=$1',[dto.sessionId])).rows[0].n,0);
  assert.equal((await db.query('SELECT count(*)::int n FROM evaluations WHERE session_id=$1',[dto.sessionId])).rows[0].n,0);
  const actual=(await db.query(`SELECT v.status FROM case_versions v JOIN cases c ON c.id=v.case_id JOIN users u ON u.id=c.created_by WHERE u.email='editor@example.test'`)).rows;
  assert.ok(actual.length>=2&&actual.every(x=>x.status==='TEACHER_DRAFT'));
  console.log(JSON.stringify({publishedVersion:target[0].id,selectedExactVersion:true,publicFields:Object.keys(dto),academicSession:'ONE_SYNTHETIC_SELECTION_TEST_ONLY',liveCalls:0,luciaMaria:'DRAFT_UNCHANGED'}));
 }finally{await db.end();}
})().catch(()=>{console.error('Disposable publication HTTP verification failed; no sensitive payload recorded.');process.exitCode=1;});
