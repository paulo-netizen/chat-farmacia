import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {teacherNativeProposal} from '@/lib/cases/v2/teacher-native-proposals';
import {teacherDraftTemplate} from '@/lib/cases/v2/teacher-case-draft-templates';
import {buildTeacherNativePackage,teacherNativeIssues} from '@/lib/cases/v2/build-teacher-native-package';
import {validateEvaluatorViewV2} from '@/lib/cases/v2/validate-evaluator-view';
import {resolveSessionPatientClinicalContentV2,resolveSessionEvaluatorClinicalContentV2,resolveSessionSpfaClinicalContentV2} from '@/lib/cases/v2/resolve-session-clinical-content';
import {resolveStudentPublicCaseVersionV2} from '@/lib/cases/v2/resolve-student-public-case-version';
import {checkPublicationPackage} from '@/lib/cases/v2/teacher-publication';
const version='casever_90000000-0000-4000-8000-000000000001';
const candidate='casever_90000000-0000-4000-8000-000000000002';
const draft=(id:'lucia'|'maria')=>({caseId:'1',versionId:version,revision:1,status:'TEACHER_DRAFT' as const,templateId:id,fields:teacherNativeProposal(id)});
describe('native teacher authoring, proposals not approval',()=>{
 it.each(['lucia','maria'] as const)('converts actual %s proposal through native validators',id=>{
  const d=draft(id),result=buildTeacherNativePackage(d,candidate);
  expect(result.status).toBe('READY');if(result.status!=='READY')return;
  expect(result.bundle.sourceDraft).toMatchObject({versionId:version,approval:'PENDING'});
  expect(result.bundle.sourceOfTruth.evaluator.rnmAssessments[0].value).toMatchObject({contractVersion:'rnm-assessment/2',status:'not_determinable'});
  expect(result.bundle.teacher.questionnaire).toHaveLength(8);
  const input={caseId:1,caseVersionId:candidate,sourceKind:'TEACHER_AUTHORED',legacyStatus:null,contentFormat:'TEACHER_CASE_BUNDLE_V1',content:result.bundle};
  expect(resolveSessionPatientClinicalContentV2(input).contentFormat).toBe('GENERATED_CASE_BUNDLE_V2');
  expect(resolveSessionEvaluatorClinicalContentV2(input).contentFormat).toBe('GENERATED_CASE_BUNDLE_V2');
  expect(resolveSessionSpfaClinicalContentV2(input).caseVersionId).toBe(candidate);
  const row={id:candidate,case_id:1,source_kind:'TEACHER_AUTHORED',legacy_status:null,content_format:'TEACHER_CASE_BUNDLE_V1',content:result.bundle,status:'PUBLISHED'};
  expect(checkPublicationPackage(row)).toBe(true);
  expect(Object.keys(resolveStudentPublicCaseVersionV2(row).publicCaseData).sort()).toEqual(['edad','nombre','sexo']);
  const changed=structuredClone(input);changed.content.derived.patientRuntime.publicProfile.tratamiento='FAKE';
  expect(()=>resolveSessionPatientClinicalContentV2(changed)).toThrow();
  expect(result.bundle.sourceOfTruth.patientFacts.clinicalContext.clinicalHistory.map(x=>'value' in x?x.value:null)).toEqual(d.fields.facts.map(x=>x.value));
  expect(JSON.stringify(result.bundle.derived.patientRuntime)).not.toContain('correctOptionIds');
  expect(JSON.stringify(result.bundle.derived.patientRuntime)).not.toContain(d.fields.teacherSolution);
  d.fields.facts[0].value='MUTATION';expect(JSON.stringify(result.bundle)).not.toContain('MUTATION');
 });
 it('keeps old drafts unchanged and identifies missing authoring',()=>{
  const d={...draft('lucia'),fields:teacherDraftTemplate('lucia')};
  expect(teacherNativeIssues(d).map(x=>x.field)).toContain('Perfil comunicativo');
  expect(buildTeacherNativePackage(d,candidate).status).toBe('BLOCKED');expect(d.fields.nativeAuthoring).toBeUndefined();
 });
 it('does not change pending referral into a negative',()=>{
  const d=draft('lucia');d.fields.nativeAuthoring!.referral={status:'PENDING',decision:'Revisar propuesta'};
  expect(buildTeacherNativePackage(d,candidate)).toMatchObject({status:'BLOCKED',missing:expect.arrayContaining([expect.objectContaining({field:'Derivación'})])});
 });
 it('rejects unversioned uncertainty and contradictory RNM classification',()=>{
  const result=buildTeacherNativePackage(draft('lucia'),candidate);if(result.status!=='READY')throw Error('fixture conversion');
  for(const extra of [{contractVersion:undefined},{classification:{taxonomyId:'x',taxonomyVersion:'1',conceptId:'x'}},{medicationRefs:[]}]){
   const evaluator=structuredClone(result.bundle.sourceOfTruth.evaluator);
   Object.assign(evaluator.rnmAssessments[0].value,extra);
   expect(()=>validateEvaluatorViewV2(evaluator,result.bundle.derived.patientRuntime)).toThrow();
  }
 });
});


describe('native conversion boundaries',()=>{
 it('represents omissions as PRM and incidence without inventing an RNM',()=>{
  const result=buildTeacherNativePackage(draft('maria'),candidate);if(result.status!=='READY')throw Error('conversion');
  const e=result.bundle.sourceOfTruth.evaluator;
  expect(e.incidence.assessment.value.status).toBe('present');expect(e.incidence.findings).toHaveLength(1);
  expect(e.incidence.followUpEpisodes).toHaveLength(1);expect(e.carePath.additionalSpfas).toEqual([]);
  expect(e.pharmaceuticalInterventions[0].value.target).toBe('conditions_of_use');
  expect(e.pharmaceuticalInterventions[0].value.addressedConclusionRefs).toEqual([e.prm.findings[0].conclusionId,e.adherence.assessments[0].conclusionId]);
  expect(e.prmRnmRelations).toEqual([]);expect(e.rnmAssessments[0].value.status).toBe('not_determinable');
 });
 it.each(['incidence','prm'] as const)('keeps pending %s separate',field=>{
  const d=draft('maria');if(field==='incidence')d.fields.nativeAuthoring!.clinical!.incidence='PENDING';else d.fields.nativeAuthoring!.clinical!.prm={status:'PENDING'};
  expect(buildTeacherNativePackage(d,candidate).status).toBe('BLOCKED');
 });
 it('requires incidence evidence and rejects nonexistent source refs',()=>{
  const d=draft('maria');delete d.fields.nativeAuthoring!.clinical!.incidenceEvidence;
  expect(buildTeacherNativePackage(d,candidate)).toMatchObject({status:'BLOCKED'});
  const other=draft('lucia');other.fields.nativeAuthoring!.clinical!.medication.sourceFactRefs=['F999'];
  expect(buildTeacherNativePackage(other,candidate)).toMatchObject({status:'BLOCKED'});
 });
 it('does not intervene on an unknown problem',()=>{
  const d=draft('lucia');d.fields.nativeAuthoring!.clinical!.intervention={target:'treatment',addresses:['prm']};
  expect(buildTeacherNativePackage(d,candidate)).toMatchObject({status:'BLOCKED'});
 });
 it('requires typed requirements and gradable questions instead of defaults',()=>{
  const d=draft('lucia');delete d.fields.requirements[0].native;delete d.fields.questionnaire[0].gradable;
  expect(teacherNativeIssues(d).map(x=>x.field)).toEqual(expect.arrayContaining(['Requisito 1','Pregunta 1']));
 });
 it('preserves every disclosure condition and explicitly proposed profile',()=>{
  const d=draft('maria'),r=buildTeacherNativePackage(d,candidate);if(r.status!=='READY')throw Error('conversion');
  const facts=r.bundle.sourceOfTruth.patientFacts.clinicalContext.clinicalHistory;
  expect(facts.map(x=>'disclosure' in x?x.disclosure.authoringCondition?.condition:null)).toEqual(d.fields.facts.map(x=>x.disclosure));
  expect(r.bundle.derived.patientRuntime.communicationProfile).toEqual(d.fields.nativeAuthoring!.communicationProfile);
  expect(JSON.stringify(r.bundle.derived.patientRuntime)).not.toContain('not_defined');
 });
 it('does not leak invalid clinical values through conversion diagnostics',()=>{
  const d=draft('maria');d.fields.nativeAuthoring!.clinical!.medication.sourceFactRefs=['F999'];d.fields.teacherSolution='SECRET_CLINICAL_SENTINEL';
  const r=buildTeacherNativePackage(d,candidate);expect(r.status).toBe('BLOCKED');expect(JSON.stringify(r)).not.toContain('SECRET_CLINICAL_SENTINEL');
 });
});
