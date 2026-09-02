# ChatUSAL-FarmaBot v2 — Project Status

## Baseline oficial

- **Fecha del baseline:** 28 de agosto de 2026.
- **Commit funcional de referencia:** `3bae1167fef0f584a79a432edbcbc0a5e4a52ac6` (`Complete M6-D2 pharmaceutical claim adjudication`).
- **Progreso global:** **49.37%**.
- **M5:** **CLOSED / COMPLETE**.
- **Suite actual:** **2931 PASS / 25 SKIPPED**.
- **TypeScript:** **PASS**.

Este documento es la fuente canónica del estado y del progreso global del proyecto. [`PLAN.md`](../../PLAN.md) conserva el roadmap técnico y el orden de ejecución, sin mantener una segunda tabla de porcentajes.

## Pesos y progreso M0–M11

El progreso global se calcula mediante:

```text
global = Σ(weight × completion)
```

Los pesos y porcentajes se expresan como fracciones para el cálculo; por ejemplo, un milestone con peso 8% y completion 60% aporta 4.80 puntos porcentuales.

| Milestone | Nombre | Estado | % interno | Peso | Aporte global |
|---|---|---|---:|---:|---:|
| M0 | Saneamiento y barreras de seguridad | PARTIAL | 60% | 8% | 4.80% |
| M1 | Versionado y base de datos v2 | PARTIAL | 80% | 10% | 8.00% |
| M2 | Editor docente estructurado | NOT STARTED | 0% | 8% | 0.00% |
| M3 | Generador, auditor y publicación | PARTIAL | 55% | 11% | 6.05% |
| M4 | Runtime seguro del paciente | CLOSED | 100% | 10% | 10.00% |
| M5 | Motor de protocolos SPFA | CLOSED | 100% | 15% | 15.00% |
| M6 | Evaluación farmacéutica/PRM–RNM/adherencia | PARTIAL | 46% | 12% | 5.52% |
| M7 | Evaluación de comunicación | NOT STARTED | 0% | 7% | 0.00% |
| M8 | Cuestionario post-caso | NOT STARTED | 0% | 7% | 0.00% |
| M9 | Resultados y feedback | NOT STARTED | 0% | 5% | 0.00% |
| M10 | Analítica y revisión docente | NOT STARTED | 0% | 4% | 0.00% |
| M11 | Hardening y observabilidad final | NOT STARTED | 0% | 3% | 0.00% |
| **Total** |  |  |  | **100%** | **49.37%** |

## Regla estable de progreso

- Los pesos M0–M11 quedan fijos como baseline oficial.
- El porcentaje global aumenta conforme progresa cada milestone.
- El porcentaje global no debe disminuir mientras el alcance permanezca estable.
- Los pesos no se recalculan por el mero paso del tiempo o por reestimar esfuerzo.
- Cualquier recalibración exige documentar primero un cambio real y explícito de alcance.

## Estado resumido de los milestones

### M0 — Saneamiento y barreras de seguridad

**Objetivo:** estabilizar v1 y establecer barreras de seguridad verificables para el trabajo v2.
**Estado:** **PARTIAL — 60%**.

Completado: baseline v1 reproducible; DTO público estudiantil por allowlist; retirada de la solución académica de fronteras estudiantiles; contratos factual/runtime; sesiones idempotentes y recuperables; ownership y cobertura de integración relevante.

Pendiente: TLS inseguro en `lib/db.ts`; restricción explícita `role=student`; identidad de actividad/grupo/intento; modelo general de roles/RLS; deuda de flujos Legacy/editoriales; README, configuración y CI. Véanse la [especificación de seguridad](09_SECURITY_PRIVACY.md) y el [diseño de sesiones](12_SESSION_IDEMPOTENCY_AND_RESUME_DESIGN.md).

### M1 — Versionado y base de datos v2

**Objetivo:** conservar versiones inmutables, snapshots Legacy y trazabilidad reproducible.
**Estado:** **PARTIAL — 80%**.

Completado: lifecycle de versiones; snapshots Legacy; pinning de sesión; migraciones v2 de versionado y persistencia; boundaries de resolución ligados a versión.

Pendiente: `TEACHER_AUTHORED`; persistencia de edición manual docente; lineage editorial; repositorio/servicio general de versiones; API completa del lifecycle editorial. Véanse el [modelo de datos](08_DATA_MODEL.md) y el [diseño de persistencia](11_CASE_VERSION_PERSISTENCE_DESIGN.md).

### M2 — Editor docente estructurado

**Objetivo:** permitir autoría y revisión docente estructuradas sin depender de JSON libre.
**Estado:** **NOT STARTED — 0%**.

Pendiente: formularios, validación editorial, preview y workflow completo del editor. Véase el [workflow docente](06_TEACHER_WORKFLOW.md).

### M3 — Generador, auditor y publicación

**Objetivo:** generar casos estructurados, auditarlos y someterlos a revisión/publicación docente controlada.
**Estado:** **PARTIAL — 55%**.

Completado parcialmente: Teaching Brief; Structured Outputs; bundles generados; receipts/provenance; validación determinista y composición server-owned.

Pendiente: auditor clínico separado; CIMA/AEMPS; persistencia y API del workflow; integración con el editor; revisión y publicación docente completas. Véanse [generación de casos](05_CASE_GENERATION.md) y [workflow docente](06_TEACHER_WORKFLOW.md).

### M4 — Runtime seguro del paciente

**Objetivo:** mantener al modelo en rol paciente y limitarlo a hechos permitidos, con validación y respuesta segura.
**Estado:** **CLOSED — 100%**.

Entregado: runtime seguro del paciente; role lock; proyecciones allowlist; guard determinista y semántico; comportamiento fail-closed; migración del chat; aceptación adversarial y live controlada. Véanse el [diseño de seguridad de respuesta](15_PATIENT_RESPONSE_SAFETY_DESIGN.md) y su [aceptación](16_PATIENT_RESPONSE_SAFETY_ACCEPTANCE.md).

### M5 — Motor de protocolos SPFA

**Objetivo:** evaluar de forma versionada, trazable y persistible el cumplimiento de protocolos SPFA.
**Estado:** **CLOSED / COMPLETE — 100%**.

Entregado: protocolos SPFA versionados; asociación con el caso; transcript y evidencia inmutables; baseline y contexto semántico; adjudicación; evaluación y scoring; persistencia; freeze; retry/recovery; API/polling; seguridad, concurrencia y hardening.

El cierre corresponde al commit `b2879cec7824968bcc0b6e3bca80852fa9cf3359`. Véase el [diseño y registro de evaluación SPFA](17_SPFA_PROTOCOL_EVALUATION_DESIGN.md).

### M6 — Evaluación farmacéutica/PRM–RNM/adherencia

**Objetivo:** evaluar razonamiento farmacéutico, PRM/RNM, adherencia, barreras e intervención con evidencia.
**Estado:** **PARTIAL — 46%**.

Completado: M6-A, proyección clínica farmacéutica canónica; M6-B, identidad, targets y evidencia; M6-C, contexto determinista; M6-D1/D2, contratos, runtimes y adjudicación farmacéutica; M6-D3A y refinamientos offline hasta M6-D3R29. Matrix `/13` terminó `REJECT`: C3 ref 9 conservó literal, `UNSUPPORTED` y `RECOMMENDATION`, pero Terra clasificó `ADHERENCE` con C010 en vez de `PROFESSIONAL_RESPONSE` con C013. M6-D3R30 registra el resultado como deuda de validación sin alterar D1/D2 ni históricos. `UNSUPPORTED` significa únicamente no sustentado por la autoridad suministrada y queda como señal futura de revisión, nunca como falsedad, safety o penalización automática. Los informes históricos siguen siendo válidos, pero no reciben IDs ni targets de contenido sintéticos.

Subdivisión fija de M6-B dentro del milestone: M6-B1 = 4% (CLOSED) y M6-B2 = 8% (CLOSED). **M6-B = CLOSED / COMPLETE**.

M6-C = 10% del milestone. **M6-C = CLOSED / COMPLETE**.

Subdivisión fija de M6-D dentro del milestone: M6-D1A = 3% (CLOSED), M6-D1B = 4% (CLOSED), M6-D2A = 2% (CLOSED), M6-D2B = 2% (CLOSED), M6-D3A = 1% (CLOSED) y M6-D3B = 2% (**OPEN / VALIDATION DEBT**, no completado). **M6-D1 = CLOSED / COMPLETE. M6-D2 = CLOSED / COMPLETE. M6-D3 = PARTIAL. M6-D = PARTIAL**.

**Deuda M6-D3B — pharmaceutical semantic live acceptance.** Estado: **OPEN / VALIDATION DEBT**. Blocker: clasificación semántica/provenance estocástica frente a un gate exacto del 100%. Última matrix: `/13`, históricamente **REJECT** por C3 ref 9 (`ADHERENCE` + C010 observados frente a `PROFESSIONAL_RESPONSE` + C013 esperados). No existe un defecto contractual claro, pequeño y demostrable; se pausa toda iteración adicional y no se crea `/14`. Solo debe reabrirse ante una estrategia arquitectónica nueva: mayor determinismo server-side, menos decisiones delegadas al LLM, nueva estrategia de adjudicación semántica o un modelo/configuración materialmente distintos; nunca para probar otra muestra equivalente.

Impacto: la deuda impide cerrar el evaluador semántico farmacéutico D2 y mantiene M6-D3/M6-D `PARTIAL`. No implica un fallo general del chat del paciente, controles de rol, anti-hallucination, M5 SPFA ni módulos independientes ya cerrados. El gate 100% permanece intacto. Siguiente trabajo independiente recomendado: **M6-E0 — auditoría del contrato versionado de scoring farmacéutico** (0%), dependiente de M6-A/B/C y contratos offline D1/D2, no de un supuesto cierre live D3B. Primera tarea: fijar inputs, reglas pedagógicas, tratamiento review-only de `UNSUPPORTED`, weights/thresholds, trazabilidad y fail-closed antes de implementar scoring. M6 46% / proyecto 49.37% sin cambios. Véanse el [modelo de evaluación](04_EVALUATION_MODEL.md) y el [registro live](18_PHARMACEUTICAL_SEMANTIC_LIVE_ACCEPTANCE.md).

### M7 — Evaluación de comunicación

**Objetivo:** evaluar la comunicación farmacéutico-paciente mediante criterios trazables.
**Estado:** **NOT STARTED — 0%**.

Pendiente: rúbrica, extracción de evidencia, scoring e integración.

### M8 — Cuestionario post-caso

**Objetivo:** recoger y evaluar la comprensión posterior al caso sin liberar soluciones prematuramente.
**Estado:** **NOT STARTED — 0%**.

Pendiente: contrato versionado, flujo, persistencia y evaluación del cuestionario. Véase el [workflow estudiante](07_STUDENT_WORKFLOW.md).

### M9 — Resultados y feedback

**Objetivo:** componer resultados globales y feedback autorizado, explicable y basado en evidencia.
**Estado:** **NOT STARTED — 0%**.

Pendiente: agregación M6–M8, reglas de liberación, DTOs y experiencia de resultados.

### M10 — Analítica y revisión docente

**Objetivo:** ofrecer analítica, trazabilidad y revisión/override docente auditado.
**Estado:** **NOT STARTED — 0%**.

Pendiente: vistas docentes, métricas, revisión y auditoría.

### M11 — Hardening y observabilidad final

**Objetivo:** cerrar seguridad, privacidad, observabilidad y operación para despliegue.
**Estado:** **NOT STARTED — 0%**.

Pendiente: controles operativos, telemetría, privacidad/retención, configuración, CI/despliegue y aceptación final. Véanse [seguridad y privacidad](09_SECURITY_PRIVACY.md) y [tests de aceptación](10_ACCEPTANCE_TESTS.md).

## Proyección con M0–M3 sin cambios

| Punto de la ruta | Progreso global proyectado |
|---|---:|
| Actual | 49.25% |
| Tras M6 | 55.85% |
| Tras M7 | 62.85% |
| Tras M8 | 69.85% |
| Tras M9 | 74.85% |
| Tras M10 | 78.85% |
| Tras M11 | 81.85% |

Llegar a M11 no implica alcanzar el 100% mientras M0–M3 mantengan trabajo pendiente. El 18.15% restante corresponde a completar esos cuatro milestones según sus pesos fijados.

## Ruta crítica

La ruta funcional principal es:

```text
M6 → M7/M8 → M9 → M10 → M11
```

En paralelo pueden cerrarse:

- M0 y M1: deuda de seguridad, versionado y operación base;
- M2 y M3: autoría, generación, auditoría y publicación docente.

El cierre de esos frentes paralelos es especialmente importante antes del despliegue definitivo.
