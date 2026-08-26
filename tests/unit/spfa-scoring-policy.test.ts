import { describe, expect, it } from 'vitest';

import { SPFA_SCORING_POLICY_V2_2026_1 } from '@/lib/cases/v2/spfa-scoring-policy-v2';
import {
  SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2,
  SpfaScoringPolicyValidationError,
  validateSpfaScoringPolicyV2,
} from '@/lib/cases/v2/validate-spfa-scoring-policy';

function genericPolicy(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    policyRef: { id: 'future-spfa-scoring-policy', version: '2027.2' },
    pointsByImportance: { CRITICAL: 4.5, RELEVANT: 2.5, OPTIONAL: 0.5 },
    partialCreditRule: 'TARGET_RATIO',
    uncertainRule: 'NO_CREDIT_REVIEW',
    criticalityRule: {
      alertOnOmission: false,
      alertOnPartial: true,
      alertOnUncertain: false,
      scoreCap: 80,
    },
    notApplicableRule: 'EXCLUDE_FROM_DENOMINATOR',
    noApplicableRequirementsRule: 'NOT_SCORABLE',
    passFailRule: 'NONE',
    rounding: { decimals: 2, mode: 'HALF_UP', applyAt: 'FINAL_SCORE_ONLY' },
  };
}

function canonicalCopy(): Record<string, any> {
  return structuredClone(SPFA_SCORING_POLICY_V2_2026_1);
}

describe('SpfaScoringPolicyV2', () => {
  it('validates a generic future versioned policy within contractual limits', () => {
    expect(validateSpfaScoringPolicyV2(genericPolicy())).toEqual(genericPolicy());
  });

  it('validates the canonical server-owned v1 policy', () => {
    expect(validateSpfaScoringPolicyV2(SPFA_SCORING_POLICY_V2_2026_1)).toEqual(SPFA_SCORING_POLICY_V2_2026_1);
  });

  it('rejects an incorrect schemaVersion', () => {
    const input = genericPolicy();
    input.schemaVersion = '1.0';
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/schemaVersion/);
  });

  it.each([
    [{ id: '', version: '1' }, 'id'],
    [{ id: ' policy', version: '1' }, 'id'],
    [{ id: 'policy', version: '' }, 'version'],
    [{ id: 'policy', version: ' 1' }, 'version'],
  ])('rejects invalid policyRef %#', (policyRef, expectedPath) => {
    const input = genericPolicy();
    input.policyRef = policyRef;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(expectedPath);
  });

  it.each(['CRITICAL', 'RELEVANT', 'OPTIONAL'])('rejects missing %s points', (importance) => {
    const input = genericPolicy();
    delete input.pointsByImportance[importance];
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(`pointsByImportance.${importance}`);
  });

  it.each([
    ['negative', -1],
    ['zero', 0],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['numeric string', '3'],
    ['above contractual maximum', SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2.maxPointsPerRequirement + 1],
  ])('rejects a %s importance weight', (_label, value) => {
    const input = genericPolicy();
    input.pointsByImportance.CRITICAL = value;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/pointsByImportance.CRITICAL/);
  });

  it('rejects an invalid partial credit rule', () => {
    const input = genericPolicy();
    input.partialCreditRule = 'FIXED_FRACTION';
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/partialCreditRule/);
  });

  it('rejects an invalid uncertain rule', () => {
    const input = genericPolicy();
    input.uncertainRule = 'TREAT_AS_NOT_SUPPORTED';
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/uncertainRule/);
  });

  it('rejects incomplete criticality rules', () => {
    const input = genericPolicy();
    delete input.criticalityRule.alertOnUncertain;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/alertOnUncertain/);
  });

  it.each([
    ['string', 'none'],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['negative', -1],
    ['above 100', 101],
  ])('rejects an invalid score cap: %s', (_label, scoreCap) => {
    const input = genericPolicy();
    input.criticalityRule.scoreCap = scoreCap;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/scoreCap/);
  });

  it('rejects non-boolean critical alert flags', () => {
    const input = genericPolicy();
    input.criticalityRule.alertOnOmission = 1;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/alertOnOmission/);
  });

  it.each([
    ['notApplicableRule', 'INCLUDE'],
    ['noApplicableRequirementsRule', 'ZERO'],
    ['passFailRule', 'THRESHOLD'],
  ])('rejects invalid %s', (field, value) => {
    const input = genericPolicy();
    input[field] = value;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(field);
  });

  it.each([
    ['fractional', 1.5],
    ['negative', -1],
    ['too large', SPFA_SCORING_POLICY_VALIDATION_LIMITS_V2.maxRoundingDecimals + 1],
    ['string', '1'],
  ])('rejects invalid rounding decimals: %s', (_label, decimals) => {
    const input = genericPolicy();
    input.rounding.decimals = decimals;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/rounding.decimals/);
  });

  it('rejects an invalid rounding mode', () => {
    const input = genericPolicy();
    input.rounding.mode = 'BANKERS';
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/rounding.mode/);
  });

  it('rejects rounding at an intermediate stage', () => {
    const input = genericPolicy();
    input.rounding.applyAt = 'EACH_CONTRIBUTION';
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/rounding.applyAt/);
  });

  it('rejects unexpected root properties', () => {
    const input = genericPolicy();
    input.score = 100;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrowError(SpfaScoringPolicyValidationError);
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/unexpected property/);
  });

  it.each(['policyRef', 'pointsByImportance', 'criticalityRule', 'rounding'])('rejects unexpected nested properties in %s', (field) => {
    const input = genericPolicy();
    input[field].futureRule = true;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/unexpected property/);
  });

  it('rejects an absent mandatory root field', () => {
    const input = genericPolicy();
    delete input.uncertainRule;
    expect(() => validateSpfaScoringPolicyV2(input)).toThrow(/missing required property/);
  });

  it('fixes canonical v1 importance points to 3/2/1', () => {
    expect(SPFA_SCORING_POLICY_V2_2026_1.pointsByImportance).toEqual({
      CRITICAL: 3,
      RELEVANT: 2,
      OPTIONAL: 1,
    });
  });

  it('fixes canonical v1 partial and uncertain rules', () => {
    expect(SPFA_SCORING_POLICY_V2_2026_1.partialCreditRule).toBe('TARGET_RATIO');
    expect(SPFA_SCORING_POLICY_V2_2026_1.uncertainRule).toBe('NO_CREDIT_REVIEW');
  });

  it('requires all three critical alerts and no score cap in v1', () => {
    expect(SPFA_SCORING_POLICY_V2_2026_1.criticalityRule).toEqual({
      alertOnOmission: true,
      alertOnPartial: true,
      alertOnUncertain: true,
      scoreCap: null,
    });
  });

  it('excludes NOT_APPLICABLE and marks an empty applicable denominator NOT_SCORABLE', () => {
    expect(SPFA_SCORING_POLICY_V2_2026_1.notApplicableRule).toBe('EXCLUDE_FROM_DENOMINATOR');
    expect(SPFA_SCORING_POLICY_V2_2026_1.noApplicableRequirementsRule).toBe('NOT_SCORABLE');
  });

  it('defines no pass/fail decision and final-only HALF_UP display rounding to one decimal', () => {
    expect(SPFA_SCORING_POLICY_V2_2026_1.passFailRule).toBe('NONE');
    expect(SPFA_SCORING_POLICY_V2_2026_1.rounding).toEqual({
      decimals: 1,
      mode: 'HALF_UP',
      applyAt: 'FINAL_SCORE_ONLY',
    });
  });

  it('uses the stable canonical policy identity', () => {
    expect(SPFA_SCORING_POLICY_V2_2026_1.policyRef).toEqual({
      id: 'spfa-scoring-standard',
      version: '2026.1',
    });
  });

  it('exports one deeply frozen server-owned policy object', () => {
    expect(Object.isFrozen(SPFA_SCORING_POLICY_V2_2026_1)).toBe(true);
    expect(Object.isFrozen(SPFA_SCORING_POLICY_V2_2026_1.policyRef)).toBe(true);
    expect(Object.isFrozen(SPFA_SCORING_POLICY_V2_2026_1.pointsByImportance)).toBe(true);
    expect(Object.isFrozen(SPFA_SCORING_POLICY_V2_2026_1.criticalityRule)).toBe(true);
    expect(Object.isFrozen(SPFA_SCORING_POLICY_V2_2026_1.rounding)).toBe(true);
    expect(SPFA_SCORING_POLICY_V2_2026_1).toBe(SPFA_SCORING_POLICY_V2_2026_1);
  });

  it('contains policy only, with no session, clinical, provider or scoring result data', () => {
    const serialized = JSON.stringify(SPFA_SCORING_POLICY_V2_2026_1);
    for (const forbidden of ['sessionId', 'userId', 'transcript', 'evidence', 'patientFacts', 'evaluator', 'openai', 'prompt', 'feedback', 'earnedPoints', 'possiblePoints']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('does not silently canonicalize a valid generic policy into v1', () => {
    const input = genericPolicy();
    const parsed = validateSpfaScoringPolicyV2(input);
    expect(parsed).toEqual(input);
    expect(parsed).not.toEqual(canonicalCopy());
  });
});
