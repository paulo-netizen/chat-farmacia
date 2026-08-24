import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/cases/v2/build-openai-spfa-semantic-adjudication-params', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/cases/v2/build-openai-spfa-semantic-adjudication-params')
  >();
  return {
    ...actual,
    buildOpenAiSpfaSemanticAdjudicationParamsV1: vi.fn(),
  };
});

import {
  buildOpenAiSpfaSemanticAdjudicationParamsV1,
  SPFA_SEMANTIC_ADJUDICATION_INSTRUCTIONS_V1,
  SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
} from '@/lib/cases/v2/build-openai-spfa-semantic-adjudication-params';
import type { BuildSpfaSemanticTargetContextInputV2 } from '@/lib/cases/v2/build-spfa-semantic-target-context';
import {
  executeOpenAiSpfaSemanticAdjudicationV1,
  executeOpenAiSpfaSemanticAdjudicationWithReceiptV1,
  OpenAiSpfaSemanticAdjudicationExecutionErrorV1,
  type OpenAiSpfaSemanticAdjudicationClientV1,
  type OpenAiSpfaSemanticAdjudicationExecutionConfigV1,
} from '@/lib/cases/v2/execute-openai-spfa-semantic-adjudication';
import { normalizeOpenAiSpfaSemanticAdjudicationTransportV1 } from '@/lib/cases/v2/normalize-openai-spfa-semantic-adjudication';
import { OPENAI_SPFA_SEMANTIC_ADJUDICATION_TEXT_FORMAT_V1 } from '@/lib/cases/v2/openai-spfa-semantic-adjudication-transport';
import type { SpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/spfa-evidence-baseline-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';

const ids = {
  session: '10000000-0000-4000-8000-000000000001',
  caseVersion: 'casever_20000000-0000-4000-8000-000000000001',
  spfa: 'conclusion_30000000-0000-4000-8000-000000000001',
  informationRequirement:
    'spfa_requirement_40000000-0000-4000-8000-000000000001',
  actionRequirement:
    'spfa_requirement_40000000-0000-4000-8000-000000000002',
  targetA: 'spfa_target_50000000-0000-4000-8000-000000000001',
  targetB: 'spfa_target_50000000-0000-4000-8000-000000000002',
} as const;

function transcript() {
  return createSessionTranscriptSnapshotV2({
    sessionId: ids.session,
    caseVersionId: ids.caseVersion,
    messages: [
      {
        messageId: '1',
        role: 'student',
        content: '¿Desde cuándo le ocurre?',
        createdAt: '2026-08-24T09:00:01Z',
      },
      {
        messageId: '2',
        role: 'patient',
        content: 'Desde hace tres días.',
        createdAt: '2026-08-24T09:00:02Z',
      },
      {
        messageId: '3',
        role: 'student',
        content: 'Le indico cómo realizar la actuación.',
        createdAt: '2026-08-24T09:00:03Z',
      },
      {
        messageId: '4',
        role: 'patient',
        content: 'No lo sé.',
        createdAt: '2026-08-24T09:00:04Z',
      },
    ],
  });
}

function informationBaseline(): SpfaRequirementEvidenceBaselineV2 {
  const canonicalTranscript = transcript();
  return {
    schemaVersion: '2.0',
    sessionId: ids.session,
    caseVersionId: ids.caseVersion,
    transcriptFingerprint: canonicalTranscript.fingerprint,
    carePathSpfaRef: ids.spfa,
    requirementRef: ids.informationRequirement,
    kind: 'INFORMATION_REQUIREMENT',
    resolution: 'SEMANTIC_REQUIRED',
    deterministicCoveredTargetRefs: [],
    unresolvedTargetRefs: [ids.targetA, ids.targetB],
    deterministicEvidence: [],
    semanticCandidateUniverse: [
      { targetRef: ids.targetA, messageRef: '2' },
      { targetRef: ids.targetB, messageRef: '4' },
    ],
  } as unknown as SpfaRequirementEvidenceBaselineV2;
}

function actionBaseline(): SpfaRequirementEvidenceBaselineV2 {
  const canonicalTranscript = transcript();
  return {
    schemaVersion: '2.0',
    sessionId: ids.session,
    caseVersionId: ids.caseVersion,
    transcriptFingerprint: canonicalTranscript.fingerprint,
    carePathSpfaRef: ids.spfa,
    requirementRef: ids.actionRequirement,
    kind: 'ACTION_REQUIREMENT',
    resolution: 'SEMANTIC_REQUIRED',
    deterministicPerformedTargetRefs: [],
    unresolvedTargetRefs: [ids.targetA, ids.targetB],
    deterministicEvidence: [],
    semanticCandidateUniverse: [
      { targetRef: ids.targetA, messageRef: '1' },
      { targetRef: ids.targetB, messageRef: '3' },
    ],
  } as unknown as SpfaRequirementEvidenceBaselineV2;
}

function input(
  baseline: SpfaRequirementEvidenceBaselineV2 = informationBaseline(),
): BuildSpfaSemanticTargetContextInputV2 {
  return {
    transcript: transcript(),
    baseline,
    core: { marker: 'D3C1 already validated this core' },
  } as unknown as BuildSpfaSemanticTargetContextInputV2;
}

const config: OpenAiSpfaSemanticAdjudicationExecutionConfigV1 = {
  model: 'server-owned-semantic-model',
  maxOutputTokens: 2_000,
  timeoutMs: 45_000,
};

function informationOutput() {
  return {
    contractVersion: 'openai-spfa-semantic-adjudication-output/1',
    decisions: [
      {
        targetRef: ids.targetB,
        status: 'UNCERTAIN',
        supports: [],
      },
      {
        targetRef: ids.targetA,
        status: 'SUPPORTED',
        supports: [
          {
            targetRef: ids.targetA,
            messageRef: '2',
            evidenceKind: 'PATIENT_STATEMENT',
            acquisition: {
              mode: 'ELICITED',
              studentQuestionRef: '1',
            },
          },
        ],
      },
    ],
  };
}

function actionOutput() {
  return {
    contractVersion: 'openai-spfa-semantic-adjudication-output/1',
    decisions: [
      {
        targetRef: ids.targetA,
        status: 'SUPPORTED',
        supports: [
          {
            targetRef: ids.targetA,
            messageRef: '1',
            evidenceKind: 'STUDENT_ACTION',
          },
        ],
      },
      {
        targetRef: ids.targetB,
        status: 'NOT_SUPPORTED',
        supports: [],
      },
    ],
  };
}

function response(
  outputParsed: unknown = informationOutput(),
  overrides: Record<string, unknown> = {},
) {
  return {
    model: 'actual-semantic-model',
    status: 'completed',
    error: null,
    incomplete_details: null,
    output: [],
    output_parsed: outputParsed,
    ...overrides,
  };
}

function mockClient(result: unknown) {
  const parse = vi.fn().mockResolvedValue(result);
  return {
    parse,
    client: {
      responses: { parse },
    } as unknown as OpenAiSpfaSemanticAdjudicationClientV1,
  };
}

const mockedParamsBuilder = vi.mocked(
  buildOpenAiSpfaSemanticAdjudicationParamsV1,
);

beforeEach(() => {
  mockedParamsBuilder.mockReset();
  mockedParamsBuilder.mockReturnValue({
    instructions: SPFA_SEMANTIC_ADJUDICATION_INSTRUCTIONS_V1,
    input: '{"canonical":"D3C1 request"}',
    text: { format: OPENAI_SPFA_SEMANTIC_ADJUDICATION_TEXT_FORMAT_V1 },
  });
});

async function expectExecutionError(
  promise: Promise<unknown>,
  code: OpenAiSpfaSemanticAdjudicationExecutionErrorV1['code'],
) {
  try {
    await promise;
    throw new Error('expected execution error');
  } catch (error) {
    expect(error).toBeInstanceOf(
      OpenAiSpfaSemanticAdjudicationExecutionErrorV1,
    );
    expect(error).toMatchObject({ code });
    const typed = error as OpenAiSpfaSemanticAdjudicationExecutionErrorV1;
    expect(typed.cause).toBeDefined();
    return typed;
  }
}

describe('OpenAI SPFA semantic adjudication execution', () => {
  it('executes valid information output once and returns canonical D3A order', async () => {
    const { client, parse } = mockClient(response());
    const executionInput = input();
    const result = await executeOpenAiSpfaSemanticAdjudicationV1(
      client,
      executionInput,
      config,
    );
    expect(parse).toHaveBeenCalledOnce();
    expect(mockedParamsBuilder).toHaveBeenCalledOnce();
    expect(mockedParamsBuilder).toHaveBeenCalledWith(executionInput);
    expect(result.kind).toBe('INFORMATION_REQUIREMENT');
    expect(result.decisions.map((decision) => decision.targetRef)).toEqual([
      ids.targetA,
      ids.targetB,
    ]);
    expect(result.decisions[1].status).toBe('UNCERTAIN');
  });

  it('executes valid action output and preserves NOT_SUPPORTED', async () => {
    const { client } = mockClient(response(actionOutput()));
    const result = await executeOpenAiSpfaSemanticAdjudicationV1(
      client,
      input(actionBaseline()),
      config,
    );
    expect(result.kind).toBe('ACTION_REQUIREMENT');
    expect(result.decisions.map((decision) => decision.status)).toEqual([
      'SUPPORTED',
      'NOT_SUPPORTED',
    ]);
  });

  it('uses only D3C1 params and server-owned execution configuration', async () => {
    const { client, parse } = mockClient(response());
    await executeOpenAiSpfaSemanticAdjudicationV1(client, input(), config);
    expect(parse).toHaveBeenCalledWith(
      {
        instructions: SPFA_SEMANTIC_ADJUDICATION_INSTRUCTIONS_V1,
        input: '{"canonical":"D3C1 request"}',
        text: { format: OPENAI_SPFA_SEMANTIC_ADJUDICATION_TEXT_FORMAT_V1 },
        model: config.model,
        max_output_tokens: config.maxOutputTokens,
        store: false,
      },
      { maxRetries: 0, timeout: config.timeoutMs },
    );
  });

  it('returns receipt provenance without putting it into D3A', async () => {
    const { client } = mockClient(response());
    const receipt = await executeOpenAiSpfaSemanticAdjudicationWithReceiptV1(
      client,
      input(),
      config,
    );
    expect(receipt).toMatchObject({
      provider: 'openai',
      responseModel: 'actual-semantic-model',
      promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
    });
    expect(receipt.adjudication).not.toHaveProperty('provider');
    expect(receipt.adjudication).not.toHaveProperty('responseModel');
    expect(receipt.adjudication).not.toHaveProperty('promptVersion');
  });

  it('does not mutate its inputs', async () => {
    const executionInput = input();
    const before = structuredClone(executionInput);
    const { client } = mockClient(response());
    await executeOpenAiSpfaSemanticAdjudicationV1(client, executionInput, config);
    expect(executionInput).toEqual(before);
  });

  it('takes transcript and baseline snapshots before awaiting the provider', async () => {
    let resolveResponse!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    const parse = vi.fn().mockReturnValue(pending);
    const client = {
      responses: { parse },
    } as unknown as OpenAiSpfaSemanticAdjudicationClientV1;
    const executionInput = input();
    const promise = executeOpenAiSpfaSemanticAdjudicationV1(
      client,
      executionInput,
      config,
    );
    const mutable = executionInput as unknown as {
      transcript: { messages: { content: string }[] };
      baseline: {
        sessionId: string;
        unresolvedTargetRefs: string[];
        semanticCandidateUniverse: unknown[];
      };
    };
    mutable.transcript.messages[1].content = 'MUTATED AFTER AWAIT';
    mutable.baseline.sessionId = '20000000-0000-4000-8000-000000000099';
    mutable.baseline.unresolvedTargetRefs.length = 0;
    mutable.baseline.semanticCandidateUniverse.length = 0;
    resolveResponse(response());
    const result = await promise;
    expect(result.sessionId).toBe(ids.session);
    expect(result.decisions).toHaveLength(2);
  });

  it('uses an injected client and invokes no global network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { client } = mockClient(response());
    await executeOpenAiSpfaSemanticAdjudicationV1(client, input(), config);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('transport normalization and mandatory D3A authority', () => {
  it('injects all pinning server-side and ignores provider pinning metadata', () => {
    const baseline = informationBaseline();
    const contaminated = {
      ...informationOutput(),
      sessionId: 'provider-session',
      caseVersionId: 'provider-case',
      transcriptFingerprint: { value: 'provider-fingerprint' },
      carePathSpfaRef: 'provider-spfa',
      requirementRef: 'provider-requirement',
      kind: 'ACTION_REQUIREMENT',
    } as any;
    const normalized = normalizeOpenAiSpfaSemanticAdjudicationTransportV1(
      contaminated,
      baseline,
    ) as any;
    expect(normalized).toMatchObject({
      sessionId: baseline.sessionId,
      caseVersionId: baseline.caseVersionId,
      transcriptFingerprint: baseline.transcriptFingerprint,
      carePathSpfaRef: baseline.carePathSpfaRef,
      requirementRef: baseline.requirementRef,
      kind: baseline.kind,
    });
    expect(normalized).not.toHaveProperty('provider');
    expect(normalized).not.toHaveProperty('model');
    expect(normalized).not.toHaveProperty('promptVersion');
  });

  it('revalidates output_parsed and classifies an extra field as invalid transport', async () => {
    const malformed = { ...informationOutput(), confidence: 1 };
    const { client } = mockClient(response(malformed));
    await expectExecutionError(
      executeOpenAiSpfaSemanticAdjudicationV1(client, input(), config),
      'openai_spfa_semantic_invalid_transport',
    );
  });

  it.each([
    [
      'invented target',
      (output: any) => {
        output.decisions[1].targetRef = 'invented-target';
        output.decisions[1].supports[0].targetRef = 'invented-target';
      },
    ],
    [
      'invented message',
      (output: any) => {
        output.decisions[1].supports[0].messageRef = 'invented-message';
      },
    ],
    ['omitted target', (output: any) => output.decisions.pop()],
    [
      'duplicate target',
      (output: any) => {
        output.decisions[0] = structuredClone(output.decisions[1]);
      },
    ],
    [
      'support for another target',
      (output: any) => {
        output.decisions[1].supports[0].targetRef = ids.targetB;
      },
    ],
    [
      'student evidence kind for factual information',
      (output: any) => {
        output.decisions[1].supports[0] = {
          targetRef: ids.targetA,
          messageRef: '1',
          evidenceKind: 'STUDENT_ACTION',
        };
      },
    ],
  ])('classifies schema-valid %s as D3A validation failure', async (_label, mutate) => {
    const output = informationOutput() as any;
    mutate(output);
    const { client } = mockClient(response(output));
    await expectExecutionError(
      executeOpenAiSpfaSemanticAdjudicationV1(client, input(), config),
      'openai_spfa_semantic_adjudication_validation_failed',
    );
  });

  it.each([
    ['nonexistent', '99'],
    ['patient message', '2'],
    ['later student message', '3'],
  ])('rejects invalid elicited question: %s', async (_label, questionRef) => {
    const output = informationOutput() as any;
    output.decisions[1].supports[0].acquisition.studentQuestionRef = questionRef;
    const { client } = mockClient(response(output));
    await expectExecutionError(
      executeOpenAiSpfaSemanticAdjudicationV1(client, input(), config),
      'openai_spfa_semantic_adjudication_validation_failed',
    );
  });

  it('rejects patient factual support for an action requirement', async () => {
    const output = actionOutput() as any;
    output.decisions[0].supports[0] = {
      targetRef: ids.targetA,
      messageRef: '2',
      evidenceKind: 'PATIENT_STATEMENT',
      acquisition: { mode: 'SPONTANEOUS' },
    };
    const { client } = mockClient(response(output));
    await expectExecutionError(
      executeOpenAiSpfaSemanticAdjudicationV1(
        client,
        input(actionBaseline()),
        config,
      ),
      'openai_spfa_semantic_adjudication_validation_failed',
    );
  });
});

describe('OpenAI response and configuration failures', () => {
  it.each([
    ['failed status', response(informationOutput(), { status: 'failed' }), 'openai_spfa_semantic_response_failed'],
    ['response error', response(informationOutput(), { error: { code: 'provider_error' } }), 'openai_spfa_semantic_response_failed'],
    ['incomplete', response(informationOutput(), { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' } }), 'openai_spfa_semantic_incomplete'],
    ['queued', response(informationOutput(), { status: 'queued' }), 'openai_spfa_semantic_unexpected_status'],
    ['in progress', response(informationOutput(), { status: 'in_progress' }), 'openai_spfa_semantic_unexpected_status'],
    ['cancelled', response(informationOutput(), { status: 'cancelled' }), 'openai_spfa_semantic_unexpected_status'],
    ['missing parsed output', response(null), 'openai_spfa_semantic_missing_parsed_output'],
  ])('classifies %s', async (_label, providerResponse, code) => {
    const { client } = mockClient(providerResponse);
    await expectExecutionError(
      executeOpenAiSpfaSemanticAdjudicationV1(client, input(), config),
      code as OpenAiSpfaSemanticAdjudicationExecutionErrorV1['code'],
    );
  });

  it('classifies refusal and bounds its explanation', async () => {
    const { client } = mockClient(
      response(informationOutput(), {
        output: [
          {
            type: 'message',
            content: [{ type: 'refusal', refusal: `  ${'x'.repeat(900)}  ` }],
          },
        ],
      }),
    );
    const error = await expectExecutionError(
      executeOpenAiSpfaSemanticAdjudicationV1(client, input(), config),
      'openai_spfa_semantic_refusal',
    );
    expect(error.details?.refusalExplanation).toHaveLength(500);
  });

  it('classifies client rejection without retry', async () => {
    const cause = new Error('synthetic provider failure');
    const parse = vi.fn().mockRejectedValue(cause);
    const client = { responses: { parse } } as unknown as OpenAiSpfaSemanticAdjudicationClientV1;
    const error = await expectExecutionError(
      executeOpenAiSpfaSemanticAdjudicationV1(client, input(), config),
      'openai_spfa_semantic_request_failed',
    );
    expect(error.cause).toBe(cause);
    expect(parse).toHaveBeenCalledOnce();
  });

  it.each([undefined, '', ' model ', 'x'.repeat(201)])(
    'rejects invalid response model metadata %s',
    async (model) => {
      const { client } = mockClient(response(informationOutput(), { model }));
      await expectExecutionError(
        executeOpenAiSpfaSemanticAdjudicationWithReceiptV1(
          client,
          input(),
          config,
        ),
        'openai_spfa_semantic_invalid_response_metadata',
      );
    },
  );

  it.each([
    ['empty model', { ...config, model: '' }],
    ['padded model', { ...config, model: ' model ' }],
    ['long model', { ...config, model: 'x'.repeat(201) }],
    ['zero tokens', { ...config, maxOutputTokens: 0 }],
    ['decimal tokens', { ...config, maxOutputTokens: 1.5 }],
    ['excess tokens', { ...config, maxOutputTokens: 100_001 }],
    ['zero timeout', { ...config, timeoutMs: 0 }],
    ['decimal timeout', { ...config, timeoutMs: 1.5 }],
    ['excess timeout', { ...config, timeoutMs: 600_001 }],
    ['extra property', { ...config, retries: 1 }],
  ])('rejects malformed config: %s', async (_label, malformed) => {
    const { client, parse } = mockClient(response());
    await expectExecutionError(
      executeOpenAiSpfaSemanticAdjudicationV1(
        client,
        input(),
        malformed as OpenAiSpfaSemanticAdjudicationExecutionConfigV1,
      ),
      'invalid_openai_spfa_semantic_execution_config',
    );
    expect(parse).not.toHaveBeenCalled();
    expect(mockedParamsBuilder).not.toHaveBeenCalled();
  });

  it('preserves D3C1 errors before any provider call', async () => {
    const cause = new Error('synthetic D3C1 failure');
    mockedParamsBuilder.mockImplementation(() => {
      throw cause;
    });
    const { client, parse } = mockClient(response());
    await expect(
      executeOpenAiSpfaSemanticAdjudicationV1(client, input(), config),
    ).rejects.toBe(cause);
    expect(parse).not.toHaveBeenCalled();
  });
});
