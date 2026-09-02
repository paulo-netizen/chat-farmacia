import { z } from 'zod';
import { buildPharmaceuticalAdjudicationContextSetV2, type BuildPharmaceuticalAdjudicationContextInputV2 } from './build-pharmaceutical-adjudication-context';
import { validatePharmaceuticalEvaluationExpectationSetV2 } from './validate-pharmaceutical-evaluation-expectations';
import {
  checkScoringFingerprint, freezeScoring, parseScoring, scoringCanonicalJson, scoringEqual,
  scoringFail, scoringFingerprint, scoringOrdinal, scoringUnique, sealScoring,
} from './pharmaceutical-scoring-contract-utils';
import {
  pharmaceuticalScoringPlanCoreSchema, pharmaceuticalScoringPlanSchema,
  pharmaceuticalScoringUnitDraftSchema, type PharmaceuticalScoringPlanV2,
} from './pharmaceutical-scoring-types';

const CANONICALIZATION = 'pharmaceutical-scoring-plan-v2/1';
const draftSchema = pharmaceuticalScoringPlanCoreSchema.extend({ units: z.array(pharmaceuticalScoringUnitDraftSchema) });
export type PharmaceuticalScoringPlanSourceV2 = BuildPharmaceuticalAdjudicationContextInputV2;

/** No credentials or raw errors escape this reconstruction boundary. */
export function reconstructPharmaceuticalScoringContext(source: PharmaceuticalScoringPlanSourceV2) {
  try { return buildPharmaceuticalAdjudicationContextSetV2(source); }
  catch { return scoringFail('UNVALIDATED_SOURCE', 'contextSource'); }
}
export function pharmaceuticalScoringExpectationBinding(source: PharmaceuticalScoringPlanSourceV2) {
  const set = validatePharmaceuticalEvaluationExpectationSetV2(source.expectationSet, source.targetSet);
  const groups = set.groups.map((group) => ({ operator: group.operator, memberTargetRefs: [...group.memberTargetRefs].sort() }))
    .sort((a, b) => scoringOrdinal(scoringCanonicalJson(a), scoringCanonicalJson(b)));
  return { contractVersion: set.contractVersion,
    fingerprint: scoringFingerprint('pharmaceutical-scoring-expectation-binding-v2/1', { ...set, groups }) };
}
export function pharmaceuticalScoringUnitIdV2(
  caseVersionId: string, planId: string, unit: z.infer<typeof pharmaceuticalScoringUnitDraftSchema>,
): string {
  return `pharm_scoring_unit_${scoringFingerprint('pharmaceutical-scoring-unit-v2/1', {
    caseVersionId, planId, domain: unit.domain, operator: unit.operator,
    memberTargetRefs: [...unit.memberTargetRefs].sort(),
    sourceExpectationGroupRefs: [...unit.sourceExpectationGroupRefs].sort(),
  }).value}`;
}

function canonicalPlan(value: unknown, source: PharmaceuticalScoringPlanSourceV2) {
  const core = parseScoring(pharmaceuticalScoringPlanCoreSchema, value, 'plan', 'INVALID_SCORING_PLAN');
  const context = reconstructPharmaceuticalScoringContext(source);
  scoringEqual(core.caseVersionId, context.caseVersionId, 'plan.caseVersionId');
  scoringEqual(core.targetSet, { contractVersion: source.targetSet.contractVersion, fingerprint: context.targetSetFingerprint }, 'plan.targetSet');
  scoringEqual(core.expectationSet, pharmaceuticalScoringExpectationBinding(source), 'plan.expectationSet');
  scoringUnique(core.units.map((unit) => unit.scoringUnitId), 'plan.units', 'INVALID_SCORING_PLAN');
  const targets = new Map(context.targets.map((target) => [String(target.targetRef), target]));
  const groups = new Map(context.targets.flatMap((target) => target.expectationMemberships.map((group) => [String(group.groupRef), group] as const)));
  const assigned = new Set<string>(), usedGroups = new Set<string>();
  const units = core.units.map((unit) => {
    scoringUnique(unit.memberTargetRefs, 'plan.memberTargetRefs', 'INVALID_SCORING_PLAN');
    scoringUnique(unit.sourceExpectationGroupRefs, 'plan.sourceExpectationGroupRefs', 'INVALID_SCORING_PLAN');
    const members = [...unit.memberTargetRefs].sort(), refs = [...unit.sourceExpectationGroupRefs].sort();
    if (unit.operator === 'SINGLE' && members.length !== 1) scoringFail('INVALID_SCORING_PLAN', 'plan.single');
    for (const ref of members) {
      const target = targets.get(ref);
      if (!target) scoringFail('INVALID_TARGET_COVERAGE', 'plan.extraTarget');
      if (assigned.has(ref)) scoringFail('INVALID_SCORING_PLAN', 'plan.overlap');
      if (unit.domain !== target.clinicalContext.domain) scoringFail('INVALID_SCORING_PLAN', 'plan.domain');
      assigned.add(ref);
      // No splitting, bypassing or silently discarding an upstream ALL_OF/ONE_OF.
      for (const group of target.expectationMemberships) {
        if (!refs.includes(group.groupRef)) scoringFail('INVALID_SCORING_PLAN', 'plan.unrepresentedGroup');
      }
    }
    if ((unit.operator === 'SINGLE' && refs.length !== 0) || (unit.operator !== 'SINGLE' && refs.length !== 1)) {
      scoringFail('INVALID_SCORING_PLAN', 'plan.operatorGroupBinding');
    }
    for (const ref of refs) {
      const group = groups.get(ref);
      if (!group || usedGroups.has(ref)) scoringFail('INVALID_SCORING_PLAN', 'plan.group');
      scoringEqual(unit.operator, group.operator, 'plan.groupOperator', 'INVALID_SCORING_PLAN');
      scoringEqual(members, [...group.memberTargetRefs].sort(), 'plan.groupMembers', 'INVALID_SCORING_PLAN');
      usedGroups.add(ref);
    }
    const canonical = { ...unit, memberTargetRefs: members, sourceExpectationGroupRefs: refs };
    const id = pharmaceuticalScoringUnitIdV2(core.caseVersionId, core.ref.id, canonical);
    scoringEqual(unit.scoringUnitId, id, 'plan.scoringUnitId', 'INVALID_SCORING_PLAN');
    scoringEqual(unit.weightBinding, { weightsRef: core.weightsRef, scoringUnitId: id }, 'plan.weightBinding');
    return canonical;
  }).sort((a, b) => scoringOrdinal(a.scoringUnitId, b.scoringUnitId));
  if (assigned.size !== targets.size) scoringFail('INVALID_TARGET_COVERAGE', 'plan.missingTarget');
  if (usedGroups.size !== groups.size) scoringFail('INVALID_SCORING_PLAN', 'plan.missingGroup');
  return { ...core, units };
}

export function buildPharmaceuticalScoringPlanV2(value: unknown, source: PharmaceuticalScoringPlanSourceV2): PharmaceuticalScoringPlanV2 {
  const draft = parseScoring(draftSchema, value, 'planDraft', 'INVALID_SCORING_PLAN');
  const units = draft.units.map((unit) => {
    const scoringUnitId = pharmaceuticalScoringUnitIdV2(draft.caseVersionId, draft.ref.id, unit);
    return { ...unit, scoringUnitId, weightBinding: { weightsRef: draft.weightsRef, scoringUnitId } };
  });
  return freezeScoring(sealScoring(canonicalPlan({ ...draft, units }, source), CANONICALIZATION));
}
export function validatePharmaceuticalScoringPlanV2(value: unknown, source: PharmaceuticalScoringPlanSourceV2): PharmaceuticalScoringPlanV2 {
  const parsed = parseScoring(pharmaceuticalScoringPlanSchema, value, 'plan', 'INVALID_SCORING_PLAN');
  const { fingerprint: _fingerprint, ...body } = parsed;
  const core = canonicalPlan(body, source);
  checkScoringFingerprint(parsed, core, CANONICALIZATION, 'plan.fingerprint');
  return freezeScoring(sealScoring(core, CANONICALIZATION));
}
