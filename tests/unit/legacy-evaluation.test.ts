import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  LegacyEvaluationErrorV2,
  parseLegacyEvaluationAnswersV2,
  parsePersistedLegacyEvaluationResultV2,
  scoreLegacyEvaluationV2,
} from '../../lib/cases/v2/legacy-evaluation';
import type {
  LegacyEvaluationAnswersV2,
  LegacyEvaluationErrorCodeV2,
} from '../../lib/cases/v2/legacy-evaluation';
import type { LegacySessionEvaluatorClinicalContentV2 } from '../../lib/cases/v2/session-clinical-content-types';

function clinicalContent(
  evaluator: Record<string, unknown> = {},
): LegacySessionEvaluatorClinicalContentV2 {
  return {
    contentFormat: 'LEGACY_V1_SNAPSHOT',
    evaluator: {
      tipo_no_adherencia: 'No intencionada',
      barrera_principal: 'Olvido',
      intervenciones_validas: ['Educación', 'Pastillero'],
      ...evaluator,
    },
  } as LegacySessionEvaluatorClinicalContentV2;
}

function answers(
  overrides: Partial<LegacyEvaluationAnswersV2> = {},
): LegacyEvaluationAnswersV2 {
  return {
    tipo_no_adherencia: 'No intencionada',
    barrera: 'Olvido',
    intervenciones: ['Educación'],
    ...overrides,
  };
}

function expectCode(
  action: () => unknown,
  code: LegacyEvaluationErrorCodeV2,
): LegacyEvaluationErrorV2 {
  let caught: unknown;
  try {
    action();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(LegacyEvaluationErrorV2);
  expect(caught).toMatchObject({ code });
  return caught as LegacyEvaluationErrorV2;
}

describe('parseLegacyEvaluationAnswersV2', () => {
  it('projects exactly the three public answer fields', () => {
    const result = parseLegacyEvaluationAnswersV2({
      tipo_no_adherencia: 'No intencionada',
      barrera: 'Olvido',
      intervenciones: ['Educación'],
      future_secret: 'reserved',
      ground_truth: { hidden: true },
    });

    expect(result).toEqual({
      tipo_no_adherencia: 'No intencionada',
      barrera: 'Olvido',
      intervenciones: ['Educación'],
    });
    expect(Object.keys(result).sort()).toEqual(
      ['barrera', 'intervenciones', 'tipo_no_adherencia'].sort(),
    );
  });

  it('preserves original whitespace while validating trimmed content', () => {
    const result = parseLegacyEvaluationAnswersV2({
      tipo_no_adherencia: '  No intencionada  ',
      barrera: '  Olvido  ',
      intervenciones: ['  Educación  '],
    });
    expect(result.tipo_no_adherencia).toBe('  No intencionada  ');
    expect(result.barrera).toBe('  Olvido  ');
    expect(result.intervenciones).toEqual(['  Educación  ']);
  });

  it('copies the interventions array', () => {
    const source = ['Educación'];
    const result = parseLegacyEvaluationAnswersV2({
      tipo_no_adherencia: 'No intencionada', barrera: 'Olvido', intervenciones: source,
    });
    expect(result.intervenciones).not.toBe(source);
    source.push('Pastillero');
    expect(result.intervenciones).toEqual(['Educación']);
  });

  it('accepts an empty intervention list', () => {
    expect(parseLegacyEvaluationAnswersV2({
      tipo_no_adherencia: 'No intencionada', barrera: 'Olvido', intervenciones: [],
    }).intervenciones).toEqual([]);
  });

  it.each([
    [null, 'non-object input'],
    [[], 'array input'],
    [{ tipo_no_adherencia: ' ', barrera: 'Olvido', intervenciones: [] }, 'empty type'],
    [{ tipo_no_adherencia: 'Tipo', barrera: ' ', intervenciones: [] }, 'empty barrier'],
    [{ tipo_no_adherencia: 'Tipo', barrera: 'Barrera', intervenciones: 'x' }, 'non-array interventions'],
    [{ tipo_no_adherencia: 'Tipo', barrera: 'Barrera', intervenciones: [2] }, 'non-string intervention'],
    [{ tipo_no_adherencia: 'Tipo', barrera: 'Barrera', intervenciones: [' '] }, 'empty intervention'],
  ])('rejects invalid answers: %s (%s)', (input, _description) => {
    expectCode(() => parseLegacyEvaluationAnswersV2(input), 'invalid_answers');
  });

  it('does not place submitted or clinical values in errors', () => {
    const secret = 'SENSITIVE_STUDENT_VALUE';
    const error = expectCode(
      () => parseLegacyEvaluationAnswersV2({
        tipo_no_adherencia: secret, barrera: '', intervenciones: [],
      }),
      'invalid_answers',
    );
    expect(error.message).not.toContain(secret);
    expect(JSON.stringify(error)).not.toContain(secret);
  });
});

describe('scoreLegacyEvaluationV2', () => {
  it('scores an exact 3/3 and preserves the exact public V1 feedback', () => {
    const result = scoreLegacyEvaluationV2(answers(), clinicalContent());
    expect(result).toEqual({
      tipo_no_adherencia: 'No intencionada',
      barrera: 'Olvido',
      intervenciones: ['Educación'],
      isTipoOk: true,
      isBarreraOk: true,
      isIntervOk: true,
      score: 3,
      feedback:
        'Has identificado correctamente el tipo de no adherencia. ' +
        'Has identificado correctamente la barrera principal. ' +
        'Has seleccionado al menos una intervención adecuada.',
    });
  });

  it('scores 0/3 and preserves the exact public V1 corrective feedback', () => {
    const result = scoreLegacyEvaluationV2(
      answers({ tipo_no_adherencia: 'Otra', barrera: 'Otra', intervenciones: ['Otra'] }),
      clinicalContent(),
    );
    expect(result).toMatchObject({
      isTipoOk: false, isBarreraOk: false, isIntervOk: false, score: 0,
    });
    expect(result.feedback).toBe(
      'El tipo de no adherencia correcto era: "No intencionada". ' +
      'La barrera principal correcta era: "Olvido". ' +
      'Las intervenciones recomendadas incluían: Educación, Pastillero.',
    );
  });

  it.each([
    [answers({ barrera: 'Otra', intervenciones: [] }), 1],
    [answers({ intervenciones: [] }), 2],
    [answers({ tipo_no_adherencia: 'Otra', barrera: 'Otra' }), 1],
  ])('scores partial combinations deterministically', (input, expectedScore) => {
    expect(scoreLegacyEvaluationV2(input, clinicalContent()).score).toBe(expectedScore);
  });

  it('uses trim and lowercase only for comparison', () => {
    const result = scoreLegacyEvaluationV2(
      answers({
        tipo_no_adherencia: '  NO INTENCIONADA ',
        barrera: ' OLVIDO ',
        intervenciones: ['  EDUCACIÓN  '],
      }),
      clinicalContent(),
    );
    expect(result).toMatchObject({
      isTipoOk: true, isBarreraOk: true, isIntervOk: true, score: 3,
    });
  });

  it('does not apply fuzzy, synonym, accent, or punctuation normalization', () => {
    const result = scoreLegacyEvaluationV2(
      answers({
        tipo_no_adherencia: 'No-intencionada',
        barrera: 'Descuido',
        intervenciones: ['Educacion'],
      }),
      clinicalContent(),
    );
    expect(result).toMatchObject({
      isTipoOk: false, isBarreraOk: false, isIntervOk: false, score: 0,
    });
  });

  it('accepts one exact valid intervention among several answers', () => {
    const result = scoreLegacyEvaluationV2(
      answers({ intervenciones: ['No coincide', '  PASTILLERO '] }),
      clinicalContent(),
    );
    expect(result.isIntervOk).toBe(true);
    expect(result.score).toBe(3);
  });

  it('does not grant extra points for duplicate interventions', () => {
    const result = scoreLegacyEvaluationV2(
      answers({
        tipo_no_adherencia: 'Otra', barrera: 'Otra',
        intervenciones: ['Educación', 'Educación', 'Educación'],
      }),
      clinicalContent(),
    );
    expect(result).toMatchObject({ isIntervOk: true, score: 1 });
  });

  it('marks an empty intervention list incorrect', () => {
    const result = scoreLegacyEvaluationV2(
      answers({ intervenciones: [] }),
      clinicalContent(),
    );
    expect(result.isIntervOk).toBe(false);
  });

  it('preserves original answers and owns a fresh candidate array', () => {
    const submitted = ['  EDUCACIÓN  '];
    const input = answers({
      tipo_no_adherencia: '  NO INTENCIONADA  ',
      barrera: '  OLVIDO  ',
      intervenciones: submitted,
    });
    const result = scoreLegacyEvaluationV2(input, clinicalContent());
    expect(result.tipo_no_adherencia).toBe('  NO INTENCIONADA  ');
    expect(result.barrera).toBe('  OLVIDO  ');
    expect(result.intervenciones).toEqual(['  EDUCACIÓN  ']);
    expect(result.intervenciones).not.toBe(submitted);
  });

  it.each([
    [clinicalContent({ tipo_no_adherencia: undefined }), 'missing type'],
    [clinicalContent({ barrera_principal: ' ' }), 'missing barrier'],
    [clinicalContent({ intervenciones_validas: undefined }), 'missing valid items'],
    [clinicalContent({ intervenciones_validas: [] }), 'empty valid items'],
    [clinicalContent({ intervenciones_validas: [' '] }), 'invalid valid item'],
  ])('rejects an incomplete legacy evaluator: %s (%s)', (content) => {
    expectCode(
      () => scoreLegacyEvaluationV2(answers(), content),
      'invalid_legacy_evaluator',
    );
  });

  it('does not use recommended interventions as a scoring fallback', () => {
    const content = clinicalContent({
      intervenciones_validas: undefined,
      intervenciones_recomendadas: ['Educación'],
    });
    expectCode(
      () => scoreLegacyEvaluationV2(answers(), content),
      'invalid_legacy_evaluator',
    );
  });

  it('does not propagate unused evaluator fields into the candidate', () => {
    const result = scoreLegacyEvaluationV2(
      answers(),
      clinicalContent({
        diagnostico_principal: 'Reserved diagnosis',
        problema_farmacoterapeutico: 'Reserved PRM',
        otras_barreras: ['Reserved barrier'],
        objetivos_aprendizaje: ['Reserved objective'],
        future_secret: { nested: true },
      }),
    );
    expect(Object.keys(result).sort()).toEqual([
      'barrera', 'feedback', 'intervenciones', 'isBarreraOk', 'isIntervOk',
      'isTipoOk', 'score', 'tipo_no_adherencia',
    ].sort());
    expect(JSON.stringify(result)).not.toMatch(
      /Reserved diagnosis|Reserved PRM|Reserved barrier|Reserved objective|future_secret/,
    );
  });
});

describe('parsePersistedLegacyEvaluationResultV2', () => {
  it.each([
    [{ score: 0, is_tipo_ok: false, is_barrera_ok: false, is_intervencion_ok: false, feedback: 'Resultado cero' },
      { score: 0, isTipoOk: false, isBarreraOk: false, isIntervOk: false, feedback: 'Resultado cero' }],
    [{ score: 3, is_tipo_ok: true, is_barrera_ok: true, is_intervencion_ok: true, feedback: 'Resultado completo' },
      { score: 3, isTipoOk: true, isBarreraOk: true, isIntervOk: true, feedback: 'Resultado completo' }],
  ])('parses a consistent persisted result', (input, expected) => {
    expect(parsePersistedLegacyEvaluationResultV2(input)).toEqual(expected);
  });

  it.each([
    [{ score: 1.5, is_tipo_ok: true, is_barrera_ok: false, is_intervencion_ok: false, feedback: 'x' }, 'non-integer score'],
    [{ score: -1, is_tipo_ok: false, is_barrera_ok: false, is_intervencion_ok: false, feedback: 'x' }, 'negative score'],
    [{ score: 4, is_tipo_ok: true, is_barrera_ok: true, is_intervencion_ok: true, feedback: 'x' }, 'score above three'],
    [{ score: 1, is_tipo_ok: 'true', is_barrera_ok: false, is_intervencion_ok: false, feedback: 'x' }, 'invalid boolean'],
    [{ score: 0, is_tipo_ok: false, is_barrera_ok: false, is_intervencion_ok: false, feedback: ' ' }, 'empty feedback'],
    [{ score: 2, is_tipo_ok: true, is_barrera_ok: false, is_intervencion_ok: false, feedback: 'x' }, 'inconsistent score'],
  ])('rejects invalid persisted state: %s (%s)', (input, _description) => {
    expectCode(
      () => parsePersistedLegacyEvaluationResultV2(input),
      'invalid_persisted_evaluation',
    );
  });

  it('returns exactly the public allowlist despite protected and future columns', () => {
    const result = parsePersistedLegacyEvaluationResultV2({
      id: 99,
      session_id: 'session-secret',
      tipo_no_adherencia: 'student answer',
      barrera: 'student barrier',
      intervenciones: ['student intervention'],
      case_id: 7,
      case_version_id: 'version-secret',
      evaluator: { hidden: true },
      ground_truth: { hidden: true },
      future_secret: { nested: true },
      score: 2,
      is_tipo_ok: true,
      is_barrera_ok: true,
      is_intervencion_ok: false,
      feedback: 'Public feedback',
    });

    expect(result).toEqual({
      score: 2,
      isTipoOk: true,
      isBarreraOk: true,
      isIntervOk: false,
      feedback: 'Public feedback',
    });
    expect(Object.keys(result).sort()).toEqual(
      ['feedback', 'isBarreraOk', 'isIntervOk', 'isTipoOk', 'score'].sort(),
    );
    expect(JSON.stringify(result)).not.toMatch(
      /session-secret|student answer|student barrier|student intervention|version-secret|hidden|future_secret/,
    );
  });
});

describe('legacy evaluation architecture', () => {
  it('has no DB, HTTP, OpenAI, environment, route, or network dependency', () => {
    const source = readFileSync(
      new URL('../../lib/cases/v2/legacy-evaluation.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(/@\/lib\/db|from\s+['"]pg['"]|next\/server/);
    expect(source).not.toMatch(/\bOpenAI\b|process\.env|fetch\s*\(|app\/api/);
    expect(source).not.toContain('cases.ground_truth');
    expect(source).not.toContain('intervenciones_recomendadas');
  });
});
