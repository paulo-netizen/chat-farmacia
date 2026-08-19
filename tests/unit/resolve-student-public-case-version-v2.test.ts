import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  StudentPublicCaseVersionResolutionError,
  resolveStudentPublicCaseVersionV2,
  type StudentPublicCaseVersionResolutionErrorCode,
} from '@/lib/cases/v2/resolve-student-public-case-version';

const CASE_VERSION_ID =
  'casever_123e4567-e89b-42d3-a456-426614174000';
const OTHER_CASE_VERSION_ID =
  'casever_123e4567-e89b-42d3-a456-426614174001';

const publicProfile = {
  nombre: 'María',
  edad: 67,
  sexo: 'Mujer',
  tratamiento: 'Metformina 850 mg',
};

function legacyContent() {
  return {
    legacyCaseId: 17,
    spec: {
      ...publicProfile,
      hiddenFacts: { reason: 'oculto' },
      future_secret: 'no debe salir',
    },
    groundTruth: {
      answer: 'solución protegida',
    },
    legacyStatus: 'approved',
    description: 'descripción docente',
    future_secret: 'no debe salir',
  };
}

function generatedContent() {
  return {
    schemaVersion: '2.0',
    sourceOfTruth: {
      caseVersionId: CASE_VERSION_ID,
      patientFacts: {
        caseVersionId: CASE_VERSION_ID,
        publicProfile: {
          ...publicProfile,
          future_secret: 'no debe salir',
        },
        hiddenPatientFacts: {
          concern: 'oculta',
        },
      },
      evaluator: {
        conclusions: ['solución protegida'],
      },
    },
    derived: {
      patientRuntime: { hidden: true },
      teachingSummary: { hidden: true },
    },
    provenance: {
      model: 'no debe salir',
    },
    future_secret: 'no debe salir',
  };
}

function legacyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CASE_VERSION_ID,
    case_id: 17,
    status: 'PUBLISHED',
    content_format: 'LEGACY_V1_SNAPSHOT',
    content: legacyContent(),
    ...overrides,
  };
}

function generatedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CASE_VERSION_ID,
    case_id: 17,
    status: 'PUBLISHED',
    content_format: 'GENERATED_CASE_BUNDLE_V2',
    content: generatedContent(),
    ...overrides,
  };
}

function expectResolutionError(
  action: () => unknown,
  code: StudentPublicCaseVersionResolutionErrorCode,
  path?: string,
): StudentPublicCaseVersionResolutionError {
  try {
    action();
    throw new Error('expected resolver to throw');
  } catch (error) {
    expect(error).toBeInstanceOf(StudentPublicCaseVersionResolutionError);
    expect(error).toMatchObject({
      code,
      ...(path === undefined ? {} : { path }),
    });
    return error as StudentPublicCaseVersionResolutionError;
  }
}

describe('resolveStudentPublicCaseVersionV2', () => {
  it('resolves a published legacy snapshot from content.spec only', () => {
    const row = legacyRow();
    const result = resolveStudentPublicCaseVersionV2(row);

    expect(result).toEqual({
      caseId: 17,
      caseVersionId: CASE_VERSION_ID,
      publicCaseData: publicProfile,
    });
    expect(result.publicCaseData).not.toBe(
      (row.content as ReturnType<typeof legacyContent>).spec,
    );
  });

  it('resolves a published generated bundle from patientFacts.publicProfile only', () => {
    const row = generatedRow();
    const content = row.content as ReturnType<typeof generatedContent>;
    const result = resolveStudentPublicCaseVersionV2(row);

    expect(result).toEqual({
      caseId: 17,
      caseVersionId: CASE_VERSION_ID,
      publicCaseData: publicProfile,
    });
    expect(result.publicCaseData).not.toBe(
      content.sourceOfTruth.patientFacts.publicProfile,
    );
  });

  it.each([
    ['legacy', legacyRow()],
    ['generated', generatedRow()],
  ])('returns an exact frozen allowlist for %s content', (_kind, row) => {
    const result = resolveStudentPublicCaseVersionV2(row);
    const serialized = JSON.stringify(result);

    expect(Object.keys(result).sort()).toEqual(
      ['caseId', 'caseVersionId', 'publicCaseData'].sort(),
    );
    expect(Object.keys(result.publicCaseData).sort()).toEqual(
      ['edad', 'nombre', 'sexo', 'tratamiento'].sort(),
    );
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.publicCaseData)).toBe(true);
    for (const protectedValue of [
      'groundTruth',
      'hiddenFacts',
      'hiddenPatientFacts',
      'future_secret',
      'sourceOfTruth',
      'patientFacts',
      'derived',
      'provenance',
      'legacyStatus',
      'solución protegida',
    ]) {
      expect(serialized).not.toContain(protectedValue);
    }
  });

  it.each([null, undefined, [], 'row', 17])(
    'rejects a non-object row: %p',
    (input) => {
      expectResolutionError(
        () => resolveStudentPublicCaseVersionV2(input),
        'invalid_case_version_row',
        'input',
      );
    },
  );

  it.each(['17', 0, -1, 1.5, Number.NaN, Infinity, 2 ** 53, null])(
    'rejects invalid case_id %p without coercion',
    (caseId) => {
      expectResolutionError(
        () =>
          resolveStudentPublicCaseVersionV2(
            legacyRow({ case_id: caseId }),
          ),
        'invalid_case_version_row',
        'case_id',
      );
    },
  );

  it.each([undefined, null, 'casever-semantic', 'casever_NOT-A-UUID'])
    ('rejects invalid row case version id %p', (id) => {
      expectResolutionError(
        () => resolveStudentPublicCaseVersionV2(legacyRow({ id })),
        'invalid_case_version_row',
        'id',
      );
    });

  it.each([
    'AI_DRAFT',
    'TEACHER_DRAFT',
    'IN_REVIEW',
    'VALIDATED',
    'ARCHIVED',
  ])('rejects canonical non-published status %s', (status) => {
    expectResolutionError(
      () => resolveStudentPublicCaseVersionV2(legacyRow({ status })),
      'case_version_not_published',
      'status',
    );
  });

  it.each(['published', 'approved', 'UNKNOWN', null, undefined, [], 1])(
    'rejects unknown raw status %p',
    (status) => {
      expectResolutionError(
        () => resolveStudentPublicCaseVersionV2(legacyRow({ status })),
        'invalid_case_version_row',
        'status',
      );
    },
  );

  it('rejects an otherwise valid archived legacy snapshot only by status', () => {
    expectResolutionError(
      () =>
        resolveStudentPublicCaseVersionV2(
          legacyRow({ status: 'ARCHIVED' }),
        ),
      'case_version_not_published',
      'status',
    );
  });

  it.each(['TEACHER_AUTHORED', 'LEGACY_V2', null, undefined, [], {}])(
    'rejects unsupported content format %p',
    (contentFormat) => {
      expectResolutionError(
        () =>
          resolveStudentPublicCaseVersionV2(
            legacyRow({ content_format: contentFormat }),
          ),
        'unsupported_content_format',
        'content_format',
      );
    },
  );

  it.each(['LEGACY_V1_SNAPSHOT', 'GENERATED_CASE_BUNDLE_V2'])
    ('rejects non-object content for %s', (contentFormat) => {
      expectResolutionError(
        () =>
          resolveStudentPublicCaseVersionV2(
            legacyRow({ content_format: contentFormat, content: [] }),
          ),
        'invalid_case_version_content',
        'content',
      );
    });

  it.each([undefined, null, [], 'spec'])('rejects invalid legacy spec %p', (spec) => {
    expectResolutionError(
      () =>
        resolveStudentPublicCaseVersionV2(
          legacyRow({ content: { ...legacyContent(), spec } }),
        ),
      'invalid_case_version_content',
      'content.spec',
    );
  });

  it.each([
    ['nombre', undefined],
    ['nombre', '   '],
    ['edad', 67.5],
    ['edad', 'sesenta y siete'],
    ['sexo', null],
    ['tratamiento', []],
  ])('rejects invalid legacy public field %s=%p', (field, value) => {
    expectResolutionError(
      () =>
        resolveStudentPublicCaseVersionV2(
          legacyRow({
            content: {
              ...legacyContent(),
              spec: { ...publicProfile, [field]: value },
            },
          }),
        ),
      'invalid_case_version_content',
      'content.spec',
    );
  });

  it.each([undefined, null, [], 'source'])
    ('rejects invalid generated sourceOfTruth %p', (sourceOfTruth) => {
      expectResolutionError(
        () =>
          resolveStudentPublicCaseVersionV2(
            generatedRow({
              content: { ...generatedContent(), sourceOfTruth },
            }),
          ),
        'invalid_case_version_content',
        'content.sourceOfTruth',
      );
    });

  it.each([undefined, null, [], 'facts'])
    ('rejects invalid generated patientFacts %p', (patientFacts) => {
      const content = generatedContent();
      expectResolutionError(
        () =>
          resolveStudentPublicCaseVersionV2(
            generatedRow({
              content: {
                ...content,
                sourceOfTruth: {
                  ...content.sourceOfTruth,
                  patientFacts,
                },
              },
            }),
          ),
        'invalid_case_version_content',
        'content.sourceOfTruth.patientFacts',
      );
    });

  it.each([undefined, null, [], 'profile'])
    ('rejects invalid generated publicProfile %p', (publicProfileValue) => {
      const content = generatedContent();
      expectResolutionError(
        () =>
          resolveStudentPublicCaseVersionV2(
            generatedRow({
              content: {
                ...content,
                sourceOfTruth: {
                  ...content.sourceOfTruth,
                  patientFacts: {
                    ...content.sourceOfTruth.patientFacts,
                    publicProfile: publicProfileValue,
                  },
                },
              },
            }),
          ),
        'invalid_case_version_content',
        'content.sourceOfTruth.patientFacts.publicProfile',
      );
    });

  it.each([
    ['nombre', 17],
    ['edad', Infinity],
    ['sexo', {}],
    ['tratamiento', ''],
  ])('rejects invalid generated public field %s=%p', (field, value) => {
    const content = generatedContent();
    expectResolutionError(
      () =>
        resolveStudentPublicCaseVersionV2(
          generatedRow({
            content: {
              ...content,
              sourceOfTruth: {
                ...content.sourceOfTruth,
                patientFacts: {
                  ...content.sourceOfTruth.patientFacts,
                  publicProfile: { ...publicProfile, [field]: value },
                },
              },
            },
          }),
        ),
      'invalid_case_version_content',
      'content.sourceOfTruth.patientFacts.publicProfile',
    );
  });

  it('rejects a mismatched sourceOfTruth caseVersionId', () => {
    const content = generatedContent();
    expectResolutionError(
      () =>
        resolveStudentPublicCaseVersionV2(
          generatedRow({
            content: {
              ...content,
              sourceOfTruth: {
                ...content.sourceOfTruth,
                caseVersionId: OTHER_CASE_VERSION_ID,
              },
            },
          }),
        ),
      'case_version_identity_mismatch',
      'content.sourceOfTruth.caseVersionId',
    );
  });

  it('rejects a mismatched patientFacts caseVersionId', () => {
    const content = generatedContent();
    expectResolutionError(
      () =>
        resolveStudentPublicCaseVersionV2(
          generatedRow({
            content: {
              ...content,
              sourceOfTruth: {
                ...content.sourceOfTruth,
                patientFacts: {
                  ...content.sourceOfTruth.patientFacts,
                  caseVersionId: OTHER_CASE_VERSION_ID,
                },
              },
            },
          }),
        ),
      'case_version_identity_mismatch',
      'content.sourceOfTruth.patientFacts.caseVersionId',
    );
  });

  it.each([
    ['sourceOfTruth', 'invalid-id'],
    ['patientFacts', null],
  ])('rejects malformed generated identity at %s', (target, value) => {
    const content = generatedContent();
    const sourceOfTruth =
      target === 'sourceOfTruth'
        ? { ...content.sourceOfTruth, caseVersionId: value }
        : {
            ...content.sourceOfTruth,
            patientFacts: {
              ...content.sourceOfTruth.patientFacts,
              caseVersionId: value,
            },
          };

    expectResolutionError(
      () =>
        resolveStudentPublicCaseVersionV2(
          generatedRow({ content: { ...content, sourceOfTruth } }),
        ),
      'invalid_case_version_content',
      target === 'sourceOfTruth'
        ? 'content.sourceOfTruth.caseVersionId'
        : 'content.sourceOfTruth.patientFacts.caseVersionId',
    );
  });

  it('uses safe errors that never serialize protected input', () => {
    const marker = 'HIGHLY_SENSITIVE_MARKER';
    const error = expectResolutionError(
      () =>
        resolveStudentPublicCaseVersionV2(
          legacyRow({
            content: {
              ...legacyContent(),
              spec: { ...publicProfile, nombre: marker, edad: null },
            },
          }),
        ),
      'invalid_case_version_content',
      'content.spec',
    );

    expect(error.message).toBe('invalid_case_version_content at content.spec');
    expect(error.message).not.toContain(marker);
    expect('cause' in error).toBe(false);
  });

  it('has no environment, provider, network, persistence, or protected-column coupling', () => {
    const source = readFileSync(
      new URL(
        '../../lib/cases/v2/resolve-student-public-case-version.ts',
        import.meta.url,
      ),
      'utf8',
    );

    for (const forbidden of [
      'process.env',
      'OPENAI_API_KEY',
      "from 'openai'",
      'fetch(',
      'pool',
      'DATABASE_URL',
      'SUPABASE',
      'ground_truth',
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
