import type {
  ConclusionId,
  NonEmptyArray,
  VersionRef,
} from './evaluator-types';
import type { CaseSpfaProtocolSetV2 } from './spfa-protocol-set-types';
import type {
  SessionTranscriptFingerprintV2,
  SessionTranscriptSnapshotV2,
  SpfaRequirementSessionResultV2,
} from './spfa-session-evidence-types';
import type {
  SpfaProtocolRefV2,
  SpfaProtocolRequirementId,
} from './spfa-protocol-types';
import type { CaseVersionId } from './types';

export type SpfaSessionEvaluationApplicationV2 = Readonly<{
  carePathSpfaRef: ConclusionId;
  protocolRef: SpfaProtocolRefV2;
  requirementResults: NonEmptyArray<SpfaRequirementSessionResultV2>;
}>;

export type SpfaSessionSemanticExecutionV2 = Readonly<{
  carePathSpfaRef: ConclusionId;
  requirementRef: SpfaProtocolRequirementId;
  provider: 'openai';
  responseModel: string;
  promptVersion: string;
}>;

/**
 * Server-only aggregate. It is not a student or teacher DTO.
 */
export type SpfaSessionEvaluationV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  caseVersionId: CaseVersionId;
  protocolCatalogRef: Readonly<VersionRef>;
  transcriptFingerprint: SessionTranscriptFingerprintV2;
  applications: NonEmptyArray<SpfaSessionEvaluationApplicationV2>;
  semanticExecutions: readonly SpfaSessionSemanticExecutionV2[];
}>;

/**
 * Canonical server-owned context required to reuse the D1 result validator
 * without embedding the protected transcript or applied requirements in the
 * aggregate itself.
 */
export type SpfaSessionEvaluationValidationContextV2 = Readonly<{
  transcript: SessionTranscriptSnapshotV2;
  spfaProtocolSet: CaseSpfaProtocolSetV2;
}>;
