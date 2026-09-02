import { z } from 'zod';
import { validatePharmaceuticalScoringPlanV2, type PharmaceuticalScoringPlanSourceV2 } from './build-pharmaceutical-scoring-plan';
import {
  checkScoringFingerprint, freezeScoring, parseScoring, scoringEqual, scoringFail,
  scoringOrdinal, scoringUnique, sealScoring,
} from './pharmaceutical-scoring-contract-utils';
import {
  pharmaceuticalScoringPolicyCoreSchema, pharmaceuticalScoringPolicySchema,
  pharmaceuticalScoringRoundingCoreSchema, pharmaceuticalScoringRoundingSchema,
  pharmaceuticalScoringThresholdsCoreSchema, pharmaceuticalScoringThresholdsSchema,
  pharmaceuticalScoringWeightsCoreSchema, pharmaceuticalScoringWeightsSchema,
  type PharmaceuticalScoringPolicyV2, type PharmaceuticalScoringRoundingV2,
  type PharmaceuticalScoringThresholdsV2, type PharmaceuticalScoringWeightsV2,
} from './pharmaceutical-scoring-types';

const POLICY = 'pharmaceutical-scoring-policy-v2/1';
const ROUNDING = 'pharmaceutical-scoring-rounding-v2/1';
const THRESHOLDS = 'pharmaceutical-scoring-thresholds-v2/1';
const WEIGHTS = 'pharmaceutical-scoring-weights-v2/1';

export function buildPharmaceuticalScoringPolicyV2(value: unknown): PharmaceuticalScoringPolicyV2 {
  return freezeScoring(sealScoring(parseScoring(pharmaceuticalScoringPolicyCoreSchema, value, 'policy'), POLICY));
}
export function validatePharmaceuticalScoringPolicyV2(value: unknown): PharmaceuticalScoringPolicyV2 {
  const { fingerprint, ...core } = parseScoring(pharmaceuticalScoringPolicySchema, value, 'policy');
  checkScoringFingerprint({ fingerprint }, core, POLICY, 'policy.fingerprint');
  return freezeScoring(sealScoring(core, POLICY));
}
export function buildPharmaceuticalScoringThresholdsV2(value: unknown): PharmaceuticalScoringThresholdsV2 {
  return freezeScoring(sealScoring(thresholdsCore(value), THRESHOLDS));
}
function thresholdsCore(value: unknown) {
  const core = parseScoring(pharmaceuticalScoringThresholdsCoreSchema, value, 'thresholds');
  if (core.configuration.status === 'DEFINED') {
    scoringUnique(core.configuration.thresholds.map((item) => item.thresholdId), 'thresholds.ids', 'INVALID_CONTRACT');
    core.configuration.thresholds.sort((a, b) => scoringOrdinal(a.thresholdId, b.thresholdId));
  }
  return core;
}
export function validatePharmaceuticalScoringThresholdsV2(value: unknown): PharmaceuticalScoringThresholdsV2 {
  const { fingerprint, ...body } = parseScoring(pharmaceuticalScoringThresholdsSchema, value, 'thresholds');
  const core = thresholdsCore(body);
  checkScoringFingerprint({ fingerprint }, core, THRESHOLDS, 'thresholds.fingerprint');
  return freezeScoring(sealScoring(core, THRESHOLDS));
}
export function buildPharmaceuticalScoringRoundingV2(value: unknown): PharmaceuticalScoringRoundingV2 {
  return freezeScoring(sealScoring(parseScoring(pharmaceuticalScoringRoundingCoreSchema, value, 'rounding'), ROUNDING));
}
export function validatePharmaceuticalScoringRoundingV2(value: unknown): PharmaceuticalScoringRoundingV2 {
  const { fingerprint, ...core } = parseScoring(pharmaceuticalScoringRoundingSchema, value, 'rounding');
  checkScoringFingerprint({ fingerprint }, core, ROUNDING, 'rounding.fingerprint');
  return freezeScoring(sealScoring(core, ROUNDING));
}
export function pharmaceuticalScoringConfigBinding(value: {
  contractVersion: string; ref: { readonly id: string; readonly version: string };
  fingerprint: { readonly algorithm: 'sha256'; readonly canonicalization: string; readonly value: string };
}) { return { contractVersion: value.contractVersion, ref: value.ref, fingerprint: value.fingerprint }; }

function weightsCore(value: unknown, planInput: unknown, source: PharmaceuticalScoringPlanSourceV2) {
  const core = parseScoring(pharmaceuticalScoringWeightsCoreSchema, value, 'weights', 'INVALID_WEIGHT_CONFIGURATION');
  const plan = validatePharmaceuticalScoringPlanV2(planInput, source);
  scoringEqual(core.ref, plan.weightsRef, 'weights.ref');
  scoringEqual(core.plan, pharmaceuticalScoringConfigBinding(plan), 'weights.plan');
  scoringUnique(core.entries.map((entry) => entry.scoringUnitId), 'weights.entries', 'INVALID_WEIGHT_CONFIGURATION');
  const expected = plan.units.map((unit) => unit.scoringUnitId).sort();
  const entries = [...core.entries].sort((a, b) => scoringOrdinal(a.scoringUnitId, b.scoringUnitId));
  scoringEqual(entries.map((entry) => entry.scoringUnitId), expected, 'weights.coverage', 'INVALID_WEIGHT_CONFIGURATION');
  // Exact integer arithmetic, also used by M5 rational validation. No epsilon/renormalization.
  const sum = entries.reduce((total, entry) => total + BigInt(entry.units), 0n);
  if (sum !== 10n ** BigInt(core.scale)) scoringFail('INVALID_WEIGHT_CONFIGURATION', 'weights.total');
  return { ...core, entries };
}
export function buildPharmaceuticalScoringWeightsV2(value: unknown, plan: unknown, source: PharmaceuticalScoringPlanSourceV2): PharmaceuticalScoringWeightsV2 {
  return freezeScoring(sealScoring(weightsCore(value, plan, source), WEIGHTS));
}
export function validatePharmaceuticalScoringWeightsV2(value: unknown, plan: unknown, source: PharmaceuticalScoringPlanSourceV2): PharmaceuticalScoringWeightsV2 {
  const parsed = parseScoring(pharmaceuticalScoringWeightsSchema, value, 'weights', 'INVALID_WEIGHT_CONFIGURATION');
  const { fingerprint: _fingerprint, ...body } = parsed;
  const core = weightsCore(body, plan, source);
  checkScoringFingerprint(parsed, core, WEIGHTS, 'weights.fingerprint');
  return freezeScoring(sealScoring(core, WEIGHTS));
}

export const pharmaceuticalScoringConfigurationSchema = z.object({
  policy: z.unknown(), plan: z.unknown(), weights: z.unknown(), thresholds: z.unknown(), rounding: z.unknown(),
}).strict();
export function validatePharmaceuticalScoringConfigurationV2(value: unknown, source: PharmaceuticalScoringPlanSourceV2) {
  const config = parseScoring(pharmaceuticalScoringConfigurationSchema, value, 'configuration', 'PEDAGOGICAL_CONFIGURATION_REQUIRED');
  for (const item of [config.policy, config.plan, config.weights, config.thresholds, config.rounding]) {
    if (item == null) scoringFail('PEDAGOGICAL_CONFIGURATION_REQUIRED', 'configuration.missing');
  }
  const policy = validatePharmaceuticalScoringPolicyV2(config.policy);
  const plan = validatePharmaceuticalScoringPlanV2(config.plan, source);
  const weights = validatePharmaceuticalScoringWeightsV2(config.weights, plan, source);
  const thresholds = validatePharmaceuticalScoringThresholdsV2(config.thresholds);
  const rounding = validatePharmaceuticalScoringRoundingV2(config.rounding);
  scoringEqual(policy.weightsRef, weights.ref, 'policy.weightsRef');
  scoringEqual(policy.thresholdsRef, thresholds.ref, 'policy.thresholdsRef');
  scoringEqual(policy.roundingRef, rounding.ref, 'policy.roundingRef');
  if ([plan, weights, thresholds, rounding].some((item) => item.approval !== 'APPROVED') ||
      rounding.configuration.status !== 'CONFIGURED' || thresholds.configuration.status !== 'NO_THRESHOLDS') {
    scoringFail('PEDAGOGICAL_CONFIGURATION_REQUIRED', 'configuration.approval');
  }
  return freezeScoring({ policy, plan, weights, thresholds, rounding });
}
