import { createHash } from 'node:crypto';

import type {
  PharmaceuticalAdjudicationContextSetV2,
  PharmaceuticalTargetAdjudicationContextV2,
  PharmaceuticalTargetClinicalContextV2,
} from './pharmaceutical-adjudication-context-types';
import { buildPharmaceuticalD2StudentMessageSetV2 } from './build-pharmaceutical-d2-student-message-set';
import {
  PHARMACEUTICAL_D2_CLAIM_POLICY_VERSION_V1,
  PHARMACEUTICAL_D2_CLAIM_PROMPT_VERSION_V1,
  PHARMACEUTICAL_D2_SEMANTIC_REQUEST_CONTRACT_VERSION_V1,
  type PharmaceuticalD2AuthorityProjectionV2,
  type PharmaceuticalD2AuthorityTargetV2,
  type PharmaceuticalD2ClaimDomainV2,
  type PharmaceuticalD2ClinicalRefV2,
  type PharmaceuticalD2SemanticRequestFingerprintV1,
  type PharmaceuticalD2SemanticRequestV2,
} from './pharmaceutical-d2-claim-types';
import type { PharmaceuticalEvaluationExpectedValueV2 } from './pharmaceutical-evaluation-target-types';

type UnknownRecord = Record<string, unknown>;
type RequestCore = Omit<PharmaceuticalD2SemanticRequestV2, 'requestFingerprint'>;

export class PharmaceuticalD2SemanticRequestError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalD2SemanticRequestError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalD2SemanticRequestError(path, message);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as UnknownRecord;
}

function assertExact(actual: unknown, expected: unknown, path: string): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      fail(path, 'must contain the canonical request data');
    }
    expected.forEach((item, index) => assertExact(actual[index], item, `${path}[${index}]`));
    return;
  }
  if (typeof expected === 'object' && expected !== null) {
    const source = record(actual, path);
    const expectedRecord = expected as UnknownRecord;
    for (const key of Object.keys(source)) {
      if (!Object.prototype.hasOwnProperty.call(expectedRecord, key)) {
        fail(`${path}.${key}`, 'unexpected property');
      }
    }
    for (const key of Object.keys(expectedRecord)) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) {
        fail(`${path}.${key}`, 'missing required property');
      }
      assertExact(source[key], expectedRecord[key], `${path}.${key}`);
    }
    return;
  }
  if (actual !== expected) fail(path, 'does not match the canonical semantic request');
}

function identity(value: string, path: string): string {
  if (value.length === 0 || value !== value.trim()) {
    fail(path, 'must be a non-empty trimmed server-owned identity');
  }
  return value;
}

function domainForTarget(target: PharmaceuticalTargetAdjudicationContextV2): PharmaceuticalD2ClaimDomainV2 {
  const aspect = target.aspect;
  if (aspect.startsWith('PRM_RNM_') || aspect.startsWith('RNM_')) return 'RNM_RELATION';
  if (aspect.startsWith('PRM_')) return 'PRM';
  if (
    aspect.startsWith('ADHERENCE_') ||
    aspect.startsWith('BARRIER_') ||
    aspect.startsWith('STRATEGY_')
  ) return 'ADHERENCE';
  if (aspect.startsWith('PROFESSIONAL_ACTION_') || aspect.startsWith('INTERVENTION_')) {
    return 'PROFESSIONAL_RESPONSE';
  }
  return 'REFERRAL_REPORT';
}

function conclusion(conclusionRef: string): PharmaceuticalD2ClinicalRefV2 {
  return { kind: 'CONCLUSION', conclusionRef: conclusionRef as never };
}

function relation(relationRef: string): PharmaceuticalD2ClinicalRefV2 {
  return { kind: 'RELATION', relationRef: relationRef as never };
}

function medication(medicationRef: string): PharmaceuticalD2ClinicalRefV2 {
  return { kind: 'MEDICATION', medicationRef: medicationRef as never };
}

function reportContent(reportContentRef: string): PharmaceuticalD2ClinicalRefV2 {
  return { kind: 'REPORT_CONTENT', reportContentRef: reportContentRef as never };
}

function refsFromExpected(expected: PharmaceuticalEvaluationExpectedValueV2): PharmaceuticalD2ClinicalRefV2[] {
  switch (expected.kind) {
    case 'MEDICATION_SCOPE':
      return expected.medicationRefs.map((ref) => medication(ref));
    case 'CONCLUSION_REFS':
      return expected.conclusionRefs.map((ref) => conclusion(ref));
    case 'PRM_RNM_RELATION':
      return [conclusion(expected.prmRef), conclusion(expected.rnmAssessmentRef)];
    case 'REPORT_CONTENT':
      return [reportContent(expected.contentId)];
    default:
      return [];
  }
}

function refsFromClinicalContext(context: PharmaceuticalTargetClinicalContextV2): PharmaceuticalD2ClinicalRefV2[] {
  switch (context.domain) {
    case 'PRM':
      return context.finding === undefined
        ? []
        : [
            conclusion(context.finding.findingRef),
            ...context.finding.medicationRefs.map((ref) => medication(ref)),
          ];
    case 'RNM':
      return [
        conclusion(context.assessment.assessmentRef),
        ...context.assessment.medicationRefs.map((ref) => medication(ref)),
      ];
    case 'PRM_RNM_RELATION':
      return [
        relation(context.relationRef),
        conclusion(context.prm.findingRef),
        conclusion(context.rnm.assessmentRef),
        ...context.prm.medicationRefs.map((ref) => medication(ref)),
        ...context.rnm.medicationRefs.map((ref) => medication(ref)),
      ];
    case 'ADHERENCE':
      return [
        conclusion(context.assessment.assessmentRef),
        ...context.assessment.medicationRefs.map((ref) => medication(ref)),
        ...(context.typeConclusion === undefined
          ? []
          : [conclusion(context.typeConclusion.conclusionRef)]),
      ];
    case 'BARRIER':
      return [
        conclusion(context.adherenceAssessment.assessmentRef),
        conclusion(context.barrierAssessment.assessmentRef),
        ...context.adherenceAssessment.medicationRefs.map((ref) => medication(ref)),
        ...(context.barrier === undefined ? [] : [conclusion(context.barrier.barrierRef)]),
      ];
    case 'STRATEGY':
      return [
        conclusion(context.adherenceAssessment.assessmentRef),
        conclusion(context.strategy.strategyRef),
        ...context.adherenceAssessment.medicationRefs.map((ref) => medication(ref)),
        ...context.strategy.addressedBarrierRefs.map((ref) => conclusion(ref)),
      ];
    case 'PROFESSIONAL_ACTION':
      return [
        conclusion(context.action.actionRef),
        conclusion(context.action.spfaRef),
        ...(context.action.targetSpfaRef === undefined
          ? []
          : [conclusion(context.action.targetSpfaRef)]),
        ...(context.action.referralRef === undefined
          ? []
          : [conclusion(context.action.referralRef)]),
      ];
    case 'PHARMACEUTICAL_INTERVENTION':
      return [
        conclusion(context.intervention.interventionRef),
        conclusion(context.intervention.spfaRef),
        ...context.intervention.addressedConclusionRefs.map((ref) => conclusion(ref)),
        ...(context.intervention.professionalActionRef === undefined
          ? []
          : [conclusion(context.intervention.professionalActionRef)]),
        ...(context.intervention.referralRef === undefined
          ? []
          : [conclusion(context.intervention.referralRef)]),
      ];
    case 'REFERRAL':
      return [conclusion(context.referralRef)];
    case 'REPORT':
      return [
        conclusion(context.referralRef),
        ...(context.content === undefined ? [] : [reportContent(context.content.contentId)]),
      ];
  }
}

function primaryClinicalRef(target: PharmaceuticalTargetAdjudicationContextV2): PharmaceuticalD2ClinicalRefV2 | undefined {
  const context = target.clinicalContext;
  switch (context.domain) {
    case 'PRM':
      return context.finding === undefined ? undefined : conclusion(context.finding.findingRef);
    case 'RNM':
      return conclusion(context.assessment.assessmentRef);
    case 'PRM_RNM_RELATION':
      return relation(context.relationRef);
    case 'ADHERENCE':
      return target.aspect === 'ADHERENCE_TYPE' && context.typeConclusion !== undefined
        ? conclusion(context.typeConclusion.conclusionRef)
        : conclusion(context.assessment.assessmentRef);
    case 'BARRIER':
      return context.barrier === undefined
        ? conclusion(context.barrierAssessment.assessmentRef)
        : conclusion(context.barrier.barrierRef);
    case 'STRATEGY':
      return conclusion(context.strategy.strategyRef);
    case 'PROFESSIONAL_ACTION':
      return conclusion(context.action.actionRef);
    case 'PHARMACEUTICAL_INTERVENTION':
      return conclusion(context.intervention.interventionRef);
    case 'REFERRAL':
      return conclusion(context.referralRef);
    case 'REPORT':
      return target.aspect === 'REPORT_CONTENT' && context.content !== undefined
        ? reportContent(context.content.contentId)
        : conclusion(context.referralRef);
  }
}

export function pharmaceuticalD2ClinicalRefKey(ref: PharmaceuticalD2ClinicalRefV2): string {
  switch (ref.kind) {
    case 'CONCLUSION': return `CONCLUSION:${ref.conclusionRef}`;
    case 'RELATION': return `RELATION:${ref.relationRef}`;
    case 'MEDICATION': return `MEDICATION:${ref.medicationRef}`;
    case 'REPORT_CONTENT': return `REPORT_CONTENT:${ref.reportContentRef}`;
  }
}

function canonicalRefs(refs: readonly PharmaceuticalD2ClinicalRefV2[]): PharmaceuticalD2ClinicalRefV2[] {
  const byKey = new Map<string, PharmaceuticalD2ClinicalRefV2>();
  refs.forEach((ref) => byKey.set(pharmaceuticalD2ClinicalRefKey(ref), ref));
  return [...byKey.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([, ref]) => structuredClone(ref));
}

function authorityProjection(
  context: PharmaceuticalAdjudicationContextSetV2,
): PharmaceuticalD2AuthorityProjectionV2 {
  const targets: PharmaceuticalD2AuthorityTargetV2[] = context.targets.map((target) => ({
    targetRef: target.targetRef,
    domain: domainForTarget(target),
    category: target.category,
    aspect: target.aspect,
    expected: structuredClone(target.expected),
    clinicalContext: structuredClone(target.clinicalContext),
    medicationIdentities: structuredClone(target.medicationIdentities),
    relevantVersions: structuredClone(target.relevantVersions),
    expectationMemberships: structuredClone(target.expectationMemberships),
    ...(primaryClinicalRef(target) === undefined
      ? {}
      : { primaryClinicalRef: structuredClone(primaryClinicalRef(target)!) }),
  }));
  const allowedClinicalRefs = canonicalRefs(
    context.targets.flatMap((target) => [
      ...refsFromClinicalContext(target.clinicalContext),
      ...refsFromExpected(target.expected),
      ...target.medicationIdentities.map((item) => medication(item.medicationId)),
    ]),
  );
  return { targets, allowedClinicalRefs };
}

export function calculatePharmaceuticalD2SemanticRequestFingerprintV1(
  core: RequestCore,
): PharmaceuticalD2SemanticRequestFingerprintV1 {
  const material = JSON.stringify([
    core.contractVersion,
    core.contextFingerprint,
    core.policyVersion,
    core.promptVersion,
    core.studentMessages,
    core.authorityProjection,
  ]);
  return {
    algorithm: 'sha256',
    canonicalization: 'pharmaceutical-d2-semantic-request-v2/1',
    value: createHash('sha256').update(material).digest('hex'),
  };
}

export function buildPharmaceuticalD2SemanticRequestV2(
  context: PharmaceuticalAdjudicationContextSetV2,
  promptVersion: string = PHARMACEUTICAL_D2_CLAIM_PROMPT_VERSION_V1,
  policyVersion: string = PHARMACEUTICAL_D2_CLAIM_POLICY_VERSION_V1,
): PharmaceuticalD2SemanticRequestV2 {
  const core: RequestCore = {
    schemaVersion: '2.0',
    contractVersion: PHARMACEUTICAL_D2_SEMANTIC_REQUEST_CONTRACT_VERSION_V1,
    contextFingerprint: structuredClone(context.fingerprint),
    policyVersion: identity(policyVersion, 'policyVersion'),
    promptVersion: identity(promptVersion, 'promptVersion'),
    studentMessages: buildPharmaceuticalD2StudentMessageSetV2(context),
    authorityProjection: authorityProjection(context),
  };
  return {
    ...core,
    requestFingerprint: calculatePharmaceuticalD2SemanticRequestFingerprintV1(core),
  };
}

export function validatePharmaceuticalD2SemanticRequestV2(
  input: unknown,
  context: PharmaceuticalAdjudicationContextSetV2,
  expectedPromptVersion: string = PHARMACEUTICAL_D2_CLAIM_PROMPT_VERSION_V1,
  expectedPolicyVersion: string = PHARMACEUTICAL_D2_CLAIM_POLICY_VERSION_V1,
): PharmaceuticalD2SemanticRequestV2 {
  const expected = buildPharmaceuticalD2SemanticRequestV2(
    context,
    expectedPromptVersion,
    expectedPolicyVersion,
  );
  assertExact(input, expected, 'pharmaceuticalD2SemanticRequest');
  return expected;
}
