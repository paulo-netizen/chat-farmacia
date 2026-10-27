import {z} from 'zod';
import {draftActor,draftJson,draftError,assertDraftOrigin,teacherDraftStore} from '@/lib/cases/v2/teacher-case-draft-api';
import {caseVersionIdSchema} from '@/lib/cases/v2/teacher-case-draft';
import {TeacherDraftError} from '@/lib/cases/v2/teacher-case-draft-store';
import {revisedTeacherQuestionnaire} from '@/lib/cases/v2/teacher-questionnaire-revision';
export async function POST(req:Request,{params}:{params:{id:string}}){try{assertDraftOrigin(req);const actor=await draftActor(),body=z.object({expectedDraftVersionId:caseVersionIdSchema}).strict().parse(await req.json()),draft=await teacherDraftStore.read(actor,params.id);if(draft.versionId!==body.expectedDraftVersionId)throw new TeacherDraftError('CONFLICT',409);return draftJson({questionnaire:revisedTeacherQuestionnaire(draft.templateId)});}catch(e){return draftError(e);}}
