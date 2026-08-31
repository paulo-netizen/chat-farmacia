// Server-owned pharmaceutical D1/D2 eligibility, not a record of live acceptance.
export const PHARMACEUTICAL_SEMANTIC_MODEL_POLICY_VERSION_V1 =
  'pharmaceutical-semantic-model-policy/1' as const;

export const PHARMACEUTICAL_SEMANTIC_MODELS_V1 = Object.freeze([
  'gpt-5.6-sol',
  'gpt-5.6-terra',
] as const);

export type PharmaceuticalSemanticModelV2 =
  (typeof PHARMACEUTICAL_SEMANTIC_MODELS_V1)[number];

export function isPharmaceuticalSemanticModelV2(
  value: unknown,
): value is PharmaceuticalSemanticModelV2 {
  return PHARMACEUTICAL_SEMANTIC_MODELS_V1.some((model) => model === value);
}
