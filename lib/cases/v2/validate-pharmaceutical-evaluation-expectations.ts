import type {
  PharmaceuticalEvaluationExpectationGroupV2,
  PharmaceuticalEvaluationExpectationSetV2,
} from './pharmaceutical-evaluation-expectation-types';
import type { PharmaceuticalEvaluationTargetId, PharmaceuticalEvaluationTargetSetV2 } from './pharmaceutical-evaluation-target-types';

type UnknownRecord = Record<string, unknown>;
const TARGET_ID_PATTERN = /^pharm_target_[0-9a-f]{64}$/;

export class PharmaceuticalEvaluationExpectationValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalEvaluationExpectationValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalEvaluationExpectationValidationError(path, message);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be an object');
  return value as UnknownRecord;
}

function exact(source: UnknownRecord, keys: readonly string[], path: string): void {
  for (const key of Object.keys(source)) if (!keys.includes(key)) fail(`${path}.${key}`, 'unexpected property');
  for (const key of keys) if (!Object.prototype.hasOwnProperty.call(source, key)) fail(`${path}.${key}`, 'missing required property');
}

function sameFingerprint(value: unknown, targetSet: PharmaceuticalEvaluationTargetSetV2, path: string): void {
  const source = record(value, path);
  exact(source, ['algorithm', 'canonicalization', 'value'], path);
  if (source.algorithm !== targetSet.fingerprint.algorithm || source.canonicalization !== targetSet.fingerprint.canonicalization || source.value !== targetSet.fingerprint.value) fail(path, 'does not match target set');
}

export function validatePharmaceuticalEvaluationExpectationSetV2(
  input: unknown,
  targetSet: PharmaceuticalEvaluationTargetSetV2,
): PharmaceuticalEvaluationExpectationSetV2 {
  const source = record(input, 'pharmaceuticalEvaluationExpectations');
  exact(source, ['schemaVersion', 'contractVersion', 'caseVersionId', 'targetSetFingerprint', 'groups'], 'pharmaceuticalEvaluationExpectations');
  if (source.schemaVersion !== '2.0') fail('pharmaceuticalEvaluationExpectations.schemaVersion', 'must be 2.0');
  if (source.contractVersion !== 'pharmaceutical-evaluation-expectations/1') fail('pharmaceuticalEvaluationExpectations.contractVersion', 'invalid contract version');
  if (source.caseVersionId !== targetSet.caseVersionId) fail('pharmaceuticalEvaluationExpectations.caseVersionId', 'does not match target set');
  sameFingerprint(source.targetSetFingerprint, targetSet, 'pharmaceuticalEvaluationExpectations.targetSetFingerprint');
  if (!Array.isArray(source.groups)) fail('pharmaceuticalEvaluationExpectations.groups', 'must be an array');
  const known = new Set(targetSet.targets.map((target) => target.targetId));
  const groupKeys = new Set<string>();
  const groups = source.groups.map((item, index): PharmaceuticalEvaluationExpectationGroupV2 => {
    const path = `pharmaceuticalEvaluationExpectations.groups[${index}]`;
    const group = record(item, path);
    exact(group, ['operator', 'memberTargetRefs'], path);
    if (group.operator !== 'ALL_OF' && group.operator !== 'ONE_OF') fail(`${path}.operator`, 'must be ALL_OF or ONE_OF');
    if (!Array.isArray(group.memberTargetRefs) || group.memberTargetRefs.length === 0) fail(`${path}.memberTargetRefs`, 'must be non-empty');
    const seen = new Set<string>();
    const members = group.memberTargetRefs.map((member, memberIndex) => {
      const memberPath = `${path}.memberTargetRefs[${memberIndex}]`;
      if (typeof member !== 'string' || !TARGET_ID_PATTERN.test(member)) fail(memberPath, 'must be a pharmaceutical target ID');
      if (!known.has(member as PharmaceuticalEvaluationTargetId)) fail(memberPath, 'references an unknown target');
      if (seen.has(member)) fail(memberPath, 'duplicate member');
      seen.add(member);
      return member as PharmaceuticalEvaluationTargetId;
    }).sort((left, right) => left < right ? -1 : left > right ? 1 : 0) as unknown as PharmaceuticalEvaluationExpectationGroupV2['memberTargetRefs'];
    const key = `${group.operator}:${members.join(',')}`;
    if (groupKeys.has(key)) fail(path, 'duplicate expectation group');
    groupKeys.add(key);
    return { operator: group.operator, memberTargetRefs: members };
  }).sort((left, right) => {
    const leftKey = `${left.operator}:${left.memberTargetRefs.join(',')}`;
    const rightKey = `${right.operator}:${right.memberTargetRefs.join(',')}`;
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  return {
    schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-expectations/1',
    caseVersionId: targetSet.caseVersionId, targetSetFingerprint: { ...targetSet.fingerprint }, groups,
  };
}
