import { describe, expect, it } from 'vitest';

import {
  buildSpfaScoringContextV2,
  SpfaScoringContextBuildError,
} from '@/lib/cases/v2/build-spfa-scoring-context';
import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import {
  roundSpfaScoreHalfUpV2,
  scoreSpfaSessionV2,
  SpfaSessionScoringError,
} from '@/lib/cases/v2/score-spfa-session';
import type {
  AppliedSpfaRequirementV2,
  BoundSpfaActionTargetV2,
  BoundSpfaInformationTargetV2,
} from '@/lib/cases/v2/spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import { SPFA_SCORING_POLICY_V2_2026_1 } from '@/lib/cases/v2/spfa-scoring-policy-v2';
import type { SpfaProtocolDefinitionV2, SpfaProtocolRequirementDefinitionV2 } from '@/lib/cases/v2/spfa-protocol-types';
import type {
  SessionMessageId,
  SpfaRequirementSessionResultV2,
  SpfaSessionEvidenceRefV2,
} from '@/lib/cases/v2/spfa-session-evidence-types';
import type { SpfaSessionEvaluationV2 } from '@/lib/cases/v2/spfa-session-evaluation-types';
import {
  SpfaSessionScoreValidationError,
  validateSpfaSessionScoreV2,
} from '@/lib/cases/v2/validate-spfa-session-score';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import { validateSpfaProtocolIdV2, validateSpfaProtocolRequirementIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = validateCaseVersionId('casever_20000000-0000-4000-8000-000000000001');
const spfaRefs = [
  'conclusion_30000000-0000-4000-8000-000000000001' as ConclusionId,
  'conclusion_30000000-0000-4000-8000-000000000002' as ConclusionId,
] as const;
const protocolIds = [
  validateSpfaProtocolIdV2('spfa_protocol_40000000-0000-4000-8000-000000000001'),
  validateSpfaProtocolIdV2('spfa_protocol_40000000-0000-4000-8000-000000000002'),
] as const;
const fingerprint = {
  algorithm: 'sha256' as const,
  canonicalization: 'session-transcript-v2/1' as const,
  value: 'b'.repeat(64),
};

type RequirementSpec = Readonly<{
  kind?: 'INFORMATION_REQUIREMENT' | 'ACTION_REQUIREMENT';
  importance?: 'CRITICAL' | 'RELEVANT' | 'OPTIONAL';
  total?: number;
  positive?: number;
  uncertain?: number;
  safetyCritical?: boolean;
  notApplicable?: boolean;
  application?: 0 | 1;
}>;

function requirementId(index: number) {
  return validateSpfaProtocolRequirementIdV2(`spfa_requirement_50000000-0000-4000-8000-${index.toString().padStart(12, '0')}`);
}

function targetId(requirementIndex: number, targetIndex: number) {
  return validateSpfaRequirementTargetIdV2(`spfa_target_60000000-0000-4000-8${requirementIndex.toString().padStart(3, '0')}-${targetIndex.toString().padStart(12, '0')}`);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function nonEmpty<T>(values: readonly T[], message = 'fixture collection must be non-empty'): NonEmptyArray<T> {
  const [first, ...rest] = values;
  if (first === undefined) {
    throw new Error(message);
  }
  return [first, ...rest];
}

function appliedRequirement(spec: RequirementSpec, index: number): AppliedSpfaRequirementV2 {
  const kind = spec.kind ?? 'INFORMATION_REQUIREMENT';
  if (spec.notApplicable) {
    return kind === 'INFORMATION_REQUIREMENT'
      ? {
          kind,
          requirementRef: requirementId(index),
          applicability: { status: 'NOT_APPLICABLE', reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' } },
          informationTargets: [],
        }
      : {
          kind,
          requirementRef: requirementId(index),
          applicability: { status: 'NOT_APPLICABLE', reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' } },
          actionTargets: [],
        };
  }
  const total = spec.total ?? 1;
  const common = {
    requirementRef: requirementId(index),
    applicability: { status: 'APPLICABLE' as const, effectiveImportance: spec.importance ?? 'RELEVANT' },
  };
  return kind === 'INFORMATION_REQUIREMENT'
    ? {
        ...common,
        kind,
        informationTargets: nonEmpty<BoundSpfaInformationTargetV2>(Array.from({ length: total }, (_, targetIndex) => ({
          targetId: targetId(index, targetIndex + 1),
          target: { kind: 'PUBLIC_PROFILE' as const, field: 'age' as const },
        }))),
      }
    : {
        ...common,
        kind,
        actionTargets: nonEmpty<BoundSpfaActionTargetV2>(Array.from({ length: total }, (_, targetIndex) => ({
          targetId: targetId(index, targetIndex + 1),
          target: { kind: 'EVALUATOR_CONCLUSION' as const, conclusionRef: spfaRefs[spec.application ?? 0] },
        }))),
      };
}

function definitionRequirement(
  applied: AppliedSpfaRequirementV2,
  spec: RequirementSpec,
): SpfaProtocolRequirementDefinitionV2 {
  const common = {
    requirementId: applied.requirementRef,
    teacherLabel: `Requirement ${applied.requirementRef}`,
    description: 'F4 integrated scoring requirement',
    defaultImportance: 'OPTIONAL' as const,
    safetyCriticality: { safetyCritical: spec.safetyCritical ?? false },
    applicability: { kind: 'ALWAYS' as const },
  };
  return applied.kind === 'INFORMATION_REQUIREMENT'
    ? {
        ...common,
        kind: 'INFORMATION_REQUIREMENT',
        semanticDomain: { kind: 'patient_information', disclosureDomain: 'symptoms' },
        informationGoal: 'Collect required information',
      }
    : {
        ...common,
        kind: 'ACTION_REQUIREMENT',
        semanticDomain: 'safe_professional_action',
        actionGoal: 'Perform required action',
      };
}

function resultFor(
  applied: AppliedSpfaRequirementV2,
  spec: RequirementSpec,
  index: number,
): SpfaRequirementSessionResultV2 {
  const application = spec.application ?? 0;
  const identity = {
    schemaVersion: '2.0' as const,
    sessionId,
    caseVersionId,
    transcriptFingerprint: fingerprint,
    carePathSpfaRef: spfaRefs[application],
    requirementRef: applied.requirementRef,
  };
  if (spec.notApplicable) {
    return applied.kind === 'INFORMATION_REQUIREMENT'
      ? { ...identity, kind: 'INFORMATION_REQUIREMENT', coverage: { status: 'NOT_APPLICABLE', evidence: [] } }
      : { ...identity, kind: 'ACTION_REQUIREMENT', outcome: { status: 'NOT_APPLICABLE', evidence: [] } };
  }
  const total = spec.total ?? 1;
  const positive = spec.positive ?? total;
  const uncertain = spec.uncertain ?? 0;
  const targets = Array.from({ length: total }, (_, targetIndex) => targetId(index, targetIndex + 1));
  const positiveRefs = targets.slice(0, positive);
  const remainingRefs = targets.slice(positive);
  const uncertainRefs = remainingRefs.slice(0, uncertain);
  if (applied.kind === 'INFORMATION_REQUIREMENT') {
    if (positive === total) {
      return {
        ...identity,
        kind: 'INFORMATION_REQUIREMENT',
        coverage: {
          status: 'COVERED',
          origin: 'PUBLIC_INFORMATION',
          coveredTargetRefs: nonEmpty(positiveRefs),
          evidence: [{ source: 'PUBLIC_INFORMATION', targetRef: positiveRefs[0] }],
        },
      };
    }
    if (positive > 0) {
      return {
        ...identity,
        kind: 'INFORMATION_REQUIREMENT',
        coverage: {
          status: 'PARTIALLY_COVERED',
          origin: 'PUBLIC_INFORMATION',
          coveredTargetRefs: nonEmpty(positiveRefs),
          remainingTargetRefs: nonEmpty(remainingRefs),
          uncertainTargetRefs: uncertainRefs,
          evidence: [{ source: 'PUBLIC_INFORMATION', targetRef: positiveRefs[0] }],
        },
      };
    }
    return {
      ...identity,
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'NOT_COVERED',
        coveredTargetRefs: [],
        remainingTargetRefs: nonEmpty(remainingRefs),
        uncertainTargetRefs: uncertainRefs,
        evidence: [],
      },
    };
  }
  const evidence = nonEmpty<SpfaSessionEvidenceRefV2>([{
    source: 'TRANSCRIPT_MESSAGE' as const,
    messageRef: '1' as SessionMessageId,
    speaker: 'student' as const,
    evidenceKind: 'STUDENT_ACTION' as const,
  }]);
  if (positive === total) {
    return {
      ...identity,
      kind: 'ACTION_REQUIREMENT',
      outcome: { status: 'PERFORMED', performedTargetRefs: nonEmpty(positiveRefs), evidence },
    };
  }
  if (positive > 0) {
    return {
      ...identity,
      kind: 'ACTION_REQUIREMENT',
      outcome: {
        status: 'PARTIALLY_PERFORMED',
        performedTargetRefs: nonEmpty(positiveRefs),
        remainingTargetRefs: nonEmpty(remainingRefs),
        uncertainTargetRefs: uncertainRefs,
        evidence,
      },
    };
  }
  return {
    ...identity,
    kind: 'ACTION_REQUIREMENT',
    outcome: {
      status: 'NOT_PERFORMED',
      remainingTargetRefs: nonEmpty(remainingRefs),
      uncertainTargetRefs: uncertainRefs,
      evidence: [],
    },
  };
}

function fixture(specs: readonly RequirementSpec[]): {
  evaluation: SpfaSessionEvaluationV2;
  protocolSet: CaseSpfaProtocolSetV2;
} {
  const materialized = specs.map((spec, offset) => ({
    spec,
    index: offset + 1,
    requirement: appliedRequirement(spec, offset + 1),
  }));
  const applicationIndexes = [...new Set(materialized.map((item) => item.spec.application ?? 0))].sort();
  const applications = applicationIndexes.map((applicationIndex) => {
    const entries = materialized.filter((item) => (item.spec.application ?? 0) === applicationIndex);
    return {
      schemaVersion: '2.0' as const,
      caseVersionId,
      carePathSpfaRef: spfaRefs[applicationIndex],
      protocolRef: { protocolId: protocolIds[applicationIndex], version: `${applicationIndex + 1}.0.0` },
      requirements: nonEmpty(entries.map((item) => item.requirement)),
    };
  });
  const definitions = applications.map((application, applicationOffset) => {
    const applicationIndex = applicationIndexes[applicationOffset];
    const entries = materialized.filter((item) => (item.spec.application ?? 0) === applicationIndex);
    return {
      schemaVersion: '2.0' as const,
      protocolId: application.protocolRef.protocolId,
      version: application.protocolRef.version,
      service: applicationIndex === 0 ? 'dispensing' as const : 'pharmaceutical_indication' as const,
      ...(applicationIndex === 0 ? { subtype: 'initial_treatment' as const } : {}),
      requirements: nonEmpty(entries.map((item) => definitionRequirement(item.requirement, item.spec))),
    };
  });
  const protocolSet: CaseSpfaProtocolSetV2 = {
    schemaVersion: '2.0',
    catalogRef: { id: 'spfa-protocol-catalog', version: '2026.1' },
    definitions: nonEmpty<SpfaProtocolDefinitionV2>(definitions),
    applications: nonEmpty(applications),
  };
  const evaluation: SpfaSessionEvaluationV2 = {
    schemaVersion: '2.0',
    sessionId,
    caseVersionId,
    protocolCatalogRef: { ...protocolSet.catalogRef },
    transcriptFingerprint: fingerprint,
    applications: nonEmpty(applications.map((application, applicationOffset) => {
      const applicationIndex = applicationIndexes[applicationOffset];
      const entries = materialized.filter((item) => (item.spec.application ?? 0) === applicationIndex);
      return {
        carePathSpfaRef: application.carePathSpfaRef,
        protocolRef: { ...application.protocolRef },
        requirementResults: nonEmpty(entries.map((item) => resultFor(item.requirement, item.spec, item.index))),
      };
    })),
    semanticExecutions: [{
      carePathSpfaRef: spfaRefs[0],
      requirementRef: materialized[0].requirement.requirementRef,
      provider: 'openai',
      responseModel: 'must-not-leak-model',
      promptVersion: 'must-not-leak-prompt',
    }],
  };
  return { evaluation, protocolSet };
}

function run(specs: readonly RequirementSpec[]) {
  const inputs = fixture(specs);
  const scoringContext = buildSpfaScoringContextV2(inputs.evaluation, inputs.protocolSet);
  const score = scoreSpfaSessionV2(scoringContext, SPFA_SCORING_POLICY_V2_2026_1);
  const validatedScore = validateSpfaSessionScoreV2(score, scoringContext, SPFA_SCORING_POLICY_V2_2026_1);
  return { ...inputs, scoringContext, score: validatedScore };
}

describe('M5-F4 integrated importance and coverage matrices', () => {
  it('executes the real F1 -> F2 -> F3 -> score validator stack with 3/2/1 importance', () => {
    const result = run([
      { importance: 'CRITICAL' },
      { importance: 'RELEVANT' },
      { importance: 'OPTIONAL' },
    ]);
    expect(result.score.requirementContributions.map((item) => [item.earnedPoints, item.possiblePoints])).toEqual([[3, 3], [2, 2], [1, 1]]);
    expect(result.score).toMatchObject({ rawPoints: 6, possiblePoints: 6, score: 100, status: 'SCORED' });
  });

  it('covers all INFORMATION result states including NA', () => {
    const result = run([
      { total: 2, positive: 2 },
      { total: 2, positive: 1 },
      { total: 1, positive: 0 },
      { notApplicable: true },
    ]);
    expect(result.score.requirementContributions.map((item) => [item.resultStatus, item.earnedPoints, item.possiblePoints])).toEqual([
      ['COVERED', 2, 2],
      ['PARTIALLY_COVERED', 1, 2],
      ['NOT_COVERED', 0, 2],
      ['NOT_APPLICABLE', 0, 0],
    ]);
  });

  it('covers all ACTION result states including NA', () => {
    const result = run([
      { kind: 'ACTION_REQUIREMENT', total: 2, positive: 2 },
      { kind: 'ACTION_REQUIREMENT', total: 2, positive: 1 },
      { kind: 'ACTION_REQUIREMENT', total: 1, positive: 0 },
      { kind: 'ACTION_REQUIREMENT', notApplicable: true },
    ]);
    expect(result.score.requirementContributions.map((item) => [item.resultStatus, item.earnedPoints, item.possiblePoints])).toEqual([
      ['PERFORMED', 2, 2],
      ['PARTIALLY_PERFORMED', 1, 2],
      ['NOT_PERFORMED', 0, 2],
      ['NOT_APPLICABLE', 0, 0],
    ]);
  });

  it.each([
    [1, 2, 'CRITICAL', 1.5],
    [1, 3, 'RELEVANT', 2 / 3],
    [2, 3, 'OPTIONAL', 2 / 3],
    [3, 4, 'RELEVANT', 1.5],
    [1, 5, 'OPTIONAL', 0.2],
    [4, 5, 'CRITICAL', 2.4],
  ] as const)('applies TARGET_RATIO %i/%i with %s without intermediate rounding', (positive, total, importance, earned) => {
    const contribution = run([{ positive, total, importance }]).score.requirementContributions[0];
    expect(contribution.earnedPoints).toBeCloseTo(earned, 15);
  });
});

describe('M5-F4 uncertain, criticality and review matrix', () => {
  it('distinguishes NOT_SUPPORTED from UNCERTAIN with the same numeric credit', () => {
    const unsupported = run([{ positive: 0, uncertain: 0 }]).score;
    const uncertain = run([{ positive: 0, uncertain: 1 }]).score;
    expect(unsupported.rawPoints).toBe(uncertain.rawPoints);
    expect(unsupported).toMatchObject({ status: 'SCORED', needsReview: false });
    expect(uncertain).toMatchObject({ status: 'REVIEW_REQUIRED', needsReview: true });
  });

  it('distinguishes positive + UNCERTAIN from equal-credit positive + NOT_SUPPORTED', () => {
    const uncertain = run([{ total: 3, positive: 1, uncertain: 1 }]).score;
    const unsupported = run([{ total: 3, positive: 1, uncertain: 0 }]).score;
    expect(uncertain.rawPoints).toBe(unsupported.rawPoints);
    expect(uncertain.status).toBe('REVIEW_REQUIRED');
    expect(unsupported.status).toBe('SCORED');
  });

  it('makes non-critical uncertainty reviewable without a critical alert', () => {
    const result = run([{ positive: 0, uncertain: 1 }]).score;
    expect(result).toMatchObject({ status: 'REVIEW_REQUIRED', needsReview: true, criticalAlerts: [] });
  });

  it('emits canonical critical alert combinations without inventing review causes', () => {
    const complete = run([{ safetyCritical: true }]).score;
    const partial = run([{ total: 2, positive: 1, safetyCritical: true }]).score;
    const omitted = run([{ positive: 0, safetyCritical: true }]).score;
    const uncertain = run([{ positive: 0, uncertain: 1, safetyCritical: true }]).score;
    const partialUncertain = run([{ total: 3, positive: 1, uncertain: 1, safetyCritical: true }]).score;
    expect(complete.criticalAlerts).toEqual([]);
    expect(partial.criticalAlerts.map((item) => item.code)).toEqual(['CRITICAL_PARTIAL']);
    expect(partial.status).toBe('SCORED');
    expect(omitted.criticalAlerts.map((item) => item.code)).toEqual(['CRITICAL_OMISSION']);
    expect(omitted.status).toBe('SCORED');
    expect(uncertain.criticalAlerts.map((item) => item.code)).toEqual(['CRITICAL_OMISSION', 'CRITICAL_UNCERTAIN']);
    expect(uncertain.status).toBe('REVIEW_REQUIRED');
    expect(partialUncertain.criticalAlerts.map((item) => item.code)).toEqual(['CRITICAL_PARTIAL', 'CRITICAL_UNCERTAIN']);
  });

  it('keeps alert refs unique and in requirement/code order', () => {
    const result = run([
      { positive: 0, uncertain: 1, safetyCritical: true },
      { total: 2, positive: 1, uncertain: 1, safetyCritical: true },
      { positive: 0, safetyCritical: false },
      { notApplicable: true, safetyCritical: true },
    ]).score;
    expect(result.criticalAlerts.map((item) => [item.requirementRef, item.code])).toEqual([
      [requirementId(1), 'CRITICAL_OMISSION'],
      [requirementId(1), 'CRITICAL_UNCERTAIN'],
      [requirementId(2), 'CRITICAL_PARTIAL'],
      [requirementId(2), 'CRITICAL_UNCERTAIN'],
    ]);
    expect(new Set(result.criticalAlerts.map((item) => `${item.requirementRef}:${item.code}`)).size).toBe(result.criticalAlerts.length);
  });
});

describe('M5-F4 denominator, global score and rounding matrix', () => {
  it('excludes one or many NA requirements and makes all-NA NOT_SCORABLE', () => {
    const mixed = run([{ notApplicable: true }, { notApplicable: true }, { importance: 'OPTIONAL' }]).score;
    expect(mixed).toMatchObject({ rawPoints: 1, possiblePoints: 1, score: 100 });
    expect(mixed.requirementContributions.slice(0, 2).every((item) => item.earnedPoints === 0 && item.possiblePoints === 0)).toBe(true);
    const allNa = run([{ notApplicable: true, safetyCritical: true }, { kind: 'ACTION_REQUIREMENT', notApplicable: true }]).score;
    expect(allNa).toMatchObject({ status: 'NOT_SCORABLE', rawPoints: 0, possiblePoints: 0, score: null, needsReview: false, criticalAlerts: [] });
  });

  it('matches the manual complex 4/6 = 66.7 calculation', () => {
    const result = run([
      { importance: 'CRITICAL', total: 3, positive: 2 },
      { importance: 'RELEVANT' },
      { importance: 'OPTIONAL', positive: 0 },
    ]).score;
    expect(result).toMatchObject({ rawPoints: 4, possiblePoints: 6, score: 66.7 });
  });

  it('matches an independent 3.7/6 recurring-ratio example', () => {
    const result = run([
      { importance: 'CRITICAL', total: 5, positive: 4 },
      { importance: 'RELEVANT', total: 2, positive: 1 },
      { importance: 'OPTIONAL', total: 3, positive: 1 },
    ]).score;
    expect(result.rawPoints).toBeCloseTo(2.4 + 1 + 1 / 3, 15);
    expect(result.possiblePoints).toBe(6);
    expect(result.score).toBe(62.2);
  });

  it.each([
    [83.34, 83.3],
    [83.35, 83.4],
    [83.36, 83.4],
    [0.04, 0],
    [0.05, 0.1],
    [99.94, 99.9],
    [99.95, 100],
  ])('applies final HALF_UP matrix %s -> %s', (input, expected) => {
    expect(roundSpfaScoreHalfUpV2(input, 1)).toBe(expected);
  });

  it('does not round repeating raw points or contributions before the final score', () => {
    const result = run([{ importance: 'OPTIONAL', total: 3, positive: 1 }]).score;
    expect(result.requirementContributions[0].earnedPoints).toBeCloseTo(1 / 3, 15);
    expect(result.rawPoints).toBeCloseTo(1 / 3, 15);
    expect(result.score).toBe(33.3);
  });

  it('does not cap v1 and rejects a structurally valid numeric cap fail-closed', () => {
    expect(run([{ importance: 'CRITICAL' }]).score.score).toBe(100);
    const capped = clone(SPFA_SCORING_POLICY_V2_2026_1) as any;
    capped.policyRef.version = 'future';
    capped.criticalityRule.scoreCap = 80;
    const scoringContext = run([{}]).scoringContext;
    expect(() => scoreSpfaSessionV2(scoringContext, capped)).toThrow(/activation-condition/);
  });
});

describe('M5-F4 contributions, identity, security and determinism', () => {
  it('keeps exactly one complete contribution per requirement in cross-application clinical order', () => {
    const specs: RequirementSpec[] = [
      { importance: 'CRITICAL', total: 2, positive: 1, uncertain: 1, application: 0 },
      { kind: 'ACTION_REQUIREMENT', importance: 'RELEVANT', application: 0 },
      { importance: 'OPTIONAL', positive: 0, application: 1 },
      { notApplicable: true, application: 1 },
    ];
    const result = run(specs);
    expect(result.score.requirementContributions).toHaveLength(specs.length);
    expect(result.score.requirementContributions.map((item) => item.requirementRef)).toEqual(specs.map((_, index) => requirementId(index + 1)));
    expect(result.score.requirementContributions.map((item) => [item.effectiveImportance, item.resultStatus, item.totalTargetCount, item.positiveTargetCount, item.uncertainTargetCount])).toEqual([
      ['CRITICAL', 'PARTIALLY_COVERED', 2, 1, 1],
      ['RELEVANT', 'PERFORMED', 1, 1, 0],
      ['OPTIONAL', 'NOT_COVERED', 1, 0, 0],
      [undefined, 'NOT_APPLICABLE', 0, 0, 0],
    ]);
  });

  it('preserves all end-to-end identities and canonical policy ref', () => {
    const result = run([{}]);
    expect(result.score).toMatchObject({
      sessionId,
      caseVersionId,
      protocolCatalogRef: { id: 'spfa-protocol-catalog', version: '2026.1' },
      transcriptFingerprint: fingerprint,
      scoringPolicyRef: { id: 'spfa-scoring-standard', version: '2026.1' },
    });
  });

  it('does not expose protected or provider data or unapproved pedagogical fields', () => {
    const result = run([{ uncertain: 1, positive: 0 }]).score;
    const serialized = JSON.stringify(result);
    const keys = new Set<string>();
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (typeof value !== 'object' || value === null) return;
      Object.entries(value).forEach(([key, nested]) => { keys.add(key); visit(nested); });
    };
    visit(result);
    for (const forbidden of ['transcript', 'messages', 'evidence', 'excerpts', 'patientFacts', 'evaluator', 'semanticExecutions', 'provider', 'model', 'promptVersion', 'rawResponse', 'apiKey', 'feedback', 'passed', 'failed', 'threshold', 'grade', 'bonus', 'penalty', 'targetWeight', 'domainWeight', 'requirementOverride']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(serialized).not.toContain('must-not-leak-model');
    expect(serialized).not.toContain('must-not-leak-prompt');
  });

  it('is deterministic end-to-end and does not mutate any input', () => {
    const inputs = fixture([{ total: 3, positive: 2 }, { kind: 'ACTION_REQUIREMENT', application: 1 }]);
    const evaluationBefore = clone(inputs.evaluation);
    const setBefore = clone(inputs.protocolSet);
    const policyBefore = clone(SPFA_SCORING_POLICY_V2_2026_1);
    const contextA = buildSpfaScoringContextV2(inputs.evaluation, inputs.protocolSet);
    const contextB = buildSpfaScoringContextV2(inputs.evaluation, inputs.protocolSet);
    const scoreA = scoreSpfaSessionV2(contextA, SPFA_SCORING_POLICY_V2_2026_1);
    const scoreB = scoreSpfaSessionV2(contextB, SPFA_SCORING_POLICY_V2_2026_1);
    expect(contextA).toEqual(contextB);
    expect(scoreA).toEqual(scoreB);
    expect(inputs.evaluation).toEqual(evaluationBefore);
    expect(inputs.protocolSet).toEqual(setBefore);
    expect(SPFA_SCORING_POLICY_V2_2026_1).toEqual(policyBefore);
    expect(Object.isFrozen(SPFA_SCORING_POLICY_V2_2026_1)).toBe(true);
  });
});

describe('M5-F4 integrated fail-closed matrix', () => {
  it('rejects evaluation/catalog/application/requirement incompatibilities', () => {
    const base = fixture([{}, { application: 1 }]);
    const catalog = clone(base.evaluation) as any;
    catalog.protocolCatalogRef.version = 'wrong';
    expect(() => buildSpfaScoringContextV2(catalog, base.protocolSet)).toThrowError(SpfaScoringContextBuildError);
    const application = clone(base.evaluation) as any;
    application.applications.reverse();
    expect(() => buildSpfaScoringContextV2(application, base.protocolSet)).toThrow(/application order/);
    const requirement = clone(base.evaluation) as any;
    requirement.applications[0].requirementResults[0].requirementRef = requirementId(99);
    expect(() => buildSpfaScoringContextV2(requirement, base.protocolSet)).toThrow(/requirement order/);
  });

  it('rejects target mismatch and impossible context counts', () => {
    const base = fixture([{ total: 2 }]);
    const evaluation = clone(base.evaluation) as any;
    evaluation.applications[0].requirementResults[0].coverage.coveredTargetRefs[1] = targetId(99, 1);
    expect(() => buildSpfaScoringContextV2(evaluation, base.protocolSet)).toThrow(/partition/);
    const valid = run([{ total: 2 }]).scoringContext;
    const invalid = clone(valid) as any;
    invalid.requirements[0].positiveTargetCount = 3;
    expect(() => scoreSpfaSessionV2(invalid, SPFA_SCORING_POLICY_V2_2026_1)).toThrowError(SpfaSessionScoringError);
  });

  it('rejects invalid and unsupported policies', () => {
    const scoringContext = run([{}]).scoringContext;
    const invalid = clone(SPFA_SCORING_POLICY_V2_2026_1) as any;
    invalid.pointsByImportance.CRITICAL = Number.NaN;
    expect(() => scoreSpfaSessionV2(scoringContext, invalid)).toThrow(/invalid SPFA scoring policy/);
    const unsupported = clone(SPFA_SCORING_POLICY_V2_2026_1) as any;
    unsupported.criticalityRule.scoreCap = 50;
    expect(() => scoreSpfaSessionV2(scoringContext, unsupported)).toThrow(/activation-condition/);
  });

  it('rejects manipulated scores, extra properties and impossible numbers contextually', () => {
    const result = run([{ total: 2, positive: 1, uncertain: 1 }]);
    const score = clone(result.score) as any;
    score.score = 99;
    expect(() => validateSpfaSessionScoreV2(score, result.scoringContext, SPFA_SCORING_POLICY_V2_2026_1)).toThrow(/canonical score/);
    const extra = { ...result.score, feedback: 'forbidden' };
    expect(() => validateSpfaSessionScoreV2(extra, result.scoringContext, SPFA_SCORING_POLICY_V2_2026_1)).toThrow(/unexpected property/);
    for (const invalidNumber of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const impossible = clone(result.score) as any;
      impossible.rawPoints = invalidNumber;
      expect(() => validateSpfaSessionScoreV2(impossible, result.scoringContext, SPFA_SCORING_POLICY_V2_2026_1)).toThrowError(SpfaSessionScoreValidationError);
    }
  });
});
