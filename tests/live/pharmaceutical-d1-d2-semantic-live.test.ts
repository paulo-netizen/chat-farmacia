import { describe, expect, it } from 'vitest';

import {
  isPharmaceuticalD3LiveEnabledV1,
  parsePharmaceuticalD3LiveSelectionV1,
  PHARMACEUTICAL_D3_CANDIDATE_REGISTRATION_V9,
  PHARMACEUTICAL_D3_LIVE_MATRIX_V9,
  runPharmaceuticalD3AcceptanceV4,
  validatePharmaceuticalD3ModelSelectionV8,
} from './support/pharmaceutical-d3-live-matrix';

const liveEnabled = isPharmaceuticalD3LiveEnabledV1(process.env);

describe.skipIf(!liveEnabled)('M6-D3 pre-registered pharmaceutical semantic live acceptance', () => {
  it('executes only the frozen matrix with gpt-5.6-terra and safe summaries', async () => {
    const runtimeEnvironment = Object.freeze({ ...process.env });
    const selection = parsePharmaceuticalD3LiveSelectionV1(runtimeEnvironment);
    const configuredModels = validatePharmaceuticalD3ModelSelectionV8({
      d1: runtimeEnvironment.OPENAI_PHARMACEUTICAL_D1_MODEL,
      d2: runtimeEnvironment.OPENAI_PHARMACEUTICAL_D2_MODEL,
    });
    const [d1Module, d2Module] = await Promise.all([
      import('../../lib/cases/v2/openai-pharmaceutical-d1-semantic-runtime'),
      import('../../lib/cases/v2/openai-pharmaceutical-d2-semantic-runtime'),
    ]);
    let executionOrdinal = 0;
    const allocateExecutionId = () => {
      executionOrdinal += 1;
      return `pharm_sem_exec_d3000000-0000-4000-8000-${executionOrdinal
        .toString(16)
        .padStart(12, '0')}`;
    };
    const result = await runPharmaceuticalD3AcceptanceV4({
      createD1Runtime: () =>
        d1Module.createOpenAiPharmaceuticalD1SemanticRuntimeV2(runtimeEnvironment),
      createD2Runtime: () =>
        d2Module.createOpenAiPharmaceuticalD2SemanticRuntimeV2(runtimeEnvironment),
      allocateD1ExecutionId: allocateExecutionId,
      allocateD2ExecutionId: allocateExecutionId,
    }, configuredModels, selection);

    console.log(JSON.stringify({
      matrixVersion: PHARMACEUTICAL_D3_LIVE_MATRIX_V9.matrixVersion,
      matrixFingerprint: PHARMACEUTICAL_D3_LIVE_MATRIX_V9.fingerprint.value,
      modelPolicyVersion: PHARMACEUTICAL_D3_CANDIDATE_REGISTRATION_V9.modelPolicyVersion,
      decision: result.decision,
      summaries: result.summaries,
    }, null, 2));

    expect(result.decision).toBe('ACCEPT');
  }, 120_000 * 82);
});
