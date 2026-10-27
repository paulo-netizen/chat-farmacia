import {NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {pool} from '@/lib/db';
import {createSessionQuestionnaireStore,QuestionnaireError} from './session-questionnaire-store';
export const questionnaireStore=createSessionQuestionnaireStore(pool);
export async function questionnaireActor(req:Request,write=false){
 const user=await getCurrentUser();if(!user)throw new QuestionnaireError('FORBIDDEN',401);if(user.role!=='student')throw new QuestionnaireError('FORBIDDEN',403);
 if(write){const origin=req.headers.get('origin');if(origin){let u:URL;try{u=new URL(origin);}catch{throw new QuestionnaireError('FORBIDDEN',403);}if(!['http:','https:'].includes(u.protocol)||u.host!==(req.headers.get('host')??new URL(req.url).host))throw new QuestionnaireError('FORBIDDEN',403);}}
 return String(user.id);
}
export const questionnaireJson=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export function questionnaireError(e:unknown){
 const messages={FORBIDDEN:'Acceso reservado al estudiante titular.',NOT_FOUND:'Sesión no disponible.',NOT_READY:'Finaliza la entrevista antes de abrir el cuestionario.',NOT_CONFIGURED:'Esta versión no tiene un cuestionario y una configuración de corrección habilitados.',CONFLICT:'La entrega ya se cerró o hay cambios guardados desde otra pestaña. Recarga para recuperarlos.',INVALID:'Revisa las respuestas y los campos requeridos.'};
 if(e instanceof QuestionnaireError)return questionnaireJson({error:messages[e.code]},e.status);
 if(e instanceof ZodError||e instanceof SyntaxError)return questionnaireJson({error:messages.INVALID},400);
 return questionnaireJson({error:'No se confirmó la operación. Recarga para consultar el estado conservado.'},500);
}
