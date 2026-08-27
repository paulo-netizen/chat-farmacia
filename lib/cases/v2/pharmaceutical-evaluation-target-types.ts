import type {
  ConclusionId,
  ReportEssentialContentId,
  TaxonomyTermRef,
  VersionRef,
} from './evaluator-types';
import type { MedicationId, CaseVersionId } from './types';

declare const pharmaceuticalEvaluationTargetIdBrand: unique symbol;

export type PharmaceuticalEvaluationTargetId = string & {
  readonly [pharmaceuticalEvaluationTargetIdBrand]: true;
};

export type PharmaceuticalEvaluationTargetCategoryV2 =
  | 'IDENTIFICATION'
  | 'INTERPRETATION'
  | 'DECISION'
  | 'ACTION';

export type PharmaceuticalEvaluationTargetAspectV2 =
  | 'PRM_STATUS'
  | 'PRM_EXISTENCE'
  | 'PRM_CLASSIFICATION'
  | 'PRM_MEDICATION_SCOPE'
  | 'RNM_STATUS'
  | 'RNM_CLASSIFICATION'
  | 'RNM_MEDICATION_SCOPE'
  | 'PRM_RNM_RELATION'
  | 'ADHERENCE_STATUS'
  | 'ADHERENCE_TYPE'
  | 'ADHERENCE_MEDICATION_SCOPE'
  | 'BARRIER_EXISTENCE'
  | 'BARRIER_CATEGORY'
  | 'BARRIER_ROLE'
  | 'BARRIER_CLASSIFICATION'
  | 'STRATEGY_CATEGORY'
  | 'STRATEGY_ADDRESSED_REFS'
  | 'PROFESSIONAL_ACTION_CATEGORY'
  | 'PROFESSIONAL_ACTION_CLASSIFICATION'
  | 'PROFESSIONAL_ACTION_SPFA_REF'
  | 'PROFESSIONAL_ACTION_TARGET_SPFA_REF'
  | 'PROFESSIONAL_ACTION_REFERRAL_REF'
  | 'INTERVENTION_TARGET'
  | 'INTERVENTION_CLASSIFICATION'
  | 'INTERVENTION_ADDRESSED_REFS'
  | 'INTERVENTION_ACTION_REF'
  | 'INTERVENTION_REFERRAL_REF'
  | 'REFERRAL_NEED'
  | 'REFERRAL_URGENCY'
  | 'REFERRAL_DESTINATION'
  | 'REFERRAL_REASON'
  | 'REPORT_STATUS'
  | 'REPORT_CONTENT';

export type PharmaceuticalEvaluationClinicalRefV2 =
  | Readonly<{ kind: 'CONCLUSION'; conclusionRef: ConclusionId }>
  | Readonly<{ kind: 'RELATION'; relationRef: ConclusionId }>
  | Readonly<{
      kind: 'REPORT_CONTENT';
      referralRef: ConclusionId;
      reportContentRef: ReportEssentialContentId;
    }>;

export type PharmaceuticalEvaluationExpectedValueV2 =
  | Readonly<{ kind: 'ENUM'; value: string }>
  | Readonly<{ kind: 'BOOLEAN'; value: boolean }>
  | Readonly<{ kind: 'TEXT'; value: string }>
  | Readonly<{ kind: 'TAXONOMY_TERM'; value: Readonly<TaxonomyTermRef> }>
  | Readonly<{ kind: 'MEDICATION_SCOPE'; medicationRefs: readonly MedicationId[] }>
  | Readonly<{ kind: 'CONCLUSION_REFS'; conclusionRefs: readonly ConclusionId[] }>
  | Readonly<{
      kind: 'PRM_RNM_RELATION';
      prmRef: ConclusionId;
      rnmAssessmentRef: ConclusionId;
      relation: 'creates_risk_of_rnm' | 'contributes_to_rnm';
    }>
  | Readonly<{
      kind: 'REFERRAL_DESTINATION';
      label: string;
      classification?: Readonly<TaxonomyTermRef>;
    }>
  | Readonly<{
      kind: 'REPORT_CONTENT';
      contentId: ReportEssentialContentId;
      content: string;
    }>;

export type PharmaceuticalEvaluationTargetV2 = Readonly<{
  targetId: PharmaceuticalEvaluationTargetId;
  category: PharmaceuticalEvaluationTargetCategoryV2;
  aspect: PharmaceuticalEvaluationTargetAspectV2;
  clinicalRef: PharmaceuticalEvaluationClinicalRefV2;
  expectedValue: PharmaceuticalEvaluationExpectedValueV2;
}>;

export type PharmaceuticalEvaluationTargetSetFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'pharmaceutical-evaluation-target-set-v2/1';
  value: string;
}>;

export type PharmaceuticalEvaluationTargetSetV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-evaluation-target-set/1';
  caseVersionId: CaseVersionId;
  clinicalReference: Readonly<{
    schemaVersion: '2.0';
    evaluatorSchema: Readonly<VersionRef>;
    protocol: Readonly<VersionRef>;
  }>;
  targets: readonly PharmaceuticalEvaluationTargetV2[];
  fingerprint: PharmaceuticalEvaluationTargetSetFingerprintV1;
}>;
