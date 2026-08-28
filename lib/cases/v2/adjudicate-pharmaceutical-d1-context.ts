import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';
import {
  buildPharmaceuticalD1SemanticBatchRequestsV2,
} from './build-pharmaceutical-d1-semantic-request';
import type {
  PharmaceuticalD1AcceptedSemanticBatchV2,
  PharmaceuticalD1SemanticBatchRequestV2,
  PharmaceuticalD1SemanticExecutionMetadataV2,
  PharmaceuticalTargetSemanticAdjudicationSetV2,
} from './pharmaceutical-d1-adjudication-types';
import {
  PharmaceuticalD1SemanticAdjudicationErrorV2,
  pharmaceuticalD1SemanticErrorV2,
} from './pharmaceutical-d1-errors';
import type {
  AllocatePharmaceuticalSemanticExecutionIdV2,
  PharmaceuticalD1SemanticProviderReceiptV2,
  PharmaceuticalD1SemanticRuntimeV2,
} from './pharmaceutical-d1-semantic-runtime';
import {
  buildPharmaceuticalD1AcceptedSemanticBatchV2,
  buildPharmaceuticalTargetSemanticAdjudicationSetV2,
  parsePharmaceuticalSemanticExecutionIdV2,
  validatePharmaceuticalTargetSemanticAdjudicationSetV2,
} from './validate-pharmaceutical-d1-adjudication';
import { validatePharmaceuticalD1ProviderBatchResultV1 } from './validate-pharmaceutical-d1-provider-result';

function runtimeReceipt(
  input: unknown,
  batchIndex: number,
): PharmaceuticalD1SemanticProviderReceiptV2 {
  const path = `batches[${batchIndex}].runtimeReceipt`;
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw pharmaceuticalD1SemanticErrorV2(
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
      throw pharmaceuticalD1SemanticErrorV2(
        'PROVIDER_FAILURE',
        'PROVIDER_RESPONSE',
        `${path}.${key}`,
        'unexpected runtime receipt property',
      );
    }
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      throw pharmaceuticalD1SemanticErrorV2(
        'PROVIDER_FAILURE',
        'PROVIDER_RESPONSE',
        `${path}.${key}`,
        'missing runtime receipt property',
      );
    }
  }
  if (source.provider !== 'openai') {
    throw pharmaceuticalD1SemanticErrorV2(
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
    throw pharmaceuticalD1SemanticErrorV2(
      'PROVIDER_FAILURE',
      'PROVIDER_RESPONSE',
      `${path}.responseModel`,
      'must be real non-empty response metadata',
    );
  }
  return {
    providerResult: source.providerResult as PharmaceuticalD1SemanticProviderReceiptV2['providerResult'],
    provider: 'openai',
    responseModel: source.responseModel,
  };
}

function executionMetadata(
  request: PharmaceuticalD1SemanticBatchRequestV2,
  receipt: PharmaceuticalD1SemanticProviderReceiptV2,
  allocateExecutionId: AllocatePharmaceuticalSemanticExecutionIdV2,
  usedExecutionIds: Set<string>,
  batchIndex: number,
): PharmaceuticalD1SemanticExecutionMetadataV2 {
  let semanticExecutionRef: PharmaceuticalD1SemanticExecutionMetadataV2['semanticExecutionRef'];
  try {
    semanticExecutionRef = parsePharmaceuticalSemanticExecutionIdV2(
      allocateExecutionId(request),
      `batches[${batchIndex}].semanticExecutionRef`,
    );
  } catch (cause) {
    throw pharmaceuticalD1SemanticErrorV2(
      'INTERNAL_VALIDATION_ERROR',
      'EXECUTION_METADATA',
      `batches[${batchIndex}].semanticExecutionRef`,
      'server-owned execution ID allocation failed',
      cause,
    );
  }
  if (usedExecutionIds.has(semanticExecutionRef)) {
    throw pharmaceuticalD1SemanticErrorV2(
      'INTERNAL_VALIDATION_ERROR',
      'EXECUTION_METADATA',
      `batches[${batchIndex}].semanticExecutionRef`,
      'server-owned execution ID must be unique per accepted batch',
    );
  }
  usedExecutionIds.add(semanticExecutionRef);
  return {
    semanticExecutionRef,
    lane: 'D1',
    provider: receipt.provider,
    responseModel: receipt.responseModel,
    promptVersion: request.promptVersion,
    requestFingerprint: structuredClone(request.requestFingerprint),
    includedTargetRefs: request.targets.map((target) => target.targetRef),
  };
}

export async function adjudicatePharmaceuticalD1ContextV2(
  context: PharmaceuticalAdjudicationContextSetV2,
  runtime: PharmaceuticalD1SemanticRuntimeV2,
  allocateExecutionId: AllocatePharmaceuticalSemanticExecutionIdV2,
): Promise<PharmaceuticalTargetSemanticAdjudicationSetV2> {
  let requests: readonly PharmaceuticalD1SemanticBatchRequestV2[];
  try {
    requests = buildPharmaceuticalD1SemanticBatchRequestsV2(context);
  } catch (cause) {
    throw pharmaceuticalD1SemanticErrorV2(
      'INTERNAL_VALIDATION_ERROR',
      'REQUEST_BUILD',
      'context',
      'could not build canonical D1 semantic requests',
      cause,
    );
  }

  const acceptedBatches: PharmaceuticalD1AcceptedSemanticBatchV2[] = [];
  const usedExecutionIds = new Set<string>();
  for (const [batchIndex, request] of requests.entries()) {
    let rawReceipt: unknown;
    try {
      rawReceipt = await runtime.adjudicateBatch(request);
    } catch (cause) {
      if (cause instanceof PharmaceuticalD1SemanticAdjudicationErrorV2) throw cause;
      throw pharmaceuticalD1SemanticErrorV2(
        'PROVIDER_FAILURE',
        'PROVIDER_REQUEST',
        `batches[${batchIndex}]`,
        'semantic provider runtime failed',
        cause,
      );
    }
    const receipt = runtimeReceipt(rawReceipt, batchIndex);

    let providerResult: ReturnType<typeof validatePharmaceuticalD1ProviderBatchResultV1>;
    try {
      providerResult = validatePharmaceuticalD1ProviderBatchResultV1(
        request,
        receipt.providerResult,
        context,
      );
    } catch (cause) {
      const path =
        typeof cause === 'object' &&
        cause !== null &&
        'path' in cause &&
        typeof cause.path === 'string'
          ? cause.path
          : `batches[${batchIndex}].providerResult`;
      throw pharmaceuticalD1SemanticErrorV2(
        'INVALID_PROVIDER_RESULT',
        'PROVIDER_RESULT_VALIDATION',
        path,
        'provider result failed mandatory D1A authority validation',
        cause,
      );
    }

    const execution = executionMetadata(
      request,
      receipt,
      allocateExecutionId,
      usedExecutionIds,
      batchIndex,
    );
    try {
      acceptedBatches.push(
        buildPharmaceuticalD1AcceptedSemanticBatchV2(
          request,
          providerResult,
          execution,
          context,
        ),
      );
    } catch (cause) {
      throw pharmaceuticalD1SemanticErrorV2(
        'INTERNAL_VALIDATION_ERROR',
        'EXECUTION_METADATA',
        `batches[${batchIndex}]`,
        'could not reconstruct the accepted canonical D1 batch',
        cause,
      );
    }
  }

  try {
    const result = buildPharmaceuticalTargetSemanticAdjudicationSetV2(
      context,
      acceptedBatches,
    );
    return validatePharmaceuticalTargetSemanticAdjudicationSetV2(
      result,
      context,
      acceptedBatches,
    );
  } catch (cause) {
    throw pharmaceuticalD1SemanticErrorV2(
      'INTERNAL_VALIDATION_ERROR',
      'GLOBAL_VALIDATION',
      'adjudicationSet',
      'could not construct the canonical global D1 adjudication set',
      cause,
    );
  }
}
