import { describe, expect, it } from 'vitest';

import { buildSpfaScoringContextV2 } from '@/lib/cases/v2/build-spfa-scoring-context';
import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import { scoreSpfaSessionV2 } from '@/lib/cases/v2/score-spfa-session';
import {
  toStudentSpfaEvaluationDtoV2,
  toTeacherSpfaEvaluationDtoV2,
  type SpfaEvaluationDtoSourceV2,
} from '@/lib/cases/v2/spfa-evaluation-dto';
import type { BoundSpfaInformationTargetV2 } from '@/lib/cases/v2/spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import { SPFA_SCORING_POLICY_V2_2026_1 } from '@/lib/cases/v2/spfa-scoring-policy-v2';
import type { SpfaProtocolDefinitionV2 } from '@/lib/cases/v2/spfa-protocol-types';
import type { SpfaSessionEvaluationV2 } from '@/lib/cases/v2/spfa-session-evaluation-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import { validateSpfaProtocolIdV2, validateSpfaProtocolRequirementIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = validateCaseVersionId('casever_20000000-0000-4000-8000-000000000001');
const spfaRef = 'conclusion_40000000-0000-4000-8000-000000000001' as ConclusionId;
const protocolId = validateSpfaProtocolIdV2('spfa_protocol_50000000-0000-4000-8000-000000000001');
const requirementId = validateSpfaProtocolRequirementIdV2('spfa_requirement_60000000-0000-4000-8000-000000000001');
const targetId = validateSpfaRequirementTargetIdV2('spfa_target_70000000-0000-4000-8000-000000000001');

function nonEmpty<T>(values: readonly T[]): NonEmptyArray<T> {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('fixture must be non-empty');
  return [first, ...rest];
}

const informationTarget: BoundSpfaInformationTargetV2 = {
  targetId,
  target: { kind: 'PUBLIC_PROFILE', field: 'age' },
};
const application = {
  schemaVersion: '2.0' as const,
  caseVersionId,
  carePathSpfaRef: spfaRef,
  protocolRef: { protocolId, version: '1.0.0' },
  requirements: nonEmpty([{
    kind: 'INFORMATION_REQUIREMENT' as const,
    requirementRef: requirementId,
    applicability: { status: 'APPLICABLE' as const, effectiveImportance: 'RELEVANT' as const },
    informationTargets: nonEmpty([informationTarget]),
  }]),
};
const definition: SpfaProtocolDefinitionV2 = {
  schemaVersion: '2.0', protocolId, version: '1.0.0', service: 'pharmaceutical_indication',
  requirements: nonEmpty([{
    kind: 'INFORMATION_REQUIREMENT', requirementId, teacherLabel: 'Demanda',
    description: 'Explora la demanda', defaultImportance: 'RELEVANT',
    safetyCriticality: { safetyCritical: false }, applicability: { kind: 'ALWAYS' },
    semanticDomain: { kind: 'patient_information', disclosureDomain: 'symptoms' },
    informationGoal: 'Conocer la demanda',
  }]),
};
const protocolSet: CaseSpfaProtocolSetV2 = {
  schemaVersion: '2.0',
  catalogRef: { id: 'spfa-protocol-catalog', version: '2026.1' },
  definitions: nonEmpty([definition]),
  applications: nonEmpty([application]),
};
const transcript = createSessionTranscriptSnapshotV2({
  sessionId,
  caseVersionId,
  messages: [{
    messageId: '1', role: 'patient', content: 'Respuesta literal',
    createdAt: '2026-08-25T09:00:00Z',
  }],
});
const snapshotIdentity = {
  sessionId,
  caseVersionId,
  protocolCatalogRef: protocolSet.catalogRef,
  transcriptFingerprint: transcript.fingerprint,
  scoringPolicyRef: SPFA_SCORING_POLICY_V2_2026_1.policyRef,
};
const evaluation: SpfaSessionEvaluationV2 = {
  schemaVersion: '2.0', sessionId, caseVersionId,
  protocolCatalogRef: protocolSet.catalogRef,
  transcriptFingerprint: transcript.fingerprint,
  applications: nonEmpty([{
    carePathSpfaRef: spfaRef,
    protocolRef: application.protocolRef,
    requirementResults: nonEmpty([{
      schemaVersion: '2.0', sessionId, caseVersionId,
      transcriptFingerprint: transcript.fingerprint,
      carePathSpfaRef: spfaRef, requirementRef: requirementId,
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'COVERED', origin: 'PATIENT_SPONTANEOUS',
        coveredTargetRefs: nonEmpty([targetId]),
        evidence: nonEmpty([{
          source: 'TRANSCRIPT_MESSAGE', messageRef: transcript.messages[0].messageId,
          speaker: 'patient', evidenceKind: 'PATIENT_STATEMENT',
          excerpt: 'Respuesta literal',
        }]),
      },
    }]),
  }]),
  semanticExecutions: [{
    carePathSpfaRef: spfaRef,
    requirementRef: requirementId,
    provider: 'openai',
    responseModel: 'gpt-5.6-sol',
    promptVersion: 'spfa-semantic-adjudication-v1',
  }],
};
const context = buildSpfaScoringContextV2(evaluation, protocolSet);
const score = scoreSpfaSessionV2(context, SPFA_SCORING_POLICY_V2_2026_1);

function completed(overrides: Record<string, unknown> = {}): SpfaEvaluationDtoSourceV2 {
  return {
    status: 'COMPLETED', sessionId, snapshotIdentity, evaluation, score,
    ...overrides,
  } as unknown as SpfaEvaluationDtoSourceV2;
}

describe('student SPFA evaluation DTO V2', () => {
  it.each([
    [{ status: 'NOT_STARTED', sessionId }, { schemaVersion: '2.0', status: 'NOT_STARTED' }],
    [{ status: 'EVALUATING', sessionId, snapshotIdentity }, { schemaVersion: '2.0', status: 'EVALUATING' }],
    [{ status: 'FAILED', sessionId, snapshotIdentity, failureCode: 'PROVIDER_FAILURE' }, { schemaVersion: '2.0', status: 'FAILED', retryable: true }],
  ] as const)('projects %s with an exact minimal allowlist', (source, expected) => {
    expect(toStudentSpfaEvaluationDtoV2(source as SpfaEvaluationDtoSourceV2)).toEqual(expected);
  });

  it('projects a scored completion without technical detail', () => {
    const dto = toStudentSpfaEvaluationDtoV2(completed());
    expect(dto).toEqual({
      schemaVersion: '2.0', status: 'COMPLETED', score: 100,
      scoreStatus: 'SCORED', needsReview: false,
    });
  });

  it('preserves REVIEW_REQUIRED and exposes only needsReview', () => {
    const reviewScore = { ...score, status: 'REVIEW_REQUIRED' as const, score: 50, needsReview: true as const };
    expect(toStudentSpfaEvaluationDtoV2(completed({ score: reviewScore }))).toEqual({
      schemaVersion: '2.0', status: 'COMPLETED', score: 50,
      scoreStatus: 'REVIEW_REQUIRED', needsReview: true,
    });
  });

  it('preserves NOT_SCORABLE null rather than converting it to zero', () => {
    const notScorable = {
      ...score, status: 'NOT_SCORABLE' as const, score: null,
      needsReview: false as const, rawPoints: 0, possiblePoints: 0,
    };
    expect(toStudentSpfaEvaluationDtoV2(completed({ score: notScorable }))).toEqual({
      schemaVersion: '2.0', status: 'COMPLETED', score: null,
      scoreStatus: 'NOT_SCORABLE', needsReview: false,
    });
  });

  it('does not propagate present or future protected properties', () => {
    const contaminated = completed({
      patientFacts: 'PATIENT_FACTS_SENTINEL', evaluator: 'EVALUATOR_SENTINEL',
      transcript: 'TRANSCRIPT_SENTINEL', messages: 'MESSAGES_SENTINEL',
      evidence: 'EVIDENCE_SENTINEL', responseModel: 'MODEL_SENTINEL',
      promptVersion: 'PROMPT_SENTINEL', attemptId: 'ATTEMPT_SENTINEL',
      lease: 'LEASE_SENTINEL', failureCode: 'INTERNAL_FAILURE',
      future_secret: 'FUTURE_SENTINEL',
    });
    const serialized = JSON.stringify(toStudentSpfaEvaluationDtoV2(contaminated));
    expect(serialized).not.toMatch(/SENTINEL|patientFacts|evaluator|transcript|evidence|attempt|lease|failureCode/);
  });
});

describe('teacher/server SPFA evaluation DTO V2', () => {
  it('projects full validated score, contributions and critical alerts', () => {
    const alertScore = {
      ...score,
      criticalAlerts: [{
        carePathSpfaRef: spfaRef,
        requirementRef: requirementId,
        code: 'CRITICAL_OMISSION' as const,
      }],
    };
    const dto = toTeacherSpfaEvaluationDtoV2(completed({ score: alertScore }));
    expect(dto.status).toBe('COMPLETED');
    if (dto.status !== 'COMPLETED') throw new Error('expected completed DTO');
    expect(dto.score).toMatchObject({
      status: 'SCORED', score: 100, rawPoints: 2, possiblePoints: 2,
    });
    expect(dto.score.requirementContributions).toHaveLength(1);
    expect(dto.score.criticalAlerts).toEqual([{
      carePathSpfaRef: spfaRef,
      requirementRef: requirementId,
      code: 'CRITICAL_OMISSION',
    }]);
  });

  it('projects policy, protocol catalog and transcript fingerprint', () => {
    const dto = toTeacherSpfaEvaluationDtoV2(completed());
    if (dto.status !== 'COMPLETED') throw new Error('expected completed DTO');
    expect(dto.snapshotIdentity).toEqual({
      caseVersionId,
      protocolCatalogRef: protocolSet.catalogRef,
      transcriptFingerprint: transcript.fingerprint,
      scoringPolicyRef: SPFA_SCORING_POLICY_V2_2026_1.policyRef,
    });
  });

  it('projects semantic execution metadata and authorized evidence references', () => {
    const dto = toTeacherSpfaEvaluationDtoV2(completed());
    if (dto.status !== 'COMPLETED') throw new Error('expected completed DTO');
    expect(dto.semanticExecutions).toEqual(evaluation.semanticExecutions);
    expect(dto.requirementEvidence[0]).toMatchObject({
      requirementRef: requirementId,
      resultStatus: 'COVERED',
      evidence: [{
        source: 'TRANSCRIPT_MESSAGE', messageRef: '1', speaker: 'patient',
        evidenceKind: 'PATIENT_STATEMENT', excerpt: 'Respuesta literal',
      }],
    });
  });

  it('includes the safe failure code only in the teacher/server FAILED DTO', () => {
    expect(toTeacherSpfaEvaluationDtoV2({
      status: 'FAILED', sessionId, snapshotIdentity,
      failureCode: 'INVALID_PROVIDER_RESULT',
    })).toMatchObject({ status: 'FAILED', failureCode: 'INVALID_PROVIDER_RESULT' });
  });

  it('never copies provider raw data, prompts, secrets, patient facts or evaluator', () => {
    const dto = toTeacherSpfaEvaluationDtoV2(completed({
      apiKey: 'API_KEY_SENTINEL', rawProviderResponse: 'RAW_SENTINEL',
      fullPrompt: 'FULL_PROMPT_SENTINEL', patientFacts: 'FACTS_SENTINEL',
      evaluator: 'EVALUATOR_SENTINEL', future_secret: 'FUTURE_SENTINEL',
    }));
    expect(JSON.stringify(dto)).not.toMatch(/API_KEY|RAW_SENTINEL|FULL_PROMPT|FACTS_SENTINEL|EVALUATOR_SENTINEL|FUTURE_SENTINEL/);
  });
});
