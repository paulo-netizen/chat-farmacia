import { readFileSync } from 'node:fs';
import { runFirstCovBatch } from './first-batch';

async function main() {
  const args = process.argv.slice(2);
  const dry = args.length === 0 || (args.length === 1 && args[0] === '--dry');
  const live = args.length === 3 && args[0] === '--live' && args[1] === '--authorization';
  if (!dry && !live) throw new Error('INVALID_COV_ARGUMENTS');
  const authorization: unknown = live ? JSON.parse(readFileSync(args[2], 'utf8')) : undefined;
  const result = await runFirstCovBatch({ mode: live ? 'live' : 'dry', authorization });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
void main().catch(() => { process.stderr.write('COV_RUN_BLOCKED_OR_INVALID\n'); process.exitCode = 1; });
