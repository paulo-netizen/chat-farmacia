import { describe, expect, it, vi } from 'vitest';
import { buildCalibrationFixtures } from '../../tools/cov-calibration/fixtures';
import { evaluateFixture, measure, runCalibration } from '../../tools/cov-calibration/runner';
import { createCovSimulatedRuntimes, type CovClient, type CovRuntimeConfig } from '../../lib/cases/v2/cov-semantic-runtime';

const config: CovRuntimeConfig = { model: 'gpt-5.6-sol', maxOutputTokens: 4000, maxInputBytes: 100000, timeoutMs: 1000 };
function clientWith(parse: ReturnType<typeof vi.fn>): CovClient { return { responses: { parse } } as unknown as CovClient; }
function span(messageId: string, quote: string) { return { messageId, quote, occurrence: null }; }
// Mechanical provider stub only, independently written; not an oracle of semantic correctness.
function reply(input: string, model = config.model) {
  const q = JSON.parse(input), capability = q.contractVersion;
  let output_parsed: unknown;
  if (capability === 'referral-report-request/1') {
    const quote = q.untrustedData.reportText as string, patient = q.untrustedData.messages[0];
    output_parsed = { contractVersion: 'referral-report-sources-adjudication/3', requestDigest: q.requestDigest,
      documentKind: 'WRITTEN_REPORT', criteria: q.untrustedData.requirements.map((r: { contentId: string }) => ({
        contentId: r.contentId, status: 'DEMONSTRATED', reportEvidence: [{ quote, occurrence: null }],
        sourceEvidence: [{ source: 'TRANSCRIPT', ...span(patient.messageId, patient.content) }],
      })), claims: [] };
  } else if (capability === 'follow-up-plan-request/1') {
    const m = q.untrustedData.messages.find((m: { role: string }) => m.role === 'student');
    output_parsed = { contractVersion: 'follow-up-plan-sources-adjudication/2', requestDigest: q.requestDigest,
      planKind: 'CONCRETE_PLAN', planEvidence: [span(m.messageId, m.content)], relations: [],
      criteria: q.requirements.configuration.elements.map((r: { requirementId: string }) => ({ requirementId: r.requirementId,
        status: 'DEMONSTRATED', studentEvidence: [span(m.messageId, m.content)], contextEvidence: [], observedTriggerForms: [] })) };
  } else {
    const [p, a, v] = q.untrustedData.messages;
    output_parsed = { contractVersion: 'personalization-sources-adjudication/3', requestDigest: q.requestDigest,
      difficulty: { status: 'NOT_OBSERVED', evidence: [] }, incompatibilities: [],
      links: [{ linkId: 'a', circumstances: [{ source: 'TRANSCRIPT', ...span(p.messageId, p.content) }],
        proposal: span(a.messageId, a.content), feasibilityCheck: span(v.messageId, v.content),
        attribution: 'OWN_PROPOSAL', standing: 'CURRENT', patientProposal: null, withdrawal: null,
        patientResponse: null, responseToDifficulty: null }],
      criteria: q.requirements.configuration.elements.map((r: { requirementId: string }, i: number) => ({
        requirementId: r.requirementId, status: i === 2 ? 'NOT_APPLICABLE' : 'DEMONSTRATED', linkRef: i === 2 ? null : 'a', studentEvidence: [] })) };
  }
  return { status: 'completed', model, error: null, output: [], output_parsed };
}
describe('COV calibration materials and protected runner', () => {
  it('materializes distinct sources, explicit requirements and justified cited expectations', () => {
    const fixtures = buildCalibrationFixtures();
    expect(fixtures.length).toBe(33); expect(new Set(fixtures.map(f => f.id)).size).toBe(33);
    const sessions = fixtures.map(f => (f.input.transcript as { sessionId: string }).sessionId);
    expect(new Set(sessions).size).toBe(27); // Intake variants deliberately reuse bound sources.
    for (const f of fixtures) {
      if (f.expectedStatus === 'REVIEW_REQUIRED') expect(f.expected.length).toBeGreaterThan(0);
      expect(f.detects.length).toBeGreaterThan(0);
      const transcript = f.input.transcript as { messages: { messageId: string; content: string }[] };
      for (const e of f.expected) {
        expect(e.rationale.length).toBeGreaterThan(0);
        for (const c of e.evidence) {
          const text = c.source === 'TRANSCRIPT' ? transcript.messages.find(m => m.messageId === c.messageId)?.content
            : (f.input as { submission: { delivery: { text: string } } }).submission.delivery.text;
          expect(text?.slice(c.start, c.end)).toBe(c.quote);
        }
      }
    }
  });
  it('defaults to dry mode, validates inputs and never invokes a supplied client', async () => {
    const parse = vi.fn(); const result = await runCalibration({ client: clientWith(parse) });
    expect(result.mode).toBe('dry'); expect(result.plannedCalls).toBe(27); expect(result.rows).toEqual([]);
    expect(result.acceptance).toBe('NOT_ASSESSED'); expect(parse).not.toHaveBeenCalled();
    expect(result.falsePositives).toBeNull(); expect(result.measurementsPerformed).toBe(false);
  });
  it('blocks live regardless of supplied model, client or environment', async () => {
    const parse = vi.fn();
    await expect(runCalibration({ mode: 'live', config, client: clientWith(parse) })).rejects.toThrow('COV_LIVE_NOT_AUTHORIZED_MODEL_AND_BUDGET');
    expect(parse).not.toHaveBeenCalled();
  });
  it('requires an explicit simulated transport', async () => {
    await expect(runCalibration({ mode: 'simulated' })).rejects.toThrow('SIMULATED_TRANSPORT_REQUIRED');
  });
  it('rejects duplicate IDs and batches exceeding the local cap before calling the provider', async () => {
    const f = buildCalibrationFixtures()[0], parse = vi.fn();
    await expect(runCalibration({ fixtures: [f, f], client: clientWith(parse) })).rejects.toThrow('INVALID_CALIBRATION_SET');
    await expect(runCalibration({ fixtures: Array.from({ length: 43 }, (_, i) => ({ ...f, id: String(i) })) })).rejects.toThrow('INVALID_CALIBRATION_SET');
    expect(parse).not.toHaveBeenCalled();
  });
  it('keeps deterministic intake outcomes separate from semantic execution', async () => {
    const fixtures = buildCalibrationFixtures().filter(f => f.expectedStatus !== 'REVIEW_REQUIRED');
    const parse = vi.fn(); const run = await runCalibration({ mode: 'simulated', fixtures, config, client: clientWith(parse) });
    expect(run.rows.every(r => r.outcomeMatches)).toBe(true); expect(parse).not.toHaveBeenCalled();
    expect(run.plannedCalls).toBe(0);
  });
  it.each(['R3', 'S2', 'S3-ADOPT', 'P2-WITHDRAW'])('retains approved expectation independently of provider output: %s', id => {
    const f = buildCalibrationFixtures().find(f => f.id === id)!;
    const labels = f.expected.map(e => e.status);
    expect(labels).toEqual(id === 'R3' ? ['INSUFFICIENT', 'DEMONSTRATED'] : id === 'S2' ? ['INSUFFICIENT']
      : id === 'S3-ADOPT' ? ['DEMONSTRATED'] : ['DEMONSTRATED', 'DEMONSTRATED', 'DEMONSTRATED']);
  });
});

describe('Real COV adapters with simulated Responses transport only', () => {
  it('sends and validates the identical report text through JSON without Unicode or whitespace normalization', async () => {
    const fixture = buildCalibrationFixtures().find(f => f.id === 'R1')!;
    if (fixture.capability !== 'COV1') throw new Error('TEST_FIXTURE');
    const text = '  Acción 😀\r\nAccio\u0301n\nFin  ';
    fixture.input.submission = { ...(fixture.input.submission as Record<string, unknown>), delivery: { kind: 'SUBMITTED', text } };
    const parse = vi.fn(async params => {
      expect(JSON.parse(params.input).untrustedData.reportText).toBe(text);
      return reply(params.input);
    });
    const result = await evaluateFixture(fixture, createCovSimulatedRuntimes(config, clientWith(parse)));
    expect(result.status).toBe('REVIEW_REQUIRED');
    if (result.contractVersion !== 'referral-report-evaluation/1') throw new Error('TEST_CONTRACT');
    expect(result.criteria[0].reportEvidence).toEqual([{ quote: text, start: 0, end: text.length }]);
  });
  it.each(['R1', 'S1', 'P1'])('executes %s through its evaluator with schema, versions and no expectation leakage', async id => {
    const fixture = buildCalibrationFixtures().find(f => f.id === id)!;
    fixture.notes = 'SECRET_EXPECTATION_SENTINEL'; fixture.expected[0].rationale = 'SECRET_EXPECTATION_SENTINEL';
    const parse = vi.fn(async (params, options) => {
      expect(JSON.stringify(params)).not.toContain('SECRET_EXPECTATION_SENTINEL');
      expect(params.store).toBe(false); expect(params.max_output_tokens).toBe(4000);
      expect(params.text.format.type).toBe('json_schema'); expect(params.text.format.strict).toBe(true);
      if (id === 'R1') {
        const projected = JSON.parse(params.input);
        expect(projected.providerRepresentation).toBe('referral-report-sources-adjudication/3');
        expect(projected.providerInstructionsVersion).toBe('cov-source-literal-instructions/1');
        expect(params.instructions).toContain('Return only referral-report-sources-adjudication/3');
        expect(params.instructions).toContain('For EVERY citation return exact literal quote and occurrence, never start/end offsets.');
        expect(params.instructions).not.toContain('Cite exact UTF-16');
      }
      expect(options).toEqual({ timeout: 1000, maxRetries: 0 });
      return reply(params.input);
    });
    const result = await evaluateFixture(fixture, createCovSimulatedRuntimes(config, clientWith(parse)));
    expect(result.status).toBe('REVIEW_REQUIRED'); expect(parse).toHaveBeenCalledTimes(1);
    expect(result.semanticAcceptance).toBe('PENDING');
    if (id === 'P1') { expect(result.contractVersion).toBe('personalization-evaluation/2'); expect('assessmentBasis' in result && result.assessmentBasis).toBe('OBSERVED_PERFORMANCE'); }
  });
  it('preserves the R2 additional unsupported claim through literal projection and final validation', async () => {
    const fixture = buildCalibrationFixtures().find(f => f.id === 'R2')!;
    const parse = vi.fn(async params => {
      const q = JSON.parse(params.input), message = q.untrustedData.messages[0];
      const source = { source: 'TRANSCRIPT', ...span(message.messageId, message.content) };
      const quote = 'Refiere sensación de giro.';
      return { status: 'completed', model: config.model, error: null, output: [], output_parsed: {
        contractVersion: 'referral-report-sources-adjudication/3', requestDigest: q.requestDigest,
        documentKind: 'WRITTEN_REPORT', criteria: [
          { contentId: q.untrustedData.requirements[0].contentId, status: 'DEMONSTRATED', reportEvidence: [{ quote, occurrence: null }], sourceEvidence: [source] },
          { contentId: q.untrustedData.requirements[1].contentId, status: 'NOT_DEMONSTRATED', reportEvidence: [], sourceEvidence: [source] },
        ], claims: [{ status: 'UNSUPPORTED', reportEvidence: { quote: 'Vive sola.', occurrence: null }, sourceEvidence: [] }],
      } };
    });
    const result = await evaluateFixture(fixture, createCovSimulatedRuntimes(config, clientWith(parse)));
    expect(result.status).toBe('REVIEW_REQUIRED');
    if (result.contractVersion !== 'referral-report-evaluation/1') throw new Error('TEST_CONTRACT');
    expect(result.criteria.map(c => c.status)).toEqual(['DEMONSTRATED', 'NOT_DEMONSTRATED']);
    expect(result.claims).toEqual([{ status: 'UNSUPPORTED', reportEvidence: { quote: 'Vive sola.', start: 27, end: 37 }, sourceEvidence: [] }]);
    expect(result.validation).toBe('STRUCTURAL_ONLY');
    // Constructed transport response; no claim to reproduce either discarded live adjudication.
  });
  it.each(['model', 'incomplete', 'refusal', 'invalid', 'digest', 'exception'])('fails safely without retry: %s', failure => {
    const parse = vi.fn(async params => {
      if (failure === 'exception') throw new Error('clinical-secret');
      const result = reply(params.input) as Record<string, unknown>;
      if (failure === 'model') result.model = 'other';
      if (failure === 'incomplete') result.status = 'incomplete';
      if (failure === 'refusal') result.output = [{ type: 'message', content: [{ type: 'refusal', refusal: 'clinical-secret' }] }];
      if (failure === 'invalid') result.output_parsed = { clinical: 'clinical-secret' };
      if (failure === 'digest') (result.output_parsed as { requestDigest: string }).requestDigest = '0'.repeat(64);
      return result;
    });
    return evaluateFixture(buildCalibrationFixtures()[0], createCovSimulatedRuntimes(config, clientWith(parse))).then(result => {
      expect(result.status).toBe('TECHNICAL_FAILURE'); expect(JSON.stringify(result)).not.toContain('clinical-secret');
      expect(parse).toHaveBeenCalledTimes(1);
    });
  });
  it('rejects excessive request size before the transport', async () => {
    const parse = vi.fn(); const runtime = createCovSimulatedRuntimes({ ...config, maxInputBytes: 1 }, clientWith(parse));
    expect((await evaluateFixture(buildCalibrationFixtures()[0], runtime)).status).toBe('TECHNICAL_FAILURE');
    expect(parse).not.toHaveBeenCalled();
  });
  it('rejects unapproved model aliases before transport creation', () => {
    expect(() => createCovSimulatedRuntimes({ ...config, model: 'latest' as never }, clientWith(vi.fn()))).toThrow('COV_TRANSPORT_FAILURE');
  });
  it('isolates configuration and provider results during await', async () => {
    const owned = { ...config }; let release!: () => void; let response!: ReturnType<typeof reply>;
    const parse = vi.fn(async params => { response = reply(params.input); await new Promise<void>(resolve => { release = resolve; }); return response; });
    const pending = evaluateFixture(buildCalibrationFixtures()[0], createCovSimulatedRuntimes(owned, clientWith(parse)));
    owned.model = 'gpt-5.6-terra'; release(); const result = await pending;
    (response.output_parsed as { criteria: unknown[] }).criteria.length = 0;
    expect(result.criteria.length).toBe(2); expect(result.runtimeRef).toContain('gpt-5.6-sol');
  });
  it('counts false positives, missing claims and technical failures rather than declaring acceptance', async () => {
    const fixtures = buildCalibrationFixtures().filter(f => ['R3', 'R2'].includes(f.id));
    const parse = vi.fn(async params => reply(params.input));
    const run = await runCalibration({ mode: 'simulated', fixtures, config, client: clientWith(parse) });
    expect(run.falsePositives).toBe(2); expect(run.rows.flatMap(r => r.claimChecks).every(c => c.actual === 'MISSING')).toBe(true);
    expect(run.acceptance).toBe('NOT_ASSESSED'); expect(run.confusion).not.toEqual({});
  });
  it('records technical failures without converting them to academic false negatives', async () => {
    const parse = vi.fn(async () => { throw new Error('secret'); });
    const run = await runCalibration({ mode: 'simulated', fixtures: [buildCalibrationFixtures()[0]], config, client: clientWith(parse) });
    expect(run.technicalFailures).toBe(1); expect(run.falseNegatives).toBe(0);
    expect(run.rows[0].criteria.every(c => c.actual === 'TECHNICAL_FAILURE')).toBe(true);
    expect(JSON.stringify(run)).not.toContain('secret');
  });
  it('separates justified abstention from false negatives and technical errors', async () => {
    const f = buildCalibrationFixtures().find(f => f.id === 'R3')!;
    const result = await evaluateFixture(f, createCovSimulatedRuntimes(config, clientWith(vi.fn(async params => reply(params.input)))));
    const altered = structuredClone(result); altered.criteria[0].status = 'INSUFFICIENT'; altered.criteria[1].status = 'NOT_DEMONSTRATED';
    const measured = measure(f, altered);
    expect(measured.criteria[0].exact).toBe(true); expect(measured.criteria[0].abstention).toBe(true);
    expect(measured.criteria[1].falseNegative).toBe(true);
  });
});
