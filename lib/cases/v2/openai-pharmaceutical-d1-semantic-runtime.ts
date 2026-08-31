import OpenAI from 'openai';
import {
  isPharmaceuticalSemanticModelV2,
  PHARMACEUTICAL_SEMANTIC_MODEL_POLICY_VERSION_V1,
  type PharmaceuticalSemanticModelV2,
} from './pharmaceutical-semantic-model-policy';

import {
  executeOpenAiPharmaceuticalD1SemanticBatchV1,
  OPENAI_PHARMACEUTICAL_D1_EXECUTION_LIMITS,
  type OpenAiPharmaceuticalD1SemanticClientV1,
  type OpenAiPharmaceuticalD1SemanticExecutionConfigV1,
} from './execute-openai-pharmaceutical-d1-semantic-adjudication';
import { pharmaceuticalD1SemanticErrorV2 } from './pharmaceutical-d1-errors';
import {
  OPENAI_PHARMACEUTICAL_D1_CANDIDATE_MODEL,
  type PharmaceuticalD1SemanticRuntimeV2,
} from './pharmaceutical-d1-semantic-runtime';

const DEFAULT_MAX_OUTPUT_TOKENS = 10_000;
const DEFAULT_TIMEOUT_MS = 60_000;
const POSITIVE_DECIMAL_INTEGER = /^[1-9]\d*$/;

export type OpenAiPharmaceuticalD1RuntimeEnvironmentVariableV2 =
  | 'OPENAI_API_KEY'
  | 'OPENAI_PHARMACEUTICAL_D1_MODEL'
  | 'OPENAI_PHARMACEUTICAL_D1_MAX_OUTPUT_TOKENS'
  | 'OPENAI_PHARMACEUTICAL_D1_TIMEOUT_MS';

export type OpenAiPharmaceuticalD1RuntimeDependenciesV2 = Readonly<{
  createClient: (apiKey: string) => OpenAiPharmaceuticalD1SemanticClientV1;
  execute: typeof executeOpenAiPharmaceuticalD1SemanticBatchV1;
}>;

const DEFAULT_DEPENDENCIES: OpenAiPharmaceuticalD1RuntimeDependenciesV2 =
  Object.freeze({
    createClient: (apiKey: string) => new OpenAI({ apiKey }),
    execute: executeOpenAiPharmaceuticalD1SemanticBatchV1,
  });

function configurationFailure(
  variableName: OpenAiPharmaceuticalD1RuntimeEnvironmentVariableV2,
  message: string,
  cause?: unknown,
): never {
  throw pharmaceuticalD1SemanticErrorV2(
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
  const value = env.OPENAI_PHARMACEUTICAL_D1_MODEL;
  if (value === undefined) return OPENAI_PHARMACEUTICAL_D1_CANDIDATE_MODEL;
  if (!isPharmaceuticalSemanticModelV2(value)) {
    configurationFailure(
      'OPENAI_PHARMACEUTICAL_D1_MODEL',
      `must be an exact model allowed by ${PHARMACEUTICAL_SEMANTIC_MODEL_POLICY_VERSION_V1}`,
    );
  }
  return value;
}

function readPositiveInteger(
  env: Readonly<Record<string, string | undefined>>,
  variableName:
    | 'OPENAI_PHARMACEUTICAL_D1_MAX_OUTPUT_TOKENS'
    | 'OPENAI_PHARMACEUTICAL_D1_TIMEOUT_MS',
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

export function readOpenAiPharmaceuticalD1ExecutionConfigV1(
  env: Readonly<Record<string, string | undefined>>,
): OpenAiPharmaceuticalD1SemanticExecutionConfigV1 {
  return Object.freeze({
    model: readModel(env),
    maxOutputTokens: readPositiveInteger(
      env,
      'OPENAI_PHARMACEUTICAL_D1_MAX_OUTPUT_TOKENS',
      DEFAULT_MAX_OUTPUT_TOKENS,
      OPENAI_PHARMACEUTICAL_D1_EXECUTION_LIMITS.maxOutputTokens,
    ),
    timeoutMs: readPositiveInteger(
      env,
      'OPENAI_PHARMACEUTICAL_D1_TIMEOUT_MS',
      DEFAULT_TIMEOUT_MS,
      OPENAI_PHARMACEUTICAL_D1_EXECUTION_LIMITS.maxTimeoutMs,
    ),
  });
}

export function createOpenAiPharmaceuticalD1SemanticRuntimeV2(
  env: Readonly<Record<string, string | undefined>> = process.env,
  dependencies: OpenAiPharmaceuticalD1RuntimeDependenciesV2 = DEFAULT_DEPENDENCIES,
): PharmaceuticalD1SemanticRuntimeV2 {
  const apiKey = readApiKey(env);
  const config = readOpenAiPharmaceuticalD1ExecutionConfigV1(env);
  let client: OpenAiPharmaceuticalD1SemanticClientV1;
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
    adjudicateBatch: (request) => dependencies.execute(client, request, config),
  });
}
