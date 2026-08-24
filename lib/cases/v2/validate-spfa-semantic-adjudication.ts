import type { ConclusionId, NonEmptyArray } from './evaluator-types';
import type {
  SpfaRequirementEvidenceBaselineV2,
  SpfaSemanticEvidenceCandidateV2,
} from './spfa-evidence-baseline-types';
import type { SpfaRequirementTargetId } from './spfa-protocol-application-types';
import type {
  SpfaActionSemanticSupportV2,
  SpfaActionSemanticTargetDecisionV2,
  SpfaInformationSemanticSupportV2,
  SpfaInformationSemanticTargetDecisionV2,
  SpfaSemanticAdjudicationV2,
} from './spfa-semantic-adjudication-types';
import type {
  SessionMessageId,
  SessionTranscriptFingerprintV1,
  SessionTranscriptMessageV2,
  SessionTranscriptSnapshotV2,
} from './spfa-session-evidence-types';
import type { SpfaProtocolRequirementId } from './spfa-protocol-types';
import type { CaseVersionId } from './types';
import {
  validateSessionMessageIdV2,
  validateSessionTranscriptSnapshotV2,
} from './spfa-session-transcript';
import { validateSpfaSemanticCandidateSelectionV2 } from './validate-spfa-semantic-candidate-selection';
import { validateSpfaRequirementTargetIdV2 } from './validate-spfa-protocol-application';
import { validateSpfaProtocolRequirementIdV2 } from './validate-spfa-protocol-definition';
import { validateCaseVersionId } from './validate-patient-facts';

const UUID_BODY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export type SpfaSemanticAdjudicationValidationContextV2 = Readonly<{
  transcript: SessionTranscriptSnapshotV2;
  baseline: SpfaRequirementEvidenceBaselineV2;
}>;

export class SpfaSemanticAdjudicationValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaSemanticAdjudicationValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new SpfaSemanticAdjudicationValidationError(path, message);
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

function parseMessageId(value: unknown, path: string): SessionMessageId {
  try {
    return validateSessionMessageIdV2(value, path);
  } catch {
    fail(path, 'invalid session message ID');
  }
}

function candidateKey(candidate: {
  targetRef: string;
  messageRef: string;
}): string {
  return `${candidate.targetRef}\u0000${candidate.messageRef}`;
}

function parseExcerpt(
  source: Record<string, unknown>,
  message: SessionTranscriptMessageV2,
  path: string,
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(source, 'excerpt')) return undefined;
  if (typeof source.excerpt !== 'string' || source.excerpt.length === 0) {
    fail(`${path}.excerpt`, 'must be a non-empty string');
  }
  if (!message.content.includes(source.excerpt)) {
    fail(`${path}.excerpt`, 'must be a literal substring of the referenced message');
  }
  return source.excerpt;
}

type TranscriptContext = Readonly<{
  messages: ReadonlyMap<string, SessionTranscriptMessageV2>;
  positions: ReadonlyMap<string, number>;
}>;

function parseInformationSupport(
  value: unknown,
  path: string,
  decisionTarget: SpfaRequirementTargetId,
  transcript: TranscriptContext,
): SpfaInformationSemanticSupportV2 {
  const source = asRecord(value, path);
  const allowedKeys = [
    'targetRef',
    'messageRef',
    'evidenceKind',
    'acquisition',
  ];
  if (Object.prototype.hasOwnProperty.call(source, 'excerpt')) {
    allowedKeys.push('excerpt');
  }
  assertExactKeys(source, allowedKeys, path);
  const targetRef = parseTargetId(source.targetRef, `${path}.targetRef`);
  if (targetRef !== decisionTarget) {
    fail(`${path}.targetRef`, 'must match the enclosing decision target');
  }
  const messageRef = parseMessageId(source.messageRef, `${path}.messageRef`);
  const message = transcript.messages.get(messageRef);
  if (message === undefined) fail(`${path}.messageRef`, 'does not exist in the transcript');
  const evidenceKind = source.evidenceKind;
  if (
    evidenceKind !== 'PATIENT_STATEMENT' &&
    evidenceKind !== 'PATIENT_CONFIRMATION'
  ) {
    fail(
      `${path}.evidenceKind`,
      'must be PATIENT_STATEMENT or PATIENT_CONFIRMATION',
    );
  }
  const acquisitionSource = asRecord(source.acquisition, `${path}.acquisition`);
  if (acquisitionSource.mode === 'SPONTANEOUS') {
    assertExactKeys(acquisitionSource, ['mode'], `${path}.acquisition`);
    if (evidenceKind === 'PATIENT_CONFIRMATION') {
      fail(
        `${path}.evidenceKind`,
        'PATIENT_CONFIRMATION requires ELICITED acquisition',
      );
    }
    const excerpt = parseExcerpt(source, message, path);
    return excerpt === undefined
      ? {
          targetRef,
          messageRef,
          evidenceKind,
          acquisition: { mode: 'SPONTANEOUS' },
        }
      : {
          targetRef,
          messageRef,
          evidenceKind,
          excerpt,
          acquisition: { mode: 'SPONTANEOUS' },
        };
  }
  if (acquisitionSource.mode !== 'ELICITED') {
    fail(`${path}.acquisition.mode`, 'must be SPONTANEOUS or ELICITED');
  }
  assertExactKeys(
    acquisitionSource,
    ['mode', 'studentQuestionRef'],
    `${path}.acquisition`,
  );
  const studentQuestionRef = parseMessageId(
    acquisitionSource.studentQuestionRef,
    `${path}.acquisition.studentQuestionRef`,
  );
  const question = transcript.messages.get(studentQuestionRef);
  if (question === undefined) {
    fail(
      `${path}.acquisition.studentQuestionRef`,
      'does not exist in the transcript',
    );
  }
  if (question.role !== 'student') {
    fail(
      `${path}.acquisition.studentQuestionRef`,
      'must reference a student message',
    );
  }
  const questionPosition = transcript.positions.get(studentQuestionRef);
  const supportPosition = transcript.positions.get(messageRef);
  if (
    questionPosition === undefined ||
    supportPosition === undefined ||
    questionPosition >= supportPosition
  ) {
    fail(
      `${path}.acquisition.studentQuestionRef`,
      'must precede the patient support message',
    );
  }
  const excerpt = parseExcerpt(source, message, path);
  return excerpt === undefined
    ? {
        targetRef,
        messageRef,
        evidenceKind,
        acquisition: { mode: 'ELICITED', studentQuestionRef },
      }
    : {
        targetRef,
        messageRef,
        evidenceKind,
        excerpt,
        acquisition: { mode: 'ELICITED', studentQuestionRef },
      };
}

function parseActionSupport(
  value: unknown,
  path: string,
  decisionTarget: SpfaRequirementTargetId,
  transcript: TranscriptContext,
): SpfaActionSemanticSupportV2 {
  const source = asRecord(value, path);
  const allowedKeys = ['targetRef', 'messageRef', 'evidenceKind'];
  if (Object.prototype.hasOwnProperty.call(source, 'excerpt')) {
    allowedKeys.push('excerpt');
  }
  assertExactKeys(source, allowedKeys, path);
  const targetRef = parseTargetId(source.targetRef, `${path}.targetRef`);
  if (targetRef !== decisionTarget) {
    fail(`${path}.targetRef`, 'must match the enclosing decision target');
  }
  const messageRef = parseMessageId(source.messageRef, `${path}.messageRef`);
  const message = transcript.messages.get(messageRef);
  if (message === undefined) fail(`${path}.messageRef`, 'does not exist in the transcript');
  if (source.evidenceKind !== 'STUDENT_ACTION') {
    fail(`${path}.evidenceKind`, 'must be STUDENT_ACTION');
  }
  const excerpt = parseExcerpt(source, message, path);
  return excerpt === undefined
    ? { targetRef, messageRef, evidenceKind: 'STUDENT_ACTION' }
    : { targetRef, messageRef, evidenceKind: 'STUDENT_ACTION', excerpt };
}

function parseInformationDecision(
  value: unknown,
  path: string,
  transcript: TranscriptContext,
): SpfaInformationSemanticTargetDecisionV2 {
  const source = asRecord(value, path);
  assertExactKeys(source, ['targetRef', 'status', 'supports'], path);
  const targetRef = parseTargetId(source.targetRef, `${path}.targetRef`);
  if (
    source.status !== 'SUPPORTED' &&
    source.status !== 'NOT_SUPPORTED' &&
    source.status !== 'UNCERTAIN'
  ) {
    fail(`${path}.status`, 'must be SUPPORTED, NOT_SUPPORTED or UNCERTAIN');
  }
  const supports = asArray(source.supports, `${path}.supports`).map((support, index) =>
    parseInformationSupport(
      support,
      `${path}.supports[${index}]`,
      targetRef,
      transcript,
    ),
  );
  if (source.status === 'SUPPORTED') {
    if (supports.length === 0) fail(`${path}.supports`, 'must not be empty');
    return {
      targetRef,
      status: source.status,
      supports: supports as unknown as NonEmptyArray<SpfaInformationSemanticSupportV2>,
    };
  }
  if (supports.length !== 0) fail(`${path}.supports`, 'must be empty');
  return { targetRef, status: source.status, supports: [] };
}

function parseActionDecision(
  value: unknown,
  path: string,
  transcript: TranscriptContext,
): SpfaActionSemanticTargetDecisionV2 {
  const source = asRecord(value, path);
  assertExactKeys(source, ['targetRef', 'status', 'supports'], path);
  const targetRef = parseTargetId(source.targetRef, `${path}.targetRef`);
  if (
    source.status !== 'SUPPORTED' &&
    source.status !== 'NOT_SUPPORTED' &&
    source.status !== 'UNCERTAIN'
  ) {
    fail(`${path}.status`, 'must be SUPPORTED, NOT_SUPPORTED or UNCERTAIN');
  }
  const supports = asArray(source.supports, `${path}.supports`).map((support, index) =>
    parseActionSupport(
      support,
      `${path}.supports[${index}]`,
      targetRef,
      transcript,
    ),
  );
  if (source.status === 'SUPPORTED') {
    if (supports.length === 0) fail(`${path}.supports`, 'must not be empty');
    return {
      targetRef,
      status: source.status,
      supports: supports as unknown as NonEmptyArray<SpfaActionSemanticSupportV2>,
    };
  }
  if (supports.length !== 0) fail(`${path}.supports`, 'must be empty');
  return { targetRef, status: source.status, supports: [] };
}

function validateBaselineTranscriptPinning(
  baseline: SpfaRequirementEvidenceBaselineV2,
  transcript: SessionTranscriptSnapshotV2,
  path: string,
): void {
  if (baseline.sessionId !== transcript.sessionId) {
    fail(`${path}.sessionId`, 'baseline does not match the transcript session');
  }
  if (baseline.caseVersionId !== transcript.caseVersionId) {
    fail(`${path}.caseVersionId`, 'baseline does not match the transcript case version');
  }
  if (!fingerprintEquals(baseline.transcriptFingerprint, transcript.fingerprint)) {
    fail(`${path}.transcriptFingerprint`, 'baseline does not match the transcript fingerprint');
  }
}

function validateCandidatePairs(
  baseline: SpfaRequirementEvidenceBaselineV2,
  candidates: readonly SpfaSemanticEvidenceCandidateV2[],
  path: string,
): void {
  try {
    validateSpfaSemanticCandidateSelectionV2(
      {
        schemaVersion: '2.0',
        sessionId: baseline.sessionId,
        caseVersionId: baseline.caseVersionId,
        transcriptFingerprint: { ...baseline.transcriptFingerprint },
        carePathSpfaRef: baseline.carePathSpfaRef,
        requirementRef: baseline.requirementRef,
        kind: baseline.kind,
        candidates,
      },
      baseline,
      path,
    );
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'path' in error &&
      typeof error.path === 'string'
    ) {
      fail(error.path, error instanceof Error ? error.message : 'invalid candidate');
    }
    fail(path, 'invalid semantic candidate selection');
  }
}

function requireExactIdentity(
  source: Record<string, unknown>,
  baseline: SpfaRequirementEvidenceBaselineV2,
  path: string,
): {
  caseVersionId: CaseVersionId;
  transcriptFingerprint: SessionTranscriptFingerprintV1;
  carePathSpfaRef: ConclusionId;
  requirementRef: SpfaProtocolRequirementId;
} {
  if (source.schemaVersion !== '2.0') fail(`${path}.schemaVersion`, 'must be 2.0');
  if (source.contractVersion !== 'spfa-semantic-adjudication/1') {
    fail(
      `${path}.contractVersion`,
      'must be spfa-semantic-adjudication/1',
    );
  }
  if (source.sessionId !== baseline.sessionId) {
    fail(`${path}.sessionId`, 'does not match the evidence baseline');
  }
  const caseVersionId = parseCaseVersionId(
    source.caseVersionId,
    `${path}.caseVersionId`,
  );
  if (caseVersionId !== baseline.caseVersionId) {
    fail(`${path}.caseVersionId`, 'does not match the evidence baseline');
  }
  const transcriptFingerprint = parseFingerprint(
    source.transcriptFingerprint,
    `${path}.transcriptFingerprint`,
  );
  if (!fingerprintEquals(transcriptFingerprint, baseline.transcriptFingerprint)) {
    fail(`${path}.transcriptFingerprint`, 'does not match the evidence baseline');
  }
  const carePathSpfaRef = parseConclusionId(
    source.carePathSpfaRef,
    `${path}.carePathSpfaRef`,
  );
  if (carePathSpfaRef !== baseline.carePathSpfaRef) {
    fail(`${path}.carePathSpfaRef`, 'does not match the evidence baseline');
  }
  const requirementRef = parseRequirementId(
    source.requirementRef,
    `${path}.requirementRef`,
  );
  if (requirementRef !== baseline.requirementRef) {
    fail(`${path}.requirementRef`, 'does not match the evidence baseline');
  }
  if (source.kind !== baseline.kind) {
    fail(`${path}.kind`, 'does not match the evidence baseline');
  }
  return {
    caseVersionId,
    transcriptFingerprint,
    carePathSpfaRef,
    requirementRef,
  };
}

function assertExactDecisionTargets(
  decisions: readonly { targetRef: SpfaRequirementTargetId }[],
  baseline: SpfaRequirementEvidenceBaselineV2,
  path: string,
): void {
  const unresolved = new Set<string>(baseline.unresolvedTargetRefs);
  const seen = new Set<string>();
  decisions.forEach((decision, index) => {
    if (seen.has(decision.targetRef)) {
      fail(`${path}[${index}].targetRef`, 'duplicate target decision');
    }
    if (!unresolved.has(decision.targetRef)) {
      fail(`${path}[${index}].targetRef`, 'is not an unresolved baseline target');
    }
    seen.add(decision.targetRef);
  });
  if (seen.size !== unresolved.size) {
    fail(path, 'must contain exactly one decision for every unresolved target');
  }
}

function canonicalizeDecisions<T extends {
  targetRef: SpfaRequirementTargetId;
  supports: readonly { targetRef: SpfaRequirementTargetId; messageRef: SessionMessageId }[];
}>(
  decisions: readonly T[],
  baseline: SpfaRequirementEvidenceBaselineV2,
): T[] {
  const universePositions = new Map(
    baseline.semanticCandidateUniverse.map((candidate, index) => [
      candidateKey(candidate),
      index,
    ]),
  );
  const decisionsByTarget = new Map(
    decisions.map((decision) => [decision.targetRef, decision]),
  );
  return baseline.unresolvedTargetRefs.map((targetRef) => {
    const decision = decisionsByTarget.get(targetRef);
    if (decision === undefined) fail('adjudication.decisions', 'missing target decision');
    return {
      ...decision,
      supports: [...decision.supports].sort((left, right) => {
        const leftPosition = universePositions.get(candidateKey(left));
        const rightPosition = universePositions.get(candidateKey(right));
        if (leftPosition === undefined || rightPosition === undefined) {
          fail('adjudication.decisions', 'support is outside the baseline universe');
        }
        return leftPosition - rightPosition;
      }),
    };
  });
}

export function validateSpfaSemanticAdjudicationV2(
  input: unknown,
  context: SpfaSemanticAdjudicationValidationContextV2,
  path = 'adjudication',
): SpfaSemanticAdjudicationV2 {
  const transcript = validateSessionTranscriptSnapshotV2(
    context.transcript,
    `${path}.transcript`,
  );
  const baseline = context.baseline;
  validateBaselineTranscriptPinning(baseline, transcript, `${path}.baseline`);
  if (
    baseline.resolution !== 'DETERMINISTIC_PARTIAL' &&
    baseline.resolution !== 'SEMANTIC_REQUIRED'
  ) {
    fail(path, 'baseline does not require semantic adjudication');
  }
  const source = asRecord(input, path);
  assertExactKeys(
    source,
    [
      'schemaVersion',
      'contractVersion',
      'sessionId',
      'caseVersionId',
      'transcriptFingerprint',
      'carePathSpfaRef',
      'requirementRef',
      'kind',
      'decisions',
    ],
    path,
  );
  const identity = requireExactIdentity(source, baseline, path);
  const transcriptContext: TranscriptContext = {
    messages: new Map(
      transcript.messages.map((message) => [message.messageId, message]),
    ),
    positions: new Map(
      transcript.messages.map((message, index) => [message.messageId, index]),
    ),
  };
  const rawDecisions = asArray(source.decisions, `${path}.decisions`);

  if (baseline.kind === 'INFORMATION_REQUIREMENT') {
    const decisions = rawDecisions.map((decision, index) =>
      parseInformationDecision(
        decision,
        `${path}.decisions[${index}]`,
        transcriptContext,
      ),
    );
    assertExactDecisionTargets(decisions, baseline, `${path}.decisions`);
    validateCandidatePairs(
      baseline,
      decisions.flatMap((decision) =>
        decision.supports.map((support) => ({
          targetRef: support.targetRef,
          messageRef: support.messageRef,
        })),
      ),
      `${path}.candidateSelection`,
    );
    const canonicalDecisions = canonicalizeDecisions(decisions, baseline);
    return {
      schemaVersion: '2.0',
      contractVersion: 'spfa-semantic-adjudication/1',
      sessionId: baseline.sessionId,
      ...identity,
      kind: baseline.kind,
      decisions: canonicalDecisions,
    };
  }

  const decisions = rawDecisions.map((decision, index) =>
    parseActionDecision(
      decision,
      `${path}.decisions[${index}]`,
      transcriptContext,
    ),
  );
  assertExactDecisionTargets(decisions, baseline, `${path}.decisions`);
  validateCandidatePairs(
    baseline,
    decisions.flatMap((decision) =>
      decision.supports.map((support) => ({
        targetRef: support.targetRef,
        messageRef: support.messageRef,
      })),
    ),
    `${path}.candidateSelection`,
  );
  const canonicalDecisions = canonicalizeDecisions(decisions, baseline);
  return {
    schemaVersion: '2.0',
    contractVersion: 'spfa-semantic-adjudication/1',
    sessionId: baseline.sessionId,
    ...identity,
    kind: baseline.kind,
    decisions: canonicalDecisions,
  };
}
