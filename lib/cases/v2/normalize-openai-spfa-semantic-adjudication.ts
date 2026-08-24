import type { OpenAiSpfaSemanticAdjudicationTransportV1 } from './openai-spfa-semantic-adjudication-transport';
import type { SpfaRequirementEvidenceBaselineV2 } from './spfa-evidence-baseline-types';

export function normalizeOpenAiSpfaSemanticAdjudicationTransportV1(
  transport: OpenAiSpfaSemanticAdjudicationTransportV1,
  baseline: SpfaRequirementEvidenceBaselineV2,
): unknown {
  return {
    schemaVersion: '2.0',
    contractVersion: 'spfa-semantic-adjudication/1',
    sessionId: baseline.sessionId,
    caseVersionId: baseline.caseVersionId,
    transcriptFingerprint: structuredClone(baseline.transcriptFingerprint),
    carePathSpfaRef: baseline.carePathSpfaRef,
    requirementRef: baseline.requirementRef,
    kind: baseline.kind,
    decisions: structuredClone(transport.decisions),
  };
}
