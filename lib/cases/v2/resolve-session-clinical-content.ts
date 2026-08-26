import { createStudentCasePublicData } from '../student-session-dto';
import { attachSpfaProtocolSetToGeneratedCaseCoreV2 } from './attach-spfa-protocol-set';
import { createPatientRuntimeViewV2 } from './patient-runtime';
import type {
  GeneratedSessionServiceContextV2,
  LegacySessionEvaluatorDataV2,
  LegacySessionPatientDataV2,
  SessionClinicalCaseVersionContentInputV2,
  SessionClinicalContentErrorCodeV2,
  SessionEvaluatorClinicalContentV2,
  SessionPatientClinicalContentV2,
} from './session-clinical-content-types';
import { SessionClinicalContentErrorV2 } from './session-clinical-content-types';
import type { SpfaIntegratedGeneratedCaseCoreV2 } from './spfa-protocol-set-types';
import type {
  CasePatientFactsDraftV2,
  CaseVersionId,
  PatientRuntimeViewV2,
} from './types';
import {
  validateCasePatientFactsDraftV2,
  validateCaseVersionId,
} from './validate-patient-facts';
import { validateEvaluatorViewV2 } from './validate-evaluator-view';

type RecordValue = Record<string, unknown>;

function fail(code: SessionClinicalContentErrorCodeV2, path: string): never {
  throw new SessionClinicalContentErrorV2(code, path);
}

function record(value: unknown, path: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('invalid_case_version_content', path);
  }
  return value as RecordValue;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('invalid_case_version_content', path);
  }
  return value;
}

function optionalString(
  source: RecordValue,
  field: string,
  path: string,
): string | undefined {
  const value = source[field];
  return value === undefined ? undefined : requiredString(value, `${path}.${field}`);
}

function optionalStringArray(
  source: RecordValue,
  field: string,
  path: string,
): readonly string[] | undefined {
  const value = source[field];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) fail('invalid_case_version_content', `${path}.${field}`);
  return value.map((item, index) =>
    requiredString(item, `${path}.${field}[${index}]`),
  );
}

function validateInput(input: SessionClinicalCaseVersionContentInputV2): {
  caseId: number;
  caseVersionId: CaseVersionId;
  content: RecordValue;
} {
  if (!Number.isSafeInteger(input.caseId) || (input.caseId as number) <= 0) {
    fail('invalid_input', 'caseId');
  }
  let caseVersionId: CaseVersionId;
  try {
    caseVersionId = validateCaseVersionId(input.caseVersionId);
  } catch {
    fail('invalid_input', 'caseVersionId');
  }
  if (
    input.contentFormat !== 'LEGACY_V1_SNAPSHOT' &&
    input.contentFormat !== 'GENERATED_CASE_BUNDLE_V2'
  ) {
    fail('unsupported_content_format', 'contentFormat');
  }
  return {
    caseId: input.caseId as number,
    caseVersionId,
    content: record(input.content, 'content'),
  };
}

function validateLegacyEnvelope(
  input: SessionClinicalCaseVersionContentInputV2,
  validated: ReturnType<typeof validateInput>,
): { spec: RecordValue; groundTruth: RecordValue; serviceType: string } {
  if (input.sourceKind !== 'LEGACY_V1' || input.contentFormat !== 'LEGACY_V1_SNAPSHOT') {
    fail('source_format_mismatch', 'sourceKind');
  }
  if (input.legacyStatus !== 'approved' && input.legacyStatus !== 'rejected') {
    fail('source_format_mismatch', 'legacyStatus');
  }
  const content = validated.content;
  if (content.snapshotBasis !== 'migration_time_current_row') {
    fail('invalid_case_version_content', 'content.snapshotBasis');
  }
  if (content.legacyCaseId !== validated.caseId) {
    fail('case_version_identity_mismatch', 'content.legacyCaseId');
  }
  if (content.legacyStatus !== input.legacyStatus) {
    fail('case_version_identity_mismatch', 'content.legacyStatus');
  }
  return {
    spec: record(content.spec, 'content.spec'),
    groundTruth: record(content.groundTruth, 'content.groundTruth'),
    serviceType: requiredString(content.serviceType, 'content.serviceType'),
  };
}

function assertIdentity(value: unknown, expected: CaseVersionId, path: string): void {
  if (value !== expected) fail('case_version_identity_mismatch', path);
}

function generatedRecords(
  input: SessionClinicalCaseVersionContentInputV2,
  validated: ReturnType<typeof validateInput>,
): {
  patientFacts: RecordValue;
  evaluator: RecordValue;
  spfaProtocolSet: RecordValue;
  persistedRuntime: RecordValue;
} {
  if (
    input.sourceKind !== 'AI_GENERATED' ||
    input.contentFormat !== 'GENERATED_CASE_BUNDLE_V2' ||
    input.legacyStatus !== null
  ) {
    fail('source_format_mismatch', 'sourceKind');
  }
  const content = validated.content;
  if (content.schemaVersion !== '2.0') {
    fail('invalid_case_version_content', 'content.schemaVersion');
  }
  const source = record(content.sourceOfTruth, 'content.sourceOfTruth');
  const derived = record(content.derived, 'content.derived');
  const patientFacts = record(source.patientFacts, 'content.sourceOfTruth.patientFacts');
  const evaluator = record(source.evaluator, 'content.sourceOfTruth.evaluator');
  const spfaProtocolSet = record(
    source.spfaProtocolSet,
    'content.sourceOfTruth.spfaProtocolSet',
  );
  const persistedRuntime = record(derived.patientRuntime, 'content.derived.patientRuntime');
  const summary = record(derived.teachingSummary, 'content.derived.teachingSummary');
  const compliance = record(derived.complianceReport, 'content.derived.complianceReport');
  const identities: readonly [unknown, string][] = [
    [source.caseVersionId, 'content.sourceOfTruth.caseVersionId'],
    [patientFacts.caseVersionId, 'content.sourceOfTruth.patientFacts.caseVersionId'],
    [evaluator.caseVersionId, 'content.sourceOfTruth.evaluator.caseVersionId'],
    [persistedRuntime.caseVersionId, 'content.derived.patientRuntime.caseVersionId'],
    [summary.caseVersionId, 'content.derived.teachingSummary.caseVersionId'],
    [compliance.caseVersionId, 'content.derived.complianceReport.caseVersionId'],
  ];
  identities.forEach(([value, path]) =>
    assertIdentity(value, validated.caseVersionId, path),
  );
  return { patientFacts, evaluator, spfaProtocolSet, persistedRuntime };
}

function materiallyEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => materiallyEqual(item, right[index]))
    );
  }
  if (
    typeof left !== 'object' || left === null ||
    typeof right !== 'object' || right === null
  ) return false;
  const leftRecord = left as RecordValue;
  const rightRecord = right as RecordValue;
  const leftKeys = Object.keys(leftRecord).sort();
  const rightKeys = Object.keys(rightRecord).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) =>
      key === rightKeys[index] && materiallyEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

function canonicalRuntime(patientFacts: RecordValue, persisted: RecordValue): PatientRuntimeViewV2 {
  let runtime: PatientRuntimeViewV2;
  try {
    runtime = createPatientRuntimeViewV2(patientFacts);
  } catch {
    fail('patient_runtime_validation_failed', 'content.sourceOfTruth.patientFacts');
  }
  if (!materiallyEqual(runtime, persisted)) {
    fail('patient_runtime_validation_failed', 'content.derived.patientRuntime');
  }
  return runtime;
}

function canonicalPatientFacts(
  input: RecordValue,
): CasePatientFactsDraftV2 {
  try {
    return validateCasePatientFactsDraftV2(input);
  } catch {
    fail(
      'spfa_runtime_validation_failed',
      'content.sourceOfTruth.patientFacts',
    );
  }
}

function validatedEvaluator(
  input: RecordValue,
  runtime: PatientRuntimeViewV2,
) {
  try {
    return validateEvaluatorViewV2(input, runtime);
  } catch {
    fail('evaluator_runtime_validation_failed', 'content.sourceOfTruth.evaluator');
  }
}

function serviceContext(evaluator: ReturnType<typeof validateEvaluatorViewV2>): GeneratedSessionServiceContextV2 {
  const project = (spfa: typeof evaluator.carePath.initialSpfa) => ({
    service: spfa.value.service,
    ...(spfa.value.subtype === undefined ? {} : { subtype: spfa.value.subtype }),
  });
  return {
    initialSpfa: project(evaluator.carePath.initialSpfa),
    additionalSpfas: evaluator.carePath.additionalSpfas.map(project),
  };
}

export function resolveSessionPatientClinicalContentV2(
  input: SessionClinicalCaseVersionContentInputV2,
): SessionPatientClinicalContentV2 {
  const validated = validateInput(input);
  if (input.contentFormat === 'LEGACY_V1_SNAPSHOT') {
    const legacy = validateLegacyEnvelope(input, validated);
    let publicData;
    try {
      publicData = createStudentCasePublicData(legacy.spec);
    } catch {
      fail('invalid_case_version_content', 'content.spec');
    }
    const patientData: LegacySessionPatientDataV2 = {
      ...publicData,
      ...copyOptionalStrings(legacy.spec, [
        'motivo_consulta', 'antecedentes', 'contexto', 'descripcion_paciente',
      ], 'content.spec'),
      ...copyOptionalStrings(legacy.groundTruth, ['personalidad_paciente'], 'content.groundTruth'),
    };
    return {
      contentFormat: 'LEGACY_V1_SNAPSHOT',
      patientData,
      serviceContext: { serviceType: legacy.serviceType },
    };
  }
  const generated = generatedRecords(input, validated);
  const runtime = canonicalRuntime(generated.patientFacts, generated.persistedRuntime);
  const evaluator = validatedEvaluator(generated.evaluator, runtime);
  return {
    contentFormat: 'GENERATED_CASE_BUNDLE_V2',
    patientRuntime: runtime,
    serviceContext: serviceContext(evaluator),
  };
}

function copyOptionalStrings(
  source: RecordValue,
  fields: readonly string[],
  path: string,
): Record<string, string> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = optionalString(source, field, path);
      return value === undefined ? [] : [[field, value]];
    }),
  );
}

export function resolveSessionEvaluatorClinicalContentV2(
  input: SessionClinicalCaseVersionContentInputV2,
): SessionEvaluatorClinicalContentV2 {
  const validated = validateInput(input);
  if (input.contentFormat === 'LEGACY_V1_SNAPSHOT') {
    const legacy = validateLegacyEnvelope(input, validated);
    const evaluator: LegacySessionEvaluatorDataV2 = {
      ...copyOptionalStrings(legacy.groundTruth, [
        'diagnostico_principal', 'problema_farmacoterapeutico',
        'tipo_no_adherencia', 'barrera_principal',
      ], 'content.groundTruth'),
      ...copyOptionalArrays(legacy.groundTruth, [
        'otras_barreras', 'intervenciones_recomendadas',
        'intervenciones_validas', 'objetivos_aprendizaje',
      ], 'content.groundTruth'),
    };
    return { contentFormat: 'LEGACY_V1_SNAPSHOT', evaluator };
  }
  const generated = generatedRecords(input, validated);
  const runtime = canonicalRuntime(generated.patientFacts, generated.persistedRuntime);
  return {
    contentFormat: 'GENERATED_CASE_BUNDLE_V2',
    evaluator: validatedEvaluator(generated.evaluator, runtime),
  };
}

export function resolveSessionSpfaClinicalContentV2(
  input: SessionClinicalCaseVersionContentInputV2,
): SpfaIntegratedGeneratedCaseCoreV2 {
  const validated = validateInput(input);
  if (input.contentFormat !== 'GENERATED_CASE_BUNDLE_V2') {
    fail('spfa_evaluation_not_available', 'contentFormat');
  }

  const generated = generatedRecords(input, validated);
  const patientFacts = canonicalPatientFacts(generated.patientFacts);
  const runtime = canonicalRuntime(generated.patientFacts, generated.persistedRuntime);
  const evaluator = validatedEvaluator(generated.evaluator, runtime);

  try {
    return attachSpfaProtocolSetToGeneratedCaseCoreV2(
      {
        caseVersionId: validated.caseVersionId,
        patientFacts,
        evaluator,
      },
      generated.spfaProtocolSet,
    );
  } catch {
    fail(
      'spfa_runtime_validation_failed',
      'content.sourceOfTruth.spfaProtocolSet',
    );
  }
}

function copyOptionalArrays(
  source: RecordValue,
  fields: readonly string[],
  path: string,
): Record<string, readonly string[]> {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const value = optionalStringArray(source, field, path);
      return value === undefined ? [] : [[field, value]];
    }),
  );
}
