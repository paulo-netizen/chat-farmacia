# 14 — Evaluation finalization transaction design

## 1. Estado y alcance

Este documento define 4E-D1. Es un contrato de diseño: no implementa scoring,
rutas HTTP, persistencia, cambios de esquema, UI ni llamadas a OpenAI.

La propiedad central es:

> La primera evaluación finalizada de una sesión es definitiva. La evaluación y
> la transición `active -> finished` forman una sola operación transaccional,
> anclada a la `case_version_id` inmutable de la sesión.

La única fuente clínica autorizada para evaluar es:

```ts
resolveSessionEvaluatorClinicalRuntimeV2({
  authenticatedUserId,
  sessionId,
})
```

Quedan prohibidos como fuente clínica:

- `public.cases`;
- `cases.ground_truth`;
- la versión `PUBLISHED` actual o la versión más reciente del caso;
- cualquier versión distinta de `sessions.case_version_id`.

Una versión anclada puede estar `PUBLISHED` o `ARCHIVED`. Archivar una versión
después de iniciar la sesión no invalida ni cambia la evaluación de esa sesión.

## 2. Estado actual confirmado

La implementación V1 de `POST /api/evaluations`:

1. consulta `sessions JOIN cases` y lee `cases.ground_truth`;
2. comprueba ownership después de cargar la sesión;
3. compara strings de `tipo_no_adherencia`, `barrera_principal` e
   `intervenciones_validas`;
4. usa `INSERT ... ON CONFLICT (session_id) DO UPDATE` y, por tanto, permite
   sobrescribir una evaluación anterior;
5. ejecuta después un `UPDATE sessions SET status = 'finished'` separado, sin
   transacción común.

Esto permite que cambie la fuente clínica respecto del snapshot usado en la
entrevista, que un retry sobrescriba el primer resultado y que evaluación y
finalización queden parcialmente persistidas.

El esquema real ya aporta defensas útiles:

- `sessions.status` solo admite `active | finished`;
- `sessions.case_version_id` es `NOT NULL`, referencia la misma entidad lógica
  que `sessions.case_id` y es inmutable;
- `evaluations.session_id` tiene `UNIQUE`, por lo que puede existir como máximo
  una fila física por sesión.

Estas constraints complementan, pero no sustituyen, el algoritmo
transaccional del servicio.

## 3. Hidratación clínica y autorización de operación

`resolveSessionEvaluatorClinicalRuntimeV2` hidrata de forma segura el evaluator
runtime de sesiones `active` y `finished`. Esa capacidad es deliberada: permite
resolver la verdad clínica anclada para la primera finalización y para recuperar
una evaluación ya terminada.

La hidratación no autoriza por sí sola a recalcular ni sobrescribir una
evaluación. Se separan tres responsabilidades:

1. **Hidratar la verdad clínica:** B2 valida ownership, anclaje, versión,
   formato y contenido, y devuelve el evaluator runtime exacto de la sesión.
2. **Finalizar una evaluación:** operación D transaccional que solo crea el
   primer resultado cuando la sesión está `active` y no existe evaluación.
3. **Recuperar una evaluación terminada:** devuelve la fila ya persistida sin
   volver a puntuarla ni compararla con un nuevo payload.

Una sesión `finished` no queda habilitada para reevaluación por el mero hecho
de que B2 pueda hidratarla.

## 4. Política de primera finalización

Una evaluación nueva solo puede crearse cuando, bajo lock:

- la sesión pertenece al usuario autenticado;
- el anclaje de versión coincide con el runtime previamente resuelto;
- `sessions.status = 'active'`;
- no existe ninguna fila en `evaluations` para la sesión.

La primera finalización que confirma la transacción gana. No se utiliza UPSERT
para actualizar el resultado. Nunca se sobrescribe una fila de evaluación.

La transacción lógica es:

```text
BEGIN
  SELECT sesión owned FOR UPDATE
  verificar identidad, ownership, estado y case_version_id
  SELECT evaluación por session_id
  aplicar la matriz de estado
  si es primera finalización:
    INSERT evaluación
    UPDATE sesión active -> finished y establecer finished_at
COMMIT
```

Cualquier error ejecuta `ROLLBACK`. En el flujo nuevo no puede confirmarse una
evaluación sin finalizar la sesión ni finalizarse la sesión sin confirmar su
evaluación.

La forma SQL conceptual del lock es:

```sql
SELECT
  s.id,
  s.user_id,
  s.case_id,
  s.case_version_id,
  s.status,
  s.finished_at
FROM public.sessions AS s
WHERE s.id = $1
  AND s.user_id = $2
FOR UPDATE;
```

La ausencia de fila representa indistintamente sesión inexistente o ajena. No
se hace una lectura previa sin ownership para distinguir ambos casos.

## 5. Retry idempotente y primer resultado definitivo

Si bajo lock la sesión está `finished` y ya existe su evaluación:

- no se recalcula el resultado;
- no se compara el segundo payload con el primero;
- no se actualiza ninguna columna;
- se devuelve la evaluación persistida mediante una proyección allowlist.

Esta política cubre:

- doble clic del alumno;
- retry HTTP;
- pérdida de la respuesta después de un `COMMIT` correcto;
- una segunda petición concurrente.

El primer resultado confirmado es definitivo incluso si un retry lleva
respuestas distintas. La idempotencia se define por `sessionId`, no por la
igualdad del payload.

## 6. Concurrencia A/B

Para dos finalizaciones concurrentes reales de la misma sesión:

1. A adquiere el lock `FOR UPDATE` de la fila de sesión.
2. B espera en ese mismo lock.
3. A observa `active + sin evaluación`, inserta la evaluación, actualiza la
   sesión a `finished` y confirma.
4. B adquiere el lock después del commit de A.
5. B observa `finished + evaluación` y devuelve exactamente la fila persistida
   por A, sin ejecutar scoring ni escritura adicional.

El lock de sesión serializa a los callers conformes y
`UNIQUE (evaluations.session_id)` aporta una defensa estructural adicional. No
se usa `ON CONFLICT DO UPDATE`. Una violación inesperada del unique por un
writer no conforme debe provocar rollback y fallo cerrado, nunca reparación
mediante sobrescritura.

## 7. Matriz de estado bajo lock

| Estado de sesión | Evaluación | Resultado |
|---|---|---|
| `active` | ausente | Primera finalización normal: insertar evaluación y cambiar a `finished` en la misma transacción |
| `finished` | presente | Retry normal: devolver la evaluación persistida, sin recomputar ni escribir |
| `finished` | ausente | Corrupción/estado parcial: rollback y fallo cerrado |
| `active` | presente | Recuperación de compatibilidad: no sobrescribir; conservar la evaluación y completar únicamente `active -> finished` dentro de la transacción |

`active + evaluación` puede proceder del flujo V1 no atómico o de una
interrupción histórica. Es una ruta explícita de recuperación, no un estado
normal que el nuevo servicio pueda producir. Devuelve después la evaluación
persistida.

No se añade una quinta semántica implícita para estados desconocidos: cualquier
valor fuera del contrato falla cerrado.

## 8. Verificación del anclaje dentro de la transacción

Antes de crear o recuperar el resultado, la fila bloqueada debe confirmar:

- `session.id === sessionId` solicitado;
- `session.user_id === authenticatedUserId`;
- `session.case_version_id === runtime.caseVersionId`.

El runtime procede exclusivamente de la sesión autenticada resuelta por B2,
pero la igualdad se repite bajo lock para detectar cambios, mocks incoherentes
o un despliegue parcial. Un mismatch provoca rollback y fallo cerrado.

Nunca se sustituye el anclaje por otra versión, nunca se busca la publicación
actual por `case_id` y nunca se cambia `sessions.case_version_id`.

La fila bloqueada es la autoridad sobre el estado transaccional. Por ejemplo,
si B2 hidrató una sesión `active` y otra petición la terminó antes de adquirir
el lock, el servicio aplica `finished + evaluación` y devuelve el primer
resultado.

## 9. Compatibilidad de scoring legacy

Para `LEGACY_V1_SNAPSHOT`, el scorer transitorio puede consumir únicamente la
variante evaluator legacy ya validada por B2 y estos campos concretos:

- `tipo_no_adherencia`;
- `barrera_principal`;
- `intervenciones_validas`.

`intervenciones_recomendadas` no es sinónimo de
`intervenciones_validas` y no puede sustituirlo silenciosamente.

La comparación textual actual es una política de compatibilidad V1. No es
scoring V2, no añade taxonomías, no infiere equivalencias clínicas y no debe
leer `cases.ground_truth`.

4E-D2A debe extraer un scorer y un parser puros para este formato. La entrada
será desconocida/no confiable, las reglas serán deterministas y la salida se
construirá por allowlist antes de llegar a persistencia.

## 10. Límite de evaluación Generated V2

`GENERATED_CASE_BUNDLE_V2` dispone de `EvaluatorViewV2`, pero ese contrato no
contiene todavía una rúbrica completa de scoring ni la evidencia de
transcripción del alumno necesaria para justificar una evaluación final.

Por tanto, el formulario legacy de tres respuestas no puede presentarse como
una evaluación completa de un caso Generated V2. Se mantiene una separación
explícita:

```text
LEGACY_V1_SNAPSHOT
  -> scorer de compatibilidad V1

GENERATED_CASE_BUNDLE_V2
  -> futuro contrato V2 de evaluación/cuestionario y evidencia de transcripción
```

No se inventa scoring V2, no se adapta el frontend ni se cambia el esquema en
4E-D1. Mientras no exista ese contrato, una petición con formato legacy sobre
un bundle Generated V2 se rechaza explícitamente como capacidad no soportada.

## 11. Respuesta persistida y allowlist

La tabla `evaluations` actual permite reconstruir la respuesta legacy pública
sin volver a puntuar:

```ts
{
  score: number;
  isTipoOk: boolean;
  isBarreraOk: boolean;
  isIntervOk: boolean;
  feedback: string;
}
```

El parser de hidratación toma exclusivamente:

- `score`;
- `is_tipo_ok`;
- `is_barrera_ok`;
- `is_intervencion_ok`;
- `feedback`.

Construye un objeto nuevo, valida tipos y límites, y no devuelve directamente
la fila PostgreSQL. No expone `evaluation.id`, `session_id`, respuestas
enviadas, `case_id`, `case_version_id`, evaluator runtime, ground truth ni
metadata clínica.

Esta misma proyección se usa tanto tras la primera inserción como en retries y
recuperación de estados históricos.

## 12. Semántica HTTP futura

| Situación | HTTP | Respuesta pública |
|---|---:|---|
| Usuario no autenticado | 401 | error genérico de autenticación |
| JSON o body inválido | 400 | error genérico de datos inválidos |
| Sesión inexistente o ajena | 404 | respuesta indistinguible |
| Contenido, identidad o anclaje corrupto | 500 | error interno genérico |
| `finished` sin evaluación | 500 | error interno genérico |
| Generated V2 con formulario legacy | 422 | capacidad de evaluación no soportada para esa representación |
| Primera finalización o retry válido | 200 | respuesta allowlist persistida |

Se elige **422 Unprocessable Content** para Generated V2 con formulario legacy:
la autenticación, el JSON y la referencia de sesión pueden ser válidos, pero el
contrato de respuestas recibido no permite evaluar ese formato clínico. No es
un conflicto transitorio del estado del recurso que un retry idéntico pueda
resolver, por lo que 409 sería menos preciso.

Los errores nunca incluyen evaluator, versión, ground truth, rutas internas,
filas DB, payload persistido, SQLSTATE ni detalles de validación clínica. Los
logs server-side futuros pueden usar códigos estables y correlation ID, pero no
serializar el snapshot.

## 13. Orden exacto de la operación futura

La ruta/servicio debe respetar este orden:

1. autenticar al usuario;
2. leer y validar estrictamente el body;
3. resolver mediante B2 el evaluator runtime de la sesión exacta;
4. validar el formato y la capacidad de evaluación, sin calcular todavía el
   score legacy;
5. adquirir un client PostgreSQL;
6. ejecutar `BEGIN`;
7. bloquear la sesión owned con `SELECT ... FOR UPDATE`;
8. verificar que conserva el mismo `caseVersionId` del runtime;
9. consultar la evaluación existente;
10. aplicar la matriz de estado;
11. ejecutar únicamente las operaciones de la rama elegida;
12. ejecutar `COMMIT` o `ROLLBACK` según corresponda;
13. devolver, en las ramas válidas, la proyección allowlist de la evaluación
    persistida.

Las ramas bajo lock son exactamente:

```text
finished + evaluación
  -> parsear la evaluación persistida
  -> COMMIT
  -> devolver el resultado persistido
  -> NO ejecutar scorer

finished + sin evaluación
  -> ROLLBACK
  -> fallar cerrado

active + evaluación
  -> preservar y parsear la evaluación persistida
  -> UPDATE de la sesión a finished
  -> COMMIT
  -> devolver el resultado persistido
  -> NO ejecutar scorer

active + sin evaluación
  -> SOLO AQUÍ ejecutar el scorer legacy puro
  -> INSERT de la evaluación
  -> UPDATE de la sesión a finished
  -> COMMIT
  -> devolver el resultado persistido
```

El scorer legacy se ejecuta dentro del lock únicamente en la rama de primera
finalización. Es aceptable porque es una operación pura, determinista y local;
no realiza DB adicional fuera de las operaciones previstas, no llama a OpenAI,
no usa red y su duración es trivial frente al beneficio de no recomputar
retries.

Para Generated V2 con formulario legacy, el rechazo 422 ocurre al validar la
capacidad del formato, antes de adquirir un client.

No se mantiene una transacción abierta durante una llamada a OpenAI. El flujo D
no necesita ni autoriza OpenAI.

## 14. Límites transaccionales y errores

- Toda salida posterior a `BEGIN` exige `COMMIT` o `ROLLBACK` explícito.
- El client se libera en `finally`.
- El parsing de una evaluación existente ocurre bajo lock y nunca invoca el
  scorer.
- El scorer legacy solo se invoca bajo lock para `active + sin evaluación`; si
  falla, la transacción ejecuta `ROLLBACK` y no escribe nada.
- Un fallo de `INSERT` o `UPDATE` revierte ambas operaciones.
- La fila insertada se vuelve a proyectar desde valores validados/persistidos;
  no se devuelve un payload docente ni la entrada cruda.
- Los errores PostgreSQL no se convierten en éxitos idempotentes salvo que el
  estado se haya observado de forma normal bajo el lock.
- No hay UPSERT, overwrite, segundo intento de scoring ni reparación silenciosa.

## 15. Pruebas requeridas

Los incrementos posteriores deben demostrar como mínimo:

- ownership en el resolver B2 y de nuevo en el `SELECT ... FOR UPDATE`;
- `PUBLISHED` y `ARCHIVED` anclados aceptados;
- ausencia de cualquier consulta a `public.cases`, `ground_truth`, latest o
  current `PUBLISHED`;
- primer submit crea exactamente una evaluación y finaliza la sesión;
- retry devuelve byte-a-byte la proyección persistida sin overwrite;
- payload distinto en retry no cambia la evaluación;
- dos finalizaciones concurrentes producen una sola fila y ambas respuestas
  representan el primer resultado;
- `finished + sin evaluación` falla cerrado;
- `active + evaluación` conserva el resultado y completa la sesión;
- mismatch de `case_version_id` bajo lock hace rollback;
- fallo en insert o update no deja persistencia parcial;
- parser de fila rechaza tipos inválidos y claves contaminantes;
- Generated V2 con formulario legacy devuelve 422 sin escribir;
- errores HTTP no filtran clínica, IDs internos o SQL;
- cero llamadas OpenAI.

La prueba de concurrencia y atomicidad debe ejecutarse finalmente sobre
PostgreSQL 17.10 desechable, no solo con mocks de queries.

## 16. Plan incremental

### 4E-D2A — Scorer y parser legacy puros

- validar el payload legacy de tres dimensiones;
- puntuar exclusivamente contra el evaluator runtime legacy de B2;
- usar `intervenciones_validas`, sin alias clínicos inventados;
- validar/proyectar la fila persistida con allowlist;
- tests deterministas, contaminación y errores.

### 4E-D2B — Servicio transaccional de finalización

- client dedicado, `BEGIN`, lock owned y verificación de anclaje;
- matriz `active/finished × evaluación presente/ausente`;
- insert sin UPSERT y transición atómica;
- retry que devuelve el resultado persistido;
- tests unitarios de orden, rollback y propagación.

### 4E-D2C — Migrar `/api/evaluations`

- retirar `sessions JOIN cases` y `cases.ground_truth`;
- consumir B2 y el servicio D2B;
- mapping HTTP genérico, incluido 422 de capacidad;
- conservar el contrato público legacy donde sea válido.

### 4E-D3 — Integración y concurrencia

- tests de ruta, ownership y version pinning;
- dos requests concurrentes y retries con payload diferente;
- fallos entre insert/update y estados históricos parciales;
- ausencia de leakage en todas las ramas.

### 4E-E — Regresión PostgreSQL real

- PostgreSQL 17.10 desechable con 0001 + 0002;
- lock y concurrencia reales;
- atomicidad y unique reales;
- versiones `PUBLISHED`/`ARCHIVED` y mutación de `public.cases` sin efecto;
- cleanup, suite normal y TypeScript.

## 17. Fuera de alcance

- scoring V2 completo;
- rúbrica y evidencia de transcripción;
- cuestionario Generated V2;
- cambios de frontend o formulario;
- migraciones o cambios de constraints;
- repositorio docente, UI o workflow editorial;
- IA evaluadora, OpenAI, retries de modelos o auditor;
- RLS, grants, TLS o despliegue Supabase.

## 18. Matriz final de invariantes

| Invariante | Defensa futura |
|---|---|
| La evaluación usa el snapshot de la entrevista | B2 desde `sessions.case_version_id` y verificación repetida bajo lock |
| Una versión archivada sigue siendo evaluable | policy B2 `PUBLISHED | ARCHIVED` para sesiones existentes |
| Ownership no depende del cliente | B2 y `WHERE s.id = $1 AND s.user_id = $2 FOR UPDATE` |
| Primera evaluación definitiva | insert sin UPSERT y rama retry de solo lectura |
| Una evaluación física por sesión | algoritmo serializado + `UNIQUE (session_id)` |
| Evaluación y finalización son atómicas | una transacción y rollback ante cualquier fallo |
| Retry no recomputa ni sobrescribe | `finished + evaluación -> persisted result` |
| Concurrencia no crea dos resultados | lock de sesión antes de inspeccionar evaluación |
| Estados legacy parciales no destruyen datos | `active + evaluación` conserva fila y solo finaliza sesión |
| Corrupción falla cerrada | `finished + sin evaluación` y mismatch de anclaje -> rollback/error genérico |
| Legacy no finge scoring V2 | scorer de compatibilidad sobre tres campos explícitos |
| Generated no usa formulario legacy | 422 hasta disponer de contrato V2 completo |
| Respuesta no filtra clínica | parser/proyección de cinco columnas públicas |
| `public.cases` deja de ser fuente | servicio consume exclusivamente evaluator runtime B2 |
| Retry no ejecuta scoring descartable | la matriz se decide bajo lock y el scorer solo corre para `active + sin evaluación` |
| Scoring bajo lock permanece acotado | scorer legacy puro, determinista, local, sin DB adicional, OpenAI ni red |
