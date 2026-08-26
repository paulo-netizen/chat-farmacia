import type { VersionRef } from './evaluator-types';
import type { SpfaScoringPolicyV2 } from './spfa-scoring-policy-types';

export const SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2 = Object.freeze({
  maxPointsPerRequirement: 1_000,
  maxScoreCap: 100,
  maxRoundingDecimals: 6,
});

export class SpfaScoringPolicyValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'SpfaScoringPolicyValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new SpfaScoringPolicyValidationError(path, message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  source: Record<string, unknown>,
  keys: readonly string[],
  path: string,
): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      fail(`${path}.${key}`, 'missing required property');
    }
  }
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    fail(path, 'must be a non-empty, unpadded string');
  }
  return value;
}

function versionRef(value: unknown, path: string): Readonly<VersionRef> {
  const source = record(value, path);
  exactKeys(source, ['id', 'version'], path);
  return {
    id: nonEmptyString(source.id, `${path}.id`),
    version: nonEmptyString(source.version, `${path}.version`),
  };
}

function literal<const T extends string>(
  value: unknown,
  expected: T,
  path: string,
): T {
  if (value !== expected) fail(path, `must be ${expected}`);
  return expected;
}

function boolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be boolean');
  return value;
}

function positiveFinitePoints(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value <= 0 ||
    value > SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2.maxPointsPerRequirement
  ) {
    fail(
      path,
      `must be a finite number greater than 0 and at most ${SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2.maxPointsPerRequirement}`,
    );
  }
  return value;
}

function scoreCap(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2.maxScoreCap
  ) {
    fail(
      path,
      `must be null or a finite number between 0 and ${SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2.maxScoreCap}`,
    );
  }
  return value;
}

function roundingDecimals(value: unknown, path: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2.maxRoundingDecimals
  ) {
    fail(
      path,
      `must be an integer between 0 and ${SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2.maxRoundingDecimals}`,
    );
  }
  return value;
}

export function validateSpfaScoringPolicyV2(
  value: unknown,
): SpfaScoringPolicyV2 {
  const path = 'spfaScoringPolicy';
  const source = record(value, path);
  exactKeys(
    source,
    [
      'schemaVersion',
      'policyRef',
      'pointsByImportance',
      'partialCreditRule',
      'uncertainRule',
      'criticalityRule',
      'notApplicableRule',
      'noApplicableRequirementsRule',
      'passFailRule',
      'rounding',
    ],
    path,
  );
  if (source.schemaVersion !== '2.0') {
    fail(`${path}.schemaVersion`, 'must be 2.0');
  }

  const points = record(source.pointsByImportance, `${path}.pointsByImportance`);
  exactKeys(points, ['CRITICAL', 'RELEVANT', 'OPTIONAL'], `${path}.pointsByImportance`);

  const criticality = record(source.criticalityRule, `${path}.criticalityRule`);
  exactKeys(
    criticality,
    ['alertOnOmission', 'alertOnPartial', 'alertOnUncertain', 'scoreCap'],
    `${path}.criticalityRule`,
  );

  const rounding = record(source.rounding, `${path}.rounding`);
  exactKeys(rounding, ['decimals', 'mode', 'applyAt'], `${path}.rounding`);

  return {
    schemaVersion: '2.0',
    policyRef: versionRef(source.policyRef, `${path}.policyRef`),
    pointsByImportance: {
      CRITICAL: positiveFinitePoints(points.CRITICAL, `${path}.pointsByImportance.CRITICAL`),
      RELEVANT: positiveFinitePoints(points.RELEVANT, `${path}.pointsByImportance.RELEVANT`),
      OPTIONAL: positiveFinitePoints(points.OPTIONAL, `${path}.pointsByImportance.OPTIONAL`),
    },
    partialCreditRule: literal(source.partialCreditRule, 'TARGET_RATIO', `${path}.partialCreditRule`),
    uncertainRule: literal(source.uncertainRule, 'NO_CREDIT_REVIEW', `${path}.uncertainRule`),
    criticalityRule: {
      alertOnOmission: boolean(criticality.alertOnOmission, `${path}.criticalityRule.alertOnOmission`),
      alertOnPartial: boolean(criticality.alertOnPartial, `${path}.criticalityRule.alertOnPartial`),
      alertOnUncertain: boolean(criticality.alertOnUncertain, `${path}.criticalityRule.alertOnUncertain`),
      scoreCap: scoreCap(criticality.scoreCap, `${path}.criticalityRule.scoreCap`),
    },
    notApplicableRule: literal(source.notApplicableRule, 'EXCLUDE_FROM_DENOMINATOR', `${path}.notApplicableRule`),
    noApplicableRequirementsRule: literal(source.noApplicableRequirementsRule, 'NOT_SCORABLE', `${path}.noApplicableRequirementsRule`),
    passFailRule: literal(source.passFailRule, 'NONE', `${path}.passFailRule`),
    rounding: {
      decimals: roundingDecimals(rounding.decimals, `${path}.rounding.decimals`),
      mode: literal(rounding.mode, 'HALF_UP', `${path}.rounding.mode`),
      applyAt: literal(
        rounding.applyAt,
        'FINAL_SCORE_ONLY',
        `${path}.rounding.applyAt`,
      ),
    },
  };
}
