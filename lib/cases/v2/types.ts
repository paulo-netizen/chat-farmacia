export type Scale1To5 = 1 | 2 | 3 | 4 | 5;

declare const factIdBrand: unique symbol;
declare const medicationIdBrand: unique symbol;
declare const medicationUseIdBrand: unique symbol;
declare const caseVersionIdBrand: unique symbol;

export type FactId = string & { readonly [factIdBrand]: true };
export type MedicationId = string & { readonly [medicationIdBrand]: true };
export type MedicationUseId = string & {
  readonly [medicationUseIdBrand]: true;
};
export type CaseVersionId = string & {
  readonly [caseVersionIdBrand]: true;
};

export type DisclosureDomain =
  | 'initial_demand'
  | 'patient_identity'
  | 'caregiver_context'
  | 'health_problems'
  | 'clinical_history'
  | 'physiological_status'
  | 'pregnancy_lactation'
  | 'allergies_intolerances'
  | 'symptoms'
  | 'symptom_timing_and_evolution'
  | 'prior_actions'
  | 'medication_identity'
  | 'medication_purpose'
  | 'prescribed_medication_use'
  | 'actual_medication_use'
  | 'administration_technique'
  | 'special_use_conditions'
  | 'medication_changes'
  | 'perceived_effectiveness'
  | 'perceived_safety'
  | 'practical_difficulties'
  | 'beliefs_and_concerns'
  | 'strategies_already_tried'
  | 'lifestyle'
  | 'daily_context'
  | 'social_support'
  | 'professional_relationship'
  | 'biomedical_data';

export type DisclosureDelay =
  | 'judgmental_tone'
  | 'accusatory_question'
  | 'lack_of_empathy'
  | 'patient_minimization';

type DisclosureBase = {
  delayedBy?: DisclosureDelay[];
};

export type DisclosureRule = DisclosureBase &
  (
    | {
        mode: 'spontaneous' | 'open_question';
      }
    | {
        mode: 'domain_exploration' | 'specific_question';
        domains: DisclosureDomain[];
      }
    | {
        mode: 'rapport_required';
        domains: DisclosureDomain[];
        minimumRapport: number;
      }
  );

type DefinedPatientDatum<T> = {
  factId: FactId;
  disclosure: DisclosureRule;
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

export type PatientDatum<T> =
  | DefinedPatientDatum<T>
  | {
      state: 'not_defined';
    }
  | {
      state: 'not_applicable';
      reasonCode:
        | 'outside_case_scope'
        | 'clinically_irrelevant'
        | 'not_applicable_to_patient';
    };

export type RuntimePatientDatum<T> = Extract<
  PatientDatum<T>,
  { state: 'known' | 'explicit_absence' | 'patient_unknown' }
>;

export type StudentPublicView = {
  nombre: string;
  edad: number;
  sexo: string;
  tratamiento: string;
};

export type EncounterPersonRole = 'patient' | 'caregiver' | 'other';

export type PatientEncounterDraftV2 = {
  personPresent: PatientDatum<EncounterPersonRole>;
  relationshipToPatient: PatientDatum<string>;
};

export type RuntimePatientEncounterV2 = {
  personPresent: RuntimePatientDatum<EncounterPersonRole>;
  relationshipToPatient?: RuntimePatientDatum<string>;
};

export type BiomedicalDatumValue = {
  type: string;
  value: string | number;
  unit?: string;
  timingOrContext?: string;
};

export type PatientClinicalContextDraftV2 = {
  healthProblems: PatientDatum<string>[];
  clinicalHistory: PatientDatum<string>[];
  physiologicalSituation: PatientDatum<string>[];
  pregnancyAndLactation: PatientDatum<string>;
  allergiesAndIntolerances: PatientDatum<string>[];
  lifestyle: PatientDatum<string>[];
  biomedicalData: PatientDatum<BiomedicalDatumValue>[];
};

export type RuntimePatientClinicalContextV2 = {
  healthProblems: RuntimePatientDatum<string>[];
  clinicalHistory: RuntimePatientDatum<string>[];
  physiologicalSituation: RuntimePatientDatum<string>[];
  pregnancyAndLactation?: RuntimePatientDatum<string>;
  allergiesAndIntolerances: RuntimePatientDatum<string>[];
  lifestyle: RuntimePatientDatum<string>[];
  biomedicalData: RuntimePatientDatum<BiomedicalDatumValue>[];
};

export type PatientSymptomDraftV2 = {
  description: PatientDatum<string>;
  onset: PatientDatum<string>;
  duration: PatientDatum<string>;
  evolution: PatientDatum<string>;
  relevantCircumstances: PatientDatum<string>[];
};

export type RuntimePatientSymptomV2 = {
  description: RuntimePatientDatum<string>;
  onset?: RuntimePatientDatum<string>;
  duration?: RuntimePatientDatum<string>;
  evolution?: RuntimePatientDatum<string>;
  relevantCircumstances: RuntimePatientDatum<string>[];
};

export type MedicationOrigin =
  | 'prescribed'
  | 'patient_selected'
  | 'pharmacist_recommended'
  | 'other';

export type MedicationRegimenBasis =
  | 'prescription'
  | 'label_or_leaflet'
  | 'pharmacist_advice'
  | 'patient_plan'
  | 'other';

export type PatientMedicationDraftV2 = {
  medicationId: MedicationId;
  displayName: PatientDatum<string>;
  origin: PatientDatum<MedicationOrigin>;
  purposeAsUnderstood: PatientDatum<string>;
  regimenBasis: PatientDatum<MedicationRegimenBasis>;
  referenceDose: PatientDatum<string>;
  referenceSchedule: PatientDatum<string>;
  referenceDuration: PatientDatum<string>;
  administrationMethod: PatientDatum<string>;
  specialUseConditions: PatientDatum<string>[];
};

export type RuntimePatientMedicationV2 = {
  medicationId: MedicationId;
  displayName: RuntimePatientDatum<string>;
  origin: RuntimePatientDatum<MedicationOrigin>;
  purposeAsUnderstood?: RuntimePatientDatum<string>;
  regimenBasis?: RuntimePatientDatum<MedicationRegimenBasis>;
  referenceDose?: RuntimePatientDatum<string>;
  referenceSchedule?: RuntimePatientDatum<string>;
  referenceDuration?: RuntimePatientDatum<string>;
  administrationMethod?: RuntimePatientDatum<string>;
  specialUseConditions: RuntimePatientDatum<string>[];
};

export type MedicationUseAction =
  | 'takes'
  | 'omits'
  | 'delays'
  | 'changes_dose'
  | 'interrupts'
  | 'uses_extra'
  | 'uses_only_when_symptomatic'
  | 'uses_with_incorrect_technique';

export type MedicationUsePatternDraftV2 = {
  useId: MedicationUseId;
  medicationRef: MedicationId;
  action: MedicationUseAction;
  actualUse: PatientDatum<string>;
  actualDose: PatientDatum<string>;
  actualSchedule: PatientDatum<string>;
  frequency: PatientDatum<string>;
  timePeriod: PatientDatum<string>;
  circumstanceFactRefs: FactId[];
  statedReasonFactRefs: FactId[];
  perceivedEffectFactRefs: FactId[];
  practicalDifficultyFactRefs: FactId[];
  strategyTriedFactRefs: FactId[];
};

export type RuntimeMedicationUsePatternV2 = {
  useId: MedicationUseId;
  medicationRef: MedicationId;
  action: MedicationUseAction;
  actualUse: RuntimePatientDatum<string>;
  actualDose?: RuntimePatientDatum<string>;
  actualSchedule?: RuntimePatientDatum<string>;
  frequency?: RuntimePatientDatum<string>;
  timePeriod?: RuntimePatientDatum<string>;
  circumstanceFactRefs: FactId[];
  statedReasonFactRefs: FactId[];
  perceivedEffectFactRefs: FactId[];
  practicalDifficultyFactRefs: FactId[];
  strategyTriedFactRefs: FactId[];
};

export type MedicationLinkedFactDraftV2 = {
  medicationRef: MedicationId;
  detail: PatientDatum<string>;
};

export type RuntimeMedicationLinkedFactV2 = {
  medicationRef: MedicationId;
  detail: RuntimePatientDatum<string>;
};

export type PatientPharmacotherapyDraftV2 = {
  prescribedMedications: PatientMedicationDraftV2[];
  otherMedicinesAndProducts: PatientMedicationDraftV2[];
  actualMedicationUse: MedicationUsePatternDraftV2[];
  recentChanges: MedicationLinkedFactDraftV2[];
  perceivedEffectiveness: MedicationLinkedFactDraftV2[];
  perceivedSafety: MedicationLinkedFactDraftV2[];
};

export type RuntimePatientPharmacotherapyV2 = {
  prescribedMedications: RuntimePatientMedicationV2[];
  otherMedicinesAndProducts: RuntimePatientMedicationV2[];
  actualMedicationUse: RuntimeMedicationUsePatternV2[];
  recentChanges: RuntimeMedicationLinkedFactV2[];
  perceivedEffectiveness: RuntimeMedicationLinkedFactV2[];
  perceivedSafety: RuntimeMedicationLinkedFactV2[];
};

export type PatientCommunicationProfile = {
  sociability: Scale1To5;
  cooperation: Scale1To5;
  organization: Scale1To5;
  emotionalReactivity: Scale1To5;
  opennessToChange: Scale1To5;
  healthLiteracy: 'low' | 'medium' | 'high';
  professionalTrust: Scale1To5;
  medicationAttitude:
    | 'trusting'
    | 'neutral'
    | 'cautious'
    | 'skeptical'
    | 'ambivalent';
  decisionStyle:
    | 'autonomous'
    | 'shared'
    | 'professional_led'
    | 'family_influenced'
    | 'indecisive';
  readinessToChange: Scale1To5;
  socialDesirability: Scale1To5;
  judgmentSensitivity: Scale1To5;
  disclosureThreshold: Scale1To5;
  answerLength: 'brief' | 'medium' | 'long';
  assertiveness: Scale1To5;
  emotionalExpression: Scale1To5;
};

export type CasePatientFactsDraftV2 = {
  schemaVersion: '2.0';
  caseVersionId: CaseVersionId;
  publicProfile: StudentPublicView;
  initialDemand: PatientDatum<string>;
  encounter: PatientEncounterDraftV2;
  clinicalContext: PatientClinicalContextDraftV2;
  symptoms: PatientSymptomDraftV2[];
  pharmacotherapy: PatientPharmacotherapyDraftV2;
  actionsAlreadyTaken: PatientDatum<string>[];
  practicalDifficulties: PatientDatum<string>[];
  beliefsAndConcerns: PatientDatum<string>[];
  strategiesAlreadyTried: PatientDatum<string>[];
  dailyAndSocialContext: PatientDatum<string>[];
  familyAndSocialSupport: PatientDatum<string>[];
  relationshipWithProfessionals: PatientDatum<string>[];
  communicationProfile: PatientCommunicationProfile;
};

export type PatientRuntimeViewV2 = {
  schemaVersion: '2.0';
  caseVersionId: CaseVersionId;
  publicProfile: StudentPublicView;
  initialDemand: RuntimePatientDatum<string>;
  encounter: RuntimePatientEncounterV2;
  clinicalContext: RuntimePatientClinicalContextV2;
  symptoms: RuntimePatientSymptomV2[];
  pharmacotherapy: RuntimePatientPharmacotherapyV2;
  actionsAlreadyTaken: RuntimePatientDatum<string>[];
  practicalDifficulties: RuntimePatientDatum<string>[];
  beliefsAndConcerns: RuntimePatientDatum<string>[];
  strategiesAlreadyTried: RuntimePatientDatum<string>[];
  dailyAndSocialContext: RuntimePatientDatum<string>[];
  familyAndSocialSupport: RuntimePatientDatum<string>[];
  relationshipWithProfessionals: RuntimePatientDatum<string>[];
  communicationProfile: PatientCommunicationProfile;
};
