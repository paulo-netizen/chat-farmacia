import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({user:vi.fn(),list:vi.fn(),read:vi.fn(),save:vi.fn(),openTemplate:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/lib/db',()=>({pool:{}}));
vi.mock('@/lib/cases/v2/teacher-case-draft-store',async original=>({...await original<any>(),createTeacherDraftStore:()=>mocks}));
import { GET as list, POST } from '@/app/api/teacher-drafts/route';
import { GET as read, PUT } from '@/app/api/teacher-drafts/[id]/route';
import { GET as preview } from '@/app/api/teacher-drafts/[id]/preview/route';
import { teacherDraftTemplate } from '@/lib/cases/v2/teacher-case-draft-templates';
import { TeacherDraftError } from '@/lib/cases/v2/teacher-case-draft-store';
const params={params:{id:'1'}};
const req=(body:unknown={},method='PUT',origin='http://localhost')=>new Request('http://localhost/api/teacher-drafts/1',{method,headers:{'Content-Type':'application/json',origin},body:JSON.stringify(body)});
const readReq=()=>new Request('http://localhost/api/teacher-drafts/1');
const versionId='casever_10000000-0000-4000-8000-000000000001';
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:1,role:'teacher'});mocks.list.mockResolvedValue([]);mocks.read.mockResolvedValue({fields:teacherDraftTemplate('lucia')});mocks.save.mockResolvedValue({versionId});mocks.openTemplate.mockResolvedValue({versionId});});
describe('teacher draft HTTP boundaries',()=>{
  for(const role of [null,'student']) it(`denies all routes to ${role}`,async()=>{
    mocks.user.mockResolvedValue(role?{id:1,role}:null);
    for(const run of [()=>list(),()=>POST(req({templateId:'lucia'},'POST')),()=>read(readReq(),params),()=>preview(readReq(),params),()=>PUT(req(),params)]) expect((await run()).status).toBe(role?403:401);
    expect(mocks.read).not.toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();expect(mocks.openTemplate).not.toHaveBeenCalled();
  });
  it('projects saved preview with exact allowlist and no cache',async()=>{
    const r=await preview(readReq(),params);expect(await r.json()).toEqual({nombre:'Lucía',edad:42,sexo:'Mujer'});expect(r.headers.get('Cache-Control')).toBe('private, no-store');
  });
  it('uses authenticated actor and version, not client owner/status',async()=>{
    const fields=teacherDraftTemplate('maria');expect((await PUT(req({expectedVersionId:versionId,fields}),params)).status).toBe(200);expect(mocks.save).toHaveBeenCalledWith('1','1',versionId,fields);
    expect((await PUT(req({expectedVersionId:versionId,fields,ownerId:'other',status:'PUBLISHED'}),params)).status).toBe(400);
  });
  it('rejects cross origin mutations',async()=>{expect((await POST(req({templateId:'lucia'},'POST','https://evil.test'))).status).toBe(403);expect(mocks.openTemplate).not.toHaveBeenCalled();});
  it('accepts the browser-facing Host when Next normalizes its internal URL',async()=>{
    const request=new Request('http://localhost:3105/api/teacher-drafts',{method:'POST',headers:{origin:'http://127.0.0.1:3105',host:'127.0.0.1:3105','Content-Type':'application/json'},body:JSON.stringify({templateId:'lucia'})});
    expect((await POST(request)).status).toBe(200);
  });
  it('rejects unsupported templates',async()=>{expect((await POST(req({templateId:'invented'},'POST'))).status).toBe(400);});
  it('returns controlled validation hints, never supplied secret keys',async()=>{
    const fields:any=teacherDraftTemplate('lucia');fields.facts=[];fields.SECRET_SENTINEL='private';
    const r=await PUT(req({expectedVersionId:versionId,fields}),params);const body=await r.text();expect(r.status).toBe(400);expect(body).toContain('Hechos');expect(body).not.toContain('SECRET_SENTINEL');
  });
  it('preserves conflicts and sanitizes persistence failures',async()=>{
    mocks.read.mockRejectedValueOnce(new TeacherDraftError('CONFLICT',409));expect((await read(readReq(),params)).status).toBe(409);
    mocks.read.mockRejectedValueOnce(new Error('SECRET_SENTINEL'));const r=await read(readReq(),params);expect(r.status).toBe(500);expect(await r.text()).not.toContain('SECRET_SENTINEL');
  });
});
