import { readFileSync } from 'node:fs';
import { runCov3DiagnosticRound } from './canonical-round';
async function main(){
  const args=process.argv.slice(2);
  if(!args.length||args.join(' ')==='--dry'){console.log(JSON.stringify(await runCov3DiagnosticRound()));return;}
  if(args.length!==3||args[0]!=='--live'||args[1]!=='--authorization')throw Error();
  const r=await runCov3DiagnosticRound({mode:'live',authorization:JSON.parse(readFileSync(args[2],'utf8'))});
  console.log(JSON.stringify({stopped:r.stopped,reservedMicroUsd:r.reservedMicroUsd,completed:r.rows?.length}));
}
void main().catch(()=>{console.error('COV3_CANONICAL_DIAGNOSTICS_BLOCKED_OR_STOPPED');process.exitCode=1;});
