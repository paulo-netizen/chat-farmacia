import { NextResponse } from 'next/server';

import { getUserFromRequest } from '@/lib/auth';
import {
  createStudentSessionDto,
  type StudentSessionDto,
} from '@/lib/cases/student-session-dto';
import { resolveStudentPublicCaseVersionForResumeV2 } from '@/lib/cases/v2/resolve-student-public-case-version';
import { pool } from '@/lib/db';

type ActiveStudentSessionDatabaseRow = {
  session_id: unknown;
  session_case_id: unknown;
  session_case_version_id: unknown;
  version_id: unknown;
  version_case_id: unknown;
  version_status: unknown;
  version_content_format: unknown;
  version_content: unknown;
};

type StudentMessage = Readonly<{
  role: 'student' | 'patient';
  content: string;
}>;

type ActiveStudentSessionResponse = Readonly<{
  session: StudentSessionDto;
  messages: readonly StudentMessage[];
}>;

const POSITIVE_BIGINT_TEXT_PATTERN = /^[1-9]\d*$/;

function normalizeCaseId(value: unknown): number {
  if (
    typeof value !== 'string' ||
    !POSITIVE_BIGINT_TEXT_PATTERN.test(value)
  ) {
    throw new Error('Invalid active session case_id');
  }

  const caseId = Number(value);
  if (!Number.isSafeInteger(caseId) || caseId <= 0) {
    throw new Error('Invalid active session case_id');
  }

  return caseId;
}

function parseStudentMessages(rows: unknown[]): StudentMessage[] {
  return rows.map((value) => {
    if (
      typeof value !== 'object' ||
      value === null ||
      Array.isArray(value)
    ) {
      throw new Error('Invalid persisted message row');
    }

    const row = value as Record<string, unknown>;
    if (row.role !== 'student' && row.role !== 'patient') {
      throw new Error('Invalid persisted message role');
    }
    if (typeof row.content !== 'string') {
      throw new Error('Invalid persisted message content');
    }

    return {
      role: row.role,
      content: row.content,
    };
  });
}

async function recoverActiveSessionForStudent(
  userId: number,
): Promise<ActiveStudentSessionResponse | null> {
  const client = await pool.connect();

  try {
    const { rows: activeSessionRows } = await client.query(
      `
      SELECT
        s.id AS session_id,
        s.case_id::text AS session_case_id,
        s.case_version_id AS session_case_version_id,
        cv.id AS version_id,
        cv.case_id::text AS version_case_id,
        cv.status AS version_status,
        cv.content_format AS version_content_format,
        cv.content AS version_content
      FROM public.sessions AS s
      LEFT JOIN public.case_versions AS cv
        ON cv.id = s.case_version_id
       AND cv.case_id = s.case_id
      WHERE s.user_id = $1
        AND s.status = 'active'
      ORDER BY s.started_at ASC, s.id ASC
      `,
      [userId],
    );

    if (activeSessionRows.length > 1) {
      throw new Error(`Multiple active sessions for user ${userId}`);
    }
    if (activeSessionRows.length === 0) {
      return null;
    }

    const activeSessionRow =
      activeSessionRows[0] as ActiveStudentSessionDatabaseRow;
    const sessionCaseId = normalizeCaseId(
      activeSessionRow.session_case_id,
    );
    const resolved = resolveStudentPublicCaseVersionForResumeV2({
      id: activeSessionRow.version_id,
      case_id: normalizeCaseId(activeSessionRow.version_case_id),
      status: activeSessionRow.version_status,
      content_format: activeSessionRow.version_content_format,
      content: activeSessionRow.version_content,
    });

    if (
      sessionCaseId !== resolved.caseId ||
      activeSessionRow.session_case_version_id !== resolved.caseVersionId
    ) {
      throw new Error('Invalid active session case version anchor');
    }

    const session = createStudentSessionDto({
      sessionId: activeSessionRow.session_id,
      ...resolved.publicCaseData,
    });

    const { rows: messageRows } = await client.query(
      `
      SELECT
        m.role,
        m.content
      FROM public.messages AS m
      INNER JOIN public.sessions AS s
        ON s.id = m.session_id
      WHERE m.session_id = $1
        AND s.id = m.session_id
        AND s.user_id = $2
      ORDER BY m.created_at ASC, m.id ASC
      `,
      [session.sessionId, userId],
    );

    return {
      session,
      messages: parseStudentMessages(messageRows),
    };
  } finally {
    client.release();
  }
}

export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 },
      );
    }

    const response = await recoverActiveSessionForStudent(user.id);
    if (response === null) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error recuperando sesión:', error);
    return NextResponse.json(
      { error: 'Error recuperando sesión' },
      { status: 500 },
    );
  }
}
