import { describe, expect, it } from 'vitest';

import { AI_GENERATION_LIMITS } from '../../lib/cases/v2/ai-generation-types';
import {
  AiGeneratedCaseDraftValidationError,
  validateAiGeneratedCaseDraftV2,
} from '../../lib/cases/v2/validate-ai-generated-case-draft';

const spontaneous = { mode: 'spontaneous' } as const;

function known(localFactKey: string, value: unknown) {
  return {
    state: 'known',
    localFactKey,
    value,
    certainty: 'exact',
    disclosureIntent: spontaneous,
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

function medication(localMedicationKey: string, firstFactOrdinal: number) {
  return {
    localMedicationKey,
    displayName: known(`lf_${firstFactOrdinal}`, 'Enalapril 20 mg'),
    origin: known(`lf_${firstFactOrdinal + 1}`, 'prescribed'),
    purposeAsUnderstood: { state: 'patient_unknown', localFactKey: `lf_${firstFactOrdinal + 2}`, topic: 'para qué sirve', disclosureIntent: spontaneous },
    regimenBasis: known(`lf_${firstFactOrdinal + 3}`, 'prescription'),
    referenceDose: known(`lf_${firstFactOrdinal + 4}`, '20 mg'),
    referenceSchedule: known(`lf_${firstFactOrdinal + 5}`, 'una vez al día'),
    referenceDuration: notApplicable(),
    administrationMethod: known(`lf_${firstFactOrdinal + 6}`, 'vía oral'),
    specialUseConditions: [],
  };
}

function createDraft(): Record<string, any> {
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
      evidenceRules: [],
    },
  };
}

function expectFailure(
  action: () => unknown,
  code: AiGeneratedCaseDraftValidationError['code'],
) {
  try {
    action();
    throw new Error('expected validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(AiGeneratedCaseDraftValidationError);
    const validationError = error as AiGeneratedCaseDraftValidationError;
    expect(validationError.code).toBe(code);
    return validationError;
  }
}

function addMedicationAndAdherence(draft: Record<string, any>) {
  draft.patientFacts.pharmacotherapy.prescribedMedications.push(
    medication('lm_1', 10),
  );
  draft.evaluator.adherence.assessments.push({
    localConclusionKey: 'lc_10',
    kind: 'adherence_assessment',
    value: { medicationRefs: ['lm_1'], status: 'non_adherent' },
  });
}

describe('AiGeneratedCaseDraftV2 shape and local graph', () => {
  it('accepts a minimal draft and does not mutate the source', () => {
    const draft = createDraft();
    const before = JSON.stringify(draft);

    const validated = validateAiGeneratedCaseDraftV2(draft);

    expect(validated.contractVersion).toBe('ai-generated-case-draft/1');
    expect(JSON.stringify(draft)).toBe(before);
    expect(validated).not.toBe(draft);
  });

  it('accepts two medications with distinct local keys', () => {
    const draft = createDraft();
    draft.patientFacts.pharmacotherapy.prescribedMedications.push(
      medication('lm_1', 10),
      medication('lm_2', 20),
    );

    const validated = validateAiGeneratedCaseDraftV2(draft);

    expect(validated.patientFacts.pharmacotherapy.prescribedMedications).toHaveLength(2);
  });

  it('rejects a duplicate AiMedicationKey', () => {
    const draft = createDraft();
    draft.patientFacts.pharmacotherapy.prescribedMedications.push(
      medication('lm_1', 10),
      medication('lm_1', 20),
    );
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'duplicate_local_key');
  });

  it('rejects a duplicate AiFactKey across factual domains', () => {
    const draft = createDraft();
    draft.patientFacts.actionsAlreadyTaken.push(known('lf_1', 'He llamado al centro de salud'));
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'duplicate_local_key');
  });

  it('rejects a duplicate AiConclusionKey across kinds', () => {
    const draft = createDraft();
    draft.evaluator.referral.localConclusionKey = 'lc_2';
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'duplicate_local_key');
  });

  it('rejects a strategy that references a missing barrier', () => {
    const draft = createDraft();
    addMedicationAndAdherence(draft);
    draft.evaluator.adherence.strategies.push({
      localConclusionKey: 'lc_11',
      kind: 'adherence_strategy',
      value: {
        adherenceAssessmentRef: 'lc_10',
        addressedBarrierRefs: ['lc_99'],
        category: 'educational',
      },
    });
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'unresolved_local_reference');
  });

  it('reports expected and actual kinds for a strategy barrier reference', () => {
    const draft = createDraft();
    addMedicationAndAdherence(draft);
    draft.evaluator.prm.findings.push({
      localConclusionKey: 'lc_12',
      kind: 'prm',
      value: {
        classification: { catalog: 'prm', conceptId: 'prm-example' },
        medicationRefs: ['lm_1'],
      },
    });
    draft.evaluator.adherence.strategies.push({
      localConclusionKey: 'lc_11',
      kind: 'adherence_strategy',
      value: {
        adherenceAssessmentRef: 'lc_10',
        addressedBarrierRefs: ['lc_12'],
        category: 'educational',
      },
    });

    const error = expectFailure(
      () => validateAiGeneratedCaseDraftV2(draft),
      'unresolved_local_reference',
    );
    expect(error.expectedKind).toBe('adherence_barrier');
    expect(error.actualKind).toBe('prm');
  });

  it('identifies a missing fact referenced by EvidenceRule', () => {
    const draft = createDraft();
    draft.evaluator.evidenceRules.push({
      conclusionRef: 'lc_2',
      requiredEvidence: { operator: 'fact', factRef: 'lf_99' },
      supportingEvidenceRefs: [],
      counterEvidenceRefs: [],
      teacherRationale: 'Evidencia requerida',
    });
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'invalid_evidence');
  });

  it('identifies a missing conclusion referenced by EvidenceRule', () => {
    const draft = createDraft();
    draft.evaluator.evidenceRules.push({
      conclusionRef: 'lc_99',
      requiredEvidence: { operator: 'fact', factRef: 'lf_1' },
      supportingEvidenceRefs: [],
      counterEvidenceRefs: [],
      teacherRationale: 'Evidencia requerida',
    });
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'invalid_evidence');
  });

  it('rejects an empty all expression', () => {
    const draft = createDraft();
    draft.evaluator.evidenceRules.push({
      conclusionRef: 'lc_2',
      requiredEvidence: { operator: 'all', operands: [] },
      supportingEvidenceRefs: [],
      counterEvidenceRefs: [],
      teacherRationale: 'Evidencia requerida',
    });
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'invalid_evidence');
  });

  it('rejects evidence deeper than the configured limit', () => {
    const draft = createDraft();
    let expression: Record<string, any> = { operator: 'fact', factRef: 'lf_1' };
    for (let index = 0; index <= AI_GENERATION_LIMITS.maxEvidenceDepth; index += 1) {
      expression = { operator: 'all', operands: [expression] };
    }
    draft.evaluator.evidenceRules.push({
      conclusionRef: 'lc_2',
      requiredEvidence: expression,
      supportingEvidenceRefs: [],
      counterEvidenceRefs: [],
      teacherRationale: 'Evidencia requerida',
    });
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'invalid_evidence');
  });

  it('preserves not_defined and not_applicable without synthetic facts', () => {
    const draft = createDraft();
    draft.patientFacts.initialDemand = { state: 'not_defined' };

    const validated = validateAiGeneratedCaseDraftV2(draft);

    expect(validated.patientFacts.initialDemand).toEqual({ state: 'not_defined' });
    expect(validated.patientFacts.encounter.relationshipToPatient).toEqual({
      state: 'not_applicable',
      reasonCode: 'not_applicable_to_patient',
    });
    expect(validated.patientFacts.initialDemand).not.toHaveProperty('localFactKey');
  });

  it('rejects an omitted required factual property', () => {
    const draft = createDraft();
    delete draft.patientFacts.clinicalContext.pregnancyAndLactation;
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'invalid_ai_shape');
  });

  it('rejects an unknown property', () => {
    const draft = createDraft();
    draft.patientFacts.futureSecret = 'hidden';
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'invalid_ai_shape');
  });

  it.each(['factId', 'medicationId', 'conclusionId'])('rejects canonical field %s', (field) => {
    const draft = createDraft();
    draft.patientFacts.initialDemand[field] = 'fact_10000000-0000-4000-8000-000000000001';
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'invalid_ai_shape');
  });

  it.each(['AI_DRAFT', 'PUBLISHED'])('rejects injected editorial state %s', (status) => {
    const draft = createDraft();
    draft.status = status;
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'invalid_ai_shape');
  });

  it('rejects leading-zero and out-of-limit local keys', () => {
    const leadingZero = createDraft();
    leadingZero.patientFacts.initialDemand.localFactKey = 'lf_01';
    expectFailure(() => validateAiGeneratedCaseDraftV2(leadingZero), 'invalid_ai_shape');

    const tooLarge = createDraft();
    tooLarge.patientFacts.initialDemand.localFactKey = `lf_${AI_GENERATION_LIMITS.maxLocalKeyOrdinal + 1}`;
    expectFailure(() => validateAiGeneratedCaseDraftV2(tooLarge), 'invalid_ai_shape');
  });

  it('accepts disclosure intent domains but rejects server-owned disclosure controls', () => {
    const draft = createDraft();
    draft.patientFacts.initialDemand.disclosureIntent = {
      mode: 'specific_question',
      domains: ['initial_demand'],
    };
    expect(validateAiGeneratedCaseDraftV2(draft).patientFacts.initialDemand).toMatchObject({
      disclosureIntent: { mode: 'specific_question', domains: ['initial_demand'] },
    });

    draft.patientFacts.initialDemand.disclosureIntent.minimumRapport = 50;
    expectFailure(() => validateAiGeneratedCaseDraftV2(draft), 'invalid_ai_shape');
  });
});
