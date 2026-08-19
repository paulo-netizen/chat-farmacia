BEGIN;

-- ChatUSAL-FarmaBot v2 case-versioning migration.
--
-- COORDINATED DEPLOYMENT REQUIRED: after this migration completes,
-- public.sessions.case_version_id is mandatory and every new session must
-- provide the unique PUBLISHED version for its logical case. The current v1
-- session endpoint does not provide that value. Merely storing this migration
-- in the repository does NOT make it safe to apply to the existing production
-- database. Do not run it against production, Supabase, or any remote database
-- until the compatible application deployment and operational checks exist.

CREATE FUNCTION public.chatusal_v2_case_version_transition_allowed(
  p_from_status text,
  p_to_status text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $function$
  SELECT (p_from_status, p_to_status) IN (
    VALUES
      ('AI_DRAFT', 'TEACHER_DRAFT'),
      ('AI_DRAFT', 'IN_REVIEW'),
      ('AI_DRAFT', 'ARCHIVED'),
      ('TEACHER_DRAFT', 'IN_REVIEW'),
      ('TEACHER_DRAFT', 'ARCHIVED'),
      ('IN_REVIEW', 'TEACHER_DRAFT'),
      ('IN_REVIEW', 'VALIDATED'),
      ('IN_REVIEW', 'ARCHIVED'),
      ('VALIDATED', 'IN_REVIEW'),
      ('VALIDATED', 'PUBLISHED'),
      ('VALIDATED', 'ARCHIVED'),
      ('PUBLISHED', 'ARCHIVED')
  );
$function$;

CREATE TABLE public.case_versions (
  id text NOT NULL,
  case_id bigint NOT NULL,
  version_number integer NOT NULL,
  parent_version_id text,
  status text NOT NULL,
  source_kind text NOT NULL,
  content_format text NOT NULL,
  content jsonb NOT NULL,
  legacy_status text,
  created_by bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT case_versions_pkey PRIMARY KEY (id),
  CONSTRAINT case_versions_case_id_version_number_key
    UNIQUE (case_id, version_number),
  CONSTRAINT case_versions_case_id_id_key UNIQUE (case_id, id),
  CONSTRAINT case_versions_id_check CHECK (
    id ~ '^casever_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT case_versions_version_number_check CHECK (version_number > 0),
  CONSTRAINT case_versions_parent_shape_check CHECK (
    (version_number = 1 AND parent_version_id IS NULL)
    OR (version_number > 1 AND parent_version_id IS NOT NULL)
  ),
  CONSTRAINT case_versions_status_check CHECK (
    status = ANY (ARRAY[
      'AI_DRAFT'::text,
      'TEACHER_DRAFT'::text,
      'IN_REVIEW'::text,
      'VALIDATED'::text,
      'PUBLISHED'::text,
      'ARCHIVED'::text
    ])
  ),
  CONSTRAINT case_versions_source_kind_check CHECK (
    source_kind = ANY (ARRAY[
      'AI_GENERATED'::text,
      'TEACHER_AUTHORED'::text,
      'LEGACY_V1'::text
    ])
  ),
  CONSTRAINT case_versions_content_format_check CHECK (
    content_format = ANY (ARRAY[
      'GENERATED_CASE_BUNDLE_V2'::text,
      'LEGACY_V1_SNAPSHOT'::text
    ])
  ),
  CONSTRAINT case_versions_legacy_status_check CHECK (
    legacy_status IS NULL
    OR legacy_status = ANY (ARRAY['approved'::text, 'rejected'::text])
  ),
  CONSTRAINT case_versions_content_object_check CHECK (
    jsonb_typeof(content) = 'object'
  ),
  CONSTRAINT case_versions_source_format_check CHECK (
    (
      source_kind = 'AI_GENERATED'
      AND content_format = 'GENERATED_CASE_BUNDLE_V2'
      AND legacy_status IS NULL
    )
    OR (
      source_kind = 'LEGACY_V1'
      AND content_format = 'LEGACY_V1_SNAPSHOT'
      AND legacy_status IS NOT NULL
    )
  ),
  CONSTRAINT case_versions_content_contract_check CHECK (
    (
      content_format = 'GENERATED_CASE_BUNDLE_V2'
      AND (content ->> 'schemaVersion') IS NOT DISTINCT FROM '2.0'
      AND (content #>> '{sourceOfTruth,caseVersionId}')
        IS NOT DISTINCT FROM id
      AND (content #>> '{sourceOfTruth,patientFacts,caseVersionId}')
        IS NOT DISTINCT FROM id
      AND (content #>> '{sourceOfTruth,evaluator,caseVersionId}')
        IS NOT DISTINCT FROM id
      AND (content #>> '{derived,patientRuntime,caseVersionId}')
        IS NOT DISTINCT FROM id
      AND (content #>> '{derived,teachingSummary,caseVersionId}')
        IS NOT DISTINCT FROM id
      AND (content #>> '{derived,complianceReport,caseVersionId}')
        IS NOT DISTINCT FROM id
    )
    OR (
      content_format = 'LEGACY_V1_SNAPSHOT'
      AND content ?& ARRAY[
        'legacyCaseId',
        'title',
        'description',
        'spec',
        'groundTruth',
        'difficulty',
        'serviceType',
        'createdBy',
        'createdAt',
        'updatedAt',
        'legacyStatus',
        'snapshotBasis'
      ]::text[]
      AND (content ->> 'snapshotBasis')
        IS NOT DISTINCT FROM 'migration_time_current_row'
      AND (content ->> 'legacyStatus') IS NOT DISTINCT FROM legacy_status
      AND (content ->> 'legacyCaseId') IS NOT DISTINCT FROM case_id::text
    )
  ),
  CONSTRAINT case_versions_case_id_fkey
    FOREIGN KEY (case_id) REFERENCES public.cases(id) ON DELETE RESTRICT,
  CONSTRAINT case_versions_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT case_versions_parent_version_id_fkey
    FOREIGN KEY (parent_version_id)
    REFERENCES public.case_versions(id) ON DELETE RESTRICT,
  CONSTRAINT case_versions_parent_same_case_fkey
    FOREIGN KEY (case_id, parent_version_id)
    REFERENCES public.case_versions(case_id, id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX case_versions_one_published_per_case_idx
  ON public.case_versions (case_id)
  WHERE status = 'PUBLISHED';

CREATE TABLE public.case_version_status_events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  case_version_id text NOT NULL,
  from_status text,
  to_status text NOT NULL,
  actor_user_id bigint,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT case_version_status_events_pkey PRIMARY KEY (id),
  CONSTRAINT case_version_status_events_from_status_check CHECK (
    from_status IS NULL
    OR from_status = ANY (ARRAY[
      'AI_DRAFT'::text,
      'TEACHER_DRAFT'::text,
      'IN_REVIEW'::text,
      'VALIDATED'::text,
      'PUBLISHED'::text,
      'ARCHIVED'::text
    ])
  ),
  CONSTRAINT case_version_status_events_to_status_check CHECK (
    to_status = ANY (ARRAY[
      'AI_DRAFT'::text,
      'TEACHER_DRAFT'::text,
      'IN_REVIEW'::text,
      'VALIDATED'::text,
      'PUBLISHED'::text,
      'ARCHIVED'::text
    ])
  ),
  CONSTRAINT case_version_status_events_transition_check CHECK (
    from_status IS NULL
    OR public.chatusal_v2_case_version_transition_allowed(
      from_status,
      to_status
    )
  ),
  CONSTRAINT case_version_status_events_case_version_id_fkey
    FOREIGN KEY (case_version_id)
    REFERENCES public.case_versions(id) ON DELETE RESTRICT,
  CONSTRAINT case_version_status_events_actor_user_id_fkey
    FOREIGN KEY (actor_user_id)
    REFERENCES public.users(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX case_version_status_events_one_initial_idx
  ON public.case_version_status_events (case_version_id)
  WHERE from_status IS NULL;

CREATE FUNCTION public.chatusal_v2_case_version_validate_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  parent_number integer;
BEGIN
  IF NEW.source_kind = 'AI_GENERATED' THEN
    IF NEW.status <> 'AI_DRAFT'
      OR NEW.content_format <> 'GENERATED_CASE_BUNDLE_V2'
      OR NEW.legacy_status IS NOT NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'AI_GENERATED case versions must start as AI_DRAFT with GENERATED_CASE_BUNDLE_V2 and no legacy_status';
    END IF;
  ELSIF NEW.source_kind = 'LEGACY_V1' THEN
    IF NEW.version_number <> 1
      OR NEW.parent_version_id IS NOT NULL
      OR NEW.content_format <> 'LEGACY_V1_SNAPSHOT' THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'LEGACY_V1 case versions must be initial LEGACY_V1_SNAPSHOT rows';
    END IF;

    IF NOT (
      (NEW.legacy_status = 'approved' AND NEW.status = 'PUBLISHED')
      OR (NEW.legacy_status = 'rejected' AND NEW.status = 'ARCHIVED')
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'LEGACY_V1 status must map approved to PUBLISHED and rejected to ARCHIVED';
    END IF;
  ELSE
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'TEACHER_AUTHORED cannot be materialized until its content format exists';
  END IF;

  IF NEW.version_number = 1 AND NEW.parent_version_id IS NOT NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'version_number 1 cannot have a parent';
  END IF;

  IF NEW.version_number > 1 AND NEW.parent_version_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'derived case versions must have a parent';
  END IF;

  IF NEW.parent_version_id IS NOT NULL THEN
    SELECT version_number
      INTO parent_number
      FROM public.case_versions
      WHERE id = NEW.parent_version_id
        AND case_id = NEW.case_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING
        ERRCODE = '23503',
        MESSAGE = 'parent case version does not exist in the same logical case';
    END IF;

    IF parent_number >= NEW.version_number THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'parent version_number must be lower than the derived version_number';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER chatusal_v2_case_versions_validate_insert
BEFORE INSERT ON public.case_versions
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_case_version_validate_insert();

CREATE FUNCTION public.chatusal_v2_case_version_create_initial_event()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  INSERT INTO public.case_version_status_events (
    case_version_id,
    from_status,
    to_status,
    actor_user_id,
    reason
  )
  VALUES (
    NEW.id,
    NULL,
    NEW.status,
    CASE WHEN NEW.source_kind = 'LEGACY_V1' THEN NULL ELSE NEW.created_by END,
    CASE WHEN NEW.source_kind = 'LEGACY_V1'
      THEN 'v1 backfill at migration time'
      ELSE NULL
    END
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER chatusal_v2_case_versions_create_initial_event
AFTER INSERT ON public.case_versions
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_case_version_create_initial_event();

CREATE FUNCTION public.chatusal_v2_case_version_guard_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.case_id IS DISTINCT FROM OLD.case_id
    OR NEW.version_number IS DISTINCT FROM OLD.version_number
    OR NEW.parent_version_id IS DISTINCT FROM OLD.parent_version_id
    OR NEW.source_kind IS DISTINCT FROM OLD.source_kind
    OR NEW.content_format IS DISTINCT FROM OLD.content_format
    OR NEW.content IS DISTINCT FROM OLD.content
    OR NEW.legacy_status IS DISTINCT FROM OLD.legacy_status
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'case version snapshot and creation metadata are immutable';
  END IF;

  IF NEW.created_by IS DISTINCT FROM OLD.created_by
    AND NOT (OLD.created_by IS NOT NULL AND NEW.created_by IS NULL) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'case version created_by is immutable except for ON DELETE SET NULL';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT public.chatusal_v2_case_version_transition_allowed(
      OLD.status,
      NEW.status
    ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = format(
        'invalid case version transition %s -> %s',
        OLD.status,
        NEW.status
      );
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER chatusal_v2_case_versions_guard_update
BEFORE UPDATE ON public.case_versions
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_case_version_guard_update();

CREATE FUNCTION public.chatusal_v2_case_version_record_status_event()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  actor_setting text;
  event_actor bigint;
  event_reason text;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  actor_setting := NULLIF(
    btrim(current_setting('chatusal.case_version_actor_user_id', true)),
    ''
  );
  event_reason := NULLIF(
    current_setting('chatusal.case_version_reason', true),
    ''
  );

  IF actor_setting IS NOT NULL THEN
    BEGIN
      event_actor := actor_setting::bigint;
    EXCEPTION
      WHEN invalid_text_representation THEN
        RAISE EXCEPTION USING
          ERRCODE = '22023',
          MESSAGE = 'invalid chatusal.case_version_actor_user_id setting';
    END;
  END IF;

  INSERT INTO public.case_version_status_events (
    case_version_id,
    from_status,
    to_status,
    actor_user_id,
    reason
  )
  VALUES (
    NEW.id,
    OLD.status,
    NEW.status,
    event_actor,
    event_reason
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER chatusal_v2_case_versions_record_status_event
AFTER UPDATE OF status ON public.case_versions
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_case_version_record_status_event();

CREATE FUNCTION public.chatusal_v2_case_version_reject_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'case versions are historical snapshots and cannot be deleted';
END;
$function$;

CREATE TRIGGER chatusal_v2_case_versions_reject_delete
BEFORE DELETE ON public.case_versions
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_case_version_reject_delete();

CREATE FUNCTION public.chatusal_v2_case_version_status_event_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '23514',
    MESSAGE = 'case version status events are append-only';
END;
$function$;

CREATE TRIGGER chatusal_v2_case_version_status_events_append_only
BEFORE UPDATE OR DELETE ON public.case_version_status_events
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_case_version_status_event_reject_mutation();

DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.cases
      WHERE status NOT IN ('approved', 'rejected')
  ) THEN
    RAISE EXCEPTION 'cannot backfill case versions: unexpected v1 case status';
  END IF;
END;
$block$;

INSERT INTO public.case_versions (
  id,
  case_id,
  version_number,
  parent_version_id,
  status,
  source_kind,
  content_format,
  content,
  legacy_status,
  created_by
)
SELECT
  'casever_' || gen_random_uuid()::text,
  c.id,
  1,
  NULL,
  CASE c.status
    WHEN 'approved' THEN 'PUBLISHED'
    WHEN 'rejected' THEN 'ARCHIVED'
  END,
  'LEGACY_V1',
  'LEGACY_V1_SNAPSHOT',
  jsonb_build_object(
    'legacyCaseId', c.id,
    'title', c.title,
    'description', c.description,
    'spec', c.spec,
    'groundTruth', c.ground_truth,
    'difficulty', c.difficulty,
    'serviceType', c.service_type,
    'createdBy', c.created_by,
    'createdAt', c.created_at,
    'updatedAt', c.updated_at,
    'legacyStatus', c.status,
    'snapshotBasis', 'migration_time_current_row'
  ),
  c.status,
  c.created_by
FROM public.cases AS c;

DO $block$
DECLARE
  logical_case_count bigint;
  legacy_version_count bigint;
BEGIN
  SELECT count(*) INTO logical_case_count FROM public.cases;
  SELECT count(*) INTO legacy_version_count
    FROM public.case_versions
    WHERE source_kind = 'LEGACY_V1';

  IF legacy_version_count <> logical_case_count THEN
    RAISE EXCEPTION
      'legacy case-version count (%) differs from case count (%)',
      legacy_version_count,
      logical_case_count;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.cases AS c
      LEFT JOIN public.case_versions AS cv
        ON cv.case_id = c.id
       AND cv.source_kind = 'LEGACY_V1'
       AND cv.version_number = 1
      GROUP BY c.id
      HAVING count(cv.id) <> 1
  ) THEN
    RAISE EXCEPTION 'each v1 case must have exactly one legacy version 1';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.case_versions
      WHERE source_kind = 'LEGACY_V1'
        AND (
          (legacy_status = 'approved' AND status <> 'PUBLISHED')
          OR (legacy_status = 'rejected' AND status <> 'ARCHIVED')
        )
  ) THEN
    RAISE EXCEPTION 'legacy case status mapping verification failed';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.case_versions
      WHERE source_kind = 'LEGACY_V1'
        AND (
          (content ->> 'snapshotBasis')
            IS DISTINCT FROM 'migration_time_current_row'
          OR (content ->> 'legacyStatus') IS DISTINCT FROM legacy_status
          OR (content ->> 'legacyCaseId') IS DISTINCT FROM case_id::text
        )
  ) THEN
    RAISE EXCEPTION 'legacy snapshot verification failed';
  END IF;
END;
$block$;

ALTER TABLE public.sessions
  ADD COLUMN case_version_id text;

UPDATE public.sessions AS s
SET case_version_id = cv.id
FROM public.case_versions AS cv
WHERE cv.case_id = s.case_id
  AND cv.source_kind = 'LEGACY_V1'
  AND cv.version_number = 1;

DO $block$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.sessions
      WHERE case_version_id IS NULL
  ) THEN
    RAISE EXCEPTION 'session case-version backfill left NULL references';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.sessions AS s
      JOIN public.case_versions AS cv ON cv.id = s.case_version_id
      WHERE cv.case_id <> s.case_id
  ) THEN
    RAISE EXCEPTION 'session case-version backfill crossed logical cases';
  END IF;
END;
$block$;

ALTER TABLE public.sessions
  ALTER COLUMN case_version_id SET NOT NULL,
  ADD CONSTRAINT sessions_case_version_id_fkey
    FOREIGN KEY (case_version_id)
    REFERENCES public.case_versions(id) ON DELETE RESTRICT,
  ADD CONSTRAINT sessions_case_version_same_case_fkey
    FOREIGN KEY (case_id, case_version_id)
    REFERENCES public.case_versions(case_id, id) ON DELETE RESTRICT;

CREATE FUNCTION public.chatusal_v2_session_case_version_guard_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.case_version_id IS DISTINCT FROM OLD.case_version_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'session case_version_id is immutable';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER chatusal_v2_sessions_case_version_guard_update
BEFORE UPDATE OF case_version_id ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_session_case_version_guard_update();

CREATE FUNCTION public.chatusal_v2_session_require_published_case_version()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  PERFORM 1
    FROM public.case_versions
    WHERE id = NEW.case_version_id
      AND case_id = NEW.case_id
      AND status = 'PUBLISHED'
    FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'new sessions require the PUBLISHED version of the same logical case';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER chatusal_v2_sessions_require_published_case_version
BEFORE INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_session_require_published_case_version();

DO $block$
DECLARE
  logical_case_count bigint;
  legacy_version_count bigint;
BEGIN
  SELECT count(*) INTO logical_case_count FROM public.cases;
  SELECT count(*) INTO legacy_version_count
    FROM public.case_versions
    WHERE source_kind = 'LEGACY_V1';

  IF legacy_version_count <> logical_case_count THEN
    RAISE EXCEPTION 'final legacy case-version count verification failed';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.cases AS c
      LEFT JOIN public.case_versions AS cv
        ON cv.case_id = c.id
       AND cv.source_kind = 'LEGACY_V1'
       AND cv.version_number = 1
      GROUP BY c.id
      HAVING count(cv.id) <> 1
  ) THEN
    RAISE EXCEPTION 'final one-to-one legacy case-version verification failed';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.case_versions
      WHERE source_kind = 'LEGACY_V1'
        AND (
          (legacy_status = 'approved' AND status <> 'PUBLISHED')
          OR (legacy_status = 'rejected' AND status <> 'ARCHIVED')
          OR (content ->> 'snapshotBasis')
            IS DISTINCT FROM 'migration_time_current_row'
          OR (content ->> 'legacyStatus') IS DISTINCT FROM legacy_status
          OR (content ->> 'legacyCaseId') IS DISTINCT FROM case_id::text
        )
  ) THEN
    RAISE EXCEPTION 'final legacy mapping or snapshot verification failed';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.sessions
      WHERE case_version_id IS NULL
  ) THEN
    RAISE EXCEPTION 'final session case-version NULL verification failed';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.sessions AS s
      JOIN public.case_versions AS cv ON cv.id = s.case_version_id
      WHERE cv.case_id <> s.case_id
  ) THEN
    RAISE EXCEPTION 'final session logical-case verification failed';
  END IF;
END;
$block$;

COMMIT;
