import { pool } from '@/lib/db';
import { draftActor,draftError,draftJson,assertDraftOrigin } from '@/lib/cases/v2/teacher-case-draft-api';
import { createTeacherClinicalAuditStore } from '@/lib/cases/v2/teacher-clinical-audit-store';
import { runClinicalAuditor } from '@/lib/cases/v2/teacher-clinical-auditor';
export const dynamic='force-dynamic';
const store=createTeacherClinicalAuditStore(pool,(pkg,sources)=>runClinicalAuditor(pkg,sources,{
 directory:process.env.TEACHER_AUDIT_DIRECTORY??'.env.teacher-academic-audit.local',authorizationFile:process.env.TEACHER_AUDIT_AUTH,apiKey:process.env.OPENAI_API_KEY,
}));
export async function POST(req:Request,{params}:{params:{id:string}}){
 try{const actor=await draftActor();assertDraftOrigin(req);return draftJson(await store.audit(actor,params.id,await req.json()));}catch(e){return draftError(e);}
}
