import { describe, expect, it } from 'vitest';

import {
  isPharmaceuticalSemanticModelV2,
  PHARMACEUTICAL_SEMANTIC_MODEL_POLICY_VERSION_V1,
  PHARMACEUTICAL_SEMANTIC_MODELS_V1,
} from '../../lib/cases/v2/pharmaceutical-semantic-model-policy';

describe('M6-D3R14 pharmaceutical semantic model policy', () => {
  it('freezes exactly two server-owned candidates under policy /1', () => {
    expect(PHARMACEUTICAL_SEMANTIC_MODEL_POLICY_VERSION_V1)
      .toBe('pharmaceutical-semantic-model-policy/1');
    expect(PHARMACEUTICAL_SEMANTIC_MODELS_V1)
      .toEqual(['gpt-5.6-sol', 'gpt-5.6-terra']);
    expect(Object.isFrozen(PHARMACEUTICAL_SEMANTIC_MODELS_V1)).toBe(true);
  });

  it.each(PHARMACEUTICAL_SEMANTIC_MODELS_V1)('allows exactly %s', (model) => {
    expect(isPharmaceuticalSemanticModelV2(model)).toBe(true);
  });

  it.each([
    'gpt-5.6', 'gpt-5.4', 'gpt-4o-mini', 'terra', 'sol',
    'gpt-5.6-terra-observed', 'gpt-5.6-sol-observed',
    ' gpt-5.6-terra', 'gpt-5.6-terra ', ' gpt-5.6-sol', 'gpt-5.6-sol ',
    'GPT-5.6-TERRA', '', 'arbitrary-model', undefined, null, 1, {}, ['gpt-5.6-terra'],
  ])('rejects %j without normalization or substitution', (value) => {
    expect(isPharmaceuticalSemanticModelV2(value)).toBe(false);
  });
});
