import { Pool, type PoolClient } from 'pg';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { coordinationFixture, syntheticCaseContent } from '../unit/support/pharmaceutical-coordination-fixture';
import { uuid } from '../unit/support/pharmaceutical-evaluation-record-fixture';
import { createPharmaceuticalEvaluationCoordinatorV2 } from '../../lib/cases/v2/coordinate-pharmaceutical-evaluation';
import { capturePharmaceuticalEvaluationSourcesV2 } from '../../lib/cases/v2/capture-pharmaceutical-evaluation-sources';
import { createPharmaceuticalEvaluationPostgresV2, type PharmaceuticalPgDatabase } from '../../lib/cases/v2/pharmaceutical-evaluation-postgres';
import { pharmaceuticalEvaluationSourceRefV2 } from '../../lib/cases/v2/pharmaceutical-evaluation-artifacts';
import { SPFA_SCORING_POLICY_V2_2026_1 } from '../../lib/cases/v2/spfa-scoring-policy-v2';

const enabled = process.env.RUN_PHARMACEUTICAL_P3_POSTGRES === '1';
// Explicit loopback target, unique database AND independently verified marker. Never app/PG env fallback.
const config = { host: '127.0.0.1', port: 55440, user: 'postgres', database: 'chatusal_m6_p3_disposable', ssl: false as const, application_name: 'chatusal-p3-test' };
let db: Pool, f: Awaited<ReturnType<typeof coordinationFixture>>;
async function isolated() {
  const r = await db.query("SELECT current_database() AS db,shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()");
  expect(r.rows).toEqual([{ db: config.database, marker: 'chatusal-m6-p3-20260927-disposable' }]);
}
async function freeze(c: Pool | PoolClient) {
  const t = f.sources.contextSource.transcript, p = SPFA_SCORING_POLICY_V2_2026_1;
  await c.query("UPDATE sessions SET status='finished',finished_at=clock_timestamp() WHERE id=$1", [f.access.sessionId]);
  await c.query(`INSERT INTO session_evaluation_records_v2(session_id,case_version_id,status,result_format,
    protocol_catalog_id,protocol_catalog_version,scoring_policy_id,scoring_policy_version,
    transcript_fingerprint_algorithm,transcript_fingerprint_canonicalization,transcript_fingerprint_value,
    transcript_snapshot,scoring_policy_snapshot,attempt_id,attempt_count,lease_expires_at,started_at)
    VALUES ($1,$2,'EVALUATING','SPFA_SESSION_EVALUATION_V2','foro-af-fc','2024',$3,$4,'sha256','session-transcript-v2/1',$5,$6,$7,$8,1,clock_timestamp()+interval '1 minute',clock_timestamp())`,
  [t.sessionId,t.caseVersionId,p.policyRef.id,p.policyRef.version,t.fingerprint.value,t,p,`spfa_eval_attempt_${uuid(500)}`]);
}
async function seed(options?: Parameters<typeof coordinationFixture>[0], frozen = true) {
  await isolated();
  await db.query('TRUNCATE pharmaceutical_evaluation_attempts_v2,pharmaceutical_evaluation_artifacts_v2,pharmaceutical_evaluations_v2,session_evaluation_records_v2,evaluations,messages,sessions,case_assignments,case_version_status_events,case_versions,cases,users RESTART IDENTITY CASCADE');
  f = await coordinationFixture(options);
  await db.query("INSERT INTO users(id,email,password_hash,name,role) VALUES(1,'p3@example.test','synthetic','P3','student'),(2,'other@example.test','synthetic','Other','student')");
  await db.query("INSERT INTO cases(id,title,description,spec,ground_truth,created_by) VALUES(1,'P3 synthetic','P3','{}','{}',1)");
  await db.query("INSERT INTO case_versions(id,case_id,version_number,status,source_kind,content_format,content,created_by) VALUES($1,1,1,'AI_DRAFT','AI_GENERATED','GENERATED_CASE_BUNDLE_V2',$2,1)", [f.intent.caseVersionId, syntheticCaseContent(f)]);
  for (const s of ['TEACHER_DRAFT','IN_REVIEW','VALIDATED','PUBLISHED']) await db.query('UPDATE case_versions SET status=$2 WHERE id=$1',[f.intent.caseVersionId,s]);
  await db.query("INSERT INTO sessions(id,user_id,case_id,case_version_id,status) VALUES($1,1,1,$2,'active')",[f.access.sessionId,f.intent.caseVersionId]);
  for (const m of f.sources.contextSource.transcript.messages) await db.query('INSERT INTO messages(id,session_id,role,content,created_at) VALUES($1,$2,$3,$4,$5)',[m.messageId,f.access.sessionId,m.role,m.content,m.createdAt]);
  if (frozen) { const c = await db.connect(); try { await c.query('BEGIN'); await freeze(c); await c.query('COMMIT'); } finally { c.release(); } }
}
function coordinator(database: PharmaceuticalPgDatabase = db) {
  return createPharmaceuticalEvaluationCoordinatorV2({ database, execution: f.execution, settings: f.settings });
}
function intercepted(handler: (sql: string, c: PoolClient, values?: unknown[]) => Promise<boolean>): PharmaceuticalPgDatabase {
  return { connect: async () => { const c = await db.connect(); return { release: () => c.release(), query: async (sql, values) => {
    if (await handler(sql,c,values)) throw new Error('P3 injected connection uncertainty');
    return c.query(sql,values);
  } }; } };
}
async function waitPast(time: string) {
  await vi.waitFor(async () => expect((await db.query('SELECT clock_timestamp()>=$1::timestamptz AS expired',[time])).rows[0].expired).toBe(true), { timeout: 5000, interval: 20 });
}
describe.skipIf(!enabled)('P3 isolated PostgreSQL + real E3 + fake runtimes', () => {
  beforeAll(async () => {
    db = new Pool(config); await isolated();
    const r = await db.query("SELECT to_regclass('public.pharmaceutical_evaluations_v2') AS t");
    if (!r.rows[0].t) {
      expect((await db.query("SELECT to_regclass('public.users') AS t")).rows[0].t).toBeNull();
      for (const file of ['0001_v1_baseline.sql','0002_v2_case_versioning.sql','0003_v2_spfa_evaluation_persistence.sql','0004_v2_pharmaceutical_evaluation_persistence.sql']) await db.query(readFileSync(`db/migrations/${file}`,'utf8'));
    }
  }, 30000);
  beforeEach(async () => seed());
  afterAll(async () => db?.end());
  it('identical captured/stored/consumed sources, independent readback, and no retained locks in E3', async () => {
    const captured = await capturePharmaceuticalEvaluationSourcesV2(db,f.access,f.settings);
    const original = f.d1.adjudicateBatch.getMockImplementation()!;
    f.d1.adjudicateBatch.mockImplementation(async r => {
      const c = await db.connect(); try { await c.query('BEGIN'); await c.query("SET LOCAL lock_timeout='100ms'");
        await c.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE NOWAIT',[f.access.sessionId]);
        await c.query('SELECT evaluation_id FROM pharmaceutical_evaluations_v2 WHERE evaluation_id=$1 FOR UPDATE NOWAIT',[f.command.evaluationId]);
        await c.query('ROLLBACK');
      } finally { c.release(); }
      expect(r.contextFingerprint).toEqual(captured.context.fingerprint);
      return original(r);
    });
    const api = coordinator(), result = await api.run(f.access,f.command); expect(result.outcome).toBe('COMPLETED');
    const other = new Pool(config);
    try {
      const stored = await createPharmaceuticalEvaluationPostgresV2(other).read(f.access,f.command.evaluationId);
      expect(stored.record.intent.sources).toEqual(pharmaceuticalEvaluationSourceRefV2(captured));
      expect(stored.artifacts.find(e => e.reference.kind === 'SOURCES')?.payload).toEqual(captured);
      expect(stored.artifacts.find(e => e.reference.kind === 'RESULT')?.payload).toHaveProperty('score.receipt');
    } finally { await other.end(); }
    expect(f.d1.adjudicateBatch).toHaveBeenCalledTimes(3); expect(f.d2.detectClaims).toHaveBeenCalledTimes(1);
    await api.run(f.access,f.command); expect(f.d1.adjudicateBatch).toHaveBeenCalledTimes(3); expect(f.d2.detectClaims).toHaveBeenCalledTimes(1);
  });
  it('two concurrent requests execute one set of batches only', async () => {
    const api = coordinator(); const results = await Promise.allSettled([api.run(f.access,f.command),api.run(f.access,{ ...f.command, attemptId: uuid(105) })]);
    expect(results.some(r => r.status === 'fulfilled' && r.value.outcome === 'COMPLETED')).toBe(true);
    expect(f.d1.adjudicateBatch).toHaveBeenCalledTimes(3); expect(f.d2.detectClaims).toHaveBeenCalledTimes(1);
  });
  it('capture waits for existing freeze transaction; writes after freeze fail', async () => {
    await seed(undefined,false); const freezer = await db.connect();
    try {
      await freezer.query('BEGIN'); await freezer.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE',[f.access.sessionId]);
      await freeze(freezer); let finished = false;
      const capture = capturePharmaceuticalEvaluationSourcesV2(db,f.access,f.settings).then(v => { finished = true; return v; });
      const writer = db.query("INSERT INTO messages(session_id,role,content) VALUES($1,'student','late')",[f.access.sessionId])
        .then(() => 'unexpected success', (e: { code: string }) => e.code);
      await vi.waitFor(async () => expect((await db.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE application_name='chatusal-p3-test' AND wait_event_type='Lock'")).rows[0].n).toBeGreaterThan(0));
      expect(finished).toBe(false); await freezer.query('COMMIT'); await capture;
      expect(await writer).toBe('55000');
    } finally { await freezer.query('ROLLBACK'); freezer.release(); }
  });
  it('active sessions are rejected without closing them', async () => {
    await seed(undefined,false); await expect(coordinator().run(f.access,f.command)).rejects.toMatchObject({ code: 'FROZEN_SOURCE_REQUIRED' });
    expect((await db.query('SELECT status FROM sessions WHERE id=$1',[f.access.sessionId])).rows[0].status).toBe('active'); expect(f.d1.adjudicateBatch).not.toHaveBeenCalled();
  });
  it.each(['D1','D2'])('%s failure persists FAILED with no fictitious result or retry', async lane => {
    if (lane === 'D1') f.d1.adjudicateBatch.mockRejectedValueOnce(new Error('private')); else f.d2.detectClaims.mockRejectedValueOnce(new Error('private'));
    const api = coordinator(); await expect(api.run(f.access,f.command)).rejects.toMatchObject({ code: 'EVALUATION_FAILED' });
    const read = await api.read(f.access,f.command.evaluationId); expect(read.record.status).toBe('FAILED'); expect(read.artifacts).toHaveLength(1);
    const n = f.d1.adjudicateBatch.mock.calls.length; expect((await api.run(f.access,f.command)).outcome).toBe('NOT_EXECUTED'); expect(f.d1.adjudicateBatch).toHaveBeenCalledTimes(n);
  });
  it('expired/recovered lease rejects stale completion and preserves both attempts', async () => {
    const original = f.d2.detectClaims.getMockImplementation()!;
    f.d2.detectClaims.mockImplementation(async () => {
      const store = createPharmaceuticalEvaluationPostgresV2(db), read = await store.read(f.access,f.command.evaluationId), a = read.record.attempts[0];
      await waitPast(a.leaseExpiresAt);
      await store.expire(f.access,f.command.evaluationId,{ attemptId: a.attemptId, workerId: a.workerId, fencingToken: a.fencingToken, expectedRevision: read.record.revision });
      await store.claim(f.access,f.command.evaluationId,{ attemptId: uuid(700),workerId: uuid(701),expectedRevision: 2,leaseDurationMs: 60000 });
      return original();
    });
    const api = coordinator(); const r = await api.run(f.access,{ ...f.command,leaseDurationMs: 600 }); expect(r.outcome).toBe('COMPLETION_UNCONFIRMED');
    const read = await api.read(f.access,f.command.evaluationId); expect(read.record.attempts.map(a => a.status)).toEqual(['FAILED','EVALUATING']); expect(read.artifacts).toHaveLength(1);
  });
  it('unknown claim commit never starts E3 on retry', async () => {
    let count = 0;
    const database = intercepted(async (sql,c) => {
      // Capture, create, then claim commit. The third commits but loses its reply.
      if (sql === 'COMMIT' && ++count === 3) { await c.query(sql); return true; } return false;
    });
    const api = coordinator(database); await expect(api.run(f.access,f.command)).rejects.toMatchObject({ code: 'CLAIM_OUTCOME_UNKNOWN' });
    expect((await api.run(f.access,f.command)).outcome).toBe('NOT_EXECUTED'); expect(f.d1.adjudicateBatch).not.toHaveBeenCalled();
  });
  it('completion write failure can recover writes only', async () => {
    let fail = true; const database = intercepted(async sql => {
      if (fail && sql.startsWith('INSERT INTO public.pharmaceutical_evaluation_artifacts_v2')) {
        // First artefact is SOURCES. Failure is armed by the fake D2 below.
        return armed;
      } return false;
    }); let armed = false;
    const original = f.d2.detectClaims.getMockImplementation()!; f.d2.detectClaims.mockImplementation(async () => { armed = true; return original(); });
    const api = coordinator(database), r = await api.run(f.access,f.command); expect(r.outcome).toBe('COMPLETION_UNCONFIRMED');
    fail = false; if (r.outcome !== 'COMPLETION_UNCONFIRMED') throw new Error('expected recovery');
    expect((await api.recoverCompletion(r.recovery)).outcome).toBe('COMPLETED'); expect(f.d2.detectClaims).toHaveBeenCalledTimes(1);
  });
  it('lost completion reply recovers the stored result', async () => {
    let completion = false, lost = false;
    const database = intercepted(async (sql,c) => {
      if (sql.startsWith('UPDATE public.pharmaceutical_evaluation_attempts_v2')) completion = true;
      if (completion && !lost && sql === 'COMMIT') { lost = true; await c.query(sql); return true; } return false;
    });
    expect((await coordinator(database).run(f.access,f.command)).outcome).toBe('COMPLETED'); expect(f.d2.detectClaims).toHaveBeenCalledTimes(1);
  });
  it('isolates owner and unknown session without revealing their contents', async () => {
    const api = coordinator();
    await expect(api.run({ ...f.access, ownerId:'2' },f.command)).rejects.toMatchObject({ code:'NOT_AVAILABLE' });
    await expect(api.run({ ...f.access, sessionId:uuid(999) },f.command)).rejects.toMatchObject({ code:'NOT_AVAILABLE' });
    expect(f.d1.adjudicateBatch).not.toHaveBeenCalled();
  });
  it.each([{ noD2:true },{ empty:true },{ debt:true },{ uncertain:true },{ notScorable:true }])('preserves state %j through DB/E3', async options => {
    await seed(options); const r = await coordinator().run(f.access,f.command); expect(r.outcome).toBe('COMPLETED');
    if (r.outcome !== 'COMPLETED') throw new Error('expected completion');
    expect(r.stored.record.intent.d1SemanticAcceptance).toBe(f.intent.d1SemanticAcceptance);
    expect(f.d2.detectClaims).toHaveBeenCalledTimes('noD2' in options || 'empty' in options ? 0 : 1);
  });
});
