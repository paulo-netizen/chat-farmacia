# 18 — Pharmaceutical Semantic Live Acceptance

## 1. Estado y alcance

M6-D3A congeló la primera matriz previa a la aceptación live de las lanes farmacéuticas D1 y D2. M6-D3R2 versionó la precisión de evidencia D1; `/2` y `/3` quedaron `INCONCLUSIVE`. M6-D3R6 movió la resolución UTF-16 al servidor; `/4` quedó `REJECT`. Las matrices `/5`–`/10` también conservan sus resultados históricos `REJECT`. En `/10`, C3 ref 7 llegó con semántica y literalidad correctas y una provenance segura, pero expectation `/2` no podía representar ese producto: **RELATED_CLINICAL_REFS ACCEPTANCE CONTRACT OVERCONSTRAINED**. D3R23 cerró la auditoría como `A. SUFFICIENT`. D3R24 conserva `/1`–`/10` y crea `/11`, pendiente de live, con expectation `/3`: identidad semántica exacta, `ONE_OF` literal exacto y provenance required/optional/forbidden. No se reclasifica ningún histórico.

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

Histórico inmutable `/8`:

- matriz: `pharmaceutical-d3-live-matrix/8`;
- fingerprint: `18d8de2f85bbe40b9bd9389f87ebeb4d95a1b4861385fd62635ea32dc850e486`;
- modelo D1 y D2: `gpt-5.6-terra`;
- request D2 `/2`, canonicalization `pharmaceutical-d2-semantic-request-v2/2`, prompt D2 `/3`;
- C3 request fingerprint: `3e57da398d6dafcebdedc10ab1976f6397aeef5b4bb611420dd00ca304f366e5`;
- resultado: **REJECT**, omisión mandatory C3 ref 7 pese a la proyección relacional explícita. El resultado se registra fuera del material congelado; no se reconstruye `/8` con prompt `/4`.

### Governance farmacéutica /1

`pharmaceutical-semantic-model-policy/1` permite exactamente `gpt-5.6-sol` y `gpt-5.6-terra`. Es server-owned, de tipo cerrado y fail-closed: no admite aliases, strings arbitrarios, trim, normalización ni sustituciones. Los runtimes mantienen Sol como default histórico; Terra nunca se activa silenciosamente. Ambos executors envían el modelo validado y preservan `response.model` observado, sin fallback ni retries.

La aceptación pendiente de `/11` exige selección explícita D1 = D2 = candidato de la matriz antes de crear runtimes o llamar al proveedor. Todas las respuestas evaluables deben identificar exactamente `gpt-5.6-terra`. Configuraciones mixtas o ausentes fallan antes de OpenAI. El wrapper toma un snapshot de entorno después de la activación opt-in.

La matriz `/7` reutiliza los mismos fixtures, contexts, expectations y alternativas de `/6`; conserva prompts D1/D2 `/3`, provider D2 `/2`, policy D2 `/1` y expectation D2 `/2`. Solo cambia funcionalmente el candidato. La versión de governance se registra separadamente como metadata experimental, sin alterar los requests semánticos. El fingerprint de matriz cambia por matrix identity/model; los fingerprints D1/D2, context, targets y transcript no cambian. Tampoco cambia el claimId para un mismo finding canónico.

Los fingerprints `/1`–`/8` y sus materiales congelados permanecen intactos; los resultados históricos `/6`, `/7` y `/8` se registran fuera de su material de fingerprint. No se sustituye la constante Sol compartida por las matrices históricas. La autorización técnica de un candidato no equivale a aceptación clínica.

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
- M6-D3R18: **CLOSED / COMPLETE**, exclusivamente offline.
- M6-D3R20: **CLOSED / COMPLETE**, exclusivamente offline.
- M6-D3B: **NOT CLOSED — READY FOR MATRIX-10 LIVE ACCEPTANCE FROM SMOKE**.
- M6-D3: **PARTIAL**.
- M6-D: **PARTIAL**.

No se ejecuta OpenAI en D3R20 y no se cierra M6-D. `/1`, `/4`, `/5`, `/6`, `/7`, `/8` y `/9` conservan `REJECT`; `/2` y `/3`, `INCONCLUSIVE`; `/10` queda `PENDING LIVE ACCEPTANCE`. M6 sigue en 46% y el proyecto en 49.37%. No se afirma que Terra sea mejor ni que la tercera alternativa haya superado aceptación live.

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
- Candidate histórico `/8`: `gpt-5.6-terra`; el registro inicial fue **PENDING LIVE ACCEPTANCE**, con resultado posterior **REJECT** documentado en §1.

Comparación /7→/8: se comparte el mismo material congelado de fixtures, transcript/context/targets, expectativas (incluida C3 ref 7), prompts D1/D2 `/3`, provider D2 `/2`, policy D2 `/1`, expectation `/2` y governance `/1`. Solo cambian identidad/fingerprint de matriz y versión/material del request D2. Permanecen gate 100%, SMOKE 1, C1/C2/C3/S1/S2 5, Z0 offline, stop-early, 82 llamadas máximas (61 D1 + 21 D2) y parámetros de ejecución. Los findings canónicos, offsets y claimId para el mismo finding/context siguen idénticos; la metadata de ejecución/finding set registra el nuevo requestFingerprint. No se añade heurística semántica ni se cambia el schema/validator de respuesta.

Validación final offline:

- Relaciones/request `/2`: **39/39 PASS** nuevos.
- D2 anteriores: **160/160 PASS** (request/claims 58, runtime 70, orquestación 32); incluyendo relaciones: **199/199 PASS**.
- D1: **142/142 PASS**, sin modificaciones.
- D3 harness: **83/83 PASS** (6 pruebas nuevas; gate completo simulado y comparación /7→/8).
- Suite completa: **2793 PASS / 25 SKIPPED**; 45 pruebas nuevas respecto al HEAD (2748 PASS). El registro offline anterior de 2747 precedía al test Sol→Terra añadido en el cierre R14.
- TypeScript `--noEmit --incremental false`: **PASS**.
- `git diff --check`: **PASS**.

Ninguna nueva llamada OpenAI/live durante el incremento offline R16. R16 quedó cerrado exclusivamente como preparación estructural; el rechazo posterior de `/8` no modifica esta validación histórica. D3B no está cerrado y no se afirma que el problema semántico esté resuelto.

## 12. M6-D3R18 — propositional non-duplication clarification

La única variable semántica experimental respecto de `/8` es `pharmaceutical-d2-claim-prompt/3` → `pharmaceutical-d2-claim-prompt/4`. `/4` conserva íntegramente `/3` y añade únicamente reglas normativas generales en FRONTERA D1/D2, sin ejemplos ni identificadores del fixture:

- La cobertura completa exige la misma proposición: sujeto, relación, objeto/ámbito y polaridad/valor cuando aplique, incluida la oposición a lo esperado por D1.
- Componentes presentes por separado no equivalen a una relación completamente cubierta.
- Dos entidades canónicas válidas pueden estar incorrectamente asociadas. Si la relación contradice authorityProjection y ningún target D1 cubre esa misma proposición, D2 clasifica `CONTRADICTORY`, no `UNSUPPORTED`.
- Si esa misma proposición incorrecta está completamente representada como oposición a un target D1, D2 no la duplica.
- `UNSUPPORTED` conserva su significado: proposición elegible no sustentada ni contradictoria con la autoridad suministrada. Una relación correcta sustentada no produce finding. No se añade conocimiento clínico externo.

Identidades nuevas, calculadas del material canónico:

- Request: `pharmaceutical-d2-semantic-request/2` (sin request `/3`).
- Canonicalization: `pharmaceutical-d2-semantic-request-v2/2` (sin cambios).
- C3 request con prompt `/4`: `ca1e4bfbbc099a1a15e89f0c3684b4f4335a4ce6fce3c31911c758575724dd5e`.
- Matrix: `pharmaceutical-d3-live-matrix/9`.
- Canonicalization de matrix: `pharmaceutical-d3-live-matrix-v9/1`.
- Fingerprint: `56e31f12ae545bf6e3b814731faa70be5b3f304a20397ad5a61513c49633844c`.
- Candidate: `gpt-5.6-terra`, **PENDING LIVE ACCEPTANCE**; governance `/1` intacta.

El request de C3 difiere del histórico `/8` exclusivamente en promptVersion y SHA derivado. `authorityProjection.relationships`, targets, mensajes, context/transcript fingerprints y policy `/1` permanecen idénticos. Los builders históricos conservan prompt `/3` por defecto; `/9` selecciona `/4` explícitamente. El transport acepta las dos versiones explícitas sin fallback y conserva schema/provider `/2`, modelos y parámetros.

Matrix `/9` comparte exactamente los fixtures congelados de `/8`. Incluye los fingerprints D2 derivados por fixture dentro del material de fingerprint, sin datos ambientales. La comparación estructural excluye solo identidad/fingerprint de matriz, promptVersion y estos hashes derivados: todo el resto debe coincidir. Permanecen C3 refs 2/7/8/9/11, las alternativas canónicas, expectation `/2`, D1 completo, provider/output validator, span resolver, claimId, comparator, policy, autoridad y proyección relacional. Se mantienen SMOKE 1, C1/C2/C3/S1/S2 5, Z0 offline, orden, gate 100%, stop-early, 82 llamadas máximas (61 D1 + 21 D2), tokens, timeouts y sampling.

Los tests A–E documentan componentes separados, proposición completamente cubierta, asociación contradictoria, causalidad nueva no sustentada y relación correcta mediante contratos y salidas controladas. Los contrafactuales de prueba no cambian el fixture live. Se compara también el recorrido completo mockeado `/8`–`/9`, incluida la identidad de requests D1 y findings canónicos/claimId. Esta cobertura offline no demuestra comportamiento real del LLM ni aceptación clínica. La siguiente ejecución requiere autorización independiente desde SMOKE; no se repite ningún histórico buscando PASS.

Validación final offline de R18:

- Prompt `/4`: **8/8 PASS** nuevas (seis reglas normativas, preservación íntegra de `/3` y selección explícita sin cambio de schema).
- Relaciones/request y casos A–E: **48/48 PASS** (9 nuevas).
- Runtime/transport D2: **78/78 PASS**; claims **58/58**, orquestación **32/32**; D2 total **216/216 PASS**.
- D3 harness: **91/91 PASS** (8 nuevas: invariancia experimental e histórica, hashes, presupuesto, recorrido mockeado, stop-early y selección de modelo).
- D1 regresiones: **142/142 PASS**, sin modificaciones.
- Suite completa: **2818 PASS / 25 SKIPPED**; 25 pruebas nuevas respecto a 2793 PASS. Los live y PostgreSQL permanecen skipped.
- TypeScript `--noEmit --incremental false`: **PASS**.
- `git diff --check`: **PASS**.

M6-D3R18 — **CLOSED / COMPLETE**. M6-D3B — **NOT CLOSED — READY FOR PROMPT-V4 LIVE ACCEPTANCE FROM SMOKE**. Matrix `/9` sigue **PENDING LIVE ACCEPTANCE**; la aceptación real requiere autorización independiente. Cero OpenAI/live en este incremento, sin staging, commit ni push. Progreso sin cambios: M6 46% / proyecto 49.37%.

## 13. M6-D3R20 — tercera alternativa canónica exacta para C3 ref 7

La ejecución live de `/9` queda históricamente **REJECT**. C3 ref 7 apareció con identidad semántica, excerpt literal y span correctos, pero con una combinación canónica completa no preregistrada: barrera `conclusion_…000009`, medicamento atribuido `med_…000001` y medicamento del ámbito real de esa barrera `med_…000003`. D3R19 clasificó el fallo como `RELATED_CLINICAL_REFS_ALTERNATIVE_GAP`; no se reinterpreta el resultado ni se relaja el gate.

Matrix `/10` conserva expectation contract `pharmaceutical-d3-d2-expectation/2` y añade a ref 7 una tercera alternativa completa, exacta e indivisible:

- excerpt: `La barrera FORGETFULNESS corresponde al Medicamento A.`;
- span UTF-16: `[0,54)`;
- refs exactas: conclusión de barrera `…000009`, medicamento atribuido `…000001` y ámbito canónico real `…000003`;
- identidad semántica: `ADHERENCE / CONTRADICTORY / ASSERTION`, sin cambios;
- claimId esperado: `pharm_claim_aa0b7f32a23b3096848b18e94fa02af396a038d91957a6a375af2f7c011bbc3f`.

La conclusión de adherencia `…000015` no es necesaria para esta alternativa: la proposición está soportada estructuralmente por el sujeto barrera, el medicamento atribuido por el alumno y el medicamento del ámbito canónico real de esa barrera. Esto no autoriza subconjuntos, superconjuntos ni recombinaciones. La comparación sigue siendo igualdad exacta contra una de tres alternativas preregistradas; no hay subset matching, normalización, fuzzy matching, mayoría ni transformación server-side.

Identidades congeladas:

- Matrix: `pharmaceutical-d3-live-matrix/10`.
- Canonicalization: `pharmaceutical-d3-live-matrix-v10/1`.
- Fingerprint: `e435d6c6443a0ba4ce21b091d83d1bdab0e3d0bc38d3c7710d2fdb0ba04dda7c`.
- Candidate: `gpt-5.6-terra`, **PENDING LIVE ACCEPTANCE**.
- Prompt D1 `/3`; prompt D2 `/4`; request D2 `/2`; provider `/2`; policy `/1`; expectation `/2`; governance `/1`, todos intactos.
- C3 request fingerprint: `ca1e4bfbbc099a1a15e89f0c3684b4f4335a4ce6fce3c31911c758575724dd5e`, intacto.

La comparación estructural `/9`→`/10` demuestra que solo cambian identidad/fingerprint de matrix y la tercera alternativa exacta de C3 ref 7. Permanecen fixtures, mensajes, expectations clínicas, D1/D2, relaciones, request fingerprints, repeticiones, orden, gate 100%, stop-early, candidato, parámetros y presupuesto máximo de 82 llamadas (61 D1 + 21 D2). Los históricos permanecen: `/1`, `/4`, `/5`, `/6`, `/7`, `/8` y `/9` `REJECT`; `/2` y `/3` `INCONCLUSIVE`.

Validación offline de R20:

- tres alternativas exactas de C3 ref 7: **3/3 PASS**;
- claimId y justificación estructural de la tercera alternativa: **PASS**;
- subconjuntos, superconjuntos y combinaciones no registradas: **4/4 REJECT**;
- invariancia estricta `/9`→`/10`: **PASS**;
- D3 harness: **100/100 PASS**;
- D2 regresiones: **216/216 PASS**;
- D1 regresiones: **142/142 PASS**;
- suite completa: **2827 PASS / 25 SKIPPED**;
- TypeScript `--noEmit --incremental false`: **PASS**.

M6-D3R20 — **CLOSED / COMPLETE**. Su matrix `/10` permanece históricamente **REJECT** y no se reevalúa ni reclasifica.

## 14. M6-D3R24 — expectation `/3` y comparator fail-closed

M6-D3R23 concluyó `A. SUFFICIENT`: todos los findings actuales son productos seguros y no existe coupling literal/provenance. El contrato `pharmaceutical-d3-d2-expectation/3` separa tres dimensiones auditables:

- `semanticClassification`: `messageRef`, `domain`, `findingType` y `claimForm` exactos;
- `literalAlternatives`: al menos un tuple exacto `excerpt` + offsets UTF-16 `[start,end)`, sin normalización;
- `provenancePolicy`: refs `requiredClinicalRefs` y `optionalClinicalRefs` disjuntas; toda ref fuera de su unión está prohibida.

El comparator `pharmaceutical-d3-d2-comparator/3` exige count e identidades exactos, rechaza duplicados, acepta exactamente una alternativa literal y obliga a incluir todas las refs required sin admitir refs fuera de required + optional. Los optional son independientes. El `claimId` productivo no forma parte de la unicidad preregistrada porque continúa derivándose de las refs realmente observadas.

Matrix `/11`:

- identity: `pharmaceutical-d3-live-matrix/11`;
- fingerprint: `e98c4ffb8ebd6c025bf9d23f2282d69662c70b192c6d68f3daa6ba661c0112b1`;
- candidate: `gpt-5.6-terra`;
- expectation: `pharmaceutical-d3-d2-expectation/3`;
- comparator: `pharmaceutical-d3-d2-comparator/3`;
- status: **PENDING LIVE ACCEPTANCE**.

La nueva matriz conserva fixtures, transcripts, semántica clínica, D1, prompt D2 `/4`, request D2 `/2`, provider `/2`, policy `/1`, validator, relationship projection, governance, orden, repeticiones, gate 100%, stop-early, tokens, sampling, timeouts y budget máximo 82 (D1 61 + D2 21). El fingerprint del request C3 permanece `ca1e4bfbbc099a1a15e89f0c3684b4f4335a4ce6fce3c31911c758575724dd5e`.

La cobertura offline prueba las ocho combinaciones de optional refs de C3 ref 7, los cuatro productos literal/provenance de ref 8, las políticas de refs 2/9/11, identidad semántica/literal exacta, anti-duplicación y validación estructural fail-closed. También demuestra que el producto observado en `/10` falla bajo expectation `/2` y pasa bajo `/3`, sin cambiar producción.

M6-D3R24 — **CLOSED / COMPLETE**. M6-D3B — **NOT CLOSED — READY FOR EXPECTATION-V3 MATRIX-11 LIVE ACCEPTANCE FROM SMOKE**. La aceptación real de `/11` requiere autorización independiente. Cero OpenAI/live en este incremento; progreso sin cambios: M6 46% / proyecto 49.37%.
