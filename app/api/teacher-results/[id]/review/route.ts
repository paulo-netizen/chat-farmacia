import {pool} from '@/lib/db';
import {draftActor,assertDraftOrigin,draftError} from '@/lib/cases/v2/teacher-case-draft-api';
import {QuestionnaireError} from '@/lib/cases/v2/session-questionnaire-store';
import {questionnaireJson,questionnaireError} from '@/lib/cases/v2/session-questionnaire-api';
import {createSessionResultsStore} from '@/lib/cases/v2/session-results-store';
export async function POST(req:Request,{params}:{params:{id:string}}){try{assertDraftOrigin(req);return questionnaireJson(await createSessionResultsStore(pool).recordReview(await draftActor(),params.id,await req.json()));}catch(e){return e instanceof QuestionnaireError?questionnaireError(e):draftError(e);}}
