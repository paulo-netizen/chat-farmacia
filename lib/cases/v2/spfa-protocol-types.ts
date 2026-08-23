import type {
  DispensingSubtype,
  NonEmptyArray,
  SpfaService,
} from './evaluator-types';
import type { DisclosureDomain } from './types';

declare const spfaProtocolIdBrand: unique symbol;
declare const spfaProtocolRequirementIdBrand: unique symbol;
declare const spfaApplicabilityPolicyIdBrand: unique symbol;

export type SpfaProtocolId = string & {
  readonly [spfaProtocolIdBrand]: true;
};

export type SpfaProtocolRequirementId = string & {
  readonly [spfaProtocolRequirementIdBrand]: true;
};

export type SpfaApplicabilityPolicyId = string & {
  readonly [spfaApplicabilityPolicyIdBrand]: true;
};

export type SpfaProtocolRefV2 = Readonly<{
  protocolId: SpfaProtocolId;
  version: string;
}>;

export type ApplicableRequirementImportance =
  | 'CRITICAL'
  | 'RELEVANT'
  | 'OPTIONAL';

export type SpfaInformationDomain =
  | {
      kind: 'patient_information';
      disclosureDomain: DisclosureDomain;
    }
  | {
      kind: 'protocol_information';
      domain:
        | 'service_context'
        | 'dispensing_subtype'
        | 'referral_criteria'
        | 'pharmacy_intervention_possibility'
        | 'additional_spfa_need';
    };

export type SpfaActionDomain =
  | 'safe_professional_action'
  | 'referral_action'
  | 'report_action'
  | 'care_path_transition';

export type SpfaRequirementApplicabilityDefinitionV2 =
  | {
      kind: 'ALWAYS';
    }
  | {
      kind: 'DISPENSING_SUBTYPE';
      subtypes: NonEmptyArray<DispensingSubtype>;
    }
  | {
      kind: 'CASE_DETERMINED';
      policyRef: SpfaApplicabilityPolicyId;
    };

export type SpfaSafetyCriticalityV2 = Readonly<{
  safetyCritical: boolean;
}>;

export type SpfaInformationRequirementDefinitionV2 = Readonly<{
  kind: 'INFORMATION_REQUIREMENT';
  requirementId: SpfaProtocolRequirementId;
  semanticDomain: SpfaInformationDomain;
  teacherLabel: string;
  description: string;
  defaultImportance: ApplicableRequirementImportance;
  informationGoal: string;
  safetyCriticality: SpfaSafetyCriticalityV2;
  applicability: SpfaRequirementApplicabilityDefinitionV2;
}>;

export type SpfaActionRequirementDefinitionV2 = Readonly<{
  kind: 'ACTION_REQUIREMENT';
  requirementId: SpfaProtocolRequirementId;
  semanticDomain: SpfaActionDomain;
  teacherLabel: string;
  description: string;
  defaultImportance: ApplicableRequirementImportance;
  actionGoal: string;
  safetyCriticality: SpfaSafetyCriticalityV2;
  applicability: SpfaRequirementApplicabilityDefinitionV2;
}>;

export type SpfaProtocolRequirementDefinitionV2 =
  | SpfaInformationRequirementDefinitionV2
  | SpfaActionRequirementDefinitionV2;

export type SpfaProtocolDefinitionV2 = Readonly<{
  schemaVersion: '2.0';
  protocolId: SpfaProtocolId;
  version: string;
  service: SpfaService;
  subtype?: DispensingSubtype;
  requirements: NonEmptyArray<SpfaProtocolRequirementDefinitionV2>;
}>;
