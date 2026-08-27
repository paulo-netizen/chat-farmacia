import { buildPharmaceuticalEvaluationTargetSetV2 } from './build-pharmaceutical-evaluation-target-set';
import type { PharmaceuticalClinicalReferenceV2 } from './pharmaceutical-clinical-reference-types';
import type { PharmaceuticalEvaluationTargetSetV2 } from './pharmaceutical-evaluation-target-types';

export class PharmaceuticalEvaluationTargetSetValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalEvaluationTargetSetValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalEvaluationTargetSetValidationError(path, message);
}

function assertExact(actual: unknown, expected: unknown, path: string): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) fail(path, 'must be an array');
    if (actual.length !== expected.length) fail(path, 'must contain the canonical targets');
    expected.forEach((item, index) => assertExact(actual[index], item, `${path}[${index}]`));
    return;
  }
  if (typeof expected === 'object' && expected !== null) {
    if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) {
      fail(path, 'must be an object');
    }
    const actualRecord = actual as Record<string, unknown>;
    const expectedRecord = expected as Record<string, unknown>;
    const actualKeys = Object.keys(actualRecord);
    const expectedKeys = Object.keys(expectedRecord);
    for (const key of actualKeys) {
      if (!Object.prototype.hasOwnProperty.call(expectedRecord, key)) {
        fail(`${path}.${key}`, 'unexpected property');
      }
    }
    for (const key of expectedKeys) {
      if (!Object.prototype.hasOwnProperty.call(actualRecord, key)) {
        fail(`${path}.${key}`, 'missing required property');
      }
      assertExact(actualRecord[key], expectedRecord[key], `${path}.${key}`);
    }
    return;
  }
  if (actual !== expected) fail(path, 'does not match the canonical clinical target set');
}

/**
 * Fail-closed validation against the authoritative clinical reference. Rebuilding
 * the complete allowlist also verifies applicability, references, order, IDs and
 * the fingerprint without accepting provider-authored targets or defaults.
 */
export function validatePharmaceuticalEvaluationTargetSetV2(
  input: unknown,
  clinicalReference: PharmaceuticalClinicalReferenceV2,
): PharmaceuticalEvaluationTargetSetV2 {
  const expected = buildPharmaceuticalEvaluationTargetSetV2(clinicalReference);
  assertExact(input, expected, 'pharmaceuticalEvaluationTargetSet');
  return expected;
}
