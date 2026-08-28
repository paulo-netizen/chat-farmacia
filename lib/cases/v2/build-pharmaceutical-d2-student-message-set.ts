import { createHash } from 'node:crypto';

import {
  calculatePharmaceuticalAdjudicationContextFingerprintV2,
} from './build-pharmaceutical-adjudication-context';
import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';
import {
  PHARMACEUTICAL_D2_STUDENT_MESSAGE_SET_CONTRACT_VERSION_V1,
  type PharmaceuticalD2StudentMessageSetFingerprintV1,
  type PharmaceuticalD2StudentMessageSetV2,
} from './pharmaceutical-d2-claim-types';

type UnknownRecord = Record<string, unknown>;
type StudentMessageSetCore = Omit<PharmaceuticalD2StudentMessageSetV2, 'fingerprint'>;
const SESSION_MESSAGE_ID_PATTERN = /^[1-9][0-9]*$/;

export class PharmaceuticalD2StudentMessageSetError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalD2StudentMessageSetError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalD2StudentMessageSetError(path, message);
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
      fail(path, 'must contain the canonical value');
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
  if (actual !== expected) fail(path, 'does not match the canonical value');
}

function validateContextFingerprint(context: PharmaceuticalAdjudicationContextSetV2): void {
  const { fingerprint: _fingerprint, ...core } = context;
  const expected = calculatePharmaceuticalAdjudicationContextFingerprintV2(core);
  if (
    context.fingerprint.algorithm !== expected.algorithm ||
    context.fingerprint.canonicalization !== expected.canonicalization ||
    context.fingerprint.value !== expected.value
  ) {
    fail('context.fingerprint', 'does not match the supplied adjudication context');
  }
}

function numericMessageOrder(left: string, right: string): number {
  const leftId = BigInt(left);
  const rightId = BigInt(right);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

export function calculatePharmaceuticalD2StudentMessageSetFingerprintV1(
  core: StudentMessageSetCore,
): PharmaceuticalD2StudentMessageSetFingerprintV1 {
  return {
    algorithm: 'sha256',
    canonicalization: 'pharmaceutical-d2-student-message-set-v2/1',
    value: createHash('sha256').update(JSON.stringify(core)).digest('hex'),
  };
}

export function buildPharmaceuticalD2StudentMessageSetV2(
  context: PharmaceuticalAdjudicationContextSetV2,
): PharmaceuticalD2StudentMessageSetV2 {
  validateContextFingerprint(context);
  const byMessageRef = new Map<string, string>();
  context.targets.forEach((target, targetIndex) => {
    target.studentCandidates.forEach((candidate, candidateIndex) => {
      const path = `context.targets[${targetIndex}].studentCandidates[${candidateIndex}]`;
      if (
        typeof candidate.messageRef !== 'string' ||
        !SESSION_MESSAGE_ID_PATTERN.test(candidate.messageRef)
      ) {
        fail(`${path}.messageRef`, 'must be a canonical positive decimal SessionMessageId');
      }
      if (typeof candidate.untrustedContent !== 'string') {
        fail(`${path}.untrustedContent`, 'must be a string');
      }
      const existing = byMessageRef.get(candidate.messageRef);
      if (existing !== undefined && existing !== candidate.untrustedContent) {
        fail(
          `${path}.untrustedContent`,
          'conflicts with another occurrence of the same messageRef',
        );
      }
      byMessageRef.set(candidate.messageRef, candidate.untrustedContent);
    });
  });
  const core: StudentMessageSetCore = {
    schemaVersion: '2.0',
    contractVersion: PHARMACEUTICAL_D2_STUDENT_MESSAGE_SET_CONTRACT_VERSION_V1,
    sessionId: context.sessionId,
    caseVersionId: context.caseVersionId,
    contextFingerprint: structuredClone(context.fingerprint),
    messages: [...byMessageRef.entries()]
      .sort(([left], [right]) => numericMessageOrder(left, right))
      .map(([messageRef, untrustedContent]) => ({
        messageRef: messageRef as PharmaceuticalD2StudentMessageSetV2['messages'][number]['messageRef'],
        untrustedContent,
      })),
  };
  return {
    ...core,
    fingerprint: calculatePharmaceuticalD2StudentMessageSetFingerprintV1(core),
  };
}

export function validatePharmaceuticalD2StudentMessageSetV2(
  input: unknown,
  context: PharmaceuticalAdjudicationContextSetV2,
): PharmaceuticalD2StudentMessageSetV2 {
  const expected = buildPharmaceuticalD2StudentMessageSetV2(context);
  assertExact(input, expected, 'pharmaceuticalD2StudentMessageSet');
  return expected;
}
