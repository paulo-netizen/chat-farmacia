import {communicationRubric,communicationInstructions,validateCommunication,communicationDimension,CommunicationError,type CommunicationInput} from './communication-evaluation';
import {academicFramework} from './academic-framework';
import {resultFingerprint} from './session-results';

const descriptors=[
 ['Inicio brusco o sin espacio','Saludo sin apertura','Acoge e invita','Adapta apertura y acuerda inicio'],
 ['Confusas, sesgadas o acumuladas','Alternancia poco útil','Abre y concreta claramente','Aclara flexiblemente sin inducir'],
 ['Ignora o repite mecánicamente','Reconoce sin utilizar','Utiliza información anterior y aclara','Integra y comprueba interpretaciones'],
 ['Minimiza preocupación expresada','Reconocimiento superficial','Reconoce preocupación concreta','Explora significado sin atribuir emociones'],
 ['Culpa o etiqueta','Formulación valorativa ocasional','Pregunta sin reproche','Facilita explicar dificultades respetuosamente'],
 ['Jerga no explicada','Accesibilidad parcial','Claridad y comprobación pertinente','Adapta a comprensión expresada'],
 ['Impone o ignora autonomía','Invitación poco concreta','Espacio a preferencias y dudas','Delibera y respeta decisiones o rechazo'],
 ['Ausencia con oportunidad o distorsión','Síntesis fragmentaria','Recoge puntos relevantes','Prioriza y permite corregir'],
 ['Corte sin cierre pese a oportunidad','Despedida sin resolver dudas','Cierre y oferta de dudas','Confirma cierre compartido contextual'],
];
export const communicationRubricV2={...structuredClone(communicationRubric),version:'communication-rubric/2',
 criteria:communicationRubric.criteria.map((c,i)=>({...c,levelDescriptors:descriptors[i]})),
 approval:'APPROVED_FOR_VALIDATION',approvalReference:academicFramework.approvalReference,
 scoring:{version:'communication-scoring/2',minimumObservableWeight:80,decimals:1,exclude:'JUSTIFIED_NO_OPPORTUNITY_ONLY'}} as const;
export const communicationInstructionsV2=communicationInstructions.replace('communication-instructions/1','communication-instructions/2')+`
La omisión de una conducta por el estudiante NO es falta de oportunidad: con entrevista completa
y oportunidad, registra OBSERVED nivel 0 y ausencia justificada. NO_OPPORTUNITY exige explicar
qué condición contextual no se dio, no solo que el estudiante no realizó la conducta.
Una captura incompleta o incertidumbre mantiene pendiente el total. No decidas la puntuación.
La rúbrica está aprobada para validación; esto no acredita calidad semántica ni uso académico.`;

/** Reuse all historical citation/role/binding checks. Never reinterpret result/1 in place. */
export function validateCommunicationV2(input:CommunicationInput,raw:unknown){
 const checked=validateCommunication(input,raw);
 const coverage=checked.judgments.filter(j=>j.state==='OBSERVED').reduce((s,j)=>s+communicationRubricV2.criteria.find(c=>c.id===j.criterion)!.weight,0);
 const pending=checked.judgments.some(j=>!['OBSERVED','NO_OPPORTUNITY'].includes(j.state)||j.certainty!=='HIGH');
 const weightedLevels=checked.judgments.reduce((s,j)=>s+(j.state==='OBSERVED'?j.level!*communicationRubricV2.criteria.find(c=>c.id===j.criterion)!.weight:0),0);
 const score=!pending&&coverage>=communicationRubricV2.scoring.minimumObservableWeight?Math.round(weightedLevels*1000/(3*coverage))/10:null;
 return {...checked,version:'communication-result/2' as const,rubricVersion:communicationRubricV2.version,
  instructionsVersion:'communication-instructions/2',policyVersion:'communication-scoring/2',coverage,
  score,academicApproved:false as const,semanticAcceptance:'PENDING' as const};
}
export type CommunicationRuntimeV2={mode:'SIMULATED'|'REAL';id:string;adjudicate:(input:{instructions:string;rubric:typeof communicationRubricV2;transcript:CommunicationInput['transcript'];capture:CommunicationInput['capture']})=>Promise<unknown>};
export async function evaluateCommunicationV2(input:CommunicationInput,runtime:CommunicationRuntimeV2){
 const frozen=structuredClone(input);
 if(!['PROPOSAL','SYNTHETIC_TEST'].includes(frozen.scope)||!runtime.id.trim())throw new CommunicationError('CONFIGURATION_BLOCKED');
 // Validate the transcript before any transport; the real adapter must also enforce its authorization.
 const {validateSessionTranscriptSnapshotV2}=await import('./spfa-session-transcript');
 try{frozen.transcript=validateSessionTranscriptSnapshotV2(frozen.transcript);}catch{throw new CommunicationError('BINDING_INVALID');}
 let raw:unknown;
 try{raw=await runtime.adjudicate({instructions:communicationInstructionsV2,rubric:structuredClone(communicationRubricV2),transcript:structuredClone(frozen.transcript),capture:frozen.capture});}
 catch(e){if(e instanceof CommunicationError)throw e;throw new CommunicationError('RUNTIME_FAILURE');}
 return validateCommunicationV2(frozen,raw);
}
export function communicationDimensionV2(input:CommunicationInput,raw:unknown,runtimeId:string){
 const result=validateCommunicationV2(input,raw),base=communicationDimension(input,raw,runtimeId);
 return {...base,score:result.score,coverage:result.coverage,source:{...base.source!,version:result.version,
 versions:[result.rubricVersion,result.instructionsVersion,result.policyVersion,runtimeId],
 fingerprint:resultFingerprint({input,raw,runtimeId,configuration:communicationRubricV2})}};
}
