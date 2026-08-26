import type {
  AdherenceAssessment,
  AdherenceBarrier,
  AdherenceBarrierAssessment,
  AdherencePatientProfileConclusion,
  AdherenceStrategy,
  CarePathV2,
  EvaluatorVersionsV2,
  FollowUpEpisode,
  IncidenceAssessment,
  IncidenceFinding,
  NonAdherenceTypeConclusion,
  PharmaceuticalIntervention,
  ProfessionalAction,
  PrmAssessment,
  PrmFinding,
  PrmRnmRelation,
  ReferralConclusion,
  RnmAssessment,
} from './evaluator-types';
import type { CaseVersionId } from './types';

type DeepReadonly<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends readonly (infer Item)[]
    ? readonly DeepReadonly<Item>[]
    : T extends object
      ? { readonly [Key in keyof T]: DeepReadonly<T[Key]> }
      : T;

/**
 * Server-owned clinical ground-truth projection for later M6 layers.
 *
 * EvidenceRule is intentionally absent: it justifies ground truth with case
 * facts and must never be treated as evidence of student performance.
 */
export type PharmaceuticalClinicalReferenceV2 = Readonly<{
  schemaVersion: '2.0';
  caseVersionId: CaseVersionId;
  versions: DeepReadonly<EvaluatorVersionsV2>;
  structuralContext: Readonly<{
    carePath: DeepReadonly<CarePathV2>;
    followUpEpisodes: readonly DeepReadonly<FollowUpEpisode>[];
    prmRnmRelations: readonly DeepReadonly<PrmRnmRelation>[];
  }>;
  clinicalConclusions: Readonly<{
    incidence: Readonly<{
      assessment: DeepReadonly<IncidenceAssessment>;
      findings: readonly DeepReadonly<IncidenceFinding>[];
    }>;
    prm: Readonly<{
      assessment: DeepReadonly<PrmAssessment>;
      findings: readonly DeepReadonly<PrmFinding>[];
    }>;
    rnmAssessments: readonly DeepReadonly<RnmAssessment>[];
    adherence: Readonly<{
      assessments: readonly DeepReadonly<AdherenceAssessment>[];
      typeConclusions: readonly DeepReadonly<NonAdherenceTypeConclusion>[];
      patientProfiles: readonly DeepReadonly<AdherencePatientProfileConclusion>[];
      barrierAssessments: readonly DeepReadonly<AdherenceBarrierAssessment>[];
      barriers: readonly DeepReadonly<AdherenceBarrier>[];
      strategies: readonly DeepReadonly<AdherenceStrategy>[];
    }>;
    professionalActions: readonly DeepReadonly<ProfessionalAction>[];
    pharmaceuticalInterventions: readonly DeepReadonly<PharmaceuticalIntervention>[];
    referral: DeepReadonly<ReferralConclusion>;
  }>;
}>;
