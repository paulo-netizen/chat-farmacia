import type {
  AiConclusionKey,
  AiDisclosureIntent,
  AiEvaluatorConclusion,
  AiEvidenceExpression,
  AiEvidenceLeafRef,
  AiFactKey,
  AiGeneratedCaseDraftV2,
  AiMedicationKey,
  AiMedicationUseKey,
  AiPatientDatum,
  AiTaxonomyCatalog,
  AiTaxonomyConceptRef,
} from './ai-generation-types';
import type {
  AdherenceAssessment,
  AdherenceBarrier,
  AdherenceBarrierAssessment,
  AdherencePatientProfileConclusion,
  AdherenceStrategy,
  ConclusionId,
  EvaluatorVersionsV2,
  EvaluatorViewV2,
  EvidenceExpression,
  EvidenceLeafRef,
  EvidenceRule,
  FollowUpEpisode,
  IncidenceAssessment,
  IncidenceFinding,
  NonAdherenceTypeConclusion,
  PharmaceuticalIntervention,
  ProfessionalAction,
  PrmAssessment,
  PrmFinding,
  PrmRnmRelation,
  ReferralConclusion,
  RnmAssessment,
  SpfaConclusion,
  SpfaTransition,
  TaxonomyTermRef,
  VersionRef,
} from './evaluator-types';
import {
  GenerationAssemblyError,
  type CanonicalGeneratedCaseCoreV2,
  type DisclosureResolutionContextV2,
  type GenerationAssemblyContextV2,
} from './generation-assembly-types';
import { createPatientRuntimeViewV2 } from './patient-runtime';
import type {
  BiomedicalDatumValue,
  CasePatientFactsDraftV2,
  DisclosureDelay,
  DisclosureDomain,
  DisclosureRule,
  FactId,
  MedicationId,
  MedicationLinkedFactDraftV2,
  MedicationUseId,
  MedicationUsePatternDraftV2,
  PatientClinicalContextDraftV2,
  PatientDatum,
  PatientEncounterDraftV2,
  PatientMedicationDraftV2,
  PatientPharmacotherapyDraftV2,
  PatientSymptomDraftV2,
} from './types';
import { validateEvaluatorViewV2 } from './validate-evaluator-view';
import { validateCasePatientFactsDraftV2 } from './validate-patient-facts';

const DISCLOSURE_DOMAINS = new Set<DisclosureDomain>([
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
]);

const DISCLOSURE_DELAYS = new Set<DisclosureDelay>([
  'judgmental_tone',
  'accusatory_question',
  'lack_of_empathy',
  'patient_minimization',
]);

type LocalMaps = Readonly<{
  medications: ReadonlyMap<AiMedicationKey, MedicationId>;
  medicationUses: ReadonlyMap<AiMedicationUseKey, MedicationUseId>;
  facts: ReadonlyMap<AiFactKey, FactId>;
  conclusions: ReadonlyMap<AiConclusionKey, ConclusionId>;
}>;

type ConclusionEntry = Readonly<{
  conclusion: AiEvaluatorConclusion<string, unknown>;
  path: string;
}>;

function assemblyError(
  code: GenerationAssemblyError['code'],
  path: string,
  message: string,
  cause?: unknown,
): never {
  throw new GenerationAssemblyError(code, path, message, cause);
}

function mapValue<K extends string, V extends string>(
  mapping: ReadonlyMap<K, V>,
  key: K,
  path: string,
): V {
  const value = mapping.get(key);
  if (value === undefined) {
    assemblyError(
      'unresolved_mapping',
      path,
      `no canonical ID was allocated for local key ${key}`,
    );
  }
  return value;
}

function allocateMap<K extends string, V extends string>(
  entries: readonly Readonly<{ key: K; path: string }>[],
  allocate: (key: K) => V,
  canonicalKind: string,
): ReadonlyMap<K, V> {
  const mapping = new Map<K, V>();
  const canonicalOwners = new Map<V, K>();

  for (const { key, path } of entries) {
    if (mapping.has(key)) continue;
    let canonicalId: V;
    try {
      canonicalId = allocate(key);
    } catch (cause) {
      assemblyError(
        'unresolved_mapping',
        path,
        `allocator failed for ${key}`,
        cause,
      );
    }
    const owner = canonicalOwners.get(canonicalId);
    if (owner !== undefined && owner !== key) {
      assemblyError(
        'duplicate_canonical_id',
        path,
        `${canonicalKind} ${canonicalId} was allocated for both ${owner} and ${key}`,
      );
    }
    mapping.set(key, canonicalId);
    canonicalOwners.set(canonicalId, key);
  }

  return mapping;
}

function collectFactEntries(
  patientFacts: AiGeneratedCaseDraftV2['patientFacts'],
): ReadonlyArray<Readonly<{ key: AiFactKey; path: string }>> {
  const entries: Array<Readonly<{ key: AiFactKey; path: string }>> = [];
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.localFactKey === 'string') {
      entries.push({
        key: record.localFactKey as AiFactKey,
        path: `${path}.localFactKey`,
      });
    }
    Object.entries(record).forEach(([key, item]) => visit(item, `${path}.${key}`));
  };
  visit(patientFacts, 'patientFacts');
  return entries;
}

function collectConclusionEntries(
  evaluator: AiGeneratedCaseDraftV2['evaluator'],
): ConclusionEntry[] {
  const entries: ConclusionEntry[] = [];
  const add = (
    conclusion: AiEvaluatorConclusion<string, unknown>,
    path: string,
  ) => entries.push({ conclusion, path });

  add(evaluator.carePath.initialSpfa, 'evaluator.carePath.initialSpfa');
  evaluator.carePath.additionalSpfas.forEach((item, index) =>
    add(item, `evaluator.carePath.additionalSpfas[${index}]`),
  );
  evaluator.carePath.transitions.forEach((item, index) =>
    add(item, `evaluator.carePath.transitions[${index}]`),
  );
  add(evaluator.incidence.assessment, 'evaluator.incidence.assessment');
  evaluator.incidence.findings.forEach((item, index) =>
    add(item, `evaluator.incidence.findings[${index}]`),
  );
  evaluator.incidence.followUpEpisodes.forEach((item, index) =>
    add(item, `evaluator.incidence.followUpEpisodes[${index}]`),
  );
  add(evaluator.prm.assessment, 'evaluator.prm.assessment');
  evaluator.prm.findings.forEach((item, index) =>
    add(item, `evaluator.prm.findings[${index}]`),
  );
  evaluator.rnmAssessments.forEach((item, index) =>
    add(item, `evaluator.rnmAssessments[${index}]`),
  );
  evaluator.prmRnmRelations.forEach((item, index) =>
    add(item, `evaluator.prmRnmRelations[${index}]`),
  );
  evaluator.adherence.assessments.forEach((item, index) =>
    add(item, `evaluator.adherence.assessments[${index}]`),
  );
  evaluator.adherence.typeConclusions.forEach((item, index) =>
    add(item, `evaluator.adherence.typeConclusions[${index}]`),
  );
  evaluator.adherence.patientProfiles.forEach((item, index) =>
    add(item, `evaluator.adherence.patientProfiles[${index}]`),
  );
  evaluator.adherence.barrierAssessments.forEach((item, index) =>
    add(item, `evaluator.adherence.barrierAssessments[${index}]`),
  );
  evaluator.adherence.barriers.forEach((item, index) =>
    add(item, `evaluator.adherence.barriers[${index}]`),
  );
  evaluator.adherence.strategies.forEach((item, index) =>
    add(item, `evaluator.adherence.strategies[${index}]`),
  );
  evaluator.professionalActions.forEach((item, index) =>
    add(item, `evaluator.professionalActions[${index}]`),
  );
  evaluator.pharmaceuticalInterventions.forEach((item, index) =>
    add(item, `evaluator.pharmaceuticalInterventions[${index}]`),
  );
  add(evaluator.referral, 'evaluator.referral');
  return entries;
}

function buildLocalMaps(
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
): LocalMaps {
  const medicationEntries = [
    ...draft.patientFacts.pharmacotherapy.prescribedMedications.map(
      (medication, index) => ({
        key: medication.localMedicationKey,
        path: `patientFacts.pharmacotherapy.prescribedMedications[${index}].localMedicationKey`,
      }),
    ),
    ...draft.patientFacts.pharmacotherapy.otherMedicinesAndProducts.map(
      (medication, index) => ({
        key: medication.localMedicationKey,
        path: `patientFacts.pharmacotherapy.otherMedicinesAndProducts[${index}].localMedicationKey`,
      }),
    ),
  ];
  const useEntries = draft.patientFacts.pharmacotherapy.actualMedicationUse.map(
    (use, index) => ({
      key: use.localUseKey,
      path: `patientFacts.pharmacotherapy.actualMedicationUse[${index}].localUseKey`,
    }),
  );
  const conclusionEntries = collectConclusionEntries(draft.evaluator);

  return {
    medications: allocateMap(
      medicationEntries,
      context.allocateMedicationId,
      'MedicationId',
    ),
    medicationUses: allocateMap(
      useEntries,
      context.allocateMedicationUseId,
      'MedicationUseId',
    ),
    facts: allocateMap(
      collectFactEntries(draft.patientFacts),
      context.allocateFactId,
      'FactId',
    ),
    conclusions: allocateMap(
      conclusionEntries.map(({ conclusion, path }) => ({
        key: conclusion.localConclusionKey,
        path: `${path}.localConclusionKey`,
      })),
      context.allocateConclusionId,
      'ConclusionId',
    ),
  };
}

function cloneIntent(intent: AiDisclosureIntent): AiDisclosureIntent {
  if (!('domains' in intent)) {
    return { mode: intent.mode };
  }
  return {
    mode: intent.mode,
    domains: [...intent.domains] as typeof intent.domains,
  };
}

function objectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    assemblyError(
      'disclosure_resolution_failed',
      path,
      'resolver must return a DisclosureRule object',
    );
  }
  return value as Record<string, unknown>;
}

function exactDisclosureKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const keys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!keys.has(key)) {
      assemblyError(
        'disclosure_resolution_failed',
        `${path}.${key}`,
        'resolver returned an unexpected DisclosureRule property',
      );
    }
  }
}

function parseDisclosureArray<T extends string>(
  value: unknown,
  allowed: ReadonlySet<T>,
  path: string,
): T[] {
  if (!Array.isArray(value)) {
    assemblyError('disclosure_resolution_failed', path, 'must be an array');
  }
  return value.map((item, index) => {
    if (typeof item !== 'string' || !allowed.has(item as T)) {
      assemblyError(
        'disclosure_resolution_failed',
        `${path}[${index}]`,
        'contains an unsupported value',
      );
    }
    return item as T;
  });
}

function validateResolvedDisclosure(
  value: unknown,
  path: string,
): DisclosureRule {
  const source = objectRecord(value, path);
  const mode = source.mode;
  const delayedBy =
    source.delayedBy === undefined
      ? undefined
      : parseDisclosureArray(
          source.delayedBy,
          DISCLOSURE_DELAYS,
          `${path}.delayedBy`,
        );
  const delay = delayedBy === undefined ? {} : { delayedBy };

  if (mode === 'spontaneous' || mode === 'open_question') {
    exactDisclosureKeys(source, ['mode', 'delayedBy'], path);
    return { mode, ...delay };
  }
  if (
    mode !== 'domain_exploration' &&
    mode !== 'specific_question' &&
    mode !== 'rapport_required'
  ) {
    assemblyError(
      'disclosure_resolution_failed',
      `${path}.mode`,
      'resolver returned an unsupported disclosure mode',
    );
  }

  const domains = parseDisclosureArray(
    source.domains,
    DISCLOSURE_DOMAINS,
    `${path}.domains`,
  );
  if (domains.length === 0) {
    assemblyError(
      'disclosure_resolution_failed',
      `${path}.domains`,
      'must contain at least one domain',
    );
  }
  if (mode === 'rapport_required') {
    exactDisclosureKeys(
      source,
      ['mode', 'domains', 'minimumRapport', 'delayedBy'],
      path,
    );
    if (
      typeof source.minimumRapport !== 'number' ||
      !Number.isFinite(source.minimumRapport) ||
      source.minimumRapport < 0 ||
      source.minimumRapport > 100
    ) {
      assemblyError(
        'disclosure_resolution_failed',
        `${path}.minimumRapport`,
        'must be a finite number from 0 to 100',
      );
    }
    return {
      mode,
      domains,
      minimumRapport: source.minimumRapport,
      ...delay,
    };
  }
  exactDisclosureKeys(source, ['mode', 'domains', 'delayedBy'], path);
  return { mode, domains, ...delay };
}

function validateDisclosureIntentPreserved(
  intent: AiDisclosureIntent,
  resolved: DisclosureRule,
  path: string,
): void {
  if (resolved.mode !== intent.mode) {
    assemblyError(
      'disclosure_resolution_failed',
      `${path}.mode`,
      `resolver changed disclosure mode from ${intent.mode} to ${resolved.mode}`,
    );
  }

  if (!('domains' in intent)) return;
  if (!('domains' in resolved)) {
    assemblyError(
      'disclosure_resolution_failed',
      `${path}.domains`,
      'resolver removed the disclosure domains required by the intent',
    );
  }

  const intendedDomains = new Set(intent.domains);
  const resolvedDomains = new Set(resolved.domains);
  const sameDomains =
    intendedDomains.size === resolvedDomains.size &&
    [...intendedDomains].every((domain) => resolvedDomains.has(domain));
  if (!sameDomains) {
    assemblyError(
      'disclosure_resolution_failed',
      `${path}.domains`,
      'resolver must preserve exactly the disclosure intent domain set',
    );
  }
}

function resolveDisclosure(
  intent: AiDisclosureIntent,
  path: string,
  state: DisclosureResolutionContextV2['datumState'],
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
): DisclosureRule {
  try {
    const resolved = context.resolveDisclosure(cloneIntent(intent), {
      path,
      datumState: state,
      communicationProfile: { ...draft.patientFacts.communicationProfile },
    });
    const validated = validateResolvedDisclosure(resolved, path);
    validateDisclosureIntentPreserved(intent, validated, path);
    return validated;
  } catch (cause) {
    if (cause instanceof GenerationAssemblyError) throw cause;
    assemblyError(
      'disclosure_resolution_failed',
      path,
      'server-owned disclosure resolution failed',
      cause,
    );
  }
}

function mapDatum<T, U = T>(
  datum: AiPatientDatum<T>,
  path: string,
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
  maps: LocalMaps,
  mapKnownValue: (value: T) => U = (value) => value as unknown as U,
): PatientDatum<U> {
  if (datum.state === 'not_defined') return { state: 'not_defined' };
  if (datum.state === 'not_applicable') {
    return { state: 'not_applicable', reasonCode: datum.reasonCode };
  }
  const factId = mapValue(
    maps.facts,
    datum.localFactKey,
    `${path}.localFactKey`,
  );
  const disclosure = resolveDisclosure(
    datum.disclosureIntent,
    `${path}.disclosureIntent`,
    datum.state,
    draft,
    context,
  );
  if (datum.state === 'known') {
    return {
      state: 'known',
      factId,
      value: mapKnownValue(datum.value),
      certainty: datum.certainty,
      disclosure,
    };
  }
  return {
    state: datum.state,
    factId,
    topic: datum.topic,
    disclosure,
  };
}

function mapDatumArray<T, U = T>(
  values: readonly AiPatientDatum<T>[],
  path: string,
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
  maps: LocalMaps,
  mapKnownValue?: (value: T) => U,
): PatientDatum<U>[] {
  return values.map((value, index) =>
    mapDatum(
      value,
      `${path}[${index}]`,
      draft,
      context,
      maps,
      mapKnownValue,
    ),
  );
}

function mapMedication(
  medication: AiGeneratedCaseDraftV2['patientFacts']['pharmacotherapy']['prescribedMedications'][number],
  path: string,
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
  maps: LocalMaps,
): PatientMedicationDraftV2 {
  const datum = <T>(value: AiPatientDatum<T>, field: string) =>
    mapDatum(value, `${path}.${field}`, draft, context, maps);
  return {
    medicationId: mapValue(
      maps.medications,
      medication.localMedicationKey,
      `${path}.localMedicationKey`,
    ),
    displayName: datum(medication.displayName, 'displayName'),
    origin: datum(medication.origin, 'origin'),
    purposeAsUnderstood: datum(
      medication.purposeAsUnderstood,
      'purposeAsUnderstood',
    ),
    regimenBasis: datum(medication.regimenBasis, 'regimenBasis'),
    referenceDose: datum(medication.referenceDose, 'referenceDose'),
    referenceSchedule: datum(
      medication.referenceSchedule,
      'referenceSchedule',
    ),
    referenceDuration: datum(
      medication.referenceDuration,
      'referenceDuration',
    ),
    administrationMethod: datum(
      medication.administrationMethod,
      'administrationMethod',
    ),
    specialUseConditions: mapDatumArray(
      medication.specialUseConditions,
      `${path}.specialUseConditions`,
      draft,
      context,
      maps,
    ),
  };
}

function mapMedicationUse(
  use: AiGeneratedCaseDraftV2['patientFacts']['pharmacotherapy']['actualMedicationUse'][number],
  path: string,
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
  maps: LocalMaps,
): MedicationUsePatternDraftV2 {
  const datum = (value: AiPatientDatum<string>, field: string) =>
    mapDatum(value, `${path}.${field}`, draft, context, maps);
  const factRefs = (refs: readonly AiFactKey[], field: string) =>
    refs.map((ref, index) =>
      mapValue(maps.facts, ref, `${path}.${field}[${index}]`),
    );
  return {
    useId: mapValue(maps.medicationUses, use.localUseKey, `${path}.localUseKey`),
    medicationRef: mapValue(
      maps.medications,
      use.medicationRef,
      `${path}.medicationRef`,
    ),
    action: use.action,
    actualUse: datum(use.actualUse, 'actualUse'),
    actualDose: datum(use.actualDose, 'actualDose'),
    actualSchedule: datum(use.actualSchedule, 'actualSchedule'),
    frequency: datum(use.frequency, 'frequency'),
    timePeriod: datum(use.timePeriod, 'timePeriod'),
    circumstanceFactRefs: factRefs(
      use.circumstanceFactRefs,
      'circumstanceFactRefs',
    ),
    statedReasonFactRefs: factRefs(
      use.statedReasonFactRefs,
      'statedReasonFactRefs',
    ),
    perceivedEffectFactRefs: factRefs(
      use.perceivedEffectFactRefs,
      'perceivedEffectFactRefs',
    ),
    practicalDifficultyFactRefs: factRefs(
      use.practicalDifficultyFactRefs,
      'practicalDifficultyFactRefs',
    ),
    strategyTriedFactRefs: factRefs(
      use.strategyTriedFactRefs,
      'strategyTriedFactRefs',
    ),
  };
}

function mapMedicationLinkedFacts(
  values: readonly AiGeneratedCaseDraftV2['patientFacts']['pharmacotherapy']['recentChanges'][number][],
  path: string,
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
  maps: LocalMaps,
): MedicationLinkedFactDraftV2[] {
  return values.map((value, index) => ({
    medicationRef: mapValue(
      maps.medications,
      value.medicationRef,
      `${path}[${index}].medicationRef`,
    ),
    detail: mapDatum(
      value.detail,
      `${path}[${index}].detail`,
      draft,
      context,
      maps,
    ),
  }));
}

function assemblePatientFacts(
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
  maps: LocalMaps,
): CasePatientFactsDraftV2 {
  const source = draft.patientFacts;
  const datumArray = (values: readonly AiPatientDatum<string>[], path: string) =>
    mapDatumArray(values, path, draft, context, maps);
  const encounter: PatientEncounterDraftV2 = {
    personPresent: mapDatum(
      source.encounter.personPresent,
      'patientFacts.encounter.personPresent',
      draft,
      context,
      maps,
    ),
    relationshipToPatient: mapDatum(
      source.encounter.relationshipToPatient,
      'patientFacts.encounter.relationshipToPatient',
      draft,
      context,
      maps,
    ),
  };
  const clinicalContext: PatientClinicalContextDraftV2 = {
    healthProblems: datumArray(
      source.clinicalContext.healthProblems,
      'patientFacts.clinicalContext.healthProblems',
    ),
    clinicalHistory: datumArray(
      source.clinicalContext.clinicalHistory,
      'patientFacts.clinicalContext.clinicalHistory',
    ),
    physiologicalSituation: datumArray(
      source.clinicalContext.physiologicalSituation,
      'patientFacts.clinicalContext.physiologicalSituation',
    ),
    pregnancyAndLactation: mapDatum(
      source.clinicalContext.pregnancyAndLactation,
      'patientFacts.clinicalContext.pregnancyAndLactation',
      draft,
      context,
      maps,
    ),
    allergiesAndIntolerances: datumArray(
      source.clinicalContext.allergiesAndIntolerances,
      'patientFacts.clinicalContext.allergiesAndIntolerances',
    ),
    lifestyle: datumArray(
      source.clinicalContext.lifestyle,
      'patientFacts.clinicalContext.lifestyle',
    ),
    biomedicalData: mapDatumArray(
      source.clinicalContext.biomedicalData,
      'patientFacts.clinicalContext.biomedicalData',
      draft,
      context,
      maps,
      (value: BiomedicalDatumValue) => ({ ...value }),
    ),
  };
  const symptoms: PatientSymptomDraftV2[] = source.symptoms.map(
    (symptom, index) => {
      const path = `patientFacts.symptoms[${index}]`;
      return {
        description: mapDatum(
          symptom.description,
          `${path}.description`,
          draft,
          context,
          maps,
        ),
        onset: mapDatum(symptom.onset, `${path}.onset`, draft, context, maps),
        duration: mapDatum(
          symptom.duration,
          `${path}.duration`,
          draft,
          context,
          maps,
        ),
        evolution: mapDatum(
          symptom.evolution,
          `${path}.evolution`,
          draft,
          context,
          maps,
        ),
        relevantCircumstances: datumArray(
          symptom.relevantCircumstances,
          `${path}.relevantCircumstances`,
        ),
      };
    },
  );
  const pharmacotherapy: PatientPharmacotherapyDraftV2 = {
    prescribedMedications: source.pharmacotherapy.prescribedMedications.map(
      (medication, index) =>
        mapMedication(
          medication,
          `patientFacts.pharmacotherapy.prescribedMedications[${index}]`,
          draft,
          context,
          maps,
        ),
    ),
    otherMedicinesAndProducts:
      source.pharmacotherapy.otherMedicinesAndProducts.map(
        (medication, index) =>
          mapMedication(
            medication,
            `patientFacts.pharmacotherapy.otherMedicinesAndProducts[${index}]`,
            draft,
            context,
            maps,
          ),
      ),
    actualMedicationUse: source.pharmacotherapy.actualMedicationUse.map(
      (use, index) =>
        mapMedicationUse(
          use,
          `patientFacts.pharmacotherapy.actualMedicationUse[${index}]`,
          draft,
          context,
          maps,
        ),
    ),
    recentChanges: mapMedicationLinkedFacts(
      source.pharmacotherapy.recentChanges,
      'patientFacts.pharmacotherapy.recentChanges',
      draft,
      context,
      maps,
    ),
    perceivedEffectiveness: mapMedicationLinkedFacts(
      source.pharmacotherapy.perceivedEffectiveness,
      'patientFacts.pharmacotherapy.perceivedEffectiveness',
      draft,
      context,
      maps,
    ),
    perceivedSafety: mapMedicationLinkedFacts(
      source.pharmacotherapy.perceivedSafety,
      'patientFacts.pharmacotherapy.perceivedSafety',
      draft,
      context,
      maps,
    ),
  };

  return {
    schemaVersion: '2.0',
    caseVersionId: context.caseVersionId,
    publicProfile: { ...source.publicProfile },
    initialDemand: mapDatum(
      source.initialDemand,
      'patientFacts.initialDemand',
      draft,
      context,
      maps,
    ),
    encounter,
    clinicalContext,
    symptoms,
    pharmacotherapy,
    actionsAlreadyTaken: datumArray(
      source.actionsAlreadyTaken,
      'patientFacts.actionsAlreadyTaken',
    ),
    practicalDifficulties: datumArray(
      source.practicalDifficulties,
      'patientFacts.practicalDifficulties',
    ),
    beliefsAndConcerns: datumArray(
      source.beliefsAndConcerns,
      'patientFacts.beliefsAndConcerns',
    ),
    strategiesAlreadyTried: datumArray(
      source.strategiesAlreadyTried,
      'patientFacts.strategiesAlreadyTried',
    ),
    dailyAndSocialContext: datumArray(
      source.dailyAndSocialContext,
      'patientFacts.dailyAndSocialContext',
    ),
    familyAndSocialSupport: datumArray(
      source.familyAndSocialSupport,
      'patientFacts.familyAndSocialSupport',
    ),
    relationshipWithProfessionals: datumArray(
      source.relationshipWithProfessionals,
      'patientFacts.relationshipWithProfessionals',
    ),
    communicationProfile: { ...source.communicationProfile },
  };
}

function cloneVersion(version: VersionRef): VersionRef {
  return { id: version.id, version: version.version };
}

function cloneVersions(versions: EvaluatorVersionsV2): EvaluatorVersionsV2 {
  const optional = <K extends keyof EvaluatorVersionsV2>(field: K) => {
    const value = versions[field];
    return value === undefined ? undefined : cloneVersion(value);
  };
  const barrierTaxonomy = optional('barrierTaxonomy');
  const professionalActionTaxonomy = optional('professionalActionTaxonomy');
  const pharmaceuticalInterventionTaxonomy = optional(
    'pharmaceuticalInterventionTaxonomy',
  );
  const referralDestinationTaxonomy = optional('referralDestinationTaxonomy');
  return {
    evaluatorSchema: cloneVersion(versions.evaluatorSchema),
    protocol: cloneVersion(versions.protocol),
    prmTaxonomy: cloneVersion(versions.prmTaxonomy),
    rnmTaxonomy: cloneVersion(versions.rnmTaxonomy),
    adherenceFramework: cloneVersion(versions.adherenceFramework),
    ...(barrierTaxonomy === undefined ? {} : { barrierTaxonomy }),
    ...(professionalActionTaxonomy === undefined
      ? {}
      : { professionalActionTaxonomy }),
    ...(pharmaceuticalInterventionTaxonomy === undefined
      ? {}
      : { pharmaceuticalInterventionTaxonomy }),
    ...(referralDestinationTaxonomy === undefined
      ? {}
      : { referralDestinationTaxonomy }),
  };
}

function taxonomyVersion(
  catalog: AiTaxonomyCatalog,
  versions: EvaluatorVersionsV2,
): VersionRef | undefined {
  switch (catalog) {
    case 'prm':
      return versions.prmTaxonomy;
    case 'rnm':
      return versions.rnmTaxonomy;
    case 'adherence_barrier':
      return versions.barrierTaxonomy;
    case 'professional_action':
      return versions.professionalActionTaxonomy;
    case 'pharmaceutical_intervention':
      return versions.pharmaceuticalInterventionTaxonomy;
    case 'referral_destination':
      return versions.referralDestinationTaxonomy;
  }
}

function resolveTaxonomy(
  ref: AiTaxonomyConceptRef,
  path: string,
  context: GenerationAssemblyContextV2,
): TaxonomyTermRef {
  try {
    const result = context.resolveTaxonomy({
      catalog: ref.catalog,
      conceptId: ref.conceptId,
    });
    if (typeof result !== 'object' || result === null) {
      assemblyError(
        'taxonomy_resolution_failed',
        path,
        'resolver must return a TaxonomyTermRef object',
      );
    }
    const expected = taxonomyVersion(ref.catalog, context.evaluatorVersions);
    if (expected === undefined) {
      assemblyError(
        'taxonomy_resolution_failed',
        path,
        `no server-owned taxonomy version is configured for ${ref.catalog}`,
      );
    }
    if (
      typeof result.taxonomyId !== 'string' ||
      result.taxonomyId.trim().length === 0 ||
      typeof result.taxonomyVersion !== 'string' ||
      result.taxonomyVersion.trim().length === 0 ||
      typeof result.conceptId !== 'string' ||
      result.conceptId.trim().length === 0
    ) {
      assemblyError(
        'taxonomy_resolution_failed',
        path,
        'resolver returned an invalid TaxonomyTermRef',
      );
    }
    if (
      result.taxonomyId !== expected.id ||
      result.taxonomyVersion !== expected.version
    ) {
      assemblyError(
        'taxonomy_resolution_failed',
        path,
        `resolver returned taxonomy ${result.taxonomyId}@${result.taxonomyVersion}; expected ${expected.id}@${expected.version}`,
      );
    }
    return {
      taxonomyId: result.taxonomyId,
      taxonomyVersion: result.taxonomyVersion,
      conceptId: result.conceptId,
    };
  } catch (cause) {
    if (cause instanceof GenerationAssemblyError) throw cause;
    assemblyError(
      'taxonomy_resolution_failed',
      path,
      `server-owned taxonomy resolution failed for ${ref.catalog}:${ref.conceptId}`,
      cause,
    );
  }
}

function conclusionId(
  key: AiConclusionKey,
  path: string,
  maps: LocalMaps,
): ConclusionId {
  return mapValue(maps.conclusions, key, path);
}

function medicationIds(
  keys: readonly AiMedicationKey[],
  path: string,
  maps: LocalMaps,
): MedicationId[] {
  return keys.map((key, index) =>
    mapValue(maps.medications, key, `${path}[${index}]`),
  );
}

function mapEvidenceLeaf(
  leaf: AiEvidenceLeafRef,
  path: string,
  maps: LocalMaps,
): EvidenceLeafRef {
  return leaf.operator === 'public_profile'
    ? { operator: 'public_profile', field: leaf.field }
    : {
        operator: 'fact',
        factRef: mapValue(maps.facts, leaf.factRef, `${path}.factRef`),
      };
}

function mapEvidenceExpression(
  expression: AiEvidenceExpression,
  path: string,
  maps: LocalMaps,
): EvidenceExpression {
  if (expression.operator === 'fact' || expression.operator === 'public_profile') {
    return mapEvidenceLeaf(expression, path, maps);
  }
  return {
    operator: expression.operator,
    operands: expression.operands.map((operand, index) =>
      mapEvidenceExpression(operand, `${path}.operands[${index}]`, maps),
    ) as unknown as Extract<
      EvidenceExpression,
      { operator: 'all' }
    >['operands'],
  };
}

function assembleEvaluator(
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
  maps: LocalMaps,
): EvaluatorViewV2 {
  const source = draft.evaluator;
  const id = (key: AiConclusionKey, path: string) => conclusionId(key, path, maps);
  const spfa = (value: typeof source.carePath.initialSpfa, path: string): SpfaConclusion => ({
    conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
    kind: 'spfa',
    value: value.value.service === 'dispensing'
      ? {
          service: 'dispensing',
          subtype: value.value.subtype!,
        }
      : { service: value.value.service },
  });
  const transitions: SpfaTransition[] = source.carePath.transitions.map(
    (value, index) => {
      const path = `evaluator.carePath.transitions[${index}]`;
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'spfa_transition',
        value: {
          fromSpfaRef: id(value.value.fromSpfaRef, `${path}.value.fromSpfaRef`),
          toSpfaRef: id(value.value.toSpfaRef, `${path}.value.toSpfaRef`),
        },
      };
    },
  );
  const incidenceAssessment: IncidenceAssessment = {
    conclusionId: id(
      source.incidence.assessment.localConclusionKey,
      'evaluator.incidence.assessment.localConclusionKey',
    ),
    kind: 'incidence_assessment',
    value: { status: source.incidence.assessment.value.status },
  };
  const incidenceFindings: IncidenceFinding[] = source.incidence.findings.map(
    (value, index) => {
      const path = `evaluator.incidence.findings[${index}]`;
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'incidence',
        value: {
          spfaRef: id(value.value.spfaRef, `${path}.value.spfaRef`),
          medicationRefs: medicationIds(
            value.value.medicationRefs,
            `${path}.value.medicationRefs`,
            maps,
          ),
          semanticMeaning: value.value.semanticMeaning,
        },
      };
    },
  );
  const episodes: FollowUpEpisode[] = source.incidence.followUpEpisodes.map(
    (value, index) => {
      const path = `evaluator.incidence.followUpEpisodes[${index}]`;
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'follow_up_episode',
        value: {
          incidenceRef: id(value.value.incidenceRef, `${path}.value.incidenceRef`),
        },
      };
    },
  );
  const prmAssessment: PrmAssessment = {
    conclusionId: id(
      source.prm.assessment.localConclusionKey,
      'evaluator.prm.assessment.localConclusionKey',
    ),
    kind: 'prm_assessment',
    value: { status: source.prm.assessment.value.status },
  };
  const prmFindings: PrmFinding[] = source.prm.findings.map((value, index) => {
    const path = `evaluator.prm.findings[${index}]`;
    const followUpEpisodeRef = value.value.followUpEpisodeRef === undefined
      ? undefined
      : id(value.value.followUpEpisodeRef, `${path}.value.followUpEpisodeRef`);
    return {
      conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
      kind: 'prm',
      value: {
        classification: resolveTaxonomy(
          value.value.classification,
          `${path}.value.classification`,
          context,
        ),
        medicationRefs: medicationIds(
          value.value.medicationRefs,
          `${path}.value.medicationRefs`,
          maps,
        ),
        ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
      },
    };
  });
  const rnmAssessments: RnmAssessment[] = source.rnmAssessments.map(
    (value, index) => {
      const path = `evaluator.rnmAssessments[${index}]`;
      const conclusionId = id(
        value.localConclusionKey,
        `${path}.localConclusionKey`,
      );
      if (value.value.status === 'no_rnm') {
        return {
          conclusionId,
          kind: 'rnm_assessment',
          value: { status: 'no_rnm' },
        };
      }
      const classification = value.value.classification === undefined
        ? undefined
        : resolveTaxonomy(
            value.value.classification,
            `${path}.value.classification`,
            context,
          );
      const followUpEpisodeRef = value.value.followUpEpisodeRef === undefined
        ? undefined
        : id(value.value.followUpEpisodeRef, `${path}.value.followUpEpisodeRef`);
      return {
        conclusionId,
        kind: 'rnm_assessment',
        value: {
          status: value.value.status,
          ...(classification === undefined ? {} : { classification }),
          medicationRefs: medicationIds(
            value.value.medicationRefs,
            `${path}.value.medicationRefs`,
            maps,
          ),
          ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
        },
      } as RnmAssessment;
    },
  );
  const relations: PrmRnmRelation[] = source.prmRnmRelations.map(
    (value, index) => {
      const path = `evaluator.prmRnmRelations[${index}]`;
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'prm_rnm_relation',
        value: {
          prmRef: id(value.value.prmRef, `${path}.value.prmRef`),
          rnmAssessmentRef: id(
            value.value.rnmAssessmentRef,
            `${path}.value.rnmAssessmentRef`,
          ),
          relation: value.value.relation,
        },
      };
    },
  );
  const adherenceAssessments: AdherenceAssessment[] =
    source.adherence.assessments.map((value, index) => {
      const path = `evaluator.adherence.assessments[${index}]`;
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'adherence_assessment',
        value: {
          medicationRefs: medicationIds(
            value.value.medicationRefs,
            `${path}.value.medicationRefs`,
            maps,
          ) as unknown as AdherenceAssessment['value']['medicationRefs'],
          status: value.value.status,
        },
      };
    });
  const typeConclusions: NonAdherenceTypeConclusion[] =
    source.adherence.typeConclusions.map((value, index) => {
      const path = `evaluator.adherence.typeConclusions[${index}]`;
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'non_adherence_type',
        value: value.value.status === 'determined'
          ? {
              adherenceAssessmentRef: id(
                value.value.adherenceAssessmentRef,
                `${path}.value.adherenceAssessmentRef`,
              ),
              status: 'determined',
              type: value.value.type,
            }
          : {
              adherenceAssessmentRef: id(
                value.value.adherenceAssessmentRef,
                `${path}.value.adherenceAssessmentRef`,
              ),
              status: 'not_determinable',
            },
      };
    });
  const patientProfiles: AdherencePatientProfileConclusion[] =
    source.adherence.patientProfiles.map((value, index) => {
      const path = `evaluator.adherence.patientProfiles[${index}]`;
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'adherence_patient_profile',
        value: value.value.status === 'determined'
          ? {
              adherenceAssessmentRef: id(
                value.value.adherenceAssessmentRef,
                `${path}.value.adherenceAssessmentRef`,
              ),
              status: 'determined',
              profile: value.value.profile,
            }
          : {
              adherenceAssessmentRef: id(
                value.value.adherenceAssessmentRef,
                `${path}.value.adherenceAssessmentRef`,
              ),
              status: 'not_determinable',
            },
      };
    });
  const barrierAssessments: AdherenceBarrierAssessment[] =
    source.adherence.barrierAssessments.map((value, index) => {
      const path = `evaluator.adherence.barrierAssessments[${index}]`;
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'adherence_barrier_assessment',
        value: {
          adherenceAssessmentRef: id(
            value.value.adherenceAssessmentRef,
            `${path}.value.adherenceAssessmentRef`,
          ),
          status: value.value.status,
        },
      };
    });
  const barriers: AdherenceBarrier[] = source.adherence.barriers.map(
    (value, index) => {
      const path = `evaluator.adherence.barriers[${index}]`;
      const classification = value.value.classification === undefined
        ? undefined
        : resolveTaxonomy(
            value.value.classification,
            `${path}.value.classification`,
            context,
          );
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'adherence_barrier',
        value: {
          barrierAssessmentRef: id(
            value.value.barrierAssessmentRef,
            `${path}.value.barrierAssessmentRef`,
          ),
          role: value.value.role,
          category: value.value.category,
          ...(classification === undefined ? {} : { classification }),
        },
      };
    },
  );
  const strategies: AdherenceStrategy[] = source.adherence.strategies.map(
    (value, index) => {
      const path = `evaluator.adherence.strategies[${index}]`;
      const base = {
        adherenceAssessmentRef: id(
          value.value.adherenceAssessmentRef,
          `${path}.value.adherenceAssessmentRef`,
        ),
        addressedBarrierRefs: value.value.addressedBarrierRefs.map(
          (ref, refIndex) =>
            id(ref, `${path}.value.addressedBarrierRefs[${refIndex}]`),
        ),
      };
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'adherence_strategy',
        value: value.value.category === 'combined'
          ? {
              ...base,
              category: 'combined',
              componentCategories: [...value.value.componentCategories],
            }
          : { ...base, category: value.value.category },
      };
    },
  );
  const professionalActions: ProfessionalAction[] =
    source.professionalActions.map((value, index) => {
      const path = `evaluator.professionalActions[${index}]`;
      const classification = value.value.classification === undefined
        ? undefined
        : resolveTaxonomy(
            value.value.classification,
            `${path}.value.classification`,
            context,
          );
      const targetSpfaRef = value.value.targetSpfaRef === undefined
        ? undefined
        : id(value.value.targetSpfaRef, `${path}.value.targetSpfaRef`);
      const referralRef = value.value.referralRef === undefined
        ? undefined
        : id(value.value.referralRef, `${path}.value.referralRef`);
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'professional_action',
        value: {
          spfaRef: id(value.value.spfaRef, `${path}.value.spfaRef`),
          category: value.value.category,
          ...(classification === undefined ? {} : { classification }),
          ...(targetSpfaRef === undefined ? {} : { targetSpfaRef }),
          ...(referralRef === undefined ? {} : { referralRef }),
        },
      } as ProfessionalAction;
    });
  const interventions: PharmaceuticalIntervention[] =
    source.pharmaceuticalInterventions.map((value, index) => {
      const path = `evaluator.pharmaceuticalInterventions[${index}]`;
      const classification = value.value.classification === undefined
        ? undefined
        : resolveTaxonomy(
            value.value.classification,
            `${path}.value.classification`,
            context,
          );
      const professionalActionRef = value.value.professionalActionRef === undefined
        ? undefined
        : id(
            value.value.professionalActionRef,
            `${path}.value.professionalActionRef`,
          );
      const referralRef = value.value.referralRef === undefined
        ? undefined
        : id(value.value.referralRef, `${path}.value.referralRef`);
      return {
        conclusionId: id(value.localConclusionKey, `${path}.localConclusionKey`),
        kind: 'pharmaceutical_intervention',
        value: {
          spfaRef: id(value.value.spfaRef, `${path}.value.spfaRef`),
          ...(professionalActionRef === undefined
            ? {}
            : { professionalActionRef }),
          target: value.value.target,
          ...(classification === undefined ? {} : { classification }),
          addressedConclusionRefs: value.value.addressedConclusionRefs.map(
            (ref, refIndex) =>
              id(ref, `${path}.value.addressedConclusionRefs[${refIndex}]`),
          ) as unknown as PharmaceuticalIntervention['value']['addressedConclusionRefs'],
          ...(referralRef === undefined ? {} : { referralRef }),
        },
      };
    });
  const referralSource = source.referral;
  const referralConclusionId = id(
    referralSource.localConclusionKey,
    'evaluator.referral.localConclusionKey',
  );
  const referral: ReferralConclusion = referralSource.value.status === 'not_required'
    ? {
        conclusionId: referralConclusionId,
        kind: 'referral',
        value: { status: 'not_required' },
      }
    : {
        conclusionId: referralConclusionId,
        kind: 'referral',
        value: {
          status: 'required',
          urgency: referralSource.value.urgency,
          destination: {
            label: referralSource.value.destination.label,
            ...(referralSource.value.destination.classification === undefined
              ? {}
              : {
                  classification: resolveTaxonomy(
                    referralSource.value.destination.classification,
                    'evaluator.referral.value.destination.classification',
                    context,
                  ),
                }),
          },
          reason: referralSource.value.reason,
          report: referralSource.value.report.status === 'not_required'
            ? { status: 'not_required', essentialContents: [] }
            : {
                status: referralSource.value.report.status,
                essentialContents: [
                  ...referralSource.value.report.essentialContents,
                ],
              },
        },
      };
  const evidenceRules: EvidenceRule[] = source.evidenceRules.map(
    (rule, index) => {
      const path = `evaluator.evidenceRules[${index}]`;
      return {
        conclusionRef: id(rule.conclusionRef, `${path}.conclusionRef`),
        requiredEvidence: mapEvidenceExpression(
          rule.requiredEvidence,
          `${path}.requiredEvidence`,
          maps,
        ),
        supportingEvidenceRefs: rule.supportingEvidenceRefs.map(
          (leaf, leafIndex) =>
            mapEvidenceLeaf(
              leaf,
              `${path}.supportingEvidenceRefs[${leafIndex}]`,
              maps,
            ),
        ),
        counterEvidenceRefs: rule.counterEvidenceRefs.map((leaf, leafIndex) =>
          mapEvidenceLeaf(
            leaf,
            `${path}.counterEvidenceRefs[${leafIndex}]`,
            maps,
          ),
        ),
        teacherRationale: rule.teacherRationale,
      };
    },
  );

  return {
    schemaVersion: '2.0',
    caseVersionId: context.caseVersionId,
    versions: cloneVersions(context.evaluatorVersions),
    carePath: {
      initialSpfa: spfa(source.carePath.initialSpfa, 'evaluator.carePath.initialSpfa'),
      additionalSpfas: source.carePath.additionalSpfas.map((value, index) =>
        spfa(value, `evaluator.carePath.additionalSpfas[${index}]`),
      ),
      transitions,
    },
    incidence: {
      assessment: incidenceAssessment,
      findings: incidenceFindings,
      followUpEpisodes: episodes,
    },
    prm: { assessment: prmAssessment, findings: prmFindings },
    rnmAssessments,
    prmRnmRelations: relations,
    adherence: {
      assessments: adherenceAssessments,
      typeConclusions,
      patientProfiles,
      barrierAssessments,
      barriers,
      strategies,
    },
    professionalActions,
    pharmaceuticalInterventions: interventions,
    referral,
    evidenceRules,
  };
}

export function assembleCanonicalGeneratedCaseV2(
  draft: AiGeneratedCaseDraftV2,
  context: GenerationAssemblyContextV2,
): CanonicalGeneratedCaseCoreV2 {
  const maps = buildLocalMaps(draft, context);
  const patientFactsCandidate = assemblePatientFacts(draft, context, maps);

  let patientFacts: CasePatientFactsDraftV2;
  try {
    patientFacts = validateCasePatientFactsDraftV2(patientFactsCandidate);
  } catch (cause) {
    assemblyError(
      'invalid_patient_facts',
      cause instanceof Error && 'path' in cause
        ? String((cause as { path: unknown }).path)
        : 'patientFacts',
      'canonical patient facts validation failed',
      cause,
    );
  }

  let runtime;
  try {
    runtime = createPatientRuntimeViewV2(patientFacts);
  } catch (cause) {
    assemblyError(
      'invalid_patient_facts',
      cause instanceof Error && 'path' in cause
        ? String((cause as { path: unknown }).path)
        : 'patientFacts',
      'canonical patient runtime validation failed',
      cause,
    );
  }

  const evaluatorCandidate = assembleEvaluator(draft, context, maps);
  let evaluator: EvaluatorViewV2;
  try {
    evaluator = validateEvaluatorViewV2(evaluatorCandidate, runtime);
  } catch (cause) {
    assemblyError(
      'invalid_evaluator',
      cause instanceof Error && 'path' in cause
        ? String((cause as { path: unknown }).path)
        : 'evaluator',
      'canonical evaluator validation failed',
      cause,
    );
  }

  return {
    caseVersionId: patientFacts.caseVersionId,
    patientFacts,
    evaluator,
  };
}
