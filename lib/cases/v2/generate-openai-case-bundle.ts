import {
  assembleCanonicalGeneratedCaseV2,
  GENERATION_ASSEMBLER_VERSION,
} from './assemble-canonical-generated-case';
import {
  attachSpfaProtocolSetToGeneratedCaseCoreV2,
  SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
} from './attach-spfa-protocol-set';
import { buildGeneratedCaseBundleV2 } from './build-generated-case-bundle';
import type { GeneratorTaxonomyCatalogsV2 } from './case-generator-request-types';
import { generateOpenAiCaseDraftWithReceiptV2 } from './generate-openai-case-draft';
import type { GeneratedCaseBundleV2 } from './generated-case-bundle-types';
import type {
  CanonicalGeneratedCaseCoreV2,
  VersionedGenerationAssemblyContextV2,
} from './generation-assembly-types';
import type { TeachingCaseGenerationBriefV2 } from './teaching-brief-types';
import { validateSpfaProtocolSetClinicalContextV2 } from './validate-spfa-protocol-set';

export type SpfaProtocolSetResolverV2 = (
  core: CanonicalGeneratedCaseCoreV2,
) => unknown | Promise<unknown>;

export async function generateOpenAiCaseBundleV2(
  brief: TeachingCaseGenerationBriefV2,
  taxonomyCatalogs: GeneratorTaxonomyCatalogsV2,
  assemblyContext: VersionedGenerationAssemblyContextV2,
  resolveSpfaProtocolSet: SpfaProtocolSetResolverV2,
): Promise<GeneratedCaseBundleV2> {
  const generated = await generateOpenAiCaseDraftWithReceiptV2(
    brief,
    taxonomyCatalogs,
  );
  const core = assembleCanonicalGeneratedCaseV2(
    generated.draft,
    assemblyContext,
  );
  const resolverCore = validateSpfaProtocolSetClinicalContextV2(
    {
      caseVersionId: core.caseVersionId,
      patientFacts: core.patientFacts,
      evaluator: core.evaluator,
    },
    'spfaResolverCore',
  );
  const spfaProtocolSetInput = await resolveSpfaProtocolSet(resolverCore);
  const integratedCore = attachSpfaProtocolSetToGeneratedCaseCoreV2(
    core,
    spfaProtocolSetInput,
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
    spfaIntegrationVersion: SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
  };

  return buildGeneratedCaseBundleV2(brief, integratedCore, provenance);
}
