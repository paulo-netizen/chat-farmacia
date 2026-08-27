import { z } from 'zod';

import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';
import {
  type PharmaceuticalD1ProviderBatchResultV1,
  type PharmaceuticalD1ProviderEvidenceV1,
  type PharmaceuticalD1ProviderTargetResultV1,
  type PharmaceuticalD1SemanticBatchRequestV2,
} from './pharmaceutical-d1-adjudication-types';
import { validatePharmaceuticalD1SemanticBatchRequestV2 } from './build-pharmaceutical-d1-semantic-request';

const STUDENT_EVIDENCE_KIND_SCHEMA = z.enum([
  'STUDENT_QUESTION',
  'STUDENT_INTERPRETATION',
  'STUDENT_DECISION',
  'STUDENT_ACTION',
]);

export const PHARMACEUTICAL_D1_PROVIDER_EVIDENCE_SCHEMA_V1 = z
  .object({
    messageRef: z.string().min(1),
    evidenceKind: STUDENT_EVIDENCE_KIND_SCHEMA,
    excerpt: z.string().min(1),
  })
  .strict();

const CORRECTLY_DEMONSTRATED_SCHEMA = z
  .object({
    targetRef: z.string().min(1),
    verdict: z.literal('CORRECTLY_DEMONSTRATED'),
    supportingEvidence: z.array(PHARMACEUTICAL_D1_PROVIDER_EVIDENCE_SCHEMA_V1).min(1),
  })
  .strict();

const INCORRECT_OR_CONTRADICTED_SCHEMA = z
  .object({
    targetRef: z.string().min(1),
    verdict: z.literal('INCORRECT_OR_CONTRADICTED'),
    contradictionEvidence: z.array(PHARMACEUTICAL_D1_PROVIDER_EVIDENCE_SCHEMA_V1).min(1),
  })
  .strict();

const UNCERTAIN_SCHEMA = z
  .object({
    targetRef: z.string().min(1),
    verdict: z.literal('UNCERTAIN'),
    relatedEvidence: z.array(PHARMACEUTICAL_D1_PROVIDER_EVIDENCE_SCHEMA_V1).min(1),
  })
  .strict();

const NOT_DEMONSTRATED_SCHEMA = z
  .object({
    targetRef: z.string().min(1),
    verdict: z.literal('NOT_DEMONSTRATED'),
    evidence: z.array(PHARMACEUTICAL_D1_PROVIDER_EVIDENCE_SCHEMA_V1).max(0),
  })
  .strict();

export const PHARMACEUTICAL_D1_PROVIDER_TARGET_RESULT_SCHEMA_V1 =
  z.discriminatedUnion('verdict', [
    CORRECTLY_DEMONSTRATED_SCHEMA,
    INCORRECT_OR_CONTRADICTED_SCHEMA,
    UNCERTAIN_SCHEMA,
    NOT_DEMONSTRATED_SCHEMA,
  ]);

export const PHARMACEUTICAL_D1_PROVIDER_BATCH_RESULT_SCHEMA_V1 = z
  .object({
    schemaVersion: z.literal('2.0'),
    contractVersion: z.literal('pharmaceutical-d1-provider-result/1'),
    results: z.array(PHARMACEUTICAL_D1_PROVIDER_TARGET_RESULT_SCHEMA_V1),
  })
  .strict();

export class PharmaceuticalD1ProviderResultValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalD1ProviderResultValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalD1ProviderResultValidationError(path, message);
}

function evidenceForResult(
  result: z.infer<typeof PHARMACEUTICAL_D1_PROVIDER_TARGET_RESULT_SCHEMA_V1>,
): readonly z.infer<typeof PHARMACEUTICAL_D1_PROVIDER_EVIDENCE_SCHEMA_V1>[] {
  switch (result.verdict) {
    case 'CORRECTLY_DEMONSTRATED':
      return result.supportingEvidence;
    case 'INCORRECT_OR_CONTRADICTED':
      return result.contradictionEvidence;
    case 'UNCERTAIN':
      return result.relatedEvidence;
    case 'NOT_DEMONSTRATED':
      return result.evidence;
  }
}

function canonicalEvidence(
  target: PharmaceuticalD1SemanticBatchRequestV2['targets'][number],
  items: readonly z.infer<typeof PHARMACEUTICAL_D1_PROVIDER_EVIDENCE_SCHEMA_V1>[],
  path: string,
): PharmaceuticalD1ProviderEvidenceV1[] {
  const seen = new Set<string>();
  return items.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const candidate = target.studentCandidates.find(
      (value) => value.messageRef === item.messageRef,
    );
    if (candidate === undefined) {
      fail(`${itemPath}.messageRef`, 'is not a student candidate for this target');
    }
    if (!candidate.candidateEvidenceKinds.includes(item.evidenceKind)) {
      fail(`${itemPath}.evidenceKind`, 'is not allowed for this student candidate');
    }
    if (!candidate.untrustedContent.includes(item.excerpt)) {
      fail(`${itemPath}.excerpt`, 'must be a literal excerpt of the student message');
    }
    const key = JSON.stringify([item.messageRef, item.evidenceKind, item.excerpt]);
    if (seen.has(key)) fail(itemPath, 'duplicates an evidence reference');
    seen.add(key);
    return {
      messageRef: item.messageRef as PharmaceuticalD1ProviderEvidenceV1['messageRef'],
      evidenceKind: item.evidenceKind,
      excerpt: item.excerpt,
    };
  });
}

function canonicalResult(
  request: PharmaceuticalD1SemanticBatchRequestV2,
  parsed: z.infer<typeof PHARMACEUTICAL_D1_PROVIDER_TARGET_RESULT_SCHEMA_V1>,
  targetIndex: number,
): PharmaceuticalD1ProviderTargetResultV1 {
  const target = request.targets[targetIndex];
  const sourceIndex = request.targets.findIndex((item) => item.targetRef === parsed.targetRef);
  const basePath = `providerResult.results[${sourceIndex}]`;
  const evidence = canonicalEvidence(target, evidenceForResult(parsed), `${basePath}.evidence`);

  switch (parsed.verdict) {
    case 'CORRECTLY_DEMONSTRATED':
      return {
        targetRef: target.targetRef,
        verdict: parsed.verdict,
        supportingEvidence: evidence as [PharmaceuticalD1ProviderEvidenceV1, ...PharmaceuticalD1ProviderEvidenceV1[]],
      };
    case 'INCORRECT_OR_CONTRADICTED':
      return {
        targetRef: target.targetRef,
        verdict: parsed.verdict,
        contradictionEvidence: evidence as [PharmaceuticalD1ProviderEvidenceV1, ...PharmaceuticalD1ProviderEvidenceV1[]],
      };
    case 'UNCERTAIN':
      return {
        targetRef: target.targetRef,
        verdict: parsed.verdict,
        relatedEvidence: evidence as [PharmaceuticalD1ProviderEvidenceV1, ...PharmaceuticalD1ProviderEvidenceV1[]],
      };
    case 'NOT_DEMONSTRATED':
      return {
        targetRef: target.targetRef,
        verdict: parsed.verdict,
        evidence: [],
      };
  }
}

export function validatePharmaceuticalD1ProviderBatchResultV1(
  requestInput: unknown,
  providerInput: unknown,
  context: PharmaceuticalAdjudicationContextSetV2,
  expectedPromptVersion?: string,
): PharmaceuticalD1ProviderBatchResultV1 {
  const request = validatePharmaceuticalD1SemanticBatchRequestV2(
    requestInput,
    context,
    expectedPromptVersion,
  );
  const parsed = PHARMACEUTICAL_D1_PROVIDER_BATCH_RESULT_SCHEMA_V1.safeParse(providerInput);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    fail(
      ['providerResult', ...issue.path].join('.').replace(/\.([0-9]+)(?=\.|$)/g, '[$1]'),
      issue.message,
    );
  }

  const byTarget = new Map<string, z.infer<typeof PHARMACEUTICAL_D1_PROVIDER_TARGET_RESULT_SCHEMA_V1>>();
  parsed.data.results.forEach((result, index) => {
    if (!request.targets.some((target) => target.targetRef === result.targetRef)) {
      fail(`providerResult.results[${index}].targetRef`, 'is not included in the semantic request');
    }
    if (byTarget.has(result.targetRef)) {
      fail(`providerResult.results[${index}].targetRef`, 'duplicates a target result');
    }
    byTarget.set(result.targetRef, result);
  });

  if (byTarget.size !== request.targets.length) {
    const missing = request.targets.find((target) => !byTarget.has(target.targetRef));
    fail('providerResult.results', `must include exactly one result for target ${String(missing?.targetRef)}`);
  }

  return {
    schemaVersion: '2.0',
    contractVersion: 'pharmaceutical-d1-provider-result/1',
    results: request.targets.map((target, index) =>
      canonicalResult(request, byTarget.get(target.targetRef)!, index),
    ),
  };
}
