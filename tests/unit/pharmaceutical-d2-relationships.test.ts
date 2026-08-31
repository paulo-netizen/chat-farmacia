import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { buildPharmaceuticalD2RelationshipProjectionV2 } from '../../lib/cases/v2/build-pharmaceutical-d2-relationship-projection';
import {
  buildPharmaceuticalD2RelationalSemanticRequestV2,
  buildPharmaceuticalD2SemanticRequestV2,
  calculatePharmaceuticalD2SemanticRequestFingerprintV2,
  validatePharmaceuticalD2RelationalSemanticRequestV2,
  validatePharmaceuticalD2SemanticRequestV2,
} from '../../lib/cases/v2/build-pharmaceutical-d2-semantic-request';
import { buildPharmaceuticalAdjudicationContextSetV2, calculatePharmaceuticalAdjudicationContextFingerprintV2 } from '../../lib/cases/v2/build-pharmaceutical-adjudication-context';
import { buildPharmaceuticalEvaluationTargetSetV2 } from '../../lib/cases/v2/build-pharmaceutical-evaluation-target-set';
import { buildPharmaceuticalSessionEvidenceCandidatesV2 } from '../../lib/cases/v2/build-pharmaceutical-session-evidence-candidates';
import { validatePharmaceuticalClinicalReferenceV2 } from '../../lib/cases/v2/validate-pharmaceutical-clinical-reference';
import { validatePharmaceuticalEvaluationExpectationSetV2 } from '../../lib/cases/v2/validate-pharmaceutical-evaluation-expectations';
import { createSessionTranscriptSnapshotV2 } from '../../lib/cases/v2/spfa-session-transcript';
import type { PharmaceuticalClinicalReferenceV2 } from '../../lib/cases/v2/pharmaceutical-clinical-reference-types';
import { buildPharmaceuticalClinicalClaimFindingSetV2 } from '../../lib/cases/v2/build-pharmaceutical-d2-claim-findings';
import { adjudicatePharmaceuticalD2ClaimsV2 } from '../../lib/cases/v2/adjudicate-pharmaceutical-d2-claims';
import { buildOpenAiPharmaceuticalD2SemanticParamsV1, PHARMACEUTICAL_D2_SEMANTIC_INSTRUCTIONS_V3 } from '../../lib/cases/v2/pharmaceutical-d2-prompt';
import { executeOpenAiPharmaceuticalD2SemanticClaimsV1 } from '../../lib/cases/v2/execute-openai-pharmaceutical-d2-semantic-adjudication';
import type { PharmaceuticalAdjudicationContextSetV2 } from '../../lib/cases/v2/pharmaceutical-adjudication-context-types';
import type { PharmaceuticalD2SemanticRequestV2 } from '../../lib/cases/v2/pharmaceutical-d2-claim-types';
import { pharmaceuticalD3FixtureV1, pharmaceuticalD3ClinicalReferenceV1, pharmaceuticalD3PatientRuntimeV1 } from '../live/support/pharmaceutical-d3-live-matrix';

type Mutable<T> = T extends string ? T : T extends readonly (infer U)[] ? Mutable<U>[]
  : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
function mutableClone<T>(value: T): Mutable<T> {
  return structuredClone(value) as Mutable<T>;
}
type Context = Mutable<PharmaceuticalAdjudicationContextSetV2>;
const c3 = pharmaceuticalD3FixtureV1('C3').context;
const conclusion = (n: number) => `conclusion_d3000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const med = (n: number) => `med_d3000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const expected = {
  barrierRef: conclusion(9), barrierAssessmentRef: conclusion(8),
  adherenceAssessmentRef: conclusion(6), medicationRefs: [med(3)],
};
function changed(edit: (value: Context) => void): PharmaceuticalAdjudicationContextSetV2 {
  const value = mutableClone(c3);
  edit(value);
  const { fingerprint: _old, ...core } = value;
  return { ...core, fingerprint: calculatePharmaceuticalAdjudicationContextFingerprintV2(core) };
}
function barrier(value: Context) {
  const clinical = value.targets.find((target) => target.aspect === 'BARRIER_CLASSIFICATION')?.clinicalContext;
  if (clinical?.domain !== 'BARRIER' || clinical.barrier === undefined) throw new Error('missing fixture barrier');
  return clinical;
}
function projectionHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function fromCanonicalSource(edit: (value: Mutable<PharmaceuticalClinicalReferenceV2>) => void = () => {}) {
  const referenceInput = mutableClone(pharmaceuticalD3ClinicalReferenceV1(true, true));
  edit(referenceInput);
  const reference = validatePharmaceuticalClinicalReferenceV2(referenceInput);
  const targetSet = buildPharmaceuticalEvaluationTargetSetV2(reference);
  const transcript = createSessionTranscriptSnapshotV2({ sessionId: c3.sessionId, caseVersionId: c3.caseVersionId, messages: [] });
  return buildPharmaceuticalAdjudicationContextSetV2({
    patientRuntime: pharmaceuticalD3PatientRuntimeV1(), clinicalReference: reference, targetSet, transcript,
    expectationSet: validatePharmaceuticalEvaluationExpectationSetV2({ schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-expectations/1', caseVersionId: reference.caseVersionId, targetSetFingerprint: targetSet.fingerprint, groups: [] }, targetSet),
    candidateSet: buildPharmaceuticalSessionEvidenceCandidatesV2(transcript, targetSet),
  });
}
// Counterfactuals alter the resolved canonical authority, never student text or expected outcomes.
function withScope(numbers: number[]) {
  const identities = new Map(c3.targets.flatMap((target) =>
    target.medicationIdentities.map((item) => [String(item.medicationId), item] as const)));
  return changed((value) => {
    for (const target of value.targets) {
      const clinical = target.clinicalContext;
      const assessment = clinical.domain === 'ADHERENCE' ? clinical.assessment
        : clinical.domain === 'BARRIER' || clinical.domain === 'STRATEGY' ? clinical.adherenceAssessment : undefined;
      if (assessment?.assessmentRef !== conclusion(6)) continue;
      const selected = numbers.map((n) => {
        const identity = identities.get(med(n));
        if (!identity) throw new Error('missing canonical medication');
        return identity;
      });
      assessment.medicationRefs = selected.map((item) => item.medicationId);
      target.medicationIdentities = mutableClone(selected);
      if (target.expected.kind === 'MEDICATION_SCOPE') target.expected.medicationRefs = [...assessment.medicationRefs];
    }
  });
}

describe('M6-D3R16 positive D2 relationship projection', () => {
  it('reconstructs counterfactual A/B from validated clinical reference through real M6-C builders', () => {
    const original = fromCanonicalSource();
    expect(buildPharmaceuticalD2RelationshipProjectionV2(original)).toEqual([expected]);
    const reassigned = fromCanonicalSource((value) => {
      const [first, second] = value.clinicalConclusions.adherence.assessments;
      [first.value.medicationRefs, second.value.medicationRefs] = [second.value.medicationRefs, first.value.medicationRefs];
    });
    expect(buildPharmaceuticalD2RelationshipProjectionV2(reassigned)).toEqual([{ ...expected, medicationRefs: [med(1)] }]);
  });

  it.each(['barrierAssessment', 'adherenceAssessment', 'medication'] as const)(
    'rejects a nonexistent %s link at the canonical clinical-source boundary', (field) => {
      expect(() => fromCanonicalSource((value) => {
        const adherence = value.clinicalConclusions.adherence;
        if (field === 'barrierAssessment') adherence.barriers[0].value.barrierAssessmentRef = conclusion(999) as never;
        if (field === 'adherenceAssessment') adherence.barrierAssessments[0].value.adherenceAssessmentRef = conclusion(999) as never;
        if (field === 'medication') adherence.assessments[0].value.medicationRefs = [med(999) as never];
      })).toThrow();
    },
  );

  it('counterfactual C with no canonical barrier produces no invented relationship', () => {
    const absent = fromCanonicalSource((value) => {
      const adherence = value.clinicalConclusions.adherence;
      adherence.barriers = [];
      adherence.barrierAssessments[0].value.status = 'not_determinable';
      adherence.strategies = [];
    });
    expect(buildPharmaceuticalD2RelationshipProjectionV2(absent)).toEqual([]);
  });

  it('canonical source array reordering retains the full /2 request fingerprint', () => {
    const first = fromCanonicalSource();
    const reordered = fromCanonicalSource((value) => { value.clinicalConclusions.adherence.assessments.reverse(); });
    expect(buildPharmaceuticalD2RelationalSemanticRequestV2(reordered)).toEqual(buildPharmaceuticalD2RelationalSemanticRequestV2(first));
  });

  it('supports multiple barriers with canonical ordering and independent provenance', () => {
    const build = (reverse: boolean) => fromCanonicalSource((value) => {
      const original = value.clinicalConclusions.adherence.barriers[0];
      value.clinicalConclusions.adherence.barriers.push({ ...mutableClone(original), conclusionId: conclusion(99) as never, value: { ...mutableClone(original.value), role: 'secondary' } });
      if (reverse) value.clinicalConclusions.adherence.barriers.reverse();
    });
    const first = build(false);
    expect(buildPharmaceuticalD2RelationshipProjectionV2(first)).toEqual([expected, { ...expected, barrierRef: conclusion(99) }]);
    expect(buildPharmaceuticalD2RelationalSemanticRequestV2(build(true))).toEqual(buildPharmaceuticalD2RelationalSemanticRequestV2(first));
  });

  it('preserves the complete C3 barrier → assessment → adherence → medication provenance', () => {
    expect(buildPharmaceuticalD2RelationshipProjectionV2(c3)).toEqual([expected]);
    const other = c3.targets.find((target) => target.clinicalContext.domain === 'ADHERENCE'
      && target.clinicalContext.assessment.assessmentRef === conclusion(15));
    expect(other?.clinicalContext).toMatchObject({ assessment: { medicationRefs: [med(1)] } });
    expect(Object.keys(buildPharmaceuticalD2RelationshipProjectionV2(c3)[0])).toEqual([
      'barrierRef', 'barrierAssessmentRef', 'adherenceAssessmentRef', 'medicationRefs',
    ]);
  });

  it('preserves all medications sorted and deduplicates equivalent medication scopes', () => {
    expect(buildPharmaceuticalD2RelationshipProjectionV2(withScope([3, 1, 3]))).toEqual([
      { ...expected, medicationRefs: [med(1), med(3)] },
    ]);
  });

  it('counterfactual B follows canonical scope A, not the C3 contradiction expectation', () => {
    const input = withScope([1]);
    expect(buildPharmaceuticalD2RelationshipProjectionV2(input)).toEqual([{ ...expected, medicationRefs: [med(1)] }]);
    expect(buildPharmaceuticalD2SemanticRequestV2(input).studentMessages.messages)
      .toEqual(buildPharmaceuticalD2SemanticRequestV2(c3).studentMessages.messages);
  });

  it('counterfactual C fails closed on a missing link instead of inventing a relationship', () => {
    const input = changed((value) => { Reflect.deleteProperty(barrier(value), 'adherenceAssessment'); });
    expect(() => buildPharmaceuticalD2RelationshipProjectionV2(input)).toThrow('missing canonical adherence link');
  });

  it('allows an empty projection when there are no barrier targets', () => {
    const input = changed((value) => { value.targets = value.targets.filter((target) => target.clinicalContext.domain !== 'BARRIER'); });
    expect(buildPharmaceuticalD2RelationshipProjectionV2(input)).toEqual([]);
  });

  it('does not synthesize a barrier from an assessment with indeterminate status', () => {
    const input = changed((value) => {
      const target = value.targets.find((item) => item.aspect === 'BARRIER_EXISTENCE');
      if (target?.clinicalContext.domain !== 'BARRIER') throw new Error('missing assessment');
      target.clinicalContext.barrierAssessment.status = 'not_determinable';
      delete target.clinicalContext.barrier;
      value.targets = [target];
    });
    expect(buildPharmaceuticalD2RelationshipProjectionV2(input)).toEqual([]);
  });

  it.each(['barrier', 'barrierAssessment', 'adherenceAssessment', 'medication'] as const)(
    'rejects invalid %s references without dropping them', (field) => {
      const input = changed((value) => {
        const b = barrier(value);
        if (field === 'barrier') b.barrier!.barrierRef = 'invalid' as never;
        if (field === 'barrierAssessment') b.barrierAssessment.assessmentRef = 'invalid' as never;
        if (field === 'adherenceAssessment') b.adherenceAssessment.assessmentRef = 'invalid' as never;
        if (field === 'medication') b.adherenceAssessment.medicationRefs = ['invalid' as never];
      });
      expect(() => buildPharmaceuticalD2RelationshipProjectionV2(input)).toThrow(/canonical/);
    },
  );

  it('rejects a well-formed medication reference absent from canonical identities', () => {
    const input = changed((value) => { barrier(value).adherenceAssessment.medicationRefs = [med(999) as never]; });
    expect(() => buildPharmaceuticalD2RelationshipProjectionV2(input)).toThrow('canonical medication identity');
  });

  it('rejects reuse of a conclusion identity for incompatible roles', () => {
    const input = changed((value) => { barrier(value).barrierAssessment.assessmentRef = conclusion(6) as never; });
    expect(() => buildPharmaceuticalD2RelationshipProjectionV2(input)).toThrow('conflicting conclusion roles');
  });

  it('collapses repeated equivalent barrier packets deterministically', () => {
    const input = changed((value) => { value.targets.push(...structuredClone(value.targets)); });
    expect(buildPharmaceuticalD2RelationshipProjectionV2(input)).toEqual([expected]);
  });

  it.each(['barrierAssessment', 'adherenceAssessment', 'scope', 'classification'] as const)(
    'rejects incompatible repeated %s authority', (field) => {
      const input = changed((value) => {
        const b = barrier(value);
        if (field === 'barrierAssessment') b.barrierAssessment.assessmentRef = conclusion(999) as never;
        if (field === 'adherenceAssessment') b.adherenceAssessment.assessmentRef = conclusion(999) as never;
        if (field === 'scope') b.adherenceAssessment.medicationRefs = [];
        if (field === 'classification') b.barrier!.classification!.conceptId = 'DIFFERENT';
      });
      expect(() => buildPharmaceuticalD2RelationshipProjectionV2(input)).toThrow('incompatible repeated');
    },
  );

  it('canonicalizes equivalent relationship input order without recanonicalizing M6-C', () => {
    const forward = withScope([3, 1]);
    const reversed = mutableClone(forward);
    reversed.targets.reverse();
    for (const target of reversed.targets) {
      if (target.clinicalContext.domain === 'BARRIER') target.clinicalContext.adherenceAssessment.medicationRefs.reverse();
    }
    const { fingerprint: _old, ...core } = reversed;
    reversed.fingerprint = calculatePharmaceuticalAdjudicationContextFingerprintV2(core);
    const left = buildPharmaceuticalD2RelationshipProjectionV2(forward);
    const right = buildPharmaceuticalD2RelationshipProjectionV2(reversed);
    expect(right).toEqual(left);
    expect(projectionHash(right)).toBe(projectionHash(left));
    // Full requests still pin the unchanged, order-sensitive M6-C context fingerprint.
  });

  it('rejects a stale upstream context fingerprint', () => {
    const value = mutableClone(c3);
    barrier(value).barrier!.barrierRef = conclusion(999) as never;
    expect(() => buildPharmaceuticalD2RelationshipProjectionV2(value)).toThrow(/fingerprint/);
  });

  it('does not mutate or alias the canonical context', () => {
    const before = JSON.stringify(c3);
    const output = buildPharmaceuticalD2RelationshipProjectionV2(c3);
    const source = c3.targets.find((target) => target.aspect === 'BARRIER_CLASSIFICATION')?.clinicalContext;
    if (source?.domain !== 'BARRIER') throw new Error('missing fixture barrier');
    expect(output[0].medicationRefs).not.toBe(source.adherenceAssessment.medicationRefs);
    expect(JSON.stringify(c3)).toBe(before);
  });
});

describe('D2 request /2 isolated relational representation', () => {
  it('changes only the request contract, relationship projection and request fingerprint', () => {
    const v1 = buildPharmaceuticalD2SemanticRequestV2(c3);
    const v2 = buildPharmaceuticalD2RelationalSemanticRequestV2(c3);
    const { relationships, ...authority } = v2.authorityProjection;
    expect({ ...v2, contractVersion: v1.contractVersion, authorityProjection: authority, requestFingerprint: v1.requestFingerprint }).toEqual(v1);
    expect(relationships).toEqual([expected]);
    expect(v1.contractVersion).toBe('pharmaceutical-d2-semantic-request/1');
    expect(v2.contractVersion).toBe('pharmaceutical-d2-semantic-request/2');
    expect(v2.requestFingerprint.canonicalization).toBe('pharmaceutical-d2-semantic-request-v2/2');
    expect(v2.requestFingerprint.value).not.toBe(v1.requestFingerprint.value);
    expect(v1.requestFingerprint.value).toBe('10e0c1a64e29dc52327df2b2ec831260843dfbc22d7f55e347442cb67ac3c3c1');
    expect(v2.requestFingerprint.value).toBe('3e57da398d6dafcebdedc10ab1976f6397aeef5b4bb611420dd00ca304f366e5');
    expect(buildPharmaceuticalD2RelationalSemanticRequestV2(c3)).toEqual(v2);
    expect(validatePharmaceuticalD2SemanticRequestV2(v1, c3)).toEqual(v1);
    expect(validatePharmaceuticalD2RelationalSemanticRequestV2(v2, c3)).toEqual(v2);
  });

  it('recalculates the persisted fingerprint and refuses request-version confusion', () => {
    const v2 = buildPharmaceuticalD2RelationalSemanticRequestV2(c3);
    const { requestFingerprint, ...core } = v2;
    expect(calculatePharmaceuticalD2SemanticRequestFingerprintV2(core)).toEqual(requestFingerprint);
    expect(() => validatePharmaceuticalD2SemanticRequestV2(v2, c3)).toThrow();
    expect(() => validatePharmaceuticalD2RelationalSemanticRequestV2(buildPharmaceuticalD2SemanticRequestV2(c3), c3)).toThrow();
    expect(() => validatePharmaceuticalD2RelationalSemanticRequestV2({ ...v2, requestFingerprint: { ...requestFingerprint, value: '0'.repeat(64) } }, c3)).toThrow();
  });

  it.each(['barrierRef', 'barrierAssessmentRef', 'adherenceAssessmentRef', 'medicationRefs'] as const)(
    'rejects nonexistent projected %s even with a recomputed candidate hash', (field) => {
      const v2 = mutableClone(buildPharmaceuticalD2RelationalSemanticRequestV2(c3));
      if (field === 'medicationRefs') v2.authorityProjection.relationships[0][field] = [med(999) as never];
      else v2.authorityProjection.relationships[0][field] = conclusion(999) as never;
      v2.requestFingerprint = calculatePharmaceuticalD2SemanticRequestFingerprintV2(v2);
      expect(() => validatePharmaceuticalD2RelationalSemanticRequestV2(v2, c3)).toThrow('does not match');
    },
  );

  it('preserves canonical findings, UTF-16 spans and claim IDs for the same provider output', () => {
    const fixture = pharmaceuticalD3FixtureV1('C3');
    const finding = fixture.expectedD2.find((item) => item.messageRef === '2');
    if (!finding || !('expectationVersion' in finding)) throw new Error('missing ref 2');
    const option = finding.canonicalAlternatives[0];
    const result = { schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: [{
      messageRef: finding.messageRef, domain: finding.domain, findingType: finding.findingType,
      claimForm: finding.claimForm, excerpt: option.excerpt, occurrenceIndex: 0, relatedClinicalRefs: option.relatedClinicalRefs,
    }] };
    const v1 = buildPharmaceuticalClinicalClaimFindingSetV2(buildPharmaceuticalD2SemanticRequestV2(c3), result);
    const v2 = buildPharmaceuticalClinicalClaimFindingSetV2(buildPharmaceuticalD2RelationalSemanticRequestV2(c3), result);
    expect(v2.findings).toEqual(v1.findings);
    expect(v2.contextFingerprint).toEqual(v1.contextFingerprint);
  });

  it('uses the unchanged prompt /3 and output schema with the new structured data only', () => {
    const oldParams = buildOpenAiPharmaceuticalD2SemanticParamsV1(buildPharmaceuticalD2SemanticRequestV2(c3));
    const newParams = buildOpenAiPharmaceuticalD2SemanticParamsV1(buildPharmaceuticalD2RelationalSemanticRequestV2(c3));
    expect(newParams.instructions).toBe(PHARMACEUTICAL_D2_SEMANTIC_INSTRUCTIONS_V3);
    expect(newParams.instructions).toBe(oldParams.instructions);
    expect(newParams.text).toEqual(oldParams.text);
    expect(JSON.stringify(newParams.input)).toContain('relationships');
  });

  it.each(['gpt-5.6-sol', 'gpt-5.6-terra'] as const)('passes /2 through the real executor with a mocked %s transport', async (model) => {
    const request = buildPharmaceuticalD2RelationalSemanticRequestV2(c3);
    const parse = vi.fn().mockResolvedValue({ model, status: 'completed', output: [], output_parsed: {
      schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: [],
    } });
    const receipt = await executeOpenAiPharmaceuticalD2SemanticClaimsV1({ responses: { parse } }, request, { model, timeoutMs: 120_000, maxOutputTokens: 8_000 });
    expect(receipt.responseModel).toBe(model);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(JSON.parse(parse.mock.calls[0][0].input).semanticRequest).toEqual(request);
  });

  it('orchestrates /2 explicitly and retains /1 for historical callers', async () => {
    const requests: PharmaceuticalD2SemanticRequestV2[] = [];
    const detectClaims = vi.fn(async (request: PharmaceuticalD2SemanticRequestV2) => {
      requests.push(request);
      return { provider: 'openai' as const, responseModel: 'gpt-5.6-terra', providerResult: {
        schemaVersion: '2.0', contractVersion: 'pharmaceutical-d2-provider-result/2', findings: [],
      } };
    });
    const allocate = () => 'pharm_sem_exec_d3000000-0000-4000-8000-000000000001';
    await adjudicatePharmaceuticalD2ClaimsV2(c3, { detectClaims }, allocate);
    await adjudicatePharmaceuticalD2ClaimsV2(c3, { detectClaims }, allocate, 'pharmaceutical-d2-semantic-request/2');
    expect(requests.map((request) => request.contractVersion)).toEqual(['pharmaceutical-d2-semantic-request/1', 'pharmaceutical-d2-semantic-request/2']);
    expect(detectClaims).toHaveBeenCalledTimes(2);
  });

  it('rejects unknown request contracts before invoking a runtime', async () => {
    const detectClaims = vi.fn();
    await expect(adjudicatePharmaceuticalD2ClaimsV2(c3, { detectClaims }, () => 'unused', 'unknown' as never)).rejects.toMatchObject({ code: 'INTERNAL_VALIDATION_ERROR', stage: 'REQUEST_BUILD' });
    expect(detectClaims).not.toHaveBeenCalled();
  });
});
