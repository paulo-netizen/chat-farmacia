import { describe, expect, it, vi } from 'vitest';

import {
  buildPatientResponseRegenerationCorrectionV2,
  executeOpenAiPatientResponseGeneratorV2,
  OpenAiPatientResponseGeneratorErrorV2,
  type OpenAiPatientResponseGeneratorClientV2,
  type OpenAiPatientResponseGeneratorConfigV2,
  type OpenAiPatientResponseGeneratorInputV2,
} from '@/lib/cases/v2/execute-openai-patient-response-generator';
import { buildPatientChatSystemPromptV2 } from '@/lib/cases/v2/patient-chat-prompt';
import type { SessionPatientClinicalContentV2 } from '@/lib/cases/v2/session-clinical-content-types';

const clinicalContent: SessionPatientClinicalContentV2 = {
  contentFormat: 'LEGACY_V1_SNAPSHOT',
  patientData: {
    nombre: 'Ana',
    edad: 61,
    sexo: 'mujer',
    tratamiento: 'Losartán 50 mg',
    motivo_consulta: 'Viene a recoger su medicación',
  },
  serviceContext: { serviceType: 'SAT' },
};

const config: OpenAiPatientResponseGeneratorConfigV2 = {
  model: 'server-owned-patient-model',
  maxTokens: 200,
  timeoutMs: 12_000,
};

function input(
  overrides: Partial<OpenAiPatientResponseGeneratorInputV2> = {},
): OpenAiPatientResponseGeneratorInputV2 {
  return {
    clinicalContent,
    acceptedConversation: [
      { role: 'student', content: '¿Cómo toma la medicación?' },
      { role: 'patient', content: 'Normalmente por la mañana.' },
    ],
    currentStudentTurn: '¿Olvida alguna dosis?',
    attempt: 'initial',
    ...overrides,
  };
}

function response(overrides: Record<string, unknown> = {}) {
  return {
    id: 'synthetic-completion',
    object: 'chat.completion',
    created: 1,
    model: 'actual-patient-model',
    choices: [
      {
        index: 0,
        logprobs: null,
        finish_reason: 'stop',
        message: {
          role: 'assistant',
          content: 'A veces se me olvida.',
          refusal: null,
        },
      },
    ],
    usage: {
      prompt_tokens: 80,
      completion_tokens: 7,
      total_tokens: 87,
    },
    ...overrides,
  };
}

function clientWith(result: unknown) {
  const create = vi.fn().mockResolvedValue(result);
  return {
    create,
    client: {
      chat: { completions: { create } },
    } as unknown as OpenAiPatientResponseGeneratorClientV2,
  };
}

async function expectError(
  promise: Promise<unknown>,
  code: OpenAiPatientResponseGeneratorErrorV2['code'],
) {
  try {
    await promise;
    throw new Error('expected generator error');
  } catch (error) {
    expect(error).toBeInstanceOf(OpenAiPatientResponseGeneratorErrorV2);
    expect(error).toMatchObject({ code });
    const typed = error as OpenAiPatientResponseGeneratorErrorV2;
    expect(typed.cause).toBeDefined();
    expect(typed.message).not.toContain('Losartán');
    expect(typed.message).not.toContain('¿Olvida alguna dosis?');
    expect(typed).not.toHaveProperty('response');
    expect(typed).not.toHaveProperty('candidate');
  }
}

describe('executeOpenAiPatientResponseGeneratorV2', () => {
  it('maps accepted history and appends the current turn exactly once', async () => {
    const { client, create } = clientWith(response());
    await executeOpenAiPatientResponseGeneratorV2(client, input(), config);

    const params = create.mock.calls[0][0];
    expect(params.messages).toEqual([
      { role: 'system', content: buildPatientChatSystemPromptV2(clinicalContent) },
      { role: 'user', content: '¿Cómo toma la medicación?' },
      { role: 'assistant', content: 'Normalmente por la mañana.' },
      { role: 'user', content: '¿Olvida alguna dosis?' },
    ]);
    expect(
      params.messages.filter(
        (message: { content: unknown }) =>
          message.content === '¿Olvida alguna dosis?',
      ),
    ).toHaveLength(1);
  });

  it('uses server-owned model limits, no SDK retry and no provider storage', async () => {
    const { client, create } = clientWith(response());
    await executeOpenAiPatientResponseGeneratorV2(client, input(), config);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'server-owned-patient-model',
        max_tokens: 200,
        store: false,
      }),
      { maxRetries: 0, timeout: 12_000 },
    );
  });

  it('returns only candidate, actual response model and observed usage', async () => {
    const { client } = clientWith(response());
    const receipt = await executeOpenAiPatientResponseGeneratorV2(
      client,
      input(),
      config,
    );
    expect(receipt).toEqual({
      candidate: { text: 'A veces se me olvida.', attempt: 'initial' },
      responseModel: 'actual-patient-model',
      usage: { inputTokens: 80, outputTokens: 7 },
    });
    expect(Object.keys(receipt).sort()).toEqual(
      ['candidate', 'responseModel', 'usage'].sort(),
    );
  });

  it('allows absent usage without inventing token metadata', async () => {
    const { client } = clientWith(response({ usage: undefined }));
    const receipt = await executeOpenAiPatientResponseGeneratorV2(
      client,
      input(),
      config,
    );
    expect(receipt).not.toHaveProperty('usage');
  });

  it('passes a null textual completion to B1 as unknown without inventing a fallback', async () => {
    const missingText = response();
    (missingText.choices[0].message as { content: unknown }).content = null;
    const { client } = clientWith(missingText);
    const receipt = await executeOpenAiPatientResponseGeneratorV2(
      client,
      input(),
      config,
    );
    expect(receipt.candidate).toEqual({ text: null, attempt: 'initial' });
  });

  it('adds a regeneration correction containing canonical closed codes only', async () => {
    const rejected = 'SECRET_REJECTED_CANDIDATE_12345';
    const { client, create } = clientWith(response());
    await executeOpenAiPatientResponseGeneratorV2(
      client,
      input({
        attempt: 'regeneration',
        retryViolationCodes: [
          'UNSUPPORTED_FACT',
          'ROLE_BREAK',
          'UNSUPPORTED_FACT',
        ],
      }),
      config,
    );
    const serialized = JSON.stringify(create.mock.calls[0][0]);
    expect(serialized).not.toContain(rejected);
    const system = create.mock.calls[0][0].messages[0].content;
    expect(system).toContain('- ROLE_BREAK\n- UNSUPPORTED_FACT');
    expect(system).toContain('Mantén el mismo caso, turno e historial aceptado.');
    expect(system).not.toContain('rationale');
  });

  it('keeps regeneration history and current turn identical to initial generation', async () => {
    const initial = clientWith(response());
    const regeneration = clientWith(response());
    await executeOpenAiPatientResponseGeneratorV2(initial.client, input(), config);
    await executeOpenAiPatientResponseGeneratorV2(
      regeneration.client,
      input({ attempt: 'regeneration', retryViolationCodes: ['ROLE_BREAK'] }),
      config,
    );
    const initialMessages = initial.create.mock.calls[0][0].messages;
    const regenerationMessages = regeneration.create.mock.calls[0][0].messages;
    expect(regenerationMessages.slice(1)).toEqual(initialMessages.slice(1));
  });

  it.each([
    ['unknown code', ['NOT_A_CLOSED_CODE']],
    ['empty codes', []],
  ])('fails before the provider for regeneration with %s', async (_label, codes) => {
    const { client, create } = clientWith(response());
    await expectError(
      executeOpenAiPatientResponseGeneratorV2(
        client,
        input({
          attempt: 'regeneration',
          retryViolationCodes: codes as never,
        }),
        config,
      ),
      'invalid_openai_patient_response_generator_input',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects retry codes on an initial attempt before the provider', async () => {
    const { client, create } = clientWith(response());
    await expectError(
      executeOpenAiPatientResponseGeneratorV2(
        client,
        input({ retryViolationCodes: ['ROLE_BREAK'] }),
        config,
      ),
      'invalid_openai_patient_response_generator_input',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('rejects invalid config before the provider', async () => {
    const { client, create } = clientWith(response());
    await expectError(
      executeOpenAiPatientResponseGeneratorV2(
        client,
        input(),
        { ...config, maxTokens: 0 },
      ),
      'invalid_openai_patient_response_generator_config',
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('maps a provider request exception without retrying', async () => {
    const create = vi.fn().mockRejectedValue(new Error('synthetic provider error'));
    const client = { chat: { completions: { create } } } as unknown as OpenAiPatientResponseGeneratorClientV2;
    await expectError(
      executeOpenAiPatientResponseGeneratorV2(client, input(), config),
      'openai_patient_response_generator_request_failed',
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing choices', { choices: undefined }, 'openai_patient_response_generator_invalid_response'],
    ['multiple choices', { choices: [response().choices[0], response().choices[0]] }, 'openai_patient_response_generator_invalid_response'],
    ['invalid model', { model: '' }, 'openai_patient_response_generator_invalid_response_metadata'],
    ['invalid usage', { usage: { prompt_tokens: -1, completion_tokens: 2 } }, 'openai_patient_response_generator_invalid_response_metadata'],
  ] as const)('fails closed for %s', async (_label, override, code) => {
    const { client } = clientWith(response(override));
    await expectError(
      executeOpenAiPatientResponseGeneratorV2(client, input(), config),
      code,
    );
  });

  it.each([
    ['content_filter', 'openai_patient_response_generator_incomplete'],
    ['length', 'openai_patient_response_generator_incomplete'],
    ['tool_calls', 'openai_patient_response_generator_unexpected_output'],
    ['function_call', 'openai_patient_response_generator_unexpected_output'],
  ] as const)('fails closed for finish_reason %s', async (finishReason, code) => {
    const output = response();
    output.choices[0].finish_reason = finishReason;
    const { client } = clientWith(output);
    await expectError(
      executeOpenAiPatientResponseGeneratorV2(client, input(), config),
      code,
    );
  });

  it('fails closed for an explicit refusal', async () => {
    const output = response();
    (output.choices[0].message as { refusal: unknown }).refusal =
      'I cannot comply';
    (output.choices[0].message as { content: unknown }).content = null;
    const { client } = clientWith(output);
    await expectError(
      executeOpenAiPatientResponseGeneratorV2(client, input(), config),
      'openai_patient_response_generator_refusal',
    );
  });

  it.each([
    ['tool call', { tool_calls: [{ id: 'synthetic-tool' }] }],
    ['function call', { function_call: { name: 'synthetic' } }],
  ])('fails closed for unexpected %s in the message', async (_label, extra) => {
    const output = response();
    Object.assign(output.choices[0].message, extra);
    const { client } = clientWith(output);
    await expectError(
      executeOpenAiPatientResponseGeneratorV2(client, input(), config),
      'openai_patient_response_generator_unexpected_output',
    );
  });
});

describe('buildPatientResponseRegenerationCorrectionV2', () => {
  it('has an exact generic server-owned format with deterministic unique codes', () => {
    expect(
      buildPatientResponseRegenerationCorrectionV2([
        'UNSUPPORTED_FACT',
        'ROLE_BREAK',
        'UNSUPPORTED_FACT',
      ]),
    ).toBe(`La respuesta anterior fue descartada por la frontera de seguridad.
Genera una nueva respuesta del mismo paciente corrigiendo únicamente estas categorías:
- ROLE_BREAK
- UNSUPPORTED_FACT
Mantén el mismo caso, turno e historial aceptado.
No añadas hechos nuevos ni actúes como profesor, evaluador, asistente o sistema.`);
  });
});
