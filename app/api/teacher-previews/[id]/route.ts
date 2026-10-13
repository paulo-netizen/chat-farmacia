import { draftActor, assertDraftOrigin, draftJson } from '@/lib/cases/v2/teacher-case-draft-api';
import { teacherPreview, previewError } from '@/lib/cases/v2/teacher-preview-api';
export const dynamic='force-dynamic';
export async function GET(_req:Request,{params}:{params:{id:string}}){try{return draftJson(await teacherPreview.read(await draftActor(),params.id));}catch(e){return previewError(e);}}
export async function POST(req:Request,{params}:{params:{id:string}}){try{const actor=await draftActor();assertDraftOrigin(req);return draftJson(await teacherPreview.turn(actor,params.id,await req.json()));}catch(e){return previewError(e);}}
export async function DELETE(req:Request,{params}:{params:{id:string}}){try{const actor=await draftActor();assertDraftOrigin(req);return draftJson(await teacherPreview.close(actor,params.id));}catch(e){return previewError(e);}}
