import type {
  PharmaceuticalD1SemanticBatchRequestV2,
  PharmaceuticalSemanticExecutionIdV2,
} from './pharmaceutical-d1-adjudication-types';

export type { PharmaceuticalSemanticModelV2 } from './pharmaceutical-semantic-model-policy';

// Preserve the existing default; Terra always requires explicit selection.
export const OPENAI_PHARMACEUTICAL_D1_CANDIDATE_MODEL =
  'gpt-5.6-sol' as const;

export type PharmaceuticalD1SemanticProviderReceiptV2 = Readonly<{
  providerResult: unknown;
  provider: 'openai';
  responseModel: string;
}>;

export type PharmaceuticalD1SemanticRuntimeV2 = Readonly<{
  adjudicateBatch: (
    request: PharmaceuticalD1SemanticBatchRequestV2,
  ) => Promise<PharmaceuticalD1SemanticProviderReceiptV2>;
}>;

export type AllocatePharmaceuticalSemanticExecutionIdV2 = (
  request: PharmaceuticalD1SemanticBatchRequestV2,
) => PharmaceuticalSemanticExecutionIdV2 | string;
