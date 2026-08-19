import { NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth';
import { createStudentSessionDto } from '@/lib/cases/student-session-dto';
import { resolveStudentPublicCaseVersionV2 } from '@/lib/cases/v2/resolve-student-public-case-version';
import { pool } from '@/lib/db';

type StudentCaseVersionDatabaseRow = {
  id: unknown;
  case_id: unknown;
  status: unknown;
  content_format: unknown;
  content: unknown;
};

const POSITIVE_BIGINT_TEXT_PATTERN = /^[1-9]\d*$/;

function normalizeCaseId(value: unknown): number {
  if (
    typeof value !== 'string' ||
    !POSITIVE_BIGINT_TEXT_PATTERN.test(value)
  ) {
    throw new Error('Invalid case version case_id');
  }

  const caseId = Number(value);
  if (!Number.isSafeInteger(caseId) || caseId <= 0) {
    throw new Error('Invalid case version case_id');
  }

  return caseId;
}

async function createSessionForStudent(userId: number) {
  const client = await pool.connect();
  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const { rows: availableRows } = await client.query(
      `
      SELECT
        cv.id,
        cv.case_id::text AS case_id,
        cv.status,
        cv.content_format,
        cv.content
      FROM public.case_versions AS cv
      LEFT JOIN public.case_assignments AS ca
        ON ca.case_id = cv.case_id
       AND ca.student_id = $1
      WHERE cv.status = 'PUBLISHED'
        AND ca.id IS NULL
      ORDER BY random()
      LIMIT 1
      FOR SHARE OF cv
      `,
      [userId],
    );

    let caseVersionRow = availableRows[0] as
      | StudentCaseVersionDatabaseRow
      | undefined;

    if (caseVersionRow === undefined) {
      const { rows: fallbackRows } = await client.query(
        `
        SELECT
          cv.id,
          cv.case_id::text AS case_id,
          cv.status,
          cv.content_format,
          cv.content
        FROM public.case_versions AS cv
        WHERE cv.status = 'PUBLISHED'
        ORDER BY random()
        LIMIT 1
        FOR SHARE OF cv
        `,
      );
      caseVersionRow = fallbackRows[0] as
        | StudentCaseVersionDatabaseRow
        | undefined;
    }

    if (caseVersionRow === undefined) {
      throw new Error('No published case version available');
    }

    const resolved = resolveStudentPublicCaseVersionV2({
      id: caseVersionRow.id,
      case_id: normalizeCaseId(caseVersionRow.case_id),
      status: caseVersionRow.status,
      content_format: caseVersionRow.content_format,
      content: caseVersionRow.content,
    });

    await client.query(
      `
      INSERT INTO public.case_assignments (student_id, case_id)
      VALUES ($1, $2)
      ON CONFLICT (student_id, case_id) DO NOTHING
      `,
      [userId, resolved.caseId],
    );

    const { rows: sessionRows } = await client.query(
      `
      INSERT INTO public.sessions (
        user_id,
        case_id,
        case_version_id
      )
      VALUES ($1, $2, $3)
      RETURNING id
      `,
      [userId, resolved.caseId, resolved.caseVersionId],
    );

    const response = createStudentSessionDto({
      sessionId: sessionRows[0]?.id,
      ...resolved.publicCaseData,
    });

    await client.query('COMMIT');
    transactionStarted = false;
    return response;
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error revirtiendo creación de sesión:', rollbackError);
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const response = await createSessionForStudent(user.id);
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error creando sesión:', error);
    return NextResponse.json(
      { error: 'Error creando sesión' },
      { status: 500 },
    );
  }
}
