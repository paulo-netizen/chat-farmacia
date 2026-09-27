import 'server-only';
import { z } from 'zod';
import type { PharmaceuticalPgDatabase, PharmaceuticalPersistenceAccess } from './pharmaceutical-evaluation-postgres';
import { evaluationIdSchema } from './pharmaceutical-evaluation-record-types';
import { resolveSessionPatientClinicalContentV2, resolveSessionEvaluatorClinicalContentV2 } from './resolve-session-clinical-content';
import { createSessionTranscriptSnapshotV2, validateSessionTranscriptSnapshotV2 } from './spfa-session-transcript';
import { buildPharmaceuticalClinicalReferenceV2 } from './build-pharmaceutical-clinical-reference';
import { buildPharmaceuticalEvaluationTargetSetV2 } from './build-pharmaceutical-evaluation-target-set';
import { validatePharmaceuticalEvaluationExpectationSetV2 } from './validate-pharmaceutical-evaluation-expectations';
import { buildPharmaceuticalSessionEvidenceCandidatesV2 } from './build-pharmaceutical-session-evidence-candidates';
import { buildPharmaceuticalAdjudicationContextSetV2 } from './build-pharmaceutical-adjudication-context';
import { validatePharmaceuticalScoringConfigurationV2 } from './build-pharmaceutical-scoring-policy';
import { validatePharmaceuticalEvaluationSourcesV2 } from './pharmaceutical-evaluation-artifacts';
import { recordEqual } from './pharmaceutical-evaluation-record-utils';

export class PharmaceuticalCaptureError extends Error {
  constructor(readonly code: 'NOT_AVAILABLE' | 'FROZEN_SOURCE_REQUIRED' | 'INVALID_SOURCE' | 'CAPTURE_FAILED') {
    super(code); this.name = 'PharmaceuticalCaptureError';
  }
}
const accessSchema = z.object({ ownerId: z.string().regex(/^[1-9][0-9]{0,18}$/)
  .refine(v => BigInt(v) <= 9223372036854775807n), sessionId: evaluationIdSchema }).strict();
const anchorSchema = z.object({ case_id: z.string(), case_version_id: z.string(), status: z.literal('finished'),
  version_status: z.enum(['PUBLISHED', 'ARCHIVED']), source_kind: z.unknown(), legacy_status: z.unknown(),
  content_format: z.unknown(), content: z.unknown() });

/** Trusted server configuration only. No client snapshot, latest lookup or implicit expectations. */
export async function capturePharmaceuticalEvaluationSourcesV2(
  database: PharmaceuticalPgDatabase, accessInput: PharmaceuticalPersistenceAccess,
  settings: Readonly<{ expectationSet: unknown; configuration: unknown }>,
) {
  // Detach server inputs before the first await, including nested configuration.
  let access: PharmaceuticalPersistenceAccess, fixed: typeof settings;
  try { access = accessSchema.parse(accessInput); fixed = structuredClone(settings); }
  catch { throw new PharmaceuticalCaptureError('INVALID_SOURCE'); }
  const c = await database.connect().catch(() => { throw new PharmaceuticalCaptureError('CAPTURE_FAILED'); });
  try {
    await c.query('BEGIN');
    // M5 message writes take this SAME session lock in migration 0003. Never change status here.
    const owned = await c.query(`SELECT s.case_id::text,s.case_version_id,s.status,cv.status AS version_status,
      cv.source_kind,cv.legacy_status,cv.content_format,cv.content
      FROM public.sessions s JOIN public.case_versions cv ON cv.id=s.case_version_id AND cv.case_id=s.case_id
      WHERE s.id=$1 AND s.user_id=$2::bigint FOR UPDATE OF s`, [access.sessionId, access.ownerId]);
    if (owned.rows.length !== 1) throw new PharmaceuticalCaptureError('NOT_AVAILABLE');
    const row = anchorSchema.safeParse(owned.rows[0]);
    if (!row.success) throw new PharmaceuticalCaptureError('FROZEN_SOURCE_REQUIRED');
    const a = row.data, caseId = Number(a.case_id);
    if (!Number.isSafeInteger(caseId) || caseId <= 0) throw new PharmaceuticalCaptureError('INVALID_SOURCE');
    const stored = await c.query(`SELECT case_version_id,transcript_snapshot,transcript_fingerprint_value
      FROM public.session_evaluation_records_v2 WHERE session_id=$1`, [access.sessionId]);
    if (stored.rows.length !== 1) throw new PharmaceuticalCaptureError('FROZEN_SOURCE_REQUIRED');
    const frozen = z.object({ case_version_id: z.string(), transcript_snapshot: z.unknown(), transcript_fingerprint_value: z.string() }).parse(stored.rows[0]);
    const transcript = validateSessionTranscriptSnapshotV2(frozen.transcript_snapshot);
    recordEqual([transcript.sessionId, transcript.caseVersionId, transcript.fingerprint.value],
      [access.sessionId, a.case_version_id, frozen.transcript_fingerprint_value]);
    recordEqual(frozen.case_version_id, a.case_version_id);
    const persisted = await c.query(`SELECT id::text AS id,role,content,created_at FROM public.messages
      WHERE session_id=$1 ORDER BY created_at,id`, [access.sessionId]);
    const messages = persisted.rows.map(v => {
      const m = z.object({ id: z.string(), role: z.string(), content: z.string(), created_at: z.union([z.date(), z.string()]) }).parse(v);
      return { messageId: m.id, role: m.role, content: m.content,
        createdAt: m.created_at instanceof Date ? m.created_at.toISOString() : m.created_at };
    });
    recordEqual(transcript, createSessionTranscriptSnapshotV2({ sessionId: access.sessionId, caseVersionId: a.case_version_id, messages }));
    const version = { caseId, caseVersionId: a.case_version_id, sourceKind: a.source_kind,
      legacyStatus: a.legacy_status, contentFormat: a.content_format, content: a.content };
    const patient = resolveSessionPatientClinicalContentV2(version), clinical = resolveSessionEvaluatorClinicalContentV2(version);
    if (patient.contentFormat !== 'GENERATED_CASE_BUNDLE_V2' || clinical.contentFormat !== 'GENERATED_CASE_BUNDLE_V2') {
      throw new PharmaceuticalCaptureError('INVALID_SOURCE');
    }
    const patientRuntime = patient.patientRuntime;
    const clinicalReference = buildPharmaceuticalClinicalReferenceV2(clinical.evaluator, patientRuntime);
    const targetSet = buildPharmaceuticalEvaluationTargetSetV2(clinicalReference);
    const expectationSet = validatePharmaceuticalEvaluationExpectationSetV2(fixed.expectationSet, targetSet);
    const contextSource = { patientRuntime, clinicalReference, targetSet, expectationSet, transcript,
      candidateSet: buildPharmaceuticalSessionEvidenceCandidatesV2(transcript, targetSet) };
    const context = buildPharmaceuticalAdjudicationContextSetV2(contextSource);
    const configuration = validatePharmaceuticalScoringConfigurationV2(fixed.configuration, contextSource);
    const sources = validatePharmaceuticalEvaluationSourcesV2({ contextSource, context, configuration });
    await c.query('COMMIT');
    return sources;
  } catch (e) {
    try { await c.query('ROLLBACK'); } catch { /* no clinical or SQL details */ }
    if (e instanceof PharmaceuticalCaptureError) throw e;
    throw new PharmaceuticalCaptureError('INVALID_SOURCE');
  } finally { c.release(); }
}
