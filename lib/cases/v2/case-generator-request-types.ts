import type { AiTaxonomyCatalog } from './ai-generation-types';
import type { NonEmptyArray, TaxonomyTermRef } from './evaluator-types';
import type { TeachingCaseGenerationBriefV2 } from './teaching-brief-types';

export const CASE_GENERATOR_REQUEST_CONTRACT_VERSION =
  'case-generator-request/1' as const;

export const GENERATOR_TAXONOMY_CATALOGS = [
  'prm',
  'rnm',
  'adherence_barrier',
  'professional_action',
  'pharmaceutical_intervention',
  'referral_destination',
] as const satisfies readonly AiTaxonomyCatalog[];

/** Defensive transport limits, not clinical catalog limits. */
export const GENERATOR_CATALOG_LIMITS = Object.freeze({
  maxConceptsPerCatalog: 100,
  maxConceptIdLength: 128,
  maxLabelLength: 200,
  maxDescriptionLength: 1_000,
});

export type GeneratorTaxonomyConceptV2 = {
  readonly conceptId: string;
  readonly label: string;
  readonly description?: string;
};

export type GeneratorTaxonomyCatalogsV2 = Readonly<
  Record<AiTaxonomyCatalog, NonEmptyArray<GeneratorTaxonomyConceptV2>>
>;

type GeneratorSafeSemanticValue<T> = T extends TaxonomyTermRef
  ? { readonly conceptId: string }
  : T extends object
    ? { readonly [K in keyof T]: GeneratorSafeSemanticValue<T[K]> }
    : T;

type GeneratorTeachingBriefSource = Pick<
  TeachingCaseGenerationBriefV2,
  | 'generationMode'
  | 'complexity'
  | 'carePath'
  | 'incidence'
  | 'prm'
  | 'rnm'
  | 'adherence'
  | 'adherenceStrategies'
  | 'professionalActions'
  | 'pharmaceuticalInterventions'
  | 'referral'
  | 'teacherInstruction'
>;

/** Semantic teacher intent only; application identity and taxonomy metadata are removed. */
export type GeneratorTeachingBriefV2 =
  GeneratorSafeSemanticValue<GeneratorTeachingBriefSource>;

export type CaseGeneratorPolicyV2 = {
  readonly locale: 'es-ES';
  readonly practiceSetting: 'spanish_community_pharmacy';
  readonly fictitiousPatientsOnly: true;
};

export type GeneratorRequestV2 = {
  readonly contractVersion: typeof CASE_GENERATOR_REQUEST_CONTRACT_VERSION;
  readonly instructions: string;
  readonly input: {
    readonly teachingBrief: GeneratorTeachingBriefV2;
    readonly taxonomyCatalogs: GeneratorTaxonomyCatalogsV2;
    readonly policy: CaseGeneratorPolicyV2;
  };
  readonly expectedOutputContract: {
    readonly contractVersion: 'ai-generated-case-draft/1';
  };
};

export type CaseGeneratorRequestErrorCode =
  | 'invalid_generator_brief'
  | 'invalid_generator_catalog'
  | 'generator_request_build_failed';

export class CaseGeneratorRequestError extends Error {
  constructor(
    public readonly code: CaseGeneratorRequestErrorCode,
    public readonly path: string,
    message: string,
    public readonly cause: unknown,
  ) {
    super(`${path}: ${message}`);
    this.name = 'CaseGeneratorRequestError';
  }
}
