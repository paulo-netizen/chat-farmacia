BEGIN;

-- ChatUSAL-FarmaBot v2 SPFA evaluation persistence.
--
-- This migration creates only the protected persistence and concurrency
-- boundary required by M5-G. Evaluation execution, claims, retries, APIs and
-- DTOs remain application responsibilities in later increments.

CREATE TABLE public.session_evaluation_records_v2 (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  session_id uuid NOT NULL,
  case_version_id text NOT NULL,
  status text NOT NULL,
  result_format text NOT NULL,
  protocol_catalog_id text NOT NULL,
  protocol_catalog_version text NOT NULL,
  scoring_policy_id text NOT NULL,
  scoring_policy_version text NOT NULL,
  transcript_fingerprint_algorithm text NOT NULL,
  transcript_fingerprint_canonicalization text NOT NULL,
  transcript_fingerprint_value text NOT NULL,
  transcript_snapshot jsonb NOT NULL,
  scoring_policy_snapshot jsonb NOT NULL,
  attempt_id text NOT NULL,
  attempt_count bigint NOT NULL,
  lease_expires_at timestamp with time zone,
  started_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  failed_at timestamp with time zone,
  failure_code text,
  evaluation_result jsonb,
  score_result jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT session_evaluation_records_v2_pkey PRIMARY KEY (id),
  CONSTRAINT session_evaluation_records_v2_session_id_key UNIQUE (session_id),
  CONSTRAINT session_evaluation_records_v2_session_id_fkey
    FOREIGN KEY (session_id)
    REFERENCES public.sessions(id) ON DELETE RESTRICT,
  CONSTRAINT session_evaluation_records_v2_case_version_id_fkey
    FOREIGN KEY (case_version_id)
    REFERENCES public.case_versions(id) ON DELETE RESTRICT,
  CONSTRAINT session_evaluation_records_v2_status_check CHECK (
    status = ANY (ARRAY[
      'EVALUATING'::text,
      'COMPLETED'::text,
      'FAILED'::text
    ])
  ),
  CONSTRAINT session_evaluation_records_v2_result_format_check CHECK (
    result_format = 'SPFA_SESSION_EVALUATION_V2'
  ),
  CONSTRAINT session_evaluation_records_v2_catalog_refs_check CHECK (
    protocol_catalog_id <> ''
    AND btrim(protocol_catalog_id) = protocol_catalog_id
    AND protocol_catalog_version <> ''
    AND btrim(protocol_catalog_version) = protocol_catalog_version
    AND scoring_policy_id <> ''
    AND btrim(scoring_policy_id) = scoring_policy_id
    AND scoring_policy_version <> ''
    AND btrim(scoring_policy_version) = scoring_policy_version
  ),
  CONSTRAINT session_evaluation_records_v2_fingerprint_check CHECK (
    transcript_fingerprint_algorithm = 'sha256'
    AND transcript_fingerprint_canonicalization = 'session-transcript-v2/1'
    AND transcript_fingerprint_value ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT session_evaluation_records_v2_attempt_id_check CHECK (
    attempt_id ~ '^spfa_eval_attempt_[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  ),
  CONSTRAINT session_evaluation_records_v2_attempt_count_check CHECK (
    attempt_count BETWEEN 1 AND 9007199254740991
  ),
  CONSTRAINT session_evaluation_records_v2_transcript_snapshot_check CHECK (
    jsonb_typeof(transcript_snapshot) = 'object'
    AND (transcript_snapshot ->> 'schemaVersion')
      IS NOT DISTINCT FROM '2.0'
    AND (transcript_snapshot ->> 'sessionId')
      IS NOT DISTINCT FROM session_id::text
    AND (transcript_snapshot ->> 'caseVersionId')
      IS NOT DISTINCT FROM case_version_id
    AND (transcript_snapshot #>> '{fingerprint,algorithm}')
      IS NOT DISTINCT FROM transcript_fingerprint_algorithm
    AND (transcript_snapshot #>> '{fingerprint,canonicalization}')
      IS NOT DISTINCT FROM transcript_fingerprint_canonicalization
    AND (transcript_snapshot #>> '{fingerprint,value}')
      IS NOT DISTINCT FROM transcript_fingerprint_value
  ),
  CONSTRAINT session_evaluation_records_v2_scoring_policy_snapshot_check CHECK (
    jsonb_typeof(scoring_policy_snapshot) = 'object'
    AND (scoring_policy_snapshot ->> 'schemaVersion')
      IS NOT DISTINCT FROM '2.0'
    AND (scoring_policy_snapshot #>> '{policyRef,id}')
      IS NOT DISTINCT FROM scoring_policy_id
    AND (scoring_policy_snapshot #>> '{policyRef,version}')
      IS NOT DISTINCT FROM scoring_policy_version
  ),
  CONSTRAINT session_evaluation_records_v2_result_objects_check CHECK (
    (evaluation_result IS NULL OR jsonb_typeof(evaluation_result) = 'object')
    AND (score_result IS NULL OR jsonb_typeof(score_result) = 'object')
  ),
  CONSTRAINT session_evaluation_records_v2_result_identity_check CHECK (
    (
      evaluation_result IS NULL
      OR (
        (evaluation_result ->> 'schemaVersion') IS NOT DISTINCT FROM '2.0'
        AND (evaluation_result ->> 'sessionId')
          IS NOT DISTINCT FROM session_id::text
        AND (evaluation_result ->> 'caseVersionId')
          IS NOT DISTINCT FROM case_version_id
        AND (evaluation_result #>> '{protocolCatalogRef,id}')
          IS NOT DISTINCT FROM protocol_catalog_id
        AND (evaluation_result #>> '{protocolCatalogRef,version}')
          IS NOT DISTINCT FROM protocol_catalog_version
        AND (evaluation_result #>> '{transcriptFingerprint,value}')
          IS NOT DISTINCT FROM transcript_fingerprint_value
      )
    )
    AND (
      score_result IS NULL
      OR (
        (score_result ->> 'schemaVersion') IS NOT DISTINCT FROM '2.0'
        AND (score_result ->> 'sessionId')
          IS NOT DISTINCT FROM session_id::text
        AND (score_result ->> 'caseVersionId')
          IS NOT DISTINCT FROM case_version_id
        AND (score_result #>> '{protocolCatalogRef,id}')
          IS NOT DISTINCT FROM protocol_catalog_id
        AND (score_result #>> '{protocolCatalogRef,version}')
          IS NOT DISTINCT FROM protocol_catalog_version
        AND (score_result #>> '{transcriptFingerprint,value}')
          IS NOT DISTINCT FROM transcript_fingerprint_value
        AND (score_result #>> '{scoringPolicyRef,id}')
          IS NOT DISTINCT FROM scoring_policy_id
        AND (score_result #>> '{scoringPolicyRef,version}')
          IS NOT DISTINCT FROM scoring_policy_version
      )
    )
  ),
  CONSTRAINT session_evaluation_records_v2_lifecycle_check CHECK (
    (
      status = 'EVALUATING'
      AND lease_expires_at IS NOT NULL
      AND lease_expires_at > started_at
      AND completed_at IS NULL
      AND failed_at IS NULL
      AND failure_code IS NULL
      AND evaluation_result IS NULL
      AND score_result IS NULL
    )
    OR (
      status = 'COMPLETED'
      AND lease_expires_at IS NULL
      AND completed_at IS NOT NULL
      AND completed_at >= started_at
      AND failed_at IS NULL
      AND failure_code IS NULL
      AND evaluation_result IS NOT NULL
      AND score_result IS NOT NULL
    )
    OR (
      status = 'FAILED'
      AND lease_expires_at IS NULL
      AND completed_at IS NULL
      AND failed_at IS NOT NULL
      AND failed_at >= started_at
      AND failure_code IS NOT NULL
      AND evaluation_result IS NULL
      AND score_result IS NULL
    )
  ),
  CONSTRAINT session_evaluation_records_v2_failure_code_check CHECK (
    failure_code IS NULL
    OR failure_code = ANY (ARRAY[
      'PROVIDER_FAILURE'::text,
      'INVALID_PROVIDER_RESULT'::text,
      'EVALUATION_FAILURE'::text,
      'SNAPSHOT_DRIFT'::text,
      'INTERNAL_FAILURE'::text
    ])
  )
);

CREATE INDEX session_evaluation_records_v2_recovery_idx
  ON public.session_evaluation_records_v2 (lease_expires_at, session_id)
  WHERE status = 'EVALUATING';

CREATE FUNCTION public.chatusal_v2_session_evaluation_format_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  pinned_case_version_id text;
BEGIN
  SELECT s.case_version_id
    INTO pinned_case_version_id
    FROM public.sessions AS s
    WHERE s.id = NEW.session_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'evaluation session does not exist';
  END IF;

  IF TG_TABLE_NAME = 'session_evaluation_records_v2' THEN
    IF NEW.case_version_id IS DISTINCT FROM pinned_case_version_id THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'v2 evaluation case_version_id must match the pinned session version';
    END IF;

    IF EXISTS (
      SELECT 1
        FROM public.evaluations AS legacy
        WHERE legacy.session_id = NEW.session_id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'session already has a Legacy evaluation';
    END IF;
  ELSIF TG_TABLE_NAME = 'evaluations' THEN
    IF EXISTS (
      SELECT 1
        FROM public.session_evaluation_records_v2 AS v2
        WHERE v2.session_id = NEW.session_id
    ) THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'session already has a v2 evaluation record';
    END IF;
  ELSE
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'evaluation format guard attached to an unexpected table';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER chatusal_v2_session_evaluation_records_format_guard
BEFORE INSERT OR UPDATE ON public.session_evaluation_records_v2
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_session_evaluation_format_guard();

CREATE TRIGGER chatusal_v2_legacy_evaluations_format_guard
BEFORE INSERT OR UPDATE OF session_id ON public.evaluations
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_session_evaluation_format_guard();

CREATE FUNCTION public.chatusal_v2_session_evaluation_lifecycle_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'v2 evaluation lifecycle records cannot be deleted';
  END IF;

  IF NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.case_version_id IS DISTINCT FROM OLD.case_version_id
    OR NEW.result_format IS DISTINCT FROM OLD.result_format
    OR NEW.protocol_catalog_id IS DISTINCT FROM OLD.protocol_catalog_id
    OR NEW.protocol_catalog_version IS DISTINCT FROM OLD.protocol_catalog_version
    OR NEW.scoring_policy_id IS DISTINCT FROM OLD.scoring_policy_id
    OR NEW.scoring_policy_version IS DISTINCT FROM OLD.scoring_policy_version
    OR NEW.transcript_fingerprint_algorithm IS DISTINCT FROM OLD.transcript_fingerprint_algorithm
    OR NEW.transcript_fingerprint_canonicalization IS DISTINCT FROM OLD.transcript_fingerprint_canonicalization
    OR NEW.transcript_fingerprint_value IS DISTINCT FROM OLD.transcript_fingerprint_value
    OR NEW.transcript_snapshot IS DISTINCT FROM OLD.transcript_snapshot
    OR NEW.scoring_policy_snapshot IS DISTINCT FROM OLD.scoring_policy_snapshot
    OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'v2 evaluation snapshot identity and protected snapshots are immutable';
  END IF;

  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'COMPLETED' THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'COMPLETED v2 evaluations are terminal and immutable';
  ELSIF OLD.status = 'FAILED' THEN
    IF NEW.status <> 'EVALUATING'
      OR NEW.attempt_id IS NOT DISTINCT FROM OLD.attempt_id
      OR NEW.attempt_count <> OLD.attempt_count + 1
      OR NEW.started_at < OLD.failed_at THEN
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'FAILED may only transition to a new retry claim';
    END IF;
  ELSIF OLD.status = 'EVALUATING' THEN
    IF NEW.status = 'EVALUATING' THEN
      IF CURRENT_TIMESTAMP < OLD.lease_expires_at
        OR NEW.attempt_id IS NOT DISTINCT FROM OLD.attempt_id
        OR NEW.attempt_count <> OLD.attempt_count + 1
        OR NEW.started_at < OLD.lease_expires_at THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'EVALUATING recovery requires an expired lease and a new incremented attempt';
      END IF;
    ELSIF NEW.status = ANY (ARRAY['COMPLETED'::text, 'FAILED'::text]) THEN
      IF NEW.attempt_id IS DISTINCT FROM OLD.attempt_id
        OR NEW.attempt_count IS DISTINCT FROM OLD.attempt_count
        OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'completion or failure must belong to the current attempt';
      END IF;
    ELSE
      RAISE EXCEPTION USING
        ERRCODE = '23514',
        MESSAGE = 'invalid v2 evaluation lifecycle transition';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER chatusal_v2_session_evaluation_records_lifecycle_guard
BEFORE UPDATE OR DELETE ON public.session_evaluation_records_v2
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_session_evaluation_lifecycle_guard();

CREATE FUNCTION public.chatusal_v2_message_write_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
DECLARE
  target_session_id uuid;
  target_session_status text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.session_id IS DISTINCT FROM OLD.session_id THEN
    RAISE EXCEPTION USING
      ERRCODE = '23514',
      MESSAGE = 'message session_id is immutable';
  END IF;

  target_session_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.session_id
    ELSE NEW.session_id
  END;

  SELECT s.status
    INTO target_session_status
    FROM public.sessions AS s
    WHERE s.id = target_session_id
    FOR UPDATE;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION USING
      ERRCODE = '23503',
      MESSAGE = 'message session does not exist';
  END IF;

  IF target_session_status <> 'active' THEN
    RAISE EXCEPTION USING
      ERRCODE = '55000',
      MESSAGE = 'messages are immutable unless the session is active';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER chatusal_v2_messages_require_active_session
BEFORE INSERT OR UPDATE OR DELETE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.chatusal_v2_message_write_guard();

ALTER TABLE public.session_evaluation_records_v2 ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES
  ON TABLE public.session_evaluation_records_v2
  FROM PUBLIC;
REVOKE ALL PRIVILEGES
  ON SEQUENCE public.session_evaluation_records_v2_id_seq
  FROM PUBLIC;
REVOKE ALL PRIVILEGES
  ON FUNCTION public.chatusal_v2_session_evaluation_format_guard()
  FROM PUBLIC;
REVOKE ALL PRIVILEGES
  ON FUNCTION public.chatusal_v2_session_evaluation_lifecycle_guard()
  FROM PUBLIC;
REVOKE ALL PRIVILEGES
  ON FUNCTION public.chatusal_v2_message_write_guard()
  FROM PUBLIC;

DO $block$
DECLARE
  client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon'::text, 'authenticated'::text]
  LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = client_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.session_evaluation_records_v2 FROM %I',
        client_role
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON SEQUENCE public.session_evaluation_records_v2_id_seq FROM %I',
        client_role
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION public.chatusal_v2_session_evaluation_format_guard() FROM %I',
        client_role
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION public.chatusal_v2_session_evaluation_lifecycle_guard() FROM %I',
        client_role
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON FUNCTION public.chatusal_v2_message_write_guard() FROM %I',
        client_role
      );
    END IF;
  END LOOP;
END;
$block$;

COMMIT;
