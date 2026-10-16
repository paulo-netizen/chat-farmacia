import { pool } from '@/lib/db';
import { createTeacherPreparationStore } from '@/lib/cases/v2/teacher-preparation-store';
import { draftActor, draftError, draftJson, assertDraftOrigin } from '@/lib/cases/v2/teacher-case-draft-api';
export const dynamic='force-dynamic';
const store=createTeacherPreparationStore(pool);
export async function POST(req:Request,{params}:{params:{id:string}}){
 try{const actor=await draftActor();assertDraftOrigin(req);return draftJson(await store.prepare(actor,params.id,await req.json()));}catch(e){return draftError(e);}
}
