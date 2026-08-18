import type {
  AiConclusionKey,
  AiDisclosureIntent,
  AiFactKey,
  AiMedicationKey,
  AiMedicationUseKey,
  AiTaxonomyConceptRef,
} from './ai-generation-types';
import type {
  EvaluatorVersionsV2,
  EvaluatorViewV2,
  TaxonomyTermRef,
} from './evaluator-types';
import type {
  CasePatientFactsDraftV2,
  CaseVersionId,
  DisclosureRule,
  FactId,
  MedicationId,
  MedicationUseId,
  PatientCommunicationProfile,
} from './types';

export type DisclosureResolutionContextV2 = Readonly<{
  path: string;
  datumState: 'known' | 'explicit_absence' | 'patient_unknown';
  communicationProfile: PatientCommunicationProfile;
}>;

export type GenerationAssemblyContextV2 = Readonly<{
  caseVersionId: CaseVersionId;
  evaluatorVersions: EvaluatorVersionsV2;

  allocateMedicationId(localKey: AiMedicationKey): MedicationId;
  allocateMedicationUseId(localKey: AiMedicationUseKey): MedicationUseId;
  allocateFactId(localKey: AiFactKey): FactId;
  allocateConclusionId(localKey: AiConclusionKey): import('./evaluator-types').ConclusionId;

  resolveTaxonomy(ref: AiTaxonomyConceptRef): TaxonomyTermRef;
  resolveDisclosure(
    intent: AiDisclosureIntent,
    context: DisclosureResolutionContextV2,
  ): DisclosureRule;
}>;

export type CanonicalGeneratedCaseCoreV2 = Readonly<{
  caseVersionId: CaseVersionId;
  patientFacts: CasePatientFactsDraftV2;
  evaluator: EvaluatorViewV2;
}>;

export type GenerationAssemblyErrorCode =
  | 'duplicate_canonical_id'
  | 'unresolved_mapping'
  | 'taxonomy_resolution_failed'
  | 'disclosure_resolution_failed'
  | 'invalid_patient_facts'
  | 'invalid_evaluator';

export class GenerationAssemblyError extends Error {
  constructor(
    public readonly code: GenerationAssemblyErrorCode,
    public readonly path: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'GenerationAssemblyError';
  }
}
