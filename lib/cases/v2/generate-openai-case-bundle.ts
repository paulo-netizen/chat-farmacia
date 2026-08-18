import {
  assembleCanonicalGeneratedCaseV2,
  GENERATION_ASSEMBLER_VERSION,
} from './assemble-canonical-generated-case';
import { buildGeneratedCaseBundleV2 } from './build-generated-case-bundle';
import type { GeneratorTaxonomyCatalogsV2 } from './case-generator-request-types';
import { generateOpenAiCaseDraftWithReceiptV2 } from './generate-openai-case-draft';
import type { GeneratedCaseBundleV2 } from './generated-case-bundle-types';
import type { VersionedGenerationAssemblyContextV2 } from './generation-assembly-types';
import type { TeachingCaseGenerationBriefV2 } from './teaching-brief-types';

export async function generateOpenAiCaseBundleV2(
  brief: TeachingCaseGenerationBriefV2,
  taxonomyCatalogs: GeneratorTaxonomyCatalogsV2,
  assemblyContext: VersionedGenerationAssemblyContextV2,
): Promise<GeneratedCaseBundleV2> {
  const generated = await generateOpenAiCaseDraftWithReceiptV2(
    brief,
    taxonomyCatalogs,
  );
  const core = assembleCanonicalGeneratedCaseV2(
    generated.draft,
    assemblyContext,
  );
  const provenance = {
    generatorContractVersion:
      generated.generation.generatorContractVersion,
    promptVersion: generated.generation.promptVersion,
    model: {
      provider: generated.generation.model.provider,
      identifier: generated.generation.model.identifier,
    },
    assemblerVersion: GENERATION_ASSEMBLER_VERSION,
    disclosurePolicyVersion: assemblyContext.disclosurePolicyVersion,
  };

  return buildGeneratedCaseBundleV2(brief, core, provenance);
}
