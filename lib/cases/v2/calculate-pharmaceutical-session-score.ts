import { validatePharmaceuticalScoreInputV2, type PharmaceuticalScoreSourceV2 } from './build-pharmaceutical-score-input';
import { validatePharmaceuticalScoringConfigurationV2 } from './build-pharmaceutical-scoring-policy';
import { scoringFail, scoringFingerprint, scoringFraction, scoringOrdinal } from './pharmaceutical-scoring-contract-utils';
import type { PharmaceuticalScoringRoundingV2, PharmaceuticalSessionScoreV2 } from './pharmaceutical-scoring-types';
import { validatePharmaceuticalSessionScoreV2 } from './validate-pharmaceutical-session-score';

/** Round the exact ratio once; Number is used only for the final E1 numeric field. */
function normalizedScore(earned: bigint, possible: bigint, rounding: PharmaceuticalScoringRoundingV2): number {
  const config = rounding.configuration;
  if (config.status !== 'CONFIGURED') scoringFail('PEDAGOGICAL_CONFIGURATION_REQUIRED', 'rounding.configuration');
  const factor = 10n ** BigInt(config.scale);
  const numerator = 100n * earned * factor;
  let units = numerator / possible;
  const remainder = numerator % possible;
  if (config.roundingMode === 'HALF_UP' && 2n * remainder >= possible) units += 1n;
  if (config.roundingMode === 'HALF_EVEN' &&
      (2n * remainder > possible || (2n * remainder === possible && units % 2n === 1n))) units += 1n;
  // DOWN keeps the quotient. Serialize the rounded decimal, not a floating ratio.
  return Number(`${units / factor}.${String(units % factor).padStart(config.scale, '0')}`);
}

/**
 * Generic, configuration-gated arithmetic. Witnesses are server-owned E1 sources,
 * never client approval claims. No semantic decisions or pedagogical defaults.
 * Invalid configuration/source/input throws before any score is calculated.
 */
export function calculatePharmaceuticalSessionScoreV2(
  inputValue: unknown, configuration: unknown, source: PharmaceuticalScoreSourceV2,
): PharmaceuticalSessionScoreV2 {
  const input = validatePharmaceuticalScoreInputV2(inputValue, configuration, source);
  const config = validatePharmaceuticalScoringConfigurationV2(configuration, source.contextSource);
  const denominator = 10n ** BigInt(config.weights.scale);
  const fraction = (units: bigint) => scoringFraction({ numerator: String(units), denominator: String(denominator) });
  const outcomes = new Map(input.d1Outcomes.map((item) => [item.targetRef, item]));
  const weights = new Map(config.weights.entries.map((item) => [item.scoringUnitId, BigInt(item.units)]));
  type Domain = typeof config.plan.units[number]['domain'];
  const domains = new Map<Domain, { domain: Domain; scoringUnitRefs: string[]; earned: bigint; possible: bigint }>();
  let earned = 0n, possible = 0n;
  const unitContributions = config.plan.units.map((unit) => {
    const memberOutcomes = unit.memberTargetRefs.map((ref) => {
      const outcome = outcomes.get(ref);
      if (!outcome) scoringFail('INVALID_TARGET_COVERAGE', 'scorer.memberOutcomes');
      return outcome;
    });
    const weight = weights.get(unit.scoringUnitId);
    if (weight === undefined) scoringFail('INVALID_WEIGHT_CONFIGURATION', 'scorer.weight');
    const correct = memberOutcomes.map((item) => item.resolution === 'SEMANTIC' && item.verdict === 'CORRECTLY_DEMONSTRATED');
    const credit = unit.operator === 'ONE_OF' ? correct.some(Boolean) : correct.every(Boolean);
    const unitPossible = unit.applicability === 'APPLICABLE' ? weight : 0n;
    const unitEarned = credit ? unitPossible : 0n;
    earned += unitEarned; possible += unitPossible;
    const domain = domains.get(unit.domain) ?? { domain: unit.domain, scoringUnitRefs: [], earned: 0n, possible: 0n };
    domain.scoringUnitRefs.push(unit.scoringUnitId);
    domain.earned += unitEarned; domain.possible += unitPossible;
    domains.set(unit.domain, domain);
    return { scoringUnitId: unit.scoringUnitId, domain: unit.domain, operator: unit.operator,
      applicability: unit.applicability, memberOutcomes, earned: fraction(unitEarned), possible: fraction(unitPossible) };
  });
  const common = {
    schemaVersion: '2.0' as const, contractVersion: 'pharmaceutical-session-score/1' as const,
    validationScope: 'STRUCTURAL_ONLY' as const, sourceBindings: input.bindings,
    unitContributions, reviewFlags: input.reviewFlags,
    domainBreakdown: [...domains.values()].sort((a, b) => scoringOrdinal(a.domain, b.domain)).map((domain) => ({
      domain: domain.domain, scoringUnitRefs: domain.scoringUnitRefs,
      earned: fraction(domain.earned), possible: fraction(domain.possible),
    })), earned: fraction(earned), possible: fraction(possible),
  };
  const result = possible === 0n
    ? { ...common, status: 'NOT_SCORABLE' as const, normalizedScore: null }
    : { ...common, status: input.reviewFlags.length ? 'PROVISIONAL_REVIEW_REQUIRED' as const : 'SCORED' as const,
      normalizedScore: normalizedScore(earned, possible, config.rounding) };
  const fingerprint = scoringFingerprint('pharmaceutical-session-score-v2/1', result);
  const receipt = {
    schemaVersion: '2.0' as const, contractVersion: 'pharmaceutical-score-receipt/1' as const,
    validationScope: 'STRUCTURAL_ONLY' as const, rulesVersion: config.policy.rulesVersion,
    sources: input.bindings, inputFingerprint: input.fingerprint, resultFingerprint: fingerprint,
  };
  // E1 checks shape/pinning only; the arithmetic above remains the scorer's job.
  return validatePharmaceuticalSessionScoreV2({ result, fingerprint, receipt }, input, config, source);
}
