import { describe, expect, it } from 'vitest';

import {
  buildPharmaceuticalD1SemanticBatchRequestV2,
} from '../../lib/cases/v2/build-pharmaceutical-d1-semantic-request';
import type { PharmaceuticalAdjudicationContextSetV2 } from '../../lib/cases/v2/pharmaceutical-adjudication-context-types';
import type {
  PharmaceuticalD1ProviderBatchResultV1,
  PharmaceuticalD1ProviderTargetResultV1,
  PharmaceuticalD1SemanticBatchRequestV2,
  PharmaceuticalD1SemanticExecutionMetadataV2,
} from '../../lib/cases/v2/pharmaceutical-d1-adjudication-types';
import type {
  PharmaceuticalEvaluationTargetAspectV2,
  PharmaceuticalEvaluationTargetId,
} from '../../lib/cases/v2/pharmaceutical-evaluation-target-types';
import type { SessionMessageId } from '../../lib/cases/v2/spfa-session-evidence-types';
import type { CaseVersionId } from '../../lib/cases/v2/types';
import {
  buildPharmaceuticalD1AcceptedSemanticBatchV2,
  buildPharmaceuticalTargetSemanticAdjudicationSetV2,
  parsePharmaceuticalSemanticExecutionIdV2,
  validatePharmaceuticalD1SemanticExecutionMetadataV2,
  validatePharmaceuticalTargetSemanticAdjudicationSetV2,
} from '../../lib/cases/v2/validate-pharmaceutical-d1-adjudication';
import {
  PHARMACEUTICAL_D1_PROVIDER_BATCH_RESULT_SCHEMA_V1,
  validatePharmaceuticalD1ProviderBatchResultV1,
} from '../../lib/cases/v2/validate-pharmaceutical-d1-provider-result';

const caseVersionId = 'casever_00000000-0000-1000-8000-000000000001' as CaseVersionId;
const studentMessageRef = '1' as SessionMessageId;
const patientMessageRef = '2' as SessionMessageId;

function targetId(index: number): PharmaceuticalEvaluationTargetId {
  return `pharm_target_${index.toString(16).padStart(64, '0')}` as PharmaceuticalEvaluationTargetId;
}

function packet(
  aspect: PharmaceuticalEvaluationTargetAspectV2,
  index: number,
  hasStudent = true,
): PharmaceuticalAdjudicationContextSetV2['targets'][number] {
  return {
    targetRef: targetId(index),
    category: aspect.startsWith('REPORT_') ? 'ACTION' : 'INTERPRETATION',
    aspect,
    expected: { kind: 'TEXT', value: `expected-${aspect}` },
    clinicalContext: { domain: 'PRM', assessmentStatus: 'present' },
    medicationIdentities: [],
    relevantVersions: [
      { role: 'EVALUATOR_SCHEMA', reference: { id: 'evaluator-schema', version: '2.0' } },
    ],
    expectationMemberships: [],
    structuralState: {
      status: hasStudent ? 'HAS_STUDENT_CANDIDATES' : 'NO_STUDENT_CANDIDATES',
      studentCandidateCount: hasStudent ? 1 : 0,
      acquisitionContextCount: 1,
    },
    studentCandidates: hasStudent ? [{
      messageRef: studentMessageRef,
      candidateEvidenceKinds: aspect.startsWith('REPORT_')
        ? ['STUDENT_ACTION']
        : ['STUDENT_INTERPRETATION', 'STUDENT_DECISION'],
      untrustedContent: aspect.startsWith('REPORT_')
        ? 'Prepararé un informe para el médico.'
        : 'Creo que existe un problema relacionado con el medicamento.',
    }] : [],
    acquisitionContext: [{
      messageRef: patientMessageRef,
      candidateEvidenceKinds: ['PATIENT_STATEMENT', 'PATIENT_CONFIRMATION'],
      untrustedContent: 'A veces olvido el medicamento.',
    }],
  };
}

function context(
  targets: PharmaceuticalAdjudicationContextSetV2['targets'] = [packet('PRM_STATUS', 1)],
): PharmaceuticalAdjudicationContextSetV2 {
  return {
    schemaVersion: '2.0',
    contractVersion: 'pharmaceutical-adjudication-context/1',
    sessionId: 'session-d1a',
    caseVersionId,
    transcriptFingerprint: {
      algorithm: 'sha256',
      canonicalization: 'session-transcript-v2/1',
      value: 'a'.repeat(64),
    },
    targetSetFingerprint: {
      algorithm: 'sha256',
      canonicalization: 'pharmaceutical-evaluation-target-set-v2/1',
      value: 'b'.repeat(64),
    },
    targets,
    fingerprint: {
      algorithm: 'sha256',
      canonicalization: 'pharmaceutical-adjudication-context-v2/1',
      value: 'c'.repeat(64),
    },
  };
}

function evidence(request: PharmaceuticalD1SemanticBatchRequestV2, index = 0) {
  const candidate = request.targets[index].studentCandidates[0];
  return {
    messageRef: candidate.messageRef,
    evidenceKind: candidate.candidateEvidenceKinds[0],
    excerpt: request.targets[index].aspect.startsWith('REPORT_')
      ? 'informe para el médico'
      : 'problema relacionado',
  };
}

function result(
  request: PharmaceuticalD1SemanticBatchRequestV2,
  verdicts: readonly (
    | 'CORRECTLY_DEMONSTRATED'
    | 'INCORRECT_OR_CONTRADICTED'
    | 'UNCERTAIN'
    | 'NOT_DEMONSTRATED'
  )[] = request.targets.map(() => 'CORRECTLY_DEMONSTRATED'),
): PharmaceuticalD1ProviderBatchResultV1 {
  return {
    schemaVersion: '2.0',
    contractVersion: 'pharmaceutical-d1-provider-result/1',
    results: request.targets.map((target, index): PharmaceuticalD1ProviderTargetResultV1 => {
      const item = evidence(request, index);
      switch (verdicts[index]) {
        case 'CORRECTLY_DEMONSTRATED':
          return { targetRef: target.targetRef, verdict: 'CORRECTLY_DEMONSTRATED', supportingEvidence: [item] };
        case 'INCORRECT_OR_CONTRADICTED':
          return { targetRef: target.targetRef, verdict: 'INCORRECT_OR_CONTRADICTED', contradictionEvidence: [item] };
        case 'UNCERTAIN':
          return { targetRef: target.targetRef, verdict: 'UNCERTAIN', relatedEvidence: [item] };
        case 'NOT_DEMONSTRATED':
          return { targetRef: target.targetRef, verdict: 'NOT_DEMONSTRATED', evidence: [] };
      }
    }),
  };
}

function execution(
  request: PharmaceuticalD1SemanticBatchRequestV2,
  uuidSuffix = '000000000001',
): PharmaceuticalD1SemanticExecutionMetadataV2 {
  return {
    semanticExecutionRef: parsePharmaceuticalSemanticExecutionIdV2(
      `pharm_sem_exec_00000000-0000-1000-8000-${uuidSuffix}`,
    ),
    lane: 'D1',
    provider: 'synthetic-provider',
    responseModel: 'synthetic-model',
    promptVersion: request.promptVersion,
    requestFingerprint: structuredClone(request.requestFingerprint),
    includedTargetRefs: request.targets.map((target) => target.targetRef),
  };
}

describe('M6-D1 strict provider result contract', () => {
  for (const verdict of [
    'CORRECTLY_DEMONSTRATED',
    'INCORRECT_OR_CONTRADICTED',
    'UNCERTAIN',
    'NOT_DEMONSTRATED',
  ] as const) {
    it(`accepts the exact ${verdict} shape`, () => {
      const input = context();
      const request = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
      expect(validatePharmaceuticalD1ProviderBatchResultV1(
        request,
        result(request, [verdict]),
        input,
      ).results[0].verdict).toBe(verdict);
    });
  }

  it('normalizes provider result order to canonical request order', () => {
    const input = context([packet('PRM_STATUS', 1), packet('PRM_EXISTENCE', 2)]);
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
    const reversed: any = result(request);
    reversed.results.reverse();
    expect(validatePharmaceuticalD1ProviderBatchResultV1(request, reversed, input).results.map(
      (item) => item.targetRef,
    )).toEqual(request.targets.map((item) => item.targetRef));
  });

  it.each([
    ['missing target', (value: any) => value.results.pop()],
    ['extra target', (value: any) => value.results.push({ ...value.results[0], targetRef: targetId(99) })],
    ['duplicate target', (value: any) => value.results.push(structuredClone(value.results[0]))],
    ['wrong target batch', (value: any) => { value.results[0].targetRef = targetId(99); }],
    ['unknown message', (value: any) => { value.results[0].supportingEvidence[0].messageRef = '99'; }],
    ['patient message', (value: any) => { value.results[0].supportingEvidence[0].messageRef = patientMessageRef; }],
    ['invalid evidence kind', (value: any) => { value.results[0].supportingEvidence[0].evidenceKind = 'STUDENT_ACTION'; }],
    ['nonliteral excerpt', (value: any) => { value.results[0].supportingEvidence[0].excerpt = 'paráfrasis inventada'; }],
    ['empty excerpt', (value: any) => { value.results[0].supportingEvidence[0].excerpt = ''; }],
    ['unknown result property', (value: any) => { value.results[0].rationale = 'free text'; }],
    ['unknown evidence property', (value: any) => { value.results[0].supportingEvidence[0].speaker = 'student'; }],
    ['unknown root property', (value: any) => { value.model = 'provider-controlled'; }],
  ])('rejects %s fail-closed', (_label, mutate) => {
    const input = context([packet('PRM_STATUS', 1), packet('PRM_EXISTENCE', 2)]);
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
    const provider: any = structuredClone(result(request));
    mutate(provider);
    expect(() => validatePharmaceuticalD1ProviderBatchResultV1(request, provider, input)).toThrow();
  });

  it.each([
    ['CORRECTLY_DEMONSTRATED', 'supportingEvidence'],
    ['INCORRECT_OR_CONTRADICTED', 'contradictionEvidence'],
    ['UNCERTAIN', 'relatedEvidence'],
  ] as const)('rejects zero evidence for %s', (verdict, field) => {
    const input = context();
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
    const provider: any = result(request, [verdict]);
    provider.results[0][field] = [];
    expect(PHARMACEUTICAL_D1_PROVIDER_BATCH_RESULT_SCHEMA_V1.safeParse(provider).success).toBe(false);
  });

  it('rejects evidence in NOT_DEMONSTRATED and unsupported verdicts', () => {
    const input = context();
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
    const withEvidence: any = result(request, ['NOT_DEMONSTRATED']);
    withEvidence.results[0].evidence = [evidence(request)];
    expect(() => validatePharmaceuticalD1ProviderBatchResultV1(request, withEvidence, input)).toThrow();
    const partial: any = result(request);
    partial.results[0].verdict = 'PARTIAL';
    expect(() => validatePharmaceuticalD1ProviderBatchResultV1(request, partial, input)).toThrow();
    partial.results[0].verdict = 'NOT_APPLICABLE';
    expect(() => validatePharmaceuticalD1ProviderBatchResultV1(request, partial, input)).toThrow();
  });

  it('accepts an identical literal excerpt even when it occurs twice in one message', () => {
    const input = context();
    (input.targets[0].studentCandidates[0] as any).untrustedContent =
      'problema relacionado; problema relacionado';
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
    expect(() => validatePharmaceuticalD1ProviderBatchResultV1(request, result(request), input)).not.toThrow();
  });

  it('rejects duplicated evidence references', () => {
    const input = context();
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
    const provider: any = result(request);
    provider.results[0].supportingEvidence.push(structuredClone(provider.results[0].supportingEvidence[0]));
    expect(() => validatePharmaceuticalD1ProviderBatchResultV1(request, provider, input)).toThrow(
      /duplicates an evidence reference/,
    );
  });
});

describe('M6-D1 server-owned reconstruction and global validation', () => {
  function acceptedBatches(input: PharmaceuticalAdjudicationContextSetV2) {
    const prmRequest = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
    const reportRequest = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'REFERRAL_REPORT');
    return [
      buildPharmaceuticalD1AcceptedSemanticBatchV2(
        prmRequest,
        result(prmRequest, ['CORRECTLY_DEMONSTRATED', 'NOT_DEMONSTRATED']),
        execution(prmRequest, '000000000001'),
        input,
      ),
      buildPharmaceuticalD1AcceptedSemanticBatchV2(
        reportRequest,
        result(reportRequest, ['UNCERTAIN']),
        execution(reportRequest, '000000000002'),
        input,
      ),
    ] as const;
  }

  function globalFixture() {
    return context([
      packet('PRM_STATUS', 1),
      packet('RNM_STATUS', 2, false),
      packet('PRM_EXISTENCE', 3),
      packet('REPORT_STATUS', 4),
    ]);
  }

  it('creates canonical student evidence and keeps execution metadata server-owned', () => {
    const input = globalFixture();
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
    const accepted = buildPharmaceuticalD1AcceptedSemanticBatchV2(
      request,
      result(request),
      execution(request),
      input,
    );
    expect(accepted.adjudications[0]).toMatchObject({
      resolution: 'SEMANTIC',
      semanticExecutionRef: execution(request).semanticExecutionRef,
      supportingEvidenceRefs: [{
        targetRef: targetId(1),
        speaker: 'student',
        evidenceRole: 'STUDENT_DEMONSTRATION',
      }],
    });
    expect(JSON.stringify(accepted)).not.toContain('A veces olvido el medicamento');
  });

  it('validates opaque execution IDs and exact execution/request pinning', () => {
    const input = globalFixture();
    const request = buildPharmaceuticalD1SemanticBatchRequestV2(input, 'PRM');
    expect(() => parsePharmaceuticalSemanticExecutionIdV2(
      'pharm_sem_exec_00000000-0000-9000-8000-000000000001',
    )).toThrow();
    const metadata: any = execution(request);
    metadata.includedTargetRefs.reverse();
    expect(() => validatePharmaceuticalD1SemanticExecutionMetadataV2(metadata, request)).toThrow();
    metadata.includedTargetRefs.reverse();
    metadata.responseModel = '';
    expect(() => validatePharmaceuticalD1SemanticExecutionMetadataV2(metadata, request)).toThrow();
  });

  it('reconstructs exactly one ordered entry per target including structural shells', () => {
    const input = globalFixture();
    const batches = acceptedBatches(input);
    const output = buildPharmaceuticalTargetSemanticAdjudicationSetV2(input, batches);
    expect(output.adjudications.map((item) => item.targetRef)).toEqual(
      input.targets.map((item) => item.targetRef),
    );
    expect(output.adjudications[1]).toEqual({
      targetRef: targetId(2),
      resolution: 'STRUCTURAL_NO_STUDENT_CANDIDATES',
    });
    expect(output.adjudications[2]).toMatchObject({
      resolution: 'SEMANTIC',
      verdict: 'NOT_DEMONSTRATED',
      evidenceRefs: [],
    });
    expect(output.executions).toHaveLength(2);
    expect(output.fingerprint.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('keeps structural absence distinct from semantic NOT_DEMONSTRATED', () => {
    const input = globalFixture();
    const output = buildPharmaceuticalTargetSemanticAdjudicationSetV2(input, acceptedBatches(input));
    expect(output.adjudications[1]).not.toHaveProperty('verdict');
    expect(output.adjudications[1]).not.toHaveProperty('semanticExecutionRef');
    expect(output.adjudications[2]).toHaveProperty('verdict', 'NOT_DEMONSTRATED');
    expect(output.adjudications[2]).toHaveProperty('semanticExecutionRef');
  });

  it('is deterministic for the same validated executions', () => {
    const input = globalFixture();
    const batches = acceptedBatches(input);
    expect(buildPharmaceuticalTargetSemanticAdjudicationSetV2(input, batches)).toEqual(
      buildPharmaceuticalTargetSemanticAdjudicationSetV2(input, batches),
    );
  });

  it('validates the global envelope by complete server-owned reconstruction', () => {
    const input = globalFixture();
    const batches = acceptedBatches(input);
    const output = buildPharmaceuticalTargetSemanticAdjudicationSetV2(input, batches);
    expect(validatePharmaceuticalTargetSemanticAdjudicationSetV2(output, input, batches)).toEqual(output);
    const tampered: any = structuredClone(output);
    tampered.adjudications.reverse();
    expect(() => validatePharmaceuticalTargetSemanticAdjudicationSetV2(tampered, input, batches)).toThrow();
    tampered.adjudications.reverse();
    tampered.rawProvider = { secret: true };
    expect(() => validatePharmaceuticalTargetSemanticAdjudicationSetV2(tampered, input, batches)).toThrow(
      /unexpected property/,
    );
  });

  it.each([
    ['missing batch', (items: any[]) => items.pop()],
    ['duplicate batch', (items: any[]) => items.push(items[0])],
    ['non-canonical batch order', (items: any[]) => items.reverse()],
    ['wrong execution ref', (items: any[]) => { items[0].adjudications[0].semanticExecutionRef = items[1].execution.semanticExecutionRef; }],
    ['wrong request fingerprint', (items: any[]) => { items[0].requestFingerprint.value = '0'.repeat(64); }],
    ['patient evidence cast as demonstration', (items: any[]) => { items[0].adjudications[0].supportingEvidenceRefs[0].speaker = 'patient'; }],
    ['unknown accepted-batch property', (items: any[]) => { items[0].rawProvider = {}; }],
  ])('rejects global %s', (_label, mutate) => {
    const input = globalFixture();
    const batches: any[] = structuredClone(acceptedBatches(input)).map((batch) => batch);
    mutate(batches);
    expect(() => buildPharmaceuticalTargetSemanticAdjudicationSetV2(input, batches)).toThrow();
  });

  it('supports an all-structural context without executions or semantic calls', () => {
    const input = context([
      packet('PRM_STATUS', 1, false),
      packet('REPORT_STATUS', 2, false),
    ]);
    const output = buildPharmaceuticalTargetSemanticAdjudicationSetV2(input, []);
    expect(output.executions).toEqual([]);
    expect(output.adjudications.every(
      (item) => item.resolution === 'STRUCTURAL_NO_STUDENT_CANDIDATES',
    )).toBe(true);
  });

  it('contains no score, feedback, prompt, raw provider, patient evidence, or PARTIAL', () => {
    const input = globalFixture();
    const serialized = JSON.stringify(
      buildPharmaceuticalTargetSemanticAdjudicationSetV2(input, acceptedBatches(input)),
    );
    for (const forbidden of [
      'score', 'feedback', 'rawProvider', 'fullPrompt', 'chainOfThought',
      'PARTIAL', 'PATIENT_STATEMENT', 'PATIENT_CONFIRMATION',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
