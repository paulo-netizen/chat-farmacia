import type OpenAI from 'openai';
import type { RequestOptions } from 'openai/core';
import type {
  ParsedResponse,
  ResponseOutputRefusal,
  ResponseStatus,
} from 'openai/resources/responses/responses';

import type { PharmaceuticalD1SemanticBatchRequestV2 } from './pharmaceutical-d1-adjudication-types';
import {
  PharmaceuticalD1SemanticAdjudicationErrorV2,
  pharmaceuticalD1SemanticErrorV2,
} from './pharmaceutical-d1-errors';
import {
  buildOpenAiPharmaceuticalD1SemanticParamsV1,
} from './pharmaceutical-d1-prompt';
import {
  OPENAI_PHARMACEUTICAL_D1_CANDIDATE_MODEL,
  type PharmaceuticalD1SemanticProviderReceiptV2,
} from './pharmaceutical-d1-semantic-runtime';
import { PHARMACEUTICAL_D1_PROVIDER_BATCH_RESULT_SCHEMA_V1 } from './validate-pharmaceutical-d1-provider-result';

export const OPENAI_PHARMACEUTICAL_D1_EXECUTION_LIMITS = Object.freeze({
  maxOutputTokens: 100_000,
  maxTimeoutMs: 600_000,
  maxResponseModelLength: 200,
});

export type OpenAiPharmaceuticalD1SemanticClientV1 = Readonly<{
  responses: Pick<OpenAI['responses'], 'parse'>;
}>;

export type OpenAiPharmaceuticalD1SemanticExecutionConfigV1 = Readonly<{
  model: typeof OPENAI_PHARMACEUTICAL_D1_CANDIDATE_MODEL;
  maxOutputTokens: number;
  timeoutMs: number;
}>;

function configFailure(path: string, message: string): never {
  throw pharmaceuticalD1SemanticErrorV2(
    'CONFIGURATION_ERROR',
    'CONFIGURATION',
    path,
    message,
  );
}

function validateConfig(
  input: OpenAiPharmaceuticalD1SemanticExecutionConfigV1,
): OpenAiPharmaceuticalD1SemanticExecutionConfigV1 {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    configFailure('config', 'must be an object');
  }
  const source = input as Record<string, unknown>;
  const allowed = new Set(['model', 'maxOutputTokens', 'timeoutMs']);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) configFailure(`config.${key}`, 'unexpected property');
  }
  if (source.model !== OPENAI_PHARMACEUTICAL_D1_CANDIDATE_MODEL) {
    configFailure(
      'config.model',
      `must be exactly ${OPENAI_PHARMACEUTICAL_D1_CANDIDATE_MODEL}`,
    );
  }
  if (
    typeof source.maxOutputTokens !== 'number' ||
    !Number.isInteger(source.maxOutputTokens) ||
    source.maxOutputTokens < 1 ||
    source.maxOutputTokens > OPENAI_PHARMACEUTICAL_D1_EXECUTION_LIMITS.maxOutputTokens
  ) {
    configFailure(
      'config.maxOutputTokens',
      `must be an integer from 1 to ${OPENAI_PHARMACEUTICAL_D1_EXECUTION_LIMITS.maxOutputTokens}`,
    );
  }
  if (
    typeof source.timeoutMs !== 'number' ||
    !Number.isInteger(source.timeoutMs) ||
    source.timeoutMs < 1 ||
    source.timeoutMs > OPENAI_PHARMACEUTICAL_D1_EXECUTION_LIMITS.maxTimeoutMs
  ) {
    configFailure(
      'config.timeoutMs',
      `must be an integer from 1 to ${OPENAI_PHARMACEUTICAL_D1_EXECUTION_LIMITS.maxTimeoutMs}`,
    );
  }
  return {
    model: OPENAI_PHARMACEUTICAL_D1_CANDIDATE_MODEL,
    maxOutputTokens: source.maxOutputTokens,
    timeoutMs: source.timeoutMs,
  };
}

function isRefusal(value: unknown): value is ResponseOutputRefusal {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  return source.type === 'refusal' && typeof source.refusal === 'string';
}

function findRefusal(output: readonly unknown[]): ResponseOutputRefusal | undefined {
  for (const item of output) {
    if (isRefusal(item)) return item;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (isRefusal(part)) return part;
    }
  }
  return undefined;
}

function providerFailure(
  path: string,
  message: string,
  cause?: unknown,
): never {
  throw pharmaceuticalD1SemanticErrorV2(
    'PROVIDER_FAILURE',
    'PROVIDER_RESPONSE',
    path,
    message,
    cause,
  );
}

function responseModel(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    value.length > OPENAI_PHARMACEUTICAL_D1_EXECUTION_LIMITS.maxResponseModelLength
  ) {
    providerFailure('response.model', 'provider returned invalid model metadata');
  }
  return value;
}

export async function executeOpenAiPharmaceuticalD1SemanticBatchV1(
  client: OpenAiPharmaceuticalD1SemanticClientV1,
  request: PharmaceuticalD1SemanticBatchRequestV2,
  configInput: OpenAiPharmaceuticalD1SemanticExecutionConfigV1,
): Promise<PharmaceuticalD1SemanticProviderReceiptV2> {
  const config = validateConfig(configInput);
  let params: ReturnType<typeof buildOpenAiPharmaceuticalD1SemanticParamsV1>;
  try {
    params = buildOpenAiPharmaceuticalD1SemanticParamsV1(request);
  } catch (cause) {
    throw pharmaceuticalD1SemanticErrorV2(
      'INTERNAL_VALIDATION_ERROR',
      'REQUEST_BUILD',
      'semanticRequest',
      'could not build the canonical OpenAI D1 request',
      cause,
    );
  }

  const requestOptions: RequestOptions = {
    maxRetries: 0,
    timeout: config.timeoutMs,
  };
  let response: ParsedResponse<unknown>;
  try {
    response = await client.responses.parse(
      {
        ...params,
        model: config.model,
        max_output_tokens: config.maxOutputTokens,
        store: false,
      },
      requestOptions,
    );
  } catch (cause) {
    if (cause instanceof PharmaceuticalD1SemanticAdjudicationErrorV2) throw cause;
    throw pharmaceuticalD1SemanticErrorV2(
      'PROVIDER_FAILURE',
      'PROVIDER_REQUEST',
      'client.responses.parse',
      'OpenAI D1 semantic adjudication request failed',
      cause,
    );
  }

  if (
    response.status === 'failed' ||
    (response.error !== null && response.error !== undefined)
  ) {
    providerFailure(
      'response',
      'provider returned a failed response',
      response.error ?? undefined,
    );
  }
  if (
    response.status === 'incomplete' ||
    (response.incomplete_details !== null && response.incomplete_details !== undefined)
  ) {
    providerFailure(
      'response.incomplete_details',
      'provider returned an incomplete response',
      response.incomplete_details ?? undefined,
    );
  }
  if (findRefusal(response.output) !== undefined) {
    providerFailure('response.output', 'provider refused D1 semantic adjudication');
  }
  if (
    (['queued', 'in_progress', 'cancelled'] as ResponseStatus[]).includes(
      response.status as ResponseStatus,
    )
  ) {
    providerFailure('response.status', 'provider returned a non-terminal response status');
  }
  if (response.output_parsed === null || response.output_parsed === undefined) {
    providerFailure('response.output_parsed', 'provider returned no parsed output');
  }

  const parsed = PHARMACEUTICAL_D1_PROVIDER_BATCH_RESULT_SCHEMA_V1.safeParse(
    response.output_parsed,
  );
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue === undefined || issue.path.length === 0
      ? 'response.output_parsed'
      : `response.output_parsed.${issue.path.join('.')}`;
    throw pharmaceuticalD1SemanticErrorV2(
      'INVALID_PROVIDER_RESULT',
      'PROVIDER_RESULT_VALIDATION',
      path,
      'provider output does not match the strict D1 contract',
      parsed.error,
    );
  }

  return Object.freeze({
    providerResult: structuredClone(parsed.data),
    provider: 'openai',
    responseModel: responseModel(response.model),
  });
}
