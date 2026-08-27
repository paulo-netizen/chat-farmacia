import { describe, expect, it } from 'vitest';

import { buildPharmaceuticalEvaluationTargetSetV2 } from '@/lib/cases/v2/build-pharmaceutical-evaluation-target-set';
import type { PharmaceuticalEvaluationTargetAspectV2 } from '@/lib/cases/v2/pharmaceutical-evaluation-target-types';
import { validatePharmaceuticalClinicalReferenceV2 } from '@/lib/cases/v2/validate-pharmaceutical-clinical-reference';
import {
  PharmaceuticalEvaluationTargetSetValidationError,
  validatePharmaceuticalEvaluationTargetSetV2,
} from '@/lib/cases/v2/validate-pharmaceutical-evaluation-target-set';
import { validatePharmaceuticalEvaluationExpectationSetV2 } from '@/lib/cases/v2/validate-pharmaceutical-evaluation-expectations';

const caseVersionId = 'casever_71000000-0000-4000-8000-000000000001';
const medA = 'med_72000000-0000-4000-8000-000000000001';
let counter = 0;
const cid = () => `conclusion_73000000-0000-4000-8000-${(++counter).toString().padStart(12, '0')}`;

function referenceInput(identifiedReport = true): Record<string, any> {
  counter = 0;
  const ids = {
    spfa: cid(), prmAssessment: cid(), prm: cid(), rnm: cid(), relation: cid(),
    adherence: cid(), adherenceType: cid(), barrierAssessment: cid(), barrier: cid(),
    strategy: cid(), referral: cid(), action: cid(), intervention: cid(), incidence: cid(),
  };
  return {
    schemaVersion: '2.0', caseVersionId,
    versions: {
      evaluatorSchema: { id: 'evaluator-view', version: '2.0' },
      protocol: { id: 'foro-af-fc', version: '2024' },
      prmTaxonomy: { id: 'foro-prm', version: '2024' },
      rnmTaxonomy: { id: 'foro-rnm', version: '2024' },
      adherenceFramework: { id: 'foro-adherence', version: '2024' },
      barrierTaxonomy: { id: 'barriers', version: '1' },
      professionalActionTaxonomy: { id: 'actions', version: '1' },
      pharmaceuticalInterventionTaxonomy: { id: 'interventions', version: '1' },
      referralDestinationTaxonomy: { id: 'destinations', version: '1' },
    },
    structuralContext: {
      carePath: { initialSpfa: { conclusionId: ids.spfa, kind: 'spfa', value: { service: 'dispensing', subtype: 'initial_treatment' } }, additionalSpfas: [], transitions: [] },
      followUpEpisodes: [],
      prmRnmRelations: [{ conclusionId: ids.relation, kind: 'prm_rnm_relation', value: { prmRef: ids.prm, rnmAssessmentRef: ids.rnm, relation: 'creates_risk_of_rnm' } }],
    },
    clinicalConclusions: {
      incidence: { assessment: { conclusionId: ids.incidence, kind: 'incidence_assessment', value: { status: 'none' } }, findings: [] },
      prm: {
        assessment: { conclusionId: ids.prmAssessment, kind: 'prm_assessment', value: { status: 'present' } },
        findings: [{ conclusionId: ids.prm, kind: 'prm', value: { classification: { taxonomyId: 'foro-prm', taxonomyVersion: '2024', conceptId: 'PRM-A' }, medicationRefs: [medA] } }],
      },
      rnmAssessments: [{ conclusionId: ids.rnm, kind: 'rnm_assessment', value: { status: 'risk_of_rnm', classification: { taxonomyId: 'foro-rnm', taxonomyVersion: '2024', conceptId: 'RNM-RISK' }, medicationRefs: [medA] } }],
      adherence: {
        assessments: [{ conclusionId: ids.adherence, kind: 'adherence_assessment', value: { medicationRefs: [medA], status: 'non_adherent' } }],
        typeConclusions: [{ conclusionId: ids.adherenceType, kind: 'non_adherence_type', value: { adherenceAssessmentRef: ids.adherence, status: 'determined', type: 'unintentional' } }],
        patientProfiles: [],
        barrierAssessments: [{ conclusionId: ids.barrierAssessment, kind: 'adherence_barrier_assessment', value: { adherenceAssessmentRef: ids.adherence, status: 'identified' } }],
        barriers: [{ conclusionId: ids.barrier, kind: 'adherence_barrier', value: { barrierAssessmentRef: ids.barrierAssessment, role: 'primary', category: 'practical', classification: { taxonomyId: 'barriers', taxonomyVersion: '1', conceptId: 'FORGETFULNESS' } } }],
        strategies: [{ conclusionId: ids.strategy, kind: 'adherence_strategy', value: { adherenceAssessmentRef: ids.adherence, addressedBarrierRefs: [ids.barrier], category: 'educational' } }],
      },
      professionalActions: [{ conclusionId: ids.action, kind: 'professional_action', value: { spfaRef: ids.spfa, category: 'referral', classification: { taxonomyId: 'actions', taxonomyVersion: '1', conceptId: 'REFER' }, referralRef: ids.referral } }],
      pharmaceuticalInterventions: [{ conclusionId: ids.intervention, kind: 'pharmaceutical_intervention', value: { spfaRef: ids.spfa, professionalActionRef: ids.action, target: 'treatment', classification: { taxonomyId: 'interventions', taxonomyVersion: '1', conceptId: 'REVIEW' }, addressedConclusionRefs: [ids.prm, ids.rnm], referralRef: ids.referral } }],
      referral: {
        conclusionId: ids.referral, kind: 'referral', value: {
          status: 'required', urgency: 'urgent', reason: 'Derivación clínica necesaria',
          destination: { label: 'Medicina de familia', classification: { taxonomyId: 'destinations', taxonomyVersion: '1', conceptId: 'PRIMARY-CARE' } },
          report: identifiedReport ? {
            contractVersion: 'identified-report-requirement/1', status: 'required', essentialContents: [
              { contentId: 'report_content_74000000-0000-4000-8000-000000000002', content: 'Medicamentos implicados' },
              { contentId: 'report_content_74000000-0000-4000-8000-000000000001', content: 'Motivo de derivación' },
            ],
          } : { status: 'required', essentialContents: ['Medicamentos implicados', 'Motivo de derivación'] },
        },
      },
    },
  };
}

function reference(identified = true) {
  return validatePharmaceuticalClinicalReferenceV2(referenceInput(identified));
}

function clone<T>(value: T): T { return structuredClone(value); }

describe('PharmaceuticalEvaluationTargetSetV2', () => {
  it('builds all supported atomic aspects from the canonical clinical reference', () => {
    const aspects = new Set(buildPharmaceuticalEvaluationTargetSetV2(reference()).targets.map((target) => target.aspect));
    const expected: PharmaceuticalEvaluationTargetAspectV2[] = [
      'PRM_STATUS', 'PRM_EXISTENCE', 'PRM_CLASSIFICATION', 'PRM_MEDICATION_SCOPE',
      'RNM_STATUS', 'RNM_CLASSIFICATION', 'RNM_MEDICATION_SCOPE', 'PRM_RNM_RELATION',
      'ADHERENCE_STATUS', 'ADHERENCE_TYPE', 'ADHERENCE_MEDICATION_SCOPE',
      'BARRIER_EXISTENCE', 'BARRIER_CATEGORY', 'BARRIER_ROLE', 'BARRIER_CLASSIFICATION',
      'STRATEGY_CATEGORY', 'STRATEGY_ADDRESSED_REFS',
      'PROFESSIONAL_ACTION_CATEGORY', 'PROFESSIONAL_ACTION_CLASSIFICATION', 'PROFESSIONAL_ACTION_SPFA_REF', 'PROFESSIONAL_ACTION_REFERRAL_REF',
      'INTERVENTION_TARGET', 'INTERVENTION_CLASSIFICATION', 'INTERVENTION_ADDRESSED_REFS', 'INTERVENTION_ACTION_REF', 'INTERVENTION_REFERRAL_REF',
      'REFERRAL_NEED', 'REFERRAL_URGENCY', 'REFERRAL_DESTINATION', 'REFERRAL_REASON', 'REPORT_STATUS', 'REPORT_CONTENT',
    ];
    expected.forEach((aspect) => expect(aspects).toContain(aspect));
    expect(aspects).not.toContain('SAFETY');
  });

  it('uses four closed categories and never emits verdicts or scores', () => {
    const result = buildPharmaceuticalEvaluationTargetSetV2(reference());
    expect(new Set(result.targets.map((target) => target.category))).toEqual(new Set(['IDENTIFICATION', 'INTERPRETATION', 'DECISION', 'ACTION']));
    expect(JSON.stringify(result)).not.toMatch(/SUPPORTED|INCORRECT|NOT_DEMONSTRATED|UNCERTAIN|score|verdict/);
  });

  it('creates deterministic opaque IDs and a lowercase SHA-256 fingerprint', () => {
    const first = buildPharmaceuticalEvaluationTargetSetV2(reference());
    const second = buildPharmaceuticalEvaluationTargetSetV2(reference());
    expect(second).toEqual(first);
    first.targets.forEach((target) => expect(target.targetId).toMatch(/^pharm_target_[0-9a-f]{64}$/));
    expect(first.fingerprint).toEqual({ algorithm: 'sha256', canonicalization: 'pharmaceutical-evaluation-target-set-v2/1', value: expect.stringMatching(/^[0-9a-f]{64}$/) });
  });

  it('gives distinct IDs to different aspects over the same clinical reference', () => {
    const grouped = buildPharmaceuticalEvaluationTargetSetV2(reference()).targets.filter((target) => target.aspect.startsWith('PRM_') && target.aspect !== 'PRM_STATUS');
    expect(new Set(grouped.map((target) => target.targetId)).size).toBe(grouped.length);
  });

  it('does not derive IDs from array position or report content text', () => {
    const input = referenceInput(true);
    const first = buildPharmaceuticalEvaluationTargetSetV2(validatePharmaceuticalClinicalReferenceV2(input));
    input.clinicalConclusions.referral.value.report.essentialContents.reverse();
    input.clinicalConclusions.referral.value.report.essentialContents[0].content = 'Texto docente actualizado';
    const second = buildPharmaceuticalEvaluationTargetSetV2(validatePharmaceuticalClinicalReferenceV2(input));
    const ids = (set: typeof first) => set.targets.filter((target) => target.aspect === 'REPORT_CONTENT').map((target) => target.targetId).sort();
    expect(ids(second)).toEqual(ids(first));
    expect(second.fingerprint.value).not.toBe(first.fingerprint.value);
  });

  it('creates one atomic target per identified report content', () => {
    const contents = buildPharmaceuticalEvaluationTargetSetV2(reference()).targets.filter((target) => target.aspect === 'REPORT_CONTENT');
    expect(contents).toHaveLength(2);
    expect(new Set(contents.map((target) => target.clinicalRef.kind === 'REPORT_CONTENT' ? target.clinicalRef.reportContentRef : '')).size).toBe(2);
  });

  it('keeps historical report strings valid but creates no synthetic content targets', () => {
    const result = buildPharmaceuticalEvaluationTargetSetV2(reference(false));
    expect(result.targets.some((target) => target.aspect === 'REPORT_STATUS')).toBe(true);
    expect(result.targets.some((target) => target.aspect === 'REPORT_CONTENT')).toBe(false);
  });

  it('applies referral/report not-required rules without artificial child targets', () => {
    const input = referenceInput();
    input.clinicalConclusions.professionalActions = [];
    input.clinicalConclusions.pharmaceuticalInterventions = [];
    input.clinicalConclusions.referral.value = { status: 'not_required' };
    const result = buildPharmaceuticalEvaluationTargetSetV2(validatePharmaceuticalClinicalReferenceV2(input));
    expect(result.targets.filter((target) => target.aspect.startsWith('REFERRAL_')).map((target) => target.aspect)).toEqual(['REFERRAL_NEED']);
    expect(result.targets.some((target) => target.aspect.startsWith('REPORT_'))).toBe(false);
  });

  it('does not create non-adherence-only targets for an adherent assessment', () => {
    const input = referenceInput();
    const assessment = input.clinicalConclusions.adherence.assessments[0];
    assessment.value.status = 'adherent';
    input.clinicalConclusions.adherence.typeConclusions = [];
    input.clinicalConclusions.adherence.barrierAssessments = [];
    input.clinicalConclusions.adherence.barriers = [];
    input.clinicalConclusions.adherence.strategies = [];
    const result = buildPharmaceuticalEvaluationTargetSetV2(validatePharmaceuticalClinicalReferenceV2(input));
    expect(result.targets.some((target) => target.aspect === 'ADHERENCE_STATUS')).toBe(true);
    expect(result.targets.some((target) => target.aspect === 'ADHERENCE_TYPE' || target.aspect.startsWith('BARRIER_'))).toBe(false);
  });

  it('validates the canonical target set and rejects unknown properties', () => {
    const clinical = reference();
    const valid = buildPharmaceuticalEvaluationTargetSetV2(clinical);
    expect(validatePharmaceuticalEvaluationTargetSetV2(valid, clinical)).toEqual(valid);
    const invalid = clone(valid) as any;
    invalid.futureSecret = true;
    expect(() => validatePharmaceuticalEvaluationTargetSetV2(invalid, clinical)).toThrow(PharmaceuticalEvaluationTargetSetValidationError);
  });

  it.each([
    ['target identity', (value: any) => { value.targets[0].targetId = `pharm_target_${'0'.repeat(64)}`; }],
    ['clinical ref', (value: any) => { value.targets[0].clinicalRef.conclusionRef = cid(); }],
    ['expected value', (value: any) => { value.targets[0].expectedValue.value = 'other'; }],
    ['order', (value: any) => { value.targets.reverse(); }],
    ['fingerprint', (value: any) => { value.fingerprint.value = '0'.repeat(64); }],
  ])('rejects tampering with %s', (_label, mutate) => {
    const clinical = reference();
    const invalid = clone(buildPharmaceuticalEvaluationTargetSetV2(clinical)) as any;
    mutate(invalid);
    expect(() => validatePharmaceuticalEvaluationTargetSetV2(invalid, clinical)).toThrow(PharmaceuticalEvaluationTargetSetValidationError);
  });

  it('does not mutate or leak patient facts, evaluator raw, transcript, metadata or evidence', () => {
    const input = reference();
    const before = clone(input);
    const result = buildPharmaceuticalEvaluationTargetSetV2(input);
    expect(input).toEqual(before);
    const serialized = JSON.stringify(result);
    ['patientFacts', 'evidenceRules', 'teacherRationale', 'transcript', 'messages', 'model', 'usage', 'prompt'].forEach((term) => expect(serialized).not.toContain(term));
  });

  it('accepts an empty optional teacher expectation set', () => {
    const targets = buildPharmaceuticalEvaluationTargetSetV2(reference());
    const result = validatePharmaceuticalEvaluationExpectationSetV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-expectations/1', caseVersionId, targetSetFingerprint: targets.fingerprint, groups: [] }, targets);
    expect(result.groups).toEqual([]);
  });

  it.each(['ALL_OF', 'ONE_OF'] as const)('validates and canonizes a teacher-authored %s group', (operator) => {
    const targets = buildPharmaceuticalEvaluationTargetSetV2(reference());
    const refs = [targets.targets[1].targetId, targets.targets[0].targetId];
    const result = validatePharmaceuticalEvaluationExpectationSetV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-expectations/1', caseVersionId, targetSetFingerprint: targets.fingerprint, groups: [{ operator, memberTargetRefs: refs }] }, targets);
    expect(result.groups[0].memberTargetRefs).toEqual([...refs].sort());
  });

  it.each([
    ['empty group', (value: any) => { value.groups = [{ operator: 'ALL_OF', memberTargetRefs: [] }]; }],
    ['unknown target', (value: any) => { value.groups = [{ operator: 'ONE_OF', memberTargetRefs: [`pharm_target_${'f'.repeat(64)}`] }]; }],
    ['duplicate member', (value: any, targets: any) => { value.groups = [{ operator: 'ALL_OF', memberTargetRefs: [targets.targets[0].targetId, targets.targets[0].targetId] }]; }],
    ['wrong target set', (value: any) => { value.targetSetFingerprint.value = '0'.repeat(64); }],
  ])('rejects expectation %s', (_label, mutate) => {
    const targets = buildPharmaceuticalEvaluationTargetSetV2(reference());
    const value: any = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-expectations/1', caseVersionId, targetSetFingerprint: clone(targets.fingerprint), groups: [] };
    mutate(value, targets);
    expect(() => validatePharmaceuticalEvaluationExpectationSetV2(value, targets)).toThrow();
  });
});
