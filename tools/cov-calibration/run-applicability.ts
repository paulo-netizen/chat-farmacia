import { readFileSync } from 'node:fs';
import { runCovCompletion } from './completion';
import { COV_COMPLETION_IDS } from '../../lib/cases/v2/cov-completion-policy';
async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.join(' ') === '--dry') { console.log(JSON.stringify(await runCovCompletion({ proposalScoped: true }))); return; }
  if (args.length !== 5 || args[0] !== '--live' || args[1] !== '--id' || args[3] !== '--authorization') throw new Error();
  const id = COV_COMPLETION_IDS.find(id => id === args[2]); if (!id) throw new Error();
  const r = await runCovCompletion({ proposalScoped: true, mode: 'live', exampleId: id, authorization: JSON.parse(readFileSync(args[4], 'utf8')) });
  console.log(JSON.stringify({ id, stopped: r.stopped, reservedMicroUsd: r.reservedMicroUsd }));
}
void main().catch(() => { console.error('COV_APPLICABILITY_BLOCKED_OR_STOPPED'); process.exitCode = 1; });
