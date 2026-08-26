import { NextResponse } from 'next/server';

import { requireUser } from '@/lib/auth';
import { SpfaEvaluationClaimErrorV2 } from '@/lib/cases/v2/claim-spfa-session-evaluation';
import {
  finalizeOwnedSpfaSessionEvaluationV2,
  SpfaEvaluationFinalizationErrorV2,
  type SpfaEvaluationFinalizationResultV2,
} from '@/lib/cases/v2/finalize-spfa-session-evaluation';
import {
  getOwnedSpfaEvaluationStatusV2,
  GetOwnedSpfaEvaluationStatusErrorV2,
} from '@/lib/cases/v2/get-owned-spfa-evaluation-status';
import {
  LegacyEvaluationErrorV2,
  parseLegacyEvaluationAnswersV2,
} from '@/lib/cases/v2/legacy-evaluation';
import {
  finalizeLegacyEvaluationV2,
  LegacyEvaluationFinalizationErrorV2,
} from '@/lib/cases/v2/legacy-evaluation-finalization';
import { toStudentSpfaEvaluationDtoV2 } from '@/lib/cases/v2/spfa-evaluation-dto';
import {
  resolveSessionEvaluatorClinicalRuntimeV2,
  SessionClinicalRuntimeErrorV2,
} from '@/lib/cases/v2/session-clinical-runtime';

type EvaluationEnvelope = Readonly<{
  sessionId: string;
  source: Record<string, unknown>;
}>;

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function parseEvaluationEnvelope(input: unknown): EvaluationEnvelope | null {
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
  return { sessionId: source.sessionId, source };
}

function isStrictGeneratedBody(envelope: EvaluationEnvelope): boolean {
  return Object.keys(envelope.source).length === 1 &&
    Object.prototype.hasOwnProperty.call(envelope.source, 'sessionId');
}

function genericEvaluationError(status = 500) {
  return NextResponse.json(
    { error: 'Error guardando evaluación' },
    { status },
  );
}

function legacyEvaluationErrorResponse(error: LegacyEvaluationErrorV2) {
  if (error.code === 'invalid_answers') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  return genericEvaluationError();
}

function runtimeErrorResponse(error: SessionClinicalRuntimeErrorV2) {
  if (error.code === 'invalid_input') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  if (error.code === 'session_not_found_or_forbidden') {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
  }
  return genericEvaluationError();
}

function legacyFinalizationErrorResponse(error: LegacyEvaluationFinalizationErrorV2) {
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
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
  }
  return genericEvaluationError();
}

function spfaClaimErrorResponse(error: SpfaEvaluationClaimErrorV2) {
  if (error.code === 'invalid_input') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  if (error.code === 'session_not_found_or_forbidden') {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
  }
  if (error.code === 'spfa_evaluation_not_available') {
    return NextResponse.json(
      { error: 'Este caso requiere otro formato de evaluación' },
      { status: 422 },
    );
  }
  if (error.code === 'invalid_session_state' || error.code === 'legacy_evaluation_exists') {
    return NextResponse.json(
      { error: 'La evaluación no está disponible en este estado' },
      { status: 409 },
    );
  }
  return genericEvaluationError();
}

function spfaFinalizationErrorResponse(error: SpfaEvaluationFinalizationErrorV2) {
  if (error.code === 'attempt_superseded') {
    return NextResponse.json(
      { error: 'La evaluación ha cambiado de estado' },
      { status: 409 },
    );
  }
  return genericEvaluationError();
}

function spfaFinalizationResponse(result: SpfaEvaluationFinalizationResultV2) {
  const dto = toStudentSpfaEvaluationDtoV2(result);
  if (result.outcome === 'IN_PROGRESS') {
    return NextResponse.json(dto, { status: 202 });
  }
  if (result.outcome === 'FAILED') {
    const status = result.failureCode === 'PROVIDER_FAILURE' ||
      result.failureCode === 'INVALID_PROVIDER_RESULT'
      ? 503
      : 500;
    return NextResponse.json(dto, { status });
  }
  return NextResponse.json(dto, { status: 200 });
}

function readErrorResponse(error: GetOwnedSpfaEvaluationStatusErrorV2) {
  if (error.code === 'invalid_input') {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  if (error.code === 'session_not_found_or_forbidden') {
    return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });
  }
  if (error.code === 'spfa_evaluation_not_available') {
    return NextResponse.json(
      { error: 'Este caso requiere otro formato de evaluación' },
      { status: 422 },
    );
  }
  return NextResponse.json(
    { error: 'Error consultando evaluación' },
    { status: 500 },
  );
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const envelope = parseEvaluationEnvelope(await readJsonBody(req));
    if (envelope === null) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }

    const runtime = await resolveSessionEvaluatorClinicalRuntimeV2({
      authenticatedUserId: user.id,
      sessionId: envelope.sessionId,
    });
    if (runtime.clinicalContent.contentFormat === 'GENERATED_CASE_BUNDLE_V2') {
      if (!isStrictGeneratedBody(envelope)) {
        return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
      }
      return spfaFinalizationResponse(
        await finalizeOwnedSpfaSessionEvaluationV2({
          authenticatedUserId: user.id,
          sessionId: envelope.sessionId,
        }),
      );
    }

    const answers = parseLegacyEvaluationAnswersV2(envelope.source);
    return NextResponse.json(await finalizeLegacyEvaluationV2({
      authenticatedUserId: user.id,
      runtime,
      answers,
    }));
  } catch (error: unknown) {
    if (error instanceof LegacyEvaluationErrorV2) {
      return legacyEvaluationErrorResponse(error);
    }
    if (error instanceof SessionClinicalRuntimeErrorV2) {
      return runtimeErrorResponse(error);
    }
    if (error instanceof LegacyEvaluationFinalizationErrorV2) {
      return legacyFinalizationErrorResponse(error);
    }
    if (error instanceof SpfaEvaluationClaimErrorV2) {
      return spfaClaimErrorResponse(error);
    }
    if (error instanceof SpfaEvaluationFinalizationErrorV2) {
      return spfaFinalizationErrorResponse(error);
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    console.error(error);
    return genericEvaluationError();
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const sessionId = new URL(req.url).searchParams.get('sessionId');
    if (sessionId === null || sessionId.trim().length === 0) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    const status = await getOwnedSpfaEvaluationStatusV2({
      authenticatedUserId: user.id,
      sessionId,
    });
    return NextResponse.json(toStudentSpfaEvaluationDtoV2(status));
  } catch (error: unknown) {
    if (error instanceof GetOwnedSpfaEvaluationStatusErrorV2) {
      return readErrorResponse(error);
    }
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json(
      { error: 'Error consultando evaluación' },
      { status: 500 },
    );
  }
}
