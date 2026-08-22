import type { LegacySessionEvaluatorClinicalContentV2 } from './session-clinical-content-types';

export type LegacyEvaluationAnswersV2 = Readonly<{
  tipo_no_adherencia: string;
  barrera: string;
  intervenciones: readonly string[];
}>;

export type LegacyEvaluationCandidateV2 = Readonly<{
  tipo_no_adherencia: string;
  barrera: string;
  intervenciones: readonly string[];
  isTipoOk: boolean;
  isBarreraOk: boolean;
  isIntervOk: boolean;
  score: number;
  feedback: string;
}>;

export type LegacyEvaluationPublicResultV2 = Readonly<{
  score: number;
  isTipoOk: boolean;
  isBarreraOk: boolean;
  isIntervOk: boolean;
  feedback: string;
}>;

export type LegacyEvaluationErrorCodeV2 =
  | 'invalid_answers'
  | 'invalid_legacy_evaluator'
  | 'invalid_persisted_evaluation';

export class LegacyEvaluationErrorV2 extends Error {
  constructor(
    public readonly code: LegacyEvaluationErrorCodeV2,
    public readonly path: string,
  ) {
    super(code);
    this.name = 'LegacyEvaluationErrorV2';
  }
}

type RecordValue = Record<string, unknown>;

function fail(code: LegacyEvaluationErrorCodeV2, path: string): never {
  throw new LegacyEvaluationErrorV2(code, path);
}

function record(
  value: unknown,
  code: LegacyEvaluationErrorCodeV2,
  path: string,
): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(code, path);
  }
  return value as RecordValue;
}

function nonEmptyString(
  value: unknown,
  code: LegacyEvaluationErrorCodeV2,
  path: string,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(code, path);
  }
  return value;
}

function stringArray(
  value: unknown,
  code: LegacyEvaluationErrorCodeV2,
  path: string,
  allowEmpty: boolean,
): readonly string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    fail(code, path);
  }
  return value.map((item, index) =>
    nonEmptyString(item, code, `${path}[${index}]`),
  );
}

function normalizeLegacyText(value: string): string {
  return value.trim().toLowerCase();
}

export function parseLegacyEvaluationAnswersV2(
  input: unknown,
): LegacyEvaluationAnswersV2 {
  const source = record(input, 'invalid_answers', 'answers');
  return {
    tipo_no_adherencia: nonEmptyString(
      source.tipo_no_adherencia,
      'invalid_answers',
      'answers.type',
    ),
    barrera: nonEmptyString(
      source.barrera,
      'invalid_answers',
      'answers.barrier',
    ),
    intervenciones: stringArray(
      source.intervenciones,
      'invalid_answers',
      'answers.items',
      true,
    ),
  };
}

function validateLegacyEvaluator(
  clinicalContent: LegacySessionEvaluatorClinicalContentV2,
): Readonly<{
  expectedType: string;
  expectedBarrier: string;
  validInterventions: readonly string[];
}> {
  const evaluator = record(
    clinicalContent?.evaluator,
    'invalid_legacy_evaluator',
    'evaluator',
  );
  return {
    expectedType: nonEmptyString(
      evaluator.tipo_no_adherencia,
      'invalid_legacy_evaluator',
      'evaluator.type',
    ),
    expectedBarrier: nonEmptyString(
      evaluator.barrera_principal,
      'invalid_legacy_evaluator',
      'evaluator.barrier',
    ),
    validInterventions: stringArray(
      evaluator.intervenciones_validas,
      'invalid_legacy_evaluator',
      'evaluator.validItems',
      false,
    ),
  };
}

export function scoreLegacyEvaluationV2(
  answers: LegacyEvaluationAnswersV2,
  clinicalContent: LegacySessionEvaluatorClinicalContentV2,
): LegacyEvaluationCandidateV2 {
  const parsedAnswers = parseLegacyEvaluationAnswersV2(answers);
  const evaluator = validateLegacyEvaluator(clinicalContent);

  const isTipoOk =
    normalizeLegacyText(parsedAnswers.tipo_no_adherencia) ===
    normalizeLegacyText(evaluator.expectedType);
  const isBarreraOk =
    normalizeLegacyText(parsedAnswers.barrera) ===
    normalizeLegacyText(evaluator.expectedBarrier);
  const validInterventions = new Set(
    evaluator.validInterventions.map(normalizeLegacyText),
  );
  const isIntervOk = parsedAnswers.intervenciones.some((item) =>
    validInterventions.has(normalizeLegacyText(item)),
  );
  const score =
    Number(isTipoOk) + Number(isBarreraOk) + Number(isIntervOk);

  const feedbackParts = [
    isTipoOk
      ? 'Has identificado correctamente el tipo de no adherencia.'
      : `El tipo de no adherencia correcto era: "${evaluator.expectedType}".`,
    isBarreraOk
      ? 'Has identificado correctamente la barrera principal.'
      : `La barrera principal correcta era: "${evaluator.expectedBarrier}".`,
    isIntervOk
      ? 'Has seleccionado al menos una intervención adecuada.'
      : `Las intervenciones recomendadas incluían: ${evaluator.validInterventions.join(', ')}.`,
  ];

  return {
    tipo_no_adherencia: parsedAnswers.tipo_no_adherencia,
    barrera: parsedAnswers.barrera,
    intervenciones: [...parsedAnswers.intervenciones],
    isTipoOk,
    isBarreraOk,
    isIntervOk,
    score,
    feedback: feedbackParts.join(' '),
  };
}

export function parsePersistedLegacyEvaluationResultV2(
  input: unknown,
): LegacyEvaluationPublicResultV2 {
  const source = record(
    input,
    'invalid_persisted_evaluation',
    'persisted',
  );
  const score = source.score;
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > 3) {
    fail('invalid_persisted_evaluation', 'persisted.score');
  }
  if (typeof source.is_tipo_ok !== 'boolean') {
    fail('invalid_persisted_evaluation', 'persisted.typeResult');
  }
  if (typeof source.is_barrera_ok !== 'boolean') {
    fail('invalid_persisted_evaluation', 'persisted.barrierResult');
  }
  if (typeof source.is_intervencion_ok !== 'boolean') {
    fail('invalid_persisted_evaluation', 'persisted.itemResult');
  }
  const feedback = nonEmptyString(
    source.feedback,
    'invalid_persisted_evaluation',
    'persisted.publicText',
  );
  const expectedScore =
    Number(source.is_tipo_ok) +
    Number(source.is_barrera_ok) +
    Number(source.is_intervencion_ok);
  if (score !== expectedScore) {
    fail('invalid_persisted_evaluation', 'persisted.consistency');
  }

  return {
    score: score as number,
    isTipoOk: source.is_tipo_ok,
    isBarreraOk: source.is_barrera_ok,
    isIntervOk: source.is_intervencion_ok,
    feedback,
  };
}
