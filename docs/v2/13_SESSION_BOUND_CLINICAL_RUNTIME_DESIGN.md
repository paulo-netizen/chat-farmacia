# 13 — Session-bound immutable clinical runtime design

## 1. Estado y alcance

Este documento define 4E-A. No implementa rutas, persistencia, prompts,
evaluación, scoring ni migraciones.

La propiedad central es:

> Toda capacidad clínica usada durante una sesión se resuelve desde
> `sessions.case_version_id` y su snapshot inmutable. Nunca se vuelve a
> consultar la fila mutable de `public.cases` ni la versión `PUBLISHED` actual.

El diseño se basa en los contratos reales de:

- `db/migrations/0001_v1_baseline.sql` y
  `db/migrations/0002_v2_case_versioning.sql`;
- `lib/cases/v2/types.ts`, `patient-runtime.ts` y
  `validate-patient-facts.ts`;
- `lib/cases/v2/evaluator-types.ts` y
  `validate-evaluator-view.ts`;
- `lib/cases/v2/generated-case-bundle-types.ts` y
  `build-generated-case-bundle.ts`;
- `lib/cases/v2/resolve-student-public-case-version.ts` y
  `case-version-lifecycle.ts`;
- `app/api/chat/route.ts` y `app/api/evaluations/route.ts`;
- los diseños de persistencia 4B y sesiones 4D.

## 2. Problema confirmado

`POST /api/chat` consulta `sessions JOIN cases` y usa directamente:

- `cases.spec`;
- `cases.ground_truth`;
- `cases.service_type`.

`POST /api/evaluations` también usa `sessions JOIN cases` y lee
`cases.ground_truth`. Carga la fila por un `sessionId` del cliente y comprueba
`session.user_id` después de la lectura.

Esas rutas ignoran el anclaje materializado por 0002:

- `sessions.case_id`;
- `sessions.case_version_id`;
- FK a `case_versions.id`;
- FK compuesta del par caso-versión;
- trigger que hace inmutable `sessions.case_version_id`.

Como `cases` conserva columnas legacy mutables, usarla como fuente clínica
puede cambiar retrospectivamente el paciente o la solución de una sesión.

## 3. Invariantes

1. El usuario procede de autenticación server-side.
2. El `sessionId` identifica una sesión, pero no autoriza por sí solo.
3. Ownership se impone con `sessions.user_id = authenticatedUser.id` en SQL.
4. La versión se obtiene únicamente mediante el par fijado en la sesión.
5. El join exige simultáneamente:
   - `case_versions.id = sessions.case_version_id`;
   - `case_versions.case_id = sessions.case_id`.
6. No se busca la versión publicada actual por `case_id`.
7. Una sesión existente admite `PUBLISHED` y `ARCHIVED`.
8. Los cuatro estados editoriales restantes fallan cerrados.
9. `/api/chat` exige además `sessions.status = 'active'`.
10. `content` se trata como entrada no confiable y se valida en runtime.
11. Ninguna fila PostgreSQL ni `content` raw se devuelve directamente.
12. Cada rol obtiene una proyección nueva construida por allowlist.
13. El paciente nunca recibe evaluator ni etiquetas docentes.
14. El navegador nunca recibe patient runtime, evaluator runtime o metadata de
    generación.

## 4. Boundary server-only

### 4.1. Opción elegida

Se propone un único módulo server-only, conceptualmente
`lib/cases/v2/session-clinical-runtime.ts`. No depende de OpenAI, HTTP,
variables de entorno ni código cliente.

El módulo tiene una sola carga DB interna y APIs tipadas por capacidad. No
devuelve un objeto gigante que cada caller deba recortar:

~~~ts
resolveSessionClinicalRuntimeV2({
  authenticatedUserId,
  sessionId,
  capability: 'student_public',
})

resolveSessionClinicalRuntimeV2({
  authenticatedUserId,
  sessionId,
  capability: 'patient_runtime',
})

resolveSessionClinicalRuntimeV2({
  authenticatedUserId,
  sessionId,
  capability: 'evaluator_runtime',
})
~~~

`capability` es una decisión server-owned del caller, nunca un parámetro HTTP
del alumno. Las sobrecargas o uniones discriminadas hacen que cada llamada
reciba solo su salida. Una implementación equivalente puede exportar tres
funciones nombradas sobre un loader privado único; no puede existir una API
general que entregue simultáneamente las tres vistas.

### 4.2. Entrada y consulta

La entrada mínima contiene solo:

~~~ts
{
  authenticatedUserId: number;
  sessionId: string;
}
~~~

`authenticatedUserId` debe ser un entero positivo derivado de autenticación.
`sessionId` debe ser un UUID válido. No se aceptan `user_id`, `case_id`,
`case_version_id` o estado desde el navegador.

Consulta canónica:

~~~sql
SELECT
  s.id AS session_id,
  s.user_id AS session_user_id,
  s.case_id AS session_case_id,
  s.case_version_id AS session_case_version_id,
  s.status AS session_status,
  cv.id AS version_id,
  cv.case_id AS version_case_id,
  cv.status AS version_status,
  cv.source_kind AS version_source_kind,
  cv.legacy_status AS version_legacy_status,
  cv.content_format AS version_content_format,
  cv.content AS version_content
FROM public.sessions AS s
INNER JOIN public.case_versions AS cv
  ON cv.id = s.case_version_id
 AND cv.case_id = s.case_id
WHERE s.id = $1
  AND s.user_id = $2;
~~~

No contiene join con `public.cases` ni una segunda búsqueda de una versión
`PUBLISHED`. La ausencia de fila no revela si la sesión no existe o pertenece
a otro usuario.

### 4.3. Identidad completa

Después del join se validan explícitamente:

- `session_id` coincide con el UUID solicitado;
- `session_user_id` coincide con el usuario autenticado;
- `session_case_id` y `version_case_id` representan el mismo ID positivo;
- `session_case_version_id` es un `CaseVersionId` canónico;
- `version_id === session_case_version_id`;
- todos los `caseVersionId` internos exigidos por el formato coinciden con
  `version_id`.

Las FKs defienden el par en PostgreSQL; el boundary vuelve a validarlo para
fallar ante filas incompletas, mocks incorrectos o despliegues incoherentes.

## 5. Estados y ciclo de sesión

| Estado de `case_versions` | Runtime de sesión |
|---|---|
| `PUBLISHED` | permitido |
| `ARCHIVED` | permitido |
| `AI_DRAFT` | rechazado |
| `TEACHER_DRAFT` | rechazado |
| `IN_REVIEW` | rechazado |
| `VALIDATED` | rechazado |

Una sesión nueva sigue exigiendo `PUBLISHED`. Una existente conserva acceso a
su snapshot si después pasa a `ARCHIVED`.

La consulta no debe ocultar estados inválidos mediante un filtro previo. Debe
encontrar la sesión autorizada y validar después el estado para no confundir
corrupción con ausencia.

`/api/chat` solo puede pedir patient runtime cuando
`sessions.status = 'active'`. Una sesión `finished` falla antes de insertar el
mensaje del alumno o invocar cualquier modelo.

### Política posterior de evaluación

La evaluación actual cambia la sesión de `active` a `finished`. 4E-A no cambia
esa transición. 4E-D deberá fijar una operación transaccional específica que:

1. imponga ownership en SQL;
2. estabilice o bloquee la fila durante evaluación/finalización;
3. defina si solo `active` inicia evaluación;
4. defina el retry cuando ya existe `evaluations.session_id UNIQUE` y la
   sesión está `finished`;
5. conserve la misma `case_version_id` durante todo el flujo.

«Mostrar una evaluación persistida» y «volver a evaluar una sesión finished»
son decisiones distintas y no se resuelven aquí.

## 6. Salidas separadas

### 6.1. Student public data

Se conservan los contratos existentes:

- `StudentPublicView` contiene exactamente `nombre`, `edad`, `sexo` y
  `tratamiento`;
- `StudentSessionDto` añade únicamente `sessionId`.

El resolver actual ya proyecta:

- legacy desde `content.spec`;
- Generated V2 desde
  `content.sourceOfTruth.patientFacts.publicProfile`;
- `PUBLISHED | ARCHIVED` para reanudación.

No recibe demanda inicial, antecedentes, contexto, personalidad, FactIds,
disclosure, ground truth o evaluator.

### 6.2. Patient runtime

Es una capacidad server-only que podrá alimentar el futuro constructor del
prompt. No es el prompt ni una respuesta HTTP.

La salida es una unión discriminada segura:

~~~text
LEGACY_V1_SNAPSHOT patient runtime
GENERATED_CASE_BUNDLE_V2 patient runtime
~~~

No se fuerza legacy a fingir FactIds, `patient_unknown`,
`explicit_absence` o `DisclosureRule`.

### 6.3. Evaluator runtime

Es otra capacidad server-only. Nunca se incorpora a la capacidad paciente ni a
respuestas del alumno. También es una unión por formato: legacy conserva solo
la solución realmente disponible; Generated V2 usa `EvaluatorViewV2`
validado.

## 7. Normalización de `LEGACY_V1_SNAPSHOT`

### 7.1. Fuente e identidad

La única fuente legacy es `case_versions.content`. 0002 materializa:

- `legacyCaseId`, `title`, `description`;
- `spec` y `groundTruth`;
- `difficulty` y `serviceType`;
- `createdBy`, `createdAt` y `updatedAt`;
- `legacyStatus` y `snapshotBasis`.

El boundary comprueba:

- `snapshotBasis === 'migration_time_current_row'`;
- `legacyCaseId === sessions.case_id`;
- `content.legacyStatus === version_legacy_status`, donde
  `version_legacy_status` procede de `case_versions.legacy_status` en la
  consulta canónica;
- formato `LEGACY_V1_SNAPSHOT` y origen `LEGACY_V1`.

Esta comparación se conserva en el boundary aunque PostgreSQL ya tenga un
`CHECK`: también debe fallar ante mocks incoherentes, filas leídas durante un
despliegue parcial o una representación DB incorrecta.

Nunca vuelve a leer `cases.spec`, `cases.ground_truth` o
`cases.service_type`.

### 7.2. Public y patient runtime legacy

La ficha pública se proyecta de `content.spec` con la allowlist existente.

El chat V1 reconoce realmente estos campos de `spec`:

- `nombre`, `edad`, `sexo`;
- `motivo_consulta`;
- `antecedentes`;
- `tratamiento`;
- `contexto`;
- `descripcion_paciente`.

También usa `groundTruth.personalidad_paciente` como personalidad y
`serviceType` como contexto del servicio.

El normalizador construye un objeto nuevo solo con esos campos, validando tipo
y límites. No copia `spec` ni `groundTruth` completos. La personalidad puede
entrar en la capacidad paciente porque el runtime la necesita para role-play,
pero eso no autoriza a copiar:

- `diagnostico_principal`;
- `problema_farmacoterapeutico`;
- `tipo_no_adherencia`;
- `barrera_principal` y `otras_barreras`;
- `intervenciones_recomendadas` o `intervenciones_validas`;
- `objetivos_aprendizaje`.

Ausencia significa «no disponible en el snapshot», no una negación clínica ni
un permiso para inventar un default factual.

### 7.3. Evaluator runtime legacy

El código conoce o consume:

- `diagnostico_principal`;
- `problema_farmacoterapeutico`;
- `tipo_no_adherencia`;
- `barrera_principal` y `otras_barreras`;
- `intervenciones_recomendadas`;
- `intervenciones_validas`;
- `objetivos_aprendizaje`;
- `personalidad_paciente`.

La evaluación actual usa específicamente `tipo_no_adherencia`,
`barrera_principal` e `intervenciones_validas`. Chat, en cambio, tipa
`intervenciones_recomendadas`. Es un gap confirmado: no se tratan como
sinónimos silenciosamente.

El evaluator legacy no se convierte a `EvaluatorViewV2` porque no contiene:

- `ConclusionId`, `FactId` o `MedicationId`;
- taxonomías y versiones;
- `EvidenceRule`;
- relaciones PRM→RNM;
- care path estructurado;
- protocolo versionado.

La comparación textual V1 puede mantenerse transitoriamente sobre esta
variante, pero no se presenta como scoring V2.

### 7.4. Servicio legacy

`serviceType` es un string preservado literalmente. La producción inspeccionada
contenía `SAT`, mientras el contrato V2 define
`dispensing | pharmaceutical_indication | medication_adherence`.

4E-A no declara `SAT -> medication_adherence`. Ese mapping requiere una regla
de compatibilidad y validación clínica explícitas. Hasta entonces se conserva
`serviceType` en una variante/wrapper legacy junto a la allowlist de datos del
paciente. No se fabrica un `SpfaService` ni se añaden campos al snapshot.

## 8. Normalización de `GENERATED_CASE_BUNDLE_V2`

### 8.1. Contrato persistido

`GeneratedCaseBundleV2` contiene:

- `schemaVersion`;
- `sourceBrief`;
- `sourceOfTruth.caseVersionId`;
- `sourceOfTruth.patientFacts: CasePatientFactsDraftV2`;
- `sourceOfTruth.evaluator: EvaluatorViewV2`;
- `derived.patientRuntime: PatientRuntimeViewV2`;
- `derived.teachingSummary`;
- `derived.complianceReport`;
- `provenance`.

El runtime no devuelve `sourceBrief`, `teachingSummary`,
`complianceReport` ni `provenance`.

### 8.2. Identidad

`case_versions.id` debe coincidir con:

- `sourceOfTruth.caseVersionId`;
- `sourceOfTruth.patientFacts.caseVersionId`;
- `sourceOfTruth.evaluator.caseVersionId`;
- `derived.patientRuntime.caseVersionId`;
- las identidades de `teachingSummary` y `complianceReport` que 0002 también
  protege.

No existe traducción ni sustitución de IDs.

### 8.3. Patient runtime Generated V2

La vista de ejecución ya materializada es
`content.derived.patientRuntime`. `PatientRuntimeViewV2` contiene:

- `publicProfile` e `initialDemand`;
- `encounter`;
- `clinicalContext` con problemas de salud, historia, situación fisiológica,
  embarazo/lactancia, alergias, estilo de vida y datos biomédicos;
- `symptoms` con descripción, inicio, duración, evolución y circunstancias;
- `pharmacotherapy` con medicación, régimen de referencia, utilización real,
  cambios, efectividad y seguridad percibidas;
- acciones realizadas, dificultades, creencias, estrategias previas, contexto
  diario/social, apoyo y relación con profesionales;
- `communicationProfile`.

Los `RuntimePatientDatum` preservan FactId opaco, estado `known`,
`explicit_absence` o `patient_unknown`, topic, certeza y `DisclosureRule`.
Así representan hechos revelables, progresión de disclosure y límites de
conocimiento sin entregar PRM, RNM, adherencia clasificada, barreras
clasificadas o intervenciones.

`/api/chat` debe recibir este runtime validado. No debe recibir
`sourceOfTruth.patientFacts` ni reconstruir una vista ad hoc.

`PatientRuntimeViewV2` es un contrato existente y **no se modifica en 4E**.
En particular, el contexto SPFA no se introduce dentro de ese tipo. Para
`GENERATED_CASE_BUNDLE_V2`, la capacidad server-only `patient_runtime` es una
proyección/wrapper con dos miembros separados:

```ts
{
  patientRuntime: PatientRuntimeViewV2;
  serviceContext: /* allowlist mínima de EvaluatorViewV2.carePath */;
}
```

El wrapper es una frontera de ejecución, no un nuevo formato persistido ni una
ampliación de `PatientRuntimeViewV2`.

### 8.4. Validación del runtime derivado

Actualmente existen:

- `validateCasePatientFactsDraftV2(input)`;
- `createPatientRuntimeViewV2(input)`;
- `validateEvaluatorViewV2(input, runtime)`.

No existe aún un parser público para hidratar `PatientRuntimeViewV2`
persistido ni un validator completo de `GeneratedCaseBundleV2` leído como
`unknown`.

4E-B1 debe:

1. validar estrictamente `sourceOfTruth.patientFacts`;
2. obtener su proyección canónica con `createPatientRuntimeViewV2`;
3. validar estructuralmente `derived.patientRuntime`;
4. exigir igualdad material canónica entre ambos;
5. devolver una copia allowlist del runtime persistido solo tras esa igualdad.

Se reutiliza así la vista derivada existente y se detecta drift. La proyección
recalculada es referencia de validación, no una fuente elegida ad hoc por cada
ruta.

### 8.5. Evaluator runtime Generated V2

La fuente canónica es `content.sourceOfTruth.evaluator`. El contrato real
`EvaluatorViewV2` contiene:

- versiones de evaluator, protocolo, taxonomías y adherencia;
- `carePath` con SPFA inicial, adicionales y transiciones;
- incidencia y episodios;
- PRM, RNM/riesgo y sus relaciones;
- adherencia por scopes, tipo, perfil, barreras y estrategias;
- actuaciones e intervenciones;
- derivación, urgencia, destino, motivo e informe;
- `EvidenceRule` factual o sobre `public_profile.age/sex`.

Se valida mediante:

~~~ts
validateEvaluatorViewV2(
  content.sourceOfTruth.evaluator,
  validatedPatientRuntime,
)
~~~

Ese validator exige identidad, referencias y evidencia contra el runtime del
paciente. `derived.teachingSummary` no sustituye al evaluator: es una
proyección docente derivada, no source of truth.

### 8.6. Contexto SPFA

La fuente Generated V2 es `sourceOfTruth.evaluator.carePath`. El evaluator
puede recibir el `CarePathV2` validado completo. La capacidad paciente no debe
recibir `EvaluatorViewV2` ni `ConclusionId` solo para conocer el servicio.

La proyección paciente toma por allowlist únicamente valores existentes:

- `initialSpfa.value.service` y su `subtype` cuando corresponda;
- `additionalSpfas[].value.service` y `subtype` si el flujo lo necesita.

`serviceContext` nunca contiene:

- `ConclusionId`;
- `transitions`;
- PRM o RNM;
- clasificaciones de adherencia;
- evidencia;
- intervenciones;
- derivación;
- rationale;
- el evaluator raw.

Solo conserva la información de servicio estrictamente necesaria para
interpretar el encuentro, tomada de los valores existentes del care path
validado. El contexto mínimo que finalmente use el prompt se cerrará en 4E-C,
sin modificar `PatientRuntimeViewV2`.

## 9. Mapa por capacidad

### 9.1. Patient runtime

| Necesidad | Legacy | Generated V2 |
|---|---|---|
| Identidad pública | `content.spec` allowlist | `derived.patientRuntime.publicProfile` |
| Demanda inicial | `spec.motivo_consulta` | `initialDemand` |
| Antecedentes/contexto | `antecedentes`, `contexto`, `descripcion_paciente` | `clinicalContext`, `encounter` y colecciones sociales |
| Tratamiento | `spec.tratamiento` | `pharmacotherapy` |
| Personalidad | `groundTruth.personalidad_paciente` | `communicationProfile` |
| Hechos revelables | strings disponibles | `RuntimePatientDatum` y FactIds |
| Revelación progresiva | no estructurada | `DisclosureRule` |
| Límites de conocimiento | campos ausentes sin semántica rica | `patient_unknown`, `explicit_absence` y certeza |
| Servicio/SPFA | `content.serviceType` literal | allowlist desde `evaluator.carePath` |

No se diseña todavía el prompt, la defensa final frente a prompt injection ni
la llamada OpenAI.

### 9.2. Evaluator runtime

| Necesidad | Legacy | Generated V2 |
|---|---|---|
| Conclusiones | strings de `groundTruth` | `EvaluatorViewV2` |
| PRM/RNM | no estructurado/incompleto | `prm`, `rnmAssessments` y relaciones |
| Adherencia/barreras | strings | `adherence` completo |
| Actuación/intervención | listas legacy | `professionalActions` e `pharmaceuticalInterventions` |
| Derivación | no garantizada | `referral` |
| Evidencia esperada | inexistente | `evidenceRules` |
| Protocolo | `serviceType` sin versión | `versions.protocol` y `carePath` |
| Comunicación | personalidad textual sin rúbrica | `communicationProfile` existe en patient runtime, pero `EvaluatorViewV2` no contiene una rúbrica de comunicación |

## 10. Gaps explícitos

1. No existe validator de hidratación completo para
   `GeneratedCaseBundleV2` persistido.
2. No existe parser independiente de `PatientRuntimeViewV2` leído como
   `unknown`.
3. `SAT` legacy no tiene mapping contractual a `SpfaService`.
4. V1 carece de FactIds, disclosure, evidencia, taxonomías versionadas y
   relaciones clínicas estructuradas.
5. `intervenciones_recomendadas` e `intervenciones_validas` son nombres
   distintos; no se unifican implícitamente.
6. `EvaluatorViewV2` no contiene scoring/rúbrica completa ni conclusiones
   específicas de comunicación.
7. `EvidenceRule` justifica conclusiones con hechos del caso; la evidencia de
   transcripción del alumno sigue siendo otra capa pendiente.
8. No está cerrada la política transaccional/idempotente de evaluación durante
   `active -> finished`.
9. El snapshot legacy es `migration_time_current_row` y no demuestra el
   contenido histórico exacto anterior a 0002.

No bloquean un runtime legacy transitorio ni el version pinning, pero limitan
qué semántica V2 puede afirmarse.

## 11. Seguridad y errores

El boundary no devuelve:

- `case_versions.content` raw;
- `sourceOfTruth` completo;
- evaluator dentro de la capacidad paciente;
- `hiddenFacts` al alumno;
- `provenance`, `sourceBrief` o metadata de generación;
- `teachingSummary` o `complianceReport` al alumno;
- filas DB o errores PostgreSQL.

Errores internos fail-closed, sin valores clínicos:

- `session_not_found_or_forbidden`;
- `session_not_active`;
- `invalid_session_anchor`;
- `invalid_case_version_status`;
- `unsupported_content_format`;
- `invalid_case_version_content`;
- `patient_runtime_validation_failed`;
- `evaluator_runtime_validation_failed`;
- `case_version_identity_mismatch`.

El mapping HTTP se realiza fuera del boundary y es genérico. Los logs pueden
contener código, correlation ID futuro e IDs técnicos mínimos, nunca snapshot
clínico.

## 12. Demostración de version pinning

Estado inicial:

~~~text
case C
version V1 = PUBLISHED
session S.case_id = C
session S.case_version_id = V1
~~~

Después el profesor crea/publica V2 y V1 pasa a `ARCHIVED`.

Resolución correcta:

~~~text
S
→ S.case_version_id = V1
→ JOIN case_versions ON id = V1 AND case_id = C
→ content de V1
→ patient/evaluator runtime de V1
~~~

Quedan prohibidos:

~~~text
SELECT current PUBLISHED WHERE case_id = C
→ V2

JOIN cases
→ spec/ground_truth mutable
~~~

V1 archivada sigue siendo válida para S. Chat y evaluación nunca ven V2. El
trigger de 0002 impide cambiar `S.case_version_id` y las FKs impiden cruzarla
con otro caso.

## 13. Pruebas requeridas

Los incrementos posteriores deben demostrar:

- ambos formatos;
- `PUBLISHED` y `ARCHIVED` aceptados;
- cuatro estados editoriales rechazados;
- chat rechazado si la sesión no está `active`;
- ownership en SQL y sesión ajena indistinguible de inexistente;
- mismatch de cualquier identidad rechazado;
- ausencia de lookup de versión actual por `case_id`;
- mutar `public.cases.spec/ground_truth` no cambia el runtime;
- publicar V2 y archivar V1 no cambia una sesión fijada a V1;
- legacy patient runtime no contiene respuestas docentes;
- Generated patient runtime no contiene evaluator, summary, compliance o
  provenance;
- evaluator Generated validado contra runtime del mismo version ID;
- claves futuras contaminantes no se propagan;
- errores no serializan contenido;
- respuestas HTTP del alumno conservan su allowlist;
- boundary sin OpenAI, `process.env` o imports cliente.

La validación PostgreSQL real debe demostrar el escenario V1→V2, no solo mocks.

## 14. Plan incremental

### 4E-B1 — Tipos y resolvers puros por formato

- uniones discriminadas legacy/generated para patient y evaluator;
- parser strict/allowlist de `LEGACY_V1_SNAPSHOT`;
- hidratación/validación de `GENERATED_CASE_BUNDLE_V2` como `unknown`;
- validación del patient runtime derivado y del evaluator;
- contexto SPFA mínimo por formato;
- tests de identidad, contaminación, ausencia ≠ negativo y gaps.

### 4E-B2 — Boundary DB session-bound

- módulo server-only;
- consulta única `sessions + case_versions`;
- ownership en SQL;
- validación del par caso-versión;
- policy `PUBLISHED | ARCHIVED`;
- patient capability solo para sesión `active`;
- salidas separadas sin `content` raw;
- tests de SQL, estados, errores y aislamiento.

### 4E-C — Migrar `/api/chat`

- retirar `cases.spec/ground_truth/service_type`;
- consumir patient runtime anclado;
- no convertir esta adaptación en el diseño completo del prompt;
- conservar historial por `created_at, id`;
- tests de version pinning, separación de rol y no leakage.

### 4E-D — Migrar evaluación

- cerrar policy `active -> finished` y retry;
- obtener evaluator runtime de la misma versión;
- retirar `cases.ground_truth`;
- conservar compatibilidad legacy explícita;
- no implementar scoring V2 completo sin contrato;
- probar ownership, atomicidad y evidencia de versión.

### 4E-E — PostgreSQL real/regresión

- 0001 + 0002 sobre PostgreSQL 17.10 desechable;
- sesión en V1, publicación de V2, archivado de V1 y resolución continua de V1;
- mutación de `public.cases` sin efecto sobre la sesión;
- ambos formatos, estados, ownership, errores y cleanup;
- suite normal y typecheck.

## 15. Fuera de alcance

- prompt OpenAI paciente definitivo y llamada OpenAI;
- nueva evaluación IA o scoring;
- cuestionario post-caso;
- frontend docente;
- `activity_id`;
- RLS/grants;
- TLS;
- despliegue o migración Supabase;
- reconciliación destructiva legacy.

## 16. Matriz final

| Invariante | Defensa futura |
|---|---|
| Sesión usa siempre su snapshot | `sessions.case_version_id` inmutable + join por ID y `case_id` |
| V1 archivada sigue reanudable | policy `PUBLISHED`/`ARCHIVED` |
| Nueva publicación no altera sesiones | prohibición de lookup «current PUBLISHED» |
| `public.cases` no es fuente clínica | consulta sin join a `cases` |
| Ownership server-side | `WHERE s.id = $1 AND s.user_id = $2` |
| Chat solo sobre sesión activa | policy antes de cualquier write/OpenAI |
| Patient y evaluator separados | APIs capability-specific y uniones por formato |
| Legacy no finge V2 | variantes legacy explícitas |
| Generated reutiliza vistas materializadas | validación de `derived.patientRuntime` y `sourceOfTruth.evaluator` |
| Identidad JSON/DB coincide | `CaseVersionId` en todas las rutas contractuales |
| Datos docentes no llegan al alumno | DTO allowlist, nunca `content` raw |
| Errores no filtran clínica | códigos estables y mensajes genéricos |
