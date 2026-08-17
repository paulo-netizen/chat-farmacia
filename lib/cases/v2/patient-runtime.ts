import type {
  BiomedicalDatumValue,
  DisclosureRule,
  MedicationLinkedFactDraftV2,
  PatientCommunicationProfile,
  PatientDatum,
  PatientMedicationDraftV2,
  PatientRuntimeViewV2,
  RuntimeMedicationLinkedFactV2,
  RuntimePatientDatum,
  RuntimePatientMedicationV2,
} from './types';
import {
  PatientFactsValidationError,
  validateCasePatientFactsDraftV2,
} from './validate-patient-facts';

const FORBIDDEN_RUNTIME_KEYS = new Set([
  'ground_truth',
  'adherence',
  'adherenceStatus',
  'nonAdherenceType',
  'adherent',
  'non_adherent',
  'intentional',
  'unintentional',
  'erratic',
  'combined',
  'tipo_no_adherencia',
  'primaryBarrier',
  'barrera_principal',
  'prm',
  'rnm',
  'risk_of_rnm',
  'intervention',
  'evaluator',
  'rubric',
  'reasonCode',
]);

function copyDisclosure(disclosure: DisclosureRule): DisclosureRule {
  const delayedBy =
    disclosure.delayedBy === undefined
      ? undefined
      : [...disclosure.delayedBy];

  if (
    disclosure.mode === 'spontaneous' ||
    disclosure.mode === 'open_question'
  ) {
    return delayedBy === undefined
      ? { mode: disclosure.mode }
      : { mode: disclosure.mode, delayedBy };
  }

  if (disclosure.mode === 'rapport_required') {
    return {
      mode: disclosure.mode,
      domains: [...disclosure.domains],
      minimumRapport: disclosure.minimumRapport,
      ...(delayedBy === undefined ? {} : { delayedBy }),
    };
  }

  if (!('domains' in disclosure)) {
    throw new PatientFactsValidationError(
      'disclosure',
      'domains are required for this disclosure mode',
    );
  }

  return {
    mode: disclosure.mode,
    domains: [...disclosure.domains],
    ...(delayedBy === undefined ? {} : { delayedBy }),
  };
}

function identity<T>(value: T): T {
  return value;
}

function projectDatum<T>(
  datum: PatientDatum<T>,
  path: string,
  copyValue: (value: T) => T = identity,
): RuntimePatientDatum<T> | undefined {
  if (datum.state === 'not_defined') {
    throw new PatientFactsValidationError(
      path,
      'not_defined is forbidden in patient runtime view',
    );
  }

  if (datum.state === 'not_applicable') {
    return undefined;
  }

  if (datum.state === 'known') {
    return {
      state: datum.state,
      factId: datum.factId,
      value: copyValue(datum.value),
      certainty: datum.certainty,
      disclosure: copyDisclosure(datum.disclosure),
    };
  }

  return {
    state: datum.state,
    factId: datum.factId,
    topic: datum.topic,
    disclosure: copyDisclosure(datum.disclosure),
  };
}

function projectRequiredDatum<T>(
  datum: PatientDatum<T>,
  path: string,
  copyValue: (value: T) => T = identity,
): RuntimePatientDatum<T> {
  const projected = projectDatum(datum, path, copyValue);
  if (projected === undefined) {
    throw new PatientFactsValidationError(
      path,
      'not_applicable cannot populate this required runtime property',
    );
  }
  return projected;
}

function projectRequiredKnownDatum<T>(
  datum: PatientDatum<T>,
  path: string,
  copyValue: (value: T) => T = identity,
): RuntimePatientDatum<T> & { state: 'known' } {
  const projected = projectRequiredDatum(datum, path, copyValue);
  if (projected.state !== 'known') {
    throw new PatientFactsValidationError(
      path,
      'must be known before creating patient runtime view',
    );
  }
  return projected;
}

function projectDatumCollection<T>(
  values: PatientDatum<T>[],
  path: string,
  copyValue: (value: T) => T = identity,
): RuntimePatientDatum<T>[] {
  return values.flatMap((datum, index) => {
    const projected = projectDatum(datum, `${path}[${index}]`, copyValue);
    return projected === undefined ? [] : [projected];
  });
}

function copyBiomedicalValue(value: BiomedicalDatumValue): BiomedicalDatumValue {
  return {
    type: value.type,
    value: value.value,
    ...(value.unit === undefined ? {} : { unit: value.unit }),
    ...(value.timingOrContext === undefined
      ? {}
      : { timingOrContext: value.timingOrContext }),
  };
}

function projectMedication(
  medication: PatientMedicationDraftV2,
  path: string,
): RuntimePatientMedicationV2 {
  const purposeAsUnderstood = projectDatum(
    medication.purposeAsUnderstood,
    `${path}.purposeAsUnderstood`,
  );
  const regimenBasis = projectDatum(
    medication.regimenBasis,
    `${path}.regimenBasis`,
  );
  const referenceDose = projectDatum(
    medication.referenceDose,
    `${path}.referenceDose`,
  );
  const referenceSchedule = projectDatum(
    medication.referenceSchedule,
    `${path}.referenceSchedule`,
  );
  const referenceDuration = projectDatum(
    medication.referenceDuration,
    `${path}.referenceDuration`,
  );
  const administrationMethod = projectDatum(
    medication.administrationMethod,
    `${path}.administrationMethod`,
  );

  return {
    medicationId: medication.medicationId,
    displayName: projectRequiredKnownDatum(
      medication.displayName,
      `${path}.displayName`,
    ),
    origin: projectRequiredDatum(medication.origin, `${path}.origin`),
    ...(purposeAsUnderstood === undefined ? {} : { purposeAsUnderstood }),
    ...(regimenBasis === undefined ? {} : { regimenBasis }),
    ...(referenceDose === undefined ? {} : { referenceDose }),
    ...(referenceSchedule === undefined ? {} : { referenceSchedule }),
    ...(referenceDuration === undefined ? {} : { referenceDuration }),
    ...(administrationMethod === undefined ? {} : { administrationMethod }),
    specialUseConditions: projectDatumCollection(
      medication.specialUseConditions,
      `${path}.specialUseConditions`,
    ),
  };
}

function projectMedicationLinkedFact(
  value: MedicationLinkedFactDraftV2,
  path: string,
): RuntimeMedicationLinkedFactV2 {
  return {
    medicationRef: value.medicationRef,
    detail: projectRequiredDatum(value.detail, `${path}.detail`),
  };
}

function copyCommunicationProfile(
  profile: PatientCommunicationProfile,
): PatientCommunicationProfile {
  return {
    sociability: profile.sociability,
    cooperation: profile.cooperation,
    organization: profile.organization,
    emotionalReactivity: profile.emotionalReactivity,
    opennessToChange: profile.opennessToChange,
    healthLiteracy: profile.healthLiteracy,
    professionalTrust: profile.professionalTrust,
    medicationAttitude: profile.medicationAttitude,
    decisionStyle: profile.decisionStyle,
    readinessToChange: profile.readinessToChange,
    socialDesirability: profile.socialDesirability,
    judgmentSensitivity: profile.judgmentSensitivity,
    disclosureThreshold: profile.disclosureThreshold,
    answerLength: profile.answerLength,
    assertiveness: profile.assertiveness,
    emotionalExpression: profile.emotionalExpression,
  };
}

function assertNoForbiddenRuntimeKeys(value: unknown, path = 'runtime'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoForbiddenRuntimeKeys(item, `${path}[${index}]`),
    );
    return;
  }

  if (typeof value !== 'object' || value === null) return;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_RUNTIME_KEYS.has(key)) {
      throw new PatientFactsValidationError(
        `${path}.${key}`,
        'academic field is forbidden in patient runtime view',
      );
    }
    assertNoForbiddenRuntimeKeys(nestedValue, `${path}.${key}`);
  }
}

export function createPatientRuntimeViewV2(input: unknown): PatientRuntimeViewV2 {
  const draft = validateCasePatientFactsDraftV2(input);

  const relationshipToPatient = projectDatum(
    draft.encounter.relationshipToPatient,
    'encounter.relationshipToPatient',
  );
  const pregnancyAndLactation = projectDatum(
    draft.clinicalContext.pregnancyAndLactation,
    'clinicalContext.pregnancyAndLactation',
  );

  const runtime: PatientRuntimeViewV2 = {
    schemaVersion: '2.0',
    caseVersionId: draft.caseVersionId,
    publicProfile: {
      nombre: draft.publicProfile.nombre,
      edad: draft.publicProfile.edad,
      sexo: draft.publicProfile.sexo,
      tratamiento: draft.publicProfile.tratamiento,
    },
    initialDemand: projectRequiredKnownDatum(
      draft.initialDemand,
      'initialDemand',
    ),
    encounter: {
      personPresent: projectRequiredKnownDatum(
        draft.encounter.personPresent,
        'encounter.personPresent',
      ),
      ...(relationshipToPatient === undefined
        ? {}
        : { relationshipToPatient }),
    },
    clinicalContext: {
      healthProblems: projectDatumCollection(
        draft.clinicalContext.healthProblems,
        'clinicalContext.healthProblems',
      ),
      clinicalHistory: projectDatumCollection(
        draft.clinicalContext.clinicalHistory,
        'clinicalContext.clinicalHistory',
      ),
      physiologicalSituation: projectDatumCollection(
        draft.clinicalContext.physiologicalSituation,
        'clinicalContext.physiologicalSituation',
      ),
      ...(pregnancyAndLactation === undefined
        ? {}
        : { pregnancyAndLactation }),
      allergiesAndIntolerances: projectDatumCollection(
        draft.clinicalContext.allergiesAndIntolerances,
        'clinicalContext.allergiesAndIntolerances',
      ),
      lifestyle: projectDatumCollection(
        draft.clinicalContext.lifestyle,
        'clinicalContext.lifestyle',
      ),
      biomedicalData: projectDatumCollection(
        draft.clinicalContext.biomedicalData,
        'clinicalContext.biomedicalData',
        copyBiomedicalValue,
      ),
    },
    symptoms: draft.symptoms.map((symptom, index) => {
      const path = `symptoms[${index}]`;
      const onset = projectDatum(symptom.onset, `${path}.onset`);
      const duration = projectDatum(symptom.duration, `${path}.duration`);
      const evolution = projectDatum(symptom.evolution, `${path}.evolution`);
      return {
        description: projectRequiredDatum(
          symptom.description,
          `${path}.description`,
        ),
        ...(onset === undefined ? {} : { onset }),
        ...(duration === undefined ? {} : { duration }),
        ...(evolution === undefined ? {} : { evolution }),
        relevantCircumstances: projectDatumCollection(
          symptom.relevantCircumstances,
          `${path}.relevantCircumstances`,
        ),
      };
    }),
    pharmacotherapy: {
      prescribedMedications: draft.pharmacotherapy.prescribedMedications.map(
        (medication, index) =>
          projectMedication(
            medication,
            `pharmacotherapy.prescribedMedications[${index}]`,
          ),
      ),
      otherMedicinesAndProducts:
        draft.pharmacotherapy.otherMedicinesAndProducts.map(
          (medication, index) =>
            projectMedication(
              medication,
              `pharmacotherapy.otherMedicinesAndProducts[${index}]`,
            ),
        ),
      actualMedicationUse: draft.pharmacotherapy.actualMedicationUse.map(
        (use, index) => {
          const path = `pharmacotherapy.actualMedicationUse[${index}]`;
          const actualDose = projectDatum(use.actualDose, `${path}.actualDose`);
          const actualSchedule = projectDatum(
            use.actualSchedule,
            `${path}.actualSchedule`,
          );
          const frequency = projectDatum(use.frequency, `${path}.frequency`);
          const timePeriod = projectDatum(use.timePeriod, `${path}.timePeriod`);
          return {
            useId: use.useId,
            medicationRef: use.medicationRef,
            action: use.action,
            actualUse: projectRequiredDatum(
              use.actualUse,
              `${path}.actualUse`,
            ),
            ...(actualDose === undefined ? {} : { actualDose }),
            ...(actualSchedule === undefined ? {} : { actualSchedule }),
            ...(frequency === undefined ? {} : { frequency }),
            ...(timePeriod === undefined ? {} : { timePeriod }),
            circumstanceFactRefs: [...use.circumstanceFactRefs],
            statedReasonFactRefs: [...use.statedReasonFactRefs],
            perceivedEffectFactRefs: [...use.perceivedEffectFactRefs],
            practicalDifficultyFactRefs: [...use.practicalDifficultyFactRefs],
            strategyTriedFactRefs: [...use.strategyTriedFactRefs],
          };
        },
      ),
      recentChanges: draft.pharmacotherapy.recentChanges.map((value, index) =>
        projectMedicationLinkedFact(
          value,
          `pharmacotherapy.recentChanges[${index}]`,
        ),
      ),
      perceivedEffectiveness: draft.pharmacotherapy.perceivedEffectiveness.map(
        (value, index) =>
          projectMedicationLinkedFact(
            value,
            `pharmacotherapy.perceivedEffectiveness[${index}]`,
          ),
      ),
      perceivedSafety: draft.pharmacotherapy.perceivedSafety.map(
        (value, index) =>
          projectMedicationLinkedFact(
            value,
            `pharmacotherapy.perceivedSafety[${index}]`,
          ),
      ),
    },
    actionsAlreadyTaken: projectDatumCollection(
      draft.actionsAlreadyTaken,
      'actionsAlreadyTaken',
    ),
    practicalDifficulties: projectDatumCollection(
      draft.practicalDifficulties,
      'practicalDifficulties',
    ),
    beliefsAndConcerns: projectDatumCollection(
      draft.beliefsAndConcerns,
      'beliefsAndConcerns',
    ),
    strategiesAlreadyTried: projectDatumCollection(
      draft.strategiesAlreadyTried,
      'strategiesAlreadyTried',
    ),
    dailyAndSocialContext: projectDatumCollection(
      draft.dailyAndSocialContext,
      'dailyAndSocialContext',
    ),
    familyAndSocialSupport: projectDatumCollection(
      draft.familyAndSocialSupport,
      'familyAndSocialSupport',
    ),
    relationshipWithProfessionals: projectDatumCollection(
      draft.relationshipWithProfessionals,
      'relationshipWithProfessionals',
    ),
    communicationProfile: copyCommunicationProfile(
      draft.communicationProfile,
    ),
  };

  assertNoForbiddenRuntimeKeys(runtime);
  return runtime;
}
