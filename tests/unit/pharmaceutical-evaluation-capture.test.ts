import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { capturePharmaceuticalEvaluationSourcesV2 } from '../../lib/cases/v2/capture-pharmaceutical-evaluation-sources';
import { coordinationFixture, syntheticCaseContent } from './support/pharmaceutical-coordination-fixture';
import type { PharmaceuticalPgDatabase } from '../../lib/cases/v2/pharmaceutical-evaluation-postgres';

async function setup() {
  const f = await coordinationFixture(); const content = syntheticCaseContent(f);
  const t = f.sources.contextSource.transcript;
  const anchor = { case_id: '1', case_version_id: t.caseVersionId, status: 'finished', version_status: 'PUBLISHED',
    source_kind: 'AI_GENERATED', legacy_status: null, content_format: 'GENERATED_CASE_BUNDLE_V2', content };
  const frozen = { case_version_id: t.caseVersionId, transcript_snapshot: t, transcript_fingerprint_value: t.fingerprint.value };
  const messages = t.messages.map(m => ({ id: m.messageId, role: m.role, content: m.content, created_at: m.createdAt }));
  const client = { release: vi.fn(), query: vi.fn(async (sql: string) => ({ rowCount: 1, rows:
    sql.includes('JOIN public.case_versions') ? [anchor] : sql.includes('session_evaluation_records') ? [frozen] : sql.includes('FROM public.messages') ? messages : [] })) };
  const database: PharmaceuticalPgDatabase = { connect: async () => client };
  return { f, anchor, frozen, messages, client, database, run: () => capturePharmaceuticalEvaluationSourcesV2(database, f.access, f.settings) };
}
describe('P3 capture uses real canonical builders', () => {
  it('captures a persisted generated case and exact frozen transcript without closing a session', async () => {
    const s = await setup(); const value = await s.run();
    expect(value.contextSource.transcript).toEqual(s.f.sources.contextSource.transcript);
    expect(value.contextSource.clinicalReference).toEqual(s.f.sources.contextSource.clinicalReference);
    expect(value.configuration).toEqual(s.f.sources.configuration);
    expect(s.client.query.mock.calls.some(([q]) => /^\s*(UPDATE|INSERT|DELETE)\b/.test(q))).toBe(false);
    expect(s.client.query.mock.calls.at(-1)).toEqual(['COMMIT']); expect(s.client.release).toHaveBeenCalledOnce();
  });
  it.each(['active','missing','drift','binding','case','config'])('rejects %s before adjudication', async fault => {
    const s = await setup();
    if (fault === 'active') s.anchor.status = 'active';
    if (fault === 'missing') s.client.query.mockImplementation(async () => ({ rowCount: 0, rows: [] }));
    if (fault === 'drift') s.messages[0].content = 'different';
    if (fault === 'binding') s.frozen.transcript_fingerprint_value = '0'.repeat(64);
    if (fault === 'case') s.anchor.content_format = 'LEGACY_V1_SNAPSHOT';
    if (fault === 'config') Object.assign(s.f.settings, { configuration: { ...s.f.settings.configuration, policy: { ...s.f.settings.configuration.policy, rulesVersion: 'invalid' } } });
    await expect(s.run()).rejects.toThrow(); expect(s.f.d1.adjudicateBatch).not.toHaveBeenCalled();
    expect(s.client.release).toHaveBeenCalledOnce();
  });
  it('invalid identity never connects', async () => {
    const s = await setup(); const database = { connect: vi.fn() };
    await expect(capturePharmaceuticalEvaluationSourcesV2(database, { ...s.f.access, ownerId: '-1' }, s.f.settings)).rejects.toThrow('INVALID_SOURCE');
    expect(database.connect).not.toHaveBeenCalled();
  });
  it('detaches configuration before connecting', async () => {
    const s = await setup(); const p = s.run(); s.f.settings.configuration = {} as typeof s.f.settings.configuration;
    await expect(p).resolves.toHaveProperty('context');
  });
});
