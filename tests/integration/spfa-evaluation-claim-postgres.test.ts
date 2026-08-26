import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const resolver = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock('@/lib/db', () => ({ pool: { connect: vi.fn() } }));
vi.mock('@/lib/cases/v2/resolve-session-clinical-content', () => ({
  resolveSessionSpfaClinicalContentV2: resolver.resolve,
}));

import { claimSpfaSessionEvaluationV2 } from '@/lib/cases/v2/claim-spfa-session-evaluation';

const database = new Pool({ host: '127.0.0.1', port: 55433, user: 'postgres', database: 'postgres', ssl: false });
const runPostgres = process.env.RUN_SPFA_G3_POSTGRES === '1';
const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = 'casever_20000000-0000-4000-8000-000000000001';
const attemptIds = [
  'spfa_eval_attempt_30000000-0000-4000-8000-000000000001',
  'spfa_eval_attempt_30000000-0000-4000-8000-000000000002',
  'spfa_eval_attempt_30000000-0000-4000-8000-000000000003',
];

function generatedContent() {
  return {
    schemaVersion: '2.0',
    sourceOfTruth: {
      caseVersionId,
      patientFacts: { caseVersionId },
      evaluator: { caseVersionId },
    },
    derived: {
      patientRuntime: { caseVersionId },
      teachingSummary: { caseVersionId },
      complianceReport: { caseVersionId },
    },
  };
}

async function seedGenerated(message = true) {
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
  if (message) {
    await database.query(`INSERT INTO public.messages (session_id,role,content) VALUES ($1,'student','Pregunta'),($1,'patient','Respuesta')`, [sessionId]);
  }
}

function deps(attemptId: string, leaseDurationMs = 300_000) {
  return {
    database,
    now: () => new Date().toISOString(),
    attemptId: () => attemptId,
    leaseDurationMs,
  };
}

beforeAll(() => {
  resolver.resolve.mockReturnValue({
    spfaProtocolSet: {
      catalogRef: { id: 'spfa-protocol-catalog', version: '2026.1' },
    },
  });
});

afterAll(async () => database.end());

beforeEach(async () => seedGenerated());

describe.runIf(runPostgres)('M5-G3 real PostgreSQL 17 claim boundary', () => {
  it('includes a message whose write lock commits before the freeze lock', async () => {
    const writer = await database.connect();
    try {
      await writer.query('BEGIN');
      await writer.query(
        `INSERT INTO public.messages (session_id,role,content) VALUES ($1,'student','before freeze')`,
        [sessionId],
      );
      let claimSettled = false;
      const claimPromise = claimSpfaSessionEvaluationV2(
        { authenticatedUserId: 1, sessionId },
        deps(attemptIds[0]),
      ).finally(() => { claimSettled = true; });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(claimSettled).toBe(false);
      await writer.query('COMMIT');
      const result = await claimPromise;
      if (result.outcome !== 'CLAIMED_NEW') throw new Error('expected first claim');
      expect(result.transcriptSnapshot.messages.map((message) => message.content))
        .toContain('before freeze');
    } finally {
      await writer.query('ROLLBACK').catch(() => undefined);
      writer.release();
    }
  });

  it('rejects a message blocked behind a freeze that finishes the session first', async () => {
    await database.query(`
      CREATE FUNCTION public.g6_delay_finish() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.status='finished' AND OLD.status='active' THEN
          PERFORM pg_sleep(0.4);
        END IF;
        RETURN NEW;
      END $$
    `);
    await database.query(`
      CREATE TRIGGER g6_delay_finish BEFORE UPDATE ON public.sessions
      FOR EACH ROW EXECUTE FUNCTION public.g6_delay_finish()
    `);
    try {
      const claimPromise = claimSpfaSessionEvaluationV2(
        { authenticatedUserId: 1, sessionId },
        deps(attemptIds[0]),
      );
      let sleeping = false;
      for (let index = 0; index < 40; index += 1) {
        const activity = await database.query(`
          SELECT count(*)::int AS count FROM pg_catalog.pg_stat_activity
          WHERE wait_event='PgSleep' AND query LIKE '%UPDATE public.sessions%'
        `);
        if (activity.rows[0]?.count === 1) {
          sleeping = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(sleeping).toBe(true);
      const started = Date.now();
      const lateWrite = database.query(
        `INSERT INTO public.messages (session_id,role,content) VALUES ($1,'student','after freeze')`,
        [sessionId],
      ).then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error }),
      );
      const result = await claimPromise;
      const writeResult = await lateWrite;
      expect(result.outcome).toBe('CLAIMED_NEW');
      expect(writeResult.ok).toBe(false);
      if (writeResult.ok) throw new Error('late write unexpectedly succeeded');
      expect(writeResult.error).toMatchObject({ code: '55000' });
      expect(Date.now() - started).toBeGreaterThanOrEqual(100);
      if (result.outcome !== 'CLAIMED_NEW') throw new Error('expected first claim');
      expect(result.transcriptSnapshot.messages.map((message) => message.content))
        .not.toContain('after freeze');
    } finally {
      await database.query('DROP TRIGGER IF EXISTS g6_delay_finish ON public.sessions');
      await database.query('DROP FUNCTION IF EXISTS public.g6_delay_finish()');
    }
  });

  it('freezes active messages, persists EVALUATING and finishes the session', async () => {
    const result = await claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, deps(attemptIds[0]));
    expect(result).toMatchObject({ outcome: 'CLAIMED_NEW', attemptCount: 1 });
    const state = await database.query(`SELECT s.status, r.status AS evaluation_status, jsonb_array_length(r.transcript_snapshot->'messages') AS message_count FROM public.sessions s JOIN public.session_evaluation_records_v2 r ON r.session_id=s.id WHERE s.id=$1`, [sessionId]);
    expect(state.rows[0]).toMatchObject({ status: 'finished', evaluation_status: 'EVALUATING', message_count: 2 });
    await expect(database.query(`INSERT INTO public.messages (session_id,role,content) VALUES ($1,'student','late')`, [sessionId])).rejects.toMatchObject({ code: '55000' });
  });

  it('serializes two real claims into one physical attempt', async () => {
    let next = 0;
    const shared = { database, now: () => new Date().toISOString(), attemptId: () => attemptIds[next++] ?? attemptIds[2], leaseDurationMs: 300_000 };
    const outcomes = await Promise.all([
      claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, shared),
      claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, shared),
    ]);
    expect(outcomes.map((item) => item.outcome).sort()).toEqual(['CLAIMED_NEW', 'IN_PROGRESS']);
    const count = await database.query(`SELECT count(*)::int AS count, max(attempt_count)::int AS attempts FROM public.session_evaluation_records_v2 WHERE session_id=$1`, [sessionId]);
    expect(count.rows[0]).toEqual({ count: 1, attempts: 1 });
  });

  it('allows exactly one real recovery after lease expiry', async () => {
    await claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, deps(attemptIds[0], 50));
    await new Promise((resolve) => setTimeout(resolve, 100));
    let next = 1;
    const shared = { database, now: () => new Date().toISOString(), attemptId: () => attemptIds[next++] ?? attemptIds[2], leaseDurationMs: 300_000 };
    const outcomes = await Promise.all([
      claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, shared),
      claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, shared),
    ]);
    expect(outcomes.map((item) => item.outcome).sort()).toEqual(['IN_PROGRESS', 'RECOVERED_EXPIRED']);
    const row = await database.query(`SELECT attempt_count::int AS attempt_count FROM public.session_evaluation_records_v2 WHERE session_id=$1`, [sessionId]);
    expect(row.rows[0].attempt_count).toBe(2);
  });

  it('allows exactly one real retry from FAILED', async () => {
    await claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, deps(attemptIds[0]));
    await database.query(`UPDATE public.session_evaluation_records_v2 SET status='FAILED', lease_expires_at=NULL, failed_at=now(), failure_code='PROVIDER_FAILURE' WHERE session_id=$1`, [sessionId]);
    let next = 1;
    const shared = { database, now: () => new Date().toISOString(), attemptId: () => attemptIds[next++] ?? attemptIds[2], leaseDurationMs: 300_000 };
    const outcomes = await Promise.all([
      claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, shared),
      claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, shared),
    ]);
    expect(outcomes.map((item) => item.outcome).sort()).toEqual(['IN_PROGRESS', 'RETRIED_FAILED']);
    const row = await database.query(`SELECT status, attempt_count::int AS attempt_count, failure_code FROM public.session_evaluation_records_v2 WHERE session_id=$1`, [sessionId]);
    expect(row.rows[0]).toEqual({ status: 'EVALUATING', attempt_count: 2, failure_code: null });
  });

  it('rolls back the inserted lifecycle if finishing the session fails', async () => {
    await database.query(`CREATE FUNCTION public.g3_reject_finish() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='finished' THEN RAISE EXCEPTION USING ERRCODE='55000', MESSAGE='synthetic finish failure'; END IF; RETURN NEW; END $$`);
    await database.query(`CREATE TRIGGER g3_reject_finish BEFORE UPDATE ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.g3_reject_finish()`);
    await expect(claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, deps(attemptIds[0]))).rejects.toMatchObject({ code: 'evaluation_claim_failed' });
    const state = await database.query(`SELECT s.status, (SELECT count(*)::int FROM public.session_evaluation_records_v2 r WHERE r.session_id=s.id) AS records FROM public.sessions s WHERE s.id=$1`, [sessionId]);
    expect(state.rows[0]).toEqual({ status: 'active', records: 0 });
    await database.query(`DROP TRIGGER g3_reject_finish ON public.sessions`);
    await database.query(`DROP FUNCTION public.g3_reject_finish()`);
  });

  it('rejects Legacy without creating a v2 lifecycle', async () => {
    resolver.resolve.mockImplementationOnce(() => { throw new Error('legacy not available'); });
    await expect(claimSpfaSessionEvaluationV2({ authenticatedUserId: 1, sessionId }, deps(attemptIds[0]))).rejects.toMatchObject({ code: 'spfa_evaluation_not_available' });
    const count = await database.query(`SELECT count(*)::int AS count FROM public.session_evaluation_records_v2`);
    expect(count.rows[0].count).toBe(0);
  });
});
