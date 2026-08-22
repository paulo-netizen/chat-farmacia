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

import { POST } from '@/app/api/sessions/route';

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
    description: 'descripción docente',
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

function legacyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: caseVersionId,
    case_id: String(caseId),
    status: 'PUBLISHED',
    content_format: 'LEGACY_V1_SNAPSHOT',
    content: legacyContent(),
    ...overrides,
  };
}

function generatedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: caseVersionId,
    case_id: String(caseId),
    status: 'PUBLISHED',
    content_format: 'GENERATED_CASE_BUNDLE_V2',
    content: generatedContent(),
    ...overrides,
  };
}

function activeLegacyRow(overrides: Record<string, unknown> = {}) {
  const version = legacyRow();
  return {
    session_id: sessionId,
    session_case_id: String(caseId),
    session_case_version_id: caseVersionId,
    version_id: version.id,
    version_case_id: version.case_id,
    version_status: version.status,
    version_content_format: version.content_format,
    version_content: version.content,
    ...overrides,
  };
}

function activeGeneratedRow(overrides: Record<string, unknown> = {}) {
  const version = generatedRow();
  return {
    session_id: sessionId,
    session_case_id: String(caseId),
    session_case_version_id: caseVersionId,
    version_id: version.id,
    version_case_id: version.case_id,
    version_status: version.status,
    version_content_format: version.content_format,
    version_content: version.content,
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
  const response = await POST(
    new Request('http://localhost/api/sessions', { method: 'POST' }),
  );
  return { response, body: await response.json() };
}

function expectPublicResponse(body: Record<string, unknown>) {
  expect(Object.keys(body).sort()).toEqual(
    ['edad', 'nombre', 'sessionId', 'sexo', 'tratamiento'].sort(),
  );
  expect(body).toEqual({ sessionId, ...publicProfile });
  expect(Object.values(body).some((value) => typeof value === 'object')).toBe(
    false,
  );
  expect(body).not.toHaveProperty('caseId');
  expect(body).not.toHaveProperty('caseVersionId');
  expect(body).not.toHaveProperty('content');

  const serialized = JSON.stringify(body);
  for (const forbidden of [
    'case_id',
    'caseVersionId',
    'content',
    'spec',
    'groundTruth',
    'evaluator',
    'hiddenFacts',
    'future_secret',
    'sourceOfTruth',
    'derived',
    'provenance',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

function querySql(client: ReturnType<typeof createClient>): string[] {
  return client.query.mock.calls.map(([sql]) => String(sql));
}

function operationName(sql: string): string {
  const normalized = sql.trim().replace(/\s+/g, ' ');
  if (normalized === 'BEGIN' || normalized === 'COMMIT' || normalized === 'ROLLBACK') {
    return normalized;
  }
  if (/pg_advisory_xact_lock/i.test(normalized)) {
    return 'LOCK';
  }
  if (/FROM public\.sessions AS s/i.test(normalized)) {
    return 'ACTIVE_LOOKUP';
  }
  if (/FROM public\.case_versions AS cv/i.test(normalized)) {
    return 'VERSION_SELECT';
  }
  if (/^SELECT\b/i.test(normalized)) {
    return 'SELECT';
  }
  if (/^INSERT INTO public\.case_assignments\b/i.test(normalized)) {
    return 'ASSIGNMENT';
  }
  if (/^INSERT INTO public\.sessions\b/i.test(normalized)) {
    return 'SESSION';
  }
  return normalized;
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
  expect(body).toEqual({ error: 'Error creando sesión' });
  expect(Object.keys(body)).toEqual(['error']);
  expect(JSON.stringify(body)).not.toContain('caseVersionId');
  expect(JSON.stringify(body)).not.toContain('future_secret');
}

describe('POST /api/sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUserFromRequest.mockResolvedValue({ id: userId, role: 'student' });
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

  it('creates a session atomically from an unassigned published legacy version', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [legacyRow()] },
      { rows: [] },
      { rows: [{ id: sessionId }] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(200);
    expectPublicResponse(body);
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'VERSION_SELECT',
      'ASSIGNMENT',
      'SESSION',
      'COMMIT',
    ]);
    expect(client.query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('INSERT INTO public.sessions'),
      [userId, caseId, caseVersionId],
    );
    expect(client.query).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('INSERT INTO public.case_assignments'),
      [userId, caseId],
    );
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('creates the same public DTO from a generated V2 bundle', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [generatedRow()] },
      { rows: [] },
      { rows: [{ id: sessionId }] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(200);
    expectPublicResponse(body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'VERSION_SELECT',
      'ASSIGNMENT',
      'SESSION',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('uses the published-version fallback in the same transaction', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [legacyRow()] },
      { rows: [] },
      { rows: [{ id: sessionId }] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(200);
    expectPublicResponse(body);
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'VERSION_SELECT',
      'VERSION_SELECT',
      'ASSIGNMENT',
      'SESSION',
      'COMMIT',
    ]);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([
    '',
    '0',
    '-1',
    '01',
    '1.5',
    '17x',
    '9007199254740992',
    null,
    undefined,
    17,
  ])('rejects invalid bigint text %p before every write', async (invalidCaseId) => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [legacyRow({ case_id: invalidCaseId })] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'VERSION_SELECT',
      'ROLLBACK',
    ]);
    expect(querySql(client).some((sql) => /\bINSERT\b/i.test(sql))).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back invalid version content before assignment and session writes', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [legacyRow({ content: { spec: null, future_secret: 'hidden' } })] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'VERSION_SELECT',
      'ROLLBACK',
    ]);
    expect(querySql(client).some((sql) => sql.includes('case_assignments'))).toBe(
      true,
    );
    expect(
      querySql(client).some((sql) => /INSERT INTO public\.case_assignments/i.test(sql)),
    ).toBe(false);
    expect(
      querySql(client).some((sql) => /INSERT INTO public\.sessions/i.test(sql)),
    ).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back the assignment when the session insert fails', async () => {
    const databaseError = new Error('synthetic session insert failure');
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [legacyRow()] },
      { rows: [] },
      databaseError,
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'VERSION_SELECT',
      'ASSIGNMENT',
      'SESSION',
      'ROLLBACK',
    ]);
    expect(querySql(client)).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back without writes when no published version exists', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'VERSION_SELECT',
      'VERSION_SELECT',
      'ROLLBACK',
    ]);
    expect(querySql(client).some((sql) => /\bINSERT\b/i.test(sql))).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back creation when the returned session id cannot build the DTO', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [legacyRow()] },
      { rows: [] },
      { rows: [{ id: 'invalid-session-id' }] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'VERSION_SELECT',
      'ASSIGNMENT',
      'SESSION',
      'ROLLBACK',
    ]);
    expect(querySql(client)).not.toContain('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();
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
  ])('resumes %s without writes', async (_kind, makeActiveRow) => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [makeActiveRow()] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(200);
    expectPublicResponse(body);
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'COMMIT',
    ]);
    expectNoWrites(client);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([
    'AI_DRAFT',
    'TEACHER_DRAFT',
    'IN_REVIEW',
    'VALIDATED',
  ])('fails closed for active session with %s version', async (status) => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [activeLegacyRow({ version_status: status })] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'ROLLBACK',
    ]);
    expectNoWrites(client);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([
    [
      'missing joined version id',
      { version_id: null },
    ],
    [
      'missing joined version case id',
      { version_case_id: null },
    ],
    [
      'invalid session case id',
      { session_case_id: 'not-a-bigint' },
    ],
    [
      'mismatched session and version case ids',
      { session_case_id: '18' },
    ],
    [
      'mismatched session and resolved version ids',
      { session_case_version_id: otherCaseVersionId },
    ],
    [
      'invalid version content',
      {
        version_content: {
          spec: null,
          future_secret: 'protected resume marker',
        },
      },
    ],
  ])('fails closed for active session with %s', async (_reason, overrides) => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [activeLegacyRow(overrides)] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'ROLLBACK',
    ]);
    expectNoWrites(client);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('rolls back resume when the existing session id cannot build the DTO', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [activeLegacyRow({ session_id: 'invalid-session-id' })] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'ROLLBACK',
    ]);
    expectNoWrites(client);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('fails closed without writes for duplicate legacy active sessions', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      {
        rows: [
          activeLegacyRow(),
          activeLegacyRow({
            session_id: '62bb337a-9080-4d34-9988-712d175c84c7',
          }),
        ],
      },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expectGenericError(response, body);
    expect(querySql(client).map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'ROLLBACK',
    ]);
    expectNoWrites(client);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('uses only the approved version-aware SQL shape', async () => {
    const client = createClient([
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [] },
      { rows: [legacyRow()] },
      { rows: [] },
      { rows: [{ id: sessionId }] },
      { rows: [] },
    ]);
    mocks.connect.mockResolvedValue(client);

    await callEndpoint();

    const sqlQueries = querySql(client);
    const lockQuery = sqlQueries.find(
      (sql) => operationName(sql) === 'LOCK',
    );
    expect(lockQuery).toContain('pg_advisory_xact_lock');
    expect(lockQuery).toContain('hashtextextended');
    expect(lockQuery).toContain('chatusal:v2:student-session-start:');
    expect(lockQuery).toContain('$1::text');
    expect(client.query).toHaveBeenNthCalledWith(2, expect.any(String), [userId]);

    const activeLookup = sqlQueries.find(
      (sql) => operationName(sql) === 'ACTIVE_LOOKUP',
    );
    expect(activeLookup).toContain('FROM public.sessions AS s');
    expect(activeLookup).toContain('LEFT JOIN public.case_versions AS cv');
    expect(activeLookup).toContain('s.user_id = $1');
    expect(activeLookup).toContain("s.status = 'active'");
    expect(activeLookup).toContain('cv.id = s.case_version_id');
    expect(activeLookup).toContain('cv.case_id = s.case_id');
    expect(activeLookup).toContain('s.case_id::text AS session_case_id');
    expect(activeLookup).toContain(
      's.case_version_id AS session_case_version_id',
    );
    expect(activeLookup).toContain('cv.case_id::text AS version_case_id');
    expect(activeLookup).toContain(
      'ORDER BY s.started_at ASC, s.id ASC',
    );
    expect(activeLookup).not.toContain('s.created_at');
    expect(activeLookup).not.toMatch(/\bcv\.status\s*=/i);
    expect(activeLookup).not.toMatch(/\bLIMIT\s+1\b/i);
    expect(activeLookup).not.toMatch(/\bpublic\.cases\b/i);
    expect(activeLookup).not.toMatch(/SELECT\s+(?:\w+\.)?\*/i);
    expect(client.query).toHaveBeenNthCalledWith(3, expect.any(String), [userId]);

    const versionSelectQueries = sqlQueries.filter(
      (sql) => operationName(sql) === 'VERSION_SELECT',
    );
    expect(versionSelectQueries).toHaveLength(2);
    for (const sql of versionSelectQueries) {
      expect(sql).toContain('FROM public.case_versions AS cv');
      expect(sql).toContain("cv.status = 'PUBLISHED'");
      expect(sql).toContain('FOR SHARE OF cv');
      expect(sql).toContain('cv.case_id::text AS case_id');
      expect(sql).not.toMatch(/SELECT\s+(?:\w+\.)?\*/i);
      for (const forbidden of [
        'ground_truth',
        'c.spec',
        'cases.spec',
        'c.status',
        'cases.status',
      ]) {
        expect(sql).not.toContain(forbidden);
      }
    }

    expect(sqlQueries.map(operationName)).toEqual([
      'BEGIN',
      'LOCK',
      'ACTIVE_LOOKUP',
      'VERSION_SELECT',
      'VERSION_SELECT',
      'ASSIGNMENT',
      'SESSION',
      'COMMIT',
    ]);

    const sessionInsert = sqlQueries.find((sql) =>
      /INSERT INTO public\.sessions/i.test(sql),
    );
    expect(sessionInsert).toContain('case_version_id');
  });
});
