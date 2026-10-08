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

Diagnóstico separado R2 (8 de octubre): entrada restringida implementada; un conteo actualizado y
una inferencia, detenida con `cov-diagnostic/1: VALIDATION / REPORT_CITATION_INVALID`.
Diario original intacto; ninguna repetición ni otros ejemplos. Reserva acumulada 0,305740 USD,
coste calculado de tres inferencias 0,0357923 USD; trece conteos y total facturado desconocidos.
83/83 pruebas offline, TypeScript y diff-check. Sin cambio de expectativas ni aceptación semántica.
Detalle actual y evidencia histórica en [documento 25](docs/v2/25_COV_SEMANTIC_CALIBRATION.md).

Primer lote COV (6 de octubre de 2026): controles publicados en `04776b25fd8df1f1005b011e05c46e61052e626f`.
Autorización ampliada a **15 EUR totales**, con aceptación expresa de tarifa desconocida de los doce
conteos. **STOPPED_TECHNICAL_FAILURE**: doce conteos confirmados; dos inferencias enviadas (R1
válida, R2 `INVALID_ADJUDICATION`), diez omitidas, sin reintentos. Coste de inferencias calculado
0,0212198 USD; coste de conteos y total facturado desconocidos. Reserva duradera 0,203830 USD;
sin inferencias de uso perdido. El sublímite operativo de inferencias fue 2 USD; no se debilitó el control.
Detalle de conversión, márgenes y resultados en [documento 25](docs/v2/25_COV_SEMANTIC_CALIBRATION.md).
Revisión offline posterior de R2: regla original indeterminada por falta de diagnóstico conservado.
Se añade `cov-diagnostic/1` con categorías cerradas, sin relajar validación, y se corrige la pérdida
del request ID no enumerable del SDK. Proyecciones/expectativas intactas; ninguna llamada nueva.
El diagnóstico separado de R2 queda preparado documentalmente, sin reiniciar el lote fallido.

Aceptación COV1–COV3 — PREPARACIÓN IMPLEMENTADA Y VERIFICADA OFFLINE: criterios docentes ratificados en conversación,
desempeño histórico separado de vigencia, fixtures de calibración, adaptadores reales con transporte
simulado y runner seco por defecto. Live bloqueado sin autorización de modelo/presupuesto; el primer
intento autorizado está detenido y no debe repetirse. Sin migraciones, dependencias ni efectos productivos. Personalización 0/4,
M6 64%, proyecto 51.53%; M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT.
Open decisions: aceptación semántica real pendiente; modelo y presupuesto de este lote aprobados. No se
reabre la decisión aprobada de conservar desempeño histórico ni se reinterpreta evidencia anterior.
[Materiales, versiones, límites y primer lote](docs/v2/25_COV_SEMANTIC_CALIBRATION.md): 33 variantes,
27 solicitudes potenciales, seis resoluciones sin proveedor; runner seco por defecto y live bloqueado.
Evidencia histórica de preparación: 189 focalizados, TypeScript PASS, suite offline 3505 PASS / 67 SKIPPED.

M6-COV3 — **IMPLEMENTADO / REVISADO OFFLINE**: personalización vinculada a circunstancias conocidas, adaptación concreta, comprobación de viabilidad y atención a dificultades/rechazo cuando existan. No exige aceptación del paciente ni equipara barrera identificada con adaptación; estilo comunicativo reservado a M7. [Contrato, ejemplo, evidencia y límites](docs/v2/24_PERSONALIZATION_OFFLINE_EVALUATION.md). Contratos mínimos versionados de requisitos y cadenas de evidencia, con secuencia temporal y runtime falso explícito. Sin refactorización, migraciones, dependencias, scoring ni cambios funcionales en COV1/COV2, M5, D1/D2 o E2. Checkpoint local COV3, no publicado; revisión focalizada con 62/62 tests y TypeScript PASS, evidencia anterior conservada. Open decisions: aceptación semántica e integración productiva pendientes; ninguna decisión docente adicional bloquea el recorrido sintético. Personalización 0/4, M6 64%, proyecto 51.53%, M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT.

M6-COV2 — **IMPLEMENTADO / REVISADO OFFLINE**: plan de seguimiento expresado en la entrevista, evaluado únicamente frente a elementos explícitos del caso aprobado. [Contrato, ejemplo y límites](docs/v2/23_FOLLOW_UP_PLAN_OFFLINE_EVALUATION.md). Contrato mínimo separado para requisitos identificados y evaluación, sin inferir requisitos desde `FollowUpEpisode`, sin resultados longitudinales, scoring ni plazos universales. Se reutilizan validadores de binding/citas de COV1 y el snapshot M5 sin modificarlos. Sin migraciones, persistencia, endpoints, dependencias ni configuración productiva nueva; checkpoint local, no publicado. Open decisions: aceptación semántica e integración autorizada pendientes; ninguna decisión docente adicional bloquea el recorrido sintético. M6 64% / proyecto 51.53%, M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT. Los cuatro puntos existentes de Seguimiento no se acreditan automáticamente.

M6-COV1 — **IMPLEMENTADO / REVISADO OFFLINE**, autorizado tras M6-COV0: entrega escrita de informe de derivación separada de la entrevista, vinculada a sesión/caso/transcript; cobertura y fidelidad adjudicadas mediante dependencia explícita, sin scoring. [Contrato, ejemplo y límites](docs/v2/22_REFERRAL_REPORT_OFFLINE_EVALUATION.md). Solo contrato mínimo de entrega/evaluación y pruebas sintéticas; sin migraciones, dependencias nuevas ni cambios de M5/D1/D2/E2. Checkpoint local, no publicado. M6 64% / proyecto 51.53% se mantienen; los 3 puntos de informe no se acreditan automáticamente. Aceptación semántica pendiente.

### Aprobación docente de cobertura — 27 de septiembre de 2026

- Personalización: adaptación a circunstancias conocidas y comprobación de viabilidad, sin exigir aceptación del paciente.
- Seguridad: criterios explícitos del caso y evidencia para revisión; D2 no autoriza penalizaciones automáticas.
- Seguimiento: plan propuesto y elementos exigibles por caso, no resultados futuros.
- Informe: entrega de derivación efectivamente escrita cuando sea aplicable; contenido requerido y fidelidad a información disponible.
- Coherencia: conclusión final identificada y justificada frente a entrevista, conservando contradicciones y rectificaciones.

Esta aprobación no fija pesos, umbrales ni perfiles productivos. Solo informe se implementa en COV1. Open decisions: aceptación semántica real del nuevo adjudicador y futura captura autorizada M8/integración/revisión M9–M10; no bloquean el recorrido offline con runtimes falsos. PED2 abierto, D3B OPEN / VALIDATION DEBT, M6/M6-E PARTIAL.

**Persistencia y lifecycle farmacéutico — CLOSED / TECHNICALLY COMPLETE**, cierre documental autorizado el 27 de septiembre de 2026. P1–P3 implementados, publicados y verificados; se acreditan los 8 puntos del entregable existente, sin pesos independientes ni doble cómputo. Criterios, evidencias y límites en el [registro de cierre E4/P1–P3](docs/v2/21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md#cierre-técnico-del-entregable). No se inicia otro incremento.

M6-P3 — **COMPLETE / PUBLISHED IN GIT**, checkpoint `40e97bdb51f8cc7f4dd180913734153b23b965db`: captura consistente del transcript M5 y coordinación E3/P2 desde fuentes persistidas, sin cierres/reaperturas de sesión ni reintentos semánticos automáticos. P3 final: **30/30 offline y TypeScript PASS**. Evidencia anterior al saneamiento final de errores: 28/28 P3, 383/383 relacionados, **16/16 PostgreSQL P3** y **3314 PASS / 67 SKIPPED**; no se afirma una ejecución posterior de PostgreSQL o suite completa. Recuperación independiente del commit publicado y restauración mediante `npm ci --ignore-scripts` verificadas; [objetos Git, blobs y versiones](docs/v2/21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md#disponibilidad-de-implementación-comprobación-reproducible). No se atribuye P3 al SHA P2.

M6-P2 — **COMPLETE / PUBLISHED IN GIT**, checkpoint `79c030ba08bdcfb70579c9668a966e0d5f0ef225`, no desplegado; incremento de persistencia sin peso independiente. Adaptador `pharmaceutical-evaluation-postgres.ts` con conexión explícita y migración aditiva `0004_v2_pharmaceutical_evaluation_persistence.sql`: evaluaciones, intentos y artefactos separados; creación idempotente, lectura validada, claim, completion, fail y expiración/recuperación explícita. Sin cambios de tablas ni semántica M5.
Ownership se comprueba contra la sesión en DB; identidad autenticada y autorización de reevaluación proceden del llamador server-owned. Tiempo PostgreSQL posterior a bloqueos y control de lease en la escritura; resultados/históricos inmutables y transacción atómica. Artefactos `json` preservan la serialización sensible al orden de fingerprints D1 existentes; metadata operacional `jsonb` con concordancia SQL/P1. No cambia ningún hash ni contrato anterior.
Evidencia real local: **26/26 PostgreSQL P2**, **8/8 M5-G3 + 10/10 M5-G4**, con migraciones 0001–0004 en contenedores exclusivos verificados. Offline: **12/12 P2**, selección inicial **443/443**, suite final **3286 PASS / 51 SKIPPED**, TypeScript `--noEmit --incremental false` y diff-check PASS. Los skipped incluyen 26 PG P2, 18 PG M5 y 7 live; PG se validó aparte, no OpenAI. Detalle y criterios pendientes en [E4/P2](docs/v2/21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md#m6-p2--adaptador-postgresql-local).
Histórico del checkpoint P2: sin API, ejecución semántica, publicación académica ni replay completo; freeze/E3 y aceptación del entregable seguían pendientes, por lo que **56% / 50.57%** eran correctos. P3 y su recuperación cierran ahora las garantías técnicas; permisos productivos y retención permanecen pendientes.

M6-P1 — **COMPLETE / PUBLISHED IN GIT** (`66d3e22074d31bc2ad35af08d98bda04c1bd5020`), contratos puros de registro/lifecycle bajo persistencia, sin peso independiente; no despliegue.
Intención/idempotencia, manifest obligatorio, resolutor offline de artefactos, validación estructural/integridad y transiciones con lease/fencing; composición real E3 con runtimes falsos. No recalcula scores ni reconstruye provider responses.
Evidencia local: 54/54 P1; selección relacionada 610/610; suite 3274 PASS / 25 SKIPPED; TypeScript `--noEmit --incremental false` y diff-check PASS. Live/DB desactivados.
P1 no modificó M5 ni APIs E3 y no implementó persistencia; P2 añadió la frontera PostgreSQL. P1 no acreditó por sí solo los 8 puntos. Retención e integración productiva siguen pendientes; replay completo y archivo de testigos están fuera del alcance autorizado.

Estado actual: M6 **PARTIAL — 64%** / proyecto **51.53%**, según la [medición canónica de PROJECT_STATUS](docs/v2/PROJECT_STATUS.md#excepción-puntual-aprobada--desglose-interno-m6). El histórico **56% / 50.57%** era correcto antes del cierre de Persistencia/lifecycle; no cambian alcance ni pesos. M6-E sigue PARTIAL; PED2 abierto y perfiles productivos no aprobados/no instalados; D3B OPEN / VALIDATION DEBT. Integración productiva, permisos de reevaluación/publicación y retención/supresión pendientes. El cierre no certifica build completo, despliegue, roles productivos ni reproducibilidad semántica.

M6-E4 — **DESIGN COMPLETE / NO INDEPENDENT WEIGHT**. [Persistencia y reutilización](docs/v2/21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md). P1/P2/P3 tampoco reciben pesos independientes: su evidencia conjunta acredita una sola vez el entregable existente de 8 puntos.

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

El milestone funcional activo es **M6 — Evaluación farmacéutica/PRM–RNM/adherencia**. M6-A aporta la referencia clínica farmacéutica canónica; M6-B cierra identidad, targets y evidencia; M6-C prepara el contexto determinista; M6-D1 y D2 aportan las adjudicaciones farmacéuticas. M6-D3 conserva como históricos `/1` `REJECT`, `/2`–`/3` `INCONCLUSIVE` y `/4`–`/13` `REJECT`. M6-D3B queda `OPEN / VALIDATION DEBT`; no se abrirá otra muestra o matrix sin una estrategia arquitectónica materialmente nueva. M6-E0 está auditado; E1 aporta contratos/validación estructural y E2 el [motor genérico de scoring](docs/v2/19_PHARMACEUTICAL_SCORING_CONTRACT.md); E3 compone el pipeline offline publicado, E4 define persistencia y P1–P3 publicados/verificados completan técnicamente Persistencia/lifecycle. Sigue sin configuración pedagógica productiva aprobada ni integración productiva.

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
  └─ M6 Evaluación farmacéutica/PRM–RNM/adherencia [PARTIAL — A/B/C/D1/D2/D3A + refinamientos offline CLOSED; D3B VALIDATION DEBT; E1 CONTRACTS; E2 ENGINE; E3 OFFLINE INTEGRATION; E4 DESIGN; P1–P3 PERSISTENCE COMPLETE; PED2 OPEN]
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
- clasificar gravedad, aplicabilidad y remediación de las **13 vulnerabilidades** notificadas por npm durante la restauración P3; registro canónico de esta deuda en [M0](docs/v2/PROJECT_STATUS.md#m0--saneamiento-y-barreras-de-seguridad), sin asignar severidades ni cambiar dependencias;
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

- M6: referencia clínica, identidad, targets, contexto y lanes D1/D2 completas; E1 contratos, E2 scoring genérico configuration-gated y E3 integración offline publicada; E4 diseño completo y Persistencia/lifecycle técnicamente cerrado con P1–P3 publicados/verificados; M6-D3B queda `OPEN / VALIDATION DEBT` tras `/13` `REJECT`; pendientes aprobación pedagógica/perfiles productivos, integración productiva y permisos/políticas operativas, sin crear automáticamente `/14`;
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
