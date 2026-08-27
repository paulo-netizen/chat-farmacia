import type {
  AdherenceAssessment,
  EvidenceRule,
  EvaluatorConclusion,
  EvaluatorViewV2,
  PharmaceuticalIntervention,
  ProfessionalAction,
  RnmAssessment,
} from './evaluator-types';
import { IDENTIFIED_REPORT_REQUIREMENT_CONTRACT_VERSION } from './evaluator-types';
import type { PharmaceuticalClinicalReferenceV2 } from './pharmaceutical-clinical-reference-types';
import type { MedicationId, PatientRuntimeViewV2 } from './types';
import {
  EvaluatorViewValidationError,
  validateEvaluatorViewV2,
} from './validate-evaluator-view';

type UnknownRecord = Record<string, unknown>;

const EVIDENCE_ELIGIBLE_KINDS = new Set([
  'incidence_assessment',
  'incidence',
  'prm_assessment',
  'prm',
  'rnm_assessment',
  'adherence_assessment',
  'non_adherence_type',
  'adherence_patient_profile',
  'adherence_barrier_assessment',
  'adherence_barrier',
  'adherence_strategy',
  'professional_action',
  'pharmaceutical_intervention',
  'referral',
]);

export class PharmaceuticalClinicalReferenceValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(`${path}: ${message}`);
    this.name = 'PharmaceuticalClinicalReferenceValidationError';
  }
}

function fail(path: string, message: string, cause?: unknown): never {
  throw new PharmaceuticalClinicalReferenceValidationError(path, message, cause);
}

function record(value: unknown, path: string): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as UnknownRecord;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function exactKeys(
  value: UnknownRecord,
  allowed: readonly string[],
  path: string,
): void {
  const permitted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!permitted.has(key)) fail(`${path}.${key}`, 'unexpected property');
  }
}

function exactObject(value: unknown, allowed: readonly string[], path: string): UnknownRecord {
  const source = record(value, path);
  exactKeys(source, allowed, path);
  return source;
}

function taxonomyTerm(value: unknown, path: string): void {
  exactObject(value, ['taxonomyId', 'taxonomyVersion', 'conceptId'], path);
}

function optionalTaxonomyTerm(value: unknown, path: string): void {
  if (value !== undefined) taxonomyTerm(value, path);
}

function conclusion(
  value: unknown,
  path: string,
  valueKeys: readonly string[],
): UnknownRecord {
  const source = exactObject(value, ['conclusionId', 'kind', 'value'], path);
  return exactObject(source.value, valueKeys, `${path}.value`);
}

function each(
  value: unknown,
  path: string,
  inspect: (item: unknown, path: string) => void,
): void {
  array(value, path).forEach((item, index) => inspect(item, `${path}[${index}]`));
}

function inspectCarePath(value: unknown, path: string): void {
  const source = exactObject(value, ['initialSpfa', 'additionalSpfas', 'transitions'], path);
  const inspectSpfa = (item: unknown, itemPath: string) => {
    conclusion(item, itemPath, ['service', 'subtype']);
  };
  inspectSpfa(source.initialSpfa, `${path}.initialSpfa`);
  each(source.additionalSpfas, `${path}.additionalSpfas`, inspectSpfa);
  each(source.transitions, `${path}.transitions`, (item, itemPath) => {
    conclusion(item, itemPath, ['fromSpfaRef', 'toSpfaRef']);
  });
}

function inspectIncidence(value: unknown, path: string): void {
  const source = exactObject(value, ['assessment', 'findings', 'followUpEpisodes'], path);
  conclusion(source.assessment, `${path}.assessment`, ['status']);
  each(source.findings, `${path}.findings`, (item, itemPath) => {
    conclusion(item, itemPath, ['spfaRef', 'medicationRefs', 'semanticMeaning']);
  });
  each(source.followUpEpisodes, `${path}.followUpEpisodes`, (item, itemPath) => {
    conclusion(item, itemPath, ['incidenceRef']);
  });
}

function inspectPrm(value: unknown, path: string): void {
  const source = exactObject(value, ['assessment', 'findings'], path);
  conclusion(source.assessment, `${path}.assessment`, ['status']);
  each(source.findings, `${path}.findings`, (item, itemPath) => {
    const finding = conclusion(
      item,
      itemPath,
      ['classification', 'medicationRefs', 'followUpEpisodeRef'],
    );
    taxonomyTerm(finding.classification, `${itemPath}.value.classification`);
  });
}

function inspectRnmAssessments(value: unknown, path: string): void {
  each(value, path, (item, itemPath) => {
    const assessment = conclusion(
      item,
      itemPath,
      ['status', 'classification', 'medicationRefs', 'followUpEpisodeRef'],
    );
    optionalTaxonomyTerm(assessment.classification, `${itemPath}.value.classification`);
  });
}

function inspectPrmRnmRelations(value: unknown, path: string): void {
  each(value, path, (item, itemPath) => {
    conclusion(item, itemPath, ['prmRef', 'rnmAssessmentRef', 'relation']);
  });
}

function inspectAdherence(value: unknown, path: string): void {
  const source = exactObject(
    value,
    [
      'assessments',
      'typeConclusions',
      'patientProfiles',
      'barrierAssessments',
      'barriers',
      'strategies',
    ],
    path,
  );
  each(source.assessments, `${path}.assessments`, (item, itemPath) => {
    conclusion(item, itemPath, ['medicationRefs', 'status']);
  });
  each(source.typeConclusions, `${path}.typeConclusions`, (item, itemPath) => {
    conclusion(item, itemPath, ['adherenceAssessmentRef', 'status', 'type']);
  });
  each(source.patientProfiles, `${path}.patientProfiles`, (item, itemPath) => {
    conclusion(item, itemPath, ['adherenceAssessmentRef', 'status', 'profile']);
  });
  each(source.barrierAssessments, `${path}.barrierAssessments`, (item, itemPath) => {
    conclusion(item, itemPath, ['adherenceAssessmentRef', 'status']);
  });
  each(source.barriers, `${path}.barriers`, (item, itemPath) => {
    const barrier = conclusion(
      item,
      itemPath,
      ['barrierAssessmentRef', 'role', 'category', 'classification'],
    );
    optionalTaxonomyTerm(barrier.classification, `${itemPath}.value.classification`);
  });
  each(source.strategies, `${path}.strategies`, (item, itemPath) => {
    conclusion(
      item,
      itemPath,
      ['adherenceAssessmentRef', 'addressedBarrierRefs', 'category', 'componentCategories'],
    );
  });
}

function inspectProfessionalActions(value: unknown, path: string): void {
  each(value, path, (item, itemPath) => {
    const action = conclusion(
      item,
      itemPath,
      ['spfaRef', 'category', 'classification', 'targetSpfaRef', 'referralRef'],
    );
    optionalTaxonomyTerm(action.classification, `${itemPath}.value.classification`);
  });
}

function inspectInterventions(value: unknown, path: string): void {
  each(value, path, (item, itemPath) => {
    const intervention = conclusion(
      item,
      itemPath,
      [
        'spfaRef',
        'professionalActionRef',
        'target',
        'classification',
        'addressedConclusionRefs',
        'referralRef',
      ],
    );
    optionalTaxonomyTerm(intervention.classification, `${itemPath}.value.classification`);
  });
}

function inspectReferral(value: unknown, path: string): void {
  const referral = conclusion(
    value,
    path,
    ['status', 'urgency', 'destination', 'reason', 'report'],
  );
  if (referral.destination !== undefined) {
    const destination = exactObject(
      referral.destination,
      ['label', 'classification'],
      `${path}.value.destination`,
    );
    optionalTaxonomyTerm(
      destination.classification,
      `${path}.value.destination.classification`,
    );
  }
  if (referral.report !== undefined) {
    const reportPath = `${path}.value.report`;
    const report = record(referral.report, reportPath);
    if (Object.prototype.hasOwnProperty.call(report, 'contractVersion')) {
      exactKeys(
        report,
        ['contractVersion', 'status', 'essentialContents'],
        reportPath,
      );
      if (
        report.contractVersion !==
        IDENTIFIED_REPORT_REQUIREMENT_CONTRACT_VERSION
      ) {
        fail(
          `${reportPath}.contractVersion`,
          `must be ${IDENTIFIED_REPORT_REQUIREMENT_CONTRACT_VERSION}`,
        );
      }
      each(
        report.essentialContents,
        `${reportPath}.essentialContents`,
        (item, itemPath) => {
          exactObject(item, ['contentId', 'content'], itemPath);
        },
      );
    } else {
      exactKeys(report, ['status', 'essentialContents'], reportPath);
    }
  }
}

function inspectVersions(value: unknown, path: string): void {
  const source = exactObject(
    value,
    [
      'evaluatorSchema',
      'protocol',
      'prmTaxonomy',
      'rnmTaxonomy',
      'adherenceFramework',
      'barrierTaxonomy',
      'professionalActionTaxonomy',
      'pharmaceuticalInterventionTaxonomy',
      'referralDestinationTaxonomy',
    ],
    path,
  );
  Object.entries(source).forEach(([key, item]) => {
    exactObject(item, ['id', 'version'], `${path}.${key}`);
  });
}

function inspectEvidenceRules(value: unknown, path: string): void {
  const inspectExpression = (item: unknown, itemPath: string): void => {
    const source = record(item, itemPath);
    if (source.operator === 'fact') {
      exactKeys(source, ['operator', 'factRef'], itemPath);
      return;
    }
    if (source.operator === 'public_profile') {
      exactKeys(source, ['operator', 'field'], itemPath);
      return;
    }
    exactKeys(source, ['operator', 'operands'], itemPath);
    each(source.operands, `${itemPath}.operands`, inspectExpression);
  };
  const inspectLeaf = (item: unknown, itemPath: string) => {
    const source = record(item, itemPath);
    exactKeys(
      source,
      source.operator === 'fact' ? ['operator', 'factRef'] : ['operator', 'field'],
      itemPath,
    );
  };
  each(value, path, (item, itemPath) => {
    const source = exactObject(
      item,
      ['conclusionRef', 'requiredEvidence', 'supportingEvidenceRefs', 'counterEvidenceRefs', 'teacherRationale'],
      itemPath,
    );
    inspectExpression(source.requiredEvidence, `${itemPath}.requiredEvidence`);
    each(source.supportingEvidenceRefs, `${itemPath}.supportingEvidenceRefs`, inspectLeaf);
    each(source.counterEvidenceRefs, `${itemPath}.counterEvidenceRefs`, inspectLeaf);
  });
}

/** Strict property guard shared by the source boundary and the M6-A validator. */
export function assertStrictEvaluatorShapeForClinicalReferenceV2(
  input: unknown,
): void {
  const source = exactObject(
    input,
    [
      'schemaVersion',
      'caseVersionId',
      'versions',
      'carePath',
      'incidence',
      'prm',
      'rnmAssessments',
      'prmRnmRelations',
      'adherence',
      'professionalActions',
      'pharmaceuticalInterventions',
      'referral',
      'evidenceRules',
    ],
    'evaluatorView',
  );
  inspectVersions(source.versions, 'evaluatorView.versions');
  inspectCarePath(source.carePath, 'evaluatorView.carePath');
  inspectIncidence(source.incidence, 'evaluatorView.incidence');
  inspectPrm(source.prm, 'evaluatorView.prm');
  inspectRnmAssessments(source.rnmAssessments, 'evaluatorView.rnmAssessments');
  inspectPrmRnmRelations(source.prmRnmRelations, 'evaluatorView.prmRnmRelations');
  inspectAdherence(source.adherence, 'evaluatorView.adherence');
  inspectProfessionalActions(source.professionalActions, 'evaluatorView.professionalActions');
  inspectInterventions(
    source.pharmaceuticalInterventions,
    'evaluatorView.pharmaceuticalInterventions',
  );
  inspectReferral(source.referral, 'evaluatorView.referral');
  inspectEvidenceRules(source.evidenceRules, 'evaluatorView.evidenceRules');
}

function clinicalConclusions(evaluator: EvaluatorViewV2): EvaluatorConclusion<string, unknown>[] {
  return [
    evaluator.incidence.assessment,
    ...evaluator.incidence.findings,
    evaluator.prm.assessment,
    ...evaluator.prm.findings,
    ...evaluator.rnmAssessments,
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

function syntheticEvidenceRules(evaluator: EvaluatorViewV2): EvidenceRule[] {
  return clinicalConclusions(evaluator)
    .filter((item) => EVIDENCE_ELIGIBLE_KINDS.has(item.kind))
    .map((item) => ({
      conclusionRef: item.conclusionId,
      requiredEvidence: { operator: 'public_profile', field: 'age' },
      supportingEvidenceRefs: [{ operator: 'public_profile', field: 'age' }],
      counterEvidenceRefs: [],
      teacherRationale: 'Internal M6-A structural validation only',
    }));
}

function validationRuntime(evaluator: unknown): PatientRuntimeViewV2 {
  const ids = new Set<MedicationId>();
  const visit = (value: unknown): void => {
    if (typeof value === 'string') {
      if (value.startsWith('med_')) ids.add(value as MedicationId);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === 'object' && value !== null) {
      Object.values(value).forEach(visit);
    }
  };
  visit(evaluator);
  const source = record(evaluator, 'evaluatorView');
  return {
    caseVersionId: source.caseVersionId,
    medicationIndex: [...ids].map((medicationId) => ({ medicationId })),
  } as unknown as PatientRuntimeViewV2;
}

function project(evaluator: EvaluatorViewV2): PharmaceuticalClinicalReferenceV2 {
  return {
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
  };
}

export function validatePharmaceuticalClinicalReferenceV2(
  input: unknown,
): PharmaceuticalClinicalReferenceV2 {
  const source = exactObject(
    input,
    ['schemaVersion', 'caseVersionId', 'versions', 'structuralContext', 'clinicalConclusions'],
    'pharmaceuticalClinicalReference',
  );
  const structural = exactObject(
    source.structuralContext,
    ['carePath', 'followUpEpisodes', 'prmRnmRelations'],
    'pharmaceuticalClinicalReference.structuralContext',
  );
  const clinical = exactObject(
    source.clinicalConclusions,
    [
      'incidence',
      'prm',
      'rnmAssessments',
      'adherence',
      'professionalActions',
      'pharmaceuticalInterventions',
      'referral',
    ],
    'pharmaceuticalClinicalReference.clinicalConclusions',
  );
  const incidence = exactObject(
    clinical.incidence,
    ['assessment', 'findings'],
    'pharmaceuticalClinicalReference.clinicalConclusions.incidence',
  );

  const evaluatorCandidate = {
    schemaVersion: source.schemaVersion,
    caseVersionId: source.caseVersionId,
    versions: source.versions,
    carePath: structural.carePath,
    incidence: {
      assessment: incidence.assessment,
      findings: incidence.findings,
      followUpEpisodes: structural.followUpEpisodes,
    },
    prm: clinical.prm,
    rnmAssessments: clinical.rnmAssessments,
    prmRnmRelations: structural.prmRnmRelations,
    adherence: clinical.adherence,
    professionalActions: clinical.professionalActions,
    pharmaceuticalInterventions: clinical.pharmaceuticalInterventions,
    referral: clinical.referral,
    evidenceRules: [],
  };

  assertStrictEvaluatorShapeForClinicalReferenceV2(evaluatorCandidate);

  let shape: EvaluatorViewV2;
  try {
    const withoutEvidence = validateEvaluatorViewV2(
      {
        ...evaluatorCandidate,
        evidenceRules: [],
      },
      validationRuntime(evaluatorCandidate),
    );
    shape = withoutEvidence;
  } catch (cause) {
    if (
      cause instanceof EvaluatorViewValidationError &&
      cause.message.includes('missing EvidenceRule')
    ) {
      const unvalidated = evaluatorCandidate as EvaluatorViewV2;
      try {
        shape = validateEvaluatorViewV2(
          { ...evaluatorCandidate, evidenceRules: syntheticEvidenceRules(unvalidated) },
          validationRuntime(evaluatorCandidate),
        );
      } catch (innerCause) {
        fail('pharmaceuticalClinicalReference', 'violates evaluator invariants', innerCause);
      }
    } else {
      fail('pharmaceuticalClinicalReference', 'violates evaluator invariants', cause);
    }
  }

  return project(shape);
}
