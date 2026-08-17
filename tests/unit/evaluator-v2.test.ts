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
  ];
}

function synchronizeEvidenceRules(source: Record<string, any>): void {
  const evidenceKinds = new Set([
    'incidence_assessment',
    'incidence',
    'prm_assessment',
    'prm',
    'rnm_assessment',
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
    evidenceRules: [],
  };
  synchronizeEvidenceRules(source);
  return source;
}

function validate(source = createEvaluator()) {
  return validateEvaluatorViewV2(source, createRuntime());
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
  it.each([
    ['dispensing', 'initial_treatment'],
    ['pharmaceutical_indication', undefined],
    ['medication_adherence', undefined],
  ])('admite %s como SPFA inicial', (service, subtype) => {
    const source = createEvaluator();
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
