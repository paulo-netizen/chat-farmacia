import type {
  GeneratedSessionPatientClinicalContentV2,
  LegacySessionPatientClinicalContentV2,
  SessionPatientClinicalContentV2,
} from './session-clinical-content-types';
import type {
  ValidatedPatientResponseTextV2,
} from './patient-response-safety-types';
import type {
  BiomedicalDatumValue,
  DisclosureDelay,
  DisclosureDomain,
  DisclosureRule,
  MedicationOrigin,
  MedicationRegimenBasis,
  MedicationUseAction,
  PatientCommunicationProfile,
  PatientRuntimeViewV2,
  RuntimeMedicationLinkedFactV2,
  RuntimeMedicationUsePatternV2,
  RuntimePatientDatum,
  RuntimePatientMedicationV2,
  RuntimePatientSymptomV2,
  StudentPublicView,
} from './types';

export const PATIENT_RESPONSE_VALIDATOR_CONTRACT_VERSION_V2 = '1.0' as const;
export const PATIENT_RESPONSE_SAFETY_POLICY_VERSION_V2 = '1.0' as const;

export type PatientResponseValidationDisclosureRuleV2 = Readonly<{
  mode: DisclosureRule['mode'];
  domains?: readonly DisclosureDomain[];
  minimumRapport?: number;
  delayedBy?: readonly DisclosureDelay[];
}>;

export type PatientResponseValidationDatumV2<T> =
  | Readonly<{
      state: 'known';
      value: T;
      certainty: 'exact' | 'approximate' | 'uncertain';
      disclosure: PatientResponseValidationDisclosureRuleV2;
    }>
  | Readonly<{
      state: 'explicit_absence' | 'patient_unknown';
      topic: string;
      disclosure: PatientResponseValidationDisclosureRuleV2;
    }>;

export type PatientResponseValidationBiomedicalValueV2 = Readonly<{
  type: string;
  value: string | number;
  unit?: string;
  timingOrContext?: string;
}>;

export type PatientResponseValidationFactValueV2 =
  | string
  | number
  | PatientResponseValidationBiomedicalValueV2;

export type PatientResponseValidationMedicationV2 = Readonly<{
  displayName: PatientResponseValidationDatumV2<string>;
  origin: PatientResponseValidationDatumV2<MedicationOrigin>;
  purposeAsUnderstood?: PatientResponseValidationDatumV2<string>;
  regimenBasis?: PatientResponseValidationDatumV2<MedicationRegimenBasis>;
  referenceDose?: PatientResponseValidationDatumV2<string>;
  referenceSchedule?: PatientResponseValidationDatumV2<string>;
  referenceDuration?: PatientResponseValidationDatumV2<string>;
  administrationMethod?: PatientResponseValidationDatumV2<string>;
  specialUseConditions: readonly PatientResponseValidationDatumV2<string>[];
}>;

export type PatientResponseValidationMedicationUseV2 = Readonly<{
  medication: PatientResponseValidationMedicationV2;
  action: MedicationUseAction;
  actualUse: PatientResponseValidationDatumV2<string>;
  actualDose?: PatientResponseValidationDatumV2<string>;
  actualSchedule?: PatientResponseValidationDatumV2<string>;
  frequency?: PatientResponseValidationDatumV2<string>;
  timePeriod?: PatientResponseValidationDatumV2<string>;
  circumstances: readonly PatientResponseValidationDatumV2<PatientResponseValidationFactValueV2>[];
  statedReasons: readonly PatientResponseValidationDatumV2<PatientResponseValidationFactValueV2>[];
  perceivedEffects: readonly PatientResponseValidationDatumV2<PatientResponseValidationFactValueV2>[];
  practicalDifficulties: readonly PatientResponseValidationDatumV2<PatientResponseValidationFactValueV2>[];
  strategiesTried: readonly PatientResponseValidationDatumV2<PatientResponseValidationFactValueV2>[];
}>;

export type PatientResponseValidationMedicationLinkedFactV2 = Readonly<{
  medication: PatientResponseValidationMedicationV2;
  detail: PatientResponseValidationDatumV2<string>;
}>;

export type PatientResponseValidationSymptomV2 = Readonly<{
  description: PatientResponseValidationDatumV2<string>;
  onset?: PatientResponseValidationDatumV2<string>;
  duration?: PatientResponseValidationDatumV2<string>;
  evolution?: PatientResponseValidationDatumV2<string>;
  relevantCircumstances: readonly PatientResponseValidationDatumV2<string>[];
}>;

export type LegacyPatientResponseValidationContextV2 = Readonly<{
  contentFormat: 'LEGACY_V1_SNAPSHOT';
  patientData: Readonly<{
    nombre: string;
    edad: number;
    sexo: string;
    tratamiento: string;
    motivo_consulta?: string;
    antecedentes?: string;
    contexto?: string;
    descripcion_paciente?: string;
    personalidad_paciente?: string;
  }>;
  serviceContext: Readonly<{ serviceType: string }>;
}>;

export type GeneratedPatientResponseValidationContextV2 = Readonly<{
  contentFormat: 'GENERATED_CASE_BUNDLE_V2';
  patientData: Readonly<{
    schemaVersion: '2.0';
    publicProfile: StudentPublicView;
    initialDemand: PatientResponseValidationDatumV2<string>;
    encounter: Readonly<{
      personPresent: PatientResponseValidationDatumV2<string>;
      relationshipToPatient?: PatientResponseValidationDatumV2<string>;
    }>;
    clinicalContext: Readonly<{
      healthProblems: readonly PatientResponseValidationDatumV2<string>[];
      clinicalHistory: readonly PatientResponseValidationDatumV2<string>[];
      physiologicalSituation: readonly PatientResponseValidationDatumV2<string>[];
      pregnancyAndLactation?: PatientResponseValidationDatumV2<string>;
      allergiesAndIntolerances: readonly PatientResponseValidationDatumV2<string>[];
      lifestyle: readonly PatientResponseValidationDatumV2<string>[];
      biomedicalData: readonly PatientResponseValidationDatumV2<PatientResponseValidationBiomedicalValueV2>[];
    }>;
    symptoms: readonly PatientResponseValidationSymptomV2[];
    pharmacotherapy: Readonly<{
      prescribedMedications: readonly PatientResponseValidationMedicationV2[];
      otherMedicinesAndProducts: readonly PatientResponseValidationMedicationV2[];
      actualMedicationUse: readonly PatientResponseValidationMedicationUseV2[];
      recentChanges: readonly PatientResponseValidationMedicationLinkedFactV2[];
      perceivedEffectiveness: readonly PatientResponseValidationMedicationLinkedFactV2[];
      perceivedSafety: readonly PatientResponseValidationMedicationLinkedFactV2[];
    }>;
    actionsAlreadyTaken: readonly PatientResponseValidationDatumV2<string>[];
    practicalDifficulties: readonly PatientResponseValidationDatumV2<string>[];
    beliefsAndConcerns: readonly PatientResponseValidationDatumV2<string>[];
    strategiesAlreadyTried: readonly PatientResponseValidationDatumV2<string>[];
    dailyAndSocialContext: readonly PatientResponseValidationDatumV2<string>[];
    familyAndSocialSupport: readonly PatientResponseValidationDatumV2<string>[];
    relationshipWithProfessionals: readonly PatientResponseValidationDatumV2<string>[];
    communicationProfile: PatientCommunicationProfile;
  }>;
  serviceContext: GeneratedSessionPatientClinicalContentV2['serviceContext'];
}>;

export type PatientResponseValidationContextV2 =
  | LegacyPatientResponseValidationContextV2
  | GeneratedPatientResponseValidationContextV2;

export type PatientResponseAcceptedConversationMessageV2 = Readonly<{
  role: 'student' | 'patient';
  content: string;
}>;

export type PatientResponseValidationRequestV2 = Readonly<{
  contractVersion: typeof PATIENT_RESPONSE_VALIDATOR_CONTRACT_VERSION_V2;
  safetyPolicyVersion: typeof PATIENT_RESPONSE_SAFETY_POLICY_VERSION_V2;
  validationContext: PatientResponseValidationContextV2;
  acceptedConversation: readonly PatientResponseAcceptedConversationMessageV2[];
  currentStudentTurn: string;
  candidate: ValidatedPatientResponseTextV2;
}>;

export type PatientResponseValidationRequestInputV2 = Readonly<{
  clinicalContent: SessionPatientClinicalContentV2;
  acceptedConversation: readonly PatientResponseAcceptedConversationMessageV2[];
  currentStudentTurn: string;
  candidate: ValidatedPatientResponseTextV2;
}>;

export class PatientResponseValidationContextErrorV2 extends Error {
  constructor(public readonly path: string) {
    super(`invalid_patient_response_validation_context at ${path}`);
    this.name = 'PatientResponseValidationContextErrorV2';
  }
}

type SafeFactDatum = PatientResponseValidationDatumV2<PatientResponseValidationFactValueV2>;

function fail(path: string): never {
  throw new PatientResponseValidationContextErrorV2(path);
}

function copyString(value: unknown, path: string): string {
  if (typeof value !== 'string') fail(path);
  return value;
}

function copyNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(path);
  return value;
}

function copyDisclosure(
  disclosure: DisclosureRule,
  path: string,
): PatientResponseValidationDisclosureRuleV2 {
  if (
    disclosure.mode !== 'spontaneous' &&
    disclosure.mode !== 'open_question' &&
    disclosure.mode !== 'domain_exploration' &&
    disclosure.mode !== 'specific_question' &&
    disclosure.mode !== 'rapport_required'
  ) {
    fail(`${path}.mode`);
  }
  return {
    mode: disclosure.mode,
    ...('domains' in disclosure
      ? { domains: disclosure.domains.map((domain) => domain) }
      : {}),
    ...('minimumRapport' in disclosure
      ? { minimumRapport: disclosure.minimumRapport }
      : {}),
    ...(disclosure.delayedBy === undefined
      ? {}
      : { delayedBy: disclosure.delayedBy.map((delay) => delay) }),
  };
}

function copyDatum<T, U>(
  datum: RuntimePatientDatum<T>,
  path: string,
  copyValue: (value: T, path: string) => U,
): PatientResponseValidationDatumV2<U> {
  const disclosure = copyDisclosure(datum.disclosure, `${path}.disclosure`);
  if (datum.state === 'known') {
    return {
      state: 'known',
      value: copyValue(datum.value, `${path}.value`),
      certainty: datum.certainty,
      disclosure,
    };
  }
  return {
    state: datum.state,
    topic: copyString(datum.topic, `${path}.topic`),
    disclosure,
  };
}

function copyStringDatum<T extends string>(
  datum: RuntimePatientDatum<T>,
  path: string,
): PatientResponseValidationDatumV2<T> {
  return copyDatum(datum, path, (value, valuePath) =>
    copyString(value, valuePath) as T,
  );
}

function copyBiomedicalValue(
  value: BiomedicalDatumValue,
  path: string,
): PatientResponseValidationBiomedicalValueV2 {
  return {
    type: copyString(value.type, `${path}.type`),
    value:
      typeof value.value === 'string'
        ? value.value
        : copyNumber(value.value, `${path}.value`),
    ...(value.unit === undefined
      ? {}
      : { unit: copyString(value.unit, `${path}.unit`) }),
    ...(value.timingOrContext === undefined
      ? {}
      : {
          timingOrContext: copyString(
            value.timingOrContext,
            `${path}.timingOrContext`,
          ),
        }),
  };
}

function copyBiomedicalDatum(
  datum: RuntimePatientDatum<BiomedicalDatumValue>,
  path: string,
) {
  return copyDatum(datum, path, copyBiomedicalValue);
}

function copyPublicProfile(profile: StudentPublicView): StudentPublicView {
  return {
    nombre: copyString(profile.nombre, 'patientData.publicProfile.nombre'),
    edad: copyNumber(profile.edad, 'patientData.publicProfile.edad'),
    sexo: copyString(profile.sexo, 'patientData.publicProfile.sexo'),
    tratamiento: copyString(
      profile.tratamiento,
      'patientData.publicProfile.tratamiento',
    ),
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

function addFact(
  index: Map<string, SafeFactDatum>,
  factId: string,
  datum: SafeFactDatum,
  path: string,
): void {
  if (index.has(factId)) fail(`${path}.factId`);
  index.set(factId, datum);
}

function buildFactIndex(runtime: PatientRuntimeViewV2): Map<string, SafeFactDatum> {
  const index = new Map<string, SafeFactDatum>();
  const addString = <T extends string>(datum: RuntimePatientDatum<T>, path: string) =>
    addFact(index, datum.factId, copyStringDatum(datum, path), path);
  const addStrings = <T extends string>(
    data: readonly RuntimePatientDatum<T>[],
    path: string,
  ) => data.forEach((datum, item) => addString(datum, `${path}[${item}]`));

  addString(runtime.initialDemand, 'patientData.initialDemand');
  addString(runtime.encounter.personPresent, 'patientData.encounter.personPresent');
  if (runtime.encounter.relationshipToPatient !== undefined) {
    addString(
      runtime.encounter.relationshipToPatient,
      'patientData.encounter.relationshipToPatient',
    );
  }
  addStrings(runtime.clinicalContext.healthProblems, 'patientData.clinicalContext.healthProblems');
  addStrings(runtime.clinicalContext.clinicalHistory, 'patientData.clinicalContext.clinicalHistory');
  addStrings(
    runtime.clinicalContext.physiologicalSituation,
    'patientData.clinicalContext.physiologicalSituation',
  );
  if (runtime.clinicalContext.pregnancyAndLactation !== undefined) {
    addString(
      runtime.clinicalContext.pregnancyAndLactation,
      'patientData.clinicalContext.pregnancyAndLactation',
    );
  }
  addStrings(
    runtime.clinicalContext.allergiesAndIntolerances,
    'patientData.clinicalContext.allergiesAndIntolerances',
  );
  addStrings(runtime.clinicalContext.lifestyle, 'patientData.clinicalContext.lifestyle');
  runtime.clinicalContext.biomedicalData.forEach((datum, item) => {
    const path = `patientData.clinicalContext.biomedicalData[${item}]`;
    addFact(index, datum.factId, copyBiomedicalDatum(datum, path), path);
  });

  const addSymptom = (symptom: RuntimePatientSymptomV2, path: string) => {
    addString(symptom.description, `${path}.description`);
    if (symptom.onset !== undefined) addString(symptom.onset, `${path}.onset`);
    if (symptom.duration !== undefined) addString(symptom.duration, `${path}.duration`);
    if (symptom.evolution !== undefined) addString(symptom.evolution, `${path}.evolution`);
    addStrings(symptom.relevantCircumstances, `${path}.relevantCircumstances`);
  };
  runtime.symptoms.forEach((symptom, item) =>
    addSymptom(symptom, `patientData.symptoms[${item}]`),
  );

  const addMedication = (medication: RuntimePatientMedicationV2, path: string) => {
    addString(medication.displayName, `${path}.displayName`);
    addString(medication.origin, `${path}.origin`);
    if (medication.purposeAsUnderstood !== undefined) {
      addString(medication.purposeAsUnderstood, `${path}.purposeAsUnderstood`);
    }
    if (medication.regimenBasis !== undefined) addString(medication.regimenBasis, `${path}.regimenBasis`);
    if (medication.referenceDose !== undefined) addString(medication.referenceDose, `${path}.referenceDose`);
    if (medication.referenceSchedule !== undefined) addString(medication.referenceSchedule, `${path}.referenceSchedule`);
    if (medication.referenceDuration !== undefined) addString(medication.referenceDuration, `${path}.referenceDuration`);
    if (medication.administrationMethod !== undefined) addString(medication.administrationMethod, `${path}.administrationMethod`);
    addStrings(medication.specialUseConditions, `${path}.specialUseConditions`);
  };
  runtime.pharmacotherapy.prescribedMedications.forEach((medication, item) =>
    addMedication(medication, `patientData.pharmacotherapy.prescribedMedications[${item}]`),
  );
  runtime.pharmacotherapy.otherMedicinesAndProducts.forEach((medication, item) =>
    addMedication(medication, `patientData.pharmacotherapy.otherMedicinesAndProducts[${item}]`),
  );

  const addUse = (use: RuntimeMedicationUsePatternV2, path: string) => {
    addString(use.actualUse, `${path}.actualUse`);
    if (use.actualDose !== undefined) addString(use.actualDose, `${path}.actualDose`);
    if (use.actualSchedule !== undefined) addString(use.actualSchedule, `${path}.actualSchedule`);
    if (use.frequency !== undefined) addString(use.frequency, `${path}.frequency`);
    if (use.timePeriod !== undefined) addString(use.timePeriod, `${path}.timePeriod`);
  };
  runtime.pharmacotherapy.actualMedicationUse.forEach((use, item) =>
    addUse(use, `patientData.pharmacotherapy.actualMedicationUse[${item}]`),
  );
  const addLinkedFacts = (
    values: readonly RuntimeMedicationLinkedFactV2[],
    path: string,
  ) => values.forEach((value, item) => addString(value.detail, `${path}[${item}].detail`));
  addLinkedFacts(runtime.pharmacotherapy.recentChanges, 'patientData.pharmacotherapy.recentChanges');
  addLinkedFacts(runtime.pharmacotherapy.perceivedEffectiveness, 'patientData.pharmacotherapy.perceivedEffectiveness');
  addLinkedFacts(runtime.pharmacotherapy.perceivedSafety, 'patientData.pharmacotherapy.perceivedSafety');

  addStrings(runtime.actionsAlreadyTaken, 'patientData.actionsAlreadyTaken');
  addStrings(runtime.practicalDifficulties, 'patientData.practicalDifficulties');
  addStrings(runtime.beliefsAndConcerns, 'patientData.beliefsAndConcerns');
  addStrings(runtime.strategiesAlreadyTried, 'patientData.strategiesAlreadyTried');
  addStrings(runtime.dailyAndSocialContext, 'patientData.dailyAndSocialContext');
  addStrings(runtime.familyAndSocialSupport, 'patientData.familyAndSocialSupport');
  addStrings(runtime.relationshipWithProfessionals, 'patientData.relationshipWithProfessionals');
  return index;
}

function copyMedication(
  medication: RuntimePatientMedicationV2,
  path: string,
): PatientResponseValidationMedicationV2 {
  return {
    displayName: copyStringDatum(medication.displayName, `${path}.displayName`),
    origin: copyStringDatum(medication.origin, `${path}.origin`),
    ...(medication.purposeAsUnderstood === undefined
      ? {}
      : { purposeAsUnderstood: copyStringDatum(medication.purposeAsUnderstood, `${path}.purposeAsUnderstood`) }),
    ...(medication.regimenBasis === undefined
      ? {}
      : { regimenBasis: copyStringDatum(medication.regimenBasis, `${path}.regimenBasis`) }),
    ...(medication.referenceDose === undefined
      ? {}
      : { referenceDose: copyStringDatum(medication.referenceDose, `${path}.referenceDose`) }),
    ...(medication.referenceSchedule === undefined
      ? {}
      : { referenceSchedule: copyStringDatum(medication.referenceSchedule, `${path}.referenceSchedule`) }),
    ...(medication.referenceDuration === undefined
      ? {}
      : { referenceDuration: copyStringDatum(medication.referenceDuration, `${path}.referenceDuration`) }),
    ...(medication.administrationMethod === undefined
      ? {}
      : { administrationMethod: copyStringDatum(medication.administrationMethod, `${path}.administrationMethod`) }),
    specialUseConditions: medication.specialUseConditions.map((datum, item) =>
      copyStringDatum(datum, `${path}.specialUseConditions[${item}]`),
    ),
  };
}

function buildMedicationIndex(
  runtime: PatientRuntimeViewV2,
): Map<string, PatientResponseValidationMedicationV2> {
  const index = new Map<string, PatientResponseValidationMedicationV2>();
  const add = (medication: RuntimePatientMedicationV2, path: string) => {
    if (index.has(medication.medicationId)) fail(`${path}.medicationId`);
    index.set(medication.medicationId, copyMedication(medication, path));
  };
  runtime.pharmacotherapy.prescribedMedications.forEach((medication, item) =>
    add(medication, `patientData.pharmacotherapy.prescribedMedications[${item}]`),
  );
  runtime.pharmacotherapy.otherMedicinesAndProducts.forEach((medication, item) =>
    add(medication, `patientData.pharmacotherapy.otherMedicinesAndProducts[${item}]`),
  );
  return index;
}

function resolveMedication(
  index: ReadonlyMap<string, PatientResponseValidationMedicationV2>,
  reference: string,
  path: string,
): PatientResponseValidationMedicationV2 {
  const medication = index.get(reference);
  if (medication === undefined) fail(path);
  return medication;
}

function resolveFacts(
  index: ReadonlyMap<string, SafeFactDatum>,
  references: readonly string[],
  path: string,
): SafeFactDatum[] {
  return references.map((reference, item) => {
    const datum = index.get(reference);
    if (datum === undefined) fail(`${path}[${item}]`);
    return datum;
  });
}

function copyMedicationUse(
  use: RuntimeMedicationUsePatternV2,
  path: string,
  medicationIndex: ReadonlyMap<string, PatientResponseValidationMedicationV2>,
  factIndex: ReadonlyMap<string, SafeFactDatum>,
): PatientResponseValidationMedicationUseV2 {
  return {
    medication: resolveMedication(medicationIndex, use.medicationRef, `${path}.medicationRef`),
    action: use.action,
    actualUse: copyStringDatum(use.actualUse, `${path}.actualUse`),
    ...(use.actualDose === undefined ? {} : { actualDose: copyStringDatum(use.actualDose, `${path}.actualDose`) }),
    ...(use.actualSchedule === undefined ? {} : { actualSchedule: copyStringDatum(use.actualSchedule, `${path}.actualSchedule`) }),
    ...(use.frequency === undefined ? {} : { frequency: copyStringDatum(use.frequency, `${path}.frequency`) }),
    ...(use.timePeriod === undefined ? {} : { timePeriod: copyStringDatum(use.timePeriod, `${path}.timePeriod`) }),
    circumstances: resolveFacts(factIndex, use.circumstanceFactRefs, `${path}.circumstanceFactRefs`),
    statedReasons: resolveFacts(factIndex, use.statedReasonFactRefs, `${path}.statedReasonFactRefs`),
    perceivedEffects: resolveFacts(factIndex, use.perceivedEffectFactRefs, `${path}.perceivedEffectFactRefs`),
    practicalDifficulties: resolveFacts(factIndex, use.practicalDifficultyFactRefs, `${path}.practicalDifficultyFactRefs`),
    strategiesTried: resolveFacts(factIndex, use.strategyTriedFactRefs, `${path}.strategyTriedFactRefs`),
  };
}

function copyMedicationLinkedFact(
  value: RuntimeMedicationLinkedFactV2,
  path: string,
  medicationIndex: ReadonlyMap<string, PatientResponseValidationMedicationV2>,
): PatientResponseValidationMedicationLinkedFactV2 {
  return {
    medication: resolveMedication(medicationIndex, value.medicationRef, `${path}.medicationRef`),
    detail: copyStringDatum(value.detail, `${path}.detail`),
  };
}

function copySymptom(
  symptom: RuntimePatientSymptomV2,
  path: string,
): PatientResponseValidationSymptomV2 {
  return {
    description: copyStringDatum(symptom.description, `${path}.description`),
    ...(symptom.onset === undefined ? {} : { onset: copyStringDatum(symptom.onset, `${path}.onset`) }),
    ...(symptom.duration === undefined ? {} : { duration: copyStringDatum(symptom.duration, `${path}.duration`) }),
    ...(symptom.evolution === undefined ? {} : { evolution: copyStringDatum(symptom.evolution, `${path}.evolution`) }),
    relevantCircumstances: symptom.relevantCircumstances.map((datum, item) =>
      copyStringDatum(datum, `${path}.relevantCircumstances[${item}]`),
    ),
  };
}

function copyLegacyContext(
  content: LegacySessionPatientClinicalContentV2,
): LegacyPatientResponseValidationContextV2 {
  const data = content.patientData;
  return {
    contentFormat: 'LEGACY_V1_SNAPSHOT',
    patientData: {
      nombre: data.nombre,
      edad: data.edad,
      sexo: data.sexo,
      tratamiento: data.tratamiento,
      ...(data.motivo_consulta === undefined ? {} : { motivo_consulta: data.motivo_consulta }),
      ...(data.antecedentes === undefined ? {} : { antecedentes: data.antecedentes }),
      ...(data.contexto === undefined ? {} : { contexto: data.contexto }),
      ...(data.descripcion_paciente === undefined ? {} : { descripcion_paciente: data.descripcion_paciente }),
      ...(data.personalidad_paciente === undefined ? {} : { personalidad_paciente: data.personalidad_paciente }),
    },
    serviceContext: { serviceType: content.serviceContext.serviceType },
  };
}

function copyGeneratedContext(
  content: GeneratedSessionPatientClinicalContentV2,
): GeneratedPatientResponseValidationContextV2 {
  const runtime = content.patientRuntime;
  const factIndex = buildFactIndex(runtime);
  const medicationIndex = buildMedicationIndex(runtime);
  const stringData = <T extends string>(data: readonly RuntimePatientDatum<T>[], path: string) =>
    data.map((datum, item) => copyStringDatum(datum, `${path}[${item}]`));

  return {
    contentFormat: 'GENERATED_CASE_BUNDLE_V2',
    patientData: {
      schemaVersion: '2.0',
      publicProfile: copyPublicProfile(runtime.publicProfile),
      initialDemand: copyStringDatum(runtime.initialDemand, 'patientData.initialDemand'),
      encounter: {
        personPresent: copyStringDatum(runtime.encounter.personPresent, 'patientData.encounter.personPresent'),
        ...(runtime.encounter.relationshipToPatient === undefined
          ? {}
          : { relationshipToPatient: copyStringDatum(runtime.encounter.relationshipToPatient, 'patientData.encounter.relationshipToPatient') }),
      },
      clinicalContext: {
        healthProblems: stringData(runtime.clinicalContext.healthProblems, 'patientData.clinicalContext.healthProblems'),
        clinicalHistory: stringData(runtime.clinicalContext.clinicalHistory, 'patientData.clinicalContext.clinicalHistory'),
        physiologicalSituation: stringData(runtime.clinicalContext.physiologicalSituation, 'patientData.clinicalContext.physiologicalSituation'),
        ...(runtime.clinicalContext.pregnancyAndLactation === undefined
          ? {}
          : { pregnancyAndLactation: copyStringDatum(runtime.clinicalContext.pregnancyAndLactation, 'patientData.clinicalContext.pregnancyAndLactation') }),
        allergiesAndIntolerances: stringData(runtime.clinicalContext.allergiesAndIntolerances, 'patientData.clinicalContext.allergiesAndIntolerances'),
        lifestyle: stringData(runtime.clinicalContext.lifestyle, 'patientData.clinicalContext.lifestyle'),
        biomedicalData: runtime.clinicalContext.biomedicalData.map((datum, item) =>
          copyBiomedicalDatum(datum, `patientData.clinicalContext.biomedicalData[${item}]`),
        ),
      },
      symptoms: runtime.symptoms.map((symptom, item) => copySymptom(symptom, `patientData.symptoms[${item}]`)),
      pharmacotherapy: {
        prescribedMedications: runtime.pharmacotherapy.prescribedMedications.map((medication, item) =>
          copyMedication(medication, `patientData.pharmacotherapy.prescribedMedications[${item}]`),
        ),
        otherMedicinesAndProducts: runtime.pharmacotherapy.otherMedicinesAndProducts.map((medication, item) =>
          copyMedication(medication, `patientData.pharmacotherapy.otherMedicinesAndProducts[${item}]`),
        ),
        actualMedicationUse: runtime.pharmacotherapy.actualMedicationUse.map((use, item) =>
          copyMedicationUse(use, `patientData.pharmacotherapy.actualMedicationUse[${item}]`, medicationIndex, factIndex),
        ),
        recentChanges: runtime.pharmacotherapy.recentChanges.map((value, item) =>
          copyMedicationLinkedFact(value, `patientData.pharmacotherapy.recentChanges[${item}]`, medicationIndex),
        ),
        perceivedEffectiveness: runtime.pharmacotherapy.perceivedEffectiveness.map((value, item) =>
          copyMedicationLinkedFact(value, `patientData.pharmacotherapy.perceivedEffectiveness[${item}]`, medicationIndex),
        ),
        perceivedSafety: runtime.pharmacotherapy.perceivedSafety.map((value, item) =>
          copyMedicationLinkedFact(value, `patientData.pharmacotherapy.perceivedSafety[${item}]`, medicationIndex),
        ),
      },
      actionsAlreadyTaken: stringData(runtime.actionsAlreadyTaken, 'patientData.actionsAlreadyTaken'),
      practicalDifficulties: stringData(runtime.practicalDifficulties, 'patientData.practicalDifficulties'),
      beliefsAndConcerns: stringData(runtime.beliefsAndConcerns, 'patientData.beliefsAndConcerns'),
      strategiesAlreadyTried: stringData(runtime.strategiesAlreadyTried, 'patientData.strategiesAlreadyTried'),
      dailyAndSocialContext: stringData(runtime.dailyAndSocialContext, 'patientData.dailyAndSocialContext'),
      familyAndSocialSupport: stringData(runtime.familyAndSocialSupport, 'patientData.familyAndSocialSupport'),
      relationshipWithProfessionals: stringData(runtime.relationshipWithProfessionals, 'patientData.relationshipWithProfessionals'),
      communicationProfile: copyCommunicationProfile(runtime.communicationProfile),
    },
    serviceContext: {
      initialSpfa: {
        service: content.serviceContext.initialSpfa.service,
        ...(content.serviceContext.initialSpfa.subtype === undefined
          ? {}
          : { subtype: content.serviceContext.initialSpfa.subtype }),
      },
      additionalSpfas: content.serviceContext.additionalSpfas.map((spfa) => ({
        service: spfa.service,
        ...(spfa.subtype === undefined ? {} : { subtype: spfa.subtype }),
      })),
    },
  };
}

export function buildPatientResponseValidationContextV2(
  clinicalContent: SessionPatientClinicalContentV2,
): PatientResponseValidationContextV2 {
  return clinicalContent.contentFormat === 'LEGACY_V1_SNAPSHOT'
    ? copyLegacyContext(clinicalContent)
    : copyGeneratedContext(clinicalContent);
}

export function buildPatientResponseValidationRequestV2(
  input: PatientResponseValidationRequestInputV2,
): PatientResponseValidationRequestV2 {
  if (typeof input.currentStudentTurn !== 'string') fail('currentStudentTurn');
  if (typeof input.candidate !== 'string') fail('candidate');
  const acceptedConversation = input.acceptedConversation.map((message, index) => {
    if (message.role !== 'student' && message.role !== 'patient') {
      fail(`acceptedConversation[${index}].role`);
    }
    if (typeof message.content !== 'string') {
      fail(`acceptedConversation[${index}].content`);
    }
    return { role: message.role, content: message.content };
  });

  return {
    contractVersion: PATIENT_RESPONSE_VALIDATOR_CONTRACT_VERSION_V2,
    safetyPolicyVersion: PATIENT_RESPONSE_SAFETY_POLICY_VERSION_V2,
    validationContext: buildPatientResponseValidationContextV2(input.clinicalContent),
    acceptedConversation,
    currentStudentTurn: input.currentStudentTurn,
    candidate: input.candidate,
  };
}
