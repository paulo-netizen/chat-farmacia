export type PatientResponseAttemptV2 = 'initial' | 'regeneration';

export type PatientResponseCandidateV2 = Readonly<{
  text: unknown;
  attempt: PatientResponseAttemptV2;
}>;

export type PatientResponseDeterministicViolationCodeV2 =
  | 'INVALID_CANDIDATE'
  | 'EMPTY_CANDIDATE'
  | 'CANDIDATE_TOO_LARGE'
  | 'INTERNAL_IDENTIFIER'
  | 'INTERNAL_PROTOCOL_OUTPUT'
  | 'UNAMBIGUOUS_META_OUTPUT';

declare const validatedPatientResponseTextV2Brand: unique symbol;

/** Text that has passed only the deterministic guard, not clinical validation. */
export type ValidatedPatientResponseTextV2 = string & {
  readonly [validatedPatientResponseTextV2Brand]: true;
};

declare const acceptedPatientResponseTextV2Brand: unique symbol;

/** Text that has passed both the deterministic and semantic safety boundaries. */
export type AcceptedPatientResponseTextV2 = ValidatedPatientResponseTextV2 & {
  readonly [acceptedPatientResponseTextV2Brand]: true;
};

export type PatientResponseNonEmptyArrayV2<T> = readonly [T, ...T[]];

export type PatientResponseDeterministicGuardResultV2 =
  | Readonly<{
      decision: 'PASS';
      candidate: ValidatedPatientResponseTextV2;
    }>
  | Readonly<{
      decision: 'RETRY';
      violations: PatientResponseNonEmptyArrayV2<PatientResponseDeterministicViolationCodeV2>;
    }>;

export const PATIENT_RESPONSE_VALIDATION_SCHEMA_VERSION_V2 = '1.0' as const;

export type PatientResponseViolationCodeV2 =
  | 'ROLE_BREAK'
  | 'PROTECTED_LEAK'
  | 'UNSUPPORTED_FACT'
  | 'FACT_CONTRADICTION'
  | 'HISTORY_CONTRADICTION'
  | 'DISCLOSURE_VIOLATION'
  | 'INTERNAL_IDENTIFIER'
  | 'META_OUTPUT'
  | 'OTHER_UNSAFE_OUTPUT';

export type PatientResponseValidationResultV2 =
  | Readonly<{
      schemaVersion: typeof PATIENT_RESPONSE_VALIDATION_SCHEMA_VERSION_V2;
      decision: 'PASS';
      violations: readonly [];
    }>
  | Readonly<{
      schemaVersion: typeof PATIENT_RESPONSE_VALIDATION_SCHEMA_VERSION_V2;
      decision: 'RETRY';
      violations: PatientResponseNonEmptyArrayV2<PatientResponseViolationCodeV2>;
    }>;
