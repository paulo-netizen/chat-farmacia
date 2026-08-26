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

  class ClaimError extends Error {
    constructor(
      public readonly code: string,
      public readonly path: string,
    ) {
      super(code);
      this.name = 'SpfaEvaluationClaimErrorV2';
    }
  }

  class SpfaFinalizationError extends Error {
    constructor(
      public readonly code: string,
      public readonly path: string,
    ) {
      super(code);
      this.name = 'SpfaEvaluationFinalizationErrorV2';
    }
  }

  class ReadError extends Error {
    constructor(
      public readonly code: string,
      public readonly path: string,
    ) {
      super(code);
      this.name = 'GetOwnedSpfaEvaluationStatusErrorV2';
    }
  }

  return {
    requireUser: vi.fn(),
    resolveRuntime: vi.fn(),
    finalizeLegacy: vi.fn(),
    finalizeSpfa: vi.fn(),
    readSpfa: vi.fn(),
    RuntimeError,
    FinalizationError,
    ClaimError,
    SpfaFinalizationError,
    ReadError,
  };
});

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/cases/v2/session-clinical-runtime', () => ({
  resolveSessionEvaluatorClinicalRuntimeV2: mocks.resolveRuntime,
  SessionClinicalRuntimeErrorV2: mocks.RuntimeError,
}));
vi.mock('@/lib/cases/v2/legacy-evaluation-finalization', () => ({
  finalizeLegacyEvaluationV2: mocks.finalizeLegacy,
  LegacyEvaluationFinalizationErrorV2: mocks.FinalizationError,
}));
vi.mock('@/lib/cases/v2/claim-spfa-session-evaluation', () => ({
  SpfaEvaluationClaimErrorV2: mocks.ClaimError,
}));
vi.mock('@/lib/cases/v2/finalize-spfa-session-evaluation', () => ({
  finalizeOwnedSpfaSessionEvaluationV2: mocks.finalizeSpfa,
  SpfaEvaluationFinalizationErrorV2: mocks.SpfaFinalizationError,
}));
vi.mock('@/lib/cases/v2/get-owned-spfa-evaluation-status', () => ({
  getOwnedSpfaEvaluationStatusV2: mocks.readSpfa,
  GetOwnedSpfaEvaluationStatusErrorV2: mocks.ReadError,
}));

import { GET, POST } from '@/app/api/evaluations/route';
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

const generatedRuntime = {
  ...runtime,
  clinicalContent: {
    contentFormat: 'GENERATED_CASE_BUNDLE_V2',
    evaluator: { serverOwned: true },
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

async function callGet(query = `?sessionId=${sessionId}`) {
  const response = await GET(
    new Request(`http://localhost/api/evaluations${query}`),
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

function claimError(code: string) {
  return new mocks.ClaimError(code, 'protected.path.SPFA_SENTINEL');
}

function spfaFinalizationError(code: string) {
  return new mocks.SpfaFinalizationError(
    code,
    'protected.path.SPFA_SENTINEL',
  );
}

function readError(code: string) {
  return new mocks.ReadError(code, 'protected.path.SPFA_SENTINEL');
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({ id: authenticatedUserId, role: 'student' });
  mocks.resolveRuntime.mockResolvedValue(runtime);
  mocks.finalizeLegacy.mockResolvedValue(publicResult);
  mocks.finalizeSpfa.mockResolvedValue({
    outcome: 'COMPLETED',
    sessionId,
    score: { status: 'SCORED', score: 87, needsReview: false },
  });
  mocks.readSpfa.mockResolvedValue({ status: 'NOT_STARTED', sessionId });
});

describe('POST /api/evaluations authentication and body boundary', () => {
  it('returns 401 before runtime or finalization when unauthenticated', async () => {
    mocks.requireUser.mockRejectedValue(new Error('UNAUTHENTICATED'));
    const result = await callEndpoint();

    expect(result.response.status).toBe(401);
    expect(result.body).toEqual({ error: 'No autenticado' });
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.finalizeLegacy).not.toHaveBeenCalled();
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
    expect(mocks.finalizeLegacy).not.toHaveBeenCalled();
  });

  it.each([
    [null, 'null body'],
    [[], 'array body'],
    [{ tipo_no_adherencia: 'Tipo', barrera: 'Barrera', intervenciones: [] }, 'missing session id'],
    [validBody({ sessionId: '' }), 'empty session id'],
    [validBody({ sessionId: '   ' }), 'whitespace session id'],
  ])('returns 400 for invalid envelope: %s (%s)', async (body, _description) => {
    const result = await callEndpoint(body);
    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: 'Datos inválidos' });
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.finalizeLegacy).not.toHaveBeenCalled();
    expect(mocks.finalizeSpfa).not.toHaveBeenCalled();
  });

  it.each([
    [validBody({ tipo_no_adherencia: 3 }), 'invalid type answer'],
    [validBody({ barrera: null }), 'invalid barrier answer'],
    [validBody({ intervenciones: 'Educación' }), 'non-array interventions'],
    [validBody({ intervenciones: [2] }), 'non-string intervention'],
    [validBody({ intervenciones: [' '] }), 'empty intervention'],
  ])('validates Legacy answers only after resolving Legacy: %s (%s)', async (body, _description) => {
    const result = await callEndpoint(body);
    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: 'Datos inválidos' });
    expect(mocks.resolveRuntime).toHaveBeenCalledOnce();
    expect(mocks.finalizeLegacy).not.toHaveBeenCalled();
    expect(mocks.finalizeSpfa).not.toHaveBeenCalled();
  });

  it('accepts an empty interventions array', async () => {
    const result = await callEndpoint(validBody({ intervenciones: [] }));
    expect(result.response.status).toBe(200);
    expect(mocks.finalizeLegacy).toHaveBeenCalledWith({
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
    expect(mocks.finalizeLegacy).toHaveBeenCalledOnce();
    expect(mocks.finalizeLegacy).toHaveBeenCalledWith({
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
      mocks.finalizeLegacy.mock.invocationCallOrder[0],
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
    const finalizationInput = mocks.finalizeLegacy.mock.calls[0]?.[0];
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
    expect(mocks.finalizeLegacy).not.toHaveBeenCalled();
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
    mocks.finalizeLegacy.mockRejectedValue(finalizationError(code));
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
    mocks.finalizeLegacy.mockRejectedValue(
      new LegacyEvaluationErrorV2(code, 'protected.path.CLINICAL_SENTINEL'),
    );
    const result = await callEndpoint();

    expect(result.response.status).toBe(status);
    expect(result.body).toEqual({ error: message });
    expect(JSON.stringify(result.body)).not.toMatch(/protected\.path|CLINICAL_SENTINEL/);
  });

  it('maps an unexpected failure to a generic 500 response', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.finalizeLegacy.mockRejectedValue(new Error('SQL_PRIVATE_SENTINEL'));
    const result = await callEndpoint();

    expect(result.response.status).toBe(500);
    expect(result.body).toEqual({ error: 'Error guardando evaluación' });
    expect(JSON.stringify(result.body)).not.toContain('SQL_PRIVATE_SENTINEL');
    consoleSpy.mockRestore();
  });
});

describe('POST /api/evaluations Generated V2 dispatch', () => {
  beforeEach(() => {
    mocks.resolveRuntime.mockResolvedValue(generatedRuntime);
  });

  it('accepts exactly {sessionId} without requiring Legacy answers', async () => {
    const result = await callEndpoint({ sessionId });

    expect(result.response.status).toBe(200);
    expect(result.body).toEqual({
      schemaVersion: '2.0',
      status: 'COMPLETED',
      score: 87,
      scoreStatus: 'SCORED',
      needsReview: false,
    });
    expect(mocks.finalizeSpfa).toHaveBeenCalledWith({
      authenticatedUserId,
      sessionId,
    });
    expect(mocks.finalizeLegacy).not.toHaveBeenCalled();
  });

  it.each([
    ['score', 10],
    ['model', 'client-model'],
    ['transcript', []],
    ['attemptId', 'client-attempt'],
    ['forceRetry', true],
    ['caseVersionId', caseVersionId],
    ['messages', []],
    ['fingerprint', 'client-fingerprint'],
    ['protocol', { id: 'client-protocol' }],
    ['policy', { id: 'client-policy' }],
    ['attemptCount', 4],
    ['lease', 'client-lease'],
    ['failureCode', 'PROVIDER_FAILURE'],
    ['retry', true],
    ['force', true],
    ['evaluation', { score: 100 }],
    ['semanticResult', { verdict: 'SUPPORTED' }],
  ])('rejects client-controlled %s after server-side format resolution', async (key, value) => {
    const result = await callEndpoint({ sessionId, [key]: value });
    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: 'Datos inválidos' });
    expect(mocks.resolveRuntime).toHaveBeenCalledOnce();
    expect(mocks.finalizeSpfa).not.toHaveBeenCalled();
    expect(mocks.finalizeLegacy).not.toHaveBeenCalled();
  });

  it('maps an active owner evaluation to 202 without technical metadata', async () => {
    mocks.finalizeSpfa.mockResolvedValue({
      outcome: 'IN_PROGRESS',
      sessionId,
      attemptId: 'SECRET_ATTEMPT',
      leaseExpiresAt: 'SECRET_LEASE',
    });
    const result = await callEndpoint({ sessionId });
    expect(result.response.status).toBe(202);
    expect(result.body).toEqual({ schemaVersion: '2.0', status: 'EVALUATING' });
  });

  it.each([
    ['PROVIDER_FAILURE', 503],
    ['INVALID_PROVIDER_RESULT', 503],
    ['INTERNAL_FAILURE', 500],
  ])('maps persisted FAILED %s safely to %i', async (failureCode, status) => {
    mocks.finalizeSpfa.mockResolvedValue({
      outcome: 'FAILED',
      sessionId,
      failureCode,
      rawProviderResponse: 'PROVIDER_RAW_SENTINEL',
    });
    const result = await callEndpoint({ sessionId });
    expect(result.response.status).toBe(status);
    expect(result.body).toEqual({
      schemaVersion: '2.0',
      status: 'FAILED',
      retryable: true,
    });
    expect(JSON.stringify(result.body)).not.toMatch(
      /PROVIDER|INTERNAL|failureCode|RAW_SENTINEL|OpenAI/,
    );
  });

  it('allows a subsequent POST to apply server-owned FAILED retry policy', async () => {
    mocks.finalizeSpfa
      .mockResolvedValueOnce({
        outcome: 'FAILED',
        sessionId,
        failureCode: 'PROVIDER_FAILURE',
      })
      .mockResolvedValueOnce({
        outcome: 'COMPLETED',
        sessionId,
        score: { status: 'SCORED', score: 91, needsReview: false },
      });
    expect((await callEndpoint({ sessionId })).response.status).toBe(503);
    const retried = await callEndpoint({ sessionId });
    expect(retried.response.status).toBe(200);
    expect(retried.body.score).toBe(91);
    expect(mocks.finalizeSpfa).toHaveBeenCalledTimes(2);
    expect(mocks.finalizeSpfa.mock.calls).toEqual([
      [{ authenticatedUserId, sessionId }],
      [{ authenticatedUserId, sessionId }],
    ]);
  });

  it('delegates a completed replay to idempotent G4 with no client retry controls', async () => {
    const first = await callEndpoint({ sessionId });
    const second = await callEndpoint({ sessionId });
    expect(first.body).toEqual(second.body);
    expect(mocks.finalizeSpfa).toHaveBeenCalledTimes(2);
    expect(mocks.finalizeSpfa.mock.calls[1]?.[0]).toEqual({
      authenticatedUserId,
      sessionId,
    });
  });

  it.each([
    ['invalid_input', 400, 'Datos inválidos'],
    ['session_not_found_or_forbidden', 404, 'Sesión no encontrada'],
    ['spfa_evaluation_not_available', 422, 'Este caso requiere otro formato de evaluación'],
    ['invalid_session_state', 409, 'La evaluación no está disponible en este estado'],
    ['legacy_evaluation_exists', 409, 'La evaluación no está disponible en este estado'],
    ['evaluation_claim_failed', 500, 'Error guardando evaluación'],
  ])('maps G3 %s safely', async (code, status, message) => {
    mocks.finalizeSpfa.mockRejectedValue(claimError(code));
    const result = await callEndpoint({ sessionId });
    expect(result.response.status).toBe(status);
    expect(result.body).toEqual({ error: message });
    expect(JSON.stringify(result.body)).not.toContain('SPFA_SENTINEL');
  });

  it.each([
    ['attempt_superseded', 409, 'La evaluación ha cambiado de estado'],
    ['evaluation_execution_failed', 500, 'Error guardando evaluación'],
  ])('maps G4 %s safely', async (code, status, message) => {
    mocks.finalizeSpfa.mockRejectedValue(spfaFinalizationError(code));
    const result = await callEndpoint({ sessionId });
    expect(result.response.status).toBe(status);
    expect(result.body).toEqual({ error: message });
    expect(JSON.stringify(result.body)).not.toContain('SPFA_SENTINEL');
  });
});

describe('GET /api/evaluations Generated V2 polling', () => {
  it('authenticates and returns stable NOT_STARTED', async () => {
    const result = await callGet();
    expect(result.response.status).toBe(200);
    expect(result.body).toEqual({ schemaVersion: '2.0', status: 'NOT_STARTED' });
    expect(mocks.readSpfa).toHaveBeenCalledWith({
      authenticatedUserId,
      sessionId,
    });
  });

  it.each([
    [
      { status: 'EVALUATING', sessionId, attemptId: 'SECRET_ATTEMPT', leaseExpiresAt: 'SECRET_LEASE' },
      { schemaVersion: '2.0', status: 'EVALUATING' },
    ],
    [
      { status: 'FAILED', sessionId, failureCode: 'PROVIDER_FAILURE' },
      { schemaVersion: '2.0', status: 'FAILED', retryable: true },
    ],
    [
      {
        status: 'COMPLETED', sessionId,
        score: { status: 'REVIEW_REQUIRED', score: 72.5, needsReview: true },
        evaluation: { transcript: 'TRANSCRIPT_SENTINEL' },
        responseModel: 'MODEL_SENTINEL',
        patientFacts: 'PATIENT_FACTS_SENTINEL',
        evaluator: 'EVALUATOR_SENTINEL',
        ground_truth: 'GROUND_TRUTH_SENTINEL',
        messages: 'MESSAGES_SENTINEL',
        evidenceRefs: 'EVIDENCE_SENTINEL',
        excerpts: 'EXCERPT_SENTINEL',
        targetRefs: 'TARGET_SENTINEL',
        protocol: 'PROTOCOL_SENTINEL',
        promptVersion: 'PROMPT_SENTINEL',
        semanticExecutions: 'SEMANTIC_SENTINEL',
        apiKey: 'API_KEY_SENTINEL',
        rawProviderResponse: 'RAW_PROVIDER_SENTINEL',
      },
      {
        schemaVersion: '2.0', status: 'COMPLETED', score: 72.5,
        scoreStatus: 'REVIEW_REQUIRED', needsReview: true,
      },
    ],
  ])('projects persisted state through the student allowlist', async (source, expected) => {
    mocks.readSpfa.mockResolvedValue(source);
    const result = await callGet();
    expect(result.response.status).toBe(200);
    expect(result.body).toEqual(expected);
    expect(JSON.stringify(result.body)).not.toMatch(
      /SENTINEL|failureCode|attemptId|lease|transcript|responseModel|evidence|patientFacts|ground_truth|targetRefs|promptVersion/,
    );
  });

  it('preserves NOT_SCORABLE as null', async () => {
    mocks.readSpfa.mockResolvedValue({
      status: 'COMPLETED', sessionId,
      score: { status: 'NOT_SCORABLE', score: null, needsReview: false },
      evaluation: {},
    });
    const result = await callGet();
    expect(result.body).toEqual({
      schemaVersion: '2.0', status: 'COMPLETED', score: null,
      scoreStatus: 'NOT_SCORABLE', needsReview: false,
    });
  });

  it('returns 401 without invoking the read boundary', async () => {
    mocks.requireUser.mockRejectedValue(new Error('UNAUTHENTICATED'));
    const result = await callGet();
    expect(result.response.status).toBe(401);
    expect(mocks.readSpfa).not.toHaveBeenCalled();
  });

  it.each(['', '?sessionId=', '?other=value'])('rejects missing sessionId: %s', async (query) => {
    const result = await callGet(query);
    expect(result.response.status).toBe(400);
    expect(mocks.readSpfa).not.toHaveBeenCalled();
  });

  it.each([
    ['session_not_found_or_forbidden', 404, 'Sesión no encontrada'],
    ['spfa_evaluation_not_available', 422, 'Este caso requiere otro formato de evaluación'],
    ['invalid_input', 400, 'Datos inválidos'],
    ['invalid_persisted_evaluation', 500, 'Error consultando evaluación'],
    ['evaluation_read_failed', 500, 'Error consultando evaluación'],
  ])('maps read error %s without leaking internals', async (code, status, message) => {
    mocks.readSpfa.mockRejectedValue(readError(code));
    const result = await callGet();
    expect(result.response.status).toBe(status);
    expect(result.body).toEqual({ error: message });
    expect(JSON.stringify(result.body)).not.toContain('SPFA_SENTINEL');
  });

  it('is a read-only controller and never dispatches runtime or finalization', async () => {
    await callGet();
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.finalizeLegacy).not.toHaveBeenCalled();
    expect(mocks.finalizeSpfa).not.toHaveBeenCalled();
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
    expect(source).toContain('finalizeOwnedSpfaSessionEvaluationV2');
    expect(source).toContain('getOwnedSpfaEvaluationStatusV2');
    expect(source).toContain('toStudentSpfaEvaluationDtoV2');
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
