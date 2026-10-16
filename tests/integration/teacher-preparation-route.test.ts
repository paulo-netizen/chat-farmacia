import { beforeEach,describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({user:vi.fn(),prepare:vi.fn()}));
vi.mock('@/lib/auth',()=>({getCurrentUser:m.user}));vi.mock('@/lib/db',()=>({pool:{}}));
vi.mock('@/lib/cases/v2/teacher-preparation-store',()=>({createTeacherPreparationStore:()=>m}));
import { POST } from '@/app/api/teacher-drafts/[id]/prepare/route';
const req=(origin='http://localhost')=>new Request('http://localhost/api/teacher-drafts/1/prepare',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'});
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue({id:1,role:'teacher'});m.prepare.mockResolvedValue({});});
describe('preparation authorization',()=>{
 it.each([null,'student'])('blocks %s before source calls',async role=>{m.user.mockResolvedValue(role?{id:1,role}:null);expect((await POST(req(),{params:{id:'1'}})).status).toBe(role?403:401);expect(m.prepare).not.toHaveBeenCalled();});
 it('rejects cross-origin',async()=>{expect((await POST(req('https://evil.test'),{params:{id:'1'}})).status).toBe(403);expect(m.prepare).not.toHaveBeenCalled();});
 it('uses authenticated teacher and no-store, hides failures',async()=>{const r=await POST(req(),{params:{id:'1'}});expect(r.headers.get('cache-control')).toBe('private, no-store');expect(m.prepare).toHaveBeenCalledWith('1','1',{});m.prepare.mockRejectedValue(Error('SECRET'));expect(await (await POST(req(),{params:{id:'1'}})).text()).not.toContain('SECRET');});
});
