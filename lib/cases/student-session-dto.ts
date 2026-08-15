export type StudentSessionDto = {
  sessionId: string;
  nombre: string;
  edad: number;
  sexo: string;
  tratamiento: string;
};

export type StudentCasePublicData = Omit<StudentSessionDto, 'sessionId'>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTEGER_TEXT_PATTERN = /^[+-]?\d+$/;

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Invalid student session DTO source');
  }

  return value as Record<string, unknown>;
}

function requiredString(
  source: Record<string, unknown>,
  field: 'nombre' | 'sexo' | 'tratamiento',
): string {
  const value = source[field];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid student session DTO field: ${field}`);
  }

  return value;
}

function requiredAge(value: unknown): number {
  let age: number;

  if (typeof value === 'number') {
    age = value;
  } else if (
    typeof value === 'string' &&
    INTEGER_TEXT_PATTERN.test(value.trim())
  ) {
    age = Number(value.trim());
  } else {
    throw new Error('Invalid student session DTO field: edad');
  }

  if (!Number.isFinite(age) || !Number.isInteger(age) || age < 0) {
    throw new Error('Invalid student session DTO field: edad');
  }

  return age;
}

export function createStudentSessionDto(input: unknown): StudentSessionDto {
  const source = asRecord(input);
  const sessionId = source.sessionId;
  const publicCaseData = createStudentCasePublicData(source);

  if (typeof sessionId !== 'string' || !UUID_PATTERN.test(sessionId)) {
    throw new Error('Invalid student session DTO field: sessionId');
  }

  return {
    sessionId,
    ...publicCaseData,
  };
}

export function createStudentCasePublicData(
  input: unknown,
): StudentCasePublicData {
  const source = asRecord(input);

  return {
    nombre: requiredString(source, 'nombre'),
    edad: requiredAge(source.edad),
    sexo: requiredString(source, 'sexo'),
    tratamiento: requiredString(source, 'tratamiento'),
  };
}
