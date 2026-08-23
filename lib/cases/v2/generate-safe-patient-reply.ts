import {
  executeOpenAiPatientResponseGeneratorV2,
  normalizePatientResponseRetryViolationCodesV2,
  type OpenAiPatientResponseGeneratorClientV2,
  type OpenAiPatientResponseGeneratorConfigV2,
  type OpenAiPatientResponseGeneratorReceiptV2,
  type PatientResponseRetryViolationCodeV2,
} from './execute-openai-patient-response-generator';
import {
  executeOpenAiPatientResponseValidatorV2,
  OpenAiPatientResponseValidatorExecutionErrorV2,
  type OpenAiPatientResponseValidatorClientV2,
  type OpenAiPatientResponseValidatorExecutionConfigV2,
  type OpenAiPatientResponseValidatorReceiptV2,
} from './execute-openai-patient-response-validator';
import { guardPatientResponseCandidateV2 } from './patient-response-deterministic-guard';
import {
  buildPatientResponseValidationRequestV2,
  type PatientResponseAcceptedConversationMessageV2,
} from './patient-response-validation-context';
import type {
  AcceptedPatientResponseTextV2,
  PatientResponseAttemptV2,
  ValidatedPatientResponseTextV2,
} from './patient-response-safety-types';
import type { SessionPatientClinicalContentV2 } from './session-clinical-content-types';

export const MAX_PATIENT_RESPONSE_REGENERATIONS = 1 as const;

export type GenerateSafePatientReplyInputV2 = Readonly<{
  clinicalContent: SessionPatientClinicalContentV2;
  acceptedConversation: readonly PatientResponseAcceptedConversationMessageV2[];
  currentStudentTurn: string;
}>;

export type GenerateSafePatientReplyDependenciesV2 = Readonly<{
  patientGenerator: Readonly<{
    client: OpenAiPatientResponseGeneratorClientV2;
    config: OpenAiPatientResponseGeneratorConfigV2;
  }>;
  semanticValidator: Readonly<{
    client: OpenAiPatientResponseValidatorClientV2;
    config: OpenAiPatientResponseValidatorExecutionConfigV2;
  }>;
}>;

export type PatientResponseSafetyCallReceiptV2 = Readonly<{
  kind: 'patient_generation' | 'semantic_validation';
  attempt: PatientResponseAttemptV2;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}>;

export type AcceptedPatientReplyReceiptV2 = Readonly<{
  calls: readonly PatientResponseSafetyCallReceiptV2[];
  retryViolationCodes?: readonly PatientResponseRetryViolationCodeV2[];
  totalInputTokens: number;
  totalOutputTokens: number;
  usageComplete: boolean;
}>;

export type AcceptedPatientReplyV2 = Readonly<{
  reply: AcceptedPatientResponseTextV2;
  receipt: AcceptedPatientReplyReceiptV2;
}>;

export type PatientResponseSafetyErrorCodeV2 =
  | 'PATIENT_GENERATION_FAILED'
  | 'INVALID_PATIENT_CANDIDATE'
  | 'VALIDATOR_FAILED'
  | 'INVALID_VALIDATOR_OUTPUT'
  | 'UNSAFE_AFTER_REGENERATION';

export type PatientResponseSafetyStageV2 =
  | 'generation'
  | 'guard'
  | 'validation'
  | 'regeneration';

export class PatientResponseSafetyErrorV2 extends Error {
  public readonly calls: readonly PatientResponseSafetyCallReceiptV2[];

  constructor(
    public readonly code: PatientResponseSafetyErrorCodeV2,
    public readonly stage: PatientResponseSafetyStageV2,
    public readonly cause: unknown,
    calls: readonly PatientResponseSafetyCallReceiptV2[],
  ) {
    super(`${code} at ${stage}: safe patient reply generation failed`);
    this.name = 'PatientResponseSafetyErrorV2';
    this.calls = snapshotCalls(calls);
  }
}

function snapshotCalls(
  calls: readonly PatientResponseSafetyCallReceiptV2[],
): readonly PatientResponseSafetyCallReceiptV2[] {
  return Object.freeze(
    calls.map((call) => Object.freeze({ ...call })),
  );
}

function callReceipt(
  kind: PatientResponseSafetyCallReceiptV2['kind'],
  attempt: PatientResponseAttemptV2,
  receipt:
    | OpenAiPatientResponseGeneratorReceiptV2
    | OpenAiPatientResponseValidatorReceiptV2,
): PatientResponseSafetyCallReceiptV2 {
  return Object.freeze({
    kind,
    attempt,
    model: responseModel(receipt),
    ...(receipt.usage === undefined
      ? {}
      : {
          inputTokens: receipt.usage.inputTokens,
          outputTokens: receipt.usage.outputTokens,
        }),
  });
}

function responseModel(
  receipt:
    | OpenAiPatientResponseGeneratorReceiptV2
    | OpenAiPatientResponseValidatorReceiptV2,
): string {
  return receipt.responseModel;
}

function finalReceipt(
  calls: readonly PatientResponseSafetyCallReceiptV2[],
  retryViolationCodes?: readonly PatientResponseRetryViolationCodeV2[],
): AcceptedPatientReplyReceiptV2 {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let usageComplete = true;
  for (const call of calls) {
    if (call.inputTokens === undefined || call.outputTokens === undefined) {
      usageComplete = false;
      continue;
    }
    totalInputTokens += call.inputTokens;
    totalOutputTokens += call.outputTokens;
  }
  return Object.freeze({
    calls: Object.freeze([...calls]),
    ...(retryViolationCodes === undefined
      ? {}
      : { retryViolationCodes: Object.freeze([...retryViolationCodes]) }),
    totalInputTokens,
    totalOutputTokens,
    usageComplete,
  });
}

function isInvalidValidatorOutput(
  error: OpenAiPatientResponseValidatorExecutionErrorV2,
): boolean {
  return (
    error.code === 'openai_patient_response_validator_missing_output' ||
    error.code === 'openai_patient_response_validator_invalid_output'
  );
}

async function generate(
  input: GenerateSafePatientReplyInputV2,
  dependencies: GenerateSafePatientReplyDependenciesV2,
  attempt: PatientResponseAttemptV2,
  calls: readonly PatientResponseSafetyCallReceiptV2[],
  retryViolationCodes?: readonly PatientResponseRetryViolationCodeV2[],
): Promise<OpenAiPatientResponseGeneratorReceiptV2> {
  try {
    return await executeOpenAiPatientResponseGeneratorV2(
      dependencies.patientGenerator.client,
      {
        clinicalContent: input.clinicalContent,
        acceptedConversation: input.acceptedConversation,
        currentStudentTurn: input.currentStudentTurn,
        attempt,
        ...(retryViolationCodes === undefined ? {} : { retryViolationCodes }),
      },
      dependencies.patientGenerator.config,
    );
  } catch (cause) {
    throw new PatientResponseSafetyErrorV2(
      'PATIENT_GENERATION_FAILED',
      attempt === 'initial' ? 'generation' : 'regeneration',
      cause,
      calls,
    );
  }
}

async function validate(
  input: GenerateSafePatientReplyInputV2,
  dependencies: GenerateSafePatientReplyDependenciesV2,
  attempt: PatientResponseAttemptV2,
  candidate: ValidatedPatientResponseTextV2,
  calls: readonly PatientResponseSafetyCallReceiptV2[],
): Promise<OpenAiPatientResponseValidatorReceiptV2> {
  try {
    const request = buildPatientResponseValidationRequestV2({
      clinicalContent: input.clinicalContent,
      acceptedConversation: input.acceptedConversation,
      currentStudentTurn: input.currentStudentTurn,
      candidate,
    });
    return await executeOpenAiPatientResponseValidatorV2(
      dependencies.semanticValidator.client,
      request,
      dependencies.semanticValidator.config,
    );
  } catch (cause) {
    const code =
      cause instanceof OpenAiPatientResponseValidatorExecutionErrorV2 &&
      isInvalidValidatorOutput(cause)
        ? 'INVALID_VALIDATOR_OUTPUT'
        : 'VALIDATOR_FAILED';
    throw new PatientResponseSafetyErrorV2(
      code,
      attempt === 'initial' ? 'validation' : 'regeneration',
      cause,
      calls,
    );
  }
}

function accept(
  candidate: ValidatedPatientResponseTextV2,
  calls: readonly PatientResponseSafetyCallReceiptV2[],
  retryViolationCodes?: readonly PatientResponseRetryViolationCodeV2[],
): AcceptedPatientReplyV2 {
  return Object.freeze({
    reply: candidate as AcceptedPatientResponseTextV2,
    receipt: finalReceipt(calls, retryViolationCodes),
  });
}

export async function generateSafePatientReplyV2(
  input: GenerateSafePatientReplyInputV2,
  dependencies: GenerateSafePatientReplyDependenciesV2,
): Promise<AcceptedPatientReplyV2> {
  const calls: PatientResponseSafetyCallReceiptV2[] = [];
  const initialGeneration = await generate(input, dependencies, 'initial', calls);
  calls.push(callReceipt('patient_generation', 'initial', initialGeneration));

  const initialGuard = guardPatientResponseCandidateV2(
    initialGeneration.candidate,
  );
  let retryViolationCodes: readonly PatientResponseRetryViolationCodeV2[];
  if (initialGuard.decision === 'PASS') {
    const initialValidation = await validate(
      input,
      dependencies,
      'initial',
      initialGuard.candidate,
      calls,
    );
    calls.push(callReceipt('semantic_validation', 'initial', initialValidation));
    if (initialValidation.result.decision === 'PASS') {
      return accept(initialGuard.candidate, calls);
    }
    retryViolationCodes = normalizePatientResponseRetryViolationCodesV2(
      initialValidation.result.violations,
    );
  } else {
    retryViolationCodes = normalizePatientResponseRetryViolationCodesV2(
      initialGuard.violations,
    );
  }

  const regeneration = await generate(
    input,
    dependencies,
    'regeneration',
    calls,
    retryViolationCodes,
  );
  calls.push(callReceipt('patient_generation', 'regeneration', regeneration));
  const regenerationGuard = guardPatientResponseCandidateV2(
    regeneration.candidate,
  );
  if (regenerationGuard.decision === 'RETRY') {
    throw new PatientResponseSafetyErrorV2(
      'UNSAFE_AFTER_REGENERATION',
      'regeneration',
      new Error('regenerated patient candidate failed the deterministic guard'),
      calls,
    );
  }

  const regenerationValidation = await validate(
    input,
    dependencies,
    'regeneration',
    regenerationGuard.candidate,
    calls,
  );
  calls.push(
    callReceipt('semantic_validation', 'regeneration', regenerationValidation),
  );
  if (regenerationValidation.result.decision === 'RETRY') {
    throw new PatientResponseSafetyErrorV2(
      'UNSAFE_AFTER_REGENERATION',
      'regeneration',
      new Error('regenerated patient candidate failed semantic validation'),
      calls,
    );
  }
  return accept(regenerationGuard.candidate, calls, retryViolationCodes);
}
