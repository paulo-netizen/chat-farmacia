// Local demonstration only. No DATABASE_URL fallback, no migrations, no application database.
const {Pool}=require('pg');
const {spawn}=require('node:child_process');
(async()=>{
 const live=process.argv.includes('--patient-preview');
 const audit=process.argv.includes('--clinical-audit');
 if(live||audit){
  require('@next/env').loadEnvConfig(process.cwd(),false,{info(){},error(){}});
  if(!process.env.OPENAI_API_KEY||(live&&!process.env.TEACHER_PREVIEW_LIVE_AUTH)||(audit&&!process.env.TEACHER_AUDIT_AUTH))throw Error('Missing private authorization');
 }
 const db=new Pool({host:'127.0.0.1',port:55451,user:'postgres',database:'chatusal_editor_disposable',ssl:false});
 try{
  const r=await db.query("SELECT current_database() db,shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()");
  if(r.rows[0]?.db!=='chatusal_editor_disposable'||r.rows[0]?.marker!=='teacher-editor-20261012-disposable') throw Error('Disposable database identity mismatch');
  const format=await db.query("SELECT 1 FROM pg_constraint WHERE conname='teacher_draft_never_publish'");
  if(!format.rowCount) throw Error('Run disposable migration tests first');
  // Synthetic local login only; never copies application credentials or data.
  await db.query("INSERT INTO users(email,password_hash,name,role) VALUES ('editor@example.test',crypt('EditorDemoOnly2026!',gen_salt('bf')),'Docente de prueba','teacher'),('student@example.test',crypt('StudentDemoOnly2026!',gen_salt('bf')),'Estudiante de prueba','student') ON CONFLICT(email) DO NOTHING");
 }finally{await db.end();}
 const url='postgresql://postgres@127.0.0.1:55451/chatusal_editor_disposable?sslmode=disable';
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','-H','127.0.0.1','-p','3105'],{stdio:'inherit',env:{...process.env,SUPABASE_DB_URL:url,DATABASE_URL:url,APP_SECRET:'local-disposable-editor-demonstration-only-2026',OPENAI_API_KEY:live||audit?process.env.OPENAI_API_KEY:'',TEACHER_PREVIEW_LIVE_AUTH:live?process.env.TEACHER_PREVIEW_LIVE_AUTH:'',TEACHER_AUDIT_AUTH:audit?process.env.TEACHER_AUDIT_AUTH:'',NEXT_TELEMETRY_DISABLED:'1'}});
 child.on('exit',code=>process.exit(code??1));
})().catch(()=>{console.error('Disposable editor demo could not start. Verify its isolated database and migrations.');process.exitCode=1;});
