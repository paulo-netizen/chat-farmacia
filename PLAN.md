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

M6-D3R24 — **CLOSED / COMPLETE**, exclusivamente offline: matrix `/10` permanece `REJECT` por `RELATED_CLINICAL_REFS ACCEPTANCE CONTRACT OVERCONSTRAINED`. D3R23 concluyó `A. SUFFICIENT`; expectation `pharmaceutical-d3-d2-expectation/3` separa clasificación semántica exacta, `ONE_OF` de spans literales exactos y provenance required/optional/forbidden, con comparator `/3` fail-closed. Matrix `/11` queda **PENDING LIVE ACCEPTANCE** con Terra. Prompt D2 `/4`, request D2 `/2`, provider `/2`, validator, claimId, D1 y governance permanecen intactos. M6-D3B queda **NOT CLOSED — READY FOR EXPECTATION-V3 MATRIX-11 LIVE ACCEPTANCE FROM SMOKE**. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-D3R20 — **CLOSED / COMPLETE**, exclusivamente offline: `/9` permanece `REJECT` por `RELATED_CLINICAL_REFS_ALTERNATIVE_GAP`; matrix `/10` preregistró una tercera alternativa completa y exacta para C3 ref 7. Su ejecución posterior permanece históricamente `REJECT`; no se reclasifica. El contrato expectation `/2`, comparador exacto, prompt D2 `/4`, request `/2`, policy/provider/validator, D1 y governance permanecen intactos.

M6-D3R18 — **CLOSED / COMPLETE**, exclusivamente offline: aclaración de identidad proposicional en prompt D2 `/4` y nueva matrix `/9`. `/8` terminó `REJECT` con Terra pese al request relacional `/2`; D3R17 concluyó `D2 PROMPT GAP`. Se preservan autoridad, fixtures, expectations, policy/provider y todos los históricos. Validación: 2818 PASS / 25 SKIPPED; TypeScript y diff-check PASS. M6-D3B sigue **NOT CLOSED — READY FOR PROMPT-V4 LIVE ACCEPTANCE FROM SMOKE**; matrix `/9` **PENDING LIVE ACCEPTANCE**. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-D3R16 — **CLOSED / COMPLETE**: request `pharmaceutical-d2-semantic-request/2` con proyección positiva y trazable barrera → assessment → adherencia → medicationRefs. Matrix `/8` con Terra terminó `REJECT`; `/6` Sol y `/7` Terra permanecen `REJECT`. M6-D3B sigue **NOT CLOSED**; la preparación actual corresponde a D3R18 y matrix `/9`. No cambia el prompt D2 `/3`, la semántica clínica ni el progreso M6 46% / proyecto 49.37%. Validación offline: 2793 PASS / 25 SKIPPED; TypeScript y diff-check PASS.

El milestone funcional activo es **M6 — Evaluación farmacéutica/PRM–RNM/adherencia**. M6-A aporta la referencia clínica farmacéutica canónica; M6-B cierra identidad, targets y evidencia; M6-C prepara el contexto determinista; M6-D1 y D2 aportan las adjudicaciones farmacéuticas. M6-D3 conserva como históricos `/1` `REJECT`, `/2`–`/3` `INCONCLUSIVE` y `/4`–`/10` `REJECT`. D3R23 concluyó que el contrato mínimo suficiente separa identidad semántica, alternativas literales exactas y provenance required/optional/forbidden. D3R24 implementa esa expectation `/3` y comparator `/3` solo en la nueva matrix `/11`, manteniendo todos los históricos y componentes productivos intactos. La futura aceptación M6-D3B requiere autorización independiente y comienza desde SMOKE bajo `/11` con Terra explícito; no se afirma aceptación live.

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
  └─ M6 Evaluación farmacéutica/PRM–RNM/adherencia [PARTIAL — A/B/C/D1/D2/D3A/D3R2/D3R4/D3R6/D3R8/D3R10/D3R14/D3R16/D3R18/D3R20/D3R24 CLOSED]
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
