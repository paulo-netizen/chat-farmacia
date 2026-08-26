import OpenAI from 'openai';

import type { AdjudicateSpfaRequirementV2 } from './evaluate-spfa-session';
import {
  executeOpenAiSpfaSemanticAdjudicationWithReceiptV1,
  OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS,
  type OpenAiSpfaSemanticAdjudicationClientV1,
  type OpenAiSpfaSemanticAdjudicationExecutionConfigV1,
} from './execute-openai-spfa-semantic-adjudication';

export const OPENAI_SPFA_SEMANTIC_PRODUCTION_MODEL = 'gpt-5.6-sol' as const;

const DEFAULT_MAX_OUTPUT_TOKENS = 2_000;
const DEFAULT_TIMEOUT_MS = 60_000;
const POSITIVE_DECIMAL_INTEGER = /^[1-9]\d*$/;

export type OpenAiSpfaSemanticAdjudicationRuntimeErrorCodeV2 =
  | 'missing_openai_api_key'
  | 'invalid_openai_spfa_semantic_runtime_config'
  | 'openai_spfa_semantic_client_initialization_failed';

export type OpenAiSpfaSemanticAdjudicationRuntimeEnvironmentVariableV2 =
  | 'OPENAI_API_KEY'
  | 'OPENAI_SPFA_SEMANTIC_MODEL'
  | 'OPENAI_SPFA_SEMANTIC_MAX_OUTPUT_TOKENS'
  | 'OPENAI_SPFA_SEMANTIC_TIMEOUT_MS';

export class OpenAiSpfaSemanticAdjudicationRuntimeErrorV2 extends Error {
  constructor(
    public readonly code: OpenAiSpfaSemanticAdjudicationRuntimeErrorCodeV2,
    public readonly variableName:
      OpenAiSpfaSemanticAdjudicationRuntimeEnvironmentVariableV2,
    message: string,
    cause?: unknown,
  ) {
    super(`${code} at ${variableName}: ${message}`);
    this.name = 'OpenAiSpfaSemanticAdjudicationRuntimeErrorV2';
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

export type OpenAiSpfaSemanticAdjudicationRuntimeV2 = Readonly<{
  adjudicate: AdjudicateSpfaRequirementV2;
}>;

export type OpenAiSpfaSemanticAdjudicationRuntimeDependenciesV2 = Readonly<{
  createClient: (
    apiKey: string,
  ) => OpenAiSpfaSemanticAdjudicationClientV1;
  execute: typeof executeOpenAiSpfaSemanticAdjudicationWithReceiptV1;
}>;

const DEFAULT_DEPENDENCIES: OpenAiSpfaSemanticAdjudicationRuntimeDependenciesV2 =
  Object.freeze({
    createClient: (apiKey: string) => new OpenAI({ apiKey }),
    execute: executeOpenAiSpfaSemanticAdjudicationWithReceiptV1,
  });

function fail(
  code: OpenAiSpfaSemanticAdjudicationRuntimeErrorCodeV2,
  variableName: OpenAiSpfaSemanticAdjudicationRuntimeEnvironmentVariableV2,
  message: string,
  cause?: unknown,
): never {
  throw new OpenAiSpfaSemanticAdjudicationRuntimeErrorV2(
    code,
    variableName,
    message,
    cause,
  );
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

function readProductionModel(
  env: Readonly<Record<string, string | undefined>>,
): typeof OPENAI_SPFA_SEMANTIC_PRODUCTION_MODEL {
  const model = env.OPENAI_SPFA_SEMANTIC_MODEL;
  if (
    typeof model !== 'string' ||
    model.trim() !== OPENAI_SPFA_SEMANTIC_PRODUCTION_MODEL
  ) {
    fail(
      'invalid_openai_spfa_semantic_runtime_config',
      'OPENAI_SPFA_SEMANTIC_MODEL',
      'must be the accepted production model',
    );
  }
  return OPENAI_SPFA_SEMANTIC_PRODUCTION_MODEL;
}

function readPositiveDecimalInteger(
  env: Readonly<Record<string, string | undefined>>,
  variableName:
    | 'OPENAI_SPFA_SEMANTIC_MAX_OUTPUT_TOKENS'
    | 'OPENAI_SPFA_SEMANTIC_TIMEOUT_MS',
  defaultValue: number,
  maximum: number,
): number {
  const value = env[variableName];
  if (value === undefined) return defaultValue;
  if (!POSITIVE_DECIMAL_INTEGER.test(value)) {
    fail(
      'invalid_openai_spfa_semantic_runtime_config',
      variableName,
      'must be a strict positive decimal integer',
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    fail(
      'invalid_openai_spfa_semantic_runtime_config',
      variableName,
      `must not exceed ${maximum}`,
    );
  }
  return parsed;
}

function readConfig(
  env: Readonly<Record<string, string | undefined>>,
): OpenAiSpfaSemanticAdjudicationExecutionConfigV1 {
  return Object.freeze({
    model: readProductionModel(env),
    maxOutputTokens: readPositiveDecimalInteger(
      env,
      'OPENAI_SPFA_SEMANTIC_MAX_OUTPUT_TOKENS',
      DEFAULT_MAX_OUTPUT_TOKENS,
      OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS.maxOutputTokens,
    ),
    timeoutMs: readPositiveDecimalInteger(
      env,
      'OPENAI_SPFA_SEMANTIC_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
      OPENAI_SPFA_SEMANTIC_ADJUDICATION_EXECUTION_LIMITS.maxTimeoutMs,
    ),
  });
}

export function createOpenAiSpfaSemanticAdjudicationRuntimeV2(
  env: Readonly<Record<string, string | undefined>> = process.env,
  dependencies: OpenAiSpfaSemanticAdjudicationRuntimeDependenciesV2 =
    DEFAULT_DEPENDENCIES,
): OpenAiSpfaSemanticAdjudicationRuntimeV2 {
  const apiKey = readApiKey(env);
  const config = readConfig(env);

  let client: OpenAiSpfaSemanticAdjudicationClientV1;
  try {
    client = dependencies.createClient(apiKey);
  } catch (cause) {
    fail(
      'openai_spfa_semantic_client_initialization_failed',
      'OPENAI_API_KEY',
      'the server-owned OpenAI client could not be initialized',
      cause,
    );
  }

  const adjudicate: AdjudicateSpfaRequirementV2 = (input) =>
    dependencies.execute(client, input, config);

  return Object.freeze({ adjudicate });
}
