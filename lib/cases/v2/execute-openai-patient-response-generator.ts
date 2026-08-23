import type OpenAI from 'openai';
import type { RequestOptions } from 'openai/core';
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions/completions';

import { buildPatientChatSystemPromptV2 } from './patient-chat-prompt';
import type { PatientResponseAcceptedConversationMessageV2 } from './patient-response-validation-context';
import type {
  PatientResponseAttemptV2,
  PatientResponseCandidateV2,
  PatientResponseDeterministicViolationCodeV2,
  PatientResponseViolationCodeV2,
} from './patient-response-safety-types';
import type { SessionPatientClinicalContentV2 } from './session-clinical-content-types';

export const OPENAI_PATIENT_RESPONSE_GENERATOR_LIMITS = Object.freeze({
  maxModelLength: 200,
  maxTokens: 4096,
  maxTimeoutMs: 600_000,
});

export type PatientResponseRetryViolationCodeV2 =
  | PatientResponseDeterministicViolationCodeV2
  | PatientResponseViolationCodeV2;

export const PATIENT_RESPONSE_RETRY_VIOLATION_CODE_ORDER_V2 = Object.freeze([
  'INVALID_CANDIDATE',
  'EMPTY_CANDIDATE',
  'CANDIDATE_TOO_LARGE',
  'INTERNAL_IDENTIFIER',
  'INTERNAL_PROTOCOL_OUTPUT',
  'UNAMBIGUOUS_META_OUTPUT',
  'ROLE_BREAK',
  'PROTECTED_LEAK',
  'UNSUPPORTED_FACT',
  'FACT_CONTRADICTION',
  'HISTORY_CONTRADICTION',
  'DISCLOSURE_VIOLATION',
  'META_OUTPUT',
  'OTHER_UNSAFE_OUTPUT',
] satisfies readonly PatientResponseRetryViolationCodeV2[]);

const RETRY_CODE_SET = new Set<string>(
  PATIENT_RESPONSE_RETRY_VIOLATION_CODE_ORDER_V2,
);

export type OpenAiPatientResponseGeneratorInputV2 = Readonly<{
  clinicalContent: SessionPatientClinicalContentV2;
  acceptedConversation: readonly PatientResponseAcceptedConversationMessageV2[];
  currentStudentTurn: string;
  attempt: PatientResponseAttemptV2;
  retryViolationCodes?: readonly PatientResponseRetryViolationCodeV2[];
}>;

export type OpenAiPatientResponseGeneratorConfigV2 = Readonly<{
  model: string;
  maxTokens: number;
  timeoutMs: number;
}>;

export type OpenAiPatientResponseGeneratorClientV2 = Readonly<{
  chat: Readonly<{
    completions: Pick<OpenAI['chat']['completions'], 'create'>;
  }>;
}>;

export type OpenAiPatientResponseGeneratorUsageV2 = Readonly<{
  inputTokens: number;
  outputTokens: number;
}>;

export type OpenAiPatientResponseGeneratorReceiptV2 = Readonly<{
  candidate: PatientResponseCandidateV2;
  responseModel: string;
  usage?: OpenAiPatientResponseGeneratorUsageV2;
}>;

export type OpenAiPatientResponseGeneratorErrorCodeV2 =
  | 'invalid_openai_patient_response_generator_input'
  | 'invalid_openai_patient_response_generator_config'
  | 'openai_patient_response_generator_request_failed'
  | 'openai_patient_response_generator_invalid_response'
  | 'openai_patient_response_generator_refusal'
  | 'openai_patient_response_generator_incomplete'
  | 'openai_patient_response_generator_unexpected_output'
  | 'openai_patient_response_generator_invalid_response_metadata';

export class OpenAiPatientResponseGeneratorErrorV2 extends Error {
  constructor(
    public readonly code: OpenAiPatientResponseGeneratorErrorCodeV2,
    public readonly path: string,
    message: string,
    public readonly cause: unknown,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'OpenAiPatientResponseGeneratorErrorV2';
  }
}

function fail(
  code: OpenAiPatientResponseGeneratorErrorCodeV2,
  path: string,
  message: string,
  cause?: unknown,
): never {
  throw new OpenAiPatientResponseGeneratorErrorV2(
    code,
    path,
    message,
    cause ?? new Error(`${code} at ${path}`),
  );
}

function validateConfig(
  input: OpenAiPatientResponseGeneratorConfigV2,
): OpenAiPatientResponseGeneratorConfigV2 {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    fail(
      'invalid_openai_patient_response_generator_config',
      'config',
      'the patient generator configuration is invalid',
    );
  }
  const source = input as Record<string, unknown>;
  const allowed = new Set(['model', 'maxTokens', 'timeoutMs']);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) {
      fail(
        'invalid_openai_patient_response_generator_config',
        `config.${key}`,
        'the patient generator configuration is invalid',
      );
    }
  }
  if (
    typeof source.model !== 'string' ||
    source.model.length === 0 ||
    source.model.trim() !== source.model ||
    source.model.length > OPENAI_PATIENT_RESPONSE_GENERATOR_LIMITS.maxModelLength
  ) {
    fail(
      'invalid_openai_patient_response_generator_config',
      'config.model',
      'the patient generator configuration is invalid',
    );
  }
  if (
    typeof source.maxTokens !== 'number' ||
    !Number.isInteger(source.maxTokens) ||
    source.maxTokens < 1 ||
    source.maxTokens > OPENAI_PATIENT_RESPONSE_GENERATOR_LIMITS.maxTokens
  ) {
    fail(
      'invalid_openai_patient_response_generator_config',
      'config.maxTokens',
      'the patient generator configuration is invalid',
    );
  }
  if (
    typeof source.timeoutMs !== 'number' ||
    !Number.isInteger(source.timeoutMs) ||
    source.timeoutMs < 1 ||
    source.timeoutMs > OPENAI_PATIENT_RESPONSE_GENERATOR_LIMITS.maxTimeoutMs
  ) {
    fail(
      'invalid_openai_patient_response_generator_config',
      'config.timeoutMs',
      'the patient generator configuration is invalid',
    );
  }
  return {
    model: source.model,
    maxTokens: source.maxTokens,
    timeoutMs: source.timeoutMs,
  };
}

export function normalizePatientResponseRetryViolationCodesV2(
  input: readonly unknown[],
): readonly PatientResponseRetryViolationCodeV2[] {
  if (!Array.isArray(input) || input.length === 0) {
    fail(
      'invalid_openai_patient_response_generator_input',
      'input.retryViolationCodes',
      'regeneration requires closed retry violation codes',
    );
  }
  for (let index = 0; index < input.length; index += 1) {
    if (typeof input[index] !== 'string' || !RETRY_CODE_SET.has(input[index])) {
      fail(
        'invalid_openai_patient_response_generator_input',
        `input.retryViolationCodes[${index}]`,
        'regeneration requires closed retry violation codes',
      );
    }
  }
  const supplied = new Set(input as readonly string[]);
  return PATIENT_RESPONSE_RETRY_VIOLATION_CODE_ORDER_V2.filter((code) =>
    supplied.has(code),
  );
}

export function buildPatientResponseRegenerationCorrectionV2(
  retryViolationCodes: readonly unknown[],
): string {
  const codes = normalizePatientResponseRetryViolationCodesV2(
    retryViolationCodes,
  );
  return `La respuesta anterior fue descartada por la frontera de seguridad.
Genera una nueva respuesta del mismo paciente corrigiendo únicamente estas categorías:
${codes.map((code) => `- ${code}`).join('\n')}
Mantén el mismo caso, turno e historial aceptado.
No añadas hechos nuevos ni actúes como profesor, evaluador, asistente o sistema.`;
}

function buildMessages(
  input: OpenAiPatientResponseGeneratorInputV2,
): ChatCompletionMessageParam[] {
  if (
    input.attempt !== 'initial' &&
    input.attempt !== 'regeneration'
  ) {
    fail(
      'invalid_openai_patient_response_generator_input',
      'input.attempt',
      'the patient generator input is invalid',
    );
  }
  if (typeof input.currentStudentTurn !== 'string') {
    fail(
      'invalid_openai_patient_response_generator_input',
      'input.currentStudentTurn',
      'the patient generator input is invalid',
    );
  }
  if (!Array.isArray(input.acceptedConversation)) {
    fail(
      'invalid_openai_patient_response_generator_input',
      'input.acceptedConversation',
      'the patient generator input is invalid',
    );
  }
  const history = input.acceptedConversation.map((message, index) => {
    if (
      typeof message !== 'object' ||
      message === null ||
      Array.isArray(message) ||
      (message.role !== 'student' && message.role !== 'patient') ||
      typeof message.content !== 'string'
    ) {
      fail(
        'invalid_openai_patient_response_generator_input',
        `input.acceptedConversation[${index}]`,
        'the patient generator input is invalid',
      );
    }
    return message.role === 'student'
      ? ({ role: 'user', content: message.content } as const)
      : ({ role: 'assistant', content: message.content } as const);
  });

  let systemPrompt = buildPatientChatSystemPromptV2(input.clinicalContent);
  if (input.attempt === 'initial') {
    if (input.retryViolationCodes !== undefined) {
      fail(
        'invalid_openai_patient_response_generator_input',
        'input.retryViolationCodes',
        'initial generation cannot receive retry violation codes',
      );
    }
  } else {
    systemPrompt += `\n\n${buildPatientResponseRegenerationCorrectionV2(
      input.retryViolationCodes ?? [],
    )}`;
  }

  return [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: input.currentStudentTurn },
  ];
}

function validateResponseModel(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value ||
    value.length > OPENAI_PATIENT_RESPONSE_GENERATOR_LIMITS.maxModelLength
  ) {
    fail(
      'openai_patient_response_generator_invalid_response_metadata',
      'response.model',
      'OpenAI returned invalid patient generator response metadata',
    );
  }
  return value;
}

function validateTokenCount(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    fail(
      'openai_patient_response_generator_invalid_response_metadata',
      path,
      'OpenAI returned invalid patient generator response metadata',
    );
  }
  return value;
}

function copyUsage(
  value: unknown,
): OpenAiPatientResponseGeneratorUsageV2 | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    fail(
      'openai_patient_response_generator_invalid_response_metadata',
      'response.usage',
      'OpenAI returned invalid patient generator response metadata',
    );
  }
  const source = value as Record<string, unknown>;
  return {
    inputTokens: validateTokenCount(
      source.prompt_tokens,
      'response.usage.prompt_tokens',
    ),
    outputTokens: validateTokenCount(
      source.completion_tokens,
      'response.usage.completion_tokens',
    ),
  };
}

function readCandidateText(response: ChatCompletion): unknown {
  if (!Array.isArray(response.choices) || response.choices.length !== 1) {
    fail(
      'openai_patient_response_generator_invalid_response',
      'response.choices',
      'OpenAI returned an invalid patient generator response',
    );
  }
  const choice = response.choices[0] as unknown;
  if (typeof choice !== 'object' || choice === null || Array.isArray(choice)) {
    fail(
      'openai_patient_response_generator_invalid_response',
      'response.choices[0]',
      'OpenAI returned an invalid patient generator response',
    );
  }
  const choiceSource = choice as Record<string, unknown>;
  if (choiceSource.finish_reason === 'content_filter') {
    fail(
      'openai_patient_response_generator_incomplete',
      'response.choices[0].finish_reason',
      'OpenAI filtered the patient response',
    );
  }
  if (choiceSource.finish_reason === 'length') {
    fail(
      'openai_patient_response_generator_incomplete',
      'response.choices[0].finish_reason',
      'OpenAI truncated the patient response',
    );
  }
  if (
    choiceSource.finish_reason === 'tool_calls' ||
    choiceSource.finish_reason === 'function_call'
  ) {
    fail(
      'openai_patient_response_generator_unexpected_output',
      'response.choices[0].finish_reason',
      'OpenAI returned unexpected patient generator output',
    );
  }
  if (choiceSource.finish_reason !== 'stop') {
    fail(
      'openai_patient_response_generator_invalid_response',
      'response.choices[0].finish_reason',
      'OpenAI returned an invalid patient generator response',
    );
  }
  const message = choiceSource.message;
  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    fail(
      'openai_patient_response_generator_invalid_response',
      'response.choices[0].message',
      'OpenAI returned an invalid patient generator response',
    );
  }
  const messageSource = message as Record<string, unknown>;
  if (messageSource.role !== 'assistant') {
    fail(
      'openai_patient_response_generator_invalid_response',
      'response.choices[0].message.role',
      'OpenAI returned an invalid patient generator response',
    );
  }
  if (typeof messageSource.refusal === 'string') {
    fail(
      'openai_patient_response_generator_refusal',
      'response.choices[0].message.refusal',
      'OpenAI refused the patient response request',
    );
  }
  if (messageSource.refusal !== null) {
    fail(
      'openai_patient_response_generator_invalid_response',
      'response.choices[0].message.refusal',
      'OpenAI returned an invalid patient generator response',
    );
  }
  if (
    Array.isArray(messageSource.tool_calls) &&
    messageSource.tool_calls.length > 0
  ) {
    fail(
      'openai_patient_response_generator_unexpected_output',
      'response.choices[0].message.tool_calls',
      'OpenAI returned unexpected patient generator output',
    );
  }
  if (
    messageSource.tool_calls !== undefined &&
    !Array.isArray(messageSource.tool_calls)
  ) {
    fail(
      'openai_patient_response_generator_invalid_response',
      'response.choices[0].message.tool_calls',
      'OpenAI returned an invalid patient generator response',
    );
  }
  if (
    messageSource.function_call !== undefined &&
    messageSource.function_call !== null
  ) {
    fail(
      'openai_patient_response_generator_unexpected_output',
      'response.choices[0].message.function_call',
      'OpenAI returned unexpected patient generator output',
    );
  }
  if (
    messageSource.content !== undefined &&
    messageSource.content !== null &&
    typeof messageSource.content !== 'string'
  ) {
    fail(
      'openai_patient_response_generator_invalid_response',
      'response.choices[0].message.content',
      'OpenAI returned an invalid patient generator response',
    );
  }
  return messageSource.content;
}

export async function executeOpenAiPatientResponseGeneratorV2(
  client: OpenAiPatientResponseGeneratorClientV2,
  input: OpenAiPatientResponseGeneratorInputV2,
  configInput: OpenAiPatientResponseGeneratorConfigV2,
): Promise<OpenAiPatientResponseGeneratorReceiptV2> {
  const config = validateConfig(configInput);
  const messages = buildMessages(input);
  const requestOptions: RequestOptions = {
    maxRetries: 0,
    timeout: config.timeoutMs,
  };

  let response: ChatCompletion;
  try {
    response = await client.chat.completions.create(
      {
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        store: false,
      },
      requestOptions,
    );
  } catch (cause) {
    throw new OpenAiPatientResponseGeneratorErrorV2(
      'openai_patient_response_generator_request_failed',
      'client.chat.completions.create',
      'the patient response generator request failed',
      cause,
    );
  }

  if (typeof response !== 'object' || response === null || Array.isArray(response)) {
    fail(
      'openai_patient_response_generator_invalid_response',
      'response',
      'OpenAI returned an invalid patient generator response',
    );
  }
  const responseModel = validateResponseModel(
    (response as unknown as Record<string, unknown>).model,
  );
  const candidate: PatientResponseCandidateV2 = Object.freeze({
    text: readCandidateText(response),
    attempt: input.attempt,
  });
  const usage = copyUsage(
    (response as unknown as Record<string, unknown>).usage,
  );
  return Object.freeze({
    candidate,
    responseModel,
    ...(usage === undefined ? {} : { usage }),
  });
}
