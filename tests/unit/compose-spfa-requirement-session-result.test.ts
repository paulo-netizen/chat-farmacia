import { describe, expect, it } from 'vitest';

import { buildSpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/build-spfa-evidence-baseline';
import {
  composeSpfaRequirementSessionResultV2,
  SpfaRequirementResultCompositionError,
} from '@/lib/cases/v2/compose-spfa-requirement-session-result';
import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import type { SpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/spfa-evidence-baseline-types';
import type {
  AppliedActionRequirementV2,
  AppliedInformationRequirementV2,
  BoundSpfaActionTargetV2,
  BoundSpfaInformationTargetV2,
} from '@/lib/cases/v2/spfa-protocol-application-types';
import type { SpfaSemanticTargetDecisionV2 } from '@/lib/cases/v2/spfa-semantic-adjudication-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import type { FactId } from '@/lib/cases/v2/types';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import { validateSpfaProtocolRequirementIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-definition';

const raw = {
  session: '10000000-0000-4000-8000-000000000001',
  caseVersion: 'casever_20000000-0000-4000-8000-000000000001',
  spfa: 'conclusion_30000000-0000-4000-8000-000000000001',
  requirement: 'spfa_requirement_40000000-0000-4000-8000-000000000001',
  otherRequirement: 'spfa_requirement_40000000-0000-4000-8000-000000000002',
  targetA: 'spfa_target_50000000-0000-4000-8000-000000000001',
  targetB: 'spfa_target_50000000-0000-4000-8000-000000000002',
  targetC: 'spfa_target_50000000-0000-4000-8000-000000000003',
  targetX: 'spfa_target_50000000-0000-4000-8000-000000000099',
  factA: 'fact_60000000-0000-4000-8000-000000000001',
  factB: 'fact_60000000-0000-4000-8000-000000000002',
  factC: 'fact_60000000-0000-4000-8000-000000000003',
  conclusionA: 'conclusion_70000000-0000-4000-8000-000000000001',
  conclusionB: 'conclusion_70000000-0000-4000-8000-000000000002',
  conclusionC: 'conclusion_70000000-0000-4000-8000-000000000003',
} as const;

const ids = {
  caseVersion: validateCaseVersionId(raw.caseVersion),
  spfa: raw.spfa as ConclusionId,
  requirement: validateSpfaProtocolRequirementIdV2(raw.requirement),
  otherRequirement: validateSpfaProtocolRequirementIdV2(raw.otherRequirement),
  targetA: validateSpfaRequirementTargetIdV2(raw.targetA),
  targetB: validateSpfaRequirementTargetIdV2(raw.targetB),
  targetC: validateSpfaRequirementTargetIdV2(raw.targetC),
  targetX: validateSpfaRequirementTargetIdV2(raw.targetX),
} as const;

function transcript() {
  return createSessionTranscriptSnapshotV2({
    sessionId: raw.session,
    caseVersionId: ids.caseVersion,
    messages: [
      {
        messageId: '1',
        role: 'student',
        content: '¿Desde cuándo presenta este problema?',
        createdAt: '2026-08-24T09:00:01Z',
      },
      {
        messageId: '2',
        role: 'patient',
        content: 'Desde ayer por la tarde.',
        createdAt: '2026-08-24T09:00:02Z',
      },
      {
        messageId: '3',
        role: 'student',
        content: 'Le indico que debe consultar de forma urgente.',
        createdAt: '2026-08-24T09:00:03Z',
      },
      {
        messageId: '4',
        role: 'patient',
        content: 'También tengo tos seca.',
        createdAt: '2026-08-24T09:00:04Z',
      },
      {
        messageId: '5',
        role: 'student',
        content: 'Compruebo que ha entendido la recomendación.',
        createdAt: '2026-08-24T09:00:05Z',
      },
    ],
  });
}

function informationTarget(
  targetId: typeof ids.targetA | typeof ids.targetB | typeof ids.targetC,
  factRef: string,
): BoundSpfaInformationTargetV2 {
  return {
    targetId,
    target: { kind: 'FACT', factRef: factRef as FactId },
  };
}

function publicAgeTarget(): BoundSpfaInformationTargetV2 {
  return {
    targetId: ids.targetA,
    target: { kind: 'PUBLIC_PROFILE', field: 'age' },
  };
}

function informationRequirement(
  mode: 'DETERMINISTIC' | 'PARTIAL' | 'SEMANTIC' | 'NOT_APPLICABLE',
  semanticTargetCount: 1 | 2 | 3 = 1,
): AppliedInformationRequirementV2 {
  if (mode === 'NOT_APPLICABLE') {
    return {
      requirementRef: ids.requirement,
      kind: 'INFORMATION_REQUIREMENT',
      applicability: {
        status: 'NOT_APPLICABLE',
        reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
      },
      informationTargets: [],
    };
  }
  const semanticTargets = [
    informationTarget(ids.targetA, raw.factA),
    informationTarget(ids.targetB, raw.factB),
    informationTarget(ids.targetC, raw.factC),
  ].slice(0, semanticTargetCount) as unknown as NonEmptyArray<
    BoundSpfaInformationTargetV2
  >;
  const informationTargets =
    mode === 'DETERMINISTIC'
      ? [publicAgeTarget()]
      : mode === 'PARTIAL'
        ? [publicAgeTarget(), informationTarget(ids.targetB, raw.factB)]
        : semanticTargets;
  return {
    requirementRef: ids.requirement,
    kind: 'INFORMATION_REQUIREMENT',
    applicability: { status: 'APPLICABLE', effectiveImportance: 'RELEVANT' },
    informationTargets: informationTargets as NonEmptyArray<
      BoundSpfaInformationTargetV2
    >,
  };
}

function actionTarget(
  targetId: typeof ids.targetA | typeof ids.targetB | typeof ids.targetC,
  conclusionRef: string,
): BoundSpfaActionTargetV2 {
  return {
    targetId,
    target: {
      kind: 'EVALUATOR_CONCLUSION',
      conclusionRef: conclusionRef as ConclusionId,
    },
  };
}

function actionRequirement(
  applicable = true,
): AppliedActionRequirementV2 {
  return applicable
    ? {
        requirementRef: ids.requirement,
        kind: 'ACTION_REQUIREMENT',
        applicability: { status: 'APPLICABLE', effectiveImportance: 'CRITICAL' },
        actionTargets: [
          actionTarget(ids.targetA, raw.conclusionA),
          actionTarget(ids.targetB, raw.conclusionB),
          actionTarget(ids.targetC, raw.conclusionC),
        ],
      }
    : {
        requirementRef: ids.requirement,
        kind: 'ACTION_REQUIREMENT',
        applicability: {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
        },
        actionTargets: [],
      };
}

function baseline(
  requirement: AppliedInformationRequirementV2 | AppliedActionRequirementV2,
) {
  return buildSpfaRequirementEvidenceBaselineV2({
    transcript: transcript(),
    carePathSpfaRef: ids.spfa,
    appliedRequirement: requirement,
  });
}

function spontaneousSupport(targetRef: string, messageRef = '4') {
  return {
    targetRef,
    messageRef,
    evidenceKind: 'PATIENT_STATEMENT',
    excerpt: messageRef === '4' ? 'tos seca' : 'ayer por la tarde',
    acquisition: { mode: 'SPONTANEOUS' },
  };
}

function elicitedSupport(targetRef: string) {
  return {
    targetRef,
    messageRef: '2',
    evidenceKind: 'PATIENT_STATEMENT',
    excerpt: 'ayer por la tarde',
    acquisition: { mode: 'ELICITED', studentQuestionRef: '1' },
  };
}

function actionSupport(targetRef: string, messageRef = '3') {
  return {
    targetRef,
    messageRef,
    evidenceKind: 'STUDENT_ACTION',
  };
}

function decision(
  targetRef: string,
  status: 'SUPPORTED' | 'UNCERTAIN' | 'NOT_SUPPORTED',
  kind: 'INFORMATION_REQUIREMENT' | 'ACTION_REQUIREMENT',
  supportMessageRef?: string,
): Record<string, unknown> {
  if (status !== 'SUPPORTED') return { targetRef, status, supports: [] };
  return {
    targetRef,
    status,
    supports: [
      kind === 'INFORMATION_REQUIREMENT'
        ? spontaneousSupport(targetRef, supportMessageRef)
        : actionSupport(targetRef, supportMessageRef),
    ],
  };
}

function adjudication(
  source: SpfaRequirementEvidenceBaselineV2,
  decisions: readonly Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) {
  return {
    schemaVersion: '2.0',
    contractVersion: 'spfa-semantic-adjudication/1',
    sessionId: source.sessionId,
    caseVersionId: source.caseVersionId,
    transcriptFingerprint: source.transcriptFingerprint,
    carePathSpfaRef: source.carePathSpfaRef,
    requirementRef: source.requirementRef,
    kind: source.kind,
    decisions,
    ...overrides,
  };
}

function compose(
  requirement: AppliedInformationRequirementV2 | AppliedActionRequirementV2,
  semanticDecisions?: readonly Record<string, unknown>[],
  overrides: Record<string, unknown> = {},
) {
  const canonicalBaseline = baseline(requirement);
  return composeSpfaRequirementSessionResultV2({
    transcript: transcript(),
    baseline: canonicalBaseline,
    appliedRequirement: requirement,
    ...(semanticDecisions === undefined
      ? {}
      : {
          adjudication: adjudication(
            canonicalBaseline,
            semanticDecisions,
            overrides,
          ),
        }),
  });
}

describe('M5-D3D information requirement composition', () => {
  it('materializes a fully deterministic baseline as covered', () => {
    expect(compose(informationRequirement('DETERMINISTIC'))).toMatchObject({
      coverage: {
        status: 'COVERED',
        origin: 'PUBLIC_INFORMATION',
        coveredTargetRefs: [ids.targetA],
      },
    });
  });

  it('completes a partial deterministic baseline with supported semantic evidence', () => {
    const result = compose(informationRequirement('PARTIAL'), [
      {
        targetRef: ids.targetB,
        status: 'SUPPORTED',
        supports: [elicitedSupport(ids.targetB)],
      },
    ]);
    expect(result).toMatchObject({
      coverage: {
        status: 'COVERED',
        origin: 'MIXED',
        coveredTargetRefs: [ids.targetA, ids.targetB],
        evidence: [
          { source: 'PUBLIC_INFORMATION', targetRef: ids.targetA },
          { messageRef: '1', evidenceKind: 'STUDENT_QUESTION' },
          { messageRef: '2', evidenceKind: 'PATIENT_STATEMENT' },
        ],
      },
    });
  });

  it.each([
    ['NOT_SUPPORTED', []],
    ['UNCERTAIN', [ids.targetB]],
  ] as const)('keeps partial baseline positive evidence for %s', (status, uncertain) => {
    expect(compose(informationRequirement('PARTIAL'), [
      decision(ids.targetB, status, 'INFORMATION_REQUIREMENT'),
    ])).toMatchObject({
      coverage: {
        status: 'PARTIALLY_COVERED',
        coveredTargetRefs: [ids.targetA],
        remainingTargetRefs: [ids.targetB],
        uncertainTargetRefs: uncertain,
        evidence: [{ source: 'PUBLIC_INFORMATION', targetRef: ids.targetA }],
      },
    });
  });

  it.each([
    ['NOT_SUPPORTED', []],
    ['UNCERTAIN', [ids.targetA]],
  ] as const)('materializes no positive semantic target for %s', (status, uncertain) => {
    expect(compose(informationRequirement('SEMANTIC'), [
      decision(ids.targetA, status, 'INFORMATION_REQUIREMENT'),
    ])).toMatchObject({
      coverage: {
        status: 'NOT_COVERED',
        coveredTargetRefs: [],
        remainingTargetRefs: [ids.targetA],
        uncertainTargetRefs: uncertain,
        evidence: [],
      },
    });
  });

  it('composes supported, uncertain and unsupported targets canonically', () => {
    expect(compose(informationRequirement('SEMANTIC', 3), [
      decision(ids.targetC, 'NOT_SUPPORTED', 'INFORMATION_REQUIREMENT'),
      decision(ids.targetA, 'SUPPORTED', 'INFORMATION_REQUIREMENT'),
      decision(ids.targetB, 'UNCERTAIN', 'INFORMATION_REQUIREMENT'),
    ])).toMatchObject({
      coverage: {
        status: 'PARTIALLY_COVERED',
        coveredTargetRefs: [ids.targetA],
        remainingTargetRefs: [ids.targetB, ids.targetC],
        uncertainTargetRefs: [ids.targetB],
      },
    });
  });

  it('deduplicates exact semantic evidence without losing covered targets', () => {
    const result = compose(informationRequirement('SEMANTIC', 2), [
      decision(ids.targetA, 'SUPPORTED', 'INFORMATION_REQUIREMENT', '4'),
      decision(ids.targetB, 'SUPPORTED', 'INFORMATION_REQUIREMENT', '4'),
    ]);
    expect(result).toMatchObject({
      coverage: {
        status: 'COVERED',
        coveredTargetRefs: [ids.targetA, ids.targetB],
      },
    });
    if (result.kind !== 'INFORMATION_REQUIREMENT') throw new Error('fixture kind');
    expect(result.coverage.evidence).toHaveLength(1);
  });
});

describe('M5-D3D action requirement composition', () => {
  it('materializes performed, partially performed and not performed outcomes', () => {
    const requirement = actionRequirement();
    expect(compose(requirement, [
      decision(ids.targetA, 'SUPPORTED', 'ACTION_REQUIREMENT', '3'),
      decision(ids.targetB, 'SUPPORTED', 'ACTION_REQUIREMENT', '5'),
      decision(ids.targetC, 'SUPPORTED', 'ACTION_REQUIREMENT', '3'),
    ])).toMatchObject({ outcome: { status: 'PERFORMED' } });
    expect(compose(requirement, [
      decision(ids.targetA, 'SUPPORTED', 'ACTION_REQUIREMENT', '3'),
      decision(ids.targetB, 'NOT_SUPPORTED', 'ACTION_REQUIREMENT'),
      decision(ids.targetC, 'NOT_SUPPORTED', 'ACTION_REQUIREMENT'),
    ])).toMatchObject({
      outcome: {
        status: 'PARTIALLY_PERFORMED',
        performedTargetRefs: [ids.targetA],
        remainingTargetRefs: [ids.targetB, ids.targetC],
        uncertainTargetRefs: [],
      },
    });
    expect(compose(requirement, [
      decision(ids.targetA, 'NOT_SUPPORTED', 'ACTION_REQUIREMENT'),
      decision(ids.targetB, 'NOT_SUPPORTED', 'ACTION_REQUIREMENT'),
      decision(ids.targetC, 'NOT_SUPPORTED', 'ACTION_REQUIREMENT'),
    ])).toMatchObject({
      outcome: {
        status: 'NOT_PERFORMED',
        remainingTargetRefs: [ids.targetA, ids.targetB, ids.targetC],
        uncertainTargetRefs: [],
      },
    });
  });

  it('preserves uncertain action targets as remaining and uncertain', () => {
    expect(compose(actionRequirement(), [
      decision(ids.targetC, 'UNCERTAIN', 'ACTION_REQUIREMENT'),
      decision(ids.targetA, 'SUPPORTED', 'ACTION_REQUIREMENT', '3'),
      decision(ids.targetB, 'NOT_SUPPORTED', 'ACTION_REQUIREMENT'),
    ])).toMatchObject({
      outcome: {
        status: 'PARTIALLY_PERFORMED',
        performedTargetRefs: [ids.targetA],
        remainingTargetRefs: [ids.targetB, ids.targetC],
        uncertainTargetRefs: [ids.targetC],
      },
    });
  });
});

describe('M5-D3D precedence, fail-closed validation and canonicalization', () => {
  it('rejects semantic adjudication when the baseline is already complete', () => {
    const requirement = informationRequirement('DETERMINISTIC');
    const canonicalBaseline = baseline(requirement);
    expect(() => composeSpfaRequirementSessionResultV2({
      transcript: transcript(),
      baseline: canonicalBaseline,
      appliedRequirement: requirement,
      adjudication: {},
    })).toThrow(/must be absent/);
  });

  it('rejects nonexistent, duplicate and missing target decisions', () => {
    const requirement = informationRequirement('SEMANTIC', 2);
    for (const decisions of [
      [
        decision(ids.targetA, 'SUPPORTED', 'INFORMATION_REQUIREMENT'),
        decision(ids.targetX, 'NOT_SUPPORTED', 'INFORMATION_REQUIREMENT'),
      ],
      [
        decision(ids.targetA, 'SUPPORTED', 'INFORMATION_REQUIREMENT'),
        decision(ids.targetA, 'NOT_SUPPORTED', 'INFORMATION_REQUIREMENT'),
      ],
      [decision(ids.targetA, 'SUPPORTED', 'INFORMATION_REQUIREMENT')],
    ]) {
      expect(() => compose(requirement, decisions)).toThrow(
        SpfaRequirementResultCompositionError,
      );
    }
  });

  it('rejects an adjudication pinned to another requirement', () => {
    expect(() => compose(
      informationRequirement('SEMANTIC'),
      [decision(ids.targetA, 'NOT_SUPPORTED', 'INFORMATION_REQUIREMENT')],
      { requirementRef: ids.otherRequirement },
    )).toThrow(SpfaRequirementResultCompositionError);
  });

  it('rejects an adjudication for a non-applicable requirement', () => {
    const requirement = informationRequirement('NOT_APPLICABLE');
    const canonicalBaseline = baseline(requirement);
    expect(() => composeSpfaRequirementSessionResultV2({
      transcript: transcript(),
      baseline: canonicalBaseline,
      appliedRequirement: requirement,
      adjudication: {},
    })).toThrow(/must be absent/);
    expect(compose(requirement)).toMatchObject({
      coverage: { status: 'NOT_APPLICABLE', evidence: [] },
    });
  });

  it('rejects a baseline partition incompatible with its requirement', () => {
    const requirement = informationRequirement('SEMANTIC', 2);
    const canonicalBaseline = baseline(requirement);
    const incompatible = {
      ...canonicalBaseline,
      unresolvedTargetRefs: [ids.targetA],
    } as SpfaRequirementEvidenceBaselineV2;
    expect(() => composeSpfaRequirementSessionResultV2({
      transcript: transcript(),
      baseline: incompatible,
      appliedRequirement: requirement,
      adjudication: adjudication(incompatible, [
        decision(ids.targetA, 'NOT_SUPPORTED', 'INFORMATION_REQUIREMENT'),
      ]),
    })).toThrow(/canonical reconstructed baseline/);
  });

  it('produces the same canonical result for equivalent decision order', () => {
    const requirement = informationRequirement('SEMANTIC', 3);
    const ordered = [
      decision(ids.targetA, 'SUPPORTED', 'INFORMATION_REQUIREMENT', '4'),
      decision(ids.targetB, 'SUPPORTED', 'INFORMATION_REQUIREMENT', '2'),
      decision(ids.targetC, 'UNCERTAIN', 'INFORMATION_REQUIREMENT'),
    ];
    expect(compose(requirement, [...ordered].reverse())).toEqual(
      compose(requirement, ordered),
    );
  });
});
