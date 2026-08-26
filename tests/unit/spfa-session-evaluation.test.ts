import { describe, expect, it } from 'vitest';

import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import type {
  AppliedActionRequirementV2,
  AppliedInformationRequirementV2,
  AppliedSpfaRequirementV2,
} from '@/lib/cases/v2/spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import type {
  SpfaRequirementSessionResultV2,
} from '@/lib/cases/v2/spfa-session-evidence-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import type {
  SpfaProtocolDefinitionV2,
  SpfaProtocolRequirementDefinitionV2,
} from '@/lib/cases/v2/spfa-protocol-types';
import type { FactId } from '@/lib/cases/v2/types';
import {
  SpfaSessionEvaluationValidationError,
  validateSpfaSessionEvaluationV2,
} from '@/lib/cases/v2/validate-spfa-session-evaluation';
import { validateSpfaRequirementSessionResultV2 } from '@/lib/cases/v2/validate-spfa-requirement-session-result';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import {
  validateSpfaProtocolIdV2,
  validateSpfaProtocolRequirementIdV2,
} from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const raw = {
  session: '10000000-0000-4000-8000-000000000001',
  caseVersion: 'casever_20000000-0000-4000-8000-000000000001',
  spfaA: 'conclusion_30000000-0000-4000-8000-000000000001',
  spfaB: 'conclusion_30000000-0000-4000-8000-000000000002',
  actionConclusion: 'conclusion_30000000-0000-4000-8000-000000000003',
  protocolA: 'spfa_protocol_40000000-0000-4000-8000-000000000001',
  protocolB: 'spfa_protocol_40000000-0000-4000-8000-000000000002',
  requirementInfoA: 'spfa_requirement_50000000-0000-4000-8000-000000000001',
  requirementActionA: 'spfa_requirement_50000000-0000-4000-8000-000000000002',
  requirementInfoB: 'spfa_requirement_50000000-0000-4000-8000-000000000003',
  missingRequirement: 'spfa_requirement_50000000-0000-4000-8000-000000000099',
  targetInfoA: 'spfa_target_60000000-0000-4000-8000-000000000001',
  targetActionA: 'spfa_target_60000000-0000-4000-8000-000000000002',
  targetInfoB: 'spfa_target_60000000-0000-4000-8000-000000000003',
  factA: 'fact_70000000-0000-4000-8000-000000000001',
  factB: 'fact_70000000-0000-4000-8000-000000000002',
} as const;

const ids = {
  caseVersion: validateCaseVersionId(raw.caseVersion),
  spfaA: raw.spfaA as ConclusionId,
  spfaB: raw.spfaB as ConclusionId,
  actionConclusion: raw.actionConclusion as ConclusionId,
  protocolA: validateSpfaProtocolIdV2(raw.protocolA),
  protocolB: validateSpfaProtocolIdV2(raw.protocolB),
  requirementInfoA: validateSpfaProtocolRequirementIdV2(raw.requirementInfoA),
  requirementActionA: validateSpfaProtocolRequirementIdV2(raw.requirementActionA),
  requirementInfoB: validateSpfaProtocolRequirementIdV2(raw.requirementInfoB),
  targetInfoA: validateSpfaRequirementTargetIdV2(raw.targetInfoA),
  targetActionA: validateSpfaRequirementTargetIdV2(raw.targetActionA),
  targetInfoB: validateSpfaRequirementTargetIdV2(raw.targetInfoB),
} as const;

const transcript = createSessionTranscriptSnapshotV2({
  sessionId: raw.session,
  caseVersionId: ids.caseVersion,
  messages: [
    {
      messageId: '1',
      role: 'student',
      content: 'Le recomiendo consultar hoy con su médico.',
      createdAt: '2026-08-25T09:00:00Z',
    },
    {
      messageId: '2',
      role: 'patient',
      content: 'Tengo dolor desde ayer.',
      createdAt: '2026-08-25T09:00:01Z',
    },
  ],
});

const informationRequirementA: AppliedInformationRequirementV2 = {
  requirementRef: ids.requirementInfoA,
  kind: 'INFORMATION_REQUIREMENT',
  applicability: { status: 'APPLICABLE', effectiveImportance: 'RELEVANT' },
  informationTargets: [
    {
      targetId: ids.targetInfoA,
      target: { kind: 'FACT', factRef: raw.factA as FactId },
    },
  ],
};

const actionRequirementA: AppliedActionRequirementV2 = {
  requirementRef: ids.requirementActionA,
  kind: 'ACTION_REQUIREMENT',
  applicability: { status: 'APPLICABLE', effectiveImportance: 'CRITICAL' },
  actionTargets: [
    {
      targetId: ids.targetActionA,
      target: {
        kind: 'EVALUATOR_CONCLUSION',
        conclusionRef: ids.actionConclusion,
      },
    },
  ],
};

const informationRequirementB: AppliedInformationRequirementV2 = {
  requirementRef: ids.requirementInfoB,
  kind: 'INFORMATION_REQUIREMENT',
  applicability: { status: 'APPLICABLE', effectiveImportance: 'OPTIONAL' },
  informationTargets: [
    {
      targetId: ids.targetInfoB,
      target: { kind: 'FACT', factRef: raw.factB as FactId },
    },
  ],
};

function definitionRequirement(
  requirement: AppliedSpfaRequirementV2,
): SpfaProtocolRequirementDefinitionV2 {
  const common = {
    requirementId: requirement.requirementRef,
    teacherLabel: `Label ${requirement.requirementRef}`,
    description: 'Descripción de prueba',
    defaultImportance: 'RELEVANT' as const,
    safetyCriticality: { safetyCritical: false },
    applicability: { kind: 'ALWAYS' as const },
  };
  return requirement.kind === 'INFORMATION_REQUIREMENT'
    ? {
        ...common,
        kind: 'INFORMATION_REQUIREMENT',
        semanticDomain: {
          kind: 'patient_information',
          disclosureDomain: 'symptoms',
        },
        informationGoal: 'Identificar el síntoma',
      }
    : {
        ...common,
        kind: 'ACTION_REQUIREMENT',
        semanticDomain: 'safe_professional_action',
        actionGoal: 'Realizar una actuación segura',
      };
}

function applicationA(
  requirements: NonEmptyArray<AppliedSpfaRequirementV2>,
) {
  return {
    schemaVersion: '2.0' as const,
    caseVersionId: ids.caseVersion,
    carePathSpfaRef: ids.spfaA,
    protocolRef: { protocolId: ids.protocolA, version: '1.0.0' },
    requirements,
  };
}

function applicationB() {
  return {
    schemaVersion: '2.0' as const,
    caseVersionId: ids.caseVersion,
    carePathSpfaRef: ids.spfaB,
    protocolRef: { protocolId: ids.protocolB, version: '1.0.0' },
    requirements: [informationRequirementB] as const,
  };
}

function definitionFor(
  application: ReturnType<typeof applicationA> | ReturnType<typeof applicationB>,
  service: 'dispensing' | 'pharmaceutical_indication',
): SpfaProtocolDefinitionV2 {
  return {
    schemaVersion: '2.0',
    protocolId: application.protocolRef.protocolId,
    version: application.protocolRef.version,
    service,
    ...(service === 'dispensing' ? { subtype: 'initial_treatment' as const } : {}),
    requirements: application.requirements.map(definitionRequirement) as unknown as NonEmptyArray<SpfaProtocolRequirementDefinitionV2>,
  };
}

function protocolSet(
  mode: 'minimal' | 'multipleRequirements' | 'multipleApplications' = 'minimal',
): CaseSpfaProtocolSetV2 {
  const first = applicationA(
    mode === 'minimal'
      ? [informationRequirementA]
      : [informationRequirementA, actionRequirementA],
  );
  const applications =
    mode === 'multipleApplications'
      ? [first, applicationB()] as const
      : [first] as const;
  const definitions = applications.map((application, index) =>
    definitionFor(
      application,
      index === 0 ? 'dispensing' : 'pharmaceutical_indication',
    ),
  ) as unknown as NonEmptyArray<SpfaProtocolDefinitionV2>;
  return {
    schemaVersion: '2.0',
    catalogRef: { id: 'spfa-protocol-catalog', version: '2026.1' },
    definitions,
    applications,
  };
}

function resultFor(
  carePathSpfaRef: ConclusionId,
  requirement: AppliedSpfaRequirementV2,
): SpfaRequirementSessionResultV2 {
  if (requirement.kind === 'ACTION_REQUIREMENT') {
    return validateSpfaRequirementSessionResultV2(
      {
        schemaVersion: '2.0',
        sessionId: transcript.sessionId,
        caseVersionId: transcript.caseVersionId,
        transcriptFingerprint: transcript.fingerprint,
        carePathSpfaRef,
        requirementRef: requirement.requirementRef,
        kind: 'ACTION_REQUIREMENT',
        outcome: {
          status: 'PERFORMED',
          performedTargetRefs: [ids.targetActionA],
          evidence: [
            {
              source: 'TRANSCRIPT_MESSAGE',
              messageRef: '1',
              speaker: 'student',
              evidenceKind: 'STUDENT_ACTION',
              excerpt: 'recomiendo consultar hoy',
            },
          ],
        },
      },
      { transcript, carePathSpfaRef, appliedRequirement: requirement },
    );
  }
  if (requirement.requirementRef === ids.requirementInfoB) {
    return validateSpfaRequirementSessionResultV2(
      {
        schemaVersion: '2.0',
        sessionId: transcript.sessionId,
        caseVersionId: transcript.caseVersionId,
        transcriptFingerprint: transcript.fingerprint,
        carePathSpfaRef,
        requirementRef: requirement.requirementRef,
        kind: 'INFORMATION_REQUIREMENT',
        coverage: {
          status: 'NOT_COVERED',
          coveredTargetRefs: [],
          remainingTargetRefs: [ids.targetInfoB],
          uncertainTargetRefs: [ids.targetInfoB],
          evidence: [],
        },
      },
      { transcript, carePathSpfaRef, appliedRequirement: requirement },
    );
  }
  return validateSpfaRequirementSessionResultV2(
    {
      schemaVersion: '2.0',
      sessionId: transcript.sessionId,
      caseVersionId: transcript.caseVersionId,
      transcriptFingerprint: transcript.fingerprint,
      carePathSpfaRef,
      requirementRef: requirement.requirementRef,
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'COVERED',
        origin: 'PATIENT_SPONTANEOUS',
        coveredTargetRefs: [ids.targetInfoA],
        evidence: [
          {
            source: 'TRANSCRIPT_MESSAGE',
            messageRef: '2',
            speaker: 'patient',
            evidenceKind: 'PATIENT_STATEMENT',
            excerpt: 'dolor desde ayer',
          },
        ],
      },
    },
    { transcript, carePathSpfaRef, appliedRequirement: requirement },
  );
}

function validEvaluation(set = protocolSet()) {
  return {
    schemaVersion: '2.0',
    sessionId: transcript.sessionId,
    caseVersionId: transcript.caseVersionId,
    protocolCatalogRef: set.catalogRef,
    transcriptFingerprint: transcript.fingerprint,
    applications: set.applications.map((application) => ({
      carePathSpfaRef: application.carePathSpfaRef,
      protocolRef: application.protocolRef,
      requirementResults: application.requirements.map((requirement) =>
        resultFor(application.carePathSpfaRef, requirement),
      ),
    })),
    semanticExecutions: [],
  };
}

function context(set: CaseSpfaProtocolSetV2) {
  return { transcript, spfaProtocolSet: set };
}

function mutableInput(set = protocolSet()): Record<string, unknown> {
  return structuredClone(validEvaluation(set)) as unknown as Record<string, unknown>;
}

function applicationsOf(input: Record<string, unknown>): Record<string, unknown>[] {
  return input.applications as Record<string, unknown>[];
}

function resultsOf(
  input: Record<string, unknown>,
  applicationIndex = 0,
): Record<string, unknown>[] {
  return applicationsOf(input)[applicationIndex].requirementResults as Record<string, unknown>[];
}

function executionsOf(input: Record<string, unknown>): Record<string, unknown>[] {
  return input.semanticExecutions as Record<string, unknown>[];
}

function semanticExecution(
  carePathSpfaRef = ids.spfaA,
  requirementRef = ids.requirementInfoA,
) {
  return {
    carePathSpfaRef,
    requirementRef,
    provider: 'openai',
    responseModel: 'gpt-5.6-sol',
    promptVersion: 'spfa-semantic-adjudication-prompt/1',
  };
}

describe('SpfaSessionEvaluationV2', () => {
  it('accepts a valid minimal aggregate', () => {
    const set = protocolSet();
    expect(validateSpfaSessionEvaluationV2(validEvaluation(set), context(set)))
      .toEqual(validEvaluation(set));
  });

  it('accepts multiple applications in protocol-set order', () => {
    const set = protocolSet('multipleApplications');
    const parsed = validateSpfaSessionEvaluationV2(validEvaluation(set), context(set));
    expect(parsed.applications.map((item) => item.carePathSpfaRef)).toEqual([
      ids.spfaA,
      ids.spfaB,
    ]);
  });

  it('accepts multiple requirement results in application order', () => {
    const set = protocolSet('multipleRequirements');
    const parsed = validateSpfaSessionEvaluationV2(validEvaluation(set), context(set));
    expect(parsed.applications[0].requirementResults.map((item) => item.requirementRef))
      .toEqual([ids.requirementInfoA, ids.requirementActionA]);
  });

  it('preserves a valid INFORMATION result', () => {
    const set = protocolSet();
    const parsed = validateSpfaSessionEvaluationV2(validEvaluation(set), context(set));
    expect(parsed.applications[0].requirementResults[0].kind)
      .toBe('INFORMATION_REQUIREMENT');
  });

  it('preserves a valid ACTION result', () => {
    const set = protocolSet('multipleRequirements');
    const parsed = validateSpfaSessionEvaluationV2(validEvaluation(set), context(set));
    expect(parsed.applications[0].requirementResults[1].kind)
      .toBe('ACTION_REQUIREMENT');
  });

  it('preserves UNCERTAIN targets in a final result', () => {
    const set = protocolSet('multipleApplications');
    const parsed = validateSpfaSessionEvaluationV2(validEvaluation(set), context(set));
    const result = parsed.applications[1].requirementResults[0];
    expect(result.kind).toBe('INFORMATION_REQUIREMENT');
    if (result.kind !== 'INFORMATION_REQUIREMENT') throw new Error('fixture mismatch');
    expect(result.coverage).toMatchObject({
      status: 'NOT_COVERED',
      uncertainTargetRefs: [ids.targetInfoB],
    });
  });

  it('accepts a valid semantic execution correlated with a result', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.semanticExecutions = [semanticExecution()];
    expect(validateSpfaSessionEvaluationV2(input, context(set)).semanticExecutions)
      .toEqual([semanticExecution()]);
  });

  it('accepts a requirement result without semantic execution', () => {
    const set = protocolSet();
    expect(validateSpfaSessionEvaluationV2(validEvaluation(set), context(set)).semanticExecutions)
      .toEqual([]);
  });

  it('rejects semantic execution for a missing requirement', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.semanticExecutions = [
      semanticExecution(
        ids.spfaA,
        validateSpfaProtocolRequirementIdV2(raw.missingRequirement),
      ),
    ];
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/does not reference an existing requirement result/);
  });

  it('rejects semantic execution for a missing application', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.semanticExecutions = [semanticExecution(ids.spfaB)];
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/does not reference an existing application/);
  });

  it('rejects duplicate semantic execution', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.semanticExecutions = [semanticExecution(), semanticExecution()];
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/duplicate semantic execution/);
  });

  it('rejects duplicate applications', () => {
    const set = protocolSet('multipleApplications');
    const input = mutableInput(set);
    applicationsOf(input)[1] = structuredClone(applicationsOf(input)[0]);
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/duplicate application/);
  });

  it('rejects duplicate requirement results', () => {
    const set = protocolSet('multipleRequirements');
    const input = mutableInput(set);
    resultsOf(input)[1] = structuredClone(resultsOf(input)[0]);
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/duplicate requirement result/);
  });

  it('rejects an incorrect schemaVersion', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.schemaVersion = '3.0';
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/schemaVersion/);
  });

  it('rejects an invalid sessionId', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.sessionId = 'session-semantic';
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/sessionId/);
  });

  it('rejects an invalid caseVersionId', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.caseVersionId = 'case-main-barrier';
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/caseVersionId/);
  });

  it('rejects an invalid or incompatible protocolCatalogRef', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.protocolCatalogRef = { id: '', version: '2026.1' };
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/protocolCatalogRef\.id/);
    input.protocolCatalogRef = { id: 'other-catalog', version: '2026.1' };
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/does not match the protocol set catalog/);
  });

  it('rejects an invalid transcriptFingerprint', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.transcriptFingerprint = {
      algorithm: 'sha256',
      canonicalization: 'session-transcript-v2/1',
      value: 'not-a-digest',
    };
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/transcriptFingerprint\.value/);
  });

  it.each([
    ['responseModel', ''],
    ['promptVersion', ''],
  ])('rejects an empty semantic %s', (field, value) => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.semanticExecutions = [semanticExecution()];
    executionsOf(input)[0][field] = value;
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(new RegExp(field));
  });

  it('rejects semantic provider other than openai', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    input.semanticExecutions = [semanticExecution()];
    executionsOf(input)[0].provider = 'other';
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/provider/);
  });

  it('delegates invalid requirement results to the canonical D1 validator', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    resultsOf(input)[0].sessionId = '10000000-0000-4000-8000-000000000099';
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/does not match the transcript session/);
  });

  it.each([
    ['root', (input: Record<string, unknown>) => { input.futureSecret = true; }],
    ['application', (input: Record<string, unknown>) => {
      applicationsOf(input)[0].evaluator = { protected: true };
    }],
    ['semanticExecution', (input: Record<string, unknown>) => {
      input.semanticExecutions = [semanticExecution()];
      executionsOf(input)[0].rawResponse = { protected: true };
    }],
  ])('rejects unexpected property at %s', (_label, contaminate) => {
    const set = protocolSet();
    const input = mutableInput(set);
    contaminate(input);
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/unexpected property/);
  });

  it('rejects an absent required root field', () => {
    const set = protocolSet();
    const input = mutableInput(set);
    delete input.semanticExecutions;
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/semanticExecutions: missing required property/);
  });

  it('rejects application order incompatible with the protocol set', () => {
    const set = protocolSet('multipleApplications');
    const input = mutableInput(set);
    input.applications = [...applicationsOf(input)].reverse();
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/does not follow protocol-set application order/);
  });

  it('rejects requirement-result order incompatible with the protocol set', () => {
    const set = protocolSet('multipleRequirements');
    const input = mutableInput(set);
    applicationsOf(input)[0].requirementResults = [...resultsOf(input)].reverse();
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/does not follow protocol-set requirement order/);
  });

  it('rejects semantic executions outside canonical requirement order', () => {
    const set = protocolSet('multipleRequirements');
    const input = mutableInput(set);
    input.semanticExecutions = [
      semanticExecution(ids.spfaA, ids.requirementActionA),
      semanticExecution(ids.spfaA, ids.requirementInfoA),
    ];
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/does not follow canonical application\/requirement order/);
  });

  it('rejects incomplete application and requirement collections', () => {
    const set = protocolSet('multipleApplications');
    const input = mutableInput(set);
    input.applications = [applicationsOf(input)[0]];
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(/exactly one entry for every protocol-set application/);

    const multiRequirementSet = protocolSet('multipleRequirements');
    const incomplete = mutableInput(multiRequirementSet);
    applicationsOf(incomplete)[0].requirementResults = [resultsOf(incomplete)[0]];
    expect(() => validateSpfaSessionEvaluationV2(incomplete, context(multiRequirementSet)))
      .toThrow(/exactly one result for every protocol-set requirement/);
  });

  it('returns a stable canonical copy', () => {
    const set = protocolSet('multipleApplications');
    const input = mutableInput(set);
    input.semanticExecutions = [semanticExecution()];
    const first = validateSpfaSessionEvaluationV2(input, context(set));
    const second = validateSpfaSessionEvaluationV2(first, context(set));
    expect(second).toEqual(first);
    expect(second).not.toBe(input);
    expect(second.applications).not.toBe(input.applications);
  });

  it.each([
    'patientFacts',
    'evaluator',
    'patientRuntime',
    'transcript',
    'messages',
    'prompt',
    'rawProviderResponse',
    'score',
    'feedback',
  ])('cannot carry protected root property %s', (field) => {
    const set = protocolSet();
    const input = mutableInput(set);
    input[field] = `SECRET_${field}`;
    expect(() => validateSpfaSessionEvaluationV2(input, context(set)))
      .toThrow(SpfaSessionEvaluationValidationError);
  });
});
