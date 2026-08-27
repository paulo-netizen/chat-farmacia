import type {
  SessionMessageId,
  SessionTranscriptFingerprintV1,
  SessionTranscriptMessageRoleV2,
} from './spfa-session-evidence-types';
import type {
  PharmaceuticalEvaluationTargetId,
  PharmaceuticalEvaluationTargetSetFingerprintV1,
} from './pharmaceutical-evaluation-target-types';
import type { CaseVersionId } from './types';

export type PharmaceuticalStudentEvidenceKindV2 =
  | 'STUDENT_QUESTION'
  | 'STUDENT_INTERPRETATION'
  | 'STUDENT_DECISION'
  | 'STUDENT_ACTION';

export type PharmaceuticalPatientEvidenceKindV2 =
  | 'PATIENT_STATEMENT'
  | 'PATIENT_CONFIRMATION';

export type PharmaceuticalSessionEvidenceCandidateV2 =
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      messageRef: SessionMessageId;
      speaker: 'student';
      evidenceRole: 'STUDENT_DEMONSTRATION';
      evidenceKind: PharmaceuticalStudentEvidenceKindV2;
    }>
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      messageRef: SessionMessageId;
      speaker: 'patient';
      evidenceRole: 'ACQUISITION_CONTEXT';
      evidenceKind: PharmaceuticalPatientEvidenceKindV2;
    }>;

type PharmaceuticalSessionEvidenceIdentityV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-session-evidence/1';
  sessionId: string;
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV1;
  targetSetFingerprint: PharmaceuticalEvaluationTargetSetFingerprintV1;
}>;

export type PharmaceuticalSessionEvidenceCandidateSetV2 = Readonly<
  PharmaceuticalSessionEvidenceIdentityV2 & {
    candidates: readonly PharmaceuticalSessionEvidenceCandidateV2[];
  }
>;

export type PharmaceuticalSessionEvidenceRefV2 =
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      messageRef: SessionMessageId;
      speaker: 'student';
      evidenceRole: 'STUDENT_DEMONSTRATION';
      evidenceKind: PharmaceuticalStudentEvidenceKindV2;
      excerpt: string;
    }>
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      messageRef: SessionMessageId;
      speaker: 'patient';
      evidenceRole: 'ACQUISITION_CONTEXT';
      evidenceKind: PharmaceuticalPatientEvidenceKindV2;
      excerpt: string;
      studentQuestionRef?: SessionMessageId;
    }>;

export type PharmaceuticalSessionEvidenceSetV2 = Readonly<
  PharmaceuticalSessionEvidenceIdentityV2 & {
    evidence: readonly PharmaceuticalSessionEvidenceRefV2[];
  }
>;

export type PharmaceuticalSessionEvidenceValidationContextV2 = Readonly<{
  transcript: import('./spfa-session-evidence-types').SessionTranscriptSnapshotV2;
  targetSet: import('./pharmaceutical-evaluation-target-types').PharmaceuticalEvaluationTargetSetV2;
  candidateSet: PharmaceuticalSessionEvidenceCandidateSetV2;
}>;

export type PharmaceuticalEvidenceSpeakerV2 = SessionTranscriptMessageRoleV2;
