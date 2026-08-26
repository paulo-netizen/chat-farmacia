import {
  buildSpfaRequirementEvidenceBaselineV2,
  materializeDeterministicSpfaRequirementSessionResultV2,
} from './build-spfa-evidence-baseline';
import type { SpfaRequirementEvidenceBaselineV2 } from './spfa-evidence-baseline-types';
import type {
  AppliedSpfaRequirementV2,
  SpfaRequirementTargetId,
} from './spfa-protocol-application-types';
import type {
  SpfaActionSemanticSupportV2,
  SpfaInformationSemanticSupportV2,
  SpfaSemanticAdjudicationV2,
  SpfaSemanticTargetDecisionV2,
} from './spfa-semantic-adjudication-types';
import type {
  SessionTranscriptSnapshotV2,
  SpfaCoverageOriginV2,
  SpfaRequirementSessionResultV2,
  SpfaSessionEvidenceRefV2,
} from './spfa-session-evidence-types';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';
import { validateSpfaRequirementSessionResultV2 } from './validate-spfa-requirement-session-result';
import { validateSpfaSemanticAdjudicationV2 } from './validate-spfa-semantic-adjudication';

export type ComposeSpfaRequirementSessionResultInputV2 = Readonly<{
  transcript: SessionTranscriptSnapshotV2;
  baseline: SpfaRequirementEvidenceBaselineV2;
  appliedRequirement: AppliedSpfaRequirementV2;
  adjudication?: unknown;
}>;

export class SpfaRequirementResultCompositionError extends Error {
  constructor(
    public readonly path: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaRequirementResultCompositionError';
  }
}

function fail(path: string, message: string, cause?: unknown): never {
  throw new SpfaRequirementResultCompositionError(path, message, cause);
}

function materiallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => materiallyEqual(item, right[index]))
    );
  }
  if (
    typeof left !== 'object' ||
    left === null ||
    typeof right !== 'object' ||
    right === null
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        materiallyEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

function evidenceKey(evidence: SpfaSessionEvidenceRefV2): string {
  return evidence.source === 'PUBLIC_INFORMATION'
    ? `public\u0000${evidence.targetRef}`
    : `transcript\u0000${evidence.messageRef}\u0000${evidence.speaker}\u0000${evidence.evidenceKind}\u0000${evidence.excerpt ?? ''}`;
}

function deduplicateEvidence(
  evidence: readonly SpfaSessionEvidenceRefV2[],
): SpfaSessionEvidenceRefV2[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = evidenceKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function informationSupportEvidence(
  support: SpfaInformationSemanticSupportV2,
): SpfaSessionEvidenceRefV2[] {
  const question: SpfaSessionEvidenceRefV2[] =
    support.acquisition.mode === 'ELICITED'
      ? [
          {
            source: 'TRANSCRIPT_MESSAGE',
            messageRef: support.acquisition.studentQuestionRef,
            speaker: 'student',
            evidenceKind: 'STUDENT_QUESTION',
          },
        ]
      : [];
  const patientEvidence: SpfaSessionEvidenceRefV2 = {
    source: 'TRANSCRIPT_MESSAGE',
    messageRef: support.messageRef,
    speaker: 'patient',
    evidenceKind: support.evidenceKind,
    ...(support.excerpt === undefined ? {} : { excerpt: support.excerpt }),
  };
  return [...question, patientEvidence];
}

function actionSupportEvidence(
  support: SpfaActionSemanticSupportV2,
): SpfaSessionEvidenceRefV2 {
  return {
    source: 'TRANSCRIPT_MESSAGE',
    messageRef: support.messageRef,
    speaker: 'student',
    evidenceKind: 'STUDENT_ACTION',
    ...(support.excerpt === undefined ? {} : { excerpt: support.excerpt }),
  };
}

function informationOrigin(
  evidence: readonly SpfaSessionEvidenceRefV2[],
): SpfaCoverageOriginV2 {
  const hasPublic = evidence.some(
    (item) => item.source === 'PUBLIC_INFORMATION',
  );
  const hasPatient = evidence.some(
    (item) =>
      item.source === 'TRANSCRIPT_MESSAGE' &&
      (item.evidenceKind === 'PATIENT_STATEMENT' ||
        item.evidenceKind === 'PATIENT_CONFIRMATION'),
  );
  if (hasPublic && hasPatient) return 'MIXED';
  if (hasPublic) return 'PUBLIC_INFORMATION';
  if (
    evidence.some(
      (item) =>
        item.source === 'TRANSCRIPT_MESSAGE' &&
        item.evidenceKind === 'STUDENT_QUESTION',
    )
  ) {
    return 'STUDENT_ELICITED';
  }
  return 'PATIENT_SPONTANEOUS';
}

function decisionMap<Decision extends SpfaSemanticTargetDecisionV2>(
  adjudication: Readonly<{ decisions: readonly Decision[] }>,
): ReadonlyMap<SpfaRequirementTargetId, Decision> {
  return new Map(
    adjudication.decisions.map((decision) => [decision.targetRef, decision]),
  );
}

function buildInformationResult(
  baseline: Extract<
    SpfaRequirementEvidenceBaselineV2,
    { kind: 'INFORMATION_REQUIREMENT' }
  >,
  requirement: Extract<
    AppliedSpfaRequirementV2,
    { kind: 'INFORMATION_REQUIREMENT' }
  >,
  adjudication: Extract<
    SpfaSemanticAdjudicationV2,
    { kind: 'INFORMATION_REQUIREMENT' }
  >,
): unknown {
  const decisions = decisionMap(adjudication);
  const deterministicPositive = new Set<string>(
    baseline.deterministicCoveredTargetRefs,
  );
  const positive = new Set<string>(deterministicPositive);
  const uncertain = new Set<string>();
  const semanticEvidence: SpfaSessionEvidenceRefV2[] = [];

  for (const targetRef of baseline.unresolvedTargetRefs) {
    const decision = decisions.get(targetRef);
    if (decision === undefined) {
      fail('adjudication.decisions', 'missing decision for unresolved target');
    }
    if (decision.status === 'SUPPORTED') {
      positive.add(targetRef);
      semanticEvidence.push(
        ...decision.supports.flatMap(informationSupportEvidence),
      );
    } else if (decision.status === 'UNCERTAIN') {
      uncertain.add(targetRef);
    }
  }

  const canonicalTargets = requirement.informationTargets.map(
    (target) => target.targetId,
  );
  const coveredTargetRefs = canonicalTargets.filter((targetRef) =>
    positive.has(targetRef),
  );
  const remainingTargetRefs = canonicalTargets.filter(
    (targetRef) => !positive.has(targetRef),
  );
  const uncertainTargetRefs = remainingTargetRefs.filter((targetRef) =>
    uncertain.has(targetRef),
  );
  const evidence = deduplicateEvidence([
    ...baseline.deterministicEvidence.map((item) => ({ ...item })),
    ...semanticEvidence,
  ]);
  const identity = {
    schemaVersion: '2.0' as const,
    sessionId: baseline.sessionId,
    caseVersionId: baseline.caseVersionId,
    transcriptFingerprint: { ...baseline.transcriptFingerprint },
    carePathSpfaRef: baseline.carePathSpfaRef,
    requirementRef: baseline.requirementRef,
    kind: 'INFORMATION_REQUIREMENT' as const,
  };

  if (remainingTargetRefs.length === 0) {
    return {
      ...identity,
      coverage: {
        status: 'COVERED',
        origin: informationOrigin(evidence),
        coveredTargetRefs,
        evidence,
      },
    };
  }
  if (coveredTargetRefs.length > 0) {
    return {
      ...identity,
      coverage: {
        status: 'PARTIALLY_COVERED',
        origin: informationOrigin(evidence),
        coveredTargetRefs,
        remainingTargetRefs,
        uncertainTargetRefs,
        evidence,
      },
    };
  }
  return {
    ...identity,
    coverage: {
      status: 'NOT_COVERED',
      coveredTargetRefs: [],
      remainingTargetRefs,
      uncertainTargetRefs,
      evidence: [],
    },
  };
}

function buildActionResult(
  baseline: Extract<
    SpfaRequirementEvidenceBaselineV2,
    { kind: 'ACTION_REQUIREMENT' }
  >,
  requirement: Extract<
    AppliedSpfaRequirementV2,
    { kind: 'ACTION_REQUIREMENT' }
  >,
  adjudication: Extract<
    SpfaSemanticAdjudicationV2,
    { kind: 'ACTION_REQUIREMENT' }
  >,
): unknown {
  const decisions = decisionMap(adjudication);
  const positive = new Set<string>(baseline.deterministicPerformedTargetRefs);
  const uncertain = new Set<string>();
  const semanticEvidence: SpfaSessionEvidenceRefV2[] = [];

  for (const targetRef of baseline.unresolvedTargetRefs) {
    const decision = decisions.get(targetRef);
    if (decision === undefined) {
      fail('adjudication.decisions', 'missing decision for unresolved target');
    }
    if (decision.status === 'SUPPORTED') {
      positive.add(targetRef);
      semanticEvidence.push(...decision.supports.map(actionSupportEvidence));
    } else if (decision.status === 'UNCERTAIN') {
      uncertain.add(targetRef);
    }
  }

  const canonicalTargets = requirement.actionTargets.map(
    (target) => target.targetId,
  );
  const performedTargetRefs = canonicalTargets.filter((targetRef) =>
    positive.has(targetRef),
  );
  const remainingTargetRefs = canonicalTargets.filter(
    (targetRef) => !positive.has(targetRef),
  );
  const uncertainTargetRefs = remainingTargetRefs.filter((targetRef) =>
    uncertain.has(targetRef),
  );
  const evidence = deduplicateEvidence(semanticEvidence);
  const identity = {
    schemaVersion: '2.0' as const,
    sessionId: baseline.sessionId,
    caseVersionId: baseline.caseVersionId,
    transcriptFingerprint: { ...baseline.transcriptFingerprint },
    carePathSpfaRef: baseline.carePathSpfaRef,
    requirementRef: baseline.requirementRef,
    kind: 'ACTION_REQUIREMENT' as const,
  };

  if (remainingTargetRefs.length === 0) {
    return {
      ...identity,
      outcome: {
        status: 'PERFORMED',
        performedTargetRefs,
        evidence,
      },
    };
  }
  if (performedTargetRefs.length > 0) {
    return {
      ...identity,
      outcome: {
        status: 'PARTIALLY_PERFORMED',
        performedTargetRefs,
        remainingTargetRefs,
        uncertainTargetRefs,
        evidence,
      },
    };
  }
  return {
    ...identity,
    outcome: {
      status: 'NOT_PERFORMED',
      remainingTargetRefs,
      uncertainTargetRefs,
      evidence: [],
    },
  };
}

export function composeSpfaRequirementSessionResultV2(
  input: ComposeSpfaRequirementSessionResultInputV2,
): SpfaRequirementSessionResultV2 {
  const transcript = validateSessionTranscriptSnapshotV2(
    input.transcript,
    'input.transcript',
  );
  if (
    typeof input.baseline !== 'object' ||
    input.baseline === null ||
    Array.isArray(input.baseline)
  ) {
    fail('input.baseline', 'must be a canonical D2 baseline');
  }

  let baseline: SpfaRequirementEvidenceBaselineV2;
  try {
    baseline = buildSpfaRequirementEvidenceBaselineV2({
      transcript,
      carePathSpfaRef: input.baseline.carePathSpfaRef,
      appliedRequirement: input.appliedRequirement,
    });
  } catch (cause) {
    fail('input.baseline', 'could not reconstruct the canonical baseline', cause);
  }
  if (!materiallyEqual(input.baseline, baseline)) {
    fail('input.baseline', 'does not match the canonical reconstructed baseline');
  }

  const validationContext = {
    transcript,
    carePathSpfaRef: baseline.carePathSpfaRef,
    appliedRequirement: input.appliedRequirement,
  };
  if (
    baseline.resolution === 'NOT_APPLICABLE' ||
    baseline.resolution === 'DETERMINISTIC_COMPLETE'
  ) {
    if (input.adjudication !== undefined) {
      fail(
        'input.adjudication',
        'must be absent when the baseline requires no semantic adjudication',
      );
    }
    const deterministic =
      materializeDeterministicSpfaRequirementSessionResultV2(baseline);
    if (deterministic === null) {
      fail('input.baseline', 'could not materialize deterministic result');
    }
    return deterministic;
  }
  if (input.adjudication === undefined) {
    fail(
      'input.adjudication',
      'is required when the baseline requires semantic adjudication',
    );
  }

  let adjudication: SpfaSemanticAdjudicationV2;
  try {
    adjudication = validateSpfaSemanticAdjudicationV2(
      input.adjudication,
      { transcript, baseline },
      'input.adjudication',
    );
  } catch (cause) {
    fail('input.adjudication', 'is incompatible with the canonical baseline', cause);
  }

  let candidate: unknown;
  if (
    baseline.kind === 'INFORMATION_REQUIREMENT' &&
    input.appliedRequirement.kind === 'INFORMATION_REQUIREMENT' &&
    adjudication.kind === 'INFORMATION_REQUIREMENT'
  ) {
    candidate = buildInformationResult(
      baseline,
      input.appliedRequirement,
      adjudication,
    );
  } else if (
    baseline.kind === 'ACTION_REQUIREMENT' &&
    input.appliedRequirement.kind === 'ACTION_REQUIREMENT' &&
    adjudication.kind === 'ACTION_REQUIREMENT'
  ) {
    candidate = buildActionResult(
      baseline,
      input.appliedRequirement,
      adjudication,
    );
  } else {
    fail('input', 'baseline, requirement and adjudication kinds must match');
  }

  try {
    return validateSpfaRequirementSessionResultV2(
      candidate,
      validationContext,
    );
  } catch (cause) {
    fail('result', 'composed result failed canonical D1 validation', cause);
  }
}
