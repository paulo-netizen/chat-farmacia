import type {
  PharmaceuticalAdjudicationContextFingerprintV1,
  PharmaceuticalTargetAdjudicationContextV2,
} from './pharmaceutical-adjudication-context-types';
import type {
  PharmaceuticalD1BatchDomainV1,
  PharmaceuticalD1StructuralNoStudentCandidatesShellV2,
} from './pharmaceutical-d1-batch-types';
import type { PharmaceuticalEvaluationTargetId } from './pharmaceutical-evaluation-target-types';
import type { PharmaceuticalStudentEvidenceKindV2 } from './pharmaceutical-session-evidence-types';
import type { SessionMessageId, SessionTranscriptFingerprintV1 } from './spfa-session-evidence-types';
import type { CaseVersionId } from './types';

declare const pharmaceuticalSemanticExecutionIdBrand: unique symbol;

export type PharmaceuticalSemanticExecutionIdV2 = string & {
  readonly [pharmaceuticalSemanticExecutionIdBrand]: true;
};

/** Historical pre-live prompt identity; retained only for version traceability. */
export const PHARMACEUTICAL_D1_PROMPT_VERSION_V1 =
  'pharmaceutical-d1-adjudication-prompt/1' as const;
export const PHARMACEUTICAL_D1_PROMPT_VERSION_V2 =
  'pharmaceutical-d1-adjudication-prompt/2' as const;
export const PHARMACEUTICAL_D1_PROMPT_VERSION_V3 =
  'pharmaceutical-d1-adjudication-prompt/3' as const;

export const PHARMACEUTICAL_D1_SEMANTIC_REQUEST_CONTRACT_VERSION_V1 =
  'pharmaceutical-d1-semantic-batch-request/1' as const;

export type PharmaceuticalD1SemanticRequestFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'pharmaceutical-d1-semantic-request-v2/1';
  value: string;
}>;

export type PharmaceuticalD1SemanticBatchRequestV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-d1-semantic-batch-request/1';
  batchPlanVersion: 'pharmaceutical-d1-batch-plan/1';
  batchDomain: PharmaceuticalD1BatchDomainV1;
  contextFingerprint: PharmaceuticalAdjudicationContextFingerprintV1;
  promptVersion: string;
  targets: readonly PharmaceuticalTargetAdjudicationContextV2[];
  requestFingerprint: PharmaceuticalD1SemanticRequestFingerprintV1;
}>;

export type PharmaceuticalD1ProviderEvidenceV1 = Readonly<{
  messageRef: SessionMessageId;
  evidenceKind: PharmaceuticalStudentEvidenceKindV2;
  excerpt: string;
}>;

export type PharmaceuticalD1ProviderTargetResultV1 =
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      verdict: 'CORRECTLY_DEMONSTRATED';
      supportingEvidence: readonly [
        PharmaceuticalD1ProviderEvidenceV1,
        ...PharmaceuticalD1ProviderEvidenceV1[],
      ];
    }>
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      verdict: 'INCORRECT_OR_CONTRADICTED';
      contradictionEvidence: readonly [
        PharmaceuticalD1ProviderEvidenceV1,
        ...PharmaceuticalD1ProviderEvidenceV1[],
      ];
    }>
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      verdict: 'UNCERTAIN';
      relatedEvidence: readonly [
        PharmaceuticalD1ProviderEvidenceV1,
        ...PharmaceuticalD1ProviderEvidenceV1[],
      ];
    }>
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      verdict: 'NOT_DEMONSTRATED';
      evidence: readonly [];
    }>;

export type PharmaceuticalD1ProviderBatchResultV1 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-d1-provider-result/1';
  results: readonly PharmaceuticalD1ProviderTargetResultV1[];
}>;

export type PharmaceuticalD1CanonicalStudentEvidenceRefV2 = Readonly<{
  targetRef: PharmaceuticalEvaluationTargetId;
  messageRef: SessionMessageId;
  speaker: 'student';
  evidenceRole: 'STUDENT_DEMONSTRATION';
  evidenceKind: PharmaceuticalStudentEvidenceKindV2;
  excerpt: string;
}>;

export type PharmaceuticalD1SemanticExecutionMetadataV2 = Readonly<{
  semanticExecutionRef: PharmaceuticalSemanticExecutionIdV2;
  lane: 'D1';
  provider: string;
  responseModel: string;
  promptVersion: string;
  requestFingerprint: PharmaceuticalD1SemanticRequestFingerprintV1;
  includedTargetRefs: readonly PharmaceuticalEvaluationTargetId[];
}>;

export type PharmaceuticalD1SemanticTargetAdjudicationV2 =
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      resolution: 'SEMANTIC';
      verdict: 'CORRECTLY_DEMONSTRATED';
      supportingEvidenceRefs: readonly [
        PharmaceuticalD1CanonicalStudentEvidenceRefV2,
        ...PharmaceuticalD1CanonicalStudentEvidenceRefV2[],
      ];
      semanticExecutionRef: PharmaceuticalSemanticExecutionIdV2;
    }>
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      resolution: 'SEMANTIC';
      verdict: 'INCORRECT_OR_CONTRADICTED';
      contradictionEvidenceRefs: readonly [
        PharmaceuticalD1CanonicalStudentEvidenceRefV2,
        ...PharmaceuticalD1CanonicalStudentEvidenceRefV2[],
      ];
      semanticExecutionRef: PharmaceuticalSemanticExecutionIdV2;
    }>
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      resolution: 'SEMANTIC';
      verdict: 'UNCERTAIN';
      relatedEvidenceRefs: readonly [
        PharmaceuticalD1CanonicalStudentEvidenceRefV2,
        ...PharmaceuticalD1CanonicalStudentEvidenceRefV2[],
      ];
      semanticExecutionRef: PharmaceuticalSemanticExecutionIdV2;
    }>
  | Readonly<{
      targetRef: PharmaceuticalEvaluationTargetId;
      resolution: 'SEMANTIC';
      verdict: 'NOT_DEMONSTRATED';
      evidenceRefs: readonly [];
      semanticExecutionRef: PharmaceuticalSemanticExecutionIdV2;
    }>;

export type PharmaceuticalD1TargetAdjudicationV2 =
  | PharmaceuticalD1StructuralNoStudentCandidatesShellV2
  | PharmaceuticalD1SemanticTargetAdjudicationV2;

export type PharmaceuticalD1AcceptedSemanticBatchV2 = Readonly<{
  batchDomain: PharmaceuticalD1BatchDomainV1;
  requestFingerprint: PharmaceuticalD1SemanticRequestFingerprintV1;
  execution: PharmaceuticalD1SemanticExecutionMetadataV2;
  adjudications: readonly PharmaceuticalD1SemanticTargetAdjudicationV2[];
}>;

export type PharmaceuticalTargetSemanticAdjudicationSetFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'pharmaceutical-target-semantic-adjudication-set-v2/1';
  value: string;
}>;

export type PharmaceuticalTargetSemanticAdjudicationSetV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-target-semantic-adjudication-set/1';
  sessionId: string;
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV1;
  targetSetFingerprint: import('./pharmaceutical-evaluation-target-types').PharmaceuticalEvaluationTargetSetFingerprintV1;
  contextFingerprint: PharmaceuticalAdjudicationContextFingerprintV1;
  batchPlanVersion: 'pharmaceutical-d1-batch-plan/1';
  executions: readonly PharmaceuticalD1SemanticExecutionMetadataV2[];
  adjudications: readonly PharmaceuticalD1TargetAdjudicationV2[];
  fingerprint: PharmaceuticalTargetSemanticAdjudicationSetFingerprintV1;
}>;
