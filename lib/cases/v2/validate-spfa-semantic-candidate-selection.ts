import type {
  SpfaRequirementEvidenceBaselineV2,
  SpfaSemanticCandidateSelectionV2,
  SpfaSemanticEvidenceCandidateV2,
} from './spfa-evidence-baseline-types';
import type { SessionTranscriptFingerprintV1 } from './spfa-session-evidence-types';
import { validateSessionMessageIdV2 } from './spfa-session-transcript';
import { validateSpfaRequirementTargetIdV2 } from './validate-spfa-protocol-application';

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export class SpfaSemanticCandidateSelectionValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaSemanticCandidateSelectionValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new SpfaSemanticCandidateSelectionValidationError(path, message);
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

function candidateKey(candidate: {
  targetRef: string;
  messageRef: string;
}): string {
  return `${candidate.targetRef}\u0000${candidate.messageRef}`;
}

function parseCandidate(
  value: unknown,
  path: string,
): SpfaSemanticEvidenceCandidateV2 {
  const source = asRecord(value, path);
  assertExactKeys(source, ['targetRef', 'messageRef'], path);
  let targetRef;
  try {
    targetRef = validateSpfaRequirementTargetIdV2(
      source.targetRef,
      `${path}.targetRef`,
    );
  } catch {
    fail(`${path}.targetRef`, 'invalid SPFA requirement target ID');
  }
  let messageRef;
  try {
    messageRef = validateSessionMessageIdV2(
      source.messageRef,
      `${path}.messageRef`,
    );
  } catch {
    fail(`${path}.messageRef`, 'invalid session message ID');
  }
  return { targetRef, messageRef };
}

function requireExactMetadata(
  source: Record<string, unknown>,
  baseline: SpfaRequirementEvidenceBaselineV2,
  path: string,
): SessionTranscriptFingerprintV1 {
  if (source.schemaVersion !== '2.0') fail(`${path}.schemaVersion`, 'must be 2.0');
  if (source.sessionId !== baseline.sessionId) {
    fail(`${path}.sessionId`, 'does not match the evidence baseline');
  }
  if (source.caseVersionId !== baseline.caseVersionId) {
    fail(`${path}.caseVersionId`, 'does not match the evidence baseline');
  }
  const fingerprint = parseFingerprint(
    source.transcriptFingerprint,
    `${path}.transcriptFingerprint`,
  );
  if (!fingerprintEquals(fingerprint, baseline.transcriptFingerprint)) {
    fail(`${path}.transcriptFingerprint`, 'does not match the evidence baseline');
  }
  if (source.carePathSpfaRef !== baseline.carePathSpfaRef) {
    fail(`${path}.carePathSpfaRef`, 'does not match the evidence baseline');
  }
  if (source.requirementRef !== baseline.requirementRef) {
    fail(`${path}.requirementRef`, 'does not match the evidence baseline');
  }
  if (source.kind !== baseline.kind) {
    fail(`${path}.kind`, 'does not match the evidence baseline');
  }
  return fingerprint;
}

export function validateSpfaSemanticCandidateSelectionV2(
  input: unknown,
  baseline: SpfaRequirementEvidenceBaselineV2,
  path = 'selection',
): SpfaSemanticCandidateSelectionV2 {
  const source = asRecord(input, path);
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
      'candidates',
    ],
    path,
  );
  const transcriptFingerprint = requireExactMetadata(source, baseline, path);
  const universeByKey = new Map(
    baseline.semanticCandidateUniverse.map((candidate) => [
      candidateKey(candidate),
      candidate,
    ]),
  );
  const selectedKeys = new Set<string>();
  asArray(source.candidates, `${path}.candidates`).forEach((item, index) => {
    const candidate = parseCandidate(item, `${path}.candidates[${index}]`);
    const key = candidateKey(candidate);
    if (selectedKeys.has(key)) {
      fail(`${path}.candidates[${index}]`, 'duplicate semantic candidate');
    }
    if (!universeByKey.has(key)) {
      fail(`${path}.candidates[${index}]`, 'candidate does not exist in the baseline universe');
    }
    selectedKeys.add(key);
  });
  const candidates = baseline.semanticCandidateUniverse
    .filter((candidate) => selectedKeys.has(candidateKey(candidate)))
    .map((candidate) => ({ ...candidate }));

  return {
    schemaVersion: '2.0',
    sessionId: baseline.sessionId,
    caseVersionId: baseline.caseVersionId,
    transcriptFingerprint,
    carePathSpfaRef: baseline.carePathSpfaRef,
    requirementRef: baseline.requirementRef,
    kind: baseline.kind,
    candidates,
  };
}
