import type OpenAI from 'openai';
import type { RequestOptions } from 'openai/core';
import type {
  ParsedResponse,
  ResponseOutputRefusal,
  ResponseStatus,
} from 'openai/resources/responses/responses';

import { buildOpenAiPatientResponseValidatorParamsV2 } from './build-openai-patient-response-validator-params';
import type { PatientResponseValidationRequestV2 } from './patient-response-validation-context';
import type { PatientResponseValidationResultV2 } from './patient-response-safety-types';
import {
  type OpenAiPatientResponseValidationTransportV1,
  parseOpenAiPatientResponseValidationTransportV1,
} from './openai-patient-response-validator-transport';

export const OPENAI_PATIENT_RESPONSE_VALIDATOR_EXECUTION_LIMITS = Object.freeze({
  maxModelLength: 200,
  maxOutputTokens: 4096,
  maxTimeoutMs: 600_000,
});

export type OpenAiPatientResponseValidatorExecutionConfigV2 = Readonly<{
  model: string;
  maxOutputTokens: number;
  timeoutMs: number;
}>;

export type OpenAiPatientResponseValidatorClientV2 = Readonly<{
  responses: Pick<OpenAI['responses'], 'parse'>;
}>;

export type OpenAiPatientResponseValidatorUsageV2 = Readonly<{
  inputTokens: number;
  outputTokens: number;
}>;

export type OpenAiPatientResponseValidatorReceiptV2 = Readonly<{
  result: PatientResponseValidationResultV2;
  responseModel: string;
  usage?: OpenAiPatientResponseValidatorUsageV2;
}>;

export type OpenAiPatientResponseValidatorExecutionErrorCodeV2 =
  | 'invalid_openai_patient_response_validator_config'
  | 'openai_patient_response_validator_request_failed'
  | 'openai_patient_response_validator_response_failed'
  | 'openai_patient_response_validator_incomplete'
  | 'openai_patient_response_validator_refusal'
  | 'openai_patient_response_validator_unexpected_status'
  | 'openai_patient_response_validator_missing_output'
  | 'openai_patient_response_validator_invalid_output'
  | 'openai_patient_response_validator_invalid_response_metadata';

export type OpenAiPatientResponseValidatorExecutionErrorDetailsV2 = Readonly<{
  responseStatus?: ResponseStatus;
  incompleteReason?: 'max_output_tokens' | 'content_filter';
}>;

export class OpenAiPatientResponseValidatorExecutionErrorV2 extends Error {
  constructor(
    public readonly code: OpenAiPatientResponseValidatorExecutionErrorCodeV2,
    public readonly path: string,
    message: string,
    public readonly cause: unknown,
    public readonly details?: OpenAiPatientResponseValidatorExecutionErrorDetailsV2,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'OpenAiPatientResponseValidatorExecutionErrorV2';
  }
}

function configError(path: string): never {
  throw new OpenAiPatientResponseValidatorExecutionErrorV2(
    'invalid_openai_patient_response_validator_config',
    path,
    'the patient response validator configuration is invalid',
    new TypeError(path),
  );
}

function validateConfig(
  input: OpenAiPatientResponseValidatorExecutionConfigV2,
): OpenAiPatientResponseValidatorExecutionConfigV2 {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    configError('config');
  }
  const source = input as Record<string, unknown>;
  const allowed = new Set(['model', 'maxOutputTokens', 'timeoutMs']);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) configError(`config.${key}`);
  }
  if (
    typeof source.model !== 'string' ||
    source.model.length === 0 ||
    source.model.trim() !== source.model ||
    source.model.length >
      OPENAI_PATIENT_RESPONSE_VALIDATOR_EXECUTION_LIMITS.maxModelLength
  ) {
    configError('config.model');
  }
  if (
    typeof source.maxOutputTokens !== 'number' ||
    !Number.isInteger(source.maxOutputTokens) ||
    source.maxOutputTokens < 1 ||
    source.maxOutputTokens >
      OPENAI_PATIENT_RESPONSE_VALIDATOR_EXECUTION_LIMITS.maxOutputTokens
  ) {
    configError('config.maxOutputTokens');
  }
  if (
    typeof source.timeoutMs !== 'number' ||
    !Number.isInteger(source.timeoutMs) ||
    source.timeoutMs < 1 ||
    source.timeoutMs > OPENAI_PATIENT_RESPONSE_VALIDATOR_EXECUTION_LIMITS.maxTimeoutMs
  ) {
    configError('config.timeoutMs');
  }
  return {
    model: source.model,
    maxOutputTokens: source.maxOutputTokens,
    timeoutMs: source.timeoutMs,
  };
}

function executionError(
  code: Exclude<
    OpenAiPatientResponseValidatorExecutionErrorCodeV2,
    | 'invalid_openai_patient_response_validator_config'
    | 'openai_patient_response_validator_request_failed'
  >,
  path: string,
  message: string,
  cause?: unknown,
  details?: OpenAiPatientResponseValidatorExecutionErrorDetailsV2,
): never {
  throw new OpenAiPatientResponseValidatorExecutionErrorV2(
    code,
    path,
    message,
    cause ?? new Error(`${code} at ${path}`),
    details,
  );
}

function isRefusal(value: unknown): value is ResponseOutputRefusal {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const source = value as Record<string, unknown>;
  return source.type === 'refusal' && typeof source.refusal === 'string';
}

function containsRefusal(output: readonly unknown[]): boolean {
  for (const item of output) {
    if (isRefusal(item)) return true;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) continue;
    if (content.some((part) => isRefusal(part))) return true;
  }
  return false;
}

function validateResponseModel(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value ||
    value.length > OPENAI_PATIENT_RESPONSE_VALIDATOR_EXECUTION_LIMITS.maxModelLength
  ) {
    executionError(
      'openai_patient_response_validator_invalid_response_metadata',
      'response.model',
      'OpenAI returned invalid validator response metadata',
    );
  }
  return value;
}

function validateTokenCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    executionError(
      'openai_patient_response_validator_invalid_response_metadata',
      path,
      'OpenAI returned invalid validator response metadata',
    );
  }
  return value;
}

function copyUsage(value: unknown): OpenAiPatientResponseValidatorUsageV2 | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    executionError(
      'openai_patient_response_validator_invalid_response_metadata',
      'response.usage',
      'OpenAI returned invalid validator response metadata',
    );
  }
  const source = value as Record<string, unknown>;
  return {
    inputTokens: validateTokenCount(source.input_tokens, 'response.usage.input_tokens'),
    outputTokens: validateTokenCount(
      source.output_tokens,
      'response.usage.output_tokens',
    ),
  };
}

export async function executeOpenAiPatientResponseValidatorV2(
  client: OpenAiPatientResponseValidatorClientV2,
  request: PatientResponseValidationRequestV2,
  configInput: OpenAiPatientResponseValidatorExecutionConfigV2,
): Promise<OpenAiPatientResponseValidatorReceiptV2> {
  const config = validateConfig(configInput);
  const params = buildOpenAiPatientResponseValidatorParamsV2(request);
  const requestOptions: RequestOptions = {
    maxRetries: 0,
    timeout: config.timeoutMs,
  };

  let response: ParsedResponse<OpenAiPatientResponseValidationTransportV1>;
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
    throw new OpenAiPatientResponseValidatorExecutionErrorV2(
      'openai_patient_response_validator_request_failed',
      'client.responses.parse',
      'the patient response validator request failed',
      cause,
    );
  }

  if (
    response.status === 'failed' ||
    (response.error !== null && response.error !== undefined)
  ) {
    executionError(
      'openai_patient_response_validator_response_failed',
      'response',
      'OpenAI returned a failed validator response',
      response.error ?? undefined,
      response.status === undefined ? undefined : { responseStatus: response.status },
    );
  }

  if (
    response.status === 'incomplete' ||
    (response.incomplete_details !== null &&
      response.incomplete_details !== undefined)
  ) {
    executionError(
      'openai_patient_response_validator_incomplete',
      'response.incomplete_details',
      'OpenAI returned an incomplete validator response',
      response.incomplete_details ?? undefined,
      {
        ...(response.status === undefined ? {} : { responseStatus: response.status }),
        ...(response.incomplete_details?.reason === undefined
          ? {}
          : { incompleteReason: response.incomplete_details.reason }),
      },
    );
  }

  if (!Array.isArray(response.output)) {
    executionError(
      'openai_patient_response_validator_invalid_response_metadata',
      'response.output',
      'OpenAI returned invalid validator response metadata',
    );
  }
  if (containsRefusal(response.output)) {
    executionError(
      'openai_patient_response_validator_refusal',
      'response.output',
      'OpenAI refused the patient response validation request',
      undefined,
      response.status === undefined ? undefined : { responseStatus: response.status },
    );
  }

  if (
    response.status === 'queued' ||
    response.status === 'in_progress' ||
    response.status === 'cancelled'
  ) {
    executionError(
      'openai_patient_response_validator_unexpected_status',
      'response.status',
      'OpenAI returned a non-terminal validator status',
      undefined,
      { responseStatus: response.status },
    );
  }
  if (response.status !== 'completed') {
    executionError(
      'openai_patient_response_validator_invalid_response_metadata',
      'response.status',
      'OpenAI returned invalid validator response metadata',
    );
  }

  if (response.output_parsed === null || response.output_parsed === undefined) {
    executionError(
      'openai_patient_response_validator_missing_output',
      'response.output_parsed',
      'OpenAI did not return parsed validator output',
    );
  }

  let result: PatientResponseValidationResultV2;
  try {
    result = parseOpenAiPatientResponseValidationTransportV1(
      response.output_parsed,
    );
  } catch (cause) {
    executionError(
      'openai_patient_response_validator_invalid_output',
      'response.output_parsed',
      'OpenAI returned invalid patient response validation output',
      cause,
    );
  }

  return Object.freeze({
    result,
    responseModel: validateResponseModel(response.model),
    ...(response.usage === undefined || response.usage === null
      ? {}
      : { usage: copyUsage(response.usage) }),
  });
}
