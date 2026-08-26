import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('@/lib/db', () => ({ pool: { query: queryMock } }));

import { SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION } from '@/lib/cases/v2/build-openai-spfa-semantic-adjudication-params';
import {
  evaluateOwnedGeneratedSpfaSessionV2,
  type EvaluateOwnedGeneratedSpfaSessionDependenciesV2,
} from '@/lib/cases/v2/evaluate-owned-generated-spfa-session';
import {
  evaluateSpfaSessionV2,
  type AdjudicateSpfaRequirementV2,
} from '@/lib/cases/v2/evaluate-spfa-session';
import type { OpenAiSpfaSemanticAdjudicationExecutionReceiptV1 } from '@/lib/cases/v2/execute-openai-spfa-semantic-adjudication';
import {
  OPENAI_SPFA_SEMANTIC_PRODUCTION_MODEL,
  type OpenAiSpfaSemanticAdjudicationRuntimeV2,
} from '@/lib/cases/v2/openai-spfa-semantic-adjudication-runtime';
import { createPatientRuntimeViewV2 } from '@/lib/cases/v2/patient-runtime';
import {
  resolveSessionSpfaEvaluationRuntimeV2,
  SessionClinicalRuntimeErrorV2,
} from '@/lib/cases/v2/session-clinical-runtime';
import type { SpfaRequirementEvidenceBaselineV2 } from '@/lib/cases/v2/spfa-evidence-baseline-types';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import { validateSpfaSessionEvaluationV2 } from '@/lib/cases/v2/validate-spfa-session-evaluation';

const opaque = (prefix: string, group: number, item: number) =>
  `${prefix}_${group.toString().padStart(8, '0')}-0000-4000-8000-${item
    .toString()
    .padStart(12, '0')}`;

const ids = {
  session: '10000000-0000-4000-8000-000000000001',
  otherSession: '10000000-0000-4000-8000-000000000002',
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

const authenticatedUserId = 41;
const caseId = 7;

type RequirementMode =
  | 'DETERMINISTIC'
  | 'NOT_APPLICABLE'
  | 'SEMANTIC_INFORMATION'
  | 'SEMANTIC_INFORMATION_TWO_TARGETS'
  | 'SEMANTIC_ACTION';

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
  return mode === 'SEMANTIC_ACTION'
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
  if (mode === 'SEMANTIC_ACTION') {
    return {
      ...identity,
      kind: 'ACTION_REQUIREMENT',
      actionTargets: [
        {
          targetId: targetId(index, 0),
          target: { kind: 'EVALUATOR_CONCLUSION', conclusionRef: ids.referral },
        },
      ],
    };
  }
  if (mode === 'DETERMINISTIC') {
    return {
      ...identity,
      kind: 'INFORMATION_REQUIREMENT',
      informationTargets: [
        {
          targetId: targetId(index, 0),
          target: { kind: 'PUBLIC_PROFILE', field: 'age' },
        },
      ],
    };
  }
  return {
    ...identity,
    kind: 'INFORMATION_REQUIREMENT',
    informationTargets: [
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
    ],
  };
}

function coreFor(
  applicationModes: readonly RequirementMode[][],
): SpfaIntegratedGeneratedCaseCoreV2 {
  const applications = applicationModes.map((modes, applicationIndex) => ({
    schemaVersion: '2.0',
    caseVersionId: ids.caseVersion,
    carePathSpfaRef: applicationIndex === 0
      ? ids.initialSpfa
      : ids.additionalSpfa,
    protocolRef: {
      protocolId: applicationIndex === 0 ? ids.protocolA : ids.protocolB,
      version: `protocol-${applicationIndex + 1}`,
    },
    requirements: modes.map((mode, requirementIndex) =>
      appliedRequirement(mode, applicationIndex * 10 + requirementIndex),
    ),
  }));
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

function generatedContent(core: SpfaIntegratedGeneratedCaseCoreV2) {
  return {
    schemaVersion: '2.0',
    sourceOfTruth: {
      caseVersionId: core.caseVersionId,
      patientFacts: core.patientFacts,
      evaluator: core.evaluator,
      spfaProtocolSet: core.spfaProtocolSet,
    },
    derived: {
      patientRuntime: createPatientRuntimeViewV2(core.patientFacts),
      teachingSummary: { caseVersionId: core.caseVersionId },
      complianceReport: { caseVersionId: core.caseVersionId },
    },
  };
}

function generatedRow(
  core: SpfaIntegratedGeneratedCaseCoreV2,
  overrides: Record<string, unknown> = {},
) {
  return {
    session_id: ids.session,
    session_user_id: String(authenticatedUserId),
    session_case_id: String(caseId),
    session_case_version_id: ids.caseVersion,
    session_status: 'active',
    version_id: ids.caseVersion,
    version_case_id: String(caseId),
    version_status: 'PUBLISHED',
    version_source_kind: 'AI_GENERATED',
    version_legacy_status: null,
    version_content_format: 'GENERATED_CASE_BUNDLE_V2',
    version_content: generatedContent(core),
    ...overrides,
  };
}

function legacyRow() {
  return {
    ...generatedRow(coreFor([['DETERMINISTIC']])),
    version_source_kind: 'LEGACY_V1',
    version_legacy_status: 'approved',
    version_content_format: 'LEGACY_V1_SNAPSHOT',
    version_content: {
      snapshotBasis: 'migration_time_current_row',
      legacyCaseId: caseId,
      legacyStatus: 'approved',
      serviceType: 'SAT',
      spec: {
        nombre: 'Paciente Legacy',
        edad: 54,
        sexo: 'mujer',
        tratamiento: 'Medicamento Legacy',
      },
      groundTruth: {},
    },
  };
}

const canonicalMessageRows = [
  {
    message_id: '1',
    message_role: 'student',
    message_content: '¿Qué le ocurre exactamente?',
    message_created_at: '2026-08-25T09:00:00Z',
  },
  {
    message_id: '2',
    message_role: 'patient',
    message_content: 'Tengo dolor desde ayer.',
    message_created_at: '2026-08-25T09:00:01Z',
  },
  {
    message_id: '3',
    message_role: 'patient',
    message_content: 'También noto mareo.',
    message_created_at: '2026-08-25T09:00:02Z',
  },
  {
    message_id: '4',
    message_role: 'student',
    message_content: 'Le recomiendo consultar hoy con su médico.',
    message_created_at: '2026-08-25T09:00:03Z',
  },
] as const;

function arrangeGenerated(
  core: SpfaIntegratedGeneratedCaseCoreV2,
  options: Readonly<{
    rowOverrides?: Record<string, unknown>;
    messages?: readonly unknown[];
  }> = {},
): void {
  queryMock.mockResolvedValueOnce({
    rows: [generatedRow(core, options.rowOverrides)],
  });
  queryMock.mockResolvedValueOnce({
    rows: [...(options.messages ?? canonicalMessageRows)],
  });
}

function receiptFor(
  baseline: SpfaRequirementEvidenceBaselineV2,
  statuses: readonly DecisionStatus[] = baseline.unresolvedTargetRefs.map(
    () => 'SUPPORTED',
  ),
  responseModel = 'gpt-5.6-sol',
): OpenAiSpfaSemanticAdjudicationExecutionReceiptV1 {
  return {
    provider: 'openai',
    responseModel,
    promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
    adjudication: {
      schemaVersion: '2.0',
      contractVersion: 'spfa-semantic-adjudication/1',
      sessionId: baseline.sessionId,
      caseVersionId: baseline.caseVersionId,
      transcriptFingerprint: baseline.transcriptFingerprint,
      carePathSpfaRef: baseline.carePathSpfaRef,
      requirementRef: baseline.requirementRef,
      kind: baseline.kind,
      decisions: baseline.unresolvedTargetRefs.map((targetRef, index) => {
        const status = statuses[index] ?? 'SUPPORTED';
        if (status !== 'SUPPORTED') {
          return { targetRef, status, supports: [] };
        }
        if (baseline.kind === 'ACTION_REQUIREMENT') {
          return {
            targetRef,
            status,
            supports: [
              {
                targetRef,
                messageRef: '4',
                evidenceKind: 'STUDENT_ACTION',
                excerpt: 'recomiendo consultar hoy',
              },
            ],
          };
        }
        if (index === 0) {
          return {
            targetRef,
            status,
            supports: [
              {
                targetRef,
                messageRef: '2',
                evidenceKind: 'PATIENT_STATEMENT',
                excerpt: 'dolor desde ayer',
                acquisition: {
                  mode: 'ELICITED',
                  studentQuestionRef: '1',
                },
              },
            ],
          };
        }
        return {
          targetRef,
          status,
          supports: [
            {
              targetRef,
              messageRef: '3',
              evidenceKind: 'PATIENT_STATEMENT',
              excerpt: 'noto mareo',
              acquisition: { mode: 'SPONTANEOUS' },
            },
          ],
        };
      }),
    },
  } as OpenAiSpfaSemanticAdjudicationExecutionReceiptV1;
}

function fakeSemanticRuntime(
  resolveReceipt: (
    input: Parameters<AdjudicateSpfaRequirementV2>[0],
    callIndex: number,
  ) => Promise<OpenAiSpfaSemanticAdjudicationExecutionReceiptV1> =
    async (input) => receiptFor(input.baseline),
) {
  let callIndex = 0;
  const adjudicate = vi.fn<AdjudicateSpfaRequirementV2>(async (input) => {
    const currentCallIndex = callIndex;
    callIndex += 1;
    return resolveReceipt(input, currentCallIndex);
  });
  const runtime: OpenAiSpfaSemanticAdjudicationRuntimeV2 = Object.freeze({
    adjudicate,
  });
  const createAdjudicationRuntime = vi.fn(() => runtime);
  return { adjudicate, createAdjudicationRuntime };
}

function stackDependencies(
  semantic: ReturnType<typeof fakeSemanticRuntime>,
): EvaluateOwnedGeneratedSpfaSessionDependenciesV2 {
  return {
    resolveRuntime: resolveSessionSpfaEvaluationRuntimeV2,
    createAdjudicationRuntime: semantic.createAdjudicationRuntime,
    evaluateSession: evaluateSpfaSessionV2,
  };
}

async function evaluate(
  core: SpfaIntegratedGeneratedCaseCoreV2,
  semantic = fakeSemanticRuntime(),
  input: Record<string, unknown> = {},
) {
  arrangeGenerated(core);
  const result = await evaluateOwnedGeneratedSpfaSessionV2(
    {
      authenticatedUserId,
      sessionId: ids.session,
      ...input,
    },
    stackDependencies(semantic),
  );
  return { result, semantic };
}

function firstRequirementResult(
  result: Awaited<ReturnType<typeof evaluateOwnedGeneratedSpfaSessionV2>>,
) {
  return result.applications[0].requirementResults[0];
}

async function captureRuntimeError(
  promise: Promise<unknown>,
): Promise<SessionClinicalRuntimeErrorV2> {
  try {
    await promise;
    throw new Error('expected a session runtime error');
  } catch (error) {
    expect(error).toBeInstanceOf(SessionClinicalRuntimeErrorV2);
    return error as SessionClinicalRuntimeErrorV2;
  }
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('M5-E server-side SPFA session evaluation stack', () => {
  it('integrates E3 -> E4 -> E2 -> D2/D3D -> E1 with no semantic runtime for a deterministic session', async () => {
    const core = coreFor([['DETERMINISTIC']]);
    const { result, semantic } = await evaluate(core);

    expect(semantic.createAdjudicationRuntime).not.toHaveBeenCalled();
    expect(semantic.adjudicate).not.toHaveBeenCalled();
    expect(result.semanticExecutions).toEqual([]);
    expect(firstRequirementResult(result)).toMatchObject({
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'COVERED',
        origin: 'PUBLIC_INFORMATION',
      },
    });
    expect(() => validateSpfaSessionEvaluationV2(result, {
      transcript: createSessionTranscriptSnapshotV2({
        sessionId: ids.session,
        caseVersionId: ids.caseVersion,
        messages: canonicalMessageRows.map((row) => ({
          messageId: row.message_id,
          role: row.message_role,
          content: row.message_content,
          createdAt: row.message_created_at,
        })),
      }),
      spfaProtocolSet: core.spfaProtocolSet,
    })).not.toThrow();
  });

  it('integrates deterministic information, elicited information and student action with one call per semantic requirement', async () => {
    const semantic = fakeSemanticRuntime();
    const { result } = await evaluate(
      coreFor([['DETERMINISTIC', 'SEMANTIC_INFORMATION', 'SEMANTIC_ACTION']]),
      semantic,
    );

    expect(semantic.createAdjudicationRuntime).toHaveBeenCalledTimes(1);
    expect(semantic.adjudicate).toHaveBeenCalledTimes(2);
    expect(result.semanticExecutions).toEqual([
      {
        carePathSpfaRef: ids.initialSpfa,
        requirementRef: requirementId(1),
        provider: 'openai',
        responseModel: 'gpt-5.6-sol',
        promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
      },
      {
        carePathSpfaRef: ids.initialSpfa,
        requirementRef: requirementId(2),
        provider: 'openai',
        responseModel: 'gpt-5.6-sol',
        promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
      },
    ]);
    expect(result.applications[0].requirementResults[1]).toMatchObject({
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'COVERED',
        origin: 'STUDENT_ELICITED',
        evidence: [
          {
            source: 'TRANSCRIPT_MESSAGE',
            messageRef: '1',
            evidenceKind: 'STUDENT_QUESTION',
          },
          {
            source: 'TRANSCRIPT_MESSAGE',
            messageRef: '2',
            evidenceKind: 'PATIENT_STATEMENT',
          },
        ],
      },
    });
    expect(result.applications[0].requirementResults[2]).toMatchObject({
      kind: 'ACTION_REQUIREMENT',
      outcome: {
        status: 'PERFORMED',
        evidence: [
          {
            source: 'TRANSCRIPT_MESSAGE',
            messageRef: '4',
            evidenceKind: 'STUDENT_ACTION',
          },
        ],
      },
    });
  });

  it('uses one adjudication for one semantic requirement with several targets', async () => {
    const semantic = fakeSemanticRuntime();
    const { result } = await evaluate(
      coreFor([['SEMANTIC_INFORMATION_TWO_TARGETS']]),
      semantic,
    );
    expect(semantic.adjudicate).toHaveBeenCalledTimes(1);
    expect(semantic.adjudicate.mock.calls[0][0].baseline.unresolvedTargetRefs)
      .toHaveLength(2);
    expect(firstRequirementResult(result)).toMatchObject({
      coverage: {
        status: 'COVERED',
        origin: 'STUDENT_ELICITED',
        evidence: [
          {
            source: 'TRANSCRIPT_MESSAGE',
            messageRef: '1',
            evidenceKind: 'STUDENT_QUESTION',
          },
          {
            source: 'TRANSCRIPT_MESSAGE',
            messageRef: '2',
            evidenceKind: 'PATIENT_STATEMENT',
          },
          {
            source: 'TRANSCRIPT_MESSAGE',
            messageRef: '3',
            evidenceKind: 'PATIENT_STATEMENT',
          },
        ],
      },
    });
  });

  it('preserves UNCERTAIN as remaining and uncertain end to end', async () => {
    const semantic = fakeSemanticRuntime(async (input) =>
      receiptFor(input.baseline, ['UNCERTAIN']),
    );
    const { result } = await evaluate(
      coreFor([['SEMANTIC_INFORMATION']]),
      semantic,
    );
    expect(firstRequirementResult(result)).toMatchObject({
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'NOT_COVERED',
        remainingTargetRefs: [targetId(0, 0)],
        uncertainTargetRefs: [targetId(0, 0)],
      },
    });
  });

  it('preserves NOT_SUPPORTED as remaining without marking it uncertain', async () => {
    const semantic = fakeSemanticRuntime(async (input) =>
      receiptFor(input.baseline, ['NOT_SUPPORTED']),
    );
    const { result } = await evaluate(
      coreFor([['SEMANTIC_INFORMATION']]),
      semantic,
    );
    expect(firstRequirementResult(result)).toMatchObject({
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'NOT_COVERED',
        remainingTargetRefs: [targetId(0, 0)],
        uncertainTargetRefs: [],
      },
    });
  });

  it('materializes NOT_APPLICABLE without runtime creation or semantic execution', async () => {
    const { result, semantic } = await evaluate(
      coreFor([['NOT_APPLICABLE']]),
    );
    expect(semantic.createAdjudicationRuntime).not.toHaveBeenCalled();
    expect(semantic.adjudicate).not.toHaveBeenCalled();
    expect(result.semanticExecutions).toEqual([]);
    expect(firstRequirementResult(result)).toMatchObject({
      coverage: { status: 'NOT_APPLICABLE', evidence: [] },
    });
    expect(JSON.stringify(firstRequirementResult(result)))
      .not.toContain('uncertainTargetRefs');
  });

  it('keeps multiple applications, requirements and semantic executions in canonical order', async () => {
    const semantic = fakeSemanticRuntime();
    const { result } = await evaluate(
      coreFor([
        ['DETERMINISTIC', 'SEMANTIC_INFORMATION'],
        ['NOT_APPLICABLE', 'SEMANTIC_ACTION'],
      ]),
      semantic,
    );
    expect(result.applications.map((application) => application.carePathSpfaRef))
      .toEqual([ids.initialSpfa, ids.additionalSpfa]);
    expect(result.applications.map((application) =>
      application.requirementResults.map((item) => item.requirementRef),
    )).toEqual([
      [requirementId(0), requirementId(1)],
      [requirementId(10), requirementId(11)],
    ]);
    expect(result.semanticExecutions.map((execution) => [
      execution.carePathSpfaRef,
      execution.requirementRef,
    ])).toEqual([
      [ids.initialSpfa, requirementId(1)],
      [ids.additionalSpfa, requirementId(11)],
    ]);
    expect(semantic.adjudicate).toHaveBeenCalledTimes(2);
  });

  it('delegates ownership to the real E3 boundary using only authenticated user and session identity', async () => {
    const core = coreFor([['DETERMINISTIC']]);
    const { result } = await evaluate(core, fakeSemanticRuntime(), {
      userId: 999,
      model: 'gpt-5.6-terra',
      core: { future_secret: true },
      transcript: { future_secret: true },
    });
    expect(result.sessionId).toBe(ids.session);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0][1]).toEqual([ids.session, authenticatedUserId]);
    expect(queryMock.mock.calls[1][1]).toEqual([ids.session, authenticatedUserId]);
    expect(JSON.stringify(result)).not.toContain('gpt-5.6-terra');
    expect(OPENAI_SPFA_SEMANTIC_PRODUCTION_MODEL).toBe('gpt-5.6-sol');
  });

  it('maps missing and foreign sessions to the same ownership-safe error before E2/runtime', async () => {
    const semantic = fakeSemanticRuntime();
    queryMock.mockResolvedValueOnce({ rows: [] });
    const missing = await captureRuntimeError(
      evaluateOwnedGeneratedSpfaSessionV2(
        { authenticatedUserId, sessionId: ids.session },
        stackDependencies(semantic),
      ),
    );
    queryMock.mockResolvedValueOnce({ rows: [] });
    const foreign = await captureRuntimeError(
      evaluateOwnedGeneratedSpfaSessionV2(
        { authenticatedUserId: authenticatedUserId + 1, sessionId: ids.session },
        stackDependencies(semantic),
      ),
    );
    expect(missing.code).toBe('session_not_found_or_forbidden');
    expect(foreign.code).toBe(missing.code);
    expect(foreign.message).toBe(missing.message);
    expect(semantic.createAdjudicationRuntime).not.toHaveBeenCalled();
    expect(semantic.adjudicate).not.toHaveBeenCalled();
  });

  it('rejects an anchor from another session before reading or using its messages', async () => {
    const semantic = fakeSemanticRuntime();
    const core = coreFor([['SEMANTIC_INFORMATION']]);
    queryMock.mockResolvedValueOnce({
      rows: [generatedRow(core, { session_id: ids.otherSession })],
    });
    const error = await captureRuntimeError(
      evaluateOwnedGeneratedSpfaSessionV2(
        { authenticatedUserId, sessionId: ids.session },
        stackDependencies(semantic),
      ),
    );
    expect(error.code).toBe('invalid_session_anchor');
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(semantic.adjudicate).not.toHaveBeenCalled();
  });

  it('rejects Legacy without fabricating SPFA or creating the semantic runtime', async () => {
    const semantic = fakeSemanticRuntime();
    queryMock.mockResolvedValueOnce({ rows: [legacyRow()] });
    const error = await captureRuntimeError(
      evaluateOwnedGeneratedSpfaSessionV2(
        { authenticatedUserId, sessionId: ids.session },
        stackDependencies(semantic),
      ),
    );
    expect(error.code).toBe('spfa_evaluation_not_available');
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(semantic.createAdjudicationRuntime).not.toHaveBeenCalled();
    expect(semantic.adjudicate).not.toHaveBeenCalled();
  });

  it('fails before semantics when the Generated core is incompatible', async () => {
    const semantic = fakeSemanticRuntime();
    const core = coreFor([['SEMANTIC_INFORMATION']]);
    const content = generatedContent(core) as any;
    content.sourceOfTruth.spfaProtocolSet.catalogRef.id = 'other-catalog';
    queryMock.mockResolvedValueOnce({
      rows: [generatedRow(core, { version_content: content })],
    });
    const error = await captureRuntimeError(
      evaluateOwnedGeneratedSpfaSessionV2(
        { authenticatedUserId, sessionId: ids.session },
        stackDependencies(semantic),
      ),
    );
    expect(error.code).toBe('spfa_runtime_validation_failed');
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(semantic.adjudicate).not.toHaveBeenCalled();
  });

  it('fails before semantics when persisted transcript rows are invalid', async () => {
    const semantic = fakeSemanticRuntime();
    arrangeGenerated(coreFor([['SEMANTIC_INFORMATION']]), {
      messages: [
        {
          ...canonicalMessageRows[0],
          message_role: 'system',
        },
      ],
    });
    const error = await captureRuntimeError(
      evaluateOwnedGeneratedSpfaSessionV2(
        { authenticatedUserId, sessionId: ids.session },
        stackDependencies(semantic),
      ),
    );
    expect(error.code).toBe('invalid_session_transcript');
    expect(semantic.createAdjudicationRuntime).not.toHaveBeenCalled();
    expect(semantic.adjudicate).not.toHaveBeenCalled();
  });

  it('fails fast on the first adjudication without returning a partial result', async () => {
    const expected = new Error('synthetic first adjudication failure');
    const semantic = fakeSemanticRuntime(async () => {
      throw expected;
    });
    arrangeGenerated(coreFor([[
      'SEMANTIC_INFORMATION',
      'SEMANTIC_ACTION',
    ]]));
    await expect(evaluateOwnedGeneratedSpfaSessionV2(
      { authenticatedUserId, sessionId: ids.session },
      stackDependencies(semantic),
    )).rejects.toBe(expected);
    expect(semantic.adjudicate).toHaveBeenCalledTimes(1);
  });

  it('fails fast on the second of three semantic requirements and skips the third', async () => {
    const expected = new Error('synthetic second adjudication failure');
    const semantic = fakeSemanticRuntime(async (input, callIndex) => {
      if (callIndex === 1) throw expected;
      return receiptFor(input.baseline);
    });
    arrangeGenerated(coreFor([[
      'SEMANTIC_INFORMATION',
      'SEMANTIC_ACTION',
      'SEMANTIC_INFORMATION',
    ]]));
    await expect(evaluateOwnedGeneratedSpfaSessionV2(
      { authenticatedUserId, sessionId: ids.session },
      stackDependencies(semantic),
    )).rejects.toBe(expected);
    expect(semantic.adjudicate).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid semantic receipt without returning a partial aggregate', async () => {
    const semantic = fakeSemanticRuntime(async (input) => ({
      ...receiptFor(input.baseline),
      rawResponse: 'PROVIDER_RAW_SECRET',
    } as unknown as OpenAiSpfaSemanticAdjudicationExecutionReceiptV1));
    arrangeGenerated(coreFor([['SEMANTIC_INFORMATION']]));
    await expect(evaluateOwnedGeneratedSpfaSessionV2(
      { authenticatedUserId, sessionId: ids.session },
      stackDependencies(semantic),
    )).rejects.toMatchObject({
      code: 'invalid_semantic_execution_receipt',
    });
    expect(semantic.adjudicate).toHaveBeenCalledTimes(1);
  });

  it('rejects a materially incompatible final aggregate through the real E1 validator', async () => {
    const core = coreFor([['DETERMINISTIC']]);
    const { result } = await evaluate(core);
    const transcript = createSessionTranscriptSnapshotV2({
      sessionId: ids.session,
      caseVersionId: ids.caseVersion,
      messages: canonicalMessageRows.map((row) => ({
        messageId: row.message_id,
        role: row.message_role,
        content: row.message_content,
        createdAt: row.message_created_at,
      })),
    });
    expect(() => validateSpfaSessionEvaluationV2(
      { ...result, applications: [] } as any,
      { transcript, spfaProtocolSet: core.spfaProtocolSet },
    )).toThrow();
  });

  it('returns only the strict aggregate without protected runtime or provider data', async () => {
    const semantic = fakeSemanticRuntime();
    const { result } = await evaluate(
      coreFor([['SEMANTIC_INFORMATION']]),
      semantic,
      {
        apiKey: 'SYNTHETIC_API_KEY_SHOULD_NOT_PROPAGATE',
        env: { future_secret: true },
      },
    );
    expect(Object.keys(result).sort()).toEqual([
      'applications',
      'caseVersionId',
      'protocolCatalogRef',
      'schemaVersion',
      'semanticExecutions',
      'sessionId',
      'transcriptFingerprint',
    ].sort());
    const serialized = JSON.stringify(result);
    for (const forbidden of [
      'patientFacts',
      'evaluator',
      'sourceOfTruth',
      'core',
      'messages',
      'rawResponse',
      'SYNTHETIC_API_KEY_SHOULD_NOT_PROPAGATE',
      'future_secret',
      'score',
      'feedback',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(result.semanticExecutions.every((execution) =>
      !Object.prototype.hasOwnProperty.call(execution, 'prompt'),
    )).toBe(true);
  });

  it('is deterministic for the same server-owned snapshot, core and fake receipts', async () => {
    const core = coreFor([[
      'DETERMINISTIC',
      'SEMANTIC_INFORMATION_TWO_TARGETS',
      'SEMANTIC_ACTION',
    ]]);
    const first = await evaluate(core, fakeSemanticRuntime());
    const second = await evaluate(core, fakeSemanticRuntime());
    expect(second.result).toEqual(first.result);
  });

  it('preserves the provider response model and canonical prompt version without fallback', async () => {
    const semantic = fakeSemanticRuntime(async (input) =>
      receiptFor(input.baseline, ['SUPPORTED'], 'gpt-5.6-sol-validated-response'),
    );
    const { result } = await evaluate(
      coreFor([['SEMANTIC_INFORMATION']]),
      semantic,
      { model: 'gpt-5.6-terra' },
    );
    expect(result.semanticExecutions).toEqual([
      {
        carePathSpfaRef: ids.initialSpfa,
        requirementRef: requirementId(0),
        provider: 'openai',
        responseModel: 'gpt-5.6-sol-validated-response',
        promptVersion: SPFA_SEMANTIC_ADJUDICATION_PROMPT_VERSION,
      },
    ]);
    expect(JSON.stringify(result)).not.toContain('terra');
  });

  it.each(['active', 'finished'] as const)(
    'evaluates a %s snapshot server-side without inventing finalization policy',
    async (sessionStatus) => {
      const semantic = fakeSemanticRuntime();
      const core = coreFor([['DETERMINISTIC']]);
      arrangeGenerated(core, { rowOverrides: { session_status: sessionStatus } });
      const result = await evaluateOwnedGeneratedSpfaSessionV2(
        { authenticatedUserId, sessionId: ids.session },
        stackDependencies(semantic),
      );
      expect(result.sessionId).toBe(ids.session);
      expect(semantic.adjudicate).not.toHaveBeenCalled();
    },
  );

  it('performs only ownership-constrained SELECT reads and no persistence writes', async () => {
    await evaluate(coreFor([['SEMANTIC_INFORMATION']]));
    expect(queryMock).toHaveBeenCalledTimes(2);
    for (const [sql] of queryMock.mock.calls) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      expect(normalized).toMatch(/^SELECT\b/i);
      expect(normalized).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|MERGE)\b/i);
    }
  });
});
