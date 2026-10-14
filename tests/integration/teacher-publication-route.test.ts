import { beforeEach,describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({user:vi.fn(),read:vi.fn(),act:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:mocks.user}));
vi.mock('@/lib/db',()=>({pool:{}}));
vi.mock('@/lib/cases/v2/teacher-publication',()=>({createTeacherPublicationStore:()=>mocks}));
import { GET,POST } from '@/app/api/teacher-drafts/[id]/review/route';
const params={params:{id:'1'}};
const req=(method='GET',origin='http://localhost')=>new Request('http://localhost/api/teacher-drafts/1/review',{method,headers:{origin,'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({action:'publish'})}:{})});
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:1,role:'teacher'});mocks.read.mockResolvedValue({checks:{clinicalAudit:'PENDING'}});mocks.act.mockResolvedValue({});});
describe('publication teacher-only HTTP boundary',()=>{
 it.each([null,'student'])('denies reading and mutations to %s',async role=>{
  mocks.user.mockResolvedValue(role?{id:1,role}:null);expect((await GET(req(),params)).status).toBe(role?403:401);expect((await POST(req('POST'),params)).status).toBe(role?403:401);expect(mocks.read).not.toHaveBeenCalled();expect(mocks.act).not.toHaveBeenCalled();
 });
 it('uses authenticated actor and disables caches',async()=>{const r=await GET(req(),params);expect(r.headers.get('Cache-Control')).toBe('private, no-store');expect(mocks.read).toHaveBeenCalledWith('1','1');});
 it('blocks cross-origin mutation and hides persistence details',async()=>{
  expect((await POST(req('POST','https://evil.test'),params)).status).toBe(403);expect(mocks.act).not.toHaveBeenCalled();
  mocks.act.mockRejectedValue(Error('SECRET_SENTINEL'));const r=await POST(req('POST'),params);expect(r.status).toBe(500);expect(await r.text()).not.toContain('SECRET_SENTINEL');
 });
});
