import type {
  AdherencePatientProfile,
  AdherenceStatus,
  AssessmentStatus,
  BaseAdherenceStrategyCategory,
  NonAdherenceType,
  NonEmptyArray,
  ProfessionalActionCategory,
  SpfaService,
} from './evaluator-types';
import type {
  BiomedicalDatumValue,
  DisclosureDomain,
  EncounterPersonRole,
  MedicationOrigin,
  MedicationRegimenBasis,
  MedicationUseAction,
  PatientCommunicationProfile,
  Scale1To5,
  StudentPublicView,
} from './types';
import {
  AI_GENERATION_CONTRACT_VERSION,
  AI_GENERATION_LIMITS,
  type AiAdherenceAssessment,
  type AiAdherenceBarrier,
  type AiAdherenceBarrierAssessment,
  type AiAdherencePatientProfileConclusion,
  type AiAdherenceStrategy,
  type AiAssessmentConclusion,
  type AiConclusionKey,
  type AiDisclosureIntent,
  type AiEvaluatorConclusion,
  type AiEvaluatorDraftV2,
  type AiEvidenceExpression,
  type AiEvidenceLeafRef,
  type AiEvidenceRule,
  type AiFactKey,
  type AiFollowUpEpisode,
  type AiGeneratedCaseDraftV2,
  type AiIncidenceFinding,
  type AiMedicationKey,
  type AiMedicationLinkedFactDraftV2,
  type AiMedicationUseKey,
  type AiMedicationUsePatternDraftV2,
  type AiNonAdherenceTypeConclusion,
  type AiPatientClinicalContextDraftV2,
  type AiPatientDatum,
  type AiPatientEncounterDraftV2,
  type AiPatientFactsDraftV2,
  type AiPatientMedicationDraftV2,
  type AiPatientPharmacotherapyDraftV2,
  type AiPatientSymptomDraftV2,
  type AiPharmaceuticalIntervention,
  type AiPrmFinding,
  type AiPrmRnmRelation,
  type AiProfessionalAction,
  type AiReferralConclusion,
  type AiReportRequirement,
  type AiRnmAssessment,
  type AiSpfaConclusion,
  type AiSpfaTransition,
  type AiTaxonomyCatalog,
  type AiTaxonomyConceptRef,
} from './ai-generation-types';

export type AiGeneratedCaseDraftErrorCode =
  | 'invalid_ai_shape'
  | 'duplicate_local_key'
  | 'unresolved_local_reference'
  | 'invalid_evidence';

export class AiGeneratedCaseDraftValidationError extends Error {
  constructor(
    public readonly code: AiGeneratedCaseDraftErrorCode,
    public readonly path: string,
    message: string,
    public readonly expectedKind?: string,
    public readonly actualKind?: string,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'AiGeneratedCaseDraftValidationError';
  }
}

const DISCLOSURE_DOMAINS = [
  'initial_demand', 'patient_identity', 'caregiver_context', 'health_problems',
  'clinical_history', 'physiological_status', 'pregnancy_lactation',
  'allergies_intolerances', 'symptoms', 'symptom_timing_and_evolution',
  'prior_actions', 'medication_identity', 'medication_purpose',
  'prescribed_medication_use', 'actual_medication_use',
  'administration_technique', 'special_use_conditions', 'medication_changes',
  'perceived_effectiveness', 'perceived_safety', 'practical_difficulties',
  'beliefs_and_concerns', 'strategies_already_tried', 'lifestyle',
  'daily_context', 'social_support', 'professional_relationship',
  'biomedical_data',
] as const satisfies readonly DisclosureDomain[];

const SPFA_SERVICES = [
  'dispensing', 'pharmaceutical_indication', 'medication_adherence',
] as const;
const ASSESSMENT_STATUSES = ['none', 'present', 'not_determinable'] as const;
const ADHERENCE_STATUSES = ['adherent', 'non_adherent', 'not_determinable'] as const;
const BASE_STRATEGIES = [
  'technical', 'behavioral', 'educational', 'social_family_support',
] as const;
const ACTION_CATEGORIES = [
  'dispense', 'do_not_dispense', 'pharmacological_treatment',
  'non_pharmacological_treatment', 'hygienic_dietary_measures', 'referral',
  'other_spfa',
] as const;
const EVIDENCE_RULE_KINDS = new Set([
  'incidence_assessment', 'incidence', 'prm_assessment', 'prm',
  'rnm_assessment', 'adherence_assessment', 'non_adherence_type',
  'adherence_patient_profile', 'adherence_barrier_assessment',
  'adherence_barrier', 'adherence_strategy', 'professional_action',
  'pharmaceutical_intervention', 'referral',
]);
const INTERVENTION_TARGET_KINDS = new Set([
  'incidence', 'prm', 'rnm_assessment', 'adherence_assessment',
  'non_adherence_type', 'adherence_barrier',
]);

function fail(
  code: AiGeneratedCaseDraftErrorCode,
  path: string,
  message: string,
  expectedKind?: string,
  actualKind?: string,
): never {
  throw new AiGeneratedCaseDraftValidationError(
    code, path, message, expectedKind, actualKind,
  );
}

function shape(path: string, message: string): never {
  return fail('invalid_ai_shape', path, message);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    shape(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function exact(source: Record<string, unknown>, keys: readonly string[], path: string): void {
  const allowed = new Set(keys);
  for (const key of Object.keys(source)) {
    if (!allowed.has(key)) shape(`${path}.${key}`, 'unexpected property');
  }
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) shape(path, 'must be an array');
  if (value.length > AI_GENERATION_LIMITS.maxCollectionItems) {
    shape(path, `must contain at most ${AI_GENERATION_LIMITS.maxCollectionItems} items`);
  }
  return value;
}

function text(
  value: unknown,
  path: string,
  max: number = AI_GENERATION_LIMITS.maxTextLength,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    shape(path, 'must be a non-empty string');
  }
  if (value.length > max) shape(path, `must contain at most ${max} characters`);
  return value;
}

function controlled<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number] {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    shape(path, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T[number];
}

function localKey<T extends string>(value: unknown, prefix: 'lf' | 'lm' | 'lu' | 'lc', path: string): T {
  if (typeof value !== 'string' || value.length > AI_GENERATION_LIMITS.maxLocalKeyLength) {
    shape(path, `must use ${prefix}_<positive integer> within the configured limit`);
  }
  const match = new RegExp(`^${prefix}_([1-9][0-9]*)$`).exec(value);
  const ordinal = match === null ? Number.NaN : Number(match[1]);
  if (!Number.isSafeInteger(ordinal) || ordinal > AI_GENERATION_LIMITS.maxLocalKeyOrdinal) {
    shape(path, `must use ${prefix}_<positive integer> without leading zeros`);
  }
  return value as T;
}

const factKey = (value: unknown, path: string) => localKey<AiFactKey>(value, 'lf', path);
const medicationKey = (value: unknown, path: string) => localKey<AiMedicationKey>(value, 'lm', path);
const useKey = (value: unknown, path: string) => localKey<AiMedicationUseKey>(value, 'lu', path);
const conclusionKey = (value: unknown, path: string) => localKey<AiConclusionKey>(value, 'lc', path);

function scale(value: unknown, path: string): Scale1To5 {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 5) {
    shape(path, 'must be an integer from 1 to 5');
  }
  return value as Scale1To5;
}

function parseDisclosure(value: unknown, path: string): AiDisclosureIntent {
  const source = asRecord(value, path);
  const mode = controlled(source.mode, [
    'spontaneous', 'open_question', 'domain_exploration',
    'specific_question', 'rapport_required',
  ] as const, `${path}.mode`);
  if (mode === 'spontaneous' || mode === 'open_question') {
    exact(source, ['mode'], path);
    return { mode };
  }
  exact(source, ['mode', 'domains'], path);
  const domains = array(source.domains, `${path}.domains`).map((item, index) =>
    controlled(item, DISCLOSURE_DOMAINS, `${path}.domains[${index}]`),
  );
  if (domains.length === 0) shape(`${path}.domains`, 'must not be empty');
  return { mode, domains: domains as unknown as NonEmptyArray<DisclosureDomain> };
}

function parseDatum<T>(
  value: unknown,
  path: string,
  parseValue: (value: unknown, path: string) => T,
): AiPatientDatum<T> {
  const source = asRecord(value, path);
  const state = source.state;
  if (state === 'not_defined') {
    exact(source, ['state'], path);
    return { state };
  }
  if (state === 'not_applicable') {
    exact(source, ['state', 'reasonCode'], path);
    return {
      state,
      reasonCode: controlled(source.reasonCode, [
        'outside_case_scope', 'clinically_irrelevant', 'not_applicable_to_patient',
      ] as const, `${path}.reasonCode`),
    };
  }
  if (state === 'known') {
    exact(source, ['state', 'localFactKey', 'value', 'certainty', 'disclosureIntent'], path);
    return {
      state,
      localFactKey: factKey(source.localFactKey, `${path}.localFactKey`),
      value: parseValue(source.value, `${path}.value`),
      certainty: controlled(source.certainty, ['exact', 'approximate', 'uncertain'] as const, `${path}.certainty`),
      disclosureIntent: parseDisclosure(source.disclosureIntent, `${path}.disclosureIntent`),
    };
  }
  if (state === 'explicit_absence' || state === 'patient_unknown') {
    exact(source, ['state', 'localFactKey', 'topic', 'disclosureIntent'], path);
    return {
      state,
      localFactKey: factKey(source.localFactKey, `${path}.localFactKey`),
      topic: text(source.topic, `${path}.topic`),
      disclosureIntent: parseDisclosure(source.disclosureIntent, `${path}.disclosureIntent`),
    };
  }
  shape(`${path}.state`, 'must be known, explicit_absence, patient_unknown, not_defined or not_applicable');
}

const stringDatum = (value: unknown, path: string) => parseDatum(value, path, text);
function enumDatum<const T extends readonly string[]>(value: unknown, allowed: T, path: string): AiPatientDatum<T[number]> {
  return parseDatum(value, path, (item, itemPath) => controlled(item, allowed, itemPath));
}
function datumArray(value: unknown, path: string): AiPatientDatum<string>[] {
  return array(value, path).map((item, index) => stringDatum(item, `${path}[${index}]`));
}

function parseBiomedicalValue(value: unknown, path: string): BiomedicalDatumValue {
  const source = asRecord(value, path);
  exact(source, ['type', 'value', 'unit', 'timingOrContext'], path);
  const measured = source.value;
  if ((typeof measured !== 'string' && typeof measured !== 'number') ||
      (typeof measured === 'string' && (measured.trim().length === 0 || measured.length > AI_GENERATION_LIMITS.maxTextLength)) ||
      (typeof measured === 'number' && !Number.isFinite(measured))) {
    shape(`${path}.value`, 'must be a bounded non-empty string or finite number');
  }
  const unit = source.unit === undefined ? undefined : text(source.unit, `${path}.unit`);
  const timingOrContext = source.timingOrContext === undefined ? undefined : text(source.timingOrContext, `${path}.timingOrContext`);
  return {
    type: text(source.type, `${path}.type`),
    value: measured,
    ...(unit === undefined ? {} : { unit }),
    ...(timingOrContext === undefined ? {} : { timingOrContext }),
  };
}

function parsePublicProfile(value: unknown): StudentPublicView {
  const source = asRecord(value, 'patientFacts.publicProfile');
  exact(source, ['nombre', 'edad', 'sexo', 'tratamiento'], 'patientFacts.publicProfile');
  if (typeof source.edad !== 'number' || !Number.isFinite(source.edad) || !Number.isInteger(source.edad) || source.edad < 0) {
    shape('patientFacts.publicProfile.edad', 'must be a finite non-negative integer');
  }
  return {
    nombre: text(source.nombre, 'patientFacts.publicProfile.nombre'),
    edad: source.edad,
    sexo: text(source.sexo, 'patientFacts.publicProfile.sexo'),
    tratamiento: text(source.tratamiento, 'patientFacts.publicProfile.tratamiento'),
  };
}

function parseEncounter(value: unknown): AiPatientEncounterDraftV2 {
  const path = 'patientFacts.encounter';
  const source = asRecord(value, path);
  exact(source, ['personPresent', 'relationshipToPatient'], path);
  return {
    personPresent: enumDatum(source.personPresent, ['patient', 'caregiver', 'other'] as const, `${path}.personPresent`) as AiPatientDatum<EncounterPersonRole>,
    relationshipToPatient: stringDatum(source.relationshipToPatient, `${path}.relationshipToPatient`),
  };
}

function parseClinicalContext(value: unknown): AiPatientClinicalContextDraftV2 {
  const path = 'patientFacts.clinicalContext';
  const source = asRecord(value, path);
  exact(source, ['healthProblems', 'clinicalHistory', 'physiologicalSituation', 'pregnancyAndLactation', 'allergiesAndIntolerances', 'lifestyle', 'biomedicalData'], path);
  return {
    healthProblems: datumArray(source.healthProblems, `${path}.healthProblems`),
    clinicalHistory: datumArray(source.clinicalHistory, `${path}.clinicalHistory`),
    physiologicalSituation: datumArray(source.physiologicalSituation, `${path}.physiologicalSituation`),
    pregnancyAndLactation: stringDatum(source.pregnancyAndLactation, `${path}.pregnancyAndLactation`),
    allergiesAndIntolerances: datumArray(source.allergiesAndIntolerances, `${path}.allergiesAndIntolerances`),
    lifestyle: datumArray(source.lifestyle, `${path}.lifestyle`),
    biomedicalData: array(source.biomedicalData, `${path}.biomedicalData`).map((item, index) =>
      parseDatum(item, `${path}.biomedicalData[${index}]`, parseBiomedicalValue),
    ),
  };
}

function parseSymptom(value: unknown, path: string): AiPatientSymptomDraftV2 {
  const source = asRecord(value, path);
  exact(source, ['description', 'onset', 'duration', 'evolution', 'relevantCircumstances'], path);
  return {
    description: stringDatum(source.description, `${path}.description`),
    onset: stringDatum(source.onset, `${path}.onset`),
    duration: stringDatum(source.duration, `${path}.duration`),
    evolution: stringDatum(source.evolution, `${path}.evolution`),
    relevantCircumstances: datumArray(source.relevantCircumstances, `${path}.relevantCircumstances`),
  };
}

function parseCommunicationProfile(value: unknown): PatientCommunicationProfile {
  const path = 'patientFacts.communicationProfile';
  const source = asRecord(value, path);
  exact(source, [
    'sociability', 'cooperation', 'organization', 'emotionalReactivity',
    'opennessToChange', 'healthLiteracy', 'professionalTrust',
    'medicationAttitude', 'decisionStyle', 'readinessToChange',
    'socialDesirability', 'judgmentSensitivity', 'disclosureThreshold',
    'answerLength', 'assertiveness', 'emotionalExpression',
  ], path);
  return {
    sociability: scale(source.sociability, `${path}.sociability`),
    cooperation: scale(source.cooperation, `${path}.cooperation`),
    organization: scale(source.organization, `${path}.organization`),
    emotionalReactivity: scale(source.emotionalReactivity, `${path}.emotionalReactivity`),
    opennessToChange: scale(source.opennessToChange, `${path}.opennessToChange`),
    healthLiteracy: controlled(source.healthLiteracy, ['low', 'medium', 'high'] as const, `${path}.healthLiteracy`),
    professionalTrust: scale(source.professionalTrust, `${path}.professionalTrust`),
    medicationAttitude: controlled(source.medicationAttitude, ['trusting', 'neutral', 'cautious', 'skeptical', 'ambivalent'] as const, `${path}.medicationAttitude`),
    decisionStyle: controlled(source.decisionStyle, ['autonomous', 'shared', 'professional_led', 'family_influenced', 'indecisive'] as const, `${path}.decisionStyle`),
    readinessToChange: scale(source.readinessToChange, `${path}.readinessToChange`),
    socialDesirability: scale(source.socialDesirability, `${path}.socialDesirability`),
    judgmentSensitivity: scale(source.judgmentSensitivity, `${path}.judgmentSensitivity`),
    disclosureThreshold: scale(source.disclosureThreshold, `${path}.disclosureThreshold`),
    answerLength: controlled(source.answerLength, ['brief', 'medium', 'long'] as const, `${path}.answerLength`),
    assertiveness: scale(source.assertiveness, `${path}.assertiveness`),
    emotionalExpression: scale(source.emotionalExpression, `${path}.emotionalExpression`),
  };
}

function parseMedication(value: unknown, path: string): AiPatientMedicationDraftV2 {
  const source = asRecord(value, path);
  exact(source, ['localMedicationKey', 'displayName', 'origin', 'purposeAsUnderstood', 'regimenBasis', 'referenceDose', 'referenceSchedule', 'referenceDuration', 'administrationMethod', 'specialUseConditions'], path);
  return {
    localMedicationKey: medicationKey(source.localMedicationKey, `${path}.localMedicationKey`),
    displayName: stringDatum(source.displayName, `${path}.displayName`),
    origin: enumDatum(source.origin, ['prescribed', 'patient_selected', 'pharmacist_recommended', 'other'] as const, `${path}.origin`) as AiPatientDatum<MedicationOrigin>,
    purposeAsUnderstood: stringDatum(source.purposeAsUnderstood, `${path}.purposeAsUnderstood`),
    regimenBasis: enumDatum(source.regimenBasis, ['prescription', 'label_or_leaflet', 'pharmacist_advice', 'patient_plan', 'other'] as const, `${path}.regimenBasis`) as AiPatientDatum<MedicationRegimenBasis>,
    referenceDose: stringDatum(source.referenceDose, `${path}.referenceDose`),
    referenceSchedule: stringDatum(source.referenceSchedule, `${path}.referenceSchedule`),
    referenceDuration: stringDatum(source.referenceDuration, `${path}.referenceDuration`),
    administrationMethod: stringDatum(source.administrationMethod, `${path}.administrationMethod`),
    specialUseConditions: datumArray(source.specialUseConditions, `${path}.specialUseConditions`),
  };
}

function factRefs(value: unknown, path: string): AiFactKey[] {
  return array(value, path).map((item, index) => factKey(item, `${path}[${index}]`));
}
function medicationRefs(value: unknown, path: string): AiMedicationKey[] {
  return array(value, path).map((item, index) => medicationKey(item, `${path}[${index}]`));
}
function conclusionRefs(value: unknown, path: string): AiConclusionKey[] {
  return array(value, path).map((item, index) => conclusionKey(item, `${path}[${index}]`));
}

function parseMedicationUse(value: unknown, path: string): AiMedicationUsePatternDraftV2 {
  const source = asRecord(value, path);
  exact(source, ['localUseKey', 'medicationRef', 'action', 'actualUse', 'actualDose', 'actualSchedule', 'frequency', 'timePeriod', 'circumstanceFactRefs', 'statedReasonFactRefs', 'perceivedEffectFactRefs', 'practicalDifficultyFactRefs', 'strategyTriedFactRefs'], path);
  return {
    localUseKey: useKey(source.localUseKey, `${path}.localUseKey`),
    medicationRef: medicationKey(source.medicationRef, `${path}.medicationRef`),
    action: controlled(source.action, ['takes', 'omits', 'delays', 'changes_dose', 'interrupts', 'uses_extra', 'uses_only_when_symptomatic', 'uses_with_incorrect_technique'] as const, `${path}.action`) as MedicationUseAction,
    actualUse: stringDatum(source.actualUse, `${path}.actualUse`),
    actualDose: stringDatum(source.actualDose, `${path}.actualDose`),
    actualSchedule: stringDatum(source.actualSchedule, `${path}.actualSchedule`),
    frequency: stringDatum(source.frequency, `${path}.frequency`),
    timePeriod: stringDatum(source.timePeriod, `${path}.timePeriod`),
    circumstanceFactRefs: factRefs(source.circumstanceFactRefs, `${path}.circumstanceFactRefs`),
    statedReasonFactRefs: factRefs(source.statedReasonFactRefs, `${path}.statedReasonFactRefs`),
    perceivedEffectFactRefs: factRefs(source.perceivedEffectFactRefs, `${path}.perceivedEffectFactRefs`),
    practicalDifficultyFactRefs: factRefs(source.practicalDifficultyFactRefs, `${path}.practicalDifficultyFactRefs`),
    strategyTriedFactRefs: factRefs(source.strategyTriedFactRefs, `${path}.strategyTriedFactRefs`),
  };
}

function parseMedicationLinked(value: unknown, path: string): AiMedicationLinkedFactDraftV2 {
  const source = asRecord(value, path);
  exact(source, ['medicationRef', 'detail'], path);
  return {
    medicationRef: medicationKey(source.medicationRef, `${path}.medicationRef`),
    detail: stringDatum(source.detail, `${path}.detail`),
  };
}

function parsePharmacotherapy(value: unknown): AiPatientPharmacotherapyDraftV2 {
  const path = 'patientFacts.pharmacotherapy';
  const source = asRecord(value, path);
  exact(source, ['prescribedMedications', 'otherMedicinesAndProducts', 'actualMedicationUse', 'recentChanges', 'perceivedEffectiveness', 'perceivedSafety'], path);
  const medications = (field: 'prescribedMedications' | 'otherMedicinesAndProducts') =>
    array(source[field], `${path}.${field}`).map((item, index) => parseMedication(item, `${path}.${field}[${index}]`));
  const linked = (field: 'recentChanges' | 'perceivedEffectiveness' | 'perceivedSafety') =>
    array(source[field], `${path}.${field}`).map((item, index) => parseMedicationLinked(item, `${path}.${field}[${index}]`));
  return {
    prescribedMedications: medications('prescribedMedications'),
    otherMedicinesAndProducts: medications('otherMedicinesAndProducts'),
    actualMedicationUse: array(source.actualMedicationUse, `${path}.actualMedicationUse`).map((item, index) => parseMedicationUse(item, `${path}.actualMedicationUse[${index}]`)),
    recentChanges: linked('recentChanges'),
    perceivedEffectiveness: linked('perceivedEffectiveness'),
    perceivedSafety: linked('perceivedSafety'),
  };
}

function parsePatientFacts(value: unknown): AiPatientFactsDraftV2 {
  const path = 'patientFacts';
  const source = asRecord(value, path);
  exact(source, ['publicProfile', 'initialDemand', 'encounter', 'clinicalContext', 'symptoms', 'pharmacotherapy', 'actionsAlreadyTaken', 'practicalDifficulties', 'beliefsAndConcerns', 'strategiesAlreadyTried', 'dailyAndSocialContext', 'familyAndSocialSupport', 'relationshipWithProfessionals', 'communicationProfile'], path);
  return {
    publicProfile: parsePublicProfile(source.publicProfile),
    initialDemand: stringDatum(source.initialDemand, `${path}.initialDemand`),
    encounter: parseEncounter(source.encounter),
    clinicalContext: parseClinicalContext(source.clinicalContext),
    symptoms: array(source.symptoms, `${path}.symptoms`).map((item, index) => parseSymptom(item, `${path}.symptoms[${index}]`)),
    pharmacotherapy: parsePharmacotherapy(source.pharmacotherapy),
    actionsAlreadyTaken: datumArray(source.actionsAlreadyTaken, `${path}.actionsAlreadyTaken`),
    practicalDifficulties: datumArray(source.practicalDifficulties, `${path}.practicalDifficulties`),
    beliefsAndConcerns: datumArray(source.beliefsAndConcerns, `${path}.beliefsAndConcerns`),
    strategiesAlreadyTried: datumArray(source.strategiesAlreadyTried, `${path}.strategiesAlreadyTried`),
    dailyAndSocialContext: datumArray(source.dailyAndSocialContext, `${path}.dailyAndSocialContext`),
    familyAndSocialSupport: datumArray(source.familyAndSocialSupport, `${path}.familyAndSocialSupport`),
    relationshipWithProfessionals: datumArray(source.relationshipWithProfessionals, `${path}.relationshipWithProfessionals`),
    communicationProfile: parseCommunicationProfile(source.communicationProfile),
  };
}

function taxonomy(value: unknown, expected: AiTaxonomyCatalog, path: string): AiTaxonomyConceptRef {
  const source = asRecord(value, path);
  exact(source, ['catalog', 'conceptId'], path);
  const catalog = controlled(source.catalog, ['prm', 'rnm', 'adherence_barrier', 'professional_action', 'pharmaceutical_intervention', 'referral_destination'] as const, `${path}.catalog`);
  if (catalog !== expected) shape(`${path}.catalog`, `must be ${expected} in this context`);
  return { catalog, conceptId: text(source.conceptId, `${path}.conceptId`, AI_GENERATION_LIMITS.maxConceptIdLength) };
}

function conclusionSource(value: unknown, kind: string, path: string): { key: AiConclusionKey; value: Record<string, unknown> } {
  const source = asRecord(value, path);
  exact(source, ['localConclusionKey', 'kind', 'value'], path);
  if (source.kind !== kind) shape(`${path}.kind`, `must be ${kind}`);
  return {
    key: conclusionKey(source.localConclusionKey, `${path}.localConclusionKey`),
    value: asRecord(source.value, `${path}.value`),
  };
}

function parseSpfa(value: unknown, path: string): AiSpfaConclusion {
  const parsed = conclusionSource(value, 'spfa', path);
  const service = controlled(parsed.value.service, SPFA_SERVICES, `${path}.value.service`) as SpfaService;
  if (service === 'dispensing') {
    exact(parsed.value, ['service', 'subtype'], `${path}.value`);
    return { localConclusionKey: parsed.key, kind: 'spfa', value: { service, subtype: controlled(parsed.value.subtype, ['initial_treatment', 'continuation'] as const, `${path}.value.subtype`) } };
  }
  exact(parsed.value, ['service'], `${path}.value`);
  return { localConclusionKey: parsed.key, kind: 'spfa', value: { service } };
}

function parseTransition(value: unknown, path: string): AiSpfaTransition {
  const parsed = conclusionSource(value, 'spfa_transition', path);
  exact(parsed.value, ['fromSpfaRef', 'toSpfaRef'], `${path}.value`);
  return { localConclusionKey: parsed.key, kind: 'spfa_transition', value: {
    fromSpfaRef: conclusionKey(parsed.value.fromSpfaRef, `${path}.value.fromSpfaRef`),
    toSpfaRef: conclusionKey(parsed.value.toSpfaRef, `${path}.value.toSpfaRef`),
  } };
}

function parseAssessment<K extends 'incidence_assessment' | 'prm_assessment'>(value: unknown, kind: K, path: string): AiAssessmentConclusion<K> {
  const parsed = conclusionSource(value, kind, path);
  exact(parsed.value, ['status'], `${path}.value`);
  return { localConclusionKey: parsed.key, kind, value: { status: controlled(parsed.value.status, ASSESSMENT_STATUSES, `${path}.value.status`) as AssessmentStatus } };
}

function parseIncidence(value: unknown, path: string): AiIncidenceFinding {
  const parsed = conclusionSource(value, 'incidence', path);
  exact(parsed.value, ['spfaRef', 'medicationRefs', 'semanticMeaning'], `${path}.value`);
  return { localConclusionKey: parsed.key, kind: 'incidence', value: {
    spfaRef: conclusionKey(parsed.value.spfaRef, `${path}.value.spfaRef`),
    medicationRefs: medicationRefs(parsed.value.medicationRefs, `${path}.value.medicationRefs`),
    semanticMeaning: text(parsed.value.semanticMeaning, `${path}.value.semanticMeaning`),
  } };
}

function parseEpisode(value: unknown, path: string): AiFollowUpEpisode {
  const parsed = conclusionSource(value, 'follow_up_episode', path);
  exact(parsed.value, ['incidenceRef'], `${path}.value`);
  return { localConclusionKey: parsed.key, kind: 'follow_up_episode', value: { incidenceRef: conclusionKey(parsed.value.incidenceRef, `${path}.value.incidenceRef`) } };
}

function parsePrm(value: unknown, path: string): AiPrmFinding {
  const parsed = conclusionSource(value, 'prm', path);
  exact(parsed.value, ['classification', 'medicationRefs', 'followUpEpisodeRef'], `${path}.value`);
  const followUpEpisodeRef = parsed.value.followUpEpisodeRef === undefined ? undefined : conclusionKey(parsed.value.followUpEpisodeRef, `${path}.value.followUpEpisodeRef`);
  return { localConclusionKey: parsed.key, kind: 'prm', value: {
    classification: taxonomy(parsed.value.classification, 'prm', `${path}.value.classification`),
    medicationRefs: medicationRefs(parsed.value.medicationRefs, `${path}.value.medicationRefs`),
    ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
  } };
}

function parseRnm(value: unknown, path: string): AiRnmAssessment {
  const parsed = conclusionSource(value, 'rnm_assessment', path);
  const status = controlled(parsed.value.status, ['rnm', 'risk_of_rnm', 'no_rnm'] as const, `${path}.value.status`);
  if (status === 'no_rnm') {
    exact(parsed.value, ['status'], `${path}.value`);
    return { localConclusionKey: parsed.key, kind: 'rnm_assessment', value: { status } };
  }
  exact(parsed.value, ['status', 'classification', 'medicationRefs', 'followUpEpisodeRef'], `${path}.value`);
  const classification = parsed.value.classification === undefined ? undefined : taxonomy(parsed.value.classification, 'rnm', `${path}.value.classification`);
  if (status === 'rnm' && classification === undefined) shape(`${path}.value.classification`, 'is required for rnm');
  const followUpEpisodeRef = parsed.value.followUpEpisodeRef === undefined ? undefined : conclusionKey(parsed.value.followUpEpisodeRef, `${path}.value.followUpEpisodeRef`);
  return { localConclusionKey: parsed.key, kind: 'rnm_assessment', value: {
    status,
    ...(classification === undefined ? {} : { classification }),
    medicationRefs: medicationRefs(parsed.value.medicationRefs, `${path}.value.medicationRefs`),
    ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
  } } as AiRnmAssessment;
}

function parsePrmRnm(value: unknown, path: string): AiPrmRnmRelation {
  const parsed = conclusionSource(value, 'prm_rnm_relation', path);
  exact(parsed.value, ['prmRef', 'rnmAssessmentRef', 'relation'], `${path}.value`);
  return { localConclusionKey: parsed.key, kind: 'prm_rnm_relation', value: {
    prmRef: conclusionKey(parsed.value.prmRef, `${path}.value.prmRef`),
    rnmAssessmentRef: conclusionKey(parsed.value.rnmAssessmentRef, `${path}.value.rnmAssessmentRef`),
    relation: controlled(parsed.value.relation, ['creates_risk_of_rnm', 'contributes_to_rnm'] as const, `${path}.value.relation`),
  } };
}

function parseAdherenceAssessment(value: unknown, path: string): AiAdherenceAssessment {
  const parsed = conclusionSource(value, 'adherence_assessment', path);
  exact(parsed.value, ['medicationRefs', 'status'], `${path}.value`);
  const refs = medicationRefs(parsed.value.medicationRefs, `${path}.value.medicationRefs`);
  if (refs.length === 0) shape(`${path}.value.medicationRefs`, 'must not be empty');
  return { localConclusionKey: parsed.key, kind: 'adherence_assessment', value: {
    medicationRefs: refs as unknown as NonEmptyArray<AiMedicationKey>,
    status: controlled(parsed.value.status, ADHERENCE_STATUSES, `${path}.value.status`) as AdherenceStatus,
  } };
}

function parseAdherenceType(value: unknown, path: string): AiNonAdherenceTypeConclusion {
  const parsed = conclusionSource(value, 'non_adherence_type', path);
  const status = controlled(parsed.value.status, ['determined', 'not_determinable'] as const, `${path}.value.status`);
  const ref = conclusionKey(parsed.value.adherenceAssessmentRef, `${path}.value.adherenceAssessmentRef`);
  if (status === 'not_determinable') {
    exact(parsed.value, ['adherenceAssessmentRef', 'status'], `${path}.value`);
    return { localConclusionKey: parsed.key, kind: 'non_adherence_type', value: { adherenceAssessmentRef: ref, status } };
  }
  exact(parsed.value, ['adherenceAssessmentRef', 'status', 'type'], `${path}.value`);
  return { localConclusionKey: parsed.key, kind: 'non_adherence_type', value: { adherenceAssessmentRef: ref, status, type: controlled(parsed.value.type, ['intentional', 'unintentional', 'erratic', 'combined'] as const, `${path}.value.type`) as NonAdherenceType } };
}

function parseAdherenceProfile(value: unknown, path: string): AiAdherencePatientProfileConclusion {
  const parsed = conclusionSource(value, 'adherence_patient_profile', path);
  const status = controlled(parsed.value.status, ['determined', 'not_determinable'] as const, `${path}.value.status`);
  const ref = conclusionKey(parsed.value.adherenceAssessmentRef, `${path}.value.adherenceAssessmentRef`);
  if (status === 'not_determinable') {
    exact(parsed.value, ['adherenceAssessmentRef', 'status'], `${path}.value`);
    return { localConclusionKey: parsed.key, kind: 'adherence_patient_profile', value: { adherenceAssessmentRef: ref, status } };
  }
  exact(parsed.value, ['adherenceAssessmentRef', 'status', 'profile'], `${path}.value`);
  return { localConclusionKey: parsed.key, kind: 'adherence_patient_profile', value: { adherenceAssessmentRef: ref, status, profile: controlled(parsed.value.profile, ['distrustful', 'trivializing', 'confused'] as const, `${path}.value.profile`) as AdherencePatientProfile } };
}

function parseBarrierAssessment(value: unknown, path: string): AiAdherenceBarrierAssessment {
  const parsed = conclusionSource(value, 'adherence_barrier_assessment', path);
  exact(parsed.value, ['adherenceAssessmentRef', 'status'], `${path}.value`);
  return { localConclusionKey: parsed.key, kind: 'adherence_barrier_assessment', value: {
    adherenceAssessmentRef: conclusionKey(parsed.value.adherenceAssessmentRef, `${path}.value.adherenceAssessmentRef`),
    status: controlled(parsed.value.status, ['identified', 'not_determinable'] as const, `${path}.value.status`),
  } };
}

function parseBarrier(value: unknown, path: string): AiAdherenceBarrier {
  const parsed = conclusionSource(value, 'adherence_barrier', path);
  exact(parsed.value, ['barrierAssessmentRef', 'role', 'category', 'classification'], `${path}.value`);
  const classification = parsed.value.classification === undefined ? undefined : taxonomy(parsed.value.classification, 'adherence_barrier', `${path}.value.classification`);
  return { localConclusionKey: parsed.key, kind: 'adherence_barrier', value: {
    barrierAssessmentRef: conclusionKey(parsed.value.barrierAssessmentRef, `${path}.value.barrierAssessmentRef`),
    role: controlled(parsed.value.role, ['primary', 'secondary'] as const, `${path}.value.role`),
    category: controlled(parsed.value.category, ['practical', 'perception'] as const, `${path}.value.category`),
    ...(classification === undefined ? {} : { classification }),
  } };
}

function parseStrategy(value: unknown, path: string): AiAdherenceStrategy {
  const parsed = conclusionSource(value, 'adherence_strategy', path);
  const category = controlled(parsed.value.category, [...BASE_STRATEGIES, 'combined'] as const, `${path}.value.category`);
  const base = {
    adherenceAssessmentRef: conclusionKey(parsed.value.adherenceAssessmentRef, `${path}.value.adherenceAssessmentRef`),
    addressedBarrierRefs: conclusionRefs(parsed.value.addressedBarrierRefs, `${path}.value.addressedBarrierRefs`),
  };
  if (category !== 'combined') {
    exact(parsed.value, ['adherenceAssessmentRef', 'addressedBarrierRefs', 'category'], `${path}.value`);
    return { localConclusionKey: parsed.key, kind: 'adherence_strategy', value: { ...base, category: category as BaseAdherenceStrategyCategory } };
  }
  exact(parsed.value, ['adherenceAssessmentRef', 'addressedBarrierRefs', 'category', 'componentCategories'], `${path}.value`);
  const components = array(parsed.value.componentCategories, `${path}.value.componentCategories`).map((item, index) => controlled(item, BASE_STRATEGIES, `${path}.value.componentCategories[${index}]`));
  if (components.length === 0) shape(`${path}.value.componentCategories`, 'must not be empty');
  return { localConclusionKey: parsed.key, kind: 'adherence_strategy', value: { ...base, category, componentCategories: components as unknown as NonEmptyArray<BaseAdherenceStrategyCategory> } };
}

function parseAction(value: unknown, path: string): AiProfessionalAction {
  const parsed = conclusionSource(value, 'professional_action', path);
  const category = controlled(parsed.value.category, ACTION_CATEGORIES, `${path}.value.category`) as ProfessionalActionCategory;
  const common = ['spfaRef', 'category', 'classification'] as const;
  const classification = parsed.value.classification === undefined ? undefined : taxonomy(parsed.value.classification, 'professional_action', `${path}.value.classification`);
  const base = { spfaRef: conclusionKey(parsed.value.spfaRef, `${path}.value.spfaRef`), category, ...(classification === undefined ? {} : { classification }) };
  if (category === 'referral') {
    exact(parsed.value, [...common, 'referralRef'], `${path}.value`);
    return { localConclusionKey: parsed.key, kind: 'professional_action', value: { ...base, referralRef: conclusionKey(parsed.value.referralRef, `${path}.value.referralRef`) } };
  }
  if (category === 'other_spfa') {
    exact(parsed.value, [...common, 'targetSpfaRef'], `${path}.value`);
    return { localConclusionKey: parsed.key, kind: 'professional_action', value: { ...base, targetSpfaRef: conclusionKey(parsed.value.targetSpfaRef, `${path}.value.targetSpfaRef`) } };
  }
  exact(parsed.value, common, `${path}.value`);
  return { localConclusionKey: parsed.key, kind: 'professional_action', value: base };
}

function parseIntervention(value: unknown, path: string): AiPharmaceuticalIntervention {
  const parsed = conclusionSource(value, 'pharmaceutical_intervention', path);
  exact(parsed.value, ['spfaRef', 'professionalActionRef', 'target', 'classification', 'addressedConclusionRefs', 'referralRef'], `${path}.value`);
  const professionalActionRef = parsed.value.professionalActionRef === undefined ? undefined : conclusionKey(parsed.value.professionalActionRef, `${path}.value.professionalActionRef`);
  const classification = parsed.value.classification === undefined ? undefined : taxonomy(parsed.value.classification, 'pharmaceutical_intervention', `${path}.value.classification`);
  const referralRef = parsed.value.referralRef === undefined ? undefined : conclusionKey(parsed.value.referralRef, `${path}.value.referralRef`);
  const addressed = conclusionRefs(parsed.value.addressedConclusionRefs, `${path}.value.addressedConclusionRefs`);
  if (addressed.length === 0) shape(`${path}.value.addressedConclusionRefs`, 'must not be empty');
  return { localConclusionKey: parsed.key, kind: 'pharmaceutical_intervention', value: {
    spfaRef: conclusionKey(parsed.value.spfaRef, `${path}.value.spfaRef`),
    ...(professionalActionRef === undefined ? {} : { professionalActionRef }),
    target: controlled(parsed.value.target, ['treatment', 'patient_state_or_situation', 'conditions_of_use'] as const, `${path}.value.target`),
    ...(classification === undefined ? {} : { classification }),
    addressedConclusionRefs: addressed as unknown as NonEmptyArray<AiConclusionKey>,
    ...(referralRef === undefined ? {} : { referralRef }),
  } };
}

function parseReport(value: unknown, path: string): AiReportRequirement {
  const source = asRecord(value, path);
  exact(source, ['status', 'essentialContents'], path);
  const status = controlled(source.status, ['not_required', 'appropriate', 'required'] as const, `${path}.status`);
  const contents = array(source.essentialContents, `${path}.essentialContents`).map((item, index) => text(item, `${path}.essentialContents[${index}]`));
  if (status === 'not_required') {
    if (contents.length !== 0) shape(`${path}.essentialContents`, 'must be empty when report is not required');
    return { status, essentialContents: [] };
  }
  if (contents.length === 0) shape(`${path}.essentialContents`, 'must not be empty');
  return { status, essentialContents: contents as unknown as NonEmptyArray<string> };
}

function parseReferral(value: unknown, path: string): AiReferralConclusion {
  const parsed = conclusionSource(value, 'referral', path);
  const status = controlled(parsed.value.status, ['not_required', 'required'] as const, `${path}.value.status`);
  if (status === 'not_required') {
    exact(parsed.value, ['status'], `${path}.value`);
    return { localConclusionKey: parsed.key, kind: 'referral', value: { status } };
  }
  exact(parsed.value, ['status', 'urgency', 'destination', 'reason', 'report'], `${path}.value`);
  const destination = asRecord(parsed.value.destination, `${path}.value.destination`);
  exact(destination, ['label', 'classification'], `${path}.value.destination`);
  const classification = destination.classification === undefined ? undefined : taxonomy(destination.classification, 'referral_destination', `${path}.value.destination.classification`);
  return { localConclusionKey: parsed.key, kind: 'referral', value: {
    status,
    urgency: controlled(parsed.value.urgency, ['non_urgent', 'urgent'] as const, `${path}.value.urgency`),
    destination: { label: text(destination.label, `${path}.value.destination.label`), ...(classification === undefined ? {} : { classification }) },
    reason: text(parsed.value.reason, `${path}.value.reason`),
    report: parseReport(parsed.value.report, `${path}.value.report`),
  } };
}

function parseEvidenceLeaf(value: unknown, path: string): AiEvidenceLeafRef {
  const source = asRecord(value, path);
  if (source.operator === 'fact') {
    exact(source, ['operator', 'factRef'], path);
    return { operator: 'fact', factRef: factKey(source.factRef, `${path}.factRef`) };
  }
  if (source.operator === 'public_profile') {
    exact(source, ['operator', 'field'], path);
    return { operator: 'public_profile', field: controlled(source.field, ['age', 'sex'] as const, `${path}.field`) };
  }
  shape(`${path}.operator`, 'must be fact or public_profile');
}

function parseEvidenceExpression(value: unknown, path: string, depth = 0): AiEvidenceExpression {
  if (depth > AI_GENERATION_LIMITS.maxEvidenceDepth) {
    fail('invalid_evidence', path, `exceeds maximum depth ${AI_GENERATION_LIMITS.maxEvidenceDepth}`);
  }
  const source = asRecord(value, path);
  if (source.operator === 'fact' || source.operator === 'public_profile') return parseEvidenceLeaf(source, path);
  if (source.operator === 'all' || source.operator === 'any') {
    exact(source, ['operator', 'operands'], path);
    const operands = array(source.operands, `${path}.operands`);
    if (operands.length === 0) fail('invalid_evidence', `${path}.operands`, 'must not be empty');
    return { operator: source.operator, operands: operands.map((item, index) => parseEvidenceExpression(item, `${path}.operands[${index}]`, depth + 1)) as unknown as NonEmptyArray<AiEvidenceExpression> };
  }
  fail('invalid_evidence', `${path}.operator`, 'must be fact, public_profile, all or any');
}

function parseEvidenceRule(value: unknown, path: string): AiEvidenceRule {
  const source = asRecord(value, path);
  exact(source, ['conclusionRef', 'requiredEvidence', 'supportingEvidenceRefs', 'counterEvidenceRefs', 'teacherRationale'], path);
  return {
    conclusionRef: conclusionKey(source.conclusionRef, `${path}.conclusionRef`),
    requiredEvidence: parseEvidenceExpression(source.requiredEvidence, `${path}.requiredEvidence`),
    supportingEvidenceRefs: array(source.supportingEvidenceRefs, `${path}.supportingEvidenceRefs`).map((item, index) => parseEvidenceLeaf(item, `${path}.supportingEvidenceRefs[${index}]`)),
    counterEvidenceRefs: array(source.counterEvidenceRefs, `${path}.counterEvidenceRefs`).map((item, index) => parseEvidenceLeaf(item, `${path}.counterEvidenceRefs[${index}]`)),
    teacherRationale: text(source.teacherRationale, `${path}.teacherRationale`),
  };
}

function parseEvaluator(value: unknown): AiEvaluatorDraftV2 {
  const path = 'evaluator';
  const source = asRecord(value, path);
  exact(source, ['carePath', 'incidence', 'prm', 'rnmAssessments', 'prmRnmRelations', 'adherence', 'professionalActions', 'pharmaceuticalInterventions', 'referral', 'evidenceRules'], path);
  const carePath = asRecord(source.carePath, `${path}.carePath`);
  exact(carePath, ['initialSpfa', 'additionalSpfas', 'transitions'], `${path}.carePath`);
  const incidence = asRecord(source.incidence, `${path}.incidence`);
  exact(incidence, ['assessment', 'findings', 'followUpEpisodes'], `${path}.incidence`);
  const prm = asRecord(source.prm, `${path}.prm`);
  exact(prm, ['assessment', 'findings'], `${path}.prm`);
  const adherence = asRecord(source.adherence, `${path}.adherence`);
  exact(adherence, ['assessments', 'typeConclusions', 'patientProfiles', 'barrierAssessments', 'barriers', 'strategies'], `${path}.adherence`);
  const map = <T>(value: unknown, itemPath: string, parser: (item: unknown, path: string) => T) =>
    array(value, itemPath).map((item, index) => parser(item, `${itemPath}[${index}]`));
  return {
    carePath: {
      initialSpfa: parseSpfa(carePath.initialSpfa, `${path}.carePath.initialSpfa`),
      additionalSpfas: map(carePath.additionalSpfas, `${path}.carePath.additionalSpfas`, parseSpfa),
      transitions: map(carePath.transitions, `${path}.carePath.transitions`, parseTransition),
    },
    incidence: {
      assessment: parseAssessment(incidence.assessment, 'incidence_assessment', `${path}.incidence.assessment`),
      findings: map(incidence.findings, `${path}.incidence.findings`, parseIncidence),
      followUpEpisodes: map(incidence.followUpEpisodes, `${path}.incidence.followUpEpisodes`, parseEpisode),
    },
    prm: {
      assessment: parseAssessment(prm.assessment, 'prm_assessment', `${path}.prm.assessment`),
      findings: map(prm.findings, `${path}.prm.findings`, parsePrm),
    },
    rnmAssessments: map(source.rnmAssessments, `${path}.rnmAssessments`, parseRnm),
    prmRnmRelations: map(source.prmRnmRelations, `${path}.prmRnmRelations`, parsePrmRnm),
    adherence: {
      assessments: map(adherence.assessments, `${path}.adherence.assessments`, parseAdherenceAssessment),
      typeConclusions: map(adherence.typeConclusions, `${path}.adherence.typeConclusions`, parseAdherenceType),
      patientProfiles: map(adherence.patientProfiles, `${path}.adherence.patientProfiles`, parseAdherenceProfile),
      barrierAssessments: map(adherence.barrierAssessments, `${path}.adherence.barrierAssessments`, parseBarrierAssessment),
      barriers: map(adherence.barriers, `${path}.adherence.barriers`, parseBarrier),
      strategies: map(adherence.strategies, `${path}.adherence.strategies`, parseStrategy),
    },
    professionalActions: map(source.professionalActions, `${path}.professionalActions`, parseAction),
    pharmaceuticalInterventions: map(source.pharmaceuticalInterventions, `${path}.pharmaceuticalInterventions`, parseIntervention),
    referral: parseReferral(source.referral, `${path}.referral`),
    evidenceRules: map(source.evidenceRules, `${path}.evidenceRules`, parseEvidenceRule),
  };
}

type AnyAiConclusion = AiEvaluatorConclusion<string, unknown>;
type ConclusionEntry = { conclusion: AnyAiConclusion; path: string };

function conclusionEntries(evaluator: AiEvaluatorDraftV2): ConclusionEntry[] {
  const entries: ConclusionEntry[] = [];
  const add = (conclusion: AnyAiConclusion, path: string) => entries.push({ conclusion, path });
  add(evaluator.carePath.initialSpfa, 'evaluator.carePath.initialSpfa');
  evaluator.carePath.additionalSpfas.forEach((item, i) => add(item, `evaluator.carePath.additionalSpfas[${i}]`));
  evaluator.carePath.transitions.forEach((item, i) => add(item, `evaluator.carePath.transitions[${i}]`));
  add(evaluator.incidence.assessment, 'evaluator.incidence.assessment');
  evaluator.incidence.findings.forEach((item, i) => add(item, `evaluator.incidence.findings[${i}]`));
  evaluator.incidence.followUpEpisodes.forEach((item, i) => add(item, `evaluator.incidence.followUpEpisodes[${i}]`));
  add(evaluator.prm.assessment, 'evaluator.prm.assessment');
  evaluator.prm.findings.forEach((item, i) => add(item, `evaluator.prm.findings[${i}]`));
  evaluator.rnmAssessments.forEach((item, i) => add(item, `evaluator.rnmAssessments[${i}]`));
  evaluator.prmRnmRelations.forEach((item, i) => add(item, `evaluator.prmRnmRelations[${i}]`));
  evaluator.adherence.assessments.forEach((item, i) => add(item, `evaluator.adherence.assessments[${i}]`));
  evaluator.adherence.typeConclusions.forEach((item, i) => add(item, `evaluator.adherence.typeConclusions[${i}]`));
  evaluator.adherence.patientProfiles.forEach((item, i) => add(item, `evaluator.adherence.patientProfiles[${i}]`));
  evaluator.adherence.barrierAssessments.forEach((item, i) => add(item, `evaluator.adherence.barrierAssessments[${i}]`));
  evaluator.adherence.barriers.forEach((item, i) => add(item, `evaluator.adherence.barriers[${i}]`));
  evaluator.adherence.strategies.forEach((item, i) => add(item, `evaluator.adherence.strategies[${i}]`));
  evaluator.professionalActions.forEach((item, i) => add(item, `evaluator.professionalActions[${i}]`));
  evaluator.pharmaceuticalInterventions.forEach((item, i) => add(item, `evaluator.pharmaceuticalInterventions[${i}]`));
  add(evaluator.referral, 'evaluator.referral');
  return entries;
}

function validateLocalGraph(draft: AiGeneratedCaseDraftV2): void {
  const facts = new Set<string>();
  const visitFacts = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visitFacts(item, `${path}[${index}]`));
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.localFactKey === 'string') {
      if (facts.has(record.localFactKey)) fail('duplicate_local_key', `${path}.localFactKey`, `duplicate AiFactKey: ${record.localFactKey}`);
      facts.add(record.localFactKey);
    }
    Object.entries(record).forEach(([key, item]) => visitFacts(item, `${path}.${key}`));
  };
  visitFacts(draft.patientFacts, 'patientFacts');

  const medications = new Set<string>();
  const medicationEntries = [
    ...draft.patientFacts.pharmacotherapy.prescribedMedications.map((item, i) => ({ item, path: `patientFacts.pharmacotherapy.prescribedMedications[${i}]` })),
    ...draft.patientFacts.pharmacotherapy.otherMedicinesAndProducts.map((item, i) => ({ item, path: `patientFacts.pharmacotherapy.otherMedicinesAndProducts[${i}]` })),
  ];
  medicationEntries.forEach(({ item, path }) => {
    if (medications.has(item.localMedicationKey)) fail('duplicate_local_key', `${path}.localMedicationKey`, `duplicate AiMedicationKey: ${item.localMedicationKey}`);
    medications.add(item.localMedicationKey);
  });

  const uses = new Set<string>();
  const requireMedication = (reference: AiMedicationKey, path: string) => {
    if (!medications.has(reference)) fail('unresolved_local_reference', path, `unknown AiMedicationKey: ${reference}`, 'medication');
  };
  const requireFact = (reference: AiFactKey, path: string, evidence = false) => {
    if (!facts.has(reference)) fail(evidence ? 'invalid_evidence' : 'unresolved_local_reference', path, `unknown AiFactKey: ${reference}`, 'fact');
  };
  draft.patientFacts.pharmacotherapy.actualMedicationUse.forEach((item, index) => {
    const path = `patientFacts.pharmacotherapy.actualMedicationUse[${index}]`;
    if (uses.has(item.localUseKey)) fail('duplicate_local_key', `${path}.localUseKey`, `duplicate AiMedicationUseKey: ${item.localUseKey}`);
    uses.add(item.localUseKey);
    requireMedication(item.medicationRef, `${path}.medicationRef`);
    const groups = [
      ['circumstanceFactRefs', item.circumstanceFactRefs],
      ['statedReasonFactRefs', item.statedReasonFactRefs],
      ['perceivedEffectFactRefs', item.perceivedEffectFactRefs],
      ['practicalDifficultyFactRefs', item.practicalDifficultyFactRefs],
      ['strategyTriedFactRefs', item.strategyTriedFactRefs],
    ] as const;
    groups.forEach(([field, refs]) => refs.forEach((ref, i) => requireFact(ref, `${path}.${field}[${i}]`)));
  });
  (['recentChanges', 'perceivedEffectiveness', 'perceivedSafety'] as const).forEach((field) =>
    draft.patientFacts.pharmacotherapy[field].forEach((item, i) => requireMedication(item.medicationRef, `patientFacts.pharmacotherapy.${field}[${i}].medicationRef`)),
  );

  const conclusions = new Map<string, ConclusionEntry>();
  conclusionEntries(draft.evaluator).forEach((entry) => {
    const key = entry.conclusion.localConclusionKey;
    if (conclusions.has(key)) fail('duplicate_local_key', `${entry.path}.localConclusionKey`, `duplicate AiConclusionKey: ${key}`);
    conclusions.set(key, entry);
  });
  const requireKind = (reference: AiConclusionKey, expected: string | readonly string[], path: string, evidence = false): ConclusionEntry => {
    const entry = conclusions.get(reference);
    const expectedKinds = typeof expected === 'string' ? [expected] : expected;
    if (entry === undefined) fail(evidence ? 'invalid_evidence' : 'unresolved_local_reference', path, `unknown AiConclusionKey: ${reference}`, expectedKinds.join('|'));
    if (!expectedKinds.includes(entry.conclusion.kind)) {
      fail(evidence ? 'invalid_evidence' : 'unresolved_local_reference', path, `expected ${expectedKinds.join('|')} but found ${entry.conclusion.kind}`, expectedKinds.join('|'), entry.conclusion.kind);
    }
    return entry;
  };
  const checkMeds = (refs: readonly AiMedicationKey[], path: string) => refs.forEach((ref, i) => requireMedication(ref, `${path}[${i}]`));

  draft.evaluator.carePath.transitions.forEach((item, i) => {
    requireKind(item.value.fromSpfaRef, 'spfa', `evaluator.carePath.transitions[${i}].value.fromSpfaRef`);
    requireKind(item.value.toSpfaRef, 'spfa', `evaluator.carePath.transitions[${i}].value.toSpfaRef`);
  });
  draft.evaluator.incidence.findings.forEach((item, i) => {
    requireKind(item.value.spfaRef, 'spfa', `evaluator.incidence.findings[${i}].value.spfaRef`);
    checkMeds(item.value.medicationRefs, `evaluator.incidence.findings[${i}].value.medicationRefs`);
  });
  draft.evaluator.incidence.followUpEpisodes.forEach((item, i) => requireKind(item.value.incidenceRef, 'incidence', `evaluator.incidence.followUpEpisodes[${i}].value.incidenceRef`));
  draft.evaluator.prm.findings.forEach((item, i) => {
    checkMeds(item.value.medicationRefs, `evaluator.prm.findings[${i}].value.medicationRefs`);
    if (item.value.followUpEpisodeRef !== undefined) requireKind(item.value.followUpEpisodeRef, 'follow_up_episode', `evaluator.prm.findings[${i}].value.followUpEpisodeRef`);
  });
  draft.evaluator.rnmAssessments.forEach((item, i) => {
    if (item.value.status !== 'no_rnm') {
      checkMeds(item.value.medicationRefs, `evaluator.rnmAssessments[${i}].value.medicationRefs`);
      if (item.value.followUpEpisodeRef !== undefined) requireKind(item.value.followUpEpisodeRef, 'follow_up_episode', `evaluator.rnmAssessments[${i}].value.followUpEpisodeRef`);
    }
  });
  draft.evaluator.prmRnmRelations.forEach((item, i) => {
    requireKind(item.value.prmRef, 'prm', `evaluator.prmRnmRelations[${i}].value.prmRef`);
    requireKind(item.value.rnmAssessmentRef, 'rnm_assessment', `evaluator.prmRnmRelations[${i}].value.rnmAssessmentRef`);
  });
  draft.evaluator.adherence.assessments.forEach((item, i) => checkMeds(item.value.medicationRefs, `evaluator.adherence.assessments[${i}].value.medicationRefs`));
  draft.evaluator.adherence.typeConclusions.forEach((item, i) => requireKind(item.value.adherenceAssessmentRef, 'adherence_assessment', `evaluator.adherence.typeConclusions[${i}].value.adherenceAssessmentRef`));
  draft.evaluator.adherence.patientProfiles.forEach((item, i) => requireKind(item.value.adherenceAssessmentRef, 'adherence_assessment', `evaluator.adherence.patientProfiles[${i}].value.adherenceAssessmentRef`));
  draft.evaluator.adherence.barrierAssessments.forEach((item, i) => requireKind(item.value.adherenceAssessmentRef, 'adherence_assessment', `evaluator.adherence.barrierAssessments[${i}].value.adherenceAssessmentRef`));
  draft.evaluator.adherence.barriers.forEach((item, i) => requireKind(item.value.barrierAssessmentRef, 'adherence_barrier_assessment', `evaluator.adherence.barriers[${i}].value.barrierAssessmentRef`));
  draft.evaluator.adherence.strategies.forEach((item, i) => {
    requireKind(item.value.adherenceAssessmentRef, 'adherence_assessment', `evaluator.adherence.strategies[${i}].value.adherenceAssessmentRef`);
    item.value.addressedBarrierRefs.forEach((ref, j) => requireKind(ref, 'adherence_barrier', `evaluator.adherence.strategies[${i}].value.addressedBarrierRefs[${j}]`));
  });
  draft.evaluator.professionalActions.forEach((item, i) => {
    requireKind(item.value.spfaRef, 'spfa', `evaluator.professionalActions[${i}].value.spfaRef`);
    if (item.value.targetSpfaRef !== undefined) requireKind(item.value.targetSpfaRef, 'spfa', `evaluator.professionalActions[${i}].value.targetSpfaRef`);
    if (item.value.referralRef !== undefined) requireKind(item.value.referralRef, 'referral', `evaluator.professionalActions[${i}].value.referralRef`);
  });
  draft.evaluator.pharmaceuticalInterventions.forEach((item, i) => {
    requireKind(item.value.spfaRef, 'spfa', `evaluator.pharmaceuticalInterventions[${i}].value.spfaRef`);
    if (item.value.professionalActionRef !== undefined) requireKind(item.value.professionalActionRef, 'professional_action', `evaluator.pharmaceuticalInterventions[${i}].value.professionalActionRef`);
    item.value.addressedConclusionRefs.forEach((ref, j) => {
      const entry = conclusions.get(ref);
      if (entry === undefined) fail('unresolved_local_reference', `evaluator.pharmaceuticalInterventions[${i}].value.addressedConclusionRefs[${j}]`, `unknown AiConclusionKey: ${ref}`, [...INTERVENTION_TARGET_KINDS].join('|'));
      if (!INTERVENTION_TARGET_KINDS.has(entry.conclusion.kind)) fail('unresolved_local_reference', `evaluator.pharmaceuticalInterventions[${i}].value.addressedConclusionRefs[${j}]`, `conclusion kind ${entry.conclusion.kind} cannot be addressed`, [...INTERVENTION_TARGET_KINDS].join('|'), entry.conclusion.kind);
    });
    if (item.value.referralRef !== undefined) requireKind(item.value.referralRef, 'referral', `evaluator.pharmaceuticalInterventions[${i}].value.referralRef`);
  });

  const validateEvidenceLeaf = (leaf: AiEvidenceLeafRef, path: string) => {
    if (leaf.operator === 'fact') requireFact(leaf.factRef, `${path}.factRef`, true);
  };
  const validateExpression = (expression: AiEvidenceExpression, path: string): void => {
    if (expression.operator === 'all' || expression.operator === 'any') expression.operands.forEach((item, i) => validateExpression(item, `${path}.operands[${i}]`));
    else validateEvidenceLeaf(expression, path);
  };
  draft.evaluator.evidenceRules.forEach((rule, i) => {
    const path = `evaluator.evidenceRules[${i}]`;
    const conclusion = conclusions.get(rule.conclusionRef);
    if (conclusion === undefined) fail('invalid_evidence', `${path}.conclusionRef`, `unknown AiConclusionKey: ${rule.conclusionRef}`, 'evidence-capable conclusion');
    if (!EVIDENCE_RULE_KINDS.has(conclusion.conclusion.kind)) fail('invalid_evidence', `${path}.conclusionRef`, `conclusion kind ${conclusion.conclusion.kind} does not accept EvidenceRule`, [...EVIDENCE_RULE_KINDS].join('|'), conclusion.conclusion.kind);
    validateExpression(rule.requiredEvidence, `${path}.requiredEvidence`);
    rule.supportingEvidenceRefs.forEach((leaf, j) => validateEvidenceLeaf(leaf, `${path}.supportingEvidenceRefs[${j}]`));
    rule.counterEvidenceRefs.forEach((leaf, j) => validateEvidenceLeaf(leaf, `${path}.counterEvidenceRefs[${j}]`));
  });
}

export function validateAiGeneratedCaseDraftV2(input: unknown): AiGeneratedCaseDraftV2 {
  const source = asRecord(input, 'aiGeneratedCaseDraft');
  exact(source, ['contractVersion', 'patientFacts', 'evaluator'], 'aiGeneratedCaseDraft');
  if (source.contractVersion !== AI_GENERATION_CONTRACT_VERSION) {
    shape('aiGeneratedCaseDraft.contractVersion', `must be ${AI_GENERATION_CONTRACT_VERSION}`);
  }
  const draft: AiGeneratedCaseDraftV2 = {
    contractVersion: AI_GENERATION_CONTRACT_VERSION,
    patientFacts: parsePatientFacts(source.patientFacts),
    evaluator: parseEvaluator(source.evaluator),
  };
  validateLocalGraph(draft);
  return draft;
}
