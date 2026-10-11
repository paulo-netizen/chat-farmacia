import OpenAI from 'openai';
import { prepareFirstCovBatch, createCovClientFromSdk } from './first-batch';
import { evaluateFixture, measure } from './runner';
import { COV_FIRST_CONFIG, COV_WIRE_POLICY, covHash } from '../../lib/cases/v2/cov-experiment-policy';
import { COV_COMPLETION_IDS, covCompletionGrantSchema } from '../../lib/cases/v2/cov-completion-policy';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { createCovOpenAiRuntimes, type CovClient } from '../../lib/cases/v2/cov-semantic-runtime';
export async function runCovCompletion(options: { mode?: 'dry' | 'live'; exampleId?: typeof COV_COMPLETION_IDS[number]; authorization?: unknown; clientFactory?: () => CovClient } = {}) {
  const id = options.exampleId ?? 'P1', mode = options.mode ?? 'dry';
  if (!COV_COMPLETION_IDS.includes(id) || !['dry', 'live'].includes(mode)) throw new Error('COV_COMPLETION_SELECTION_INVALID');
  const p = await prepareFirstCovBatch(), manifest = p.manifest.filter(m => m.id === id), fixture = p.fixtures.find(f => f.id === id)!;
  if (mode === 'dry') return { mode, id, manifest, manifestHash: covHash(manifest), plannedCalls: 1 };
  const grant = covCompletionGrantSchema.safeParse(options.authorization);
  if (!grant.success || grant.data.exampleId !== id) throw new Error('COV_COMPLETION_UNAUTHORIZED');
  const session = CovExecutionSession.openCompletion(options.authorization, manifest);
  try {
    if (session.stopped) throw new Error();
    if (session.saved(id) === undefined) {
      const client = options.clientFactory ? options.clientFactory() : createCovClientFromSdk(new OpenAI({ baseURL: COV_WIRE_POLICY.endpoint, maxRetries: 0, timeout: COV_FIRST_CONFIG.timeoutMs }));
      const result = await evaluateFixture(fixture, createCovOpenAiRuntimes(COV_FIRST_CONFIG, client, session));
      session.result(id, { id, result, metrics: measure(fixture, result) });
      if (result.status === 'TECHNICAL_FAILURE' || session.stopped) session.stop();
    }
    return { mode, id, stopped: session.stopped, reservedMicroUsd: session.reservedMicroUsd, row: session.saved(id) };
  } catch { session.stop(); throw new Error('COV_COMPLETION_STOPPED_REVIEW_JOURNAL'); }
  finally { session.close(); }
}
