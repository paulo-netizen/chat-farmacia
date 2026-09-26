import 'server-only';
import { z } from 'zod';
import {
  evaluationIdSchema, evaluationIntentSchema, evaluationFailureSchema,
  sourceArtifactRefSchema as sourceRef, resultArtifactRefSchema as resultRef,
  type PharmaceuticalEvaluationArtifactRefV2, type PharmaceuticalEvaluationRecordV2,
  type PharmaceuticalEvaluationResultV2, type PharmaceuticalEvaluationSourcesV2,
} from './pharmaceutical-evaluation-record-types';
import {
  createPharmaceuticalEvaluationRecordV2, validatePharmaceuticalEvaluationRecordV2,
  claimPharmaceuticalEvaluationV2, completePharmaceuticalEvaluationV2,
  failPharmaceuticalEvaluationV2, expirePharmaceuticalEvaluationV2,
  type PharmaceuticalEvaluationWorkerV2,
} from './pharmaceutical-evaluation-lifecycle';
import { pharmaceuticalEvaluationSourceRefV2, pharmaceuticalEvaluationResultRefV2,
  resolvePharmaceuticalEvaluationArtifactV2 } from './pharmaceutical-evaluation-artifacts';
import { PharmaceuticalEvaluationRecordError, recordEqual, recordParse } from './pharmaceutical-evaluation-record-utils';

/** Explicit dependency: never imports the application's pool or reads connection environment variables. */
export interface PharmaceuticalPgClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: readonly unknown[]; rowCount: number | null }>;
  release(): void;
}
export interface PharmaceuticalPgDatabase { connect(): Promise<PharmaceuticalPgClient> }
export class PharmaceuticalPersistenceError extends Error {
  constructor(readonly code: 'NOT_AVAILABLE' | 'INVALID_INPUT' | 'PERSISTENCE_FAILURE' | 'STALE_WRITE') {
    super(code); this.name = 'PharmaceuticalPersistenceError';
  }
}
// pg bigint identities stay decimal strings, including values above Number.MAX_SAFE_INTEGER.
const ownerSchema = z.string().regex(/^[1-9][0-9]*$/).refine(v => v.length <= 19 && /^[1-9][0-9]*$/.test(v) && BigInt(v) <= 9223372036854775807n);
const accessSchema = z.object({ ownerId: ownerSchema, sessionId: evaluationIdSchema }).strict();
export type PharmaceuticalPersistenceAccess = z.infer<typeof accessSchema>;
type Entry = { reference: PharmaceuticalEvaluationArtifactRefV2; payload: unknown };
const unavailable = (): never => { throw new PharmaceuticalPersistenceError('NOT_AVAILABLE'); };
function snapshot<T>(input: T): T {
  try { return structuredClone(input); } catch { throw new PharmaceuticalPersistenceError('INVALID_INPUT'); }
}
function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  const p = schema.safeParse(input);
  if (!p.success) throw new PharmaceuticalPersistenceError('INVALID_INPUT');
  return p.data;
}
const resolveEntries = (entries: readonly Entry[]) => (ref: PharmaceuticalEvaluationArtifactRefV2) => {
  const entry = entries.find(e => e.reference.fingerprint.value === ref.fingerprint.value);
  if (entry) recordEqual(entry.reference, ref, 'INTEGRITY_MISMATCH');
  return entry?.payload;
};
function header(record: PharmaceuticalEvaluationRecordV2) {
  const { attempts: _attempts, ...value } = record; return value;
}

/** Server caller must supply an authenticated principal. This store independently checks DB ownership.
 * Reevaluation authorization remains a caller responsibility; a supersedes ID is not an authorization.
 * All locks follow session -> evaluation -> artifacts/attempts, avoiding cross-evaluation lock inversion.
 */
export function createPharmaceuticalEvaluationPostgresV2(database: PharmaceuticalPgDatabase) {
  async function transaction<T>(accessInput: PharmaceuticalPersistenceAccess, body: (c: PharmaceuticalPgClient, access: PharmaceuticalPersistenceAccess) => Promise<T>) {
    const access = parse(accessSchema, accessInput);
    let client: PharmaceuticalPgClient | undefined;
    try {
      client = await database.connect();
      await client.query('BEGIN');
      const owned = await client.query('SELECT case_version_id FROM public.sessions WHERE id=$1 AND user_id=$2::bigint FOR UPDATE', [access.sessionId, access.ownerId]);
      if (owned.rows.length !== 1) unavailable();
      const result = await body(client, access);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (client) { try { await client.query('ROLLBACK'); } catch { /* never expose SQL/connection text */ } }
      if (error instanceof PharmaceuticalPersistenceError || error instanceof PharmaceuticalEvaluationRecordError) throw error;
      throw new PharmaceuticalPersistenceError('PERSISTENCE_FAILURE');
    } finally { client?.release(); }
  }
  async function now(c: PharmaceuticalPgClient): Promise<string> {
    // Not transaction_timestamp/now(): transactions may have waited past lease expiry.
    const r = await c.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS time`);
    return parse(z.object({ time: z.string() }), r.rows[0]).time;
  }
  async function load(c: PharmaceuticalPgClient, access: PharmaceuticalPersistenceAccess, evaluationId: string) {
    const rows = await c.query('SELECT header FROM public.pharmaceutical_evaluations_v2 WHERE evaluation_id=$1 AND owner_id=$2::bigint AND session_id=$3 FOR UPDATE', [parse(evaluationIdSchema, evaluationId), access.ownerId, access.sessionId]);
    if (rows.rows.length !== 1) unavailable();
    const stored = parse(z.object({ header: z.record(z.unknown()) }), rows.rows[0]).header;
    const a = await c.query('SELECT payload FROM public.pharmaceutical_evaluation_attempts_v2 WHERE evaluation_id=$1 ORDER BY fencing_token', [evaluationId]);
    const artifacts = await c.query('SELECT reference,payload FROM public.pharmaceutical_evaluation_artifacts_v2 WHERE evaluation_id=$1', [evaluationId]);
    const entries: Entry[] = artifacts.rows.map(v => {
      const item = parse(z.object({ reference: z.unknown(), payload: z.unknown() }), v);
      // P1 checks exact references, canonical hashes and source/result shapes on use.
      const ref = parse(z.object({ kind: z.enum(['SOURCES','RESULT']) }).passthrough(), item.reference);
      const reference = recordParse(ref.kind === 'SOURCES' ? sourceRef : resultRef, item.reference);
      return { reference, payload: item.payload };
    });
    const resolve = resolveEntries(entries);
    for (const e of entries) resolvePharmaceuticalEvaluationArtifactV2(e.reference, resolve);
    const record = validatePharmaceuticalEvaluationRecordV2({ ...stored, attempts: a.rows.map(v => parse(z.object({ payload: z.unknown() }), v).payload) }, resolve);
    recordEqual([record.intent.ownerId, record.intent.sessionId], [access.ownerId, access.sessionId]);
    const session = await c.query('SELECT case_version_id FROM public.sessions WHERE id=$1', [access.sessionId]);
    recordEqual(record.intent.caseVersionId, parse(z.object({ case_version_id: z.string() }), session.rows[0]).case_version_id);
    return { record, entries, resolve };
  }
  async function putArtifact(c: PharmaceuticalPgClient, id: string, entry: Entry) {
    await c.query('INSERT INTO public.pharmaceutical_evaluation_artifacts_v2(evaluation_id,artifact_hash,kind,reference,payload) VALUES ($1,$2,$3,$4,$5)',
      [id, entry.reference.fingerprint.value, entry.reference.kind, entry.reference, entry.payload]);
  }
  async function save(c: PharmaceuticalPgClient, old: PharmaceuticalEvaluationRecordV2, next: PharmaceuticalEvaluationRecordV2) {
    if (old.revision === next.revision) return;
    const a = next.attempts.at(-1)!;
    // Last-moment lease check is also inside the SQL write, after synchronous P1 validation.
    const oldAttempt = old.attempts.at(-1);
    const withinLease = old.status === 'EVALUATING' && !(a.status === 'FAILED' && a.failure.code === 'LEASE_EXPIRED');
    const updated = await c.query(`UPDATE public.pharmaceutical_evaluations_v2 SET header=$1,revision=$2,status=$3
      WHERE evaluation_id=$4 AND revision=$5 AND (NOT $6::boolean OR clock_timestamp() < $7::timestamptz)`,
      [header(next), next.revision, next.status, next.evaluationId, old.revision, withinLease, oldAttempt?.leaseExpiresAt ?? null]);
    if (updated.rowCount !== 1) throw new PharmaceuticalPersistenceError('STALE_WRITE');
    if (a.fencingToken > old.attempts.length) {
      await c.query(`INSERT INTO public.pharmaceutical_evaluation_attempts_v2(evaluation_id,attempt_id,fencing_token,status,lease_expires_at,result_hash,payload) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [next.evaluationId, a.attemptId, a.fencingToken, a.status, a.leaseExpiresAt, a.status === 'COMPLETED' ? a.result.fingerprint.value : null, a]);
    } else {
      const changed = await c.query(`UPDATE public.pharmaceutical_evaluation_attempts_v2 SET status=$1,result_hash=$2,payload=$3
        WHERE evaluation_id=$4 AND attempt_id=$5 AND fencing_token=$6 AND status='EVALUATING'`,
        [a.status, a.status === 'COMPLETED' ? a.result.fingerprint.value : null, a, next.evaluationId, a.attemptId, a.fencingToken]);
      if (changed.rowCount !== 1) throw new PharmaceuticalPersistenceError('STALE_WRITE');
    }
  }
  return {
    async create(access: PharmaceuticalPersistenceAccess, input: { evaluationId: string; intent: unknown; sources: PharmaceuticalEvaluationSourcesV2 }) {
      const copy = snapshot(input);
      const intent = parse(evaluationIntentSchema, copy.intent);
      const id = parse(evaluationIdSchema, copy.evaluationId);
      const reference = pharmaceuticalEvaluationSourceRefV2(copy.sources);
      recordEqual(reference, intent.sources);
      return transaction(access, async (c, principal) => {
        recordEqual([intent.ownerId, intent.sessionId], [principal.ownerId, principal.sessionId]);
        const session = await c.query('SELECT case_version_id FROM public.sessions WHERE id=$1', [principal.sessionId]);
        recordEqual(intent.caseVersionId, parse(z.object({ case_version_id: z.string() }), session.rows[0]).case_version_id);
        const found = await c.query('SELECT evaluation_id::text FROM public.pharmaceutical_evaluations_v2 WHERE owner_id=$1::bigint AND session_id=$2 AND idempotency_key=$3', [principal.ownerId, principal.sessionId, intent.idempotencyKey]);
        const existing = found.rows.length ? await load(c, principal, parse(z.object({ evaluation_id: z.string() }), found.rows[0]).evaluation_id) : undefined;
        const previous = !existing && intent.supersedesEvaluationId ? await load(c, principal, intent.supersedesEvaluationId) : undefined;
        const entries = [...(existing?.entries ?? previous?.entries ?? []), { reference, payload: copy.sources }];
        const record = createPharmaceuticalEvaluationRecordV2({ evaluationId: id, createdAt: await now(c), intent, existing: existing?.record, previous: previous?.record }, resolveEntries(entries));
        if (existing) return record;
        await c.query(`INSERT INTO public.pharmaceutical_evaluations_v2(evaluation_id,owner_id,session_id,case_version_id,idempotency_key,supersedes_id,revision,status,source_hash,header) VALUES ($1,$2::bigint,$3,$4,$5,$6,0,'PENDING',$7,$8)`,
          [id, principal.ownerId, principal.sessionId, intent.caseVersionId, intent.idempotencyKey, intent.supersedesEvaluationId, reference.fingerprint.value, header(record)]);
        await putArtifact(c, id, { reference, payload: copy.sources });
        return record;
      });
    },
    async read(access: PharmaceuticalPersistenceAccess, evaluationId: string) {
      return transaction(access, async (c, principal) => {
        const loaded = await load(c, principal, evaluationId);
        return { record: loaded.record, artifacts: structuredClone(loaded.entries) };
      });
    },
    async claim(access: PharmaceuticalPersistenceAccess, evaluationId: string, input: { attemptId: string; workerId: string; expectedRevision: number; leaseDurationMs: number }) {
      const p = parse(z.object({ attemptId: evaluationIdSchema, workerId: evaluationIdSchema, expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), leaseDurationMs: z.number().int().positive().max(86400000) }).strict(), input);
      return transaction(access, async (c, principal) => {
        const { record, resolve } = await load(c, principal, evaluationId);
        const time = await now(c);
        const next = claimPharmaceuticalEvaluationV2(record, { attemptId: p.attemptId, workerId: p.workerId, expectedRevision: p.expectedRevision,
          fencingToken: record.attempts.length + 1, now: time, leaseExpiresAt: new Date(Date.parse(time) + p.leaseDurationMs).toISOString() }, resolve);
        await save(c, record, next); return next;
      });
    },
    async complete(access: PharmaceuticalPersistenceAccess, evaluationId: string, worker: PharmaceuticalEvaluationWorkerV2, result: PharmaceuticalEvaluationResultV2) {
      const payload = snapshot(result), w = snapshot(worker);
      const reference = pharmaceuticalEvaluationResultRefV2(payload);
      return transaction(access, async (c, principal) => {
        const { record, entries } = await load(c, principal, evaluationId);
        const next = completePharmaceuticalEvaluationV2(record, w, await now(c), reference, resolveEntries([...entries, { reference, payload }]));
        if (next.revision !== record.revision) { await putArtifact(c, evaluationId, { reference, payload }); await save(c, record, next); }
        return next;
      });
    },
    async fail(access: PharmaceuticalPersistenceAccess, evaluationId: string, worker: PharmaceuticalEvaluationWorkerV2, failure: unknown) {
      const w = snapshot(worker), f = parse(evaluationFailureSchema, failure);
      return transaction(access, async (c, principal) => {
        const { record, resolve } = await load(c, principal, evaluationId);
        const next = failPharmaceuticalEvaluationV2(record, w, await now(c), f, resolve);
        await save(c, record, next); return next;
      });
    },
    async expire(access: PharmaceuticalPersistenceAccess, evaluationId: string, worker: PharmaceuticalEvaluationWorkerV2) {
      const w = snapshot(worker);
      return transaction(access, async (c, principal) => {
        const { record, resolve } = await load(c, principal, evaluationId);
        const next = expirePharmaceuticalEvaluationV2(record, w, await now(c), resolve);
        await save(c, record, next); return next;
      });
    },
  };
}
