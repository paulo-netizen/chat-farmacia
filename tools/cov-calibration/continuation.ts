import OpenAI from 'openai';
import { prepareFirstCovBatch, createCovClientFromSdk } from './first-batch';
import { evaluateFixture, measure } from './runner';
import { COV_FIRST_CONFIG, COV_WIRE_POLICY, covHash } from '../../lib/cases/v2/cov-experiment-policy';
import { COV_CONTINUATION_IDS } from '../../lib/cases/v2/cov-continuation-policy';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { createCovOpenAiRuntimes, type CovClient } from '../../lib/cases/v2/cov-semantic-runtime';

export async function runCovContinuation(options: { mode?: 'dry' | 'live'; authorization?: unknown;
  /** Offline testing seam, never exposed by CLI. */ clientFactory?: () => CovClient } = {}) {
  const mode = options.mode ?? 'dry';
  if (mode !== 'dry' && mode !== 'live') throw new Error('COV_MODE_INVALID');
  const prepared = await prepareFirstCovBatch(), manifest = prepared.manifest.slice(1), fixtures = prepared.fixtures.slice(1);
  if (mode === 'dry') return { mode, ids: COV_CONTINUATION_IDS, manifest, manifestHash: covHash(manifest), plannedCalls: 11 };
  const session = CovExecutionSession.openContinuation(options.authorization, manifest);
  try {
    if (session.stopped) throw new Error('COV_CONTINUATION_STOPPED');
    let client: CovClient | undefined;
    for (const fixture of fixtures) {
      if (session.saved(fixture.id) !== undefined) continue;
      client ??= options.clientFactory ? options.clientFactory() : createCovClientFromSdk(new OpenAI({
        baseURL: COV_WIRE_POLICY.endpoint, maxRetries: 0, timeout: COV_FIRST_CONFIG.timeoutMs,
      }));
      const result = await evaluateFixture(fixture, createCovOpenAiRuntimes(COV_FIRST_CONFIG, client, session));
      session.result(fixture.id, { id: fixture.id, result, metrics: measure(fixture, result) });
      if (result.status === 'TECHNICAL_FAILURE' || session.stopped || (fixture.id === 'R2' && result.status !== 'REVIEW_REQUIRED')) { session.stop(); break; }
    }
    return { mode, stopped: session.stopped, reservedMicroUsd: session.reservedMicroUsd,
      rows: COV_CONTINUATION_IDS.map(id => session.saved(id)).filter(row => row !== undefined) };
  } catch { session.stop(); throw new Error('COV_CONTINUATION_STOPPED_REVIEW_JOURNAL'); }
  finally { session.close(); }
}
