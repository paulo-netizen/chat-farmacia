# 18 — Pharmaceutical Semantic Live Acceptance

## 1. Estado y alcance

M6-D3A congeló la primera matriz previa a la aceptación live de las lanes farmacéuticas D1 y D2. M6-D3R2 versiona únicamente la política de precisión de evidencia después del rechazo histórico de esa primera matriz. Ninguno de estos incrementos constituye aceptación del modelo ni ejecuta OpenAI. El modelo `gpt-5.6-sol` permanece **CANDIDATE — LIVE ACCEPTANCE PENDING** hasta M6-D3B.

Histórico inmutable:

- matriz: `pharmaceutical-d3-live-matrix/1`;
- fingerprint: `cc8d82fb2adcdbd72039053951997e3c54d4fe619c0b566dc936bd8cde4cf1da`;
- resultado: **REJECT**, en SMOKE run 1 por puntuación terminal fuera de la única opción exacta registrada.

Nueva candidata pendiente de ejecución live:

- matriz: `pharmaceutical-d3-live-matrix/2`;
- fingerprint: `d6fe321921abfff8073645e5db398f63b81d5c39abfc8dafc3d2397ea3c38a95`.

La definición machine-readable, sus fixtures, expectations, allowlists y fingerprint SHA-256 viven en `tests/live/support/pharmaceutical-d3-live-matrix.ts`. El fingerprint no incluye timestamps de ejecución ni datos ambientales.

## 2. Cambio material previo al live

El prompt D1 pasa a `pharmaceutical-d1-adjudication-prompt/3`. La versión nueva mantiene verdicts, autoridad, batching, modelo, frontera patient y prohibición de conocimiento externo, y aclara exclusivamente:

- el excerpt selecciona una cláusula literal clínicamente pertinente;
- puede conservar la puntuación terminal directamente unida a esa cláusula;
- debe excluir otras cláusulas y discurso adyacente irrelevante;
- no se exige mecánicamente el substring más corto si deja de expresar la evidencia;
- `evidenceKind` no es una clasificación clínica libre;
- solo se puede seleccionar un kind allowlisted por el candidate;
- no se inventan kinds;
- si hay varios kinds estructuralmente compatibles, se usa el que corresponde a la función observable de la evidencia.

Los kinds actuales son estructurales:

- `STUDENT_QUESTION`: exploración u obtención observable de información;
- `STUDENT_INTERPRETATION`: interpretación o conclusión observable;
- `STUDENT_DECISION`: decisión observable adoptada;
- `STUDENT_ACTION`: actuación observable realizada o propuesta.

La allowlist por target/candidate sigue siendo la autoridad. No se introduce una taxonomía clínica nueva.

## 3. Fixtures pre-registrados

| Fixture | Propósito | Repeticiones | Calls/run D1 + D2 | Total |
|---|---|---:|---:|---:|
| SMOKE | Preflight de un batch D1 y D2 vacío | 1 | 1 + 1 | 2 |
| C1 | Breadth de los cinco batches y aspectos actuales, equivalencia, adquisición, evidencia múltiple, cláusulas exactas e injection | 5 | 5 + 1 | 30 |
| C2 | Contradicción, incertidumbre, ausencia semántica y no duplicación D1/D2 | 5 | 4 + 1 | 25 |
| C3 | Speech acts y findings D2, cross-scope, alternativa, offsets e injection | 5 | 0 + 1 | 5 |
| S1 | Patient-only, razonamiento silencioso y acción observable | 5 | 2 + 0 | 10 |
| S2 | `REFERRAL_NEED=not_required` y oposición sin duplicación D2 | 5 | 1 + 1 | 10 |
| Z0 | Shells estructurales y finding set vacío | offline | 0 + 0 | 0 |

Presupuesto máximo derivado de la matriz: **82 calls**, desglosadas en **61 D1** y **21 D2**. No se mantiene un presupuesto paralelo independiente.

Orden congelado: offline hardening → SMOKE → C3 → C2 → C1 → S1 → S2 → evidence report.

## 4. Expectations y evidencia

Cada target D1 registra `targetRef`, aspect, verdict y `allowedEvidenceOptions` exactas (`messageRef`, `evidenceKind`, excerpt literal). Puede haber varias opciones materialmente equivalentes, incluidas variantes explícitas con o sin puntuación terminal cuando ambas son auditables. El provider pasa si devuelve al menos una opción permitida, todas las devueltas están permitidas y no hay duplicados. Otras cláusulas o discurso irrelevante adicional siguen fallando. El excerpt recibido se conserva literalmente: no hay trim transformativo, stripping de puntuación, case folding, normalización Unicode ni fuzzy matching.

La matriz distingue:

- `UNCERTAIN`: contenido student pertinente pero no resolutivo, con evidencia;
- `NOT_DEMONSTRATED` semántico: existen candidates student, pero ninguno es pertinente;
- shell estructural: `NO_STUDENT_CANDIDATES`, sin verdict semántico ni llamada.

Los mensajes patient son únicamente contexto de adquisición y nunca evidencia D1. Pregunta student + respuesta patient + interpretación student permite citar solo la interpretación final.

D2 registra el finding exacto, speech act, dominio, refs, excerpt y offsets UTF-16. Preguntas, hipótesis exploratorias, reconocimientos neutrales y strings técnicas no asumidas producen `[]`. Las oposiciones ya cubiertas por targets D1 —incluidos PRM, adherencia y referral— no se duplican en D2. Una alternativa no enumerada solo puede ser `UNSUPPORTED` por la autoridad suministrada, nunca `CONTRADICTORY` mediante conocimiento externo.

La traducción de un `conceptId` opaco a una etiqueta humana ausente es **NEEDS_TEACHER_DECISION**. D3 no inventa labels y solo prueba igualdad con el identificador canónico cuando esa es toda la autoridad disponible.

## 5. Decisión y fail-fast

Decisiones finales:

- `ACCEPT`: SMOKE y las cinco repeticiones de C1/C2/C3/S1/S2 cumplen el 100% de expectations y boundaries;
- `REJECT`: existe una respuesta evaluable de `gpt-5.6-sol` que incumple una expectation semántica o boundary;
- `INCONCLUSIVE`: fallo técnico externo antes de una respuesta evaluable, modelo observado distinto o fixture demostrado ambiguo.

No hay majority vote ni umbral secundario: se exige 5/5. El runner se detiene en el primer desajuste, finding inesperado/ausente, evidencia fuera de allowlist, patient evidence, ref/offset inválido, injection obedecida, error de schema, modelo distinto, call inesperada o fallo técnico. No reintenta, no aplica fallback y no continúa silenciosamente.

## 6. Activación y aislamiento

El test `tests/live/pharmaceutical-d1-d2-semantic-live.test.ts` está skip-by-default y solo se activa con:

```text
RUN_PHARMACEUTICAL_D3_LIVE=1
```

La API key y los runtimes OpenAI se importan/leen únicamente dentro del test ya activado. La suite normal no necesita credenciales ni puede realizar red desde este harness.

Para procesos Vitest independientes en M6-D3B:

```text
PHARMACEUTICAL_D3_FIXTURE=SMOKE|C1|C2|C3|S1|S2
PHARMACEUTICAL_D3_RUN=1..5
```

`PHARMACEUTICAL_D3_RUN` exige un fixture explícito. Estos selectores eligen únicamente una parte de la matriz congelada; no pueden cambiar expectations, repeticiones, modelo ni criterios. Cada invocación crea runtimes nuevos y no cachea respuestas.

## 7. Resumen y evidencia futura

Los summaries por run contienen exclusivamente fixture/run, lane, request fingerprints, `responseModel`, verdicts, refs/kinds, hashes SHA-256 de excerpts, claim IDs/findings, calls, duración y decisión. Excluyen prompts, responses raw, credenciales, transcript completo, contexto clínico y razonamiento oculto.

M6-D3B generará desde esos summaries un artefacto del tipo:

```text
docs/v2/validation/m6-d3-live-acceptance-YYYYMMDD.md
```

El builder determinista ya registra commit, matrix version/fingerprint, prompt/policy/batch/request versions, modelo solicitado/observado, fixture/run, calls y decisión. D3A no crea ningún artefacto que afirme PASS live.

## 8. Invalidación

Invalidan la aceptación: matriz/fixtures/expectations, prompts D1/D2, policy D2, schema Structured Outputs, batch plan, contratos context/target/request, canonicalización/fingerprints, selección/validación de evidencia, semántica de no duplicación D1/D2, modelo y cambios materiales de transport/runtime.

No invalidan por sí solos: erratas documentales, logging allowlisted no material y formato.

## 9. Estado

- M6-D3A: **CLOSED / COMPLETE**.
- M6-D3R2: **CLOSED / COMPLETE**.
- M6-D3B: **READY FOR NEW LIVE ATTEMPT FROM SMOKE**.
- M6-D3: **PARTIAL**.
- M6-D: **PARTIAL**.

No se ha ejecutado OpenAI en D3R2 y no se ha cerrado M6-D. La matriz `/1` conserva su rechazo histórico; la `/2` permanece pendiente de aceptación live completa desde SMOKE.
