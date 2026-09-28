import { z } from 'zod';
import { reportBindingSchema, reportSpanSchema, reportSourceSpanSchema, referralReportContextSchema } from './referral-report-contract';

const id = z.string().min(1).refine(value => value.trim() === value && value.length > 0);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const requirementBase = { requirementId: id, expected: z.string().trim().min(1) };
const requirementSchema = z.discriminatedUnion('aspect', [
  z.object({ ...requirementBase, aspect: z.literal('WHAT_TO_REVIEW') }).strict(),
  z.object({ ...requirementBase, aspect: z.literal('ACTOR') }).strict(),
  z.object({ ...requirementBase, aspect: z.literal('EVOLUTION_ACTION') }).strict(),
  z.object({ ...requirementBase, aspect: z.literal('REVIEW_TRIGGER'),
    allowedForms: z.array(z.enum(['TIME', 'CONDITION'])).min(1)
      .refine(items => new Set(items).size === items.length),
  }).strict(),
]);

/** Session-bound snapshot of teacher-owned requirements, not a student payload or FollowUpEpisode. */
export const followUpRequirementsSchema = z.object({
  contractVersion: z.literal('follow-up-plan-requirements/1'),
  binding: reportBindingSchema, approvalRef: id, requirementsVersion: id,
  configuration: z.discriminatedUnion('applicability', [
    z.object({ applicability: z.literal('NOT_APPLICABLE'), elements: z.tuple([]) }).strict(),
    z.object({ applicability: z.literal('APPLICABLE'), elements: z.array(requirementSchema).min(1)
      .refine(items => new Set(items.map(item => item.requirementId)).size === items.length),
    }).strict(),
  ]),
}).strict();

export const followUpContextSchema = z.object({
  contractVersion: z.literal('follow-up-plan-context/1'), binding: reportBindingSchema,
  opportunity: z.enum(['CONFIRMED', 'NOT_PROVIDED', 'UNKNOWN']),
  captureStatus: z.enum(['COMPLETE', 'INCOMPLETE', 'FAILED']),
  publicProfile: referralReportContextSchema.shape.publicProfile,
}).strict();

export const followUpStudentSpanSchema = reportSpanSchema.extend({ messageId: id }).strict();
const criterionSchema = z.object({
  requirementId: id,
  status: z.enum(['DEMONSTRATED', 'NOT_DEMONSTRATED', 'INSUFFICIENT', 'CONTRADICTORY', 'UNCERTAIN']),
  studentEvidence: z.array(followUpStudentSpanSchema),
  contextEvidence: z.array(reportSourceSpanSchema),
  // Observed forms are descriptive. Only configuration determines permitted alternatives.
  observedTriggerForms: z.array(z.enum(['TIME', 'CONDITION']))
    .refine(items => new Set(items).size === items.length),
}).strict();
const relationSchema = z.object({
  requirementId: id, kind: z.enum(['CONTRADICTION', 'EXPLICIT_RECTIFICATION']),
  earlier: followUpStudentSpanSchema, later: followUpStudentSpanSchema,
}).strict();
export const followUpAdjudicationSchema = z.object({
  contractVersion: z.literal('follow-up-plan-adjudication/1'), requestDigest: digest,
  planKind: z.enum(['CONCRETE_PLAN', 'GENERIC_INTENT', 'NO_EVIDENCE', 'UNCERTAIN']),
  planEvidence: z.array(followUpStudentSpanSchema),
  criteria: z.array(criterionSchema), relations: z.array(relationSchema),
}).strict();

export type FollowUpRequirementsV1 = z.infer<typeof followUpRequirementsSchema>;
export type FollowUpContextV1 = z.infer<typeof followUpContextSchema>;
export type FollowUpAdjudicationV1 = z.infer<typeof followUpAdjudicationSchema>;
export type FollowUpStudentSpanV1 = z.infer<typeof followUpStudentSpanSchema>;
export type FollowUpRequestV1 = Readonly<{
  contractVersion: 'follow-up-plan-request/1'; instructionsVersion: 'follow-up-plan-instructions/2';
  instructions: string; requestDigest: string; runtimeRef: string;
  requirements: FollowUpRequirementsV1;
  untrustedData: Readonly<{
    messages: import('./spfa-session-evidence-types').SessionTranscriptSnapshotV2['messages'];
    context: FollowUpContextV1;
  }>;
}>;
export type FollowUpRuntimeV1 = Readonly<{
  runtimeRef: string; adjudicate(request: FollowUpRequestV1): Promise<unknown>;
}>;
export type FollowUpEvaluationV1 = Readonly<{
  contractVersion: 'follow-up-plan-evaluation/1'; binding: FollowUpRequirementsV1['binding'];
  requirementsVersion: string; approvalRef: string; sourceDigest: string;
  requestDigest?: string; runtimeRef?: string;
  captureStatus: FollowUpContextV1['captureStatus'];
  audience: 'TEACHER_REVIEW_ONLY'; validation: 'STRUCTURAL_ONLY'; semanticAcceptance: 'PENDING';
  status: 'REVIEW_REQUIRED' | 'NOT_APPLICABLE' | 'NOT_DEMONSTRATED' | 'INSUFFICIENT' | 'TECHNICAL_FAILURE';
  reason: 'ADJUDICATED' | 'CASE_NOT_APPLICABLE' | 'NO_STUDENT_MESSAGES' | 'CAPTURE_FAILED'
    | 'RUNTIME_FAILED' | 'INVALID_ADJUDICATION';
  planKind: FollowUpAdjudicationV1['planKind'] | 'NOT_ASSESSED';
  criteria: FollowUpAdjudicationV1['criteria']; relations: FollowUpAdjudicationV1['relations'];
  evidenceTimeline: readonly FollowUpStudentSpanV1[];
}>;
