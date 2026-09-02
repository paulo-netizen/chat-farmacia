import { z } from 'zod';
import {
  PHARMACEUTICAL_SCORING_ERROR_CODES, scoringApprovalSchema, scoringFingerprintSchema,
  scoringFractionSchema, scoringGroupIdSchema, scoringIdentitySchema, scoringIntegerStringSchema,
  scoringRefSchema, scoringTargetIdSchema, scoringUnitIdSchema, type DeepScoringReadonly,
} from './pharmaceutical-scoring-contract-utils';

// One strict runtime/type definition per contract. No numeric scoring defaults.
const header = { schemaVersion: z.literal('2.0'), ref: scoringRefSchema };
export const pharmaceuticalScoringPolicyCoreSchema = z.object({
  ...header, contractVersion: z.literal('pharmaceutical-scoring-policy/1'),
  rulesVersion: z.literal('pharmaceutical-scoring-rules/1'),
  automaticSource: z.literal('VALIDATED_D1_ONLY'),
  d1Mapping: z.object({
    CORRECTLY_DEMONSTRATED: z.literal('CREDIT'),
    INCORRECT_OR_CONTRADICTED: z.literal('NO_CREDIT'),
    UNCERTAIN: z.literal('NO_CONFIRMED_CREDIT_REVIEW_REQUIRED'),
    NOT_DEMONSTRATED: z.literal('NO_CREDIT'),
    STRUCTURAL_NO_STUDENT_CANDIDATES: z.literal('NO_CREDIT_STRUCTURAL'),
  }).strict(),
  d2Mapping: z.object({ CONTRADICTORY: z.literal('REVIEW_ONLY'), UNSUPPORTED: z.literal('REVIEW_ONLY') }).strict(),
  claimFormEffect: z.literal('NO_NUMERIC_EFFECT'),
  negativeScoring: z.literal('FORBIDDEN'),
  allOf: z.literal('ALL_MEMBERS_REQUIRED_FOR_UNIT_CREDIT'),
  oneOf: z.literal('ANY_CORRECT_MEMBER_YIELDS_SINGLE_UNIT_CREDIT'),
  uncertain: z.literal('KEEP_DENOMINATOR_REVIEW_REQUIRED'),
  noApplicable: z.literal('NOT_SCORABLE'), passFail: z.literal('NONE'), hardFail: z.literal('NONE'),
  weightsRef: scoringRefSchema, thresholdsRef: scoringRefSchema, roundingRef: scoringRefSchema,
  reviewPreferences: z.object({ reviewIncorrectD1: z.boolean() }).strict(),
}).strict();
export const pharmaceuticalScoringPolicySchema = pharmaceuticalScoringPolicyCoreSchema.extend({ fingerprint: scoringFingerprintSchema });

export const pharmaceuticalScoringThresholdsCoreSchema = z.object({
  ...header, contractVersion: z.literal('pharmaceutical-scoring-thresholds/1'),
  approval: scoringApprovalSchema,
  // Defined thresholds are representable, but inactive under rules/1 (passFail NONE).
  configuration: z.discriminatedUnion('status', [
    z.object({ status: z.literal('NO_THRESHOLDS') }).strict(),
    z.object({ status: z.literal('DEFINED'), thresholds: z.array(z.object({
      thresholdId: scoringIdentitySchema, minimumScore: z.number().finite().min(0).max(100),
    }).strict()).min(1) }).strict(),
    z.object({ status: z.literal('UNCONFIGURED'), reason: z.literal('DECISION_REQUIRED') }).strict(),
  ]),
}).strict();
export const pharmaceuticalScoringThresholdsSchema = pharmaceuticalScoringThresholdsCoreSchema.extend({ fingerprint: scoringFingerprintSchema });
export const pharmaceuticalScoringRoundingCoreSchema = z.object({
  ...header, contractVersion: z.literal('pharmaceutical-scoring-rounding/1'), approval: scoringApprovalSchema,
  configuration: z.discriminatedUnion('status', [
    z.object({ status: z.literal('CONFIGURED'), scale: z.number().int().min(0).max(18),
      roundingMode: z.enum(['HALF_UP', 'HALF_EVEN', 'DOWN']), applyAt: z.literal('FINAL_SCORE_ONLY') }).strict(),
    z.object({ status: z.literal('UNCONFIGURED'), reason: z.literal('DECISION_REQUIRED') }).strict(),
  ]),
}).strict();
export const pharmaceuticalScoringRoundingSchema = pharmaceuticalScoringRoundingCoreSchema.extend({ fingerprint: scoringFingerprintSchema });

export const scoringArtifactBindingSchema = z.object({ contractVersion: scoringIdentitySchema, fingerprint: scoringFingerprintSchema }).strict();
export const scoringConfigBindingSchema = scoringArtifactBindingSchema.extend({ ref: scoringRefSchema });
export const pharmaceuticalScoringDomainSchema = z.enum([
  'PRM', 'RNM', 'PRM_RNM_RELATION', 'ADHERENCE', 'BARRIER', 'STRATEGY',
  'PROFESSIONAL_ACTION', 'PHARMACEUTICAL_INTERVENTION', 'REFERRAL', 'REPORT',
]);
export const pharmaceuticalScoringUnitDraftSchema = z.object({
  domain: pharmaceuticalScoringDomainSchema,
  operator: z.enum(['SINGLE', 'ALL_OF', 'ONE_OF']),
  memberTargetRefs: z.array(scoringTargetIdSchema).min(1),
  applicability: z.enum(['APPLICABLE', 'NOT_APPLICABLE']),
  sourceExpectationGroupRefs: z.array(scoringGroupIdSchema),
}).strict();
export const pharmaceuticalScoringUnitSchema = pharmaceuticalScoringUnitDraftSchema.extend({
  scoringUnitId: scoringUnitIdSchema,
  weightBinding: z.object({ weightsRef: scoringRefSchema, scoringUnitId: scoringUnitIdSchema }).strict(),
});
export const pharmaceuticalScoringPlanCoreSchema = z.object({
  ...header, contractVersion: z.literal('pharmaceutical-scoring-plan/1'), approval: scoringApprovalSchema,
  caseVersionId: scoringIdentitySchema,
  targetSet: scoringArtifactBindingSchema, expectationSet: scoringArtifactBindingSchema,
  weightsRef: scoringRefSchema, units: z.array(pharmaceuticalScoringUnitSchema),
}).strict();
export const pharmaceuticalScoringPlanSchema = pharmaceuticalScoringPlanCoreSchema.extend({ fingerprint: scoringFingerprintSchema });
export const pharmaceuticalScoringWeightsCoreSchema = z.object({
  ...header, contractVersion: z.literal('pharmaceutical-scoring-weights/1'), approval: scoringApprovalSchema,
  plan: scoringConfigBindingSchema,
  representation: z.literal('SCALED_INTEGER'), scale: z.number().int().min(0).max(18),
  expectedTotal: z.literal('1'),
  entries: z.array(z.object({ scoringUnitId: scoringUnitIdSchema, units: scoringIntegerStringSchema }).strict()),
}).strict();
export const pharmaceuticalScoringWeightsSchema = pharmaceuticalScoringWeightsCoreSchema.extend({ fingerprint: scoringFingerprintSchema });

export const pharmaceuticalSemanticAcceptanceSchema = z.enum(['VALIDATED_OFFLINE', 'LIVE_ACCEPTED', 'VALIDATION_DEBT']);
export const pharmaceuticalD2ScoreSourceSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('NOT_PROVIDED'), reason: z.literal('NOT_REQUESTED') }).strict(),
  z.object({ status: z.literal('PROVIDED'), findingSet: scoringArtifactBindingSchema,
    request: scoringArtifactBindingSchema, policyVersion: scoringIdentitySchema,
    promptVersion: scoringIdentitySchema, providerContractVersion: z.enum(['pharmaceutical-d2-provider-result/1', 'pharmaceutical-d2-provider-result/2']),
    numericEffect: z.literal('NONE'), semanticAcceptance: pharmaceuticalSemanticAcceptanceSchema }).strict(),
]);
export const pharmaceuticalScoreBindingsSchema = z.object({
  sessionId: scoringIdentitySchema, caseVersionId: scoringIdentitySchema,
  policy: scoringConfigBindingSchema, plan: scoringConfigBindingSchema, weights: scoringConfigBindingSchema,
  thresholds: scoringConfigBindingSchema, rounding: scoringConfigBindingSchema,
  targetSet: scoringArtifactBindingSchema, expectationSet: scoringArtifactBindingSchema,
  adjudicationContext: scoringArtifactBindingSchema, d1Set: scoringArtifactBindingSchema,
  d2: pharmaceuticalD2ScoreSourceSchema,
  transcript: z.object({ schemaVersion: z.literal('2.0'), fingerprint: scoringFingerprintSchema }).strict(),
  d1SemanticAcceptance: pharmaceuticalSemanticAcceptanceSchema,
  upstreamSemanticAcceptanceStatus: pharmaceuticalSemanticAcceptanceSchema,
}).strict();
export const pharmaceuticalD1ScoreOutcomeSchema = z.discriminatedUnion('resolution', [
  z.object({ targetRef: scoringTargetIdSchema, resolution: z.literal('STRUCTURAL_NO_STUDENT_CANDIDATES') }).strict(),
  z.object({ targetRef: scoringTargetIdSchema, resolution: z.literal('SEMANTIC'),
    verdict: z.enum(['CORRECTLY_DEMONSTRATED', 'INCORRECT_OR_CONTRADICTED', 'UNCERTAIN', 'NOT_DEMONSTRATED']),
    semanticExecutionRef: scoringIdentitySchema }).strict(),
]);
export const pharmaceuticalReviewFlagSchema = z.discriminatedUnion('code', [
  z.object({ code: z.literal('UNCERTAIN_D1'), targetRef: scoringTargetIdSchema }).strict(),
  z.object({ code: z.literal('INCORRECT_D1'), targetRef: scoringTargetIdSchema }).strict(),
  z.object({ code: z.literal('CONTRADICTORY_D2'), claimId: z.string().regex(/^pharm_claim_[0-9a-f]{64}$/) }).strict(),
  z.object({ code: z.literal('UNSUPPORTED_D2'), claimId: z.string().regex(/^pharm_claim_[0-9a-f]{64}$/) }).strict(),
  z.object({ code: z.literal('UPSTREAM_VALIDATION_DEBT'), lane: z.enum(['D1', 'D2']) }).strict(),
]);
export const pharmaceuticalScoreInputCoreSchema = z.object({
  schemaVersion: z.literal('2.0'), contractVersion: z.literal('pharmaceutical-score-input/1'),
  bindings: pharmaceuticalScoreBindingsSchema,
  d1Outcomes: z.array(pharmaceuticalD1ScoreOutcomeSchema), reviewFlags: z.array(pharmaceuticalReviewFlagSchema),
}).strict();
export const pharmaceuticalScoreInputSchema = pharmaceuticalScoreInputCoreSchema.extend({ fingerprint: scoringFingerprintSchema });

export const pharmaceuticalUnitContributionSchema = z.object({
  scoringUnitId: scoringUnitIdSchema, domain: pharmaceuticalScoringDomainSchema,
  applicability: z.enum(['APPLICABLE', 'NOT_APPLICABLE']), operator: z.enum(['SINGLE', 'ALL_OF', 'ONE_OF']),
  memberOutcomes: z.array(pharmaceuticalD1ScoreOutcomeSchema).min(1),
  earned: scoringFractionSchema, possible: scoringFractionSchema,
}).strict();
export const pharmaceuticalDomainBreakdownSchema = z.object({
  domain: pharmaceuticalScoringDomainSchema, scoringUnitRefs: z.array(scoringUnitIdSchema).min(1),
  earned: scoringFractionSchema, possible: scoringFractionSchema,
}).strict();
export const pharmaceuticalScoreReceiptSchema = z.object({
  schemaVersion: z.literal('2.0'), contractVersion: z.literal('pharmaceutical-score-receipt/1'),
  validationScope: z.literal('STRUCTURAL_ONLY'), rulesVersion: z.literal('pharmaceutical-scoring-rules/1'),
  sources: pharmaceuticalScoreBindingsSchema,
  inputFingerprint: scoringFingerprintSchema, resultFingerprint: scoringFingerprintSchema,
}).strict();
const resultCommon = {
  schemaVersion: z.literal('2.0'), contractVersion: z.literal('pharmaceutical-session-score/1'),
  validationScope: z.literal('STRUCTURAL_ONLY'), sourceBindings: pharmaceuticalScoreBindingsSchema,
  unitContributions: z.array(pharmaceuticalUnitContributionSchema), domainBreakdown: z.array(pharmaceuticalDomainBreakdownSchema),
  reviewFlags: z.array(pharmaceuticalReviewFlagSchema),
};
const measured = { earned: scoringFractionSchema, possible: scoringFractionSchema,
  normalizedScore: z.number().finite().min(0).max(100) };
export const pharmaceuticalSessionScoreBodySchema = z.discriminatedUnion('status', [
  z.object({ ...resultCommon, ...measured, status: z.literal('SCORED') }).strict(),
  z.object({ ...resultCommon, ...measured, status: z.literal('PROVISIONAL_REVIEW_REQUIRED') }).strict(),
  z.object({ ...resultCommon, status: z.literal('NOT_SCORABLE'), normalizedScore: z.null(),
    earned: scoringFractionSchema, possible: scoringFractionSchema }).strict(),
  z.object({ ...resultCommon, status: z.literal('INVALID'), normalizedScore: z.null(), earned: z.null(), possible: z.null(),
    errorCode: z.enum(PHARMACEUTICAL_SCORING_ERROR_CODES) }).strict(),
]);
export const pharmaceuticalSessionScoreSchema = z.object({
  result: pharmaceuticalSessionScoreBodySchema,
  fingerprint: scoringFingerprintSchema, receipt: pharmaceuticalScoreReceiptSchema,
}).strict();

export type PharmaceuticalScoringPolicyV2 = DeepScoringReadonly<z.infer<typeof pharmaceuticalScoringPolicySchema>>;
export type PharmaceuticalScoringPlanV2 = DeepScoringReadonly<z.infer<typeof pharmaceuticalScoringPlanSchema>>;
export type PharmaceuticalScoringWeightsV2 = DeepScoringReadonly<z.infer<typeof pharmaceuticalScoringWeightsSchema>>;
export type PharmaceuticalScoringThresholdsV2 = DeepScoringReadonly<z.infer<typeof pharmaceuticalScoringThresholdsSchema>>;
export type PharmaceuticalScoringRoundingV2 = DeepScoringReadonly<z.infer<typeof pharmaceuticalScoringRoundingSchema>>;
export type PharmaceuticalScoreInputV2 = DeepScoringReadonly<z.infer<typeof pharmaceuticalScoreInputSchema>>;
export type PharmaceuticalSessionScoreV2 = DeepScoringReadonly<z.infer<typeof pharmaceuticalSessionScoreSchema>>;
export type PharmaceuticalScoreReceiptV2 = DeepScoringReadonly<z.infer<typeof pharmaceuticalScoreReceiptSchema>>;
export type PharmaceuticalReviewFlagV2 = DeepScoringReadonly<z.infer<typeof pharmaceuticalReviewFlagSchema>>;
