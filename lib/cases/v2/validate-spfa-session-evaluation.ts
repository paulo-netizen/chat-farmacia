import type {
  ConclusionId,
  NonEmptyArray,
  VersionRef,
} from './evaluator-types';
import type { AppliedSpfaRequirementV2 } from './spfa-protocol-application-types';
import type {
  SpfaSessionEvaluationApplicationV2,
  SpfaSessionEvaluationV2,
  SpfaSessionEvaluationValidationContextV2,
  SpfaSessionSemanticExecutionV2,
} from './spfa-session-evaluation-types';
import type {
  SessionTranscriptFingerprintV2,
  SpfaRequirementSessionResultV2,
} from './spfa-session-evidence-types';
import type {
  SpfaProtocolRefV2,
  SpfaProtocolRequirementId,
} from './spfa-protocol-types';
import type { CaseVersionId } from './types';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';
import { validateSpfaRequirementSessionResultV2 } from './validate-spfa-requirement-session-result';
import {
  validateSpfaProtocolRefV2,
  validateSpfaProtocolRequirementIdV2,
} from './validate-spfa-protocol-definition';
import { validateCaseVersionId } from './validate-patient-facts';

const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CONCLUSION_ID_PATTERN =
  /^conclusion_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MAX_RESPONSE_MODEL_LENGTH = 200;

export class SpfaSessionEvaluationValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaSessionEvaluationValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new SpfaSessionEvaluationValidationError(path, message);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function assertExactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(source, key)) {
      fail(`${path}.${key}`, 'missing required property');
    }
  }
}

function nestedPath(cause: unknown): string | undefined {
  return typeof cause === 'object' && cause !== null && 'path' in cause
    ? String((cause as { path: unknown }).path)
    : undefined;
}

function nestedMessage(cause: unknown, fallback: string): string {
  if (!(cause instanceof Error)) return fallback;
  const separator = cause.message.indexOf(': ');
  return separator === -1 ? cause.message : cause.message.slice(separator + 2);
}

function parseSessionId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !SESSION_UUID_PATTERN.test(value)) {
    fail(path, 'must be a canonical lowercase UUID');
  }
  return value;
}

function parseCaseVersionId(value: unknown, path: string): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch (cause) {
    fail(nestedPath(cause) ?? path, 'invalid case version ID');
  }
}

function parseConclusionId(value: unknown, path: string): ConclusionId {
  if (typeof value !== 'string' || !CONCLUSION_ID_PATTERN.test(value)) {
    fail(path, 'must use the opaque format conclusion_<uuid>');
  }
  return value as ConclusionId;
}

function parseRequirementId(
  value: unknown,
  path: string,
): SpfaProtocolRequirementId {
  try {
    return validateSpfaProtocolRequirementIdV2(value, path);
  } catch (cause) {
    fail(nestedPath(cause) ?? path, 'invalid SPFA requirement ID');
  }
}

function parseProtocolRef(value: unknown, path: string): SpfaProtocolRefV2 {
  try {
    return validateSpfaProtocolRefV2(value, path);
  } catch (cause) {
    fail(nestedPath(cause) ?? path, 'invalid SPFA protocol reference');
  }
}

function parseVersionRef(value: unknown, path: string): Readonly<VersionRef> {
  const source = asRecord(value, path);
  assertExactKeys(source, ['id', 'version'], path);
  return {
    id: parseNonEmptyString(source.id, `${path}.id`),
    version: parseNonEmptyString(source.version, `${path}.version`),
  };
}

function parseNonEmptyString(
  value: unknown,
  path: string,
  maxLength?: number,
): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value ||
    (maxLength !== undefined && value.length > maxLength)
  ) {
    fail(path, 'must be a non-empty, unpadded string');
  }
  return value;
}

function parseFingerprint(
  value: unknown,
  path: string,
): SessionTranscriptFingerprintV2 {
  const source = asRecord(value, path);
  assertExactKeys(source, ['algorithm', 'canonicalization', 'value'], path);
  if (source.algorithm !== 'sha256') fail(`${path}.algorithm`, 'must be sha256');
  if (source.canonicalization !== 'session-transcript-v2/1') {
    fail(`${path}.canonicalization`, 'must be session-transcript-v2/1');
  }
  if (typeof source.value !== 'string' || !SHA256_PATTERN.test(source.value)) {
    fail(`${path}.value`, 'must be a lowercase SHA-256 digest');
  }
  return {
    algorithm: 'sha256',
    canonicalization: 'session-transcript-v2/1',
    value: source.value,
  };
}

function versionRefEquals(
  left: Readonly<VersionRef>,
  right: Readonly<VersionRef>,
): boolean {
  return left.id === right.id && left.version === right.version;
}

function protocolRefEquals(
  left: SpfaProtocolRefV2,
  right: SpfaProtocolRefV2,
): boolean {
  return left.protocolId === right.protocolId && left.version === right.version;
}

function fingerprintEquals(
  left: SessionTranscriptFingerprintV2,
  right: SessionTranscriptFingerprintV2,
): boolean {
  return (
    left.algorithm === right.algorithm &&
    left.canonicalization === right.canonicalization &&
    left.value === right.value
  );
}

type ExpectedApplication = Readonly<{
  carePathSpfaRef: ConclusionId;
  protocolRef: SpfaProtocolRefV2;
  requirements: readonly AppliedSpfaRequirementV2[];
}>;

function parseContext(
  value: SpfaSessionEvaluationValidationContextV2,
): {
  transcript: ReturnType<typeof validateSessionTranscriptSnapshotV2>;
  protocolCatalogRef: Readonly<VersionRef>;
  applications: NonEmptyArray<ExpectedApplication>;
} {
  const context = asRecord(value, 'context');
  assertExactKeys(context, ['transcript', 'spfaProtocolSet'], 'context');
  const transcript = validateSessionTranscriptSnapshotV2(
    context.transcript,
    'context.transcript',
  );
  const protocolSet = asRecord(context.spfaProtocolSet, 'context.spfaProtocolSet');
  assertExactKeys(
    protocolSet,
    ['schemaVersion', 'catalogRef', 'definitions', 'applications'],
    'context.spfaProtocolSet',
  );
  if (protocolSet.schemaVersion !== '2.0') {
    fail('context.spfaProtocolSet.schemaVersion', 'must be 2.0');
  }
  if (!Array.isArray(protocolSet.definitions) || protocolSet.definitions.length === 0) {
    fail('context.spfaProtocolSet.definitions', 'must be a non-empty array');
  }
  const rawApplications = asArray(
    protocolSet.applications,
    'context.spfaProtocolSet.applications',
  );
  if (rawApplications.length === 0) {
    fail('context.spfaProtocolSet.applications', 'must be a non-empty array');
  }
  const applications = rawApplications.map((item, index): ExpectedApplication => {
    const path = `context.spfaProtocolSet.applications[${index}]`;
    const source = asRecord(item, path);
    assertExactKeys(
      source,
      ['schemaVersion', 'caseVersionId', 'carePathSpfaRef', 'protocolRef', 'requirements'],
      path,
    );
    if (source.schemaVersion !== '2.0') fail(`${path}.schemaVersion`, 'must be 2.0');
    const caseVersionId = parseCaseVersionId(source.caseVersionId, `${path}.caseVersionId`);
    if (caseVersionId !== transcript.caseVersionId) {
      fail(`${path}.caseVersionId`, 'does not match the transcript case version');
    }
    const requirements = asArray(source.requirements, `${path}.requirements`);
    if (requirements.length === 0) {
      fail(`${path}.requirements`, 'must be a non-empty array');
    }
    requirements.forEach((requirement, requirementIndex) => {
      const requirementPath = `${path}.requirements[${requirementIndex}]`;
      const requirementSource = asRecord(requirement, requirementPath);
      parseRequirementId(
        requirementSource.requirementRef,
        `${requirementPath}.requirementRef`,
      );
      if (
        requirementSource.kind !== 'INFORMATION_REQUIREMENT' &&
        requirementSource.kind !== 'ACTION_REQUIREMENT'
      ) {
        fail(`${requirementPath}.kind`, 'must be a supported requirement kind');
      }
    });
    return {
      carePathSpfaRef: parseConclusionId(source.carePathSpfaRef, `${path}.carePathSpfaRef`),
      protocolRef: parseProtocolRef(source.protocolRef, `${path}.protocolRef`),
      requirements: requirements as unknown as readonly AppliedSpfaRequirementV2[],
    };
  });
  return {
    transcript,
    protocolCatalogRef: parseVersionRef(
      protocolSet.catalogRef,
      'context.spfaProtocolSet.catalogRef',
    ),
    applications: applications as unknown as NonEmptyArray<ExpectedApplication>,
  };
}

function parseRequirementResult(
  value: unknown,
  path: string,
  transcript: ReturnType<typeof validateSessionTranscriptSnapshotV2>,
  carePathSpfaRef: ConclusionId,
  appliedRequirement: AppliedSpfaRequirementV2,
): SpfaRequirementSessionResultV2 {
  try {
    return validateSpfaRequirementSessionResultV2(
      value,
      { transcript, carePathSpfaRef, appliedRequirement },
      path,
    );
  } catch (cause) {
    fail(
      nestedPath(cause) ?? path,
      nestedMessage(cause, 'invalid SPFA requirement session result'),
    );
  }
}

function parseApplications(
  value: unknown,
  context: ReturnType<typeof parseContext>,
  path: string,
): {
  applications: NonEmptyArray<SpfaSessionEvaluationApplicationV2>;
  resultOrdinals: ReadonlyMap<string, number>;
} {
  const rawApplications = asArray(value, path);
  if (rawApplications.length === 0) fail(path, 'must be a non-empty array');
  const seenApplications = new Set<string>();
  const resultOrdinals = new Map<string, number>();
  let nextOrdinal = 0;
  const applications = rawApplications.map((item, applicationIndex) => {
    const applicationPath = `${path}[${applicationIndex}]`;
    const source = asRecord(item, applicationPath);
    assertExactKeys(
      source,
      ['carePathSpfaRef', 'protocolRef', 'requirementResults'],
      applicationPath,
    );
    const carePathSpfaRef = parseConclusionId(
      source.carePathSpfaRef,
      `${applicationPath}.carePathSpfaRef`,
    );
    if (seenApplications.has(carePathSpfaRef)) {
      fail(`${applicationPath}.carePathSpfaRef`, 'duplicate application');
    }
    seenApplications.add(carePathSpfaRef);
    const expected = context.applications[applicationIndex];
    if (expected === undefined) {
      fail(applicationPath, 'does not exist in the protocol set');
    }
    if (carePathSpfaRef !== expected.carePathSpfaRef) {
      fail(`${applicationPath}.carePathSpfaRef`, 'does not follow protocol-set application order');
    }
    const protocolRef = parseProtocolRef(source.protocolRef, `${applicationPath}.protocolRef`);
    if (!protocolRefEquals(protocolRef, expected.protocolRef)) {
      fail(`${applicationPath}.protocolRef`, 'does not match the protocol-set application');
    }
    const rawResults = asArray(source.requirementResults, `${applicationPath}.requirementResults`);
    if (rawResults.length === 0) {
      fail(`${applicationPath}.requirementResults`, 'must be a non-empty array');
    }
    const seenRequirements = new Set<string>();
    const requirementResults = rawResults.map((result, requirementIndex) => {
      const resultPath = `${applicationPath}.requirementResults[${requirementIndex}]`;
      const resultSource = asRecord(result, resultPath);
      const requirementRef = parseRequirementId(
        resultSource.requirementRef,
        `${resultPath}.requirementRef`,
      );
      if (seenRequirements.has(requirementRef)) {
        fail(`${resultPath}.requirementRef`, 'duplicate requirement result');
      }
      seenRequirements.add(requirementRef);
      const expectedRequirement = expected.requirements[requirementIndex];
      if (expectedRequirement === undefined) {
        fail(resultPath, 'does not exist in the protocol-set application');
      }
      if (requirementRef !== expectedRequirement.requirementRef) {
        fail(`${resultPath}.requirementRef`, 'does not follow protocol-set requirement order');
      }
      const parsed = parseRequirementResult(
        result,
        resultPath,
        context.transcript,
        carePathSpfaRef,
        expectedRequirement,
      );
      resultOrdinals.set(`${carePathSpfaRef}\u0000${requirementRef}`, nextOrdinal);
      nextOrdinal += 1;
      return parsed;
    });
    if (requirementResults.length !== expected.requirements.length) {
      fail(
        `${applicationPath}.requirementResults`,
        'must contain exactly one result for every protocol-set requirement',
      );
    }
    return {
      carePathSpfaRef,
      protocolRef,
      requirementResults: requirementResults as unknown as NonEmptyArray<SpfaRequirementSessionResultV2>,
    };
  });
  if (applications.length !== context.applications.length) {
    fail(path, 'must contain exactly one entry for every protocol-set application');
  }
  return {
    applications: applications as unknown as NonEmptyArray<SpfaSessionEvaluationApplicationV2>,
    resultOrdinals,
  };
}

function parseSemanticExecutions(
  value: unknown,
  resultOrdinals: ReadonlyMap<string, number>,
  path: string,
): readonly SpfaSessionSemanticExecutionV2[] {
  const rawExecutions = asArray(value, path);
  const seen = new Set<string>();
  let previousOrdinal = -1;
  return rawExecutions.map((item, index) => {
    const itemPath = `${path}[${index}]`;
    const source = asRecord(item, itemPath);
    assertExactKeys(
      source,
      [
        'carePathSpfaRef',
        'requirementRef',
        'provider',
        'responseModel',
        'promptVersion',
      ],
      itemPath,
    );
    const carePathSpfaRef = parseConclusionId(
      source.carePathSpfaRef,
      `${itemPath}.carePathSpfaRef`,
    );
    const requirementRef = parseRequirementId(
      source.requirementRef,
      `${itemPath}.requirementRef`,
    );
    const key = `${carePathSpfaRef}\u0000${requirementRef}`;
    if (seen.has(key)) fail(itemPath, 'duplicate semantic execution');
    seen.add(key);
    const ordinal = resultOrdinals.get(key);
    if (ordinal === undefined) {
      const applicationExists = [...resultOrdinals.keys()].some(
        (candidate) => candidate.startsWith(`${carePathSpfaRef}\u0000`),
      );
      fail(
        applicationExists ? `${itemPath}.requirementRef` : `${itemPath}.carePathSpfaRef`,
        applicationExists
          ? 'does not reference an existing requirement result'
          : 'does not reference an existing application',
      );
    }
    if (ordinal <= previousOrdinal) {
      fail(itemPath, 'does not follow canonical application/requirement order');
    }
    previousOrdinal = ordinal;
    if (source.provider !== 'openai') {
      fail(`${itemPath}.provider`, 'must be openai');
    }
    return {
      carePathSpfaRef,
      requirementRef,
      provider: 'openai',
      responseModel: parseNonEmptyString(
        source.responseModel,
        `${itemPath}.responseModel`,
        MAX_RESPONSE_MODEL_LENGTH,
      ),
      promptVersion: parseNonEmptyString(
        source.promptVersion,
        `${itemPath}.promptVersion`,
      ),
    };
  });
}

export function validateSpfaSessionEvaluationV2(
  value: unknown,
  contextValue: SpfaSessionEvaluationValidationContextV2,
): SpfaSessionEvaluationV2 {
  const context = parseContext(contextValue);
  const rootPath = 'spfaSessionEvaluation';
  const source = asRecord(value, rootPath);
  assertExactKeys(
    source,
    [
      'schemaVersion',
      'sessionId',
      'caseVersionId',
      'protocolCatalogRef',
      'transcriptFingerprint',
      'applications',
      'semanticExecutions',
    ],
    rootPath,
  );
  if (source.schemaVersion !== '2.0') {
    fail(`${rootPath}.schemaVersion`, 'must be 2.0');
  }
  const sessionId = parseSessionId(source.sessionId, `${rootPath}.sessionId`);
  if (sessionId !== context.transcript.sessionId) {
    fail(`${rootPath}.sessionId`, 'does not match the transcript session');
  }
  const caseVersionId = parseCaseVersionId(
    source.caseVersionId,
    `${rootPath}.caseVersionId`,
  );
  if (caseVersionId !== context.transcript.caseVersionId) {
    fail(`${rootPath}.caseVersionId`, 'does not match the transcript case version');
  }
  const protocolCatalogRef = parseVersionRef(
    source.protocolCatalogRef,
    `${rootPath}.protocolCatalogRef`,
  );
  if (!versionRefEquals(protocolCatalogRef, context.protocolCatalogRef)) {
    fail(`${rootPath}.protocolCatalogRef`, 'does not match the protocol set catalog');
  }
  const transcriptFingerprint = parseFingerprint(
    source.transcriptFingerprint,
    `${rootPath}.transcriptFingerprint`,
  );
  if (!fingerprintEquals(transcriptFingerprint, context.transcript.fingerprint)) {
    fail(`${rootPath}.transcriptFingerprint`, 'does not match the transcript snapshot');
  }
  const parsedApplications = parseApplications(
    source.applications,
    context,
    `${rootPath}.applications`,
  );
  const semanticExecutions = parseSemanticExecutions(
    source.semanticExecutions,
    parsedApplications.resultOrdinals,
    `${rootPath}.semanticExecutions`,
  );
  return {
    schemaVersion: '2.0',
    sessionId,
    caseVersionId,
    protocolCatalogRef,
    transcriptFingerprint,
    applications: parsedApplications.applications,
    semanticExecutions,
  };
}
