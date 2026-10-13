import 'server-only';
import { join } from 'node:path';
import { draftError, draftJson, teacherDraftStore } from './teacher-case-draft-api';
import { createTeacherPatientPreview, TeacherPreviewError } from './teacher-patient-preview';
import { TeacherPatientProjectionError } from './teacher-patient-projection';
import { runTeacherPreviewReply } from './teacher-preview-runtime';

const directory=join(process.cwd(),'.env.teacher-patient-preview.local');
export const teacherPreview=createTeacherPatientPreview(directory,teacherDraftStore.read,(input,context)=>runTeacherPreviewReply(input,context,{
  directory,authorizationFile:process.env.TEACHER_PREVIEW_LIVE_AUTH,apiKey:process.env.OPENAI_API_KEY,
}));
export function previewError(e:unknown){
  if(e instanceof TeacherPatientProjectionError)return draftJson({error:'Completa los datos antes de probar el paciente.',fields:e.fields},400);
  if(e instanceof TeacherPreviewError)return draftJson({error:{NOT_FOUND:'Prueba no disponible.',CONFLICT:'La prueba cambió, está bloqueada o ha caducado. Recupera su estado antes de continuar.',INCOMPLETE:'Revisa el mensaje o la revisión guardada.',UNAVAILABLE:'La respuesta no ha superado el recorrido seguro o la ejecución no está habilitada. No se mostrará contenido sin validar.'}[e.code]},e.status);
  if(e instanceof Error&&e.message==='PREVIEW_LOCKED')return draftJson({error:'Hay una operación en curso. Recupera el estado; no repitas el envío.'},409);
  return draftError(e);
}
