BEGIN;
CREATE TABLE teacher_academic_preparations (
 id text PRIMARY KEY,
 case_id bigint NOT NULL REFERENCES cases(id),
 draft_version_id text NOT NULL REFERENCES case_versions(id),
 created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 package jsonb NOT NULL,
 audit jsonb NOT NULL,
 CHECK(package->>'contractVersion'='teacher-academic-preparation/1'),
 CHECK(package->>'draftVersionId'=draft_version_id),
 CHECK(audit->>'contractVersion'='teacher-clinical-audit/1'),
 CHECK(audit->>'draftVersionId'=draft_version_id),
 CHECK(audit->>'status'='PENDING')
);
CREATE FUNCTION chatusal_preparation_binding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM id FROM cases WHERE id=NEW.case_id FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM case_versions v JOIN cases c ON c.id=v.case_id JOIN users u ON u.id=NEW.created_by
  WHERE v.id=NEW.draft_version_id AND v.case_id=NEW.case_id AND v.content_format='TEACHER_CASE_DRAFT_V1'
  AND v.status='TEACHER_DRAFT' AND u.role IN ('teacher','admin') AND (u.role='admin' OR c.created_by=u.id))
 OR NEW.draft_version_id IS DISTINCT FROM (SELECT id FROM case_versions WHERE case_id=NEW.case_id AND content_format='TEACHER_CASE_DRAFT_V1' ORDER BY version_number DESC LIMIT 1)
 THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='preparation requires current owned draft'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER preparation_binding BEFORE INSERT ON teacher_academic_preparations FOR EACH ROW EXECUTE FUNCTION chatusal_preparation_binding_guard();
CREATE TRIGGER preparation_immutable BEFORE UPDATE OR DELETE ON teacher_academic_preparations FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
COMMIT;
