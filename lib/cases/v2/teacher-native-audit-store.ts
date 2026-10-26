import 'server-only';
import type {Pool,PoolClient} from 'pg';
import {z} from 'zod';
import {TeacherDraftError} from './teacher-case-draft-store';
import {caseVersionIdSchema} from './teacher-case-draft';
import {readCimaSource,digest,type SourceEvidence} from './teacher-academic-preparation';
import {type runClinicalAuditor} from './teacher-clinical-auditor';
import {nativeAuditInput,nativeAuditBinding,nativeAuditSources,nativeAuditStatus,validateNativeAuditResult,ordered} from './teacher-native-audit';
export const nativeAuditRequestSchema=z.object({action:z.enum(['prepare','run']),expectedDraftVersionId:caseVersionIdSchema,candidateVersionId:caseVersionIdSchema,sourceKeys:z.array(z.enum(['metformin850','enalapril20'])).min(1).max(2).optional()}).strict();
const contentHashSql="encode(digest(v.content::text,'sha256'),'hex')";
export async function readNativeAudit(c:PoolClient,row:any){
 if(row?.content_format!=='TEACHER_CASE_BUNDLE_V1')return null;
 const audit=(await c.query(`SELECT b.*,cl.created_at claimed_at,r.result,r.error_code FROM teacher_native_audit_bindings b LEFT JOIN teacher_native_audit_claims cl USING(candidate_version_id) LEFT JOIN teacher_native_audit_results r USING(candidate_version_id) WHERE b.candidate_version_id=$1`,[row.id])).rows[0];
 if(!audit)return null;
 const input=nativeAuditInput(row.content,row.id,audit.content_hash),sources=nativeAuditSources(audit.sources),binding=nativeAuditBinding(input,sources);
 const storedHash=(await c.query(`SELECT ${contentHashSql} h FROM case_versions v WHERE v.id=$1`,[row.id])).rows[0].h;
 const current=storedHash===audit.content_hash&&digest(ordered(audit.configuration))===binding.configurationHash&&audit.configuration_hash===binding.configurationHash&&audit.sources_hash===binding.sourcesHash&&audit.request_hash===binding.requestHash;
 const result=audit.result&&current?validateNativeAuditResult(audit.result,input,sources):null;
 return {...audit,current,result,status:current?nativeAuditStatus(result,sources):'PENDING',execution:audit.error_code?'FAILED':audit.result?'COMPLETED':audit.claimed_at?'CLAIMED':'PREPARED'};
}
export function createTeacherNativeAuditStore(db:Pick<Pool,'connect'>,run:typeof runClinicalAuditor,sourceReader=readCimaSource){
 async function tx<T>(actor:string,caseId:string,work:(c:PoolClient)=>Promise<T>){
  if(!/^[1-9][0-9]{0,15}$/.test(actor)||!/^[1-9][0-9]{0,15}$/.test(caseId))throw new TeacherDraftError('FORBIDDEN',403);
  const c=await db.connect();try{await c.query('BEGIN');const role=(await c.query('SELECT role FROM users WHERE id=$1 FOR SHARE',[actor])).rows[0]?.role;
   if(!['teacher','admin'].includes(role))throw new TeacherDraftError('FORBIDDEN',403);
   if(!(await c.query('SELECT id FROM cases WHERE id=$1 AND (created_by=$2 OR $3) FOR UPDATE',[caseId,actor,role==='admin'])).rowCount)throw new TeacherDraftError('NOT_FOUND',404);
   const result=await work(c);await c.query('COMMIT');return result;
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 }
 async function candidate(c:PoolClient,caseId:string,request:z.infer<typeof nativeAuditRequestSchema>){
  const row=(await c.query(`SELECT v.*,${contentHashSql} content_hash FROM case_versions v JOIN teacher_publication_candidates p ON p.candidate_version_id=v.id WHERE v.id=$1 AND v.case_id=$2 AND p.draft_version_id=$3 AND v.content_format='TEACHER_CASE_BUNDLE_V1'`,[request.candidateVersionId,caseId,request.expectedDraftVersionId])).rows[0];
  const latest=(await c.query("SELECT id FROM case_versions WHERE case_id=$1 AND content_format='TEACHER_CASE_DRAFT_V1' ORDER BY version_number DESC LIMIT 1",[caseId])).rows[0]?.id;
  if(!row||latest!==request.expectedDraftVersionId||!['TEACHER_DRAFT','IN_REVIEW'].includes(row.status))throw new TeacherDraftError('CONFLICT',409);
  return row;
 }
 return {act:async(actor:string,caseId:string,value:unknown)=>{
  const request=nativeAuditRequestSchema.parse(value);
  if(request.sourceKeys&&new Set(request.sourceKeys).size!==request.sourceKeys.length)throw new TeacherDraftError('INVALID',400);
  const row=await tx(actor,caseId,c=>candidate(c,caseId,request));
  if(request.action==='prepare'){
   if(!request.sourceKeys)throw new TeacherDraftError('INVALID',400);
   // No DB locks while reading sources. Binding stores evidence, never a second case package.
   const sources:SourceEvidence[]=[];for(const key of request.sourceKeys)sources.push(await sourceReader(key));
   const binding=nativeAuditBinding(nativeAuditInput(row.content,row.id,row.content_hash),sources);
   return tx(actor,caseId,async c=>{
    const current=await candidate(c,caseId,request);if(current.content_hash!==row.content_hash)throw new TeacherDraftError('CONFLICT',409);
    const prior=await readNativeAudit(c,current);if(prior)throw new TeacherDraftError('CONFLICT',409);
    await c.query('INSERT INTO teacher_native_audit_bindings(candidate_version_id,draft_version_id,content_hash,sources,sources_hash,configuration,configuration_hash,request_hash,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',[row.id,request.expectedDraftVersionId,row.content_hash,JSON.stringify(binding.sources),binding.sourcesHash,binding.configuration,binding.configurationHash,binding.requestHash,actor]);
    return readNativeAudit(c,current);
   });
  }
  if(request.sourceKeys)throw new TeacherDraftError('INVALID',400);
  const prepared=await tx(actor,caseId,async c=>{
   const current=await candidate(c,caseId,request),audit=await readNativeAudit(c,current);
   if(!audit||!audit.current||audit.claimed_at)throw new TeacherDraftError('CONFLICT',409);
   await c.query('INSERT INTO teacher_native_audit_claims(candidate_version_id,created_by) VALUES ($1,$2)',[row.id,actor]);
   return {input:nativeAuditInput(current.content,row.id,audit.content_hash),sources:nativeAuditSources(audit.sources)};
  });
  // Confirmed durable claim, no locks/transaction retained during provider work.
  let result:ReturnType<typeof validateNativeAuditResult>|null=null,errorCode:string|null=null;
  try{result=validateNativeAuditResult(await run(prepared.input,prepared.sources,{directory:process.env.TEACHER_AUDIT_DIRECTORY??'.env.teacher-academic-audit.local',authorizationFile:process.env.TEACHER_AUDIT_AUTH,apiKey:process.env.OPENAI_API_KEY}),prepared.input,prepared.sources);}catch{errorCode='NATIVE_AUDIT_FAILED';}
  // Retain results for an immutable historical candidate even if edited meanwhile.
  // A failed completion never releases the claim or repeats provider work.
  await tx(actor,caseId,async c=>{await c.query('INSERT INTO teacher_native_audit_results(candidate_version_id,result,error_code,created_by) VALUES ($1,$2,$3,$4)',[row.id,result,errorCode,actor]);});
  return {execution:errorCode?'FAILED':'COMPLETED',status:nativeAuditStatus(result,prepared.sources)};
 }};
}
