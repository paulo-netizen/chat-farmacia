import {draftActor,draftJson,draftError,assertDraftOrigin,teacherDraftStore} from '@/lib/cases/v2/teacher-case-draft-api';
import {teacherNativeProposal} from '@/lib/cases/v2/teacher-native-proposals';
import {nativeRequestSchema} from '@/lib/cases/v2/teacher-native-store';
export async function POST(req:Request,{params}:{params:{id:string}}){
 try{assertDraftOrigin(req);const actor=await draftActor(),input=nativeRequestSchema.parse(await req.json());const draft=await teacherDraftStore.read(actor,params.id);
  if(draft.versionId!==input.expectedDraftVersionId)return draftJson({error:'La revisión cambió. Vuelve a abrirla.'},409);
  const proposal=teacherNativeProposal(draft.templateId);
  // Do not import clinical templates/keys in a client bundle or overwrite facts.
  return draftJson({nativeAuthoring:proposal.nativeAuthoring,teacherSolution:proposal.teacherSolution,requirements:proposal.requirements,questionnaire:proposal.questionnaire});
 }catch(e){return draftError(e);}
}
