import type OpenAI from 'openai';
import type { RequestOptions } from 'openai/core';
import type {
  ParsedResponse,
  ResponseOutputRefusal,
  ResponseStatus,
} from 'openai/resources/responses/responses';

import {
  buildOpenAiSpfaSemanticAdjudicationParamsV1,
  SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
} from './build-openai-spfa-semantic-adjudication-params';
import type { BuildSpfaSemanticTargetContextInputV2 } from './build-spfa-semantic-target-context';
import { normalizeOpenAiSpfaSemanticAdjudicationTransportV1 } from './normalize-openai-spfa-semantic-adjudication';
import {
  OpenAiSpfaSemanticAdjudicationBoundaryErrorV1,
  type OpenAiSpfaSemanticAdjudicationTransportV1,
  parseOpenAiSpfaSemanticAdjudicationTransportV1,
} from './openai-spfa-semantic-adjudication-transport';
import type { SpfaSemanticAdjudicationV2 } from './spfa-semantic-adjudication-types';
import type { SpfaRequirementEvidenceBaselineV2 } from './spfa-evidence-baseline-types';
import { validateSpfaSemanticAdjudicationV2 } from './validate-spfa-semantic-adjudication';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';

export const OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS =
  Object.freeze({
    maxModelLength: 200,
    maxOutputTokens: 100_000,
    maxTimeoutMs: 600_000,
    maxRefusalExplanationLength: 500,
  });

export type OpenAiSpfaSemanticAdjudicationClientV1 = {
  readonly responses: Pick<OpenAI['responses'], 'parse'>;
};

export type OpenAiSpfaSemanticAdjudicationExecutionConfigV1 = Readonly<{
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
}>;

export type OpenAiSpfaSemanticAdjudicationExecutionReceiptV1 = Readonly<{
  adjudication: SpfaSemanticAdjudicationV2;
  provider: 'openai';
  responseModel: string;
  promptVersion: typeof SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION;
}>;

export type OpenAiSpfaSemanticAdjudicationExecutionErrorCodeV1 =
  | 'invalid_openai_spfa_semantic_execution_config'
  | 'openai_spfa_semantic_request_failed'
  | 'openai_spfa_semantic_response_failed'
  | 'openai_spfa_semantic_incomplete'
  | 'openai_spfa_semantic_refusal'
  | 'openai_spfa_semantic_unexpected_status'
  | 'openai_spfa_semantic_missing_parsed_output'
  | 'openai_spfa_semantic_invalid_transport'
  | 'openai_spfa_semantic_adjudication_validation_failed'
  | 'openai_spfa_semantic_invalid_response_metadata';

export type OpenAiSpfaSemanticAdjudicationExecutionErrorDetailsV1 = Readonly<{
  incompleteReason?: 'max_output_tokens' | 'content_filter';
  responseStatus?: ResponseStatus;
  refusalExplanation?: string;
}>;

export class OpenAiSpfaSemanticAdjudicationExecutionErrorV1 extends Error {
  constructor(
    public readonly code: OpenAiSpfaSemanticAdjudicationExecutionErrorCodeV1,
    public readonly path: string,
    message: string,
    public readonly cause: unknown,
    public readonly details?: OpenAiSpfaSemanticAdjudicationExecutionErrorDetailsV1,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'OpenAiSpfaSemanticAdjudicationExecutionErrorV1';
  }
}

function configError(path: string, message: string): never {
  throw new OpenAiSpfaSemanticAdjudicationExecutionErrorV1(
    'invalid_openai_spfa_semantic_execution_config',
    path,
    message,
    new TypeError(`${path}: ${message}`),
  );
}

function validateExecutionConfig(
  input: OpenAiSpfaSemanticAdjudicationExecutionConfigV1,
): OpenAiSpfaSemanticAdjudicationExecutionConfigV1 {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    configError('config', 'must be an object');
  }
  const source = input as Record<string, unknown>;
  const allowed = new Set(['model', 'maxOutputTokens', 'timeoutMs']);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) configError(`config.${key}`, 'unexpected property');
  }
  if (
    typeof source.model !== 'string' ||
    source.model.length === 0 ||
    source.model.trim() !== source.model ||
    source.model.length >
      OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS.maxModelLength
  ) {
    configError('config.model', 'must be a bounded non-empty trimmed string');
  }
  if (
    typeof source.maxOutputTokens !== 'number' ||
    !Number.isInteger(source.maxOutputTokens) ||
    source.maxOutputTokens < 1 ||
    source.maxOutputTokens >
      OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS.maxOutputTokens
  ) {
    configError(
      'config.maxOutputTokens',
      `must be an integer from 1 to ${OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS.maxOutputTokens}`,
    );
  }
  if (
    typeof source.timeoutMs !== 'number' ||
    !Number.isInteger(source.timeoutMs) ||
    source.timeoutMs < 1 ||
    source.timeoutMs >
      OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS.maxTimeoutMs
  ) {
    configError(
      'config.timeoutMs',
      `must be an integer from 1 to ${OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS.maxTimeoutMs}`,
    );
  }
  return {
    model: source.model,
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
    OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS.maxRefusalExplanationLength,
  );
}

function classifiedError(
  code: Exclude<
    OpenAiSpfaSemanticAdjudicationExecutionErrorCodeV1,
    | 'invalid_openai_spfa_semantic_execution_config'
    | 'openai_spfa_semantic_request_failed'
  >,
  path: string,
  message: string,
  details?: OpenAiSpfaSemanticAdjudicationExecutionErrorDetailsV1,
  cause?: unknown,
): never {
  throw new OpenAiSpfaSemanticAdjudicationExecutionErrorV1(
    code,
    path,
    message,
    cause ?? new Error(`${code} at ${path}`),
    details,
  );
}

function validateResponseModel(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value ||
    value.length >
      OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS.maxModelLength
  ) {
    classifiedError(
      'openai_spfa_semantic_invalid_response_metadata',
      'response.model',
      'OpenAI returned invalid response model metadata',
    );
  }
  return value;
}

function cloneBaseline(
  baseline: SpfaRequirementEvidenceBaselineV2,
): SpfaRequirementEvidenceBaselineV2 {
  return structuredClone(baseline);
}

async function executeInternal(
  client: OpenAiSpfaSemanticAdjudicationClientV1,
  input: BuildSpfaSemanticTargetContextInputV2,
  configInput: OpenAiSpfaSemanticAdjudicationExecutionConfigV1,
): Promise<OpenAiSpfaSemanticAdjudicationExecutionReceiptV1> {
  const config = validateExecutionConfig(configInput);
  const params = buildOpenAiSpfaSemanticAdjudicationParamsV1(input);
  const transcriptSnapshot = validateSessionTranscriptSnapshotV2(
    input.transcript,
    'input.transcript',
  );
  const baselineSnapshot = cloneBaseline(input.baseline);
  const requestOptions: RequestOptions = {
    maxRetries: 0,
    timeout: config.timeoutMs,
  };

  let response: ParsedResponse<OpenAiSpfaSemanticAdjudicationTransportV1>;
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
    throw new OpenAiSpfaSemanticAdjudicationExecutionErrorV1(
      'openai_spfa_semantic_request_failed',
      'client.responses.parse',
      'the OpenAI SPFA semantic adjudication request failed',
      cause,
    );
  }

  if (
    response.status === 'failed' ||
    (response.error !== null && response.error !== undefined)
  ) {
    classifiedError(
      'openai_spfa_semantic_response_failed',
      'response',
      'OpenAI returned a failed semantic adjudication response',
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
      'openai_spfa_semantic_incomplete',
      'response.incomplete_details',
      'OpenAI returned an incomplete semantic adjudication response',
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
      'openai_spfa_semantic_refusal',
      'response.output',
      'OpenAI refused semantic adjudication',
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
      'openai_spfa_semantic_unexpected_status',
      'response.status',
      'OpenAI returned an unexpected non-terminal status',
      { responseStatus: response.status },
    );
  }
  if (response.output_parsed === null || response.output_parsed === undefined) {
    classifiedError(
      'openai_spfa_semantic_missing_parsed_output',
      'response.output_parsed',
      'OpenAI did not return parsed semantic adjudication output',
      response.status === undefined ? undefined : { responseStatus: response.status },
    );
  }

  let transport: OpenAiSpfaSemanticAdjudicationTransportV1;
  try {
    transport = parseOpenAiSpfaSemanticAdjudicationTransportV1(
      response.output_parsed,
    );
  } catch (cause) {
    const path =
      cause instanceof OpenAiSpfaSemanticAdjudicationBoundaryErrorV1
        ? cause.path
        : 'response.output_parsed';
    classifiedError(
      'openai_spfa_semantic_invalid_transport',
      path,
      'OpenAI returned an invalid semantic adjudication transport',
      undefined,
      cause,
    );
  }

  const normalized = normalizeOpenAiSpfaSemanticAdjudicationTransportV1(
    transport,
    baselineSnapshot,
  );
  let adjudication: SpfaSemanticAdjudicationV2;
  try {
    adjudication = validateSpfaSemanticAdjudicationV2(normalized, {
      transcript: transcriptSnapshot,
      baseline: baselineSnapshot,
    });
  } catch (cause) {
    const path =
      typeof cause === 'object' &&
      cause !== null &&
      'path' in cause &&
      typeof cause.path === 'string'
        ? cause.path
        : 'adjudication';
    classifiedError(
      'openai_spfa_semantic_adjudication_validation_failed',
      path,
      'the provider transport failed mandatory D3A authority validation',
      undefined,
      cause,
    );
  }

  return Object.freeze({
    adjudication,
    provider: 'openai',
    responseModel: validateResponseModel(response.model),
    promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
  });
}

export async function executeOpenAiSpfaSemanticAdjudicationWithReceiptV1(
  client: OpenAiSpfaSemanticAdjudicationClientV1,
  input: BuildSpfaSemanticTargetContextInputV2,
  config: OpenAiSpfaSemanticAdjudicationExecutionConfigV1,
): Promise<OpenAiSpfaSemanticAdjudicationExecutionReceiptV1> {
  return executeInternal(client, input, config);
}

export async function executeOpenAiSpfaSemanticAdjudicationV1(
  client: OpenAiSpfaSemanticAdjudicationClientV1,
  input: BuildSpfaSemanticTargetContextInputV2,
  config: OpenAiSpfaSemanticAdjudicationExecutionConfigV1,
): Promise<SpfaSemanticAdjudicationV2> {
  const receipt = await executeInternal(client, input, config);
  return receipt.adjudication;
}
