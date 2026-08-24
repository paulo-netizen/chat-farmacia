import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const opaqueReference = z.string().min(1);

const spontaneousAcquisition = z
  .object({ mode: z.literal('SPONTANEOUS') })
  .strict();
const elicitedAcquisition = z
  .object({
    mode: z.literal('ELICITED'),
    studentQuestionRef: opaqueReference,
  })
  .strict();

const patientStatementSupport = z
  .object({
    targetRef: opaqueReference,
    messageRef: opaqueReference,
    evidenceKind: z.literal('PATIENT_STATEMENT'),
    acquisition: z.discriminatedUnion('mode', [
      spontaneousAcquisition,
      elicitedAcquisition,
    ]),
  })
  .strict();

const patientConfirmationSupport = z
  .object({
    targetRef: opaqueReference,
    messageRef: opaqueReference,
    evidenceKind: z.literal('PATIENT_CONFIRMATION'),
    acquisition: elicitedAcquisition,
  })
  .strict();

const studentActionSupport = z
  .object({
    targetRef: opaqueReference,
    messageRef: opaqueReference,
    evidenceKind: z.literal('STUDENT_ACTION'),
  })
  .strict();

const semanticSupport = z.discriminatedUnion('evidenceKind', [
  patientStatementSupport,
  patientConfirmationSupport,
  studentActionSupport,
]);

const supportedDecision = z
  .object({
    targetRef: opaqueReference,
    status: z.literal('SUPPORTED'),
    supports: z.array(semanticSupport).min(1),
  })
  .strict();

function unsupportedDecision(status: 'NOT_SUPPORTED' | 'UNCERTAIN') {
  return z
    .object({
      targetRef: opaqueReference,
      status: z.literal(status),
      supports: z.array(semanticSupport).length(0),
    })
    .strict();
}

const semanticDecision = z.discriminatedUnion('status', [
  supportedDecision,
  unsupportedDecision('NOT_SUPPORTED'),
  unsupportedDecision('UNCERTAIN'),
]);

export const OpenAiSpfaSemanticAdjudicationTransportSchemaV1 = z
  .object({
    contractVersion: z.literal(
      'openai-spfa-semantic-adjudication-output/1',
    ),
    decisions: z.array(semanticDecision),
  })
  .strict();

export type OpenAiSpfaSemanticAdjudicationTransportV1 = z.infer<
  typeof OpenAiSpfaSemanticAdjudicationTransportSchemaV1
>;

export const OPENAI_SPFA_SEMANTIC_ADJUDICATION_TEXT_FORMAT_V1 = zodTextFormat(
  OpenAiSpfaSemanticAdjudicationTransportSchemaV1,
  'chatusal_spfa_semantic_adjudication_v1',
);

export class OpenAiSpfaSemanticAdjudicationBoundaryErrorV1 extends Error {
  constructor(
    public readonly code:
      | 'invalid_openai_spfa_semantic_adjudication_transport'
      | 'openai_spfa_semantic_adjudication_params_build_failed',
    public readonly path: string,
    message: string,
    public readonly cause: unknown,
  ) {
    super(`${code} at ${path}: ${message}`);
    this.name = 'OpenAiSpfaSemanticAdjudicationBoundaryErrorV1';
  }
}

function zodPath(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue === undefined || issue.path.length === 0
    ? 'semanticAdjudicationOutput'
    : `semanticAdjudicationOutput.${issue.path.join('.')}`;
}

export function parseOpenAiSpfaSemanticAdjudicationTransportV1(
  input: unknown,
): OpenAiSpfaSemanticAdjudicationTransportV1 {
  const parsed = OpenAiSpfaSemanticAdjudicationTransportSchemaV1.safeParse(input);
  if (!parsed.success) {
    throw new OpenAiSpfaSemanticAdjudicationBoundaryErrorV1(
      'invalid_openai_spfa_semantic_adjudication_transport',
      zodPath(parsed.error),
      'the SPFA semantic adjudication transport is invalid',
      parsed.error,
    );
  }
  return structuredClone(parsed.data);
}
