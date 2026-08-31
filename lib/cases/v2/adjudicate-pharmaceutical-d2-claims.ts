import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';
import {
  buildPharmaceuticalClinicalClaimFindingSetV2,
  validatePharmaceuticalClinicalClaimFindingSetV2,
} from './build-pharmaceutical-d2-claim-findings';
import {
  buildPharmaceuticalD2RelationalSemanticRequestV2,
  buildPharmaceuticalD2SemanticRequestV2,
} from './build-pharmaceutical-d2-semantic-request';
import {
  PHARMACEUTICAL_D2_PROVIDER_RESULT_CONTRACT_VERSION_V2,
  PHARMACEUTICAL_D2_CLAIM_PROMPT_VERSION_V3,
  type PharmaceuticalD2ProviderResultV2,
  type PharmaceuticalD2SemanticRequestV2,
} from './pharmaceutical-d2-claim-types';
import {
  type PharmaceuticalD2SafeErrorMetadataV2,
  PharmaceuticalD2SemanticAdjudicationErrorV2,
  pharmaceuticalD2SemanticErrorV2,
} from './pharmaceutical-d2-errors';
import type {
  AllocatePharmaceuticalD2SemanticExecutionIdV2,
  PharmaceuticalD2ClaimAdjudicationV2,
  PharmaceuticalD2SemanticExecutionMetadataV2,
  PharmaceuticalD2SemanticProviderReceiptV2,
  PharmaceuticalD2SemanticRuntimeV2,
} from './pharmaceutical-d2-semantic-runtime';
import { parsePharmaceuticalSemanticExecutionIdV2 } from './validate-pharmaceutical-d1-adjudication';
import { validatePharmaceuticalD2ProviderResultV2 } from './validate-pharmaceutical-d2-provider-result';

function runtimeReceipt(input: unknown): PharmaceuticalD2SemanticProviderReceiptV2 {
  const path = 'runtimeReceipt';
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw pharmaceuticalD2SemanticErrorV2(
      'PROVIDER_FAILURE',
      'PROVIDER_RESPONSE',
      path,
      'runtime must return a receipt object',
    );
  }
  const source = input as Record<string, unknown>;
  const keys = ['providerResult', 'provider', 'responseModel'] as const;
  const allowed = new Set(keys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key as typeof keys[number])) {
      throw pharmaceuticalD2SemanticErrorV2(
        'PROVIDER_FAILURE',
        'PROVIDER_RESPONSE',
        `${path}.${key}`,
        'unexpected runtime receipt property',
      );
    }
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      throw pharmaceuticalD2SemanticErrorV2(
        'PROVIDER_FAILURE',
        'PROVIDER_RESPONSE',
        `${path}.${key}`,
        'missing runtime receipt property',
      );
    }
  }
  if (source.provider !== 'openai') {
    throw pharmaceuticalD2SemanticErrorV2(
      'PROVIDER_FAILURE',
      'PROVIDER_RESPONSE',
      `${path}.provider`,
      'must identify the OpenAI provider boundary',
    );
  }
  if (
    typeof source.responseModel !== 'string' ||
    source.responseModel.length === 0 ||
    source.responseModel !== source.responseModel.trim()
  ) {
    throw pharmaceuticalD2SemanticErrorV2(
      'PROVIDER_FAILURE',
      'PROVIDER_RESPONSE',
      `${path}.responseModel`,
      'must be real non-empty response metadata',
    );
  }
  return {
    providerResult: source.providerResult,
    provider: 'openai',
    responseModel: source.responseModel,
  };
}

function providerValidationPath(cause: unknown): string {
  return typeof cause === 'object' &&
    cause !== null &&
    'path' in cause &&
    typeof cause.path === 'string'
    ? cause.path
    : 'providerResult';
}

function providerValidationMetadata(
  cause: unknown,
): PharmaceuticalD2SafeErrorMetadataV2 | undefined {
  if (
    typeof cause !== 'object' ||
    cause === null ||
    !('metadata' in cause) ||
    typeof cause.metadata !== 'object' ||
    cause.metadata === null ||
    Array.isArray(cause.metadata)
  ) {
    return undefined;
  }
  return Object.freeze({
    ...(cause.metadata as PharmaceuticalD2SafeErrorMetadataV2),
  });
}

function executionMetadata(
  request: PharmaceuticalD2SemanticRequestV2,
  receipt: PharmaceuticalD2SemanticProviderReceiptV2,
  allocateExecutionId: AllocatePharmaceuticalD2SemanticExecutionIdV2,
): PharmaceuticalD2SemanticExecutionMetadataV2 {
  let semanticExecutionRef: PharmaceuticalD2SemanticExecutionMetadataV2['semanticExecutionRef'];
  try {
    semanticExecutionRef = parsePharmaceuticalSemanticExecutionIdV2(
      allocateExecutionId(request),
      'semanticExecution.semanticExecutionRef',
    );
  } catch (cause) {
    throw pharmaceuticalD2SemanticErrorV2(
      'INTERNAL_VALIDATION_ERROR',
      'EXECUTION_METADATA',
      'semanticExecution.semanticExecutionRef',
      'server-owned D2 execution ID allocation failed',
      cause,
    );
  }
  return Object.freeze({
    semanticExecutionRef,
    lane: 'D2',
    provider: receipt.provider,
    responseModel: receipt.responseModel,
    promptVersion: request.promptVersion,
    policyVersion: request.policyVersion,
    requestFingerprint: structuredClone(request.requestFingerprint),
  });
}

function emptyProviderResult(): PharmaceuticalD2ProviderResultV2 {
  return {
    schemaVersion: '2.0',
    contractVersion: PHARMACEUTICAL_D2_PROVIDER_RESULT_CONTRACT_VERSION_V2,
    findings: [],
  };
}

export async function adjudicatePharmaceuticalD2ClaimsV2(
  context: PharmaceuticalAdjudicationContextSetV2,
  runtime: PharmaceuticalD2SemanticRuntimeV2,
  allocateExecutionId: AllocatePharmaceuticalD2SemanticExecutionIdV2,
  requestContractVersion: PharmaceuticalD2SemanticRequestV2['contractVersion'] = 'pharmaceutical-d2-semantic-request/1',
  promptVersion: string = PHARMACEUTICAL_D2_CLAIM_PROMPT_VERSION_V3,
): Promise<PharmaceuticalD2ClaimAdjudicationV2> {
  let request: PharmaceuticalD2SemanticRequestV2;
  try {
    switch (requestContractVersion) {
      case 'pharmaceutical-d2-semantic-request/1':
        request = buildPharmaceuticalD2SemanticRequestV2(context, promptVersion);
        break;
      case 'pharmaceutical-d2-semantic-request/2':
        request = buildPharmaceuticalD2RelationalSemanticRequestV2(context, promptVersion);
        break;
      default:
        throw new Error('unsupported D2 semantic request contract');
    }
  } catch (cause) {
    throw pharmaceuticalD2SemanticErrorV2(
      'INTERNAL_VALIDATION_ERROR',
      'REQUEST_BUILD',
      'context',
      'could not build the canonical D2 semantic request',
      cause,
    );
  }

  if (request.studentMessages.messages.length === 0) {
    const providerResult = emptyProviderResult();
    try {
      const findingSet = buildPharmaceuticalClinicalClaimFindingSetV2(
        request,
        providerResult,
      );
      return Object.freeze({ findingSet, executions: [] as const });
    } catch (cause) {
      throw pharmaceuticalD2SemanticErrorV2(
        'INTERNAL_VALIDATION_ERROR',
        'GLOBAL_VALIDATION',
        'findingSet',
        'could not construct the canonical empty D2 finding set',
        cause,
      );
    }
  }

  let rawReceipt: unknown;
  try {
    rawReceipt = await runtime.detectClaims(request);
  } catch (cause) {
    if (cause instanceof PharmaceuticalD2SemanticAdjudicationErrorV2) throw cause;
    throw pharmaceuticalD2SemanticErrorV2(
      'PROVIDER_FAILURE',
      'PROVIDER_REQUEST',
      'runtime.detectClaims',
      'semantic provider runtime failed',
      cause,
    );
  }
  const receipt = runtimeReceipt(rawReceipt);

  try {
    validatePharmaceuticalD2ProviderResultV2(
      receipt.providerResult,
      request,
    );
  } catch (cause) {
    throw pharmaceuticalD2SemanticErrorV2(
      'INVALID_PROVIDER_RESULT',
      'PROVIDER_RESULT_VALIDATION',
      providerValidationPath(cause),
      'provider result failed mandatory D2A authority validation',
      cause,
      providerValidationMetadata(cause),
    );
  }

  const execution = executionMetadata(request, receipt, allocateExecutionId);
  try {
    const findingSet = buildPharmaceuticalClinicalClaimFindingSetV2(
      request,
      receipt.providerResult,
    );
    const validatedFindingSet = validatePharmaceuticalClinicalClaimFindingSetV2(
      findingSet,
      request,
      receipt.providerResult,
    );
    return Object.freeze({
      findingSet: validatedFindingSet,
      executions: Object.freeze([execution]) as readonly [PharmaceuticalD2SemanticExecutionMetadataV2],
    });
  } catch (cause) {
    throw pharmaceuticalD2SemanticErrorV2(
      'INTERNAL_VALIDATION_ERROR',
      'GLOBAL_VALIDATION',
      'findingSet',
      'could not construct the canonical D2 finding set',
      cause,
    );
  }
}
