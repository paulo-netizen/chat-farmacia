import 'server-only';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {validateTeacherNativePackage} from './build-teacher-native-package';
import {digest,sourceCatalog,type SourceEvidence} from './teacher-academic-preparation';
import {AUDITOR_VERSION,AUDITOR_WIRE,auditorRequest,parseClinicalJudgment,type ClinicalAuditInput, type runClinicalAuditor} from './teacher-clinical-auditor';

export const NATIVE_AUDIT_VERSION='teacher-native-audit/1';
export function ordered<T>(value:T):T {
 if(Array.isArray(value))return value.map(ordered) as T;
 if(value!==null&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,ordered(v)])) as T;
 return value;
}
export function nativeAuditInput(content:unknown,candidateVersionId:string,contentHash:string,version:1|2=1):ClinicalAuditInput {
 const bundle=validateTeacherNativePackage(content,candidateVersionId);
 return ordered({contractVersion:version===2?'teacher-native-audit-input/2' as const:'teacher-native-audit-input/1' as const,candidateVersionId,draftVersionId:bundle.sourceDraft.versionId,contentHash,bundle});
}
export function nativeAuditConfiguration(input:ClinicalAuditInput,sources:SourceEvidence[]) {
 const r=auditorRequest(input,sources);
 return ordered({version:AUDITOR_VERSION,wire:AUDITOR_WIRE,instructions:r.instructions,text:r.text,...(input.contractVersion==='teacher-native-audit-input/2'?{inputVersion:2 as const}:{})});
}
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const sourceSchema=z.object({key:z.enum(['metformin850','enalapril20']),url:z.string(),retrievedAt:z.string().datetime(),status:z.enum(['AVAILABLE','UNAVAILABLE','CONTENT_UNVERIFIED']),sha256:hash.optional(),excerpt:z.string().max(24000).optional(),clinicalText:z.string().max(200000).optional(),truncated:z.boolean().optional(),representation:z.literal('cima-clinical-text/2').optional(),scope:z.enum(['CLINICAL_SECTION','FROM_INDICATIONS_TO_DOCUMENT_END']).optional(),clinicalTextSha256:hash.optional(),code:z.enum(['SOURCE_UNAVAILABLE','SOURCE_CONTENT_UNVERIFIED']).optional()}).strict();
export function nativeAuditSources(value:unknown):SourceEvidence[]{
 const sources=z.array(sourceSchema).min(1).max(2).parse(value);
 if(new Set(sources.map(s=>s.key)).size!==sources.length||sources.some(s=>s.url!==sourceCatalog[s.key].url||(s.status==='AVAILABLE'&&(!s.sha256||!s.clinicalText))))throw Error('NATIVE_AUDIT_SOURCE_INVALID');
 if(sources.some(s=>!s.representation&&((s.clinicalText?.length??0)>24000||s.scope||s.clinicalTextSha256)))throw Error('NATIVE_AUDIT_SOURCE_INVALID');
 if(sources.some(s=>s.representation==='cima-clinical-text/2'&&(!s.scope||s.truncated!==false||!s.clinicalText||s.clinicalTextSha256!==createHash('sha256').update(s.clinicalText).digest('hex'))))throw Error('NATIVE_AUDIT_SOURCE_INVALID');
 return ordered(sources);
}
export function nativeAuditBinding(input:ClinicalAuditInput,sources:SourceEvidence[]){
 const evidence=nativeAuditSources(sources),configuration=nativeAuditConfiguration(input,evidence);
 return {version:NATIVE_AUDIT_VERSION,sources:evidence,configuration,configurationHash:digest(configuration),sourcesHash:digest(evidence),requestHash:digest(auditorRequest(input,evidence))};
}
export function nativeAuditStatus(result:Pick<Awaited<ReturnType<typeof runClinicalAuditor>>,'judgment'>|null,sources:SourceEvidence[]):'PENDING'|'PASS'|'WARNING'|'FAIL'{
 if(!result)return 'PENDING';
 if(result.judgment.dimensions.some(d=>d.status==='FAIL'))return 'FAIL';
 if(!sources.length||sources.some(s=>s.status!=='AVAILABLE'||s.truncated===true)||result.judgment.dimensions.some(d=>d.status==='INSUFFICIENT'))return 'PENDING';
 return result.judgment.dimensions.some(d=>d.status==='WARNING')?'WARNING':'PASS';
}
/** Only known metadata and validated structured judgment are retained. Never raw output. */
export function validateNativeAuditResult(value:unknown,input:ClinicalAuditInput,sources:SourceEvidence[]){
 const n=z.number().nonnegative(),result=z.object({version:z.literal(AUDITOR_VERSION),packageHash:hash,requestHash:hash,model:z.literal(AUDITOR_WIRE.model),judgment:z.unknown(),usage:z.object({input:n.int(),output:n.int().max(8000),cachedRead:n.int(),cachedWrite:n.int()}).strict(),requestId:z.string().regex(/^req_[a-zA-Z0-9_-]{1,100}$/).optional(),countRequestId:z.string().regex(/^req_[a-zA-Z0-9_-]{1,100}$/).optional(),costMicroUsd:n,reservation:n.int(),countCost:z.null()}).strict().parse(value);
 if(result.packageHash!==digest(input)||result.requestHash!==digest(auditorRequest(input,sources)))throw Error('NATIVE_AUDIT_RESULT_BINDING');
 return {...result,judgment:parseClinicalJudgment(result.judgment,input,sources)};
}
