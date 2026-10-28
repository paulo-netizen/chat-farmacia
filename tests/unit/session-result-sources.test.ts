import {describe,it,expect,vi,afterEach} from 'vitest';
import type {PoolClient} from 'pg';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/db',()=>({pool:{}}));
import {recordFixture,worker,beforeEnd} from './support/pharmaceutical-evaluation-record-fixture';
import {completePharmaceuticalEvaluationV2} from '@/lib/cases/v2/pharmaceutical-evaluation-lifecycle';
import {readResultSources} from '@/lib/cases/v2/session-result-sources';
import * as spfaReader from '@/lib/cases/v2/get-owned-spfa-evaluation-status';
afterEach(()=>vi.restoreAllMocks());
async function setup(debt=false){
 const f=await recordFixture({debt}),record=completePharmaceuticalEvaluationV2(f.claimed,worker,beforeEnd,f.resultRef,f.resolve);
 const {attempts,...header}=record;
 const artifacts=[{reference:f.intent.sources,payload:f.sources},{reference:f.resultRef!,payload:f.result!}];
 const query=vi.fn(async(sql:string)=>{
  if(sql.startsWith('SELECT id::text'))return {rows:f.sources.contextSource.transcript.messages.map(m=>({id:m.messageId,role:m.role,content:m.content,created_at:m.createdAt}))};
  if(sql.includes('session_evaluation_records_v2'))return {rows:[]};
  if(sql.includes('FROM pharmaceutical_evaluations_v2'))return {rows:[{evaluation_id:record.evaluationId,header}]};
  if(sql.includes('FROM pharmaceutical_evaluation_attempts_v2'))return {rows:attempts.map(payload=>({payload}))};
  if(sql.includes('FROM pharmaceutical_evaluation_artifacts_v2'))return {rows:artifacts};
  throw Error('unexpected query');
 });
 return {f,record,artifacts,query,c:{query} as unknown as PoolClient,s:{id:record.intent.sessionId,user_id:record.intent.ownerId,case_version_id:record.intent.caseVersionId}};
}
describe('M9 reads real E3 contracts without reexecution',()=>{
 it('uses the persisted result, preserves evidence and bindings, and makes no new semantic calls',async()=>{
  const {f,c,s,query,record}=await setup();const before=[f.d1.adjudicateBatch.mock.calls.length,f.d2.detectClaims.mock.calls.length];
  const r=await readResultSources(c,s);expect(r.pharmaceutical.status).toBe('AVAILABLE');expect(r.pharmaceutical.score).toBe(f.result!.score.result.normalizedScore);expect(r.pharmaceutical.source?.fingerprint).toBe(record.fingerprint.value);expect(r.pharmaceutical.evidence.length).toBeGreaterThan(0);
  expect(await readResultSources(c,s)).toEqual(r);expect([f.d1.adjudicateBatch.mock.calls.length,f.d2.detectClaims.mock.calls.length]).toEqual(before);expect(query.mock.calls.every(([sql])=>sql.startsWith('SELECT'))).toBe(true);
 });
 it('keeps validation debt provisional rather than approving a numeric score',async()=>{const {c,s}=await setup(true);expect((await readResultSources(c,s)).pharmaceutical.status).toBe('PROVISIONAL');});
 it('fails closed on corrupted artifacts and excludes raw/clinical data from the error projection',async()=>{const {c,s,artifacts}=await setup();artifacts[1].payload={secret:'CLINICAL_SECRET'} as any;const r=await readResultSources(c,s);expect(r.pharmaceutical.status).toBe('TECHNICAL_FAILURE');expect(r.pharmaceutical.score).toBeNull();expect(JSON.stringify(r)).not.toContain('CLINICAL_SECRET');});
 it('rejects a different owner or case binding without reassigning sources',async()=>{const {c,s}=await setup();expect((await readResultSources(c,{...s,user_id:'999'})).pharmaceutical.status).toBe('TECHNICAL_FAILURE');});
 it('does not expose protected D2 claims or unselected fields in student feedback',async()=>{const {c,s}=await setup();const r=await readResultSources(c,s);for(const key of ['clinicalReference','patientRuntime','configuration','findingSet','ground_truth'])expect(JSON.stringify(r)).not.toContain(key);});
 it('projects existing SPFA review status and literal evidence, rejecting unsupported excerpts',async()=>{
  const {f,s,query}=await setup(),transcript=f.sources.contextSource.transcript,m=transcript.messages[0];
  const stored={status:'COMPLETED',snapshotIdentity:{protocolCatalogRef:{id:'synthetic-catalog',version:'1'},scoringPolicyRef:{id:'synthetic-policy',version:'1'}},score:{score:40,status:'REVIEW_REQUIRED',needsReview:true},evaluation:{semanticExecutions:[],applications:[{requirementResults:[{kind:'ACTION_REQUIREMENT',requirementRef:'synthetic-requirement',outcome:{status:'PARTIALLY_PERFORMED',evidence:[{source:'TRANSCRIPT_MESSAGE',messageRef:m.messageId,speaker:m.role,excerpt:m.content}]}}]}]}};
  const reader=vi.spyOn(spfaReader,'getOwnedSpfaEvaluationStatusV2').mockResolvedValue(stored as any);
  const c={query:async(sql:string)=>sql.startsWith('SELECT attempt_id')?{rows:[{attempt_id:'synthetic-attempt',transcript_fingerprint_value:transcript.fingerprint.value}]}:query(sql)} as unknown as PoolClient;
  const r=await readResultSources(c,s);expect(r.protocol).toMatchObject({status:'PENDING_REVIEW',score:40});expect(r.protocol.evidence[0].excerpt).toBe(m.content);
  stored.evaluation.applications[0].requirementResults[0].outcome.evidence[0].excerpt='UNSUPPORTED_SECRET';reader.mockResolvedValue(stored as any);
  const invalid=await readResultSources(c,s);expect(invalid.protocol.status).toBe('TECHNICAL_FAILURE');expect(JSON.stringify(invalid.protocol)).not.toContain('UNSUPPORTED_SECRET');
 });
});
