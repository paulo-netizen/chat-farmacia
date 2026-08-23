import { describe, expect, it } from 'vitest';

import { attachSpfaProtocolSetToGeneratedCaseCoreV2 } from '@/lib/cases/v2/attach-spfa-protocol-set';
import type { CanonicalGeneratedCaseCoreV2 } from '@/lib/cases/v2/generation-assembly-types';
import {
  SpfaProtocolSetValidationError,
  validateCaseSpfaProtocolSetV2,
} from '@/lib/cases/v2/validate-spfa-protocol-set';

const ids = {
  caseVersion: 'casever_90000000-0000-4000-8000-000000000011',
  otherCaseVersion: 'casever_90000000-0000-4000-8000-000000000012',
  indicationProtocol: 'spfa_protocol_10000000-0000-4000-8000-000000000001',
  dispensingProtocol: 'spfa_protocol_10000000-0000-4000-8000-000000000002',
  unusedProtocol: 'spfa_protocol_10000000-0000-4000-8000-000000000003',
  indicationRequirement:
    'spfa_requirement_20000000-0000-4000-8000-000000000001',
  dispensingRequirement:
    'spfa_requirement_20000000-0000-4000-8000-000000000002',
  unusedRequirement:
    'spfa_requirement_20000000-0000-4000-8000-000000000003',
  policy: 'spfa_policy_30000000-0000-4000-8000-000000000001',
  dispensingTarget: 'spfa_target_40000000-0000-4000-8000-000000000001',
  medication: 'med_50000000-0000-4000-8000-000000000001',
  demandFact: 'fact_60000000-0000-4000-8000-000000000001',
  personFact: 'fact_60000000-0000-4000-8000-000000000002',
  medicationFact: 'fact_60000000-0000-4000-8000-000000000003',
  medicationOriginFact: 'fact_60000000-0000-4000-8000-000000000004',
  initialSpfa: 'conclusion_70000000-0000-4000-8000-000000000001',
  additionalSpfa: 'conclusion_70000000-0000-4000-8000-000000000002',
  transition: 'conclusion_70000000-0000-4000-8000-000000000003',
  incidence: 'conclusion_70000000-0000-4000-8000-000000000004',
  prm: 'conclusion_70000000-0000-4000-8000-000000000005',
  rnm: 'conclusion_70000000-0000-4000-8000-000000000006',
  referral: 'conclusion_70000000-0000-4000-8000-000000000007',
} as const;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function known(factId: string, value: unknown) {
  return {
    state: 'known',
    factId,
    value,
    certainty: 'exact',
    disclosure: { mode: 'spontaneous' },
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
      edad: 48,
      sexo: 'mujer',
      tratamiento: 'Medicamento sintético',
    },
    initialDemand: known(ids.demandFact, 'Demanda sintética'),
    encounter: {
      personPresent: known(ids.personFact, 'patient'),
      relationshipToPatient: { ...notApplicable },
    },
    clinicalContext: {
      healthProblems: [],
      clinicalHistory: [],
      physiologicalSituation: [],
      pregnancyAndLactation: { ...notApplicable },
      allergiesAndIntolerances: [],
      lifestyle: [],
      biomedicalData: [],
    },
    symptoms: [],
    pharmacotherapy: {
      prescribedMedications: [
        {
          medicationId: ids.medication,
          displayName: known(ids.medicationFact, 'Medicamento sintético'),
          origin: known(ids.medicationOriginFact, 'prescribed'),
          purposeAsUnderstood: { ...notApplicable },
          regimenBasis: { ...notApplicable },
          referenceDose: { ...notApplicable },
          referenceSchedule: { ...notApplicable },
          referenceDuration: { ...notApplicable },
          administrationMethod: { ...notApplicable },
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
  };
}

function evidenceRule(conclusionRef: string) {
  return {
    conclusionRef,
    requiredEvidence: { operator: 'fact', factRef: ids.demandFact },
    supportingEvidenceRefs: [],
    counterEvidenceRefs: [],
    teacherRationale: 'Justificación sintética',
  };
}

function evaluator(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    versions: {
      evaluatorSchema: { id: 'evaluator-v2', version: '2.0' },
      protocol: { id: 'catalogo-docente-spfa', version: '2026.1' },
      prmTaxonomy: { id: 'prm-test', version: '1' },
      rnmTaxonomy: { id: 'rnm-test', version: '1' },
      adherenceFramework: { id: 'adherence-test', version: '1' },
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

function dispensingDefinition(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    protocolId: ids.dispensingProtocol,
    version: 'dispensing-1',
    service: 'dispensing',
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementId: ids.dispensingRequirement,
        semanticDomain: {
          kind: 'protocol_information',
          domain: 'dispensing_subtype',
        },
        teacherLabel: 'Subtipo de dispensación',
        description: 'Distingue el subtipo',
        defaultImportance: 'CRITICAL',
        informationGoal: 'Identificar el subtipo',
        safetyCriticality: { safetyCritical: true },
        applicability: {
          kind: 'DISPENSING_SUBTYPE',
          subtypes: ['initial_treatment'],
        },
      },
    ],
  };
}

function indicationDefinition(): Record<string, any> {
  return {
    schemaVersion: '2.0',
    protocolId: ids.indicationProtocol,
    version: 'indication-1',
    service: 'pharmaceutical_indication',
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementId: ids.indicationRequirement,
        semanticDomain: {
          kind: 'patient_information',
          disclosureDomain: 'symptoms',
        },
        teacherLabel: 'Información pertinente',
        description: 'Requisito dependiente del caso',
        defaultImportance: 'RELEVANT',
        informationGoal: 'Obtener información pertinente',
        safetyCriticality: { safetyCritical: false },
        applicability: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
      },
    ],
  };
}

function dispensingApplication(
  definition = dispensingDefinition(),
): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    carePathSpfaRef: ids.initialSpfa,
    protocolRef: {
      protocolId: definition.protocolId,
      version: definition.version,
    },
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementRef: definition.requirements[0].requirementId,
        applicability: {
          status: 'APPLICABLE',
          effectiveImportance: 'CRITICAL',
        },
        informationTargets: [
          {
            targetId: ids.dispensingTarget,
            target: { kind: 'FACT', factRef: ids.demandFact },
          },
        ],
      },
    ],
  };
}

function indicationApplication(
  definition = indicationDefinition(),
): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    carePathSpfaRef: ids.additionalSpfa,
    protocolRef: {
      protocolId: definition.protocolId,
      version: definition.version,
    },
    requirements: [
      {
        kind: 'INFORMATION_REQUIREMENT',
        requirementRef: definition.requirements[0].requirementId,
        applicability: {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
        },
        informationTargets: [],
      },
    ],
  };
}

function protocolSet(): Record<string, any> {
  const dispensing = dispensingDefinition();
  const indication = indicationDefinition();
  return {
    schemaVersion: '2.0',
    catalogRef: { id: 'catalogo-docente-spfa', version: '2026.1' },
    definitions: [dispensing, indication],
    applications: [
      indicationApplication(indication),
      dispensingApplication(dispensing),
    ],
  };
}

function validationContext(
  facts = patientFacts(),
  evaluatorInput = evaluator(),
): any {
  return {
    caseVersionId: ids.caseVersion,
    patientFacts: facts,
    evaluator: evaluatorInput,
  };
}

function core(): CanonicalGeneratedCaseCoreV2 {
  return {
    caseVersionId: ids.caseVersion,
    patientFacts: patientFacts(),
    evaluator: evaluator(),
  } as CanonicalGeneratedCaseCoreV2;
}

function expectInvalid(
  operation: () => unknown,
  expectedPath?: string,
): SpfaProtocolSetValidationError {
  try {
    operation();
    throw new Error('expected validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(SpfaProtocolSetValidationError);
    const validationError = error as SpfaProtocolSetValidationError;
    if (expectedPath !== undefined) expect(validationError.path).toBe(expectedPath);
    expect(validationError.message).toBe(
      `${validationError.path}: ${validationError.message.slice(
        validationError.path.length + 2,
      )}`,
    );
    expect(JSON.stringify(validationError)).not.toContain('Paciente sintética');
    return validationError;
  }
}

describe('CaseSpfaProtocolSetV2', () => {
  it('validates one initial SPFA with one pinned definition and application', () => {
    const evaluatorInput = evaluator();
    evaluatorInput.carePath.additionalSpfas = [];
    evaluatorInput.carePath.transitions = [];
    const definition = dispensingDefinition();
    const input = protocolSet();
    input.definitions = [definition];
    input.applications = [dispensingApplication(definition)];

    const parsed = validateCaseSpfaProtocolSetV2(
      input,
      validationContext(patientFacts(), evaluatorInput),
    );

    expect(parsed.applications).toHaveLength(1);
    expect(parsed.applications[0].carePathSpfaRef).toBe(ids.initialSpfa);
  });

  it('requires one application for initialSpfa and every additionalSpfa', () => {
    const parsed = validateCaseSpfaProtocolSetV2(
      protocolSet(),
      validationContext(),
    );

    expect(parsed.applications.map((item) => item.carePathSpfaRef)).toEqual([
      ids.initialSpfa,
      ids.additionalSpfa,
    ]);
  });

  it('uses catalogRef for evaluator protocol version and individual refs for definitions', () => {
    const input = protocolSet();
    const parsed = validateCaseSpfaProtocolSetV2(input, validationContext());

    expect(parsed.catalogRef).toEqual({
      id: 'catalogo-docente-spfa',
      version: '2026.1',
    });
    expect(parsed.catalogRef.id).not.toBe(parsed.definitions[0].protocolId);
    expect(parsed.applications[0].protocolRef).toEqual({
      protocolId: ids.dispensingProtocol,
      version: 'dispensing-1',
    });
  });

  it('sorts definitions by protocolId/version and applications by evaluator care path', () => {
    const input = protocolSet();
    expect(input.definitions.map((item: any) => item.protocolId)).toEqual([
      ids.dispensingProtocol,
      ids.indicationProtocol,
    ]);
    expect(input.applications.map((item: any) => item.carePathSpfaRef)).toEqual([
      ids.additionalSpfa,
      ids.initialSpfa,
    ]);

    const parsed = validateCaseSpfaProtocolSetV2(input, validationContext());

    expect(parsed.definitions.map((item) => item.protocolId)).toEqual([
      ids.indicationProtocol,
      ids.dispensingProtocol,
    ]);
    expect(parsed.applications.map((item) => item.carePathSpfaRef)).toEqual([
      ids.initialSpfa,
      ids.additionalSpfa,
    ]);
  });

  it('accepts the same protocolId with different versions when both are used', () => {
    const input = protocolSet();
    input.definitions[1].protocolId = ids.dispensingProtocol;
    input.definitions[1].version = 'indication-2';
    input.applications[0].protocolRef = {
      protocolId: ids.dispensingProtocol,
      version: 'indication-2',
    };

    const parsed = validateCaseSpfaProtocolSetV2(input, validationContext());

    expect(parsed.definitions.map((item) => item.version)).toEqual([
      'dispensing-1',
      'indication-2',
    ]);
  });

  it('reconstructs canonical copies at every aggregate boundary', () => {
    const input = protocolSet();
    const parsed = validateCaseSpfaProtocolSetV2(input, validationContext());

    expect(parsed).not.toBe(input);
    expect(parsed.catalogRef).not.toBe(input.catalogRef);
    expect(parsed.definitions).not.toBe(input.definitions);
    expect(parsed.applications).not.toBe(input.applications);
    const originalDispensing = input.definitions[0];
    const parsedDispensing = parsed.definitions.find(
      (item) => item.protocolId === ids.dispensingProtocol,
    )!;
    expect(parsedDispensing).not.toBe(originalDispensing);
    expect(parsedDispensing.requirements).not.toBe(
      originalDispensing.requirements,
    );
    const originalDispensingApplication = input.applications[1];
    expect(parsed.applications[0]).not.toBe(originalDispensingApplication);
    expect(parsed.applications[0].requirements).not.toBe(
      originalDispensingApplication.requirements,
    );
    expect(parsed.applications[0].requirements[0].applicability).not.toBe(
      originalDispensingApplication.requirements[0].applicability,
    );
  });

  it('accepts a materialized CASE_DETERMINED decision', () => {
    const parsed = validateCaseSpfaProtocolSetV2(
      protocolSet(),
      validationContext(),
    );
    expect(parsed.applications[1].requirements[0].applicability).toEqual({
      status: 'NOT_APPLICABLE',
      reason: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
    });
  });

  it('accepts a matching dispensing subtype application', () => {
    const parsed = validateCaseSpfaProtocolSetV2(
      protocolSet(),
      validationContext(),
    );
    expect(parsed.applications[0].requirements[0].applicability).toEqual({
      status: 'APPLICABLE',
      effectiveImportance: 'CRITICAL',
    });
  });

  it.each(['score', 'evidence', 'transcript'])('rejects root %s', (field) => {
    const input = protocolSet();
    input[field] = 'forbidden';
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      `caseSpfaProtocolSet.${field}`,
    );
  });

  it('rejects a wrong schemaVersion', () => {
    const input = protocolSet();
    input.schemaVersion = '1.0';
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.schemaVersion',
    );
  });

  it('rejects another unexpected root property', () => {
    const input = protocolSet();
    input.latest = true;
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.latest',
    );
  });

  it('rejects empty definitions', () => {
    const input = protocolSet();
    input.definitions = [];
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.definitions',
    );
  });

  it('rejects empty applications', () => {
    const input = protocolSet();
    input.applications = [];
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.applications',
    );
  });

  it('rejects catalogRef.id mismatch', () => {
    const input = protocolSet();
    input.catalogRef.id = 'other-catalog';
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.catalogRef.id',
    );
  });

  it('rejects catalogRef.version mismatch', () => {
    const input = protocolSet();
    input.catalogRef.version = 'other-version';
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.catalogRef.version',
    );
  });

  it('rejects duplicate exact protocol definitions', () => {
    const input = protocolSet();
    input.definitions.push(clone(input.definitions[0]));
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.definitions[2]',
    );
  });

  it('rejects an application whose exact protocolRef has no definition', () => {
    const input = protocolSet();
    input.applications[0].protocolRef = {
      protocolId: ids.unusedProtocol,
      version: 'missing',
    };
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.applications[0].protocolRef',
    );
  });

  it('rejects a pinned definition unused by every application', () => {
    const input = protocolSet();
    const unused = indicationDefinition();
    unused.protocolId = ids.unusedProtocol;
    unused.version = 'unused-1';
    unused.requirements[0].requirementId = ids.unusedRequirement;
    input.definitions.push(unused);
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.definitions[2]',
    );
  });

  it('rejects a missing initialSpfa application', () => {
    const input = protocolSet();
    input.applications = [input.applications[0]];
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.applications',
    );
  });

  it('rejects a missing additionalSpfa application', () => {
    const input = protocolSet();
    input.applications = [input.applications[1]];
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.applications',
    );
  });

  it('rejects duplicate applications for one care-path SPFA', () => {
    const input = protocolSet();
    input.applications.push(clone(input.applications[1]));
    expectInvalid(
      () => validateCaseSpfaProtocolSetV2(input, validationContext()),
      'caseSpfaProtocolSet.applications[2].carePathSpfaRef',
    );
  });

  it('rejects an orphan application bound to a transition', () => {
    const input = protocolSet();
    const orphan = clone(input.applications[1]);
    orphan.carePathSpfaRef = ids.transition;
    input.applications.push(orphan);
    expectInvalid(() =>
      validateCaseSpfaProtocolSetV2(input, validationContext()),
    );
  });

  it('rejects an application from another case version', () => {
    const input = protocolSet();
    input.applications[0].caseVersionId = ids.otherCaseVersion;
    expectInvalid(() =>
      validateCaseSpfaProtocolSetV2(input, validationContext()),
    );
  });

  it('rejects an application invalid under the C1 validator', () => {
    const input = protocolSet();
    input.applications[1].requirements[0].applicability = {
      status: 'APPLICABLE',
      effectiveImportance: 'OPTIONAL',
    };
    input.applications[1].requirements[0].informationTargets = [
      {
        targetId: 'spfa_target_40000000-0000-4000-8000-000000000099',
        target: { kind: 'FACT', factRef: ids.demandFact },
      },
    ];
    expectInvalid(() =>
      validateCaseSpfaProtocolSetV2(input, validationContext()),
    );
  });

  it('rejects a definition invalid under the M5-B validator', () => {
    const input = protocolSet();
    input.definitions[1].requirements[0].semanticDomain = {
      kind: 'protocol_information',
      domain: 'dispensing_subtype',
    };
    expectInvalid(() =>
      validateCaseSpfaProtocolSetV2(input, validationContext()),
    );
  });

  it('rejects structurally invalid patient facts before resolving applications', () => {
    const facts = patientFacts();
    facts.schemaVersion = '1.0';
    expectInvalid(() =>
      validateCaseSpfaProtocolSetV2(
        protocolSet(),
        validationContext(facts, evaluator()),
      ),
    );
  });

  it('rejects patient facts that cannot produce a publishable runtime', () => {
    const facts = patientFacts();
    facts.initialDemand = { state: 'not_defined' };
    expectInvalid(() =>
      validateCaseSpfaProtocolSetV2(
        protocolSet(),
        validationContext(facts, evaluator()),
      ),
    );
  });

  it('rejects an invalid evaluator before resolving applications', () => {
    const evaluatorInput = evaluator();
    evaluatorInput.evidenceRules.pop();
    expectInvalid(() =>
      validateCaseSpfaProtocolSetV2(
        protocolSet(),
        validationContext(patientFacts(), evaluatorInput),
      ),
    );
  });
});

describe('SPFA protocol set attachment boundary', () => {
  it('returns a distinct SPFA-integrated core without mutating its inputs', () => {
    const coreInput = core();
    const setInput = protocolSet();
    const coreSnapshot = clone(coreInput);
    const setSnapshot = clone(setInput);

    const integrated = attachSpfaProtocolSetToGeneratedCaseCoreV2(
      coreInput,
      setInput,
    );

    expect(integrated).not.toBe(coreInput);
    expect(integrated.patientFacts).not.toBe(coreInput.patientFacts);
    expect(integrated.evaluator).not.toBe(coreInput.evaluator);
    expect(integrated.spfaProtocolSet).not.toBe(setInput);
    expect(integrated).toEqual({
      caseVersionId: ids.caseVersion,
      patientFacts: integrated.patientFacts,
      evaluator: integrated.evaluator,
      spfaProtocolSet: integrated.spfaProtocolSet,
    });
    expect(coreInput).toEqual(coreSnapshot);
    expect(setInput).toEqual(setSnapshot);
  });

  it('rejects a core identity mismatch', () => {
    const coreInput = core() as any;
    coreInput.caseVersionId = ids.otherCaseVersion;
    expectInvalid(
      () =>
        attachSpfaProtocolSetToGeneratedCaseCoreV2(coreInput, protocolSet()),
      'core.patientFacts.caseVersionId',
    );
  });

  it('rejects an invalid protocol set through the attachment boundary', () => {
    const input = protocolSet();
    input.applications = [];
    expectInvalid(() =>
      attachSpfaProtocolSetToGeneratedCaseCoreV2(core(), input),
    );
  });

  it('rejects an invalid patient-facts core', () => {
    const coreInput = core() as any;
    coreInput.patientFacts.initialDemand = { state: 'not_defined' };
    expectInvalid(() =>
      attachSpfaProtocolSetToGeneratedCaseCoreV2(coreInput, protocolSet()),
    );
  });

  it('rejects an invalid evaluator core', () => {
    const coreInput = core() as any;
    coreInput.evaluator.evidenceRules.pop();
    expectInvalid(() =>
      attachSpfaProtocolSetToGeneratedCaseCoreV2(coreInput, protocolSet()),
    );
  });
});
