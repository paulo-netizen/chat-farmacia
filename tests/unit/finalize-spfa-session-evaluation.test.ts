import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ pool: { connect: vi.fn() } }));

import { buildSpfaScoringContextV2 } from '@/lib/cases/v2/build-spfa-scoring-context';
import type { SpfaEvaluationClaimResultV2 } from '@/lib/cases/v2/claim-spfa-session-evaluation';
import {
  OpenAiSpfaSemanticAdjudicationExecutionErrorV1,
} from '@/lib/cases/v2/execute-openai-spfa-semantic-adjudication';
import {
  finalizeOwnedSpfaSessionEvaluationV2,
  SpfaEvaluationFinalizationErrorV2,
  type FinalizeSpfaSessionEvaluationDependenciesV2,
} from '@/lib/cases/v2/finalize-spfa-session-evaluation';
import { scoreSpfaSessionV2 } from '@/lib/cases/v2/score-spfa-session';
import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import type { BoundSpfaInformationTargetV2 } from '@/lib/cases/v2/spfa-protocol-application-types';
import type {
  CaseSpfaProtocolSetV2,
  SpfaIntegratedGeneratedCaseCoreV2,
} from '@/lib/cases/v2/spfa-protocol-set-types';
import { SPFA_SCORING_POLICY_V2_2026_1 } from '@/lib/cases/v2/spfa-scoring-policy-v2';
import type { SpfaProtocolDefinitionV2 } from '@/lib/cases/v2/spfa-protocol-types';
import type { SpfaSessionEvaluationV2 } from '@/lib/cases/v2/spfa-session-evaluation-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import { validateSpfaEvaluationAttemptIdV2 } from '@/lib/cases/v2/validate-spfa-evaluation-lifecycle';
import { validateSpfaProtocolIdV2, validateSpfaProtocolRequirementIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = validateCaseVersionId('casever_20000000-0000-4000-8000-000000000001');
const attemptId = validateSpfaEvaluationAttemptIdV2('spfa_eval_attempt_30000000-0000-4000-8000-000000000001');
const spfaRef = 'conclusion_40000000-0000-4000-8000-000000000001' as ConclusionId;
const protocolId = validateSpfaProtocolIdV2('spfa_protocol_50000000-0000-4000-8000-000000000001');
const requirementId = validateSpfaProtocolRequirementIdV2('spfa_requirement_60000000-0000-4000-8000-000000000001');
const targetId = validateSpfaRequirementTargetIdV2('spfa_target_70000000-0000-4000-8000-000000000001');
const now = '2026-08-25T09:04:00.000Z';

function nonEmpty<T>(values: readonly T[]): NonEmptyArray<T> {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('fixture must be non-empty');
  return [first, ...rest];
}

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
const transcript = createSessionTranscriptSnapshotV2({
  sessionId,
  caseVersionId,
  messages: [],
});
const snapshotIdentity = {
  sessionId,
  caseVersionId,
  protocolCatalogRef: protocolSet.catalogRef,
  transcriptFingerprint: transcript.fingerprint,
  scoringPolicyRef: SPFA_SCORING_POLICY_V2_2026_1.policyRef,
};
const evaluation: SpfaSessionEvaluationV2 = {
  schemaVersion: '2.0',
  sessionId,
  caseVersionId,
  protocolCatalogRef: protocolSet.catalogRef,
  transcriptFingerprint: transcript.fingerprint,
  applications: nonEmpty([{
    carePathSpfaRef: spfaRef,
    protocolRef: application.protocolRef,
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
const core = {
  caseVersionId,
  patientFacts: {},
  evaluator: {},
  spfaProtocolSet: protocolSet,
} as unknown as SpfaIntegratedGeneratedCaseCoreV2;

function claimed(
  outcome: 'CLAIMED_NEW' | 'RECOVERED_EXPIRED' | 'RETRIED_FAILED' = 'CLAIMED_NEW',
): Extract<
  SpfaEvaluationClaimResultV2,
  { outcome: 'CLAIMED_NEW' | 'RECOVERED_EXPIRED' | 'RETRIED_FAILED' }
> {
  return {
    outcome,
    sessionId,
    snapshotIdentity,
    attemptId,
    attemptCount: outcome === 'CLAIMED_NEW' ? 1 : 2,
    leaseExpiresAt: '2026-08-25T09:05:00.000Z',
    transcriptSnapshot: transcript,
    scoringPolicySnapshot: SPFA_SCORING_POLICY_V2_2026_1,
  };
}

function dependencies(
  claimResult: SpfaEvaluationClaimResultV2 = claimed(),
): FinalizeSpfaSessionEvaluationDependenciesV2 {
  return {
    claim: vi.fn().mockResolvedValue(claimResult),
    resolveFrozenCore: vi.fn().mockResolvedValue(core),
    createAdjudicationRuntime: vi.fn(() => ({ adjudicate: vi.fn() })),
    evaluateSession: vi.fn().mockResolvedValue(evaluation),
    buildScoringContext: vi.fn(() => scoringContext),
    scoreSession: vi.fn(() => score),
    completeAttempt: vi.fn().mockResolvedValue({ outcome: 'UPDATED' }),
    failAttempt: vi.fn().mockResolvedValue({ outcome: 'UPDATED' }),
    now: vi.fn(() => now),
  };
}

const input = { authenticatedUserId: 17, sessionId };

beforeEach(() => vi.clearAllMocks());

describe('finalizeOwnedSpfaSessionEvaluationV2 dispatch and frozen inputs', () => {
  it('returns a persisted completion without runtime, scoring, or writes', async () => {
    const deps = dependencies({
      outcome: 'COMPLETED', sessionId, snapshotIdentity,
      completedPayload: { evaluation, score },
    });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({
      outcome: 'COMPLETED', evaluation, score,
    });
    expect(deps.createAdjudicationRuntime).not.toHaveBeenCalled();
    expect(deps.evaluateSession).not.toHaveBeenCalled();
    expect(deps.completeAttempt).not.toHaveBeenCalled();
    expect(deps.failAttempt).not.toHaveBeenCalled();
  });

  it('returns in-progress metadata without evaluation or writes', async () => {
    const deps = dependencies({
      outcome: 'IN_PROGRESS', sessionId, snapshotIdentity, attemptId,
      attemptCount: 1, leaseExpiresAt: '2026-08-25T09:05:00.000Z',
    });
    const result = await finalizeOwnedSpfaSessionEvaluationV2(input, deps);
    expect(result).toEqual({
      outcome: 'IN_PROGRESS', sessionId, snapshotIdentity, attemptId,
      attemptCount: 1, leaseExpiresAt: '2026-08-25T09:05:00.000Z',
    });
    expect(deps.evaluateSession).not.toHaveBeenCalled();
    expect(deps.completeAttempt).not.toHaveBeenCalled();
  });

  it.each(['CLAIMED_NEW', 'RECOVERED_EXPIRED', 'RETRIED_FAILED'] as const)(
    'evaluates the persisted snapshot for %s',
    async (outcome) => {
      const deps = dependencies(claimed(outcome));
      await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({ outcome: 'COMPLETED' });
      expect(deps.resolveFrozenCore).toHaveBeenCalledWith({
        ...input,
        snapshotIdentity,
      });
      expect(deps.evaluateSession).toHaveBeenCalledWith(
        { transcript, core },
        expect.objectContaining({ adjudicate: expect.any(Function) }),
      );
    },
  );

  it('does not initialize the OpenAI runtime for deterministic evaluation', async () => {
    const deps = dependencies();
    await finalizeOwnedSpfaSessionEvaluationV2(input, deps);
    expect(deps.createAdjudicationRuntime).not.toHaveBeenCalled();
  });

  it('initializes the product runtime lazily when E2 adjudicates', async () => {
    const deps = dependencies();
    const adjudicate = vi.fn().mockResolvedValue({});
    vi.mocked(deps.createAdjudicationRuntime).mockReturnValue({ adjudicate });
    vi.mocked(deps.evaluateSession).mockImplementation(async (_value, boundary) => {
      await boundary.adjudicate({} as never);
      return evaluation;
    });
    await finalizeOwnedSpfaSessionEvaluationV2(input, deps);
    expect(deps.createAdjudicationRuntime).toHaveBeenCalledTimes(1);
    expect(adjudicate).toHaveBeenCalledTimes(1);
  });

  it('uses the historical policy snapshot for scoring and persists only after scoring', async () => {
    const deps = dependencies();
    await finalizeOwnedSpfaSessionEvaluationV2(input, deps);
    expect(deps.scoreSession).toHaveBeenCalledWith(
      scoringContext,
      SPFA_SCORING_POLICY_V2_2026_1,
    );
    expect(vi.mocked(deps.scoreSession).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(deps.completeAttempt).mock.invocationCallOrder[0],
    );
  });

  it.each([
    ['protocol drift', () => ({ ...core, spfaProtocolSet: { ...protocolSet, catalogRef: { id: 'other', version: '2026.1' } } })],
    ['case version drift', () => ({ ...core, caseVersionId: validateCaseVersionId('casever_20000000-0000-4000-8000-000000000002') })],
  ] as const)('fails closed on %s', async (_label, mutate) => {
    const deps = dependencies();
    vi.mocked(deps.resolveFrozenCore).mockResolvedValue(mutate() as SpfaIntegratedGeneratedCaseCoreV2);
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({
      outcome: 'FAILED', failureCode: 'SNAPSHOT_DRIFT',
    });
    expect(deps.evaluateSession).not.toHaveBeenCalled();
    expect(deps.failAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ attemptId }), now, 'SNAPSHOT_DRIFT',
    );
  });

  it('fails closed on transcript fingerprint drift', async () => {
    const drifted = claimed() as Extract<SpfaEvaluationClaimResultV2, { outcome: 'CLAIMED_NEW' }>;
    const deps = dependencies({
      ...drifted,
      snapshotIdentity: {
        ...snapshotIdentity,
        transcriptFingerprint: { ...transcript.fingerprint, value: '0'.repeat(64) },
      },
    });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({
      outcome: 'FAILED', failureCode: 'SNAPSHOT_DRIFT',
    });
  });

  it('fails closed on scoring policy identity drift', async () => {
    const work = claimed() as Extract<SpfaEvaluationClaimResultV2, { outcome: 'CLAIMED_NEW' }>;
    const deps = dependencies({
      ...work,
      scoringPolicySnapshot: {
        ...SPFA_SCORING_POLICY_V2_2026_1,
        policyRef: { id: 'other', version: '2026.1' },
      },
    });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({
      outcome: 'FAILED', failureCode: 'SNAPSHOT_DRIFT',
    });
  });
});

describe('finalizeOwnedSpfaSessionEvaluationV2 Tx B and failures', () => {
  it('persists validated evaluation and score for the exact attempt owner', async () => {
    const deps = dependencies();
    await finalizeOwnedSpfaSessionEvaluationV2(input, deps);
    expect(deps.completeAttempt).toHaveBeenCalledWith(
      { sessionId, attemptId, attemptCount: 1, snapshotIdentity },
      now,
      evaluation,
      score,
    );
    expect(deps.failAttempt).not.toHaveBeenCalled();
  });

  it('allows completion after lease expiry while the same attempt still owns the record', async () => {
    const deps = dependencies({ ...claimed(), leaseExpiresAt: '2026-08-25T08:00:00.000Z' });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({ outcome: 'COMPLETED' });
    expect(deps.completeAttempt).toHaveBeenCalledTimes(1);
  });

  it('rejects completion by a superseded attempt without writing failure', async () => {
    const deps = dependencies();
    vi.mocked(deps.completeAttempt).mockResolvedValue({ outcome: 'SUPERSEDED' });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).rejects.toMatchObject({
      code: 'attempt_superseded',
    });
    expect(deps.failAttempt).not.toHaveBeenCalled();
  });

  it('returns an identical already-completed payload idempotently', async () => {
    const deps = dependencies();
    vi.mocked(deps.completeAttempt).mockResolvedValue({
      outcome: 'ALREADY_COMPLETED', evaluationResult: evaluation, scoreResult: score,
    });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({
      outcome: 'COMPLETED', evaluation, score,
    });
  });

  it('rejects a materially different concurrent completion', async () => {
    const deps = dependencies();
    vi.mocked(deps.completeAttempt).mockResolvedValue({
      outcome: 'ALREADY_COMPLETED', evaluationResult: evaluation,
      scoreResult: { ...score, score: score.score === 100 ? 99 : 100 },
    });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).rejects.toMatchObject({
      code: 'invalid_completed_result',
    });
  });

  it.each([
    ['openai_spfa_semantic_request_failed', 'PROVIDER_FAILURE'],
    ['openai_spfa_semantic_response_failed', 'PROVIDER_FAILURE'],
    ['openai_spfa_semantic_refusal', 'INVALID_PROVIDER_RESULT'],
    ['openai_spfa_semantic_incomplete', 'INVALID_PROVIDER_RESULT'],
  ] as const)('maps %s to %s', async (providerCode, expected) => {
    const deps = dependencies();
    vi.mocked(deps.evaluateSession).mockRejectedValue(new OpenAiSpfaSemanticAdjudicationExecutionErrorV1(
      providerCode, 'provider', 'synthetic', new Error('synthetic'),
    ));
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({
      outcome: 'FAILED', failureCode: expected,
    });
    expect(deps.completeAttempt).not.toHaveBeenCalled();
    expect(deps.failAttempt).toHaveBeenCalledWith(expect.anything(), now, expected);
  });

  it('maps deterministic evaluation/scoring failure without persisting partial results', async () => {
    const deps = dependencies();
    vi.mocked(deps.scoreSession).mockImplementation(() => { throw new Error('synthetic scoring failure'); });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({
      outcome: 'FAILED', failureCode: 'EVALUATION_FAILURE',
    });
    expect(deps.completeAttempt).not.toHaveBeenCalled();
  });

  it('maps unknown non-Error failures to INTERNAL_FAILURE', async () => {
    const deps = dependencies();
    vi.mocked(deps.evaluateSession).mockRejectedValue({ secret: 'must-not-escape' });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).resolves.toMatchObject({
      outcome: 'FAILED', failureCode: 'INTERNAL_FAILURE',
    });
  });

  it('prevents a stale failed worker from failing the replacement attempt', async () => {
    const deps = dependencies();
    vi.mocked(deps.evaluateSession).mockRejectedValue(new Error('old worker failed'));
    vi.mocked(deps.failAttempt).mockResolvedValue({ outcome: 'SUPERSEDED' });
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).rejects.toMatchObject({
      code: 'attempt_superseded',
    });
  });

  it('surfaces failure-persistence failure and leaves recovery to lease expiry', async () => {
    const deps = dependencies();
    vi.mocked(deps.evaluateSession).mockRejectedValue(new Error('synthetic evaluation failure'));
    vi.mocked(deps.failAttempt).mockRejectedValue(new Error('synthetic database failure'));
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).rejects.toMatchObject({
      code: 'failure_persistence_failed',
    });
  });

  it('does not map a completion persistence failure into FAILED', async () => {
    const deps = dependencies();
    vi.mocked(deps.completeAttempt).mockRejectedValue(new Error('synthetic database failure'));
    await expect(finalizeOwnedSpfaSessionEvaluationV2(input, deps)).rejects.toMatchObject({
      code: 'completion_persistence_failed',
    });
    expect(deps.failAttempt).not.toHaveBeenCalled();
  });
});

describe('M5-G4 source and transaction boundaries', () => {
  it('contains no messages query in the finalizer or frozen-core loader', () => {
    const finalizer = readFileSync('lib/cases/v2/finalize-spfa-session-evaluation.ts', 'utf8');
    const persistence = readFileSync('lib/cases/v2/spfa-evaluation-persistence-runtime.ts', 'utf8');
    const frozenQuery = persistence.match(
      /const SELECT_FROZEN_CASE_VERSION_QUERY = `[\s\S]*?`;/,
    )?.[0];
    const frozenLoader = persistence.match(
      /export async function loadFrozenSpfaCaseVersionV2[\s\S]*?\n}\n\nexport async function completeSpfaEvaluationAttemptV2/,
    )?.[0];
    expect(finalizer).not.toMatch(/public\.messages|SELECT[\s\S]+messages/i);
    expect(frozenQuery).toBeDefined();
    expect(frozenQuery).not.toMatch(/public\.messages|SELECT_TRANSCRIPT_MESSAGES_QUERY/);
    expect(frozenLoader).toBeDefined();
    expect(frozenLoader).not.toMatch(/public\.messages|SELECT_TRANSCRIPT_MESSAGES_QUERY/);
  });

  it('runs claim before evaluation and starts Tx B only after provider work resolves', async () => {
    const order: string[] = [];
    const deps = dependencies();
    vi.mocked(deps.claim).mockImplementation(async () => { order.push('tx-a-committed'); return claimed(); });
    vi.mocked(deps.evaluateSession).mockImplementation(async () => { order.push('provider-finished'); return evaluation; });
    vi.mocked(deps.completeAttempt).mockImplementation(async () => { order.push('tx-b'); return { outcome: 'UPDATED' }; });
    await finalizeOwnedSpfaSessionEvaluationV2(input, deps);
    expect(order).toEqual(['tx-a-committed', 'provider-finished', 'tx-b']);
  });

  it('exposes no client-controlled transcript, policy, model, or attempt input', () => {
    const source = readFileSync('lib/cases/v2/finalize-spfa-session-evaluation.ts', 'utf8');
    expect(source).toContain('authenticatedUserId: number');
    expect(source).toContain('sessionId: string');
    expect(source).not.toMatch(/FinalizeOwnedSpfaSessionEvaluationInputV2[\s\S]{0,300}(transcript|policy|model|attemptId)/);
  });

  it('keeps the expected server-owned production model wired through the runtime', () => {
    const runtime = readFileSync('lib/cases/v2/openai-spfa-semantic-adjudication-runtime.ts', 'utf8');
    expect(runtime).toContain("OPENAI_SPFA_SEMANTIC_PRODUCTION_MODEL = 'gpt-5.6-sol'");
  });
});
