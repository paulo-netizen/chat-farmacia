import { z } from 'zod';
import { reportAdjudicationSchema, type ReportSpanV1 } from './referral-report-contract';
import { CovDiagnosticError } from './cov-diagnostics';

/** Explicit wire v2: provider never supplies report offsets. Ordinals are one-based. */
export const reportLiteralCitationSchema = z.object({ quote: z.string().min(1), occurrence: z.number().int().positive().nullable() }).strict();
export const reportLiteralAdjudicationSchema = reportAdjudicationSchema.extend({
  contractVersion: z.literal('referral-report-literal-adjudication/2'),
  criteria: z.array(reportAdjudicationSchema.shape.criteria.element.extend({ reportEvidence: z.array(reportLiteralCitationSchema) }).strict()),
  claims: z.array(reportAdjudicationSchema.shape.claims.element.extend({ reportEvidence: reportLiteralCitationSchema }).strict()),
}).strict();

/** Also used by the legacy domain validator; never repair contradictory supplied offsets. */
export function validateReportSpan(span: ReportSpanV1, text: string): void {
  if (!Number.isSafeInteger(span.start) || !Number.isSafeInteger(span.end) || span.start < 0 || span.start >= span.end)
    throw new CovDiagnosticError('REPORT_CITATION_RANGE_INVALID');
  if (span.end > text.length) throw new CovDiagnosticError('REPORT_CITATION_OUT_OF_BOUNDS');
  if (text.slice(span.start, span.end) !== span.quote) throw new CovDiagnosticError('REPORT_CITATION_TEXT_MISMATCH');
}
export function resolveReportCitation(citation: z.infer<typeof reportLiteralCitationSchema>, text: string): ReportSpanV1 {
  const parsed = reportLiteralCitationSchema.safeParse(citation);
  if (!parsed.success) throw new CovDiagnosticError('REPORT_CITATION_REPRESENTATION_INVALID');
  const { quote, occurrence } = parsed.data;
  const matches: number[] = [];
  for (let at = text.indexOf(quote); at !== -1; at = text.indexOf(quote, at + 1)) matches.push(at);
  if (!matches.length) throw new CovDiagnosticError('REPORT_CITATION_TEXT_NOT_FOUND');
  if (occurrence === null && matches.length !== 1) throw new CovDiagnosticError('REPORT_CITATION_AMBIGUOUS');
  const start = matches[(occurrence ?? 1) - 1];
  if (start === undefined) throw new CovDiagnosticError('REPORT_CITATION_OCCURRENCE_INVALID');
  const span = { start, end: start + quote.length, quote };
  validateReportSpan(span, text);
  return span;
}
export function adaptReportLiteralAdjudication(value: unknown, text: string) {
  const r = reportLiteralAdjudicationSchema.safeParse(value);
  if (!r.success) throw new CovDiagnosticError('REPORT_CITATION_REPRESENTATION_INVALID');
  return { ...r.data, contractVersion: 'referral-report-adjudication/1' as const,
    criteria: r.data.criteria.map(c => ({ ...c, reportEvidence: c.reportEvidence.map(e => resolveReportCitation(e, text)) })),
    claims: r.data.claims.map(c => ({ ...c, reportEvidence: resolveReportCitation(c.reportEvidence, text) })) };
}
