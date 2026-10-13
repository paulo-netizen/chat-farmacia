import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { durableJson, previewHash, readJson, withPreviewLock } from './teacher-preview-files';
import { generateSafePatientReplyV2, PatientResponseSafetyErrorV2, type GenerateSafePatientReplyInputV2, type GenerateSafePatientReplyDependenciesV2 } from './generate-safe-patient-reply';
import { OpenAiPatientResponseValidatorExecutionErrorV2 } from './execute-openai-patient-response-validator';
import { OpenAiPatientResponseGeneratorErrorV2 } from './execute-openai-patient-response-generator';
import { PATIENT_RESPONSE_VIOLATION_CODES_V2, parseOpenAiPatientResponseValidationTransportV1 } from './openai-patient-response-validator-transport';

export const PREVIEW_WIRE = Object.freeze({model:'gpt-5.6-terra',max_output_tokens:4096,reasoning:{effort:'medium'},service_tier:'default',store:false});
const authorizationSchema=z.object({
  version:z.literal('teacher-preview-authorization/1'),purpose:z.literal('LUCIA_MARIA_TEACHER_PREVIEW'),approved:z.literal(true),expiresAt:z.string().datetime(),
  caseVersionIds:z.array(z.string()).length(2),budgetEur:z.literal(15),
  historicalReservedMicroUsd:z.number().int().nonnegative(),historicalCalculatedMicroUsd:z.number().nonnegative(),historicalUnknownCounts:z.number().int().nonnegative(),
  inferenceCeilingMicroUsd:z.number().int().positive().max(4000000),maxCalls:z.number().int().positive().max(16),unknownCountingCostAccepted:z.literal(true),
  parents:z.array(z.object({file:z.string(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).min(1),
  wireHash:z.literal(previewHash(PREVIEW_WIRE)),
}).strict();
type Entry={id:string;kind:'generation'|'validation';requestHash:string;state:'COUNT_INTENT'|'COUNTED'|'RESERVED'|'RECEIVED'|'FAILED';inputTokens?:number;reservedMicroUsd?:number;usage?:{input:number;output:number;cachedRead:number;cachedWrite:number};calculatedMicroUsd?:number;requestId?:string;countRequestId?:string;countCost:null;violations?:string[]};
type Ledger={version:'teacher-preview-budget/1';authorizationHash:string;stopped:boolean;entries:Entry[];failure?:{code:string;stage:string;rule?:string}};
const safeRequestId=(r:Response)=>{const id=r.headers.get('x-request-id');return id&&/^req_[a-zA-Z0-9_-]{1,100}$/.test(id)?id:undefined;};
function outputText(r:any):string{
  if(r.status!=='completed'||r.error||!Array.isArray(r.output))throw Error('PREVIEW_PROVIDER_OUTPUT');
  const messages=r.output.filter((x:any)=>x.type==='message');
  if(messages.length!==1||r.output.some((x:any)=>!['reasoning','message'].includes(x.type)))throw Error('PREVIEW_PROVIDER_OUTPUT');
  const m=messages[0];
  if(m.role!=='assistant'||!Array.isArray(m.content)||m.content.length!==1||m.content[0].type!=='output_text'||typeof m.content[0].text!=='string')throw Error('PREVIEW_PROVIDER_OUTPUT');
  return m.content[0].text;
}
const tokens=z.number().int().nonnegative();
const ledgerSchema=z.object({version:z.literal('teacher-preview-budget/1'),authorizationHash:z.string().length(64),stopped:z.boolean(),entries:z.array(z.object({
  id:z.string(),kind:z.enum(['generation','validation']),requestHash:z.string().length(64),state:z.enum(['COUNT_INTENT','COUNTED','RESERVED','RECEIVED','FAILED']),
  inputTokens:tokens.optional(),reservedMicroUsd:tokens.optional(),usage:z.object({input:tokens,output:tokens,cachedRead:tokens,cachedWrite:tokens}).strict().optional(),
  calculatedMicroUsd:z.number().nonnegative().optional(),requestId:z.string().optional(),countRequestId:z.string().optional(),countCost:z.null(),violations:z.array(z.enum(PATIENT_RESPONSE_VIOLATION_CODES_V2)).optional(),
}).strict().refine(e=>e.state!=='RECEIVED'||(e.inputTokens!==undefined&&e.reservedMicroUsd===Math.ceil(e.inputTokens*2.5+4096*12)&&e.usage!==undefined),'RESERVATION_REQUIRED')),
failure:z.object({code:z.string(),stage:z.string(),rule:z.string().optional()}).strict().optional()}).strict();

/** Preview-only Responses bridge; same generator prompt, guards and final semantic validator. */
export async function runTeacherPreviewReply(input:GenerateSafePatientReplyInputV2,context:{previewId:string;requestId:string;opening:boolean},
  options:{directory:string;authorizationFile?:string;apiKey?:string;fetcher?:typeof fetch}){
  if(!options.authorizationFile||!options.apiKey||input.clinicalContent.contentFormat!=='TEACHER_DRAFT_PATIENT_V1')throw Error('PREVIEW_NOT_AUTHORIZED');
  const clinical=structuredClone(input.clinicalContent),snapshot={...structuredClone(input),clinicalContent:clinical};
  context={...context};
  return withPreviewLock(options.directory,'budget',async()=>{
    const grant=authorizationSchema.parse(await readJson(options.authorizationFile!));
    if(Date.parse(grant.expiresAt)<Date.now()||!grant.caseVersionIds.includes(clinical.caseVersionId))throw Error('PREVIEW_NOT_AUTHORIZED');
    for(const parent of grant.parents){if(createHash('sha256').update(await readFile(parent.file)).digest('hex')!==parent.sha256)throw Error('PREVIEW_HISTORY_CHANGED');}
    const file=join(options.directory,'budget.json');
    let ledger:Ledger;
    try{ledger=ledgerSchema.parse(await readJson(file));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('PREVIEW_LEDGER_INVALID');ledger={version:'teacher-preview-budget/1',authorizationHash:previewHash(grant),stopped:false,entries:[]};await durableJson(file,ledger,true);}
    if(ledger.version!=='teacher-preview-budget/1'||ledger.authorizationHash!==previewHash(grant)||ledger.stopped||!Array.isArray(ledger.entries)||ledger.entries.some(e=>e.state!=='RECEIVED'))throw Error('PREVIEW_BUDGET_BLOCKED');
    const fetcher=options.fetcher??fetch;
    let generated=false;
    async function send(kind:Entry['kind'],body:Record<string,unknown>){
      if(ledger.entries.length>=grant.maxCalls||ledger.entries.some(e=>e.id===`${context.previewId}:${context.requestId}:${kind}`))throw Error('PREVIEW_CALL_LIMIT');
      const bytes=Buffer.byteLength(JSON.stringify(body),'utf8');
      if(bytes>80000||body.model!==PREVIEW_WIRE.model||body.max_output_tokens!==4096||body.store!==false)throw Error('PREVIEW_CONFIGURATION');
      const prior=grant.historicalReservedMicroUsd+ledger.entries.reduce((sum,e)=>sum+(e.reservedMicroUsd??0),0);
      if(prior+4096*12>=grant.inferenceCeilingMicroUsd)throw Error('PREVIEW_BUDGET');
      const e:Entry={id:`${context.previewId}:${context.requestId}:${kind}`,kind,requestHash:previewHash(body),state:'COUNT_INTENT',countCost:null};
      ledger.entries.push(e);await durableJson(file,ledger);
      try{
        const {model,instructions,input,text,reasoning}=body;
        const countBody={model,instructions,input,text,reasoning};
        const count=await fetcher('https://api.openai.com/v1/responses/input_tokens',{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${options.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(countBody),signal:AbortSignal.timeout(60000)});
        e.countRequestId=safeRequestId(count);if(!count.ok)throw Error('PREVIEW_COUNT_FAILED');
        const n=tokens.positive().max(272000).parse((await count.json()).input_tokens);
        e.inputTokens=n;e.state='COUNTED';await durableJson(file,ledger);
        const reserve=Math.ceil(n*2.5+4096*12);
        if(prior+reserve>grant.inferenceCeilingMicroUsd)throw Error('PREVIEW_BUDGET');
        e.reservedMicroUsd=reserve;e.state='RESERVED';await durableJson(file,ledger);
        const response=await fetcher('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${options.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
        e.requestId=safeRequestId(response);if(!response.ok)throw Error('PREVIEW_REQUEST_FAILED');
        const r=await response.json();
        // Record usage before semantic/schema parsing; never save raw responses.
        const usage={input:tokens.parse(r.usage?.input_tokens),output:tokens.parse(r.usage?.output_tokens),cachedRead:tokens.parse(r.usage?.input_tokens_details?.cached_tokens),cachedWrite:tokens.parse(r.usage?.input_tokens_details?.cache_write_tokens)};
        e.usage=usage;e.calculatedMicroUsd=(usage.input-usage.cachedRead-usage.cachedWrite)*2+usage.cachedRead*0.2+usage.cachedWrite*2.5+usage.output*12;
        e.state='RECEIVED';await durableJson(file,ledger);
        if(r.model!==PREVIEW_WIRE.model||r.service_tier!=='default'||usage.input>n||usage.output>4096||usage.cachedRead+usage.cachedWrite>usage.input)throw Error('PREVIEW_METADATA');
        const value=outputText(r);
        if(kind==='validation'){
          const parsed=parseOpenAiPatientResponseValidationTransportV1(JSON.parse(value));
          e.violations=parsed.violations.filter(x=>PATIENT_RESPONSE_VIOLATION_CODES_V2.includes(x));await durableJson(file,ledger);
          return {...r,output_parsed:parsed};
        }
        return {model:r.model,choices:[{finish_reason:'stop',message:{role:'assistant',refusal:null,content:value}}],usage:{prompt_tokens:usage.input,completion_tokens:usage.output}};
      }catch{
        e.state='FAILED';ledger.stopped=true;await durableJson(file,ledger);throw Error('PREVIEW_PROVIDER_FAILED');
      }
    }
    const dependencies={
      patientGenerator:{config:{model:PREVIEW_WIRE.model,maxTokens:4096,timeoutMs:60000},client:{chat:{completions:{create:async(p:any)=>{
        // No automatic retry/regeneration in this closed demonstration.
        if(generated)throw Error('PREVIEW_REGENERATION_DISABLED');generated=true;
        if(context.opening)return {model:'teacher-authored-demand',choices:[{finish_reason:'stop',message:{role:'assistant',refusal:null,content:clinical.initialDemand}}],usage:{prompt_tokens:0,completion_tokens:0}};
        return send('generation',{...PREVIEW_WIRE,input:p.messages});
      }}}}},
      semanticValidator:{config:{model:PREVIEW_WIRE.model,maxOutputTokens:4096,timeoutMs:60000},client:{responses:{parse:async(p:any)=>send('validation',{...p,...PREVIEW_WIRE})}}},
    } as unknown as GenerateSafePatientReplyDependenciesV2;
    try{return await generateSafePatientReplyV2(snapshot,dependencies);}
    catch(e){
      ledger.stopped=true;
      ledger.failure=e instanceof PatientResponseSafetyErrorV2?{code:e.code,stage:e.stage,
        ...(e.cause instanceof OpenAiPatientResponseValidatorExecutionErrorV2||e.cause instanceof OpenAiPatientResponseGeneratorErrorV2?{rule:e.cause.code}:{})}:{code:'TECHNICAL_FAILURE',stage:'runtime'};
      await durableJson(file,ledger);throw Error(`PREVIEW_RUNTIME_REJECTED:${ledger.failure.code}:${ledger.failure.stage}:${ledger.failure.rule??'none'}`);
    }
  });
}
