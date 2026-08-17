import type {
  ComplianceCheckCode,
  ComplianceCheckStatus,
  ComplianceCheckV2,
  ComplianceCountsV2,
  ComplianceDimension,
  ComplianceOverallStatus,
  BriefComplianceReportV2,
  DimensionComplianceV2,
} from './brief-compliance-types';
import type { TaxonomyTermRef } from './evaluator-types';
import type {
  AdherenceAssessmentIntent,
  AdherenceBarrierSetIntent,
  AdherenceStrategyIntent,
  CardinalityConstraint,
  MedicationScopeIntent,
  NonAdherenceDetailsPlan,
  PharmaceuticalInterventionIntent,
  ProfessionalActionIntent,
  TeachingCaseGenerationBriefV2,
  TeachingDimensionPlan,
} from './teaching-brief-types';
import type {
  AdherenceAssessmentSummary,
  AdherenceStrategySummary,
  BarrierSummary,
  MedicationScopeSummary,
  NonEmptyMedicationScopeSummary,
  PharmaceuticalInterventionSummary,
  ProfessionalActionSummary,
  RnmFindingSummary,
  SpfaSummary,
  TeachingCaseSummaryV2,
} from './teaching-case-summary-types';
import type { MedicationId } from './types';

const DIMENSION_ORDER: readonly ComplianceDimension[] = [
  'carePath',
  'incidence',
  'prm',
  'rnm',
  'adherence',
  'adherenceStrategies',
  'professionalActions',
  'pharmaceuticalInterventions',
  'referral',
  'complexity',
  'teacherInstruction',
];

export class BriefComplianceBuildError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'BriefComplianceBuildError';
  }
}

function fail(path: string, message: string): never {
  throw new BriefComplianceBuildError(path, message);
}

function rawOrdinalCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function ordinalCompare(left: string, right: string): number {
  const normalized = rawOrdinalCompare(
    left.normalize('NFKC'),
    right.normalize('NFKC'),
  );
  return normalized === 0 ? rawOrdinalCompare(left, right) : normalized;
}

function canonicalFreeText(value: string): string {
  return value.normalize('NFKC').trim();
}

function canonicalMedicationLabel(value: string): string {
  return canonicalFreeText(value).toLowerCase();
}

function canonicalKey(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') {
    return `s:${JSON.stringify(value.normalize('NFKC'))}:o:${JSON.stringify(value)}`;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${typeof value}:${String(value)}`;
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalKey).join(',')}]`;
  }
  if (typeof value === 'object') {
    const source = value as Record<string, unknown>;
    return `{${Object.keys(source)
      .sort(ordinalCompare)
      .map((key) => `${canonicalKey(key)}:${canonicalKey(source[key])}`)
      .join(',')}}`;
  }
  return `${typeof value}:${String(value)}`;
}

function sameTaxonomy(
  left: TaxonomyTermRef | undefined,
  right: TaxonomyTermRef | undefined,
): boolean {
  return (
    left !== undefined &&
    right !== undefined &&
    left.taxonomyId === right.taxonomyId &&
    left.taxonomyVersion === right.taxonomyVersion &&
    left.conceptId === right.conceptId
  );
}

function taxonomyKey(value: TaxonomyTermRef): string {
  return `${value.taxonomyId}\u0000${value.taxonomyVersion}\u0000${value.conceptId}`;
}

function spfaService(value: SpfaSummary): SpfaSummary['service'] {
  return value.service;
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort(ordinalCompare);
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  const sortedLeft = sortedUnique(left);
  const sortedRight = sortedUnique(right);
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function sameStringMultiset(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const sortedLeft = [...left].sort(ordinalCompare);
  const sortedRight = [...right].sort(ordinalCompare);
  return (
    sortedLeft.length === sortedRight.length &&
    sortedLeft.every((value, index) => value === sortedRight[index])
  );
}

function perfectMatch<E, A>(
  expected: readonly E[],
  actual: readonly A[],
  matches: (expectedValue: E, actualValue: A) => boolean,
): boolean {
  if (expected.length !== actual.length) return false;
  const expectedOrder = [...expected].sort((left, right) =>
    ordinalCompare(canonicalKey(left), canonicalKey(right)),
  );
  const actualOrder = [...actual].sort((left, right) =>
    ordinalCompare(canonicalKey(left), canonicalKey(right)),
  );
  const used = new Array(actualOrder.length).fill(false) as boolean[];

  const visit = (expectedIndex: number): boolean => {
    if (expectedIndex === expectedOrder.length) return true;
    for (let actualIndex = 0; actualIndex < actualOrder.length; actualIndex += 1) {
      if (used[actualIndex]) continue;
      if (!matches(expectedOrder[expectedIndex], actualOrder[actualIndex])) continue;
      used[actualIndex] = true;
      if (visit(expectedIndex + 1)) return true;
      used[actualIndex] = false;
    }
    return false;
  };

  return visit(0);
}

function canInjectivelyMatch<E, A>(
  expected: readonly E[],
  actual: readonly A[],
  matches: (expectedValue: E, actualValue: A) => boolean,
): boolean {
  if (expected.length > actual.length) return false;
  const padding = new Array(actual.length - expected.length).fill(null);
  return perfectMatch(
    [...expected, ...padding] as Array<E | null>,
    actual,
    (expectedValue, actualValue) =>
      expectedValue === null || matches(expectedValue, actualValue),
  );
}

function isForbidden<T, C>(
  plan: TeachingDimensionPlan<T, C>,
): plan is Extract<
  TeachingDimensionPlan<T, C>,
  { targeting: 'not_targeted'; policy: 'forbidden' }
> {
  return plan.targeting === 'not_targeted' && plan.policy === 'forbidden';
}

function isAllowed<T, C>(
  plan: TeachingDimensionPlan<T, C>,
): plan is Extract<
  TeachingDimensionPlan<T, C>,
  { targeting: 'not_targeted'; policy: 'allowed_if_clinically_coherent' }
> {
  return (
    plan.targeting === 'not_targeted' &&
    plan.policy === 'allowed_if_clinically_coherent'
  );
}

function fixedValue<T, C>(plan: TeachingDimensionPlan<T, C>): T | undefined {
  return plan.targeting === 'targeted' &&
    plan.decision.mode === 'teacher_fixed'
    ? plan.decision.value
    : undefined;
}

function aiConstraints<T, C>(plan: TeachingDimensionPlan<T, C>): C | undefined {
  return plan.targeting === 'targeted' && plan.decision.mode === 'ai_proposes'
    ? plan.decision.constraints
    : undefined;
}

class CheckCollector {
  private readonly byDimension = new Map<
    ComplianceDimension,
    ComplianceCheckV2[]
  >();

  constructor() {
    DIMENSION_ORDER.forEach((dimension) => this.byDimension.set(dimension, []));
  }

  add(
    dimension: ComplianceDimension,
    code: ComplianceCheckCode,
    path: string,
    status: ComplianceCheckStatus,
  ): void {
    this.byDimension.get(dimension)!.push({ code, path, status });
  }

  finish(): {
    dimensions: DimensionComplianceV2[];
    counts: ComplianceCountsV2;
    overallStatus: ComplianceOverallStatus;
  } {
    const dimensions = DIMENSION_ORDER.map((dimension) => {
      const checks = [...this.byDimension.get(dimension)!].sort((left, right) => {
        const pathOrder = ordinalCompare(left.path, right.path);
        return pathOrder === 0 ? ordinalCompare(left.code, right.code) : pathOrder;
      });
      return {
        dimension,
        status: reduceStatuses(checks.map((check) => check.status)),
        checks,
      } satisfies DimensionComplianceV2;
    });
    const allChecks = dimensions.flatMap((dimension) => dimension.checks);
    const counts: ComplianceCountsV2 = {
      passed: allChecks.filter((check) => check.status === 'pass').length,
      failed: allChecks.filter((check) => check.status === 'fail').length,
      unresolved: allChecks.filter((check) => check.status === 'unresolved').length,
      notApplicable: allChecks.filter(
        (check) => check.status === 'not_applicable',
      ).length,
    };
    const overallStatus: ComplianceOverallStatus =
      counts.failed > 0
        ? 'non_compliant'
        : counts.unresolved > 0
          ? 'review_required'
          : 'compliant';
    return { dimensions, counts, overallStatus };
  }
}

function reduceStatuses(
  statuses: readonly ComplianceCheckStatus[],
): ComplianceCheckStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('unresolved')) return 'unresolved';
  if (statuses.includes('pass')) return 'pass';
  return 'not_applicable';
}

type MedicationInventory = {
  ids: readonly MedicationId[];
  idSet: Set<string>;
  hasUninspectableLabel: boolean;
  idsByCanonicalLabel: Map<string, MedicationId[]>;
};

function buildMedicationInventory(summary: TeachingCaseSummaryV2): MedicationInventory {
  const idSet = new Set<string>();
  const idsByCanonicalLabel = new Map<string, MedicationId[]>();
  let hasUninspectableLabel = false;
  summary.medications.forEach((medication, index) => {
    if (idSet.has(medication.medicationId)) {
      fail(`summary.medications[${index}].medicationId`, 'duplicate medication');
    }
    idSet.add(medication.medicationId);
    if (medication.displayLabel.state !== 'known') {
      hasUninspectableLabel = true;
      return;
    }
    const key = canonicalMedicationLabel(medication.displayLabel.value);
    const current = idsByCanonicalLabel.get(key) ?? [];
    current.push(medication.medicationId);
    idsByCanonicalLabel.set(key, current);
  });
  return {
    ids: [...idSet].sort(ordinalCompare) as MedicationId[],
    idSet,
    hasUninspectableLabel,
    idsByCanonicalLabel,
  };
}

type ScopeResolution =
  | { status: 'resolved'; medicationIds: readonly MedicationId[] }
  | { status: 'unresolved' };

function resolveScopeIntent(
  scope: MedicationScopeIntent,
  inventory: MedicationInventory,
): ScopeResolution {
  if (scope.kind === 'all_relevant_medications') {
    return { status: 'resolved', medicationIds: inventory.ids };
  }
  if (inventory.hasUninspectableLabel) return { status: 'unresolved' };
  const resolved: MedicationId[] = [];
  for (const description of scope.descriptions) {
    const matches =
      inventory.idsByCanonicalLabel.get(canonicalMedicationLabel(description)) ?? [];
    if (matches.length !== 1) return { status: 'unresolved' };
    resolved.push(matches[0]);
  }
  if (new Set(resolved).size !== resolved.length) return { status: 'unresolved' };
  return { status: 'resolved', medicationIds: [...resolved].sort(ordinalCompare) };
}

function actualScopeIds(
  scope: MedicationScopeSummary,
  inventory: MedicationInventory,
  path: string,
): MedicationId[] {
  const result = scope.medications.map((medication, index) => {
    if (!inventory.idSet.has(medication.medicationId)) {
      fail(`${path}.medications[${index}].medicationId`, 'not in summary.medications');
    }
    return medication.medicationId;
  });
  if (new Set(result).size !== result.length) {
    fail(path, 'contains duplicate MedicationId values');
  }
  return [...result].sort(ordinalCompare);
}

function scopeKey(ids: readonly MedicationId[]): string {
  return [...ids].sort(ordinalCompare).join(',');
}

function scopeMatches(
  expected: readonly MedicationId[],
  actual: MedicationScopeSummary,
  inventory: MedicationInventory,
  path: string,
): boolean {
  return sameStringSet(expected, actualScopeIds(actual, inventory, path));
}

function assertSummaryStructure(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  inventory: MedicationInventory,
): void {
  if (brief.schemaVersion !== '2.0') fail('brief.schemaVersion', 'must be 2.0');
  if (summary.schemaVersion !== '2.0') fail('summary.schemaVersion', 'must be 2.0');

  if (
    (summary.incidence.status === 'present') !==
    (summary.incidence.findings.length > 0)
  ) {
    fail('summary.incidence', 'status is inconsistent with findings');
  }
  if (
    (summary.prm.status === 'present') !==
    (summary.prm.findings.length > 0)
  ) {
    fail('summary.prm', 'status is inconsistent with findings');
  }
  if (summary.rnm.status === 'no_rnm') {
    if (summary.rnm.findings.length !== 0) {
      fail('summary.rnm', 'no_rnm cannot contain findings');
    }
  } else {
    const hasRnm = summary.rnm.findings.some(
      (finding) => finding.outcome === 'rnm',
    );
    const hasRisk = summary.rnm.findings.some(
      (finding) => finding.outcome === 'risk_of_rnm',
    );
    const projectedStatus =
      hasRnm && hasRisk
        ? 'rnm_and_risk_of_rnm'
        : hasRnm
          ? 'rnm'
          : hasRisk
            ? 'risk_of_rnm'
            : undefined;
    if (projectedStatus !== summary.rnm.status) {
      fail('summary.rnm', 'status is inconsistent with finding outcomes');
    }
  }

  const spfaServices = [
    summary.carePath.initialSpfa.service,
    ...summary.carePath.additionalSpfas.map((spfa) => spfa.service),
  ];
  if (new Set(spfaServices).size !== spfaServices.length) {
    fail('summary.carePath', 'contains duplicate SPFA services');
  }
  summary.carePath.transitions.forEach((transition, index) => {
    if (
      !spfaServices.includes(transition.from.service) ||
      !spfaServices.includes(transition.to.service)
    ) {
      fail(`summary.carePath.transitions[${index}]`, 'references an absent SPFA');
    }
  });

  const assertScope = (scope: MedicationScopeSummary, path: string) => {
    actualScopeIds(scope, inventory, path);
  };
  summary.incidence.findings.forEach((finding, index) =>
    assertScope(finding.medicationScope, `summary.incidence.findings[${index}].medicationScope`),
  );
  summary.prm.findings.forEach((finding, index) =>
    assertScope(finding.medicationScope, `summary.prm.findings[${index}].medicationScope`),
  );
  summary.rnm.findings.forEach((finding, index) =>
    assertScope(finding.medicationScope, `summary.rnm.findings[${index}].medicationScope`),
  );
  summary.adherence.assessments.forEach((assessment, index) =>
    assertScope(assessment.medicationScope, `summary.adherence.assessments[${index}].medicationScope`),
  );
  const adherenceMedicationIds = new Set<string>();
  summary.adherence.assessments.forEach((assessment, index) => {
    const ids = actualScopeIds(
      assessment.medicationScope,
      inventory,
      `summary.adherence.assessments[${index}].medicationScope`,
    );
    if (ids.length === 0) {
      fail(`summary.adherence.assessments[${index}].medicationScope`, 'must not be empty');
    }
    ids.forEach((id) => {
      if (adherenceMedicationIds.has(id)) {
        fail('summary.adherence.assessments', 'medication scopes overlap');
      }
      adherenceMedicationIds.add(id);
    });
  });
  summary.adherence.strategies.forEach((strategy, index) =>
    assertScope(strategy.medicationScope, `summary.adherence.strategies[${index}].medicationScope`),
  );
  summary.pharmaceuticalInterventions.forEach((intervention, interventionIndex) =>
    intervention.addressedConclusions.forEach((conclusion, conclusionIndex) =>
      assertScope(
        conclusion.medicationScope,
        `summary.pharmaceuticalInterventions[${interventionIndex}].addressedConclusions[${conclusionIndex}].medicationScope`,
      ),
    ),
  );

  const barriers = summary.adherence.assessments.reduce((count, assessment) => {
    if (
      assessment.status !== 'non_adherent' ||
      assessment.nonAdherence.barriers.status !== 'identified'
    ) {
      return count;
    }
    return count + 1 + assessment.nonAdherence.barriers.secondary.length;
  }, 0);
  const expectedMetrics = {
    numberOfMedications: summary.medications.length,
    numberOfSpfas: 1 + summary.carePath.additionalSpfas.length,
    numberOfIncidences: summary.incidence.findings.length,
    numberOfPrms: summary.prm.findings.length,
    numberOfRnms: summary.rnm.findings.filter((finding) => finding.outcome === 'rnm').length,
    numberOfRnmRisks: summary.rnm.findings.filter(
      (finding) => finding.outcome === 'risk_of_rnm',
    ).length,
    numberOfAdherenceScopes: summary.adherence.assessments.length,
    numberOfBarriers: barriers,
  };
  if (canonicalKey(summary.objectiveMetrics) !== canonicalKey(expectedMetrics)) {
    fail('summary.objectiveMetrics', 'is inconsistent with projected collections');
  }
  if (summary.incidence.count !== summary.incidence.findings.length) {
    fail('summary.incidence.count', 'is inconsistent with findings');
  }
  if (summary.prm.count !== summary.prm.findings.length) {
    fail('summary.prm.count', 'is inconsistent with findings');
  }
  if (
    summary.rnm.rnmCount !== expectedMetrics.numberOfRnms ||
    summary.rnm.riskOfRnmCount !== expectedMetrics.numberOfRnmRisks
  ) {
    fail('summary.rnm', 'counts are inconsistent with findings');
  }
}

function cardinalityMatches(count: number, constraint: CardinalityConstraint): boolean {
  if (constraint.kind === 'exactly') return count === constraint.count;
  if (constraint.kind === 'between') {
    return count >= constraint.min && count <= constraint.max;
  }
  return count >= constraint.min &&
    (constraint.max === undefined || count <= constraint.max);
}

function compareCarePath(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  checks: CheckCollector,
): void {
  const initial = brief.carePath.initialSpfa.decision;
  const actual = summary.carePath.initialSpfa;
  if (initial.mode === 'teacher_fixed') {
    checks.add(
      'carePath',
      'initial_spfa_service',
      'brief.carePath.initialSpfa',
      initial.value.service === actual.service ? 'pass' : 'fail',
    );
    if (initial.value.service === 'dispensing' && actual.service === 'dispensing') {
      const subtype = initial.value.dispensingSubtype;
      const status = subtype.mode === 'teacher_fixed'
        ? subtype.value === actual.subtype
        : subtype.constraints?.allowedValues === undefined ||
            subtype.constraints.allowedValues.includes(actual.subtype);
      checks.add(
        'carePath',
        'initial_spfa_subtype',
        'brief.carePath.initialSpfa.decision.value.dispensingSubtype',
        status ? 'pass' : 'fail',
      );
    }
  } else {
    const constraints = initial.constraints;
    checks.add(
      'carePath',
      'initial_spfa_service',
      'brief.carePath.initialSpfa.decision.constraints.allowedServices',
      constraints?.allowedServices === undefined ||
        constraints.allowedServices.includes(actual.service)
        ? 'pass'
        : 'fail',
    );
    if (actual.service === 'dispensing') {
      checks.add(
        'carePath',
        'initial_spfa_subtype',
        'brief.carePath.initialSpfa.decision.constraints.allowedDispensingSubtypes',
        constraints?.allowedDispensingSubtypes === undefined ||
          constraints.allowedDispensingSubtypes.includes(actual.subtype)
          ? 'pass'
          : 'fail',
      );
    }
  }

  brief.carePath.additionalSpfas.forEach((planned) => {
    const path = `brief.carePath.additionalSpfas.${planned.service}`;
    const found = summary.carePath.additionalSpfas.find(
      (spfa) => spfa.service === planned.service,
    );
    if (planned.inclusion.targeting === 'not_targeted') {
      if (planned.inclusion.policy === 'forbidden') {
        checks.add(
          'carePath',
          'additional_spfa_presence',
          path,
          found === undefined ? 'pass' : 'fail',
        );
      } else {
        checks.add(
          'carePath',
          'additional_spfa_requires_review',
          path,
          found === undefined ? 'not_applicable' : 'unresolved',
        );
      }
      return;
    }
    checks.add(
      'carePath',
      'additional_spfa_presence',
      path,
      found === undefined ? 'fail' : 'pass',
    );
    if (
      planned.service === 'dispensing' &&
      found?.service === 'dispensing'
    ) {
      const subtype = planned.inclusion.decision.mode === 'teacher_fixed'
        ? planned.inclusion.decision.value.dispensingSubtype
        : undefined;
      if (subtype !== undefined) {
        const valid = subtype.mode === 'teacher_fixed'
          ? subtype.value === found.subtype
          : subtype.constraints?.allowedValues === undefined ||
            subtype.constraints.allowedValues.includes(found.subtype);
        checks.add(
          'carePath',
          'additional_spfa_subtype',
          `${path}.dispensingSubtype`,
          valid ? 'pass' : 'fail',
        );
      }
    }
  });

  const transitions = brief.carePath.transitions;
  const actualKeys = summary.carePath.transitions.map(
    (transition) => `${spfaService(transition.from)}->${spfaService(transition.to)}`,
  );
  if (isForbidden(transitions)) {
    checks.add(
      'carePath',
      'transitions_exact_set',
      'brief.carePath.transitions',
      actualKeys.length === 0 ? 'pass' : 'fail',
    );
  } else if (isAllowed(transitions)) {
    checks.add(
      'carePath',
      'transitions_require_review',
      'brief.carePath.transitions',
      actualKeys.length === 0 ? 'not_applicable' : 'unresolved',
    );
  } else if (transitions.decision.mode === 'teacher_fixed') {
    const expectedKeys = transitions.decision.value.map(
      (transition) => `${transition.from}->${transition.to}`,
    );
    checks.add(
      'carePath',
      'transitions_exact_set',
      'brief.carePath.transitions.decision.value',
      sameStringSet(expectedKeys, actualKeys) ? 'pass' : 'fail',
    );
  } else {
    const constraints = transitions.decision.constraints;
    if (constraints?.allowedTransitions !== undefined) {
      const allowed = constraints.allowedTransitions.map(
        (transition) => `${transition.from}->${transition.to}`,
      );
      checks.add(
        'carePath',
        'transitions_allowed_set',
        'brief.carePath.transitions.decision.constraints.allowedTransitions',
        actualKeys.every((key) => allowed.includes(key)) ? 'pass' : 'fail',
      );
    }
    if (constraints?.maximumTransitions !== undefined) {
      checks.add(
        'carePath',
        'transitions_maximum',
        'brief.carePath.transitions.decision.constraints.maximumTransitions',
        actualKeys.length <= constraints.maximumTransitions ? 'pass' : 'fail',
      );
    }
  }
}

function compareIncidence(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  checks: CheckCollector,
): void {
  const plan = brief.incidence;
  if (isForbidden(plan)) {
    checks.add('incidence', 'incidence_status', 'brief.incidence', summary.incidence.status === 'none' ? 'pass' : 'fail');
    return;
  }
  if (isAllowed(plan)) {
    checks.add(
      'incidence',
      'incidence_optional_content_requires_review',
      'brief.incidence',
      summary.incidence.status === 'none' ? 'not_applicable' : 'unresolved',
    );
    return;
  }
  if (plan.decision.mode === 'teacher_fixed') {
    const expected = plan.decision.value;
    const statusMatches = expected.status === summary.incidence.status;
    checks.add('incidence', 'incidence_status', 'brief.incidence.decision.value.status', statusMatches ? 'pass' : 'fail');
    if (expected.status === 'present' && summary.incidence.status === 'present') {
      const expectedText = canonicalFreeText(expected.semanticMeaning);
      checks.add(
        'incidence',
        'incidence_semantic_meaning',
        'brief.incidence.decision.value.semanticMeaning',
        summary.incidence.findings.some(
          (finding) => canonicalFreeText(finding.semanticMeaning) === expectedText,
        )
          ? 'pass'
          : 'unresolved',
      );
    }
    return;
  }
  const constraints = plan.decision.constraints;
  const domainValid = summary.incidence.status === 'none' || summary.incidence.status === 'present';
  const allowed = constraints?.allowedStatuses;
  checks.add(
    'incidence',
    'incidence_allowed_status',
    'brief.incidence.decision.constraints.allowedStatuses',
    domainValid && (allowed === undefined || allowed.includes(summary.incidence.status as 'none' | 'present'))
      ? 'pass'
      : 'fail',
  );
  if (constraints?.semanticFocus !== undefined) {
    const focus = canonicalFreeText(constraints.semanticFocus);
    checks.add(
      'incidence',
      'incidence_semantic_focus_requires_review',
      'brief.incidence.decision.constraints.semanticFocus',
      summary.incidence.status !== 'present'
        ? 'not_applicable'
        : summary.incidence.findings.some(
              (finding) => canonicalFreeText(finding.semanticMeaning) === focus,
            )
          ? 'pass'
          : 'unresolved',
    );
  }
}

function comparePrm(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  checks: CheckCollector,
): void {
  const plan = brief.prm;
  if (isForbidden(plan)) {
    checks.add('prm', 'prm_status', 'brief.prm', summary.prm.status === 'none' ? 'pass' : 'fail');
    return;
  }
  if (isAllowed(plan)) {
    checks.add('prm', 'prm_optional_content_requires_review', 'brief.prm', summary.prm.status === 'none' ? 'not_applicable' : 'unresolved');
    return;
  }
  if (plan.decision.mode === 'teacher_fixed') {
    const expected = plan.decision.value;
    const statusMatches = expected.status === summary.prm.status;
    checks.add('prm', 'prm_status', 'brief.prm.decision.value.status', statusMatches ? 'pass' : 'fail');
    if (expected.status !== 'present' || summary.prm.status !== 'present') return;
    checks.add(
      'prm',
      'prm_cardinality',
      'brief.prm.decision.value.quantity',
      cardinalityMatches(summary.prm.count, expected.quantity) ? 'pass' : 'fail',
    );
    const classified = expected.fixedFindings.filter(
      (finding) => finding.classification !== undefined,
    );
    if (classified.length > 0) {
      checks.add(
        'prm',
        'prm_fixed_classifications',
        'brief.prm.decision.value.fixedFindings',
        canInjectivelyMatch(
          classified,
          summary.prm.findings,
          (expectedFinding, actualFinding) =>
            sameTaxonomy(expectedFinding.classification, actualFinding.classification),
        )
          ? 'pass'
          : 'fail',
      );
    }
    if (expected.fixedFindings.some((finding) => finding.semanticIntent !== undefined)) {
      checks.add('prm', 'prm_semantic_intent_requires_review', 'brief.prm.decision.value.fixedFindings', 'unresolved');
    }
    const extras = Math.max(0, summary.prm.findings.length - expected.fixedFindings.length);
    checks.add(
      'prm',
      'prm_additional_findings',
      'brief.prm.decision.value.additionalFindings',
      expected.additionalFindings === 'forbidden'
        ? extras === 0 ? 'pass' : 'fail'
        : extras === 0 ? 'not_applicable' : 'unresolved',
    );
    return;
  }
  const constraints = plan.decision.constraints;
  const domainValid = summary.prm.status === 'none' || summary.prm.status === 'present';
  checks.add(
    'prm',
    'prm_status',
    'brief.prm.decision.constraints.allowedStatuses',
    domainValid &&
      (constraints?.allowedStatuses === undefined ||
        constraints.allowedStatuses.includes(summary.prm.status as 'none' | 'present'))
      ? 'pass'
      : 'fail',
  );
  if (constraints?.quantity !== undefined && summary.prm.status === 'present') {
    checks.add('prm', 'prm_cardinality', 'brief.prm.decision.constraints.quantity', cardinalityMatches(summary.prm.count, constraints.quantity) ? 'pass' : 'fail');
  }
  if (constraints?.allowedClassifications !== undefined && summary.prm.status === 'present') {
    checks.add(
      'prm',
      'prm_allowed_classifications',
      'brief.prm.decision.constraints.allowedClassifications',
      summary.prm.findings.every((finding) =>
        constraints.allowedClassifications!.some((allowed) => sameTaxonomy(allowed, finding.classification)),
      ) ? 'pass' : 'fail',
    );
  }
  if (constraints?.semanticFocus !== undefined) {
    checks.add(
      'prm',
      'prm_semantic_focus_requires_review',
      'brief.prm.decision.constraints.semanticFocus',
      summary.prm.status === 'present' ? 'unresolved' : 'not_applicable',
    );
  }
}

function rnmOutcomes(summary: TeachingCaseSummaryV2): string[] {
  return summary.rnm.status === 'no_rnm'
    ? ['no_rnm']
    : sortedUnique(summary.rnm.findings.map((finding) => finding.outcome));
}

function compareRnm(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  checks: CheckCollector,
): void {
  const plan = brief.rnm;
  if (isForbidden(plan)) {
    checks.add('rnm', 'rnm_status', 'brief.rnm', summary.rnm.status === 'no_rnm' ? 'pass' : 'fail');
    return;
  }
  if (isAllowed(plan)) {
    checks.add('rnm', 'rnm_optional_content_requires_review', 'brief.rnm', summary.rnm.status === 'no_rnm' ? 'not_applicable' : 'unresolved');
    return;
  }
  if (plan.decision.mode === 'teacher_fixed') {
    const expected = plan.decision.value;
    if (expected.status === 'no_rnm') {
      checks.add('rnm', 'rnm_status', 'brief.rnm.decision.value.status', summary.rnm.status === 'no_rnm' ? 'pass' : 'fail');
      return;
    }
    const positive = summary.rnm.status !== 'no_rnm';
    checks.add('rnm', 'rnm_status', 'brief.rnm.decision.value.status', positive ? 'pass' : 'fail');
    if (!positive) return;
    checks.add('rnm', 'rnm_cardinality', 'brief.rnm.decision.value.quantity', cardinalityMatches(summary.rnm.findings.length, expected.quantity) ? 'pass' : 'fail');
    const structurallyFixed = expected.fixedFindings;
    checks.add(
      'rnm',
      'rnm_fixed_classifications',
      'brief.rnm.decision.value.fixedFindings',
      canInjectivelyMatch(
        structurallyFixed,
        summary.rnm.findings,
        (expectedFinding, actualFinding) =>
          expectedFinding.outcome === actualFinding.outcome &&
          (expectedFinding.classification === undefined ||
            sameTaxonomy(expectedFinding.classification, actualFinding.classification)),
      )
        ? 'pass'
        : 'fail',
    );
    if (expected.fixedFindings.some((finding) => finding.semanticIntent !== undefined)) {
      checks.add('rnm', 'rnm_semantic_intent_requires_review', 'brief.rnm.decision.value.fixedFindings', 'unresolved');
    }
    const extras = Math.max(0, summary.rnm.findings.length - expected.fixedFindings.length);
    checks.add(
      'rnm',
      'rnm_additional_findings',
      'brief.rnm.decision.value.additionalFindings',
      expected.additionalFindings === 'forbidden'
        ? extras === 0 ? 'pass' : 'fail'
        : extras === 0 ? 'not_applicable' : 'unresolved',
    );
    return;
  }
  const constraints = plan.decision.constraints;
  const outcomes = rnmOutcomes(summary);
  checks.add(
    'rnm',
    'rnm_allowed_outcomes',
    'brief.rnm.decision.constraints.allowedStatuses',
    constraints?.allowedStatuses === undefined ||
      outcomes.every((outcome) =>
        constraints.allowedStatuses!.includes(
          outcome as 'no_rnm' | 'rnm' | 'risk_of_rnm',
        ),
      )
      ? 'pass'
      : 'fail',
  );
  if (constraints?.quantity !== undefined && summary.rnm.status !== 'no_rnm') {
    checks.add('rnm', 'rnm_cardinality', 'brief.rnm.decision.constraints.quantity', cardinalityMatches(summary.rnm.findings.length, constraints.quantity) ? 'pass' : 'fail');
  }
  if (constraints?.allowedClassifications !== undefined) {
    const classified = summary.rnm.findings.filter(
      (finding): finding is RnmFindingSummary & { classification: TaxonomyTermRef } =>
        finding.classification !== undefined,
    );
    checks.add(
      'rnm',
      'rnm_allowed_classifications',
      'brief.rnm.decision.constraints.allowedClassifications',
      classified.length === 0
        ? 'not_applicable'
        : classified.every((finding) =>
              constraints.allowedClassifications!.some((allowed) =>
                sameTaxonomy(allowed, finding.classification),
              ),
            )
          ? 'pass'
          : 'fail',
    );
  }
}

function barrierPatternMatches(
  expected: AdherenceBarrierSetIntent['barriers'][number],
  actual: BarrierSummary,
): boolean {
  return expected.role === actual.role &&
    expected.category === actual.category &&
    (expected.classification === undefined ||
      sameTaxonomy(expected.classification, actual.classification));
}

function compareFixedBarriers(
  expected: AdherenceBarrierSetIntent,
  actual: Extract<
    AdherenceAssessmentSummary,
    { status: 'non_adherent' }
  >['nonAdherence']['barriers'],
  path: string,
  checks: CheckCollector,
): void {
  if (actual.status !== 'identified') {
    checks.add('adherence', 'adherence_barrier_state', path, 'fail');
    return;
  }
  checks.add('adherence', 'adherence_barrier_state', path, 'pass');
  const actualValues = [actual.primary, ...actual.secondary];
  const requiredMatch = canInjectivelyMatch(
    expected.barriers,
    actualValues,
    barrierPatternMatches,
  );
  checks.add(
    'adherence',
    'adherence_primary_barrier',
    `${path}.barriers`,
    requiredMatch ? 'pass' : 'fail',
  );
  checks.add(
    'adherence',
    'adherence_secondary_barriers',
    `${path}.barriers`,
    requiredMatch ? 'pass' : 'fail',
  );
  const extras = Math.max(0, actualValues.length - expected.barriers.length);
  checks.add(
    'adherence',
    'adherence_additional_barriers',
    `${path}.additionalBarriers`,
    expected.additionalBarriers === 'forbidden'
      ? extras === 0 ? 'pass' : 'fail'
      : extras === 0 ? 'not_applicable' : 'unresolved',
  );
  if (expected.barriers.some((barrier) => barrier.semanticIntent !== undefined)) {
    checks.add(
      'adherence',
      'adherence_barrier_semantics_require_review',
      `${path}.barriers`,
      'unresolved',
    );
  }
}

function compareNonAdherenceDetails(
  expected: NonAdherenceDetailsPlan,
  actual: Extract<AdherenceAssessmentSummary, { status: 'non_adherent' }>,
  path: string,
  checks: CheckCollector,
): void {
  const typePlan = expected.type;
  if (isAllowed(typePlan)) {
    checks.add('adherence', 'adherence_type_constraints', `${path}.type`, 'unresolved');
  } else if (typePlan.targeting === 'targeted') {
    if (typePlan.decision.mode === 'teacher_fixed') {
      const fixed = typePlan.decision.value;
      checks.add('adherence', 'adherence_type_status', `${path}.type.status`, fixed.status === actual.nonAdherence.type.status ? 'pass' : 'fail');
      if (fixed.status === 'determined' && actual.nonAdherence.type.status === 'determined') {
        checks.add('adherence', 'adherence_type_value', `${path}.type.type`, fixed.type === actual.nonAdherence.type.type ? 'pass' : 'fail');
      }
    } else {
      const constraints = typePlan.decision.constraints;
      const type = actual.nonAdherence.type;
      const statusAllowed = constraints?.allowedStatuses === undefined || constraints.allowedStatuses.includes(type.status);
      const typeAllowed = type.status !== 'determined' || constraints?.allowedTypes === undefined || constraints.allowedTypes.includes(type.type);
      checks.add('adherence', 'adherence_type_constraints', `${path}.type`, statusAllowed && typeAllowed ? 'pass' : 'fail');
    }
  }

  const profilePlan = expected.patientProfile;
  const profile = actual.nonAdherence.patientProfile;
  if (isForbidden(profilePlan)) {
    checks.add('adherence', 'adherence_profile', `${path}.patientProfile`, profile.status === 'absent' ? 'pass' : 'fail');
  } else if (isAllowed(profilePlan)) {
    checks.add('adherence', 'adherence_profile_requires_review', `${path}.patientProfile`, profile.status === 'absent' ? 'not_applicable' : 'unresolved');
  } else if (profilePlan.decision.mode === 'teacher_fixed') {
    const fixed = profilePlan.decision.value;
    const matches = fixed.status === profile.status &&
      (fixed.status !== 'determined' ||
        (profile.status === 'determined' && fixed.profile === profile.profile));
    checks.add('adherence', 'adherence_profile', `${path}.patientProfile`, matches ? 'pass' : 'fail');
  } else {
    const constraints = profilePlan.decision.constraints;
    if (profile.status === 'absent') {
      checks.add('adherence', 'adherence_profile', `${path}.patientProfile`, 'fail');
    } else {
      const statusAllowed = constraints?.allowedStatuses === undefined || constraints.allowedStatuses.includes(profile.status);
      const profileAllowed = profile.status !== 'determined' || constraints?.allowedProfiles === undefined || constraints.allowedProfiles.includes(profile.profile);
      checks.add('adherence', 'adherence_profile', `${path}.patientProfile`, statusAllowed && profileAllowed ? 'pass' : 'fail');
    }
  }

  const barrierPlan = expected.barriers;
  const barriers = actual.nonAdherence.barriers;
  if (isForbidden(barrierPlan)) {
    checks.add('adherence', 'adherence_barrier_state', `${path}.barriers`, barriers.status === 'not_determinable' ? 'pass' : 'fail');
  } else if (isAllowed(barrierPlan)) {
    checks.add('adherence', 'adherence_optional_content_requires_review', `${path}.barriers`, barriers.status === 'not_determinable' ? 'not_applicable' : 'unresolved');
  } else if (barrierPlan.decision.mode === 'teacher_fixed') {
    compareFixedBarriers(barrierPlan.decision.value, barriers, `${path}.barriers`, checks);
  } else if (barriers.status === 'identified') {
    const constraints = barrierPlan.decision.constraints;
    const allBarriers = [barriers.primary, ...barriers.secondary];
    const allowed = constraints?.allowedCategories === undefined || allBarriers.every((barrier) => constraints.allowedCategories!.includes(barrier.category));
    const primary = constraints?.requiredPrimaryCategory === undefined || barriers.primary.category === constraints.requiredPrimaryCategory;
    const maximum = constraints?.maximumSecondaryBarriers === undefined || barriers.secondary.length <= constraints.maximumSecondaryBarriers;
    checks.add('adherence', 'adherence_barrier_constraints', `${path}.barriers`, allowed && primary && maximum ? 'pass' : 'fail');
  }
}

function compareAdherence(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  inventory: MedicationInventory,
  checks: CheckCollector,
): void {
  const plan = brief.adherence;
  const actual = summary.adherence.assessments;
  if (isForbidden(plan)) {
    checks.add('adherence', 'adherence_assessments_presence', 'brief.adherence', actual.length === 0 ? 'pass' : 'fail');
    return;
  }
  if (isAllowed(plan)) {
    checks.add('adherence', 'adherence_optional_content_requires_review', 'brief.adherence', actual.length === 0 ? 'not_applicable' : 'unresolved');
    return;
  }
  if (plan.decision.mode === 'teacher_fixed') {
    const expected = plan.decision.value.assessments;
    const resolved = expected.map((assessment) => ({
      assessment,
      scope: resolveScopeIntent(assessment.medicationScope, inventory),
    }));
    const hasUnresolved = resolved.some((item) => item.scope.status === 'unresolved');
    const expectedKeys = resolved.flatMap((item) =>
      item.scope.status === 'resolved' ? [scopeKey(item.scope.medicationIds)] : [],
    );
    const actualByScope = new Map<string, AdherenceAssessmentSummary>();
    actual.forEach((assessment, index) => {
      const key = scopeKey(actualScopeIds(assessment.medicationScope, inventory, `summary.adherence.assessments[${index}].medicationScope`));
      if (actualByScope.has(key)) fail('summary.adherence.assessments', 'duplicate medication scope');
      actualByScope.set(key, assessment);
    });
    const scopeStatus: ComplianceCheckStatus =
      expected.length !== actual.length
        ? 'fail'
        : hasUnresolved
          ? 'unresolved'
          : sameStringSet(expectedKeys, [...actualByScope.keys()])
            ? 'pass'
            : 'fail';
    checks.add('adherence', 'adherence_fixed_scope_set', 'brief.adherence.decision.value.assessments', scopeStatus);
    resolved.forEach((item) => {
      if (item.scope.status === 'unresolved') {
        checks.add('adherence', 'adherence_scope_resolution', 'brief.adherence.decision.value.assessments', 'unresolved');
        return;
      }
      const key = scopeKey(item.scope.medicationIds);
      const matched = actualByScope.get(key);
      if (matched === undefined) return;
      const path = `brief.adherence.decision.value.assessments.scope[${key}]`;
      checks.add('adherence', 'adherence_status_by_scope', `${path}.status`, item.assessment.status === matched.status ? 'pass' : 'fail');
      if (
        item.assessment.status === 'non_adherent' &&
        matched.status === 'non_adherent'
      ) {
        compareNonAdherenceDetails(item.assessment.nonAdherence!, matched, `${path}.nonAdherence`, checks);
      }
    });
    return;
  }

  const constraints = plan.decision.constraints;
  checks.add('adherence', 'adherence_assessments_presence', 'brief.adherence', actual.length >= 1 ? 'pass' : 'fail');
  if (constraints?.maximumAssessments !== undefined) {
    checks.add('adherence', 'adherence_maximum_assessments', 'brief.adherence.decision.constraints.maximumAssessments', actual.length <= constraints.maximumAssessments ? 'pass' : 'fail');
  }
  if (constraints?.allowedStatuses !== undefined) {
    checks.add('adherence', 'adherence_status_by_scope', 'brief.adherence.decision.constraints.allowedStatuses', actual.every((assessment) => constraints.allowedStatuses!.includes(assessment.status)) ? 'pass' : 'fail');
  }
  if (constraints?.allowedMedicationScopes !== undefined) {
    let unresolved = false;
    let mismatch = false;
    actual.forEach((assessment, index) => {
      const actualIds = actualScopeIds(assessment.medicationScope, inventory, `summary.adherence.assessments[${index}].medicationScope`);
      const resolutions = constraints.allowedMedicationScopes!.map((scope) => resolveScopeIntent(scope, inventory));
      const hasMatch = resolutions.some((resolution) => resolution.status === 'resolved' && sameStringSet(resolution.medicationIds, actualIds));
      if (!hasMatch && resolutions.some((resolution) => resolution.status === 'unresolved')) unresolved = true;
      else if (!hasMatch) mismatch = true;
    });
    checks.add('adherence', 'adherence_allowed_scopes', 'brief.adherence.decision.constraints.allowedMedicationScopes', mismatch ? 'fail' : unresolved ? 'unresolved' : 'pass');
  }
  if (constraints?.whenNonAdherent !== undefined) {
    actual.forEach((assessment, index) => {
      if (assessment.status === 'non_adherent') {
        const key = scopeKey(
          actualScopeIds(
            assessment.medicationScope,
            inventory,
            `summary.adherence.assessments[${index}].medicationScope`,
          ),
        );
        compareNonAdherenceDetails(
          constraints.whenNonAdherent!,
          assessment,
          `brief.adherence.decision.constraints.whenNonAdherent.scope[${key}]`,
          checks,
        );
      }
    });
  }
}

type ExpandedStrategy = {
  intent: AdherenceStrategyIntent;
  scopeIds: readonly MedicationId[];
  assessment: Extract<AdherenceAssessmentSummary, { status: 'non_adherent' }>;
};

function barrierSummaryKey(value: BarrierSummary): string {
  return `${value.role}\u0000${value.category}\u0000${value.classification === undefined ? '' : taxonomyKey(value.classification)}`;
}

function strategyMatches(
  expected: ExpandedStrategy,
  actual: AdherenceStrategySummary,
  inventory: MedicationInventory,
): boolean {
  if (!scopeMatches(expected.scopeIds, actual.medicationScope, inventory, 'summary.adherence.strategies.medicationScope')) return false;
  if (expected.intent.category !== actual.category) return false;
  if (
    expected.intent.category === 'combined' &&
    actual.category === 'combined' &&
    !sameStringSet(expected.intent.componentCategories, actual.componentCategories)
  ) return false;
  if (typeof expected.intent.addresses !== 'string') return true;
  const barriers = expected.assessment.nonAdherence.barriers;
  if (barriers.status !== 'identified') return false;
  const expectedBarriers = expected.intent.addresses === 'primary_barrier'
    ? [barriers.primary]
    : [barriers.primary, ...barriers.secondary];
  return sameStringMultiset(
    expectedBarriers.map(barrierSummaryKey),
    actual.addressedBarriers.map(barrierSummaryKey),
  );
}

function compareStrategies(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  inventory: MedicationInventory,
  checks: CheckCollector,
): void {
  const plan = brief.adherenceStrategies;
  const actual = summary.adherence.strategies;
  if (isForbidden(plan)) {
    checks.add('adherenceStrategies', 'strategies_presence', 'brief.adherenceStrategies', actual.length === 0 ? 'pass' : 'fail');
    return;
  }
  if (isAllowed(plan)) {
    checks.add('adherenceStrategies', 'strategies_optional_content_requires_review', 'brief.adherenceStrategies', actual.length === 0 ? 'not_applicable' : 'unresolved');
    return;
  }
  if (plan.decision.mode === 'ai_proposes') {
    const constraints = plan.decision.constraints;
    checks.add('adherenceStrategies', 'strategies_presence', 'brief.adherenceStrategies', actual.length >= 1 ? 'pass' : 'fail');
    if (constraints?.maximumStrategies !== undefined) {
      checks.add('adherenceStrategies', 'strategies_maximum', 'brief.adherenceStrategies.decision.constraints.maximumStrategies', actual.length <= constraints.maximumStrategies ? 'pass' : 'fail');
    }
    if (constraints?.allowedCategories !== undefined) {
      checks.add('adherenceStrategies', 'strategies_allowed_categories', 'brief.adherenceStrategies.decision.constraints.allowedCategories', actual.every((strategy) => constraints.allowedCategories!.includes(strategy.category)) ? 'pass' : 'fail');
    }
    return;
  }

  const nonAdherent = summary.adherence.assessments.filter(
    (assessment): assessment is Extract<AdherenceAssessmentSummary, { status: 'non_adherent' }> =>
      assessment.status === 'non_adherent',
  );
  const expanded: ExpandedStrategy[] = [];
  let expectedCount = 0;
  let unresolvedScope = false;
  let missingNonAdherentScope = false;
  let hasSemanticProblems = false;
  plan.decision.value.forEach((intent) => {
    if (typeof intent.addresses !== 'string') hasSemanticProblems = true;
    if (intent.appliesTo === 'all_non_adherent_scopes') {
      expectedCount += nonAdherent.length;
      if (nonAdherent.length === 0) missingNonAdherentScope = true;
      nonAdherent.forEach((assessment, index) =>
        expanded.push({
          intent,
          scopeIds: actualScopeIds(assessment.medicationScope, inventory, `summary.adherence.assessments[${index}].medicationScope`),
          assessment,
        }),
      );
      return;
    }
    expectedCount += 1;
    const resolution = resolveScopeIntent(intent.appliesTo.medicationScope, inventory);
    if (resolution.status === 'unresolved') {
      unresolvedScope = true;
      return;
    }
    const assessment = nonAdherent.find((candidate, index) =>
      scopeMatches(resolution.medicationIds, candidate.medicationScope, inventory, `summary.adherence.assessments[${index}].medicationScope`),
    );
    if (assessment === undefined) {
      missingNonAdherentScope = true;
      return;
    }
    expanded.push({ intent, scopeIds: resolution.medicationIds, assessment });
  });
  if (unresolvedScope) {
    checks.add('adherenceStrategies', 'strategy_scope_resolution', 'brief.adherenceStrategies.decision.value', 'unresolved');
  }
  if (missingNonAdherentScope) {
    checks.add('adherenceStrategies', 'strategy_all_non_adherent_scopes', 'brief.adherenceStrategies.decision.value', 'fail');
  }
  const exactStatus: ComplianceCheckStatus =
    expectedCount !== actual.length
      ? 'fail'
      : unresolvedScope
        ? 'unresolved'
        : perfectMatch(expanded, actual, (expected, candidate) => strategyMatches(expected, candidate, inventory))
          ? 'pass'
          : 'fail';
  checks.add('adherenceStrategies', 'strategies_exact_multiset', 'brief.adherenceStrategies.decision.value', exactStatus);
  if (hasSemanticProblems) {
    checks.add('adherenceStrategies', 'strategy_semantic_problems_require_review', 'brief.adherenceStrategies.decision.value.addresses', 'unresolved');
  }
}

function actionMatches(
  expected: ProfessionalActionIntent,
  actual: ProfessionalActionSummary,
): boolean {
  if (expected.spfa !== actual.spfa.service || expected.category !== actual.category) return false;
  if (expected.classification !== undefined && !sameTaxonomy(expected.classification, actual.classification)) return false;
  if (expected.category === 'other_spfa') {
    if (actual.targetSpfa?.service !== expected.targetSpfa) return false;
  }
  return expected.category !== 'referral' || actual.referralInvolvement;
}

function compareActions(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  checks: CheckCollector,
): void {
  const plan = brief.professionalActions;
  const actual = summary.professionalActions;
  if (isForbidden(plan)) {
    checks.add('professionalActions', 'actions_presence', 'brief.professionalActions', actual.length === 0 ? 'pass' : 'fail');
    return;
  }
  if (isAllowed(plan)) {
    checks.add('professionalActions', 'actions_optional_content_requires_review', 'brief.professionalActions', actual.length === 0 ? 'not_applicable' : 'unresolved');
    return;
  }
  if (plan.decision.mode === 'teacher_fixed') {
    checks.add('professionalActions', 'actions_exact_multiset', 'brief.professionalActions.decision.value', perfectMatch(plan.decision.value, actual, actionMatches) ? 'pass' : 'fail');
    return;
  }
  const constraints = plan.decision.constraints;
  checks.add('professionalActions', 'actions_presence', 'brief.professionalActions', actual.length >= 1 ? 'pass' : 'fail');
  if (constraints?.maximumActions !== undefined) {
    checks.add('professionalActions', 'actions_maximum', 'brief.professionalActions.decision.constraints.maximumActions', actual.length <= constraints.maximumActions ? 'pass' : 'fail');
  }
  if (constraints?.allowedCategories !== undefined) {
    checks.add('professionalActions', 'actions_allowed_categories', 'brief.professionalActions.decision.constraints.allowedCategories', actual.every((action) => constraints.allowedCategories!.includes(action.category)) ? 'pass' : 'fail');
  }
}

function interventionMatches(
  expected: PharmaceuticalInterventionIntent,
  actual: PharmaceuticalInterventionSummary,
): boolean {
  return expected.spfa === actual.spfa.service &&
    expected.target === actual.target &&
    (expected.classification === undefined || sameTaxonomy(expected.classification, actual.classification)) &&
    (expected.relatedActionCategory === undefined || expected.relatedActionCategory === actual.relatedProfessionalActionCategory);
}

function compareInterventions(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  checks: CheckCollector,
): void {
  const plan = brief.pharmaceuticalInterventions;
  const actual = summary.pharmaceuticalInterventions;
  if (isForbidden(plan)) {
    checks.add('pharmaceuticalInterventions', 'interventions_presence', 'brief.pharmaceuticalInterventions', actual.length === 0 ? 'pass' : 'fail');
    return;
  }
  if (isAllowed(plan)) {
    checks.add('pharmaceuticalInterventions', 'interventions_optional_content_requires_review', 'brief.pharmaceuticalInterventions', actual.length === 0 ? 'not_applicable' : 'unresolved');
    return;
  }
  if (plan.decision.mode === 'teacher_fixed') {
    checks.add('pharmaceuticalInterventions', 'interventions_exact_multiset', 'brief.pharmaceuticalInterventions.decision.value', perfectMatch(plan.decision.value, actual, interventionMatches) ? 'pass' : 'fail');
    checks.add('pharmaceuticalInterventions', 'intervention_addressed_problems_require_review', 'brief.pharmaceuticalInterventions.decision.value.addressedProblems', 'unresolved');
    return;
  }
  const constraints = plan.decision.constraints;
  checks.add('pharmaceuticalInterventions', 'interventions_presence', 'brief.pharmaceuticalInterventions', actual.length >= 1 ? 'pass' : 'fail');
  if (constraints?.maximumInterventions !== undefined) {
    checks.add('pharmaceuticalInterventions', 'interventions_maximum', 'brief.pharmaceuticalInterventions.decision.constraints.maximumInterventions', actual.length <= constraints.maximumInterventions ? 'pass' : 'fail');
  }
  if (constraints?.allowedTargets !== undefined) {
    checks.add('pharmaceuticalInterventions', 'interventions_allowed_targets', 'brief.pharmaceuticalInterventions.decision.constraints.allowedTargets', actual.every((intervention) => constraints.allowedTargets!.includes(intervention.target)) ? 'pass' : 'fail');
  }
}

function compareReferral(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
  checks: CheckCollector,
): void {
  const plan = brief.referral;
  const actual = summary.referral;
  if (isForbidden(plan)) {
    checks.add('referral', 'referral_status', 'brief.referral', actual.status === 'not_required' ? 'pass' : 'fail');
    return;
  }
  if (isAllowed(plan)) {
    checks.add('referral', 'referral_optional_content_requires_review', 'brief.referral', actual.status === 'not_required' ? 'not_applicable' : 'unresolved');
    return;
  }
  if (plan.decision.mode === 'teacher_fixed') {
    const expected = plan.decision.value;
    checks.add('referral', 'referral_status', 'brief.referral.decision.value.status', expected.status === actual.status ? 'pass' : 'fail');
    if (expected.status !== 'required' || actual.status !== 'required') return;
    checks.add('referral', 'referral_urgency', 'brief.referral.decision.value.urgency', expected.urgency === actual.urgency ? 'pass' : 'fail');
    if (expected.destination.classification !== undefined) {
      checks.add('referral', 'referral_destination_classification', 'brief.referral.decision.value.destination.classification', sameTaxonomy(expected.destination.classification, actual.destination.classification) ? 'pass' : 'fail');
    }
    checks.add('referral', 'referral_destination_label', 'brief.referral.decision.value.destination.label', canonicalFreeText(expected.destination.label) === canonicalFreeText(actual.destination.label) ? 'pass' : 'unresolved');
    checks.add('referral', 'referral_reason', 'brief.referral.decision.value.reason', canonicalFreeText(expected.reason) === canonicalFreeText(actual.reason) ? 'pass' : 'unresolved');
    checks.add('referral', 'referral_report_status', 'brief.referral.decision.value.report.status', expected.report.status === actual.report.status ? 'pass' : 'fail');
    const actualContents = new Set(actual.report.essentialContents.map(canonicalFreeText));
    checks.add('referral', 'referral_report_contents', 'brief.referral.decision.value.report.essentialContents', expected.report.essentialContents.every((content) => actualContents.has(canonicalFreeText(content))) ? 'pass' : 'unresolved');
    return;
  }
  const constraints = plan.decision.constraints;
  checks.add(
    'referral',
    'referral_allowed_status',
    'brief.referral.decision.constraints.allowedStatuses',
    constraints?.allowedStatuses === undefined ||
      constraints.allowedStatuses.includes(actual.status)
      ? 'pass'
      : 'fail',
  );
  if (actual.status !== 'required') return;
  if (constraints?.allowedUrgencies !== undefined) {
    checks.add('referral', 'referral_allowed_urgency', 'brief.referral.decision.constraints.allowedUrgencies', constraints.allowedUrgencies.includes(actual.urgency) ? 'pass' : 'fail');
  }
  if (constraints?.allowedDestinations !== undefined) {
    const classificationMatch = actual.destination.classification !== undefined && constraints.allowedDestinations.some((destination) => destination.classification !== undefined && sameTaxonomy(destination.classification, actual.destination.classification));
    const labelOnly = constraints.allowedDestinations.filter((destination) => destination.classification === undefined);
    const labelMatch = labelOnly.some((destination) => canonicalFreeText(destination.label) === canonicalFreeText(actual.destination.label));
    const status: ComplianceCheckStatus = classificationMatch || labelMatch
      ? 'pass'
      : labelOnly.length === 0
        ? 'fail'
        : 'unresolved';
    checks.add('referral', 'referral_allowed_destination', 'brief.referral.decision.constraints.allowedDestinations', status);
  }
}

export function buildBriefComplianceReportV2(
  brief: TeachingCaseGenerationBriefV2,
  summary: TeachingCaseSummaryV2,
): BriefComplianceReportV2 {
  const inventory = buildMedicationInventory(summary);
  assertSummaryStructure(brief, summary, inventory);
  const checks = new CheckCollector();

  compareCarePath(brief, summary, checks);
  compareIncidence(brief, summary, checks);
  comparePrm(brief, summary, checks);
  compareRnm(brief, summary, checks);
  compareAdherence(brief, summary, inventory, checks);
  compareStrategies(brief, summary, inventory, checks);
  compareActions(brief, summary, checks);
  compareInterventions(brief, summary, checks);
  compareReferral(brief, summary, checks);
  checks.add('complexity', 'complexity_requires_review', 'brief.complexity', 'unresolved');
  checks.add(
    'teacherInstruction',
    brief.teacherInstruction === undefined
      ? 'teacher_instruction_absent'
      : 'teacher_instruction_requires_review',
    'brief.teacherInstruction',
    brief.teacherInstruction === undefined ? 'not_applicable' : 'unresolved',
  );

  const result = checks.finish();
  return {
    schemaVersion: '2.0',
    caseVersionId: summary.caseVersionId,
    briefId: brief.briefId,
    briefRevision: brief.revision.number,
    generationMode: brief.generationMode,
    overallStatus: result.overallStatus,
    hasHardFailures: result.counts.failed > 0,
    requiresReview: result.counts.unresolved > 0,
    counts: result.counts,
    dimensions: result.dimensions,
  };
}
