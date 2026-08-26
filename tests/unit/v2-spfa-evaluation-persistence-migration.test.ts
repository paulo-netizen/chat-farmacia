import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL(
    '../../db/migrations/0003_v2_spfa_evaluation_persistence.sql',
    import.meta.url,
  ),
  'utf8',
);
const compact = migration.replace(/\s+/g, ' ');

function functionBody(functionName: string): string {
  const match = migration.match(
    new RegExp(
      `CREATE FUNCTION public\\.${functionName}\\(\\)[\\s\\S]*?\\$function\\$;`,
    ),
  );
  expect(match, `missing function ${functionName}`).not.toBeNull();
  return match![0];
}

describe('0003 v2 SPFA evaluation persistence migration static contract', () => {
  it('is one explicit incremental transaction', () => {
    expect(migration.trimStart()).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration.match(/\bBEGIN;/g)).toHaveLength(1);
    expect(migration.match(/\bCOMMIT;/g)).toHaveLength(1);
  });

  it('creates one separate v2 persistence table without repurposing Legacy evaluations', () => {
    expect(compact).toContain(
      'CREATE TABLE public.session_evaluation_records_v2 (',
    );
    expect(compact).toContain(
      'id bigint GENERATED ALWAYS AS IDENTITY NOT NULL',
    );
    expect(compact).not.toContain('ALTER TABLE public.evaluations ADD COLUMN');
    expect(compact).not.toContain('UPDATE public.evaluations SET');
  });

  it('persists every normalized G1 snapshot and lifecycle field', () => {
    for (const field of [
      'session_id uuid NOT NULL',
      'case_version_id text NOT NULL',
      'status text NOT NULL',
      'result_format text NOT NULL',
      'protocol_catalog_id text NOT NULL',
      'protocol_catalog_version text NOT NULL',
      'scoring_policy_id text NOT NULL',
      'scoring_policy_version text NOT NULL',
      'transcript_fingerprint_algorithm text NOT NULL',
      'transcript_fingerprint_canonicalization text NOT NULL',
      'transcript_fingerprint_value text NOT NULL',
      'transcript_snapshot jsonb NOT NULL',
      'scoring_policy_snapshot jsonb NOT NULL',
      'attempt_id text NOT NULL',
      'attempt_count bigint NOT NULL',
      'lease_expires_at timestamp with time zone',
      'started_at timestamp with time zone NOT NULL',
      'completed_at timestamp with time zone',
      'failed_at timestamp with time zone',
      'failure_code text',
      'evaluation_result jsonb',
      'score_result jsonb',
    ]) {
      expect(compact).toContain(field);
    }
  });

  it('uses one stable result format and exactly the three G1 states', () => {
    expect(compact).toContain(
      "result_format = 'SPFA_SESSION_EVALUATION_V2'",
    );
    const statusConstraint = compact.match(
      /session_evaluation_records_v2_status_check CHECK \((.*?)\) \), CONSTRAINT/s,
    )?.[1];
    expect(statusConstraint).toContain("'EVALUATING'::text");
    expect(statusConstraint).toContain("'COMPLETED'::text");
    expect(statusConstraint).toContain("'FAILED'::text");
  });

  it('enforces one v2 record per session and conservative real FKs', () => {
    expect(compact).toContain('UNIQUE (session_id)');
    expect(compact).toContain(
      'FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE RESTRICT',
    );
    expect(compact).toContain(
      'FOREIGN KEY (case_version_id) REFERENCES public.case_versions(id) ON DELETE RESTRICT',
    );
    expect(compact).not.toMatch(
      /session_evaluation_records_v2[\s\S]*?ON DELETE CASCADE/,
    );
  });

  it('enforces the canonical branded attempt and positive safe count', () => {
    expect(migration).toContain(
      "^spfa_eval_attempt_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    );
    expect(compact).toContain(
      'attempt_count BETWEEN 1 AND 9007199254740991',
    );
    expect(compact).not.toMatch(/attempt_count[^,]*numeric/);
  });

  it('pins the canonical fingerprint literals and a lowercase SHA-256 value', () => {
    expect(compact).toContain(
      "transcript_fingerprint_algorithm = 'sha256'",
    );
    expect(compact).toContain(
      "transcript_fingerprint_canonicalization = 'session-transcript-v2/1'",
    );
    expect(compact).toContain(
      "transcript_fingerprint_value ~ '^[0-9a-f]{64}$'",
    );
  });

  it('requires the frozen transcript from EVALUATING onward and binds its identity null-safely', () => {
    expect(compact).toContain('transcript_snapshot jsonb NOT NULL');
    expect(compact).toContain("jsonb_typeof(transcript_snapshot) = 'object'");
    for (const fragment of [
      "(transcript_snapshot ->> 'sessionId') IS NOT DISTINCT FROM session_id::text",
      "(transcript_snapshot ->> 'caseVersionId') IS NOT DISTINCT FROM case_version_id",
      "(transcript_snapshot #>> '{fingerprint,algorithm}') IS NOT DISTINCT FROM transcript_fingerprint_algorithm",
      "(transcript_snapshot #>> '{fingerprint,canonicalization}') IS NOT DISTINCT FROM transcript_fingerprint_canonicalization",
      "(transcript_snapshot #>> '{fingerprint,value}') IS NOT DISTINCT FROM transcript_fingerprint_value",
    ]) {
      expect(compact).toContain(fragment);
    }
  });

  it('persists and identity-binds the exact scoring policy snapshot', () => {
    expect(compact).toContain('scoring_policy_snapshot jsonb NOT NULL');
    expect(compact).toContain(
      "(scoring_policy_snapshot #>> '{policyRef,id}') IS NOT DISTINCT FROM scoring_policy_id",
    );
    expect(compact).toContain(
      "(scoring_policy_snapshot #>> '{policyRef,version}') IS NOT DISTINCT FROM scoring_policy_version",
    );
  });

  it('requires object results only for COMPLETED and rejects partial results otherwise', () => {
    expect(compact).toContain(
      "evaluation_result IS NULL OR jsonb_typeof(evaluation_result) = 'object'",
    );
    expect(compact).toContain(
      "score_result IS NULL OR jsonb_typeof(score_result) = 'object'",
    );
    expect(compact).toMatch(
      /status = 'EVALUATING'.*evaluation_result IS NULL.*score_result IS NULL/,
    );
    expect(compact).toMatch(
      /status = 'COMPLETED'.*evaluation_result IS NOT NULL.*score_result IS NOT NULL/,
    );
    expect(compact).toMatch(
      /status = 'FAILED'.*evaluation_result IS NULL.*score_result IS NULL/,
    );
  });

  it('encodes all timestamp and lease invariants with timestamptz', () => {
    expect(compact).toMatch(
      /status = 'EVALUATING'.*lease_expires_at IS NOT NULL.*lease_expires_at > started_at.*completed_at IS NULL.*failed_at IS NULL/,
    );
    expect(compact).toMatch(
      /status = 'COMPLETED'.*lease_expires_at IS NULL.*completed_at IS NOT NULL.*completed_at >= started_at.*failed_at IS NULL/,
    );
    expect(compact).toMatch(
      /status = 'FAILED'.*lease_expires_at IS NULL.*completed_at IS NULL.*failed_at IS NOT NULL.*failed_at >= started_at/,
    );
    expect(compact).not.toMatch(/lease_expires_at[^,]*DEFAULT/i);
  });

  it('accepts only the five safe G1 failure codes and requires one only for FAILED', () => {
    for (const code of [
      'PROVIDER_FAILURE',
      'INVALID_PROVIDER_RESULT',
      'EVALUATION_FAILURE',
      'SNAPSHOT_DRIFT',
      'INTERNAL_FAILURE',
    ]) {
      expect(migration).toContain(`'${code}'`);
    }
    expect(compact).toMatch(
      /status = 'FAILED'.*failure_code IS NOT NULL.*evaluation_result IS NULL/,
    );
    expect(compact).toMatch(
      /status = 'COMPLETED'.*failure_code IS NULL.*evaluation_result IS NOT NULL/,
    );
  });

  it('adds only the recovery index beyond PK and unique session identity', () => {
    expect(compact).toContain(
      'CREATE INDEX session_evaluation_records_v2_recovery_idx ON public.session_evaluation_records_v2 (lease_expires_at, session_id) WHERE status = \'EVALUATING\'',
    );
    expect(migration.match(/CREATE (?:UNIQUE )?INDEX/g)).toHaveLength(1);
  });

  it('makes snapshot columns immutable and COMPLETED terminal', () => {
    const body = functionBody('chatusal_v2_session_evaluation_lifecycle_guard');
    for (const field of [
      'session_id',
      'case_version_id',
      'result_format',
      'protocol_catalog_id',
      'protocol_catalog_version',
      'scoring_policy_id',
      'scoring_policy_version',
      'transcript_fingerprint_value',
      'transcript_snapshot',
      'scoring_policy_snapshot',
      'created_at',
    ]) {
      expect(body).toContain(`NEW.${field}`);
      expect(body).toContain(`OLD.${field}`);
    }
    expect(body).toContain("OLD.status = 'COMPLETED'");
    expect(body).toContain('COMPLETED v2 evaluations are terminal');
    expect(compact).toContain(
      'BEFORE UPDATE OR DELETE ON public.session_evaluation_records_v2',
    );
  });

  it('enforces recovery and attempt ownership without hardcoding lease duration', () => {
    const body = functionBody('chatusal_v2_session_evaluation_lifecycle_guard');
    expect(body).toContain('CURRENT_TIMESTAMP < OLD.lease_expires_at');
    expect(body).toContain('NEW.attempt_count <> OLD.attempt_count + 1');
    expect(body).toContain('NEW.attempt_id IS NOT DISTINCT FROM OLD.attempt_id');
    expect(body).toContain('NEW.attempt_id IS DISTINCT FROM OLD.attempt_id');
    expect(body).not.toMatch(/interval\s+'[^']+'/i);
  });

  it('serializes all message mutations with the session row and active status', () => {
    const body = functionBody('chatusal_v2_message_write_guard');
    expect(compact).toContain(
      'BEFORE INSERT OR UPDATE OR DELETE ON public.messages',
    );
    expect(body).toContain('FROM public.sessions AS s');
    expect(body).toContain('WHERE s.id = target_session_id');
    expect(body).toContain('FOR UPDATE');
    expect(body).toContain("target_session_status <> 'active'");
    expect(body).toContain('message session_id is immutable');
    expect(body).toContain('messages are immutable unless the session is active');
  });

  it('prevents Legacy and v2 evaluations from coexisting under one session lock', () => {
    const body = functionBody('chatusal_v2_session_evaluation_format_guard');
    expect(body).toContain('FROM public.sessions AS s');
    expect(body).toContain('FOR UPDATE');
    expect(body).toContain('FROM public.evaluations AS legacy');
    expect(body).toContain('FROM public.session_evaluation_records_v2 AS v2');
    expect(compact).toContain(
      'BEFORE INSERT OR UPDATE OF session_id ON public.evaluations',
    );
    expect(compact).toContain(
      'BEFORE INSERT OR UPDATE ON public.session_evaluation_records_v2',
    );
  });

  it('requires v2 caseVersion identity to match the session pinned version', () => {
    const body = functionBody('chatusal_v2_session_evaluation_format_guard');
    expect(body).toContain('SELECT s.case_version_id');
    expect(body).toContain(
      'NEW.case_version_id IS DISTINCT FROM pinned_case_version_id',
    );
  });

  it('is server-only through RLS and explicit platform-client revocation', () => {
    expect(compact).toContain(
      'ALTER TABLE public.session_evaluation_records_v2 ENABLE ROW LEVEL SECURITY',
    );
    expect(compact).toContain(
      'ON TABLE public.session_evaluation_records_v2 FROM PUBLIC',
    );
    expect(compact).toContain(
      'ON SEQUENCE public.session_evaluation_records_v2_id_seq FROM PUBLIC',
    );
    expect(migration).toContain("ARRAY['anon'::text, 'authenticated'::text]");
    expect(migration).not.toMatch(/CREATE POLICY/i);
    expect(migration).not.toMatch(/GRANT\s/i);
  });

  it('keeps trigger functions invoker-rights and revokes direct execution', () => {
    expect(migration).not.toContain('SECURITY DEFINER');
    for (const name of [
      'chatusal_v2_session_evaluation_format_guard',
      'chatusal_v2_session_evaluation_lifecycle_guard',
      'chatusal_v2_message_write_guard',
    ]) {
      expect(compact).toContain(`ON FUNCTION public.${name}() FROM PUBLIC`);
    }
  });

  it('contains no destructive Legacy migration or application/provider work', () => {
    const upper = compact.toUpperCase();
    for (const forbidden of [
      'DROP TABLE PUBLIC.EVALUATIONS',
      'TRUNCATE PUBLIC.EVALUATIONS',
      'DELETE FROM PUBLIC.EVALUATIONS',
      'ALTER TABLE PUBLIC.SESSIONS ADD COLUMN',
      'OPENAI',
      'API_KEY',
    ]) {
      expect(upper).not.toContain(forbidden);
    }
  });
});
