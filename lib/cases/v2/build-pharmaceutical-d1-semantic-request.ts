import { createHash } from 'node:crypto';

import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';
import { buildPharmaceuticalD1BatchPlanV1 } from './build-pharmaceutical-d1-batch-plan';
import {
  PHARMACEUTICAL_D1_BATCH_PLAN_VERSION_V1,
  type PharmaceuticalD1BatchDomainV1,
  type PharmaceuticalD1SemanticBatchV1,
} from './pharmaceutical-d1-batch-types';
import {
  PHARMACEUTICAL_D1_PROMPT_VERSION_V3,
  PHARMACEUTICAL_D1_SEMANTIC_REQUEST_CONTRACT_VERSION_V1,
  type PharmaceuticalD1SemanticBatchRequestV2,
  type PharmaceuticalD1SemanticRequestFingerprintV1,
} from './pharmaceutical-d1-adjudication-types';

type UnknownRecord = Record<string, unknown>;
type RequestCore = Omit<PharmaceuticalD1SemanticBatchRequestV2, 'requestFingerprint'>;

export class PharmaceuticalD1SemanticRequestValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalD1SemanticRequestValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalD1SemanticRequestValidationError(path, message);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as UnknownRecord;
}

function assertExact(actual: unknown, expected: unknown, path: string): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) fail(path, 'must be an array');
    if (actual.length !== expected.length) fail(path, 'must contain the canonical request data');
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
  if (actual !== expected) fail(path, 'does not match the canonical semantic request');
}

export function calculatePharmaceuticalD1SemanticRequestFingerprintV1(
  request: RequestCore,
): PharmaceuticalD1SemanticRequestFingerprintV1 {
  const material = JSON.stringify([
    request.contractVersion,
    request.contextFingerprint,
    request.batchPlanVersion,
    request.promptVersion,
    request.batchDomain,
    request.targets.map((target) => target.targetRef),
    request.targets,
  ]);
  return {
    algorithm: 'sha256',
    canonicalization: 'pharmaceutical-d1-semantic-request-v2/1',
    value: createHash('sha256').update(material).digest('hex'),
  };
}

function buildRequestFromBatch(
  context: PharmaceuticalAdjudicationContextSetV2,
  batch: PharmaceuticalD1SemanticBatchV1,
  promptVersion: string,
): PharmaceuticalD1SemanticBatchRequestV2 {
  if (typeof promptVersion !== 'string' || promptVersion.length === 0) {
    fail('promptVersion', 'must be a non-empty server-owned identity');
  }
  const core: RequestCore = {
    schemaVersion: '2.0',
    contractVersion: PHARMACEUTICAL_D1_SEMANTIC_REQUEST_CONTRACT_VERSION_V1,
    batchPlanVersion: PHARMACEUTICAL_D1_BATCH_PLAN_VERSION_V1,
    batchDomain: batch.batchDomain,
    contextFingerprint: structuredClone(context.fingerprint),
    promptVersion,
    targets: structuredClone(batch.targets),
  };
  return {
    ...core,
    requestFingerprint: calculatePharmaceuticalD1SemanticRequestFingerprintV1(core),
  };
}

export function buildPharmaceuticalD1SemanticBatchRequestsV2(
  context: PharmaceuticalAdjudicationContextSetV2,
  promptVersion: string = PHARMACEUTICAL_D1_PROMPT_VERSION_V3,
): readonly PharmaceuticalD1SemanticBatchRequestV2[] {
  return buildPharmaceuticalD1BatchPlanV1(context).semanticBatches.map((batch) =>
    buildRequestFromBatch(context, batch, promptVersion),
  );
}

export function buildPharmaceuticalD1SemanticBatchRequestV2(
  context: PharmaceuticalAdjudicationContextSetV2,
  batchDomain: PharmaceuticalD1BatchDomainV1,
  promptVersion: string = PHARMACEUTICAL_D1_PROMPT_VERSION_V3,
): PharmaceuticalD1SemanticBatchRequestV2 {
  const batch = buildPharmaceuticalD1BatchPlanV1(context).semanticBatches.find(
    (candidate) => candidate.batchDomain === batchDomain,
  );
  if (batch === undefined) {
    fail('batchDomain', `no semantic targets exist for batch ${batchDomain}`);
  }
  return buildRequestFromBatch(context, batch, promptVersion);
}

export function validatePharmaceuticalD1SemanticBatchRequestV2(
  input: unknown,
  context: PharmaceuticalAdjudicationContextSetV2,
  expectedPromptVersion: string = PHARMACEUTICAL_D1_PROMPT_VERSION_V3,
): PharmaceuticalD1SemanticBatchRequestV2 {
  const source = record(input, 'pharmaceuticalD1SemanticRequest');
  const batchDomain = source.batchDomain;
  if (typeof batchDomain !== 'string') {
    fail('pharmaceuticalD1SemanticRequest.batchDomain', 'must be a string');
  }
  const expected = buildPharmaceuticalD1SemanticBatchRequestV2(
    context,
    batchDomain as PharmaceuticalD1BatchDomainV1,
    expectedPromptVersion,
  );
  assertExact(input, expected, 'pharmaceuticalD1SemanticRequest');
  return expected;
}
