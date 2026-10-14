

import {
  attachSpfaProtocolSetToGeneratedCaseCoreV2,
  SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
} from '../../../lib/cases/v2/attach-spfa-protocol-set';
import { buildGeneratedCaseBundleV2 } from '../../../lib/cases/v2/build-generated-case-bundle';
import {
  GeneratedCaseBundleBuildError,
  type GenerationProvenanceV2,
} from '../../../lib/cases/v2/generated-case-bundle-types';
import type { CanonicalGeneratedCaseCoreV2 } from '../../../lib/cases/v2/generation-assembly-types';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from '../../../lib/cases/v2/spfa-protocol-set-types';
import type { TeachingCaseGenerationBriefV2 } from '../../../lib/cases/v2/teaching-brief-types';
import { validateTeachingCaseGenerationBriefV2 } from '../../../lib/cases/v2/validate-teaching-brief';

const caseVersionId = 'casever_90000000-0000-4000-8000-000000000001';
const factId = 'fact_10000000-0000-4000-8000-000000000001';
const personFactId = 'fact_10000000-0000-4000-8000-000000000002';
const briefId = 'brief_90000000-0000-4000-8000-000000000001';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function communicationProfile() {
  return {
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
  };
}

function knownFact(id: string, value: string) {
  return {
    state: 'known',
    factId: id,
    value,
    certainty: 'exact',
    disclosure: { mode: 'spontaneous' },
  };
}

function evidenceRule(conclusionRef: string) {
  return {
    conclusionRef,
    requiredEvidence: { operator: 'fact', factRef: factId },
    supportingEvidenceRefs: [],
    counterEvidenceRefs: [],
    teacherRationale: `Evidencia para ${conclusionRef}`,
  };
}

function createCore(): CanonicalGeneratedCaseCoreV2 {
  const conclusions = {
    spfa: 'conclusion_40000000-0000-4000-8000-000000000001',
    incidenceAssessment:
      'conclusion_40000000-0000-4000-8000-000000000002',
    prmAssessment: 'conclusion_40000000-0000-4000-8000-000000000003',
    rnmAssessment: 'conclusion_40000000-0000-4000-8000-000000000004',
    referral: 'conclusion_40000000-0000-4000-8000-000000000005',
  };
  return {
    caseVersionId: caseVersionId as any,
    patientFacts: {
      schemaVersion: '2.0',
      caseVersionId: caseVersionId as any,
      publicProfile: {
        nombre: 'Paciente Sintético de Publicación',
        edad: 68,
        sexo: 'mujer',
        tratamiento: 'Sin medicación estructurada',
      },
      initialDemand: knownFact(factId, 'Solicita consejo') as any,
      encounter: {
        personPresent: knownFact(personFactId, 'patient') as any,
        relationshipToPatient: {
          state: 'not_applicable',
          reasonCode: 'not_applicable_to_patient',
        },
      },
      clinicalContext: {
        healthProblems: [],
        clinicalHistory: [],
        physiologicalSituation: [],
        pregnancyAndLactation: {
          state: 'not_applicable',
          reasonCode: 'not_applicable_to_patient',
        },
        allergiesAndIntolerances: [],
        lifestyle: [],
        biomedicalData: [],
      },
      symptoms: [],
      pharmacotherapy: {
        prescribedMedications: [],
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
      communicationProfile: communicationProfile() as any,
    },
    evaluator: {
      schemaVersion: '2.0',
      caseVersionId: caseVersionId as any,
      versions: {
        evaluatorSchema: { id: 'evaluator-v2', version: '2.0' },
        protocol: { id: 'foro-af-fc', version: '2024' },
        prmTaxonomy: { id: 'prm', version: '2024' },
        rnmTaxonomy: { id: 'rnm', version: '2024' },
        adherenceFramework: { id: 'adherence', version: '1' },
      },
      carePath: {
        initialSpfa: {
          conclusionId: conclusions.spfa as any,
          kind: 'spfa',
          value: { service: 'dispensing', subtype: 'continuation' },
        },
        additionalSpfas: [],
        transitions: [],
      },
      incidence: {
        assessment: {
          conclusionId: conclusions.incidenceAssessment as any,
          kind: 'incidence_assessment',
          value: { status: 'none' },
        },
        findings: [],
        followUpEpisodes: [],
      },
      prm: {
        assessment: {
          conclusionId: conclusions.prmAssessment as any,
          kind: 'prm_assessment',
          value: { status: 'none' },
        },
        findings: [],
      },
      rnmAssessments: [
        {
          conclusionId: conclusions.rnmAssessment as any,
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
        conclusionId: conclusions.referral as any,
        kind: 'referral',
        value: { status: 'not_required' },
      },
      evidenceRules: [
        evidenceRule(conclusions.incidenceAssessment),
        evidenceRule(conclusions.prmAssessment),
        evidenceRule(conclusions.rnmAssessment),
        evidenceRule(conclusions.referral),
      ] as any,
    },
  };
}

function createBriefUnknown(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    briefId,
    revision: { number: 1 },
    generationMode: 'strict',
    complexity: 'low',
    carePath: {
      initialSpfa: {
        targeting: 'targeted',
        decision: {
          mode: 'teacher_fixed',
          value: {
            service: 'dispensing',
            dispensingSubtype: {
              mode: 'teacher_fixed',
              value: 'continuation',
            },
          },
        },
      },
      additionalSpfas: [],
      transitions: {
        targeting: 'targeted',
        decision: { mode: 'teacher_fixed', value: [] },
      },
    },
    incidence: {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: { status: 'none' } },
    },
    prm: {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: { status: 'none' } },
    },
    rnm: {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: { status: 'no_rnm' } },
    },
    adherence: { targeting: 'not_targeted', policy: 'forbidden' },
    adherenceStrategies: { targeting: 'not_targeted', policy: 'forbidden' },
    professionalActions: { targeting: 'not_targeted', policy: 'forbidden' },
    pharmaceuticalInterventions: {
      targeting: 'not_targeted',
      policy: 'forbidden',
    },
    referral: {
      targeting: 'targeted',
      decision: { mode: 'teacher_fixed', value: { status: 'not_required' } },
    },
  };
}

function createBrief(source = createBriefUnknown()): TeachingCaseGenerationBriefV2 {
  return validateTeachingCaseGenerationBriefV2(source);
}

function requiredInitialDemandFactId(core: CanonicalGeneratedCaseCoreV2) {
  const initialDemand = core.patientFacts.initialDemand;
  if (initialDemand.state !== 'known') {
    throw new Error('fixture initialDemand must be known');
  }
  return initialDemand.factId;
}

function createProtocolSet(
  core: CanonicalGeneratedCaseCoreV2,
  variant: 'primary' | 'alternate' = 'primary',
): Record<string, unknown> {
  const suffix = variant === 'primary' ? '1' : '2';
  const spfa = core.evaluator.carePath.initialSpfa;
  const protocolId = `spfa_protocol_50000000-0000-4000-8000-00000000000${suffix}`;
  const requirementId = `spfa_requirement_60000000-0000-4000-8000-00000000000${suffix}`;
  const definition = {
    schemaVersion: '2.0',
    protocolId,
    version: `test-${suffix}`,
    service: spfa.value.service,
    ...(spfa.value.service === 'dispensing'
      ? { subtype: spfa.value.subtype }
      : {}),
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementId,
        semanticDomain: {
          kind: 'patient_information',
          disclosureDomain: 'initial_demand',
        },
        teacherLabel: `Demanda inicial ${suffix}`,
        description: `Comprueba la demanda inicial ${suffix}`,
        defaultImportance: 'RELEVANT',
        informationGoal: `Conocer la demanda ${suffix}`,
        safetyCriticality: { safetyCritical: false },
        applicability: { kind: 'ALWAYS' },
      },
    ],
  };
  return {
    schemaVersion: '2.0',
    catalogRef: { ...core.evaluator.versions.protocol },
    definitions: [definition],
    applications: [
      {
        schemaVersion: '2.0',
        caseVersionId: core.caseVersionId,
        carePathSpfaRef: spfa.conclusionId,
        protocolRef: { protocolId, version: definition.version },
        requirements: [
          {
            kind: 'INFORMATION_REQUIREMENT',
            requirementRef: requirementId,
            applicability: {
              status: 'APPLICABLE',
              effectiveImportance: 'RELEVANT',
            },
            informationTargets: [
              {
                targetId: `spfa_target_70000000-0000-4000-8000-00000000000${suffix}`,
                target: {
                  kind: 'FACT',
                  factRef: requiredInitialDemandFactId(core),
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

function createIntegratedCore(
  core = createCore(),
  variant: 'primary' | 'alternate' = 'primary',
): SpfaIntegratedGeneratedCaseCoreV2 {
  return attachSpfaProtocolSetToGeneratedCaseCoreV2(
    core,
    createProtocolSet(core, variant),
  );
}

function createProvenance(): GenerationProvenanceV2 {
  return {
    generatorContractVersion: 'ai-generated-case-draft/1',
    promptVersion: 'case-generator/1',
    model: { provider: 'synthetic', identifier: 'offline-publication-fixture' },
    assemblerVersion: 'generation-assembly/1',
    disclosurePolicyVersion: 'disclosure-policy/1',
    spfaIntegrationVersion: SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
  };
}


/** Synthetic structural package, never clinical acceptance evidence. */
export function publicationFixture(id: string) {
  const bundle=buildGeneratedCaseBundleV2(createBrief(),createIntegratedCore(),createProvenance());
  return JSON.parse(JSON.stringify(bundle).replaceAll(caseVersionId,id));
}

export function publicationDraftFields(): import('../../../lib/cases/v2/teacher-case-draft').TeacherDraftFields {
 return {title:'DEMO SINTÉTICA · Publicación técnica',service:'DISPENSATION',identity:{nombre:'Paciente Sintético de Publicación',edad:68,sexo:'mujer'},
  initialDemand:'Solicita consejo',treatment:'Sin medicación estructurada',
  facts:[{id:'F1',label:'Demanda sintética',value:'Solicita consejo',disclosure:'Al comenzar la entrevista.'}],
  adherence:{conclusion:'NOT_DETERMINABLE',period:'No definido',evidence:'No existen tomas documentadas.',factRefs:['F1'],interpretation:'Sin conclusión de adherencia. Fixture técnico, no caso clínico publicable en producción.'},
  teacherSolution:'Fixture técnico sin incidencias, PRM, RNM ni derivación en su paquete artificial. No acredita una solución clínica real.',
  requirements:[{label:'Demanda',goal:'Identificar la demanda sintética.',applicability:'APPLICABLE',rationale:'Único objetivo técnico de la fixture.',factRefs:['F1'],guidePages:'No aplicable: prueba de integración técnica.'}],
  questionnaire:[{question:'¿Qué expresa al comenzar?',answer:'Solicita consejo.',factRefs:['F1']}]};
}
