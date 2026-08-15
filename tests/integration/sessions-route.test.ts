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

const sessionId = '52bb337a-9080-4d34-9988-712d175c84c7';
const contaminatedCaseRow = {
  case_id: 17,
  nombre: 'Antonio',
  edad: '71',
  sexo: 'Hombre',
  tratamiento: 'Losartán 50 mg',
  ground_truth: { tipo_no_adherencia: 'intencionada' },
  spec: { motivo_consulta: 'dato oculto' },
  rubric: { correct: true },
  future_secret: 'secreto futuro',
};

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
  expect(body).toEqual({
    sessionId,
    nombre: 'Antonio',
    edad: 71,
    sexo: 'Hombre',
    tratamiento: 'Losartán 50 mg',
  });
  expect(Object.values(body).some((value) => typeof value === 'object')).toBe(
    false,
  );

  const serialized = JSON.stringify(body);
  for (const forbidden of [
    'case',
    'case_id',
    'spec',
    'ground_truth',
    'future_secret',
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
}

describe('POST /api/sessions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getUserFromRequest.mockResolvedValue({ id: 9, role: 'student' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('devuelve exclusivamente el DTO público cuando encuentra un caso nuevo', async () => {
    const assignmentClient = createClient([
      { rows: [contaminatedCaseRow] },
      { rows: [] },
    ]);
    const sessionClient = createClient([
      {
        rows: [
          {
            id: sessionId,
            case_id: 17,
            ground_truth: 'no debe serializarse',
            future_secret: { hidden: true },
          },
        ],
      },
    ]);
    mocks.connect
      .mockResolvedValueOnce(assignmentClient)
      .mockResolvedValueOnce(sessionClient);

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(200);
    expectPublicResponse(body);
    expect(assignmentClient.query).toHaveBeenLastCalledWith(
      expect.stringContaining('INSERT INTO case_assignments'),
      [9, 17],
    );
    expect(sessionClient.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sessions'),
      [9, 17],
    );

    const selectSql = assignmentClient.query.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => /\bSELECT\b/i.test(sql))
      .join('\n');
    expect(selectSql).not.toMatch(/SELECT\s+(?:c\.)?\*/i);
    expect(selectSql).not.toContain('ground_truth');
  });

  it('mantiene el mismo contrato en la rama fallback', async () => {
    const assignmentClient = createClient([
      { rows: [] },
      { rows: [contaminatedCaseRow] },
      { rows: [] },
    ]);
    const sessionClient = createClient([{ rows: [{ id: sessionId }] }]);
    mocks.connect
      .mockResolvedValueOnce(assignmentClient)
      .mockResolvedValueOnce(sessionClient);

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(200);
    expectPublicResponse(body);
    expect(assignmentClient.query).toHaveBeenCalledTimes(3);

    const fallbackSql = String(assignmentClient.query.mock.calls[1][0]);
    expect(fallbackSql).not.toMatch(/SELECT\s+(?:c\.)?\*/i);
    expect(fallbackSql).not.toContain('ground_truth');
  });

  it.each([
    ['nombre', undefined],
    ['edad', '71.5'],
    ['sexo', { hidden: 'dato protegido' }],
    ['tratamiento', null],
  ])(
    'rechaza %s inválido antes de crear una asignación o sesión',
    async (field, invalidValue) => {
      const invalidCaseRow = {
        ...contaminatedCaseRow,
        [field]: invalidValue,
      };
      const assignmentClient = createClient([{ rows: [invalidCaseRow] }]);
      const sessionClient = createClient([{ rows: [{ id: sessionId }] }]);
      mocks.connect
        .mockResolvedValueOnce(assignmentClient)
        .mockResolvedValueOnce(sessionClient);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const { response, body } = await callEndpoint();

      expect(response.status).toBe(500);
      expect(body).toEqual({ error: 'Error creando sesión' });
      expect(JSON.stringify(body)).not.toContain('ground_truth');
      expect(JSON.stringify(body)).not.toContain('future_secret');
      expect(assignmentClient.query).toHaveBeenCalledOnce();
      expect(String(assignmentClient.query.mock.calls[0][0])).toMatch(
        /\bSELECT\b/i,
      );
      expect(
        assignmentClient.query.mock.calls.some(([sql]) =>
          String(sql).includes('INSERT INTO case_assignments'),
        ),
      ).toBe(false);
      expect(sessionClient.query).not.toHaveBeenCalled();
      expect(mocks.connect).toHaveBeenCalledOnce();
      expect(assignmentClient.release).toHaveBeenCalledOnce();
    },
  );

  it('responde con un error genérico sin serializar filas ni secretos', async () => {
    const databaseMessage =
      'fallo con ground_truth, future_secret y datos de una fila';
    const assignmentClient = createClient([new Error(databaseMessage)]);
    mocks.connect.mockResolvedValueOnce(assignmentClient);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { response, body } = await callEndpoint();

    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Error creando sesión' });
    expect(JSON.stringify(body)).not.toContain(databaseMessage);
    expect(JSON.stringify(body)).not.toContain('ground_truth');
    expect(consoleError).toHaveBeenCalledOnce();
    expect(assignmentClient.release).toHaveBeenCalledOnce();
  });
});
