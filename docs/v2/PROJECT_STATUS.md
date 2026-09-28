# ChatUSAL-FarmaBot v2 — Project Status

## Baseline oficial

- **Fecha del baseline:** 28 de agosto de 2026.
- **Commit funcional de referencia:** `3bae1167fef0f584a79a432edbcbc0a5e4a52ac6` (`Complete M6-D2 pharmaceutical claim adjudication`).
- **Progreso global actual:** **51.53%**, cierre técnico autorizado de Persistencia/lifecycle el 27 de septiembre de 2026, conforme al desglose M6 ya aprobado; baseline e históricos conservados.
- **Último checkpoint funcional publicado:** `40e97bdb51f8cc7f4dd180913734153b23b965db` (M6-P3). Recuperación independiente y restauración de dependencias verificadas; no despliegue ni activación académica.
- **M5:** **CLOSED / COMPLETE**.
- **Última suite completa confirmada:** **3314 PASS / 67 SKIPPED**, anterior al saneamiento final de errores P3 (7 live, 18 PG M5, 26 PG P2 y 16 PG P3 omitidos). PostgreSQL P3: **16/16**, también anterior a ese saneamiento. Evidencia histórica P2: 3286 PASS / 51 SKIPPED, 26/26 PG P2 y 18/18 PG M5; P1: 3274 PASS / 25 SKIPPED; E3: 3220 PASS / 25 SKIPPED.
- **P3 final:** **30/30 offline y TypeScript PASS**. No se ejecutan tests ni TypeScript en este cierre documental.

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
| M6 | Evaluación farmacéutica/PRM–RNM/adherencia | PARTIAL | 64% | 12% | 7.68% |
| M7 | Evaluación de comunicación | NOT STARTED | 0% | 7% | 0.00% |
| M8 | Cuestionario post-caso | NOT STARTED | 0% | 7% | 0.00% |
| M9 | Resultados y feedback | NOT STARTED | 0% | 5% | 0.00% |
| M10 | Analítica y revisión docente | NOT STARTED | 0% | 4% | 0.00% |
| M11 | Hardening y observabilidad final | NOT STARTED | 0% | 3% | 0.00% |
| **Total** |  |  |  | **100%** | **51.53%** |

## Regla estable de progreso

- Los pesos M0–M11 quedan fijos como baseline oficial.
- El porcentaje global aumenta conforme progresa cada milestone.
- El porcentaje global no debe disminuir mientras el alcance permanezca estable.
- Los pesos no se recalculan por el mero paso del tiempo o por reestimar esfuerzo.
- Cualquier recalibración exige documentar primero un cambio real y explícito de alcance.

### Excepción puntual aprobada — desglose interno M6

La regularización aprobada el 19 de septiembre completó la medición interna sin cambio de alcance:
conservó los 46 puntos acreditados y reconoció 10 por capacidad técnica conjunta E1/E2/E3.
El cierre técnico autorizado del 27 de septiembre acredita los 8 puntos existentes de Persistencia/lifecycle
por implementación y verificación P1–P3 completas. No cambia pesos ni alcance. La tabla refleja el estado
actual; **56% M6 / 50.57% global** fueron correctos antes de este cierre.
Son pesos de progreso del proyecto, NO de notas.

| Entregable M6 | Peso interno | Acreditado | Procedencia / gate pendiente |
|---|---:|---:|---|
| A — referencia clínica | 12 | 12 | Reconstrucción histórica ahora ratificada: checkpoint `58750a47e57e0b09dc06dba84495f5c0304e8ea0` registra M6 al 12% tras A |
| B — targets/evidencia | 12 | 12 | Existente: B1 4 + B2 8 |
| C — contexto | 10 | 10 | Existente |
| D — adjudicación/aceptación | 14 | 12 | Existente: D1A 3 + D1B 4 + D2A 2 + D2B 2 + D3A 1; D3B 2 pendiente |
| E — scoring | 16 | 10 | Nueva asignación: capacidad conjunta E1/E2/E3 10; configuración pedagógica real aprobada 6 pendiente |
| Personalización | 4 | 0 | Nueva asignación; criterios docentes y aceptación de adaptación individual |
| Seguridad de la actuación | 6 | 0 | Nueva asignación; criterios, evidencia y revisión de actuaciones críticas |
| Seguimiento | 4 | 0 | Nueva asignación; evaluar desempeño, no solo conservar episodios |
| Informe | 3 | 0 | Nueva asignación; captura/evaluación de informe, sin volver a puntuar targets B |
| Coherencia entrevista–conclusión | 5 | 0 | Nueva asignación; distinguir exploración, conclusión y acierto casual |
| Persistencia/lifecycle | 8 | 8 | CLOSED / TECHNICALLY COMPLETE; [criterios y evidencia P1–P3](21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md#cierre-técnico-del-entregable) y recuperación independiente verificada |
| Integración productiva del subresultado | 6 | 0 | Nueva asignación; fuentes/configuración autorizadas y entrega segura |
| **Total** | **100** | **64** | **36 pendientes** |

No doble cómputo: E3 permanece **NO INDEPENDENT WEIGHT**; constituye evidencia de composición del
entregable técnico padre E. E4 también carece de peso independiente. Ni reutilizar A/B/C/D ni completar
E4 suma otros puntos. P1/P2/P3 tampoco reciben pesos independientes: acreditan conjuntamente los
8 puntos del entregable existente de persistencia, una sola vez. Los futuros cierres
se acreditan por entregables aceptados, no tests, líneas ni esfuerzo; subdividir puntos pendientes requiere
registro previo. D3B conserva sus 2 puntos pendientes y el gate 100%, sin reclasificar matrices.

Cálculo actual: `12 + 12 + 10 + 12 + 10 + 8 = 64`; aporte M6 `12 × 0.64 = 7.68`;
otros milestones `43.85`; global `43.85 + 7.68 = 51.53%`.
Histórico previo correcto: `56`, aporte `6.72`, global `50.57%`; el cierre añade `0.96` puntos globales.

## Estado resumido de los milestones

### M0 — Saneamiento y barreras de seguridad

**Objetivo:** estabilizar v1 y establecer barreras de seguridad verificables para el trabajo v2.
**Estado:** **PARTIAL — 60%**.

Completado: baseline v1 reproducible; DTO público estudiantil por allowlist; retirada de la solución académica de fronteras estudiantiles; contratos factual/runtime; sesiones idempotentes y recuperables; ownership y cobertura de integración relevante.

Pendiente: TLS inseguro en `lib/db.ts`; restricción explícita `role=student`; identidad de actividad/grupo/intento; modelo general de roles/RLS; deuda de flujos Legacy/editoriales; README, configuración y CI. Véanse la [especificación de seguridad](09_SECURITY_PRIVACY.md) y el [diseño de sesiones](12_SESSION_IDEMPOTENCY_AND_RESUME_DESIGN.md).

Deuda de dependencias: npm notificó **13 vulnerabilidades** durante la restauración independiente
de P3 con scripts desactivados. Gravedad, aplicabilidad y remediación pendientes de clasificación;
no se asignan niveles de severidad en este registro. No se ejecutó `npm audit fix` ni se modificaron
dependencias. Véase la [evidencia de restauración](21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md#disponibilidad-de-implementación-comprobación-reproducible).

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
**Estado:** **PARTIAL — 64%**, tras el cierre técnico autorizado de Persistencia/lifecycle; no cambio de alcance.

Completado: M6-A, proyección clínica farmacéutica canónica; M6-B, identidad, targets y evidencia; M6-C, contexto determinista; M6-D1/D2, contratos, runtimes y adjudicación farmacéutica; M6-D3A y refinamientos offline hasta M6-D3R29. Matrix `/13` terminó `REJECT`: C3 ref 9 conservó literal, `UNSUPPORTED` y `RECOMMENDATION`, pero Terra clasificó `ADHERENCE` con C010 en vez de `PROFESSIONAL_RESPONSE` con C013. M6-D3R30 registra el resultado como deuda de validación sin alterar D1/D2 ni históricos. `UNSUPPORTED` significa únicamente no sustentado por la autoridad suministrada y queda como señal futura de revisión, nunca como falsedad, safety o penalización automática. Los informes históricos siguen siendo válidos, pero no reciben IDs ni targets de contenido sintéticos.

Subdivisión fija de M6-B dentro del milestone: M6-B1 = 4% (CLOSED) y M6-B2 = 8% (CLOSED). **M6-B = CLOSED / COMPLETE**.

M6-C = 10% del milestone. **M6-C = CLOSED / COMPLETE**.

Subdivisión fija de M6-D dentro del milestone: M6-D1A = 3% (CLOSED), M6-D1B = 4% (CLOSED), M6-D2A = 2% (CLOSED), M6-D2B = 2% (CLOSED), M6-D3A = 1% (CLOSED) y M6-D3B = 2% (**OPEN / VALIDATION DEBT**, no completado). **M6-D1 = CLOSED / COMPLETE. M6-D2 = CLOSED / COMPLETE. M6-D3 = PARTIAL. M6-D = PARTIAL**.

**Deuda M6-D3B — pharmaceutical semantic live acceptance.** Estado: **OPEN / VALIDATION DEBT**. Blocker: clasificación semántica/provenance estocástica frente a un gate exacto del 100%. Última matrix: `/13`, históricamente **REJECT** por C3 ref 9 (`ADHERENCE` + C010 observados frente a `PROFESSIONAL_RESPONSE` + C013 esperados). No existe un defecto contractual claro, pequeño y demostrable; se pausa toda iteración adicional y no se crea `/14`. Solo debe reabrirse ante una estrategia arquitectónica nueva: mayor determinismo server-side, menos decisiones delegadas al LLM, nueva estrategia de adjudicación semántica o un modelo/configuración materialmente distintos; nunca para probar otra muestra equivalente.

Impacto: la deuda impide cerrar el evaluador semántico farmacéutico D2 y mantiene M6-D3/M6-D `PARTIAL`. No implica un fallo general del chat del paciente, controles de rol, anti-hallucination, M5 SPFA ni módulos independientes ya cerrados. El gate 100% permanece intacto. M6-E0: **AUDIT COMPLETED**. M6-E1: **CLOSED / COMPLETE**, contratos y validación estructural únicamente, independiente de D3B live. M6-E1F1: **COMPLETE**; `STRUCTURAL_ONLY` no reconstruye possible/earned/normalizedScore. E1 sigue cubierto por 156/156 tests. El cálculo queda exclusivamente en E2.

M6-E2: **CLOSED / COMPLETE**. Scoring engine: **IMPLEMENTED / CONFIGURATION-GATED**. Motor genérico puro: configuración aprobada y fuentes revalidadas E1, D1 como única fuente de crédito, D2 review-only, pesos BigInt/fracciones exactas y rounding final explícito. Deuda upstream o revisión producen resultado provisional calculable, sin penalización numérica. Es el subscore de demostración sobre objetivos canónicos, no una evaluación farmacéutica integral ni una nota académica productiva integrada.

Configuración pedagógica: **REQUIRED / NOT YET APPROVED**. Production pedagogical profiles: **NOT APPROVED / NOT INSTALLED**. PED1/PED2A: **AUDIT COMPLETED**; PED2: **OPEN / NOT FROZEN / TEACHER APPROVAL REQUIRED**. No hay pesos clínicos, planes reales ni thresholds por defecto; el motor exige plan/weights/rounding aprobados y NO_THRESHOLDS explícito. El coverage profile queda para interpretación/comparabilidad académica y no requiere ampliar schemas para calcular.

Validación E2: 98/98 scorer, 156/156 contratos E1, 142/142 regresiones D1 y 228/228 D2; suite **3185 PASS / 25 SKIPPED** (7 live + 18 PostgreSQL omitidos), TypeScript `--incremental false` y diff-check PASS; cero live/OpenAI/DB. No se modifica la deuda D3B ni los históricos. M6 **46%** / proyecto **49.37%** sin cambios: PLAN no asigna ponderación independiente a E2. Véanse el [contrato y motor de scoring farmacéutico](19_PHARMACEUTICAL_SCORING_CONTRACT.md), el [modelo de evaluación](04_EVALUATION_MODEL.md) y el [registro live](18_PHARMACEUTICAL_SEMANTIC_LIVE_ACCEPTANCE.md).

M6-E3 — **CLOSED / COMPLETE — OFFLINE INTEGRATION COMPLETE**, publicado en Git mediante
`11e10724b8ca1032c29edf6f85553e28395ab62b`, sin despliegue ni activación académica. **NO INDEPENDENT WEIGHT**. M6-E global **PARTIAL**; PED2 abierto y perfiles productivos
no aprobados/no instalados; D3B **OPEN / VALIDATION DEBT**. Pipeline real con dependencias falsas:
35/35 E3, 500/500 selección relacionada, suite 3220 PASS / 25 SKIPPED; TypeScript y diff-check PASS.
Al cierre original de E3: M6 46% / proyecto 49.37%; la regularización aprobada posterior reconoce
M6 **56%** / proyecto **50.57%**, estado histórico anterior al cierre de Persistencia/lifecycle.
Véase [M6-E3](20_PHARMACEUTICAL_SESSION_PIPELINE.md).

M6-E4 — **DESIGN COMPLETE**, documental, **NO INDEPENDENT WEIGHT**. [Diseño de persistencia y reutilización](21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md).
E4 no añade progreso independiente. P1–P3 publicados y verificados sustentan el cierre técnico autorizado
del entregable existente de Persistencia/lifecycle; la integración productiva permanece pendiente.

M6-P1 — **COMPLETE / PUBLISHED IN GIT**, checkpoint `66d3e22074d31bc2ad35af08d98bda04c1bd5020`.
Contratos operacionales internos, manifest e intención versionados, artefactos resueltos offline y lifecycle
puro con idempotencia, lease/fencing, historial y reevaluación sin overwrite. Reutiliza resultado/receipt E3;
no archiva testigos/prompts/raw ni calcula scores. La lectura comprueba estructura, bindings e integridad,
no autenticidad del escritor ni replay completo. Ownership y supersedes no son autorización.
54/54 P1; selección relacionada 610/610; suite **3274 PASS / 25 SKIPPED** (7 live y 18 PostgreSQL omitidos);
TypeScript `--noEmit --incremental false` y diff-check PASS. Cero OpenAI/live/DB.
P1 por sí solo no demostró CAS/atomicidad PostgreSQL ni autenticación. Retención e integración productiva siguen pendientes. En el checkpoint P1 no se acreditaron
los 8 puntos de persistencia: histórico **M6 56% / proyecto 50.57%**. M6/M6-E PARTIAL, PED2 abierto,
perfiles productivos no aprobados/no instalados y D3B OPEN / VALIDATION DEBT. No se inicia otro incremento.

M6-P2 — **COMPLETE / PUBLISHED IN GIT**, checkpoint `79c030ba08bdcfb70579c9668a966e0d5f0ef225`, no desplegado; incremento bajo persistencia sin peso independiente.
Migración aditiva 0004 y adaptador server-only con dependencia DB explícita: intención/idempotencia,
historia, fuentes/resultados, ownership real de sesión, locks/CAS, lease server-owned, completion atómica,
fallo y expiración/claim sin adjudicación. P1/E3, scoring y aceptación semántica preservados.
PostgreSQL real local: **26/26 P2**, regresión M5 **8/8 G3 + 10/10 G4**, en contenedores desechables
verificados, no bases de aplicación. Selección offline inicial **443/443**; P2 final **12/12 offline**,
suite **3286 PASS / 51 SKIPPED**, TypeScript `--noEmit --incremental false` y diff-check PASS.
Publicado en Git, no desplegado. No API, OpenAI/live ni activación académica; no replay completo,
archivo de testigos ni política de retención productiva. Los criterios satisfechos y pendientes constan
en [E4/P2](21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md#m6-p2--adaptador-postgresql-local).
En el checkpoint P2 **no se acreditaron los 8 puntos**: histórico M6 **56%**, proyecto **50.57%**; M6/M6-E PARTIAL,
PED2 abierto y D3B OPEN / VALIDATION DEBT intactos.

M6-P3 — **COMPLETE / PUBLISHED IN GIT**, checkpoint `40e97bdb51f8cc7f4dd180913734153b23b965db`, sin peso independiente.
Captura server-only de sesión finalizada y transcript M5 congelado verificado contra mensajes persistidos;
proyecciones canónicas y coordinación create/claim/E3/complete/read usando las fuentes recuperadas de P2.
Sin cierres de sesión implícitos, reintentos semánticos, nuevos perfiles, cambios D1/D2 ni migraciones.
Evidencia anterior al saneamiento final: offline P3 **28/28**, selección relacionada **383/383**, PostgreSQL P3 **16/16** en base exclusiva
desechable y suite **3314 PASS / 67 SKIPPED**. Revisión final: saneamiento de errores de entrada,
**30/30 offline P3** y TypeScript PASS; no se repiten suite completa ni PostgreSQL por este ajuste.
Publicación fast-forward y recuperación independiente desde el remoto verificadas: commit y árbol
`bf045f53ba7f4fe03c3eb21209990b448f10abac`; `git cat-file` y `git fsck --full` PASS.
Node 20.19.4 / npm 10.8.2; `npm ci --ignore-scripts` correcto, 219 paquetes, sin errores de integridad
ni cambios versionados. Blobs y límites constan en la [evidencia de disponibilidad](21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md#disponibilidad-de-implementación-comprobación-reproducible).
No confundir lectura íntegra con replay completo. Criterios y límites en [E4/P3](21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md#m6-p3--captura-congelada-y-coordinación-e3p2).
**Persistencia y lifecycle farmacéutico — CLOSED / TECHNICALLY COMPLETE**, cierre documental autorizado
el 27 de septiembre de 2026: P1 contratos/lifecycle, P2 persistencia/integridad/ownership/concurrencia,
P3 captura consistente/E3 desde fuentes persistidas y recuperación del código/dependencias satisfechos.
Se acreditan **8/8** del entregable existente: **M6 64% / proyecto 51.53%**, sin doble cómputo.
El checkpoint y su publicación mantuvieron correctamente **56% / 50.57%** hasta esta aceptación.
M6/M6-E siguen **PARTIAL**; PED2 abierto, perfiles productivos no aprobados, D3B **OPEN / VALIDATION DEBT**.
Pendientes integración productiva, permisos de reevaluación/publicación y retención/supresión.
Replay completo y archivo de testigos quedan fuera del alcance autorizado. Este cierre no certifica
build completo, despliegue, roles productivos ni reproducibilidad semántica; no inicia otro incremento.

Responsabilidades aprobadas: M6 evalúa personalización, seguridad, seguimiento, informe y coherencia;
M7 calidad comunicativa; M8 cuestionario/captura; M9 agregación/presentación; M10 interfaz de revisión/override;
M1/M2/M3 versiones, autoría y casos aprobados. Interfaces e invariantes en E4; no se aprueban rúbricas,
perfiles, pesos académicos, penalizaciones ni reglas clínicas nuevas.

M6-COV1 — **IMPLEMENTADO / REVISADO OFFLINE**, checkpoint local, no publicado.
La aprobación docente de las cinco capacidades está registrada en [PLAN](../../PLAN.md#aprobación-docente-de-cobertura--27-de-septiembre-de-2026);
solo informe se implementa en este incremento. [Contrato y alcance COV1](22_REFERRAL_REPORT_OFFLINE_EVALUATION.md):
entrega escrita identificable, evaluación por requisitos existentes y fuentes disponibles con runtime
semántico explícito, citas/bindings verificados y resultados solo para revisión docente. Validación
estructural offline no equivale a aceptación semántica ni integración productiva. Faltan
validación semántica docente y acuerdo explícito de cierre del entregable; no se acreditan los 3 puntos
de Informe. **M6 64% / proyecto 51.53%**, M6/M6-E PARTIAL, PED2 abierto, perfiles no aprobados,
D3B OPEN / VALIDATION DEBT. Integración, permisos y retención/supresión pendientes.

Evidencia anterior COV1 (27 de septiembre, antes de corregir el ejemplo y ampliar tests): **39/39** nuevos; selección relacionada **287/287** (incluye COV1);
suite offline completa **3355 PASS / 67 SKIPPED**, ejecutada una vez con live/DB desactivados;
TypeScript y diff-check **PASS**. Lint no completado: falta configuración ESLint y Next solicita
configurarla; no se modifica configuración. Detalle y límites en el documento COV1 enlazado arriba.

Revisión focalizada del 28 de septiembre: ejemplo corregido a «Refiere mareo», límites de exhaustividad
y validez semántica de citas explícitos, aislamiento asíncrono comprobado. Checks nuevos: **43/43 COV1**,
TypeScript y ambos diff-check **PASS**. Implementación sin cambios; suite completa anterior reutilizada,
no repetida. Aceptación semántica pendiente y cero puntos nuevos acreditados.

M6-COV2 — **IMPLEMENTADO / REVISADO OFFLINE**, checkpoint local, no publicado.
[Plan de seguimiento](23_FOLLOW_UP_PLAN_OFFLINE_EVALUATION.md): requisitos explícitos identificados,
entrevista completa como fuente inicial, adjudicación semántica inyectada y citas/secuencia verificadas.
Intención genérica, plan concretado, ausencia, captura incompleta/fallida e incertidumbre diferenciadas.
No se exige evolución longitudinal ni se imponen plazos universales; `FollowUpEpisode` no acredita
desempeño del alumno. Se reutilizan contratos COV1/M5 sin cambiarlos. Sin integración con E2;
D2 sigue review-only. Validación estructural offline no acredita calidad semántica del modelo.
Pendientes aceptación semántica docente y acuerdo explícito de cierre de Seguimiento:
**0/4 puntos**, sin cambios de M6 **64%** / proyecto **51.53%**, M6/M6-E PARTIAL,
PED2 abierto, perfiles productivos no aprobados y D3B OPEN / VALIDATION DEBT.
Integración productiva, autorizaciones y retención pendientes; COV1 mantiene su aceptación semántica pendiente.

Evidencia anterior COV2 (28 de septiembre, antes de la revisión): **47/47** tests nuevos, **169/169** con regresiones
COV1/M5 (incluye los 47), TypeScript y diff-check **PASS**. Suite offline completa ejecutada una vez:
**3406 PASS / 67 SKIPPED**, con live/PostgreSQL desactivados. No se configura ni ejecuta ESLint,
no build/despliegue. No se presenta evidencia histórica como ejecución sobre COV2.

Revisión focalizada COV2: instrucciones `/2` distinguen autoría/adopción/cita y evitan exigir la
composición de fragmentos incompatibles o retirados; una forma temporal observada debe citar al alumno.
Checks nuevos: **54/54 COV2**, TypeScript y ambos diff-check **PASS**. Evidencia 47/47, 169/169 y
3406/67 conservada como anterior, sin repetir suite completa ni atribuirla a la corrección. La detección
semántica real sigue pendiente; seguimiento **0/4**, sin puntos nuevos ni cambios de alcance productivo.

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

En E3 se corrigió la fila «Actual» obsoleta de 49.25% a 49.37%; no era un snapshot histórico.
La regularización interna aprobada posterior la actualizó a 50.57%; el cierre técnico de
Persistencia/lifecycle la actualiza a 51.53%. Las proyecciones de cierre y los registros históricos se conservan.

| Punto de la ruta | Progreso global proyectado |
|---|---:|
| Actual | 51.53% |
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
