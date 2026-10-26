import { z } from 'zod';
import { nativeAuthoringSchema, typedRequirementSchema, gradableQuestionSchema } from './teacher-native-authoring';
import { createStudentCasePublicData } from '../student-session-dto';

export const TEACHER_DRAFT_FORMAT = 'TEACHER_CASE_DRAFT_V1' as const;
export const SPFA_2026_REFERENCE = {
  edition: 'FORO_AF_FC_2026',
  sha256: 'cf297b516c9134d064cd765c49d0b73d8168207120601669f4e6e73a94906387',
  protocolVersion: 'foro-2026-development/1',
} as const;
const text = z.string().trim().min(1, 'Completa este campo.').max(4000, 'Máximo 4000 caracteres.');
const ref = z.string().regex(/^F[1-9][0-9]{0,3}$/, 'Usa referencias F1, F2…');
const refs = z.array(ref).max(40).refine(a => new Set(a).size === a.length, 'No repitas referencias.');
export const teacherDraftFieldsSchema = z.object({
  title: text.max(140),
  service: z.enum(['INDICATION', 'DISPENSATION']),
  identity: z.object({ nombre: text.max(100), edad: z.number().int().min(0).max(120), sexo: text.max(60) }).strict(),
  initialDemand: text,
  treatment: text,
  facts: z.array(z.object({ id: ref, label: text.max(160), value: text, disclosure: text }).strict()).min(1).max(40),
  adherence: z.object({
    conclusion: z.enum(['NOT_DETERMINABLE', 'NOT_APPLICABLE', 'REPORTED_NO_OMISSIONS', 'NON_ADHERENT']),
    period: text,
    evidence: text,
    factRefs: refs.refine(a => a.length > 0, 'Relaciona la evidencia con un hecho.'),
    interpretation: text,
  }).strict(),
  teacherSolution: text,
  nativeAuthoring: nativeAuthoringSchema.optional(),
  requirements: z.array(z.object({
    label: text.max(160), goal: text,
    applicability: z.enum(['APPLICABLE', 'NOT_APPLICABLE', 'UNDETERMINED']),
    rationale: text, factRefs: refs, guidePages: text.max(100),
    native: typedRequirementSchema.optional(),
  }).strict()).min(1).max(30),
  questionnaire: z.array(z.object({ question: text, answer: text, factRefs: refs, gradable:gradableQuestionSchema.optional() }).strict()).min(1).max(30),
}).strict().superRefine((d, ctx) => {
  const ids = new Set(d.facts.map(f => f.id));
  if (ids.size !== d.facts.length) ctx.addIssue({ code: 'custom', path: ['facts'], message: 'Cada hecho debe tener una referencia diferente.' });
  const groups = [d.adherence.factRefs, ...d.requirements.map(r => r.factRefs), ...d.questionnaire.map(q => q.factRefs),d.nativeAuthoring?.rnm?.factRefs??[],d.nativeAuthoring?.referral&&'factRefs' in d.nativeAuthoring.referral?d.nativeAuthoring.referral.factRefs:[]];
  if (groups.some(g => g.some(r => !ids.has(r)))) ctx.addIssue({ code: 'custom', path: ['facts'], message: 'Hay referencias a hechos que no existen. Corrige las referencias antes de guardar.' });
  if (d.requirements.some(r => r.applicability === 'APPLICABLE' && !r.factRefs.length)) ctx.addIssue({ code: 'custom', path: ['requirements'], message: 'Relaciona cada requisito aplicable con al menos un hecho.' });
});
export type TeacherDraftFields = z.infer<typeof teacherDraftFieldsSchema>;
export type TeacherDraftTemplateId = 'lucia' | 'maria';
export const templateIdSchema = z.enum(['lucia', 'maria']);
export const caseVersionIdSchema = z.string().regex(/^casever_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export type TeacherDraftRecord = {
  caseId: string; versionId: string; revision: number; status: 'TEACHER_DRAFT';
  templateId: TeacherDraftTemplateId; fields: TeacherDraftFields;
};
export function studentDraftPreview(fields: TeacherDraftFields) {
  return createStudentCasePublicData(fields.identity);
}
export const adherenceLabels: Record<TeacherDraftFields['adherence']['conclusion'], string> = {
  NOT_DETERMINABLE: 'No determinable con la evidencia disponible',
  NOT_APPLICABLE: 'No aplicable (justificar)',
  REPORTED_NO_OMISSIONS: 'Sin omisiones referidas; no demuestra adherencia global',
  NON_ADHERENT: 'Falta de adherencia sustentada en hechos',
};
