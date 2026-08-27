import { createHash } from 'node:crypto';

import type {
  AdherenceAssessment,
  AdherenceBarrier,
  AdherenceBarrierAssessment,
  AdherenceStrategy,
  ConclusionId,
  NonAdherenceTypeConclusion,
  PharmaceuticalIntervention,
  PrmFinding,
  PrmRnmRelation,
  ProfessionalAction,
  ReferralConclusion,
  RnmAssessment,
  VersionRef,
} from './evaluator-types';
import type { PharmaceuticalClinicalReferenceV2 } from './pharmaceutical-clinical-reference-types';
import type {
  PharmaceuticalAcquisitionCandidateContextV2,
  PharmaceuticalAdjudicationContextFingerprintV1,
  PharmaceuticalAdjudicationContextSetV2,
  PharmaceuticalAdjudicationRelevantVersionV2,
  PharmaceuticalExpectationGroupIdV2,
  PharmaceuticalExpectationMembershipV2,
  PharmaceuticalMedicationIdentityV2,
  PharmaceuticalPrmFindingContextV2,
  PharmaceuticalRnmAssessmentContextV2,
  PharmaceuticalStudentCandidateContextV2,
  PharmaceuticalTargetAdjudicationContextV2,
  PharmaceuticalTargetClinicalContextV2,
} from './pharmaceutical-adjudication-context-types';
import type { PharmaceuticalEvaluationExpectationSetV2 } from './pharmaceutical-evaluation-expectation-types';
import type {
  PharmaceuticalEvaluationTargetId,
  PharmaceuticalEvaluationTargetSetV2,
  PharmaceuticalEvaluationTargetV2,
} from './pharmaceutical-evaluation-target-types';
import type {
  PharmaceuticalPatientEvidenceKindV2,
  PharmaceuticalSessionEvidenceCandidateSetV2,
  PharmaceuticalStudentEvidenceKindV2,
} from './pharmaceutical-session-evidence-types';
import type { SessionTranscriptSnapshotV2 } from './spfa-session-evidence-types';
import type { MedicationId, PatientRuntimeViewV2 } from './types';
import { validatePharmaceuticalClinicalReferenceV2 } from './validate-pharmaceutical-clinical-reference';
import { validatePharmaceuticalEvaluationExpectationSetV2 } from './validate-pharmaceutical-evaluation-expectations';
import { validatePharmaceuticalEvaluationTargetSetV2 } from './validate-pharmaceutical-evaluation-target-set';
import { validatePharmaceuticalSessionEvidenceCandidateSetV2 } from './validate-pharmaceutical-session-evidence';
import { validateCaseVersionId } from './validate-patient-facts';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';

const CONTRACT_VERSION = 'pharmaceutical-adjudication-context/1' as const;
const CANONICALIZATION = 'pharmaceutical-adjudication-context-v2/1' as const;
const MEDICATION_ID_PATTERN =
  /^med_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const STUDENT_KIND_ORDER: readonly PharmaceuticalStudentEvidenceKindV2[] = [
  'STUDENT_QUESTION',
  'STUDENT_INTERPRETATION',
  'STUDENT_DECISION',
  'STUDENT_ACTION',
];
const PATIENT_KIND_ORDER: readonly PharmaceuticalPatientEvidenceKindV2[] = [
  'PATIENT_STATEMENT',
  'PATIENT_CONFIRMATION',
];

export type BuildPharmaceuticalAdjudicationContextInputV2 = Readonly<{
  patientRuntime: PatientRuntimeViewV2;
  clinicalReference: PharmaceuticalClinicalReferenceV2;
  targetSet: PharmaceuticalEvaluationTargetSetV2;
  expectationSet: PharmaceuticalEvaluationExpectationSetV2;
  transcript: SessionTranscriptSnapshotV2;
  candidateSet: PharmaceuticalSessionEvidenceCandidateSetV2;
}>;

export class PharmaceuticalAdjudicationContextBuildError extends Error {
  constructor(
    public readonly path: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalAdjudicationContextBuildError';
  }
}

type ReferenceIndex = Readonly<{
  prmFindings: ReadonlyMap<string, PrmFinding>;
  rnmAssessments: ReadonlyMap<string, RnmAssessment>;
  relations: ReadonlyMap<string, PrmRnmRelation>;
  adherenceAssessments: ReadonlyMap<string, AdherenceAssessment>;
  adherenceTypes: ReadonlyMap<string, NonAdherenceTypeConclusion>;
  barrierAssessments: ReadonlyMap<string, AdherenceBarrierAssessment>;
  barriers: ReadonlyMap<string, AdherenceBarrier>;
  strategies: ReadonlyMap<string, AdherenceStrategy>;
  actions: ReadonlyMap<string, ProfessionalAction>;
  interventions: ReadonlyMap<string, PharmaceuticalIntervention>;
  referral: ReferralConclusion;
}>;

function fail(path: string, message: string, cause?: unknown): never {
  throw new PharmaceuticalAdjudicationContextBuildError(path, message, cause);
}

function ordinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function cloneFingerprint<T extends Readonly<{
  algorithm: 'sha256';
  canonicalization: string;
  value: string;
}>>(value: T): T {
  return { ...value };
}

function cloneVersion(reference: VersionRef): Readonly<VersionRef> {
  return { id: reference.id, version: reference.version };
}

function exactCaseVersion(value: unknown, path: string): string {
  try {
    return validateCaseVersionId(value, path);
  } catch (cause) {
    fail(path, 'must be a canonical case version ID', cause);
  }
}

function medicationIndex(
  runtime: PatientRuntimeViewV2,
): ReadonlyMap<MedicationId, PharmaceuticalMedicationIdentityV2> {
  if (runtime.schemaVersion !== '2.0') {
    fail('patientRuntime.schemaVersion', 'must be 2.0');
  }
  exactCaseVersion(runtime.caseVersionId, 'patientRuntime.caseVersionId');
  const pharmacotherapy = runtime.pharmacotherapy;
  if (typeof pharmacotherapy !== 'object' || pharmacotherapy === null) {
    fail('patientRuntime.pharmacotherapy', 'must be an object');
  }
  const collections = [
    ['prescribedMedications', pharmacotherapy.prescribedMedications],
    ['otherMedicinesAndProducts', pharmacotherapy.otherMedicinesAndProducts],
  ] as const;
  const result = new Map<MedicationId, PharmaceuticalMedicationIdentityV2>();
  for (const [collectionName, collection] of collections) {
    if (!Array.isArray(collection)) {
      fail(`patientRuntime.pharmacotherapy.${collectionName}`, 'must be an array');
    }
    collection.forEach((medication, index) => {
      const path = `patientRuntime.pharmacotherapy.${collectionName}[${index}]`;
      if (
        typeof medication.medicationId !== 'string' ||
        !MEDICATION_ID_PATTERN.test(medication.medicationId)
      ) {
        fail(`${path}.medicationId`, 'must be a canonical MedicationId');
      }
      if (result.has(medication.medicationId)) {
        fail(`${path}.medicationId`, 'duplicate MedicationId');
      }
      const displayName = medication.displayName;
      if (
        typeof displayName !== 'object' ||
        displayName === null ||
        displayName.state !== 'known' ||
        typeof displayName.value !== 'string' ||
        displayName.value.trim().length === 0
      ) {
        fail(`${path}.displayName`, 'must be a known non-empty string');
      }
      result.set(medication.medicationId, {
        medicationId: medication.medicationId,
        displayName: displayName.value,
      });
    });
  }
  return result;
}

function validateInputs(input: BuildPharmaceuticalAdjudicationContextInputV2) {
  let clinicalReference: PharmaceuticalClinicalReferenceV2;
  try {
    clinicalReference = validatePharmaceuticalClinicalReferenceV2(
      input.clinicalReference,
    );
  } catch (cause) {
    fail('clinicalReference', 'validation failed', cause);
  }
  let targetSet: PharmaceuticalEvaluationTargetSetV2;
  try {
    targetSet = validatePharmaceuticalEvaluationTargetSetV2(
      input.targetSet,
      clinicalReference,
    );
  } catch (cause) {
    fail('targetSet', 'validation failed', cause);
  }
  let expectationSet: PharmaceuticalEvaluationExpectationSetV2;
  try {
    expectationSet = validatePharmaceuticalEvaluationExpectationSetV2(
      input.expectationSet,
      targetSet,
    );
  } catch (cause) {
    fail('expectationSet', 'validation failed', cause);
  }
  let transcript: SessionTranscriptSnapshotV2;
  try {
    transcript = validateSessionTranscriptSnapshotV2(input.transcript);
  } catch (cause) {
    fail('transcript', 'validation failed', cause);
  }
  let candidateSet: PharmaceuticalSessionEvidenceCandidateSetV2;
  try {
    candidateSet = validatePharmaceuticalSessionEvidenceCandidateSetV2(
      input.candidateSet,
      transcript,
      targetSet,
    );
  } catch (cause) {
    fail('candidateSet', 'validation failed', cause);
  }
  const medications = medicationIndex(input.patientRuntime);
  const caseVersionId = clinicalReference.caseVersionId;
  const identities: readonly [unknown, string][] = [
    [input.patientRuntime.caseVersionId, 'patientRuntime.caseVersionId'],
    [targetSet.caseVersionId, 'targetSet.caseVersionId'],
    [expectationSet.caseVersionId, 'expectationSet.caseVersionId'],
    [transcript.caseVersionId, 'transcript.caseVersionId'],
    [candidateSet.caseVersionId, 'candidateSet.caseVersionId'],
  ];
  for (const [value, path] of identities) {
    if (value !== caseVersionId) fail(path, 'does not match clinical reference');
  }
  if (candidateSet.sessionId !== transcript.sessionId) {
    fail('candidateSet.sessionId', 'does not match transcript');
  }
  return {
    clinicalReference,
    targetSet,
    expectationSet,
    transcript,
    candidateSet,
    medications,
  };
}

function referenceIndex(reference: PharmaceuticalClinicalReferenceV2): ReferenceIndex {
  const adherence = reference.clinicalConclusions.adherence;
  return {
    prmFindings: new Map(reference.clinicalConclusions.prm.findings.map((item) => [String(item.conclusionId), item as unknown as PrmFinding])),
    rnmAssessments: new Map(reference.clinicalConclusions.rnmAssessments.map((item) => [String(item.conclusionId), item as unknown as RnmAssessment])),
    relations: new Map(reference.structuralContext.prmRnmRelations.map((item) => [String(item.conclusionId), item as unknown as PrmRnmRelation])),
    adherenceAssessments: new Map(adherence.assessments.map((item) => [String(item.conclusionId), item as unknown as AdherenceAssessment])),
    adherenceTypes: new Map(adherence.typeConclusions.map((item) => [String(item.conclusionId), item as unknown as NonAdherenceTypeConclusion])),
    barrierAssessments: new Map(adherence.barrierAssessments.map((item) => [String(item.conclusionId), item as unknown as AdherenceBarrierAssessment])),
    barriers: new Map(adherence.barriers.map((item) => [String(item.conclusionId), item as unknown as AdherenceBarrier])),
    strategies: new Map(adherence.strategies.map((item) => [String(item.conclusionId), item as unknown as AdherenceStrategy])),
    actions: new Map(reference.clinicalConclusions.professionalActions.map((item) => [String(item.conclusionId), item as unknown as ProfessionalAction])),
    interventions: new Map(reference.clinicalConclusions.pharmaceuticalInterventions.map((item) => [String(item.conclusionId), item as unknown as PharmaceuticalIntervention])),
    referral: reference.clinicalConclusions.referral as unknown as ReferralConclusion,
  };
}

function conclusionRef(target: PharmaceuticalEvaluationTargetV2): string {
  if (target.clinicalRef.kind !== 'CONCLUSION') {
    fail(`targetSet.targets.${target.targetId}.clinicalRef`, 'must reference a conclusion');
  }
  return target.clinicalRef.conclusionRef;
}

function sortedMedicationRefs(values: readonly unknown[]): MedicationId[] {
  return [...new Set(values.map((value) => value as MedicationId))].sort(ordinal);
}

function sortedConclusionRefs(values: readonly unknown[]): ConclusionId[] {
  return [...new Set(values.map((value) => value as ConclusionId))].sort(ordinal);
}

function prmContext(finding: PrmFinding): PharmaceuticalPrmFindingContextV2 {
  return {
    findingRef: finding.conclusionId,
    classification: { ...finding.value.classification },
    medicationRefs: sortedMedicationRefs(finding.value.medicationRefs),
  };
}

function rnmContext(assessment: RnmAssessment): PharmaceuticalRnmAssessmentContextV2 {
  if (assessment.value.status === 'no_rnm') {
    return {
      assessmentRef: assessment.conclusionId,
      status: assessment.value.status,
      medicationRefs: [],
    };
  }
  return {
    assessmentRef: assessment.conclusionId,
    status: assessment.value.status,
    ...(assessment.value.classification === undefined
      ? {}
      : { classification: { ...assessment.value.classification } }),
    medicationRefs: sortedMedicationRefs(assessment.value.medicationRefs),
  };
}

function adherenceContext(assessment: AdherenceAssessment) {
  return {
    assessmentRef: assessment.conclusionId,
    status: assessment.value.status,
    medicationRefs: sortedMedicationRefs(assessment.value.medicationRefs),
  };
}

function required<Item>(
  map: ReadonlyMap<string, Item>,
  reference: string,
  path: string,
): Item {
  const value = map.get(reference);
  if (value === undefined) fail(path, `unknown clinical reference: ${reference}`);
  return value;
}

function clinicalContextForTarget(
  target: PharmaceuticalEvaluationTargetV2,
  reference: PharmaceuticalClinicalReferenceV2,
  index: ReferenceIndex,
): PharmaceuticalTargetClinicalContextV2 {
  const prmAssessment = reference.clinicalConclusions.prm.assessment;
  if (target.aspect === 'PRM_STATUS') {
    return { domain: 'PRM', assessmentStatus: prmAssessment.value.status };
  }
  if (target.aspect.startsWith('PRM_') && target.aspect !== 'PRM_RNM_RELATION') {
    const finding = required(index.prmFindings, conclusionRef(target), 'target.clinicalRef');
    return {
      domain: 'PRM',
      assessmentStatus: prmAssessment.value.status,
      finding: prmContext(finding),
    };
  }
  if (target.aspect.startsWith('RNM_')) {
    const assessment = required(index.rnmAssessments, conclusionRef(target), 'target.clinicalRef');
    return { domain: 'RNM', assessment: rnmContext(assessment) };
  }
  if (target.aspect === 'PRM_RNM_RELATION') {
    if (target.clinicalRef.kind !== 'RELATION') fail('target.clinicalRef', 'must reference a relation');
    const relation = required(index.relations, target.clinicalRef.relationRef, 'target.clinicalRef');
    const prm = required(index.prmFindings, relation.value.prmRef, 'relation.prmRef');
    const rnm = required(index.rnmAssessments, relation.value.rnmAssessmentRef, 'relation.rnmAssessmentRef');
    return {
      domain: 'PRM_RNM_RELATION',
      relationRef: relation.conclusionId,
      relation: relation.value.relation,
      prm: prmContext(prm),
      rnm: rnmContext(rnm),
    };
  }
  if (target.aspect === 'ADHERENCE_STATUS' || target.aspect === 'ADHERENCE_MEDICATION_SCOPE') {
    const assessment = required(index.adherenceAssessments, conclusionRef(target), 'target.clinicalRef');
    return { domain: 'ADHERENCE', assessment: adherenceContext(assessment) };
  }
  if (target.aspect === 'ADHERENCE_TYPE') {
    const type = required(index.adherenceTypes, conclusionRef(target), 'target.clinicalRef');
    const assessment = required(index.adherenceAssessments, type.value.adherenceAssessmentRef, 'type.adherenceAssessmentRef');
    return {
      domain: 'ADHERENCE',
      assessment: adherenceContext(assessment),
      typeConclusion: type.value.status === 'determined'
        ? {
            conclusionRef: type.conclusionId,
            status: type.value.status,
            type: type.value.type,
          }
        : { conclusionRef: type.conclusionId, status: type.value.status },
    };
  }
  if (target.aspect === 'BARRIER_EXISTENCE') {
    const assessment = required(index.barrierAssessments, conclusionRef(target), 'target.clinicalRef');
    const adherence = required(index.adherenceAssessments, assessment.value.adherenceAssessmentRef, 'barrierAssessment.adherenceAssessmentRef');
    return {
      domain: 'BARRIER',
      adherenceAssessment: adherenceContext(adherence),
      barrierAssessment: {
        assessmentRef: assessment.conclusionId,
        status: assessment.value.status,
      },
    };
  }
  if (target.aspect.startsWith('BARRIER_')) {
    const barrier = required(index.barriers, conclusionRef(target), 'target.clinicalRef');
    const assessment = required(index.barrierAssessments, barrier.value.barrierAssessmentRef, 'barrier.barrierAssessmentRef');
    const adherence = required(index.adherenceAssessments, assessment.value.adherenceAssessmentRef, 'barrierAssessment.adherenceAssessmentRef');
    return {
      domain: 'BARRIER',
      adherenceAssessment: adherenceContext(adherence),
      barrierAssessment: {
        assessmentRef: assessment.conclusionId,
        status: assessment.value.status,
      },
      barrier: {
        barrierRef: barrier.conclusionId,
        role: barrier.value.role,
        category: barrier.value.category,
        ...(barrier.value.classification === undefined
          ? {}
          : { classification: { ...barrier.value.classification } }),
      },
    };
  }
  if (target.aspect.startsWith('STRATEGY_')) {
    const strategy = required(index.strategies, conclusionRef(target), 'target.clinicalRef');
    const adherence = required(index.adherenceAssessments, strategy.value.adherenceAssessmentRef, 'strategy.adherenceAssessmentRef');
    return {
      domain: 'STRATEGY',
      adherenceAssessment: adherenceContext(adherence),
      strategy: {
        strategyRef: strategy.conclusionId,
        category: strategy.value.category,
        ...(
          strategy.value.category === 'combined'
            ? { componentCategories: [...strategy.value.componentCategories].sort(ordinal) }
            : {}
        ),
        addressedBarrierRefs: sortedConclusionRefs(strategy.value.addressedBarrierRefs),
      },
    };
  }
  if (target.aspect.startsWith('PROFESSIONAL_ACTION_')) {
    const action = required(index.actions, conclusionRef(target), 'target.clinicalRef');
    return {
      domain: 'PROFESSIONAL_ACTION',
      action: {
        actionRef: action.conclusionId,
        category: action.value.category,
        ...(action.value.classification === undefined ? {} : { classification: { ...action.value.classification } }),
        spfaRef: action.value.spfaRef,
        ...(action.value.targetSpfaRef === undefined ? {} : { targetSpfaRef: action.value.targetSpfaRef }),
        ...(action.value.referralRef === undefined ? {} : { referralRef: action.value.referralRef }),
      },
    };
  }
  if (target.aspect.startsWith('INTERVENTION_')) {
    const intervention = required(index.interventions, conclusionRef(target), 'target.clinicalRef');
    return {
      domain: 'PHARMACEUTICAL_INTERVENTION',
      intervention: {
        interventionRef: intervention.conclusionId,
        target: intervention.value.target,
        ...(intervention.value.classification === undefined ? {} : { classification: { ...intervention.value.classification } }),
        spfaRef: intervention.value.spfaRef,
        addressedConclusionRefs: sortedConclusionRefs(intervention.value.addressedConclusionRefs),
        ...(intervention.value.professionalActionRef === undefined ? {} : { professionalActionRef: intervention.value.professionalActionRef }),
        ...(intervention.value.referralRef === undefined ? {} : { referralRef: intervention.value.referralRef }),
      },
    };
  }
  const referral = index.referral;
  if (target.aspect.startsWith('REFERRAL_')) {
    const field = target.aspect === 'REFERRAL_NEED'
      ? 'NEED'
      : target.aspect === 'REFERRAL_URGENCY'
        ? 'URGENCY'
        : target.aspect === 'REFERRAL_DESTINATION'
          ? 'DESTINATION'
          : 'REASON';
    if (referral.value.status === 'not_required') {
      return { domain: 'REFERRAL', referralRef: referral.conclusionId, status: referral.value.status, field };
    }
    return {
      domain: 'REFERRAL',
      referralRef: referral.conclusionId,
      status: referral.value.status,
      field,
      ...(field === 'URGENCY' ? { urgency: referral.value.urgency } : {}),
      ...(field === 'DESTINATION'
        ? {
            destination: {
              label: referral.value.destination.label,
              ...(referral.value.destination.classification === undefined
                ? {}
                : { classification: { ...referral.value.destination.classification } }),
            },
          }
        : {}),
      ...(field === 'REASON' ? { reason: referral.value.reason } : {}),
    };
  }
  if (referral.value.status !== 'required') fail('target.clinicalRef', 'report target requires referral');
  if (target.aspect === 'REPORT_STATUS') {
    return {
      domain: 'REPORT',
      referralRef: referral.conclusionId,
      field: 'STATUS',
      status: referral.value.report.status,
    };
  }
  if (target.aspect === 'REPORT_CONTENT') {
    if (
      target.clinicalRef.kind !== 'REPORT_CONTENT' ||
      !('contractVersion' in referral.value.report) ||
      referral.value.report.status === 'not_required'
    ) {
      fail('target.clinicalRef', 'must reference identified report content');
    }
    const reportContentRef = target.clinicalRef.reportContentRef;
    const content = referral.value.report.essentialContents.find(
      (item) => item.contentId === reportContentRef,
    );
    if (content === undefined) fail('target.clinicalRef.reportContentRef', 'unknown report content');
    return {
      domain: 'REPORT',
      referralRef: referral.conclusionId,
      field: 'CONTENT',
      status: referral.value.report.status,
      content: {
        contentId: content.contentId,
        untrustedExpectedContent: content.content,
      },
    };
  }
  return fail('target.aspect', `unsupported aspect: ${target.aspect}`);
}

function refsFromConclusion(
  conclusionReference: string,
  index: ReferenceIndex,
  visited = new Set<string>(),
): MedicationId[] {
  if (visited.has(conclusionReference)) return [];
  visited.add(conclusionReference);
  const prm = index.prmFindings.get(conclusionReference);
  if (prm !== undefined) return [...prm.value.medicationRefs];
  const rnm = index.rnmAssessments.get(conclusionReference);
  if (rnm !== undefined) return rnm.value.status === 'no_rnm' ? [] : [...rnm.value.medicationRefs];
  const adherence = index.adherenceAssessments.get(conclusionReference);
  if (adherence !== undefined) return [...adherence.value.medicationRefs];
  const type = index.adherenceTypes.get(conclusionReference);
  if (type !== undefined) return refsFromConclusion(type.value.adherenceAssessmentRef, index, visited);
  const barrierAssessment = index.barrierAssessments.get(conclusionReference);
  if (barrierAssessment !== undefined) return refsFromConclusion(barrierAssessment.value.adherenceAssessmentRef, index, visited);
  const barrier = index.barriers.get(conclusionReference);
  if (barrier !== undefined) return refsFromConclusion(barrier.value.barrierAssessmentRef, index, visited);
  const strategy = index.strategies.get(conclusionReference);
  if (strategy !== undefined) return refsFromConclusion(strategy.value.adherenceAssessmentRef, index, visited);
  const relation = index.relations.get(conclusionReference);
  if (relation !== undefined) {
    return [
      ...refsFromConclusion(relation.value.prmRef, index, visited),
      ...refsFromConclusion(relation.value.rnmAssessmentRef, index, visited),
    ];
  }
  const intervention = index.interventions.get(conclusionReference);
  if (intervention !== undefined) {
    return intervention.value.addressedConclusionRefs.flatMap((reference) =>
      refsFromConclusion(reference, index, visited),
    );
  }
  return [];
}

function medicationRefsForPacket(
  context: PharmaceuticalTargetClinicalContextV2,
  index: ReferenceIndex,
): MedicationId[] {
  if (context.domain === 'PRM') return context.finding?.medicationRefs.slice() ?? [];
  if (context.domain === 'RNM') return [...context.assessment.medicationRefs];
  if (context.domain === 'PRM_RNM_RELATION') {
    return sortedMedicationRefs([...context.prm.medicationRefs, ...context.rnm.medicationRefs]);
  }
  if (context.domain === 'ADHERENCE') return [...context.assessment.medicationRefs];
  if (context.domain === 'BARRIER') return [...context.adherenceAssessment.medicationRefs];
  if (context.domain === 'STRATEGY') return [...context.adherenceAssessment.medicationRefs];
  if (context.domain === 'PHARMACEUTICAL_INTERVENTION') {
    return sortedMedicationRefs(
      context.intervention.addressedConclusionRefs.flatMap((reference) =>
        refsFromConclusion(reference, index),
      ),
    );
  }
  return [];
}

function identitiesForRefs(
  references: readonly MedicationId[],
  medications: ReadonlyMap<MedicationId, PharmaceuticalMedicationIdentityV2>,
  path: string,
): PharmaceuticalMedicationIdentityV2[] {
  return sortedMedicationRefs(references).map((reference, index) => {
    const medication = medications.get(reference);
    if (medication === undefined) {
      fail(`${path}[${index}]`, `unknown MedicationId: ${reference}`);
    }
    return { medicationId: medication.medicationId, displayName: medication.displayName };
  });
}

function validateAllMedicationReferences(
  reference: PharmaceuticalClinicalReferenceV2,
  medications: ReadonlyMap<MedicationId, PharmaceuticalMedicationIdentityV2>,
): void {
  const groups: ReadonlyArray<readonly [readonly unknown[], string]> = [
    ...reference.clinicalConclusions.incidence.findings.map((item, index) => [item.value.medicationRefs, `clinicalReference.clinicalConclusions.incidence.findings[${index}].value.medicationRefs`] as const),
    ...reference.clinicalConclusions.prm.findings.map((item, index) => [item.value.medicationRefs, `clinicalReference.clinicalConclusions.prm.findings[${index}].value.medicationRefs`] as const),
    ...reference.clinicalConclusions.rnmAssessments.flatMap((item, index) => item.value.status === 'no_rnm' ? [] : [[item.value.medicationRefs, `clinicalReference.clinicalConclusions.rnmAssessments[${index}].value.medicationRefs`] as const]),
    ...reference.clinicalConclusions.adherence.assessments.map((item, index) => [item.value.medicationRefs, `clinicalReference.clinicalConclusions.adherence.assessments[${index}].value.medicationRefs`] as const),
  ];
  for (const [references, path] of groups) {
    references.forEach((rawReferenceId, index) => {
      const referenceId = rawReferenceId as MedicationId;
      if (!medications.has(referenceId)) {
        fail(`${path}[${index}]`, `unknown MedicationId: ${referenceId}`);
      }
    });
  }
}

function relevantVersions(
  target: PharmaceuticalEvaluationTargetV2,
  reference: PharmaceuticalClinicalReferenceV2,
): PharmaceuticalAdjudicationRelevantVersionV2[] {
  const versions = reference.versions;
  const result: PharmaceuticalAdjudicationRelevantVersionV2[] = [
    { role: 'EVALUATOR_SCHEMA', reference: cloneVersion(versions.evaluatorSchema) },
    { role: 'PROTOCOL', reference: cloneVersion(versions.protocol) },
  ];
  const add = (
    role: PharmaceuticalAdjudicationRelevantVersionV2['role'],
    value: VersionRef | undefined,
  ) => {
    if (value !== undefined) result.push({ role, reference: cloneVersion(value) });
  };
  if (target.aspect.startsWith('PRM_') && target.aspect !== 'PRM_RNM_RELATION') {
    add('PRM_TAXONOMY', versions.prmTaxonomy);
  }
  if (target.aspect.startsWith('RNM_')) add('RNM_TAXONOMY', versions.rnmTaxonomy);
  if (target.aspect === 'PRM_RNM_RELATION') {
    add('PRM_TAXONOMY', versions.prmTaxonomy);
    add('RNM_TAXONOMY', versions.rnmTaxonomy);
  }
  if (
    target.aspect.startsWith('ADHERENCE_') ||
    target.aspect.startsWith('BARRIER_') ||
    target.aspect.startsWith('STRATEGY_')
  ) {
    add('ADHERENCE_FRAMEWORK', versions.adherenceFramework);
  }
  if (target.aspect.startsWith('BARRIER_')) add('BARRIER_TAXONOMY', versions.barrierTaxonomy);
  if (target.aspect.startsWith('PROFESSIONAL_ACTION_')) add('PROFESSIONAL_ACTION_TAXONOMY', versions.professionalActionTaxonomy);
  if (target.aspect.startsWith('INTERVENTION_')) add('PHARMACEUTICAL_INTERVENTION_TAXONOMY', versions.pharmaceuticalInterventionTaxonomy);
  if (target.aspect === 'REFERRAL_DESTINATION') add('REFERRAL_DESTINATION_TAXONOMY', versions.referralDestinationTaxonomy);
  return result;
}

function groupRef(
  expectationSet: PharmaceuticalEvaluationExpectationSetV2,
  operator: 'ALL_OF' | 'ONE_OF',
  members: readonly PharmaceuticalEvaluationTargetId[],
): PharmaceuticalExpectationGroupIdV2 {
  const material = JSON.stringify([
    expectationSet.contractVersion,
    expectationSet.caseVersionId,
    expectationSet.targetSetFingerprint.value,
    operator,
    members,
  ]);
  return `pharm_expectation_group_${createHash('sha256').update(material).digest('hex')}` as PharmaceuticalExpectationGroupIdV2;
}

function membershipsForTarget(
  targetRef: PharmaceuticalEvaluationTargetId,
  expectationSet: PharmaceuticalEvaluationExpectationSetV2,
): PharmaceuticalExpectationMembershipV2[] {
  return expectationSet.groups.flatMap((group) => {
    if (!group.memberTargetRefs.includes(targetRef)) return [];
    const memberTargetRefs = [...group.memberTargetRefs];
    return [{
      groupRef: groupRef(expectationSet, group.operator, memberTargetRefs),
      operator: group.operator,
      memberTargetRefs,
    }];
  });
}

function groupedCandidates(
  targetRef: PharmaceuticalEvaluationTargetId,
  transcript: SessionTranscriptSnapshotV2,
  candidateSet: PharmaceuticalSessionEvidenceCandidateSetV2,
): Readonly<{
  studentCandidates: PharmaceuticalStudentCandidateContextV2[];
  acquisitionContext: PharmaceuticalAcquisitionCandidateContextV2[];
}> {
  const byMessage = new Map<string, Set<string>>();
  for (const candidate of candidateSet.candidates) {
    if (candidate.targetRef !== targetRef) continue;
    const kinds = byMessage.get(candidate.messageRef) ?? new Set<string>();
    kinds.add(candidate.evidenceKind);
    byMessage.set(candidate.messageRef, kinds);
  }
  const studentCandidates: PharmaceuticalStudentCandidateContextV2[] = [];
  const acquisitionContext: PharmaceuticalAcquisitionCandidateContextV2[] = [];
  for (const message of transcript.messages) {
    const kinds = byMessage.get(message.messageId);
    if (kinds === undefined) continue;
    if (message.role === 'student') {
      studentCandidates.push({
        messageRef: message.messageId,
        candidateEvidenceKinds: STUDENT_KIND_ORDER.filter((kind) => kinds.has(kind)),
        untrustedContent: message.content,
      });
    } else {
      acquisitionContext.push({
        messageRef: message.messageId,
        candidateEvidenceKinds: PATIENT_KIND_ORDER.filter((kind) => kinds.has(kind)),
        untrustedContent: message.content,
      });
    }
  }
  return { studentCandidates, acquisitionContext };
}

function buildCore(
  input: BuildPharmaceuticalAdjudicationContextInputV2,
): Omit<PharmaceuticalAdjudicationContextSetV2, 'fingerprint'> {
  const validated = validateInputs(input);
  validateAllMedicationReferences(validated.clinicalReference, validated.medications);
  const index = referenceIndex(validated.clinicalReference);
  const targets = validated.targetSet.targets.map((target): PharmaceuticalTargetAdjudicationContextV2 => {
    const clinicalContext = clinicalContextForTarget(target, validated.clinicalReference, index);
    const medicationIdentities = identitiesForRefs(
      medicationRefsForPacket(clinicalContext, index),
      validated.medications,
      `targets.${target.targetId}.medicationIdentities`,
    );
    const grouped = groupedCandidates(target.targetId, validated.transcript, validated.candidateSet);
    return {
      targetRef: target.targetId,
      category: target.category,
      aspect: target.aspect,
      expected: structuredClone(target.expectedValue),
      clinicalContext,
      medicationIdentities,
      relevantVersions: relevantVersions(target, validated.clinicalReference),
      expectationMemberships: membershipsForTarget(target.targetId, validated.expectationSet),
      structuralState: {
        status: grouped.studentCandidates.length === 0
          ? 'NO_STUDENT_CANDIDATES'
          : 'HAS_STUDENT_CANDIDATES',
        studentCandidateCount: grouped.studentCandidates.length,
        acquisitionContextCount: grouped.acquisitionContext.length,
      },
      studentCandidates: grouped.studentCandidates,
      acquisitionContext: grouped.acquisitionContext,
    };
  });
  return {
    schemaVersion: '2.0',
    contractVersion: CONTRACT_VERSION,
    sessionId: validated.transcript.sessionId,
    caseVersionId: validated.clinicalReference.caseVersionId,
    transcriptFingerprint: cloneFingerprint(validated.transcript.fingerprint),
    targetSetFingerprint: cloneFingerprint(validated.targetSet.fingerprint),
    targets,
  };
}

export function calculatePharmaceuticalAdjudicationContextFingerprintV2(
  value: Omit<PharmaceuticalAdjudicationContextSetV2, 'fingerprint'>,
): PharmaceuticalAdjudicationContextFingerprintV1 {
  return {
    algorithm: 'sha256',
    canonicalization: CANONICALIZATION,
    value: createHash('sha256').update(JSON.stringify(value)).digest('hex'),
  };
}

export function buildPharmaceuticalAdjudicationContextSetV2(
  input: BuildPharmaceuticalAdjudicationContextInputV2,
): PharmaceuticalAdjudicationContextSetV2 {
  const core = buildCore(input);
  return {
    ...core,
    fingerprint: calculatePharmaceuticalAdjudicationContextFingerprintV2(core),
  };
}
