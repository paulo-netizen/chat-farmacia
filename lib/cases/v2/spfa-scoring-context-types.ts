import type { ConclusionId, VersionRef } from './evaluator-types';
import type {
  AppliedRequirementApplicabilityV2,
  SpfaRequirementTargetId,
} from './spfa-protocol-application-types';
import type {
  ApplicableRequirementImportance,
  SpfaProtocolRefV2,
  SpfaProtocolRequirementId,
  SpfaSafetyCriticalityV2,
} from './spfa-protocol-types';
import type { SessionTranscriptFingerprintV2 } from './spfa-session-evidence-types';
import type { CaseVersionId } from './types';

export type SpfaScoringRequirementKindV2 =
  | 'INFORMATION_REQUIREMENT'
  | 'ACTION_REQUIREMENT';

export type SpfaScoringRequirementResultStatusV2 =
  | 'COVERED'
  | 'PARTIALLY_COVERED'
  | 'NOT_COVERED'
  | 'PERFORMED'
  | 'PARTIALLY_PERFORMED'
  | 'NOT_PERFORMED'
  | 'NOT_APPLICABLE';

type SpfaScoringRequirementContextBaseV2 = Readonly<{
  carePathSpfaRef: ConclusionId;
  protocolRef: SpfaProtocolRefV2;
  requirementRef: SpfaProtocolRequirementId;
  requirementKind: SpfaScoringRequirementKindV2;
  safetyCriticality: SpfaSafetyCriticalityV2;
  targetRefs: readonly SpfaRequirementTargetId[];
  resultStatus: SpfaScoringRequirementResultStatusV2;
  positiveTargetRefs: readonly SpfaRequirementTargetId[];
  remainingTargetRefs: readonly SpfaRequirementTargetId[];
  uncertainTargetRefs: readonly SpfaRequirementTargetId[];
  totalTargetCount: number;
  positiveTargetCount: number;
  remainingTargetCount: number;
  uncertainTargetCount: number;
}>;

export type SpfaScoringRequirementContextV2 = Readonly<
  SpfaScoringRequirementContextBaseV2 &
    (
      | {
          applicability: Extract<
            AppliedRequirementApplicabilityV2,
            { status: 'APPLICABLE' }
          >;
          effectiveImportance: ApplicableRequirementImportance;
        }
      | {
          applicability: Extract<
            AppliedRequirementApplicabilityV2,
            { status: 'NOT_APPLICABLE' }
          >;
          effectiveImportance?: never;
        }
    )
>;

/** Pure, server-owned input for later scoring policy application. */
export type SpfaScoringContextV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  caseVersionId: CaseVersionId;
  protocolCatalogRef: Readonly<VersionRef>;
  transcriptFingerprint: SessionTranscriptFingerprintV2;
  requirements: readonly SpfaScoringRequirementContextV2[];
}>;
