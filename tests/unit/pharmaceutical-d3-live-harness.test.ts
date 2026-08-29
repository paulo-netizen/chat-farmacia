import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import type { PharmaceuticalD1SemanticBatchRequestV2 } from '../../lib/cases/v2/pharmaceutical-d1-adjudication-types';
import type { PharmaceuticalD2SemanticRequestV2 } from '../../lib/cases/v2/pharmaceutical-d2-claim-types';
import type {
  PharmaceuticalD1SemanticProviderReceiptV2,
  PharmaceuticalD1SemanticRuntimeV2,
} from '../../lib/cases/v2/pharmaceutical-d1-semantic-runtime';
import type {
  PharmaceuticalD2SemanticProviderReceiptV2,
  PharmaceuticalD2SemanticRuntimeV2,
} from '../../lib/cases/v2/pharmaceutical-d2-semantic-runtime';
import {
  buildPharmaceuticalD3EvidenceArtifactV1,
  calculatePharmaceuticalD3CallBudgetV1,
  isPharmaceuticalD3LiveEnabledV1,
  parsePharmaceuticalD3LiveSelectionV1,
  pharmaceuticalD3FixtureV1,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V1,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V2,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V3,
  PHARMACEUTICAL_D3_LIVE_EXECUTION_ORDER_V1,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V2,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V3,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V4,
  runPharmaceuticalD3AcceptanceV1,
  runPharmaceuticalD3FixtureV1,
  type PharmaceuticalD3LiveFixtureV1,
  type PharmaceuticalD3LiveRuntimeFactoryV1,
} from '../live/support/pharmaceutical-d3-live-matrix';

function d1ProviderResult(
  fixture: PharmaceuticalD3LiveFixtureV1,
  request: PharmaceuticalD1SemanticBatchRequestV2,
) {
  return {
    schemaVersion: '2.0',
    contractVersion: 'pharmaceutical-d1-provider-result/1',
    results: request.targets.map((target) => {
      const expected = fixture.expectedD1.find((item) => item.targetRef === target.targetRef);
      if (expected === undefined) throw new Error(`missing expected target ${target.targetRef}`);
      const evidence = expected.allowedEvidenceOptions[0];
      switch (expected.verdict) {
        case 'CORRECTLY_DEMONSTRATED':
          return { targetRef: target.targetRef, verdict: expected.verdict, supportingEvidence: [evidence] };
        case 'INCORRECT_OR_CONTRADICTED':
          return { targetRef: target.targetRef, verdict: expected.verdict, contradictionEvidence: [evidence] };
        case 'UNCERTAIN':
          return { targetRef: target.targetRef, verdict: expected.verdict, relatedEvidence: [evidence] };
        case 'NOT_DEMONSTRATED':
          return { targetRef: target.targetRef, verdict: expected.verdict, evidence: [] };
      }
    }),
  };
}

function d2ProviderResult(
  fixture: PharmaceuticalD3LiveFixtureV1,
  request: PharmaceuticalD2SemanticRequestV2,
) {
  return {
    schemaVersion: '2.0',
    contractVersion: 'pharmaceutical-d2-provider-result/2',
    findings: fixture.expectedD2.map((finding) => {
      const message = request.studentMessages.messages.find(
        (candidate) => candidate.messageRef === finding.messageRef,
      );
      if (message === undefined) throw new Error(`missing D2 message ${finding.messageRef}`);
      const occurrences: number[] = [];
      let fromIndex = 0;
      while (fromIndex <= message.untrustedContent.length - finding.excerpt.length) {
        const found = message.untrustedContent.indexOf(finding.excerpt, fromIndex);
        if (found < 0) break;
        occurrences.push(found);
        fromIndex = found + 1;
      }
      const occurrenceIndex = occurrences.indexOf(finding.excerptStart);
      if (occurrenceIndex < 0) throw new Error(`missing D2 occurrence ${finding.messageRef}`);
      return {
        messageRef: finding.messageRef,
        excerpt: finding.excerpt,
        occurrenceIndex,
        domain: finding.domain,
        findingType: finding.findingType,
        claimForm: finding.claimForm,
        relatedClinicalRefs: structuredClone(finding.relatedClinicalRefs),
      };
    }),
  };
}

function fakeFactory(overrides: Readonly<{
  responseModel?: string;
  d1Result?: (fixture: PharmaceuticalD3LiveFixtureV1, request: PharmaceuticalD1SemanticBatchRequestV2) => unknown;
  d2Result?: (fixture: PharmaceuticalD3LiveFixtureV1, request: PharmaceuticalD2SemanticRequestV2) => unknown;
  d1Error?: unknown;
  d2Error?: unknown;
}> = {}) {
  let ordinal = 0;
  const d1Calls = vi.fn();
  const d2Calls = vi.fn();
  const factory: PharmaceuticalD3LiveRuntimeFactoryV1 = {
    createD1Runtime: (fixture) => ({
      adjudicateBatch: async (request) => {
        d1Calls(fixture.fixtureId, request.batchDomain);
        if (overrides.d1Error !== undefined) throw overrides.d1Error;
        return {
          providerResult: overrides.d1Result?.(fixture, request) ?? d1ProviderResult(fixture, request),
          provider: 'openai',
          responseModel: overrides.responseModel ?? 'gpt-5.6-sol',
        } satisfies PharmaceuticalD1SemanticProviderReceiptV2;
      },
    } satisfies PharmaceuticalD1SemanticRuntimeV2),
    createD2Runtime: (fixture) => ({
      detectClaims: async (request) => {
        d2Calls(fixture.fixtureId);
        if (overrides.d2Error !== undefined) throw overrides.d2Error;
        return {
          providerResult: overrides.d2Result?.(fixture, request) ?? d2ProviderResult(fixture, request),
          provider: 'openai',
          responseModel: overrides.responseModel ?? 'gpt-5.6-sol',
        } satisfies PharmaceuticalD2SemanticProviderReceiptV2;
      },
    } satisfies PharmaceuticalD2SemanticRuntimeV2),
    allocateD1ExecutionId: () => {
      ordinal += 1;
      return `pharm_sem_exec_d3000000-0000-4000-8000-${ordinal.toString(16).padStart(12, '0')}`;
    },
    allocateD2ExecutionId: () => {
      ordinal += 1;
      return `pharm_sem_exec_d3000000-0000-4000-8000-${ordinal.toString(16).padStart(12, '0')}`;
    },
  };
  return { factory, d1Calls, d2Calls };
}

describe('M6-D3R6 pre-registered matrix', () => {
  it('freezes the explicit matrix identity, prompt versions and SHA-256 fingerprint', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.matrixVersion).toBe('pharmaceutical-d3-live-matrix/4');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.promptVersions).toEqual({
      d1: 'pharmaceutical-d1-adjudication-prompt/3',
      d2: 'pharmaceutical-d2-claim-prompt/3',
    });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.contractVersions.d2ProviderResult)
      .toBe('pharmaceutical-d2-provider-result/2');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.fingerprint).toEqual({
      algorithm: 'sha256',
      canonicalization: 'pharmaceutical-d3-live-matrix-v4/1',
      value: '700e3f64fecdba431fe3da72accc65a10cfaf9d17bdad3d257519814ef6a3608',
    });
    expect(Object.isFrozen(PHARMACEUTICAL_D3_LIVE_MATRIX_V4)).toBe(true);
    expect(Object.isFrozen(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.fixtures[0].expectedCallsPerRun))
      .toBe(true);
  });

  it('preserves the rejected matrix /1 identity and historical outcome unchanged', () => {
    expect(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V1).toEqual({
      matrixVersion: 'pharmaceutical-d3-live-matrix/1',
      matrixFingerprint: 'cc8d82fb2adcdbd72039053951997e3c54d4fe619c0b566dc936bd8cde4cf1da',
      decision: 'REJECT',
      fixtureId: 'SMOKE',
      run: 1,
      failure: 'D1 evidence excerpt retained terminal punctuation outside the exact allowlist',
    });
    expect(Object.isFrozen(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V1)).toBe(true);
  });

  it('preserves the inconclusive matrix /2 identity and historical outcome unchanged', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V2.matrixVersion)
      .toBe('pharmaceutical-d3-live-matrix/2');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V2.promptVersions).toEqual({
      d1: 'pharmaceutical-d1-adjudication-prompt/3',
      d2: 'pharmaceutical-d2-claim-prompt/1',
    });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V2.fingerprint).toEqual({
      algorithm: 'sha256',
      canonicalization: 'pharmaceutical-d3-live-matrix-v2/1',
      value: 'd6fe321921abfff8073645e5db398f63b81d5c39abfc8dafc3d2397ea3c38a95',
    });
    expect(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V2).toEqual({
      matrixVersion: 'pharmaceutical-d3-live-matrix/2',
      matrixFingerprint: 'd6fe321921abfff8073645e5db398f63b81d5c39abfc8dafc3d2397ea3c38a95',
      decision: 'INCONCLUSIVE',
      fixtureId: 'C3',
      run: 1,
      failure: {
        code: 'INVALID_PROVIDER_RESULT',
        path: 'providerResult.findings[1].excerpt',
      },
    });
    expect(Object.isFrozen(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V2)).toBe(true);
    expect(Object.isFrozen(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V2.failure)).toBe(true);
  });

  it('preserves the inconclusive matrix /3 identity and historical outcome unchanged', () => {
    expect(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V3).toEqual({
      matrixVersion: 'pharmaceutical-d3-live-matrix/3',
      matrixFingerprint: '64c55ed55be855933904c875cdbd3e7c3464c8aab5c6c9049e86b161b185950e',
      decision: 'INCONCLUSIVE',
      fixtureId: 'C3',
      run: 1,
      failure: {
        code: 'INVALID_PROVIDER_RESULT',
        path: 'providerResult.findings[4].excerpt',
      },
    });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V3.fingerprint.value)
      .toBe('64c55ed55be855933904c875cdbd3e7c3464c8aab5c6c9049e86b161b185950e');
  });

  it('contains exactly the seven pre-registered fixture classes', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.fixtures.map((fixture) => fixture.fixtureId))
      .toEqual(['SMOKE', 'C1', 'C2', 'C3', 'S1', 'S2', 'Z0']);
  });

  it('derives the complete 82-call budget from matrix definitions', () => {
    const budget = calculatePharmaceuticalD3CallBudgetV1();
    expect(budget.byFixture).toMatchObject({
      SMOKE: { repetitions: 1, d1: 1, d2: 1, total: 2 },
      C1: { repetitions: 5, d1: 25, d2: 5, total: 30 },
      C2: { repetitions: 5, d1: 20, d2: 5, total: 25 },
      C3: { repetitions: 5, d1: 0, d2: 5, total: 5 },
      S1: { repetitions: 5, d1: 10, d2: 0, total: 10 },
      S2: { repetitions: 5, d1: 5, d2: 5, total: 10 },
      Z0: { repetitions: 1, d1: 0, d2: 0, total: 0 },
    });
    expect(budget).toMatchObject({ d1: 61, d2: 21, total: 82 });
  });

  it('freezes one smoke run, five semantic runs, 100% threshold and no majority vote', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.repetitions).toEqual({ smoke: 1, semantic: 5 });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.threshold).toEqual({
      requiredFraction: 1, majorityVote: false,
    });
    expect(PHARMACEUTICAL_D3_LIVE_EXECUTION_ORDER_V1).toEqual([
      'SMOKE', 'C3', 'C2', 'C1', 'S1', 'S2',
    ]);
  });

  it('pre-registers exact clause allowlists and multiple-valid evidence without patient refs', () => {
    const c1 = pharmaceuticalD3FixtureV1('C1');
    expect(c1.expectedD1.every((target) => target.allowedEvidenceOptions.length >= 1)).toBe(true);
    expect(c1.expectedD1.find((target) => target.aspect === 'PRM_STATUS')?.allowedEvidenceOptions)
      .toHaveLength(4);
    for (const target of c1.expectedD1) {
      for (const evidence of target.allowedEvidenceOptions) {
        const candidate = c1.context.targets
          .find((item) => item.targetRef === target.targetRef)?.studentCandidates
          .find((item) => item.messageRef === evidence.messageRef);
        expect(candidate?.untrustedContent).toContain(evidence.excerpt);
        expect(candidate?.untrustedContent).not.toBe(evidence.excerpt);
        expect(candidate?.candidateEvidenceKinds).toContain(evidence.evidenceKind);
      }
    }
  });

  it('accepts exact declarative clauses with or without terminal punctuation', async () => {
    const smoke = pharmaceuticalD3FixtureV1('SMOKE');
    const expected = smoke.expectedD1[0];
    expect(expected.allowedEvidenceOptions.map((item) => item.excerpt)).toEqual([
      'Confirmo que hay PRM',
      'Confirmo que hay PRM.',
    ]);

    for (const excerpt of ['Confirmo que hay PRM', 'Confirmo que hay PRM.']) {
      const fake = fakeFactory({
        d1Result: (fixture, request) => {
          const value = d1ProviderResult(fixture, request);
          const result = value.results[0] as any;
          result.supportingEvidence = [{ ...result.supportingEvidence[0], excerpt }];
          return value;
        },
      });
      const summary = await runPharmaceuticalD3FixtureV1(smoke, 1, fake.factory);
      expect(summary.decision).toBe('ACCEPT');
    }
  });

  it('rejects adjacent irrelevant discourse while preserving exact comparison', async () => {
    const extraDiscourse = 'Confirmo que hay PRM. Muchas gracias, seguimos.';
    const smoke = pharmaceuticalD3FixtureV1('SMOKE');
    expect(smoke.expectedD1[0].allowedEvidenceOptions.map((item) => item.excerpt))
      .not.toContain(extraDiscourse);
    const nonLiteral = fakeFactory({
      d1Result: (fixture, request) => {
        const value = d1ProviderResult(fixture, request);
        const result = value.results[0] as any;
        result.supportingEvidence = [{ ...result.supportingEvidence[0], excerpt: extraDiscourse }];
        return value;
      },
    });
    expect((await runPharmaceuticalD3FixtureV1(smoke, 1, nonLiteral.factory)).decision)
      .not.toBe('ACCEPT');

    const c1 = pharmaceuticalD3FixtureV1('C1');
    const literalButOverbroad = fakeFactory({
      d1Result: (fixture, request) => {
        const value = d1ProviderResult(fixture, request);
        const result = value.results[0] as any;
        const messageRef = result.supportingEvidence[0].messageRef;
        const candidate = request.targets[0].studentCandidates.find(
          (item) => item.messageRef === messageRef,
        )!;
        result.supportingEvidence = [{
          ...result.supportingEvidence[0],
          excerpt: candidate.untrustedContent,
        }];
        return value;
      },
    });
    const summary = await runPharmaceuticalD3FixtureV1(c1, 1, literalButOverbroad.factory);
    expect(summary).toMatchObject({
      decision: 'REJECT',
      failure: { code: 'EXPECTATION_MISMATCH', path: 'd1.adjudications[0].evidence' },
    });
  });

  it('documents every structural evidence kind and the opaque-taxonomy limitation', () => {
    expect(JSON.stringify(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.fixtures)).toContain('student-only evidence');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.limitations.join(' ')).toContain('NEEDS_TEACHER_DECISION');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.limitations.join(' ')).toContain('conceptId');
    expect(Object.keys(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.evidenceKindDefinitions)).toEqual([
      'STUDENT_QUESTION', 'STUDENT_INTERPRETATION', 'STUDENT_DECISION', 'STUDENT_ACTION',
    ]);
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.evidenceKindDefinitions.STUDENT_ACTION)
      .toContain('allowlisted');
  });

  it('pre-registers C2 semantic uncertainty, semantic absence and three non-duplication families', () => {
    const c2 = pharmaceuticalD3FixtureV1('C2');
    expect(c2.expectedD1.map((item) => [item.aspect, item.verdict])).toEqual(expect.arrayContaining([
      ['ADHERENCE_STATUS', 'UNCERTAIN'],
      ['REPORT_STATUS', 'NOT_DEMONSTRATED'],
      ['PRM_CLASSIFICATION', 'INCORRECT_OR_CONTRADICTED'],
      ['ADHERENCE_TYPE', 'INCORRECT_OR_CONTRADICTED'],
      ['REFERRAL_URGENCY', 'INCORRECT_OR_CONTRADICTED'],
    ]));
    expect(c2.expectedD2).toEqual([]);
  });

  it('pre-registers D2 speech-act boundaries and exact UTF-16 spans', () => {
    const c3 = pharmaceuticalD3FixtureV1('C3');
    expect(c3.expectedD2.map((finding) => finding.claimForm).sort()).toEqual([
      'ASSERTION', 'ASSERTION', 'CONCLUSION', 'RECOMMENDATION',
    ]);
    for (const finding of c3.expectedD2) {
      const message = c3.context.targets[0].studentCandidates.find(
        (candidate) => candidate.messageRef === finding.messageRef,
      )!;
      expect(message.untrustedContent.slice(finding.excerptStart, finding.excerptEnd))
        .toBe(finding.excerpt);
    }
  });

  it('keeps structural zero-candidate shells entirely offline', async () => {
    const fake = fakeFactory();
    const summary = await runPharmaceuticalD3FixtureV1(
      pharmaceuticalD3FixtureV1('Z0'), 1, fake.factory,
    );
    expect(summary).toMatchObject({ decision: 'ACCEPT', calls: { d1: 0, d2: 0, total: 0 } });
    expect(fake.d1Calls).not.toHaveBeenCalled();
    expect(fake.d2Calls).not.toHaveBeenCalled();
  });
});

describe('M6-D3A acceptance runner hardening', () => {
  it('accepts exact mocked semantic outputs and produces allowlisted summaries', async () => {
    const fake = fakeFactory();
    const summary = await runPharmaceuticalD3FixtureV1(
      pharmaceuticalD3FixtureV1('C1'), 1, fake.factory,
    );
    expect(summary.decision).toBe('ACCEPT');
    expect(summary.calls).toEqual({ d1: 5, d2: 1, total: 6 });
    expect(JSON.stringify(summary)).not.toMatch(/raw|prompt|untrustedContent|patientRuntime|clinicalContext/);
  });

  it('stops globally after the first semantic mismatch', async () => {
    const fake = fakeFactory({
      d1Result: (fixture, request) => {
        const value = d1ProviderResult(fixture, request);
        value.results[0] = {
          targetRef: request.targets[0].targetRef,
          verdict: 'NOT_DEMONSTRATED',
          evidence: [],
        };
        return value;
      },
    });
    const result = await runPharmaceuticalD3AcceptanceV1(fake.factory);
    expect(result).toMatchObject({ decision: 'REJECT' });
    expect(result.summaries).toHaveLength(1);
    expect(fake.d1Calls).toHaveBeenCalledTimes(1);
    expect(fake.d2Calls).not.toHaveBeenCalled();
  });

  it('stops as inconclusive for an observed response model different from exact gpt-5.6-sol', async () => {
    const fake = fakeFactory({ responseModel: 'gpt-5.6-sol-aliased' });
    const summary = await runPharmaceuticalD3FixtureV1(
      pharmaceuticalD3FixtureV1('SMOKE'), 1, fake.factory,
    );
    expect(summary).toMatchObject({
      decision: 'INCONCLUSIVE', failure: { code: 'WRONG_RESPONSE_MODEL', path: 'responseModel' },
    });
    expect(fake.d1Calls).toHaveBeenCalledTimes(1);
    expect(fake.d2Calls).not.toHaveBeenCalled();
  });

  it('classifies a provider failure as INCONCLUSIVE and never retries or continues', async () => {
    const fake = fakeFactory({ d1Error: new Error('synthetic provider outage') });
    const result = await runPharmaceuticalD3AcceptanceV1(fake.factory);
    expect(result.decision).toBe('INCONCLUSIVE');
    expect(result.summaries).toHaveLength(1);
    expect(fake.d1Calls).toHaveBeenCalledTimes(1);
    expect(fake.d2Calls).not.toHaveBeenCalled();
  });

  it.each([
    ['missing target', (fixture: PharmaceuticalD3LiveFixtureV1, request: PharmaceuticalD1SemanticBatchRequestV2) => {
      const value = d1ProviderResult(fixture, request); value.results.pop(); return value;
    }],
    ['unexpected target', (fixture: PharmaceuticalD3LiveFixtureV1, request: PharmaceuticalD1SemanticBatchRequestV2) => {
      const value = d1ProviderResult(fixture, request); value.results.push({ ...value.results[0], targetRef: `pharm_target_${'f'.repeat(64)}` as never }); return value;
    }],
    ['patient evidence', (fixture: PharmaceuticalD3LiveFixtureV1, request: PharmaceuticalD1SemanticBatchRequestV2) => {
      const value = d1ProviderResult(fixture, request); const result = value.results[0] as any;
      result.supportingEvidence[0].messageRef = '2'; return value;
    }],
    ['unknown evidence kind', (fixture: PharmaceuticalD3LiveFixtureV1, request: PharmaceuticalD1SemanticBatchRequestV2) => {
      const value = d1ProviderResult(fixture, request); const result = value.results[0] as any;
      result.supportingEvidence[0].evidenceKind = 'INVENTED'; return value;
    }],
    ['bad excerpt', (fixture: PharmaceuticalD3LiveFixtureV1, request: PharmaceuticalD1SemanticBatchRequestV2) => {
      const value = d1ProviderResult(fixture, request); const result = value.results[0] as any;
      result.supportingEvidence[0].excerpt = 'not literal'; return value;
    }],
  ])('propagates D1 authority failure to an immediate stop: %s', async (_label, mutate) => {
    const fake = fakeFactory({ d1Result: mutate });
    const summary = await runPharmaceuticalD3FixtureV1(
      pharmaceuticalD3FixtureV1('SMOKE'), 1, fake.factory,
    );
    expect(summary.decision).toBe('INCONCLUSIVE');
    expect(fake.d1Calls).toHaveBeenCalledTimes(1);
    expect(fake.d2Calls).not.toHaveBeenCalled();
  });

  it.each([
    ['bad occurrence', (findings: any[]) => { findings[0].occurrenceIndex = 99; }],
    ['fake clinical ref', (findings: any[]) => { findings[0].relatedClinicalRefs = [{ kind: 'CONCLUSION', conclusionRef: 'conclusion_d3000000-0000-4000-8000-999999999999' }]; }],
    ['duplicate finding', (findings: any[]) => { findings.push(structuredClone(findings[0])); }],
  ])('propagates D2 authority failure to an immediate stop: %s', async (_label, mutate) => {
    const fake = fakeFactory({
      d2Result: (fixture, request) => {
        const value = d2ProviderResult(fixture, request); mutate(value.findings as any[]); return value;
      },
    });
    const summary = await runPharmaceuticalD3FixtureV1(
      pharmaceuticalD3FixtureV1('C3'), 1, fake.factory,
    );
    expect(summary.decision).toBe('INCONCLUSIVE');
    expect(fake.d2Calls).toHaveBeenCalledTimes(1);
  });

  it('keeps live disabled without the exact flag and validates frozen selection only', () => {
    expect(isPharmaceuticalD3LiveEnabledV1({})).toBe(false);
    expect(isPharmaceuticalD3LiveEnabledV1({ RUN_PHARMACEUTICAL_D3_LIVE: '0' })).toBe(false);
    expect(isPharmaceuticalD3LiveEnabledV1({ RUN_PHARMACEUTICAL_D3_LIVE: '1' })).toBe(true);
    expect(parsePharmaceuticalD3LiveSelectionV1({
      PHARMACEUTICAL_D3_FIXTURE: 'C2', PHARMACEUTICAL_D3_RUN: '4',
    })).toEqual({ fixtureId: 'C2', run: 4 });
    expect(() => parsePharmaceuticalD3LiveSelectionV1({
      PHARMACEUTICAL_D3_FIXTURE: 'NEW_FIXTURE',
    })).toThrow();
    expect(() => parsePharmaceuticalD3LiveSelectionV1({
      PHARMACEUTICAL_D3_RUN: '2',
    })).toThrow(/requires PHARMACEUTICAL_D3_FIXTURE/);

    const liveSource = readFileSync(
      resolve(process.cwd(), 'tests/live/pharmaceutical-d1-d2-semantic-live.test.ts'),
      'utf8',
    );
    expect(liveSource).toContain('describe.skipIf(!liveEnabled)');
    expect(liveSource).not.toMatch(/^import .*openai-pharmaceutical-d[12]-semantic-runtime/m);
    expect(liveSource).not.toContain('OPENAI_API_KEY');
    expect(liveSource.indexOf("import('../../lib/cases/v2/openai-pharmaceutical-d1-semantic-runtime')"))
      .toBeGreaterThan(liveSource.indexOf("it('executes only the frozen matrix"));
  });

  it('builds a deterministic safe evidence artifact without raw provider data', async () => {
    const summary = await runPharmaceuticalD3FixtureV1(
      pharmaceuticalD3FixtureV1('SMOKE'), 1, fakeFactory().factory,
    );
    const artifact = buildPharmaceuticalD3EvidenceArtifactV1('a'.repeat(40), [summary], 'ACCEPT');
    expect(artifact).toContain(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.fingerprint.value);
    expect(artifact).toContain('pharmaceutical-d1-adjudication-prompt/3');
    expect(artifact).not.toMatch(/raw provider output|API key/i);
    expect(buildPharmaceuticalD3EvidenceArtifactV1('a'.repeat(40), [summary], 'ACCEPT'))
      .toBe(artifact);
  });
});
