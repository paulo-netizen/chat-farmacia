import { describe, expect, it } from 'vitest';
import { recordFixture, uuid, start, end, beforeEnd, worker } from './support/pharmaceutical-evaluation-record-fixture';
import {
  createPharmaceuticalEvaluationRecordV2 as create, claimPharmaceuticalEvaluationV2 as claim,
  completePharmaceuticalEvaluationV2 as complete, failPharmaceuticalEvaluationV2 as fail,
  expirePharmaceuticalEvaluationV2 as expire, validatePharmaceuticalEvaluationRecordV2 as validate,
  pharmaceuticalEvaluationIntentFingerprintV2 as intentHash,
} from '../../lib/cases/v2/pharmaceutical-evaluation-lifecycle';
import { operationalFingerprint, PharmaceuticalEvaluationRecordError } from '../../lib/cases/v2/pharmaceutical-evaluation-record-utils';
import { pharmaceuticalEvaluationResultRefV2, pharmaceuticalEvaluationSourceRefV2 } from '../../lib/cases/v2/pharmaceutical-evaluation-artifacts';
import { PHARMACEUTICAL_RECORD_CANONICALIZATION } from '../../lib/cases/v2/pharmaceutical-evaluation-record-types';
import { scoringFingerprint } from '../../lib/cases/v2/pharmaceutical-scoring-contract-utils';

function reseal<T extends { fingerprint: unknown }>(record: T) {
  const { fingerprint: _f, ...core } = record;
  return { ...core, fingerprint: operationalFingerprint(PHARMACEUTICAL_RECORD_CANONICALIZATION, core) };
}
const failure = { lane: 'D2', code: 'PROVIDER_FAILURE' };
describe('P1 immutable pharmaceutical record: pure, offline and non-academic', () => {
  it('composes real E3 with fake runtimes, validates receipt and keeps every output unchanged', async () => {
    const f = await recordFixture(), before = structuredClone(f.claimed);
    const done = complete(f.claimed, worker, beforeEnd, f.resultRef, f.resolve);
    expect(validate(done, f.resolve)).toEqual(done);
    expect(f.claimed).toEqual(before); expect(f.claimed.status).toBe('EVALUATING');
    expect(done.status).toBe('COMPLETED'); expect(Object.isFrozen(done.attempts)).toBe(true);
    expect(f.result?.score.result.status).toBe('SCORED');
    expect(f.d2.detectClaims).toHaveBeenCalledTimes(1);
    expect(f.d1.adjudicateBatch.mock.calls.length).toBeGreaterThan(0);
  });
  it('stable intent excludes creation/attempt IDs, time and tokens', async () => {
    const f = await recordFixture();
    const same = create({ evaluationId: uuid(20), createdAt: end, intent: f.intent, existing: f.claimed }, f.resolve);
    expect(same).toEqual(f.claimed);
    expect(f.pending.intentFingerprint).toEqual(f.claimed.intentFingerprint);
    expect(intentHash({ ...f.intent, executionPlan: { ...f.intent.executionPlan, scorerVersion: 'another/1' } })).not.toEqual(f.pending.intentFingerprint);
  });
  it('canonical key order is deterministic and array order remains material', async () => {
    const f = await recordFixture();
    expect(intentHash(Object.fromEntries(Object.entries(f.intent).reverse()))).toEqual(intentHash(f.intent));
    expect(operationalFingerprint('test/1', ['a', 'b'])).not.toEqual(operationalFingerprint('test/1', ['b', 'a']));
  });
  it.each(['ownerId', 'sessionId', 'caseVersionId', 'idempotencyKey'] as const)('rejects incompatible %s', async key => {
    const f = await recordFixture();
    expect(() => create({ evaluationId: uuid(20), createdAt: start, intent: { ...f.intent, [key]: uuid(25) }, existing: f.pending }, f.resolve)).toThrow(PharmaceuticalEvaluationRecordError);
  });
  it('same idempotency key with new acceptance disposition is a conflict', async () => {
    const f = await recordFixture();
    expect(() => create({ evaluationId: uuid(20), createdAt: start, intent: { ...f.intent, d1SemanticAcceptance: 'LIVE_ACCEPTED' }, existing: f.pending }, f.resolve))
      .toThrow('IDEMPOTENCY_CONFLICT');
  });
  it('claim redelivery is idempotent but another worker cannot claim', async () => {
    const f = await recordFixture();
    expect(claim(f.claimed, { ...worker, expectedRevision: 0, now: start, leaseExpiresAt: end }, f.resolve)).toEqual(f.claimed);
    expect(() => claim(f.claimed, { ...worker, workerId: uuid(30), expectedRevision: 0, now: start, leaseExpiresAt: end }, f.resolve)).toThrow('STALE_WORKER');
  });
  it.each(['attemptId', 'workerId', 'fencingToken', 'expectedRevision'] as const)('rejects stale %s', async key => {
    const f = await recordFixture(), changed = { ...worker, [key]: key.endsWith('Id') ? uuid(30) : 50 };
    expect(() => complete(f.claimed, changed, beforeEnd, f.resultRef, f.resolve)).toThrow('STALE_WORKER');
  });
  it('completion repeated with same result is idempotent even after expiry', async () => {
    const f = await recordFixture(), done = complete(f.claimed, worker, beforeEnd, f.resultRef, f.resolve);
    expect(complete(done, worker, end, f.resultRef, f.resolve)).toEqual(done);
    const bad = { ...f.resultRef, fingerprint: { ...f.resultRef?.fingerprint, value: 'a'.repeat(64) } };
    expect(() => complete(done, worker, end, bad, f.resolve)).toThrow('COMPLETION_CONFLICT');
  });
  it.each([end, '2026-09-20T09:01:00.001Z'])('completion at/after expiry fails: %s', async now => {
    const f = await recordFixture(); expect(() => complete(f.claimed, worker, now, f.resultRef, f.resolve)).toThrow('LEASE_EXPIRED');
  });
  it('expiry rejects before boundary and recovery retains prior attempts', async () => {
    const f = await recordFixture();
    expect(() => expire(f.claimed, worker, beforeEnd, f.resolve)).toThrow('INVALID_TRANSITION');
    const expired = expire(f.claimed, worker, end, f.resolve);
    expect(expired.attempts[0]).toMatchObject({ status: 'FAILED', failure: { code: 'LEASE_EXPIRED' } });
    const next = claim(expired, { attemptId: uuid(5), workerId: uuid(6), fencingToken: 2, expectedRevision: 2, now: end, leaseExpiresAt: '2026-09-20T09:02:00.000Z' }, f.resolve);
    expect(next.attempts[0]).toEqual(expired.attempts[0]); expect(next.intentFingerprint).toEqual(expired.intentFingerprint);
    expect(() => complete(next, worker, end, f.resultRef, f.resolve)).toThrow('STALE_WORKER');
    expect(validate(next, f.resolve)).toEqual(next);
    expect(f.d2.detectClaims).toHaveBeenCalledTimes(1); // Transitions never run a model.
  });
  it('race simulation: two claims require future adapter CAS, stale proposal fails against current state', async () => {
    const f = await recordFixture();
    const rival = { ...worker, attemptId: uuid(50), workerId: uuid(51), expectedRevision: 0, now: start, leaseExpiresAt: end };
    expect(claim(f.pending, rival, f.resolve).revision).toBe(f.claimed.revision);
    expect(() => claim(f.claimed, rival, f.resolve)).toThrow('STALE_WORKER');
  });
  it.each(['2026-09-20T08:59:59.999Z', '2026-09-20T09:00:00', '2026-02-30T09:00:00.000Z'])('rejects invalid/backwards time %s', async now => {
    const f = await recordFixture(); expect(() => complete(f.claimed, worker, now, f.resultRef, f.resolve)).toThrow();
  });
  it('requires positive lease and monotonic explicit fencing', async () => {
    const f = await recordFixture();
    expect(() => claim(f.pending, { ...worker, expectedRevision: 0, now: start, leaseExpiresAt: start }, f.resolve)).toThrow();
    expect(() => claim(f.pending, { ...worker, expectedRevision: 0, fencingToken: 2, now: start, leaseExpiresAt: end }, f.resolve)).toThrow('STALE_WORKER');
  });
  it('failure contains no fabricated result and cannot subsequently complete', async () => {
    const f = await recordFixture(), failed = fail(f.claimed, worker, beforeEnd, failure, f.resolve);
    expect(validate(failed, f.resolve)).toEqual(failed);
    expect(JSON.stringify(failed)).not.toContain('"result":');
    expect(() => complete(failed, { ...worker, expectedRevision: 2 }, beforeEnd, f.resultRef, f.resolve)).toThrow('INVALID_TRANSITION');
    expect(() => fail(f.claimed, worker, end, failure, f.resolve)).toThrow('LEASE_EXPIRED');
  });
  it('a real E3 D2 failure is recorded as FAILED, not empty PROVIDED', async () => {
    const f = await recordFixture({ d2Failure: true });
    await expect(f.run()).rejects.toMatchObject({ code: 'PROVIDER_FAILURE' });
    const failed = fail(f.claimed, worker, beforeEnd, failure, f.resolve);
    expect(failed.status).toBe('FAILED'); expect(f.result).toBeUndefined();
    expect(JSON.stringify(failed)).not.toContain('private upstream');
  });
  it.each([{ noD2: true }, {}, { empty: true }])('preserves no D2, legitimately empty and zero-call routes: %j', async options => {
    const f = await recordFixture(options), done = complete(f.claimed, worker, beforeEnd, f.resultRef, f.resolve);
    expect(validate(done, f.resolve)).toEqual(done);
    expect(f.result?.d2.status).toBe('noD2' in options ? 'NOT_PROVIDED' : 'PROVIDED');
    if ('empty' in options || 'noD2' in options) expect(f.d2.detectClaims).not.toHaveBeenCalled();
    if ('empty' in options) expect(f.d1.adjudicateBatch).not.toHaveBeenCalled();
  });
  it.each([{ debt: true }, { uncertain: true }, { notScorable: true }, { finding: 'UNSUPPORTED' as const }, { finding: 'CONTRADICTORY' as const }])('preserves non-academic score and review states: %j', async options => {
    const f = await recordFixture(options), done = complete(f.claimed, worker, beforeEnd, f.resultRef, f.resolve);
    expect(validate(done, f.resolve)).toEqual(done);
    expect(f.result?.score.result.status).toBe('notScorable' in options ? 'NOT_SCORABLE' : 'PROVISIONAL_REVIEW_REQUIRED');
  });
  it('reevaluation is another intent without overwriting previous completion', async () => {
    const f = await recordFixture(), done = complete(f.claimed, worker, beforeEnd, f.resultRef, f.resolve), before = structuredClone(done);
    const intent = { ...f.intent, idempotencyKey: uuid(60), supersedesEvaluationId: done.evaluationId };
    expect(() => create({ evaluationId: uuid(61), createdAt: end, intent }, f.resolve)).toThrow('MISSING_ARTIFACT');
    const next = create({ evaluationId: uuid(61), createdAt: end, intent, previous: done }, f.resolve);
    expect(next.status).toBe('PENDING'); expect(next.intentFingerprint).not.toEqual(done.intentFingerprint); expect(done).toEqual(before);
    expect(() => claim(done, { ...worker, expectedRevision: 2, now: end, leaseExpiresAt: '2026-09-20T09:02:00.000Z' }, f.resolve)).toThrow('INVALID_TRANSITION');
  });
  it('clones and freezes without freezing caller objects', async () => {
    const f = await recordFixture();
    expect(Object.isFrozen(f.sources)).toBe(false);
    expect(Reflect.set(f.pending.intent, 'ownerId', 'wrong')).toBe(false);
    expect(Reflect.set(f.claimed.attempts, '0', {})).toBe(false);
    expect(f.sources.context.sessionId).toBe(f.intent.sessionId);
  });
  it('fails on missing/corrupt source and missing result', async () => {
    const f = await recordFixture();
    expect(() => validate(f.pending, () => undefined)).toThrow('MISSING_ARTIFACT');
    expect(() => validate(f.pending, () => ({ ...f.sources, context: {} }))).toThrow('INTEGRITY_MISMATCH');
    if (f.resultRef) f.artifacts.delete(f.resultRef.fingerprint.value);
    expect(() => complete(f.claimed, worker, beforeEnd, f.resultRef, f.resolve)).toThrow('MISSING_ARTIFACT');
  });
  it.each(['schemaVersion', 'contractVersion', 'status', 'revision', 'createdAt', 'fingerprint'])('rejects altered record %s', async field => {
    const f = await recordFixture(); expect(() => validate({ ...f.pending, [field]: 'private-content' }, f.resolve)).toThrow();
  });
  it('rejects unknown/extra fields even with coherent outer hash', async () => {
    const f = await recordFixture();
    expect(() => validate({ ...f.pending, providerResult: 'private-content' }, f.resolve)).toThrow('INVALID_RECORD');
    expect(() => validate(reseal({ ...f.pending, status: 'COMPLETED' }), f.resolve)).toThrow('INVALID_RECORD');
    expect(() => validate(reseal({ ...f.claimed, attempts: [{ ...f.claimed.attempts[0], fencingToken: 2 }] }), f.resolve)).toThrow('INVALID_RECORD');
  });
  it('unknown artifact version and malformed metadata fail closed', async () => {
    const f = await recordFixture();
    expect(() => create({ evaluationId: uuid(1), createdAt: start, intent: { ...f.intent, sources: { ...f.intent.sources, contractVersion: 'future/2' } } }, f.resolve)).toThrow();
    expect(() => create({ evaluationId: uuid(1), createdAt: start, intent: { ...f.intent, executionPlan: { ...f.intent.executionPlan, applicationVersion: undefined } } }, f.resolve)).toThrow();
    expect(() => create({ evaluationId: uuid(1), createdAt: start, intent: { ...f.intent, executionPlan: { ...f.intent.executionPlan, d1: { mode: 'NO_CALL', reason: 'NO_SEMANTIC_BATCHES' } } } }, f.resolve)).toThrow();
  });
  it('missing requested model is not inferred from responseModel', async () => {
    const f = await recordFixture();
    expect(() => create({ evaluationId: uuid(1), createdAt: start, intent: { ...f.intent, executionPlan: { ...f.intent.executionPlan, d1: { ...f.intent.executionPlan.d1, requestedModel: undefined } } } }, f.resolve)).toThrow();
  });
  it('cannot raise acceptance by successful structural validation', async () => {
    const f = await recordFixture({ debt: true });
    const intent = { ...f.intent, d1SemanticAcceptance: 'LIVE_ACCEPTED', d2: { status: 'REQUESTED', semanticAcceptance: 'LIVE_ACCEPTED' } };
    const pending = create({ evaluationId: uuid(1), createdAt: start, intent }, f.resolve);
    const claimed = claim(pending, { ...worker, expectedRevision: 0, now: start, leaseExpiresAt: end }, f.resolve);
    expect(() => complete(claimed, worker, beforeEnd, f.resultRef, f.resolve)).toThrow('BINDING_MISMATCH');
  });
  it('source/ref changes cannot bypass existing transcript/configuration bindings', async () => {
    const f = await recordFixture();
    const other = await recordFixture({ notScorable: true });
    const otherRef = pharmaceuticalEvaluationSourceRefV2(other.sources);
    f.artifacts.set(otherRef.fingerprint.value, other.sources);
    expect(() => create({ evaluationId: uuid(1), createdAt: start, intent: { ...f.intent, sources: otherRef } }, f.resolve)).toThrow('BINDING_MISMATCH');
  });
  it('rejects corrupted result payload rather than silently repairing it', async () => {
    const f = await recordFixture();
    if (!f.result || !f.resultRef) throw new Error('fixture requires result');
    f.artifacts.set(f.resultRef.fingerprint.value, { ...f.result, score: {} });
    expect(() => complete(f.claimed, worker, beforeEnd, f.resultRef, f.resolve)).toThrow('INTEGRITY_MISMATCH');
    const invalid = { ...f.result, score: { ...f.result.score, receipt: { ...f.result.score.receipt, sources: { ...f.result.score.receipt.sources, sessionId: uuid(99) } } } };
    const ref = pharmaceuticalEvaluationResultRefV2(invalid); f.artifacts.set(ref.fingerprint.value, invalid);
    expect(() => complete(f.claimed, worker, beforeEnd, ref, f.resolve)).toThrow('BINDING_MISMATCH');
  });
  it('errors do not disclose upstream exceptions, arbitrary property names or clinical values', async () => {
    const f = await recordFixture();
    for (const action of [() => validate(f.pending, () => { throw new Error('SECRET clinical text'); }),
      () => validate({ ...f.pending, 'SECRET clinical text': 'SECRET' }, f.resolve),
      () => fail(f.claimed, worker, beforeEnd, { ...failure, message: 'SECRET' }, f.resolve)]) {
      try { action(); throw new Error('expected rejection'); } catch (error) {
        expect(error).toBeInstanceOf(PharmaceuticalEvaluationRecordError);
        expect(String(error)).not.toContain('SECRET'); expect(JSON.stringify(error)).not.toContain('SECRET');
      }
    }
  });
  it.each(['0', '-1', 'NaN'])('rejects structurally invalid possible %s even after coherent rehash', async numerator => {
    const f = await recordFixture();
    if (!f.result || f.result.score.result.status !== 'SCORED') throw new Error('scored fixture required');
    const result = { ...f.result.score.result, possible: { numerator, denominator: '1' } };
    const fingerprint = scoringFingerprint('pharmaceutical-session-score-v2/1', result);
    const altered = { ...f.result, score: { ...f.result.score, result, fingerprint, receipt: { ...f.result.score.receipt, resultFingerprint: fingerprint } } };
    const ref = pharmaceuticalEvaluationResultRefV2(altered); f.artifacts.set(ref.fingerprint.value, altered);
    expect(() => complete(f.claimed, worker, beforeEnd, ref, f.resolve)).toThrow();
  });
  it('does not certify score arithmetic or authenticate an author able to rewrite coherent hashes', async () => {
    const f = await recordFixture();
    if (!f.result || f.result.score.result.status !== 'SCORED') throw new Error('scored fixture required');
    const result = { ...f.result.score.result, possible: { numerator: '999999', denominator: '1' } };
    const fingerprint = scoringFingerprint('pharmaceutical-session-score-v2/1', result);
    const altered = { ...f.result, score: { ...f.result.score, result, fingerprint, receipt: { ...f.result.score.receipt, resultFingerprint: fingerprint } } };
    const ref = pharmaceuticalEvaluationResultRefV2(altered); f.artifacts.set(ref.fingerprint.value, altered);
    expect(complete(f.claimed, worker, beforeEnd, ref, f.resolve).status).toBe('COMPLETED');
    expect(altered.score.result.possible.numerator).toBe('999999'); // No normalization/repair.
  });
  it('rejects witness/raw additions to artifact envelopes without persisting them', async () => {
    const f = await recordFixture();
    const alteredSources = { ...f.sources, contextSource: {
      ...f.sources.contextSource, patientRuntime: { ...f.sources.contextSource.patientRuntime, rawProviderResponse: 'private' },
    } };
    expect(() => pharmaceuticalEvaluationSourceRefV2(alteredSources)).toThrow();
    if (!f.result) throw new Error('result required');
    const altered = { ...f.result, witnesses: { rawProviderResponse: 'private' } };
    const ref = pharmaceuticalEvaluationResultRefV2(altered); f.artifacts.set(ref.fingerprint.value, altered);
    expect(() => complete(f.claimed, worker, beforeEnd, ref, f.resolve)).toThrow();
  });
  it('failed attempts cannot contain a result even when the record hash is recomputed', async () => {
    const f = await recordFixture(), failed = fail(f.claimed, worker, beforeEnd, failure, f.resolve);
    const altered = { ...failed, attempts: failed.attempts.map(a => ({ ...a, result: f.resultRef })) };
    expect(() => validate(reseal(altered), f.resolve)).toThrow('INVALID_RECORD');
  });
});
