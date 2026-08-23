import { describe, expect, it } from 'vitest';

import {
  SpfaProtocolApplicationValidationError,
  validateCaseSpfaProtocolApplicationV2,
  validateSpfaRequirementTargetIdV2,
} from '@/lib/cases/v2/validate-spfa-protocol-application';

const ids = {
  caseVersion: 'casever_90000000-0000-4000-8000-000000000001',
  otherCaseVersion: 'casever_90000000-0000-4000-8000-000000000002',
  protocol: 'spfa_protocol_10000000-0000-4000-8000-000000000001',
  otherProtocol: 'spfa_protocol_10000000-0000-4000-8000-000000000002',
  requirementA: 'spfa_requirement_20000000-0000-4000-8000-000000000001',
  requirementB: 'spfa_requirement_20000000-0000-4000-8000-000000000002',
  extraRequirement: 'spfa_requirement_20000000-0000-4000-8000-000000000003',
  policy: 'spfa_policy_30000000-0000-4000-8000-000000000001',
  otherPolicy: 'spfa_policy_30000000-0000-4000-8000-000000000002',
  targetA: 'spfa_target_40000000-0000-4000-8000-000000000001',
  targetB: 'spfa_target_40000000-0000-4000-8000-000000000002',
  targetC: 'spfa_target_40000000-0000-4000-8000-000000000003',
  medication: 'med_50000000-0000-4000-8000-000000000001',
  otherMedication: 'med_50000000-0000-4000-8000-000000000002',
  initialFact: 'fact_60000000-0000-4000-8000-000000000001',
  personFact: 'fact_60000000-0000-4000-8000-000000000002',
  medicationNameFact: 'fact_60000000-0000-4000-8000-000000000003',
  medicationOriginFact: 'fact_60000000-0000-4000-8000-000000000004',
  medicationUseFact: 'fact_60000000-0000-4000-8000-000000000005',
  unrelatedFact: 'fact_60000000-0000-4000-8000-000000000006',
  missingFact: 'fact_60000000-0000-4000-8000-000000000099',
  initialSpfa: 'conclusion_70000000-0000-4000-8000-000000000001',
  additionalSpfa: 'conclusion_70000000-0000-4000-8000-000000000002',
  transition: 'conclusion_70000000-0000-4000-8000-000000000003',
  incidenceAssessment: 'conclusion_70000000-0000-4000-8000-000000000004',
  prmAssessment: 'conclusion_70000000-0000-4000-8000-000000000005',
  rnmAssessment: 'conclusion_70000000-0000-4000-8000-000000000006',
  referral: 'conclusion_70000000-0000-4000-8000-000000000007',
  missingConclusion: 'conclusion_70000000-0000-4000-8000-000000000099',
} as const;

const na = { state: 'not_applicable', reasonCode: 'clinically_irrelevant' };

function known(factId: string, value: unknown) {
  return {
    state: 'known',
    factId,
    value,
    certainty: 'exact',
    disclosure: { mode: 'spontaneous' },
  };
}

function patientFacts(caseVersionId: string = ids.caseVersion): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId,
    publicProfile: {
      nombre: 'Synthetic patient',
      edad: 45,
      sexo: 'F',
      tratamiento: 'Synthetic medicine',
    },
    initialDemand: known(ids.initialFact, 'Synthetic initial demand'),
    encounter: {
      personPresent: known(ids.personFact, 'patient'),
      relationshipToPatient: { ...na },
    },
    clinicalContext: {
      healthProblems: [known(ids.unrelatedFact, 'Synthetic health problem')],
      clinicalHistory: [],
      physiologicalSituation: [],
      pregnancyAndLactation: { ...na },
      allergiesAndIntolerances: [],
      lifestyle: [],
      biomedicalData: [],
    },
    symptoms: [],
    pharmacotherapy: {
      prescribedMedications: [
        {
          medicationId: ids.medication,
          displayName: known(ids.medicationNameFact, 'Synthetic medicine'),
          origin: known(ids.medicationOriginFact, 'prescribed'),
          purposeAsUnderstood: { ...na },
          regimenBasis: { ...na },
          referenceDose: { ...na },
          referenceSchedule: { ...na },
          referenceDuration: { ...na },
          administrationMethod: { ...na },
          specialUseConditions: [],
        },
      ],
      otherMedicinesAndProducts: [],
      actualMedicationUse: [
        {
          useId: 'use_80000000-0000-4000-8000-000000000001',
          medicationRef: ids.medication,
          action: 'takes',
          actualUse: known(ids.medicationUseFact, 'Synthetic actual use'),
          actualDose: { ...na },
          actualSchedule: { ...na },
          frequency: { ...na },
          timePeriod: { ...na },
          circumstanceFactRefs: [],
          statedReasonFactRefs: [],
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
    requiredEvidence: { operator: 'fact', factRef: ids.initialFact },
    supportingEvidenceRefs: [],
    counterEvidenceRefs: [],
    teacherRationale: 'Synthetic rationale',
  };
}

function evaluator(caseVersionId: string = ids.caseVersion): Record<string, any> {
  return {
    schemaVersion: '2.0',
    caseVersionId,
    versions: {
      evaluatorSchema: { id: 'synthetic-evaluator', version: '2.0' },
      protocol: { id: 'synthetic-protocol', version: 'draft' },
      prmTaxonomy: { id: 'synthetic-prm', version: 'draft' },
      rnmTaxonomy: { id: 'synthetic-rnm', version: 'draft' },
      adherenceFramework: { id: 'synthetic-adherence', version: 'draft' },
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
        conclusionId: ids.rnmAssessment,
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
      evidenceRule(ids.incidenceAssessment),
      evidenceRule(ids.prmAssessment),
      evidenceRule(ids.rnmAssessment),
      evidenceRule(ids.referral),
    ],
  };
}

function informationDefinition(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: 'INFORMATION_REQUIREMENT',
    requirementId: ids.requirementA,
    semanticDomain: {
      kind: 'patient_information',
      disclosureDomain: 'symptoms',
    },
    teacherLabel: 'Synthetic information requirement',
    description: 'Synthetic information description',
    defaultImportance: 'RELEVANT',
    informationGoal: 'Synthetic information goal',
    safetyCriticality: { safetyCritical: false },
    applicability: { kind: 'ALWAYS' },
    ...overrides,
  };
}

function actionDefinition(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: 'ACTION_REQUIREMENT',
    requirementId: ids.requirementB,
    semanticDomain: 'referral_action',
    teacherLabel: 'Synthetic action requirement',
    description: 'Synthetic action description',
    defaultImportance: 'CRITICAL',
    actionGoal: 'Synthetic action goal',
    safetyCriticality: { safetyCritical: true },
    applicability: { kind: 'ALWAYS' },
    ...overrides,
  };
}

function definition(
  overrides: Record<string, unknown> = {},
): Record<string, any> {
  return {
    schemaVersion: '2.0',
    protocolId: ids.protocol,
    version: 'synthetic-version',
    service: 'dispensing',
    requirements: [informationDefinition()],
    ...overrides,
  };
}

function applicable(defaultImportance = 'RELEVANT') {
  return { status: 'APPLICABLE', effectiveImportance: defaultImportance };
}

function informationApplication(
  requirementRef: string = ids.requirementA,
  target: Record<string, unknown> = {
    kind: 'FACT',
    factRef: ids.initialFact,
  },
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: 'INFORMATION_REQUIREMENT',
    requirementRef,
    applicability: applicable(),
    informationTargets: [{ targetId: ids.targetA, target }],
    ...overrides,
  };
}

function actionApplication(
  requirementRef: string = ids.requirementB,
  target: Record<string, unknown> = {
    kind: 'EVALUATOR_CONCLUSION',
    conclusionRef: ids.referral,
  },
  overrides: Record<string, unknown> = {},
) {
  return {
    kind: 'ACTION_REQUIREMENT',
    requirementRef,
    applicability: applicable('CRITICAL'),
    actionTargets: [{ targetId: ids.targetB, target }],
    ...overrides,
  };
}

function application(
  protocolDefinition = definition(),
  overrides: Record<string, unknown> = {},
): Record<string, any> {
  const requirements = protocolDefinition.requirements.map(
    (requirement: Record<string, any>, index: number) =>
      requirement.kind === 'ACTION_REQUIREMENT'
        ? actionApplication(
            requirement.requirementId,
            requirement.semanticDomain === 'care_path_transition'
              ? { kind: 'CARE_PATH_TRANSITION', transitionRef: ids.transition }
              : undefined,
            {
              applicability: applicable(requirement.defaultImportance),
              actionTargets: [
                {
                  targetId: index === 0 ? ids.targetA : ids.targetB,
                  target:
                    requirement.semanticDomain === 'care_path_transition'
                      ? {
                          kind: 'CARE_PATH_TRANSITION',
                          transitionRef: ids.transition,
                        }
                      : {
                          kind: 'EVALUATOR_CONCLUSION',
                          conclusionRef: ids.referral,
                        },
                },
              ],
            },
          )
        : informationApplication(requirement.requirementId, undefined, {
            applicability: applicable(requirement.defaultImportance),
            informationTargets: [
              {
                targetId: index === 0 ? ids.targetA : ids.targetB,
                target: { kind: 'FACT', factRef: ids.initialFact },
              },
            ],
          }),
  );
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    carePathSpfaRef: ids.initialSpfa,
    protocolRef: {
      protocolId: protocolDefinition.protocolId,
      version: protocolDefinition.version,
    },
    requirements,
    ...overrides,
  };
}

function context(
  protocolDefinition = definition(),
  facts = patientFacts(),
  evaluatorInput = evaluator(),
): any {
  return {
    protocolDefinition,
    patientFacts: facts,
    evaluator: evaluatorInput,
  };
}

function expectInvalid(
  app: unknown,
  validationContext: any,
  expectedPath?: string,
): SpfaProtocolApplicationValidationError {
  try {
    validateCaseSpfaProtocolApplicationV2(app, validationContext);
    throw new Error('expected validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(SpfaProtocolApplicationValidationError);
    const validationError = error as SpfaProtocolApplicationValidationError;
    if (expectedPath !== undefined) expect(validationError.path).toBe(expectedPath);
    expect(validationError.message.startsWith(`${validationError.path}: `)).toBe(
      true,
    );
    return validationError;
  }
}

describe('case SPFA protocol application V2', () => {
  describe('valid bindings and applicability', () => {
    it('validates ALWAYS information requirement bound to a defined FACT', () => {
      const protocolDefinition = definition();
      const parsed = validateCaseSpfaProtocolApplicationV2(
        application(protocolDefinition),
        context(protocolDefinition),
      );

      expect(parsed.requirements[0]).toMatchObject({
        kind: 'INFORMATION_REQUIREMENT',
        informationTargets: [{ target: { kind: 'FACT', factRef: ids.initialFact } }],
      });
    });

    it('validates PUBLIC_PROFILE age', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets[0].target = {
        kind: 'PUBLIC_PROFILE',
        field: 'age',
      };

      expect(() =>
        validateCaseSpfaProtocolApplicationV2(app, context(protocolDefinition)),
      ).not.toThrow();
    });

    it('validates an existing MEDICATION_ENTITY', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets[0].target = {
        kind: 'MEDICATION_ENTITY',
        medicationRef: ids.medication,
      };

      expect(() =>
        validateCaseSpfaProtocolApplicationV2(app, context(protocolDefinition)),
      ).not.toThrow();
    });

    it('validates a MEDICATION_FACT structurally linked to the medication', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets[0].target = {
        kind: 'MEDICATION_FACT',
        medicationRef: ids.medication,
        factRef: ids.medicationUseFact,
      };

      expect(() =>
        validateCaseSpfaProtocolApplicationV2(app, context(protocolDefinition)),
      ).not.toThrow();
    });

    it('validates an ACTION_REQUIREMENT with EVALUATOR_CONCLUSION', () => {
      const protocolDefinition = definition({ requirements: [actionDefinition()] });
      const parsed = validateCaseSpfaProtocolApplicationV2(
        application(protocolDefinition),
        context(protocolDefinition),
      );

      expect(parsed.requirements[0]).toMatchObject({
        kind: 'ACTION_REQUIREMENT',
        actionTargets: [
          {
            target: {
              kind: 'EVALUATOR_CONCLUSION',
              conclusionRef: ids.referral,
            },
          },
        ],
      });
    });

    it('validates care_path_transition against a real outgoing transition', () => {
      const protocolDefinition = definition({
        requirements: [actionDefinition({ semanticDomain: 'care_path_transition' })],
      });

      expect(() =>
        validateCaseSpfaProtocolApplicationV2(
          application(protocolDefinition),
          context(protocolDefinition),
        ),
      ).not.toThrow();
    });

    it('materializes matching dispensing subtype as APPLICABLE', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: {
              kind: 'DISPENSING_SUBTYPE',
              subtypes: ['initial_treatment'],
            },
          }),
        ],
      });

      expect(() =>
        validateCaseSpfaProtocolApplicationV2(
          application(protocolDefinition),
          context(protocolDefinition),
        ),
      ).not.toThrow();
    });

    it('materializes nonmatching dispensing subtype as NOT_APPLICABLE', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: {
              kind: 'DISPENSING_SUBTYPE',
              subtypes: ['initial_treatment'],
            },
          }),
        ],
      });
      const evaluatorInput = evaluator();
      evaluatorInput.carePath.initialSpfa.value.subtype = 'continuation';
      const app = application(protocolDefinition);
      app.requirements[0] = informationApplication(ids.requirementA, undefined, {
        applicability: {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
        },
        informationTargets: [],
      });

      const parsed = validateCaseSpfaProtocolApplicationV2(
        app,
        context(protocolDefinition, patientFacts(), evaluatorInput),
      );
      expect(parsed.requirements[0].applicability).toEqual({
        status: 'NOT_APPLICABLE',
        reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
      });
    });

    it('accepts CASE_DETERMINED materialized as APPLICABLE', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
          }),
        ],
      });
      expect(() =>
        validateCaseSpfaProtocolApplicationV2(
          application(protocolDefinition),
          context(protocolDefinition),
        ),
      ).not.toThrow();
    });

    it('accepts CASE_DETERMINED materialized N/A with the exact policy', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
          }),
        ],
      });
      const app = application(protocolDefinition);
      app.requirements[0] = informationApplication(ids.requirementA, undefined, {
        applicability: {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
        },
        informationTargets: [],
      });

      expect(() =>
        validateCaseSpfaProtocolApplicationV2(app, context(protocolDefinition)),
      ).not.toThrow();
    });

    it('orders requirements by definition and targets by targetId', () => {
      const protocolDefinition = definition({
        requirements: [informationDefinition(), actionDefinition()],
      });
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets = [
        {
          targetId: ids.targetC,
          target: { kind: 'FACT', factRef: ids.initialFact },
        },
        {
          targetId: ids.targetA,
          target: { kind: 'PUBLIC_PROFILE', field: 'age' },
        },
      ];
      app.requirements.reverse();

      const parsed = validateCaseSpfaProtocolApplicationV2(
        app,
        context(protocolDefinition),
      );
      expect(parsed.requirements.map((item) => item.requirementRef)).toEqual([
        ids.requirementA,
        ids.requirementB,
      ]);
      expect(
        parsed.requirements[0].kind === 'INFORMATION_REQUIREMENT'
          ? parsed.requirements[0].informationTargets.map((item) => item.targetId)
          : [],
      ).toEqual([ids.targetA, ids.targetC]);
    });

    it('returns reconstructed application, requirements, targets and applicability', () => {
      const protocolDefinition = definition();
      const input = application(protocolDefinition);
      const parsed = validateCaseSpfaProtocolApplicationV2(
        input,
        context(protocolDefinition),
      );

      expect(parsed).not.toBe(input);
      expect(parsed.requirements).not.toBe(input.requirements);
      expect(parsed.requirements[0]).not.toBe(input.requirements[0]);
      expect(parsed.requirements[0].applicability).not.toBe(
        input.requirements[0].applicability,
      );
      if (parsed.requirements[0].kind === 'INFORMATION_REQUIREMENT') {
        const parsedTarget = parsed.requirements[0].informationTargets[0];
        expect(parsedTarget).toBeDefined();
        expect(parsed.requirements[0].informationTargets).not.toBe(
          input.requirements[0].informationTargets,
        );
        expect(parsedTarget).not.toBe(
          input.requirements[0].informationTargets[0],
        );
        expect(parsedTarget!.target).not.toBe(
          input.requirements[0].informationTargets[0].target,
        );
      }
    });

    it('reconstructs a NOT_APPLICABLE reason instead of retaining its input object', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
          }),
        ],
      });
      const reason = { kind: 'CASE_DETERMINED', policyRef: ids.policy };
      const applicability = { status: 'NOT_APPLICABLE', reason };
      const app = application(protocolDefinition);
      app.requirements[0] = informationApplication(ids.requirementA, undefined, {
        applicability,
        informationTargets: [],
      });

      const parsed = validateCaseSpfaProtocolApplicationV2(
        app,
        context(protocolDefinition),
      );
      expect(parsed.requirements[0].applicability).not.toBe(applicability);
      if (parsed.requirements[0].applicability.status === 'NOT_APPLICABLE') {
        expect(parsed.requirements[0].applicability.reason).not.toBe(reason);
      }
    });
  });

  describe('identity and protocol-to-care-path invariants', () => {
    it('rejects wrong schemaVersion', () => {
      const protocolDefinition = definition();
      expectInvalid(
        application(protocolDefinition, { schemaVersion: '3.0' }),
        context(protocolDefinition),
        'caseSpfaProtocolApplication.schemaVersion',
      );
    });

    it('rejects malformed application caseVersionId', () => {
      const protocolDefinition = definition();
      expectInvalid(
        application(protocolDefinition, { caseVersionId: 'case-version-1' }),
        context(protocolDefinition),
        'caseSpfaProtocolApplication.caseVersionId',
      );
    });

    it('rejects application caseVersionId mismatch with patient facts', () => {
      const protocolDefinition = definition();
      expectInvalid(
        application(protocolDefinition, { caseVersionId: ids.otherCaseVersion }),
        context(protocolDefinition),
        'caseSpfaProtocolApplication.caseVersionId',
      );
    });

    it('rejects evaluator context whose caseVersionId differs from patient facts', () => {
      const protocolDefinition = definition();
      expectInvalid(
        application(protocolDefinition),
        context(protocolDefinition, patientFacts(), evaluator(ids.otherCaseVersion)),
        'context.evaluator.caseVersionId',
      );
    });

    it('rejects unknown carePathSpfaRef', () => {
      const protocolDefinition = definition();
      expectInvalid(
        application(protocolDefinition, {
          carePathSpfaRef: ids.missingConclusion,
        }),
        context(protocolDefinition),
        'caseSpfaProtocolApplication.carePathSpfaRef',
      );
    });

    it('rejects a transition as carePathSpfaRef', () => {
      const protocolDefinition = definition();
      expectInvalid(
        application(protocolDefinition, { carePathSpfaRef: ids.transition }),
        context(protocolDefinition),
        'caseSpfaProtocolApplication.carePathSpfaRef',
      );
    });

    it('rejects protocolRef ID mismatch', () => {
      const protocolDefinition = definition();
      expectInvalid(
        application(protocolDefinition, {
          protocolRef: {
            protocolId: ids.otherProtocol,
            version: protocolDefinition.version,
          },
        }),
        context(protocolDefinition),
        'caseSpfaProtocolApplication.protocolRef.protocolId',
      );
    });

    it('rejects protocolRef version mismatch', () => {
      const protocolDefinition = definition();
      expectInvalid(
        application(protocolDefinition, {
          protocolRef: { protocolId: ids.protocol, version: 'other-version' },
        }),
        context(protocolDefinition),
        'caseSpfaProtocolApplication.protocolRef.version',
      );
    });

    it('rejects protocol service mismatch with bound care-path SPFA', () => {
      const protocolDefinition = definition({
        service: 'pharmaceutical_indication',
      });
      expectInvalid(
        application(protocolDefinition),
        context(protocolDefinition),
        'caseSpfaProtocolApplication.protocolRef',
      );
    });

    it('rejects protocol subtype mismatch with bound dispensing SPFA', () => {
      const protocolDefinition = definition({ subtype: 'continuation' });
      expectInvalid(
        application(protocolDefinition),
        context(protocolDefinition),
        'caseSpfaProtocolApplication.protocolRef',
      );
    });

    it('rejects a dispensing evaluator SPFA without subtype', () => {
      const protocolDefinition = definition();
      const evaluatorInput = evaluator();
      delete evaluatorInput.carePath.initialSpfa.value.subtype;
      expectInvalid(
        application(protocolDefinition),
        context(protocolDefinition, patientFacts(), evaluatorInput),
      );
    });
  });

  describe('exact requirement materialization', () => {
    it('rejects a missing requirement', () => {
      const protocolDefinition = definition({
        requirements: [informationDefinition(), actionDefinition()],
      });
      const app = application(protocolDefinition);
      app.requirements.pop();
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects an extra requirement', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements.push(
        informationApplication(ids.extraRequirement, undefined, {
          informationTargets: [
            {
              targetId: ids.targetB,
              target: { kind: 'FACT', factRef: ids.initialFact },
            },
          ],
        }),
      );
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects duplicate requirementRef', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements.push(structuredClone(app.requirements[0]));
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects wrong requirement kind', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0] = actionApplication(ids.requirementA);
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects ALWAYS materialized as NOT_APPLICABLE', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0] = informationApplication(ids.requirementA, undefined, {
        applicability: {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
        },
        informationTargets: [],
      });
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects matching DISPENSING_SUBTYPE materialized N/A', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: {
              kind: 'DISPENSING_SUBTYPE',
              subtypes: ['initial_treatment'],
            },
          }),
        ],
      });
      const app = application(protocolDefinition);
      app.requirements[0] = informationApplication(ids.requirementA, undefined, {
        applicability: {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
        },
        informationTargets: [],
      });
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects nonmatching DISPENSING_SUBTYPE materialized APPLICABLE', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: {
              kind: 'DISPENSING_SUBTYPE',
              subtypes: ['continuation'],
            },
          }),
        ],
      });
      expectInvalid(
        application(protocolDefinition),
        context(protocolDefinition),
      );
    });

    it('rejects CASE_DETERMINED N/A with wrong policyRef', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
          }),
        ],
      });
      const app = application(protocolDefinition);
      app.requirements[0] = informationApplication(ids.requirementA, undefined, {
        applicability: {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'CASE_DETERMINED', policyRef: ids.otherPolicy },
        },
        informationTargets: [],
      });
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects effectiveImportance different from defaultImportance', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].applicability.effectiveImportance = 'CRITICAL';
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects applicable information requirement with empty targets', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets = [];
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects applicable action requirement with empty targets', () => {
      const protocolDefinition = definition({ requirements: [actionDefinition()] });
      const app = application(protocolDefinition);
      app.requirements[0].actionTargets = [];
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects NOT_APPLICABLE requirement carrying targets', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
          }),
        ],
      });
      const app = application(protocolDefinition);
      app.requirements[0].applicability = {
        status: 'NOT_APPLICABLE',
        reason: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
      };
      expectInvalid(app, context(protocolDefinition));
    });
  });

  describe('target references and compatibility', () => {
    it('rejects malformed targetId', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets[0].targetId = 'target-clinical';
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects duplicate targetId across requirements', () => {
      const protocolDefinition = definition({
        requirements: [informationDefinition(), actionDefinition()],
      });
      const app = application(protocolDefinition);
      app.requirements[1].actionTargets[0].targetId = ids.targetA;
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects duplicate semantic target within one requirement', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets.push({
        targetId: ids.targetB,
        target: { kind: 'FACT', factRef: ids.initialFact },
      });
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects unknown FactId', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets[0].target.factRef = ids.missingFact;
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects unknown MedicationId', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets[0].target = {
        kind: 'MEDICATION_ENTITY',
        medicationRef: ids.otherMedication,
      };
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects MEDICATION_FACT using a global fact unrelated to medication', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets[0].target = {
        kind: 'MEDICATION_FACT',
        medicationRef: ids.medication,
        factRef: ids.unrelatedFact,
      };
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects unknown evaluator ConclusionId', () => {
      const protocolDefinition = definition({ requirements: [actionDefinition()] });
      const app = application(protocolDefinition);
      app.requirements[0].actionTargets[0].target.conclusionRef =
        ids.missingConclusion;
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects transitionRef that is not an SPFA transition', () => {
      const protocolDefinition = definition({
        requirements: [actionDefinition({ semanticDomain: 'care_path_transition' })],
      });
      const app = application(protocolDefinition);
      app.requirements[0].actionTargets[0].target.transitionRef = ids.referral;
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects a transition whose origin is not the applied SPFA', () => {
      const protocolDefinition = definition({
        service: 'pharmaceutical_indication',
        requirements: [actionDefinition({ semanticDomain: 'care_path_transition' })],
      });
      const app = application(protocolDefinition, {
        carePathSpfaRef: ids.additionalSpfa,
      });
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects care_path_transition with EVALUATOR_CONCLUSION target', () => {
      const protocolDefinition = definition({
        requirements: [actionDefinition({ semanticDomain: 'care_path_transition' })],
      });
      const app = application(protocolDefinition);
      app.requirements[0].actionTargets[0].target = {
        kind: 'EVALUATOR_CONCLUSION',
        conclusionRef: ids.referral,
      };
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects referral_action with CARE_PATH_TRANSITION target', () => {
      const protocolDefinition = definition({ requirements: [actionDefinition()] });
      const app = application(protocolDefinition);
      app.requirements[0].actionTargets[0].target = {
        kind: 'CARE_PATH_TRANSITION',
        transitionRef: ids.transition,
      };
      expectInvalid(app, context(protocolDefinition));
    });

    it('validates the target ID format independently', () => {
      expect(validateSpfaRequirementTargetIdV2(ids.targetA)).toBe(ids.targetA);
      expect(() =>
        validateSpfaRequirementTargetIdV2(
          'spfa_target_40000000-0000-4000-7000-000000000001',
        ),
      ).toThrow(SpfaProtocolApplicationValidationError);
    });
  });

  describe('strict application-only shape', () => {
    it.each(['score', 'evidence', 'transcript'])(
      'rejects session-evaluation property %s on requirement',
      (property) => {
        const protocolDefinition = definition();
        const app = application(protocolDefinition);
        app.requirements[0][property] = 'forbidden';
        expectInvalid(app, context(protocolDefinition));
      },
    );

    it('rejects an extra application property', () => {
      const protocolDefinition = definition();
      expectInvalid(
        application(protocolDefinition, { confidence: 0.99 }),
        context(protocolDefinition),
      );
    });

    it('rejects an extra applicability property', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].applicability.weight = 1;
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects an extra N/A reason property', () => {
      const protocolDefinition = definition({
        requirements: [
          informationDefinition({
            applicability: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
          }),
        ],
      });
      const app = application(protocolDefinition);
      app.requirements[0] = informationApplication(ids.requirementA, undefined, {
        applicability: {
          status: 'NOT_APPLICABLE',
          reason: {
            kind: 'CASE_DETERMINED',
            policyRef: ids.policy,
            predicate: true,
          },
        },
        informationTargets: [],
      });
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects an extra bound-target property', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets[0].messageRef = 'message-1';
      expectInvalid(app, context(protocolDefinition));
    });

    it('rejects an extra target property', () => {
      const protocolDefinition = definition();
      const app = application(protocolDefinition);
      app.requirements[0].informationTargets[0].target.feedback = 'forbidden';
      expectInvalid(app, context(protocolDefinition));
    });
  });
});
