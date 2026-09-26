# M6-E4 — Persistencia farmacéutica y reutilización

## Estado y frontera

**DESIGN COMPLETE — NO INDEPENDENT WEIGHT**. Persistencia P2 **IMPLEMENTED LOCALLY / PENDING REVIEW**, no integrada ni desplegada.
Diseño documental sobre E3 publicado en `11e10724b8ca1032c29edf6f85553e28395ab62b`.
No implica despliegue, aprobación pedagógica ni aceptación semántica. M6/M6-E siguen PARTIAL;
PED2 abierto; perfiles productivos no aprobados/no instalados; D3B OPEN / VALIDATION DEBT.
La [medición canónica](PROJECT_STATUS.md#excepción-puntual-aprobada--desglose-interno-m6)
reconoce 56% M6 / 50.57% global por trabajo anterior. Los 8 puntos de persistencia siguen pendientes.

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
   futura con E3 debe preservar sus APIs y evitar una segunda llamada para obtener metadata/testigos.
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
Estas interfaces son trabajo posterior, no contratos ya implementados ni nuevas reglas pedagógicas.

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
En ese checkpoint P1 la persistencia PostgreSQL no estaba implementada; los 8 puntos permanecen sin acreditar; M6 **56%**,
proyecto **50.57%**, M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT.

## M6-P2 — adaptador PostgreSQL local

Nuevo incremento: **IMPLEMENTATION COMPLETE — LOCAL / READY FOR REVIEW**, pendiente de checkpoint/publicación Git.
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
prompts, testigos, API/UI, perfiles productivos ni nota académica activada. Los 8 puntos quedan
**pendientes de decisión en revisión**; M6 **56%**, proyecto **50.57%** intactos.

### Clasificación para revisar el cierre de los 8 puntos

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
La clasificación no altera los pesos de PROJECT_STATUS ni acredita progreso en este checkpoint.
