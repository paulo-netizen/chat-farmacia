import type { NonEmptyArray } from './evaluator-types';
import type {
  PharmaceuticalEvaluationTargetId,
  PharmaceuticalEvaluationTargetSetFingerprintV1,
} from './pharmaceutical-evaluation-target-types';
import type { CaseVersionId } from './types';

export type PharmaceuticalEvaluationExpectationGroupV2 = Readonly<{
  operator: 'ALL_OF' | 'ONE_OF';
  memberTargetRefs: NonEmptyArray<PharmaceuticalEvaluationTargetId>;
}>;

/** Optional, teacher-authored alternatives. Builders never invent these groups. */
export type PharmaceuticalEvaluationExpectationSetV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-evaluation-expectations/1';
  caseVersionId: CaseVersionId;
  targetSetFingerprint: PharmaceuticalEvaluationTargetSetFingerprintV1;
  groups: readonly PharmaceuticalEvaluationExpectationGroupV2[];
}>;
