import type { ConclusionId, NonEmptyArray } from './evaluator-types';
import type { SpfaRequirementTargetId } from './spfa-protocol-application-types';
import type {
  SessionMessageId,
  SessionTranscriptFingerprintV1,
} from './spfa-session-evidence-types';
import type { SpfaProtocolRequirementId } from './spfa-protocol-types';
import type { CaseVersionId } from './types';

export type SpfaDeterministicResolutionV2 =
  | 'NOT_APPLICABLE'
  | 'DETERMINISTIC_COMPLETE'
  | 'DETERMINISTIC_PARTIAL'
  | 'SEMANTIC_REQUIRED';

export type SpfaSemanticEvidenceCandidateV2 = Readonly<{
  targetRef: SpfaRequirementTargetId;
  messageRef: SessionMessageId;
}>;

export type SpfaDeterministicPublicEvidenceV2 = Readonly<{
  source: 'PUBLIC_INFORMATION';
  targetRef: SpfaRequirementTargetId;
}>;

type SpfaRequirementEvidenceBaselineIdentityV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV1;
  carePathSpfaRef: ConclusionId;
  requirementRef: SpfaProtocolRequirementId;
}>;

type InformationBaselineIdentityV2 = Readonly<{
  kind: 'INFORMATION_REQUIREMENT';
}>;

export type SpfaInformationRequirementEvidenceBaselineV2 = Readonly<
  SpfaRequirementEvidenceBaselineIdentityV2 &
    InformationBaselineIdentityV2 &
    (
      | {
          resolution: 'NOT_APPLICABLE';
          deterministicCoveredTargetRefs: readonly [];
          unresolvedTargetRefs: readonly [];
          deterministicEvidence: readonly [];
          semanticCandidateUniverse: readonly [];
        }
      | {
          resolution: 'DETERMINISTIC_COMPLETE';
          deterministicCoveredTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
          unresolvedTargetRefs: readonly [];
          deterministicEvidence: NonEmptyArray<SpfaDeterministicPublicEvidenceV2>;
          semanticCandidateUniverse: readonly [];
        }
      | {
          resolution: 'DETERMINISTIC_PARTIAL';
          deterministicCoveredTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
          unresolvedTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
          deterministicEvidence: NonEmptyArray<SpfaDeterministicPublicEvidenceV2>;
          semanticCandidateUniverse: readonly SpfaSemanticEvidenceCandidateV2[];
        }
      | {
          resolution: 'SEMANTIC_REQUIRED';
          deterministicCoveredTargetRefs: readonly [];
          unresolvedTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
          deterministicEvidence: readonly [];
          semanticCandidateUniverse: readonly SpfaSemanticEvidenceCandidateV2[];
        }
    )
>;

type ActionBaselineIdentityV2 = Readonly<{
  kind: 'ACTION_REQUIREMENT';
}>;

export type SpfaActionRequirementEvidenceBaselineV2 = Readonly<
  SpfaRequirementEvidenceBaselineIdentityV2 &
    ActionBaselineIdentityV2 &
    (
      | {
          resolution: 'NOT_APPLICABLE';
          deterministicPerformedTargetRefs: readonly [];
          unresolvedTargetRefs: readonly [];
          deterministicEvidence: readonly [];
          semanticCandidateUniverse: readonly [];
        }
      | {
          resolution: 'SEMANTIC_REQUIRED';
          deterministicPerformedTargetRefs: readonly [];
          unresolvedTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
          deterministicEvidence: readonly [];
          semanticCandidateUniverse: readonly SpfaSemanticEvidenceCandidateV2[];
        }
    )
>;

export type SpfaRequirementEvidenceBaselineV2 =
  | SpfaInformationRequirementEvidenceBaselineV2
  | SpfaActionRequirementEvidenceBaselineV2;

export type SpfaSemanticCandidateSelectionV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV1;
  carePathSpfaRef: ConclusionId;
  requirementRef: SpfaProtocolRequirementId;
  kind: 'INFORMATION_REQUIREMENT' | 'ACTION_REQUIREMENT';
  candidates: readonly SpfaSemanticEvidenceCandidateV2[];
}>;
