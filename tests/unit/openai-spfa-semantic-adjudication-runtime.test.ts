import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { BuildSpfaSemanticTargetContextInputV2 } from '../../lib/cases/v2/build-spfa-semantic-target-context';
import { SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION } from '../../lib/cases/v2/build-openai-spfa-semantic-adjudication-params';
import {
  OpenAiSpfaSemanticAdjudicationExecutionErrorV1,
  type OpenAiSpfaSemanticAdjudicationExecutionReceiptV1,
} from '../../lib/cases/v2/execute-openai-spfa-semantic-adjudication';
import {
  createOpenAiSpfaSemanticAdjudicationRuntimeV2,
  OPENAI_SPFA_SEMANTIC_PRODUCTION_MODEL,
  OpenAiSpfaSemanticAdjudicationRuntimeErrorV2,
  type OpenAiSpfaSemanticAdjudicationRuntimeDependenciesV2,
} from '../../lib/cases/v2/openai-spfa-semantic-adjudication-runtime';

const SYNTHETIC_API_KEY = 'sk-synthetic-spfa-runtime-key';
const semanticInput = Object.freeze({
  synthetic: 'semantic-input',
}) as unknown as BuildSpfaSemanticTargetContextInputV2;
const receipt = Object.freeze({
  adjudication: { synthetic: 'validated-adjudication' },
  provider: 'openai',
  responseModel: 'gpt-5.6-sol-observed',
  promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
}) as unknown as OpenAiSpfaSemanticAdjudicationExecutionReceiptV1;

function validEnv(
  overrides: Readonly<Record<string, string | undefined>> = {},
): Readonly<Record<string, string | undefined>> {
  return {
    OPENAI_API_KEY: SYNTHETIC_API_KEY,
    OPENAI_SPFA_SEMANTIC_MODEL: OPENAI_SPFA_SEMANTIC_PRODUCTION_MODEL,
    ...overrides,
  };
}

function fakeDependencies() {
  const client = { responses: { parse: vi.fn() } };
  const createClient = vi.fn<
    OpenAiSpfaSemanticAdjudicationRuntimeDependenciesV2['createClient']
  >(() => client);
  const execute = vi.fn<
    OpenAiSpfaSemanticAdjudicationRuntimeDependenciesV2['execute']
  >(async () => receipt);
  return {
    client,
    createClient,
    execute,
    dependencies: { createClient, execute } as unknown as
      OpenAiSpfaSemanticAdjudicationRuntimeDependenciesV2,
  };
}

function expectRuntimeError(
  action: () => unknown,
  code: OpenAiSpfaSemanticAdjudicationRuntimeErrorV2['code'],
  variableName: OpenAiSpfaSemanticAdjudicationRuntimeErrorV2['variableName'],
): OpenAiSpfaSemanticAdjudicationRuntimeErrorV2 {
  try {
    action();
    throw new Error('expected runtime failure');
  } catch (error) {
    expect(error).toBeInstanceOf(OpenAiSpfaSemanticAdjudicationRuntimeErrorV2);
    const runtimeError = error as OpenAiSpfaSemanticAdjudicationRuntimeErrorV2;
    expect(runtimeError.code).toBe(code);
    expect(runtimeError.variableName).toBe(variableName);
    return runtimeError;
  }
}

describe('OpenAI SPFA semantic adjudication server runtime V2', () => {
  it('uses the accepted gpt-5.6-sol production model and D3C3 defaults', async () => {
    const fake = fakeDependencies();
    const runtime = createOpenAiSpfaSemanticAdjudicationRuntimeV2(
      validEnv(),
      fake.dependencies,
    );
    await runtime.adjudicate(semanticInput);
    expect(fake.execute).toHaveBeenCalledWith(fake.client, semanticInput, {
      model: 'gpt-5.6-sol',
      maxOutputTokens: 2_000,
      timeoutMs: 60_000,
    });
  });

  it('does not allow semantic input to select client, model or configuration', async () => {
    const fake = fakeDependencies();
    const runtime = createOpenAiSpfaSemanticAdjudicationRuntimeV2(
      validEnv(),
      fake.dependencies,
    );
    const hostileInput = {
      ...semanticInput,
      model: 'gpt-5.6-terra',
      apiKey: 'client-key',
      timeoutMs: 1,
    } as unknown as BuildSpfaSemanticTargetContextInputV2;
    await runtime.adjudicate(hostileInput);
    expect(fake.execute.mock.calls[0][1]).toBe(hostileInput);
    expect(fake.execute.mock.calls[0][2]).toEqual({
      model: 'gpt-5.6-sol',
      maxOutputTokens: 2_000,
      timeoutMs: 60_000,
    });
  });

  it('adapts the exact E2 input to the accepted D3C executor', async () => {
    const fake = fakeDependencies();
    const runtime = createOpenAiSpfaSemanticAdjudicationRuntimeV2(
      validEnv(),
      fake.dependencies,
    );
    await runtime.adjudicate(semanticInput);
    expect(fake.execute).toHaveBeenCalledTimes(1);
    expect(fake.execute.mock.calls[0][1]).toBe(semanticInput);
  });

  it('returns the exact validated receipt without rewriting metadata', async () => {
    const fake = fakeDependencies();
    const runtime = createOpenAiSpfaSemanticAdjudicationRuntimeV2(
      validEnv(),
      fake.dependencies,
    );
    const result = await runtime.adjudicate(semanticInput);
    expect(result).toBe(receipt);
    expect(result.responseModel).toBe('gpt-5.6-sol-observed');
    expect(result.promptVersion).toBe(
      SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
    );
  });

  it('creates one client and reuses it across requirement adjudications', async () => {
    const fake = fakeDependencies();
    const runtime = createOpenAiSpfaSemanticAdjudicationRuntimeV2(
      validEnv(),
      fake.dependencies,
    );
    await runtime.adjudicate(semanticInput);
    await runtime.adjudicate(semanticInput);
    expect(fake.createClient).toHaveBeenCalledTimes(1);
    expect(fake.execute).toHaveBeenCalledTimes(2);
    expect(fake.execute.mock.calls[0][0]).toBe(fake.execute.mock.calls[1][0]);
  });

  it('keeps API key and execution config out of the returned runtime', () => {
    const fake = fakeDependencies();
    const runtime = createOpenAiSpfaSemanticAdjudicationRuntimeV2(
      validEnv(),
      fake.dependencies,
    );
    expect(Object.keys(runtime)).toEqual(['adjudicate']);
    expect(runtime).not.toHaveProperty('apiKey');
    expect(runtime).not.toHaveProperty('config');
    expect(Object.isFrozen(runtime)).toBe(true);
  });

  it.each([undefined, '', '   '])(
    'fails closed when API key is absent or empty: %s',
    (value) => {
      const fake = fakeDependencies();
      expectRuntimeError(
        () => createOpenAiSpfaSemanticAdjudicationRuntimeV2(
          validEnv({ OPENAI_API_KEY: value }),
          fake.dependencies,
        ),
        'missing_openai_api_key',
        'OPENAI_API_KEY',
      );
      expect(fake.createClient).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, '', ' ', 'gpt-5.6-terra', 'gpt-5.6'])
    ('rejects missing, aliased or non-Sol model configuration: %s', (model) => {
      const fake = fakeDependencies();
      expectRuntimeError(
        () => createOpenAiSpfaSemanticAdjudicationRuntimeV2(
          validEnv({ OPENAI_SPFA_SEMANTIC_MODEL: model }),
          fake.dependencies,
        ),
        'invalid_openai_spfa_semantic_runtime_config',
        'OPENAI_SPFA_SEMANTIC_MODEL',
      );
      expect(fake.createClient).not.toHaveBeenCalled();
    });

  it('allows bounded server-owned token and timeout overrides', async () => {
    const fake = fakeDependencies();
    const runtime = createOpenAiSpfaSemanticAdjudicationRuntimeV2(
      validEnv({
        OPENAI_SPFA_SEMANTIC_MAX_OUTPUT_TOKENS: '3000',
        OPENAI_SPFA_SEMANTIC_TIMEOUT_MS: '120000',
      }),
      fake.dependencies,
    );
    await runtime.adjudicate(semanticInput);
    expect(fake.execute.mock.calls[0][2]).toMatchObject({
      maxOutputTokens: 3_000,
      timeoutMs: 120_000,
    });
  });

  it.each([
    ['OPENAI_SPFA_SEMANTIC_MAX_OUTPUT_TOKENS', '0'],
    ['OPENAI_SPFA_SEMANTIC_MAX_OUTPUT_TOKENS', '1.5'],
    ['OPENAI_SPFA_SEMANTIC_MAX_OUTPUT_TOKENS', '100001'],
    ['OPENAI_SPFA_SEMANTIC_TIMEOUT_MS', '0'],
    ['OPENAI_SPFA_SEMANTIC_TIMEOUT_MS', '600001'],
  ] as const)('rejects invalid %s=%s', (variableName, value) => {
    const fake = fakeDependencies();
    expectRuntimeError(
      () => createOpenAiSpfaSemanticAdjudicationRuntimeV2(
        validEnv({ [variableName]: value }),
        fake.dependencies,
      ),
      'invalid_openai_spfa_semantic_runtime_config',
      variableName,
    );
    expect(fake.createClient).not.toHaveBeenCalled();
  });

  it.each([
    'openai_spfa_semantic_request_failed',
    'openai_spfa_semantic_refusal',
    'openai_spfa_semantic_incomplete',
    'openai_spfa_semantic_invalid_transport',
  ] as const)('propagates accepted executor failure %s without fallback', async (code) => {
    const fake = fakeDependencies();
    const expected = new OpenAiSpfaSemanticAdjudicationExecutionErrorV1(
      code,
      'synthetic.path',
      'safe synthetic failure',
      new Error('provider cause'),
    );
    fake.execute.mockRejectedValueOnce(expected);
    const runtime = createOpenAiSpfaSemanticAdjudicationRuntimeV2(
      validEnv(),
      fake.dependencies,
    );
    await expect(runtime.adjudicate(semanticInput)).rejects.toBe(expected);
    expect(fake.execute).toHaveBeenCalledTimes(1);
  });

  it('does not retry or fall back when the executor fails', async () => {
    const fake = fakeDependencies();
    const expected = new Error('single synthetic failure');
    fake.execute.mockRejectedValueOnce(expected);
    const runtime = createOpenAiSpfaSemanticAdjudicationRuntimeV2(
      validEnv(),
      fake.dependencies,
    );
    await expect(runtime.adjudicate(semanticInput)).rejects.toBe(expected);
    expect(fake.execute).toHaveBeenCalledTimes(1);
    expect(fake.createClient).toHaveBeenCalledTimes(1);
  });

  it('does not serialize a synthetic API key from a client initialization cause', () => {
    const fake = fakeDependencies();
    fake.createClient.mockImplementationOnce(() => {
      throw new Error(`provider rejected ${SYNTHETIC_API_KEY}`);
    });
    const error = expectRuntimeError(
      () => createOpenAiSpfaSemanticAdjudicationRuntimeV2(
        validEnv(),
        fake.dependencies,
      ),
      'openai_spfa_semantic_client_initialization_failed',
      'OPENAI_API_KEY',
    );
    expect(JSON.stringify(error)).not.toContain(SYNTHETIC_API_KEY);
    expect(error.message).not.toContain(SYNTHETIC_API_KEY);
  });

  it('does not import the legacy lib/openai boundary or contain Terra fallback', () => {
    const source = readFileSync(
      'lib/cases/v2/openai-spfa-semantic-adjudication-runtime.ts',
      'utf8',
    );
    expect(source).not.toMatch(/from ['"](?:@\/)?lib\/openai/);
    expect(source).not.toContain('gpt-5.6-terra');
    expect(source).not.toMatch(/fallback|retry/i);
  });
});
