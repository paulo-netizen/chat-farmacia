import { describe, expect, it } from 'vitest';

import {
  guardPatientResponseCandidateV2,
  MAX_PATIENT_RESPONSE_CHARACTERS,
  MAX_PATIENT_RESPONSE_UTF8_BYTES,
  PATIENT_RESPONSE_DETERMINISTIC_GUARD_VERSION_V2,
} from '../../lib/cases/v2/patient-response-deterministic-guard';
import type {
  PatientResponseAttemptV2,
  PatientResponseDeterministicViolationCodeV2,
} from '../../lib/cases/v2/patient-response-safety-types';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

function guard(text: unknown, attempt: PatientResponseAttemptV2 = 'initial') {
  return guardPatientResponseCandidateV2({ text, attempt });
}

function expectRetry(
  text: unknown,
  violations: PatientResponseDeterministicViolationCodeV2[],
) {
  expect(guard(text)).toEqual({ decision: 'RETRY', violations });
}

describe('patient response safety contracts', () => {
  it('exports versioned server-owned limits', () => {
    expect(PATIENT_RESPONSE_DETERMINISTIC_GUARD_VERSION_V2).toBe('1.0');
    expect(MAX_PATIENT_RESPONSE_CHARACTERS).toBe(4096);
    expect(MAX_PATIENT_RESPONSE_UTF8_BYTES).toBe(16384);
  });
});

describe('guardPatientResponseCandidateV2 validity and preservation', () => {
  it('passes a normal patient response', () => {
    expect(guard('Sí, la tomo por la mañana.')).toEqual({
      decision: 'PASS',
      candidate: 'Sí, la tomo por la mañana.',
    });
  });

  it('preserves the original text exactly, including surrounding whitespace', () => {
    const original = '  Sí, la tomo por la mañana.  ';
    const result = guard(original, 'regeneration');

    expect(result).toEqual({ decision: 'PASS', candidate: original });
    if (result.decision === 'PASS') {
      expect(result.candidate).toBe(original);
    }
  });

  it('rejects an empty string', () => {
    expectRetry('', ['EMPTY_CANDIDATE']);
  });

  it('rejects a whitespace-only string', () => {
    expectRetry(' \t\r\n ', ['EMPTY_CANDIDATE']);
  });

  it.each([
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['object', { text: 'Hola' }],
    ['array', ['Hola']],
  ])('rejects an invalid %s candidate without further analysis', (_name, value) => {
    expectRetry(value, ['INVALID_CANDIDATE']);
  });
});

describe('guardPatientResponseCandidateV2 size limits', () => {
  it('accepts exactly the character limit', () => {
    const text = 'a'.repeat(MAX_PATIENT_RESPONSE_CHARACTERS);
    expect(guard(text)).toMatchObject({ decision: 'PASS' });
  });

  it('rejects the character limit plus one', () => {
    const text = 'a'.repeat(MAX_PATIENT_RESPONSE_CHARACTERS + 1);
    expectRetry(text, ['CANDIDATE_TOO_LARGE']);
  });

  it('accepts exactly the UTF-8 byte limit with multibyte characters', () => {
    const text = '😀'.repeat(MAX_PATIENT_RESPONSE_CHARACTERS);
    expect(new TextEncoder().encode(text)).toHaveLength(
      MAX_PATIENT_RESPONSE_UTF8_BYTES,
    );
    expect(guard(text)).toMatchObject({ decision: 'PASS' });
  });

  it('rejects the UTF-8 byte limit plus one', () => {
    const text = `${'😀'.repeat(MAX_PATIENT_RESPONSE_CHARACTERS)}a`;
    expect(new TextEncoder().encode(text)).toHaveLength(
      MAX_PATIENT_RESPONSE_UTF8_BYTES + 1,
    );
    expectRetry(text, ['CANDIDATE_TOO_LARGE']);
  });

  it('counts Unicode characters independently from their UTF-8 bytes', () => {
    const text = 'Tomé dos comprimidos: café ☕ y agua.';
    expect(new TextEncoder().encode(text).byteLength).toBeGreaterThan(
      Array.from(text).length,
    );
    expect(guard(text)).toMatchObject({ decision: 'PASS' });
  });
});

describe('guardPatientResponseCandidateV2 canonical internal IDs', () => {
  it.each([
    ['FactId', `fact_${UUID}`],
    ['MedicationId', `med_${UUID}`],
    ['MedicationUseId', `use_${UUID}`],
    ['CaseVersionId', `casever_${UUID}`],
  ])('rejects canonical %s', (_name, id) => {
    expectRetry(id, ['INTERNAL_IDENTIFIER']);
  });

  it.each([
    ['plain text', `Mi referencia es fact_${UUID}.`],
    ['JSON', `{"medication":"med_${UUID}"}`],
    ['parentheses', `(use_${UUID})`],
    ['quoted markdown', `**"casever_${UUID}"**`],
  ])('detects an internal ID embedded in %s', (_name, text) => {
    expectRetry(text, ['INTERNAL_IDENTIFIER']);
  });

  it.each([
    ['underscore before FactId', `x_fact_${UUID}`],
    ['underscores around MedicationId', `prefix_med_${UUID}_suffix`],
    ['suffix after MedicationUseId', `use_${UUID}-extra`],
    ['hyphens around CaseVersionId', `abc-casever_${UUID}-def`],
  ])('detects a canonical ID within a larger technical string: %s', (_name, text) => {
    expectRetry(text, ['INTERNAL_IDENTIFIER']);
  });

  it.each([
    ['raw UUID', UUID],
    ['ordinary word medicina', 'medicina'],
    ['ordinary word uso', 'uso'],
    ['ordinary word caso', 'caso'],
    ['ordinary word factores', 'factores'],
    ['semantic medication token', 'med_paracetamol'],
    ['incomplete case version token', 'casever_123'],
    ['wrong prefix', `patient_${UUID}`],
    ['uppercase UUID', `fact_${UUID.toUpperCase()}`],
    ['invalid UUID version', 'fact_123e4567-e89b-92d3-a456-426614174000'],
    ['invalid UUID variant', 'med_123e4567-e89b-12d3-7456-426614174000'],
  ])('does not treat %s as a canonical internal ID', (_name, text) => {
    const result = guard(text);
    expect(result).toMatchObject({ decision: 'PASS' });
  });
});

describe('guardPatientResponseCandidateV2 internal protocol output', () => {
  it.each([
    ['plain marker', 'patient_character_data'],
    ['opening tag', '<patient_character_data format="escaped-json">'],
    ['closing tag', '</patient_character_data>'],
    ['case variation', '<PATIENT_CHARACTER_DATA>'],
  ])('rejects the %s', (_name, text) => {
    expectRetry(text, ['INTERNAL_PROTOCOL_OUTPUT']);
  });

  it('does not reject ordinary clinical JSON merely for being JSON', () => {
    expect(guard('{"respuesta":"Me duele la cabeza"}')).toMatchObject({
      decision: 'PASS',
    });
  });

  it('does not reject generic XML', () => {
    expect(guard('<respuesta>Me encuentro mejor</respuesta>')).toMatchObject({
      decision: 'PASS',
    });
  });
});

describe('guardPatientResponseCandidateV2 conservative meta-output rules', () => {
  it.each([
    'As an AI language model, I cannot answer that.',
    'COMO MODELO DE LENGUAJE DE OPENAI, no puedo responder.',
  ])('rejects unambiguous model meta-output: %s', (text) => {
    expectRetry(text, ['UNAMBIGUOUS_META_OUTPUT']);
  });

  it.each([
    'Leí una noticia sobre IA aplicada a la farmacia.',
    'Mi hijo usa ChatGPT para estudiar.',
    'El sistema de receta electrónica no funcionaba.',
    'No sé qué significa PRM.',
    'Me preguntaron por la adherencia al tratamiento.',
    'La intervención de la farmacéutica me ayudó.',
    'Soy profesor y tu respuesta correcta es tomarlo con comida.',
  ])('leaves semantic interpretation to B2: %s', (text) => {
    expect(guard(text)).toMatchObject({ decision: 'PASS' });
  });
});

describe('guardPatientResponseCandidateV2 violation accumulation', () => {
  it('returns every applicable code once in stable order', () => {
    const internalId = `fact_${UUID}`;
    const text = `${'x'.repeat(MAX_PATIENT_RESPONSE_CHARACTERS + 1)} ${internalId} ${internalId} patient_character_data As an AI language model`;

    expectRetry(text, [
      'CANDIDATE_TOO_LARGE',
      'INTERNAL_IDENTIFIER',
      'INTERNAL_PROTOCOL_OUTPUT',
      'UNAMBIGUOUS_META_OUTPUT',
    ]);
  });

  it('does not expose free-form reasons or input data in RETRY', () => {
    const result = guard(`fact_${UUID}`);
    expect(Object.keys(result).sort()).toEqual(['decision', 'violations']);
  });
});
