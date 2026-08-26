import type { ConclusionId, NonEmptyArray } from './evaluator-types';
import type {
  AppliedSpfaRequirementV2,
  SpfaRequirementTargetId,
} from './spfa-protocol-application-types';
import type {
  SessionTranscriptFingerprintV1,
  SessionTranscriptMessageV2,
  SpfaActionRequirementOutcomeV2,
  SpfaCoverageOriginV2,
  SpfaRequirementCoverageV2,
  SpfaRequirementSessionResultV2,
  SpfaRequirementSessionResultValidationContextV2,
  SpfaSessionEvidenceRefV2,
  SpfaTranscriptEvidenceKindV2,
} from './spfa-session-evidence-types';
import type { SpfaProtocolRequirementId } from './spfa-protocol-types';
import type { CaseVersionId } from './types';
import {
  validateSessionMessageIdV2,
  validateSessionTranscriptSnapshotV2,
} from './spfa-session-transcript';
import { validateSpfaRequirementTargetIdV2 } from './validate-spfa-protocol-application';
import { validateSpfaProtocolRequirementIdV2 } from './validate-spfa-protocol-definition';
import { validateCaseVersionId } from './validate-patient-facts';

const UUID_BODY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const INFORMATION_ORIGINS = [
  'PUBLIC_INFORMATION',
  'PATIENT_SPONTANEOUS',
  'STUDENT_ELICITED',
  'MIXED',
] as const satisfies readonly SpfaCoverageOriginV2[];
const EVIDENCE_KINDS = [
  'PATIENT_STATEMENT',
  'PATIENT_CONFIRMATION',
  'STUDENT_QUESTION',
  'STUDENT_ACTION',
] as const satisfies readonly SpfaTranscriptEvidenceKindV2[];

export class SpfaRequirementSessionResultValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaRequirementSessionResultValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new SpfaRequirementSessionResultValidationError(path, message);
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

function controlledValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(path, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T[number];
}

function parseCaseVersionId(value: unknown, path: string): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch {
    fail(path, 'invalid case version ID');
  }
}

function parseConclusionId(value: unknown, path: string): ConclusionId {
  if (
    typeof value !== 'string' ||
    !value.startsWith('conclusion_') ||
    !UUID_BODY_PATTERN.test(value.slice('conclusion_'.length))
  ) {
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
  } catch {
    fail(path, 'invalid SPFA requirement ID');
  }
}

function parseTargetId(
  value: unknown,
  path: string,
): SpfaRequirementTargetId {
  try {
    return validateSpfaRequirementTargetIdV2(value, path);
  } catch {
    fail(path, 'invalid SPFA requirement target ID');
  }
}

function parseFingerprint(
  value: unknown,
  path: string,
): SessionTranscriptFingerprintV1 {
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

function fingerprintEquals(
  left: SessionTranscriptFingerprintV1,
  right: SessionTranscriptFingerprintV1,
): boolean {
  return (
    left.algorithm === right.algorithm &&
    left.canonicalization === right.canonicalization &&
    left.value === right.value
  );
}

type EvidenceContext = Readonly<{
  messages: ReadonlyMap<string, SessionTranscriptMessageV2>;
  validTargetIds: ReadonlySet<string>;
}>;

function parseEvidence(
  value: unknown,
  path: string,
  context: EvidenceContext,
): SpfaSessionEvidenceRefV2 {
  const source = asRecord(value, path);
  const evidenceSource = controlledValue(
    source.source,
    ['PUBLIC_INFORMATION', 'TRANSCRIPT_MESSAGE'] as const,
    `${path}.source`,
  );
  if (evidenceSource === 'PUBLIC_INFORMATION') {
    assertExactKeys(source, ['source', 'targetRef'], path);
    const targetRef = parseTargetId(source.targetRef, `${path}.targetRef`);
    if (!context.validTargetIds.has(targetRef)) {
      fail(`${path}.targetRef`, 'does not exist in the applied requirement');
    }
    return { source: evidenceSource, targetRef };
  }

  const allowedKeys = ['source', 'messageRef', 'speaker', 'evidenceKind'];
  if (Object.prototype.hasOwnProperty.call(source, 'excerpt')) {
    allowedKeys.push('excerpt');
  }
  assertExactKeys(source, allowedKeys, path);
  let messageRef;
  try {
    messageRef = validateSessionMessageIdV2(
      source.messageRef,
      `${path}.messageRef`,
    );
  } catch {
    fail(`${path}.messageRef`, 'invalid session message ID');
  }
  const message = context.messages.get(messageRef);
  if (message === undefined) {
    fail(`${path}.messageRef`, 'does not exist in the transcript');
  }
  const speaker = controlledValue(
    source.speaker,
    ['student', 'patient'] as const,
    `${path}.speaker`,
  );
  if (speaker !== message.role) {
    fail(`${path}.speaker`, 'does not match the referenced message role');
  }
  const evidenceKind = controlledValue(
    source.evidenceKind,
    EVIDENCE_KINDS,
    `${path}.evidenceKind`,
  );
  const expectedSpeaker = evidenceKind.startsWith('PATIENT_')
    ? 'patient'
    : 'student';
  if (speaker !== expectedSpeaker) {
    fail(`${path}.evidenceKind`, 'is incompatible with the evidence speaker');
  }
  let excerpt: string | undefined;
  if (Object.prototype.hasOwnProperty.call(source, 'excerpt')) {
    if (typeof source.excerpt !== 'string' || source.excerpt.length === 0) {
      fail(`${path}.excerpt`, 'must be a non-empty string');
    }
    if (!message.content.includes(source.excerpt)) {
      fail(`${path}.excerpt`, 'must be a literal substring of the message');
    }
    excerpt = source.excerpt;
  }
  return excerpt === undefined
    ? { source: evidenceSource, messageRef, speaker, evidenceKind }
    : { source: evidenceSource, messageRef, speaker, evidenceKind, excerpt };
}

function parseEvidenceArray(
  value: unknown,
  path: string,
  context: EvidenceContext,
  requireNonEmpty: boolean,
): SpfaSessionEvidenceRefV2[] {
  const source = asArray(value, path);
  if (requireNonEmpty && source.length === 0) fail(path, 'must not be empty');
  const evidence = source.map((item, index) =>
    parseEvidence(item, `${path}[${index}]`, context),
  );
  const keys = new Set<string>();
  evidence.forEach((item, index) => {
    const key =
      item.source === 'PUBLIC_INFORMATION'
        ? `public\u0000${item.targetRef}`
        : `transcript\u0000${item.messageRef}\u0000${item.speaker}\u0000${item.evidenceKind}\u0000${item.excerpt ?? ''}`;
    if (keys.has(key)) fail(`${path}[${index}]`, 'duplicate evidence reference');
    keys.add(key);
  });
  return evidence;
}

function parseTargetArray(
  value: unknown,
  path: string,
  requireNonEmpty: boolean,
): SpfaRequirementTargetId[] {
  const source = asArray(value, path);
  if (requireNonEmpty && source.length === 0) fail(path, 'must not be empty');
  const targets = source.map((target, index) =>
    parseTargetId(target, `${path}[${index}]`),
  );
  const unique = new Set<string>();
  targets.forEach((target, index) => {
    if (unique.has(target)) fail(`${path}[${index}]`, 'duplicate target reference');
    unique.add(target);
  });
  return targets;
}

function assertExactPartition(
  first: readonly SpfaRequirementTargetId[],
  second: readonly SpfaRequirementTargetId[],
  expected: ReadonlySet<string>,
  path: string,
): void {
  const combined = new Set<string>();
  for (const target of [...first, ...second]) {
    if (combined.has(target)) fail(path, 'target partitions overlap');
    if (!expected.has(target)) fail(path, 'contains a target outside the applied requirement');
    combined.add(target);
  }
  if (combined.size !== expected.size) fail(path, 'does not cover every applied target');
}

function parseCanonicalUncertainTargetRefs(
  value: unknown,
  path: string,
  remainingTargetRefs: readonly SpfaRequirementTargetId[],
  canonicalTargetRefs: readonly SpfaRequirementTargetId[],
): SpfaRequirementTargetId[] {
  const uncertainTargetRefs = parseTargetArray(value, path, false);
  const remaining = new Set<string>(remainingTargetRefs);
  uncertainTargetRefs.forEach((targetRef, index) => {
    if (!remaining.has(targetRef)) {
      fail(`${path}[${index}]`, 'must reference a remaining target');
    }
  });
  const uncertain = new Set<string>(uncertainTargetRefs);
  return canonicalTargetRefs.filter((targetRef) => uncertain.has(targetRef));
}

function hasPatientInformationEvidence(
  evidence: readonly SpfaSessionEvidenceRefV2[],
): boolean {
  return evidence.some(
    (item) =>
      item.source === 'TRANSCRIPT_MESSAGE' &&
      (item.evidenceKind === 'PATIENT_STATEMENT' ||
        item.evidenceKind === 'PATIENT_CONFIRMATION'),
  );
}

function assertInformationEvidence(
  origin: SpfaCoverageOriginV2,
  coveredTargets: ReadonlySet<string>,
  evidence: readonly SpfaSessionEvidenceRefV2[],
  path: string,
): void {
  if (
    evidence.some(
      (item) =>
        item.source === 'TRANSCRIPT_MESSAGE' &&
        item.evidenceKind === 'STUDENT_ACTION',
    )
  ) {
    fail(path, 'STUDENT_ACTION cannot establish factual information coverage');
  }
  for (const item of evidence) {
    if (
      item.source === 'PUBLIC_INFORMATION' &&
      !coveredTargets.has(item.targetRef)
    ) {
      fail(path, 'public evidence must reference a covered target');
    }
  }
  const publicEvidence = evidence.filter(
    (item) => item.source === 'PUBLIC_INFORMATION',
  );
  const transcriptEvidence = evidence.filter(
    (item) => item.source === 'TRANSCRIPT_MESSAGE',
  );
  const patientEvidence = hasPatientInformationEvidence(evidence);
  const studentQuestion = transcriptEvidence.some(
    (item) => item.evidenceKind === 'STUDENT_QUESTION',
  );

  if (origin === 'PUBLIC_INFORMATION') {
    if (publicEvidence.length === 0 || transcriptEvidence.length !== 0) {
      fail(path, 'PUBLIC_INFORMATION requires only public evidence');
    }
  } else if (origin === 'PATIENT_SPONTANEOUS') {
    if (publicEvidence.length !== 0 || !patientEvidence) {
      fail(path, 'PATIENT_SPONTANEOUS requires patient transcript evidence only');
    }
  } else if (origin === 'STUDENT_ELICITED') {
    if (publicEvidence.length !== 0 || !studentQuestion || !patientEvidence) {
      fail(path, 'STUDENT_ELICITED requires a student question and patient response');
    }
  } else if (publicEvidence.length === 0 || !patientEvidence) {
    fail(path, 'MIXED requires public and patient transcript evidence');
  }
}

function parseInformationCoverage(
  value: unknown,
  path: string,
  requirement: AppliedSpfaRequirementV2,
  context: EvidenceContext,
): SpfaRequirementCoverageV2 {
  const source = asRecord(value, path);
  const status = controlledValue(
    source.status,
    ['COVERED', 'PARTIALLY_COVERED', 'NOT_COVERED', 'NOT_APPLICABLE'] as const,
    `${path}.status`,
  );
  const targetIds = new Set(
    requirement.kind === 'INFORMATION_REQUIREMENT'
      ? requirement.informationTargets.map((target) => target.targetId)
      : [],
  );
  const canonicalTargetRefs =
    requirement.kind === 'INFORMATION_REQUIREMENT'
      ? requirement.informationTargets.map((target) => target.targetId)
      : [];
  const isApplicable = requirement.applicability.status === 'APPLICABLE';

  if (status === 'NOT_APPLICABLE') {
    assertExactKeys(source, ['status', 'evidence'], path);
    if (isApplicable) fail(`${path}.status`, 'does not match applicable requirement');
    const evidence = parseEvidenceArray(source.evidence, `${path}.evidence`, context, false);
    if (evidence.length !== 0) fail(`${path}.evidence`, 'must be empty');
    return { status, evidence: [] };
  }
  if (!isApplicable) fail(`${path}.status`, 'must be NOT_APPLICABLE');

  if (status === 'COVERED') {
    assertExactKeys(source, ['status', 'origin', 'coveredTargetRefs', 'evidence'], path);
    const origin = controlledValue(source.origin, INFORMATION_ORIGINS, `${path}.origin`);
    const coveredTargetRefs = parseTargetArray(
      source.coveredTargetRefs,
      `${path}.coveredTargetRefs`,
      true,
    );
    assertExactPartition(coveredTargetRefs, [], targetIds, `${path}.coveredTargetRefs`);
    const evidence = parseEvidenceArray(source.evidence, `${path}.evidence`, context, true);
    assertInformationEvidence(origin, new Set(coveredTargetRefs), evidence, `${path}.evidence`);
    return {
      status,
      origin,
      coveredTargetRefs: coveredTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
      evidence: evidence as unknown as NonEmptyArray<SpfaSessionEvidenceRefV2>,
    };
  }

  if (status === 'PARTIALLY_COVERED') {
    assertExactKeys(
      source,
      [
        'status',
        'origin',
        'coveredTargetRefs',
        'remainingTargetRefs',
        'uncertainTargetRefs',
        'evidence',
      ],
      path,
    );
    const origin = controlledValue(source.origin, INFORMATION_ORIGINS, `${path}.origin`);
    const coveredTargetRefs = parseTargetArray(
      source.coveredTargetRefs,
      `${path}.coveredTargetRefs`,
      true,
    );
    const remainingTargetRefs = parseTargetArray(
      source.remainingTargetRefs,
      `${path}.remainingTargetRefs`,
      true,
    );
    assertExactPartition(
      coveredTargetRefs,
      remainingTargetRefs,
      targetIds,
      `${path}.remainingTargetRefs`,
    );
    const uncertainTargetRefs = parseCanonicalUncertainTargetRefs(
      source.uncertainTargetRefs,
      `${path}.uncertainTargetRefs`,
      remainingTargetRefs,
      canonicalTargetRefs,
    );
    const evidence = parseEvidenceArray(source.evidence, `${path}.evidence`, context, true);
    assertInformationEvidence(origin, new Set(coveredTargetRefs), evidence, `${path}.evidence`);
    return {
      status,
      origin,
      coveredTargetRefs: coveredTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
      remainingTargetRefs: remainingTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
      uncertainTargetRefs,
      evidence: evidence as unknown as NonEmptyArray<SpfaSessionEvidenceRefV2>,
    };
  }

  assertExactKeys(
    source,
    [
      'status',
      'coveredTargetRefs',
      'remainingTargetRefs',
      'uncertainTargetRefs',
      'evidence',
    ],
    path,
  );
  const coveredTargetRefs = parseTargetArray(
    source.coveredTargetRefs,
    `${path}.coveredTargetRefs`,
    false,
  );
  if (coveredTargetRefs.length !== 0) fail(`${path}.coveredTargetRefs`, 'must be empty');
  const remainingTargetRefs = parseTargetArray(
    source.remainingTargetRefs,
    `${path}.remainingTargetRefs`,
    true,
  );
  assertExactPartition([], remainingTargetRefs, targetIds, `${path}.remainingTargetRefs`);
  const uncertainTargetRefs = parseCanonicalUncertainTargetRefs(
    source.uncertainTargetRefs,
    `${path}.uncertainTargetRefs`,
    remainingTargetRefs,
    canonicalTargetRefs,
  );
  const evidence = parseEvidenceArray(source.evidence, `${path}.evidence`, context, false);
  if (
    evidence.some(
      (item) =>
        item.source === 'PUBLIC_INFORMATION' ||
        (item.source === 'TRANSCRIPT_MESSAGE' &&
          item.evidenceKind === 'STUDENT_ACTION'),
    )
  ) {
    fail(`${path}.evidence`, 'cannot contain public or student-action factual evidence');
  }
  return {
    status,
    coveredTargetRefs: [],
    remainingTargetRefs: remainingTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
    uncertainTargetRefs,
    evidence,
  };
}

function assertActionEvidence(
  evidence: readonly SpfaSessionEvidenceRefV2[],
  path: string,
): void {
  if (evidence.some((item) => item.source === 'PUBLIC_INFORMATION')) {
    fail(path, 'PUBLIC_INFORMATION cannot demonstrate a student action');
  }
  const hasStudentAction = evidence.some(
    (item) =>
      item.source === 'TRANSCRIPT_MESSAGE' &&
      item.evidenceKind === 'STUDENT_ACTION',
  );
  if (!hasStudentAction) fail(path, 'requires STUDENT_ACTION transcript evidence');
}

function parseActionOutcome(
  value: unknown,
  path: string,
  requirement: AppliedSpfaRequirementV2,
  context: EvidenceContext,
): SpfaActionRequirementOutcomeV2 {
  const source = asRecord(value, path);
  const status = controlledValue(
    source.status,
    ['PERFORMED', 'PARTIALLY_PERFORMED', 'NOT_PERFORMED', 'NOT_APPLICABLE'] as const,
    `${path}.status`,
  );
  const targetIds = new Set(
    requirement.kind === 'ACTION_REQUIREMENT'
      ? requirement.actionTargets.map((target) => target.targetId)
      : [],
  );
  const canonicalTargetRefs =
    requirement.kind === 'ACTION_REQUIREMENT'
      ? requirement.actionTargets.map((target) => target.targetId)
      : [];
  const isApplicable = requirement.applicability.status === 'APPLICABLE';

  if (status === 'NOT_APPLICABLE') {
    assertExactKeys(source, ['status', 'evidence'], path);
    if (isApplicable) fail(`${path}.status`, 'does not match applicable requirement');
    const evidence = parseEvidenceArray(source.evidence, `${path}.evidence`, context, false);
    if (evidence.length !== 0) fail(`${path}.evidence`, 'must be empty');
    return { status, evidence: [] };
  }
  if (!isApplicable) fail(`${path}.status`, 'must be NOT_APPLICABLE');

  if (status === 'PERFORMED') {
    assertExactKeys(source, ['status', 'performedTargetRefs', 'evidence'], path);
    const performedTargetRefs = parseTargetArray(
      source.performedTargetRefs,
      `${path}.performedTargetRefs`,
      true,
    );
    assertExactPartition(performedTargetRefs, [], targetIds, `${path}.performedTargetRefs`);
    const evidence = parseEvidenceArray(source.evidence, `${path}.evidence`, context, true);
    assertActionEvidence(evidence, `${path}.evidence`);
    return {
      status,
      performedTargetRefs: performedTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
      evidence: evidence as unknown as NonEmptyArray<SpfaSessionEvidenceRefV2>,
    };
  }

  if (status === 'PARTIALLY_PERFORMED') {
    assertExactKeys(
      source,
      [
        'status',
        'performedTargetRefs',
        'remainingTargetRefs',
        'uncertainTargetRefs',
        'evidence',
      ],
      path,
    );
    const performedTargetRefs = parseTargetArray(
      source.performedTargetRefs,
      `${path}.performedTargetRefs`,
      true,
    );
    const remainingTargetRefs = parseTargetArray(
      source.remainingTargetRefs,
      `${path}.remainingTargetRefs`,
      true,
    );
    assertExactPartition(
      performedTargetRefs,
      remainingTargetRefs,
      targetIds,
      `${path}.remainingTargetRefs`,
    );
    const uncertainTargetRefs = parseCanonicalUncertainTargetRefs(
      source.uncertainTargetRefs,
      `${path}.uncertainTargetRefs`,
      remainingTargetRefs,
      canonicalTargetRefs,
    );
    const evidence = parseEvidenceArray(source.evidence, `${path}.evidence`, context, true);
    assertActionEvidence(evidence, `${path}.evidence`);
    return {
      status,
      performedTargetRefs: performedTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
      remainingTargetRefs: remainingTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
      uncertainTargetRefs,
      evidence: evidence as unknown as NonEmptyArray<SpfaSessionEvidenceRefV2>,
    };
  }

  assertExactKeys(
    source,
    ['status', 'remainingTargetRefs', 'uncertainTargetRefs', 'evidence'],
    path,
  );
  const remainingTargetRefs = parseTargetArray(
    source.remainingTargetRefs,
    `${path}.remainingTargetRefs`,
    true,
  );
  assertExactPartition([], remainingTargetRefs, targetIds, `${path}.remainingTargetRefs`);
  const uncertainTargetRefs = parseCanonicalUncertainTargetRefs(
    source.uncertainTargetRefs,
    `${path}.uncertainTargetRefs`,
    remainingTargetRefs,
    canonicalTargetRefs,
  );
  const evidence = parseEvidenceArray(source.evidence, `${path}.evidence`, context, false);
  if (evidence.some((item) => item.source === 'PUBLIC_INFORMATION')) {
    fail(`${path}.evidence`, 'PUBLIC_INFORMATION cannot demonstrate an action outcome');
  }
  return {
    status,
    remainingTargetRefs: remainingTargetRefs as unknown as NonEmptyArray<SpfaRequirementTargetId>,
    uncertainTargetRefs,
    evidence,
  };
}

function validateContext(
  context: SpfaRequirementSessionResultValidationContextV2,
): {
  transcript: ReturnType<typeof validateSessionTranscriptSnapshotV2>;
  carePathSpfaRef: ConclusionId;
  appliedRequirement: AppliedSpfaRequirementV2;
} {
  const source = asRecord(context, 'context');
  assertExactKeys(
    source,
    ['transcript', 'carePathSpfaRef', 'appliedRequirement'],
    'context',
  );
  const transcript = validateSessionTranscriptSnapshotV2(
    source.transcript,
    'context.transcript',
  );
  const carePathSpfaRef = parseConclusionId(
    source.carePathSpfaRef,
    'context.carePathSpfaRef',
  );
  const appliedRequirement = source.appliedRequirement as AppliedSpfaRequirementV2;
  if (
    typeof appliedRequirement !== 'object' ||
    appliedRequirement === null ||
    !['INFORMATION_REQUIREMENT', 'ACTION_REQUIREMENT'].includes(
      appliedRequirement.kind,
    )
  ) {
    fail('context.appliedRequirement', 'must be a validated applied requirement');
  }
  return { transcript, carePathSpfaRef, appliedRequirement };
}

export function validateSpfaRequirementSessionResultV2(
  value: unknown,
  contextValue: SpfaRequirementSessionResultValidationContextV2,
  path = 'result',
): SpfaRequirementSessionResultV2 {
  const context = validateContext(contextValue);
  const source = asRecord(value, path);
  const kind = controlledValue(
    source.kind,
    ['INFORMATION_REQUIREMENT', 'ACTION_REQUIREMENT'] as const,
    `${path}.kind`,
  );
  const payloadKey = kind === 'INFORMATION_REQUIREMENT' ? 'coverage' : 'outcome';
  assertExactKeys(
    source,
    [
      'schemaVersion',
      'sessionId',
      'caseVersionId',
      'transcriptFingerprint',
      'carePathSpfaRef',
      'requirementRef',
      'kind',
      payloadKey,
    ],
    path,
  );
  if (source.schemaVersion !== '2.0') fail(`${path}.schemaVersion`, 'must be 2.0');
  if (source.sessionId !== context.transcript.sessionId) {
    fail(`${path}.sessionId`, 'does not match the transcript session');
  }
  const caseVersionId = parseCaseVersionId(
    source.caseVersionId,
    `${path}.caseVersionId`,
  );
  if (caseVersionId !== context.transcript.caseVersionId) {
    fail(`${path}.caseVersionId`, 'does not match the transcript case version');
  }
  const transcriptFingerprint = parseFingerprint(
    source.transcriptFingerprint,
    `${path}.transcriptFingerprint`,
  );
  if (!fingerprintEquals(transcriptFingerprint, context.transcript.fingerprint)) {
    fail(`${path}.transcriptFingerprint`, 'does not match the transcript snapshot');
  }
  const carePathSpfaRef = parseConclusionId(
    source.carePathSpfaRef,
    `${path}.carePathSpfaRef`,
  );
  if (carePathSpfaRef !== context.carePathSpfaRef) {
    fail(`${path}.carePathSpfaRef`, 'does not match the evaluated SPFA');
  }
  const requirementRef = parseRequirementId(
    source.requirementRef,
    `${path}.requirementRef`,
  );
  if (requirementRef !== context.appliedRequirement.requirementRef) {
    fail(`${path}.requirementRef`, 'does not match the applied requirement');
  }
  if (kind !== context.appliedRequirement.kind) {
    fail(`${path}.kind`, 'does not match the applied requirement kind');
  }

  if (kind === 'INFORMATION_REQUIREMENT') {
    if (context.appliedRequirement.kind !== 'INFORMATION_REQUIREMENT') {
      fail(`${path}.kind`, 'does not match the applied requirement kind');
    }
    const evidenceContext: EvidenceContext = {
      messages: new Map(
        context.transcript.messages.map((message) => [message.messageId, message]),
      ),
      validTargetIds: new Set(
        context.appliedRequirement.informationTargets.map(
          (target) => target.targetId,
        ),
      ),
    };
    return {
      schemaVersion: '2.0',
      sessionId: context.transcript.sessionId,
      caseVersionId,
      transcriptFingerprint,
      carePathSpfaRef,
      requirementRef,
      kind,
      coverage: parseInformationCoverage(
        source.coverage,
        `${path}.coverage`,
        context.appliedRequirement,
        evidenceContext,
      ),
    };
  }
  if (context.appliedRequirement.kind !== 'ACTION_REQUIREMENT') {
    fail(`${path}.kind`, 'does not match the applied requirement kind');
  }
  const evidenceContext: EvidenceContext = {
    messages: new Map(
      context.transcript.messages.map((message) => [message.messageId, message]),
    ),
    validTargetIds: new Set(
      context.appliedRequirement.actionTargets.map((target) => target.targetId),
    ),
  };
  return {
    schemaVersion: '2.0',
    sessionId: context.transcript.sessionId,
    caseVersionId,
    transcriptFingerprint,
    carePathSpfaRef,
    requirementRef,
    kind,
    outcome: parseActionOutcome(
      source.outcome,
      `${path}.outcome`,
      context.appliedRequirement,
      evidenceContext,
    ),
  };
}
