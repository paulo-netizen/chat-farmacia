import { vi } from 'vitest';
import { fixture } from './pharmaceutical-session-pipeline-fixture';
import { evaluatePharmaceuticalSessionV2 } from '../../../lib/cases/v2/evaluate-pharmaceutical-session';
import { pharmaceuticalEvaluationSourceRefV2, pharmaceuticalEvaluationResultRefV2 } from '../../../lib/cases/v2/pharmaceutical-evaluation-artifacts';
import { createPharmaceuticalEvaluationRecordV2, claimPharmaceuticalEvaluationV2 } from '../../../lib/cases/v2/pharmaceutical-evaluation-lifecycle';
import { pharmaceuticalScoringConfigBinding } from '../../../lib/cases/v2/build-pharmaceutical-scoring-policy';
import type { PharmaceuticalD1SemanticBatchRequestV2, PharmaceuticalD1ProviderTargetResultV1 } from '../../../lib/cases/v2/pharmaceutical-d1-adjudication-types';
import type { PharmaceuticalEvaluationIntentV2, PharmaceuticalEvaluationArtifactRefV2 } from '../../../lib/cases/v2/pharmaceutical-evaluation-record-types';

export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const start = '2026-09-20T09:00:00.000Z', end = '2026-09-20T09:01:00.000Z', beforeEnd = '2026-09-20T09:00:59.999Z';
export const worker = { attemptId: uuid(2), workerId: uuid(3), fencingToken: 1, expectedRevision: 1 };
type Options = { empty?: boolean; noD2?: boolean; debt?: boolean; uncertain?: boolean; notScorable?: boolean; finding?: 'UNSUPPORTED' | 'CONTRADICTORY'; d2Failure?: boolean };
export async function recordFixture(o: Options = {}) {
  const f = fixture({ empty: o.empty, notApplicable: o.notScorable ? [0, 1, 2] : undefined });
  let count = 0;
  const allocate = () => `pharm_sem_exec_${uuid(++count)}`;
  const d1 = { adjudicateBatch: vi.fn(async (request: PharmaceuticalD1SemanticBatchRequestV2) => ({
    provider: 'openai' as const, responseModel: 'gpt-5.6-sol', providerResult: {
      schemaVersion: '2.0', contractVersion: 'pharmaceutical-d1-provider-result/1',
      results: request.targets.map((t): PharmaceuticalD1ProviderTargetResultV1 => {
        const c = t.studentCandidates[0], evidence = { messageRef: c.messageRef, excerpt: c.untrustedContent, evidenceKind: c.candidateEvidenceKinds[0] };
        return o.uncertain ? { targetRef: t.targetRef, verdict: 'UNCERTAIN', relatedEvidence: [evidence] }
          : { targetRef: t.targetRef, verdict: 'CORRECTLY_DEMONSTRATED', supportingEvidence: [evidence] };
      }),
    },
  })) };
  const d2 = { detectClaims: vi.fn(async () => {
    if (o.d2Failure) throw new Error('private upstream clinical text');
    return { provider: 'openai' as const, responseModel: 'gpt-5.6-sol', providerResult: { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: o.finding ? [{
      messageRef: '1', excerpt: 'Proposición sintética', occurrenceIndex: 0, domain: 'PROFESSIONAL_RESPONSE', findingType: o.finding, claimForm: 'ASSERTION', relatedClinicalRefs: [],
    }] : [] } };
  }) };
  const sources = { contextSource: f.source.contextSource, context: f.context, configuration: f.config };
  const sourcesRef = pharmaceuticalEvaluationSourceRefV2(sources);
  const c = f.config;
  const runtime = { provider: 'openai' as const, modelPolicyVersion: 'pharmaceutical-semantic-model-policy/1' as const,
    requestedModel: 'gpt-5.6-sol' as const, runtimeVersion: 'P1-SYNTHETIC-TEST-ONLY/1', sdkVersion: 'P1-SYNTHETIC-TEST-ONLY/1',
    maxOutputTokens: 1000, timeoutMs: 1000, retries: 0 as const, fallback: 'NONE' as const, sampling: 'PROVIDER_DEFAULT' as const };
  const intent: PharmaceuticalEvaluationIntentV2 = {
    schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-intent/1', ownerId: uuid(9), sessionId: f.context.sessionId,
    caseVersionId: f.context.caseVersionId, idempotencyKey: uuid(4), supersedesEvaluationId: null,
    transcriptFingerprint: f.context.transcriptFingerprint, sources: sourcesRef,
    configuration: { policy: pharmaceuticalScoringConfigBinding(c.policy), plan: pharmaceuticalScoringConfigBinding(c.plan), weights: pharmaceuticalScoringConfigBinding(c.weights),
      thresholds: pharmaceuticalScoringConfigBinding(c.thresholds), rounding: pharmaceuticalScoringConfigBinding(c.rounding) },
    d1SemanticAcceptance: o.debt ? 'VALIDATION_DEBT' : 'VALIDATED_OFFLINE',
    d2: o.noD2 ? { status: 'NOT_PROVIDED', reason: 'NOT_REQUESTED' } : { status: 'REQUESTED', semanticAcceptance: o.debt ? 'VALIDATION_DEBT' : 'VALIDATED_OFFLINE' },
    executionPlan: { applicationVersion: 'P1-SYNTHETIC-TEST-ONLY/1', scorerVersion: 'P1-SYNTHETIC-TEST-ONLY/1', rulesVersion: 'pharmaceutical-scoring-rules/1',
      d1: o.empty ? { mode: 'NO_CALL', reason: 'NO_SEMANTIC_BATCHES' } : { ...runtime, mode: 'SEMANTIC', promptVersion: 'pharmaceutical-d1-adjudication-prompt/3' },
      d2: o.noD2 ? { mode: 'NO_CALL', reason: 'NOT_REQUESTED' } : o.empty ? { mode: 'NO_CALL', reason: 'EMPTY_STUDENT_MESSAGES' }
        : { ...runtime, mode: 'SEMANTIC', promptVersion: 'pharmaceutical-d2-claim-prompt/5', requestVersion: 'pharmaceutical-d2-semantic-request/2', policyVersion: 'pharmaceutical-d2-claim-policy/1', providerContractVersion: 'pharmaceutical-d2-provider-result/2' },
    },
  };
  const artifacts = new Map<string, unknown>([[sourcesRef.fingerprint.value, sources]]);
  const resolve = (ref: PharmaceuticalEvaluationArtifactRefV2) => artifacts.get(ref.fingerprint.value);
  const pending = createPharmaceuticalEvaluationRecordV2({ evaluationId: uuid(1), createdAt: start, intent }, resolve);
  const claimed = claimPharmaceuticalEvaluationV2(pending, { ...worker, expectedRevision: 0, now: start, leaseExpiresAt: end }, resolve);
  const run = () => evaluatePharmaceuticalSessionV2({ contextSource: sources.contextSource, context: sources.context, configuration: sources.configuration,
    d1SemanticAcceptance: intent.d1SemanticAcceptance, d2: intent.d2 }, { d1, d2, allocateD1ExecutionId: allocate, allocateD2ExecutionId: allocate });
  const result = o.d2Failure ? undefined : await run();
  const resultRef = result ? pharmaceuticalEvaluationResultRefV2(result) : undefined;
  if (resultRef) artifacts.set(resultRef.fingerprint.value, result);
  return { intent, sources, pending, claimed, result, resultRef, artifacts, resolve, d1, d2, run };
}
