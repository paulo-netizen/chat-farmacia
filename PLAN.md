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

El repositorio dispone de una suite automatizada amplia. M6-A, M6-B, M6-C, M6-D1, M6-D2, la preparación offline M6-D3A y los refinamientos versionados hasta M6-D3R29 quedaron validados con contratos estrictos, tests automatizados y TypeScript correcto. M6-D3R30 congela el gate live no superado como deuda de validación visible y desbloquea trabajo independiente.

## Próximo frente funcional

M6-D3R30 — **CLOSED / COMPLETE**, exclusivamente documental: matrix `/13` queda históricamente `REJECT`. C3 run 1 produjo en ref 9 una nueva variación del modelo: se esperaba `PROFESSIONAL_RESPONSE / UNSUPPORTED / RECOMMENDATION` con C013 y se observó `ADHERENCE / UNSUPPORTED / RECOMMENDATION` con C010; el literal fue correcto. No existe `SMALL_CLEAR_CONTRACT_DEFECT`. M6-D3B queda **OPEN / VALIDATION DEBT**; el gate 100% no se rebaja, no se crea `/14` y M6-D3/M6-D permanecen `PARTIAL`. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-E0 — **AUDIT COMPLETED**. M6-E1 — **CLOSED / COMPLETE**, exclusivamente contratos versionados, canonicalización y validación estructural offline. D1 será la única fuente de crédito; D2 queda review-only, sin puntos negativos ni defaults pedagógicos. Scoring engine: **NOT IMPLEMENTED**. Configuración pedagógica: **REQUIRED / NOT YET APPROVED**. No se presupone aceptación live D3B. M6-E1F1: **COMPLETE**, sin reconstruir possible desde pesos; validación `STRUCTURAL_ONLY`. Validación tras F1: 156/156 tests E1, TypeScript `--incremental false` y diff-check PASS. Validación anterior a F1: 493/493 con contratos upstream relacionados y suite 3060 PASS / 25 SKIPPED. No hay peso de progreso asignado a E1: M6 46% / proyecto 49.37% permanecen intactos.

### Open decisions — configuración pedagógica M6-E

- Plan puntuable aprobado: partición, dominios/aplicabilidad y resolución explícita de grupos upstream solapados.
- Pesos por unidad y sus versiones: configuración obligatoria, sin valores clínicos por defecto.
- Rounding aprobado: escala y modo explícitos; `UNCONFIGURED` bloquea un input calculable.
- Thresholds: `NO_THRESHOLDS` explícito para esta versión; no se inventa un aprobado. Configuraciones futuras definidas requieren nueva autorización de reglas.
- La validación de resultados E1 es estructural, no una verificación de la aritmética del futuro scorer. UI, feedback, persistencia, agregación y revisión docente implementada quedan fuera de alcance.

M6-D3R24 — **CLOSED / COMPLETE**, exclusivamente offline: matrix `/10` permanece `REJECT` por `RELATED_CLINICAL_REFS ACCEPTANCE CONTRACT OVERCONSTRAINED`. D3R23 concluyó `A. SUFFICIENT`; expectation `pharmaceutical-d3-d2-expectation/3` separa clasificación semántica exacta, `ONE_OF` de spans literales exactos y provenance required/optional/forbidden, con comparator `/3` fail-closed. Matrix `/11` queda **PENDING LIVE ACCEPTANCE** con Terra. Prompt D2 `/4`, request D2 `/2`, provider `/2`, validator, claimId, D1 y governance permanecen intactos. M6-D3B queda **NOT CLOSED — READY FOR EXPECTATION-V3 MATRIX-11 LIVE ACCEPTANCE FROM SMOKE**. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-D3R20 — **CLOSED / COMPLETE**, exclusivamente offline: `/9` permanece `REJECT` por `RELATED_CLINICAL_REFS_ALTERNATIVE_GAP`; matrix `/10` preregistró una tercera alternativa completa y exacta para C3 ref 7. Su ejecución posterior permanece históricamente `REJECT`; no se reclasifica. El contrato expectation `/2`, comparador exacto, prompt D2 `/4`, request `/2`, policy/provider/validator, D1 y governance permanecen intactos.

M6-D3R18 — **CLOSED / COMPLETE**, exclusivamente offline: aclaración de identidad proposicional en prompt D2 `/4` y nueva matrix `/9`. `/8` terminó `REJECT` con Terra pese al request relacional `/2`; D3R17 concluyó `D2 PROMPT GAP`. Se preservan autoridad, fixtures, expectations, policy/provider y todos los históricos. Validación: 2818 PASS / 25 SKIPPED; TypeScript y diff-check PASS. M6-D3B sigue **NOT CLOSED — READY FOR PROMPT-V4 LIVE ACCEPTANCE FROM SMOKE**; matrix `/9` **PENDING LIVE ACCEPTANCE**. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-D3R16 — **CLOSED / COMPLETE**: request `pharmaceutical-d2-semantic-request/2` con proyección positiva y trazable barrera → assessment → adherencia → medicationRefs. Matrix `/8` con Terra terminó `REJECT`; `/6` Sol y `/7` Terra permanecen `REJECT`. M6-D3B sigue **NOT CLOSED**; la preparación actual corresponde a D3R18 y matrix `/9`. No cambia el prompt D2 `/3`, la semántica clínica ni el progreso M6 46% / proyecto 49.37%. Validación offline: 2793 PASS / 25 SKIPPED; TypeScript y diff-check PASS.

El milestone funcional activo es **M6 — Evaluación farmacéutica/PRM–RNM/adherencia**. M6-A aporta la referencia clínica farmacéutica canónica; M6-B cierra identidad, targets y evidencia; M6-C prepara el contexto determinista; M6-D1 y D2 aportan las adjudicaciones farmacéuticas. M6-D3 conserva como históricos `/1` `REJECT`, `/2`–`/3` `INCONCLUSIVE` y `/4`–`/13` `REJECT`. M6-D3B queda `OPEN / VALIDATION DEBT`; no se abrirá otra muestra o matrix sin una estrategia arquitectónica materialmente nueva. M6-E0 está auditado y M6-E1 introduce únicamente [contratos de scoring y validación estructural](docs/v2/19_PHARMACEUTICAL_SCORING_CONTRACT.md), sin motor numérico ni configuración pedagógica aprobada.

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
  └─ M6 Evaluación farmacéutica/PRM–RNM/adherencia [PARTIAL — A/B/C/D1/D2/D3A + refinamientos offline CLOSED; D3B VALIDATION DEBT; E0 AUDITED; E1 CONTRACTS]
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

- M6: referencia clínica, identidad de contenidos esenciales, targets atómicos, contratos de evidencia candidata, preparación determinista del contexto y lanes D1/D2 completas; M6-D3B queda `OPEN / VALIDATION DEBT` tras `/13` `REJECT`; pendientes auditoría/implementación de scoring, persistencia e integración, sin crear automáticamente `/14`;
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
