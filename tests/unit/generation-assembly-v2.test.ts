import { describe, expect, it, vi } from 'vitest';

import { assembleCanonicalGeneratedCaseV2 } from '../../lib/cases/v2/assemble-canonical-generated-case';
import type {
  AiDisclosureIntent,
  AiGeneratedCaseDraftV2,
  AiTaxonomyCatalog,
  AiTaxonomyConceptRef,
} from '../../lib/cases/v2/ai-generation-types';
import {
  GenerationAssemblyError,
  type GenerationAssemblyContextV2,
} from '../../lib/cases/v2/generation-assembly-types';
import { validateAiGeneratedCaseDraftV2 } from '../../lib/cases/v2/validate-ai-generated-case-draft';
import type { DisclosureRule } from '../../lib/cases/v2/types';

const spontaneous = { mode: 'spontaneous' } as const;

function known(localFactKey: string, value: unknown, disclosureIntent = spontaneous) {
  return {
    state: 'known',
    localFactKey,
    value,
    certainty: 'exact',
    disclosureIntent,
  };
}

function notApplicable() {
  return {
    state: 'not_applicable',
    reasonCode: 'not_applicable_to_patient',
  };
}

function communicationProfile() {
  return {
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
  };
}

function evidenceRule(conclusionRef: string, factRef = 'lf_1') {
  return {
    conclusionRef,
    requiredEvidence: { operator: 'fact', factRef },
    supportingEvidenceRefs: [],
    counterEvidenceRefs: [],
    teacherRationale: `Evidencia para ${conclusionRef}`,
  };
}

function createMinimalUnknownDraft(): Record<string, any> {
  return {
    contractVersion: 'ai-generated-case-draft/1',
    patientFacts: {
      publicProfile: {
        nombre: 'María',
        edad: 68,
        sexo: 'mujer',
        tratamiento: 'Enalapril 20 mg',
      },
      initialDemand: known('lf_1', 'Vengo a por mi medicación'),
      encounter: {
        personPresent: known('lf_2', 'patient'),
        relationshipToPatient: notApplicable(),
      },
      clinicalContext: {
        healthProblems: [],
        clinicalHistory: [],
        physiologicalSituation: [],
        pregnancyAndLactation: notApplicable(),
        allergiesAndIntolerances: [],
        lifestyle: [],
        biomedicalData: [],
      },
      symptoms: [],
      pharmacotherapy: {
        prescribedMedications: [],
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
      communicationProfile: communicationProfile(),
    },
    evaluator: {
      carePath: {
        initialSpfa: {
          localConclusionKey: 'lc_1',
          kind: 'spfa',
          value: { service: 'dispensing', subtype: 'continuation' },
        },
        additionalSpfas: [],
        transitions: [],
      },
      incidence: {
        assessment: {
          localConclusionKey: 'lc_2',
          kind: 'incidence_assessment',
          value: { status: 'none' },
        },
        findings: [],
        followUpEpisodes: [],
      },
      prm: {
        assessment: {
          localConclusionKey: 'lc_3',
          kind: 'prm_assessment',
          value: { status: 'none' },
        },
        findings: [],
      },
      rnmAssessments: [
        {
          localConclusionKey: 'lc_4',
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
        localConclusionKey: 'lc_5',
        kind: 'referral',
        value: { status: 'not_required' },
      },
      evidenceRules: [
        {
          ...evidenceRule('lc_2'),
          requiredEvidence: { operator: 'public_profile', field: 'age' },
        },
        evidenceRule('lc_3'),
        evidenceRule('lc_4'),
        evidenceRule('lc_5'),
      ],
    },
  };
}

function medication(localMedicationKey: string, start: number) {
  return {
    localMedicationKey,
    displayName: known(`lf_${start}`, 'Enalapril 20 mg'),
    origin: known(`lf_${start + 1}`, 'prescribed'),
    purposeAsUnderstood: {
      state: 'patient_unknown',
      localFactKey: `lf_${start + 2}`,
      topic: 'para qué sirve el medicamento',
      disclosureIntent: spontaneous,
    },
    regimenBasis: known(`lf_${start + 3}`, 'prescription'),
    referenceDose: known(`lf_${start + 4}`, '20 mg'),
    referenceSchedule: known(`lf_${start + 5}`, 'una vez al día'),
    referenceDuration: notApplicable(),
    administrationMethod: known(`lf_${start + 6}`, 'vía oral'),
    specialUseConditions: [],
  };
}

function addMedicationAndUse(draft: Record<string, any>) {
  draft.patientFacts.pharmacotherapy.prescribedMedications.push(
    medication('lm_1', 10),
  );
  draft.patientFacts.pharmacotherapy.actualMedicationUse.push({
    localUseKey: 'lu_1',
    medicationRef: 'lm_1',
    action: 'omits',
    actualUse: known('lf_20', 'A veces no la toma'),
    actualDose: known('lf_21', '20 mg cuando la toma'),
    actualSchedule: known('lf_22', 'por la mañana'),
    frequency: known('lf_23', 'omite dos veces por semana'),
    timePeriod: known('lf_24', 'desde hace un mes'),
    circumstanceFactRefs: ['lf_20'],
    statedReasonFactRefs: ['lf_20'],
    perceivedEffectFactRefs: ['lf_20'],
    practicalDifficultyFactRefs: ['lf_20'],
    strategyTriedFactRefs: ['lf_20'],
  });
}

function createComplexUnknownDraft(): Record<string, any> {
  const draft = createMinimalUnknownDraft();
  addMedicationAndUse(draft);
  draft.evaluator.prm.assessment.value.status = 'present';
  draft.evaluator.prm.findings.push({
    localConclusionKey: 'lc_6',
    kind: 'prm',
    value: {
      classification: { catalog: 'prm', conceptId: 'prm-dose-omission' },
      medicationRefs: ['lm_1'],
    },
  });
  draft.evaluator.rnmAssessments = [
    {
      localConclusionKey: 'lc_4',
      kind: 'rnm_assessment',
      value: {
        status: 'risk_of_rnm',
        classification: { catalog: 'rnm', conceptId: 'rnm-effectiveness-risk' },
        medicationRefs: ['lm_1'],
      },
    },
  ];
  draft.evaluator.prmRnmRelations.push({
    localConclusionKey: 'lc_7',
    kind: 'prm_rnm_relation',
    value: {
      prmRef: 'lc_6',
      rnmAssessmentRef: 'lc_4',
      relation: 'creates_risk_of_rnm',
    },
  });
  draft.evaluator.adherence.assessments.push({
    localConclusionKey: 'lc_8',
    kind: 'adherence_assessment',
    value: { medicationRefs: ['lm_1'], status: 'non_adherent' },
  });
  draft.evaluator.adherence.typeConclusions.push({
    localConclusionKey: 'lc_9',
    kind: 'non_adherence_type',
    value: {
      adherenceAssessmentRef: 'lc_8',
      status: 'determined',
      type: 'unintentional',
    },
  });
  draft.evaluator.adherence.barrierAssessments.push({
    localConclusionKey: 'lc_10',
    kind: 'adherence_barrier_assessment',
    value: { adherenceAssessmentRef: 'lc_8', status: 'identified' },
  });
  draft.evaluator.adherence.barriers.push({
    localConclusionKey: 'lc_11',
    kind: 'adherence_barrier',
    value: {
      barrierAssessmentRef: 'lc_10',
      role: 'primary',
      category: 'practical',
      classification: {
        catalog: 'adherence_barrier',
        conceptId: 'forgetfulness',
      },
    },
  });
  draft.evaluator.adherence.strategies.push({
    localConclusionKey: 'lc_12',
    kind: 'adherence_strategy',
    value: {
      adherenceAssessmentRef: 'lc_8',
      addressedBarrierRefs: ['lc_11'],
      category: 'behavioral',
    },
  });
  draft.evaluator.referral = {
    localConclusionKey: 'lc_5',
    kind: 'referral',
    value: {
      status: 'required',
      urgency: 'non_urgent',
      destination: {
        label: 'Medicina de familia',
        classification: {
          catalog: 'referral_destination',
          conceptId: 'primary-care',
        },
      },
      reason: 'Revisar el control y el tratamiento',
      report: {
        status: 'required',
        essentialContents: ['Uso real', 'Riesgo identificado'],
      },
    },
  };
  draft.evaluator.professionalActions.push({
    localConclusionKey: 'lc_13',
    kind: 'professional_action',
    value: {
      spfaRef: 'lc_1',
      category: 'referral',
      classification: {
        catalog: 'professional_action',
        conceptId: 'refer-to-physician',
      },
      referralRef: 'lc_5',
    },
  });
  draft.evaluator.pharmaceuticalInterventions.push({
    localConclusionKey: 'lc_14',
    kind: 'pharmaceutical_intervention',
    value: {
      spfaRef: 'lc_1',
      professionalActionRef: 'lc_13',
      target: 'conditions_of_use',
      classification: {
        catalog: 'pharmaceutical_intervention',
        conceptId: 'improve-adherence',
      },
      addressedConclusionRefs: ['lc_6', 'lc_8', 'lc_11'],
      referralRef: 'lc_5',
    },
  });
  draft.evaluator.evidenceRules = [
    {
      ...evidenceRule('lc_2', 'lf_20'),
      requiredEvidence: { operator: 'public_profile', field: 'age' },
    },
    ...['lc_3', 'lc_4', 'lc_5', 'lc_6', 'lc_8', 'lc_9', 'lc_10', 'lc_11', 'lc_12', 'lc_13', 'lc_14'].map(
      (ref) => evidenceRule(ref, 'lf_20'),
    ),
  ];
  return draft;
}

const taxonomyVersions: Record<AiTaxonomyCatalog, { id: string; version: string }> = {
  prm: { id: 'prm-catalog', version: '2024' },
  rnm: { id: 'rnm-catalog', version: '2024' },
  adherence_barrier: { id: 'barrier-catalog', version: '1' },
  professional_action: { id: 'action-catalog', version: '1' },
  pharmaceutical_intervention: { id: 'intervention-catalog', version: '1' },
  referral_destination: { id: 'referral-catalog', version: '1' },
};

function ordinal(localKey: string): string {
  return localKey.slice(3).padStart(12, '0');
}

function createContext(overrides: Partial<GenerationAssemblyContextV2> = {}) {
  let reportContentSequence = 0;
  const context: GenerationAssemblyContextV2 = {
    caseVersionId: 'casever_90000000-0000-4000-8000-000000000001' as any,
    evaluatorVersions: {
      evaluatorSchema: { id: 'evaluator-v2', version: '2.0' },
      protocol: { id: 'foro-af-fc', version: '2024' },
      prmTaxonomy: taxonomyVersions.prm,
      rnmTaxonomy: taxonomyVersions.rnm,
      adherenceFramework: { id: 'adherence-framework', version: '1' },
      barrierTaxonomy: taxonomyVersions.adherence_barrier,
      professionalActionTaxonomy: taxonomyVersions.professional_action,
      pharmaceuticalInterventionTaxonomy:
        taxonomyVersions.pharmaceutical_intervention,
      referralDestinationTaxonomy: taxonomyVersions.referral_destination,
    },
    allocateMedicationId: vi.fn(
      (key: string) => `med_20000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    allocateMedicationUseId: vi.fn(
      (key: string) => `use_30000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    allocateFactId: vi.fn(
      (key: string) => `fact_10000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    allocateConclusionId: vi.fn(
      (key: string) =>
        `conclusion_40000000-0000-4000-8000-${ordinal(key)}` as any,
    ),
    allocateReportEssentialContentId: vi.fn(() => {
      reportContentSequence += 1;
      return `report_content_50000000-0000-4000-8000-${String(reportContentSequence).padStart(12, '0')}` as any;
    }),
    resolveTaxonomy: vi.fn((ref: AiTaxonomyConceptRef) => ({
      taxonomyId: taxonomyVersions[ref.catalog].id,
      taxonomyVersion: taxonomyVersions[ref.catalog].version,
      conceptId: ref.conceptId,
    })),
    resolveDisclosure: vi.fn((intent: AiDisclosureIntent): DisclosureRule => {
      if (!('domains' in intent)) {
        return { mode: intent.mode };
      }
      if (intent.mode === 'rapport_required') {
        return {
          mode: 'rapport_required',
          domains: [...intent.domains],
          minimumRapport: 60,
        };
      }
      return { mode: intent.mode, domains: [...intent.domains] };
    }),
    ...overrides,
  };
  return context;
}

function validated(source = createMinimalUnknownDraft()): AiGeneratedCaseDraftV2 {
  return validateAiGeneratedCaseDraftV2(source);
}

function expectAssemblyError(
  action: () => unknown,
  code: GenerationAssemblyError['code'],
) {
  try {
    action();
    throw new Error('expected assembly to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(GenerationAssemblyError);
    const assemblyError = error as GenerationAssemblyError;
    expect(assemblyError.code).toBe(code);
    return assemblyError;
  }
}

describe('canonical generated case assembly', () => {
  it('assembles a minimal validated AI draft into a canonical core', () => {
    const core = assembleCanonicalGeneratedCaseV2(validated(), createContext());

    expect(Object.keys(core).sort()).toEqual(
      ['caseVersionId', 'patientFacts', 'evaluator'].sort(),
    );
    expect(core.caseVersionId).toBe(
      'casever_90000000-0000-4000-8000-000000000001',
    );
    expect(core.patientFacts.schemaVersion).toBe('2.0');
    expect(core.evaluator.schemaVersion).toBe('2.0');
  });

  it('replaces local fact and conclusion keys with canonical IDs', () => {
    const core = assembleCanonicalGeneratedCaseV2(validated(), createContext());

    expect((core.patientFacts.initialDemand as any).factId).toBe(
      'fact_10000000-0000-4000-8000-000000000001',
    );
    expect(core.evaluator.carePath.initialSpfa.conclusionId).toBe(
      'conclusion_40000000-0000-4000-8000-000000000001',
    );
    expect(JSON.stringify(core)).not.toMatch(/"l[fmuc]_\d+"/);
  });

  it('allocates each defined local key exactly once despite repeated references', () => {
    const context = createContext();
    assembleCanonicalGeneratedCaseV2(validated(), context);

    expect(context.allocateFactId).toHaveBeenCalledTimes(2);
    expect(context.allocateFactId).toHaveBeenCalledWith('lf_1');
    expect(context.allocateConclusionId).toHaveBeenCalledTimes(5);
    expect(context.allocateConclusionId).toHaveBeenCalledWith('lc_2');
  });

  it('asigna IDs server-owned únicos a cada contenido esencial sin alterar su orden', () => {
    const context = createContext();
    const core = assembleCanonicalGeneratedCaseV2(
      validated(createComplexUnknownDraft()),
      context,
    );
    const report = (core.evaluator.referral.value as any).report;

    expect(report).toEqual({
      contractVersion: 'identified-report-requirement/1',
      status: 'required',
      essentialContents: [
        {
          contentId: 'report_content_50000000-0000-4000-8000-000000000001',
          content: 'Uso real',
        },
        {
          contentId: 'report_content_50000000-0000-4000-8000-000000000002',
          content: 'Riesgo identificado',
        },
      ],
    });
    expect(context.allocateReportEssentialContentId).toHaveBeenCalledTimes(2);
    expect(context.allocateReportEssentialContentId).toHaveBeenNthCalledWith(1);
    expect(context.allocateReportEssentialContentId).toHaveBeenNthCalledWith(2);
  });

  it('rechaza IDs server-owned duplicados para contenidos esenciales', () => {
    const context = createContext({
      allocateReportEssentialContentId: vi.fn(
        () => 'report_content_50000000-0000-4000-8000-000000000001' as any,
      ),
    });
    expectAssemblyError(
      () =>
        assembleCanonicalGeneratedCaseV2(
          validated(createComplexUnknownDraft()),
          context,
        ),
      'duplicate_canonical_id',
    );
  });

  it('rejects two medication keys allocated to the same canonical ID', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.pharmacotherapy.prescribedMedications.push(
      medication('lm_1', 10),
      medication('lm_2', 30),
    );
    const context = createContext({
      allocateMedicationId: vi.fn(
        () => 'med_20000000-0000-4000-8000-000000000001' as any,
      ),
    });

    expectAssemblyError(
      () => assembleCanonicalGeneratedCaseV2(validated(source), context),
      'duplicate_canonical_id',
    );
  });

  it('assigns FactId only to defined factual states', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.clinicalContext.healthProblems.push({
      state: 'explicit_absence',
      localFactKey: 'lf_3',
      topic: 'otros problemas de salud',
      disclosureIntent: spontaneous,
    });
    source.patientFacts.clinicalContext.clinicalHistory.push({
      state: 'patient_unknown',
      localFactKey: 'lf_4',
      topic: 'antecedentes familiares',
      disclosureIntent: spontaneous,
    });
    const core = assembleCanonicalGeneratedCaseV2(validated(source), createContext());

    expect(core.patientFacts.clinicalContext.healthProblems[0]).toHaveProperty(
      'factId',
    );
    expect(core.patientFacts.clinicalContext.clinicalHistory[0]).toHaveProperty(
      'factId',
    );
    expect(core.patientFacts.clinicalContext.pregnancyAndLactation).toEqual({
      state: 'not_applicable',
      reasonCode: 'not_applicable_to_patient',
    });
    expect(core.patientFacts.clinicalContext.pregnancyAndLactation).not.toHaveProperty(
      'factId',
    );
  });

  it('preserves not_defined without allocating a fact, then fails closed at runtime validation', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.clinicalContext.pregnancyAndLactation = {
      state: 'not_defined',
    };
    const draft = validated(source);
    const context = createContext();

    expectAssemblyError(
      () => assembleCanonicalGeneratedCaseV2(draft, context),
      'invalid_patient_facts',
    );
    expect(draft.patientFacts.clinicalContext.pregnancyAndLactation).toEqual({
      state: 'not_defined',
    });
    expect(draft.patientFacts.clinicalContext.pregnancyAndLactation).not.toHaveProperty(
      'localFactKey',
    );
    expect(context.allocateFactId).toHaveBeenCalledTimes(2);
  });

  it('resolves medication, use and factual references from their maps', () => {
    const source = createMinimalUnknownDraft();
    addMedicationAndUse(source);
    const core = assembleCanonicalGeneratedCaseV2(validated(source), createContext());
    const use = core.patientFacts.pharmacotherapy.actualMedicationUse[0];

    expect(use.useId).toBe('use_30000000-0000-4000-8000-000000000001');
    expect(use.medicationRef).toBe(
      'med_20000000-0000-4000-8000-000000000001',
    );
    expect(use.statedReasonFactRefs).toEqual([
      'fact_10000000-0000-4000-8000-000000000020',
    ]);
  });

  it('preserves nested evidence and public profile references while resolving IDs', () => {
    const source = createMinimalUnknownDraft();
    source.evaluator.evidenceRules[1].requiredEvidence = {
      operator: 'all',
      operands: [
        { operator: 'fact', factRef: 'lf_1' },
        { operator: 'public_profile', field: 'sex' },
      ],
    };
    const core = assembleCanonicalGeneratedCaseV2(validated(source), createContext());
    const expression = core.evaluator.evidenceRules[1].requiredEvidence;

    expect(expression).toEqual({
      operator: 'all',
      operands: [
        {
          operator: 'fact',
          factRef: 'fact_10000000-0000-4000-8000-000000000001',
        },
        { operator: 'public_profile', field: 'sex' },
      ],
    });
  });

  it('passes every taxonomy through the server-owned resolver', () => {
    const context = createContext();
    const core = assembleCanonicalGeneratedCaseV2(
      validated(createComplexUnknownDraft()),
      context,
    );

    expect(context.resolveTaxonomy).toHaveBeenCalledTimes(6);
    expect(core.evaluator.prm.findings[0].value.classification).toEqual({
      taxonomyId: 'prm-catalog',
      taxonomyVersion: '2024',
      conceptId: 'prm-dose-omission',
    });
  });

  it('translates a taxonomy resolver exception', () => {
    const cause = new Error('unknown concept');
    const context = createContext({
      resolveTaxonomy: vi.fn(() => {
        throw cause;
      }),
    });

    const error = expectAssemblyError(
      () =>
        assembleCanonicalGeneratedCaseV2(
          validated(createComplexUnknownDraft()),
          context,
        ),
      'taxonomy_resolution_failed',
    );
    expect(error.cause).toBe(cause);
    expect(error.path).toContain('classification');
  });

  it('rejects a taxonomy incompatible with server-owned versions', () => {
    const context = createContext({
      resolveTaxonomy: vi.fn((ref) => ({
        taxonomyId: 'wrong-catalog',
        taxonomyVersion: '0',
        conceptId: ref.conceptId,
      })),
    });
    expectAssemblyError(
      () =>
        assembleCanonicalGeneratedCaseV2(
          validated(createComplexUnknownDraft()),
          context,
        ),
      'taxonomy_resolution_failed',
    );
  });

  it('passes every defined datum through disclosure resolution', () => {
    const context = createContext();
    const core = assembleCanonicalGeneratedCaseV2(validated(), context);

    expect(context.resolveDisclosure).toHaveBeenCalledTimes(2);
    expect((core.patientFacts.initialDemand as any).disclosure).toEqual({
      mode: 'spontaneous',
    });
  });

  it('completes rapport_required with a server-owned rule', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.initialDemand.disclosureIntent = {
      mode: 'rapport_required',
      domains: ['initial_demand'],
    };
    const core = assembleCanonicalGeneratedCaseV2(validated(source), createContext());

    expect((core.patientFacts.initialDemand as any).disclosure).toEqual({
      mode: 'rapport_required',
      domains: ['initial_demand'],
      minimumRapport: 60,
    });
  });

  it('rejects rapport_required resolved as spontaneous', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.initialDemand.disclosureIntent = {
      mode: 'rapport_required',
      domains: ['beliefs_and_concerns'],
    };
    const context = createContext({
      resolveDisclosure: vi.fn(
        (): DisclosureRule => ({ mode: 'spontaneous' }),
      ),
    });

    const error = expectAssemblyError(
      () => assembleCanonicalGeneratedCaseV2(validated(source), context),
      'disclosure_resolution_failed',
    );
    expect(error.path).toContain('.mode');
  });

  it('rejects specific_question resolved as domain_exploration', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.initialDemand.disclosureIntent = {
      mode: 'specific_question',
      domains: ['symptoms'],
    };
    const context = createContext({
      resolveDisclosure: vi.fn(
        (): DisclosureRule => ({
          mode: 'domain_exploration',
          domains: ['symptoms'],
        }),
      ),
    });

    expectAssemblyError(
      () => assembleCanonicalGeneratedCaseV2(validated(source), context),
      'disclosure_resolution_failed',
    );
  });

  it('rejects domains added by disclosure resolution', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.initialDemand.disclosureIntent = {
      mode: 'domain_exploration',
      domains: ['symptoms'],
    };
    const context = createContext({
      resolveDisclosure: vi.fn(
        (intent: AiDisclosureIntent): DisclosureRule =>
          'domains' in intent
            ? {
                mode: 'domain_exploration',
                domains: ['symptoms', 'health_problems'],
              }
            : { mode: intent.mode },
      ),
    });

    const error = expectAssemblyError(
      () => assembleCanonicalGeneratedCaseV2(validated(source), context),
      'disclosure_resolution_failed',
    );
    expect(error.path).toContain('.domains');
  });

  it('accepts the same disclosure domain set in a different order', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.initialDemand.disclosureIntent = {
      mode: 'domain_exploration',
      domains: ['symptoms', 'health_problems'],
    };
    const context = createContext({
      resolveDisclosure: vi.fn(
        (intent: AiDisclosureIntent): DisclosureRule =>
          'domains' in intent
            ? {
                mode: 'domain_exploration',
                domains: ['health_problems', 'symptoms'],
              }
            : { mode: intent.mode },
      ),
    });

    const core = assembleCanonicalGeneratedCaseV2(validated(source), context);
    expect((core.patientFacts.initialDemand as any).disclosure).toEqual({
      mode: 'domain_exploration',
      domains: ['health_problems', 'symptoms'],
    });
  });

  it('accepts server-owned rapport threshold and delays with the same domains', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.initialDemand.disclosureIntent = {
      mode: 'rapport_required',
      domains: ['beliefs_and_concerns', 'practical_difficulties'],
    };
    const context = createContext({
      resolveDisclosure: vi.fn(
        (intent: AiDisclosureIntent): DisclosureRule => {
          if ('domains' in intent && intent.mode === 'rapport_required') {
            return {
              mode: 'rapport_required',
              domains: ['practical_difficulties', 'beliefs_and_concerns'],
              minimumRapport: 75,
              delayedBy: ['judgmental_tone'],
            };
          }
          return { mode: 'spontaneous' };
        },
      ),
    });

    const core = assembleCanonicalGeneratedCaseV2(validated(source), context);
    expect((core.patientFacts.initialDemand as any).disclosure).toEqual({
      mode: 'rapport_required',
      domains: ['practical_difficulties', 'beliefs_and_concerns'],
      minimumRapport: 75,
      delayedBy: ['judgmental_tone'],
    });
  });

  it('translates disclosure resolver failures and preserves the cause', () => {
    const cause = new Error('policy unavailable');
    const context = createContext({
      resolveDisclosure: vi.fn(() => {
        throw cause;
      }),
    });
    const error = expectAssemblyError(
      () => assembleCanonicalGeneratedCaseV2(validated(), context),
      'disclosure_resolution_failed',
    );

    expect(error.cause).toBe(cause);
    expect(error.path).toContain('disclosureIntent');
  });

  it('rejects an incomplete DisclosureRule returned by the resolver', () => {
    const source = createMinimalUnknownDraft();
    source.patientFacts.initialDemand.disclosureIntent = {
      mode: 'rapport_required',
      domains: ['initial_demand'],
    };
    const context = createContext({
      resolveDisclosure: vi.fn(() => ({
        mode: 'rapport_required',
        domains: ['initial_demand'],
      }) as any),
    });
    expectAssemblyError(
      () => assembleCanonicalGeneratedCaseV2(validated(source), context),
      'disclosure_resolution_failed',
    );
  });

  it('reports invalid canonical patient facts', () => {
    const context = createContext({
      allocateFactId: vi.fn(
        (key: string) => `fact_invalid-${ordinal(key)}` as any,
      ),
    });
    expectAssemblyError(
      () => assembleCanonicalGeneratedCaseV2(validated(), context),
      'invalid_patient_facts',
    );
  });

  it('reports invalid canonical evaluator output', () => {
    const context = createContext({
      allocateConclusionId: vi.fn(
        (key: string) => `conclusion_invalid-${ordinal(key)}` as any,
      ),
    });
    expectAssemblyError(
      () => assembleCanonicalGeneratedCaseV2(validated(), context),
      'invalid_evaluator',
    );
  });

  it('assembles a non-trivial clinical graph without omitting conclusions', () => {
    const source = createComplexUnknownDraft();
    const draft = validated(source);
    const core = assembleCanonicalGeneratedCaseV2(draft, createContext());

    expect(core.evaluator.prm.findings).toHaveLength(1);
    expect(core.evaluator.rnmAssessments[0].value.status).toBe('risk_of_rnm');
    expect(core.evaluator.prmRnmRelations).toHaveLength(1);
    expect(core.evaluator.adherence.assessments[0].value.status).toBe(
      'non_adherent',
    );
    expect(core.evaluator.adherence.typeConclusions).toHaveLength(1);
    expect(core.evaluator.adherence.barriers).toHaveLength(1);
    expect(core.evaluator.adherence.strategies).toHaveLength(1);
    expect(core.evaluator.professionalActions).toHaveLength(1);
    expect(core.evaluator.pharmaceuticalInterventions).toHaveLength(1);
    expect(core.evaluator.referral.value.status).toBe('required');
    expect(core.evaluator.evidenceRules).toHaveLength(12);
    expect(core.evaluator.prmRnmRelations[0].value.prmRef).toBe(
      core.evaluator.prm.findings[0].conclusionId,
    );
  });

  it('does not mutate the validated draft or the assembly context', () => {
    const draft = validated(createComplexUnknownDraft());
    const context = createContext();
    const draftBefore = JSON.stringify(draft);
    const versionsBefore = JSON.stringify(context.evaluatorVersions);

    assembleCanonicalGeneratedCaseV2(draft, context);

    expect(JSON.stringify(draft)).toBe(draftBefore);
    expect(JSON.stringify(context.evaluatorVersions)).toBe(versionsBefore);
  });
});
