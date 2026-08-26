import type {
  ConclusionId,
  VersionRef,
} from './evaluator-types';
import type { SpfaEvaluationFailureCodeV2 } from './spfa-evaluation-lifecycle-types';
import type {
  SpfaCriticalAlertCodeV2,
  SpfaRequirementContributionV2,
} from './spfa-session-score-types';
import type {
  SessionMessageId,
  SessionTranscriptFingerprintV2,
  SpfaTranscriptEvidenceKindV2,
} from './spfa-session-evidence-types';
import type {
  SpfaProtocolRefV2,
  SpfaProtocolRequirementId,
} from './spfa-protocol-types';
import type { CaseVersionId } from './types';

export type StudentSpfaEvaluationDtoV2 =
  | Readonly<{ schemaVersion: '2.0'; status: 'NOT_STARTED' }>
  | Readonly<{ schemaVersion: '2.0'; status: 'EVALUATING' }>
  | Readonly<{
      schemaVersion: '2.0';
      status: 'FAILED';
      retryable: true;
    }>
  | Readonly<{
      schemaVersion: '2.0';
      status: 'COMPLETED';
      score: number | null;
      scoreStatus: 'SCORED' | 'REVIEW_REQUIRED' | 'NOT_SCORABLE';
      needsReview: boolean;
    }>;

export type TeacherSpfaSnapshotIdentityDtoV2 = Readonly<{
  caseVersionId: CaseVersionId;
  protocolCatalogRef: Readonly<VersionRef>;
  transcriptFingerprint: SessionTranscriptFingerprintV2;
  scoringPolicyRef: Readonly<VersionRef>;
}>;

export type TeacherSpfaEvidenceRefDtoV2 =
  | Readonly<{
      source: 'PUBLIC_INFORMATION';
      targetRef: string;
    }>
  | Readonly<{
      source: 'TRANSCRIPT_MESSAGE';
      messageRef: SessionMessageId;
      speaker: 'student' | 'patient';
      evidenceKind: SpfaTranscriptEvidenceKindV2;
      excerpt?: string;
    }>;

export type TeacherSpfaRequirementEvidenceDtoV2 = Readonly<{
  carePathSpfaRef: ConclusionId;
  protocolRef: SpfaProtocolRefV2;
  requirementRef: SpfaProtocolRequirementId;
  requirementKind: 'INFORMATION_REQUIREMENT' | 'ACTION_REQUIREMENT';
  resultStatus:
    | 'COVERED'
    | 'PARTIALLY_COVERED'
    | 'NOT_COVERED'
    | 'PERFORMED'
    | 'PARTIALLY_PERFORMED'
    | 'NOT_PERFORMED'
    | 'NOT_APPLICABLE';
  evidence: readonly TeacherSpfaEvidenceRefDtoV2[];
}>;

export type TeacherSpfaRequirementContributionDtoV2 = Readonly<{
  carePathSpfaRef: ConclusionId;
  protocolRef: SpfaProtocolRefV2;
  requirementRef: SpfaProtocolRequirementId;
  requirementKind: SpfaRequirementContributionV2['requirementKind'];
  applicability: SpfaRequirementContributionV2['applicability'];
  effectiveImportance?: 'CRITICAL' | 'RELEVANT' | 'OPTIONAL';
  safetyCriticality: Readonly<{ safetyCritical: boolean }>;
  resultStatus: SpfaRequirementContributionV2['resultStatus'];
  earnedPoints: number;
  possiblePoints: number;
  totalTargetCount: number;
  positiveTargetCount: number;
  remainingTargetCount: number;
  uncertainTargetCount: number;
}>;

export type TeacherSpfaEvaluationDtoV2 =
  | Readonly<{ schemaVersion: '2.0'; status: 'NOT_STARTED' }>
  | Readonly<{
      schemaVersion: '2.0';
      status: 'EVALUATING';
      snapshotIdentity: TeacherSpfaSnapshotIdentityDtoV2;
    }>
  | Readonly<{
      schemaVersion: '2.0';
      status: 'FAILED';
      snapshotIdentity: TeacherSpfaSnapshotIdentityDtoV2;
      failureCode: SpfaEvaluationFailureCodeV2;
    }>
  | Readonly<{
      schemaVersion: '2.0';
      status: 'COMPLETED';
      snapshotIdentity: TeacherSpfaSnapshotIdentityDtoV2;
      score: Readonly<{
        status: 'SCORED' | 'REVIEW_REQUIRED' | 'NOT_SCORABLE';
        score: number | null;
        needsReview: boolean;
        rawPoints: number;
        possiblePoints: number;
        requirementContributions:
          readonly TeacherSpfaRequirementContributionDtoV2[];
        criticalAlerts: readonly Readonly<{
          carePathSpfaRef: ConclusionId;
          requirementRef: SpfaProtocolRequirementId;
          code: SpfaCriticalAlertCodeV2;
        }>[];
      }>;
      semanticExecutions: readonly Readonly<{
        carePathSpfaRef: ConclusionId;
        requirementRef: SpfaProtocolRequirementId;
        provider: 'openai';
        responseModel: string;
        promptVersion: string;
      }>[];
      requirementEvidence: readonly TeacherSpfaRequirementEvidenceDtoV2[];
    }>;
