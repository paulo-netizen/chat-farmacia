import { z } from 'zod';
import { caseVersionIdSchema } from '@/lib/cases/v2/teacher-case-draft';
import { draftActor, assertDraftOrigin, draftJson } from '@/lib/cases/v2/teacher-case-draft-api';
import { teacherPreview, previewError } from '@/lib/cases/v2/teacher-preview-api';
export const dynamic='force-dynamic';
export async function POST(req:Request,{params}:{params:{id:string}}){
  try{const actor=await draftActor();assertDraftOrigin(req);const {expectedVersionId}=z.object({expectedVersionId:caseVersionIdSchema}).strict().parse(await req.json());return draftJson(await teacherPreview.create(actor,params.id,expectedVersionId));}catch(e){return previewError(e);}
}
