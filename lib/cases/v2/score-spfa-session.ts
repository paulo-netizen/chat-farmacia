import type { SpfaScoringContextV2, SpfaScoringRequirementContextV2 } from './spfa-scoring-context-types';
import type { SpfaScoringPolicyV2 } from './spfa-scoring-policy-types';
import type { SpfaCriticalAlertV2, SpfaRequirementContributionV2, SpfaSessionScoreV2 } from './spfa-session-score-types';
import { validateSpfaScoringContextV2 } from './validate-spfa-scoring-context';
import { validateSpfaScoringPolicyV2 } from './validate-spfa-scoring-policy';

type Fraction = Readonly<{ numerator: bigint; denominator: bigint }>;

export class SpfaSessionScoringError extends Error {
  constructor(public readonly path: string, message: string, public readonly cause?: unknown) {
    super(`${path}: ${message}`);
    this.name = 'SpfaSessionScoringError';
  }
}

function fail(path: string, message: string, cause?: unknown): never {
  throw new SpfaSessionScoringError(path, message, cause);
}

function gcd(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a === 0n ? 1n : a;
}

function fraction(numerator: bigint, denominator: bigint): Fraction {
  if (denominator <= 0n) fail('number', 'fraction denominator must be positive');
  const divisor = gcd(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
}

function decimalFraction(value: number): Fraction {
  if (!Number.isFinite(value) || value < 0) fail('number', 'must be a finite non-negative number');
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(value.toString());
  if (match === null) fail('number', 'cannot be represented as a canonical decimal');
  const integer = match[1];
  const decimals = match[2] ?? '';
  const exponent = Number(match[3] ?? 0);
  const digits = BigInt(`${integer}${decimals}`);
  const scale = decimals.length - exponent;
  return scale <= 0
    ? fraction(digits * 10n ** BigInt(-scale), 1n)
    : fraction(digits, 10n ** BigInt(scale));
}

function add(left: Fraction, right: Fraction): Fraction {
  return fraction(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function multiply(left: Fraction, right: Fraction): Fraction {
  return fraction(left.numerator * right.numerator, left.denominator * right.denominator);
}

function divide(left: Fraction, right: Fraction): Fraction {
  if (right.numerator === 0n) fail('number', 'division by zero');
  return fraction(left.numerator * right.denominator, left.denominator * right.numerator);
}

function toNumber(value: Fraction): number {
  const result = Number(value.numerator) / Number(value.denominator);
  if (!Number.isFinite(result)) fail('number', 'fraction exceeds finite number range');
  return result;
}

function roundFractionHalfUp(value: Fraction, decimals: number): number {
  const scale = 10n ** BigInt(decimals);
  const scaledNumerator = value.numerator * scale;
  let rounded = scaledNumerator / value.denominator;
  const remainder = scaledNumerator % value.denominator;
  if (remainder * 2n >= value.denominator) rounded += 1n;
  return Number(rounded) / Number(scale);
}

export function roundSpfaScoreHalfUpV2(value: number, decimals: number): number {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 6) {
    fail('rounding.decimals', 'must be an integer between 0 and 6');
  }
  return roundFractionHalfUp(decimalFraction(value), decimals);
}

function statusIsComplete(requirement: SpfaScoringRequirementContextV2): boolean {
  return requirement.resultStatus === 'COVERED' || requirement.resultStatus === 'PERFORMED';
}

function statusIsPartial(requirement: SpfaScoringRequirementContextV2): boolean {
  return requirement.resultStatus === 'PARTIALLY_COVERED' || requirement.resultStatus === 'PARTIALLY_PERFORMED';
}

function contributionFor(
  requirement: SpfaScoringRequirementContextV2,
  policy: SpfaScoringPolicyV2,
): { contribution: SpfaRequirementContributionV2; earned: Fraction; possible: Fraction } {
  const common = {
    carePathSpfaRef: requirement.carePathSpfaRef,
    protocolRef: { ...requirement.protocolRef },
    requirementRef: requirement.requirementRef,
    requirementKind: requirement.requirementKind,
    safetyCriticality: { ...requirement.safetyCriticality },
    resultStatus: requirement.resultStatus,
    totalTargetCount: requirement.totalTargetCount,
    positiveTargetCount: requirement.positiveTargetCount,
    remainingTargetCount: requirement.remainingTargetCount,
    uncertainTargetCount: requirement.uncertainTargetCount,
  };
  if (requirement.applicability.status === 'NOT_APPLICABLE') {
    const zero = fraction(0n, 1n);
    return {
      contribution: {
        ...common,
        applicability: 'NOT_APPLICABLE',
        earnedPoints: 0,
        possiblePoints: 0,
      },
      earned: zero,
      possible: zero,
    };
  }

  const effectiveImportance = requirement.applicability.effectiveImportance;
  const possible = decimalFraction(policy.pointsByImportance[effectiveImportance]);
  let earned: Fraction;
  if (statusIsComplete(requirement)) {
    earned = possible;
  } else if (statusIsPartial(requirement)) {
    if (policy.partialCreditRule !== 'TARGET_RATIO') fail('policy.partialCreditRule', 'unsupported partial credit rule');
    earned = multiply(possible, fraction(BigInt(requirement.positiveTargetCount), BigInt(requirement.totalTargetCount)));
  } else {
    earned = fraction(0n, 1n);
  }
  return {
    contribution: {
      ...common,
      applicability: 'APPLICABLE',
      effectiveImportance,
      earnedPoints: toNumber(earned),
      possiblePoints: toNumber(possible),
    },
    earned,
    possible,
  };
}

function alertsFor(
  requirement: SpfaScoringRequirementContextV2,
  policy: SpfaScoringPolicyV2,
): readonly SpfaCriticalAlertV2[] {
  if (requirement.applicability.status === 'NOT_APPLICABLE' || !requirement.safetyCriticality.safetyCritical) return [];
  const alerts: SpfaCriticalAlertV2[] = [];
  const identity = { carePathSpfaRef: requirement.carePathSpfaRef, requirementRef: requirement.requirementRef };
  if (requirement.positiveTargetCount === 0 && policy.criticalityRule.alertOnOmission) {
    alerts.push({ ...identity, code: 'CRITICAL_OMISSION' });
  } else if (requirement.remainingTargetCount > 0 && policy.criticalityRule.alertOnPartial) {
    alerts.push({ ...identity, code: 'CRITICAL_PARTIAL' });
  }
  if (requirement.uncertainTargetCount > 0 && policy.criticalityRule.alertOnUncertain) {
    alerts.push({ ...identity, code: 'CRITICAL_UNCERTAIN' });
  }
  return alerts;
}

export function scoreSpfaSessionV2(
  contextValue: SpfaScoringContextV2,
  policyValue: SpfaScoringPolicyV2,
): SpfaSessionScoreV2 {
  let context: SpfaScoringContextV2;
  let policy: SpfaScoringPolicyV2;
  try {
    context = validateSpfaScoringContextV2(contextValue);
  } catch (cause) {
    fail('context', 'invalid SPFA scoring context', cause);
  }
  try {
    policy = validateSpfaScoringPolicyV2(policyValue);
  } catch (cause) {
    fail('policy', 'invalid SPFA scoring policy', cause);
  }
  if (policy.criticalityRule.scoreCap !== null) {
    fail('policy.criticalityRule.scoreCap', 'numeric caps require a future activation-condition contract');
  }
  if (policy.rounding.mode !== 'HALF_UP' || policy.rounding.applyAt !== 'FINAL_SCORE_ONLY') {
    fail('policy.rounding', 'unsupported rounding policy');
  }

  let raw = fraction(0n, 1n);
  let possible = fraction(0n, 1n);
  const requirementContributions: SpfaRequirementContributionV2[] = [];
  const criticalAlerts: SpfaCriticalAlertV2[] = [];
  for (const requirement of context.requirements) {
    const projected = contributionFor(requirement, policy);
    requirementContributions.push(projected.contribution);
    raw = add(raw, projected.earned);
    possible = add(possible, projected.possible);
    criticalAlerts.push(...alertsFor(requirement, policy));
  }

  const base = {
    schemaVersion: '2.0' as const,
    sessionId: context.sessionId,
    caseVersionId: context.caseVersionId,
    transcriptFingerprint: { ...context.transcriptFingerprint },
    protocolCatalogRef: { ...context.protocolCatalogRef },
    scoringPolicyRef: { ...policy.policyRef },
    rawPoints: toNumber(raw),
    possiblePoints: toNumber(possible),
    requirementContributions,
    criticalAlerts,
  };
  if (possible.numerator === 0n) {
    return { ...base, status: 'NOT_SCORABLE', score: null, needsReview: false };
  }
  const hasUncertain = context.requirements.some(
    (requirement) => requirement.applicability.status === 'APPLICABLE' && requirement.uncertainTargetCount > 0,
  );
  const scoreFraction = multiply(divide(raw, possible), fraction(100n, 1n));
  const score = roundFractionHalfUp(scoreFraction, policy.rounding.decimals);
  if (!Number.isFinite(score) || score < 0 || score > 100) fail('score', 'calculated score is outside 0..100');
  return hasUncertain
    ? { ...base, status: 'REVIEW_REQUIRED', score, needsReview: true }
    : { ...base, status: 'SCORED', score, needsReview: false };
}
