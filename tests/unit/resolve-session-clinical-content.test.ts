import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  attachSpfaProtocolSetToGeneratedCaseCoreV2,
  SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
} from '../../lib/cases/v2/attach-spfa-protocol-set';
import { buildGeneratedCaseBundleV2 } from '../../lib/cases/v2/build-generated-case-bundle';
import type { GenerationProvenanceV2 } from '../../lib/cases/v2/generated-case-bundle-types';
import type { CanonicalGeneratedCaseCoreV2 } from '../../lib/cases/v2/generation-assembly-types';
import { createPatientRuntimeViewV2 } from '../../lib/cases/v2/patient-runtime';
import {
  resolveSessionEvaluatorClinicalContentV2,
  resolveSessionPatientClinicalContentV2,
  resolveSessionSpfaClinicalContentV2,
} from '../../lib/cases/v2/resolve-session-clinical-content';
import { SessionClinicalContentErrorV2 } from '../../lib/cases/v2/session-clinical-content-types';
import { validateTeachingCaseGenerationBriefV2 } from '../../lib/cases/v2/validate-teaching-brief';

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
    teacherRationale: 'Justificación docente reservada',
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

function generatedBrief() {
  return validateTeachingCaseGenerationBriefV2({
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
}

function generatedInput() {
  const provenance: GenerationProvenanceV2 = {
    generatorContractVersion: 'ai-generated-case-draft/1', promptVersion: 'case-generator/1',
    model: { provider: 'openai', identifier: 'synthetic-model' },
    assemblerVersion: 'generation-assembly/1', disclosurePolicyVersion: 'disclosure-policy/1',
    spfaIntegrationVersion: SPFA_PROTOCOL_SET_INTEGRATION_VERSION,
  };
  const content: any = buildGeneratedCaseBundleV2(
    generatedBrief(), integratedGeneratedCore(), provenance,
  );
  Object.assign(content, {
    future_secret: 'never project',
    hiddenFacts: { secret: true },
    groundTruth: { answer: 'hidden' },
    teacher_solution: 'hidden',
    internal_notes: 'hidden',
  });
  return {
    caseId: 7, caseVersionId, sourceKind: 'AI_GENERATED', legacyStatus: null,
    contentFormat: 'GENERATED_CASE_BUNDLE_V2',
    content,
  };
}

function legacyInput() {
  return {
    caseId: 7, caseVersionId, sourceKind: 'LEGACY_V1', legacyStatus: 'approved',
    contentFormat: 'LEGACY_V1_SNAPSHOT',
    content: {
      snapshotBasis: 'migration_time_current_row', legacyCaseId: 7, legacyStatus: 'approved',
      serviceType: 'SAT',
      spec: {
        nombre: 'Ana', edad: '54', sexo: 'mujer', tratamiento: 'Metformina',
        motivo_consulta: 'Consulta', antecedentes: 'HTA', contexto: 'Vive sola',
        descripcion_paciente: 'Reservada', future_secret: 'no copiar',
      },
      groundTruth: {
        personalidad_paciente: 'Prudente', diagnostico_principal: 'Diagnóstico',
        problema_farmacoterapeutico: 'PRM', tipo_no_adherencia: 'Intencional',
        barrera_principal: 'Temor', otras_barreras: ['Olvidos'],
        intervenciones_recomendadas: ['Educar'], intervenciones_validas: ['Acordar'],
        objetivos_aprendizaje: ['Explorar'], rubric: 'no copiar', future_secret: 'no copiar',
        hiddenFacts: ['no copiar'], teacher_solution: 'no copiar', internal_notes: 'no copiar',
      },
    },
  };
}

function expectCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error('expected failure');
  } catch (error) {
    expect(error).toBeInstanceOf(SessionClinicalContentErrorV2);
    expect((error as SessionClinicalContentErrorV2).code).toBe(code);
    expect(error).not.toHaveProperty('content');
    return error as SessionClinicalContentErrorV2;
  }
}

describe('legacy session clinical content', () => {
  it('projects the patient allowlist and literal legacy service context', () => {
    const result = resolveSessionPatientClinicalContentV2(legacyInput());
    expect(result).toEqual({
      contentFormat: 'LEGACY_V1_SNAPSHOT',
      patientData: {
        nombre: 'Ana', edad: 54, sexo: 'mujer', tratamiento: 'Metformina',
        motivo_consulta: 'Consulta', antecedentes: 'HTA', contexto: 'Vive sola',
        descripcion_paciente: 'Reservada', personalidad_paciente: 'Prudente',
      },
      serviceContext: { serviceType: 'SAT' },
    });
    if (result.contentFormat !== 'LEGACY_V1_SNAPSHOT') return;
    expect(result.serviceContext.serviceType).not.toBe('medication_adherence');
    expect(JSON.stringify(result)).not.toMatch(/diagnostico|rubric|future_secret/);
  });

  it('projects evaluator fields without merging recommended and valid interventions', () => {
    const result = resolveSessionEvaluatorClinicalContentV2(legacyInput());
    expect(result.evaluator).toMatchObject({
      intervenciones_recomendadas: ['Educar'], intervenciones_validas: ['Acordar'],
    });
    expect(result.evaluator).not.toHaveProperty('personalidad_paciente');
    expect(JSON.stringify(result)).not.toMatch(/rubric|future_secret/);
  });

  it('keeps absent optional fields absent rather than inventing negatives', () => {
    const input = legacyInput();
    input.content.spec = { nombre: 'Ana', edad: 54, sexo: 'mujer', tratamiento: 'Metformina' } as any;
    input.content.groundTruth = {} as any;
    const patient = resolveSessionPatientClinicalContentV2(input);
    const evaluator = resolveSessionEvaluatorClinicalContentV2(input);
    if (patient.contentFormat !== 'LEGACY_V1_SNAPSHOT') return;
    expect(Object.keys(patient.patientData).sort()).toEqual(['edad', 'nombre', 'sexo', 'tratamiento']);
    expect(evaluator.evaluator).toEqual({});
  });

  it('rejects malformed optional arrays instead of coercing them', () => {
    const input = legacyInput();
    input.content.groundTruth.otras_barreras = 'Olvidos' as any;
    expectCode(() => resolveSessionEvaluatorClinicalContentV2(input), 'invalid_case_version_content');
  });

  it.each([
    ['snapshotBasis', 'other', 'invalid_case_version_content'],
    ['legacyCaseId', 8, 'case_version_identity_mismatch'],
    ['legacyStatus', 'rejected', 'case_version_identity_mismatch'],
  ])('rejects invalid legacy %s', (field, value, code) => {
    const input = legacyInput() as any;
    input.content[field] = value;
    expectCode(() => resolveSessionPatientClinicalContentV2(input), code);
  });
});

describe('generated session clinical content', () => {
  it('returns canonical patient runtime plus a service-only care path projection', () => {
    const result = resolveSessionPatientClinicalContentV2(generatedInput());
    expect(result.contentFormat).toBe('GENERATED_CASE_BUNDLE_V2');
    if (result.contentFormat !== 'GENERATED_CASE_BUNDLE_V2') return;
    expect(result.patientRuntime.publicProfile.nombre).toBe('María');
    expect(result.serviceContext).toEqual({
      initialSpfa: { service: 'dispensing', subtype: 'continuation' }, additionalSpfas: [],
    });
    expect(JSON.stringify(result.serviceContext)).not.toMatch(/conclusion|transition|prm|rnm|evidence|referral/);
    expect(JSON.stringify(result)).not.toMatch(/sourceOfTruth|teachingSummary|complianceReport|provenance|teacherRationale/);
  });

  it('returns only the validated evaluator capability', () => {
    const result = resolveSessionEvaluatorClinicalContentV2(generatedInput());
    expect(result.contentFormat).toBe('GENERATED_CASE_BUNDLE_V2');
    if (result.contentFormat !== 'GENERATED_CASE_BUNDLE_V2') return;
    expect(result.evaluator.carePath.initialSpfa.value.service).toBe('dispensing');
    expect(result).not.toHaveProperty('patientRuntime');
    expect(JSON.stringify(result)).not.toMatch(/sourceBrief|teachingSummary|complianceReport|provenance/);
  });

  it.each([
    ['sourceOfTruth.caseVersionId'],
    ['sourceOfTruth.patientFacts.caseVersionId'],
    ['sourceOfTruth.evaluator.caseVersionId'],
    ['derived.patientRuntime.caseVersionId'],
    ['derived.teachingSummary.caseVersionId'],
    ['derived.complianceReport.caseVersionId'],
  ])('rejects identity drift at %s', (path) => {
    const input = generatedInput() as any;
    const parts = path.split('.');
    let target = input.content;
    for (const part of parts.slice(0, -1)) target = target[part];
    target[parts.at(-1)!] = 'casever_90000000-0000-4000-8000-000000000099';
    expectCode(() => resolveSessionPatientClinicalContentV2(input), 'case_version_identity_mismatch');
  });

  it.each([
    ['added key', (runtime: any) => { runtime.future_secret = 'secret'; }],
    ['removed key', (runtime: any) => { delete runtime.initialDemand; }],
    ['changed value', (runtime: any) => { runtime.publicProfile.nombre = 'Otra'; }],
    ['changed array', (runtime: any) => { runtime.actionsAlreadyTaken.push(knownFact('fact_10000000-0000-4000-8000-000000000099', 'x')); }],
  ])('rejects material patient-runtime drift: %s', (_label, mutate) => {
    const input = clone(generatedInput()) as any;
    mutate(input.content.derived.patientRuntime);
    expectCode(() => resolveSessionPatientClinicalContentV2(input), 'patient_runtime_validation_failed');
  });

  it('rejects an altered disclosure rule in persisted patient runtime', () => {
    const input = clone(generatedInput()) as any;
    input.content.derived.patientRuntime.initialDemand.disclosure = {
      mode: 'open_question',
    };
    expectCode(
      () => resolveSessionPatientClinicalContentV2(input),
      'patient_runtime_validation_failed',
    );
  });

  it('preserves patient_unknown and explicit_absence without deriving negatives', () => {
    const input = clone(generatedInput()) as any;
    input.content.sourceOfTruth.patientFacts.clinicalContext.healthProblems = [
      {
        state: 'patient_unknown',
        factId: 'fact_10000000-0000-4000-8000-000000000003',
        topic: 'diagnóstico de una dolencia previa',
        disclosure: { mode: 'open_question' },
      },
      {
        state: 'explicit_absence',
        factId: 'fact_10000000-0000-4000-8000-000000000004',
        topic: 'otros problemas de salud conocidos',
        disclosure: { mode: 'open_question' },
      },
    ];
    input.content.derived.patientRuntime = createPatientRuntimeViewV2(
      input.content.sourceOfTruth.patientFacts,
    );
    const result = resolveSessionPatientClinicalContentV2(input);
    if (result.contentFormat !== 'GENERATED_CASE_BUNDLE_V2') return;
    expect(result.patientRuntime.clinicalContext.healthProblems.map((datum) => datum.state))
      .toEqual(['patient_unknown', 'explicit_absence']);
    expect(result.patientRuntime.clinicalContext.healthProblems[0]).toMatchObject({
      topic: 'diagnóstico de una dolencia previa',
    });
  });

  it('accepts different object-key order in the persisted runtime', () => {
    const input = clone(generatedInput()) as any;
    input.content.derived.patientRuntime = Object.fromEntries(
      Object.entries(input.content.derived.patientRuntime).reverse(),
    );
    expect(resolveSessionPatientClinicalContentV2(input).contentFormat).toBe('GENERATED_CASE_BUNDLE_V2');
  });

  it('rejects invalid patient facts with a stable non-clinical error', () => {
    const input = clone(generatedInput()) as any;
    input.content.sourceOfTruth.patientFacts.initialDemand = { state: 'not_defined', secret: 'clinical value' };
    const error = expectCode(() => resolveSessionPatientClinicalContentV2(input), 'patient_runtime_validation_failed');
    expect(error.message).not.toContain('clinical value');
  });

  it('rejects evaluator invalid against the canonical patient runtime', () => {
    const input = clone(generatedInput()) as any;
    input.content.sourceOfTruth.evaluator.evidenceRules[0].requiredEvidence.factRef =
      'fact_10000000-0000-4000-8000-000000000099';
    expectCode(() => resolveSessionEvaluatorClinicalContentV2(input), 'evaluator_runtime_validation_failed');
  });

  it('does not propagate contamination in patient facts or evaluator', () => {
    const input = clone(generatedInput()) as any;
    input.content.sourceOfTruth.patientFacts.future_secret = 'patient secret';
    input.content.sourceOfTruth.evaluator.future_secret = 'teacher secret';
    const patient = resolveSessionPatientClinicalContentV2(input);
    const evaluator = resolveSessionEvaluatorClinicalContentV2(input);
    expect(JSON.stringify(patient)).not.toContain('future_secret');
    expect(JSON.stringify(evaluator)).not.toContain('future_secret');
  });

  it('rejects a generated bundle labeled with the legacy source kind', () => {
    const input = { ...generatedInput(), sourceKind: 'LEGACY_V1' };

    expectCode(
      () => resolveSessionPatientClinicalContentV2(input),
      'source_format_mismatch',
    );
  });
});

describe('generated SPFA clinical core capability', () => {
  it('reconstructs the complete validated server-only SPFA core', () => {
    const result = resolveSessionSpfaClinicalContentV2(generatedInput());
    expect(Object.keys(result).sort()).toEqual([
      'caseVersionId',
      'evaluator',
      'patientFacts',
      'spfaProtocolSet',
    ]);
    expect(result.caseVersionId).toBe(caseVersionId);
    expect(result.patientFacts.publicProfile.nombre).toBe('María');
    expect(result.evaluator.carePath.initialSpfa.value).toEqual({
      service: 'dispensing',
      subtype: 'continuation',
    });
    expect(result.spfaProtocolSet.applications).toHaveLength(1);
  });

  it('does not return the raw bundle or its derived/provenance sections', () => {
    const result = resolveSessionSpfaClinicalContentV2(generatedInput());
    expect(result).not.toHaveProperty('sourceOfTruth');
    expect(result).not.toHaveProperty('derived');
    expect(result).not.toHaveProperty('provenance');
    expect(result).not.toHaveProperty('sourceBrief');
    expect(JSON.stringify(result)).not.toContain('never project');
  });

  it('rejects Legacy without fabricating an SPFA protocol capability', () => {
    expectCode(
      () => resolveSessionSpfaClinicalContentV2(legacyInput()),
      'spfa_evaluation_not_available',
    );
  });

  it('rejects a missing SPFA protocol set fail-closed', () => {
    const input = clone(generatedInput()) as any;
    delete input.content.sourceOfTruth.spfaProtocolSet;
    expectCode(
      () => resolveSessionSpfaClinicalContentV2(input),
      'invalid_case_version_content',
    );
  });

  it('rejects an invalid SPFA protocol set fail-closed', () => {
    const input = clone(generatedInput()) as any;
    input.content.sourceOfTruth.spfaProtocolSet.catalogRef.id = 'wrong-catalog';
    expectCode(
      () => resolveSessionSpfaClinicalContentV2(input),
      'spfa_runtime_validation_failed',
    );
  });

  it('rejects case-version drift before returning a core', () => {
    const input = clone(generatedInput()) as any;
    input.content.sourceOfTruth.spfaProtocolSet.applications[0].caseVersionId =
      'casever_90000000-0000-4000-8000-000000000099';
    expectCode(
      () => resolveSessionSpfaClinicalContentV2(input),
      'spfa_runtime_validation_failed',
    );
  });

  it('rejects invalid patient facts before returning a core', () => {
    const input = clone(generatedInput()) as any;
    input.content.sourceOfTruth.patientFacts.initialDemand = {
      state: 'not_defined',
    };
    expectCode(
      () => resolveSessionSpfaClinicalContentV2(input),
      'patient_runtime_validation_failed',
    );
  });

  it('rejects a source/format mismatch before returning a core', () => {
    const input = clone(generatedInput()) as any;
    input.sourceKind = 'LEGACY_V1';
    expectCode(
      () => resolveSessionSpfaClinicalContentV2(input),
      'source_format_mismatch',
    );
  });
});

describe('content boundary failures and architecture', () => {
  it.each([
    [{ ...legacyInput(), caseId: 0 }, 'invalid_input'],
    [{ ...legacyInput(), caseVersionId: 'semantic-id' }, 'invalid_input'],
    [{ ...legacyInput(), contentFormat: 'FUTURE_FORMAT' }, 'unsupported_content_format'],
    [{ ...legacyInput(), sourceKind: 'AI_GENERATED' }, 'source_format_mismatch'],
    [{ ...generatedInput(), legacyStatus: 'approved' }, 'source_format_mismatch'],
  ])('fails closed with stable codes', (input, code) => {
    expectCode(() => resolveSessionPatientClinicalContentV2(input), code);
  });

  it('keeps implementation files pure and free of DB, HTTP, OpenAI, env and network access', () => {
    const files = [
      'lib/cases/v2/session-clinical-content-types.ts',
      'lib/cases/v2/resolve-session-clinical-content.ts',
    ];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/@\/lib\/db|from ['"]pg['"]|next\/server|@\/lib\/openai|process\.env|fetch\s*\(|public\.cases|SELECT\s/i);
    }
  });
});
