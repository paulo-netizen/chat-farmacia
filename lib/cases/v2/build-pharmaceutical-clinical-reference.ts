import type { PharmaceuticalClinicalReferenceV2 } from './pharmaceutical-clinical-reference-types';
import type { PatientRuntimeViewV2 } from './types';
import { validateEvaluatorViewV2 } from './validate-evaluator-view';
import {
  assertStrictEvaluatorShapeForClinicalReferenceV2,
  validatePharmaceuticalClinicalReferenceV2,
} from './validate-pharmaceutical-clinical-reference';

/**
 * Builds the server-owned M6 clinical reference from an evaluator that is
 * validated against the exact patient runtime. No patient fact is projected.
 */
export function buildPharmaceuticalClinicalReferenceV2(
  evaluatorInput: unknown,
  patientRuntime: PatientRuntimeViewV2,
): PharmaceuticalClinicalReferenceV2 {
  assertStrictEvaluatorShapeForClinicalReferenceV2(evaluatorInput);
  const evaluator = validateEvaluatorViewV2(evaluatorInput, patientRuntime);

  return validatePharmaceuticalClinicalReferenceV2({
    schemaVersion: '2.0',
    caseVersionId: evaluator.caseVersionId,
    versions: evaluator.versions,
    structuralContext: {
      carePath: evaluator.carePath,
      followUpEpisodes: evaluator.incidence.followUpEpisodes,
      prmRnmRelations: evaluator.prmRnmRelations,
    },
    clinicalConclusions: {
      incidence: {
        assessment: evaluator.incidence.assessment,
        findings: evaluator.incidence.findings,
      },
      prm: evaluator.prm,
      rnmAssessments: evaluator.rnmAssessments,
      adherence: evaluator.adherence,
      professionalActions: evaluator.professionalActions,
      pharmaceuticalInterventions: evaluator.pharmaceuticalInterventions,
      referral: evaluator.referral,
    },
  });
}
