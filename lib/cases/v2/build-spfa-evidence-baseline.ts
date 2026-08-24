import type { ConclusionId, NonEmptyArray } from './evaluator-types';
import type {
  AppliedSpfaRequirementV2,
  SpfaRequirementTargetId,
} from './spfa-protocol-application-types';
import type {
  SpfaActionRequirementEvidenceBaselineV2,
  SpfaDeterministicPublicEvidenceV2,
  SpfaInformationRequirementEvidenceBaselineV2,
  SpfaRequirementEvidenceBaselineV2,
  SpfaSemanticEvidenceCandidateV2,
} from './spfa-evidence-baseline-types';
import type {
  SessionTranscriptSnapshotV2,
  SpfaRequirementSessionResultV2,
  SpfaRequirementSessionResultValidationContextV2,
} from './spfa-session-evidence-types';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';
import { validateSpfaRequirementSessionResultV2 } from './validate-spfa-requirement-session-result';

export type BuildSpfaRequirementEvidenceBaselineInputV2 = Readonly<{
  transcript: SessionTranscriptSnapshotV2;
  carePathSpfaRef: ConclusionId;
  appliedRequirement: AppliedSpfaRequirementV2;
}>;

export class SpfaEvidenceBaselineError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaEvidenceBaselineError';
  }
}

const materializationContexts = new WeakMap<
  SpfaRequirementEvidenceBaselineV2,
  SpfaRequirementSessionResultValidationContextV2
>();

function cloneAppliedRequirement(
  requirement: AppliedSpfaRequirementV2,
): AppliedSpfaRequirementV2 {
  const applicability =
    requirement.applicability.status === 'APPLICABLE'
      ? {
          status: 'APPLICABLE' as const,
          effectiveImportance: requirement.applicability.effectiveImportance,
        }
      : {
          status: 'NOT_APPLICABLE' as const,
          reason:
            requirement.applicability.reason.kind ===
            'DISPENSING_SUBTYPE_MISMATCH'
              ? { kind: 'DISPENSING_SUBTYPE_MISMATCH' as const }
              : {
                  kind: 'CASE_DETERMINED' as const,
                  policyRef: requirement.applicability.reason.policyRef,
                },
        };

  if (requirement.kind === 'INFORMATION_REQUIREMENT') {
    const informationTargets = requirement.informationTargets.map((bound) => ({
      targetId: bound.targetId,
      target: { ...bound.target },
    }));
    return requirement.applicability.status === 'APPLICABLE'
      ? {
          requirementRef: requirement.requirementRef,
          kind: requirement.kind,
          applicability: applicability as Extract<
            typeof applicability,
            { status: 'APPLICABLE' }
          >,
          informationTargets: informationTargets as unknown as NonEmptyArray<
            (typeof informationTargets)[number]
          >,
        }
      : {
          requirementRef: requirement.requirementRef,
          kind: requirement.kind,
          applicability: applicability as Extract<
            typeof applicability,
            { status: 'NOT_APPLICABLE' }
          >,
          informationTargets: [],
        };
  }

  const actionTargets = requirement.actionTargets.map((bound) => ({
    targetId: bound.targetId,
    target: { ...bound.target },
  }));
  return requirement.applicability.status === 'APPLICABLE'
    ? {
        requirementRef: requirement.requirementRef,
        kind: requirement.kind,
        applicability: applicability as Extract<
          typeof applicability,
          { status: 'APPLICABLE' }
        >,
        actionTargets: actionTargets as unknown as NonEmptyArray<
          (typeof actionTargets)[number]
        >,
      }
    : {
        requirementRef: requirement.requirementRef,
        kind: requirement.kind,
        applicability: applicability as Extract<
          typeof applicability,
          { status: 'NOT_APPLICABLE' }
        >,
        actionTargets: [],
      };
}

function candidatesFor(
  targets: readonly SpfaRequirementTargetId[],
  transcript: SessionTranscriptSnapshotV2,
  role: 'student' | 'patient',
): SpfaSemanticEvidenceCandidateV2[] {
  const messages = transcript.messages.filter((message) => message.role === role);
  return targets.flatMap((targetRef) =>
    messages.map((message) => ({
      targetRef,
      messageRef: message.messageId,
    })),
  );
}

function baselineIdentity(
  transcript: SessionTranscriptSnapshotV2,
  carePathSpfaRef: ConclusionId,
  requirement: AppliedSpfaRequirementV2,
) {
  return {
    schemaVersion: '2.0' as const,
    sessionId: transcript.sessionId,
    caseVersionId: transcript.caseVersionId,
    transcriptFingerprint: { ...transcript.fingerprint },
    carePathSpfaRef,
    requirementRef: requirement.requirementRef,
  };
}

function informationBaseline(
  transcript: SessionTranscriptSnapshotV2,
  carePathSpfaRef: ConclusionId,
  requirement: Extract<AppliedSpfaRequirementV2, { kind: 'INFORMATION_REQUIREMENT' }>,
): SpfaInformationRequirementEvidenceBaselineV2 {
  const identity = {
    ...baselineIdentity(transcript, carePathSpfaRef, requirement),
    kind: requirement.kind,
  };
  if (requirement.applicability.status === 'NOT_APPLICABLE') {
    return {
      ...identity,
      resolution: 'NOT_APPLICABLE',
      deterministicCoveredTargetRefs: [],
      unresolvedTargetRefs: [],
      deterministicEvidence: [],
      semanticCandidateUniverse: [],
    };
  }

  const deterministicCoveredTargetRefs: SpfaRequirementTargetId[] = [];
  const unresolvedTargetRefs: SpfaRequirementTargetId[] = [];
  for (const bound of requirement.informationTargets) {
    if (bound.target.kind === 'PUBLIC_PROFILE') {
      deterministicCoveredTargetRefs.push(bound.targetId);
    } else {
      unresolvedTargetRefs.push(bound.targetId);
    }
  }
  const deterministicEvidence = deterministicCoveredTargetRefs.map(
    (targetRef): SpfaDeterministicPublicEvidenceV2 => ({
      source: 'PUBLIC_INFORMATION',
      targetRef,
    }),
  );
  const semanticCandidateUniverse = candidatesFor(
    unresolvedTargetRefs,
    transcript,
    'patient',
  );

  if (unresolvedTargetRefs.length === 0) {
    return {
      ...identity,
      resolution: 'DETERMINISTIC_COMPLETE',
      deterministicCoveredTargetRefs:
        deterministicCoveredTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
      unresolvedTargetRefs: [],
      deterministicEvidence:
        deterministicEvidence as unknown as NonEmptyArray<SpfaDeterministicPublicEvidenceV2>,
      semanticCandidateUniverse: [],
    };
  }
  if (deterministicCoveredTargetRefs.length !== 0) {
    return {
      ...identity,
      resolution: 'DETERMINISTIC_PARTIAL',
      deterministicCoveredTargetRefs:
        deterministicCoveredTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
      unresolvedTargetRefs:
        unresolvedTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
      deterministicEvidence:
        deterministicEvidence as unknown as NonEmptyArray<SpfaDeterministicPublicEvidenceV2>,
      semanticCandidateUniverse,
    };
  }
  return {
    ...identity,
    resolution: 'SEMANTIC_REQUIRED',
    deterministicCoveredTargetRefs: [],
    unresolvedTargetRefs:
      unresolvedTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
    deterministicEvidence: [],
    semanticCandidateUniverse,
  };
}

function actionBaseline(
  transcript: SessionTranscriptSnapshotV2,
  carePathSpfaRef: ConclusionId,
  requirement: Extract<AppliedSpfaRequirementV2, { kind: 'ACTION_REQUIREMENT' }>,
): SpfaActionRequirementEvidenceBaselineV2 {
  const identity = {
    ...baselineIdentity(transcript, carePathSpfaRef, requirement),
    kind: requirement.kind,
  };
  if (requirement.applicability.status === 'NOT_APPLICABLE') {
    return {
      ...identity,
      resolution: 'NOT_APPLICABLE',
      deterministicPerformedTargetRefs: [],
      unresolvedTargetRefs: [],
      deterministicEvidence: [],
      semanticCandidateUniverse: [],
    };
  }
  const unresolvedTargetRefs = requirement.actionTargets.map(
    (bound) => bound.targetId,
  ) as unknown as NonEmptyArray<SpfaRequirementTargetId>;
  return {
    ...identity,
    resolution: 'SEMANTIC_REQUIRED',
    deterministicPerformedTargetRefs: [],
    unresolvedTargetRefs,
    deterministicEvidence: [],
    semanticCandidateUniverse: candidatesFor(
      unresolvedTargetRefs,
      transcript,
      'student',
    ),
  };
}

export function buildSpfaRequirementEvidenceBaselineV2(
  input: BuildSpfaRequirementEvidenceBaselineInputV2,
): SpfaRequirementEvidenceBaselineV2 {
  const transcript = validateSessionTranscriptSnapshotV2(
    input.transcript,
    'input.transcript',
  );
  const baseline =
    input.appliedRequirement.kind === 'INFORMATION_REQUIREMENT'
      ? informationBaseline(
          transcript,
          input.carePathSpfaRef,
          input.appliedRequirement,
        )
      : actionBaseline(
          transcript,
          input.carePathSpfaRef,
          input.appliedRequirement,
        );
  materializationContexts.set(baseline, {
    transcript,
    carePathSpfaRef: input.carePathSpfaRef,
    appliedRequirement: cloneAppliedRequirement(input.appliedRequirement),
  });
  return baseline;
}

export function materializeDeterministicSpfaRequirementSessionResultV2(
  baseline: SpfaRequirementEvidenceBaselineV2,
): SpfaRequirementSessionResultV2 | null {
  if (
    baseline.resolution === 'DETERMINISTIC_PARTIAL' ||
    baseline.resolution === 'SEMANTIC_REQUIRED'
  ) {
    return null;
  }
  const context = materializationContexts.get(baseline);
  if (context === undefined) {
    throw new SpfaEvidenceBaselineError(
      'baseline',
      'must be the canonical instance produced by the baseline builder',
    );
  }
  const identity = {
    schemaVersion: '2.0' as const,
    sessionId: baseline.sessionId,
    caseVersionId: baseline.caseVersionId,
    transcriptFingerprint: { ...baseline.transcriptFingerprint },
    carePathSpfaRef: baseline.carePathSpfaRef,
    requirementRef: baseline.requirementRef,
    kind: baseline.kind,
  };
  const result: unknown =
    baseline.kind === 'INFORMATION_REQUIREMENT'
      ? {
          ...identity,
          coverage:
            baseline.resolution === 'NOT_APPLICABLE'
              ? { status: 'NOT_APPLICABLE', evidence: [] }
              : {
                  status: 'COVERED',
                  origin: 'PUBLIC_INFORMATION',
                  coveredTargetRefs: [...baseline.deterministicCoveredTargetRefs],
                  evidence: baseline.deterministicEvidence.map((item) => ({
                    ...item,
                  })),
                },
        }
      : {
          ...identity,
          outcome: { status: 'NOT_APPLICABLE', evidence: [] },
        };
  return validateSpfaRequirementSessionResultV2(result, context);
}
