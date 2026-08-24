import type {
  AdherenceAssessment,
  AdherenceBarrier,
  AdherenceBarrierAssessment,
  AdherencePatientProfileConclusion,
  AdherenceStrategy,
  ConclusionId,
  EvaluatorConclusion,
  FollowUpEpisode,
  IncidenceAssessment,
  IncidenceFinding,
  NonAdherenceTypeConclusion,
  NonEmptyArray,
  PharmaceuticalIntervention,
  PrmAssessment,
  PrmFinding,
  PrmRnmRelation,
  ProfessionalAction,
  ReferralConclusion,
  RnmAssessment,
  SpfaConclusion,
  SpfaService,
} from './evaluator-types';
import type { SpfaRequirementTargetId } from './spfa-protocol-application-types';
import type {
  SpfaActionDomain,
  SpfaInformationDomain,
  SpfaProtocolRequirementId,
} from './spfa-protocol-types';
import type {
  SessionMessageId,
  SessionTranscriptFingerprintV1,
} from './spfa-session-evidence-types';
import type {
  CaseVersionId,
  MedicationUseAction,
} from './types';

type DeepReadonly<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

export type SpfaSemanticDatumValueV2 =
  | string
  | number
  | Readonly<{
      type: string;
      value: string | number;
      unit?: string;
      timingOrContext?: string;
    }>;

export type SpfaSemanticDatumContextV2 =
  | Readonly<{
      state: 'known';
      certainty: 'exact' | 'approximate' | 'uncertain';
      value: SpfaSemanticDatumValueV2;
    }>
  | Readonly<{
      state: 'explicit_absence';
      topic: string;
    }>
  | Readonly<{
      state: 'patient_unknown';
      topic: string;
    }>;

export type SpfaSemanticMedicationIdentityV2 = Readonly<{
  displayName: SpfaSemanticDatumContextV2;
}>;

export type SpfaSemanticFactLocationV2 =
  | Readonly<{ section: 'INITIAL_DEMAND' }>
  | Readonly<{
      section: 'ENCOUNTER';
      field: 'PERSON_PRESENT' | 'RELATIONSHIP_TO_PATIENT';
    }>
  | Readonly<{
      section: 'CLINICAL_CONTEXT';
      field:
        | 'HEALTH_PROBLEM'
        | 'CLINICAL_HISTORY'
        | 'PHYSIOLOGICAL_SITUATION'
        | 'PREGNANCY_LACTATION'
        | 'ALLERGY_INTOLERANCE'
        | 'LIFESTYLE'
        | 'BIOMEDICAL_DATA';
    }>
  | Readonly<{
      section: 'SYMPTOM';
      field:
        | 'DESCRIPTION'
        | 'ONSET'
        | 'DURATION'
        | 'EVOLUTION'
        | 'RELEVANT_CIRCUMSTANCE';
      symptom: SpfaSemanticDatumContextV2;
    }>
  | Readonly<{
      section: 'MEDICATION';
      field:
        | 'DISPLAY_NAME'
        | 'ORIGIN'
        | 'PURPOSE_AS_UNDERSTOOD'
        | 'REGIMEN_BASIS'
        | 'REFERENCE_DOSE'
        | 'REFERENCE_SCHEDULE'
        | 'REFERENCE_DURATION'
        | 'ADMINISTRATION_METHOD'
        | 'SPECIAL_USE_CONDITION';
      medication: SpfaSemanticMedicationIdentityV2;
    }>
  | Readonly<{
      section: 'MEDICATION_USE';
      field:
        | 'ACTUAL_USE'
        | 'ACTUAL_DOSE'
        | 'ACTUAL_SCHEDULE'
        | 'FREQUENCY'
        | 'TIME_PERIOD';
      medication: SpfaSemanticMedicationIdentityV2;
      action: MedicationUseAction;
    }>
  | Readonly<{
      section: 'MEDICATION_LINKED';
      field: 'RECENT_CHANGE' | 'PERCEIVED_EFFECTIVENESS' | 'PERCEIVED_SAFETY';
      medication: SpfaSemanticMedicationIdentityV2;
    }>
  | Readonly<{
      section: 'PATIENT_CONTEXT';
      field:
        | 'ACTION_ALREADY_TAKEN'
        | 'PRACTICAL_DIFFICULTY'
        | 'BELIEF_OR_CONCERN'
        | 'STRATEGY_ALREADY_TRIED'
        | 'DAILY_OR_SOCIAL_CONTEXT'
        | 'FAMILY_OR_SOCIAL_SUPPORT'
        | 'RELATIONSHIP_WITH_PROFESSIONALS';
    }>;

export type SpfaSemanticServiceContextV2 = Readonly<{
  service: SpfaService;
  subtype?: 'initial_treatment' | 'continuation';
}>;

export type SpfaSemanticRequirementContextV2 =
  | Readonly<{
      kind: 'INFORMATION_REQUIREMENT';
      semanticDomain: DeepReadonly<SpfaInformationDomain>;
      goal: string;
    }>
  | Readonly<{
      kind: 'ACTION_REQUIREMENT';
      semanticDomain: SpfaActionDomain;
      goal: string;
    }>;

export type SpfaSemanticFactDescriptorV2 = Readonly<{
  location: SpfaSemanticFactLocationV2;
  datum: SpfaSemanticDatumContextV2;
}>;

type SemanticEvaluatorConclusionSourceV2 =
  | SpfaConclusion
  | IncidenceAssessment
  | IncidenceFinding
  | FollowUpEpisode
  | PrmAssessment
  | PrmFinding
  | RnmAssessment
  | PrmRnmRelation
  | AdherenceAssessment
  | NonAdherenceTypeConclusion
  | AdherencePatientProfileConclusion
  | AdherenceBarrierAssessment
  | AdherenceBarrier
  | AdherenceStrategy
  | ProfessionalAction
  | PharmaceuticalIntervention
  | ReferralConclusion;

type SemanticConclusionProjection<Conclusion> =
  Conclusion extends EvaluatorConclusion<string, object>
    ? DeepReadonly<Omit<Conclusion, 'conclusionId'>>
    : never;

export type SpfaSemanticEvaluatorConclusionContextV2 =
  SemanticConclusionProjection<SemanticEvaluatorConclusionSourceV2>;

type SpfaSemanticTargetDescriptorBaseV2 = Readonly<{
  targetRef: SpfaRequirementTargetId;
  candidateMessageRefs: readonly SessionMessageId[];
}>;

export type SpfaSemanticTargetDescriptorV2 =
  | Readonly<
      SpfaSemanticTargetDescriptorBaseV2 & {
        target: Readonly<{
          kind: 'FACT';
          location: SpfaSemanticFactLocationV2;
          datum: SpfaSemanticDatumContextV2;
        }>;
      }
    >
  | Readonly<
      SpfaSemanticTargetDescriptorBaseV2 & {
        target: Readonly<{
          kind: 'MEDICATION_ENTITY';
          medication: SpfaSemanticMedicationIdentityV2;
        }>;
      }
    >
  | Readonly<
      SpfaSemanticTargetDescriptorBaseV2 & {
        target: Readonly<{
          kind: 'MEDICATION_FACT';
          medication: SpfaSemanticMedicationIdentityV2;
          fact: SpfaSemanticFactDescriptorV2;
        }>;
      }
    >
  | Readonly<
      SpfaSemanticTargetDescriptorBaseV2 & {
        target: Readonly<{
          kind: 'EVALUATOR_CONCLUSION';
          conclusion: SpfaSemanticEvaluatorConclusionContextV2;
        }>;
      }
    >
  | Readonly<
      SpfaSemanticTargetDescriptorBaseV2 & {
        target: Readonly<{
          kind: 'CARE_PATH_TRANSITION';
          from: SpfaSemanticServiceContextV2;
          to: SpfaSemanticServiceContextV2;
        }>;
      }
    >;

export type SpfaSemanticTargetContextFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'spfa-semantic-target-context-v2/1';
  value: string;
}>;

export type SpfaSemanticTargetContextV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'spfa-semantic-target-context/1';
  sessionId: string;
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV1;
  carePathSpfaRef: ConclusionId;
  requirementRef: SpfaProtocolRequirementId;
  kind: 'INFORMATION_REQUIREMENT' | 'ACTION_REQUIREMENT';
  spfa: SpfaSemanticServiceContextV2;
  requirement: SpfaSemanticRequirementContextV2;
  targets: NonEmptyArray<SpfaSemanticTargetDescriptorV2>;
  fingerprint: SpfaSemanticTargetContextFingerprintV1;
}>;
