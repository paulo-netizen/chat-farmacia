import 'server-only';
import type {PoolClient} from 'pg';
import {getOwnedSpfaEvaluationStatusV2,GetOwnedSpfaEvaluationStatusErrorV2} from './get-owned-spfa-evaluation-status';
import {validatePharmaceuticalEvaluationRecordV2} from './pharmaceutical-evaluation-lifecycle';
import {resolvePharmaceuticalEvaluationArtifactV2} from './pharmaceutical-evaluation-artifacts';
import type {PharmaceuticalEvaluationResultV2} from './pharmaceutical-evaluation-record-types';
import {createSessionTranscriptSnapshotV2} from './spfa-session-transcript';
import {emptyDimension,resultFingerprint,type ResultDimension} from './session-results';

/** Only persisted sources. Never imports coordinators, providers or evaluation writers. */
export async function readResultSources(c:PoolClient,s:{id:string;user_id:string;case_version_id:string}){
 const rows=(await c.query('SELECT id::text,role,content,created_at FROM messages WHERE session_id=$1 ORDER BY created_at,id',[s.id])).rows;
 const transcript=createSessionTranscriptSnapshotV2({sessionId:s.id,caseVersionId:s.case_version_id,messages:rows.map(m=>({messageId:m.id,role:m.role,content:m.content,createdAt:new Date(m.created_at).toISOString()}))});
 const verified=(e:ResultDimension['evidence'][number])=>{
  const m=transcript.messages.find(m=>m.messageId===e.messageId);
  if(!m||m.role!==e.role||!e.excerpt.trim()||!m.content.includes(e.excerpt))throw Error('RESULT_EVIDENCE_INVALID');
  return e;
 };
 const spfaRow=(await c.query('SELECT attempt_id,transcript_fingerprint_value FROM session_evaluation_records_v2 WHERE session_id=$1',[s.id])).rows[0];
 let protocol=emptyDimension();
 if(spfaRow){
  try{
   const stored=await getOwnedSpfaEvaluationStatusV2({authenticatedUserId:Number(s.user_id),sessionId:s.id},c);
   if(stored.status==='NOT_STARTED'||spfaRow.transcript_fingerprint_value!==transcript.fingerprint.value)throw Error('RESULT_BINDING_INVALID');
   protocol.source={id:spfaRow.attempt_id,version:'SPFA_SESSION_EVALUATION_V2',fingerprint:resultFingerprint(stored)};
   if(stored.status==='FAILED')protocol.status='TECHNICAL_FAILURE';
   if(stored.status==='COMPLETED'){
    protocol.source.versions=[`${stored.snapshotIdentity.protocolCatalogRef.id}@${stored.snapshotIdentity.protocolCatalogRef.version}`,`${stored.snapshotIdentity.scoringPolicyRef.id}@${stored.snapshotIdentity.scoringPolicyRef.version}`,...stored.evaluation.semanticExecutions.map(e=>`${e.promptVersion} / ${e.responseModel}`)];
    protocol.status=stored.score.needsReview?'PENDING_REVIEW':stored.score.status==='NOT_SCORABLE'?'NOT_SCORABLE':'AVAILABLE';
    protocol.score=stored.score.score;
    protocol.evidence=stored.evaluation.applications.flatMap(a=>a.requirementResults.flatMap(r=>{
     const material=r.kind==='INFORMATION_REQUIREMENT'?r.coverage:r.outcome;
     return material.evidence.flatMap(e=>e.source==='TRANSCRIPT_MESSAGE'&&e.excerpt?[verified({criterion:r.requirementRef,outcome:material.status,messageId:e.messageRef,role:e.speaker,excerpt:e.excerpt})]:[]);
    }));
   }
  }catch(e){if(e instanceof GetOwnedSpfaEvaluationStatusErrorV2&&e.code==='evaluation_read_failed')throw e;protocol={...emptyDimension('TECHNICAL_FAILURE'),source:{id:spfaRow.attempt_id,version:'SPFA_SESSION_EVALUATION_V2',fingerprint:resultFingerprint(spfaRow)}};}
 }
 const records=(await c.query('SELECT evaluation_id,header FROM pharmaceutical_evaluations_v2 WHERE session_id=$1 AND owner_id=$2 ORDER BY evaluation_id',[s.id,s.user_id])).rows;
 let pharmaceutical=emptyDimension();
 // Multiple intentions require explicit human selection, not an implicit latest/best score.
 if(records.length>1)pharmaceutical={...emptyDimension('PENDING_REVIEW'),source:{id:s.id,version:'pharmaceutical-selection-pending/1',fingerprint:resultFingerprint(records)}};
 else if(records.length===1){
  const row=records[0];
  const attempts=(await c.query('SELECT payload FROM pharmaceutical_evaluation_attempts_v2 WHERE evaluation_id=$1 ORDER BY fencing_token',[row.evaluation_id])).rows;
  const artifacts=(await c.query('SELECT reference,payload FROM pharmaceutical_evaluation_artifacts_v2 WHERE evaluation_id=$1',[row.evaluation_id])).rows;
  try{
   const resolve=(ref:any)=>artifacts.find(a=>resultFingerprint(a.reference)===resultFingerprint(ref))?.payload;
   const record=validatePharmaceuticalEvaluationRecordV2({...row.header,attempts:attempts.map(a=>a.payload)},resolve);
   if(record.intent.sessionId!==s.id||record.intent.ownerId!==String(s.user_id)||record.intent.caseVersionId!==s.case_version_id||record.intent.transcriptFingerprint.value!==transcript.fingerprint.value)throw Error('RESULT_BINDING_INVALID');
   pharmaceutical.source={id:record.evaluationId,version:record.contractVersion,fingerprint:record.fingerprint.value,versions:[record.intent.executionPlan.applicationVersion,record.intent.executionPlan.scorerVersion,record.intent.executionPlan.rulesVersion,...[record.intent.executionPlan.d1,record.intent.executionPlan.d2].flatMap(p=>p.mode==='SEMANTIC'?[`${p.promptVersion} / ${p.requestedModel}`]:[])]};
   if(record.status==='FAILED')pharmaceutical.status='TECHNICAL_FAILURE';
   const last=record.attempts.at(-1);
   if(record.status==='COMPLETED'&&last?.status==='COMPLETED'){
    const result=resolvePharmaceuticalEvaluationArtifactV2(last.result,resolve) as PharmaceuticalEvaluationResultV2;
    const score=result.score.result;
    pharmaceutical.status=score.status==='INVALID'?'TECHNICAL_FAILURE':score.status==='NOT_SCORABLE'?'NOT_SCORABLE':score.status==='PROVISIONAL_REVIEW_REQUIRED'?'PROVISIONAL':'AVAILABLE';
    pharmaceutical.score=score.normalizedScore;
    pharmaceutical.evidence=result.d1.adjudications.flatMap(a=>{
     if(a.resolution!=='SEMANTIC')return [];
     const evidence=a.verdict==='CORRECTLY_DEMONSTRATED'?a.supportingEvidenceRefs:a.verdict==='INCORRECT_OR_CONTRADICTED'?a.contradictionEvidenceRefs:a.verdict==='UNCERTAIN'?a.relatedEvidenceRefs:a.evidenceRefs;
     return evidence.map(e=>verified({criterion:a.targetRef,outcome:a.verdict,messageId:e.messageRef,role:e.speaker,excerpt:e.excerpt}));
    });
   }
  }catch{pharmaceutical={...emptyDimension('TECHNICAL_FAILURE'),source:{id:row.evaluation_id,version:'pharmaceutical-evaluation-record/1',fingerprint:resultFingerprint({row,attempts,artifacts})}};}
 }
 return {protocol,pharmaceutical,communication:emptyDimension()};
}
