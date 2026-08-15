import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import {
  createStudentCasePublicData,
  createStudentSessionDto,
} from '@/lib/cases/student-session-dto';

type StudentCaseRow = {
  case_id: number;
  nombre: unknown;
  edad: unknown;
  sexo: unknown;
  tratamiento: unknown;
};

async function getOrAssignCaseForStudent(userId: number) {
  const client = await pool.connect();
  try {
    // 1) Buscar un caso nuevo no asignado al alumno
    const { rows: available } = await client.query(
      `
      SELECT
        c.id AS case_id,
        c.spec ->> 'nombre' AS nombre,
        c.spec ->> 'edad' AS edad,
        c.spec ->> 'sexo' AS sexo,
        c.spec ->> 'tratamiento' AS tratamiento
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

    let caseRow: StudentCaseRow;

    if (available.length > 0) {
      // Se encontró un caso nuevo
      caseRow = available[0] as StudentCaseRow;
    } else {
      // 2) Si no quedan casos nuevos, escoger cualquiera disponible en modo aleatorio
      const { rows } = await client.query(
        `
        SELECT
          id AS case_id,
          spec ->> 'nombre' AS nombre,
          spec ->> 'edad' AS edad,
          spec ->> 'sexo' AS sexo,
          spec ->> 'tratamiento' AS tratamiento
        FROM cases
        WHERE status IN ('approved', 'published')
        ORDER BY random()
        LIMIT 1
        `
      );

      if (rows.length === 0) {
        throw new Error('No hay casos publicados disponibles');
      }

      caseRow = rows[0] as StudentCaseRow;
    }

    // 3) Registrar asignación en case_assignments (o no hacer nada si ya existía)
    const publicCaseData = createStudentCasePublicData({
      nombre: caseRow.nombre,
      edad: caseRow.edad,
      sexo: caseRow.sexo,
      tratamiento: caseRow.tratamiento,
    });

    await client.query(
      `
      INSERT INTO case_assignments (student_id, case_id)
      VALUES ($1, $2)
      ON CONFLICT (student_id, case_id) DO NOTHING
      `,
      [userId, caseRow.case_id]
    );

    return {
      caseId: caseRow.case_id,
      publicCaseData,
    };
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
    const selectedCase = await getOrAssignCaseForStudent(user.id);

    const client = await pool.connect();
    try {
      const { rows: sessionRows } = await client.query(
        `
        INSERT INTO sessions (user_id, case_id)
        VALUES ($1, $2)
        RETURNING id
        `,
        [user.id, selectedCase.caseId]
      );

      const response = createStudentSessionDto({
        sessionId: sessionRows[0]?.id,
        ...selectedCase.publicCaseData,
      });

      return NextResponse.json(response);
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

