import type {
  EvaluatorViewV2,
  NonEmptyArray,
  VersionRef,
} from './evaluator-types';
import type { CanonicalGeneratedCaseCoreV2 } from './generation-assembly-types';
import type { CaseSpfaProtocolApplicationV2 } from './spfa-protocol-application-types';
import type { SpfaProtocolDefinitionV2 } from './spfa-protocol-types';

export type CaseSpfaProtocolSetV2 = Readonly<{
  schemaVersion: '2.0';
  catalogRef: VersionRef;
  definitions: NonEmptyArray<SpfaProtocolDefinitionV2>;
  applications: NonEmptyArray<CaseSpfaProtocolApplicationV2>;
}>;

export type SpfaIntegratedGeneratedCaseCoreV2 = Readonly<{
  caseVersionId: CanonicalGeneratedCaseCoreV2['caseVersionId'];
  patientFacts: CanonicalGeneratedCaseCoreV2['patientFacts'];
  evaluator: EvaluatorViewV2;
  spfaProtocolSet: CaseSpfaProtocolSetV2;
}>;
