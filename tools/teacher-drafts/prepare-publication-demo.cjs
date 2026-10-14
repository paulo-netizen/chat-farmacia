// Explicit synthetic fixture, disposable DB only. No provider calls or real clinical approval.
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),{randomUUID}=require('node:crypto'),{Pool}=require('pg');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const load=Module._load;Module._load=function(id,...args){if(id==='server-only')return {};return load.call(this,id,...args);};
const {createTeacherDraftStore}=require('../../lib/cases/v2/teacher-case-draft-store.ts');
const {publicationFixture,publicationDraftFields}=require('../../tests/unit/support/teacher-publication-fixture.ts');
(async()=>{
 const db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable',ssl:false});
 try{
  const r=await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()");
  if(r.rows[0]?.db!=='chatusal_editor_disposable'||r.rows[0]?.marker!=='teacher-editor-20261012-disposable')throw Error('DISPOSABLE_REQUIRED');
  const u=(await db.query("INSERT INTO users(email,password_hash,name,role) VALUES ('publication@example.test',crypt('PublicationDemoOnly2026!',gen_salt('bf')),'Publicación sintética','teacher') ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id")).rows[0];
  const actor=String(u.id),store=createTeacherDraftStore(db),base=await store.openTemplate(actor,'lucia');
  const existing=(await db.query('SELECT candidate_version_id FROM teacher_publication_candidates WHERE case_id=$1',[base.caseId])).rows;
  if(existing.length){console.log('Synthetic publication fixture already exists; preserved without reset.');return;}
  const draft=await store.save(actor,base.caseId,base.versionId,publicationDraftFields()),id=`casever_${randomUUID()}`;
  const c=await db.connect();
  try{
   await c.query('BEGIN');await c.query('SELECT id FROM cases WHERE id=$1 FOR UPDATE',[draft.caseId]);
   await c.query(`INSERT INTO case_versions(id,case_id,version_number,parent_version_id,status,source_kind,content_format,content,created_by)
    VALUES ($1,$2,$3,$4,'AI_DRAFT','AI_GENERATED','GENERATED_CASE_BUNDLE_V2',$5,$6)`,[id,draft.caseId,draft.revision+1,draft.versionId,publicationFixture(id),actor]);
   await c.query(`INSERT INTO teacher_publication_candidates(candidate_version_id,draft_version_id,case_id,audit_status,audit_kind,audit_reference,created_by)
    VALUES ($1,$2,$3,'PASS','SYNTHETIC_TEST','simulated-publication-fixture/1-NOT-CLINICAL',$4)`,[id,draft.versionId,draft.caseId,actor]);
   await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  console.log(JSON.stringify({caseId:draft.caseId,candidateVersionId:id,status:'AI_DRAFT',audit:'SIMULATED_TEST_ONLY',luciaMaria:'UNCHANGED'}));
 }finally{await db.end();}
})().catch(()=>{console.error('Synthetic publication preparation blocked. No production fallback.');process.exitCode=1;});
