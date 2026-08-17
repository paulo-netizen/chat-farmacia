import type {
  GenerationMode,
  TeachingBriefId,
} from './teaching-brief-types';
import type { CaseVersionId } from './types';

export type ComplianceCheckStatus =
  | 'pass'
  | 'fail'
  | 'unresolved'
  | 'not_applicable';

export type ComplianceOverallStatus =
  | 'compliant'
  | 'non_compliant'
  | 'review_required';

export type ComplianceDimension =
  | 'carePath'
  | 'incidence'
  | 'prm'
  | 'rnm'
  | 'adherence'
  | 'adherenceStrategies'
  | 'professionalActions'
  | 'pharmaceuticalInterventions'
  | 'referral'
  | 'complexity'
  | 'teacherInstruction';

export type ComplianceCheckCode =
  | 'initial_spfa_service'
  | 'initial_spfa_subtype'
  | 'additional_spfa_presence'
  | 'additional_spfa_subtype'
  | 'additional_spfa_requires_review'
  | 'transitions_exact_set'
  | 'transitions_allowed_set'
  | 'transitions_maximum'
  | 'transitions_require_review'
  | 'incidence_status'
  | 'incidence_allowed_status'
  | 'incidence_semantic_meaning'
  | 'incidence_semantic_focus_requires_review'
  | 'incidence_optional_content_requires_review'
  | 'prm_status'
  | 'prm_cardinality'
  | 'prm_fixed_classifications'
  | 'prm_allowed_classifications'
  | 'prm_additional_findings'
  | 'prm_semantic_intent_requires_review'
  | 'prm_semantic_focus_requires_review'
  | 'prm_optional_content_requires_review'
  | 'rnm_status'
  | 'rnm_allowed_outcomes'
  | 'rnm_cardinality'
  | 'rnm_fixed_classifications'
  | 'rnm_allowed_classifications'
  | 'rnm_additional_findings'
  | 'rnm_semantic_intent_requires_review'
  | 'rnm_optional_content_requires_review'
  | 'adherence_assessments_presence'
  | 'adherence_maximum_assessments'
  | 'adherence_fixed_scope_set'
  | 'adherence_allowed_scopes'
  | 'adherence_scope_resolution'
  | 'adherence_status_by_scope'
  | 'adherence_type_status'
  | 'adherence_type_value'
  | 'adherence_type_constraints'
  | 'adherence_profile'
  | 'adherence_profile_requires_review'
  | 'adherence_barrier_state'
  | 'adherence_primary_barrier'
  | 'adherence_secondary_barriers'
  | 'adherence_additional_barriers'
  | 'adherence_barrier_constraints'
  | 'adherence_barrier_semantics_require_review'
  | 'adherence_optional_content_requires_review'
  | 'strategies_presence'
  | 'strategies_exact_multiset'
  | 'strategies_allowed_categories'
  | 'strategies_maximum'
  | 'strategy_scope_resolution'
  | 'strategy_all_non_adherent_scopes'
  | 'strategy_addressed_barriers'
  | 'strategy_semantic_problems_require_review'
  | 'strategies_optional_content_requires_review'
  | 'actions_presence'
  | 'actions_exact_multiset'
  | 'actions_allowed_categories'
  | 'actions_maximum'
  | 'action_referral_involvement'
  | 'actions_optional_content_requires_review'
  | 'interventions_presence'
  | 'interventions_exact_multiset'
  | 'interventions_allowed_targets'
  | 'interventions_maximum'
  | 'intervention_addressed_problems_require_review'
  | 'interventions_optional_content_requires_review'
  | 'referral_status'
  | 'referral_allowed_status'
  | 'referral_urgency'
  | 'referral_allowed_urgency'
  | 'referral_destination_classification'
  | 'referral_destination_label'
  | 'referral_allowed_destination'
  | 'referral_reason'
  | 'referral_report_status'
  | 'referral_report_contents'
  | 'referral_optional_content_requires_review'
  | 'complexity_requires_review'
  | 'teacher_instruction_requires_review'
  | 'teacher_instruction_absent';

export type ComplianceCheckV2 = Readonly<{
  code: ComplianceCheckCode;
  path: string;
  status: ComplianceCheckStatus;
}>;

export type DimensionComplianceV2 = Readonly<{
  dimension: ComplianceDimension;
  status: ComplianceCheckStatus;
  checks: readonly ComplianceCheckV2[];
}>;

export type ComplianceCountsV2 = Readonly<{
  passed: number;
  failed: number;
  unresolved: number;
  notApplicable: number;
}>;

export type BriefComplianceReportV2 = Readonly<{
  schemaVersion: '2.0';
  caseVersionId: CaseVersionId;
  briefId: TeachingBriefId;
  briefRevision: number;
  generationMode: GenerationMode;
  overallStatus: ComplianceOverallStatus;
  hasHardFailures: boolean;
  requiresReview: boolean;
  counts: ComplianceCountsV2;
  dimensions: readonly DimensionComplianceV2[];
}>;
