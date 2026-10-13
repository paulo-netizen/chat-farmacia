import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const previewHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function durableJson(file:string,value:unknown,exclusive=false){
  const temporary=exclusive?file:`${file}.${randomUUID()}.tmp`;
  const handle=await open(temporary,'wx',0o600);
  try{await handle.writeFile(JSON.stringify(value));await handle.sync();}finally{await handle.close();}
  if(!exclusive)await rename(temporary,file);
}
export async function readJson(file:string):Promise<unknown>{return JSON.parse(await readFile(file,'utf8'));}
export async function withPreviewLock<T>(directory:string,name:string,work:()=>Promise<T>){
  await mkdir(directory,{recursive:true,mode:0o700});
  const file=join(directory,`${name}.lock`);
  let handle;
  try{handle=await open(file,'wx',0o600);await handle.sync();}catch{throw new Error('PREVIEW_LOCKED');}
  try{return await work();}finally{await handle.close();await unlink(file);}
}
