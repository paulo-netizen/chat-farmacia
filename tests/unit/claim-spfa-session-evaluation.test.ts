import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const clinicalResolver = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock('@/lib/db', () => ({ pool: { connect: vi.fn() } }));
vi.mock('@/lib/cases/v2/resolve-session-clinical-content', async () => {
  const actual = await vi.importActual<typeof import('@/lib/cases/v2/resolve-session-clinical-content')>(
    '@/lib/cases/v2/resolve-session-clinical-content',
  );
  return { ...actual, resolveSessionSpfaClinicalContentV2: clinicalResolver.resolve };
});

import { buildSpfaScoringContextV2 } from '@/lib/cases/v2/build-spfa-scoring-context';
import {
  claimSpfaSessionEvaluationV2,
  SPFA_EVALUATION_LEASE_MS_V2,
  SpfaEvaluationClaimErrorV2,
} from '@/lib/cases/v2/claim-spfa-session-evaluation';
import type { SpfaEvaluationClaimDependenciesV2 } from '@/lib/cases/v2/claim-spfa-session-evaluation';
import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import { scoreSpfaSessionV2 } from '@/lib/cases/v2/score-spfa-session';
import type { SpfaEvaluationPersistenceDatabaseV2 } from '@/lib/cases/v2/spfa-evaluation-persistence-runtime';
import type { BoundSpfaInformationTargetV2 } from '@/lib/cases/v2/spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import { SPFA_SCORING_POLICY_V2_2026_1 } from '@/lib/cases/v2/spfa-scoring-policy-v2';
import type { SpfaProtocolDefinitionV2 } from '@/lib/cases/v2/spfa-protocol-types';
import type { SpfaSessionEvaluationV2 } from '@/lib/cases/v2/spfa-session-evaluation-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import { SessionClinicalContentErrorV2 } from '@/lib/cases/v2/session-clinical-content-types';
import { validateSpfaProtocolIdV2, validateSpfaProtocolRequirementIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = validateCaseVersionId('casever_20000000-0000-4000-8000-000000000001');
const authenticatedUserId = 17;
const now = '2026-08-25T09:00:00.000Z';
const leaseExpiresAt = '2026-08-25T09:30:00.000Z';
const attempt1 = 'spfa_eval_attempt_30000000-0000-4000-8000-000000000001';
const attempt2 = 'spfa_eval_attempt_30000000-0000-4000-8000-000000000002';
const attempt3 = 'spfa_eval_attempt_30000000-0000-4000-8000-000000000003';
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

function transcript() {
  return createSessionTranscriptSnapshotV2({
    sessionId,
    caseVersionId,
    messages: [],
  });
}

function completedPayload() {
  const frozen = transcript();
  const evaluation: SpfaSessionEvaluationV2 = {
    schemaVersion: '2.0',
    sessionId,
    caseVersionId,
    protocolCatalogRef: { ...protocolSet.catalogRef },
    transcriptFingerprint: frozen.fingerprint,
    applications: nonEmpty([{
      carePathSpfaRef: spfaRef,
      protocolRef: { ...application.protocolRef },
      requirementResults: nonEmpty([{
        schemaVersion: '2.0',
        sessionId,
        caseVersionId,
        transcriptFingerprint: frozen.fingerprint,
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
  const context = buildSpfaScoringContextV2(evaluation, protocolSet);
  return {
    transcript: frozen,
    evaluation,
    score: scoreSpfaSessionV2(context, SPFA_SCORING_POLICY_V2_2026_1),
  };
}

function evaluationRow(
  status: 'EVALUATING' | 'FAILED' | 'COMPLETED',
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const completed = completedPayload();
  const base = {
    session_id: sessionId,
    case_version_id: caseVersionId,
    status,
    result_format: 'SPFA_SESSION_EVALUATION_V2',
    protocol_catalog_id: protocolSet.catalogRef.id,
    protocol_catalog_version: protocolSet.catalogRef.version,
    scoring_policy_id: SPFA_SCORING_POLICY_V2_2026_1.policyRef.id,
    scoring_policy_version: SPFA_SCORING_POLICY_V2_2026_1.policyRef.version,
    transcript_fingerprint_algorithm: completed.transcript.fingerprint.algorithm,
    transcript_fingerprint_canonicalization: completed.transcript.fingerprint.canonicalization,
    transcript_fingerprint_value: completed.transcript.fingerprint.value,
    transcript_snapshot: completed.transcript,
    scoring_policy_snapshot: SPFA_SCORING_POLICY_V2_2026_1,
    attempt_id: attempt1,
    attempt_count: '1',
    lease_expires_at: null,
    started_at: '2026-08-25T08:00:00.000Z',
    completed_at: null,
    failed_at: null,
    failure_code: null,
    evaluation_result: null,
    score_result: null,
  };
  const state = status === 'EVALUATING'
    ? { lease_expires_at: leaseExpiresAt }
    : status === 'FAILED'
      ? { failed_at: '2026-08-25T08:30:00.000Z', failure_code: 'PROVIDER_FAILURE' }
      : {
          completed_at: '2026-08-25T08:30:00.000Z',
          evaluation_result: completed.evaluation,
          score_result: completed.score,
        };
  return { ...base, ...state, ...overrides };
}

type QueryCall = Readonly<{ sql: string; values?: unknown[] }>;

class FakeDatabase implements SpfaEvaluationPersistenceDatabaseV2 {
  readonly calls: QueryCall[] = [];
  sessionStatus: 'active' | 'finished' = 'active';
  sessionRows: readonly unknown[] | undefined;
  record: Record<string, unknown> | null = null;
  legacyEvaluation = false;
  messages: readonly unknown[] = [];
  failInsert = false;
  failFinish = false;
  failRestart = false;
  private lockTail: Promise<void> = Promise.resolve();

  async connect() {
    let unlock: (() => void) | undefined;
    return {
      query: async (sql: string, values?: unknown[]) => {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        this.calls.push({ sql: normalized, values });
        if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
          if (normalized !== 'BEGIN') {
            unlock?.();
            unlock = undefined;
          }
          return { rows: [], rowCount: null };
        }
        if (normalized.includes('FOR UPDATE OF s')) {
          const previous = this.lockTail;
          this.lockTail = new Promise<void>((resolve) => { unlock = resolve; });
          await previous;
          return {
            rows: this.sessionRows ?? [this.lockedRow()],
            rowCount: 1,
          };
        }
        if (normalized.includes('FROM public.session_evaluation_records_v2')) {
          return { rows: this.record === null ? [] : [structuredClone(this.record)], rowCount: this.record === null ? 0 : 1 };
        }
        if (normalized.includes('FROM public.evaluations')) {
          return { rows: this.legacyEvaluation ? [{ '?column?': 1 }] : [], rowCount: this.legacyEvaluation ? 1 : 0 };
        }
        if (normalized.includes('FROM public.messages')) {
          return { rows: [...this.messages], rowCount: this.messages.length };
        }
        if (normalized.includes('INSERT INTO public.session_evaluation_records_v2')) {
          if (this.failInsert) throw new Error('synthetic insert failure');
          if (this.record !== null) throw new Error('synthetic duplicate');
          const input = values ?? [];
          this.record = {
            session_id: input[0], case_version_id: input[1], status: 'EVALUATING',
            result_format: 'SPFA_SESSION_EVALUATION_V2',
            protocol_catalog_id: input[2], protocol_catalog_version: input[3],
            scoring_policy_id: input[4], scoring_policy_version: input[5],
            transcript_fingerprint_algorithm: input[6],
            transcript_fingerprint_canonicalization: input[7],
            transcript_fingerprint_value: input[8], transcript_snapshot: input[9],
            scoring_policy_snapshot: input[10], attempt_id: input[11], attempt_count: '1',
            lease_expires_at: input[12], started_at: input[13], completed_at: null,
            failed_at: null, failure_code: null, evaluation_result: null, score_result: null,
          };
          return { rows: [], rowCount: 1 };
        }
        if (normalized.includes('UPDATE public.sessions')) {
          if (this.failFinish) return { rows: [], rowCount: 0 };
          this.sessionStatus = 'finished';
          return { rows: [], rowCount: 1 };
        }
        if (normalized.includes('UPDATE public.session_evaluation_records_v2')) {
          if (this.failRestart) return { rows: [], rowCount: 0 };
          const input = values ?? [];
          if (
            this.record === null || this.record.status !== input[1] ||
            this.record.attempt_id !== input[2] || this.record.attempt_count !== String(input[3])
          ) return { rows: [], rowCount: 0 };
          this.record = {
            ...this.record,
            status: 'EVALUATING', attempt_id: input[4], attempt_count: String(input[5]),
            lease_expires_at: input[6], started_at: input[7], completed_at: null,
            failed_at: null, failure_code: null, evaluation_result: null, score_result: null,
          };
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`unhandled SQL: ${normalized}`);
      },
      release: () => undefined,
    };
  }

  private lockedRow() {
    return {
      session_id: sessionId,
      session_user_id: String(authenticatedUserId),
      session_case_id: '5',
      session_case_version_id: caseVersionId,
      session_status: this.sessionStatus,
      version_id: caseVersionId,
      version_case_id: '5',
      version_status: 'PUBLISHED',
      version_source_kind: 'AI_GENERATED',
      version_legacy_status: null,
      version_content_format: 'GENERATED_CASE_BUNDLE_V2',
      version_content: { protected: true },
    };
  }
}

function dependencies(database: FakeDatabase, attemptId = attempt2): SpfaEvaluationClaimDependenciesV2 {
  return {
    database,
    now: () => now,
    attemptId: () => attemptId,
  };
}

function claim(database: FakeDatabase, attemptId = attempt2) {
  return claimSpfaSessionEvaluationV2(
    { authenticatedUserId, sessionId },
    dependencies(database, attemptId),
  );
}

function sqlIndex(database: FakeDatabase, fragment: string): number {
  return database.calls.findIndex(({ sql }) => sql.includes(fragment));
}

beforeEach(() => {
  clinicalResolver.resolve.mockReset();
  clinicalResolver.resolve.mockImplementation((input: { contentFormat: string }) => {
    if (input.contentFormat !== 'GENERATED_CASE_BUNDLE_V2') {
      throw new SessionClinicalContentErrorV2('spfa_evaluation_not_available', 'contentFormat');
    }
    return { spfaProtocolSet: protocolSet };
  });
});

describe('claimSpfaSessionEvaluationV2 first freeze', () => {
  it('claims once, freezes after the session lock and finishes atomically', async () => {
    const database = new FakeDatabase();
    database.messages = [{
      message_id: '2', message_role: 'patient', message_content: 'Respuesta',
      message_created_at: new Date('2026-08-25T08:02:00.000Z'),
    }, {
      message_id: '1', message_role: 'student', message_content: 'Pregunta',
      message_created_at: new Date('2026-08-25T08:01:00.000Z'),
    }];

    const result = await claim(database);

    expect(result).toMatchObject({
      outcome: 'CLAIMED_NEW', sessionId, attemptId: attempt2, attemptCount: 1,
      leaseExpiresAt,
    });
    if (result.outcome !== 'CLAIMED_NEW') throw new Error('unexpected fixture outcome');
    expect(result.transcriptSnapshot.messages.map((message) => message.messageId)).toEqual(['1', '2']);
    expect(result.scoringPolicySnapshot.policyRef).toEqual({ id: 'spfa-scoring-standard', version: '2026.1' });
    expect(result.snapshotIdentity.transcriptFingerprint).toEqual(result.transcriptSnapshot.fingerprint);
    expect(database.sessionStatus).toBe('finished');
    expect(sqlIndex(database, 'FOR UPDATE OF s')).toBeLessThan(sqlIndex(database, 'FROM public.messages'));
    expect(sqlIndex(database, 'FROM public.messages')).toBeLessThan(sqlIndex(database, 'INSERT INTO public.session_evaluation_records_v2'));
    expect(sqlIndex(database, 'INSERT INTO public.session_evaluation_records_v2')).toBeLessThan(sqlIndex(database, 'UPDATE public.sessions'));
    expect(database.calls.at(-1)?.sql).toBe('COMMIT');
  });

  it('uses server-owned attempt ID, policy and conservative thirty-minute lease', async () => {
    const database = new FakeDatabase();
    const result = await claim(database, attempt3);
    expect(SPFA_EVALUATION_LEASE_MS_V2).toBe(1_800_000);
    expect(result).toMatchObject({ attemptId: attempt3, leaseExpiresAt });
    const insert = database.calls.find(({ sql }) => sql.includes('INSERT INTO public.session_evaluation_records_v2'));
    expect(insert?.values?.slice(4, 6)).toEqual(['spfa-scoring-standard', '2026.1']);
    expect(insert?.values?.[11]).toBe(attempt3);
  });

  it('rejects client attempt/policy fields before acquiring a client', async () => {
    const database = new FakeDatabase();
    await expect(claimSpfaSessionEvaluationV2({
      authenticatedUserId, sessionId, policy: { id: 'client-policy' },
    } as never, dependencies(database))).rejects.toMatchObject({ code: 'invalid_input' });
    expect(database.calls).toEqual([]);
  });

  it.each([
    ['missing', []],
    ['foreign', [{
      session_id: sessionId,
      session_user_id: '99',
      session_case_id: '5',
      session_case_version_id: caseVersionId,
      session_status: 'active',
      version_id: caseVersionId,
      version_case_id: '5',
      version_status: 'PUBLISHED',
      version_source_kind: 'AI_GENERATED',
      version_legacy_status: null,
      version_content_format: 'GENERATED_CASE_BUNDLE_V2',
      version_content: {},
    }]],
  ])('fails closed for %s ownership anchor', async (_name, rows) => {
    const database = new FakeDatabase();
    database.sessionRows = rows;
    await expect(claim(database)).rejects.toBeInstanceOf(SpfaEvaluationClaimErrorV2);
    expect(database.calls.at(-1)?.sql).toBe('ROLLBACK');
  });

  it('rejects Legacy and never inserts a v2 row', async () => {
    const database = new FakeDatabase();
    database.sessionRows = [{ ...database['lockedRow'](), version_source_kind: 'LEGACY_V1', version_content_format: 'LEGACY_V1_SNAPSHOT' }];
    await expect(claim(database)).rejects.toMatchObject({ code: 'spfa_evaluation_not_available' });
    expect(sqlIndex(database, 'INSERT INTO public.session_evaluation_records_v2')).toBe(-1);
  });

  it('rejects a finished session without an existing record', async () => {
    const database = new FakeDatabase();
    database.sessionStatus = 'finished';
    await expect(claim(database)).rejects.toMatchObject({ code: 'invalid_session_state' });
  });

  it('rejects a Legacy evaluation before insert', async () => {
    const database = new FakeDatabase();
    database.legacyEvaluation = true;
    await expect(claim(database)).rejects.toMatchObject({ code: 'legacy_evaluation_exists' });
    expect(sqlIndex(database, 'INSERT INTO public.session_evaluation_records_v2')).toBe(-1);
  });

  it.each(['insert', 'finish'] as const)('rolls back when %s fails', async (stage) => {
    const database = new FakeDatabase();
    database.failInsert = stage === 'insert';
    database.failFinish = stage === 'finish';
    await expect(claim(database)).rejects.toBeInstanceOf(SpfaEvaluationClaimErrorV2);
    expect(database.calls.at(-1)?.sql).toBe('ROLLBACK');
    expect(database.calls.some(({ sql }) => sql === 'COMMIT')).toBe(false);
  });

  it('rolls back an invalid transcript without persisting lifecycle or finishing', async () => {
    const database = new FakeDatabase();
    database.messages = [{
      message_id: '1', message_role: 'teacher', message_content: 'hidden',
      message_created_at: '2026-08-25T08:00:00.000Z',
    }];
    await expect(claim(database)).rejects.toMatchObject({ code: 'invalid_session_transcript' });
    expect(sqlIndex(database, 'INSERT INTO public.session_evaluation_records_v2')).toBe(-1);
    expect(sqlIndex(database, 'UPDATE public.sessions')).toBe(-1);
    expect(database.calls.at(-1)?.sql).toBe('ROLLBACK');
  });
});

describe('claimSpfaSessionEvaluationV2 existing lifecycle', () => {
  it('returns IN_PROGRESS with zero writes and never queries messages', async () => {
    const database = new FakeDatabase();
    database.sessionStatus = 'finished';
    database.record = evaluationRow('EVALUATING');
    const result = await claim(database);
    expect(result).toMatchObject({ outcome: 'IN_PROGRESS', attemptId: attempt1, attemptCount: 1, leaseExpiresAt });
    expect(sqlIndex(database, 'FROM public.messages')).toBe(-1);
    expect(sqlIndex(database, 'UPDATE public.session_evaluation_records_v2')).toBe(-1);
  });

  it('recovers an expired lease with the same persisted snapshot and policy', async () => {
    const database = new FakeDatabase();
    database.sessionStatus = 'finished';
    const before = evaluationRow('EVALUATING', { lease_expires_at: '2026-08-25T08:59:59.000Z' });
    database.record = before;
    const result = await claim(database, attempt2);
    expect(result).toMatchObject({ outcome: 'RECOVERED_EXPIRED', attemptId: attempt2, attemptCount: 2, leaseExpiresAt });
    if (result.outcome !== 'RECOVERED_EXPIRED') throw new Error('unexpected fixture outcome');
    expect(result.transcriptSnapshot).toEqual(before.transcript_snapshot);
    expect(result.scoringPolicySnapshot).toEqual(before.scoring_policy_snapshot);
    expect(sqlIndex(database, 'FROM public.messages')).toBe(-1);
  });

  it('retries FAILED with a fresh attempt and clears failure fields', async () => {
    const database = new FakeDatabase();
    database.sessionStatus = 'finished';
    database.record = evaluationRow('FAILED');
    const result = await claim(database, attempt2);
    expect(result).toMatchObject({ outcome: 'RETRIED_FAILED', attemptId: attempt2, attemptCount: 2 });
    expect(database.record).toMatchObject({
      status: 'EVALUATING', failed_at: null, failure_code: null,
      evaluation_result: null, score_result: null,
    });
    expect(sqlIndex(database, 'FROM public.messages')).toBe(-1);
  });

  it('returns a validated COMPLETED payload without writes or transcript reconstruction', async () => {
    const database = new FakeDatabase();
    database.sessionStatus = 'finished';
    database.record = evaluationRow('COMPLETED');
    const result = await claim(database);
    const persisted = completedPayload();
    expect(result).toMatchObject({
      outcome: 'COMPLETED',
      completedPayload: {
        evaluation: persisted.evaluation,
        score: persisted.score,
      },
    });
    expect(sqlIndex(database, 'FROM public.messages')).toBe(-1);
    expect(database.calls.some(({ sql }) => /^(?:INSERT|UPDATE)\b/.test(sql))).toBe(false);
  });

  it.each([
    ['fingerprint drift', { transcript_fingerprint_value: 'f'.repeat(64) }],
    ['policy drift', { scoring_policy_version: 'wrong' }],
    ['completed score corruption', { score_result: { corrupted: true } }],
  ])('rejects corrupt persisted %s', async (_name, corruption) => {
    const database = new FakeDatabase();
    database.sessionStatus = 'finished';
    database.record = evaluationRow('COMPLETED', corruption);
    await expect(claim(database)).rejects.toMatchObject({ code: 'invalid_persisted_evaluation' });
    expect(database.calls.at(-1)?.sql).toBe('ROLLBACK');
  });

  it('fails closed when lifecycle exists but the session remains active', async () => {
    const database = new FakeDatabase();
    database.record = evaluationRow('EVALUATING');
    await expect(claim(database)).rejects.toMatchObject({ code: 'invalid_session_state' });
  });
});

describe('claimSpfaSessionEvaluationV2 concurrency and boundary guards', () => {
  it('serializes double new claim into one CLAIMED_NEW and one IN_PROGRESS', async () => {
    const database = new FakeDatabase();
    const [first, second] = await Promise.all([
      claim(database, attempt1),
      claim(database, attempt2),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual(['CLAIMED_NEW', 'IN_PROGRESS']);
    expect(database.calls.filter(({ sql }) => sql.includes('INSERT INTO public.session_evaluation_records_v2'))).toHaveLength(1);
  });

  it('serializes double recovery into one recovery and one IN_PROGRESS', async () => {
    const database = new FakeDatabase();
    database.sessionStatus = 'finished';
    database.record = evaluationRow('EVALUATING', { lease_expires_at: '2026-08-25T08:59:59.000Z' });
    const [first, second] = await Promise.all([
      claim(database, attempt2),
      claim(database, attempt3),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual(['IN_PROGRESS', 'RECOVERED_EXPIRED']);
    expect(database.record?.attempt_count).toBe('2');
  });

  it('serializes double FAILED retry into one retry and one IN_PROGRESS', async () => {
    const database = new FakeDatabase();
    database.sessionStatus = 'finished';
    database.record = evaluationRow('FAILED');
    const [first, second] = await Promise.all([
      claim(database, attempt2),
      claim(database, attempt3),
    ]);
    expect([first.outcome, second.outcome].sort()).toEqual(['IN_PROGRESS', 'RETRIED_FAILED']);
    expect(database.record?.attempt_count).toBe('2');
  });

  it('uses parameterized SQL, schema-qualified tables and no OpenAI/evaluation work', () => {
    const service = readFileSync('lib/cases/v2/claim-spfa-session-evaluation.ts', 'utf8');
    const persistence = readFileSync('lib/cases/v2/spfa-evaluation-persistence-runtime.ts', 'utf8');
    expect(persistence).toContain('FOR UPDATE OF s');
    expect(persistence).toContain('ORDER BY created_at ASC, id ASC');
    expect(persistence).toContain('public.session_evaluation_records_v2');
    expect(persistence).toMatch(/WHERE s\.id = \$1\s+AND s\.user_id = \$2/);
    expect(service).not.toMatch(/OpenAI|evaluateSpfaSession|scoreSpfaSession/);
    expect(service).not.toContain('patientFacts');
  });
});
