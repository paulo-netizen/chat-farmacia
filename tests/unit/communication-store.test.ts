import {it,expect,vi} from 'vitest';
import type {Pool} from 'pg';
vi.mock('server-only',()=>({}));
import {createCommunicationStore} from '@/lib/cases/v2/communication-store';
const sid='10000000-0000-4000-8000-000000000001';
function fixture(failAt:string){
 const query=vi.fn(async(sql:string)=>{
  if(sql===failAt||sql.startsWith(failAt))throw Error('PERSISTENCE_FAILURE');
  if(sql.startsWith('SELECT s.*'))return {rows:[{id:sid,case_version_id:'casever_10000000-0000-4000-8000-000000000001',created_by:'1',status:'finished'}]};
  if(sql.startsWith('SELECT role'))return {rows:[{role:'teacher'}]};
  if(sql.startsWith('SELECT status'))return {rows:[]};
  if(sql.startsWith('SELECT shobj'))return {rows:[{marker:'teacher-editor-20261012-disposable'}]};
  if(sql.startsWith('SELECT policy'))return {rows:[{policy:{scope:'SYNTHETIC_TEST'}}]};
  if(sql.startsWith('SELECT id::text'))return {rows:[{id:'1',role:'student',content:'Hola',created_at:'2026-10-28T10:00:00Z'}]};
  return {rows:[],rowCount:1};
 });const release=vi.fn(),db={connect:vi.fn(async()=>({query,release}))} as unknown as Pick<Pool,'connect'>;
 const adjudicate=vi.fn(async()=>{throw Error('PRIVATE_SECRET');});return {db,query,adjudicate,store:createCommunicationStore(db,{mode:'SIMULATED',id:'fake/1',adjudicate})};
}
it.each(['COMMIT','INSERT INTO session_communication'])('never adjudicates after uncertain/failed claim: %s',async boundary=>{const f=fixture(boundary);await expect(f.store.evaluate('1',sid)).rejects.toThrow('PERSISTENCE_FAILURE');expect(f.adjudicate).not.toHaveBeenCalled();});
it('does not hide a persistence failure when recording a runtime failure or repeat evaluation',async()=>{const f=fixture('UPDATE session_communication');await expect(f.store.evaluate('1',sid)).rejects.toThrow('PERSISTENCE_FAILURE');expect(f.adjudicate).toHaveBeenCalledTimes(1);expect(f.query.mock.calls.filter(([q])=>q.startsWith('UPDATE'))).toHaveLength(1);});
