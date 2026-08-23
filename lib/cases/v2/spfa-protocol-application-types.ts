import type { ConclusionId, NonEmptyArray } from './evaluator-types';
import type {
  ApplicableRequirementImportance,
  SpfaApplicabilityPolicyId,
  SpfaProtocolRefV2,
  SpfaProtocolRequirementId,
} from './spfa-protocol-types';
import type { CaseVersionId, FactId, MedicationId } from './types';

declare const spfaRequirementTargetIdBrand: unique symbol;

export type SpfaRequirementTargetId = string & {
  readonly [spfaRequirementTargetIdBrand]: true;
};

export type SpfaPublicProfileFieldV2 = 'age' | 'sex';

export type SpfaInformationTargetV2 =
  | { kind: 'FACT'; factRef: FactId }
  | { kind: 'PUBLIC_PROFILE'; field: SpfaPublicProfileFieldV2 }
  | { kind: 'MEDICATION_ENTITY'; medicationRef: MedicationId }
  | {
      kind: 'MEDICATION_FACT';
      medicationRef: MedicationId;
      factRef: FactId;
    };

export type BoundSpfaInformationTargetV2 = Readonly<{
  targetId: SpfaRequirementTargetId;
  target: SpfaInformationTargetV2;
}>;

export type SpfaActionTargetV2 =
  | {
      kind: 'EVALUATOR_CONCLUSION';
      conclusionRef: ConclusionId;
    }
  | {
      kind: 'CARE_PATH_TRANSITION';
      transitionRef: ConclusionId;
    };

export type BoundSpfaActionTargetV2 = Readonly<{
  targetId: SpfaRequirementTargetId;
  target: SpfaActionTargetV2;
}>;

export type AppliedNotApplicableReasonV2 =
  | {
      kind: 'DISPENSING_SUBTYPE_MISMATCH';
    }
  | {
      kind: 'CASE_DETERMINED';
      policyRef: SpfaApplicabilityPolicyId;
    };

export type AppliedRequirementApplicabilityV2 =
  | {
      status: 'APPLICABLE';
      effectiveImportance: ApplicableRequirementImportance;
    }
  | {
      status: 'NOT_APPLICABLE';
      reason: AppliedNotApplicableReasonV2;
    };

type AppliedRequirementIdentityV2 = {
  requirementRef: SpfaProtocolRequirementId;
};

export type AppliedInformationRequirementV2 = Readonly<
  AppliedRequirementIdentityV2 &
    (
      | {
          kind: 'INFORMATION_REQUIREMENT';
          applicability: Extract<
            AppliedRequirementApplicabilityV2,
            { status: 'APPLICABLE' }
          >;
          informationTargets: NonEmptyArray<BoundSpfaInformationTargetV2>;
        }
      | {
          kind: 'INFORMATION_REQUIREMENT';
          applicability: Extract<
            AppliedRequirementApplicabilityV2,
            { status: 'NOT_APPLICABLE' }
          >;
          informationTargets: readonly [];
        }
    )
>;

export type AppliedActionRequirementV2 = Readonly<
  AppliedRequirementIdentityV2 &
    (
      | {
          kind: 'ACTION_REQUIREMENT';
          applicability: Extract<
            AppliedRequirementApplicabilityV2,
            { status: 'APPLICABLE' }
          >;
          actionTargets: NonEmptyArray<BoundSpfaActionTargetV2>;
        }
      | {
          kind: 'ACTION_REQUIREMENT';
          applicability: Extract<
            AppliedRequirementApplicabilityV2,
            { status: 'NOT_APPLICABLE' }
          >;
          actionTargets: readonly [];
        }
    )
>;

export type AppliedSpfaRequirementV2 =
  | AppliedInformationRequirementV2
  | AppliedActionRequirementV2;

export type CaseSpfaProtocolApplicationV2 = Readonly<{
  schemaVersion: '2.0';
  caseVersionId: CaseVersionId;
  carePathSpfaRef: ConclusionId;
  protocolRef: SpfaProtocolRefV2;
  requirements: NonEmptyArray<AppliedSpfaRequirementV2>;
}>;
