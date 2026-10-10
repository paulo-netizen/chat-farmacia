import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { runCovContinuation } from '../../tools/cov-calibration/continuation';
import { CovExecutionSession } from '../../lib/cases/v2/cov-execution-session';
import { COV_FIRST_CONFIG, COV_WIRE_POLICY, COV_PRICE, covHash } from '../../lib/cases/v2/cov-experiment-policy';
const dirs: string[] = [];
afterEach(() => { dirs.splice(0).forEach(d => { expect(dirname(resolve(d))).toBe(resolve(tmpdir())); rmSync(d, { recursive: true, force: true }); }); });
async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'cov-continuation-')); dirs.push(dir);
  const root = join(dir, 'original');
  const parents = [root, root + '-r2-diagnostic'].map((ledgerDirectory, i) => {
    mkdirSync(ledgerDirectory); let previous = '0'.repeat(64);
    const events = [{ kind: 'INIT', data: 'synthetic' },
      ...(i === 0 ? [{ kind: 'RESERVED', id: 'R1', data: 101910 }, { kind: 'RESULT', id: 'R1', data: { result: { status: 'REVIEW_REQUIRED' } } }] : []),
      { kind: 'RESERVED', id: 'R2', data: 101910 }, { kind: 'RESULT', id: 'R2', data: { result: { status: 'TECHNICAL_FAILURE' } } }, { kind: 'STOP', data: null }];
    const text = events.map((event, seq) => { const unsigned = { seq, previous, event }; previous = covHash(unsigned); return JSON.stringify({ ...unsigned, checksum: previous }); }).join('\n') + '\n';
    writeFileSync(join(ledgerDirectory, 'journal.jsonl'), text);
    return { ledgerDirectory, journalSha256: createHash('sha256').update(text).digest('hex') };
  });
  const prepared = await prepareFirstCovBatch(), manifest = prepared.manifest.slice(1), now = new Date().toISOString();
  const grant = { version: 'cov-literal-continuation-authorization/1', purpose: 'R2_THEN_TEN_PENDING', approval: 'EXPLICIT_USER_AUTHORIZATION',
    authorizationId: 'SYNTHETIC_CONTINUATION', approvedAt: now, expiresAt: new Date(Date.now() + 3600000).toISOString(),
    ledgerDirectory: root + '-literal-continuation', manifestHash: covHash(manifest), config: COV_FIRST_CONFIG, wirePolicy: COV_WIRE_POLICY,
    priceVersion: COV_PRICE.version, currency: 'USD', budgetMicroUsd: 1200000,
    inputCounts: manifest.map(m => ({ id: m.id, requestHash: m.requestHash, source: 'PROVIDER_COMPLETE_INPUT_COUNT', inputTokens: 3000, measuredAt: now })),
    parents, accumulated: { totalAuthorizedEur: 15, inferenceCeilingMicroUsd: 2000000, priorReservedMicroUsd: 305730, countingCost: null, unknownCountingCostAccepted: true } };
  return { grant, manifest, originals: parents.map(p => readFileSync(join(p.ledgerDirectory, 'journal.jsonl'))) };
}
function transport(failure?: 'invalid' | 'timeout') {
  const parse = vi.fn(async (body: { input: string; model: string }) => {
    if (failure === 'timeout') throw new Error('private-secret');
    const q = JSON.parse(body.input);
    const common = { requestDigest: q.requestDigest };
    const result = q.contractVersion === 'referral-report-request/1'
      ? { ...common, contractVersion: 'referral-report-sources-adjudication/3', documentKind: 'WRITTEN_REPORT', claims: [],
        criteria: q.untrustedData.requirements.map((r: { contentId: string }) => ({ contentId: r.contentId, status: 'UNCERTAIN', reportEvidence: [], sourceEvidence: [] })) }
      : q.contractVersion === 'follow-up-plan-request/1'
        ? { ...common, contractVersion: 'follow-up-plan-sources-adjudication/2', planKind: 'UNCERTAIN', planEvidence: [], relations: [],
          criteria: q.requirements.configuration.elements.map((r: { requirementId: string }) => ({ requirementId: r.requirementId, status: 'UNCERTAIN', studentEvidence: [], contextEvidence: [], observedTriggerForms: [] })) }
        : { ...common, contractVersion: 'personalization-sources-adjudication/3', difficulty: { status: 'UNCERTAIN', evidence: [] }, links: [], incompatibilities: [],
          criteria: q.requirements.configuration.elements.map((r: { requirementId: string }) => ({ requirementId: r.requirementId, status: 'UNCERTAIN', linkRef: null, studentEvidence: [] })) };
    return { id: 'resp_synthetic', _request_id: 'req_synthetic', status: 'completed', model: body.model, service_tier: 'default', output: [],
      usage: { input_tokens: 3000, output_tokens: 100 }, output_parsed: failure === 'invalid' ? {} : result };
  });
  return { parse, factory: () => ({ baseURL: COV_WIRE_POLICY.endpoint, responses: { parse } }) as never };
}
describe('closed literal continuation, simulated transport only', () => {
  it('defaults dry with exactly R2 followed by ten pending and no R1', async () => {
    const dry = await runCovContinuation(); expect(dry.plannedCalls).toBe(11); expect('ids' in dry && dry.ids).toEqual(['R2','R3','R-INJECTION','S1','S2','S3-ADOPT','S4-CONFLICT','P1','P2-WITHDRAW','P3-ADOPT','P4-LATE']);
  });
  it('retains valid disagreements, preserves both ancestors and never repeats completed calls', async () => {
    const { grant, originals } = await setup(), fake = transport();
    const result = await runCovContinuation({ mode: 'live', authorization: grant, clientFactory: fake.factory });
    expect(result.stopped).toBe(false); expect(result.rows).toHaveLength(11); expect(fake.parse).toHaveBeenCalledTimes(11);
    await runCovContinuation({ mode: 'live', authorization: grant, clientFactory: () => { throw new Error('must not create'); } });
    grant.parents.forEach((p, i) => expect(readFileSync(join(p.ledgerDirectory, 'journal.jsonl'))).toEqual(originals[i]));
  });
  it.each(['invalid', 'timeout'] as const)('stops at R2 after %s and cannot restart or lose its reserve', async failure => {
    const { grant } = await setup(), fake = transport(failure);
    const result = await runCovContinuation({ mode: 'live', authorization: grant, clientFactory: fake.factory });
    expect(result.stopped).toBe(true); expect(result.rows).toHaveLength(1); expect(result.reservedMicroUsd).toBe(103500);
    await expect(runCovContinuation({ mode: 'live', authorization: grant, clientFactory: fake.factory })).rejects.toThrow();
    expect(fake.parse).toHaveBeenCalledTimes(1);
    const journal = readFileSync(join(grant.ledgerDirectory, 'journal.jsonl'), 'utf8'); expect(journal).not.toContain('private-secret');
    if (failure === 'invalid') { expect(journal).toContain('PROVIDER_SCHEMA_INVALID'); expect(journal).toContain('req_synthetic'); expect(journal).toContain('3000'); }
  });
  it('blocks concurrent sessions, out-of-order requests and restart after an uncertain reservation', async () => {
    const { grant, manifest } = await setup(); const first = CovExecutionSession.openContinuation(grant, manifest);
    try {
      expect(() => CovExecutionSession.openContinuation(grant, manifest)).toThrow('COV_LEDGER_LOCKED');
      expect(() => first.reserve(manifest[1].requestHash, COV_FIRST_CONFIG)).toThrow('COV_REQUEST_NOT_AUTHORIZED');
      first.reserve(manifest[0].requestHash, COV_FIRST_CONFIG);
    } finally { first.close(); }
    const fake = transport(); await expect(runCovContinuation({ mode: 'live', authorization: grant, clientFactory: fake.factory })).rejects.toThrow(); expect(fake.parse).not.toHaveBeenCalled();
  });
  it('enforces R2 technical gate in the session even outside the runner', async () => {
    const { grant, manifest } = await setup(), session = CovExecutionSession.openContinuation(grant, manifest);
    try { session.reserve(manifest[0].requestHash, COV_FIRST_CONFIG); session.result('R2', { result: { status: 'INSUFFICIENT' } });
      expect(() => session.reserve(manifest[1].requestHash, COV_FIRST_CONFIG)).toThrow('COV_R2_TECHNICAL_GATE_REQUIRED');
    } finally { session.close(); }
  });
  it.each(['R1', 'reorder', 'directory', 'parentHash', 'expired', 'budget', 'prior', 'model', 'manifest'])('rejects invalid scope/configuration: %s', async change => {
    const { grant } = await setup(), fake = transport();
    if (change === 'R1') grant.inputCounts[0].id = 'R1';
    if (change === 'reorder') grant.inputCounts.reverse();
    if (change === 'directory') grant.ledgerDirectory += '-another';
    if (change === 'parentHash') grant.parents[1].journalSha256 = '0'.repeat(64);
    if (change === 'expired') grant.inputCounts[0].measuredAt = '2020-01-01T00:00:00Z';
    if (change === 'budget') grant.budgetMicroUsd = 1;
    if (change === 'prior') grant.accumulated.priorReservedMicroUsd = 0;
    if (change === 'model') grant.config = { ...grant.config, model: 'invalid' as never };
    if (change === 'manifest') grant.manifestHash = '0'.repeat(64);
    await expect(runCovContinuation({ mode: 'live', authorization: grant, clientFactory: fake.factory })).rejects.toThrow(); expect(fake.parse).not.toHaveBeenCalled();
  });
});
