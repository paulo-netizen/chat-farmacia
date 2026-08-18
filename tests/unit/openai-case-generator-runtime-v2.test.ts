import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { openAiConstructor } = vi.hoisted(() => ({
  openAiConstructor: vi.fn(),
}));

vi.mock('openai', () => ({
  default: class OpenAiMock {
    readonly responses = { parse: vi.fn() };

    constructor(options: unknown) {
      openAiConstructor(options);
    }
  },
}));

import { OPENAI_CASE_GENERATOR_EXECUTION_LIMITS } from '@/lib/cases/v2/execute-openai-case-generator';
import {
  createOpenAiCaseGeneratorRuntimeV2,
  OpenAiCaseGeneratorRuntimeError,
} from '@/lib/cases/v2/openai-case-generator-runtime';

const SYNTHETIC_API_KEY = 'sk-test-not-a-real-secret';

function validEnv(
  overrides: Readonly<Record<string, string | undefined>> = {},
): Readonly<Record<string, string | undefined>> {
  return {
    OPENAI_API_KEY: SYNTHETIC_API_KEY,
    OPENAI_CASE_GENERATOR_MODEL: 'test-model',
    ...overrides,
  };
}

function expectRuntimeError(
  action: () => unknown,
  code: OpenAiCaseGeneratorRuntimeError['code'],
  variableName: OpenAiCaseGeneratorRuntimeError['variableName'],
): OpenAiCaseGeneratorRuntimeError {
  try {
    action();
    throw new Error('expected OpenAiCaseGeneratorRuntimeError');
  } catch (error) {
    expect(error).toBeInstanceOf(OpenAiCaseGeneratorRuntimeError);
    const runtimeError = error as OpenAiCaseGeneratorRuntimeError;
    expect(runtimeError.code).toBe(code);
    expect(runtimeError.variableName).toBe(variableName);
    expect(
      JSON.stringify({
        name: runtimeError.name,
        message: runtimeError.message,
        code: runtimeError.code,
        variableName: runtimeError.variableName,
      }),
    ).not.toContain(SYNTHETIC_API_KEY);
    return runtimeError;
  }
}

describe('OpenAI case generator server runtime V2', () => {
  beforeEach(() => {
    openAiConstructor.mockClear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('importar el módulo no exige API key ni crea el cliente', async () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    vi.resetModules();

    await expect(
      import('@/lib/cases/v2/openai-case-generator-runtime'),
    ).resolves.toBeDefined();
    expect(openAiConstructor).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('crea el runtime válido con defaults server-owned y sin red', () => {
    const runtime = createOpenAiCaseGeneratorRuntimeV2(validEnv());

    expect(Object.keys(runtime).sort()).toEqual(['client', 'config']);
    expect(runtime.config).toEqual({
      model: 'test-model',
      maxOutputTokens: 20_000,
      timeoutMs: 180_000,
    });
    expect(Object.isFrozen(runtime.config)).toBe(true);
    expect(runtime).not.toHaveProperty('apiKey');
    expect(runtime.config).not.toHaveProperty('apiKey');
    expect(openAiConstructor).toHaveBeenCalledTimes(1);
    expect(Object.keys(openAiConstructor.mock.calls[0][0])).toEqual(['apiKey']);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('normaliza el model con trim', () => {
    const runtime = createOpenAiCaseGeneratorRuntimeV2(
      validEnv({ OPENAI_CASE_GENERATOR_MODEL: '  explicit-model  ' }),
    );

    expect(runtime.config.model).toBe('explicit-model');
  });

  it.each([
    ['ausente', undefined],
    ['vacía', ''],
    ['whitespace', '   '],
  ])('rechaza API key %s', (_, value) => {
    expectRuntimeError(
      () =>
        createOpenAiCaseGeneratorRuntimeV2(
          validEnv({ OPENAI_API_KEY: value }),
        ),
      'missing_openai_api_key',
      'OPENAI_API_KEY',
    );
    expect(openAiConstructor).not.toHaveBeenCalled();
  });

  it.each([
    ['ausente', undefined],
    ['vacío', ''],
    ['whitespace', '   '],
    [
      'demasiado largo',
      'm'.repeat(OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxModelLength + 1),
    ],
  ])('rechaza model %s', (_, value) => {
    expectRuntimeError(
      () =>
        createOpenAiCaseGeneratorRuntimeV2(
          validEnv({ OPENAI_CASE_GENERATOR_MODEL: value }),
        ),
      'invalid_openai_runtime_config',
      'OPENAI_CASE_GENERATOR_MODEL',
    );
    expect(openAiConstructor).not.toHaveBeenCalled();
  });

  it('acepta maxOutputTokens decimal válido', () => {
    const runtime = createOpenAiCaseGeneratorRuntimeV2(
      validEnv({ OPENAI_CASE_GENERATOR_MAX_OUTPUT_TOKENS: '54321' }),
    );

    expect(runtime.config.maxOutputTokens).toBe(54_321);
  });

  it.each([
    '0',
    '-1',
    '1.5',
    '1e4',
    '+100',
    '1 000',
    'NaN',
    'Infinity',
    '001',
    String(OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxOutputTokens + 1),
  ])('rechaza maxOutputTokens no decimal positivo estricto: %s', (value) => {
    expectRuntimeError(
      () =>
        createOpenAiCaseGeneratorRuntimeV2(
          validEnv({ OPENAI_CASE_GENERATOR_MAX_OUTPUT_TOKENS: value }),
        ),
      'invalid_openai_runtime_config',
      'OPENAI_CASE_GENERATOR_MAX_OUTPUT_TOKENS',
    );
    expect(openAiConstructor).not.toHaveBeenCalled();
  });

  it('acepta timeout decimal válido', () => {
    const runtime = createOpenAiCaseGeneratorRuntimeV2(
      validEnv({ OPENAI_CASE_GENERATOR_TIMEOUT_MS: '240000' }),
    );

    expect(runtime.config.timeoutMs).toBe(240_000);
  });

  it.each([
    '0',
    '-1',
    '1.5',
    '1e4',
    '+100',
    '1 000',
    'NaN',
    'Infinity',
    '001',
    String(OPENAI_CASE_GENERATOR_EXECUTION_LIMITS.maxTimeoutMs + 1),
  ])('rechaza timeout no decimal positivo estricto: %s', (value) => {
    expectRuntimeError(
      () =>
        createOpenAiCaseGeneratorRuntimeV2(
          validEnv({ OPENAI_CASE_GENERATOR_TIMEOUT_MS: value }),
        ),
      'invalid_openai_runtime_config',
      'OPENAI_CASE_GENERATOR_TIMEOUT_MS',
    );
    expect(openAiConstructor).not.toHaveBeenCalled();
  });

  it('ignora variables de entorno no relacionadas', () => {
    const runtime = createOpenAiCaseGeneratorRuntimeV2(
      validEnv({
        DATABASE_URL: 'postgresql://not-used',
        OPENAI_ORGANIZATION: 'not-used',
        OPENAI_CASE_GENERATOR_UNKNOWN: 'not-used',
      }),
    );

    expect(runtime.config).toEqual({
      model: 'test-model',
      maxOutputTokens: 20_000,
      timeoutMs: 180_000,
    });
    expect(runtime).not.toHaveProperty('DATABASE_URL');
    expect(runtime).not.toHaveProperty('OPENAI_ORGANIZATION');
  });

  it('no filtra la API key sintética en errores serializados', () => {
    const error = expectRuntimeError(
      () =>
        createOpenAiCaseGeneratorRuntimeV2(
          validEnv({ OPENAI_CASE_GENERATOR_MAX_OUTPUT_TOKENS: 'invalid' }),
        ),
      'invalid_openai_runtime_config',
      'OPENAI_CASE_GENERATOR_MAX_OUTPUT_TOKENS',
    );

    expect(error).not.toHaveProperty('cause');
    expect(JSON.stringify(error)).not.toContain(SYNTHETIC_API_KEY);
    expect(error.message).not.toContain(SYNTHETIC_API_KEY);
  });
});
