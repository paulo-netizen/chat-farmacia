import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  CASE_VERSION_STATUSES_V2,
  CaseVersionLifecycleError,
  assertCaseVersionStatusTransitionV2,
  canTransitionCaseVersionStatusV2,
  isCaseVersionAvailableToStudentsV2,
  isCaseVersionStatusV2,
  type CaseVersionStatusV2,
} from '@/lib/cases/v2/case-version-lifecycle';

const allowedTransitions = new Set<string>([
  'AI_DRAFT->TEACHER_DRAFT',
  'AI_DRAFT->IN_REVIEW',
  'AI_DRAFT->ARCHIVED',
  'TEACHER_DRAFT->IN_REVIEW',
  'TEACHER_DRAFT->ARCHIVED',
  'IN_REVIEW->TEACHER_DRAFT',
  'IN_REVIEW->VALIDATED',
  'IN_REVIEW->ARCHIVED',
  'VALIDATED->IN_REVIEW',
  'VALIDATED->PUBLISHED',
  'VALIDATED->ARCHIVED',
  'PUBLISHED->ARCHIVED',
]);

function transitionKey(
  from: CaseVersionStatusV2,
  to: CaseVersionStatusV2,
): string {
  return `${from}->${to}`;
}

describe('case version lifecycle V2', () => {
  it('defines exactly the six canonical V2 statuses', () => {
    expect(CASE_VERSION_STATUSES_V2).toEqual([
      'AI_DRAFT',
      'TEACHER_DRAFT',
      'IN_REVIEW',
      'VALIDATED',
      'PUBLISHED',
      'ARCHIVED',
    ]);
    expect(allowedTransitions.size).toBe(12);
  });

  it.each(CASE_VERSION_STATUSES_V2)('recognizes canonical status %s', (status) => {
    expect(isCaseVersionStatusV2(status)).toBe(true);
  });

  it.each([
    'APPROVED',
    'REJECTED',
    'PROPOSED',
    'DRAFT',
    'ACTIVE',
    'published',
    '',
    null,
    undefined,
    1,
    {},
    [],
  ])('rejects non-canonical status %j', (value) => {
    expect(isCaseVersionStatusV2(value)).toBe(false);
  });

  describe.each(CASE_VERSION_STATUSES_V2)('from %s', (from) => {
    it.each(CASE_VERSION_STATUSES_V2)('evaluates transition to %s', (to) => {
      const expected = allowedTransitions.has(transitionKey(from, to));

      expect(canTransitionCaseVersionStatusV2(from, to)).toBe(expected);
      if (expected) {
        expect(() =>
          assertCaseVersionStatusTransitionV2(from, to),
        ).not.toThrow();
        return;
      }

      try {
        assertCaseVersionStatusTransitionV2(from, to);
        throw new Error('expected invalid transition to throw');
      } catch (error) {
        expect(error).toBeInstanceOf(CaseVersionLifecycleError);
        expect(error).toMatchObject({
          code: 'invalid_case_version_transition',
          from,
          to,
        });
        expect((error as Error).message).toBe(
          `invalid case version transition ${from} -> ${to}`,
        );
      }
    });
  });

  it.each(CASE_VERSION_STATUSES_V2)(
    'makes only PUBLISHED available to students: %s',
    (status) => {
      expect(isCaseVersionAvailableToStudentsV2(status)).toBe(
        status === 'PUBLISHED',
      );
    },
  );

  it('has no environment, network, provider, persistence, or bundle coupling', () => {
    const source = readFileSync(
      new URL('../../lib/cases/v2/case-version-lifecycle.ts', import.meta.url),
      'utf8',
    );

    for (const forbidden of [
      'process.env',
      'OPENAI_API_KEY',
      "from 'openai'",
      'fetch(',
      'Supabase',
      'GeneratedCaseBundleV2',
      'teacherInstruction',
      'apiKey',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
