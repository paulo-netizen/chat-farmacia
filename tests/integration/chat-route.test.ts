import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  return {
    requireUser: vi.fn(),
    query: vi.fn(),
    openAiCreate: vi.fn(),
    resolveRuntime: vi.fn(),
    RuntimeError,
  };
});

vi.mock('@/lib/auth', () => ({ requireUser: mocks.requireUser }));
vi.mock('@/lib/db', () => ({ pool: { query: mocks.query } }));
vi.mock('@/lib/openai', () => ({
  MODEL_CHAT: 'gpt-4o-mini',
  openai: { chat: { completions: { create: mocks.openAiCreate } } },
}));
vi.mock('@/lib/cases/v2/session-clinical-runtime', () => ({
  resolveSessionPatientClinicalRuntimeV2: mocks.resolveRuntime,
  SessionClinicalRuntimeErrorV2: mocks.RuntimeError,
}));

import { POST } from '@/app/api/chat/route';

const userId = 41;
const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = 'casever_90000000-0000-4000-8000-000000000001';
const reply = 'Respuesta literal del paciente';
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
      patientRuntime: {
        schemaVersion: '2.0', caseVersionId,
        publicProfile: {
          nombre: 'María', edad: 68, sexo: 'mujer', tratamiento: 'Enalapril',
        },
        initialDemand: {
          state: 'known',
          factId: 'fact_10000000-0000-4000-8000-000000000001',
          value: 'GENERATED_PATIENT_SENTINEL', certainty: 'exact',
          disclosure: { mode: 'spontaneous' },
        },
        encounter: {
          personPresent: {
            state: 'known',
            factId: 'fact_10000000-0000-4000-8000-000000000002',
            value: 'patient', certainty: 'exact',
            disclosure: { mode: 'open_question' },
          },
        },
        clinicalContext: {
          healthProblems: [], clinicalHistory: [], physiologicalSituation: [],
          allergiesAndIntolerances: [], lifestyle: [], biomedicalData: [],
        },
        symptoms: [],
        pharmacotherapy: {
          prescribedMedications: [], otherMedicinesAndProducts: [],
          actualMedicationUse: [], recentChanges: [],
          perceivedEffectiveness: [], perceivedSafety: [],
        },
        actionsAlreadyTaken: [], practicalDifficulties: [],
        beliefsAndConcerns: [], strategiesAlreadyTried: [],
        dailyAndSocialContext: [], familyAndSocialSupport: [],
        relationshipWithProfessionals: [],
        communicationProfile: {
          sociability: 3, cooperation: 3, organization: 3,
          emotionalReactivity: 3, opennessToChange: 3,
          healthLiteracy: 'medium', professionalTrust: 3,
          medicationAttitude: 'neutral', decisionStyle: 'shared',
          readinessToChange: 3, socialDesirability: 3,
          judgmentSensitivity: 3, disclosureThreshold: 3,
          answerLength: 'brief', assertiveness: 3, emotionalExpression: 3,
        },
      },
      serviceContext: {
        initialSpfa: { service: 'dispensing', subtype: 'continuation' },
        additionalSpfas: [],
      },
    },
  };
}

function sqlOf(call: unknown[]): string {
  return String(call[0]).replace(/\s+/g, ' ').trim();
}

function operation(sql: string) {
  if (/insert into messages/i.test(sql) && /'student'/i.test(sql)) {
    return 'STUDENT_INSERT';
  }
  if (/select role, content/i.test(sql)) return 'HISTORY_SELECT';
  if (/insert into messages/i.test(sql) && /'patient'/i.test(sql)) {
    return 'PATIENT_INSERT';
  }
  if (/update sessions/i.test(sql)) return 'USAGE_UPDATE';
  return 'UNKNOWN';
}

function queryOperations(): string[] {
  return mocks.query.mock.calls.map((call) => operation(sqlOf(call)));
}

function openAiParams() {
  return mocks.openAiCreate.mock.calls[0]?.[0] as {
    model: string;
    max_tokens: number;
    messages: Array<{ role: string; content: string }>;
  };
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

beforeEach(() => {
  vi.resetAllMocks();
  historyRows = [
    { role: 'student', content: 'Pregunta literal del alumno' },
    { role: 'patient', content: 'Respuesta previa literal' },
  ];
  mocks.requireUser.mockResolvedValue({ id: userId, role: 'student' });
  mocks.resolveRuntime.mockResolvedValue(legacyRuntime());
  mocks.query.mockImplementation(async (sql: unknown) =>
    operation(String(sql)) === 'HISTORY_SELECT'
      ? { rows: historyRows }
      : { rows: [] },
  );
  mocks.openAiCreate.mockResolvedValue({
    choices: [{ message: { content: reply } }],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.PRICE_INPUT_EUR_PER_MTOK;
  delete process.env.PRICE_OUTPUT_EUR_PER_MTOK;
});

describe('POST /api/chat authentication and body boundary', () => {
  it('returns 401 when requireUser throws UNAUTHENTICATED', async () => {
    mocks.requireUser.mockRejectedValue(new Error('UNAUTHENTICATED'));
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'No autenticado' });
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it.each([
    [{ message: 'Hola' }, 'missing sessionId'],
    [{ sessionId }, 'missing message'],
    [{ sessionId, message: '   ' }, 'whitespace-only message'],
  ])('returns 400 for %s', async (body, _label) => {
    const result = await callEndpoint(body);
    expect(result.response.status).toBe(400);
    expect(result.body).toEqual({ error: 'Faltan datos' });
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.openAiCreate).not.toHaveBeenCalled();
  });

  it('returns 400 for syntactically malformed JSON without side effects', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"sessionId":',
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Faltan datos' });
    expect(mocks.requireUser).toHaveBeenCalledOnce();
    expect(mocks.resolveRuntime).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.openAiCreate).not.toHaveBeenCalled();
  });

  it('uses only authenticated user and sessionId, ignoring client clinical properties', async () => {
    await callEndpoint({
      sessionId,
      message: '  Mensaje literal con espacios  ',
      caseId: 999,
      caseVersionId: 'CLIENT_VERSION_SECRET',
      groundTruth: 'CLIENT_GROUND_TRUTH_SECRET',
      evaluator: 'CLIENT_EVALUATOR_SECRET',
      patientRuntime: 'CLIENT_RUNTIME_SECRET',
      serviceType: 'CLIENT_SERVICE_SECRET',
    });
    expect(mocks.resolveRuntime).toHaveBeenCalledOnce();
    expect(mocks.resolveRuntime).toHaveBeenCalledWith({
      authenticatedUserId: userId,
      sessionId,
    });
    const studentInsert = mocks.query.mock.calls.find(
      (call) => operation(sqlOf(call)) === 'STUDENT_INSERT',
    );
    expect(studentInsert?.[1]).toEqual([
      sessionId,
      '  Mensaje literal con espacios  ',
    ]);
    const systemPrompt = openAiParams().messages[0].content;
    expect(systemPrompt).toContain('V1_PINNED_PATIENT_SENTINEL');
    expect(systemPrompt).not.toMatch(/CLIENT_(?:VERSION|GROUND_TRUTH|EVALUATOR|RUNTIME|SERVICE)_SECRET/);
  });
});

describe('runtime error policy and fail-fast ordering', () => {
  it.each([
    ['invalid_input', 400, { error: 'Datos inválidos' }],
    ['session_not_found_or_forbidden', 404, { error: 'Sesión no encontrada' }],
    ['session_not_active', 400, { error: 'La sesión no está activa' }],
  ])('maps %s without exposing runtime metadata', async (code, status, expected) => {
    mocks.resolveRuntime.mockRejectedValue(runtimeError(code));
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(status);
    expect(body).toEqual(expected);
    expect(JSON.stringify(body)).not.toMatch(/protected\.path|caseVersionId|contentFormat/);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.openAiCreate).not.toHaveBeenCalled();
  });

  it.each([
    'invalid_session_anchor', 'invalid_case_version_status',
    'unsupported_content_format', 'source_format_mismatch',
    'invalid_case_version_content', 'case_version_identity_mismatch',
    'patient_runtime_validation_failed', 'evaluator_runtime_validation_failed',
  ])('maps corruption error %s to a generic 500', async (code) => {
    mocks.resolveRuntime.mockRejectedValue(runtimeError(code));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(JSON.stringify(body)).not.toContain(code);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.openAiCreate).not.toHaveBeenCalled();
  });

  it('resolves runtime before the first query and before OpenAI', async () => {
    await callEndpoint();
    const runtimeOrder = mocks.resolveRuntime.mock.invocationCallOrder[0];
    expect(runtimeOrder).toBeLessThan(mocks.query.mock.invocationCallOrder[0]);
    expect(runtimeOrder).toBeLessThan(mocks.openAiCreate.mock.invocationCallOrder[0]);
  });

  it('fails before writes and OpenAI if C1 cannot build the prompt', async () => {
    mocks.resolveRuntime.mockResolvedValue({
      ...generatedRuntime(),
      clinicalContent: {
        contentFormat: 'GENERATED_CASE_BUNDLE_V2',
        patientRuntime: null,
        serviceContext: null,
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.openAiCreate).not.toHaveBeenCalled();
  });
});

describe('runtime to prompt to OpenAI integration', () => {
  it('uses the pinned Legacy patient content and excludes academic data', async () => {
    const { response } = await callEndpoint();
    expect(response.status).toBe(200);
    const systemPrompt = openAiParams().messages[0];
    expect(systemPrompt.role).toBe('system');
    expect(systemPrompt.content).toContain('V1_PINNED_PATIENT_SENTINEL');
    expect(systemPrompt.content).toContain('"serviceType": "SAT"');
    expect(systemPrompt.content).not.toMatch(/groundTruth|evaluator/);
  });

  it('uses Generated patient runtime and excludes protected derived structures', async () => {
    mocks.resolveRuntime.mockResolvedValue(generatedRuntime());
    await callEndpoint();
    const systemPrompt = openAiParams().messages[0].content;
    expect(systemPrompt).toContain('GENERATED_PATIENT_SENTINEL');
    expect(systemPrompt).toContain('"service": "dispensing"');
    expect(systemPrompt).not.toMatch(/evaluator|provenance|teachingSummary|complianceReport/);
  });

  it('persists student input, selects ordered history, and maps only valid roles', async () => {
    historyRows = [
      { role: 'student', content: 'Texto literal: groundTruth' },
      { role: 'patient', content: 'Texto literal: caseVersionId' },
    ];
    await callEndpoint({ sessionId, message: 'Mensaje nuevo' });
    expect(queryOperations().slice(0, 2)).toEqual([
      'STUDENT_INSERT', 'HISTORY_SELECT',
    ]);
    const [insert, select] = mocks.query.mock.calls;
    expect(insert[1]).toEqual([sessionId, 'Mensaje nuevo']);
    expect(sqlOf(select)).toMatch(/order by created_at asc, id asc/i);
    expect(select[1]).toEqual([sessionId]);
    expect(openAiParams().messages.slice(1)).toEqual([
      { role: 'user', content: 'Texto literal: groundTruth' },
      { role: 'assistant', content: 'Texto literal: caseVersionId' },
    ]);
  });

  it.each([
    [{ role: 'teacher', content: 'oculto' }, 'invalid role'],
    [{ role: 'student', content: 17 }, 'invalid content'],
  ])('fails closed before OpenAI for persisted %s', async (row, _label) => {
    historyRows = [row];
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(queryOperations()).toEqual(['STUDENT_INSERT', 'HISTORY_SELECT']);
    expect(mocks.openAiCreate).not.toHaveBeenCalled();
  });

  it('uses MODEL_CHAT and max_tokens 200 with the C1 prompt first', async () => {
    await callEndpoint();
    const params = openAiParams();
    expect(params.model).toBe('gpt-4o-mini');
    expect(params.max_tokens).toBe(200);
    expect(params.messages[0].role).toBe('system');
    expect(params.messages[0].content).toContain('REGLAS INMUTABLES DEL ROLE-PLAY');
  });

  it('persists the patient reply and returns exactly {reply}', async () => {
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(200);
    expect(body).toEqual({ reply });
    expect(Object.keys(body)).toEqual(['reply']);
    const patientInsert = mocks.query.mock.calls.find(
      (call) => operation(sqlOf(call)) === 'PATIENT_INSERT',
    );
    expect(patientInsert?.[1]).toEqual([sessionId, reply]);
  });

  it('preserves the fallback when OpenAI returns no content', async () => {
    mocks.openAiCreate.mockResolvedValue({ choices: [{ message: {} }] });
    const { body } = await callEndpoint();
    expect(body).toEqual({ reply: 'Lo siento, no sé qué responder ahora mismo.' });
  });

  it('updates token usage and cost when usage is present', async () => {
    process.env.PRICE_INPUT_EUR_PER_MTOK = '2';
    process.env.PRICE_OUTPUT_EUR_PER_MTOK = '4';
    mocks.openAiCreate.mockResolvedValue({
      choices: [{ message: { content: reply } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });
    await callEndpoint();
    expect(queryOperations()).toEqual([
      'STUDENT_INSERT', 'HISTORY_SELECT', 'PATIENT_INSERT', 'USAGE_UPDATE',
    ]);
    const update = mocks.query.mock.calls[3];
    expect(update[1]).toEqual([100, 50, 0.0004, sessionId]);
  });

  it('does not update usage when OpenAI omits usage', async () => {
    await callEndpoint();
    expect(queryOperations()).toEqual([
      'STUDENT_INSERT', 'HISTORY_SELECT', 'PATIENT_INSERT',
    ]);
  });

  it('returns a generic 500 when OpenAI fails', async () => {
    mocks.openAiCreate.mockRejectedValue(new Error('synthetic provider error'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { response, body } = await callEndpoint();
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error en el chat' });
    expect(queryOperations()).toEqual(['STUDENT_INSERT', 'HISTORY_SELECT']);
  });
});

describe('/api/chat V2 architecture source guard', () => {
  it('contains only B2 runtime and C1 prompt integration, never V1 case access', () => {
    const source = readFileSync('app/api/chat/route.ts', 'utf8');
    expect(source).toContain('resolveSessionPatientClinicalRuntimeV2');
    expect(source).toContain('buildPatientChatSystemPromptV2');
    for (const forbidden of [
      /join\s+(?:public\.)?cases/i,
      /from\s+(?:public\.)?cases/i,
      /public\.cases/i,
      /cases\.spec/i,
      /cases\.ground_truth/i,
      /cases\.service_type/i,
      /\bc\.spec\b/i,
      /\bc\.ground_truth\b/i,
      /\bc\.service_type\b/i,
      /diagnostico_principal/i,
      /problema_farmacoterapeutico/i,
      /tipo_no_adherencia/i,
      /barrera_principal/i,
      /personalidad_paciente/i,
      /current\s+PUBLISHED/i,
      /MAX\s*\(\s*version_number\s*\)/i,
      /ORDER\s+BY\s+case_versions/i,
    ]) {
      expect(source).not.toMatch(forbidden);
    }
  });

  it('performs no case/version lookup directly in the route', async () => {
    await callEndpoint();
    expect(mocks.query).toHaveBeenCalledTimes(3);
    for (const call of mocks.query.mock.calls) {
      const sql = sqlOf(call);
      expect(sql).not.toMatch(/\bcases\b|case_versions|version_number/i);
    }
  });
});
