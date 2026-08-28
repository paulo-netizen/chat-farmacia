import type {
  PharmaceuticalAdjudicationContextFingerprintV1,
  PharmaceuticalAdjudicationRelevantVersionV2,
  PharmaceuticalExpectationMembershipV2,
  PharmaceuticalMedicationIdentityV2,
  PharmaceuticalTargetClinicalContextV2,
} from './pharmaceutical-adjudication-context-types';
import type {
  PharmaceuticalEvaluationExpectedValueV2,
  PharmaceuticalEvaluationTargetAspectV2,
  PharmaceuticalEvaluationTargetCategoryV2,
  PharmaceuticalEvaluationTargetId,
} from './pharmaceutical-evaluation-target-types';
import type { SessionMessageId } from './spfa-session-evidence-types';
import type { CaseVersionId, MedicationId } from './types';
import type { ConclusionId, ReportEssentialContentId } from './evaluator-types';

declare const pharmaceuticalD2ClaimIdBrand: unique symbol;

export type PharmaceuticalD2ClaimIdV2 = string & {
  readonly [pharmaceuticalD2ClaimIdBrand]: true;
};

export const PHARMACEUTICAL_D2_CLAIM_POLICY_VERSION_V1 =
  'pharmaceutical-d2-claim-policy/1' as const;
export const PHARMACEUTICAL_D2_CLAIM_PROMPT_VERSION_V1 =
  'pharmaceutical-d2-claim-prompt/1' as const;
export const PHARMACEUTICAL_D2_CLAIM_PROMPT_VERSION_V2 =
  'pharmaceutical-d2-claim-prompt/2' as const;
export const PHARMACEUTICAL_D2_STUDENT_MESSAGE_SET_CONTRACT_VERSION_V1 =
  'pharmaceutical-d2-student-message-set/1' as const;
export const PHARMACEUTICAL_D2_SEMANTIC_REQUEST_CONTRACT_VERSION_V1 =
  'pharmaceutical-d2-semantic-request/1' as const;
export const PHARMACEUTICAL_D2_PROVIDER_RESULT_CONTRACT_VERSION_V1 =
  'pharmaceutical-d2-provider-result/1' as const;
export const PHARMACEUTICAL_D2_FINDING_SET_CONTRACT_VERSION_V1 =
  'pharmaceutical-clinical-claim-finding-set/1' as const;

export type PharmaceuticalD2ClaimDomainV2 =
  | 'PRM'
  | 'RNM_RELATION'
  | 'ADHERENCE'
  | 'PROFESSIONAL_RESPONSE'
  | 'REFERRAL_REPORT';

export type PharmaceuticalD2FindingTypeV2 = 'CONTRADICTORY' | 'UNSUPPORTED';

export type PharmaceuticalD2ClaimFormV2 =
  | 'ASSERTION'
  | 'CONCLUSION'
  | 'RECOMMENDATION';

export type PharmaceuticalD2ClinicalRefV2 =
  | Readonly<{ kind: 'CONCLUSION'; conclusionRef: ConclusionId }>
  | Readonly<{ kind: 'RELATION'; relationRef: ConclusionId }>
  | Readonly<{ kind: 'MEDICATION'; medicationRef: MedicationId }>
  | Readonly<{ kind: 'REPORT_CONTENT'; reportContentRef: ReportEssentialContentId }>;

export type PharmaceuticalD2StudentMessageV2 = Readonly<{
  messageRef: SessionMessageId;
  untrustedContent: string;
}>;

export type PharmaceuticalD2StudentMessageSetFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'pharmaceutical-d2-student-message-set-v2/1';
  value: string;
}>;

export type PharmaceuticalD2StudentMessageSetV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-d2-student-message-set/1';
  sessionId: string;
  caseVersionId: CaseVersionId;
  contextFingerprint: PharmaceuticalAdjudicationContextFingerprintV1;
  messages: readonly PharmaceuticalD2StudentMessageV2[];
  fingerprint: PharmaceuticalD2StudentMessageSetFingerprintV1;
}>;

export type PharmaceuticalD2AuthorityTargetV2 = Readonly<{
  targetRef: PharmaceuticalEvaluationTargetId;
  domain: PharmaceuticalD2ClaimDomainV2;
  category: PharmaceuticalEvaluationTargetCategoryV2;
  aspect: PharmaceuticalEvaluationTargetAspectV2;
  expected: PharmaceuticalEvaluationExpectedValueV2;
  clinicalContext: PharmaceuticalTargetClinicalContextV2;
  medicationIdentities: readonly PharmaceuticalMedicationIdentityV2[];
  relevantVersions: readonly PharmaceuticalAdjudicationRelevantVersionV2[];
  expectationMemberships: readonly PharmaceuticalExpectationMembershipV2[];
  primaryClinicalRef?: PharmaceuticalD2ClinicalRefV2;
}>;

export type PharmaceuticalD2AuthorityProjectionV2 = Readonly<{
  targets: readonly PharmaceuticalD2AuthorityTargetV2[];
  allowedClinicalRefs: readonly PharmaceuticalD2ClinicalRefV2[];
}>;

export type PharmaceuticalD2SemanticRequestFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'pharmaceutical-d2-semantic-request-v2/1';
  value: string;
}>;

export type PharmaceuticalD2SemanticRequestV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-d2-semantic-request/1';
  contextFingerprint: PharmaceuticalAdjudicationContextFingerprintV1;
  policyVersion: string;
  promptVersion: string;
  studentMessages: PharmaceuticalD2StudentMessageSetV2;
  authorityProjection: PharmaceuticalD2AuthorityProjectionV2;
  requestFingerprint: PharmaceuticalD2SemanticRequestFingerprintV1;
}>;

export type PharmaceuticalD2ProviderFindingV1 = Readonly<{
  messageRef: SessionMessageId;
  excerpt: string;
  /** UTF-16 code-unit offsets in the student message, using [start, end). */
  excerptStart: number;
  excerptEnd: number;
  domain: PharmaceuticalD2ClaimDomainV2;
  findingType: PharmaceuticalD2FindingTypeV2;
  claimForm: PharmaceuticalD2ClaimFormV2;
  relatedClinicalRefs: readonly PharmaceuticalD2ClinicalRefV2[];
}>;

export type PharmaceuticalD2ProviderResultV1 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-d2-provider-result/1';
  findings: readonly PharmaceuticalD2ProviderFindingV1[];
}>;

export type PharmaceuticalClinicalClaimFindingV2 = Readonly<{
  claimId: PharmaceuticalD2ClaimIdV2;
  messageRef: SessionMessageId;
  excerpt: string;
  excerptStart: number;
  excerptEnd: number;
  domain: PharmaceuticalD2ClaimDomainV2;
  findingType: PharmaceuticalD2FindingTypeV2;
  claimForm: PharmaceuticalD2ClaimFormV2;
  relatedClinicalRefs: readonly PharmaceuticalD2ClinicalRefV2[];
}>;

export type PharmaceuticalClinicalClaimFindingSetFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'pharmaceutical-clinical-claim-finding-set-v2/1';
  value: string;
}>;

export type PharmaceuticalClinicalClaimFindingSetV2 = Readonly<{
  schemaVersion: '2.0';
  contractVersion: 'pharmaceutical-clinical-claim-finding-set/1';
  sessionId: string;
  caseVersionId: CaseVersionId;
  contextFingerprint: PharmaceuticalAdjudicationContextFingerprintV1;
  policyVersion: string;
  requestFingerprint: PharmaceuticalD2SemanticRequestFingerprintV1;
  findings: readonly PharmaceuticalClinicalClaimFindingV2[];
  fingerprint: PharmaceuticalClinicalClaimFindingSetFingerprintV1;
}>;
