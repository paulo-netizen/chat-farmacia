import type { ConclusionId, VersionRef } from './evaluator-types';
import type { SpfaScoringRequirementKindV2, SpfaScoringRequirementResultStatusV2 } from './spfa-scoring-context-types';
import type { ApplicableRequirementImportance, SpfaProtocolRefV2, SpfaProtocolRequirementId, SpfaSafetyCriticalityV2 } from './spfa-protocol-types';
import type { SessionTranscriptFingerprintV2 } from './spfa-session-evidence-types';
import type { CaseVersionId } from './types';

export type SpfaCriticalAlertCodeV2 =
  | 'CRITICAL_OMISSION'
  | 'CRITICAL_PARTIAL'
  | 'CRITICAL_UNCERTAIN';

type SpfaRequirementContributionBaseV2 = Readonly<{
  carePathSpfaRef: ConclusionId;
  protocolRef: SpfaProtocolRefV2;
  requirementRef: SpfaProtocolRequirementId;
  requirementKind: SpfaScoringRequirementKindV2;
  safetyCriticality: SpfaSafetyCriticalityV2;
  resultStatus: SpfaScoringRequirementResultStatusV2;
  earnedPoints: number;
  possiblePoints: number;
  totalTargetCount: number;
  positiveTargetCount: number;
  remainingTargetCount: number;
  uncertainTargetCount: number;
}>;

export type SpfaRequirementContributionV2 = Readonly<
  SpfaRequirementContributionBaseV2 &
    (
      | {
          applicability: 'APPLICABLE';
          effectiveImportance: ApplicableRequirementImportance;
        }
      | {
          applicability: 'NOT_APPLICABLE';
          effectiveImportance?: never;
        }
    )
>;

export type SpfaCriticalAlertV2 = Readonly<{
  carePathSpfaRef: ConclusionId;
  requirementRef: SpfaProtocolRequirementId;
  code: SpfaCriticalAlertCodeV2;
}>;

type SpfaSessionScoreBaseV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV2;
  protocolCatalogRef: Readonly<VersionRef>;
  scoringPolicyRef: Readonly<VersionRef>;
  rawPoints: number;
  possiblePoints: number;
  requirementContributions: readonly SpfaRequirementContributionV2[];
  criticalAlerts: readonly SpfaCriticalAlertV2[];
}>;

export type SpfaSessionScoreV2 = Readonly<
  SpfaSessionScoreBaseV2 &
    (
      | {
          status: 'NOT_SCORABLE';
          score: null;
          needsReview: false;
        }
      | {
          status: 'SCORED';
          score: number;
          needsReview: false;
        }
      | {
          status: 'REVIEW_REQUIRED';
          score: number;
          needsReview: true;
        }
    )
>;
