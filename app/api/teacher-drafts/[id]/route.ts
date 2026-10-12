import { z } from 'zod';
import { teacherDraftFieldsSchema, caseVersionIdSchema } from '@/lib/cases/v2/teacher-case-draft';
import { draftActor, draftError, draftJson, teacherDraftStore, assertDraftOrigin } from '@/lib/cases/v2/teacher-case-draft-api';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, {params}: {params:{id:string}}) {
  try { return draftJson(await teacherDraftStore.read(await draftActor(),params.id)); }
  catch(e) { return draftError(e); }
}
export async function PUT(req: Request, {params}: {params:{id:string}}) {
  try {
    const actor=await draftActor(); assertDraftOrigin(req);
    const input=z.object({expectedVersionId:caseVersionIdSchema,fields:teacherDraftFieldsSchema}).strict().parse(await req.json());
    return draftJson(await teacherDraftStore.save(actor,params.id,input.expectedVersionId,input.fields));
  } catch(e) { return draftError(e); }
}
