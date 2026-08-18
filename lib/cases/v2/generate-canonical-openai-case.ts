import { assembleCanonicalGeneratedCaseV2 } from './assemble-canonical-generated-case';
import type { GeneratorTaxonomyCatalogsV2 } from './case-generator-request-types';
import { generateOpenAiCaseDraftV2 } from './generate-openai-case-draft';
import type {
  CanonicalGeneratedCaseCoreV2,
  GenerationAssemblyContextV2,
} from './generation-assembly-types';
import type { TeachingCaseGenerationBriefV2 } from './teaching-brief-types';

export async function generateCanonicalOpenAiCaseV2(
  brief: TeachingCaseGenerationBriefV2,
  taxonomyCatalogs: GeneratorTaxonomyCatalogsV2,
  assemblyContext: GenerationAssemblyContextV2,
): Promise<CanonicalGeneratedCaseCoreV2> {
  const draft = await generateOpenAiCaseDraftV2(brief, taxonomyCatalogs);

  return assembleCanonicalGeneratedCaseV2(draft, assemblyContext);
}
