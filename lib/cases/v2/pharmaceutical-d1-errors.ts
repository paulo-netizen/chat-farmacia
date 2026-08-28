export type PharmaceuticalD1SemanticAdjudicationErrorCodeV2 =
  | 'PROVIDER_FAILURE'
  | 'INVALID_PROVIDER_RESULT'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_VALIDATION_ERROR';

export type PharmaceuticalD1SemanticAdjudicationErrorStageV2 =
  | 'CONFIGURATION'
  | 'REQUEST_BUILD'
  | 'PROVIDER_REQUEST'
  | 'PROVIDER_RESPONSE'
  | 'PROVIDER_RESULT_VALIDATION'
  | 'EXECUTION_METADATA'
  | 'GLOBAL_VALIDATION';

export class PharmaceuticalD1SemanticAdjudicationErrorV2 extends Error {
  constructor(
    public readonly code: PharmaceuticalD1SemanticAdjudicationErrorCodeV2,
    public readonly stage: PharmaceuticalD1SemanticAdjudicationErrorStageV2,
    public readonly path: string,
    message: string,
    cause?: unknown,
  ) {
    super(`${code} at ${stage}.${path}: ${message}`);
    this.name = 'PharmaceuticalD1SemanticAdjudicationErrorV2';
    if (cause !== undefined) {
      Object.defineProperty(this, 'cause', {
        configurable: true,
        enumerable: false,
        value: cause,
        writable: false,
      });
    }
  }
}

export function pharmaceuticalD1SemanticErrorV2(
  code: PharmaceuticalD1SemanticAdjudicationErrorCodeV2,
  stage: PharmaceuticalD1SemanticAdjudicationErrorStageV2,
  path: string,
  message: string,
  cause?: unknown,
): PharmaceuticalD1SemanticAdjudicationErrorV2 {
  return new PharmaceuticalD1SemanticAdjudicationErrorV2(
    code,
    stage,
    path,
    message,
    cause,
  );
}
