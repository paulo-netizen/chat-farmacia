# M6-E4 — Persistencia farmacéutica y reutilización

## Estado y frontera

**DESIGN COMPLETE — NO INDEPENDENT WEIGHT**. Entregable **Persistencia y lifecycle farmacéutico — CLOSED / TECHNICALLY COMPLETE**, cierre autorizado el 27 de septiembre de 2026 con P1–P3 implementados, publicados y verificados. Sin integración académica productiva ni despliegue.
Diseño documental sobre E3 publicado en `11e10724b8ca1032c29edf6f85553e28395ab62b`.
No implica despliegue, aprobación pedagógica ni aceptación semántica. M6/M6-E siguen PARTIAL;
PED2 abierto; perfiles productivos no aprobados/no instalados; D3B OPEN / VALIDATION DEBT.
La [medición canónica](PROJECT_STATUS.md#excepción-puntual-aprobada--desglose-interno-m6)
acredita los 8 puntos existentes de persistencia una sola vez: **64% M6 / 51.53% global**.
P1/P2/P3 no reciben pesos independientes. **56% / 50.57%** eran correctos antes de este cierre;
los registros P1/P2 siguientes conservan sus límites y pendientes históricos, resueltos técnicamente
según el [registro final de cierre](#cierre-técnico-del-entregable).

## 1. Reutilización y datos conservados

Se conservará por valor la salida existente de `evaluate-pharmaceutical-session.ts`: `{ d1, d2, score }`.
No se crea otro contrato clínico de resultado ni se copia el esquema SPFA. Se reutilizan los contratos
D1/D2 y `PharmaceuticalSessionScoreV2` (`result`, `fingerprint`, `receipt`) de
`pharmaceutical-scoring-types.ts`. El receipt sigue siendo STRUCTURAL_ONLY; no demuestra aceptación live.

| Artefacto protegido | Conservación elegida | Motivo |
|---|---|---|
| Resultado E3, adjudicaciones canónicas y execution metadata | Por valor, inmutable al completar | Lectura histórica sin llamadas ni reconstrucción del provider |
| Transcript, configuración policy/plan/weights/thresholds/rounding | Por valor, con sus contratos/fingerprints existentes | Congelar exactamente las fuentes usadas, no consultar la configuración vigente |
| `contextSource` y `context` usados por E3 | Por valor en almacén de fuentes server-only | Mantener referencia clínica, targets, expectations, candidatos y patient runtime efectivamente usados sin depender de builders futuros |
| Sesión y versión de caso | Referencias inmutables, además de las proyecciones anteriores | Ownership y trazabilidad; FK/retención impiden perder la versión mientras exista el registro |
| Implementación de cálculo, builders y adjudicación | Referencia a versión de aplicación/commit y manifest de ejecución | Distinguir versiones de algoritmo de las versiones de datos; conservar artefacto de release para investigación |

El almacén de fuentes puede deduplicar bytes canónicos por fingerprint y versión, pero no eliminar
un artefacto referenciado. No es un nuevo snapshot clínico: conserva instancias de contratos existentes.
Las copias derivadas se justifican por reproducibilidad, no sustituyen las fuentes canónicas.
Toda lectura exige presencia y hash correcto; nunca resolver a `latest` ni regenerar silenciosamente.
La retención/eliminación de datos personales deberá concretarse antes del uso productivo, sin retención
indefinida implícita. La supresión autorizada debe invalidar explícitamente disponibilidad, no fingir reproducibilidad.

La única estructura nueva será un **registro operacional/manifest**: evaluationId, attemptId,
owner/session/caseVersion, intent/idempotency key, source/result artifact refs, estado, tiempos,
lease/fencing y versiones de ejecución. Es necesaria para concurrencia, identidad e integridad;
no redefine finding, verdict, score, receipt ni clinical truth.

Metadata nueva a capturar server-side: identidad de evaluación/intento, tiempos, modelo solicitado,
parámetros efectivos y versiones de runtime/provider SDK/aplicación/scorer. E3 ya entrega metadata
semántica con responseModel, promptVersion, requestFingerprint y referencias de ejecución, pero no
todo ese manifest. No inferir el modelo solicitado a partir de responseModel ni inventar metadata histórica.
Ausencias obligatorias en registros nuevos fallan; cualquier importación histórica requeriría contrato explícito.

## 2. Garantías y límites

| Garantía | Diseño / límite verificable |
|---|---|
| Integridad almacenada | Hash versionado de bytes canónicos, fuentes y bindings; no incluir el propio hash en su preimagen. No prueba autenticidad frente a quien pueda reescribir datos y hash: requiere escritor autorizado, aislamiento y auditoría |
| Validación estructural de lectura | Versiones conocidas, shape estricto, números/status válidos, referencias y fingerprints concordantes. No recalcular puntuaciones en el validador E1 |
| Reproducción determinista | Fuentes/configuración y resultado quedan conservados para auditoría. **No se promete replay con las APIs actuales**: E2 revalida usando fuentes/testigos completos que no están en la salida E3 |
| Revalidación de adjudicaciones | Validación completa durante creación mientras existen los testigos; posteriormente no es reproducible íntegramente sin ellos. La lectura estructural no equivale a repetir E1 contra el provider |
| Nueva ejecución semántica | Otro intento autorizado, potencialmente distinto; nunca reconstruir respuestas ni sobrescribir el resultado anterior |

`build-pharmaceutical-score-input.ts` requiere accepted batches D1 y request/providerResult D2;
`calculate-pharmaceutical-session-score.ts` vuelve a validar esas fuentes. E3 no serializa esos testigos
ni el score input completo. No se reconstruirán desde el receipt. El manifest identifica la validación
realizada al crear, sin elevar `semanticAcceptance` ni convertir deuda en aceptación.

El baseline de almacenamiento **excluye raw responses, prompts y testigos**. Si se desea replay pleno,
queda pendiente una autorización separada de archivo protegido de testigos exactos (incluido input
efectivamente calculado), con propósito, acceso restringido a auditoría, cifrado, retención y borrado.
Alternativamente requeriría diseñar una frontera de replay confiable específica; no está implementada
ni autorizada aquí. Ninguna opción cambia la salida orientada al cliente ni justifica reconstruir provider outputs.
Esta decisión no bloquea contratos puros del registro, pero sí una promesa futura de replay completo.

## 3. Persistencia y lifecycle elegidos

Se define almacenamiento PostgreSQL separado: evaluaciones lógicas, intentos y artefactos protegidos.
P2 concreta sus tablas en la migración 0004 (sección de implementación al final).
Reutilizar de M5 transacciones, freeze, lease, compare-and-swap y recuperación; **no reutilizar su tabla**:
`session_evaluation_records_v2` es SPFA-specific y UNIQUE(session_id), incompatible con historial farmacéutico
de reevaluaciones. No alterar M5 ni su migration 0003.

1. **Identidad e idempotencia.** IDs server-owned; una intención explícita vincula sesión, versión,
   transcript, fuentes/configuración, D2 solicitado/no solicitado, semanticAcceptance server-owned y
   manifest efectivo de ejecución. Clave idempotente única por sesión/owner e intención; reutilizarla
   con digest distinto produce conflicto, nunca sustituye fuentes. El digest operacional incluye modelo
   y parámetros sin alterar request fingerprints D1/D2, que mantienen sus contratos actuales.
2. **Freeze.** Antes de ejecutar, autorizar ownership y fijar fuentes inmutables. Capturar las mismas
   copias usadas por la evaluación, no volver a leer entradas mutables después de await. La conexión
   con E3 implementada por P3 preserva sus APIs y evita una segunda llamada para obtener metadata/testigos.
3. **Claim/concurrencia.** Transacción y CAS crean un intento EVALUATING con fencing token creciente,
   start y lease expiry. Solo el titular vigente puede completar. Unique constraints más CAS evitan
   dos completions de una intención; un worker obsoleto no puede publicar.
4. **Completion.** Tras validación, almacenar fuentes/resultado/manifest y estado COMPLETED atómicamente.
   Payload completado inmutable. Un score provisional o NOT_SCORABLE puede ser ejecución completada;
   no implica nota académica publicable. Revisión docente se registraría aparte, sin reescribir originales.
5. **Fallo.** FAILED conserva código tipado seguro y metadata operacional, no un resultado vacío ni
   números ficticios. D2 NOT_PROVIDED/NOT_REQUESTED, PROVIDED con cero findings válido y fallo D2 son
   tres situaciones distintas; un fallo detiene la cadena, no se transforma en ausencia solicitada.
6. **Recuperación.** Lease vencido cierra el intento como fallido/expirado mediante CAS; cualquier nuevo
   intento conserva el anterior. Reintentar una escritura idempotente no implica repetir adjudicación.
   Una llamada externa cuyo resultado se perdió no tiene garantía exactly-once: registrar incertidumbre
   técnica y exigir autorización para una nueva ejecución. No modificar retries/fallback de runtimes.
7. **Reevaluación.** Nueva intención con referencia `supersedesEvaluationId`, misma sesión o nuevo
   transcript explícito; nunca overwrite. La autorización docente/operativa para reevaluar o publicar
   notas queda pendiente. Ninguna recuperación reabre D3B ni permite perseguir otro PASS equivalente.
8. **Lectura.** Comprobar autorización server-side, estado, versiones, integridad y bindings antes de
   devolver datos. Fuente ausente/corrupta o versión desconocida falla cerrada. No devolver snapshots
   clínicos internos al cliente; DTO público/teacher-specific corresponde a integración posterior.

Ownership deriva de la sesión autenticada, no de IDs aportados como prueba por el cliente. Queries
siempre acotadas por ownership/rol; evitar diferencias que revelen existencia de sesiones ajenas.
Errores y logs excluyen texto clínico, prompts, raw responses y claves. La política de revisión/deuda
se conserva por valor y procedencia server-owned; almacenamiento correcto no convierte una evaluación
en fiable, ni activa perfiles productivos.

## 4. Interfaces y dependencias sin circularidad

Responsabilidades aprobadas: M6 evaluación clínica de personalización, seguridad de actuación,
seguimiento, informe y coherencia; M7 comunicación; M8 captura/evaluación de cuestionario; M9 agregación
y presentación; M10 interfaz de revisión/override; M1/M2/M3 versiones, autoría y casos aprobados.

M6 definirá entradas canónicas versionadas para informe/conclusiones/seguimiento y contexto individual,
con session/caseVersion/transcript/source bindings y ausencia explícita. M8/M9 podrán suministrar o
consumir esas entradas después; no se exige construir sus interfaces para definir contratos M6.
M7 conserva su juicio comunicativo: no duplicarlo como puntuación clínica. M10 podrá referenciar
evaluaciones y revisiones inmutables, sin controlar desde el cliente la autoridad clínica. M1–M3
suministran versiones retenidas/aprobadas, no valores mutables reconstruidos al leer.
Para informe de derivación escrito, [M6-COV1](22_REFERRAL_REPORT_OFFLINE_EVALUATION.md) implementa ahora
un contrato mínimo offline de entrega/contexto/evaluación con bindings y runtime explícito, separado de
la entrevista y de E2. No incorpora persistencia ni integración productiva. Las interfaces restantes
siguen como trabajo posterior; no se amplían M5 ni los contratos D1/D2.
Para seguimiento, [M6-COV2](23_FOLLOW_UP_PLAN_OFFLINE_EVALUATION.md) añade el snapshot interno
de requisitos explícitos y evaluación offline del plan expresado en la entrevista, con bindings,
citas y secuencia. No convierte episodios en desempeño, no incorpora persistencia ni resultados
longitudinales y no modifica COV1, M5, D1/D2 o E2. Aceptación semántica e integración pendientes.

## 5. M6-P1 — implementación local de la frontera pura

**M6-P1 — contratos puros del registro y lifecycle farmacéutico**: **COMPLETE / PUBLISHED IN GIT**, checkpoint `66d3e22074d31bc2ad35af08d98bda04c1bd5020`. No despliegue.

- Objetivo: tipar manifest/identidad/estado y validar registros que referencian resultados y fuentes
  existentes; implementar transiciones puras con reloj/IDs inyectados, idempotencia y fencing.
- Reutilizar `pharmaceutical-scoring-types.ts`, tipos canónicos D1/D2, salida E3 y patrones de
  `spfa-evaluation-lifecycle-types.ts`, sin modificar sus semánticas ni duplicar schemas clínicos.
- Implementación: `pharmaceutical-evaluation-record-types.ts`, `pharmaceutical-evaluation-record-utils.ts`,
  `pharmaceutical-evaluation-artifacts.ts` y `pharmaceutical-evaluation-lifecycle.ts`, bajo `lib/cases/v2/`.
- Aceptación: versiones/bindings estrictos; conflictos idempotentes rechazados; stale token rechazado;
  completed inmutable; FAILED sin payload; D2 ausente/vacío/fallo diferenciados; deuda/provisionalidad
  intactas; fuentes/corruptelas simuladas fail-closed; sin derivar scores ni elevar aceptación semántica.
- Pruebas necesarias: composición con resultado E3 real y runtimes falsos, fuentes/configuración
  sintéticas, mutaciones adversarias, concurrencia simulada CAS/lease y compatibilidad de outputs E3.
  Las carreras PostgreSQL/atomicidad real se reservarán para la posterior implementación de persistencia.
- Exclusiones: DB/migraciones/API/UI, OpenAI/live, archivo de testigos, replay completo, perfiles
  productivos, reglas docentes, despliegue y modificaciones D3B. No acredita automáticamente los 8 puntos.
- Dependencias disponibles: A/B/C, D1/D2 offline, E1/E2/E3. No exige PED2 aprobado ni D3B ACCEPT.
  **Ninguna decisión humana pendiente bloquea P1.** Retención, archivo de testigos y permisos de
  reevaluación/publicación deberán resolverse antes de las capacidades productivas correspondientes.

### Contrato local y límites concretos

- `pharmaceutical-evaluation-record/1`, schemaVersion `2.0`: intención separada de intentos y estados
  `PENDING / EVALUATING / COMPLETED / FAILED`. UUIDs, tiempos UTC canónicos con milisegundos y tokens
  explícitos; sin reloj global, random, IO, retries ni fallback. Tiempo de completion estrictamente
  anterior a lease expiry; la igualdad ya es expiración. La repetición de una completion ya confirmada
  acepta únicamente el mismo resultado y worker original, sin volver a ejecutar semántica.
- `create/claim/complete/fail/expirePharmaceuticalEvaluation…V2` producen estados nuevos congelados.
  `validatePharmaceuticalEvaluationRecordV2` comprueba historia, revisión, fencing, fuentes y resultado.
  `supersedesEvaluationId` exige al crear una evaluación previa terminal y compatible; no concede
  autorización. El adaptador deberá conservar su FK/disponibilidad y aplicar permisos.
- Canonicalizaciones operacionales `/1`: `pharmaceutical-evaluation-intent-v2`,
  `pharmaceutical-evaluation-record-v2`, `pharmaceutical-execution-plan-v2`,
  `pharmaceutical-evaluation-sources-v2`, `pharmaceutical-evaluation-result-v2`.
  SHA-256 del JSON canónico `[canonicalization, core]`, claves ordenadas, arrays con orden material,
  sin hash propio en preimagen. El digest estable excluye evaluationId, attemptId, worker, tiempos,
  revisión y fencing; incluye intención, fuentes/configuración y plan efectivo. Fingerprints previos intactos.
- Manifest obligatorio: versiones aplicación/scorer/runtime/SDK, modelo solicitado allowlisted,
  parámetros y versiones actuales D1/D2. `responseModel` se comprueba contra el solicitado, nunca lo
  reemplaza. Rutas sin llamadas explícitas para D1 sin batches, D2 no solicitado y D2 sin mensajes student.
- Dos referencias de artefacto, SOURCES y RESULT, contienen versión y fingerprint; el resolutor inyectado
  obtiene instancias existentes por valor, previamente cargadas por el futuro adaptador. Ausencia,
  corrupción o versión desconocida fallan cerradas, sin resolver `latest`. P1 no implementó almacén; P2 lo añade separadamente.
  Las fuentes reutilizan la reconstrucción del contexto/configuración vigente y el envelope del runtime;
  no se añade una segunda validación clínica integral del paciente. El resultado se comprueba en su forma
  canónica existente, con referencias/literales/bindings y receipt, sin reconstruir respuestas del provider.
- Los límites numéricos son estructurales, no suma de pesos ni recálculo de earned/possible/normalizedScore.
  Un test muestra que un escritor capaz de reescribir coherentemente resultado y hashes no queda
  autenticado ni su aritmética certificada. E1 y sus testigos obligatorios no se debilitan.
- Estados provisionales, deuda, NOT_SCORABLE y D2 vacío legítimo sobreviven como COMPLETED operacional;
  FAILED no admite resultado. Recuperación conserva intentos previos; no repite llamadas automáticamente.
  Son propuestas CAS, no exclusión mutua: dos lectores de un mismo estado pueden producir propuestas
  rivales. Solo el adaptador transaccional podrá aceptar una y rechazar la obsoleta atómicamente.
- Errores únicamente tipados/seguros; no texto clínico, prompts, raw responses ni archivo de testigos.
  Fuentes internas server-only, sin DTO público. P1 no demuestra autenticación, retención, concurrencia
  PostgreSQL ni replay completo; tampoco integra todavía el freeze/almacenamiento productivo con E3.

## Verificación

E4 no ejecuta suite, TypeScript, DB ni OpenAI. La evidencia histórica E3 (35 tests, selección 500,
suite 3220 PASS / 25 SKIPPED) permanece en [su documento](20_PHARMACEUTICAL_SESSION_PIPELINE.md).
La finalización de diseño no declara cierre de persistencia, M6-E, M6 ni aceptación del evaluador D2.

P1 sí ejecutó validación offline: **54/54** tests nuevos con E3 real y runtimes falsos/configuración
sintética; **610/610** selección relacionada; suite **3274 PASS / 25 SKIPPED**, TypeScript
`--noEmit --incremental false` y diff-check PASS. Los flags live/DB se fijaron a 0; no se ejecutaron
OpenAI ni PostgreSQL. Las carreras son simulaciones de estados/tokens, no tests de concurrencia real.
En ese checkpoint P1 la persistencia PostgreSQL no estaba implementada; los 8 puntos permanecían sin acreditar; M6 **56%**,
proyecto **50.57%**, M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT.

## M6-P2 — adaptador PostgreSQL local

Incremento **COMPLETE / PUBLISHED IN GIT**, checkpoint `79c030ba08bdcfb70579c9668a966e0d5f0ef225`. No desplegado.
No cambia P1, D1/D2, E1/E2/E3 ni la autorización académica. No inicia otro incremento.

- Migración aditiva **0004**: `pharmaceutical_evaluations_v2` (intención/header sin lista de intentos),
  `pharmaceutical_evaluation_attempts_v2` (historial), `pharmaceutical_evaluation_artifacts_v2` (fuentes/resultado).
  UUIDs; owner bigint decimal sin paso por `number`; sesión UUID y case version `casever_…` existentes.
  Unicidad `(owner_id, session_id, idempotency_key)`; FKs restrictivas a sesión/owner/versión/original/artefactos.
  Concordancia de columnas indexadas y payload por CHECK; validación P1 completa del registro al leer.
  Triggers protegen completed/artefactos/intentos terminales; constraints diferidas ligan header e historia.
  No cascadas de borrado ni modificaciones de tablas SPFA/migraciones históricas.
- Los payloads de artefactos usan **json, no jsonb**: preservan el orden que requiere la serialización
  de fingerprints D1 existentes. La primera prueba real detectó la pérdida de ese orden con jsonb;
  el roundtrip corregido mantiene hashes/contratos y resultados originales, sin recanonicalizar D1.
- `createPharmaceuticalEvaluationPostgresV2(database)` exige dependencia DB explícita; no importa
  `lib/db`, no lee `DATABASE_URL` ni configura conexiones implícitas. API: `create`, `read`, `claim`,
  `complete`, `fail`, `expire`; recuperación = expire confirmado + claim explícito posterior.
  No ejecuta adjudicación, retries, scoring ni llamadas externas. Claim recibe duración de lease explícita;
  no renueva automáticamente un claim repetido: leer el estado permite recuperar la identidad vigente.
- Todas las operaciones reciben `{ownerId, sessionId}` desde una frontera autenticada del servidor.
  Consultan propiedad **real** en DB bajo bloqueo de sesión, luego registro acotado por owner/session.
  Un ID no prueba autorización. Ausente/ajeno devuelve el mismo `NOT_AVAILABLE`; SQL/conexión sanitizados.
  RLS activado sin políticas cliente y privilegios retirados de PUBLIC/anon/authenticated. La conexión
  privilegiada y su despliegue permanecen responsabilidad del servidor; no es una nueva API/autenticación.
- Locks ordenados sesión → evaluación; serialización de creación/claims; CAS de revision y comprobación
  P1 de attempt/worker/fence; `clock_timestamp()` después de esperar locks, nunca hora inicial del cliente.
  Completion/fail comprueban además lease en UPDATE SQL. Resultado e historia se confirman en una sola
  transacción; cualquier error revierte ambos. Completion compatible devuelve el mismo registro, otra
  carga falla. No se mantiene transacción durante E3 ni se promete exactly-once externo.
- Fuentes y resultados existentes se copian antes de await; se cargan por valor antes del resolver P1
  síncrono. Hash/version/binding inválido o fuente ausente falla cerrado, sin latest ni regeneración.
  `COMPLETED` conserva deuda/provisionalidad/NOT_SCORABLE, no aprobación. D2 no pedido, vacío válido y
  error siguen diferenciados. No se recalculan scores ni se reconstruyen respuestas/testigos.

### Evidencia PostgreSQL y aislamiento

PostgreSQL **17.10**, contenedor nuevo `chatusal-m6-p2-20260925`, loopback **55439**, DB
`chatusal_m6_p2_disposable`. Identidad/label/puerto y DB vacía comprobados antes de migrar; marca de
aislamiento comprobada por los tests antes de migraciones y TRUNCATE. Gate separado
`RUN_PHARMACEUTICAL_P2_POSTGRES=1`; sin fallback de conexión ni acceso a bases de aplicación.
Contenedor independiente `chatusal-m6-p2-m5-20260925`, loopback **55433/55434**, exclusivamente para
regresiones M5 secuenciales con 0001–0004 aplicadas. Ninguna base preexistente fue utilizada.

**26/26 P2 PostgreSQL real**: migración fresca, E3 real con runtimes falsos, lectura desde otro pool,
creación/conflicto/claims concurrentes, fencing, expiración/recuperación, lock wait hasta vencimiento,
lease revisado en escritura, rollback inducido después del artefacto, completion repetida/conflictiva,
inmutabilidad/historia, aislamiento, fuentes/resultados ausentes/corruptos y estados D2/score/deuda.
**M5 PostgreSQL real: 8/8 G3 + 10/10 G4**, sin cambiar M5. No se cuentan skipped como aceptación.
Los fallos inducidos y la corrupción privilegiada se limitan a fixtures de estas bases desechables.
Alcance de la evidencia de privilegios: las pruebas funcionales/concurrencia usan `postgres`
(superusuario); prueban el adaptador y las restricciones activas, no permisos de un rol productivo.
El test de acceso directo usa `SET ROLE p2_unprivileged` y demuestra rechazo de SELECT en las tres
tablas. Los REVOKE ALL y ausencia de políticas cliente se verifican además por inspección de 0004;
no se presenta esto como prueba de configuración de roles/Supabase en producción. Un superusuario
puede desactivar triggers: la corrupción inducida comprueba detección al leer, no resistencia al DBA.
Tras la verificación final del 26 de septiembre, ambos contenedores y sus volúmenes sintéticos fueron
eliminados. No se conservaron credenciales, dumps ni logs en el repositorio. Repetir PG exige crear y
verificar otra vez el destino local desechable indicado; no se permite sustituirlo por una base compartida.

Offline final: **12/12 P2**; selección relacionada inicial **443/443** (antes del último test de error
de clonación, incluido después en la suite completa). Suite final **3286 PASS / 51 SKIPPED**:
7 live + 18 PG M5 + 26 PG P2 desactivados en la ejecución offline. TypeScript
`--noEmit --incremental false` y `git diff --check`: PASS. No OpenAI/live ni bases ajenas.

### Criterios del entregable y límites pendientes

Estado histórico al checkpoint P2; los pendientes técnicos de freeze/coordinación y disponibilidad
se resuelven con P3 y su recuperación independiente, según el [cierre final](#cierre-técnico-del-entregable).

| Criterio de persistencia/lifecycle | Evidencia P2 | Pendiente |
|---|---|---|
| Guardar y recuperar fuentes/resultado/manifest | Tablas separadas, FK, json, hashes y roundtrip E3 | Integración del freeze con fuentes reales de sesión y coordinador E3 |
| Idempotencia, intentos e historial | Unique + locks/CAS + pruebas de conflictos y fencing | Revisión del incremento; no garantía exactly-once de proveedor |
| Atomicidad y recuperación | Rollback real, lease posbloqueo y en UPDATE; expire/claim conserva historia | Cableado operativo y autorización para nuevas ejecuciones |
| Protección y ownership | Consulta DB, errores seguros, RLS/revokes, aislamiento probado | Credenciales/roles de despliegue, permisos de reevaluación/publicación y DTOs autorizados |
| Versiones y artefactos disponibles | Fuentes por valor, FK restrictivas, read fail-closed | Retención/borrado aprobado y conservación de releases referenciadas |
| Reutilización/auditoría | Lectura estructural/integridad sin alterar score/aceptación | Replay completo y archivo de testigos **no autorizados ni implementados** |

No se implementa una retención indefinida: se impide borrado accidental de registros referenciados;
una política de supresión requiere diseño/autorización posterior. No hay raw provider responses,
prompts, testigos, API/UI, perfiles productivos ni nota académica activada. En ese checkpoint P2 los 8 puntos quedaron
**pendientes de decisión en revisión**; histórico M6 **56%**, proyecto **50.57%**.

### Clasificación para revisar el cierre de los 8 puntos

Clasificación histórica P2, conservada para trazar qué evidencia exigía el cierre; no describe una
carencia técnica vigente tras la aceptación conjunta P1–P3.

- **Persistencia/lifecycle (8 puntos):** revisión y aceptación de las garantías implementadas;
  cerrar la evidencia extremo a extremo de E4 §3.2 de que las fuentes congeladas son precisamente
  las consumidas por E3, y concretar la disponibilidad del artefacto de release referenciado (E4 §1).
  P2 demuestra roundtrip y composición sintética, no ese freeze coordinado de una sesión real.
  Estos pendientes no se trasladan a otros entregables para declarar cerrado el almacenamiento.
- **Integración productiva (entregable separado de 6 puntos):** cablear coordinador, frontera de
  identidad autenticada, configuración autorizada y DTO/entrega segura; desplegar la migración.
  Que el cableado sea posterior no elimina la obligación anterior de demostrar el freeze correcto.
- **Permisos/políticas operativas posteriores:** aprobar quién puede reevaluar/publicar, provisionar
  roles/credenciales del despliegue y concretar retención/supresión antes del uso productivo (E4 §§1,3).
  No se autoriza retención indefinida. Replay completo/archivo de testigos requieren decisión separada
  (E4 §2), no son una capacidad P2 ni se añaden como gate nuevo de sus pruebas.
La clasificación no alteró los pesos de PROJECT_STATUS ni acreditó progreso en el checkpoint P2.

## M6-P3 — captura congelada y coordinación E3/P2

**COMPLETE / PUBLISHED IN GIT**. Checkpoint P3 `40e97bdb51f8cc7f4dd180913734153b23b965db`,
mensaje `Coordinate frozen pharmaceutical evaluation and persistence`; recuperación independiente verificada.
Base P2 publicada: `79c030ba08bdcfb70579c9668a966e0d5f0ef225`. No nueva migración,
endpoint, UI, perfil docente, cliente OpenAI, ejecución live ni despliegue. E3/P1/P2 y contratos
D1/D2 mantienen sus APIs/semánticas. M6/M6-E PARTIAL, PED2 abierto, D3B OPEN / VALIDATION DEBT.

### Fuentes y consistencia

- `capture-pharmaceutical-evaluation-sources.ts` es server-only. Recibe identidad autenticada
  desde el servidor, consulta ownership real y versión fijada a la sesión. Ausente/ajena no se distinguen.
  Solo admite sesiones `finished`, versión `PUBLISHED/ARCHIVED` y snapshot SPFA ya existente.
  No invoca claim M5 (que cerraría la sesión), no finaliza/reabre sesiones ni crea snapshots sustitutos.
- Bajo el mismo lock de sesión que usa el trigger de mensajes de 0003, valida el transcript congelado,
  su hash y bindings y lo compara íntegramente con los mensajes persistidos ordenados por fecha/ID.
  Las escrituras compiten por ese lock y son rechazadas en una sesión finalizada. Las garantías requieren
  las restricciones/triggers previstos, no una conexión administrativa capaz de desactivarlos.
- Resuelve el contenido Generated versionado con los resolutores existentes; construye referencia
  clínica, targets, expectativas explícitas, candidatos y contexto con sus builders/validadores reales.
  Configuración y semanticAcceptance proceden del servidor; no hay snapshot cliente autoritativo,
  configuración pedagógica por defecto ni consulta a `latest`.
- Se copian entradas antes del primer await. P2 conserva las fuentes por valor y verifica su integridad.
  Después del claim, el coordinador **lee de P2**, verifica registro/referencia y alimenta E3 desde esa
  representación persistida. No vuelve a resolver caso, transcript ni configuración durante E3.

### Manifest, idempotencia y fallos

- `coordinate-pharmaceutical-evaluation.ts` compone captura → create → claim → lectura verificada
  → E3 real → complete → lectura verificada. Todas las transacciones terminan antes de E3.
- `bindPharmaceuticalEvaluationExecutionV2` vincula una única configuración congelada al manifest y
  al argumento efectivo de los adaptadores D1/D2 inyectados. No acepta un manifest independiente de un
  runtime opaco; rechaza bindings ajenos y respuesta con modelo distinto. Modelo/tokens/timeout no se
  releen del entorno. Los adaptadores server-owned deben honrar esa configuración y declarar versiones
  runtime/SDK reales; no se pretende probar mediante tipos que una función arbitraria diga la verdad.
  No se instancian clientes ni se cambian los defaults/runtimes existentes.
- `COMPLETED` se lee sin adjudicar otra vez. `EVALUATING` (también expirado) y `FAILED` devuelven
  `NOT_EXECUTED`; no expire/claim automático. CAS decide cuál de dos peticiones ejecuta.
  Un error de claim devuelve `CLAIM_OUTCOME_UNKNOWN`, sin repetir claim ni ejecutar especulativamente.
- Fallo E3 intenta registrar FAILED con código seguro; fallo de esa escritura se distingue mediante
  `FAILURE_WRITE_UNCONFIRMED`. No fabrica resultado ni marca fallido un intento posterior.
  Un fallo de lectura/integridad tras claim detiene E3; el intento puede necesitar resolución operativa.
- Si complete falla, nunca se llama a fail ni se repite E3: se comprueba un posible resultado ya
  confirmado. Si sigue incierto, `COMPLETION_UNCONFIRMED` entrega una capacidad **opaca, privada y en
  memoria** para `recoverCompletion`, que únicamente reenvía el mismo resultado y worker a P2.
  No contiene testigos ni raw responses y no es un DTO cliente. Perder el proceso pierde la capacidad;
  una lectura posterior aún recupera un resultado confirmado. No existe garantía exactly-once del proveedor.
  Recuperar escritura no autoriza una ejecución semántica nueva ni reevaluación/publicación académica.

### Disponibilidad de implementación: comprobación reproducible

Verificación realizada el 27 de septiembre de 2026, registrada aquí sin repetirla ni ejecutar código:

- Publicación fast-forward desde P2 `79c030ba08bdcfb70579c9668a966e0d5f0ef225`.
  HEAD local, `origin/chatusal-v2` y consulta directa del remoto coincidieron en
  **`40e97bdb51f8cc7f4dd180913734153b23b965db`**; árbol
  **`bf045f53ba7f4fe03c3eb21209990b448f10abac`**. Repositorio principal limpio, ahead 0 / behind 0.
- Clon independiente desechable obtenido desde el [repositorio remoto](https://github.com/paulo-netizen/chat-farmacia),
  seleccionado exactamente en el [commit P3 publicado](https://github.com/paulo-netizen/chat-farmacia/commit/40e97bdb51f8cc7f4dd180913734153b23b965db).
  Sin copia local, objetos alternativos ni repositorio de trabajo como fuente Git; no se copiaron
  `.env` ni credenciales de aplicación. Commit, árbol y dependencias de código disponibles.
- **`git cat-file` y `git fsck --full`: PASS**. Objetos verificados: módulos y pruebas P3, E3,
  contratos/artefactos/lifecycle P1, adaptador P2 y migraciones 0001–0004.
- Blobs iguales en el commit publicado y el clon, y conservados después de instalar:
  `package.json` **`cdfb8430f415041fb5ebf96a34f0c6dcd598f946`**;
  `package-lock.json` **`2214e6189d32a559181db080d0fd2b98a01a66dc`** (126644 bytes, lockfileVersion 3).
- **Node 20.19.4 / npm 10.8.2**. **`npm ci --ignore-scripts`: correcto, 219 paquetes**, sin errores
  de integridad ni cambios de archivos versionados. `npm ls --depth=0` correcto; versiones instaladas
  contrastadas con el lockfile: OpenAI SDK 4.104.0, pg 8.16.3, TypeScript 5.9.3, Vitest 2.1.9,
  Next 14.2.15, React/React DOM 18.3.1 y Zod 3.23.8. Checkout en HEAD separado, árbol versionado
  limpio y `node_modules` ignorado. Los bloqueos iniciales de red del sandbox y caché `EPERM`
  se resolvieron con permisos; no constituyeron una incompatibilidad reproducible de dependencias.
- npm notificó **13 vulnerabilidades**; gravedad, aplicabilidad y remediación pendientes de clasificación
  en la [deuda de seguridad M0](PROJECT_STATUS.md#m0--saneamiento-y-barreras-de-seguridad).
  No se ejecutó `npm audit fix` ni se cambiaron dependencias.

Esta evidencia demuestra recuperación del código publicado y restauración de dependencias con scripts
desactivados. No certifica build completo, despliegue, roles productivos ni reproducibilidad semántica.
Un clon recuperable no garantiza conservación indefinida del repositorio o del registro de paquetes;
el lockfile declara los paquetes, no los archiva. No se registra una ruta temporal personal como
ubicación permanente del artefacto. No se atribuye P3 al commit P2.

Las versiones de aplicación/runtime/SDK de los fixtures siguen marcadas `P1-SYNTHETIC-TEST-ONLY/1`;
no representan una release productiva. Vincular un futuro manifest productivo al SHA y versiones
efectivas seguirá siendo parte de su integración autorizada. Replay completo y archivo de testigos
permanecen fuera del alcance autorizado.

### Evidencia local P3 y criterios de los 8 puntos

- Offline P3 anterior al saneamiento final: **28/28** (9 captura + 19 coordinación), builders/E3 reales y runtimes falsos.
  Regresión relacionada P1/P2/E1/E2/E3: **383/383**. Suite **3314 PASS / 67 SKIPPED**;
  omitidos 7 live + 18 PG M5 + 26 PG P2 + 16 PG P3. TypeScript sin incremental PASS.
- Revisión final acotada: saneadas las excepciones de validación/clonado de entradas del coordinador
  y binding mediante `INVALID_CONFIGURATION`, sin valores ni claves recibidos. Dos regresiones nuevas
  cubren claves privadas de comando y valores privados del modelo. **30/30 offline P3** (9 + 21) y
  TypeScript sin incremental PASS. Las cifras anteriores se conservan como evidencia previa; no se
  afirma una nueva ejecución de suite completa ni PostgreSQL tras este ajuste localizado.
- PostgreSQL real P3, **anterior al saneamiento final de errores**: **16/16**, contenedor exclusivo `chatusal-m6-p3-20260927`, PostgreSQL 17.10,
  loopback 55440, base y marcador `chatusal_m6_p3_disposable` / `chatusal-m6-p3-20260927-disposable`.
  Sin fallback de URL/PG env. Caso/transcript/configuración sintéticos válidos, resolutores reales.
  Pruebas como superusuario demuestran coordinación/triggers/atomicidad, no nuevos permisos productivos;
  la evidencia limitada de roles restringidos de P2 sigue identificada como tal.
  Al terminar se eliminó únicamente el contenedor P3 verificado y su volumen sintético; no quedan
  datos de esas pruebas. No se conectó a `farmacia_db` ni se aplicaron migraciones fuera del contenedor.
- Igualdad de fuentes capturadas/almacenadas y fingerprint del contexto consumido; resultado recuperado
  por otra conexión; locks NOWAIT disponibles durante E3; writer concurrente al freeze rechazado.
  Dos solicitudes: **3 llamadas falsas D1 + 1 D2**, no dos evaluaciones. Repetición completed: **0 adicionales**.
  Claim confirmado con respuesta perdida: **0 llamadas** incluso al repetir la solicitud.
  Completion incierta recuperada: **0 adjudicaciones adicionales**. Fallos D1/D2, stale worker y
  expire/recovery conservan historia y no publican resultados ficticios.

### Cierre técnico del entregable

**Persistencia y lifecycle farmacéutico — CLOSED / TECHNICALLY COMPLETE**, aceptación documental
autorizada el 27 de septiembre de 2026. Implementación y verificación P1–P3 completas; criterios
satisfechos con evidencia acumulada, sin nueva ejecución de tests, TypeScript, OpenAI/live o DB:

| Criterio satisfecho | Evidencia acumulada / aportación P3 | Límite o pendiente productivo |
|---|---|---|
| Contratos y lifecycle | [P1](#5-m6-p1--implementación-local-de-la-frontera-pura): contratos versionados, intención, idempotencia, lease/fencing e historia; 54/54 offline | P1 no constituye por sí solo autenticación o concurrencia DB |
| Fuentes/resultados/manifest conservados | [P2](#m6-p2--adaptador-postgresql-local): json/FK/hashes, roundtrip y 26/26 PostgreSQL; [P3](#m6-p3--captura-congelada-y-coordinación-e3p2): E3 desde lectura persistida | Integración productiva pendiente |
| Freeze consistente | Snapshot M5 validado contra mensajes bajo lock compartido con writer; no cierre implícito | Integrar solo en flujo autorizado; sesiones activas no admitidas |
| Idempotencia, CAS, historial y atomicidad | P1/P2 + concurrencia P3, workers obsoletos y write recovery separado | Resolución operativa de ejecuciones inciertas; no exactly-once |
| Ownership y protección | Verificación DB owner/sesión; fuentes internas, sin endpoint | Roles/credenciales de despliegue, DTOs y permisos productivos |
| Código y dependencias recuperables | [Recuperación independiente](#disponibilidad-de-implementación-comprobación-reproducible): SHA/árbol/blobs concordantes, cat-file/fsck PASS y npm ci con scripts desactivados correcto | No garantiza conservación indefinida ni build completo |
| Reutilización/auditoría | Lectura verificada sin nuevos calls ni recalcular scores | Replay/testigos fuera de alcance; retención/supresión por autorizar |

Los gates técnicos de freeze/consumo y disponibilidad/restauración están satisfechos; no se trasladan
como deuda a otro entregable. La autorización de este cierre acredita **8/8 puntos** del entregable
existente según [PROJECT_STATUS, fuente canónica](PROJECT_STATUS.md#excepción-puntual-aprobada--desglose-interno-m6):
**M6 64%**, aporte global **7.68**, otros milestones **43.85**, proyecto **51.53%**.
P1/P2/P3 y E4 no reciben pesos adicionales; el histórico **56% / 50.57%** fue correcto hasta este cierre.

M6 y M6-E permanecen **PARTIAL**. PED2 abierto y perfiles productivos no aprobados/no instalados;
D3B **OPEN / VALIDATION DEBT**. Integración productiva (entregable separado de 6 puntos), permisos
de reevaluación/publicación, roles de despliegue y retención/supresión siguen pendientes. Replay completo
y archivo de testigos quedan fuera del alcance autorizado. El cierre no certifica despliegue, build
completo, roles productivos ni reproducibilidad semántica; no inicia otro incremento.
