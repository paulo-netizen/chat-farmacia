# M6-E4 — Persistencia farmacéutica y reutilización

## Estado y frontera

**DESIGN COMPLETE — NO INDEPENDENT WEIGHT**. Persistencia **NOT IMPLEMENTED**.
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

Se propone almacenamiento PostgreSQL separado: evaluaciones lógicas, intentos y artefactos protegidos.
Nombres de tablas se concretarán en el incremento de migración, no en este diseño.
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

## 5. Único siguiente incremento propuesto

**M6-P1 — contratos puros del registro y lifecycle farmacéutico** (identificador propuesto, no iniciado).

- Objetivo: tipar manifest/identidad/estado y validar registros que referencian resultados y fuentes
  existentes; implementar transiciones puras con reloj/IDs inyectados, idempotencia y fencing.
- Reutilizar `pharmaceutical-scoring-types.ts`, tipos canónicos D1/D2, salida E3 y patrones de
  `spfa-evaluation-lifecycle-types.ts`, sin modificar sus semánticas ni duplicar schemas clínicos.
- Cambios previstos: módulos nuevos de tipos de registro, validador y transiciones bajo `lib/cases/v2/`,
  tests unitarios/integración offline correspondientes y documentación. Los nombres se fijarán al implementar.
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

## Verificación documental

E4 no ejecuta suite, TypeScript, DB ni OpenAI. La evidencia histórica E3 (35 tests, selección 500,
suite 3220 PASS / 25 SKIPPED) permanece en [su documento](20_PHARMACEUTICAL_SESSION_PIPELINE.md).
La finalización de diseño no declara cierre de persistencia, M6-E, M6 ni aceptación del evaluador D2.
