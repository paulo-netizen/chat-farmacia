import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pool } from '@/lib/db';
import { openai, MODEL_CHAT } from '@/lib/openai';

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { sessionId, message } = await req.json();
    if (!sessionId || !message) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const sessionResult = await pool.query(
      `select s.id, s.status, c.spec, c.ground_truth
       from sessions s
       join cases c on c.id = s.case_id
       where s.id = $1 and s.user_id = $2`,
      [sessionId, user.id]
    );
    if (sessionResult.rowCount === 0) {
      return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
    }
    const session = sessionResult.rows[0];
    if (session.status !== 'active') {
      return NextResponse.json({ error: 'La sesión ya está finalizada' }, { status: 400 });
    }

    await pool.query(
      `insert into messages (session_id, role, content)
       values ($1, 'student', $2)`,
      [sessionId, message]
    );

    const messagesResult = await pool.query(
      `select role, content
       from messages
       where session_id = $1
       order by created_at asc`,
      [sessionId]
    );

    const spec = session.spec;
    const systemContent = `
Eres un paciente llamado ${spec.nombre ?? 'la persona'} de ${spec.edad ?? 'edad adulta'} años.
Hablas siempre en primera persona como paciente, en español sencillo.

Contexto clínico:
- Motivo de consulta: ${spec.motivo_consulta ?? 'no especificado'}
- Antecedentes: ${spec.antecedentes ?? 'no especificados'}
- Tratamiento: ${spec.tratamiento ?? 'no especificado'}
- Contexto personal: ${spec.contexto ?? 'no especificado'}
- Descripción: ${spec.descripcion_paciente ?? 'no especificada'}

Reglas IMPORTANTES:
- No des diagnósticos médicos ni recomendaciones técnicas como profesional.
- Responde sólo como paciente: cómo te sientes, qué entiendes, qué haces con la medicación.
- Responde de forma breve: 3-6 frases (máx. ~120 palabras).
- Si el estudiante te hace preguntas muy técnicas, responde como paciente que no entiende del todo.
`;

    const chatMessages = [
      { role: 'system' as const, content: systemContent },
      ...messagesResult.rows.map((m: any) => ({
        role: m.role === 'student' ? ('user' as const) : ('assistant' as const),
        content: m.content as string,
      })),
      { role: 'user' as const, content: message as string },
    ];

    const completion = await openai.chat.completions.create({
      model: MODEL_CHAT,
      messages: chatMessages,
      max_tokens: 200,
    });

    const reply = completion.choices[0]?.message?.content ?? 'Lo siento, no sé qué responder ahora mismo.';

    await pool.query(
      `insert into messages (session_id, role, content)
       values ($1, 'patient', $2)`,
      [sessionId, reply]
    );

    const usage = completion.usage;
    if (usage) {
      const promptTokens = usage.prompt_tokens ?? 0;
      const completionTokens = usage.completion_tokens ?? 0;
      const priceIn = parseFloat(process.env.PRICE_INPUT_EUR_PER_MTOK || '0');
      const priceOut = parseFloat(process.env.PRICE_OUTPUT_EUR_PER_MTOK || '0');
      const cost =
        (promptTokens / 1_000_000) * priceIn +
        (completionTokens / 1_000_000) * priceOut;

      await pool.query(
        `update sessions
         set prompt_tokens = prompt_tokens + $1,
             completion_tokens = completion_tokens + $2,
             cost_eur = cost_eur + $3
         where id = $4`,
        [promptTokens, completionTokens, cost, sessionId]
      );
    }

    return NextResponse.json({ reply });
  } catch (e: any) {
    if (e.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Error en el chat' }, { status: 500 });
  }
}
