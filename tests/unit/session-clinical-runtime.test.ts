import { readFileSync } from 'node:fs';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));

vi.mock('@/lib/db', () => ({ pool: { query: queryMock } }));

import {
  attachSpfaProtocolSetToGeneratedCaseCoreV2,
  SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
} from '../../lib/cases/v2/attach-spfa-protocol-set';
import { buildGeneratedCaseBundleV2 } from '../../lib/cases/v2/build-generated-case-bundle';
import type { GenerationProvenanceV2 } from '../../lib/cases/v2/generated-case-bundle-types';
import type { CanonicalGeneratedCaseCoreV2 } from '../../lib/cases/v2/generation-assembly-types';
import {
  resolveSessionEvaluatorClinicalRuntimeV2,
  resolveSessionPatientClinicalRuntimeV2,
  resolveSessionSpfaEvaluationRuntimeV2,
  SessionClinicalRuntimeErrorV2,
} from '../../lib/cases/v2/session-clinical-runtime';
import { validateTeachingCaseGenerationBriefV2 } from '../../lib/cases/v2/validate-teaching-brief';

const sessionId = '10000000-0000-4000-8000-000000000001';
const userId = 41;
const caseId = 7;
const caseVersionId = 'casever_90000000-0000-4000-8000-000000000001';
const factId = 'fact_10000000-0000-4000-8000-000000000001';
const personFactId = 'fact_10000000-0000-4000-8000-000000000002';

function clone<T>(value: T): T {
  return structuredClone(value);
}

function knownFact(id: string, value: string) {
  return {
    state: 'known', factId: id, value, certainty: 'exact',
    disclosure: { mode: 'spontaneous' },
  };
}

function evidenceRule(conclusionRef: string) {
  return {
    conclusionRef,
    requiredEvidence: { operator: 'fact', factRef: factId },
    supportingEvidenceRefs: [], counterEvidenceRefs: [],
    teacherRationale: 'Justificación reservada',
  };
}

function generatedCore(): CanonicalGeneratedCaseCoreV2 {
  const ids = {
    spfa: 'conclusion_40000000-0000-4000-8000-000000000001',
    incidence: 'conclusion_40000000-0000-4000-8000-000000000002',
    prm: 'conclusion_40000000-0000-4000-8000-000000000003',
    rnm: 'conclusion_40000000-0000-4000-8000-000000000004',
    referral: 'conclusion_40000000-0000-4000-8000-000000000005',
  };
  return {
    caseVersionId: caseVersionId as any,
    patientFacts: {
      schemaVersion: '2.0', caseVersionId: caseVersionId as any,
      publicProfile: { nombre: 'María', edad: 68, sexo: 'mujer', tratamiento: 'Enalapril' },
      initialDemand: knownFact(factId, 'Solicita consejo') as any,
      encounter: {
        personPresent: knownFact(personFactId, 'patient') as any,
        relationshipToPatient: { state: 'not_applicable', reasonCode: 'not_applicable_to_patient' },
      },
      clinicalContext: {
        healthProblems: [], clinicalHistory: [], physiologicalSituation: [],
        pregnancyAndLactation: { state: 'not_applicable', reasonCode: 'not_applicable_to_patient' },
        allergiesAndIntolerances: [], lifestyle: [], biomedicalData: [],
      },
      symptoms: [],
      pharmacotherapy: {
        prescribedMedications: [], otherMedicinesAndProducts: [], actualMedicationUse: [],
        recentChanges: [], perceivedEffectiveness: [], perceivedSafety: [],
      },
      actionsAlreadyTaken: [], practicalDifficulties: [], beliefsAndConcerns: [],
      strategiesAlreadyTried: [], dailyAndSocialContext: [], familyAndSocialSupport: [],
      relationshipWithProfessionals: [],
      communicationProfile: {
        sociability: 3, cooperation: 3, organization: 3, emotionalReactivity: 3,
        opennessToChange: 3, healthLiteracy: 'medium', professionalTrust: 3,
        medicationAttitude: 'neutral', decisionStyle: 'shared', readinessToChange: 3,
        socialDesirability: 3, judgmentSensitivity: 3, disclosureThreshold: 3,
        answerLength: 'medium', assertiveness: 3, emotionalExpression: 3,
      } as any,
    },
    evaluator: {
      schemaVersion: '2.0', caseVersionId: caseVersionId as any,
      versions: {
        evaluatorSchema: { id: 'evaluator-v2', version: '2.0' },
        protocol: { id: 'foro-af-fc', version: '2024' },
        prmTaxonomy: { id: 'prm', version: '2024' },
        rnmTaxonomy: { id: 'rnm', version: '2024' },
        adherenceFramework: { id: 'adherence', version: '1' },
      },
      carePath: {
        initialSpfa: { conclusionId: ids.spfa as any, kind: 'spfa', value: { service: 'dispensing', subtype: 'continuation' } },
        additionalSpfas: [], transitions: [],
      },
      incidence: {
        assessment: { conclusionId: ids.incidence as any, kind: 'incidence_assessment', value: { status: 'none' } },
        findings: [], followUpEpisodes: [],
      },
      prm: {
        assessment: { conclusionId: ids.prm as any, kind: 'prm_assessment', value: { status: 'none' } },
        findings: [],
      },
      rnmAssessments: [{ conclusionId: ids.rnm as any, kind: 'rnm_assessment', value: { status: 'no_rnm' } }],
      prmRnmRelations: [],
      adherence: { assessments: [], typeConclusions: [], patientProfiles: [], barrierAssessments: [], barriers: [], strategies: [] },
      professionalActions: [], pharmaceuticalInterventions: [],
      referral: { conclusionId: ids.referral as any, kind: 'referral', value: { status: 'not_required' } },
      evidenceRules: [ids.incidence, ids.prm, ids.rnm, ids.referral].map(evidenceRule) as any,
    },
  };
}

function requiredInitialDemandFactId(core: CanonicalGeneratedCaseCoreV2) {
  const initialDemand = core.patientFacts.initialDemand;
  if (initialDemand.state !== 'known') {
    throw new Error('fixture initialDemand must be known');
  }
  return initialDemand.factId;
}

function integratedGeneratedCore() {
  const core = generatedCore();
  const spfa = core.evaluator.carePath.initialSpfa;
  const protocolId = 'spfa_protocol_50000000-0000-4000-8000-000000000001';
  const requirementId =
    'spfa_requirement_60000000-0000-4000-8000-000000000001';
  const definition = {
    schemaVersion: '2.0', protocolId, version: 'test-1',
    service: 'dispensing', subtype: 'continuation',
    requirements: [{
      kind: 'INFORMATION_REQUIREMENT', requirementId,
      semanticDomain: { kind: 'patient_information', disclosureDomain: 'initial_demand' },
      teacherLabel: 'Demanda inicial', description: 'Comprueba la demanda',
      defaultImportance: 'RELEVANT', informationGoal: 'Conocer la demanda',
      safetyCriticality: { safetyCritical: false }, applicability: { kind: 'ALWAYS' },
    }],
  };
  return attachSpfaProtocolSetToGeneratedCaseCoreV2(core, {
    schemaVersion: '2.0', catalogRef: { ...core.evaluator.versions.protocol },
    definitions: [definition],
    applications: [{
      schemaVersion: '2.0', caseVersionId: core.caseVersionId,
      carePathSpfaRef: spfa.conclusionId,
      protocolRef: { protocolId, version: definition.version },
      requirements: [{
        kind: 'INFORMATION_REQUIREMENT', requirementRef: requirementId,
        applicability: { status: 'APPLICABLE', effectiveImportance: 'RELEVANT' },
        informationTargets: [{
          targetId: 'spfa_target_70000000-0000-4000-8000-000000000001',
          target: { kind: 'FACT', factRef: requiredInitialDemandFactId(core) },
        }],
      }],
    }],
  });
}

function generatedContent() {
  const brief = validateTeachingCaseGenerationBriefV2({
    schemaVersion: '2.0',
    briefId: 'brief_90000000-0000-4000-8000-000000000001',
    revision: { number: 1 }, generationMode: 'strict', complexity: 'low',
    carePath: {
      initialSpfa: { targeting: 'targeted', decision: { mode: 'teacher_fixed', value: { service: 'dispensing', dispensingSubtype: { mode: 'teacher_fixed', value: 'continuation' } } } },
      additionalSpfas: [],
      transitions: { targeting: 'targeted', decision: { mode: 'teacher_fixed', value: [] } },
    },
    incidence: { targeting: 'targeted', decision: { mode: 'teacher_fixed', value: { status: 'none' } } },
    prm: { targeting: 'targeted', decision: { mode: 'teacher_fixed', value: { status: 'none' } } },
    rnm: { targeting: 'targeted', decision: { mode: 'teacher_fixed', value: { status: 'no_rnm' } } },
    adherence: { targeting: 'not_targeted', policy: 'forbidden' },
    adherenceStrategies: { targeting: 'not_targeted', policy: 'forbidden' },
    professionalActions: { targeting: 'not_targeted', policy: 'forbidden' },
    pharmaceuticalInterventions: { targeting: 'not_targeted', policy: 'forbidden' },
    referral: { targeting: 'targeted', decision: { mode: 'teacher_fixed', value: { status: 'not_required' } } },
  });
  const provenance: GenerationProvenanceV2 = {
    generatorContractVersion: 'ai-generated-case-draft/1', promptVersion: 'case-generator/1',
    model: { provider: 'openai', identifier: 'synthetic-model' },
    assemblerVersion: 'generation-assembly/1', disclosurePolicyVersion: 'disclosure-policy/1',
    spfaIntegrationVersion: SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
  };
  return buildGeneratedCaseBundleV2(brief, integratedGeneratedCore(), provenance);
}

function legacyContent() {
  return {
    snapshotBasis: 'migration_time_current_row', legacyCaseId: caseId,
    legacyStatus: 'approved', serviceType: 'SAT',
    spec: {
      nombre: 'Ana', edad: 54, sexo: 'mujer', tratamiento: 'Metformina',
      motivo_consulta: 'Consulta', future_secret: 'no proyectar',
    },
    groundTruth: {
      personalidad_paciente: 'Prudente', diagnostico_principal: 'Diagnóstico',
      tipo_no_adherencia: 'Intencional', barrera_principal: 'Temor',
      intervenciones_validas: ['Acordar'], future_secret: 'no proyectar',
    },
  };
}

function legacyRow(overrides: Record<string, unknown> = {}) {
  return {
    session_id: sessionId,
    session_user_id: String(userId),
    session_case_id: String(caseId),
    session_case_version_id: caseVersionId,
    session_status: 'active',
    version_id: caseVersionId,
    version_case_id: String(caseId),
    version_status: 'PUBLISHED',
    version_source_kind: 'LEGACY_V1',
    version_legacy_status: 'approved',
    version_content_format: 'LEGACY_V1_SNAPSHOT',
    version_content: legacyContent(),
    ...overrides,
  };
}

function generatedRow(overrides: Record<string, unknown> = {}) {
  return {
    ...legacyRow(),
    version_source_kind: 'AI_GENERATED',
    version_legacy_status: null,
    version_content_format: 'GENERATED_CASE_BUNDLE_V2',
    version_content: generatedContent(),
    ...overrides,
  };
}

function returnRows(...rows: unknown[]) {
  queryMock.mockResolvedValueOnce({ rows });
}

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    message_id: '1',
    message_role: 'student',
    message_content: 'Mensaje persistido sintético',
    message_created_at: '2026-08-25T09:00:00Z',
    ...overrides,
  };
}

function returnMessageRows(...rows: unknown[]) {
  queryMock.mockResolvedValueOnce({ rows });
}

async function expectRuntimeError(
  promise: Promise<unknown>,
  code: string,
): Promise<SessionClinicalRuntimeErrorV2> {
  try {
    await promise;
    throw new Error('expected runtime resolution to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(SessionClinicalRuntimeErrorV2);
    expect((error as SessionClinicalRuntimeErrorV2).code).toBe(code);
    expect(error).not.toHaveProperty('content');
    return error as SessionClinicalRuntimeErrorV2;
  }
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('session-bound clinical query and input boundary', () => {
  it.each([
    [{ authenticatedUserId: 0, sessionId }],
    [{ authenticatedUserId: 1.5, sessionId }],
    [{ authenticatedUserId: Number.MAX_SAFE_INTEGER + 1, sessionId }],
  ])('rejects an invalid authenticatedUserId before querying', async (input) => {
    await expectRuntimeError(resolveSessionPatientClinicalRuntimeV2(input), 'invalid_input');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it.each(['not-a-uuid', '10000000-0000-0000-0000-000000000001'])
    ('rejects invalid sessionId %s before querying', async (invalidSessionId) => {
      await expectRuntimeError(
        resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId: invalidSessionId }),
        'invalid_input',
      );
      expect(queryMock).not.toHaveBeenCalled();
    });

  it('maps zero rows to the ownership-safe not-found code', async () => {
    returnRows();
    await expectRuntimeError(
      resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'session_not_found_or_forbidden',
    );
  });

  it('uses one ownership-constrained SELECT joining only sessions and case_versions', async () => {
    returnRows(legacyRow());
    await resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId });
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [sql, params] = queryMock.mock.calls[0];
    const normalized = String(sql).replace(/\s+/g, ' ').trim();
    expect(normalized).toContain('FROM public.sessions AS s');
    expect(normalized).toContain('INNER JOIN public.case_versions AS cv');
    expect(normalized).toContain('cv.id = s.case_version_id');
    expect(normalized).toContain('cv.case_id = s.case_id');
    expect(normalized).toContain('s.id = $1');
    expect(normalized).toContain('s.user_id = $2');
    expect(normalized).not.toContain('public.cases');
    expect(params).toEqual([sessionId, userId]);
  });

  it('propagates unexpected DB infrastructure errors unchanged', async () => {
    const infrastructureError = new Error('synthetic database failure');
    queryMock.mockRejectedValueOnce(infrastructureError);
    await expect(
      resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
    ).rejects.toBe(infrastructureError);
  });
});

describe('patient and evaluator capabilities', () => {
  it('resolves a valid active Legacy patient capability without raw metadata', async () => {
    returnRows(legacyRow());
    const result = await resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId });
    expect(result).toEqual({
      sessionId, caseId, caseVersionId,
      clinicalContent: {
        contentFormat: 'LEGACY_V1_SNAPSHOT',
        patientData: {
          nombre: 'Ana', edad: 54, sexo: 'mujer', tratamiento: 'Metformina',
          motivo_consulta: 'Consulta', personalidad_paciente: 'Prudente',
        },
        serviceContext: { serviceType: 'SAT' },
      },
    });
    expect(JSON.stringify(result)).not.toMatch(/version_content|sourceKind|legacyStatus|future_secret/);
  });

  it('resolves a valid active Generated patient capability through B1', async () => {
    returnRows(generatedRow());
    const result = await resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId });
    expect(result.caseVersionId).toBe(caseVersionId);
    expect(result.clinicalContent.contentFormat).toBe('GENERATED_CASE_BUNDLE_V2');
    expect(JSON.stringify(result)).not.toMatch(/sourceOfTruth|provenance|teachingSummary|complianceReport/);
  });

  it('resolves a valid Legacy evaluator without patient or row data', async () => {
    returnRows(legacyRow());
    const result = await resolveSessionEvaluatorClinicalRuntimeV2({ authenticatedUserId: userId, sessionId });
    expect(result.sessionStatus).toBe('active');
    expect(result.clinicalContent).toMatchObject({
      contentFormat: 'LEGACY_V1_SNAPSHOT',
      evaluator: { diagnostico_principal: 'Diagnóstico', intervenciones_validas: ['Acordar'] },
    });
    expect(JSON.stringify(result)).not.toMatch(/version_content|patientData|future_secret/);
  });

  it('resolves a valid Generated evaluator through B1', async () => {
    returnRows(generatedRow());
    const result = await resolveSessionEvaluatorClinicalRuntimeV2({ authenticatedUserId: userId, sessionId });
    expect(result.clinicalContent.contentFormat).toBe('GENERATED_CASE_BUNDLE_V2');
    expect(JSON.stringify(result)).not.toMatch(/patientFacts|patientRuntime|provenance|teachingSummary|complianceReport/);
  });

  it('rejects a finished patient session before resolving content', async () => {
    returnRows(legacyRow({ session_status: 'finished', version_content: null }));
    await expectRuntimeError(
      resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'session_not_active',
    );
  });

  it.each(['active', 'finished'] as const)
    ('allows evaluator hydration for a %s session', async (sessionStatus) => {
      returnRows(legacyRow({ session_status: sessionStatus }));
      const result = await resolveSessionEvaluatorClinicalRuntimeV2({ authenticatedUserId: userId, sessionId });
      expect(result.sessionStatus).toBe(sessionStatus);
    });
});

describe('case-version state and immutable pinning', () => {
  it.each(['PUBLISHED', 'ARCHIVED'] as const)
    ('accepts %s for an existing session', async (versionStatus) => {
      returnRows(legacyRow({ version_status: versionStatus }));
      const result = await resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId });
      expect(result.caseVersionId).toBe(caseVersionId);
    });

  it.each(['AI_DRAFT', 'TEACHER_DRAFT', 'IN_REVIEW', 'VALIDATED', 'UNKNOWN'])
    ('rejects version status %s', async (versionStatus) => {
      returnRows(legacyRow({ version_status: versionStatus }));
      await expectRuntimeError(
        resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
        'invalid_case_version_status',
      );
    });

  it('keeps an ARCHIVED V1 pinned without looking up a current V2', async () => {
    returnRows(legacyRow({ version_status: 'ARCHIVED' }));
    const result = await resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(result.caseVersionId).toBe(caseVersionId);
    expect(result.clinicalContent.contentFormat).toBe('LEGACY_V1_SNAPSHOT');
    const sql = String(queryMock.mock.calls[0][0]);
    expect(sql).not.toMatch(/WHERE\s+cv\.status\s*=\s*'PUBLISHED'/i);
    expect(sql).not.toMatch(/ORDER\s+BY|LIMIT\s+1/i);
  });
});

describe('defensive session anchor validation', () => {
  it.each([
    ['session_id mismatch', { session_id: '10000000-0000-4000-8000-000000000002' }],
    ['session_user_id mismatch', { session_user_id: String(userId + 1) }],
    ['malformed session_case_id', { session_case_id: '7.0' }],
    ['unsafe session_case_id', { session_case_id: String(Number.MAX_SAFE_INTEGER + 1) }],
    ['case IDs mismatch', { version_case_id: '8' }],
    ['invalid session version ID', { session_case_version_id: 'semantic-id' }],
    ['invalid version ID', { version_id: 'semantic-id' }],
    ['version IDs mismatch', { version_id: 'casever_90000000-0000-4000-8000-000000000002' }],
    ['invalid session status', { session_status: 'paused' }],
  ])('rejects %s', async (_label, overrides) => {
    returnRows(legacyRow(overrides));
    await expectRuntimeError(
      resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'invalid_session_anchor',
    );
  });

  it('fails closed if the DB adapter returns duplicate rows', async () => {
    returnRows(legacyRow(), legacyRow());
    await expectRuntimeError(
      resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'invalid_session_anchor',
    );
  });
});

describe('B1 error mapping', () => {
  it('maps a Legacy content error without exposing clinical values', async () => {
    const content = legacyContent() as any;
    content.serviceType = null;
    returnRows(legacyRow({ version_content: content }));
    const error = await expectRuntimeError(
      resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'invalid_case_version_content',
    );
    expect(error.message).not.toContain('Diagnóstico');
  });

  it('maps Generated patient-runtime drift to the stable B2 code', async () => {
    const content = clone(generatedContent()) as any;
    content.derived.patientRuntime.future_secret = 'hidden';
    returnRows(generatedRow({ version_content: content }));
    await expectRuntimeError(
      resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'patient_runtime_validation_failed',
    );
  });

  it('maps Generated evaluator validation failures to the stable B2 code', async () => {
    const content = clone(generatedContent()) as any;
    content.sourceOfTruth.evaluator.evidenceRules[0].requiredEvidence.factRef =
      'fact_10000000-0000-4000-8000-000000000099';
    returnRows(generatedRow({ version_content: content }));
    await expectRuntimeError(
      resolveSessionEvaluatorClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'evaluator_runtime_validation_failed',
    );
  });

  it('preserves unsupported format and source mismatch codes from B1', async () => {
    returnRows(legacyRow({ version_content_format: 'FUTURE_FORMAT' }));
    await expectRuntimeError(
      resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'unsupported_content_format',
    );
    returnRows(generatedRow({ version_source_kind: 'LEGACY_V1' }));
    await expectRuntimeError(
      resolveSessionPatientClinicalRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'source_format_mismatch',
    );
  });
});

describe('Generated SPFA session evaluation runtime', () => {
  function arrangeGeneratedMessages(...rows: unknown[]) {
    returnRows(generatedRow());
    returnMessageRows(...rows);
  }

  it('returns exactly the pinned identity, status, core and transcript', async () => {
    arrangeGeneratedMessages(messageRow());
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(Object.keys(result).sort()).toEqual([
      'caseId',
      'caseVersionId',
      'core',
      'sessionId',
      'sessionStatus',
      'transcript',
    ]);
    expect(result).toMatchObject({
      sessionId,
      caseId,
      caseVersionId,
      sessionStatus: 'active',
    });
    expect(result.core.caseVersionId).toBe(caseVersionId);
    expect(result.transcript.caseVersionId).toBe(caseVersionId);
  });

  it('preserves the complete validated core server-side', async () => {
    arrangeGeneratedMessages();
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(result.core.patientFacts.publicProfile.nombre).toBe('María');
    expect(result.core.evaluator.carePath.initialSpfa.value.service).toBe('dispensing');
    expect(result.core.spfaProtocolSet.applications).toHaveLength(1);
  });

  it('does not return raw bundle, DB rows, prompts, config, score or results', async () => {
    arrangeGeneratedMessages(messageRow());
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    const keys = JSON.stringify(result);
    for (const forbidden of [
      'version_content',
      'sourceOfTruth',
      'derived',
      'provenance',
      'prompt',
      'apiKey',
      'openaiConfig',
      'score',
      'semanticExecutions',
    ]) {
      expect(keys).not.toContain(forbidden);
    }
  });

  it('uses separate ownership-constrained anchor and message reads', async () => {
    arrangeGeneratedMessages(messageRow());
    await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(queryMock).toHaveBeenCalledTimes(2);
    const [messageSql, messageParams] = queryMock.mock.calls[1];
    const normalized = String(messageSql).replace(/\s+/g, ' ').trim();
    expect(normalized).toContain('FROM public.messages AS m');
    expect(normalized).toContain('INNER JOIN public.sessions AS s');
    expect(normalized).toContain('WHERE m.session_id = $1 AND s.user_id = $2');
    expect(normalized).toContain('ORDER BY m.created_at ASC, m.id ASC');
    expect(normalized).toContain('m.id::text AS message_id');
    expect(messageParams).toEqual([sessionId, userId]);
  });

  it('ignores client-supplied clinical identities and uses only the session anchor', async () => {
    arrangeGeneratedMessages(messageRow());
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
      caseVersionId: 'casever_90000000-0000-4000-8000-000000000099',
      transcript: { messages: [{ role: 'system', content: 'untrusted' }] },
      core: { future_secret: true },
    } as any);
    expect(result.caseVersionId).toBe(caseVersionId);
    expect(result.transcript.messages).toHaveLength(1);
    expect(result.transcript.messages[0].role).toBe('student');
    expect(JSON.stringify(result)).not.toContain('future_secret');
  });

  it('maps nonexistent and foreign sessions to the same ownership-safe error', async () => {
    returnRows();
    const missing = await expectRuntimeError(
      resolveSessionSpfaEvaluationRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'session_not_found_or_forbidden',
    );
    returnRows();
    const foreign = await expectRuntimeError(
      resolveSessionSpfaEvaluationRuntimeV2({
        authenticatedUserId: userId + 1,
        sessionId,
      }),
      'session_not_found_or_forbidden',
    );
    expect(foreign.message).toBe(missing.message);
    expect(queryMock).toHaveBeenCalledTimes(2);
  });

  it('rejects Legacy without reading messages or fabricating SPFA', async () => {
    returnRows(legacyRow());
    await expectRuntimeError(
      resolveSessionSpfaEvaluationRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'spfa_evaluation_not_available',
    );
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid Generated bundle before reading messages', async () => {
    const row = generatedRow();
    const content = clone(row.version_content) as any;
    content.sourceOfTruth.spfaProtocolSet.catalogRef.id = 'wrong-catalog';
    returnRows({ ...row, version_content: content });
    await expectRuntimeError(
      resolveSessionSpfaEvaluationRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'spfa_runtime_validation_failed',
    );
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('allows finished status as read-only metadata without deciding finalization policy', async () => {
    returnRows(generatedRow({ session_status: 'finished' }));
    returnMessageRows();
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(result.sessionStatus).toBe('finished');
  });

  it('preserves an empty transcript because D1 permits messages: []', async () => {
    arrangeGeneratedMessages();
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(result.transcript.messages).toEqual([]);
    expect(result.transcript.fingerprint.value).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts student and patient rows and canonicalizes their timestamps', async () => {
    arrangeGeneratedMessages(
      messageRow({
        message_id: '2',
        message_role: 'patient',
        message_content: 'Respuesta persistida',
        message_created_at: new Date('2026-08-25T10:00:00+01:00'),
      }),
      messageRow(),
    );
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(result.transcript.messages.map((message) => [
      message.messageId,
      message.role,
      message.createdAt,
    ])).toEqual([
      ['1', 'student', '2026-08-25T09:00:00.000Z'],
      ['2', 'patient', '2026-08-25T09:00:00.000Z'],
    ]);
  });

  it('orders messages by canonical instant before numeric message ID', async () => {
    arrangeGeneratedMessages(
      messageRow({ message_id: '10', message_created_at: '2026-08-25T09:00:01Z' }),
      messageRow({ message_id: '9', message_created_at: '2026-08-25T09:00:00Z' }),
    );
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(result.transcript.messages.map((message) => message.messageId))
      .toEqual(['9', '10']);
  });

  it('breaks timestamp ties using numeric bigint order rather than lexical order', async () => {
    arrangeGeneratedMessages(
      messageRow({ message_id: '10' }),
      messageRow({ message_id: '2' }),
    );
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(result.transcript.messages.map((message) => message.messageId))
      .toEqual(['2', '10']);
  });

  it('preserves a PostgreSQL bigint ID without passing through Number', async () => {
    arrangeGeneratedMessages(messageRow({ message_id: '9223372036854775807' }));
    const result = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(result.transcript.messages[0].messageId).toBe('9223372036854775807');
  });

  it.each(['0', '-1', '01', '1.0', '9223372036854775808'])
    ('rejects invalid canonical message ID %s', async (messageId) => {
      arrangeGeneratedMessages(messageRow({ message_id: messageId }));
      await expectRuntimeError(
        resolveSessionSpfaEvaluationRuntimeV2({ authenticatedUserId: userId, sessionId }),
        'invalid_session_transcript',
      );
    });

  it.each(['system', 'teacher', 'tool', 'metadata'])
    ('rejects unexpected persisted role %s instead of ignoring it', async (role) => {
      arrangeGeneratedMessages(messageRow({ message_role: role }));
      await expectRuntimeError(
        resolveSessionSpfaEvaluationRuntimeV2({ authenticatedUserId: userId, sessionId }),
        'invalid_session_transcript',
      );
    });

  it.each([
    '2026-08-25T09:00:00',
    '2026-08-25',
    '2026-02-30T09:00:00Z',
  ])('rejects invalid or timezone-less persisted timestamp %s', async (createdAt) => {
    arrangeGeneratedMessages(messageRow({ message_created_at: createdAt }));
    await expectRuntimeError(
      resolveSessionSpfaEvaluationRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'invalid_session_transcript',
    );
  });

  it('rejects an invalid Date returned by the DB adapter', async () => {
    arrangeGeneratedMessages(messageRow({ message_created_at: new Date(Number.NaN) }));
    await expectRuntimeError(
      resolveSessionSpfaEvaluationRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'invalid_session_transcript',
    );
  });

  it('rejects non-string message content', async () => {
    arrangeGeneratedMessages(messageRow({ message_content: { protected: true } }));
    await expectRuntimeError(
      resolveSessionSpfaEvaluationRuntimeV2({ authenticatedUserId: userId, sessionId }),
      'invalid_session_transcript',
    );
  });

  it('produces a stable fingerprint for the same rows regardless of input order', async () => {
    const firstRows = [
      messageRow({ message_id: '2', message_role: 'patient' }),
      messageRow({ message_id: '1' }),
    ];
    arrangeGeneratedMessages(...firstRows);
    const first = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    arrangeGeneratedMessages(...firstRows.toReversed());
    const second = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(second.transcript).toEqual(first.transcript);
  });

  it('changes the fingerprint when persisted content changes', async () => {
    arrangeGeneratedMessages(messageRow({ message_content: 'Primero' }));
    const first = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    arrangeGeneratedMessages(messageRow({ message_content: 'Segundo' }));
    const second = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(second.transcript.fingerprint.value)
      .not.toBe(first.transcript.fingerprint.value);
  });

  it('changes the fingerprint when the effective message order changes', async () => {
    const rows = [
      messageRow({ message_id: '1', message_content: 'Primero' }),
      messageRow({ message_id: '2', message_content: 'Segundo' }),
    ];
    arrangeGeneratedMessages(...rows);
    const first = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    arrangeGeneratedMessages(
      { ...rows[0], message_created_at: '2026-08-25T09:00:01Z' },
      { ...rows[1], message_created_at: '2026-08-25T09:00:00Z' },
    );
    const second = await resolveSessionSpfaEvaluationRuntimeV2({
      authenticatedUserId: userId,
      sessionId,
    });
    expect(second.transcript.messages.map((message) => message.content))
      .toEqual(['Segundo', 'Primero']);
    expect(second.transcript.fingerprint.value)
      .not.toBe(first.transcript.fingerprint.value);
  });
});

describe('architecture guards', () => {
  it('is a read-only session/version boundary without forbidden dependencies or switching', () => {
    const source = readFileSync('lib/cases/v2/session-clinical-runtime.ts', 'utf8');
    expect(source).not.toMatch(/next\/server|@\/lib\/openai|\bOpenAI\b|fetch\s*\(|process\.env/);
    expect(source).not.toMatch(/public\.cases|cases\.spec|cases\.ground_truth/i);
    expect(source).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK)\b/i);
    expect(source).not.toMatch(/current\s+PUBLISHED/i);
  });
});
