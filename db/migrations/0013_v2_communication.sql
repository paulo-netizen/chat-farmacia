BEGIN;
-- M7 uses existing session/message locking, version IDs and M9 release policies.
CREATE TABLE session_communication_evaluations (
 session_id uuid PRIMARY KEY REFERENCES sessions(id),
 case_version_id text NOT NULL REFERENCES case_versions(id),
 attempt_id uuid NOT NULL, status text NOT NULL CHECK(status IN ('EVALUATING','COMPLETED','FAILED')),
 input jsonb NOT NULL, configuration jsonb NOT NULL, runtime_id text NOT NULL, output jsonb,
 failure_code text, created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
 CHECK((status='EVALUATING' AND output IS NULL AND failure_code IS NULL AND completed_at IS NULL)
 OR (status='COMPLETED' AND output IS NOT NULL AND failure_code IS NULL AND completed_at IS NOT NULL)
 OR (status='FAILED' AND output IS NULL AND failure_code IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE FUNCTION chatusal_communication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'communication history immutable'; END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.status<>'EVALUATING' OR NEW.status NOT IN ('COMPLETED','FAILED') OR
   (to_jsonb(OLD)-ARRAY['status','output','failure_code','completed_at']) IS DISTINCT FROM
   (to_jsonb(NEW)-ARRAY['status','output','failure_code','completed_at']) THEN RAISE EXCEPTION 'communication transition invalid'; END IF;
 ELSE
  PERFORM 1 FROM sessions WHERE id=NEW.session_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM sessions s JOIN users u ON u.id=NEW.created_by JOIN cases c ON c.id=s.case_id
   WHERE s.id=NEW.session_id AND s.case_version_id=NEW.case_version_id AND s.status='finished'
   AND u.role IN ('teacher','admin') AND (u.role='admin' OR c.created_by=u.id)) THEN RAISE EXCEPTION 'communication not authorized'; END IF;
  IF NEW.status<>'EVALUATING' OR (NEW.input->>'scope') IS DISTINCT FROM 'SYNTHETIC_TEST'
   OR (NEW.input#>>'{transcript,sessionId}') IS DISTINCT FROM NEW.session_id::text
   OR (NEW.input#>>'{transcript,caseVersionId}') IS DISTINCT FROM NEW.case_version_id OR NOT EXISTS
   (SELECT 1 FROM pg_database WHERE datname=current_database() AND shobj_description(oid,'pg_database')='teacher-editor-20261012-disposable')
   THEN RAISE EXCEPTION 'communication academic execution blocked'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER communication_guard BEFORE INSERT OR UPDATE OR DELETE ON session_communication_evaluations FOR EACH ROW EXECUTE FUNCTION chatusal_communication_guard();
ALTER TABLE session_communication_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON session_communication_evaluations FROM PUBLIC;
COMMIT;
