import { z } from 'zod';
import { reportAdjudicationSchema } from './referral-report-contract';
import { followUpAdjudicationSchema } from './follow-up-plan-contract';
import { personalizationAdjudicationSchemaV2 } from './personalization-contract';
import { reportLiteralCitationSchema, resolveReportCitation } from './report-citations';
import { CovDiagnosticError } from './cov-diagnostics';
import type { CovRequest } from './cov-semantic-runtime';

// Value checks belong to the safe resolver; no provider values or Zod paths escape in errors.
const literal = z.object({ quote: z.string(), occurrence: z.number().nullable() }).strict();
const message = literal.extend({ messageId: z.string() }).strict();
const source = z.discriminatedUnion('source', [
  message.extend({ source: z.literal('TRANSCRIPT') }).strict(),
  literal.extend({ source: z.literal('PUBLIC'), field: z.enum(['nombre', 'edad', 'sexo', 'tratamiento']) }).strict(),
]);
const report = reportAdjudicationSchema;
const follow = followUpAdjudicationSchema;
const personal = personalizationAdjudicationSchemaV2;
const link = personal.shape.links.element;
export const covSourceSchemas = {
  COV1: report.extend({ contractVersion: z.literal('referral-report-sources-adjudication/3'),
    criteria: z.array(report.shape.criteria.element.extend({ reportEvidence: z.array(reportLiteralCitationSchema), sourceEvidence: z.array(source) }).strict()),
    claims: z.array(report.shape.claims.element.extend({ reportEvidence: reportLiteralCitationSchema, sourceEvidence: z.array(source) }).strict()),
  }).strict(),
  COV2: follow.extend({ contractVersion: z.literal('follow-up-plan-sources-adjudication/2'),
    planEvidence: z.array(message),
    criteria: z.array(follow.shape.criteria.element.extend({ studentEvidence: z.array(message), contextEvidence: z.array(source) }).strict()),
    relations: z.array(follow.shape.relations.element.extend({ earlier: message, later: message }).strict()),
  }).strict(),
  COV3: personal.extend({ contractVersion: z.literal('personalization-sources-adjudication/3'),
    difficulty: personal.shape.difficulty.extend({ evidence: z.array(message) }).strict(),
    criteria: z.array(personal.shape.criteria.element.extend({ studentEvidence: z.array(message) }).strict()),
    links: z.array(link.extend({ circumstances: z.array(source), proposal: message,
      patientProposal: message.nullable(), withdrawal: message.nullable(), feasibilityCheck: message.nullable(),
      patientResponse: link.shape.patientResponse.unwrap().extend({ evidence: message }).strict().nullable(),
      responseToDifficulty: z.object({ difficulty: message, response: message }).strict().nullable(),
    }).strict()),
  }).strict(),
};

export function validateSourceSpan(span: { start: number; end: number; quote: string }, text: string): void {
  if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < 0 || span.start >= span.end) throw new CovDiagnosticError('SOURCE_CITATION_RANGE_INVALID');
  if (span.end > text.length) throw new CovDiagnosticError('SOURCE_CITATION_OUT_OF_BOUNDS');
  if (text.slice(span.start, span.end) !== span.quote) throw new CovDiagnosticError('SOURCE_CITATION_TEXT_MISMATCH');
}
export function resolveSourceLiteral(citation: z.infer<typeof literal>, text: string) {
  if (!citation.quote.length) throw new CovDiagnosticError('SOURCE_CITATION_EMPTY');
  if (citation.occurrence !== null && (!Number.isSafeInteger(citation.occurrence) || citation.occurrence < 1)) throw new CovDiagnosticError('SOURCE_CITATION_OCCURRENCE_INVALID');
  const positions: number[] = [];
  for (let at = text.indexOf(citation.quote); at !== -1; at = text.indexOf(citation.quote, at + 1)) positions.push(at);
  if (!positions.length) throw new CovDiagnosticError('SOURCE_CITATION_TEXT_NOT_FOUND');
  if (citation.occurrence === null && positions.length !== 1) throw new CovDiagnosticError('SOURCE_CITATION_AMBIGUOUS');
  const start = positions[(citation.occurrence ?? 1) - 1];
  if (start === undefined) throw new CovDiagnosticError('SOURCE_CITATION_OCCURRENCE_INVALID');
  const span = { start, end: start + citation.quote.length, quote: citation.quote };
  validateSourceSpan(span, text); return span;
}
/** Resolve only the named source of the frozen request; roles/sequence are not provider-owned. */
export function adaptCovSources(capability: keyof typeof covSourceSchemas, value: unknown, q: CovRequest) {
  const messages = q.untrustedData.messages;
  const publicProfile = q.contractVersion === 'referral-report-request/1' ? q.untrustedData.publicProfile : q.untrustedData.context.publicProfile;
  const msg = (c: z.infer<typeof message>, role?: 'student' | 'patient') => {
    const matches = messages.filter(m => m.messageId === c.messageId);
    if (matches.length !== 1) throw new CovDiagnosticError('SOURCE_REFERENCE_NOT_FOUND');
    if (role && matches[0].role !== role) throw new CovDiagnosticError('SOURCE_ROLE_INVALID');
    return { messageId: c.messageId, ...resolveSourceLiteral(c, matches[0].content) };
  };
  const src = (c: z.infer<typeof source>, role?: 'student' | 'patient') => c.source === 'TRANSCRIPT'
    ? { source: 'TRANSCRIPT' as const, ...msg(c, role) }
    : { source: 'PUBLIC' as const, field: c.field, ...resolveSourceLiteral(c, String(publicProfile[c.field])) };
  if (capability === 'COV1' && q.contractVersion === 'referral-report-request/1') {
    const r = covSourceSchemas.COV1.parse(value);
    return { ...r, contractVersion: 'referral-report-adjudication/1' as const,
      criteria: r.criteria.map(c => ({ ...c, reportEvidence: c.reportEvidence.map(e => resolveReportCitation(e, q.untrustedData.reportText)), sourceEvidence: c.sourceEvidence.map(e => src(e)) })),
      claims: r.claims.map(c => ({ ...c, reportEvidence: resolveReportCitation(c.reportEvidence, q.untrustedData.reportText), sourceEvidence: c.sourceEvidence.map(e => src(e)) })) };
  }
  if (capability === 'COV2') {
    const r = covSourceSchemas.COV2.parse(value);
    return { ...r, contractVersion: 'follow-up-plan-adjudication/1' as const, planEvidence: r.planEvidence.map(e => msg(e, 'student')),
      criteria: r.criteria.map(c => ({ ...c, studentEvidence: c.studentEvidence.map(e => msg(e, 'student')), contextEvidence: c.contextEvidence.map(e => src(e, 'patient')) })),
      relations: r.relations.map(e => ({ ...e, earlier: msg(e.earlier, 'student'), later: msg(e.later, 'student') })) };
  }
  if (capability === 'COV3') {
    const r = covSourceSchemas.COV3.parse(value);
    return { ...r, contractVersion: 'personalization-adjudication/2' as const,
      difficulty: { ...r.difficulty, evidence: r.difficulty.evidence.map(e => msg(e, 'patient')) },
      criteria: r.criteria.map(c => ({ ...c, studentEvidence: c.studentEvidence.map(e => msg(e, 'student')) })),
      links: r.links.map(l => ({ ...l, circumstances: l.circumstances.map(e => src(e, 'patient')), proposal: msg(l.proposal, 'student'),
        patientProposal: l.patientProposal === null ? undefined : msg(l.patientProposal, 'patient'),
        withdrawal: l.withdrawal === null ? undefined : msg(l.withdrawal, 'student'),
        feasibilityCheck: l.feasibilityCheck === null ? undefined : msg(l.feasibilityCheck, 'student'),
        patientResponse: l.patientResponse === null ? undefined : { ...l.patientResponse, evidence: msg(l.patientResponse.evidence, 'patient') },
        responseToDifficulty: l.responseToDifficulty === null ? undefined : { difficulty: msg(l.responseToDifficulty.difficulty, 'patient'), response: msg(l.responseToDifficulty.response, 'student') },
      })) };
  }
  throw new CovDiagnosticError('REQUEST_INVALID');
}
