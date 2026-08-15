# SUPABASE V1 SCHEMA INVENTORY

**Project:** ChatUSAL-FarmaBot / `chat-farmacia`  
**Purpose:** authoritative read-only inventory of the deployed v1 PostgreSQL schema for constructing `db/migrations/0001_v1_baseline.sql`.  
**Rule:** this file records observed production structure. It is not itself a migration and must not be executed against production.

## 1. Baseline scope decision

- PostgreSQL observed version: **17.6**.
- `0001_v1_baseline.sql` should declare only `CREATE EXTENSION IF NOT EXISTS pgcrypto;` as an application dependency.
- Supabase/platform extensions observed but intentionally not required by the application baseline: `pg_graphql`, `pg_stat_statements`, `plpgsql`, `supabase_vault`, `uuid-ossp`.
- Supabase-specific ACLs/GRANTs, default privileges, platform roles (`anon`, `authenticated`, `service_role`) and object owners are **observed environment configuration, not application DDL to reproduce in the baseline**.
- RLS is currently disabled on all six application tables and there are zero RLS policies. The baseline does not need to emit `DISABLE ROW LEVEL SECURITY` because new PostgreSQL tables have RLS disabled by default; verification should confirm the resulting state.
- No v2 changes, data, seeds, backfills, status remapping, session cleanup, new constraints, TLS changes, or security hardening belong in `0001_v1_baseline.sql`.

## 2. Observed extensions

| Extension | Version | Baseline treatment |
|---|---:|---|
| `pg_graphql` | `1.5.11` | Exclude: platform/not required by confirmed v1 app schema |
| `pg_stat_statements` | `1.11` | Exclude: platform/not required by confirmed v1 app schema |
| `pgcrypto` | `1.3` | Include: application-required |
| `plpgsql` | `1.0` | Exclude: platform/not required by confirmed v1 app schema |
| `supabase_vault` | `0.3.1` | Exclude: platform/not required by confirmed v1 app schema |
| `uuid-ossp` | `1.1` | Exclude: platform/not required by confirmed v1 app schema |

## 3. Tables and exact columns

Observed application tables: `case_assignments`, `cases`, `evaluations`, `messages`, `sessions`, `users`.

### `case_assignments`

| # | Column | data_type | udt_name | Nullable | Default | Identity | Owned sequence |
|---:|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | `uuid` | `NO` | `gen_random_uuid()` | `NO` | — |
| 2 | `student_id` | `integer` | `int4` | `NO` | — | `NO` | — |
| 3 | `case_id` | `integer` | `int4` | `NO` | — | `NO` | — |
| 4 | `assigned_at` | `timestamp with time zone` | `timestamptz` | `NO` | `now()` | `NO` | — |
| 5 | `completed_at` | `timestamp with time zone` | `timestamptz` | `YES` | — | `NO` | — |

### `cases`

| # | Column | data_type | udt_name | Nullable | Default | Identity | Owned sequence |
|---:|---|---|---|---|---|---|---|
| 1 | `id` | `bigint` | `int8` | `NO` | `nextval('cases_id_seq'::regclass)` | `NO` | `public.cases_id_seq` |
| 2 | `title` | `text` | `text` | `NO` | — | `NO` | — |
| 3 | `description` | `text` | `text` | `NO` | — | `NO` | — |
| 4 | `spec` | `jsonb` | `jsonb` | `NO` | — | `NO` | — |
| 5 | `ground_truth` | `jsonb` | `jsonb` | `NO` | — | `NO` | — |
| 6 | `difficulty` | `integer` | `int4` | `NO` | `1` | `NO` | — |
| 7 | `status` | `text` | `text` | `NO` | `'approved'::text` | `NO` | — |
| 8 | `created_by` | `bigint` | `int8` | `YES` | — | `NO` | — |
| 9 | `created_at` | `timestamp with time zone` | `timestamptz` | `NO` | `now()` | `NO` | — |
| 10 | `service_type` | `text` | `text` | `NO` | `'SAT'::text` | `NO` | — |
| 11 | `updated_at` | `timestamp with time zone` | `timestamptz` | `NO` | `now()` | `NO` | — |

### `evaluations`

| # | Column | data_type | udt_name | Nullable | Default | Identity | Owned sequence |
|---:|---|---|---|---|---|---|---|
| 1 | `id` | `bigint` | `int8` | `NO` | `nextval('evaluations_id_seq'::regclass)` | `NO` | `public.evaluations_id_seq` |
| 2 | `session_id` | `uuid` | `uuid` | `NO` | — | `NO` | — |
| 3 | `tipo_no_adherencia` | `text` | `text` | `NO` | — | `NO` | — |
| 4 | `barrera` | `text` | `text` | `NO` | — | `NO` | — |
| 5 | `intervenciones` | `ARRAY` | `_text` | `NO` | — | `NO` | — |
| 6 | `is_tipo_ok` | `boolean` | `bool` | `NO` | — | `NO` | — |
| 7 | `is_barrera_ok` | `boolean` | `bool` | `NO` | — | `NO` | — |
| 8 | `is_intervencion_ok` | `boolean` | `bool` | `NO` | — | `NO` | — |
| 9 | `score` | `smallint` | `int2` | `NO` | — | `NO` | — |
| 10 | `feedback` | `text` | `text` | `NO` | — | `NO` | — |
| 11 | `created_at` | `timestamp with time zone` | `timestamptz` | `NO` | `now()` | `NO` | — |

### `messages`

| # | Column | data_type | udt_name | Nullable | Default | Identity | Owned sequence |
|---:|---|---|---|---|---|---|---|
| 1 | `id` | `bigint` | `int8` | `NO` | `nextval('messages_id_seq'::regclass)` | `NO` | `public.messages_id_seq` |
| 2 | `session_id` | `uuid` | `uuid` | `NO` | — | `NO` | — |
| 3 | `role` | `text` | `text` | `NO` | — | `NO` | — |
| 4 | `content` | `text` | `text` | `NO` | — | `NO` | — |
| 5 | `created_at` | `timestamp with time zone` | `timestamptz` | `NO` | `now()` | `NO` | — |

### `sessions`

| # | Column | data_type | udt_name | Nullable | Default | Identity | Owned sequence |
|---:|---|---|---|---|---|---|---|
| 1 | `id` | `uuid` | `uuid` | `NO` | `gen_random_uuid()` | `NO` | — |
| 2 | `user_id` | `bigint` | `int8` | `NO` | — | `NO` | — |
| 3 | `case_id` | `bigint` | `int8` | `NO` | — | `NO` | — |
| 4 | `status` | `text` | `text` | `NO` | `'active'::text` | `NO` | — |
| 5 | `started_at` | `timestamp with time zone` | `timestamptz` | `NO` | `now()` | `NO` | — |
| 6 | `finished_at` | `timestamp with time zone` | `timestamptz` | `YES` | — | `NO` | — |
| 7 | `prompt_tokens` | `integer` | `int4` | `NO` | `0` | `NO` | — |
| 8 | `completion_tokens` | `integer` | `int4` | `NO` | `0` | `NO` | — |
| 9 | `cost_eur` | `numeric` | `numeric` | `NO` | `0` | `NO` | — |

### `users`

| # | Column | data_type | udt_name | Nullable | Default | Identity | Owned sequence |
|---:|---|---|---|---|---|---|---|
| 1 | `id` | `bigint` | `int8` | `NO` | `nextval('users_id_seq'::regclass)` | `NO` | `public.users_id_seq` |
| 2 | `email` | `text` | `text` | `NO` | — | `NO` | — |
| 3 | `password_hash` | `text` | `text` | `NO` | — | `NO` | — |
| 4 | `name` | `text` | `text` | `NO` | — | `NO` | — |
| 5 | `role` | `text` | `text` | `NO` | — | `NO` | — |
| 6 | `created_at` | `timestamp with time zone` | `timestamptz` | `NO` | `now()` | `NO` | — |

### Column-level legacy facts that must not be silently corrected

- `case_assignments.student_id` and `case_assignments.case_id` are `integer` / `int4`, while `users.id` and `cases.id` are `bigint` / `int8`.
- `evaluations.intervenciones` is PostgreSQL `text[]` (`data_type = ARRAY`, `udt_name = _text`), not JSON.
- No column is a PostgreSQL `IDENTITY` column.
- `sessions.id` and `case_assignments.id` default to `gen_random_uuid()`.

## 4. Constraints — exact observed definitions

The definitions below are the exact `pg_get_constraintdef(...)` output captured from production.

| Table | Constraint name | Type | Exact definition |
|---|---|---|---|
| `case_assignments` | `case_assignments_case_id_fkey` | `FOREIGN KEY` | `FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE` |
| `case_assignments` | `case_assignments_student_id_fkey` | `FOREIGN KEY` | `FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE` |
| `case_assignments` | `case_assignments_pkey` | `PRIMARY KEY` | `PRIMARY KEY (id)` |
| `case_assignments` | `case_assignments_student_id_case_id_key` | `UNIQUE` | `UNIQUE (student_id, case_id)` |
| `cases` | `cases_status_check` | `CHECK` | `CHECK ((status = ANY (ARRAY['approved'::text, 'rejected'::text])))` |
| `cases` | `cases_created_by_fkey` | `FOREIGN KEY` | `FOREIGN KEY (created_by) REFERENCES users(id)` |
| `cases` | `cases_pkey` | `PRIMARY KEY` | `PRIMARY KEY (id)` |
| `evaluations` | `evaluations_session_id_fkey` | `FOREIGN KEY` | `FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE` |
| `evaluations` | `evaluations_pkey` | `PRIMARY KEY` | `PRIMARY KEY (id)` |
| `evaluations` | `evaluations_session_id_key` | `UNIQUE` | `UNIQUE (session_id)` |
| `messages` | `messages_role_check` | `CHECK` | `CHECK ((role = ANY (ARRAY['student'::text, 'patient'::text])))` |
| `messages` | `messages_session_id_fkey` | `FOREIGN KEY` | `FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE` |
| `messages` | `messages_pkey` | `PRIMARY KEY` | `PRIMARY KEY (id)` |
| `sessions` | `sessions_status_check` | `CHECK` | `CHECK ((status = ANY (ARRAY['active'::text, 'finished'::text])))` |
| `sessions` | `sessions_case_id_fkey` | `FOREIGN KEY` | `FOREIGN KEY (case_id) REFERENCES cases(id)` |
| `sessions` | `sessions_user_id_fkey` | `FOREIGN KEY` | `FOREIGN KEY (user_id) REFERENCES users(id)` |
| `sessions` | `sessions_pkey` | `PRIMARY KEY` | `PRIMARY KEY (id)` |
| `users` | `users_role_check` | `CHECK` | `CHECK ((role = ANY (ARRAY['student'::text, 'teacher'::text, 'admin'::text])))` |
| `users` | `users_pkey` | `PRIMARY KEY` | `PRIMARY KEY (id)` |
| `users` | `users_email_key` | `UNIQUE` | `UNIQUE (email)` |

### Foreign-key action note

- `case_assignments.case_id` → `cases.id`: observed `ON DELETE CASCADE`; no explicit `ON UPDATE` clause.
- `case_assignments.student_id` → `users.id`: observed `ON DELETE CASCADE`; no explicit `ON UPDATE` clause.
- `evaluations.session_id` → `sessions.id`: observed `ON DELETE CASCADE`; no explicit `ON UPDATE` clause.
- `messages.session_id` → `sessions.id`: observed `ON DELETE CASCADE`; no explicit `ON UPDATE` clause.
- `cases.created_by` → `users.id`, `sessions.case_id` → `cases.id`, and `sessions.user_id` → `users.id`: no explicit `ON DELETE` or `ON UPDATE` clause in the observed definition.
- Preserve the observed definitions rather than inventing additional referential actions.

## 5. Indexes — exact observed definitions

Observed index count: **9**.

| Table | Index | Exact definition |
|---|---|---|
| `case_assignments` | `case_assignments_pkey` | `CREATE UNIQUE INDEX case_assignments_pkey ON public.case_assignments USING btree (id)` |
| `case_assignments` | `case_assignments_student_id_case_id_key` | `CREATE UNIQUE INDEX case_assignments_student_id_case_id_key ON public.case_assignments USING btree (student_id, case_id)` |
| `cases` | `cases_pkey` | `CREATE UNIQUE INDEX cases_pkey ON public.cases USING btree (id)` |
| `evaluations` | `evaluations_pkey` | `CREATE UNIQUE INDEX evaluations_pkey ON public.evaluations USING btree (id)` |
| `evaluations` | `evaluations_session_id_key` | `CREATE UNIQUE INDEX evaluations_session_id_key ON public.evaluations USING btree (session_id)` |
| `messages` | `messages_pkey` | `CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id)` |
| `sessions` | `sessions_pkey` | `CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id)` |
| `users` | `users_email_key` | `CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)` |
| `users` | `users_pkey` | `CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)` |

All nine observed indexes correspond to PK/UNIQUE constraints listed above; there were no additional partial or expression indexes in the inspected application tables.

## 6. Sequences — exact observed parameters and ownership

| Sequence | Owner role observed | Type | Start | Increment | Min | Max | Cache | Cycle | Owned by |
|---|---|---|---:|---:|---:|---:|---:|---|---|
| `cases_id_seq` | `postgres` | `bigint` | 1 | 1 | 1 | 9223372036854775807 | 1 | `false` | `public.cases.id` |
| `evaluations_id_seq` | `postgres` | `bigint` | 1 | 1 | 1 | 9223372036854775807 | 1 | `false` | `public.evaluations.id` |
| `messages_id_seq` | `postgres` | `bigint` | 1 | 1 | 1 | 9223372036854775807 | 1 | `false` | `public.messages.id` |
| `users_id_seq` | `postgres` | `bigint` | 1 | 1 | 1 | 9223372036854775807 | 1 | `false` | `public.users.id` |

Observed sequence ownership links:
- `cases_id_seq` is owned by `public.cases.id`.
- `evaluations_id_seq` is owned by `public.evaluations.id`.
- `messages_id_seq` is owned by `public.messages.id`.
- `users_id_seq` is owned by `public.users.id`.

The observed sequence owner role is `postgres`, but the baseline should **not hard-code platform ownership**; objects should be owned by the role executing the migration in the disposable verification environment.

## 7. RLS, policies, triggers, functions, views

| Table | RLS enabled | RLS forced | Policy count |
|---|---|---|---:|
| `case_assignments` | `false` | `false` | 0 |
| `cases` | `false` | `false` | 0 |
| `evaluations` | `false` | `false` | 0 |
| `messages` | `false` | `false` | 0 |
| `sessions` | `false` | `false` | 0 |
| `users` | `false` | `false` | 0 |

Additional observations:
- Triggers on the six application tables: **0**.
- Functions defined in schema `public`: **0**.
- Views in schema `public`: **0**.
- RLS policies on the six application tables: **0**.
- Sequences in schema `public`: exactly the four sequences listed above.

## 8. Platform ACL observations — record only, exclude from baseline

The deployed Supabase environment currently grants broad table privileges to `anon`, `authenticated`, and `service_role`, and broad sequence privileges as well. Default privileges in `public` also grant permissions to Supabase platform roles. These are a **security risk to address explicitly in v2**, but they are not a requirement of the historical application schema and must not be copied into `0001_v1_baseline.sql`.

Baseline verification should normalize/ignore:
- ACL/GRANT differences specific to Supabase.
- `ALTER DEFAULT PRIVILEGES` specific to Supabase.
- object owners such as `postgres`.
- absence of Supabase roles in a standard disposable PostgreSQL 17.6 instance.

## 9. Migration-history observation

The only migration-related tables found were:
- `auth.schema_migrations`
- `realtime.schema_migrations`
- `storage.migrations`

These are internal Supabase service migrations (`auth`, `realtime`, `storage`). No application-specific migration table was identified in `public`.

## 10. Expected structural verification target for `0001_v1_baseline.sql`

In a disposable standard PostgreSQL **17.6** database, with no Supabase roles required, the baseline should produce:

- `pgcrypto` available.
- **6** application tables.
- **47** application-table columns with the attributes recorded above.
- **4** owned bigint sequences with the parameters recorded above.
- **20** named constraints as recorded above.
- **9** indexes with the observed names/definitions as the resulting structural state.
- **0** application triggers.
- **0** application functions in `public`.
- **0** views in `public`.
- RLS disabled on all six tables.
- **0** RLS policies.

The comparison should exclude Supabase-specific ACLs, owners, platform default privileges, and platform extensions not required by ChatUSAL-FarmaBot v1.

## 11. Source inventory used to compile this document

This inventory was consolidated from the read-only Supabase exports collected during the audit:
- Supabase Snippet Untitled query (1).csv — constraints
- Supabase Snippet Untitled query (4).csv — PostgreSQL version/extensions
- Supabase Snippet Untitled query (5).csv — indexes
- Supabase Snippet Untitled query (6).csv — RLS/policy counts
- Supabase Snippet Untitled query (7).csv — views/sequences discovery
- Supabase Snippet Untitled query (8).csv — 47 exact column definitions
- Supabase Snippet Untitled query (10).csv — table grants (platform observation)
- Supabase Snippet Untitled query (11).csv — schema/sequence privileges (platform observation)
- Supabase Snippet Untitled query (12).csv — default privileges (platform observation)
- Supabase Snippet Untitled query (13).csv — migration-table discovery
- Supabase Snippet Untitled query (14).csv — sequence parameters/ownership

## 12. Safety note for Codex

When constructing `db/migrations/0001_v1_baseline.sql` from this inventory:

1. Do not infer missing application objects.
2. Do not execute the baseline against the existing Supabase production database.
3. Do not use `DATABASE_URL` or `SUPABASE_DB_URL` for baseline verification.
4. If a safe disposable PostgreSQL 17.6 environment is unavailable, create the baseline but leave execution verification explicitly pending.
5. Do not continue to `0002` or any v2 schema/security change as part of the baseline task.