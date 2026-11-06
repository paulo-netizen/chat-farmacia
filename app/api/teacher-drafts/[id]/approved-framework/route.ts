import {draftActor,draftJson,draftError,assertDraftOrigin,teacherDraftStore} from '@/lib/cases/v2/teacher-case-draft-api';
import {nativeRequestSchema} from '@/lib/cases/v2/teacher-native-store';
import {teacherFinalReviewFields} from '@/lib/cases/v2/teacher-approved-framework';
import {resultFingerprint} from '@/lib/cases/v2/session-results';
export async function POST(req:Request,{params}:{params:{id:string}}){
 try{
  assertDraftOrigin(req);const actor=await draftActor(),input=nativeRequestSchema.parse(await req.json());
  const draft=await teacherDraftStore.read(actor,params.id);
  if(draft.versionId!==input.expectedDraftVersionId)return draftJson({error:'La revisión cambió. Vuelve a abrirla.'},409);
  const next=teacherFinalReviewFields(draft.templateId);
  if(resultFingerprint(draft.fields.facts)!==resultFingerprint(next.facts)||resultFingerprint(draft.fields.identity)!==resultFingerprint(next.identity)||draft.fields.treatment!==next.treatment)return draftJson({error:'Los hechos, identidad o tratamiento difieren del caso aprobado. Revisa la correspondencia antes de aplicar el marco.'},409);
  return draftJson({nativeAuthoring:next.nativeAuthoring,teacherSolution:next.teacherSolution,questionnaire:next.questionnaire,requirements:next.requirements});
 }catch(e){return draftError(e);}
}
