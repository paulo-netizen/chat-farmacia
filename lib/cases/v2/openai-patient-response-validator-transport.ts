import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import {
  PATIENT_RESPONSE_VALIDATION_SCHEMA_VERSION_V2,
  type PatientResponseValidationResultV2,
  type PatientResponseViolationCodeV2,
} from './patient-response-safety-types';

export const PATIENT_RESPONSE_VIOLATION_CODES_V2 = [
  'ROLE_BREAK',
  'PROTECTED_LEAK',
  'UNSUPPORTED_FACT',
  'FACT_CONTRADICTION',
  'HISTORY_CONTRADICTION',
  'DISCLOSURE_VIOLATION',
  'INTERNAL_IDENTIFIER',
  'META_OUTPUT',
  'OTHER_UNSAFE_OUTPUT',
] as const satisfies readonly PatientResponseViolationCodeV2[];

const violationCode = z.enum(PATIENT_RESPONSE_VIOLATION_CODES_V2);

export const OpenAiPatientResponseValidationTransportSchemaV1 = z
  .object({
    schemaVersion: z.literal(PATIENT_RESPONSE_VALIDATION_SCHEMA_VERSION_V2),
    decision: z.enum(['PASS', 'RETRY']),
    violations: z.array(violationCode).max(PATIENT_RESPONSE_VIOLATION_CODES_V2.length),
  })
  .strict();

export type OpenAiPatientResponseValidationTransportV1 = z.infer<
  typeof OpenAiPatientResponseValidationTransportSchemaV1
>;

export const OPENAI_PATIENT_RESPONSE_VALIDATOR_TEXT_FORMAT_V1 = zodTextFormat(
  OpenAiPatientResponseValidationTransportSchemaV1,
  'chatusal_patient_response_validation_v1',
);

export type OpenAiPatientResponseValidatorBoundaryErrorCodeV2 =
  | 'invalid_openai_patient_response_validation_output'
  | 'openai_patient_response_validator_params_build_failed';

export class OpenAiPatientResponseValidatorBoundaryErrorV2 extends Error {
  constructor(
    public readonly code: OpenAiPatientResponseValidatorBoundaryErrorCodeV2,
    public readonly path: string,
    message: string,
    public readonly cause: unknown,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'OpenAiPatientResponseValidatorBoundaryErrorV2';
  }
}

function zodPath(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue === undefined || issue.path.length === 0
    ? 'validatorOutput'
    : `validatorOutput.${issue.path.join('.')}`;
}

function invalidOutput(path: string, cause: unknown): never {
  throw new OpenAiPatientResponseValidatorBoundaryErrorV2(
    'invalid_openai_patient_response_validation_output',
    path,
    'the patient response validator output is invalid',
    cause,
  );
}

export function parseOpenAiPatientResponseValidationTransportV1(
  input: unknown,
): PatientResponseValidationResultV2 {
  const parsed = OpenAiPatientResponseValidationTransportSchemaV1.safeParse(input);
  if (!parsed.success) invalidOutput(zodPath(parsed.error), parsed.error);

  const uniqueViolations = new Set(parsed.data.violations);
  if (uniqueViolations.size !== parsed.data.violations.length) {
    invalidOutput(
      'validatorOutput.violations',
      new TypeError('duplicate violation code'),
    );
  }

  if (parsed.data.decision === 'PASS') {
    if (parsed.data.violations.length !== 0) {
      invalidOutput(
        'validatorOutput.violations',
        new TypeError('PASS requires an empty violations array'),
      );
    }
    return Object.freeze({
      schemaVersion: PATIENT_RESPONSE_VALIDATION_SCHEMA_VERSION_V2,
      decision: 'PASS',
      violations: Object.freeze([]) as readonly [],
    });
  }

  if (parsed.data.violations.length === 0) {
    invalidOutput(
      'validatorOutput.violations',
      new TypeError('RETRY requires at least one violation'),
    );
  }
  return Object.freeze({
    schemaVersion: PATIENT_RESPONSE_VALIDATION_SCHEMA_VERSION_V2,
    decision: 'RETRY',
    violations: Object.freeze([...parsed.data.violations]) as [
      PatientResponseViolationCodeV2,
      ...PatientResponseViolationCodeV2[],
    ],
  });
}
