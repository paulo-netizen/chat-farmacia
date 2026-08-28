export type PharmaceuticalD2SemanticAdjudicationErrorCodeV2 =
  | 'PROVIDER_FAILURE'
  | 'INVALID_PROVIDER_RESULT'
  | 'CONFIGURATION_ERROR'
  | 'INTERNAL_VALIDATION_ERROR';

export type PharmaceuticalD2SemanticAdjudicationErrorStageV2 =
  | 'CONFIGURATION'
  | 'REQUEST_BUILD'
  | 'PROVIDER_REQUEST'
  | 'PROVIDER_RESPONSE'
  | 'PROVIDER_RESULT_VALIDATION'
  | 'EXECUTION_METADATA'
  | 'GLOBAL_VALIDATION';

export class PharmaceuticalD2SemanticAdjudicationErrorV2 extends Error {
  constructor(
    public readonly code: PharmaceuticalD2SemanticAdjudicationErrorCodeV2,
    public readonly stage: PharmaceuticalD2SemanticAdjudicationErrorStageV2,
    public readonly path: string,
    message: string,
    cause?: unknown,
  ) {
    super(`${code} at ${stage}.${path}: ${message}`);
    this.name = 'PharmaceuticalD2SemanticAdjudicationErrorV2';
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

export function pharmaceuticalD2SemanticErrorV2(
  code: PharmaceuticalD2SemanticAdjudicationErrorCodeV2,
  stage: PharmaceuticalD2SemanticAdjudicationErrorStageV2,
  path: string,
  message: string,
  cause?: unknown,
): PharmaceuticalD2SemanticAdjudicationErrorV2 {
  return new PharmaceuticalD2SemanticAdjudicationErrorV2(
    code,
    stage,
    path,
    message,
    cause,
  );
}
