import {questionnaireActor,questionnaireStore,questionnaireJson,questionnaireError} from '@/lib/cases/v2/session-questionnaire-api';
export async function POST(req:Request,{params}:{params:{id:string}}){try{return questionnaireJson(await questionnaireStore.finish(await questionnaireActor(req,true),params.id));}catch(e){return questionnaireError(e);}}
