import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {createTeacherDraftStore} from '@/lib/cases/v2/teacher-case-draft-store';
import {createTeacherNativeStore} from '@/lib/cases/v2/teacher-native-store';
import {createTeacherNativeAuditStore} from '@/lib/cases/v2/teacher-native-audit-store';
import {createTeacherPublicationStore} from '@/lib/cases/v2/teacher-publication';
import {syntheticSources,syntheticResult} from './teacher-native-audit-fixture';
import {m8Fields,m8Policy} from './m8-fixture';
export async function createM8Fixture(db:Pool){
 const teacher=String((await db.query("INSERT INTO users(email,password_hash,name,role) VALUES($1,'synthetic','M8 synthetic teacher','teacher') RETURNING id",[`${randomUUID()}@example.test`])).rows[0].id);
 const student=String((await db.query("INSERT INTO users(email,password_hash,name,role) VALUES($1,'synthetic','M8 synthetic student','student') RETURNING id",[`${randomUUID()}@example.test`])).rows[0].id);
 const drafts=createTeacherDraftStore(db),initial=await drafts.openTemplate(teacher,'lucia'),draft=await drafts.save(teacher,initial.caseId,initial.versionId,m8Fields()),converted=await createTeacherNativeStore(db).convert(teacher,draft.caseId,{expectedDraftVersionId:draft.versionId});if(converted.status!=='READY')throw Error('fixture conversion');
 const request={candidateVersionId:converted.candidateVersionId,expectedDraftVersionId:draft.versionId},audit=createTeacherNativeAuditStore(db,async(p,s)=>syntheticResult(p,s),async()=>structuredClone(syntheticSources[0]));
 await audit.act(teacher,draft.caseId,{...request,action:'prepare',sourceKeys:['metformin850']});await audit.act(teacher,draft.caseId,{...request,action:'run'});
 const pub=createTeacherPublicationStore(db);await pub.act(teacher,draft.caseId,{...request,action:'validate',review:{clinical:true,solution:true,criteria:true,questionnaire:true,correspondence:true,warnings:true,note:'SYNTHETIC M8 technical fixture; no academic or clinical approval.'}});await pub.act(teacher,draft.caseId,{...request,action:'publish'});
 await db.query('INSERT INTO case_questionnaire_policies(case_version_id,policy,created_by) VALUES($1,$2,$3)',[request.candidateVersionId,m8Policy,teacher]);
 const sessionId=(await db.query('INSERT INTO sessions(user_id,case_id,case_version_id) VALUES($1,$2,$3) RETURNING id',[student,draft.caseId,request.candidateVersionId])).rows[0].id;
 await db.query("INSERT INTO messages(session_id,role,content) VALUES($1,'patient','Quería consultar una molestia leve.'),($1,'student','¿Desde cuándo y puede beber y respirar con normalidad?'),($1,'patient','Desde ayer. Puedo beber y respirar con normalidad.')",[sessionId]);
 return {teacher,student,sessionId,draft,request,drafts};
}
