import { z } from 'zod';
import { freezeScoring } from './pharmaceutical-scoring-contract-utils';
import {
  PHARMACEUTICAL_INTENT_CANONICALIZATION, PHARMACEUTICAL_RECORD_CANONICALIZATION, PHARMACEUTICAL_RECORD_VERSION,
  evaluationIdSchema, evaluationTimeSchema, evaluationIntentSchema, evaluationRecordSchema, evaluationFailureSchema,
  resultArtifactRefSchema, type PharmaceuticalEvaluationIntentV2, type PharmaceuticalEvaluationRecordV2,
  type PharmaceuticalEvaluationArtifactResolverV2,
} from './pharmaceutical-evaluation-record-types';
import { operationalFingerprint, recordEqual, recordFail, recordGuard, recordParse } from './pharmaceutical-evaluation-record-utils';
import {
  resolvePharmaceuticalEvaluationArtifactV2, validatePharmaceuticalEvaluationSourcesV2,
  validatePharmaceuticalEvaluationSourceBindingsV2, validatePharmaceuticalEvaluationResultV2,
} from './pharmaceutical-evaluation-artifacts';

const revisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const workerSchema = z.object({ attemptId: evaluationIdSchema, workerId: evaluationIdSchema,
  fencingToken: revisionSchema.refine(n => n > 0), expectedRevision: revisionSchema }).strict();
export type PharmaceuticalEvaluationWorkerV2 = z.infer<typeof workerSchema>;

export function pharmaceuticalEvaluationIntentFingerprintV2(intent: unknown) {
  return { ...operationalFingerprint(PHARMACEUTICAL_INTENT_CANONICALIZATION, recordParse(evaluationIntentSchema, intent)),
    canonicalization: PHARMACEUTICAL_INTENT_CANONICALIZATION };
}
function seal(core: Omit<PharmaceuticalEvaluationRecordV2, 'fingerprint'>): PharmaceuticalEvaluationRecordV2 {
  return freezeScoring(recordParse(evaluationRecordSchema, { ...core,
    fingerprint: operationalFingerprint(PHARMACEUTICAL_RECORD_CANONICALIZATION, core) }));
}
function sourcesFor(intent: PharmaceuticalEvaluationIntentV2, resolve: PharmaceuticalEvaluationArtifactResolverV2) {
  const sources = validatePharmaceuticalEvaluationSourcesV2(resolvePharmaceuticalEvaluationArtifactV2(intent.sources, resolve));
  validatePharmaceuticalEvaluationSourceBindingsV2(intent, sources);
  return sources;
}

/** Read-side validation. Hashes are integrity, not writer authentication; E1's witness gate is untouched. */
export function validatePharmaceuticalEvaluationRecordV2(value: unknown, resolve: PharmaceuticalEvaluationArtifactResolverV2): PharmaceuticalEvaluationRecordV2 {
  return recordGuard('INVALID_RECORD', () => {
    const record = recordParse(evaluationRecordSchema, value);
    const { fingerprint, ...core } = record;
    recordEqual(fingerprint, operationalFingerprint(PHARMACEUTICAL_RECORD_CANONICALIZATION, core), 'INTEGRITY_MISMATCH');
    recordEqual(record.intentFingerprint, pharmaceuticalEvaluationIntentFingerprintV2(record.intent), 'INTEGRITY_MISMATCH');
    if (record.intent.supersedesEvaluationId === record.evaluationId) recordFail('INVALID_RECORD');
    const sources = sourcesFor(record.intent, resolve);
    const ids = new Set<string>();
    let previousEnd = record.createdAt;
    record.attempts.forEach((a, index) => {
      if (ids.has(a.attemptId) || a.fencingToken !== index + 1 || a.startedAt < previousEnd || a.leaseExpiresAt <= a.startedAt) recordFail('INVALID_RECORD');
      ids.add(a.attemptId);
      recordEqual(a.executionPlanFingerprint, operationalFingerprint('pharmaceutical-execution-plan-v2/1', record.intent.executionPlan));
      if (index < record.attempts.length - 1 && a.status !== 'FAILED') recordFail('INVALID_RECORD');
      if (a.status === 'COMPLETED') {
        if (a.completedAt < a.startedAt || a.completedAt >= a.leaseExpiresAt) recordFail('INVALID_RECORD');
        validatePharmaceuticalEvaluationResultV2(resolvePharmaceuticalEvaluationArtifactV2(a.result, resolve), sources, record.intent);
        previousEnd = a.completedAt;
      } else if (a.status === 'FAILED') {
        if (a.failedAt < a.startedAt) recordFail('INVALID_RECORD');
        if (a.failure.code === 'LEASE_EXPIRED') {
          if (a.failure.lane !== 'OPERATIONAL' || a.failedAt < a.leaseExpiresAt) recordFail('INVALID_RECORD');
        } else if (a.failedAt >= a.leaseExpiresAt) recordFail('INVALID_RECORD');
        if (a.failure.lane === 'D2' && record.intent.d2.status !== 'REQUESTED') recordFail('INVALID_RECORD');
        previousEnd = a.failedAt;
      }
    });
    const last = record.attempts.at(-1);
    if (record.status !== (last?.status ?? 'PENDING') || record.revision !== (last ? record.attempts.length * 2 - (last.status === 'EVALUATING' ? 1 : 0) : 0)) recordFail('INVALID_RECORD');
    return freezeScoring(record);
  });
}

/** Caller/adapter must authorize creation and reevaluation. IDs/time have no implicit defaults. */
export function createPharmaceuticalEvaluationRecordV2(input: {
  evaluationId: string; createdAt: string; intent: unknown;
  existing?: PharmaceuticalEvaluationRecordV2; previous?: PharmaceuticalEvaluationRecordV2;
}, resolve: PharmaceuticalEvaluationArtifactResolverV2): PharmaceuticalEvaluationRecordV2 {
  return recordGuard('INVALID_RECORD', () => {
    const id = recordParse(evaluationIdSchema, input.evaluationId), at = recordParse(evaluationTimeSchema, input.createdAt);
    const intent = recordParse(evaluationIntentSchema, input.intent);
    sourcesFor(intent, resolve);
    if (input.existing) {
      const existing = validatePharmaceuticalEvaluationRecordV2(input.existing, resolve);
      recordEqual(existing.intent, intent, 'IDEMPOTENCY_CONFLICT');
      return existing; // Time/newly allocated IDs do not change the stable intent.
    }
    if (intent.supersedesEvaluationId !== null) {
      if (!input.previous) recordFail('MISSING_ARTIFACT');
      const previous = validatePharmaceuticalEvaluationRecordV2(input.previous, resolve);
      if (previous.evaluationId !== intent.supersedesEvaluationId || previous.evaluationId === id ||
        previous.intent.ownerId !== intent.ownerId || previous.intent.sessionId !== intent.sessionId || previous.intent.caseVersionId !== intent.caseVersionId ||
        previous.intent.idempotencyKey === intent.idempotencyKey || !['COMPLETED', 'FAILED'].includes(previous.status)) recordFail('BINDING_MISMATCH');
      const last = previous.attempts.at(-1);
      const end = last?.status === 'COMPLETED' ? last.completedAt : last?.status === 'FAILED' ? last.failedAt : previous.createdAt;
      if (at < end) recordFail('INVALID_TRANSITION');
    } else if (input.previous) recordFail('BINDING_MISMATCH');
    return seal({ schemaVersion: '2.0', contractVersion: PHARMACEUTICAL_RECORD_VERSION, evaluationId: id, createdAt: at,
      intent, intentFingerprint: pharmaceuticalEvaluationIntentFingerprintV2(intent), revision: 0, status: 'PENDING', attempts: [] });
  });
}

/** Pure CAS proposal only: adapter must atomically compare revision/token and commit this returned state. */
export function claimPharmaceuticalEvaluationV2(value: unknown, input: PharmaceuticalEvaluationWorkerV2 & { now: string; leaseExpiresAt: string }, resolve: PharmaceuticalEvaluationArtifactResolverV2) {
  return recordGuard('INVALID_RECORD', () => {
    const { now, leaseExpiresAt, ...workerInput } = input;
    const worker = recordParse(workerSchema, workerInput);
    recordParse(evaluationTimeSchema, now); recordParse(evaluationTimeSchema, leaseExpiresAt);
    const record = validatePharmaceuticalEvaluationRecordV2(value, resolve), last = record.attempts.at(-1);
    if (leaseExpiresAt <= now || now < record.createdAt) recordFail('INVALID_TRANSITION');
    if (last?.status === 'EVALUATING') {
      if (now >= last.leaseExpiresAt) recordFail('LEASE_EXPIRED');
      recordEqual([worker.attemptId, worker.workerId, worker.fencingToken, now, leaseExpiresAt, worker.expectedRevision],
        [last.attemptId, last.workerId, last.fencingToken, last.startedAt, last.leaseExpiresAt, record.revision - 1], 'STALE_WORKER');
      return record;
    }
    if (!['PENDING', 'FAILED'].includes(record.status)) recordFail('INVALID_TRANSITION');
    if (worker.expectedRevision !== record.revision || worker.fencingToken !== record.attempts.length + 1 || record.attempts.some(a => a.attemptId === worker.attemptId)) recordFail('STALE_WORKER');
    if (last?.status === 'FAILED' && now < last.failedAt) recordFail('INVALID_TRANSITION');
    const { fingerprint: _fingerprint, ...core } = record;
    return seal({ ...core, revision: core.revision + 1, status: 'EVALUATING', attempts: [...core.attempts, {
      attemptId: worker.attemptId, workerId: worker.workerId, fencingToken: worker.fencingToken,
      startedAt: now, leaseExpiresAt, status: 'EVALUATING',
      executionPlanFingerprint: { ...operationalFingerprint('pharmaceutical-execution-plan-v2/1', core.intent.executionPlan), canonicalization: 'pharmaceutical-execution-plan-v2/1' },
    }] });
  });
}
function assertWorker(record: PharmaceuticalEvaluationRecordV2, input: PharmaceuticalEvaluationWorkerV2, repeated: boolean) {
  const w = recordParse(workerSchema, input), last = record.attempts.at(-1);
  if (!last || w.attemptId !== last.attemptId || w.workerId !== last.workerId || w.fencingToken !== last.fencingToken ||
    w.expectedRevision !== record.revision - (repeated ? 1 : 0)) recordFail('STALE_WORKER');
  return last;
}
export function completePharmaceuticalEvaluationV2(value: unknown, worker: PharmaceuticalEvaluationWorkerV2, now: string,
  resultRef: unknown, resolve: PharmaceuticalEvaluationArtifactResolverV2) {
  return recordGuard('INVALID_RECORD', () => {
    const time = recordParse(evaluationTimeSchema, now), result = recordParse(resultArtifactRefSchema, resultRef);
    const record = validatePharmaceuticalEvaluationRecordV2(value, resolve);
    const last = assertWorker(record, worker, record.status === 'COMPLETED');
    if (last.status === 'COMPLETED') {
      recordEqual(last.result, result, 'COMPLETION_CONFLICT');
      if (time < last.completedAt) recordFail('INVALID_TRANSITION');
      return record; // Compatible replay of a committed write, not another semantic call.
    }
    if (last.status !== 'EVALUATING') recordFail('INVALID_TRANSITION');
    if (time >= last.leaseExpiresAt) recordFail('LEASE_EXPIRED');
    if (time < last.startedAt) recordFail('INVALID_TRANSITION');
    validatePharmaceuticalEvaluationResultV2(resolvePharmaceuticalEvaluationArtifactV2(result, resolve), sourcesFor(record.intent, resolve), record.intent);
    const { fingerprint: _fingerprint, ...core } = record;
    return seal({ ...core, revision: core.revision + 1, status: 'COMPLETED',
      attempts: [...core.attempts.slice(0, -1), { ...last, status: 'COMPLETED', completedAt: time, result }] });
  });
}
export function failPharmaceuticalEvaluationV2(value: unknown, worker: PharmaceuticalEvaluationWorkerV2, now: string,
  failureInput: unknown, resolve: PharmaceuticalEvaluationArtifactResolverV2) {
  return recordGuard('INVALID_RECORD', () => {
    const time = recordParse(evaluationTimeSchema, now), failure = recordParse(evaluationFailureSchema, failureInput);
    const record = validatePharmaceuticalEvaluationRecordV2(value, resolve), last = assertWorker(record, worker, false);
    if (last.status !== 'EVALUATING' || time < last.startedAt || failure.code === 'LEASE_EXPIRED') recordFail('INVALID_TRANSITION');
    if (time >= last.leaseExpiresAt) recordFail('LEASE_EXPIRED');
    if (failure.lane === 'D2' && record.intent.d2.status !== 'REQUESTED') recordFail('INVALID_TRANSITION');
    const { fingerprint: _fingerprint, ...core } = record;
    return seal({ ...core, revision: core.revision + 1, status: 'FAILED',
      attempts: [...core.attempts.slice(0, -1), { ...last, status: 'FAILED', failedAt: time, failure }] });
  });
}
/** Recovery closes the expired attempt only; a later explicit claim never invokes a runtime. */
export function expirePharmaceuticalEvaluationV2(value: unknown, worker: PharmaceuticalEvaluationWorkerV2, now: string,
  resolve: PharmaceuticalEvaluationArtifactResolverV2) {
  return recordGuard('INVALID_RECORD', () => {
    const time = recordParse(evaluationTimeSchema, now), record = validatePharmaceuticalEvaluationRecordV2(value, resolve);
    const last = assertWorker(record, worker, false);
    if (last.status !== 'EVALUATING' || time < last.leaseExpiresAt) recordFail('INVALID_TRANSITION');
    const { fingerprint: _fingerprint, ...core } = record;
    return seal({ ...core, revision: core.revision + 1, status: 'FAILED', attempts: [...core.attempts.slice(0, -1), {
      ...last, status: 'FAILED', failedAt: time, failure: { lane: 'OPERATIONAL', code: 'LEASE_EXPIRED' },
    }] });
  });
}
