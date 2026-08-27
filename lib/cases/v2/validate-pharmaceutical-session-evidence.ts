import { buildPharmaceuticalSessionEvidenceCandidatesV2 } from './build-pharmaceutical-session-evidence-candidates';
import type {
  PharmaceuticalPatientEvidenceKindV2,
  PharmaceuticalSessionEvidenceCandidateSetV2,
  PharmaceuticalSessionEvidenceRefV2,
  PharmaceuticalSessionEvidenceSetV2,
  PharmaceuticalSessionEvidenceValidationContextV2,
  PharmaceuticalStudentEvidenceKindV2,
} from './pharmaceutical-session-evidence-types';
import type { PharmaceuticalEvaluationTargetId } from './pharmaceutical-evaluation-target-types';
import type { SessionMessageId } from './spfa-session-evidence-types';
import { validateSessionMessageIdV2, validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';

type UnknownRecord = Record<string, unknown>;
const STUDENT_KINDS = ['STUDENT_QUESTION', 'STUDENT_INTERPRETATION', 'STUDENT_DECISION', 'STUDENT_ACTION'] as const;
const PATIENT_KINDS = ['PATIENT_STATEMENT', 'PATIENT_CONFIRMATION'] as const;
const TARGET_ID_PATTERN = /^pharm_target_[0-9a-f]{64}$/;

export class PharmaceuticalSessionEvidenceValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalSessionEvidenceValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalSessionEvidenceValidationError(path, message);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be an object');
  return value as UnknownRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function exact(source: UnknownRecord, allowed: readonly string[], required: readonly string[], path: string): void {
  for (const key of Object.keys(source)) if (!allowed.includes(key)) fail(`${path}.${key}`, 'unexpected property');
  for (const key of required) if (!Object.prototype.hasOwnProperty.call(source, key)) fail(`${path}.${key}`, 'missing required property');
}

function sameFingerprint(left: unknown, right: { algorithm: string; canonicalization: string; value: string }, path: string): void {
  const source = record(left, path);
  exact(source, ['algorithm', 'canonicalization', 'value'], ['algorithm', 'canonicalization', 'value'], path);
  if (source.algorithm !== right.algorithm || source.canonicalization !== right.canonicalization || source.value !== right.value) fail(path, 'does not match the bound fingerprint');
}

function targetRef(value: unknown, knownTargets: ReadonlySet<string>, path: string): PharmaceuticalEvaluationTargetId {
  if (typeof value !== 'string' || !TARGET_ID_PATTERN.test(value)) fail(path, 'must be a pharmaceutical target ID');
  if (!knownTargets.has(value)) fail(path, 'references an unknown target');
  return value as PharmaceuticalEvaluationTargetId;
}

function ordinalMessage(left: SessionMessageId, right: SessionMessageId): number {
  const l = BigInt(left); const r = BigInt(right);
  return l < r ? -1 : l > r ? 1 : 0;
}

function evidenceKey(value: { targetRef: string; messageRef: string; evidenceKind: string }): string {
  return `${value.targetRef}|${value.messageRef}|${value.evidenceKind}`;
}

function assertExact(actual: unknown, expected: unknown, path: string): void {
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) fail(path, 'must contain the canonical candidate universe');
    expected.forEach((item, index) => assertExact(actual[index], item, `${path}[${index}]`));
    return;
  }
  if (typeof expected === 'object' && expected !== null) {
    const actualRecord = record(actual, path);
    const expectedRecord = expected as UnknownRecord;
    for (const key of Object.keys(actualRecord)) if (!Object.prototype.hasOwnProperty.call(expectedRecord, key)) fail(`${path}.${key}`, 'unexpected property');
    for (const key of Object.keys(expectedRecord)) {
      if (!Object.prototype.hasOwnProperty.call(actualRecord, key)) fail(`${path}.${key}`, 'missing required property');
      assertExact(actualRecord[key], expectedRecord[key], `${path}.${key}`);
    }
    return;
  }
  if (actual !== expected) fail(path, 'does not match the canonical candidate universe');
}

export function validatePharmaceuticalSessionEvidenceCandidateSetV2(
  input: unknown,
  transcriptInput: PharmaceuticalSessionEvidenceValidationContextV2['transcript'],
  targetSet: PharmaceuticalSessionEvidenceValidationContextV2['targetSet'],
): PharmaceuticalSessionEvidenceCandidateSetV2 {
  const expected = buildPharmaceuticalSessionEvidenceCandidatesV2(transcriptInput, targetSet);
  assertExact(input, expected, 'candidateSet');
  return expected;
}

function parseRef(
  value: unknown,
  path: string,
  context: PharmaceuticalSessionEvidenceValidationContextV2,
  knownTargets: ReadonlySet<string>,
  messageIndex: ReadonlyMap<string, { role: 'student' | 'patient'; content: string; order: number }>,
  candidateKeys: ReadonlySet<string>,
): PharmaceuticalSessionEvidenceRefV2 {
  const source = record(value, path);
  const speaker = source.speaker;
  if (speaker !== 'student' && speaker !== 'patient') fail(`${path}.speaker`, 'must be student or patient');
  const allowed = speaker === 'patient'
    ? ['targetRef', 'messageRef', 'speaker', 'evidenceRole', 'evidenceKind', 'excerpt', 'studentQuestionRef']
    : ['targetRef', 'messageRef', 'speaker', 'evidenceRole', 'evidenceKind', 'excerpt'];
  exact(source, allowed, ['targetRef', 'messageRef', 'speaker', 'evidenceRole', 'evidenceKind', 'excerpt'], path);
  const parsedTarget = targetRef(source.targetRef, knownTargets, `${path}.targetRef`);
  let messageRef: SessionMessageId;
  try { messageRef = validateSessionMessageIdV2(source.messageRef, `${path}.messageRef`); }
  catch { fail(`${path}.messageRef`, 'must be a valid message reference'); }
  const message = messageIndex.get(messageRef);
  if (message === undefined) fail(`${path}.messageRef`, 'references an unknown message');
  if (message.role !== speaker) fail(`${path}.speaker`, 'does not match the referenced message');
  if (typeof source.excerpt !== 'string' || source.excerpt.length === 0) fail(`${path}.excerpt`, 'must be non-empty');
  if (source.excerpt.length > 1_000) fail(`${path}.excerpt`, 'must not exceed 1000 characters');
  if (!message.content.includes(source.excerpt)) fail(`${path}.excerpt`, 'must be a literal substring of the message');

  if (speaker === 'student') {
    if (source.evidenceRole !== 'STUDENT_DEMONSTRATION') fail(`${path}.evidenceRole`, 'student evidence must be STUDENT_DEMONSTRATION');
    if (!STUDENT_KINDS.includes(source.evidenceKind as PharmaceuticalStudentEvidenceKindV2)) fail(`${path}.evidenceKind`, 'invalid student evidence kind');
    const parsed = { targetRef: parsedTarget, messageRef, speaker: 'student' as const, evidenceRole: 'STUDENT_DEMONSTRATION' as const, evidenceKind: source.evidenceKind as PharmaceuticalStudentEvidenceKindV2, excerpt: source.excerpt };
    if (!candidateKeys.has(evidenceKey(parsed))) fail(path, 'is not structurally compatible with the target');
    return parsed;
  }

  if (source.evidenceRole !== 'ACQUISITION_CONTEXT') fail(`${path}.evidenceRole`, 'patient evidence must be ACQUISITION_CONTEXT');
  if (!PATIENT_KINDS.includes(source.evidenceKind as PharmaceuticalPatientEvidenceKindV2)) fail(`${path}.evidenceKind`, 'invalid patient evidence kind');
  let studentQuestionRef: SessionMessageId | undefined;
  if (source.studentQuestionRef !== undefined) {
    try { studentQuestionRef = validateSessionMessageIdV2(source.studentQuestionRef, `${path}.studentQuestionRef`); }
    catch { fail(`${path}.studentQuestionRef`, 'must be a valid message reference'); }
    const question = messageIndex.get(studentQuestionRef);
    if (question === undefined || question.role !== 'student') fail(`${path}.studentQuestionRef`, 'must reference a student message');
    if (question.order >= message.order) fail(`${path}.studentQuestionRef`, 'must precede the patient message');
  }
  const parsed = { targetRef: parsedTarget, messageRef, speaker: 'patient' as const, evidenceRole: 'ACQUISITION_CONTEXT' as const, evidenceKind: source.evidenceKind as PharmaceuticalPatientEvidenceKindV2, excerpt: source.excerpt, ...(studentQuestionRef === undefined ? {} : { studentQuestionRef }) };
  if (!candidateKeys.has(evidenceKey(parsed))) fail(path, 'is not structurally compatible with the target');
  return parsed;
}

function compareEvidence(left: PharmaceuticalSessionEvidenceRefV2, right: PharmaceuticalSessionEvidenceRefV2, targetOrder: ReadonlyMap<string, number>): number {
  const targetDifference = (targetOrder.get(left.targetRef) ?? -1) - (targetOrder.get(right.targetRef) ?? -1);
  if (targetDifference !== 0) return targetDifference;
  const message = ordinalMessage(left.messageRef, right.messageRef);
  if (message !== 0) return message;
  if (left.evidenceKind < right.evidenceKind) return -1;
  if (left.evidenceKind > right.evidenceKind) return 1;
  return left.excerpt < right.excerpt ? -1 : left.excerpt > right.excerpt ? 1 : 0;
}

export function validatePharmaceuticalSessionEvidenceSetV2(
  input: unknown,
  context: PharmaceuticalSessionEvidenceValidationContextV2,
): PharmaceuticalSessionEvidenceSetV2 {
  const transcript = validateSessionTranscriptSnapshotV2(context.transcript);
  const candidateSet = validatePharmaceuticalSessionEvidenceCandidateSetV2(context.candidateSet, transcript, context.targetSet);
  const source = record(input, 'pharmaceuticalSessionEvidence');
  exact(source, ['schemaVersion', 'contractVersion', 'sessionId', 'caseVersionId', 'transcriptFingerprint', 'targetSetFingerprint', 'evidence'], ['schemaVersion', 'contractVersion', 'sessionId', 'caseVersionId', 'transcriptFingerprint', 'targetSetFingerprint', 'evidence'], 'pharmaceuticalSessionEvidence');
  if (source.schemaVersion !== '2.0') fail('pharmaceuticalSessionEvidence.schemaVersion', 'must be 2.0');
  if (source.contractVersion !== 'pharmaceutical-session-evidence/1') fail('pharmaceuticalSessionEvidence.contractVersion', 'invalid contract version');
  if (source.sessionId !== transcript.sessionId) fail('pharmaceuticalSessionEvidence.sessionId', 'does not match transcript');
  if (source.caseVersionId !== transcript.caseVersionId || source.caseVersionId !== context.targetSet.caseVersionId) fail('pharmaceuticalSessionEvidence.caseVersionId', 'does not match transcript and target set');
  sameFingerprint(source.transcriptFingerprint, transcript.fingerprint, 'pharmaceuticalSessionEvidence.transcriptFingerprint');
  sameFingerprint(source.targetSetFingerprint, context.targetSet.fingerprint, 'pharmaceuticalSessionEvidence.targetSetFingerprint');
  const knownTargets = new Set(context.targetSet.targets.map((target) => target.targetId));
  const targetOrder = new Map(context.targetSet.targets.map((target, index) => [target.targetId, index] as const));
  const messageIndex = new Map(transcript.messages.map((message, order) => [message.messageId, { role: message.role, content: message.content, order }] as const));
  const candidateKeys = new Set(candidateSet.candidates.map(evidenceKey));
  const evidence = array(source.evidence, 'pharmaceuticalSessionEvidence.evidence').map((item, index) => parseRef(item, `pharmaceuticalSessionEvidence.evidence[${index}]`, context, knownTargets, messageIndex, candidateKeys));
  const seen = new Set<string>();
  for (const [index, item] of evidence.entries()) {
    const key = `${evidenceKey(item)}|${item.excerpt}|${'studentQuestionRef' in item ? item.studentQuestionRef ?? '' : ''}`;
    if (seen.has(key)) fail(`pharmaceuticalSessionEvidence.evidence[${index}]`, 'duplicate evidence reference');
    seen.add(key);
    if (index > 0 && compareEvidence(evidence[index - 1], item, targetOrder) > 0) fail(`pharmaceuticalSessionEvidence.evidence[${index}]`, 'must use canonical order');
  }
  return {
    schemaVersion: '2.0', contractVersion: 'pharmaceutical-session-evidence/1',
    sessionId: transcript.sessionId, caseVersionId: transcript.caseVersionId,
    transcriptFingerprint: { ...transcript.fingerprint }, targetSetFingerprint: { ...context.targetSet.fingerprint }, evidence,
  };
}
