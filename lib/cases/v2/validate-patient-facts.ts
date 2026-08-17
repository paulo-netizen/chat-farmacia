import type {
  BiomedicalDatumValue,
  CasePatientFactsDraftV2,
  DisclosureDelay,
  DisclosureDomain,
  DisclosureRule,
  EncounterPersonRole,
  FactId,
  MedicationId,
  MedicationLinkedFactDraftV2,
  MedicationOrigin,
  MedicationRegimenBasis,
  MedicationUseAction,
  MedicationUseId,
  MedicationUsePatternDraftV2,
  PatientClinicalContextDraftV2,
  PatientCommunicationProfile,
  PatientDatum,
  PatientEncounterDraftV2,
  PatientMedicationDraftV2,
  PatientPharmacotherapyDraftV2,
  PatientSymptomDraftV2,
  Scale1To5,
  StudentPublicView,
} from './types';

const DISCLOSURE_MODES = [
  'spontaneous',
  'open_question',
  'domain_exploration',
  'specific_question',
  'rapport_required',
] as const;

const DISCLOSURE_DOMAINS = [
  'initial_demand',
  'patient_identity',
  'caregiver_context',
  'health_problems',
  'clinical_history',
  'physiological_status',
  'pregnancy_lactation',
  'allergies_intolerances',
  'symptoms',
  'symptom_timing_and_evolution',
  'prior_actions',
  'medication_identity',
  'medication_purpose',
  'prescribed_medication_use',
  'actual_medication_use',
  'administration_technique',
  'special_use_conditions',
  'medication_changes',
  'perceived_effectiveness',
  'perceived_safety',
  'practical_difficulties',
  'beliefs_and_concerns',
  'strategies_already_tried',
  'lifestyle',
  'daily_context',
  'social_support',
  'professional_relationship',
  'biomedical_data',
] as const;

const DISCLOSURE_DELAYS = [
  'judgmental_tone',
  'accusatory_question',
  'lack_of_empathy',
  'patient_minimization',
] as const;

const ENCOUNTER_PERSON_ROLES = ['patient', 'caregiver', 'other'] as const;

const MEDICATION_ORIGINS = [
  'prescribed',
  'patient_selected',
  'pharmacist_recommended',
  'other',
] as const;

const MEDICATION_REGIMEN_BASES = [
  'prescription',
  'label_or_leaflet',
  'pharmacist_advice',
  'patient_plan',
  'other',
] as const;

const MEDICATION_USE_ACTIONS = [
  'takes',
  'omits',
  'delays',
  'changes_dose',
  'interrupts',
  'uses_extra',
  'uses_only_when_symptomatic',
  'uses_with_incorrect_technique',
] as const;

const MEDICATION_ATTITUDES = [
  'trusting',
  'neutral',
  'cautious',
  'skeptical',
  'ambivalent',
] as const;

const DECISION_STYLES = [
  'autonomous',
  'shared',
  'professional_led',
  'family_influenced',
  'indecisive',
] as const;

const UUID_BODY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const FORBIDDEN_COMMUNICATION_KEYS = new Set([
  'ground_truth',
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
]);

export class PatientFactsValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'PatientFactsValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new PatientFactsValidationError(path, message);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(path, 'must be an array');
  }
  return value;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
  return value;
}

function optionalNonEmptyString(
  value: unknown,
  path: string,
): string | undefined {
  return value === undefined ? undefined : nonEmptyString(value, path);
}

type OpaqueIdFor<Prefix extends 'fact' | 'med' | 'use'> =
  Prefix extends 'fact'
    ? FactId
    : Prefix extends 'med'
      ? MedicationId
      : MedicationUseId;

function opaqueId<Prefix extends 'fact' | 'med' | 'use'>(
  value: unknown,
  prefix: Prefix,
  path: string,
): OpaqueIdFor<Prefix> {
  if (typeof value !== 'string') {
    fail(path, `must use the opaque format ${prefix}_<uuid>`);
  }
  const expectedPrefix = `${prefix}_`;
  if (
    !value.startsWith(expectedPrefix) ||
    !UUID_BODY_PATTERN.test(value.slice(expectedPrefix.length))
  ) {
    fail(path, `must use the opaque format ${prefix}_<uuid>`);
  }
  return value as OpaqueIdFor<Prefix>;
}

function controlledValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(path, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T[number];
}

function factIdArray(value: unknown, path: string): FactId[] {
  return asArray(value, path).map((item, index) =>
    opaqueId(item, 'fact', `${path}[${index}]`),
  );
}

function controlledArray<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number][] {
  return asArray(value, path).map((item, index) =>
    controlledValue(item, allowed, `${path}[${index}]`),
  );
}

function parseScale(value: unknown, path: string): Scale1To5 {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 5
  ) {
    fail(path, 'must be an integer from 1 to 5');
  }
  return value as Scale1To5;
}

function parseDisclosureRule(value: unknown, path: string): DisclosureRule {
  const source = asRecord(value, path);
  const mode = controlledValue(source.mode, DISCLOSURE_MODES, `${path}.mode`);
  const delayedBy =
    source.delayedBy === undefined
      ? undefined
      : (controlledArray(
          source.delayedBy,
          DISCLOSURE_DELAYS,
          `${path}.delayedBy`,
        ) as DisclosureDelay[]);
  const base = delayedBy === undefined ? {} : { delayedBy };

  if (mode === 'spontaneous' || mode === 'open_question') {
    return { mode, ...base };
  }

  const domains = controlledArray(
    source.domains,
    DISCLOSURE_DOMAINS,
    `${path}.domains`,
  ) as DisclosureDomain[];
  if (domains.length === 0) {
    fail(`${path}.domains`, 'must contain at least one domain');
  }

  if (mode === 'rapport_required') {
    const minimumRapport = source.minimumRapport;
    if (
      typeof minimumRapport !== 'number' ||
      !Number.isFinite(minimumRapport) ||
      minimumRapport < 0 ||
      minimumRapport > 100
    ) {
      fail(`${path}.minimumRapport`, 'must be a finite number from 0 to 100');
    }
    return { mode, domains, minimumRapport, ...base };
  }

  return { mode, domains, ...base };
}

function parsePatientDatum<T>(
  value: unknown,
  path: string,
  parseKnownValue: (value: unknown, path: string) => T,
): PatientDatum<T> {
  const source = asRecord(value, path);
  const state = source.state;

  if (state === 'not_defined') {
    return { state };
  }

  if (state === 'not_applicable') {
    return {
      state,
      reasonCode: controlledValue(
        source.reasonCode,
        [
          'outside_case_scope',
          'clinically_irrelevant',
          'not_applicable_to_patient',
        ] as const,
        `${path}.reasonCode`,
      ),
    };
  }

  const factId = opaqueId(source.factId, 'fact', `${path}.factId`);
  const disclosure = parseDisclosureRule(
    source.disclosure,
    `${path}.disclosure`,
  );

  if (state === 'known') {
    return {
      state,
      factId,
      value: parseKnownValue(source.value, `${path}.value`),
      certainty: controlledValue(
        source.certainty,
        ['exact', 'approximate', 'uncertain'] as const,
        `${path}.certainty`,
      ),
      disclosure,
    };
  }

  if (state === 'explicit_absence' || state === 'patient_unknown') {
    return {
      state,
      factId,
      topic: nonEmptyString(source.topic, `${path}.topic`),
      disclosure,
    };
  }

  fail(
    `${path}.state`,
    'must be known, explicit_absence, patient_unknown, not_defined or not_applicable',
  );
}

function parseStringDatum(value: unknown, path: string): PatientDatum<string> {
  return parsePatientDatum(value, path, nonEmptyString);
}

function parseControlledDatum<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): PatientDatum<T[number]> {
  return parsePatientDatum(value, path, (knownValue, knownPath) =>
    controlledValue(knownValue, allowed, knownPath),
  );
}

function parseBiomedicalValue(value: unknown, path: string): BiomedicalDatumValue {
  const source = asRecord(value, path);
  const measurementValue = source.value;
  if (
    (typeof measurementValue !== 'string' &&
      typeof measurementValue !== 'number') ||
    (typeof measurementValue === 'string' &&
      measurementValue.trim().length === 0) ||
    (typeof measurementValue === 'number' &&
      !Number.isFinite(measurementValue))
  ) {
    fail(`${path}.value`, 'must be a non-empty string or finite number');
  }

  const unit = optionalNonEmptyString(source.unit, `${path}.unit`);
  const timingOrContext = optionalNonEmptyString(
    source.timingOrContext,
    `${path}.timingOrContext`,
  );

  return {
    type: nonEmptyString(source.type, `${path}.type`),
    value: measurementValue,
    ...(unit === undefined ? {} : { unit }),
    ...(timingOrContext === undefined ? {} : { timingOrContext }),
  };
}

function parseBiomedicalDatum(
  value: unknown,
  path: string,
): PatientDatum<BiomedicalDatumValue> {
  return parsePatientDatum(value, path, parseBiomedicalValue);
}

function parsePublicProfile(value: unknown): StudentPublicView {
  const source = asRecord(value, 'publicProfile');
  const edad = source.edad;
  if (
    typeof edad !== 'number' ||
    !Number.isFinite(edad) ||
    !Number.isInteger(edad) ||
    edad < 0
  ) {
    fail('publicProfile.edad', 'must be a finite non-negative integer');
  }

  return {
    nombre: nonEmptyString(source.nombre, 'publicProfile.nombre'),
    edad,
    sexo: nonEmptyString(source.sexo, 'publicProfile.sexo'),
    tratamiento: nonEmptyString(
      source.tratamiento,
      'publicProfile.tratamiento',
    ),
  };
}

function parseEncounter(value: unknown): PatientEncounterDraftV2 {
  const source = asRecord(value, 'encounter');
  return {
    personPresent: parseControlledDatum(
      source.personPresent,
      ENCOUNTER_PERSON_ROLES,
      'encounter.personPresent',
    ) as PatientDatum<EncounterPersonRole>,
    relationshipToPatient: parseStringDatum(
      source.relationshipToPatient,
      'encounter.relationshipToPatient',
    ),
  };
}

function parseDatumArray(value: unknown, path: string): PatientDatum<string>[] {
  return asArray(value, path).map((item, index) =>
    parseStringDatum(item, `${path}[${index}]`),
  );
}

function parseClinicalContext(value: unknown): PatientClinicalContextDraftV2 {
  const source = asRecord(value, 'clinicalContext');
  return {
    healthProblems: parseDatumArray(
      source.healthProblems,
      'clinicalContext.healthProblems',
    ),
    clinicalHistory: parseDatumArray(
      source.clinicalHistory,
      'clinicalContext.clinicalHistory',
    ),
    physiologicalSituation: parseDatumArray(
      source.physiologicalSituation,
      'clinicalContext.physiologicalSituation',
    ),
    pregnancyAndLactation: parseStringDatum(
      source.pregnancyAndLactation,
      'clinicalContext.pregnancyAndLactation',
    ),
    allergiesAndIntolerances: parseDatumArray(
      source.allergiesAndIntolerances,
      'clinicalContext.allergiesAndIntolerances',
    ),
    lifestyle: parseDatumArray(
      source.lifestyle,
      'clinicalContext.lifestyle',
    ),
    biomedicalData: asArray(
      source.biomedicalData,
      'clinicalContext.biomedicalData',
    ).map((item, index) =>
      parseBiomedicalDatum(item, `clinicalContext.biomedicalData[${index}]`),
    ),
  };
}

function parseSymptom(value: unknown, index: number): PatientSymptomDraftV2 {
  const path = `symptoms[${index}]`;
  const source = asRecord(value, path);
  return {
    description: parseStringDatum(source.description, `${path}.description`),
    onset: parseStringDatum(source.onset, `${path}.onset`),
    duration: parseStringDatum(source.duration, `${path}.duration`),
    evolution: parseStringDatum(source.evolution, `${path}.evolution`),
    relevantCircumstances: parseDatumArray(
      source.relevantCircumstances,
      `${path}.relevantCircumstances`,
    ),
  };
}

function parseCommunicationProfile(value: unknown): PatientCommunicationProfile {
  const source = asRecord(value, 'communicationProfile');
  for (const key of Object.keys(source)) {
    if (FORBIDDEN_COMMUNICATION_KEYS.has(key)) {
      fail(
        `communicationProfile.${key}`,
        'academic classifications are forbidden in communication profile',
      );
    }
  }

  return {
    sociability: parseScale(source.sociability, 'communicationProfile.sociability'),
    cooperation: parseScale(source.cooperation, 'communicationProfile.cooperation'),
    organization: parseScale(source.organization, 'communicationProfile.organization'),
    emotionalReactivity: parseScale(
      source.emotionalReactivity,
      'communicationProfile.emotionalReactivity',
    ),
    opennessToChange: parseScale(
      source.opennessToChange,
      'communicationProfile.opennessToChange',
    ),
    healthLiteracy: controlledValue(
      source.healthLiteracy,
      ['low', 'medium', 'high'] as const,
      'communicationProfile.healthLiteracy',
    ),
    professionalTrust: parseScale(
      source.professionalTrust,
      'communicationProfile.professionalTrust',
    ),
    medicationAttitude: controlledValue(
      source.medicationAttitude,
      MEDICATION_ATTITUDES,
      'communicationProfile.medicationAttitude',
    ),
    decisionStyle: controlledValue(
      source.decisionStyle,
      DECISION_STYLES,
      'communicationProfile.decisionStyle',
    ),
    readinessToChange: parseScale(
      source.readinessToChange,
      'communicationProfile.readinessToChange',
    ),
    socialDesirability: parseScale(
      source.socialDesirability,
      'communicationProfile.socialDesirability',
    ),
    judgmentSensitivity: parseScale(
      source.judgmentSensitivity,
      'communicationProfile.judgmentSensitivity',
    ),
    disclosureThreshold: parseScale(
      source.disclosureThreshold,
      'communicationProfile.disclosureThreshold',
    ),
    answerLength: controlledValue(
      source.answerLength,
      ['brief', 'medium', 'long'] as const,
      'communicationProfile.answerLength',
    ),
    assertiveness: parseScale(
      source.assertiveness,
      'communicationProfile.assertiveness',
    ),
    emotionalExpression: parseScale(
      source.emotionalExpression,
      'communicationProfile.emotionalExpression',
    ),
  };
}

function parseMedication(
  value: unknown,
  path: string,
): PatientMedicationDraftV2 {
  const source = asRecord(value, path);
  return {
    medicationId: opaqueId(
      source.medicationId,
      'med',
      `${path}.medicationId`,
    ),
    displayName: parseStringDatum(source.displayName, `${path}.displayName`),
    origin: parseControlledDatum(
      source.origin,
      MEDICATION_ORIGINS,
      `${path}.origin`,
    ) as PatientDatum<MedicationOrigin>,
    purposeAsUnderstood: parseStringDatum(
      source.purposeAsUnderstood,
      `${path}.purposeAsUnderstood`,
    ),
    regimenBasis: parseControlledDatum(
      source.regimenBasis,
      MEDICATION_REGIMEN_BASES,
      `${path}.regimenBasis`,
    ) as PatientDatum<MedicationRegimenBasis>,
    referenceDose: parseStringDatum(
      source.referenceDose,
      `${path}.referenceDose`,
    ),
    referenceSchedule: parseStringDatum(
      source.referenceSchedule,
      `${path}.referenceSchedule`,
    ),
    referenceDuration: parseStringDatum(
      source.referenceDuration,
      `${path}.referenceDuration`,
    ),
    administrationMethod: parseStringDatum(
      source.administrationMethod,
      `${path}.administrationMethod`,
    ),
    specialUseConditions: parseDatumArray(
      source.specialUseConditions,
      `${path}.specialUseConditions`,
    ),
  };
}

function parseMedicationUse(
  value: unknown,
  index: number,
): MedicationUsePatternDraftV2 {
  const path = `pharmacotherapy.actualMedicationUse[${index}]`;
  const source = asRecord(value, path);
  return {
    useId: opaqueId(source.useId, 'use', `${path}.useId`),
    medicationRef: opaqueId(
      source.medicationRef,
      'med',
      `${path}.medicationRef`,
    ),
    action: controlledValue(
      source.action,
      MEDICATION_USE_ACTIONS,
      `${path}.action`,
    ) as MedicationUseAction,
    actualUse: parseStringDatum(source.actualUse, `${path}.actualUse`),
    actualDose: parseStringDatum(source.actualDose, `${path}.actualDose`),
    actualSchedule: parseStringDatum(
      source.actualSchedule,
      `${path}.actualSchedule`,
    ),
    frequency: parseStringDatum(source.frequency, `${path}.frequency`),
    timePeriod: parseStringDatum(source.timePeriod, `${path}.timePeriod`),
    circumstanceFactRefs: factIdArray(
      source.circumstanceFactRefs,
      `${path}.circumstanceFactRefs`,
    ),
    statedReasonFactRefs: factIdArray(
      source.statedReasonFactRefs,
      `${path}.statedReasonFactRefs`,
    ),
    perceivedEffectFactRefs: factIdArray(
      source.perceivedEffectFactRefs,
      `${path}.perceivedEffectFactRefs`,
    ),
    practicalDifficultyFactRefs: factIdArray(
      source.practicalDifficultyFactRefs,
      `${path}.practicalDifficultyFactRefs`,
    ),
    strategyTriedFactRefs: factIdArray(
      source.strategyTriedFactRefs,
      `${path}.strategyTriedFactRefs`,
    ),
  };
}

function parseMedicationLinkedFact(
  value: unknown,
  path: string,
): MedicationLinkedFactDraftV2 {
  const source = asRecord(value, path);
  return {
    medicationRef: opaqueId(
      source.medicationRef,
      'med',
      `${path}.medicationRef`,
    ),
    detail: parseStringDatum(source.detail, `${path}.detail`),
  };
}

function parsePharmacotherapy(value: unknown): PatientPharmacotherapyDraftV2 {
  const source = asRecord(value, 'pharmacotherapy');
  return {
    prescribedMedications: asArray(
      source.prescribedMedications,
      'pharmacotherapy.prescribedMedications',
    ).map((item, index) =>
      parseMedication(item, `pharmacotherapy.prescribedMedications[${index}]`),
    ),
    otherMedicinesAndProducts: asArray(
      source.otherMedicinesAndProducts,
      'pharmacotherapy.otherMedicinesAndProducts',
    ).map((item, index) =>
      parseMedication(
        item,
        `pharmacotherapy.otherMedicinesAndProducts[${index}]`,
      ),
    ),
    actualMedicationUse: asArray(
      source.actualMedicationUse,
      'pharmacotherapy.actualMedicationUse',
    ).map(parseMedicationUse),
    recentChanges: asArray(
      source.recentChanges,
      'pharmacotherapy.recentChanges',
    ).map((item, index) =>
      parseMedicationLinkedFact(
        item,
        `pharmacotherapy.recentChanges[${index}]`,
      ),
    ),
    perceivedEffectiveness: asArray(
      source.perceivedEffectiveness,
      'pharmacotherapy.perceivedEffectiveness',
    ).map((item, index) =>
      parseMedicationLinkedFact(
        item,
        `pharmacotherapy.perceivedEffectiveness[${index}]`,
      ),
    ),
    perceivedSafety: asArray(
      source.perceivedSafety,
      'pharmacotherapy.perceivedSafety',
    ).map((item, index) =>
      parseMedicationLinkedFact(
        item,
        `pharmacotherapy.perceivedSafety[${index}]`,
      ),
    ),
  };
}

function definedFactId(datum: PatientDatum<unknown>): FactId | undefined {
  return datum.state === 'known' ||
    datum.state === 'explicit_absence' ||
    datum.state === 'patient_unknown'
    ? datum.factId
    : undefined;
}

function validateIdentifiersAndReferences(draft: CasePatientFactsDraftV2): void {
  const facts: Array<{ datum: PatientDatum<unknown>; path: string }> = [];
  const addDatum = <T>(datum: PatientDatum<T>, path: string) => {
    facts.push({ datum: datum as PatientDatum<unknown>, path });
  };
  const addDatumArray = <T>(values: PatientDatum<T>[], path: string) => {
    values.forEach((datum, index) => addDatum(datum, `${path}[${index}]`));
  };

  addDatum(draft.initialDemand, 'initialDemand');
  addDatum(draft.encounter.personPresent, 'encounter.personPresent');
  addDatum(
    draft.encounter.relationshipToPatient,
    'encounter.relationshipToPatient',
  );

  addDatumArray(
    draft.clinicalContext.healthProblems,
    'clinicalContext.healthProblems',
  );
  addDatumArray(
    draft.clinicalContext.clinicalHistory,
    'clinicalContext.clinicalHistory',
  );
  addDatumArray(
    draft.clinicalContext.physiologicalSituation,
    'clinicalContext.physiologicalSituation',
  );
  addDatum(
    draft.clinicalContext.pregnancyAndLactation,
    'clinicalContext.pregnancyAndLactation',
  );
  addDatumArray(
    draft.clinicalContext.allergiesAndIntolerances,
    'clinicalContext.allergiesAndIntolerances',
  );
  addDatumArray(
    draft.clinicalContext.lifestyle,
    'clinicalContext.lifestyle',
  );
  addDatumArray(
    draft.clinicalContext.biomedicalData,
    'clinicalContext.biomedicalData',
  );

  draft.symptoms.forEach((symptom, index) => {
    const path = `symptoms[${index}]`;
    addDatum(symptom.description, `${path}.description`);
    addDatum(symptom.onset, `${path}.onset`);
    addDatum(symptom.duration, `${path}.duration`);
    addDatum(symptom.evolution, `${path}.evolution`);
    addDatumArray(
      symptom.relevantCircumstances,
      `${path}.relevantCircumstances`,
    );
  });

  const medications = [
    ...draft.pharmacotherapy.prescribedMedications.map((medication, index) => ({
      medication,
      path: `pharmacotherapy.prescribedMedications[${index}]`,
    })),
    ...draft.pharmacotherapy.otherMedicinesAndProducts.map(
      (medication, index) => ({
        medication,
        path: `pharmacotherapy.otherMedicinesAndProducts[${index}]`,
      }),
    ),
  ];

  medications.forEach(({ medication, path }) => {
    addDatum(medication.displayName, `${path}.displayName`);
    addDatum(medication.origin, `${path}.origin`);
    addDatum(medication.purposeAsUnderstood, `${path}.purposeAsUnderstood`);
    addDatum(medication.regimenBasis, `${path}.regimenBasis`);
    addDatum(medication.referenceDose, `${path}.referenceDose`);
    addDatum(medication.referenceSchedule, `${path}.referenceSchedule`);
    addDatum(medication.referenceDuration, `${path}.referenceDuration`);
    addDatum(medication.administrationMethod, `${path}.administrationMethod`);
    addDatumArray(
      medication.specialUseConditions,
      `${path}.specialUseConditions`,
    );
  });

  draft.pharmacotherapy.actualMedicationUse.forEach((use, index) => {
    const path = `pharmacotherapy.actualMedicationUse[${index}]`;
    addDatum(use.actualUse, `${path}.actualUse`);
    addDatum(use.actualDose, `${path}.actualDose`);
    addDatum(use.actualSchedule, `${path}.actualSchedule`);
    addDatum(use.frequency, `${path}.frequency`);
    addDatum(use.timePeriod, `${path}.timePeriod`);
  });

  const addMedicationLinkedFacts = (
    values: MedicationLinkedFactDraftV2[],
    path: string,
  ) => {
    values.forEach((value, index) =>
      addDatum(value.detail, `${path}[${index}].detail`),
    );
  };
  addMedicationLinkedFacts(
    draft.pharmacotherapy.recentChanges,
    'pharmacotherapy.recentChanges',
  );
  addMedicationLinkedFacts(
    draft.pharmacotherapy.perceivedEffectiveness,
    'pharmacotherapy.perceivedEffectiveness',
  );
  addMedicationLinkedFacts(
    draft.pharmacotherapy.perceivedSafety,
    'pharmacotherapy.perceivedSafety',
  );

  addDatumArray(draft.actionsAlreadyTaken, 'actionsAlreadyTaken');
  addDatumArray(draft.practicalDifficulties, 'practicalDifficulties');
  addDatumArray(draft.beliefsAndConcerns, 'beliefsAndConcerns');
  addDatumArray(draft.strategiesAlreadyTried, 'strategiesAlreadyTried');
  addDatumArray(draft.dailyAndSocialContext, 'dailyAndSocialContext');
  addDatumArray(draft.familyAndSocialSupport, 'familyAndSocialSupport');
  addDatumArray(
    draft.relationshipWithProfessionals,
    'relationshipWithProfessionals',
  );

  const factIds = new Set<FactId>();
  for (const fact of facts) {
    const factId = definedFactId(fact.datum);
    if (factId === undefined) continue;
    if (factIds.has(factId)) {
      fail(`${fact.path}.factId`, `duplicate fact ID: ${factId}`);
    }
    factIds.add(factId);
  }

  const medicationIds = new Set<MedicationId>();
  medications.forEach(({ medication, path }) => {
    if (medicationIds.has(medication.medicationId)) {
      fail(
        `${path}.medicationId`,
        `duplicate medication ID: ${medication.medicationId}`,
      );
    }
    medicationIds.add(medication.medicationId);
  });

  const assertMedicationRef = (reference: MedicationId, path: string) => {
    if (!medicationIds.has(reference)) {
      fail(path, `unknown medication reference: ${reference}`);
    }
  };

  const assertFactRefs = (references: FactId[], path: string) => {
    references.forEach((reference, index) => {
      if (!factIds.has(reference)) {
        fail(`${path}[${index}]`, `unknown fact reference: ${reference}`);
      }
    });
  };

  const useIds = new Set<MedicationUseId>();
  draft.pharmacotherapy.actualMedicationUse.forEach((use, index) => {
    const path = `pharmacotherapy.actualMedicationUse[${index}]`;
    if (useIds.has(use.useId)) {
      fail(`${path}.useId`, `duplicate use ID: ${use.useId}`);
    }
    useIds.add(use.useId);
    assertMedicationRef(use.medicationRef, `${path}.medicationRef`);

    const referenceGroups = [
      ['circumstanceFactRefs', use.circumstanceFactRefs],
      ['statedReasonFactRefs', use.statedReasonFactRefs],
      ['perceivedEffectFactRefs', use.perceivedEffectFactRefs],
      ['practicalDifficultyFactRefs', use.practicalDifficultyFactRefs],
      ['strategyTriedFactRefs', use.strategyTriedFactRefs],
    ] as const;
    referenceGroups.forEach(([field, references]) =>
      assertFactRefs(references, `${path}.${field}`),
    );
  });

  const validateMedicationLinkedRefs = (
    values: MedicationLinkedFactDraftV2[],
    path: string,
  ) => {
    values.forEach((value, index) =>
      assertMedicationRef(value.medicationRef, `${path}[${index}].medicationRef`),
    );
  };
  validateMedicationLinkedRefs(
    draft.pharmacotherapy.recentChanges,
    'pharmacotherapy.recentChanges',
  );
  validateMedicationLinkedRefs(
    draft.pharmacotherapy.perceivedEffectiveness,
    'pharmacotherapy.perceivedEffectiveness',
  );
  validateMedicationLinkedRefs(
    draft.pharmacotherapy.perceivedSafety,
    'pharmacotherapy.perceivedSafety',
  );
}

export function validateCasePatientFactsDraftV2(
  input: unknown,
): CasePatientFactsDraftV2 {
  const source = asRecord(input, 'casePatientFactsDraft');
  if (source.schemaVersion !== '2.0') {
    fail('schemaVersion', 'must be 2.0');
  }

  const draft: CasePatientFactsDraftV2 = {
    schemaVersion: '2.0',
    publicProfile: parsePublicProfile(source.publicProfile),
    initialDemand: parseStringDatum(source.initialDemand, 'initialDemand'),
    encounter: parseEncounter(source.encounter),
    clinicalContext: parseClinicalContext(source.clinicalContext),
    symptoms: asArray(source.symptoms, 'symptoms').map(parseSymptom),
    pharmacotherapy: parsePharmacotherapy(source.pharmacotherapy),
    actionsAlreadyTaken: parseDatumArray(
      source.actionsAlreadyTaken,
      'actionsAlreadyTaken',
    ),
    practicalDifficulties: parseDatumArray(
      source.practicalDifficulties,
      'practicalDifficulties',
    ),
    beliefsAndConcerns: parseDatumArray(
      source.beliefsAndConcerns,
      'beliefsAndConcerns',
    ),
    strategiesAlreadyTried: parseDatumArray(
      source.strategiesAlreadyTried,
      'strategiesAlreadyTried',
    ),
    dailyAndSocialContext: parseDatumArray(
      source.dailyAndSocialContext,
      'dailyAndSocialContext',
    ),
    familyAndSocialSupport: parseDatumArray(
      source.familyAndSocialSupport,
      'familyAndSocialSupport',
    ),
    relationshipWithProfessionals: parseDatumArray(
      source.relationshipWithProfessionals,
      'relationshipWithProfessionals',
    ),
    communicationProfile: parseCommunicationProfile(
      source.communicationProfile,
    ),
  };

  validateIdentifiersAndReferences(draft);
  return draft;
}
