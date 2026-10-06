# M6-COV3 — Personalización de la intervención, evaluación offline

Actualización autorizada: [preparación semántica COV1–COV3](25_COV_SEMANTIC_CALIBRATION.md).
La nueva evaluación `/2` conserva desempeño histórico separado de vigencia: retirar una propuesta
no borra adaptación/comprobación demostradas ni concede automáticamente atención a dificultad.
El resto de este documento describe el checkpoint `/1` y su evidencia histórica, sin reinterpretarla.
Los adaptadores nuevos usan `/2`; aceptación semántica e integración pendientes, personalización 0/4.

Estado: **IMPLEMENTADO / REVISADO OFFLINE**, 5 de octubre de 2026; checkpoint local, no publicado.
Base: `chatusal-v2`, `62a3f68bee75b451cca98f1dd93ef77ef1aad65e`.
Fuente canónica de progreso: [PROJECT_STATUS](PROJECT_STATUS.md). Personalización **0/4**, M6 **64%**,
proyecto **51.53%**; M6/M6-E PARTIAL, PED2 abierto, perfiles productivos no aprobados,
D3B OPEN / VALIDATION DEBT. No se acreditan puntos por implementar o pasar tests.

## Criterio aprobado y alcance

Evaluar si el estudiante vincula una adaptación concreta a circunstancias conocidas del paciente,
comprueba su viabilidad y atiende dificultades/rechazo expresados sobre la intervención, cuando existan.
No exigir aceptación del paciente. Reconocer una barrera no demuestra por sí solo una adaptación.
No exigir que surja rechazo ni una reformulación cuando no hay dificultad expresada. Tampoco se impone
una reformulación concreta como única respuesta válida. El estilo comunicativo pertenece a M7.

El recorrido recibe requisitos explícitos del caso y toda la entrevista, y devuelve evidencia trazable
para revisión docente. Runtime semántico inyectado; fixtures y respuestas programadas explícitamente falsos.
No implementa otras capacidades, scoring, penalizaciones, E2, interfaz, endpoints, DB, migraciones,
persistencia nueva, replay ni archivo de testigos. No cambia funcionalmente COV1/COV2, M5 o D1/D2.
D2 sigue review-only. Un positivo en personalización no certifica seguridad clínica ni eficacia.

## Contratos y autoridad

- [personalization-contract.ts](../../lib/cases/v2/personalization-contract.ts): requisitos/contexto,
  request, adjudicación y evaluación versionados `/1`; instrucciones `/2`.
- [evaluate-personalization.ts](../../lib/cases/v2/evaluate-personalization.ts): recorrido puro asíncrono,
  validación de fuentes/respuesta y aislamiento.
- [personalization.test.ts](../../tests/unit/personalization.test.ts): ejemplos sintéticos y regresiones.

Se reutilizan binding/citas/perfil público de COV1, spans de COV2 y validación de snapshot M5,
sin ampliarlos. `sessionId`, `caseVersionId` y fingerprint deben concordar entre requisitos, contexto
y transcript validado. `requirementsVersion` y `approvalRef` identifican el snapshot de requisitos.
No se reconstruyen criterios desde hechos ocultos ni se imponen adaptaciones clínicas universales.
Solo existen los aspectos explícitos `ADAPTATION`, `FEASIBILITY` y `RESPONSE_TO_DIFFICULTY`;
este último exige `appliesWhen: DIFFICULTY_EXPRESSED`. No se añaden aspectos que el caso no configure.
Configuración aplicable vacía, IDs repetidos y respuestas con criterios omitidos/duplicados/inventados
se rechazan; no hay evaluación positiva por conjunto vacío. No aplicabilidad global es explícita del caso.

Esta frontera interna offline valida integridad, **no autentica aprobación, ownership ni completitud**.
Un futuro adaptador de servidor deberá recuperar y verificar versión aprobada, sesión autorizada,
fuentes inmutables, perfil público inicial, oportunidad y estado real de captura. El cliente no podrá
declararlos autoridad. Es trabajo de integración pendiente, no una nueva API ni un perfil aprobado.

## Cadenas de evidencia, atribución y secuencia

Cada cadena conserva ID, circunstancias conocidas, propuesta del alumno, atribución, vigencia y,
cuando corresponda, comprobación de viabilidad, respuesta del paciente y atención posterior a la dificultad.
Las circunstancias proceden únicamente del perfil público inicial (nombre, edad, sexo, tratamiento)
o de mensajes anteriores del paciente; no se admite `ground_truth` ni otros campos ocultos.
Una revelación posterior no puede ser fundamento citado de una propuesta anterior.
La lista de circunstancias puede estar vacía al evaluar viabilidad o respuesta sin adaptación demostrada;
`ADAPTATION / DEMONSTRATED` sigue exigiendo al menos una circunstancia previa válida.

Se comprueban literalmente fuente, mensaje, rol y offsets UTF-16 `[start,end)`. Propuesta, comprobación,
retirada y respuesta a dificultad deben ser del estudiante. Adopción explícita requiere citar además
la propuesta previa del paciente; una mera cita puede conservarse, pero no demostrar el criterio.
Las etiquetas de autoría siguen siendo interpretación del runtime, no algo probado por el rol de la cita.

La comprobación de viabilidad no puede preceder a la propuesta; puede formar parte del mismo turno.
La respuesta del paciente debe seguir a la propuesta y puede preceder a la comprobación de viabilidad
(por ejemplo, un rechazo espontáneo). Su aceptación nunca sustituye la comprobación del estudiante.
La respuesta a dificultad debe seguir a la dificultad y no preceder a su propuesta: admite una nueva
propuesta que atienda el rechazo de la anterior. No se exige aceptación ni una respuesta del paciente
para acreditar que el estudiante comprobó la viabilidad.

Cada criterio referencia **una cadena**, sin unir fragmentos de cadenas diferentes. Las cadenas se
devuelven ordenadas por el orden real del snapshot y el inicio de la cita, no por el orden del proveedor.
Se conservan propuestas retiradas con su cita de retirada e incompatibilidades declaradas. Un positivo
en cadena retirada, incierta o incompatible con otra no retirada pasa a `UNCERTAIN`. La última frase
no elimina conflictos automáticamente; retirar una alternativa conserva su historia sin invalidar
por sí solo otra propuesta actual.
Excepción acotada: atender una dificultad mediante retirada puede demostrar `RESPONSE_TO_DIFFICULTY`
si la respuesta citada ocurre en el turno de retirada o después. No acredita adaptación vigente ni
viabilidad de la propuesta retirada. Una respuesta anterior a una retirada posterior permanece incierta.
Compartir turno no prueba que la retirada y la respuesta estén relacionadas: sigue siendo juicio semántico.

**Límite de exhaustividad:** no hay extractor determinista que descubra todas las propuestas, dificultades,
retiradas o incompatibilidades. El runtime puede omitir relaciones, atribuir mal autoría o agrupar citas
semánticamente inconexas dentro de una cadena. Comprobar literals/roles/orden no demuestra relevancia,
causalidad, vigencia ni soporte clínico. Una prueba acepta estructuralmente una edad citada correctamente
aunque no justifique la propuesta: se conserva aceptación `PENDING`, no se presenta como acierto clínico.
Los controles evitan mezclas **declaradas** incompatibles, no certifican detección semántica exhaustiva.

## Estados y fallos

| Estado del criterio | Interpretación / límite |
|---|---|
| `DEMONSTRATED` | Juicio del runtime con cadena atribuida al alumno; viabilidad exige comprobación citada, atención a dificultad exige dificultad presente y respuesta citadas. Pendiente de aceptación semántica. |
| `NOT_DEMONSTRATED` | Solo con captura completa y oportunidad confirmada; de otro modo se transforma en insuficiente. No genera penalización. |
| `INSUFFICIENT` | Material insuficiente, incluida captura incompleta o falta de oportunidad para atribuir una omisión. |
| `CONTRADICTORY` | Evidencia contradictoria conservada mediante cadena o citas del alumno, para revisión. |
| `UNCERTAIN` | Interpretación incierta o cadena no vigente/incompatible; no equivale a desempeño incorrecto. |
| `NOT_APPLICABLE` | Solo requisito explícitamente condicional de dificultad con ninguna observada; captura incompleta lo convierte en insuficiente. No puede eximir adaptación o viabilidad libremente. |

La condición de dificultad es adjudicada como `PRESENT`, `NOT_OBSERVED` o `UNCERTAIN`;
presencia exige citas del paciente. Su significado y exhaustividad deben validarse semánticamente.
Sin dificultad observada, no demostrar respuesta no se convierte en omisión: pasa a no aplicable
con captura completa o insuficiente con captura incompleta. Con condición incierta permanece insuficiente.
La ausencia de mensajes puede evaluarse sin cadenas, conservando todos los criterios y estas mismas
reglas; no se deduce del último mensaje. Consejo genérico o barrera identificada sin adaptación pueden
quedar no demostrados con citas para revisión. No se usa un clasificador por palabras clave.

Captura `FAILED` devuelve `TECHNICAL_FAILURE / CAPTURE_FAILED` sin llamar al runtime. Configuración
global no aplicable tampoco llama al runtime y conserva el estado de captura, incluso si falló.
Excepción o respuesta inválida devuelve `RUNTIME_FAILED` o `INVALID_ADJUDICATION`, sin resultados
académicos ni reintento. Error de entrada: solo `INVALID_PERSONALIZATION_INPUT`, sin payload ni cause.
No se propagan mensajes clínicos o secretos del error. Las citas de resultados válidos son internas
para revisión docente, no un DTO público del alumno.

Fuentes copiadas y validadas antes del primer await; request y resultado congelados en profundidad.
La respuesta del proveedor se parsea a objetos separados. `sourceDigest` fija fuentes y requisitos;
`requestDigest` incluye además instrucciones y runtimeRef, y debe coincidir en la respuesta.
No hay lecturas mutables/latest ni persistencia de nuevos artefactos. No se garantiza conservación
indefinida ni reproducibilidad semántica de otro runtime con los mismos hashes.
Todo texto se declara dato no confiable, nunca instrucción. Los tests con fake comprueban estructura
y aislamiento; **no acreditan resistencia semántica real a inyección**.

## Ejemplo sintético

El fixture configura tres requisitos: adaptación vinculada, comprobación de viabilidad y atención
a dificultades si se expresan. No exige papel, una aplicación ni una solución única; no es una pauta clínica.

1. Paciente: «No tengo teléfono móvil.»
2. Estudiante: «Como no tiene móvil, le propongo anotar las tomas en papel.»
3. Estudiante: «¿Puede usar ese registro en papel?»

Salida programada: adaptación `DEMONSTRATED` con relación 1→2; viabilidad `DEMONSTRATED` con 2→3;
respuesta a dificultad `NOT_APPLICABLE` en captura completa, pues no se observa rechazo/dificultad
sobre la propuesta. `REVIEW_REQUIRED`, `STRUCTURAL_ONLY`, `semanticAcceptance: PENDING`, sin score.
La barrera inicial justifica explorar adaptación, no crea por sí sola un rechazo posterior de esta.

Si responde «No puedo escribir», adaptación y comprobación no se invalidan solo por el rechazo.
Con oportunidad/captura completas y sin respuesta del estudiante, el requisito condicional queda
`NOT_DEMONSTRATED`. Si el alumno retira esa propuesta y pregunta si puede usar un registro con marcas
adhesivas, el fake conserva la cadena anterior retirada y otra cadena vinculada a la nueva dificultad.
No se certifica que esa alternativa sea clínicamente adecuada o realizable sin revisión semántica.
«Siga las indicaciones» o «Entiendo que no tiene móvil» no demuestran por sí solos adaptación.

## Aceptación pendiente y evidencia

Para aceptar el entregable Personalización y sus cuatro puntos existentes falta evaluación semántica
docente con ejemplos y contraejemplos aceptados: atribución, causalidad temporal, viabilidad,
respuesta al rechazo, exhaustividad de conflictos/retiradas e inyección real; después, acuerdo explícito
de cierre. No se inventan pesos académicos, umbrales ni reglas clínicas para casos reales.
La aprobación general del criterio no aprueba expectativas clínicas concretas ni perfiles productivos.

La integración productiva sigue separada: fuentes/aprobación/ownership autorizados, captura verificada,
permisos de evaluación/reevaluación/publicación y políticas de retención/supresión. M1–M3 aportarán
casos versionados aprobados; M8 no es necesario para la fuente inicial entrevista; M9/M10 consumirán
resultados y revisión cuando se autorice. M7 conserva comunicación. COV1/COV2, PED2 y D3B siguen abiertos
en sus ámbitos pendientes. Ninguna de estas decisiones bloquea este recorrido sintético offline.

Evidencia anterior a la revisión, 5 de octubre de 2026:

- COV3 **56/56 PASS**: adaptación/viabilidad, consejo genérico y barrera sin adaptación, rechazo,
  reformulación, retiradas/incompatibilidades, citas/roles/atribución, conocimiento previo y datos
  ocultos, captura/oportunidad, N/A condicional, incertidumbre, criterios exactos, errores y aislamiento asíncrono.
- Selección COV3 + COV1 + COV2: **153/153 PASS** (incluye los 56 nuevos; 43 COV1 y 54 COV2).
- `npx tsc --noEmit --incremental false`: **PASS** tras corregir tipado de las pruebas de mutación
  y estrechar la unión de configuración; sin cambios de comportamiento derivados de esa corrección.
- Suite offline completa, una ejecución final: **3469 PASS / 67 SKIPPED**, 86 archivos pass y 7
  omitidos. Los siete gates live/PostgreSQL se fijaron explícitamente a `0`: 7 tests live y 60 PostgreSQL
  omitidos. Incluye COV3 antes de esta revisión y las regresiones M5/D1/D2/E2.
- Evidencia histórica COV2 **3406 PASS / 67 SKIPPED** y PostgreSQL anteriores siguen siendo históricas;
  no se presentan como ejecución actual de DB ni aceptación semántica.
- `git diff --check`, comprobación de whitespace de los cuatro archivos nuevos y enlaces locales:
  **PASS**. Diff limitado a los siete archivos COV3; staging vacío.

No se ejecutan OpenAI/live, DB, migraciones, instalaciones, build ni despliegue. No se configura ESLint.

### Revisión focalizada y checkpoint local — 5 de octubre de 2026

Tres restricciones estructurales corregidas dentro del criterio aprobado: exigir una circunstancia previa
incluso para viabilidad/respuesta sin adaptación; exigir que toda respuesta del paciente fuese posterior
a la comprobación de viabilidad; degradar automáticamente una respuesta que atiende la dificultad
retirando la propuesta. Se ajustan esas precondiciones y se versionan las instrucciones a `/2`.
No se añaden criterios, puntuaciones ni aceptación clínica; contratos aún no publicados conservan `/1`.

Seis regresiones nuevas cubren esos casos, el rechazo de adaptación sin circunstancia, la aceptación
que no sustituye viabilidad y la retirada posterior que deja incierta una respuesta anterior.
Checks nuevos: **62/62 COV3 PASS**, `npx tsc --noEmit --incremental false` **PASS**.
Se reutilizan **56/56**, **153/153** y **3469 PASS / 67 SKIPPED** como evidencia anterior a la corrección;
no se repiten regresiones ajenas ni suite completa por el cambio local, cubierto focalmente.
Diff completo de los siete archivos revisado, incluidos nuevos; ambos diff-check PASS.
No quedan bloqueos técnicos para el checkpoint offline. La validez literal no acredita causalidad,
exhaustividad, autoría semántica ni adecuación clínica; aceptación e integración productiva pendientes.
