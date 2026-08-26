import type { StudentCasePublicData } from '../student-session-dto';
import type {
  DispensingSubtype,
  EvaluatorViewV2,
  SpfaService,
} from './evaluator-types';
import type { PatientRuntimeViewV2 } from './types';

export type SessionClinicalCaseVersionContentInputV2 = Readonly<{
  caseId: unknown;
  caseVersionId: unknown;
  sourceKind: unknown;
  legacyStatus: unknown;
  contentFormat: unknown;
  content: unknown;
}>;

export type SessionClinicalContentErrorCodeV2 =
  | 'invalid_input'
  | 'unsupported_content_format'
  | 'source_format_mismatch'
  | 'spfa_evaluation_not_available'
  | 'invalid_case_version_content'
  | 'case_version_identity_mismatch'
  | 'patient_runtime_validation_failed'
  | 'evaluator_runtime_validation_failed'
  | 'spfa_runtime_validation_failed';

export class SessionClinicalContentErrorV2 extends Error {
  constructor(
    public readonly code: SessionClinicalContentErrorCodeV2,
    public readonly path: string,
  ) {
    super(`${code} at ${path}`);
    this.name = 'SessionClinicalContentErrorV2';
  }
}

export type LegacySessionPatientDataV2 = Readonly<
  StudentCasePublicData & {
    motivo_consulta?: string;
    antecedentes?: string;
    contexto?: string;
    descripcion_paciente?: string;
    personalidad_paciente?: string;
  }
>;

export type LegacySessionEvaluatorDataV2 = Readonly<{
  diagnostico_principal?: string;
  problema_farmacoterapeutico?: string;
  tipo_no_adherencia?: string;
  barrera_principal?: string;
  otras_barreras?: readonly string[];
  intervenciones_recomendadas?: readonly string[];
  intervenciones_validas?: readonly string[];
  objetivos_aprendizaje?: readonly string[];
}>;

export type GeneratedSessionServiceV2 = Readonly<{
  service: SpfaService;
  subtype?: DispensingSubtype;
}>;

export type GeneratedSessionServiceContextV2 = Readonly<{
  initialSpfa: GeneratedSessionServiceV2;
  additionalSpfas: readonly GeneratedSessionServiceV2[];
}>;

export type LegacySessionPatientClinicalContentV2 = Readonly<{
  contentFormat: 'LEGACY_V1_SNAPSHOT';
  patientData: LegacySessionPatientDataV2;
  serviceContext: Readonly<{ serviceType: string }>;
}>;

export type GeneratedSessionPatientClinicalContentV2 = Readonly<{
  contentFormat: 'GENERATED_CASE_BUNDLE_V2';
  patientRuntime: PatientRuntimeViewV2;
  serviceContext: GeneratedSessionServiceContextV2;
}>;

export type SessionPatientClinicalContentV2 =
  | LegacySessionPatientClinicalContentV2
  | GeneratedSessionPatientClinicalContentV2;

export type LegacySessionEvaluatorClinicalContentV2 = Readonly<{
  contentFormat: 'LEGACY_V1_SNAPSHOT';
  evaluator: LegacySessionEvaluatorDataV2;
}>;

export type GeneratedSessionEvaluatorClinicalContentV2 = Readonly<{
  contentFormat: 'GENERATED_CASE_BUNDLE_V2';
  evaluator: EvaluatorViewV2;
}>;

export type SessionEvaluatorClinicalContentV2 =
  | LegacySessionEvaluatorClinicalContentV2
  | GeneratedSessionEvaluatorClinicalContentV2;
