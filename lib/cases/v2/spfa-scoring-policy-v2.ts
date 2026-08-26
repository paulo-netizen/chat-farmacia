import type { SpfaScoringPolicyV2 } from './spfa-scoring-policy-types';
import { validateSpfaScoringPolicyV2 } from './validate-spfa-scoring-policy';

const validatedPolicy = validateSpfaScoringPolicyV2({
  schemaVersion: '2.0',
  policyRef: {
    id: 'spfa-scoring-standard',
    version: '2026.1',
  },
  pointsByImportance: {
    CRITICAL: 3,
    RELEVANT: 2,
    OPTIONAL: 1,
  },
  partialCreditRule: 'TARGET_RATIO',
  uncertainRule: 'NO_CREDIT_REVIEW',
  criticalityRule: {
    alertOnOmission: true,
    alertOnPartial: true,
    alertOnUncertain: true,
    scoreCap: null,
  },
  notApplicableRule: 'EXCLUDE_FROM_DENOMINATOR',
  noApplicableRequirementsRule: 'NOT_SCORABLE',
  passFailRule: 'NONE',
  rounding: {
    decimals: 1,
    mode: 'HALF_UP',
    applyAt: 'FINAL_SCORE_ONLY',
  },
});

export const SPFA_SCORING_POLICY_V2_2026_1: SpfaScoringPolicyV2 = Object.freeze({
  ...validatedPolicy,
  policyRef: Object.freeze({ ...validatedPolicy.policyRef }),
  pointsByImportance: Object.freeze({ ...validatedPolicy.pointsByImportance }),
  criticalityRule: Object.freeze({ ...validatedPolicy.criticalityRule }),
  rounding: Object.freeze({ ...validatedPolicy.rounding }),
});
