import type {Pool} from 'pg';
import {createM8Fixture} from './m8-postgres-fixture';
import {createSessionQuestionnaireStore} from '@/lib/cases/v2/session-questionnaire-store';
import {claimSpfaSessionEvaluationV2} from '@/lib/cases/v2/claim-spfa-session-evaluation';
import {failSpfaEvaluationAttemptV2} from '@/lib/cases/v2/spfa-evaluation-persistence-runtime';
export const m9Policy=(release:'AFTER_SUBMISSION'|'TEACHER_REVIEW')=>({version:'result-policy/1',id:`m9-synthetic-${release}`,scope:'SYNTHETIC_TEST',approvalReference:'synthetic-only-not-academic',release,performance:{protocol:20,pharmaceutical:30,communication:50}});
export async function m9FailedSpfa(db:Pool,f:{student:string;sessionId:string}){
 const claim=await claimSpfaSessionEvaluationV2({authenticatedUserId:Number(f.student),sessionId:f.sessionId},{database:db});
 if(!('attemptId' in claim))throw Error('synthetic claim missing');
 await failSpfaEvaluationAttemptV2({sessionId:f.sessionId,attemptId:claim.attemptId,attemptCount:claim.attemptCount,snapshotIdentity:claim.snapshotIdentity},new Date().toISOString(),'INTERNAL_FAILURE',db);
}
export async function createM9Fixture(db:Pool,mode:'AFTER_SUBMISSION'|'TEACHER_REVIEW'='AFTER_SUBMISSION',failure:boolean|'PENDING'=false){
 const f=await createM8Fixture(db);
 await db.query('INSERT INTO case_result_policies(case_version_id,policy,created_by) VALUES($1,$2,$3)',[f.request.candidateVersionId,m9Policy(mode),f.teacher]);
 const claim=failure==='PENDING'?await claimSpfaSessionEvaluationV2({authenticatedUserId:Number(f.student),sessionId:f.sessionId},{database:db}):null;
 if(failure===true)await m9FailedSpfa(db,f);
 const q=createSessionQuestionnaireStore(db);await q.finish(f.student,f.sessionId);
 return {...f,q,claim,submit:()=>q.write(f.student,f.sessionId,{action:'submit',expectedRevision:0,answers:[{questionId:'Q1',optionIds:['A']},{questionId:'Q2',optionIds:['A']}]})};
}
