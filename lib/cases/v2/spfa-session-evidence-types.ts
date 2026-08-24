import type { ConclusionId, NonEmptyArray } from './evaluator-types';
import type {
  AppliedSpfaRequirementV2,
  SpfaRequirementTargetId,
} from './spfa-protocol-application-types';
import type { SpfaProtocolRequirementId } from './spfa-protocol-types';
import type { CaseVersionId } from './types';

declare const sessionMessageIdBrand: unique symbol;

export type SessionMessageId = string & {
  readonly [sessionMessageIdBrand]: true;
};

export type SessionTranscriptMessageRoleV2 = 'student' | 'patient';

export type SessionTranscriptMessageV2 = Readonly<{
  messageId: SessionMessageId;
  role: SessionTranscriptMessageRoleV2;
  content: string;
  createdAt: string;
}>;

export type SessionTranscriptFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'session-transcript-v2/1';
  value: string;
}>;

export type SessionTranscriptFingerprintV2 = SessionTranscriptFingerprintV1;

export type SessionTranscriptSnapshotV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  caseVersionId: CaseVersionId;
  messages: readonly SessionTranscriptMessageV2[];
  fingerprint: SessionTranscriptFingerprintV1;
}>;

export type SessionTranscriptSnapshotInputV2 = Readonly<{
  sessionId: unknown;
  caseVersionId: unknown;
  messages: unknown;
}>;

export type SpfaCoverageOriginV2 =
  | 'PUBLIC_INFORMATION'
  | 'PATIENT_SPONTANEOUS'
  | 'STUDENT_ELICITED'
  | 'MIXED';

export type SpfaTranscriptEvidenceKindV2 =
  | 'PATIENT_STATEMENT'
  | 'PATIENT_CONFIRMATION'
  | 'STUDENT_QUESTION'
  | 'STUDENT_ACTION';

export type SpfaSessionEvidenceRefV2 =
  | Readonly<{
      source: 'PUBLIC_INFORMATION';
      targetRef: SpfaRequirementTargetId;
    }>
  | Readonly<{
      source: 'TRANSCRIPT_MESSAGE';
      messageRef: SessionMessageId;
      speaker: SessionTranscriptMessageRoleV2;
      evidenceKind: SpfaTranscriptEvidenceKindV2;
      excerpt?: string;
    }>;

export type SpfaRequirementCoverageV2 =
  | Readonly<{
      status: 'COVERED';
      origin: SpfaCoverageOriginV2;
      coveredTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'PARTIALLY_COVERED';
      origin: SpfaCoverageOriginV2;
      coveredTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'NOT_COVERED';
      coveredTargetRefs: readonly [];
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      evidence: readonly SpfaSessionEvidenceRefV2[];
    }>
  | Readonly<{
      status: 'NOT_APPLICABLE';
      evidence: readonly [];
    }>;

export type SpfaActionRequirementOutcomeV2 =
  | Readonly<{
      status: 'PERFORMED';
      performedTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'PARTIALLY_PERFORMED';
      performedTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'NOT_PERFORMED';
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      evidence: readonly SpfaSessionEvidenceRefV2[];
    }>
  | Readonly<{
      status: 'NOT_APPLICABLE';
      evidence: readonly [];
    }>;

type SpfaRequirementSessionResultIdentityV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV1;
  carePathSpfaRef: ConclusionId;
  requirementRef: SpfaProtocolRequirementId;
}>;

export type SpfaRequirementSessionResultV2 =
  | Readonly<
      SpfaRequirementSessionResultIdentityV2 & {
        kind: 'INFORMATION_REQUIREMENT';
        coverage: SpfaRequirementCoverageV2;
      }
    >
  | Readonly<
      SpfaRequirementSessionResultIdentityV2 & {
        kind: 'ACTION_REQUIREMENT';
        outcome: SpfaActionRequirementOutcomeV2;
      }
    >;

export type SpfaRequirementSessionResultValidationContextV2 = Readonly<{
  transcript: SessionTranscriptSnapshotV2;
  carePathSpfaRef: ConclusionId;
  appliedRequirement: AppliedSpfaRequirementV2;
}>;
