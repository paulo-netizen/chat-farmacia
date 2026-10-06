import { z } from 'zod';
import { reportBindingSchema, reportSourceSpanSchema, referralReportContextSchema } from './referral-report-contract';
import { followUpStudentSpanSchema } from './follow-up-plan-contract';

const id = z.string().min(1).refine(value => value.trim() === value);
const digest = z.string().regex(/^[0-9a-f]{64}$/);
const span = followUpStudentSpanSchema;
const element = z.discriminatedUnion('aspect', [
  z.object({ requirementId: id, aspect: z.literal('ADAPTATION'), expected: z.string().trim().min(1) }).strict(),
  z.object({ requirementId: id, aspect: z.literal('FEASIBILITY'), expected: z.string().trim().min(1) }).strict(),
  z.object({ requirementId: id, aspect: z.literal('RESPONSE_TO_DIFFICULTY'), expected: z.string().trim().min(1),
    appliesWhen: z.literal('DIFFICULTY_EXPRESSED'),
  }).strict(),
]);
export const personalizationRequirementsSchema = z.object({
  contractVersion: z.literal('personalization-requirements/1'), binding: reportBindingSchema,
  requirementsVersion: id, approvalRef: id,
  configuration: z.discriminatedUnion('applicability', [
    z.object({ applicability: z.literal('NOT_APPLICABLE'), elements: z.tuple([]) }).strict(),
    z.object({ applicability: z.literal('APPLICABLE'), elements: z.array(element).min(1)
      .refine(items => new Set(items.map(item => item.requirementId)).size === items.length),
    }).strict(),
  ]),
}).strict();
export const personalizationContextSchema = z.object({
  contractVersion: z.literal('personalization-context/1'), binding: reportBindingSchema,
  opportunity: z.enum(['CONFIRMED', 'NOT_PROVIDED', 'UNKNOWN']),
  captureStatus: z.enum(['COMPLETE', 'INCOMPLETE', 'FAILED']),
  publicProfile: referralReportContextSchema.shape.publicProfile,
}).strict();

/** Role and chronological checks are performed against the bound transcript, not trusted from the provider. */
const linkSchema = z.object({
  linkId: id,
  // Required for demonstrated adaptation, not for independently assessing feasibility/response.
  circumstances: z.array(reportSourceSpanSchema),
  proposal: span,
  attribution: z.enum(['OWN_PROPOSAL', 'EXPLICIT_ADOPTION', 'QUOTATION']),
  patientProposal: span.optional(),
  standing: z.enum(['CURRENT', 'WITHDRAWN', 'UNCERTAIN']),
  withdrawal: span.optional(),
  feasibilityCheck: span.optional(),
  patientResponse: z.object({ kind: z.enum(['ACCEPTANCE', 'DIFFICULTY_OR_REJECTION', 'UNCERTAIN']), evidence: span }).strict().optional(),
  responseToDifficulty: z.object({ difficulty: span, response: span }).strict().optional(),
}).strict();
const criterionSchema = z.object({
  requirementId: id,
  status: z.enum(['DEMONSTRATED', 'NOT_DEMONSTRATED', 'INSUFFICIENT', 'CONTRADICTORY', 'UNCERTAIN', 'NOT_APPLICABLE']),
  // A single coherent chain, never a union of convenient fragments from different proposals.
  linkRef: id.nullable(), studentEvidence: z.array(span),
}).strict();
export const personalizationAdjudicationSchema = z.object({
  contractVersion: z.literal('personalization-adjudication/1'), requestDigest: digest,
  difficulty: z.object({ status: z.enum(['PRESENT', 'NOT_OBSERVED', 'UNCERTAIN']), evidence: z.array(span) }).strict(),
  links: z.array(linkSchema),
  incompatibilities: z.array(z.object({ first: id, second: id }).strict()),
  criteria: z.array(criterionSchema),
}).strict();
export type PersonalizationRequirementsV1 = z.infer<typeof personalizationRequirementsSchema>;
export type PersonalizationContextV1 = z.infer<typeof personalizationContextSchema>;
export type PersonalizationAdjudicationV1 = z.infer<typeof personalizationAdjudicationSchema>;
export type PersonalizationSpanV1 = z.infer<typeof span>;
export type PersonalizationRequestV1 = Readonly<{
  contractVersion: 'personalization-request/1'; instructionsVersion: 'personalization-instructions/2';
  instructions: string; requestDigest: string; runtimeRef: string;
  requirements: PersonalizationRequirementsV1;
  untrustedData: Readonly<{
    context: PersonalizationContextV1;
    messages: import('./spfa-session-evidence-types').SessionTranscriptSnapshotV2['messages'];
  }>;
}>;
export type PersonalizationRuntimeV1 = Readonly<{
  runtimeRef: string; adjudicate(request: PersonalizationRequestV1): Promise<unknown>;
}>;
export type PersonalizationEvaluationV1 = Readonly<{
  contractVersion: 'personalization-evaluation/1'; binding: PersonalizationRequirementsV1['binding'];
  requirementsVersion: string; approvalRef: string; sourceDigest: string;
  requestDigest?: string; runtimeRef?: string; captureStatus: PersonalizationContextV1['captureStatus'];
  audience: 'TEACHER_REVIEW_ONLY'; validation: 'STRUCTURAL_ONLY'; semanticAcceptance: 'PENDING';
  status: 'REVIEW_REQUIRED' | 'NOT_APPLICABLE' | 'TECHNICAL_FAILURE';
  reason: 'ADJUDICATED' | 'CASE_NOT_APPLICABLE' | 'CAPTURE_FAILED' | 'RUNTIME_FAILED' | 'INVALID_ADJUDICATION';
  difficulty: PersonalizationAdjudicationV1['difficulty'] | null;
  criteria: PersonalizationAdjudicationV1['criteria']; links: PersonalizationAdjudicationV1['links'];
  incompatibilities: PersonalizationAdjudicationV1['incompatibilities'];
}>;

/** V1 remains available for interpreting historical results; no implicit upgrade. */
export const personalizationAdjudicationSchemaV2 = personalizationAdjudicationSchema.extend({
  contractVersion: z.literal('personalization-adjudication/2'),
}).strict();
export type PersonalizationRequestV2 = Omit<PersonalizationRequestV1, 'contractVersion' | 'instructionsVersion'> & {
  contractVersion: 'personalization-request/2'; instructionsVersion: 'personalization-instructions/3';
};
export type PersonalizationRuntimeV2 = Readonly<{
  runtimeRef: string; adjudicate(request: PersonalizationRequestV2): Promise<unknown>;
}>;
export type PersonalizationEvaluationV2 = Omit<PersonalizationEvaluationV1, 'contractVersion'> & {
  contractVersion: 'personalization-evaluation/2'; assessmentBasis: 'OBSERVED_PERFORMANCE';
};
