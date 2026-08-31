import type { PharmaceuticalAdjudicationContextSetV2 } from './pharmaceutical-adjudication-context-types';
import type { PharmaceuticalD2RelationshipProjectionV2 } from './pharmaceutical-d2-claim-types';
import { buildPharmaceuticalD2StudentMessageSetV2 } from './build-pharmaceutical-d2-student-message-set';

const CONCLUSION_ID = /^conclusion_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MEDICATION_ID = /^med_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export class PharmaceuticalD2RelationshipProjectionError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalD2RelationshipProjectionError';
  }
}

function fail(path: string, message: string): never {
  throw new PharmaceuticalD2RelationshipProjectionError(path, message);
}

function ordinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Input is the server-owned, already reconstructed M6-C context, not provider data.
 * M6-C validates foreign-key existence against the clinical reference. Here we
 * preserve those nested links, check their integrity/coherence across targets,
 * and collapse repeated views of the same barrier. No target must be inferred.
 */
export function buildPharmaceuticalD2RelationshipProjectionV2(
  context: PharmaceuticalAdjudicationContextSetV2,
): readonly PharmaceuticalD2RelationshipProjectionV2[] {
  // Includes the existing integrity check: stored hash must match its material.
  buildPharmaceuticalD2StudentMessageSetV2(context);
  const roles = new Map<string, string>();
  const assessments = new Map<string, string>();
  const barrierAssessments = new Map<string, string>();
  const barrierValues = new Map<string, string>();
  const relationships = new Map<string, PharmaceuticalD2RelationshipProjectionV2>();

  function conclusion(value: unknown, role: string, path: string): void {
    if (typeof value !== 'string' || !CONCLUSION_ID.test(value)) {
      fail(path, 'must be a canonical conclusion reference');
    }
    const previous = roles.get(value);
    if (previous !== undefined && previous !== role) fail(path, 'conflicting conclusion roles');
    roles.set(value, role);
  }

  function consistent(index: Map<string, string>, ref: string, value: unknown, path: string): void {
    const serialized = JSON.stringify(value);
    const previous = index.get(ref);
    if (previous !== undefined && previous !== serialized) fail(path, 'incompatible repeated authority');
    index.set(ref, serialized);
  }

  context.targets.forEach((target, index) => {
    const path = `targets[${index}].clinicalContext`;
    const clinical = target.clinicalContext;
    if (clinical.domain !== 'BARRIER' && clinical.domain !== 'ADHERENCE' && clinical.domain !== 'STRATEGY') return;
    const adherence = clinical.domain === 'ADHERENCE' ? clinical.assessment : clinical.adherenceAssessment;
    if (!adherence) fail(`${path}.adherenceAssessment`, 'missing canonical adherence link');
    conclusion(adherence.assessmentRef, 'adherence', `${path}.adherenceAssessment.assessmentRef`);
    if (!Array.isArray(adherence.medicationRefs)) fail(`${path}.medicationRefs`, 'must be an array');
    const identities = new Set<string>(target.medicationIdentities.map((item) => item.medicationId));
    adherence.medicationRefs.forEach((ref, position) => {
      if (typeof ref !== 'string' || !MEDICATION_ID.test(ref) || !identities.has(ref)) {
        fail(`${path}.medicationRefs[${position}]`, 'must resolve to a canonical medication identity');
      }
    });
    const medicationRefs = [...new Set(adherence.medicationRefs)].sort(ordinal);
    consistent(assessments, adherence.assessmentRef, [adherence.status, medicationRefs], path);
    if (clinical.domain !== 'BARRIER') return;
    if (!clinical.barrierAssessment) fail(`${path}.barrierAssessment`, 'missing canonical barrier assessment');
    const assessment = clinical.barrierAssessment;
    conclusion(assessment.assessmentRef, 'barrierAssessment', `${path}.barrierAssessment.assessmentRef`);
    consistent(barrierAssessments, assessment.assessmentRef, [adherence.assessmentRef, assessment.status], path);
    if (clinical.barrier === undefined) {
      if (target.aspect !== 'BARRIER_EXISTENCE') fail(`${path}.barrier`, 'missing canonical barrier');
      return;
    }
    if (assessment.status !== 'identified') fail(path, 'barrier requires an identified assessment');
    const barrier = clinical.barrier;
    conclusion(barrier.barrierRef, 'barrier', `${path}.barrier.barrierRef`);
    consistent(barrierValues, barrier.barrierRef, [
      assessment.assessmentRef, barrier.role, barrier.category,
      barrier.classification === undefined ? null : [
        barrier.classification.taxonomyId, barrier.classification.taxonomyVersion,
        barrier.classification.conceptId,
      ],
    ], path);
    const relationship: PharmaceuticalD2RelationshipProjectionV2 = {
      barrierRef: barrier.barrierRef,
      barrierAssessmentRef: assessment.assessmentRef,
      adherenceAssessmentRef: adherence.assessmentRef,
      medicationRefs,
    };
    const previous = relationships.get(barrier.barrierRef);
    if (previous !== undefined && JSON.stringify(previous) !== JSON.stringify(relationship)) {
      fail(path, 'incompatible repeated relationship');
    }
    relationships.set(barrier.barrierRef, relationship);
  });
  return [...relationships.values()].sort((left, right) => ordinal(left.barrierRef, right.barrierRef));
}
