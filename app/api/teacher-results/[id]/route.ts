import {z} from 'zod';
import {pool} from '@/lib/db';
import {draftActor,assertDraftOrigin,draftError} from '@/lib/cases/v2/teacher-case-draft-api';
import {QuestionnaireError} from '@/lib/cases/v2/session-questionnaire-store';
import {questionnaireJson,questionnaireError} from '@/lib/cases/v2/session-questionnaire-api';
import {createSessionResultsStore} from '@/lib/cases/v2/session-results-store';
const error=(e:unknown)=>e instanceof QuestionnaireError?questionnaireError(e):draftError(e);
export async function GET(_req:Request,{params}:{params:{id:string}}){try{return questionnaireJson(await createSessionResultsStore(pool).review(await draftActor(),params.id));}catch(e){return error(e);}}
export async function POST(req:Request,{params}:{params:{id:string}}){try{assertDraftOrigin(req);const actor=await draftActor(),body=z.object({expectedFingerprint:z.string().regex(/^[0-9a-f]{64}$/)}).strict().parse(await req.json());return questionnaireJson(await createSessionResultsStore(pool).release(actor,params.id,body.expectedFingerprint));}catch(e){return error(e);}}
