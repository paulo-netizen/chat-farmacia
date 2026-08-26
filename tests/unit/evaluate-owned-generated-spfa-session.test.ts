import { readFileSync } from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import type { BuildSpfaSemanticTargetContextInputV2 } from '../../lib/cases/v2/build-spfa-semantic-target-context';
import type { OpenAiSpfaSemanticAdjudicationExecutionReceiptV1 } from '../../lib/cases/v2/execute-openai-spfa-semantic-adjudication';
import {
  evaluateOwnedGeneratedSpfaSessionV2,
  type EvaluateOwnedGeneratedSpfaSessionDependenciesV2,
} from '../../lib/cases/v2/evaluate-owned-generated-spfa-session';
import { SessionClinicalRuntimeErrorV2 } from '../../lib/cases/v2/session-clinical-runtime';
import type { SessionSpfaEvaluationRuntimeV2 } from '../../lib/cases/v2/session-clinical-runtime';
import type { SpfaSessionEvaluationV2 } from '../../lib/cases/v2/spfa-session-evaluation-types';

const sessionId = '10000000-0000-4000-8000-000000000001';
const authenticatedUserId = 41;
const input = Object.freeze({ authenticatedUserId, sessionId });
const semanticInput = Object.freeze({
  synthetic: 'semantic-input',
}) as unknown as BuildSpfaSemanticTargetContextInputV2;
const receipt = Object.freeze({
  adjudication: { synthetic: 'adjudication' },
  provider: 'openai',
  responseModel: 'gpt-5.6-sol',
  promptVersion: 'spfa-semantic-adjudication-prompt/1',
}) as unknown as OpenAiSpfaSemanticAdjudicationExecutionReceiptV1;
const aggregate = Object.freeze({
  schemaVersion: '2.0',
  sessionId,
  caseVersionId: 'casever_90000000-0000-4000-8000-000000000001',
  protocolCatalogRef: { id: 'foro-af-fc', version: '2024' },
  transcriptFingerprint: {
    algorithm: 'sha256',
    canonicalization: 'session-transcript-v2/1',
    value: 'a'.repeat(64),
  },
  applications: [],
  semanticExecutions: [],
}) as unknown as SpfaSessionEvaluationV2;
const resolvedRuntime = Object.freeze({
  sessionId,
  caseId: 7,
  caseVersionId: aggregate.caseVersionId,
  sessionStatus: 'active',
  core: Object.freeze({ protectedCore: true }),
  transcript: Object.freeze({ protectedTranscript: true }),
}) as unknown as SessionSpfaEvaluationRuntimeV2;

function fakeDependencies(semanticCalls = 0) {
  const resolveRuntime = vi.fn(async () => resolvedRuntime);
  const runtimeAdjudicate = vi.fn(async () => receipt);
  const createAdjudicationRuntime = vi.fn(() => ({
    adjudicate: runtimeAdjudicate,
  }));
  const evaluateSession = vi.fn(async (_runtimeInput, evaluatorDependencies) => {
    for (let index = 0; index < semanticCalls; index += 1) {
      await evaluatorDependencies.adjudicate(semanticInput);
    }
    return aggregate;
  });
  return {
    resolveRuntime,
    runtimeAdjudicate,
    createAdjudicationRuntime,
    evaluateSession,
    dependencies: {
      resolveRuntime,
      createAdjudicationRuntime,
      evaluateSession,
    } as unknown as EvaluateOwnedGeneratedSpfaSessionDependenciesV2,
  };
}

describe('evaluateOwnedGeneratedSpfaSessionV2', () => {
  it('returns a deterministic evaluation without creating semantic runtime', async () => {
    const fake = fakeDependencies(0);
    const result = await evaluateOwnedGeneratedSpfaSessionV2(
      input,
      fake.dependencies,
    );
    expect(result).toBe(aggregate);
    expect(fake.createAdjudicationRuntime).not.toHaveBeenCalled();
    expect(fake.runtimeAdjudicate).not.toHaveBeenCalled();
  });

  it('creates the semantic runtime lazily and adjudicates one requirement once', async () => {
    const fake = fakeDependencies(1);
    await evaluateOwnedGeneratedSpfaSessionV2(input, fake.dependencies);
    expect(fake.createAdjudicationRuntime).toHaveBeenCalledTimes(1);
    expect(fake.runtimeAdjudicate).toHaveBeenCalledTimes(1);
    expect(fake.runtimeAdjudicate).toHaveBeenCalledWith(semanticInput);
  });

  it('reuses one runtime for two semantic requirements', async () => {
    const fake = fakeDependencies(2);
    await evaluateOwnedGeneratedSpfaSessionV2(input, fake.dependencies);
    expect(fake.createAdjudicationRuntime).toHaveBeenCalledTimes(1);
    expect(fake.runtimeAdjudicate).toHaveBeenCalledTimes(2);
  });

  it('delegates the exact authenticated identity and session ID to E3', async () => {
    const fake = fakeDependencies();
    await evaluateOwnedGeneratedSpfaSessionV2(input, fake.dependencies);
    expect(fake.resolveRuntime).toHaveBeenCalledTimes(1);
    expect(fake.resolveRuntime).toHaveBeenCalledWith(input);
  });

  it('passes only the E3 transcript and core into E2', async () => {
    const fake = fakeDependencies();
    await evaluateOwnedGeneratedSpfaSessionV2(input, fake.dependencies);
    expect(fake.evaluateSession).toHaveBeenCalledTimes(1);
    expect(fake.evaluateSession.mock.calls[0][0]).toEqual({
      transcript: resolvedRuntime.transcript,
      core: resolvedRuntime.core,
    });
    expect(fake.evaluateSession.mock.calls[0][0]).not.toHaveProperty('sessionStatus');
    expect(fake.evaluateSession.mock.calls[0][0]).not.toHaveProperty('caseId');
  });

  it.each([
    'session_not_found_or_forbidden',
    'spfa_evaluation_not_available',
    'invalid_session_transcript',
  ] as const)('propagates E3 failure %s without invoking E2', async (code) => {
    const fake = fakeDependencies();
    const expected = new SessionClinicalRuntimeErrorV2(code, 'safe.path');
    fake.resolveRuntime.mockRejectedValueOnce(expected);
    await expect(
      evaluateOwnedGeneratedSpfaSessionV2(input, fake.dependencies),
    ).rejects.toBe(expected);
    expect(fake.evaluateSession).not.toHaveBeenCalled();
    expect(fake.createAdjudicationRuntime).not.toHaveBeenCalled();
  });

  it('propagates adjudicator failure without returning a partial aggregate', async () => {
    const fake = fakeDependencies(1);
    const expected = new Error('safe adjudicator failure');
    fake.runtimeAdjudicate.mockRejectedValueOnce(expected);
    await expect(
      evaluateOwnedGeneratedSpfaSessionV2(input, fake.dependencies),
    ).rejects.toBe(expected);
    expect(fake.evaluateSession).toHaveBeenCalledTimes(1);
    expect(fake.runtimeAdjudicate).toHaveBeenCalledTimes(1);
  });

  it('propagates runtime configuration failure without fallback', async () => {
    const fake = fakeDependencies(1);
    const expected = new Error('safe runtime configuration failure');
    fake.createAdjudicationRuntime.mockImplementationOnce(() => {
      throw expected;
    });
    await expect(
      evaluateOwnedGeneratedSpfaSessionV2(input, fake.dependencies),
    ).rejects.toBe(expected);
    expect(fake.createAdjudicationRuntime).toHaveBeenCalledTimes(1);
    expect(fake.runtimeAdjudicate).not.toHaveBeenCalled();
  });

  it('returns only the E2 aggregate and not E3 protected runtime data', async () => {
    const fake = fakeDependencies();
    const result = await evaluateOwnedGeneratedSpfaSessionV2(
      input,
      fake.dependencies,
    );
    expect(result).not.toHaveProperty('core');
    expect(result).not.toHaveProperty('transcript');
    expect(result).not.toHaveProperty('patientFacts');
    expect(result).not.toHaveProperty('evaluator');
    expect(JSON.stringify(result)).not.toMatch(/protectedCore|protectedTranscript/);
  });

  it('does not expose API key, model configuration or runtime object', async () => {
    const fake = fakeDependencies(1);
    const result = await evaluateOwnedGeneratedSpfaSessionV2(
      input,
      fake.dependencies,
    );
    expect(JSON.stringify(result)).not.toMatch(/apiKey|OPENAI_API_KEY|timeoutMs|maxOutputTokens/);
    expect(result).not.toHaveProperty('adjudicate');
  });

  it('is deterministic for the same E3 snapshot and E2 result', async () => {
    const first = await evaluateOwnedGeneratedSpfaSessionV2(
      input,
      fakeDependencies(1).dependencies,
    );
    const second = await evaluateOwnedGeneratedSpfaSessionV2(
      input,
      fakeDependencies(1).dependencies,
    );
    expect(second).toEqual(first);
  });

  it('does not enforce active/finished policy in E4', async () => {
    const fake = fakeDependencies();
    fake.resolveRuntime.mockResolvedValueOnce({
      ...resolvedRuntime,
      sessionStatus: 'finished',
    });
    await expect(
      evaluateOwnedGeneratedSpfaSessionV2(input, fake.dependencies),
    ).resolves.toBe(aggregate);
  });

  it('contains no DB, persistence, API route, scoring or OpenAI client code', () => {
    const source = readFileSync(
      'lib/cases/v2/evaluate-owned-generated-spfa-session.ts',
      'utf8',
    );
    expect(source).not.toMatch(/@\/lib\/db|from ['"]pg['"]|new OpenAI|process\.env/);
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK)\b/i);
    expect(source).not.toMatch(/next\/server|NextResponse|score|persist/i);
  });

  it('uses the real E3, E2 and runtime factories as production defaults', () => {
    const source = readFileSync(
      'lib/cases/v2/evaluate-owned-generated-spfa-session.ts',
      'utf8',
    );
    expect(source).toContain('resolveSessionSpfaEvaluationRuntimeV2');
    expect(source).toContain('evaluateSpfaSessionV2');
    expect(source).toContain('createOpenAiSpfaSemanticAdjudicationRuntimeV2');
  });
});
