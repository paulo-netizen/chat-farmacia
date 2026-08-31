import type { PharmaceuticalSemanticExecutionIdV2 } from './pharmaceutical-d1-adjudication-types';
import type {
  PharmaceuticalClinicalClaimFindingSetV2,
  PharmaceuticalD2SemanticRequestFingerprintV1,
  PharmaceuticalD2SemanticRequestV2,
} from './pharmaceutical-d2-claim-types';

export type { PharmaceuticalSemanticModelV2 } from './pharmaceutical-semantic-model-policy';

// Preserve the existing default; Terra always requires explicit selection.
export const OPENAI_PHARMACEUTICAL_D2_CANDIDATE_MODEL =
  'gpt-5.6-sol' as const;

export type PharmaceuticalD2SemanticProviderReceiptV2 = Readonly<{
  providerResult: unknown;
  provider: 'openai';
  responseModel: string;
}>;

export type PharmaceuticalD2SemanticRuntimeV2 = Readonly<{
  detectClaims: (
    request: PharmaceuticalD2SemanticRequestV2,
  ) => Promise<PharmaceuticalD2SemanticProviderReceiptV2>;
}>;

export type AllocatePharmaceuticalD2SemanticExecutionIdV2 = (
  request: PharmaceuticalD2SemanticRequestV2,
) => PharmaceuticalSemanticExecutionIdV2 | string;

export type PharmaceuticalD2SemanticExecutionMetadataV2 = Readonly<{
  semanticExecutionRef: PharmaceuticalSemanticExecutionIdV2;
  lane: 'D2';
  provider: 'openai';
  responseModel: string;
  promptVersion: string;
  policyVersion: string;
  requestFingerprint: PharmaceuticalD2SemanticRequestFingerprintV1;
}>;

export type PharmaceuticalD2ClaimAdjudicationV2 = Readonly<{
  findingSet: PharmaceuticalClinicalClaimFindingSetV2;
  executions:
    | readonly []
    | readonly [PharmaceuticalD2SemanticExecutionMetadataV2];
}>;
