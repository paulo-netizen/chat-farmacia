import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';

async function getOrAssignCaseForStudent(userId: number) {
  const client = await pool.connect();
  try {
    // 1) Buscar un caso nuevo no asignado al alumno
    const { rows: available } = await client.query(
      `
      SELECT c.*
      FROM cases c
      LEFT JOIN case_assignments ca
        ON ca.case_id = c.id AND ca.student_id = $1
      WHERE c.status IN ('approved', 'published')
        AND ca.id IS NULL
      ORDER BY random()
      LIMIT 1
      `,
      [userId]
    );

    let caseRow;

    if (available.length > 0) {
      // Se encontró un caso nuevo
      caseRow = available[0];
    } else {
      // 2) Si no quedan casos nuevos, escoger cualquiera disponible en modo aleatorio
      const { rows } = await client.query(
        `
        SELECT *
        FROM cases
        WHERE status IN ('approved', 'published')
        ORDER BY random()
        LIMIT 1
        `
      );

      if (rows.length === 0) {
        throw new Error('No hay casos publicados disponibles');
      }

      caseRow = rows[0];
    }

    // 3) Registrar asignación en case_assignments (o no hacer nada si ya existía)
    await client.query(
      `
      INSERT INTO case_assignments (student_id, case_id)
      VALUES ($1, $2)
      ON CONFLICT (student_id, case_id) DO NOTHING
      `,
      [userId, caseRow.id]
    );

    return caseRow;
  } finally {
    client.release();
  }
}

export async function POST(req: Request) {
  try {
    // Obtener usuario del cookie JWT
    const user = await getUserFromRequest(req);

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // En Fase 1 incluso profesores entran en el chat igual que alumnos
    const caseRow = await getOrAssignCaseForStudent(user.id);

    const client = await pool.connect();
    try {
      const { rows: sessionRows } = await client.query(
        `
        INSERT INTO sessions (user_id, case_id)
        VALUES ($1, $2)
        RETURNING id
        `,
        [user.id, caseRow.id]
      );

      return NextResponse.json({
        sessionId: sessionRows[0].id,
        case: caseRow,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creando sesión:', err);
    return NextResponse.json(
      { error: 'Error creando sesión' },
      { status: 500 }
    );
  }
}

