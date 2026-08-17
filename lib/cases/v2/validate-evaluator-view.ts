import type {
  AssessmentStatus,
  CarePathV2,
  ConclusionId,
  EvidenceExpression,
  EvidenceLeafRef,
  EvidenceRule,
  EvaluatorConclusion,
  EvaluatorVersionsV2,
  EvaluatorViewV2,
  FollowUpEpisode,
  IncidenceAssessment,
  IncidenceFinding,
  NonEmptyArray,
  PrmAssessment,
  PrmFinding,
  PrmRnmRelation,
  RnmAssessment,
  SpfaConclusion,
  SpfaService,
  SpfaTransition,
  TaxonomyTermRef,
  VersionRef,
} from './evaluator-types';
import type {
  FactId,
  MedicationId,
  PatientRuntimeViewV2,
} from './types';
import { validateCaseVersionId } from './validate-patient-facts';

const UUID_BODY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const SPFA_SERVICES = [
  'dispensing',
  'pharmaceutical_indication',
  'medication_adherence',
] as const;

const ASSESSMENT_STATUSES = [
  'none',
  'present',
  'not_determinable',
] as const;

const EVIDENCE_RULE_KINDS = new Set([
  'incidence_assessment',
  'incidence',
  'prm_assessment',
  'prm',
  'rnm_assessment',
]);

type AnyConclusion = EvaluatorConclusion<string, unknown>;

export class EvaluatorViewValidationError extends Error {
  constructor(
    public readonly path: string,
    message: string,
  ) {
    super(`${path}: ${message}`);
    this.name = 'EvaluatorViewValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new EvaluatorViewValidationError(path, message);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function nonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
  return value;
}

function assertExactKeys(
  source: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
): void {
  const allowedKeys = new Set(allowed);
  for (const key of Object.keys(source)) {
    if (!allowedKeys.has(key)) {
      fail(`${path}.${key}`, 'unexpected property');
    }
  }
}

function controlledValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  path: string,
): T[number] {
  if (typeof value !== 'string' || !allowed.includes(value)) {
    fail(path, `must be one of: ${allowed.join(', ')}`);
  }
  return value as T[number];
}

function opaqueId<T extends string>(
  value: unknown,
  prefix: 'conclusion' | 'fact' | 'med',
  path: string,
): T {
  if (typeof value !== 'string') {
    fail(path, `must use the opaque format ${prefix}_<uuid>`);
  }
  const expectedPrefix = `${prefix}_`;
  if (
    !value.startsWith(expectedPrefix) ||
    !UUID_BODY_PATTERN.test(value.slice(expectedPrefix.length))
  ) {
    fail(path, `must use the opaque format ${prefix}_<uuid>`);
  }
  return value as T;
}

function parseConclusionId(value: unknown, path: string): ConclusionId {
  return opaqueId<ConclusionId>(value, 'conclusion', path);
}

function parseFactId(value: unknown, path: string): FactId {
  return opaqueId<FactId>(value, 'fact', path);
}

function parseMedicationId(value: unknown, path: string): MedicationId {
  return opaqueId<MedicationId>(value, 'med', path);
}

function parseVersionRef(value: unknown, path: string): VersionRef {
  const source = asRecord(value, path);
  return {
    id: nonEmptyString(source.id, `${path}.id`),
    version: nonEmptyString(source.version, `${path}.version`),
  };
}

function parseTaxonomyTermRef(
  value: unknown,
  path: string,
): TaxonomyTermRef {
  const source = asRecord(value, path);
  return {
    taxonomyId: nonEmptyString(source.taxonomyId, `${path}.taxonomyId`),
    taxonomyVersion: nonEmptyString(
      source.taxonomyVersion,
      `${path}.taxonomyVersion`,
    ),
    conceptId: nonEmptyString(source.conceptId, `${path}.conceptId`),
  };
}

function parseVersions(value: unknown): EvaluatorVersionsV2 {
  const source = asRecord(value, 'versions');
  return {
    evaluatorSchema: parseVersionRef(
      source.evaluatorSchema,
      'versions.evaluatorSchema',
    ),
    protocol: parseVersionRef(source.protocol, 'versions.protocol'),
    prmTaxonomy: parseVersionRef(
      source.prmTaxonomy,
      'versions.prmTaxonomy',
    ),
    rnmTaxonomy: parseVersionRef(
      source.rnmTaxonomy,
      'versions.rnmTaxonomy',
    ),
  };
}

function parseSpfaConclusion(value: unknown, path: string): SpfaConclusion {
  const source = asRecord(value, path);
  if (source.kind !== 'spfa') fail(`${path}.kind`, 'must be spfa');
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const service = controlledValue(
    conclusionValue.service,
    SPFA_SERVICES,
    `${path}.value.service`,
  ) as SpfaService;

  if (service === 'dispensing') {
    return {
      conclusionId: parseConclusionId(
        source.conclusionId,
        `${path}.conclusionId`,
      ),
      kind: 'spfa',
      value: {
        service,
        subtype: controlledValue(
          conclusionValue.subtype,
          ['initial_treatment', 'continuation'] as const,
          `${path}.value.subtype`,
        ),
      },
    };
  }

  if (conclusionValue.subtype !== undefined) {
    fail(`${path}.value.subtype`, 'is only valid for dispensing');
  }
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'spfa',
    value: { service },
  };
}

function parseSpfaTransition(value: unknown, path: string): SpfaTransition {
  const source = asRecord(value, path);
  if (source.kind !== 'spfa_transition') {
    fail(`${path}.kind`, 'must be spfa_transition');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'spfa_transition',
    value: {
      fromSpfaRef: parseConclusionId(
        conclusionValue.fromSpfaRef,
        `${path}.value.fromSpfaRef`,
      ),
      toSpfaRef: parseConclusionId(
        conclusionValue.toSpfaRef,
        `${path}.value.toSpfaRef`,
      ),
    },
  };
}

function parseCarePath(value: unknown): CarePathV2 {
  const source = asRecord(value, 'carePath');
  return {
    initialSpfa: parseSpfaConclusion(source.initialSpfa, 'carePath.initialSpfa'),
    additionalSpfas: asArray(
      source.additionalSpfas,
      'carePath.additionalSpfas',
    ).map((item, index) =>
      parseSpfaConclusion(item, `carePath.additionalSpfas[${index}]`),
    ),
    transitions: asArray(source.transitions, 'carePath.transitions').map(
      (item, index) =>
        parseSpfaTransition(item, `carePath.transitions[${index}]`),
    ),
  };
}

function parseAssessment<K extends 'incidence_assessment' | 'prm_assessment'>(
  value: unknown,
  kind: K,
  path: string,
): EvaluatorConclusion<K, { status: AssessmentStatus }> {
  const source = asRecord(value, path);
  if (source.kind !== kind) fail(`${path}.kind`, `must be ${kind}`);
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind,
    value: {
      status: controlledValue(
        conclusionValue.status,
        ASSESSMENT_STATUSES,
        `${path}.value.status`,
      ) as AssessmentStatus,
    },
  };
}

function parseMedicationRefs(value: unknown, path: string): MedicationId[] {
  return asArray(value, path).map((item, index) =>
    parseMedicationId(item, `${path}[${index}]`),
  );
}

function optionalConclusionId(
  value: unknown,
  path: string,
): ConclusionId | undefined {
  return value === undefined ? undefined : parseConclusionId(value, path);
}

function parseIncidenceFinding(
  value: unknown,
  path: string,
): IncidenceFinding {
  const source = asRecord(value, path);
  if (source.kind !== 'incidence') fail(`${path}.kind`, 'must be incidence');
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'incidence',
    value: {
      spfaRef: parseConclusionId(
        conclusionValue.spfaRef,
        `${path}.value.spfaRef`,
      ),
      medicationRefs: parseMedicationRefs(
        conclusionValue.medicationRefs,
        `${path}.value.medicationRefs`,
      ),
      semanticMeaning: nonEmptyString(
        conclusionValue.semanticMeaning,
        `${path}.value.semanticMeaning`,
      ),
    },
  };
}

function parseFollowUpEpisode(
  value: unknown,
  path: string,
): FollowUpEpisode {
  const source = asRecord(value, path);
  if (source.kind !== 'follow_up_episode') {
    fail(`${path}.kind`, 'must be follow_up_episode');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'follow_up_episode',
    value: {
      incidenceRef: parseConclusionId(
        conclusionValue.incidenceRef,
        `${path}.value.incidenceRef`,
      ),
    },
  };
}

function parsePrmFinding(value: unknown, path: string): PrmFinding {
  const source = asRecord(value, path);
  if (source.kind !== 'prm') fail(`${path}.kind`, 'must be prm');
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const followUpEpisodeRef = optionalConclusionId(
    conclusionValue.followUpEpisodeRef,
    `${path}.value.followUpEpisodeRef`,
  );
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'prm',
    value: {
      classification: parseTaxonomyTermRef(
        conclusionValue.classification,
        `${path}.value.classification`,
      ),
      medicationRefs: parseMedicationRefs(
        conclusionValue.medicationRefs,
        `${path}.value.medicationRefs`,
      ),
      ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
    },
  };
}

function parseRnmAssessment(value: unknown, path: string): RnmAssessment {
  const source = asRecord(value, path);
  if (source.kind !== 'rnm_assessment') {
    fail(`${path}.kind`, 'must be rnm_assessment');
  }
  const conclusionId = parseConclusionId(
    source.conclusionId,
    `${path}.conclusionId`,
  );
  const conclusionValue = asRecord(source.value, `${path}.value`);
  const status = controlledValue(
    conclusionValue.status,
    ['rnm', 'risk_of_rnm', 'no_rnm'] as const,
    `${path}.value.status`,
  );
  if (status === 'no_rnm') {
    if (
      conclusionValue.classification !== undefined ||
      conclusionValue.followUpEpisodeRef !== undefined ||
      conclusionValue.medicationRefs !== undefined
    ) {
      fail(
        `${path}.value`,
        'no_rnm cannot include classification, episode or medication references',
      );
    }
    return {
      conclusionId,
      kind: 'rnm_assessment',
      value: { status },
    };
  }

  const medicationRefs = parseMedicationRefs(
    conclusionValue.medicationRefs,
    `${path}.value.medicationRefs`,
  );

  const followUpEpisodeRef = optionalConclusionId(
    conclusionValue.followUpEpisodeRef,
    `${path}.value.followUpEpisodeRef`,
  );
  if (status === 'rnm') {
    return {
      conclusionId,
      kind: 'rnm_assessment',
      value: {
        status,
        classification: parseTaxonomyTermRef(
          conclusionValue.classification,
          `${path}.value.classification`,
        ),
        medicationRefs,
        ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
      },
    };
  }

  const classification =
    conclusionValue.classification === undefined
      ? undefined
      : parseTaxonomyTermRef(
          conclusionValue.classification,
          `${path}.value.classification`,
        );
  return {
    conclusionId,
    kind: 'rnm_assessment',
    value: {
      status,
      ...(classification === undefined ? {} : { classification }),
      medicationRefs,
      ...(followUpEpisodeRef === undefined ? {} : { followUpEpisodeRef }),
    },
  };
}

function parsePrmRnmRelation(value: unknown, path: string): PrmRnmRelation {
  const source = asRecord(value, path);
  if (source.kind !== 'prm_rnm_relation') {
    fail(`${path}.kind`, 'must be prm_rnm_relation');
  }
  const conclusionValue = asRecord(source.value, `${path}.value`);
  return {
    conclusionId: parseConclusionId(
      source.conclusionId,
      `${path}.conclusionId`,
    ),
    kind: 'prm_rnm_relation',
    value: {
      prmRef: parseConclusionId(
        conclusionValue.prmRef,
        `${path}.value.prmRef`,
      ),
      rnmAssessmentRef: parseConclusionId(
        conclusionValue.rnmAssessmentRef,
        `${path}.value.rnmAssessmentRef`,
      ),
      relation: controlledValue(
        conclusionValue.relation,
        ['creates_risk_of_rnm', 'contributes_to_rnm'] as const,
        `${path}.value.relation`,
      ),
    },
  };
}

function parseEvidenceLeaf(value: unknown, path: string): EvidenceLeafRef {
  const source = asRecord(value, path);
  if (source.operator === 'fact') {
    assertExactKeys(source, ['operator', 'factRef'], path);
    return {
      operator: 'fact',
      factRef: parseFactId(source.factRef, `${path}.factRef`),
    };
  }
  if (source.operator === 'public_profile') {
    assertExactKeys(source, ['operator', 'field'], path);
    return {
      operator: 'public_profile',
      field: controlledValue(
        source.field,
        ['age', 'sex'] as const,
        `${path}.field`,
      ),
    };
  }
  fail(`${path}.operator`, 'must be fact or public_profile');
}

function parseEvidenceExpression(
  value: unknown,
  path: string,
  depth = 0,
): EvidenceExpression {
  if (depth > 32) fail(path, 'evidence expression is too deeply nested');
  const source = asRecord(value, path);
  if (source.operator === 'fact' || source.operator === 'public_profile') {
    return parseEvidenceLeaf(source, path);
  }
  if (source.operator === 'all' || source.operator === 'any') {
    assertExactKeys(source, ['operator', 'operands'], path);
    const operands = asArray(source.operands, `${path}.operands`);
    if (operands.length === 0) {
      fail(`${path}.operands`, 'must contain at least one expression');
    }
    return {
      operator: source.operator,
      operands: operands.map((operand, index) =>
        parseEvidenceExpression(
          operand,
          `${path}.operands[${index}]`,
          depth + 1,
        ),
      ) as unknown as NonEmptyArray<EvidenceExpression>,
    };
  }
  fail(
    `${path}.operator`,
    'must be fact, public_profile, all or any',
  );
}

function parseEvidenceRule(value: unknown, index: number): EvidenceRule {
  const path = `evidenceRules[${index}]`;
  const source = asRecord(value, path);
  assertExactKeys(
    source,
    [
      'conclusionRef',
      'requiredEvidence',
      'supportingEvidenceRefs',
      'counterEvidenceRefs',
      'teacherRationale',
    ],
    path,
  );
  return {
    conclusionRef: parseConclusionId(
      source.conclusionRef,
      `${path}.conclusionRef`,
    ),
    requiredEvidence: parseEvidenceExpression(
      source.requiredEvidence,
      `${path}.requiredEvidence`,
    ),
    supportingEvidenceRefs: asArray(
      source.supportingEvidenceRefs,
      `${path}.supportingEvidenceRefs`,
    ).map((item, leafIndex) =>
      parseEvidenceLeaf(item, `${path}.supportingEvidenceRefs[${leafIndex}]`),
    ),
    counterEvidenceRefs: asArray(
      source.counterEvidenceRefs,
      `${path}.counterEvidenceRefs`,
    ).map((item, leafIndex) =>
      parseEvidenceLeaf(item, `${path}.counterEvidenceRefs[${leafIndex}]`),
    ),
    teacherRationale: nonEmptyString(
      source.teacherRationale,
      `${path}.teacherRationale`,
    ),
  };
}

function conclusionEntries(evaluator: EvaluatorViewV2): AnyConclusion[] {
  return [
    evaluator.carePath.initialSpfa,
    ...evaluator.carePath.additionalSpfas,
    ...evaluator.carePath.transitions,
    evaluator.incidence.assessment,
    ...evaluator.incidence.findings,
    ...evaluator.incidence.followUpEpisodes,
    evaluator.prm.assessment,
    ...evaluator.prm.findings,
    ...evaluator.rnmAssessments,
    ...evaluator.prmRnmRelations,
  ];
}

function collectRuntimeIndex(runtime: PatientRuntimeViewV2): {
  facts: Map<string, string>;
  medications: Set<string>;
} {
  const facts = new Map<string, string>();
  const medications = new Set<string>();

  const visit = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    const record = value as Record<string, unknown>;
    if (typeof record.factId === 'string' && typeof record.state === 'string') {
      facts.set(record.factId, record.state);
    }
    if (typeof record.medicationId === 'string') {
      medications.add(record.medicationId);
    }
    Object.values(record).forEach(visit);
  };
  visit(runtime);
  return { facts, medications };
}

function evidenceKey(reference: EvidenceLeafRef): string {
  return reference.operator === 'fact'
    ? `fact:${reference.factRef}`
    : `public_profile:${reference.field}`;
}

function expressionLeaves(expression: EvidenceExpression): EvidenceLeafRef[] {
  return expression.operator === 'all' || expression.operator === 'any'
    ? expression.operands.flatMap(expressionLeaves)
    : [expression];
}

function validateCrossReferences(
  evaluator: EvaluatorViewV2,
  runtime: PatientRuntimeViewV2,
): void {
  if (evaluator.caseVersionId !== runtime.caseVersionId) {
    fail('caseVersionId', 'must match patient runtime caseVersionId');
  }

  const conclusions = conclusionEntries(evaluator);
  const conclusionById = new Map<string, AnyConclusion>();
  conclusions.forEach((conclusion) => {
    if (conclusionById.has(conclusion.conclusionId)) {
      fail(
        'conclusions',
        `duplicate conclusion ID: ${conclusion.conclusionId}`,
      );
    }
    conclusionById.set(conclusion.conclusionId, conclusion);
  });

  const requireKind = (
    reference: ConclusionId,
    kind: string,
    path: string,
  ): AnyConclusion => {
    const conclusion = conclusionById.get(reference);
    if (conclusion === undefined) {
      fail(path, `unknown conclusion reference: ${reference}`);
    }
    if (conclusion.kind !== kind) {
      fail(path, `must reference a conclusion of kind ${kind}`);
    }
    return conclusion;
  };

  evaluator.carePath.transitions.forEach((transition, index) => {
    const path = `carePath.transitions[${index}].value`;
    requireKind(transition.value.fromSpfaRef, 'spfa', `${path}.fromSpfaRef`);
    requireKind(transition.value.toSpfaRef, 'spfa', `${path}.toSpfaRef`);
    if (transition.value.fromSpfaRef === transition.value.toSpfaRef) {
      fail(path, 'transition endpoints must be different conclusions');
    }
  });

  const { facts, medications } = collectRuntimeIndex(runtime);
  const validateMedicationRefs = (references: MedicationId[], path: string) => {
    references.forEach((reference, index) => {
      if (!medications.has(reference)) {
        fail(`${path}[${index}]`, `unknown medication reference: ${reference}`);
      }
    });
  };

  const incidenceStatus = evaluator.incidence.assessment.value.status;
  if (incidenceStatus === 'present' && evaluator.incidence.findings.length === 0) {
    fail('incidence.findings', 'present assessment requires findings');
  }
  if (incidenceStatus !== 'present' && evaluator.incidence.findings.length > 0) {
    fail('incidence.findings', `${incidenceStatus} assessment forbids findings`);
  }
  evaluator.incidence.findings.forEach((finding, index) => {
    requireKind(
      finding.value.spfaRef,
      'spfa',
      `incidence.findings[${index}].value.spfaRef`,
    );
    validateMedicationRefs(
      finding.value.medicationRefs,
      `incidence.findings[${index}].value.medicationRefs`,
    );
  });
  const incidencesWithEpisode = new Set<string>();
  evaluator.incidence.followUpEpisodes.forEach((episode, index) => {
    requireKind(
      episode.value.incidenceRef,
      'incidence',
      `incidence.followUpEpisodes[${index}].value.incidenceRef`,
    );
    incidencesWithEpisode.add(episode.value.incidenceRef);
  });
  evaluator.incidence.findings.forEach((finding, index) => {
    if (!incidencesWithEpisode.has(finding.conclusionId)) {
      fail(
        `incidence.findings[${index}]`,
        'present incidence requires a follow-up episode',
      );
    }
  });

  const prmStatus = evaluator.prm.assessment.value.status;
  if (prmStatus === 'present' && evaluator.prm.findings.length === 0) {
    fail('prm.findings', 'present assessment requires findings');
  }
  if (prmStatus !== 'present' && evaluator.prm.findings.length > 0) {
    fail('prm.findings', `${prmStatus} assessment forbids findings`);
  }
  evaluator.prm.findings.forEach((finding, index) => {
    const path = `prm.findings[${index}].value`;
    validateMedicationRefs(finding.value.medicationRefs, `${path}.medicationRefs`);
    if (finding.value.followUpEpisodeRef !== undefined) {
      requireKind(
        finding.value.followUpEpisodeRef,
        'follow_up_episode',
        `${path}.followUpEpisodeRef`,
      );
    }
    if (
      finding.value.classification.taxonomyId !==
        evaluator.versions.prmTaxonomy.id ||
      finding.value.classification.taxonomyVersion !==
        evaluator.versions.prmTaxonomy.version
    ) {
      fail(`${path}.classification`, 'must use the configured PRM taxonomy');
    }
  });

  if (evaluator.rnmAssessments.length === 0) {
    fail('rnmAssessments', 'must explicitly contain an RNM assessment');
  }
  const noRnmCount = evaluator.rnmAssessments.filter(
    (assessment) => assessment.value.status === 'no_rnm',
  ).length;
  if (noRnmCount > 0 && evaluator.rnmAssessments.length !== 1) {
    fail('rnmAssessments', 'no_rnm cannot coexist with RNM or risk findings');
  }
  evaluator.rnmAssessments.forEach((assessment, index) => {
    const path = `rnmAssessments[${index}].value`;
    if (assessment.value.status === 'no_rnm') return;
    validateMedicationRefs(
      assessment.value.medicationRefs,
      `${path}.medicationRefs`,
    );
    if (assessment.value.followUpEpisodeRef !== undefined) {
      requireKind(
        assessment.value.followUpEpisodeRef,
        'follow_up_episode',
        `${path}.followUpEpisodeRef`,
      );
    }
    if (
      assessment.value.classification !== undefined &&
      (assessment.value.classification.taxonomyId !==
        evaluator.versions.rnmTaxonomy.id ||
        assessment.value.classification.taxonomyVersion !==
          evaluator.versions.rnmTaxonomy.version)
    ) {
      fail(`${path}.classification`, 'must use the configured RNM taxonomy');
    }
  });

  const relatedPrmIds = new Set<string>();
  const risksWithIncomingRelation = new Set<string>();
  evaluator.prmRnmRelations.forEach((relation, index) => {
    const path = `prmRnmRelations[${index}].value`;
    requireKind(relation.value.prmRef, 'prm', `${path}.prmRef`);
    const rnm = requireKind(
      relation.value.rnmAssessmentRef,
      'rnm_assessment',
      `${path}.rnmAssessmentRef`,
    ) as RnmAssessment;
    if (
      relation.value.relation === 'creates_risk_of_rnm' &&
      rnm.value.status !== 'risk_of_rnm'
    ) {
      fail(`${path}.relation`, 'creates_risk_of_rnm must reference a risk');
    }
    if (
      relation.value.relation === 'contributes_to_rnm' &&
      rnm.value.status !== 'rnm'
    ) {
      fail(`${path}.relation`, 'contributes_to_rnm must reference an RNM');
    }
    relatedPrmIds.add(relation.value.prmRef);
    if (relation.value.relation === 'creates_risk_of_rnm') {
      risksWithIncomingRelation.add(relation.value.rnmAssessmentRef);
    }
  });
  evaluator.prm.findings.forEach((finding, index) => {
    if (!relatedPrmIds.has(finding.conclusionId)) {
      fail(
        `prm.findings[${index}]`,
        'PRM must participate in at least one PRM-RNM relation',
      );
    }
  });
  evaluator.rnmAssessments.forEach((assessment, index) => {
    if (
      assessment.value.status === 'risk_of_rnm' &&
      !risksWithIncomingRelation.has(assessment.conclusionId)
    ) {
      fail(
        `rnmAssessments[${index}]`,
        'risk_of_rnm requires an incoming creates_risk_of_rnm relation',
      );
    }
  });

  const validateEvidenceLeaf = (leaf: EvidenceLeafRef, path: string) => {
    if (leaf.operator === 'fact' && !facts.has(leaf.factRef)) {
      fail(path, `unknown fact reference: ${leaf.factRef}`);
    }
  };
  const rulesByConclusion = new Map<string, EvidenceRule>();
  evaluator.evidenceRules.forEach((rule, index) => {
    const path = `evidenceRules[${index}]`;
    const conclusion = conclusionById.get(rule.conclusionRef);
    if (conclusion === undefined) {
      fail(`${path}.conclusionRef`, 'unknown conclusion reference');
    }
    if (rulesByConclusion.has(rule.conclusionRef)) {
      fail(`${path}.conclusionRef`, 'duplicate EvidenceRule for conclusion');
    }
    if (!EVIDENCE_RULE_KINDS.has(conclusion.kind)) {
      fail(
        `${path}.conclusionRef`,
        `conclusion kind ${conclusion.kind} does not accept EvidenceRule`,
      );
    }
    rulesByConclusion.set(rule.conclusionRef, rule);

    const requiredLeaves = expressionLeaves(rule.requiredEvidence);
    requiredLeaves.forEach((leaf, leafIndex) =>
      validateEvidenceLeaf(leaf, `${path}.requiredEvidence.leaf[${leafIndex}]`),
    );

    const validateFlatList = (
      references: readonly EvidenceLeafRef[],
      field: 'supportingEvidenceRefs' | 'counterEvidenceRefs',
    ) => {
      const keys = new Set<string>();
      references.forEach((leaf, leafIndex) => {
        validateEvidenceLeaf(leaf, `${path}.${field}[${leafIndex}]`);
        const key = evidenceKey(leaf);
        if (keys.has(key)) {
          fail(`${path}.${field}[${leafIndex}]`, `duplicate evidence: ${key}`);
        }
        keys.add(key);
      });
      return keys;
    };
    const supportingKeys = validateFlatList(
      rule.supportingEvidenceRefs,
      'supportingEvidenceRefs',
    );
    const counterKeys = validateFlatList(
      rule.counterEvidenceRefs,
      'counterEvidenceRefs',
    );
    supportingKeys.forEach((key) => {
      if (counterKeys.has(key)) {
        fail(path, `evidence cannot be both supporting and counter: ${key}`);
      }
    });

  });

  conclusions.forEach((conclusion) => {
    if (
      EVIDENCE_RULE_KINDS.has(conclusion.kind) &&
      !rulesByConclusion.has(conclusion.conclusionId)
    ) {
      fail(
        'evidenceRules',
        `missing EvidenceRule for conclusion: ${conclusion.conclusionId}`,
      );
    }
  });
}

export type PatientUnknownOnlyEvidenceFlag = {
  conclusionRef: ConclusionId;
  code: 'ONLY_PATIENT_UNKNOWN_REQUIRED_EVIDENCE';
};

export function findPatientUnknownOnlyEvidenceFlags(
  evaluator: EvaluatorViewV2,
  runtime: PatientRuntimeViewV2,
): PatientUnknownOnlyEvidenceFlag[] {
  const { facts } = collectRuntimeIndex(runtime);
  return evaluator.evidenceRules.flatMap((rule) => {
    const leaves = expressionLeaves(rule.requiredEvidence);
    const onlyPatientUnknown = leaves.every(
      (leaf) =>
        leaf.operator === 'fact' &&
        facts.get(leaf.factRef) === 'patient_unknown',
    );
    return onlyPatientUnknown
      ? [
          {
            conclusionRef: rule.conclusionRef,
            code: 'ONLY_PATIENT_UNKNOWN_REQUIRED_EVIDENCE' as const,
          },
        ]
      : [];
  });
}

export function validateEvaluatorViewV2(
  input: unknown,
  runtime: PatientRuntimeViewV2,
): EvaluatorViewV2 {
  const source = asRecord(input, 'evaluatorView');
  if (source.schemaVersion !== '2.0') {
    fail('schemaVersion', 'must be 2.0');
  }
  const incidenceSource = asRecord(source.incidence, 'incidence');
  const prmSource = asRecord(source.prm, 'prm');

  const evaluator: EvaluatorViewV2 = {
    schemaVersion: '2.0',
    caseVersionId: validateCaseVersionId(source.caseVersionId),
    versions: parseVersions(source.versions),
    carePath: parseCarePath(source.carePath),
    incidence: {
      assessment: parseAssessment(
        incidenceSource.assessment,
        'incidence_assessment',
        'incidence.assessment',
      ) as IncidenceAssessment,
      findings: asArray(incidenceSource.findings, 'incidence.findings').map(
        (item, index) =>
          parseIncidenceFinding(item, `incidence.findings[${index}]`),
      ),
      followUpEpisodes: asArray(
        incidenceSource.followUpEpisodes,
        'incidence.followUpEpisodes',
      ).map((item, index) =>
        parseFollowUpEpisode(item, `incidence.followUpEpisodes[${index}]`),
      ),
    },
    prm: {
      assessment: parseAssessment(
        prmSource.assessment,
        'prm_assessment',
        'prm.assessment',
      ) as PrmAssessment,
      findings: asArray(prmSource.findings, 'prm.findings').map((item, index) =>
        parsePrmFinding(item, `prm.findings[${index}]`),
      ),
    },
    rnmAssessments: asArray(source.rnmAssessments, 'rnmAssessments').map(
      (item, index) => parseRnmAssessment(item, `rnmAssessments[${index}]`),
    ),
    prmRnmRelations: asArray(
      source.prmRnmRelations,
      'prmRnmRelations',
    ).map((item, index) =>
      parsePrmRnmRelation(item, `prmRnmRelations[${index}]`),
    ),
    evidenceRules: asArray(source.evidenceRules, 'evidenceRules').map(
      parseEvidenceRule,
    ),
  };

  validateCrossReferences(evaluator, runtime);
  return evaluator;
}
