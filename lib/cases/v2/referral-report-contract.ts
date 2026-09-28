import { z } from 'zod';

const id = z.string().trim().min(1);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
export const reportBindingSchema = z.object({
  sessionId: z.string().uuid(),
  caseVersionId: id,
  transcriptFingerprint: z.object({
    algorithm: z.literal('sha256'),
    canonicalization: z.literal('session-transcript-v2/1'),
    value: digest,
  }).strict(),
}).strict();

/** Server intake distinguishes missing work from failed capture. Empty text is retained. */
export const referralReportSubmissionSchema = z.object({
  contractVersion: z.literal('referral-report-submission/1'),
  submissionId: id,
  binding: reportBindingSchema,
  delivery: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('SUBMITTED'), text: z.string() }).strict(),
    z.object({ kind: z.literal('INTENT_ONLY') }).strict(),
    z.object({ kind: z.literal('ABSENT') }).strict(),
    z.object({ kind: z.literal('CAPTURE_FAILED') }).strict(),
  ]),
}).strict();

/** Trusted server projection, never supplied as authority by a student client. */
export const referralReportContextSchema = z.object({
  contractVersion: z.literal('referral-report-context/1'),
  binding: reportBindingSchema,
  approvalRef: id,
  opportunity: z.enum(['CONFIRMED', 'NOT_PROVIDED', 'UNKNOWN']),
  transcriptCompleteness: z.enum(['COMPLETE', 'INCOMPLETE']),
  publicProfile: z.object({
    nombre: z.string(), edad: z.number().int().nonnegative(),
    sexo: z.string(), tratamiento: z.string(),
  }).strict(),
}).strict();

export const reportSpanSchema = z.object({
  start: z.number().int().nonnegative(), end: z.number().int().positive(),
  quote: z.string().min(1),
}).strict();
export const reportSourceSpanSchema = z.discriminatedUnion('source', [
  reportSpanSchema.extend({ source: z.literal('TRANSCRIPT'), messageId: id }).strict(),
  reportSpanSchema.extend({
    source: z.literal('PUBLIC'), field: z.enum(['nombre', 'edad', 'sexo', 'tratamiento']),
  }).strict(),
]);
const criterionSchema = z.object({
  contentId: id,
  status: z.enum(['DEMONSTRATED', 'NOT_DEMONSTRATED', 'INSUFFICIENT', 'CONTRADICTORY', 'UNCERTAIN']),
  reportEvidence: z.array(reportSpanSchema),
  sourceEvidence: z.array(reportSourceSpanSchema),
}).strict();
const claimSchema = z.object({
  status: z.enum(['SUPPORTED', 'UNSUPPORTED', 'CONTRADICTORY', 'UNCERTAIN']),
  reportEvidence: reportSpanSchema,
  sourceEvidence: z.array(reportSourceSpanSchema),
}).strict();
export const reportAdjudicationSchema = z.object({
  contractVersion: z.literal('referral-report-adjudication/1'),
  requestDigest: digest,
  documentKind: z.enum(['WRITTEN_REPORT', 'INTENT_ONLY', 'UNCERTAIN']),
  criteria: z.array(criterionSchema),
  claims: z.array(claimSchema),
}).strict();

export type ReferralReportSubmissionV1 = z.infer<typeof referralReportSubmissionSchema>;
export type ReferralReportContextV1 = z.infer<typeof referralReportContextSchema>;
export type ReferralReportAdjudicationV1 = z.infer<typeof reportAdjudicationSchema>;
export type ReportSpanV1 = z.infer<typeof reportSpanSchema>;
export type ReportSourceSpanV1 = z.infer<typeof reportSourceSpanSchema>;

export type ReferralReportRequestV1 = Readonly<{
  contractVersion: 'referral-report-request/1';
  instructionsVersion: 'referral-report-instructions/1';
  instructions: string;
  requestDigest: string;
  runtimeRef: string;
  binding: ReferralReportSubmissionV1['binding'];
  submissionId: string;
  approvalRef: string;
  untrustedData: Readonly<{
    reportText: string;
    requirements: readonly Readonly<{ contentId: string; content: string }>[];
    publicProfile: ReferralReportContextV1['publicProfile'];
    messages: import('./spfa-session-evidence-types').SessionTranscriptSnapshotV2['messages'];
    transcriptCompleteness: ReferralReportContextV1['transcriptCompleteness'];
    opportunity: ReferralReportContextV1['opportunity'];
  }>;
}>;

/** No provider is installed by COV1. Dependency identity is server-owned. */
export type ReferralReportRuntimeV1 = Readonly<{
  runtimeRef: string;
  adjudicate(request: ReferralReportRequestV1): Promise<unknown>;
}>;

export type ReferralReportEvaluationV1 = Readonly<{
  contractVersion: 'referral-report-evaluation/1';
  binding: ReferralReportSubmissionV1['binding'];
  submissionId: string;
  deliveryStatus: 'SUBMITTED' | 'EMPTY' | 'ABSENT' | 'INTENT_ONLY' | 'CAPTURE_FAILED';
  sourceDigest: string;
  requestDigest?: string;
  runtimeRef?: string;
  audience: 'TEACHER_REVIEW_ONLY';
  validation: 'STRUCTURAL_ONLY';
  semanticAcceptance: 'PENDING';
  status: 'REVIEW_REQUIRED' | 'NOT_APPLICABLE' | 'NOT_DEMONSTRATED' | 'INSUFFICIENT' | 'TECHNICAL_FAILURE';
  reason: 'ADJUDICATED' | 'CASE_NOT_APPLICABLE' | 'LEGACY_CONTENT_IDS_REQUIRED'
    | 'ABSENT' | 'EMPTY' | 'INTENT_ONLY' | 'DOCUMENT_UNCERTAIN' | 'CAPTURE_FAILED'
    | 'RUNTIME_FAILED' | 'INVALID_ADJUDICATION';
  criteria: ReferralReportAdjudicationV1['criteria'];
  claims: ReferralReportAdjudicationV1['claims'];
}>;
