import type {
  AdherenceBarrierCategory,
  AdherencePatientProfile,
  AdherenceStatus,
  AdherenceStrategyCategory,
  BaseAdherenceStrategyCategory,
  DispensingSubtype,
  NonAdherenceType,
  NonEmptyArray,
  PharmaceuticalInterventionTarget,
  ProfessionalActionCategory,
  ReferralUrgency,
  ReportRequirement,
  SpfaService,
  TaxonomyTermRef,
} from './evaluator-types';

declare const teachingBriefIdBrand: unique symbol;

export type TeachingBriefId = string & {
  readonly [teachingBriefIdBrand]: true;
};

export type GenerationMode = 'strict' | 'flexible';
export type CaseComplexity = 'low' | 'medium' | 'high';

export type TeachingDecision<T, C = never> =
  | { mode: 'teacher_fixed'; value: T }
  | { mode: 'ai_proposes'; constraints?: C };

export type TeachingDimensionPlan<T, C = never> =
  | {
      targeting: 'targeted';
      decision: TeachingDecision<T, C>;
    }
  | {
      targeting: 'not_targeted';
      policy: 'allowed_if_clinically_coherent';
    }
  | {
      targeting: 'not_targeted';
      policy: 'forbidden';
    };

export type TargetedTeachingDimensionPlan<T, C = never> = Extract<
  TeachingDimensionPlan<T, C>,
  { targeting: 'targeted' }
>;

export type NonForbiddenTeachingDimensionPlan<T, C = never> = Exclude<
  TeachingDimensionPlan<T, C>,
  { targeting: 'not_targeted'; policy: 'forbidden' }
>;

export type AllowedValues<T> = {
  allowedValues: NonEmptyArray<T>;
};

export type CardinalityConstraint =
  | { kind: 'exactly'; count: number }
  | { kind: 'at_least'; min: number; max?: number }
  | { kind: 'between'; min: number; max: number };

export type FixedSpfaIntent =
  | {
      service: 'dispensing';
      dispensingSubtype: TeachingDecision<
        DispensingSubtype,
        AllowedValues<DispensingSubtype>
      >;
    }
  | {
      service: 'pharmaceutical_indication' | 'medication_adherence';
    };

export type InitialSpfaProposalConstraints = {
  allowedServices?: NonEmptyArray<SpfaService>;
  allowedDispensingSubtypes?: NonEmptyArray<DispensingSubtype>;
};

export type AdditionalSpfaPlan =
  | {
      service: 'dispensing';
      inclusion: TeachingDimensionPlan<{
        dispensingSubtype: TeachingDecision<
          DispensingSubtype,
          AllowedValues<DispensingSubtype>
        >;
      }>;
    }
  | {
      service: 'pharmaceutical_indication' | 'medication_adherence';
      inclusion: TeachingDimensionPlan<{ include: true }>;
    };

export type SpfaTransitionIntent = {
  from: SpfaService;
  to: SpfaService;
};

export type SpfaTransitionConstraints = {
  allowedTransitions?: NonEmptyArray<SpfaTransitionIntent>;
  maximumTransitions?: number;
};

export type TeachingCarePathPlanV2 = {
  initialSpfa: TargetedTeachingDimensionPlan<
    FixedSpfaIntent,
    InitialSpfaProposalConstraints
  >;
  additionalSpfas: AdditionalSpfaPlan[];
  transitions: TeachingDimensionPlan<
    readonly SpfaTransitionIntent[],
    SpfaTransitionConstraints
  >;
};

export type IncidenceIntent =
  | { status: 'none' }
  | { status: 'present'; semanticMeaning: string };

export type IncidenceProposalConstraints = {
  allowedStatuses?: NonEmptyArray<'none' | 'present'>;
  semanticFocus?: string;
};

export type AdditionalFindingsPolicy =
  | 'forbidden'
  | 'allowed_if_clinically_coherent';

export type PrmFindingIntent = {
  classification?: TaxonomyTermRef;
  semanticIntent?: string;
};

export type PrmIntent =
  | { status: 'none' }
  | {
      status: 'present';
      quantity: CardinalityConstraint;
      fixedFindings: readonly PrmFindingIntent[];
      additionalFindings: AdditionalFindingsPolicy;
    };

export type PrmProposalConstraints = {
  allowedStatuses?: NonEmptyArray<'none' | 'present'>;
  quantity?: CardinalityConstraint;
  allowedClassifications?: NonEmptyArray<TaxonomyTermRef>;
  semanticFocus?: string;
};

export type RnmFindingIntent = {
  outcome: 'rnm' | 'risk_of_rnm';
  classification?: TaxonomyTermRef;
  semanticIntent?: string;
};

export type RnmIntent =
  | { status: 'no_rnm' }
  | {
      status: 'findings';
      quantity: CardinalityConstraint;
      fixedFindings: readonly RnmFindingIntent[];
      additionalFindings: AdditionalFindingsPolicy;
    };

export type RnmProposalConstraints = {
  allowedStatuses?: NonEmptyArray<'no_rnm' | 'rnm' | 'risk_of_rnm'>;
  quantity?: CardinalityConstraint;
  allowedClassifications?: NonEmptyArray<TaxonomyTermRef>;
};

export type MedicationScopeIntent =
  | { kind: 'all_relevant_medications' }
  | {
      kind: 'semantic_targets';
      descriptions: NonEmptyArray<string>;
    };

export type AdherenceBarrierIntent = {
  role: 'primary' | 'secondary';
  category: AdherenceBarrierCategory;
  classification?: TaxonomyTermRef;
  semanticIntent?: string;
};

export type AdherenceBarrierSetIntent = {
  barriers: NonEmptyArray<AdherenceBarrierIntent>;
  additionalBarriers: AdditionalFindingsPolicy;
};

export type AdherenceBarrierProposalConstraints = {
  allowedCategories?: NonEmptyArray<AdherenceBarrierCategory>;
  requiredPrimaryCategory?: AdherenceBarrierCategory;
  maximumSecondaryBarriers?: number;
};

export type NonAdherenceTypeIntent =
  | {
      status: 'determined';
      type: NonAdherenceType;
    }
  | {
      status: 'not_determinable';
    };

export type NonAdherenceTypeProposalConstraints = {
  allowedStatuses?: NonEmptyArray<'determined' | 'not_determinable'>;
  allowedTypes?: NonEmptyArray<NonAdherenceType>;
};

export type AdherencePatientProfileIntent =
  | {
      status: 'determined';
      profile: AdherencePatientProfile;
    }
  | {
      status: 'not_determinable';
    };

export type AdherencePatientProfileProposalConstraints = {
  allowedStatuses?: NonEmptyArray<'determined' | 'not_determinable'>;
  allowedProfiles?: NonEmptyArray<AdherencePatientProfile>;
};

export type NonAdherenceDetailsPlan = {
  type: NonForbiddenTeachingDimensionPlan<
    NonAdherenceTypeIntent,
    NonAdherenceTypeProposalConstraints
  >;
  patientProfile: TeachingDimensionPlan<
    AdherencePatientProfileIntent,
    AdherencePatientProfileProposalConstraints
  >;
  barriers: TeachingDimensionPlan<
    AdherenceBarrierSetIntent,
    AdherenceBarrierProposalConstraints
  >;
};

export type AdherenceAssessmentIntent = {
  medicationScope: MedicationScopeIntent;
  status: AdherenceStatus;
  nonAdherence?: NonAdherenceDetailsPlan;
};

export type AdherenceCaseIntent = {
  assessments: NonEmptyArray<AdherenceAssessmentIntent>;
};

export type AdherenceProposalConstraints = {
  allowedStatuses?: NonEmptyArray<AdherenceStatus>;
  maximumAssessments?: number;
  allowedMedicationScopes?: NonEmptyArray<MedicationScopeIntent>;
  whenNonAdherent?: NonAdherenceDetailsPlan;
};

export type AdherenceStrategyApplication =
  | 'all_non_adherent_scopes'
  | { medicationScope: MedicationScopeIntent };

export type AdherenceStrategyAddresses =
  | 'primary_barrier'
  | 'all_identified_barriers'
  | { semanticProblems: NonEmptyArray<string> };

export type AdherenceStrategyIntent =
  | {
      category: BaseAdherenceStrategyCategory;
      appliesTo: AdherenceStrategyApplication;
      addresses: AdherenceStrategyAddresses;
    }
  | {
      category: 'combined';
      componentCategories: NonEmptyArray<BaseAdherenceStrategyCategory>;
      appliesTo: AdherenceStrategyApplication;
      addresses: AdherenceStrategyAddresses;
    };

export type AdherenceStrategyProposalConstraints = {
  allowedCategories?: NonEmptyArray<AdherenceStrategyCategory>;
  maximumStrategies?: number;
};

type SimpleProfessionalActionCategory = Exclude<
  ProfessionalActionCategory,
  'referral' | 'other_spfa'
>;

export type ProfessionalActionIntent =
  | {
      spfa: SpfaService;
      category: SimpleProfessionalActionCategory;
      classification?: TaxonomyTermRef;
    }
  | {
      spfa: SpfaService;
      category: 'referral';
      classification?: TaxonomyTermRef;
    }
  | {
      spfa: SpfaService;
      category: 'other_spfa';
      targetSpfa: SpfaService;
      classification?: TaxonomyTermRef;
    };

export type ProfessionalActionProposalConstraints = {
  allowedCategories?: NonEmptyArray<ProfessionalActionCategory>;
  maximumActions?: number;
};

export type PharmaceuticalInterventionIntent = {
  spfa: SpfaService;
  target: PharmaceuticalInterventionTarget;
  classification?: TaxonomyTermRef;
  addressedProblems: NonEmptyArray<string>;
  relatedActionCategory?: ProfessionalActionCategory;
};

export type PharmaceuticalInterventionProposalConstraints = {
  allowedTargets?: NonEmptyArray<PharmaceuticalInterventionTarget>;
  maximumInterventions?: number;
};

export type ReferralIntent =
  | { status: 'not_required' }
  | {
      status: 'required';
      destination: {
        label: string;
        classification?: TaxonomyTermRef;
      };
      urgency: ReferralUrgency;
      reason: string;
      patientInstruction: string;
      report: ReportRequirement;
    };

export type ReferralProposalConstraints = {
  allowedStatuses?: NonEmptyArray<'not_required' | 'required'>;
  allowedUrgencies?: NonEmptyArray<ReferralUrgency>;
  allowedDestinations?: NonEmptyArray<{
    label: string;
    classification?: TaxonomyTermRef;
  }>;
};

export type TeachingCaseGenerationBriefV2 = {
  readonly schemaVersion: '2.0';
  readonly briefId: TeachingBriefId;
  readonly revision: {
    readonly number: number;
    readonly previousBriefId?: TeachingBriefId;
  };
  readonly generationMode: GenerationMode;
  readonly complexity: CaseComplexity;
  readonly carePath: TeachingCarePathPlanV2;
  readonly incidence: TeachingDimensionPlan<
    IncidenceIntent,
    IncidenceProposalConstraints
  >;
  readonly prm: TeachingDimensionPlan<PrmIntent, PrmProposalConstraints>;
  readonly rnm: TeachingDimensionPlan<RnmIntent, RnmProposalConstraints>;
  readonly adherence: TeachingDimensionPlan<
    AdherenceCaseIntent,
    AdherenceProposalConstraints
  >;
  readonly adherenceStrategies: TeachingDimensionPlan<
    NonEmptyArray<AdherenceStrategyIntent>,
    AdherenceStrategyProposalConstraints
  >;
  readonly professionalActions: TeachingDimensionPlan<
    NonEmptyArray<ProfessionalActionIntent>,
    ProfessionalActionProposalConstraints
  >;
  readonly pharmaceuticalInterventions: TeachingDimensionPlan<
    NonEmptyArray<PharmaceuticalInterventionIntent>,
    PharmaceuticalInterventionProposalConstraints
  >;
  readonly referral: TeachingDimensionPlan<
    ReferralIntent,
    ReferralProposalConstraints
  >;
  readonly teacherInstruction?: string;
};
