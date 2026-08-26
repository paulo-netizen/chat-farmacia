import {
  buildSpfaRequirementEvidenceBaselineV2,
} from './build-spfa-evidence-baseline';
import {
  SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
} from './build-openai-spfa-semantic-adjudication-params';
import {
  buildSpfaSemanticTargetContextV2,
  type BuildSpfaSemanticTargetContextInputV2,
} from './build-spfa-semantic-target-context';
import { composeSpfaRequirementSessionResultV2 } from './compose-spfa-requirement-session-result';
import type { NonEmptyArray } from './evaluator-types';
import type { OpenAiSpfaSemanticAdjudicationExecutionReceiptV1 } from './execute-openai-spfa-semantic-adjudication';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from './spfa-protocol-set-types';
import type {
  SpfaSessionEvaluationApplicationV2,
  SpfaSessionEvaluationV2,
  SpfaSessionSemanticExecutionV2,
} from './spfa-session-evaluation-types';
import type {
  SessionTranscriptSnapshotV2,
  SpfaRequirementSessionResultV2,
} from './spfa-session-evidence-types';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';
import { validateSpfaSemanticAdjudicationV2 } from './validate-spfa-semantic-adjudication';
import {
  validateCaseSpfaProtocolSetAgainstCanonicalContextV2,
  validateSpfaProtocolSetClinicalContextV2,
} from './validate-spfa-protocol-set';
import { validateSpfaSessionEvaluationV2 } from './validate-spfa-session-evaluation';

const MAX_RESPONSE_MODEL_LENGTH = 200;

export type EvaluateSpfaSessionInputV2 = Readonly<{
  transcript: SessionTranscriptSnapshotV2;
  core: SpfaIntegratedGeneratedCaseCoreV2;
}>;

export type AdjudicateSpfaRequirementV2 = (
  input: BuildSpfaSemanticTargetContextInputV2,
) => Promise<OpenAiSpfaSemanticAdjudicationExecutionReceiptV1>;

export type EvaluateSpfaSessionDependenciesV2 = Readonly<{
  adjudicate: AdjudicateSpfaRequirementV2;
}>;

export type SpfaSessionEvaluationOrchestrationErrorCode =
  | 'invalid_orchestration_input'
  | 'invalid_semantic_execution_receipt';

export class SpfaSessionEvaluationOrchestrationError extends Error {
  constructor(
    public readonly code: SpfaSessionEvaluationOrchestrationErrorCode,
    public readonly path: string,
    public readonly cause?: unknown,
  ) {
    super(`${code} at ${path}`);
    this.name = 'SpfaSessionEvaluationOrchestrationError';
  }
}

function fail(
  code: SpfaSessionEvaluationOrchestrationErrorCode,
  path: string,
  cause?: unknown,
): never {
  throw new SpfaSessionEvaluationOrchestrationError(code, path, cause);
}

function asRecord(
  value: unknown,
  path: string,
  code: SpfaSessionEvaluationOrchestrationErrorCode =
    'invalid_orchestration_input',
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(code, path);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) {
      fail('invalid_orchestration_input', `${path}.${key}`);
    }
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      fail('invalid_orchestration_input', `${path}.${key}`);
    }
  }
}

function validateInputs(
  inputValue: EvaluateSpfaSessionInputV2,
  dependenciesValue: EvaluateSpfaSessionDependenciesV2,
): {
  transcript: ReturnType<typeof validateSessionTranscriptSnapshotV2>;
  core: SpfaIntegratedGeneratedCaseCoreV2;
} {
  const input = asRecord(inputValue, 'input');
  assertExactKeys(input, ['transcript', 'core'], 'input');
  const dependencies = asRecord(dependenciesValue, 'dependencies');
  if (typeof dependencies.adjudicate !== 'function') {
    fail('invalid_orchestration_input', 'dependencies.adjudicate');
  }

  const transcript = validateSessionTranscriptSnapshotV2(
    input.transcript,
    'input.transcript',
  );
  const rawCore = asRecord(input.core, 'input.core');
  assertExactKeys(
    rawCore,
    ['caseVersionId', 'patientFacts', 'evaluator', 'spfaProtocolSet'],
    'input.core',
  );
  const clinicalContext = validateSpfaProtocolSetClinicalContextV2(
    {
      caseVersionId: inputValue.core.caseVersionId,
      patientFacts: inputValue.core.patientFacts,
      evaluator: inputValue.core.evaluator,
    },
    'input.core',
  );
  const spfaProtocolSet = validateCaseSpfaProtocolSetAgainstCanonicalContextV2(
    inputValue.core.spfaProtocolSet,
    clinicalContext,
  );
  if (transcript.caseVersionId !== clinicalContext.caseVersionId) {
    fail('invalid_orchestration_input', 'input.transcript.caseVersionId');
  }
  return {
    transcript,
    core: {
      caseVersionId: clinicalContext.caseVersionId,
      patientFacts: clinicalContext.patientFacts,
      evaluator: clinicalContext.evaluator,
      spfaProtocolSet,
    },
  };
}

function validateReceipt(
  value: unknown,
  input: BuildSpfaSemanticTargetContextInputV2,
  path: string,
): OpenAiSpfaSemanticAdjudicationExecutionReceiptV1 {
  const source = asRecord(value, path, 'invalid_semantic_execution_receipt');
  const allowed = ['adjudication', 'provider', 'responseModel', 'promptVersion'];
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) {
      fail('invalid_semantic_execution_receipt', `${path}.${key}`);
    }
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      fail('invalid_semantic_execution_receipt', `${path}.${key}`);
    }
  }
  if (source.provider !== 'openai') {
    fail('invalid_semantic_execution_receipt', `${path}.provider`);
  }
  if (
    typeof source.responseModel !== 'string' ||
    source.responseModel.length === 0 ||
    source.responseModel.trim() !== source.responseModel ||
    source.responseModel.length > MAX_RESPONSE_MODEL_LENGTH
  ) {
    fail('invalid_semantic_execution_receipt', `${path}.responseModel`);
  }
  if (source.promptVersion !== SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION) {
    fail('invalid_semantic_execution_receipt', `${path}.promptVersion`);
  }

  let adjudication;
  try {
    adjudication = validateSpfaSemanticAdjudicationV2(
      source.adjudication,
      { transcript: input.transcript, baseline: input.baseline },
      `${path}.adjudication`,
    );
  } catch (cause) {
    fail('invalid_semantic_execution_receipt', `${path}.adjudication`, cause);
  }
  return {
    adjudication,
    provider: 'openai',
    responseModel: source.responseModel,
    promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
  };
}

export async function evaluateSpfaSessionV2(
  inputValue: EvaluateSpfaSessionInputV2,
  dependenciesValue: EvaluateSpfaSessionDependenciesV2,
): Promise<SpfaSessionEvaluationV2> {
  const { transcript, core } = validateInputs(inputValue, dependenciesValue);
  const adjudicate = dependenciesValue.adjudicate;
  const semanticExecutions: SpfaSessionSemanticExecutionV2[] = [];
  const applications: SpfaSessionEvaluationApplicationV2[] = [];

  for (const application of core.spfaProtocolSet.applications) {
    const requirementResults: SpfaRequirementSessionResultV2[] = [];
    for (const appliedRequirement of application.requirements) {
      const baseline = buildSpfaRequirementEvidenceBaselineV2({
        transcript,
        carePathSpfaRef: application.carePathSpfaRef,
        appliedRequirement,
      });
      let receipt: OpenAiSpfaSemanticAdjudicationExecutionReceiptV1 | undefined;
      if (
        baseline.resolution === 'DETERMINISTIC_PARTIAL' ||
        baseline.resolution === 'SEMANTIC_REQUIRED'
      ) {
        const semanticInput: BuildSpfaSemanticTargetContextInputV2 = {
          transcript,
          baseline,
          core,
        };
        buildSpfaSemanticTargetContextV2(semanticInput);
        receipt = validateReceipt(
          await adjudicate(semanticInput),
          semanticInput,
          `semanticExecution[${semanticExecutions.length}]`,
        );
      }
      requirementResults.push(
        composeSpfaRequirementSessionResultV2({
          transcript,
          baseline,
          appliedRequirement,
          ...(receipt === undefined
            ? {}
            : { adjudication: receipt.adjudication }),
        }),
      );
      if (receipt !== undefined) {
        semanticExecutions.push({
          carePathSpfaRef: application.carePathSpfaRef,
          requirementRef: appliedRequirement.requirementRef,
          provider: receipt.provider,
          responseModel: receipt.responseModel,
          promptVersion: receipt.promptVersion,
        });
      }
    }
    applications.push({
      carePathSpfaRef: application.carePathSpfaRef,
      protocolRef: { ...application.protocolRef },
      requirementResults: requirementResults as unknown as NonEmptyArray<SpfaRequirementSessionResultV2>,
    });
  }

  return validateSpfaSessionEvaluationV2(
    {
      schemaVersion: '2.0',
      sessionId: transcript.sessionId,
      caseVersionId: transcript.caseVersionId,
      protocolCatalogRef: { ...core.spfaProtocolSet.catalogRef },
      transcriptFingerprint: { ...transcript.fingerprint },
      applications: applications as unknown as NonEmptyArray<SpfaSessionEvaluationApplicationV2>,
      semanticExecutions,
    },
    { transcript, spfaProtocolSet: core.spfaProtocolSet },
  );
}
