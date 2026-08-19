# 11 — Diseño de persistencia y migración legacy de versiones de caso

## 1. Alcance y autoridad

Este documento fija el contrato técnico de persistencia que deberá materializar
`0002_v2_case_versioning.sql`. No contiene SQL ejecutable y no define todavía
repositorios, API, permisos, RLS, publicación ni interfaz docente.

Las decisiones de dominio que gobiernan este diseño son:

- los estados y las transiciones de `case-version-lifecycle.ts`;
- `PUBLISHED` como único estado disponible para iniciar nuevas sesiones;
- el formato opaco canónico `casever_<uuid>` validado por
  `validateCaseVersionId()`;
- `GeneratedCaseBundleV2` como artefacto V2 completo, reproducible y
  revisable;
- la preservación no destructiva del esquema y de los datos V1.

## 2. Arquitectura: `cases` no es `case_versions`

`public.cases` seguirá representando la identidad lógica estable del caso.
`public.case_versions` representará snapshots inmutables de su contenido.

Se conserva deliberadamente `public.cases.id bigint`. Tanto
`case_assignments.case_id` como `sessions.case_id`, además de los datos V1 ya
existentes, dependen de esa identidad. `0002` no reemplazará el identificador,
no recreará `cases` y no renumerará filas.

Las columnas V1 `cases.spec`, `cases.ground_truth` y `cases.status` se mantienen
inicialmente por compatibilidad con las rutas V1. No serán la fuente de verdad
de versiones V2. Su retirada requerirá una migración posterior, una vez que
ningún consumidor V1 dependa de ellas.

No se añade `cases.current_version_id` ni `cases.published_version_id`. La
versión publicada se determina de forma inequívoca mediante el invariante de
una sola versión `PUBLISHED` por `case_id`, evitando una segunda fuente de
verdad.

## 3. Identidad física de `case_versions`

`case_versions.id` será `text PRIMARY KEY`. El valor almacenado deberá cumplir
exactamente el formato canónico en minúsculas:

`casever_<uuid>`

El cuerpo UUID tendrá ocho, cuatro, cuatro, cuatro y doce dígitos hexadecimales
en minúsculas; versión UUID de 1 a 8 y variante RFC `8`, `9`, `a` o `b`. El
`CHECK` de PostgreSQL deberá ser equivalente al patrón que usa actualmente
`validateCaseVersionId()`. No se utilizará un `uuid` desnudo, un `bigint` ni un
segundo identificador interno.

Para un bundle V2, `case_versions.id` será exactamente el mismo valor que:

- `content.sourceOfTruth.caseVersionId`;
- `content.sourceOfTruth.patientFacts.caseVersionId`;
- `content.sourceOfTruth.evaluator.caseVersionId`;
- `content.derived.patientRuntime.caseVersionId`;
- `content.derived.teachingSummary.caseVersionId`;
- `content.derived.complianceReport.caseVersionId`.

La persistencia debe rechazar cualquier discrepancia. No habrá traducción de
identidad entre la aplicación, el JSON y PostgreSQL.

## 4. Tabla `public.case_versions`

### 4.1. Columnas

| Columna | Tipo PostgreSQL | Nulabilidad/default | Claves y semántica |
|---|---|---|---|
| `id` | `text` | `NOT NULL`, sin default | PK. `CaseVersionId` canónico `casever_<uuid>`, generado antes de construir contenido V2. |
| `case_id` | `bigint` | `NOT NULL` | FK a `public.cases(id)` con `ON DELETE RESTRICT`. Identidad lógica estable. Nunca `CASCADE`. |
| `version_number` | `integer` | `NOT NULL`, sin default | Positivo y único dentro de `case_id`. Empieza en 1 y crece de forma monotónica. |
| `parent_version_id` | `text` | `NULL`, sin default | Versión de la que deriva el snapshot. FK restringida a una versión del mismo `case_id`; `NULL` para la primera versión. |
| `status` | `text` | `NOT NULL`, sin default implícito | Estado editorial V2: solo `AI_DRAFT`, `TEACHER_DRAFT`, `IN_REVIEW`, `VALIDATED`, `PUBLISHED` o `ARCHIVED`. |
| `source_kind` | `text` | `NOT NULL`, sin default | Solo `AI_GENERATED`, `TEACHER_AUTHORED` o `LEGACY_V1`. |
| `content_format` | `text` | `NOT NULL`, sin default | Inicialmente `GENERATED_CASE_BUNDLE_V2` o `LEGACY_V1_SNAPSHOT`. |
| `content` | `jsonb` | `NOT NULL`, sin default | Snapshot completo e inmutable. Debe ser un objeto JSON. |
| `legacy_status` | `text` | `NULL`, sin default | Conserva exactamente `approved` o `rejected` solo para `LEGACY_V1`. No es un estado V2. |
| `created_by` | `bigint` | `NULL`, sin default | FK a `public.users(id)` con `ON DELETE SET NULL`. `NULL` identifica backfill o acción de sistema. |
| `created_at` | `timestamp with time zone` | `NOT NULL DEFAULT now()` | Instante de materialización de la versión. |

No se añade `updated_at`: el contenido y los metadatos de creación son
inmutables, y los cambios editoriales se registran en el historial de estados.

### 4.2. Constraints e índices requeridos

`0002` deberá definir, como mínimo:

- PK sobre `id` y `CHECK` del `CaseVersionId` canónico;
- `CHECK (version_number > 0)`;
- unicidad de `(case_id, version_number)`;
- una clave única auxiliar `(case_id, id)`;
- FK simple de `case_id` a `cases(id)` con borrado restringido;
- FK simple de `parent_version_id` a `case_versions(id)` con borrado
  restringido;
- FK compuesta `(case_id, parent_version_id)` hacia
  `case_versions(case_id, id)`, usando la clave única auxiliar, con borrado
  restringido. Cuando el parent es `NULL`, la primera versión es válida;
- `CHECK` de los seis estados 4A;
- `CHECK` de los tres `source_kind`;
- `CHECK` de los formatos inicialmente soportados;
- `CHECK` que limite `legacy_status` a `approved`, `rejected` o `NULL`;
- coherencia de legacy: `LEGACY_V1` exige `LEGACY_V1_SNAPSHOT` y
  `legacy_status` no nulo; ningún origen no legacy puede tener
  `legacy_status` ni usar `LEGACY_V1_SNAPSHOT`;
- índice único parcial de `case_id` limitado a filas con estado `PUBLISHED`.

La FK compuesta garantiza en la base que el parent pertenece al mismo caso.
Además, el trigger de inserción deberá comprobar que su `version_number` es
menor que el de la nueva versión. Dado que el parent debe existir previamente y
`parent_version_id` no puede cambiar, esa regla impide cadenas hacia versiones
posteriores y ciclos.

En `0002`, las combinaciones materializables de origen/formato serán:

- `AI_GENERATED` con `GENERATED_CASE_BUNDLE_V2`;
- `LEGACY_V1` con `LEGACY_V1_SNAPSHOT`.

`TEACHER_AUTHORED` queda reservado en el vocabulario, pero no se persistirá
hasta que una migración futura añada el contrato y `content_format` del editor
manual. No se reutilizará `GENERATED_CASE_BUNDLE_V2` de forma implícita para
ese editor.

### 4.3. Contenido por formato

Para `GENERATED_CASE_BUNDLE_V2`, `content` guarda el
`GeneratedCaseBundleV2` completo:

- `schemaVersion`;
- `sourceBrief`, incluida su huella;
- `sourceOfTruth`;
- `derived`, con runtime, summary y compliance;
- `provenance`.

No se extrae ni persiste solo una selección de `sourceOfTruth`, `evaluator` o
`patientRuntime`. El servicio debe validar el bundle antes del insert. La base
debe comprobar como mínimo que sea un objeto V2 y que las seis rutas de
`caseVersionId` enumeradas en la sección 3 coincidan con `case_versions.id`.

Para `LEGACY_V1_SNAPSHOT`, el contenido se define en la sección 12. No se
presenta como `GeneratedCaseBundleV2` ni se fabrican vistas V2 que V1 nunca
tuvo.

## 5. Inmutabilidad del snapshot

Una fila de `case_versions` es un snapshot inmutable desde su creación. Toda
edición clínica, factual o pedagógicamente relevante crea:

- un `id` nuevo;
- el siguiente `version_number` del caso;
- `parent_version_id` igual a la versión de origen;
- un `content` nuevo y completo.

Esta regla se aplica también a borradores no publicados. No se sobrescribe
`content` para “editar” un draft.

Una transición editorial sin cambio de contenido sí modifica `status` en la
misma fila. `status` y `content` tienen responsabilidades distintas.

`0002` deberá instalar un trigger de protección que rechace cambios en:

- `id`;
- `case_id`;
- `version_number`;
- `parent_version_id`;
- `source_kind`;
- `content_format`;
- `content`;
- `legacy_status`;
- `created_by`;
- `created_at`.

También debe rechazar el borrado de versiones: archivar es el mecanismo de
retirada, no eliminar historia. La única excepción técnica a la invariancia de
`created_by` es el cambio no nulo a `NULL` provocado por su FK `ON DELETE SET
NULL`; cualquier asignación o sustitución ordinaria seguirá prohibida.

Se recomienda protección en DB, no solo disciplina de repositorio, porque el
contenido histórico no debe poder alterarse por una ruta que omita el servicio.

### 5.1. Alcance de edición tras `0002`

`0002` permitirá exclusivamente:

- persistir un `GeneratedCaseBundleV2` recién generado como `AI_GENERATED`,
  `GENERATED_CASE_BUNDLE_V2` y `AI_DRAFT`;
- realizar transiciones editoriales de esa misma versión sin modificar su
  `content`;
- persistir y consultar snapshots `LEGACY_V1`.

`0002` no permitirá todavía persistir una nueva versión cuyo contenido haya
sido modificado manualmente por un docente. Una modificación docente de un
bundle generado por IA:

- no puede sobrescribir el `content` existente;
- no debe guardarse engañosamente como un
  `GENERATED_CASE_BUNDLE_V2` inalterado;
- no debe reutilizar sin más la provenance de generación original como si
  describiera todo el contenido modificado;
- deberá crear una nueva `case_version` cuando exista el contrato de edición
  docente;
- requerirá un `content_format` y una estrategia de lineage/provenance
  definidos mediante una migración posterior.

Hasta entonces, el único workflow soportado sobre contenido generado por IA
es: generación, persistencia como `AI_DRAFT`, revisión sin modificación del
snapshot y transiciones editoriales permitidas por 4A. Si un docente necesita
modificar el contenido, la futura aplicación deberá impedir guardar esa
modificación como nueva versión hasta que exista el contrato de persistencia de
edición docente.

La transición `AI_DRAFT` a `TEACHER_DRAFT` de 4A sigue siendo válida porque es
una transición editorial y no exige modificar `content`. El nombre
`TEACHER_DRAFT` no demuestra ni implica por sí mismo que el snapshot haya sido
editado.

Este documento no define todavía el formato del editor, diffs, patches,
provenance de edición, UI ni repositorio de autoría docente.

## 6. Estado editorial y transiciones

`case_versions.content` es el snapshot. `case_versions.status` es el estado de
revisión/publicación. Por tanto, transiciones como:

- `IN_REVIEW` a `VALIDATED`;
- `VALIDATED` a `PUBLISHED`;
- `PUBLISHED` a `ARCHIVED`;

no modifican el snapshot.

Las únicas transiciones válidas son exactamente las 12 de 4A:

| Origen | Destinos permitidos |
|---|---|
| `AI_DRAFT` | `TEACHER_DRAFT`, `IN_REVIEW`, `ARCHIVED` |
| `TEACHER_DRAFT` | `IN_REVIEW`, `ARCHIVED` |
| `IN_REVIEW` | `TEACHER_DRAFT`, `VALIDATED`, `ARCHIVED` |
| `VALIDATED` | `IN_REVIEW`, `PUBLISHED`, `ARCHIVED` |
| `PUBLISHED` | `ARCHIVED` |
| `ARCHIVED` | ninguno |

El servicio de aplicación deberá llamar a
`assertCaseVersionStatusTransitionV2(from, to)`. `0002` deberá duplicar la
misma matriz en un trigger de defensa para impedir bypass directo de la lógica
de aplicación. Esta duplicación intencional es una barrera de integridad, no
una segunda semántica: cualquier cambio futuro en 4A exige una migración
correspondiente.

`VALIDATED` a `PUBLISHED` es estructuralmente válido, pero no suficiente para
publicar. Compliance, auditoría automática, warnings, seguridad clínica,
identidad docente y autorización pertenecen al futuro servicio de publicación.

## 7. Una sola versión publicada por caso

El invariante es: como máximo una fila `PUBLISHED` por `case_id`. `0002` lo
defenderá con un índice único parcial sobre `case_id` para ese estado.

La sustitución de una versión publicada será una única transacción:

1. bloquear la identidad de `cases` y las versiones implicadas;
2. pasar la versión publicada anterior de `PUBLISHED` a `ARCHIVED`;
3. pasar la nueva versión de `VALIDATED` a `PUBLISHED`;
4. registrar ambos eventos de estado;
5. confirmar la transacción.

El orden evita una colisión temporal con el índice parcial. Si cualquier paso
falla, toda la operación revierte. Las sesiones existentes permanecen
ancladas a la versión anterior, ahora archivada.

Un `GeneratedCaseBundleV2` recién generado nunca se inserta como `PUBLISHED`.
Se crea con:

- `status = AI_DRAFT`;
- `source_kind = AI_GENERATED`;
- `content_format = GENERATED_CASE_BUNDLE_V2`.

Después recorre el workflow 4A hasta revisión, validación y publicación. La IA
propone; un docente valida y publica mediante servicios posteriores.

## 8. Numeración y creación concurrente

Los números de versión son `1, 2, 3, ...` dentro de cada `case_id`, crecen de
forma monotónica y nunca se reutilizan, incluso si una versión está archivada.
Las versiones no se borran.

La creación debe ejecutarse en una transacción que bloquee primero la fila de
`cases`, conceptualmente mediante `SELECT ... FROM cases WHERE id = ? FOR
UPDATE`. Solo después calcula `MAX(version_number) + 1` e inserta la nueva
versión. La unicidad `(case_id, version_number)` constituye la defensa final
contra carreras, pero no sustituye el bloqueo. El mismo bloqueo serializa la
publicación para ese caso.

La primera versión usa `version_number = 1` y puede tener parent `NULL`. Toda
versión derivada usa el número siguiente y un parent ya existente del mismo
caso. No se implementa todavía el repositorio que realiza la transacción.

## 9. Auditoría append-only: `public.case_version_status_events`

### 9.1. Columnas

| Columna | Tipo PostgreSQL | Nulabilidad/default | Claves y semántica |
|---|---|---|---|
| `id` | `bigint GENERATED ALWAYS AS IDENTITY` | `NOT NULL` | PK monotónica del evento; no es identidad de dominio. |
| `case_version_id` | `text` | `NOT NULL` | FK a `case_versions(id)` con `ON DELETE RESTRICT`. |
| `from_status` | `text` | `NULL` | `NULL` exclusivamente para el evento inicial de creación/backfill; en otro caso, uno de los seis estados 4A. |
| `to_status` | `text` | `NOT NULL` | Uno de los seis estados 4A. |
| `actor_user_id` | `bigint` | `NULL` | FK a `users(id)` con `ON DELETE RESTRICT`. `NULL` para migración o acción automática; un actor histórico no se reescribe. |
| `reason` | `text` | `NULL` | Motivo humano o técnico opcional; nunca contenido clínico. |
| `created_at` | `timestamp with time zone` | `NOT NULL DEFAULT now()` | Instante del evento. |

### 9.2. Reglas de auditoría

- Cada versión tiene exactamente un evento inicial, con `from_status = NULL`
  y `to_status` igual al estado del insert. Un índice único parcial sobre
  `case_version_id` para eventos iniciales lo defenderá.
- Todo evento posterior tiene ambos estados no nulos y representa una
  transición válida de 4A.
- El cambio de `case_versions.status` y la creación del evento ocurren en la
  misma transacción.
- Un trigger sobre `case_versions` valida la transición y materializa el evento,
  de modo que una actualización directa no pueda omitir la auditoría.
- El actor y el motivo se proporcionarán al trigger mediante contexto
  transaccional server-owned del futuro servicio. Si no existe contexto, el
  evento se registra con actor `NULL`, permitido para migración/sistema; nunca
  se omite.
- En el insert inicial, `created_by` puede usarse como actor; el backfill usa
  `NULL`.
- Triggers sobre la tabla de eventos rechazarán todo `UPDATE` y `DELETE`. La FK
  de actor usa borrado restringido precisamente para no abrir una excepción a
  la semántica append-only.

Esta tabla no almacena contenido clínico, auditoría IA, resultados de auditor,
prompts ni respuestas.

## 10. Sesiones ancladas a una versión

`0002` añadirá `sessions.case_version_id text`. El estado objetivo es `NOT
NULL`, con:

- FK simple a `case_versions(id)` con borrado restringido;
- FK compuesta `(case_id, case_version_id)` hacia
  `case_versions(case_id, id)` para garantizar que ambas identidades describen
  el mismo caso lógico;
- trigger de inmutabilidad que impida cambiar `case_version_id` después del
  insert.

Una sesión V2 nueva siempre contiene `case_id` y `case_version_id`. El servicio
resuelve la única versión `PUBLISHED` del caso dentro de la transacción, la
bloquea mientras crea la sesión y la base verifica de nuevo su estado mediante
un trigger de insert. Una `CHECK` ordinaria no puede garantizar esta regla
porque depende de otra tabla.

Pasar posteriormente la versión de `PUBLISHED` a `ARCHIVED` no modifica ni
invalida sesiones existentes. `ARCHIVED` impide nuevas sesiones, pero conserva
sesiones, mensajes, evaluaciones y trazabilidad histórica.

La migración a `NOT NULL` será por fases:

1. añadir la columna nullable y sus FKs;
2. crear y verificar las versiones legacy;
3. rellenar `case_version_id` en todas las sesiones V1;
4. verificar que no existan nulos, referencias ausentes ni pares de casos
   incoherentes;
5. activar `NOT NULL` y la protección de inmutabilidad;
6. activar la defensa de `PUBLISHED` para nuevas sesiones.

No se cambia todavía la política de sesiones activas, reanudación o
idempotencia.

## 11. `case_assignments`

`case_assignments.case_id` continúa apuntando a la identidad lógica del caso.
No cambia su semántica en 4B.

Al comenzar una sesión V2, el servicio resolverá la única versión `PUBLISHED`
de ese caso y fijará la sesión a ella. Decidir si una asignación futura debe
anclar una versión concreta, una actividad, un grupo o un intento queda fuera
de este incremento.

## 12. Backfill de casos V1

`0002` creará exactamente una versión legacy por cada fila V1 existente en
`cases`:

- `version_number = 1`;
- `parent_version_id = NULL`;
- `source_kind = LEGACY_V1`;
- `content_format = LEGACY_V1_SNAPSHOT`;
- `created_by = cases.created_by`;
- `created_at` igual al instante de materialización del snapshot, no falseado
  como fecha histórica de versión.

La migración generará y materializará una sola vez un identificador canónico
`casever_<uuid>` por fila, usando la capacidad `pgcrypto` ya presente. Las
sesiones se enlazarán mediante `case_id`; no se regenerarán IDs después.

`content` será un objeto JSON materializado con, como mínimo:

| Propiedad | Origen/valor |
|---|---|
| `legacyCaseId` | `cases.id` |
| `title` | `cases.title` |
| `description` | `cases.description` |
| `spec` | `cases.spec` completo |
| `groundTruth` | `cases.ground_truth` completo |
| `difficulty` | `cases.difficulty` |
| `serviceType` | `cases.service_type` |
| `createdBy` | `cases.created_by` |
| `createdAt` | `cases.created_at` |
| `updatedAt` | `cases.updated_at` |
| `legacyStatus` | valor exacto de `cases.status` |
| `snapshotBasis` | literal `migration_time_current_row` |

Los JSON V1 `spec` y `ground_truth` se copian materializadamente, no mediante
referencia a columnas mutables.

### 12.1. Mapeo de estado

El backfill fija:

| Estado V1 | Estado V2 inicial | Justificación |
|---|---|---|
| `approved` | `PUBLISHED` | Conserva la semántica V1 de caso disponible/asignable para estudiantes. |
| `rejected` | `ARCHIVED` | Impide sesiones nuevas, pero conserva referencias, contenido e historia. |

Simultáneamente, `legacy_status` y `content.legacyStatus` conservan el valor V1
exacto. Si una versión legacy inicialmente `PUBLISHED` se archiva más adelante,
`legacy_status = approved` permanece inmutable como evidencia del origen; no se
reescribe para seguir el lifecycle V2.

La equivalencia `approved` a `PUBLISHED` y `rejected` a `ARCHIVED` se valida en
el insert de backfill y en sus comprobaciones posteriores. No es una igualdad
permanente entre `legacy_status` y `status`: después del backfill, `status`
puede evolucionar únicamente mediante las transiciones 4A, mientras
`legacy_status` permanece intacto.

No se borran ni corrigen destructivamente casos rechazados, casos aprobados,
asignaciones o sesiones.

## 13. Limitación histórica V1: no falsear reproducibilidad

> **V1 no almacenaba versiones ni snapshots por sesión.** La versión legacy
> creada por el backfill representa el estado conocido de la fila `cases` en el
> momento de migración. No puede garantizar que ese `spec` o `ground_truth` sea
> exactamente el que vio una sesión anterior si el caso fue editado después de
> dicha sesión.

El objetivo es preservar todo lo recuperable, evitar pérdida adicional y
establecer un anclaje legacy explícito. El marcador
`snapshotBasis = migration_time_current_row` hace visible esa procedencia. No se
describirá una sesión V1 como snapshot histórico exacto ni plenamente
reproducible cuando los datos no permiten demostrarlo.

## 14. Backfill de sesiones V1

Para cada sesión existente con `sessions.case_id = X`, `0002` asignará como
`sessions.case_version_id` la versión `LEGACY_V1`, `version_number = 1`, del
caso X.

Se conservan sin modificación destructiva:

- `sessions.id`, `user_id`, `case_id`, `status`, `started_at` y `finished_at`;
- `prompt_tokens`, `completion_tokens` y `cost_eur`;
- todos los mensajes relacionados;
- todas las evaluaciones relacionadas.

El nuevo enlace significa **best-known legacy version at migration time**, no
evidencia de un snapshot histórico exacto. Esto se aplica también a sesiones
activas o asociadas a casos cuyo estado actual V1 sea `rejected`.

La migración verificará conteos antes y después, una versión legacy por cada
caso, una versión asignada por sesión, ausencia de referencias huérfanas y cero
cambios en las columnas V1 preservadas antes de establecer `NOT NULL`.

## 15. Identidad antes de generar con OpenAI

El flujo futuro de una generación V2 es:

1. el servidor genera un `CaseVersionId` canónico `casever_<uuid>`;
2. introduce ese ID en `VersionedGenerationAssemblyContextV2`;
3. `generateOpenAiCaseBundleV2` construye el bundle usando ese mismo ID en
   todas sus vistas;
4. al persistir, `case_versions.id` recibe exactamente ese valor.

PostgreSQL no genera otro ID para esa versión. Si la generación falla antes de
persistir, el ID queda sin usar; los huecos en IDs opacos son aceptables. Nunca
puede existir `DB id != bundle caseVersionId`.

## 16. Origen de casos nuevos

Una generación IA nueva se persiste como `AI_DRAFT`, `AI_GENERATED` y
`GENERATED_CASE_BUNDLE_V2`.

Un caso manual futuro comenzará en `TEACHER_DRAFT` con
`source_kind = TEACHER_AUTHORED`, pero su formato de contenido no se define en
4B. Antes de persistirlo deberá existir una migración que introduzca y valide
ese contrato. No se fuerza una representación prematura ni se etiqueta como
bundle generado por IA.

Del mismo modo, una revisión docente de un bundle IA puede cambiar su estado a
`TEACHER_DRAFT` sin cambiar el snapshot, pero cualquier edición de contenido
queda bloqueada para persistencia hasta que exista ese contrato posterior de
edición y lineage.

## 17. Orden de ejecución y verificación de `0002`

La futura migración debe ser atómica y seguir este orden lógico:

1. crear `case_versions`, constraints, índices y protecciones;
2. crear `case_version_status_events` y su protección append-only;
3. generar una versión legacy y un evento inicial por cada caso V1;
4. añadir `sessions.case_version_id` inicialmente nullable;
5. enlazar todas las sesiones a su versión legacy;
6. verificar conteos, estados, contenido, FKs, coherencia de pares y ausencia de
   nulos;
7. establecer el estado objetivo `NOT NULL` y activar las defensas de nuevas
   sesiones;
8. confirmar sin borrar ni reescribir datos V1.

Antes de producción, `0002` deberá probarse primero contra una base desechable
PostgreSQL 17.6 construida desde `0001_v1_baseline.sql`, con fixtures que cubran
casos `approved` y `rejected`, sesiones de ambos grupos y sesiones múltiples
legacy. La ejecución en producción requerirá backup, ventana operativa,
conteos previos y posteriores y plan de rollback transaccional.

## 18. Matriz de invariantes y defensas

| Invariante | Defensa requerida en `0002` y servicios futuros |
|---|---|
| `caseVersionId` canónico y globalmente único | PK `text` + `CHECK` de formato en DB; generación/validación server-side. |
| Un único valor de identidad dentro de todo bundle | Checks JSON contra `case_versions.id` + validador de bundle en servicio. |
| `version_number > 0` y único por caso | `CHECK` + unicidad `(case_id, version_number)`. |
| Numeración monotónica sin carreras ni reutilización | Transacción, bloqueo `cases FOR UPDATE`, cálculo del siguiente número y unicidad DB. |
| Parent perteneciente al mismo caso | Clave única `(case_id, id)` + FK compuesta; trigger valida versión anterior; servicio transaccional. |
| Estados limitados a los seis de 4A | `CHECK` DB + tipos/validador de dominio. |
| Transiciones limitadas exactamente a 4A | `assertCaseVersionStatusTransitionV2` en servicio + trigger DB. |
| Máximo un `PUBLISHED` por caso | Índice único parcial DB + transacción de sustitución. |
| Nueva generación IA empieza en `AI_DRAFT` | Trigger/check de coherencia de origen/estado + servicio de persistencia. |
| Publicación no equivale a insert | Servicio de publicación futuro + matriz de transición DB; excepción explícita solo para backfill legacy. |
| `content` y metadatos de versión inmutables | Trigger DB de update/delete + creación de nueva versión en servicio. |
| Una versión con contenido modificado por docente no se persiste bajo `GENERATED_CASE_BUNDLE_V2` hasta disponer de contrato de edición/lineage | Constraints DB de coherencia `source_kind`/`content_format` + servicio de persistencia; ampliación mediante migración futura. |
| Historial de status completo y append-only | Trigger de versión crea evento atómicamente; checks/índice de evento inicial; trigger bloquea update/delete. |
| Sesión anclada a una versión | `sessions.case_version_id NOT NULL` tras backfill + FK DB. |
| `sessions.case_id` coincide con el caso de la versión | FK compuesta `(case_id, case_version_id)` en DB. |
| `case_version_id` de sesión no cambia | Trigger DB de inmutabilidad. |
| Nueva sesión solo sobre `PUBLISHED` | Resolución/bloqueo transaccional en servicio + trigger DB de insert. |
| Archivar no invalida sesiones existentes | FK sin cascade; trigger de sesión solo en insert, no contra cambios posteriores de status. |
| `case_assignments` sigue identificando el caso lógico | FK V1 existente; sin cambio en 4B; resolución de versión en servicio de sesión. |
| Una fila legacy por cada caso V1 | Unicidad por `(case_id, version_number)` + backfill y verificación de conteos. |
| `approved` se mapea inicialmente a `PUBLISHED` | Backfill determinista + validación de inserción y verificación post-backfill; no impide archivar después. |
| `rejected` se mapea inicialmente a `ARCHIVED` | Backfill determinista + validación de inserción y verificación post-backfill. |
| `legacy_status` se preserva | Columna y snapshot inmutables + checks de dominio/origen. |
| `snapshotBasis` es explícito | Check del contenido legacy + verificación post-backfill. |
| Todo dato V1 recuperable se materializa | Construcción del snapshot + comparación de campos/conteos antes y después. |
| Ningún caso, asignación, sesión, mensaje o evaluación V1 se borra | Migración aditiva, FKs sin cascade para versiones, verificación de conteos y rollback transaccional. |
| La limitación histórica V1 permanece visible | `content.snapshotBasis`, `legacy_status` y documentación; no se infiere reproducibilidad exacta. |

## 19. Fuera de alcance

Este diseño no define ni implementa:

- RLS ni privilegios Supabase;
- API routes, repositorios o UI docente;
- editor estructurado ni formato de autoría manual;
- auditor IA ni servicio real de publicación;
- asignaciones fijadas a versión;
- idempotencia/reanudación de sesiones;
- persistencia separada de `patient_runtime_view`;
- métricas, evaluación o cuestionarios;
- CIMA.
