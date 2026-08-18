import type { AiGeneratedCaseDraftV2 } from './ai-generation-types';
import { buildCaseGeneratorRequestV2 } from './build-case-generator-request';
import type { GeneratorTaxonomyCatalogsV2 } from './case-generator-request-types';
import { executeOpenAiCaseGeneratorV2 } from './execute-openai-case-generator';
import { createOpenAiCaseGeneratorRuntimeV2 } from './openai-case-generator-runtime';
import type { TeachingCaseGenerationBriefV2 } from './teaching-brief-types';

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
