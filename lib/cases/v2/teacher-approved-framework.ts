import {teacherNativeProposal} from './teacher-native-proposals';
import {revisedTeacherQuestionnaire} from './teacher-questionnaire-revision';
import {teacherDraftFieldsSchema,type TeacherDraftTemplateId} from './teacher-case-draft';
import {academicFramework} from './academic-framework';

/** A new authored revision only. Existing saved drafts, approvals and sessions are immutable. */
export function teacherApprovedFramework(template:TeacherDraftTemplateId){
 const f=structuredClone(teacherNativeProposal(template)),native=f.nativeAuthoring!;
 f.questionnaire=revisedTeacherQuestionnaire(template);
 native.profileRationale=`Perfil aprobado como autoría explícita por Paulo (${academicFramework.approvalReference}); no deducido de edad, enfermedad o adherencia. No añade preferencias ni conocimiento fuera de los hechos.`;
 if(template==='lucia'){
  native.referral={...native.referral!,status:'required',urgency:'non_urgent',destination:'Medicina de atención primaria',
   reason:'Decisión docente aprobada: SEFAC 2024 tabla 11, derivación no urgente con los hechos descritos. No acredita diabetes descompensada ni diagnóstico etiológico.',factRefs:['F1','F2','F3','F7'],
   source:'SEFAC, Guía IRA 2024, tabla 11, p. 41. https://www.sefac.org/system/files/2025-04/GUIA%20IRAS.pdf',
   returnCriteria:'Revalorar ante empeoramiento, gran dificultad para tragar o persistencia según SEFAC. Dificultad respiratoria exige atención urgente. No afirmar ausencia de fiebre sin medición.',report:'not_required',reportContents:[]};
  f.teacherSolution='Marco docente aprobado: explorar PA-SI-T-A-M-A-E; descubrir diabetes y metformina. Derivar a atención primaria de forma no urgente aplicando SEFAC 2024, sin inferir descompensación. Medidas de confort mientras se atiende, sin antibiótico ni cambio de medicación. PRM/RNM no determinables y autorreporte de tomas sin demostrar adherencia global. Auditoría y publicación pendientes.';
  f.questionnaire[4].question='Según SEFAC 2024, referencia seleccionada para este caso, ¿qué decisión de derivación corresponde a Lucía?';
  f.questionnaire[4].gradable!.justification='La tabla 11 incluye diabetes como criterio de derivación. Con los hechos descritos se acuerda atención primaria no urgente, sin inferir descompensación.';
  f.questionnaire[6].question='¿Cuál es el plan inicial más completo para Lucía conforme a SEFAC 2024, protocolo seleccionado para este caso?';
  f.questionnaire[6].gradable!.options=[{id:'A',text:'Medidas de confort y nueva consulta solo si persiste, sin derivación inicial'},
   {id:'B',text:'Medir temperatura y decidir la derivación únicamente a partir de ese resultado'},
   {id:'C',text:'Derivación no urgente a atención primaria, medidas de confort y explicación de señales de reevaluación'},
   {id:'D',text:'Derivación a atención primaria sin abordar el confort ni cuándo volver a consultar'}];
  f.questionnaire[6].gradable!.justification='C integra el criterio de derivación elegido, confort y reevaluación. Las otras opciones omiten componentes o supeditan indebidamente la decisión solo a la temperatura.';
 }else{
  native.clinical!.nonAdherence!.strategy='technical';
  native.clinical!.nonAdherence!.rationale='Marco aprobado: recordatorio técnico acompañado de educación sobre finalidad y adaptación a la rutina. Olvidos no intencionados y barrera práctica; comprobar comprensión y viabilidad sin afirmar efectividad posterior.';
  f.teacherSolution='Marco docente aprobado: dispensación de continuación, verificar pauta y uso real. PRM principal por omisiones; falta de adherencia no intencionada y barrera práctica. Recordatorio técnico con educación y adaptación a la rutina, comprobando comprensión y viabilidad. RNM no determinable. Sin cambio de dosis ni presunción de control tensional. Reevaluar dificultades persistentes y nuevas señales de seguridad. Auditoría y publicación pendientes.';
  f.questionnaire[2].gradable!.justification='Las dos omisiones corresponden al PRM principal de no toma de medicación prescrita. No demuestran error de administración, dosis insuficiente ni RNM.';
  f.questionnaire[5].gradable!.justification='El recordatorio acordado atiende la barrera práctica; la educación y comprobación de comprensión completan la intervención sin inventar apoyo familiar.';
  f.questionnaire[7].gradable!.options=[{id:'A',text:'Solicitar revisión inmediata de la pauta antes de acordar cualquier ayuda para los olvidos'},
   {id:'B',text:'Derivar para ajuste de dosis basándose únicamente en las dos omisiones'},
   {id:'C',text:'Continuar la dispensación y limitar la reevaluación a que María vuelva espontáneamente'},
   {id:'D',text:'Intervenir sobre los olvidos sin derivación inmediata y acordar reevaluación si persisten dificultades o aparecen señales de seguridad'}];
  f.questionnaire[7].gradable!.justification='D responde a los datos actuales y mantiene condiciones de reevaluación. No hay parámetros que justifiquen ajuste de dosis ni se acredita control tensional por ausencia de alarma referida.';
 }
 f.questionnaire=f.questionnaire.map(q=>({...q,answer:q.gradable!.options.filter(o=>q.gradable!.correctOptionIds.includes(o.id)).map(o=>o.text).join(' / '),
  review:{contractVersion:'question-review/1',status:'READY_FOR_REVIEW',reason:`Marco ${academicFramework.version} aplicado; revisar redacción y auditoría del paquete exacto. No publicación automática.`}}));
 return teacherDraftFieldsSchema.parse(f);
}
