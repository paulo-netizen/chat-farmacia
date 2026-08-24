import { describe, expect, it } from 'vitest';

import {
  buildSpfaRequirementEvidenceBaselineV2,
  materializeDeterministicSpfaRequirementSessionResultV2,
} from '@/lib/cases/v2/build-spfa-evidence-baseline';
import type { SpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/spfa-evidence-baseline-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import {
  SpfaSemanticCandidateSelectionValidationError,
  validateSpfaSemanticCandidateSelectionV2,
} from '@/lib/cases/v2/validate-spfa-semantic-candidate-selection';

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
  targetA: 'spfa_target_50000000-0000-4000-8000-000000000001',
  targetB: 'spfa_target_50000000-0000-4000-8000-000000000002',
  targetC: 'spfa_target_50000000-0000-4000-8000-000000000003',
  factA: 'fact_60000000-0000-4000-8000-000000000001',
  factB: 'fact_60000000-0000-4000-8000-000000000002',
  medication: 'med_70000000-0000-4000-8000-000000000001',
  conclusionA: 'conclusion_80000000-0000-4000-8000-000000000001',
  conclusionB: 'conclusion_80000000-0000-4000-8000-000000000002',
} as const;

function messages() {
  return [
    {
      messageId: '4',
      role: 'patient',
      content: 'Confirmo la segunda información del caso.',
      createdAt: '2026-08-24T09:00:03Z',
    },
    {
      messageId: '2',
      role: 'patient',
      content: 'Tomo el medicamento por la mañana.',
      createdAt: '2026-08-24T09:00:01Z',
    },
    {
      messageId: '3',
      role: 'student',
      content: 'Realizo otra actuación profesional.',
      createdAt: '2026-08-24T09:00:02Z',
    },
    {
      messageId: '1',
      role: 'student',
      content: 'Explico la actuación profesional indicada.',
      createdAt: '2026-08-24T09:00:00Z',
    },
  ];
}

function transcript(messageInput: unknown = messages()) {
  return createSessionTranscriptSnapshotV2({
    sessionId: ids.session,
    caseVersionId: ids.caseVersion,
    messages: messageInput,
  });
}

const targets = {
  age: { targetId: ids.targetA, target: { kind: 'PUBLIC_PROFILE', field: 'age' } },
  sex: { targetId: ids.targetB, target: { kind: 'PUBLIC_PROFILE', field: 'sex' } },
  factA: { targetId: ids.targetA, target: { kind: 'FACT', factRef: ids.factA } },
  factB: { targetId: ids.targetB, target: { kind: 'FACT', factRef: ids.factB } },
  medication: {
    targetId: ids.targetA,
    target: { kind: 'MEDICATION_ENTITY', medicationRef: ids.medication },
  },
  medicationFact: {
    targetId: ids.targetA,
    target: {
      kind: 'MEDICATION_FACT',
      medicationRef: ids.medication,
      factRef: ids.factA,
    },
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
  applicable = true,
) {
  return {
    requirementRef: ids.actionRequirement,
    kind: 'ACTION_REQUIREMENT',
    applicability: applicable
      ? { status: 'APPLICABLE', effectiveImportance: 'CRITICAL' }
      : {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
        },
    actionTargets: applicable ? actionTargets : [],
  };
}

function build(
  appliedRequirement: Record<string, unknown>,
  transcriptValue = transcript(),
): SpfaRequirementEvidenceBaselineV2 {
  return buildSpfaRequirementEvidenceBaselineV2({
    transcript: transcriptValue,
    carePathSpfaRef: ids.spfa,
    appliedRequirement,
  } as any);
}

function selectionInput(
  baseline: SpfaRequirementEvidenceBaselineV2,
  candidates: readonly unknown[],
) {
  return {
    schemaVersion: '2.0',
    sessionId: baseline.sessionId,
    caseVersionId: baseline.caseVersionId,
    transcriptFingerprint: { ...baseline.transcriptFingerprint },
    carePathSpfaRef: baseline.carePathSpfaRef,
    requirementRef: baseline.requirementRef,
    kind: baseline.kind,
    candidates,
  };
}

describe('deterministic SPFA evidence baseline', () => {
  it.each([
    ['age', targets.age],
    ['sex', targets.sex],
  ])('recognizes PUBLIC_PROFILE %s as deterministic public evidence', (_field, target) => {
    const baseline = build(informationRequirement([target]));
    expect(baseline).toMatchObject({
      kind: 'INFORMATION_REQUIREMENT',
      resolution: 'DETERMINISTIC_COMPLETE',
      deterministicCoveredTargetRefs: [target.targetId],
      unresolvedTargetRefs: [],
      deterministicEvidence: [
        { source: 'PUBLIC_INFORMATION', targetRef: target.targetId },
      ],
      semanticCandidateUniverse: [],
    });
  });

  it('resolves age and sex completely without transcript candidates', () => {
    const baseline = build(informationRequirement([targets.age, targets.sex]));
    expect(baseline).toMatchObject({
      resolution: 'DETERMINISTIC_COMPLETE',
      deterministicCoveredTargetRefs: [ids.targetA, ids.targetB],
      unresolvedTargetRefs: [],
      semanticCandidateUniverse: [],
    });
  });

  it('keeps a PUBLIC_PROFILE plus FACT baseline partial, not partially covered', () => {
    const baseline = build(informationRequirement([targets.age, targets.factB]));
    expect(baseline).toMatchObject({
      resolution: 'DETERMINISTIC_PARTIAL',
      deterministicCoveredTargetRefs: [ids.targetA],
      unresolvedTargetRefs: [ids.targetB],
      semanticCandidateUniverse: [
        { targetRef: ids.targetB, messageRef: '2' },
        { targetRef: ids.targetB, messageRef: '4' },
      ],
    });
  });

  it.each([
    ['FACT', targets.factA],
    ['MEDICATION_ENTITY', targets.medication],
    ['MEDICATION_FACT', targets.medicationFact],
  ])('leaves %s semantic without consulting labels or treatment text', (_kind, target) => {
    const baseline = build(informationRequirement([target]));
    expect(baseline).toMatchObject({
      resolution: 'SEMANTIC_REQUIRED',
      deterministicCoveredTargetRefs: [],
      unresolvedTargetRefs: [ids.targetA],
      deterministicEvidence: [],
    });
  });

  it('leaves every applicable action target unresolved', () => {
    const baseline = build(actionRequirement([targets.actionA, targets.actionB]));
    expect(baseline).toMatchObject({
      kind: 'ACTION_REQUIREMENT',
      resolution: 'SEMANTIC_REQUIRED',
      deterministicPerformedTargetRefs: [],
      unresolvedTargetRefs: [ids.targetA, ids.targetB],
      deterministicEvidence: [],
    });
  });

  it.each([
    ['information', informationRequirement([], false)],
    ['action', actionRequirement([], false)],
  ])('returns empty arrays for a non-applicable %s requirement', (_kind, requirement) => {
    expect(build(requirement)).toMatchObject({
      resolution: 'NOT_APPLICABLE',
      unresolvedTargetRefs: [],
      deterministicEvidence: [],
      semanticCandidateUniverse: [],
    });
  });

  it('never places already-public targets in the semantic universe', () => {
    const baseline = build(informationRequirement([targets.age, targets.factB]));
    expect(
      baseline.semanticCandidateUniverse.some(
        (candidate) => candidate.targetRef === ids.targetA,
      ),
    ).toBe(false);
  });

  it('uses only patient messages for information candidates', () => {
    const baseline = build(informationRequirement([targets.factA]));
    expect(baseline.semanticCandidateUniverse.map((item) => item.messageRef)).toEqual([
      '2',
      '4',
    ]);
  });

  it('uses only student messages for action candidates', () => {
    const baseline = build(actionRequirement([targets.actionA]));
    expect(baseline.semanticCandidateUniverse.map((item) => item.messageRef)).toEqual([
      '1',
      '3',
    ]);
  });

  it('allows an empty candidate universe when the transcript is empty', () => {
    const baseline = build(
      informationRequirement([targets.factA]),
      transcript([]),
    );
    expect(baseline).toMatchObject({
      resolution: 'SEMANTIC_REQUIRED',
      unresolvedTargetRefs: [ids.targetA],
      semanticCandidateUniverse: [],
    });
  });

  it('uses canonical target-major then transcript-message ordering', () => {
    const baseline = build(informationRequirement([targets.factB, targets.factA]));
    expect(baseline.semanticCandidateUniverse).toEqual([
      { targetRef: ids.targetB, messageRef: '2' },
      { targetRef: ids.targetB, messageRef: '4' },
      { targetRef: ids.targetA, messageRef: '2' },
      { targetRef: ids.targetA, messageRef: '4' },
    ]);
  });

  it('does not mutate transcript or applied-requirement inputs', () => {
    const transcriptValue = transcript();
    const requirement = informationRequirement([targets.age, targets.factB]);
    const transcriptBefore = JSON.parse(JSON.stringify(transcriptValue));
    const requirementBefore = JSON.parse(JSON.stringify(requirement));
    build(requirement, transcriptValue);
    expect(transcriptValue).toEqual(transcriptBefore);
    expect(requirement).toEqual(requirementBefore);
  });

  it('does not perform textual matching for an obvious patient FACT statement', () => {
    const baseline = build(informationRequirement([targets.factA]));
    expect(messages()[1].content).toBe('Tomo el medicamento por la mañana.');
    expect(baseline).toMatchObject({
      deterministicCoveredTargetRefs: [],
      unresolvedTargetRefs: [ids.targetA],
      semanticCandidateUniverse: [
        { targetRef: ids.targetA, messageRef: '2' },
        { targetRef: ids.targetA, messageRef: '4' },
      ],
    });
  });

  it('does not infer a performed action from an obvious student statement', () => {
    const baseline = build(actionRequirement([targets.actionA]));
    expect(messages()[3].content).toContain('actuación profesional');
    expect(baseline).toMatchObject({
      deterministicPerformedTargetRefs: [],
      unresolvedTargetRefs: [ids.targetA],
      semanticCandidateUniverse: [
        { targetRef: ids.targetA, messageRef: '1' },
        { targetRef: ids.targetA, messageRef: '3' },
      ],
    });
  });
});

describe('deterministic D1 result materialization', () => {
  it('materializes complete public information as a validated D1 COVERED result', () => {
    const baseline = build(informationRequirement([targets.age, targets.sex]));
    expect(materializeDeterministicSpfaRequirementSessionResultV2(baseline)).toMatchObject({
      sessionId: ids.session,
      caseVersionId: ids.caseVersion,
      carePathSpfaRef: ids.spfa,
      requirementRef: ids.informationRequirement,
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'COVERED',
        origin: 'PUBLIC_INFORMATION',
        coveredTargetRefs: [ids.targetA, ids.targetB],
      },
    });
  });

  it.each([
    ['information', informationRequirement([], false), 'INFORMATION_REQUIREMENT'],
    ['action', actionRequirement([], false), 'ACTION_REQUIREMENT'],
  ])('materializes a non-applicable %s requirement through D1', (_label, requirement, kind) => {
    expect(
      materializeDeterministicSpfaRequirementSessionResultV2(build(requirement)),
    ).toMatchObject({ kind, [kind === 'INFORMATION_REQUIREMENT' ? 'coverage' : 'outcome']: {
      status: 'NOT_APPLICABLE', evidence: [],
    } });
  });

  it.each([
    ['partial information', informationRequirement([targets.age, targets.factB])],
    ['semantic information', informationRequirement([targets.factA])],
    ['semantic action', actionRequirement([targets.actionA])],
  ])('returns null for %s while unresolved targets remain', (_label, requirement) => {
    expect(
      materializeDeterministicSpfaRequirementSessionResultV2(build(requirement)),
    ).toBeNull();
  });
});

describe('semantic candidate selection boundary', () => {
  function informationBaseline() {
    return build(informationRequirement([targets.factA, targets.factB]));
  }

  it('accepts a valid subset and emits canonical universe ordering', () => {
    const baseline = informationBaseline();
    const selected = [
      baseline.semanticCandidateUniverse[3],
      baseline.semanticCandidateUniverse[0],
    ];
    expect(
      validateSpfaSemanticCandidateSelectionV2(
        selectionInput(baseline, selected),
        baseline,
      ).candidates,
    ).toEqual([
      { targetRef: ids.targetA, messageRef: '2' },
      { targetRef: ids.targetB, messageRef: '4' },
    ]);
  });

  it('accepts an empty selection', () => {
    const baseline = informationBaseline();
    expect(
      validateSpfaSemanticCandidateSelectionV2(
        selectionInput(baseline, []),
        baseline,
      ).candidates,
    ).toEqual([]);
  });

  it('rejects duplicate candidates instead of deduplicating', () => {
    const baseline = informationBaseline();
    const candidate = baseline.semanticCandidateUniverse[0];
    expect(() =>
      validateSpfaSemanticCandidateSelectionV2(
        selectionInput(baseline, [candidate, candidate]),
        baseline,
      ),
    ).toThrow(/duplicate semantic candidate/);
  });

  it.each([
    ['nonexistent target', { targetRef: ids.targetC, messageRef: '2' }],
    ['nonexistent message', { targetRef: ids.targetA, messageRef: '99' }],
    ['wrong student role pair', { targetRef: ids.targetA, messageRef: '1' }],
  ])('rejects a %s', (_label, candidate) => {
    const baseline = informationBaseline();
    expect(() =>
      validateSpfaSemanticCandidateSelectionV2(
        selectionInput(baseline, [candidate]),
        baseline,
      ),
    ).toThrow(/does not exist in the baseline universe/);
  });

  it('rejects a public target that was already resolved', () => {
    const baseline = build(informationRequirement([targets.age, targets.factB]));
    expect(() =>
      validateSpfaSemanticCandidateSelectionV2(
        selectionInput(baseline, [{ targetRef: ids.targetA, messageRef: '2' }]),
        baseline,
      ),
    ).toThrow(/does not exist in the baseline universe/);
  });

  it('rejects a patient message as an action candidate', () => {
    const baseline = build(actionRequirement([targets.actionA]));
    expect(() =>
      validateSpfaSemanticCandidateSelectionV2(
        selectionInput(baseline, [{ targetRef: ids.targetA, messageRef: '2' }]),
        baseline,
      ),
    ).toThrow(/does not exist in the baseline universe/);
  });

  it.each([
    ['sessionId', ids.otherSession],
    ['caseVersionId', ids.otherCaseVersion],
    ['carePathSpfaRef', ids.otherSpfa],
    ['requirementRef', ids.otherRequirement],
    ['kind', 'ACTION_REQUIREMENT'],
  ])('rejects mismatched root metadata: %s', (field, value) => {
    const baseline = informationBaseline();
    expect(() =>
      validateSpfaSemanticCandidateSelectionV2(
        { ...selectionInput(baseline, []), [field]: value },
        baseline,
      ),
    ).toThrow(SpfaSemanticCandidateSelectionValidationError);
  });

  it('rejects a mismatched full transcript fingerprint', () => {
    const baseline = informationBaseline();
    expect(() =>
      validateSpfaSemanticCandidateSelectionV2(
        {
          ...selectionInput(baseline, []),
          transcriptFingerprint: {
            ...baseline.transcriptFingerprint,
            value: 'a'.repeat(64),
          },
        },
        baseline,
      ),
    ).toThrow(/does not match the evidence baseline/);
  });

  it('rejects an extra root property', () => {
    const baseline = informationBaseline();
    expect(() =>
      validateSpfaSemanticCandidateSelectionV2(
        { ...selectionInput(baseline, []), feedback: 'not allowed' },
        baseline,
      ),
    ).toThrow(/unexpected property/);
  });

  it.each(['confidence', 'score', 'rationale', 'excerpt', 'evidenceKind', 'origin', 'semanticMatch', 'model'])(
    'rejects premature candidate metadata: %s',
    (property) => {
      const baseline = informationBaseline();
      expect(() =>
        validateSpfaSemanticCandidateSelectionV2(
          selectionInput(baseline, [
            { ...baseline.semanticCandidateUniverse[0], [property]: 'forbidden' },
          ]),
          baseline,
        ),
      ).toThrow(/unexpected property/);
    },
  );
});
