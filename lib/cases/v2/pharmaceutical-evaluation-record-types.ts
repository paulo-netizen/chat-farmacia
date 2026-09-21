import { z } from 'zod';
import type { evaluatePharmaceuticalSessionV2 } from './evaluate-pharmaceutical-session';
import type { PharmaceuticalScoringPlanSourceV2 } from './build-pharmaceutical-scoring-plan';
import type { validatePharmaceuticalScoringConfigurationV2 } from './build-pharmaceutical-scoring-policy';
import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';
import { scoringFingerprintSchema, scoringIdentitySchema } from './pharmaceutical-scoring-contract-utils';
import { pharmaceuticalSemanticAcceptanceSchema, scoringConfigBindingSchema } from './pharmaceutical-scoring-types';
import { PHARMACEUTICAL_SEMANTIC_MODELS_V1 } from './pharmaceutical-semantic-model-policy';
import type { DeepScoringReadonly } from './pharmaceutical-scoring-contract-utils';

/** Internal server-only contracts. Ownership is data, not proof of authentication. */
export const PHARMACEUTICAL_RECORD_VERSION = 'pharmaceutical-evaluation-record/1' as const;
export const PHARMACEUTICAL_INTENT_CANONICALIZATION = 'pharmaceutical-evaluation-intent-v2/1' as const;
export const PHARMACEUTICAL_RECORD_CANONICALIZATION = 'pharmaceutical-evaluation-record-v2/1' as const;
export const PHARMACEUTICAL_SOURCE_CANONICALIZATION = 'pharmaceutical-evaluation-sources-v2/1' as const;
export const PHARMACEUTICAL_RESULT_CANONICALIZATION = 'pharmaceutical-evaluation-result-v2/1' as const;

export const evaluationIdSchema = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
// Only canonical UTC instants. Date's calendar rollover must not be accepted.
export const evaluationTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine(v => Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v);
const sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const sourceArtifactRefSchema = z.object({
  kind: z.literal('SOURCES'), contractVersion: z.literal('pharmaceutical-evaluation-sources/1'),
  fingerprint: scoringFingerprintSchema.extend({ canonicalization: z.literal(PHARMACEUTICAL_SOURCE_CANONICALIZATION) }),
}).strict();
export const resultArtifactRefSchema = z.object({
  kind: z.literal('RESULT'), contractVersion: z.literal('pharmaceutical-evaluation-result/1'),
  fingerprint: scoringFingerprintSchema.extend({ canonicalization: z.literal(PHARMACEUTICAL_RESULT_CANONICALIZATION) }),
}).strict();
const runtime = z.object({
  provider: z.literal('openai'), modelPolicyVersion: z.literal('pharmaceutical-semantic-model-policy/1'),
  requestedModel: z.enum(PHARMACEUTICAL_SEMANTIC_MODELS_V1),
  runtimeVersion: scoringIdentitySchema, sdkVersion: scoringIdentitySchema,
  maxOutputTokens: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  timeoutMs: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  retries: z.literal(0), fallback: z.literal('NONE'), sampling: z.literal('PROVIDER_DEFAULT'),
}).strict();
const d1Plan = z.discriminatedUnion('mode', [
  runtime.extend({ mode: z.literal('SEMANTIC'), promptVersion: z.literal('pharmaceutical-d1-adjudication-prompt/3') }).strict(),
  z.object({ mode: z.literal('NO_CALL'), reason: z.literal('NO_SEMANTIC_BATCHES') }).strict(),
]);
const d2Plan = z.discriminatedUnion('mode', [
  runtime.extend({ mode: z.literal('SEMANTIC'), promptVersion: z.literal('pharmaceutical-d2-claim-prompt/5'),
    requestVersion: z.literal('pharmaceutical-d2-semantic-request/2'), policyVersion: z.literal('pharmaceutical-d2-claim-policy/1'),
    providerContractVersion: z.literal('pharmaceutical-d2-provider-result/2') }).strict(),
  z.object({ mode: z.literal('NO_CALL'), reason: z.enum(['NOT_REQUESTED', 'EMPTY_STUDENT_MESSAGES']) }).strict(),
]);
export const executionPlanSchema = z.object({
  applicationVersion: scoringIdentitySchema, scorerVersion: scoringIdentitySchema,
  rulesVersion: z.literal('pharmaceutical-scoring-rules/1'), d1: d1Plan, d2: d2Plan,
}).strict();
export const evaluationIntentSchema = z.object({
  schemaVersion: z.literal('2.0'), contractVersion: z.literal('pharmaceutical-evaluation-intent/1'),
  ownerId: scoringIdentitySchema, sessionId: scoringIdentitySchema, caseVersionId: scoringIdentitySchema,
  idempotencyKey: evaluationIdSchema,
  supersedesEvaluationId: evaluationIdSchema.nullable(),
  transcriptFingerprint: scoringFingerprintSchema.extend({ canonicalization: z.literal('session-transcript-v2/1') }),
  configuration: z.object({ policy: scoringConfigBindingSchema, plan: scoringConfigBindingSchema,
    weights: scoringConfigBindingSchema, thresholds: scoringConfigBindingSchema, rounding: scoringConfigBindingSchema }).strict(),
  sources: sourceArtifactRefSchema,
  d1SemanticAcceptance: pharmaceuticalSemanticAcceptanceSchema,
  d2: z.discriminatedUnion('status', [
    z.object({ status: z.literal('NOT_PROVIDED'), reason: z.literal('NOT_REQUESTED') }).strict(),
    z.object({ status: z.literal('REQUESTED'), semanticAcceptance: pharmaceuticalSemanticAcceptanceSchema }).strict(),
  ]),
  executionPlan: executionPlanSchema,
}).strict();
const attemptBase = {
  attemptId: evaluationIdSchema, workerId: evaluationIdSchema, fencingToken: sequence.refine(n => n > 0),
  startedAt: evaluationTimeSchema, leaseExpiresAt: evaluationTimeSchema,
  // Binds the nonvolatile execution plan; response metadata stays in the existing E3 result.
  executionPlanFingerprint: scoringFingerprintSchema.extend({ canonicalization: z.literal('pharmaceutical-execution-plan-v2/1') }),
};
export const evaluationFailureSchema = z.object({
  lane: z.enum(['D1', 'D2', 'SCORING', 'OPERATIONAL']),
  code: z.enum(['PROVIDER_FAILURE', 'INVALID_PROVIDER_RESULT', 'EVALUATION_FAILURE', 'SOURCE_INVALID', 'LEASE_EXPIRED', 'INTERNAL_FAILURE']),
}).strict();
export const evaluationAttemptSchema = z.discriminatedUnion('status', [
  z.object({ ...attemptBase, status: z.literal('EVALUATING') }).strict(),
  z.object({ ...attemptBase, status: z.literal('COMPLETED'), completedAt: evaluationTimeSchema,
    result: resultArtifactRefSchema }).strict(),
  z.object({ ...attemptBase, status: z.literal('FAILED'), failedAt: evaluationTimeSchema, failure: evaluationFailureSchema }).strict(),
]);
export const evaluationRecordCoreSchema = z.object({
  schemaVersion: z.literal('2.0'), contractVersion: z.literal(PHARMACEUTICAL_RECORD_VERSION),
  evaluationId: evaluationIdSchema, createdAt: evaluationTimeSchema, revision: sequence,
  intent: evaluationIntentSchema,
  intentFingerprint: scoringFingerprintSchema.extend({ canonicalization: z.literal(PHARMACEUTICAL_INTENT_CANONICALIZATION) }),
  status: z.enum(['PENDING', 'EVALUATING', 'COMPLETED', 'FAILED']),
  attempts: z.array(evaluationAttemptSchema),
}).strict();
export const evaluationRecordSchema = evaluationRecordCoreSchema.extend({
  fingerprint: scoringFingerprintSchema.extend({ canonicalization: z.literal(PHARMACEUTICAL_RECORD_CANONICALIZATION) }),
});
export type PharmaceuticalEvaluationIntentV2 = DeepScoringReadonly<z.infer<typeof evaluationIntentSchema>>;
export type PharmaceuticalEvaluationRecordV2 = DeepScoringReadonly<z.infer<typeof evaluationRecordSchema>>;
export type PharmaceuticalEvaluationAttemptV2 = PharmaceuticalEvaluationRecordV2['attempts'][number];
export type PharmaceuticalEvaluationSourcesV2 = Readonly<{
  contextSource: PharmaceuticalScoringPlanSourceV2;
  context: PharmaceuticalAdjudicationContextSetV2;
  configuration: ReturnType<typeof validatePharmaceuticalScoringConfigurationV2>;
}>;
export type PharmaceuticalEvaluationResultV2 = Awaited<ReturnType<typeof evaluatePharmaceuticalSessionV2>>;
export type PharmaceuticalEvaluationArtifactRefV2 = z.infer<typeof sourceArtifactRefSchema> | z.infer<typeof resultArtifactRefSchema>;
/** Offline resolver must not perform IO; an adapter must fetch protected artifacts before calling P1. */
export type PharmaceuticalEvaluationArtifactResolverV2 = (ref: PharmaceuticalEvaluationArtifactRefV2) => unknown;
