import { buildPharmaceuticalScoreInputV2, type PharmaceuticalScoreSourceV2 } from '../../../lib/cases/v2/build-pharmaceutical-score-input';
import { buildPharmaceuticalScoringPlanV2, pharmaceuticalScoringExpectationBinding } from '../../../lib/cases/v2/build-pharmaceutical-scoring-plan';
import {
  buildPharmaceuticalScoringPolicyV2, buildPharmaceuticalScoringRoundingV2, buildPharmaceuticalScoringThresholdsV2,
  buildPharmaceuticalScoringWeightsV2, pharmaceuticalScoringConfigBinding,
} from '../../../lib/cases/v2/build-pharmaceutical-scoring-policy';
import { validatePharmaceuticalClinicalReferenceV2 } from '../../../lib/cases/v2/validate-pharmaceutical-clinical-reference';
import { buildPharmaceuticalEvaluationTargetSetV2 } from '../../../lib/cases/v2/build-pharmaceutical-evaluation-target-set';
import { buildPharmaceuticalAdjudicationContextSetV2 } from '../../../lib/cases/v2/build-pharmaceutical-adjudication-context';
import { buildPharmaceuticalSessionEvidenceCandidatesV2 } from '../../../lib/cases/v2/build-pharmaceutical-session-evidence-candidates';
import { validatePharmaceuticalEvaluationExpectationSetV2 } from '../../../lib/cases/v2/validate-pharmaceutical-evaluation-expectations';
import { createSessionTranscriptSnapshotV2 } from '../../../lib/cases/v2/spfa-session-transcript';
import { buildPharmaceuticalD1BatchPlanV1 } from '../../../lib/cases/v2/build-pharmaceutical-d1-batch-plan';
import { buildPharmaceuticalD1SemanticBatchRequestV2 } from '../../../lib/cases/v2/build-pharmaceutical-d1-semantic-request';
import { buildPharmaceuticalD1AcceptedSemanticBatchV2, buildPharmaceuticalTargetSemanticAdjudicationSetV2, parsePharmaceuticalSemanticExecutionIdV2 } from '../../../lib/cases/v2/validate-pharmaceutical-d1-adjudication';
import type { PharmaceuticalD1ProviderTargetResultV1 } from '../../../lib/cases/v2/pharmaceutical-d1-adjudication-types';
import { pharmaceuticalD3ClinicalReferenceV1, pharmaceuticalD3PatientRuntimeV1 } from '../../live/support/pharmaceutical-d3-live-matrix';

const ref = (id: string) => ({ id: `E3-SYNTHETIC-TEST-ONLY-${id}`, version: '1' });
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
export function fixture(o: Options = {}) {
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
