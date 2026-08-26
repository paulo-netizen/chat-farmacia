import { beforeEach, describe, expect, it, vi } from 'vitest';

const clinicalResolver = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock('@/lib/db', () => ({ pool: { query: vi.fn() } }));
vi.mock('@/lib/cases/v2/resolve-session-clinical-content', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/cases/v2/resolve-session-clinical-content')
  >('@/lib/cases/v2/resolve-session-clinical-content');
  return {
    ...actual,
    resolveSessionSpfaClinicalContentV2: clinicalResolver.resolve,
  };
});

import { buildSpfaScoringContextV2 } from '@/lib/cases/v2/build-spfa-scoring-context';
import type { ConclusionId, NonEmptyArray } from '@/lib/cases/v2/evaluator-types';
import {
  getOwnedSpfaEvaluationStatusV2,
  GetOwnedSpfaEvaluationStatusErrorV2,
  type SpfaEvaluationReadDatabaseV2,
} from '@/lib/cases/v2/get-owned-spfa-evaluation-status';
import { scoreSpfaSessionV2 } from '@/lib/cases/v2/score-spfa-session';
import type { BoundSpfaInformationTargetV2 } from '@/lib/cases/v2/spfa-protocol-application-types';
import type { CaseSpfaProtocolSetV2 } from '@/lib/cases/v2/spfa-protocol-set-types';
import { SPFA_SCORING_POLICY_V2_2026_1 } from '@/lib/cases/v2/spfa-scoring-policy-v2';
import type { SpfaProtocolDefinitionV2 } from '@/lib/cases/v2/spfa-protocol-types';
import type { SpfaSessionEvaluationV2 } from '@/lib/cases/v2/spfa-session-evaluation-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import { SessionClinicalContentErrorV2 } from '@/lib/cases/v2/session-clinical-content-types';
import { validateSpfaProtocolIdV2, validateSpfaProtocolRequirementIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-definition';
import { validateSpfaRequirementTargetIdV2 } from '@/lib/cases/v2/validate-spfa-protocol-application';
import { validateCaseVersionId } from '@/lib/cases/v2/validate-patient-facts';

const sessionId = '10000000-0000-4000-8000-000000000001';
const caseVersionId = validateCaseVersionId(
  'casever_20000000-0000-4000-8000-000000000001',
);
const authenticatedUserId = 17;
const attemptId = 'spfa_eval_attempt_30000000-0000-4000-8000-000000000001';
const spfaRef = 'conclusion_40000000-0000-4000-8000-000000000001' as ConclusionId;
const protocolId = validateSpfaProtocolIdV2(
  'spfa_protocol_50000000-0000-4000-8000-000000000001',
);
const requirementId = validateSpfaProtocolRequirementIdV2(
  'spfa_requirement_60000000-0000-4000-8000-000000000001',
);
const targetId = validateSpfaRequirementTargetIdV2(
  'spfa_target_70000000-0000-4000-8000-000000000001',
);

function nonEmpty<T>(values: readonly T[]): NonEmptyArray<T> {
  const [first, ...rest] = values;
  if (first === undefined) throw new Error('fixture must be non-empty');
  return [first, ...rest];
}

const informationTarget: BoundSpfaInformationTargetV2 = {
  targetId,
  target: { kind: 'PUBLIC_PROFILE', field: 'age' },
};
const application = {
  schemaVersion: '2.0' as const,
  caseVersionId,
  carePathSpfaRef: spfaRef,
  protocolRef: { protocolId, version: '1.0.0' },
  requirements: nonEmpty([{
    kind: 'INFORMATION_REQUIREMENT' as const,
    requirementRef: requirementId,
    applicability: {
      status: 'APPLICABLE' as const,
      effectiveImportance: 'RELEVANT' as const,
    },
    informationTargets: nonEmpty([informationTarget]),
  }]),
};
const definition: SpfaProtocolDefinitionV2 = {
  schemaVersion: '2.0',
  protocolId,
  version: '1.0.0',
  service: 'pharmaceutical_indication',
  requirements: nonEmpty([{
    kind: 'INFORMATION_REQUIREMENT',
    requirementId,
    teacherLabel: 'Demanda',
    description: 'Explora la demanda',
    defaultImportance: 'RELEVANT',
    safetyCriticality: { safetyCritical: false },
    applicability: { kind: 'ALWAYS' },
    semanticDomain: {
      kind: 'patient_information',
      disclosureDomain: 'symptoms',
    },
    informationGoal: 'Conocer la demanda',
  }]),
};
const protocolSet: CaseSpfaProtocolSetV2 = {
  schemaVersion: '2.0',
  catalogRef: { id: 'spfa-protocol-catalog', version: '2026.1' },
  definitions: nonEmpty([definition]),
  applications: nonEmpty([application]),
};
const transcript = createSessionTranscriptSnapshotV2({
  sessionId,
  caseVersionId,
  messages: [],
});
const evaluation: SpfaSessionEvaluationV2 = {
  schemaVersion: '2.0',
  sessionId,
  caseVersionId,
  protocolCatalogRef: protocolSet.catalogRef,
  transcriptFingerprint: transcript.fingerprint,
  applications: nonEmpty([{
    carePathSpfaRef: spfaRef,
    protocolRef: application.protocolRef,
    requirementResults: nonEmpty([{
      schemaVersion: '2.0',
      sessionId,
      caseVersionId,
      transcriptFingerprint: transcript.fingerprint,
      carePathSpfaRef: spfaRef,
      requirementRef: requirementId,
      kind: 'INFORMATION_REQUIREMENT',
      coverage: {
        status: 'COVERED',
        origin: 'PUBLIC_INFORMATION',
        coveredTargetRefs: nonEmpty([targetId]),
        evidence: nonEmpty([{
          source: 'PUBLIC_INFORMATION',
          targetRef: targetId,
        }]),
      },
    }]),
  }]),
  semanticExecutions: [],
};
const score = scoreSpfaSessionV2(
  buildSpfaScoringContextV2(evaluation, protocolSet),
  SPFA_SCORING_POLICY_V2_2026_1,
);

function baseRow(): Record<string, unknown> {
  return {
    session_id: sessionId,
    session_user_id: String(authenticatedUserId),
    session_case_id: '5',
    session_case_version_id: caseVersionId,
    session_status: 'finished',
    version_id: caseVersionId,
    version_case_id: '5',
    version_status: 'PUBLISHED',
    version_source_kind: 'AI_GENERATED',
    version_legacy_status: null,
    version_content_format: 'GENERATED_CASE_BUNDLE_V2',
    version_content: { protected: true },
    evaluation_status: null,
    evaluation_result_format: null,
    evaluation_session_id: null,
    evaluation_case_version_id: null,
    protocol_catalog_id: null,
    protocol_catalog_version: null,
    scoring_policy_id: null,
    scoring_policy_version: null,
    transcript_fingerprint_algorithm: null,
    transcript_fingerprint_canonicalization: null,
    transcript_fingerprint_value: null,
    transcript_snapshot: null,
    scoring_policy_snapshot: null,
    attempt_id: null,
    attempt_count: null,
    lease_expires_at: null,
    started_at: null,
    completed_at: null,
    failed_at: null,
    failure_code: null,
    evaluation_result: null,
    score_result: null,
  };
}

function lifecycleRow(
  status: 'EVALUATING' | 'FAILED' | 'COMPLETED',
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const state = status === 'EVALUATING'
    ? { lease_expires_at: '2026-08-25T09:05:00.000Z' }
    : status === 'FAILED'
      ? {
          failed_at: '2026-08-25T09:05:00.000Z',
          failure_code: 'PROVIDER_FAILURE',
        }
      : {
          completed_at: '2026-08-25T09:05:00.000Z',
          evaluation_result: evaluation,
          score_result: score,
        };
  return {
    ...baseRow(),
    evaluation_status: status,
    evaluation_result_format: 'SPFA_SESSION_EVALUATION_V2',
    evaluation_session_id: sessionId,
    evaluation_case_version_id: caseVersionId,
    protocol_catalog_id: protocolSet.catalogRef.id,
    protocol_catalog_version: protocolSet.catalogRef.version,
    scoring_policy_id: SPFA_SCORING_POLICY_V2_2026_1.policyRef.id,
    scoring_policy_version: SPFA_SCORING_POLICY_V2_2026_1.policyRef.version,
    transcript_fingerprint_algorithm: transcript.fingerprint.algorithm,
    transcript_fingerprint_canonicalization:
      transcript.fingerprint.canonicalization,
    transcript_fingerprint_value: transcript.fingerprint.value,
    transcript_snapshot: transcript,
    scoring_policy_snapshot: SPFA_SCORING_POLICY_V2_2026_1,
    attempt_id: attemptId,
    attempt_count: '1',
    started_at: '2026-08-25T09:00:00.000Z',
    ...state,
    ...overrides,
  };
}

class FakeDatabase implements SpfaEvaluationReadDatabaseV2 {
  readonly calls: Readonly<{ text: string; values?: unknown[] }>[] = [];

  constructor(
    public rows: readonly unknown[],
    private readonly error?: Error,
  ) {}

  async query(text: string, values?: unknown[]) {
    this.calls.push({ text: text.replace(/\s+/g, ' ').trim(), values });
    if (this.error !== undefined) throw this.error;
    return { rows: this.rows };
  }
}

function read(database: FakeDatabase) {
  return getOwnedSpfaEvaluationStatusV2(
    { authenticatedUserId, sessionId },
    database,
  );
}

beforeEach(() => {
  clinicalResolver.resolve.mockReset();
  clinicalResolver.resolve.mockReturnValue({ spfaProtocolSet: protocolSet });
});

describe('getOwnedSpfaEvaluationStatusV2 states', () => {
  it('returns NOT_STARTED for an owned generated session without a record', async () => {
    await expect(read(new FakeDatabase([baseRow()]))).resolves.toEqual({
      status: 'NOT_STARTED',
      sessionId,
    });
  });

  it('rejects partial LEFT JOIN data instead of treating it as NOT_STARTED', async () => {
    await expect(read(new FakeDatabase([{
      ...baseRow(),
      attempt_id: attemptId,
    }]))).rejects.toMatchObject({ code: 'invalid_persisted_evaluation' });
  });

  it('returns EVALUATING without recovering an expired lease', async () => {
    const database = new FakeDatabase([lifecycleRow('EVALUATING')]);
    await expect(read(database)).resolves.toMatchObject({ status: 'EVALUATING' });
    expect(database.calls).toHaveLength(1);
    expect(database.calls[0]?.text).not.toMatch(/FOR UPDATE|\b(?:INSERT|UPDATE|DELETE)\b/);
  });

  it('returns FAILED with its server-only failure code', async () => {
    await expect(read(new FakeDatabase([lifecycleRow('FAILED')]))).resolves
      .toMatchObject({ status: 'FAILED', failureCode: 'PROVIDER_FAILURE' });
  });

  it('returns validated persisted evaluation and score when COMPLETED', async () => {
    await expect(read(new FakeDatabase([lifecycleRow('COMPLETED')]))).resolves
      .toMatchObject({ status: 'COMPLETED', evaluation, score });
  });

  it('rejects any lifecycle record attached to an active session', async () => {
    await expect(read(new FakeDatabase([{
      ...lifecycleRow('EVALUATING'),
      session_status: 'active',
    }]))).rejects.toMatchObject({ code: 'invalid_session_anchor' });
  });
});

describe('getOwnedSpfaEvaluationStatusV2 authorization and validation', () => {
  it.each([
    ['nonexistent', []],
    ['foreign hidden by ownership SQL', []],
  ])('uses the same safe error for %s sessions', async (_name, rows) => {
    await expect(read(new FakeDatabase(rows))).rejects.toMatchObject({
      code: 'session_not_found_or_forbidden',
    });
  });

  it('rejects Legacy/incompatible content without reading lifecycle JSON', async () => {
    clinicalResolver.resolve.mockImplementation(() => {
      throw new SessionClinicalContentErrorV2(
        'spfa_evaluation_not_available',
        'contentFormat',
      );
    });
    await expect(read(new FakeDatabase([baseRow()]))).rejects.toMatchObject({
      code: 'spfa_evaluation_not_available',
    });
  });

  it.each([
    ['identity drift', { evaluation_session_id: '10000000-0000-4000-8000-000000000002' }],
    ['protocol drift', { protocol_catalog_version: 'wrong' }],
    ['fingerprint drift', { transcript_fingerprint_value: 'f'.repeat(64) }],
    ['policy drift', { scoring_policy_version: 'wrong' }],
    ['corrupt evaluation', { evaluation_result: { corrupted: true } }],
    ['corrupt score', { score_result: { corrupted: true } }],
  ])('fails closed on persisted completed %s', async (_name, overrides) => {
    await expect(read(new FakeDatabase([
      lifecycleRow('COMPLETED', overrides),
    ]))).rejects.toMatchObject({ code: 'invalid_persisted_evaluation' });
  });

  it.each([
    ['evaluating result', lifecycleRow('EVALUATING', { score_result: score })],
    ['failed lease', lifecycleRow('FAILED', { lease_expires_at: '2026-08-25T09:06:00.000Z' })],
    ['completed failure', lifecycleRow('COMPLETED', { failure_code: 'PROVIDER_FAILURE' })],
  ])('fails closed on impossible lifecycle columns: %s', async (_name, row) => {
    await expect(read(new FakeDatabase([row]))).rejects.toMatchObject({
      code: 'invalid_persisted_evaluation',
    });
  });

  it('maps database detail to one generic read error', async () => {
    await expect(read(new FakeDatabase([], new Error('SQL_SECRET')))).rejects
      .toBeInstanceOf(GetOwnedSpfaEvaluationStatusErrorV2);
    await expect(read(new FakeDatabase([], new Error('SQL_SECRET')))).rejects
      .toMatchObject({ code: 'evaluation_read_failed' });
  });

  it('rejects client-controlled fields before querying', async () => {
    const database = new FakeDatabase([baseRow()]);
    await expect(getOwnedSpfaEvaluationStatusV2({
      authenticatedUserId,
      sessionId,
      model: 'client-model',
    } as never, database)).rejects.toMatchObject({ code: 'invalid_input' });
    expect(database.calls).toEqual([]);
  });
});

describe('getOwnedSpfaEvaluationStatusV2 SQL boundary', () => {
  it('uses one parameterized ownership read and never reads messages or writes', async () => {
    const database = new FakeDatabase([baseRow()]);
    await read(database);
    expect(database.calls).toHaveLength(1);
    expect(database.calls[0]?.values).toEqual([sessionId, authenticatedUserId]);
    expect(database.calls[0]?.text).toMatch(
      /WHERE s\.id = \$1 AND s\.user_id = \$2/,
    );
    expect(database.calls[0]?.text).toContain(
      'LEFT JOIN public.session_evaluation_records_v2',
    );
    expect(database.calls[0]?.text).not.toMatch(
      /public\.messages|FOR UPDATE|\b(?:INSERT|UPDATE|DELETE)\b/,
    );
  });
});
