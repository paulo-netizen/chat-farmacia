import { describe, expect, it } from 'vitest';
import { buildCalibrationFixtures } from '../../tools/cov-calibration/fixtures';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { evaluateReferralReportV1 } from '../../lib/cases/v2/evaluate-referral-report';
import { covDiagnostic, CovDiagnosticError, type CovDiagnosticCode } from '../../lib/cases/v2/cov-diagnostics';
import type { ReferralReportRequestV1, ReferralReportAdjudicationV1 } from '../../lib/cases/v2/referral-report-contract';

function fixture() {
  const f = buildCalibrationFixtures().find(f => f.id === 'R2');
  if (!f || f.capability !== 'COV1') throw new Error('TEST_FIXTURE');
  return f;
}
// Synthetic compliant response, NOT reconstruction of the discarded live R2 response.
function response(q: ReferralReportRequestV1): ReferralReportAdjudicationV1 {
  const message = q.untrustedData.messages[0];
  const source = { source: 'TRANSCRIPT' as const, messageId: message.messageId, start: 0, end: message.content.length, quote: message.content };
  const text = q.untrustedData.reportText;
  const end = text.indexOf('.') + 1;
  return { contractVersion: 'referral-report-adjudication/1', requestDigest: q.requestDigest, documentKind: 'WRITTEN_REPORT',
    criteria: [{ contentId: q.untrustedData.requirements[0].contentId, status: 'DEMONSTRATED', reportEvidence: [{ start: 0, end, quote: text.slice(0, end) }], sourceEvidence: [source] },
      { contentId: q.untrustedData.requirements[1].contentId, status: 'NOT_DEMONSTRATED', reportEvidence: [], sourceEvidence: [source] }],
    claims: [{ status: 'SUPPORTED', reportEvidence: { start: 0, end, quote: text.slice(0, end) }, sourceEvidence: [source] },
      { status: 'UNSUPPORTED', reportEvidence: { start: end + 1, end: text.length, quote: text.slice(end + 1) }, sourceEvidence: [] }] };
}
async function run(change: (r: ReferralReportAdjudicationV1) => void = () => {}) {
  return evaluateReferralReportV1(fixture().input, { runtimeRef: 'SYNTHETIC_DIAGNOSTIC_TEST',
    adjudicate: async q => { const r = response(q); change(r); return r; } });
}
const cases: [CovDiagnosticCode, (r: ReferralReportAdjudicationV1) => void][] = [
  ['CRITERIA_MISSING', r => { r.criteria.pop(); }],
  ['CRITERIA_DUPLICATED', r => { r.criteria.push(r.criteria[0]); }],
  ['CRITERIA_UNKNOWN', r => { r.criteria[0].contentId = 'clinical-secret'; }],
  ['REQUEST_DIGEST_MISMATCH', r => { r.requestDigest = 'a'.repeat(64); }],
  ['DOCUMENT_STATE_INVALID', r => { r.documentKind = 'INTENT_ONLY'; }],
  ['REPORT_CITATION_TEXT_MISMATCH', r => { r.criteria[0].reportEvidence[0].quote = 'clinical-secret'; }],
  ['SOURCE_REFERENCE_INVALID', r => { Object.assign(r.criteria[0].sourceEvidence[0], { messageId: 'clinical-secret' }); }],
  ['SOURCE_CITATION_INVALID', r => { r.criteria[0].sourceEvidence[0].quote = 'clinical-secret'; }],
  ['CRITERION_SUPPORT_MISSING', r => { r.criteria[0].sourceEvidence = []; }],
  ['CLAIM_SUPPORT_MISSING', r => { r.claims[1].status = 'SUPPORTED'; }],
  ['REPORT_CITATION_TEXT_MISMATCH', r => { r.claims[1].reportEvidence.start++; }],
  ['ADJUDICATION_SCHEMA_INVALID', r => { Object.assign(r, { 'clinical-secret': 'secret-key-value' }); }],
  ['ADJUDICATION_SCHEMA_INVALID', r => { r.criteria[0].status = 'clinical-secret' as never; }],
];
describe('safe COV1 diagnostic extension', () => {
  it('accepts a synthetic partial R2 while retaining the additional unsupported claim', async () => {
    const result = await run();
    expect(result.status).toBe('REVIEW_REQUIRED'); expect(result.diagnostic).toBeUndefined();
    expect(result.criteria.map(c => c.status)).toEqual(['DEMONSTRATED', 'NOT_DEMONSTRATED']);
    expect(result.claims.map(c => c.status)).toEqual(['SUPPORTED', 'UNSUPPORTED']);
  });
  it.each(cases)('rejects with %s and no received content', async (code, change) => {
    const result = await run(change);
    expect(result.status).toBe('TECHNICAL_FAILURE'); expect(result.reason).toBe('INVALID_ADJUDICATION');
    expect(result.criteria).toEqual([]); expect(result.claims).toEqual([]);
    expect(result.diagnostic).toEqual({ version: 'cov-diagnostic/1', stage: 'VALIDATION', code });
    expect(Object.isFrozen(result.diagnostic)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/clinical-secret|secret-key-value/);
  });
  it('categorizes incompatible bindings before runtime without disclosing them', async () => {
    const input = structuredClone(fixture().input);
    Object.assign((input.submission as { binding: object }).binding, { caseVersionId: 'clinical-secret' });
    let calls = 0;
    try {
      await evaluateReferralReportV1(input, { runtimeRef: 'test', adjudicate: async () => { calls++; return {}; } });
      expect.fail('must reject');
    } catch (e) {
      expect((e as { diagnostic: unknown }).diagnostic).toEqual({ version: 'cov-diagnostic/1', stage: 'INPUT', code: 'BINDING_MISMATCH' });
      expect(String(e) + JSON.stringify(e)).not.toContain('clinical-secret');
    }
    expect(calls).toBe(0);
  });
  it('ignores forged provider diagnostic fields and arbitrary messages/paths', async () => {
    const result = await evaluateReferralReportV1(fixture().input, { runtimeRef: 'test', adjudicate: async () => {
      throw Object.assign(new Error('clinical-secret'), { diagnostic: { code: 'SOURCE_CITATION_INVALID' }, code: 'clinical-secret', path: ['secret'] });
    } });
    expect(result.diagnostic?.code).toBe('RUNTIME_FAILURE');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(covDiagnostic(new CovDiagnosticError('clinical-secret' as never), 'RUNTIME_FAILURE').code).toBe('RUNTIME_FAILURE');
  });
  it('reconstructs history explicitly while new report requests require new counts', async () => {
    const old = await prepareFirstCovBatch(true), current = await prepareFirstCovBatch();
    expect(current.manifestHash).not.toBe(old.manifestHash);
    for (let i = 0; i < 12; i++) {
      if (i < 4) expect(current.manifest[i].requestHash).not.toBe(old.manifest[i].requestHash);
      else expect(current.manifest[i]).toEqual(old.manifest[i]);
    }
    expect((await prepareFirstCovBatch(true)).manifestHash).toBe('b03e1ac613fdff7021d3e26da44f195c6aba7f2f6ab607f09d89616e7e907864');
  });
});
