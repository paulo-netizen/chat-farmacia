import OpenAI from 'openai';
import { prepareFirstCovBatch, createCovClientFromSdk } from './first-batch';
import { evaluateFixture, measure } from './runner';
import { COV_FIRST_CONFIG, COV_WIRE_POLICY, covHash } from '../../lib/cases/v2/cov-experiment-policy';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { createCovOpenAiRuntimes, type CovClient } from '../../lib/cases/v2/cov-semantic-runtime';

export async function prepareR3Check() {
  const p = await prepareFirstCovBatch('canonical/5');
  const index = p.manifest.findIndex(m => m.id === 'R3');
  const manifest = [p.manifest[index]];
  return { manifest, manifestHash: covHash(manifest), fixture: p.fixtures[index], request: p.requests[index] };
}
/** Single deliberate R3 check. No configurable example or historical journal reopening. */
export async function runR3Check(options: { mode?: 'dry' | 'live'; authorization?: unknown; clientFactory?: () => CovClient } = {}) {
  const mode = options.mode ?? 'dry';
  if (!['dry', 'live'].includes(mode)) throw Error('COV_R3_CHECK_MODE_INVALID');
  const p = await prepareR3Check();
  if (mode === 'dry') return { mode, manifest: p.manifest, manifestHash: p.manifestHash, plannedCalls: 1 };
  const session = CovExecutionSession.openR3Check(options.authorization, p.manifest);
  try {
    if (session.stopped) throw Error();
    if (session.saved('R3') === undefined) {
      const client = options.clientFactory ? options.clientFactory() : createCovClientFromSdk(new OpenAI({ baseURL: COV_WIRE_POLICY.endpoint, maxRetries: 0, timeout: COV_FIRST_CONFIG.timeoutMs }));
      const result = await evaluateFixture(p.fixture, createCovOpenAiRuntimes(COV_FIRST_CONFIG, client, session, 'canonical'), 'canonical');
      session.result('R3', { id: 'R3', result, metrics: measure(p.fixture, result) });
      if (result.status === 'TECHNICAL_FAILURE' || session.stopped) session.stop();
    }
    return { mode, row: session.saved('R3'), stopped: session.stopped, reservedMicroUsd: session.reservedMicroUsd };
  } catch { session.stop(); throw Error('COV_R3_CHECK_STOPPED_REVIEW_JOURNAL'); }
  finally { session.close(); }
}
