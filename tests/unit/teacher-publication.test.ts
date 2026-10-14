import { describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { checkPublicationPackage, publicationActionSchema } from '@/lib/cases/v2/teacher-publication';
import { publicationFixture } from './support/teacher-publication-fixture';
import { projectTeacherPatient,teacherPatientRules,TEACHER_PATIENT_RULES } from '@/lib/cases/v2/teacher-patient-projection';
import { teacherDraftTemplate } from '@/lib/cases/v2/teacher-case-draft-templates';
import { buildPatientChatSystemPromptV3 } from '@/lib/cases/v2/patient-chat-prompt';
import { buildOpenAiPatientResponseValidatorParamsV2 } from '@/lib/cases/v2/build-openai-patient-response-validator-params';
const id='casever_90000000-0000-4000-8000-000000000001';
const row=()=>({case_id:1,id,source_kind:'AI_GENERATED',legacy_status:null,content_format:'GENERATED_CASE_BUNDLE_V2',content:publicationFixture(id)});
describe('editorial structural boundary',()=>{
 it('accepts a complete synthetic canonical package through all existing resolvers',()=>expect(checkPublicationPackage(row())).toBe(true));
 it.each(['patientFacts','evaluator','spfaProtocolSet'])('rejects missing %s, without filling it',key=>{const r=row();delete r.content.sourceOfTruth[key];expect(checkPublicationPackage(r)).toBe(false);});
 it('rejects stale derivation, identity mismatch and hard compliance failure',()=>{
  const r=row();r.content.derived.patientRuntime.caseVersionId='casever_90000000-0000-4000-8000-000000000099';expect(checkPublicationPackage(r)).toBe(false);
  const f=row();f.content.derived.complianceReport.hasHardFailures=true;expect(checkPublicationPackage(f)).toBe(false);
 });
 it('requires every human confirmation and refuses client audit claims',()=>{
  const input={action:'validate',expectedDraftVersionId:id,candidateVersionId:id};expect(publicationActionSchema.safeParse(input).success).toBe(false);
  const review={clinical:true,solution:true,criteria:true,questionnaire:true,correspondence:true,warnings:true,note:'Revisión sintética, no clínica.'};
  expect(publicationActionSchema.safeParse({...input,review}).success).toBe(true);
  for(const k of ['clinical','solution','criteria','questionnaire','correspondence','warnings'])expect(publicationActionSchema.safeParse({...input,review:{...review,[k]:false}}).success).toBe(false);
  expect(publicationActionSchema.safeParse({...input,review,audit:'PASS'}).success).toBe(false);
 });
});
describe('versioned missing preference policy: structural regression, not semantic acceptance',()=>{
 it('sends the same /2 distinction to generation and validation, preserves /1',()=>{
  const p=projectTeacherPatient({caseId:'1',versionId:id,revision:1,status:'TEACHER_DRAFT',templateId:'maria',fields:teacherDraftTemplate('maria')});
  expect(p.projectionVersion).toBe('teacher-patient/2');
  const rules=teacherPatientRules(p);expect(rules).toContain('Una evasiva no autoriza inventar');expect(rules).toContain('UNSUPPORTED_FACT');expect(rules).toContain('preferencia expresamente definida');
  expect(buildPatientChatSystemPromptV3(p)).toContain(rules);
  const params=buildOpenAiPatientResponseValidatorParamsV2({validationContext:p,acceptedConversation:[],currentStudentTurn:'Pregunta sintética',candidate:'Prefiero no hablar de eso',contractVersion:'synthetic',safetyPolicyVersion:'synthetic'} as any);
  expect(params.instructions).toContain(rules);expect(params.input).toContain('Prefiero no hablar');
  const old={...p,projectionVersion:'teacher-patient/1' as const};expect(teacherPatientRules(old)).toBe(TEACHER_PATIENT_RULES);expect(buildPatientChatSystemPromptV3(old)).not.toContain('PREFERENCIAS Y EVASIVAS');
  expect(JSON.stringify(p.facts)).not.toContain('Prefiero no hablar');
 });
});
