import type {
  CasePatientFactsDraftV2,
  DisclosureDelay,
  DisclosureDomain,
  DisclosureRule,
  FactId,
  MedicationId,
  MedicationUseAction,
  MedicationUseId,
  MedicationUsePatternDraftV2,
  PatientCommunicationProfile,
  PatientDatum,
  PatientMedicationDraftV2,
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
  'health_problems',
  'symptoms',
  'medication_knowledge',
  'medication_use',
  'practical_difficulties',
  'beliefs_and_concerns',
  'perceived_experiences',
  'daily_context',
  'social_context',
] as const;

const DISCLOSURE_DELAYS = [
  'judgmental_tone',
  'accusatory_question',
  'lack_of_empathy',
  'patient_minimization',
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
  if (!Number.isInteger(value) || typeof value !== 'number' || value < 1 || value > 5) {
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

function parseStringDatum(value: unknown, path: string): PatientDatum<string> {
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
      value: nonEmptyString(source.value, `${path}.value`),
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
  index: number,
): PatientMedicationDraftV2 {
  const path = `medications[${index}]`;
  const source = asRecord(value, path);
  return {
    medicationId: opaqueId(
      source.medicationId,
      'med',
      `${path}.medicationId`,
    ),
    displayName: parseStringDatum(source.displayName, `${path}.displayName`),
    prescribedUse: parseStringDatum(
      source.prescribedUse,
      `${path}.prescribedUse`,
    ),
    purposeAsUnderstood: parseStringDatum(
      source.purposeAsUnderstood,
      `${path}.purposeAsUnderstood`,
    ),
  };
}

function parseMedicationUse(
  value: unknown,
  index: number,
): MedicationUsePatternDraftV2 {
  const path = `medicationUse[${index}]`;
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
  };
}

function parseDatumArray(value: unknown, path: string): PatientDatum<string>[] {
  return asArray(value, path).map((item, index) =>
    parseStringDatum(item, `${path}[${index}]`),
  );
}

function definedFactId(datum: PatientDatum<string>): FactId | undefined {
  return datum.state === 'known' ||
    datum.state === 'explicit_absence' ||
    datum.state === 'patient_unknown'
    ? datum.factId
    : undefined;
}

function validateIdentifiersAndReferences(draft: CasePatientFactsDraftV2): void {
  const facts: Array<{ datum: PatientDatum<string>; path: string }> = [
    { datum: draft.initialDemand, path: 'initialDemand' },
  ];

  const appendDatumArray = (
    values: PatientDatum<string>[],
    path: string,
  ) => {
    values.forEach((datum, index) =>
      facts.push({ datum, path: `${path}[${index}]` }),
    );
  };

  appendDatumArray(draft.knownHealthProblems, 'knownHealthProblems');
  appendDatumArray(draft.symptoms, 'symptoms');
  appendDatumArray(draft.practicalDifficulties, 'practicalDifficulties');
  appendDatumArray(draft.beliefsAndConcerns, 'beliefsAndConcerns');
  appendDatumArray(draft.perceivedExperiences, 'perceivedExperiences');
  appendDatumArray(draft.dailyAndSocialContext, 'dailyAndSocialContext');

  draft.medications.forEach((medication, index) => {
    facts.push(
      { datum: medication.displayName, path: `medications[${index}].displayName` },
      {
        datum: medication.prescribedUse,
        path: `medications[${index}].prescribedUse`,
      },
      {
        datum: medication.purposeAsUnderstood,
        path: `medications[${index}].purposeAsUnderstood`,
      },
    );
  });

  draft.medicationUse.forEach((use, index) => {
    facts.push({ datum: use.actualUse, path: `medicationUse[${index}].actualUse` });
  });

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
  draft.medications.forEach((medication, index) => {
    if (medicationIds.has(medication.medicationId)) {
      fail(
        `medications[${index}].medicationId`,
        `duplicate medication ID: ${medication.medicationId}`,
      );
    }
    medicationIds.add(medication.medicationId);
  });

  const useIds = new Set<MedicationUseId>();
  draft.medicationUse.forEach((use, index) => {
    if (useIds.has(use.useId)) {
      fail(`medicationUse[${index}].useId`, `duplicate use ID: ${use.useId}`);
    }
    useIds.add(use.useId);

    if (!medicationIds.has(use.medicationRef)) {
      fail(
        `medicationUse[${index}].medicationRef`,
        `unknown medication reference: ${use.medicationRef}`,
      );
    }

    const referenceGroups = [
      ['circumstanceFactRefs', use.circumstanceFactRefs],
      ['statedReasonFactRefs', use.statedReasonFactRefs],
      ['perceivedEffectFactRefs', use.perceivedEffectFactRefs],
      ['practicalDifficultyFactRefs', use.practicalDifficultyFactRefs],
    ] as const;

    for (const [field, references] of referenceGroups) {
      references.forEach((reference, referenceIndex) => {
        if (!factIds.has(reference)) {
          fail(
            `medicationUse[${index}].${field}[${referenceIndex}]`,
            `unknown fact reference: ${reference}`,
          );
        }
      });
    }
  });
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
    knownHealthProblems: parseDatumArray(
      source.knownHealthProblems,
      'knownHealthProblems',
    ),
    symptoms: parseDatumArray(source.symptoms, 'symptoms'),
    medications: asArray(source.medications, 'medications').map(parseMedication),
    medicationUse: asArray(source.medicationUse, 'medicationUse').map(
      parseMedicationUse,
    ),
    practicalDifficulties: parseDatumArray(
      source.practicalDifficulties,
      'practicalDifficulties',
    ),
    beliefsAndConcerns: parseDatumArray(
      source.beliefsAndConcerns,
      'beliefsAndConcerns',
    ),
    perceivedExperiences: parseDatumArray(
      source.perceivedExperiences,
      'perceivedExperiences',
    ),
    dailyAndSocialContext: parseDatumArray(
      source.dailyAndSocialContext,
      'dailyAndSocialContext',
    ),
    communicationProfile: parseCommunicationProfile(
      source.communicationProfile,
    ),
  };

  validateIdentifiersAndReferences(draft);
  return draft;
}
