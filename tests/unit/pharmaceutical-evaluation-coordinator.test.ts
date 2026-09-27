import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ capture: vi.fn(), store: vi.fn() }));
vi.mock('../../lib/cases/v2/capture-pharmaceutical-evaluation-sources', () => ({ capturePharmaceuticalEvaluationSourcesV2: mocks.capture }));
vi.mock('../../lib/cases/v2/pharmaceutical-evaluation-postgres', () => ({ createPharmaceuticalEvaluationPostgresV2: mocks.store }));
import { createPharmaceuticalEvaluationCoordinatorV2, bindPharmaceuticalEvaluationExecutionV2 } from '../../lib/cases/v2/coordinate-pharmaceutical-evaluation';
import { coordinationFixture } from './support/pharmaceutical-coordination-fixture';
import { createPharmaceuticalEvaluationRecordV2, claimPharmaceuticalEvaluationV2, completePharmaceuticalEvaluationV2, failPharmaceuticalEvaluationV2 } from '../../lib/cases/v2/pharmaceutical-evaluation-lifecycle';
import { pharmaceuticalEvaluationResultRefV2 } from '../../lib/cases/v2/pharmaceutical-evaluation-artifacts';
import type { PharmaceuticalEvaluationRecordV2, PharmaceuticalEvaluationArtifactRefV2 } from '../../lib/cases/v2/pharmaceutical-evaluation-record-types';
import { start, end, beforeEnd } from './support/pharmaceutical-evaluation-record-fixture';
import type { createPharmaceuticalEvaluationPostgresV2 } from '../../lib/cases/v2/pharmaceutical-evaluation-postgres';
type Store = ReturnType<typeof createPharmaceuticalEvaluationPostgresV2>;

async function setup(options?: Parameters<typeof coordinationFixture>[0]) {
  const f = await coordinationFixture(options);
  let record: PharmaceuticalEvaluationRecordV2 | undefined;
  const entries = new Map<string, { reference: PharmaceuticalEvaluationArtifactRefV2; payload: unknown }>();
  const resolve = (r: PharmaceuticalEvaluationArtifactRefV2) => entries.get(r.fingerprint.value)?.payload;
  const store = {
    create: vi.fn<Store['create']>(async (_a, input) => {
      const intent = f.intent.sources;
      entries.set(intent.fingerprint.value, { reference: intent, payload: input.sources });
      record = createPharmaceuticalEvaluationRecordV2({ ...input, createdAt: start, existing: record }, resolve); return record;
    }),
    read: vi.fn<Store['read']>(async () => ({ record: record!, artifacts: structuredClone([...entries.values()]) })),
    claim: vi.fn<Store['claim']>(async (_a, _id, input) => { record = claimPharmaceuticalEvaluationV2(record!, {
      attemptId: input.attemptId, workerId: input.workerId, expectedRevision: input.expectedRevision,
      fencingToken: 1, now: start, leaseExpiresAt: end }, resolve); return record; }),
    complete: vi.fn<Store['complete']>(async (_a, _id, worker, result) => {
      const reference = pharmaceuticalEvaluationResultRefV2(result);
      entries.set(reference.fingerprint.value, { reference, payload: result });
      record = completePharmaceuticalEvaluationV2(record!, worker, beforeEnd, reference, resolve); return record;
    }),
    fail: vi.fn<Store['fail']>(async (_a, _id, worker, failure) => { record = failPharmaceuticalEvaluationV2(record!, worker, beforeEnd, failure, resolve); return record; }),
  };
  mocks.capture.mockResolvedValue(f.sources); mocks.store.mockReturnValue(store);
  const database = { connect: vi.fn() };
  const coordinator = createPharmaceuticalEvaluationCoordinatorV2({ database, execution: f.execution, settings: f.settings });
  const run = () => coordinator.run(f.access, f.command);
  return { f, store, coordinator, run, database };
}
beforeEach(() => vi.clearAllMocks());
describe('P3 E3 real with synthetic runtimes', () => {
  it('invalid command keys never leak input text or start persistence', async () => {
    const { f, coordinator, store } = await setup();
    await expect(coordinator.run(f.access, { ...f.command, 'private-clinical-secret': true } as typeof f.command))
      .rejects.toMatchObject({ code: 'INVALID_CONFIGURATION', message: 'INVALID_CONFIGURATION' });
    expect(mocks.capture).not.toHaveBeenCalled(); expect(store.create).not.toHaveBeenCalled();
  });
  it('invalid execution configuration never leaks received values', async () => {
    const { f } = await setup(); const plan = structuredClone(f.intent.executionPlan);
    if (plan.d1.mode !== 'SEMANTIC' || plan.d2.mode !== 'SEMANTIC') throw new Error('semantic fixture required');
    Object.assign(plan.d1, { requestedModel: 'private-clinical-secret' });
    expect(() => bindPharmaceuticalEvaluationExecutionV2({ ...plan, d1: plan.d1 as Extract<typeof plan.d1, { mode: 'SEMANTIC' }>, d2: plan.d2 as Extract<typeof plan.d2, { mode: 'SEMANTIC' }> }, {
      d1: request => f.d1.adjudicateBatch(request), d2: () => f.d2.detectClaims(),
      allocateD1ExecutionId: () => 'unused', allocateD2ExecutionId: () => 'unused',
    })).toThrowError(expect.objectContaining({ code: 'INVALID_CONFIGURATION', message: 'INVALID_CONFIGURATION' }));
  });
  it('persists/readbacks the source used by real E3 and returns no witnesses', async () => {
    const { f, store, run } = await setup({ debt: true });
    const r = await run(); expect(r.outcome).toBe('COMPLETED');
    expect(store.read).toHaveBeenCalledTimes(2);
    expect(store.complete).toHaveBeenCalledTimes(1);
    expect(f.d2.detectClaims).toHaveBeenCalledTimes(1);
    if (r.outcome !== 'COMPLETED') throw new Error('expected completion');
    expect(r.stored.record.intent.sources).toEqual(f.intent.sources);
    expect(r.stored.record.intent.d1SemanticAcceptance).toBe('VALIDATION_DEBT');
    expect(Object.keys(r.stored.artifacts.find(e => e.reference.kind === 'RESULT')!.payload as object)).toEqual(['d1','d2','score']);
  });
  it('completed repetition has zero additional adjudications', async () => {
    const { f, run } = await setup(); await run(); const calls = f.d1.adjudicateBatch.mock.calls.length;
    await run(); expect(f.d1.adjudicateBatch).toHaveBeenCalledTimes(calls); expect(f.d2.detectClaims).toHaveBeenCalledTimes(1);
  });
  it.each([{ noD2: true }, { empty: true }, { uncertain: true }, { notScorable: true }, { finding: 'UNSUPPORTED' as const }])('preserves D2/score states %j', async o => {
    const { f, run } = await setup(o); expect((await run()).outcome).toBe('COMPLETED');
    expect(f.d2.detectClaims).toHaveBeenCalledTimes('noD2' in o || 'empty' in o ? 0 : 1);
  });
  it('prevalidation failure performs no adjudications', async () => {
    const { f, run, store } = await setup(); mocks.capture.mockRejectedValue(new Error('safe'));
    await expect(run()).rejects.toThrow(); expect(f.d1.adjudicateBatch).not.toHaveBeenCalled(); expect(store.create).not.toHaveBeenCalled();
  });
  it('unknown claim outcome never runs E3, and a subsequent run cannot restart it', async () => {
    const { f, store, run } = await setup(); const claim = store.claim.getMockImplementation()!;
    store.claim.mockImplementationOnce(async (...args) => { await claim(...args); throw new Error('connection lost'); });
    await expect(run()).rejects.toMatchObject({ code: 'CLAIM_OUTCOME_UNKNOWN' });
    expect((await run()).outcome).toBe('NOT_EXECUTED'); expect(f.d1.adjudicateBatch).not.toHaveBeenCalled();
  });
  it('unconfirmed completion allows write-only recovery, never E3 again', async () => {
    const { f, store, run, coordinator } = await setup(); store.complete.mockRejectedValueOnce(new Error('write failed'));
    const r = await run(); expect(r.outcome).toBe('COMPLETION_UNCONFIRMED');
    const calls = f.d1.adjudicateBatch.mock.calls.length;
    expect((await run()).outcome).toBe('NOT_EXECUTED');
    if (r.outcome !== 'COMPLETION_UNCONFIRMED') throw new Error('recovery expected');
    expect((await coordinator.recoverCompletion(r.recovery)).outcome).toBe('COMPLETED');
    expect(f.d1.adjudicateBatch).toHaveBeenCalledTimes(calls); expect(f.d2.detectClaims).toHaveBeenCalledTimes(1);
  });
  it('lost completion reply recovers committed result without semantic retry', async () => {
    const { f, store, run } = await setup(); const complete = store.complete.getMockImplementation()!;
    store.complete.mockImplementationOnce(async (...args) => { await complete(...args); throw new Error('lost reply'); });
    expect((await run()).outcome).toBe('COMPLETED'); expect(f.d2.detectClaims).toHaveBeenCalledTimes(1); expect(store.fail).not.toHaveBeenCalled();
  });
  it.each(['D1','D2'])('%s failure preserves FAILED without fake result and cannot retry', async lane => {
    const { f, run, store } = await setup();
    if (lane === 'D1') f.d1.adjudicateBatch.mockRejectedValueOnce(new Error('private')); else f.d2.detectClaims.mockRejectedValueOnce(new Error('private'));
    await expect(run()).rejects.toMatchObject({ code: 'EVALUATION_FAILED' });
    expect(store.complete).not.toHaveBeenCalled(); expect((await run()).outcome).toBe('NOT_EXECUTED');
  });
  it('failure-writing error is not hidden by the upstream error', async () => {
    const { f, store, run } = await setup(); f.d1.adjudicateBatch.mockRejectedValueOnce(new Error('private')); store.fail.mockRejectedValueOnce(new Error('sql private'));
    await expect(run()).rejects.toMatchObject({ code: 'FAILURE_WRITE_UNCONFIRMED', message: 'FAILURE_WRITE_UNCONFIRMED' });
  });
  it('detaches settings and command before awaits', async () => {
    const { f, run, store } = await setup(); const p = run();
    f.command.workerId = 'changed'; f.settings.d1SemanticAcceptance = 'VALIDATION_DEBT';
    await p; expect(store.complete.mock.calls[0][2].workerId).not.toBe('changed');
    expect(store.create.mock.calls[0][1].intent).toMatchObject({ d1SemanticAcceptance: 'VALIDATED_OFFLINE' });
  });
  it('rejects forged execution metadata instead of accepting an unrelated runtime', async () => {
    const { f, database } = await setup(); expect(() => createPharmaceuticalEvaluationCoordinatorV2({ database, execution: {}, settings: f.settings })).toThrow('INVALID_CONFIGURATION');
  });
  it('corrupted persisted sources stop before any runtime call', async () => {
    const { f, store, run } = await setup(); const read = store.read.getMockImplementation()!;
    store.read.mockImplementationOnce(async (...args) => ({ ...await read(...args), artifacts: [] }));
    await expect(run()).rejects.toThrow(); expect(f.d1.adjudicateBatch).not.toHaveBeenCalled(); expect(f.d2.detectClaims).not.toHaveBeenCalled();
  });
  it('binds the exact immutable effective configuration to invocation and manifest', async () => {
    const { f, database, store } = await setup(); const plan = structuredClone(f.intent.executionPlan);
    if (plan.d1.mode !== 'SEMANTIC' || plan.d2.mode !== 'SEMANTIC') throw new Error('semantic fixture required');
    let i = 900;
    const d1 = vi.fn(async (request: Parameters<typeof f.d1.adjudicateBatch>[0], config: { model: string; maxOutputTokens: number; timeoutMs: number }) => {
      expect(Object.isFrozen(config)).toBe(true); expect(config).toEqual({ model:'gpt-5.6-sol',maxOutputTokens:1000,timeoutMs:1000 });
      return f.d1.adjudicateBatch(request);
    });
    const binding = bindPharmaceuticalEvaluationExecutionV2({ ...plan,d1:plan.d1,d2:plan.d2 }, {
      d1, d2: () => f.d2.detectClaims(), allocateD1ExecutionId: () => `pharm_sem_exec_00000000-0000-4000-8000-${String(++i).padStart(12,'0')}`,
      allocateD2ExecutionId: () => `pharm_sem_exec_00000000-0000-4000-8000-${String(++i).padStart(12,'0')}`,
    });
    Object.assign(plan.d1,{ requestedModel:'gpt-5.6-terra',maxOutputTokens:9999 });
    await createPharmaceuticalEvaluationCoordinatorV2({ database,execution:binding,settings:f.settings }).run(f.access,f.command);
    expect(store.create.mock.calls[0][1].intent).toMatchObject({ executionPlan:{ d1:{ requestedModel:'gpt-5.6-sol',maxOutputTokens:1000 } } });
    expect(d1).toHaveBeenCalledTimes(3);
  });
  it('fails closed when actual response model contradicts effective requested model', async () => {
    const { f, run, store } = await setup(); const implementation = f.d1.adjudicateBatch.getMockImplementation()!;
    f.d1.adjudicateBatch.mockImplementation(async r => ({ ...await implementation(r), responseModel: 'gpt-5.6-terra' }));
    await expect(run()).rejects.toMatchObject({ code: 'EVALUATION_FAILED' }); expect(store.complete).not.toHaveBeenCalled();
  });
});
