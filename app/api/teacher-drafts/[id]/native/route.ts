import {pool} from '@/lib/db';
import {draftActor,draftJson,draftError,assertDraftOrigin} from '@/lib/cases/v2/teacher-case-draft-api';
import {createTeacherNativeStore} from '@/lib/cases/v2/teacher-native-store';
import {TeacherNativeConversionError} from '@/lib/cases/v2/build-teacher-native-package';
export async function POST(req:Request,{params}:{params:{id:string}}){
 try{assertDraftOrigin(req);const actor=await draftActor();return draftJson(await createTeacherNativeStore(pool).convert(actor,params.id,await req.json()));}
 catch(e){if(e instanceof TeacherNativeConversionError)return draftJson({error:'La conversión nativa detectó una incompatibilidad. Revisa el campo indicado; no se ha creado un candidato.',fields:[e.field],code:'NATIVE_VALIDATION_FAILED'},400);return draftError(e);}
}
