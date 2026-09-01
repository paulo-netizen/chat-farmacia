import { describe, expect, it } from 'vitest';

import {
  buildPharmaceuticalD2RelationalSemanticRequestV2,
  pharmaceuticalD2ClinicalRefKey,
} from '../../lib/cases/v2/build-pharmaceutical-d2-semantic-request';
import type {
  PharmaceuticalD2ClinicalRefV2,
  PharmaceuticalD2SemanticRequestV2,
} from '../../lib/cases/v2/pharmaceutical-d2-claim-types';
import type { PharmaceuticalD2SemanticRuntimeV2 } from '../../lib/cases/v2/pharmaceutical-d2-semantic-runtime';
import {
  calculatePharmaceuticalD3CallBudgetV1,
  PHARMACEUTICAL_D3_CANDIDATE_REGISTRATION_V11,
  PHARMACEUTICAL_D3_D2_COMPARATOR_VERSION_V3,
  PHARMACEUTICAL_D3_D2_EXPECTATION_VERSION_V3,
  PHARMACEUTICAL_D3_HISTORICAL_RESULT_V10,
  PHARMACEUTICAL_D3_LIVE_MATRIX_FINGERPRINT_V11,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V2,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V3,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V4,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V5,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V6,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V7,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V8,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V9,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V10,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V11,
  runPharmaceuticalD3AcceptanceV5,
  runPharmaceuticalD3AcceptanceV6,
  validatePharmaceuticalD3ExpectedD2FindingV3,
  validatePharmaceuticalD3ExpectedD2SetV3,
  type PharmaceuticalD3ExpectedD2FindingV3,
  type PharmaceuticalD3LiveFixtureV3,
  type PharmaceuticalD3LiveRuntimeFactoryV1,
} from '../live/support/pharmaceutical-d3-live-matrix';

const terra = { d1: 'gpt-5.6-terra', d2: 'gpt-5.6-terra' } as const;
const c3 = PHARMACEUTICAL_D3_LIVE_MATRIX_V11.fixtures.find(
  (fixture) => fixture.fixtureId === 'C3',
)!;

function expected(messageRef: string): PharmaceuticalD3ExpectedD2FindingV3 {
  const value = c3.expectedD2.find(
    (finding) => finding.semanticClassification.messageRef === messageRef,
  );
  if (value === undefined) throw new Error(`missing /11 expectation ${messageRef}`);
  return value;
}

function sortedRefs(refs: readonly PharmaceuticalD2ClinicalRefV2[]): PharmaceuticalD2ClinicalRefV2[] {
  return refs.map((ref) => structuredClone(ref)).sort((left, right) =>
    pharmaceuticalD2ClinicalRefKey(left).localeCompare(pharmaceuticalD2ClinicalRefKey(right)));
}

function occurrenceIndex(
  request: PharmaceuticalD2SemanticRequestV2,
  messageRef: string,
  excerpt: string,
  excerptStart: number,
): number {
  const message = request.studentMessages.messages.find(
    (candidate) => candidate.messageRef === messageRef,
  );
  if (message === undefined) throw new Error(`missing message ${messageRef}`);
  const starts: number[] = [];
  for (let start = 0; start <= message.untrustedContent.length - excerpt.length;) {
    const found = message.untrustedContent.indexOf(excerpt, start);
    if (found < 0) break;
    starts.push(found);
    start = found + 1;
  }
  const index = starts.indexOf(excerptStart);
  if (index < 0) throw new Error(`missing literal occurrence ${messageRef}`);
  return index;
}

function providerResult(
  fixture: PharmaceuticalD3LiveFixtureV3,
  request: PharmaceuticalD2SemanticRequestV2,
  literalByMessageRef: Readonly<Record<string, number>> = {},
) {
  return {
    schemaVersion: '2.0' as const,
    contractVersion: 'pharmaceutical-d2-provider-result/2' as const,
    findings: fixture.expectedD2.map((finding) => {
      const classification = finding.semanticClassification;
      const literal = finding.literalAlternatives[literalByMessageRef[classification.messageRef] ?? 0];
      if (literal === undefined) throw new Error(`missing literal ${classification.messageRef}`);
      return {
        ...classification,
        excerpt: literal.excerpt,
        occurrenceIndex: occurrenceIndex(
          request,
          classification.messageRef,
          literal.excerpt,
          literal.excerptStart,
        ),
        relatedClinicalRefs: sortedRefs(finding.provenancePolicy.requiredClinicalRefs),
      };
    }),
  };
}

function runtimeFactory(
  mutate?: (findings: any[], request: PharmaceuticalD2SemanticRequestV2) => void,
  literalByMessageRef: Readonly<Record<string, number>> = {},
): PharmaceuticalD3LiveRuntimeFactoryV1 {
  return {
    createD1Runtime: () => ({
      adjudicateBatch: async () => {
        throw new Error('C3 must not execute D1');
      },
    }),
    createD2Runtime: (fixture) => ({
      detectClaims: async (request) => {
        if (fixture.expectedD2.some((finding) =>
          !('expectationVersion' in finding) ||
          finding.expectationVersion !== PHARMACEUTICAL_D3_D2_EXPECTATION_VERSION_V3)) {
          throw new Error('expected /3 fixture');
        }
        const result = providerResult(fixture as PharmaceuticalD3LiveFixtureV3, request, literalByMessageRef);
        mutate?.(result.findings as any[], request);
        return { providerResult: result, provider: 'openai', responseModel: 'gpt-5.6-terra' };
      },
    } satisfies PharmaceuticalD2SemanticRuntimeV2),
    allocateD1ExecutionId: () =>
      'pharm_sem_exec_d3240000-0000-4000-8000-000000000001',
    allocateD2ExecutionId: () =>
      'pharm_sem_exec_d3240000-0000-4000-8000-000000000002',
  };
}

async function runC3(
  mutate?: (findings: any[], request: PharmaceuticalD2SemanticRequestV2) => void,
  literalByMessageRef: Readonly<Record<string, number>> = {},
) {
  return runPharmaceuticalD3AcceptanceV6(
    runtimeFactory(mutate, literalByMessageRef),
    terra,
    { fixtureId: 'C3', run: 1 },
  );
}

function setRefs(
  findings: any[],
  messageRef: string,
  refs: readonly PharmaceuticalD2ClinicalRefV2[],
): void {
  const finding = findings.find((candidate) => candidate.messageRef === messageRef);
  if (finding === undefined) throw new Error(`missing finding ${messageRef}`);
  finding.relatedClinicalRefs = sortedRefs(refs);
}

describe('M6-D3R24 expectation /3 contract', () => {
  it('freezes matrix /11, comparator /3, Terra and the unchanged D2 request fingerprint', () => {
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V11).toMatchObject({
      matrixVersion: 'pharmaceutical-d3-live-matrix/11',
      contractVersions: {
        d2Expectation: PHARMACEUTICAL_D3_D2_EXPECTATION_VERSION_V3,
        d2Comparator: PHARMACEUTICAL_D3_D2_COMPARATOR_VERSION_V3,
        d2Request: 'pharmaceutical-d2-semantic-request/2',
        d2ProviderResult: 'pharmaceutical-d2-provider-result/2',
      },
      promptVersions: { d2: 'pharmaceutical-d2-claim-prompt/4' },
      policyVersions: { d2: 'pharmaceutical-d2-claim-policy/1' },
      model: 'gpt-5.6-terra',
      threshold: { requiredFraction: 1, majorityVote: false },
    });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V11.fingerprint).toEqual({
      algorithm: 'sha256',
      canonicalization: 'pharmaceutical-d3-live-matrix-v11/1',
      value: PHARMACEUTICAL_D3_LIVE_MATRIX_FINGERPRINT_V11,
    });
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_FINGERPRINT_V11)
      .toBe('e98c4ffb8ebd6c025bf9d23f2282d69662c70b192c6d68f3daa6ba661c0112b1');
    expect(PHARMACEUTICAL_D3_CANDIDATE_REGISTRATION_V11).toMatchObject({
      status: 'PENDING LIVE ACCEPTANCE',
      matrixVersion: 'pharmaceutical-d3-live-matrix/11',
      model: 'gpt-5.6-terra',
    });
    expect(calculatePharmaceuticalD3CallBudgetV1(PHARMACEUTICAL_D3_LIVE_MATRIX_V11))
      .toMatchObject({ total: 82, d1: 61, d2: 21 });
    expect(buildPharmaceuticalD2RelationalSemanticRequestV2(
      c3.context,
      'pharmaceutical-d2-claim-prompt/4',
    ).requestFingerprint.value).toBe(
      'ca1e4bfbbc099a1a15e89f0c3684b4f4335a4ce6fce3c31911c758575724dd5e',
    );
  });

  it('registers exactly the five C3 semantic identities', () => {
    expect(c3.expectedD2.map((finding) => finding.semanticClassification)).toEqual([
      { messageRef: '2', domain: 'PROFESSIONAL_RESPONSE', findingType: 'UNSUPPORTED', claimForm: 'RECOMMENDATION' },
      { messageRef: '7', domain: 'ADHERENCE', findingType: 'CONTRADICTORY', claimForm: 'ASSERTION' },
      { messageRef: '8', domain: 'ADHERENCE', findingType: 'UNSUPPORTED', claimForm: 'CONCLUSION' },
      { messageRef: '9', domain: 'PROFESSIONAL_RESPONSE', findingType: 'UNSUPPORTED', claimForm: 'RECOMMENDATION' },
      { messageRef: '11', domain: 'RNM_RELATION', findingType: 'UNSUPPORTED', claimForm: 'ASSERTION' },
    ]);
  });

  it('registers the exact literal and required/optional provenance policies', () => {
    expect(c3.expectedD2.map((finding) => ({
      messageRef: finding.semanticClassification.messageRef,
      literals: finding.literalAlternatives,
      required: finding.provenancePolicy.requiredClinicalRefs.map(pharmaceuticalD2ClinicalRefKey),
      optional: finding.provenancePolicy.optionalClinicalRefs.map(pharmaceuticalD2ClinicalRefKey),
    }))).toEqual([
      {
        messageRef: '2',
        literals: [{ excerpt: 'Debe suspenderlo.', excerptStart: 0, excerptEnd: 17 }],
        required: [],
        optional: ['CONCLUSION:conclusion_d3000000-0000-4000-8000-000000000013'],
      },
      {
        messageRef: '7',
        literals: [{ excerpt: 'La barrera FORGETFULNESS corresponde al Medicamento A.', excerptStart: 0, excerptEnd: 54 }],
        required: [
          'CONCLUSION:conclusion_d3000000-0000-4000-8000-000000000009',
          'MEDICATION:med_d3000000-0000-4000-8000-000000000001',
        ],
        optional: [
          'CONCLUSION:conclusion_d3000000-0000-4000-8000-000000000006',
          'CONCLUSION:conclusion_d3000000-0000-4000-8000-000000000015',
          'MEDICATION:med_d3000000-0000-4000-8000-000000000003',
        ],
      },
      {
        messageRef: '8',
        literals: [
          { excerpt: 'concluyo que existe una barrera de dificultad para tragar', excerptStart: 7, excerptEnd: 64 },
          { excerpt: 'Además concluyo que existe una barrera de dificultad para tragar.', excerptStart: 0, excerptEnd: 65 },
        ],
        required: ['CONCLUSION:conclusion_d3000000-0000-4000-8000-000000000009'],
        optional: ['CONCLUSION:conclusion_d3000000-0000-4000-8000-000000000008'],
      },
      {
        messageRef: '9',
        literals: [{ excerpt: 'Le recomiendo una intervención alternativa no enumerada.', excerptStart: 0, excerptEnd: 56 }],
        required: ['CONCLUSION:conclusion_d3000000-0000-4000-8000-000000000013'],
        optional: [],
      },
      {
        messageRef: '11',
        literals: [{ excerpt: 'Afirmo una causalidad clínica adicional no representada.', excerptStart: 0, excerptEnd: 56 }],
        required: ['RELATION:conclusion_d3000000-0000-4000-8000-000000000005'],
        optional: [],
      },
    ]);
  });

  it.each([
    ['no literals', (draft: any) => { draft.literalAlternatives = []; }],
    ['duplicate literal', (draft: any) => { draft.literalAlternatives.push(structuredClone(draft.literalAlternatives[0])); }],
    ['empty literal', (draft: any) => { draft.literalAlternatives[0].excerpt = ''; }],
    ['wrong start', (draft: any) => { draft.literalAlternatives[0].excerptStart += 1; }],
    ['wrong end', (draft: any) => { draft.literalAlternatives[0].excerptEnd -= 1; }],
    ['duplicate required', (draft: any) => { draft.provenancePolicy.requiredClinicalRefs.push(structuredClone(draft.provenancePolicy.requiredClinicalRefs[0])); }],
    ['duplicate optional', (draft: any) => { draft.provenancePolicy.optionalClinicalRefs.push(structuredClone(draft.provenancePolicy.optionalClinicalRefs[0])); }],
    ['required/optional overlap', (draft: any) => { draft.provenancePolicy.optionalClinicalRefs.push(structuredClone(draft.provenancePolicy.requiredClinicalRefs[0])); }],
    ['noncanonical order', (draft: any) => { draft.provenancePolicy.requiredClinicalRefs.reverse(); }],
    ['outside authority', (draft: any) => { draft.provenancePolicy.requiredClinicalRefs = [{ kind: 'CONCLUSION', conclusionRef: 'conclusion_d3000000-0000-4000-8000-999999999999' }]; }],
  ])('rejects malformed /3 structure: %s', (_label, mutate) => {
    const draft = structuredClone(expected('7'));
    mutate(draft);
    expect(() => validatePharmaceuticalD3ExpectedD2FindingV3(c3.context, draft)).toThrow();
  });

  it('rejects duplicate preregistered semantic identities', () => {
    const duplicate = structuredClone(expected('7'));
    expect(() => validatePharmaceuticalD3ExpectedD2SetV3(
      c3.context,
      [...c3.expectedD2, duplicate],
    )).toThrow(/duplicates a semantic identity/);
  });

  it.each([
    ['domain', 'INVENTED_DOMAIN'],
    ['findingType', 'INVENTED_FINDING'],
    ['claimForm', 'INVENTED_FORM'],
  ])('rejects invalid semantic classification member %s', (field, value) => {
    const draft = structuredClone(expected('7')) as any;
    draft.semanticClassification[field] = value;
    expect(() => validatePharmaceuticalD3ExpectedD2FindingV3(c3.context, draft)).toThrow();
  });
});

describe('M6-D3R24 comparator /3 products and fail-closed boundaries', () => {
  it.each(Array.from({ length: 8 }, (_, mask) => mask))(
    'accepts all ref 7 optional-ref products: mask %s',
    async (mask) => {
      const policy = expected('7').provenancePolicy;
      const optional = policy.optionalClinicalRefs.filter((_ref, index) => (mask & (1 << index)) !== 0);
      const result = await runC3((findings) => setRefs(
        findings,
        '7',
        [...policy.requiredClinicalRefs, ...optional],
      ));
      expect(result.decision).toBe('ACCEPT');
    },
  );

  it.each([
    ['missing C009', (policy: PharmaceuticalD3ExpectedD2FindingV3['provenancePolicy']) => [policy.requiredClinicalRefs[1]]],
    ['missing M001', (policy: PharmaceuticalD3ExpectedD2FindingV3['provenancePolicy']) => [policy.requiredClinicalRefs[0]]],
    ['C009 + M003 without M001', (policy: PharmaceuticalD3ExpectedD2FindingV3['provenancePolicy']) => [policy.requiredClinicalRefs[0], policy.optionalClinicalRefs[2]]],
    ['M001 + M003 without C009', (policy: PharmaceuticalD3ExpectedD2FindingV3['provenancePolicy']) => [policy.requiredClinicalRefs[1], policy.optionalClinicalRefs[2]]],
  ])('rejects ref 7 missing required provenance: %s', async (_label, refs) => {
    const result = await runC3((findings) =>
      setRefs(findings, '7', refs(expected('7').provenancePolicy)));
    expect(result.decision).not.toBe('ACCEPT');
  });

  it.each([0, 1])('rejects ref 7 allowlisted but prohibited provenance source %s', async (index) => {
    const policy = expected('7').provenancePolicy;
    const permitted = new Set([
      ...policy.requiredClinicalRefs,
      ...policy.optionalClinicalRefs,
    ].map(pharmaceuticalD2ClinicalRefKey));
    const prohibited = buildPharmaceuticalD2RelationalSemanticRequestV2(
      c3.context,
      'pharmaceutical-d2-claim-prompt/4',
    ).authorityProjection.allowedClinicalRefs.filter(
      (ref) => !permitted.has(pharmaceuticalD2ClinicalRefKey(ref)),
    )[index]!;
    const result = await runC3((findings) => setRefs(
      findings,
      '7',
      [...policy.requiredClinicalRefs, prohibited],
    ));
    expect(result.decision).toBe('REJECT');
  });

  it.each([
    ['duplicate ref', (findings: any[]) => {
      const finding = findings.find((candidate) => candidate.messageRef === '7');
      finding.relatedClinicalRefs.push(structuredClone(finding.relatedClinicalRefs[0]));
    }],
    ['non-allowlisted ref', (findings: any[]) => {
      const finding = findings.find((candidate) => candidate.messageRef === '7');
      finding.relatedClinicalRefs = [{ kind: 'CONCLUSION', conclusionRef: 'conclusion_d3000000-0000-4000-8000-999999999999' }];
    }],
  ])('fails closed for ref 7 %s', async (_label, mutate) => {
    expect((await runC3((findings) => mutate(findings))).decision).not.toBe('ACCEPT');
  });

  it.each([[0, false], [0, true], [1, false], [1, true]])(
    'accepts ref 8 literal %s with optional C008=%s',
    async (literalIndex, withOptional) => {
      const policy = expected('8').provenancePolicy;
      const result = await runC3(
        (findings) => setRefs(findings, '8', [
          ...policy.requiredClinicalRefs,
          ...(withOptional ? policy.optionalClinicalRefs : []),
        ]),
        { 8: literalIndex },
      );
      expect(result.decision).toBe('ACCEPT');
    },
  );

  it('rejects duplicate semantic identity even with two valid ref 8 literals', async () => {
    const result = await runC3((findings, request) => {
      const second = providerResult(c3, request, { 8: 1 }).findings.find(
        (finding) => finding.messageRef === '8',
      )!;
      findings.push(second);
    });
    expect(result.decision).not.toBe('ACCEPT');
  });

  it.each([
    ['unregistered exact substring', (findings: any[]) => {
      const finding = findings.find((candidate) => candidate.messageRef === '8');
      finding.excerpt = 'dificultad para tragar';
      finding.occurrenceIndex = 0;
    }],
    ['missing C009', (findings: any[]) => setRefs(findings, '8', [])],
    ['prohibited ref', (findings: any[]) => setRefs(findings, '8', expected('2').provenancePolicy.optionalClinicalRefs)],
    ['duplicate ref', (findings: any[]) => {
      const finding = findings.find((candidate) => candidate.messageRef === '8');
      finding.relatedClinicalRefs.push(structuredClone(finding.relatedClinicalRefs[0]));
    }],
  ])('fails ref 8 for %s', async (_label, mutate) => {
    expect((await runC3((findings) => mutate(findings))).decision).not.toBe('ACCEPT');
  });

  it.each([false, true])('accepts ref 2 with optional C013=%s', async (withOptional) => {
    const policy = expected('2').provenancePolicy;
    const result = await runC3((findings) => setRefs(
      findings,
      '2',
      withOptional ? policy.optionalClinicalRefs : [],
    ));
    expect(result.decision).toBe('ACCEPT');
  });

  it('does not treat ref 2 required=[] as wildcard provenance', async () => {
    const result = await runC3((findings) => setRefs(
      findings,
      '2',
      expected('7').provenancePolicy.requiredClinicalRefs.slice(0, 1),
    ));
    expect(result.decision).toBe('REJECT');
  });

  it.each(['9', '11'])('requires the sole provenance ref for finding %s', async (messageRef) => {
    expect((await runC3()).decision).toBe('ACCEPT');
    expect((await runC3((findings) => setRefs(findings, messageRef, []))).decision)
      .toBe('REJECT');
    expect((await runC3((findings) => setRefs(
      findings,
      messageRef,
      expected('7').provenancePolicy.requiredClinicalRefs,
    ))).decision).toBe('REJECT');
  });

  it.each([
    ['wrong messageRef', (finding: any) => { finding.messageRef = '6'; }],
    ['wrong domain', (finding: any) => { finding.domain = 'PRM'; }],
    ['wrong findingType', (finding: any) => { finding.findingType = 'CONTRADICTORY'; }],
    ['wrong claimForm', (finding: any) => { finding.claimForm = 'ASSERTION'; }],
    ['wrong excerpt', (finding: any) => { finding.excerpt = 'suspenderlo'; finding.occurrenceIndex = 0; }],
    ['trimmed punctuation', (finding: any) => { finding.excerpt = 'Debe suspenderlo'; finding.occurrenceIndex = 0; }],
    ['contains only', (finding: any) => { finding.excerpt = 'suspender'; finding.occurrenceIndex = 0; }],
  ])('fails exact ref 2 semantic/literal identity: %s', async (_label, mutate) => {
    const result = await runC3((findings) => mutate(
      findings.find((candidate) => candidate.messageRef === '2'),
    ));
    expect(result.decision).not.toBe('ACCEPT');
  });

  it('keeps observed /10 C006+C009+M001+M003 rejected by /2 and accepted by /3', async () => {
    const observedKeys = new Set([
      'CONCLUSION:conclusion_d3000000-0000-4000-8000-000000000006',
      'CONCLUSION:conclusion_d3000000-0000-4000-8000-000000000009',
      'MEDICATION:med_d3000000-0000-4000-8000-000000000001',
      'MEDICATION:med_d3000000-0000-4000-8000-000000000003',
    ]);
    const refs = buildPharmaceuticalD2RelationalSemanticRequestV2(
      c3.context,
      'pharmaceutical-d2-claim-prompt/4',
    ).authorityProjection.allowedClinicalRefs.filter((ref) =>
      observedKeys.has(pharmaceuticalD2ClinicalRefKey(ref)));
    const historicalFactory: PharmaceuticalD3LiveRuntimeFactoryV1 = {
      ...runtimeFactory(),
      createD2Runtime: (fixture) => ({
        detectClaims: async (request) => {
          const historical = fixture as typeof PHARMACEUTICAL_D3_LIVE_MATRIX_V10.fixtures[number];
          const findingResult = {
            schemaVersion: '2.0' as const,
            contractVersion: 'pharmaceutical-d2-provider-result/2' as const,
            findings: historical.expectedD2.map((finding) => {
              const classification = finding;
              const alternative = 'expectationVersion' in finding
                ? finding.canonicalAlternatives[0]
                : finding;
              return {
                messageRef: classification.messageRef,
                domain: classification.domain,
                findingType: classification.findingType,
                claimForm: classification.claimForm,
                excerpt: alternative.excerpt,
                occurrenceIndex: occurrenceIndex(
                  request,
                  classification.messageRef,
                  alternative.excerpt,
                  alternative.excerptStart,
                ),
                relatedClinicalRefs: classification.messageRef === '7'
                  ? sortedRefs(refs)
                  : sortedRefs(alternative.relatedClinicalRefs),
              };
            }),
          };
          return { providerResult: findingResult, provider: 'openai', responseModel: 'gpt-5.6-terra' };
        },
      }),
    };
    const historical = await runPharmaceuticalD3AcceptanceV5(
      historicalFactory,
      terra,
      { fixtureId: 'C3', run: 1 },
    );
    const current = await runC3((findings) => setRefs(findings, '7', refs));
    expect(historical.decision).toBe('REJECT');
    expect(current.decision).toBe('ACCEPT');
  });
});

describe('M6-D3R24 historical and /10→/11 invariance', () => {
  it('keeps historical fingerprints intact and every matrix with explicit D2 expectations on /2', () => {
    const historicalMatrices = [
      PHARMACEUTICAL_D3_LIVE_MATRIX_V2,
      PHARMACEUTICAL_D3_LIVE_MATRIX_V3,
      PHARMACEUTICAL_D3_LIVE_MATRIX_V4,
      PHARMACEUTICAL_D3_LIVE_MATRIX_V5,
      PHARMACEUTICAL_D3_LIVE_MATRIX_V6,
      PHARMACEUTICAL_D3_LIVE_MATRIX_V7,
      PHARMACEUTICAL_D3_LIVE_MATRIX_V8,
      PHARMACEUTICAL_D3_LIVE_MATRIX_V9,
      PHARMACEUTICAL_D3_LIVE_MATRIX_V10,
    ];
    expect(historicalMatrices.every((matrix) =>
      !('d2Expectation' in matrix.contractVersions) ||
      matrix.contractVersions.d2Expectation === 'pharmaceutical-d3-d2-expectation/2')).toBe(true);
    expect(PHARMACEUTICAL_D3_HISTORICAL_RESULT_V10).toMatchObject({
      decision: 'REJECT',
      matrixVersion: 'pharmaceutical-d3-live-matrix/10',
      matrixFingerprint: 'e435d6c6443a0ba4ce21b091d83d1bdab0e3d0bc38d3c7710d2fdb0ba04dda7c',
    });
  });

  it('changes /10→/11 only in matrix identity and D2 expectation/comparator representation', () => {
    const omitAllowedChanges = (
      matrix: typeof PHARMACEUTICAL_D3_LIVE_MATRIX_V10 | typeof PHARMACEUTICAL_D3_LIVE_MATRIX_V11,
    ) => {
      const { matrixVersion: _version, fingerprint: _fingerprint, contractVersions, fixtures, ...rest } = matrix;
      const stableContracts: Record<string, unknown> = structuredClone(contractVersions);
      delete stableContracts.d2Expectation;
      delete stableContracts.d2Comparator;
      return {
        ...rest,
        contractVersions: stableContracts,
        fixtures: fixtures.map(({ expectedD2: _expectedD2, ...fixture }) => fixture),
      };
    };
    expect(omitAllowedChanges(PHARMACEUTICAL_D3_LIVE_MATRIX_V11))
      .toEqual(omitAllowedChanges(PHARMACEUTICAL_D3_LIVE_MATRIX_V10));
    expect(calculatePharmaceuticalD3CallBudgetV1(PHARMACEUTICAL_D3_LIVE_MATRIX_V11))
      .toEqual(calculatePharmaceuticalD3CallBudgetV1(PHARMACEUTICAL_D3_LIVE_MATRIX_V10));
    expect(PHARMACEUTICAL_D3_LIVE_MATRIX_V11.fixtures.map((fixture) =>
      fixture.expectedD1)).toEqual(PHARMACEUTICAL_D3_LIVE_MATRIX_V10.fixtures.map((fixture) =>
      fixture.expectedD1));
  });
});
