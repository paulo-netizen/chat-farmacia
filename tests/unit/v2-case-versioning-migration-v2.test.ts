import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  new URL('../../db/migrations/0002_v2_case_versioning.sql', import.meta.url),
  'utf8',
);
const compact = migration.replace(/\s+/g, ' ');

const statuses = [
  'AI_DRAFT',
  'TEACHER_DRAFT',
  'IN_REVIEW',
  'VALIDATED',
  'PUBLISHED',
  'ARCHIVED',
] as const;

const expectedTransitions = [
  'AI_DRAFT->TEACHER_DRAFT',
  'AI_DRAFT->IN_REVIEW',
  'AI_DRAFT->ARCHIVED',
  'TEACHER_DRAFT->IN_REVIEW',
  'TEACHER_DRAFT->ARCHIVED',
  'IN_REVIEW->TEACHER_DRAFT',
  'IN_REVIEW->VALIDATED',
  'IN_REVIEW->ARCHIVED',
  'VALIDATED->IN_REVIEW',
  'VALIDATED->PUBLISHED',
  'VALIDATED->ARCHIVED',
  'PUBLISHED->ARCHIVED',
].sort();

function functionBody(functionName: string): string {
  const pattern = new RegExp(
    `CREATE FUNCTION public\\.${functionName}\\([\\s\\S]*?\\$function\\$;`,
  );
  const match = migration.match(pattern);
  expect(match, `missing function ${functionName}`).not.toBeNull();
  return match![0];
}

describe('0002 V2 case-versioning migration static contract', () => {
  it('is one explicit transaction and carries the coordinated-deploy warning', () => {
    expect(migration.trimStart()).toMatch(/^BEGIN;/);
    expect(migration.trimEnd()).toMatch(/COMMIT;$/);
    expect(migration.match(/\bBEGIN;/g)).toHaveLength(1);
    expect(migration.match(/\bCOMMIT;/g)).toHaveLength(1);
    expect(migration).toContain('COORDINATED DEPLOYMENT REQUIRED');
    expect(migration).toContain('current v1');
  });

  it('creates both versioning tables with the required physical identity', () => {
    expect(compact).toMatch(/CREATE TABLE public\.case_versions \(/);
    expect(compact).toMatch(/id text NOT NULL/);
    expect(compact).toMatch(/PRIMARY KEY \(id\)/);
    expect(compact).toMatch(
      /CREATE TABLE public\.case_version_status_events \(/,
    );
    expect(compact).toMatch(/id bigint GENERATED ALWAYS AS IDENTITY NOT NULL/);
  });

  it('uses the canonical lowercase casever UUID check', () => {
    expect(migration).toContain(
      "^casever_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    );
    expect(migration).toContain("'casever_' || gen_random_uuid()::text");
  });

  it('contains all and only the six canonical lifecycle statuses', () => {
    for (const status of statuses) expect(migration).toContain(`'${status}'`);
    for (const forbidden of [
      'APPROVED',
      'REJECTED',
      'PROPOSED',
      'DRAFT',
      'ACTIVE',
    ]) {
      expect(migration).not.toMatch(new RegExp(`'${forbidden}'`));
    }
  });

  it('defines exactly the 12 lifecycle transitions once as a reusable matrix', () => {
    const body = functionBody(
      'chatusal_v2_case_version_transition_allowed',
    );
    const transitions = [...body.matchAll(/\('([A-Z_]+)', '([A-Z_]+)'\)/g)]
      .map((match) => `${match[1]}->${match[2]}`)
      .sort();

    expect(transitions).toEqual(expectedTransitions);
    expect(new Set(transitions).size).toBe(12);
    expect(body).not.toMatch(/\('([A-Z_]+)', '\1'\)/);
    expect(compact).toContain(
      'public.chatusal_v2_case_version_transition_allowed( OLD.status, NEW.status )',
    );
  });

  it('defines version numbering, parent, ownership, and same-case FKs', () => {
    expect(compact).toContain('CHECK (version_number > 0)');
    expect(compact).toContain('UNIQUE (case_id, version_number)');
    expect(compact).toContain('UNIQUE (case_id, id)');
    expect(compact).toContain(
      'FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE RESTRICT',
    );
    expect(compact).toContain(
      'FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL',
    );
    expect(compact).toContain(
      'FOREIGN KEY (parent_version_id) REFERENCES public.case_versions(id) ON DELETE RESTRICT',
    );
    expect(compact).toContain(
      'FOREIGN KEY (case_id, parent_version_id) REFERENCES public.case_versions(case_id, id) ON DELETE RESTRICT',
    );
    expect(functionBody('chatusal_v2_case_version_validate_insert')).toContain(
      'parent_number >= NEW.version_number',
    );
  });

  it('permits only the two materializable source/content combinations', () => {
    expect(migration).toContain("source_kind = 'AI_GENERATED'");
    expect(migration).toContain("'TEACHER_AUTHORED'::text");
    expect(migration).toContain("source_kind = 'LEGACY_V1'");
    expect(migration).toContain(
      "content_format = 'GENERATED_CASE_BUNDLE_V2'",
    );
    expect(migration).toContain("content_format = 'LEGACY_V1_SNAPSHOT'");
    expect(migration).toContain(
      'TEACHER_AUTHORED cannot be materialized until its content format exists',
    );
    expect(compact).toContain("jsonb_typeof(content) = 'object'");
  });

  it('guards all bundle identity paths with null-safe equality', () => {
    const paths = [
      '{sourceOfTruth,caseVersionId}',
      '{sourceOfTruth,patientFacts,caseVersionId}',
      '{sourceOfTruth,evaluator,caseVersionId}',
      '{derived,patientRuntime,caseVersionId}',
      '{derived,teachingSummary,caseVersionId}',
      '{derived,complianceReport,caseVersionId}',
    ];
    expect(compact).toContain(
      "(content ->> 'schemaVersion') IS NOT DISTINCT FROM '2.0'",
    );
    for (const path of paths) {
      expect(compact).toContain(
        `(content #>> '${path}') IS NOT DISTINCT FROM id`,
      );
    }
  });

  it('guards the legacy snapshot contract and DO checks against SQL NULL', () => {
    expect(compact).toContain(
      "(content ->> 'snapshotBasis') IS NOT DISTINCT FROM 'migration_time_current_row'",
    );
    expect(compact).toContain(
      "(content ->> 'legacyStatus') IS NOT DISTINCT FROM legacy_status",
    );
    expect(compact).toContain(
      "(content ->> 'legacyCaseId') IS NOT DISTINCT FROM case_id::text",
    );

    expect(
      migration.match(
        /\(content ->> 'snapshotBasis'\)\s+IS DISTINCT FROM 'migration_time_current_row'/g,
      ),
    ).toHaveLength(2);
    expect(
      migration.match(
        /\(content ->> 'legacyStatus'\)\s+IS DISTINCT FROM legacy_status/g,
      ),
    ).toHaveLength(2);
    expect(
      migration.match(
        /\(content ->> 'legacyCaseId'\)\s+IS DISTINCT FROM case_id::text/g,
      ),
    ).toHaveLength(2);
  });

  it('rejects vulnerable JSON equality patterns in this static contract guard', () => {
    expect(migration).not.toMatch(
      /->>\s*'schemaVersion'\s*=\s*'2\.0'/,
    );
    expect(migration).not.toMatch(
      /#>>\s*'\{[^']*caseVersionId\}'\s*=\s*id/,
    );
    expect(migration).not.toMatch(
      /->>\s*'(?:snapshotBasis|legacyStatus|legacyCaseId)'\s*(?:=|<>)/,
    );
  });

  it('has one partial unique PUBLISHED version per logical case', () => {
    expect(compact).toMatch(
      /CREATE UNIQUE INDEX case_versions_one_published_per_case_idx ON public\.case_versions \(case_id\) WHERE status = 'PUBLISHED'/,
    );
    expect(migration).not.toContain('current_version_id');
    expect(migration).not.toContain('published_version_id');
  });

  it('backfills one immutable legacy snapshot with explicit provenance', () => {
    for (const token of [
      'LEGACY_V1',
      'LEGACY_V1_SNAPSHOT',
      "WHEN 'approved' THEN 'PUBLISHED'",
      "WHEN 'rejected' THEN 'ARCHIVED'",
      "'snapshotBasis', 'migration_time_current_row'",
      "'spec', c.spec",
      "'groundTruth', c.ground_truth",
      "'createdAt', c.created_at",
      "'updatedAt', c.updated_at",
    ]) {
      expect(migration).toContain(token);
    }
    for (const key of [
      'legacyCaseId',
      'title',
      'description',
      'difficulty',
      'serviceType',
      'createdBy',
      'legacyStatus',
    ]) {
      expect(migration).toContain(`'${key}'`);
    }
  });

  it('creates initial and transition events and makes them append-only', () => {
    expect(compact).toMatch(
      /CREATE UNIQUE INDEX case_version_status_events_one_initial_idx ON public\.case_version_status_events \(case_version_id\) WHERE from_status IS NULL/,
    );
    expect(migration).toContain(
      "CASE WHEN NEW.source_kind = 'LEGACY_V1' THEN NULL ELSE NEW.created_by END",
    );
    expect(migration).toContain(
      "current_setting('chatusal.case_version_actor_user_id', true)",
    );
    expect(migration).toContain(
      "current_setting('chatusal.case_version_reason', true)",
    );
    expect(compact).toContain(
      'AFTER UPDATE OF status ON public.case_versions',
    );
    expect(compact).toContain(
      'BEFORE UPDATE OR DELETE ON public.case_version_status_events',
    );
    expect(migration).toContain('case version status events are append-only');
  });

  it('blocks case-version mutation and deletion while allowing status workflow', () => {
    const updateGuard = functionBody('chatusal_v2_case_version_guard_update');
    for (const field of [
      'id',
      'case_id',
      'version_number',
      'parent_version_id',
      'source_kind',
      'content_format',
      'content',
      'legacy_status',
      'created_by',
      'created_at',
    ]) {
      expect(updateGuard).toContain(`NEW.${field}`);
      expect(updateGuard).toContain(`OLD.${field}`);
    }
    expect(compact).toContain('BEFORE DELETE ON public.case_versions');
    expect(migration).toContain('case versions are historical snapshots');
  });

  it('backfills sessions, makes the version mandatory, and adds both FKs', () => {
    expect(compact).toContain(
      'ALTER TABLE public.sessions ADD COLUMN case_version_id text',
    );
    expect(compact).toContain(
      'ALTER COLUMN case_version_id SET NOT NULL',
    );
    expect(compact).toContain(
      'FOREIGN KEY (case_version_id) REFERENCES public.case_versions(id) ON DELETE RESTRICT',
    );
    expect(compact).toContain(
      'FOREIGN KEY (case_id, case_version_id) REFERENCES public.case_versions(case_id, id) ON DELETE RESTRICT',
    );
    expect(compact).toContain(
      'BEFORE UPDATE OF case_version_id ON public.sessions',
    );
    expect(compact).toContain('BEFORE INSERT ON public.sessions');
    expect(migration).toContain("AND status = 'PUBLISHED'");
  });

  it('contains fail-closed verification blocks for cases and sessions', () => {
    expect(migration.match(/DO \$block\$/g)?.length).toBeGreaterThanOrEqual(4);
    for (const phrase of [
      'legacy case-version count',
      'exactly one legacy version 1',
      'legacy case status mapping verification failed',
      'legacy snapshot verification failed',
      'session case-version backfill left NULL references',
      'session case-version backfill crossed logical cases',
      'final session logical-case verification failed',
    ]) {
      expect(migration).toContain(phrase);
    }
    expect(migration).toContain('RAISE EXCEPTION');
  });

  it('does not contain destructive legacy operations or forbidden platform SQL', () => {
    const upper = compact.toUpperCase();
    for (const forbidden of [
      'DROP TABLE PUBLIC.CASES',
      'DROP TABLE PUBLIC.SESSIONS',
      'TRUNCATE PUBLIC.CASES',
      'TRUNCATE PUBLIC.SESSIONS',
      'DELETE FROM PUBLIC.CASES',
      'DELETE FROM PUBLIC.SESSIONS',
      'SECURITY DEFINER',
      'ALTER DEFAULT PRIVILEGES',
      'ENABLE ROW LEVEL SECURITY',
    ]) {
      expect(upper).not.toContain(forbidden);
    }
    expect(upper).not.toMatch(/\bGRANT\b/);
    expect(migration).not.toContain('EXECUTE ' + 'IMMEDIATE');
  });

  it('does not alter assignments or add forbidden pointers to cases', () => {
    expect(compact).not.toMatch(/ALTER TABLE public\.case_assignments/);
    expect(compact).not.toMatch(/ALTER TABLE public\.cases/);
    expect(migration).not.toContain('case_assignments.case_version_id');
  });
});
