import OpenAI from 'openai';
import { prepareFirstCovBatch, createCovClientFromSdk } from './first-batch';
import { evaluateFixture, measure } from './runner';
import { covHash, COV_FIRST_CONFIG, COV_WIRE_POLICY } from '../../lib/cases/v2/cov-experiment-policy';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { createCovOpenAiRuntimes, type CovClient } from '../../lib/cases/v2/cov-semantic-runtime';

export async function runR2Diagnostic(options: { mode?: 'dry' | 'live'; exampleId?: 'R2'; authorization?: unknown;
  /** Offline tests only; not exposed by CLI. */ clientFactory?: () => CovClient } = {}) {
  if (options.exampleId !== undefined && options.exampleId !== 'R2') throw new Error('COV_R2_ONLY');
  const mode = options.mode ?? 'dry';
  if (mode !== 'dry' && mode !== 'live') throw new Error('COV_MODE_INVALID');
  const prepared = await prepareFirstCovBatch();
  const fixture = prepared.fixtures.find(f => f.id === 'R2')!;
  const manifest = prepared.manifest.filter(m => m.id === 'R2');
  if (mode === 'dry') return { mode, exampleId: 'R2', manifest, manifestHash: covHash(manifest), plannedCalls: 1 };
  const session = CovExecutionSession.openR2Diagnostic(options.authorization, manifest);
  try {
    if (session.stopped) throw new Error('COV_R2_STOPPED');
    const saved = session.saved('R2');
    if (saved !== undefined) return { mode, recovered: true, row: saved, reservedMicroUsd: session.reservedMicroUsd };
    const client = options.clientFactory ? options.clientFactory() : createCovClientFromSdk(new OpenAI({
      baseURL: COV_WIRE_POLICY.endpoint, maxRetries: 0, timeout: COV_FIRST_CONFIG.timeoutMs,
    }));
    const result = await evaluateFixture(fixture, createCovOpenAiRuntimes(COV_FIRST_CONFIG, client, session));
    const row = { id: 'R2', result, metrics: measure(fixture, result) };
    session.result('R2', row);
    if (result.status === 'TECHNICAL_FAILURE' || session.stopped) session.stop();
    return { mode, recovered: false, row, reservedMicroUsd: session.reservedMicroUsd };
  } catch { session.stop(); throw new Error('COV_R2_STOPPED_REVIEW_JOURNAL'); }
  finally { session.close(); }
}
