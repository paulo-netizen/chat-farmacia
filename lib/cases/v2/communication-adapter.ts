import 'server-only';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {z} from 'zod';
import {durableJson,readJson,withPreviewLock} from './teacher-preview-files';
import {teacherOfficialFetch} from './teacher-official-fetch';
import {resultFingerprint} from './session-results';
import {communicationRubricV2,communicationInstructionsV2,validateCommunicationV2,type CommunicationRuntimeV2} from './communication-evaluation-v2';
import {communicationOutputSchema,type CommunicationInput,CommunicationError} from './communication-evaluation';
import {validateSessionTranscriptSnapshotV2} from './spfa-session-transcript';
import {communicationStateDiagnostics} from './communication-diagnostics';

export const M7_WIRE={model:'gpt-5.6-terra',reasoning:{effort:'medium'},service_tier:'default',store:false,max_output_tokens:8000} as const;
export const M7_IDS=['M7D1','M7D2','M7D3','M7D4','M7D5','M7D6','M7V1','M7V2','M7V3','M7V4','M7V5','M7V6'] as const;
const str={type:'string'},bool={type:'boolean'};
export function communicationProviderRequestV2(input:CommunicationInput){
 if(!['PROPOSAL','SYNTHETIC_TEST'].includes(input.scope)||!['COMPLETE','INCOMPLETE'].includes(input.capture))throw new CommunicationError('CONFIGURATION_BLOCKED');
 const transcript=validateSessionTranscriptSnapshotV2(input.transcript);
 const ref=(student:boolean)=>({type:'object',additionalProperties:false,required:['messageId','excerpt','occurrenceIndex'],properties:{
  messageId:{type:'string',enum:transcript.messages.filter(m=>!student||m.role==='student').map(m=>m.messageId)},excerpt:str,occurrenceIndex:{type:'integer',minimum:0}}});
 if(!transcript.messages.some(m=>m.role==='student'))throw new CommunicationError('SUPPORT_MISSING');
 return {...M7_WIRE,instructions:communicationInstructionsV2,input:JSON.stringify({rubric:communicationRubricV2,capture:input.capture,transcript}),
  text:{format:{type:'json_schema',name:'communication_adjudication_v2',strict:true,schema:{type:'object',additionalProperties:false,required:['version','judgments'],properties:{version:{type:'string',enum:['communication-adjudication/1']},judgments:{type:'array',minItems:9,maxItems:9,items:{type:'object',additionalProperties:false,
   required:['criterion','state','level','opportunity','absence','evidence','context','justification','improvement','certainty'],properties:{criterion:{type:'string',enum:communicationRubricV2.criteria.map(c=>c.id)},state:{type:'string',enum:['OBSERVED','NO_OPPORTUNITY','INCOMPLETE_CAPTURE','UNCERTAIN']},level:{type:['integer','null'],minimum:0,maximum:3},opportunity:{type:'string',enum:['PRESENT','ABSENT','UNKNOWN']},absence:bool,evidence:{type:'array',items:ref(true)},context:{type:'array',items:ref(false)},justification:str,improvement:str,certainty:{type:'string',enum:['HIGH','REVIEW_REQUIRED']}}}}}}}}};
}

/** Representation /3 constrains coupled states in the provider schema. /2 stays reproducible. */
export function communicationProviderRequest(input:CommunicationInput){
 const old=communicationProviderRequestV2(input),schema=old.text.format.schema,item=schema.properties.judgments.items;
 const branch=(properties:Record<string,unknown>)=>({...item,properties:{...item.properties,...properties}});
 const fixed=(value:string|boolean|null)=>({type:value===null?'null':typeof value,enum:[value]});
 const incomplete=branch({state:fixed('INCOMPLETE_CAPTURE'),level:fixed(null),absence:fixed(false),certainty:fixed('REVIEW_REQUIRED')});
 const variants=input.capture==='INCOMPLETE'?[incomplete]:[
  branch({state:fixed('OBSERVED'),level:{type:'integer',minimum:0,maximum:3},opportunity:fixed('PRESENT'),absence:fixed(false),evidence:{...item.properties.evidence,minItems:1}}),
  branch({state:fixed('OBSERVED'),level:{type:'integer',enum:[0]},opportunity:fixed('PRESENT'),absence:fixed(true),evidence:{...item.properties.evidence,maxItems:0}}),
  branch({state:fixed('NO_OPPORTUNITY'),level:fixed(null),opportunity:fixed('ABSENT'),absence:fixed(false)}),
  branch({state:fixed('UNCERTAIN'),level:fixed(null),absence:fixed(false),certainty:fixed('REVIEW_REQUIRED')}),
 ];
 return {...old,instructions:old.instructions+' Provider representation communication-wire/3: use the state-specific schema branch. Non-observed states have null level and absence=false. Absence means an omitted student behavior with opportunity, never missing capture. Uncertainty and incomplete capture require certainty=REVIEW_REQUIRED.',
  text:{...old.text,format:{...old.text.format,name:'communication_adjudication_v3',schema:{...schema,properties:{...schema.properties,judgments:{...schema.properties.judgments,items:{anyOf:variants}}}}}}};
}

/** Connects the authorized experiment transport to the existing persistence service.
 * The grant still binds the exact persisted transcript; no generic production entry is enabled. */
export function createAuthorizedCommunicationRuntime(id:typeof M7_IDS[number],options:Parameters<typeof runCommunicationExperiment>[2]):CommunicationRuntimeV2{
 return {mode:'REAL',id:'communication-authorized-experiment/2:communication-wire/3',adjudicate:async request=>{
  if(request.instructions!==communicationInstructionsV2||resultFingerprint(request.rubric)!==resultFingerprint(communicationRubricV2))throw new CommunicationError('CONFIGURATION_BLOCKED');
  const entry=await runCommunicationExperiment(id,{scope:'PROPOSAL',capture:request.capture,transcript:request.transcript},options);
  if(entry.state!=='RECEIVED'||!entry.result)throw new CommunicationError('RUNTIME_FAILURE');
  return {version:'communication-adjudication/1',judgments:entry.result.judgments.map(j=>({...j,
   evidence:j.evidence.map(({messageId,excerpt,occurrenceIndex})=>({messageId,excerpt,occurrenceIndex})),
   context:j.context.map(({messageId,excerpt,occurrenceIndex})=>({messageId,excerpt,occurrenceIndex}))}))};
 }};
}
const hash=z.string().regex(/^[a-f0-9]{64}$/),amount=z.number().nonnegative();
const grantSchema=z.object({version:z.literal('communication-experiment/1'),approval:z.literal('PAULO_2026_10_29'),expiresAt:z.string().datetime(),
 budgetEur:z.literal(15),unknownCountCostAccepted:z.literal(true),historicalReservedMicroUsd:amount,historicalCalculatedMicroUsd:amount,historicalUnknownCounts:z.number().int().nonnegative(),
 ceilingMicroUsd:z.number().int().positive().max(6000000),parents:z.array(z.object({file:z.string(),sha256:hash}).strict()).min(1),
 requests:z.array(z.object({id:z.enum(M7_IDS),requestHash:hash}).strict()).min(1).max(12),wireHash:z.literal(resultFingerprint(M7_WIRE))}).strict();
type Entry={id:string;requestHash:string;state:'COUNT_INTENT'|'RESERVED'|'RECEIVED'|'TECHNICAL_FAILURE'|'UNCERTAIN';countCost:null;inputTokens?:number;reservation?:number;requestId?:string;countRequestId?:string;usage?:{input:number;output:number;cachedRead:number;cachedWrite:number};calculatedMicroUsd?:number;result?:ReturnType<typeof validateCommunicationV2>;code?:string;diagnostic?:ReturnType<typeof communicationStateDiagnostics>};
type Ledger={version:'communication-experiment/1';grantHash:string;stopped:boolean;entries:Entry[]};
const safeId=(id:string|null)=>id&&/^req_[a-zA-Z0-9_-]{1,100}$/.test(id)?id:undefined;

/** Closed experiment only. Authorization is enforced here, not solely by its caller/CLI. */
export async function runCommunicationExperiment(id:typeof M7_IDS[number],input:CommunicationInput,options:{directory:string;authorizationFile?:string;apiKey?:string;fetcher?:typeof fetch}){
 if(!options.authorizationFile||!options.apiKey)throw Error('M7_NOT_AUTHORIZED');
 const frozen=structuredClone(input),body=communicationProviderRequest(frozen),requestHash=resultFingerprint(body);
 return withPreviewLock(options.directory,'communication',async()=>{
  const grant=grantSchema.parse(await readJson(options.authorizationFile!));
  if(Date.parse(grant.expiresAt)<=Date.now()||grant.requests.length!==new Set(grant.requests.map(r=>r.id)).size||!grant.requests.some(r=>r.id===id&&r.requestHash===requestHash)||Buffer.byteLength(JSON.stringify(body))>40000)throw Error('M7_NOT_AUTHORIZED');
  for(const p of grant.parents)if(createHash('sha256').update(await readFile(p.file)).digest('hex')!==p.sha256)throw Error('M7_HISTORY_CHANGED');
  const file=join(options.directory,'budget.json');let ledger:Ledger;
  try{ledger=await readJson(file) as Ledger;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('M7_LEDGER_INVALID');ledger={version:'communication-experiment/1',grantHash:resultFingerprint(grant),stopped:false,entries:[]};await durableJson(file,ledger,true);}
  if(ledger.version!==grant.version||ledger.grantHash!==resultFingerprint(grant)||ledger.stopped||!Array.isArray(ledger.entries)||ledger.entries.some(e=>e.id===id||!['RECEIVED','TECHNICAL_FAILURE'].includes(e.state)||!Number.isSafeInteger(e.reservation)||e.reservation!==Math.ceil(e.inputTokens!*2.5+96000)))throw Error('M7_LEDGER_BLOCKED');
  const prior=grant.historicalReservedMicroUsd+ledger.entries.reduce((s,e)=>s+e.reservation!,0);
  if(prior+96000>=grant.ceilingMicroUsd)throw Error('M7_BUDGET');
  const entry:Entry={id,requestHash,state:'COUNT_INTENT',countCost:null};ledger.entries.push(entry);await durableJson(file,ledger);
  const fetcher=options.fetcher??teacherOfficialFetch;
  const send=(path:string,payload:unknown)=>fetcher(`https://api.openai.com/v1/${path}`,{method:'POST',redirect:'error',headers:{Authorization:`Bearer ${options.apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)});
  let received=false,storageFailed=false;
  const persist=async()=>{try{await durableJson(file,ledger);}catch{storageFailed=true;throw Error('M7_LEDGER_FAILED');}};
  try{
   const {model,instructions,input:projected,text,reasoning}=body;
   const count=await send('responses/input_tokens',{model,instructions,input:projected,text,reasoning});entry.countRequestId=safeId(count.headers.get('x-request-id'));
   if(!count.ok)throw Error('M7_COUNT_FAILED');entry.inputTokens=z.number().int().positive().max(272000).parse((await count.json()).input_tokens);
   entry.reservation=Math.ceil(entry.inputTokens*2.5+96000);if(prior+entry.reservation>grant.ceilingMicroUsd)throw Error('M7_BUDGET');
   entry.state='RESERVED';await persist();
   const response=await send('responses',body);entry.requestId=safeId(response.headers.get('x-request-id'));
   if(!response.ok)throw Error('M7_TRANSPORT');const r=await response.json();
   const token=z.number().int().nonnegative();entry.usage={input:token.parse(r.usage?.input_tokens),output:token.parse(r.usage?.output_tokens),cachedRead:token.parse(r.usage?.input_tokens_details?.cached_tokens),cachedWrite:token.parse(r.usage?.input_tokens_details?.cache_write_tokens)};
   const u=entry.usage;
   if(r.model!==M7_WIRE.model||r.service_tier!=='default'||u.input>entry.inputTokens||u.output>8000||u.cachedRead+u.cachedWrite>u.input)throw Error('M7_CONFIGURATION');
   entry.calculatedMicroUsd=(u.input-u.cachedRead-u.cachedWrite)*2+u.cachedRead*.2+u.cachedWrite*2.5+u.output*12;
   received=true;await persist();
   if(r.status!=='completed'||!Array.isArray(r.output)||r.output.some((m:any)=>!['reasoning','message'].includes(m?.type)))throw Error('M7_PARSE');
   const messages=r.output.filter((m:any)=>m.type==='message');
   if(messages.length!==1||messages[0].role!=='assistant'||messages[0].content?.length!==1||messages[0].content[0].type!=='output_text')throw Error('M7_PARSE');
   let raw:unknown;try{raw=JSON.parse(messages[0].content[0].text);}catch{throw Error('M7_PARSE');}
   try{entry.result=validateCommunicationV2(frozen,communicationOutputSchema.parse(raw));}
   catch(e){entry.diagnostic=communicationStateDiagnostics(frozen,raw);throw e;}
   entry.state='RECEIVED';await persist();
   return structuredClone(entry);
  }catch(e){
   const allowed=['M7_COUNT_FAILED','M7_BUDGET','M7_TRANSPORT','M7_CONFIGURATION','M7_PARSE'];
   entry.code=storageFailed?'M7_LEDGER_FAILED':e instanceof CommunicationError?e.code:e instanceof Error&&allowed.includes(e.message)?e.message:received?'SCHEMA_INVALID':'M7_UNCERTAIN';
   entry.state=received&&!storageFailed?'TECHNICAL_FAILURE':'UNCERTAIN';ledger.stopped=!received||storageFailed;await durableJson(file,ledger);
   return structuredClone(entry);
  }
 });
}
