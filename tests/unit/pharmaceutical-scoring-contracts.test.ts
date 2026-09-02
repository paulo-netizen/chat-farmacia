import { describe, expect, it } from 'vitest';
import { buildPharmaceuticalAdjudicationContextSetV2 } from '../../lib/cases/v2/build-pharmaceutical-adjudication-context';
import { buildPharmaceuticalEvaluationTargetSetV2 } from '../../lib/cases/v2/build-pharmaceutical-evaluation-target-set';
import { buildPharmaceuticalSessionEvidenceCandidatesV2 } from '../../lib/cases/v2/build-pharmaceutical-session-evidence-candidates';
import { buildPharmaceuticalD1BatchPlanV1 } from '../../lib/cases/v2/build-pharmaceutical-d1-batch-plan';
import { buildPharmaceuticalD1SemanticBatchRequestV2 } from '../../lib/cases/v2/build-pharmaceutical-d1-semantic-request';
import { buildPharmaceuticalD1AcceptedSemanticBatchV2, buildPharmaceuticalTargetSemanticAdjudicationSetV2, parsePharmaceuticalSemanticExecutionIdV2 } from '../../lib/cases/v2/validate-pharmaceutical-d1-adjudication';
import { buildPharmaceuticalD2RelationalSemanticRequestV2 } from '../../lib/cases/v2/build-pharmaceutical-d2-semantic-request';
import { buildPharmaceuticalClinicalClaimFindingSetV2 } from '../../lib/cases/v2/build-pharmaceutical-d2-claim-findings';
import { validatePharmaceuticalEvaluationExpectationSetV2 } from '../../lib/cases/v2/validate-pharmaceutical-evaluation-expectations';
import { createSessionTranscriptSnapshotV2 } from '../../lib/cases/v2/spfa-session-transcript';
import type { PharmaceuticalD1ProviderTargetResultV1 } from '../../lib/cases/v2/pharmaceutical-d1-adjudication-types';
import {
  buildPharmaceuticalScoringPlanV2, pharmaceuticalScoringExpectationBinding, validatePharmaceuticalScoringPlanV2,
} from '../../lib/cases/v2/build-pharmaceutical-scoring-plan';
import {
  buildPharmaceuticalScoringPolicyV2, buildPharmaceuticalScoringRoundingV2, buildPharmaceuticalScoringThresholdsV2,
  buildPharmaceuticalScoringWeightsV2, pharmaceuticalScoringConfigBinding,
  validatePharmaceuticalScoringPolicyV2, validatePharmaceuticalScoringRoundingV2,
  validatePharmaceuticalScoringThresholdsV2, validatePharmaceuticalScoringWeightsV2,
  validatePharmaceuticalScoringConfigurationV2,
} from '../../lib/cases/v2/build-pharmaceutical-scoring-policy';
import {
  buildPharmaceuticalScoreInputV2, validatePharmaceuticalScoreInputV2, type PharmaceuticalScoreSourceV2,
} from '../../lib/cases/v2/build-pharmaceutical-score-input';
import { validatePharmaceuticalSessionScoreV2 } from '../../lib/cases/v2/validate-pharmaceutical-session-score';
import {
  PharmaceuticalScoringValidationError, scoringCanonicalJson, scoringFingerprint,
  type PharmaceuticalScoringErrorCodeV2,
} from '../../lib/cases/v2/pharmaceutical-scoring-contract-utils';
import type { PharmaceuticalScoreInputV2, PharmaceuticalSessionScoreV2 } from '../../lib/cases/v2/pharmaceutical-scoring-types';
import { pharmaceuticalD3ClinicalReferenceV1, pharmaceuticalD3PatientRuntimeV1 } from '../live/support/pharmaceutical-d3-live-matrix';

type Mutable<T> = T extends string ? T : T extends readonly (infer U)[] ? Mutable<U>[]
  : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const clone = <T>(value: T) => structuredClone(value) as Mutable<T>;
function body<T extends { fingerprint: unknown }>(value: T) { const { fingerprint: _fingerprint, ...core } = clone(value); return core; }
function rejects(call: () => unknown, code?: PharmaceuticalScoringErrorCodeV2) {
  try { call(); } catch (error) {
    expect(error).toBeInstanceOf(PharmaceuticalScoringValidationError);
    if (code) expect((error as PharmaceuticalScoringValidationError).code).toBe(code);
    return;
  }
  throw new Error('expected a fail-closed scoring error');
}
const weightsRef = { id: 'synthetic-weights-not-a-clinical-default', version: '1' };
const thresholdsRef = { id: 'synthetic-thresholds', version: '1' };
const roundingRef = { id: 'synthetic-rounding', version: '1' };
function policyDraft() {
  return {
    schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-policy/1', ref: { id: 'test-policy', version: '1' },
    rulesVersion: 'pharmaceutical-scoring-rules/1', automaticSource: 'VALIDATED_D1_ONLY',
    d1Mapping: { CORRECTLY_DEMONSTRATED: 'CREDIT', INCORRECT_OR_CONTRADICTED: 'NO_CREDIT',
      UNCERTAIN: 'NO_CONFIRMED_CREDIT_REVIEW_REQUIRED', NOT_DEMONSTRATED: 'NO_CREDIT',
      STRUCTURAL_NO_STUDENT_CANDIDATES: 'NO_CREDIT_STRUCTURAL' },
    d2Mapping: { CONTRADICTORY: 'REVIEW_ONLY', UNSUPPORTED: 'REVIEW_ONLY' },
    claimFormEffect: 'NO_NUMERIC_EFFECT', negativeScoring: 'FORBIDDEN',
    allOf: 'ALL_MEMBERS_REQUIRED_FOR_UNIT_CREDIT', oneOf: 'ANY_CORRECT_MEMBER_YIELDS_SINGLE_UNIT_CREDIT',
    uncertain: 'KEEP_DENOMINATOR_REVIEW_REQUIRED', noApplicable: 'NOT_SCORABLE', passFail: 'NONE', hardFail: 'NONE',
    weightsRef, thresholdsRef, roundingRef, reviewPreferences: { reviewIncorrectD1: false },
  };
}
type Verdict = PharmaceuticalD1ProviderTargetResultV1['verdict'];
function fixture(options: { empty?: boolean; verdict?: Verdict; group?: 'ALL_OF' | 'ONE_OF'; overlap?: boolean } = {}) {
  const clinicalReference = pharmaceuticalD3ClinicalReferenceV1(true, true);
  const targetSet = buildPharmaceuticalEvaluationTargetSetV2(clinicalReference);
  const transcript = createSessionTranscriptSnapshotV2({ sessionId: '00000000-0000-4000-8000-000000000001', caseVersionId: clinicalReference.caseVersionId,
    messages: options.empty ? [] : [{ messageId: '1', role: 'student', content: 'Proposición sintética para validación estructural.', createdAt: '2026-08-24T09:00:00Z' }] });
  const prmTargets = targetSet.targets.filter((target) => target.aspect.startsWith('PRM_') && target.aspect !== 'PRM_RNM_RELATION').slice(0, 2).map((target) => target.targetId);
  const groups = options.group ? [{ operator: options.group, memberTargetRefs: prmTargets }] : [];
  if (options.overlap) groups.push({ operator: options.group === 'ALL_OF' ? 'ONE_OF' : 'ALL_OF', memberTargetRefs: prmTargets });
  const expectationSet = validatePharmaceuticalEvaluationExpectationSetV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-expectations/1',
    caseVersionId: clinicalReference.caseVersionId, targetSetFingerprint: targetSet.fingerprint, groups }, targetSet);
  const contextSource = { patientRuntime: pharmaceuticalD3PatientRuntimeV1(), clinicalReference, targetSet, transcript, expectationSet,
    candidateSet: buildPharmaceuticalSessionEvidenceCandidatesV2(transcript, targetSet) };
  const context = buildPharmaceuticalAdjudicationContextSetV2(contextSource);
  const semanticPlan = buildPharmaceuticalD1BatchPlanV1(context);
  const acceptedBatches = semanticPlan.semanticBatches.map((batch, index) => {
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(context, batch.batchDomain, 'pharmaceutical-d1-adjudication-prompt/3');
    const results = request.targets.map((target): PharmaceuticalD1ProviderTargetResultV1 => {
      const candidate = target.studentCandidates[0];
      const evidence = { messageRef: candidate.messageRef, excerpt: candidate.untrustedContent, evidenceKind: candidate.candidateEvidenceKinds[0] };
      const verdict = options.verdict ?? 'NOT_DEMONSTRATED';
      switch (verdict) {
        case 'CORRECTLY_DEMONSTRATED': return { targetRef: target.targetRef, verdict, supportingEvidence: [evidence] };
        case 'INCORRECT_OR_CONTRADICTED': return { targetRef: target.targetRef, verdict, contradictionEvidence: [evidence] };
        case 'UNCERTAIN': return { targetRef: target.targetRef, verdict, relatedEvidence: [evidence] };
        case 'NOT_DEMONSTRATED': return { targetRef: target.targetRef, verdict, evidence: [] };
      }
    });
    return buildPharmaceuticalD1AcceptedSemanticBatchV2(request,
      { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d1-provider-result/1', results },
      { semanticExecutionRef: parsePharmaceuticalSemanticExecutionIdV2(`pharm_sem_exec_00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`),
        lane: 'D1', provider: 'synthetic', responseModel: 'synthetic-offline', promptVersion: request.promptVersion,
        requestFingerprint: request.requestFingerprint, includedTargetRefs: request.targets.map((target) => target.targetRef) },
      context, request.promptVersion);
  });
  const d1Set = buildPharmaceuticalTargetSemanticAdjudicationSetV2(context, acceptedBatches);
  const source: PharmaceuticalScoreSourceV2 = { contextSource, context,
    d1: { set: d1Set, acceptedBatches, semanticAcceptance: 'VALIDATED_OFFLINE' },
    d2: { status: 'NOT_PROVIDED', reason: 'NOT_REQUESTED' } };
  const seen = new Set<string>();
  const units = context.targets.flatMap((target) => {
    const group = target.expectationMemberships[0];
    if (group && seen.has(group.groupRef)) return [];
    if (group) seen.add(group.groupRef);
    return [{ domain: target.clinicalContext.domain, operator: group?.operator ?? 'SINGLE',
      memberTargetRefs: group ? [...group.memberTargetRefs] : [target.targetRef], applicability: 'APPLICABLE',
      sourceExpectationGroupRefs: group ? [group.groupRef] : [] }];
  });
  const planDraft = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-plan/1', ref: { id: 'synthetic-plan', version: '1' },
    approval: 'APPROVED', caseVersionId: clinicalReference.caseVersionId,
    targetSet: { contractVersion: targetSet.contractVersion, fingerprint: targetSet.fingerprint },
    expectationSet: pharmaceuticalScoringExpectationBinding(contextSource), weightsRef, units };
  return { source, planDraft, d1Set };
}
function configuration(f = fixture(), editPlan: (draft: typeof f.planDraft) => void = () => {}) {
  const draft = clone(f.planDraft); editPlan(draft);
  const plan = buildPharmaceuticalScoringPlanV2(draft, f.source.contextSource);
  // Synthetic boundary values only. They are never exported as pedagogical defaults.
  const weights = buildPharmaceuticalScoringWeightsV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-weights/1',
    ref: weightsRef, approval: 'APPROVED', plan: pharmaceuticalScoringConfigBinding(plan), representation: 'SCALED_INTEGER',
    scale: 0, expectedTotal: '1', entries: plan.units.map((unit, index) => ({ scoringUnitId: unit.scoringUnitId, units: index === 0 ? '1' : '0' })) }, plan, f.source.contextSource);
  const policy = buildPharmaceuticalScoringPolicyV2(policyDraft());
  const thresholds = buildPharmaceuticalScoringThresholdsV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-thresholds/1',
    ref: thresholdsRef, approval: 'APPROVED', configuration: { status: 'NO_THRESHOLDS' } });
  const rounding = buildPharmaceuticalScoringRoundingV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-scoring-rounding/1',
    ref: roundingRef, approval: 'APPROVED', configuration: { status: 'CONFIGURED', scale: 1, roundingMode: 'HALF_UP', applyAt: 'FINAL_SCORE_ONLY' } });
  return { policy, plan, weights, thresholds, rounding };
}
function resultFixture(input: PharmaceuticalScoreInputV2, config: ReturnType<typeof configuration>, notScorable = false): Mutable<PharmaceuticalSessionScoreV2> {
  const zero = { numerator: '0', denominator: '1' }, one = { numerator: '1', denominator: '1' };
  const result = {
    schemaVersion: '2.0' as const, contractVersion: 'pharmaceutical-session-score/1' as const, validationScope: 'STRUCTURAL_ONLY' as const,
    status: notScorable ? 'NOT_SCORABLE' as const : input.reviewFlags.length ? 'PROVISIONAL_REVIEW_REQUIRED' as const : 'SCORED' as const,
    normalizedScore: notScorable ? null : 0, earned: zero, possible: notScorable ? zero : one,
    sourceBindings: input.bindings, reviewFlags: input.reviewFlags,
    unitContributions: config.plan.units.map((unit, index) => ({ scoringUnitId: unit.scoringUnitId, domain: unit.domain, operator: unit.operator,
      applicability: unit.applicability, memberOutcomes: input.d1Outcomes.filter((item) => unit.memberTargetRefs.includes(item.targetRef)),
      earned: zero, possible: index === 0 && !notScorable ? one : zero })),
    domainBreakdown: [...new Set(config.plan.units.map((unit) => unit.domain))].sort().map((domain) => ({ domain,
      scoringUnitRefs: config.plan.units.filter((unit) => unit.domain === domain).map((unit) => unit.scoringUnitId),
      earned: zero, possible: domain === config.plan.units[0].domain && !notScorable ? one : zero })),
  };
  const fingerprint = scoringFingerprint('pharmaceutical-session-score-v2/1', result);
  // Shape construction belongs only to fixtures; no production scorer/result builder exists.
  return clone({ result, fingerprint, receipt: {
    schemaVersion: '2.0', contractVersion: 'pharmaceutical-score-receipt/1', validationScope: 'STRUCTURAL_ONLY',
    rulesVersion: 'pharmaceutical-scoring-rules/1', sources: structuredClone(input.bindings), inputFingerprint: { ...input.fingerprint }, resultFingerprint: { ...fingerprint },
  } }) as Mutable<PharmaceuticalSessionScoreV2>;
}

describe('M6-E1 frozen policy and explicit pedagogical configuration', () => {
  it('preserves every D1/D2 mapping without executing scoring', () => {
    const policy = buildPharmaceuticalScoringPolicyV2(policyDraft());
    expect(validatePharmaceuticalScoringPolicyV2(policy)).toEqual(policy);
    expect(policy.d1Mapping.STRUCTURAL_NO_STUDENT_CANDIDATES).toBe('NO_CREDIT_STRUCTURAL');
    expect(policy.d1Mapping.UNCERTAIN).toBe('NO_CONFIRMED_CREDIT_REVIEW_REQUIRED');
    expect(policy.d2Mapping).toEqual({ CONTRADICTORY: 'REVIEW_ONLY', UNSUPPORTED: 'REVIEW_ONLY' });
    expect(policy.passFail).toBe('NONE'); expect(policy.claimFormEffect).toBe('NO_NUMERIC_EFFECT');
  });
  it.each(['contractVersion', 'schemaVersion', 'rulesVersion'] as const)('rejects unknown %s', (field) => {
    const draft = policyDraft(); draft[field] = 'unknown'; rejects(() => buildPharmaceuticalScoringPolicyV2(draft), 'UNSUPPORTED_VERSION');
  });
  it.each(['negativeScoring', 'automaticSource', 'allOf', 'oneOf', 'uncertain', 'passFail', 'hardFail', 'claimFormEffect'] as const)(
    'does not allow teacher policy changes to %s', (field) => {
      const draft = policyDraft(); draft[field] = 'OTHER'; rejects(() => buildPharmaceuticalScoringPolicyV2(draft));
    });
  it.each(['CORRECTLY_DEMONSTRATED', 'INCORRECT_OR_CONTRADICTED', 'UNCERTAIN', 'NOT_DEMONSTRATED', 'STRUCTURAL_NO_STUDENT_CANDIDATES'] as const)(
    'rejects a changed mapping for %s', (verdict) => {
      const draft = policyDraft(); draft.d1Mapping[verdict] = 'ARBITRARY'; rejects(() => buildPharmaceuticalScoringPolicyV2(draft));
    });
  it.each(['CONTRADICTORY', 'UNSUPPORTED'] as const)('forbids numeric D2 mapping %s', (kind) => {
    const draft = policyDraft(); draft.d2Mapping[kind] = 'PENALIZE'; rejects(() => buildPharmaceuticalScoringPolicyV2(draft));
  });
  it('has an explicit NO_THRESHOLDS snapshot without invented pass values', () => {
    const config = configuration(); expect(validatePharmaceuticalScoringThresholdsV2(config.thresholds)).toEqual(config.thresholds);
    expect(config.thresholds.configuration).toEqual({ status: 'NO_THRESHOLDS' });
  });
  it.each([undefined, null, {}, { status: 'NO_THRESHOLDS', pass: 50 }, { status: 'DEFINED', pass: 50 }])('rejects ambiguous or unsupported thresholds %#', (value) => {
    const core = body(configuration().thresholds); rejects(() => buildPharmaceuticalScoringThresholdsV2({ ...core, configuration: value }));
  });
  it.each(['HALF_UP', 'HALF_EVEN', 'DOWN'])('represents explicitly selected rounding %s without applying it', (roundingMode) => {
    const core = body(configuration().rounding);
    const item = buildPharmaceuticalScoringRoundingV2({ ...core, configuration: { status: 'CONFIGURED', scale: 2, roundingMode, applyAt: 'FINAL_SCORE_ONLY' } });
    expect(validatePharmaceuticalScoringRoundingV2(item)).toEqual(item);
  });
  it('represents explicit future thresholds but cannot apply them under rules/1', () => {
    const f = fixture(), config = configuration(f);
    const thresholds = buildPharmaceuticalScoringThresholdsV2({ ...body(config.thresholds), configuration: {
      status: 'DEFINED', thresholds: [{ thresholdId: 'synthetic-only', minimumScore: 42 }],
    } });
    expect(validatePharmaceuticalScoringThresholdsV2(thresholds)).toEqual(thresholds);
    rejects(() => buildPharmaceuticalScoreInputV2({ ...config, thresholds }, f.source), 'PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
  it.each(['policy', 'plan', 'weights', 'thresholds', 'rounding'] as const)('missing %s is pedagogical configuration required', (key) => {
    const f = fixture(), config = configuration(f);
    rejects(() => buildPharmaceuticalScoreInputV2({ ...config, [key]: undefined }, f.source), 'PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
  it.each(['plan', 'weights', 'thresholds', 'rounding'] as const)('unapproved %s cannot become a calculable input', (key) => {
    const f = fixture(), config = configuration(f), core = body(config[key]);
    // Resealing proves this is an approval check, not merely fingerprint tampering.
    const item = { ...core, approval: 'UNAPPROVED' };
    const candidate = { ...config, [key]: { ...item, fingerprint: scoringFingerprint(config[key].fingerprint.canonicalization, item) } };
    if (key === 'plan') {
      const weights = body(config.weights); weights.plan = pharmaceuticalScoringConfigBinding(candidate.plan);
      candidate.weights = buildPharmaceuticalScoringWeightsV2(weights, candidate.plan, f.source.contextSource);
    }
    rejects(() => buildPharmaceuticalScoreInputV2(candidate, f.source), 'PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
  it('accepts UNCONFIGURED rounding as a snapshot but blocks scoring input', () => {
    const f = fixture(), config = configuration(f);
    const rounding = buildPharmaceuticalScoringRoundingV2({ ...body(config.rounding), configuration: { status: 'UNCONFIGURED', reason: 'DECISION_REQUIRED' } });
    expect(validatePharmaceuticalScoringRoundingV2(rounding)).toEqual(rounding);
    rejects(() => buildPharmaceuticalScoreInputV2({ ...config, rounding }, f.source), 'PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
  it('blocks explicit UNCONFIGURED thresholds', () => {
    const f = fixture(), config = configuration(f);
    const thresholds = buildPharmaceuticalScoringThresholdsV2({ ...body(config.thresholds), configuration: { status: 'UNCONFIGURED', reason: 'DECISION_REQUIRED' } });
    rejects(() => buildPharmaceuticalScoreInputV2({ ...config, thresholds }, f.source), 'PEDAGOGICAL_CONFIGURATION_REQUIRED');
  });
});

describe('M6-E1 exact weights and complete non-overlapping plans', () => {
  it.each(['ALL_OF', 'ONE_OF'] as const)('preserves %s group identity and operator', (group) => {
    const f = fixture({ group }), config = configuration(f);
    expect(config.plan.units.filter((unit) => unit.operator === group)).toHaveLength(1);
    expect(validatePharmaceuticalScoringPlanV2(config.plan, f.source.contextSource)).toEqual(config.plan);
  });
  it('rejects actual upstream overlapping ALL_OF / ONE_OF without silently choosing one', () => {
    const f = fixture({ group: 'ALL_OF', overlap: true });
    rejects(() => configuration(f), 'INVALID_SCORING_PLAN');
  });
  it('rejects scoring a target separately and inside a group', () => {
    const f = fixture({ group: 'ALL_OF' });
    const group = f.planDraft.units.find((unit) => unit.operator === 'ALL_OF')!;
    const single = { ...group, operator: 'SINGLE', memberTargetRefs: [group.memberTargetRefs[0]], sourceExpectationGroupRefs: [] };
    rejects(() => buildPharmaceuticalScoringPlanV2({ ...f.planDraft, units: [...f.planDraft.units, single] }, f.source.contextSource), 'INVALID_SCORING_PLAN');
  });
  it.each(['ALL_OF', 'ONE_OF'] as const)('rejects empty %s', (operator) => {
    const f = fixture(); f.planDraft.units[0] = { ...f.planDraft.units[0], operator, memberTargetRefs: [] };
    rejects(() => buildPharmaceuticalScoringPlanV2(f.planDraft, f.source.contextSource), 'INVALID_SCORING_PLAN');
  });
  it('rejects duplicate scoringUnitId', () => {
    const f = fixture(), plan = clone(configuration(f).plan); plan.units.push(plan.units[0]);
    rejects(() => validatePharmaceuticalScoringPlanV2(plan, f.source.contextSource), 'INVALID_SCORING_PLAN');
  });
  it('rejects duplicate membership', () => {
    const f = fixture(); f.planDraft.units[0].memberTargetRefs.push(f.planDraft.units[0].memberTargetRefs[0]);
    rejects(() => buildPharmaceuticalScoringPlanV2(f.planDraft, f.source.contextSource), 'INVALID_SCORING_PLAN');
  });
  it('rejects missing targets even if omitted targets have no demonstration', () => {
    const f = fixture(); f.planDraft.units.pop();
    rejects(() => buildPharmaceuticalScoringPlanV2(f.planDraft, f.source.contextSource), 'INVALID_TARGET_COVERAGE');
  });
  it('rejects extra targets', () => {
    const f = fixture(); f.planDraft.units[0].memberTargetRefs = [`pharm_target_${'f'.repeat(64)}` as typeof f.planDraft.units[0]['memberTargetRefs'][number]];
    rejects(() => buildPharmaceuticalScoringPlanV2(f.planDraft, f.source.contextSource), 'INVALID_TARGET_COVERAGE');
  });
  it.each(['operator', 'applicability', 'domain'] as const)('rejects invalid unit %s', (field) => {
    const f = fixture(); const unit = { ...f.planDraft.units[0], [field]: 'UNKNOWN' };
    rejects(() => buildPharmaceuticalScoringPlanV2({ ...f.planDraft, units: [unit, ...f.planDraft.units.slice(1)] }, f.source.contextSource), 'INVALID_SCORING_PLAN');
  });
  it('preserves explicit NOT_APPLICABLE without changing D1 verdicts', () => {
    const f = fixture(), config = configuration(f, (draft) => { draft.units[0].applicability = 'NOT_APPLICABLE'; });
    const input = buildPharmaceuticalScoreInputV2(config, f.source);
    expect(config.plan.units.some((unit) => unit.applicability === 'NOT_APPLICABLE')).toBe(true);
    expect(input.d1Outcomes.every((outcome) => outcome.resolution === 'SEMANTIC' && outcome.verdict === 'NOT_DEMONSTRATED')).toBe(true);
  });
  it('wrong case cannot be papered over with a new plan fingerprint', () => {
    const f = fixture(); f.planDraft.caseVersionId = 'casever_00000000-0000-4000-8000-000000000099' as typeof f.planDraft.caseVersionId;
    rejects(() => buildPharmaceuticalScoringPlanV2(f.planDraft, f.source.contextSource), 'SOURCE_BINDING_MISMATCH');
  });
  it('uses exact scaled integer total with zero weights allowed', () => {
    const f = fixture(), config = configuration(f), core = body(config.weights);
    core.scale = 18; core.entries[0].units = '999999999999999999'; core.entries[1].units = '1';
    const weights = buildPharmaceuticalScoringWeightsV2(core, config.plan, f.source.contextSource);
    expect(validatePharmaceuticalScoringWeightsV2(weights, config.plan, f.source.contextSource)).toEqual(weights);
    core.entries[1].units = '0';
    rejects(() => buildPharmaceuticalScoringWeightsV2(core, config.plan, f.source.contextSource), 'INVALID_WEIGHT_CONFIGURATION');
  });
  it.each(['-1', 'NaN', 'Infinity', '0.5', '01', '1e0', '', 1, Infinity, NaN])('rejects invalid weight representation %#', (units) => {
    const f = fixture(), config = configuration(f), core = body(config.weights);
    rejects(() => buildPharmaceuticalScoringWeightsV2({ ...core, entries: [{ ...core.entries[0], units }, ...core.entries.slice(1)] }, config.plan, f.source.contextSource), 'INVALID_WEIGHT_CONFIGURATION');
  });
  it.each(['missing', 'duplicate', 'total', 'zero', 'extra'] as const)('rejects %s weights without renormalizing', (kind) => {
    const f = fixture(), config = configuration(f), core = body(config.weights);
    if (kind === 'missing') core.entries.pop();
    if (kind === 'duplicate') core.entries.push(core.entries[0]);
    if (kind === 'total') core.entries[0].units = '2';
    if (kind === 'zero') core.entries[0].units = '0';
    if (kind === 'extra') core.entries[0].scoringUnitId = `pharm_scoring_unit_${'f'.repeat(64)}`;
    rejects(() => buildPharmaceuticalScoringWeightsV2(core, config.plan, f.source.contextSource), 'INVALID_WEIGHT_CONFIGURATION');
  });
  it('binds weights to the exact plan version', () => {
    const f = fixture(), config = configuration(f), core = body(config.weights); core.plan.ref.version = 'other';
    rejects(() => buildPharmaceuticalScoringWeightsV2(core, config.plan, f.source.contextSource), 'SOURCE_BINDING_MISMATCH');
  });
});

describe('M6-E1 validated sources, debt and deterministic receipts', () => {
  it.each(['CORRECTLY_DEMONSTRATED', 'INCORRECT_OR_CONTRADICTED', 'UNCERTAIN', 'NOT_DEMONSTRATED'] as const)(
    'preserves %s as data without granting/calculating points', (verdict) => {
      const f = fixture({ verdict }), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source);
      expect(input.d1Outcomes.every((item) => item.resolution === 'SEMANTIC' && item.verdict === verdict)).toBe(true);
      expect(input).not.toHaveProperty('normalizedScore'); expect(input).not.toHaveProperty('earned');
      expect(validatePharmaceuticalScoreInputV2(input, config, f.source)).toEqual(input);
      if (verdict === 'UNCERTAIN') expect(input.reviewFlags.every((flag) => flag.code === 'UNCERTAIN_D1')).toBe(true);
    });
  it('retains structural no-candidate shells with no fabricated verdict or execution', () => {
    const f = fixture({ empty: true }), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source);
    for (const item of input.d1Outcomes) {
      expect(item.resolution).toBe('STRUCTURAL_NO_STUDENT_CANDIDATES'); expect(item).not.toHaveProperty('verdict'); expect(item).not.toHaveProperty('semanticExecutionRef');
    }
  });
  it('rejects missing D1 and raw provider-shaped D1', () => {
    const f = fixture(), config = configuration(f);
    rejects(() => buildPharmaceuticalScoreInputV2(config, { ...f.source, d1: { ...f.source.d1, set: undefined } }), 'INCOMPLETE_UPSTREAM');
    rejects(() => buildPharmaceuticalScoreInputV2(config, { ...f.source, d1: { ...f.source.d1, set: { results: [] } } }), 'UNVALIDATED_SOURCE');
  });
  it('rejects forged D1 with valid outer shape but no accepted batch witnesses', () => {
    const f = fixture(), config = configuration(f);
    rejects(() => buildPharmaceuticalScoreInputV2(config, { ...f.source, d1: { ...f.source.d1, acceptedBatches: [] } }), 'UNVALIDATED_SOURCE');
  });
  it('rejects wrong D1 session', () => {
    const f = fixture(), config = configuration(f); const set = { ...f.d1Set, sessionId: 'other' };
    rejects(() => buildPharmaceuticalScoreInputV2(config, { ...f.source, d1: { ...f.source.d1, set } }), 'UNVALIDATED_SOURCE');
  });
  it('rejects mutated context instead of trusting its embedded hash', () => {
    const f = fixture(), config = configuration(f); const context = clone(f.source.context) as Record<string, unknown>; context.sessionId = 'other';
    rejects(() => buildPharmaceuticalScoreInputV2(config, { ...f.source, context }), 'UNVALIDATED_SOURCE');
  });
  it('distinguishes explicit absent D2 from valid empty D2', () => {
    const f = fixture(), config = configuration(f), absent = buildPharmaceuticalScoreInputV2(config, f.source);
    const request = buildPharmaceuticalD2RelationalSemanticRequestV2(buildPharmaceuticalAdjudicationContextSetV2(f.source.contextSource), 'pharmaceutical-d2-claim-prompt/5');
    const providerResult = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: [] };
    const set = buildPharmaceuticalClinicalClaimFindingSetV2(request, providerResult);
    const provided = buildPharmaceuticalScoreInputV2(config, { ...f.source, d2: { status: 'PROVIDED', set, request, providerResult, semanticAcceptance: 'VALIDATED_OFFLINE' } });
    expect(absent.bindings.d2.status).toBe('NOT_PROVIDED'); expect(provided.bindings.d2.status).toBe('PROVIDED');
    expect(provided.fingerprint).not.toEqual(absent.fingerprint);
  });
  for (const findingType of ['UNSUPPORTED', 'CONTRADICTORY'] as const) {
    for (const claimForm of ['ASSERTION', 'CONCLUSION', 'RECOMMENDATION'] as const) {
      it(`keeps ${findingType}/${claimForm} review-only and preserves D2 validation debt`, () => {
        const f = fixture(), config = configuration(f), context = buildPharmaceuticalAdjudicationContextSetV2(f.source.contextSource);
        const request = buildPharmaceuticalD2RelationalSemanticRequestV2(context, 'pharmaceutical-d2-claim-prompt/5');
        const providerResult = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: [{
          messageRef: '1', excerpt: 'Proposición sintética', occurrenceIndex: 0, domain: 'PROFESSIONAL_RESPONSE', findingType, claimForm, relatedClinicalRefs: [],
        }] };
        const set = buildPharmaceuticalClinicalClaimFindingSetV2(request, providerResult);
        const input = buildPharmaceuticalScoreInputV2(config, { ...f.source, d2: { status: 'PROVIDED', set, request, providerResult, semanticAcceptance: 'VALIDATION_DEBT' } });
        expect(input.reviewFlags).toContainEqual({ code: findingType === 'UNSUPPORTED' ? 'UNSUPPORTED_D2' : 'CONTRADICTORY_D2', claimId: set.findings[0].claimId });
        expect(input.reviewFlags).toContainEqual({ code: 'UPSTREAM_VALIDATION_DEBT', lane: 'D2' });
        expect(input.bindings.upstreamSemanticAcceptanceStatus).toBe('VALIDATION_DEBT');
        if (input.bindings.d2.status !== 'PROVIDED') throw new Error('fixture D2 missing');
        expect(input.bindings.d2.numericEffect).toBe('NONE');
        const serialized = JSON.stringify(input);
        for (const forbidden of ['Proposición sintética', 'providerResult', 'untrustedContent', 'clinicalConclusions', 'rawResponse', 'apiKey']) expect(serialized).not.toContain(forbidden);
      });
    }
  }
  it('does not upgrade offline or debt sources to LIVE_ACCEPTED', () => {
    const f = fixture(), config = configuration(f);
    expect(buildPharmaceuticalScoreInputV2(config, f.source).bindings.upstreamSemanticAcceptanceStatus).toBe('VALIDATED_OFFLINE');
    const debt = { ...f.source, d1: { ...f.source.d1, semanticAcceptance: 'VALIDATION_DEBT' as const } };
    const input = clone(buildPharmaceuticalScoreInputV2(config, debt));
    input.bindings.upstreamSemanticAcceptanceStatus = 'LIVE_ACCEPTED';
    input.fingerprint = scoringFingerprint('pharmaceutical-score-input-v2/1', body(input));
    rejects(() => validatePharmaceuticalScoreInputV2(input, config, debt), 'SOURCE_BINDING_MISMATCH');
  });
  it.each(['policy', 'plan', 'weights', 'thresholds', 'rounding'] as const)('detects changed persisted %s fingerprint', (key) => {
    const f = fixture(), config = configuration(f), changed = clone(config); changed[key].fingerprint.value = '0'.repeat(64);
    rejects(() => validatePharmaceuticalScoringConfigurationV2(changed, f.source.contextSource), 'FINGERPRINT_MISMATCH');
  });
  it('rejects cross-version config references', () => {
    const f = fixture(), config = configuration(f); const core = policyDraft(); core.weightsRef = { ...weightsRef, version: '2' };
    rejects(() => buildPharmaceuticalScoreInputV2({ ...config, policy: buildPharmaceuticalScoringPolicyV2(core) }, f.source), 'SOURCE_BINDING_MISMATCH');
  });
  it('rejects unknown D1 prompt even with otherwise well-formed witnesses', () => {
    const f = fixture(), config = configuration(f), batches = structuredClone(f.source.d1.acceptedBatches);
    const changed = batches.map((batch) => ({ ...batch, execution: { ...batch.execution, promptVersion: 'pharmaceutical-d1-adjudication-prompt/99' } }));
    rejects(() => buildPharmaceuticalScoreInputV2(config, { ...f.source, d1: { ...f.source.d1, acceptedBatches: changed } }), 'UNSUPPORTED_VERSION');
  });
  it.each(['policyVersion', 'promptVersion'] as const)('rejects unknown D2 %s', (field) => {
    const f = fixture(), config = configuration(f), context = buildPharmaceuticalAdjudicationContextSetV2(f.source.contextSource);
    const request = buildPharmaceuticalD2RelationalSemanticRequestV2(context, 'pharmaceutical-d2-claim-prompt/5');
    const providerResult = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: [] };
    const set = buildPharmaceuticalClinicalClaimFindingSetV2(request, providerResult);
    rejects(() => buildPharmaceuticalScoreInputV2(config, { ...f.source, d2: { status: 'PROVIDED', set,
      request: { ...request, [field]: 'unknown' }, providerResult, semanticAcceptance: 'VALIDATION_DEBT' } }), 'UNSUPPORTED_VERSION');
  });
  it('rejects malformed or mismatched D2 instead of treating it as an empty review set', () => {
    const f = fixture(), config = configuration(f), context = buildPharmaceuticalAdjudicationContextSetV2(f.source.contextSource);
    const request = buildPharmaceuticalD2RelationalSemanticRequestV2(context, 'pharmaceutical-d2-claim-prompt/5');
    const providerResult = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: [] };
    const set = buildPharmaceuticalClinicalClaimFindingSetV2(request, providerResult);
    const d2 = { status: 'PROVIDED' as const, set, request, providerResult, semanticAcceptance: 'VALIDATION_DEBT' as const };
    rejects(() => buildPharmaceuticalScoreInputV2(config, { ...f.source, d2: { ...d2, set: { ...set, sessionId: 'other' } } }), 'UNVALIDATED_SOURCE');
    rejects(() => buildPharmaceuticalScoreInputV2(config, { ...f.source, d2: { ...d2, providerResult: { ...providerResult, rawResponse: 'SECRET' } } }), 'UNVALIDATED_SOURCE');
  });
  it.each(['duplicate', 'missing', 'extra'] as const)('rejects %s D1 outcomes even with a recomputed input fingerprint', (kind) => {
    const f = fixture(), config = configuration(f), input = clone(buildPharmaceuticalScoreInputV2(config, f.source));
    if (kind === 'duplicate') input.d1Outcomes.push(input.d1Outcomes[0]);
    if (kind === 'missing') input.d1Outcomes.pop();
    if (kind === 'extra') input.d1Outcomes.push({ ...input.d1Outcomes[0], targetRef: `pharm_target_${'f'.repeat(64)}` });
    input.d1Outcomes.sort((a, b) => a.targetRef < b.targetRef ? -1 : a.targetRef > b.targetRef ? 1 : 0);
    input.fingerprint = scoringFingerprint('pharmaceutical-score-input-v2/1', body(input));
    rejects(() => validatePharmaceuticalScoreInputV2(input, config, f.source), 'INVALID_TARGET_COVERAGE');
  });
  it('cannot remove mandatory uncertainty review by resealing the input', () => {
    const f = fixture({ verdict: 'UNCERTAIN' }), config = configuration(f), input = clone(buildPharmaceuticalScoreInputV2(config, f.source));
    input.reviewFlags = []; input.fingerprint = scoringFingerprint('pharmaceutical-score-input-v2/1', body(input));
    rejects(() => validatePharmaceuticalScoreInputV2(input, config, f.source), 'UNVALIDATED_SOURCE');
  });
  it('can add configured incorrect-D1 review without changing frozen verdict semantics', () => {
    const f = fixture({ verdict: 'INCORRECT_OR_CONTRADICTED' }), config = configuration(f), draft = policyDraft();
    draft.reviewPreferences.reviewIncorrectD1 = true;
    const input = buildPharmaceuticalScoreInputV2({ ...config, policy: buildPharmaceuticalScoringPolicyV2(draft) }, f.source);
    expect(input.reviewFlags.length).toBe(input.d1Outcomes.length);
    expect(input.reviewFlags.every((flag) => flag.code === 'INCORRECT_D1')).toBe(true);
  });
  it('canonicalizes persisted input array permutations', () => {
    const f = fixture({ verdict: 'UNCERTAIN' }), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source);
    const permuted = clone(input); permuted.d1Outcomes.reverse(); permuted.reviewFlags.reverse();
    expect(validatePharmaceuticalScoreInputV2(permuted, config, f.source)).toEqual(input);
  });
  it('is independent of object insertion order and canonicalizes set-like arrays', () => {
    const f = fixture({ group: 'ALL_OF' }), config = configuration(f);
    const shuffledPlan = clone(f.planDraft); shuffledPlan.units.reverse(); shuffledPlan.units.forEach((unit) => unit.memberTargetRefs.reverse());
    expect(buildPharmaceuticalScoringPlanV2(shuffledPlan, f.source.contextSource)).toEqual(config.plan);
    const reversed = Object.fromEntries(Object.entries(policyDraft()).reverse());
    expect(buildPharmaceuticalScoringPolicyV2(reversed)).toEqual(config.policy);
    const weights = body(config.weights); weights.entries.reverse();
    expect(buildPharmaceuticalScoringWeightsV2(weights, config.plan, f.source.contextSource)).toEqual(config.weights);
    expect(scoringCanonicalJson({ a: { b: 1, c: 2 } })).toBe(scoringCanonicalJson({ a: { c: 2, b: 1 } }));
  });
  it('same snapshots reproduce input and result shell byte for byte', () => {
    const f = fixture(), config = configuration(f);
    const first = buildPharmaceuticalScoreInputV2(config, f.source), second = buildPharmaceuticalScoreInputV2(clone(config), structuredClone(f.source));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(JSON.stringify(resultFixture(first, config))).toBe(JSON.stringify(resultFixture(second, config)));
  });
  it('version, applicability, grouping and weight changes affect fingerprints', () => {
    const f = fixture(), config = configuration(f);
    const policy = policyDraft(); policy.ref.version = '2';
    expect(buildPharmaceuticalScoringPolicyV2(policy).fingerprint).not.toEqual(config.policy.fingerprint);
    const changedPlan = configuration(f, (draft) => { draft.units[0].applicability = 'NOT_APPLICABLE'; });
    expect(changedPlan.plan.fingerprint).not.toEqual(config.plan.fingerprint);
    expect(changedPlan.plan.units.map((unit) => unit.scoringUnitId)).toEqual(config.plan.units.map((unit) => unit.scoringUnitId));
    const weights = body(config.weights); [weights.entries[0].units, weights.entries[1].units] = [weights.entries[1].units, weights.entries[0].units];
    expect(buildPharmaceuticalScoringWeightsV2(weights, config.plan, f.source.contextSource).fingerprint).not.toEqual(config.weights.fingerprint);
    expect(configuration(fixture({ group: 'ALL_OF' })).plan.fingerprint).not.toEqual(config.plan.fingerprint);
  });
  it('returns deeply frozen copies without exposing mutable source arrays', () => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source);
    expect(Object.isFrozen(input)).toBe(true); expect(Object.isFrozen(input.d1Outcomes)).toBe(true);
    expect(Object.isFrozen(config.plan.units[0].memberTargetRefs)).toBe(true);
    const snapshot = JSON.stringify(input); f.planDraft.units.reverse(); expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe('M6-E1 result/receipt structural validation, never numerical scoring', () => {
  it('accepts a fixture result with exact sources and reproducibility receipt', () => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config);
    expect(validatePharmaceuticalSessionScoreV2(result, input, config, f.source)).toEqual(result);
    expect(result.result.validationScope).toBe('STRUCTURAL_ONLY');
  });
  it.each(['unit', 'domain', 'total'] as const)('does not reconstruct %s possible from weights or aggregate scoring arithmetic', (level) => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source);
    for (const numerator of ['1', '2']) {
      const result = resultFixture(input, config);
      if (result.result.status !== 'SCORED') throw new Error('fixture should be scored');
      const contribution = level === 'unit' ? result.result.unitContributions[0]
        : level === 'domain' ? result.result.domainBreakdown[0] : result.result;
      contribution.possible = { numerator, denominator: '1' };
      // Reseal each supplied shape: acceptance must not rely on a stale fingerprint.
      result.fingerprint = scoringFingerprint('pharmaceutical-session-score-v2/1', result.result);
      result.receipt.resultFingerprint = result.fingerprint;
      expect(validatePharmaceuticalSessionScoreV2(result, input, config, f.source)).toEqual(result);
    }
  });
  describe.each(['unit', 'domain', 'total'] as const)('%s possible structural boundaries', (level) => {
    it.each([null, -1, NaN, Infinity,
      { numerator: '-1', denominator: '1' }, { numerator: 'NaN', denominator: '1' },
      { numerator: '1', denominator: '0' }])('rejects invalid possible %#', (possible) => {
      const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), original = resultFixture(input, config);
      const result = { ...original.result, ...(level === 'total' ? { possible } : {}),
        unitContributions: original.result.unitContributions.map((unit, index) => level === 'unit' && index === 0 ? { ...unit, possible } : unit),
        domainBreakdown: original.result.domainBreakdown.map((domain, index) => level === 'domain' && index === 0 ? { ...domain, possible } : domain) };
      rejects(() => validatePharmaceuticalSessionScoreV2({ ...original, result }, input, config, f.source), 'INVALID_NUMERIC_STATE');
    });
  });
  it.each([0, { numerator: '0', denominator: '1' }])('rejects non-null possible in INVALID status %#', (possible) => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), original = resultFixture(input, config);
    const result = { ...original.result, status: 'INVALID', normalizedScore: null, earned: null, possible,
      unitContributions: [], domainBreakdown: [], errorCode: 'INVALID_NUMERIC_STATE' };
    rejects(() => validatePharmaceuticalSessionScoreV2({ ...original, result }, input, config, f.source), 'INVALID_NUMERIC_STATE');
  });
  it('still rejects earned greater than supplied possible without reconstructing either value', () => {
    const f = fixture({ verdict: 'CORRECTLY_DEMONSTRATED' }), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config);
    result.result.unitContributions[0].earned = { numerator: '2', denominator: '1' };
    rejects(() => validatePharmaceuticalSessionScoreV2(result, input, config, f.source), 'INVALID_NUMERIC_STATE');
  });
  it('retains UNCERTAIN review flags and rejects SCORED masquerading as final', () => {
    const f = fixture({ verdict: 'UNCERTAIN' }), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config);
    expect(result.result.status).toBe('PROVISIONAL_REVIEW_REQUIRED');
    validatePharmaceuticalSessionScoreV2(result, input, config, f.source);
    result.result.status = 'SCORED';
    rejects(() => validatePharmaceuticalSessionScoreV2(result, input, config, f.source), 'INVALID_NUMERIC_STATE');
  });
  it('explicit all-not-applicable produces only a NOT_SCORABLE fixture shape, never 100', () => {
    const f = fixture(), config = configuration(f, (draft) => draft.units.forEach((unit) => { unit.applicability = 'NOT_APPLICABLE'; }));
    const input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config, true);
    expect(validatePharmaceuticalSessionScoreV2(result, input, config, f.source).result.normalizedScore).toBeNull();
  });
  it('represents an INVALID result without invented numeric values', () => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), original = resultFixture(input, config);
    const result = { ...original.result, status: 'INVALID' as const, normalizedScore: null, earned: null, possible: null,
      unitContributions: [], domainBreakdown: [], errorCode: 'INVALID_NUMERIC_STATE' as const };
    const fingerprint = scoringFingerprint('pharmaceutical-session-score-v2/1', result);
    expect(validatePharmaceuticalSessionScoreV2({ result, fingerprint, receipt: { ...original.receipt, resultFingerprint: fingerprint } }, input, config, f.source).result.status).toBe('INVALID');
  });
  it.each([null, NaN, Infinity, -1, 101])('rejects invalid normalized score %#', (score) => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config);
    rejects(() => validatePharmaceuticalSessionScoreV2({ ...result, result: { ...result.result, normalizedScore: score } }, input, config, f.source), 'INVALID_NUMERIC_STATE');
  });
  it('rejects positive earned from NOT_DEMONSTRATED', () => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config);
    result.result.unitContributions[0].earned.numerator = '1';
    rejects(() => validatePharmaceuticalSessionScoreV2(result, input, config, f.source), 'INVALID_NUMERIC_STATE');
  });
  it('rejects an empty denominator for SCORED', () => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config);
    if (result.result.status !== 'SCORED') throw new Error('fixture should be scored');
    result.result.possible = { numerator: '0', denominator: '1' };
    rejects(() => validatePharmaceuticalSessionScoreV2(result, input, config, f.source), 'INVALID_NUMERIC_STATE');
  });
  it.each(['units', 'domains', 'members'] as const)('rejects missing result %s coverage', (kind) => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config);
    if (kind === 'units') result.result.unitContributions.pop();
    if (kind === 'domains') result.result.domainBreakdown.pop();
    if (kind === 'members') result.result.unitContributions[0].memberOutcomes[0].targetRef = `pharm_target_${'f'.repeat(64)}`;
    rejects(() => validatePharmaceuticalSessionScoreV2(result, input, config, f.source), 'INVALID_TARGET_COVERAGE');
  });
  it('rejects tampered result fingerprint', () => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config);
    result.fingerprint = { ...result.fingerprint, value: '0'.repeat(64) };
    rejects(() => validatePharmaceuticalSessionScoreV2(result, input, config, f.source), 'FINGERPRINT_MISMATCH');
  });
  it.each(['sources', 'inputFingerprint', 'resultFingerprint'] as const)('rejects altered receipt %s', (field) => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source), result = resultFixture(input, config);
    if (field === 'sources') result.receipt.sources.sessionId = 'other'; else result.receipt[field].value = '0'.repeat(64);
    rejects(() => validatePharmaceuticalSessionScoreV2(result, input, config, f.source), 'SOURCE_BINDING_MISMATCH');
  });
  it('rejects unknown/raw properties rather than stripping them', () => {
    const f = fixture(), config = configuration(f), input = buildPharmaceuticalScoreInputV2(config, f.source);
    rejects(() => validatePharmaceuticalScoreInputV2({ ...input, rawProviderResponse: 'SECRET' }, config, f.source));
    const result = resultFixture(input, config);
    rejects(() => validatePharmaceuticalSessionScoreV2({ ...result, receipt: { ...result.receipt, prompt: 'SECRET' } }, input, config, f.source));
  });
  it('does not leak source text or raw provider data through typed errors', () => {
    const f = fixture(), config = configuration(f);
    try { buildPharmaceuticalScoreInputV2(config, { ...f.source, d1: { ...f.source.d1, set: { raw: 'SECRET_CLINICAL_TEXT' } } }); }
    catch (error) { expect(String(error)).not.toContain('SECRET_CLINICAL_TEXT'); expect(JSON.stringify(error)).not.toContain('SECRET_CLINICAL_TEXT'); return; }
    throw new Error('expected rejection');
  });
});
