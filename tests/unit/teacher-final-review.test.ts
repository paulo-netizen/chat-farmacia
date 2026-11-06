import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {createRequire} from 'node:module';
import {teacherApprovedFramework,teacherFinalReviewFields} from '@/lib/cases/v2/teacher-approved-framework';
import {buildTeacherNativePackage} from '@/lib/cases/v2/build-teacher-native-package';
import {readGuideSource} from '@/lib/cases/v2/teacher-guide-sources';
import {nativeAuditSources,nativeAuditInput,nativeAuditBinding} from '@/lib/cases/v2/teacher-native-audit';
import {auditorRequest,parseClinicalJudgment} from '@/lib/cases/v2/teacher-clinical-auditor';
import {auditDimensions} from '@/lib/cases/v2/teacher-academic-preparation';
describe('final review is a new editorial revision, not case approval',()=>{
 it.each(['lucia','maria'] as const)('preserves %s facts, keys and historical authoring',template=>{
  const before=teacherApprovedFramework(template),f=teacherFinalReviewFields(template);
  expect(f.facts).toEqual(before.facts);expect(f.treatment).toBe(before.treatment);expect(f.identity).toEqual(before.identity);
  expect(f.questionnaire.map(q=>q.gradable!.correctOptionIds)).toEqual(before.questionnaire.map(q=>q.gradable!.correctOptionIds));
  expect(teacherApprovedFramework(template)).toEqual(before);
  if(template==='lucia'){expect(f.questionnaire[5].gradable!.justification).not.toContain('medicamentos');expect(f.questionnaire[5].factRefs).toEqual(before.questionnaire[5].factRefs);}
  else expect(f.teacherSolution).toContain('no como certificación de adecuación individual');
  const id='casever_90000000-0000-4000-8000-000000000002',built=buildTeacherNativePackage({caseId:'1',versionId:'casever_90000000-0000-4000-8000-000000000001',revision:2,templateId:template,status:'TEACHER_DRAFT',fields:f},id);
  expect(built.status).toBe('READY');if(built.status!=='READY')throw Error('fixture');
  const p=nativeAuditInput(built.bundle,id,'b'.repeat(64),3),sources=nativeAuditSources([readGuideSource('sefac2024'),readGuideSource('spfa2026')]),request=auditorRequest(p,sources);
  expect(nativeAuditBinding(p,sources).configuration).toMatchObject({inputVersion:3});
  const data=JSON.parse(request.input),raw={dimensions:auditDimensions.map(id=>({id,status:'INSUFFICIENT',reason:'Synthetic only',factRefs:[data.eligibleFactIds[0]],sourceKeys:['spfa2026'],proposal:'Review'}))};
  const Ajv=createRequire(import.meta.url)('ajv');expect(new Ajv({strict:false}).compile(request.text.format.schema)(raw)).toBe(true);expect(parseClinicalJudgment(raw,p,sources)).toEqual(raw);
 });
 it('rejects changed guide text, provenance, pages and hashes',()=>{
  const detached=readGuideSource('spfa2026');detached.pdfPages.push(999);expect(readGuideSource('spfa2026').pdfPages).not.toContain(999);
  for(const change of [{clinicalText:'SECRET'},{pages:'99'},{sha256:'a'.repeat(64)},{provenance:'unverified'}])expect(()=>nativeAuditSources([{...readGuideSource('sefac2024'),...change}])).toThrow('NATIVE_AUDIT_SOURCE_INVALID');
  expect(readGuideSource('spfa2026')).toMatchObject({scope:'SELECTED_PARAPHRASE',truncated:false,pdfPages:[17,18,21,22,23,24,27,28,41]});
 });
});
