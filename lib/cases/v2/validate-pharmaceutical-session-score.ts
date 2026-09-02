import { type PharmaceuticalScoreSourceV2, canonicalPharmaceuticalReviewFlags, validatePharmaceuticalScoreInputV2 } from './build-pharmaceutical-score-input';
import { validatePharmaceuticalScoringConfigurationV2 } from './build-pharmaceutical-scoring-policy';
import {
  checkScoringFingerprint, freezeScoring, parseScoring, scoringEqual, scoringFail,
  scoringFraction, scoringOrdinal, scoringUnique,
} from './pharmaceutical-scoring-contract-utils';
import { pharmaceuticalSessionScoreSchema, pharmaceuticalScoreReceiptSchema, type PharmaceuticalSessionScoreV2 } from './pharmaceutical-scoring-types';

const RESULT_CANONICALIZATION = 'pharmaceutical-session-score-v2/1';
function bounds(earned: { numerator: string; denominator: string }, possible: { numerator: string; denominator: string }) {
  if (BigInt(earned.numerator) * BigInt(possible.denominator) > BigInt(possible.numerator) * BigInt(earned.denominator)) {
    scoringFail('INVALID_NUMERIC_STATE', 'result.bounds');
  }
}

/** Shape/pinning validator only. It neither computes nor certifies score arithmetic. */
export function validatePharmaceuticalSessionScoreV2(
  value: unknown, inputValue: unknown, configuration: unknown, source: PharmaceuticalScoreSourceV2,
): PharmaceuticalSessionScoreV2 {
  const input = validatePharmaceuticalScoreInputV2(inputValue, configuration, source);
  const config = validatePharmaceuticalScoringConfigurationV2(configuration, source.contextSource);
  const parsed = parseScoring(pharmaceuticalSessionScoreSchema, value, 'score', 'INVALID_NUMERIC_STATE');
  const result = parsed.result;
  scoringEqual(result.sourceBindings, input.bindings, 'result.sources');
  result.reviewFlags = canonicalPharmaceuticalReviewFlags(result.reviewFlags);
  scoringEqual(result.reviewFlags, input.reviewFlags, 'result.reviewFlags', 'UNVALIDATED_SOURCE');
  scoringUnique(result.unitContributions.map((unit) => unit.scoringUnitId), 'result.units', 'INVALID_TARGET_COVERAGE');
  scoringUnique(result.domainBreakdown.map((domain) => domain.domain), 'result.domains', 'INVALID_TARGET_COVERAGE');
  result.unitContributions.sort((a, b) => scoringOrdinal(a.scoringUnitId, b.scoringUnitId));
  result.domainBreakdown.sort((a, b) => scoringOrdinal(a.domain, b.domain));
  if (result.status === 'INVALID') {
    if (result.unitContributions.length || result.domainBreakdown.length) scoringFail('INVALID_NUMERIC_STATE', 'result.invalid');
  } else {
    scoringEqual(result.unitContributions.map((unit) => unit.scoringUnitId), config.plan.units.map((unit) => unit.scoringUnitId), 'result.units', 'INVALID_TARGET_COVERAGE');
    const outcomes = new Map(input.d1Outcomes.map((item) => [item.targetRef, item]));
    for (const [index, unit] of result.unitContributions.entries()) {
      const planUnit = config.plan.units[index];
      unit.memberOutcomes.sort((a, b) => scoringOrdinal(a.targetRef, b.targetRef));
      scoringEqual(unit.memberOutcomes, planUnit.memberTargetRefs.map((ref) => outcomes.get(ref)), 'result.memberOutcomes', 'INVALID_TARGET_COVERAGE');
      scoringEqual([unit.domain, unit.applicability, unit.operator], [planUnit.domain, planUnit.applicability, planUnit.operator], 'result.unitPlan');
      unit.earned = scoringFraction(unit.earned); unit.possible = scoringFraction(unit.possible);
      bounds(unit.earned, unit.possible);
      // Reject unearned credit, but do not assign credit or calculate any note.
      if (BigInt(unit.earned.numerator) > 0n) {
        const correct = unit.memberOutcomes.map((item) => item.resolution === 'SEMANTIC' && item.verdict === 'CORRECTLY_DEMONSTRATED');
        if (!(unit.operator === 'ONE_OF' ? correct.some(Boolean) : correct.every(Boolean))) scoringFail('INVALID_NUMERIC_STATE', 'result.creditSource');
      }
    }
    const domains = [...new Set(config.plan.units.map((unit) => unit.domain))].sort();
    scoringEqual(result.domainBreakdown.map((domain) => domain.domain), domains, 'result.domains', 'INVALID_TARGET_COVERAGE');
    for (const domain of result.domainBreakdown) {
      domain.scoringUnitRefs.sort();
      scoringEqual(domain.scoringUnitRefs, config.plan.units.filter((unit) => unit.domain === domain.domain).map((unit) => unit.scoringUnitId), 'result.domainUnits', 'INVALID_TARGET_COVERAGE');
      domain.earned = scoringFraction(domain.earned); domain.possible = scoringFraction(domain.possible);
      bounds(domain.earned, domain.possible);
    }
    result.earned = scoringFraction(result.earned); result.possible = scoringFraction(result.possible);
    bounds(result.earned, result.possible);
    const hasPossible = result.unitContributions.some((unit) => BigInt(unit.possible.numerator) > 0n);
    if (result.status === 'NOT_SCORABLE') {
      if (hasPossible || BigInt(result.possible.numerator) !== 0n || BigInt(result.earned.numerator) !== 0n) scoringFail('INVALID_NUMERIC_STATE', 'result.notScorable');
    } else {
      if (!hasPossible || BigInt(result.possible.numerator) === 0n) scoringFail('INVALID_NUMERIC_STATE', 'result.denominator');
      if ((result.status === 'SCORED') !== (result.reviewFlags.length === 0)) scoringFail('INVALID_NUMERIC_STATE', 'result.reviewStatus');
    }
  }
  checkScoringFingerprint(parsed, result, RESULT_CANONICALIZATION, 'result.fingerprint');
  const receipt = parseScoring(pharmaceuticalScoreReceiptSchema, parsed.receipt, 'receipt');
  scoringEqual(receipt, {
    schemaVersion: '2.0', contractVersion: 'pharmaceutical-score-receipt/1', validationScope: 'STRUCTURAL_ONLY',
    rulesVersion: config.policy.rulesVersion, sources: input.bindings,
    inputFingerprint: input.fingerprint, resultFingerprint: parsed.fingerprint,
  }, 'receipt');
  return freezeScoring({ result, fingerprint: parsed.fingerprint, receipt });
}
