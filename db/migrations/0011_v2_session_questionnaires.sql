BEGIN;
CREATE TABLE case_questionnaire_policies (
 case_version_id text PRIMARY KEY REFERENCES case_versions(id),
 policy jsonb NOT NULL CHECK(policy->>'version'='questionnaire-policy/1'),
 created_by bigint NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE session_questionnaires (
 session_id uuid PRIMARY KEY REFERENCES sessions(id),case_version_id text NOT NULL REFERENCES case_versions(id),
 definition jsonb NOT NULL, answers jsonb NOT NULL DEFAULT '[]', revision integer NOT NULL DEFAULT 0 CHECK(revision>=0),
 submitted_at timestamptz,grade jsonb,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((submitted_at IS NULL AND grade IS NULL) OR (submitted_at IS NOT NULL AND grade IS NOT NULL)),
 CHECK(definition->>'version'='session-questionnaire/1' AND definition->>'caseVersionId'=case_version_id)
);
CREATE TRIGGER questionnaire_policy_immutable BEFORE UPDATE OR DELETE ON case_questionnaire_policies FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
CREATE FUNCTION chatusal_questionnaire_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users u JOIN case_versions v ON v.id=NEW.case_version_id JOIN cases c ON c.id=v.case_id WHERE u.id=NEW.created_by AND u.role IN ('teacher','admin') AND (c.created_by=u.id OR u.role='admin') AND v.content_format='TEACHER_CASE_BUNDLE_V1') THEN RAISE EXCEPTION 'questionnaire policy not authorized'; END IF;
 IF NEW.policy->>'scope'='SYNTHETIC_TEST' AND NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND shobj_description(oid,'pg_database')='teacher-editor-20261012-disposable') THEN RAISE EXCEPTION 'synthetic questionnaire requires disposable database'; END IF;
 IF coalesce(NEW.policy->>'scope','') NOT IN ('SYNTHETIC_TEST','ACADEMIC_APPROVED') OR coalesce(NEW.policy->>'approvalReference','')='' THEN RAISE EXCEPTION 'explicit questionnaire policy required'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER questionnaire_policy_guard BEFORE INSERT ON case_questionnaire_policies FOR EACH ROW EXECUTE FUNCTION chatusal_questionnaire_policy_guard();
CREATE FUNCTION chatusal_questionnaire_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s sessions;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'questionnaire submission history is immutable'; END IF;
 SELECT * INTO s FROM sessions WHERE id=NEW.session_id FOR UPDATE;
 IF NOT FOUND OR s.status<>'finished' OR s.case_version_id IS DISTINCT FROM NEW.case_version_id THEN RAISE EXCEPTION 'questionnaire requires closed pinned session'; END IF;
 IF TG_OP='INSERT' THEN
  IF NOT EXISTS(SELECT 1 FROM case_questionnaire_policies p WHERE p.case_version_id=NEW.case_version_id AND p.policy=NEW.definition->'policy') THEN RAISE EXCEPTION 'questionnaire policy binding mismatch'; END IF;
 ELSE
  IF OLD.submitted_at IS NOT NULL OR NEW.definition IS DISTINCT FROM OLD.definition OR NEW.case_version_id IS DISTINCT FROM OLD.case_version_id OR NEW.session_id IS DISTINCT FROM OLD.session_id OR NEW.created_at IS DISTINCT FROM OLD.created_at OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'questionnaire immutable binding or revision'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER questionnaire_guard BEFORE INSERT OR UPDATE OR DELETE ON session_questionnaires FOR EACH ROW EXECUTE FUNCTION chatusal_questionnaire_guard();
CREATE FUNCTION chatusal_questionnaire_session_closed() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM session_questionnaires WHERE session_id=OLD.id) AND (NEW.status IS DISTINCT FROM 'finished' OR NEW.finished_at IS DISTINCT FROM OLD.finished_at) THEN RAISE EXCEPTION 'questionnaire session cannot reopen'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER questionnaire_session_closed BEFORE UPDATE ON sessions FOR EACH ROW EXECUTE FUNCTION chatusal_questionnaire_session_closed();
ALTER TABLE case_questionnaire_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_questionnaires ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON case_questionnaire_policies,session_questionnaires FROM PUBLIC;
COMMIT;
