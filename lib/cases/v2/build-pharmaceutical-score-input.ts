import { z } from 'zod';
import { type PharmaceuticalScoringPlanSourceV2, pharmaceuticalScoringExpectationBinding, reconstructPharmaceuticalScoringContext } from './build-pharmaceutical-scoring-plan';
import { pharmaceuticalScoringConfigBinding, validatePharmaceuticalScoringConfigurationV2 } from './build-pharmaceutical-scoring-policy';
import { validatePharmaceuticalAdjudicationContextSetV2 } from './validate-pharmaceutical-adjudication-context';
import { validatePharmaceuticalTargetSemanticAdjudicationSetV2 } from './validate-pharmaceutical-d1-adjudication';
import { validatePharmaceuticalClinicalClaimFindingSetV2 } from './build-pharmaceutical-d2-claim-findings';
import { validatePharmaceuticalD2RelationalSemanticRequestV2, validatePharmaceuticalD2SemanticRequestV2 } from './build-pharmaceutical-d2-semantic-request';
import type { PharmaceuticalD1AcceptedSemanticBatchV2 } from './pharmaceutical-d1-adjudication-types';
import type { PharmaceuticalD2SemanticRequestV2 } from './pharmaceutical-d2-claim-types';
import {
  checkScoringFingerprint, freezeScoring, parseScoring, scoringCanonicalJson, scoringEqual,
  scoringFail, scoringOrdinal, sealScoring,
} from './pharmaceutical-scoring-contract-utils';
import {
  pharmaceuticalD2ScoreSourceSchema, pharmaceuticalScoreInputSchema, pharmaceuticalScoreInputCoreSchema,
  pharmaceuticalSemanticAcceptanceSchema,
  type PharmaceuticalReviewFlagV2, type PharmaceuticalScoreInputV2,
} from './pharmaceutical-scoring-types';

const CANONICALIZATION = 'pharmaceutical-score-input-v2/1';
type Acceptance = z.infer<typeof pharmaceuticalSemanticAcceptanceSchema>;
/** Server-owned validation witnesses. Never serialized into the scoring input or receipt. */
export type PharmaceuticalScoreSourceV2 = Readonly<{
  contextSource: PharmaceuticalScoringPlanSourceV2;
  context: unknown;
  d1: Readonly<{ set: unknown; acceptedBatches: readonly PharmaceuticalD1AcceptedSemanticBatchV2[]; semanticAcceptance: Acceptance }>;
  d2: Readonly<{ status: 'NOT_PROVIDED'; reason: 'NOT_REQUESTED' }> | Readonly<{
    status: 'PROVIDED'; set: unknown; request: PharmaceuticalD2SemanticRequestV2;
    providerResult: unknown; semanticAcceptance: Acceptance;
  }>;
}>;

function sourceCall<T>(call: () => T, path: string): T {
  try { return call(); } catch { return scoringFail('UNVALIDATED_SOURCE', path); }
}
export function canonicalPharmaceuticalReviewFlags(flags: readonly PharmaceuticalReviewFlagV2[]) {
  return [...flags].sort((a, b) => scoringOrdinal(scoringCanonicalJson(a), scoringCanonicalJson(b)));
}
export function buildPharmaceuticalScoreInputV2(
  configuration: unknown, source: PharmaceuticalScoreSourceV2,
): PharmaceuticalScoreInputV2 {
  if (!source || !source.contextSource || !source.context) scoringFail('INCOMPLETE_UPSTREAM', 'source.context');
  const context = reconstructPharmaceuticalScoringContext(source.contextSource);
  sourceCall(() => validatePharmaceuticalAdjudicationContextSetV2(source.context, source.contextSource), 'source.context');
  const config = validatePharmaceuticalScoringConfigurationV2(configuration, source.contextSource);
  if (!source.d1?.set || !Array.isArray(source.d1.acceptedBatches)) scoringFail('INCOMPLETE_UPSTREAM', 'source.d1');
  const d1Status = parseScoring(pharmaceuticalSemanticAcceptanceSchema, source.d1.semanticAcceptance, 'source.d1.semanticAcceptance');
  for (const batch of source.d1.acceptedBatches) {
    if (!['pharmaceutical-d1-adjudication-prompt/1', 'pharmaceutical-d1-adjudication-prompt/2',
      'pharmaceutical-d1-adjudication-prompt/3'].includes(batch?.execution?.promptVersion)) {
      scoringFail('UNSUPPORTED_VERSION', 'source.d1.promptVersion');
    }
  }
  const d1 = sourceCall(() => validatePharmaceuticalTargetSemanticAdjudicationSetV2(
    source.d1.set, context, source.d1.acceptedBatches,
  ), 'source.d1');
  const d1Outcomes = d1.adjudications.map((item) => item.resolution === 'STRUCTURAL_NO_STUDENT_CANDIDATES'
    ? { targetRef: item.targetRef, resolution: item.resolution }
    : { targetRef: item.targetRef, resolution: item.resolution, verdict: item.verdict, semanticExecutionRef: item.semanticExecutionRef })
    .sort((a, b) => scoringOrdinal(a.targetRef, b.targetRef));
  const reviewFlags: PharmaceuticalReviewFlagV2[] = [];
  for (const item of d1Outcomes) {
    if (item.verdict === 'UNCERTAIN') reviewFlags.push({ code: 'UNCERTAIN_D1', targetRef: item.targetRef });
    if (item.verdict === 'INCORRECT_OR_CONTRADICTED' && config.policy.reviewPreferences.reviewIncorrectD1) {
      reviewFlags.push({ code: 'INCORRECT_D1', targetRef: item.targetRef });
    }
  }
  if (d1Status === 'VALIDATION_DEBT') reviewFlags.push({ code: 'UPSTREAM_VALIDATION_DEBT', lane: 'D1' });
  let d2Binding: z.infer<typeof pharmaceuticalD2ScoreSourceSchema>;
  const statuses = [d1Status];
  if (!source.d2) scoringFail('INCOMPLETE_UPSTREAM', 'source.d2');
  if (source.d2.status === 'NOT_PROVIDED') {
    d2Binding = parseScoring(pharmaceuticalD2ScoreSourceSchema, source.d2, 'source.d2');
  } else if (source.d2.status === 'PROVIDED') {
    const d2 = source.d2;
    if (!d2.set || !d2.request || !d2.providerResult) scoringFail('INCOMPLETE_UPSTREAM', 'source.d2');
    if (d2.request.policyVersion !== 'pharmaceutical-d2-claim-policy/1' ||
        !['pharmaceutical-d2-semantic-request/1', 'pharmaceutical-d2-semantic-request/2'].includes(d2.request.contractVersion) ||
        !['pharmaceutical-d2-claim-prompt/1', 'pharmaceutical-d2-claim-prompt/2', 'pharmaceutical-d2-claim-prompt/3',
          'pharmaceutical-d2-claim-prompt/4', 'pharmaceutical-d2-claim-prompt/5'].includes(d2.request.promptVersion)) {
      scoringFail('UNSUPPORTED_VERSION', 'source.d2.versions');
    }
    const status = parseScoring(pharmaceuticalSemanticAcceptanceSchema, d2.semanticAcceptance, 'source.d2.semanticAcceptance');
    const request = sourceCall(() => {
      if (d2.request.contractVersion === 'pharmaceutical-d2-semantic-request/2') {
        return validatePharmaceuticalD2RelationalSemanticRequestV2(d2.request, context, d2.request.promptVersion);
      }
      if (d2.request.contractVersion === 'pharmaceutical-d2-semantic-request/1') {
        return validatePharmaceuticalD2SemanticRequestV2(d2.request, context, d2.request.promptVersion, d2.request.policyVersion);
      }
      return scoringFail('UNSUPPORTED_VERSION', 'source.d2.request');
    }, 'source.d2.request');
    const findings = sourceCall(() => validatePharmaceuticalClinicalClaimFindingSetV2(d2.set, request, d2.providerResult), 'source.d2.set');
    const provider = sourceCall(() => parseScoring(z.object({ contractVersion: z.enum([
      'pharmaceutical-d2-provider-result/1', 'pharmaceutical-d2-provider-result/2',
    ]) }).passthrough(), d2.providerResult, 'source.d2.provider'), 'source.d2.provider');
    for (const item of findings.findings) reviewFlags.push({
      code: item.findingType === 'CONTRADICTORY' ? 'CONTRADICTORY_D2' : 'UNSUPPORTED_D2', claimId: item.claimId,
    });
    if (status === 'VALIDATION_DEBT') reviewFlags.push({ code: 'UPSTREAM_VALIDATION_DEBT', lane: 'D2' });
    statuses.push(status);
    d2Binding = {
      status: 'PROVIDED', findingSet: { contractVersion: findings.contractVersion, fingerprint: findings.fingerprint },
      request: { contractVersion: request.contractVersion, fingerprint: request.requestFingerprint },
      policyVersion: request.policyVersion, promptVersion: request.promptVersion,
      providerContractVersion: provider.contractVersion, numericEffect: 'NONE', semanticAcceptance: status,
    };
  } else return scoringFail('INCOMPLETE_UPSTREAM', 'source.d2.status');
  const acceptance = statuses.includes('VALIDATION_DEBT') ? 'VALIDATION_DEBT'
    : statuses.every((status) => status === 'LIVE_ACCEPTED') ? 'LIVE_ACCEPTED' : 'VALIDATED_OFFLINE';
  const core = parseScoring(pharmaceuticalScoreInputCoreSchema, {
    schemaVersion: '2.0', contractVersion: 'pharmaceutical-score-input/1',
    bindings: {
      sessionId: context.sessionId, caseVersionId: context.caseVersionId,
      policy: pharmaceuticalScoringConfigBinding(config.policy), plan: pharmaceuticalScoringConfigBinding(config.plan),
      weights: pharmaceuticalScoringConfigBinding(config.weights), thresholds: pharmaceuticalScoringConfigBinding(config.thresholds),
      rounding: pharmaceuticalScoringConfigBinding(config.rounding),
      targetSet: { contractVersion: source.contextSource.targetSet.contractVersion, fingerprint: context.targetSetFingerprint },
      expectationSet: pharmaceuticalScoringExpectationBinding(source.contextSource),
      adjudicationContext: { contractVersion: context.contractVersion, fingerprint: context.fingerprint },
      d1Set: { contractVersion: d1.contractVersion, fingerprint: d1.fingerprint }, d2: d2Binding,
      transcript: { schemaVersion: '2.0', fingerprint: context.transcriptFingerprint },
      d1SemanticAcceptance: d1Status, upstreamSemanticAcceptanceStatus: acceptance,
    }, d1Outcomes, reviewFlags: canonicalPharmaceuticalReviewFlags(reviewFlags),
  }, 'scoreInput');
  return freezeScoring(sealScoring(core, CANONICALIZATION));
}
export function validatePharmaceuticalScoreInputV2(
  value: unknown, configuration: unknown, source: PharmaceuticalScoreSourceV2,
): PharmaceuticalScoreInputV2 {
  const parsed = parseScoring(pharmaceuticalScoreInputSchema, value, 'scoreInput');
  const { fingerprint: _fingerprint, ...body } = parsed;
  const core = { ...body, d1Outcomes: [...body.d1Outcomes].sort((a, b) => scoringOrdinal(a.targetRef, b.targetRef)),
    reviewFlags: canonicalPharmaceuticalReviewFlags(body.reviewFlags) };
  checkScoringFingerprint(parsed, core, CANONICALIZATION, 'scoreInput.fingerprint');
  const expected = buildPharmaceuticalScoreInputV2(configuration, source);
  scoringEqual(core.bindings, expected.bindings, 'scoreInput.bindings');
  scoringEqual(core.d1Outcomes, expected.d1Outcomes, 'scoreInput.d1Outcomes', 'INVALID_TARGET_COVERAGE');
  scoringEqual(core.reviewFlags, expected.reviewFlags, 'scoreInput.reviewFlags', 'UNVALIDATED_SOURCE');
  return expected;
}
