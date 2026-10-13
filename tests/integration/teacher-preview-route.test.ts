import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({user:vi.fn(),create:vi.fn(),read:vi.fn(),turn:vi.fn(),close:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/lib/db',()=>({pool:{}}));
vi.mock('@/lib/cases/v2/teacher-preview-api',async original=>({...await original<any>(),teacherPreview:mocks}));
import { POST as create } from '@/app/api/teacher-drafts/[id]/test/route';
import { GET, POST, DELETE } from '@/app/api/teacher-previews/[id]/route';
const params={params:{id:'123'}},versionId='casever_10000000-0000-4000-8000-000000000001';
const request=(method='POST',body:unknown={expectedVersionId:versionId},origin='http://localhost')=>new Request('http://localhost/api/teacher-previews/123',{method,headers:{origin,'Content-Type':'application/json'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:1,role:'teacher'});mocks.create.mockResolvedValue({mode:'TEACHER_PREVIEW'});});
describe('teacher preview routes',()=>{
 it.each([null,'student'])('denies every operation to %s',async role=>{
  mocks.user.mockResolvedValue(role?{id:1,role}:null);
  for(const run of [()=>create(request(),params),()=>GET(request('GET'),params),()=>POST(request(),params),()=>DELETE(request('DELETE'),params)])expect((await run()).status).toBe(role?403:401);
  for(const fn of [mocks.create,mocks.read,mocks.turn,mocks.close])expect(fn).not.toHaveBeenCalled();
 });
 it('uses authenticated actor and only a persisted version identifier',async()=>{
  const r=await create(request(),params);expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');expect(mocks.create).toHaveBeenCalledWith('1','123',versionId);
  expect((await create(request('POST',{expectedVersionId:versionId,patientData:'injected'}),params)).status).toBe(400);
 });
 it('rejects cross origin writes and sanitizes failures',async()=>{
  expect((await create(request('POST',{},'https://evil.test'),params)).status).toBe(403);mocks.read.mockRejectedValue(Error('SECRET_SENTINEL'));const r=await GET(request('GET'),params);expect(r.status).toBe(500);expect(await r.text()).not.toContain('SECRET_SENTINEL');
 });
});
