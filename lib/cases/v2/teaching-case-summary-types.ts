import type {
  AdherenceBarrierCategory,
  AdherencePatientProfile,
  AdherenceStatus,
  BaseAdherenceStrategyCategory,
  DispensingSubtype,
  NonAdherenceType,
  NonEmptyArray,
  PharmaceuticalInterventionTarget,
  ProfessionalActionCategory,
  ReferralUrgency,
  SpfaService,
  TaxonomyTermRef,
} from './evaluator-types';
import type { CaseVersionId, MedicationId } from './types';

export type SummaryKnownValue<T> =
  | {
      state: 'known';
      value: T;
      certainty: 'exact' | 'approximate' | 'uncertain';
    }
  | {
      state: 'explicit_absence';
      topic: string;
    }
  | {
      state: 'patient_unknown';
      topic: string;
    };

export type SummaryMedicationRef = {
  medicationId: MedicationId;
  displayLabel: SummaryKnownValue<string>;
};

export type MedicationScopeSummary = {
  medications: readonly SummaryMedicationRef[];
};

export type NonEmptyMedicationScopeSummary = {
  medications: NonEmptyArray<SummaryMedicationRef>;
};

export type SpfaSummary =
  | {
      service: 'dispensing';
      subtype: DispensingSubtype;
    }
  | {
      service: Exclude<SpfaService, 'dispensing'>;
    };

export type CarePathSummary = {
  initialSpfa: SpfaSummary;
  additionalSpfas: readonly SpfaSummary[];
  transitions: readonly {
    from: SpfaSummary;
    to: SpfaSummary;
  }[];
};

export type IncidenceFindingSummary = {
  spfa: SpfaSummary;
  medicationScope: MedicationScopeSummary;
  semanticMeaning: string;
};

export type IncidenceSummary =
  | {
      status: 'none' | 'not_determinable';
      count: 0;
      findings: readonly [];
    }
  | {
      status: 'present';
      count: number;
      findings: NonEmptyArray<IncidenceFindingSummary>;
    };

export type PrmFindingSummary = {
  classification: TaxonomyTermRef;
  medicationScope: MedicationScopeSummary;
};

export type PrmSummary =
  | {
      status: 'none' | 'not_determinable';
      count: 0;
      findings: readonly [];
    }
  | {
      status: 'present';
      count: number;
      findings: NonEmptyArray<PrmFindingSummary>;
    };

export type RnmFindingSummary = {
  outcome: 'rnm' | 'risk_of_rnm';
  classification?: TaxonomyTermRef;
  medicationScope: MedicationScopeSummary;
};

export type RnmSummary =
  | {
      status: 'no_rnm';
      rnmCount: 0;
      riskOfRnmCount: 0;
      findings: readonly [];
    }
  | {
      status: 'rnm' | 'risk_of_rnm' | 'rnm_and_risk_of_rnm';
      rnmCount: number;
      riskOfRnmCount: number;
      findings: NonEmptyArray<RnmFindingSummary>;
    };

export type AdherenceTypeSummary =
  | {
      status: 'determined';
      type: NonAdherenceType;
    }
  | {
      status: 'not_determinable';
    };

export type AdherenceProfileSummary =
  | { status: 'absent' }
  | {
      status: 'determined';
      profile: AdherencePatientProfile;
    }
  | {
      status: 'not_determinable';
    };

export type BarrierSummary = {
  role: 'primary' | 'secondary';
  category: AdherenceBarrierCategory;
  classification?: TaxonomyTermRef;
};

export type BarrierSetSummary =
  | {
      status: 'identified';
      primary: BarrierSummary;
      secondary: readonly BarrierSummary[];
    }
  | {
      status: 'not_determinable';
    };

export type AdherenceAssessmentSummary =
  | {
      medicationScope: NonEmptyMedicationScopeSummary;
      status: Exclude<AdherenceStatus, 'non_adherent'>;
    }
  | {
      medicationScope: NonEmptyMedicationScopeSummary;
      status: 'non_adherent';
      nonAdherence: {
        type: AdherenceTypeSummary;
        patientProfile: AdherenceProfileSummary;
        barriers: BarrierSetSummary;
      };
    };

export type AdherenceStrategySummary =
  | {
      medicationScope: NonEmptyMedicationScopeSummary;
      category: BaseAdherenceStrategyCategory;
      addressedBarriers: readonly BarrierSummary[];
    }
  | {
      medicationScope: NonEmptyMedicationScopeSummary;
      category: 'combined';
      componentCategories: NonEmptyArray<BaseAdherenceStrategyCategory>;
      addressedBarriers: readonly BarrierSummary[];
    };

export type ProfessionalActionSummary = {
  spfa: SpfaSummary;
  category: ProfessionalActionCategory;
  classification?: TaxonomyTermRef;
  targetSpfa?: SpfaSummary;
  referralInvolvement: boolean;
};

export type AddressedConclusionSummary =
  | {
      kind: 'incidence';
      semanticMeaning: string;
      medicationScope: MedicationScopeSummary;
    }
  | {
      kind: 'prm';
      classification: TaxonomyTermRef;
      medicationScope: MedicationScopeSummary;
    }
  | {
      kind: 'rnm_assessment';
      outcome: 'rnm' | 'risk_of_rnm';
      classification?: TaxonomyTermRef;
      medicationScope: MedicationScopeSummary;
    }
  | {
      kind: 'adherence_assessment';
      status: AdherenceStatus;
      medicationScope: NonEmptyMedicationScopeSummary;
    }
  | {
      kind: 'non_adherence_type';
      medicationScope: NonEmptyMedicationScopeSummary;
      type: AdherenceTypeSummary;
    }
  | {
      kind: 'adherence_barrier';
      medicationScope: NonEmptyMedicationScopeSummary;
      barrier: BarrierSummary;
    };

export type PharmaceuticalInterventionSummary = {
  spfa: SpfaSummary;
  target: PharmaceuticalInterventionTarget;
  classification?: TaxonomyTermRef;
  addressedConclusions: NonEmptyArray<AddressedConclusionSummary>;
  relatedProfessionalActionCategory?: ProfessionalActionCategory;
  directReferralInvolvement: boolean;
};

export type SummaryReportRequirement =
  | {
      status: 'not_required';
      essentialContents: readonly [];
    }
  | {
      status: 'appropriate' | 'required';
      essentialContents: NonEmptyArray<string>;
    };

export type ReferralSummary =
  | {
      status: 'not_required';
    }
  | {
      status: 'required';
      urgency: ReferralUrgency;
      destination: {
        label: string;
        classification?: TaxonomyTermRef;
      };
      reason: string;
      report: SummaryReportRequirement;
    };

export type ObjectiveCaseMetrics = {
  numberOfMedications: number;
  numberOfSpfas: number;
  numberOfIncidences: number;
  numberOfPrms: number;
  numberOfRnms: number;
  numberOfRnmRisks: number;
  numberOfAdherenceScopes: number;
  numberOfBarriers: number;
};

export type TeachingCaseSummaryV2 = {
  readonly schemaVersion: '2.0';
  readonly caseVersionId: CaseVersionId;
  readonly medications: readonly SummaryMedicationRef[];
  readonly carePath: CarePathSummary;
  readonly incidence: IncidenceSummary;
  readonly prm: PrmSummary;
  readonly rnm: RnmSummary;
  readonly adherence: {
    assessments: readonly AdherenceAssessmentSummary[];
    strategies: readonly AdherenceStrategySummary[];
  };
  readonly professionalActions: readonly ProfessionalActionSummary[];
  readonly pharmaceuticalInterventions:
    readonly PharmaceuticalInterventionSummary[];
  readonly referral: ReferralSummary;
  readonly objectiveMetrics: ObjectiveCaseMetrics;
};
