BEGIN;
-- Extend only the new native input /3. Historical bindings remain immutable.
ALTER TABLE teacher_native_audit_bindings DROP CONSTRAINT teacher_native_audit_bindings_sources_check;
ALTER TABLE teacher_native_audit_bindings ADD CONSTRAINT teacher_native_audit_bindings_sources_check
 CHECK(jsonb_typeof(sources)='array' AND jsonb_array_length(sources) BETWEEN 1 AND
 CASE WHEN configuration->>'inputVersion'='3' THEN 4 ELSE 2 END);
COMMIT;
