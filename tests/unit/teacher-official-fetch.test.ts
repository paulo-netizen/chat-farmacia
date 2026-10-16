import { EventEmitter } from 'node:events';
import { describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
const mocks=vi.hoisted(()=>({request:vi.fn()}));vi.mock('node:https',()=>mocks);
import { teacherOfficialFetch } from '@/lib/cases/v2/teacher-official-fetch';
describe('teacher official transport',()=>{
 it('forces certificate verification independently of legacy process settings; does not follow redirects',async()=>{
  mocks.request.mockImplementation((_url,options,callback)=>{
   expect(options.rejectUnauthorized).toBe(true);
   const req=Object.assign(new EventEmitter(),{end:()=>{const res=Object.assign(new EventEmitter(),{statusCode:302,headers:{location:'https://other.test'}});callback(res);res.emit('data',Buffer.from('redirect'));res.emit('end');},destroy:vi.fn()});return req;
  });
  const response=await teacherOfficialFetch('https://cima.aemps.es/example');expect(response.status).toBe(302);expect(mocks.request).toHaveBeenCalledTimes(1);
 });
 it.each(['http://cima.aemps.es/example','https://evil.test','https://cima.aemps.es:8443/example'])('rejects unsupported destination %s',async url=>{await expect(teacherOfficialFetch(url)).rejects.toThrow('OFFICIAL_SOURCE_INVALID');});
});
