import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { runR2Diagnostic } from '../../tools/cov-calibration/r2-diagnostic';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { COV_FIRST_CONFIG, COV_WIRE_POLICY, COV_PRICE, covHash } from '../../lib/cases/v2/cov-experiment-policy';
const dirs: string[] = [];
afterEach(() => { dirs.splice(0).forEach(d => {
  expect(dirname(resolve(d))).toBe(resolve(tmpdir()));
  rmSync(d, { recursive: true, force: true });
}); });
async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'cov-r2-test-')); dirs.push(dir);
  const batch = await prepareFirstCovBatch(), now = new Date().toISOString();
  const original = { version: 'cov-authorization/1', purpose: 'EXPLORATORY_CALIBRATION', approval: 'EXPLICIT_USER_AUTHORIZATION',
    authorizationId: 'SYNTHETIC_ORIGINAL', approvedAt: now, expiresAt: new Date(Date.now() + 3600000).toISOString(),
    ledgerDirectory: join(dir, 'original'), manifestHash: batch.manifestHash, config: COV_FIRST_CONFIG,
    wirePolicy: COV_WIRE_POLICY, priceVersion: COV_PRICE.version, currency: 'USD', budgetMicroUsd: 2000000,
    inputCounts: batch.manifest.map(m => ({ id: m.id, requestHash: m.requestHash, source: 'PROVIDER_COMPLETE_INPUT_COUNT', inputTokens: 2364, measuredAt: now })) };
  const parent = CovExecutionSession.open(original, batch.manifest);
  parent.reserve(batch.manifest[0].requestHash, COV_FIRST_CONFIG); parent.result('R1', { result: { status: 'REVIEW_REQUIRED' } });
  parent.reserve(batch.manifest[1].requestHash, COV_FIRST_CONFIG); parent.result('R2', { result: { status: 'TECHNICAL_FAILURE' } }); parent.stop(); parent.close();
  const bytes = readFileSync(join(original.ledgerDirectory, 'journal.jsonl'));
  const manifest = batch.manifest.filter(m => m.id === 'R2');
  const grant = { ...original, version: 'cov-r2-diagnostic-authorization/1', purpose: 'R2_DIAGNOSTIC_ONLY', authorizationId: 'SYNTHETIC_DIAGNOSTIC',
    ledgerDirectory: original.ledgerDirectory + '-r2-diagnostic', manifestHash: covHash(manifest), inputCounts: [original.inputCounts[1]], budgetMicroUsd: 101910,
    parent: { ledgerDirectory: original.ledgerDirectory, journalSha256: createHash('sha256').update(bytes).digest('hex') },
    accumulated: { totalAuthorizedEur: 15, inferenceCeilingMicroUsd: 2000000, priorReservedMicroUsd: 203820, countingCost: null, unknownCountingCostAccepted: true } };
  return { grant, manifest, bytes };
}
function factory(invalid = false) {
  const parse = vi.fn(async (body: { input: string; model: string }) => {
    const q = JSON.parse(body.input);
    return { id: 'resp_diagnostic', _request_id: 'req_diagnostic', model: body.model, status: 'completed', service_tier: 'default', output: [],
      usage: { input_tokens: 2364, output_tokens: 30 }, output_parsed: { contractVersion: 'referral-report-literal-adjudication/2', requestDigest: q.requestDigest,
        documentKind: 'WRITTEN_REPORT', claims: [], criteria: q.untrustedData.requirements.map((r: { contentId: string }) => ({ contentId: r.contentId, status: 'UNCERTAIN',
          reportEvidence: invalid ? [{ quote: 'clinical-secret', occurrence: null }] : [], sourceEvidence: [] })) } };
  });
  return { parse, make: () => ({ baseURL: COV_WIRE_POLICY.endpoint, responses: { parse } }) as never };
}
describe('deliberate isolated R2 diagnostic', () => {
  it('defaults dry and rejects every other example', async () => {
    expect((await runR2Diagnostic()).plannedCalls).toBe(1);
    for (const exampleId of ['R1', 'R3', 'S1', 'P2-WITHDRAW']) await expect(runR2Diagnostic({ exampleId: exampleId as never })).rejects.toThrow('COV_R2_ONLY');
  });
  it('reserves separately, preserves parent, and recovers completion without another call', async () => {
    const { grant, bytes } = await setup(), f = factory();
    const result = await runR2Diagnostic({ mode: 'live', authorization: grant, clientFactory: f.make });
    expect(result.reservedMicroUsd).toBe(101910);
    const again = await runR2Diagnostic({ mode: 'live', authorization: grant, clientFactory: f.make });
    expect(again.recovered).toBe(true); expect(f.parse).toHaveBeenCalledTimes(1);
    expect(readFileSync(join(grant.parent.ledgerDirectory, 'journal.jsonl'))).toEqual(bytes);
  });
  it('retains diagnostics, usage and identifier, stops and never repeats failed inference', async () => {
    const { grant, bytes } = await setup(), f = factory(true);
    await runR2Diagnostic({ mode: 'live', authorization: grant, clientFactory: f.make });
    const journal = readFileSync(join(grant.ledgerDirectory, 'journal.jsonl'), 'utf8');
    expect(journal).toContain('REPORT_CITATION_TEXT_NOT_FOUND'); expect(journal).toContain('req_diagnostic'); expect(journal).toContain('2364'); expect(journal).not.toContain('clinical-secret');
    await expect(runR2Diagnostic({ mode: 'live', authorization: grant, clientFactory: f.make })).rejects.toThrow();
    expect(f.parse).toHaveBeenCalledTimes(1); expect(readFileSync(join(grant.parent.ledgerDirectory, 'journal.jsonl'))).toEqual(bytes);
  });
  it('blocks concurrency and an uncertain reservation after restart', async () => {
    const { grant, manifest } = await setup();
    const first = CovExecutionSession.openR2Diagnostic(grant, manifest);
    try { expect(() => CovExecutionSession.openR2Diagnostic(grant, manifest)).toThrow('COV_LEDGER_LOCKED'); first.reserve(manifest[0].requestHash, COV_FIRST_CONFIG); }
    finally { first.close(); }
    const f = factory(); await expect(runR2Diagnostic({ mode: 'live', authorization: grant, clientFactory: f.make })).rejects.toThrow(); expect(f.parse).not.toHaveBeenCalled();
  });
  it.each(['id', 'directory', 'parentHash', 'expired', 'budget', 'priorReserve'])('blocks altered grant: %s', async kind => {
    const { grant } = await setup(), f = factory();
    if (kind === 'id') grant.inputCounts[0].id = 'R1';
    if (kind === 'directory') grant.ledgerDirectory += '-other';
    if (kind === 'parentHash') grant.parent.journalSha256 = '0'.repeat(64);
    if (kind === 'expired') grant.inputCounts[0].measuredAt = '2020-01-01T00:00:00Z';
    if (kind === 'budget') grant.budgetMicroUsd = 2000000;
    if (kind === 'priorReserve') grant.accumulated.priorReservedMicroUsd = 0;
    await expect(runR2Diagnostic({ mode: 'live', authorization: grant, clientFactory: f.make })).rejects.toThrow(); expect(f.parse).not.toHaveBeenCalled();
  });
});
