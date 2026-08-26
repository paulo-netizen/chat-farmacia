import type {
  SpfaEvaluationFinalizationResultV2,
} from './finalize-spfa-session-evaluation';
import type {
  OwnedSpfaEvaluationStatusV2,
} from './get-owned-spfa-evaluation-status';
import type {
  StudentSpfaEvaluationDtoV2,
  TeacherSpfaEvaluationDtoV2,
  TeacherSpfaEvidenceRefDtoV2,
  TeacherSpfaRequirementContributionDtoV2,
  TeacherSpfaRequirementEvidenceDtoV2,
  TeacherSpfaSnapshotIdentityDtoV2,
} from './spfa-evaluation-dto-types';
import type { SpfaEvaluationSnapshotIdentityV2 } from './spfa-evaluation-lifecycle-types';
import type { SpfaSessionEvaluationV2 } from './spfa-session-evaluation-types';
import type { SpfaSessionScoreV2 } from './spfa-session-score-types';
import type { SpfaSessionEvidenceRefV2 } from './spfa-session-evidence-types';

export type SpfaEvaluationDtoSourceV2 =
  | OwnedSpfaEvaluationStatusV2
  | SpfaEvaluationFinalizationResultV2;

function statusOf(source: SpfaEvaluationDtoSourceV2):
  'NOT_STARTED' | 'EVALUATING' | 'FAILED' | 'COMPLETED' {
  if ('status' in source) return source.status;
  return source.outcome === 'IN_PROGRESS' ? 'EVALUATING' : source.outcome;
}

function scoreOf(source: SpfaEvaluationDtoSourceV2): SpfaSessionScoreV2 {
  if (!('score' in source) || source.score === undefined) {
    throw new TypeError('completed SPFA DTO source must contain score');
  }
  return source.score;
}

function evaluationOf(source: SpfaEvaluationDtoSourceV2): SpfaSessionEvaluationV2 {
  if (!('evaluation' in source) || source.evaluation === undefined) {
    throw new TypeError('completed SPFA DTO source must contain evaluation');
  }
  return source.evaluation;
}

function snapshotOf(
  source: SpfaEvaluationDtoSourceV2,
): SpfaEvaluationSnapshotIdentityV2 {
  if (!('snapshotIdentity' in source)) {
    throw new TypeError('started SPFA DTO source must contain snapshot identity');
  }
  return source.snapshotIdentity;
}

function snapshotDto(
  value: SpfaEvaluationSnapshotIdentityV2,
): TeacherSpfaSnapshotIdentityDtoV2 {
  return {
    caseVersionId: value.caseVersionId,
    protocolCatalogRef: {
      id: value.protocolCatalogRef.id,
      version: value.protocolCatalogRef.version,
    },
    transcriptFingerprint: {
      algorithm: value.transcriptFingerprint.algorithm,
      canonicalization: value.transcriptFingerprint.canonicalization,
      value: value.transcriptFingerprint.value,
    },
    scoringPolicyRef: {
      id: value.scoringPolicyRef.id,
      version: value.scoringPolicyRef.version,
    },
  };
}

function evidenceDto(
  value: SpfaSessionEvidenceRefV2,
): TeacherSpfaEvidenceRefDtoV2 {
  if (value.source === 'PUBLIC_INFORMATION') {
    return { source: 'PUBLIC_INFORMATION', targetRef: value.targetRef };
  }
  return {
    source: 'TRANSCRIPT_MESSAGE',
    messageRef: value.messageRef,
    speaker: value.speaker,
    evidenceKind: value.evidenceKind,
    ...(value.excerpt === undefined ? {} : { excerpt: value.excerpt }),
  };
}

function requirementEvidence(
  evaluation: SpfaSessionEvaluationV2,
): readonly TeacherSpfaRequirementEvidenceDtoV2[] {
  return evaluation.applications.flatMap((application) =>
    application.requirementResults.map((result) => {
      const material = result.kind === 'INFORMATION_REQUIREMENT'
        ? result.coverage
        : result.outcome;
      return {
        carePathSpfaRef: application.carePathSpfaRef,
        protocolRef: {
          protocolId: application.protocolRef.protocolId,
          version: application.protocolRef.version,
        },
        requirementRef: result.requirementRef,
        requirementKind: result.kind,
        resultStatus: material.status,
        evidence: material.evidence.map(evidenceDto),
      };
    }),
  );
}

function contributionDto(
  value: SpfaSessionScoreV2['requirementContributions'][number],
): TeacherSpfaRequirementContributionDtoV2 {
  return {
    carePathSpfaRef: value.carePathSpfaRef,
    protocolRef: {
      protocolId: value.protocolRef.protocolId,
      version: value.protocolRef.version,
    },
    requirementRef: value.requirementRef,
    requirementKind: value.requirementKind,
    applicability: value.applicability,
    ...(value.applicability === 'APPLICABLE'
      ? { effectiveImportance: value.effectiveImportance }
      : {}),
    safetyCriticality: {
      safetyCritical: value.safetyCriticality.safetyCritical,
    },
    resultStatus: value.resultStatus,
    earnedPoints: value.earnedPoints,
    possiblePoints: value.possiblePoints,
    totalTargetCount: value.totalTargetCount,
    positiveTargetCount: value.positiveTargetCount,
    remainingTargetCount: value.remainingTargetCount,
    uncertainTargetCount: value.uncertainTargetCount,
  };
}

export function toStudentSpfaEvaluationDtoV2(
  source: SpfaEvaluationDtoSourceV2,
): StudentSpfaEvaluationDtoV2 {
  const status = statusOf(source);
  if (status === 'NOT_STARTED') return { schemaVersion: '2.0', status };
  if (status === 'EVALUATING') return { schemaVersion: '2.0', status };
  if (status === 'FAILED') {
    return { schemaVersion: '2.0', status, retryable: true };
  }
  const score = scoreOf(source);
  return {
    schemaVersion: '2.0',
    status,
    score: score.score,
    scoreStatus: score.status,
    needsReview: score.needsReview,
  };
}

export function toTeacherSpfaEvaluationDtoV2(
  source: SpfaEvaluationDtoSourceV2,
): TeacherSpfaEvaluationDtoV2 {
  const status = statusOf(source);
  if (status === 'NOT_STARTED') return { schemaVersion: '2.0', status };
  const snapshotIdentity = snapshotDto(snapshotOf(source));
  if (status === 'EVALUATING') {
    return { schemaVersion: '2.0', status, snapshotIdentity };
  }
  if (status === 'FAILED') {
    if (!('failureCode' in source)) {
      throw new TypeError('failed SPFA DTO source must contain failureCode');
    }
    return {
      schemaVersion: '2.0',
      status,
      snapshotIdentity,
      failureCode: source.failureCode,
    };
  }
  const score = scoreOf(source);
  const evaluation = evaluationOf(source);
  return {
    schemaVersion: '2.0',
    status,
    snapshotIdentity,
    score: {
      status: score.status,
      score: score.score,
      needsReview: score.needsReview,
      rawPoints: score.rawPoints,
      possiblePoints: score.possiblePoints,
      requirementContributions:
        score.requirementContributions.map(contributionDto),
      criticalAlerts: score.criticalAlerts.map((alert) => ({
        carePathSpfaRef: alert.carePathSpfaRef,
        requirementRef: alert.requirementRef,
        code: alert.code,
      })),
    },
    semanticExecutions: evaluation.semanticExecutions.map((execution) => ({
      carePathSpfaRef: execution.carePathSpfaRef,
      requirementRef: execution.requirementRef,
      provider: execution.provider,
      responseModel: execution.responseModel,
      promptVersion: execution.promptVersion,
    })),
    requirementEvidence: requirementEvidence(evaluation),
  };
}
