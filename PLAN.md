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

El repositorio dispone de una suite automatizada amplia. M6-A y M6-B1 quedaron validados con 2247 pruebas superadas, 24 omitidas de forma condicionada y TypeScript correcto.

## Próximo frente funcional

El milestone funcional activo es **M6 — Evaluación farmacéutica/PRM–RNM/adherencia**. M6-A aporta la referencia clínica farmacéutica canónica y M6-B1 cierra la identidad versionada de contenidos esenciales de informe; el siguiente incremento es M6-B2, construcción de targets evaluativos, sin reabrir los contratos cerrados salvo una incompatibilidad demostrada.

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
  └─ M6 Evaluación farmacéutica/PRM–RNM/adherencia [PARTIAL — A/B1 CLOSED]
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

- M6: referencia clínica canónica e identidad de contenidos esenciales completadas; pendientes targets (M6-B2), evidencia de desempeño, adjudicación, scoring e integración;
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
