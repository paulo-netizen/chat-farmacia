BEGIN;
-- Apply only in a coordinated deployment. Tested on disposable PostgreSQL only.
-- No backfill, publication, student session or historical snapshot changes.
ALTER TABLE public.case_versions DROP CONSTRAINT case_versions_content_format_check;
ALTER TABLE public.case_versions ADD CONSTRAINT case_versions_content_format_check CHECK
 (content_format IN ('GENERATED_CASE_BUNDLE_V2','LEGACY_V1_SNAPSHOT','TEACHER_CASE_DRAFT_V1'));
ALTER TABLE public.case_versions DROP CONSTRAINT case_versions_source_format_check;
ALTER TABLE public.case_versions ADD CONSTRAINT case_versions_source_format_check CHECK ((
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
  ) OR (source_kind='TEACHER_AUTHORED' AND content_format='TEACHER_CASE_DRAFT_V1' AND legacy_status IS NULL));
ALTER TABLE public.case_versions DROP CONSTRAINT case_versions_content_contract_check;
ALTER TABLE public.case_versions ADD CONSTRAINT case_versions_content_contract_check CHECK ((
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
  ) OR (content_format='TEACHER_CASE_DRAFT_V1' AND (content->>'schemaVersion') IS NOT DISTINCT FROM 'teacher-case-draft/1' AND (content->>'caseVersionId') IS NOT DISTINCT FROM id AND COALESCE((content->>'templateId') IN ('lucia','maria'),false) AND jsonb_typeof(content->'fields') IS NOT DISTINCT FROM 'object'));
ALTER TABLE public.case_versions ADD CONSTRAINT teacher_draft_never_publish CHECK
 (content_format <> 'TEACHER_CASE_DRAFT_V1' OR status IN ('TEACHER_DRAFT','ARCHIVED'));
CREATE OR REPLACE FUNCTION public.chatusal_v2_case_version_validate_insert()
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
  ELSIF NEW.source_kind = 'TEACHER_AUTHORED' THEN
    IF NOT EXISTS (SELECT 1 FROM public.cases WHERE id=NEW.case_id AND status='rejected') THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'teacher draft requires an unavailable logical case';
    END IF;
    IF NEW.status <> 'TEACHER_DRAFT' OR NEW.content_format <> 'TEACHER_CASE_DRAFT_V1' OR NEW.legacy_status IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'teacher authoring requires draft format and status';
    END IF;
  ELSE
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'unsupported source kind';
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


-- Legacy routes must never make these authoring-only logical cases assignable.
CREATE FUNCTION public.chatusal_teacher_draft_case_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='approved' AND EXISTS (
   SELECT 1 FROM public.case_versions WHERE case_id=NEW.id AND content_format='TEACHER_CASE_DRAFT_V1'
 ) THEN
   RAISE EXCEPTION USING ERRCODE='23514', MESSAGE='authoring-only case cannot be approved';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER chatusal_teacher_draft_case_guard BEFORE UPDATE ON public.cases
 FOR EACH ROW EXECUTE FUNCTION public.chatusal_teacher_draft_case_guard();
COMMIT;
