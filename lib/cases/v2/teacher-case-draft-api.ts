import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { pool } from '@/lib/db';
import { createTeacherDraftStore, TeacherDraftError } from './teacher-case-draft-store';

export const teacherDraftStore = createTeacherDraftStore(pool);
export async function draftActor() {
  const user = await getCurrentUser();
  if (!user) throw new TeacherDraftError('FORBIDDEN',401);
  if (user.role !== 'teacher' && user.role !== 'admin') throw new TeacherDraftError('FORBIDDEN',403);
  return String(user.id);
}
export function draftJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export function draftError(error: unknown) {
  if (error instanceof ZodError) {
    // Error paths/messages from unknown keys or provider values must not be reflected.
    const labels: Record<string,string> = { title:'Título', identity:'Identidad', initialDemand:'Demanda', treatment:'Tratamiento', facts:'Hechos y referencias', adherence:'Adherencia', requirements:'Requisitos y referencias', questionnaire:'Cuestionario', teacherSolution:'Solución docente', expectedVersionId:'Versión', templateId:'Plantilla', service:'Servicio' };
    labels.nativeAuthoring='Autoría nativa: perfil, clínica y derivación';
    const nativeLabels:Record<string,string>={communicationProfile:'Perfil comunicativo',profileRationale:'Justificación del perfil',rnm:'RNM',clinical:'Mapeo clínico',referral:'Derivación'};
    const fields = [...new Set(error.issues.map(i => {
      const path=i.path[0]==='fields'?i.path.slice(1):i.path;
      const index=typeof path[1]==='number'?` ${path[1]+1}`:'';
      return path[0]==='nativeAuthoring'?(nativeLabels[String(path[1])]??labels.nativeAuthoring):(labels[String(path[0])]??'Datos del borrador')+index;
    }))];
    return draftJson({ error:'Revisa los campos obligatorios, sus límites y las referencias a hechos.', fields },400);
  }
  if (error instanceof TeacherDraftError) {
    const messages = { FORBIDDEN:'Acceso reservado al docente autorizado.', NOT_FOUND:'Borrador no disponible.', CONFLICT:'El borrador cambió o no es editable. Vuelve a abrirlo antes de guardar.', INVALID:'Datos no válidos.' };
    return draftJson({error:messages[error.code]},error.status);
  }
  if (error instanceof SyntaxError) return draftJson({error:'La solicitud no tiene un formato válido.'},400);
  return draftJson({error:'No se pudo completar la operación. No se ha confirmado el guardado.'},500);
}
export function assertDraftOrigin(req: Request) {
  const origin=req.headers.get('origin');
  if (origin) {
    // Next may normalize Request.url to localhost; Host retains the browser-facing authority.
    let parsed: URL;
    try { parsed=new URL(origin); } catch { throw new TeacherDraftError('FORBIDDEN',403); }
    const host=req.headers.get('host') ?? new URL(req.url).host;
    if (!['http:','https:'].includes(parsed.protocol) || parsed.host !== host) throw new TeacherDraftError('FORBIDDEN',403);
  }
}
