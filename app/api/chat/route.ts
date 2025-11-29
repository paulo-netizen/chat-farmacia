import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { pool } from '@/lib/db';
import { openai, MODEL_CHAT } from '@/lib/openai';

type CaseSpec = {
  nombre?: string;
  edad?: number;
  sexo?: string;
  motivo_consulta?: string;
  antecedentes?: string;
  tratamiento?: string;
  contexto?: string;
  descripcion_paciente?: string;
};

type GroundTruth = {
  diagnostico_principal?: string;
  problema_farmacoterapeutico?: string;
  tipo_no_adherencia?: string;
  barrera_principal?: string;
  otras_barreras?: string[];
  intervenciones_recomendadas?: string[];
  personalidad_paciente?: string;
  objetivos_aprendizaje?: string[];
};

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { sessionId, message } = await req.json();

    if (!sessionId || !message) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const sessionResult = await pool.query(
      `select s.id,
              s.status,
              c.spec,
              c.ground_truth,
              c.service_type
       from sessions s
       join cases c on c.id = s.case_id
       where s.id = $1 and s.user_id = $2`,
      [sessionId, user.id],
    );

    if (sessionResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Sesión no encontrada' },
        { status: 404 },
      );
    }

    const session = sessionResult.rows[0];

    if (session.status !== 'active') {
      return NextResponse.json(
        { error: 'La sesión ya está finalizada' },
        { status: 400 },
      );
    }

    // Guardamos el mensaje del alumno
    await pool.query(
      `insert into messages (session_id, role, content)
       values ($1, 'student', $2)`,
      [sessionId, message],
    );

    // Recuperamos todo el historial de la sesión
    const messagesResult = await pool.query(
      `select role, content
       from messages
       where session_id = $1
       order by created_at asc`,
      [sessionId],
    );

    const spec: CaseSpec = session.spec || {};
    const groundTruth: GroundTruth = session.ground_truth || {};
    const serviceType: string = session.service_type || 'SAT';

    const systemContent = `
Eres una paciente virtual en una simulación de entrevista farmacéutica
en una farmacia comunitaria en España.

Información clínica SOLO PARA TI (no la nombres como tal al alumno):
- Nombre: ${spec.nombre ?? 'Paciente'}
- Edad: ${spec.edad ?? '?'} años
- Sexo: ${spec.sexo ?? '?'}
- Motivo de consulta: ${spec.motivo_consulta ?? ''}
- Antecedentes: ${spec.antecedentes ?? ''}
- Tratamiento actual: ${spec.tratamiento ?? ''}
- Contexto de vida: ${spec.contexto ?? ''}
- Descripción adicional del paciente: ${spec.descripcion_paciente ?? ''}

Servicio profesional:
- Tipo de servicio: ${serviceType} (actualmente SAT = Servicio de Adherencia Terapéutica).

Objetivo docente del caso:
- Diagnóstico principal: ${groundTruth.diagnostico_principal ?? ''}
- Problema farmacoterapéutico: ${groundTruth.problema_farmacoterapeutico ?? ''}
- Tipo de no adherencia que el alumno debe descubrir: "${
      groundTruth.tipo_no_adherencia ?? ''
    }"
- Barrera principal que el alumno debe identificar: "${
      groundTruth.barrera_principal ?? ''
    }"

Personalidad del paciente:
${
  groundTruth.personalidad_paciente ??
  'Paciente colaborador, algo preocupado, que responde de forma natural.'
}

Instrucciones de role-play:
- Responde SIEMPRE en PRIMERA PERSONA como si fueras el paciente.
- No digas nunca que eres una IA ni que esto es una simulación.
- No uses nombres técnicos como "tipo de no adherencia" o "problema farmacoterapéutico";
  habla como hablaría una persona normal (olvidos, miedos, dudas, creencias, costumbres, etc.).

- EN TU PRIMER MENSAJE:
  - Limítate a saludar y a dar un motivo MUY BÁSICO para estar en la farmacia
    (por ejemplo: "vengo a recoger la medicación para la tensión" o "vengo a por mis pastillas").
  - No digas que quieres revisar el tratamiento, ni que quieres asegurarte de nada,
    ni que tienes dudas sobre si lo tomas bien, ni que te preocupa algo.
  - El objetivo es que el farmacéutico tenga que explorar con preguntas adecuadas.

- La información sobre olvidos, miedos, creencias, falta de comprensión del tratamiento, efectos adversos, etc.
  debe aparecer solo cuando el alumno te pregunte y profundice con buenas preguntas.
- Si el alumno hace preguntas abiertas y muestra empatía, puedes ir contando cada vez más detalles
  sobre tus hábitos, olvidos, miedos, creencias, síntomas y preocupaciones.
- Si el alumno no pregunta por algo concreto, NO des tú esa información de forma gratuita.

- Solo menciona información clínica o técnica cuando tenga sentido que el paciente la sepa;
  nunca cites guías clínicas ni términos muy especializados.
- Mantén las respuestas relativamente breves (1–4 frases) para favorecer el diálogo.
- Usa español europeo neutro, propio de una farmacia comunitaria en España.

`;

    const chatMessages = [
      { role: 'system' as const, content: systemContent },
      ...messagesResult.rows.map((m: any) => ({
        role: m.role === 'student' ? ('user' as const) : ('assistant' as const),
        content: m.content as string,
      })),
    ];

    const completion = await openai.chat.completions.create({
      model: MODEL_CHAT,
      messages: chatMessages,
      max_tokens: 200,
    });

    const reply =
      completion.choices[0]?.message?.content ??
      'Lo siento, no sé qué responder ahora mismo.';

    await pool.query(
      `insert into messages (session_id, role, content)
       values ($1, 'patient', $2)`,
      [sessionId, reply],
    );

    const usage = completion.usage;
    if (usage) {
      const promptTokens = usage.prompt_tokens ?? 0;
      const completionTokens = usage.completion_tokens ?? 0;
      const priceIn = parseFloat(
        process.env.PRICE_INPUT_EUR_PER_MTOK || '0',
      );
      const priceOut = parseFloat(
        process.env.PRICE_OUTPUT_EUR_PER_MTOK || '0',
      );
      const cost =
        (promptTokens / 1_000_000) * priceIn +
        (completionTokens / 1_000_000) * priceOut;

      await pool.query(
        `update sessions
         set prompt_tokens = prompt_tokens + $1,
             completion_tokens = completion_tokens + $2,
             cost_eur = cost_eur + $3
         where id = $4`,
        [promptTokens, completionTokens, cost, sessionId],
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

