import { readFileSync } from 'node:fs';
import { runR2Diagnostic } from './r2-diagnostic';
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || (args.length === 1 && args[0] === '--dry')) {
    console.log(JSON.stringify(await runR2Diagnostic())); return;
  }
  if (args.length !== 3 || args[0] !== '--live' || args[1] !== '--authorization') throw new Error();
  const result = await runR2Diagnostic({ mode: 'live', authorization: JSON.parse(readFileSync(args[2], 'utf8')) });
  // The selected structured evidence stays in the private journal, not stdout.
  console.log(JSON.stringify({ mode: result.mode, reservedMicroUsd: 'reservedMicroUsd' in result ? result.reservedMicroUsd : undefined,
    status: 'row' in result ? (result.row as { result: { status: string } }).result.status : undefined }));
}
void main().catch(() => { console.error('COV_R2_BLOCKED_OR_STOPPED'); process.exitCode = 1; });
