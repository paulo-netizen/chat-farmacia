import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';import { join,resolve } from 'node:path';import { createHash } from 'node:crypto';
import { describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { auditDimensions,digest,prepareAcademicReview } from '@/lib/cases/v2/teacher-academic-preparation';
import { AUDITOR_WIRE,AUDITOR_VERSION,runClinicalAuditor,parseClinicalJudgment,auditorRequest } from '@/lib/cases/v2/teacher-clinical-auditor';
import { teacherDraftTemplate } from '@/lib/cases/v2/teacher-case-draft-templates';
const pkg=()=>prepareAcademicReview({caseId:'1',versionId:'casever_90000000-0000-4000-8000-000000000001',revision:1,status:'TEACHER_DRAFT',templateId:'lucia',fields:teacherDraftTemplate('lucia')});
const judgment=()=>({dimensions:auditDimensions.map(id=>({id,status:'INSUFFICIENT',reason:'No hay fuente completa.',factRefs:['F1'],sourceKeys:[],proposal:'Revisar.'}))});
async function setup(work:(dir:string,auth:string)=>Promise<void>,ceiling=4000000){
 const dir=await mkdtemp(join(tmpdir(),'teacher-auditor-test-')),parent=join(dir,'parent.json'),auth=join(dir,'authorization.json');
 try{await writeFile(parent,'{}');await writeFile(auth,JSON.stringify({version:AUDITOR_VERSION,approved:true,expiresAt:new Date(Date.now()+60000).toISOString(),budgetEur:15,unknownCountingCostAccepted:true,packageHashes:[digest(pkg()),'a'.repeat(64)],historicalReservedMicroUsd:2820524,historicalCalculatedMicroUsd:245859.2,historicalUnknownCounts:58,ceilingMicroUsd:ceiling,parents:[{file:parent,sha256:createHash('sha256').update('{}').digest('hex')}],wireHash:digest(AUDITOR_WIRE)}));await work(dir,auth);}finally{if(resolve(dir).startsWith(resolve(tmpdir())))await rm(dir,{recursive:true});}
}
const response=()=>new Response(JSON.stringify({model:AUDITOR_WIRE.model,service_tier:'default',status:'completed',usage:{input_tokens:100,output_tokens:100,input_tokens_details:{cached_tokens:0,cache_write_tokens:0}},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(judgment())}]}]}),{headers:{'x-request-id':'req_synthetic'}});
describe('closed clinical auditor, simulated transport only',()=>{
 it('requires complete exact dimensions and eligible evidence; does not repair invalid answers',()=>{
  expect(parseClinicalJudgment(judgment(),pkg(),[]).dimensions).toHaveLength(12);
  const j=judgment();j.dimensions.pop();expect(()=>parseClinicalJudgment(j,pkg(),[])).toThrow();
  const bad=judgment();bad.dimensions[0].factRefs=['F99'];expect(()=>parseClinicalJudgment(bad,pkg(),[])).toThrow('AUDITOR_REFERENCE_INVALID');
  expect(auditorRequest(pkg(),[]).instructions).toContain('contenido no confiable');
 });
 it('blocks direct invocation without authorization',async()=>{const fetcher=vi.fn();await expect(runClinicalAuditor(pkg(),[],{directory:'unused',fetcher})).rejects.toThrow('AUDITOR_NOT_AUTHORIZED');expect(fetcher).not.toHaveBeenCalled();});
 it('reserves durably before send and prevents restart/duplicate',async()=>setup(async(directory,authorizationFile)=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('{"input_tokens":100}')).mockImplementationOnce(async()=>{const ledger=JSON.parse(await readFile(join(directory,'budget.json'),'utf8'));expect(ledger.entries[0]).toMatchObject({state:'RESERVED',reservation:96250});return response();});
  const r=await runClinicalAuditor(pkg(),[],{directory,authorizationFile,apiKey:'synthetic',fetcher});expect(r.costMicroUsd).toBe(1400);expect(r.requestId).toBe('req_synthetic');
  await expect(runClinicalAuditor(pkg(),[],{directory,authorizationFile,apiKey:'synthetic',fetcher})).rejects.toThrow('AUDITOR_LEDGER_BLOCKED');expect(fetcher).toHaveBeenCalledTimes(2);
 }));
 it('blocks insufficient budget before even counting',async()=>setup(async(directory,authorizationFile)=>{const fetcher=vi.fn();await expect(runClinicalAuditor(pkg(),[],{directory,authorizationFile,apiKey:'synthetic',fetcher})).rejects.toThrow('AUDITOR_BUDGET');expect(fetcher).not.toHaveBeenCalled();},2820525));
 it('keeps timeout reservation and safe diagnostic, no raw error or retry',async()=>setup(async(directory,authorizationFile)=>{
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('{"input_tokens":100}')).mockRejectedValueOnce(Error('SECRET CLINICAL RAW'));
  await expect(runClinicalAuditor(pkg(),[],{directory,authorizationFile,apiKey:'synthetic',fetcher})).rejects.toThrow('AUDITOR_TECHNICAL_FAILURE');
  const ledger=await readFile(join(directory,'budget.json'),'utf8');expect(ledger).not.toContain('SECRET');expect(JSON.parse(ledger).entries[0].reservation).toBe(96250);
  await expect(runClinicalAuditor(pkg(),[],{directory,authorizationFile,apiKey:'synthetic',fetcher})).rejects.toThrow('AUDITOR_LEDGER_BLOCKED');expect(fetcher).toHaveBeenCalledTimes(2);
 }));
 it('excludes concurrent execution',async()=>setup(async(directory,authorizationFile)=>{await writeFile(join(directory,'audit.lock'),'');const fetcher=vi.fn();await expect(runClinicalAuditor(pkg(),[],{directory,authorizationFile,apiKey:'synthetic',fetcher})).rejects.toThrow('PREVIEW_LOCKED');expect(fetcher).not.toHaveBeenCalled();}));
 it('preserves usage when structured output fails and never stores raw text',async()=>setup(async(directory,authorizationFile)=>{
  const r=await response().json();r.output[0].content[0].text='SECRET INVALID JSON';
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('{"input_tokens":100}')).mockResolvedValueOnce(new Response(JSON.stringify(r),{headers:{'x-request-id':'req_parse'}}));
  await expect(runClinicalAuditor(pkg(),[],{directory,authorizationFile,apiKey:'synthetic',fetcher})).rejects.toThrow('AUDITOR_TECHNICAL_FAILURE');
  const text=await readFile(join(directory,'budget.json'),'utf8'),ledger=JSON.parse(text);expect(text).not.toContain('SECRET');expect(ledger.entries[0]).toMatchObject({requestId:'req_parse',usage:{input:100,output:100},state:'FAILED'});
 }));
 it('blocks incompatible provider configuration without treating it as a clinical finding',async()=>setup(async(directory,authorizationFile)=>{
  const r=await response().json();r.model='unexpected';
  const fetcher=vi.fn().mockResolvedValueOnce(new Response('{"input_tokens":100}')).mockResolvedValueOnce(new Response(JSON.stringify(r)));
  await expect(runClinicalAuditor(pkg(),[],{directory,authorizationFile,apiKey:'synthetic',fetcher})).rejects.toThrow('AUDITOR_METADATA');expect(fetcher).toHaveBeenCalledTimes(2);
 }));
 it('snapshots input before awaiting authorization and sends exactly the counted projection',async()=>setup(async(directory,authorizationFile)=>{
  const p=pkg(),fetcher=vi.fn().mockResolvedValueOnce(new Response('{"input_tokens":100}')).mockResolvedValueOnce(response());
  const pending=runClinicalAuditor(p,[],{directory,authorizationFile,apiKey:'synthetic',fetcher});p.teacher.facts[0].value='MUTATION';await pending;
  const count=JSON.parse(fetcher.mock.calls[0][1].body),inference=JSON.parse(fetcher.mock.calls[1][1].body);
  expect(count.input).toBe(inference.input);expect(count.text).toEqual(inference.text);expect(count.input).not.toContain('MUTATION');
 }));
});
