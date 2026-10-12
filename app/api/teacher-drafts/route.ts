import { z } from 'zod';
import { templateIdSchema } from '@/lib/cases/v2/teacher-case-draft';
import { draftActor, draftError, draftJson, teacherDraftStore, assertDraftOrigin } from '@/lib/cases/v2/teacher-case-draft-api';
export const dynamic = 'force-dynamic';
export async function GET() {
  try { return draftJson({drafts:await teacherDraftStore.list(await draftActor())}); }
  catch(e) { return draftError(e); }
}
export async function POST(req: Request) {
  try {
    const actor=await draftActor(); assertDraftOrigin(req);
    const {templateId}=z.object({templateId:templateIdSchema}).strict().parse(await req.json());
    return draftJson(await teacherDraftStore.openTemplate(actor,templateId));
  } catch(e) { return draftError(e); }
}
