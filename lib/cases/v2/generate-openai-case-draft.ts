import {
  AI_GENERATION_CONTRACT_VERSION,
  type AiGeneratedCaseDraftV2,
} from './ai-generation-types';
import {
  buildCaseGeneratorRequestV2,
  CASE_GENERATOR_PROMPT_VERSION,
} from './build-case-generator-request';
import type { GeneratorTaxonomyCatalogsV2 } from './case-generator-request-types';
import {
  executeOpenAiCaseGeneratorV2,
  executeOpenAiCaseGeneratorWithReceiptV2,
} from './execute-openai-case-generator';
import { createOpenAiCaseGeneratorRuntimeV2 } from './openai-case-generator-runtime';
import type { TeachingCaseGenerationBriefV2 } from './teaching-brief-types';

export type OpenAiCaseDraftGenerationResultV2 = Readonly<{
  draft: AiGeneratedCaseDraftV2;
  generation: Readonly<{
    generatorContractVersion: typeof AI_GENERATION_CONTRACT_VERSION;
    promptVersion: typeof CASE_GENERATOR_PROMPT_VERSION;
    model: Readonly<{
      provider: 'openai';
      identifier: string;
    }>;
  }>;
}>;

export async function generateOpenAiCaseDraftWithReceiptV2(
  brief: TeachingCaseGenerationBriefV2,
  taxonomyCatalogs: GeneratorTaxonomyCatalogsV2,
): Promise<OpenAiCaseDraftGenerationResultV2> {
  const request = buildCaseGeneratorRequestV2(brief, taxonomyCatalogs);
  const runtime = createOpenAiCaseGeneratorRuntimeV2();
  const execution = await executeOpenAiCaseGeneratorWithReceiptV2(
    runtime.client,
    request,
    runtime.config,
  );
  return Object.freeze({
    draft: execution.draft,
    generation: Object.freeze({
      generatorContractVersion: AI_GENERATION_CONTRACT_VERSION,
      promptVersion: CASE_GENERATOR_PROMPT_VERSION,
      model: Object.freeze({
        provider: 'openai' as const,
        identifier: execution.responseModel,
      }),
    }),
  });
}

export async function generateOpenAiCaseDraftV2(
  brief: TeachingCaseGenerationBriefV2,
  taxonomyCatalogs: GeneratorTaxonomyCatalogsV2,
): Promise<AiGeneratedCaseDraftV2> {
  const request = buildCaseGeneratorRequestV2(brief, taxonomyCatalogs);
  const runtime = createOpenAiCaseGeneratorRuntimeV2();
  return executeOpenAiCaseGeneratorV2(
    runtime.client,
    request,
    runtime.config,
  );
}
