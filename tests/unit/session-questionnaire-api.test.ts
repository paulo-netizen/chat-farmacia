import {it,expect,vi,beforeEach} from 'vitest';
vi.mock('server-only',()=>({}));
vi.mock('@/lib/db',()=>({pool:{connect:vi.fn()}}));
vi.mock('@/lib/auth',()=>({getCurrentUser:vi.fn()}));
import {getCurrentUser} from '@/lib/auth';
import {questionnaireActor,questionnaireError,questionnaireJson} from '@/lib/cases/v2/session-questionnaire-api';
beforeEach(()=>vi.resetAllMocks());
it('rejects anonymous, teacher and foreign origins before touching persistence',async()=>{
 const r=new Request('http://localhost/api/test');
 await expect(questionnaireActor(r)).rejects.toMatchObject({status:401});
 vi.mocked(getCurrentUser).mockResolvedValue({id:1,role:'teacher',name:'T',email:'t@example.test'});
 await expect(questionnaireActor(r)).rejects.toMatchObject({status:403});
 vi.mocked(getCurrentUser).mockResolvedValue({id:1,role:'student',name:'S',email:'s@example.test'});
 await expect(questionnaireActor(new Request(r,{headers:{origin:'https://foreign.invalid'}}),true)).rejects.toMatchObject({status:403});
 expect(await questionnaireActor(new Request(r,{headers:{origin:'http://localhost'}}),true)).toBe('1');
});
it('never emits persistence errors or clinical values and forbids caching',async()=>{
 const response=questionnaireError(Error('CLINICAL_SECRET'));
 expect(response.status).toBe(500);expect(JSON.stringify(await response.json())).not.toContain('CLINICAL_SECRET');
 expect(questionnaireJson({ok:true}).headers.get('cache-control')).toContain('no-store');
});
