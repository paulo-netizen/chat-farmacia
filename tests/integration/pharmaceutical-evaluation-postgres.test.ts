import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createPharmaceuticalEvaluationPostgresV2, type PharmaceuticalPgDatabase } from '../../lib/cases/v2/pharmaceutical-evaluation-postgres';
import { recordFixture, uuid, worker } from '../unit/support/pharmaceutical-evaluation-record-fixture';

// Deliberately no DATABASE_URL/PG* fallback. Only the independently verified disposable container.
const enabled = process.env.RUN_PHARMACEUTICAL_P2_POSTGRES === '1';
const config = { host: '127.0.0.1', port: 55439, user: 'postgres', database: 'chatusal_m6_p2_disposable', ssl: false as const, application_name: 'chatusal-p2-test' };
let db: Pool;
const ownerId = '9007199254740993';
const access = { ownerId, sessionId: uuid(1) };
const id = uuid(101);
const claim = { attemptId: worker.attemptId, workerId: worker.workerId, expectedRevision: 0, leaseDurationMs: 60000 };
type Fixture = Awaited<ReturnType<typeof recordFixture>>;
let f: Fixture;
let store: ReturnType<typeof createPharmaceuticalEvaluationPostgresV2>;
async function create(options?: Parameters<typeof recordFixture>[0]) {
  if (options) f = await recordFixture(options);
  return store.create(access, { evaluationId: id, sources: f.sources, intent: { ...f.intent, ownerId } });
}
async function isolation() {
  const r = await db.query("SELECT current_database() AS db, shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()");
  expect(r.rows).toEqual([{ db: config.database, marker: 'chatusal-m6-p2-20260925-disposable' }]);
}
async function clockPast(lease: string) {
  // Wait on server time, not a guessed client delay; bounded assertion with a short polling interval.
  await vi.waitFor(async () => { const r = await db.query('SELECT clock_timestamp()>=$1::timestamptz AS expired', [lease]); expect(r.rows[0].expired).toBe(true); }, { timeout: 5000, interval: 20 });
}
async function waiting() {
  await vi.waitFor(async () => { const r = await db.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='chatusal-p2-test' AND wait_event_type='Lock'"); expect(r.rows[0].n).toBeGreaterThan(0); }, { timeout: 5000, interval: 20 });
}
async function lockSession() {
  const c = await db.connect(); await c.query('BEGIN'); await c.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE', [access.sessionId]); return c;
}
async function unlock(c: PoolClient) { await c.query('ROLLBACK'); c.release(); }

describe.skipIf(!enabled)('P2 real isolated PostgreSQL', () => {
  beforeAll(async () => {
    db = new Pool(config);
    await isolation(); // Required before any migrations or destructive SQL.
    const tables = await db.query("SELECT to_regclass('public.pharmaceutical_evaluations_v2') AS t");
    if (!tables.rows[0].t) {
      const baseline = await db.query("SELECT to_regclass('public.users') AS t");
      if (baseline.rows[0].t) throw new Error('P2 requires a fresh disposable database');
      for (const file of ['0001_v1_baseline.sql', '0002_v2_case_versioning.sql', '0003_v2_spfa_evaluation_persistence.sql', '0004_v2_pharmaceutical_evaluation_persistence.sql']) {
        await db.query(readFileSync(`db/migrations/${file}`, 'utf8'));
      }
    }
    f = await recordFixture();
    await db.query("INSERT INTO users(id,email,password_hash,name,role) VALUES ($1,'p2@example.test','synthetic','P2','student') ON CONFLICT DO NOTHING", [ownerId]);
    await db.query("INSERT INTO cases(id,title,description,spec,ground_truth,created_by) VALUES (1,'P2 synthetic','P2','{}','{}',$1) ON CONFLICT DO NOTHING", [ownerId]);
    const cv = f.intent.caseVersionId;
    const content = { schemaVersion: '2.0', sourceOfTruth: { caseVersionId: cv, patientFacts: { caseVersionId: cv }, evaluator: { caseVersionId: cv } }, derived: { patientRuntime: { caseVersionId: cv }, teachingSummary: { caseVersionId: cv }, complianceReport: { caseVersionId: cv } } };
    await db.query("INSERT INTO case_versions(id,case_id,version_number,status,source_kind,content_format,content,created_by) VALUES ($1,1,1,'AI_DRAFT','AI_GENERATED','GENERATED_CASE_BUNDLE_V2',$2,$3) ON CONFLICT DO NOTHING", [cv, content, ownerId]);
    const status = (await db.query('SELECT status FROM case_versions WHERE id=$1', [cv])).rows[0].status;
    if (status === 'AI_DRAFT') for (const s of ['TEACHER_DRAFT','IN_REVIEW','VALIDATED','PUBLISHED']) await db.query('UPDATE case_versions SET status=$2 WHERE id=$1', [cv, s]);
    for (const session of [access.sessionId, uuid(999)]) await db.query("INSERT INTO sessions(id,user_id,case_id,case_version_id,status) VALUES ($1,$2,1,$3,'active') ON CONFLICT DO NOTHING", [session, ownerId, cv]);
  }, 30000);
  beforeEach(async () => {
    await isolation();
    await db.query('TRUNCATE public.pharmaceutical_evaluation_attempts_v2,public.pharmaceutical_evaluation_artifacts_v2,public.pharmaceutical_evaluations_v2');
    f = await recordFixture(); store = createPharmaceuticalEvaluationPostgresV2(db);
  });
  afterAll(async () => { await db?.end(); });

  it('applies all four migrations and roundtrips E3 through a new independent connection', async () => {
    await create(); await store.claim(access, id, claim);
    const done = await store.complete(access, id, worker, f.result!);
    const other = new Pool(config);
    try { const read = await createPharmaceuticalEvaluationPostgresV2(other).read(access, id); expect(read.record).toEqual(done); expect(read.artifacts).toHaveLength(2); } finally { await other.end(); }
    expect(done.intent.ownerId).toBe(ownerId);
    expect(f.d1.adjudicateBatch).toHaveBeenCalled();
  });
  it('deduplicates concurrent creation of identical intentions', async () => {
    const results = await Promise.all([create(), create(), create()]);
    expect(new Set(results.map(r => r.evaluationId)).size).toBe(1);
    expect((await db.query('SELECT count(*)::int AS n FROM pharmaceutical_evaluations_v2')).rows[0].n).toBe(1);
  });
  it('conflicts on concurrent incompatible intentions using the same key', async () => {
    const changed = { ...f.intent, ownerId, executionPlan: { ...f.intent.executionPlan, applicationVersion: 'DIFFERENT/1' } };
    const results = await Promise.allSettled([create(), store.create(access, { evaluationId: uuid(102), intent: changed, sources: f.sources })]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(r => r.status === 'rejected')).toMatchObject({ reason: { code: 'IDEMPOTENCY_CONFLICT' } });
  });
  it('permits exactly one concurrent claim', async () => {
    await create(); const r = await Promise.allSettled([store.claim(access, id, claim), store.claim(access, id, { ...claim, attemptId: uuid(22) })]);
    expect(r.filter(v => v.status === 'fulfilled')).toHaveLength(1);
    expect((await store.read(access, id)).record.attempts).toHaveLength(1);
  });
  it('idempotent completion retains the original and rejects a different payload', async () => {
    await create(); await store.claim(access, id, claim);
    const done = await store.complete(access, id, worker, f.result!);
    expect(await store.complete(access, id, worker, f.result!)).toEqual(done);
    const other = await recordFixture({ uncertain: true });
    await expect(store.complete(access, id, worker, other.result!)).rejects.toMatchObject({ code: 'COMPLETION_CONFLICT' });
    expect((await store.read(access, id)).record).toEqual(done);
  });
  it('rolls back both artifact and completion on an induced attempt write failure', async () => {
    await create(); await store.claim(access, id, claim);
    const failing: PharmaceuticalPgDatabase = { connect: async () => { const c = await db.connect(); return { release: () => c.release(), query: async (sql, values) => {
      if (sql.startsWith('UPDATE public.pharmaceutical_evaluation_attempts_v2')) throw new Error('induced private SQL detail');
      return c.query(sql, values);
    } }; } };
    await expect(createPharmaceuticalEvaluationPostgresV2(failing).complete(access, id, worker, f.result!)).rejects.toMatchObject({ code: 'PERSISTENCE_FAILURE' });
    const read = await store.read(access, id); expect(read.record.status).toBe('EVALUATING'); expect(read.artifacts).toHaveLength(1);
  });
  it('rejects completion after lease expires while waiting for a session lock', async () => {
    await create(); const active = await store.claim(access, id, { ...claim, leaseDurationMs: 700 });
    const blocker = await lockSession();
    const result = store.complete(access, id, worker, f.result!).then(() => 'unexpected', e => e.code);
    try { await waiting(); await clockPast(active.attempts[0].leaseExpiresAt); } finally { await unlock(blocker); }
    expect(await result).toBe('LEASE_EXPIRED');
    expect((await store.read(access, id)).record.status).toBe('EVALUATING');
  });
  it('checks the lease again at the SQL write and rolls back an already inserted result artifact', async () => {
    await create(); const active = await store.claim(access, id, { ...claim, leaseDurationMs: 700 });
    const delayed: PharmaceuticalPgDatabase = { connect: async () => { const c = await db.connect(); return { release: () => c.release(), query: async (sql, values) => {
      if (sql.startsWith('UPDATE public.pharmaceutical_evaluations_v2')) await clockPast(active.attempts[0].leaseExpiresAt);
      return c.query(sql, values);
    } }; } };
    await expect(createPharmaceuticalEvaluationPostgresV2(delayed).complete(access, id, worker, f.result!)).rejects.toMatchObject({ code: 'STALE_WRITE' });
    const read = await store.read(access, id); expect(read.record.status).toBe('EVALUATING'); expect(read.artifacts).toHaveLength(1);
  });
  it('expiry wins against completion; recovery fences both stale complete and stale fail', async () => {
    await create(); const active = await store.claim(access, id, { ...claim, leaseDurationMs: 200 }); await clockPast(active.attempts[0].leaseExpiresAt);
    const races = await Promise.allSettled([store.expire(access, id, worker), store.complete(access, id, worker, f.result!)]);
    expect(races[0].status).toBe('fulfilled'); expect(races[1].status).toBe('rejected');
    const recovered = await store.claim(access, id, { ...claim, expectedRevision: 2, attemptId: uuid(23) });
    expect(recovered.attempts[0]).toMatchObject({ status: 'FAILED', failure: { code: 'LEASE_EXPIRED' } });
    expect(recovered.attempts[1].fencingToken).toBe(2);
    await expect(store.complete(access, id, worker, f.result!)).rejects.toMatchObject({ code: 'STALE_WORKER' });
    await expect(store.fail(access, id, worker, { lane: 'D2', code: 'PROVIDER_FAILURE' })).rejects.toMatchObject({ code: 'STALE_WORKER' });
  });
  it('completion before expiry cannot later be expired or replaced', async () => {
    await create(); await store.claim(access, id, claim); await store.complete(access, id, worker, f.result!);
    await expect(store.expire(access, id, worker)).rejects.toBeDefined();
    for (const sql of ["UPDATE pharmaceutical_evaluations_v2 SET revision=revision+1", "UPDATE pharmaceutical_evaluation_artifacts_v2 SET payload='{}'", "DELETE FROM pharmaceutical_evaluation_attempts_v2", "DELETE FROM pharmaceutical_evaluations_v2"]) await expect(db.query(sql)).rejects.toBeDefined();
  });
  it('keeps failed attempts immutable and does not invent D2 results', async () => {
    await create({ d2Failure: true }); await store.claim(access, id, claim);
    const failed = await store.fail(access, id, worker, { lane: 'D2', code: 'PROVIDER_FAILURE' });
    expect(failed.status).toBe('FAILED'); expect((await store.read(access, id)).artifacts).toHaveLength(1);
    await expect(db.query("UPDATE pharmaceutical_evaluation_attempts_v2 SET payload=payload || '{\"failedAt\":\"2099-01-01T00:00:00.000Z\"}'")).rejects.toBeDefined();
  });
  it.each([{ noD2: true }, { empty: true }, { debt: true }, { uncertain: true }, { notScorable: true }, { finding: 'UNSUPPORTED' as const }])('preserves E3 D2/score/review state %j without recomputing', async option => {
    await create(option); await store.claim(access, id, claim); await store.complete(access, id, worker, f.result!);
    const stored = (await store.read(access, id)).artifacts.find(a => a.reference.kind === 'RESULT'); expect(stored?.payload).toEqual(f.result);
  });
  it('does not reveal another owner or another session evaluation', async () => {
    await create();
    await expect(store.read({ ...access, ownerId: '2' }, id)).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
    await expect(store.read({ ...access, sessionId: uuid(999) }, id)).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
    await expect(store.create(access, { evaluationId: id, sources: f.sources, intent: { ...f.intent, ownerId: '2' } })).rejects.toMatchObject({ code: 'BINDING_MISMATCH' });
  });
  it('preserves original completed record on explicit reevaluation with a new key', async () => {
    await create(); await store.claim(access, id, claim); const done = await store.complete(access, id, worker, f.result!);
    const next = await store.create(access, { evaluationId: uuid(201), sources: f.sources, intent: { ...f.intent, ownerId, idempotencyKey: uuid(202), supersedesEvaluationId: id } });
    expect(next.status).toBe('PENDING'); expect((await store.read(access, id)).record).toEqual(done);
  });
  it.each(['missing','corrupt'])('fails closed on %s source after simulated privileged corruption', async mode => {
    await create(); const c = await db.connect();
    try {
      await c.query('BEGIN'); await c.query("SET LOCAL session_replication_role='replica'");
      await c.query(mode === 'missing' ? 'DELETE FROM pharmaceutical_evaluation_artifacts_v2' : "UPDATE pharmaceutical_evaluation_artifacts_v2 SET payload='{}'");
      await c.query('COMMIT');
    } finally { c.release(); }
    await expect(store.read(access, id)).rejects.toMatchObject({ code: mode === 'missing' ? 'MISSING_ARTIFACT' : 'INTEGRITY_MISMATCH' });
  });
  it('fails closed on a missing completed result instead of regenerating it', async () => {
    await create(); await store.claim(access, id, claim); await store.complete(access, id, worker, f.result!);
    const c = await db.connect();
    try { await c.query('BEGIN'); await c.query("SET LOCAL session_replication_role='replica'"); await c.query("DELETE FROM pharmaceutical_evaluation_artifacts_v2 WHERE kind='RESULT'"); await c.query('COMMIT'); }
    finally { c.release(); }
    await expect(store.read(access, id)).rejects.toMatchObject({ code: 'MISSING_ARTIFACT' });
  });
  it('rejects incompatible case versions and malformed results without partial writes', async () => {
    await expect(store.create(access, { evaluationId: id, sources: f.sources, intent: { ...f.intent, ownerId, caseVersionId: `casever_${uuid(888)}` } })).rejects.toBeDefined();
    await create(); await store.claim(access, id, claim);
    const bad = { ...f.result!, d1: { ...f.result!.d1, contractVersion: 'invalid' } };
    await expect(store.complete(access, id, worker, bad as NonNullable<Fixture['result']>)).rejects.toBeDefined();
    expect((await store.read(access, id)).artifacts).toHaveLength(1);
  });
  it('database refuses inconsistent indexed identity and orphaned aggregate updates', async () => {
    await create();
    await expect(db.query('UPDATE pharmaceutical_evaluations_v2 SET owner_id=1')).rejects.toBeDefined();
    await expect(db.query("UPDATE pharmaceutical_evaluations_v2 SET revision=1,status='EVALUATING',header=jsonb_set(jsonb_set(header,'{revision}','1'),'{status}','\"EVALUATING\"')")).rejects.toBeDefined();
    expect((await store.read(access, id)).record.status).toBe('PENDING');
  });
  it('rejects invalid incoming source hashes before writes', async () => {
    const bad = { ...f.intent, ownerId, sources: { ...f.intent.sources, fingerprint: { ...f.intent.sources.fingerprint, value: '0'.repeat(64) } } };
    await expect(store.create(access, { evaluationId: id, intent: bad, sources: f.sources })).rejects.toBeDefined();
    expect((await db.query('SELECT count(*)::int AS n FROM pharmaceutical_evaluations_v2')).rows[0].n).toBe(0);
  });
  it('protects all three tables from unprivileged direct clients', async () => {
    await db.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='p2_unprivileged') THEN CREATE ROLE p2_unprivileged; END IF; END $$");
    const c = await db.connect();
    try { await c.query('SET ROLE p2_unprivileged'); for (const table of ['pharmaceutical_evaluations_v2','pharmaceutical_evaluation_artifacts_v2','pharmaceutical_evaluation_attempts_v2']) await expect(c.query(`SELECT * FROM public.${table}`)).rejects.toMatchObject({ code: '42501' }); }
    finally { await c.query('RESET ROLE'); c.release(); }
  });
});
