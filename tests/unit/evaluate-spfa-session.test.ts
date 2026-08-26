import { describe, expect, it, vi } from 'vitest';

import { buildSpfaSemanticTargetContextV2 } from '@/lib/cases/v2/build-spfa-semantic-target-context';
import { SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION } from '@/lib/cases/v2/build-openai-spfa-semantic-adjudication-params';
import type {
  AdjudicateSpfaRequirementV2,
  EvaluateSpfaSessionInputV2,
} from '@/lib/cases/v2/evaluate-spfa-session';
import {
  SpfaSessionEvaluationOrchestrationError,
  evaluateSpfaSessionV2,
} from '@/lib/cases/v2/evaluate-spfa-session';
import type { OpenAiSpfaSemanticAdjudicationExecutionReceiptV1 } from '@/lib/cases/v2/execute-openai-spfa-semantic-adjudication';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import type { SpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/spfa-evidence-baseline-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';

const opaque = (prefix: string, group: number, item: number) =>
  `${prefix}_${group.toString().padStart(8, '0')}-0000-4000-8000-${item
    .toString()
    .padStart(12, '0')}`;

const ids = {
  session: '10000000-0000-4000-8000-000000000001',
  caseVersion: opaque('casever', 20_000_000, 1),
  otherCaseVersion: opaque('casever', 20_000_000, 2),
  medication: opaque('med', 30_000_000, 1),
  initialSpfa: opaque('conclusion', 40_000_000, 1),
  additionalSpfa: opaque('conclusion', 40_000_000, 2),
  transition: opaque('conclusion', 40_000_000, 3),
  incidence: opaque('conclusion', 40_000_000, 4),
  prm: opaque('conclusion', 40_000_000, 5),
  rnm: opaque('conclusion', 40_000_000, 6),
  referral: opaque('conclusion', 40_000_000, 7),
  protocolA: opaque('spfa_protocol', 50_000_000, 1),
  protocolB: opaque('spfa_protocol', 50_000_000, 2),
  policy: opaque('spfa_policy', 52_000_000, 1),
  demandFact: opaque('fact', 60_000_000, 1),
  personFact: opaque('fact', 60_000_000, 2),
  medicationFact: opaque('fact', 60_000_000, 3),
  medicationOriginFact: opaque('fact', 60_000_000, 4),
} as const;

type RequirementMode =
  | 'DETERMINISTIC'
  | 'NOT_APPLICABLE'
  | 'SEMANTIC_INFORMATION'
  | 'SEMANTIC_INFORMATION_TWO_TARGETS'
  | 'PARTIAL_INFORMATION'
  | 'SEMANTIC_ACTION'
  | 'SEMANTIC_ACTION_TWO_TARGETS';

type DecisionStatus = 'SUPPORTED' | 'UNCERTAIN' | 'NOT_SUPPORTED';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function known(factId: string, value: unknown) {
  return {
    state: 'known',
    factId,
    value,
    certainty: 'exact',
    disclosure: { mode: 'spontaneous' },
  };
}

const notApplicable = {
  state: 'not_applicable',
  reasonCode: 'clinically_irrelevant',
};

function patientFacts(): Record<string, unknown> {
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    publicProfile: {
      nombre: 'Paciente sintética protegida',
      edad: 48,
      sexo: 'mujer',
      tratamiento: 'Medicamento sintético',
    },
    initialDemand: known(ids.demandFact, 'Demanda sintética'),
    encounter: {
      personPresent: known(ids.personFact, 'patient'),
      relationshipToPatient: { ...notApplicable },
    },
    clinicalContext: {
      healthProblems: [],
      clinicalHistory: [],
      physiologicalSituation: [],
      pregnancyAndLactation: { ...notApplicable },
      allergiesAndIntolerances: [],
      lifestyle: [],
      biomedicalData: [],
    },
    symptoms: [],
    pharmacotherapy: {
      prescribedMedications: [
        {
          medicationId: ids.medication,
          displayName: known(ids.medicationFact, 'Medicamento sintético'),
          origin: known(ids.medicationOriginFact, 'prescribed'),
          purposeAsUnderstood: { ...notApplicable },
          regimenBasis: { ...notApplicable },
          referenceDose: { ...notApplicable },
          referenceSchedule: { ...notApplicable },
          referenceDuration: { ...notApplicable },
          administrationMethod: { ...notApplicable },
          specialUseConditions: [],
        },
      ],
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
      cooperation: 3,
      organization: 3,
      emotionalReactivity: 3,
      opennessToChange: 3,
      healthLiteracy: 'medium',
      professionalTrust: 3,
      medicationAttitude: 'neutral',
      decisionStyle: 'shared',
      readinessToChange: 3,
      socialDesirability: 3,
      judgmentSensitivity: 3,
      disclosureThreshold: 3,
      answerLength: 'medium',
      assertiveness: 3,
      emotionalExpression: 3,
    },
  };
}

function evidenceRule(conclusionRef: string) {
  return {
    conclusionRef,
    requiredEvidence: { operator: 'fact', factRef: ids.demandFact },
    supportingEvidenceRefs: [],
    counterEvidenceRefs: [],
    teacherRationale: 'Justificación docente protegida',
  };
}

function evaluator(applicationCount: 1 | 2): Record<string, unknown> {
  return {
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    versions: {
      evaluatorSchema: { id: 'evaluator-v2', version: '2.0' },
      protocol: { id: 'catalogo-docente-spfa', version: '2026.1' },
      prmTaxonomy: { id: 'prm-test', version: '1' },
      rnmTaxonomy: { id: 'rnm-test', version: '1' },
      adherenceFramework: { id: 'adherence-test', version: '1' },
    },
    carePath: {
      initialSpfa: {
        conclusionId: ids.initialSpfa,
        kind: 'spfa',
        value: { service: 'dispensing', subtype: 'initial_treatment' },
      },
      additionalSpfas: applicationCount === 1
        ? []
        : [
            {
              conclusionId: ids.additionalSpfa,
              kind: 'spfa',
              value: { service: 'pharmaceutical_indication' },
            },
          ],
      transitions: applicationCount === 1
        ? []
        : [
            {
              conclusionId: ids.transition,
              kind: 'spfa_transition',
              value: {
                fromSpfaRef: ids.initialSpfa,
                toSpfaRef: ids.additionalSpfa,
              },
            },
          ],
    },
    incidence: {
      assessment: {
        conclusionId: ids.incidence,
        kind: 'incidence_assessment',
        value: { status: 'none' },
      },
      findings: [],
      followUpEpisodes: [],
    },
    prm: {
      assessment: {
        conclusionId: ids.prm,
        kind: 'prm_assessment',
        value: { status: 'none' },
      },
      findings: [],
    },
    rnmAssessments: [
      {
        conclusionId: ids.rnm,
        kind: 'rnm_assessment',
        value: { status: 'no_rnm' },
      },
    ],
    prmRnmRelations: [],
    adherence: {
      assessments: [],
      typeConclusions: [],
      patientProfiles: [],
      barrierAssessments: [],
      barriers: [],
      strategies: [],
    },
    professionalActions: [],
    pharmaceuticalInterventions: [],
    referral: {
      conclusionId: ids.referral,
      kind: 'referral',
      value: { status: 'not_required' },
    },
    evidenceRules: [
      evidenceRule(ids.incidence),
      evidenceRule(ids.prm),
      evidenceRule(ids.rnm),
      evidenceRule(ids.referral),
    ],
  };
}

function requirementId(index: number): string {
  return opaque('spfa_requirement', 51_000_000, index + 1);
}

function targetId(index: number, item: number): string {
  return opaque('spfa_target', 53_000_000 + index, item + 1);
}

function requirementDefinition(mode: RequirementMode, index: number) {
  const common = {
    requirementId: requirementId(index),
    teacherLabel: `Requisito ${index + 1}`,
    description: 'Descripción canónica',
    defaultImportance: 'RELEVANT',
    safetyCriticality: { safetyCritical: false },
    applicability: mode === 'NOT_APPLICABLE'
      ? { kind: 'CASE_DETERMINED', policyRef: ids.policy }
      : { kind: 'ALWAYS' },
  };
  return mode === 'SEMANTIC_ACTION' || mode === 'SEMANTIC_ACTION_TWO_TARGETS'
    ? {
        ...common,
        kind: 'ACTION_REQUIREMENT',
        semanticDomain: 'safe_professional_action',
        actionGoal: 'Realizar la actuación',
      }
    : {
        ...common,
        kind: 'INFORMATION_REQUIREMENT',
        semanticDomain: {
          kind: 'patient_information',
          disclosureDomain: 'symptoms',
        },
        informationGoal: 'Obtener información',
      };
}

function appliedRequirement(mode: RequirementMode, index: number) {
  const identity = {
    requirementRef: requirementId(index),
    applicability: mode === 'NOT_APPLICABLE'
      ? {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'CASE_DETERMINED', policyRef: ids.policy },
        }
      : { status: 'APPLICABLE', effectiveImportance: 'RELEVANT' },
  };
  if (mode === 'NOT_APPLICABLE') {
    return {
      ...identity,
      kind: 'INFORMATION_REQUIREMENT',
      informationTargets: [],
    };
  }
  if (mode === 'SEMANTIC_ACTION' || mode === 'SEMANTIC_ACTION_TWO_TARGETS') {
    return {
      ...identity,
      kind: 'ACTION_REQUIREMENT',
      actionTargets: [
        {
          targetId: targetId(index, 0),
          target: { kind: 'EVALUATOR_CONCLUSION', conclusionRef: ids.referral },
        },
        ...(mode === 'SEMANTIC_ACTION_TWO_TARGETS'
          ? [
              {
                targetId: targetId(index, 1),
                target: {
                  kind: 'EVALUATOR_CONCLUSION',
                  conclusionRef: ids.incidence,
                },
              },
            ]
          : []),
      ],
    };
  }
  const factTargets = [
    {
      targetId: targetId(index, 0),
      target: { kind: 'FACT', factRef: ids.demandFact },
    },
    ...(mode === 'SEMANTIC_INFORMATION_TWO_TARGETS'
      ? [
          {
            targetId: targetId(index, 1),
            target: { kind: 'FACT', factRef: ids.medicationFact },
          },
        ]
      : []),
  ];
  return {
    ...identity,
    kind: 'INFORMATION_REQUIREMENT',
    informationTargets: mode === 'DETERMINISTIC'
      ? [
          {
            targetId: targetId(index, 0),
            target: { kind: 'PUBLIC_PROFILE', field: 'age' },
          },
        ]
      : mode === 'PARTIAL_INFORMATION'
        ? [
            {
              targetId: targetId(index, 0),
              target: { kind: 'PUBLIC_PROFILE', field: 'age' },
            },
            {
              targetId: targetId(index, 1),
              target: { kind: 'FACT', factRef: ids.demandFact },
            },
          ]
        : factTargets,
  };
}

function coreFor(applicationModes: readonly RequirementMode[][]): SpfaIntegratedGeneratedCaseCoreV2 {
  const applications = applicationModes.map((modes, applicationIndex) => {
    const protocolId = applicationIndex === 0 ? ids.protocolA : ids.protocolB;
    const carePathSpfaRef = applicationIndex === 0
      ? ids.initialSpfa
      : ids.additionalSpfa;
    return {
      schemaVersion: '2.0',
      caseVersionId: ids.caseVersion,
      carePathSpfaRef,
      protocolRef: { protocolId, version: `protocol-${applicationIndex + 1}` },
      requirements: modes.map((mode, requirementIndex) =>
        appliedRequirement(mode, applicationIndex * 10 + requirementIndex),
      ),
    };
  });
  const definitions = applicationModes.map((modes, applicationIndex) => ({
    schemaVersion: '2.0',
    protocolId: applicationIndex === 0 ? ids.protocolA : ids.protocolB,
    version: `protocol-${applicationIndex + 1}`,
    service: applicationIndex === 0 ? 'dispensing' : 'pharmaceutical_indication',
    ...(applicationIndex === 0 ? { subtype: 'initial_treatment' } : {}),
    requirements: modes.map((mode, requirementIndex) =>
      requirementDefinition(mode, applicationIndex * 10 + requirementIndex),
    ),
  }));
  return {
    caseVersionId: ids.caseVersion,
    patientFacts: patientFacts(),
    evaluator: evaluator(applicationModes.length as 1 | 2),
    spfaProtocolSet: {
      schemaVersion: '2.0',
      catalogRef: { id: 'catalogo-docente-spfa', version: '2026.1' },
      definitions,
      applications,
    },
  } as unknown as SpfaIntegratedGeneratedCaseCoreV2;
}

const transcript = createSessionTranscriptSnapshotV2({
  sessionId: ids.session,
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
    {
      messageId: '3',
      role: 'patient',
      content: 'También noto mareo.',
      createdAt: '2026-08-25T09:00:02Z',
    },
  ],
});

function inputFor(applicationModes: readonly RequirementMode[][]): EvaluateSpfaSessionInputV2 {
  return { transcript, core: coreFor(applicationModes) };
}

type ReceiptOptions = Readonly<{
  statuses?: readonly DecisionStatus[];
  responseModel?: string;
  promptVersion?: string;
  mutateAdjudication?: (value: Record<string, unknown>) => void;
  extraReceiptProperty?: boolean;
}>;

function receiptFor(
  baseline: SpfaRequirementEvidenceBaselineV2,
  options: ReceiptOptions = {},
): OpenAiSpfaSemanticAdjudicationExecutionReceiptV1 {
  const statuses = options.statuses ?? baseline.unresolvedTargetRefs.map(() => 'SUPPORTED');
  const decisions = baseline.unresolvedTargetRefs.map((targetRef, index) => {
    const status = statuses[index] ?? 'SUPPORTED';
    if (status !== 'SUPPORTED') return { targetRef, status, supports: [] };
    return baseline.kind === 'INFORMATION_REQUIREMENT'
      ? {
          targetRef,
          status,
          supports: [
            {
              targetRef,
              messageRef: '2',
              evidenceKind: 'PATIENT_STATEMENT',
              excerpt: 'dolor desde ayer',
              acquisition: { mode: 'SPONTANEOUS' },
            },
          ],
        }
      : {
          targetRef,
          status,
          supports: [
            {
              targetRef,
              messageRef: '1',
              evidenceKind: 'STUDENT_ACTION',
              excerpt: 'recomiendo consultar hoy',
            },
          ],
        };
  });
  const adjudication: Record<string, unknown> = {
    schemaVersion: '2.0',
    contractVersion: 'spfa-semantic-adjudication/1',
    sessionId: baseline.sessionId,
    caseVersionId: baseline.caseVersionId,
    transcriptFingerprint: baseline.transcriptFingerprint,
    carePathSpfaRef: baseline.carePathSpfaRef,
    requirementRef: baseline.requirementRef,
    kind: baseline.kind,
    decisions,
  };
  options.mutateAdjudication?.(adjudication);
  const receipt: Record<string, unknown> = {
    adjudication,
    provider: 'openai',
    responseModel: options.responseModel ?? 'gpt-5.6-sol',
    promptVersion:
      options.promptVersion ?? SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
  };
  if (options.extraReceiptProperty) receipt.rawResponse = 'PROVIDER_RAW_SECRET';
  return receipt as unknown as OpenAiSpfaSemanticAdjudicationExecutionReceiptV1;
}

function fakeAdjudicator(
  optionsForCall: (callIndex: number, baseline: SpfaRequirementEvidenceBaselineV2) => ReceiptOptions =
    () => ({}),
) {
  const inputs: Parameters<AdjudicateSpfaRequirementV2>[0][] = [];
  const adjudicate = vi.fn<AdjudicateSpfaRequirementV2>(async (input) => {
    inputs.push(input);
    return receiptFor(input.baseline, optionsForCall(inputs.length - 1, input.baseline));
  });
  return { adjudicate, inputs };
}

function firstResult(result: Awaited<ReturnType<typeof evaluateSpfaSessionV2>>) {
  return result.applications[0].requirementResults[0];
}

describe('evaluateSpfaSessionV2', () => {
  it('returns a valid aggregate with zero calls when every requirement is deterministic', async () => {
    const fake = fakeAdjudicator();
    const result = await evaluateSpfaSessionV2(
      inputFor([['DETERMINISTIC']]),
      fake,
    );
    expect(fake.adjudicate).not.toHaveBeenCalled();
    expect(firstResult(result)).toMatchObject({
      kind: 'INFORMATION_REQUIREMENT',
      coverage: { status: 'COVERED', origin: 'PUBLIC_INFORMATION' },
    });
    expect(result.semanticExecutions).toEqual([]);
  });

  it('materializes NOT_APPLICABLE with zero calls', async () => {
    const fake = fakeAdjudicator();
    const result = await evaluateSpfaSessionV2(
      inputFor([['NOT_APPLICABLE']]),
      fake,
    );
    expect(fake.adjudicate).not.toHaveBeenCalled();
    expect(firstResult(result)).toMatchObject({
      kind: 'INFORMATION_REQUIREMENT',
      coverage: { status: 'NOT_APPLICABLE', evidence: [] },
    });
  });

  it('calls exactly once for one semantic requirement', async () => {
    const fake = fakeAdjudicator();
    await evaluateSpfaSessionV2(inputFor([['SEMANTIC_INFORMATION']]), fake);
    expect(fake.adjudicate).toHaveBeenCalledTimes(1);
    expect(() => buildSpfaSemanticTargetContextV2(fake.inputs[0])).not.toThrow();
  });

  it('calls once for several semantic targets in one requirement', async () => {
    const fake = fakeAdjudicator();
    await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION_TWO_TARGETS']]),
      fake,
    );
    expect(fake.adjudicate).toHaveBeenCalledTimes(1);
    expect(fake.inputs[0].baseline.unresolvedTargetRefs).toHaveLength(2);
  });

  it('calls once for each of two semantic requirements', async () => {
    const fake = fakeAdjudicator();
    await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION', 'SEMANTIC_ACTION']]),
      fake,
    );
    expect(fake.adjudicate).toHaveBeenCalledTimes(2);
  });

  it('calls only the semantic requirement in a deterministic/semantic mix', async () => {
    const fake = fakeAdjudicator();
    const result = await evaluateSpfaSessionV2(
      inputFor([['DETERMINISTIC', 'SEMANTIC_INFORMATION']]),
      fake,
    );
    expect(fake.adjudicate).toHaveBeenCalledTimes(1);
    expect(fake.inputs[0].baseline.requirementRef).toBe(requirementId(1));
    expect(result.semanticExecutions).toHaveLength(1);
  });

  it('composes completely covered INFORMATION', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION']]),
      fakeAdjudicator(),
    );
    expect(firstResult(result)).toMatchObject({
      kind: 'INFORMATION_REQUIREMENT',
      coverage: { status: 'COVERED', origin: 'PATIENT_SPONTANEOUS' },
    });
  });

  it('composes partially covered INFORMATION', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([['PARTIAL_INFORMATION']]),
      fakeAdjudicator(() => ({ statuses: ['NOT_SUPPORTED'] })),
    );
    expect(firstResult(result)).toMatchObject({
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'PARTIALLY_COVERED',
        origin: 'PUBLIC_INFORMATION',
      },
    });
  });

  it('composes performed ACTION', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_ACTION']]),
      fakeAdjudicator(),
    );
    expect(firstResult(result)).toMatchObject({
      kind: 'ACTION_REQUIREMENT',
      outcome: { status: 'PERFORMED' },
    });
  });

  it('composes partially performed ACTION', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_ACTION_TWO_TARGETS']]),
      fakeAdjudicator(() => ({ statuses: ['SUPPORTED', 'NOT_SUPPORTED'] })),
    );
    expect(firstResult(result)).toMatchObject({
      kind: 'ACTION_REQUIREMENT',
      outcome: { status: 'PARTIALLY_PERFORMED' },
    });
  });

  it('preserves NOT_SUPPORTED as remaining but not uncertain', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION']]),
      fakeAdjudicator(() => ({ statuses: ['NOT_SUPPORTED'] })),
    );
    const requirementResult = firstResult(result);
    if (requirementResult.kind !== 'INFORMATION_REQUIREMENT') {
      throw new Error('fixture mismatch');
    }
    expect(requirementResult.coverage).toMatchObject({
      status: 'NOT_COVERED',
      remainingTargetRefs: [targetId(0, 0)],
      uncertainTargetRefs: [],
    });
  });

  it('preserves UNCERTAIN in remainingTargetRefs and uncertainTargetRefs', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION']]),
      fakeAdjudicator(() => ({ statuses: ['UNCERTAIN'] })),
    );
    const requirementResult = firstResult(result);
    if (requirementResult.kind !== 'INFORMATION_REQUIREMENT') {
      throw new Error('fixture mismatch');
    }
    expect(requirementResult.coverage).toMatchObject({
      status: 'NOT_COVERED',
      remainingTargetRefs: [targetId(0, 0)],
      uncertainTargetRefs: [targetId(0, 0)],
    });
  });

  it('preserves canonical application order', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION'], ['SEMANTIC_INFORMATION']]),
      fakeAdjudicator(),
    );
    expect(result.applications.map((item) => item.carePathSpfaRef)).toEqual([
      ids.initialSpfa,
      ids.additionalSpfa,
    ]);
  });

  it('preserves canonical requirement order', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_ACTION', 'SEMANTIC_INFORMATION']]),
      fakeAdjudicator(),
    );
    expect(result.applications[0].requirementResults.map((item) => item.requirementRef))
      .toEqual([requirementId(0), requirementId(1)]);
  });

  it('emits semantic executions as a canonical subsequence', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([
        ['DETERMINISTIC', 'SEMANTIC_INFORMATION'],
        ['NOT_APPLICABLE', 'SEMANTIC_ACTION'],
      ]),
      fakeAdjudicator(),
    );
    expect(result.semanticExecutions.map((item) => [
      item.carePathSpfaRef,
      item.requirementRef,
    ])).toEqual([
      [ids.initialSpfa, requirementId(1)],
      [ids.additionalSpfa, requirementId(11)],
    ]);
  });

  it('copies provider, responseModel and promptVersion from each receipt', async () => {
    const fake = fakeAdjudicator((callIndex) => ({
      responseModel: `gpt-model-${callIndex + 1}`,
    }));
    const result = await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION', 'SEMANTIC_ACTION']]),
      fake,
    );
    expect(result.semanticExecutions).toEqual([
      {
        carePathSpfaRef: ids.initialSpfa,
        requirementRef: requirementId(0),
        provider: 'openai',
        responseModel: 'gpt-model-1',
        promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
      },
      {
        carePathSpfaRef: ids.initialSpfa,
        requirementRef: requirementId(1),
        provider: 'openai',
        responseModel: 'gpt-model-2',
        promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
      },
    ]);
  });

  it('propagates the exact adjudicator error', async () => {
    const expected = new Error('synthetic adjudicator failure');
    const adjudicate = vi.fn<AdjudicateSpfaRequirementV2>(async () => {
      throw expected;
    });
    await expect(evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION']]),
      { adjudicate },
    )).rejects.toBe(expected);
  });

  it('stops before later requirements when an intermediate adjudication fails', async () => {
    const expected = new Error('second requirement failed');
    let calls = 0;
    const adjudicate = vi.fn<AdjudicateSpfaRequirementV2>(async (input) => {
      calls += 1;
      if (calls === 2) throw expected;
      return receiptFor(input.baseline);
    });
    await expect(evaluateSpfaSessionV2(
      inputFor([[
        'SEMANTIC_INFORMATION',
        'SEMANTIC_ACTION',
        'SEMANTIC_INFORMATION',
      ]]),
      { adjudicate },
    )).rejects.toBe(expected);
    expect(adjudicate).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['other requirement', (value: Record<string, unknown>) => {
      value.requirementRef = requirementId(99);
    }],
    ['other SPFA', (value: Record<string, unknown>) => {
      value.carePathSpfaRef = ids.additionalSpfa;
    }],
    ['other case version', (value: Record<string, unknown>) => {
      value.caseVersionId = ids.otherCaseVersion;
    }],
    ['other fingerprint', (value: Record<string, unknown>) => {
      value.transcriptFingerprint = {
        algorithm: 'sha256',
        canonicalization: 'session-transcript-v2/1',
        value: 'a'.repeat(64),
      };
    }],
  ])('rejects a receipt pinned to %s', async (_label, mutateAdjudication) => {
    await expect(evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION']]),
      fakeAdjudicator(() => ({ mutateAdjudication })),
    )).rejects.toBeInstanceOf(SpfaSessionEvaluationOrchestrationError);
  });

  it('rejects adjudication with a missing target', async () => {
    await expect(evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION_TWO_TARGETS']]),
      fakeAdjudicator(() => ({
        mutateAdjudication: (value) => {
          value.decisions = (value.decisions as unknown[]).slice(0, 1);
        },
      })),
    )).rejects.toBeInstanceOf(SpfaSessionEvaluationOrchestrationError);
  });

  it('rejects adjudication with an extra target', async () => {
    await expect(evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION']]),
      fakeAdjudicator(() => ({
        mutateAdjudication: (value) => {
          const decisions = value.decisions as Record<string, unknown>[];
          value.decisions = [
            ...decisions,
            {
              targetRef: targetId(0, 99),
              status: 'NOT_SUPPORTED',
              supports: [],
            },
          ];
        },
      })),
    )).rejects.toBeInstanceOf(SpfaSessionEvaluationOrchestrationError);
  });

  it('rejects adjudication with a duplicate target', async () => {
    await expect(evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION_TWO_TARGETS']]),
      fakeAdjudicator(() => ({
        mutateAdjudication: (value) => {
          const decisions = value.decisions as Record<string, unknown>[];
          value.decisions = [decisions[0], clone(decisions[0])];
        },
      })),
    )).rejects.toBeInstanceOf(SpfaSessionEvaluationOrchestrationError);
  });

  it.each([
    ['empty responseModel', { responseModel: '' }],
    ['invalid promptVersion', { promptVersion: 'future-prompt' }],
    ['raw receipt property', { extraReceiptProperty: true }],
  ])('rejects %s before evaluating a later requirement', async (_label, options) => {
    let calls = 0;
    const adjudicate = vi.fn<AdjudicateSpfaRequirementV2>(async (input) => {
      calls += 1;
      return receiptFor(input.baseline, calls === 1 ? options : {});
    });
    await expect(evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION', 'SEMANTIC_ACTION']]),
      { adjudicate },
    )).rejects.toBeInstanceOf(SpfaSessionEvaluationOrchestrationError);
    expect(adjudicate).toHaveBeenCalledTimes(1);
  });

  it('fails transcript/core mismatch before adjudicating', async () => {
    const fake = fakeAdjudicator();
    const incompatibleTranscript = createSessionTranscriptSnapshotV2({
      sessionId: ids.session,
      caseVersionId: ids.otherCaseVersion,
      messages: transcript.messages,
    });
    await expect(evaluateSpfaSessionV2(
      {
        transcript: incompatibleTranscript,
        core: coreFor([['SEMANTIC_INFORMATION']]),
      },
      fake,
    )).rejects.toBeInstanceOf(SpfaSessionEvaluationOrchestrationError);
    expect(fake.adjudicate).not.toHaveBeenCalled();
  });

  it('fails an incompatible protocol set before adjudicating', async () => {
    const fake = fakeAdjudicator();
    const input = clone(inputFor([['SEMANTIC_INFORMATION']]));
    const mutableCore = input.core as unknown as {
      spfaProtocolSet: { catalogRef: { id: string; version: string } };
    };
    mutableCore.spfaProtocolSet.catalogRef = {
      id: 'wrong-catalog',
      version: '2026.1',
    };
    await expect(evaluateSpfaSessionV2(input, fake)).rejects.toThrow();
    expect(fake.adjudicate).not.toHaveBeenCalled();
  });

  it('does not expose protected core, transcript or provider data', async () => {
    const result = await evaluateSpfaSessionV2(
      inputFor([['SEMANTIC_INFORMATION']]),
      fakeAdjudicator(),
    );
    const serialized = JSON.stringify(result);
    const collectKeys = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.flatMap(collectKeys);
      if (typeof value !== 'object' || value === null) return [];
      return Object.entries(value).flatMap(([key, nested]) => [
        key,
        ...collectKeys(nested),
      ]);
    };
    const keys = collectKeys(result);
    for (const forbiddenKey of [
      'patientFacts',
      'evaluator',
      'transcript',
      'messages',
      'prompt',
      'rawResponse',
      'score',
      'feedback',
    ]) {
      expect(keys).not.toContain(forbiddenKey);
    }
    for (const protectedValue of [
      'Paciente sintética protegida',
      'Justificación docente protegida',
      'Tengo dolor desde ayer',
    ]) {
      expect(serialized).not.toContain(protectedValue);
    }
  });

  it('is deterministic for equal inputs and equal adjudicator outputs', async () => {
    const first = await evaluateSpfaSessionV2(
      inputFor([['PARTIAL_INFORMATION', 'SEMANTIC_ACTION']]),
      fakeAdjudicator(),
    );
    const second = await evaluateSpfaSessionV2(
      inputFor([['PARTIAL_INFORMATION', 'SEMANTIC_ACTION']]),
      fakeAdjudicator(),
    );
    expect(second).toEqual(first);
  });

  it('awaits adjudications sequentially in canonical order', async () => {
    const order: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const adjudicate = vi.fn<AdjudicateSpfaRequirementV2>(async (input) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      order.push(input.baseline.requirementRef);
      await Promise.resolve();
      active -= 1;
      return receiptFor(input.baseline);
    });
    await evaluateSpfaSessionV2(
      inputFor([
        ['SEMANTIC_INFORMATION', 'SEMANTIC_ACTION'],
        ['SEMANTIC_INFORMATION'],
      ]),
      { adjudicate },
    );
    expect(maximumActive).toBe(1);
    expect(order).toEqual([
      requirementId(0),
      requirementId(1),
      requirementId(10),
    ]);
  });
});
