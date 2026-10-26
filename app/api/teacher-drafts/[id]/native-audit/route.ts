import {pool} from '@/lib/db';
import {draftActor,draftJson,draftError,assertDraftOrigin} from '@/lib/cases/v2/teacher-case-draft-api';
import {createTeacherNativeAuditStore} from '@/lib/cases/v2/teacher-native-audit-store';
import {runClinicalAuditor} from '@/lib/cases/v2/teacher-clinical-auditor';
import {TeacherDraftError} from '@/lib/cases/v2/teacher-case-draft-store';
export const dynamic='force-dynamic';
export async function POST(req:Request,{params}:{params:{id:string}}){
 try{assertDraftOrigin(req);const actor=await draftActor();const input=await req.json();
  if(input?.action==='run'&&(!process.env.TEACHER_AUDIT_AUTH||!process.env.OPENAI_API_KEY))throw new TeacherDraftError('FORBIDDEN',403);
  return draftJson(await createTeacherNativeAuditStore(pool,runClinicalAuditor).act(actor,params.id,input));}catch(e){return draftError(e);}
}
