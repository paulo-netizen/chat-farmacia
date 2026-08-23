import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => {
  const query = vi.fn();
  const release = vi.fn();
  const connect = vi.fn();
  return { query, release, connect };
});

vi.mock('@/lib/db', () => ({
  pool: { connect: database.connect },
}));

import {
  finalizeLegacyEvaluationV2,
  LegacyEvaluationFinalizationErrorV2,
} from '../../lib/cases/v2/legacy-evaluation-finalization';
import type {
  FinalizeLegacyEvaluationInputV2,
  LegacyEvaluationFinalizationErrorCodeV2,
} from '../../lib/cases/v2/legacy-evaluation-finalization';
import { LegacyEvaluationErrorV2 } from '../../lib/cases/v2/legacy-evaluation';
import type { SessionEvaluatorClinicalRuntimeV2 } from '../../lib/cases/v2/session-clinical-runtime';

const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = 'casever_20000000-0000-4000-8000-000000000001';
const authenticatedUserId = 17;

const persistedRow = {
  score: 3,
  is_tipo_ok: true,
  is_barrera_ok: true,
  is_intervencion_ok: true,
  feedback: 'Persisted public feedback',
};

function result(rows: unknown[] = [], rowCount: number | null = rows.length) {
  return { rows, rowCount };
}

function legacyRuntime(
  evaluator: Record<string, unknown> = {},
  sessionStatus: 'active' | 'finished' = 'active',
): SessionEvaluatorClinicalRuntimeV2 {
  return {
    sessionId,
    caseId: 5,
    caseVersionId: caseVersionId as any,
    sessionStatus,
    clinicalContent: {
      contentFormat: 'LEGACY_V1_SNAPSHOT',
      evaluator: {
        tipo_no_adherencia: 'No intencionada',
        barrera_principal: 'Olvido',
        intervenciones_validas: ['Educación', 'Pastillero'],
        ...evaluator,
      },
    },
  };
}

function generatedRuntime(): SessionEvaluatorClinicalRuntimeV2 {
  return {
    sessionId,
    caseId: 5,
    caseVersionId: caseVersionId as any,
    sessionStatus: 'active',
    clinicalContent: {
      contentFormat: 'GENERATED_CASE_BUNDLE_V2',
      evaluator: { future: 'not relevant to this boundary' },
    } as any,
  };
}

function input(
  runtime: SessionEvaluatorClinicalRuntimeV2 = legacyRuntime(),
): FinalizeLegacyEvaluationInputV2 {
  return {
    authenticatedUserId,
    runtime,
    answers: {
      tipo_no_adherencia: '  NO INTENCIONADA  ',
      barrera: '  OLVIDO  ',
      intervenciones: ['  EDUCACIÓN  '],
    },
  };
}

function lockedRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    session_id: sessionId,
    session_user_id: String(authenticatedUserId),
    session_case_version_id: caseVersionId,
    session_status: 'active',
    ...overrides,
  };
}

function sqlAt(index: number): string {
  return String(database.query.mock.calls[index]?.[0]).replace(/\s+/g, ' ').trim();
}

function expectServiceCode(
  promise: Promise<unknown>,
  code: LegacyEvaluationFinalizationErrorCodeV2,
) {
  return expect(promise).rejects.toMatchObject({
    name: 'LegacyEvaluationFinalizationErrorV2',
    code,
  });
}

beforeEach(() => {
  database.query.mockReset();
  database.release.mockReset();
  database.connect.mockReset();
  database.connect.mockResolvedValue({
    query: database.query,
    release: database.release,
  });
});

afterEach(() => {
  expect(database.release).toHaveBeenCalledTimes(database.connect.mock.calls.length);
});

describe('finalizeLegacyEvaluationV2 format boundary', () => {
  it('rejects Generated V2 before acquiring a client', async () => {
    await expectServiceCode(
      finalizeLegacyEvaluationV2(input(generatedRuntime())),
      'unsupported_evaluation_format',
    );
    expect(database.connect).not.toHaveBeenCalled();
    expect(database.query).not.toHaveBeenCalled();
  });

  it('rejects invalid boundary input before acquiring a client', async () => {
    await expectServiceCode(
      finalizeLegacyEvaluationV2({
        ...input(), authenticatedUserId: 0,
      }),
      'invalid_input',
    );
    expect(database.connect).not.toHaveBeenCalled();
  });
});

describe('finalizeLegacyEvaluationV2 state matrix', () => {
  it('creates the first evaluation and finishes the active session atomically', async () => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow()]))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([{ ...persistedRow, future_secret: true }]))
      .mockResolvedValueOnce(result([], 1))
      .mockResolvedValueOnce(result());

    const publicResult = await finalizeLegacyEvaluationV2(input());

    expect(publicResult).toEqual({
      score: 3,
      isTipoOk: true,
      isBarreraOk: true,
      isIntervOk: true,
      feedback: 'Persisted public feedback',
    });
    expect(database.query).toHaveBeenCalledTimes(6);
    expect(database.query.mock.calls[0]).toEqual(['BEGIN']);
    expect(sqlAt(1)).toContain('FOR UPDATE');
    expect(database.query.mock.calls[1]?.[1]).toEqual([
      sessionId, authenticatedUserId,
    ]);
    expect(sqlAt(2)).toContain('FROM public.evaluations');
    expect(sqlAt(3)).toContain('INSERT INTO public.evaluations');
    expect(sqlAt(3)).not.toMatch(/ON\s+CONFLICT/i);
    expect(database.query.mock.calls[3]?.[1]).toEqual([
      sessionId,
      '  NO INTENCIONADA  ',
      '  OLVIDO  ',
      ['  EDUCACIÓN  '],
      true,
      true,
      true,
      3,
      expect.stringContaining('Has identificado correctamente'),
    ]);
    expect(sqlAt(4)).toContain('UPDATE public.sessions');
    expect(sqlAt(4)).toContain('case_version_id = $3');
    expect(database.query.mock.calls[4]?.[1]).toEqual([
      sessionId, authenticatedUserId, caseVersionId,
    ]);
    expect(database.query.mock.calls[5]).toEqual(['COMMIT']);
    expect(publicResult).not.toHaveProperty('future_secret');
  });

  it('returns an existing finished evaluation without scoring or writing', async () => {
    const runtime = legacyRuntime({
      tipo_no_adherencia: undefined,
      barrera_principal: undefined,
      intervenciones_validas: undefined,
    }, 'finished');
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow({ session_status: 'finished' })]))
      .mockResolvedValueOnce(result([persistedRow]))
      .mockResolvedValueOnce(result());

    await expect(finalizeLegacyEvaluationV2(input(runtime))).resolves.toEqual({
      score: 3, isTipoOk: true, isBarreraOk: true, isIntervOk: true,
      feedback: 'Persisted public feedback',
    });
    expect(database.query).toHaveBeenCalledTimes(4);
    expect(database.query.mock.calls[3]).toEqual(['COMMIT']);
    expect(database.query.mock.calls.map((call) => String(call[0])).join(' '))
      .not.toMatch(/INSERT INTO|UPDATE public\.sessions/);
  });

  it('recovers active plus existing evaluation without scoring or overwrite', async () => {
    const runtime = legacyRuntime({
      tipo_no_adherencia: undefined,
      barrera_principal: undefined,
      intervenciones_validas: undefined,
    });
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow()]))
      .mockResolvedValueOnce(result([persistedRow]))
      .mockResolvedValueOnce(result([], 1))
      .mockResolvedValueOnce(result());

    await expect(finalizeLegacyEvaluationV2(input(runtime))).resolves.toMatchObject({
      score: 3, feedback: 'Persisted public feedback',
    });
    expect(database.query).toHaveBeenCalledTimes(5);
    expect(sqlAt(3)).toContain('UPDATE public.sessions');
    expect(database.query.mock.calls[4]).toEqual(['COMMIT']);
    expect(database.query.mock.calls.map((call) => String(call[0])).join(' '))
      .not.toContain('INSERT INTO');
  });

  it('fails closed for finished without an evaluation', async () => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow({ session_status: 'finished' })]))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result());

    await expectServiceCode(
      finalizeLegacyEvaluationV2(input(legacyRuntime({}, 'finished'))),
      'invalid_session_state',
    );
    expect(database.query.mock.calls[3]).toEqual(['ROLLBACK']);
  });

  it('uses locked DB status rather than stale runtime status', async () => {
    const staleRuntime = legacyRuntime({
      tipo_no_adherencia: undefined,
      barrera_principal: undefined,
      intervenciones_validas: undefined,
    }, 'active');
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow({ session_status: 'finished' })]))
      .mockResolvedValueOnce(result([persistedRow]))
      .mockResolvedValueOnce(result());

    await expect(finalizeLegacyEvaluationV2(input(staleRuntime))).resolves.toMatchObject({
      score: 3, feedback: 'Persisted public feedback',
    });
    expect(database.query).toHaveBeenCalledTimes(4);
    expect(database.query.mock.calls[3]).toEqual(['COMMIT']);
  });
});

describe('finalizeLegacyEvaluationV2 locked anchor validation', () => {
  it('maps a missing or foreign owned session to one stable error', async () => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result());

    await expectServiceCode(
      finalizeLegacyEvaluationV2(input()),
      'session_not_found_or_forbidden',
    );
    expect(database.query.mock.calls[2]).toEqual(['ROLLBACK']);
  });

  it('rejects more than one locked session row', async () => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow(), lockedRow()]))
      .mockResolvedValueOnce(result());

    await expectServiceCode(
      finalizeLegacyEvaluationV2(input()),
      'invalid_session_anchor',
    );
  });

  it.each([
    [{ session_id: '30000000-0000-4000-8000-000000000001' }, 'session id'],
    [{ session_user_id: '18' }, 'user id'],
    [{ session_case_version_id: 'casever_40000000-0000-4000-8000-000000000001' }, 'version id'],
    [{ session_status: 'paused' }, 'session status'],
  ])('rejects a locked anchor mismatch: %s (%s)', async (overrides, _description) => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow(overrides)]))
      .mockResolvedValueOnce(result());

    await expectServiceCode(
      finalizeLegacyEvaluationV2(input()),
      'invalid_session_anchor',
    );
    expect(database.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
  });

  it('locks with ownership in SQL and never trusts a user id from the runtime', async () => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result());

    await expect(finalizeLegacyEvaluationV2(input())).rejects.toBeInstanceOf(
      LegacyEvaluationFinalizationErrorV2,
    );
    expect(sqlAt(1)).toMatch(/WHERE s\.id = \$1\s+AND s\.user_id = \$2\s+FOR UPDATE/i);
    expect(database.query.mock.calls[1]?.[1]).toEqual([
      sessionId, authenticatedUserId,
    ]);
  });
});

describe('finalizeLegacyEvaluationV2 evaluation validation and writes', () => {
  it('rejects more than one evaluation row', async () => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow()]))
      .mockResolvedValueOnce(result([persistedRow, persistedRow]))
      .mockResolvedValueOnce(result());

    await expectServiceCode(
      finalizeLegacyEvaluationV2(input()),
      'invalid_evaluation_state',
    );
    expect(database.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
  });

  it('rolls back a corrupt persisted evaluation', async () => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow({ session_status: 'finished' })]))
      .mockResolvedValueOnce(result([{ ...persistedRow, score: 1 }]))
      .mockResolvedValueOnce(result());

    await expect(finalizeLegacyEvaluationV2(input())).rejects.toMatchObject({
      name: 'LegacyEvaluationErrorV2',
      code: 'invalid_persisted_evaluation',
    });
    expect(database.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
  });

  it('rolls back a scorer error before INSERT or UPDATE', async () => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow()]))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result());

    const invalidRuntime = legacyRuntime({ intervenciones_validas: [] });
    await expect(finalizeLegacyEvaluationV2(input(invalidRuntime))).rejects.toBeInstanceOf(
      LegacyEvaluationErrorV2,
    );
    expect(database.query).toHaveBeenCalledTimes(4);
    expect(database.query.mock.calls[3]).toEqual(['ROLLBACK']);
  });

  it('rolls back an INSERT failure and never updates the session', async () => {
    const insertError = new Error('synthetic insert failure');
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow()]))
      .mockResolvedValueOnce(result([]))
      .mockRejectedValueOnce(insertError)
      .mockResolvedValueOnce(result());

    await expect(finalizeLegacyEvaluationV2(input())).rejects.toBe(insertError);
    expect(database.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
    expect(database.query.mock.calls.map((call) => String(call[0])).join(' '))
      .not.toContain('UPDATE public.sessions');
  });

  it.each([0, 2])('rolls back when INSERT returns %i rows', async (rowCount) => {
    const rows = rowCount === 0 ? [] : [persistedRow, persistedRow];
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow()]))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result(rows))
      .mockResolvedValueOnce(result());

    await expectServiceCode(
      finalizeLegacyEvaluationV2(input()),
      'evaluation_write_failed',
    );
    expect(database.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
  });

  it('rolls back an UPDATE failure after INSERT', async () => {
    const updateError = new Error('synthetic update failure');
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow()]))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([persistedRow]))
      .mockRejectedValueOnce(updateError)
      .mockResolvedValueOnce(result());

    await expect(finalizeLegacyEvaluationV2(input())).rejects.toBe(updateError);
    expect(database.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
  });

  it.each([0, 2])('rolls back when UPDATE affects %i rows', async (rowCount) => {
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow()]))
      .mockResolvedValueOnce(result([]))
      .mockResolvedValueOnce(result([persistedRow]))
      .mockResolvedValueOnce(result([], rowCount))
      .mockResolvedValueOnce(result());

    await expectServiceCode(
      finalizeLegacyEvaluationV2(input()),
      'evaluation_write_failed',
    );
    expect(database.query.mock.calls.at(-1)).toEqual(['ROLLBACK']);
  });
});

describe('finalizeLegacyEvaluationV2 transaction failures', () => {
  it('releases without rollback when BEGIN fails', async () => {
    const beginError = new Error('synthetic begin failure');
    database.query.mockRejectedValueOnce(beginError);

    await expect(finalizeLegacyEvaluationV2(input())).rejects.toBe(beginError);
    expect(database.query).toHaveBeenCalledTimes(1);
    expect(database.query.mock.calls[0]).toEqual(['BEGIN']);
  });

  it('best-effort rolls back and propagates a COMMIT failure', async () => {
    const commitError = new Error('synthetic commit failure');
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([lockedRow({ session_status: 'finished' })]))
      .mockResolvedValueOnce(result([persistedRow]))
      .mockRejectedValueOnce(commitError)
      .mockResolvedValueOnce(result());

    await expect(finalizeLegacyEvaluationV2(input())).rejects.toBe(commitError);
    expect(database.query.mock.calls[4]).toEqual(['ROLLBACK']);
  });

  it('does not replace the original error when ROLLBACK fails', async () => {
    const rollbackError = new Error('synthetic rollback failure');
    database.query
      .mockResolvedValueOnce(result())
      .mockResolvedValueOnce(result([]))
      .mockRejectedValueOnce(rollbackError);

    let caught: unknown;
    try {
      await finalizeLegacyEvaluationV2(input());
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(LegacyEvaluationFinalizationErrorV2);
    expect(caught).toMatchObject({ code: 'session_not_found_or_forbidden' });
    expect(caught).not.toBe(rollbackError);
  });
});

describe('legacy finalization architecture', () => {
  it('uses a dedicated owned lock and the required pure D2A boundaries', () => {
    const source = readFileSync(
      new URL(
        '../../lib/cases/v2/legacy-evaluation-finalization.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(source).toContain('pool.connect()');
    expect(source).toContain('FOR UPDATE');
    expect(source).toMatch(/WHERE s\.id = \$1\s+AND s\.user_id = \$2/);
    expect(source).toMatch(/UPDATE public\.sessions[\s\S]*case_version_id = \$3/);
    expect(source).toContain('scoreLegacyEvaluationV2');
    expect(source).toContain('parsePersistedLegacyEvaluationResultV2');
  });

  it('has no unsafe or out-of-scope data/provider access', () => {
    const source = readFileSync(
      new URL(
        '../../lib/cases/v2/legacy-evaluation-finalization.ts',
        import.meta.url,
      ),
      'utf8',
    );
    expect(source).not.toMatch(/pool\.query\s*\(/);
    expect(source).not.toMatch(/public\.cases|join\s+(?:public\.)?cases/i);
    expect(source).not.toMatch(/\bcase_versions\b|ground_truth/i);
    expect(source).not.toMatch(/current\s+PUBLISHED|\blatest\b/i);
    expect(source).not.toMatch(/ON\s+CONFLICT|DO\s+UPDATE/i);
    expect(source).not.toMatch(/\bOpenAI\b|fetch\s*\(|process\.env|next\/server/);
  });
});
