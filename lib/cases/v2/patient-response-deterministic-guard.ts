import type {
  PatientResponseCandidateV2,
  PatientResponseDeterministicGuardResultV2,
  PatientResponseDeterministicViolationCodeV2,
  ValidatedPatientResponseTextV2,
} from './patient-response-safety-types';

export const PATIENT_RESPONSE_DETERMINISTIC_GUARD_VERSION_V2 = '1.0' as const;
export const MAX_PATIENT_RESPONSE_CHARACTERS = 4096;
export const MAX_PATIENT_RESPONSE_UTF8_BYTES = 16384;

const CANONICAL_UUID_SOURCE =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';

const INTERNAL_IDENTIFIER_PATTERN = new RegExp(
  `(?:fact|med|use|casever)_${CANONICAL_UUID_SOURCE}`,
);

const INTERNAL_PROTOCOL_PATTERN = /patient_character_data/i;

const UNAMBIGUOUS_META_OUTPUT_PATTERNS = [
  /\bas\s+an\s+ai\s+language\s+model\b/i,
  /\bcomo\s+modelo\s+de\s+lenguaje\s+de\s+openai\b/i,
] as const;

function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function characterLength(value: string): number {
  return Array.from(value).length;
}

function retry(
  firstViolation: PatientResponseDeterministicViolationCodeV2,
  ...remainingViolations: PatientResponseDeterministicViolationCodeV2[]
): PatientResponseDeterministicGuardResultV2 {
  return {
    decision: 'RETRY',
    violations: [firstViolation, ...remainingViolations],
  };
}

export function guardPatientResponseCandidateV2(
  candidate: PatientResponseCandidateV2,
): PatientResponseDeterministicGuardResultV2 {
  if (typeof candidate.text !== 'string') {
    return retry('INVALID_CANDIDATE');
  }

  const text = candidate.text;
  if (text.trim().length === 0) {
    return retry('EMPTY_CANDIDATE');
  }

  const violations: PatientResponseDeterministicViolationCodeV2[] = [];

  if (
    characterLength(text) > MAX_PATIENT_RESPONSE_CHARACTERS ||
    utf8ByteLength(text) > MAX_PATIENT_RESPONSE_UTF8_BYTES
  ) {
    violations.push('CANDIDATE_TOO_LARGE');
  }

  if (INTERNAL_IDENTIFIER_PATTERN.test(text)) {
    violations.push('INTERNAL_IDENTIFIER');
  }

  if (INTERNAL_PROTOCOL_PATTERN.test(text)) {
    violations.push('INTERNAL_PROTOCOL_OUTPUT');
  }

  if (UNAMBIGUOUS_META_OUTPUT_PATTERNS.some((pattern) => pattern.test(text))) {
    violations.push('UNAMBIGUOUS_META_OUTPUT');
  }

  if (violations.length > 0) {
    return retry(violations[0], ...violations.slice(1));
  }

  return {
    decision: 'PASS',
    candidate: text as ValidatedPatientResponseTextV2,
  };
}
