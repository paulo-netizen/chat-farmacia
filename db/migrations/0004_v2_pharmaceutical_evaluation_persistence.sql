BEGIN;

-- Privileged server storage only. No student DTOs, raw responses or runtime witnesses.
-- Header omits attempts; the append-only attempt rows reconstruct the P1 record.
CREATE TABLE public.pharmaceutical_evaluations_v2 (
  evaluation_id uuid PRIMARY KEY,
  owner_id bigint NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE RESTRICT,
  case_version_id text NOT NULL REFERENCES public.case_versions(id) ON DELETE RESTRICT,
  idempotency_key uuid NOT NULL,
  supersedes_id uuid REFERENCES public.pharmaceutical_evaluations_v2(evaluation_id) ON DELETE RESTRICT,
  revision bigint NOT NULL CHECK (revision BETWEEN 0 AND 9007199254740991),
  status text NOT NULL CHECK (status IN ('PENDING','EVALUATING','COMPLETED','FAILED')),
  source_hash text NOT NULL CHECK (source_hash ~ '^[0-9a-f]{64}$'),
  header jsonb NOT NULL,
  UNIQUE (owner_id,session_id,idempotency_key),
  CHECK (jsonb_typeof(header) = 'object' AND NOT header ? 'attempts'),
  CHECK ((header->>'evaluationId') IS NOT DISTINCT FROM evaluation_id::text),
  CHECK ((header->>'revision') IS NOT DISTINCT FROM revision::text),
  CHECK ((header->>'status') IS NOT DISTINCT FROM status),
  CHECK ((header->>'schemaVersion') IS NOT DISTINCT FROM '2.0'),
  CHECK ((header->>'contractVersion') IS NOT DISTINCT FROM 'pharmaceutical-evaluation-record/1'),
  CHECK ((header#>>'{intent,ownerId}') IS NOT DISTINCT FROM owner_id::text),
  CHECK ((header#>>'{intent,sessionId}') IS NOT DISTINCT FROM session_id::text),
  CHECK ((header#>>'{intent,caseVersionId}') IS NOT DISTINCT FROM case_version_id),
  CHECK ((header#>>'{intent,idempotencyKey}') IS NOT DISTINCT FROM idempotency_key::text),
  CHECK ((header#>>'{intent,supersedesEvaluationId}') IS NOT DISTINCT FROM supersedes_id::text),
  CHECK ((header#>>'{intent,sources,fingerprint,value}') IS NOT DISTINCT FROM source_hash)
);
CREATE TABLE public.pharmaceutical_evaluation_artifacts_v2 (
  evaluation_id uuid NOT NULL REFERENCES public.pharmaceutical_evaluations_v2(evaluation_id) ON DELETE RESTRICT,
  artifact_hash text NOT NULL CHECK (artifact_hash ~ '^[0-9a-f]{64}$'),
  kind text NOT NULL CHECK (kind IN ('SOURCES','RESULT')),
  reference jsonb NOT NULL,
  -- Preserve existing nested serialization-sensitive D1 fingerprints. Do not normalize to jsonb.
  payload json NOT NULL CHECK (json_typeof(payload) = 'object'),
  PRIMARY KEY (evaluation_id,artifact_hash),
  CHECK ((reference->>'kind') IS NOT DISTINCT FROM kind),
  CHECK ((reference#>>'{fingerprint,value}') IS NOT DISTINCT FROM artifact_hash)
);
ALTER TABLE public.pharmaceutical_evaluations_v2 ADD CONSTRAINT pharmaceutical_source_fk
  FOREIGN KEY (evaluation_id,source_hash) REFERENCES public.pharmaceutical_evaluation_artifacts_v2(evaluation_id,artifact_hash)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;
CREATE TABLE public.pharmaceutical_evaluation_attempts_v2 (
  evaluation_id uuid NOT NULL REFERENCES public.pharmaceutical_evaluations_v2(evaluation_id) ON DELETE RESTRICT,
  attempt_id uuid NOT NULL UNIQUE,
  fencing_token bigint NOT NULL CHECK (fencing_token BETWEEN 1 AND 9007199254740991),
  status text NOT NULL CHECK (status IN ('EVALUATING','COMPLETED','FAILED')),
  lease_expires_at timestamptz NOT NULL,
  result_hash text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  PRIMARY KEY (evaluation_id,fencing_token),
  FOREIGN KEY (evaluation_id,result_hash) REFERENCES public.pharmaceutical_evaluation_artifacts_v2(evaluation_id,artifact_hash) ON DELETE RESTRICT,
  CHECK ((payload->>'attemptId') IS NOT DISTINCT FROM attempt_id::text),
  CHECK ((payload->>'fencingToken') IS NOT DISTINCT FROM fencing_token::text),
  CHECK ((payload->>'status') IS NOT DISTINCT FROM status),
  CHECK ((payload->>'leaseExpiresAt')::timestamptz IS NOT DISTINCT FROM lease_expires_at),
  CHECK ((payload#>>'{result,fingerprint,value}') IS NOT DISTINCT FROM result_hash),
  CHECK ((status='COMPLETED' AND result_hash IS NOT NULL AND payload ? 'completedAt' AND NOT payload ? 'failure')
    OR (status='FAILED' AND result_hash IS NULL AND NOT payload ? 'result' AND payload ? 'failure' AND payload ? 'failedAt' AND NOT payload ? 'completedAt')
    OR (status='EVALUATING' AND result_hash IS NULL AND NOT payload ? 'result' AND NOT payload ? 'failure' AND NOT payload ? 'failedAt' AND NOT payload ? 'completedAt'))
);
CREATE INDEX pharmaceutical_evaluation_session_idx ON public.pharmaceutical_evaluations_v2(session_id,owner_id);
CREATE INDEX pharmaceutical_evaluation_pending_idx ON public.pharmaceutical_evaluations_v2(status) WHERE status IN ('PENDING','FAILED');
CREATE INDEX pharmaceutical_evaluation_expiry_idx ON public.pharmaceutical_evaluation_attempts_v2(lease_expires_at) WHERE status='EVALUATING';

CREATE FUNCTION public.guard_pharmaceutical_evaluation_v2() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'PHARMACEUTICAL_IMMUTABLE'; END IF;
  IF TG_OP='UPDATE' AND (OLD.status='COMPLETED' OR NEW.evaluation_id<>OLD.evaluation_id
    OR NEW.header->'intent' IS DISTINCT FROM OLD.header->'intent'
    OR NEW.header->'intentFingerprint' IS DISTINCT FROM OLD.header->'intentFingerprint'
    OR NEW.header->'createdAt' IS DISTINCT FROM OLD.header->'createdAt'
    OR NEW.revision<>OLD.revision+1) THEN RAISE EXCEPTION 'PHARMACEUTICAL_IMMUTABLE'; END IF;
  PERFORM 1 FROM public.sessions WHERE id=NEW.session_id AND user_id=NEW.owner_id AND case_version_id=NEW.case_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PHARMACEUTICAL_BINDING'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pharmaceutical_evaluation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.pharmaceutical_evaluations_v2
  FOR EACH ROW EXECUTE FUNCTION public.guard_pharmaceutical_evaluation_v2();
CREATE FUNCTION public.guard_pharmaceutical_attempt_v2() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'PHARMACEUTICAL_IMMUTABLE'; END IF;
  IF TG_OP='UPDATE' AND (OLD.status<>'EVALUATING' OR NEW.status='EVALUATING'
    OR NEW.evaluation_id<>OLD.evaluation_id OR NEW.attempt_id<>OLD.attempt_id OR NEW.fencing_token<>OLD.fencing_token
    OR (NEW.payload - ARRAY['status','completedAt','result','failedAt','failure']) IS DISTINCT FROM OLD.payload - 'status')
  THEN RAISE EXCEPTION 'PHARMACEUTICAL_IMMUTABLE'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pharmaceutical_attempt_guard BEFORE UPDATE OR DELETE ON public.pharmaceutical_evaluation_attempts_v2
  FOR EACH ROW EXECUTE FUNCTION public.guard_pharmaceutical_attempt_v2();
CREATE FUNCTION public.guard_pharmaceutical_artifact_v2() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'PHARMACEUTICAL_IMMUTABLE'; END $$;
CREATE TRIGGER pharmaceutical_artifact_guard BEFORE UPDATE OR DELETE ON public.pharmaceutical_evaluation_artifacts_v2
  FOR EACH ROW EXECUTE FUNCTION public.guard_pharmaceutical_artifact_v2();

-- Deferred aggregate consistency: a transaction cannot commit a header without its current attempt.
CREATE FUNCTION public.check_pharmaceutical_aggregate_v2() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE e public.pharmaceutical_evaluations_v2; a public.pharmaceutical_evaluation_attempts_v2; n bigint;
BEGIN
  SELECT * INTO STRICT e FROM public.pharmaceutical_evaluations_v2 WHERE evaluation_id=NEW.evaluation_id;
  SELECT count(*) INTO n FROM public.pharmaceutical_evaluation_attempts_v2 WHERE evaluation_id=e.evaluation_id;
  SELECT * INTO a FROM public.pharmaceutical_evaluation_attempts_v2 WHERE evaluation_id=e.evaluation_id ORDER BY fencing_token DESC LIMIT 1;
  IF (n=0 AND (e.status<>'PENDING' OR e.revision<>0)) OR (n>0 AND (a.status<>e.status OR a.fencing_token<>n
    OR e.revision<>2*n-CASE WHEN a.status='EVALUATING' THEN 1 ELSE 0 END))
    OR EXISTS (SELECT 1 FROM public.pharmaceutical_evaluation_attempts_v2 WHERE evaluation_id=e.evaluation_id AND fencing_token<n AND status<>'FAILED')
    OR NOT EXISTS (SELECT 1 FROM public.pharmaceutical_evaluation_artifacts_v2 WHERE evaluation_id=e.evaluation_id AND artifact_hash=e.source_hash AND kind='SOURCES')
    OR EXISTS (SELECT 1 FROM public.pharmaceutical_evaluation_attempts_v2 t JOIN public.pharmaceutical_evaluation_artifacts_v2 r ON r.evaluation_id=t.evaluation_id AND r.artifact_hash=t.result_hash WHERE t.evaluation_id=e.evaluation_id AND r.kind<>'RESULT')
  THEN RAISE EXCEPTION 'PHARMACEUTICAL_AGGREGATE'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER pharmaceutical_header_consistency AFTER INSERT OR UPDATE ON public.pharmaceutical_evaluations_v2
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_pharmaceutical_aggregate_v2();
CREATE CONSTRAINT TRIGGER pharmaceutical_attempt_consistency AFTER INSERT OR UPDATE ON public.pharmaceutical_evaluation_attempts_v2
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_pharmaceutical_aggregate_v2();

ALTER TABLE public.pharmaceutical_evaluations_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmaceutical_evaluation_attempts_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmaceutical_evaluation_artifacts_v2 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pharmaceutical_evaluations_v2, public.pharmaceutical_evaluation_attempts_v2, public.pharmaceutical_evaluation_artifacts_v2 FROM PUBLIC;
DO $$ DECLARE r text; BEGIN
  FOREACH r IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=r) THEN
      EXECUTE format('REVOKE ALL ON public.pharmaceutical_evaluations_v2, public.pharmaceutical_evaluation_attempts_v2, public.pharmaceutical_evaluation_artifacts_v2 FROM %I',r);
    END IF;
  END LOOP;
END $$;
COMMIT;
