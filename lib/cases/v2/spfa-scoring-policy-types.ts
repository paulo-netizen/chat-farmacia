import type { VersionRef } from './evaluator-types';

export type SpfaPartialCreditRuleV2 = 'TARGET_RATIO';
export type SpfaUncertainScoringRuleV2 = 'NO_CREDIT_REVIEW';
export type SpfaNotApplicableScoringRuleV2 = 'EXCLUDE_FROM_DENOMINATOR';
export type SpfaNoApplicableRequirementsRuleV2 = 'NOT_SCORABLE';
export type SpfaPassFailRuleV2 = 'NONE';
export type SpfaScoreRoundingModeV2 = 'HALF_UP';

export type SpfaScoringPolicyV2 = Readonly<{
  schemaVersion: '2.0';
  policyRef: Readonly<VersionRef>;
  pointsByImportance: Readonly<{
    CRITICAL: number;
    RELEVANT: number;
    OPTIONAL: number;
  }>;
  partialCreditRule: SpfaPartialCreditRuleV2;
  uncertainRule: SpfaUncertainScoringRuleV2;
  criticalityRule: Readonly<{
    alertOnOmission: boolean;
    alertOnPartial: boolean;
    alertOnUncertain: boolean;
    scoreCap: number | null;
  }>;
  notApplicableRule: SpfaNotApplicableScoringRuleV2;
  noApplicableRequirementsRule: SpfaNoApplicableRequirementsRuleV2;
  passFailRule: SpfaPassFailRuleV2;
  rounding: Readonly<{
    decimals: number;
    mode: SpfaScoreRoundingModeV2;
    applyAt: 'FINAL_SCORE_ONLY';
  }>;
}>;
