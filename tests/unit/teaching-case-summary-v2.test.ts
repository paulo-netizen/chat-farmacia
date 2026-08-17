import { describe, expect, it } from 'vitest';
import {
  buildTeachingCaseSummaryV2,
  TeachingCaseSummaryBuildError,
} from '@/lib/cases/v2/build-teaching-case-summary';
import type {
  ConclusionId,
  EvaluatorViewV2,
} from '@/lib/cases/v2/evaluator-types';
import type {
  CaseVersionId,
  FactId,
  MedicationId,
  PatientRuntimeViewV2,
  RuntimePatientDatum,
} from '@/lib/cases/v2/types';

const caseVersionId =
  'casever_90000000-0000-4000-8000-000000000001' as CaseVersionId;
const otherCaseVersionId =
  'casever_90000000-0000-4000-8000-000000000002' as CaseVersionId;
const medA = 'med_10000000-0000-4000-8000-000000000001' as MedicationId;
const medB = 'med_10000000-0000-4000-8000-000000000002' as MedicationId;

const conclusionId = (value: string) => value as ConclusionId;

const ids = {
  spfaDispensing: conclusionId('conclusion_10000000-0000-4000-8000-000000000001'),
  spfaIndication: conclusionId('conclusion_10000000-0000-4000-8000-000000000002'),
  transition: conclusionId('conclusion_10000000-0000-4000-8000-000000000003'),
  incidenceAssessment: conclusionId('conclusion_10000000-0000-4000-8000-000000000004'),
  incidence: conclusionId('conclusion_10000000-0000-4000-8000-000000000005'),
  episode: conclusionId('conclusion_10000000-0000-4000-8000-00000000000e'),
  prmAssessment: conclusionId('conclusion_10000000-0000-4000-8000-000000000006'),
  prmA: conclusionId('conclusion_10000000-0000-4000-8000-000000000007'),
  prmB: conclusionId('conclusion_10000000-0000-4000-8000-000000000008'),
  noRnm: conclusionId('conclusion_10000000-0000-4000-8000-000000000009'),
  rnm: conclusionId('conclusion_10000000-0000-4000-8000-00000000000a'),
  risk: conclusionId('conclusion_10000000-0000-4000-8000-00000000000b'),
  relationA: conclusionId('conclusion_10000000-0000-4000-8000-00000000000c'),
  relationB: conclusionId('conclusion_10000000-0000-4000-8000-00000000000d'),
  adherenceA: conclusionId('conclusion_20000000-0000-4000-8000-000000000001'),
  adherenceB: conclusionId('conclusion_20000000-0000-4000-8000-000000000002'),
  typeB: conclusionId('conclusion_20000000-0000-4000-8000-000000000003'),
  profileB: conclusionId('conclusion_20000000-0000-4000-8000-000000000004'),
  barrierAssessmentB: conclusionId('conclusion_20000000-0000-4000-8000-000000000005'),
  primaryBarrier: conclusionId('conclusion_20000000-0000-4000-8000-000000000006'),
  secondaryBarrier: conclusionId('conclusion_20000000-0000-4000-8000-000000000007'),
  strategy: conclusionId('conclusion_20000000-0000-4000-8000-000000000008'),
  action: conclusionId('conclusion_20000000-0000-4000-8000-000000000009'),
  intervention: conclusionId('conclusion_20000000-0000-4000-8000-00000000000a'),
  referral: conclusionId('conclusion_20000000-0000-4000-8000-00000000000b'),
  missing: conclusionId('conclusion_20000000-0000-4000-8000-000000000099'),
} as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function displayName(
  state: 'known' | 'patient_unknown' | 'explicit_absence',
  valueOrTopic: string,
  suffix: string,
): RuntimePatientDatum<string> {
  const common = {
    factId: `fact_30000000-0000-4000-8000-${suffix}` as FactId,
    disclosure: {
      mode: 'specific_question' as const,
      domains: ['medication_identity' as const],
    },
  };
  return state === 'known'
    ? {
        ...common,
        state,
        value: valueOrTopic,
        certainty: 'exact' as const,
      }
    : { ...common, state, topic: valueOrTopic };
}

function runtimeMedication(
  medicationId: MedicationId,
  label: ReturnType<typeof displayName>,
) {
  return {
    medicationId,
    displayName: label,
    origin: {
      state: 'known',
      factId: 'fact_30000000-0000-4000-8000-000000000010' as FactId,
      value: 'prescribed',
      certainty: 'exact',
      disclosure: { mode: 'spontaneous' },
    },
    specialUseConditions: [],
  };
}

function createRuntime(includeSecondMedication = false): PatientRuntimeViewV2 {
  return {
    schemaVersion: '2.0',
    caseVersionId,
    publicProfile: {
      nombre: 'María',
      edad: 68,
      sexo: 'F',
      tratamiento: 'Texto público que no debe usarse como inventario.',
    },
    initialDemand: {
      state: 'known',
      factId: 'fact_30000000-0000-4000-8000-000000000011' as FactId,
      value: 'Vengo a recoger mi medicación.',
      certainty: 'exact',
      disclosure: { mode: 'spontaneous' },
    },
    encounter: {
      personPresent: {
        state: 'known',
        factId: 'fact_30000000-0000-4000-8000-000000000012' as FactId,
        value: 'patient',
        certainty: 'exact',
        disclosure: { mode: 'spontaneous' },
      },
    },
    clinicalContext: {
      healthProblems: [],
      clinicalHistory: [],
      physiologicalSituation: [],
      allergiesAndIntolerances: [],
      lifestyle: [],
      biomedicalData: [],
    },
    symptoms: [],
    pharmacotherapy: {
      prescribedMedications: [
        runtimeMedication(
          medA,
          displayName('known', 'Enalapril 20 mg', '000000000001'),
        ),
        ...(includeSecondMedication
          ? [
              runtimeMedication(
                medB,
                displayName('known', 'Amlodipino 5 mg', '000000000002'),
              ),
            ]
          : []),
      ],
      otherMedicinesAndProducts: [],
      actualMedicationUse: [],
      recentChanges: [],
      perceivedEffectiveness: [],
      perceivedSafety: [],
    },
    actionsAlreadyTaken: [],
    practicalDifficulties: [],
    beliefsAndConcerns: [],
    strategiesAlreadyTried: [],
    dailyAndSocialContext: [],
    familyAndSocialSupport: [],
    relationshipWithProfessionals: [],
    communicationProfile: {
      sociability: 3,
      cooperation: 3,
      organization: 3,
      emotionalReactivity: 3,
      opennessToChange: 3,
      healthLiteracy: 'medium',
      professionalTrust: 3,
      medicationAttitude: 'neutral',
      decisionStyle: 'shared',
      readinessToChange: 3,
      socialDesirability: 3,
      judgmentSensitivity: 3,
      disclosureThreshold: 3,
      answerLength: 'medium',
      assertiveness: 3,
      emotionalExpression: 3,
    },
  } as PatientRuntimeViewV2;
}

function createEvaluator(): EvaluatorViewV2 {
  return {
    schemaVersion: '2.0',
    caseVersionId,
    versions: {
      evaluatorSchema: { id: 'evaluator', version: '2.0' },
      protocol: { id: 'foro', version: '2024' },
      prmTaxonomy: { id: 'prm', version: '2024' },
      rnmTaxonomy: { id: 'rnm', version: '2024' },
      adherenceFramework: { id: 'adherence', version: '2024' },
    },
    carePath: {
      initialSpfa: {
        conclusionId: ids.spfaDispensing,
        kind: 'spfa',
        value: { service: 'dispensing', subtype: 'initial_treatment' },
      },
      additionalSpfas: [],
      transitions: [],
    },
    incidence: {
      assessment: {
        conclusionId: ids.incidenceAssessment,
        kind: 'incidence_assessment',
        value: { status: 'none' },
      },
      findings: [],
      followUpEpisodes: [],
    },
    prm: {
      assessment: {
        conclusionId: ids.prmAssessment,
        kind: 'prm_assessment',
        value: { status: 'none' },
      },
      findings: [],
    },
    rnmAssessments: [
      {
        conclusionId: ids.noRnm,
        kind: 'rnm_assessment',
        value: { status: 'no_rnm' },
      },
    ],
    prmRnmRelations: [],
    adherence: {
      assessments: [
        {
          conclusionId: ids.adherenceA,
          kind: 'adherence_assessment',
          value: { medicationRefs: [medA], status: 'adherent' },
        },
      ],
      typeConclusions: [],
      patientProfiles: [],
      barrierAssessments: [],
      barriers: [],
      strategies: [],
    },
    professionalActions: [],
    pharmaceuticalInterventions: [],
    referral: {
      conclusionId: ids.referral,
      kind: 'referral',
      value: { status: 'not_required' },
    },
    evidenceRules: [],
  };
}

function addNonAdherentScope(
  evaluator: EvaluatorViewV2,
  options: {
    typeStatus?: 'determined' | 'not_determinable';
    profileStatus?: 'absent' | 'determined' | 'not_determinable';
    barrierStatus?: 'identified' | 'not_determinable';
    secondaryBarrier?: boolean;
  } = {},
): void {
  evaluator.adherence.assessments.push({
    conclusionId: ids.adherenceB,
    kind: 'adherence_assessment',
    value: { medicationRefs: [medB], status: 'non_adherent' },
  });
  evaluator.adherence.typeConclusions.push({
    conclusionId: ids.typeB,
    kind: 'non_adherence_type',
    value:
      options.typeStatus === 'not_determinable'
        ? {
            adherenceAssessmentRef: ids.adherenceB,
            status: 'not_determinable',
          }
        : {
            adherenceAssessmentRef: ids.adherenceB,
            status: 'determined',
            type: 'unintentional',
          },
  });
  if (options.profileStatus !== undefined && options.profileStatus !== 'absent') {
    evaluator.adherence.patientProfiles.push({
      conclusionId: ids.profileB,
      kind: 'adherence_patient_profile',
      value:
        options.profileStatus === 'not_determinable'
          ? {
              adherenceAssessmentRef: ids.adherenceB,
              status: 'not_determinable',
            }
          : {
              adherenceAssessmentRef: ids.adherenceB,
              status: 'determined',
              profile: 'confused',
            },
    });
  }
  const barrierStatus = options.barrierStatus ?? 'identified';
  evaluator.adherence.barrierAssessments.push({
    conclusionId: ids.barrierAssessmentB,
    kind: 'adherence_barrier_assessment',
    value: {
      adherenceAssessmentRef: ids.adherenceB,
      status: barrierStatus,
    },
  });
  if (barrierStatus === 'identified') {
    evaluator.adherence.barriers.push({
      conclusionId: ids.primaryBarrier,
      kind: 'adherence_barrier',
      value: {
        barrierAssessmentRef: ids.barrierAssessmentB,
        role: 'primary',
        category: 'practical',
      },
    });
    if (options.secondaryBarrier) {
      evaluator.adherence.barriers.push({
        conclusionId: ids.secondaryBarrier,
        kind: 'adherence_barrier',
        value: {
          barrierAssessmentRef: ids.barrierAssessmentB,
          role: 'secondary',
          category: 'perception',
        },
      });
    }
  }
}

function addPrmRnmScenario(evaluator: EvaluatorViewV2): void {
  evaluator.prm.assessment.value.status = 'present';
  evaluator.prm.findings = [
    {
      conclusionId: ids.prmB,
      kind: 'prm',
      value: {
        classification: {
          taxonomyId: 'prm',
          taxonomyVersion: '2024',
          conceptId: 'prm-b',
        },
        medicationRefs: [medB],
      },
    },
    {
      conclusionId: ids.prmA,
      kind: 'prm',
      value: {
        classification: {
          taxonomyId: 'prm',
          taxonomyVersion: '2024',
          conceptId: 'prm-a',
        },
        medicationRefs: [medA],
      },
    },
  ];
  evaluator.rnmAssessments = [
    {
      conclusionId: ids.risk,
      kind: 'rnm_assessment',
      value: { status: 'risk_of_rnm', medicationRefs: [medB] },
    },
    {
      conclusionId: ids.rnm,
      kind: 'rnm_assessment',
      value: {
        status: 'rnm',
        classification: {
          taxonomyId: 'rnm',
          taxonomyVersion: '2024',
          conceptId: 'rnm-a',
        },
        medicationRefs: [medA],
      },
    },
  ];
  evaluator.prmRnmRelations = [
    {
      conclusionId: ids.relationA,
      kind: 'prm_rnm_relation',
      value: {
        prmRef: ids.prmA,
        rnmAssessmentRef: ids.rnm,
        relation: 'contributes_to_rnm',
      },
    },
    {
      conclusionId: ids.relationB,
      kind: 'prm_rnm_relation',
      value: {
        prmRef: ids.prmB,
        rnmAssessmentRef: ids.risk,
        relation: 'creates_risk_of_rnm',
      },
    },
  ];
}

function addIndicationTransition(evaluator: EvaluatorViewV2): void {
  evaluator.carePath.additionalSpfas.push({
    conclusionId: ids.spfaIndication,
    kind: 'spfa',
    value: { service: 'pharmaceutical_indication' },
  });
  evaluator.carePath.transitions.push({
    conclusionId: ids.transition,
    kind: 'spfa_transition',
    value: {
      fromSpfaRef: ids.spfaDispensing,
      toSpfaRef: ids.spfaIndication,
    },
  });
}

function requireReferral(evaluator: EvaluatorViewV2): void {
  evaluator.referral = {
    conclusionId: ids.referral,
    kind: 'referral',
    value: {
      status: 'required',
      urgency: 'urgent',
      destination: { label: 'Médico de atención primaria' },
      reason: 'Requiere valoración clínica.',
      report: {
        status: 'appropriate',
        essentialContents: ['Tratamiento actual', 'Motivo de derivación'],
      },
    },
  };
}

function nonAdherentSummary(summary: ReturnType<typeof buildTeachingCaseSummaryV2>) {
  return summary.adherence.assessments.find(
    (assessment) => assessment.status === 'non_adherent',
  );
}

describe('TeachingCaseSummaryV2 scenarios A-J', () => {
  it('A: proyecta un caso adherente sin PRM ni RNM', () => {
    const summary = buildTeachingCaseSummaryV2(createRuntime(), createEvaluator());
    expect(summary.prm).toEqual({ status: 'none', count: 0, findings: [] });
    expect(summary.rnm).toEqual({
      status: 'no_rnm',
      rnmCount: 0,
      riskOfRnmCount: 0,
      findings: [],
    });
    expect(summary.adherence.assessments[0].status).toBe('adherent');
  });

  it('B: conserva scopes independientes adherent y non_adherent', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator);
    const summary = buildTeachingCaseSummaryV2(createRuntime(true), evaluator);
    expect(summary.adherence.assessments.map((item) => item.status).sort()).toEqual([
      'adherent',
      'non_adherent',
    ]);
    expect(nonAdherentSummary(summary)?.medicationScope.medications[0].medicationId).toBe(
      medB,
    );
  });

  it('C: conserva type not_determinable', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, { typeStatus: 'not_determinable' });
    const assessment = nonAdherentSummary(
      buildTeachingCaseSummaryV2(createRuntime(true), evaluator),
    );
    expect(assessment?.nonAdherence.type).toEqual({ status: 'not_determinable' });
  });

  it('D1: distingue profile absent', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, { profileStatus: 'absent' });
    expect(
      nonAdherentSummary(buildTeachingCaseSummaryV2(createRuntime(true), evaluator))
        ?.nonAdherence.patientProfile,
    ).toEqual({ status: 'absent' });
  });

  it('D2: distingue profile not_determinable', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, { profileStatus: 'not_determinable' });
    expect(
      nonAdherentSummary(buildTeachingCaseSummaryV2(createRuntime(true), evaluator))
        ?.nonAdherence.patientProfile,
    ).toEqual({ status: 'not_determinable' });
  });

  it('E1: proyecta barreras identified con primaria y secundarias', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, { secondaryBarrier: true });
    const barriers = nonAdherentSummary(
      buildTeachingCaseSummaryV2(createRuntime(true), evaluator),
    )?.nonAdherence.barriers;
    expect(barriers).toMatchObject({ status: 'identified' });
    if (barriers?.status === 'identified') {
      expect(barriers.primary.role).toBe('primary');
      expect(barriers.secondary).toHaveLength(1);
    }
  });

  it('E2: conserva barriers not_determinable sin sintetizar barreras', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, { barrierStatus: 'not_determinable' });
    expect(
      nonAdherentSummary(buildTeachingCaseSummaryV2(createRuntime(true), evaluator))
        ?.nonAdherence.barriers,
    ).toEqual({ status: 'not_determinable' });
  });

  it('F: proyecta dos PRM, un RNM y un riesgo sin copiar relaciones', () => {
    const evaluator = createEvaluator();
    addPrmRnmScenario(evaluator);
    const summary = buildTeachingCaseSummaryV2(createRuntime(true), evaluator);
    expect(summary.prm.count).toBe(2);
    expect(summary.rnm).toMatchObject({
      status: 'rnm_and_risk_of_rnm',
      rnmCount: 1,
      riskOfRnmCount: 1,
    });
    expect(JSON.stringify(summary)).not.toContain('prmRnmRelations');
    expect(JSON.stringify(summary)).not.toContain('contributes_to_rnm');
  });

  it('G: proyecta una estrategia combined y solo sus barreras referenciadas', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, { secondaryBarrier: true });
    evaluator.adherence.strategies.push({
      conclusionId: ids.strategy,
      kind: 'adherence_strategy',
      value: {
        adherenceAssessmentRef: ids.adherenceB,
        category: 'combined',
        componentCategories: ['educational', 'behavioral'],
        addressedBarrierRefs: [ids.secondaryBarrier],
      },
    });
    const strategy = buildTeachingCaseSummaryV2(createRuntime(true), evaluator)
      .adherence.strategies[0];
    expect(strategy).toMatchObject({
      category: 'combined',
      componentCategories: ['behavioral', 'educational'],
    });
    expect(strategy.addressedBarriers).toEqual([
      { role: 'secondary', category: 'perception' },
    ]);
  });

  it('H: proyecta Actuación other_spfa con target semántico', () => {
    const evaluator = createEvaluator();
    addIndicationTransition(evaluator);
    evaluator.professionalActions.push({
      conclusionId: ids.action,
      kind: 'professional_action',
      value: {
        spfaRef: ids.spfaDispensing,
        category: 'other_spfa',
        targetSpfaRef: ids.spfaIndication,
      },
    });
    expect(buildTeachingCaseSummaryV2(createRuntime(), evaluator).professionalActions[0]).toMatchObject({
      spfa: { service: 'dispensing' },
      category: 'other_spfa',
      targetSpfa: { service: 'pharmaceutical_indication' },
      referralInvolvement: false,
    });
  });

  it('I: proyecta una Intervención sin Actuación', () => {
    const evaluator = createEvaluator();
    evaluator.pharmaceuticalInterventions.push({
      conclusionId: ids.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: ids.spfaDispensing,
        target: 'conditions_of_use',
        addressedConclusionRefs: [ids.adherenceA],
      },
    });
    const intervention = buildTeachingCaseSummaryV2(createRuntime(), evaluator)
      .pharmaceuticalInterventions[0];
    expect(intervention).not.toHaveProperty('relatedProfessionalActionCategory');
    expect(intervention.directReferralInvolvement).toBe(false);
  });

  it('J: conserva referencias directas compartidas a Referral required', () => {
    const evaluator = createEvaluator();
    requireReferral(evaluator);
    evaluator.professionalActions.push({
      conclusionId: ids.action,
      kind: 'professional_action',
      value: {
        spfaRef: ids.spfaDispensing,
        category: 'referral',
        referralRef: ids.referral,
      },
    });
    evaluator.pharmaceuticalInterventions.push({
      conclusionId: ids.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: ids.spfaDispensing,
        professionalActionRef: ids.action,
        target: 'patient_state_or_situation',
        addressedConclusionRefs: [ids.adherenceA],
        referralRef: ids.referral,
      },
    });
    const summary = buildTeachingCaseSummaryV2(createRuntime(), evaluator);
    expect(summary.professionalActions[0].referralInvolvement).toBe(true);
    expect(summary.pharmaceuticalInterventions[0]).toMatchObject({
      relatedProfessionalActionCategory: 'referral',
      directReferralInvolvement: true,
    });
  });
});

describe('TeachingCaseSummaryV2 medication projection and fail-closed behavior', () => {
  it('rechaza caseVersionId distintos', () => {
    const evaluator = createEvaluator();
    evaluator.caseVersionId = otherCaseVersionId;
    expect(() => buildTeachingCaseSummaryV2(createRuntime(), evaluator)).toThrow(
      /versions must match/,
    );
  });

  it('proyecta displayName known sin FactId ni disclosure', () => {
    const medication = buildTeachingCaseSummaryV2(createRuntime(), createEvaluator())
      .medications[0];
    expect(medication).toEqual({
      medicationId: medA,
      displayLabel: {
        state: 'known',
        value: 'Enalapril 20 mg',
        certainty: 'exact',
      },
    });
    expect(medication).not.toHaveProperty('factId');
    expect(JSON.stringify(medication)).not.toContain('disclosure');
  });

  it.each([
    ['patient_unknown', 'nombre del medicamento'] as const,
    ['explicit_absence', 'nombre visible en el envase'] as const,
  ])('conserva displayName %s', (state, topic) => {
    const runtime = createRuntime();
    runtime.pharmacotherapy.prescribedMedications[0].displayName = displayName(
      state,
      topic,
      '000000000003',
    );
    expect(
      buildTeachingCaseSummaryV2(runtime, createEvaluator()).medications[0]
        .displayLabel,
    ).toEqual({ state, topic });
  });

  it('rechaza MedicationId referenciado inexistente', () => {
    const evaluator = createEvaluator();
    evaluator.adherence.assessments[0].value.medicationRefs = [medB];
    expect(() => buildTeachingCaseSummaryV2(createRuntime(), evaluator)).toThrow(
      /unknown medication reference/,
    );
  });

  it('rechaza addressedConclusionRef inexistente con error específico', () => {
    const evaluator = createEvaluator();
    evaluator.pharmaceuticalInterventions.push({
      conclusionId: ids.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: ids.spfaDispensing,
        target: 'treatment',
        addressedConclusionRefs: [ids.missing],
      },
    });
    expect(() => buildTeachingCaseSummaryV2(createRuntime(), evaluator)).toThrow(
      TeachingCaseSummaryBuildError,
    );
    expect(() => buildTeachingCaseSummaryV2(createRuntime(), evaluator)).toThrow(
      /unknown addressed conclusion reference/,
    );
  });

  it('rechaza una referencia SPFA rota', () => {
    const evaluator = createEvaluator();
    evaluator.carePath.transitions.push({
      conclusionId: ids.transition,
      kind: 'spfa_transition',
      value: { fromSpfaRef: ids.spfaDispensing, toSpfaRef: ids.missing },
    });
    expect(() => buildTeachingCaseSummaryV2(createRuntime(), evaluator)).toThrow(
      /unknown SPFA reference/,
    );
  });

  it.each([
    ['type', (evaluator: EvaluatorViewV2) => {
      evaluator.adherence.typeConclusions[0].value.adherenceAssessmentRef = ids.missing;
    }],
    ['profile', (evaluator: EvaluatorViewV2) => {
      evaluator.adherence.patientProfiles[0].value.adherenceAssessmentRef = ids.missing;
    }],
    ['barrier assessment', (evaluator: EvaluatorViewV2) => {
      evaluator.adherence.barrierAssessments[0].value.adherenceAssessmentRef =
        ids.missing;
    }],
    ['barrier', (evaluator: EvaluatorViewV2) => {
      evaluator.adherence.barriers[0].value.barrierAssessmentRef = ids.missing;
    }],
  ] as const)('rechaza referencia rota de %s', (_label, corrupt) => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, {
      profileStatus: 'not_determinable',
    });
    corrupt(evaluator);
    expect(() => buildTeachingCaseSummaryV2(createRuntime(true), evaluator)).toThrow(
      /unknown .* reference/,
    );
  });

  it('rechaza una strategy con adherenceAssessmentRef roto', () => {
    const evaluator = createEvaluator();
    evaluator.adherence.strategies.push({
      conclusionId: ids.strategy,
      kind: 'adherence_strategy',
      value: {
        adherenceAssessmentRef: ids.missing,
        category: 'behavioral',
        addressedBarrierRefs: [],
      },
    });
    expect(() => buildTeachingCaseSummaryV2(createRuntime(), evaluator)).toThrow(
      /unknown adherence assessment reference/,
    );
  });

  it('rechaza professionalActionRef roto', () => {
    const evaluator = createEvaluator();
    evaluator.pharmaceuticalInterventions.push({
      conclusionId: ids.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: ids.spfaDispensing,
        professionalActionRef: ids.missing,
        target: 'treatment',
        addressedConclusionRefs: [ids.adherenceA],
      },
    });
    expect(() => buildTeachingCaseSummaryV2(createRuntime(), evaluator)).toThrow(
      /unknown professional action reference/,
    );
  });

  it('rechaza referralRef inconsistente', () => {
    const evaluator = createEvaluator();
    evaluator.professionalActions.push({
      conclusionId: ids.action,
      kind: 'professional_action',
      value: {
        spfaRef: ids.spfaDispensing,
        category: 'referral',
        referralRef: ids.missing,
      },
    });
    expect(() => buildTeachingCaseSummaryV2(createRuntime(), evaluator)).toThrow(
      /required evaluator referral/,
    );
  });

  it('conserva addressedBarrierRefs vacío sin inferir barreras', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator);
    evaluator.adherence.strategies.push({
      conclusionId: ids.strategy,
      kind: 'adherence_strategy',
      value: {
        adherenceAssessmentRef: ids.adherenceB,
        category: 'behavioral',
        addressedBarrierRefs: [],
      },
    });
    expect(
      buildTeachingCaseSummaryV2(createRuntime(true), evaluator).adherence
        .strategies[0].addressedBarriers,
    ).toEqual([]);
  });

  it('resuelve professionalActionRef a su categoría', () => {
    const evaluator = createEvaluator();
    evaluator.professionalActions.push({
      conclusionId: ids.action,
      kind: 'professional_action',
      value: { spfaRef: ids.spfaDispensing, category: 'dispense' },
    });
    evaluator.pharmaceuticalInterventions.push({
      conclusionId: ids.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: ids.spfaDispensing,
        professionalActionRef: ids.action,
        target: 'conditions_of_use',
        addressedConclusionRefs: [ids.adherenceA],
      },
    });
    expect(
      buildTeachingCaseSummaryV2(createRuntime(), evaluator)
        .pharmaceuticalInterventions[0].relatedProfessionalActionCategory,
    ).toBe('dispense');
  });

  it('no marca referral directo por una Actuación referral relacionada', () => {
    const evaluator = createEvaluator();
    requireReferral(evaluator);
    evaluator.professionalActions.push({
      conclusionId: ids.action,
      kind: 'professional_action',
      value: {
        spfaRef: ids.spfaDispensing,
        category: 'referral',
        referralRef: ids.referral,
      },
    });
    evaluator.pharmaceuticalInterventions.push({
      conclusionId: ids.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: ids.spfaDispensing,
        professionalActionRef: ids.action,
        target: 'patient_state_or_situation',
        addressedConclusionRefs: [ids.adherenceA],
      },
    });
    expect(
      buildTeachingCaseSummaryV2(createRuntime(), evaluator)
        .pharmaceuticalInterventions[0],
    ).toMatchObject({
      relatedProfessionalActionCategory: 'referral',
      directReferralInvolvement: false,
    });
  });

  it('conserva report appropriate y canoniza essentialContents', () => {
    const evaluator = createEvaluator();
    requireReferral(evaluator);
    expect(buildTeachingCaseSummaryV2(createRuntime(), evaluator).referral).toMatchObject({
      status: 'required',
      report: {
        status: 'appropriate',
        essentialContents: ['Motivo de derivación', 'Tratamiento actual'],
      },
    });
  });

  it('canoniza strings NFKC-equivalentes conservando sus representaciones originales', () => {
    const buildWithContents = (
      essentialContents: [string, ...string[]],
    ) => {
      const evaluator = createEvaluator();
      requireReferral(evaluator);
      if (evaluator.referral.value.status !== 'required') {
        throw new Error('Expected required referral fixture');
      }
      evaluator.referral.value.report = {
        status: 'appropriate',
        essentialContents,
      };
      return buildTeachingCaseSummaryV2(createRuntime(), evaluator).referral;
    };

    const first = buildWithContents(['①', '1']);
    const second = buildWithContents(['1', '①']);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      report: { essentialContents: ['1', '①'] },
    });
  });

  it.each([
    ['not_required', []],
    ['required', ['Contenido esencial']],
  ] as const)('conserva report %s', (status, essentialContents) => {
    const evaluator = createEvaluator();
    requireReferral(evaluator);
    if (evaluator.referral.value.status !== 'required') {
      throw new Error('Expected required referral fixture');
    }
    evaluator.referral.value.report =
      status === 'not_required'
        ? { status, essentialContents: [] }
        : { status, essentialContents: [...essentialContents] };
    expect(buildTeachingCaseSummaryV2(createRuntime(), evaluator).referral).toMatchObject({
      report: { status, essentialContents: [...essentialContents] },
    });
  });

  it('proyecta todos los addressedConclusionRef permitidos semánticamente', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator);
    addPrmRnmScenario(evaluator);
    evaluator.incidence.assessment.value.status = 'present';
    evaluator.incidence.findings.push({
      conclusionId: ids.incidence,
      kind: 'incidence',
      value: {
        spfaRef: ids.spfaDispensing,
        medicationRefs: [medA],
        semanticMeaning: 'Incidencia detectada durante la dispensación.',
      },
    });
    evaluator.incidence.followUpEpisodes.push({
      conclusionId: ids.episode,
      kind: 'follow_up_episode',
      value: { incidenceRef: ids.incidence },
    });
    evaluator.pharmaceuticalInterventions.push({
      conclusionId: ids.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: ids.spfaDispensing,
        target: 'patient_state_or_situation',
        addressedConclusionRefs: [
          ids.rnm,
          ids.primaryBarrier,
          ids.prmA,
          ids.typeB,
          ids.incidence,
          ids.adherenceB,
        ],
      },
    });
    const summary = buildTeachingCaseSummaryV2(createRuntime(true), evaluator);
    expect(summary.incidence).toMatchObject({ status: 'present', count: 1 });
    expect(
      summary.pharmaceuticalInterventions[0].addressedConclusions.map(
        (conclusion) => conclusion.kind,
      ),
    ).toEqual([
      'adherence_assessment',
      'adherence_barrier',
      'incidence',
      'non_adherence_type',
      'prm',
      'rnm_assessment',
    ]);
    expect(JSON.stringify(summary.pharmaceuticalInterventions[0])).not.toContain(
      'conclusion_',
    );
  });
});

describe('TeachingCaseSummaryV2 metrics, purity and canonicalization', () => {
  it('conserva incidence y PRM not_determinable sin findings', () => {
    const evaluator = createEvaluator();
    evaluator.incidence.assessment.value.status = 'not_determinable';
    evaluator.prm.assessment.value.status = 'not_determinable';
    const summary = buildTeachingCaseSummaryV2(createRuntime(), evaluator);
    expect(summary.incidence).toEqual({
      status: 'not_determinable',
      count: 0,
      findings: [],
    });
    expect(summary.prm).toEqual({
      status: 'not_determinable',
      count: 0,
      findings: [],
    });
  });

  it.each(['rnm', 'risk_of_rnm'] as const)(
    'calcula el estado RNM simple %s',
    (outcome) => {
      const evaluator = createEvaluator();
      if (outcome === 'risk_of_rnm') {
        evaluator.prm.assessment.value.status = 'present';
        evaluator.prm.findings = [
          {
            conclusionId: ids.prmA,
            kind: 'prm',
            value: {
              classification: {
                taxonomyId: 'prm',
                taxonomyVersion: '2024',
                conceptId: 'prm-a',
              },
              medicationRefs: [medA],
            },
          },
        ];
        evaluator.prmRnmRelations = [
          {
            conclusionId: ids.relationA,
            kind: 'prm_rnm_relation',
            value: {
              prmRef: ids.prmA,
              rnmAssessmentRef: ids.risk,
              relation: 'creates_risk_of_rnm',
            },
          },
        ];
      }
      evaluator.rnmAssessments = [
        outcome === 'rnm'
          ? {
              conclusionId: ids.rnm,
              kind: 'rnm_assessment',
              value: {
                status: 'rnm',
                classification: {
                  taxonomyId: 'rnm',
                  taxonomyVersion: '2024',
                  conceptId: 'rnm-a',
                },
                medicationRefs: [medA],
              },
            }
          : {
              conclusionId: ids.risk,
              kind: 'rnm_assessment',
              value: { status: 'risk_of_rnm', medicationRefs: [medA] },
            },
      ];
      expect(buildTeachingCaseSummaryV2(createRuntime(), evaluator).rnm.status).toBe(
        outcome,
      );
    },
  );

  it('calcula únicamente counts objetivos exactos', () => {
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, { secondaryBarrier: true });
    addPrmRnmScenario(evaluator);
    addIndicationTransition(evaluator);
    const summary = buildTeachingCaseSummaryV2(createRuntime(true), evaluator);
    const metrics = summary.objectiveMetrics;
    const projectedBarrierCount = summary.adherence.assessments.reduce(
      (count, assessment) =>
        assessment.status === 'non_adherent' &&
        assessment.nonAdherence.barriers.status === 'identified'
          ? count + 1 + assessment.nonAdherence.barriers.secondary.length
          : count,
      0,
    );
    expect(metrics).toEqual({
      numberOfMedications: summary.medications.length,
      numberOfSpfas: 1 + summary.carePath.additionalSpfas.length,
      numberOfIncidences: summary.incidence.count,
      numberOfPrms: summary.prm.count,
      numberOfRnms: summary.rnm.rnmCount,
      numberOfRnmRisks: summary.rnm.riskOfRnmCount,
      numberOfAdherenceScopes: summary.adherence.assessments.length,
      numberOfBarriers: projectedBarrierCount,
    });
    expect(metrics).toEqual({
      numberOfMedications: 2,
      numberOfSpfas: 2,
      numberOfIncidences: 0,
      numberOfPrms: 2,
      numberOfRnms: 1,
      numberOfRnmRisks: 1,
      numberOfAdherenceScopes: 2,
      numberOfBarriers: 2,
    });
    expect(metrics).not.toHaveProperty('complexity');
  });

  it('desempata objetos NFKC-equivalentes por su representación Unicode original', () => {
    const incidenceCircled = conclusionId(
      'conclusion_40000000-0000-4000-8000-000000000001',
    );
    const incidenceAscii = conclusionId(
      'conclusion_40000000-0000-4000-8000-000000000002',
    );
    const episodeCircled = conclusionId(
      'conclusion_40000000-0000-4000-8000-000000000003',
    );
    const episodeAscii = conclusionId(
      'conclusion_40000000-0000-4000-8000-000000000004',
    );

    const buildWithOrder = (circledFirst: boolean) => {
      const evaluator = createEvaluator();
      evaluator.incidence.assessment.value.status = 'present';
      const circled = {
        conclusionId: incidenceCircled,
        kind: 'incidence' as const,
        value: {
          spfaRef: ids.spfaDispensing,
          medicationRefs: [medA],
          semanticMeaning: '①',
        },
      };
      const ascii = {
        conclusionId: incidenceAscii,
        kind: 'incidence' as const,
        value: {
          spfaRef: ids.spfaDispensing,
          medicationRefs: [medA],
          semanticMeaning: '1',
        },
      };
      evaluator.incidence.findings = circledFirst
        ? [circled, ascii]
        : [ascii, circled];
      evaluator.incidence.followUpEpisodes = [
        {
          conclusionId: episodeCircled,
          kind: 'follow_up_episode',
          value: { incidenceRef: incidenceCircled },
        },
        {
          conclusionId: episodeAscii,
          kind: 'follow_up_episode',
          value: { incidenceRef: incidenceAscii },
        },
      ];
      return buildTeachingCaseSummaryV2(createRuntime(), evaluator);
    };

    const first = buildWithOrder(true);
    const second = buildWithOrder(false);
    expect(first).toEqual(second);
    expect(first.incidence.findings.map((finding) => finding.semanticMeaning)).toEqual([
      '1',
      '①',
    ]);
  });

  it('no muta ninguno de los inputs', () => {
    const runtime = createRuntime(true);
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, { secondaryBarrier: true });
    addPrmRnmScenario(evaluator);
    const runtimeBefore = JSON.stringify(runtime);
    const evaluatorBefore = JSON.stringify(evaluator);
    buildTeachingCaseSummaryV2(runtime, evaluator);
    expect(JSON.stringify(runtime)).toBe(runtimeBefore);
    expect(JSON.stringify(evaluator)).toBe(evaluatorBefore);
  });

  it('produce deepEqual con colecciones semánticas reordenadas', () => {
    const runtime = createRuntime(true);
    const evaluator = createEvaluator();
    addNonAdherentScope(evaluator, { secondaryBarrier: true });
    addPrmRnmScenario(evaluator);
    addIndicationTransition(evaluator);
    evaluator.adherence.strategies.push({
      conclusionId: ids.strategy,
      kind: 'adherence_strategy',
      value: {
        adherenceAssessmentRef: ids.adherenceB,
        category: 'combined',
        componentCategories: ['educational', 'technical'],
        addressedBarrierRefs: [ids.secondaryBarrier, ids.primaryBarrier],
      },
    });

    const shuffledRuntime = clone(runtime);
    shuffledRuntime.pharmacotherapy.prescribedMedications.reverse();
    const shuffledEvaluator = clone(evaluator);
    shuffledEvaluator.prm.findings.reverse();
    shuffledEvaluator.rnmAssessments.reverse();
    shuffledEvaluator.adherence.assessments.reverse();
    shuffledEvaluator.adherence.barriers.reverse();
    const shuffledStrategy = shuffledEvaluator.adherence.strategies[0];
    if (shuffledStrategy.value.category !== 'combined') {
      throw new Error('Expected combined strategy fixture');
    }
    (
      shuffledStrategy.value.componentCategories as unknown as string[]
    ).reverse();
    shuffledEvaluator.adherence.strategies[0].value.addressedBarrierRefs.reverse();

    expect(
      buildTeachingCaseSummaryV2(shuffledRuntime, shuffledEvaluator),
    ).toEqual(buildTeachingCaseSummaryV2(runtime, evaluator));
  });

  it('no incluye identificadores o capas deliberadamente excluidas', () => {
    const evaluator = createEvaluator();
    addPrmRnmScenario(evaluator);
    const serialized = JSON.stringify(
      buildTeachingCaseSummaryV2(createRuntime(true), evaluator),
    );
    for (const forbidden of [
      'conclusionId',
      'factId',
      'disclosure',
      'evidenceRules',
      'teacherRationale',
      'followUpEpisode',
      'prmRnmRelations',
      'briefId',
      'complexity',
      'patientInstruction',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
