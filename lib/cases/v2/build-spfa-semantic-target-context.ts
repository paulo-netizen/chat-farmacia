import { createHash } from 'node:crypto';

import type {
  AdherenceAssessment,
  AdherenceBarrier,
  AdherenceBarrierAssessment,
  AdherencePatientProfileConclusion,
  AdherenceStrategy,
  FollowUpEpisode,
  IncidenceAssessment,
  IncidenceFinding,
  NonAdherenceTypeConclusion,
  PharmaceuticalIntervention,
  PrmAssessment,
  PrmFinding,
  PrmRnmRelation,
  ProfessionalAction,
  ReferralConclusion,
  RnmAssessment,
  SpfaConclusion,
  SpfaTransition,
  TaxonomyTermRef,
} from './evaluator-types';
import { buildSpfaRequirementEvidenceBaselineV2 } from './build-spfa-evidence-baseline';
import type { SpfaRequirementEvidenceBaselineV2 } from './spfa-evidence-baseline-types';
import type {
  AppliedSpfaRequirementV2,
  BoundSpfaActionTargetV2,
  BoundSpfaInformationTargetV2,
  CaseSpfaProtocolApplicationV2,
} from './spfa-protocol-application-types';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from './spfa-protocol-set-types';
import type {
  SpfaProtocolDefinitionV2,
  SpfaProtocolRequirementDefinitionV2,
} from './spfa-protocol-types';
import type {
  SpfaSemanticDatumContextV2,
  SpfaSemanticDatumValueV2,
  SpfaSemanticEvaluatorConclusionContextV2,
  SpfaSemanticFactDescriptorV2,
  SpfaSemanticFactLocationV2,
  SpfaSemanticMedicationIdentityV2,
  SpfaSemanticRequirementContextV2,
  SpfaSemanticServiceContextV2,
  SpfaSemanticTargetContextFingerprintV1,
  SpfaSemanticTargetContextV2,
  SpfaSemanticTargetDescriptorV2,
} from './spfa-semantic-target-context-types';
import type { SessionTranscriptSnapshotV2 } from './spfa-session-evidence-types';
import { validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';
import type {
  BiomedicalDatumValue,
  CasePatientFactsDraftV2,
  FactId,
  MedicationId,
  MedicationLinkedFactDraftV2,
  MedicationUsePatternDraftV2,
  PatientDatum,
  PatientMedicationDraftV2,
} from './types';
import {
  validateCaseSpfaProtocolSetAgainstCanonicalContextV2,
  validateSpfaProtocolSetClinicalContextV2,
} from './validate-spfa-protocol-set';

export type BuildSpfaSemanticTargetContextInputV2 = Readonly<{
  transcript: SessionTranscriptSnapshotV2;
  baseline: SpfaRequirementEvidenceBaselineV2;
  core: SpfaIntegratedGeneratedCaseCoreV2;
}>;

export class SpfaSemanticTargetContextBuildError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaSemanticTargetContextBuildError';
  }
}

type SemanticConclusionSourceV2 =
  | SpfaConclusion
  | IncidenceAssessment
  | IncidenceFinding
  | FollowUpEpisode
  | PrmAssessment
  | PrmFinding
  | RnmAssessment
  | PrmRnmRelation
  | AdherenceAssessment
  | NonAdherenceTypeConclusion
  | AdherencePatientProfileConclusion
  | AdherenceBarrierAssessment
  | AdherenceBarrier
  | AdherenceStrategy
  | ProfessionalAction
  | PharmaceuticalIntervention
  | ReferralConclusion;

type FingerprintMaterial =
  | null
  | boolean
  | number
  | string
  | readonly FingerprintMaterial[];

function fail(path: string, message: string): never {
  throw new SpfaSemanticTargetContextBuildError(path, message);
}

function arrayEquals<T>(
  left: readonly T[],
  right: readonly T[],
  equals: (leftItem: T, rightItem: T) => boolean = (a, b) => a === b,
): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => equals(item, right[index]))
  );
}

function fingerprintEquals(
  left: SpfaRequirementEvidenceBaselineV2['transcriptFingerprint'],
  right: SpfaRequirementEvidenceBaselineV2['transcriptFingerprint'],
): boolean {
  return (
    left.algorithm === right.algorithm &&
    left.canonicalization === right.canonicalization &&
    left.value === right.value
  );
}

function baselineEquals(
  left: SpfaRequirementEvidenceBaselineV2,
  right: SpfaRequirementEvidenceBaselineV2,
): boolean {
  if (
    left.schemaVersion !== right.schemaVersion ||
    left.sessionId !== right.sessionId ||
    left.caseVersionId !== right.caseVersionId ||
    !fingerprintEquals(left.transcriptFingerprint, right.transcriptFingerprint) ||
    left.carePathSpfaRef !== right.carePathSpfaRef ||
    left.requirementRef !== right.requirementRef ||
    left.kind !== right.kind ||
    left.resolution !== right.resolution ||
    !arrayEquals(left.unresolvedTargetRefs, right.unresolvedTargetRefs) ||
    !arrayEquals(
      left.semanticCandidateUniverse,
      right.semanticCandidateUniverse,
      (a, b) => a.targetRef === b.targetRef && a.messageRef === b.messageRef,
    )
  ) {
    return false;
  }
  if (left.kind === 'INFORMATION_REQUIREMENT') {
    if (right.kind !== 'INFORMATION_REQUIREMENT') return false;
    return (
      arrayEquals(
        left.deterministicCoveredTargetRefs,
        right.deterministicCoveredTargetRefs,
      ) &&
      arrayEquals(
        left.deterministicEvidence,
        right.deterministicEvidence,
        (a, b) => a.source === b.source && a.targetRef === b.targetRef,
      )
    );
  }
  if (right.kind !== 'ACTION_REQUIREMENT') return false;
  return (
    arrayEquals(
      left.deterministicPerformedTargetRefs,
      right.deterministicPerformedTargetRefs,
    ) &&
    arrayEquals(left.deterministicEvidence, right.deterministicEvidence)
  );
}

function projectDatumValue(
  value: string | number | BiomedicalDatumValue,
): SpfaSemanticDatumValueV2 {
  if (typeof value === 'string' || typeof value === 'number') return value;
  return {
    type: value.type,
    value: value.value,
    ...(value.unit === undefined ? {} : { unit: value.unit }),
    ...(value.timingOrContext === undefined
      ? {}
      : { timingOrContext: value.timingOrContext }),
  };
}

function projectDatum<
  Value extends string | number | BiomedicalDatumValue,
>(
  datum: PatientDatum<Value>,
  path: string,
): SpfaSemanticDatumContextV2 {
  if (datum.state === 'known') {
    return {
      state: 'known',
      certainty: datum.certainty,
      value: projectDatumValue(datum.value),
    };
  }
  if (datum.state === 'explicit_absence') {
    return { state: 'explicit_absence', topic: datum.topic };
  }
  if (datum.state === 'patient_unknown') {
    return { state: 'patient_unknown', topic: datum.topic };
  }
  fail(path, 'referenced datum is not available for semantic context');
}

function cloneDatum(
  datum: SpfaSemanticDatumContextV2,
): SpfaSemanticDatumContextV2 {
  if (datum.state !== 'known') return { ...datum };
  return {
    state: datum.state,
    certainty: datum.certainty,
    value:
      typeof datum.value === 'object'
        ? { ...datum.value }
        : datum.value,
  };
}

function cloneMedicationIdentity(
  medication: SpfaSemanticMedicationIdentityV2,
): SpfaSemanticMedicationIdentityV2 {
  return { displayName: cloneDatum(medication.displayName) };
}

type FactIndex = Map<FactId, SpfaSemanticFactDescriptorV2>;

function addFact<Value extends string | number | BiomedicalDatumValue>(
  index: FactIndex,
  datum: PatientDatum<Value>,
  location: SpfaSemanticFactLocationV2,
  path: string,
): void {
  if (
    datum.state === 'not_defined' ||
    datum.state === 'not_applicable'
  ) {
    return;
  }
  index.set(datum.factId, {
    location,
    datum: projectDatum(datum, path),
  });
}

function addFactArray<Value extends string | number | BiomedicalDatumValue>(
  index: FactIndex,
  data: readonly PatientDatum<Value>[],
  location: SpfaSemanticFactLocationV2,
  path: string,
): void {
  data.forEach((datum, indexValue) =>
    addFact(index, datum, location, `${path}[${indexValue}]`),
  );
}

function medicationIdentity(
  medication: PatientMedicationDraftV2,
  path: string,
): SpfaSemanticMedicationIdentityV2 {
  return {
    displayName: projectDatum(medication.displayName, `${path}.displayName`),
  };
}

function addMedicationFacts(
  facts: FactIndex,
  medication: PatientMedicationDraftV2,
  identity: SpfaSemanticMedicationIdentityV2,
  path: string,
): void {
  const fields = [
    ['DISPLAY_NAME', 'displayName'],
    ['ORIGIN', 'origin'],
    ['PURPOSE_AS_UNDERSTOOD', 'purposeAsUnderstood'],
    ['REGIMEN_BASIS', 'regimenBasis'],
    ['REFERENCE_DOSE', 'referenceDose'],
    ['REFERENCE_SCHEDULE', 'referenceSchedule'],
    ['REFERENCE_DURATION', 'referenceDuration'],
    ['ADMINISTRATION_METHOD', 'administrationMethod'],
  ] as const;
  fields.forEach(([field, property]) =>
    addFact(
      facts,
      medication[property],
      {
        section: 'MEDICATION',
        field,
        medication: cloneMedicationIdentity(identity),
      },
      `${path}.${property}`,
    ),
  );
  medication.specialUseConditions.forEach((datum, index) =>
    addFact(
      facts,
      datum,
      {
        section: 'MEDICATION',
        field: 'SPECIAL_USE_CONDITION',
        medication: cloneMedicationIdentity(identity),
      },
      `${path}.specialUseConditions[${index}]`,
    ),
  );
}

function addMedicationUseFacts(
  facts: FactIndex,
  use: MedicationUsePatternDraftV2,
  identity: SpfaSemanticMedicationIdentityV2,
  path: string,
): void {
  const fields = [
    ['ACTUAL_USE', 'actualUse'],
    ['ACTUAL_DOSE', 'actualDose'],
    ['ACTUAL_SCHEDULE', 'actualSchedule'],
    ['FREQUENCY', 'frequency'],
    ['TIME_PERIOD', 'timePeriod'],
  ] as const;
  fields.forEach(([field, property]) =>
    addFact(
      facts,
      use[property],
      {
        section: 'MEDICATION_USE',
        field,
        medication: cloneMedicationIdentity(identity),
        action: use.action,
      },
      `${path}.${property}`,
    ),
  );
}

function addLinkedFacts(
  facts: FactIndex,
  data: readonly MedicationLinkedFactDraftV2[],
  field: Extract<
    SpfaSemanticFactLocationV2,
    { section: 'MEDICATION_LINKED' }
  >['field'],
  medications: ReadonlyMap<MedicationId, SpfaSemanticMedicationIdentityV2>,
  path: string,
): void {
  data.forEach((linked, index) => {
    const identity = medications.get(linked.medicationRef);
    if (identity === undefined) {
      fail(`${path}[${index}].medicationRef`, 'unknown medication reference');
    }
    addFact(
      facts,
      linked.detail,
      {
        section: 'MEDICATION_LINKED',
        field,
        medication: cloneMedicationIdentity(identity),
      },
      `${path}[${index}].detail`,
    );
  });
}

function buildFactIndex(patientFacts: CasePatientFactsDraftV2): Readonly<{
  facts: FactIndex;
  medications: Map<MedicationId, SpfaSemanticMedicationIdentityV2>;
}> {
  const facts: FactIndex = new Map();
  const medications = new Map<MedicationId, SpfaSemanticMedicationIdentityV2>();
  addFact(facts, patientFacts.initialDemand, { section: 'INITIAL_DEMAND' }, 'patientFacts.initialDemand');
  addFact(
    facts,
    patientFacts.encounter.personPresent,
    { section: 'ENCOUNTER', field: 'PERSON_PRESENT' },
    'patientFacts.encounter.personPresent',
  );
  addFact(
    facts,
    patientFacts.encounter.relationshipToPatient,
    { section: 'ENCOUNTER', field: 'RELATIONSHIP_TO_PATIENT' },
    'patientFacts.encounter.relationshipToPatient',
  );

  const clinicalCollections = [
    ['HEALTH_PROBLEM', 'healthProblems'],
    ['CLINICAL_HISTORY', 'clinicalHistory'],
    ['PHYSIOLOGICAL_SITUATION', 'physiologicalSituation'],
    ['ALLERGY_INTOLERANCE', 'allergiesAndIntolerances'],
    ['LIFESTYLE', 'lifestyle'],
  ] as const;
  clinicalCollections.forEach(([field, property]) =>
    addFactArray(
      facts,
      patientFacts.clinicalContext[property],
      { section: 'CLINICAL_CONTEXT', field },
      `patientFacts.clinicalContext.${property}`,
    ),
  );
  addFactArray(
    facts,
    patientFacts.clinicalContext.biomedicalData,
    { section: 'CLINICAL_CONTEXT', field: 'BIOMEDICAL_DATA' },
    'patientFacts.clinicalContext.biomedicalData',
  );
  addFact(
    facts,
    patientFacts.clinicalContext.pregnancyAndLactation,
    { section: 'CLINICAL_CONTEXT', field: 'PREGNANCY_LACTATION' },
    'patientFacts.clinicalContext.pregnancyAndLactation',
  );

  patientFacts.symptoms.forEach((symptom, index) => {
    const symptomContext = projectDatum(
      symptom.description,
      `patientFacts.symptoms[${index}].description`,
    );
    const fields = [
      ['DESCRIPTION', 'description'],
      ['ONSET', 'onset'],
      ['DURATION', 'duration'],
      ['EVOLUTION', 'evolution'],
    ] as const;
    fields.forEach(([field, property]) =>
      addFact(
        facts,
        symptom[property],
        { section: 'SYMPTOM', field, symptom: cloneDatum(symptomContext) },
        `patientFacts.symptoms[${index}].${property}`,
      ),
    );
    symptom.relevantCircumstances.forEach((datum, circumstanceIndex) =>
      addFact(
        facts,
        datum,
        {
          section: 'SYMPTOM',
          field: 'RELEVANT_CIRCUMSTANCE',
          symptom: cloneDatum(symptomContext),
        },
        `patientFacts.symptoms[${index}].relevantCircumstances[${circumstanceIndex}]`,
      ),
    );
  });

  const medicationCollections = [
    patientFacts.pharmacotherapy.prescribedMedications,
    patientFacts.pharmacotherapy.otherMedicinesAndProducts,
  ];
  medicationCollections.forEach((collection, collectionIndex) =>
    collection.forEach((medication, index) => {
      const path = `patientFacts.pharmacotherapy.${
        collectionIndex === 0 ? 'prescribedMedications' : 'otherMedicinesAndProducts'
      }[${index}]`;
      const identity = medicationIdentity(medication, path);
      medications.set(medication.medicationId, identity);
      addMedicationFacts(facts, medication, identity, path);
    }),
  );
  patientFacts.pharmacotherapy.actualMedicationUse.forEach((use, index) => {
    const identity = medications.get(use.medicationRef);
    if (identity === undefined) {
      fail(
        `patientFacts.pharmacotherapy.actualMedicationUse[${index}].medicationRef`,
        'unknown medication reference',
      );
    }
    addMedicationUseFacts(
      facts,
      use,
      identity,
      `patientFacts.pharmacotherapy.actualMedicationUse[${index}]`,
    );
  });
  addLinkedFacts(
    facts,
    patientFacts.pharmacotherapy.recentChanges,
    'RECENT_CHANGE',
    medications,
    'patientFacts.pharmacotherapy.recentChanges',
  );
  addLinkedFacts(
    facts,
    patientFacts.pharmacotherapy.perceivedEffectiveness,
    'PERCEIVED_EFFECTIVENESS',
    medications,
    'patientFacts.pharmacotherapy.perceivedEffectiveness',
  );
  addLinkedFacts(
    facts,
    patientFacts.pharmacotherapy.perceivedSafety,
    'PERCEIVED_SAFETY',
    medications,
    'patientFacts.pharmacotherapy.perceivedSafety',
  );

  const patientContextCollections = [
    ['ACTION_ALREADY_TAKEN', 'actionsAlreadyTaken'],
    ['PRACTICAL_DIFFICULTY', 'practicalDifficulties'],
    ['BELIEF_OR_CONCERN', 'beliefsAndConcerns'],
    ['STRATEGY_ALREADY_TRIED', 'strategiesAlreadyTried'],
    ['DAILY_OR_SOCIAL_CONTEXT', 'dailyAndSocialContext'],
    ['FAMILY_OR_SOCIAL_SUPPORT', 'familyAndSocialSupport'],
    ['RELATIONSHIP_WITH_PROFESSIONALS', 'relationshipWithProfessionals'],
  ] as const;
  patientContextCollections.forEach(([field, property]) =>
    addFactArray(
      facts,
      patientFacts[property],
      { section: 'PATIENT_CONTEXT', field },
      `patientFacts.${property}`,
    ),
  );
  return { facts, medications };
}

function serviceContext(spfa: SpfaConclusion): SpfaSemanticServiceContextV2 {
  return spfa.value.subtype === undefined
    ? { service: spfa.value.service }
    : { service: spfa.value.service, subtype: spfa.value.subtype };
}

function conclusionEntries(
  core: SpfaIntegratedGeneratedCaseCoreV2,
): SemanticConclusionSourceV2[] {
  const evaluator = core.evaluator;
  return [
    evaluator.carePath.initialSpfa,
    ...evaluator.carePath.additionalSpfas,
    evaluator.incidence.assessment,
    ...evaluator.incidence.findings,
    ...evaluator.incidence.followUpEpisodes,
    evaluator.prm.assessment,
    ...evaluator.prm.findings,
    ...evaluator.rnmAssessments,
    ...evaluator.prmRnmRelations,
    ...evaluator.adherence.assessments,
    ...evaluator.adherence.typeConclusions,
    ...evaluator.adherence.patientProfiles,
    ...evaluator.adherence.barrierAssessments,
    ...evaluator.adherence.barriers,
    ...evaluator.adherence.strategies,
    ...evaluator.professionalActions,
    ...evaluator.pharmaceuticalInterventions,
    evaluator.referral,
  ];
}

function projectConclusion(
  conclusion: SemanticConclusionSourceV2,
): SpfaSemanticEvaluatorConclusionContextV2 {
  return {
    kind: conclusion.kind,
    value: structuredClone(conclusion.value),
  } as SpfaSemanticEvaluatorConclusionContextV2;
}

function resolveDefinition(
  application: CaseSpfaProtocolApplicationV2,
  definitions: readonly SpfaProtocolDefinitionV2[],
): SpfaProtocolDefinitionV2 {
  const definition = definitions.find(
    (candidate) =>
      candidate.protocolId === application.protocolRef.protocolId &&
      candidate.version === application.protocolRef.version,
  );
  if (definition === undefined) {
    fail('core.spfaProtocolSet.definitions', 'application protocol definition not found');
  }
  return definition;
}

function requirementContext(
  definition: SpfaProtocolRequirementDefinitionV2,
): SpfaSemanticRequirementContextV2 {
  return definition.kind === 'INFORMATION_REQUIREMENT'
    ? {
        kind: definition.kind,
        semanticDomain: structuredClone(definition.semanticDomain),
        goal: definition.informationGoal,
      }
    : {
        kind: definition.kind,
        semanticDomain: definition.semanticDomain,
        goal: definition.actionGoal,
      };
}

function descriptorForInformationTarget(
  bound: BoundSpfaInformationTargetV2,
  candidateMessageRefs: SpfaSemanticTargetDescriptorV2['candidateMessageRefs'],
  facts: FactIndex,
  medications: ReadonlyMap<MedicationId, SpfaSemanticMedicationIdentityV2>,
): SpfaSemanticTargetDescriptorV2 {
  const target = bound.target;
  if (target.kind === 'PUBLIC_PROFILE') {
    fail('baseline.unresolvedTargetRefs', 'public target cannot remain unresolved');
  }
  if (target.kind === 'FACT') {
    const fact = facts.get(target.factRef);
    if (fact === undefined) fail('target.factRef', 'fact cannot be resolved');
    return {
      targetRef: bound.targetId,
      candidateMessageRefs: [...candidateMessageRefs],
      target: {
        kind: 'FACT',
        location: structuredClone(fact.location),
        datum: cloneDatum(fact.datum),
      },
    };
  }
  const medication = medications.get(target.medicationRef);
  if (medication === undefined) fail('target.medicationRef', 'medication cannot be resolved');
  if (target.kind === 'MEDICATION_ENTITY') {
    return {
      targetRef: bound.targetId,
      candidateMessageRefs: [...candidateMessageRefs],
      target: {
        kind: 'MEDICATION_ENTITY',
        medication: cloneMedicationIdentity(medication),
      },
    };
  }
  const fact = facts.get(target.factRef);
  if (fact === undefined) fail('target.factRef', 'medication fact cannot be resolved');
  return {
    targetRef: bound.targetId,
    candidateMessageRefs: [...candidateMessageRefs],
    target: {
      kind: 'MEDICATION_FACT',
      medication: cloneMedicationIdentity(medication),
      fact: {
        location: structuredClone(fact.location),
        datum: cloneDatum(fact.datum),
      },
    },
  };
}

function descriptorForActionTarget(
  bound: BoundSpfaActionTargetV2,
  candidateMessageRefs: SpfaSemanticTargetDescriptorV2['candidateMessageRefs'],
  conclusions: ReadonlyMap<string, SemanticConclusionSourceV2>,
  transitions: ReadonlyMap<string, SpfaTransition>,
  spfas: ReadonlyMap<string, SpfaConclusion>,
): SpfaSemanticTargetDescriptorV2 {
  if (bound.target.kind === 'EVALUATOR_CONCLUSION') {
    const conclusion = conclusions.get(bound.target.conclusionRef);
    if (conclusion === undefined) fail('target.conclusionRef', 'conclusion cannot be resolved');
    return {
      targetRef: bound.targetId,
      candidateMessageRefs: [...candidateMessageRefs],
      target: {
        kind: 'EVALUATOR_CONCLUSION',
        conclusion: projectConclusion(conclusion),
      },
    };
  }
  const transition = transitions.get(bound.target.transitionRef);
  if (transition === undefined) fail('target.transitionRef', 'transition cannot be resolved');
  const from = spfas.get(transition.value.fromSpfaRef);
  const to = spfas.get(transition.value.toSpfaRef);
  if (from === undefined || to === undefined) {
    fail('target.transitionRef', 'transition SPFA endpoints cannot be resolved');
  }
  return {
    targetRef: bound.targetId,
    candidateMessageRefs: [...candidateMessageRefs],
    target: {
      kind: 'CARE_PATH_TRANSITION',
      from: serviceContext(from),
      to: serviceContext(to),
    },
  };
}

function datumMaterial(datum: SpfaSemanticDatumContextV2): FingerprintMaterial {
  if (datum.state === 'known') {
    const value = datum.value;
    return [
      datum.state,
      datum.certainty,
      typeof value === 'object'
        ? [
            'biomedical',
            value.type,
            value.value,
            value.unit ?? null,
            value.timingOrContext ?? null,
          ]
        : [typeof value, value],
    ];
  }
  return [datum.state, datum.topic];
}

function medicationMaterial(
  medication: SpfaSemanticMedicationIdentityV2,
): FingerprintMaterial {
  return ['medication', datumMaterial(medication.displayName)];
}

function locationMaterial(location: SpfaSemanticFactLocationV2): FingerprintMaterial {
  if (location.section === 'INITIAL_DEMAND') return [location.section];
  if (
    location.section === 'ENCOUNTER' ||
    location.section === 'CLINICAL_CONTEXT' ||
    location.section === 'PATIENT_CONTEXT'
  ) {
    return [location.section, location.field];
  }
  if (location.section === 'SYMPTOM') {
    return [location.section, location.field, datumMaterial(location.symptom)];
  }
  if (location.section === 'MEDICATION_USE') {
    return [
      location.section,
      location.field,
      medicationMaterial(location.medication),
      location.action,
    ];
  }
  return [
    location.section,
    location.field,
    medicationMaterial(location.medication),
  ];
}

function taxonomyMaterial(value: TaxonomyTermRef | undefined): FingerprintMaterial {
  return value === undefined
    ? null
    : [value.taxonomyId, value.taxonomyVersion, value.conceptId];
}

function conclusionMaterial(
  conclusion: SpfaSemanticEvaluatorConclusionContextV2,
): FingerprintMaterial {
  switch (conclusion.kind) {
    case 'spfa':
      return [
        conclusion.kind,
        conclusion.value.service,
        conclusion.value.subtype ?? null,
      ];
    case 'incidence_assessment':
    case 'prm_assessment':
      return [conclusion.kind, conclusion.value.status];
    case 'incidence':
      return [
        conclusion.kind,
        conclusion.value.spfaRef,
        [...conclusion.value.medicationRefs],
        conclusion.value.semanticMeaning,
      ];
    case 'follow_up_episode':
      return [conclusion.kind, conclusion.value.incidenceRef];
    case 'prm':
      return [
        conclusion.kind,
        taxonomyMaterial(conclusion.value.classification),
        [...conclusion.value.medicationRefs],
        conclusion.value.followUpEpisodeRef ?? null,
      ];
    case 'rnm_assessment':
      return conclusion.value.status === 'no_rnm'
        ? [conclusion.kind, conclusion.value.status]
        : [
            conclusion.kind,
            conclusion.value.status,
            taxonomyMaterial(conclusion.value.classification),
            [...conclusion.value.medicationRefs],
            conclusion.value.followUpEpisodeRef ?? null,
          ];
    case 'prm_rnm_relation':
      return [
        conclusion.kind,
        conclusion.value.prmRef,
        conclusion.value.rnmAssessmentRef,
        conclusion.value.relation,
      ];
    case 'adherence_assessment':
      return [
        conclusion.kind,
        [...conclusion.value.medicationRefs],
        conclusion.value.status,
      ];
    case 'non_adherence_type':
      return conclusion.value.status === 'determined'
        ? [
            conclusion.kind,
            conclusion.value.adherenceAssessmentRef,
            conclusion.value.status,
            conclusion.value.type,
          ]
        : [
            conclusion.kind,
            conclusion.value.adherenceAssessmentRef,
            conclusion.value.status,
          ];
    case 'adherence_patient_profile':
      return conclusion.value.status === 'determined'
        ? [
            conclusion.kind,
            conclusion.value.adherenceAssessmentRef,
            conclusion.value.status,
            conclusion.value.profile,
          ]
        : [
            conclusion.kind,
            conclusion.value.adherenceAssessmentRef,
            conclusion.value.status,
          ];
    case 'adherence_barrier_assessment':
      return [
        conclusion.kind,
        conclusion.value.adherenceAssessmentRef,
        conclusion.value.status,
      ];
    case 'adherence_barrier':
      return [
        conclusion.kind,
        conclusion.value.barrierAssessmentRef,
        conclusion.value.role,
        conclusion.value.category,
        taxonomyMaterial(conclusion.value.classification),
      ];
    case 'adherence_strategy':
      return conclusion.value.category === 'combined'
        ? [
            conclusion.kind,
            conclusion.value.adherenceAssessmentRef,
            [...conclusion.value.addressedBarrierRefs],
            conclusion.value.category,
            [...conclusion.value.componentCategories],
          ]
        : [
            conclusion.kind,
            conclusion.value.adherenceAssessmentRef,
            [...conclusion.value.addressedBarrierRefs],
            conclusion.value.category,
          ];
    case 'professional_action':
      return [
        conclusion.kind,
        conclusion.value.spfaRef,
        conclusion.value.category,
        taxonomyMaterial(conclusion.value.classification),
        conclusion.value.targetSpfaRef ?? null,
        conclusion.value.referralRef ?? null,
      ];
    case 'pharmaceutical_intervention':
      return [
        conclusion.kind,
        conclusion.value.spfaRef,
        conclusion.value.professionalActionRef ?? null,
        conclusion.value.target,
        taxonomyMaterial(conclusion.value.classification),
        [...conclusion.value.addressedConclusionRefs],
        conclusion.value.referralRef ?? null,
      ];
    case 'referral':
      return conclusion.value.status === 'not_required'
        ? [conclusion.kind, conclusion.value.status]
        : [
            conclusion.kind,
            conclusion.value.status,
            conclusion.value.urgency,
            conclusion.value.destination.label,
            taxonomyMaterial(conclusion.value.destination.classification),
            conclusion.value.reason,
            conclusion.value.report.status,
            [...conclusion.value.report.essentialContents],
          ];
  }
}

function requirementMaterial(
  requirement: SpfaSemanticRequirementContextV2,
): FingerprintMaterial {
  if (requirement.kind === 'ACTION_REQUIREMENT') {
    return [requirement.kind, requirement.semanticDomain, requirement.goal];
  }
  return requirement.semanticDomain.kind === 'patient_information'
    ? [
        requirement.kind,
        requirement.semanticDomain.kind,
        requirement.semanticDomain.disclosureDomain,
        requirement.goal,
      ]
    : [
        requirement.kind,
        requirement.semanticDomain.kind,
        requirement.semanticDomain.domain,
        requirement.goal,
      ];
}

function targetMaterial(target: SpfaSemanticTargetDescriptorV2): FingerprintMaterial {
  const identity: FingerprintMaterial[] = [
    target.targetRef,
    [...target.candidateMessageRefs],
  ];
  if (target.target.kind === 'FACT') {
    return [
      ...identity,
      target.target.kind,
      locationMaterial(target.target.location),
      datumMaterial(target.target.datum),
    ];
  }
  if (target.target.kind === 'MEDICATION_ENTITY') {
    return [...identity, target.target.kind, medicationMaterial(target.target.medication)];
  }
  if (target.target.kind === 'MEDICATION_FACT') {
    return [
      ...identity,
      target.target.kind,
      medicationMaterial(target.target.medication),
      locationMaterial(target.target.fact.location),
      datumMaterial(target.target.fact.datum),
    ];
  }
  if (target.target.kind === 'EVALUATOR_CONCLUSION') {
    return [...identity, target.target.kind, conclusionMaterial(target.target.conclusion)];
  }
  return [
    ...identity,
    target.target.kind,
    [target.target.from.service, target.target.from.subtype ?? null],
    [target.target.to.service, target.target.to.subtype ?? null],
  ];
}

function buildFingerprint(
  context: Omit<SpfaSemanticTargetContextV2, 'fingerprint'>,
): SpfaSemanticTargetContextFingerprintV1 {
  const material: FingerprintMaterial = [
    context.contractVersion,
    context.sessionId,
    context.caseVersionId,
    [
      context.transcriptFingerprint.algorithm,
      context.transcriptFingerprint.canonicalization,
      context.transcriptFingerprint.value,
    ],
    context.carePathSpfaRef,
    context.requirementRef,
    context.kind,
    [context.spfa.service, context.spfa.subtype ?? null],
    requirementMaterial(context.requirement),
    context.targets.map(targetMaterial),
  ];
  return {
    algorithm: 'sha256',
    canonicalization: 'spfa-semantic-target-context-v2/1',
    value: createHash('sha256').update(JSON.stringify(material)).digest('hex'),
  };
}

export function buildSpfaSemanticTargetContextV2(
  input: BuildSpfaSemanticTargetContextInputV2,
): SpfaSemanticTargetContextV2 {
  const transcript = validateSessionTranscriptSnapshotV2(
    input.transcript,
    'input.transcript',
  );
  const clinicalContext = validateSpfaProtocolSetClinicalContextV2(
    {
      caseVersionId: input.core.caseVersionId,
      patientFacts: input.core.patientFacts,
      evaluator: input.core.evaluator,
    },
    'input.core',
  );
  const protocolSet = validateCaseSpfaProtocolSetAgainstCanonicalContextV2(
    input.core.spfaProtocolSet,
    clinicalContext,
  );
  if (transcript.caseVersionId !== clinicalContext.caseVersionId) {
    fail('input.transcript.caseVersionId', 'must match the generated core case version');
  }
  if (
    input.baseline.resolution !== 'DETERMINISTIC_PARTIAL' &&
    input.baseline.resolution !== 'SEMANTIC_REQUIRED'
  ) {
    fail('input.baseline.resolution', 'does not require semantic target context');
  }

  const application = protocolSet.applications.find(
    (candidate) => candidate.carePathSpfaRef === input.baseline.carePathSpfaRef,
  );
  if (application === undefined) {
    fail('input.baseline.carePathSpfaRef', 'does not resolve to an application');
  }
  const definition = resolveDefinition(application, protocolSet.definitions);
  const appliedRequirement = application.requirements.find(
    (candidate) => candidate.requirementRef === input.baseline.requirementRef,
  );
  if (appliedRequirement === undefined) {
    fail('input.baseline.requirementRef', 'does not resolve to an applied requirement');
  }
  const requirementDefinition = definition.requirements.find(
    (candidate) => candidate.requirementId === input.baseline.requirementRef,
  );
  if (requirementDefinition === undefined) {
    fail('input.baseline.requirementRef', 'does not resolve to a requirement definition');
  }
  if (
    appliedRequirement.kind !== requirementDefinition.kind ||
    appliedRequirement.kind !== input.baseline.kind
  ) {
    fail('input.baseline.kind', 'does not match application and definition');
  }
  const spfas = [
    clinicalContext.evaluator.carePath.initialSpfa,
    ...clinicalContext.evaluator.carePath.additionalSpfas,
  ];
  const spfa = spfas.find(
    (candidate) => candidate.conclusionId === application.carePathSpfaRef,
  );
  if (spfa === undefined) fail('input.baseline.carePathSpfaRef', 'SPFA cannot be resolved');

  const reconstructedBaseline = buildSpfaRequirementEvidenceBaselineV2({
    transcript,
    carePathSpfaRef: application.carePathSpfaRef,
    appliedRequirement,
  });
  if (!baselineEquals(input.baseline, reconstructedBaseline)) {
    fail('input.baseline', 'does not equal the reconstructed canonical D2 baseline');
  }

  const { facts, medications } = buildFactIndex(clinicalContext.patientFacts);
  const conclusions = new Map(
    conclusionEntries({
      caseVersionId: clinicalContext.caseVersionId,
      patientFacts: clinicalContext.patientFacts,
      evaluator: clinicalContext.evaluator,
      spfaProtocolSet: protocolSet,
    }).map((conclusion) => [conclusion.conclusionId, conclusion]),
  );
  const transitions = new Map(
    clinicalContext.evaluator.carePath.transitions.map((transition) => [
      transition.conclusionId,
      transition,
    ]),
  );
  const spfasById = new Map(spfas.map((item) => [item.conclusionId, item]));
  const candidateRefs = new Map(
    reconstructedBaseline.unresolvedTargetRefs.map((targetRef) => [
      targetRef,
      reconstructedBaseline.semanticCandidateUniverse
        .filter((candidate) => candidate.targetRef === targetRef)
        .map((candidate) => candidate.messageRef),
    ]),
  );

  let targets: SpfaSemanticTargetDescriptorV2[];
  if (appliedRequirement.kind === 'INFORMATION_REQUIREMENT') {
    const boundById = new Map(
      appliedRequirement.informationTargets.map((bound) => [bound.targetId, bound]),
    );
    targets = reconstructedBaseline.unresolvedTargetRefs.map((targetRef) => {
      const bound = boundById.get(targetRef);
      if (bound === undefined) fail('input.baseline.unresolvedTargetRefs', 'target not found');
      return descriptorForInformationTarget(
        bound,
        candidateRefs.get(targetRef) ?? [],
        facts,
        medications,
      );
    });
  } else {
    const boundById = new Map(
      appliedRequirement.actionTargets.map((bound) => [bound.targetId, bound]),
    );
    targets = reconstructedBaseline.unresolvedTargetRefs.map((targetRef) => {
      const bound = boundById.get(targetRef);
      if (bound === undefined) fail('input.baseline.unresolvedTargetRefs', 'target not found');
      return descriptorForActionTarget(
        bound,
        candidateRefs.get(targetRef) ?? [],
        conclusions,
        transitions,
        spfasById,
      );
    });
  }
  if (targets.length === 0) fail('targets', 'must not be empty');

  const contextWithoutFingerprint: Omit<SpfaSemanticTargetContextV2, 'fingerprint'> = {
    schemaVersion: '2.0',
    contractVersion: 'spfa-semantic-target-context/1',
    sessionId: transcript.sessionId,
    caseVersionId: clinicalContext.caseVersionId,
    transcriptFingerprint: { ...transcript.fingerprint },
    carePathSpfaRef: application.carePathSpfaRef,
    requirementRef: appliedRequirement.requirementRef,
    kind: appliedRequirement.kind,
    spfa: serviceContext(spfa),
    requirement: requirementContext(requirementDefinition),
    targets: targets as unknown as SpfaSemanticTargetContextV2['targets'],
  };
  return {
    ...contextWithoutFingerprint,
    fingerprint: buildFingerprint(contextWithoutFingerprint),
  };
}
