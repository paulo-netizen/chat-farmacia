import { describe, expect, it } from 'vitest';
import { createPatientRuntimeViewV2 } from '@/lib/cases/v2/patient-runtime';
import {
  PatientFactsValidationError,
  validateCasePatientFactsDraftV2,
} from '@/lib/cases/v2/validate-patient-facts';

const spontaneous = { mode: 'spontaneous' } as const;
const actualMedicationUseDisclosure = {
  mode: 'domain_exploration',
  domains: ['actual_medication_use'],
} as const;

const allDisclosureDomains = [
  'initial_demand',
  'patient_identity',
  'caregiver_context',
  'health_problems',
  'clinical_history',
  'physiological_status',
  'pregnancy_lactation',
  'allergies_intolerances',
  'symptoms',
  'symptom_timing_and_evolution',
  'prior_actions',
  'medication_identity',
  'medication_purpose',
  'prescribed_medication_use',
  'actual_medication_use',
  'administration_technique',
  'special_use_conditions',
  'medication_changes',
  'perceived_effectiveness',
  'perceived_safety',
  'practical_difficulties',
  'beliefs_and_concerns',
  'strategies_already_tried',
  'lifestyle',
  'daily_context',
  'social_support',
  'professional_relationship',
  'biomedical_data',
] as const;

const factIds = {
  initialDemand: 'fact_00000000-0000-4000-8000-000000000001',
  personPresent: 'fact_00000000-0000-4000-8000-000000000002',
  relationship: 'fact_00000000-0000-4000-8000-000000000003',
  healthProblem: 'fact_00000000-0000-4000-8000-000000000004',
  clinicalHistory: 'fact_00000000-0000-4000-8000-000000000005',
  physiologicalSituation: 'fact_00000000-0000-4000-8000-000000000006',
  pregnancy: 'fact_00000000-0000-4000-8000-000000000007',
  allergyAbsence: 'fact_00000000-0000-4000-8000-000000000008',
  lifestyle: 'fact_00000000-0000-4000-8000-000000000009',
  biomedical: 'fact_00000000-0000-4000-8000-00000000000a',
  symptomDescription: 'fact_00000000-0000-4000-8000-00000000000b',
  symptomOnset: 'fact_00000000-0000-4000-8000-00000000000c',
  symptomDuration: 'fact_00000000-0000-4000-8000-00000000000d',
  symptomEvolution: 'fact_00000000-0000-4000-8000-00000000000e',
  symptomCircumstance: 'fact_00000000-0000-4000-8000-00000000000f',
  medicationName: 'fact_00000000-0000-4000-8000-000000000010',
  medicationOrigin: 'fact_00000000-0000-4000-8000-000000000011',
  purposeUnknown: 'fact_00000000-0000-4000-8000-000000000012',
  regimenBasis: 'fact_00000000-0000-4000-8000-000000000013',
  referenceDose: 'fact_00000000-0000-4000-8000-000000000014',
  referenceSchedule: 'fact_00000000-0000-4000-8000-000000000015',
  referenceDuration: 'fact_00000000-0000-4000-8000-000000000016',
  administrationMethod: 'fact_00000000-0000-4000-8000-000000000017',
  specialUseCondition: 'fact_00000000-0000-4000-8000-000000000027',
  actualUse: 'fact_00000000-0000-4000-8000-000000000018',
  actualDose: 'fact_00000000-0000-4000-8000-000000000019',
  actualSchedule: 'fact_00000000-0000-4000-8000-00000000001a',
  frequency: 'fact_00000000-0000-4000-8000-00000000001b',
  timePeriod: 'fact_00000000-0000-4000-8000-00000000001c',
  recentChange: 'fact_00000000-0000-4000-8000-00000000001d',
  perceivedEffectiveness: 'fact_00000000-0000-4000-8000-00000000001e',
  perceivedSafety: 'fact_00000000-0000-4000-8000-00000000001f',
  priorAction: 'fact_00000000-0000-4000-8000-000000000020',
  practicalDifficulty: 'fact_00000000-0000-4000-8000-000000000021',
  belief: 'fact_00000000-0000-4000-8000-000000000022',
  strategyTried: 'fact_00000000-0000-4000-8000-000000000023',
  dailyContext: 'fact_00000000-0000-4000-8000-000000000024',
  socialSupport: 'fact_00000000-0000-4000-8000-000000000025',
  professionalRelationship: 'fact_00000000-0000-4000-8000-000000000026',
  missing: 'fact_00000000-0000-4000-8000-000000000099',
} as const;

const medicationIds = {
  enalapril: 'med_10000000-0000-4000-8000-000000000001',
  missing: 'med_10000000-0000-4000-8000-000000000099',
} as const;

const medicationUseIds = {
  current: 'use_20000000-0000-4000-8000-000000000001',
} as const;

function known<T>(
  factId: string,
  value: T,
  disclosure: Record<string, unknown> = spontaneous,
) {
  return {
    state: 'known',
    factId,
    value,
    certainty: 'exact',
    disclosure,
  } as const;
}

function notApplicable(reasonCode = 'not_applicable_to_patient') {
  return { state: 'not_applicable', reasonCode } as const;
}

function createDraft(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId: 'casever_90000000-0000-4000-8000-000000000001',
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
    encounter: {
      personPresent: known(factIds.personPresent, 'patient'),
      relationshipToPatient: notApplicable(),
    },
    clinicalContext: {
      healthProblems: [
        known(
          factIds.healthProblem,
          'Le diagnosticaron hipertensión hace ocho años.',
        ),
      ],
      clinicalHistory: [
        known(factIds.clinicalHistory, 'Sin ingresos durante el último año.'),
      ],
      physiologicalSituation: [
        known(factIds.physiologicalSituation, 'Paciente posmenopáusica.'),
      ],
      pregnancyAndLactation: notApplicable(),
      allergiesAndIntolerances: [
        {
          state: 'explicit_absence',
          factId: factIds.allergyAbsence,
          topic: 'alergias e intolerancias conocidas',
          disclosure: {
            mode: 'domain_exploration',
            domains: ['allergies_intolerances'],
          },
        },
      ],
      lifestyle: [
        known(factIds.lifestyle, 'Camina unos treinta minutos casi cada día.'),
      ],
      biomedicalData: [
        known(
          factIds.biomedical,
          {
            type: 'presión arterial',
            value: '148/86',
            unit: 'mmHg',
            timingOrContext: 'medida en casa ayer por la tarde',
          },
          {
            mode: 'specific_question',
            domains: ['biomedical_data'],
          } as const,
        ),
      ],
    },
    symptoms: [
      {
        description: known(factIds.symptomDescription, 'Dolor de cabeza leve.'),
        onset: known(factIds.symptomOnset, 'Comenzó hace tres días.'),
        duration: known(factIds.symptomDuration, 'Dura una o dos horas.'),
        evolution: known(factIds.symptomEvolution, 'Se mantiene estable.'),
        relevantCircumstances: [
          known(
            factIds.symptomCircumstance,
            'Suele aparecer al final del turno de trabajo.',
          ),
        ],
      },
    ],
    pharmacotherapy: {
      prescribedMedications: [
        {
          medicationId: medicationIds.enalapril,
          displayName: known(factIds.medicationName, 'Enalapril 20 mg'),
          origin: known(factIds.medicationOrigin, 'prescribed'),
          purposeAsUnderstood: {
            state: 'patient_unknown',
            factId: factIds.purposeUnknown,
            topic: 'para qué sirve el enalapril',
            disclosure: {
              mode: 'specific_question',
              domains: ['medication_purpose'],
            },
          },
          regimenBasis: known(factIds.regimenBasis, 'prescription'),
          referenceDose: known(factIds.referenceDose, '20 mg'),
          referenceSchedule: known(
            factIds.referenceSchedule,
            'Un comprimido cada mañana.',
          ),
          referenceDuration: known(
            factIds.referenceDuration,
            'Tratamiento continuado.',
          ),
          administrationMethod: known(
            factIds.administrationMethod,
            'Traga el comprimido con agua.',
          ),
          specialUseConditions: [
            known(
              factIds.specialUseCondition,
              'Procura tomarlo a la misma hora.',
            ),
          ],
        },
      ],
      otherMedicinesAndProducts: [],
      actualMedicationUse: [
        {
          useId: medicationUseIds.current,
          medicationRef: medicationIds.enalapril,
          action: 'omits',
          actualUse: {
            state: 'known',
            factId: factIds.actualUse,
            value: 'Al cambiar de turno a veces no toma la dosis de la mañana.',
            certainty: 'approximate',
            disclosure: actualMedicationUseDisclosure,
          },
          actualDose: known(factIds.actualDose, '20 mg cuando lo toma.'),
          actualSchedule: known(
            factIds.actualSchedule,
            'Intenta tomarlo por la mañana.',
          ),
          frequency: known(
            factIds.frequency,
            'Omite aproximadamente dos dosis algunas semanas.',
          ),
          timePeriod: known(
            factIds.timePeriod,
            'Le sucede desde que cambió de turno hace dos meses.',
          ),
          circumstanceFactRefs: [factIds.dailyContext],
          statedReasonFactRefs: [factIds.belief],
          perceivedEffectFactRefs: [factIds.perceivedEffectiveness],
          practicalDifficultyFactRefs: [factIds.practicalDifficulty],
          strategyTriedFactRefs: [factIds.strategyTried],
        },
      ],
      recentChanges: [
        {
          medicationRef: medicationIds.enalapril,
          detail: known(
            factIds.recentChange,
            'Hace dos meses pasó de tomarlo por la noche a tomarlo por la mañana.',
          ),
        },
      ],
      perceivedEffectiveness: [
        {
          medicationRef: medicationIds.enalapril,
          detail: known(
            factIds.perceivedEffectiveness,
            'No nota una diferencia clara cuando lo toma.',
          ),
        },
      ],
      perceivedSafety: [
        {
          medicationRef: medicationIds.enalapril,
          detail: {
            state: 'patient_unknown',
            factId: factIds.perceivedSafety,
            topic: 'si el enalapril le está produciendo algún problema',
            disclosure: {
              mode: 'specific_question',
              domains: ['perceived_safety'],
            },
          },
        },
      ],
    },
    actionsAlreadyTaken: [
      known(
        factIds.priorAction,
        'Ha probado a dejar el envase junto a las llaves.',
      ),
    ],
    practicalDifficulties: [
      known(
        factIds.practicalDifficulty,
        'Le cuesta asociar la toma a una rutina estable.',
      ),
    ],
    beliefsAndConcerns: [
      known(factIds.belief, 'No tiene claro para qué sirve el medicamento.'),
    ],
    strategiesAlreadyTried: [
      known(
        factIds.strategyTried,
        'Probó una alarma, pero la desactivaba durante el trabajo.',
      ),
    ],
    dailyAndSocialContext: [
      known(factIds.dailyContext, 'Trabaja con turnos que cambian cada semana.'),
    ],
    familyAndSocialSupport: [
      known(factIds.socialSupport, 'Vive sola y habla a diario con su hermana.'),
    ],
    relationshipWithProfessionals: [
      known(
        factIds.professionalRelationship,
        'Confía en su médica y suele consultar dudas en la farmacia.',
      ),
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

    expect(draft.clinicalContext.healthProblems[0]).toMatchObject({
      state: 'known',
    });
    expect(draft.clinicalContext.allergiesAndIntolerances[0]).toEqual({
      state: 'explicit_absence',
      factId: factIds.allergyAbsence,
      topic: 'alergias e intolerancias conocidas',
      disclosure: {
        mode: 'domain_exploration',
        domains: ['allergies_intolerances'],
      },
    });
    expect(
      draft.pharmacotherapy.prescribedMedications[0].purposeAsUnderstood,
    ).toMatchObject({
      state: 'patient_unknown',
      factId: factIds.purposeUnknown,
      topic: 'para qué sirve el enalapril',
    });
  });

  it.each(['explicit_absence', 'patient_unknown'])(
    'exige topic para el estado %s',
    (state) => {
      const source = createDraft();
      source.clinicalContext.allergiesAndIntolerances = [
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

  it('no interpreta una colección vacía como una ausencia clínica', () => {
    const source = createDraft();
    source.clinicalContext.allergiesAndIntolerances = [];

    const runtime = createPatientRuntimeViewV2(source);

    expect(runtime.clinicalContext.allergiesAndIntolerances).toEqual([]);
    expect(JSON.stringify(runtime)).not.toContain('no tiene alergias');
  });

  it('admite not_applicable sin convertirlo en una ausencia explícita', () => {
    const source = createDraft();
    source.clinicalContext.lifestyle = [
      { state: 'not_applicable', reasonCode: 'outside_case_scope' },
    ];

    const draft = validateCasePatientFactsDraftV2(source);

    expect(draft.clinicalContext.lifestyle[0]).toEqual({
      state: 'not_applicable',
      reasonCode: 'outside_case_scope',
    });

    const runtime = createPatientRuntimeViewV2(source);
    expect(runtime.clinicalContext.lifestyle).toEqual([]);
    expect(JSON.stringify(runtime)).not.toContain('not_applicable');
    expect(JSON.stringify(runtime)).not.toContain('outside_case_scope');
    expect(JSON.stringify(runtime)).not.toContain('reasonCode');
  });

  it('acepta todos los dominios de revelación factuales ampliados', () => {
    const source = createDraft();
    source.actionsAlreadyTaken[0].disclosure = {
      mode: 'domain_exploration',
      domains: [...allDisclosureDomains],
    };

    const draft = validateCasePatientFactsDraftV2(source);

    expect(draft.actionsAlreadyTaken[0]).toMatchObject({
      disclosure: { domains: allDisclosureDomains },
    });
  });

  it('rechaza adherence como dominio de revelación académico', () => {
    const source = createDraft();
    source.actionsAlreadyTaken[0].disclosure = {
      mode: 'domain_exploration',
      domains: ['adherence'],
    };

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /must be one of/,
    );
  });

  it('acepta IDs opacos y referencias opacas existentes', () => {
    const draft = validateCasePatientFactsDraftV2(createDraft());

    expect(draft.pharmacotherapy.actualMedicationUse[0]).toMatchObject({
      useId: medicationUseIds.current,
      medicationRef: medicationIds.enalapril,
      circumstanceFactRefs: [factIds.dailyContext],
      statedReasonFactRefs: [factIds.belief],
      strategyTriedFactRefs: [factIds.strategyTried],
    });
  });

  it('rechaza un factId semántico', () => {
    const source = createDraft();
    source.clinicalContext.healthProblems[0].factId = 'fact-main-barrier-fear';

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /fact_<uuid>/,
    );
  });

  it('rechaza un medicationId semántico', () => {
    const source = createDraft();
    source.pharmacotherapy.prescribedMedications[0].medicationId =
      'med-enalapril';

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /med_<uuid>/,
    );
  });

  it('rechaza un useId semántico', () => {
    const source = createDraft();
    source.pharmacotherapy.actualMedicationUse[0].useId =
      'use-enalapril-current';

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /use_<uuid>/,
    );
  });

  it.each([
    ['prefijo incorrecto', 'med_00000000-0000-4000-8000-000000000001'],
    ['UUID con mayúsculas', 'fact_A0000000-0000-4000-8000-000000000001'],
    ['versión UUID no permitida', 'fact_00000000-0000-9000-8000-000000000001'],
    ['variante UUID no permitida', 'fact_00000000-0000-4000-7000-000000000001'],
  ])('rechaza factId con %s', (_description, invalidId) => {
    const source = createDraft();
    source.clinicalContext.healthProblems[0].factId = invalidId;

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /fact_<uuid>/,
    );
  });

  it('rechaza una conducta que referencia un medicamento inexistente', () => {
    const source = createDraft();
    source.pharmacotherapy.actualMedicationUse[0].medicationRef =
      medicationIds.missing;

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /unknown medication reference/,
    );
  });

  it('rechaza referencias a hechos inexistentes', () => {
    const source = createDraft();
    source.pharmacotherapy.actualMedicationUse[0].statedReasonFactRefs = [
      factIds.missing,
    ];

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /unknown fact reference/,
    );
  });

  it('rechaza IDs de hechos duplicados entre dominios', () => {
    const source = createDraft();
    source.clinicalContext.allergiesAndIntolerances[0].factId =
      factIds.healthProblem;

    expect(() => validateCasePatientFactsDraftV2(source)).toThrow(
      /duplicate fact ID/,
    );
  });

  it('rechaza clasificaciones de adherencia dentro de comunicación', () => {
    const source = createDraft();
    source.communicationProfile.nonAdherenceType = 'unintentional';

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

  it('valida y normaliza datos biomédicos genéricos por allowlist', () => {
    const source = createDraft();
    source.clinicalContext.biomedicalData[0].value.future_secret = 'oculto';

    const draft = validateCasePatientFactsDraftV2(source);
    const datum = draft.clinicalContext.biomedicalData[0];

    expect(datum).toMatchObject({
      state: 'known',
      value: {
        type: 'presión arterial',
        value: '148/86',
        unit: 'mmHg',
        timingOrContext: 'medida en casa ayer por la tarde',
      },
    });
    expect(JSON.stringify(datum)).not.toContain('future_secret');
  });
});

describe('PatientRuntimeViewV2 factual scenarios', () => {
  it('representa PA-SI-T-A-M-A-E para Indicación sin conclusiones docentes', () => {
    const source = createDraft();
    source.initialDemand = known(
      factIds.initialDemand,
      'Quería algo para este dolor de cabeza.',
    );

    const runtime = createPatientRuntimeViewV2(source);

    expect(runtime.encounter.personPresent).toMatchObject({
      state: 'known',
      value: 'patient',
    });
    expect(runtime.symptoms[0]).toMatchObject({
      description: { state: 'known', value: 'Dolor de cabeza leve.' },
      onset: { state: 'known' },
      duration: { state: 'known' },
      evolution: { state: 'known' },
    });
    expect(runtime.actionsAlreadyTaken).toHaveLength(1);
    expect(runtime.pharmacotherapy.prescribedMedications).toHaveLength(1);
    expect(runtime.clinicalContext.allergiesAndIntolerances[0]).toMatchObject({
      state: 'explicit_absence',
      topic: 'alergias e intolerancias conocidas',
    });
    expect(runtime.clinicalContext.physiologicalSituation).toHaveLength(1);
    expect(runtime.clinicalContext.healthProblems).toHaveLength(1);
    expect(runtime.clinicalContext.lifestyle).toHaveLength(1);
    expect(runtime.clinicalContext.biomedicalData).toHaveLength(1);

    const serialized = JSON.stringify(runtime);
    expect(serialized).not.toContain('prm');
    expect(serialized).not.toContain('rnm');
    expect(serialized).not.toContain('adherenceStatus');
  });

  it('representa un producto autoseleccionado con régimen basado en el prospecto', () => {
    const source = createDraft();
    source.pharmacotherapy.otherMedicinesAndProducts.push({
      medicationId: 'med_40000000-0000-4000-8000-000000000001',
      displayName: known(
        'fact_40000000-0000-4000-8000-000000000001',
        'Ibuprofeno 400 mg',
      ),
      origin: known(
        'fact_40000000-0000-4000-8000-000000000002',
        'patient_selected',
      ),
      purposeAsUnderstood: known(
        'fact_40000000-0000-4000-8000-000000000003',
        'Lo quiere utilizar para el dolor de cabeza.',
      ),
      regimenBasis: known(
        'fact_40000000-0000-4000-8000-000000000004',
        'label_or_leaflet',
      ),
      referenceDose: known(
        'fact_40000000-0000-4000-8000-000000000005',
        '400 mg',
      ),
      referenceSchedule: known(
        'fact_40000000-0000-4000-8000-000000000006',
        'Una toma cada 6-8 horas según el prospecto.',
      ),
      referenceDuration: notApplicable('clinically_irrelevant'),
      administrationMethod: known(
        'fact_40000000-0000-4000-8000-000000000007',
        'Comprimido por vía oral.',
      ),
      specialUseConditions: [],
    });

    const runtime = createPatientRuntimeViewV2(source);
    const product = runtime.pharmacotherapy.otherMedicinesAndProducts[0];

    expect(product).toMatchObject({
      origin: { state: 'known', value: 'patient_selected' },
      regimenBasis: { state: 'known', value: 'label_or_leaflet' },
      referenceDose: { state: 'known', value: '400 mg' },
      referenceSchedule: { state: 'known' },
    });
    expect(product).not.toHaveProperty('prescribedDose');
    expect(product).not.toHaveProperty('prescribedSchedule');
    expect(JSON.stringify(product)).not.toContain('prescribed');
  });

  it('representa una Dispensación de continuación con uso y percepciones separados', () => {
    const runtime = createPatientRuntimeViewV2(createDraft());
    const medication = runtime.pharmacotherapy.prescribedMedications[0];
    const use = runtime.pharmacotherapy.actualMedicationUse[0];

    expect(medication).toMatchObject({
      origin: { state: 'known', value: 'prescribed' },
      regimenBasis: { state: 'known', value: 'prescription' },
      referenceDose: { state: 'known', value: '20 mg' },
      referenceSchedule: { state: 'known' },
      referenceDuration: { state: 'known' },
      administrationMethod: { state: 'known' },
    });
    expect(use).toMatchObject({
      action: 'omits',
      actualUse: { state: 'known' },
      actualDose: { state: 'known' },
      actualSchedule: { state: 'known' },
      frequency: { state: 'known' },
      timePeriod: { state: 'known' },
    });
    expect(runtime.pharmacotherapy.recentChanges).toHaveLength(1);
    expect(runtime.pharmacotherapy.perceivedEffectiveness[0]).toMatchObject({
      detail: { state: 'known' },
    });
    expect(runtime.pharmacotherapy.perceivedSafety[0]).toMatchObject({
      detail: { state: 'patient_unknown' },
    });
  });

  it('representa un caso focal de Adherencia solo mediante hechos', () => {
    const runtime = createPatientRuntimeViewV2(createDraft());
    const use = runtime.pharmacotherapy.actualMedicationUse[0];

    expect(use.action).toBe('omits');
    expect(use.circumstanceFactRefs).toEqual([factIds.dailyContext]);
    expect(use.statedReasonFactRefs).toEqual([factIds.belief]);
    expect(use.practicalDifficultyFactRefs).toEqual([
      factIds.practicalDifficulty,
    ]);
    expect(use.strategyTriedFactRefs).toEqual([factIds.strategyTried]);
    expect(runtime.practicalDifficulties).toHaveLength(1);
    expect(runtime.beliefsAndConcerns).toHaveLength(1);
    expect(runtime.strategiesAlreadyTried).toHaveLength(1);

    const serialized = JSON.stringify(runtime);
    for (const classification of [
      'adherenceStatus',
      'nonAdherenceType',
      'adherent',
      'non_adherent',
      'intentional',
      'unintentional',
      'erratic',
      'combined',
      'primaryBarrier',
    ]) {
      expect(serialized).not.toContain(classification);
    }
  });
});

describe('PatientRuntimeViewV2 projection', () => {
  it('conserva el CaseVersionId opaco del borrador validado', () => {
    const runtime = createPatientRuntimeViewV2(createDraft());

    expect(runtime.caseVersionId).toBe(
      'casever_90000000-0000-4000-8000-000000000001',
    );
  });

  it('construye una vista nueva mediante allowlist y conserva hechos válidos', () => {
    const source = createDraft();
    source.ground_truth = { nonAdherenceType: 'unintentional' };
    source.adherenceStatus = 'non_adherent';
    source.nonAdherenceType = 'unintentional';
    source.prm = { code: 'hidden' };
    source.rnm = { code: 'hidden' };
    source.risk_of_rnm = true;
    source.primaryBarrier = 'practical';
    source.evaluator = { solution: 'hidden' };
    source.future_secret = { solution: 'secreto futuro' };
    source.publicProfile.future_public_secret = 'no copiar';
    source.pharmacotherapy.prescribedMedications[0].future_medication_secret = {
      hidden: true,
    };

    const runtime = createPatientRuntimeViewV2(source);

    expect(runtime).not.toBe(source);
    expect(runtime.publicProfile).not.toBe(source.publicProfile);
    expect(runtime.pharmacotherapy).not.toBe(source.pharmacotherapy);
    expect(runtime.pharmacotherapy.prescribedMedications[0]).not.toBe(
      source.pharmacotherapy.prescribedMedications[0],
    );
    expect(runtime.communicationProfile.medicationAttitude).toBe('cautious');
    expect(runtime.beliefsAndConcerns[0]).toMatchObject({
      state: 'known',
      factId: factIds.belief,
    });

    const serialized = JSON.stringify(runtime);
    for (const forbidden of [
      'ground_truth',
      'adherenceStatus',
      'nonAdherenceType',
      'prm',
      'rnm',
      'risk_of_rnm',
      'primaryBarrier',
      'evaluator',
      'future_secret',
      'future_public_secret',
      'future_medication_secret',
      'secreto futuro',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('hace una copia defensiva del valor biomédico estructurado', () => {
    const source = createDraft();
    const sourceValue = source.clinicalContext.biomedicalData[0].value;

    const runtime = createPatientRuntimeViewV2(source);
    const runtimeDatum = runtime.clinicalContext.biomedicalData[0];

    if (runtimeDatum.state !== 'known') {
      throw new Error('Expected known biomedical datum');
    }
    expect(runtimeDatum.value).not.toBe(sourceValue);
    expect(runtimeDatum.value).toEqual(sourceValue);
  });

  it('conserva el significado de explicit_absence y patient_unknown sin derivarlo del factId', () => {
    const runtime = createPatientRuntimeViewV2(createDraft());
    const absence = runtime.clinicalContext.allergiesAndIntolerances[0];
    const unknownPurpose =
      runtime.pharmacotherapy.prescribedMedications[0].purposeAsUnderstood;

    expect(absence).toMatchObject({
      state: 'explicit_absence',
      factId: factIds.allergyAbsence,
      topic: 'alergias e intolerancias conocidas',
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

  it('omite not_applicable en propiedades individuales opcionales', () => {
    const source = createDraft();
    source.pharmacotherapy.prescribedMedications[0].purposeAsUnderstood =
      notApplicable();
    source.clinicalContext.pregnancyAndLactation = notApplicable();

    const runtime = createPatientRuntimeViewV2(source);

    expect(
      runtime.pharmacotherapy.prescribedMedications[0],
    ).not.toHaveProperty('purposeAsUnderstood');
    expect(runtime.clinicalContext).not.toHaveProperty(
      'pregnancyAndLactation',
    );
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

  it('exige que encounter.personPresent sea conocido para crear runtime', () => {
    const source = createDraft();
    source.encounter.personPresent = {
      state: 'patient_unknown',
      factId: factIds.personPresent,
      topic: 'quién está presente en la consulta',
      disclosure: {
        mode: 'specific_question',
        domains: ['patient_identity'],
      },
    };

    expect(() => createPatientRuntimeViewV2(source)).toThrow(
      /encounter\.personPresent: must be known/,
    );
  });

  it('no permite not_defined en ningún dominio runtime', () => {
    const source = createDraft();
    source.practicalDifficulties = [{ state: 'not_defined' }];
    source.pharmacotherapy.actualMedicationUse[0].practicalDifficultyFactRefs =
      [];

    expect(() => createPatientRuntimeViewV2(source)).toThrow(
      /not_defined is forbidden/,
    );
  });

  it('mantiene personalidad y conducta farmacológica en ramas independientes', () => {
    const runtime = createPatientRuntimeViewV2(createDraft());

    expect(Object.keys(runtime.communicationProfile)).not.toContain(
      'nonAdherenceType',
    );
    expect(Object.keys(runtime.communicationProfile)).not.toContain(
      'primaryBarrier',
    );
    expect(runtime.pharmacotherapy.actualMedicationUse[0].action).toBe(
      'omits',
    );
    expect(runtime.communicationProfile.organization).toBe(2);
  });
});
