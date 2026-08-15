import { describe, expect, it } from 'vitest';
import { createStudentSessionDto } from '@/lib/cases/student-session-dto';

const validSource = {
  sessionId: '2f24b43e-a1c2-4d5e-8f60-123456789abc',
  nombre: 'María',
  edad: '67',
  sexo: 'Mujer',
  tratamiento: 'Metformina 850 mg',
};

describe('createStudentSessionDto', () => {
  it('construye un objeto nuevo con exactamente las cinco claves permitidas', () => {
    const source = {
      ...validSource,
      ground_truth: { tipo_no_adherencia: 'no intencionada' },
      spec: { motivo_consulta: 'oculto' },
      rubric: { answer: 'oculta' },
      future_secret: 'no debe salir',
      case_id: 42,
      nested: { secret: true },
    };

    const result = createStudentSessionDto(source);

    expect(Object.keys(result).sort()).toEqual(
      ['edad', 'nombre', 'sessionId', 'sexo', 'tratamiento'].sort(),
    );
    expect(result).toEqual({
      sessionId: validSource.sessionId,
      nombre: 'María',
      edad: 67,
      sexo: 'Mujer',
      tratamiento: 'Metformina 850 mg',
    });
    expect(result).not.toBe(source);
    expect(Object.values(result).some((value) => typeof value === 'object')).toBe(
      false,
    );
    expect(JSON.stringify(result)).not.toContain('ground_truth');
    expect(JSON.stringify(result)).not.toContain('future_secret');
  });

  it.each([
    ['number', 67],
    ['integer string', '67'],
    ['trimmed integer string', ' 67 '],
  ])('convierte una edad válida desde %s', (_description, edad) => {
    expect(createStudentSessionDto({ ...validSource, edad }).edad).toBe(67);
  });

  it.each([
    ['ausente', undefined],
    ['decimal numérico', 67.5],
    ['decimal de texto', '67.5'],
    ['no numérica', 'sesenta y siete'],
    ['infinita', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
    ['negativa', -1],
    ['objeto', { value: 67 }],
  ])('rechaza una edad %s', (_description, edad) => {
    expect(() => createStudentSessionDto({ ...validSource, edad })).toThrow();
  });

  it.each([
    ['sessionId', undefined],
    ['sessionId', 'no-es-un-uuid'],
    ['nombre', undefined],
    ['nombre', 123],
    ['nombre', '   '],
    ['sexo', undefined],
    ['sexo', { value: 'Mujer' }],
    ['tratamiento', undefined],
    ['tratamiento', ['Metformina']],
  ])('rechaza el campo público inválido %s=%p', (field, value) => {
    expect(() =>
      createStudentSessionDto({ ...validSource, [field]: value }),
    ).toThrow();
  });

  it.each([null, undefined, [], 'texto', 42])(
    'rechaza una fuente raíz que no sea un objeto: %p',
    (source) => {
      expect(() => createStudentSessionDto(source)).toThrow();
    },
  );
});
