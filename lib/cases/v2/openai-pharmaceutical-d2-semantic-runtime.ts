import OpenAI from 'openai';
import {
  isPharmaceuticalSemanticModelV2,
  PHARMACEUTICAL_SEMANTIC_MODEL_POLICY_VERSION_V1,
  type PharmaceuticalSemanticModelV2,
} from './pharmaceutical-semantic-model-policy';

import {
  executeOpenAiPharmaceuticalD2SemanticClaimsV1,
  OPENAI_PHARMACEUTICAL_D2_EXECUTION_LIMITS,
  type OpenAiPharmaceuticalD2SemanticClientV1,
  type OpenAiPharmaceuticalD2SemanticExecutionConfigV1,
} from './execute-openai-pharmaceutical-d2-semantic-adjudication';
import { pharmaceuticalD2SemanticErrorV2 } from './pharmaceutical-d2-errors';
import {
  OPENAI_PHARMACEUTICAL_D2_CANDIDATE_MODEL,
  type PharmaceuticalD2SemanticRuntimeV2,
} from './pharmaceutical-d2-semantic-runtime';

const DEFAULT_MAX_OUTPUT_TOKENS = 10_000;
const DEFAULT_TIMEOUT_MS = 60_000;
const POSITIVE_DECIMAL_INTEGER = /^[1-9]\d*$/;

export type OpenAiPharmaceuticalD2RuntimeEnvironmentVariableV2 =
  | 'OPENAI_API_KEY'
  | 'OPENAI_PHARMACEUTICAL_D2_MODEL'
  | 'OPENAI_PHARMACEUTICAL_D2_MAX_OUTPUT_TOKENS'
  | 'OPENAI_PHARMACEUTICAL_D2_TIMEOUT_MS';

export type OpenAiPharmaceuticalD2RuntimeDependenciesV2 = Readonly<{
  createClient: (apiKey: string) => OpenAiPharmaceuticalD2SemanticClientV1;
  execute: typeof executeOpenAiPharmaceuticalD2SemanticClaimsV1;
}>;

const DEFAULT_DEPENDENCIES: OpenAiPharmaceuticalD2RuntimeDependenciesV2 =
  Object.freeze({
    createClient: (apiKey: string) => new OpenAI({ apiKey }),
    execute: executeOpenAiPharmaceuticalD2SemanticClaimsV1,
  });

function configurationFailure(
  variableName: OpenAiPharmaceuticalD2RuntimeEnvironmentVariableV2,
  message: string,
  cause?: unknown,
): never {
  throw pharmaceuticalD2SemanticErrorV2(
    'CONFIGURATION_ERROR',
    'CONFIGURATION',
    variableName,
    message,
    cause,
  );
}

function readApiKey(env: Readonly<Record<string, string | undefined>>): string {
  const value = env.OPENAI_API_KEY;
  if (typeof value !== 'string' || value.trim().length === 0) {
    configurationFailure('OPENAI_API_KEY', 'must be a non-empty server-owned value');
  }
  return value.trim();
}

function readModel(
  env: Readonly<Record<string, string | undefined>>,
): PharmaceuticalSemanticModelV2 {
  const value = env.OPENAI_PHARMACEUTICAL_D2_MODEL;
  if (value === undefined) return OPENAI_PHARMACEUTICAL_D2_CANDIDATE_MODEL;
  if (!isPharmaceuticalSemanticModelV2(value)) {
    configurationFailure(
      'OPENAI_PHARMACEUTICAL_D2_MODEL',
      `must be an exact model allowed by ${PHARMACEUTICAL_SEMANTIC_MODEL_POLICY_VERSION_V1}`,
    );
  }
  return value;
}

function readPositiveInteger(
  env: Readonly<Record<string, string | undefined>>,
  variableName:
    | 'OPENAI_PHARMACEUTICAL_D2_MAX_OUTPUT_TOKENS'
    | 'OPENAI_PHARMACEUTICAL_D2_TIMEOUT_MS',
  defaultValue: number,
  maximum: number,
): number {
  const value = env[variableName];
  if (value === undefined) return defaultValue;
  if (!POSITIVE_DECIMAL_INTEGER.test(value)) {
    configurationFailure(variableName, 'must be a strict positive decimal integer');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    configurationFailure(variableName, `must not exceed ${maximum}`);
  }
  return parsed;
}

export function readOpenAiPharmaceuticalD2ExecutionConfigV1(
  env: Readonly<Record<string, string | undefined>>,
): OpenAiPharmaceuticalD2SemanticExecutionConfigV1 {
  return Object.freeze({
    model: readModel(env),
    maxOutputTokens: readPositiveInteger(
      env,
      'OPENAI_PHARMACEUTICAL_D2_MAX_OUTPUT_TOKENS',
      DEFAULT_MAX_OUTPUT_TOKENS,
      OPENAI_PHARMACEUTICAL_D2_EXECUTION_LIMITS.maxOutputTokens,
    ),
    timeoutMs: readPositiveInteger(
      env,
      'OPENAI_PHARMACEUTICAL_D2_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
      OPENAI_PHARMACEUTICAL_D2_EXECUTION_LIMITS.maxTimeoutMs,
    ),
  });
}

export function createOpenAiPharmaceuticalD2SemanticRuntimeV2(
  env: Readonly<Record<string, string | undefined>> = process.env,
  dependencies: OpenAiPharmaceuticalD2RuntimeDependenciesV2 = DEFAULT_DEPENDENCIES,
): PharmaceuticalD2SemanticRuntimeV2 {
  const apiKey = readApiKey(env);
  const config = readOpenAiPharmaceuticalD2ExecutionConfigV1(env);
  let client: OpenAiPharmaceuticalD2SemanticClientV1;
  try {
    client = dependencies.createClient(apiKey);
  } catch (cause) {
    configurationFailure(
      'OPENAI_API_KEY',
      'could not initialize the server-owned OpenAI client',
      cause,
    );
  }
  return Object.freeze({
    detectClaims: (request) => dependencies.execute(client, request, config),
  });
}
