import { readFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  getUserFromRequest: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  pool: { connect: mocks.connect },
}));

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: mocks.getUserFromRequest,
}));

import { GET } from '@/app/api/sessions/active/route';

const userId = 9;
const caseId = 17;
const caseVersionId =
  'casever_123e4567-e89b-42d3-a456-426614174000';
const otherCaseVersionId =
  'casever_123e4567-e89b-42d3-a456-426614174001';
const sessionId = '52bb337a-9080-4d34-9988-712d175c84c7';
const publicProfile = {
  nombre: 'Antonio',
  edad: 71,
  sexo: 'Hombre',
  tratamiento: 'Losartán 50 mg',
};

function legacyContent() {
  return {
    legacyCaseId: caseId,
    spec: {
      ...publicProfile,
      hiddenFacts: { reason: 'dato oculto' },
      future_secret: 'secreto futuro',
    },
    groundTruth: { tipo_no_adherencia: 'intencionada' },
    evaluator: { answer: 'solución protegida' },
    provenance: { source: 'legacy' },
    legacyStatus: 'approved',
    future_secret: 'secreto futuro',
  };
}

function generatedContent() {
  return {
    schemaVersion: '2.0',
    sourceOfTruth: {
      caseVersionId,
      patientFacts: {
        caseVersionId,
        publicProfile: {
          ...publicProfile,
          future_secret: 'secreto futuro',
        },
        hiddenFacts: { reason: 'dato oculto' },
      },
      evaluator: { answer: 'solución protegida' },
    },
    derived: {
      patientRuntime: { hidden: true },
      teachingSummary: { hidden: true },
    },
    provenance: { model: 'no debe salir' },
    future_secret: 'secreto futuro',
  };
}

function activeLegacyRow(overrides: Record<string, unknown> = {}) {
  return {
    session_id: sessionId,
    session_case_id: String(caseId),
    session_case_version_id: caseVersionId,
    version_id: caseVersionId,
    version_case_id: String(caseId),
    version_status: 'PUBLISHED',
    version_content_format: 'LEGACY_V1_SNAPSHOT',
    version_content: legacyContent(),
    ...overrides,
  };
}

function activeGeneratedRow(overrides: Record<string, unknown> = {}) {
  return {
    session_id: sessionId,
    session_case_id: String(caseId),
    session_case_version_id: caseVersionId,
    version_id: caseVersionId,
    version_case_id: String(caseId),
    version_status: 'PUBLISHED',
    version_content_format: 'GENERATED_CASE_BUNDLE_V2',
    version_content: generatedContent(),
    ...overrides,
  };
}

type QueryResult = { rows: unknown[] };

function createClient(results: Array<QueryResult | Error>) {
  const query = vi.fn();
  for (const result of results) {
    if (result instanceof Error) {
      query.mockRejectedValueOnce(result);
    } else {
      query.mockResolvedValueOnce(result);
    }
  }

  return {
    query,
    release: vi.fn(),
  };
}

async function callEndpoint() {
  const response = await GET(
    new Request('http://localhost/api/sessions/active'),
  );
  const text = await response.text();
  return {
    response,
    text,
    body: text.length === 0 ? null : JSON.parse(text),
  };
}

function querySql(client: ReturnType<typeof createClient>): string[] {
  return client.query.mock.calls.map(([sql]) => String(sql));
}

function expectNoWrites(client: ReturnType<typeof createClient>) {
  for (const sql of querySql(client)) {
    expect(sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE)\b/i);
  }
}

function expectGenericError(
  response: Response,
  body: Record<string, unknown>,
) {
  expect(response.status).toBe(500);
  expect(body).toEqual({ error: 'Error recuperando sesión' });
  expect(Object.keys(body)).toEqual(['error']);
  const serialized = JSON.stringify(body);
  for (const protectedValue of [
    'caseVersionId',
    'version_content',
    'groundTruth',
    'future_secret',
    'solución protegida',
  ]) {
    expect(serialized).not.toContain(protectedValue);
  }
}

function expectExactSuccessPayload(
  body: Record<string, unknown>,
  expectedMessages: Array<{ role: 'student' | 'patient'; content: string }>,
) {
  expect(Object.keys(body).sort()).toEqual(['messages', 'session']);
  expect(body.session).toEqual({ sessionId, ...publicProfile });
  expect(Object.keys(body.session as Record<string, unknown>).sort()).toEqual(
    ['edad', 'nombre', 'sessionId', 'sexo', 'tratamiento'].sort(),
  );
  expect(body.messages).toEqual(expectedMessages);
  for (const message of body.messages as Array<Record<string, unknown>>) {
    expect(Object.keys(message).sort()).toEqual(['content', 'role']);
  }
}

describe('GET /api/sessions/active', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUserFromRequest.mockResolvedValue({
      id: userId,
      role: 'student',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 without opening a database connection when unauthenticated', async () => {
    mocks.getUserFromRequest.mockResolvedValue(null);

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'No autenticado' });
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('returns 204 without a body when there is no active session', async () => {
    const client = createClient([{ rows: [] }]);
    mocks.connect.mockResolvedValue(client);

    const { response, body, text } = await callEndpoint();

    expect(response.status).toBe(204);
    expect(text).toBe('');
    expect(body).toBeNull();
    expect(client.query).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledOnce();
    expectNoWrites(client);
  });

  it.each([
    ['PUBLISHED legacy', () => activeLegacyRow()],
    [
      'ARCHIVED legacy',
      () => activeLegacyRow({ version_status: 'ARCHIVED' }),
    ],
    ['PUBLISHED generated', () => activeGeneratedRow()],
    [
      'ARCHIVED generated',
      () => activeGeneratedRow({ version_status: 'ARCHIVED' }),
    ],
  ])('recovers %s with an empty persisted history', async (_kind, makeRow) => {
    const client = createClient([
      { rows: [makeRow()] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(200);
    expectExactSuccessPayload(body, []);
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalledOnce();
    expectNoWrites(client);

    const serialized = JSON.stringify(body);
    for (const protectedValue of [
      'caseId',
      'caseVersionId',
      'version_content',
      'spec',
      'groundTruth',
      'evaluator',
      'derived',
      'provenance',
      'future_secret',
    ]) {
      expect(serialized).not.toContain(protectedValue);
    }
  });

  it('returns persisted student and patient messages literally with exact keys', async () => {
    const messages = [
      {
        role: 'student',
        content: 'He escrito groundTruth y caseVersionId como texto.',
        id: 11,
        created_at: '2026-08-22T12:00:00Z',
      },
      {
        role: 'patient',
        content: 'Esas palabras forman parte literal de la conversación.',
        id: 12,
        created_at: '2026-08-22T12:00:01Z',
        future_secret: 'no copiar estructura extra',
      },
    ];
    const client = createClient([
      { rows: [activeLegacyRow()] },
      { rows: messages },
    ]);
    mocks.connect.mockResolvedValue(client);

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(200);
    expectExactSuccessPayload(body, [
      { role: 'student', content: messages[0].content },
      { role: 'patient', content: messages[1].content },
    ]);
    expect(JSON.stringify(body)).toContain('groundTruth');
    expect(JSON.stringify(body)).toContain('caseVersionId');
    expect(JSON.stringify(body)).not.toContain('created_at');
    expect(JSON.stringify(body)).not.toContain('future_secret');
    expectNoWrites(client);
  });

  it('fails closed for duplicate active sessions without loading messages', async () => {
    const client = createClient([
      {
        rows: [
          activeLegacyRow(),
          activeLegacyRow({
            session_id: '62bb337a-9080-4d34-9988-712d175c84c7',
          }),
        ],
      },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(client.query).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledOnce();
    expectNoWrites(client);
  });

  it.each([
    'AI_DRAFT',
    'TEACHER_DRAFT',
    'IN_REVIEW',
    'VALIDATED',
  ])('fails closed for active session with %s version', async (status) => {
    const client = createClient([
      { rows: [activeLegacyRow({ version_status: status })] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(client.query).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledOnce();
    expectNoWrites(client);
  });

  it.each([
    ['version absent after LEFT JOIN', { version_id: null }],
    ['invalid session case id', { session_case_id: 'not-a-bigint' }],
    ['invalid version case id', { version_case_id: '17x' }],
    ['mismatched case ids', { session_case_id: '18' }],
    [
      'mismatched case version id',
      { session_case_version_id: otherCaseVersionId },
    ],
    [
      'invalid version content',
      {
        version_content: {
          spec: null,
          future_secret: 'protected recovery marker',
        },
      },
    ],
    ['invalid session id', { session_id: 'invalid-session-id' }],
  ])('fails closed for %s', async (_reason, overrides) => {
    const client = createClient([
      { rows: [activeLegacyRow(overrides)] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(client.query).toHaveBeenCalledOnce();
    expect(client.release).toHaveBeenCalledOnce();
    expectNoWrites(client);
  });

  it.each([
    ['invalid role', { role: 'teacher', content: 'oculto' }],
    ['non-string content', { role: 'student', content: 17 }],
  ])('fails closed for persisted message with %s', async (_reason, message) => {
    const client = createClient([
      { rows: [activeGeneratedRow()] },
      { rows: [message] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(client.query).toHaveBeenCalledTimes(2);
    expect(client.release).toHaveBeenCalledOnce();
    expectNoWrites(client);
  });

  it('uses approved read-only SQL with server-side ownership and deterministic order', async () => {
    const client = createClient([
      { rows: [activeLegacyRow()] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);

    await callEndpoint();

    const [activeSql, messagesSql] = querySql(client);
    expect(activeSql).toContain('FROM public.sessions AS s');
    expect(activeSql).toContain('LEFT JOIN public.case_versions AS cv');
    expect(activeSql).toContain('s.user_id = $1');
    expect(activeSql).toContain("s.status = 'active'");
    expect(activeSql).toContain('cv.id = s.case_version_id');
    expect(activeSql).toContain('cv.case_id = s.case_id');
    expect(activeSql).toContain('ORDER BY s.created_at ASC, s.id ASC');
    expect(activeSql).not.toMatch(/\bLIMIT\s+1\b/i);
    expect(activeSql).not.toMatch(/\bcv\.status\s*=/i);
    expect(activeSql).not.toMatch(/\bpublic\.cases\b/i);
    expect(activeSql).not.toContain('cases.spec');
    expect(activeSql).not.toContain('ground_truth');
    expect(activeSql).not.toMatch(/SELECT\s+(?:\w+\.)?\*/i);

    expect(messagesSql).toContain('FROM public.messages AS m');
    expect(messagesSql).toContain('INNER JOIN public.sessions AS s');
    expect(messagesSql).toContain('m.session_id = $1');
    expect(messagesSql).toContain('s.id = m.session_id');
    expect(messagesSql).toContain('s.user_id = $2');
    expect(messagesSql).toContain(
      'ORDER BY m.created_at ASC, m.id ASC',
    );
    expect(messagesSql).not.toMatch(/SELECT\s+(?:\w+\.)?\*/i);
    expect(client.query).toHaveBeenNthCalledWith(1, expect.any(String), [userId]);
    expect(client.query).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      [sessionId, userId],
    );
    expect(querySql(client).join('\n')).not.toContain(
      'pg_advisory_xact_lock',
    );
    expectNoWrites(client);
  });

  it('keeps /api/chat message history ordered by created_at and id', () => {
    const source = readFileSync(
      new URL('../../app/api/chat/route.ts', import.meta.url),
      'utf8',
    );

    expect(source).toMatch(
      /order\s+by\s+created_at\s+asc\s*,\s*id\s+asc/i,
    );
  });
});
