import { z } from 'zod';
import { adjudicatePharmaceuticalD1ContextWithWitnessesV2 } from './adjudicate-pharmaceutical-d1-context';
import { adjudicatePharmaceuticalD2ClaimsWithWitnessesV2 } from './adjudicate-pharmaceutical-d2-claims';
import { buildPharmaceuticalScoreInputV2, type PharmaceuticalScoreSourceV2 } from './build-pharmaceutical-score-input';
import type { PharmaceuticalScoringPlanSourceV2 } from './build-pharmaceutical-scoring-plan';
import { validatePharmaceuticalScoringConfigurationV2 } from './build-pharmaceutical-scoring-policy';
import { calculatePharmaceuticalSessionScoreV2 } from './calculate-pharmaceutical-session-score';
import { validatePharmaceuticalAdjudicationContextSetV2 } from './validate-pharmaceutical-adjudication-context';
import { freezeScoring, parseScoring } from './pharmaceutical-scoring-contract-utils';
import { pharmaceuticalSemanticAcceptanceSchema } from './pharmaceutical-scoring-types';
import type { PharmaceuticalD1SemanticRuntimeV2, AllocatePharmaceuticalSemanticExecutionIdV2 } from './pharmaceutical-d1-semantic-runtime';
import type { PharmaceuticalD2SemanticRuntimeV2, AllocatePharmaceuticalD2SemanticExecutionIdV2 } from './pharmaceutical-d2-semantic-runtime';
import type { PharmaceuticalD2ClaimAdjudicationV2 } from './pharmaceutical-d2-semantic-runtime';

type Acceptance = PharmaceuticalScoreSourceV2['d1']['semanticAcceptance'];
export type EvaluatePharmaceuticalSessionInputV2 = Readonly<{
  contextSource: PharmaceuticalScoringPlanSourceV2;
  context: unknown;
  configuration: unknown;
  /** Trusted server-owned disposition, never inferred from successful structural validation. */
  d1SemanticAcceptance: Acceptance;
  d2: Readonly<{ status: 'NOT_PROVIDED'; reason: 'NOT_REQUESTED' }> |
    Readonly<{ status: 'REQUESTED'; semanticAcceptance: Acceptance }>;
}>;
export type EvaluatePharmaceuticalSessionDependenciesV2 = Readonly<{
  d1: PharmaceuticalD1SemanticRuntimeV2;
  allocateD1ExecutionId: AllocatePharmaceuticalSemanticExecutionIdV2;
  d2: PharmaceuticalD2SemanticRuntimeV2;
  allocateD2ExecutionId: AllocatePharmaceuticalD2SemanticExecutionIdV2;
}>;
const d2Selection = z.discriminatedUnion('status', [
  z.object({ status: z.literal('NOT_PROVIDED'), reason: z.literal('NOT_REQUESTED') }).strict(),
  z.object({ status: z.literal('REQUESTED'), semanticAcceptance: pharmaceuticalSemanticAcceptanceSchema }).strict(),
]);

/** Offline composition boundary, not an endpoint or academic publication authorization.
 * No IO, retries, defaults, semantic reinterpretation or scoring arithmetic.
 */
export async function evaluatePharmaceuticalSessionV2(
  input: EvaluatePharmaceuticalSessionInputV2,
  dependencies: EvaluatePharmaceuticalSessionDependenciesV2,
) {
  // Snapshot before the first await; callers and runtimes cannot change validated bindings.
  // Private clone retains upstream mutable-array types; it is never passed to runtimes.
  const snapshot = structuredClone(input);
  const d1Runtime = { adjudicateBatch: dependencies.d1.adjudicateBatch.bind(dependencies.d1) };
  const d2Runtime = { detectClaims: dependencies.d2.detectClaims.bind(dependencies.d2) };
  const allocateD1 = dependencies.allocateD1ExecutionId;
  const allocateD2 = dependencies.allocateD2ExecutionId;
  const context = validatePharmaceuticalAdjudicationContextSetV2(snapshot.context, snapshot.contextSource);
  const configuration = validatePharmaceuticalScoringConfigurationV2(snapshot.configuration, snapshot.contextSource);
  const acceptance = parseScoring(pharmaceuticalSemanticAcceptanceSchema, snapshot.d1SemanticAcceptance, 'd1SemanticAcceptance');
  const selection = parseScoring(d2Selection, snapshot.d2, 'd2');
  const d1 = await adjudicatePharmaceuticalD1ContextWithWitnessesV2(context, d1Runtime, allocateD1);
  let d2: PharmaceuticalScoreSourceV2['d2'];
  let publicD2: Readonly<{ status: 'NOT_PROVIDED'; reason: 'NOT_REQUESTED' }> |
    (Readonly<{ status: 'PROVIDED' }> & PharmaceuticalD2ClaimAdjudicationV2);
  if (selection.status === 'NOT_PROVIDED') {
    d2 = selection;
    publicD2 = selection;
  } else {
    const witnesses = await adjudicatePharmaceuticalD2ClaimsWithWitnessesV2(
      context, d2Runtime, allocateD2, 'pharmaceutical-d2-semantic-request/2', 'pharmaceutical-d2-claim-prompt/5',
    );
    d2 = { status: 'PROVIDED', set: witnesses.adjudication.findingSet,
      request: witnesses.request, providerResult: witnesses.providerResult,
      semanticAcceptance: selection.semanticAcceptance };
    publicD2 = { status: 'PROVIDED', ...witnesses.adjudication };
  }
  const source: PharmaceuticalScoreSourceV2 = { contextSource: snapshot.contextSource, context,
    d1: { ...d1, semanticAcceptance: acceptance }, d2 };
  const scoreInput = buildPharmaceuticalScoreInputV2(configuration, source);
  const score = calculatePharmaceuticalSessionScoreV2(scoreInput, configuration, source);
  return freezeScoring({ d1: d1.set, d2: publicD2, score });
}
