import {z} from 'zod';
import type {ResultDimension} from './session-results';
import {QuestionnaireError} from './session-questionnaire-store';

export const reviewRequestSchema=z.object({
 expectedFingerprint:z.string().regex(/^[0-9a-f]{64}$/),expectedRevision:z.number().int().nonnegative(),
 action:z.enum(['ACCEPT','CORRECT','COMMENT']),dimension:z.enum(['protocol','pharmaceutical','communication','understanding']),
 criterion:z.string().trim().min(1).max(120).nullable(),score:z.number().min(0).max(100).nullable(),
 correction:z.string().trim().max(2000),reason:z.string().trim().min(1).max(2000),
}).strict().superRefine((r,c)=>{
 if(r.action==='CORRECT'&&r.score===null&&(!r.criterion||!r.correction))c.addIssue({code:'custom',message:'CORRECTION_REQUIRED'});
 if(r.action!=='CORRECT'&&(r.score!==null||r.criterion!==null||r.correction))c.addIssue({code:'custom',message:'ACTION_INVALID'});
 if(r.criterion&&!r.correction)c.addIssue({code:'custom',message:'CRITERION_CORRECTION_REQUIRED'});
});
export type TeacherReviewRequest=z.infer<typeof reviewRequestSchema>;
export type HumanReview={revision:number;author:string;createdAt:string;baseFingerprint:string;request:TeacherReviewRequest};
export function validateHumanReview(request:TeacherReviewRequest,dimension:ResultDimension,questionIds:string[]){
 if(request.action==='ACCEPT'&&dimension.status!=='AVAILABLE'&&dimension.status!=='PROVISIONAL'&&dimension.status!=='PENDING_REVIEW')throw new QuestionnaireError('INVALID',400);
 if(request.action==='CORRECT'){
  if(['TECHNICAL_FAILURE','PENDING','NOT_SCORABLE'].includes(dimension.status))throw new QuestionnaireError('INVALID',400);
  const criteria=new Set([...dimension.evidence.map(e=>e.criterion),...(dimension.feedback??[]).map(f=>f.criterion),...questionIds]);
  if(request.criterion&&!criteria.has(request.criterion))throw new QuestionnaireError('INVALID',400);
  // Acceptance/correction of an attempt does not approve its rubric or provisional academic score.
  if(request.score!==null&&dimension.status!=='AVAILABLE')throw new QuestionnaireError('INVALID',400);
 }
}
export function applyHumanReviews(dimensions:Record<TeacherReviewRequest['dimension'],ResultDimension>,reviews:HumanReview[]){
 const result=structuredClone(dimensions);
 for(const review of reviews){const r=review.request,d=result[r.dimension];
  if(r.action!=='CORRECT')continue;
  if(r.score!==null){d.score=r.score;d.status=dimensions[r.dimension].status;}
  else if(r.criterion){d.score=null;d.status='PENDING_REVIEW';}
 }
 return result;
}
