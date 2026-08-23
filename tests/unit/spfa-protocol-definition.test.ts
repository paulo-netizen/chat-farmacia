import { describe, expect, it } from 'vitest';

import {
  SpfaProtocolDefinitionValidationError,
  validateSpfaApplicabilityPolicyIdV2,
  validateSpfaProtocolDefinitionV2,
  validateSpfaProtocolIdV2,
  validateSpfaProtocolRefV2,
  validateSpfaProtocolRequirementIdV2,
} from '@/lib/cases/v2/validate-spfa-protocol-definition';

const protocolId =
  'spfa_protocol_10000000-0000-4000-8000-000000000001';
const requirementIdA =
  'spfa_requirement_20000000-0000-4000-8000-000000000001';
const requirementIdB =
  'spfa_requirement_20000000-0000-4000-8000-000000000002';
const policyId = 'spfa_policy_30000000-0000-4000-8000-000000000001';

function informationRequirement(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: 'INFORMATION_REQUIREMENT',
    requirementId: requirementIdA,
    semanticDomain: {
      kind: 'patient_information',
      disclosureDomain: 'symptoms',
    },
    teacherLabel: 'Synthetic requirement A',
    description: 'Synthetic description',
    defaultImportance: 'RELEVANT',
    informationGoal: 'Synthetic information goal',
    safetyCriticality: { safetyCritical: false },
    applicability: { kind: 'ALWAYS' },
    ...overrides,
  };
}

function actionRequirement(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    kind: 'ACTION_REQUIREMENT',
    requirementId: requirementIdB,
    semanticDomain: 'referral_action',
    teacherLabel: 'Synthetic requirement B',
    description: 'Synthetic action description',
    defaultImportance: 'CRITICAL',
    actionGoal: 'Synthetic action goal',
    safetyCriticality: { safetyCritical: true },
    applicability: { kind: 'ALWAYS' },
    ...overrides,
  };
}

function protocol(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: '2.0',
    protocolId,
    version: 'teacher-release-alpha',
    service: 'dispensing',
    requirements: [informationRequirement()],
    ...overrides,
  };
}

function expectValidationError(
  input: unknown,
  expectedPath?: string,
): SpfaProtocolDefinitionValidationError {
  try {
    validateSpfaProtocolDefinitionV2(input);
    throw new Error('expected validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(SpfaProtocolDefinitionValidationError);
    const validationError = error as SpfaProtocolDefinitionValidationError;
    if (expectedPath !== undefined) {
      expect(validationError.path).toBe(expectedPath);
      expect(validationError.message.startsWith(`${expectedPath}: `)).toBe(true);
    }
    expect(validationError).not.toHaveProperty('input');
    return validationError;
  }
}

describe('SPFA protocol definition V2', () => {
  describe('valid protocol shapes', () => {
    it('accepts a general dispensing protocol with ALWAYS applicability', () => {
      const parsed = validateSpfaProtocolDefinitionV2(protocol());

      expect(parsed).toMatchObject({
        schemaVersion: '2.0',
        protocolId,
        version: 'teacher-release-alpha',
        service: 'dispensing',
      });
      expect(parsed).not.toHaveProperty('subtype');
    });

    it('accepts a dispensing protocol specific to initial treatment', () => {
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({ subtype: 'initial_treatment' }),
      );

      expect(parsed.subtype).toBe('initial_treatment');
    });

    it('accepts one DISPENSING_SUBTYPE in a general dispensing protocol', () => {
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({
          requirements: [
            informationRequirement({
              applicability: {
                kind: 'DISPENSING_SUBTYPE',
                subtypes: ['initial_treatment'],
              },
            }),
          ],
        }),
      );

      expect(parsed.requirements[0].applicability).toEqual({
        kind: 'DISPENSING_SUBTYPE',
        subtypes: ['initial_treatment'],
      });
    });

    it('accepts both dispensing subtypes in a general dispensing protocol', () => {
      expect(() =>
        validateSpfaProtocolDefinitionV2(
          protocol({
            requirements: [
              informationRequirement({
                applicability: {
                  kind: 'DISPENSING_SUBTYPE',
                  subtypes: ['initial_treatment', 'continuation'],
                },
              }),
            ],
          }),
        ),
      ).not.toThrow();
    });

    it('accepts opaque CASE_DETERMINED policy references without executing them', () => {
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({
          requirements: [
            informationRequirement({
              applicability: { kind: 'CASE_DETERMINED', policyRef: policyId },
            }),
          ],
        }),
      );

      expect(parsed.requirements[0].applicability).toEqual({
        kind: 'CASE_DETERMINED',
        policyRef: policyId,
      });
    });

    it('accepts indication patient information backed by DisclosureDomain', () => {
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({
          service: 'pharmaceutical_indication',
          requirements: [informationRequirement()],
        }),
      );

      expect(parsed.service).toBe('pharmaceutical_indication');
      expect(parsed.requirements[0].semanticDomain).toEqual({
        kind: 'patient_information',
        disclosureDomain: 'symptoms',
      });
    });

    it('accepts indication protocol information for referral criteria', () => {
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({
          service: 'pharmaceutical_indication',
          requirements: [
            informationRequirement({
              semanticDomain: {
                kind: 'protocol_information',
                domain: 'referral_criteria',
              },
            }),
          ],
        }),
      );

      expect(parsed.requirements[0].semanticDomain).toEqual({
        kind: 'protocol_information',
        domain: 'referral_criteria',
      });
    });

    it('accepts an indication ACTION_REQUIREMENT for referral action', () => {
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({
          service: 'pharmaceutical_indication',
          requirements: [actionRequirement()],
        }),
      );

      expect(parsed.requirements[0]).toMatchObject({
        kind: 'ACTION_REQUIREMENT',
        semanticDomain: 'referral_action',
      });
    });

    it('accepts a generic medication adherence protocol requirement', () => {
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({
          service: 'medication_adherence',
          requirements: [
            informationRequirement({
              semanticDomain: {
                kind: 'protocol_information',
                domain: 'service_context',
              },
            }),
          ],
        }),
      );

      expect(parsed.service).toBe('medication_adherence');
    });

    it('allows OPTIONAL plus safetyCritical true', () => {
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({
          requirements: [
            informationRequirement({
              defaultImportance: 'OPTIONAL',
              safetyCriticality: { safetyCritical: true },
            }),
          ],
        }),
      );

      expect(parsed.requirements[0]).toMatchObject({
        defaultImportance: 'OPTIONAL',
        safetyCriticality: { safetyCritical: true },
      });
    });

    it('allows CRITICAL plus safetyCritical false', () => {
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({
          requirements: [
            informationRequirement({
              defaultImportance: 'CRITICAL',
              safetyCriticality: { safetyCritical: false },
            }),
          ],
        }),
      );

      expect(parsed.requirements[0]).toMatchObject({
        defaultImportance: 'CRITICAL',
        safetyCriticality: { safetyCritical: false },
      });
    });

    it('allows repeated labels and semantic domains when IDs differ', () => {
      const second = informationRequirement({ requirementId: requirementIdB });
      const parsed = validateSpfaProtocolDefinitionV2(
        protocol({ requirements: [informationRequirement(), second] }),
      );

      expect(parsed.requirements).toHaveLength(2);
      expect(parsed.requirements[0].teacherLabel).toBe(
        parsed.requirements[1].teacherLabel,
      );
      expect(parsed.requirements[0].semanticDomain).toEqual(
        parsed.requirements[1].semanticDomain,
      );
    });

    it('returns a canonical deep copy rather than the unknown input', () => {
      const applicability = {
        kind: 'DISPENSING_SUBTYPE',
        subtypes: ['initial_treatment'],
      };
      const requirement = informationRequirement({ applicability });
      const input = protocol({ requirements: [requirement] });
      const parsed = validateSpfaProtocolDefinitionV2(input);
      const inputRequirements = input.requirements as Record<string, unknown>[];
      const parsedRequirement = parsed.requirements[0];

      expect(parsed).not.toBe(input);
      expect(parsed.requirements).not.toBe(input.requirements);
      expect(parsedRequirement).not.toBe(inputRequirements[0]);
      expect(parsedRequirement.semanticDomain).not.toBe(
        inputRequirements[0].semanticDomain,
      );
      expect(parsedRequirement.safetyCriticality).not.toBe(
        inputRequirements[0].safetyCriticality,
      );
      expect(parsedRequirement.applicability).not.toBe(applicability);
      if (parsedRequirement.applicability.kind === 'DISPENSING_SUBTYPE') {
        expect(parsedRequirement.applicability.subtypes).not.toBe(
          applicability.subtypes,
        );
      }
    });
  });

  describe('strict protocol and subtype validation', () => {
    it('rejects a wrong schema version', () => {
      expectValidationError(
        protocol({ schemaVersion: '3.0' }),
        'spfaProtocolDefinition.schemaVersion',
      );
    });

    it('rejects an empty requirements collection', () => {
      expectValidationError(
        protocol({ requirements: [] }),
        'spfaProtocolDefinition.requirements',
      );
    });

    it('rejects an extra root property', () => {
      expectValidationError(
        protocol({ unknownProperty: true }),
        'spfaProtocolDefinition.unknownProperty',
      );
    });

    it.each(['pharmaceutical_indication', 'medication_adherence'])(
      'rejects subtype on non-dispensing service %s',
      (service) => {
        expectValidationError(
          protocol({ service, subtype: 'initial_treatment' }),
          'spfaProtocolDefinition.subtype',
        );
      },
    );

    it.each(['pharmaceutical_indication', 'medication_adherence'])(
      'rejects DISPENSING_SUBTYPE on service %s',
      (service) => {
        expectValidationError(
          protocol({
            service,
            requirements: [
              informationRequirement({
                applicability: {
                  kind: 'DISPENSING_SUBTYPE',
                  subtypes: ['initial_treatment'],
                },
              }),
            ],
          }),
          'spfaProtocolDefinition.requirements[0].applicability.kind',
        );
      },
    );

    it('rejects DISPENSING_SUBTYPE when dispensing subtype is already fixed', () => {
      expectValidationError(
        protocol({
          subtype: 'initial_treatment',
          requirements: [
            informationRequirement({
              applicability: {
                kind: 'DISPENSING_SUBTYPE',
                subtypes: ['initial_treatment'],
              },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].applicability.kind',
      );
    });

    it('rejects an empty dispensing subtype list', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              applicability: { kind: 'DISPENSING_SUBTYPE', subtypes: [] },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].applicability.subtypes',
      );
    });

    it('rejects duplicate dispensing subtypes', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              applicability: {
                kind: 'DISPENSING_SUBTYPE',
                subtypes: ['continuation', 'continuation'],
              },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].applicability.subtypes',
      );
    });

    it('rejects an invalid dispensing subtype value', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              applicability: {
                kind: 'DISPENSING_SUBTYPE',
                subtypes: ['synthetic_subtype'],
              },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].applicability.subtypes[0]',
      );
    });
  });

  describe('strict requirement validation', () => {
    it('rejects duplicate requirement IDs even across different kinds', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement(),
            actionRequirement({ requirementId: requirementIdA }),
          ],
        }),
        'spfaProtocolDefinition.requirements[1].requirementId',
      );
    });

    it('rejects NOT_APPLICABLE as default importance', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({ defaultImportance: 'NOT_APPLICABLE' }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].defaultImportance',
      );
    });

    it('rejects an invalid patient DisclosureDomain', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              semanticDomain: {
                kind: 'patient_information',
                disclosureDomain: 'clinical_solution',
              },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].semanticDomain.disclosureDomain',
      );
    });

    it('rejects an invalid protocol information domain', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              semanticDomain: {
                kind: 'protocol_information',
                domain: 'prm',
              },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].semanticDomain.domain',
      );
    });

    it('rejects an invalid action domain', () => {
      expectValidationError(
        protocol({
          requirements: [actionRequirement({ semanticDomain: 'score_action' })],
        }),
        'spfaProtocolDefinition.requirements[0].semanticDomain',
      );
    });

    it('rejects a non-boolean safetyCritical value', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              safetyCriticality: { safetyCritical: 'yes' },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].safetyCriticality.safetyCritical',
      );
    });

    it('rejects actionGoal on INFORMATION_REQUIREMENT', () => {
      expectValidationError(
        protocol({
          requirements: [informationRequirement({ actionGoal: 'forbidden' })],
        }),
        'spfaProtocolDefinition.requirements[0].actionGoal',
      );
    });

    it('rejects informationGoal on ACTION_REQUIREMENT', () => {
      expectValidationError(
        protocol({
          requirements: [actionRequirement({ informationGoal: 'forbidden' })],
        }),
        'spfaProtocolDefinition.requirements[0].informationGoal',
      );
    });

    it.each(['score', 'factRef', 'evidence'])(
      'rejects forbidden reusable-definition field %s',
      (field) => {
        expectValidationError(
          protocol({
            requirements: [informationRequirement({ [field]: 'forbidden' })],
          }),
          `spfaProtocolDefinition.requirements[0].${field}`,
        );
      },
    );

    it('rejects unknown properties in semanticDomain', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              semanticDomain: {
                kind: 'patient_information',
                disclosureDomain: 'symptoms',
                unknownProperty: true,
              },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].semanticDomain.unknownProperty',
      );
    });

    it('rejects unknown properties in safetyCriticality', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              safetyCriticality: {
                safetyCritical: false,
                weight: 1,
              },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].safetyCriticality.weight',
      );
    });

    it('rejects executable fields in CASE_DETERMINED', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              applicability: {
                kind: 'CASE_DETERMINED',
                policyRef: policyId,
                expression: { operator: 'always' },
              },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].applicability.expression',
      );
    });

    it.each([
      ['teacherLabel', ''],
      ['description', '   '],
      ['informationGoal', ''],
    ])('rejects empty information requirement field %s', (field, value) => {
      expectValidationError(
        protocol({
          requirements: [informationRequirement({ [field]: value })],
        }),
        `spfaProtocolDefinition.requirements[0].${field}`,
      );
    });

    it('rejects an empty action goal', () => {
      expectValidationError(
        protocol({ requirements: [actionRequirement({ actionGoal: ' ' })] }),
        'spfaProtocolDefinition.requirements[0].actionGoal',
      );
    });

    it('rejects an empty protocol version', () => {
      expectValidationError(
        protocol({ version: ' ' }),
        'spfaProtocolDefinition.version',
      );
    });
  });

  describe('opaque IDs', () => {
    it.each([
      '10000000-0000-4000-8000-000000000001',
      'spfa_requirement_10000000-0000-4000-8000-000000000001',
      'spfa_protocol_10000000-0000-4000-8000-00000000000A',
      'spfa_protocol_10000000-0000-9000-8000-000000000001',
      'spfa_protocol_10000000-0000-4000-7000-000000000001',
      'spfa_protocol_clinical-dispensing',
      ' spfa_protocol_10000000-0000-4000-8000-000000000001',
      123,
      null,
    ])('rejects malformed protocol ID %j', (value) => {
      expect(() => validateSpfaProtocolIdV2(value)).toThrow(
        SpfaProtocolDefinitionValidationError,
      );
    });

    it('rejects a malformed requirement ID in a protocol', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({ requirementId: 'synthetic-requirement' }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].requirementId',
      );
    });

    it('rejects a malformed CASE_DETERMINED policy ID', () => {
      expectValidationError(
        protocol({
          requirements: [
            informationRequirement({
              applicability: {
                kind: 'CASE_DETERMINED',
                policyRef: 'spfa_policy_referral',
              },
            }),
          ],
        }),
        'spfaProtocolDefinition.requirements[0].applicability.policyRef',
      );
    });

    it('accepts each correctly prefixed nominal ID', () => {
      expect(validateSpfaProtocolIdV2(protocolId)).toBe(protocolId);
      expect(validateSpfaProtocolRequirementIdV2(requirementIdA)).toBe(
        requirementIdA,
      );
      expect(validateSpfaApplicabilityPolicyIdV2(policyId)).toBe(policyId);
    });
  });

  describe('protocol references', () => {
    it('validates and copies a protocol reference', () => {
      const input = { protocolId, version: 'faculty-edition-2026' };
      const parsed = validateSpfaProtocolRefV2(input);

      expect(parsed).toEqual(input);
      expect(parsed).not.toBe(input);
    });

    it('rejects a missing protocol reference version', () => {
      expect(() => validateSpfaProtocolRefV2({ protocolId })).toThrowError(
        'protocolRef.version: must be a non-empty string',
      );
    });

    it('rejects a malformed protocol ID in a reference', () => {
      expect(() =>
        validateSpfaProtocolRefV2({
          protocolId: requirementIdA,
          version: '1',
        }),
      ).toThrowError(
        'protocolRef.protocolId: must use the opaque format spfa_protocol_<uuid>',
      );
    });

    it('rejects an extra protocol reference property', () => {
      expect(() =>
        validateSpfaProtocolRefV2({
          protocolId,
          version: '1',
          score: 100,
        }),
      ).toThrowError('protocolRef.score: unexpected property');
    });
  });
});
