import type {
  AdherenceBarrierCategory,
  AdherenceStatus,
  AssessmentStatus,
  BaseAdherenceStrategyCategory,
  ConclusionId,
  NonAdherenceType,
  PharmaceuticalInterventionTarget,
  ProfessionalActionCategory,
  ReferralDestination,
  ReferralUrgency,
  TaxonomyTermRef,
  VersionRef,
} from './evaluator-types';
import type {
  PharmaceuticalEvaluationExpectedValueV2,
  PharmaceuticalEvaluationTargetAspectV2,
  PharmaceuticalEvaluationTargetCategoryV2,
  PharmaceuticalEvaluationTargetId,
  PharmaceuticalEvaluationTargetSetFingerprintV1,
} from './pharmaceutical-evaluation-target-types';
import type {
  PharmaceuticalPatientEvidenceKindV2,
  PharmaceuticalStudentEvidenceKindV2,
} from './pharmaceutical-session-evidence-types';
import type {
  SessionMessageId,
  SessionTranscriptFingerprintV1,
} from './spfa-session-evidence-types';
import type { CaseVersionId, MedicationId } from './types';

declare const pharmaceuticalExpectationGroupIdBrand: unique symbol;

export type PharmaceuticalExpectationGroupIdV2 = string & {
  readonly [pharmaceuticalExpectationGroupIdBrand]: true;
};

export type PharmaceuticalMedicationIdentityV2 = Readonly<{
  medicationId: MedicationId;
  displayName: string;
}>;

export type PharmaceuticalAdjudicationVersionRoleV2 =
  | 'EVALUATOR_SCHEMA'
  | 'PROTOCOL'
  | 'PRM_TAXONOMY'
  | 'RNM_TAXONOMY'
  | 'ADHERENCE_FRAMEWORK'
  | 'BARRIER_TAXONOMY'
  | 'PROFESSIONAL_ACTION_TAXONOMY'
  | 'PHARMACEUTICAL_INTERVENTION_TAXONOMY'
  | 'REFERRAL_DESTINATION_TAXONOMY';

export type PharmaceuticalAdjudicationRelevantVersionV2 = Readonly<{
  role: PharmaceuticalAdjudicationVersionRoleV2;
  reference: Readonly<VersionRef>;
}>;

export type PharmaceuticalExpectationMembershipV2 = Readonly<{
  groupRef: PharmaceuticalExpectationGroupIdV2;
  operator: 'ALL_OF' | 'ONE_OF';
  memberTargetRefs: readonly PharmaceuticalEvaluationTargetId[];
}>;

export type PharmaceuticalStudentCandidateContextV2 = Readonly<{
  messageRef: SessionMessageId;
  candidateEvidenceKinds: readonly PharmaceuticalStudentEvidenceKindV2[];
  untrustedContent: string;
}>;

export type PharmaceuticalAcquisitionCandidateContextV2 = Readonly<{
  messageRef: SessionMessageId;
  candidateEvidenceKinds: readonly PharmaceuticalPatientEvidenceKindV2[];
  untrustedContent: string;
}>;

export type PharmaceuticalAdjudicationStructuralStateV2 = Readonly<{
  status: 'HAS_STUDENT_CANDIDATES' | 'NO_STUDENT_CANDIDATES';
  studentCandidateCount: number;
  acquisitionContextCount: number;
}>;

export type PharmaceuticalAdherenceAssessmentContextV2 = Readonly<{
  assessmentRef: ConclusionId;
  status: AdherenceStatus;
  medicationRefs: readonly MedicationId[];
}>;

export type PharmaceuticalPrmFindingContextV2 = Readonly<{
  findingRef: ConclusionId;
  classification: Readonly<TaxonomyTermRef>;
  medicationRefs: readonly MedicationId[];
}>;

export type PharmaceuticalRnmAssessmentContextV2 = Readonly<{
  assessmentRef: ConclusionId;
  status: 'rnm' | 'risk_of_rnm' | 'no_rnm';
  classification?: Readonly<TaxonomyTermRef>;
  medicationRefs: readonly MedicationId[];
}>;

export type PharmaceuticalTargetClinicalContextV2 =
  | Readonly<{
      domain: 'PRM';
      assessmentStatus: AssessmentStatus;
      finding?: PharmaceuticalPrmFindingContextV2;
    }>
  | Readonly<{
      domain: 'RNM';
      assessment: PharmaceuticalRnmAssessmentContextV2;
    }>
  | Readonly<{
      domain: 'PRM_RNM_RELATION';
      relationRef: ConclusionId;
      relation: 'creates_risk_of_rnm' | 'contributes_to_rnm';
      prm: PharmaceuticalPrmFindingContextV2;
      rnm: PharmaceuticalRnmAssessmentContextV2;
    }>
  | Readonly<{
      domain: 'ADHERENCE';
      assessment: PharmaceuticalAdherenceAssessmentContextV2;
      typeConclusion?: Readonly<{
        conclusionRef: ConclusionId;
        status: 'determined' | 'not_determinable';
        type?: NonAdherenceType;
      }>;
    }>
  | Readonly<{
      domain: 'BARRIER';
      adherenceAssessment: PharmaceuticalAdherenceAssessmentContextV2;
      barrierAssessment: Readonly<{
        assessmentRef: ConclusionId;
        status: 'identified' | 'not_determinable';
      }>;
      barrier?: Readonly<{
        barrierRef: ConclusionId;
        role: 'primary' | 'secondary';
        category: AdherenceBarrierCategory;
        classification?: Readonly<TaxonomyTermRef>;
      }>;
    }>
  | Readonly<{
      domain: 'STRATEGY';
      adherenceAssessment: PharmaceuticalAdherenceAssessmentContextV2;
      strategy: Readonly<{
        strategyRef: ConclusionId;
        category: BaseAdherenceStrategyCategory | 'combined';
        componentCategories?: readonly BaseAdherenceStrategyCategory[];
        addressedBarrierRefs: readonly ConclusionId[];
      }>;
    }>
  | Readonly<{
      domain: 'PROFESSIONAL_ACTION';
      action: Readonly<{
        actionRef: ConclusionId;
        category: ProfessionalActionCategory;
        classification?: Readonly<TaxonomyTermRef>;
        spfaRef: ConclusionId;
        targetSpfaRef?: ConclusionId;
        referralRef?: ConclusionId;
      }>;
    }>
  | Readonly<{
      domain: 'PHARMACEUTICAL_INTERVENTION';
      intervention: Readonly<{
        interventionRef: ConclusionId;
        target: PharmaceuticalInterventionTarget;
        classification?: Readonly<TaxonomyTermRef>;
        spfaRef: ConclusionId;
        addressedConclusionRefs: readonly ConclusionId[];
        professionalActionRef?: ConclusionId;
        referralRef?: ConclusionId;
      }>;
    }>
  | Readonly<{
      domain: 'REFERRAL';
      referralRef: ConclusionId;
      status: 'not_required' | 'required';
      field: 'NEED' | 'URGENCY' | 'DESTINATION' | 'REASON';
      urgency?: ReferralUrgency;
      destination?: Readonly<ReferralDestination>;
      reason?: string;
    }>
  | Readonly<{
      domain: 'REPORT';
      referralRef: ConclusionId;
      field: 'STATUS' | 'CONTENT';
      status: 'not_required' | 'appropriate' | 'required';
      content?: Readonly<{
        contentId: import('./evaluator-types').ReportEssentialContentId;
        untrustedExpectedContent: string;
      }>;
    }>;

export type PharmaceuticalTargetAdjudicationContextV2 = Readonly<{
  targetRef: PharmaceuticalEvaluationTargetId;
  category: PharmaceuticalEvaluationTargetCategoryV2;
  aspect: PharmaceuticalEvaluationTargetAspectV2;
  expected: PharmaceuticalEvaluationExpectedValueV2;
  clinicalContext: PharmaceuticalTargetClinicalContextV2;
  medicationIdentities: readonly PharmaceuticalMedicationIdentityV2[];
  relevantVersions: readonly PharmaceuticalAdjudicationRelevantVersionV2[];
  expectationMemberships: readonly PharmaceuticalExpectationMembershipV2[];
  structuralState: PharmaceuticalAdjudicationStructuralStateV2;
  studentCandidates: readonly PharmaceuticalStudentCandidateContextV2[];
  acquisitionContext: readonly PharmaceuticalAcquisitionCandidateContextV2[];
}>;

export type PharmaceuticalAdjudicationContextFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'pharmaceutical-adjudication-context-v2/1';
  value: string;
}>;

export type PharmaceuticalAdjudicationContextSetV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-adjudication-context/1';
  sessionId: string;
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV1;
  targetSetFingerprint: PharmaceuticalEvaluationTargetSetFingerprintV1;
  targets: readonly PharmaceuticalTargetAdjudicationContextV2[];
  fingerprint: PharmaceuticalAdjudicationContextFingerprintV1;
}>;
