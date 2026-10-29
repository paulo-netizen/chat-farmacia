import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/db',()=>({pool:{connect:vi.fn()}}));
vi.mock('@/lib/auth',()=>({getCurrentUser:vi.fn()}));
const store=vi.hoisted(()=>({recordReview:vi.fn()}));
vi.mock('@/lib/cases/v2/session-results-store',()=>({createSessionResultsStore:()=>store}));
import {getCurrentUser} from '@/lib/auth';
import {POST} from '@/app/api/teacher-results/[id]/review/route';
const params={params:{id:'10000000-0000-4000-8000-000000000001'}};
const req=(origin='http://localhost')=>new Request('http://localhost/api/teacher-results/review',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:'{}'});
beforeEach(()=>vi.resetAllMocks());
it('denies anonymous, students and foreign origins before writing',async()=>{
 expect((await POST(req(),params)).status).toBe(401);
 vi.mocked(getCurrentUser).mockResolvedValue({id:1,role:'student',name:'S',email:'s@example.test'});
 expect((await POST(req(),params)).status).toBe(403);
 vi.mocked(getCurrentUser).mockResolvedValue({id:1,role:'teacher',name:'T',email:'t@example.test'});
 expect((await POST(req('https://foreign.invalid'),params)).status).toBe(403);
 expect(store.recordReview).not.toHaveBeenCalled();
});
it('passes the authenticated actor and returns no-store without exposing errors',async()=>{
 vi.mocked(getCurrentUser).mockResolvedValue({id:1,role:'teacher',name:'T',email:'t@example.test'});
 store.recordReview.mockResolvedValue({revision:1});const r=await POST(req(),params);
 expect(await r.json()).toEqual({revision:1});expect(r.headers.get('cache-control')).toContain('no-store');
 expect(store.recordReview).toHaveBeenCalledWith('1',params.params.id,{});
 store.recordReview.mockRejectedValue(Error('CLINICAL_SECRET'));const failure=await POST(req(),params);
 expect(failure.status).toBe(500);expect(JSON.stringify(await failure.json())).not.toContain('CLINICAL_SECRET');
});
