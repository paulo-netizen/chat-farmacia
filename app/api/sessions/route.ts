import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function POST() {
  try {
    const user = await requireUser();

    const caseResult = await pool.query(
      `select id, title, description, spec
       from cases
       where status = 'approved'
       order by random()
       limit 1`
    );
    if (caseResult.rowCount === 0) {
      return NextResponse.json({ error: 'No hay casos disponibles' }, { status: 500 });
    }

    const c = caseResult.rows[0];

    const sessionResult = await pool.query(
      `insert into sessions (user_id, case_id)
       values ($1, $2)
       returning id`,
      [user.id, c.id]
    );

    const sessionId = sessionResult.rows[0].id as string;

    return NextResponse.json({
      sessionId,
      case: {
        id: c.id,
        title: c.title,
        description: c.description,
        spec: c.spec,
      },
    });
  } catch (e: any) {
    if (e.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Error creando sesión' }, { status: 500 });
  }
}
