import type {
  DisclosureRule,
  PatientCommunicationProfile,
  PatientDatum,
  PatientRuntimeViewV2,
  RuntimePatientDatum,
} from './types';
import {
  PatientFactsValidationError,
  validateCasePatientFactsDraftV2,
} from './validate-patient-facts';

const FORBIDDEN_RUNTIME_KEYS = new Set([
  'ground_truth',
  'adherent',
  'non_adherent',
  'intentional',
  'unintentional',
  'mixed',
  'tipo_no_adherencia',
  'barrera_principal',
  'prm',
  'rnm',
  'intervention',
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

function projectDatum<T>(
  datum: PatientDatum<T>,
  path: string,
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
      value: datum.value,
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
): RuntimePatientDatum<T> {
  const projected = projectDatum(datum, path);
  if (projected === undefined) {
    throw new PatientFactsValidationError(
      path,
      'not_applicable cannot populate this required runtime property',
    );
  }
  return projected;
}

function projectRequiredKnownDatum(
  datum: PatientDatum<string>,
  path: string,
): RuntimePatientDatum<string> & { state: 'known' } {
  const projected = projectRequiredDatum(datum, path);
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
): RuntimePatientDatum<T>[] {
  return values.flatMap((datum, index) => {
    const projected = projectDatum(datum, `${path}[${index}]`);
    return projected === undefined ? [] : [projected];
  });
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

  const runtime: PatientRuntimeViewV2 = {
    schemaVersion: '2.0',
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
    knownHealthProblems: projectDatumCollection(
      draft.knownHealthProblems,
      'knownHealthProblems',
    ),
    symptoms: projectDatumCollection(draft.symptoms, 'symptoms'),
    medications: draft.medications.map((medication, index) => {
      const purposeAsUnderstood = projectDatum(
        medication.purposeAsUnderstood,
        `medications[${index}].purposeAsUnderstood`,
      );
      return {
        medicationId: medication.medicationId,
        displayName: projectRequiredKnownDatum(
          medication.displayName,
          `medications[${index}].displayName`,
        ),
        prescribedUse: projectRequiredKnownDatum(
          medication.prescribedUse,
          `medications[${index}].prescribedUse`,
        ),
        ...(purposeAsUnderstood === undefined ? {} : { purposeAsUnderstood }),
      };
    }),
    medicationUse: draft.medicationUse.map((use, index) => ({
      useId: use.useId,
      medicationRef: use.medicationRef,
      action: use.action,
      actualUse: projectRequiredDatum(
        use.actualUse,
        `medicationUse[${index}].actualUse`,
      ),
      circumstanceFactRefs: [...use.circumstanceFactRefs],
      statedReasonFactRefs: [...use.statedReasonFactRefs],
      perceivedEffectFactRefs: [...use.perceivedEffectFactRefs],
      practicalDifficultyFactRefs: [...use.practicalDifficultyFactRefs],
    })),
    practicalDifficulties: projectDatumCollection(
      draft.practicalDifficulties,
      'practicalDifficulties',
    ),
    beliefsAndConcerns: projectDatumCollection(
      draft.beliefsAndConcerns,
      'beliefsAndConcerns',
    ),
    perceivedExperiences: projectDatumCollection(
      draft.perceivedExperiences,
      'perceivedExperiences',
    ),
    dailyAndSocialContext: projectDatumCollection(
      draft.dailyAndSocialContext,
      'dailyAndSocialContext',
    ),
    communicationProfile: copyCommunicationProfile(
      draft.communicationProfile,
    ),
  };

  assertNoForbiddenRuntimeKeys(runtime);
  return runtime;
}
