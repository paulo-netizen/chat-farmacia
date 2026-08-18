import type { GeneratorRequestV2 } from './case-generator-request-types';
import {
  OPENAI_CASE_GENERATOR_TEXT_FORMAT_V1,
  OpenAiCaseGeneratorBoundaryError,
} from './openai-case-generator-transport';

export type OpenAiCaseGeneratorParamsV2 = {
  readonly instructions: string;
  readonly input: string;
  readonly text: {
    readonly format: typeof OPENAI_CASE_GENERATOR_TEXT_FORMAT_V1;
  };
};

export function buildOpenAiCaseGeneratorParamsV2(
  request: GeneratorRequestV2,
): OpenAiCaseGeneratorParamsV2 {
  try {
    return {
      instructions: request.instructions,
      input: JSON.stringify({
        requestContractVersion: request.contractVersion,
        input: request.input,
        expectedOutputContract: request.expectedOutputContract,
      }),
      text: { format: OPENAI_CASE_GENERATOR_TEXT_FORMAT_V1 },
    };
  } catch (cause) {
    throw new OpenAiCaseGeneratorBoundaryError(
      'openai_params_build_failed',
      'generatorRequest',
      'could not build model-independent OpenAI parameters',
      cause,
    );
  }
}
