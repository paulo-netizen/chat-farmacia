import { readFileSync } from 'node:fs';
import { runCovContinuation } from './continuation';
async function main() {
  const args = process.argv.slice(2);
  if (!args.length || (args.length === 1 && args[0] === '--dry')) { console.log(JSON.stringify(await runCovContinuation())); return; }
  if (args.length !== 3 || args[0] !== '--live' || args[1] !== '--authorization') throw new Error();
  const result = await runCovContinuation({ mode: 'live', authorization: JSON.parse(readFileSync(args[2], 'utf8')) });
  console.log(JSON.stringify({ mode: result.mode, stopped: 'stopped' in result ? result.stopped : undefined,
    completed: result.rows?.length ?? 0, reservedMicroUsd: 'reservedMicroUsd' in result ? result.reservedMicroUsd : undefined }));
}
void main().catch(() => { console.error('COV_CONTINUATION_BLOCKED_OR_STOPPED'); process.exitCode = 1; });
