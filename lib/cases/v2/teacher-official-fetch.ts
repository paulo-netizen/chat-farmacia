import 'server-only';
import { request } from 'node:https';

/** These two integrations must verify TLS even while legacy DB initialization
 * disables verification process-wide. No redirects, retries or arbitrary hosts. */
export const teacherOfficialFetch:typeof fetch=async(input,init)=>{
 const url=new URL(String(input));
 if(url.protocol!=='https:'||!['cima.aemps.es','api.openai.com'].includes(url.hostname)||url.port||url.username||url.password)throw Error('OFFICIAL_SOURCE_INVALID');
 return new Promise<Response>((resolve,reject)=>{
  const req=request(url,{method:init?.method??'GET',headers:Object.fromEntries(new Headers(init?.headers)),rejectUnauthorized:true,signal:init?.signal??undefined},res=>{
   const chunks:Buffer[]=[];let size=0;
   res.on('data',chunk=>{size+=chunk.length;if(size>2_000_000){req.destroy();reject(Error('OFFICIAL_RESPONSE_TOO_LARGE'));}else chunks.push(chunk);});
   res.on('error',()=>reject(Error('OFFICIAL_TRANSPORT_FAILED')));
   res.on('end',()=>{const headers=new Headers();for(const [key,value] of Object.entries(res.headers))if(value)headers.set(key,Array.isArray(value)?value.join(','):value);
    resolve(new Response(Buffer.concat(chunks),{status:res.statusCode??502,headers}));});
  });
  req.on('error',()=>reject(Error('OFFICIAL_TRANSPORT_FAILED')));
  if(init?.body!==undefined&&typeof init.body!=='string'){req.destroy();reject(Error('OFFICIAL_BODY_INVALID'));return;}
  req.end(init?.body);
 });
};
