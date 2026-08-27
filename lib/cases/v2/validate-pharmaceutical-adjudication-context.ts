import {
  buildPharmaceuticalAdjudicationContextSetV2,
  type BuildPharmaceuticalAdjudicationContextInputV2,
} from './build-pharmaceutical-adjudication-context';
import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';

type UnknownRecord = Record<string, unknown>;

export class PharmaceuticalAdjudicationContextValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalAdjudicationContextValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalAdjudicationContextValidationError(path, message);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as UnknownRecord;
}

function assertExact(actual: unknown, expected: unknown, path: string): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) fail(path, 'must be an array');
    if (actual.length !== expected.length) fail(path, 'must contain the canonical context');
    expected.forEach((item, index) => assertExact(actual[index], item, `${path}[${index}]`));
    return;
  }
  if (typeof expected === 'object' && expected !== null) {
    const actualRecord = record(actual, path);
    const expectedRecord = expected as UnknownRecord;
    for (const key of Object.keys(actualRecord)) {
      if (!Object.prototype.hasOwnProperty.call(expectedRecord, key)) {
        fail(`${path}.${key}`, 'unexpected property');
      }
    }
    for (const key of Object.keys(expectedRecord)) {
      if (!Object.prototype.hasOwnProperty.call(actualRecord, key)) {
        fail(`${path}.${key}`, 'missing required property');
      }
      assertExact(actualRecord[key], expectedRecord[key], `${path}.${key}`);
    }
    return;
  }
  if (actual !== expected) fail(path, 'does not match the reconstructed canonical context');
}

/**
 * Strict fail-closed validation by complete reconstruction from server-owned
 * inputs. This verifies all pinning, projections, ordering and fingerprints
 * without trusting any field carried by the candidate context.
 */
export function validatePharmaceuticalAdjudicationContextSetV2(
  input: unknown,
  source: BuildPharmaceuticalAdjudicationContextInputV2,
): PharmaceuticalAdjudicationContextSetV2 {
  const expected = buildPharmaceuticalAdjudicationContextSetV2(source);
  assertExact(input, expected, 'pharmaceuticalAdjudicationContext');
  return expected;
}
