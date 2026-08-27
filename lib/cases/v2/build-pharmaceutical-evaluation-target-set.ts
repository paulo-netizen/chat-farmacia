import { createHash } from 'node:crypto';

import {
  type ConclusionId,
  type TaxonomyTermRef,
} from './evaluator-types';
import type { PharmaceuticalClinicalReferenceV2 } from './pharmaceutical-clinical-reference-types';
import type {
  PharmaceuticalEvaluationClinicalRefV2,
  PharmaceuticalEvaluationExpectedValueV2,
  PharmaceuticalEvaluationTargetAspectV2,
  PharmaceuticalEvaluationTargetCategoryV2,
  PharmaceuticalEvaluationTargetId,
  PharmaceuticalEvaluationTargetSetV2,
  PharmaceuticalEvaluationTargetV2,
} from './pharmaceutical-evaluation-target-types';
import type { MedicationId } from './types';
import { validatePharmaceuticalClinicalReferenceV2 } from './validate-pharmaceutical-clinical-reference';

const CONTRACT_VERSION = 'pharmaceutical-evaluation-target-set/1' as const;
const CANONICALIZATION = 'pharmaceutical-evaluation-target-set-v2/1' as const;

const DOMAIN_ORDER: Record<string, number> = {
  PRM: 0,
  RNM: 1,
  PRM_RNM: 2,
  ADHERENCE: 3,
  BARRIER: 4,
  STRATEGY: 5,
  PROFESSIONAL_ACTION: 6,
  INTERVENTION: 7,
  REFERRAL: 8,
  REPORT: 9,
};

const ASPECT_ORDER: Record<PharmaceuticalEvaluationTargetAspectV2, number> = {
  PRM_STATUS: 0, PRM_EXISTENCE: 1, PRM_CLASSIFICATION: 2, PRM_MEDICATION_SCOPE: 3,
  RNM_STATUS: 0, RNM_CLASSIFICATION: 1, RNM_MEDICATION_SCOPE: 2,
  PRM_RNM_RELATION: 0,
  ADHERENCE_STATUS: 0, ADHERENCE_TYPE: 1, ADHERENCE_MEDICATION_SCOPE: 2,
  BARRIER_EXISTENCE: 0, BARRIER_CATEGORY: 1, BARRIER_ROLE: 2, BARRIER_CLASSIFICATION: 3,
  STRATEGY_CATEGORY: 0, STRATEGY_ADDRESSED_REFS: 1,
  PROFESSIONAL_ACTION_CATEGORY: 0, PROFESSIONAL_ACTION_CLASSIFICATION: 1,
  PROFESSIONAL_ACTION_SPFA_REF: 2, PROFESSIONAL_ACTION_TARGET_SPFA_REF: 3,
  PROFESSIONAL_ACTION_REFERRAL_REF: 4,
  INTERVENTION_TARGET: 0, INTERVENTION_CLASSIFICATION: 1,
  INTERVENTION_ADDRESSED_REFS: 2, INTERVENTION_ACTION_REF: 3,
  INTERVENTION_REFERRAL_REF: 4,
  REFERRAL_NEED: 0, REFERRAL_URGENCY: 1, REFERRAL_DESTINATION: 2, REFERRAL_REASON: 3,
  REPORT_STATUS: 0, REPORT_CONTENT: 1,
};

function domain(aspect: PharmaceuticalEvaluationTargetAspectV2): string {
  if (aspect.startsWith('PRM_RNM')) return 'PRM_RNM';
  if (aspect.startsWith('PRM_')) return 'PRM';
  if (aspect.startsWith('RNM_')) return 'RNM';
  if (aspect.startsWith('ADHERENCE_')) return 'ADHERENCE';
  if (aspect.startsWith('BARRIER_')) return 'BARRIER';
  if (aspect.startsWith('STRATEGY_')) return 'STRATEGY';
  if (aspect.startsWith('PROFESSIONAL_ACTION_')) return 'PROFESSIONAL_ACTION';
  if (aspect.startsWith('INTERVENTION_')) return 'INTERVENTION';
  if (aspect.startsWith('REFERRAL_')) return 'REFERRAL';
  return 'REPORT';
}

function canonicalRef(ref: PharmaceuticalEvaluationClinicalRefV2): string {
  if (ref.kind === 'CONCLUSION') return `CONCLUSION:${ref.conclusionRef}`;
  if (ref.kind === 'RELATION') return `RELATION:${ref.relationRef}`;
  return `REPORT_CONTENT:${ref.referralRef}:${ref.reportContentRef}`;
}

function targetId(
  caseVersionId: string,
  aspect: PharmaceuticalEvaluationTargetAspectV2,
  ref: PharmaceuticalEvaluationClinicalRefV2,
): PharmaceuticalEvaluationTargetId {
  const material = JSON.stringify([CONTRACT_VERSION, caseVersionId, aspect, canonicalRef(ref)]);
  return `pharm_target_${createHash('sha256').update(material).digest('hex')}` as PharmaceuticalEvaluationTargetId;
}

function asConclusionId(value: unknown): ConclusionId {
  return value as ConclusionId;
}

function sortedMedicationRefs(values: readonly unknown[]): MedicationId[] {
  return values.map((value) => value as MedicationId).sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function sortedConclusionRefs(values: readonly unknown[]): ConclusionId[] {
  return values.map(asConclusionId).sort((left, right) => left < right ? -1 : left > right ? 1 : 0);
}

function taxonomy(value: TaxonomyTermRef): Readonly<TaxonomyTermRef> {
  return { ...value };
}

function add(
  targets: PharmaceuticalEvaluationTargetV2[],
  caseVersionId: string,
  category: PharmaceuticalEvaluationTargetCategoryV2,
  aspect: PharmaceuticalEvaluationTargetAspectV2,
  clinicalRef: PharmaceuticalEvaluationClinicalRefV2,
  expectedValue: PharmaceuticalEvaluationExpectedValueV2,
): void {
  targets.push({
    targetId: targetId(caseVersionId, aspect, clinicalRef),
    category,
    aspect,
    clinicalRef: { ...clinicalRef },
    expectedValue,
  });
}

function conclusionRef(value: unknown): PharmaceuticalEvaluationClinicalRefV2 {
  return { kind: 'CONCLUSION', conclusionRef: asConclusionId(value) };
}

function buildTargets(reference: PharmaceuticalClinicalReferenceV2): PharmaceuticalEvaluationTargetV2[] {
  const targets: PharmaceuticalEvaluationTargetV2[] = [];
  const caseId = reference.caseVersionId;
  const conclusions = reference.clinicalConclusions;

  add(targets, caseId, 'IDENTIFICATION', 'PRM_STATUS', conclusionRef(conclusions.prm.assessment.conclusionId), { kind: 'ENUM', value: conclusions.prm.assessment.value.status });
  for (const finding of conclusions.prm.findings) {
    const ref = conclusionRef(finding.conclusionId);
    add(targets, caseId, 'IDENTIFICATION', 'PRM_EXISTENCE', ref, { kind: 'BOOLEAN', value: true });
    add(targets, caseId, 'INTERPRETATION', 'PRM_CLASSIFICATION', ref, { kind: 'TAXONOMY_TERM', value: taxonomy(finding.value.classification) });
    add(targets, caseId, 'IDENTIFICATION', 'PRM_MEDICATION_SCOPE', ref, { kind: 'MEDICATION_SCOPE', medicationRefs: sortedMedicationRefs(finding.value.medicationRefs) });
  }

  for (const assessment of conclusions.rnmAssessments) {
    const ref = conclusionRef(assessment.conclusionId);
    add(targets, caseId, 'IDENTIFICATION', 'RNM_STATUS', ref, { kind: 'ENUM', value: assessment.value.status });
    if (assessment.value.status !== 'no_rnm') {
      if (assessment.value.classification !== undefined) {
        add(targets, caseId, 'INTERPRETATION', 'RNM_CLASSIFICATION', ref, { kind: 'TAXONOMY_TERM', value: taxonomy(assessment.value.classification) });
      }
      add(targets, caseId, 'IDENTIFICATION', 'RNM_MEDICATION_SCOPE', ref, { kind: 'MEDICATION_SCOPE', medicationRefs: sortedMedicationRefs(assessment.value.medicationRefs) });
    }
  }
  for (const relation of reference.structuralContext.prmRnmRelations) {
    add(targets, caseId, 'INTERPRETATION', 'PRM_RNM_RELATION', { kind: 'RELATION', relationRef: asConclusionId(relation.conclusionId) }, { kind: 'PRM_RNM_RELATION', prmRef: asConclusionId(relation.value.prmRef), rnmAssessmentRef: asConclusionId(relation.value.rnmAssessmentRef), relation: relation.value.relation });
  }

  for (const assessment of conclusions.adherence.assessments) {
    const ref = conclusionRef(assessment.conclusionId);
    add(targets, caseId, 'IDENTIFICATION', 'ADHERENCE_STATUS', ref, { kind: 'ENUM', value: assessment.value.status });
    add(targets, caseId, 'IDENTIFICATION', 'ADHERENCE_MEDICATION_SCOPE', ref, { kind: 'MEDICATION_SCOPE', medicationRefs: sortedMedicationRefs(assessment.value.medicationRefs) });
  }
  for (const item of conclusions.adherence.typeConclusions) {
    if (item.value.status === 'determined') {
      add(targets, caseId, 'INTERPRETATION', 'ADHERENCE_TYPE', conclusionRef(item.conclusionId), { kind: 'ENUM', value: item.value.type });
    }
  }
  for (const assessment of conclusions.adherence.barrierAssessments) {
    add(targets, caseId, 'IDENTIFICATION', 'BARRIER_EXISTENCE', conclusionRef(assessment.conclusionId), { kind: 'ENUM', value: assessment.value.status });
  }
  for (const barrier of conclusions.adherence.barriers) {
    const ref = conclusionRef(barrier.conclusionId);
    add(targets, caseId, 'INTERPRETATION', 'BARRIER_CATEGORY', ref, { kind: 'ENUM', value: barrier.value.category });
    add(targets, caseId, 'INTERPRETATION', 'BARRIER_ROLE', ref, { kind: 'ENUM', value: barrier.value.role });
    if (barrier.value.classification !== undefined) add(targets, caseId, 'INTERPRETATION', 'BARRIER_CLASSIFICATION', ref, { kind: 'TAXONOMY_TERM', value: taxonomy(barrier.value.classification) });
  }
  for (const strategy of conclusions.adherence.strategies) {
    const ref = conclusionRef(strategy.conclusionId);
    add(targets, caseId, 'DECISION', 'STRATEGY_CATEGORY', ref, { kind: 'ENUM', value: strategy.value.category });
    add(targets, caseId, 'DECISION', 'STRATEGY_ADDRESSED_REFS', ref, { kind: 'CONCLUSION_REFS', conclusionRefs: sortedConclusionRefs(strategy.value.addressedBarrierRefs) });
  }
  for (const action of conclusions.professionalActions) {
    const ref = conclusionRef(action.conclusionId);
    add(targets, caseId, 'ACTION', 'PROFESSIONAL_ACTION_CATEGORY', ref, { kind: 'ENUM', value: action.value.category });
    add(targets, caseId, 'ACTION', 'PROFESSIONAL_ACTION_SPFA_REF', ref, { kind: 'CONCLUSION_REFS', conclusionRefs: [asConclusionId(action.value.spfaRef)] });
    if (action.value.classification !== undefined) add(targets, caseId, 'ACTION', 'PROFESSIONAL_ACTION_CLASSIFICATION', ref, { kind: 'TAXONOMY_TERM', value: taxonomy(action.value.classification) });
    if (action.value.targetSpfaRef !== undefined) add(targets, caseId, 'ACTION', 'PROFESSIONAL_ACTION_TARGET_SPFA_REF', ref, { kind: 'CONCLUSION_REFS', conclusionRefs: [asConclusionId(action.value.targetSpfaRef)] });
    if (action.value.referralRef !== undefined) add(targets, caseId, 'ACTION', 'PROFESSIONAL_ACTION_REFERRAL_REF', ref, { kind: 'CONCLUSION_REFS', conclusionRefs: [asConclusionId(action.value.referralRef)] });
  }
  for (const intervention of conclusions.pharmaceuticalInterventions) {
    const ref = conclusionRef(intervention.conclusionId);
    add(targets, caseId, 'ACTION', 'INTERVENTION_TARGET', ref, { kind: 'ENUM', value: intervention.value.target });
    if (intervention.value.classification !== undefined) add(targets, caseId, 'ACTION', 'INTERVENTION_CLASSIFICATION', ref, { kind: 'TAXONOMY_TERM', value: taxonomy(intervention.value.classification) });
    add(targets, caseId, 'ACTION', 'INTERVENTION_ADDRESSED_REFS', ref, { kind: 'CONCLUSION_REFS', conclusionRefs: sortedConclusionRefs(intervention.value.addressedConclusionRefs) });
    if (intervention.value.professionalActionRef !== undefined) add(targets, caseId, 'ACTION', 'INTERVENTION_ACTION_REF', ref, { kind: 'CONCLUSION_REFS', conclusionRefs: [asConclusionId(intervention.value.professionalActionRef)] });
    if (intervention.value.referralRef !== undefined) add(targets, caseId, 'ACTION', 'INTERVENTION_REFERRAL_REF', ref, { kind: 'CONCLUSION_REFS', conclusionRefs: [asConclusionId(intervention.value.referralRef)] });
  }

  const referral = conclusions.referral;
  const referralRef = conclusionRef(referral.conclusionId);
  add(targets, caseId, 'DECISION', 'REFERRAL_NEED', referralRef, { kind: 'ENUM', value: referral.value.status });
  if (referral.value.status === 'required') {
    add(targets, caseId, 'DECISION', 'REFERRAL_URGENCY', referralRef, { kind: 'ENUM', value: referral.value.urgency });
    add(targets, caseId, 'DECISION', 'REFERRAL_DESTINATION', referralRef, { kind: 'REFERRAL_DESTINATION', label: referral.value.destination.label, ...(referral.value.destination.classification === undefined ? {} : { classification: taxonomy(referral.value.destination.classification) }) });
    add(targets, caseId, 'DECISION', 'REFERRAL_REASON', referralRef, { kind: 'TEXT', value: referral.value.reason });
    add(targets, caseId, 'ACTION', 'REPORT_STATUS', referralRef, { kind: 'ENUM', value: referral.value.report.status });
    if ('contractVersion' in referral.value.report && referral.value.report.contractVersion === 'identified-report-requirement/1' && referral.value.report.status !== 'not_required') {
      for (const content of referral.value.report.essentialContents) {
        const contentId = content.contentId as unknown as import('./evaluator-types').ReportEssentialContentId;
        add(targets, caseId, 'ACTION', 'REPORT_CONTENT', { kind: 'REPORT_CONTENT', referralRef: asConclusionId(referral.conclusionId), reportContentRef: contentId }, { kind: 'REPORT_CONTENT', contentId, content: content.content });
      }
    }
  }

  return targets.sort((left, right) => {
    const domainDifference = DOMAIN_ORDER[domain(left.aspect)] - DOMAIN_ORDER[domain(right.aspect)];
    if (domainDifference !== 0) return domainDifference;
    const aspectDifference = ASPECT_ORDER[left.aspect] - ASPECT_ORDER[right.aspect];
    if (aspectDifference !== 0) return aspectDifference;
    const leftRef = canonicalRef(left.clinicalRef);
    const rightRef = canonicalRef(right.clinicalRef);
    return leftRef < rightRef ? -1 : leftRef > rightRef ? 1 : 0;
  });
}

function fingerprintMaterial(set: Omit<PharmaceuticalEvaluationTargetSetV2, 'fingerprint'>): string {
  return JSON.stringify(set);
}

export function calculatePharmaceuticalEvaluationTargetIdV2(
  caseVersionId: string,
  aspect: PharmaceuticalEvaluationTargetAspectV2,
  ref: PharmaceuticalEvaluationClinicalRefV2,
): PharmaceuticalEvaluationTargetId {
  return targetId(caseVersionId, aspect, ref);
}

export function calculatePharmaceuticalEvaluationTargetSetFingerprintV2(
  set: Omit<PharmaceuticalEvaluationTargetSetV2, 'fingerprint'>,
): PharmaceuticalEvaluationTargetSetV2['fingerprint'] {
  return { algorithm: 'sha256', canonicalization: CANONICALIZATION, value: createHash('sha256').update(fingerprintMaterial(set)).digest('hex') };
}

export function buildPharmaceuticalEvaluationTargetSetV2(
  input: unknown,
): PharmaceuticalEvaluationTargetSetV2 {
  const reference = validatePharmaceuticalClinicalReferenceV2(input);
  const core: Omit<PharmaceuticalEvaluationTargetSetV2, 'fingerprint'> = {
    schemaVersion: '2.0',
    contractVersion: CONTRACT_VERSION,
    caseVersionId: reference.caseVersionId,
    clinicalReference: {
      schemaVersion: '2.0',
      evaluatorSchema: { ...reference.versions.evaluatorSchema },
      protocol: { ...reference.versions.protocol },
    },
    targets: buildTargets(reference),
  };
  return { ...core, fingerprint: calculatePharmaceuticalEvaluationTargetSetFingerprintV2(core) };
}
