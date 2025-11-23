import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

const ALLOWED_STATUSES = ['draft', 'approved', 'rejected'] as const;
type CaseStatus = (typeof ALLOWED_STATUSES)[number];

type DbCase = {
  id: number;
  title: string;
  description: string | null;
  spec: any;
  ground_truth: any;
  difficulty: number | null;
  status: CaseStatus;
  service_type: string | null;
  created_at: string;
};

// 🔹 Solo profesores/admin pueden usar este endpoint
async function requireTeacher() {
  const user = await getCurrentUser();
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    return null;
  }
  return user;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireTeacher();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  try {
    const result = await pool.query(
      `
      SELECT
        id,
        title,
        description,
        spec,
        ground_truth,
        difficulty,
        status,
        service_type,
        created_at
      FROM cases
      WHERE id = $1
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
    }

    const row = result.rows[0] as DbCase;
    return NextResponse.json(row);
  } catch (err) {
    console.error('Error fetching case by id:', err);
    return NextResponse.json(
      { error: 'Error al recuperar el caso' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requireTeacher();
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const id = Number(params.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const {
    title,
    description,
    spec,
    ground_truth,
    difficulty,
    status,
  } = body as {
    title: string;
    description?: string;
    spec?: any;
    ground_truth?: any;
    difficulty?: number | string;
    status: CaseStatus;
  };

  if (!title || !title.trim()) {
    return NextResponse.json(
      { error: 'El título es obligatorio' },
      { status: 400 }
    );
  }

  if (!ALLOWED_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: 'Estado de caso no válido' },
      { status: 400 }
    );
  }

  const diffNumber = Number(difficulty ?? 1);
  if (!Number.isFinite(diffNumber) || diffNumber < 1) {
    return NextResponse.json(
      { error: 'La dificultad debe ser un número >= 1' },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `
      UPDATE cases
      SET
        title = $1,
        description = $2,
        spec = $3::jsonb,
        ground_truth = $4::jsonb,
        difficulty = $5,
        status = $6,
        updated_at = NOW()
      WHERE id = $7
      RETURNING
        id,
        title,
        description,
        spec,
        ground_truth,
        difficulty,
        status,
        service_type,
        created_at
      `,
      [
        title.trim(),
        description ?? '',
        JSON.stringify(spec ?? {}),
        JSON.stringify(ground_truth ?? {}),
        diffNumber,
        status,
        id,
      ]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: 'Caso no encontrado' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0] as DbCase);
  } catch (err: any) {
    console.error('Error updating case:', err);
    // por si vuelve a saltar el constraint de status
    if (err?.code === '23514') {
      return NextResponse.json(
        { error: 'El estado del caso no cumple la restricción de la base de datos' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Error al actualizar el caso' },
      { status: 500 }
    );
  }
}
