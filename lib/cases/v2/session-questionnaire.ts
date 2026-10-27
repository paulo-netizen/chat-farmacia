import {z} from 'zod';
import {validateTeacherNativePackage} from './build-teacher-native-package';
const id=z.string().regex(/^Q[1-9][0-9]{0,2}$/);
const option=z.string().regex(/^[A-F]$/);
export const questionnairePolicySchema=z.object({
 version:z.literal('questionnaire-policy/1'),id:z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
 scope:z.enum(['SYNTHETIC_TEST','ACADEMIC_APPROVED']),approvalReference:z.string().min(1).max(200),
 matching:z.literal('EXACT_SET'),requireAll:z.boolean(),floor:z.literal(0),
 items:z.array(z.object({questionId:id,correct:z.number().int().positive().max(10000),incorrect:z.number().int().max(0).min(-10000),blank:z.number().int().max(0).min(-10000)}).strict()).min(1).max(30),
}).strict().superRefine((p,c)=>{if(new Set(p.items.map(i=>i.questionId)).size!==p.items.length)c.addIssue({code:'custom',message:'POLICY_DUPLICATE'});});
export const questionnaireAnswersSchema=z.array(z.object({questionId:id,optionIds:z.array(option).max(6)}).strict()).max(30);
export const questionnaireWriteSchema=z.object({action:z.enum(['save','submit']),expectedRevision:z.number().int().nonnegative(),answers:questionnaireAnswersSchema}).strict();
export function questionnaireDefinition(content:unknown,format:string,versionId:string,policyValue:unknown){
 if(format!=='TEACHER_CASE_BUNDLE_V1')throw Error('QUESTIONNAIRE_NOT_CONFIGURED');
 const bundle=validateTeacherNativePackage(content,versionId),policy=questionnairePolicySchema.parse(policyValue);
 const questions=bundle.teacher.questionnaire.map((q,i)=>({id:`Q${i+1}`,prompt:q.question,kind:q.kind,options:q.options,correctOptionIds:q.correctOptionIds,justification:q.justification}));
 if(!questions.length||policy.items.length!==questions.length||policy.items.some(p=>!questions.some(q=>q.id===p.questionId)))throw Error('QUESTIONNAIRE_POLICY_MISMATCH');
 return structuredClone({version:'session-questionnaire/1' as const,caseVersionId:versionId,policy,questions});
}
export type QuestionnaireDefinition=ReturnType<typeof questionnaireDefinition>;
export function normalizeQuestionnaireAnswers(def:QuestionnaireDefinition,value:unknown){
 const supplied=questionnaireAnswersSchema.parse(value);
 if(new Set(supplied.map(a=>a.questionId)).size!==supplied.length)throw Error('ANSWER_DUPLICATE');
 for(const a of supplied){const q=def.questions.find(q=>q.id===a.questionId);if(!q||new Set(a.optionIds).size!==a.optionIds.length||a.optionIds.some(id=>!q.options.some(o=>o.id===id))||(q.kind==='SINGLE_CHOICE'&&a.optionIds.length>1))throw Error('ANSWER_INVALID');}
 return def.questions.map(q=>({questionId:q.id,optionIds:[...(supplied.find(a=>a.questionId===q.id)?.optionIds??[])].sort()}));
}
export function gradeQuestionnaire(def:QuestionnaireDefinition,value:unknown){
 const answers=normalizeQuestionnaireAnswers(def,value);
 if(def.policy.requireAll&&answers.some(a=>!a.optionIds.length))throw Error('ANSWERS_INCOMPLETE');
 const items=answers.map(a=>{const q=def.questions.find(q=>q.id===a.questionId)!,p=def.policy.items.find(p=>p.questionId===a.questionId)!;const outcome=!a.optionIds.length?'BLANK':JSON.stringify([...q.correctOptionIds].sort())===JSON.stringify(a.optionIds)?'CORRECT':'INCORRECT';return {questionId:q.id,outcome,points:outcome==='BLANK'?p.blank:outcome==='CORRECT'?p.correct:p.incorrect};});
 const maximum=def.policy.items.reduce((s,i)=>s+i.correct,0),raw=items.reduce((s,i)=>s+i.points,0);
 return {version:'questionnaire-grade/1',policyId:def.policy.id,scope:def.policy.scope,items,raw,maximum,score:Math.round(Math.max(def.policy.floor,raw)*10000/maximum)/100};
}
/** Positive allowlist. Keys, justifications and scores remain server-side, including after submission. */
export function questionnairePublic(def:QuestionnaireDefinition,answers:unknown,revision:number,submittedAt:string|null){
 return {status:submittedAt?'SUBMITTED':'IN_PROGRESS',revision,submittedAt,synthetic:def.policy.scope==='SYNTHETIC_TEST',questions:def.questions.map(q=>({id:q.id,prompt:q.prompt,kind:q.kind,options:q.options.map(o=>({id:o.id,text:o.text}))})),answers:normalizeQuestionnaireAnswers(def,answers),results:'PENDING_AUTHORIZED_RESULTS'};
}
