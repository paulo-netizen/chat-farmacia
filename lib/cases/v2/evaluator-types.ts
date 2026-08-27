import type {
  CaseVersionId,
  FactId,
  MedicationId,
} from './types';

declare const conclusionIdBrand: unique symbol;
declare const reportEssentialContentIdBrand: unique symbol;

export type ConclusionId = string & {
  readonly [conclusionIdBrand]: true;
};

export type ReportEssentialContentId = string & {
  readonly [reportEssentialContentIdBrand]: true;
};

export type VersionRef = {
  id: string;
  version: string;
};

export type TaxonomyTermRef = {
  taxonomyId: string;
  taxonomyVersion: string;
  conceptId: string;
};

export type EvaluatorConclusion<K extends string, V> = {
  conclusionId: ConclusionId;
  kind: K;
  value: V;
};

export type SpfaService =
  | 'dispensing'
  | 'pharmaceutical_indication'
  | 'medication_adherence';

export type DispensingSubtype = 'initial_treatment' | 'continuation';

export type SpfaConclusion = EvaluatorConclusion<
  'spfa',
  {
    service: SpfaService;
    subtype?: DispensingSubtype;
  }
>;

export type SpfaTransition = EvaluatorConclusion<
  'spfa_transition',
  {
    fromSpfaRef: ConclusionId;
    toSpfaRef: ConclusionId;
  }
>;

export type CarePathV2 = {
  initialSpfa: SpfaConclusion;
  additionalSpfas: SpfaConclusion[];
  transitions: SpfaTransition[];
};

export type AssessmentStatus = 'none' | 'present' | 'not_determinable';

export type IncidenceAssessment = EvaluatorConclusion<
  'incidence_assessment',
  { status: AssessmentStatus }
>;

export type IncidenceFinding = EvaluatorConclusion<
  'incidence',
  {
    spfaRef: ConclusionId;
    medicationRefs: MedicationId[];
    semanticMeaning: string;
  }
>;

export type FollowUpEpisode = EvaluatorConclusion<
  'follow_up_episode',
  {
    incidenceRef: ConclusionId;
  }
>;

export type PrmAssessment = EvaluatorConclusion<
  'prm_assessment',
  { status: AssessmentStatus }
>;

export type PrmFinding = EvaluatorConclusion<
  'prm',
  {
    classification: TaxonomyTermRef;
    medicationRefs: MedicationId[];
    followUpEpisodeRef?: ConclusionId;
  }
>;

type RnmAssessmentLinks = {
  medicationRefs: MedicationId[];
  followUpEpisodeRef?: ConclusionId;
};

export type RnmAssessment = EvaluatorConclusion<
  'rnm_assessment',
  | ({
      status: 'rnm';
      classification: TaxonomyTermRef;
    } & RnmAssessmentLinks)
  | ({
      status: 'risk_of_rnm';
      classification?: TaxonomyTermRef;
    } & RnmAssessmentLinks)
  | {
      status: 'no_rnm';
    }
>;

export type PrmRnmRelation = EvaluatorConclusion<
  'prm_rnm_relation',
  {
    prmRef: ConclusionId;
    rnmAssessmentRef: ConclusionId;
    relation: 'creates_risk_of_rnm' | 'contributes_to_rnm';
  }
>;

export type AdherenceStatus =
  | 'adherent'
  | 'non_adherent'
  | 'not_determinable';

export type AdherenceAssessment = EvaluatorConclusion<
  'adherence_assessment',
  {
    medicationRefs: NonEmptyArray<MedicationId>;
    status: AdherenceStatus;
  }
>;

export type NonAdherenceType =
  | 'intentional'
  | 'unintentional'
  | 'erratic'
  | 'combined';

export type NonAdherenceTypeConclusion = EvaluatorConclusion<
  'non_adherence_type',
  | {
      adherenceAssessmentRef: ConclusionId;
      status: 'determined';
      type: NonAdherenceType;
    }
  | {
      adherenceAssessmentRef: ConclusionId;
      status: 'not_determinable';
    }
>;

export type AdherencePatientProfile =
  | 'distrustful'
  | 'trivializing'
  | 'confused';

export type AdherencePatientProfileConclusion = EvaluatorConclusion<
  'adherence_patient_profile',
  | {
      adherenceAssessmentRef: ConclusionId;
      status: 'determined';
      profile: AdherencePatientProfile;
    }
  | {
      adherenceAssessmentRef: ConclusionId;
      status: 'not_determinable';
    }
>;

export type AdherenceBarrierCategory = 'practical' | 'perception';

export type AdherenceBarrierAssessment = EvaluatorConclusion<
  'adherence_barrier_assessment',
  {
    adherenceAssessmentRef: ConclusionId;
    status: 'identified' | 'not_determinable';
  }
>;

export type AdherenceBarrier = EvaluatorConclusion<
  'adherence_barrier',
  {
    barrierAssessmentRef: ConclusionId;
    role: 'primary' | 'secondary';
    category: AdherenceBarrierCategory;
    classification?: TaxonomyTermRef;
  }
>;

export type AdherenceStrategyCategory =
  | 'technical'
  | 'behavioral'
  | 'educational'
  | 'social_family_support'
  | 'combined';

export type BaseAdherenceStrategyCategory = Exclude<
  AdherenceStrategyCategory,
  'combined'
>;

export type AdherenceStrategy = EvaluatorConclusion<
  'adherence_strategy',
  {
    adherenceAssessmentRef: ConclusionId;
    addressedBarrierRefs: ConclusionId[];
  } & (
    | {
        category: BaseAdherenceStrategyCategory;
      }
    | {
        category: 'combined';
        componentCategories: NonEmptyArray<BaseAdherenceStrategyCategory>;
      }
  )
>;

export type ProfessionalActionCategory =
  | 'dispense'
  | 'do_not_dispense'
  | 'pharmacological_treatment'
  | 'non_pharmacological_treatment'
  | 'hygienic_dietary_measures'
  | 'referral'
  | 'other_spfa';

export type ProfessionalAction = EvaluatorConclusion<
  'professional_action',
  {
    spfaRef: ConclusionId;
    category: ProfessionalActionCategory;
    classification?: TaxonomyTermRef;
    targetSpfaRef?: ConclusionId;
    referralRef?: ConclusionId;
  }
>;

export type PharmaceuticalInterventionTarget =
  | 'treatment'
  | 'patient_state_or_situation'
  | 'conditions_of_use';

export type PharmaceuticalIntervention = EvaluatorConclusion<
  'pharmaceutical_intervention',
  {
    spfaRef: ConclusionId;
    professionalActionRef?: ConclusionId;
    target: PharmaceuticalInterventionTarget;
    classification?: TaxonomyTermRef;
    addressedConclusionRefs: NonEmptyArray<ConclusionId>;
    referralRef?: ConclusionId;
  }
>;

export type ReferralStatus = 'not_required' | 'required';

export type ReferralUrgency = 'non_urgent' | 'urgent';

export type ReferralDestination = {
  label: string;
  classification?: TaxonomyTermRef;
};

export type ReportRequirement =
  | {
      status: 'not_required';
      essentialContents: readonly [];
    }
  | {
      status: 'appropriate' | 'required';
      essentialContents: NonEmptyArray<string>;
    };

export const IDENTIFIED_REPORT_REQUIREMENT_CONTRACT_VERSION =
  'identified-report-requirement/1' as const;

export type ReportEssentialContentV2 = Readonly<{
  contentId: ReportEssentialContentId;
  content: string;
}>;

export type IdentifiedReportRequirementV2 =
  | Readonly<{
      contractVersion: typeof IDENTIFIED_REPORT_REQUIREMENT_CONTRACT_VERSION;
      status: 'not_required';
      essentialContents: readonly [];
    }>
  | Readonly<{
      contractVersion: typeof IDENTIFIED_REPORT_REQUIREMENT_CONTRACT_VERSION;
      status: 'appropriate' | 'required';
      essentialContents: NonEmptyArray<ReportEssentialContentV2>;
    }>;

/**
 * Absence of contractVersion is the historical string[] contract. The
 * identified form is selected only by its explicit contract discriminator.
 */
export type VersionedReportRequirementV2 =
  | ReportRequirement
  | IdentifiedReportRequirementV2;

export function isIdentifiedReportRequirementV2(
  report: VersionedReportRequirementV2,
): report is IdentifiedReportRequirementV2 {
  return 'contractVersion' in report;
}

export function reportRequirementSemanticContentsV2(
  report: VersionedReportRequirementV2 | Readonly<{
    contractVersion?: typeof IDENTIFIED_REPORT_REQUIREMENT_CONTRACT_VERSION;
    status: 'not_required' | 'appropriate' | 'required';
    essentialContents: readonly (string | Readonly<{
      contentId: ReportEssentialContentId;
      content: string;
    }>)[];
  }>,
): readonly string[] {
  if ('contractVersion' in report) {
    const identifiedContents = report.essentialContents as readonly Readonly<{
      contentId: ReportEssentialContentId;
      content: string;
    }>[];
    return identifiedContents.map((item) => item.content);
  }
  return report.essentialContents as readonly string[];
}

export type ReferralConclusion = EvaluatorConclusion<
  'referral',
  | {
      status: 'not_required';
    }
  | {
      status: 'required';
      urgency: ReferralUrgency;
      destination: ReferralDestination;
      reason: string;
      report: VersionedReportRequirementV2;
    }
>;

export type NonEmptyArray<T> = readonly [T, ...T[]];

export type EvidenceLeafRef =
  | {
      operator: 'fact';
      factRef: FactId;
    }
  | {
      operator: 'public_profile';
      field: 'age' | 'sex';
    };

export type EvidenceExpression =
  | EvidenceLeafRef
  | {
      operator: 'all';
      operands: NonEmptyArray<EvidenceExpression>;
    }
  | {
      operator: 'any';
      operands: NonEmptyArray<EvidenceExpression>;
    };

export type EvidenceRule = {
  conclusionRef: ConclusionId;
  requiredEvidence: EvidenceExpression;
  supportingEvidenceRefs: readonly EvidenceLeafRef[];
  counterEvidenceRefs: readonly EvidenceLeafRef[];
  teacherRationale: string;
};

export type EvaluatorVersionsV2 = {
  evaluatorSchema: VersionRef;
  protocol: VersionRef;
  prmTaxonomy: VersionRef;
  rnmTaxonomy: VersionRef;
  adherenceFramework: VersionRef;
  barrierTaxonomy?: VersionRef;
  professionalActionTaxonomy?: VersionRef;
  pharmaceuticalInterventionTaxonomy?: VersionRef;
  referralDestinationTaxonomy?: VersionRef;
};

export type EvaluatorViewV2 = {
  schemaVersion: '2.0';
  caseVersionId: CaseVersionId;
  versions: EvaluatorVersionsV2;
  carePath: CarePathV2;
  incidence: {
    assessment: IncidenceAssessment;
    findings: IncidenceFinding[];
    followUpEpisodes: FollowUpEpisode[];
  };
  prm: {
    assessment: PrmAssessment;
    findings: PrmFinding[];
  };
  rnmAssessments: RnmAssessment[];
  prmRnmRelations: PrmRnmRelation[];
  adherence: {
    assessments: AdherenceAssessment[];
    typeConclusions: NonAdherenceTypeConclusion[];
    patientProfiles: AdherencePatientProfileConclusion[];
    barrierAssessments: AdherenceBarrierAssessment[];
    barriers: AdherenceBarrier[];
    strategies: AdherenceStrategy[];
  };
  professionalActions: ProfessionalAction[];
  pharmaceuticalInterventions: PharmaceuticalIntervention[];
  referral: ReferralConclusion;
  evidenceRules: EvidenceRule[];
};
