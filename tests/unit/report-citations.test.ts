import { describe, expect, it } from 'vitest';
import { resolveReportCitation, validateReportSpan, adaptReportLiteralAdjudication } from '../../lib/cases/v2/report-citations';
import { covDiagnostic } from '../../lib/cases/v2/cov-diagnostics';

function failure(run: () => unknown, code: string) {
  try { run(); expect.fail('must reject'); } catch (error) {
    expect(covDiagnostic(error, 'RUNTIME_FAILURE')).toEqual({ version: 'cov-diagnostic/1', stage: 'VALIDATION', code });
    expect(String(error) + JSON.stringify(error)).not.toMatch(/clinical-secret|arbitrary-key/);
  }
}
describe('exact server-resolved report citations (synthetic, not the lost R2 response)', () => {
  it('derives unique UTF-16 offsets without changing accents, emoji, CRLF or spaces', () => {
    const text = 'Inicio 😀\r\n  Acción: revisión.\nFin';
    const quote = '😀\r\n  Acción: revisión.';
    const result = resolveReportCitation({ quote, occurrence: null }, text);
    expect(result).toEqual({ quote, start: 7, end: 7 + quote.length });
    expect(text.slice(result.start, result.end)).toBe(quote);
  });
  it('requires an ordinal for repeated quotes, including overlapping matches', () => {
    failure(() => resolveReportCitation({ quote: 'aa', occurrence: null }, 'aaaa'), 'REPORT_CITATION_AMBIGUOUS');
    expect(resolveReportCitation({ quote: 'aa', occurrence: 3 }, 'aaaa')).toEqual({ quote: 'aa', start: 2, end: 4 });
    failure(() => resolveReportCitation({ quote: 'aa', occurrence: 4 }, 'aaaa'), 'REPORT_CITATION_OCCURRENCE_INVALID');
  });
  it.each([
    ['clinical-secret', 'Texto'], ['Acción', 'Accio\u0301n'], ['a\nb', 'a\r\nb'], ['a b', 'a  b'],
  ])('rejects nonexistent or normalized quotes without exposing text', (quote, text) => {
    failure(() => resolveReportCitation({ quote, occurrence: null }, text), 'REPORT_CITATION_TEXT_NOT_FOUND');
  });
  it('rejects provider offsets explicitly instead of silently repairing them', () => {
    failure(() => resolveReportCitation({ quote: 'Texto', occurrence: null, start: 9, end: 10 } as never, 'Texto'), 'REPORT_CITATION_REPRESENTATION_INVALID');
  });
  it.each([
    [{ start: -1, end: 3, quote: 'clinical-secret' }, 'REPORT_CITATION_RANGE_INVALID'],
    [{ start: 2, end: 2, quote: 'clinical-secret' }, 'REPORT_CITATION_RANGE_INVALID'],
    [{ start: 2, end: 1, quote: 'clinical-secret' }, 'REPORT_CITATION_RANGE_INVALID'],
    [{ start: 0, end: 100, quote: 'clinical-secret' }, 'REPORT_CITATION_OUT_OF_BOUNDS'],
    [{ start: 0, end: 1, quote: 'clinical-secret' }, 'REPORT_CITATION_TEXT_MISMATCH'],
  ] as const)('diagnoses legacy ranges without correcting them', (span, code) => {
    failure(() => validateReportSpan(span, 'Texto'), code);
  });
  it('preserves every additional unsupported assertion and its exact report evidence', () => {
    const text = 'Refiere cansancio. Vive sola.';
    const adapted = adaptReportLiteralAdjudication({ contractVersion: 'referral-report-literal-adjudication/2',
      requestDigest: 'a'.repeat(64), documentKind: 'WRITTEN_REPORT', criteria: [], claims: [
        { status: 'SUPPORTED', reportEvidence: { quote: 'Refiere cansancio.', occurrence: null }, sourceEvidence: [] },
        { status: 'UNSUPPORTED', reportEvidence: { quote: 'Vive sola.', occurrence: null }, sourceEvidence: [] },
      ] }, text);
    expect(adapted.contractVersion).toBe('referral-report-adjudication/1');
    expect(adapted.claims.map(c => c.status)).toEqual(['SUPPORTED', 'UNSUPPORTED']);
    expect(adapted.claims[1].reportEvidence).toEqual({ quote: 'Vive sola.', start: 19, end: 29 });
    expect(text.slice(19, 29)).toBe('Vive sola.');
    // Resolving the span does not establish semantic support; the supplied status remains unchanged.
  });
});
