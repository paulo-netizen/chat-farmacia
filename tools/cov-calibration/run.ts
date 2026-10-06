import { runCalibration } from './runner';

async function main() {
  const args = process.argv.slice(2);
  if (args.some(a => a !== '--dry' && a !== '--live') || args.length > 1) throw new Error('INVALID_COV_ARGUMENTS');
  const result = await runCalibration({ mode: args.includes('--live') ? 'live' : 'dry' });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
void main().catch(() => { process.stderr.write('COV_RUN_BLOCKED_OR_INVALID\n'); process.exitCode = 1; });
