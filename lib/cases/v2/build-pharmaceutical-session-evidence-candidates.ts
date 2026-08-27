import type { PharmaceuticalEvaluationTargetCategoryV2 } from './pharmaceutical-evaluation-target-types';
import type {
  PharmaceuticalSessionEvidenceCandidateSetV2,
  PharmaceuticalStudentEvidenceKindV2,
} from './pharmaceutical-session-evidence-types';
import type { SessionTranscriptSnapshotV2 } from './spfa-session-evidence-types';
import type { PharmaceuticalEvaluationTargetSetV2 } from './pharmaceutical-evaluation-target-types';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';

const STUDENT_KINDS: Record<
  PharmaceuticalEvaluationTargetCategoryV2,
  readonly PharmaceuticalStudentEvidenceKindV2[]
> = {
  IDENTIFICATION: ['STUDENT_QUESTION', 'STUDENT_INTERPRETATION', 'STUDENT_DECISION', 'STUDENT_ACTION'],
  INTERPRETATION: ['STUDENT_INTERPRETATION', 'STUDENT_DECISION', 'STUDENT_ACTION'],
  DECISION: ['STUDENT_DECISION', 'STUDENT_ACTION'],
  ACTION: ['STUDENT_ACTION'],
};

function fingerprintCopy<T extends { algorithm: 'sha256'; canonicalization: string; value: string }>(value: T): T {
  return { ...value };
}

/** Structural candidate universe only; it performs no clinical or semantic matching. */
export function buildPharmaceuticalSessionEvidenceCandidatesV2(
  transcriptInput: SessionTranscriptSnapshotV2,
  targetSet: PharmaceuticalEvaluationTargetSetV2,
): PharmaceuticalSessionEvidenceCandidateSetV2 {
  const transcript = validateSessionTranscriptSnapshotV2(transcriptInput);
  if (transcript.caseVersionId !== targetSet.caseVersionId) {
    throw new Error('transcript.caseVersionId does not match targetSet.caseVersionId');
  }
  const candidates: PharmaceuticalSessionEvidenceCandidateSetV2['candidates'][number][] = [];
  for (const target of targetSet.targets) {
    for (const message of transcript.messages) {
      if (message.role === 'student') {
        for (const evidenceKind of STUDENT_KINDS[target.category]) {
          candidates.push({ targetRef: target.targetId, messageRef: message.messageId, speaker: 'student', evidenceRole: 'STUDENT_DEMONSTRATION', evidenceKind });
        }
      } else {
        candidates.push({ targetRef: target.targetId, messageRef: message.messageId, speaker: 'patient', evidenceRole: 'ACQUISITION_CONTEXT', evidenceKind: 'PATIENT_STATEMENT' });
        candidates.push({ targetRef: target.targetId, messageRef: message.messageId, speaker: 'patient', evidenceRole: 'ACQUISITION_CONTEXT', evidenceKind: 'PATIENT_CONFIRMATION' });
      }
    }
  }
  return {
    schemaVersion: '2.0',
    contractVersion: 'pharmaceutical-session-evidence/1',
    sessionId: transcript.sessionId,
    caseVersionId: transcript.caseVersionId,
    transcriptFingerprint: fingerprintCopy(transcript.fingerprint),
    targetSetFingerprint: fingerprintCopy(targetSet.fingerprint),
    candidates,
  };
}
