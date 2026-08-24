import type { ConclusionId, NonEmptyArray } from './evaluator-types';
import type { SpfaRequirementTargetId } from './spfa-protocol-application-types';
import type {
  SessionMessageId,
  SessionTranscriptFingerprintV1,
} from './spfa-session-evidence-types';
import type { SpfaProtocolRequirementId } from './spfa-protocol-types';
import type { CaseVersionId } from './types';

export type SpfaInformationSemanticSupportV2 = Readonly<{
  targetRef: SpfaRequirementTargetId;
  messageRef: SessionMessageId;
  evidenceKind: 'PATIENT_STATEMENT' | 'PATIENT_CONFIRMATION';
  excerpt?: string;
  acquisition:
    | Readonly<{ mode: 'SPONTANEOUS' }>
    | Readonly<{
        mode: 'ELICITED';
        studentQuestionRef: SessionMessageId;
      }>;
}>;

export type SpfaActionSemanticSupportV2 = Readonly<{
  targetRef: SpfaRequirementTargetId;
  messageRef: SessionMessageId;
  evidenceKind: 'STUDENT_ACTION';
  excerpt?: string;
}>;

export type SpfaInformationSemanticTargetDecisionV2 =
  | Readonly<{
      targetRef: SpfaRequirementTargetId;
      status: 'SUPPORTED';
      supports: NonEmptyArray<SpfaInformationSemanticSupportV2>;
    }>
  | Readonly<{
      targetRef: SpfaRequirementTargetId;
      status: 'NOT_SUPPORTED' | 'UNCERTAIN';
      supports: readonly [];
    }>;

export type SpfaActionSemanticTargetDecisionV2 =
  | Readonly<{
      targetRef: SpfaRequirementTargetId;
      status: 'SUPPORTED';
      supports: NonEmptyArray<SpfaActionSemanticSupportV2>;
    }>
  | Readonly<{
      targetRef: SpfaRequirementTargetId;
      status: 'NOT_SUPPORTED' | 'UNCERTAIN';
      supports: readonly [];
    }>;

export type SpfaSemanticTargetDecisionV2 =
  | SpfaInformationSemanticTargetDecisionV2
  | SpfaActionSemanticTargetDecisionV2;

type SpfaSemanticAdjudicationIdentityV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'spfa-semantic-adjudication/1';
  sessionId: string;
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV1;
  carePathSpfaRef: ConclusionId;
  requirementRef: SpfaProtocolRequirementId;
}>;

export type SpfaSemanticAdjudicationV2 =
  | Readonly<
      SpfaSemanticAdjudicationIdentityV2 & {
        kind: 'INFORMATION_REQUIREMENT';
        decisions: readonly SpfaInformationSemanticTargetDecisionV2[];
      }
    >
  | Readonly<
      SpfaSemanticAdjudicationIdentityV2 & {
        kind: 'ACTION_REQUIREMENT';
        decisions: readonly SpfaActionSemanticTargetDecisionV2[];
      }
    >;
