import { createHash } from 'node:crypto';

import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';
import {
  buildPharmaceuticalD1SemanticBatchRequestV2,
  validatePharmaceuticalD1SemanticBatchRequestV2,
} from './build-pharmaceutical-d1-semantic-request';
import { buildPharmaceuticalD1BatchPlanV1 } from './build-pharmaceutical-d1-batch-plan';
import {
  PHARMACEUTICAL_D1_BATCH_PLAN_VERSION_V1,
  type PharmaceuticalD1BatchDomainV1,
} from './pharmaceutical-d1-batch-types';
import {
  type PharmaceuticalD1AcceptedSemanticBatchV2,
  type PharmaceuticalD1CanonicalStudentEvidenceRefV2,
  type PharmaceuticalD1ProviderEvidenceV1,
  type PharmaceuticalD1ProviderTargetResultV1,
  type PharmaceuticalD1SemanticBatchRequestV2,
  type PharmaceuticalD1SemanticExecutionMetadataV2,
  type PharmaceuticalD1SemanticTargetAdjudicationV2,
  type PharmaceuticalSemanticExecutionIdV2,
  type PharmaceuticalTargetSemanticAdjudicationSetFingerprintV1,
  type PharmaceuticalTargetSemanticAdjudicationSetV2,
} from './pharmaceutical-d1-adjudication-types';
import { validatePharmaceuticalD1ProviderBatchResultV1 } from './validate-pharmaceutical-d1-provider-result';

type UnknownRecord = Record<string, unknown>;
const EXECUTION_ID = /^pharm_sem_exec_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class PharmaceuticalD1AdjudicationValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalD1AdjudicationValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalD1AdjudicationValidationError(path, message);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as UnknownRecord;
}

function exactKeys(value: unknown, keys: readonly string[], path: string): UnknownRecord {
  const source = record(value, path);
  const allowed = new Set(keys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      fail(`${path}.${key}`, 'missing required property');
    }
  }
  return source;
}

function assertExact(actual: unknown, expected: unknown, path: string): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) fail(path, 'must be an array');
    if (actual.length !== expected.length) fail(path, 'must contain the canonical value');
    expected.forEach((item, index) => assertExact(actual[index], item, `${path}[${index}]`));
    return;
  }
  if (typeof expected === 'object' && expected !== null) {
    const actualRecord = record(actual, path);
    const expectedRecord = expected as UnknownRecord;
    for (const key of Object.keys(actualRecord)) {
      if (!Object.prototype.hasOwnProperty.call(expectedRecord, key)) {
        fail(`${path}.${key}`, 'unexpected property');
      }
    }
    for (const key of Object.keys(expectedRecord)) {
      if (!Object.prototype.hasOwnProperty.call(actualRecord, key)) {
        fail(`${path}.${key}`, 'missing required property');
      }
      assertExact(actualRecord[key], expectedRecord[key], `${path}.${key}`);
    }
    return;
  }
  if (actual !== expected) fail(path, 'does not match the canonical value');
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
    fail(path, 'must be a non-empty trimmed string');
  }
  return value;
}

export function parsePharmaceuticalSemanticExecutionIdV2(
  value: unknown,
  path = 'semanticExecutionRef',
): PharmaceuticalSemanticExecutionIdV2 {
  if (typeof value !== 'string' || !EXECUTION_ID.test(value)) {
    fail(path, 'must be an opaque pharm_sem_exec_<canonical-lowercase-uuid> identifier');
  }
  return value as PharmaceuticalSemanticExecutionIdV2;
}

export function validatePharmaceuticalD1SemanticExecutionMetadataV2(
  input: unknown,
  request: PharmaceuticalD1SemanticBatchRequestV2,
): PharmaceuticalD1SemanticExecutionMetadataV2 {
  const source = exactKeys(
    input,
    [
      'semanticExecutionRef',
      'lane',
      'provider',
      'responseModel',
      'promptVersion',
      'requestFingerprint',
      'includedTargetRefs',
    ],
    'semanticExecution',
  );
  if (source.lane !== 'D1') fail('semanticExecution.lane', 'must be D1');
  const expectedTargetRefs = request.targets.map((target) => target.targetRef);
  assertExact(
    source.requestFingerprint,
    request.requestFingerprint,
    'semanticExecution.requestFingerprint',
  );
  assertExact(source.includedTargetRefs, expectedTargetRefs, 'semanticExecution.includedTargetRefs');
  if (source.promptVersion !== request.promptVersion) {
    fail('semanticExecution.promptVersion', 'does not match the semantic request');
  }
  return {
    semanticExecutionRef: parsePharmaceuticalSemanticExecutionIdV2(
      source.semanticExecutionRef,
      'semanticExecution.semanticExecutionRef',
    ),
    lane: 'D1',
    provider: nonEmptyString(source.provider, 'semanticExecution.provider'),
    responseModel: nonEmptyString(source.responseModel, 'semanticExecution.responseModel'),
    promptVersion: request.promptVersion,
    requestFingerprint: structuredClone(request.requestFingerprint),
    includedTargetRefs: expectedTargetRefs,
  };
}

function canonicalEvidenceRefs(
  targetRef: PharmaceuticalD1SemanticBatchRequestV2['targets'][number]['targetRef'],
  evidence: readonly PharmaceuticalD1ProviderEvidenceV1[],
): PharmaceuticalD1CanonicalStudentEvidenceRefV2[] {
  return evidence.map((item) => ({
    targetRef,
    messageRef: item.messageRef,
    speaker: 'student',
    evidenceRole: 'STUDENT_DEMONSTRATION',
    evidenceKind: item.evidenceKind,
    excerpt: item.excerpt,
  }));
}

function semanticAdjudication(
  result: PharmaceuticalD1ProviderTargetResultV1,
  executionRef: PharmaceuticalSemanticExecutionIdV2,
): PharmaceuticalD1SemanticTargetAdjudicationV2 {
  switch (result.verdict) {
    case 'CORRECTLY_DEMONSTRATED':
      return {
        targetRef: result.targetRef,
        resolution: 'SEMANTIC',
        verdict: result.verdict,
        supportingEvidenceRefs: canonicalEvidenceRefs(
          result.targetRef,
          result.supportingEvidence,
        ) as [PharmaceuticalD1CanonicalStudentEvidenceRefV2, ...PharmaceuticalD1CanonicalStudentEvidenceRefV2[]],
        semanticExecutionRef: executionRef,
      };
    case 'INCORRECT_OR_CONTRADICTED':
      return {
        targetRef: result.targetRef,
        resolution: 'SEMANTIC',
        verdict: result.verdict,
        contradictionEvidenceRefs: canonicalEvidenceRefs(
          result.targetRef,
          result.contradictionEvidence,
        ) as [PharmaceuticalD1CanonicalStudentEvidenceRefV2, ...PharmaceuticalD1CanonicalStudentEvidenceRefV2[]],
        semanticExecutionRef: executionRef,
      };
    case 'UNCERTAIN':
      return {
        targetRef: result.targetRef,
        resolution: 'SEMANTIC',
        verdict: result.verdict,
        relatedEvidenceRefs: canonicalEvidenceRefs(
          result.targetRef,
          result.relatedEvidence,
        ) as [PharmaceuticalD1CanonicalStudentEvidenceRefV2, ...PharmaceuticalD1CanonicalStudentEvidenceRefV2[]],
        semanticExecutionRef: executionRef,
      };
    case 'NOT_DEMONSTRATED':
      return {
        targetRef: result.targetRef,
        resolution: 'SEMANTIC',
        verdict: result.verdict,
        evidenceRefs: [],
        semanticExecutionRef: executionRef,
      };
  }
}

export function buildPharmaceuticalD1AcceptedSemanticBatchV2(
  requestInput: unknown,
  providerInput: unknown,
  executionInput: unknown,
  context: PharmaceuticalAdjudicationContextSetV2,
  expectedPromptVersion?: string,
): PharmaceuticalD1AcceptedSemanticBatchV2 {
  const request = validatePharmaceuticalD1SemanticBatchRequestV2(
    requestInput,
    context,
    expectedPromptVersion,
  );
  const providerResult = validatePharmaceuticalD1ProviderBatchResultV1(
    request,
    providerInput,
    context,
    expectedPromptVersion,
  );
  const execution = validatePharmaceuticalD1SemanticExecutionMetadataV2(executionInput, request);
  return {
    batchDomain: request.batchDomain,
    requestFingerprint: structuredClone(request.requestFingerprint),
    execution,
    adjudications: providerResult.results.map((result) =>
      semanticAdjudication(result, execution.semanticExecutionRef),
    ),
  };
}

function providerEvidenceFromCanonicalRefs(
  input: unknown,
  targetRef: unknown,
  path: string,
): PharmaceuticalD1ProviderEvidenceV1[] {
  if (!Array.isArray(input)) fail(path, 'must be an array');
  return input.map((value, index) => {
    const itemPath = `${path}[${index}]`;
    const source = exactKeys(
      value,
      ['targetRef', 'messageRef', 'speaker', 'evidenceRole', 'evidenceKind', 'excerpt'],
      itemPath,
    );
    if (source.targetRef !== targetRef) fail(`${itemPath}.targetRef`, 'does not match its adjudication');
    if (source.speaker !== 'student') fail(`${itemPath}.speaker`, 'must be student');
    if (source.evidenceRole !== 'STUDENT_DEMONSTRATION') {
      fail(`${itemPath}.evidenceRole`, 'must be STUDENT_DEMONSTRATION');
    }
    return {
      messageRef: source.messageRef as PharmaceuticalD1ProviderEvidenceV1['messageRef'],
      evidenceKind: source.evidenceKind as PharmaceuticalD1ProviderEvidenceV1['evidenceKind'],
      excerpt: source.excerpt as string,
    };
  });
}

function providerResultFromAdjudications(input: unknown): unknown {
  if (!Array.isArray(input)) fail('acceptedBatch.adjudications', 'must be an array');
  return {
    schemaVersion: '2.0',
    contractVersion: 'pharmaceutical-d1-provider-result/1',
    results: input.map((value, index) => {
      const path = `acceptedBatch.adjudications[${index}]`;
      const common = record(value, path);
      if (common.resolution !== 'SEMANTIC') fail(`${path}.resolution`, 'must be SEMANTIC');
      switch (common.verdict) {
        case 'CORRECTLY_DEMONSTRATED': {
          const source = exactKeys(
            value,
            ['targetRef', 'resolution', 'verdict', 'supportingEvidenceRefs', 'semanticExecutionRef'],
            path,
          );
          return {
            targetRef: source.targetRef,
            verdict: source.verdict,
            supportingEvidence: providerEvidenceFromCanonicalRefs(
              source.supportingEvidenceRefs,
              source.targetRef,
              `${path}.supportingEvidenceRefs`,
            ),
          };
        }
        case 'INCORRECT_OR_CONTRADICTED': {
          const source = exactKeys(
            value,
            ['targetRef', 'resolution', 'verdict', 'contradictionEvidenceRefs', 'semanticExecutionRef'],
            path,
          );
          return {
            targetRef: source.targetRef,
            verdict: source.verdict,
            contradictionEvidence: providerEvidenceFromCanonicalRefs(
              source.contradictionEvidenceRefs,
              source.targetRef,
              `${path}.contradictionEvidenceRefs`,
            ),
          };
        }
        case 'UNCERTAIN': {
          const source = exactKeys(
            value,
            ['targetRef', 'resolution', 'verdict', 'relatedEvidenceRefs', 'semanticExecutionRef'],
            path,
          );
          return {
            targetRef: source.targetRef,
            verdict: source.verdict,
            relatedEvidence: providerEvidenceFromCanonicalRefs(
              source.relatedEvidenceRefs,
              source.targetRef,
              `${path}.relatedEvidenceRefs`,
            ),
          };
        }
        case 'NOT_DEMONSTRATED': {
          const source = exactKeys(
            value,
            ['targetRef', 'resolution', 'verdict', 'evidenceRefs', 'semanticExecutionRef'],
            path,
          );
          return {
            targetRef: source.targetRef,
            verdict: source.verdict,
            evidence: providerEvidenceFromCanonicalRefs(
              source.evidenceRefs,
              source.targetRef,
              `${path}.evidenceRefs`,
            ),
          };
        }
        default:
          fail(`${path}.verdict`, 'must be a supported D1 semantic verdict');
      }
    }),
  };
}

function canonicalAcceptedBatch(
  input: unknown,
  context: PharmaceuticalAdjudicationContextSetV2,
): PharmaceuticalD1AcceptedSemanticBatchV2 {
  const source = exactKeys(
    input,
    ['batchDomain', 'requestFingerprint', 'execution', 'adjudications'],
    'acceptedBatch',
  );
  const executionSource = record(source.execution, 'acceptedBatch.execution');
  const promptVersion = nonEmptyString(
    executionSource.promptVersion,
    'acceptedBatch.execution.promptVersion',
  );
  const request = buildPharmaceuticalD1SemanticBatchRequestV2(
    context,
    source.batchDomain as PharmaceuticalD1BatchDomainV1,
    promptVersion,
  );
  const expected = buildPharmaceuticalD1AcceptedSemanticBatchV2(
    request,
    providerResultFromAdjudications(source.adjudications),
    source.execution,
    context,
    promptVersion,
  );
  assertExact(input, expected, 'acceptedBatch');
  return expected;
}

type GlobalCore = Omit<PharmaceuticalTargetSemanticAdjudicationSetV2, 'fingerprint'>;

export function calculatePharmaceuticalTargetSemanticAdjudicationSetFingerprintV1(
  value: GlobalCore,
): PharmaceuticalTargetSemanticAdjudicationSetFingerprintV1 {
  return {
    algorithm: 'sha256',
    canonicalization: 'pharmaceutical-target-semantic-adjudication-set-v2/1',
    value: createHash('sha256').update(JSON.stringify(value)).digest('hex'),
  };
}

export function buildPharmaceuticalTargetSemanticAdjudicationSetV2(
  context: PharmaceuticalAdjudicationContextSetV2,
  acceptedBatches: readonly PharmaceuticalD1AcceptedSemanticBatchV2[],
): PharmaceuticalTargetSemanticAdjudicationSetV2 {
  const plan = buildPharmaceuticalD1BatchPlanV1(context);
  if (acceptedBatches.length !== plan.semanticBatches.length) {
    fail('acceptedBatches', 'must contain exactly one accepted result per semantic batch');
  }

  const canonicalBatches = acceptedBatches.map((batch) => canonicalAcceptedBatch(batch, context));
  const acceptedByDomain = new Map<PharmaceuticalD1BatchDomainV1, PharmaceuticalD1AcceptedSemanticBatchV2>();
  canonicalBatches.forEach((batch, index) => {
    if (acceptedByDomain.has(batch.batchDomain)) {
      fail(`acceptedBatches[${index}].batchDomain`, 'duplicates a semantic batch');
    }
    if (plan.semanticBatches[index]?.batchDomain !== batch.batchDomain) {
      fail(`acceptedBatches[${index}].batchDomain`, 'does not preserve canonical batch order');
    }
    acceptedByDomain.set(batch.batchDomain, batch);
  });

  const adjudicationByTarget = new Map(
    canonicalBatches.flatMap((batch) =>
      batch.adjudications.map((adjudication) => [adjudication.targetRef, adjudication] as const),
    ),
  );
  const shellByTarget = new Map(plan.structuralShells.map((shell) => [shell.targetRef, shell] as const));
  const adjudications = context.targets.map((target) => {
    if (target.structuralState.status === 'NO_STUDENT_CANDIDATES') {
      const shell = shellByTarget.get(target.targetRef);
      if (shell === undefined) fail(`targets.${target.targetRef}`, 'missing structural shell');
      return shell;
    }
    const adjudication = adjudicationByTarget.get(target.targetRef);
    if (adjudication === undefined) fail(`targets.${target.targetRef}`, 'missing semantic adjudication');
    return adjudication;
  });

  const core: GlobalCore = {
    schemaVersion: '2.0',
    contractVersion: 'pharmaceutical-target-semantic-adjudication-set/1',
    sessionId: context.sessionId,
    caseVersionId: context.caseVersionId,
    transcriptFingerprint: structuredClone(context.transcriptFingerprint),
    targetSetFingerprint: structuredClone(context.targetSetFingerprint),
    contextFingerprint: structuredClone(context.fingerprint),
    batchPlanVersion: PHARMACEUTICAL_D1_BATCH_PLAN_VERSION_V1,
    executions: canonicalBatches.map((batch) => structuredClone(batch.execution)),
    adjudications: structuredClone(adjudications),
  };
  return {
    ...core,
    fingerprint: calculatePharmaceuticalTargetSemanticAdjudicationSetFingerprintV1(core),
  };
}

export function validatePharmaceuticalTargetSemanticAdjudicationSetV2(
  input: unknown,
  context: PharmaceuticalAdjudicationContextSetV2,
  acceptedBatches: readonly PharmaceuticalD1AcceptedSemanticBatchV2[],
): PharmaceuticalTargetSemanticAdjudicationSetV2 {
  const expected = buildPharmaceuticalTargetSemanticAdjudicationSetV2(context, acceptedBatches);
  assertExact(input, expected, 'pharmaceuticalTargetSemanticAdjudicationSet');
  return expected;
}
