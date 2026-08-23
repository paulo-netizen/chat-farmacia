import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class RuntimeError extends Error {
    constructor(
      public readonly code: string,
      public readonly path: string,
    ) {
      super(`${code} at ${path}`);
      this.name = 'SessionClinicalRuntimeErrorV2';
    }
  }
  class SafetyError extends Error {
    public readonly calls: readonly Record<string, unknown>[];
    constructor(
      public readonly code: string,
      public readonly stage: string,
      public readonly cause: unknown,
      calls: readonly Record<string, unknown>[],
    ) {
      super(`${code} at ${stage}: safe patient reply generation failed`);
      this.name = 'PatientResponseSafetyErrorV2';
      this.calls = Object.freeze(calls.map((call) => Object.freeze({ ...call })));
    }
  }
  return {
    requireUser: vi.fn(),
    query: vi.fn(),
    resolveRuntime: vi.fn(),
    generateSafeReply: vi.fn(),
    openAiClient: Object.freeze({ syntheticClient: true }),
    RuntimeError,
    SafetyError,
  };
});

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/db', () => ({ pool: { query: mocks.query } }));
vi.mock('@/lib/openai', () => ({
  MODEL_CHAT: 'gpt-4o-mini',
  openai: mocks.openAiClient,
}));
vi.mock('@/lib/cases/v2/session-clinical-runtime', () => ({
  resolveSessionPatientClinicalRuntimeV2: mocks.resolveRuntime,
  SessionClinicalRuntimeErrorV2: mocks.RuntimeError,
}));
vi.mock('@/lib/cases/v2/generate-safe-patient-reply', () => ({
  generateSafePatientReplyV2: mocks.generateSafeReply,
  PatientResponseSafetyErrorV2: mocks.SafetyError,
}));

import { POST } from '@/app/api/chat/route';

const userId = 41;
const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = 'casever_90000000-0000-4000-8000-000000000001';
const reply = 'Respuesta segura aceptada del paciente';
const rejectedCandidate = 'SECRET_REJECTED_CANDIDATE_12345';
let historyRows: unknown[];

function legacyRuntime() {
  return {
    sessionId,
    caseId: 7,
    caseVersionId,
    clinicalContent: {
      contentFormat: 'LEGACY_V1_SNAPSHOT',
      patientData: {
        nombre: 'Ana', edad: 54, sexo: 'mujer', tratamiento: 'Metformina',
        motivo_consulta: 'V1_PINNED_PATIENT_SENTINEL',
        personalidad_paciente: 'Reservada y prudente',
      },
      serviceContext: { serviceType: 'SAT' },
    },
  };
}

function generatedRuntime() {
  return {
    sessionId,
    caseId: 7,
    caseVersionId,
    clinicalContent: {
      contentFormat: 'GENERATED_CASE_BUNDLE_V2',
      patientRuntime: { generatedPatientRuntime: 'PINNED_GENERATED_SENTINEL' },
      serviceContext: {
        initialSpfa: { service: 'dispensing', subtype: 'continuation' },
        additionalSpfas: [],
      },
    },
  };
}

function callReceipt(
  kind: 'patient_generation' | 'semantic_validation',
  attempt: 'initial' | 'regeneration',
  inputTokens?: number,
  outputTokens?: number,
) {
  return {
    kind,
    attempt,
    model: kind === 'patient_generation' ? 'patient-model' : 'validator-model',
    ...(inputTokens === undefined || outputTokens === undefined
      ? {}
      : { inputTokens, outputTokens }),
  };
}

function acceptedReply(
  calls = [
    callReceipt('patient_generation', 'initial', 50, 5),
    callReceipt('semantic_validation', 'initial', 70, 4),
  ],
) {
  return {
    reply,
    receipt: {
      calls,
      totalInputTokens: 120,
      totalOutputTokens: 9,
      usageComplete: true,
    },
  };
}

function sqlOf(call: unknown[]): string {
  return String(call[0]).replace(/\s+/g, ' ').trim();
}

function operation(sql: string) {
  if (/select role, content/i.test(sql)) return 'HISTORY_SELECT';
  if (/insert into messages/i.test(sql) && /'student'/i.test(sql)) {
    return 'STUDENT_INSERT';
  }
  if (/update sessions/i.test(sql)) return 'USAGE_UPDATE';
  if (/insert into messages/i.test(sql) && /'patient'/i.test(sql)) {
    return 'PATIENT_INSERT';
  }
  return 'UNKNOWN';
}

function queryOperations(): string[] {
  return mocks.query.mock.calls.map((call) => operation(sqlOf(call)));
}

function queryCall(name: string): unknown[] | undefined {
  return mocks.query.mock.calls.find((call) => operation(sqlOf(call)) === name);
}

async function callEndpoint(body: unknown = { sessionId, message: 'Hola' }) {
  const response = await POST(
    new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  return { response, body: await response.json() };
}

function runtimeError(code: string) {
  return new mocks.RuntimeError(code, 'protected.path');
}

function safetyError(
  calls: readonly Record<string, unknown>[],
  cause: unknown = new Error(rejectedCandidate),
) {
  return new mocks.SafetyError(
    'UNSAFE_AFTER_REGENERATION', 'regeneration', cause, calls,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  historyRows = [
    { role: 'student', content: 'Pregunta previa del alumno' },
    { role: 'patient', content: 'Respuesta previa aceptada' },
  ];
  mocks.requireUser.mockResolvedValue({ id: userId, role: 'student' });
  mocks.resolveRuntime.mockResolvedValue(legacyRuntime());
  mocks.generateSafeReply.mockResolvedValue(acceptedReply());
  mocks.query.mockImplementation(async (sql: unknown) =>
    operation(String(sql)) === 'HISTORY_SELECT'
      ? { rows: historyRows }
      : { rows: [] },
  );
});

describe('POST /api/chat authentication, body and runtime errors', () => {
  it('returns 401 without DB or safety orchestration when unauthenticated', async () => {
    mocks.requireUser.mockRejectedValue(new Error('UNAUTHENTICATED'));
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'No autenticado' });
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.generateSafeReply).not.toHaveBeenCalled();
  });

  it.each([
    [{ message: 'Hola' }, 'missing sessionId'],
    [{ sessionId }, 'missing message'],
    [{ sessionId, message: '   ' }, 'blank message'],
  ])('returns 400 for %s', async (requestBody, _label) => {
    const result = await callEndpoint(requestBody);
    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: 'Faltan datos' });
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed JSON without side effects', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"sessionId":',
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Faltan datos' });
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([
    ['invalid_input', 400, { error: 'Datos inválidos' }],
    ['session_not_found_or_forbidden', 404, { error: 'Sesión no encontrada' }],
    ['session_not_active', 400, { error: 'La sesión no está activa' }],
  ])('preserves runtime mapping for %s', async (code, status, expected) => {
    mocks.resolveRuntime.mockRejectedValue(runtimeError(code));
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(status);
    expect(body).toEqual(expected);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.generateSafeReply).not.toHaveBeenCalled();
  });

  it('maps other runtime corruption to generic 500', async () => {
    mocks.resolveRuntime.mockRejectedValue(
      runtimeError('invalid_case_version_content'),
    );
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(JSON.stringify(body)).not.toContain('protected.path');
  });
});

describe('POST /api/chat safe patient reply sequencing', () => {
  it('resolves the session-bound runtime before reading history', async () => {
    await callEndpoint();
    expect(mocks.resolveRuntime.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.query.mock.invocationCallOrder[0],
    );
    expect(mocks.resolveRuntime).toHaveBeenCalledWith({
      authenticatedUserId: userId,
      sessionId,
    });
  });

  it('reads accepted conversation before inserting the current student turn', async () => {
    await callEndpoint({ sessionId, message: 'Turno actual exacto' });
    expect(queryOperations().slice(0, 2)).toEqual([
      'HISTORY_SELECT', 'STUDENT_INSERT',
    ]);
    const select = queryCall('HISTORY_SELECT');
    expect(sqlOf(select ?? [])).toMatch(/order by created_at asc, id asc/i);
    expect(select?.[1]).toEqual([sessionId]);
    expect(queryCall('STUDENT_INSERT')?.[1]).toEqual([
      sessionId, 'Turno actual exacto',
    ]);
  });

  it('passes exact session-bound content, prior conversation and current turn once', async () => {
    const runtime = legacyRuntime();
    mocks.resolveRuntime.mockResolvedValue(runtime);
    await callEndpoint({ sessionId, message: 'Turno actual exacto' });
    expect(mocks.generateSafeReply).toHaveBeenCalledOnce();
    expect(mocks.generateSafeReply.mock.calls[0][0]).toEqual({
      clinicalContent: runtime.clinicalContent,
      acceptedConversation: historyRows,
      currentStudentTurn: 'Turno actual exacto',
    });
    expect(
      mocks.generateSafeReply.mock.calls[0][0].acceptedConversation,
    ).not.toContainEqual({ role: 'student', content: 'Turno actual exacto' });
    expect(
      JSON.stringify(mocks.generateSafeReply.mock.calls[0][0]).match(
        /Turno actual exacto/g,
      ),
    ).toHaveLength(1);
  });

  it('supports exact Generated session-bound clinical content without route projection', async () => {
    const runtime = generatedRuntime();
    mocks.resolveRuntime.mockResolvedValue(runtime);
    await callEndpoint();
    expect(mocks.generateSafeReply.mock.calls[0][0].clinicalContent).toBe(
      runtime.clinicalContent,
    );
  });

  it('ignores client-supplied clinical fields and uses only authenticated runtime data', async () => {
    const runtime = legacyRuntime();
    mocks.resolveRuntime.mockResolvedValue(runtime);
    await callEndpoint({
      sessionId,
      message: 'Turno actual',
      clinicalContent: { ground_truth: 'CLIENT_SECRET' },
      evaluator: 'CLIENT_EVALUATOR',
      caseVersionId: 'CLIENT_VERSION',
    });
    expect(mocks.resolveRuntime).toHaveBeenCalledWith({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(mocks.generateSafeReply.mock.calls[0][0].clinicalContent).toBe(
      runtime.clinicalContent,
    );
    expect(JSON.stringify(mocks.generateSafeReply.mock.calls[0][0])).not.toMatch(
      /CLIENT_SECRET|CLIENT_EVALUATOR|CLIENT_VERSION/,
    );
  });

  it('persists the current student turn before invoking the orchestrator', async () => {
    await callEndpoint();
    const studentCall = mocks.query.mock.calls.find(
      (call) => operation(sqlOf(call)) === 'STUDENT_INSERT',
    );
    expect(studentCall).toBeDefined();
    expect(studentCall?.[1]).toEqual([sessionId, 'Hola']);
    expect(mocks.query.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.generateSafeReply.mock.invocationCallOrder[0],
    );
  });

  it('uses one server-owned OpenAI client with approved configs', async () => {
    await callEndpoint();
    expect(mocks.generateSafeReply.mock.calls[0][1]).toEqual({
      patientGenerator: {
        client: mocks.openAiClient,
        config: {
          model: 'gpt-4o-mini', maxTokens: 200, timeoutMs: 30_000,
        },
      },
      semanticValidator: {
        client: mocks.openAiClient,
        config: {
          model: 'gpt-4o-mini', maxOutputTokens: 300, timeoutMs: 30_000,
        },
      },
    });
  });

  it('persists student, accounts usage, persists accepted reply and returns it', async () => {
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(200);
    expect(body).toEqual({ reply });
    expect(queryOperations()).toEqual([
      'HISTORY_SELECT', 'STUDENT_INSERT', 'USAGE_UPDATE', 'PATIENT_INSERT',
    ]);
    expect(queryCall('USAGE_UPDATE')?.[1]).toEqual([120, 9, sessionId]);
    expect(queryCall('PATIENT_INSERT')?.[1]).toEqual([sessionId, reply]);
  });

  it('never persists a rejected candidate or raw provider output', async () => {
    mocks.generateSafeReply.mockResolvedValue({
      ...acceptedReply(),
      providerRawOutput: rejectedCandidate,
    });
    await callEndpoint();
    expect(queryCall('PATIENT_INSERT')?.[1]).toEqual([sessionId, reply]);
    expect(JSON.stringify(mocks.query.mock.calls)).not.toContain(rejectedCandidate);
  });

  it('fails before student INSERT when persisted history is invalid', async () => {
    historyRows = [{ role: 'teacher', content: 'dato inválido' }];
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(queryOperations()).toEqual(['HISTORY_SELECT']);
    expect(mocks.generateSafeReply).not.toHaveBeenCalled();
  });
});

describe('POST /api/chat usage accounting', () => {
  it('sums all observed calls from a successful regeneration', async () => {
    const calls = [
      callReceipt('patient_generation', 'initial', 10, 1),
      callReceipt('semantic_validation', 'initial', 20, 2),
      callReceipt('patient_generation', 'regeneration', 30, 3),
      callReceipt('semantic_validation', 'regeneration', 40, 4),
    ];
    mocks.generateSafeReply.mockResolvedValue(acceptedReply(calls));
    await callEndpoint();
    expect(queryCall('USAGE_UPDATE')?.[1]).toEqual([100, 10, sessionId]);
  });

  it('sums only fully observed usage and accepts observed 0/0', async () => {
    const calls = [
      callReceipt('patient_generation', 'initial'),
      callReceipt('semantic_validation', 'initial', 12, 3),
      callReceipt('patient_generation', 'regeneration', 0, 0),
    ];
    mocks.generateSafeReply.mockResolvedValue(acceptedReply(calls));
    await callEndpoint();
    expect(queryCall('USAGE_UPDATE')?.[1]).toEqual([12, 3, sessionId]);
  });

  it('skips usage UPDATE when no call has observed usage', async () => {
    mocks.generateSafeReply.mockResolvedValue(
      acceptedReply([callReceipt('patient_generation', 'initial')]),
    );
    await callEndpoint();
    expect(queryOperations()).toEqual([
      'HISTORY_SELECT', 'STUDENT_INSERT', 'PATIENT_INSERT',
    ]);
  });

  it('does not update cost_eur', async () => {
    await callEndpoint();
    const updateSql = sqlOf(queryCall('USAGE_UPDATE') ?? []);
    expect(updateSql).toMatch(/prompt_tokens/i);
    expect(updateSql).toMatch(/completion_tokens/i);
    expect(updateSql).not.toMatch(/cost_eur|PRICE_INPUT|PRICE_OUTPUT/i);
  });

  it('returns 500 and never persists patient if usage UPDATE fails', async () => {
    mocks.query.mockImplementation(async (sql: unknown) => {
      const op = operation(String(sql));
      if (op === 'HISTORY_SELECT') return { rows: historyRows };
      if (op === 'USAGE_UPDATE') throw new Error('synthetic accounting failure');
      return { rows: [] };
    });
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(queryOperations()).toEqual([
      'HISTORY_SELECT', 'STUDENT_INSERT', 'USAGE_UPDATE',
    ]);
  });

  it('keeps accounted usage if patient INSERT subsequently fails', async () => {
    mocks.query.mockImplementation(async (sql: unknown) => {
      const op = operation(String(sql));
      if (op === 'HISTORY_SELECT') return { rows: historyRows };
      if (op === 'PATIENT_INSERT') throw new Error('synthetic patient insert failure');
      return { rows: [] };
    });
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(queryOperations()).toEqual([
      'HISTORY_SELECT', 'STUDENT_INSERT', 'USAGE_UPDATE', 'PATIENT_INSERT',
    ]);
    expect(queryCall('USAGE_UPDATE')?.[1]).toEqual([120, 9, sessionId]);
  });
});

describe('POST /api/chat safety failures', () => {
  it('accounts completed calls, leaves student and returns exact generic 503', async () => {
    const calls = [
      callReceipt('patient_generation', 'initial', 50, 5),
      callReceipt('semantic_validation', 'initial', 70, 4),
    ];
    mocks.generateSafeReply.mockRejectedValue(safetyError(calls));
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(503);
    expect(body).toEqual({
      error: 'No se pudo generar una respuesta segura del paciente',
    });
    expect(queryOperations()).toEqual([
      'HISTORY_SELECT', 'STUDENT_INSERT', 'USAGE_UPDATE',
    ]);
    expect(queryCall('USAGE_UPDATE')?.[1]).toEqual([120, 9, sessionId]);
    expect(queryCall('PATIENT_INSERT')).toBeUndefined();
    expect(JSON.stringify(body)).not.toMatch(
      /UNSAFE_AFTER|regeneration|patient-model|validator-model|SECRET_/i,
    );
  });

  it('does not invent usage or persist patient for calls=[]', async () => {
    mocks.generateSafeReply.mockRejectedValue(safetyError([]));
    const { response } = await callEndpoint();
    expect(response.status).toBe(503);
    expect(queryOperations()).toEqual(['HISTORY_SELECT', 'STUDENT_INSERT']);
    expect(queryCall('STUDENT_INSERT')?.[1]).toEqual([sessionId, 'Hola']);
  });

  it('maps an unknown orchestrator failure to generic 500 after student persistence', async () => {
    mocks.generateSafeReply.mockRejectedValue(
      new Error('synthetic unknown orchestration failure'),
    );
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(queryOperations()).toEqual(['HISTORY_SELECT', 'STUDENT_INSERT']);
    expect(queryCall('PATIENT_INSERT')).toBeUndefined();
  });

  it('accounts only fully observed error-call usage', async () => {
    mocks.generateSafeReply.mockRejectedValue(
      safetyError([
        callReceipt('patient_generation', 'initial'),
        callReceipt('semantic_validation', 'initial', 9, 2),
      ]),
    );
    const { response } = await callEndpoint();
    expect(response.status).toBe(503);
    expect(queryCall('USAGE_UPDATE')?.[1]).toEqual([9, 2, sessionId]);
  });

  it('accounts all four completed regeneration calls on safety failure', async () => {
    mocks.generateSafeReply.mockRejectedValue(
      safetyError([
        callReceipt('patient_generation', 'initial', 1, 2),
        callReceipt('semantic_validation', 'initial', 3, 4),
        callReceipt('patient_generation', 'regeneration', 5, 6),
        callReceipt('semantic_validation', 'regeneration', 7, 8),
      ]),
    );
    await callEndpoint();
    expect(queryCall('USAGE_UPDATE')?.[1]).toEqual([16, 20, sessionId]);
  });

  it('returns generic 500 if accounting also fails during safety error', async () => {
    mocks.generateSafeReply.mockRejectedValue(
      safetyError([callReceipt('patient_generation', 'initial', 5, 1)]),
    );
    mocks.query.mockImplementation(async (sql: unknown) => {
      const op = operation(String(sql));
      if (op === 'HISTORY_SELECT') return { rows: historyRows };
      if (op === 'USAGE_UPDATE') throw new Error('synthetic accounting failure');
      return { rows: [] };
    });
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(queryCall('PATIENT_INSERT')).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(rejectedCandidate);
  });

  it('never persists fallback, unsafe candidate or violation codes', async () => {
    mocks.generateSafeReply.mockRejectedValue(
      safetyError([], new Error(`${rejectedCandidate} ROLE_BREAK`)),
    );
    await callEndpoint();
    const serializedQueries = JSON.stringify(mocks.query.mock.calls);
    expect(serializedQueries).not.toContain(rejectedCandidate);
    expect(serializedQueries).not.toContain('ROLE_BREAK');
    expect(serializedQueries).not.toContain(
      'Lo siento, no sé qué responder ahora mismo.',
    );
  });
});

describe('/api/chat 4F-D architecture source guard', () => {
  it('delegates only to safe orchestrator and removes direct generation/fallback/pricing', () => {
    const source = readFileSync('app/api/chat/route.ts', 'utf8');
    expect(source).toContain('generateSafePatientReplyV2');
    expect(source).toContain('resolveSessionPatientClinicalRuntimeV2');
    expect(source).not.toContain('buildPatientChatSystemPromptV2');
    expect(source).not.toContain('chat.completions.create');
    expect(source).not.toContain('guardPatientResponseCandidateV2');
    expect(source).not.toContain('executeOpenAiPatientResponseValidatorV2');
    expect(source).not.toContain('Lo siento, no sé qué responder ahora mismo.');
    expect(source).not.toMatch(/cost_eur|PRICE_INPUT|PRICE_OUTPUT/);
  });

  it('performs no direct case/version lookup or protected-data query', async () => {
    await callEndpoint();
    for (const call of mocks.query.mock.calls) {
      expect(sqlOf(call)).not.toMatch(
        /\bcases\b|case_versions|ground_truth|version_number/i,
      );
    }
  });
});
