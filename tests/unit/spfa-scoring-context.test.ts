import { describe, expect, it } from 'vitest';

import {
  buildSpfaScoringContextV2,
  SpfaScoringContextBuildError,
} from '@/lib/cases/v2/build-spfa-scoring-context';
import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import type {
  AppliedSpfaRequirementV2,
  SpfaRequirementTargetId,
} from '@/lib/cases/v2/spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import type {
  SpfaProtocolDefinitionV2,
  SpfaProtocolRequirementDefinitionV2,
} from '@/lib/cases/v2/spfa-protocol-types';
import type { SpfaRequirementSessionResultV2 } from '@/lib/cases/v2/spfa-session-evidence-types';
import type { SpfaSessionEvaluationV2 } from '@/lib/cases/v2/spfa-session-evaluation-types';
import {
  SpfaScoringContextValidationError,
  validateSpfaScoringContextV2,
} from '@/lib/cases/v2/validate-spfa-scoring-context';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import {
  validateSpfaProtocolIdV2,
  validateSpfaProtocolRequirementIdV2,
} from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = validateCaseVersionId('casever_20000000-0000-4000-8000-000000000001');
const spfaA = 'conclusion_30000000-0000-4000-8000-000000000001' as ConclusionId;
const spfaB = 'conclusion_30000000-0000-4000-8000-000000000002' as ConclusionId;
const protocolA = validateSpfaProtocolIdV2('spfa_protocol_40000000-0000-4000-8000-000000000001');
const protocolB = validateSpfaProtocolIdV2('spfa_protocol_40000000-0000-4000-8000-000000000002');
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

const targets = Array.from({ length: 12 }, (_, index) => targetId(index + 1));

function infoRequirement(
  index: number,
  targetRefs: readonly SpfaRequirementTargetId[],
  importance: 'CRITICAL' | 'RELEVANT' | 'OPTIONAL' = 'RELEVANT',
): AppliedSpfaRequirementV2 {
  return {
    kind: 'INFORMATION_REQUIREMENT',
    requirementRef: requirementId(index),
    applicability: { status: 'APPLICABLE', effectiveImportance: importance },
    informationTargets: targetRefs.map((targetIdValue) => ({
      targetId: targetIdValue,
      target: { kind: 'PUBLIC_PROFILE' as const, field: 'age' as const },
    })) as unknown as NonEmptyArray<{
      targetId: SpfaRequirementTargetId;
      target: { kind: 'PUBLIC_PROFILE'; field: 'age' };
    }>,
  };
}

function actionRequirement(
  index: number,
  targetRefs: readonly SpfaRequirementTargetId[],
  importance: 'CRITICAL' | 'RELEVANT' | 'OPTIONAL' = 'RELEVANT',
): AppliedSpfaRequirementV2 {
  return {
    kind: 'ACTION_REQUIREMENT',
    requirementRef: requirementId(index),
    applicability: { status: 'APPLICABLE', effectiveImportance: importance },
    actionTargets: targetRefs.map((targetIdValue) => ({
      targetId: targetIdValue,
      target: { kind: 'EVALUATOR_CONCLUSION' as const, conclusionRef: spfaA },
    })) as unknown as NonEmptyArray<{
      targetId: SpfaRequirementTargetId;
      target: { kind: 'EVALUATOR_CONCLUSION'; conclusionRef: ConclusionId };
    }>,
  };
}

const requirementsA = [
  infoRequirement(1, [targets[0], targets[1]], 'CRITICAL'),
  infoRequirement(2, [targets[2], targets[3]], 'OPTIONAL'),
  infoRequirement(3, [targets[4]]),
  {
    kind: 'INFORMATION_REQUIREMENT',
    requirementRef: requirementId(4),
    applicability: {
      status: 'NOT_APPLICABLE',
      reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
    },
    informationTargets: [],
  },
  actionRequirement(5, [targets[5]], 'CRITICAL'),
  actionRequirement(6, [targets[6], targets[7]]),
  actionRequirement(7, [targets[8]]),
] as unknown as NonEmptyArray<AppliedSpfaRequirementV2>;

const requirementsB = [infoRequirement(8, [targets[9], targets[10], targets[11]])] as unknown as NonEmptyArray<AppliedSpfaRequirementV2>;

function definitionRequirement(
  requirement: AppliedSpfaRequirementV2,
  index: number,
): SpfaProtocolRequirementDefinitionV2 {
  const common = {
    requirementId: requirement.requirementRef,
    teacherLabel: `Requirement ${index}`,
    description: 'Canonical scoring fixture',
    defaultImportance: 'RELEVANT' as const,
    safetyCriticality: { safetyCritical: index === 0 || index === 4 },
    applicability: { kind: 'ALWAYS' as const },
  };
  return requirement.kind === 'INFORMATION_REQUIREMENT'
    ? {
        ...common,
        kind: 'INFORMATION_REQUIREMENT',
        semanticDomain: { kind: 'patient_information', disclosureDomain: 'symptoms' },
        informationGoal: 'Collect information',
      }
    : {
        ...common,
        kind: 'ACTION_REQUIREMENT',
        semanticDomain: 'safe_professional_action',
        actionGoal: 'Perform action',
      };
}

function resultIdentity(carePathSpfaRef: ConclusionId, requirement: AppliedSpfaRequirementV2) {
  return {
    schemaVersion: '2.0' as const,
    sessionId,
    caseVersionId,
    transcriptFingerprint: fingerprint,
    carePathSpfaRef,
    requirementRef: requirement.requirementRef,
    kind: requirement.kind,
  };
}

function resultsA(): NonEmptyArray<SpfaRequirementSessionResultV2> {
  return [
    {
      ...resultIdentity(spfaA, requirementsA[0]),
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'COVERED',
        origin: 'PUBLIC_INFORMATION',
        coveredTargetRefs: [targets[1], targets[0]],
        evidence: [{ source: 'PUBLIC_INFORMATION', targetRef: targets[0] }],
      },
    },
    {
      ...resultIdentity(spfaA, requirementsA[1]),
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'PARTIALLY_COVERED',
        origin: 'PATIENT_SPONTANEOUS',
        coveredTargetRefs: [targets[2]],
        remainingTargetRefs: [targets[3]],
        uncertainTargetRefs: [targets[3]],
        evidence: [{ source: 'TRANSCRIPT_MESSAGE', messageRef: '1' as never, speaker: 'patient', evidenceKind: 'PATIENT_STATEMENT' }],
      },
    },
    {
      ...resultIdentity(spfaA, requirementsA[2]),
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'NOT_COVERED',
        coveredTargetRefs: [],
        remainingTargetRefs: [targets[4]],
        uncertainTargetRefs: [],
        evidence: [],
      },
    },
    {
      ...resultIdentity(spfaA, requirementsA[3]),
      kind: 'INFORMATION_REQUIREMENT',
      coverage: { status: 'NOT_APPLICABLE', evidence: [] },
    },
    {
      ...resultIdentity(spfaA, requirementsA[4]),
      kind: 'ACTION_REQUIREMENT',
      outcome: {
        status: 'PERFORMED',
        performedTargetRefs: [targets[5]],
        evidence: [{ source: 'TRANSCRIPT_MESSAGE', messageRef: '2' as never, speaker: 'student', evidenceKind: 'STUDENT_ACTION' }],
      },
    },
    {
      ...resultIdentity(spfaA, requirementsA[5]),
      kind: 'ACTION_REQUIREMENT',
      outcome: {
        status: 'PARTIALLY_PERFORMED',
        performedTargetRefs: [targets[6]],
        remainingTargetRefs: [targets[7]],
        uncertainTargetRefs: [targets[7]],
        evidence: [{ source: 'TRANSCRIPT_MESSAGE', messageRef: '2' as never, speaker: 'student', evidenceKind: 'STUDENT_ACTION' }],
      },
    },
    {
      ...resultIdentity(spfaA, requirementsA[6]),
      kind: 'ACTION_REQUIREMENT',
      outcome: {
        status: 'NOT_PERFORMED',
        remainingTargetRefs: [targets[8]],
        uncertainTargetRefs: [],
        evidence: [],
      },
    },
  ];
}

function resultsB(): NonEmptyArray<SpfaRequirementSessionResultV2> {
  return [{
    ...resultIdentity(spfaB, requirementsB[0]),
    kind: 'INFORMATION_REQUIREMENT',
    coverage: {
      status: 'PARTIALLY_COVERED',
      origin: 'PUBLIC_INFORMATION',
      coveredTargetRefs: [targets[11]],
      remainingTargetRefs: [targets[10], targets[9]],
      uncertainTargetRefs: [targets[10]],
      evidence: [{ source: 'PUBLIC_INFORMATION', targetRef: targets[11] }],
    },
  }];
}

function fixture(): {
  protocolSet: CaseSpfaProtocolSetV2;
  evaluation: SpfaSessionEvaluationV2;
} {
  const applications = [
    {
      schemaVersion: '2.0' as const,
      caseVersionId,
      carePathSpfaRef: spfaA,
      protocolRef: { protocolId: protocolA, version: '1.0.0' },
      requirements: requirementsA,
    },
    {
      schemaVersion: '2.0' as const,
      caseVersionId,
      carePathSpfaRef: spfaB,
      protocolRef: { protocolId: protocolB, version: '2.0.0' },
      requirements: requirementsB,
    },
  ] as const;
  const definitions = [
    {
      schemaVersion: '2.0' as const,
      protocolId: protocolA,
      version: '1.0.0',
      service: 'dispensing' as const,
      subtype: 'initial_treatment' as const,
      requirements: requirementsA.map(definitionRequirement) as unknown as NonEmptyArray<SpfaProtocolRequirementDefinitionV2>,
    },
    {
      schemaVersion: '2.0' as const,
      protocolId: protocolB,
      version: '2.0.0',
      service: 'pharmaceutical_indication' as const,
      requirements: requirementsB.map((item, index) => definitionRequirement(item, index + 8)) as unknown as NonEmptyArray<SpfaProtocolRequirementDefinitionV2>,
    },
  ] as unknown as NonEmptyArray<SpfaProtocolDefinitionV2>;
  const protocolSet: CaseSpfaProtocolSetV2 = {
    schemaVersion: '2.0',
    catalogRef: { id: 'spfa-catalog', version: '2026.1' },
    definitions,
    applications: applications as unknown as CaseSpfaProtocolSetV2['applications'],
  };
  const evaluation: SpfaSessionEvaluationV2 = {
    schemaVersion: '2.0',
    sessionId,
    caseVersionId,
    protocolCatalogRef: { ...protocolSet.catalogRef },
    transcriptFingerprint: fingerprint,
    applications: [
      { carePathSpfaRef: spfaA, protocolRef: { ...applications[0].protocolRef }, requirementResults: resultsA() },
      { carePathSpfaRef: spfaB, protocolRef: { ...applications[1].protocolRef }, requirementResults: resultsB() },
    ],
    semanticExecutions: [{
      carePathSpfaRef: spfaA,
      requirementRef: requirementsA[1].requirementRef,
      provider: 'openai',
      responseModel: 'provider-model-secret-metadata',
      promptVersion: 'prompt-v1',
    }],
  };
  return { protocolSet, evaluation };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

describe('SpfaScoringContextV2', () => {
  it('projects COVERED, PARTIALLY_COVERED, NOT_COVERED and NOT_APPLICABLE information results', () => {
    const { evaluation, protocolSet } = fixture();
    const result = buildSpfaScoringContextV2(evaluation, protocolSet);
    expect(result.requirements.slice(0, 4).map((item) => item.resultStatus)).toEqual([
      'COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'NOT_APPLICABLE',
    ]);
    expect(result.requirements[0]).toMatchObject({ positiveTargetCount: 2, remainingTargetCount: 0, totalTargetCount: 2 });
    expect(result.requirements[1]).toMatchObject({ positiveTargetCount: 1, remainingTargetCount: 1, uncertainTargetCount: 1 });
    expect(result.requirements[2]).toMatchObject({ positiveTargetCount: 0, remainingTargetCount: 1, uncertainTargetCount: 0 });
    expect(result.requirements[3]).toMatchObject({ targetRefs: [], positiveTargetRefs: [], remainingTargetRefs: [], uncertainTargetRefs: [], totalTargetCount: 0 });
  });

  it('projects PERFORMED, PARTIALLY_PERFORMED and NOT_PERFORMED action results', () => {
    const result = buildSpfaScoringContextV2(fixture().evaluation, fixture().protocolSet);
    expect(result.requirements.slice(4, 7).map((item) => item.resultStatus)).toEqual([
      'PERFORMED', 'PARTIALLY_PERFORMED', 'NOT_PERFORMED',
    ]);
    expect(result.requirements.slice(4, 7).every((item) => item.requirementKind === 'ACTION_REQUIREMENT')).toBe(true);
  });

  it('preserves UNCERTAIN separately from a remaining NOT_SUPPORTED target', () => {
    const result = buildSpfaScoringContextV2(fixture().evaluation, fixture().protocolSet);
    expect(result.requirements[1].uncertainTargetRefs).toEqual([targets[3]]);
    expect(result.requirements[2].remainingTargetRefs).toEqual([targets[4]]);
    expect(result.requirements[2].uncertainTargetRefs).toEqual([]);
  });

  it('preserves effective importance and protocol safety criticality without numeric translation', () => {
    const result = buildSpfaScoringContextV2(fixture().evaluation, fixture().protocolSet);
    expect(result.requirements[0]).toMatchObject({ effectiveImportance: 'CRITICAL', safetyCriticality: { safetyCritical: true } });
    expect(result.requirements[1]).toMatchObject({ effectiveImportance: 'OPTIONAL', safetyCriticality: { safetyCritical: false } });
    expect(JSON.stringify(result)).not.toMatch(/weight|points|score|penalt|cap|needsReview/i);
  });

  it('keeps application, requirement and target order from the protocol set', () => {
    const result = buildSpfaScoringContextV2(fixture().evaluation, fixture().protocolSet);
    expect(result.requirements.map((item) => item.carePathSpfaRef)).toEqual([
      ...Array(7).fill(spfaA), spfaB,
    ]);
    expect(result.requirements.map((item) => item.requirementRef)).toEqual([
      ...requirementsA.map((item) => item.requirementRef), requirementsB[0].requirementRef,
    ]);
    expect(result.requirements[0].targetRefs).toEqual([targets[0], targets[1]]);
    expect(result.requirements[0].positiveTargetRefs).toEqual([targets[0], targets[1]]);
    expect(result.requirements[7].targetRefs).toEqual([targets[9], targets[10], targets[11]]);
    expect(result.requirements[7].positiveTargetRefs).toEqual([targets[11]]);
    expect(result.requirements[7].remainingTargetRefs).toEqual([targets[9], targets[10]]);
    expect(result.requirements[7].uncertainTargetRefs).toEqual([targets[10]]);
  });

  it('derives every count from canonical reference arrays', () => {
    const result = buildSpfaScoringContextV2(fixture().evaluation, fixture().protocolSet);
    for (const item of result.requirements) {
      expect(item.totalTargetCount).toBe(item.targetRefs.length);
      expect(item.positiveTargetCount).toBe(item.positiveTargetRefs.length);
      expect(item.remainingTargetCount).toBe(item.remainingTargetRefs.length);
      expect(item.uncertainTargetCount).toBe(item.uncertainTargetRefs.length);
      expect(item.positiveTargetCount + item.remainingTargetCount).toBe(item.totalTargetCount);
    }
  });

  it('is deterministic for the same input', () => {
    const { evaluation, protocolSet } = fixture();
    expect(buildSpfaScoringContextV2(evaluation, protocolSet)).toEqual(buildSpfaScoringContextV2(evaluation, protocolSet));
  });

  it('does not expose transcripts, messages, evidence, clinical source objects or provider metadata', () => {
    const result = buildSpfaScoringContextV2(fixture().evaluation, fixture().protocolSet);
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
    for (const forbidden of ['transcript', 'messages', 'evidence', 'excerpt', 'patientFacts', 'evaluator', 'semanticExecutions', 'responseModel', 'promptVersion']) {
      expect(keys).not.toContain(forbidden);
    }
    expect(serialized).not.toContain('provider-model-secret-metadata');
  });

  it('fails closed when the evaluation catalog is incompatible', () => {
    const { evaluation, protocolSet } = fixture();
    const input = clone(evaluation) as any;
    input.protocolCatalogRef.version = 'other';
    expect(() => buildSpfaScoringContextV2(input, protocolSet)).toThrowError(SpfaScoringContextBuildError);
  });

  it('rejects a missing or extra evaluation application', () => {
    const { evaluation, protocolSet } = fixture();
    const input = clone(evaluation) as any;
    input.applications.pop();
    expect(() => buildSpfaScoringContextV2(input, protocolSet)).toThrow(/exactly one entry/);
  });

  it('rejects an application that does not follow protocol-set order', () => {
    const { evaluation, protocolSet } = fixture();
    const input = clone(evaluation) as any;
    input.applications.reverse();
    expect(() => buildSpfaScoringContextV2(input, protocolSet)).toThrow(/application order/);
  });

  it('rejects a duplicate application in the protocol set', () => {
    const { evaluation, protocolSet } = fixture();
    const set = clone(protocolSet) as any;
    set.applications[1].carePathSpfaRef = set.applications[0].carePathSpfaRef;
    expect(() => buildSpfaScoringContextV2(evaluation, set)).toThrow(/duplicate application/);
  });

  it('rejects an incompatible application protocolRef', () => {
    const { evaluation, protocolSet } = fixture();
    const input = clone(evaluation) as any;
    input.applications[0].protocolRef.version = '9.9.9';
    expect(() => buildSpfaScoringContextV2(input, protocolSet)).toThrow(/protocol-set application/);
  });

  it('rejects an application whose protocol definition does not exist', () => {
    const { evaluation, protocolSet } = fixture();
    const set = clone(protocolSet) as any;
    set.definitions.pop();
    expect(() => buildSpfaScoringContextV2(evaluation, set)).toThrow(/existing protocol definition/);
  });

  it('rejects duplicate protocol definitions', () => {
    const { evaluation, protocolSet } = fixture();
    const set = clone(protocolSet) as any;
    set.definitions.push(clone(set.definitions[0]));
    expect(() => buildSpfaScoringContextV2(evaluation, set)).toThrow(/duplicate protocol definition/);
  });

  it('rejects a missing requirement result', () => {
    const { evaluation, protocolSet } = fixture();
    const input = clone(evaluation) as any;
    input.applications[0].requirementResults.pop();
    expect(() => buildSpfaScoringContextV2(input, protocolSet)).toThrow(/exactly one result/);
  });

  it('rejects a result for a nonexistent or out-of-order requirement', () => {
    const { evaluation, protocolSet } = fixture();
    const input = clone(evaluation) as any;
    input.applications[0].requirementResults[0].requirementRef = requirementId(99);
    expect(() => buildSpfaScoringContextV2(input, protocolSet)).toThrow(/requirement order/);
  });

  it('rejects duplicate applied requirements', () => {
    const { evaluation, protocolSet } = fixture();
    const set = clone(protocolSet) as any;
    set.applications[0].requirements[1].requirementRef = set.applications[0].requirements[0].requirementRef;
    expect(() => buildSpfaScoringContextV2(evaluation, set)).toThrow(/duplicate applied requirement|requirement order/);
  });

  it('rejects an incompatible definition requirement kind or identity', () => {
    const { evaluation, protocolSet } = fixture();
    const set = clone(protocolSet) as any;
    set.definitions[0].requirements[0].requirementId = requirementId(99);
    expect(() => buildSpfaScoringContextV2(evaluation, set)).toThrow(/definition requirement order/);
  });

  it('rejects a result target outside the applied requirement', () => {
    const { evaluation, protocolSet } = fixture();
    const input = clone(evaluation) as any;
    input.applications[0].requirementResults[0].coverage.coveredTargetRefs = [targets[0], targetId(99)];
    expect(() => buildSpfaScoringContextV2(input, protocolSet)).toThrow(/partition/);
  });

  it('rejects duplicate result targets', () => {
    const { evaluation, protocolSet } = fixture();
    const input = clone(evaluation) as any;
    input.applications[0].requirementResults[0].coverage.coveredTargetRefs = [targets[0], targets[0]];
    expect(() => buildSpfaScoringContextV2(input, protocolSet)).toThrow(/partition/);
  });

  it('rejects mismatched result identity and fingerprint', () => {
    const { evaluation, protocolSet } = fixture();
    const input = clone(evaluation) as any;
    input.applications[0].requirementResults[0].sessionId = '10000000-0000-4000-8000-000000000099';
    expect(() => buildSpfaScoringContextV2(input, protocolSet)).toThrow(/does not match session evaluation/);
    const fingerprintInput = clone(evaluation) as any;
    fingerprintInput.applications[0].requirementResults[0].transcriptFingerprint = {
      ...fingerprintInput.applications[0].requirementResults[0].transcriptFingerprint,
      value: 'b'.repeat(64),
    };
    expect(() => buildSpfaScoringContextV2(fingerprintInput, protocolSet)).toThrow(/transcriptFingerprint/);
  });

  it('strict validator rejects unexpected properties', () => {
    const context = buildSpfaScoringContextV2(fixture().evaluation, fixture().protocolSet);
    const input = { ...context, futureSecret: 'do-not-copy' };
    expect(() => validateSpfaScoringContextV2(input)).toThrowError(SpfaScoringContextValidationError);
    const nested = clone(context) as any;
    nested.requirements[0].evidence = [];
    expect(() => validateSpfaScoringContextV2(nested)).toThrow(/unexpected property/);
  });

  it('strict validator rejects non-derived counts and invalid partitions', () => {
    const context = buildSpfaScoringContextV2(fixture().evaluation, fixture().protocolSet);
    const count = clone(context) as any;
    count.requirements[0].positiveTargetCount = 1;
    expect(() => validateSpfaScoringContextV2(count)).toThrow(/derived/);
    const partition = clone(context) as any;
    partition.requirements[1].uncertainTargetRefs = [targets[0]];
    expect(() => validateSpfaScoringContextV2(partition)).toThrow(/outside targetRefs|remaining/);
  });

  it('strict validator rejects status/kind and applicability inconsistencies', () => {
    const context = buildSpfaScoringContextV2(fixture().evaluation, fixture().protocolSet);
    const kind = clone(context) as any;
    kind.requirements[0].resultStatus = 'PERFORMED';
    expect(() => validateSpfaScoringContextV2(kind)).toThrow(/incompatible/);
    const applicability = clone(context) as any;
    applicability.requirements[3].resultStatus = 'NOT_COVERED';
    expect(() => validateSpfaScoringContextV2(applicability)).toThrow(/non-applicable/);
  });
});
