import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { projectTeacherPatient, teacherPatientProjectionSchema } from './teacher-patient-projection';
import { durableJson, previewHash, readJson, withPreviewLock } from './teacher-preview-files';
import type { TeacherDraftRecord } from './teacher-case-draft';
import { caseVersionIdSchema } from './teacher-case-draft';
import type { GenerateSafePatientReplyInputV2, AcceptedPatientReplyV2 } from './generate-safe-patient-reply';

const uuid=z.string().uuid();
const message=z.object({role:z.enum(['student','patient']),content:z.string().max(16000)}).strict();
const stateSchema=z.object({
  version:z.literal('teacher-preview/1'),id:uuid,actorId:z.string().regex(/^\d+$/),caseId:z.string().regex(/^\d+$/),
  revision:z.number().int().positive(),createdAt:z.string().datetime(),expiresAt:z.string().datetime(),
  projection:teacherPatientProjectionSchema,projectionHash:z.string().regex(/^[a-f0-9]{64}$/),
  status:z.enum(['READY','RUNNING','BLOCKED','CLOSED']),messages:z.array(message).max(25),
  attempts:z.array(uuid).max(13),failure:z.enum(['RUNTIME_REJECTED','DELIVERY_UNCERTAIN']).optional(),
}).strict();
export type TeacherPreviewState=z.infer<typeof stateSchema>;
export class TeacherPreviewError extends Error{
  constructor(public readonly code:'NOT_FOUND'|'CONFLICT'|'INCOMPLETE'|'UNAVAILABLE',public readonly status:number){super(code);}
}
export const previewTurnSchema=z.object({requestId:uuid,expectedMessages:z.number().int().min(0).max(24),text:z.string().trim().min(1).max(2000).optional()}).strict();
type ReadDraft=(actor:string,caseId:string)=>Promise<TeacherDraftRecord>;
type Reply=(input:GenerateSafePatientReplyInputV2,context:{previewId:string;requestId:string;opening:boolean})=>Promise<AcceptedPatientReplyV2>;
export function createTeacherPatientPreview(directory:string,readDraft:ReadDraft,reply:Reply){
  const path=(id:string)=>join(directory,`${uuid.parse(id)}.json`);
  async function load(actor:string,id:string){
    let s:TeacherPreviewState;
    try{s=stateSchema.parse(await readJson(path(id)));}catch{throw new TeacherPreviewError('NOT_FOUND',404);}
    if(s.actorId!==actor)throw new TeacherPreviewError('NOT_FOUND',404);
    // Recheck current role and case ownership, but never replace the pinned projection.
    await readDraft(actor,s.caseId);
    if(s.projectionHash!==previewHash(s.projection)||Date.parse(s.expiresAt)<Date.now())throw new TeacherPreviewError('CONFLICT',409);
    return s;
  }
  const view=(s:TeacherPreviewState)=>({id:s.id,mode:'TEACHER_PREVIEW' as const,caseVersionId:s.projection.caseVersionId,revision:s.revision,
    identity:s.projection.identity,status:s.status,messages:s.messages,projectionVersion:s.projection.projectionVersion});
  return {
    async create(actor:string,caseId:string,expectedVersion:string){
      caseVersionIdSchema.parse(expectedVersion);
      const draft=await readDraft(actor,caseId);
      if(draft.versionId!==expectedVersion)throw new TeacherPreviewError('CONFLICT',409);
      const projection=projectTeacherPatient(draft);
      const s:TeacherPreviewState={version:'teacher-preview/1',id:randomUUID(),actorId:actor,caseId,revision:draft.revision,
        createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),projection,projectionHash:previewHash(projection),status:'READY',messages:[],attempts:[]};
      await withPreviewLock(directory,s.id,()=>durableJson(path(s.id),s,true));
      return view(s);
    },
    async read(actor:string,id:string){return view(await load(actor,id));},
    async close(actor:string,id:string){return withPreviewLock(directory,uuid.parse(id),async()=>{const s=await load(actor,id);if(s.status==='RUNNING')throw new TeacherPreviewError('CONFLICT',409);s.status='CLOSED';await durableJson(path(id),s);return view(s);});},
    async turn(actor:string,id:string,raw:unknown){
      const input=previewTurnSchema.parse(raw); // detach before awaits
      return withPreviewLock(directory,uuid.parse(id),async()=>{
        const s=await load(actor,id);
        if(s.status!=='READY'||s.messages.length!==input.expectedMessages||s.attempts.includes(input.requestId)||s.attempts.length>=13)throw new TeacherPreviewError('CONFLICT',409);
        const opening=s.messages.length===0;
        if(opening?input.text!==undefined:!input.text)throw new TeacherPreviewError('INCOMPLETE',400);
        s.status='RUNNING';s.attempts.push(input.requestId);
        await durableJson(path(id),s); // crash/restart cannot repeat an uncertain turn
        try{
          const accepted=await reply({clinicalContent:structuredClone(s.projection),acceptedConversation:structuredClone(s.messages),currentStudentTurn:opening?'Buenos días. ¿En qué puedo ayudarle?':input.text!},{previewId:id,requestId:input.requestId,opening});
          if(!opening)s.messages.push({role:'student',content:input.text!});
          s.messages.push({role:'patient',content:accepted.reply});s.status='READY';
          await durableJson(path(id),s);
          return view(s);
        }catch{
          s.status='BLOCKED';s.failure='RUNTIME_REJECTED';
          await durableJson(path(id),s);
          throw new TeacherPreviewError('UNAVAILABLE',503);
        }
      });
    },
  };
}
