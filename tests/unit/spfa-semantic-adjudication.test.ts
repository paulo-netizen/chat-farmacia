import { describe, expect, it } from 'vitest';

import { buildSpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/build-spfa-evidence-baseline';
import type { ConclusionId } from '@/lib/cases/v2/evaluator-types';
import type { SpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/spfa-evidence-baseline-types';
import type { AppliedSpfaRequirementV2 } from '@/lib/cases/v2/spfa-protocol-application-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import {
  SpfaSemanticAdjudicationValidationError,
  validateSpfaSemanticAdjudicationV2,
} from '@/lib/cases/v2/validate-spfa-semantic-adjudication';

const ids = {
  session: '10000000-0000-4000-8000-000000000001',
  otherSession: '10000000-0000-4000-8000-000000000002',
  caseVersion: 'casever_20000000-0000-4000-8000-000000000001',
  otherCaseVersion: 'casever_20000000-0000-4000-8000-000000000002',
  spfa: 'conclusion_30000000-0000-4000-8000-000000000001',
  otherSpfa: 'conclusion_30000000-0000-4000-8000-000000000002',
  informationRequirement:
    'spfa_requirement_40000000-0000-4000-8000-000000000001',
  actionRequirement:
    'spfa_requirement_40000000-0000-4000-8000-000000000002',
  otherRequirement:
    'spfa_requirement_40000000-0000-4000-8000-000000000003',
  publicTarget: 'spfa_target_50000000-0000-4000-8000-000000000001',
  targetA: 'spfa_target_50000000-0000-4000-8000-000000000002',
  targetB: 'spfa_target_50000000-0000-4000-8000-000000000003',
  extraTarget: 'spfa_target_50000000-0000-4000-8000-000000000004',
  factA: 'fact_60000000-0000-4000-8000-000000000001',
  factB: 'fact_60000000-0000-4000-8000-000000000002',
  conclusionA: 'conclusion_70000000-0000-4000-8000-000000000001',
  conclusionB: 'conclusion_70000000-0000-4000-8000-000000000002',
} as const;

function transcript() {
  return createSessionTranscriptSnapshotV2({
    sessionId: ids.session,
    caseVersionId: ids.caseVersion,
    messages: [
      {
        messageId: '6',
        role: 'patient',
        content: 'También lo tomo por la noche.',
        createdAt: '2026-08-24T09:00:05Z',
      },
      {
        messageId: '4',
        role: 'patient',
        content: 'A veces olvido la dosis de la mañana.',
        createdAt: '2026-08-24T09:00:03Z',
      },
      {
        messageId: '2',
        role: 'patient',
        content: 'Sí, lo tomo por la mañana.',
        createdAt: '2026-08-24T09:00:01Z',
      },
      {
        messageId: '5',
        role: 'student',
        content: '¿Y por la noche?',
        createdAt: '2026-08-24T09:00:04Z',
      },
      {
        messageId: '3',
        role: 'student',
        content: 'Le recomiendo consultar hoy con su médica.',
        createdAt: '2026-08-24T09:00:02Z',
      },
      {
        messageId: '1',
        role: 'student',
        content: '¿Cómo toma el medicamento?',
        createdAt: '2026-08-24T09:00:00Z',
      },
    ],
  });
}

const targets = {
  publicAge: {
    targetId: ids.publicTarget,
    target: { kind: 'PUBLIC_PROFILE', field: 'age' },
  },
  factA: {
    targetId: ids.targetA,
    target: { kind: 'FACT', factRef: ids.factA },
  },
  factB: {
    targetId: ids.targetB,
    target: { kind: 'FACT', factRef: ids.factB },
  },
  actionA: {
    targetId: ids.targetA,
    target: { kind: 'EVALUATOR_CONCLUSION', conclusionRef: ids.conclusionA },
  },
  actionB: {
    targetId: ids.targetB,
    target: { kind: 'EVALUATOR_CONCLUSION', conclusionRef: ids.conclusionB },
  },
} as const;

function informationRequirement(
  informationTargets: readonly Record<string, unknown>[],
  applicable = true,
) {
  return {
    requirementRef: ids.informationRequirement,
    kind: 'INFORMATION_REQUIREMENT',
    applicability: applicable
      ? { status: 'APPLICABLE', effectiveImportance: 'RELEVANT' }
      : {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
        },
    informationTargets: applicable ? informationTargets : [],
  };
}

function actionRequirement(
  actionTargets: readonly Record<string, unknown>[],
) {
  return {
    requirementRef: ids.actionRequirement,
    kind: 'ACTION_REQUIREMENT',
    applicability: { status: 'APPLICABLE', effectiveImportance: 'CRITICAL' },
    actionTargets,
  };
}

function buildBaseline(
  appliedRequirement: Record<string, unknown>,
  transcriptValue = transcript(),
) {
  return buildSpfaRequirementEvidenceBaselineV2({
    transcript: transcriptValue,
    carePathSpfaRef: ids.spfa as ConclusionId,
    appliedRequirement:
      appliedRequirement as unknown as AppliedSpfaRequirementV2,
  });
}

function informationBaseline(partial = false) {
  return buildBaseline(
    informationRequirement(
      partial
        ? [targets.publicAge, targets.factA, targets.factB]
        : [targets.factA, targets.factB],
    ),
  );
}

function actionBaseline() {
  return buildBaseline(actionRequirement([targets.actionA, targets.actionB]));
}

function root(
  baseline: SpfaRequirementEvidenceBaselineV2,
  decisions: readonly unknown[],
) {
  return {
    schemaVersion: '2.0',
    contractVersion: 'spfa-semantic-adjudication/1',
    sessionId: baseline.sessionId,
    caseVersionId: baseline.caseVersionId,
    transcriptFingerprint: { ...baseline.transcriptFingerprint },
    carePathSpfaRef: baseline.carePathSpfaRef,
    requirementRef: baseline.requirementRef,
    kind: baseline.kind,
    decisions,
  };
}

function context(baseline: SpfaRequirementEvidenceBaselineV2) {
  return { transcript: transcript(), baseline };
}

function spontaneousSupport(
  targetRef: string = ids.targetA,
  messageRef: string = '4',
) {
  return {
    targetRef,
    messageRef,
    evidenceKind: 'PATIENT_STATEMENT',
    excerpt: 'olvido la dosis',
    acquisition: { mode: 'SPONTANEOUS' },
  };
}

function elicitedSupport(
  targetRef: string = ids.targetA,
  messageRef: string = '2',
) {
  return {
    targetRef,
    messageRef,
    evidenceKind: 'PATIENT_CONFIRMATION',
    excerpt: 'lo tomo por la mañana',
    acquisition: { mode: 'ELICITED', studentQuestionRef: '1' },
  };
}

function actionSupport(
  targetRef: string = ids.targetA,
  messageRef: string = '3',
) {
  return {
    targetRef,
    messageRef,
    evidenceKind: 'STUDENT_ACTION',
    excerpt: 'consultar hoy',
  };
}

function validate(
  baseline: SpfaRequirementEvidenceBaselineV2,
  decisions: readonly unknown[],
) {
  return validateSpfaSemanticAdjudicationV2(
    root(baseline, decisions),
    context(baseline),
  );
}

describe('SPFA semantic adjudication decisions', () => {
  it('accepts supported information with a spontaneous patient statement', () => {
    const baseline = informationBaseline();
    const result = validate(baseline, [
      { targetRef: ids.targetA, status: 'SUPPORTED', supports: [spontaneousSupport()] },
      { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
    ]);
    expect(result.decisions[0]).toMatchObject({
      targetRef: ids.targetA,
      status: 'SUPPORTED',
      supports: [{ acquisition: { mode: 'SPONTANEOUS' } }],
    });
  });

  it('accepts supported information elicited by an earlier student question', () => {
    const baseline = informationBaseline();
    expect(
      validate(baseline, [
        { targetRef: ids.targetA, status: 'SUPPORTED', supports: [elicitedSupport()] },
        { targetRef: ids.targetB, status: 'UNCERTAIN', supports: [] },
      ]).decisions[0],
    ).toMatchObject({
      status: 'SUPPORTED',
      supports: [
        {
          evidenceKind: 'PATIENT_CONFIRMATION',
          acquisition: { mode: 'ELICITED', studentQuestionRef: '1' },
        },
      ],
    });
  });

  it('accepts a patient statement elicited by an earlier student question', () => {
    const baseline = informationBaseline();
    const result = validate(baseline, [
      {
        targetRef: ids.targetA,
        status: 'SUPPORTED',
        supports: [
          {
            ...elicitedSupport(),
            evidenceKind: 'PATIENT_STATEMENT',
          },
        ],
      },
      { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
    ]);
    expect(result.decisions[0].supports[0]).toMatchObject({
      evidenceKind: 'PATIENT_STATEMENT',
      acquisition: { mode: 'ELICITED', studentQuestionRef: '1' },
    });
  });

  it('accepts supported action evidence from a student message', () => {
    const baseline = actionBaseline();
    expect(
      validate(baseline, [
        { targetRef: ids.targetA, status: 'SUPPORTED', supports: [actionSupport()] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]).decisions[0],
    ).toMatchObject({ status: 'SUPPORTED', supports: [{ evidenceKind: 'STUDENT_ACTION' }] });
  });

  it.each(['NOT_SUPPORTED', 'UNCERTAIN'] as const)(
    'accepts %s only with empty supports',
    (status) => {
      const baseline = informationBaseline();
      const result = validate(baseline, [
        { targetRef: ids.targetA, status, supports: [] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]);
      expect(result.decisions[0]).toEqual({
        targetRef: ids.targetA,
        status,
        supports: [],
      });
    },
  );

  it('preserves caller decisions without semantically inspecting obvious text', () => {
    const baseline = informationBaseline();
    const result = validate(baseline, [
      { targetRef: ids.targetA, status: 'NOT_SUPPORTED', supports: [] },
      { targetRef: ids.targetB, status: 'UNCERTAIN', supports: [] },
    ]);
    expect(result.decisions.map((decision) => decision.status)).toEqual([
      'NOT_SUPPORTED',
      'UNCERTAIN',
    ]);
  });

  it('requires non-empty supports for SUPPORTED', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        { targetRef: ids.targetA, status: 'SUPPORTED', supports: [] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/must not be empty/);
  });

  it('requires empty supports for NOT_SUPPORTED and UNCERTAIN', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        {
          targetRef: ids.targetA,
          status: 'UNCERTAIN',
          supports: [spontaneousSupport()],
        },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/must be empty/);
  });
});

describe('exact unresolved-target exhaustiveness', () => {
  it('rejects a missing unresolved target decision', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        { targetRef: ids.targetA, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/exactly one decision/);
  });

  it('rejects an extra target decision', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        { targetRef: ids.targetA, status: 'NOT_SUPPORTED', supports: [] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
        { targetRef: ids.extraTarget, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/not an unresolved baseline target/);
  });

  it('rejects a duplicate target decision', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        { targetRef: ids.targetA, status: 'NOT_SUPPORTED', supports: [] },
        { targetRef: ids.targetA, status: 'UNCERTAIN', supports: [] },
      ]),
    ).toThrow(/duplicate target decision/);
  });

  it('rejects a public target already resolved by D2', () => {
    const baseline = informationBaseline(true);
    expect(() =>
      validate(baseline, [
        { targetRef: ids.publicTarget, status: 'NOT_SUPPORTED', supports: [] },
        { targetRef: ids.targetA, status: 'NOT_SUPPORTED', supports: [] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/not an unresolved baseline target/);
  });
});

describe('candidate universe and canonicalization', () => {
  it('accepts pairs from the D2 semantic candidate universe', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        { targetRef: ids.targetA, status: 'SUPPORTED', supports: [spontaneousSupport()] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).not.toThrow();
  });

  it('rejects a support pair outside the D2 universe', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        {
          targetRef: ids.targetA,
          status: 'SUPPORTED',
          supports: [
            {
              ...spontaneousSupport(ids.targetA, '3'),
              excerpt: 'consultar hoy',
            },
          ],
        },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/baseline universe/);
  });

  it('rejects a support whose target differs from its decision', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        {
          targetRef: ids.targetA,
          status: 'SUPPORTED',
          supports: [spontaneousSupport(ids.targetB)],
        },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/enclosing decision target/);
  });

  it('rejects an exact duplicate target-message pair', () => {
    const baseline = informationBaseline();
    const support = spontaneousSupport();
    expect(() =>
      validate(baseline, [
        { targetRef: ids.targetA, status: 'SUPPORTED', supports: [support, support] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/duplicate semantic candidate/);
  });

  it('allows the same patient message to support two different targets', () => {
    const baseline = informationBaseline();
    const result = validate(baseline, [
      { targetRef: ids.targetA, status: 'SUPPORTED', supports: [spontaneousSupport()] },
      {
        targetRef: ids.targetB,
        status: 'SUPPORTED',
        supports: [spontaneousSupport(ids.targetB)],
      },
    ]);
    expect(result.decisions[0].supports).toHaveLength(1);
    expect(result.decisions[1].supports).toHaveLength(1);
  });

  it('canonicalizes decisions by unresolved target order and supports by universe order', () => {
    const baseline = informationBaseline();
    const result = validate(baseline, [
      { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      {
        targetRef: ids.targetA,
        status: 'SUPPORTED',
        supports: [
          {
            ...spontaneousSupport(ids.targetA, '6'),
            excerpt: 'por la noche',
          },
          spontaneousSupport(),
        ],
      },
    ]);
    expect(result.decisions.map((decision) => decision.targetRef)).toEqual([
      ids.targetA,
      ids.targetB,
    ]);
    expect(result.decisions[0].supports.map((support) => support.messageRef)).toEqual([
      '4',
      '6',
    ]);
  });
});

describe('information acquisition and literal excerpts', () => {
  it('accepts a literal non-empty excerpt', () => {
    const baseline = informationBaseline();
    expect(
      validate(baseline, [
        { targetRef: ids.targetA, status: 'SUPPORTED', supports: [spontaneousSupport()] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]).decisions[0].supports[0],
    ).toMatchObject({ excerpt: 'olvido la dosis' });
  });

  it.each([
    ['empty', ''],
    ['invented', 'contenido que no existe'],
  ])('rejects an %s excerpt', (_label, excerpt) => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        {
          targetRef: ids.targetA,
          status: 'SUPPORTED',
          supports: [{ ...spontaneousSupport(), excerpt }],
        },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/excerpt/);
  });

  it('rejects PATIENT_CONFIRMATION with spontaneous acquisition', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        {
          targetRef: ids.targetA,
          status: 'SUPPORTED',
          supports: [
            { ...spontaneousSupport(), evidenceKind: 'PATIENT_CONFIRMATION' },
          ],
        },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/requires ELICITED/);
  });

  it('rejects ELICITED without studentQuestionRef', () => {
    const baseline = informationBaseline();
    const support = elicitedSupport();
    expect(() =>
      validate(baseline, [
        {
          targetRef: ids.targetA,
          status: 'SUPPORTED',
          supports: [
            { ...support, acquisition: { mode: 'ELICITED' } },
          ],
        },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/studentQuestionRef/);
  });

  it('rejects SPONTANEOUS with studentQuestionRef', () => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        {
          targetRef: ids.targetA,
          status: 'SUPPORTED',
          supports: [
            {
              ...spontaneousSupport(),
              acquisition: { mode: 'SPONTANEOUS', studentQuestionRef: '1' },
            },
          ],
        },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/unexpected property/);
  });

  it.each([
    ['missing message', '99', /does not exist/],
    ['patient message', '2', /student message/],
    ['question after support', '5', /must precede/],
  ])('rejects an elicited %s reference', (_label, studentQuestionRef, message) => {
    const baseline = informationBaseline();
    expect(() =>
      validate(baseline, [
        {
          targetRef: ids.targetA,
          status: 'SUPPORTED',
          supports: [
            {
              ...elicitedSupport(),
              acquisition: { mode: 'ELICITED', studentQuestionRef },
            },
          ],
        },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(message);
  });
});

describe('action evidence restrictions', () => {
  it('rejects a patient message as action evidence', () => {
    const baseline = actionBaseline();
    expect(() =>
      validate(baseline, [
        {
          targetRef: ids.targetA,
          status: 'SUPPORTED',
          supports: [
            {
              ...actionSupport(ids.targetA, '2'),
              excerpt: 'lo tomo por la mañana',
            },
          ],
        },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
    ).toThrow(/baseline universe/);
  });

  it.each(['PATIENT_STATEMENT', 'PATIENT_CONFIRMATION', 'STUDENT_QUESTION'])(
    'rejects action evidenceKind %s',
    (evidenceKind) => {
      const baseline = actionBaseline();
      expect(() =>
        validate(baseline, [
          {
            targetRef: ids.targetA,
            status: 'SUPPORTED',
            supports: [{ ...actionSupport(), evidenceKind }],
          },
          { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
        ]),
      ).toThrow(/must be STUDENT_ACTION/);
    },
  );
});

describe('pinning, applicability and strict objects', () => {
  it.each([
    ['sessionId', ids.otherSession],
    ['caseVersionId', ids.otherCaseVersion],
    ['carePathSpfaRef', ids.otherSpfa],
    ['requirementRef', ids.otherRequirement],
    ['kind', 'ACTION_REQUIREMENT'],
  ])('rejects mismatched %s pinning', (field, value) => {
    const baseline = informationBaseline();
    const input = {
      ...root(baseline, [
        { targetRef: ids.targetA, status: 'NOT_SUPPORTED', supports: [] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
      [field]: value,
    };
    expect(() =>
      validateSpfaSemanticAdjudicationV2(input, context(baseline)),
    ).toThrow(SpfaSemanticAdjudicationValidationError);
  });

  it('rejects mismatched full fingerprint pinning', () => {
    const baseline = informationBaseline();
    const input = {
      ...root(baseline, [
        { targetRef: ids.targetA, status: 'NOT_SUPPORTED', supports: [] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
      transcriptFingerprint: {
        ...baseline.transcriptFingerprint,
        value: 'a'.repeat(64),
      },
    };
    expect(() =>
      validateSpfaSemanticAdjudicationV2(input, context(baseline)),
    ).toThrow(/does not match the evidence baseline/);
  });

  it.each([
    ['algorithm', 'sha512'],
    ['canonicalization', 'session-transcript-v2/2'],
  ])('rejects invalid fingerprint %s pinning', (field, value) => {
    const baseline = informationBaseline();
    const input = {
      ...root(baseline, [
        { targetRef: ids.targetA, status: 'NOT_SUPPORTED', supports: [] },
        { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      ]),
      transcriptFingerprint: {
        ...baseline.transcriptFingerprint,
        [field]: value,
      },
    };
    expect(() =>
      validateSpfaSemanticAdjudicationV2(input, context(baseline)),
    ).toThrow(SpfaSemanticAdjudicationValidationError);
  });

  it.each([
    ['schemaVersion', '2.1'],
    ['contractVersion', 'spfa-semantic-adjudication/2'],
  ])('rejects invalid root contract field %s', (field, value) => {
    const baseline = informationBaseline();
    expect(() =>
      validateSpfaSemanticAdjudicationV2(
        {
          ...root(baseline, [
            { targetRef: ids.targetA, status: 'NOT_SUPPORTED', supports: [] },
            { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
          ]),
          [field]: value,
        },
        context(baseline),
      ),
    ).toThrow(SpfaSemanticAdjudicationValidationError);
  });

  it.each([
    ['DETERMINISTIC_COMPLETE', informationRequirement([targets.publicAge])],
    ['NOT_APPLICABLE', informationRequirement([], false)],
  ])('rejects a %s baseline', (_resolution, requirement) => {
    const baseline = buildBaseline(requirement);
    expect(() =>
      validateSpfaSemanticAdjudicationV2(root(baseline, []), context(baseline)),
    ).toThrow(/does not require semantic adjudication/);
  });

  it.each([
    ['root', 'feedback'],
    ['decision', 'confidence'],
    ['support', 'rationale'],
    ['acquisition', 'score'],
    ['fingerprint', 'model'],
  ])('rejects unexpected property on %s', (level, property) => {
    const baseline = informationBaseline();
    const support = spontaneousSupport();
    const decision = {
      targetRef: ids.targetA,
      status: 'SUPPORTED',
      supports: [support],
    };
    const secondDecision = {
      targetRef: ids.targetB,
      status: 'NOT_SUPPORTED',
      supports: [],
    };
    let input: Record<string, unknown> = root(baseline, [
      decision,
      secondDecision,
    ]);
    if (level === 'root') input = { ...input, [property]: 'forbidden' };
    if (level === 'decision') {
      input = {
        ...input,
        decisions: [{ ...decision, [property]: 'forbidden' }, secondDecision],
      };
    }
    if (level === 'support') {
      input = {
        ...input,
        decisions: [
          { ...decision, supports: [{ ...support, [property]: 'forbidden' }] },
          secondDecision,
        ],
      };
    }
    if (level === 'acquisition') {
      input = {
        ...input,
        decisions: [
          {
            ...decision,
            supports: [
              {
                ...support,
                acquisition: { ...support.acquisition, [property]: 'forbidden' },
              },
            ],
          },
          secondDecision,
        ],
      };
    }
    if (level === 'fingerprint') {
      input = {
        ...input,
        transcriptFingerprint: {
          ...baseline.transcriptFingerprint,
          [property]: 'forbidden',
        },
      };
    }
    expect(() =>
      validateSpfaSemanticAdjudicationV2(input, context(baseline)),
    ).toThrow(/unexpected property/);
  });

  it.each([
    'probability',
    'explanation',
    'promptVersion',
    'tokens',
    'covered',
    'performed',
    'importance',
    'safetyCritical',
    'clinicalConclusion',
  ])('rejects premature decision metadata %s', (property) => {
    const baseline = informationBaseline();
    expect(() =>
      validateSpfaSemanticAdjudicationV2(
        root(baseline, [
          {
            targetRef: ids.targetA,
            status: 'NOT_SUPPORTED',
            supports: [],
            [property]: 'forbidden',
          },
          { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
        ]),
        context(baseline),
      ),
    ).toThrow(/unexpected property/);
  });

  it('does not mutate adjudication, baseline or transcript inputs', () => {
    const baseline = informationBaseline();
    const transcriptValue = transcript();
    const input = root(baseline, [
      { targetRef: ids.targetB, status: 'NOT_SUPPORTED', supports: [] },
      { targetRef: ids.targetA, status: 'SUPPORTED', supports: [spontaneousSupport()] },
    ]);
    const inputBefore = JSON.parse(JSON.stringify(input));
    const baselineBefore = JSON.parse(JSON.stringify(baseline));
    const transcriptBefore = JSON.parse(JSON.stringify(transcriptValue));
    validateSpfaSemanticAdjudicationV2(input, {
      baseline,
      transcript: transcriptValue,
    });
    expect(input).toEqual(inputBefore);
    expect(baseline).toEqual(baselineBefore);
    expect(transcriptValue).toEqual(transcriptBefore);
  });
});
