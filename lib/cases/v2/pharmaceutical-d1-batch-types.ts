import type {
  PharmaceuticalAdjudicationContextFingerprintV1,
  PharmaceuticalTargetAdjudicationContextV2,
} from './pharmaceutical-adjudication-context-types';
import type { PharmaceuticalEvaluationTargetId } from './pharmaceutical-evaluation-target-types';

export const PHARMACEUTICAL_D1_BATCH_PLAN_VERSION_V1 =
  'pharmaceutical-d1-batch-plan/1' as const;

export const PHARMACEUTICAL_D1_BATCH_DOMAIN_ORDER_V1 = Object.freeze([
  'PRM',
  'RNM_RELATION',
  'ADHERENCE',
  'PROFESSIONAL_RESPONSE',
  'REFERRAL_REPORT',
] as const);

export type PharmaceuticalD1BatchDomainV1 =
  (typeof PHARMACEUTICAL_D1_BATCH_DOMAIN_ORDER_V1)[number];

export type PharmaceuticalD1SemanticBatchV1 = Readonly<{
  batchDomain: PharmaceuticalD1BatchDomainV1;
  targets: readonly PharmaceuticalTargetAdjudicationContextV2[];
}>;

export type PharmaceuticalD1StructuralNoStudentCandidatesShellV2 = Readonly<{
  targetRef: PharmaceuticalEvaluationTargetId;
  resolution: 'STRUCTURAL_NO_STUDENT_CANDIDATES';
}>;

export type PharmaceuticalD1BatchPlanV1 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-d1-batch-plan/1';
  contextFingerprint: PharmaceuticalAdjudicationContextFingerprintV1;
  targetOrder: readonly PharmaceuticalEvaluationTargetId[];
  semanticBatches: readonly PharmaceuticalD1SemanticBatchV1[];
  structuralShells: readonly PharmaceuticalD1StructuralNoStudentCandidatesShellV2[];
}>;
