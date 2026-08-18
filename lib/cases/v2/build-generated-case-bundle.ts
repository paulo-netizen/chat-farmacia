import { createHash } from 'node:crypto';

import { buildBriefComplianceReportV2 } from './build-brief-compliance-report';
import { buildTeachingCaseSummaryV2 } from './build-teaching-case-summary';
import {
  GeneratedCaseBundleBuildError,
  type ContentFingerprintV1,
  type GeneratedCaseBundleV2,
  type GenerationProvenanceV2,
} from './generated-case-bundle-types';
import type { CanonicalGeneratedCaseCoreV2 } from './generation-assembly-types';
import { createPatientRuntimeViewV2 } from './patient-runtime';
import type { TeachingCaseGenerationBriefV2 } from './teaching-brief-types';
import { validateTeachingCaseGenerationBriefV2 } from './validate-teaching-brief';

const MAX_PROVENANCE_STRING_LENGTH = 200;
const FINGERPRINT_CANONICALIZATION = 'teaching-brief-v2/1' as const;

function fail(
  code: GeneratedCaseBundleBuildError['code'],
  path: string,
  message: string,
  cause?: unknown,
): never {
  throw new GeneratedCaseBundleBuildError(code, path, message, cause);
}

function errorPath(cause: unknown, fallback: string): string {
  return cause instanceof Error && 'path' in cause
    ? String((cause as { path: unknown }).path)
    : fallback;
}

function asRecord(
  value: unknown,
  path: string,
  code: GeneratedCaseBundleBuildError['code'],
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(code, path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  code: GeneratedCaseBundleBuildError['code'],
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) fail(code, `${path}.${key}`, 'unexpected property');
  }
}

function boundedString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('invalid_provenance', path, 'must be a non-empty string');
  }
  if (value.length > MAX_PROVENANCE_STRING_LENGTH) {
    fail(
      'invalid_provenance',
      path,
      `must contain at most ${MAX_PROVENANCE_STRING_LENGTH} characters`,
    );
  }
  return value;
}

function validateAndCloneProvenance(
  input: GenerationProvenanceV2,
): GenerationProvenanceV2 {
  const source = asRecord(input, 'provenance', 'invalid_provenance');
  assertExactKeys(
    source,
    [
      'generatorContractVersion',
      'promptVersion',
      'model',
      'assemblerVersion',
      'disclosurePolicyVersion',
    ],
    'provenance',
    'invalid_provenance',
  );
  const model = asRecord(source.model, 'provenance.model', 'invalid_provenance');
  assertExactKeys(
    model,
    ['provider', 'identifier'],
    'provenance.model',
    'invalid_provenance',
  );
  return {
    generatorContractVersion: boundedString(
      source.generatorContractVersion,
      'provenance.generatorContractVersion',
    ),
    promptVersion: boundedString(source.promptVersion, 'provenance.promptVersion'),
    model: {
      provider: boundedString(model.provider, 'provenance.model.provider'),
      identifier: boundedString(model.identifier, 'provenance.model.identifier'),
    },
    assemblerVersion: boundedString(
      source.assemblerVersion,
      'provenance.assemblerVersion',
    ),
    disclosurePolicyVersion: boundedString(
      source.disclosurePolicyVersion,
      'provenance.disclosurePolicyVersion',
    ),
  };
}

function cloneMaterialized<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneMaterialized(item)) as T;
  }
  if (typeof value !== 'object' || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (item !== undefined) result[key] = cloneMaterialized(item);
  }
  return result as T;
}

function ordinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalizeBriefValue(value: unknown, path: string): string {
  if (value === null) return 'null';
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      fail('fingerprint_failed', path, 'cannot canonicalize a non-finite number');
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    const items = value.map((item, index) => {
      if (item === undefined) {
        fail(
          'fingerprint_failed',
          `${path}[${index}]`,
          'undefined is forbidden in materialized arrays',
        );
      }
      return canonicalizeBriefValue(item, `${path}[${index}]`);
    });
    return `[${items.join(',')}]`;
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source)
      .filter((key) => source[key] !== undefined)
      .sort(ordinalCompare);
    const fields = keys.map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalizeBriefValue(
          source[key],
          `${path}.${key}`,
        )}`,
    );
    return `{${fields.join(',')}}`;
  }
  fail(
    'fingerprint_failed',
    path,
    `unsupported canonicalization value: ${typeof value}`,
  );
}

function fingerprintBrief(
  brief: TeachingCaseGenerationBriefV2,
): ContentFingerprintV1 {
  try {
    const canonical = canonicalizeBriefValue(brief, 'brief');
    return {
      algorithm: 'sha256',
      canonicalization: FINGERPRINT_CANONICALIZATION,
      value: createHash('sha256').update(canonical, 'utf8').digest('hex'),
    };
  } catch (cause) {
    if (cause instanceof GeneratedCaseBundleBuildError) throw cause;
    fail(
      'fingerprint_failed',
      'sourceBrief.fingerprint',
      'failed to calculate teaching brief fingerprint',
      cause,
    );
  }
}

function validateCoreIdentity(core: CanonicalGeneratedCaseCoreV2): void {
  const source = asRecord(core, 'core', 'invalid_core');
  assertExactKeys(
    source,
    ['caseVersionId', 'patientFacts', 'evaluator'],
    'core',
    'invalid_core',
  );
  if (typeof source.caseVersionId !== 'string') {
    fail('invalid_core', 'core.caseVersionId', 'must be a CaseVersionId');
  }
  const patientFacts = asRecord(
    source.patientFacts,
    'core.patientFacts',
    'invalid_core',
  );
  const evaluator = asRecord(source.evaluator, 'core.evaluator', 'invalid_core');
  if (patientFacts.caseVersionId !== source.caseVersionId) {
    fail(
      'invalid_core',
      'core.patientFacts.caseVersionId',
      'must match core.caseVersionId',
    );
  }
  if (evaluator.caseVersionId !== source.caseVersionId) {
    fail(
      'invalid_core',
      'core.evaluator.caseVersionId',
      'must match core.caseVersionId',
    );
  }
}

export function buildGeneratedCaseBundleV2(
  briefInput: TeachingCaseGenerationBriefV2,
  coreInput: CanonicalGeneratedCaseCoreV2,
  provenanceInput: GenerationProvenanceV2,
): GeneratedCaseBundleV2 {
  let brief: TeachingCaseGenerationBriefV2;
  try {
    brief = validateTeachingCaseGenerationBriefV2(briefInput);
  } catch (cause) {
    fail(
      'invalid_source_brief',
      errorPath(cause, 'brief'),
      'source teaching brief validation failed',
      cause,
    );
  }

  validateCoreIdentity(coreInput);
  const patientFacts = cloneMaterialized(coreInput.patientFacts);
  const evaluator = cloneMaterialized(coreInput.evaluator);

  let patientRuntime;
  try {
    patientRuntime = createPatientRuntimeViewV2(patientFacts);
  } catch (cause) {
    fail(
      'runtime_build_failed',
      errorPath(cause, 'derived.patientRuntime'),
      'patient runtime construction failed',
      cause,
    );
  }

  let teachingSummary;
  try {
    teachingSummary = buildTeachingCaseSummaryV2(patientRuntime, evaluator);
  } catch (cause) {
    fail(
      'summary_build_failed',
      errorPath(cause, 'derived.teachingSummary'),
      'teaching summary construction failed',
      cause,
    );
  }

  let complianceReport;
  try {
    complianceReport = buildBriefComplianceReportV2(brief, teachingSummary);
  } catch (cause) {
    fail(
      'compliance_build_failed',
      errorPath(cause, 'derived.complianceReport'),
      'brief compliance construction failed',
      cause,
    );
  }

  const fingerprint = fingerprintBrief(brief);
  const provenance = validateAndCloneProvenance(provenanceInput);

  return {
    schemaVersion: '2.0',
    sourceBrief: {
      briefId: brief.briefId,
      revision: brief.revision.number,
      fingerprint,
    },
    sourceOfTruth: {
      caseVersionId: coreInput.caseVersionId,
      patientFacts,
      evaluator,
    },
    derived: {
      patientRuntime,
      teachingSummary,
      complianceReport,
    },
    provenance,
  };
}
