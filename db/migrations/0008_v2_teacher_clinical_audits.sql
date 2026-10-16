BEGIN;
CREATE TABLE teacher_clinical_audits (
 id text PRIMARY KEY,
 preparation_id text NOT NULL UNIQUE REFERENCES teacher_academic_preparations(id),
 created_by bigint NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 result jsonb NOT NULL CHECK(result->>'version'='teacher-clinical-auditor/1')
);
CREATE TRIGGER clinical_audits_immutable BEFORE UPDATE OR DELETE ON teacher_clinical_audits FOR EACH ROW EXECUTE FUNCTION chatusal_editorial_immutable();
COMMIT;
