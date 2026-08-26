import { describe, expect, it } from 'vitest';

import { buildSpfaScoringContextV2 } from '@/lib/cases/v2/build-spfa-scoring-context';
import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import {
  assertSameSpfaEvaluationSnapshotIdentityV2,
  assertSpfaEvaluationLifecycleTransitionV2,
  canRecoverSpfaEvaluationV2,
  canRetryFailedSpfaEvaluationV2,
  decideSpfaEvaluationClaimV2,
  isSpfaEvaluationLeaseExpiredV2,
  SpfaEvaluationLifecycleTransitionError,
} from '@/lib/cases/v2/spfa-evaluation-lifecycle';
import type {
  SpfaEvaluationLifecycleCompletionValidationContextV2,
  SpfaEvaluationLifecycleV2,
  SpfaEvaluationSnapshotIdentityV2,
} from '@/lib/cases/v2/spfa-evaluation-lifecycle-types';
import { scoreSpfaSessionV2 } from '@/lib/cases/v2/score-spfa-session';
import type { BoundSpfaInformationTargetV2 } from '@/lib/cases/v2/spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import { SPFA_SCORING_POLICY_V2_2026_1 } from '@/lib/cases/v2/spfa-scoring-policy-v2';
import type { SpfaProtocolDefinitionV2 } from '@/lib/cases/v2/spfa-protocol-types';
import type { SpfaSessionEvaluationV2 } from '@/lib/cases/v2/spfa-session-evaluation-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import {
  SpfaEvaluationLifecycleValidationError,
  validateSpfaEvaluationAttemptIdV2,
  validateSpfaEvaluationFreezePreconditionsV2,
  validateSpfaEvaluationLifecycleV2,
  validateSpfaEvaluationSnapshotIdentityV2,
  validateSpfaEvaluationTimestampV2,
} from '@/lib/cases/v2/validate-spfa-evaluation-lifecycle';
import { validateSpfaProtocolIdV2, validateSpfaProtocolRequirementIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = validateCaseVersionId('casever_20000000-0000-4000-8000-000000000001');
const attempt1 = validateSpfaEvaluationAttemptIdV2('spfa_eval_attempt_30000000-0000-4000-8000-000000000001');
const attempt2 = validateSpfaEvaluationAttemptIdV2('spfa_eval_attempt_30000000-0000-4000-8000-000000000002');
const spfaRef = 'conclusion_40000000-0000-4000-8000-000000000001' as ConclusionId;
const protocolId = validateSpfaProtocolIdV2('spfa_protocol_50000000-0000-4000-8000-000000000001');
const requirementId = validateSpfaProtocolRequirementIdV2('spfa_requirement_60000000-0000-4000-8000-000000000001');
const targetId = validateSpfaRequirementTargetIdV2('spfa_target_70000000-0000-4000-8000-000000000001');
const startedAt = '2026-08-25T09:00:00.000Z';
const leaseExpiresAt = '2026-08-25T09:05:00.000Z';
const afterExpiry = '2026-08-25T09:06:00.000Z';
const retryPolicy = { allowFailedRetry: true } as const;

function nonEmpty<T>(values: readonly T[]): NonEmptyArray<T> {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('fixture collection must be non-empty');
  return [first, ...rest];
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function completedFixture(): {
  snapshotIdentity: SpfaEvaluationSnapshotIdentityV2;
  payload: { evaluation: SpfaSessionEvaluationV2; score: ReturnType<typeof scoreSpfaSessionV2> };
  context: SpfaEvaluationLifecycleCompletionValidationContextV2;
} {
  const transcript = createSessionTranscriptSnapshotV2({ sessionId, caseVersionId, messages: [] });
  const informationTarget: BoundSpfaInformationTargetV2 = {
    targetId,
    target: { kind: 'PUBLIC_PROFILE', field: 'age' },
  };
  const application = {
    schemaVersion: '2.0' as const,
    caseVersionId,
    carePathSpfaRef: spfaRef,
    protocolRef: { protocolId, version: '1.0.0' },
    requirements: nonEmpty([{
      kind: 'INFORMATION_REQUIREMENT' as const,
      requirementRef: requirementId,
      applicability: { status: 'APPLICABLE' as const, effectiveImportance: 'RELEVANT' as const },
      informationTargets: nonEmpty([informationTarget]),
    }]),
  };
  const definition: SpfaProtocolDefinitionV2 = {
    schemaVersion: '2.0',
    protocolId,
    version: '1.0.0',
    service: 'pharmaceutical_indication',
    requirements: nonEmpty([{
      kind: 'INFORMATION_REQUIREMENT',
      requirementId,
      teacherLabel: 'Demanda',
      description: 'Explora la demanda',
      defaultImportance: 'RELEVANT',
      safetyCriticality: { safetyCritical: false },
      applicability: { kind: 'ALWAYS' },
      semanticDomain: { kind: 'patient_information', disclosureDomain: 'symptoms' },
      informationGoal: 'Conocer la demanda',
    }]),
  };
  const protocolSet: CaseSpfaProtocolSetV2 = {
    schemaVersion: '2.0',
    catalogRef: { id: 'spfa-protocol-catalog', version: '2026.1' },
    definitions: nonEmpty([definition]),
    applications: nonEmpty([application]),
  };
  const evaluation: SpfaSessionEvaluationV2 = {
    schemaVersion: '2.0',
    sessionId,
    caseVersionId,
    protocolCatalogRef: { ...protocolSet.catalogRef },
    transcriptFingerprint: transcript.fingerprint,
    applications: nonEmpty([{
      carePathSpfaRef: spfaRef,
      protocolRef: { ...application.protocolRef },
      requirementResults: nonEmpty([{
        schemaVersion: '2.0',
        sessionId,
        caseVersionId,
        transcriptFingerprint: transcript.fingerprint,
        carePathSpfaRef: spfaRef,
        requirementRef: requirementId,
        kind: 'INFORMATION_REQUIREMENT',
        coverage: {
          status: 'COVERED',
          origin: 'PUBLIC_INFORMATION',
          coveredTargetRefs: nonEmpty([targetId]),
          evidence: nonEmpty([{ source: 'PUBLIC_INFORMATION', targetRef: targetId }]),
        },
      }]),
    }]),
    semanticExecutions: [],
  };
  const scoringContext = buildSpfaScoringContextV2(evaluation, protocolSet);
  const score = scoreSpfaSessionV2(scoringContext, SPFA_SCORING_POLICY_V2_2026_1);
  const snapshotIdentity: SpfaEvaluationSnapshotIdentityV2 = {
    sessionId,
    caseVersionId,
    protocolCatalogRef: { ...evaluation.protocolCatalogRef },
    transcriptFingerprint: { ...transcript.fingerprint },
    scoringPolicyRef: { ...SPFA_SCORING_POLICY_V2_2026_1.policyRef },
  };
  return {
    snapshotIdentity,
    payload: { evaluation, score },
    context: {
      evaluationContext: { transcript, spfaProtocolSet: protocolSet },
      scoringContext,
      scoringPolicy: SPFA_SCORING_POLICY_V2_2026_1,
    },
  };
}

function evaluating(overrides: Record<string, unknown> = {}): SpfaEvaluationLifecycleV2 {
  const fixture = completedFixture();
  return validateSpfaEvaluationLifecycleV2({
    schemaVersion: '2.0', sessionId, status: 'EVALUATING', snapshotIdentity: fixture.snapshotIdentity,
    attemptId: attempt1, attemptCount: 1, startedAt, leaseExpiresAt, ...overrides,
  });
}

function completed(overrides: Record<string, unknown> = {}): SpfaEvaluationLifecycleV2 {
  const fixture = completedFixture();
  return validateSpfaEvaluationLifecycleV2({
    schemaVersion: '2.0', sessionId, status: 'COMPLETED', snapshotIdentity: fixture.snapshotIdentity,
    attemptId: attempt1, attemptCount: 1, startedAt, completedAt: afterExpiry,
    completedPayload: fixture.payload, ...overrides,
  }, fixture.context);
}

function failed(overrides: Record<string, unknown> = {}): SpfaEvaluationLifecycleV2 {
  const fixture = completedFixture();
  return validateSpfaEvaluationLifecycleV2({
    schemaVersion: '2.0', sessionId, status: 'FAILED', snapshotIdentity: fixture.snapshotIdentity,
    attemptId: attempt1, attemptCount: 1, startedAt, failedAt: afterExpiry,
    failureCode: 'PROVIDER_FAILURE', ...overrides,
  });
}

describe('M5-G1 strict lifecycle states', () => {
  it('accepts a valid EVALUATING record', () => expect(evaluating()).toMatchObject({ status: 'EVALUATING', attemptCount: 1 }));
  it('accepts a valid COMPLETED record with canonical evaluation and score', () => expect(completed()).toMatchObject({ status: 'COMPLETED' }));
  it('accepts a valid FAILED record', () => expect(failed()).toMatchObject({ status: 'FAILED', failureCode: 'PROVIDER_FAILURE' }));

  it.each(['UNKNOWN', 'PENDING', 'active'])('rejects unknown lifecycle status %s', (status) => {
    expect(() => evaluating({ status })).toThrowError(SpfaEvaluationLifecycleValidationError);
  });

  it.each([
    ['EVALUATING', { completedAt: afterExpiry }],
    ['EVALUATING', { failedAt: afterExpiry }],
    ['EVALUATING', { completedPayload: {} }],
    ['FAILED', { leaseExpiresAt }],
    ['FAILED', { completedAt: afterExpiry }],
    ['COMPLETED', { failedAt: afterExpiry }],
    ['COMPLETED', { failureCode: 'INTERNAL_FAILURE' }],
  ])('rejects incompatible timestamp/result fields for %s', (status, extra) => {
    const build = status === 'EVALUATING' ? evaluating : status === 'FAILED' ? failed : completed;
    expect(() => build(extra)).toThrow(/unexpected property/);
  });

  it('rejects final result in EVALUATING and FAILED', () => {
    expect(() => evaluating({ completedPayload: completedFixture().payload })).toThrow(/unexpected property/);
    expect(() => failed({ completedPayload: completedFixture().payload })).toThrow(/unexpected property/);
  });

  it('rejects missing completed result or completion validation context', () => {
    const fixture = completedFixture();
    const raw = {
      schemaVersion: '2.0', sessionId, status: 'COMPLETED', snapshotIdentity: fixture.snapshotIdentity,
      attemptId: attempt1, attemptCount: 1, startedAt, completedAt: afterExpiry,
    };
    expect(() => validateSpfaEvaluationLifecycleV2(raw, fixture.context)).toThrow(/completedPayload/);
    expect(() => validateSpfaEvaluationLifecycleV2({ ...raw, completedPayload: fixture.payload })).toThrow(/completion validation context/);
  });

  it('rejects extra properties at lifecycle and completion payload boundaries', () => {
    expect(() => evaluating({ futureSecret: true })).toThrow(/unexpected property/);
    const fixture = completedFixture();
    expect(() => completed({ completedPayload: { ...fixture.payload, rawProviderResponse: 'secret' } })).toThrow(/unexpected property/);
  });
});

describe('M5-G1 snapshot identity and completion coherence', () => {
  it('accepts and canonicalizes the exact five-field snapshot identity', () => {
    const snapshot = completedFixture().snapshotIdentity;
    expect(validateSpfaEvaluationSnapshotIdentityV2(snapshot)).toEqual(snapshot);
    expect(Object.keys(snapshot).sort()).toEqual(['caseVersionId', 'protocolCatalogRef', 'scoringPolicyRef', 'sessionId', 'transcriptFingerprint'].sort());
  });

  it.each([
    ['sessionId', '10000000-0000-4000-8000-000000000002'],
    ['caseVersionId', validateCaseVersionId('casever_20000000-0000-4000-8000-000000000002')],
    ['protocolCatalogRef', { id: 'spfa-protocol-catalog', version: 'wrong' }],
    ['transcriptFingerprint', { algorithm: 'sha256', canonicalization: 'session-transcript-v2/1', value: 'c'.repeat(64) }],
    ['scoringPolicyRef', { id: 'spfa-scoring-standard', version: 'wrong' }],
  ] as const)('rejects %s snapshot drift', (field, changed) => {
    const expected = completedFixture().snapshotIdentity;
    const actual = { ...expected, [field]: changed } as SpfaEvaluationSnapshotIdentityV2;
    expect(() => assertSameSpfaEvaluationSnapshotIdentityV2(expected, actual)).toThrowError(SpfaEvaluationLifecycleTransitionError);
  });

  it('rejects lifecycle/session mismatch and extra snapshot properties', () => {
    const snapshot = completedFixture().snapshotIdentity;
    expect(() => evaluating({ snapshotIdentity: { ...snapshot, sessionId: '10000000-0000-4000-8000-000000000002' } })).toThrow(/must match lifecycle sessionId/);
    expect(() => evaluating({ snapshotIdentity: { ...snapshot, futureSecret: true } })).toThrow(/unexpected property/);
  });

  it('rejects completed score identity drift through canonical validators', () => {
    const fixture = completedFixture();
    const score = clone(fixture.payload.score) as any;
    score.scoringPolicyRef.version = 'wrong';
    expect(() => completed({ completedPayload: { evaluation: fixture.payload.evaluation, score } })).toThrow(/valid canonical SPFA session score/);
  });
});

describe('M5-G1 attempts, leases and timestamps', () => {
  it.each([
    'spfa_eval_attempt_30000000-0000-4000-8000-000000000001',
    'spfa_eval_attempt_aaaaaaaa-aaaa-8aaa-baaa-aaaaaaaaaaaa',
  ])('accepts opaque attempt ID %s', (value) => expect(validateSpfaEvaluationAttemptIdV2(value)).toBe(value));

  it.each([
    '30000000-0000-4000-8000-000000000001',
    'spfa_eval_attempt_semantic-name',
    'spfa_eval_attempt_30000000-0000-9000-8000-000000000001',
    'spfa_eval_attempt_30000000-0000-4000-7000-000000000001',
    'spfa_eval_attempt_30000000-0000-4000-8000-00000000000A',
  ])('rejects invalid attempt ID %s', (value) => expect(() => validateSpfaEvaluationAttemptIdV2(value)).toThrow(/spfa_eval_attempt/));

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid attemptCount %s', (attemptCount) => {
    expect(() => evaluating({ attemptCount })).toThrow(/positive safe integer/);
  });

  it('defines future lease as active, past lease as expired, and equality as expired', () => {
    const lifecycle = evaluating();
    expect(isSpfaEvaluationLeaseExpiredV2(lifecycle as Extract<SpfaEvaluationLifecycleV2, { status: 'EVALUATING' }>, '2026-08-25T09:04:59Z')).toBe(false);
    expect(isSpfaEvaluationLeaseExpiredV2(lifecycle as Extract<SpfaEvaluationLifecycleV2, { status: 'EVALUATING' }>, leaseExpiresAt)).toBe(true);
    expect(isSpfaEvaluationLeaseExpiredV2(lifecycle as Extract<SpfaEvaluationLifecycleV2, { status: 'EVALUATING' }>, afterExpiry)).toBe(true);
  });

  it('canonicalizes explicit offsets and rejects local, impossible, or invalid lease timestamps', () => {
    expect(validateSpfaEvaluationTimestampV2('2026-08-25T10:00:00+01:00')).toBe(startedAt);
    for (const timestamp of ['2026-08-25T09:00:00', '2026-02-30T09:00:00Z', 'not-a-date']) {
      expect(() => validateSpfaEvaluationTimestampV2(timestamp)).toThrowError(SpfaEvaluationLifecycleValidationError);
    }
    expect(() => evaluating({ leaseExpiresAt: '2026-08-25T08:59:59Z' })).toThrow(/after startedAt/);
    expect(() => evaluating({ leaseExpiresAt: 'invalid' })).toThrow(/explicit timezone/);
  });

  it('requires lease only in EVALUATING', () => {
    const raw = clone(evaluating()) as any;
    delete raw.leaseExpiresAt;
    expect(() => validateSpfaEvaluationLifecycleV2(raw)).toThrow(/leaseExpiresAt/);
    expect(() => completed({ leaseExpiresAt })).toThrow(/unexpected property/);
  });
});

describe('M5-G1 transition matrix', () => {
  it('allows no-record -> EVALUATING only with attemptCount 1', () => {
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(null, evaluating(), startedAt, retryPolicy)).not.toThrow();
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(null, evaluating({ attemptCount: 2 }), startedAt, retryPolicy)).toThrow(/attemptCount 1/);
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(null, completed(), startedAt, retryPolicy)).toThrow(/first claim/);
  });

  it('allows current EVALUATING attempt to complete or fail', () => {
    const current = evaluating();
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, completed(), startedAt, retryPolicy)).not.toThrow();
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, failed(), startedAt, retryPolicy)).not.toThrow();
  });

  it('requires completion/failure to belong to the current attempt', () => {
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(evaluating(), completed({ attemptId: attempt2 }), startedAt, retryPolicy)).toThrow(/current attempt/);
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(evaluating(), failed({ attemptCount: 2 }), startedAt, retryPolicy)).toThrow(/preserve attemptCount/);
  });

  it('makes COMPLETED terminal but accepts exact idempotent material', () => {
    const current = completed();
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, clone(current), afterExpiry, retryPolicy)).not.toThrow();
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, evaluating(), afterExpiry, retryPolicy)).toThrow(/terminal/);
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, failed(), afterExpiry, retryPolicy)).toThrow(/terminal/);
  });

  it('allows FAILED -> EVALUATING retry only with policy, new ID and count + 1', () => {
    const current = failed();
    const retry = evaluating({ attemptId: attempt2, attemptCount: 2, startedAt: '2026-08-25T09:07:00Z', leaseExpiresAt: '2026-08-25T09:12:00Z' });
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, retry, afterExpiry, retryPolicy)).not.toThrow();
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, retry, afterExpiry, { allowFailedRetry: false })).toThrow(/disabled/);
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, completed(), afterExpiry, retryPolicy)).toThrow(/retry claim/);
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, evaluating({ attemptCount: 2 }), afterExpiry, retryPolicy)).toThrow(/new attempt ID/);
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, evaluating({ attemptId: attempt2, attemptCount: 3 }), afterExpiry, retryPolicy)).toThrow(/increment/);
  });

  it('blocks active lease and permits expired recovery with new ID and count + 1', () => {
    const current = evaluating();
    const recovery = evaluating({ attemptId: attempt2, attemptCount: 2, startedAt: afterExpiry, leaseExpiresAt: '2026-08-25T09:11:00Z' });
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, recovery, '2026-08-25T09:04:00Z', retryPolicy)).toThrow(/active lease/);
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, recovery, leaseExpiresAt, retryPolicy)).not.toThrow();
    expect(canRecoverSpfaEvaluationV2(current as Extract<SpfaEvaluationLifecycleV2, { status: 'EVALUATING' }>, leaseExpiresAt)).toBe(true);
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, evaluating({ attemptCount: 2, startedAt: afterExpiry, leaseExpiresAt: '2026-08-25T09:11:00Z' }), afterExpiry, retryPolicy)).toThrow(/new attempt ID/);
    expect(() => assertSpfaEvaluationLifecycleTransitionV2(current, evaluating({ attemptId: attempt2, attemptCount: 1, startedAt: afterExpiry, leaseExpiresAt: '2026-08-25T09:11:00Z' }), afterExpiry, retryPolicy)).toThrow(/increment/);
  });

  it('exposes retry eligibility only through server-owned policy', () => {
    const current = failed() as Extract<SpfaEvaluationLifecycleV2, { status: 'FAILED' }>;
    expect(canRetryFailedSpfaEvaluationV2(current, retryPolicy)).toBe(true);
    expect(canRetryFailedSpfaEvaluationV2(current, { allowFailedRetry: false })).toBe(false);
  });
});

describe('M5-G1 idempotent claim decisions', () => {
  it('returns CLAIM_NEW for no record', () => expect(decideSpfaEvaluationClaimV2(null, completedFixture().snapshotIdentity, startedAt, retryPolicy)).toEqual({ decision: 'CLAIM_NEW', nextAttemptCount: 1 }));
  it('returns IN_PROGRESS for an active lease', () => expect(decideSpfaEvaluationClaimV2(evaluating(), completedFixture().snapshotIdentity, '2026-08-25T09:04:00Z', retryPolicy)).toMatchObject({ decision: 'IN_PROGRESS', currentAttemptId: attempt1 }));
  it('returns RECOVER_EXPIRED at the exact expiry instant', () => expect(decideSpfaEvaluationClaimV2(evaluating(), completedFixture().snapshotIdentity, leaseExpiresAt, retryPolicy)).toEqual({ decision: 'RECOVER_EXPIRED', previousAttemptId: attempt1, nextAttemptCount: 2 }));
  it('returns RETRY_FAILED or policy rejection for FAILED', () => {
    expect(decideSpfaEvaluationClaimV2(failed(), completedFixture().snapshotIdentity, afterExpiry, retryPolicy)).toEqual({ decision: 'RETRY_FAILED', previousAttemptId: attempt1, nextAttemptCount: 2 });
    expect(decideSpfaEvaluationClaimV2(failed(), completedFixture().snapshotIdentity, afterExpiry, { allowFailedRetry: false })).toEqual({ decision: 'REJECT', reason: 'FAILED_RETRY_DISABLED' });
  });
  it('returns persisted completion without recomputation metadata', () => {
    const current = completed();
    const decision = decideSpfaEvaluationClaimV2(current, completedFixture().snapshotIdentity, afterExpiry, retryPolicy);
    expect(decision).toEqual({ decision: 'RETURN_COMPLETED', completedPayload: current.completedPayload });
  });
  it('is deterministic for identical inputs', () => {
    const lifecycle = evaluating();
    const snapshot = completedFixture().snapshotIdentity;
    expect(decideSpfaEvaluationClaimV2(lifecycle, snapshot, startedAt, retryPolicy)).toEqual(decideSpfaEvaluationClaimV2(lifecycle, snapshot, startedAt, retryPolicy));
  });
  it('fails closed when attemptCount cannot be incremented safely', () => {
    const exhausted = evaluating({ attemptCount: Number.MAX_SAFE_INTEGER });
    expect(() => decideSpfaEvaluationClaimV2(exhausted, completedFixture().snapshotIdentity, afterExpiry, retryPolicy)).toThrow(/safe integer range/);
  });
  it('rejects snapshot drift before any idempotency decision', () => {
    const requested = { ...completedFixture().snapshotIdentity, scoringPolicyRef: { id: 'other', version: '1' } };
    expect(() => decideSpfaEvaluationClaimV2(evaluating(), requested, startedAt, retryPolicy)).toThrow(/must remain identical/);
  });
});

describe('M5-G1 failure safety and freeze contract', () => {
  it.each(['PROVIDER_FAILURE', 'INVALID_PROVIDER_RESULT', 'EVALUATION_FAILURE', 'SNAPSHOT_DRIFT', 'INTERNAL_FAILURE'])('accepts safe failure code %s', (failureCode) => {
    expect(failed({ failureCode })).toMatchObject({ failureCode });
  });
  it('rejects unknown or absent failure code and any raw failure payload', () => {
    expect(() => failed({ failureCode: 'RAW_OPENAI_ERROR' })).toThrow(/must be one of/);
    const raw = clone(failed()) as any;
    delete raw.failureCode;
    expect(() => validateSpfaEvaluationLifecycleV2(raw)).toThrow(/failureCode/);
    expect(() => failed({ providerResponse: 'SECRET', prompt: 'SECRET', patientFacts: {} })).toThrow(/unexpected property/);
  });
  it('rejects failureCode on COMPLETED', () => expect(() => completed({ failureCode: 'INTERNAL_FAILURE' })).toThrow(/unexpected property/));

  it('validates the complete first-freeze precondition contract', () => {
    const snapshotIdentity = completedFixture().snapshotIdentity;
    expect(validateSpfaEvaluationFreezePreconditionsV2({
      schemaVersion: '2.0', sessionId, snapshotIdentity, sessionOwnership: 'VERIFIED', sessionStatus: 'active',
      caseVersionPinned: true, transcriptSnapshotCanonical: true, messageWritesSerialized: true, finishSessionAtomically: true,
    })).toMatchObject({ sessionOwnership: 'VERIFIED', sessionStatus: 'active', finishSessionAtomically: true });
  });

  it.each(['sessionOwnership', 'caseVersionPinned', 'transcriptSnapshotCanonical', 'messageWritesSerialized', 'finishSessionAtomically'] as const)('rejects missing/false freeze guarantee %s', (key) => {
    const value: Record<string, unknown> = {
      schemaVersion: '2.0', sessionId, snapshotIdentity: completedFixture().snapshotIdentity,
      sessionOwnership: 'VERIFIED', sessionStatus: 'active', caseVersionPinned: true,
      transcriptSnapshotCanonical: true, messageWritesSerialized: true, finishSessionAtomically: true,
    };
    value[key] = false;
    expect(() => validateSpfaEvaluationFreezePreconditionsV2(value)).toThrow();
  });

  it('keeps lifecycle metadata free of clinical/provider/prompt material', () => {
    const keys = new Set<string>();
    const visit = (value: unknown): void => {
      if (Array.isArray(value)) return value.forEach(visit);
      if (typeof value !== 'object' || value === null) return;
      for (const [key, nested] of Object.entries(value)) {
        keys.add(key);
        visit(nested);
      }
    };
    visit(failed());
    for (const secret of ['transcript', 'messages', 'patientFacts', 'evaluator', 'responseModel', 'promptVersion', 'provider', 'apiKey', 'feedback', 'rawResponse']) {
      expect(keys).not.toContain(secret);
    }
  });
});
