import type {
  AdherenceBarrierCategory,
  AdherencePatientProfile,
  AdherenceStatus,
  AssessmentStatus,
  BaseAdherenceStrategyCategory,
  DispensingSubtype,
  NonAdherenceType,
  NonEmptyArray,
  PharmaceuticalInterventionTarget,
  ProfessionalActionCategory,
  ReferralUrgency,
  SpfaService,
} from './evaluator-types';
import type {
  BiomedicalDatumValue,
  DisclosureDomain,
  EncounterPersonRole,
  MedicationOrigin,
  MedicationRegimenBasis,
  MedicationUseAction,
  PatientCommunicationProfile,
  StudentPublicView,
} from './types';

export const AI_GENERATION_CONTRACT_VERSION =
  'ai-generated-case-draft/1' as const;

/** Defensive parser limits, not final clinical limits. */
export const AI_GENERATION_LIMITS = Object.freeze({
  maxLocalKeyOrdinal: 999_999,
  maxLocalKeyLength: 9,
  maxConceptIdLength: 128,
  maxEvidenceDepth: 12,
  maxTextLength: 2_000,
  maxCollectionItems: 100,
});

declare const aiFactKeyBrand: unique symbol;
declare const aiMedicationKeyBrand: unique symbol;
declare const aiMedicationUseKeyBrand: unique symbol;
declare const aiConclusionKeyBrand: unique symbol;

export type AiFactKey = string & { readonly [aiFactKeyBrand]: true };
export type AiMedicationKey = string & {
  readonly [aiMedicationKeyBrand]: true;
};
export type AiMedicationUseKey = string & {
  readonly [aiMedicationUseKeyBrand]: true;
};
export type AiConclusionKey = string & {
  readonly [aiConclusionKeyBrand]: true;
};

export type AiDisclosureIntent =
  | {
      mode: 'spontaneous' | 'open_question';
    }
  | {
      mode: 'domain_exploration' | 'specific_question' | 'rapport_required';
      domains: NonEmptyArray<DisclosureDomain>;
    };

type AiDefinedPatientDatum<T> = {
  localFactKey: AiFactKey;
  disclosureIntent: AiDisclosureIntent;
} &
  (
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
      }
  );

export type AiPatientDatum<T> =
  | AiDefinedPatientDatum<T>
  | { state: 'not_defined' }
  | {
      state: 'not_applicable';
      reasonCode:
        | 'outside_case_scope'
        | 'clinically_irrelevant'
        | 'not_applicable_to_patient';
    };

export type AiPatientEncounterDraftV2 = {
  personPresent: AiPatientDatum<EncounterPersonRole>;
  relationshipToPatient: AiPatientDatum<string>;
};

export type AiPatientClinicalContextDraftV2 = {
  healthProblems: AiPatientDatum<string>[];
  clinicalHistory: AiPatientDatum<string>[];
  physiologicalSituation: AiPatientDatum<string>[];
  pregnancyAndLactation: AiPatientDatum<string>;
  allergiesAndIntolerances: AiPatientDatum<string>[];
  lifestyle: AiPatientDatum<string>[];
  biomedicalData: AiPatientDatum<BiomedicalDatumValue>[];
};

export type AiPatientSymptomDraftV2 = {
  description: AiPatientDatum<string>;
  onset: AiPatientDatum<string>;
  duration: AiPatientDatum<string>;
  evolution: AiPatientDatum<string>;
  relevantCircumstances: AiPatientDatum<string>[];
};

export type AiPatientMedicationDraftV2 = {
  localMedicationKey: AiMedicationKey;
  displayName: AiPatientDatum<string>;
  origin: AiPatientDatum<MedicationOrigin>;
  purposeAsUnderstood: AiPatientDatum<string>;
  regimenBasis: AiPatientDatum<MedicationRegimenBasis>;
  referenceDose: AiPatientDatum<string>;
  referenceSchedule: AiPatientDatum<string>;
  referenceDuration: AiPatientDatum<string>;
  administrationMethod: AiPatientDatum<string>;
  specialUseConditions: AiPatientDatum<string>[];
};

export type AiMedicationUsePatternDraftV2 = {
  localUseKey: AiMedicationUseKey;
  medicationRef: AiMedicationKey;
  action: MedicationUseAction;
  actualUse: AiPatientDatum<string>;
  actualDose: AiPatientDatum<string>;
  actualSchedule: AiPatientDatum<string>;
  frequency: AiPatientDatum<string>;
  timePeriod: AiPatientDatum<string>;
  circumstanceFactRefs: AiFactKey[];
  statedReasonFactRefs: AiFactKey[];
  perceivedEffectFactRefs: AiFactKey[];
  practicalDifficultyFactRefs: AiFactKey[];
  strategyTriedFactRefs: AiFactKey[];
};

export type AiMedicationLinkedFactDraftV2 = {
  medicationRef: AiMedicationKey;
  detail: AiPatientDatum<string>;
};

export type AiPatientPharmacotherapyDraftV2 = {
  prescribedMedications: AiPatientMedicationDraftV2[];
  otherMedicinesAndProducts: AiPatientMedicationDraftV2[];
  actualMedicationUse: AiMedicationUsePatternDraftV2[];
  recentChanges: AiMedicationLinkedFactDraftV2[];
  perceivedEffectiveness: AiMedicationLinkedFactDraftV2[];
  perceivedSafety: AiMedicationLinkedFactDraftV2[];
};

export type AiPatientFactsDraftV2 = {
  publicProfile: StudentPublicView;
  initialDemand: AiPatientDatum<string>;
  encounter: AiPatientEncounterDraftV2;
  clinicalContext: AiPatientClinicalContextDraftV2;
  symptoms: AiPatientSymptomDraftV2[];
  pharmacotherapy: AiPatientPharmacotherapyDraftV2;
  actionsAlreadyTaken: AiPatientDatum<string>[];
  practicalDifficulties: AiPatientDatum<string>[];
  beliefsAndConcerns: AiPatientDatum<string>[];
  strategiesAlreadyTried: AiPatientDatum<string>[];
  dailyAndSocialContext: AiPatientDatum<string>[];
  familyAndSocialSupport: AiPatientDatum<string>[];
  relationshipWithProfessionals: AiPatientDatum<string>[];
  communicationProfile: PatientCommunicationProfile;
};

export type AiTaxonomyCatalog =
  | 'prm'
  | 'rnm'
  | 'adherence_barrier'
  | 'professional_action'
  | 'pharmaceutical_intervention'
  | 'referral_destination';

export type AiTaxonomyConceptRef = {
  catalog: AiTaxonomyCatalog;
  conceptId: string;
};

export type AiEvaluatorConclusion<K extends string, V> = {
  localConclusionKey: AiConclusionKey;
  kind: K;
  value: V;
};

export type AiSpfaConclusion = AiEvaluatorConclusion<
  'spfa',
  { service: SpfaService; subtype?: DispensingSubtype }
>;

export type AiSpfaTransition = AiEvaluatorConclusion<
  'spfa_transition',
  { fromSpfaRef: AiConclusionKey; toSpfaRef: AiConclusionKey }
>;

export type AiAssessmentConclusion<
  K extends 'incidence_assessment' | 'prm_assessment',
> = AiEvaluatorConclusion<K, { status: AssessmentStatus }>;

export type AiIncidenceFinding = AiEvaluatorConclusion<
  'incidence',
  {
    spfaRef: AiConclusionKey;
    medicationRefs: AiMedicationKey[];
    semanticMeaning: string;
  }
>;

export type AiFollowUpEpisode = AiEvaluatorConclusion<
  'follow_up_episode',
  { incidenceRef: AiConclusionKey }
>;

export type AiPrmFinding = AiEvaluatorConclusion<
  'prm',
  {
    classification: AiTaxonomyConceptRef;
    medicationRefs: AiMedicationKey[];
    followUpEpisodeRef?: AiConclusionKey;
  }
>;

export type AiRnmAssessment = AiEvaluatorConclusion<
  'rnm_assessment',
  | {
      status: 'rnm';
      classification: AiTaxonomyConceptRef;
      medicationRefs: AiMedicationKey[];
      followUpEpisodeRef?: AiConclusionKey;
    }
  | {
      status: 'risk_of_rnm';
      classification?: AiTaxonomyConceptRef;
      medicationRefs: AiMedicationKey[];
      followUpEpisodeRef?: AiConclusionKey;
    }
  | { status: 'no_rnm' }
>;

export type AiPrmRnmRelation = AiEvaluatorConclusion<
  'prm_rnm_relation',
  {
    prmRef: AiConclusionKey;
    rnmAssessmentRef: AiConclusionKey;
    relation: 'creates_risk_of_rnm' | 'contributes_to_rnm';
  }
>;

export type AiAdherenceAssessment = AiEvaluatorConclusion<
  'adherence_assessment',
  {
    medicationRefs: NonEmptyArray<AiMedicationKey>;
    status: AdherenceStatus;
  }
>;

export type AiNonAdherenceTypeConclusion = AiEvaluatorConclusion<
  'non_adherence_type',
  | {
      adherenceAssessmentRef: AiConclusionKey;
      status: 'determined';
      type: NonAdherenceType;
    }
  | {
      adherenceAssessmentRef: AiConclusionKey;
      status: 'not_determinable';
    }
>;

export type AiAdherencePatientProfileConclusion = AiEvaluatorConclusion<
  'adherence_patient_profile',
  | {
      adherenceAssessmentRef: AiConclusionKey;
      status: 'determined';
      profile: AdherencePatientProfile;
    }
  | {
      adherenceAssessmentRef: AiConclusionKey;
      status: 'not_determinable';
    }
>;

export type AiAdherenceBarrierAssessment = AiEvaluatorConclusion<
  'adherence_barrier_assessment',
  {
    adherenceAssessmentRef: AiConclusionKey;
    status: 'identified' | 'not_determinable';
  }
>;

export type AiAdherenceBarrier = AiEvaluatorConclusion<
  'adherence_barrier',
  {
    barrierAssessmentRef: AiConclusionKey;
    role: 'primary' | 'secondary';
    category: AdherenceBarrierCategory;
    classification?: AiTaxonomyConceptRef;
  }
>;

export type AiAdherenceStrategy = AiEvaluatorConclusion<
  'adherence_strategy',
  {
    adherenceAssessmentRef: AiConclusionKey;
    addressedBarrierRefs: AiConclusionKey[];
  } &
    (
      | { category: BaseAdherenceStrategyCategory }
      | {
          category: 'combined';
          componentCategories: NonEmptyArray<BaseAdherenceStrategyCategory>;
        }
    )
>;

export type AiProfessionalAction = AiEvaluatorConclusion<
  'professional_action',
  {
    spfaRef: AiConclusionKey;
    category: ProfessionalActionCategory;
    classification?: AiTaxonomyConceptRef;
    targetSpfaRef?: AiConclusionKey;
    referralRef?: AiConclusionKey;
  }
>;

export type AiPharmaceuticalIntervention = AiEvaluatorConclusion<
  'pharmaceutical_intervention',
  {
    spfaRef: AiConclusionKey;
    professionalActionRef?: AiConclusionKey;
    target: PharmaceuticalInterventionTarget;
    classification?: AiTaxonomyConceptRef;
    addressedConclusionRefs: NonEmptyArray<AiConclusionKey>;
    referralRef?: AiConclusionKey;
  }
>;

export type AiReportRequirement =
  | { status: 'not_required'; essentialContents: readonly [] }
  | {
      status: 'appropriate' | 'required';
      essentialContents: NonEmptyArray<string>;
    };

export type AiReferralConclusion = AiEvaluatorConclusion<
  'referral',
  | { status: 'not_required' }
  | {
      status: 'required';
      urgency: ReferralUrgency;
      destination: {
        label: string;
        classification?: AiTaxonomyConceptRef;
      };
      reason: string;
      report: AiReportRequirement;
    }
>;

export type AiEvidenceLeafRef =
  | { operator: 'fact'; factRef: AiFactKey }
  | { operator: 'public_profile'; field: 'age' | 'sex' };

export type AiEvidenceExpression =
  | AiEvidenceLeafRef
  | {
      operator: 'all';
      operands: NonEmptyArray<AiEvidenceExpression>;
    }
  | {
      operator: 'any';
      operands: NonEmptyArray<AiEvidenceExpression>;
    };

export type AiEvidenceRule = {
  conclusionRef: AiConclusionKey;
  requiredEvidence: AiEvidenceExpression;
  supportingEvidenceRefs: readonly AiEvidenceLeafRef[];
  counterEvidenceRefs: readonly AiEvidenceLeafRef[];
  teacherRationale: string;
};

export type AiEvaluatorDraftV2 = {
  carePath: {
    initialSpfa: AiSpfaConclusion;
    additionalSpfas: AiSpfaConclusion[];
    transitions: AiSpfaTransition[];
  };
  incidence: {
    assessment: AiAssessmentConclusion<'incidence_assessment'>;
    findings: AiIncidenceFinding[];
    followUpEpisodes: AiFollowUpEpisode[];
  };
  prm: {
    assessment: AiAssessmentConclusion<'prm_assessment'>;
    findings: AiPrmFinding[];
  };
  rnmAssessments: AiRnmAssessment[];
  prmRnmRelations: AiPrmRnmRelation[];
  adherence: {
    assessments: AiAdherenceAssessment[];
    typeConclusions: AiNonAdherenceTypeConclusion[];
    patientProfiles: AiAdherencePatientProfileConclusion[];
    barrierAssessments: AiAdherenceBarrierAssessment[];
    barriers: AiAdherenceBarrier[];
    strategies: AiAdherenceStrategy[];
  };
  professionalActions: AiProfessionalAction[];
  pharmaceuticalInterventions: AiPharmaceuticalIntervention[];
  referral: AiReferralConclusion;
  evidenceRules: AiEvidenceRule[];
};

export type AiGeneratedCaseDraftV2 = {
  contractVersion: typeof AI_GENERATION_CONTRACT_VERSION;
  patientFacts: AiPatientFactsDraftV2;
  evaluator: AiEvaluatorDraftV2;
};
