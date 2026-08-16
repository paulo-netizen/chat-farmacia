import { describe, expect, it } from 'vitest';
import { createPatientRuntimeViewV2 } from '@/lib/cases/v2/patient-runtime';
import {
  PatientFactsValidationError,
  validateCasePatientFactsDraftV2,
} from '@/lib/cases/v2/validate-patient-facts';

const spontaneous = { mode: 'spontaneous' } as const;
const domainMedicationUse = {
  mode: 'domain_exploration',
  domains: ['medication_use'],
} as const;

const factIds = {
  initialDemand: 'fact_00000000-0000-4000-8000-000000000001',
  healthProblem: 'fact_00000000-0000-4000-8000-000000000002',
  symptomAbsence: 'fact_00000000-0000-4000-8000-000000000003',
  medicationName: 'fact_00000000-0000-4000-8000-000000000004',
  prescribedUse: 'fact_00000000-0000-4000-8000-000000000005',
  purposeUnknown: 'fact_00000000-0000-4000-8000-000000000006',
  actualUse: 'fact_00000000-0000-4000-8000-000000000007',
  practicalDifficulty: 'fact_00000000-0000-4000-8000-000000000008',
  belief: 'fact_00000000-0000-4000-8000-000000000009',
  perceivedExperience: 'fact_00000000-0000-4000-8000-00000000000a',
  dailyContext: 'fact_00000000-0000-4000-8000-00000000000b',
  missing: 'fact_00000000-0000-4000-8000-000000000099',
} as const;

const medicationIds = {
  enalapril: 'med_10000000-0000-4000-8000-000000000001',
  missing: 'med_10000000-0000-4000-8000-000000000099',
} as const;

const medicationUseIds = {
  current: 'use_20000000-0000-4000-8000-000000000001',
} as const;

function known(factId: string, value: string) {
  return {
    state: 'known',
    factId,
    value,
    certainty: 'exact',
    disclosure: spontaneous,
  } as const;
}

function createDraft(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    publicProfile: {
      nombre: 'María',
      edad: 67,
      sexo: 'F',
      tratamiento: 'Enalapril 20 mg cada 24 horas',
    },
    initialDemand: known(
      factIds.initialDemand,
      'Vengo a recoger la medicación de la tensión.',
    ),
    knownHealthProblems: [
      known(
        factIds.healthProblem,
        'Le diagnosticaron hipertensión hace ocho años.',
      ),
    ],
    symptoms: [
      {
        state: 'explicit_absence',
        factId: factIds.symptomAbsence,
        topic: 'síntomas actuales',
        disclosure: {
          mode: 'domain_exploration',
          domains: ['symptoms'],
        },
      },
    ],
    medications: [
      {
        medicationId: medicationIds.enalapril,
        displayName: known(factIds.medicationName, 'Enalapril 20 mg'),
        prescribedUse: known(
          factIds.prescribedUse,
          'Un comprimido cada mañana.',
        ),
        purposeAsUnderstood: {
          state: 'patient_unknown',
          factId: factIds.purposeUnknown,
          topic: 'para qué sirve el enalapril',
          disclosure: {
            mode: 'specific_question',
            domains: ['medication_knowledge'],
          },
        },
      },
    ],
    medicationUse: [
      {
        useId: medicationUseIds.current,
        medicationRef: medicationIds.enalapril,
        action: 'omits',
        actualUse: {
          state: 'known',
          factId: factIds.actualUse,
          value: 'Al cambiar de turno a veces no toma la dosis de la mañana.',
          certainty: 'approximate',
          disclosure: domainMedicationUse,
        },
        circumstanceFactRefs: [factIds.dailyContext],
        statedReasonFactRefs: [factIds.belief],
        perceivedEffectFactRefs: [factIds.perceivedExperience],
        practicalDifficultyFactRefs: [factIds.practicalDifficulty],
      },
    ],
    practicalDifficulties: [
      known(
        factIds.practicalDifficulty,
        'Le cuesta asociar la toma a una rutina estable.',
      ),
    ],
    beliefsAndConcerns: [
      known(
        factIds.belief,
        'No tiene claro para qué sirve el medicamento.',
      ),
    ],
    perceivedExperiences: [
      {
        state: 'explicit_absence',
        factId: factIds.perceivedExperience,
        topic: 'beneficio percibido del enalapril',
        disclosure: {
          mode: 'specific_question',
          domains: ['perceived_experiences'],
        },
      },
    ],
    dailyAndSocialContext: [
      known(factIds.dailyContext, 'Trabaja con turnos que cambian cada semana.'),
    ],
    communicationProfile: {
      sociability: 3,
      cooperation: 4,
      organization: 2,
      emotionalReactivity: 3,
      opennessToChange: 4,
      healthLiteracy: 'medium',
      professionalTrust: 4,
      medicationAttitude: 'cautious',
      decisionStyle: 'shared',
      readinessToChange: 4,
      socialDesirability: 2,
      judgmentSensitivity: 3,
      disclosureThreshold: 3,
      answerLength: 'medium',
      assertiveness: 3,
      emotionalExpression: 3,
    },
  };
}

describe('CasePatientFactsDraftV2 validation', () => {
  it('mantiene diferenciados known, explicit_absence y patient_unknown', () => {
    const draft = validateCasePatientFactsDraftV2(createDraft());

    expect(draft.knownHealthProblems[0]).toMatchObject({ state: 'known' });
    expect(draft.symptoms[0]).toEqual({
      state: 'explicit_absence',
      factId: factIds.symptomAbsence,
      topic: 'síntomas actuales',
      disclosure: {
        mode: 'domain_exploration',
        domains: ['symptoms'],
      },
    });
    expect(draft.medications[0].purposeAsUnderstood).toMatchObject({
      state: 'patient_unknown',
      factId: factIds.purposeUnknown,
      topic: 'para qué sirve el enalapril',
    });
  });

  it.each(['explicit_absence', 'patient_unknown'])(
    'exige topic para el estado %s',
    (state) => {
      const source = createDraft();
      source.symptoms = [
        {
          state,
          factId: 'fact_30000000-0000-4000-8000-000000000001',
          disclosure: spontaneous,
        },
      ];

      expect(() => validateCasePatientFactsDraftV2(source)).toThrow(/topic/);
    },
  );

  it('admite not_defined en el modelo de autoría', () => {
    const source = createDraft();
    source.initialDemand = { state: 'not_defined' };

    const draft = validateCasePatientFactsDraftV2(source);

    expect(draft.initialDemand).toEqual({ state: 'not_defined' });
  });

  it('no interpreta un dato ausente como una ausencia explícita', () => {
    const source = createDraft();
    delete source.initialDemand;

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /initialDemand: must be an object/,
    );
  });

  it('admite not_applicable sin convertirlo en una ausencia explícita', () => {
    const source = createDraft();
    source.symptoms = [
      { state: 'not_applicable', reasonCode: 'outside_case_scope' },
    ];

    const draft = validateCasePatientFactsDraftV2(source);

    expect(draft.symptoms[0]).toEqual({
      state: 'not_applicable',
      reasonCode: 'outside_case_scope',
    });

    const runtime = createPatientRuntimeViewV2(source);
    expect(runtime.symptoms).toEqual([]);
    expect(JSON.stringify(runtime)).not.toContain('not_applicable');
    expect(JSON.stringify(runtime)).not.toContain('outside_case_scope');
    expect(JSON.stringify(runtime)).not.toContain('reasonCode');
  });

  it('acepta IDs opacos y referencias opacas existentes', () => {
    const draft = validateCasePatientFactsDraftV2(createDraft());

    expect(draft.medicationUse[0]).toMatchObject({
      useId: medicationUseIds.current,
      medicationRef: medicationIds.enalapril,
      circumstanceFactRefs: [factIds.dailyContext],
      statedReasonFactRefs: [factIds.belief],
    });
  });

  it('rechaza un factId semántico', () => {
    const source = createDraft();
    source.knownHealthProblems[0].factId = 'fact-main-barrier-fear';

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /fact_<uuid>/,
    );
  });

  it('rechaza un medicationId semántico', () => {
    const source = createDraft();
    source.medications[0].medicationId = 'med-enalapril';

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /med_<uuid>/,
    );
  });

  it('rechaza un useId semántico', () => {
    const source = createDraft();
    source.medicationUse[0].useId = 'use-enalapril-current';

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /use_<uuid>/,
    );
  });

  it.each([
    [
      'prefijo incorrecto',
      'med_00000000-0000-4000-8000-000000000001',
    ],
    [
      'UUID con mayúsculas',
      'fact_A0000000-0000-4000-8000-000000000001',
    ],
    [
      'versión UUID no permitida',
      'fact_00000000-0000-9000-8000-000000000001',
    ],
    [
      'variante UUID no permitida',
      'fact_00000000-0000-4000-7000-000000000001',
    ],
  ])('rechaza factId con %s', (_description, invalidId) => {
    const source = createDraft();
    source.knownHealthProblems[0].factId = invalidId;

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /fact_<uuid>/,
    );
  });

  it('rechaza una conducta que referencia un medicamento inexistente', () => {
    const source = createDraft();
    source.medicationUse[0].medicationRef = medicationIds.missing;

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /unknown medication reference/,
    );
  });

  it('rechaza referencias a hechos inexistentes', () => {
    const source = createDraft();
    source.medicationUse[0].statedReasonFactRefs = [factIds.missing];

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /unknown fact reference/,
    );
  });

  it('rechaza IDs de hechos duplicados entre dominios', () => {
    const source = createDraft();
    source.symptoms[0].factId = factIds.healthProblem;

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /duplicate fact ID/,
    );
  });

  it('rechaza clasificaciones de adherencia dentro de comunicación', () => {
    const source = createDraft();
    source.communicationProfile.tipo_no_adherencia = 'no intencional';

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /academic classifications are forbidden/,
    );
  });

  it('exige valores controlados para actitud y estilo de decisión', () => {
    const source = createDraft();
    source.communicationProfile.medicationAttitude =
      'rechaza enalapril porque cree que le hace daño';

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /medicationAttitude/,
    );
  });
});

describe('PatientRuntimeViewV2 projection', () => {
  it('construye una vista nueva mediante allowlist y conserva hechos válidos', () => {
    const source = createDraft();
    source.ground_truth = { tipo_no_adherencia: 'no intencional' };
    source.tipo_no_adherencia = 'no intencional';
    source.barrera_principal = 'olvido';
    source.future_secret = { solution: 'secreto futuro' };
    source.publicProfile.future_public_secret = 'no copiar';
    source.medications[0].future_medication_secret = { hidden: true };

    const runtime = createPatientRuntimeViewV2(source);

    expect(runtime).not.toBe(source);
    expect(runtime.publicProfile).not.toBe(source.publicProfile);
    expect(runtime.medications[0]).not.toBe(source.medications[0]);
    expect(runtime.communicationProfile.medicationAttitude).toBe('cautious');
    expect(runtime.beliefsAndConcerns[0]).toMatchObject({
      state: 'known',
      factId: factIds.belief,
    });

    const serialized = JSON.stringify(runtime);
    for (const forbidden of [
      'ground_truth',
      'adherent',
      'non_adherent',
      'intentional',
      'unintentional',
      'mixed',
      'tipo_no_adherencia',
      'barrera_principal',
      'prm',
      'rnm',
      'intervention',
      'rubric',
      'future_secret',
      'future_public_secret',
      'future_medication_secret',
      'secreto futuro',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('conserva el significado de explicit_absence y patient_unknown sin derivarlo del factId', () => {
    const runtime = createPatientRuntimeViewV2(createDraft());
    const absence = runtime.symptoms[0];
    const unknownPurpose = runtime.medications[0].purposeAsUnderstood;

    expect(absence).toMatchObject({
      state: 'explicit_absence',
      factId: factIds.symptomAbsence,
      topic: 'síntomas actuales',
    });
    expect(unknownPurpose).toMatchObject({
      state: 'patient_unknown',
      factId: factIds.purposeUnknown,
      topic: 'para qué sirve el enalapril',
    });
    if (absence.state !== 'explicit_absence') {
      throw new Error('Expected explicit_absence');
    }
    if (unknownPurpose?.state !== 'patient_unknown') {
      throw new Error('Expected patient_unknown');
    }
    expect(absence.topic).not.toBe(absence.factId);
    expect(unknownPurpose.topic).not.toBe(unknownPurpose.factId);
  });

  it('omite not_applicable también en una propiedad individual opcional', () => {
    const source = createDraft();
    source.medications[0].purposeAsUnderstood = {
      state: 'not_applicable',
      reasonCode: 'not_applicable_to_patient',
    };

    const runtime = createPatientRuntimeViewV2(source);

    expect(runtime.medications[0]).not.toHaveProperty('purposeAsUnderstood');
    const serialized = JSON.stringify(runtime);
    expect(serialized).not.toContain('not_applicable');
    expect(serialized).not.toContain('not_applicable_to_patient');
    expect(serialized).not.toContain('reasonCode');
  });

  it('falla de forma cerrada si la demanda obligatoria está not_defined', () => {
    const source = createDraft();
    source.initialDemand = { state: 'not_defined' };

    expect(() => createPatientRuntimeViewV2(source)).toThrow(
      PatientFactsValidationError,
    );
    expect(() => createPatientRuntimeViewV2(source)).toThrow(
      /not_defined is forbidden/,
    );
  });

  it('no permite not_defined en ningún dominio runtime', () => {
    const source = createDraft();
    source.practicalDifficulties = [{ state: 'not_defined' }];
    source.medicationUse[0].practicalDifficultyFactRefs = [];

    expect(() => createPatientRuntimeViewV2(source)).toThrow(
      /not_defined is forbidden/,
    );
  });

  it('mantiene personalidad y conducta farmacológica en ramas independientes', () => {
    const runtime = createPatientRuntimeViewV2(createDraft());

    expect(Object.keys(runtime.communicationProfile)).not.toContain(
      'tipo_no_adherencia',
    );
    expect(Object.keys(runtime.communicationProfile)).not.toContain(
      'barrera_principal',
    );
    expect(runtime.medicationUse[0].action).toBe('omits');
    expect(runtime.communicationProfile.organization).toBe(2);
  });
});
