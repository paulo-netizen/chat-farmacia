import { describe, expect, it, vi } from 'vitest';

import type {
  OpenAiPatientResponseGeneratorClientV2,
  OpenAiPatientResponseGeneratorConfigV2,
} from '@/lib/cases/v2/execute-openai-patient-response-generator';
import type {
  OpenAiPatientResponseValidatorClientV2,
  OpenAiPatientResponseValidatorExecutionConfigV2,
} from '@/lib/cases/v2/execute-openai-patient-response-validator';
import {
  generateSafePatientReplyV2,
  MAX_PATIENT_RESPONSE_REGENERATIONS,
  PatientResponseSafetyErrorV2,
  type GenerateSafePatientReplyDependenciesV2,
  type GenerateSafePatientReplyInputV2,
  type PatientResponseSafetyCallReceiptV2,
} from '@/lib/cases/v2/generate-safe-patient-reply';
import type { SessionPatientClinicalContentV2 } from '@/lib/cases/v2/session-clinical-content-types';

const uuid = '10000000-0000-4000-8000-000000000001';
const rejectedCandidate = `SECRET_REJECTED_CANDIDATE_12345 fact_${uuid}`;

function legacyClinicalContent(): SessionPatientClinicalContentV2 {
  return {
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
}

function generatedClinicalContent(): SessionPatientClinicalContentV2 {
  const known = (factId: string, value: unknown) => ({
    state: 'known',
    factId,
    value,
    certainty: 'exact',
    disclosure: { mode: 'spontaneous' },
  });
  return {
    contentFormat: 'GENERATED_CASE_BUNDLE_V2',
    patientRuntime: {
      schemaVersion: '2.0',
      caseVersionId: 'casever_90000000-0000-4000-8000-000000000001',
      publicProfile: {
        nombre: 'María', edad: 68, sexo: 'mujer', tratamiento: 'Enalapril',
      },
      initialDemand: known(
        'fact_10000000-0000-4000-8000-000000000001',
        'Vengo a recoger mi medicación',
      ),
      encounter: {
        personPresent: known(
          'fact_10000000-0000-4000-8000-000000000002',
          'patient',
        ),
      },
      clinicalContext: {
        healthProblems: [],
        clinicalHistory: [],
        allergiesAndIntolerances: [],
        physiologicalSituation: [],
        lifestyle: [],
        biomedicalData: [],
      },
      symptoms: [],
      pharmacotherapy: {
        prescribedMedications: [],
        otherMedicinesAndProducts: [],
        actualMedicationUse: [],
        recentChanges: [],
        perceivedEffectiveness: [],
        perceivedSafety: [],
      },
      actionsAlreadyTaken: [],
      practicalDifficulties: [],
      beliefsAndConcerns: [],
      strategiesAlreadyTried: [],
      dailyAndSocialContext: [],
      familyAndSocialSupport: [],
      relationshipWithProfessionals: [],
      communicationProfile: {
        sociability: 3,
        cooperation: 4,
        organization: 2,
        emotionalReactivity: 3,
        opennessToChange: 4,
        healthLiteracy: 'medium',
        professionalTrust: 4,
        medicationAttitude: 'cautious',
        decisionStyle: 'shared',
        readinessToChange: 3,
        socialDesirability: 2,
        judgmentSensitivity: 4,
        disclosureThreshold: 3,
        answerLength: 'brief',
        assertiveness: 2,
        emotionalExpression: 3,
      },
    } as never,
    serviceContext: {
      initialSpfa: { service: 'dispensing', subtype: 'continuation' },
      additionalSpfas: [],
    },
  };
}

function orchestrationInput(
  clinicalContent: SessionPatientClinicalContentV2 = legacyClinicalContent(),
): GenerateSafePatientReplyInputV2 {
  return {
    clinicalContent,
    acceptedConversation: [
      { role: 'student', content: '¿Cómo se encuentra?' },
      { role: 'patient', content: 'Bien, gracias.' },
    ],
    currentStudentTurn: '¿Cómo toma su medicación?',
  };
}

function generationResponse(
  text: unknown,
  options: {
    model?: string;
    usage?: { prompt_tokens: number; completion_tokens: number } | null;
  } = {},
) {
  return {
    id: 'synthetic-patient-completion',
    object: 'chat.completion',
    created: 1,
    model: options.model ?? 'actual-patient-model',
    choices: [
      {
        index: 0,
        logprobs: null,
        finish_reason: 'stop',
        message: { role: 'assistant', content: text, refusal: null },
      },
    ],
    ...(options.usage === null
      ? {}
      : {
          usage: {
            prompt_tokens: options.usage?.prompt_tokens ?? 50,
            completion_tokens: options.usage?.completion_tokens ?? 5,
            total_tokens:
              (options.usage?.prompt_tokens ?? 50) +
              (options.usage?.completion_tokens ?? 5),
          },
        }),
  };
}

function validatorResponse(
  decision: 'PASS' | 'RETRY',
  options: {
    violations?: readonly string[];
    model?: string;
    usage?: { input_tokens: number; output_tokens: number } | null;
    outputParsed?: unknown;
  } = {},
) {
  return {
    model: options.model ?? 'actual-validator-model',
    status: 'completed',
    error: null,
    incomplete_details: null,
    output: [],
    output_parsed: Object.prototype.hasOwnProperty.call(options, 'outputParsed')
      ? options.outputParsed
      : {
          schemaVersion: '1.0',
          decision,
          violations:
            decision === 'PASS'
              ? []
              : options.violations ?? ['UNSUPPORTED_FACT'],
        },
    ...(options.usage === null
      ? {}
      : {
          usage: {
            input_tokens: options.usage?.input_tokens ?? 70,
            output_tokens: options.usage?.output_tokens ?? 4,
            total_tokens:
              (options.usage?.input_tokens ?? 70) +
              (options.usage?.output_tokens ?? 4),
          },
        }),
  };
}

function dependencies(
  generationResults: readonly unknown[],
  validationResults: readonly unknown[],
) {
  const create = vi.fn();
  for (const result of generationResults) {
    result instanceof Error
      ? create.mockRejectedValueOnce(result)
      : create.mockResolvedValueOnce(result);
  }
  const parse = vi.fn();
  for (const result of validationResults) {
    result instanceof Error
      ? parse.mockRejectedValueOnce(result)
      : parse.mockResolvedValueOnce(result);
  }
  const patientConfig: OpenAiPatientResponseGeneratorConfigV2 = {
    model: 'configured-patient-model', maxTokens: 200, timeoutMs: 10_000,
  };
  const validatorConfig: OpenAiPatientResponseValidatorExecutionConfigV2 = {
    model: 'configured-validator-model', maxOutputTokens: 300, timeoutMs: 11_000,
  };
  const value: GenerateSafePatientReplyDependenciesV2 = {
    patientGenerator: {
      client: { chat: { completions: { create } } } as unknown as OpenAiPatientResponseGeneratorClientV2,
      config: patientConfig,
    },
    semanticValidator: {
      client: { responses: { parse } } as unknown as OpenAiPatientResponseValidatorClientV2,
      config: validatorConfig,
    },
  };
  return { value, create, parse };
}

async function expectSafetyError(
  promise: Promise<unknown>,
  code: PatientResponseSafetyErrorV2['code'],
  forbidden = rejectedCandidate,
) {
  try {
    await promise;
    throw new Error('expected safety error');
  } catch (error) {
    expect(error).toBeInstanceOf(PatientResponseSafetyErrorV2);
    expect(error).toMatchObject({ code });
    const typed = error as PatientResponseSafetyErrorV2;
    expect(typed.message).not.toContain(forbidden);
    expect(typed.message).not.toContain('Losartán');
    expect(typed.message).not.toContain('¿Cómo toma su medicación?');
    expect(typed).not.toHaveProperty('candidate');
    expect(typed).not.toHaveProperty('clinicalContent');
    expect(typed).not.toHaveProperty('prompt');
    expect(typed).not.toHaveProperty('receipt');
    const serializedCalls = JSON.stringify(typed.calls);
    expect(serializedCalls).not.toContain(forbidden);
    expect(serializedCalls).not.toContain('candidate');
    expect(serializedCalls).not.toContain('Losartán');
    expect(serializedCalls).not.toContain('¿Cómo toma su medicación?');
    expect(serializedCalls).not.toContain('clinicalContent');
    expect(serializedCalls).not.toContain('validationContext');
    expect(serializedCalls).not.toContain('prompt');
    return typed;
  }
}

describe('generateSafePatientReplyV2', () => {
  it('accepts an initial candidate only after real B1 and B2 PASS', async () => {
    const deps = dependencies(
      [generationResponse('A veces la tomo más tarde.')],
      [validatorResponse('PASS')],
    );
    const result = await generateSafePatientReplyV2(
      orchestrationInput(),
      deps.value,
    );
    expect(result.reply).toBe('A veces la tomo más tarde.');
    expect(deps.create).toHaveBeenCalledTimes(1);
    expect(deps.parse).toHaveBeenCalledTimes(1);
    expect(result.receipt).toEqual({
      calls: [
        {
          kind: 'patient_generation', attempt: 'initial',
          model: 'actual-patient-model', inputTokens: 50, outputTokens: 5,
        },
        {
          kind: 'semantic_validation', attempt: 'initial',
          model: 'actual-validator-model', inputTokens: 70, outputTokens: 4,
        },
      ],
      totalInputTokens: 120,
      totalOutputTokens: 9,
      usageComplete: true,
    });
  });

  it('regenerates after initial B1 RETRY without validating the rejected candidate', async () => {
    const deps = dependencies(
      [generationResponse(rejectedCandidate), generationResponse('La tomo por la mañana.')],
      [validatorResponse('PASS')],
    );
    const result = await generateSafePatientReplyV2(orchestrationInput(), deps.value);
    expect(result.reply).toBe('La tomo por la mañana.');
    expect(deps.create).toHaveBeenCalledTimes(2);
    expect(deps.parse).toHaveBeenCalledTimes(1);
    expect(result.receipt.retryViolationCodes).toEqual(['INTERNAL_IDENTIFIER']);
    expect(result.receipt.calls.map(({ kind, attempt }) => ({ kind, attempt }))).toEqual([
      { kind: 'patient_generation', attempt: 'initial' },
      { kind: 'patient_generation', attempt: 'regeneration' },
      { kind: 'semantic_validation', attempt: 'regeneration' },
    ]);
  });

  it('regenerates after a valid semantic RETRY and accepts the second PASS', async () => {
    const deps = dependencies(
      [generationResponse('Primera candidata.'), generationResponse('Segunda candidata segura.')],
      [validatorResponse('RETRY', { violations: ['ROLE_BREAK'] }), validatorResponse('PASS')],
    );
    const result = await generateSafePatientReplyV2(orchestrationInput(), deps.value);
    expect(result.reply).toBe('Segunda candidata segura.');
    expect(deps.create).toHaveBeenCalledTimes(2);
    expect(deps.parse).toHaveBeenCalledTimes(2);
    expect(result.receipt.retryViolationCodes).toEqual(['ROLE_BREAK']);
  });

  it('fails closed when both candidates fail B1 and never calls B2', async () => {
    const deps = dependencies(
      [generationResponse(rejectedCandidate), generationResponse(`otro fact_${uuid}`)],
      [],
    );
    await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'UNSAFE_AFTER_REGENERATION',
    );
    expect(deps.create).toHaveBeenCalledTimes(2);
    expect(deps.parse).not.toHaveBeenCalled();
  });

  it('fails closed after a second semantic RETRY with no third attempt', async () => {
    const deps = dependencies(
      [generationResponse('Primera.'), generationResponse('Segunda.')],
      [validatorResponse('RETRY'), validatorResponse('RETRY')],
    );
    await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'UNSAFE_AFTER_REGENERATION',
    );
    expect(deps.create).toHaveBeenCalledTimes(2);
    expect(deps.parse).toHaveBeenCalledTimes(2);
  });

  it('does not regenerate or validate after an initial patient provider error', async () => {
    const deps = dependencies([new Error('synthetic patient provider failure')], []);
    const error = await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'PATIENT_GENERATION_FAILED',
    );
    expect(error.stage).toBe('generation');
    expect(error.calls).toEqual([]);
    expect(deps.create).toHaveBeenCalledTimes(1);
    expect(deps.parse).not.toHaveBeenCalled();
  });

  it('maps an initial validator technical failure and does not regenerate', async () => {
    const deps = dependencies(
      [generationResponse('Candidata.')],
      [new Error('synthetic validator provider failure')],
    );
    const error = await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'VALIDATOR_FAILED',
    );
    expect(error.stage).toBe('validation');
    expect(error.calls).toEqual([
      {
        kind: 'patient_generation', attempt: 'initial',
        model: 'actual-patient-model', inputTokens: 50, outputTokens: 5,
      },
    ]);
    expect(deps.create).toHaveBeenCalledTimes(1);
    expect(deps.parse).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['missing', validatorResponse('PASS', { outputParsed: null })],
    ['invalid', validatorResponse('PASS', { outputParsed: { decision: 'MALFORMED' } })],
  ])('maps %s validator output to INVALID_VALIDATOR_OUTPUT without regeneration', async (_label, validation) => {
    const deps = dependencies([generationResponse('Candidata.')], [validation]);
    await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'INVALID_VALIDATOR_OUTPUT',
    );
    expect(deps.create).toHaveBeenCalledTimes(1);
    expect(deps.parse).toHaveBeenCalledTimes(1);
  });

  it('fails closed if the regeneration provider fails and never attempts a third generation', async () => {
    const deps = dependencies(
      [generationResponse(rejectedCandidate), new Error('synthetic regeneration failure')],
      [],
    );
    const error = await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'PATIENT_GENERATION_FAILED',
    );
    expect(error.stage).toBe('regeneration');
    expect(error.calls.map(({ kind, attempt }) => ({ kind, attempt }))).toEqual([
      { kind: 'patient_generation', attempt: 'initial' },
    ]);
    expect(deps.create).toHaveBeenCalledTimes(2);
    expect(deps.parse).not.toHaveBeenCalled();
  });

  it('fails closed if the regenerated candidate validator fails and never attempts a third generation', async () => {
    const deps = dependencies(
      [generationResponse(rejectedCandidate), generationResponse('Regenerada.')],
      [new Error('synthetic validator failure after regeneration')],
    );
    const error = await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'VALIDATOR_FAILED',
    );
    expect(error.stage).toBe('regeneration');
    expect(error.calls.map(({ kind, attempt }) => ({ kind, attempt }))).toEqual([
      { kind: 'patient_generation', attempt: 'initial' },
      { kind: 'patient_generation', attempt: 'regeneration' },
    ]);
    expect(deps.create).toHaveBeenCalledTimes(2);
    expect(deps.parse).toHaveBeenCalledTimes(1);
  });

  it('never sends or returns the rejected candidate during regeneration', async () => {
    const deps = dependencies(
      [generationResponse(rejectedCandidate), generationResponse('Regenerada segura.')],
      [validatorResponse('PASS')],
    );
    const result = await generateSafePatientReplyV2(orchestrationInput(), deps.value);
    const regenerationParams = deps.create.mock.calls[1][0];
    expect(JSON.stringify(regenerationParams)).not.toContain(rejectedCandidate);
    expect(JSON.stringify(result)).not.toContain(rejectedCandidate);
    expect(result.receipt).not.toHaveProperty('candidate');
  });

  it('keeps completed initial generation and validation calls when regeneration provider fails', async () => {
    const deps = dependencies(
      [
        generationResponse('Primera candidata.'),
        new Error('synthetic regeneration provider failure'),
      ],
      [validatorResponse('RETRY')],
    );
    const error = await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'PATIENT_GENERATION_FAILED',
    );
    expect(error.calls.map(({ kind, attempt }) => ({ kind, attempt }))).toEqual([
      { kind: 'patient_generation', attempt: 'initial' },
      { kind: 'semantic_validation', attempt: 'initial' },
    ]);
  });

  it('keeps both completed generations when regenerated B1 fails', async () => {
    const deps = dependencies(
      [generationResponse(rejectedCandidate), generationResponse(`otro fact_${uuid}`)],
      [],
    );
    const error = await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'UNSAFE_AFTER_REGENERATION',
    );
    expect(error.calls.map(({ kind, attempt }) => ({ kind, attempt }))).toEqual([
      { kind: 'patient_generation', attempt: 'initial' },
      { kind: 'patient_generation', attempt: 'regeneration' },
    ]);
  });

  it('keeps all four completed calls when regenerated B2 returns RETRY', async () => {
    const deps = dependencies(
      [generationResponse('Primera.'), generationResponse('Segunda.')],
      [validatorResponse('RETRY'), validatorResponse('RETRY')],
    );
    const error = await expectSafetyError(
      generateSafePatientReplyV2(orchestrationInput(), deps.value),
      'UNSAFE_AFTER_REGENERATION',
    );
    expect(error.calls.map(({ kind, attempt }) => ({ kind, attempt }))).toEqual([
      { kind: 'patient_generation', attempt: 'initial' },
      { kind: 'semantic_validation', attempt: 'initial' },
      { kind: 'patient_generation', attempt: 'regeneration' },
      { kind: 'semantic_validation', attempt: 'regeneration' },
    ]);
  });

  it('stores an immutable copy of completed-call telemetry', () => {
    const mutableCalls: PatientResponseSafetyCallReceiptV2[] = [
      {
        kind: 'patient_generation' as const,
        attempt: 'initial' as const,
        model: 'synthetic-model',
        inputTokens: 2,
        outputTokens: 1,
      },
    ];
    const error = new PatientResponseSafetyErrorV2(
      'PATIENT_GENERATION_FAILED',
      'generation',
      new Error('synthetic cause'),
      mutableCalls,
    );
    mutableCalls.push({
      kind: 'patient_generation',
      attempt: 'regeneration',
      model: 'later-mutation',
      inputTokens: 9,
      outputTokens: 9,
    });
    expect(error.calls).toHaveLength(1);
    expect(Object.isFrozen(error.calls)).toBe(true);
    expect(Object.isFrozen(error.calls[0])).toBe(true);
    expect(() => (error.calls as any[]).push({})).toThrow();
    expect(() => ((error.calls[0] as any).model = 'mutated')).toThrow();
  });

  it('does not mutate accepted conversation or clinical content', async () => {
    const inputValue = orchestrationInput();
    const conversationBefore = JSON.stringify(inputValue.acceptedConversation);
    const clinicalBefore = JSON.stringify(inputValue.clinicalContent);
    const deps = dependencies(
      [generationResponse(rejectedCandidate), generationResponse('Regenerada segura.')],
      [validatorResponse('PASS')],
    );
    await generateSafePatientReplyV2(inputValue, deps.value);
    expect(JSON.stringify(inputValue.acceptedConversation)).toBe(conversationBefore);
    expect(JSON.stringify(inputValue.clinicalContent)).toBe(clinicalBefore);
  });

  it('records all and only executed calls and sums observed usage', async () => {
    const deps = dependencies(
      [
        generationResponse('Primera.', { usage: { prompt_tokens: 10, completion_tokens: 2 } }),
        generationResponse('Segunda.', { usage: { prompt_tokens: 20, completion_tokens: 3 } }),
      ],
      [
        validatorResponse('RETRY', { usage: { input_tokens: 30, output_tokens: 4 } }),
        validatorResponse('PASS', { usage: { input_tokens: 40, output_tokens: 5 } }),
      ],
    );
    const result = await generateSafePatientReplyV2(orchestrationInput(), deps.value);
    expect(result.receipt.calls).toHaveLength(4);
    expect(result.receipt.totalInputTokens).toBe(100);
    expect(result.receipt.totalOutputTokens).toBe(14);
    expect(result.receipt.usageComplete).toBe(true);
  });

  it('marks partial usage incomplete and sums only observed call metadata', async () => {
    const deps = dependencies(
      [generationResponse('Candidata.', { usage: null })],
      [validatorResponse('PASS', { usage: { input_tokens: 30, output_tokens: 4 } })],
    );
    const result = await generateSafePatientReplyV2(orchestrationInput(), deps.value);
    expect(result.receipt.calls[0]).not.toHaveProperty('inputTokens');
    expect(result.receipt.calls[0]).not.toHaveProperty('outputTokens');
    expect(result.receipt.totalInputTokens).toBe(30);
    expect(result.receipt.totalOutputTokens).toBe(4);
    expect(result.receipt.usageComplete).toBe(false);
  });

  it.each([
    ['Legacy', legacyClinicalContent()],
    ['Generated', generatedClinicalContent()],
  ])('supports session-bound %s clinical content', async (_label, clinicalContent) => {
    const deps = dependencies(
      [generationResponse('Respuesta segura.')],
      [validatorResponse('PASS')],
    );
    await expect(
      generateSafePatientReplyV2(orchestrationInput(clinicalContent), deps.value),
    ).resolves.toMatchObject({ reply: 'Respuesta segura.' });
  });

  it('projects validator input without evaluator or ground truth', async () => {
    const contaminated = legacyClinicalContent() as any;
    contaminated.evaluator = { ground_truth: 'GROUND_TRUTH_SENTINEL' };
    contaminated.groundTruth = 'GROUND_TRUTH_SENTINEL';
    const deps = dependencies(
      [generationResponse('Respuesta segura.')],
      [validatorResponse('PASS')],
    );
    await generateSafePatientReplyV2(orchestrationInput(contaminated), deps.value);
    const validatorParams = deps.parse.mock.calls[0][0];
    expect(JSON.stringify(validatorParams)).not.toMatch(
      /evaluator|ground.?truth|GROUND_TRUTH_SENTINEL/i,
    );
  });

  it('enforces the absolute one-regeneration contract', () => {
    expect(MAX_PATIENT_RESPONSE_REGENERATIONS).toBe(1);
  });
});
