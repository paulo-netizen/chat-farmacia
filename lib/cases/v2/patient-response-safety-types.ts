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
