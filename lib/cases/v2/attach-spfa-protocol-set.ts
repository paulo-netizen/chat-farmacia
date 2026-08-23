import type { CanonicalGeneratedCaseCoreV2 } from './generation-assembly-types';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from './spfa-protocol-set-types';
import {
  SpfaProtocolSetValidationError,
  validateCaseSpfaProtocolSetAgainstCanonicalContextV2,
  validateSpfaProtocolSetClinicalContextV2,
} from './validate-spfa-protocol-set';

export const SPFA_PROTOCOL_SET_INTEGRATION_VERSION =
  'spfa-protocol-set-integration/1' as const;

function fail(path: string, message: string): never {
  throw new SpfaProtocolSetValidationError(path, message);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
}

export function attachSpfaProtocolSetToGeneratedCaseCoreV2(
  coreInput: CanonicalGeneratedCaseCoreV2,
  spfaProtocolSetInput: unknown,
): SpfaIntegratedGeneratedCaseCoreV2 {
  const source = asRecord(coreInput, 'core');
  assertExactKeys(source, ['caseVersionId', 'patientFacts', 'evaluator'], 'core');

  const core = validateSpfaProtocolSetClinicalContextV2(
    {
      caseVersionId: coreInput.caseVersionId,
      patientFacts: coreInput.patientFacts,
      evaluator: coreInput.evaluator,
    },
    'core',
  );
  const spfaProtocolSet =
    validateCaseSpfaProtocolSetAgainstCanonicalContextV2(
      spfaProtocolSetInput,
      core,
    );

  return {
    caseVersionId: core.caseVersionId,
    patientFacts: core.patientFacts,
    evaluator: core.evaluator,
    spfaProtocolSet,
  };
}
