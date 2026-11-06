import {describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {teacherApprovedFramework} from '@/lib/cases/v2/teacher-approved-framework';
vi.mock('server-only',()=>({}));
import {buildTeacherNativePackage} from '@/lib/cases/v2/build-teacher-native-package';
import {teacherNativeProposal} from '@/lib/cases/v2/teacher-native-proposals';
import {auditDimensions,digest,sourceCatalog,type SourceEvidence} from '@/lib/cases/v2/teacher-academic-preparation';
import {AUDITOR_VERSION,AUDITOR_WIRE,auditorRequest,runClinicalAuditor,parseClinicalJudgment,AuditorReferenceError} from '@/lib/cases/v2/teacher-clinical-auditor';
import {nativeAuditInput,nativeAuditBinding,nativeAuditStatus,validateNativeAuditResult,nativeAuditSources} from '@/lib/cases/v2/teacher-native-audit';
import {syntheticSources,syntheticResult} from './support/teacher-native-audit-fixture';
const id='casever_90000000-0000-4000-8000-000000000002';
function fixture(){const r=buildTeacherNativePackage({caseId:'1',versionId:'casever_90000000-0000-4000-8000-000000000001',revision:1,templateId:'lucia',status:'TEACHER_DRAFT',fields:teacherNativeProposal('lucia')},id);if(r.status!=='READY')throw Error('fixture');return nativeAuditInput(r.bundle,id,'b'.repeat(64));}
describe('direct native audit bindings, no provider calls',()=>{
 it.each(['lucia','maria'] as const)('resolves every provider reference against the exact supplied %s package',template=>{
  const built=buildTeacherNativePackage({caseId:'1',versionId:'casever_90000000-0000-4000-8000-000000000001',revision:1,templateId:template,status:'TEACHER_DRAFT',fields:teacherApprovedFramework(template)},id);
  if(built.status!=='READY')throw Error('fixture');
  const p=nativeAuditInput(built.bundle,id,'b'.repeat(64),2),source=syntheticSources[0],body=auditorRequest(p,[source]),data=JSON.parse(body.input);
  const raw={dimensions:auditDimensions.map(id=>({id,status:'INSUFFICIENT',reason:'Synthetic compatibility only; no clinical acceptance.',factRefs:[data.eligibleFactIds[0]],sourceKeys:[source.key],proposal:'Revisar soporte.'}))};
  const Ajv=createRequire(import.meta.url)('ajv'),validate=new Ajv({strict:false}).compile(body.text.format.schema);
  expect(validate(raw)).toBe(true);expect(parseClinicalJudgment(raw,p,[source])).toEqual(raw);
  raw.dimensions[0].factRefs=['UNKNOWN'];expect(validate(raw)).toBe(false);expect(()=>parseClinicalJudgment(raw,p,[source])).toThrow('AUDITOR_REFERENCE_INVALID');
 });
 it('versions eligible provider references without changing historical projection',()=>{
  const old=fixture();if(!('bundle'in old))throw Error('fixture');
  const previous=auditorRequest(old,syntheticSources),next=nativeAuditInput(old.bundle,id,old.contentHash,2),request=auditorRequest(next,syntheticSources);
  const data=JSON.parse(request.input),properties=request.text.format.schema.properties.dimensions.items.properties;
  expect(data.eligibleFactIds).toEqual(old.bundle.teacher.authoring.facts.map(f=>f.id));
  expect(properties.factRefs.items).toMatchObject({enum:data.eligibleFactIds});
  expect(properties.sourceKeys.items).toMatchObject({enum:syntheticSources.map(s=>s.key)});
  expect(auditorRequest(old,syntheticSources)).toEqual(previous);expect(request).not.toEqual(previous);
  expect(nativeAuditBinding(next,syntheticSources).configuration).toMatchObject({inputVersion:2});
 });
 it('reports independent reference categories without received values',()=>{
  const p=fixture(),j=syntheticResult(p,syntheticSources).judgment;
  j.dimensions[0].factRefs=['PRIVATE_SECRET'];j.dimensions[1].sourceKeys=['enalapril20'];
  try{parseClinicalJudgment(j,p,syntheticSources);throw Error('expected rejection');}catch(e){expect(e).toBeInstanceOf(AuditorReferenceError);expect((e as AuditorReferenceError).issues.map(i=>i.code)).toEqual(['FACT_REFERENCE_UNKNOWN','SOURCE_REFERENCE_UNAVAILABLE']);expect(JSON.stringify(e)).not.toContain('PRIVATE_SECRET');}
 });
 it('uses the full canonical package, not the old dossier',()=>{const p=fixture(),b=nativeAuditBinding(p,syntheticSources),body=auditorRequest(p,b.sources);expect(body.input).toContain('teacher-case-bundle/1');expect(body.input).toContain('correctOptionIds');expect(body.input).not.toContain('teacher-academic-preparation/1');expect(body.instructions).toContain('propuestas');expect(b.requestHash).toBe(digest(body));});
 it('detaches snapshots and is stable through JSONB key order',()=>{const p=fixture(),b=nativeAuditBinding(p,syntheticSources);const reverse=Object.fromEntries(Object.entries(syntheticSources[0]).reverse());expect(nativeAuditBinding(p,[reverse as SourceEvidence])).toEqual(b);syntheticSources[0].excerpt='later';expect(b.sources[0].excerpt).toBeUndefined();delete syntheticSources[0].excerpt;});
 it.each(['PASS','WARNING','FAIL','INSUFFICIENT'] as const)('maps %s without academic defaults',status=>{const p=fixture(),r=validateNativeAuditResult(syntheticResult(p,syntheticSources,status),p,syntheticSources);expect(nativeAuditStatus(r,syntheticSources)).toBe(status==='INSUFFICIENT'?'PENDING':status);});
 it('does not treat missing or inaccessible sources as passed',()=>{const p=fixture(),r=syntheticResult(p,syntheticSources);expect(nativeAuditStatus(r,[])).toBe('PENDING');expect(nativeAuditStatus(r,[{...syntheticSources[0],status:'UNAVAILABLE'}])).toBe('PENDING');});
 it('keeps truncated source coverage pending even when an auditor reports PASS',()=>{const p=fixture(),r=syntheticResult(p,syntheticSources);expect(nativeAuditStatus(r,[{...syntheticSources[0],truncated:true}])).toBe('PENDING');});
 it('rejects unknown URLs, missing content and duplicate sources',()=>{expect(()=>nativeAuditSources([{...syntheticSources[0],url:'https://invalid.test/'}])).toThrow();expect(()=>nativeAuditSources([{...syntheticSources[0],clinicalText:undefined}])).toThrow();expect(()=>nativeAuditSources([...syntheticSources,...syntheticSources])).toThrow();});
 it('rejects request mismatch, missing criteria, fake facts and raw fields',()=>{const p=fixture();for(const change of [(r:any)=>r.requestHash='f'.repeat(64),(r:any)=>r.judgment.dimensions.pop(),(r:any)=>r.judgment.dimensions[0].factRefs=['F999'],(r:any)=>r.raw='SECRET']){const r=syntheticResult(p,syntheticSources);change(r);expect(()=>validateNativeAuditResult(r,p,syntheticSources)).toThrow();}});
 it('cannot invoke the real auditor without a specific private authorization',async()=>{const send=vi.fn();await expect(runClinicalAuditor(fixture(),syntheticSources,{directory:'unused',fetcher:send})).rejects.toThrow('AUDITOR_NOT_AUTHORIZED');expect(send).not.toHaveBeenCalled();});
});
