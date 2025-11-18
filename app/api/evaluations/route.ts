import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pool } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { sessionId, tipo_no_adherencia, barrera, intervenciones } = await req.json();

    if (!sessionId || !tipo_no_adherencia || !barrera || !Array.isArray(intervenciones)) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    const sessionResult = await pool.query(
      `select s.id, s.user_id, s.status, c.ground_truth
       from sessions s
       join cases c on c.id = s.case_id
       where s.id = $1`,
      [sessionId]
    );
    if (sessionResult.rowCount === 0) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }
    const session = sessionResult.rows[0];
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const gt = session.ground_truth;
    const gtTipo = (gt.tipo_no_adherencia as string) ?? '';
    const gtBarrera = (gt.barrera_principal as string) ?? '';
    const gtInterv = (gt.intervenciones_validas as string[]) ?? [];

    const isTipoOk = tipo_no_adherencia.trim().toLowerCase() === gtTipo.toLowerCase();
    const isBarreraOk = barrera.trim().toLowerCase() === gtBarrera.toLowerCase();

    const intervLower = intervenciones.map((i: string) => i.trim().toLowerCase());
    const gtLower = gtInterv.map((i: string) => i.trim().toLowerCase());

    const aciertosInterv = intervLower.filter((i: string) => gtLower.includes(i)).length;
    const isIntervOk = aciertosInterv > 0;

    const score = (isTipoOk ? 1 : 0) + (isBarreraOk ? 1 : 0) + (isIntervOk ? 1 : 0);

    const feedbackPartes: string[] = [];
    if (isTipoOk) feedbackPartes.push('Has identificado correctamente el tipo de no adherencia.');
    else feedbackPartes.push(`El tipo de no adherencia correcto era: "${gtTipo}".`);

    if (isBarreraOk) feedbackPartes.push('Has identificado correctamente la barrera principal.');
    else feedbackPartes.push(`La barrera principal correcta era: "${gtBarrera}".`);

    if (isIntervOk) {
      feedbackPartes.push('Has seleccionado al menos una intervención adecuada.');
    } else {
      feedbackPartes.push(
        `Las intervenciones recomendadas incluían: ${gtInterv.join(', ')}.`
      );
    }

    const feedback = feedbackPartes.join(' ');

    await pool.query(
      `insert into evaluations (
         session_id, tipo_no_adherencia, barrera, intervenciones,
         is_tipo_ok, is_barrera_ok, is_intervencion_ok, score, feedback
       )
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       on conflict (session_id) do update set
         tipo_no_adherencia = excluded.tipo_no_adherencia,
         barrera = excluded.barrera,
         intervenciones = excluded.intervenciones,
         is_tipo_ok = excluded.is_tipo_ok,
         is_barrera_ok = excluded.is_barrera_ok,
         is_intervencion_ok = excluded.is_intervencion_ok,
         score = excluded.score,
         feedback = excluded.feedback`,
      [
        sessionId,
        tipo_no_adherencia,
        barrera,
        intervenciones,
        isTipoOk,
        isBarreraOk,
        isIntervOk,
        score,
        feedback,
      ]
    );

    await pool.query(
      `update sessions
       set status = 'finished', finished_at = now()
       where id = $1`,
      [sessionId]
    );

    return NextResponse.json({
      score,
      isTipoOk,
      isBarreraOk,
      isIntervOk,
      feedback,
    });
  } catch (e: any) {
    if (e.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Error guardando evaluación' }, { status: 500 });
  }
}
