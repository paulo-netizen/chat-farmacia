import { createHash } from 'node:crypto';

import type {
  SessionMessageId,
  SessionTranscriptFingerprintV1,
  SessionTranscriptMessageRoleV2,
  SessionTranscriptMessageV2,
  SessionTranscriptSnapshotV2,
} from './spfa-session-evidence-types';
import type { CaseVersionId } from './types';
import { validateCaseVersionId } from './validate-patient-facts';

const SESSION_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SESSION_MESSAGE_ID_PATTERN = /^[1-9][0-9]*$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const EXPLICIT_INSTANT_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const MESSAGE_ROLES = [
  'student',
  'patient',
] as const satisfies readonly SessionTranscriptMessageRoleV2[];

export class SessionTranscriptValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SessionTranscriptValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new SessionTranscriptValidationError(path, message);
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

function parseSessionId(value: unknown, path: string): string {
  if (typeof value !== 'string' || !SESSION_UUID_PATTERN.test(value)) {
    fail(path, 'must be a canonical lowercase UUID');
  }
  return value;
}

function parseCaseVersionId(value: unknown, path: string): CaseVersionId {
  try {
    return validateCaseVersionId(value, path);
  } catch {
    fail(path, 'must be a valid case version ID');
  }
}

export function validateSessionMessageIdV2(
  value: unknown,
  path = 'messageId',
): SessionMessageId {
  if (typeof value !== 'string' || !SESSION_MESSAGE_ID_PATTERN.test(value)) {
    fail(path, 'must be a canonical positive PostgreSQL bigint decimal string');
  }
  if (value.length > 19) fail(path, 'must fit PostgreSQL bigint');
  const numericValue = BigInt(value);
  if (numericValue > 9_223_372_036_854_775_807n) {
    fail(path, 'must fit PostgreSQL bigint');
  }
  return value as SessionMessageId;
}

function parseRole(
  value: unknown,
  path: string,
): SessionTranscriptMessageRoleV2 {
  if (
    typeof value !== 'string' ||
    !MESSAGE_ROLES.includes(value as SessionTranscriptMessageRoleV2)
  ) {
    fail(path, 'must be student or patient');
  }
  return value as SessionTranscriptMessageRoleV2;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

function parseTimestamp(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path, 'must be a valid timestamp string');
  const match = EXPLICIT_INSTANT_PATTERN.exec(value);
  if (match === null) {
    fail(path, 'must be an ISO/RFC3339 timestamp with an explicit timezone');
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, timezone] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    fail(path, 'must contain a valid calendar date and time');
  }
  if (timezone !== 'Z') {
    const offsetHour = Number(timezone.slice(1, 3));
    const offsetMinute = Number(timezone.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) {
      fail(path, 'must contain a valid timezone offset');
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(path, 'must be a valid timestamp');
  return date.toISOString();
}

function parseMessage(value: unknown, path: string): SessionTranscriptMessageV2 {
  const source = asRecord(value, path);
  assertExactKeys(source, ['messageId', 'role', 'content', 'createdAt'], path);
  if (typeof source.content !== 'string') {
    fail(`${path}.content`, 'must be a string');
  }
  return {
    messageId: validateSessionMessageIdV2(
      source.messageId,
      `${path}.messageId`,
    ),
    role: parseRole(source.role, `${path}.role`),
    content: source.content,
    createdAt: parseTimestamp(source.createdAt, `${path}.createdAt`),
  };
}

function compareMessages(
  left: SessionTranscriptMessageV2,
  right: SessionTranscriptMessageV2,
): number {
  if (left.createdAt < right.createdAt) return -1;
  if (left.createdAt > right.createdAt) return 1;
  const leftId = BigInt(left.messageId);
  const rightId = BigInt(right.messageId);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

function canonicalFingerprintMaterial(
  sessionId: string,
  caseVersionId: CaseVersionId,
  messages: readonly SessionTranscriptMessageV2[],
): string {
  return JSON.stringify({
    schemaVersion: '2.0',
    sessionId,
    caseVersionId,
    messages: messages.map((message) => ({
      messageId: message.messageId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })),
  });
}

function buildFingerprint(
  sessionId: string,
  caseVersionId: CaseVersionId,
  messages: readonly SessionTranscriptMessageV2[],
): SessionTranscriptFingerprintV1 {
  return {
    algorithm: 'sha256',
    canonicalization: 'session-transcript-v2/1',
    value: createHash('sha256')
      .update(canonicalFingerprintMaterial(sessionId, caseVersionId, messages))
      .digest('hex'),
  };
}

function buildSnapshot(
  sessionIdValue: unknown,
  caseVersionIdValue: unknown,
  messagesValue: unknown,
  path: string,
): SessionTranscriptSnapshotV2 {
  const sessionId = parseSessionId(sessionIdValue, `${path}.sessionId`);
  const caseVersionId = parseCaseVersionId(
    caseVersionIdValue,
    `${path}.caseVersionId`,
  );
  const messages = asArray(messagesValue, `${path}.messages`).map((message, index) =>
    parseMessage(message, `${path}.messages[${index}]`),
  );
  const messageIds = new Set<string>();
  for (const [index, message] of messages.entries()) {
    if (messageIds.has(message.messageId)) {
      fail(`${path}.messages[${index}].messageId`, 'duplicate message ID');
    }
    messageIds.add(message.messageId);
  }
  messages.sort(compareMessages);
  return {
    schemaVersion: '2.0',
    sessionId,
    caseVersionId,
    messages,
    fingerprint: buildFingerprint(sessionId, caseVersionId, messages),
  };
}

export function createSessionTranscriptSnapshotV2(
  value: unknown,
  path = 'transcript',
): SessionTranscriptSnapshotV2 {
  const source = asRecord(value, path);
  assertExactKeys(source, ['sessionId', 'caseVersionId', 'messages'], path);
  return buildSnapshot(
    source.sessionId,
    source.caseVersionId,
    source.messages,
    path,
  );
}

function parsePersistedFingerprint(
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

export function validateSessionTranscriptSnapshotV2(
  value: unknown,
  path = 'transcript',
): SessionTranscriptSnapshotV2 {
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    ['schemaVersion', 'sessionId', 'caseVersionId', 'messages', 'fingerprint'],
    path,
  );
  if (source.schemaVersion !== '2.0') {
    fail(`${path}.schemaVersion`, 'must be 2.0');
  }
  const persistedFingerprint = parsePersistedFingerprint(
    source.fingerprint,
    `${path}.fingerprint`,
  );
  const rebuilt = buildSnapshot(
    source.sessionId,
    source.caseVersionId,
    source.messages,
    path,
  );
  if (persistedFingerprint.value !== rebuilt.fingerprint.value) {
    fail(`${path}.fingerprint.value`, 'does not match the canonical transcript');
  }
  return rebuilt;
}
