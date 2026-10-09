import OpenAI from 'openai';
import { CovDiagnosticError } from '../../lib/cases/v2/cov-diagnostics';
import { buildCalibrationFixtures } from './fixtures';
import { evaluateFixture, measure } from './runner';
import { covRuntimeRef, projectCovRequest, createCovOpenAiRuntimes, type CovClient, type CovRequest,
  type CovCapability } from '../../lib/cases/v2/cov-semantic-runtime';
import { COV_FIRST_IDS, COV_FIRST_CONFIG, COV_WIRE_POLICY, COV_PRICE, COV_PROPOSED_BUDGET_MICRO_USD,
  covHash, covReservationMicroUsd, validateCovGrant, type CovManifest } from '../../lib/cases/v2/cov-experiment-policy';
import { CovExecutionSession, covSafeMetadata } from '../../lib/cases/v2/cov-execution-session';

/** Builds the exact twelve requests without a client, credentials, or network. */
export async function prepareFirstCovBatch(legacyReportProjection = false) {
  const all = buildCalibrationFixtures();
  const fixtures = COV_FIRST_IDS.map(id => all.find(f => f.id === id)!);
  const manifest: CovManifest = [];
  const requests: ReturnType<typeof projectCovRequest>[] = [];
  for (const fixture of fixtures) {
    let projected: ReturnType<typeof projectCovRequest> | undefined;
    const capture = (capability: CovCapability) => ({ runtimeRef: covRuntimeRef(COV_FIRST_CONFIG, legacyReportProjection ? undefined : capability),
      adjudicate: async (q: CovRequest) => { projected = projectCovRequest(capability, q, COV_FIRST_CONFIG, legacyReportProjection); throw new Error('COV_DRY_CAPTURE'); } });
    await evaluateFixture(fixture, { COV1: capture('COV1'), COV2: capture('COV2'), COV3: capture('COV3') });
    if (!projected) throw new Error('COV_DRY_CAPTURE_FAILED');
    requests.push(projected);
    manifest.push({ id: fixture.id as typeof COV_FIRST_IDS[number], fixtureHash: covHash(fixture),
      requestHash: projected.requestHash, inputBytes: projected.inputBytes });
  }
  return { fixtures, manifest, manifestHash: covHash(manifest), requests };
}

/** Reads the API key only after authorization and journal validation in the caller. */
function realClient(): CovClient {
  const sdk = new OpenAI({ baseURL: COV_WIRE_POLICY.endpoint, maxRetries: 0, timeout: COV_FIRST_CONFIG.timeoutMs });
  return createCovClientFromSdk(sdk);
}
export function createCovClientFromSdk(sdk: Pick<OpenAI, 'baseURL' | 'responses'>): CovClient {
  if (sdk.baseURL !== COV_WIRE_POLICY.endpoint) throw new Error('COV_ENDPOINT_INVALID');
  // Use create + local parsing to retain safe metadata even when JSON parsing fails.
  // No raw response is written or included in errors.
  const parse = async (body: OpenAI.Responses.ResponseCreateParamsNonStreaming, options: OpenAI.RequestOptions) => {
    const response = await sdk.responses.create(body, options);
    try {
      const text = response.output.flatMap(item => item.type === 'message'
        ? item.content.flatMap(c => c.type === 'output_text' ? [c.text] : []) : []).join('');
      // SDK request IDs may be non-enumerable; object spread alone loses them.
      return { ...response, _request_id: response._request_id, output_parsed: JSON.parse(text) as unknown };
    } catch {
      const error = new CovDiagnosticError('RESPONSE_JSON_INVALID');
      const metadata = covSafeMetadata(response);
      Object.assign(error, { id: metadata.responseId, _request_id: metadata.requestId, usage: {
        input_tokens: metadata.inputTokens, output_tokens: metadata.outputTokens,
        input_tokens_details: { cached_tokens: metadata.cachedTokens, cache_write_tokens: metadata.cacheWriteTokens },
        output_tokens_details: { reasoning_tokens: metadata.reasoningTokens },
      } });
      throw error;
    }
  };
  return { baseURL: sdk.baseURL, responses: { parse } } as unknown as CovClient;
}

export async function runFirstCovBatch(options: {
  mode?: 'dry' | 'live'; authorization?: unknown;
  /** Test injection only; production CLI never takes a transport argument. */
  clientFactory?: () => CovClient;
} = {}) {
  const mode = options.mode ?? 'dry';
  if (mode !== 'dry' && mode !== 'live') throw new Error('COV_MODE_INVALID');
  if (mode === 'live' && !options.authorization) throw new Error('COV_LIVE_NOT_AUTHORIZED');
  const { fixtures, manifest, manifestHash } = await prepareFirstCovBatch();
  if (mode === 'dry') return { mode, purpose: 'EXPLORATORY_CALIBRATION', acceptance: 'NOT_ASSESSED',
    config: COV_FIRST_CONFIG, wirePolicy: COV_WIRE_POLICY, price: COV_PRICE, manifest, manifestHash,
    plannedCalls: 12, auxiliaryCalls: 0, proposedBudgetMicroUsd: COV_PROPOSED_BUDGET_MICRO_USD,
    fullInputTokenBound: null, maximumCostMicroUsd: null, budgetStatus: 'COMPLETE_INPUT_COUNTS_REQUIRED',
    sufficientInputTokenCeilingPerRequest: 61600, outputReserveMicroUsd: 1152000,
    authorization: null, measurementsPerformed: false };
  const grant = validateCovGrant(options.authorization, manifest);
  const maximum = grant.inputCounts.reduce((sum, c) => sum + covReservationMicroUsd(c.inputTokens), 0);
  // Reject an underfunded batch before client creation as well as before each individual send.
  if (maximum > grant.budgetMicroUsd) throw new Error('COV_BUDGET_INSUFFICIENT');
  const session = CovExecutionSession.open(grant, manifest);
  const rows: unknown[] = [];
  try {
    if (session.stopped) throw new Error('COV_PREVIOUS_ATTEMPT_STOPPED_OR_UNCERTAIN');
    let runtimes: ReturnType<typeof createCovOpenAiRuntimes> | undefined;
    for (const fixture of fixtures) {
      const saved = session.saved(fixture.id);
      if (saved !== undefined) { rows.push(saved); continue; }
      runtimes ??= createCovOpenAiRuntimes(COV_FIRST_CONFIG, (options.clientFactory ?? realClient)(), session);
      const result = await evaluateFixture(fixture, runtimes);
      // Do not turn a full student-message timeline into a witness archive. Keep selected criterion evidence.
      const retained = 'evidenceTimeline' in result
        ? (({ evidenceTimeline: _timeline, ...rest }) => rest)(result) : result;
      const row = { id: fixture.id, result: retained, metrics: measure(fixture, result) };
      session.result(fixture.id, row); rows.push(row);
      if (result.status === 'TECHNICAL_FAILURE' || session.stopped) {
        session.stop(); throw new Error('COV_TECHNICAL_FAILURE_STOP');
      }
    }
    return { mode, purpose: 'EXPLORATORY_CALIBRATION', acceptance: 'NOT_ASSESSED',
      manifestHash, rows, reservedMicroUsd: session.reservedMicroUsd, maximumCostMicroUsd: maximum };
  } catch {
    session.stop(); throw new Error('COV_BATCH_STOPPED_REVIEW_JOURNAL');
  } finally { session.close(); }
}

// Export only the positive metadata projection, not a raw-response persistence hook.
export { covSafeMetadata };
