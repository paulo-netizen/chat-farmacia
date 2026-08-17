import { describe, expect, it } from 'vitest';
import type { PatientRuntimeViewV2 } from '@/lib/cases/v2/types';
import {
  findPatientUnknownOnlyEvidenceFlags,
  validateEvaluatorViewV2,
} from '@/lib/cases/v2/validate-evaluator-view';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const caseVersionId = 'casever_90000000-0000-4000-8000-000000000001';
const otherCaseVersionId = 'casever_90000000-0000-4000-8000-000000000002';
const medicationId = 'med_10000000-0000-4000-8000-000000000001';
const medicationIdB = 'med_10000000-0000-4000-8000-000000000002';

const factIds = {
  a: 'fact_00000000-0000-4000-8000-000000000001',
  b: 'fact_00000000-0000-4000-8000-000000000002',
  c: 'fact_00000000-0000-4000-8000-000000000003',
  d: 'fact_00000000-0000-4000-8000-000000000004',
  unknown: 'fact_00000000-0000-4000-8000-000000000005',
  missing: 'fact_00000000-0000-4000-8000-000000000099',
} as const;

const conclusionIds = {
  initialSpfa: 'conclusion_10000000-0000-4000-8000-000000000001',
  additionalSpfa: 'conclusion_10000000-0000-4000-8000-000000000002',
  transition: 'conclusion_10000000-0000-4000-8000-000000000003',
  incidenceAssessment: 'conclusion_10000000-0000-4000-8000-000000000004',
  incidence: 'conclusion_10000000-0000-4000-8000-000000000005',
  episode: 'conclusion_10000000-0000-4000-8000-000000000006',
  prmAssessment: 'conclusion_10000000-0000-4000-8000-000000000007',
  prmA: 'conclusion_10000000-0000-4000-8000-000000000008',
  prmB: 'conclusion_10000000-0000-4000-8000-000000000009',
  rnm: 'conclusion_10000000-0000-4000-8000-00000000000a',
  risk: 'conclusion_10000000-0000-4000-8000-00000000000b',
  relationA: 'conclusion_10000000-0000-4000-8000-00000000000c',
  relationB: 'conclusion_10000000-0000-4000-8000-00000000000d',
  relationC: 'conclusion_10000000-0000-4000-8000-00000000000e',
  relationD: 'conclusion_10000000-0000-4000-8000-00000000000f',
  noRnm: 'conclusion_10000000-0000-4000-8000-000000000010',
  adherenceA: 'conclusion_20000000-0000-4000-8000-000000000001',
  adherenceB: 'conclusion_20000000-0000-4000-8000-000000000002',
  adherenceTypeA: 'conclusion_20000000-0000-4000-8000-000000000003',
  adherenceTypeB: 'conclusion_20000000-0000-4000-8000-000000000004',
  adherenceProfile: 'conclusion_20000000-0000-4000-8000-000000000005',
  barrierAssessmentA: 'conclusion_20000000-0000-4000-8000-000000000006',
  barrierAssessmentB: 'conclusion_20000000-0000-4000-8000-000000000007',
  primaryBarrier: 'conclusion_20000000-0000-4000-8000-000000000008',
  secondaryBarrier: 'conclusion_20000000-0000-4000-8000-000000000009',
  otherBarrier: 'conclusion_20000000-0000-4000-8000-00000000000a',
  strategy: 'conclusion_20000000-0000-4000-8000-00000000000b',
  action: 'conclusion_20000000-0000-4000-8000-00000000000c',
  intervention: 'conclusion_20000000-0000-4000-8000-00000000000d',
  referral: 'conclusion_20000000-0000-4000-8000-00000000000e',
  missing: 'conclusion_10000000-0000-4000-8000-000000000099',
} as const;

function knownFact(factId: string, value: string) {
  return {
    state: 'known',
    factId,
    value,
    certainty: 'exact',
    disclosure: { mode: 'spontaneous' },
  };
}

function createRuntime(): PatientRuntimeViewV2 {
  return {
    schemaVersion: '2.0',
    caseVersionId: validateCaseVersionId(caseVersionId),
    publicProfile: {
      nombre: 'María',
      edad: 67,
      sexo: 'F',
      tratamiento: 'Enalapril 20 mg cada 24 horas',
    },
    initialDemand: knownFact(factIds.a, 'Vengo a recoger mi medicación.'),
    encounter: {
      personPresent: knownFact(factIds.b, 'patient'),
    },
    clinicalContext: {
      healthProblems: [knownFact(factIds.c, 'Hipertensión conocida.')],
      clinicalHistory: [],
      physiologicalSituation: [],
      allergiesAndIntolerances: [],
      lifestyle: [],
      biomedicalData: [],
    },
    symptoms: [
      {
        description: knownFact(factIds.d, 'Cefalea persistente.'),
        relevantCircumstances: [],
      },
    ],
    pharmacotherapy: {
      prescribedMedications: [
        {
          medicationId,
          displayName: knownFact(factIds.unknown, 'Enalapril 20 mg'),
          origin: knownFact(
            'fact_00000000-0000-4000-8000-000000000006',
            'prescribed',
          ),
          specialUseConditions: [],
        },
        {
          medicationId: medicationIdB,
          displayName: knownFact(
            'fact_00000000-0000-4000-8000-000000000007',
            'Amlodipino 5 mg',
          ),
          origin: knownFact(
            'fact_00000000-0000-4000-8000-000000000008',
            'prescribed',
          ),
          specialUseConditions: [],
        },
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
  } as unknown as PatientRuntimeViewV2;
}

function collectConclusions(source: Record<string, any>): Record<string, any>[] {
  return [
    source.carePath.initialSpfa,
    ...source.carePath.additionalSpfas,
    ...source.carePath.transitions,
    source.incidence.assessment,
    ...source.incidence.findings,
    ...source.incidence.followUpEpisodes,
    source.prm.assessment,
    ...source.prm.findings,
    ...source.rnmAssessments,
    ...source.prmRnmRelations,
    ...source.adherence.assessments,
    ...source.adherence.typeConclusions,
    ...source.adherence.patientProfiles,
    ...source.adherence.barrierAssessments,
    ...source.adherence.barriers,
    ...source.adherence.strategies,
    ...source.professionalActions,
    ...source.pharmaceuticalInterventions,
    source.referral,
  ];
}

function synchronizeEvidenceRules(source: Record<string, any>): void {
  const evidenceKinds = new Set([
    'incidence_assessment',
    'incidence',
    'prm_assessment',
    'prm',
    'rnm_assessment',
    'adherence_assessment',
    'non_adherence_type',
    'adherence_patient_profile',
    'adherence_barrier_assessment',
    'adherence_barrier',
    'adherence_strategy',
    'professional_action',
    'pharmaceutical_intervention',
    'referral',
  ]);
  source.evidenceRules = collectConclusions(source)
    .filter((conclusion) => evidenceKinds.has(conclusion.kind))
    .map((conclusion) => ({
      conclusionRef: conclusion.conclusionId,
      requiredEvidence: { operator: 'fact', factRef: factIds.a },
      supportingEvidenceRefs: [],
      counterEvidenceRefs: [],
      teacherRationale: 'Los hechos del caso sustentan esta conclusión docente.',
    }));
}

function createEvaluator(): Record<string, any> {
  const source: Record<string, any> = {
    schemaVersion: '2.0',
    caseVersionId,
    versions: {
      evaluatorSchema: { id: 'evaluator-view', version: '2.0' },
      protocol: { id: 'foro-af-fc', version: '2024' },
      prmTaxonomy: { id: 'foro-prm', version: '2024' },
      rnmTaxonomy: { id: 'foro-rnm', version: '2024' },
      adherenceFramework: { id: 'foro-adherence', version: '2024' },
    },
    carePath: {
      initialSpfa: {
        conclusionId: conclusionIds.initialSpfa,
        kind: 'spfa',
        value: { service: 'dispensing', subtype: 'initial_treatment' },
      },
      additionalSpfas: [
        {
          conclusionId: conclusionIds.additionalSpfa,
          kind: 'spfa',
          value: { service: 'pharmaceutical_indication' },
        },
      ],
      transitions: [
        {
          conclusionId: conclusionIds.transition,
          kind: 'spfa_transition',
          value: {
            fromSpfaRef: conclusionIds.initialSpfa,
            toSpfaRef: conclusionIds.additionalSpfa,
          },
        },
      ],
    },
    incidence: {
      assessment: {
        conclusionId: conclusionIds.incidenceAssessment,
        kind: 'incidence_assessment',
        value: { status: 'present' },
      },
      findings: [
        {
          conclusionId: conclusionIds.incidence,
          kind: 'incidence',
          value: {
            spfaRef: conclusionIds.initialSpfa,
            medicationRefs: [medicationId],
            semanticMeaning: 'Resultado no esperado que requiere evaluación.',
          },
        },
      ],
      followUpEpisodes: [
        {
          conclusionId: conclusionIds.episode,
          kind: 'follow_up_episode',
          value: { incidenceRef: conclusionIds.incidence },
        },
      ],
    },
    prm: {
      assessment: {
        conclusionId: conclusionIds.prmAssessment,
        kind: 'prm_assessment',
        value: { status: 'present' },
      },
      findings: [
        {
          conclusionId: conclusionIds.prmA,
          kind: 'prm',
          value: {
            classification: {
              taxonomyId: 'foro-prm',
              taxonomyVersion: '2024',
              conceptId: 'prm-a',
            },
            medicationRefs: [medicationId],
            followUpEpisodeRef: conclusionIds.episode,
          },
        },
        {
          conclusionId: conclusionIds.prmB,
          kind: 'prm',
          value: {
            classification: {
              taxonomyId: 'foro-prm',
              taxonomyVersion: '2024',
              conceptId: 'prm-b',
            },
            medicationRefs: [medicationId],
            followUpEpisodeRef: conclusionIds.episode,
          },
        },
      ],
    },
    rnmAssessments: [
      {
        conclusionId: conclusionIds.rnm,
        kind: 'rnm_assessment',
        value: {
          status: 'rnm',
          classification: {
            taxonomyId: 'foro-rnm',
            taxonomyVersion: '2024',
            conceptId: 'rnm-a',
          },
          medicationRefs: [medicationId],
          followUpEpisodeRef: conclusionIds.episode,
        },
      },
      {
        conclusionId: conclusionIds.risk,
        kind: 'rnm_assessment',
        value: {
          status: 'risk_of_rnm',
          medicationRefs: [medicationId],
          followUpEpisodeRef: conclusionIds.episode,
        },
      },
    ],
    prmRnmRelations: [
      {
        conclusionId: conclusionIds.relationA,
        kind: 'prm_rnm_relation',
        value: {
          prmRef: conclusionIds.prmA,
          rnmAssessmentRef: conclusionIds.rnm,
          relation: 'contributes_to_rnm',
        },
      },
      {
        conclusionId: conclusionIds.relationB,
        kind: 'prm_rnm_relation',
        value: {
          prmRef: conclusionIds.prmA,
          rnmAssessmentRef: conclusionIds.risk,
          relation: 'creates_risk_of_rnm',
        },
      },
      {
        conclusionId: conclusionIds.relationC,
        kind: 'prm_rnm_relation',
        value: {
          prmRef: conclusionIds.prmB,
          rnmAssessmentRef: conclusionIds.rnm,
          relation: 'contributes_to_rnm',
        },
      },
      {
        conclusionId: conclusionIds.relationD,
        kind: 'prm_rnm_relation',
        value: {
          prmRef: conclusionIds.prmB,
          rnmAssessmentRef: conclusionIds.risk,
          relation: 'creates_risk_of_rnm',
        },
      },
    ],
    adherence: {
      assessments: [],
      typeConclusions: [],
      patientProfiles: [],
      barrierAssessments: [],
      barriers: [],
      strategies: [],
    },
    professionalActions: [],
    pharmaceuticalInterventions: [],
    referral: {
      conclusionId: conclusionIds.referral,
      kind: 'referral',
      value: { status: 'not_required' },
    },
    evidenceRules: [],
  };
  synchronizeEvidenceRules(source);
  return source;
}

function validate(source = createEvaluator()) {
  return validateEvaluatorViewV2(source, createRuntime());
}

function setNoPrmOrRnm(source: Record<string, any>): void {
  source.prm.assessment.value.status = 'none';
  source.prm.findings = [];
  source.rnmAssessments = [
    {
      conclusionId: conclusionIds.noRnm,
      kind: 'rnm_assessment',
      value: { status: 'no_rnm' },
    },
  ];
  source.prmRnmRelations = [];
}

function addAdherentAssessment(
  source: Record<string, any>,
  conclusionId: string = conclusionIds.adherenceA,
  medicationRefs: string[] = [medicationId],
): void {
  source.adherence.assessments.push({
    conclusionId,
    kind: 'adherence_assessment',
    value: { medicationRefs, status: 'adherent' },
  });
}

function addNonAdherentAssessment(
  source: Record<string, any>,
  options: {
    assessmentId?: string;
    typeId?: string;
    barrierAssessmentId?: string;
    medicationRefs?: string[];
    type?: 'intentional' | 'unintentional' | 'erratic' | 'combined';
    typeNotDeterminable?: boolean;
    barrierStatus?: 'identified' | 'not_determinable';
    barriers?: Array<{
      conclusionId: string;
      role: 'primary' | 'secondary';
      category: 'practical' | 'perception';
    }>;
  } = {},
): void {
  const assessmentId = options.assessmentId ?? conclusionIds.adherenceA;
  const typeId = options.typeId ?? conclusionIds.adherenceTypeA;
  const barrierAssessmentId =
    options.barrierAssessmentId ?? conclusionIds.barrierAssessmentA;
  const barrierStatus = options.barrierStatus ?? 'identified';
  const barriers =
    options.barriers ??
    (barrierStatus === 'identified'
      ? [
          {
            conclusionId: conclusionIds.primaryBarrier,
            role: 'primary' as const,
            category: 'practical' as const,
          },
        ]
      : []);

  source.adherence.assessments.push({
    conclusionId: assessmentId,
    kind: 'adherence_assessment',
    value: {
      medicationRefs: options.medicationRefs ?? [medicationId],
      status: 'non_adherent',
    },
  });
  source.adherence.typeConclusions.push({
    conclusionId: typeId,
    kind: 'non_adherence_type',
    value: options.typeNotDeterminable
      ? { adherenceAssessmentRef: assessmentId, status: 'not_determinable' }
      : {
          adherenceAssessmentRef: assessmentId,
          status: 'determined',
          type: options.type ?? 'unintentional',
        },
  });
  source.adherence.barrierAssessments.push({
    conclusionId: barrierAssessmentId,
    kind: 'adherence_barrier_assessment',
    value: { adherenceAssessmentRef: assessmentId, status: barrierStatus },
  });
  barriers.forEach((barrier) => {
    source.adherence.barriers.push({
      conclusionId: barrier.conclusionId,
      kind: 'adherence_barrier',
      value: {
        barrierAssessmentRef: barrierAssessmentId,
        role: barrier.role,
        category: barrier.category,
      },
    });
  });
}

function requireReferral(source: Record<string, any>): void {
  source.referral = {
    conclusionId: conclusionIds.referral,
    kind: 'referral',
    value: {
      status: 'required',
      urgency: 'non_urgent',
      destination: { label: 'Médico de atención primaria' },
      reason: 'Requiere valoración clínica adicional.',
      report: {
        status: 'appropriate',
        essentialContents: ['Hallazgos relevantes y medicación implicada.'],
      },
    },
  };
}

describe('EvaluatorViewV2 case binding and opaque IDs', () => {
  it('acepta evaluator y runtime vinculados a la misma versión', () => {
    expect(validate().caseVersionId).toBe(caseVersionId);
  });

  it('rechaza un caseVersionId distinto del runtime', () => {
    const source = createEvaluator();
    source.caseVersionId = otherCaseVersionId;
    expect(() => validate(source)).toThrow(/must match patient runtime/);
  });

  it.each([
    ['ID semántico', 'casever-caso-uno'],
    ['UUID con mayúsculas', 'casever_A0000000-0000-4000-8000-000000000001'],
    ['versión UUID inválida', 'casever_90000000-0000-9000-8000-000000000001'],
    ['variante UUID inválida', 'casever_90000000-0000-4000-7000-000000000001'],
  ])('rechaza CaseVersionId con %s', (_description, invalidId) => {
    const source = createEvaluator();
    source.caseVersionId = invalidId;
    expect(() => validate(source)).toThrow(/casever_<uuid>/);
  });

  it('rechaza ConclusionId semántico', () => {
    const source = createEvaluator();
    source.carePath.initialSpfa.conclusionId = 'conclusion-dispensacion';
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/conclusion_<uuid>/);
  });

  it.each([
    ['UUID con mayúsculas', 'conclusion_A0000000-0000-4000-8000-000000000001'],
    ['versión UUID inválida', 'conclusion_10000000-0000-9000-8000-000000000001'],
    ['variante UUID inválida', 'conclusion_10000000-0000-4000-7000-000000000001'],
  ])('rechaza ConclusionId con %s', (_description, invalidId) => {
    const source = createEvaluator();
    source.carePath.initialSpfa.conclusionId = invalidId;
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/conclusion_<uuid>/);
  });
});

describe('EvaluatorViewV2 care path', () => {
  it('acepta la transición dispensing → pharmaceutical_indication', () => {
    const evaluator = validate();
    expect(evaluator.carePath.transitions[0].value).toEqual({
      fromSpfaRef: conclusionIds.initialSpfa,
      toSpfaRef: conclusionIds.additionalSpfa,
    });
  });

  it.each([
    ['dispensing', 'initial_treatment'],
    ['pharmaceutical_indication', undefined],
    ['medication_adherence', undefined],
  ])('admite %s como SPFA inicial', (service, subtype) => {
    const source = createEvaluator();
    source.carePath.additionalSpfas = [];
    source.carePath.transitions = [];
    source.carePath.initialSpfa.value = {
      service,
      ...(subtype === undefined ? {} : { subtype }),
    };
    expect(validate(source).carePath.initialSpfa.value.service).toBe(service);
  });

  it('admite continuación como subtipo de Dispensación', () => {
    const source = createEvaluator();
    source.carePath.initialSpfa.value.subtype = 'continuation';
    expect(validate(source).carePath.initialSpfa.value).toMatchObject({
      service: 'dispensing',
      subtype: 'continuation',
    });
  });

  it('rechaza subtipo de Dispensación en otro SPFA', () => {
    const source = createEvaluator();
    source.carePath.initialSpfa.value = {
      service: 'pharmaceutical_indication',
      subtype: 'continuation',
    };
    expect(() => validate(source)).toThrow(/only valid for dispensing/);
  });

  it('rechaza dos conclusiones con el mismo SpfaService', () => {
    const source = createEvaluator();
    source.carePath.additionalSpfas[0].value = {
      service: 'dispensing',
      subtype: 'continuation',
    };
    expect(() => validate(source)).toThrow(/duplicate SPFA service/);
  });

  it('rechaza ciclos entre transiciones SPFA', () => {
    const source = createEvaluator();
    source.carePath.transitions.push({
      conclusionId: 'conclusion_30000000-0000-4000-8000-000000000001',
      kind: 'spfa_transition',
      value: {
        fromSpfaRef: conclusionIds.additionalSpfa,
        toSpfaRef: conclusionIds.initialSpfa,
      },
    });
    expect(() => validate(source)).toThrow(/must not contain cycles/);
  });
});

describe('EvaluatorViewV2 Incidencia y Episodio de Seguimiento', () => {
  it('valida una Incidencia con su Episodio', () => {
    const evaluator = validate();
    expect(evaluator.incidence.findings).toHaveLength(1);
    expect(evaluator.incidence.followUpEpisodes[0].value.incidenceRef).toBe(
      conclusionIds.incidence,
    );
  });

  it('rechaza un Episodio huérfano', () => {
    const source = createEvaluator();
    source.incidence.followUpEpisodes[0].value.incidenceRef =
      conclusionIds.missing;
    expect(() => validate(source)).toThrow(/unknown conclusion reference/);
  });

  it('rechaza un Episodio que apunta a otro kind', () => {
    const source = createEvaluator();
    source.incidence.followUpEpisodes[0].value.incidenceRef = conclusionIds.prmA;
    expect(() => validate(source)).toThrow(/kind incidence/);
  });

  it('rechaza una Incidencia presente sin Episodio', () => {
    const source = createEvaluator();
    source.incidence.followUpEpisodes = [];
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/requires a follow-up episode/);
  });
});

describe('EvaluatorViewV2 PRM, RNM y riesgo de RNM', () => {
  it('representa múltiples PRM, RNM y riesgo de RNM', () => {
    const evaluator = validate();
    expect(evaluator.prm.findings).toHaveLength(2);
    expect(evaluator.rnmAssessments.map((item) => item.value.status)).toEqual([
      'rnm',
      'risk_of_rnm',
    ]);
  });

  it('representa no_rnm de forma explícita', () => {
    const source = createEvaluator();
    source.prm.assessment.value.status = 'none';
    source.prm.findings = [];
    source.rnmAssessments = [
      {
        conclusionId: conclusionIds.noRnm,
        kind: 'rnm_assessment',
        value: { status: 'no_rnm' },
      },
    ];
    source.prmRnmRelations = [];
    synchronizeEvidenceRules(source);
    expect(validate(source).rnmAssessments[0].value.status).toBe('no_rnm');
  });

  it('admite relaciones PRM↔RNM muchos-a-muchos', () => {
    expect(validate().prmRnmRelations).toHaveLength(4);
  });

  it('admite risk_of_rnm con PRM y relación entrante válida', () => {
    const evaluator = validate();
    expect(
      evaluator.prmRnmRelations.some(
        (relation) =>
          relation.value.relation === 'creates_risk_of_rnm' &&
          relation.value.rnmAssessmentRef === conclusionIds.risk,
      ),
    ).toBe(true);
  });

  it('rechaza risk_of_rnm sin relación entrante', () => {
    const source = createEvaluator();
    source.prmRnmRelations = source.prmRnmRelations.filter(
      (relation: Record<string, any>) =>
        relation.value.rnmAssessmentRef !== conclusionIds.risk,
    );
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(
      /risk_of_rnm requires an incoming creates_risk_of_rnm relation/,
    );
  });

  it('rechaza un PRM sin relación saliente', () => {
    const source = createEvaluator();
    source.prmRnmRelations = source.prmRnmRelations.filter(
      (relation: Record<string, any>) =>
        relation.value.prmRef !== conclusionIds.prmB,
    );
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/PRM must participate/);
  });

  it('admite PRM → RNM mediante contributes_to_rnm', () => {
    const evaluator = validate();
    expect(
      evaluator.prmRnmRelations.some(
        (relation) =>
          relation.value.prmRef === conclusionIds.prmA &&
          relation.value.rnmAssessmentRef === conclusionIds.rnm &&
          relation.value.relation === 'contributes_to_rnm',
      ),
    ).toBe(true);
  });

  it('rechaza PRM present junto a no_rnm sin relación posible', () => {
    const source = createEvaluator();
    source.rnmAssessments = [
      {
        conclusionId: conclusionIds.noRnm,
        kind: 'rnm_assessment',
        value: { status: 'no_rnm' },
      },
    ];
    source.prmRnmRelations = [];
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/PRM must participate/);
  });

  it('rechaza creates_risk_of_rnm dirigido a un RNM', () => {
    const source = createEvaluator();
    source.prmRnmRelations[0].value.relation = 'creates_risk_of_rnm';
    expect(() => validate(source)).toThrow(/must reference a risk/);
  });

  it('rechaza contributes_to_rnm dirigido a un riesgo', () => {
    const source = createEvaluator();
    source.prmRnmRelations[1].value.relation = 'contributes_to_rnm';
    expect(() => validate(source)).toThrow(/must reference an RNM/);
  });
});

describe('EvaluatorViewV2 EvidenceRule', () => {
  it('admite FactId, public_profile.age y public_profile.sex', () => {
    const source = createEvaluator();
    source.evidenceRules[0].requiredEvidence = {
      operator: 'all',
      operands: [
        { operator: 'fact', factRef: factIds.a },
        { operator: 'public_profile', field: 'age' },
        { operator: 'public_profile', field: 'sex' },
      ],
    };
    expect(validate(source).evidenceRules[0].requiredEvidence).toMatchObject({
      operator: 'all',
    });
  });

  it('admite (A AND B) OR (C AND D)', () => {
    const source = createEvaluator();
    source.evidenceRules[0].requiredEvidence = {
      operator: 'any',
      operands: [
        {
          operator: 'all',
          operands: [
            { operator: 'fact', factRef: factIds.a },
            { operator: 'fact', factRef: factIds.b },
          ],
        },
        {
          operator: 'all',
          operands: [
            { operator: 'fact', factRef: factIds.c },
            { operator: 'fact', factRef: factIds.d },
          ],
        },
      ],
    };
    expect(validate(source).evidenceRules[0].requiredEvidence).toMatchObject({
      operator: 'any',
    });
  });

  it.each(['name', 'treatment'])(
    'rechaza public_profile.%s',
    (field) => {
      const source = createEvaluator();
      source.evidenceRules[0].requiredEvidence = {
        operator: 'public_profile',
        field,
      };
      expect(() => validate(source)).toThrow(/must be one of: age, sex/);
    },
  );

  it('rechaza un FactId inexistente', () => {
    const source = createEvaluator();
    source.evidenceRules[0].requiredEvidence = {
      operator: 'fact',
      factRef: factIds.missing,
    };
    expect(() => validate(source)).toThrow(/unknown fact reference/);
  });

  it('rechaza un árbol vacío', () => {
    const source = createEvaluator();
    source.evidenceRules[0].requiredEvidence = {
      operator: 'all',
      operands: [],
    };
    expect(() => validate(source)).toThrow(/at least one expression/);
  });

  it('rechaza una conclusión inexistente', () => {
    const source = createEvaluator();
    source.evidenceRules[0].conclusionRef = conclusionIds.missing;
    expect(() => validate(source)).toThrow(/unknown conclusion reference/);
  });

  it('rechaza una regla duplicada para la misma conclusión', () => {
    const source = createEvaluator();
    source.evidenceRules.push({ ...source.evidenceRules[0] });
    expect(() => validate(source)).toThrow(/duplicate EvidenceRule/);
  });

  it('rechaza referencias duplicadas dentro de una lista plana', () => {
    const source = createEvaluator();
    const leaf = { operator: 'public_profile', field: 'age' };
    source.evidenceRules[0].supportingEvidenceRefs = [leaf, leaf];
    expect(() => validate(source)).toThrow(/duplicate evidence/);
  });

  it('exige una EvidenceRule para cada conclusión evaluable', () => {
    const source = createEvaluator();
    source.evidenceRules.pop();
    expect(() => validate(source)).toThrow(/missing EvidenceRule/);
  });

  it('rechaza EvidenceRule para un nodo estructural', () => {
    const source = createEvaluator();
    source.evidenceRules.push({
      conclusionRef: conclusionIds.initialSpfa,
      requiredEvidence: { operator: 'fact', factRef: factIds.a },
      supportingEvidenceRefs: [],
      counterEvidenceRefs: [],
      teacherRationale: 'No debe admitirse para un nodo SPFA estructural.',
    });
    expect(() => validate(source)).toThrow(/does not accept EvidenceRule/);
  });

  it('rechaza el mismo leaf como apoyo y contraevidencia', () => {
    const source = createEvaluator();
    const leaf = { operator: 'public_profile', field: 'age' };
    source.evidenceRules[0].supportingEvidenceRefs = [leaf];
    source.evidenceRules[0].counterEvidenceRefs = [leaf];
    expect(() => validate(source)).toThrow(/both supporting and counter/);
  });

  it('acepta patient_unknown como evidencia y devuelve un flag no bloqueante', () => {
    const runtime = createRuntime() as unknown as Record<string, any>;
    runtime.pharmacotherapy.prescribedMedications[0].displayName = {
      state: 'patient_unknown',
      factId: factIds.unknown,
      topic: 'nombre del medicamento',
      disclosure: { mode: 'specific_question', domains: ['medication_identity'] },
    };
    const source = createEvaluator();
    source.evidenceRules[0].requiredEvidence = {
      operator: 'fact',
      factRef: factIds.unknown,
    };
    const validated = validateEvaluatorViewV2(
      source,
      runtime as unknown as PatientRuntimeViewV2,
    );
    expect(findPatientUnknownOnlyEvidenceFlags(validated, runtime as unknown as PatientRuntimeViewV2)).toContainEqual({
      conclusionRef: validated.evidenceRules[0].conclusionRef,
      code: 'ONLY_PATIENT_UNKNOWN_REQUIRED_EVIDENCE',
    });
  });

  it('devuelve flag para all con varios FactId patient_unknown', () => {
    const runtime = createRuntime() as unknown as Record<string, any>;
    runtime.initialDemand = {
      state: 'patient_unknown',
      factId: factIds.a,
      topic: 'demanda inicial',
      disclosure: { mode: 'spontaneous' },
    };
    runtime.encounter.personPresent = {
      state: 'patient_unknown',
      factId: factIds.b,
      topic: 'persona presente',
      disclosure: { mode: 'spontaneous' },
    };
    const source = createEvaluator();
    source.evidenceRules[0].requiredEvidence = {
      operator: 'all',
      operands: [
        { operator: 'fact', factRef: factIds.a },
        { operator: 'fact', factRef: factIds.b },
      ],
    };
    const validated = validateEvaluatorViewV2(
      source,
      runtime as unknown as PatientRuntimeViewV2,
    );

    expect(
      findPatientUnknownOnlyEvidenceFlags(
        validated,
        runtime as unknown as PatientRuntimeViewV2,
      ),
    ).toContainEqual({
      conclusionRef: validated.evidenceRules[0].conclusionRef,
      code: 'ONLY_PATIENT_UNKNOWN_REQUIRED_EVIDENCE',
    });
  });

  it.each([
    ['un hecho conocido', { operator: 'fact', factRef: factIds.b }],
    ['public_profile', { operator: 'public_profile', field: 'age' }],
  ])(
    'no devuelve flag si all incluye %s',
    (_description, additionalEvidence) => {
      const runtime = createRuntime() as unknown as Record<string, any>;
      runtime.initialDemand = {
        state: 'patient_unknown',
        factId: factIds.a,
        topic: 'demanda inicial',
        disclosure: { mode: 'spontaneous' },
      };
      const source = createEvaluator();
      source.evidenceRules[0].requiredEvidence = {
        operator: 'all',
        operands: [
          { operator: 'fact', factRef: factIds.a },
          additionalEvidence,
        ],
      };
      const validated = validateEvaluatorViewV2(
        source,
        runtime as unknown as PatientRuntimeViewV2,
      );

      expect(
        findPatientUnknownOnlyEvidenceFlags(
          validated,
          runtime as unknown as PatientRuntimeViewV2,
        ),
      ).not.toContainEqual({
        conclusionRef: validated.evidenceRules[0].conclusionRef,
        code: 'ONLY_PATIENT_UNKNOWN_REQUIRED_EVIDENCE',
      });
    },
  );

  it('rechaza propiedades inesperadas dentro de EvidenceExpression', () => {
    const source = createEvaluator();
    source.evidenceRules[0].requiredEvidence = {
      operator: 'fact',
      factRef: factIds.a,
      futureEvidenceSecret: true,
    };
    expect(() => validate(source)).toThrow(/unexpected property/);
  });

  it('rechaza operadores desconocidos', () => {
    const source = createEvaluator();
    source.evidenceRules[0].requiredEvidence = {
      operator: 'not',
      operands: [{ operator: 'fact', factRef: factIds.a }],
    };
    expect(() => validate(source)).toThrow(/fact, public_profile, all or any/);
  });
});

describe('EvaluatorViewV2 assessment consistency', () => {
  it('exige hallazgos cuando prmAssessment es present', () => {
    const source = createEvaluator();
    source.prm.findings = [];
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/present assessment requires findings/);
  });

  it('prohíbe hallazgos cuando prmAssessment es none', () => {
    const source = createEvaluator();
    source.prm.assessment.value.status = 'none';
    expect(() => validate(source)).toThrow(/none assessment forbids findings/);
  });
});

describe('EvaluatorViewV2 Incremento 2B scenarios', () => {
  it('A. representa paciente adherente sin PRM ni RNM', () => {
    const source = createEvaluator();
    setNoPrmOrRnm(source);
    addAdherentAssessment(source);
    synchronizeEvidenceRules(source);

    const evaluator = validate(source);
    expect(evaluator.adherence.assessments[0].value.status).toBe('adherent');
    expect(evaluator.prm.assessment.value.status).toBe('none');
    expect(evaluator.rnmAssessments[0].value.status).toBe('no_rnm');
  });

  it('B. representa no adherencia no intencional con barrera práctica', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source);
    synchronizeEvidenceRules(source);

    const evaluator = validate(source);
    expect(evaluator.adherence.typeConclusions[0].value).toMatchObject({
      status: 'determined',
      type: 'unintentional',
    });
    expect(evaluator.adherence.barriers[0].value.category).toBe('practical');
  });

  it('C. representa no adherencia intencional con barrera de percepción', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source, {
      type: 'intentional',
      barriers: [
        {
          conclusionId: conclusionIds.primaryBarrier,
          role: 'primary',
          category: 'perception',
        },
      ],
    });
    source.adherence.patientProfiles.push({
      conclusionId: conclusionIds.adherenceProfile,
      kind: 'adherence_patient_profile',
      value: {
        adherenceAssessmentRef: conclusionIds.adherenceA,
        status: 'determined',
        profile: 'trivializing',
      },
    });
    synchronizeEvidenceRules(source);

    const evaluator = validate(source);
    expect(evaluator.adherence.typeConclusions[0].value).toMatchObject({
      type: 'intentional',
    });
    expect(evaluator.adherence.barriers[0].value.category).toBe('perception');
    expect(evaluator.adherence.patientProfiles[0].value).toMatchObject({
      profile: 'trivializing',
    });
  });

  it('D. representa tipo combinado con barrera primaria y secundaria', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source, {
      type: 'combined',
      barriers: [
        {
          conclusionId: conclusionIds.primaryBarrier,
          role: 'primary',
          category: 'perception',
        },
        {
          conclusionId: conclusionIds.secondaryBarrier,
          role: 'secondary',
          category: 'practical',
        },
      ],
    });
    synchronizeEvidenceRules(source);

    expect(validate(source).adherence.barriers).toHaveLength(2);
  });

  it('E. representa non_adherent con tipo no determinable', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source, { typeNotDeterminable: true });
    synchronizeEvidenceRules(source);

    expect(validate(source).adherence.typeConclusions[0].value.status).toBe(
      'not_determinable',
    );
  });

  it('F. representa medA adherente y medB no adherente', () => {
    const source = createEvaluator();
    addAdherentAssessment(source, conclusionIds.adherenceA, [medicationId]);
    addNonAdherentAssessment(source, {
      assessmentId: conclusionIds.adherenceB,
      typeId: conclusionIds.adherenceTypeB,
      barrierAssessmentId: conclusionIds.barrierAssessmentB,
      medicationRefs: [medicationIdB],
    });
    synchronizeEvidenceRules(source);

    expect(
      validate(source).adherence.assessments.map((item) => item.value.status),
    ).toEqual(['adherent', 'non_adherent']);
  });

  it('G. representa estrategia combined que aborda varias barreras', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source, {
      type: 'combined',
      barriers: [
        {
          conclusionId: conclusionIds.primaryBarrier,
          role: 'primary',
          category: 'perception',
        },
        {
          conclusionId: conclusionIds.secondaryBarrier,
          role: 'secondary',
          category: 'practical',
        },
      ],
    });
    source.adherence.strategies.push({
      conclusionId: conclusionIds.strategy,
      kind: 'adherence_strategy',
      value: {
        adherenceAssessmentRef: conclusionIds.adherenceA,
        category: 'combined',
        componentCategories: ['educational', 'behavioral'],
        addressedBarrierRefs: [
          conclusionIds.primaryBarrier,
          conclusionIds.secondaryBarrier,
        ],
      },
    });
    synchronizeEvidenceRules(source);

    expect(validate(source).adherence.strategies[0].value).toMatchObject({
      category: 'combined',
      componentCategories: ['educational', 'behavioral'],
    });
  });

  it('H. representa Actuación sin Intervención', () => {
    const source = createEvaluator();
    source.professionalActions.push({
      conclusionId: conclusionIds.action,
      kind: 'professional_action',
      value: {
        spfaRef: conclusionIds.initialSpfa,
        category: 'dispense',
      },
    });
    synchronizeEvidenceRules(source);

    const evaluator = validate(source);
    expect(evaluator.professionalActions).toHaveLength(1);
    expect(evaluator.pharmaceuticalInterventions).toEqual([]);
  });

  it('I. representa Intervención sin Actuación ni derivación', () => {
    const source = createEvaluator();
    source.pharmaceuticalInterventions.push({
      conclusionId: conclusionIds.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: conclusionIds.initialSpfa,
        target: 'conditions_of_use',
        addressedConclusionRefs: [conclusionIds.incidence],
      },
    });
    synchronizeEvidenceRules(source);

    const evaluator = validate(source);
    expect(evaluator.pharmaceuticalInterventions[0].value).not.toHaveProperty(
      'professionalActionRef',
    );
    expect(evaluator.referral.value.status).toBe('not_required');
  });

  it('J. comparte una única ReferralConclusion entre Actuación e Intervención', () => {
    const source = createEvaluator();
    requireReferral(source);
    source.professionalActions.push({
      conclusionId: conclusionIds.action,
      kind: 'professional_action',
      value: {
        spfaRef: conclusionIds.initialSpfa,
        category: 'referral',
        referralRef: conclusionIds.referral,
      },
    });
    source.pharmaceuticalInterventions.push({
      conclusionId: conclusionIds.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: conclusionIds.initialSpfa,
        professionalActionRef: conclusionIds.action,
        target: 'patient_state_or_situation',
        addressedConclusionRefs: [conclusionIds.rnm],
        referralRef: conclusionIds.referral,
      },
    });
    synchronizeEvidenceRules(source);

    const evaluator = validate(source);
    expect(evaluator.professionalActions[0].value.referralRef).toBe(
      evaluator.referral.conclusionId,
    );
    expect(evaluator.pharmaceuticalInterventions[0].value.referralRef).toBe(
      evaluator.referral.conclusionId,
    );
  });
});

describe('EvaluatorViewV2 Incremento 2B invariants', () => {
  it('materializa medicationRefs en orden lexicográfico canónico', () => {
    const source = createEvaluator();
    addAdherentAssessment(source, conclusionIds.adherenceA, [
      medicationIdB,
      medicationId,
    ]);
    synchronizeEvidenceRules(source);

    expect(validate(source).adherence.assessments[0].value.medicationRefs).toEqual([
      medicationId,
      medicationIdB,
    ]);
  });

  it('rechaza un ámbito de adherencia vacío', () => {
    const source = createEvaluator();
    addAdherentAssessment(source, conclusionIds.adherenceA, []);
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/at least one medication/);
  });

  it('rechaza medicamentos duplicados dentro del ámbito', () => {
    const source = createEvaluator();
    addAdherentAssessment(source, conclusionIds.adherenceA, [
      medicationId,
      medicationId,
    ]);
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/duplicate medication references/);
  });

  it('detecta ámbitos idénticos con distinto orden canónico', () => {
    const source = createEvaluator();
    addAdherentAssessment(source, conclusionIds.adherenceA, [
      medicationId,
      medicationIdB,
    ]);
    addAdherentAssessment(source, conclusionIds.adherenceB, [
      medicationIdB,
      medicationId,
    ]);
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/duplicate adherence medication scope/);
  });

  it('rechaza medicamentos inexistentes en un ámbito', () => {
    const source = createEvaluator();
    addAdherentAssessment(source, conclusionIds.adherenceA, [
      'med_10000000-0000-4000-8000-000000000099',
    ]);
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/unknown medication reference/);
  });

  it('rechaza ámbitos de adherencia solapados', () => {
    const source = createEvaluator();
    addAdherentAssessment(source, conclusionIds.adherenceA, [medicationId]);
    addAdherentAssessment(source, conclusionIds.adherenceB, [
      medicationId,
      medicationIdB,
    ]);
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/scope overlaps/);
  });

  it('rechaza profile en adherent', () => {
    const source = createEvaluator();
    addAdherentAssessment(source);
    source.adherence.patientProfiles.push({
      conclusionId: conclusionIds.adherenceProfile,
      kind: 'adherence_patient_profile',
      value: {
        adherenceAssessmentRef: conclusionIds.adherenceA,
        status: 'determined',
        profile: 'confused',
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/only valid for non_adherent/);
  });

  it('rechaza tipo en adherent', () => {
    const source = createEvaluator();
    addAdherentAssessment(source);
    source.adherence.typeConclusions.push({
      conclusionId: conclusionIds.adherenceTypeA,
      kind: 'non_adherence_type',
      value: {
        adherenceAssessmentRef: conclusionIds.adherenceA,
        status: 'determined',
        type: 'intentional',
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/only valid for non_adherent/);
  });

  it('rechaza barreras en adherent', () => {
    const source = createEvaluator();
    addAdherentAssessment(source);
    source.adherence.barrierAssessments.push({
      conclusionId: conclusionIds.barrierAssessmentA,
      kind: 'adherence_barrier_assessment',
      value: {
        adherenceAssessmentRef: conclusionIds.adherenceA,
        status: 'identified',
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/only valid for non_adherent/);
  });

  it('rechaza non_adherent sin tipo', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source);
    source.adherence.typeConclusions = [];
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/requires exactly one type/);
  });

  it('rechaza non_adherent sin barrier assessment', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source);
    source.adherence.barrierAssessments = [];
    source.adherence.barriers = [];
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/requires exactly one barrier assessment/);
  });

  it('rechaza dos barreras primary', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source, {
      barriers: [
        {
          conclusionId: conclusionIds.primaryBarrier,
          role: 'primary',
          category: 'practical',
        },
        {
          conclusionId: conclusionIds.secondaryBarrier,
          role: 'primary',
          category: 'perception',
        },
      ],
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/exactly one primary/);
  });

  it('rechaza estrategia que referencia barrera de otro assessment', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source);
    addNonAdherentAssessment(source, {
      assessmentId: conclusionIds.adherenceB,
      typeId: conclusionIds.adherenceTypeB,
      barrierAssessmentId: conclusionIds.barrierAssessmentB,
      medicationRefs: [medicationIdB],
      barriers: [
        {
          conclusionId: conclusionIds.otherBarrier,
          role: 'primary',
          category: 'perception',
        },
      ],
    });
    source.adherence.strategies.push({
      conclusionId: conclusionIds.strategy,
      kind: 'adherence_strategy',
      value: {
        adherenceAssessmentRef: conclusionIds.adherenceA,
        category: 'educational',
        addressedBarrierRefs: [conclusionIds.otherBarrier],
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/different adherence assessment/);
  });

  it('rechaza combined con un solo componente', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source);
    source.adherence.strategies.push({
      conclusionId: conclusionIds.strategy,
      kind: 'adherence_strategy',
      value: {
        adherenceAssessmentRef: conclusionIds.adherenceA,
        category: 'combined',
        componentCategories: ['technical'],
        addressedBarrierRefs: [conclusionIds.primaryBarrier],
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/at least two categories/);
  });

  it('rechaza clasificación opcional sin VersionRef correspondiente', () => {
    const source = createEvaluator();
    addNonAdherentAssessment(source);
    source.adherence.barriers[0].value.classification = {
      taxonomyId: 'barrier-catalog',
      taxonomyVersion: '1',
      conceptId: 'barrier-a',
    };
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/requires its configured VersionRef/);
  });

  it('acepta clasificación opcional cuando coincide con VersionRef', () => {
    const source = createEvaluator();
    source.versions.barrierTaxonomy = {
      id: 'barrier-catalog',
      version: '1',
    };
    addNonAdherentAssessment(source);
    source.adherence.barriers[0].value.classification = {
      taxonomyId: 'barrier-catalog',
      taxonomyVersion: '1',
      conceptId: 'barrier-a',
    };
    synchronizeEvidenceRules(source);
    expect(validate(source).adherence.barriers[0].value.classification).toBeDefined();
  });

  it('rechaza other_spfa sin transición coincidente', () => {
    const source = createEvaluator();
    source.carePath.transitions = [];
    source.professionalActions.push({
      conclusionId: conclusionIds.action,
      kind: 'professional_action',
      value: {
        spfaRef: conclusionIds.initialSpfa,
        category: 'other_spfa',
        targetSpfaRef: conclusionIds.additionalSpfa,
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/matching SPFA transition/);
  });

  it('rechaza professionalActionRef de otro SPFA', () => {
    const source = createEvaluator();
    source.professionalActions.push({
      conclusionId: conclusionIds.action,
      kind: 'professional_action',
      value: {
        spfaRef: conclusionIds.additionalSpfa,
        category: 'pharmacological_treatment',
      },
    });
    source.pharmaceuticalInterventions.push({
      conclusionId: conclusionIds.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: conclusionIds.initialSpfa,
        professionalActionRef: conclusionIds.action,
        target: 'treatment',
        addressedConclusionRefs: [conclusionIds.prmA],
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/different SPFA/);
  });

  it('rechaza addressedConclusionRef estructural', () => {
    const source = createEvaluator();
    source.pharmaceuticalInterventions.push({
      conclusionId: conclusionIds.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: conclusionIds.initialSpfa,
        target: 'treatment',
        addressedConclusionRefs: [conclusionIds.initialSpfa],
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/cannot be addressed/);
  });

  it('rechaza addressed no_rnm', () => {
    const source = createEvaluator();
    setNoPrmOrRnm(source);
    source.pharmaceuticalInterventions.push({
      conclusionId: conclusionIds.intervention,
      kind: 'pharmaceutical_intervention',
      value: {
        spfaRef: conclusionIds.initialSpfa,
        target: 'patient_state_or_situation',
        addressedConclusionRefs: [conclusionIds.noRnm],
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/no_rnm cannot be addressed/);
  });

  it('rechaza referralRef cuando referral es not_required', () => {
    const source = createEvaluator();
    source.professionalActions.push({
      conclusionId: conclusionIds.action,
      kind: 'professional_action',
      value: {
        spfaRef: conclusionIds.initialSpfa,
        category: 'referral',
        referralRef: conclusionIds.referral,
      },
    });
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/required evaluator referral/);
  });

  it('rechaza destination.label vacío', () => {
    const source = createEvaluator();
    requireReferral(source);
    source.referral.value.destination.label = '   ';
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/destination\.label/);
  });

  it('rechaza propiedades inesperadas en los nuevos tipos', () => {
    const source = createEvaluator();
    addAdherentAssessment(source);
    source.adherence.assessments[0].value.future_secret = true;
    synchronizeEvidenceRules(source);
    expect(() => validate(source)).toThrow(/unexpected property/);
  });
});
