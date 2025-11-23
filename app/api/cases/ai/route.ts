import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { requireUser } from '@/lib/auth';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Tipo de respuesta que queremos de la IA
type AICaseDraft = {
  title: string;
  summary: string;
  spec: {
    nombre: string;
    edad: number;
    sexo: 'F' | 'M';
    motivo_consulta: string;
    antecedentes: string;
    tratamiento: string;
    contexto: string;
  };
  ground_truth: {
    diagnostico_principal: string;
    problema_farmacoterapeutico: string;
    tipo_no_adherencia: string;
    barrera_principal: string;
    otras_barreras?: string[];
    intervenciones_recomendadas: string[];
    personalidad_paciente: string;
    objetivos_aprendizaje: string[];
  };
};

export async function POST(req: NextRequest) {
  // Solo profesores / admin
  const user = await requireUser();
  if (user.role !== 'teacher' && user.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    service_type = 'SAT',
    difficulty = 1,
    area = 'hipertensión arterial',
  } = body as {
    service_type?: string;
    difficulty?: number;
    area?: string;
  };

  const model = process.env.OPENAI_MODEL_CASES || 'gpt-4.1-mini';

  const systemPrompt = `
Eres una IA que ayuda a profesores de farmacia comunitaria en España a crear
CASOS CLÍNICOS para simulaciones de entrevista farmacéutica.

Contexto general:
- El caso se desarrolla en una farmacia comunitaria española.
- El idioma SIEMPRE es español de España.
- Todo el contenido es ficticio pero debe ser clínicamente verosímil.
- Los casos se usan en el marco de Servicios Profesionales Farmacéuticos Asistenciales (SPFA).

Servicio:
- Recibirás un parámetro "service_type".
- Si service_type = "SAT", el caso pertenece al Servicio de Adherencia Terapéutica.
  * El foco principal es la ADHERENCIA al tratamiento.
  * El problema docente central debe ser una falta de adherencia (intencional, no intencional o mixta).
- En el futuro podrán existir otros servicios, pero por ahora asume que el objetivo
  docente es siempre trabajar la adherencia a la medicación.

Práctica clínica y medicación:
- Usa diagnósticos y situaciones habituales en la práctica de farmacia comunitaria en España.
- Usa medicación REALISTA y habitual en España:
  * Principios activos conocidos (enalapril, metformina, salbutamol, simvastatina, etc.).
  * Dosis y frecuencias plausibles según guías clínicas.
  * Combinaciones terapéuticas coherentes con el diagnóstico y el perfil del paciente.
- Evita fármacos muy raros, obsoletos, o poco probables en atención primaria española.
- Asegúrate de que el contenido de "tratamiento" encaja con los antecedentes y el diagnóstico.

Clasificación de la falta de adherencia:
- tipo_no_adherencia:
  - "no intencional": olvidos, desorganización, dificultades prácticas, confusión.
  - "intencional": creencias, miedos, rechazo consciente, desconfianza, etc.
  - También puedes describir situaciones mixtas.
- barrera_principal (ejemplos):
  - "olvido"
  - "falta de comprensión del tratamiento"
  - "miedo a efectos adversos"
  - "creencias negativas sobre la medicación"
  - "falta de rutina / desorganización"
  - "problemas económicos"
  - "problemas para acceder a la farmacia"
  - etc.
- otras_barreras: lista opcional con barreras adicionales si procede.

Intervenciones farmacéuticas frente a la falta de adherencia:
- Educación sanitaria y explicación clara del tratamiento.
- Explicar el beneficio del medicamento y el riesgo de no tomarlo.
- Manejo y explicación de efectos adversos (tranquilizar, derivar si procede).
- Uso de recordatorios: pastilleros, alarmas en el móvil, apps, calendarios, etc.
- Propuestas de simplificación del régimen (cuando sea razonable, en coordinación con el médico).
- Acordar rutinas ligadas a actividades diarias (desayuno, cepillado de dientes, etc.).
- Trabajo de la relación de confianza con el paciente (escucha activa, empatía).

Personalidad del paciente:
- "personalidad_paciente" debe describir de forma breve cómo se comporta en la entrevista:
  - por ejemplo: "hablador y confiado", "tímido y escueto", "a la defensiva", "con prisa", etc.
- Esta descripción se utilizará para simular la actitud del paciente en el chat.

Nivel de dificultad (1–5):
- 1–2: caso sencillo, una barrera clara, contexto simple.
- 3: caso intermedio, puede haber más de una barrera o contexto algo complejo.
- 4–5: caso avanzado, varias barreras, contexto social/ clínico más retador.
`;

  const userPrompt = `
Genera un caso clínico para el servicio: "${service_type}".
Nivel de dificultad aproximado (1-5): ${difficulty}.
Área clínica principal: ${area}.

Devuelve EXCLUSIVAMENTE un JSON con esta estructura EXACTA:

{
  "title": string,
  "summary": string,
  "spec": {
    "nombre": string,
    "edad": number,
    "sexo": "F" | "M",
    "motivo_consulta": string,
    "antecedentes": string,
    "tratamiento": string,
    "contexto": string
  },
  "ground_truth": {
    "diagnostico_principal": string,
    "problema_farmacoterapeutico": string,
    "tipo_no_adherencia": string,
    "barrera_principal": string,
    "otras_barreras": string[],
    "intervenciones_recomendadas": string[],
    "personalidad_paciente": string,
    "objetivos_aprendizaje": string[]
  }
}

Condiciones adicionales:
- "tratamiento" debe ser coherente con el diagnóstico y los antecedentes,
  con fármacos, dosis y pautas plausibles en España.
- summary = 1–2 frases que describan el caso para el profesor.
- No añadas ningún texto fuera del JSON (sin comentarios ni explicaciones).
`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return NextResponse.json(
        { error: 'Respuesta vacía del modelo' },
        { status: 500 },
      );
    }

    const draft = JSON.parse(content) as AICaseDraft;

    return NextResponse.json(draft);
  } catch (err) {
    console.error('Error generando caso con IA', err);
    return NextResponse.json(
      { error: 'Error generando el caso con IA' },
      { status: 500 },
    );
  }
}
