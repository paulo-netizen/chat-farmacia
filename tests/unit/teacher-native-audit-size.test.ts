import {describe,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
import {buildTeacherNativePackage} from '@/lib/cases/v2/build-teacher-native-package';
import {teacherNativeProposal} from '@/lib/cases/v2/teacher-native-proposals';
import {nativeAuditInput} from '@/lib/cases/v2/teacher-native-audit';
import {auditorRequest,auditRequestByteLimit} from '@/lib/cases/v2/teacher-clinical-auditor';
import {syntheticSources} from './support/teacher-native-audit-fixture';
describe('native auditor payload limit',()=>{it.each(['lucia','maria'] as const)('%s fits existing wire with a maximum source extract',name=>{const id='casever_90000000-0000-4000-8000-000000000002';const r=buildTeacherNativePackage({caseId:'1',versionId:'casever_90000000-0000-4000-8000-000000000001',revision:1,templateId:name,status:'TEACHER_DRAFT',fields:teacherNativeProposal(name)},id);if(r.status!=='READY')throw Error('fixture');const input=nativeAuditInput(r.bundle,id,'b'.repeat(64));expect(Buffer.byteLength(JSON.stringify(auditorRequest(input,[{...syntheticSources[0],clinicalText:'a'.repeat(24000)}])))).toBeLessThanOrEqual(auditRequestByteLimit(input));});});
