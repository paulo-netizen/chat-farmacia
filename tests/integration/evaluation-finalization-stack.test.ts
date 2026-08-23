import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  poolQuery: vi.fn(),
  connect: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/db', () => ({
  pool: {
    query: mocks.poolQuery,
    connect: mocks.connect,
  },
}));

import { POST } from '@/app/api/evaluations/route';

const authenticatedUserId = 41;
const foreignUserId = 42;
const sessionId = '10000000-0000-4000-8000-000000000001';
const missingSessionId = '10000000-0000-4000-8000-000000000099';
const caseId = 7;
const caseVersionId = 'casever_20000000-0000-4000-8000-000000000001';

type SessionStatus = 'active' | 'finished';
type VersionStatus = 'PUBLISHED' | 'ARCHIVED';

type PersistedEvaluation = {
  score: number;
  is_tipo_ok: boolean;
  is_barrera_ok: boolean;
  is_intervencion_ok: boolean;
  feedback: string;
};

type QueryLog = {
  surface: 'pool' | 'client';
  client?: string;
  sql: string;
  params: readonly unknown[];
};

type TransactionState = {
  label: string;
  active: boolean;
  holdsLock: boolean;
  pendingEvaluation?: PersistedEvaluation;
  pendingFinished: boolean;
};

function normalizeSql(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

class FakeEvaluationDatabase {
  sessionExists = true;
  ownerId = authenticatedUserId;
  sessionStatus: SessionStatus = 'active';
  versionStatus: VersionStatus = 'PUBLISHED';
  evaluator: Record<string, unknown> = {
    tipo_no_adherencia: 'Intencional',
    barrera_principal: 'Temor',
    intervenciones_validas: ['Acordar'],
  };
  evaluation: PersistedEvaluation | undefined;
  failNextUpdate = false;
  hydrationBarrierSize = 0;

  readonly queries: QueryLog[] = [];
  readonly events: string[] = [];
  readonly insertedParameters: unknown[][] = [];
  insertQueries = 0;
  updateQueries = 0;
  beginQueries = 0;
  commitQueries = 0;
  rollbackQueries = 0;
  releaseCalls = 0;

  private connectionCount = 0;
  private hydrationArrivals = 0;
  private hydrationGate = deferred();
  private lockOwner: TransactionState | undefined;
  private readonly lockWaiters: Array<() => void> = [];

  legacyContent() {
    const legacyStatus = this.versionStatus === 'PUBLISHED'
      ? 'approved'
      : 'rejected';
    return {
      snapshotBasis: 'migration_time_current_row',
      legacyCaseId: caseId,
      legacyStatus,
      serviceType: 'SAT',
      spec: {
        nombre: 'Ana', edad: 54, sexo: 'mujer', tratamiento: 'Metformina',
      },
      groundTruth: {
        ...this.evaluator,
        future_secret: 'DO_NOT_PROJECT',
      },
    };
  }

  private runtimeRow() {
    const legacyStatus = this.versionStatus === 'PUBLISHED'
      ? 'approved'
      : 'rejected';
    return {
      session_id: sessionId,
      session_user_id: String(this.ownerId),
      session_case_id: String(caseId),
      session_case_version_id: caseVersionId,
      session_status: this.sessionStatus,
      version_id: caseVersionId,
      version_case_id: String(caseId),
      version_status: this.versionStatus,
      version_source_kind: 'LEGACY_V1',
      version_legacy_status: legacyStatus,
      version_content_format: 'LEGACY_V1_SNAPSHOT',
      version_content: this.legacyContent(),
    };
  }

  private lockedRow() {
    return {
      session_id: sessionId,
      session_user_id: String(this.ownerId),
      session_case_version_id: caseVersionId,
      session_status: this.sessionStatus,
    };
  }

  private async waitForHydrationBarrier(): Promise<void> {
    if (this.hydrationBarrierSize === 0) return;
    this.hydrationArrivals += 1;
    if (this.hydrationArrivals === this.hydrationBarrierSize) {
      this.hydrationGate.resolve();
    }
    await this.hydrationGate.promise;
  }

  async poolQuery(sqlValue: unknown, paramsValue?: unknown) {
    const sql = normalizeSql(sqlValue);
    const params = Array.isArray(paramsValue) ? paramsValue : [];
    this.queries.push({ surface: 'pool', sql, params });

    if (
      !/FROM public\.sessions AS s INNER JOIN public\.case_versions AS cv/i.test(sql) ||
      !/s\.case_version_id/i.test(sql) ||
      !/WHERE s\.id = \$1 AND s\.user_id = \$2/i.test(sql)
    ) {
      throw new Error(`Unexpected pool SQL family: ${sql}`);
    }

    await this.waitForHydrationBarrier();
    if (
      !this.sessionExists ||
      params[0] !== sessionId ||
      params[1] !== this.ownerId
    ) {
      return { rows: [], rowCount: 0 };
    }
    return { rows: [this.runtimeRow()], rowCount: 1 };
  }

  connect() {
    this.connectionCount += 1;
    const transaction: TransactionState = {
      label: this.connectionCount === 1 ? 'A' : 'B',
      active: false,
      holdsLock: false,
      pendingFinished: false,
    };
    return {
      query: (sql: unknown, params?: unknown) =>
        this.clientQuery(transaction, sql, params),
      release: () => {
        this.releaseCalls += 1;
      },
    };
  }

  private async acquireLock(transaction: TransactionState): Promise<void> {
    this.events.push(`${transaction.label}_FOR_UPDATE`);
    if (this.lockOwner !== undefined) {
      this.events.push(`${transaction.label}_FOR_UPDATE_WAITING`);
      await new Promise<void>((resolve) => this.lockWaiters.push(resolve));
      this.events.push(`${transaction.label}_FOR_UPDATE_RELEASED`);
    }
    this.lockOwner = transaction;
    transaction.holdsLock = true;
  }

  private releaseLock(transaction: TransactionState): void {
    if (this.lockOwner !== transaction) return;
    transaction.holdsLock = false;
    this.lockOwner = undefined;
    this.lockWaiters.shift()?.();
  }

  private commit(transaction: TransactionState): void {
    if (transaction.pendingEvaluation !== undefined) {
      this.evaluation = { ...transaction.pendingEvaluation };
    }
    if (transaction.pendingFinished) {
      this.sessionStatus = 'finished';
    }
    transaction.pendingEvaluation = undefined;
    transaction.pendingFinished = false;
  }

  private rollback(transaction: TransactionState): void {
    transaction.pendingEvaluation = undefined;
    transaction.pendingFinished = false;
  }

  private async clientQuery(
    transaction: TransactionState,
    sqlValue: unknown,
    paramsValue?: unknown,
  ) {
    const sql = normalizeSql(sqlValue);
    const params = Array.isArray(paramsValue) ? paramsValue : [];
    this.queries.push({
      surface: 'client', client: transaction.label, sql, params,
    });

    if (sql === 'BEGIN') {
      this.beginQueries += 1;
      transaction.active = true;
      return { rows: [], rowCount: null };
    }

    if (/FROM public\.sessions AS s/i.test(sql) && /FOR UPDATE/i.test(sql)) {
      if (!transaction.active) throw new Error('Lock outside transaction');
      if (!/WHERE s\.id = \$1 AND s\.user_id = \$2/i.test(sql)) {
        throw new Error(`Unexpected lock SQL: ${sql}`);
      }
      await this.acquireLock(transaction);
      if (
        !this.sessionExists ||
        params[0] !== sessionId ||
        params[1] !== this.ownerId
      ) {
        return { rows: [], rowCount: 0 };
      }
      return { rows: [this.lockedRow()], rowCount: 1 };
    }

    if (/FROM public\.evaluations/i.test(sql) && /^SELECT/i.test(sql)) {
      if (!transaction.holdsLock) throw new Error('Evaluation read without lock');
      return {
        rows: this.evaluation === undefined ? [] : [{ ...this.evaluation }],
        rowCount: this.evaluation === undefined ? 0 : 1,
      };
    }

    if (/^INSERT INTO public\.evaluations/i.test(sql)) {
      if (!transaction.holdsLock) throw new Error('Evaluation insert without lock');
      if (/ON\s+CONFLICT|DO\s+UPDATE/i.test(sql)) {
        throw new Error('Overwrite SQL is forbidden');
      }
      this.insertQueries += 1;
      this.insertedParameters.push([...params]);
      const pending: PersistedEvaluation = {
        score: params[7] as number,
        is_tipo_ok: params[4] as boolean,
        is_barrera_ok: params[5] as boolean,
        is_intervencion_ok: params[6] as boolean,
        feedback: params[8] as string,
      };
      transaction.pendingEvaluation = pending;
      return { rows: [{ ...pending }], rowCount: 1 };
    }

    if (/^UPDATE public\.sessions/i.test(sql)) {
      if (!transaction.holdsLock) throw new Error('Session update without lock');
      if (!/case_version_id = \$3/i.test(sql)) {
        throw new Error(`Unanchored session update: ${sql}`);
      }
      this.updateQueries += 1;
      if (this.failNextUpdate) {
        this.failNextUpdate = false;
        throw new Error('Synthetic transactional update failure');
      }
      if (
        params[0] !== sessionId ||
        params[1] !== this.ownerId ||
        params[2] !== caseVersionId ||
        this.sessionStatus !== 'active'
      ) {
        return { rows: [], rowCount: 0 };
      }
      transaction.pendingFinished = true;
      return { rows: [], rowCount: 1 };
    }

    if (sql === 'COMMIT') {
      this.commitQueries += 1;
      this.commit(transaction);
      transaction.active = false;
      this.events.push(`${transaction.label}_COMMIT`);
      this.releaseLock(transaction);
      return { rows: [], rowCount: null };
    }

    if (sql === 'ROLLBACK') {
      this.rollbackQueries += 1;
      this.rollback(transaction);
      transaction.active = false;
      this.events.push(`${transaction.label}_ROLLBACK`);
      this.releaseLock(transaction);
      return { rows: [], rowCount: null };
    }

    throw new Error(`Unexpected client SQL family: ${sql}`);
  }
}

let database: FakeEvaluationDatabase;

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    sessionId,
    tipo_no_adherencia: '  INTENCIONAL  ',
    barrera: '  TEMOR  ',
    intervenciones: ['  ACORDAR  '],
    ...overrides,
  };
}

async function callEndpoint(
  body: unknown = validBody(),
  userId = authenticatedUserId,
) {
  mocks.requireUser.mockResolvedValueOnce({ id: userId, role: 'student' });
  const response = await POST(
    new Request('http://localhost/api/evaluations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { response, body: await response.json() };
}

function expectedPublicResult() {
  return {
    score: 3,
    isTipoOk: true,
    isBarreraOk: true,
    isIntervOk: true,
    feedback:
      'Has identificado correctamente el tipo de no adherencia. ' +
      'Has identificado correctamente la barrera principal. ' +
      'Has seleccionado al menos una intervención adecuada.',
  };
}

function allSql(): string {
  return database.queries.map((entry) => entry.sql).join('\n');
}

function expectOnlyApprovedSqlFamilies(): void {
  const sql = allSql();
  expect(sql).not.toMatch(/public\.cases|join\s+(?:public\.)?cases/i);
  expect(sql).not.toMatch(/ground_truth|current\s+PUBLISHED|\blatest\b/i);
  expect(sql).not.toMatch(/ON\s+CONFLICT|DO\s+UPDATE/i);
  for (const entry of database.queries) {
    expect(entry.sql).toMatch(
      /^(?:BEGIN|COMMIT|ROLLBACK)$|FROM public\.sessions AS s|FROM public\.evaluations|INSERT INTO public\.evaluations|UPDATE public\.sessions/i,
    );
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  database = new FakeEvaluationDatabase();
  mocks.poolQuery.mockImplementation((sql, params) =>
    database.poolQuery(sql, params),
  );
  mocks.connect.mockImplementation(() => database.connect());
});

describe('integrated session-bound Legacy evaluation stack', () => {
  it('finalizes a PUBLISHED pinned Legacy version through all real layers', async () => {
    const result = await callEndpoint();

    expect(result.response.status).toBe(200);
    expect(result.body).toEqual(expectedPublicResult());
    expect(Object.keys(result.body).sort()).toEqual(
      ['feedback', 'isBarreraOk', 'isIntervOk', 'isTipoOk', 'score'].sort(),
    );
    expect(database.beginQueries).toBe(1);
    expect(database.insertQueries).toBe(1);
    expect(database.updateQueries).toBe(1);
    expect(database.commitQueries).toBe(1);
    expect(database.rollbackQueries).toBe(0);
    expect(database.insertedParameters[0]?.slice(0, 4)).toEqual([
      sessionId,
      '  INTENCIONAL  ',
      '  TEMOR  ',
      ['  ACORDAR  '],
    ]);
    const hydration = database.queries.find((entry) => entry.surface === 'pool');
    expect(hydration?.sql).toContain('s.case_version_id');
    expect(hydration?.params).toEqual([sessionId, authenticatedUserId]);
    expectOnlyApprovedSqlFamilies();
  });

  it('evaluates an existing session against its exact ARCHIVED Legacy version', async () => {
    database.versionStatus = 'ARCHIVED';
    const result = await callEndpoint();

    expect(result.response.status).toBe(200);
    expect(result.body).toEqual(expectedPublicResult());
    expect(database.insertQueries).toBe(1);
    expect(database.queries[0]?.sql).not.toMatch(
      /WHERE\s+cv\.status\s*=\s*'PUBLISHED'|ORDER\s+BY|LIMIT\s+1/i,
    );
    expectOnlyApprovedSqlFamilies();
  });

  it('returns the first persisted result for a retry with a different payload', async () => {
    const first = await callEndpoint();
    const second = await callEndpoint(validBody({
      tipo_no_adherencia: 'Respuesta completamente distinta',
      barrera: 'Otra barrera',
      intervenciones: [],
    }));

    expect(first.response.status).toBe(200);
    expect(second.response.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(first.body).toEqual(expectedPublicResult());
    expect(database.insertQueries).toBe(1);
    expect(database.updateQueries).toBe(1);
    expect(database.commitQueries).toBe(2);
    expect(database.evaluation).toEqual({
      score: 3,
      is_tipo_ok: true,
      is_barrera_ok: true,
      is_intervencion_ok: true,
      feedback: expectedPublicResult().feedback,
    });
  });

  it('recovers active plus evaluation without needing a scoreable evaluator', async () => {
    database.evaluator = {};
    database.evaluation = {
      score: 1,
      is_tipo_ok: true,
      is_barrera_ok: false,
      is_intervencion_ok: false,
      feedback: 'Resultado histórico persistido',
    };
    const result = await callEndpoint(validBody({
      tipo_no_adherencia: 'No evaluable', barrera: 'No evaluable', intervenciones: [],
    }));

    expect(result.response.status).toBe(200);
    expect(result.body).toEqual({
      score: 1,
      isTipoOk: true,
      isBarreraOk: false,
      isIntervOk: false,
      feedback: 'Resultado histórico persistido',
    });
    expect(database.insertQueries).toBe(0);
    expect(database.updateQueries).toBe(1);
    expect(database.sessionStatus).toBe('finished');
    expect(database.commitQueries).toBe(1);
  });

  it('fails closed for finished without evaluation and exposes no internals', async () => {
    database.sessionStatus = 'finished';
    const result = await callEndpoint();

    expect(result.response.status).toBe(500);
    expect(result.body).toEqual({ error: 'Error guardando evaluación' });
    expect(JSON.stringify(result.body)).not.toMatch(
      /10000000|casever_|evaluator|Intencional|Temor|protected|SELECT|UPDATE/i,
    );
    expect(database.rollbackQueries).toBe(1);
    expect(database.commitQueries).toBe(0);
    expect(database.insertQueries).toBe(0);
    expect(database.updateQueries).toBe(0);
  });

  it.each([
    [foreignUserId, sessionId, 'foreign session'],
    [authenticatedUserId, missingSessionId, 'missing session'],
  ])('returns the same ownership-safe 404 for %s (%s)', async (
    requestUserId,
    requestedSessionId,
    _description,
  ) => {
    const result = await callEndpoint(
      validBody({ sessionId: requestedSessionId }),
      requestUserId,
    );

    expect(result.response.status).toBe(404);
    expect(result.body).toEqual({ error: 'Sesión no encontrada' });
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(database.beginQueries).toBe(0);
    expect(database.queries).toHaveLength(1);
    expect(database.queries[0]?.sql).toMatch(
      /WHERE s\.id = \$1 AND s\.user_id = \$2/i,
    );
  });
});

describe('integrated concurrency and atomicity contract', () => {
  it('serializes two HTTP finalizations and returns A result to both callers', async () => {
    database.hydrationBarrierSize = 2;
    const requestA = callEndpoint(validBody());
    const requestB = callEndpoint(validBody({
      tipo_no_adherencia: 'Respuesta B distinta',
      barrera: 'Barrera B distinta',
      intervenciones: [],
    }));

    const [resultA, resultB] = await Promise.all([requestA, requestB]);

    expect(resultA.response.status).toBe(200);
    expect(resultB.response.status).toBe(200);
    expect(resultA.body).toEqual(expectedPublicResult());
    expect(resultB.body).toEqual(resultA.body);
    expect(database.insertQueries).toBe(1);
    expect(database.updateQueries).toBe(1);
    expect(database.beginQueries).toBe(2);
    expect(database.commitQueries).toBe(2);
    expect(database.rollbackQueries).toBe(0);

    const orderedEvidence = [
      'A_FOR_UPDATE',
      'B_FOR_UPDATE_WAITING',
      'A_COMMIT',
      'B_FOR_UPDATE_RELEASED',
    ];
    const positions = orderedEvidence.map((event) => database.events.indexOf(event));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
    expect(database.events).toContain('B_FOR_UPDATE_WAITING');
    expectOnlyApprovedSqlFamilies();
  });

  it('rolls back INSERT when finishing fails, then permits a clean retry', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    database.failNextUpdate = true;
    const failed = await callEndpoint();

    expect(failed.response.status).toBe(500);
    expect(failed.body).toEqual({ error: 'Error guardando evaluación' });
    expect(database.rollbackQueries).toBe(1);
    expect(database.commitQueries).toBe(0);
    expect(database.evaluation).toBeUndefined();
    expect(database.sessionStatus).toBe('active');

    const retry = await callEndpoint();
    expect(retry.response.status).toBe(200);
    expect(retry.body).toEqual(expectedPublicResult());
    expect(database.commitQueries).toBe(1);
    expect(database.rollbackQueries).toBe(1);
    expect(database.evaluation).toBeDefined();
    expect(database.sessionStatus).toBe('finished');
    expect(database.insertQueries).toBe(2);
    consoleSpy.mockRestore();
  });
});
