import {questionnaireActor,questionnaireStore,questionnaireJson,questionnaireError} from '@/lib/cases/v2/session-questionnaire-api';
export const dynamic='force-dynamic';
export async function GET(req:Request,{params}:{params:{id:string}}){try{return questionnaireJson(await questionnaireStore.read(await questionnaireActor(req),params.id));}catch(e){return questionnaireError(e);}}
export async function POST(req:Request,{params}:{params:{id:string}}){try{const actor=await questionnaireActor(req,true);return questionnaireJson(await questionnaireStore.write(actor,params.id,await req.json()));}catch(e){return questionnaireError(e);}}
