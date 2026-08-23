import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth';
import {
  LegacyEvaluationErrorV2,
  parseLegacyEvaluationAnswersV2,
} from '@/lib/cases/v2/legacy-evaluation';
import {
  finalizeLegacyEvaluationV2,
  LegacyEvaluationFinalizationErrorV2,
} from '@/lib/cases/v2/legacy-evaluation-finalization';
import {
  resolveSessionEvaluatorClinicalRuntimeV2,
  SessionClinicalRuntimeErrorV2,
} from '@/lib/cases/v2/session-clinical-runtime';

type EvaluationRequestBody = Readonly<{
  sessionId: string;
  answers: ReturnType<typeof parseLegacyEvaluationAnswersV2>;
}>;

async function readEvaluationRequestBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function parseEvaluationRequestBody(input: unknown): EvaluationRequestBody | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return null;
  }
  const source = input as Record<string, unknown>;
  if (
    typeof source.sessionId !== 'string' ||
    source.sessionId.trim().length === 0
  ) {
    return null;
  }
  return {
    sessionId: source.sessionId,
    answers: parseLegacyEvaluationAnswersV2(source),
  };
}

function legacyEvaluationErrorResponse(error: LegacyEvaluationErrorV2) {
  if (error.code === 'invalid_answers') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  return NextResponse.json(
    { error: 'Error guardando evaluación' },
    { status: 500 },
  );
}

function runtimeErrorResponse(error: SessionClinicalRuntimeErrorV2) {
  if (error.code === 'invalid_input') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  if (error.code === 'session_not_found_or_forbidden') {
    return NextResponse.json(
      { error: 'Sesión no encontrada' },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { error: 'Error guardando evaluación' },
    { status: 500 },
  );
}

function finalizationErrorResponse(
  error: LegacyEvaluationFinalizationErrorV2,
) {
  if (error.code === 'invalid_input') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  if (error.code === 'unsupported_evaluation_format') {
    return NextResponse.json(
      { error: 'Este caso requiere otro formato de evaluación' },
      { status: 422 },
    );
  }
  if (error.code === 'session_not_found_or_forbidden') {
    return NextResponse.json(
      { error: 'Sesión no encontrada' },
      { status: 404 },
    );
  }
  return NextResponse.json(
    { error: 'Error guardando evaluación' },
    { status: 500 },
  );
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = parseEvaluationRequestBody(
      await readEvaluationRequestBody(req),
    );
    if (body === null) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const runtime = await resolveSessionEvaluatorClinicalRuntimeV2({
      authenticatedUserId: user.id,
      sessionId: body.sessionId,
    });
    const publicResult = await finalizeLegacyEvaluationV2({
      authenticatedUserId: user.id,
      runtime,
      answers: body.answers,
    });
    return NextResponse.json(publicResult);
  } catch (error: unknown) {
    if (error instanceof LegacyEvaluationErrorV2) {
      return legacyEvaluationErrorResponse(error);
    }
    if (error instanceof SessionClinicalRuntimeErrorV2) {
      return runtimeErrorResponse(error);
    }
    if (error instanceof LegacyEvaluationFinalizationErrorV2) {
      return finalizationErrorResponse(error);
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json(
      { error: 'Error guardando evaluación' },
      { status: 500 },
    );
  }
}
