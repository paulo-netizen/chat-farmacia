BEGIN;
CREATE TABLE case_result_policies (
 case_version_id text PRIMARY KEY REFERENCES case_versions(id), policy jsonb NOT NULL,
 created_by bigint NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(policy->>'version'='result-policy/1'),CHECK(policy->>'release' IN ('AFTER_SUBMISSION','TEACHER_REVIEW'))
);
CREATE TRIGGER result_policy_immutable BEFORE UPDATE OR DELETE ON case_result_policies FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
CREATE FUNCTION chatusal_result_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users u JOIN case_versions v ON v.id=NEW.case_version_id JOIN cases c ON c.id=v.case_id WHERE u.id=NEW.created_by AND u.role IN ('teacher','admin') AND (c.created_by=u.id OR u.role='admin')) THEN RAISE EXCEPTION 'result policy not authorized'; END IF;
 IF coalesce(NEW.policy->>'scope','') NOT IN ('SYNTHETIC_TEST','ACADEMIC_APPROVED') OR coalesce(NEW.policy->>'approvalReference','')='' THEN RAISE EXCEPTION 'explicit result policy required'; END IF;
 IF NEW.policy->>'scope'='SYNTHETIC_TEST' AND NOT EXISTS(SELECT 1 FROM pg_database WHERE datname=current_database() AND shobj_description(oid,'pg_database')='teacher-editor-20261012-disposable') THEN RAISE EXCEPTION 'synthetic results require disposable database'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER result_policy_guard BEFORE INSERT ON case_result_policies FOR EACH ROW EXECUTE FUNCTION chatusal_result_policy_guard();
CREATE TABLE session_result_releases (
 session_id uuid NOT NULL REFERENCES sessions(id),fingerprint text NOT NULL CHECK(fingerprint ~ '^[0-9a-f]{64}$'),
 case_version_id text NOT NULL REFERENCES case_versions(id),released_by bigint NOT NULL REFERENCES users(id),
 snapshot jsonb NOT NULL,released_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(session_id,fingerprint)
);
CREATE TRIGGER result_release_immutable BEFORE UPDATE OR DELETE ON session_result_releases FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
CREATE FUNCTION chatusal_result_release_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM sessions s JOIN cases c ON c.id=s.case_id JOIN users u ON u.id=NEW.released_by JOIN session_questionnaires q ON q.session_id=s.id WHERE s.id=NEW.session_id AND s.case_version_id=NEW.case_version_id AND q.submitted_at IS NOT NULL AND u.role IN ('teacher','admin') AND (u.role='admin' OR c.created_by=u.id)) THEN RAISE EXCEPTION 'result release not authorized'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER result_release_guard BEFORE INSERT ON session_result_releases FOR EACH ROW EXECUTE FUNCTION chatusal_result_release_guard();
ALTER TABLE case_result_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_result_releases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON case_result_policies,session_result_releases FROM PUBLIC;
COMMIT;
