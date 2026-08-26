import type { VersionRef } from './evaluator-types';
import type {
  AppliedSpfaRequirementV2,
  CaseSpfaProtocolApplicationV2,
  SpfaRequirementTargetId,
} from './spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2 } from './spfa-protocol-set-types';
import type {
  SpfaScoringContextV2,
  SpfaScoringRequirementContextV2,
  SpfaScoringRequirementResultStatusV2,
} from './spfa-scoring-context-types';
import type {
  SpfaProtocolDefinitionV2,
  SpfaProtocolRequirementDefinitionV2,
} from './spfa-protocol-types';
import type {
  SpfaRequirementSessionResultV2,
} from './spfa-session-evidence-types';
import type {
  SpfaSessionEvaluationApplicationV2,
  SpfaSessionEvaluationV2,
} from './spfa-session-evaluation-types';
import { validateSpfaScoringContextV2 } from './validate-spfa-scoring-context';

export class SpfaScoringContextBuildError extends Error {
  constructor(
    public readonly path: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`${path}: ${message}`);
    this.name = 'SpfaScoringContextBuildError';
  }
}

function fail(path: string, message: string, cause?: unknown): never {
  throw new SpfaScoringContextBuildError(path, message, cause);
}

function protocolRefKey(ref: Readonly<{ protocolId: string; version: string }>): string {
  return `${ref.protocolId}\u0000${ref.version}`;
}

function sameProtocolRef(
  left: Readonly<{ protocolId: string; version: string }>,
  right: Readonly<{ protocolId: string; version: string }>,
): boolean {
  return left.protocolId === right.protocolId && left.version === right.version;
}

function sameVersionRef(left: Readonly<VersionRef>, right: Readonly<VersionRef>): boolean {
  return left.id === right.id && left.version === right.version;
}

function sameFingerprint(
  left: Readonly<{ algorithm: string; canonicalization: string; value: string }>,
  right: Readonly<{ algorithm: string; canonicalization: string; value: string }>,
): boolean {
  return left.algorithm === right.algorithm &&
    left.canonicalization === right.canonicalization &&
    left.value === right.value;
}

function targetRefsFor(requirement: AppliedSpfaRequirementV2): readonly SpfaRequirementTargetId[] {
  return requirement.kind === 'INFORMATION_REQUIREMENT'
    ? requirement.informationTargets.map((target) => target.targetId)
    : requirement.actionTargets.map((target) => target.targetId);
}

function setsEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

type ResultPartition = Readonly<{
  status: SpfaScoringRequirementResultStatusV2;
  positive: readonly SpfaRequirementTargetId[];
  remaining: readonly SpfaRequirementTargetId[];
  uncertain: readonly SpfaRequirementTargetId[];
}>;

function partitionResult(
  result: SpfaRequirementSessionResultV2,
  requirement: AppliedSpfaRequirementV2,
  path: string,
): ResultPartition {
  if (result.kind !== requirement.kind) {
    fail(`${path}.kind`, 'does not match the applied requirement kind');
  }
  const canonicalTargets = targetRefsFor(requirement);
  const resultValue = result.kind === 'INFORMATION_REQUIREMENT'
    ? result.coverage
    : result.outcome;
  const status = resultValue.status;
  let rawPositive: readonly SpfaRequirementTargetId[] = [];
  let rawRemaining: readonly SpfaRequirementTargetId[] = [];
  let rawUncertain: readonly SpfaRequirementTargetId[] = [];

  if (result.kind === 'INFORMATION_REQUIREMENT') {
    if (status === 'COVERED') rawPositive = resultValue.coveredTargetRefs;
    if (status === 'PARTIALLY_COVERED') {
      rawPositive = resultValue.coveredTargetRefs;
      rawRemaining = resultValue.remainingTargetRefs;
      rawUncertain = resultValue.uncertainTargetRefs;
    }
    if (status === 'NOT_COVERED') {
      rawRemaining = resultValue.remainingTargetRefs;
      rawUncertain = resultValue.uncertainTargetRefs;
    }
  } else {
    if (status === 'PERFORMED') rawPositive = resultValue.performedTargetRefs;
    if (status === 'PARTIALLY_PERFORMED') {
      rawPositive = resultValue.performedTargetRefs;
      rawRemaining = resultValue.remainingTargetRefs;
      rawUncertain = resultValue.uncertainTargetRefs;
    }
    if (status === 'NOT_PERFORMED') {
      rawRemaining = resultValue.remainingTargetRefs;
      rawUncertain = resultValue.uncertainTargetRefs;
    }
  }

  if (status === 'NOT_APPLICABLE') {
    if (requirement.applicability.status !== 'NOT_APPLICABLE' || canonicalTargets.length !== 0) {
      fail(`${path}.${result.kind === 'INFORMATION_REQUIREMENT' ? 'coverage' : 'outcome'}.status`, 'does not match requirement applicability');
    }
    return { status, positive: [], remaining: [], uncertain: [] };
  }
  if (requirement.applicability.status !== 'APPLICABLE') {
    fail(`${path}.${result.kind === 'INFORMATION_REQUIREMENT' ? 'coverage' : 'outcome'}.status`, 'must be NOT_APPLICABLE');
  }
  const combined = [...rawPositive, ...rawRemaining];
  if (!setsEqual(combined, canonicalTargets) || new Set(combined).size !== combined.length) {
    fail(path, 'result targets do not form the applied requirement partition');
  }
  const remainingSet = new Set(rawRemaining);
  if (new Set(rawUncertain).size !== rawUncertain.length || rawUncertain.some((target) => !remainingSet.has(target))) {
    fail(path, 'uncertain targets must be a unique subset of remaining targets');
  }
  const positiveSet = new Set(rawPositive);
  const uncertainSet = new Set(rawUncertain);
  return {
    status,
    positive: canonicalTargets.filter((target) => positiveSet.has(target)),
    remaining: canonicalTargets.filter((target) => remainingSet.has(target)),
    uncertain: canonicalTargets.filter((target) => uncertainSet.has(target)),
  };
}

function definitionIndex(
  protocolSet: CaseSpfaProtocolSetV2,
): ReadonlyMap<string, SpfaProtocolDefinitionV2> {
  const result = new Map<string, SpfaProtocolDefinitionV2>();
  protocolSet.definitions.forEach((definition, index) => {
    const key = protocolRefKey({ protocolId: definition.protocolId, version: definition.version });
    if (result.has(key)) fail(`spfaProtocolSet.definitions[${index}]`, 'duplicate protocol definition');
    result.set(key, definition);
  });
  return result;
}

function findDefinitionRequirement(
  definition: SpfaProtocolDefinitionV2,
  requirement: AppliedSpfaRequirementV2,
  requirementIndex: number,
  path: string,
): SpfaProtocolRequirementDefinitionV2 {
  const seen = new Set<string>();
  definition.requirements.forEach((item, index) => {
    if (seen.has(item.requirementId)) fail(`${path}.requirements[${index}].requirementId`, 'duplicate protocol requirement');
    seen.add(item.requirementId);
  });
  const expected = definition.requirements[requirementIndex];
  if (expected === undefined || expected.requirementId !== requirement.requirementRef) {
    fail(`${path}.requirements[${requirementIndex}]`, 'does not follow protocol definition requirement order');
  }
  if (expected.kind !== requirement.kind) {
    fail(`${path}.requirements[${requirementIndex}].kind`, 'does not match applied requirement kind');
  }
  return expected;
}

function buildRequirement(
  application: CaseSpfaProtocolApplicationV2,
  evaluationApplication: SpfaSessionEvaluationApplicationV2,
  requirement: AppliedSpfaRequirementV2,
  result: SpfaRequirementSessionResultV2,
  definitionRequirement: SpfaProtocolRequirementDefinitionV2,
  path: string,
  evaluation: SpfaSessionEvaluationV2,
): SpfaScoringRequirementContextV2 {
  if (result.sessionId !== evaluation.sessionId) fail(`${path}.sessionId`, 'does not match session evaluation');
  if (result.caseVersionId !== evaluation.caseVersionId) fail(`${path}.caseVersionId`, 'does not match session evaluation');
  if (!sameFingerprint(result.transcriptFingerprint, evaluation.transcriptFingerprint)) fail(`${path}.transcriptFingerprint`, 'does not match session evaluation');
  if (result.carePathSpfaRef !== application.carePathSpfaRef) fail(`${path}.carePathSpfaRef`, 'does not match application');
  if (result.requirementRef !== requirement.requirementRef) fail(`${path}.requirementRef`, 'does not match applied requirement');
  if (!sameProtocolRef(evaluationApplication.protocolRef, application.protocolRef)) fail(`${path}.protocolRef`, 'does not match application');
  const targetRefs = targetRefsFor(requirement);
  const partition = partitionResult(result, requirement, path);
  const common = {
    carePathSpfaRef: application.carePathSpfaRef,
    protocolRef: { ...application.protocolRef },
    requirementRef: requirement.requirementRef,
    requirementKind: requirement.kind,
    safetyCriticality: { ...definitionRequirement.safetyCriticality },
    targetRefs: [...targetRefs],
    resultStatus: partition.status,
    positiveTargetRefs: [...partition.positive],
    remainingTargetRefs: [...partition.remaining],
    uncertainTargetRefs: [...partition.uncertain],
    totalTargetCount: targetRefs.length,
    positiveTargetCount: partition.positive.length,
    remainingTargetCount: partition.remaining.length,
    uncertainTargetCount: partition.uncertain.length,
  };
  if (requirement.applicability.status === 'APPLICABLE') {
    return {
      ...common,
      applicability: { ...requirement.applicability },
      effectiveImportance: requirement.applicability.effectiveImportance,
    };
  }
  return {
    ...common,
    applicability: {
      status: 'NOT_APPLICABLE',
      reason: requirement.applicability.reason.kind === 'CASE_DETERMINED'
        ? { ...requirement.applicability.reason }
        : { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
    },
  };
}

export function buildSpfaScoringContextV2(
  evaluation: SpfaSessionEvaluationV2,
  protocolSet: CaseSpfaProtocolSetV2,
): SpfaScoringContextV2 {
  if (!sameVersionRef(evaluation.protocolCatalogRef, protocolSet.catalogRef)) {
    fail('spfaSessionEvaluation.protocolCatalogRef', 'does not match protocol set catalog');
  }
  if (evaluation.applications.length !== protocolSet.applications.length) {
    fail('spfaSessionEvaluation.applications', 'must contain exactly one entry per protocol-set application');
  }
  const definitions = definitionIndex(protocolSet);
  const seenApplications = new Set<string>();
  const requirements: SpfaScoringRequirementContextV2[] = [];

  protocolSet.applications.forEach((application, applicationIndex) => {
    const applicationPath = `spfaProtocolSet.applications[${applicationIndex}]`;
    if (application.caseVersionId !== evaluation.caseVersionId) fail(`${applicationPath}.caseVersionId`, 'does not match session evaluation');
    if (seenApplications.has(application.carePathSpfaRef)) fail(`${applicationPath}.carePathSpfaRef`, 'duplicate application');
    seenApplications.add(application.carePathSpfaRef);
    const evaluationApplication = evaluation.applications[applicationIndex];
    if (evaluationApplication === undefined || evaluationApplication.carePathSpfaRef !== application.carePathSpfaRef) {
      fail(`spfaSessionEvaluation.applications[${applicationIndex}].carePathSpfaRef`, 'does not follow protocol-set application order');
    }
    if (!sameProtocolRef(evaluationApplication.protocolRef, application.protocolRef)) {
      fail(`spfaSessionEvaluation.applications[${applicationIndex}].protocolRef`, 'does not match protocol-set application');
    }
    if (evaluationApplication.requirementResults.length !== application.requirements.length) {
      fail(`spfaSessionEvaluation.applications[${applicationIndex}].requirementResults`, 'must contain exactly one result per applied requirement');
    }
    const definition = definitions.get(protocolRefKey(application.protocolRef));
    if (definition === undefined) fail(`${applicationPath}.protocolRef`, 'does not reference an existing protocol definition');
    if (definition.requirements.length !== application.requirements.length) {
      fail(`${applicationPath}.requirements`, 'must contain every protocol definition requirement');
    }
    const seenRequirements = new Set<string>();
    application.requirements.forEach((requirement, requirementIndex) => {
      const requirementPath = `${applicationPath}.requirements[${requirementIndex}]`;
      if (seenRequirements.has(requirement.requirementRef)) fail(`${requirementPath}.requirementRef`, 'duplicate applied requirement');
      seenRequirements.add(requirement.requirementRef);
      const result = evaluationApplication.requirementResults[requirementIndex];
      if (result === undefined || result.requirementRef !== requirement.requirementRef) {
        fail(`spfaSessionEvaluation.applications[${applicationIndex}].requirementResults[${requirementIndex}].requirementRef`, 'does not follow protocol-set requirement order');
      }
      const definitionRequirement = findDefinitionRequirement(definition, requirement, requirementIndex, `spfaProtocolSet.definitions[${protocolSet.definitions.indexOf(definition)}]`);
      requirements.push(buildRequirement(application, evaluationApplication, requirement, result, definitionRequirement, `spfaSessionEvaluation.applications[${applicationIndex}].requirementResults[${requirementIndex}]`, evaluation));
    });
  });

  const candidate = {
    schemaVersion: '2.0',
    sessionId: evaluation.sessionId,
    caseVersionId: evaluation.caseVersionId,
    protocolCatalogRef: { ...evaluation.protocolCatalogRef },
    transcriptFingerprint: { ...evaluation.transcriptFingerprint },
    requirements,
  };
  try {
    return validateSpfaScoringContextV2(candidate);
  } catch (cause) {
    fail('spfaScoringContext', 'constructed context failed canonical validation', cause);
  }
}
