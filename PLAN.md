# PLAN.md — ChatUSAL-FarmaBot v2

## Propósito

Este archivo mantiene el roadmap técnico y el orden de ejecución de ChatUSAL-FarmaBot v2.

La fuente canónica del progreso, los porcentajes, los pesos M0–M11 y el checkpoint funcional de referencia es [`docs/v2/PROJECT_STATUS.md`](docs/v2/PROJECT_STATUS.md). Los detalles funcionales y de aceptación siguen definidos por la especificación v2 en `docs/v2/`.

## Estado actual

- M0 — Saneamiento y barreras de seguridad: **PARTIAL**.
- M1 — Versionado y base de datos v2: **PARTIAL**.
- M2 — Editor docente estructurado: **NOT STARTED**.
- M3 — Generador, auditor y publicación: **PARTIAL**.
- M4 — Runtime seguro del paciente: **CLOSED**.
- M5 — Motor de protocolos SPFA: **CLOSED**.
- M6 — Evaluación farmacéutica/PRM–RNM/adherencia: **PARTIAL**.
- M7 — Evaluación de comunicación: **NOT STARTED**.
- M8 — Cuestionario post-caso: **NOT STARTED**.
- M9 — Resultados y feedback: **NOT STARTED**.
- M10 — Analítica y revisión docente: **NOT STARTED**.
- M11 — Hardening y observabilidad final: **NOT STARTED**.

El repositorio dispone de una suite automatizada amplia. M6-A, M6-B, M6-C, M6-D1, M6-D2, la preparación offline M6-D3A y las políticas versionadas M6-D3R2/M6-D3R4/M6-D3R6/M6-D3R8/M6-D3R10/M6-D3R14 quedaron validados con contratos estrictos, tests automatizados y TypeScript correcto.

## Próximo frente funcional

M6-D3R20 — **CLOSED / COMPLETE**, exclusivamente offline: `/9` permanece `REJECT` por `RELATED_CLINICAL_REFS_ALTERNATIVE_GAP`; matrix `/10` preregistra una tercera alternativa completa y exacta para C3 ref 7 (barrera …009, medicamento atribuido …001 y ámbito canónico …003). El contrato expectation `/2`, comparador exacto, prompt D2 `/4`, request `/2`, policy/provider/validator, D1 y governance permanecen intactos. M6-D3B queda **NOT CLOSED — READY FOR MATRIX-10 LIVE ACCEPTANCE FROM SMOKE**. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-D3R18 — **CLOSED / COMPLETE**, exclusivamente offline: aclaración de identidad proposicional en prompt D2 `/4` y nueva matrix `/9`. `/8` terminó `REJECT` con Terra pese al request relacional `/2`; D3R17 concluyó `D2 PROMPT GAP`. Se preservan autoridad, fixtures, expectations, policy/provider y todos los históricos. Validación: 2818 PASS / 25 SKIPPED; TypeScript y diff-check PASS. M6-D3B sigue **NOT CLOSED — READY FOR PROMPT-V4 LIVE ACCEPTANCE FROM SMOKE**; matrix `/9` **PENDING LIVE ACCEPTANCE**. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-D3R16 — **CLOSED / COMPLETE**: request `pharmaceutical-d2-semantic-request/2` con proyección positiva y trazable barrera → assessment → adherencia → medicationRefs. Matrix `/8` con Terra terminó `REJECT`; `/6` Sol y `/7` Terra permanecen `REJECT`. M6-D3B sigue **NOT CLOSED**; la preparación actual corresponde a D3R18 y matrix `/9`. No cambia el prompt D2 `/3`, la semántica clínica ni el progreso M6 46% / proyecto 49.37%. Validación offline: 2793 PASS / 25 SKIPPED; TypeScript y diff-check PASS.

El milestone funcional activo es **M6 — Evaluación farmacéutica/PRM–RNM/adherencia**. M6-A aporta la referencia clínica farmacéutica canónica; M6-B cierra la identidad de contenidos de informe, los targets evaluativos atómicos y la frontera estructural de evidencia candidata; M6-C prepara de forma determinista, mínima y allowlisted el contexto de adjudicación fijado a sesión, versión, transcript y target set; M6-D1A aporta los contratos puros, batch plan, fingerprints y validación fail-closed; M6-D1B conecta esos contratos con prompt versionado, Structured Outputs, runtime OpenAI server-owned allowlisted y orquestación secuencial sin retries ni aceptación parcial; M6-D2A añade la unión canónica de mensajes del alumno, autoridad mínima, contratos de claims no representados, offsets literales, IDs server-owned y validación fail-closed sin conocimiento externo; M6-D2B conecta esa frontera con prompt/policy versionados, transport estricto, runtime OpenAI candidato server-owned y una única ejecución fail-fast, conservando `UNSUPPORTED` como ausencia de sustento en la autoridad suministrada y no como juicio clínico externo; M6-D3A congeló la matriz `/1`, cuyo intento live permanece históricamente `REJECT`; M6-D3R2 y M6-D3R4 produjeron las matrices `/2` y `/3`, ambas históricamente `INCONCLUSIVE`; M6-D3R6 versionó el provider D2 a excerpt + ocurrencia y creó `/4`, cuyo intento permanece `REJECT`; M6-D3R8 incorporó en `/5` la expectation C3 omitida y esa matriz permanece `REJECT` por una canonicalización demasiado estrecha; M6-D3R10 crea `/6` con alternativas D2 completas, exactas y preregistradas, sin relajar la semántica. `/6` quedó `REJECT` por omisión obligatoria C3 ref 7 (`MODEL_SEMANTIC_FAILURE`): Sol queda `REJECTED_FOR_M6_D3_MATRIX_6`, no globalmente desautorizado (`NOT_GLOBALLY_DISALLOWED`). M6-D3R14 introduce `pharmaceutical-semantic-model-policy/1` con Sol y Terra técnicamente allowlisted y preparó `/7` con Terra en ambas lanes. `/7` terminó `REJECT` por la misma omisión C3 ref 7. D3R15 concluyó `D2 CONTEXT SALIENCE GAP`, autoridad `SUFFICIENT_BUT_INDIRECT`; D3R16 preparó `/8` con request D2 `/2`, sin cambiar las expectativas; `/8` terminó `REJECT` pese a la proyección relacional. D3R17 concluyó `D2 PROMPT GAP`; D3R18 aclaró la cobertura por identidad proposicional en prompt `/4`, pero `/9` terminó `REJECT` por una alternativa canónica válida no preregistrada. D3R20 conserva `/9` y prepara `/10` añadiendo exclusivamente esa tercera alternativa completa y exacta. No se repite ningún histórico para buscar PASS. La futura aceptación M6-D3B requiere autorización independiente y comienza desde SMOKE bajo `/10` con Terra explícito; no se afirma aceptación live.

Antes de implementar cada incremento de M6:

1. delimitar el contrato clínico y pedagógico;
2. identificar dependencias con el evaluator y la evidencia ya versionados;
3. implementar el menor incremento coherente;
4. añadir validación runtime y tests negativos/adversariales;
5. verificar TypeScript, suite normal y las pruebas de integración pertinentes;
6. registrar decisiones clínicas ambiguas antes de codificarlas.

## Roadmap técnico

```text
M0 Saneamiento y barreras de seguridad ───────────────┐
M1 Versionado y base de datos v2 ────────────────────┤
                                                     ├─ cierre de deuda previa al despliegue
M2 Editor docente estructurado ── M3 Generador,      │
                                  auditor y publicación

M4 Runtime seguro del paciente [CLOSED]
M5 Motor de protocolos SPFA [CLOSED]
  └─ M6 Evaluación farmacéutica/PRM–RNM/adherencia [PARTIAL — A/B/C/D1/D2/D3A/D3R2/D3R4/D3R6/D3R8/D3R10/D3R14/D3R16/D3R18/D3R20 CLOSED]
       ├─ M7 Evaluación de comunicación
       └─ M8 Cuestionario post-caso
            └─ M9 Resultados y feedback
                 └─ M10 Analítica y revisión docente
                      └─ M11 Hardening y observabilidad final
```

La ruta funcional principal es:

`M6 → M7/M8 → M9 → M10 → M11`

M0/M1 y M2/M3 pueden cerrarse en paralelo, pero su deuda pendiente debe resolverse antes del despliegue definitivo. Completar M6–M11 no equivale por sí solo a completar el proyecto si M0–M3 siguen parciales.

## Alcance pendiente por frente

### M0 — seguridad y saneamiento

- eliminar la configuración TLS insegura de `lib/db.ts`;
- exigir explícitamente el rol estudiante en el flujo académico;
- incorporar identidad de actividad, grupo e intento;
- cerrar el modelo general de roles/RLS y la deuda Legacy/editorial;
- actualizar README, configuración reproducible y CI.

### M1 — versionado y persistencia editorial

- soportar contenido `TEACHER_AUTHORED` y edición manual docente;
- definir lineage/provenance editorial;
- completar repositorio y servicios generales de versiones;
- exponer el lifecycle editorial completo mediante API.

### M2 — editor docente

- construir el editor estructurado para hechos del paciente, evaluator, protocolos y controles editoriales;
- validar borrador, preview y publicación sin edición JSON libre como flujo principal.

### M3 — generación, auditoría y publicación

- añadir auditor clínico independiente;
- integrar la validación CIMA/AEMPS acordada;
- persistir y exponer el workflow mediante API/editor;
- completar revisión y publicación docente.

### M6–M11

- M6: referencia clínica, identidad de contenidos esenciales, targets atómicos, contratos de evidencia candidata, preparación determinista del contexto, lanes D1/D2 completas, hardening D3A, matrices históricas `/1`–`/5`, contrato provider D2 excerpt + ocurrencia de D3R6 y alternatives canónicas exactas de D3R10 en matriz `/6`; pendientes nueva aceptación live D3B desde SMOKE, scoring, persistencia e integración;
- M7: evaluación de la comunicación farmacéutico-paciente;
- M8: cuestionario post-caso;
- M9: resultados globales y feedback;
- M10: analítica y revisión docente;
- M11: hardening, observabilidad, privacidad y operación final.

## Reglas de ejecución

- La especificación v2 es la autoridad de comportamiento.
- `docs/v2/PROJECT_STATUS.md` es la autoridad de progreso; este plan no mantiene porcentajes paralelos.
- No se reabren M4 o M5 sin una regresión o incompatibilidad demostrada.
- Los cambios de esquema se realizan mediante migraciones versionadas y verificables.
- Las fronteras estudiantiles usan allowlists y nunca exponen soluciones docentes.
- Autorización, propiedad, validación y estado se comprueban server-side.
- Todo comportamiento nuevo incluye tests proporcionales al riesgo y trazabilidad de evidencia cuando corresponda.
- Las decisiones clínicas o pedagógicas ambiguas se documentan antes de implementar una regla nueva.

## Gates de despliegue

El cierre funcional de milestones posteriores no elimina estos gates:

- TLS seguro y configuración reproducible;
- autorización por rol/propiedad y estrategia RLS/privilegios;
- persistencia editorial con lineage;
- publicación docente controlada;
- privacidad, observabilidad y operación verificadas;
- suite, TypeScript, migraciones y pruebas adversariales en verde.
