import { describe, expect, it, vi } from 'vitest';
import { fixture } from './support/pharmaceutical-session-pipeline-fixture';
import { evaluatePharmaceuticalSessionV2 as evaluate, type EvaluatePharmaceuticalSessionInputV2 } from '../../lib/cases/v2/evaluate-pharmaceutical-session';
import type { PharmaceuticalD1SemanticBatchRequestV2, PharmaceuticalD1ProviderTargetResultV1 } from '../../lib/cases/v2/pharmaceutical-d1-adjudication-types';
import { adjudicatePharmaceuticalD1ContextV2, adjudicatePharmaceuticalD1ContextWithWitnessesV2 } from '../../lib/cases/v2/adjudicate-pharmaceutical-d1-context';
import { adjudicatePharmaceuticalD2ClaimsV2, adjudicatePharmaceuticalD2ClaimsWithWitnessesV2 } from '../../lib/cases/v2/adjudicate-pharmaceutical-d2-claims';
import { validatePharmaceuticalTargetSemanticAdjudicationSetV2 } from '../../lib/cases/v2/validate-pharmaceutical-d1-adjudication';
import { validatePharmaceuticalClinicalClaimFindingSetV2 } from '../../lib/cases/v2/build-pharmaceutical-d2-claim-findings';
import * as scorer from '../../lib/cases/v2/calculate-pharmaceutical-session-score';
import { scoringFingerprint } from '../../lib/cases/v2/pharmaceutical-scoring-contract-utils';
import type { PharmaceuticalD2SemanticRequestV2 } from '../../lib/cases/v2/pharmaceutical-d2-claim-types';

function input(f = fixture()): EvaluatePharmaceuticalSessionInputV2 {
  return { contextSource: f.source.contextSource, context: f.context, configuration: f.config,
    d1SemanticAcceptance: 'VALIDATED_OFFLINE', d2: { status: 'REQUESTED', semanticAcceptance: 'VALIDATED_OFFLINE' } };
}
function dependencies(verdict: 'CORRECTLY_DEMONSTRATED' | 'UNCERTAIN' = 'CORRECTLY_DEMONSTRATED', finding?: 'CONTRADICTORY' | 'UNSUPPORTED') {
  let id = 0;
  const events: string[] = [];
  const allocate = () => `pharm_sem_exec_00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`;
  const providerResult = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: finding ? [{
    messageRef: '1', excerpt: 'Proposición sintética', occurrenceIndex: 0, domain: 'PROFESSIONAL_RESPONSE',
    findingType: finding, claimForm: 'ASSERTION', relatedClinicalRefs: [],
  }] : [] };
  const d1 = { adjudicateBatch: vi.fn(async (request: PharmaceuticalD1SemanticBatchRequestV2) => {
    events.push('D1');
    const results = request.targets.map((target): PharmaceuticalD1ProviderTargetResultV1 => {
      const c = target.studentCandidates[0];
      const evidence = { messageRef: c.messageRef, excerpt: c.untrustedContent, evidenceKind: c.candidateEvidenceKinds[0] };
      return verdict === 'UNCERTAIN' ? { targetRef: target.targetRef, verdict, relatedEvidence: [evidence] }
        : { targetRef: target.targetRef, verdict, supportingEvidence: [evidence] };
    });
    return { provider: 'openai' as const, responseModel: 'synthetic-test-only',
      providerResult: { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d1-provider-result/1', results } };
  }) };
  const d2 = { detectClaims: vi.fn(async () => { events.push('D2');
    return { provider: 'openai' as const, responseModel: 'synthetic-test-only', providerResult }; }) };
  return { d1, d2, allocateD1ExecutionId: allocate, allocateD2ExecutionId: allocate, events, providerResult };
}
function arithmetic(s: Awaited<ReturnType<typeof evaluate>>) {
  return [s.score.result.earned, s.score.result.possible, s.score.result.normalizedScore];
}

describe('E3 real offline composition, synthetic configuration only', () => {
  it('runs real D1/D2, input builder and E2 in order without extra calls', async () => {
    const d = dependencies(), result = await evaluate(input(), d);
    expect(result.score.result.status).toBe('SCORED');
    expect(result.score.result.normalizedScore).toBe(100);
    expect(d.events).toEqual([...Array(d.d1.adjudicateBatch.mock.calls.length).fill('D1'), 'D2']);
    expect(d.d2.detectClaims).toHaveBeenCalledTimes(1);
    expect(result.score.receipt.resultFingerprint).toEqual(result.score.fingerprint);
  });
  it('UNCERTAIN yields zero credit and required review', async () => {
    const r = await evaluate(input(), dependencies('UNCERTAIN'));
    expect(r.score.result.normalizedScore).toBe(0);
    expect(r.score.result.status).toBe('PROVISIONAL_REVIEW_REQUIRED');
    expect(r.score.result.reviewFlags.some(f => f.code === 'UNCERTAIN_D1')).toBe(true);
  });
  it.each(['CONTRADICTORY', 'UNSUPPORTED'] as const)('%s is review-only', async finding => {
    const a = await evaluate(input(), dependencies()), b = await evaluate(input(), dependencies('CORRECTLY_DEMONSTRATED', finding));
    expect(arithmetic(a)).toEqual(arithmetic(b));
    expect(b.score.result.status).toBe('PROVISIONAL_REVIEW_REQUIRED');
    expect(b.score.result.reviewFlags.some(f => f.code === `${finding}_D2`)).toBe(true);
  });
  it.each(['D1', 'D2'] as const)('preserves %s validation debt without penalty', async lane => {
    const i = input();
    const a = await evaluate(i, dependencies());
    const b = await evaluate({ ...i, ...(lane === 'D1' ? { d1SemanticAcceptance: 'VALIDATION_DEBT' as const }
      : { d2: { status: 'REQUESTED' as const, semanticAcceptance: 'VALIDATION_DEBT' as const } }) }, dependencies());
    expect(arithmetic(a)).toEqual(arithmetic(b));
    expect(b.score.result.reviewFlags).toContainEqual({ code: 'UPSTREAM_VALIDATION_DEBT', lane });
    expect(b.score.result.status).toBe('PROVISIONAL_REVIEW_REQUIRED');
  });
  it('distinguishes not requested from requested zero-student D2', async () => {
    const i = input(fixture({ empty: true })), a = dependencies(), b = dependencies();
    const absent = await evaluate({ ...i, d2: { status: 'NOT_PROVIDED', reason: 'NOT_REQUESTED' } }, a);
    const empty = await evaluate(i, b);
    expect(absent.d2).toEqual({ status: 'NOT_PROVIDED', reason: 'NOT_REQUESTED' });
    expect(empty.d2.status).toBe('PROVIDED');
    if (empty.d2.status === 'PROVIDED') {
      expect(empty.d2.findingSet.findings).toEqual([]); expect(empty.d2.executions).toEqual([]);
    }
    for (const d of [a, b]) { expect(d.d1.adjudicateBatch).not.toHaveBeenCalled(); expect(d.d2.detectClaims).not.toHaveBeenCalled(); }
  });
  it('NOT_SCORABLE when no applicable units, not artificial 100', async () => {
    const r = await evaluate(input(fixture({ notApplicable: [0, 1, 2] })), dependencies());
    expect(r.score.result.status).toBe('NOT_SCORABLE'); expect(r.score.result.normalizedScore).toBeNull();
  });
  it.each(['ALL_OF', 'ONE_OF'] as const)('%s does not double-count members', async group => {
    const r = await evaluate(input(fixture({ group, repeated: true })), dependencies());
    expect(r.score.result.possible).toEqual({ numerator: '1', denominator: '1' });
    expect(r.score.result.normalizedScore).toBe(100);
  });
  it.each([undefined, null, {}, { plan: null }])('missing configuration stops before execution: %j', async configuration => {
    const d = dependencies(), score = vi.spyOn(scorer, 'calculatePharmaceuticalSessionScoreV2');
    try {
      await expect(evaluate({ ...input(), configuration }, d)).rejects.toMatchObject({ code: 'PEDAGOGICAL_CONFIGURATION_REQUIRED' });
      expect(d.events).toEqual([]); expect(score).not.toHaveBeenCalled();
    } finally { score.mockRestore(); }
  });
  it.each(['sessionId', 'caseVersionId', 'transcriptFingerprint', 'targetSetFingerprint', 'fingerprint', 'contractVersion'])('prevalidates context %s', async field => {
    const i = input(), context = { ...fixture().context, [field]: 'tampered' }, d = dependencies();
    await expect(evaluate({ ...i, context }, d)).rejects.toThrow(); expect(d.events).toEqual([]);
  });
  it('rejects configuration fingerprint mismatch without masking it as missing pedagogy', async () => {
    const f = fixture(), d = dependencies();
    const configuration = { ...f.config, weights: { ...f.config.weights, fingerprint: { ...f.config.weights.fingerprint, value: 'a'.repeat(64) } } };
    await expect(evaluate({ ...input(f), configuration }, d)).rejects.toMatchObject({ code: 'FINGERPRINT_MISMATCH' });
    expect(d.events).toEqual([]);
  });
  it.each(['UNAPPROVED', 'UNCONFIGURED'] as const)('rejects %s configuration before runtimes', async mode => {
    const f = fixture(), d = dependencies();
    const { fingerprint, ...core } = f.config.rounding;
    const changed = mode === 'UNAPPROVED' ? { ...core, approval: mode }
      : { ...core, configuration: { status: mode, reason: 'DECISION_REQUIRED' } };
    const rounding = { ...changed, fingerprint: scoringFingerprint(fingerprint.canonicalization, changed) };
    await expect(evaluate({ ...input(f), configuration: { ...f.config, rounding } }, d))
      .rejects.toMatchObject({ code: 'PEDAGOGICAL_CONFIGURATION_REQUIRED' });
    expect(d.events).toEqual([]);
  });
  it('rejects tampered upstream targets before adjudication', async () => {
    const i = input(), d = dependencies();
    const contextSource = { ...i.contextSource, targetSet: { ...i.contextSource.targetSet,
      fingerprint: { ...i.contextSource.targetSet.fingerprint, value: 'b'.repeat(64) } } };
    await expect(evaluate({ ...i, contextSource }, d)).rejects.toThrow(); expect(d.events).toEqual([]);
  });
  it('invalid D1 output stops before D2 and scoring', async () => {
    const d = dependencies(), score = vi.spyOn(scorer, 'calculatePharmaceuticalSessionScoreV2');
    d.d1.adjudicateBatch.mockResolvedValueOnce({ provider: 'openai', responseModel: 'synthetic-test-only',
      providerResult: { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d1-provider-result/1', results: [] } });
    try { await expect(evaluate(input(), d)).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESULT' });
      expect(d.d2.detectClaims).not.toHaveBeenCalled(); expect(score).not.toHaveBeenCalled();
    } finally { score.mockRestore(); }
  });
  it('invalid D2 output stops before scoring', async () => {
    const d = dependencies('CORRECTLY_DEMONSTRATED', 'UNSUPPORTED'), score = vi.spyOn(scorer, 'calculatePharmaceuticalSessionScoreV2');
    d.providerResult.findings[0].excerpt = 'not present';
    try { await expect(evaluate(input(), d)).rejects.toMatchObject({ code: 'INVALID_PROVIDER_RESULT' });
      expect(score).not.toHaveBeenCalled();
    } finally { score.mockRestore(); }
  });
  it.each(['D1', 'D2'] as const)('%s failure stops downstream and never fabricates output', async lane => {
    const d = dependencies(), error = new Error(`${lane} failed`), score = vi.spyOn(scorer, 'calculatePharmaceuticalSessionScoreV2');
    if (lane === 'D1') d.d1.adjudicateBatch.mockRejectedValueOnce(error); else d.d2.detectClaims.mockRejectedValueOnce(error);
    try { await expect(evaluate(input(), d)).rejects.toMatchObject({ code: 'PROVIDER_FAILURE' });
      expect(score).not.toHaveBeenCalled(); if (lane === 'D1') expect(d.d2.detectClaims).not.toHaveBeenCalled();
    } finally { score.mockRestore(); }
  });
  it('does not mutate inputs, is deterministic and exposes no witnesses', async () => {
    const i = input(), before = structuredClone(i), a = await evaluate(i, dependencies()), b = await evaluate(i, dependencies());
    expect(i).toEqual(before); expect(a).toEqual(b); expect(Object.isFrozen(a.score.result.unitContributions)).toBe(true);
    for (const key of ['providerResult', 'acceptedBatches', 'studentMessages', 'authorityProjection', 'untrustedContent']) {
      expect(JSON.stringify(a)).not.toContain(`"${key}"`);
    }
  });
  it('snapshots source/config/disposition across awaits', async () => {
    const f = fixture(), i = { ...input(f), contextSource: structuredClone(f.source.contextSource), configuration: structuredClone(f.config) };
    const d = dependencies(), original = d.d1.adjudicateBatch.getMockImplementation()!;
    d.d1.adjudicateBatch.mockImplementationOnce(async request => {
      i.contextSource = { ...i.contextSource, transcript: { ...i.contextSource.transcript, sessionId: 'tampered' } };
      i.d1SemanticAcceptance = 'VALIDATION_DEBT';
      i.configuration.rounding = { ...i.configuration.rounding, approval: 'UNAPPROVED' };
      return original(request);
    });
    expect((await evaluate(i, d)).score.result.status).toBe('SCORED');
  });
});

describe('internal witnesses preserve legacy APIs and validation', () => {
  it('D1 protects context and request while suspended, preserving the original result', async () => {
    const f = fixture(), context = structuredClone(f.context), d = dependencies(), baseline = dependencies();
    const expected = await adjudicatePharmaceuticalD1ContextV2(context, baseline.d1, baseline.allocateD1ExecutionId);
    const original = d.d1.adjudicateBatch.getMockImplementation()!;
    d.d1.adjudicateBatch.mockImplementation(async request => {
      expect(Reflect.set(request, 'sessionId', 'tampered')).toBe(false);
      Reflect.set(context, 'sessionId', 'tampered');
      await Promise.resolve();
      return original(request);
    });
    expect(await adjudicatePharmaceuticalD1ContextV2(context, d.d1, d.allocateD1ExecutionId)).toEqual(expected);
  });
  it('D2 protects request and captures provider before allocation callback mutation', async () => {
    const f = fixture(), d = dependencies('CORRECTLY_DEMONSTRATED', 'UNSUPPORTED');
    const original = d.d2.detectClaims;
    const runtime = { detectClaims: async (request: PharmaceuticalD2SemanticRequestV2) => {
      expect(Reflect.set(request.studentMessages.messages[0], 'untrustedContent', 'tampered')).toBe(false);
      return original();
    } };
    const allocate = () => { d.providerResult.findings[0].excerpt = 'tampered'; return d.allocateD2ExecutionId(); };
    const w = await adjudicatePharmaceuticalD2ClaimsWithWitnessesV2(f.context, runtime, allocate, 'pharmaceutical-d2-semantic-request/2', 'pharmaceutical-d2-claim-prompt/5');
    expect(validatePharmaceuticalClinicalClaimFindingSetV2(w.adjudication.findingSet, w.request, w.providerResult)).toEqual(w.adjudication.findingSet);
    expect(w.adjudication.findingSet.findings[0].excerpt).toBe('Proposición sintética');
  });
  it('D1 exact accepted batches, same legacy result, no extra execution', async () => {
    const f = fixture(), a = dependencies(), b = dependencies();
    const w = await adjudicatePharmaceuticalD1ContextWithWitnessesV2(f.context, a.d1, a.allocateD1ExecutionId);
    expect(w.set).toEqual(await adjudicatePharmaceuticalD1ContextV2(f.context, b.d1, b.allocateD1ExecutionId));
    expect(a.events).toEqual(b.events);
    expect(validatePharmaceuticalTargetSemanticAdjudicationSetV2(w.set, f.context, w.acceptedBatches)).toEqual(w.set);
    expect(Object.isFrozen(w.acceptedBatches)).toBe(true);
    expect(() => validatePharmaceuticalTargetSemanticAdjudicationSetV2(w.set, f.context, [])).toThrow();
  });
  it.each([false, true])('D2 exact witnesses and legacy compatibility, empty=%s', async empty => {
    const f = fixture({ empty }), a = dependencies(), b = dependencies();
    const w = await adjudicatePharmaceuticalD2ClaimsWithWitnessesV2(f.context, a.d2, a.allocateD2ExecutionId, 'pharmaceutical-d2-semantic-request/2', 'pharmaceutical-d2-claim-prompt/5');
    expect(w.adjudication).toEqual(await adjudicatePharmaceuticalD2ClaimsV2(f.context, b.d2, b.allocateD2ExecutionId, 'pharmaceutical-d2-semantic-request/2', 'pharmaceutical-d2-claim-prompt/5'));
    expect(a.events).toEqual(b.events);
    expect(validatePharmaceuticalClinicalClaimFindingSetV2(w.adjudication.findingSet, w.request, w.providerResult)).toEqual(w.adjudication.findingSet);
    expect(Object.isFrozen(w.providerResult)).toBe(true);
    expect(() => validatePharmaceuticalClinicalClaimFindingSetV2(w.adjudication.findingSet, w.request, {})).toThrow();
  });
});
