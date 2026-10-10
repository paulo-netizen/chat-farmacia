import { readFileSync } from 'node:fs';
import { runCovSourcePhase } from './source-run';
async function main(){
  const a=process.argv.slice(2);
  if(!a.length||a.join(' ')==='--dry'){console.log(JSON.stringify(await runCovSourcePhase()));return;}
  if(a.length!==5||a[0]!=='--live'||a[1]!=='--phase'||!['R2','PENDING'].includes(a[2])||a[3]!=='--authorization')throw new Error();
  const r=await runCovSourcePhase({mode:'live',phase:a[2] as 'R2'|'PENDING',authorization:JSON.parse(readFileSync(a[4],'utf8'))});
  console.log(JSON.stringify({phase:r.phase,stopped:r.stopped,recordedResults:r.rows?.length,reservedMicroUsd:r.reservedMicroUsd}));
}
void main().catch(()=>{console.error('COV_SOURCE_RUN_BLOCKED_OR_STOPPED');process.exitCode=1;});
