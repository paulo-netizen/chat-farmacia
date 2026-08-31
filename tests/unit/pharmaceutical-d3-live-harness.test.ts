import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import {
  executeOpenAiPharmaceuticalD1SemanticBatchV1,
  type OpenAiPharmaceuticalD1SemanticClientV1,
} from '../../lib/cases/v2/execute-openai-pharmaceutical-d1-semantic-adjudication';

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
import { validateSessionMessageIdV2 } from '../../lib/cases/v2/spfa-session-transcript';
import {
  buildPharmaceuticalD3EvidenceArtifactV1,
  calculatePharmaceuticalD3CallBudgetV1,
  isPharmaceuticalD3LiveEnabledV1,
  parsePharmaceuticalD3LiveSelectionV1,
  pharmaceuticalD3FixtureV1,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V1,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V2,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V3,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V4,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V5,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V6,
  PHARMACEUTICAL_D3_CANDIDATE_REGISTRATION_V7,
  PHARMACEUTICAL_D3_LIVE_EXECUTION_ORDER_V1,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V2,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V3,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V4,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V5,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V6,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V7,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V8,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V7,
  PHARMACEUTICAL_D3_CANDIDATE_REGISTRATION_V8,
  runPharmaceuticalD3AcceptanceV3,
  runPharmaceuticalD3AcceptanceV2,
  validatePharmaceuticalD3ModelSelectionV7,
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
  alternativeByMessageRef: Readonly<Record<string, number>> = {},
) {
  return {
    schemaVersion: '2.0',
    contractVersion: 'pharmaceutical-d2-provider-result/2',
    findings: fixture.expectedD2.map((finding) => {
      const alternative = 'expectationVersion' in finding
        ? finding.canonicalAlternatives[alternativeByMessageRef[finding.messageRef] ?? 0]
        : finding;
      if (alternative === undefined) {
        throw new Error(`missing D2 canonical alternative ${finding.messageRef}`);
      }
      const message = request.studentMessages.messages.find(
        (candidate) => candidate.messageRef === finding.messageRef,
      );
      if (message === undefined) throw new Error(`missing D2 message ${finding.messageRef}`);
      const occurrences: number[] = [];
      let fromIndex = 0;
      while (fromIndex <= message.untrustedContent.length - alternative.excerpt.length) {
        const found = message.untrustedContent.indexOf(alternative.excerpt, fromIndex);
        if (found < 0) break;
        occurrences.push(found);
        fromIndex = found + 1;
      }
      const occurrenceIndex = occurrences.indexOf(alternative.excerptStart);
      if (occurrenceIndex < 0) throw new Error(`missing D2 occurrence ${finding.messageRef}`);
      return {
        messageRef: finding.messageRef,
        excerpt: alternative.excerpt,
        occurrenceIndex,
        domain: finding.domain,
        findingType: finding.findingType,
        claimForm: finding.claimForm,
        relatedClinicalRefs: structuredClone(alternative.relatedClinicalRefs),
      };
    }),
  };
}

function d2CanonicalAlternatives(
  finding: PharmaceuticalD3LiveFixtureV1['expectedD2'][number],
) {
  return 'expectationVersion' in finding
    ? finding.canonicalAlternatives
    : [finding];
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

describe('M6-D3R16 isolated relationship representation', () => {
  const terra = { d1: 'gpt-5.6-terra', d2: 'gpt-5.6-terra' } as const;

  it('freezes matrix /8 without changing any material except matrix identity and D2 request version', () => {
    const { fingerprint, matrixVersion, contractVersions, ...v8 } = PHARMACEUTICAL_D3_LIVE_MATRIX_V8;
    const { fingerprint: _oldHash, matrixVersion: _oldVersion, contractVersions: oldContracts, ...v7 } = PHARMACEUTICAL_D3_LIVE_MATRIX_V7;
    expect(matrixVersion).toBe('pharmaceutical-d3-live-matrix/8');
    expect(fingerprint).toEqual({ algorithm: 'sha256', canonicalization: 'pharmaceutical-d3-live-matrix-v8/1', value: '18d8de2f85bbe40b9bd9389f87ebeb4d95a1b4861385fd62635ea32dc850e486' });
    expect(v8).toEqual(v7);
    expect(contractVersions).toEqual({ ...oldContracts, d2Request: 'pharmaceutical-d2-semantic-request/2' });
    expect(oldContracts.d2Request).toBe('pharmaceutical-d2-semantic-request/1');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V8.fixtures).toBe(PHARMACEUTICAL_D3_LIVE_MATRIX_V7.fixtures);
    expect(Object.isFrozen(PHARMACEUTICAL_D3_LIVE_MATRIX_V8)).toBe(true);
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V8.promptVersions).toEqual({ d1: 'pharmaceutical-d1-adjudication-prompt/3', d2: 'pharmaceutical-d2-claim-prompt/3' });
  });

  it('preserves histories /1-/7 including the two model-specific rejections', () => {
    const histories = [PHARMACEUTICAL_D3_HISTORICAL_RESULT_V1, PHARMACEUTICAL_D3_HISTORICAL_RESULT_V2,
      PHARMACEUTICAL_D3_HISTORICAL_RESULT_V3, PHARMACEUTICAL_D3_HISTORICAL_RESULT_V4,
      PHARMACEUTICAL_D3_HISTORICAL_RESULT_V5, PHARMACEUTICAL_D3_HISTORICAL_RESULT_V6,
      PHARMACEUTICAL_D3_HISTORICAL_RESULT_V7];
    expect(histories.map((item) => item.decision)).toEqual(['REJECT', 'INCONCLUSIVE', 'INCONCLUSIVE', 'REJECT', 'REJECT', 'REJECT', 'REJECT']);
    expect(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V7).toMatchObject({ model: terra.d2,
      matrixFingerprint: '9194a30c2b7574e000d87571166d4d42384200b908654e7e048fc180188cfab9' });
    expect(PHARMACEUTICAL_D3_CANDIDATE_REGISTRATION_V8).toMatchObject({ status: 'PENDING LIVE ACCEPTANCE', model: terra.d1, modelPolicyVersion: 'pharmaceutical-semantic-model-policy/1' });
  });

  it('retains repetitions, zero-call fixture, execution order and the 82-call budget', () => {
    expect(calculatePharmaceuticalD3CallBudgetV1(PHARMACEUTICAL_D3_LIVE_MATRIX_V8))
      .toEqual(calculatePharmaceuticalD3CallBudgetV1(PHARMACEUTICAL_D3_LIVE_MATRIX_V7));
    expect(calculatePharmaceuticalD3CallBudgetV1(PHARMACEUTICAL_D3_LIVE_MATRIX_V8)).toMatchObject({ d1: 61, d2: 21, total: 82 });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V8.fixtures.map((item) => [item.fixtureId, item.repetitions]))
      .toEqual(PHARMACEUTICAL_D3_LIVE_MATRIX_V7.fixtures.map((item) => [item.fixtureId, item.repetitions]));
  });

  it('executes /7 as /1 and /8 as /2 while preserving all old request material and findings', async () => {
    const requests7: PharmaceuticalD2SemanticRequestV2[] = [];
    const requests8: PharmaceuticalD2SemanticRequestV2[] = [];
    const d1Requests7: PharmaceuticalD1SemanticBatchRequestV2[] = [];
    const d1Requests8: PharmaceuticalD1SemanticBatchRequestV2[] = [];
    function factory(requests: PharmaceuticalD2SemanticRequestV2[], d1: PharmaceuticalD1SemanticBatchRequestV2[]) {
      return fakeFactory({ responseModel: terra.d1,
        d1Result: (fixture, request) => { d1.push(request); return d1ProviderResult(fixture, request); },
        d2Result: (fixture, request) => { requests.push(request); return d2ProviderResult(fixture, request); },
      });
    }
    const old = factory(requests7, d1Requests7);
    const current = factory(requests8, d1Requests8);
    const result7 = await runPharmaceuticalD3AcceptanceV2(old.factory, terra);
    const result8 = await runPharmaceuticalD3AcceptanceV3(current.factory, terra);
    expect(result7.decision).toBe('ACCEPT');
    expect(result8.decision).toBe('ACCEPT');
    expect(current.d1Calls).toHaveBeenCalledTimes(61);
    expect(current.d2Calls).toHaveBeenCalledTimes(21);
    expect(d1Requests8).toEqual(d1Requests7);
    expect(requests8).toHaveLength(requests7.length);
    requests8.forEach((request, index) => {
      if (request.contractVersion !== 'pharmaceutical-d2-semantic-request/2') throw new Error('expected /2');
      const previous = requests7[index];
      expect(previous.contractVersion).toBe('pharmaceutical-d2-semantic-request/1');
      const { relationships, ...authorityProjection } = request.authorityProjection;
      expect(Array.isArray(relationships)).toBe(true);
      expect({ ...request, authorityProjection, contractVersion: previous.contractVersion, requestFingerprint: previous.requestFingerprint }).toEqual(previous);
      expect(request.requestFingerprint.value).not.toBe(previous.requestFingerprint.value);
    });
    expect(result8.summaries.map((item) => [item.d1, item.d2])).toEqual(result7.summaries.map((item) => [item.d1, item.d2]));
    const artifact = buildPharmaceuticalD3EvidenceArtifactV1('a'.repeat(40), result8.summaries, result8.decision, PHARMACEUTICAL_D3_LIVE_MATRIX_V8);
    expect(artifact).toContain('pharmaceutical-d2-semantic-request/2');
    expect(artifact).toContain(PHARMACEUTICAL_D3_LIVE_MATRIX_V8.fingerprint.value);
  });

  it('keeps omission of C3 ref 7 a stop-early rejection under /8', async () => {
    const fake = fakeFactory({ responseModel: terra.d2, d2Result: (fixture, request) => {
      const result = d2ProviderResult(fixture, request);
      return fixture.fixtureId === 'C3' ? { ...result, findings: result.findings.filter((item) => item.messageRef !== '7') } : result;
    } });
    const result = await runPharmaceuticalD3AcceptanceV3(fake.factory, terra);
    expect(result.decision).toBe('REJECT');
    expect(result.summaries.map((item) => [item.fixtureId, item.run])).toEqual([['SMOKE', 1], ['C3', 1]]);
    expect(fake.d1Calls).toHaveBeenCalledTimes(1);
    expect(fake.d2Calls).toHaveBeenCalledTimes(2);
  });

  it('retains fail-closed model preflight before runtime construction under /8', async () => {
    const fake = fakeFactory();
    await expect(runPharmaceuticalD3AcceptanceV3(fake.factory, { d1: 'gpt-5.6-sol', d2: terra.d2 })).rejects.toThrow();
    expect(fake.d1Calls).not.toHaveBeenCalled();
    expect(fake.d2Calls).not.toHaveBeenCalled();
  });
});

describe('M6-D3R14 explicit experimental candidate', () => {
  const terra = { d1: 'gpt-5.6-terra', d2: 'gpt-5.6-terra' } as const;

  function stable(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stable);
    if (typeof value !== 'object' || value === null) return value;
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, stable(item)]));
  }

  it.each([
    PHARMACEUTICAL_D3_LIVE_MATRIX_V2, PHARMACEUTICAL_D3_LIVE_MATRIX_V3,
    PHARMACEUTICAL_D3_LIVE_MATRIX_V4, PHARMACEUTICAL_D3_LIVE_MATRIX_V5,
    PHARMACEUTICAL_D3_LIVE_MATRIX_V6, PHARMACEUTICAL_D3_LIVE_MATRIX_V7,
  ])('recalculates the frozen fingerprint of $matrixVersion', (matrix) => {
    const { fingerprint, ...core } = matrix;
    expect(createHash('sha256').update(JSON.stringify(stable(core))).digest('hex'))
      .toBe(fingerprint.value);
    expect(matrix.model).toBe(matrix === PHARMACEUTICAL_D3_LIVE_MATRIX_V7 ? terra.d1 : 'gpt-5.6-sol');
  });

  it('freezes Terra matrix /7 and its separate model-policy registration', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V7.matrixVersion).toBe('pharmaceutical-d3-live-matrix/7');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V7.fingerprint.value)
      .toBe('9194a30c2b7574e000d87571166d4d42384200b908654e7e048fc180188cfab9');
    expect(PHARMACEUTICAL_D3_CANDIDATE_REGISTRATION_V7).toMatchObject({
      modelPolicyVersion: 'pharmaceutical-semantic-model-policy/1',
      model: terra.d1,
      disposition: 'AUTHORIZED_AS_EXPERIMENTAL_M6_D3_CANDIDATE',
      status: 'PENDING LIVE ACCEPTANCE',
    });
    expect(Object.isFrozen(PHARMACEUTICAL_D3_LIVE_MATRIX_V7)).toBe(true);
    expect(Object.isFrozen(PHARMACEUTICAL_D3_CANDIDATE_REGISTRATION_V7)).toBe(true);
  });

  it('preserves /6 Sol rejection without globally disallowing Sol', () => {
    expect(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V6).toEqual({
      matrixVersion: 'pharmaceutical-d3-live-matrix/6',
      matrixFingerprint: '1b3f458a20c1c6bafe2e6fe122761de3ef365fc5add1fee488c4eea2f4005c8f',
      model: 'gpt-5.6-sol', decision: 'REJECT', fixtureId: 'C3', run: 1,
      failure: { code: 'MODEL_SEMANTIC_FAILURE', missingMessageRef: '7' },
      disposition: 'REJECTED_FOR_M6_D3_MATRIX_6',
      globalDisposition: 'NOT_GLOBALLY_DISALLOWED',
    });
    expect(Object.isFrozen(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V6.failure)).toBe(true);
  });

  it('changes only matrix identity and candidate, retaining the same frozen semantic material', () => {
    const { matrixVersion: _v6, fingerprint: _f6, model: _m6, ...material6 } = PHARMACEUTICAL_D3_LIVE_MATRIX_V6;
    const { matrixVersion: _v7, fingerprint: _f7, model: _m7, ...material7 } = PHARMACEUTICAL_D3_LIVE_MATRIX_V7;
    expect(material7).toEqual(material6);
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V7.fixtures).toBe(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.fixtures);
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V7.contractVersions.d2Expectation)
      .toBe('pharmaceutical-d3-d2-expectation/2');
    const c3 = PHARMACEUTICAL_D3_LIVE_MATRIX_V7.fixtures.find((fixture) => fixture.fixtureId === 'C3');
    expect(c3?.expectedD2.map((finding) => finding.messageRef)).toEqual(['2', '7', '8', '9', '11']);
    expect(c3?.expectedD2.find((finding) => finding.messageRef === '7')).toMatchObject({
      domain: 'ADHERENCE', findingType: 'CONTRADICTORY', claimForm: 'ASSERTION',
    });
    expect(calculatePharmaceuticalD3CallBudgetV1(PHARMACEUTICAL_D3_LIVE_MATRIX_V7))
      .toEqual(calculatePharmaceuticalD3CallBudgetV1(PHARMACEUTICAL_D3_LIVE_MATRIX_V6));
  });

  it.each([
    [undefined, undefined], ['gpt-5.6-sol', 'gpt-5.6-sol'],
    ['gpt-5.6-sol', terra.d2], [terra.d1, 'gpt-5.6-sol'],
    [undefined, terra.d2], [terra.d1, undefined],
    ['terra', terra.d2], [terra.d1, 'gpt-5.6-terra-observed'],
    [' gpt-5.6-terra', terra.d2], [terra.d1, 'gpt-5.6-terra '],
  ])('fails preflight for configured D1=%j D2=%j before any runtime is created', async (d1, d2) => {
    const fake = fakeFactory({ responseModel: terra.d1 });
    const createD1 = vi.spyOn(fake.factory, 'createD1Runtime');
    const createD2 = vi.spyOn(fake.factory, 'createD2Runtime');
    await expect(runPharmaceuticalD3AcceptanceV2(fake.factory, { d1, d2 }))
      .rejects.toThrow('explicit matching D1/D2 candidate');
    expect(createD1).not.toHaveBeenCalled();
    expect(createD2).not.toHaveBeenCalled();
    expect(fake.d1Calls).not.toHaveBeenCalled();
    expect(fake.d2Calls).not.toHaveBeenCalled();
  });

  it('accepts explicit matching Terra without retaining mutable configuration', () => {
    const configured = { ...terra };
    const checked = validatePharmaceuticalD3ModelSelectionV7(configured);
    expect(checked).toEqual(terra);
    expect(checked).not.toBe(configured);
    expect(Object.isFrozen(checked)).toBe(true);
  });

  it('runs the unchanged full gate offline with exact Terra receipts and identical request/result identities', async () => {
    const sol = await runPharmaceuticalD3AcceptanceV1(fakeFactory().factory);
    const fake = fakeFactory({ responseModel: terra.d1 });
    const result = await runPharmaceuticalD3AcceptanceV2(fake.factory, terra);
    expect(result.decision).toBe('ACCEPT');
    expect(result.summaries).toHaveLength(26);
    expect(fake.d1Calls).toHaveBeenCalledTimes(61);
    expect(fake.d2Calls).toHaveBeenCalledTimes(21);
    result.summaries.forEach((summary, index) => {
      expect(summary.requestedModel).toBe(terra.d1);
      expect(summary.responseModels.every((model) => model === terra.d1)).toBe(true);
      expect(summary.requestFingerprints).toEqual(sol.summaries[index].requestFingerprints);
      expect(summary.d1).toEqual(sol.summaries[index].d1);
      expect(summary.d2).toEqual(sol.summaries[index].d2);
    });
    const artifact = buildPharmaceuticalD3EvidenceArtifactV1(
      'a'.repeat(40), result.summaries, result.decision, PHARMACEUTICAL_D3_LIVE_MATRIX_V7,
    );
    expect(artifact).toContain(PHARMACEUTICAL_D3_LIVE_MATRIX_V7.fingerprint.value);
    expect(artifact).toContain('pharmaceutical-semantic-model-policy/1');
    expect(artifact).toContain(terra.d1);
    expect(artifact).not.toContain('gpt-5.6-sol');
  });

  it.each(['gpt-5.6-sol', 'gpt-5.6-terra-observed'])('stops on responseModel %s without aliasing or fallback', async (responseModel) => {
    const fake = fakeFactory({ responseModel });
    const result = await runPharmaceuticalD3AcceptanceV2(fake.factory, terra);
    expect(result.decision).toBe('INCONCLUSIVE');
    expect(result.summaries).toHaveLength(1);
    expect(result.summaries[0].requestedModel).toBe(terra.d1);
    expect(result.summaries[0].failure?.code).toBe('WRONG_RESPONSE_MODEL');
    expect(fake.d1Calls).toHaveBeenCalledTimes(1);
    expect(fake.d2Calls).not.toHaveBeenCalled();
  });

  it('rejects a missing mandatory C3 ref 7 immediately without continuing or weakening the gate', async () => {
    const fake = fakeFactory({
      responseModel: terra.d1,
      d2Result: (fixture, request) => {
        const result = d2ProviderResult(fixture, request);
        return { ...result, findings: result.findings.filter((finding) => finding.messageRef !== '7') };
      },
    });
    const result = await runPharmaceuticalD3AcceptanceV2(fake.factory, terra);
    expect(result.decision).toBe('REJECT');
    expect(result.summaries.map((summary) => [summary.fixtureId, summary.run, summary.decision]))
      .toEqual([['SMOKE', 1, 'ACCEPT'], ['C3', 1, 'REJECT']]);
    expect(fake.d1Calls).toHaveBeenCalledTimes(1);
    expect(fake.d2Calls).toHaveBeenCalledTimes(2);
  });

  it('keeps live activation explicit and preflights the captured environment before runtime imports', () => {
    const source = readFileSync(resolve(process.cwd(), 'tests/live/pharmaceutical-d1-d2-semantic-live.test.ts'), 'utf8');
    expect(source).toContain('describe.skipIf(!liveEnabled)');
    expect(source).toContain('Object.freeze({ ...process.env })');
    expect(source.indexOf('const configuredModels = validatePharmaceuticalD3ModelSelectionV8')).toBeGreaterThan(0);
    expect(source.indexOf('const configuredModels = validatePharmaceuticalD3ModelSelectionV8'))
      .toBeLessThan(source.indexOf("import('../../lib/cases/v2/openai-pharmaceutical-d1-semantic-runtime')"));
    expect(source).toContain('PHARMACEUTICAL_D3_LIVE_MATRIX_V8');
    expect(source).toContain('runPharmaceuticalD3AcceptanceV3');
    expect(source).not.toContain('runPharmaceuticalD3AcceptanceV1');
  });
});

describe('M6-D3R10 pre-registered matrix', () => {
  it('freezes the explicit matrix identity, prompt versions and SHA-256 fingerprint', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.matrixVersion).toBe('pharmaceutical-d3-live-matrix/6');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.promptVersions).toEqual({
      d1: 'pharmaceutical-d1-adjudication-prompt/3',
      d2: 'pharmaceutical-d2-claim-prompt/3',
    });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.contractVersions.d2ProviderResult)
      .toBe('pharmaceutical-d2-provider-result/2');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.contractVersions.d2Expectation)
      .toBe('pharmaceutical-d3-d2-expectation/2');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.fingerprint).toEqual({
      algorithm: 'sha256',
      canonicalization: 'pharmaceutical-d3-live-matrix-v6/1',
      value: '1b3f458a20c1c6bafe2e6fe122761de3ef365fc5add1fee488c4eea2f4005c8f',
    });
    expect(Object.isFrozen(PHARMACEUTICAL_D3_LIVE_MATRIX_V6)).toBe(true);
    expect(Object.isFrozen(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.fixtures[0].expectedCallsPerRun))
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

  it('preserves the rejected matrix /4 identity and historical outcome unchanged', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.fingerprint).toEqual({
      algorithm: 'sha256',
      canonicalization: 'pharmaceutical-d3-live-matrix-v4/1',
      value: '700e3f64fecdba431fe3da72accc65a10cfaf9d17bdad3d257519814ef6a3608',
    });
    expect(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V4).toEqual({
      matrixVersion: 'pharmaceutical-d3-live-matrix/4',
      matrixFingerprint: '700e3f64fecdba431fe3da72accc65a10cfaf9d17bdad3d257519814ef6a3608',
      decision: 'REJECT',
      fixtureId: 'C3',
      run: 1,
      failure: { code: 'EXPECTATION_MISMATCH', path: 'd2.findings' },
    });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V4.fixtures.find(
      (fixture) => fixture.fixtureId === 'C3',
    )?.expectedD2.map((finding) => finding.messageRef)).toEqual(['7', '8', '9', '11']);
  });

  it('preserves the rejected matrix /5 identity and historical outcome unchanged', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V5.fingerprint).toEqual({
      algorithm: 'sha256',
      canonicalization: 'pharmaceutical-d3-live-matrix-v5/1',
      value: '2867bf53d721a77638a813d8d6efe3cadd58c88a3bf0908ec3733d5488ba8c72',
    });
    expect(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V5).toEqual({
      matrixVersion: 'pharmaceutical-d3-live-matrix/5',
      matrixFingerprint: '2867bf53d721a77638a813d8d6efe3cadd58c88a3bf0908ec3733d5488ba8c72',
      decision: 'REJECT',
      fixtureId: 'C3',
      run: 1,
      failure: { code: 'EXPECTATION_MISMATCH', path: 'd2.findings' },
    });
  });

  it('contains exactly the seven pre-registered fixture classes', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.fixtures.map((fixture) => fixture.fixtureId))
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
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.repetitions).toEqual({ smoke: 1, semantic: 5 });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.threshold).toEqual({
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
    expect(JSON.stringify(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.fixtures)).toContain('student-only evidence');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.limitations.join(' ')).toContain('NEEDS_TEACHER_DECISION');
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.limitations.join(' ')).toContain('conceptId');
    expect(Object.keys(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.evidenceKindDefinitions)).toEqual([
      'STUDENT_QUESTION', 'STUDENT_INTERPRETATION', 'STUDENT_DECISION', 'STUDENT_ACTION',
    ]);
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.evidenceKindDefinitions.STUDENT_ACTION)
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
      'ASSERTION', 'ASSERTION', 'CONCLUSION', 'RECOMMENDATION', 'RECOMMENDATION',
    ]);
    for (const finding of c3.expectedD2) {
      expect('expectationVersion' in finding && finding.expectationVersion)
        .toBe('pharmaceutical-d3-d2-expectation/2');
      for (const alternative of d2CanonicalAlternatives(finding)) {
        const message = c3.context.targets[0].studentCandidates.find(
          (candidate) => candidate.messageRef === finding.messageRef,
        )!;
        expect(message.untrustedContent.slice(alternative.excerptStart, alternative.excerptEnd))
          .toBe(alternative.excerpt);
      }
    }
  });

  it('pre-registers only the audited complete alternatives for C3 refs 2, 7 and 8', () => {
    const c3 = pharmaceuticalD3FixtureV1('C3');
    const byRef = new Map(c3.expectedD2.map((finding) => [finding.messageRef, finding]));
    expect(c3.expectedD2.map((finding) => [
      finding.messageRef,
      d2CanonicalAlternatives(finding).length,
    ])).toEqual([['2', 2], ['7', 2], ['8', 2], ['9', 1], ['11', 1]]);
    expect(d2CanonicalAlternatives(byRef.get(validateSessionMessageIdV2('7'))!)).toEqual([
      {
        excerpt: 'La barrera FORGETFULNESS corresponde al Medicamento A.',
        excerptStart: 0,
        excerptEnd: 54,
        relatedClinicalRefs: [
          { kind: 'CONCLUSION', conclusionRef: 'conclusion_d3000000-0000-4000-8000-000000000009' },
          { kind: 'MEDICATION', medicationRef: 'med_d3000000-0000-4000-8000-000000000001' },
        ],
      },
      {
        excerpt: 'La barrera FORGETFULNESS corresponde al Medicamento A.',
        excerptStart: 0,
        excerptEnd: 54,
        relatedClinicalRefs: [
          { kind: 'CONCLUSION', conclusionRef: 'conclusion_d3000000-0000-4000-8000-000000000009' },
          { kind: 'CONCLUSION', conclusionRef: 'conclusion_d3000000-0000-4000-8000-000000000015' },
          { kind: 'MEDICATION', medicationRef: 'med_d3000000-0000-4000-8000-000000000001' },
          { kind: 'MEDICATION', medicationRef: 'med_d3000000-0000-4000-8000-000000000003' },
        ],
      },
    ]);
    expect(d2CanonicalAlternatives(byRef.get(validateSessionMessageIdV2('8'))!)).toEqual([
      {
        excerpt: 'concluyo que existe una barrera de dificultad para tragar',
        excerptStart: 7,
        excerptEnd: 64,
        relatedClinicalRefs: [
          { kind: 'CONCLUSION', conclusionRef: 'conclusion_d3000000-0000-4000-8000-000000000009' },
        ],
      },
      {
        excerpt: 'Además concluyo que existe una barrera de dificultad para tragar.',
        excerptStart: 0,
        excerptEnd: 65,
        relatedClinicalRefs: [
          { kind: 'CONCLUSION', conclusionRef: 'conclusion_d3000000-0000-4000-8000-000000000008' },
          { kind: 'CONCLUSION', conclusionRef: 'conclusion_d3000000-0000-4000-8000-000000000009' },
        ],
      },
    ]);
  });

  it('keeps C3 suspension in D2 because nearby D1 coverage is only partial', () => {
    const c3 = pharmaceuticalD3FixtureV1('C3');
    const candidates = c3.context.targets[0].studentCandidates;
    expect(candidates.find((candidate) => candidate.messageRef === '2')?.untrustedContent)
      .toBe('Debe suspenderlo.');
    expect(candidates.find((candidate) => candidate.messageRef === '4')?.untrustedContent)
      .toBe('Hay que derivarlo.');
    expect(candidates.find((candidate) => candidate.messageRef === '6')?.untrustedContent)
      .toBe('Concluyo que no lo toma porque se le olvida.');

    const suspension = c3.expectedD2.find((finding) => finding.messageRef === '2');
    expect(suspension).toEqual(expect.objectContaining({
      domain: 'PROFESSIONAL_RESPONSE',
      findingType: 'UNSUPPORTED',
      claimForm: 'RECOMMENDATION',
    }));
    expect(suspension && d2CanonicalAlternatives(suspension)).toEqual([
      {
        excerpt: 'Debe suspenderlo.',
        excerptStart: 0,
        excerptEnd: 'Debe suspenderlo.'.length,
        relatedClinicalRefs: [],
      },
      {
        excerpt: 'Debe suspenderlo.',
        excerptStart: 0,
        excerptEnd: 'Debe suspenderlo.'.length,
        relatedClinicalRefs: [{
          kind: 'CONCLUSION',
          conclusionRef: 'conclusion_d3000000-0000-4000-8000-000000000013',
        }],
      },
    ]);
    const suspensionMessage = candidates.find((candidate) => candidate.messageRef === '2')!;
    const suspensionExcerpt = d2CanonicalAlternatives(suspension!)[0].excerpt;
    expect(suspensionMessage.untrustedContent.indexOf(suspensionExcerpt)).toBe(0);
    expect(suspensionMessage.untrustedContent.indexOf(suspensionExcerpt, 1)).toBe(-1);

    const nearbyD1 = c3.context.targets.filter((target) =>
      target.aspect === 'PROFESSIONAL_ACTION_CATEGORY'
      || target.aspect === 'INTERVENTION_TARGET');
    expect(nearbyD1).not.toHaveLength(0);
    expect(JSON.stringify(nearbyD1.map((target) => ({
      expected: target.expected,
      clinicalContext: target.clinicalContext,
    })))).not.toContain('suspender');

    expect(c3.context.targets.some((target) => target.aspect === 'REFERRAL_NEED')).toBe(true);
    expect(c3.context.targets.some((target) => target.aspect === 'ADHERENCE_TYPE')).toBe(true);
    expect(c3.context.targets.some((target) => target.aspect === 'BARRIER_CATEGORY')).toBe(true);

    expect(c3.expectedD2.map((finding) => finding.messageRef)).toEqual([
      '2', '7', '8', '9', '11',
    ]);
    expect(c3.expectedD2.find((finding) => finding.messageRef === '9')).toMatchObject({
      findingType: 'UNSUPPORTED', claimForm: 'RECOMMENDATION',
    });
    expect(c3.expectedD2.some((finding) => finding.messageRef === '4')).toBe(false);
    expect(c3.expectedD2.some((finding) => finding.messageRef === '6')).toBe(false);
  });

  it('reconstructs and accepts the complete five-finding C3 set canonically', async () => {
    const summary = await runPharmaceuticalD3FixtureV1(
      pharmaceuticalD3FixtureV1('C3'), 1, fakeFactory().factory,
    );
    expect(summary).toMatchObject({
      decision: 'ACCEPT',
      calls: { d1: 0, d2: 1, total: 1 },
    });
    expect(summary.d2.map((finding) => [finding.messageRef, finding.findingType])).toEqual([
      ['2', 'UNSUPPORTED'],
      ['7', 'CONTRADICTORY'],
      ['8', 'UNSUPPORTED'],
      ['9', 'UNSUPPORTED'],
      ['11', 'UNSUPPORTED'],
    ]);
    expect(new Set(summary.d2.map((finding) => finding.claimId))).toHaveProperty('size', 5);
  });

  it.each([
    ['ref 2 alternative A', '2', 0],
    ['ref 2 alternative B', '2', 1],
    ['ref 7 alternative A', '7', 0],
    ['ref 7 alternative B', '7', 1],
    ['ref 8 alternative A', '8', 0],
    ['ref 8 alternative B', '8', 1],
  ])('accepts the complete exact pre-registered D2 representation: %s', async (
    _label,
    messageRef,
    alternative,
  ) => {
    const fixture = pharmaceuticalD3FixtureV1('C3');
    const fake = fakeFactory({
      d2Result: (currentFixture, request) => d2ProviderResult(
        currentFixture,
        request,
        { [messageRef]: alternative },
      ),
    });
    const summary = await runPharmaceuticalD3FixtureV1(fixture, 1, fake.factory);
    expect(summary.decision).toBe('ACCEPT');
    expect(summary.d2.map((finding) => finding.messageRef)).toEqual(['2', '7', '8', '9', '11']);
  });

  it('keeps refs 9 and 11 on one exact canonical alternative each', () => {
    const c3 = pharmaceuticalD3FixtureV1('C3');
    for (const messageRef of ['9', '11']) {
      const finding = c3.expectedD2.find((item) => item.messageRef === messageRef)!;
      expect(d2CanonicalAlternatives(finding)).toHaveLength(1);
    }
  });

  it.each([
    ['additional finding', (findings: any[], fixture: PharmaceuticalD3LiveFixtureV1) => {
      const ref2 = fixture.expectedD2.find((item) => item.messageRef === '2')!;
      const second = d2CanonicalAlternatives(ref2)[1];
      findings.push({
        ...structuredClone(findings.find((item) => item.messageRef === '2')),
        excerpt: second.excerpt,
        occurrenceIndex: 0,
        relatedClinicalRefs: structuredClone(second.relatedClinicalRefs),
      });
    }],
    ['missing finding', (findings: any[]) => { findings.pop(); }],
    ['wrong domain', (findings: any[]) => { findings[0].domain = 'PRM'; }],
    ['wrong findingType', (findings: any[]) => { findings[0].findingType = 'CONTRADICTORY'; }],
    ['wrong claimForm', (findings: any[]) => { findings[0].claimForm = 'ASSERTION'; }],
    ['unregistered excerpt', (findings: any[]) => {
      const ref8 = findings.find((item) => item.messageRef === '8');
      ref8.excerpt = 'dificultad para tragar';
      ref8.occurrenceIndex = 0;
    }],
    ['unregistered span', (findings: any[]) => {
      const ref8 = findings.find((item) => item.messageRef === '8');
      ref8.excerpt = 'concluyo que existe una barrera de dificultad para tragar.';
      ref8.occurrenceIndex = 0;
    }],
    ['unregistered ref superset', (
      findings: any[],
      _fixture: PharmaceuticalD3LiveFixtureV1,
      request: PharmaceuticalD2SemanticRequestV2,
    ) => {
      const ref2 = findings.find((item) => item.messageRef === '2');
      const actionRef = request.authorityProjection.targets.find(
        (target) => target.aspect === 'PROFESSIONAL_ACTION_CATEGORY',
      )?.primaryClinicalRef;
      if (actionRef === undefined) throw new Error('missing action ref');
      const expected = _fixture.expectedD2.find((item) => item.messageRef === '2')!;
      ref2.relatedClinicalRefs = [
        ...structuredClone(d2CanonicalAlternatives(expected)[1].relatedClinicalRefs),
        structuredClone(actionRef),
      ];
    }],
    ['unregistered ref subset', (findings: any[], fixture: PharmaceuticalD3LiveFixtureV1) => {
      const ref7 = findings.find((item) => item.messageRef === '7');
      const expected = fixture.expectedD2.find((item) => item.messageRef === '7')!;
      const observedAlternative = d2CanonicalAlternatives(expected)[1];
      ref7.relatedClinicalRefs = structuredClone([
        observedAlternative.relatedClinicalRefs[0],
        observedAlternative.relatedClinicalRefs[1],
        observedAlternative.relatedClinicalRefs[2],
      ]);
    }],
    ['unregistered span/ref mixture', (findings: any[], fixture: PharmaceuticalD3LiveFixtureV1) => {
      const ref8 = findings.find((item) => item.messageRef === '8');
      const expected = fixture.expectedD2.find((item) => item.messageRef === '8')!;
      ref8.relatedClinicalRefs = structuredClone(
        d2CanonicalAlternatives(expected)[1].relatedClinicalRefs,
      );
    }],
    ['allowlisted but unregistered ref', (
      findings: any[],
      _fixture: PharmaceuticalD3LiveFixtureV1,
      request: PharmaceuticalD2SemanticRequestV2,
    ) => {
      const ref2 = findings.find((item) => item.messageRef === '2');
      const actionRef = request.authorityProjection.targets.find(
        (target) => target.aspect === 'PROFESSIONAL_ACTION_CATEGORY',
      )?.primaryClinicalRef;
      if (actionRef === undefined) throw new Error('missing action ref');
      ref2.relatedClinicalRefs = [structuredClone(actionRef)];
    }],
  ])('rejects D2 output outside the exact canonical alternatives: %s', async (
    _label,
    mutate,
  ) => {
    const fixture = pharmaceuticalD3FixtureV1('C3');
    const fake = fakeFactory({
      d2Result: (currentFixture, request) => {
        const value = d2ProviderResult(currentFixture, request);
        mutate(value.findings as any[], currentFixture, request);
        return value;
      },
    });
    const summary = await runPharmaceuticalD3FixtureV1(fixture, 1, fake.factory);
    expect(summary).toMatchObject({
      decision: 'REJECT',
      failure: { code: 'EXPECTATION_MISMATCH' },
    });
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

  it('rejects requested Sol with an observed Terra response without substitution, retry or fallback', async () => {
    const fake = fakeFactory();
    const parse = vi.fn();
    const observedReceipts: PharmaceuticalD1SemanticProviderReceiptV2[] = [];
    const factory: PharmaceuticalD3LiveRuntimeFactoryV1 = {
      ...fake.factory,
      createD1Runtime: (fixture) => ({
      adjudicateBatch: async (request) => {
        parse.mockResolvedValueOnce({
          status: 'completed',
          model: 'gpt-5.6-terra',
          output: [],
          output_parsed: d1ProviderResult(fixture, request),
        });
        const receipt = await executeOpenAiPharmaceuticalD1SemanticBatchV1(
          { responses: { parse } } as unknown as OpenAiPharmaceuticalD1SemanticClientV1,
          request,
          { model: 'gpt-5.6-sol', maxOutputTokens: 10_000, timeoutMs: 60_000 },
        );
        observedReceipts.push(receipt);
        return receipt;
      },
      }),
    };
    const result = await runPharmaceuticalD3AcceptanceV1(factory);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0][0].model).toBe('gpt-5.6-sol');
    expect(parse.mock.calls[0][1]).toEqual({ maxRetries: 0, timeout: 60_000 });
    expect(observedReceipts).toHaveLength(1);
    expect(observedReceipts[0].responseModel).toBe('gpt-5.6-terra');
    expect(result.decision).toBe('INCONCLUSIVE');
    expect(result.summaries).toHaveLength(1);
    expect(result.summaries[0]).toMatchObject({
      requestedModel: 'gpt-5.6-sol',
      failure: { code: 'WRONG_RESPONSE_MODEL', path: 'responseModel' },
      calls: { d1: 1, d2: 0, total: 1 },
    });
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
    expect(artifact).toContain(PHARMACEUTICAL_D3_LIVE_MATRIX_V6.fingerprint.value);
    expect(artifact).toContain('pharmaceutical-d1-adjudication-prompt/3');
    expect(artifact).not.toMatch(/raw provider output|API key/i);
    expect(buildPharmaceuticalD3EvidenceArtifactV1('a'.repeat(40), [summary], 'ACCEPT'))
      .toBe(artifact);
  });
});
