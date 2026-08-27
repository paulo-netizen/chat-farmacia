import { describe, expect, it } from 'vitest';

import { buildPharmaceuticalSessionEvidenceCandidatesV2 } from '@/lib/cases/v2/build-pharmaceutical-session-evidence-candidates';
import type { PharmaceuticalEvaluationTargetSetV2 } from '@/lib/cases/v2/pharmaceutical-evaluation-target-types';
import type { PharmaceuticalSessionEvidenceSetV2 } from '@/lib/cases/v2/pharmaceutical-session-evidence-types';
import { createSessionTranscriptSnapshotV2 } from '@/lib/cases/v2/spfa-session-transcript';
import {
  PharmaceuticalSessionEvidenceValidationError,
  validatePharmaceuticalSessionEvidenceCandidateSetV2,
  validatePharmaceuticalSessionEvidenceSetV2,
} from '@/lib/cases/v2/validate-pharmaceutical-session-evidence';

const caseVersionId = 'casever_81000000-0000-4000-8000-000000000001';
const targetA = `pharm_target_${'a'.repeat(64)}`;
const targetB = `pharm_target_${'b'.repeat(64)}`;

function transcript() {
  return createSessionTranscriptSnapshotV2({
    sessionId: '82000000-0000-4000-8000-000000000001', caseVersionId,
    messages: [
      { messageId: '3', role: 'student', content: 'Creo que existe un PRM y voy a derivarle.', createdAt: '2026-08-27T10:02:00Z' },
      { messageId: '1', role: 'student', content: '¿Cómo toma el medicamento?', createdAt: '2026-08-27T10:00:00Z' },
      { messageId: '2', role: 'patient', content: 'A veces olvido la dosis de la noche.', createdAt: '2026-08-27T10:01:00Z' },
    ],
  });
}

function targetSet(): PharmaceuticalEvaluationTargetSetV2 {
  return {
    schemaVersion: '2.0', contractVersion: 'pharmaceutical-evaluation-target-set/1', caseVersionId: caseVersionId as any,
    clinicalReference: { schemaVersion: '2.0', evaluatorSchema: { id: 'evaluator', version: '2' }, protocol: { id: 'foro', version: '2024' } },
    targets: [
      { targetId: targetA as any, category: 'IDENTIFICATION', aspect: 'PRM_STATUS', clinicalRef: { kind: 'CONCLUSION', conclusionRef: 'conclusion_83000000-0000-4000-8000-000000000001' as any }, expectedValue: { kind: 'ENUM', value: 'present' } },
      { targetId: targetB as any, category: 'ACTION', aspect: 'REPORT_STATUS', clinicalRef: { kind: 'CONCLUSION', conclusionRef: 'conclusion_83000000-0000-4000-8000-000000000002' as any }, expectedValue: { kind: 'ENUM', value: 'required' } },
    ],
    fingerprint: { algorithm: 'sha256', canonicalization: 'pharmaceutical-evaluation-target-set-v2/1', value: 'c'.repeat(64) },
  };
}

function context() {
  const snapshot = transcript();
  const targets = targetSet();
  return { transcript: snapshot, targetSet: targets, candidateSet: buildPharmaceuticalSessionEvidenceCandidatesV2(snapshot, targets) };
}

function evidenceSet(evidence: unknown[]): PharmaceuticalSessionEvidenceSetV2 {
  const value = context();
  return {
    schemaVersion: '2.0', contractVersion: 'pharmaceutical-session-evidence/1',
    sessionId: value.transcript.sessionId, caseVersionId: value.transcript.caseVersionId,
    transcriptFingerprint: value.transcript.fingerprint,
    targetSetFingerprint: value.targetSet.fingerprint,
    evidence,
  } as PharmaceuticalSessionEvidenceSetV2;
}

function clone<T>(value: T): T { return structuredClone(value); }

describe('pharmaceutical session evidence contracts', () => {
  it('builds a deterministic structural universe without semantic filtering', () => {
    const value = context();
    const second = buildPharmaceuticalSessionEvidenceCandidatesV2(value.transcript, value.targetSet);
    expect(second).toEqual(value.candidateSet);
    expect(value.candidateSet.candidates.filter((item) => item.targetRef === targetA && item.speaker === 'student')).toHaveLength(8);
    expect(value.candidateSet.candidates.filter((item) => item.targetRef === targetB && item.speaker === 'student')).toHaveLength(2);
  });

  it('keeps patient candidates exclusively as acquisition context', () => {
    const patient = context().candidateSet.candidates.filter((item) => item.speaker === 'patient');
    expect(patient).toHaveLength(4);
    expect(new Set(patient.map((item) => item.evidenceRole))).toEqual(new Set(['ACQUISITION_CONTEXT']));
    expect(new Set(patient.map((item) => item.evidenceKind))).toEqual(new Set(['PATIENT_STATEMENT', 'PATIENT_CONFIRMATION']));
  });

  it('keeps a student question as a candidate without treating it as a positive conclusion', () => {
    const questions = context().candidateSet.candidates.filter((item) => item.evidenceKind === 'STUDENT_QUESTION');
    expect(questions.length).toBeGreaterThan(0);
    expect(JSON.stringify(context().candidateSet)).not.toMatch(/SUPPORTED|verdict|score/);
  });

  it('validates the exact candidate universe and rejects silent filtering', () => {
    const value = context();
    expect(validatePharmaceuticalSessionEvidenceCandidateSetV2(value.candidateSet, value.transcript, value.targetSet)).toEqual(value.candidateSet);
    const filtered = clone(value.candidateSet) as any;
    filtered.candidates.pop();
    expect(() => validatePharmaceuticalSessionEvidenceCandidateSetV2(filtered, value.transcript, value.targetSet)).toThrow(PharmaceuticalSessionEvidenceValidationError);
  });

  it('accepts literal student demonstration evidence', () => {
    const input = evidenceSet([{ targetRef: targetA, messageRef: '3', speaker: 'student', evidenceRole: 'STUDENT_DEMONSTRATION', evidenceKind: 'STUDENT_INTERPRETATION', excerpt: 'existe un PRM' }]);
    expect(validatePharmaceuticalSessionEvidenceSetV2(input, context()).evidence).toHaveLength(1);
  });

  it('accepts patient acquisition context linked to an earlier student message', () => {
    const input = evidenceSet([{ targetRef: targetA, messageRef: '2', speaker: 'patient', evidenceRole: 'ACQUISITION_CONTEXT', evidenceKind: 'PATIENT_STATEMENT', excerpt: 'olvido la dosis', studentQuestionRef: '1' }]);
    expect(validatePharmaceuticalSessionEvidenceSetV2(input, context()).evidence[0]).toMatchObject({ studentQuestionRef: '1' });
  });

  it.each([
    ['non-literal excerpt', (item: any) => { item.excerpt = 'paráfrasis inventada'; }],
    ['empty excerpt', (item: any) => { item.excerpt = ''; }],
    ['speaker mismatch', (item: any) => { item.speaker = 'patient'; item.evidenceRole = 'ACQUISITION_CONTEXT'; item.evidenceKind = 'PATIENT_STATEMENT'; }],
    ['missing target', (item: any) => { item.targetRef = `pharm_target_${'d'.repeat(64)}`; }],
    ['missing message', (item: any) => { item.messageRef = '99'; }],
    ['patient as demonstration', (item: any) => { item.speaker = 'patient'; item.evidenceKind = 'PATIENT_STATEMENT'; }],
    ['incompatible kind', (item: any) => { item.evidenceKind = 'STUDENT_INTERPRETATION'; }],
    ['unexpected property', (item: any) => { item.expectedValue = 'secret'; }],
  ])('rejects %s', (_label, mutate) => {
    const item: any = { targetRef: targetB, messageRef: '3', speaker: 'student', evidenceRole: 'STUDENT_DEMONSTRATION', evidenceKind: 'STUDENT_ACTION', excerpt: 'voy a derivarle' };
    mutate(item);
    expect(() => validatePharmaceuticalSessionEvidenceSetV2(evidenceSet([item]), context())).toThrow(PharmaceuticalSessionEvidenceValidationError);
  });

  it('rejects a patient question link that is missing, non-student or later', () => {
    for (const studentQuestionRef of ['99', '2', '3']) {
      const input = evidenceSet([{ targetRef: targetA, messageRef: '2', speaker: 'patient', evidenceRole: 'ACQUISITION_CONTEXT', evidenceKind: 'PATIENT_CONFIRMATION', excerpt: 'A veces olvido', studentQuestionRef }]);
      expect(() => validatePharmaceuticalSessionEvidenceSetV2(input, context())).toThrow(/studentQuestionRef/);
    }
  });

  it.each(['transcriptFingerprint', 'targetSetFingerprint'] as const)('rejects a wrong %s', (field) => {
    const input = evidenceSet([]) as any;
    input[field] = { ...input[field], value: '0'.repeat(64) };
    expect(() => validatePharmaceuticalSessionEvidenceSetV2(input, context())).toThrow(/fingerprint/i);
  });

  it('rejects duplicate evidence and non-canonical evidence order', () => {
    const first = { targetRef: targetA, messageRef: '1', speaker: 'student', evidenceRole: 'STUDENT_DEMONSTRATION', evidenceKind: 'STUDENT_QUESTION', excerpt: '¿Cómo toma' };
    expect(() => validatePharmaceuticalSessionEvidenceSetV2(evidenceSet([first, first]), context())).toThrow(/duplicate/);
    const later = { targetRef: targetB, messageRef: '3', speaker: 'student', evidenceRole: 'STUDENT_DEMONSTRATION', evidenceKind: 'STUDENT_ACTION', excerpt: 'voy a derivarle' };
    expect(() => validatePharmaceuticalSessionEvidenceSetV2(evidenceSet([later, first]), context())).toThrow(/canonical order/);
  });

  it('binds evidence to session, case, transcript and target-set identities', () => {
    for (const field of ['sessionId', 'caseVersionId'] as const) {
      const input = evidenceSet([]) as any;
      input[field] = field === 'sessionId' ? '82000000-0000-4000-8000-000000000099' : 'casever_81000000-0000-4000-8000-000000000099';
      expect(() => validatePharmaceuticalSessionEvidenceSetV2(input, context())).toThrow();
    }
  });

  it('does not carry expected values, ground truth, transcript text, provider metadata or free reasoning in evidence refs', () => {
    const input = evidenceSet([{ targetRef: targetA, messageRef: '3', speaker: 'student', evidenceRole: 'STUDENT_DEMONSTRATION', evidenceKind: 'STUDENT_INTERPRETATION', excerpt: 'existe un PRM' }]);
    const result = validatePharmaceuticalSessionEvidenceSetV2(input, context());
    const serialized = JSON.stringify(result.evidence);
    ['expectedValue', 'clinicalReference', 'patientFacts', 'model', 'confidence', 'reasoning', 'score', 'verdict'].forEach((term) => expect(serialized).not.toContain(term));
  });

  it('does not mutate transcript, target set, candidate set or evidence input', () => {
    const value = context();
    const input = evidenceSet([]);
    const before = clone({ value, input });
    validatePharmaceuticalSessionEvidenceSetV2(input, value);
    expect({ value, input }).toEqual(before);
  });
});
