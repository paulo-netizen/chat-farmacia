import { describe, expect, it } from 'vitest';

import {
  SpfaSemanticTargetContextBuildError,
  buildSpfaSemanticTargetContextV2,
} from '@/lib/cases/v2/build-spfa-semantic-target-context';
import { buildSpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/build-spfa-evidence-baseline';
import type { SpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/spfa-evidence-baseline-types';
import type { AppliedSpfaRequirementV2 } from '@/lib/cases/v2/spfa-protocol-application-types';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import {
  validateCaseSpfaProtocolSetAgainstCanonicalContextV2,
  validateSpfaProtocolSetClinicalContextV2,
} from '@/lib/cases/v2/validate-spfa-protocol-set';

const opaque = (prefix: string, group: number, item: number) =>
  `${prefix}_${group.toString().padStart(8, '0')}-0000-4000-8000-${item
    .toString()
    .padStart(12, '0')}`;

const ids = {
  session: '10000000-0000-4000-8000-000000000001',
  otherSession: '10000000-0000-4000-8000-000000000002',
  caseVersion: opaque('casever', 20_000_000, 1),
  otherCaseVersion: opaque('casever', 20_000_000, 2),
  medication: opaque('med', 30_000_000, 1),
  use: opaque('use', 31_000_000, 1),
  initialSpfa: opaque('conclusion', 40_000_000, 1),
  additionalSpfa: opaque('conclusion', 40_000_000, 2),
  transition: opaque('conclusion', 40_000_000, 3),
  incidence: opaque('conclusion', 40_000_000, 4),
  prm: opaque('conclusion', 40_000_000, 5),
  rnm: opaque('conclusion', 40_000_000, 6),
  referral: opaque('conclusion', 40_000_000, 7),
  protocol: opaque('spfa_protocol', 50_000_000, 1),
  additionalProtocol: opaque('spfa_protocol', 50_000_000, 2),
  informationRequirement: opaque('spfa_requirement', 51_000_000, 1),
  actionRequirement: opaque('spfa_requirement', 51_000_000, 2),
  transitionRequirement: opaque('spfa_requirement', 51_000_000, 3),
  additionalRequirement: opaque('spfa_requirement', 51_000_000, 4),
  policy: opaque('spfa_policy', 52_000_000, 1),
  targetA: opaque('spfa_target', 53_000_000, 1),
  targetB: opaque('spfa_target', 53_000_000, 2),
  targetC: opaque('spfa_target', 53_000_000, 3),
  publicTarget: opaque('spfa_target', 53_000_000, 4),
  targetD: opaque('spfa_target', 53_000_000, 5),
} as const;

const fact = (item: number) => opaque('fact', 60_000_000, item);

const factIds = {
  initialDemand: fact(1),
  personPresent: fact(2),
  relationship: fact(3),
  healthProblem: fact(4),
  clinicalHistory: fact(5),
  physiological: fact(6),
  allergy: fact(7),
  lifestyle: fact(8),
  biomedical: fact(9),
  symptomDescription: fact(10),
  symptomOnset: fact(11),
  symptomDuration: fact(12),
  symptomEvolution: fact(13),
  symptomCircumstance: fact(14),
  medicationDisplay: fact(15),
  medicationOrigin: fact(16),
  medicationPurpose: fact(17),
  regimenBasis: fact(18),
  referenceDose: fact(19),
  referenceSchedule: fact(20),
  referenceDuration: fact(21),
  administration: fact(22),
  specialCondition: fact(23),
  actualUse: fact(24),
  actualDose: fact(25),
  actualSchedule: fact(26),
  frequency: fact(27),
  timePeriod: fact(28),
  recentChange: fact(29),
  effectiveness: fact(30),
  safety: fact(31),
  actionTaken: fact(32),
  practicalDifficulty: fact(33),
  belief: fact(34),
  strategy: fact(35),
  dailyContext: fact(36),
  socialSupport: fact(37),
  professionalRelationship: fact(38),
} as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function known(
  factId: string,
  value: string | number | Record<string, string | number>,
  certainty: 'exact' | 'approximate' | 'uncertain' = 'exact',
) {
  return {
    state: 'known',
    factId,
    value,
    certainty,
    disclosure: { mode: 'spontaneous', delayedBy: ['lack_of_empathy'] },
  };
}

function explicitAbsence(factId: string, topic: string) {
  return {
    state: 'explicit_absence',
    factId,
    topic,
    disclosure: { mode: 'specific_question', domains: ['symptoms'] },
  };
}

function patientUnknown(factId: string, topic: string) {
  return {
    state: 'patient_unknown',
    factId,
    topic,
    disclosure: { mode: 'open_question' },
  };
}

const notApplicable = {
  state: 'not_applicable',
  reasonCode: 'clinically_irrelevant',
};

function patientFacts(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    publicProfile: {
      nombre: 'Paciente sintética',
      edad: 52,
      sexo: 'mujer',
      tratamiento: 'Medicamento sintético',
    },
    initialDemand: known(factIds.initialDemand, 'Consulta por tos'),
    encounter: {
      personPresent: known(factIds.personPresent, 'patient'),
      relationshipToPatient: explicitAbsence(
        factIds.relationship,
        'acompañante',
      ),
    },
    clinicalContext: {
      healthProblems: [
        known(factIds.healthProblem, 'Hipertensión', 'approximate'),
      ],
      clinicalHistory: [
        patientUnknown(factIds.clinicalHistory, 'diagnóstico antiguo'),
      ],
      physiologicalSituation: [
        known(factIds.physiological, 'Menopausia', 'uncertain'),
      ],
      pregnancyAndLactation: { ...notApplicable },
      allergiesAndIntolerances: [
        explicitAbsence(factIds.allergy, 'alergias conocidas'),
      ],
      lifestyle: [known(factIds.lifestyle, 'Camina a diario')],
      biomedicalData: [
        known(factIds.biomedical, {
          type: 'blood_pressure',
          value: 135,
          unit: 'mmHg',
          timingOrContext: 'esta mañana',
        }),
      ],
    },
    symptoms: [
      {
        description: known(factIds.symptomDescription, 'Tos seca'),
        onset: known(factIds.symptomOnset, 'Comenzó el lunes'),
        duration: known(factIds.symptomDuration, 'Tres días', 'approximate'),
        evolution: patientUnknown(factIds.symptomEvolution, 'evolución de la tos'),
        relevantCircumstances: [
          explicitAbsence(factIds.symptomCircumstance, 'fiebre asociada'),
        ],
      },
    ],
    pharmacotherapy: {
      prescribedMedications: [
        {
          medicationId: ids.medication,
          displayName: known(factIds.medicationDisplay, 'Enalapril 20 mg'),
          origin: known(factIds.medicationOrigin, 'prescribed'),
          purposeAsUnderstood: patientUnknown(
            factIds.medicationPurpose,
            'para qué sirve el medicamento',
          ),
          regimenBasis: known(factIds.regimenBasis, 'prescription'),
          referenceDose: known(factIds.referenceDose, '20 mg', 'approximate'),
          referenceSchedule: known(factIds.referenceSchedule, 'Una vez al día'),
          referenceDuration: explicitAbsence(
            factIds.referenceDuration,
            'duración limitada',
          ),
          administrationMethod: known(factIds.administration, 'Vía oral'),
          specialUseConditions: [
            known(factIds.specialCondition, 'Con un vaso de agua'),
          ],
        },
      ],
      otherMedicinesAndProducts: [],
      actualMedicationUse: [
        {
          useId: ids.use,
          medicationRef: ids.medication,
          action: 'delays',
          actualUse: known(factIds.actualUse, 'Lo toma cada día'),
          actualDose: known(factIds.actualDose, '20 mg', 'approximate'),
          actualSchedule: patientUnknown(
            factIds.actualSchedule,
            'hora exacta de administración',
          ),
          frequency: known(factIds.frequency, 'Una vez al día'),
          timePeriod: explicitAbsence(factIds.timePeriod, 'periodo fijo'),
          circumstanceFactRefs: [],
          statedReasonFactRefs: [],
          perceivedEffectFactRefs: [],
          practicalDifficultyFactRefs: [],
          strategyTriedFactRefs: [],
        },
      ],
      recentChanges: [
        {
          medicationRef: ids.medication,
          detail: known(factIds.recentChange, 'Cambio de marca reciente'),
        },
      ],
      perceivedEffectiveness: [
        {
          medicationRef: ids.medication,
          detail: known(factIds.effectiveness, 'Cree que controla la tensión'),
        },
      ],
      perceivedSafety: [
        {
          medicationRef: ids.medication,
          detail: patientUnknown(factIds.safety, 'efecto adverso atribuido'),
        },
      ],
    },
    actionsAlreadyTaken: [known(factIds.actionTaken, 'Tomó miel')],
    practicalDifficulties: [
      known(factIds.practicalDifficulty, 'Olvida la toma al salir'),
    ],
    beliefsAndConcerns: [known(factIds.belief, 'Teme depender del medicamento')],
    strategiesAlreadyTried: [known(factIds.strategy, 'Usa una alarma')],
    dailyAndSocialContext: [known(factIds.dailyContext, 'Trabaja por turnos')],
    familyAndSocialSupport: [known(factIds.socialSupport, 'Apoyo de su pareja')],
    relationshipWithProfessionals: [
      known(factIds.professionalRelationship, 'Confía en su farmacéutica'),
    ],
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
  };
}

function evidenceRule(conclusionRef: string) {
  return {
    conclusionRef,
    requiredEvidence: { operator: 'fact', factRef: factIds.initialDemand },
    supportingEvidenceRefs: [],
    counterEvidenceRefs: [],
    teacherRationale: 'Razonamiento docente que no debe filtrarse',
  };
}

function evaluator(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    versions: {
      evaluatorSchema: { id: 'evaluator-v2', version: '2.0' },
      protocol: { id: 'catalogo-spfa', version: '2026.1' },
      prmTaxonomy: { id: 'prm', version: '1' },
      rnmTaxonomy: { id: 'rnm', version: '1' },
      adherenceFramework: { id: 'adherence', version: '1' },
    },
    carePath: {
      initialSpfa: {
        conclusionId: ids.initialSpfa,
        kind: 'spfa',
        value: { service: 'dispensing', subtype: 'initial_treatment' },
      },
      additionalSpfas: [
        {
          conclusionId: ids.additionalSpfa,
          kind: 'spfa',
          value: { service: 'pharmaceutical_indication' },
        },
      ],
      transitions: [
        {
          conclusionId: ids.transition,
          kind: 'spfa_transition',
          value: {
            fromSpfaRef: ids.initialSpfa,
            toSpfaRef: ids.additionalSpfa,
          },
        },
      ],
    },
    incidence: {
      assessment: {
        conclusionId: ids.incidence,
        kind: 'incidence_assessment',
        value: { status: 'none' },
      },
      findings: [],
      followUpEpisodes: [],
    },
    prm: {
      assessment: {
        conclusionId: ids.prm,
        kind: 'prm_assessment',
        value: { status: 'none' },
      },
      findings: [],
    },
    rnmAssessments: [
      {
        conclusionId: ids.rnm,
        kind: 'rnm_assessment',
        value: { status: 'no_rnm' },
      },
    ],
    prmRnmRelations: [],
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
      conclusionId: ids.referral,
      kind: 'referral',
      value: { status: 'not_required' },
    },
    evidenceRules: [
      evidenceRule(ids.incidence),
      evidenceRule(ids.prm),
      evidenceRule(ids.rnm),
      evidenceRule(ids.referral),
    ],
  };
}

function mainDefinition(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    protocolId: ids.protocol,
    version: 'dispensing-1',
    service: 'dispensing',
    subtype: 'initial_treatment',
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementId: ids.informationRequirement,
        semanticDomain: {
          kind: 'patient_information',
          disclosureDomain: 'symptoms',
        },
        teacherLabel: 'Etiqueta interna',
        description: 'Descripción interna',
        defaultImportance: 'RELEVANT',
        informationGoal: 'Determinar el dato factual solicitado',
        safetyCriticality: { safetyCritical: false },
        applicability: { kind: 'ALWAYS' },
      },
      {
        kind: 'ACTION_REQUIREMENT',
        requirementId: ids.actionRequirement,
        semanticDomain: 'safe_professional_action',
        teacherLabel: 'Actuación interna',
        description: 'Descripción interna',
        defaultImportance: 'RELEVANT',
        actionGoal: 'Identificar la conclusión profesional expresada',
        safetyCriticality: { safetyCritical: false },
        applicability: { kind: 'ALWAYS' },
      },
      {
        kind: 'ACTION_REQUIREMENT',
        requirementId: ids.transitionRequirement,
        semanticDomain: 'care_path_transition',
        teacherLabel: 'Transición interna',
        description: 'Descripción interna',
        defaultImportance: 'RELEVANT',
        actionGoal: 'Identificar la transición asistencial realizada',
        safetyCriticality: { safetyCritical: false },
        applicability: { kind: 'ALWAYS' },
      },
    ],
  };
}

function additionalDefinition(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    protocolId: ids.additionalProtocol,
    version: 'indication-1',
    service: 'pharmaceutical_indication',
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementId: ids.additionalRequirement,
        semanticDomain: {
          kind: 'protocol_information',
          domain: 'service_context',
        },
        teacherLabel: 'Contexto adicional',
        description: 'No aplicable en la fixture',
        defaultImportance: 'OPTIONAL',
        informationGoal: 'Reconocer el contexto adicional',
        safetyCriticality: { safetyCritical: false },
        applicability: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
      },
    ],
  };
}

function mainApplication(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    carePathSpfaRef: ids.initialSpfa,
    protocolRef: { protocolId: ids.protocol, version: 'dispensing-1' },
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementRef: ids.informationRequirement,
        applicability: { status: 'APPLICABLE', effectiveImportance: 'RELEVANT' },
        informationTargets: [
          {
            targetId: ids.targetA,
            target: { kind: 'FACT', factRef: factIds.initialDemand },
          },
        ],
      },
      {
        kind: 'ACTION_REQUIREMENT',
        requirementRef: ids.actionRequirement,
        applicability: { status: 'APPLICABLE', effectiveImportance: 'RELEVANT' },
        actionTargets: [
          {
            targetId: ids.targetB,
            target: {
              kind: 'EVALUATOR_CONCLUSION',
              conclusionRef: ids.referral,
            },
          },
        ],
      },
      {
        kind: 'ACTION_REQUIREMENT',
        requirementRef: ids.transitionRequirement,
        applicability: { status: 'APPLICABLE', effectiveImportance: 'RELEVANT' },
        actionTargets: [
          {
            targetId: ids.targetC,
            target: {
              kind: 'CARE_PATH_TRANSITION',
              transitionRef: ids.transition,
            },
          },
        ],
      },
    ],
  };
}

function additionalApplication(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    carePathSpfaRef: ids.additionalSpfa,
    protocolRef: {
      protocolId: ids.additionalProtocol,
      version: 'indication-1',
    },
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementRef: ids.additionalRequirement,
        applicability: {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
        },
        informationTargets: [],
      },
    ],
  };
}

function core(): SpfaIntegratedGeneratedCaseCoreV2 {
  return {
    caseVersionId: ids.caseVersion,
    patientFacts: patientFacts(),
    evaluator: evaluator(),
    spfaProtocolSet: {
      schemaVersion: '2.0',
      catalogRef: { id: 'catalogo-spfa', version: '2026.1' },
      definitions: [mainDefinition(), additionalDefinition()],
      applications: [mainApplication(), additionalApplication()],
    },
  } as unknown as SpfaIntegratedGeneratedCaseCoreV2;
}

function transcript(messages?: readonly Record<string, unknown>[]) {
  return createSessionTranscriptSnapshotV2({
    sessionId: ids.session,
    caseVersionId: ids.caseVersion,
    messages:
      messages ??
      [
        {
          messageId: '3',
          role: 'student',
          content: 'Realizo la actuación profesional.',
          createdAt: '2026-08-24T09:00:02Z',
        },
        {
          messageId: '2',
          role: 'patient',
          content: 'Respuesta factual sintética.',
          createdAt: '2026-08-24T09:00:01Z',
        },
        {
          messageId: '1',
          role: 'student',
          content: 'Pregunta sintética.',
          createdAt: '2026-08-24T09:00:00Z',
        },
      ],
  });
}

function requirement(
  coreValue: SpfaIntegratedGeneratedCaseCoreV2,
  requirementRef = ids.informationRequirement,
): AppliedSpfaRequirementV2 {
  const application = coreValue.spfaProtocolSet.applications.find(
    (item) => item.carePathSpfaRef === ids.initialSpfa,
  );
  const result = application?.requirements.find(
    (item) => item.requirementRef === requirementRef,
  );
  if (result === undefined) throw new Error('fixture requirement missing');
  return result;
}

function baselineFor(
  coreValue: SpfaIntegratedGeneratedCaseCoreV2,
  transcriptValue = transcript(),
  requirementRef = ids.informationRequirement,
) {
  const clinicalContext = validateSpfaProtocolSetClinicalContextV2({
    caseVersionId: coreValue.caseVersionId,
    patientFacts: coreValue.patientFacts,
    evaluator: coreValue.evaluator,
  });
  const protocolSet = validateCaseSpfaProtocolSetAgainstCanonicalContextV2(
    coreValue.spfaProtocolSet,
    clinicalContext,
  );
  const canonicalCore = {
    ...coreValue,
    patientFacts: clinicalContext.patientFacts,
    evaluator: clinicalContext.evaluator,
    spfaProtocolSet: protocolSet,
  };
  return buildSpfaRequirementEvidenceBaselineV2({
    transcript: transcriptValue,
    carePathSpfaRef: ids.initialSpfa as never,
    appliedRequirement: requirement(canonicalCore, requirementRef),
  });
}

function build(
  coreValue = core(),
  transcriptValue = transcript(),
  requirementRef = ids.informationRequirement,
) {
  return buildSpfaSemanticTargetContextV2({
    core: coreValue,
    transcript: transcriptValue,
    baseline: baselineFor(coreValue, transcriptValue, requirementRef),
  });
}

function setInformationTargets(
  coreValue: SpfaIntegratedGeneratedCaseCoreV2,
  targets: readonly Record<string, unknown>[],
) {
  const application = coreValue.spfaProtocolSet.applications[0] as any;
  application.requirements[0].informationTargets = targets;
}

function factTarget(targetId: string, factRef: string) {
  return { targetId, target: { kind: 'FACT', factRef } };
}

describe('canonical SPFA semantic target context', () => {
  it('builds a semantic-required information context', () => {
    const result = build();
    expect(result).toMatchObject({
      schemaVersion: '2.0',
      contractVersion: 'spfa-semantic-target-context/1',
      sessionId: ids.session,
      caseVersionId: ids.caseVersion,
      carePathSpfaRef: ids.initialSpfa,
      requirementRef: ids.informationRequirement,
      kind: 'INFORMATION_REQUIREMENT',
      spfa: { service: 'dispensing', subtype: 'initial_treatment' },
      requirement: {
        kind: 'INFORMATION_REQUIREMENT',
        semanticDomain: {
          kind: 'patient_information',
          disclosureDomain: 'symptoms',
        },
        goal: 'Determinar el dato factual solicitado',
      },
    });
  });

  it('builds a deterministic-partial context without the public target', () => {
    const coreValue = core();
    setInformationTargets(coreValue, [
      {
        targetId: ids.publicTarget,
        target: { kind: 'PUBLIC_PROFILE', field: 'age' },
      },
      factTarget(ids.targetA, factIds.initialDemand),
    ]);
    const result = build(coreValue);
    expect(result.targets.map((target) => target.targetRef)).toEqual([ids.targetA]);
    expect(JSON.stringify(result)).not.toContain(ids.publicTarget);
  });

  it('builds an action conclusion context', () => {
    const result = build(core(), transcript(), ids.actionRequirement);
    expect(result).toMatchObject({
      kind: 'ACTION_REQUIREMENT',
      requirement: {
        semanticDomain: 'safe_professional_action',
        goal: 'Identificar la conclusión profesional expresada',
      },
      targets: [
        {
          targetRef: ids.targetB,
          candidateMessageRefs: ['1', '3'],
          target: {
            kind: 'EVALUATOR_CONCLUSION',
            conclusion: { kind: 'referral', value: { status: 'not_required' } },
          },
        },
      ],
    });
    expect(result.targets[0].target).not.toHaveProperty('conclusionId');
  });

  it.each([
    ['DETERMINISTIC_COMPLETE', [{ targetId: ids.publicTarget, target: { kind: 'PUBLIC_PROFILE', field: 'age' } }]],
    ['NOT_APPLICABLE', []],
  ])('rejects a %s baseline', (_label, targets) => {
    const coreValue = core();
    const application = coreValue.spfaProtocolSet.applications[0] as any;
    if (targets.length === 0) {
      application.requirements[0].applicability = {
        status: 'NOT_APPLICABLE',
        reason: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
      };
      const definition = coreValue.spfaProtocolSet.definitions[0] as any;
      definition.requirements[0].applicability = {
        kind: 'CASE_DETERMINED',
        policyRef: ids.policy,
      };
    }
    application.requirements[0].informationTargets = targets;
    const transcriptValue = transcript();
    const baseline = baselineFor(coreValue, transcriptValue);
    expect(() =>
      buildSpfaSemanticTargetContextV2({ core: coreValue, transcript: transcriptValue, baseline }),
    ).toThrow(/does not require semantic target context/);
  });
});

describe('D1/D2/core reconstruction and pinning', () => {
  it('rejects transcript session mismatch against the baseline', () => {
    const coreValue = core();
    const original = transcript();
    const baseline = baselineFor(coreValue, original);
    const changed = createSessionTranscriptSnapshotV2({
      sessionId: ids.otherSession,
      caseVersionId: ids.caseVersion,
      messages: original.messages,
    });
    expect(() =>
      buildSpfaSemanticTargetContextV2({ core: coreValue, transcript: changed, baseline }),
    ).toThrow(/canonical D2 baseline/);
  });

  it('rejects transcript caseVersion mismatch against the core', () => {
    const coreValue = core();
    const original = transcript();
    const baseline = baselineFor(coreValue, original);
    const changed = createSessionTranscriptSnapshotV2({
      sessionId: ids.session,
      caseVersionId: ids.otherCaseVersion,
      messages: original.messages,
    });
    expect(() =>
      buildSpfaSemanticTargetContextV2({ core: coreValue, transcript: changed, baseline }),
    ).toThrow(/must match the generated core case version/);
  });

  it('rejects transcript fingerprint mismatch', () => {
    const coreValue = core();
    const original = transcript();
    const baseline = baselineFor(coreValue, original);
    const changed = transcript([
      {
        messageId: '2',
        role: 'patient',
        content: 'Contenido diferente.',
        createdAt: '2026-08-24T09:00:01Z',
      },
    ]);
    expect(() =>
      buildSpfaSemanticTargetContextV2({ core: coreValue, transcript: changed, baseline }),
    ).toThrow(/canonical D2 baseline/);
  });

  it.each([
    ['unresolvedTargetRefs', (baseline: any) => baseline.unresolvedTargetRefs.reverse()],
    ['semanticCandidateUniverse', (baseline: any) => baseline.semanticCandidateUniverse.push({ targetRef: ids.targetA, messageRef: '99' })],
    ['resolution', (baseline: any) => { baseline.resolution = 'DETERMINISTIC_PARTIAL'; }],
  ])('rejects tampered baseline %s', (_field, tamper) => {
    const coreValue = core();
    setInformationTargets(coreValue, [
      factTarget(ids.targetA, factIds.initialDemand),
      factTarget(ids.targetD, factIds.healthProblem),
    ]);
    const transcriptValue = transcript();
    const baseline = clone(baselineFor(coreValue, transcriptValue)) as any;
    tamper(baseline);
    expect(() =>
      buildSpfaSemanticTargetContextV2({ core: coreValue, transcript: transcriptValue, baseline }),
    ).toThrow(SpfaSemanticTargetContextBuildError);
  });

  it('resolves the exact application, protocol definition and requirement definition', () => {
    const info = build();
    const action = build(core(), transcript(), ids.actionRequirement);
    expect(info.requirement.goal).toBe('Determinar el dato factual solicitado');
    expect(action.requirement.goal).toBe(
      'Identificar la conclusión profesional expresada',
    );
  });

  it('rejects an application protocol reference without its exact definition', () => {
    const coreValue = core() as any;
    coreValue.spfaProtocolSet.applications[0].protocolRef.version = 'missing';
    expect(() => build(coreValue)).toThrow(/pinned definition/);
  });

  it('rejects an unknown exact requirement reference', () => {
    const coreValue = core();
    const transcriptValue = transcript();
    const baseline = clone(baselineFor(coreValue, transcriptValue)) as any;
    baseline.requirementRef = ids.additionalRequirement;
    expect(() =>
      buildSpfaSemanticTargetContextV2({ core: coreValue, transcript: transcriptValue, baseline }),
    ).toThrow(/applied requirement/);
  });

  it('rejects a wrong baseline requirement kind', () => {
    const coreValue = core();
    const transcriptValue = transcript();
    const baseline = clone(baselineFor(coreValue, transcriptValue)) as any;
    baseline.kind = 'ACTION_REQUIREMENT';
    expect(() =>
      buildSpfaSemanticTargetContextV2({ core: coreValue, transcript: transcriptValue, baseline }),
    ).toThrow(/does not match application and definition/);
  });
});

describe('fact locations and datum semantics', () => {
  function factContext(factRef: string) {
    const coreValue = core();
    setInformationTargets(coreValue, [factTarget(ids.targetA, factRef)]);
    const result = build(coreValue);
    const target = result.targets[0].target;
    if (target.kind !== 'FACT') throw new Error('expected FACT target');
    return target;
  }

  it.each([
    [factIds.initialDemand, 'INITIAL_DEMAND', undefined],
    [factIds.personPresent, 'ENCOUNTER', 'PERSON_PRESENT'],
    [factIds.relationship, 'ENCOUNTER', 'RELATIONSHIP_TO_PATIENT'],
    [factIds.healthProblem, 'CLINICAL_CONTEXT', 'HEALTH_PROBLEM'],
    [factIds.biomedical, 'CLINICAL_CONTEXT', 'BIOMEDICAL_DATA'],
    [factIds.symptomDuration, 'SYMPTOM', 'DURATION'],
    [factIds.medicationPurpose, 'MEDICATION', 'PURPOSE_AS_UNDERSTOOD'],
    [factIds.actualDose, 'MEDICATION_USE', 'ACTUAL_DOSE'],
    [factIds.recentChange, 'MEDICATION_LINKED', 'RECENT_CHANGE'],
    [factIds.belief, 'PATIENT_CONTEXT', 'BELIEF_OR_CONCERN'],
  ])('projects controlled location for %s', (factRef, section, field) => {
    const target = factContext(factRef);
    expect(target.location.section).toBe(section);
    if (field !== undefined) expect(target.location).toHaveProperty('field', field);
  });

  it.each([
    [factIds.initialDemand, 'exact'],
    [factIds.healthProblem, 'approximate'],
    [factIds.physiological, 'uncertain'],
  ])('preserves known certainty %s', (factRef, certainty) => {
    expect(factContext(factRef).datum).toMatchObject({ state: 'known', certainty });
  });

  it('preserves explicit_absence with its semantic topic', () => {
    expect(factContext(factIds.allergy).datum).toEqual({
      state: 'explicit_absence',
      topic: 'alergias conocidas',
    });
  });

  it('preserves patient_unknown and never converts it to a negative', () => {
    const datum = factContext(factIds.clinicalHistory).datum;
    expect(datum).toEqual({
      state: 'patient_unknown',
      topic: 'diagnóstico antiguo',
    });
    expect(JSON.stringify(datum)).not.toMatch(/absence|negative|none/);
  });

  it('projects biomedical values canonically', () => {
    expect(factContext(factIds.biomedical).datum).toEqual({
      state: 'known',
      certainty: 'exact',
      value: {
        type: 'blood_pressure',
        value: 135,
        unit: 'mmHg',
        timingOrContext: 'esta mañana',
      },
    });
  });

  it('uses only symptom description as identifying symptom context', () => {
    const location = factContext(factIds.symptomDuration).location;
    expect(location).toEqual({
      section: 'SYMPTOM',
      field: 'DURATION',
      symptom: {
        state: 'known',
        certainty: 'exact',
        value: 'Tos seca',
      },
    });
    expect(JSON.stringify(location)).not.toContain('Comenzó el lunes');
  });

  it('uses only medication displayName as medication identity', () => {
    const location = factContext(factIds.referenceDose).location;
    expect(location).toHaveProperty('medication', {
      displayName: {
        state: 'known',
        certainty: 'exact',
        value: 'Enalapril 20 mg',
      },
    });
    expect(JSON.stringify(location)).not.toContain('Una vez al día');
  });
});

describe('medication and action target projections', () => {
  it('projects MEDICATION_ENTITY with only canonical display identity', () => {
    const coreValue = core();
    setInformationTargets(coreValue, [
      {
        targetId: ids.targetA,
        target: { kind: 'MEDICATION_ENTITY', medicationRef: ids.medication },
      },
    ]);
    const target = build(coreValue).targets[0].target;
    expect(target).toEqual({
      kind: 'MEDICATION_ENTITY',
      medication: {
        displayName: {
          state: 'known',
          certainty: 'exact',
          value: 'Enalapril 20 mg',
        },
      },
    });
  });

  it.each([
    [factIds.referenceDose, 'MEDICATION'],
    [factIds.actualDose, 'MEDICATION_USE'],
    [factIds.effectiveness, 'MEDICATION_LINKED'],
  ])('projects structurally linked MEDICATION_FACT from %s', (factRef, section) => {
    const coreValue = core();
    setInformationTargets(coreValue, [
      {
        targetId: ids.targetA,
        target: {
          kind: 'MEDICATION_FACT',
          medicationRef: ids.medication,
          factRef,
        },
      },
    ]);
    const target = build(coreValue).targets[0].target;
    expect(target.kind).toBe('MEDICATION_FACT');
    if (target.kind === 'MEDICATION_FACT') {
      expect(target.fact.location.section).toBe(section);
      expect(Object.keys(target.medication)).toEqual(['displayName']);
      expect(Object.keys(target.fact)).toEqual(['location', 'datum']);
    }
  });

  it('projects CARE_PATH_TRANSITION as service semantics without internal IDs', () => {
    const result = build(core(), transcript(), ids.transitionRequirement);
    expect(result.targets[0].target).toEqual({
      kind: 'CARE_PATH_TRANSITION',
      from: { service: 'dispensing', subtype: 'initial_treatment' },
      to: { service: 'pharmaceutical_indication' },
    });
    const serialized = JSON.stringify(result.targets[0].target);
    expect(serialized).not.toContain(ids.transition);
    expect(serialized).not.toContain(ids.initialSpfa);
    expect(serialized).not.toContain(ids.additionalSpfa);
  });
});

describe('ordering, minimality and leak prevention', () => {
  it('uses unresolved target order and D2 candidate order exactly', () => {
    const coreValue = core();
    setInformationTargets(coreValue, [
      factTarget(ids.targetD, factIds.healthProblem),
      factTarget(ids.targetA, factIds.initialDemand),
    ]);
    const transcriptValue = transcript();
    const baseline = baselineFor(coreValue, transcriptValue);
    const result = buildSpfaSemanticTargetContextV2({
      core: coreValue,
      transcript: transcriptValue,
      baseline,
    });
    expect(result.targets.map((target) => target.targetRef)).toEqual(
      baseline.unresolvedTargetRefs,
    );
    expect(result.targets.map((target) => target.candidateMessageRefs)).toEqual([
      ['2'],
      ['2'],
    ]);
  });

  it('allows empty candidateMessageRefs without inventing messages', () => {
    const transcriptValue = transcript([
      {
        messageId: '1',
        role: 'student',
        content: 'Solo mensaje del estudiante.',
        createdAt: '2026-08-24T09:00:00Z',
      },
    ]);
    expect(build(core(), transcriptValue).targets[0].candidateMessageRefs).toEqual([]);
  });

  it('contains no disclosure, scoring, source bundle or evaluator-rule metadata', () => {
    const contexts = [
      build(),
      build(core(), transcript(), ids.actionRequirement),
      build(core(), transcript(), ids.transitionRequirement),
    ];
    const serialized = JSON.stringify(contexts);
    [
      'disclosure',
      'delayedBy',
      'communicationProfile',
      'teacherLabel',
      'teacherRationale',
      'defaultImportance',
      'effectiveImportance',
      'safetyCriticality',
      'evidenceRules',
      'sourceBrief',
      'teachingSummary',
      'complianceReport',
      'provenance',
    ].forEach((key) => expect(serialized).not.toContain(`"${key}"`));
    expect(serialized).not.toContain('fact_');
    expect(serialized).not.toContain('med_');
  });

  it('does not include transcript content or semantic adjudication statuses', () => {
    const serialized = JSON.stringify(build());
    expect(serialized).not.toContain('Respuesta factual sintética');
    expect(serialized).not.toContain('SUPPORTED');
    expect(serialized).not.toContain('NOT_SUPPORTED');
    expect(serialized).not.toContain('UNCERTAIN');
  });

  it('ignores a completely unrelated clinical fact and preserves fingerprint', () => {
    const firstCore = core();
    const secondCore = core() as any;
    secondCore.patientFacts.beliefsAndConcerns[0].value =
      'Creencia clínica totalmente diferente';
    const first = build(firstCore);
    const second = build(secondCore);
    expect(second).toEqual(first);
    expect(second.fingerprint).toEqual(first.fingerprint);
  });
});

describe('semantic target context fingerprint and immutability', () => {
  it('keeps the historical report fingerprint and ignores new technical content IDs', () => {
    const historical = core() as any;
    historical.evaluator.referral.value = {
      status: 'required',
      urgency: 'non_urgent',
      destination: { label: 'Medicina de familia' },
      reason: 'Revisión clínica',
      report: {
        status: 'required',
        essentialContents: ['Motivo de derivación', 'Tratamiento actual'],
      },
    };
    const identified = clone(historical) as any;
    identified.evaluator.referral.value.report = {
      contractVersion: 'identified-report-requirement/1',
      status: 'required',
      essentialContents: [
        {
          contentId:
            'report_content_50000000-0000-4000-8000-000000000001',
          content: 'Motivo de derivación',
        },
        {
          contentId:
            'report_content_50000000-0000-4000-8000-000000000002',
          content: 'Tratamiento actual',
        },
      ],
    };

    const historicalContext = build(historical);
    const identifiedContext = build(identified);
    expect(identifiedContext.fingerprint).toEqual(historicalContext.fingerprint);
    expect(JSON.stringify(identifiedContext)).not.toContain('report_content_');
  });

  it('is stable for the same canonical input and an equivalent deep copy', () => {
    const original = core();
    const first = build(original);
    const second = build(original);
    const third = build(clone(original));
    expect(second.fingerprint).toEqual(first.fingerprint);
    expect(third.fingerprint).toEqual(first.fingerprint);
    expect(first.fingerprint).toMatchObject({
      algorithm: 'sha256',
      canonicalization: 'spfa-semantic-target-context-v2/1',
      value: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
  });

  it.each([
    ['fact value', (coreValue: any) => { coreValue.patientFacts.initialDemand.value = 'Otra demanda'; }],
    ['goal', (coreValue: any) => { coreValue.spfaProtocolSet.definitions[0].requirements[0].informationGoal = 'Otro objetivo'; }],
  ])('changes fingerprint after meaningful %s change', (_label, mutate) => {
    const first = build();
    const changed = core() as any;
    mutate(changed);
    expect(build(changed).fingerprint.value).not.toBe(first.fingerprint.value);
  });

  it('changes fingerprint after a real fact state change', () => {
    const firstCore = core();
    setInformationTargets(firstCore, [
      factTarget(ids.targetA, factIds.symptomEvolution),
    ]);
    const changed = core() as any;
    setInformationTargets(changed, [
      factTarget(ids.targetA, factIds.symptomEvolution),
    ]);
    changed.patientFacts.symptoms[0].evolution = known(
      factIds.symptomEvolution,
      'La tos está mejorando',
    );
    expect(build(changed).fingerprint.value).not.toBe(
      build(firstCore).fingerprint.value,
    );
  });

  it('changes fingerprint when the same datum moves to another semantic location', () => {
    const first = build();
    const changed = core() as any;
    changed.patientFacts.clinicalContext.healthProblems[0] = known(
      factIds.healthProblem,
      'Consulta por tos',
    );
    setInformationTargets(changed, [
      factTarget(ids.targetA, factIds.healthProblem),
    ]);
    const second = build(changed);
    expect(second.targets[0].target).toHaveProperty(
      'location.section',
      'CLINICAL_CONTEXT',
    );
    expect(second.fingerprint.value).not.toBe(first.fingerprint.value);
  });

  it('changes fingerprint with target order and candidateMessageRefs', () => {
    const firstCore = core();
    setInformationTargets(firstCore, [
      factTarget(ids.targetA, factIds.initialDemand),
      factTarget(ids.targetD, factIds.healthProblem),
    ]);
    const reversedCore = core();
    setInformationTargets(reversedCore, [
      factTarget(ids.targetA, factIds.healthProblem),
      factTarget(ids.targetD, factIds.initialDemand),
    ]);
    const first = build(firstCore);
    const reversed = build(reversedCore);
    const fewerCandidates = build(
      firstCore,
      transcript([
        {
          messageId: '1',
          role: 'student',
          content: 'Sin respuesta del paciente.',
          createdAt: '2026-08-24T09:00:00Z',
        },
      ]),
    );
    expect(reversed.fingerprint.value).not.toBe(first.fingerprint.value);
    expect(fewerCandidates.fingerprint.value).not.toBe(first.fingerprint.value);
  });

  it('changes fingerprint with transition and target conclusion semantics', () => {
    const transitionFirst = build(core(), transcript(), ids.transitionRequirement);
    const changedTransitionCore = core() as any;
    changedTransitionCore.evaluator.carePath.additionalSpfas[0].value.service =
      'medication_adherence';
    changedTransitionCore.spfaProtocolSet.definitions[1].service =
      'medication_adherence';
    const transitionSecond = build(
      changedTransitionCore,
      transcript(),
      ids.transitionRequirement,
    );
    expect(transitionSecond.fingerprint.value).not.toBe(
      transitionFirst.fingerprint.value,
    );

    const conclusionFirst = build(core(), transcript(), ids.actionRequirement);
    const changedConclusionCore = core() as any;
    changedConclusionCore.spfaProtocolSet.applications[0].requirements[1].actionTargets[0].target.conclusionRef =
      ids.incidence;
    const conclusionSecond = build(
      changedConclusionCore,
      transcript(),
      ids.actionRequirement,
    );
    expect(conclusionSecond.fingerprint.value).not.toBe(
      conclusionFirst.fingerprint.value,
    );
  });

  it('does not retain mutable references or mutate any input', () => {
    const coreValue = core();
    const transcriptValue = transcript();
    const baseline = baselineFor(coreValue, transcriptValue);
    const coreBefore = clone(coreValue);
    const transcriptBefore = clone(transcriptValue);
    const baselineBefore = clone(baseline);
    const result = buildSpfaSemanticTargetContextV2({
      core: coreValue,
      transcript: transcriptValue,
      baseline,
    });
    expect(coreValue).toEqual(coreBefore);
    expect(transcriptValue).toEqual(transcriptBefore);
    expect(baseline).toEqual(baselineBefore);
    (coreValue.patientFacts as any).initialDemand.value = 'Mutación posterior';
    (coreValue.spfaProtocolSet as any).definitions[0].requirements[0].informationGoal =
      'Mutación posterior';
    expect(result.requirement.goal).toBe('Determinar el dato factual solicitado');
    expect(result.targets[0].target).toHaveProperty('datum.value', 'Consulta por tos');
  });
});
