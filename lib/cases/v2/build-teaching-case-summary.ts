import type {
  AdherenceAssessment,
  AdherenceBarrier,
  AdherenceBarrierAssessment,
  AdherencePatientProfileConclusion,
  AdherenceStrategy,
  ConclusionId,
  EvaluatorViewV2,
  IncidenceFinding,
  NonAdherenceTypeConclusion,
  NonEmptyArray,
  PharmaceuticalIntervention,
  ProfessionalAction,
  PrmFinding,
  RnmAssessment,
  SpfaConclusion,
  TaxonomyTermRef,
} from './evaluator-types';
import {
  isIdentifiedReportRequirementV2,
  reportRequirementSemanticContentsV2,
} from './evaluator-types';
import type {
  AddressedConclusionSummary,
  AdherenceAssessmentSummary,
  AdherenceProfileSummary,
  AdherenceStrategySummary,
  AdherenceTypeSummary,
  BarrierSetSummary,
  BarrierSummary,
  CarePathSummary,
  IncidenceFindingSummary,
  IncidenceSummary,
  MedicationScopeSummary,
  NonEmptyMedicationScopeSummary,
  PharmaceuticalInterventionSummary,
  PrmFindingSummary,
  PrmSummary,
  ProfessionalActionSummary,
  ReferralSummary,
  RnmFindingSummary,
  RnmSummary,
  SpfaSummary,
  SummaryKnownValue,
  SummaryMedicationRef,
  SummaryReportRequirement,
  TeachingCaseSummaryV2,
} from './teaching-case-summary-types';
import type {
  MedicationId,
  PatientRuntimeViewV2,
  RuntimePatientDatum,
  RuntimePatientMedicationV2,
} from './types';

export class TeachingCaseSummaryBuildError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'TeachingCaseSummaryBuildError';
  }
}

function fail(path: string, message: string): never {
  throw new TeachingCaseSummaryBuildError(path, message);
}

function ordinalCompare(left: string, right: string): number {
  const normalizedLeft = left.normalize('NFKC');
  const normalizedRight = right.normalize('NFKC');
  const normalizedOrder = normalizedLeft < normalizedRight
    ? -1
    : normalizedLeft > normalizedRight
      ? 1
      : 0;
  if (normalizedOrder !== 0) return normalizedOrder;
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalSortKey(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return `string:${JSON.stringify(value.normalize('NFKC'))}:original:${JSON.stringify(value)}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${typeof value}:${String(value)}`;
  }
  if (Array.isArray(value)) {
    return `array:[${value.map(canonicalSortKey).join(',')}]`;
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const keys = Object.keys(source).sort(ordinalCompare);
    return `object:{${keys
      .map(
        (key) =>
          `${JSON.stringify(key.normalize('NFKC'))}:${canonicalSortKey(source[key])}`,
      )
      .join(',')}}`;
  }
  return `${typeof value}:${String(value)}`;
}

function sortByProjectionKey<T>(
  values: readonly T[],
  primaryKey: (value: T) => string,
): T[] {
  return [...values].sort((left, right) => {
    const primary = ordinalCompare(primaryKey(left), primaryKey(right));
    return primary !== 0
      ? primary
      : ordinalCompare(canonicalSortKey(left), canonicalSortKey(right));
  });
}

function taxonomyKey(value: TaxonomyTermRef | undefined): string {
  return value === undefined
    ? ''
    : `${value.taxonomyId}\u0000${value.taxonomyVersion}\u0000${value.conceptId}`;
}

function medicationScopeKey(value: MedicationScopeSummary): string {
  return value.medications.map((medication) => medication.medicationId).join('\u0000');
}

function spfaKey(value: SpfaSummary): string {
  return value.service === 'dispensing'
    ? `${value.service}\u0000${value.subtype}`
    : value.service;
}

function barrierKey(value: BarrierSummary): string {
  return `${value.category}\u0000${taxonomyKey(value.classification)}\u0000${value.role}`;
}

function copyTaxonomyTerm(
  value: TaxonomyTermRef,
): TaxonomyTermRef {
  return {
    taxonomyId: value.taxonomyId,
    taxonomyVersion: value.taxonomyVersion,
    conceptId: value.conceptId,
  };
}

function projectDisplayLabel(
  datum: RuntimePatientDatum<string>,
  path: string,
): SummaryKnownValue<string> {
  if (datum.state === 'known') {
    return {
      state: 'known',
      value: datum.value,
      certainty: datum.certainty,
    };
  }
  if (datum.state === 'explicit_absence') {
    return { state: 'explicit_absence', topic: datum.topic };
  }
  if (datum.state === 'patient_unknown') {
    return { state: 'patient_unknown', topic: datum.topic };
  }
  return fail(path, 'unsupported displayName state');
}

type MedicationInventory = {
  medications: SummaryMedicationRef[];
  byId: Map<string, SummaryMedicationRef>;
};

function buildMedicationInventory(
  runtime: PatientRuntimeViewV2,
): MedicationInventory {
  const sourceMedications: RuntimePatientMedicationV2[] = [
    ...runtime.pharmacotherapy.prescribedMedications,
    ...runtime.pharmacotherapy.otherMedicinesAndProducts,
  ];
  const byId = new Map<string, SummaryMedicationRef>();

  sourceMedications.forEach((medication, index) => {
    const path = `patientRuntime.pharmacotherapy.medications[${index}]`;
    if (byId.has(medication.medicationId)) {
      fail(`${path}.medicationId`, `duplicate medication: ${medication.medicationId}`);
    }
    byId.set(medication.medicationId, {
      medicationId: medication.medicationId,
      displayLabel: projectDisplayLabel(
        medication.displayName,
        `${path}.displayName`,
      ),
    });
  });

  const medications = [...byId.values()].sort((left, right) =>
    ordinalCompare(left.medicationId, right.medicationId),
  );
  return { medications, byId };
}

function projectMedicationScope(
  references: readonly MedicationId[],
  inventory: MedicationInventory,
  path: string,
): MedicationScopeSummary {
  const medications = references.map((reference, index) => {
    const medication = inventory.byId.get(reference);
    if (medication === undefined) {
      fail(`${path}[${index}]`, `unknown medication reference: ${reference}`);
    }
    return medication;
  });
  return {
    medications: medications.sort((left, right) =>
      ordinalCompare(left.medicationId, right.medicationId),
    ),
  };
}

function projectNonEmptyMedicationScope(
  references: readonly MedicationId[],
  inventory: MedicationInventory,
  path: string,
): NonEmptyMedicationScopeSummary {
  const projected = projectMedicationScope(references, inventory, path);
  if (projected.medications.length === 0) {
    fail(path, 'medication scope must not be empty');
  }
  return {
    medications: projected.medications as NonEmptyArray<SummaryMedicationRef>,
  };
}

function projectSpfa(spfa: SpfaConclusion, path: string): SpfaSummary {
  if (spfa.value.service === 'dispensing') {
    if (spfa.value.subtype === undefined) {
      fail(`${path}.value.subtype`, 'dispensing subtype is required');
    }
    return { service: 'dispensing', subtype: spfa.value.subtype };
  }
  return { service: spfa.value.service };
}

type SpfaIndex = {
  byId: Map<string, SpfaSummary>;
  carePath: CarePathSummary;
};

function buildCarePath(evaluator: EvaluatorViewV2): SpfaIndex {
  const spfas = [
    evaluator.carePath.initialSpfa,
    ...evaluator.carePath.additionalSpfas,
  ];
  const byId = new Map<string, SpfaSummary>();
  spfas.forEach((spfa, index) => {
    if (byId.has(spfa.conclusionId)) {
      fail('evaluator.carePath', `ambiguous SPFA reference: ${spfa.conclusionId}`);
    }
    byId.set(
      spfa.conclusionId,
      projectSpfa(
        spfa,
        index === 0
          ? 'evaluator.carePath.initialSpfa'
          : `evaluator.carePath.additionalSpfas[${index - 1}]`,
      ),
    );
  });

  const resolve = (reference: ConclusionId, path: string): SpfaSummary => {
    const spfa = byId.get(reference);
    if (spfa === undefined) fail(path, `unknown SPFA reference: ${reference}`);
    return spfa;
  };

  const transitions = sortByProjectionKey(
    evaluator.carePath.transitions.map((transition, index) => ({
      from: resolve(
        transition.value.fromSpfaRef,
        `evaluator.carePath.transitions[${index}].value.fromSpfaRef`,
      ),
      to: resolve(
        transition.value.toSpfaRef,
        `evaluator.carePath.transitions[${index}].value.toSpfaRef`,
      ),
    })),
    (transition) => `${spfaKey(transition.from)}\u0000${spfaKey(transition.to)}`,
  );

  return {
    byId,
    carePath: {
      initialSpfa: resolve(
        evaluator.carePath.initialSpfa.conclusionId,
        'evaluator.carePath.initialSpfa.conclusionId',
      ),
      additionalSpfas: sortByProjectionKey(
        evaluator.carePath.additionalSpfas.map((spfa) =>
          resolve(spfa.conclusionId, 'evaluator.carePath.additionalSpfas'),
        ),
        spfaKey,
      ),
      transitions,
    },
  };
}

function indexConclusions<T extends { conclusionId: ConclusionId }>(
  values: readonly T[],
  path: string,
): Map<string, T> {
  const result = new Map<string, T>();
  values.forEach((value, index) => {
    if (result.has(value.conclusionId)) {
      fail(`${path}[${index}].conclusionId`, `ambiguous reference: ${value.conclusionId}`);
    }
    result.set(value.conclusionId, value);
  });
  return result;
}

function groupByReference<T>(
  values: readonly T[],
  reference: (value: T) => ConclusionId,
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  values.forEach((value) => {
    const key = reference(value);
    const current = result.get(key) ?? [];
    current.push(value);
    result.set(key, current);
  });
  return result;
}

function projectIncidenceFinding(
  finding: IncidenceFinding,
  inventory: MedicationInventory,
  spfas: SpfaIndex,
  path: string,
): IncidenceFindingSummary {
  const spfa = spfas.byId.get(finding.value.spfaRef);
  if (spfa === undefined) {
    fail(`${path}.value.spfaRef`, `unknown SPFA reference: ${finding.value.spfaRef}`);
  }
  return {
    spfa,
    medicationScope: projectMedicationScope(
      finding.value.medicationRefs,
      inventory,
      `${path}.value.medicationRefs`,
    ),
    semanticMeaning: finding.value.semanticMeaning,
  };
}

function buildIncidence(
  evaluator: EvaluatorViewV2,
  inventory: MedicationInventory,
  spfas: SpfaIndex,
): IncidenceSummary {
  const status = evaluator.incidence.assessment.value.status;
  if (status !== 'present') {
    if (evaluator.incidence.findings.length !== 0) {
      fail('evaluator.incidence.findings', `${status} incidence cannot contain findings`);
    }
    return { status, count: 0, findings: [] };
  }
  const findings = sortByProjectionKey(
    evaluator.incidence.findings.map((finding, index) =>
      projectIncidenceFinding(
        finding,
        inventory,
        spfas,
        `evaluator.incidence.findings[${index}]`,
      ),
    ),
    (finding) =>
      `${spfaKey(finding.spfa)}\u0000${medicationScopeKey(finding.medicationScope)}`,
  );
  if (findings.length === 0) {
    fail('evaluator.incidence.findings', 'present incidence requires findings');
  }
  return {
    status: 'present',
    count: findings.length,
    findings: findings as unknown as NonEmptyArray<IncidenceFindingSummary>,
  };
}

function projectPrmFinding(
  finding: PrmFinding,
  inventory: MedicationInventory,
  path: string,
): PrmFindingSummary {
  return {
    classification: copyTaxonomyTerm(finding.value.classification),
    medicationScope: projectMedicationScope(
      finding.value.medicationRefs,
      inventory,
      `${path}.value.medicationRefs`,
    ),
  };
}

function buildPrm(
  evaluator: EvaluatorViewV2,
  inventory: MedicationInventory,
): PrmSummary {
  const status = evaluator.prm.assessment.value.status;
  if (status !== 'present') {
    if (evaluator.prm.findings.length !== 0) {
      fail('evaluator.prm.findings', `${status} PRM assessment cannot contain findings`);
    }
    return { status, count: 0, findings: [] };
  }
  const findings = sortByProjectionKey(
    evaluator.prm.findings.map((finding, index) =>
      projectPrmFinding(
        finding,
        inventory,
        `evaluator.prm.findings[${index}]`,
      ),
    ),
    (finding) =>
      `${taxonomyKey(finding.classification)}\u0000${medicationScopeKey(finding.medicationScope)}`,
  );
  if (findings.length === 0) {
    fail('evaluator.prm.findings', 'present PRM assessment requires findings');
  }
  return {
    status: 'present',
    count: findings.length,
    findings: findings as unknown as NonEmptyArray<PrmFindingSummary>,
  };
}

function projectRnmFinding(
  assessment: RnmAssessment,
  inventory: MedicationInventory,
  path: string,
): RnmFindingSummary {
  if (assessment.value.status === 'no_rnm') {
    fail(path, 'no_rnm is not an RNM finding');
  }
  return {
    outcome: assessment.value.status,
    ...(assessment.value.classification === undefined
      ? {}
      : { classification: copyTaxonomyTerm(assessment.value.classification) }),
    medicationScope: projectMedicationScope(
      assessment.value.medicationRefs,
      inventory,
      `${path}.value.medicationRefs`,
    ),
  };
}

function buildRnm(
  evaluator: EvaluatorViewV2,
  inventory: MedicationInventory,
): RnmSummary {
  const noRnm = evaluator.rnmAssessments.filter(
    (assessment) => assessment.value.status === 'no_rnm',
  );
  if (noRnm.length > 0) {
    if (evaluator.rnmAssessments.length !== 1) {
      fail('evaluator.rnmAssessments', 'no_rnm cannot coexist with RNM findings');
    }
    return {
      status: 'no_rnm',
      rnmCount: 0,
      riskOfRnmCount: 0,
      findings: [],
    };
  }

  const findings = sortByProjectionKey(
    evaluator.rnmAssessments.map((assessment, index) =>
      projectRnmFinding(
        assessment,
        inventory,
        `evaluator.rnmAssessments[${index}]`,
      ),
    ),
    (finding) =>
      `${finding.outcome}\u0000${taxonomyKey(finding.classification)}\u0000${medicationScopeKey(finding.medicationScope)}`,
  );
  if (findings.length === 0) {
    fail('evaluator.rnmAssessments', 'an explicit RNM assessment is required');
  }
  const rnmCount = findings.filter((finding) => finding.outcome === 'rnm').length;
  const riskOfRnmCount = findings.length - rnmCount;
  const status =
    rnmCount > 0 && riskOfRnmCount > 0
      ? 'rnm_and_risk_of_rnm'
      : rnmCount > 0
        ? 'rnm'
        : 'risk_of_rnm';
  return {
    status,
    rnmCount,
    riskOfRnmCount,
    findings: findings as unknown as NonEmptyArray<RnmFindingSummary>,
  };
}

type AdherenceIndex = {
  assessmentsById: Map<string, AdherenceAssessment>;
  typeById: Map<string, NonAdherenceTypeConclusion>;
  typeByAssessment: Map<string, NonAdherenceTypeConclusion[]>;
  profileByAssessment: Map<string, AdherencePatientProfileConclusion[]>;
  barrierAssessmentById: Map<string, AdherenceBarrierAssessment>;
  barrierAssessmentByAdherence: Map<string, AdherenceBarrierAssessment[]>;
  barrierById: Map<string, AdherenceBarrier>;
  barriersByAssessment: Map<string, AdherenceBarrier[]>;
};

function buildAdherenceIndex(evaluator: EvaluatorViewV2): AdherenceIndex {
  const result: AdherenceIndex = {
    assessmentsById: indexConclusions(
      evaluator.adherence.assessments,
      'evaluator.adherence.assessments',
    ),
    typeById: indexConclusions(
      evaluator.adherence.typeConclusions,
      'evaluator.adherence.typeConclusions',
    ),
    typeByAssessment: groupByReference(
      evaluator.adherence.typeConclusions,
      (value) => value.value.adherenceAssessmentRef,
    ),
    profileByAssessment: groupByReference(
      evaluator.adherence.patientProfiles,
      (value) => value.value.adherenceAssessmentRef,
    ),
    barrierAssessmentById: indexConclusions(
      evaluator.adherence.barrierAssessments,
      'evaluator.adherence.barrierAssessments',
    ),
    barrierAssessmentByAdherence: groupByReference(
      evaluator.adherence.barrierAssessments,
      (value) => value.value.adherenceAssessmentRef,
    ),
    barrierById: indexConclusions(
      evaluator.adherence.barriers,
      'evaluator.adherence.barriers',
    ),
    barriersByAssessment: groupByReference(
      evaluator.adherence.barriers,
      (value) => value.value.barrierAssessmentRef,
    ),
  };

  evaluator.adherence.typeConclusions.forEach((conclusion, index) => {
    if (!result.assessmentsById.has(conclusion.value.adherenceAssessmentRef)) {
      fail(
        `evaluator.adherence.typeConclusions[${index}].value.adherenceAssessmentRef`,
        `unknown adherence assessment reference: ${conclusion.value.adherenceAssessmentRef}`,
      );
    }
  });
  evaluator.adherence.patientProfiles.forEach((profile, index) => {
    if (!result.assessmentsById.has(profile.value.adherenceAssessmentRef)) {
      fail(
        `evaluator.adherence.patientProfiles[${index}].value.adherenceAssessmentRef`,
        `unknown adherence assessment reference: ${profile.value.adherenceAssessmentRef}`,
      );
    }
  });
  evaluator.adherence.barrierAssessments.forEach((assessment, index) => {
    if (!result.assessmentsById.has(assessment.value.adherenceAssessmentRef)) {
      fail(
        `evaluator.adherence.barrierAssessments[${index}].value.adherenceAssessmentRef`,
        `unknown adherence assessment reference: ${assessment.value.adherenceAssessmentRef}`,
      );
    }
  });
  evaluator.adherence.barriers.forEach((barrier, index) => {
    if (!result.barrierAssessmentById.has(barrier.value.barrierAssessmentRef)) {
      fail(
        `evaluator.adherence.barriers[${index}].value.barrierAssessmentRef`,
        `unknown barrier assessment reference: ${barrier.value.barrierAssessmentRef}`,
      );
    }
  });

  return result;
}

function projectAdherenceType(
  conclusion: NonAdherenceTypeConclusion,
): AdherenceTypeSummary {
  return conclusion.value.status === 'determined'
    ? { status: 'determined', type: conclusion.value.type }
    : { status: 'not_determinable' };
}

function projectAdherenceProfile(
  conclusions: readonly AdherencePatientProfileConclusion[],
  path: string,
): AdherenceProfileSummary {
  if (conclusions.length === 0) return { status: 'absent' };
  if (conclusions.length !== 1) fail(path, 'adherence profile is ambiguous');
  const conclusion = conclusions[0];
  return conclusion.value.status === 'determined'
    ? { status: 'determined', profile: conclusion.value.profile }
    : { status: 'not_determinable' };
}

function projectBarrier(barrier: AdherenceBarrier): BarrierSummary {
  return {
    role: barrier.value.role,
    category: barrier.value.category,
    ...(barrier.value.classification === undefined
      ? {}
      : { classification: copyTaxonomyTerm(barrier.value.classification) }),
  };
}

function projectBarrierSet(
  assessment: AdherenceBarrierAssessment,
  index: AdherenceIndex,
  path: string,
): BarrierSetSummary {
  const barriers = index.barriersByAssessment.get(assessment.conclusionId) ?? [];
  if (assessment.value.status === 'not_determinable') {
    if (barriers.length !== 0) {
      fail(path, 'not_determinable barrier assessment cannot contain barriers');
    }
    return { status: 'not_determinable' };
  }
  const primary = barriers.filter((barrier) => barrier.value.role === 'primary');
  if (primary.length !== 1) {
    fail(path, 'identified barriers require exactly one primary barrier');
  }
  const secondary = sortByProjectionKey(
    barriers
      .filter((barrier) => barrier.value.role === 'secondary')
      .map(projectBarrier),
    barrierKey,
  );
  return {
    status: 'identified',
    primary: projectBarrier(primary[0]),
    secondary,
  };
}

function projectAdherenceAssessment(
  assessment: AdherenceAssessment,
  inventory: MedicationInventory,
  index: AdherenceIndex,
  path: string,
): AdherenceAssessmentSummary {
  const medicationScope = projectNonEmptyMedicationScope(
    assessment.value.medicationRefs,
    inventory,
    `${path}.value.medicationRefs`,
  );
  if (assessment.value.status !== 'non_adherent') {
    return { medicationScope, status: assessment.value.status };
  }

  const types = index.typeByAssessment.get(assessment.conclusionId) ?? [];
  if (types.length !== 1) fail(path, 'non_adherent type is missing or ambiguous');
  const barrierAssessments =
    index.barrierAssessmentByAdherence.get(assessment.conclusionId) ?? [];
  if (barrierAssessments.length !== 1) {
    fail(path, 'barrier assessment is missing or ambiguous');
  }
  return {
    medicationScope,
    status: 'non_adherent',
    nonAdherence: {
      type: projectAdherenceType(types[0]),
      patientProfile: projectAdherenceProfile(
        index.profileByAssessment.get(assessment.conclusionId) ?? [],
        `${path}.patientProfile`,
      ),
      barriers: projectBarrierSet(
        barrierAssessments[0],
        index,
        `${path}.barriers`,
      ),
    },
  };
}

function resolveAdherenceAssessment(
  reference: ConclusionId,
  index: AdherenceIndex,
  path: string,
): AdherenceAssessment {
  const assessment = index.assessmentsById.get(reference);
  if (assessment === undefined) {
    fail(path, `unknown adherence assessment reference: ${reference}`);
  }
  return assessment;
}

function resolveBarrierAssessmentForBarrier(
  barrier: AdherenceBarrier,
  index: AdherenceIndex,
  path: string,
): AdherenceBarrierAssessment {
  const assessment = index.barrierAssessmentById.get(
    barrier.value.barrierAssessmentRef,
  );
  if (assessment === undefined) {
    fail(path, `unknown barrier assessment reference: ${barrier.value.barrierAssessmentRef}`);
  }
  return assessment;
}

function buildAdherenceAssessments(
  evaluator: EvaluatorViewV2,
  inventory: MedicationInventory,
  index: AdherenceIndex,
): AdherenceAssessmentSummary[] {
  return sortByProjectionKey(
    evaluator.adherence.assessments.map((assessment, assessmentIndex) =>
      projectAdherenceAssessment(
        assessment,
        inventory,
        index,
        `evaluator.adherence.assessments[${assessmentIndex}]`,
      ),
    ),
    (assessment) => medicationScopeKey(assessment.medicationScope),
  );
}

function projectStrategy(
  strategy: AdherenceStrategy,
  inventory: MedicationInventory,
  index: AdherenceIndex,
  path: string,
): AdherenceStrategySummary {
  const assessment = resolveAdherenceAssessment(
    strategy.value.adherenceAssessmentRef,
    index,
    `${path}.value.adherenceAssessmentRef`,
  );
  const medicationScope = projectNonEmptyMedicationScope(
    assessment.value.medicationRefs,
    inventory,
    `${path}.medicationScope`,
  );
  const addressedBarriers = sortByProjectionKey(
    strategy.value.addressedBarrierRefs.map((reference, referenceIndex) => {
      const barrier = index.barrierById.get(reference);
      if (barrier === undefined) {
        fail(
          `${path}.value.addressedBarrierRefs[${referenceIndex}]`,
          `unknown adherence barrier reference: ${reference}`,
        );
      }
      const barrierAssessment = resolveBarrierAssessmentForBarrier(
        barrier,
        index,
        `${path}.value.addressedBarrierRefs[${referenceIndex}]`,
      );
      if (barrierAssessment.value.adherenceAssessmentRef !== assessment.conclusionId) {
        fail(
          `${path}.value.addressedBarrierRefs[${referenceIndex}]`,
          'barrier belongs to another adherence scope',
        );
      }
      return projectBarrier(barrier);
    }),
    barrierKey,
  );

  if (strategy.value.category === 'combined') {
    return {
      medicationScope,
      category: 'combined',
      componentCategories: [...strategy.value.componentCategories].sort(
        ordinalCompare,
      ) as unknown as NonEmptyArray<
        (typeof strategy.value.componentCategories)[number]
      >,
      addressedBarriers,
    };
  }
  return {
    medicationScope,
    category: strategy.value.category,
    addressedBarriers,
  };
}

function validateReferralReference(
  reference: ConclusionId,
  evaluator: EvaluatorViewV2,
  path: string,
): void {
  if (
    reference !== evaluator.referral.conclusionId ||
    evaluator.referral.value.status !== 'required'
  ) {
    fail(path, 'reference does not identify the required evaluator referral');
  }
}

function projectProfessionalAction(
  action: ProfessionalAction,
  evaluator: EvaluatorViewV2,
  spfas: SpfaIndex,
  path: string,
): ProfessionalActionSummary {
  const spfa = spfas.byId.get(action.value.spfaRef);
  if (spfa === undefined) {
    fail(`${path}.value.spfaRef`, `unknown SPFA reference: ${action.value.spfaRef}`);
  }
  const referralInvolvement = action.value.referralRef !== undefined;
  if (action.value.referralRef !== undefined) {
    validateReferralReference(
      action.value.referralRef,
      evaluator,
      `${path}.value.referralRef`,
    );
  }
  let targetSpfa: SpfaSummary | undefined;
  if (action.value.targetSpfaRef !== undefined) {
    targetSpfa = spfas.byId.get(action.value.targetSpfaRef);
    if (targetSpfa === undefined) {
      fail(
        `${path}.value.targetSpfaRef`,
        `unknown SPFA reference: ${action.value.targetSpfaRef}`,
      );
    }
  }
  return {
    spfa,
    category: action.value.category,
    ...(action.value.classification === undefined
      ? {}
      : { classification: copyTaxonomyTerm(action.value.classification) }),
    ...(targetSpfa === undefined ? {} : { targetSpfa }),
    referralInvolvement,
  };
}

type AddressedConclusionIndex = {
  incidenceById: Map<string, IncidenceFinding>;
  prmById: Map<string, PrmFinding>;
  rnmById: Map<string, RnmAssessment>;
  adherence: AdherenceIndex;
};

function assertUnambiguousAddressedIds(
  index: AddressedConclusionIndex,
): void {
  const seen = new Set<string>();
  const maps = [
    index.incidenceById,
    index.prmById,
    index.rnmById,
    index.adherence.assessmentsById,
    index.adherence.typeById,
    index.adherence.barrierById,
  ];
  maps.forEach((map) => {
    map.forEach((_value, key) => {
      if (seen.has(key)) {
        fail('evaluator', `ambiguous addressed conclusion reference: ${key}`);
      }
      seen.add(key);
    });
  });
}

function projectAddressedConclusion(
  reference: ConclusionId,
  addressed: AddressedConclusionIndex,
  inventory: MedicationInventory,
  spfas: SpfaIndex,
  path: string,
): AddressedConclusionSummary {
  const incidence = addressed.incidenceById.get(reference);
  if (incidence !== undefined) {
    return {
      kind: 'incidence',
      ...projectIncidenceFinding(incidence, inventory, spfas, path),
    };
  }
  const prm = addressed.prmById.get(reference);
  if (prm !== undefined) {
    return {
      kind: 'prm',
      ...projectPrmFinding(prm, inventory, path),
    };
  }
  const rnm = addressed.rnmById.get(reference);
  if (rnm !== undefined) {
    if (rnm.value.status === 'no_rnm') {
      fail(path, 'no_rnm cannot be addressed by an intervention');
    }
    return {
      kind: 'rnm_assessment',
      ...projectRnmFinding(rnm, inventory, path),
    };
  }
  const adherenceAssessment = addressed.adherence.assessmentsById.get(reference);
  if (adherenceAssessment !== undefined) {
    return {
      kind: 'adherence_assessment',
      status: adherenceAssessment.value.status,
      medicationScope: projectNonEmptyMedicationScope(
        adherenceAssessment.value.medicationRefs,
        inventory,
        `${path}.medicationScope`,
      ),
    };
  }
  const typeConclusion = addressed.adherence.typeById.get(reference);
  if (typeConclusion !== undefined) {
    const assessment = resolveAdherenceAssessment(
      typeConclusion.value.adherenceAssessmentRef,
      addressed.adherence,
      path,
    );
    return {
      kind: 'non_adherence_type',
      medicationScope: projectNonEmptyMedicationScope(
        assessment.value.medicationRefs,
        inventory,
        `${path}.medicationScope`,
      ),
      type: projectAdherenceType(typeConclusion),
    };
  }
  const barrier = addressed.adherence.barrierById.get(reference);
  if (barrier !== undefined) {
    const barrierAssessment = resolveBarrierAssessmentForBarrier(
      barrier,
      addressed.adherence,
      path,
    );
    const assessment = resolveAdherenceAssessment(
      barrierAssessment.value.adherenceAssessmentRef,
      addressed.adherence,
      path,
    );
    return {
      kind: 'adherence_barrier',
      medicationScope: projectNonEmptyMedicationScope(
        assessment.value.medicationRefs,
        inventory,
        `${path}.medicationScope`,
      ),
      barrier: projectBarrier(barrier),
    };
  }
  return fail(path, `unknown addressed conclusion reference: ${reference}`);
}

function projectIntervention(
  intervention: PharmaceuticalIntervention,
  evaluator: EvaluatorViewV2,
  inventory: MedicationInventory,
  spfas: SpfaIndex,
  actionsById: Map<string, ProfessionalAction>,
  addressed: AddressedConclusionIndex,
  path: string,
): PharmaceuticalInterventionSummary {
  const spfa = spfas.byId.get(intervention.value.spfaRef);
  if (spfa === undefined) {
    fail(`${path}.value.spfaRef`, `unknown SPFA reference: ${intervention.value.spfaRef}`);
  }
  let relatedProfessionalActionCategory:
    | ProfessionalAction['value']['category']
    | undefined;
  if (intervention.value.professionalActionRef !== undefined) {
    const action = actionsById.get(intervention.value.professionalActionRef);
    if (action === undefined) {
      fail(
        `${path}.value.professionalActionRef`,
        `unknown professional action reference: ${intervention.value.professionalActionRef}`,
      );
    }
    relatedProfessionalActionCategory = action.value.category;
  }
  if (intervention.value.addressedConclusionRefs.length === 0) {
    fail(`${path}.value.addressedConclusionRefs`, 'must not be empty');
  }
  const addressedConclusions = sortByProjectionKey(
    intervention.value.addressedConclusionRefs.map((reference, index) =>
      projectAddressedConclusion(
        reference,
        addressed,
        inventory,
        spfas,
        `${path}.value.addressedConclusionRefs[${index}]`,
      ),
    ),
    (addressedConclusion) =>
      `${addressedConclusion.kind}\u0000${canonicalSortKey(addressedConclusion)}`,
  ) as unknown as NonEmptyArray<AddressedConclusionSummary>;
  const directReferralInvolvement = intervention.value.referralRef !== undefined;
  if (intervention.value.referralRef !== undefined) {
    validateReferralReference(
      intervention.value.referralRef,
      evaluator,
      `${path}.value.referralRef`,
    );
  }
  return {
    spfa,
    target: intervention.value.target,
    ...(intervention.value.classification === undefined
      ? {}
      : { classification: copyTaxonomyTerm(intervention.value.classification) }),
    addressedConclusions,
    ...(relatedProfessionalActionCategory === undefined
      ? {}
      : { relatedProfessionalActionCategory }),
    directReferralInvolvement,
  };
}

function projectReport(
  evaluator: EvaluatorViewV2,
): SummaryReportRequirement {
  if (evaluator.referral.value.status !== 'required') {
    fail('evaluator.referral', 'required referral expected while projecting report');
  }
  const report = evaluator.referral.value.report;
  if (report.status === 'not_required') {
    return { status: 'not_required', essentialContents: [] };
  }
  const semanticContents = reportRequirementSemanticContentsV2(report);
  const essentialContents = isIdentifiedReportRequirementV2(report)
    ? [...semanticContents]
    : [...semanticContents].sort(ordinalCompare);
  if (essentialContents.length === 0) {
    fail('evaluator.referral.value.report.essentialContents', 'must not be empty');
  }
  return {
    status: report.status,
    essentialContents: essentialContents as unknown as NonEmptyArray<string>,
  };
}

function projectReferral(evaluator: EvaluatorViewV2): ReferralSummary {
  if (evaluator.referral.value.status === 'not_required') {
    return { status: 'not_required' };
  }
  return {
    status: 'required',
    urgency: evaluator.referral.value.urgency,
    destination: {
      label: evaluator.referral.value.destination.label,
      ...(evaluator.referral.value.destination.classification === undefined
        ? {}
        : {
            classification: copyTaxonomyTerm(
              evaluator.referral.value.destination.classification,
            ),
          }),
    },
    reason: evaluator.referral.value.reason,
    report: projectReport(evaluator),
  };
}

export function buildTeachingCaseSummaryV2(
  patientRuntime: PatientRuntimeViewV2,
  evaluator: EvaluatorViewV2,
): TeachingCaseSummaryV2 {
  if (patientRuntime.caseVersionId !== evaluator.caseVersionId) {
    fail('caseVersionId', 'patient runtime and evaluator versions must match');
  }

  const inventory = buildMedicationInventory(patientRuntime);
  const spfas = buildCarePath(evaluator);
  const incidence = buildIncidence(evaluator, inventory, spfas);
  const prm = buildPrm(evaluator, inventory);
  const rnm = buildRnm(evaluator, inventory);
  const adherenceIndex = buildAdherenceIndex(evaluator);
  const adherenceAssessments = buildAdherenceAssessments(
    evaluator,
    inventory,
    adherenceIndex,
  );
  const strategies = sortByProjectionKey(
    evaluator.adherence.strategies.map((strategy, index) =>
      projectStrategy(
        strategy,
        inventory,
        adherenceIndex,
        `evaluator.adherence.strategies[${index}]`,
      ),
    ),
    (strategy) =>
      `${medicationScopeKey(strategy.medicationScope)}\u0000${strategy.category}`,
  );

  const actionsById = indexConclusions(
    evaluator.professionalActions,
    'evaluator.professionalActions',
  );
  const professionalActions = sortByProjectionKey(
    evaluator.professionalActions.map((action, index) =>
      projectProfessionalAction(
        action,
        evaluator,
        spfas,
        `evaluator.professionalActions[${index}]`,
      ),
    ),
    (action) =>
      `${spfaKey(action.spfa)}\u0000${action.category}\u0000${taxonomyKey(action.classification)}`,
  );

  const addressed: AddressedConclusionIndex = {
    incidenceById: indexConclusions(
      evaluator.incidence.findings,
      'evaluator.incidence.findings',
    ),
    prmById: indexConclusions(evaluator.prm.findings, 'evaluator.prm.findings'),
    rnmById: indexConclusions(evaluator.rnmAssessments, 'evaluator.rnmAssessments'),
    adherence: adherenceIndex,
  };
  assertUnambiguousAddressedIds(addressed);
  const pharmaceuticalInterventions = sortByProjectionKey(
    evaluator.pharmaceuticalInterventions.map((intervention, index) =>
      projectIntervention(
        intervention,
        evaluator,
        inventory,
        spfas,
        actionsById,
        addressed,
        `evaluator.pharmaceuticalInterventions[${index}]`,
      ),
    ),
    (intervention) =>
      `${spfaKey(intervention.spfa)}\u0000${intervention.target}\u0000${taxonomyKey(intervention.classification)}\u0000${canonicalSortKey(intervention.addressedConclusions)}`,
  );

  const numberOfBarriers = adherenceAssessments.reduce((count, assessment) => {
    if (
      assessment.status !== 'non_adherent' ||
      assessment.nonAdherence.barriers.status !== 'identified'
    ) {
      return count;
    }
    return count + 1 + assessment.nonAdherence.barriers.secondary.length;
  }, 0);

  return {
    schemaVersion: '2.0',
    caseVersionId: patientRuntime.caseVersionId,
    medications: inventory.medications,
    carePath: spfas.carePath,
    incidence,
    prm,
    rnm,
    adherence: {
      assessments: adherenceAssessments,
      strategies,
    },
    professionalActions,
    pharmaceuticalInterventions,
    referral: projectReferral(evaluator),
    objectiveMetrics: {
      numberOfMedications: inventory.medications.length,
      numberOfSpfas: 1 + spfas.carePath.additionalSpfas.length,
      numberOfIncidences: incidence.count,
      numberOfPrms: prm.count,
      numberOfRnms: rnm.rnmCount,
      numberOfRnmRisks: rnm.riskOfRnmCount,
      numberOfAdherenceScopes: adherenceAssessments.length,
      numberOfBarriers,
    },
  };
}
