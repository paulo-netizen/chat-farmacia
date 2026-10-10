import { describe, expect, it, vi } from 'vitest';
import { buildCalibrationFixtures, type CalibrationFixture } from '../../tools/cov-calibration/fixtures';
import { evaluateFixture } from '../../tools/cov-calibration/runner';
import { createSessionTranscriptSnapshotV2 } from '../../lib/cases/v2/spfa-session-transcript';
import { createCovSimulatedRuntimes, type CovCapability } from '../../lib/cases/v2/cov-semantic-runtime';
import { validateSourceSpan } from '../../lib/cases/v2/cov-source-citations';
import { covDiagnostic } from '../../lib/cases/v2/cov-diagnostics';
import { prepareFirstCovBatch } from '../../tools/cov-calibration/first-batch';
import { covHash } from '../../lib/cases/v2/cov-experiment-policy';
const config = { model: 'gpt-5.6-terra' as const, maxOutputTokens: 8000, maxInputBytes: 20000, timeoutMs: 60000 };
const text = 'Á 😀\r\nuno uno';
function fixture(cap: CovCapability) {
  const f = buildCalibrationFixtures().find(f => f.id === ({ COV1: 'R2', COV2: 'S1', COV3: 'P1' })[cap])!;
  const old = f.input.transcript as ReturnType<typeof createSessionTranscriptSnapshotV2>;
  const transcript = createSessionTranscriptSnapshotV2({ sessionId: old.sessionId, caseVersionId: old.caseVersionId,
    messages: (['patient', 'student', 'student', 'patient'] as const).map((role, i) => ({ messageId: String(i + 1), role,
      content: i === 2 ? '¿Puede usarlo?' : text, createdAt: `2026-10-05T10:00:0${i}Z` })) });
  f.input.transcript = transcript;
  const binding = { sessionId: transcript.sessionId, caseVersionId: transcript.caseVersionId, transcriptFingerprint: transcript.fingerprint };
  (f.input.context as { binding: unknown }).binding = binding;
  if (f.capability === 'COV1') (f.input.submission as { binding: unknown }).binding = binding;
  else (f.input.requirements as { binding: unknown }).binding = binding;
  return f;
}
const cite = (messageId: string, quote = text) => ({ messageId, quote, occurrence: null as number | null });
// Transport fixtures check structural behavior, not semantic accuracy or real lost responses.
function reply(cap: CovCapability, q: any) {
  const source = { source: 'TRANSCRIPT', ...cite('1') };
  if (cap === 'COV1') return { contractVersion: 'referral-report-sources-adjudication/3', requestDigest: q.requestDigest, documentKind: 'WRITTEN_REPORT',
    criteria: q.untrustedData.requirements.map((r: any) => ({ contentId: r.contentId, status: 'DEMONSTRATED', reportEvidence: [{ quote: q.untrustedData.reportText, occurrence: null }], sourceEvidence: [source] })),
    claims: [{ status: 'UNSUPPORTED', reportEvidence: { quote: 'Vive sola.', occurrence: null }, sourceEvidence: [] }] };
  if (cap === 'COV2') return { contractVersion: 'follow-up-plan-sources-adjudication/2', requestDigest: q.requestDigest, planKind: 'CONCRETE_PLAN', planEvidence: [cite('2')], relations: [],
    criteria: q.requirements.configuration.elements.map((r: any) => ({ requirementId: r.requirementId, status: 'DEMONSTRATED', studentEvidence: [cite('2')], contextEvidence: [source], observedTriggerForms: [] })) };
  return { contractVersion: 'personalization-sources-adjudication/3', requestDigest: q.requestDigest, difficulty: { status: 'NOT_OBSERVED', evidence: [] }, incompatibilities: [],
    links: [{ linkId: 'a', circumstances: [source], proposal: cite('2'), attribution: 'OWN_PROPOSAL', standing: 'CURRENT', patientProposal: null, withdrawal: null,
      feasibilityCheck: cite('3', '¿Puede usarlo?'), patientResponse: null, responseToDifficulty: null }],
    criteria: q.requirements.configuration.elements.map((r: any, i: number) => ({ requirementId: r.requirementId, status: i === 2 ? 'NOT_APPLICABLE' : 'DEMONSTRATED', linkRef: i === 2 ? null : 'a', studentEvidence: [] })) };
}
function anchor(cap: CovCapability, r: any) { return cap === 'COV1' ? r.criteria[0].sourceEvidence[0] : cap === 'COV2' ? r.criteria[0].studentEvidence[0] : r.links[0].circumstances[0]; }
async function run(cap: CovCapability, change: (r: any, q: any) => void = () => {}, f: CalibrationFixture = fixture(cap)) {
  const parse = vi.fn(async (body: any) => {
    expect(body.instructions).not.toContain('Cite exact UTF-16');
    const q = JSON.parse(body.input), r = reply(cap, q); change(r, q);
    return { status: 'completed', model: config.model, error: null, output: [], output_parsed: r };
  });
  const result = await evaluateFixture(f, createCovSimulatedRuntimes(config, { responses: { parse } } as never));
  expect(parse).toHaveBeenCalledTimes(1); return result;
}
describe.each(['COV1', 'COV2', 'COV3'] as const)('%s exact source adaptation through final validator', cap => {
  it('accepts unique Unicode/CRLF citations, keeps the identified source and additional claims', async () => {
    const r = await run(cap); expect(r.status).toBe('REVIEW_REQUIRED'); expect(r.semanticAcceptance).toBe('PENDING');
    expect(JSON.stringify(r)).toContain(JSON.stringify(text).slice(1, -1));
    if ('claims' in r) expect(r.claims[0].status).toBe('UNSUPPORTED');
    if ('links' in r) { expect(r.links[0].circumstances[0]).toMatchObject({ messageId: '1', start: 0, end: text.length }); expect(r.links[0].proposal.messageId).toBe('2'); }
  });
  it('resolves an explicit repeated occurrence within that source', async () => {
    const r = await run(cap, r => Object.assign(anchor(cap, r), { quote: 'uno', occurrence: 2 }));
    expect(r.status).toBe('REVIEW_REQUIRED'); expect(JSON.stringify(r)).toContain('"start":10'); expect(text.slice(10, 13)).toBe('uno');
  });
  it.each([
    ['SOURCE_CITATION_AMBIGUOUS', { quote: 'uno', occurrence: null }],
    ['SOURCE_CITATION_OCCURRENCE_INVALID', { quote: 'uno', occurrence: 3 }],
    ['SOURCE_CITATION_OCCURRENCE_INVALID', { occurrence: 0 }],
    ['SOURCE_CITATION_OCCURRENCE_INVALID', { occurrence: 1.5 }],
    ['SOURCE_CITATION_EMPTY', { quote: '' }],
    ['SOURCE_CITATION_TEXT_NOT_FOUND', { quote: 'private-secret' }],
    ['SOURCE_CITATION_TEXT_NOT_FOUND', { quote: 'Á 😀\nuno uno' }],
    ['SOURCE_REFERENCE_NOT_FOUND', { messageId: 'private-secret' }],
    ['PROVIDER_SCHEMA_INVALID', { start: 0, end: 9000 }],
  ])('rejects %s with no data leakage', async (code, patch) => {
    const r = await run(cap, r => Object.assign(anchor(cap, r), patch));
    expect(r.status).toBe('TECHNICAL_FAILURE'); expect(r.diagnostic?.code).toBe(code); expect(JSON.stringify(r)).not.toMatch(/private-secret|uno|Á/);
  });
  it('does not search a different source containing the quote', async () => {
    const r = await run(cap, r => Object.assign(anchor(cap, r), { quote: text, messageId: '3' }));
    expect(r.status).toBe('TECHNICAL_FAILURE'); expect(r.diagnostic?.code).toBe(cap === 'COV3' ? 'SOURCE_ROLE_INVALID' : 'SOURCE_CITATION_TEXT_NOT_FOUND');
  });
});
describe('source scope, chronology and historical spans', () => {
  it('preserves COV2 contradiction endpoints and orders the evidence by transcript, not response order', async () => {
    const f = buildCalibrationFixtures().find(f => f.id === 'S4-CONFLICT')!;
    const r = await run('COV2', (r,q) => {
      const [a,b] = q.untrustedData.messages.map((m:any)=>cite(m.messageId,m.content));
      r.planEvidence=[b,a]; Object.assign(r.criteria[0],{status:'CONTRADICTORY',studentEvidence:[b,a],contextEvidence:[],observedTriggerForms:['TIME']});
      r.relations=[{requirementId:r.criteria[0].requirementId,kind:'CONTRADICTION',earlier:a,later:b}];
    }, f);
    expect(r.status).toBe('REVIEW_REQUIRED');
    if('relations' in r) { expect(r.evidenceTimeline.map(e=>e.messageId)).toEqual(['1','2']); expect(r.relations[0].earlier.messageId).toBe('1'); }
  });
  it('preserves every COV3 chain field and historical performance after withdrawal', async () => {
    const f = buildCalibrationFixtures().find(f => f.id === 'P2-WITHDRAW')!;
    const r = await run('COV3', (r,q) => {
      const [p,a,v,d,w] = q.untrustedData.messages.map((m:any)=>cite(m.messageId,m.content));
      r.difficulty={status:'PRESENT',evidence:[d]};
      Object.assign(r.links[0],{circumstances:[{source:'TRANSCRIPT',...p}],proposal:a,patientProposal:p,attribution:'EXPLICIT_ADOPTION',standing:'WITHDRAWN',withdrawal:w,feasibilityCheck:v,
        patientResponse:{kind:'DIFFICULTY_OR_REJECTION',evidence:d},responseToDifficulty:{difficulty:d,response:w}});
      r.criteria.forEach((c:any)=>Object.assign(c,{status:'DEMONSTRATED',linkRef:'a'}));
    },f);
    expect(r.status).toBe('REVIEW_REQUIRED');
    if('links' in r) { expect(r.links[0].withdrawal?.messageId).toBe('5'); expect(r.links[0].responseToDifficulty?.difficulty.messageId).toBe('4'); expect(r.criteria.every(c=>c.status==='DEMONSTRATED')).toBe(true); }
  });
  it.each(['COV2','COV3'] as const)('rejects role substitution in %s', async cap => {
    const r = await run(cap, r => { anchor(cap, r).messageId = cap === 'COV2' ? '1' : '2'; });
    expect(r.diagnostic?.code).toBe('SOURCE_ROLE_INVALID');
  });
  it('does not turn a later patient revelation into knowledge before the proposal', async () => {
    const r = await run('COV3', r => { r.links[0].circumstances[0].messageId = '4'; });
    expect(r.status).toBe('TECHNICAL_FAILURE'); expect(r.diagnostic?.code).toBe('ADJUDICATION_INVALID');
  });
  it.each(['COV1','COV2','COV3'] as const)('retains PUBLIC field boundaries in %s', async cap => {
    const r = await run(cap, r => {
      const c = { source: 'PUBLIC', field: 'nombre', quote: 'Ana', occurrence: null };
      if(cap === 'COV1') r.criteria[0].sourceEvidence=[c]; else if(cap === 'COV2') r.criteria[0].contextEvidence=[c]; else r.links[0].circumstances=[c];
    }); expect(r.status).toBe('REVIEW_REQUIRED');
  });
  it('never repairs contradictory historical offsets and distinguishes boundaries', () => {
    for (const [span, code] of [[{start:2,end:1,quote:'x'},'SOURCE_CITATION_RANGE_INVALID'],[{start:0,end:99,quote:'x'},'SOURCE_CITATION_OUT_OF_BOUNDS'],[{start:0,end:1,quote:'x'},'SOURCE_CITATION_TEXT_MISMATCH']] as const) {
      try { validateSourceSpan(span,'abc'); expect.fail(); } catch(e) { expect(covDiagnostic(e,'RUNTIME_FAILURE').code).toBe(code); }
    }
  });
  it('preserves both historical projection versions explicitly', async () => {
    const old = await prepareFirstCovBatch(true), report = await prepareFirstCovBatch('report/2'), current = await prepareFirstCovBatch();
    expect(old.manifestHash).toBe('b03e1ac613fdff7021d3e26da44f195c6aba7f2f6ab607f09d89616e7e907864');
    expect(covHash(report.manifest.slice(1))).toBe('2a8e30e3d49c39e0ef0dbf3269db1b969c8707212238570d65a9e1653ba12361');
    current.manifest.forEach((m,i)=>expect(m.requestHash).not.toBe(report.manifest[i].requestHash));
  });
});
