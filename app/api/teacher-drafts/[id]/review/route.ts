import { pool } from '@/lib/db';
import { createTeacherPublicationStore } from '@/lib/cases/v2/teacher-publication';
import { draftActor, draftError, draftJson, assertDraftOrigin } from '@/lib/cases/v2/teacher-case-draft-api';
export const dynamic='force-dynamic';
const store=createTeacherPublicationStore(pool);
export async function GET(_req:Request,{params}:{params:{id:string}}){
 try{return draftJson(await store.read(await draftActor(),params.id));}catch(e){return draftError(e);}
}
export async function POST(req:Request,{params}:{params:{id:string}}){
 try{const actor=await draftActor();assertDraftOrigin(req);return draftJson(await store.act(actor,params.id,await req.json()));}catch(e){return draftError(e);}
}
