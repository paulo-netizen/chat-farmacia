# 12 — Session Idempotency and Resume Design

**Incremento:** 4D-A
**Estado:** contrato de diseño técnico previo a implementación
**Ámbito:** sesiones físicas v1 (`active` / `finished`) sobre el esquema posterior a `0002_v2_case_versioning.sql`

Este documento define la solución transitoria de idempotencia y reanudación de sesiones mientras el producto aún no dispone de una identidad de actividad. No contiene una migración, no autoriza un despliegue y no sustituye las auditorías previas sobre los datos reales.

## 1. Evidencia del comportamiento actual

`app/chat/ChatClient.tsx` ejecuta actualmente `POST /api/sessions` desde un `useEffect` al montar el componente. Por tanto, cualquiera de estos eventos puede volver a invocar el inicio:

- montaje inicial;
- recarga;
- retry de interfaz o red;
- remount de React.

La ruta incorporada en 4C-B usa una conexión y una transacción para seleccionar una versión, validar la ficha, registrar la asignación y crear la sesión. Esto garantiza atomicidad de **una creación individual**, incluida la reversión de la asignación si falla el `INSERT` de sesión.

No garantiza idempotencia entre peticiones independientes. Dos `POST` concurrentes pueden abrir dos transacciones, seleccionar versiones, registrar asignaciones y crear dos sesiones `active`, porque no existe aún serialización por estudiante ni una restricción física que impida el duplicado.

El esquema actual confirma además que:

- `sessions` solo admite los estados físicos `active` y `finished`;
- `sessions.case_version_id` queda fijado e inmutable después de 0002;
- `case_assignments` se ancla al caso lógico, no a la versión;
- no existe `activity`, `activity_id` ni `course_activity_id`;
- `messages` persiste únicamente roles `student` y `patient`;
- `messages.id` es `bigint` y `created_at` puede empatar entre filas;
- `evaluations POST` finaliza la sesión mediante `status = 'finished'` y `finished_at = now()`.

## 2. Requisitos funcionales

El flujo objetivo debe satisfacer simultáneamente:

- una recarga no crea una sesión nueva;
- una petición repetida no crea una sesión nueva;
- dos `POST` concurrentes del mismo alumno no crean dos sesiones;
- una sesión `active` existente puede recuperarse;
- una sesión `finished` nunca se reutiliza como activa;
- una sesión nueva solo se crea tras una acción explícita del alumno.

La recuperación debe preservar exactamente:

- `session.id`;
- `case_id`;
- `case_version_id`;
- el snapshot histórico de esa versión;
- la ficha pública derivada de ese snapshot;
- los mensajes persistidos de la sesión.

No se puede sustituir la versión histórica por la versión actualmente publicada del mismo caso.

## 3. Límite actual: todavía no existe identidad de actividad

El requisito de producto es, en último término, «como máximo una sesión activa por alumno y actividad/asignación». El esquema actual no permite representar esa identidad: no existe una entidad estable de actividad ni una FK equivalente.

Por ello, un índice como:

```sql
UNIQUE (user_id) WHERE status = 'active'
```

no sería equivalente al requisito definitivo. Impondría como máximo una sesión activa global por alumno en toda la instalación y podría bloquear legítimamente actividades independientes futuras.

4D no inventará `activity_id`, no diseñará todavía cursos/actividades y no presentará esa unicidad global como solución permanente. Durante esta fase, el endpoint actual aplicará una protección transitoria por estudiante, coherente con que hoy solo existe un flujo global de inicio.

## 4. Protección inmediata: advisory transaction lock

### 4.1. Secuencia obligatoria

La operación `POST /api/sessions` debe usar una sola conexión y una sola transacción:

```text
autenticar
BEGIN
adquirir advisory transaction lock del user_id autenticado
buscar todas las sesiones active de ese usuario
  exactamente una → reanudarla
  ninguna         → seleccionar caso publicado y crear
  más de una      → fail closed
COMMIT
release
```

Ante cualquier error posterior a `BEGIN`, debe ejecutarse `ROLLBACK` y liberarse la conexión.

### 4.2. Clave del lock

`users.id` es `bigint`, por lo que no debe truncarse para utilizar el overload de dos enteros de 32 bits. La propuesta inmediata es una clave `bigint` derivada en PostgreSQL con un namespace estable del flujo, por ejemplo conceptualmente:

```sql
SELECT pg_advisory_xact_lock(
  hashtextextended(
    'chatusal:v2:student-session-start:' || $1::text,
    0
  )
);
```

`$1` procede exclusivamente del usuario autenticado. El namespace evita colisiones intencionadas con futuros usos de advisory locks. Una colisión de hash accidental solo serializaría alumnos no relacionados; sería una pérdida de concurrencia segura, no una pérdida de idempotencia.

El valor exacto del namespace debe fijarse como constante server-side y probarse; no debe llegar desde el cliente.

### 4.3. Propiedades de seguridad

El lock debe ser:

- transaction-scoped mediante `pg_advisory_xact_lock`;
- adquirido después de `BEGIN` y antes de buscar la sesión activa;
- liberado automáticamente por `COMMIT`, `ROLLBACK` o cierre de la conexión;
- compartido por todas las instancias de aplicación conectadas a la misma base;
- independiente de la memoria del proceso Node.

No son garantías válidas:

- mutex JavaScript;
- variables globales;
- locks en memoria;
- `localStorage`;
- deshabilitar visualmente un botón.

Todas las rutas futuras capaces de iniciar una sesión académica deberán respetar el mismo protocolo mientras no exista la restricción física definitiva.

### 4.4. Recheck tras esperar

La segunda petición concurrente del mismo alumno espera el lock. Cuando lo obtiene, **debe volver a consultar** las sesiones `active`; no puede reutilizar el resultado de una lectura anterior. Así observa la sesión que la primera petición acaba de confirmar y devuelve esa misma sesión sin escribir.

## 5. Semántica idempotente de `POST /api/sessions`

`POST /api/sessions` pasa a representar la operación idempotente «iniciar o devolver el inicio activo actual».

Después de adquirir el lock:

### 5.1. Exactamente una sesión activa

Si existe exactamente una fila con:

```text
sessions.user_id = authenticated user.id
sessions.status = active
```

la ruta debe:

1. recuperar la misma `session.id`, `case_id` y `case_version_id`;
2. recuperar la fila versionada exacta referenciada por la sesión;
3. validar el anclaje sesión–caso–versión;
4. proyectar la ficha pública mediante la API semántica de reanudación;
5. construir el mismo `StudentSessionDto` de cinco claves;
6. confirmar la transacción.

No debe:

- buscar un caso nuevo;
- crear o actualizar `case_assignments`;
- insertar otra sesión;
- sustituir la versión histórica por otra publicada.

### 5.2. Ninguna sesión activa

La ruta continúa con el flujo 4C-B:

1. seleccionar una única versión `PUBLISHED` con `FOR SHARE`;
2. normalizar `case_id`;
3. resolver y validar la ficha pública;
4. registrar la asignación del caso lógico;
5. insertar `sessions(user_id, case_id, case_version_id)`;
6. construir el DTO público;
7. confirmar.

Este camino solo debe invocarse por la acción explícita del alumno. Que no exista una sesión activa no autoriza al frontend a crear una durante el montaje.

### 5.3. Más de una sesión activa

La ruta debe fallar de forma cerrada según la política de la sección 8.

### 5.4. Contrato HTTP

Tanto creación como reanudación devuelven exactamente:

```ts
{
  sessionId: string;
  nombre: string;
  edad: number;
  sexo: string;
  tratamiento: string;
}
```

No se añaden `caseId`, `caseVersionId`, `resumed`, `content` ni objetos anidados. La igualdad del contrato evita que el navegador distinga caminos internos que no necesita conocer.

## 6. Estado de la versión: nueva sesión frente a reanudación

Las políticas son deliberadamente distintas:

| Operación | Estados admisibles de `case_versions` |
|---|---|
| Crear sesión nueva | únicamente `PUBLISHED` |
| Reanudar sesión `active` existente | `PUBLISHED` o `ARCHIVED` |

Una versión puede pasar válidamente de `PUBLISHED` a `ARCHIVED` después de crear una sesión. Archivar impide nuevas sesiones, pero no invalida la sesión histórica ni autoriza a cambiar su snapshot.

Una sesión `active` anclada a `AI_DRAFT`, `TEACHER_DRAFT`, `IN_REVIEW` o `VALIDATED` debe producir un fallo cerrado. Una sesión válida nunca debió crearse contra esos estados; tratarla como reanudable ocultaría corrupción o un despliegue incoherente.

La consulta de la sesión activa no debe filtrar previamente solo los estados reanudables de la versión. Debe encontrar primero todas las sesiones `active` del usuario y validar después la versión. De otro modo, una sesión activa con una versión inválida podría quedar invisible y el servicio crearía otra.

## 7. Reutilización segura del resolver público

`resolveStudentPublicCaseVersionV2` exige actualmente `PUBLISHED`. Esa semántica debe conservarse para nuevas sesiones.

4D-B1 debe extraer una proyección interna compartida que mantenga exactamente:

- parseo allowlist de `LEGACY_V1_SNAPSHOT` desde `content.spec`;
- parseo allowlist de `GENERATED_CASE_BUNDLE_V2` desde `sourceOfTruth.patientFacts.publicProfile`;
- validación nominal de `CaseVersionId`;
- coherencia de identidad del bundle;
- validación de `case_id`;
- reconstrucción de objetos sin propagar referencias contaminadas;
- congelación de la salida;
- errores seguros sin serializar contenido.

Sobre ese núcleo deben existir dos APIs públicas semánticas, no un parámetro arbitrario de estados controlado por cualquier caller:

- `resolveStudentPublicCaseVersionV2`: solo creación, acepta `PUBLISHED`;
- una nueva API explícita para sesión existente, por ejemplo `resolveStudentPublicCaseVersionForResumeV2`: acepta únicamente `PUBLISHED | ARCHIVED`.

Ambas devuelven el mismo contrato público. La segunda no debe aceptar estados editoriales ni debilitar la primera.

## 8. Sesiones activas legacy duplicadas

No puede asumirse que producción carece de duplicados históricos. Antes del despliegue debe ejecutarse una auditoría read-only equivalente a:

```sql
SELECT
  user_id,
  count(*) FILTER (WHERE status = 'active') AS active_count
FROM public.sessions
GROUP BY user_id
HAVING count(*) FILTER (WHERE status = 'active') > 1;
```

La auditoría operativa puede añadir IDs y fechas ordenados para facilitar revisión, sin modificar filas.

Si el endpoint encuentra más de una sesión `active` para el usuario:

- no elige una al azar;
- no elige «la más reciente»;
- no finaliza las demás;
- no borra sesiones;
- no cambia estados silenciosamente;
- no crea una sesión adicional.

La política de esta fase es:

1. `ROLLBACK`;
2. respuesta HTTP 500 genérica;
3. diagnóstico server-side con identificadores técnicos mínimos y recuento, sin contenido clínico;
4. resolución explícita del legado antes del despliegue.

Una reconciliación posterior requerirá una decisión humana basada en datos reales. El advisory lock evita nuevos duplicados creados por el endpoint, pero no repara los existentes.

## 9. Endpoint read-only de recuperación

### 9.1. Opción elegida

Se elige:

```text
GET /api/sessions/active
```

El montaje de `ChatClient` todavía no conoce un `sessionId`; por ello, un endpoint por UUID obligaría al navegador a mantener un identificador externo y no resolvería el descubrimiento de la sesión activa. `GET /active` utiliza solo la identidad autenticada, reduce la superficie de enumeración y expresa directamente la intención del flujo.

### 9.2. Semántica

- Sin sesión activa: `204 No Content`.
- Exactamente una válida: `200` con sesión pública e historial.
- Más de una activa, anclaje inválido o estado de versión no reanudable: error genérico fail-closed.
- Sin autenticación: `401`.

El endpoint es read-only: no crea assignment, no inserta sesión, no modifica estados y no genera mensajes.

### 9.3. Contrato propuesto

Cuando existe una sesión:

```ts
{
  session: {
    sessionId: string;
    nombre: string;
    edad: number;
    sexo: string;
    tratamiento: string;
  };
  messages: Array<{
    role: 'student' | 'patient';
    content: string;
  }>;
}
```

No se devuelven IDs de mensajes, timestamps, `caseId`, `caseVersionId`, contenido versionado ni datos docentes. El servidor puede usar `messages.id` y `created_at` para ordenar sin exponerlos.

El `POST` conserva su DTO pequeño actual. La recuperación extensa del historial pertenece al `GET`, lo que mantiene separadas las responsabilidades de inicio y reconstrucción de interfaz.

## 10. Recuperación y orden de mensajes

`/api/chat` ya persiste cada mensaje del alumno y cada respuesta del paciente en `public.messages`. Sin embargo, `ChatClient` mantiene el historial solo en estado React y lo pierde al recargar.

`GET /api/sessions/active` debe recuperar únicamente mensajes de la sesión autorizada con roles permitidos por el esquema:

```text
student | patient
```

El orden canónico será:

```sql
ORDER BY messages.created_at ASC, messages.id ASC
```

`created_at` por sí solo, como usa actualmente `/api/chat`, no es determinista cuando dos filas comparten timestamp. 4D-B3 debe usar el orden compuesto en recuperación y alinear la consulta de historial de `/api/chat` para que conversación y reanudación observen la misma secuencia.

Solo los mensajes realmente persistidos cuentan como historial. El frontend no debe reconstruir mensajes clínicos inventados localmente.

## 11. Autorización y aislamiento

Toda recuperación debe derivar el usuario de la autenticación server-side. No se acepta `user_id` del cliente.

`GET /api/sessions/active` debe imponer en SQL y validar en el boundary:

```text
sessions.user_id = authenticated user.id
sessions.status = active
```

El historial se consulta únicamente después de seleccionar esa sesión autorizada, o mediante un join que repita la condición de ownership. Conocer un UUID de sesión ajeno nunca debe permitir recuperar ficha o mensajes.

La consulta de sesión debe recuperar también el snapshot exacto de `case_versions` y validar:

- `sessions.case_version_id = case_versions.id`;
- `sessions.case_id = case_versions.case_id`;
- estado `PUBLISHED | ARCHIVED` para reanudación.

Después se usa el resolver semántico de reanudación y el DTO allowlist. No se devuelve la fila DB ni `content`.

## 12. Flujo objetivo de `ChatClient`

El montaje deja de ejecutar `POST /api/sessions` automáticamente.

### Al montar

1. ejecutar `GET /api/sessions/active`;
2. si devuelve una sesión, restaurar `sessionData` y los mensajes persistidos;
3. si devuelve `204`, mostrar la acción explícita **«Comenzar caso»**;
4. si devuelve `401`, redirigir a login;
5. ante incoherencia, mostrar error sin crear una sesión.

### Al pulsar «Comenzar caso»

1. ejecutar `POST /api/sessions`;
2. usar el DTO devuelto;
3. si el request se repite por retry o concurrencia, recibir la misma sesión `active`;
4. consultar después `GET /api/sessions/active` si es necesario para obtener el historial canónico, sin ampliar el DTO del `POST`.

Deshabilitar el botón mientras espera mejora UX, pero no es la garantía de idempotencia; la garantía inmediata es lock + recheck en PostgreSQL.

## 13. Mensaje inicial del paciente: deuda explícitamente diferida

Al crear la sesión, `ChatClient` introduce hoy localmente:

> «Hola, soy el paciente. Puedes hacerme las preguntas que consideres para entender mejor mi situación con la medicación.»

Ese texto:

- no está persistido;
- se recrea en cada reload;
- no es la demanda inicial real del caso;
- contiene lenguaje genérico/metadocente.

4D no lo sustituye ni genera un mensaje nuevo. Al reanudar, solo se muestran filas persistidas en `public.messages`. La demanda inicial factual y su persistencia pertenecen a la fase posterior de paciente V2.

Hasta entonces, una sesión sin mensajes persistidos se reanuda con historial vacío; no se fabrica el saludo local como si formara parte de la transcripción.

## 14. Finalización y nuevo inicio

Mientras la implementación física v1 siga activa, solo existen:

- `active`;
- `finished`.

`POST /api/evaluations` cambia la sesión a `finished` y fija `finished_at`. Desde ese momento:

- `GET /api/sessions/active` no la devuelve;
- `POST /api/sessions` no la reutiliza;
- una acción explícita posterior puede crear una nueva sesión, sujeta a la política disponible.

Este comportamiento no define todavía número de intentos por actividad. Sin identidad de actividad ni política de intentos, 4D solo evita reutilizar una sesión terminada y evita duplicados activos en el flujo global actual.

No se introducen aún `completed`, `abandoned` ni otros estados conceptuales ricos.

## 15. Protección inmediata frente a invariante definitivo

### 15.1. Protección inmediata

Para el esquema actual:

- advisory transaction lock por usuario;
- recheck de sesiones `active` bajo el lock;
- fail-closed ante duplicados históricos;
- protocolo obligatorio para todas las rutas de creación.

Esto funciona con varias instancias Node, pero sigue siendo una convención de aplicación: una ruta o script que no tome el lock puede crear otro duplicado.

### 15.2. Invariante físico definitivo

Cuando exista una identidad estable de actividad, la base debe defender:

```text
como máximo una sesión active por user_id + activity_id
```

La defensa definitiva será un índice único parcial o constraint equivalente sobre la identidad real de actividad y el estado activo. Su diseño requiere primero definir la entidad, relaciones, política de intentos y migración de datos.

4D no diseña `activity_id` ni añade una unicidad global incorrecta por `user_id`.

## 16. Auditorías y despliegue coordinado

Antes de aplicar 0002 y activar las rutas versionadas en producción deben completarse, como mínimo:

1. auditoría read-only de sesiones `active` duplicadas por usuario;
2. auditoría de sesiones sin owner válido mediante comparación con `users`;
3. auditoría de mensajes huérfanos mediante comparación con `sessions`;
4. revisión humana y plan no destructivo para cada anomalía;
5. verificación de 0001 + 0002 y del flujo de aplicación en PostgreSQL 17.10 desechable o copia segura;
6. despliegue coordinado de DB y aplicación compatible.

Consultas conceptuales de auditoría:

```sql
-- Duplicados activos
SELECT user_id, count(*) AS active_count
FROM public.sessions
WHERE status = 'active'
GROUP BY user_id
HAVING count(*) > 1;

-- Owner inexistente
SELECT s.id, s.user_id
FROM public.sessions AS s
LEFT JOIN public.users AS u ON u.id = s.user_id
WHERE u.id IS NULL;

-- Mensaje huérfano
SELECT m.id, m.session_id
FROM public.messages AS m
LEFT JOIN public.sessions AS s ON s.id = m.session_id
WHERE s.id IS NULL;
```

Estas auditorías son de solo lectura. No autorizan borrar, finalizar, reasignar ni reconciliar automáticamente datos.

## 17. Manejo de errores y observabilidad

Las respuestas externas de creación y recuperación deben ser genéricas y no serializar:

- filas DB;
- `content`;
- ficha interna;
- ground truth;
- `caseVersionId`;
- mensajes internos PostgreSQL;
- diagnósticos de duplicidad.

El log server-side puede registrar, con minimización:

- código estable del fallo;
- `user_id` autenticado;
- número de sesiones activas encontrado;
- IDs técnicos de sesión cuando sean necesarios para reconciliación;
- request/correlation ID futuro.

Nunca debe registrar el contenido clínico solo para diagnosticar idempotencia.

## 18. Pruebas requeridas para los incrementos de implementación

Las pruebas mock y PostgreSQL reales deberán demostrar:

- dos `POST` concurrentes devuelven el mismo `sessionId`;
- solo se persiste una sesión `active`;
- el segundo request espera y vuelve a consultar después del lock;
- reintentos secuenciales no insertan assignment ni sesión;
- sesión `PUBLISHED` se reanuda;
- sesión `ARCHIVED` se reanuda;
- estados editoriales fallan cerrados;
- `finished` no se recupera como activa;
- duplicados legacy fallan sin mutación;
- ownership se impone en servidor;
- UUID ajeno no permite recuperar datos;
- historial se ordena por `created_at, id`;
- ninguna respuesta filtra información protegida;
- reload restaura el mismo ID y mensajes;
- un nuevo inicio tras `finished` requiere acción explícita.

## 19. Plan incremental

### 4D-B1 — Resolver puro para reanudación

- extraer la proyección compartida;
- conservar `resolveStudentPublicCaseVersionV2` para creación `PUBLISHED`;
- añadir API semántica `PUBLISHED | ARCHIVED` para sesión existente;
- añadir pruebas de allowlist, identidad, contaminación y estados.

### 4D-B2 — `POST /api/sessions` idempotente

- adquirir advisory transaction lock tras `BEGIN`;
- buscar sesiones activas bajo el lock;
- reanudar exactamente una;
- fallar ante múltiples;
- crear solo cuando no exista activa;
- conservar DTO y atomicidad 4C-B;
- probar orden, recheck, cero writes en resume y errores genéricos.

### 4D-B3 — Recuperación read-only

- crear `GET /api/sessions/active`;
- exigir ownership server-side;
- usar resolver de reanudación;
- recuperar mensajes `student | patient`;
- ordenar por `created_at ASC, id ASC`;
- alinear el orden del historial usado por `/api/chat`;
- responder `204` cuando no exista activa;
- probar fuga, UUID ajeno, duplicados y estados inválidos.

### 4D-B4 — Inicio explícito y reanudación en `ChatClient`

- eliminar `POST` automático del `useEffect`;
- consultar sesión activa al montar;
- restaurar sesión y mensajes;
- mostrar «Comenzar caso» cuando no exista;
- ejecutar `POST` solo desde esa acción;
- no recrear como historial el saludo local genérico.

### 4D-C — Verificación PostgreSQL 17.10 real

- concurrencia real de dos `POST`;
- reload/retry con mismo `sessionId`;
- reanudación de versiones `PUBLISHED` y `ARCHIVED`;
- historial determinista;
- fail-closed con duplicados legacy;
- rollback y ausencia de escrituras extra;
- limpieza completa del entorno desechable.

## 20. Fuera de alcance

Este diseño no incorpora:

- paciente V2 o demanda inicial;
- evaluator V2;
- nuevo runtime de chat;
- modelo de actividades;
- estados de sesión enriquecidos;
- política completa de intentos;
- RLS;
- TLS;
- despliegue de producción;
- reconciliación automática de legado.
