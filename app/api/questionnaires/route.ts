import {questionnaireActor,questionnaireStore,questionnaireJson,questionnaireError} from '@/lib/cases/v2/session-questionnaire-api';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return questionnaireJson(await questionnaireStore.list(await questionnaireActor(req)));}catch(e){return questionnaireError(e);}}
