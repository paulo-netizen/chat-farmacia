import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth';
import { buildPatientChatSystemPromptV2 } from '@/lib/cases/v2/patient-chat-prompt';
import {
  resolveSessionPatientClinicalRuntimeV2,
  SessionClinicalRuntimeErrorV2,
} from '@/lib/cases/v2/session-clinical-runtime';
import { pool } from '@/lib/db';
import { MODEL_CHAT, openai } from '@/lib/openai';

type ChatRequestBody = Readonly<{
  sessionId: string;
  message: string;
}>;

type PersistedChatMessage = Readonly<{
  role: 'student' | 'patient';
  content: string;
}>;

async function readChatRequestBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function parseChatRequestBody(value: unknown): ChatRequestBody | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const source = value as Record<string, unknown>;
  if (
    typeof source.sessionId !== 'string' ||
    source.sessionId.trim().length === 0 ||
    typeof source.message !== 'string' ||
    source.message.trim().length === 0
  ) {
    return null;
  }
  return {
    sessionId: source.sessionId,
    message: source.message,
  };
}

function parsePersistedMessages(value: unknown): PersistedChatMessage[] {
  if (!Array.isArray(value)) {
    throw new Error('Invalid persisted chat history');
  }
  return value.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error('Invalid persisted chat message');
    }
    const row = item as Record<string, unknown>;
    if (row.role !== 'student' && row.role !== 'patient') {
      throw new Error('Invalid persisted chat role');
    }
    if (typeof row.content !== 'string') {
      throw new Error('Invalid persisted chat content');
    }
    return { role: row.role, content: row.content };
  });
}

function runtimeErrorResponse(error: SessionClinicalRuntimeErrorV2) {
  if (error.code === 'session_not_found_or_forbidden') {
    return NextResponse.json(
      { error: 'Sesión no encontrada' },
      { status: 404 },
    );
  }
  if (error.code === 'session_not_active') {
    return NextResponse.json(
      { error: 'La sesión no está activa' },
      { status: 400 },
    );
  }
  if (error.code === 'invalid_input') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  return NextResponse.json({ error: 'Error en el chat' }, { status: 500 });
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = parseChatRequestBody(await readChatRequestBody(req));

    if (body === null) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const runtime = await resolveSessionPatientClinicalRuntimeV2({
      authenticatedUserId: user.id,
      sessionId: body.sessionId,
    });
    const systemContent = buildPatientChatSystemPromptV2(
      runtime.clinicalContent,
    );

    await pool.query(
      `insert into messages (session_id, role, content)
       values ($1, 'student', $2)`,
      [body.sessionId, body.message],
    );

    const messagesResult = await pool.query(
      `select role, content
       from messages
       where session_id = $1
       order by created_at asc, id asc`,
      [body.sessionId],
    );
    const persistedMessages = parsePersistedMessages(messagesResult.rows);
    const chatMessages = [
      { role: 'system' as const, content: systemContent },
      ...persistedMessages.map((message) => ({
        role:
          message.role === 'student'
            ? ('user' as const)
            : ('assistant' as const),
        content: message.content,
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
      [body.sessionId, reply],
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
        [promptTokens, completionTokens, cost, body.sessionId],
      );
    }

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    if (error instanceof SessionClinicalRuntimeErrorV2) {
      return runtimeErrorResponse(error);
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error en el chat' }, { status: 500 });
  }
}
