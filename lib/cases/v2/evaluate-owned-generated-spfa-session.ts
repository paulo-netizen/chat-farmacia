import {
  evaluateSpfaSessionV2,
  type AdjudicateSpfaRequirementV2,
} from './evaluate-spfa-session';
import { createOpenAiSpfaSemanticAdjudicationRuntimeV2 } from './openai-spfa-semantic-adjudication-runtime';
import {
  resolveSessionSpfaEvaluationRuntimeV2,
  type SessionClinicalRuntimeInputV2,
} from './session-clinical-runtime';
import type { SpfaSessionEvaluationV2 } from './spfa-session-evaluation-types';

export type EvaluateOwnedGeneratedSpfaSessionDependenciesV2 = Readonly<{
  resolveRuntime: typeof resolveSessionSpfaEvaluationRuntimeV2;
  createAdjudicationRuntime:
    typeof createOpenAiSpfaSemanticAdjudicationRuntimeV2;
  evaluateSession: typeof evaluateSpfaSessionV2;
}>;

const DEFAULT_DEPENDENCIES: EvaluateOwnedGeneratedSpfaSessionDependenciesV2 =
  Object.freeze({
    resolveRuntime: resolveSessionSpfaEvaluationRuntimeV2,
    createAdjudicationRuntime:
      createOpenAiSpfaSemanticAdjudicationRuntimeV2,
    evaluateSession: evaluateSpfaSessionV2,
  });

export async function evaluateOwnedGeneratedSpfaSessionV2(
  input: SessionClinicalRuntimeInputV2,
  dependencies: EvaluateOwnedGeneratedSpfaSessionDependenciesV2 =
    DEFAULT_DEPENDENCIES,
): Promise<SpfaSessionEvaluationV2> {
  const runtime = await dependencies.resolveRuntime(input);
  let adjudicateRuntime:
    | ReturnType<typeof createOpenAiSpfaSemanticAdjudicationRuntimeV2>
    | undefined;

  const adjudicate: AdjudicateSpfaRequirementV2 = (semanticInput) => {
    adjudicateRuntime ??= dependencies.createAdjudicationRuntime();
    return adjudicateRuntime.adjudicate(semanticInput);
  };

  return dependencies.evaluateSession(
    {
      transcript: runtime.transcript,
      core: runtime.core,
    },
    { adjudicate },
  );
}
