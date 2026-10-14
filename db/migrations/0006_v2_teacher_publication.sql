BEGIN;
-- Editorial bindings only. Authoring-only snapshots remain unpublishable.
CREATE TABLE teacher_publication_candidates (
 candidate_version_id text PRIMARY KEY REFERENCES case_versions(id),
 draft_version_id text NOT NULL REFERENCES case_versions(id),
 case_id bigint NOT NULL REFERENCES cases(id),
 audit_status text NOT NULL CHECK (audit_status IN ('PENDING','PASS','WARNING','FAIL')),
 audit_reference text NOT NULL CHECK (length(audit_reference) BETWEEN 1 AND 200),
 audit_kind text NOT NULL CHECK (audit_kind IN ('AUTOMATED','SYNTHETIC_TEST')),
 created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE teacher_publication_approvals (
 candidate_version_id text PRIMARY KEY REFERENCES teacher_publication_candidates(candidate_version_id),
 reviewer_id bigint NOT NULL REFERENCES users(id),
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 note text NOT NULL CHECK (length(trim(note)) BETWEEN 10 AND 2000)
);
CREATE FUNCTION chatusal_editorial_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='editorial evidence is append only'; END; $$;
CREATE TRIGGER editorial_candidates_immutable BEFORE UPDATE OR DELETE ON teacher_publication_candidates FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
CREATE TRIGGER editorial_approvals_immutable BEFORE UPDATE OR DELETE ON teacher_publication_approvals FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
CREATE FUNCTION chatusal_editorial_binding_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM case_versions candidate JOIN case_versions draft ON draft.id=NEW.draft_version_id
  JOIN cases c ON c.id=NEW.case_id JOIN users u ON u.id=NEW.created_by
  WHERE candidate.id=NEW.candidate_version_id AND candidate.case_id=NEW.case_id AND draft.case_id=NEW.case_id
  AND candidate.parent_version_id=draft.id AND candidate.content_format='GENERATED_CASE_BUNDLE_V2'
  AND candidate.status IN ('AI_DRAFT','TEACHER_DRAFT','IN_REVIEW') AND draft.content_format='TEACHER_CASE_DRAFT_V1'
  AND u.role IN ('teacher','admin') AND (c.created_by=u.id OR u.role='admin')
 ) THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='invalid editorial binding'; END IF;
 IF NEW.audit_kind='SYNTHETIC_TEST' AND (current_database()<>'chatusal_editor_disposable' OR
  (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'teacher-editor-20261012-disposable') THEN
  RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='synthetic audit requires verified disposable database';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER editorial_binding_guard BEFORE INSERT ON teacher_publication_candidates FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_binding_guard();
CREATE FUNCTION chatusal_editorial_publication_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE binding teacher_publication_candidates; reviewer_role text;
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status NOT IN ('VALIDATED','PUBLISHED') THEN RETURN NEW; END IF;
 -- Scope: any logical case opened in the structured editor, including candidates not registered yet.
 IF NOT EXISTS (SELECT 1 FROM case_versions WHERE case_id=NEW.case_id AND content_format='TEACHER_CASE_DRAFT_V1') THEN RETURN NEW; END IF;
 -- Same lock as draft saves/publication: an edit cannot race approval/publication.
 PERFORM id FROM cases WHERE id=NEW.case_id FOR UPDATE;
 SELECT * INTO binding FROM teacher_publication_candidates WHERE candidate_version_id=NEW.id AND case_id=NEW.case_id;
 IF NOT FOUND OR binding.audit_status NOT IN ('PASS','WARNING') OR binding.draft_version_id IS DISTINCT FROM
   (SELECT id FROM case_versions WHERE case_id=NEW.case_id AND content_format='TEACHER_CASE_DRAFT_V1' ORDER BY version_number DESC LIMIT 1)
 THEN RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='editorial candidate or audit is not current'; END IF;
 IF binding.audit_kind='SYNTHETIC_TEST' AND (current_database()<>'chatusal_editor_disposable' OR
  (SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM 'teacher-editor-20261012-disposable') THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='synthetic audit cannot authorize publication outside disposable database';
 END IF;
 SELECT u.role INTO reviewer_role FROM teacher_publication_approvals a JOIN users u ON u.id=a.reviewer_id
 WHERE a.candidate_version_id=NEW.id;
 IF reviewer_role IS NULL OR reviewer_role NOT IN ('teacher','admin') THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='current teacher approval required';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER chatusal_editorial_publication_guard BEFORE UPDATE ON case_versions FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_publication_guard();
COMMIT;
