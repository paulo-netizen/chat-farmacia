import { describe, expect, it } from 'vitest';

import {
  createSessionTranscriptSnapshotV2,
  SessionTranscriptValidationError,
  validateSessionMessageIdV2,
  validateSessionTranscriptSnapshotV2,
} from '@/lib/cases/v2/spfa-session-transcript';
import {
  SpfaRequirementSessionResultValidationError,
  validateSpfaRequirementSessionResultV2,
} from '@/lib/cases/v2/validate-spfa-requirement-session-result';

const ids = {
  session: '10000000-0000-4000-8000-000000000001',
  otherSession: '10000000-0000-4000-8000-000000000002',
  caseVersion: 'casever_20000000-0000-4000-8000-000000000001',
  otherCaseVersion: 'casever_20000000-0000-4000-8000-000000000002',
  spfa: 'conclusion_30000000-0000-4000-8000-000000000001',
  otherSpfa: 'conclusion_30000000-0000-4000-8000-000000000002',
  informationRequirement:
    'spfa_requirement_40000000-0000-4000-8000-000000000001',
  actionRequirement:
    'spfa_requirement_40000000-0000-4000-8000-000000000002',
  otherRequirement:
    'spfa_requirement_40000000-0000-4000-8000-000000000003',
  targetA: 'spfa_target_50000000-0000-4000-8000-000000000001',
  targetB: 'spfa_target_50000000-0000-4000-8000-000000000002',
  targetC: 'spfa_target_50000000-0000-4000-8000-000000000003',
  factA: 'fact_60000000-0000-4000-8000-000000000001',
  factB: 'fact_60000000-0000-4000-8000-000000000002',
  conclusionA: 'conclusion_70000000-0000-4000-8000-000000000001',
  conclusionB: 'conclusion_70000000-0000-4000-8000-000000000002',
} as const;

function inputMessages() {
  return [
    {
      messageId: '1',
      role: 'student',
      content: '¿Cómo toma actualmente el medicamento?',
      createdAt: '2026-08-24T09:00:00.000Z',
    },
    {
      messageId: '2',
      role: 'patient',
      content: 'Tomo un comprimido por la mañana.',
      createdAt: '2026-08-24T09:00:01.000Z',
    },
    {
      messageId: '3',
      role: 'student',
      content: 'Le explico cómo utilizarlo correctamente.',
      createdAt: '2026-08-24T09:00:02.000Z',
    },
    {
      messageId: '4',
      role: 'patient',
      content: 'Sí, eso es exactamente lo que hago.',
      createdAt: '2026-08-24T09:00:03.000Z',
    },
  ];
}

function transcriptInput(messages: unknown = inputMessages()) {
  return {
    sessionId: ids.session,
    caseVersionId: ids.caseVersion,
    messages,
  };
}

function transcript() {
  return createSessionTranscriptSnapshotV2(transcriptInput());
}

function informationRequirement(applicable = true): Record<string, any> {
  return {
    requirementRef: ids.informationRequirement,
    kind: 'INFORMATION_REQUIREMENT',
    applicability: applicable
      ? { status: 'APPLICABLE', effectiveImportance: 'RELEVANT' }
      : {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
        },
    informationTargets: applicable
      ? [
          { targetId: ids.targetA, target: { kind: 'FACT', factRef: ids.factA } },
          { targetId: ids.targetB, target: { kind: 'FACT', factRef: ids.factB } },
        ]
      : [],
  };
}

function actionRequirement(applicable = true): Record<string, any> {
  return {
    requirementRef: ids.actionRequirement,
    kind: 'ACTION_REQUIREMENT',
    applicability: applicable
      ? { status: 'APPLICABLE', effectiveImportance: 'CRITICAL' }
      : {
          status: 'NOT_APPLICABLE',
          reason: { kind: 'DISPENSING_SUBTYPE_MISMATCH' },
        },
    actionTargets: applicable
      ? [
          {
            targetId: ids.targetA,
            target: { kind: 'EVALUATOR_CONCLUSION', conclusionRef: ids.conclusionA },
          },
          {
            targetId: ids.targetB,
            target: { kind: 'EVALUATOR_CONCLUSION', conclusionRef: ids.conclusionB },
          },
        ]
      : [],
  };
}

function context(requirement: Record<string, any> = informationRequirement()) {
  return {
    transcript: transcript(),
    carePathSpfaRef: ids.spfa,
    appliedRequirement: requirement,
  } as any;
}

function studentQuestion(excerpt?: string): Record<string, unknown> {
  return {
    source: 'TRANSCRIPT_MESSAGE',
    messageRef: '1',
    speaker: 'student',
    evidenceKind: 'STUDENT_QUESTION',
    ...(excerpt === undefined ? {} : { excerpt }),
  };
}

function patientStatement(excerpt?: string): Record<string, unknown> {
  return {
    source: 'TRANSCRIPT_MESSAGE',
    messageRef: '2',
    speaker: 'patient',
    evidenceKind: 'PATIENT_STATEMENT',
    ...(excerpt === undefined ? {} : { excerpt }),
  };
}

function patientConfirmation(): Record<string, unknown> {
  return {
    source: 'TRANSCRIPT_MESSAGE',
    messageRef: '4',
    speaker: 'patient',
    evidenceKind: 'PATIENT_CONFIRMATION',
  };
}

function studentAction(): Record<string, unknown> {
  return {
    source: 'TRANSCRIPT_MESSAGE',
    messageRef: '3',
    speaker: 'student',
    evidenceKind: 'STUDENT_ACTION',
  };
}

function publicEvidence(targetRef: string = ids.targetA): Record<string, unknown> {
  return { source: 'PUBLIC_INFORMATION', targetRef };
}

function informationResult(coverage: unknown): Record<string, unknown> {
  const snapshot = transcript();
  return {
    schemaVersion: '2.0',
    sessionId: ids.session,
    caseVersionId: ids.caseVersion,
    transcriptFingerprint: snapshot.fingerprint,
    carePathSpfaRef: ids.spfa,
    requirementRef: ids.informationRequirement,
    kind: 'INFORMATION_REQUIREMENT',
    coverage,
  };
}

function actionResult(outcome: unknown): Record<string, unknown> {
  const snapshot = transcript();
  return {
    schemaVersion: '2.0',
    sessionId: ids.session,
    caseVersionId: ids.caseVersion,
    transcriptFingerprint: snapshot.fingerprint,
    carePathSpfaRef: ids.spfa,
    requirementRef: ids.actionRequirement,
    kind: 'ACTION_REQUIREMENT',
    outcome,
  };
}

function validateInformation(coverage: unknown, requirement = informationRequirement()) {
  return validateSpfaRequirementSessionResultV2(
    informationResult(coverage),
    context(requirement),
  );
}

function validateAction(outcome: unknown, requirement = actionRequirement()) {
  return validateSpfaRequirementSessionResultV2(
    actionResult(outcome),
    context(requirement),
  );
}

describe('SessionMessageId', () => {
  it.each(['1', '42', '9223372036854775807'])(
    'accepts canonical PostgreSQL bigint ID %s',
    (value) => expect(validateSessionMessageIdV2(value)).toBe(value),
  );

  it.each([
    '0',
    '-1',
    '01',
    '+1',
    '1.0',
    '1e3',
    ' 1',
    '9223372036854775808',
    ids.session,
    1,
  ])('rejects non-canonical message ID %j', (value) => {
    expect(() => validateSessionMessageIdV2(value)).toThrow(
      SessionTranscriptValidationError,
    );
  });
});

describe('SessionTranscriptSnapshotV2', () => {
  it('accepts an empty transcript', () => {
    expect(createSessionTranscriptSnapshotV2(transcriptInput([])).messages).toEqual([]);
  });

  it('accepts an explicit Z timestamp', () => {
    const snapshot = createSessionTranscriptSnapshotV2(
      transcriptInput([{ ...inputMessages()[0], createdAt: '2026-08-24T09:00:00Z' }]),
    );
    expect(snapshot.messages[0].createdAt).toBe('2026-08-24T09:00:00.000Z');
  });

  it('accepts an explicit offset and canonicalizes it to UTC', () => {
    const snapshot = createSessionTranscriptSnapshotV2(
      transcriptInput([{ ...inputMessages()[0], createdAt: '2026-08-24T10:00:00+01:00' }]),
    );
    expect(snapshot.messages[0].createdAt).toBe('2026-08-24T09:00:00.000Z');
  });

  it('canonicalizes equivalent Z and offset instants identically', () => {
    const zulu = createSessionTranscriptSnapshotV2(
      transcriptInput([{ ...inputMessages()[0], createdAt: '2026-08-24T09:00:00Z' }]),
    );
    const offset = createSessionTranscriptSnapshotV2(
      transcriptInput([{ ...inputMessages()[0], createdAt: '2026-08-24T10:00:00+01:00' }]),
    );
    expect(offset.messages[0].createdAt).toBe(zulu.messages[0].createdAt);
  });

  it.each([
    ['timestamp without timezone', '2026-08-24T09:00:00'],
    ['date-only value', '2026-08-24'],
    ['impossible calendar day', '2026-02-30T09:00:00Z'],
    ['impossible month', '2026-13-01T09:00:00Z'],
  ])('rejects %s', (_label, createdAt) => {
    expect(() =>
      createSessionTranscriptSnapshotV2(
        transcriptInput([{ ...inputMessages()[0], createdAt }]),
      ),
    ).toThrow(SessionTranscriptValidationError);
  });

  it('fingerprints equivalent Z and offset representations identically', () => {
    const zulu = createSessionTranscriptSnapshotV2(
      transcriptInput([{ ...inputMessages()[0], createdAt: '2026-08-24T09:00:00Z' }]),
    );
    const offset = createSessionTranscriptSnapshotV2(
      transcriptInput([{ ...inputMessages()[0], createdAt: '2026-08-24T10:00:00+01:00' }]),
    );
    expect(offset.fingerprint).toEqual(zulu.fingerprint);
  });

  it('sorts by canonical createdAt and then numeric message ID', () => {
    const snapshot = createSessionTranscriptSnapshotV2(
      transcriptInput([
        { ...inputMessages()[0], messageId: '10', createdAt: '2026-08-24T10:00:00+01:00' },
        { ...inputMessages()[1], messageId: '9', createdAt: '2026-08-24T09:00:00Z' },
        { ...inputMessages()[2], messageId: '3', createdAt: '2026-08-24T08:59:59Z' },
      ]),
    );
    expect(snapshot.messages.map((message) => message.messageId)).toEqual([
      '3',
      '9',
      '10',
    ]);
    expect(snapshot.messages[1].createdAt).toBe('2026-08-24T09:00:00.000Z');
  });

  it('rejects duplicate message IDs', () => {
    expect(() =>
      createSessionTranscriptSnapshotV2(
        transcriptInput([{ ...inputMessages()[0] }, { ...inputMessages()[1], messageId: '1' }]),
      ),
    ).toThrow(/duplicate message ID/);
  });

  it.each([
    ['bad role', { ...inputMessages()[0], role: 'teacher' }],
    ['bad timestamp', { ...inputMessages()[0], createdAt: 'not-a-date' }],
    ['extra property', { ...inputMessages()[0], metadata: 'secret' }],
  ])('rejects a message with %s', (_label, message) => {
    expect(() => createSessionTranscriptSnapshotV2(transcriptInput([message]))).toThrow(
      SessionTranscriptValidationError,
    );
  });

  it('rejects invalid session and case-version IDs', () => {
    expect(() =>
      createSessionTranscriptSnapshotV2({ ...transcriptInput(), sessionId: 'session-1' }),
    ).toThrow(/sessionId/);
    expect(() =>
      createSessionTranscriptSnapshotV2({ ...transcriptInput(), caseVersionId: 'case-1' }),
    ).toThrow(/caseVersionId/);
  });

  it('fingerprints session, case, all message fields and message count', () => {
    const base = transcript();
    const variants = [
      createSessionTranscriptSnapshotV2({ ...transcriptInput(), sessionId: ids.otherSession }),
      createSessionTranscriptSnapshotV2({ ...transcriptInput(), caseVersionId: ids.otherCaseVersion }),
      createSessionTranscriptSnapshotV2(
        transcriptInput(inputMessages().map((message, index) =>
          index === 1 ? { ...message, content: `${message.content} Cambio.` } : message,
        )),
      ),
      createSessionTranscriptSnapshotV2(
        transcriptInput(inputMessages().map((message, index) =>
          index === 1 ? { ...message, role: 'student' } : message,
        )),
      ),
      createSessionTranscriptSnapshotV2(
        transcriptInput([...inputMessages(), {
          messageId: '5', role: 'patient', content: 'Otro mensaje.', createdAt: '2026-08-24T09:00:04Z',
        }]),
      ),
    ];
    for (const variant of variants) {
      expect(variant.fingerprint.value).not.toBe(base.fingerprint.value);
    }
  });

  it('validates and rebuilds a persisted fingerprint', () => {
    const persisted = JSON.parse(JSON.stringify(transcript()));
    expect(validateSessionTranscriptSnapshotV2(persisted)).toEqual(transcript());
    persisted.messages[0].content = 'Tampered';
    expect(() => validateSessionTranscriptSnapshotV2(persisted)).toThrow(
      /does not match the canonical transcript/,
    );
  });

  it('does not retain mutable input references', () => {
    const messages = inputMessages();
    const snapshot = createSessionTranscriptSnapshotV2(transcriptInput(messages));
    messages[0].content = 'Mutated after snapshot';
    expect(snapshot.messages[0].content).toBe('¿Cómo toma actualmente el medicamento?');
  });
});

describe('SPFA transcript evidence references', () => {
  it('accepts a literal excerpt from the referenced message', () => {
    const result = validateInformation({
      status: 'COVERED',
      origin: 'PATIENT_SPONTANEOUS',
      coveredTargetRefs: [ids.targetA, ids.targetB],
      evidence: [patientStatement('un comprimido por la mañana')],
    });
    expect(result.kind).toBe('INFORMATION_REQUIREMENT');
  });

  it('rejects an invented excerpt', () => {
    expect(() =>
      validateInformation({
        status: 'COVERED',
        origin: 'PATIENT_SPONTANEOUS',
        coveredTargetRefs: [ids.targetA, ids.targetB],
        evidence: [patientStatement('dos comprimidos por la noche')],
      }),
    ).toThrow(/literal substring/);
  });

  it('rejects missing messages and speaker mismatches', () => {
    expect(() =>
      validateInformation({
        status: 'COVERED', origin: 'PATIENT_SPONTANEOUS',
        coveredTargetRefs: [ids.targetA, ids.targetB],
        evidence: [{ ...patientStatement(), messageRef: '99' }],
      }),
    ).toThrow(/does not exist in the transcript/);
    expect(() =>
      validateInformation({
        status: 'COVERED', origin: 'PATIENT_SPONTANEOUS',
        coveredTargetRefs: [ids.targetA, ids.targetB],
        evidence: [{ ...patientStatement(), speaker: 'student' }],
      }),
    ).toThrow(/does not match the referenced message role/);
  });

  it.each([
    ['PATIENT_STATEMENT', 'student', '1'],
    ['PATIENT_CONFIRMATION', 'student', '1'],
    ['STUDENT_QUESTION', 'patient', '2'],
    ['STUDENT_ACTION', 'patient', '2'],
  ])('rejects %s with incompatible speaker', (evidenceKind, speaker, messageRef) => {
    expect(() =>
      validateInformation({
        status: 'COVERED', origin: 'PATIENT_SPONTANEOUS',
        coveredTargetRefs: [ids.targetA, ids.targetB],
        evidence: [{ source: 'TRANSCRIPT_MESSAGE', messageRef, speaker, evidenceKind }],
      }),
    ).toThrow(SpfaRequirementSessionResultValidationError);
  });

  it('rejects unexpected evidence properties and exact duplicates', () => {
    expect(() =>
      validateInformation({
        status: 'COVERED', origin: 'PATIENT_SPONTANEOUS',
        coveredTargetRefs: [ids.targetA, ids.targetB],
        evidence: [{ ...patientStatement(), hidden: true }],
      }),
    ).toThrow(/unexpected property/);
    expect(() =>
      validateInformation({
        status: 'COVERED', origin: 'PATIENT_SPONTANEOUS',
        coveredTargetRefs: [ids.targetA, ids.targetB],
        evidence: [patientStatement(), patientStatement()],
      }),
    ).toThrow(/duplicate evidence reference/);
  });
});

describe('SpfaRequirementCoverageV2', () => {
  it('accepts complete patient-spontaneous coverage', () => {
    const result = validateInformation({
      status: 'COVERED', origin: 'PATIENT_SPONTANEOUS',
      coveredTargetRefs: [ids.targetA, ids.targetB],
      evidence: [patientStatement()],
    });
    expect(result).toMatchObject({ kind: 'INFORMATION_REQUIREMENT', coverage: { status: 'COVERED' } });
  });

  it('accepts an exact partial partition', () => {
    expect(validateInformation({
      status: 'PARTIALLY_COVERED', origin: 'PATIENT_SPONTANEOUS',
      coveredTargetRefs: [ids.targetA], remainingTargetRefs: [ids.targetB],
      evidence: [patientStatement()],
    })).toMatchObject({ coverage: { status: 'PARTIALLY_COVERED' } });
  });

  it('accepts exact not-covered and not-applicable results', () => {
    expect(validateInformation({
      status: 'NOT_COVERED', coveredTargetRefs: [],
      remainingTargetRefs: [ids.targetA, ids.targetB], evidence: [studentQuestion()],
    })).toMatchObject({ coverage: { status: 'NOT_COVERED' } });
    expect(validateInformation(
      { status: 'NOT_APPLICABLE', evidence: [] },
      informationRequirement(false),
    )).toMatchObject({ coverage: { status: 'NOT_APPLICABLE' } });
  });

  it.each([
    ['missing target', [ids.targetA], []],
    ['extra target', [ids.targetA, ids.targetB, ids.targetC], []],
    ['overlap', [ids.targetA], [ids.targetA, ids.targetB]],
    ['duplicate', [ids.targetA, ids.targetA], [ids.targetB]],
  ])('rejects an invalid target partition: %s', (_label, covered, remaining) => {
    expect(() => validateInformation({
      status: remaining.length === 0 ? 'COVERED' : 'PARTIALLY_COVERED',
      origin: 'PATIENT_SPONTANEOUS', coveredTargetRefs: covered,
      ...(remaining.length === 0 ? {} : { remainingTargetRefs: remaining }),
      evidence: [patientStatement()],
    })).toThrow(SpfaRequirementSessionResultValidationError);
  });

  it('enforces applicability in both directions', () => {
    expect(() => validateInformation(
      { status: 'NOT_APPLICABLE', evidence: [] },
      informationRequirement(true),
    )).toThrow(/does not match applicable requirement/);
    expect(() => validateInformation(
      {
        status: 'COVERED', origin: 'PUBLIC_INFORMATION',
        coveredTargetRefs: [ids.targetA, ids.targetB], evidence: [publicEvidence()],
      },
      informationRequirement(false),
    )).toThrow(/must be NOT_APPLICABLE/);
  });

  it('rejects STUDENT_QUESTION alone and STUDENT_ACTION as factual coverage', () => {
    for (const evidence of [[studentQuestion()], [studentAction()]]) {
      expect(() => validateInformation({
        status: 'COVERED', origin: 'STUDENT_ELICITED',
        coveredTargetRefs: [ids.targetA, ids.targetB], evidence,
      })).toThrow(SpfaRequirementSessionResultValidationError);
    }
  });

  it('accepts elicited, public-only and mixed structural origins', () => {
    expect(validateInformation({
      status: 'COVERED', origin: 'STUDENT_ELICITED',
      coveredTargetRefs: [ids.targetA, ids.targetB],
      evidence: [studentQuestion(), patientStatement()],
    })).toBeTruthy();
    expect(validateInformation({
      status: 'COVERED', origin: 'PUBLIC_INFORMATION',
      coveredTargetRefs: [ids.targetA, ids.targetB], evidence: [publicEvidence()],
    })).toBeTruthy();
    expect(validateInformation({
      status: 'COVERED', origin: 'MIXED',
      coveredTargetRefs: [ids.targetA, ids.targetB],
      evidence: [publicEvidence(), patientConfirmation()],
    })).toBeTruthy();
  });

  it('rejects origin/evidence mismatches', () => {
    expect(() => validateInformation({
      status: 'COVERED', origin: 'PUBLIC_INFORMATION',
      coveredTargetRefs: [ids.targetA, ids.targetB], evidence: [patientStatement()],
    })).toThrow(/requires only public evidence/);
    expect(() => validateInformation({
      status: 'COVERED', origin: 'MIXED',
      coveredTargetRefs: [ids.targetA, ids.targetB], evidence: [publicEvidence()],
    })).toThrow(/requires public and patient/);
  });

  it('rejects public evidence for an uncovered target', () => {
    expect(() => validateInformation({
      status: 'PARTIALLY_COVERED', origin: 'PUBLIC_INFORMATION',
      coveredTargetRefs: [ids.targetA], remainingTargetRefs: [ids.targetB],
      evidence: [publicEvidence(ids.targetB)],
    })).toThrow(/public evidence must reference a covered target/);
  });
});

describe('SpfaActionRequirementOutcomeV2', () => {
  it('accepts performed, partial, not-performed and not-applicable outcomes', () => {
    expect(validateAction({
      status: 'PERFORMED', performedTargetRefs: [ids.targetA, ids.targetB],
      evidence: [studentAction()],
    })).toMatchObject({ outcome: { status: 'PERFORMED' } });
    expect(validateAction({
      status: 'PARTIALLY_PERFORMED', performedTargetRefs: [ids.targetA],
      remainingTargetRefs: [ids.targetB], evidence: [studentAction()],
    })).toMatchObject({ outcome: { status: 'PARTIALLY_PERFORMED' } });
    expect(validateAction({
      status: 'NOT_PERFORMED', remainingTargetRefs: [ids.targetA, ids.targetB],
      evidence: [studentQuestion()],
    })).toMatchObject({ outcome: { status: 'NOT_PERFORMED' } });
    expect(validateAction(
      { status: 'NOT_APPLICABLE', evidence: [] },
      actionRequirement(false),
    )).toMatchObject({ outcome: { status: 'NOT_APPLICABLE' } });
  });

  it.each([
    ['no action evidence', [studentQuestion()]],
    ['patient-only evidence', [patientStatement()]],
    ['public evidence', [publicEvidence()]],
  ])('rejects a performed result with %s', (_label, evidence) => {
    expect(() => validateAction({
      status: 'PERFORMED', performedTargetRefs: [ids.targetA, ids.targetB], evidence,
    })).toThrow(SpfaRequirementSessionResultValidationError);
  });

  it('rejects invalid action target partitions', () => {
    expect(() => validateAction({
      status: 'PARTIALLY_PERFORMED', performedTargetRefs: [ids.targetA],
      remainingTargetRefs: [ids.targetA, ids.targetB], evidence: [studentAction()],
    })).toThrow(/overlap/);
  });
});

describe('SpfaRequirementSessionResultV2 pinning', () => {
  const validCoverage = {
    status: 'COVERED', origin: 'PATIENT_SPONTANEOUS',
    coveredTargetRefs: [ids.targetA, ids.targetB], evidence: [patientStatement()],
  };

  it.each([
    ['sessionId', ids.otherSession],
    ['caseVersionId', ids.otherCaseVersion],
    ['carePathSpfaRef', ids.otherSpfa],
    ['requirementRef', ids.otherRequirement],
  ])('rejects a mismatched %s', (field, value) => {
    expect(() => validateSpfaRequirementSessionResultV2(
      { ...informationResult(validCoverage), [field]: value },
      context(),
    )).toThrow(SpfaRequirementSessionResultValidationError);
  });

  it('rejects a mismatched transcript fingerprint', () => {
    const result = informationResult(validCoverage);
    const otherTranscript = createSessionTranscriptSnapshotV2(
      transcriptInput([...inputMessages(), {
        messageId: '5', role: 'patient', content: 'New message', createdAt: '2026-08-24T09:00:05Z',
      }]),
    );
    expect(() => validateSpfaRequirementSessionResultV2(
      { ...result, transcriptFingerprint: otherTranscript.fingerprint },
      context(),
    )).toThrow(/does not match the transcript snapshot/);
  });

  it('rejects a result kind that differs from the applied requirement', () => {
    expect(() => validateSpfaRequirementSessionResultV2(
      {
        ...informationResult(validCoverage),
        kind: 'ACTION_REQUIREMENT',
        outcome: {
          status: 'PERFORMED',
          performedTargetRefs: [ids.targetA, ids.targetB],
          evidence: [studentAction()],
        },
      },
      context(),
    )).toThrow(SpfaRequirementSessionResultValidationError);
  });

  it('rejects unexpected result properties', () => {
    expect(() => validateSpfaRequirementSessionResultV2(
      { ...informationResult(validCoverage), futureSecret: 'hidden' },
      context(),
    )).toThrow(/unexpected property/);
  });
});
