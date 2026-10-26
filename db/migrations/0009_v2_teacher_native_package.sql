BEGIN;
-- Preserve historical constraints verbatim, adding an explicitly versioned native
-- teacher format. No backfill, approvals, publication or application data changes.
DO $$
DECLARE c record; extra text;
BEGIN
 FOR c IN SELECT conname,pg_get_expr(conbin,conrelid) expression FROM pg_constraint
  WHERE conrelid='public.case_versions'::regclass AND conname IN
   ('case_versions_content_format_check','case_versions_source_format_check','case_versions_content_contract_check')
 LOOP
  extra := CASE c.conname
   WHEN 'case_versions_content_format_check' THEN $e$content_format='TEACHER_CASE_BUNDLE_V1'$e$
   WHEN 'case_versions_source_format_check' THEN $e$content_format='TEACHER_CASE_BUNDLE_V1' AND source_kind='TEACHER_AUTHORED' AND legacy_status IS NULL$e$
   ELSE $e$content_format='TEACHER_CASE_BUNDLE_V1'
    AND (content->>'schemaVersion') IS NOT DISTINCT FROM 'teacher-case-bundle/1'
    AND (content#>>'{sourceOfTruth,caseVersionId}') IS NOT DISTINCT FROM id
    AND (content#>>'{sourceOfTruth,patientFacts,caseVersionId}') IS NOT DISTINCT FROM id
    AND (content#>>'{sourceOfTruth,evaluator,caseVersionId}') IS NOT DISTINCT FROM id
    AND (content#>>'{derived,patientRuntime,caseVersionId}') IS NOT DISTINCT FROM id
    AND (content#>>'{sourceDraft,versionId}') IS NOT DISTINCT FROM parent_version_id
    AND (content#>>'{sourceDraft,approval}') IS NOT DISTINCT FROM 'PENDING'$e$ END;
  EXECUTE format('ALTER TABLE public.case_versions DROP CONSTRAINT %I',c.conname);
  EXECUTE format('ALTER TABLE public.case_versions ADD CONSTRAINT %I CHECK ((%s) OR (%s))',c.conname,c.expression,extra);
 END LOOP;
END; $$;
CREATE UNIQUE INDEX teacher_native_revision_once ON case_versions(parent_version_id)
 WHERE content_format='TEACHER_CASE_BUNDLE_V1';
-- Existing trigger bodies are retained, changing only the two format predicates.
DO $$
DECLARE definition text;
BEGIN
 definition:=pg_get_functiondef('public.chatusal_v2_case_version_validate_insert()'::regprocedure);
 IF position('NEW.content_format <> ''TEACHER_CASE_DRAFT_V1''' in definition)=0 THEN RAISE EXCEPTION 'unexpected authoring guard version'; END IF;
 definition:=replace(definition,'NEW.content_format <> ''TEACHER_CASE_DRAFT_V1''','NEW.content_format NOT IN (''TEACHER_CASE_DRAFT_V1'',''TEACHER_CASE_BUNDLE_V1'')');
 EXECUTE definition;
 definition:=pg_get_functiondef('public.chatusal_editorial_binding_guard()'::regprocedure);
 IF position('candidate.content_format=''GENERATED_CASE_BUNDLE_V2''' in definition)=0 THEN RAISE EXCEPTION 'unexpected editorial guard version'; END IF;
 definition:=replace(definition,'candidate.content_format=''GENERATED_CASE_BUNDLE_V2''','candidate.content_format IN (''GENERATED_CASE_BUNDLE_V2'',''TEACHER_CASE_BUNDLE_V1'')');
 EXECUTE definition;
END; $$;
COMMIT;
