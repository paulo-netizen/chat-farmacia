import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';
import {
  PHARMACEUTICAL_D1_BATCH_DOMAIN_ORDER_V1,
  PHARMACEUTICAL_D1_BATCH_PLAN_VERSION_V1,
  type PharmaceuticalD1BatchDomainV1,
  type PharmaceuticalD1BatchPlanV1,
} from './pharmaceutical-d1-batch-types';
import type { PharmaceuticalEvaluationTargetAspectV2 } from './pharmaceutical-evaluation-target-types';

export class PharmaceuticalD1BatchPlanError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalD1BatchPlanError';
  }
}

const DOMAIN_BY_ASPECT = {
  PRM_STATUS: 'PRM',
  PRM_EXISTENCE: 'PRM',
  PRM_CLASSIFICATION: 'PRM',
  PRM_MEDICATION_SCOPE: 'PRM',
  RNM_STATUS: 'RNM_RELATION',
  RNM_CLASSIFICATION: 'RNM_RELATION',
  RNM_MEDICATION_SCOPE: 'RNM_RELATION',
  PRM_RNM_RELATION: 'RNM_RELATION',
  ADHERENCE_STATUS: 'ADHERENCE',
  ADHERENCE_TYPE: 'ADHERENCE',
  ADHERENCE_MEDICATION_SCOPE: 'ADHERENCE',
  BARRIER_EXISTENCE: 'ADHERENCE',
  BARRIER_CATEGORY: 'ADHERENCE',
  BARRIER_ROLE: 'ADHERENCE',
  BARRIER_CLASSIFICATION: 'ADHERENCE',
  STRATEGY_CATEGORY: 'ADHERENCE',
  STRATEGY_ADDRESSED_REFS: 'ADHERENCE',
  PROFESSIONAL_ACTION_CATEGORY: 'PROFESSIONAL_RESPONSE',
  PROFESSIONAL_ACTION_CLASSIFICATION: 'PROFESSIONAL_RESPONSE',
  PROFESSIONAL_ACTION_SPFA_REF: 'PROFESSIONAL_RESPONSE',
  PROFESSIONAL_ACTION_TARGET_SPFA_REF: 'PROFESSIONAL_RESPONSE',
  PROFESSIONAL_ACTION_REFERRAL_REF: 'PROFESSIONAL_RESPONSE',
  INTERVENTION_TARGET: 'PROFESSIONAL_RESPONSE',
  INTERVENTION_CLASSIFICATION: 'PROFESSIONAL_RESPONSE',
  INTERVENTION_ADDRESSED_REFS: 'PROFESSIONAL_RESPONSE',
  INTERVENTION_ACTION_REF: 'PROFESSIONAL_RESPONSE',
  INTERVENTION_REFERRAL_REF: 'PROFESSIONAL_RESPONSE',
  REFERRAL_NEED: 'REFERRAL_REPORT',
  REFERRAL_URGENCY: 'REFERRAL_REPORT',
  REFERRAL_DESTINATION: 'REFERRAL_REPORT',
  REFERRAL_REASON: 'REFERRAL_REPORT',
  REPORT_STATUS: 'REFERRAL_REPORT',
  REPORT_CONTENT: 'REFERRAL_REPORT',
} as const satisfies Record<
  PharmaceuticalEvaluationTargetAspectV2,
  PharmaceuticalD1BatchDomainV1
>;

export function pharmaceuticalD1BatchDomainForAspectV1(
  aspect: PharmaceuticalEvaluationTargetAspectV2,
): PharmaceuticalD1BatchDomainV1 {
  const domain = (DOMAIN_BY_ASPECT as Record<string, PharmaceuticalD1BatchDomainV1 | undefined>)[aspect];
  if (domain === undefined) {
    throw new PharmaceuticalD1BatchPlanError(
      'target.aspect',
      `unsupported pharmaceutical D1 aspect: ${String(aspect)}`,
    );
  }
  return domain;
}

export function buildPharmaceuticalD1BatchPlanV1(
  context: PharmaceuticalAdjudicationContextSetV2,
): PharmaceuticalD1BatchPlanV1 {
  const targetsByDomain = new Map<
    PharmaceuticalD1BatchDomainV1,
    PharmaceuticalD1BatchPlanV1['semanticBatches'][number]['targets'][number][]
  >(
    PHARMACEUTICAL_D1_BATCH_DOMAIN_ORDER_V1.map((domain) => [domain, []]),
  );
  const structuralShells: PharmaceuticalD1BatchPlanV1['structuralShells'][number][] = [];

  for (const target of context.targets) {
    const domain = pharmaceuticalD1BatchDomainForAspectV1(target.aspect);
    if (target.structuralState.status === 'NO_STUDENT_CANDIDATES') {
      structuralShells.push({
        targetRef: target.targetRef,
        resolution: 'STRUCTURAL_NO_STUDENT_CANDIDATES',
      });
      continue;
    }
    targetsByDomain.get(domain)!.push(structuredClone(target));
  }

  return {
    schemaVersion: '2.0',
    contractVersion: PHARMACEUTICAL_D1_BATCH_PLAN_VERSION_V1,
    contextFingerprint: structuredClone(context.fingerprint),
    targetOrder: context.targets.map((target) => target.targetRef),
    semanticBatches: PHARMACEUTICAL_D1_BATCH_DOMAIN_ORDER_V1.flatMap((batchDomain) => {
      const targets = targetsByDomain.get(batchDomain)!;
      return targets.length === 0 ? [] : [{ batchDomain, targets }];
    }),
    structuralShells,
  };
}
