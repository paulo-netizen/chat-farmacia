import type OpenAI from 'openai';
import type { RequestOptions } from 'openai/core';
import type {
  ParsedResponse,
  ResponseOutputRefusal,
  ResponseStatus,
} from 'openai/resources/responses/responses';

import type { AiGeneratedCaseDraftV2 } from './ai-generation-types';
import { buildOpenAiCaseGeneratorParamsV2 } from './build-openai-case-generator-params';
import type { GeneratorRequestV2 } from './case-generator-request-types';
import {
  type OpenAiGeneratedCaseDraftTransportV1,
  validateOpenAiGeneratedCaseDraftTransportV1,
} from './openai-case-generator-transport';

export const OPENAI_CASE_GENERATOR_EXECUTION_LIMITS = Object.freeze({
  maxModelLength: 200,
  maxOutputTokens: 100_000,
  maxTimeoutMs: 600_000,
  maxRefusalExplanationLength: 500,
});

export type OpenAiCaseGeneratorExecutionConfigV2 = {
  readonly model: string;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
};

export type OpenAiCaseGeneratorClientV2 = {
  readonly responses: Pick<OpenAI['responses'], 'parse'>;
};

export type OpenAiCaseGeneratorExecutionReceiptV2 = Readonly<{
  draft: AiGeneratedCaseDraftV2;
  responseModel: string;
}>;

type OpenAiCaseGeneratorInternalExecutionV2 = Readonly<{
  draft: AiGeneratedCaseDraftV2;
  responseModel: unknown;
}>;

export type OpenAiCaseGeneratorExecutionErrorCode =
  | 'invalid_openai_execution_config'
  | 'openai_request_failed'
  | 'openai_response_failed'
  | 'openai_incomplete'
  | 'openai_refusal'
  | 'openai_unexpected_status'
  | 'openai_missing_parsed_output'
  | 'openai_invalid_response_metadata';

export type OpenAiCaseGeneratorExecutionErrorDetails = {
  readonly incompleteReason?: 'max_output_tokens' | 'content_filter';
  readonly responseStatus?: ResponseStatus;
  readonly refusalExplanation?: string;
};

export class OpenAiCaseGeneratorExecutionError extends Error {
  constructor(
    public readonly code: OpenAiCaseGeneratorExecutionErrorCode,
    public readonly path: string,
    message: string,
    public readonly cause: unknown,
    public readonly details?: OpenAiCaseGeneratorExecutionErrorDetails,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'OpenAiCaseGeneratorExecutionError';
  }
}

function configError(path: string, message: string): never {
  throw new OpenAiCaseGeneratorExecutionError(
    'invalid_openai_execution_config',
    path,
    message,
    new TypeError(`${path}: ${message}`),
  );
}

function validateExecutionConfig(
  input: OpenAiCaseGeneratorExecutionConfigV2,
): OpenAiCaseGeneratorExecutionConfigV2 {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    configError('config', 'must be an object');
  }
  const source = input as Record<string, unknown>;
  const allowed = new Set(['model', 'maxOutputTokens', 'timeoutMs']);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) configError(`config.${key}`, 'unexpected property');
  }

  if (typeof source.model !== 'string' || source.model.trim().length === 0) {
    configError('config.model', 'must be a non-empty string');
  }
  const model = source.model.trim();
  if (model.length > OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxModelLength) {
    configError(
      'config.model',
      `must contain at most ${OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxModelLength} characters`,
    );
  }
  if (
    typeof source.maxOutputTokens !== 'number' ||
    !Number.isInteger(source.maxOutputTokens) ||
    source.maxOutputTokens < 1 ||
    source.maxOutputTokens > OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxOutputTokens
  ) {
    configError(
      'config.maxOutputTokens',
      `must be an integer from 1 to ${OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxOutputTokens}`,
    );
  }
  if (
    typeof source.timeoutMs !== 'number' ||
    !Number.isInteger(source.timeoutMs) ||
    source.timeoutMs < 1 ||
    source.timeoutMs > OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxTimeoutMs
  ) {
    configError(
      'config.timeoutMs',
      `must be an integer from 1 to ${OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxTimeoutMs}`,
    );
  }
  return {
    model,
    maxOutputTokens: source.maxOutputTokens,
    timeoutMs: source.timeoutMs,
  };
}

function isRefusal(value: unknown): value is ResponseOutputRefusal {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
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

function safeRefusalExplanation(refusal: string): string | undefined {
  const normalized = refusal.trim();
  if (normalized.length === 0) return undefined;
  return normalized.slice(
    0,
    OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxRefusalExplanationLength,
  );
}

function classifiedError(
  code: Exclude<
    OpenAiCaseGeneratorExecutionErrorCode,
    'invalid_openai_execution_config' | 'openai_request_failed'
  >,
  path: string,
  message: string,
  details?: OpenAiCaseGeneratorExecutionErrorDetails,
  cause?: unknown,
): never {
  throw new OpenAiCaseGeneratorExecutionError(
    code,
    path,
    message,
    cause ?? new Error(`${code} at ${path}`),
    details,
  );
}

function validateResponseModel(responseModel: unknown): string {
  if (
    typeof responseModel !== 'string' ||
    responseModel.length === 0 ||
    responseModel.trim() !== responseModel ||
    responseModel.length > OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxModelLength
  ) {
    classifiedError(
      'openai_invalid_response_metadata',
      'response.model',
      'OpenAI returned invalid response model metadata',
    );
  }
  return responseModel;
}

async function executeOpenAiCaseGeneratorInternalV2(
  client: OpenAiCaseGeneratorClientV2,
  request: GeneratorRequestV2,
  configInput: OpenAiCaseGeneratorExecutionConfigV2,
): Promise<OpenAiCaseGeneratorInternalExecutionV2> {
  const config = validateExecutionConfig(configInput);
  const params = buildOpenAiCaseGeneratorParamsV2(request);
  const requestOptions: RequestOptions = {
    maxRetries: 0,
    timeout: config.timeoutMs,
  };

  let response: ParsedResponse<OpenAiGeneratedCaseDraftTransportV1>;
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
    throw new OpenAiCaseGeneratorExecutionError(
      'openai_request_failed',
      'client.responses.parse',
      'the OpenAI request failed',
      cause,
    );
  }

  if (
    response.status === 'failed' ||
    (response.error !== null && response.error !== undefined)
  ) {
    classifiedError(
      'openai_response_failed',
      'response',
      'OpenAI returned a failed response',
      response.status === undefined ? undefined : { responseStatus: response.status },
      response.error ?? undefined,
    );
  }

  if (
    response.status === 'incomplete' ||
    (response.incomplete_details !== null &&
      response.incomplete_details !== undefined)
  ) {
    const incompleteReason = response.incomplete_details?.reason;
    classifiedError(
      'openai_incomplete',
      'response.incomplete_details',
      'OpenAI returned an incomplete response',
      {
        ...(incompleteReason === undefined ? {} : { incompleteReason }),
        ...(response.status === undefined
          ? {}
          : { responseStatus: response.status }),
      },
      response.incomplete_details ?? undefined,
    );
  }

  const refusal = findRefusal(response.output);
  if (refusal !== undefined) {
    const refusalExplanation = safeRefusalExplanation(refusal.refusal);
    classifiedError(
      'openai_refusal',
      'response.output',
      'OpenAI refused to generate the case',
      {
        ...(refusalExplanation === undefined ? {} : { refusalExplanation }),
        ...(response.status === undefined
          ? {}
          : { responseStatus: response.status }),
      },
    );
  }

  if (
    response.status === 'queued' ||
    response.status === 'in_progress' ||
    response.status === 'cancelled'
  ) {
    classifiedError(
      'openai_unexpected_status',
      'response.status',
      'OpenAI returned an unexpected non-terminal status',
      { responseStatus: response.status },
    );
  }

  if (response.output_parsed === null || response.output_parsed === undefined) {
    classifiedError(
      'openai_missing_parsed_output',
      'response.output_parsed',
      'OpenAI did not return parsed structured output',
      response.status === undefined ? undefined : { responseStatus: response.status },
    );
  }

  const draft = validateOpenAiGeneratedCaseDraftTransportV1(
    response.output_parsed,
  );
  return Object.freeze({ draft, responseModel: response.model });
}

export async function executeOpenAiCaseGeneratorWithReceiptV2(
  client: OpenAiCaseGeneratorClientV2,
  request: GeneratorRequestV2,
  configInput: OpenAiCaseGeneratorExecutionConfigV2,
): Promise<OpenAiCaseGeneratorExecutionReceiptV2> {
  const execution = await executeOpenAiCaseGeneratorInternalV2(
    client,
    request,
    configInput,
  );
  return Object.freeze({
    draft: execution.draft,
    responseModel: validateResponseModel(execution.responseModel),
  });
}

export async function executeOpenAiCaseGeneratorV2(
  client: OpenAiCaseGeneratorClientV2,
  request: GeneratorRequestV2,
  configInput: OpenAiCaseGeneratorExecutionConfigV2,
): Promise<AiGeneratedCaseDraftV2> {
  const execution = await executeOpenAiCaseGeneratorInternalV2(
    client,
    request,
    configInput,
  );
  return execution.draft;
}
