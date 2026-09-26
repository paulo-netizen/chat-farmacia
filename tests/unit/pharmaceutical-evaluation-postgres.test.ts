import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
vi.mock('server-only', () => ({}));
import { createPharmaceuticalEvaluationPostgresV2 } from '../../lib/cases/v2/pharmaceutical-evaluation-postgres';
import { uuid } from './support/pharmaceutical-evaluation-record-fixture';

describe('P2 explicit server persistence boundary (offline)', () => {
  it.each(['0', '-1', '01', '1.5', '9223372036854775808', '', 9007199254740992])('rejects unsafe owner identity %s before connecting', async ownerId => {
    const connect = vi.fn();
    const store = createPharmaceuticalEvaluationPostgresV2({ connect });
    await expect(store.read({ ownerId: ownerId as string, sessionId: uuid(1) }, uuid(2))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(connect).not.toHaveBeenCalled();
  });
  it('binds bigint owner as a decimal string and hides ownership errors', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 })), release = vi.fn();
    const store = createPharmaceuticalEvaluationPostgresV2({ connect: async () => ({ query, release }) });
    await expect(store.read({ ownerId: '9007199254740993', sessionId: uuid(1) }, uuid(2))).rejects.toMatchObject({ message: 'NOT_AVAILABLE' });
    expect(query.mock.calls[1]).toEqual(['SELECT case_version_id FROM public.sessions WHERE id=$1 AND user_id=$2::bigint FOR UPDATE', [uuid(1), '9007199254740993']]);
    expect(release).toHaveBeenCalledOnce();
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
  it('sanitizes connection errors without exposing SQL, credentials or clinical content', async () => {
    const store = createPharmaceuticalEvaluationPostgresV2({ connect: async () => { throw new Error('private connection and clinical text'); } });
    await expect(store.read({ ownerId: '1', sessionId: uuid(1) }, uuid(2))).rejects.toMatchObject({ message: 'PERSISTENCE_FAILURE' });
  });
  it('sanitizes non-cloneable inputs before any IO', async () => {
    const connect = vi.fn(); const store = createPharmaceuticalEvaluationPostgresV2({ connect });
    await expect(store.fail({ ownerId: '1', sessionId: uuid(1) }, uuid(2),
      { attemptId: uuid(3), workerId: uuid(4), fencingToken: 1, expectedRevision: 1, extra: () => 'private clinical text' } as Parameters<typeof store.fail>[2],
      { lane: 'D2', code: 'PROVIDER_FAILURE' })).rejects.toMatchObject({ message: 'INVALID_INPUT' });
    expect(connect).not.toHaveBeenCalled();
  });
  it('has no implicit pool, environment fallback or semantic execution', () => {
    const source = readFileSync('lib/cases/v2/pharmaceutical-evaluation-postgres.ts', 'utf8');
    expect(source).toContain("import 'server-only'");
    expect(source).not.toMatch(/process\.env|from ['"].*lib\/db|responses\.parse|evaluatePharmaceuticalSessionV2/);
    expect(source).toContain('clock_timestamp()');
  });
  it('migration is additive, protected, deferred and contains no cascading deletion', () => {
    const sql = readFileSync('db/migrations/0004_v2_pharmaceutical_evaluation_persistence.sql', 'utf8');
    expect(sql).toContain('UNIQUE (owner_id,session_id,idempotency_key)');
    expect(sql).toContain('DEFERRABLE INITIALLY DEFERRED');
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(3);
    expect(sql).not.toMatch(/ON DELETE CASCADE|ALTER TABLE public\.(sessions|session_evaluation_records_v2)/);
  });
});
