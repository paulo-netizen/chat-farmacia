import { describe, expect, it } from 'vitest';
import { calculatePharmaceuticalSessionScoreV2 as calculate } from '../../lib/cases/v2/calculate-pharmaceutical-session-score';
import { validatePharmaceuticalSessionScoreV2 } from '../../lib/cases/v2/validate-pharmaceutical-session-score';
import { buildPharmaceuticalScoreInputV2, canonicalPharmaceuticalReviewFlags, type PharmaceuticalScoreSourceV2 } from '../../lib/cases/v2/build-pharmaceutical-score-input';
import { buildPharmaceuticalScoringPlanV2, pharmaceuticalScoringExpectationBinding } from '../../lib/cases/v2/build-pharmaceutical-scoring-plan';
import {
  buildPharmaceuticalScoringPolicyV2, buildPharmaceuticalScoringRoundingV2, buildPharmaceuticalScoringThresholdsV2,
  buildPharmaceuticalScoringWeightsV2, pharmaceuticalScoringConfigBinding,
} from '../../lib/cases/v2/build-pharmaceutical-scoring-policy';
import { PharmaceuticalScoringValidationError, scoringFingerprint } from '../../lib/cases/v2/pharmaceutical-scoring-contract-utils';
import { validatePharmaceuticalClinicalReferenceV2 } from '../../lib/cases/v2/validate-pharmaceutical-clinical-reference';
import { buildPharmaceuticalEvaluationTargetSetV2 } from '../../lib/cases/v2/build-pharmaceutical-evaluation-target-set';
import { buildPharmaceuticalAdjudicationContextSetV2 } from '../../lib/cases/v2/build-pharmaceutical-adjudication-context';
import { buildPharmaceuticalSessionEvidenceCandidatesV2 } from '../../lib/cases/v2/build-pharmaceutical-session-evidence-candidates';
import { validatePharmaceuticalEvaluationExpectationSetV2 } from '../../lib/cases/v2/validate-pharmaceutical-evaluation-expectations';
import { createSessionTranscriptSnapshotV2 } from '../../lib/cases/v2/spfa-session-transcript';
import { buildPharmaceuticalD1BatchPlanV1 } from '../../lib/cases/v2/build-pharmaceutical-d1-batch-plan';
import { buildPharmaceuticalD1SemanticBatchRequestV2 } from '../../lib/cases/v2/build-pharmaceutical-d1-semantic-request';
import { buildPharmaceuticalD1AcceptedSemanticBatchV2, buildPharmaceuticalTargetSemanticAdjudicationSetV2, parsePharmaceuticalSemanticExecutionIdV2 } from '../../lib/cases/v2/validate-pharmaceutical-d1-adjudication';
import { buildPharmaceuticalD2RelationalSemanticRequestV2 } from '../../lib/cases/v2/build-pharmaceutical-d2-semantic-request';
import { buildPharmaceuticalClinicalClaimFindingSetV2 } from '../../lib/cases/v2/build-pharmaceutical-d2-claim-findings';
import type { PharmaceuticalD1ProviderTargetResultV1 } from '../../lib/cases/v2/pharmaceutical-d1-adjudication-types';
import { pharmaceuticalD3ClinicalReferenceV1, pharmaceuticalD3PatientRuntimeV1 } from '../live/support/pharmaceutical-d3-live-matrix';

type Mutable<T> = T extends string ? T : T extends readonly (infer U)[] ? Mutable<U>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const clone = <T>(value: T) => structuredClone(value) as Mutable<T>;
function core<T extends { fingerprint: unknown }>(value: T) { const { fingerprint: _fingerprint, ...body } = clone(value); return body; }
function reseal<T extends { fingerprint: { canonicalization: string } }>(value: T) {
  return { ...value, fingerprint: scoringFingerprint(value.fingerprint.canonicalization, core(value)) };
}
const ref = (id: string) => ({ id: `E2-SYNTHETIC-TEST-ONLY-${id}`, version: '1' });
const C = 'CORRECTLY_DEMONSTRATED', N = 'NOT_DEMONSTRATED', I = 'INCORRECT_OR_CONTRADICTED', U = 'UNCERTAIN';
type Verdict = PharmaceuticalD1ProviderTargetResultV1['verdict'];
type Options = {
  group?: 'ALL_OF' | 'ONE_OF'; repeated?: boolean; empty?: boolean; splitPrm?: boolean;
  verdicts?: readonly Verdict[]; defaultVerdict?: Verdict;
  weights?: readonly string[]; scale?: number; notApplicable?: readonly number[];
  roundingScale?: number; mode?: 'HALF_UP' | 'HALF_EVEN' | 'DOWN'; reviewIncorrect?: boolean;
};

/** Three weighted artificial units, not an approved clinical rubric or a D3 pedagogical profile.
 * Existing source identities bootstrap VALIDATED test witnesses only. Every point,
 * grouping, applicability and approval below is confined to this arithmetic test.
 */
function fixture(o: Options = {}) {
  const base = pharmaceuticalD3ClinicalReferenceV1(false);
  const cc = base.clinicalConclusions;
  const rnm = cc.rnmAssessments[0].value;
  if (rnm.status === 'no_rnm') throw new Error('test source must initially provide medication scope');
  const prmFindings = o.group ? [...cc.prm.findings, ...(o.repeated ? [{ ...cc.prm.findings[0],
    conclusionId: 'conclusion_d3000000-0000-4000-8000-000000000099',
    value: { ...cc.prm.findings[0].value, medicationRefs: rnm.medicationRefs },
  }] : [])] : [];
  const clinicalReference = validatePharmaceuticalClinicalReferenceV2({ ...base,
    structuralContext: { ...base.structuralContext, prmRnmRelations: prmFindings.map((finding, i) => ({
      ...base.structuralContext.prmRnmRelations[0],
      conclusionId: i === 0 ? base.structuralContext.prmRnmRelations[0].conclusionId : 'conclusion_d3000000-0000-4000-8000-000000000098',
      value: { ...base.structuralContext.prmRnmRelations[0].value, prmRef: finding.conclusionId },
    })) },
    clinicalConclusions: { ...cc,
      prm: { assessment: { ...cc.prm.assessment, value: { status: o.group ? 'present' : 'none' } }, findings: prmFindings },
      rnmAssessments: o.group ? cc.rnmAssessments : [{ ...cc.rnmAssessments[0], value: { status: 'no_rnm' } }],
      adherence: { assessments: [], typeConclusions: [], patientProfiles: [], barrierAssessments: [], barriers: [], strategies: [] },
      professionalActions: [], pharmaceuticalInterventions: [],
    },
  });
  const targetSet = buildPharmaceuticalEvaluationTargetSetV2(clinicalReference);
  const transcript = createSessionTranscriptSnapshotV2({ sessionId: '00000000-0000-4000-8000-000000000001', caseVersionId: clinicalReference.caseVersionId,
    messages: o.empty ? [] : [{ messageId: '1', role: 'student', content: 'Proposición sintética. Otra proposición.', createdAt: '2026-08-24T09:00:00Z' }] });
  const groups = o.group ? [
    ...(o.splitPrm ? [] : [{ operator: o.group, memberTargetRefs: targetSet.targets.filter((t) => t.aspect.startsWith('PRM_') && t.aspect !== 'PRM_RNM_RELATION').map((t) => t.targetId) }]),
    { operator: 'ALL_OF', memberTargetRefs: targetSet.targets.filter((t) => t.aspect.startsWith('RNM_')).map((t) => t.targetId) },
  ] : [];
  const expectationSet = validatePharmaceuticalEvaluationExpectationSetV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-expectations/1',
    caseVersionId: clinicalReference.caseVersionId, targetSetFingerprint: targetSet.fingerprint, groups }, targetSet);
  const contextSource = { patientRuntime: pharmaceuticalD3PatientRuntimeV1(), clinicalReference, targetSet, transcript, expectationSet,
    candidateSet: buildPharmaceuticalSessionEvidenceCandidatesV2(transcript, targetSet) };
  const context = buildPharmaceuticalAdjudicationContextSetV2(contextSource);
  const verdictByTarget = new Map(targetSet.targets.map((t, i) => [t.targetId, o.verdicts?.[i] ?? o.defaultVerdict ?? N]));
  const acceptedBatches = buildPharmaceuticalD1BatchPlanV1(context).semanticBatches.map((batch, index) => {
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(context, batch.batchDomain, 'pharmaceutical-d1-adjudication-prompt/3');
    const results = request.targets.map((t): PharmaceuticalD1ProviderTargetResultV1 => {
      const candidate = t.studentCandidates[0];
      const evidence = { messageRef: candidate.messageRef, excerpt: candidate.untrustedContent, evidenceKind: candidate.candidateEvidenceKinds[0] };
      const verdict = verdictByTarget.get(t.targetRef) ?? N;
      switch (verdict) {
        case C: return { targetRef: t.targetRef, verdict, supportingEvidence: [evidence] };
        case I: return { targetRef: t.targetRef, verdict, contradictionEvidence: [evidence] };
        case U: return { targetRef: t.targetRef, verdict, relatedEvidence: [evidence] };
        case N: return { targetRef: t.targetRef, verdict, evidence: [] };
      }
    });
    return buildPharmaceuticalD1AcceptedSemanticBatchV2(request, { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d1-provider-result/1', results },
      { semanticExecutionRef: parsePharmaceuticalSemanticExecutionIdV2(`pharm_sem_exec_00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`),
        lane: 'D1', provider: 'synthetic', responseModel: 'synthetic-offline', promptVersion: request.promptVersion,
        requestFingerprint: request.requestFingerprint, includedTargetRefs: request.targets.map((t) => t.targetRef) }, context, request.promptVersion);
  });
  const source: PharmaceuticalScoreSourceV2 = { contextSource, context,
    d1: { set: buildPharmaceuticalTargetSemanticAdjudicationSetV2(context, acceptedBatches), acceptedBatches, semanticAcceptance: 'VALIDATED_OFFLINE' },
    d2: { status: 'NOT_PROVIDED', reason: 'NOT_REQUESTED' } };
  const seen = new Set<string>();
  const units = context.targets.flatMap((t) => {
    const group = t.expectationMemberships[0];
    if (group && seen.has(group.groupRef)) return [];
    if (group) seen.add(group.groupRef);
    return [{ domain: t.clinicalContext.domain, operator: group?.operator ?? 'SINGLE',
      memberTargetRefs: group ? [...group.memberTargetRefs] : [t.targetRef],
      applicability: 'APPLICABLE', sourceExpectationGroupRefs: group ? [group.groupRef] : [] }];
  });
  units.forEach((unit, i) => { if (o.notApplicable?.includes(i)) unit.applicability = 'NOT_APPLICABLE'; });
  const planDraft = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-plan/1', ref: ref('plan'), approval: 'APPROVED',
    caseVersionId: clinicalReference.caseVersionId, targetSet: { contractVersion: targetSet.contractVersion, fingerprint: targetSet.fingerprint },
    expectationSet: pharmaceuticalScoringExpectationBinding(contextSource), weightsRef: ref('weights'), units };
  const plan = buildPharmaceuticalScoringPlanV2(planDraft, contextSource);
  const weights = buildPharmaceuticalScoringWeightsV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-weights/1',
    ref: ref('weights'), approval: 'APPROVED', plan: pharmaceuticalScoringConfigBinding(plan), representation: 'SCALED_INTEGER', scale: o.scale ?? 2,
    expectedTotal: '1', entries: plan.units.map((unit) => ({ scoringUnitId: unit.scoringUnitId,
      // Relational targets required by upstream invariants retain explicit zero weight.
      units: o.splitPrm && unit.domain === 'PRM' ? ['20', '10', '10', '10'][units.filter((u) => u.domain === 'PRM').findIndex((u) => u.memberTargetRefs.some((member) => member === unit.memberTargetRefs[0]))]
        : unit.domain === 'PRM_RNM_RELATION' ? '0'
        : (o.weights ?? ['50', '30', '20'])[unit.domain === 'PRM' ? 0 : unit.domain === 'RNM' ? 1 : 2] })) }, plan, contextSource);
  const policy = buildPharmaceuticalScoringPolicyV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-policy/1', ref: ref('policy'),
    rulesVersion: 'pharmaceutical-scoring-rules/1', automaticSource: 'VALIDATED_D1_ONLY',
    d1Mapping: { CORRECTLY_DEMONSTRATED: 'CREDIT', INCORRECT_OR_CONTRADICTED: 'NO_CREDIT', UNCERTAIN: 'NO_CONFIRMED_CREDIT_REVIEW_REQUIRED',
      NOT_DEMONSTRATED: 'NO_CREDIT', STRUCTURAL_NO_STUDENT_CANDIDATES: 'NO_CREDIT_STRUCTURAL' },
    d2Mapping: { CONTRADICTORY: 'REVIEW_ONLY', UNSUPPORTED: 'REVIEW_ONLY' }, claimFormEffect: 'NO_NUMERIC_EFFECT', negativeScoring: 'FORBIDDEN',
    allOf: 'ALL_MEMBERS_REQUIRED_FOR_UNIT_CREDIT', oneOf: 'ANY_CORRECT_MEMBER_YIELDS_SINGLE_UNIT_CREDIT', uncertain: 'KEEP_DENOMINATOR_REVIEW_REQUIRED',
    noApplicable: 'NOT_SCORABLE', passFail: 'NONE', hardFail: 'NONE', weightsRef: ref('weights'), thresholdsRef: ref('thresholds'), roundingRef: ref('rounding'),
    reviewPreferences: { reviewIncorrectD1: o.reviewIncorrect ?? false } });
  const thresholds = buildPharmaceuticalScoringThresholdsV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-thresholds/1',
    ref: ref('thresholds'), approval: 'APPROVED', configuration: { status: 'NO_THRESHOLDS' } });
  const rounding = buildPharmaceuticalScoringRoundingV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-rounding/1',
    ref: ref('rounding'), approval: 'APPROVED', configuration: { status: 'CONFIGURED', scale: o.roundingScale ?? 1,
      roundingMode: o.mode ?? 'HALF_UP', applyAt: 'FINAL_SCORE_ONLY' } });
  const config = { policy, plan, weights, thresholds, rounding };
  const input = buildPharmaceuticalScoreInputV2(config, source);
  return { source, context, config, input, planDraft };
}
const score = (f: ReturnType<typeof fixture>) => calculate(f.input, f.config, f.source);
const zero = { numerator: '0', denominator: '1' }, one = { numerator: '1', denominator: '1' };
const half = { numerator: '1', denominator: '2' };
const prm = (s: ReturnType<typeof score>) => s.result.unitContributions.find((u) => u.domain === 'PRM');
function withSource(f: ReturnType<typeof fixture>, source: PharmaceuticalScoreSourceV2) {
  return { ...f, source, input: buildPharmaceuticalScoreInputV2(f.config, source) };
}
function d2Source(f: ReturnType<typeof fixture>, findingType?: 'CONTRADICTORY' | 'UNSUPPORTED', claimForm = 'ASSERTION') {
  const request = buildPharmaceuticalD2RelationalSemanticRequestV2(f.context, 'pharmaceutical-d2-claim-prompt/5');
  const providerResult = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: findingType ? [{
    messageRef: '1', excerpt: 'Proposición sintética', occurrenceIndex: 0, domain: 'PROFESSIONAL_RESPONSE', findingType, claimForm, relatedClinicalRefs: [],
  }] : [] };
  return { ...f.source, d2: { status: 'PROVIDED' as const, request, providerResult,
    set: buildPharmaceuticalClinicalClaimFindingSetV2(request, providerResult), semanticAcceptance: 'VALIDATED_OFFLINE' as const } };
}

describe('M6-E2 SINGLE: validated D1 is the only credit source', () => {
  it.each([C, I, N, U] as const)('%s', (verdict) => {
    const f = fixture({ verdicts: [verdict] }), s = score(f);
    expect(f.config.plan.units).toHaveLength(3);
    expect(prm(s)?.earned).toEqual(verdict === C ? half : zero);
    expect(s.result.possible).toEqual(one);
    expect(s.result.normalizedScore).toBe(verdict === C ? 50 : 0);
    expect(s.result.status).toBe(verdict === U ? 'PROVISIONAL_REVIEW_REQUIRED' : 'SCORED');
  });
  it('structural no-candidate shells grant zero without inventing verdicts', () => {
    const s = score(fixture({ empty: true }));
    expect(s.result.earned).toEqual(zero); expect(s.result.possible).toEqual(one);
    for (const unit of s.result.unitContributions) for (const outcome of unit.memberOutcomes) {
      expect(outcome.resolution).toBe('STRUCTURAL_NO_STUDENT_CANDIDATES');
      expect(outcome).not.toHaveProperty('verdict'); expect(outcome).not.toHaveProperty('semanticExecutionRef');
    }
  });
});

describe('M6-E2 ALL_OF and ONE_OF use the unit weight exactly once', () => {
  it.each([
    { values: [C, C, C, C], earned: half }, { values: [C, C, C, N], earned: zero },
    { values: [C, C, C, I], earned: zero }, { values: [C, C, C, U], earned: zero },
    { values: [N, N, N, N], earned: zero },
  ] as const)('ALL_OF $values', ({ values, earned }) => {
    const s = score(fixture({ group: 'ALL_OF', verdicts: values }));
    expect(prm(s)?.earned).toEqual(earned); expect(prm(s)?.possible).toEqual(half);
    expect(s.result.earned).toEqual(earned); expect(prm(s)?.memberOutcomes).toHaveLength(4);
    expect(s.result.reviewFlags.some((f) => f.code === 'UNCERTAIN_D1')).toBe(values.some((value) => value === U));
  });
  it('ALL_OF with structural members gives no partial credit', () => {
    expect(prm(score(fixture({ group: 'ALL_OF', empty: true })))?.earned).toEqual(zero);
  });
  it.each([[C, N, N, N], [C, C, N, N], [C, I, N, N], [C, U, N, N], [I, I, I, I], [N, N, N, N]] as Verdict[][])(
    'ONE_OF %j', (...values) => {
      const s = score(fixture({ group: 'ONE_OF', verdicts: values }));
      expect(prm(s)?.earned).toEqual(values.includes(C) ? half : zero);
      expect(s.result.earned).toEqual(values.includes(C) ? half : zero);
      expect(s.result.reviewFlags.some((f) => f.code === 'UNCERTAIN_D1')).toBe(values.includes(U));
    });
  it.each(['ALL_OF', 'ONE_OF'] as const)('%s: another PRM and medication do not generate extra weight', (group) => {
    const a = fixture({ group, defaultVerdict: C }), b = fixture({ group, repeated: true, defaultVerdict: C });
    expect(b.source.contextSource.targetSet.targets.length).toBeGreaterThan(a.source.contextSource.targetSet.targets.length);
    const first = score(a), second = score(b);
    expect(prm(second)?.memberOutcomes).toHaveLength(7);
    expect(b.config.weights.entries.filter((entry) => entry.units !== '0')).toHaveLength(3);
    expect(prm(second)?.earned).toEqual(prm(first)?.earned);
    expect(second.result.earned).toEqual(one); expect(second.result.normalizedScore).toBe(100);
  });
});

describe('M6-E2 applicability and NOT_SCORABLE', () => {
  it('excludes NOT_APPLICABLE weight from both totals without redistribution', () => {
    const s = score(fixture({ verdicts: [C, C, N], notApplicable: [0] }));
    expect(prm(s)?.earned).toEqual(zero); expect(prm(s)?.possible).toEqual(zero);
    expect(s.result.earned).toEqual({ numerator: '3', denominator: '10' });
    expect(s.result.possible).toEqual(half); expect(s.result.normalizedScore).toBe(60);
    expect(s.result.domainBreakdown.find((d) => d.domain === 'PRM')?.possible).toEqual(zero);
  });
  it('keeps negative clinical conclusions applicable, including not_required referral', () => {
    const f = fixture({ verdicts: [N, N, C] });
    expect(f.source.contextSource.targetSet.targets.find((t) => t.aspect === 'REFERRAL_NEED')?.expectedValue).toEqual({ kind: 'ENUM', value: 'not_required' });
    const s = score(f); expect(s.result.normalizedScore).toBe(20); expect(s.result.possible).toEqual(one);
  });
  it.each([N, C, U] as const)('all NOT_APPLICABLE / %s: null, never 100; flags retained', (verdict) => {
    const s = score(fixture({ defaultVerdict: verdict, notApplicable: [0, 1, 2] }));
    expect(s.result.status).toBe('NOT_SCORABLE'); expect(s.result.normalizedScore).toBeNull();
    expect(s.result.earned).toEqual(zero); expect(s.result.possible).toEqual(zero);
    expect(s.result.reviewFlags.length).toBe(verdict === U ? 3 : 0);
  });
  it('zero-weight applicable units with all positive weights excluded are NOT_SCORABLE', () => {
    const s = score(fixture({ weights: ['100', '0', '0'], notApplicable: [0], defaultVerdict: C }));
    expect(s.result.status).toBe('NOT_SCORABLE'); expect(s.result.normalizedScore).toBeNull();
  });
});

describe('M6-E2 exact arithmetic and final-only explicit rounding', () => {
  it('third-like ratio: 1/10 over 3/10 is rounded only at the end', () => {
    const s = score(fixture({ weights: ['1', '2', '7'], scale: 1, verdicts: [C, N, C], notApplicable: [2] }));
    expect(s.result.earned).toEqual({ numerator: '1', denominator: '10' });
    expect(s.result.possible).toEqual({ numerator: '3', denominator: '10' }); expect(s.result.normalizedScore).toBe(33.3);
  });
  it.each([0, 1, 2, 9, 18])('exact weights at scale %s', (scale) => {
    const total = 10n ** BigInt(scale);
    const s = score(fixture({ scale, weights: [String(total), '0', '0'], verdicts: [C] }));
    expect(s.result.earned).toEqual(one); expect(s.result.possible).toEqual(one); expect(s.result.normalizedScore).toBe(100);
  });
  it('preserves BigInt values beyond Number safe integers with no accumulated drift', () => {
    const s = score(fixture({ scale: 18, weights: ['333333333333333333', '333333333333333333', '333333333333333334'], verdicts: [C, C, N] }));
    expect(s.result.earned).toEqual({ numerator: '333333333333333333', denominator: '500000000000000000' });
    expect(s.result.possible).toEqual(one); expect(s.result.normalizedScore).toBe(66.7);
  });
  it.each([
    ['1234', 12.3], ['1235', 12.4], ['1250', 12.5], ['0', 0], ['10000', 100], ['4200', 42],
  ] as const)('HALF_UP final rounding of weight %s/10000', (weight, expected) => {
    const s = score(fixture({ scale: 4, weights: [weight, String(10000n - BigInt(weight)), '0'], verdicts: [C] }));
    expect(s.result.normalizedScore).toBe(expected);
    expect(prm(s)?.earned).toEqual(s.result.earned);
  });
  it('does not round units/domains before summing: 12.34 + 12.34 = 24.68 -> 24.7', () => {
    const s = score(fixture({ scale: 4, weights: ['1234', '1234', '7532'], verdicts: [C, C, N] }));
    expect(s.result.earned).toEqual({ numerator: '617', denominator: '2500' });
    expect(s.result.domainBreakdown.find((d) => d.domain === 'PRM')?.earned).toEqual({ numerator: '617', denominator: '5000' });
    expect(s.result.normalizedScore).toBe(24.7);
  });
  it('aggregates several separately weighted units into one domain without counting targets twice', () => {
    const s = score(fixture({ group: 'ALL_OF', splitPrm: true, verdicts: [C, I, C, N] }));
    const domain = s.result.domainBreakdown.find((d) => d.domain === 'PRM');
    expect(domain?.scoringUnitRefs).toHaveLength(4);
    expect(domain?.earned).toEqual({ numerator: '3', denominator: '10' }); expect(domain?.possible).toEqual(half);
    expect(s.result.earned).toEqual({ numerator: '3', denominator: '10' }); expect(s.result.possible).toEqual(one);
    expect(s.result.normalizedScore).toBe(30);
  });
  it.each([
    { mode: 'HALF_EVEN', weight: '1225', expected: 12.2 }, { mode: 'HALF_EVEN', weight: '1235', expected: 12.4 },
    { mode: 'DOWN', weight: '1239', expected: 12.3 },
  ] as const)('respects configured $mode without a HALF_UP default', ({ mode, weight, expected }) => {
    expect(score(fixture({ mode, scale: 4, weights: [weight, String(10000n - BigInt(weight)), '0'], verdicts: [C] })).result.normalizedScore).toBe(expected);
  });
  it.each([0, 2, 18])('honors explicitly configured final decimal scale %s', (roundingScale) => {
    const s = score(fixture({ roundingScale, scale: 4, weights: ['1235', '8765', '0'], verdicts: [C] }));
    expect(s.result.normalizedScore).toBe(roundingScale === 0 ? 12 : 12.35);
  });
});

describe('M6-E2 review-only D2, debt and deterministic status', () => {
  it.each(['CONTRADICTORY', 'UNSUPPORTED'] as const)('%s never changes arithmetic for any claimForm', (kind) => {
    const f = fixture({ verdicts: [C, N, C] }), baseline = score(f);
    for (const form of ['ASSERTION', 'CONCLUSION', 'RECOMMENDATION']) {
      const s = score(withSource(f, d2Source(f, kind, form)));
      expect(s.result.earned).toEqual(baseline.result.earned); expect(s.result.possible).toEqual(baseline.result.possible);
      expect(s.result.normalizedScore).toBe(70); expect(s.result.unitContributions).toEqual(baseline.result.unitContributions);
      expect(s.result.domainBreakdown).toEqual(baseline.result.domainBreakdown);
      expect(s.result.status).toBe('PROVISIONAL_REVIEW_REQUIRED');
      expect(s.result.reviewFlags.map((flag) => flag.code)).toEqual([`${kind}_D2`]);
    }
  });
  it.each([false, true])('incorrect review preference = %s, no automatic penalty/review', (reviewIncorrect) => {
    const s = score(fixture({ verdicts: [I, C, N], reviewIncorrect }));
    expect(s.result.normalizedScore).toBe(30);
    expect(s.result.status).toBe(reviewIncorrect ? 'PROVISIONAL_REVIEW_REQUIRED' : 'SCORED');
    expect(s.result.reviewFlags.length).toBe(reviewIncorrect ? 1 : 0);
  });
  it.each(['D1', 'D2'] as const)('%s debt makes score provisional without numeric change', (lane) => {
    const f = fixture({ defaultVerdict: C }), baseline = score(f);
    const source = lane === 'D1' ? { ...f.source, d1: { ...f.source.d1, semanticAcceptance: 'VALIDATION_DEBT' as const } }
      : { ...d2Source(f), d2: { ...d2Source(f).d2, semanticAcceptance: 'VALIDATION_DEBT' as const } };
    const s = score(withSource(f, source));
    expect(s.result.status).toBe('PROVISIONAL_REVIEW_REQUIRED'); expect(s.result.normalizedScore).toBe(100);
    expect(s.result.earned).toEqual(baseline.result.earned); expect(s.result.reviewFlags).toContainEqual({ code: 'UPSTREAM_VALIDATION_DEBT', lane });
    expect(s.receipt.sources.upstreamSemanticAcceptanceStatus).toBe('VALIDATION_DEBT');
  });
  it('NOT_SCORABLE takes priority over debt but retains its receipt and flags', () => {
    const f = fixture({ notApplicable: [0, 1, 2] });
    const s = score(withSource(f, { ...f.source, d1: { ...f.source.d1, semanticAcceptance: 'VALIDATION_DEBT' } }));
    expect(s.result.status).toBe('NOT_SCORABLE'); expect(s.result.normalizedScore).toBeNull();
    expect(s.result.reviewFlags).toEqual([{ code: 'UPSTREAM_VALIDATION_DEBT', lane: 'D1' }]);
  });
  it('flags are deterministic, unique, preserve target/claim refs and survive repeated calculation', () => {
    const f = fixture({ group: 'ONE_OF', verdicts: [C, U, U, I], reviewIncorrect: true });
    const source = d2Source(f, 'UNSUPPORTED');
    const debt = withSource(f, { ...source, d1: { ...source.d1, semanticAcceptance: 'VALIDATION_DEBT' } });
    const s = score(debt), again = score(debt);
    expect(s).toEqual(again); expect(s.result.reviewFlags).toHaveLength(5);
    expect(new Set(s.result.reviewFlags.map((flag) => JSON.stringify(flag))).size).toBe(5);
    expect(s.result.normalizedScore).toBe(50); expect(s.result.status).toBe('PROVISIONAL_REVIEW_REQUIRED');
  });
  it('explicit NOT_REQUESTED differs from validated empty D2, not from a hidden failure', () => {
    const f = fixture(), absent = score(f), provided = score(withSource(f, d2Source(f)));
    expect(absent.result.sourceBindings.d2.status).toBe('NOT_PROVIDED'); expect(provided.result.sourceBindings.d2.status).toBe('PROVIDED');
    expect(provided.result.normalizedScore).toBe(absent.result.normalizedScore); expect(provided.fingerprint).not.toEqual(absent.fingerprint);
  });
});

describe('M6-E2 canonical receipt, fingerprints and E1 structural boundary', () => {
  it('reproduces canonical results without mutating input/config/witnesses', () => {
    const f = fixture({ group: 'ONE_OF', verdicts: [C, U] });
    const before = JSON.stringify(f), s = score(f);
    expect(JSON.stringify(f)).toBe(before); expect(Object.isFrozen(s)).toBe(true); expect(Object.isFrozen(s.result.unitContributions)).toBe(true);
    expect(calculate(clone(f.input), clone(f.config), structuredClone(f.source))).toEqual(s);
    const shuffled = clone(f.config), input = clone(f.input);
    shuffled.plan.units.reverse(); shuffled.plan.units.forEach((u) => u.memberTargetRefs.reverse()); shuffled.weights.entries.reverse();
    input.d1Outcomes.reverse(); input.reviewFlags.reverse();
    expect(calculate(input, shuffled, f.source)).toEqual(s);
    expect(s.receipt.inputFingerprint).toEqual(f.input.fingerprint); expect(s.receipt.resultFingerprint).toEqual(s.fingerprint);
    expect(s.receipt.sources).toEqual(f.input.bindings);
    expect(s.fingerprint).toEqual(scoringFingerprint('pharmaceutical-session-score-v2/1', s.result));
    expect(validatePharmaceuticalSessionScoreV2(s, f.input, f.config, f.source)).toEqual(s);
    for (const raw of ['Proposición sintética', 'providerResult', 'untrustedContent', 'rawResponse', 'apiKey', 'supportingEvidence']) {
      expect(JSON.stringify(s)).not.toContain(raw);
    }
  });
  it.each([
    { verdicts: [C, N, N] }, { notApplicable: [0] }, { weights: ['40', '40', '20'] },
    { roundingScale: 2 }, { reviewIncorrect: true }, { group: 'ALL_OF' },
  ] satisfies Options[])('material outcome/config change alters result fingerprint %#', (options) => {
    expect(score(fixture(options)).fingerprint).not.toEqual(score(fixture()).fingerprint);
  });
  it('plan version and upstream debt change fingerprint even when numbers match', () => {
    const f = fixture(), s = score(f), plan = buildPharmaceuticalScoringPlanV2({ ...f.planDraft, ref: { ...f.planDraft.ref, version: '2' } }, f.source.contextSource);
    const weights = buildPharmaceuticalScoringWeightsV2({ ...core(f.config.weights), plan: pharmaceuticalScoringConfigBinding(plan) }, plan, f.source.contextSource);
    const config = { ...f.config, plan, weights }, input = buildPharmaceuticalScoreInputV2(config, f.source);
    expect(calculate(input, config, f.source).fingerprint).not.toEqual(s.fingerprint);
    expect(score(withSource(f, { ...f.source, d1: { ...f.source.d1, semanticAcceptance: 'VALIDATION_DEBT' } })).fingerprint).not.toEqual(s.fingerprint);
  });
  it('E1 accepts structurally valid supplied arithmetic; E2 alone computes authoritative arithmetic', () => {
    const f = fixture({ verdicts: [C] }), actual = score(f), supplied = clone(actual);
    if (supplied.result.status !== 'SCORED') throw new Error('test expects scored result');
    supplied.result.possible = { numerator: '2', denominator: '1' }; supplied.result.normalizedScore = 25;
    supplied.fingerprint = scoringFingerprint('pharmaceutical-session-score-v2/1', supplied.result);
    supplied.receipt.resultFingerprint = supplied.fingerprint;
    expect(validatePharmaceuticalSessionScoreV2(supplied, f.input, f.config, f.source)).toEqual(supplied);
    expect(score(f).result.possible).toEqual(one); expect(score(f).result.normalizedScore).toBe(50);
    expect(actual.result.validationScope).toBe('STRUCTURAL_ONLY');
  });
});

describe('M6-E2 fail-closed preconditions before arithmetic', () => {
  it.each(['policy', 'plan', 'weights', 'thresholds', 'rounding'] as const)('missing %s has no default', (key) => {
    const f = fixture(); expect(() => calculate(f.input, { ...f.config, [key]: undefined }, f.source)).toThrow('PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
  it.each(['weights', 'thresholds', 'rounding'] as const)('unapproved %s is not usable', (key) => {
    const f = fixture(), item = reseal({ ...f.config[key], approval: 'UNAPPROVED' });
    expect(() => calculate(f.input, { ...f.config, [key]: item }, f.source)).toThrow('PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
  it('unapproved plan remains blocked even with rebuilt weights binding', () => {
    const f = fixture(), plan = buildPharmaceuticalScoringPlanV2({ ...f.planDraft, approval: 'UNAPPROVED' }, f.source.contextSource);
    const weights = buildPharmaceuticalScoringWeightsV2({ ...core(f.config.weights), plan: pharmaceuticalScoringConfigBinding(plan) }, plan, f.source.contextSource);
    expect(() => calculate(f.input, { ...f.config, plan, weights }, f.source)).toThrow('PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
  it.each(['thresholds', 'rounding'] as const)('UNCONFIGURED %s is not repaired', (key) => {
    const f = fixture(), item = reseal({ ...f.config[key], configuration: { status: 'UNCONFIGURED', reason: 'DECISION_REQUIRED' } });
    expect(() => calculate(f.input, { ...f.config, [key]: item }, f.source)).toThrow('PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
  it('DEFINED thresholds cannot create academic pass/fail under NONE', () => {
    const f = fixture(), thresholds = buildPharmaceuticalScoringThresholdsV2({ ...core(f.config.thresholds), configuration: { status: 'DEFINED',
      thresholds: [{ thresholdId: 'test-only', minimumScore: 50 }] } });
    expect(() => calculate(f.input, { ...f.config, thresholds }, f.source)).toThrow('PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
  it.each(['input', 'weights', 'plan'] as const)('tampered %s fingerprint is rejected', (key) => {
    const f = fixture(), changed = clone(key === 'input' ? f.input : f.config[key]); changed.fingerprint.value = '0'.repeat(64);
    expect(() => calculate(key === 'input' ? changed : f.input, key === 'input' ? f.config : { ...f.config, [key]: changed }, f.source)).toThrow('FINGERPRINT_MISMATCH');
  });
  it('cross-version config bindings are rejected', () => {
    const f = fixture(), policy = buildPharmaceuticalScoringPolicyV2({ ...core(f.config.policy), weightsRef: { ...ref('weights'), version: 'other' } });
    expect(() => calculate(f.input, { ...f.config, policy }, f.source)).toThrow('SOURCE_BINDING_MISMATCH');
  });
  it('unknown source/rules versions and raw extra input properties fail closed', () => {
    const f = fixture();
    expect(() => calculate({ ...f.input, contractVersion: 'pharmaceutical-score-input/99' }, f.config, f.source)).toThrow('UNSUPPORTED_VERSION');
    expect(() => calculate(f.input, { ...f.config, policy: { ...f.config.policy, rulesVersion: 'other' } }, f.source)).toThrow('UNSUPPORTED_VERSION');
    expect(() => calculate({ ...f.input, raw: 'SECRET_SOURCE_TEXT' }, f.config, f.source)).toThrow(PharmaceuticalScoringValidationError);
  });
  it('preserves actual validation debt against attempted source-status promotion', () => {
    const f = fixture(), source = { ...f.source, d1: { ...f.source.d1, semanticAcceptance: 'VALIDATION_DEBT' as const } };
    const input = buildPharmaceuticalScoreInputV2(f.config, source);
    const promoted = reseal({ ...input, bindings: { ...input.bindings, upstreamSemanticAcceptanceStatus: 'LIVE_ACCEPTED' }, reviewFlags: [] });
    expect(() => calculate(promoted, f.config, source)).toThrow('SOURCE_BINDING_MISMATCH');
  });
  it('invalid exact weight sum is rejected even if resealed', () => {
    const f = fixture(), weights = clone(f.config.weights); weights.entries[0].units = '999';
    expect(() => calculate(f.input, { ...f.config, weights: reseal(weights) }, f.source)).toThrow('INVALID_WEIGHT_CONFIGURATION');
  });
  it.each([0, 2])('SINGLE member count %s rejected before scoring', (count) => {
    const f = fixture(), plan = clone(f.config.plan);
    plan.units[0].memberTargetRefs = count === 0 ? [] : [...plan.units[0].memberTargetRefs, ...plan.units[1].memberTargetRefs];
    expect(() => calculate(f.input, { ...f.config, plan: reseal(plan) }, f.source)).toThrow('INVALID_SCORING_PLAN');
  });
  it('overlapping scoring units cannot multiply credit', () => {
    const f = fixture(), plan = clone(f.config.plan); plan.units.push(plan.units[0]);
    expect(() => calculate(f.input, { ...f.config, plan: reseal(plan) }, f.source)).toThrow('INVALID_SCORING_PLAN');
  });
  it.each(['duplicate', 'missing', 'unknown-verdict', 'debt-upgrade'] as const)('invalid score input: %s', (kind) => {
    const f = fixture({ verdicts: [C] }), input = clone(f.input);
    if (kind === 'duplicate') input.d1Outcomes.push(input.d1Outcomes[0]);
    if (kind === 'missing') input.d1Outcomes.pop();
    if (kind === 'unknown-verdict') Object.assign(input.d1Outcomes[0], { verdict: 'MADE_UP' });
    if (kind === 'debt-upgrade') input.bindings.upstreamSemanticAcceptanceStatus = 'LIVE_ACCEPTED';
    expect(() => calculate(reseal(input), f.config, f.source)).toThrow(PharmaceuticalScoringValidationError);
  });
  it('cannot remove or duplicate review flags in stored input', () => {
    const f = fixture({ defaultVerdict: U });
    for (const reviewFlags of [[], [...f.input.reviewFlags, f.input.reviewFlags[0]]]) {
      expect(() => calculate(reseal({ ...f.input, reviewFlags: canonicalPharmaceuticalReviewFlags(reviewFlags) }), f.config, f.source)).toThrow('UNVALIDATED_SOURCE');
    }
  });
  it.each(['missing', 'raw', 'no-witnesses', 'wrong-case'] as const)('invalid D1: %s', (kind) => {
    const f = fixture(); const set = kind === 'missing' ? undefined : kind === 'raw' ? { results: [] }
      : kind === 'wrong-case' ? { ...f.source.d1.set as object, caseVersionId: 'other' } : f.source.d1.set;
    const source = { ...f.source, d1: { ...f.source.d1, set, acceptedBatches: kind === 'no-witnesses' ? [] : f.source.d1.acceptedBatches } };
    expect(() => calculate(f.input, f.config, source)).toThrow(kind === 'missing' ? 'INCOMPLETE_UPSTREAM' : 'UNVALIDATED_SOURCE');
  });
  it.each(['missing-set', 'raw-set', 'invalid-provider'] as const)('D2 %s never becomes a silently empty set', (kind) => {
    const f = fixture(), source = d2Source(f, 'UNSUPPORTED');
    const d2 = { ...source.d2, set: kind === 'missing-set' ? undefined : kind === 'raw-set' ? { findings: [] } : source.d2.set,
      providerResult: kind === 'invalid-provider' ? { raw: 'SECRET_SOURCE_TEXT' } : source.d2.providerResult };
    expect(() => calculate(f.input, f.config, { ...source, d2 })).toThrow(kind === 'missing-set' ? 'INCOMPLETE_UPSTREAM' : 'UNVALIDATED_SOURCE');
    try { calculate(f.input, f.config, { ...source, d2 }); } catch (error) { expect(String(error)).not.toContain('SECRET_SOURCE_TEXT'); }
  });
});
