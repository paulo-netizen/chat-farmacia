export type Scale1To5 = 1 | 2 | 3 | 4 | 5;

declare const factIdBrand: unique symbol;
declare const medicationIdBrand: unique symbol;
declare const medicationUseIdBrand: unique symbol;

export type FactId = string & { readonly [factIdBrand]: true };
export type MedicationId = string & { readonly [medicationIdBrand]: true };
export type MedicationUseId = string & {
  readonly [medicationUseIdBrand]: true;
};

export type DisclosureDomain =
  | 'initial_demand'
  | 'health_problems'
  | 'symptoms'
  | 'medication_knowledge'
  | 'medication_use'
  | 'practical_difficulties'
  | 'beliefs_and_concerns'
  | 'perceived_experiences'
  | 'daily_context'
  | 'social_context';

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

export type MedicationUseAction =
  | 'takes'
  | 'omits'
  | 'delays'
  | 'changes_dose'
  | 'interrupts'
  | 'uses_extra'
  | 'uses_only_when_symptomatic'
  | 'uses_with_incorrect_technique';

export type PatientMedicationDraftV2 = {
  medicationId: MedicationId;
  displayName: PatientDatum<string>;
  prescribedUse: PatientDatum<string>;
  purposeAsUnderstood: PatientDatum<string>;
};

export type RuntimePatientMedicationV2 = {
  medicationId: MedicationId;
  displayName: RuntimePatientDatum<string>;
  prescribedUse: RuntimePatientDatum<string>;
  purposeAsUnderstood?: RuntimePatientDatum<string>;
};

export type MedicationUsePatternDraftV2 = {
  useId: MedicationUseId;
  medicationRef: MedicationId;
  action: MedicationUseAction;
  actualUse: PatientDatum<string>;
  circumstanceFactRefs: FactId[];
  statedReasonFactRefs: FactId[];
  perceivedEffectFactRefs: FactId[];
  practicalDifficultyFactRefs: FactId[];
};

export type RuntimeMedicationUsePatternV2 = {
  useId: MedicationUseId;
  medicationRef: MedicationId;
  action: MedicationUseAction;
  actualUse: RuntimePatientDatum<string>;
  circumstanceFactRefs: FactId[];
  statedReasonFactRefs: FactId[];
  perceivedEffectFactRefs: FactId[];
  practicalDifficultyFactRefs: FactId[];
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
  publicProfile: StudentPublicView;
  initialDemand: PatientDatum<string>;
  knownHealthProblems: PatientDatum<string>[];
  symptoms: PatientDatum<string>[];
  medications: PatientMedicationDraftV2[];
  medicationUse: MedicationUsePatternDraftV2[];
  practicalDifficulties: PatientDatum<string>[];
  beliefsAndConcerns: PatientDatum<string>[];
  perceivedExperiences: PatientDatum<string>[];
  dailyAndSocialContext: PatientDatum<string>[];
  communicationProfile: PatientCommunicationProfile;
};

export type PatientRuntimeViewV2 = {
  schemaVersion: '2.0';
  publicProfile: StudentPublicView;
  initialDemand: RuntimePatientDatum<string>;
  knownHealthProblems: RuntimePatientDatum<string>[];
  symptoms: RuntimePatientDatum<string>[];
  medications: RuntimePatientMedicationV2[];
  medicationUse: RuntimeMedicationUsePatternV2[];
  practicalDifficulties: RuntimePatientDatum<string>[];
  beliefsAndConcerns: RuntimePatientDatum<string>[];
  perceivedExperiences: RuntimePatientDatum<string>[];
  dailyAndSocialContext: RuntimePatientDatum<string>[];
  communicationProfile: PatientCommunicationProfile;
};
