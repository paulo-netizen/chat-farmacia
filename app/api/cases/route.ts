import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { requireUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (user.role !== 'teacher' && user.role !== 'admin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();

    const title: string = body.title ?? '';
    const description: string = body.description ?? '';
    const rawStatus: string | undefined = body.status;
const allowedStatuses = ['approved', 'rejected'];
const status: string =
  rawStatus && allowedStatuses.includes(rawStatus)
    ? rawStatus
    : 'approved';
    const serviceType: string = body.service_type ?? 'SAT';
    const difficulty: number = Number(body.difficulty ?? 1);

    let spec: any = {};
    let groundTruth: any = {};

    try {
      if (body.spec) spec = JSON.parse(body.spec);
    } catch {
      return NextResponse.json(
        { error: 'spec no es un JSON válido' },
        { status: 400 }
      );
    }

    try {
      if (body.ground_truth) groundTruth = JSON.parse(body.ground_truth);
    } catch {
      return NextResponse.json(
        { error: 'ground_truth no es un JSON válido' },
        { status: 400 }
      );
    }

    if (!title.trim()) {
      return NextResponse.json(
        { error: 'El título es obligatorio' },
        { status: 400 }
      );
    }

    const result = await pool.query(
      `
      INSERT INTO cases (title, description, spec, ground_truth, status, service_type, difficulty)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
      `,
      [title, description, spec, groundTruth, status, serviceType, difficulty]
    );

    const newId = result.rows[0].id as number;

    return NextResponse.json({ id: newId });
  } catch (err) {
    console.error('Error creando caso', err);
    return NextResponse.json(
      { error: 'Error creando caso' },
      { status: 500 }
    );
  }
}
