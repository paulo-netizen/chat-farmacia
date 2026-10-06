import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { prepareFirstCovBatch, runFirstCovBatch, createCovClientFromSdk } from '../../tools/cov-calibration/first-batch';
import { COV_FIRST_CONFIG, COV_FIRST_IDS, COV_WIRE_POLICY, COV_PRICE, covHash,
  covReservationMicroUsd, type CovGrant } from '../../lib/cases/v2/cov-experiment-policy';
import { CovExecutionSession, covSafeMetadata } from '../../lib/cases/v2/cov-execution-session';
import { createCovOpenAiRuntimes, type CovClient } from '../../lib/cases/v2/cov-semantic-runtime';
import { evaluateFixture } from '../../tools/cov-calibration/runner';

vi.mock('node:fs', async importOriginal => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, fsyncSync: vi.fn(actual.fsyncSync) };
});

const directories: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  for (const path of directories.splice(0)) {
    expect(dirname(resolve(path))).toBe(resolve(tmpdir()));
    fs.rmSync(path, { recursive: true, force: true });
  }
});
async function setup() {
  const prepared = await prepareFirstCovBatch();
  const directory = fs.mkdtempSync(join(tmpdir(), 'cov-first-controls-')); directories.push(directory);
  const now = Date.now();
  // Synthetic count attestations/approvals for transport tests, NOT measurements or live permission.
  const grant: CovGrant = { version: 'cov-authorization/1', purpose: 'EXPLORATORY_CALIBRATION',
    approval: 'EXPLICIT_USER_AUTHORIZATION', authorizationId: 'SYNTHETIC_TEST_ONLY',
    approvedAt: new Date(now - 1000).toISOString(), expiresAt: new Date(now + 3600000).toISOString(),
    ledgerDirectory: directory, manifestHash: prepared.manifestHash, config: { ...COV_FIRST_CONFIG },
    wirePolicy: { ...COV_WIRE_POLICY }, priceVersion: COV_PRICE.version, currency: 'USD', budgetMicroUsd: 3000000,
    inputCounts: prepared.manifest.map(m => ({ id: m.id, requestHash: m.requestHash,
      source: 'PROVIDER_COMPLETE_INPUT_COUNT', inputTokens: 5000, measuredAt: new Date(now - 1000).toISOString() })) };
  return { ...prepared, directory, grant };
}
function client(parse: ReturnType<typeof vi.fn>): CovClient { return { baseURL: COV_WIRE_POLICY.endpoint, responses: { parse } } as unknown as CovClient; }
// Intentionally abstains, including on expected positives. Tests mechanics, never semantic quality.
function abstain(body: { input: string; model: string }) {
  const q = JSON.parse(body.input);
  const common = { requestDigest: q.requestDigest };
  const result = q.contractVersion === 'referral-report-request/1'
    ? { ...common, contractVersion: 'referral-report-adjudication/1', documentKind: 'WRITTEN_REPORT', claims: [],
      criteria: q.untrustedData.requirements.map((r: { contentId: string }) => ({ contentId: r.contentId,
        status: 'UNCERTAIN', reportEvidence: [], sourceEvidence: [] })) }
    : q.contractVersion === 'follow-up-plan-request/1'
      ? { ...common, contractVersion: 'follow-up-plan-adjudication/1', planKind: 'UNCERTAIN', planEvidence: [], relations: [],
        criteria: q.requirements.configuration.elements.map((r: { requirementId: string }) => ({ requirementId: r.requirementId,
          status: 'UNCERTAIN', studentEvidence: [], contextEvidence: [], observedTriggerForms: [] })) }
      : { ...common, contractVersion: 'personalization-adjudication/2', difficulty: { status: 'UNCERTAIN', evidence: [] }, links: [], incompatibilities: [],
        criteria: q.requirements.configuration.elements.map((r: { requirementId: string }) => ({ requirementId: r.requirementId,
          status: 'UNCERTAIN', linkRef: null, studentEvidence: [] })) };
  return { id: 'resp_test', _request_id: 'req_test', status: 'completed', service_tier: 'default', model: body.model,
    error: null, output: [], output_parsed: result, usage: { input_tokens: 4500, output_tokens: 100,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 4000 }, output_tokens_details: { reasoning_tokens: 20 } } };
}
function journal(directory: string) { return fs.readFileSync(join(directory, 'journal.jsonl'), 'utf8'); }

describe('closed COV twelve-example execution', () => {
  it('defaults dry with exact closed selection and an honestly unresolved full input bound', async () => {
    const factory = vi.fn(); const result = await runFirstCovBatch({ clientFactory: factory });
    expect(result.mode).toBe('dry'); expect('manifest' in result && result.manifest?.map(m => m.id)).toEqual(COV_FIRST_IDS);
    expect('maximumCostMicroUsd' in result && result.maximumCostMicroUsd).toBeNull();
    expect(factory).not.toHaveBeenCalled();
  });
  it('blocks live and direct real adapter use without authorization', async () => {
    const factory = vi.fn(), parse = vi.fn();
    await expect(runFirstCovBatch({ mode: 'live', clientFactory: factory })).rejects.toThrow('COV_LIVE_NOT_AUTHORIZED');
    expect(() => createCovOpenAiRuntimes(COV_FIRST_CONFIG, client(parse))).toThrow('COV_TRANSPORT_FAILURE');
    expect(() => createCovOpenAiRuntimes(COV_FIRST_CONFIG, client(parse), {} as never)).toThrow('COV_TRANSPORT_FAILURE');
    expect(factory).not.toHaveBeenCalled(); expect(parse).not.toHaveBeenCalled();
  });
  it.each(['model', 'config', 'missingCounts', 'wrongPayload', 'expired', 'wirePolicy', 'duplicate'])('rejects incompatible authorization: %s', async defect => {
    const { grant } = await setup(); const factory = vi.fn();
    if (defect === 'model') grant.config.model = 'gpt-5.6-sol' as never;
    if (defect === 'config') grant.config.maxOutputTokens = 4000 as never;
    if (defect === 'missingCounts') grant.inputCounts = [];
    if (defect === 'wrongPayload') grant.inputCounts[0].requestHash = 'a'.repeat(64);
    if (defect === 'expired') grant.expiresAt = new Date(0).toISOString();
    if (defect === 'wirePolicy') grant.wirePolicy.serviceTier = 'auto' as never;
    if (defect === 'duplicate') grant.inputCounts[1] = grant.inputCounts[0];
    await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: factory })).rejects.toThrow();
    expect(factory).not.toHaveBeenCalled();
  });
  it('rejects insufficient total budget before constructing any transport', async () => {
    const { grant } = await setup(); grant.budgetMicroUsd = 1; const factory = vi.fn();
    await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: factory })).rejects.toThrow('COV_BUDGET_INSUFFICIENT');
    expect(factory).not.toHaveBeenCalled();
  });
  it('reserves per request even for direct adapter use', async () => {
    const { grant, manifest, fixtures } = await setup(); grant.budgetMicroUsd = 1;
    const session = CovExecutionSession.open(grant, manifest), parse = vi.fn();
    try {
      const result = await evaluateFixture(fixtures[0], createCovOpenAiRuntimes(COV_FIRST_CONFIG, client(parse), session));
      expect(result.status).toBe('TECHNICAL_FAILURE'); expect(parse).not.toHaveBeenCalled(); expect(session.stopped).toBe(true);
    } finally { session.close(); }
  });
  it('stops direct adapter execution for a configuration mismatch', async () => {
    const { grant, manifest, fixtures } = await setup();
    const session = CovExecutionSession.open(grant, manifest), parse = vi.fn();
    try {
      const result = await evaluateFixture(fixtures[0], createCovOpenAiRuntimes({ ...COV_FIRST_CONFIG, maxOutputTokens: 7999 }, client(parse), session));
      expect(result.status).toBe('TECHNICAL_FAILURE'); expect(parse).not.toHaveBeenCalled(); expect(session.stopped).toBe(true);
    } finally { session.close(); }
  });
  it('computes the 3 USD condition using complete attested counts, including output reasoning', () => {
    expect(12 * covReservationMicroUsd(61600)).toBe(3000000);
    expect(12 * covReservationMicroUsd(61601)).toBeGreaterThan(3000000);
    expect(() => covReservationMicroUsd(272001)).toThrow();
  });
  it('keeps only safe metadata from an SDK parse exception', async () => {
    const { grant, directory } = await setup();
    const parse = vi.fn(async () => { throw Object.assign(new Error('clinical-secret'), {
      id: 'resp_parse', request_id: 'req_parse', usage: { input_tokens: 4500, output_tokens: 90 },
      body: 'clinical-secret', headers: { authorization: 'clinical-secret' } }); });
    await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: () => client(parse) })).rejects.toThrow();
    expect(journal(directory)).toContain('resp_parse'); expect(journal(directory)).toContain('4500');
    expect(journal(directory)).not.toContain('clinical-secret'); expect(parse).toHaveBeenCalledTimes(1);
  });
  it('does not resend if the result cannot be flushed after a successful response', async () => {
    const { grant, directory } = await setup();
    const parse = vi.fn(async body => { vi.mocked(fs.fsyncSync).mockImplementationOnce(() => { throw new Error('disk'); }); return abstain(body); });
    await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: () => client(parse) })).rejects.toThrow();
    const factory = vi.fn(); await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: factory })).rejects.toThrow();
    expect(parse).toHaveBeenCalledTimes(1); expect(factory).not.toHaveBeenCalled(); expect(journal(directory)).toContain('RESERVED');
  });
  it('records all valid disagreements and recovers completed results without constructing a client', async () => {
    const { grant, directory } = await setup();
    const parse = vi.fn(async body => {
      expect(journal(directory)).toContain('RESERVED');
      expect(body.reasoning).toEqual({ effort: 'medium' }); expect(body.service_tier).toBe('default');
      expect(body.max_output_tokens).toBe(8000); return abstain(body);
    });
    const result = await runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: () => client(parse) });
    expect(parse).toHaveBeenCalledTimes(12); expect(result.acceptance).toBe('NOT_ASSESSED');
    const factory = vi.fn(); const resumed = await runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: factory });
    expect(resumed).toEqual(result); expect(factory).not.toHaveBeenCalled();
    expect(journal(directory)).toContain('missedPositiveByAbstention');
    expect(journal(directory)).not.toContain('evidenceTimeline');
  });
  it('retains uncertain timeout cost and never resends on restart', async () => {
    const { grant, directory } = await setup(); const parse = vi.fn(async () => { throw new Error('clinical-secret'); });
    await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: () => client(parse) })).rejects.toThrow('COV_BATCH_STOPPED');
    const factory = vi.fn(); await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: factory })).rejects.toThrow();
    expect(parse).toHaveBeenCalledTimes(1); expect(factory).not.toHaveBeenCalled();
    const text = journal(directory); expect(text).toContain(String(covReservationMicroUsd(5000))); expect(text).not.toContain('clinical-secret');
  });
  it('blocks concurrent execution while an awaited transport is outstanding', async () => {
    const { grant } = await setup(); let release!: () => void, started!: () => void;
    const ready = new Promise<void>(resolve => { started = resolve; });
    const parse = vi.fn(async body => { if (!release) { started(); await new Promise<void>(resolve => { release = resolve; }); } return abstain(body); });
    const first = runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: () => client(parse) }); await ready;
    const factory = vi.fn(); await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: factory })).rejects.toThrow('COV_LEDGER_LOCKED');
    expect(factory).not.toHaveBeenCalled(); release(); await first; expect(parse).toHaveBeenCalledTimes(12);
  });
  it('never reclaims stale locks or resends a durable reservation without completion', async () => {
    const { grant, manifest, directory } = await setup();
    fs.writeFileSync(join(directory, 'execution.lock'), '');
    expect(() => CovExecutionSession.open(grant, manifest)).toThrow('COV_LEDGER_LOCKED');
    fs.unlinkSync(join(directory, 'execution.lock'));
    const session = CovExecutionSession.open(grant, manifest);
    session.reserve(manifest[0].requestHash, COV_FIRST_CONFIG); session.close();
    const resumed = CovExecutionSession.open(grant, manifest);
    try { expect(resumed.stopped).toBe(true); expect(() => resumed.reserve(manifest[0].requestHash, COV_FIRST_CONFIG)).toThrow(); }
    finally { resumed.close(); }
  });
  it('does not send when flushing a reservation fails', async () => {
    const { grant, manifest, fixtures } = await setup(); const session = CovExecutionSession.open(grant, manifest);
    const parse = vi.fn(); const flush = vi.spyOn(fs, 'fsyncSync').mockImplementation(() => { throw new Error('secret disk failure'); });
    try {
      const result = await evaluateFixture(fixtures[0], createCovOpenAiRuntimes(COV_FIRST_CONFIG, client(parse), session));
      expect(result.status).toBe('TECHNICAL_FAILURE'); expect(parse).not.toHaveBeenCalled(); expect(session.stopped).toBe(true);
      expect(JSON.stringify(result)).not.toContain('secret');
    } finally { flush.mockRestore(); session.close(); }
  });
  it('recovers a technical result as stopped even if the separate STOP record was never written', async () => {
    const { grant, manifest } = await setup(); const s = CovExecutionSession.open(grant, manifest);
    s.reserve(manifest[0].requestHash, COV_FIRST_CONFIG);
    s.result('R1', { result: { status: 'TECHNICAL_FAILURE' } }); s.close();
    const recovered = CovExecutionSession.open(grant, manifest);
    try { expect(recovered.stopped).toBe(true); expect(() => recovered.reserve(manifest[1].requestHash, COV_FIRST_CONFIG)).toThrow(); }
    finally { recovered.close(); }
  });
  it.each(['model', 'service', 'parse', 'overUsage'])('stops after provider failure and records no raw content: %s', async failure => {
    const { grant, directory } = await setup();
    const parse = vi.fn(async body => {
      const r = abstain(body);
      if (failure === 'model') r.model = 'other';
      if (failure === 'service') r.service_tier = 'priority';
      if (failure === 'parse') r.output_parsed = { secret: 'clinical-secret' } as never;
      if (failure === 'overUsage') r.usage.input_tokens = 5001;
      return { ...r, raw: 'clinical-secret' };
    });
    await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: () => client(parse) })).rejects.toThrow();
    expect(parse).toHaveBeenCalledTimes(1); expect(journal(directory)).not.toContain('clinical-secret');
    expect(journal(directory)).toContain('resp_test'); expect(journal(directory)).toContain('inputTokens');
    expect(journal(directory)).toContain(failure === 'parse' ? 'PROVIDER_SCHEMA_INVALID'
      : failure === 'overUsage' ? 'METADATA_FAILED' : 'RESPONSE_ENVELOPE_INVALID');
  });
  it('rejects torn journals without network or automatic reconciliation', async () => {
    const { grant, directory, manifest } = await setup(); const s = CovExecutionSession.open(grant, manifest); s.close();
    fs.appendFileSync(join(directory, 'journal.jsonl'), '{'); const factory = vi.fn();
    await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: factory })).rejects.toThrow('COV_JOURNAL');
    expect(factory).not.toHaveBeenCalled();
  });
  it('projects metadata safely even from a parse exception', () => {
    expect(covSafeMetadata({ id: 'resp_test', request_id: 'req_test', message: 'secret', body: 'secret',
      headers: { authorization: 'secret' }, usage: { input_tokens: 10, output_tokens: 20 } }))
      .toEqual({ responseId: 'resp_test', requestId: 'req_test', inputTokens: 10, outputTokens: 20 });
    expect(covSafeMetadata({ id: 'clinical text', usage: { input_tokens: -1 } })).toEqual({});
  });
  it('the real SDK wrapper retains usage when local JSON parsing fails, never raw content', async () => {
    const { grant, directory } = await setup();
    const create = vi.fn(async () => ({ id: 'resp_badjson', _request_id: 'req_badjson', status: 'completed',
      model: 'gpt-5.6-terra', service_tier: 'default', usage: { input_tokens: 4500, output_tokens: 22 },
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'clinical-secret invalid JSON' }] }] }));
    const wrapper = createCovClientFromSdk({ baseURL: COV_WIRE_POLICY.endpoint, responses: { create } } as never);
    await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: () => wrapper })).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(1); expect(journal(directory)).toContain('resp_badjson');
    expect(journal(directory)).toContain('RESPONSE_JSON_INVALID');
    expect(journal(directory)).toContain('4500'); expect(journal(directory)).not.toContain('clinical-secret');
    expect(create.mock.calls[0]).toBeDefined();
  });
  it('never mutates authorization and binds its exact manifest', async () => {
    const { grant, manifest } = await setup(), before = covHash(grant); const session = CovExecutionSession.open(grant, manifest);
    grant.config.model = 'other' as never;
    try { session.reserve(manifest[0].requestHash, COV_FIRST_CONFIG); expect(session.reservedMicroUsd).toBe(covReservationMicroUsd(5000)); }
    finally { session.close(); }
    expect(covHash(grant)).not.toBe(before);
  });
  it('preserves non-enumerable SDK request IDs and usage after domain validation rejects a citation', async () => {
    const { grant, directory } = await setup();
    const create = vi.fn(async (body: { input: string; model: string }) => {
      const response = abstain(body);
      const parsed = response.output_parsed as { criteria: { reportEvidence: unknown[] }[] };
      parsed.criteria[0].reportEvidence = [{ start: 0, end: 1, quote: 'clinical-secret' }];
      const wire = { ...response, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(parsed) }] }] };
      Object.defineProperty(wire, '_request_id', { value: 'req_non_enumerable', enumerable: false });
      return wire;
    });
    const wrapper = createCovClientFromSdk({ baseURL: COV_WIRE_POLICY.endpoint, responses: { create } } as never);
    await expect(runFirstCovBatch({ mode: 'live', authorization: grant, clientFactory: () => wrapper })).rejects.toThrow();
    expect(create).toHaveBeenCalledTimes(1);
    const stored = journal(directory);
    expect(stored).toContain('REPORT_CITATION_INVALID'); expect(stored).toContain('req_non_enumerable');
    expect(stored).toContain('4500'); expect(stored).not.toContain('clinical-secret');
  });
  it('does not attach arbitrary provider usage fields or raw content to a parse error', async () => {
    const create = vi.fn(async () => ({ id: 'resp_parse', _request_id: 'req_parse',
      usage: { input_tokens: 10, output_tokens: 5, 'clinical-secret': 'private-value' },
      output: [{ type: 'message', content: [{ type: 'output_text', text: 'clinical-secret' }] }] }));
    const wrapper = createCovClientFromSdk({ baseURL: COV_WIRE_POLICY.endpoint, responses: { create } } as never);
    try {
      await wrapper.responses.parse({ model: 'gpt-5.6-terra', input: 'synthetic' });
      expect.fail('must reject');
    } catch (error) {
      expect(covSafeMetadata(error)).toEqual({ responseId: 'resp_parse', requestId: 'req_parse', inputTokens: 10, outputTokens: 5 });
      expect(String(error) + JSON.stringify(error)).not.toMatch(/clinical-secret|private-value/);
    }
    expect(create).toHaveBeenCalledTimes(1);
  });
});
