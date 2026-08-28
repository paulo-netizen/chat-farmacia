import { z } from 'zod';

import {
  pharmaceuticalD2ClinicalRefKey,
} from './build-pharmaceutical-d2-semantic-request';
import {
  PHARMACEUTICAL_D2_PROVIDER_RESULT_CONTRACT_VERSION_V1,
  type PharmaceuticalD2ClinicalRefV2,
  type PharmaceuticalD2ProviderFindingV1,
  type PharmaceuticalD2ProviderResultV1,
  type PharmaceuticalD2SemanticRequestV2,
} from './pharmaceutical-d2-claim-types';

const CLINICAL_REF_SCHEMA = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CONCLUSION'), conclusionRef: z.string() }).strict(),
  z.object({ kind: z.literal('RELATION'), relationRef: z.string() }).strict(),
  z.object({ kind: z.literal('MEDICATION'), medicationRef: z.string() }).strict(),
  z.object({ kind: z.literal('REPORT_CONTENT'), reportContentRef: z.string() }).strict(),
]);

const PROVIDER_FINDING_SCHEMA = z.object({
  messageRef: z.string(),
  excerpt: z.string().min(1),
  excerptStart: z.number().int().nonnegative(),
  excerptEnd: z.number().int().positive(),
  domain: z.enum(['PRM', 'RNM_RELATION', 'ADHERENCE', 'PROFESSIONAL_RESPONSE', 'REFERRAL_REPORT']),
  findingType: z.enum(['CONTRADICTORY', 'UNSUPPORTED']),
  claimForm: z.enum(['ASSERTION', 'CONCLUSION', 'RECOMMENDATION']),
  relatedClinicalRefs: z.array(CLINICAL_REF_SCHEMA),
}).strict();

export const PHARMACEUTICAL_D2_PROVIDER_RESULT_SCHEMA_V1 = z.object({
  schemaVersion: z.literal('2.0'),
  contractVersion: z.literal(PHARMACEUTICAL_D2_PROVIDER_RESULT_CONTRACT_VERSION_V1),
  findings: z.array(PROVIDER_FINDING_SCHEMA),
}).strict();

export class PharmaceuticalD2ProviderResultValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalD2ProviderResultValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalD2ProviderResultValidationError(path, message);
}

function canonicalRefs(
  refs: readonly z.infer<typeof CLINICAL_REF_SCHEMA>[],
  allowedRefKeys: ReadonlySet<string>,
  path: string,
): PharmaceuticalD2ClinicalRefV2[] {
  const byKey = new Map<string, PharmaceuticalD2ClinicalRefV2>();
  refs.forEach((source, index) => {
    const ref = source as PharmaceuticalD2ClinicalRefV2;
    const key = pharmaceuticalD2ClinicalRefKey(ref);
    if (!allowedRefKeys.has(key)) {
      fail(`${path}[${index}]`, 'does not exist in the canonical D2 authority projection');
    }
    if (byKey.has(key)) fail(`${path}[${index}]`, 'duplicates a related clinical reference');
    byKey.set(key, structuredClone(ref));
  });
  return [...byKey.entries()]
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([, ref]) => ref);
}

function materialKey(finding: PharmaceuticalD2ProviderFindingV1): string {
  return JSON.stringify([
    finding.messageRef,
    finding.excerptStart,
    finding.excerptEnd,
    finding.domain,
    finding.findingType,
    finding.claimForm,
    finding.relatedClinicalRefs,
  ]);
}

function isStructurallyCoveredD1Contradiction(
  finding: PharmaceuticalD2ProviderFindingV1,
  request: PharmaceuticalD2SemanticRequestV2,
): boolean {
  if (finding.findingType !== 'CONTRADICTORY' || finding.relatedClinicalRefs.length !== 1) {
    return false;
  }
  const findingRefKey = pharmaceuticalD2ClinicalRefKey(finding.relatedClinicalRefs[0]);
  return request.authorityProjection.targets.some((target) =>
    target.domain === finding.domain &&
    target.primaryClinicalRef !== undefined &&
    pharmaceuticalD2ClinicalRefKey(target.primaryClinicalRef) === findingRefKey,
  );
}

export function validatePharmaceuticalD2ProviderResultV1(
  input: unknown,
  request: PharmaceuticalD2SemanticRequestV2,
): PharmaceuticalD2ProviderResultV1 {
  const parsed = PHARMACEUTICAL_D2_PROVIDER_RESULT_SCHEMA_V1.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const issuePath = ['providerResult', ...issue.path]
      .join('.')
      .replace(/\.([0-9]+)(?=\.|$)/g, '[$1]');
    fail(issuePath, issue.message);
  }

  const messages = new Map(
    request.studentMessages.messages.map((message) => [message.messageRef, message] as const),
  );
  const allowedRefKeys = new Set(
    request.authorityProjection.allowedClinicalRefs.map(pharmaceuticalD2ClinicalRefKey),
  );
  const seenFindings = new Set<string>();
  const findings = parsed.data.findings.map((source, index): PharmaceuticalD2ProviderFindingV1 => {
    const path = `providerResult.findings[${index}]`;
    const message = messages.get(source.messageRef as never);
    if (message === undefined) {
      fail(`${path}.messageRef`, 'must reference a canonical student message');
    }
    if (source.excerptEnd <= source.excerptStart) {
      fail(`${path}.excerptEnd`, 'must be greater than excerptStart');
    }
    if (source.excerptEnd > message.untrustedContent.length) {
      fail(`${path}.excerptEnd`, 'is outside the referenced student message');
    }
    if (message.untrustedContent.slice(source.excerptStart, source.excerptEnd) !== source.excerpt) {
      fail(`${path}.excerpt`, 'must equal the literal [excerptStart, excerptEnd) message slice');
    }
    const finding: PharmaceuticalD2ProviderFindingV1 = {
      messageRef: source.messageRef as never,
      excerpt: source.excerpt,
      excerptStart: source.excerptStart,
      excerptEnd: source.excerptEnd,
      domain: source.domain,
      findingType: source.findingType,
      claimForm: source.claimForm,
      relatedClinicalRefs: canonicalRefs(
        source.relatedClinicalRefs,
        allowedRefKeys,
        `${path}.relatedClinicalRefs`,
      ),
    };
    if (isStructurallyCoveredD1Contradiction(finding, request)) {
      fail(path, 'duplicates a contradiction structurally represented by an existing D1 target');
    }
    const key = materialKey(finding);
    if (seenFindings.has(key)) fail(path, 'duplicates another provider finding');
    seenFindings.add(key);
    return finding;
  });

  return {
    schemaVersion: '2.0',
    contractVersion: PHARMACEUTICAL_D2_PROVIDER_RESULT_CONTRACT_VERSION_V1,
    findings,
  };
}
