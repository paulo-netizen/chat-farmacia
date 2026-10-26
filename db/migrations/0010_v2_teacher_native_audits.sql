BEGIN;
-- Evidence is attached to the existing native candidate, never another case dossier.
CREATE TABLE teacher_native_audit_bindings (
 candidate_version_id text PRIMARY KEY REFERENCES teacher_publication_candidates(candidate_version_id),
 draft_version_id text NOT NULL REFERENCES case_versions(id),
 content_hash text NOT NULL CHECK(content_hash ~ '^[a-f0-9]{64}$'),
 sources jsonb NOT NULL CHECK(jsonb_typeof(sources)='array' AND jsonb_array_length(sources) BETWEEN 1 AND 2),
 sources_hash text NOT NULL CHECK(sources_hash ~ '^[a-f0-9]{64}$'),
 configuration jsonb NOT NULL, configuration_hash text NOT NULL CHECK(configuration_hash ~ '^[a-f0-9]{64}$'),
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 created_by bigint NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teacher_native_audit_claims (
 candidate_version_id text PRIMARY KEY REFERENCES teacher_native_audit_bindings(candidate_version_id),
 created_by bigint NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teacher_native_audit_results (
 candidate_version_id text PRIMARY KEY REFERENCES teacher_native_audit_claims(candidate_version_id),
 result jsonb,error_code text CHECK(error_code='NATIVE_AUDIT_FAILED'),
 created_by bigint NOT NULL REFERENCES users(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((result IS NOT NULL AND error_code IS NULL) OR (result IS NULL AND error_code IS NOT NULL))
);
CREATE TRIGGER native_audit_bindings_immutable BEFORE UPDATE OR DELETE ON teacher_native_audit_bindings FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
CREATE TRIGGER native_audit_claims_immutable BEFORE UPDATE OR DELETE ON teacher_native_audit_claims FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
CREATE TRIGGER native_audit_results_immutable BEFORE UPDATE OR DELETE ON teacher_native_audit_results FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
CREATE FUNCTION chatusal_native_audit_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v case_versions; b teacher_native_audit_bindings;
BEGIN
 SELECT * INTO v FROM case_versions WHERE id=NEW.candidate_version_id;
 IF NOT FOUND OR v.content_format<>'TEACHER_CASE_BUNDLE_V1' OR NOT EXISTS
 (SELECT 1 FROM users u JOIN cases c ON c.id=v.case_id WHERE u.id=NEW.created_by AND u.role IN ('teacher','admin') AND (c.created_by=u.id OR u.role='admin'))
 THEN RAISE EXCEPTION 'invalid native audit actor or candidate'; END IF;
 PERFORM id FROM cases WHERE id=v.case_id FOR UPDATE;
 IF TG_TABLE_NAME<>'teacher_native_audit_results' AND (v.status NOT IN ('TEACHER_DRAFT','IN_REVIEW') OR v.parent_version_id IS DISTINCT FROM
 (SELECT id FROM case_versions WHERE case_id=v.case_id AND content_format='TEACHER_CASE_DRAFT_V1' ORDER BY version_number DESC LIMIT 1))
 THEN RAISE EXCEPTION 'native audit revision is not current'; END IF;
 IF TG_TABLE_NAME='teacher_native_audit_bindings' THEN
  IF NEW.draft_version_id IS DISTINCT FROM v.parent_version_id OR NEW.content_hash IS DISTINCT FROM encode(digest(v.content::text,'sha256'),'hex') THEN RAISE EXCEPTION 'native audit binding mismatch'; END IF;
 ELSIF TG_TABLE_NAME='teacher_native_audit_results' THEN
 IF NEW.result IS NOT NULL THEN
  SELECT * INTO b FROM teacher_native_audit_bindings WHERE candidate_version_id=v.id;
  IF NEW.result->>'requestHash' IS DISTINCT FROM b.request_hash OR NEW.result->>'version' IS DISTINCT FROM 'teacher-clinical-auditor/1' OR NEW.result->>'model' IS DISTINCT FROM b.configuration#>>'{wire,model}' OR jsonb_typeof(NEW.result#>'{judgment,dimensions}') IS DISTINCT FROM 'array' OR jsonb_array_length(NEW.result#>'{judgment,dimensions}')<>12
  THEN RAISE EXCEPTION 'native audit result mismatch'; END IF;
 END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER native_audit_binding_guard BEFORE INSERT ON teacher_native_audit_bindings FOR EACH ROW EXECUTE FUNCTION chatusal_native_audit_guard();
CREATE TRIGGER native_audit_claim_guard BEFORE INSERT ON teacher_native_audit_claims FOR EACH ROW EXECUTE FUNCTION chatusal_native_audit_guard();
CREATE TRIGGER native_audit_result_guard BEFORE INSERT ON teacher_native_audit_results FOR EACH ROW EXECUTE FUNCTION chatusal_native_audit_guard();
CREATE FUNCTION chatusal_native_audit_status(candidate text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE b teacher_native_audit_bindings; r jsonb; statuses text[];
BEGIN
 SELECT * INTO b FROM teacher_native_audit_bindings WHERE candidate_version_id=candidate;
 IF NOT FOUND THEN RETURN 'PENDING'; END IF;
 SELECT result INTO r FROM teacher_native_audit_results WHERE candidate_version_id=candidate;
 IF r IS NULL THEN RETURN 'PENDING'; END IF;
 IF (SELECT count(DISTINCT d->>'id') FROM jsonb_array_elements(r#>'{judgment,dimensions}') d WHERE d->>'id' IN ('problem_treatment','regimen','context','prm','rnm','adherence_barrier','barrier_strategy','intervention','referral','internal_consistency','spain','questionnaire'))<>12 THEN RETURN 'FAIL'; END IF;
 SELECT array_agg(d->>'status') INTO statuses FROM jsonb_array_elements(r#>'{judgment,dimensions}') d;
 IF 'FAIL'=ANY(statuses) THEN RETURN 'FAIL'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(b.sources) s WHERE s->>'status' IS DISTINCT FROM 'AVAILABLE') OR EXISTS(SELECT 1 FROM unnest(statuses) s WHERE s IS NULL OR s NOT IN ('PASS','WARNING')) THEN RETURN 'PENDING'; END IF;
 IF 'WARNING'=ANY(statuses) THEN RETURN 'WARNING'; END IF;
 RETURN 'PASS';
END; $$;
-- Preserve the historical guard, changing only native candidates' evidence source.
DO $$ DECLARE definition text; BEGIN
 definition:=pg_get_functiondef('public.chatusal_editorial_publication_guard()'::regprocedure);
 IF position('binding.audit_status NOT IN' in definition)=0 THEN RAISE EXCEPTION 'unexpected editorial guard version'; END IF;
 definition:=replace(definition,'binding.audit_status NOT IN','(CASE WHEN NEW.content_format=''TEACHER_CASE_BUNDLE_V1'' THEN chatusal_native_audit_status(NEW.id) ELSE binding.audit_status END) NOT IN');
 EXECUTE definition;
END; $$;
COMMIT;
