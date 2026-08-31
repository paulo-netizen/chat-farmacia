# 18 — Pharmaceutical Semantic Live Acceptance

## 1. Estado y alcance

M6-D3A congeló la primera matriz previa a la aceptación live de las lanes farmacéuticas D1 y D2. M6-D3R2 versionó la política de precisión de evidencia D1 después del rechazo histórico de esa primera matriz. Las ejecuciones de las matrices `/2` y `/3` quedaron `INCONCLUSIVE` por salidas provider D2 cuyos excerpts no coincidían literalmente con los offsets declarados bajo un contrato y validator correctos. M6-D3R6 eliminó esa sobrecarga técnica del provider: D2 selecciona excerpt literal + ocurrencia y el servidor resuelve los offsets UTF-16. La matriz `/4` quedó `REJECT` porque su expectation C3 omitía una recomendación `UNSUPPORTED` válida. M6-D3R8 incorporó esa expectation en `/5`, cuyo intento quedó `REJECT` porque exigía una única canonicalización de span/refs donde el contrato permite varias representaciones exactas. M6-D3R10 crea `/6` con alternativas completas, exactas y preregistradas. El intento `/6` quedó **REJECT** por omisión obligatoria de C3 ref 7, una `ASSERTION` `ADHERENCE / CONTRADICTORY`: `MODEL_SEMANTIC_FAILURE` bajo una matriz correcta. Sol queda **REJECTED_FOR_M6_D3_MATRIX_6** y **NOT_GLOBALLY_DISALLOWED**. M6-D3R14 autoriza experimentalmente Terra mediante una policy explícita y prepara `/7`, sin modificar semántica ni reevaluar históricos. El intento `/7` con Terra también quedó **REJECT** por omisión C3 ref 7. D3R15 concluyó **D2 CONTEXT SALIENCE GAP**, autoridad **SUFFICIENT_BUT_INDIRECT**. Ambos rechazos permanecen históricos. D3R16 prepara `/8` para aislar el efecto de representar explícitamente relaciones ya existentes; no demuestra aún que el fallo esté resuelto. No se repite `/6` para buscar PASS.

Histórico inmutable `/1`:

- matriz: `pharmaceutical-d3-live-matrix/1`;
- fingerprint: `cc8d82fb2adcdbd72039053951997e3c54d4fe619c0b566dc936bd8cde4cf1da`;
- resultado: **REJECT**, en SMOKE run 1 por puntuación terminal fuera de la única opción exacta registrada.

Histórico inmutable `/2`:

- matriz: `pharmaceutical-d3-live-matrix/2`;
- fingerprint: `d6fe321921abfff8073645e5db398f63b81d5c39abfc8dafc3d2397ea3c38a95`;
- resultado: **INCONCLUSIVE**, en C3 run 1 por `INVALID_PROVIDER_RESULT` en `providerResult.findings[1].excerpt`; los cuatro spans esperados del fixture eran correctos offline y el validator rechazó correctamente la desigualdad literal entre `slice(start,end)` y `excerpt`.

Histórico inmutable `/3`:

- matriz: `pharmaceutical-d3-live-matrix/3`;
- fingerprint: `64c55ed55be855933904c875cdbd3e7c3464c8aab5c6c9049e86b161b185950e`;
- resultado: **INCONCLUSIVE**, en C3 run 1 por `INVALID_PROVIDER_RESULT` en `providerResult.findings[4].excerpt`; el provider volvió a producir un excerpt incompatible con su propio span aunque el validator y las expectativas clínicas permanecían correctos.

Histórico inmutable `/4`:

- matriz: `pharmaceutical-d3-live-matrix/4`;
- fingerprint: `700e3f64fecdba431fe3da72accc65a10cfaf9d17bdad3d257519814ef6a3608`;
- resultado: **REJECT**, en C3 run 1 por `EXPECTATION_MISMATCH` en `d2.findings`: el provider devolvió correctamente las refs 7, 8, 9 y 11 pre-registradas más la ref 2 como `UNSUPPORTED`, que la expectation histórica había omitido.

Histórico inmutable `/5`:

- matriz: `pharmaceutical-d3-live-matrix/5`;
- fingerprint: `2867bf53d721a77638a813d8d6efe3cadd58c88a3bf0908ec3733d5488ba8c72`;
- resultado: **REJECT**, en C3 run 1 por `EXPECTATION_MISMATCH` en `d2.findings`: los cinco findings y sus clasificaciones semánticas eran correctos, pero refs 2/7 y span/refs 8 usaron canonicalizaciones exactas permitidas que no estaban preregistradas como alternativas.

Histórico inmutable `/6`:

- matriz: `pharmaceutical-d3-live-matrix/6`;
- fingerprint: `1b3f458a20c1c6bafe2e6fe122761de3ef365fc5add1fee488c4eea2f4005c8f`;
- prompt D1: `pharmaceutical-d1-adjudication-prompt/3`;
- prompt D2: `pharmaceutical-d2-claim-prompt/3`;
- provider result D2: `pharmaceutical-d2-provider-result/2`;
- modelo: `gpt-5.6-sol`;
- resultado: **REJECT**, C3 run 1 por omisión obligatoria de ref 7; no justifica cambiar expectation, prompt ni context.

Histórico inmutable `/7`:

- matriz: `pharmaceutical-d3-live-matrix/7`;
- fingerprint: `9194a30c2b7574e000d87571166d4d42384200b908654e7e048fc180188cfab9`;
- modelo D1 y D2: `gpt-5.6-terra`;
- resultado: **REJECT**, C3 run 1 por omisión mandatory ref 7; se conserva request D2 `/1` y el fingerprint original.

### Governance farmacéutica /1

`pharmaceutical-semantic-model-policy/1` permite exactamente `gpt-5.6-sol` y `gpt-5.6-terra`. Es server-owned, de tipo cerrado y fail-closed: no admite aliases, strings arbitrarios, trim, normalización ni sustituciones. Los runtimes mantienen Sol como default histórico; Terra nunca se activa silenciosamente. Ambos executors envían el modelo validado y preservan `response.model` observado, sin fallback ni retries.

La aceptación de `/8` exige selección explícita D1 = D2 = candidato de la matriz antes de crear runtimes o llamar al proveedor. Todas las respuestas evaluables deben identificar exactamente `gpt-5.6-terra`. Configuraciones mixtas o ausentes fallan antes de OpenAI. El wrapper toma un snapshot de entorno después de la activación opt-in.

La matriz `/7` reutiliza los mismos fixtures, contexts, expectations y alternativas de `/6`; conserva prompts D1/D2 `/3`, provider D2 `/2`, policy D2 `/1` y expectation D2 `/2`. Solo cambia funcionalmente el candidato. La versión de governance se registra separadamente como metadata experimental, sin alterar los requests semánticos. El fingerprint de matriz cambia por matrix identity/model; los fingerprints D1/D2, context, targets y transcript no cambian. Tampoco cambia el claimId para un mismo finding canónico.

Los fingerprints `/1`–`/7` y sus materiales congelados permanecen intactos; los resultados históricos `/6` y `/7` se registran fuera de su material de fingerprint. No se sustituye la constante Sol compartida por las matrices históricas. La autorización técnica de un candidato no equivale a aceptación clínica.

El prompt D2 `/3` exige copiar el excerpt literalmente del mensaje student completo y seleccionar su `occurrenceIndex` zero-based entre coincidencias exactas enumeradas de izquierda a derecha. El provider no calcula ni devuelve offsets. El servidor localiza todas las ocurrencias literales —incluidos solapamientos—, valida la selección, deriva índices JavaScript UTF-16 `[start,end)` y comprueba la igualdad exacta con `slice`. No hay normalización, trim transformativo, case folding, fuzzy matching ni reparación silenciosa. La forma canónica final y el algoritmo de `claimId` conservan los offsets ya resueltos.

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

D2 registra el finding exacto, speech act, dominio, refs, excerpt y offsets UTF-16 server-owned. El provider solo aporta el excerpt literal y su ocurrencia exacta; el finding canónico conserva `excerptStart`/`excerptEnd`. Preguntas, hipótesis exploratorias, reconocimientos neutrales y strings técnicas no asumidas producen `[]`. Las oposiciones ya cubiertas por targets D1 —incluidos PRM, adherencia y referral— no se duplican en D2. Una alternativa no enumerada solo puede ser `UNSUPPORTED` por la autoridad suministrada, nunca `CONTRADICTORY` mediante conocimiento externo.

La expectation D2 `/2` fija por finding `messageRef`, `domain`, `findingType` y `claimForm`, y preregistra una allowlist de alternativas canónicas completas para `excerpt`, `excerptStart`, `excerptEnd` y el array ordenado de `relatedClinicalRefs`. El resultado debe contener exactamente el mismo número de findings y cada finding debe coincidir íntegramente con una alternativa. No hay subset matching, productos cartesianos, normalización, contains ni fuzzy matching. Una ref meramente allowlisted no basta si el conjunto completo no fue preregistrado.

En C3, `Debe suspenderlo.` (ref 2) es una `RECOMMENDATION` de `PROFESSIONAL_RESPONSE`: los targets D1 de acción/intervención son próximos, pero ninguno representa completamente la proposición de suspensión. Su cobertura D1 es por tanto parcial, no completa, y D2 conserva el finding `UNSUPPORTED` con excerpt literal, ocurrencia cero, offsets canónicos y sin inventar referencias clínicas. En contraste, `Hay que derivarlo.` (ref 4) y `Concluyo que no lo toma porque se le olvida.` (ref 6) quedan completamente representados por targets D1 y no generan finding D2; la intervención alternativa no enumerada de ref 9 permanece `UNSUPPORTED`.

La traducción de un `conceptId` opaco a una etiqueta humana ausente es **NEEDS_TEACHER_DECISION**. D3 no inventa labels y solo prueba igualdad con el identificador canónico cuando esa es toda la autoridad disponible.

## 5. Decisión y fail-fast

Decisiones finales:

- `ACCEPT`: SMOKE y las cinco repeticiones de C1/C2/C3/S1/S2 cumplen el 100% de expectations y boundaries;
- `REJECT`: existe una respuesta evaluable del candidato exacto registrado en la matriz que incumple una expectation semántica o boundary;
- `INCONCLUSIVE`: fallo técnico externo antes de una respuesta evaluable, modelo observado distinto o fixture demostrado ambiguo.

No hay majority vote ni umbral secundario: se exige 5/5. El runner se detiene en el primer desajuste, finding inesperado/ausente, evidencia fuera de allowlist, patient evidence, ref/offset inválido, injection obedecida, error de schema, modelo distinto, call inesperada o fallo técnico. No reintenta, no aplica fallback y no continúa silenciosamente.

## 6. Activación y aislamiento

El test `tests/live/pharmaceutical-d1-d2-semantic-live.test.ts` está skip-by-default y solo se activa con:

```text
RUN_PHARMACEUTICAL_D3_LIVE=1
OPENAI_PHARMACEUTICAL_D1_MODEL=gpt-5.6-terra
OPENAI_PHARMACEUTICAL_D2_MODEL=gpt-5.6-terra
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

Cuando falla la resolución D2 `/2`, la metadata de diagnóstico se limita a conteos/índices, longitud del excerpt, número de coincidencias, validez de bounds, etapa y versiones contractuales. No incluye excerpt, slice o mensaje raw, respuesta provider, contexto clínico ni hashes de esos contenidos.

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
- M6-D3R4: **CLOSED / COMPLETE**.
- M6-D3R6: **CLOSED / COMPLETE**.
- M6-D3R8: **CLOSED / COMPLETE**.
- M6-D3R10: **CLOSED / COMPLETE**.
- M6-D3R14: **CLOSED / COMPLETE**.
- M6-D3R16: **CLOSED / COMPLETE**.
- M6-D3B: **NOT CLOSED — READY FOR RELATIONAL-PROJECTION LIVE ACCEPTANCE**.
- M6-D3: **PARTIAL**.
- M6-D: **PARTIAL**.

No se ejecuta OpenAI en D3R16 y no se cierra M6-D. `/1`, `/4`, `/5`, `/6` y `/7` conservan `REJECT`; `/2` y `/3`, `INCONCLUSIVE`; `/8` queda `PENDING LIVE ACCEPTANCE`. M6 sigue en 46% y el proyecto en 49.37%. No se afirma que Terra sea mejor ni que la proyección haya superado aceptación live.

## 10. Validación offline M6-D3R14

- Model policy: **22/22 PASS**.
- Runtime D1: **61/61 PASS**; regresiones D1 completas: **142/142 PASS**.
- Runtime D2: **70/70 PASS**; regresiones D2 completas: **160/160 PASS**.
- D3 harness: **76/76 PASS**. Incluye fingerprints históricos, invariancia /6–/7, preflight de modelos y recorrido completo con providers mockeados; no es aceptación live.
- Suite normal: **2747 PASS / 25 SKIPPED** (79 pruebas nuevas).
- TypeScript `--noEmit --incremental false`: **PASS**.
- `git diff --check`: **PASS**.

La validación offline de D3R14 no realizó llamadas reales; los tests live y PostgreSQL quedaron skipped. El resultado posterior `/7 = REJECT` se registra arriba, sin reinterpretar esta validación histórica.

## 11. M6-D3R16 — D2 relational authority projection

Request nuevo: `pharmaceutical-d2-semantic-request/2`; el builder histórico y los ejecutores históricos de matrices conservan explícitamente `/1`. El orquestador solo selecciona `/2` mediante versión server-owned explícita. No cambian modelos, defaults, retries/fallback ni parámetros del executor.

`authorityProjection.relationships` contiene únicamente:

```ts
readonly {
  barrierRef: ConclusionId;
  barrierAssessmentRef: ConclusionId;
  adherenceAssessmentRef: ConclusionId;
  medicationRefs: readonly MedicationId[];
}[]
```

Procedencia: M6-C reconstruye y valida la referencia clínica antes de entregar el contexto server-owned. D2 materializa los enlaces positivos ya resueltos en sus packets BARRIER; no busca significado en mensajes, no infiere negaciones ni causalidad. Los IDs conservan su procedencia y los medicamentos deben resolver a identidades canónicas del packet. La proyección no es una frontera para aceptar un contexto arbitrario del cliente: no sustituye al validator de M6-C. El hash de contexto comprueba integridad, no autenticidad.

Canonicalización: medicamento único ordenado ordinalmente; una relación por barrierRef; relaciones ordenadas ordinalmente por barrierRef. Las vistas repetidas equivalentes se deduplican; links/scopes/status/roles incompatibles se rechazan. Referencias malformadas, roles incompatibles, medicamentos sin identidad y links incompletos fallan sin descarte silencioso. La validación del request reconstruye toda la proyección y rechaza relaciones inexistentes, extras o fingerprints manipulados. Sin barreras canónicas: array vacío, sin relación inventada.

Fingerprint SHA-256: canonicalization `pharmaceutical-d2-semantic-request-v2/2`, serialización JSON ordenada de `[contractVersion, contextFingerprint, policyVersion, promptVersion, studentMessages, authorityProjection]`. Las claves de cada relación siguen el orden mostrado arriba. No se reordena ni reescribe material previo del request `/1`. Reordenar fuentes equivalentes antes del builder canónico de M6-C conserva el request/fingerprint; una permutación arbitraria de un contexto ya emitido sigue su contrato de integridad previo, no se corrige silenciosamente.

C3 conserva `barrier …000009 → barrierAssessment …000008 → adherenceAssessment …000006 → medicationRefs [med_…000003]`. El assessment `…000015` mantiene `med_…000001` en la autoridad previa. No se genera “no pertenece a A”. Los contrafactuales offline reconstruyen también la variante canónica con scope A y la ausencia de barrera: representan la autoridad, no una respuesta esperada del modelo.

- C3 request `/1`: `10e0c1a64e29dc52327df2b2ec831260843dfbc22d7f55e347442cb67ac3c3c1`.
- C3 request `/2`: `3e57da398d6dafcebdedc10ab1976f6397aeef5b4bb611420dd00ca304f366e5`.
- Matrix: `pharmaceutical-d3-live-matrix/8`.
- Fingerprint: `18d8de2f85bbe40b9bd9389f87ebeb4d95a1b4861385fd62635ea32dc850e486`.
- Candidate: `gpt-5.6-terra`, **PENDING LIVE ACCEPTANCE**.

Comparación /7→/8: se comparte el mismo material congelado de fixtures, transcript/context/targets, expectativas (incluida C3 ref 7), prompts D1/D2 `/3`, provider D2 `/2`, policy D2 `/1`, expectation `/2` y governance `/1`. Solo cambian identidad/fingerprint de matriz y versión/material del request D2. Permanecen gate 100%, SMOKE 1, C1/C2/C3/S1/S2 5, Z0 offline, stop-early, 82 llamadas máximas (61 D1 + 21 D2) y parámetros de ejecución. Los findings canónicos, offsets y claimId para el mismo finding/context siguen idénticos; la metadata de ejecución/finding set registra el nuevo requestFingerprint. No se añade heurística semántica ni se cambia el schema/validator de respuesta.

Validación final offline:

- Relaciones/request `/2`: **39/39 PASS** nuevos.
- D2 anteriores: **160/160 PASS** (request/claims 58, runtime 70, orquestación 32); incluyendo relaciones: **199/199 PASS**.
- D1: **142/142 PASS**, sin modificaciones.
- D3 harness: **83/83 PASS** (6 pruebas nuevas; gate completo simulado y comparación /7→/8).
- Suite completa: **2793 PASS / 25 SKIPPED**; 45 pruebas nuevas respecto al HEAD (2748 PASS). El registro offline anterior de 2747 precedía al test Sol→Terra añadido en el cierre R14.
- TypeScript `--noEmit --incremental false`: **PASS**.
- `git diff --check`: **PASS**.

Ninguna nueva llamada OpenAI/live en este incremento. La próxima ejecución requiere autorización independiente y debe empezar desde SMOKE. R16 queda cerrado exclusivamente como preparación estructural offline; D3B no está cerrado y no se afirma que el problema semántico esté resuelto.
