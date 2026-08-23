import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth';
import {
  generateSafePatientReplyV2,
  PatientResponseSafetyErrorV2,
  type PatientResponseSafetyCallReceiptV2,
} from '@/lib/cases/v2/generate-safe-patient-reply';
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

type ObservedPatientResponseUsage = Readonly<{
  inputTokens: number;
  outputTokens: number;
  hasObservedUsage: boolean;
}>;

const PATIENT_RESPONSE_GENERATOR_CONFIG = Object.freeze({
  model: MODEL_CHAT,
  maxTokens: 200,
  timeoutMs: 30_000,
});

const PATIENT_RESPONSE_VALIDATOR_CONFIG = Object.freeze({
  model: MODEL_CHAT,
  maxOutputTokens: 300,
  timeoutMs: 30_000,
});

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

function sumObservedPatientResponseUsageV2(
  calls: readonly PatientResponseSafetyCallReceiptV2[],
): ObservedPatientResponseUsage {
  let inputTokens = 0;
  let outputTokens = 0;
  let hasObservedUsage = false;
  for (const call of calls) {
    if (call.inputTokens === undefined || call.outputTokens === undefined) {
      continue;
    }
    hasObservedUsage = true;
    inputTokens += call.inputTokens;
    outputTokens += call.outputTokens;
  }
  return { inputTokens, outputTokens, hasObservedUsage };
}

async function persistObservedPatientResponseUsage(
  sessionId: string,
  calls: readonly PatientResponseSafetyCallReceiptV2[],
): Promise<void> {
  const usage = sumObservedPatientResponseUsageV2(calls);
  if (!usage.hasObservedUsage) return;

  await pool.query(
    `update sessions
     set prompt_tokens = prompt_tokens + $1,
         completion_tokens = completion_tokens + $2
     where id = $3`,
    [usage.inputTokens, usage.outputTokens, sessionId],
  );
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
  let bodyForAccounting: ChatRequestBody | null = null;
  try {
    const user = await requireUser();
    const body = parseChatRequestBody(await readChatRequestBody(req));

    if (body === null) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 });
    }
    bodyForAccounting = body;

    const runtime = await resolveSessionPatientClinicalRuntimeV2({
      authenticatedUserId: user.id,
      sessionId: body.sessionId,
    });

    const messagesResult = await pool.query(
      `select role, content
       from messages
       where session_id = $1
       order by created_at asc, id asc`,
      [body.sessionId],
    );
    const acceptedConversation = parsePersistedMessages(messagesResult.rows);

    await pool.query(
      `insert into messages (session_id, role, content)
       values ($1, 'student', $2)`,
      [body.sessionId, body.message],
    );

    const acceptedReply = await generateSafePatientReplyV2(
      {
        clinicalContent: runtime.clinicalContent,
        acceptedConversation,
        currentStudentTurn: body.message,
      },
      {
        patientGenerator: {
          client: openai,
          config: PATIENT_RESPONSE_GENERATOR_CONFIG,
        },
        semanticValidator: {
          client: openai,
          config: PATIENT_RESPONSE_VALIDATOR_CONFIG,
        },
      },
    );

    await persistObservedPatientResponseUsage(
      body.sessionId,
      acceptedReply.receipt.calls,
    );

    await pool.query(
      `insert into messages (session_id, role, content)
       values ($1, 'patient', $2)`,
      [body.sessionId, acceptedReply.reply],
    );

    return NextResponse.json({ reply: acceptedReply.reply });
  } catch (error: unknown) {
    if (error instanceof SessionClinicalRuntimeErrorV2) {
      return runtimeErrorResponse(error);
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    if (error instanceof PatientResponseSafetyErrorV2) {
      try {
        if (bodyForAccounting === null) {
          return NextResponse.json({ error: 'Error en el chat' }, { status: 500 });
        }
        await persistObservedPatientResponseUsage(
          bodyForAccounting.sessionId,
          error.calls,
        );
      } catch {
        return NextResponse.json({ error: 'Error en el chat' }, { status: 500 });
      }
      return NextResponse.json(
        { error: 'No se pudo generar una respuesta segura del paciente' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Error en el chat' }, { status: 500 });
  }
}
