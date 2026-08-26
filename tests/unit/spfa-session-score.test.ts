import { describe, expect, it } from 'vitest';

import {
  roundSpfaScoreHalfUpV2,
  scoreSpfaSessionV2,
  SpfaSessionScoringError,
} from '@/lib/cases/v2/score-spfa-session';
import type { ConclusionId } from '@/lib/cases/v2/evaluator-types';
import type { SpfaScoringContextV2, SpfaScoringRequirementContextV2 } from '@/lib/cases/v2/spfa-scoring-context-types';
import { SPFA_SCORING_POLICY_V2_2026_1 } from '@/lib/cases/v2/spfa-scoring-policy-v2';
import type { SpfaScoringPolicyV2 } from '@/lib/cases/v2/spfa-scoring-policy-types';
import type { SpfaSessionScoreV2 } from '@/lib/cases/v2/spfa-session-score-types';
import {
  SpfaSessionScoreValidationError,
  validateSpfaSessionScoreV2,
} from '@/lib/cases/v2/validate-spfa-session-score';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import { validateSpfaProtocolIdV2, validateSpfaProtocolRequirementIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = validateCaseVersionId('casever_20000000-0000-4000-8000-000000000001');
const carePathSpfaRef = 'conclusion_30000000-0000-4000-8000-000000000001' as ConclusionId;
const protocolId = validateSpfaProtocolIdV2('spfa_protocol_40000000-0000-4000-8000-000000000001');
const fingerprint = {
  algorithm: 'sha256' as const,
  canonicalization: 'session-transcript-v2/1' as const,
  value: 'a'.repeat(64),
};

function requirementId(index: number) {
  return validateSpfaProtocolRequirementIdV2(`spfa_requirement_50000000-0000-4000-8000-${index.toString().padStart(12, '0')}`);
}

function targetId(index: number) {
  return validateSpfaRequirementTargetIdV2(`spfa_target_60000000-0000-4000-8000-${index.toString().padStart(12, '0')}`);
}

type RequirementOptions = Readonly<{
  index?: number;
  kind?: 'INFORMATION_REQUIREMENT' | 'ACTION_REQUIREMENT';
  importance?: 'CRITICAL' | 'RELEVANT' | 'OPTIONAL';
  total?: number;
  positive?: number;
  uncertain?: number;
  safetyCritical?: boolean;
  notApplicable?: boolean;
}>;

function requirement(options: RequirementOptions = {}): SpfaScoringRequirementContextV2 {
  const index = options.index ?? 1;
  const kind = options.kind ?? 'INFORMATION_REQUIREMENT';
  if (options.notApplicable) {
    return {
      carePathSpfaRef,
      protocolRef: { protocolId, version: '1.0.0' },
      requirementRef: requirementId(index),
      requirementKind: kind,
      applicability: { status: 'NOT_APPLICABLE', reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' } },
      safetyCriticality: { safetyCritical: options.safetyCritical ?? false },
      targetRefs: [],
      resultStatus: 'NOT_APPLICABLE',
      positiveTargetRefs: [],
      remainingTargetRefs: [],
      uncertainTargetRefs: [],
      totalTargetCount: 0,
      positiveTargetCount: 0,
      remainingTargetCount: 0,
      uncertainTargetCount: 0,
    };
  }
  const total = options.total ?? 1;
  const positive = options.positive ?? total;
  const uncertain = options.uncertain ?? 0;
  const targetRefs = Array.from({ length: total }, (_, offset) => targetId(index * 100 + offset));
  const positiveTargetRefs = targetRefs.slice(0, positive);
  const remainingTargetRefs = targetRefs.slice(positive);
  const uncertainTargetRefs = remainingTargetRefs.slice(0, uncertain);
  const resultStatus = kind === 'INFORMATION_REQUIREMENT'
    ? positive === total ? 'COVERED' : positive === 0 ? 'NOT_COVERED' : 'PARTIALLY_COVERED'
    : positive === total ? 'PERFORMED' : positive === 0 ? 'NOT_PERFORMED' : 'PARTIALLY_PERFORMED';
  const importance = options.importance ?? 'RELEVANT';
  return {
    carePathSpfaRef,
    protocolRef: { protocolId, version: '1.0.0' },
    requirementRef: requirementId(index),
    requirementKind: kind,
    applicability: { status: 'APPLICABLE', effectiveImportance: importance },
    effectiveImportance: importance,
    safetyCriticality: { safetyCritical: options.safetyCritical ?? false },
    targetRefs,
    resultStatus,
    positiveTargetRefs,
    remainingTargetRefs,
    uncertainTargetRefs,
    totalTargetCount: total,
    positiveTargetCount: positive,
    remainingTargetCount: total - positive,
    uncertainTargetCount: uncertain,
  };
}

function context(requirements: readonly SpfaScoringRequirementContextV2[]): SpfaScoringContextV2 {
  return {
    schemaVersion: '2.0',
    sessionId,
    caseVersionId,
    protocolCatalogRef: { id: 'spfa-catalog', version: '2026.1' },
    transcriptFingerprint: fingerprint,
    requirements,
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function score(requirements: readonly SpfaScoringRequirementContextV2[], policy = SPFA_SCORING_POLICY_V2_2026_1) {
  return scoreSpfaSessionV2(context(requirements), policy);
}

describe('scoreSpfaSessionV2 basic points', () => {
  it.each([
    ['CRITICAL', 3],
    ['RELEVANT', 2],
    ['OPTIONAL', 1],
  ] as const)('awards full %s credit from policy', (importance, points) => {
    const result = score([requirement({ importance })]);
    expect(result).toMatchObject({ rawPoints: points, possiblePoints: points, score: 100, status: 'SCORED' });
    expect(result.requirementContributions[0]).toMatchObject({ earnedPoints: points, possiblePoints: points });
  });

  it('applies TARGET_RATIO without rounding a RELEVANT 3/4 contribution', () => {
    const result = score([requirement({ importance: 'RELEVANT', total: 4, positive: 3 })]);
    expect(result.requirementContributions[0]).toMatchObject({ earnedPoints: 1.5, possiblePoints: 2 });
    expect(result).toMatchObject({ rawPoints: 1.5, possiblePoints: 2, score: 75 });
  });

  it('scores a CRITICAL 1/3 contribution as exactly 1 point', () => {
    const result = score([requirement({ importance: 'CRITICAL', total: 3, positive: 1 })]);
    expect(result.requirementContributions[0].earnedPoints).toBe(1);
  });

  it.each([
    ['NOT_COVERED', requirement({ positive: 0 })],
    ['NOT_PERFORMED', requirement({ kind: 'ACTION_REQUIREMENT', positive: 0 })],
  ])('awards zero for %s', (_status, input) => {
    expect(score([input]).requirementContributions[0].earnedPoints).toBe(0);
  });

  it('keeps NOT_APPLICABLE in contributions but outside the denominator', () => {
    const result = score([
      requirement({ index: 1, notApplicable: true }),
      requirement({ index: 2, importance: 'OPTIONAL' }),
    ]);
    expect(result.requirementContributions[0]).toMatchObject({ applicability: 'NOT_APPLICABLE', earnedPoints: 0, possiblePoints: 0 });
    expect(result).toMatchObject({ rawPoints: 1, possiblePoints: 1, score: 100 });
  });

  it('mixes 3/2/1 policy weights into the correct global score', () => {
    const result = score([
      requirement({ index: 1, importance: 'CRITICAL' }),
      requirement({ index: 2, importance: 'RELEVANT', total: 2, positive: 1 }),
      requirement({ index: 3, importance: 'OPTIONAL', positive: 0 }),
    ]);
    expect(result).toMatchObject({ rawPoints: 4, possiblePoints: 6, score: 66.7 });
  });
});

describe('UNCERTAIN and criticality', () => {
  it('gives uncertain targets no credit and requires review', () => {
    const result = score([requirement({ total: 2, positive: 0, uncertain: 1 })]);
    expect(result).toMatchObject({ rawPoints: 0, possiblePoints: 2, score: 0, needsReview: true, status: 'REVIEW_REQUIRED' });
  });

  it('uses only positive targets in a mixed positive/uncertain ratio', () => {
    const result = score([requirement({ total: 4, positive: 2, uncertain: 1 })]);
    expect(result.requirementContributions[0].earnedPoints).toBe(1);
    expect(result.score).toBe(50);
  });

  it('distinguishes NOT_SUPPORTED from UNCERTAIN despite equal zero credit', () => {
    const unsupported = score([requirement({ positive: 0, uncertain: 0 })]);
    const uncertain = score([requirement({ positive: 0, uncertain: 1 })]);
    expect(unsupported.rawPoints).toBe(uncertain.rawPoints);
    expect(unsupported.status).toBe('SCORED');
    expect(uncertain.status).toBe('REVIEW_REQUIRED');
  });

  it('creates omission and uncertain alerts for a fully omitted critical uncertain requirement', () => {
    const result = score([requirement({ positive: 0, uncertain: 1, safetyCritical: true })]);
    expect(result.criticalAlerts.map((alert) => alert.code)).toEqual(['CRITICAL_OMISSION', 'CRITICAL_UNCERTAIN']);
    expect(result.needsReview).toBe(true);
  });

  it('creates CRITICAL_OMISSION without forcing review when there is no uncertainty', () => {
    const result = score([requirement({ positive: 0, safetyCritical: true })]);
    expect(result.criticalAlerts.map((alert) => alert.code)).toEqual(['CRITICAL_OMISSION']);
    expect(result).toMatchObject({ status: 'SCORED', needsReview: false });
  });

  it('creates differentiated CRITICAL_PARTIAL alert', () => {
    const result = score([requirement({ total: 2, positive: 1, safetyCritical: true })]);
    expect(result.criticalAlerts.map((alert) => alert.code)).toEqual(['CRITICAL_PARTIAL']);
  });

  it('creates no omission or partial alert for complete critical work', () => {
    expect(score([requirement({ safetyCritical: true })]).criticalAlerts).toEqual([]);
  });

  it('creates no critical alerts for non-safety-critical requirements', () => {
    expect(score([requirement({ total: 2, positive: 1, uncertain: 1 })]).criticalAlerts).toEqual([]);
  });

  it('keeps canonical alert order by requirement then omission/partial before uncertain', () => {
    const result = score([
      requirement({ index: 1, positive: 0, uncertain: 1, safetyCritical: true }),
      requirement({ index: 2, total: 2, positive: 1, uncertain: 1, safetyCritical: true }),
    ]);
    expect(result.criticalAlerts.map((alert) => [alert.requirementRef, alert.code])).toEqual([
      [requirementId(1), 'CRITICAL_OMISSION'],
      [requirementId(1), 'CRITICAL_UNCERTAIN'],
      [requirementId(2), 'CRITICAL_PARTIAL'],
      [requirementId(2), 'CRITICAL_UNCERTAIN'],
    ]);
  });

  it('does not cap a v1 score', () => {
    expect(score([requirement({ importance: 'CRITICAL' })]).score).toBe(100);
  });

  it('fails closed for a future numeric cap whose activation semantics are undefined', () => {
    const policy = clone(SPFA_SCORING_POLICY_V2_2026_1) as any;
    policy.policyRef.version = 'future';
    policy.criticalityRule.scoreCap = 80;
    expect(() => score([requirement()], policy)).toThrow(/activation-condition/);
  });
});

describe('NOT_SCORABLE and rounding', () => {
  it('returns NOT_SCORABLE when all requirements are NOT_APPLICABLE', () => {
    const result = score([requirement({ index: 1, notApplicable: true }), requirement({ index: 2, notApplicable: true })]);
    expect(result).toMatchObject({ status: 'NOT_SCORABLE', rawPoints: 0, possiblePoints: 0, score: null, needsReview: false });
  });

  it('normalizes one applicable omitted requirement to zero over 100', () => {
    expect(score([requirement({ positive: 0 })])).toMatchObject({ status: 'SCORED', score: 0, possiblePoints: 2 });
  });

  it.each([
    [83.34, 83.3],
    [83.35, 83.4],
    [83.36, 83.4],
    [0, 0],
    [100, 100],
    [1.005, 1.01],
  ])('rounds %s HALF_UP to the expected value %s', (value, expected) => {
    expect(roundSpfaScoreHalfUpV2(value, expected === 1.01 ? 2 : 1)).toBe(expected);
  });

  it('rounds only the final score and preserves repeating contribution precision', () => {
    const result = score([requirement({ importance: 'OPTIONAL', total: 3, positive: 1 })]);
    expect(result.requirementContributions[0].earnedPoints).toBeCloseTo(1 / 3, 15);
    expect(result.rawPoints).toBeCloseTo(1 / 3, 15);
    expect(result.score).toBe(33.3);
  });
});

describe('traceability, purity and no leakage', () => {
  it('keeps one contribution per requirement in canonical order', () => {
    const requirements = [
      requirement({ index: 3, kind: 'ACTION_REQUIREMENT' }),
      requirement({ index: 1 }),
      requirement({ index: 2, notApplicable: true }),
    ];
    const result = score(requirements);
    expect(result.requirementContributions.map((item) => item.requirementRef)).toEqual(requirements.map((item) => item.requirementRef));
  });

  it('preserves policy, catalog, case and transcript identities', () => {
    const result = score([requirement()]);
    expect(result.scoringPolicyRef).toEqual(SPFA_SCORING_POLICY_V2_2026_1.policyRef);
    expect(result.protocolCatalogRef).toEqual({ id: 'spfa-catalog', version: '2026.1' });
    expect(result.caseVersionId).toBe(caseVersionId);
    expect(result.transcriptFingerprint).toEqual(fingerprint);
  });

  it('returns deeply equal output for the same context and policy', () => {
    const input = context([requirement({ total: 3, positive: 2 })]);
    expect(scoreSpfaSessionV2(input, SPFA_SCORING_POLICY_V2_2026_1)).toEqual(scoreSpfaSessionV2(input, SPFA_SCORING_POLICY_V2_2026_1));
  });

  it('contains no protected source, evidence, provider, pass/fail or feedback fields', () => {
    const result = score([requirement()]);
    const serialized = JSON.stringify(result);
    const keys = new Set<string>();
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (typeof value !== 'object' || value === null) return;
      Object.entries(value).forEach(([key, item]) => {
        keys.add(key);
        visit(item);
      });
    };
    visit(result);
    for (const forbidden of ['transcript', 'messages', 'evidence', 'excerpt', 'evaluator', 'patientFacts', 'provider', 'prompt', 'responseModel', 'passed', 'failed', 'threshold', 'grade', 'feedback']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(serialized).not.toContain('provider raw response');
  });
});

describe('SpfaSessionScoreV2 strict validation and fail-closed behavior', () => {
  function canonical(): { contextValue: SpfaScoringContextV2; scoreValue: SpfaSessionScoreV2 } {
    const contextValue = context([requirement({ total: 2, positive: 1, uncertain: 1, safetyCritical: true })]);
    return { contextValue, scoreValue: scoreSpfaSessionV2(contextValue, SPFA_SCORING_POLICY_V2_2026_1) };
  }

  it('validates the canonical result against context and policy', () => {
    const value = canonical();
    expect(validateSpfaSessionScoreV2(value.scoreValue, value.contextValue, SPFA_SCORING_POLICY_V2_2026_1)).toEqual(value.scoreValue);
  });

  it('rejects invalid context before scoring', () => {
    const input = context([requirement()]) as any;
    input.requirements[0].positiveTargetCount = 2;
    expect(() => scoreSpfaSessionV2(input, SPFA_SCORING_POLICY_V2_2026_1)).toThrowError(SpfaSessionScoringError);
  });

  it('rejects invalid policy before scoring', () => {
    const policy = clone(SPFA_SCORING_POLICY_V2_2026_1) as any;
    policy.pointsByImportance.CRITICAL = Number.NaN;
    expect(() => scoreSpfaSessionV2(context([requirement()]), policy)).toThrow(/invalid SPFA scoring policy/);
  });

  it.each([
    ['inconsistent score', (value: any) => { value.score = 40; }],
    ['earned above possible', (value: any) => { value.requirementContributions[0].earnedPoints = 4; }],
    ['score above 100', (value: any) => { value.score = 101; }],
    ['negative score', (value: any) => { value.score = -1; }],
    ['NaN raw points', (value: any) => { value.rawPoints = Number.NaN; }],
    ['infinite possible points', (value: any) => { value.possiblePoints = Number.POSITIVE_INFINITY; }],
  ])('rejects %s', (_label, mutate) => {
    const value = canonical();
    const input = clone(value.scoreValue) as any;
    mutate(input);
    expect(() => validateSpfaSessionScoreV2(input, value.contextValue, SPFA_SCORING_POLICY_V2_2026_1)).toThrowError(SpfaSessionScoreValidationError);
  });

  it('rejects NOT_SCORABLE with numeric score', () => {
    const contextValue = context([requirement({ notApplicable: true })]);
    const input = clone(scoreSpfaSessionV2(contextValue, SPFA_SCORING_POLICY_V2_2026_1)) as any;
    input.score = 0;
    expect(() => validateSpfaSessionScoreV2(input, contextValue, SPFA_SCORING_POLICY_V2_2026_1)).toThrow(/must be null/);
  });

  it('rejects SCORED or REVIEW_REQUIRED with null score', () => {
    const value = canonical();
    const input = clone(value.scoreValue) as any;
    input.score = null;
    expect(() => validateSpfaSessionScoreV2(input, value.contextValue, SPFA_SCORING_POLICY_V2_2026_1)).toThrow(/finite non-negative/);
  });

  it('rejects unexpected root and nested properties', () => {
    const value = canonical();
    const root = { ...value.scoreValue, futureSecret: true };
    expect(() => validateSpfaSessionScoreV2(root, value.contextValue, SPFA_SCORING_POLICY_V2_2026_1)).toThrow(/unexpected property/);
    const nested = clone(value.scoreValue) as any;
    nested.requirementContributions[0].evidence = [];
    expect(() => validateSpfaSessionScoreV2(nested, value.contextValue, SPFA_SCORING_POLICY_V2_2026_1)).toThrow(/unexpected property/);
  });

  it('rejects reordered or duplicate contributions and alerts through contextual comparison', () => {
    const contextValue = context([
      requirement({ index: 1, positive: 0, uncertain: 1, safetyCritical: true }),
      requirement({ index: 2 }),
    ]);
    const canonicalValue = scoreSpfaSessionV2(contextValue, SPFA_SCORING_POLICY_V2_2026_1);
    const reordered = clone(canonicalValue) as any;
    reordered.requirementContributions.reverse();
    expect(() => validateSpfaSessionScoreV2(reordered, contextValue, SPFA_SCORING_POLICY_V2_2026_1)).toThrow(/canonical score/);
    const duplicateAlert = clone(canonicalValue) as any;
    duplicateAlert.criticalAlerts.push(clone(duplicateAlert.criticalAlerts[0]));
    expect(() => validateSpfaSessionScoreV2(duplicateAlert, contextValue, SPFA_SCORING_POLICY_V2_2026_1)).toThrow(/duplicate critical alert/);
  });
});
