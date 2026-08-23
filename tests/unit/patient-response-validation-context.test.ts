import { describe, expect, it } from 'vitest';

import { guardPatientResponseCandidateV2 } from '@/lib/cases/v2/patient-response-deterministic-guard';
import {
  buildPatientResponseValidationContextV2,
  buildPatientResponseValidationRequestV2,
  PatientResponseValidationContextErrorV2,
} from '@/lib/cases/v2/patient-response-validation-context';
import type {
  GeneratedSessionPatientClinicalContentV2,
  LegacySessionPatientClinicalContentV2,
} from '@/lib/cases/v2/session-clinical-content-types';
import type {
  CaseVersionId,
  FactId,
  MedicationId,
  MedicationUseId,
  PatientCommunicationProfile,
  PatientRuntimeViewV2,
  RuntimePatientDatum,
} from '@/lib/cases/v2/types';

const factId = (ordinal: number) =>
  `fact_00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}` as FactId;
const medicationId =
  'med_00000000-0000-4000-8000-000000000101' as MedicationId;
const useId = 'use_00000000-0000-4000-8000-000000000201' as MedicationUseId;
const caseVersionId =
  'casever_00000000-0000-4000-8000-000000000301' as CaseVersionId;

const spontaneous = { mode: 'spontaneous' } as const;

function known<T>(
  ordinal: number,
  value: T,
  overrides: Partial<Extract<RuntimePatientDatum<T>, { state: 'known' }>> = {},
): RuntimePatientDatum<T> {
  return {
    state: 'known',
    factId: factId(ordinal),
    value,
    certainty: 'exact',
    disclosure: spontaneous,
    ...overrides,
  } as RuntimePatientDatum<T>;
}

function explicitAbsence(ordinal: number, topic: string): RuntimePatientDatum<string> {
  return {
    state: 'explicit_absence',
    factId: factId(ordinal),
    topic,
    disclosure: { mode: 'specific_question', domains: ['allergies_intolerances'] },
  };
}

function patientUnknown(ordinal: number, topic: string): RuntimePatientDatum<string> {
  return {
    state: 'patient_unknown',
    factId: factId(ordinal),
    topic,
    disclosure: {
      mode: 'rapport_required',
      domains: ['beliefs_and_concerns'],
      minimumRapport: 3,
      delayedBy: ['judgmental_tone'],
    },
  };
}

function communicationProfile(): PatientCommunicationProfile {
  return {
    sociability: 3,
    cooperation: 4,
    organization: 2,
    emotionalReactivity: 3,
    opennessToChange: 4,
    healthLiteracy: 'medium' as const,
    professionalTrust: 4,
    medicationAttitude: 'cautious' as const,
    decisionStyle: 'shared' as const,
    readinessToChange: 3,
    socialDesirability: 2,
    judgmentSensitivity: 4,
    disclosureThreshold: 3,
    answerLength: 'brief' as const,
    assertiveness: 2,
    emotionalExpression: 3,
  };
}

function patientRuntime(): PatientRuntimeViewV2 {
  const concern = patientUnknown(8, 'por qué debe tomar el medicamento');
  return {
    schemaVersion: '2.0',
    caseVersionId,
    publicProfile: {
      nombre: 'María',
      edad: 68,
      sexo: 'mujer',
      tratamiento: 'Enalapril 20 mg',
    },
    initialDemand: known(1, 'Vengo a por mi medicación'),
    encounter: { personPresent: known(2, 'patient') },
    clinicalContext: {
      healthProblems: [
        known(3, 'Hipertensión', {
          certainty: 'approximate',
          disclosure: {
            mode: 'domain_exploration',
            domains: ['health_problems'],
            delayedBy: ['accusatory_question'],
          },
        }),
      ],
      clinicalHistory: [],
      physiologicalSituation: [],
      allergiesAndIntolerances: [explicitAbsence(4, 'alergias conocidas')],
      lifestyle: [],
      biomedicalData: [
        known(5, {
          type: 'presión arterial',
          value: 148,
          unit: 'mmHg',
          timingOrContext: 'esta mañana',
        }),
      ],
    },
    symptoms: [
      {
        description: known(6, 'mareo ocasional'),
        relevantCircumstances: [],
      },
    ],
    pharmacotherapy: {
      prescribedMedications: [
        {
          medicationId,
          displayName: known(9, 'Enalapril 20 mg'),
          origin: known(10, 'prescribed'),
          purposeAsUnderstood: patientUnknown(11, 'para qué sirve el enalapril'),
          specialUseConditions: [],
        },
      ],
      otherMedicinesAndProducts: [],
      actualMedicationUse: [
        {
          useId,
          medicationRef: medicationId,
          action: 'takes',
          actualUse: known(12, 'Toma un comprimido cuando se acuerda'),
          circumstanceFactRefs: [],
          statedReasonFactRefs: [concern.factId],
          perceivedEffectFactRefs: [],
          practicalDifficultyFactRefs: [],
          strategyTriedFactRefs: [],
        },
      ],
      recentChanges: [],
      perceivedEffectiveness: [],
      perceivedSafety: [],
    },
    actionsAlreadyTaken: [],
    practicalDifficulties: [explicitAbsence(13, 'dificultades para abrir el envase')],
    beliefsAndConcerns: [concern],
    strategiesAlreadyTried: [],
    dailyAndSocialContext: [],
    familyAndSocialSupport: [],
    relationshipWithProfessionals: [],
    communicationProfile: communicationProfile(),
  };
}

function generatedContent(): GeneratedSessionPatientClinicalContentV2 {
  return {
    contentFormat: 'GENERATED_CASE_BUNDLE_V2',
    patientRuntime: patientRuntime(),
    serviceContext: {
      initialSpfa: { service: 'dispensing', subtype: 'continuation' },
      additionalSpfas: [{ service: 'medication_adherence' }],
    },
  };
}

function legacyContent(): LegacySessionPatientClinicalContentV2 {
  return {
    contentFormat: 'LEGACY_V1_SNAPSHOT',
    patientData: {
      nombre: 'Luis',
      edad: 54,
      sexo: 'hombre',
      tratamiento: 'Metformina 850 mg',
      motivo_consulta: 'Vengo a por mi medicación',
      antecedentes: 'Diabetes tipo 2',
      contexto: 'Vive solo',
      descripcion_paciente: 'Habla de forma breve',
      personalidad_paciente: 'Reservado',
    },
    serviceContext: { serviceType: 'SAT' },
  };
}

function allKeys(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((item) => allKeys(item, result));
  } else if (typeof value === 'object' && value !== null) {
    Object.entries(value).forEach(([key, child]) => {
      result.add(key);
      allKeys(child, result);
    });
  }
  return result;
}

function validatedCandidate(text = 'Sí, la tomo por la mañana.') {
  const result = guardPatientResponseCandidateV2({ text, attempt: 'initial' });
  if (result.decision !== 'PASS') throw new Error('fixture must pass B1');
  return result.candidate;
}

describe('buildPatientResponseValidationContextV2 Legacy', () => {
  it('projects exactly the Legacy patient allowlist and literal service type', () => {
    const context = buildPatientResponseValidationContextV2(legacyContent());

    expect(context).toEqual(legacyContent());
    expect(Object.keys(context).sort()).toEqual(
      ['contentFormat', 'patientData', 'serviceContext'].sort(),
    );
    expect(Object.keys(context.patientData).sort()).toEqual(
      [
        'nombre',
        'edad',
        'sexo',
        'tratamiento',
        'motivo_consulta',
        'antecedentes',
        'contexto',
        'descripcion_paciente',
        'personalidad_paciente',
      ].sort(),
    );
  });

  it('never propagates Legacy evaluator labels or recursively contaminated properties', () => {
    const source = legacyContent() as any;
    source.evaluator = { tipo_no_adherencia: 'SECRET_LABEL' };
    source.ground_truth = { prm: 'SECRET_PRM' };
    source.patientData.diagnostico_principal = 'SECRET_DIAGNOSIS';
    source.patientData.future_secret = { rubric: 'SECRET_RUBRIC' };
    source.serviceContext.answer_keys = ['SECRET_ANSWER'];

    const context = buildPatientResponseValidationContextV2(source);
    const serialized = JSON.stringify(context);
    expect(serialized).not.toMatch(
      /SECRET_|evaluator|ground_truth|diagnostico_principal|tipo_no_adherencia|rubric|answer_keys/,
    );
  });
});

describe('buildPatientResponseValidationContextV2 Generated', () => {
  it('preserves patient facts, states, certainty, disclosure and service context', () => {
    const context = buildPatientResponseValidationContextV2(generatedContent());
    if (context.contentFormat !== 'GENERATED_CASE_BUNDLE_V2') {
      throw new Error('expected generated context');
    }

    expect(context.patientData.initialDemand).toMatchObject({
      state: 'known',
      value: 'Vengo a por mi medicación',
      certainty: 'exact',
      disclosure: { mode: 'spontaneous' },
    });
    expect(context.patientData.clinicalContext.healthProblems[0]).toEqual({
      state: 'known',
      value: 'Hipertensión',
      certainty: 'approximate',
      disclosure: {
        mode: 'domain_exploration',
        domains: ['health_problems'],
        delayedBy: ['accusatory_question'],
      },
    });
    expect(context.patientData.clinicalContext.allergiesAndIntolerances[0]).toEqual({
      state: 'explicit_absence',
      topic: 'alergias conocidas',
      disclosure: {
        mode: 'specific_question',
        domains: ['allergies_intolerances'],
      },
    });
    expect(context.patientData.beliefsAndConcerns[0]).toEqual({
      state: 'patient_unknown',
      topic: 'por qué debe tomar el medicamento',
      disclosure: {
        mode: 'rapport_required',
        domains: ['beliefs_and_concerns'],
        minimumRapport: 3,
        delayedBy: ['judgmental_tone'],
      },
    });
    expect(context.serviceContext).toEqual({
      initialSpfa: { service: 'dispensing', subtype: 'continuation' },
      additionalSpfas: [{ service: 'medication_adherence' }],
    });
  });

  it('resolves medication and fact references to semantic allowlisted content', () => {
    const context = buildPatientResponseValidationContextV2(generatedContent());
    if (context.contentFormat !== 'GENERATED_CASE_BUNDLE_V2') {
      throw new Error('expected generated context');
    }
    const use = context.patientData.pharmacotherapy.actualMedicationUse[0];
    expect(use.medication.displayName).toMatchObject({
      state: 'known',
      value: 'Enalapril 20 mg',
    });
    expect(use.statedReasons).toEqual([
      {
        state: 'patient_unknown',
        topic: 'por qué debe tomar el medicamento',
        disclosure: {
          mode: 'rapport_required',
          domains: ['beliefs_and_concerns'],
          minimumRapport: 3,
          delayedBy: ['judgmental_tone'],
        },
      },
    ]);
    expect(use).not.toHaveProperty('medicationRef');
    expect(use).not.toHaveProperty('statedReasonFactRefs');
  });

  it('removes every technical ID and protected view from the complete projection', () => {
    const context = buildPatientResponseValidationContextV2(generatedContent());
    const serialized = JSON.stringify(context);
    const keys = allKeys(context);

    expect(serialized).not.toContain(caseVersionId);
    expect(serialized).not.toContain(medicationId);
    expect(serialized).not.toContain(useId);
    for (let ordinal = 1; ordinal <= 13; ordinal += 1) {
      expect(serialized).not.toContain(factId(ordinal));
    }
    expect(keys).not.toContain('caseVersionId');
    expect(keys).not.toContain('factId');
    expect(keys).not.toContain('medicationId');
    expect(keys).not.toContain('useId');
    expect(keys).not.toContain('evaluator');
    expect(keys).not.toContain('groundTruth');
    expect(keys).not.toContain('ground_truth');
  });

  it('does not propagate recursive future secrets, evaluator data or derived bundle views', () => {
    const source = generatedContent() as any;
    source.patientRuntime.future_secret = 'SECRET_TOP';
    source.patientRuntime.initialDemand.ground_truth = 'SECRET_DATUM';
    source.patientRuntime.pharmacotherapy.prescribedMedications[0].rubric = 'SECRET_MED';
    source.patientRuntime.pharmacotherapy.actualMedicationUse[0].evaluator = {
      prm: 'SECRET_PRM',
      rnm: 'SECRET_RNM',
      intervention: 'SECRET_INTERVENTION',
    };
    source.serviceContext.provenance = 'SECRET_PROVENANCE';
    source.serviceContext.summary = 'SECRET_SUMMARY';
    source.serviceContext.compliance = 'SECRET_COMPLIANCE';

    const context = buildPatientResponseValidationContextV2(source);
    const serialized = JSON.stringify(context);
    expect(serialized).not.toMatch(
      /SECRET_|future_secret|ground_truth|rubric|evaluator|provenance|summary|compliance/,
    );
  });

  it('fails closed when a medication reference cannot be resolved semantically', () => {
    const source = generatedContent() as any;
    source.patientRuntime.pharmacotherapy.actualMedicationUse[0].medicationRef =
      'med_00000000-0000-4000-8000-000000009999';

    expect(() => buildPatientResponseValidationContextV2(source)).toThrow(
      PatientResponseValidationContextErrorV2,
    );
  });

  it('does not accept an evaluator clinical content object as patient context', () => {
    expect(() =>
      buildPatientResponseValidationContextV2({
        contentFormat: 'GENERATED_CASE_BUNDLE_V2',
        evaluator: { groundTruth: 'SECRET' },
      } as any),
    ).toThrow();
  });
});

describe('buildPatientResponseValidationRequestV2 conversation boundary', () => {
  it('copies only accepted student/patient messages and keeps the current turn separate', () => {
    const messages = [
      { role: 'student' as const, content: '¿Cómo se encuentra?' },
      { role: 'patient' as const, content: 'Tengo algún mareo.' },
    ];
    const request = buildPatientResponseValidationRequestV2({
      clinicalContent: legacyContent(),
      acceptedConversation: messages,
      currentStudentTurn: '¿Desde cuándo?',
      candidate: validatedCandidate('Desde hace una semana.'),
    });

    expect(request).toMatchObject({
      contractVersion: '1.0',
      safetyPolicyVersion: '1.0',
      acceptedConversation: messages,
      currentStudentTurn: '¿Desde cuándo?',
      candidate: 'Desde hace una semana.',
    });
    expect(request.acceptedConversation).not.toBe(messages);
    expect(request.acceptedConversation[0]).not.toBe(messages[0]);
  });

  it('rejects conversation roles other than student and patient', () => {
    expect(() =>
      buildPatientResponseValidationRequestV2({
        clinicalContent: legacyContent(),
        acceptedConversation: [
          { role: 'teacher', content: 'Solución' } as any,
        ],
        currentStudentTurn: 'Hola',
        candidate: validatedCandidate(),
      }),
    ).toThrow(PatientResponseValidationContextErrorV2);
  });
});
