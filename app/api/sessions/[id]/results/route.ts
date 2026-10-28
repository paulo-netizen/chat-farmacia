import {pool} from '@/lib/db';
import {questionnaireActor,questionnaireError,questionnaireJson} from '@/lib/cases/v2/session-questionnaire-api';
import {createSessionResultsStore} from '@/lib/cases/v2/session-results-store';
export async function GET(req:Request,{params}:{params:{id:string}}){try{return questionnaireJson(await createSessionResultsStore(pool).read(await questionnaireActor(req),params.id));}catch(e){return questionnaireError(e);}}
