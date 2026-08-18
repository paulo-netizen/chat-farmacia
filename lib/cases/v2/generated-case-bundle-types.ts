import type { BriefComplianceReportV2 } from './brief-compliance-types';
import type { EvaluatorViewV2 } from './evaluator-types';
import type { TeachingBriefId } from './teaching-brief-types';
import type { TeachingCaseSummaryV2 } from './teaching-case-summary-types';
import type {
  CasePatientFactsDraftV2,
  CaseVersionId,
  PatientRuntimeViewV2,
} from './types';

export type ContentFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'teaching-brief-v2/1';
  value: string;
}>;

export type SourceBriefRefV2 = Readonly<{
  briefId: TeachingBriefId;
  revision: number;
  fingerprint: ContentFingerprintV1;
}>;

export type GenerationProvenanceV2 = Readonly<{
  generatorContractVersion: string;
  promptVersion: string;
  model: Readonly<{
    provider: string;
    identifier: string;
  }>;
  assemblerVersion: string;
  disclosurePolicyVersion: string;
}>;

export type GeneratedCaseBundleV2 = Readonly<{
  schemaVersion: '2.0';
  sourceBrief: SourceBriefRefV2;
  sourceOfTruth: Readonly<{
    caseVersionId: CaseVersionId;
    patientFacts: CasePatientFactsDraftV2;
    evaluator: EvaluatorViewV2;
  }>;
  derived: Readonly<{
    patientRuntime: PatientRuntimeViewV2;
    teachingSummary: TeachingCaseSummaryV2;
    complianceReport: BriefComplianceReportV2;
  }>;
  provenance: GenerationProvenanceV2;
}>;

export type GeneratedCaseBundleBuildErrorCode =
  | 'invalid_source_brief'
  | 'invalid_core'
  | 'runtime_build_failed'
  | 'summary_build_failed'
  | 'compliance_build_failed'
  | 'invalid_provenance'
  | 'fingerprint_failed';

export class GeneratedCaseBundleBuildError extends Error {
  constructor(
    public readonly code: GeneratedCaseBundleBuildErrorCode,
    public readonly path: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'GeneratedCaseBundleBuildError';
  }
}
