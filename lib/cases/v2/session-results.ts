import {createHash} from 'node:crypto';
import {z} from 'zod';

export const resultPolicySchema=z.object({
 version:z.literal('result-policy/1'),id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
 scope:z.enum(['SYNTHETIC_TEST','ACADEMIC_APPROVED']),approvalReference:z.string().min(1).max(200),
 release:z.enum(['AFTER_SUBMISSION','TEACHER_REVIEW']),
 performance:z.object({protocol:z.number().positive(),pharmaceutical:z.number().positive(),communication:z.number().positive()}).strict().nullable(),
}).strict().superRefine((p,c)=>{if(p.performance&&Math.abs(Object.values(p.performance).reduce((s,n)=>s+n,0)-100)>1e-9)c.addIssue({code:'custom',message:'WEIGHTS_TOTAL'});});
export type ResultPolicy=z.infer<typeof resultPolicySchema>;
export type ResultDimension={
 synthetic?:boolean;
 feedback?:{criterion:string;state:string;level:number|null;justification:string;improvement:string;certainty:string;context:{messageId:string;role:'student'|'patient';excerpt:string}[]}[];
 status:'AVAILABLE'|'PROVISIONAL'|'PENDING_REVIEW'|'PENDING'|'TECHNICAL_FAILURE'|'NOT_SCORABLE';
 score:number|null;source:{id:string;version:string;fingerprint:string;versions?:string[]}|null;
 evidence:{criterion:string;outcome:string;messageId:string;role:'student'|'patient';excerpt:string}[];
};
export const emptyDimension=(status:ResultDimension['status']='PENDING'):ResultDimension=>({status,score:null,source:null,evidence:[]});
export function resultFingerprint(value:unknown):string{
 const canonical=(v:any):any=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(canonical):v!==null&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
}
/** Understanding is independent. Missing/provisional dimensions never become zero or renormalize weights. */
export function performanceResult(policy:ResultPolicy,dimensions:Record<'protocol'|'pharmaceutical'|'communication',ResultDimension>){
 if(!policy.performance)return {status:'POLICY_PENDING' as const,score:null};
 const keys=['protocol','pharmaceutical','communication'] as const;
 if(keys.some(k=>dimensions[k].status!=='AVAILABLE'||dimensions[k].score===null))return {status:'DIMENSIONS_PENDING' as const,score:null};
 return {status:'AVAILABLE' as const,score:Math.round(keys.reduce((s,k)=>s+dimensions[k].score!*policy.performance![k],0))/100};
}
