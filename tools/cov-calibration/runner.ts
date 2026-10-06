import { createHash } from 'node:crypto';
import { evaluateReferralReportV1 } from '../../lib/cases/v2/evaluate-referral-report';
import { evaluateFollowUpPlanV1 } from '../../lib/cases/v2/evaluate-follow-up-plan';
import { evaluatePersonalizationV2 } from '../../lib/cases/v2/evaluate-personalization-v2';
import { createCovSimulatedRuntimes, type CovClient, type CovRuntimeConfig } from '../../lib/cases/v2/cov-semantic-runtime';
import { buildCalibrationFixtures, type CalibrationFixture } from './fixtures';

export const COV_LIVE_AUTHORIZATION = null; // No approved model/budget. No environment override.
type RuntimeSet = ReturnType<typeof createCovSimulatedRuntimes>;
export function evaluateFixture(fixture: CalibrationFixture, runtimes: RuntimeSet) {
  switch (fixture.capability) {
    case 'COV1': return evaluateReferralReportV1(fixture.input, runtimes.COV1);
    case 'COV2': return evaluateFollowUpPlanV1(fixture.input, runtimes.COV2);
    case 'COV3': return evaluatePersonalizationV2(fixture.input, runtimes.COV3);
  }
}
type Evaluation = Awaited<ReturnType<typeof evaluateFixture>>;
export function measure(fixture: CalibrationFixture, result: Evaluation) {
  const technical = result.status === 'TECHNICAL_FAILURE';
  const criteria = fixture.expected.map(expected => {
    const matches = result.criteria.filter(c => ('contentId' in c ? c.contentId : c.requirementId) === expected.id);
    const actual = technical ? 'TECHNICAL_FAILURE' : matches.length === 1 ? matches[0].status : 'MISSING';
    const abstention = actual === 'INSUFFICIENT' || actual === 'UNCERTAIN';
    return { id: expected.id, expected: expected.status, actual, exact: actual === expected.status,
      falsePositive: actual === 'DEMONSTRATED' && expected.status !== 'DEMONSTRATED',
      falseNegative: expected.status === 'DEMONSTRATED' && ['NOT_DEMONSTRATED', 'CONTRADICTORY', 'NOT_APPLICABLE'].includes(actual),
      abstention, missedPositiveByAbstention: expected.status === 'DEMONSTRATED' && abstention };
  });
  const claims = 'claims' in result ? result.claims : [];
  const used = new Set<number>();
  const claimChecks = fixture.claims.map(expected => {
    const index = claims.findIndex((c, i) => !used.has(i) && c.reportEvidence.start < expected.evidence.end && c.reportEvidence.end > expected.evidence.start);
    if (index >= 0) used.add(index);
    return { expected: expected.status, actual: technical ? 'TECHNICAL_FAILURE' : index < 0 ? 'MISSING' : claims[index].status };
  });
  return { id: fixture.id, capability: fixture.capability, technical, outcomeMatches: result.status === fixture.expectedStatus,
    criteria, claimChecks, extraClaims: claims.length - used.size, semanticEvidenceReview: 'PENDING' as const };
}
export async function runCalibration(options: {
  mode?: 'dry' | 'simulated' | 'live'; fixtures?: CalibrationFixture[]; config?: CovRuntimeConfig; client?: CovClient;
} = {}) {
  const mode = options.mode ?? 'dry';
  if (mode === 'live') throw new Error('COV_LIVE_NOT_AUTHORIZED_MODEL_AND_BUDGET');
  if (mode !== 'dry' && mode !== 'simulated') throw new Error('INVALID_COV_MODE');
  const fixtures = structuredClone(options.fixtures ?? buildCalibrationFixtures());
  if (fixtures.length === 0 || fixtures.length > 42 || new Set(fixtures.map(f => f.id)).size !== fixtures.length || fixtures.some(f => f.split !== 'DEVELOPMENT')) throw new Error('INVALID_CALIBRATION_SET');
  const manifests: { id: string; capability: string; fingerprint: string; providerRequired: boolean }[] = [];
  const rows: ReturnType<typeof measure>[] = [];
  const evaluations: { id: string; result: Evaluation }[] = [];
  let requestCount = 0;
  let runtimes: RuntimeSet;
  if (mode === 'simulated') {
    if (!options.config || !options.client) throw new Error('SIMULATED_TRANSPORT_REQUIRED');
    runtimes = createCovSimulatedRuntimes(options.config, options.client);
  } else {
    // Dry mode never constructs a client, reads credentials, or returns fake academic results.
    const capture = async () => { requestCount++; throw new Error('DRY_REQUEST_CAPTURED'); };
    const runtime = { runtimeRef: 'cov-dry/1', adjudicate: capture };
    runtimes = { COV1: runtime, COV2: runtime, COV3: runtime };
  }
  for (const fixture of fixtures) {
    const before = requestCount;
    let result: Evaluation;
    try { result = await evaluateFixture(fixture, runtimes); }
    catch { throw new Error('INVALID_CALIBRATION_INPUT'); }
    manifests.push({ id: fixture.id, capability: fixture.capability,
      fingerprint: createHash('sha256').update(JSON.stringify(fixture)).digest('hex'),
      providerRequired: mode === 'dry' ? requestCount > before : result.requestDigest !== undefined });
    if (mode === 'simulated') { rows.push(measure(fixture, result)); evaluations.push({ id: fixture.id, result }); }
  }
  const confusion: Record<string, Record<string, number>> = {};
  for (const row of rows) for (const criterion of row.criteria) {
    const key = `${row.capability}:${criterion.id}`;
    confusion[key] ??= {};
    const pair = `${criterion.expected}->${criterion.actual}`;
    confusion[key][pair] = (confusion[key][pair] ?? 0) + 1;
  }
  return { contractVersion: 'cov-calibration-run/1', mode, acceptance: 'NOT_ASSESSED', liveAuthorization: COV_LIVE_AUTHORIZATION,
    manifests, plannedCalls: manifests.filter(m => m.providerRequired).length, rows, evaluations, confusion,
    measurementsPerformed: mode === 'simulated', evaluatedCriteria: rows.flatMap(r => r.criteria).length,
    technicalFailures: mode === 'dry' ? null : rows.filter(r => r.technical).length,
    falsePositives: mode === 'dry' ? null : rows.flatMap(r => r.criteria).filter(c => c.falsePositive).length,
    falseNegatives: mode === 'dry' ? null : rows.flatMap(r => r.criteria).filter(c => c.falseNegative).length,
    abstentions: mode === 'dry' ? null : rows.flatMap(r => r.criteria).filter(c => c.abstention).length };
}
