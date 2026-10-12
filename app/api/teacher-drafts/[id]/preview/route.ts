import { studentDraftPreview } from '@/lib/cases/v2/teacher-case-draft';
import { draftActor, draftError, draftJson, teacherDraftStore } from '@/lib/cases/v2/teacher-case-draft-api';
export const dynamic = 'force-dynamic';
export async function GET(_req: Request, {params}: {params:{id:string}}) {
  try { const draft=await teacherDraftStore.read(await draftActor(),params.id);return draftJson(studentDraftPreview(draft.fields)); }
  catch(e) { return draftError(e); }
}
