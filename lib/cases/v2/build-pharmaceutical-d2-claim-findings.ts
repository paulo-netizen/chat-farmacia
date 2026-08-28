import { createHash } from 'node:crypto';

import { pharmaceuticalD2ClinicalRefKey } from './build-pharmaceutical-d2-semantic-request';
import {
  PHARMACEUTICAL_D2_FINDING_SET_CONTRACT_VERSION_V1,
  type PharmaceuticalClinicalClaimFindingSetFingerprintV1,
  type PharmaceuticalClinicalClaimFindingSetV2,
  type PharmaceuticalClinicalClaimFindingV2,
  type PharmaceuticalD2ClaimIdV2,
  type PharmaceuticalD2ProviderFindingV1,
  type PharmaceuticalD2ProviderResultV1,
  type PharmaceuticalD2SemanticRequestV2,
} from './pharmaceutical-d2-claim-types';
import { validatePharmaceuticalD2ProviderResultV1 } from './validate-pharmaceutical-d2-provider-result';

type UnknownRecord = Record<string, unknown>;
type FindingSetCore = Omit<PharmaceuticalClinicalClaimFindingSetV2, 'fingerprint'>;

const DOMAIN_ORDER = [
  'PRM',
  'RNM_RELATION',
  'ADHERENCE',
  'PROFESSIONAL_RESPONSE',
  'REFERRAL_REPORT',
] as const;
const FINDING_TYPE_ORDER = ['CONTRADICTORY', 'UNSUPPORTED'] as const;
const CLAIM_FORM_ORDER = ['ASSERTION', 'CONCLUSION', 'RECOMMENDATION'] as const;

export class PharmaceuticalD2ClaimFindingSetValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalD2ClaimFindingSetValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalD2ClaimFindingSetValidationError(path, message);
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
      fail(path, 'must contain the canonical finding-set value');
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
  if (actual !== expected) fail(path, 'does not match the canonical finding-set value');
}

function ordinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function indexOf<T extends string>(order: readonly T[], value: T): number {
  return order.indexOf(value);
}

function claimId(
  request: PharmaceuticalD2SemanticRequestV2,
  finding: PharmaceuticalD2ProviderFindingV1,
): PharmaceuticalD2ClaimIdV2 {
  const material = JSON.stringify([
    PHARMACEUTICAL_D2_FINDING_SET_CONTRACT_VERSION_V1,
    request.contextFingerprint,
    finding.messageRef,
    finding.excerptStart,
    finding.excerptEnd,
    finding.domain,
    finding.findingType,
    finding.claimForm,
    finding.relatedClinicalRefs.map(pharmaceuticalD2ClinicalRefKey),
  ]);
  return `pharm_claim_${createHash('sha256').update(material).digest('hex')}` as PharmaceuticalD2ClaimIdV2;
}

function compareFindings(
  left: PharmaceuticalClinicalClaimFindingV2,
  right: PharmaceuticalClinicalClaimFindingV2,
  messageOrder: ReadonlyMap<string, number>,
): number {
  return (
    (messageOrder.get(left.messageRef) ?? -1) - (messageOrder.get(right.messageRef) ?? -1) ||
    left.excerptStart - right.excerptStart ||
    left.excerptEnd - right.excerptEnd ||
    indexOf(DOMAIN_ORDER, left.domain) - indexOf(DOMAIN_ORDER, right.domain) ||
    indexOf(FINDING_TYPE_ORDER, left.findingType) - indexOf(FINDING_TYPE_ORDER, right.findingType) ||
    indexOf(CLAIM_FORM_ORDER, left.claimForm) - indexOf(CLAIM_FORM_ORDER, right.claimForm) ||
    ordinal(
      left.relatedClinicalRefs.map(pharmaceuticalD2ClinicalRefKey).join('|'),
      right.relatedClinicalRefs.map(pharmaceuticalD2ClinicalRefKey).join('|'),
    )
  );
}

export function calculatePharmaceuticalClinicalClaimFindingSetFingerprintV1(
  core: FindingSetCore,
): PharmaceuticalClinicalClaimFindingSetFingerprintV1 {
  return {
    algorithm: 'sha256',
    canonicalization: 'pharmaceutical-clinical-claim-finding-set-v2/1',
    value: createHash('sha256').update(JSON.stringify(core)).digest('hex'),
  };
}

export function buildPharmaceuticalClinicalClaimFindingSetV2(
  request: PharmaceuticalD2SemanticRequestV2,
  providerInput: unknown,
): PharmaceuticalClinicalClaimFindingSetV2 {
  const providerResult: PharmaceuticalD2ProviderResultV1 =
    validatePharmaceuticalD2ProviderResultV1(providerInput, request);
  const messageOrder = new Map(
    request.studentMessages.messages.map((message, index) => [message.messageRef, index] as const),
  );
  const findings = providerResult.findings
    .map((finding): PharmaceuticalClinicalClaimFindingV2 => ({
      claimId: claimId(request, finding),
      ...structuredClone(finding),
    }))
    .sort((left, right) => compareFindings(left, right, messageOrder));
  const claimIds = new Set<string>();
  findings.forEach((finding, index) => {
    if (claimIds.has(finding.claimId)) {
      fail(`findings[${index}].claimId`, 'duplicates a deterministic claim identity');
    }
    claimIds.add(finding.claimId);
  });
  const core: FindingSetCore = {
    schemaVersion: '2.0',
    contractVersion: PHARMACEUTICAL_D2_FINDING_SET_CONTRACT_VERSION_V1,
    sessionId: request.studentMessages.sessionId,
    caseVersionId: request.studentMessages.caseVersionId,
    contextFingerprint: structuredClone(request.contextFingerprint),
    policyVersion: request.policyVersion,
    requestFingerprint: structuredClone(request.requestFingerprint),
    findings,
  };
  return {
    ...core,
    fingerprint: calculatePharmaceuticalClinicalClaimFindingSetFingerprintV1(core),
  };
}

export function validatePharmaceuticalClinicalClaimFindingSetV2(
  input: unknown,
  request: PharmaceuticalD2SemanticRequestV2,
  providerInput: unknown,
): PharmaceuticalClinicalClaimFindingSetV2 {
  const expected = buildPharmaceuticalClinicalClaimFindingSetV2(request, providerInput);
  assertExact(input, expected, 'pharmaceuticalClinicalClaimFindingSet');
  return expected;
}
