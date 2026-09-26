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

## Estado vigente y próximo frente funcional

M6-P2 — **IMPLEMENTATION COMPLETE — LOCAL / READY FOR REVIEW**, nuevo incremento de persistencia, sin peso independiente. Adaptador `pharmaceutical-evaluation-postgres.ts` con conexión explícita y migración aditiva `0004_v2_pharmaceutical_evaluation_persistence.sql`: evaluaciones, intentos y artefactos separados; creación idempotente, lectura validada, claim, completion, fail y expiración/recuperación explícita. Sin cambios de tablas ni semántica M5.
Ownership se comprueba contra la sesión en DB; identidad autenticada y autorización de reevaluación proceden del llamador server-owned. Tiempo PostgreSQL posterior a bloqueos y control de lease en la escritura; resultados/históricos inmutables y transacción atómica. Artefactos `json` preservan la serialización sensible al orden de fingerprints D1 existentes; metadata operacional `jsonb` con concordancia SQL/P1. No cambia ningún hash ni contrato anterior.
Evidencia real local: **26/26 PostgreSQL P2**, **8/8 M5-G3 + 10/10 M5-G4**, con migraciones 0001–0004 en contenedores exclusivos verificados. Offline: **12/12 P2**, selección inicial **443/443**, suite final **3286 PASS / 51 SKIPPED**, TypeScript `--noEmit --incremental false` y diff-check PASS. Los skipped incluyen 26 PG P2, 18 PG M5 y 7 live; PG se validó aparte, no OpenAI. Detalle y criterios pendientes en [E4/P2](docs/v2/21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md#m6-p2--adaptador-postgresql-local).
No API, ejecución semántica, publicación académica ni replay completo. Pendientes integración del freeze/E3, permisos productivos/retención y revisión del entregable. No acredita automáticamente los 8 puntos de persistencia; 56% / 50.57% intactos.

M6-P1 — **COMPLETE / PUBLISHED IN GIT** (`66d3e22074d31bc2ad35af08d98bda04c1bd5020`), contratos puros de registro/lifecycle bajo persistencia, sin peso independiente; no despliegue.
Intención/idempotencia, manifest obligatorio, resolutor offline de artefactos, validación estructural/integridad y transiciones con lease/fencing; composición real E3 con runtimes falsos. No recalcula scores ni reconstruye provider responses.
Evidencia local: 54/54 P1; selección relacionada 610/610; suite 3274 PASS / 25 SKIPPED; TypeScript `--noEmit --incremental false` y diff-check PASS. Live/DB desactivados.
P1 no modificó M5 ni APIs E3 y no implementó persistencia. P2 añade ahora la frontera PostgreSQL local; retención, integración productiva y replay completo siguen pendientes. Los 8 puntos no se acreditan automáticamente.

M6 **PARTIAL — 56%** / proyecto **50.57%**, según la regularización interna aprobada en [PROJECT_STATUS](docs/v2/PROJECT_STATUS.md#excepción-puntual-aprobada--desglose-interno-m6). No cambia el alcance ni los pesos globales. E3 está publicado en Git (`11e10724b8ca1032c29edf6f85553e28395ab62b`), no desplegado ni activado académicamente. M6-E sigue PARTIAL; PED2 abierto y perfiles no aprobados/no instalados; D3B OPEN / VALIDATION DEBT.

M6-E4 — **DESIGN COMPLETE**, exclusivamente documental, **NO INDEPENDENT WEIGHT**. [Persistencia y reutilización](docs/v2/21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md). P1 aporta contratos puros y P2 la implementación PostgreSQL local pendiente de revisión/publicación, sin acreditar sus 8 puntos.

## Registros históricos de cierre — no son instrucciones de ejecución vigentes

M6-D3R30 — **CLOSED / COMPLETE**, exclusivamente documental: matrix `/13` queda históricamente `REJECT`. C3 run 1 produjo en ref 9 una nueva variación del modelo: se esperaba `PROFESSIONAL_RESPONSE / UNSUPPORTED / RECOMMENDATION` con C013 y se observó `ADHERENCE / UNSUPPORTED / RECOMMENDATION` con C010; el literal fue correcto. No existe `SMALL_CLEAR_CONTRACT_DEFECT`. M6-D3B queda **OPEN / VALIDATION DEBT**; el gate 100% no se rebaja, no se crea `/14` y M6-D3/M6-D permanecen `PARTIAL`. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-E0 — **AUDIT COMPLETED**. M6-E1 — **CLOSED / COMPLETE**, exclusivamente contratos versionados, canonicalización y validación estructural offline. D1 es la única fuente de crédito; D2 queda review-only, sin puntos negativos ni defaults pedagógicos. Configuración pedagógica: **REQUIRED / NOT YET APPROVED**. No se presupone aceptación live D3B. M6-E1F1: **COMPLETE**, sin reconstruir possible desde pesos; validación `STRUCTURAL_ONLY` conservada por E2. Validación tras F1: 156/156 tests E1. Validación histórica anterior a F1: 493/493 con contratos upstream relacionados y suite 3060 PASS / 25 SKIPPED.

M6-E2 — **CLOSED / COMPLETE**: motor puro y determinista sobre configuración aprobada y fuentes reconstruidas E1. Scoring engine: **IMPLEMENTED / CONFIGURATION-GATED**. Cálculo BigInt exacto, rounding final explícito y D2 review-only; sin perfiles docentes productivos, cambios de schemas, API, persistencia ni llamadas externas. Validación: 98/98 scorer, 156/156 E1, 142/142 D1 y 228/228 D2; suite 3185 PASS / 25 SKIPPED, TypeScript `--incremental false` y diff-check PASS. Production pedagogical profiles: **NOT APPROVED / NOT INSTALLED**. PED1/PED2A auditados; PED2 **OPEN / NOT FROZEN / TEACHER APPROVAL REQUIRED**. D3B **OPEN / VALIDATION DEBT**. Sin ponderación E1/E2 asignada: M6 46% / proyecto 49.37% permanecen intactos. No equivale a una nota académica productiva integrada.

### Registro E3 publicado

M6-E3 — **CLOSED / COMPLETE — OFFLINE INTEGRATION COMPLETE**, publicado en Git mediante `11e10724b8ca1032c29edf6f85553e28395ab62b`; **NO INDEPENDENT WEIGHT**. Evidencia histórica: 35/35 E3, 500/500 selección relacionada, 3220 PASS / 25 SKIPPED, TypeScript y diff-check PASS. Sin aceptación live ni activación académica. [Pipeline](docs/v2/20_PHARMACEUTICAL_SESSION_PIPELINE.md). El cierre original mantuvo 46% / 49.37%; la regularización posterior reconoce capacidad técnica E1/E2/E3 dentro de E, sin puntuar E3 separadamente.

### Open decisions vigentes — configuración pedagógica M6-E

- Plan puntuable aprobado: partición, dominios/aplicabilidad y resolución explícita de grupos upstream solapados.
- Pesos por unidad y sus versiones: configuración obligatoria, sin valores clínicos por defecto.
- Rounding aprobado: escala y modo explícitos; `UNCONFIGURED` bloquea un input calculable.
- Thresholds: `NO_THRESHOLDS` explícito para esta versión; no se inventa un aprobado. Configuraciones futuras definidas requieren nueva autorización de reglas.
- La validación de resultados E1 sigue siendo estructural; el cálculo pertenece exclusivamente a E2. Coverage profile es necesario para interpretación/comparabilidad académica en PED2, no para aritmética; no se añade a los schemas. UI, feedback, persistencia, agregación y revisión docente implementada quedan fuera de alcance.

### Históricos de matrices — estados correspondientes a cada incremento, posteriormente supersedidos

Los PENDING/READY siguientes describen preregistros históricos, no autorizan nuevas ejecuciones. Estado vigente: /1 REJECT, /2–/3 INCONCLUSIVE, /4–/13 REJECT; D3B OPEN / VALIDATION DEBT.

M6-D3R24 — **CLOSED / COMPLETE**, exclusivamente offline: matrix `/10` permanece `REJECT` por `RELATED_CLINICAL_REFS ACCEPTANCE CONTRACT OVERCONSTRAINED`. D3R23 concluyó `A. SUFFICIENT`; expectation `pharmaceutical-d3-d2-expectation/3` separa clasificación semántica exacta, `ONE_OF` de spans literales exactos y provenance required/optional/forbidden, con comparator `/3` fail-closed. Matrix `/11` queda **PENDING LIVE ACCEPTANCE** con Terra. Prompt D2 `/4`, request D2 `/2`, provider `/2`, validator, claimId, D1 y governance permanecen intactos. M6-D3B queda **NOT CLOSED — READY FOR EXPECTATION-V3 MATRIX-11 LIVE ACCEPTANCE FROM SMOKE**. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-D3R20 — **CLOSED / COMPLETE**, exclusivamente offline: `/9` permanece `REJECT` por `RELATED_CLINICAL_REFS_ALTERNATIVE_GAP`; matrix `/10` preregistró una tercera alternativa completa y exacta para C3 ref 7. Su ejecución posterior permanece históricamente `REJECT`; no se reclasifica. El contrato expectation `/2`, comparador exacto, prompt D2 `/4`, request `/2`, policy/provider/validator, D1 y governance permanecen intactos.

M6-D3R18 — **CLOSED / COMPLETE**, exclusivamente offline: aclaración de identidad proposicional en prompt D2 `/4` y nueva matrix `/9`. `/8` terminó `REJECT` con Terra pese al request relacional `/2`; D3R17 concluyó `D2 PROMPT GAP`. Se preservan autoridad, fixtures, expectations, policy/provider y todos los históricos. Validación: 2818 PASS / 25 SKIPPED; TypeScript y diff-check PASS. M6-D3B sigue **NOT CLOSED — READY FOR PROMPT-V4 LIVE ACCEPTANCE FROM SMOKE**; matrix `/9` **PENDING LIVE ACCEPTANCE**. Progreso sin cambios: M6 46% / proyecto 49.37%.

M6-D3R16 — **CLOSED / COMPLETE**: request `pharmaceutical-d2-semantic-request/2` con proyección positiva y trazable barrera → assessment → adherencia → medicationRefs. Matrix `/8` con Terra terminó `REJECT`; `/6` Sol y `/7` Terra permanecen `REJECT`. M6-D3B sigue **NOT CLOSED**; la preparación actual corresponde a D3R18 y matrix `/9`. No cambia el prompt D2 `/3`, la semántica clínica ni el progreso M6 46% / proyecto 49.37%. Validación offline: 2793 PASS / 25 SKIPPED; TypeScript y diff-check PASS.

## Alcance vigente

El milestone funcional activo es **M6 — Evaluación farmacéutica/PRM–RNM/adherencia**. M6-A aporta la referencia clínica farmacéutica canónica; M6-B cierra identidad, targets y evidencia; M6-C prepara el contexto determinista; M6-D1 y D2 aportan las adjudicaciones farmacéuticas. M6-D3 conserva como históricos `/1` `REJECT`, `/2`–`/3` `INCONCLUSIVE` y `/4`–`/13` `REJECT`. M6-D3B queda `OPEN / VALIDATION DEBT`; no se abrirá otra muestra o matrix sin una estrategia arquitectónica materialmente nueva. M6-E0 está auditado; E1 aporta contratos/validación estructural y E2 el [motor genérico de scoring](docs/v2/19_PHARMACEUTICAL_SCORING_CONTRACT.md); E3 compone el pipeline offline publicado, E4 define persistencia, P1 aporta contratos publicados y P2 añade el adaptador PostgreSQL local pendiente de revisión/publicación. Sigue sin configuración pedagógica productiva aprobada.

Responsabilidades aprobadas: M6 personalización/seguridad/seguimiento/informe/coherencia farmacéuticos; M7 comunicación; M8 cuestionario; M9 agregación/presentación; M10 interfaz de revisión; M1/M2/M3 versiones/autoría/casos aprobados. No se aprueban reglas clínicas ni pesos académicos. Las interfaces canónicas de E4 evitan dependencias circulares.

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
  └─ M6 Evaluación farmacéutica/PRM–RNM/adherencia [PARTIAL — A/B/C/D1/D2/D3A + refinamientos offline CLOSED; D3B VALIDATION DEBT; E1 CONTRACTS; E2 ENGINE; E3 OFFLINE INTEGRATION; E4 DESIGN; PED2 OPEN]
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

- M6: referencia clínica, identidad, targets, contexto y lanes D1/D2 completas; E1 contratos, E2 scoring genérico configuration-gated y E3 integración offline publicada; E4 diseño completo, P1 contratos publicados y P2 persistencia local pendiente de revisión/publicación; M6-D3B queda `OPEN / VALIDATION DEBT` tras `/13` `REJECT`; pendientes aprobación pedagógica/perfiles productivos, aceptación del entregable de persistencia e integración, sin crear automáticamente `/14`;
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
