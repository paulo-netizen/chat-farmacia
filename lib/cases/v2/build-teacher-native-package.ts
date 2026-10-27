import { createHash } from 'node:crypto';
import { teacherDraftFieldsSchema, SPFA_2026_REFERENCE, caseVersionIdSchema, templateIdSchema, type TeacherDraftRecord } from './teacher-case-draft';
import { z } from 'zod';
import { validateCasePatientFactsDraftV2, validateCaseVersionId } from './validate-patient-facts';
import { createPatientRuntimeViewV2 } from './patient-runtime';
import { validateEvaluatorViewV2 } from './validate-evaluator-view';
import { attachSpfaProtocolSetToGeneratedCaseCoreV2 } from './attach-spfa-protocol-set';

export const TEACHER_NATIVE_FORMAT='TEACHER_CASE_BUNDLE_V1' as const;
const sourceSchema=z.object({versionId:caseVersionIdSchema,revision:z.number().int().positive(),templateId:templateIdSchema,approval:z.literal('PENDING')}).strict();
function canonical(value:unknown):string {
 if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;
 if(value!==null&&typeof value==='object')return `{${Object.entries(value).filter(([,v])=>v!==undefined).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
 return JSON.stringify(value);
}
export function validateTeacherNativePackage(input:unknown,candidateVersionId:string) {
 const envelope=z.object({schemaVersion:z.literal('teacher-case-bundle/1'),sourceDraft:sourceSchema,sourceOfTruth:z.unknown(),derived:z.unknown(),teacher:z.object({authoring:teacherDraftFieldsSchema}).passthrough()}).strict().parse(input);
 const source=envelope.sourceDraft;
 const rebuilt=buildTeacherNativePackage({caseId:'1',versionId:source.versionId,revision:source.revision,templateId:source.templateId,status:'TEACHER_DRAFT',fields:envelope.teacher.authoring},candidateVersionId);
 if(rebuilt.status!=='READY'||canonical(rebuilt.bundle)!==canonical(input))throw Error('NATIVE_PACKAGE_MISMATCH');
 return rebuilt.bundle;
}
export type NativeIssue={code:string;field:string;decision:string};
const issue=(field:string,decision:string):NativeIssue=>({code:'AUTHORING_INCOMPLETE',field,decision});
/** Deterministic identifiers are scoped to the immutable candidate; never parse clinical prose. */
function allocator(version:string) {
 return (kind:string,key:string)=>{
  const h=createHash('sha256').update(`${version}:${kind}:${key}`).digest('hex');
  return `${kind}_${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
 };
}
export function teacherNativeIssues(draft:TeacherDraftRecord):NativeIssue[] {
 const f=teacherDraftFieldsSchema.parse(draft.fields), a=f.nativeAuthoring, problems:NativeIssue[]=[];
 if(!a?.communicationProfile||!a.profileRationale)problems.push(issue('Perfil comunicativo','Completa el perfil explícito y su justificación como propuesta de representación.'));
 if(!a?.rnm)problems.push(issue('RNM','Explica por qué el resultado no es determinable y relaciona su evidencia.'));
 if(!a?.clinical)problems.push(issue('Mapeo clínico','Completa destinatario, medicación, incidencia, PRM e intervención.'));
 else {
  if(a.clinical.incidence==='PENDING')problems.push(issue('Incidencia','Resuelve la evaluación de incidencia; pendiente no significa ausencia.'));
  if(a.clinical.incidence==='present'&&!a.clinical.incidenceEvidence)problems.push(issue('Incidencia · evidencia','Describe la incidencia y selecciona sus hechos de soporte.'));
  if(a.clinical.intervention?.addresses.some(x=>x==='prm'?a.clinical!.prm.status!=='present':f.adherence.conclusion!=='NON_ADHERENT'))problems.push(issue('Intervención · objetivos','Selecciona únicamente problemas o falta de adherencia identificados.'));
  if(a.clinical.prm.status==='PENDING')problems.push(issue('PRM','Completa la clasificación propuesta y su soporte.'));
  if(f.service==='DISPENSATION'&&!a.clinical.dispensingSubtype)problems.push(issue('Tipo de dispensación','Indica inicio o continuación.'));
  if(f.adherence.conclusion==='NON_ADHERENT'&&!a.clinical.nonAdherence)problems.push(issue('Falta de adherencia','Completa tipo, barrera y estrategia propuestos.'));
 }
 if(!a?.referral||a.referral.status==='PENDING')problems.push(issue('Derivación','Completa decisión, criterios de nueva consulta y fuente; pendiente no significa no derivar.'));
 if(a?.referral?.status==='required'&&((a.referral.report==='not_required')!==(a.referral.reportContents.length===0)))problems.push(issue('Informe de derivación','Relaciona la exigencia de informe con sus contenidos.'));
 f.requirements.forEach((r,i)=>{if(!r.native||r.applicability==='UNDETERMINED')problems.push(issue(`Requisito ${i+1}`,'Completa tipo, dominio y aplicabilidad.'));});
 f.questionnaire.forEach((q,i)=>{if(q.review?.status==='PENDING_CLINICAL_DECISION')problems.push(issue(`Pregunta ${i+1}`,q.review.reason));if(!q.gradable||!q.factRefs.length)problems.push(issue(`Pregunta ${i+1}`,'Completa opciones, clave, justificación y hechos de soporte.'));});
 return problems;
}

export class TeacherNativeConversionError extends Error {
 constructor(public readonly field:string){super('NATIVE_VALIDATION_FAILED');}
}
export function buildTeacherNativePackage(draft:TeacherDraftRecord,candidateVersionId:string) {
 try{return convert(draft,candidateVersionId);}catch(error){
  if(error instanceof z.ZodError)throw error;
  const path=error&&typeof error==='object'&&'path' in error?String(error.path):'';
  const fields:Record<string,string>={communicationProfile:'Perfil comunicativo',prm:'PRM',rnmAssessments:'RNM',adherence:'Adherencia',referral:'Derivación',professionalActions:'Actuación',evidenceRules:'Evidencias',clinicalContext:'Hechos clínicos',pharmacotherapy:'Medicación',caseSpfaProtocolSet:'Protocolo y requisitos',encounter:'Destinatario'};
  const key=path.split(/[.\[]/)[0];
  throw new TeacherNativeConversionError(fields[key]??'Paquete nativo: relaciones y referencias');
 }
}
function convert(draft:TeacherDraftRecord,candidateVersionId:string) {
 const f=teacherDraftFieldsSchema.parse(draft.fields),missing=teacherNativeIssues({...draft,fields:f});
 if(missing.length)return {status:'BLOCKED' as const,missing};
 const a=f.nativeAuthoring!,clinical=a.clinical!,prm=clinical.prm,referral=a.referral!;
 if(prm.status==='PENDING'||referral.status==='PENDING')throw Error('AUTHORING_INCOMPLETE');
 const version=validateCaseVersionId(candidateVersionId),id=allocator(version);
 const known=(key:string,value:string,condition:string,domain='clinical_history')=>({state:'known',factId:id('fact',key),value,certainty:'exact',disclosure:{mode:'specific_question',domains:[domain],authoringCondition:{contractVersion:'teacher-disclosure/1',condition}}});
 const factRefs=new Set(f.facts.map(x=>x.id));
 const groups=[clinical.medication.sourceFactRefs,clinical.action.factRefs,prm.factRefs,[clinical.encounterFactRef],clinical.nonAdherence?.factRefs??[],clinical.incidenceEvidence?.factRefs??[]];
 if(groups.some(g=>g.some(r=>!factRefs.has(r))))return {status:'BLOCKED' as const,missing:[issue('Mapeo clínico · referencias','Selecciona hechos existentes del borrador.')]};
 const med=id('med','medication');
 const patientFacts=validateCasePatientFactsDraftV2({
  schemaVersion:'2.0',caseVersionId:version,publicProfile:{...f.identity,tratamiento:f.treatment},
  initialDemand:{...known('initialDemand',f.initialDemand,'Al comenzar.','initial_demand'),disclosure:{mode:'spontaneous'}},
  encounter:{personPresent:known('encounter','patient',f.facts.find(x=>x.id===clinical.encounterFactRef)!.disclosure,'patient_identity'),relationshipToPatient:{state:'not_applicable',reasonCode:'not_applicable_to_patient'}},
  // Unmapped dimensions remain not-defined/empty, never explicit absence.
  clinicalContext:{healthProblems:[],clinicalHistory:f.facts.map(x=>known(x.id,x.value,x.disclosure)),physiologicalSituation:[],pregnancyAndLactation:{state:'not_defined',contractVersion:'authoring-unknown/1'},allergiesAndIntolerances:[],lifestyle:[],biomedicalData:[]},
  symptoms:[],pharmacotherapy:{prescribedMedications:[{
   medicationId:med,displayName:known('med-name',clinical.medication.name,'Al preguntar por el tratamiento.','medication_identity'),
   origin:known('med-origin','prescribed','Al preguntar por la prescripción.','prescribed_medication_use'),
   purposeAsUnderstood:{state:'not_defined',contractVersion:'authoring-unknown/1'},regimenBasis:known('med-basis','prescription','Al preguntar por la pauta prescrita.','prescribed_medication_use'),
   referenceDose:known('med-dose',clinical.medication.dose,'Al preguntar por la dosis.','prescribed_medication_use'),
   referenceSchedule:known('med-schedule',clinical.medication.schedule,'Al preguntar por la pauta.','prescribed_medication_use'),
   referenceDuration:{state:'not_defined',contractVersion:'authoring-unknown/1'},administrationMethod:known('med-route',clinical.medication.administration,'Al preguntar por cómo lo utiliza.','administration_technique'),specialUseConditions:[],
  }],otherMedicinesAndProducts:[],actualMedicationUse:[],recentChanges:[],perceivedEffectiveness:[],perceivedSafety:[]},
  actionsAlreadyTaken:[],practicalDifficulties:[],beliefsAndConcerns:[],strategiesAlreadyTried:[],dailyAndSocialContext:[],familyAndSocialSupport:[],relationshipWithProfessionals:[],communicationProfile:a.communicationProfile,
 });
 const runtime=createPatientRuntimeViewV2(patientFacts);
 const c=(key:string)=>id('conclusion',key), conclusion=(key:string,kind:string,value:unknown)=>({conclusionId:c(key),kind,value});
 const rules:unknown[]=[];
 const evidence=(key:string,refs:readonly string[],rationale:string)=>rules.push({conclusionRef:c(key),requiredEvidence:{operator:'all',operands:refs.map(r=>({operator:'fact',factRef:id('fact',r)}))},supportingEvidenceRefs:[],counterEvidenceRefs:[],teacherRationale:rationale});
 evidence('incidence',clinical.incidenceEvidence?.factRefs??[clinical.encounterFactRef],clinical.incidenceEvidence?.description??f.teacherSolution);
 if(clinical.incidence==='present'){evidence('incidence-finding',clinical.incidenceEvidence!.factRefs,clinical.incidenceEvidence!.description);}
 if(clinical.intervention)evidence('intervention',clinical.action.factRefs,clinical.action.description);evidence('prm',prm.factRefs,prm.reason);evidence('rnm',a.rnm!.factRefs,a.rnm!.reason);evidence('referral',referral.factRefs,referral.reason);evidence('action',clinical.action.factRefs,clinical.action.description);
 if(prm.status==='present')evidence('prm-finding',prm.factRefs,prm.reason);
 const adherence={assessments:[] as unknown[],typeConclusions:[] as unknown[],patientProfiles:[],barrierAssessments:[] as unknown[],barriers:[] as unknown[],strategies:[] as unknown[]};
 if(f.adherence.conclusion!=='NOT_APPLICABLE'){
  adherence.assessments.push(conclusion('adherence','adherence_assessment',{medicationRefs:[med],status:f.adherence.conclusion==='NON_ADHERENT'?'non_adherent':'not_determinable'}));evidence('adherence',f.adherence.factRefs,f.adherence.interpretation);
  if(f.adherence.conclusion==='NON_ADHERENT'){
   const n=clinical.nonAdherence!;
   adherence.typeConclusions.push(conclusion('type','non_adherence_type',{adherenceAssessmentRef:c('adherence'),...(n.type==='not_determinable'?{status:n.type}:{status:'determined',type:n.type})}));
   adherence.barrierAssessments.push(conclusion('barrier-assessment','adherence_barrier_assessment',{adherenceAssessmentRef:c('adherence'),status:n.barrier==='not_determinable'?'not_determinable':'identified'}));
   evidence('type',n.factRefs,n.rationale);evidence('barrier-assessment',n.factRefs,n.rationale);
   if(n.barrier!=='not_determinable'){
    adherence.barriers.push(conclusion('barrier','adherence_barrier',{barrierAssessmentRef:c('barrier-assessment'),role:'primary',category:n.barrier}));evidence('barrier',n.factRefs,n.rationale);
    adherence.strategies.push(conclusion('strategy','adherence_strategy',{adherenceAssessmentRef:c('adherence'),addressedBarrierRefs:[c('barrier')],category:n.strategy}));evidence('strategy',n.factRefs,n.rationale);
   }
  }
 }
 const evaluator=validateEvaluatorViewV2({schemaVersion:'2.0',caseVersionId:version,
  versions:{evaluatorSchema:{id:'evaluator-v2',version:'2.0'},protocol:{id:'foro-af-fc',version:SPFA_2026_REFERENCE.protocolVersion},prmTaxonomy:{id:prm.status==='present'?prm.taxonomyId:'foro-prm',version:prm.status==='present'?prm.taxonomyVersion:'2026'},rnmTaxonomy:{id:'foro-rnm',version:'2026'},adherenceFramework:{id:'foro-adherence',version:'2026'}},
  carePath:{initialSpfa:conclusion('spfa','spfa',{service:f.service==='INDICATION'?'pharmaceutical_indication':'dispensing',...(f.service==='DISPENSATION'?{subtype:clinical.dispensingSubtype}:{})}),additionalSpfas:[],transitions:[]},
  incidence:{assessment:conclusion('incidence','incidence_assessment',{status:clinical.incidence}),findings:clinical.incidence==='present'?[conclusion('incidence-finding','incidence',{spfaRef:c('spfa'),medicationRefs:[med],semanticMeaning:clinical.incidenceEvidence!.description})]:[],followUpEpisodes:clinical.incidence==='present'?[conclusion('episode','follow_up_episode',{incidenceRef:c('incidence-finding')})]:[]},
  prm:{assessment:conclusion('prm','prm_assessment',{status:prm.status}),findings:prm.status==='present'?[conclusion('prm-finding','prm',{classification:{taxonomyId:prm.taxonomyId,taxonomyVersion:prm.taxonomyVersion,conceptId:prm.conceptId},medicationRefs:[med]})]:[]},
  rnmAssessments:[conclusion('rnm','rnm_assessment',{contractVersion:'rnm-assessment/2',status:'not_determinable',reason:a.rnm!.reason})],prmRnmRelations:[],adherence,
  professionalActions:[conclusion('action','professional_action',{spfaRef:c('spfa'),category:clinical.action.category,...(clinical.action.category==='referral'?{referralRef:c('referral')}:{})})],pharmaceuticalInterventions:clinical.intervention?[conclusion('intervention','pharmaceutical_intervention',{spfaRef:c('spfa'),professionalActionRef:c('action'),target:clinical.intervention.target,addressedConclusionRefs:clinical.intervention.addresses.map(x=>c(x==='prm'?'prm-finding':'adherence'))})]:[],
  referral:conclusion('referral','referral',referral.status==='not_required'?{status:'not_required'}:{status:'required',urgency:referral.urgency,destination:{label:referral.destination},reason:referral.reason,report:{status:referral.report,essentialContents:referral.reportContents}}),evidenceRules:rules,
 },runtime);
 const protocol=id('spfa_protocol','protocol');
 const definitions=f.requirements.map((r,i)=>{const n=r.native!;return {kind:n.kind,requirementId:id('spfa_requirement',String(i)),semanticDomain:n.kind==='ACTION_REQUIREMENT'?n.domain:{kind:n.domain==='referral_criteria'?'protocol_information':'patient_information',...(n.domain==='referral_criteria'?{domain:n.domain}:{disclosureDomain:n.domain})},teacherLabel:r.label,description:r.rationale,defaultImportance:n.importance,[n.kind==='ACTION_REQUIREMENT'?'actionGoal':'informationGoal']:r.goal,safetyCriticality:{safetyCritical:n.safetyCritical},applicability:r.applicability==='APPLICABLE'?{kind:'ALWAYS'}:{kind:'CASE_DETERMINED',policyRef:id('spfa_policy',String(i))}};});
 const requirements=f.requirements.map((r,i)=>{const n=r.native!;return {kind:n.kind,requirementRef:id('spfa_requirement',String(i)),applicability:r.applicability==='APPLICABLE'?{status:'APPLICABLE',effectiveImportance:n.importance}:{status:'NOT_APPLICABLE',reason:{kind:'CASE_DETERMINED',policyRef:id('spfa_policy',String(i))}},[n.kind==='ACTION_REQUIREMENT'?'actionTargets':'informationTargets']:r.applicability!=='APPLICABLE'?[]:n.kind==='ACTION_REQUIREMENT'?[{targetId:id('spfa_target',`${i}:action`),target:{kind:'EVALUATOR_CONCLUSION',conclusionRef:c(n.domain==='referral_action'||n.domain==='report_action'?'referral':'action')}}]:r.factRefs.map((r,j)=>({targetId:id('spfa_target',`${i}:${j}`),target:{kind:'FACT',factRef:id('fact',r)}}))};});
 const core=attachSpfaProtocolSetToGeneratedCaseCoreV2({caseVersionId:version,patientFacts,evaluator},{schemaVersion:'2.0',catalogRef:evaluator.versions.protocol,definitions:[{schemaVersion:'2.0',protocolId:protocol,version:'teacher-native-authoring/1',service:evaluator.carePath.initialSpfa.value.service,...(clinical.dispensingSubtype&&f.service==='DISPENSATION'?{subtype:clinical.dispensingSubtype}:{}),requirements:definitions}],applications:[{schemaVersion:'2.0',caseVersionId:version,carePathSpfaRef:c('spfa'),protocolRef:{protocolId:protocol,version:'teacher-native-authoring/1'},requirements}]});
 return {status:'READY' as const,missing:[],bundle:{schemaVersion:'teacher-case-bundle/1',sourceDraft:{versionId:draft.versionId,revision:draft.revision,templateId:draft.templateId,approval:'PENDING'},sourceOfTruth:core,derived:{patientRuntime:runtime},teacher:{solution:f.teacherSolution,referralPolicy:referral,profileRationale:a.profileRationale,questionnaire:f.questionnaire.map(q=>({question:q.question,factRefs:q.factRefs.map(r=>id('fact',r)),...q.gradable!})),authoring:f}}};
}
