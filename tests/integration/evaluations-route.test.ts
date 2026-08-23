import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class RuntimeError extends Error {
    constructor(
      public readonly code: string,
      public readonly path: string,
    ) {
      super(code);
      this.name = 'SessionClinicalRuntimeErrorV2';
    }
  }

  class FinalizationError extends Error {
    constructor(
      public readonly code: string,
      public readonly path: string,
    ) {
      super(code);
      this.name = 'LegacyEvaluationFinalizationErrorV2';
    }
  }

  return {
    requireUser: vi.fn(),
    resolveRuntime: vi.fn(),
    finalize: vi.fn(),
    RuntimeError,
    FinalizationError,
  };
});

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/cases/v2/session-clinical-runtime', () => ({
  resolveSessionEvaluatorClinicalRuntimeV2: mocks.resolveRuntime,
  SessionClinicalRuntimeErrorV2: mocks.RuntimeError,
}));
vi.mock('@/lib/cases/v2/legacy-evaluation-finalization', () => ({
  finalizeLegacyEvaluationV2: mocks.finalize,
  LegacyEvaluationFinalizationErrorV2: mocks.FinalizationError,
}));

import { POST } from '@/app/api/evaluations/route';
import { LegacyEvaluationErrorV2 } from '@/lib/cases/v2/legacy-evaluation';

const authenticatedUserId = 41;
const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = 'casever_20000000-0000-4000-8000-000000000001';

const runtime = {
  sessionId,
  caseId: 7,
  caseVersionId,
  sessionStatus: 'active',
  clinicalContent: {
    contentFormat: 'LEGACY_V1_SNAPSHOT',
    evaluator: {
      tipo_no_adherencia: 'No intencionada',
      barrera_principal: 'Olvido',
      intervenciones_validas: ['Educación'],
    },
  },
};

const publicResult = {
  score: 3,
  isTipoOk: true,
  isBarreraOk: true,
  isIntervOk: true,
  feedback: 'Resultado público persistido',
};

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    sessionId,
    tipo_no_adherencia: 'No intencionada',
    barrera: 'Olvido',
    intervenciones: ['Educación'],
    ...overrides,
  };
}

async function callEndpoint(body: unknown = validBody()) {
  const response = await POST(
    new Request('http://localhost/api/evaluations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { response, body: await response.json() };
}

function runtimeError(code: string) {
  return new mocks.RuntimeError(code, 'protected.path.CLINICAL_SENTINEL');
}

function finalizationError(code: string) {
  return new mocks.FinalizationError(
    code,
    'protected.path.CLINICAL_SENTINEL',
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: authenticatedUserId, role: 'student' });
  mocks.resolveRuntime.mockResolvedValue(runtime);
  mocks.finalize.mockResolvedValue(publicResult);
});

describe('POST /api/evaluations authentication and body boundary', () => {
  it('returns 401 before runtime or finalization when unauthenticated', async () => {
    mocks.requireUser.mockRejectedValue(new Error('UNAUTHENTICATED'));
    const result = await callEndpoint();

    expect(result.response.status).toBe(401);
    expect(result.body).toEqual({ error: 'No autenticado' });
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON without invoking runtime or finalization', async () => {
    const response = await POST(
      new Request('http://localhost/api/evaluations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"sessionId":',
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Datos inválidos' });
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'null body'],
    [[], 'array body'],
    [{ tipo_no_adherencia: 'Tipo', barrera: 'Barrera', intervenciones: [] }, 'missing session id'],
    [validBody({ sessionId: '' }), 'empty session id'],
    [validBody({ sessionId: '   ' }), 'whitespace session id'],
    [validBody({ tipo_no_adherencia: 3 }), 'invalid type answer'],
    [validBody({ barrera: null }), 'invalid barrier answer'],
    [validBody({ intervenciones: 'Educación' }), 'non-array interventions'],
    [validBody({ intervenciones: [2] }), 'non-string intervention'],
    [validBody({ intervenciones: [' '] }), 'empty intervention'],
  ])('returns 400 for invalid body: %s (%s)', async (body, _description) => {
    const result = await callEndpoint(body);
    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: 'Datos inválidos' });
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.finalize).not.toHaveBeenCalled();
  });

  it('accepts an empty interventions array', async () => {
    const result = await callEndpoint(validBody({ intervenciones: [] }));
    expect(result.response.status).toBe(200);
    expect(mocks.finalize).toHaveBeenCalledWith({
      authenticatedUserId,
      runtime,
      answers: {
        tipo_no_adherencia: 'No intencionada',
        barrera: 'Olvido',
        intervenciones: [],
      },
    });
  });
});

describe('POST /api/evaluations composition and allowlists', () => {
  it('composes authentication, exact B2 runtime, D2B, and public response in order', async () => {
    const result = await callEndpoint(validBody({
      tipo_no_adherencia: '  No intencionada  ',
      barrera: '  Olvido  ',
      intervenciones: ['  Educación  '],
    }));

    expect(result.response.status).toBe(200);
    expect(result.body).toEqual(publicResult);
    expect(Object.keys(result.body).sort()).toEqual(
      ['feedback', 'isBarreraOk', 'isIntervOk', 'isTipoOk', 'score'].sort(),
    );
    expect(mocks.resolveRuntime).toHaveBeenCalledOnce();
    expect(mocks.resolveRuntime).toHaveBeenCalledWith({
      authenticatedUserId,
      sessionId,
    });
    expect(mocks.finalize).toHaveBeenCalledOnce();
    expect(mocks.finalize).toHaveBeenCalledWith({
      authenticatedUserId,
      runtime,
      answers: {
        tipo_no_adherencia: '  No intencionada  ',
        barrera: '  Olvido  ',
        intervenciones: ['  Educación  '],
      },
    });
    expect(mocks.requireUser.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.resolveRuntime.mock.invocationCallOrder[0],
    );
    expect(mocks.resolveRuntime.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.finalize.mock.invocationCallOrder[0],
    );
  });

  it('ignores client authority and protected contaminant keys', async () => {
    const contaminated = validBody({
      caseId: 999,
      caseVersionId: 'CLIENT_VERSION_SENTINEL',
      status: 'finished',
      evaluator: 'CLIENT_EVALUATOR_SENTINEL',
      ground_truth: 'CLIENT_GROUND_TRUTH_SENTINEL',
      score: 0,
      isTipoOk: false,
      feedback: 'CLIENT_FEEDBACK_SENTINEL',
      future_secret: 'CLIENT_FUTURE_SENTINEL',
    });
    await callEndpoint(contaminated);

    expect(mocks.resolveRuntime).toHaveBeenCalledWith({
      authenticatedUserId,
      sessionId,
    });
    const finalizationInput = mocks.finalize.mock.calls[0]?.[0];
    expect(finalizationInput).toEqual({
      authenticatedUserId,
      runtime,
      answers: {
        tipo_no_adherencia: 'No intencionada',
        barrera: 'Olvido',
        intervenciones: ['Educación'],
      },
    });
    expect(JSON.stringify(finalizationInput)).not.toMatch(
      /CLIENT_(?:VERSION|EVALUATOR|GROUND_TRUTH|FEEDBACK|FUTURE)_SENTINEL/,
    );
  });
});

describe('POST /api/evaluations B2 error mapping', () => {
  it.each([
    ['invalid_input', 400, 'Datos inválidos'],
    ['session_not_found_or_forbidden', 404, 'Sesión no encontrada'],
    ['invalid_session_anchor', 500, 'Error guardando evaluación'],
    ['invalid_case_version_status', 500, 'Error guardando evaluación'],
    ['invalid_case_version_content', 500, 'Error guardando evaluación'],
    ['evaluator_runtime_validation_failed', 500, 'Error guardando evaluación'],
    ['session_not_active', 500, 'Error guardando evaluación'],
  ])('maps %s to %i without leaking runtime details', async (code, status, message) => {
    mocks.resolveRuntime.mockRejectedValue(runtimeError(code));
    const result = await callEndpoint();

    expect(result.response.status).toBe(status);
    expect(result.body).toEqual({ error: message });
    expect(JSON.stringify(result.body)).not.toMatch(
      /protected\.path|CLINICAL_SENTINEL|caseVersionId|evaluator/,
    );
    expect(mocks.finalize).not.toHaveBeenCalled();
  });
});

describe('POST /api/evaluations D2B error mapping', () => {
  it.each([
    ['invalid_input', 400, 'Datos inválidos'],
    ['unsupported_evaluation_format', 422, 'Este caso requiere otro formato de evaluación'],
    ['session_not_found_or_forbidden', 404, 'Sesión no encontrada'],
    ['invalid_session_anchor', 500, 'Error guardando evaluación'],
    ['invalid_session_state', 500, 'Error guardando evaluación'],
    ['invalid_evaluation_state', 500, 'Error guardando evaluación'],
    ['evaluation_write_failed', 500, 'Error guardando evaluación'],
  ])('maps %s to %i without leaking finalization details', async (code, status, message) => {
    mocks.finalize.mockRejectedValue(finalizationError(code));
    const result = await callEndpoint();

    expect(result.response.status).toBe(status);
    expect(result.body).toEqual({ error: message });
    expect(JSON.stringify(result.body)).not.toMatch(
      /protected\.path|CLINICAL_SENTINEL|caseVersionId|evaluator|GENERATED_CASE_BUNDLE_V2/,
    );
  });
});

describe('POST /api/evaluations D2A and unexpected error mapping', () => {
  it.each([
    ['invalid_answers', 400, 'Datos inválidos'],
    ['invalid_legacy_evaluator', 500, 'Error guardando evaluación'],
    ['invalid_persisted_evaluation', 500, 'Error guardando evaluación'],
  ] as const)('maps %s to %i without exposing D2A details', async (code, status, message) => {
    mocks.finalize.mockRejectedValue(
      new LegacyEvaluationErrorV2(code, 'protected.path.CLINICAL_SENTINEL'),
    );
    const result = await callEndpoint();

    expect(result.response.status).toBe(status);
    expect(result.body).toEqual({ error: message });
    expect(JSON.stringify(result.body)).not.toMatch(/protected\.path|CLINICAL_SENTINEL/);
  });

  it('maps an unexpected failure to a generic 500 response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.finalize.mockRejectedValue(new Error('SQL_PRIVATE_SENTINEL'));
    const result = await callEndpoint();

    expect(result.response.status).toBe(500);
    expect(result.body).toEqual({ error: 'Error guardando evaluación' });
    expect(JSON.stringify(result.body)).not.toContain('SQL_PRIVATE_SENTINEL');
    consoleSpy.mockRestore();
  });
});

describe('POST /api/evaluations source boundary', () => {
  it('delegates only to authentication, D2A, B2, and D2B', () => {
    const source = readFileSync(
      new URL('../../app/api/evaluations/route.ts', import.meta.url),
      'utf8',
    );
    expect(source).toContain('requireUser');
    expect(source).toContain('parseLegacyEvaluationAnswersV2');
    expect(source).toContain('resolveSessionEvaluatorClinicalRuntimeV2');
    expect(source).toContain('finalizeLegacyEvaluationV2');
  });

  it('contains no direct DB, scoring, provider, or protected-case access', () => {
    const source = readFileSync(
      new URL('../../app/api/evaluations/route.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/@\/lib\/db|\bpool\.|pool\.query|pool\.connect/);
    expect(source).not.toMatch(/public\.cases|join\s+(?:public\.)?cases/i);
    expect(source).not.toMatch(/ground_truth|intervenciones_validas/);
    expect(source).not.toMatch(/trim\(\)\.toLowerCase\(\)|INSERT\s+INTO|UPDATE\s+sessions/i);
    expect(source).not.toMatch(/ON\s+CONFLICT|\bscore\s*=/i);
    expect(source).not.toMatch(/\bOpenAI\b|fetch\s*\(/);
  });
});
