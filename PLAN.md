# PLAN.md — ChatUSAL-FarmaBot v2

## Estado

**Fase actual:** auditoría de arquitectura y v1 completada el 15/08/2026.

**Autorización:** análisis y planificación; todavía no se ha autorizado implementar M0 ni funcionalidades v2.

**Repositorio auditado:** Next.js 14.2.15 en la rama `chatusal-v2`.

No se han encontrado contradicciones sustantivas entre `docs/v2/00_MASTER_SPEC.md` y los documentos temáticos de `docs/v2/`; estos últimos son extractos coherentes de la especificación maestra.

---

# 1. Arquitectura actual confirmada

- Aplicación monolítica Next.js 14 App Router con React 18 y TypeScript estricto.
- Las páginas de estudiante y profesor viven en `app/`; no hay middleware global.
- Los Route Handlers de `app/api/` contienen autenticación, consultas SQL, reglas de negocio y llamadas de IA sin capas de dominio o repositorio.
- PostgreSQL se consume directamente con `pg.Pool`; el README presupone Supabase y ejecución manual de `db/schema.sql` y `db/seed.sql`.
- Autenticación propia mediante email/contraseña con `crypt()` de PostgreSQL y JWT HS256 en cookie `auth_token` de siete días.
- Autorización mediante comprobaciones puntuales de rol o propiedad dentro de páginas y endpoints.
- OpenAI se usa desde servidor mediante Chat Completions: paciente en `app/api/chat/route.ts` y generador en `app/api/cases/ai/route.ts`.
- Los casos combinan `spec jsonb` y `ground_truth jsonb`; no existen proyecciones tipadas pública/paciente/evaluador.
- Las sesiones y mensajes se persisten en PostgreSQL. La evaluación final es determinista, 0–3, y no evalúa la entrevista.
- No hay cuestionario v2, versionado, auditor de casos, validador de respuestas del paciente, preview docente ni observabilidad estructurada.
- No hay framework de tests, archivos de test, script `test` o script `typecheck`.

## Límites y despliegue

- Todo se despliega como una sola aplicación Next.js conectada a PostgreSQL y OpenAI.
- `.env.example` documenta `DATABASE_URL`, `OPENAI_API_KEY`, `APP_SECRET` y precios; no documenta `SUPABASE_DB_URL` ni `OPENAI_MODEL_CASES`, aunque el código los usa.
- `lib/db.ts` desactiva globalmente la validación TLS (`NODE_TLS_REJECT_UNAUTHORIZED=0`) y además configura `rejectUnauthorized: false`, también en producción.
- No hay Dockerfile, CI, configuración de Render/Vercel, health check ni procedimiento de migración automatizado en el repositorio.
- `next.config.mjs` conserva `experimental.appDir`, opción obsoleta/innecesaria para Next 14.

---

# 2. Esquema real y estado de migraciones

## Inventario de `db/schema.sql`

| Tabla | Campos principales | Restricciones relevantes |
|---|---|---|
| `users` | `id`, `email`, `password_hash`, `name`, `role`, `created_at` | roles `student/teacher/admin`; email único |
| `cases` | `id`, `title`, `description`, `spec`, `ground_truth`, `difficulty`, `status`, `created_by`, `created_at` | estados `proposed/approved/archived` |
| `sessions` | `id`, `user_id`, `case_id`, `status`, tiempos, tokens, coste | estados `active/finished`; referencia mutable a `cases` |
| `messages` | `id`, `session_id`, `role`, `content`, `created_at` | roles `student/patient`; cascade al borrar sesión |
| `evaluations` | respuestas del alumno, tres booleanos, `score`, `feedback` | una evaluación por sesión |

## Estado confirmado

- No existe directorio ni historial de migraciones: solo un esquema acumulativo ejecutado manualmente.
- `schema.sql` no define `case_assignments`, pero `/api/sessions` la consulta e inserta.
- `schema.sql` no define `cases.service_type`, pero creación, edición, sesión, listados y chat lo usan.
- `schema.sql` no define `cases.updated_at`, pero el PUT de casos lo actualiza.
- El constraint de `cases.status` permite `proposed/approved/archived`; las APIs y UI usan combinaciones incompatibles de `draft/approved/rejected`, mientras sesiones también consultan `published`.
- El seed usa `intervenciones_validas`; el generador y editor nuevo producen `intervenciones_recomendadas`; la evaluación solo lee `intervenciones_validas`.
- `created_by` existe, pero el POST de casos no lo guarda.
- No existen asignaciones en el esquema reproducible, versionado de casos, snapshots, protocolos, rúbricas, cuestionarios, evidencias, alertas, revisiones docentes ni métricas por llamada.
- No puede inferirse el esquema desplegado real sin acceso explícito a esa base. El código sugiere cambios manuales no capturados en el repositorio.

## Riesgos de compatibilidad de datos

- Aplicar `schema.sql` a una base limpia produce una aplicación que falla en rutas esenciales.
- Endurecer estados sin mapear valores existentes puede invalidar filas o retirar casos activos.
- Corregir el nombre de intervenciones requiere aceptar ambos nombres durante transición y normalizar datos existentes sin perderlos.
- El futuro versionado debe conservar cada caso v1 y enlazar sesiones históricas a un snapshot o versión legado inmutable.
- Antes de iniciar la parte migratoria de M0 se necesita un inventario de solo lectura del esquema y valores de producción/staging; no debe asumirse que coincide con `schema.sql`.

---

# 3. Inventario de endpoints y acciones

| Ruta/acción | Acceso actual | Comportamiento y observaciones |
|---|---|---|
| `POST /api/auth/login` | público | valida con `crypt`, emite JWT y devuelve perfil; sin rate limit ni validación tipada |
| `POST /api/auth/logout` | público | expira cookie |
| `POST /api/cases` | teacher/admin | crea caso; acepta JSON como strings; por defecto lo deja `approved`; usa columnas ausentes del esquema |
| `GET /api/cases/:id` | teacher/admin | devuelve caso completo, incluido `ground_truth` |
| `PUT /api/cases/:id` | teacher/admin | sobrescribe el caso in situ; no versiona; usa `updated_at` ausente |
| `POST /api/cases/ai` | teacher/admin | genera borrador JSON y lo devuelve; sin schema runtime, auditoría o verificación CIMA |
| `POST /api/sessions` | cualquier autenticado | asigna caso aleatorio, crea siempre sesión y devuelve `SELECT c.*` completo |
| `POST /api/chat` | propietario de sesión | persiste mensaje, envía historial y caso al modelo, persiste respuesta |
| `POST /api/evaluations` | propietario de sesión | compara strings, hace upsert y finaliza sesión |
| páginas `/chat` | autenticado | monta `ChatClient`, que crea sesión automáticamente |
| páginas `/profesor*` | teacher/admin | consultas directas server-side; listado básico, creación/edición JSON y resumen de sesiones |

No existen endpoints GET para recuperar/reanudar sesión o mensajes, inicio explícito idempotente, finalización separada de evaluación, cuestionario, detalle de transcripción docente, revisión de evaluación o preview.

---

# 4. Problemas v1 confirmados directamente

## Seguridad y autorización

1. **Fuga crítica de datos protegidos:** `/api/sessions` devuelve `caseRow` proveniente de `SELECT c.*`; contiene `ground_truth`, `description`, todo `spec`, `service_type`, metadatos y potenciales campos futuros. La UI no renderiza algunos campos, pero el navegador los recibe.
2. **El modelo paciente recibe la solución docente:** el prompt incluye diagnóstico, problema farmacoterapéutico, tipo de no adherencia y barrera. Esto amplía el impacto de prompt injection y mezcla paciente/evaluador.
3. **Rol insuficiente en sesiones:** cualquier usuario autenticado, incluidos teacher/admin, puede crear sesiones académicas normales. No existe preview separado.
4. **TLS inseguro global:** se desactiva la verificación de certificados para todo el proceso y la conexión PostgreSQL acepta certificados no confiables.
5. **Validación de entrada débil:** predominan `any`, casts y comprobaciones parciales; no hay límites de longitud, enums únicos, schemas runtime ni normalización consistente.
6. **Sin controles antiabuso:** login y llamadas de IA carecen de rate limiting; tampoco hay protección explícita contra concurrencia/repetición.
7. **JWT largo sin revocación:** siete días, sin `jti`, sesión server-side, rotación o control de usuario desactivado. La cookie `secure: true` puede impedir login por HTTP local.

## Exposición y aislamiento

- Se confirma la fuga de `ground_truth` al cliente antes de la entrevista.
- También se envían al cliente `motivo_consulta`, antecedentes, contexto y descripción interna dentro de `spec`, aunque no se rendericen.
- No existe una función única y testeable `student_public_view`; cualquier columna agregada a `cases` pasaría automáticamente por `c.*`.
- Chat y evaluación sí comprueban propiedad de sesión; este control es reutilizable, pero debe centralizarse y probarse.
- El panel profesor muestra todas las sesiones/casos a cualquier teacher. Este alcance global coincide con la decisión fijada para la primera v2; falta centralizarlo para permitir restricciones futuras por curso/grupo.

## Sesiones y persistencia

- `ChatClient` ejecuta `POST /api/sessions` en `useEffect`; montar, recargar o remontar crea una nueva sesión.
- El saludo inicial es texto local no persistido y metadocente: “soy el paciente… puedes hacerme las preguntas…”. El primer mensaje real del paciente solo aparece después de que escriba el alumno.
- No se puede recuperar una sesión activa ni su historial tras recargar.
- No hay idempotency key, transacción que abarque asignación y creación, ni restricción que evite varias sesiones activas equivalentes.
- Mensaje del alumno y respuesta del paciente no se escriben atómicamente; un fallo de OpenAI deja un turno huérfano.
- Dos envíos concurrentes pueden desordenar historial y respuestas; el orden usa solo `created_at`, sin número de turno.
- El estudiante abre el formulario final en cliente, pero la sesión sigue activa hasta enviar la evaluación.

## Casos y generación IA

- Un caso manual o generado puede guardarse directamente como `approved`, que equivale a disponible para alumnos; no hay validación docente diferenciada ni auditoría.
- La IA generadora no publica por sí sola, pero el flujo UI permite generación → guardado inmediato como aprobado, incumpliendo el control obligatorio.
- El resultado IA se valida solo con `JSON.parse`; no se verifica estructura, completitud clínica, coherencia o tipos.
- El generador hardcodea SAT, taxonomías, ejemplos y modelo fallback; no separa generador y auditor.
- El editor exige modificar JSON y sobrescribe casos utilizados, alterando retroactivamente lo que ve el runtime/evaluador de sesiones históricas.

## Prompt del paciente

- No incluye defensa explícita frente a prompt injection, prohibición de revelar prompt/solución o respuesta natural segura ante ataques.
- No prohíbe inventar datos no definidos ni distingue `null/desconocido` de “ninguno”.
- Sugiere que el modelo puede contar hábitos, síntomas, miedos y creencias al profundizar, incluso si no están definidos en el caso.
- No hay reglas estructuradas de revelación, control de hechos ya dichos, consistencia longitudinal, validación de salida, regeneración o respuesta segura.
- La personalidad vive dentro de `ground_truth`, otra mezcla de vistas y responsabilidades.
- El modelo paciente está hardcodeado como `gpt-4o-mini`; el generador usa otra configuración aislada.

## Evaluación

- Solo evalúa tres respuestas post-chat y no analiza la transcripción, SPFA, PRM/RNM, comunicación, seguridad o razonamiento.
- Tipo y barrera exigen igualdad literal tras minúsculas; las intervenciones exigen coincidencia literal exacta.
- El seed y generador usan claves distintas, por lo que casos generados pueden tener cero intervenciones correctas para el evaluador.
- Una sola intervención coincidente marca toda la categoría como correcta; no hay adecuación, personalización ni evidencia.
- La puntuación es 0–3, no las cuatro puntuaciones 0–100 requeridas ni la comprensión independiente.
- El feedback revela las respuestas correctas inmediatamente, pero no hay estado de finalización/cuestionario que controle cuándo está autorizado.
- El upsert permite reevaluar y sobrescribir silenciosamente; no conserva versión automática original, historial ni revisión docente.

## Panel docente

- Muestra solo las últimas 100 sesiones `finished`, nota 0–3, feedback, tokens y coste agregado.
- No permite abrir transcript, respuestas, evidencia, alertas, confianza, versión del caso, cuestionario ni revisión/override auditado.
- Creación y edición son JSON técnico; no hay preview, auditoría, validación o ciclo de vida v2.

---

# 5. Componentes reutilizables y componentes a reemplazar

## Reutilizables con endurecimiento

- Estructura Next.js App Router y separación física básica entre server components, client components y Route Handlers.
- PostgreSQL, `pg.Pool`, consultas parametrizadas y UUID de sesión.
- Hash de contraseñas con `crypt()` y cookie HTTP-only como base, sujeto a revisión de sesión/CSRF/rate limit.
- Comprobación de propiedad `s.user_id = user.id` presente en chat y equivalente en evaluación.
- Persistencia de mensajes, tokens y coste como base para trazabilidad, añadiendo orden, modelo, prompt y métricas por llamada.
- Pantallas básicas de login, chat y profesor como esqueletos de navegación, no como implementación v2 completa.

## A reemplazar o encapsular

- `c.*` y objetos de caso sin proyecciones: reemplazar por selectores/DTOs explícitos y schemas runtime.
- `db/schema.sql` como mecanismo acumulativo: sustituir por migraciones versionadas reproducibles y mantener un bootstrap derivado/verificado.
- Ciclo de vida y edición in-place de casos: sustituir por casos + versiones inmutables.
- Creación automática de sesiones: sustituir por inicio explícito, idempotente y recuperable.
- Prompt monolítico con `ground_truth`: sustituir por builder de `patient_runtime_view`, política de desconocidos y validador de salida.
- Evaluador 0–3 por strings: mantener solo como compatibilidad legado claramente etiquetada hasta el evaluador v2.
- Formularios JSON como interfaz docente principal: sustituir en M2, no en M0.
- Desactivación TLS global: eliminar y configurar confianza de certificados por entorno.

---

# 6. Arquitectura objetivo propuesta

Mantener el monolito modular de Next.js para evitar una reescritura, pero introducir límites internos explícitos:

1. `lib/auth/`: autenticación, autorización por rol/alcance y propiedad de recursos.
2. `lib/validation/`: schemas runtime para cada API y DTO de salida.
3. `lib/cases/`: repositorio, ciclo de vida, versionado y tres proyecciones conceptuales exactas (`student_public_view`, `patient_runtime_view`, `evaluator_view`).
4. `lib/sessions/`: inicio idempotente, reanudación, máquina de estados y autorización.
5. `lib/ai/`: clientes/configuración y módulos separados `case-generator`, `case-auditor`, `patient`, `patient-output-validator`, `evaluator`.
6. `lib/evaluation/`: protocolos/rúbricas versionados, evidencias y compatibilidad legado.
7. Route Handlers delgados que autentican, validan, llaman servicios y serializan DTOs permitidos.
8. PostgreSQL como fuente de verdad, con migraciones append-only, constraints, snapshots/versiones y auditoría.

La división es modular dentro del repositorio actual; no se propone microservicios en M0 ni una reescritura de UI.

---

# 7. Estrategia de migración preservando datos

1. Obtener snapshot de solo lectura del esquema desplegado y conteos/valores distintos, sin copiar datos clínicos reales al desarrollo.
2. Comparar `db/schema.sql` con Supabase/staging/producción. `db/schema.sql` no es evidencia suficiente para construir ni cerrar `0001_v1_baseline.sql`.
3. Crear la baseline definitiva únicamente después de esa comparación, representando la base v1 desplegada real; no editar producción a mano.
4. Añadir primero columnas/tablas de forma compatible y nullable; rellenar datos en pasos separados e idempotentes.
5. Adoptar como estados canónicos objetivo `AI_DRAFT`, `TEACHER_DRAFT`, `IN_REVIEW`, `VALIDATED`, `PUBLISHED` y `ARCHIVED`.
6. Aplicar el mapeo legado fijado: `proposed`, `draft` y `rejected` → `TEACHER_DRAFT`; `published` → `PUBLISHED`; `archived` → `ARCHIVED`.
7. No migrar automáticamente `approved`. Confirmar primero en el código y posteriormente en esquema/datos desplegados si representa semánticamente `VALIDATED` o `PUBLISHED`; conservarlo sin reinterpretar hasta entonces.
8. Normalizar intervenciones con lectura dual (`intervenciones_validas` y `intervenciones_recomendadas`) y backfill no destructivo antes de retirar el alias legado.
9. Crear una versión legado por cada caso existente y enlazar cada sesión histórica a ella; el contenido se copia como snapshot, no se mueve ni borra.
10. Mantener temporalmente `sessions.case_id` y campos v1 mientras se comprueba `case_version_id`; retirar solo en un hito posterior y con verificación.
11. Añadir índices/constraints después del backfill y de detectar duplicados/datos inválidos.
12. Probar migración hacia delante sobre una copia anonimizada y probar creación limpia desde cero; documentar rollback lógico. No usar migraciones destructivas en M0.

## Decisiones de arquitectura ya fijadas

- **Sesiones/intentos:** como máximo una sesión activa por actividad/asignación y estudiante. Recarga, cierre del navegador, desconexión o regreso posterior recuperan esa sesión. Solo una acción explícita crea sesión, y únicamente si la política de la actividad permite otro intento. La creación será idempotente, incluida la concurrencia.
- **Asignación:** el modelo debe admitir asignación automática y asignación explícita futura por profesor/actividad/grupo. M0 no construye cursos/grupos, pero `case_assignments` debe incluir o poder incorporar contexto de actividad, método/origen y vigencia sin quedar limitada al par estudiante-caso.
- **Alcance teacher:** en la primera v2, cualquier teacher accede a todos los casos y sesiones docentes autorizadas de la instalación. Las comprobaciones deben centralizarse para añadir después alcance por curso/grupo sin reescribir endpoints. La gestión restringida no pertenece a M0.
- **TLS:** producción nunca usará `NODE_TLS_REJECT_UNAUTHORIZED=0` ni otra desactivación global. El cambio definitivo se cerrará solo con la configuración TLS oficialmente soportada por PostgreSQL/Supabase; hasta entonces no se asumirá una CA o modo de conexión.
- **Separación de información:** se mantienen estrictamente `student_public_view`, `patient_runtime_view` y `evaluator_view`. El paciente recibe hechos y reglas necesarios para representar la situación, no etiquetas docentes o soluciones cuando los hechos permiten inferirlas; por ejemplo, hechos de tomas omitidas y rutina en vez de `tipo_no_adherencia` o `barrera_correcta`.
- **Privacidad M0:** casos exclusivamente ficticios, prohibición de datos identificativos de pacientes reales, minimización de información enviada al proveedor IA y arquitectura preparada para retención/borrado institucional posterior. La política institucional definitiva no bloquea M0.

---

# 8. Registro de riesgos

| Prioridad | Riesgo | Impacto / mitigación |
|---|---|---|
| Crítica | `ground_truth` y datos ocultos llegan al navegador | Bloquea uso estudiantil; DTO público allowlist y tests negativos en M0 |
| Crítica | Esquema reproducible incompatible con código | Bloquea despliegue limpio; inventario real y, después de contrastarlo, baseline/migraciones en la parte migratoria de M0 |
| Crítica | Casos usados son mutables | Resultados históricos no reproducibles; preparar snapshot/versionado sin sobrescribir |
| Alta | Paciente recibe solución y puede inventar/filtrar | Separar runtime view; la defensa completa y validador pertenecen a M4, pero M0 debe retirar etiquetas docentes innecesarias |
| Alta | TLS de base de datos sin verificación | Riesgo MITM/credenciales; retirar el bypass global en M0 y cerrar la configuración solo con instrucciones oficiales del proveedor |
| Alta | Sesiones duplicadas por recarga | Contamina intentos y estadísticas; inicio explícito/idempotencia/reanudación en M0 |
| Alta | Estados y nombres de campos divergentes | Fallos en runtime y puntuaciones falsas; vocabulario único y compatibilidad dual |
| Alta | IA generada puede quedar aprobada inmediatamente | Publicación sin revisión; bloqueo server-side de transición directa |
| Media | Sin tests ni CI | Regresiones silenciosas; arnés mínimo unitario/integración en M0 |
| Media | Escrituras chat no atómicas/concurrentes | Historial incompleto o desordenado; turn index/transacción/locking en hito de sesiones |
| Media | JWT/rate limiting/CSRF no definidos | Abuso y sesiones largas; decisión de seguridad institucional y hardening incremental |

---

# 9. Grafo de dependencias de hitos

```text
M0 Saneamiento y barreras de seguridad
 ├── M1 Versionado y base de datos v2
 │    ├── M2 Editor docente estructurado
 │    │    └── M3 Generador + auditor + validación/publicación
 │    ├── M4 Runtime del paciente seguro
 │    └── M5 Motor de protocolos SPFA
 │         └── M6 Evaluación farmacéutica/adherencia/PRM-RNM
 │              ├── M7 Evaluación de comunicación
 │              └── M8 Cuestionario post-caso
 │                   └── M9 Resultados y feedback
 │                        └── M10 Analítica y revisión docente
 └─────────────────────────────────────────────── M11 Hardening/observabilidad final
```

M4 puede avanzar en paralelo con M2 tras M1. M5 requiere definiciones clínicas humanas versionadas. M7 puede diseñarse en paralelo con M6, pero M9 necesita M6–M8.

---

# 10. Alcance detallado propuesto para M0

## Objetivo

Estabilizar v1 y colocar barreras verificables para que el trabajo v2 posterior no se construya sobre fugas, sesiones duplicadas o un esquema irreproducible. M0 no implementa todavía el modelo clínico/evaluador completo v2.

## Incluido

1. Definir el procedimiento de inventario y comparación del esquema desplegado con el repositorio. No crear ni cerrar archivos de baseline o migración hasta disponer de la información real de Supabase.
2. Introducir el vocabulario canónico v2 y el mapeo legado ya fijado, dejando `approved` explícitamente sin migración automática hasta conocer su semántica desplegada.
3. Añadir validación runtime y DTO allowlist para la creación de sesión: solo `sessionId`, nombre, edad, sexo y tratamiento.
4. Eliminar cualquier `SELECT c.*` en rutas estudiantiles y añadir tests que fallen ante cualquier clave protegida, incluso anidada.
5. Restringir creación de sesiones académicas a estudiantes y hacer el inicio explícito e idempotente por estudiante + actividad/asignación; recuperar la única sesión activa en recarga, reconexión o retorno.
6. Centralizar comprobaciones de propiedad para chat/evaluación y cubrir acceso cruzado y roles con tests.
7. Arreglar la divergencia de claves de intervenciones con compatibilidad de lectura y migración/backfill no destructivo.
8. Impedir en servidor que un resultado IA se guarde/publice directamente como disponible; debe quedar borrador pendiente de revisión, aunque el flujo v2 completo llegue en M3.
9. Retirar `ground_truth` y etiquetas docentes del contexto del paciente; construir `patient_runtime_view` con hechos estrictamente necesarios y documentar que el control completo antiinvención/validación queda en M4.
10. Eliminar la desactivación TLS global en producción y preparar configuración por proveedor. No cerrar la configuración definitiva antes de obtener las instrucciones oficiales de Supabase/PostgreSQL.
11. Añadir arnés de tests, scripts `typecheck`/`test`, fixtures y pruebas de integración de rutas/SQL; CI puede añadirse si el entorno de despliegue se confirma.
12. Actualizar README y `.env.example` solo para reflejar el procedimiento reproducible y variables realmente usadas.
13. Incorporar la advertencia y validaciones posibles de privacidad M0: solo casos ficticios, sin datos identificativos reales y minimización de payloads enviados a IA.

## Fuera de M0

- Modelo completo de casos/versiones/protocolos v2 (M1).
- Editor estructurado (M2), auditoría clínica IA (M3), personalidad/revelación y validador avanzado (M4).
- Motor SPFA, evaluación semántica/evidencias, cuestionario, notas 0–100 y panel avanzado (M5–M10).

## Criterios de aceptación M0

- AT-001 aplicado a toda respuesta estudiantil: ninguna clave protegida llega al cliente.
- AT-014: recargar `/chat` no crea otra sesión y recupera la activa.
- Un student no puede acceder ni operar sobre una sesión ajena; teacher/admin no crean sesiones académicas por el flujo estudiante.
- Existe como máximo una sesión activa por estudiante y actividad/asignación, incluso bajo solicitudes concurrentes; un nuevo intento exige acción explícita y permiso de la actividad.
- **Criterio bloqueado hasta obtener el esquema de Supabase:** una base limpia puede construirse exclusivamente desde migraciones y soporta todos los SQL de M0.
- Los datos v1 se preservan y los casos con cualquiera de las dos claves de intervención siguen siendo evaluables en modo legado.
- Un borrador IA no puede pasar directamente a estado asignable.
- La conexión de producción no desactiva globalmente TLS; la verificación con el proveedor queda validada con su configuración oficial antes de cerrar el cambio.
- `student_public_view`, `patient_runtime_view` y `evaluator_view` tienen contratos separados y tests de ausencia de etiquetas/soluciones en las dos primeras según corresponda.
- El flujo docente advierte/prohíbe datos identificativos de pacientes reales y las llamadas IA minimizan sus payloads.
- Lint, typecheck y suite M0 pasan en entorno con dependencias instaladas.

---

# 11. Archivos exactos esperados en M0

Lista propuesta; los nombres nuevos se validarán al iniciar M0, pero no debe ampliarse el alcance sin actualizar este plan.

## Existentes a modificar

- `package.json`
- `.env.example`
- `README.md`
- `lib/auth.ts`
- `lib/db.ts`
- `lib/openai.ts`
- `app/api/cases/route.ts`
- `app/api/cases/ai/route.ts`
- `app/api/sessions/route.ts`
- `app/api/chat/route.ts`
- `app/api/evaluations/route.ts`
- `app/chat/page.tsx`
- `app/chat/ChatClient.tsx`
- `app/profesor/casos/nuevo/page.tsx`
- `PLAN.md`

## Nuevos previstos en la parte desbloqueada

- `lib/validation/api.ts`
- `lib/cases/student-public-view.ts`
- `lib/cases/legacy-normalization.ts`
- `lib/sessions/service.ts`
- `lib/auth/authorization.ts` o ubicación equivalente sin colisión con `lib/auth.ts`
- `tests/unit/student-public-view.test.ts`
- `tests/unit/legacy-normalization.test.ts`
- `tests/integration/auth-authorization.test.ts`
- `tests/integration/sessions.test.ts`
- `tests/integration/chat.test.ts`
- `tests/integration/evaluations-legacy.test.ts`
- `tests/integration/case-lifecycle-guard.test.ts`
- configuración del runner de tests elegida (`vitest.config.ts` o equivalente)

## Migraciones previstas, pero bloqueadas

- `db/schema.sql` (su eventual actualización como bootstrap verificado/derivado depende de la baseline confirmada)
- `db/seed.sql` (cualquier ajuste ligado al esquema migrado depende de la baseline confirmada)
- `db/migrations/0001_v1_baseline.sql`
- `db/migrations/0002_v1_schema_stabilization.sql`

Estos archivos no deben crearse ni considerarse ejecutables hasta contrastar el esquema real de Supabase. `0001_v1_baseline.sql` representará el esquema desplegado confirmado, no una reconstrucción basada únicamente en `db/schema.sql`; `0002_v1_schema_stabilization.sql` dependerá de esa baseline y del análisis de datos legado.

No se espera modificar en M0 el editor de caso existente `app/profesor/casos/[id]/EditCaseClient.tsx`, salvo que el guard server-side requiera reflejar el estado borrador para evitar una UI engañosa; cualquier inclusión debe registrarse antes.

---

# 12. Pruebas requeridas para M0

## Unitarias

- Proyección pública con allowlist exacta y prueba negativa recursiva para `ground_truth`, PRM/RNM, adherencia, barreras, personalidad, demanda, rúbrica y claves.
- Normalización legado de estados e intervenciones, incluidos casos con ambas claves o ninguna.
- Validadores de payload: tipos, campos requeridos, enums, límites y JSON malformado.

## Integración de API/base de datos

- Login inválido/válido y permisos student/teacher/admin.
- Inicio de sesión explícito, idempotencia, reanudación y ausencia de duplicados ante dos solicitudes concurrentes.
- Unicidad de sesión activa por estudiante + actividad/asignación y creación de nuevo intento solo cuando la política lo permita.
- Estudiante A no puede chatear/evaluar/leer sesión de B.
- Respuesta de sesiones contiene exactamente el DTO autorizado.
- Solo casos asignables pueden crear sesión; borrador IA no puede asignarse.
- Chat rechaza sesión finalizada y no incorpora etiquetas docentes a la vista runtime.
- `patient_runtime_view` contiene hechos necesarios, pero no `tipo_no_adherencia`, `barrera_correcta`, rúbrica, claves ni otras soluciones inferibles.
- Evaluación legado maneja ambos nombres de intervención durante transición y finaliza solo la sesión propia.
- **Pruebas bloqueadas hasta obtener el esquema de Supabase:** base limpia desde migraciones, upgrade desde fixture v1 representativa y preservación de filas/conteos.
- TLS/configuración: producción no fuerza `NODE_TLS_REJECT_UNAUTHORIZED=0`.

## Regresión/adversariales mínimos

- Inspección serializada de respuestas para fuga de solución.
- Mensajes de prompt injection no pueden obtener información que no esté en `patient_runtime_view` (la garantía conductual completa se entrega en M4).
- Dato clínico ausente no se convierte por el builder en una negación.
- Recarga y remount no crean intentos nuevos.

## Verificaciones de ingeniería

- `npm run lint`
- `npm run typecheck`
- `npm test`
- build de producción
- ejecución de migraciones en base efímera y prueba de upgrade, una vez desbloqueada y construida la baseline

Estado actual de verificación: no ejecutable todavía porque no hay `node_modules`; `npm run lint` falla al no encontrar `next` y no existe script de test/typecheck. No se instalaron dependencias durante esta auditoría.

---

# 13. Estado de decisiones y bloqueantes de M0

## Partes ya desbloqueadas

- Contratos y tests de las tres vistas; eliminación de fugas en respuestas estudiantiles.
- Diseño del inicio explícito, reanudable e idempotente, con una sesión activa por actividad/asignación.
- Diseño extensible de `case_assignments` para asignación automática y explícita futura, sin construir grupos en M0.
- Autorización teacher global para la primera v2, centralizada para restricciones futuras.
- Mapeo de todos los estados legado salvo `approved` y adopción del vocabulario canónico v2.
- Eliminación de etiquetas docentes del runtime del paciente y sustitución por hechos.
- Requisitos de privacidad M0; la política institucional definitiva queda diferida.
- Eliminación del bypass TLS global como requisito; pueden prepararse código y tests que prohíban su uso en producción.
- Validación runtime, normalización dual de intervenciones, arnés de tests y documentación reproducible.

## Partes que siguen bloqueadas

1. **Baseline y migraciones ejecutables:** bloqueadas hasta comparar el esquema real desplegado con `db/schema.sql`.
2. **Migración de `approved`:** bloqueada hasta conocer sus valores, uso y significado efectivo en datos/rutas desplegadas; no se convertirá automáticamente.
3. **Constraint/índice definitivo de sesión activa:** el principio está fijado, pero debe conocerse la estructura real de actividades/asignaciones y `case_assignments` para elegir la clave correcta sin perder datos.
4. **Configuración TLS definitiva:** bloqueada hasta obtener del proveedor la cadena, modo SSL y CA oficialmente soportados. Sí está desbloqueada la retirada del bypass global como objetivo y su protección mediante tests.

## Información concreta necesaria de Supabase antes de migrar

- Versión de PostgreSQL, proyecto/entorno afectado y mecanismo de despliegue actual del esquema.
- Export **solo de esquema** de todos los objetos relevantes: tablas, columnas, tipos, defaults, PK, FK, checks, uniques, índices, secuencias, extensiones, triggers, funciones, vistas y políticas RLS.
- Definición real de `users`, `cases`, `case_assignments`, `sessions`, `messages` y `evaluations`, además de cualquier tabla no presente en el repositorio.
- Conteos por tabla y valores distintos/frecuencias de `cases.status`, `sessions.status`, roles y `service_type`, sin contenido clínico identificativo.
- Para filas `cases.status = 'approved'`: conteos de si han sido asignadas, tienen sesiones y continúan siendo seleccionables por la aplicación; esto permitirá decidir entre `VALIDATED` y `PUBLISHED`.
- Forma, constraints, índices, duplicados y datos huérfanos de `case_assignments`; confirmar si existe concepto de actividad, grupo, curso, intento o vigencia.
- Número de sesiones activas duplicadas por estudiante/caso/asignación y distribución histórica necesaria para diseñar el backfill sin borrar intentos.
- Presencia real y nulabilidad de `cases.service_type`, `cases.updated_at`, `cases.created_by` y cualquier columna agregada manualmente.
- Forma y frecuencia de las claves JSON `intervenciones_validas` e `intervenciones_recomendadas`, y casos donde coexisten o faltan.
- Historial disponible de migraciones o SQL manual aplicado, si existe fuera del repositorio.
- Configuración TLS oficial del proveedor para el tipo de conexión usado: conexión directa o pooler, parámetro SSL requerido y CA/cadena de confianza recomendada. No se necesitan credenciales en `PLAN.md` ni en logs.

## Decisiones clínicas/pedagógicas para hitos posteriores

- Pesos finales de puntuación y reglas de penalización crítica.
- Taxonomía/versiones PRM-RNM y protocolo SPFA oficial inicial.
- Taxonomía final de estrategia/intervención y reglas de derivación/informe.
- Umbrales de confianza/revisión y autoridad final sobre notas críticas.
- Número final de preguntas calificables y política de feedback/liberación de soluciones.
- Presets de personalidad y campos clínicos obligatorios por protocolo.
- Modelo(s) de IA aprobados, residencia/tratamiento de datos, precios y número de reintentos.
- Fuente y proceso institucional de validación CIMA/AEMPS.

---

# 14. Preparación para comenzar M0

El repositorio **no está listo para desplegar v2 ni para considerarse reproducible**, pero las decisiones humanas anteriores desbloquean la mayor parte del diseño y del saneamiento de M0. La implementación no migratoria puede comenzar cuando exista autorización. `0001_v1_baseline.sql`, las migraciones ejecutables, el destino de `approved`, el constraint definitivo de sesión activa y el cierre TLS deben esperar a la información concreta de Supabase enumerada arriba.
