import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock('@/lib/db', () => ({ pool: { connect: vi.fn() } }));
vi.mock('@/lib/cases/v2/resolve-session-clinical-content', () => ({
  resolveSessionSpfaClinicalContentV2: resolver.resolve,
}));

import { buildSpfaScoringContextV2 } from '@/lib/cases/v2/build-spfa-scoring-context';
import { claimSpfaSessionEvaluationV2 } from '@/lib/cases/v2/claim-spfa-session-evaluation';
import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import { OpenAiSpfaSemanticAdjudicationExecutionErrorV1 } from '@/lib/cases/v2/execute-openai-spfa-semantic-adjudication';
import {
  finalizeOwnedSpfaSessionEvaluationV2,
  type FinalizeSpfaSessionEvaluationDependenciesV2,
} from '@/lib/cases/v2/finalize-spfa-session-evaluation';
import { getOwnedSpfaEvaluationStatusV2 } from '@/lib/cases/v2/get-owned-spfa-evaluation-status';
import {
  completeSpfaEvaluationAttemptV2,
  failSpfaEvaluationAttemptV2,
  loadFrozenSpfaCaseVersionV2,
} from '@/lib/cases/v2/spfa-evaluation-persistence-runtime';
import type { BoundSpfaInformationTargetV2 } from '@/lib/cases/v2/spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2, SpfaIntegratedGeneratedCaseCoreV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import { SPFA_SCORING_POLICY_V2_2026_1 } from '@/lib/cases/v2/spfa-scoring-policy-v2';
import type { SpfaProtocolDefinitionV2 } from '@/lib/cases/v2/spfa-protocol-types';
import type { SpfaSessionEvaluationV2 } from '@/lib/cases/v2/spfa-session-evaluation-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import { scoreSpfaSessionV2 } from '@/lib/cases/v2/score-spfa-session';
import { validateSpfaProtocolIdV2, validateSpfaProtocolRequirementIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const database = new Pool({
  host: '127.0.0.1', port: 55434, user: 'postgres', database: 'postgres', ssl: false,
});
const runPostgres = process.env.RUN_SPFA_G4_POSTGRES === '1';
const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = validateCaseVersionId('casever_20000000-0000-4000-8000-000000000001');
const attemptIds = [
  'spfa_eval_attempt_30000000-0000-4000-8000-000000000001',
  'spfa_eval_attempt_30000000-0000-4000-8000-000000000002',
  'spfa_eval_attempt_30000000-0000-4000-8000-000000000003',
];
const spfaRef = 'conclusion_40000000-0000-4000-8000-000000000001' as ConclusionId;
const protocolId = validateSpfaProtocolIdV2('spfa_protocol_50000000-0000-4000-8000-000000000001');
const requirementId = validateSpfaProtocolRequirementIdV2('spfa_requirement_60000000-0000-4000-8000-000000000001');
const targetId = validateSpfaRequirementTargetIdV2('spfa_target_70000000-0000-4000-8000-000000000001');

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
  schemaVersion: '2.0', protocolId, version: '1.0.0', service: 'pharmaceutical_indication',
  requirements: nonEmpty([{
    kind: 'INFORMATION_REQUIREMENT', requirementId, teacherLabel: 'Demanda',
    description: 'Explora la demanda', defaultImportance: 'RELEVANT',
    safetyCriticality: { safetyCritical: false }, applicability: { kind: 'ALWAYS' },
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
const core = {
  caseVersionId, patientFacts: {}, evaluator: {}, spfaProtocolSet: protocolSet,
} as unknown as SpfaIntegratedGeneratedCaseCoreV2;

function evaluationFor(transcript: ReturnType<typeof createSessionTranscriptSnapshotV2>): SpfaSessionEvaluationV2 {
  return {
    schemaVersion: '2.0', sessionId, caseVersionId,
    protocolCatalogRef: protocolSet.catalogRef,
    transcriptFingerprint: transcript.fingerprint,
    applications: nonEmpty([{
      carePathSpfaRef: spfaRef,
      protocolRef: application.protocolRef,
      requirementResults: nonEmpty([{
        schemaVersion: '2.0', sessionId, caseVersionId,
        transcriptFingerprint: transcript.fingerprint,
        carePathSpfaRef: spfaRef, requirementRef: requirementId,
        kind: 'INFORMATION_REQUIREMENT',
        coverage: {
          status: 'COVERED', origin: 'PUBLIC_INFORMATION',
          coveredTargetRefs: nonEmpty([targetId]),
          evidence: nonEmpty([{ source: 'PUBLIC_INFORMATION', targetRef: targetId }]),
        },
      }]),
    }]),
    semanticExecutions: [],
  };
}

function generatedContent() {
  return {
    schemaVersion: '2.0',
    sourceOfTruth: {
      caseVersionId, patientFacts: { caseVersionId }, evaluator: { caseVersionId },
    },
    derived: {
      patientRuntime: { caseVersionId }, teachingSummary: { caseVersionId },
      complianceReport: { caseVersionId },
    },
  };
}

async function seedGenerated(): Promise<void> {
  await database.query(`
    TRUNCATE public.session_evaluation_records_v2, public.evaluations,
      public.messages, public.sessions, public.case_assignments,
      public.case_version_status_events, public.case_versions,
      public.cases, public.users RESTART IDENTITY CASCADE
  `);
  await database.query(`INSERT INTO public.users (id,email,password_hash,name,role) VALUES (1,'student@example.test','x','Student','student')`);
  await database.query(`INSERT INTO public.cases (id,title,description,spec,ground_truth,created_by) VALUES (1,'Synthetic','Synthetic','{}','{}',1)`);
  await database.query(`
    INSERT INTO public.case_versions
      (id,case_id,version_number,status,source_kind,content_format,content,created_by)
    VALUES ($1,1,1,'AI_DRAFT','AI_GENERATED','GENERATED_CASE_BUNDLE_V2',$2,1)
  `, [caseVersionId, generatedContent()]);
  for (const status of ['TEACHER_DRAFT', 'IN_REVIEW', 'VALIDATED', 'PUBLISHED']) {
    await database.query(`UPDATE public.case_versions SET status=$2 WHERE id=$1`, [caseVersionId, status]);
  }
  await database.query(`INSERT INTO public.sessions (id,user_id,case_id,case_version_id,status) VALUES ($1,1,1,$2,'active')`, [sessionId, caseVersionId]);
  await database.query(`INSERT INTO public.messages (session_id,role,content) VALUES ($1,'student','Pregunta'),($1,'patient','Respuesta')`, [sessionId]);
}

function coordinatorDependencies(options: Readonly<{
  attemptIndex?: number;
  leaseDurationMs?: number;
  evaluate?: FinalizeSpfaSessionEvaluationDependenciesV2['evaluateSession'];
}> = {}): FinalizeSpfaSessionEvaluationDependenciesV2 {
  const attemptIndex = options.attemptIndex ?? 0;
  return {
    claim: (input) => claimSpfaSessionEvaluationV2(input, {
      database,
      now: () => new Date().toISOString(),
      attemptId: () => attemptIds[attemptIndex],
      leaseDurationMs: options.leaseDurationMs ?? 300_000,
    }),
    resolveFrozenCore: async () => core,
    createAdjudicationRuntime: () => ({ adjudicate: vi.fn() }),
    evaluateSession: options.evaluate ?? vi.fn(async ({ transcript }) => evaluationFor(transcript)),
    buildScoringContext: buildSpfaScoringContextV2,
    scoreSession: scoreSpfaSessionV2,
    completeAttempt: (owner, completedAt, evaluation, score) =>
      completeSpfaEvaluationAttemptV2(owner, completedAt, evaluation, score, database),
    failAttempt: (owner, failedAt, code) =>
      failSpfaEvaluationAttemptV2(owner, failedAt, code, database),
    now: () => new Date().toISOString(),
  };
}

beforeAll(() => resolver.resolve.mockReturnValue(core));
afterAll(async () => database.end());
beforeEach(seedGenerated);

describe.runIf(runPostgres)('M5-G4 real PostgreSQL 17 finalization boundary', () => {
  it('serializes two full finalizations into one evaluator and one IN_PROGRESS observer', async () => {
    let releaseEvaluation!: () => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    const gate = new Promise<void>((resolve) => { releaseEvaluation = resolve; });
    const firstEvaluate = vi.fn(async ({ transcript: frozen }: Parameters<FinalizeSpfaSessionEvaluationDependenciesV2['evaluateSession']>[0]) => {
      markStarted();
      await gate;
      return evaluationFor(frozen);
    });
    const secondEvaluate = vi.fn();

    const firstPromise = finalizeOwnedSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      coordinatorDependencies({ attemptIndex: 0, evaluate: firstEvaluate }),
    );
    await started;
    const second = await finalizeOwnedSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      coordinatorDependencies({ attemptIndex: 1, evaluate: secondEvaluate }),
    );
    expect(second.outcome).toBe('IN_PROGRESS');
    expect(secondEvaluate).not.toHaveBeenCalled();
    releaseEvaluation();
    await expect(firstPromise).resolves.toMatchObject({ outcome: 'COMPLETED' });
    expect(firstEvaluate).toHaveBeenCalledOnce();
    const state = await database.query(`
      SELECT count(*)::int AS records, max(attempt_count)::int AS attempts,
        count(*) FILTER (WHERE status='COMPLETED')::int AS completions
      FROM public.session_evaluation_records_v2 WHERE session_id=$1
    `, [sessionId]);
    expect(state.rows[0]).toEqual({ records: 1, attempts: 1, completions: 1 });
  });

  it('claims, evaluates, scores, and persists one COMPLETED result', async () => {
    const evaluate = vi.fn(async ({ transcript }: Parameters<FinalizeSpfaSessionEvaluationDependenciesV2['evaluateSession']>[0]) => evaluationFor(transcript));
    const result = await finalizeOwnedSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      coordinatorDependencies({ evaluate }),
    );
    expect(result).toMatchObject({ outcome: 'COMPLETED', score: { status: 'SCORED' } });
    if (result.outcome !== 'COMPLETED') {
      throw new Error('fixture expected a completed evaluation');
    }
    expect(evaluate).toHaveBeenCalledTimes(1);
    const persisted = await database.query(`
      SELECT status, lease_expires_at, completed_at IS NOT NULL AS completed,
        failure_code, evaluation_result, score_result
      FROM public.session_evaluation_records_v2 WHERE session_id=$1
    `, [sessionId]);
    expect(persisted.rows[0]).toMatchObject({
      status: 'COMPLETED', lease_expires_at: null, completed: true,
      failure_code: null, evaluation_result: result.evaluation, score_result: result.score,
    });
    await expect(database.query(`INSERT INTO public.messages (session_id,role,content) VALUES ($1,'student','late')`, [sessionId])).rejects.toMatchObject({ code: '55000' });
  });

  it('replays COMPLETED without a second evaluation', async () => {
    await finalizeOwnedSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, coordinatorDependencies());
    const evaluate = vi.fn();
    const replay = await finalizeOwnedSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId }, coordinatorDependencies({ attemptIndex: 1, evaluate }),
    );
    expect(replay.outcome).toBe('COMPLETED');
    expect(evaluate).not.toHaveBeenCalled();
    const record = await database.query(`SELECT attempt_count::int AS attempts FROM public.session_evaluation_records_v2 WHERE session_id=$1`, [sessionId]);
    expect(record.rows[0].attempts).toBe(1);
  });

  it('polls COMPLETED repeatedly from persisted JSON without writes or reevaluation', async () => {
    await finalizeOwnedSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      coordinatorDependencies(),
    );
    const first = await getOwnedSpfaEvaluationStatusV2(
      { authenticatedUserId: 1, sessionId },
      database,
    );
    const second = await getOwnedSpfaEvaluationStatusV2(
      { authenticatedUserId: 1, sessionId },
      database,
    );
    expect(first).toEqual(second);
    expect(first).toMatchObject({ status: 'COMPLETED', score: { score: 100 } });
    const record = await database.query(`
      SELECT attempt_count::int AS attempts, status
      FROM public.session_evaluation_records_v2 WHERE session_id=$1
    `, [sessionId]);
    expect(record.rows[0]).toEqual({ attempts: 1, status: 'COMPLETED' });
  });

  it('polls an expired EVALUATING lease without recovery or attempt mutation', async () => {
    await claimSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      {
        database,
        now: () => new Date().toISOString(),
        attemptId: () => attemptIds[0],
        leaseDurationMs: 25,
      },
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    await expect(getOwnedSpfaEvaluationStatusV2(
      { authenticatedUserId: 1, sessionId },
      database,
    )).resolves.toMatchObject({ status: 'EVALUATING' });
    const record = await database.query(`
      SELECT status, attempt_id, attempt_count::int AS attempts
      FROM public.session_evaluation_records_v2 WHERE session_id=$1
    `, [sessionId]);
    expect(record.rows[0]).toEqual({
      status: 'EVALUATING',
      attempt_id: attemptIds[0],
      attempts: 1,
    });
  });

  it('makes foreign and nonexistent polling indistinguishable', async () => {
    await expect(getOwnedSpfaEvaluationStatusV2(
      { authenticatedUserId: 2, sessionId },
      database,
    )).rejects.toMatchObject({ code: 'session_not_found_or_forbidden' });
    await expect(getOwnedSpfaEvaluationStatusV2(
      {
        authenticatedUserId: 1,
        sessionId: '10000000-0000-4000-8000-000000000099',
      },
      database,
    )).rejects.toMatchObject({ code: 'session_not_found_or_forbidden' });
  });

  it('recovers a crash-shaped EVALUATING record from the exact frozen snapshot', async () => {
    const frozen = await claimSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      {
        database,
        now: () => new Date().toISOString(),
        attemptId: () => attemptIds[0],
        leaseDurationMs: 25,
      },
    );
    if (frozen.outcome !== 'CLAIMED_NEW') throw new Error('expected initial claim');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const evaluate = vi.fn(async ({ transcript: recoveredTranscript }: Parameters<FinalizeSpfaSessionEvaluationDependenciesV2['evaluateSession']>[0]) => {
      expect(recoveredTranscript).toEqual(frozen.transcriptSnapshot);
      return evaluationFor(recoveredTranscript);
    });
    const recovered = await finalizeOwnedSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      coordinatorDependencies({ attemptIndex: 1, evaluate }),
    );
    expect(recovered).toMatchObject({ outcome: 'COMPLETED' });
    expect(evaluate).toHaveBeenCalledOnce();
    const state = await database.query(`
      SELECT status, attempt_count::int AS attempt_count,
        transcript_fingerprint_value
      FROM public.session_evaluation_records_v2 WHERE session_id=$1
    `, [sessionId]);
    expect(state.rows[0]).toEqual({
      status: 'COMPLETED',
      attempt_count: 2,
      transcript_fingerprint_value: frozen.transcriptSnapshot.fingerprint.value,
    });
  });

  it('prevents an expired old worker from completing or failing a recovered attempt', async () => {
    const oldClaim = await claimSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      { database, now: () => new Date().toISOString(), attemptId: () => attemptIds[0], leaseDurationMs: 25 },
    );
    if (oldClaim.outcome !== 'CLAIMED_NEW') throw new Error('expected initial claim');
    await new Promise((resolve) => setTimeout(resolve, 50));
    const recovered = await claimSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      { database, now: () => new Date().toISOString(), attemptId: () => attemptIds[1], leaseDurationMs: 300_000 },
    );
    if (recovered.outcome !== 'RECOVERED_EXPIRED') throw new Error('expected recovery');
    const oldOwner = {
      sessionId, attemptId: oldClaim.attemptId,
      attemptCount: oldClaim.attemptCount, snapshotIdentity: oldClaim.snapshotIdentity,
    };
    const oldEvaluation = evaluationFor(oldClaim.transcriptSnapshot);
    const oldContext = buildSpfaScoringContextV2(oldEvaluation, protocolSet);
    const oldScore = scoreSpfaSessionV2(oldContext, SPFA_SCORING_POLICY_V2_2026_1);
    await expect(completeSpfaEvaluationAttemptV2(oldOwner, new Date().toISOString(), oldEvaluation, oldScore, database)).resolves.toEqual({ outcome: 'SUPERSEDED' });
    await expect(failSpfaEvaluationAttemptV2(oldOwner, new Date().toISOString(), 'PROVIDER_FAILURE', database)).resolves.toEqual({ outcome: 'SUPERSEDED' });
    const state = await database.query(`SELECT status, attempt_id, attempt_count::int AS attempt_count FROM public.session_evaluation_records_v2 WHERE session_id=$1`, [sessionId]);
    expect(state.rows[0]).toEqual({ status: 'EVALUATING', attempt_id: recovered.attemptId, attempt_count: 2 });
  });

  it('persists FAILED after provider failure and completes a later G3 retry', async () => {
    const providerFailure = vi.fn().mockRejectedValue(
      new OpenAiSpfaSemanticAdjudicationExecutionErrorV1(
        'openai_spfa_semantic_request_failed',
        'provider',
        'synthetic provider failure',
        new Error('synthetic provider failure'),
      ),
    );
    const failed = await finalizeOwnedSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId },
      coordinatorDependencies({ evaluate: providerFailure }),
    );
    expect(failed).toMatchObject({ outcome: 'FAILED', failureCode: 'PROVIDER_FAILURE' });
    const failedRow = await database.query(`SELECT status, lease_expires_at, failure_code, evaluation_result, score_result FROM public.session_evaluation_records_v2 WHERE session_id=$1`, [sessionId]);
    expect(failedRow.rows[0]).toEqual({
      status: 'FAILED', lease_expires_at: null, failure_code: 'PROVIDER_FAILURE',
      evaluation_result: null, score_result: null,
    });
    const completed = await finalizeOwnedSpfaSessionEvaluationV2(
      { authenticatedUserId: 1, sessionId }, coordinatorDependencies({ attemptIndex: 1 }),
    );
    expect(completed.outcome).toBe('COMPLETED');
    const completedRow = await database.query(`SELECT status, attempt_count::int AS attempt_count FROM public.session_evaluation_records_v2 WHERE session_id=$1`, [sessionId]);
    expect(completedRow.rows[0]).toEqual({ status: 'COMPLETED', attempt_count: 2 });
  });

  it('loads only the exact frozen case version outside a long transaction', async () => {
    const frozen = await loadFrozenSpfaCaseVersionV2(
      { authenticatedUserId: 1, sessionId, caseVersionId }, database,
    );
    expect(frozen).toMatchObject({ caseId: 1, caseVersionId, content: generatedContent() });
    await expect(loadFrozenSpfaCaseVersionV2(
      {
        authenticatedUserId: 1,
        sessionId,
        caseVersionId: validateCaseVersionId('casever_20000000-0000-4000-8000-000000000002'),
      },
      database,
    )).rejects.toMatchObject({ code: 'frozen_case_version_not_found_or_forbidden' });
  });
});
