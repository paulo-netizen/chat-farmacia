import OpenAI from 'openai';

import {
  OPENAI_CASE_GENERATOR_EXECUTION_LIMITS,
  type OpenAiCaseGeneratorClientV2,
  type OpenAiCaseGeneratorExecutionConfigV2,
} from './execute-openai-case-generator';

const DEFAULT_MAX_OUTPUT_TOKENS = 20_000;
const DEFAULT_TIMEOUT_MS = 180_000;
const POSITIVE_DECIMAL_INTEGER = /^[1-9]\d*$/;

export type OpenAiCaseGeneratorRuntimeErrorCode =
  | 'missing_openai_api_key'
  | 'invalid_openai_runtime_config';

export type OpenAiCaseGeneratorRuntimeEnvironmentVariable =
  | 'OPENAI_API_KEY'
  | 'OPENAI_CASE_GENERATOR_MODEL'
  | 'OPENAI_CASE_GENERATOR_MAX_OUTPUT_TOKENS'
  | 'OPENAI_CASE_GENERATOR_TIMEOUT_MS';

export class OpenAiCaseGeneratorRuntimeError extends Error {
  constructor(
    public readonly code: OpenAiCaseGeneratorRuntimeErrorCode,
    public readonly variableName: OpenAiCaseGeneratorRuntimeEnvironmentVariable,
    message: string,
  ) {
    super(`${code} at ${variableName}: ${message}`);
    this.name = 'OpenAiCaseGeneratorRuntimeError';
  }
}

export type OpenAiCaseGeneratorRuntimeV2 = {
  readonly client: OpenAiCaseGeneratorClientV2;
  readonly config: OpenAiCaseGeneratorExecutionConfigV2;
};

function fail(
  code: OpenAiCaseGeneratorRuntimeErrorCode,
  variableName: OpenAiCaseGeneratorRuntimeEnvironmentVariable,
  message: string,
): never {
  throw new OpenAiCaseGeneratorRuntimeError(code, variableName, message);
}

function readApiKey(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const apiKey = env.OPENAI_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    fail(
      'missing_openai_api_key',
      'OPENAI_API_KEY',
      'is required and must be a non-empty string',
    );
  }
  return apiKey.trim();
}

function readModel(
  env: Readonly<Record<string, string | undefined>>,
): string {
  const model = env.OPENAI_CASE_GENERATOR_MODEL;
  if (typeof model !== 'string' || model.trim().length === 0) {
    fail(
      'invalid_openai_runtime_config',
      'OPENAI_CASE_GENERATOR_MODEL',
      'is required and must be a non-empty string',
    );
  }
  const normalized = model.trim();
  if (normalized.length > OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxModelLength) {
    fail(
      'invalid_openai_runtime_config',
      'OPENAI_CASE_GENERATOR_MODEL',
      `must contain at most ${OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxModelLength} characters`,
    );
  }
  return normalized;
}

function readPositiveDecimalInteger(
  env: Readonly<Record<string, string | undefined>>,
  variableName:
    | 'OPENAI_CASE_GENERATOR_MAX_OUTPUT_TOKENS'
    | 'OPENAI_CASE_GENERATOR_TIMEOUT_MS',
  defaultValue: number,
  maximum: number,
): number {
  const value = env[variableName];
  if (value === undefined) return defaultValue;
  if (!POSITIVE_DECIMAL_INTEGER.test(value)) {
    fail(
      'invalid_openai_runtime_config',
      variableName,
      'must be a strict positive decimal integer',
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    fail(
      'invalid_openai_runtime_config',
      variableName,
      `must not exceed ${maximum}`,
    );
  }
  return parsed;
}

export function createOpenAiCaseGeneratorRuntimeV2(
  env: Readonly<Record<string, string | undefined>> = process.env,
): OpenAiCaseGeneratorRuntimeV2 {
  const apiKey = readApiKey(env);
  const config = Object.freeze({
    model: readModel(env),
    maxOutputTokens: readPositiveDecimalInteger(
      env,
      'OPENAI_CASE_GENERATOR_MAX_OUTPUT_TOKENS',
      DEFAULT_MAX_OUTPUT_TOKENS,
      OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxOutputTokens,
    ),
    timeoutMs: readPositiveDecimalInteger(
      env,
      'OPENAI_CASE_GENERATOR_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
      OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxTimeoutMs,
    ),
  }) satisfies OpenAiCaseGeneratorExecutionConfigV2;
  const client = new OpenAI({ apiKey });

  return Object.freeze({ client, config });
}
