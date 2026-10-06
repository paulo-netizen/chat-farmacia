# M6-COV2 — Evaluación offline del plan de seguimiento

Actualización: [calibración COV1–COV3](25_COV_SEMANTIC_CALIBRATION.md), instrucciones `/3`.
«Revisaremos» puede identificar actor y «De acuerdo» adopción cuando el contexto es inequívoco;
varias interpretaciones implican evidencia INSUFFICIENT. No se exige fórmula explícita universal ni
se reetiquetan históricos. Adaptador real probado solo con transporte simulado; aceptación pendiente.
El registro siguiente conserva el estado y evidencia del checkpoint original.

Estado: **IMPLEMENTADO / REVISADO OFFLINE**, checkpoint local COV2, no publicado.
Base: `b4b60f569f3064c9c3285d4c0684a3b2dc280337`. Progreso canónico en
[PROJECT_STATUS](PROJECT_STATUS.md): **M6 64% / proyecto 51.53%**. Seguimiento conserva **0/4**
puntos acreditados; M6/M6-E PARTIAL, PED2 abierto, perfiles productivos no aprobados,
D3B OPEN / VALIDATION DEBT. COV1 conserva aceptación semántica pendiente.

## Alcance docente y necesidad del contrato

La aprobación docente permite evaluar el plan propuesto, con elementos exigibles según el caso:
qué revisar, cuándo o ante qué condición, quién actuará y qué hacer según la evolución.
No exige los cuatro elementos en todos los casos, plazos universales ni resultados longitudinales.
No aprueba expectativas clínicas concretas para casos reales, pesos, penalizaciones o perfiles productivos.

`FollowUpEpisode` referencia una incidencia de la solución docente. No es una propuesta del estudiante
ni un inventario de elementos exigibles del plan. El evaluador legacy tampoco aporta ese contrato.
Se añade un snapshot interno y versionado de requisitos identificados, independiente de los esquemas
clínicos existentes. No se deducen requisitos de episodios, del último mensaje o de texto histórico sin IDs.
No se implementan otras capacidades; no hay refactorización general ni abstracción compartida nueva.

## Contratos y fuentes

- [follow-up-plan-contract.ts](../../lib/cases/v2/follow-up-plan-contract.ts): requisitos `/1`, contexto `/1`,
  request `/1`, adjudicación `/1` y resultado `/1`, con validación Zod estricta.
- [evaluate-follow-up-plan.ts](../../lib/cases/v2/evaluate-follow-up-plan.ts): recorrido puro con
  runtime explícito, fuentes copiadas, bindings/hashes/citas verificados y salida para revisión docente.
- [Tests](../../tests/unit/follow-up-plan.test.ts): solo casos sintéticos y runtimes falsos.

Reutilización acotada de COV1: esquemas de binding, citas y perfil público. Reutiliza el validador del
snapshot M5, sin cambiar su semántica. No modifica COV1 ni sus estados de aceptación, M5, D1/D2 o E2.

`follow-up-plan-requirements/1` fija `sessionId`, `caseVersionId`, fingerprint canónico del transcript,
`approvalRef` y `requirementsVersion`. Es un snapshot ligado a una sesión del caso aprobado, no la
configuración editable. `APPLICABLE` exige elementos con IDs únicos; `NOT_APPLICABLE` exige lista vacía.
Los IDs los proporciona la autoridad del caso, no el runtime ni un generador a partir del texto.
Cada elemento tiene `expected` y un aspecto: `WHAT_TO_REVIEW`, `REVIEW_TRIGGER`, `ACTOR` o `EVOLUTION_ACTION`.
Solo para revisión, `allowedForms` especifica `TIME`, `CONDITION` o ambas alternativas. El contenido
clínico y los plazos, si existen, los determina el caso; el motor no fija valores ni interpreta palabras clave.

`follow-up-plan-context/1` comparte binding y declara oportunidad, captura `COMPLETE/INCOMPLETE/FAILED`
y el perfil público permitido (nombre, edad, sexo, tratamiento). La otra fuente es el transcript M5
completo disponible, incluidas propuestas tempranas, respuestas, contradicciones y despedida.
No recibe ficha oculta, ground truth, FollowUpEpisode ni resultados de otros evaluadores.
El texto de expectativas es autoridad para qué evaluar, nunca prueba de conocimiento del alumno.

La entrada es interna del servidor: el futuro adaptador deberá verificar ownership, sesión finalizada,
caso/versiones/aprobaciones y completitud real de captura. Los bindings/hashes no autentican al llamador
ni demuestran que `approvalRef` sea legítimo. No hay endpoint que acepte autoridad enviada por un estudiante.

## Evaluación, referencias y secuencia

Una llamada al runtime, sin proveedor implícito ni reintentos, clasifica `CONCRETE_PLAN`, `GENERIC_INTENT`,
`NO_EVIDENCE` o `UNCERTAIN`. Un plan concreto puede ser parcial frente a los requisitos; esa clasificación
no significa que todos se hayan demostrado. La intención genérica no recibe criterios demostrados.
Incluso para intención o ausencia semántica, se exige exactamente una respuesta por requisito: faltantes,
duplicados o IDs inventados producen fallo técnico. El resultado ordena criterios según la configuración.

Por criterio: `DEMONSTRATED`, `NOT_DEMONSTRATED`, `INSUFFICIENT`, `CONTRADICTORY`, `UNCERTAIN`.
No demostrado solo se conserva con captura completa y oportunidad confirmada; de otro modo se convierte
en insuficiente. La interpretación de datos inaccesibles debe producir insuficiencia, no omisión;
no hay hechos ocultos proyectados como evidencia. La evaluación de esa accesibilidad sigue siendo semántica.

Las citas de desempeño deben pertenecer realmente a mensajes del estudiante. Contexto solo acepta
mensajes del paciente o campos públicos: no equivale a actuación del estudiante. Se comprueban literal,
offsets UTF-16 `[start,end)`, rol y referencia exacta al snapshot. `DEMONSTRATED` necesita cita del alumno;
un trigger demostrado necesita alguna forma explícitamente admitida por el caso. Esto valida estructura,
no que el texto realmente exprese esa forma o satisfaga el contenido clínico. `CONTRADICTORY` requiere
citas distintas del estudiante o evidencia de contraste contextual.
Una forma temporal declarada como observada necesita cita del estudiante incluso si el criterio no
se considera demostrado; no se acepta observar un plazo/condición sin evidencia citada.

Instrucciones `follow-up-plan-instructions/2`: distinguir propuesta propia, aceptación explícita
de propuesta ajena y mera información citada. Una propuesta del paciente no es desempeño del alumno;
la aceptación requiere cita del alumno y propuesta referenciada como contexto. Silencio, acuse de
recibo o repetición no prueban aceptación; adopción ambigua requiere incertidumbre. Estas distinciones
se expresan en los veredictos y citas existentes, sin añadir un clasificador determinista ni otro schema.

Las relaciones `CONTRADICTION` y `EXPLICIT_RECTIFICATION` conservan ambas citas y el requisito afectado.
Ambas deben figurar en sus evidencias y estar ordenadas; en el mismo mensaje no pueden solaparse.
`evidenceTimeline` reúne citas del plan y criterios, elimina duplicados y las ordena por transcript/offsets.
Una rectificación no cambia automáticamente el veredicto ni concede prioridad a la última frase.
El runtime recibe todos los turnos: el motor no selecciona el último como plan final.
Las instrucciones prohíben componer un plan completo con fragmentos de alternativas incompatibles
y contar propuestas retiradas como vigentes. Las citas retiradas/reemplazadas se conservan como
histórico; la compatibilidad o vigencia incierta se mantiene para revisión. No se infiere vigencia
por orden o por coincidencias textuales. Las regresiones con runtimes falsos verifican instrucciones,
conservación de citas y veredictos, no la capacidad de un modelo real para detectar retirada/adopción.

Límite explícito: no existe extractor determinista exhaustivo de propuestas/relaciones. El runtime puede
omitir una contradicción o citar una frase irrelevante que sea literalmente válida. La validación de
referencias no detecta todas esas omisiones ni acredita soporte semántico. Una prueba muestra que citar
«Gracias, hasta luego» no prueba qué revisar aunque los offsets sean válidos. Todo resultado permanece
`TEACHER_REVIEW_ONLY`, `STRUCTURAL_ONLY`, aceptación semántica `PENDING`.

## Ausencia, fallos e aislamiento

Sin mensajes del estudiante, no se ejecuta el runtime: se conserva `NO_EVIDENCE` con todos los criterios
no demostrados únicamente si captura y oportunidad lo permiten; en otro caso, insuficientes.
`NO_EVIDENCE` describe el material capturado, no prueba una omisión en una entrevista incompleta.
Captura fallida produce `TECHNICAL_FAILURE`, sin juicios de desempeño. No aplicabilidad depende solo
de la configuración explícita y conserva el estado de captura. Incertidumbre semántica no es fallo técnico.

Errores de entrada exponen solo `INVALID_FOLLOW_UP_PLAN_INPUT`, sin payload/cause. Excepciones del runtime
y respuestas inválidas se convierten en `RUNTIME_FAILED` / `INVALID_ADJUDICATION`, sin texto del error.
No se convierten en penalizaciones o conclusiones clínicas. La salida con citas es interna, no un DTO público.

Antes del primer await se copian y validan las fuentes; request y salida quedan congelados en profundidad.
La respuesta del proveedor se parsea a objetos separados. Pruebas con una promesa pendiente verifican
que mutar las fuentes del llamador no cambia la evaluación y que mutaciones posteriores del proveedor
o del consumidor no alteran resultados anidados. `sourceDigest` fija requisitos/contexto/transcript;
`requestDigest` fija además instrucciones versionadas y runtimeRef, y debe coincidir en la respuesta.
No implica retención indefinida ni se añade archivo de testigos/replay.

## Ejemplo sintético

Solo en el fixture, el caso exige: revisar persistencia del mareo; llamada en dos días; farmacéutico
como responsable; revisar el plan acordado si persiste. No es recomendación clínica general.
Entrevista del alumno:

1. «Revisaremos si persiste el mareo.»
2. «Le llamaré en dos días.»
3. «Si sigue igual, revisaremos el plan acordado.»
4. «Gracias, hasta luego.»

Runtime falso: cuatro criterios `DEMONSTRATED`, con citas a los tres primeros turnos, `CONCRETE_PLAN`
y `REVIEW_REQUIRED`, sin score y aceptación `PENDING`. Si falta la tercera frase, el requisito de actuación
queda `NOT_DEMONSTRATED` solo con captura completa/oportunidad. «Haremos seguimiento» queda intención
genérica. Otro fixture exige únicamente una condición de revisión y acepta «Si persiste el mareo,
contacte con la farmacia», sin imponer un plazo ni otros elementos. Las respuestas programadas prueban
el recorrido, no la calidad de un modelo real ni resistencia semántica a prompt injection.

## Pendientes y evidencia

Cumplidos offline: requisitos explícitos, recorrido desde entrevista, citas/bindings, conjunto exacto de
criterios, secuencia, ausencia/incertidumbre/fallo separados, aislamiento y errores seguros.
Para aceptar el entregable y sus cuatro puntos existentes faltan validación semántica
docente (incluida exhaustividad, rectificaciones, accesibilidad e inyección) y acuerdo explícito de cierre.
La integración productiva necesita fuentes/aprobaciones autorizadas, ownership y captura verificada,
revisión/liberación de resultados y políticas de permisos/retención. No se construyen ahora.
PED2/perfiles, D3B y COV1 conservan sus pendientes. No hay puntuación nueva, penalización ni conexión a E2;
D2 sigue review-only. No se han utilizado OpenAI/live, DB, migraciones ni nuevas dependencias.

Evidencia anterior sobre COV2, 28 de septiembre de 2026, antes de esta revisión:

- **47/47 tests COV2 PASS**: plan completo/parcial, intención, alternativa por condición, ausencia,
  captura incompleta/fallida, no aplicabilidad, contradicciones/rectificaciones, citas/roles/bindings,
  requisitos omitidos/duplicados/inventados, errores seguros, inyección simulada y aislamiento asíncrono.
- Selección con COV1 y evidencia de sesión M5: **169/169 PASS** (incluye los 47 COV2).
- `npx tsc --noEmit --incremental false`: **PASS** sobre la implementación anterior a la revisión.
- Suite offline completa, ejecutada una vez: **3406 PASS / 67 SKIPPED**, 85 archivos pass y siete
  omitidos. Gates live/PostgreSQL desactivados: 7 pruebas live y 60 PostgreSQL omitidas.
- `git diff --check`, whitespace de archivos nuevos y enlaces locales: **PASS**.
- No se ejecuta ni configura ESLint, conforme al alcance; tampoco build ni despliegue.

En esa ejecución no hubo staging, commit ni push COV2. Los tests falsos no cierran la aceptación
semántica ni acreditan puntos.

### Revisión focalizada para checkpoint local — 28 de septiembre de 2026

Revisados los siete archivos. Hallazgos corregidos: instrucciones insuficientemente explícitas sobre
autoría/adopción/cita y sobre retirada/compatibilidad; posibilidad estructural de declarar una forma
temporal observada sin citar al alumno. Se versionan las instrucciones a `/2`, se añade esa validación
y siete regresiones focalizadas. Sin refactorización ni ampliación de las capacidades evaluadas.

La exhaustividad y la interpretación de autoría/vigencia siguen pendientes de aceptación semántica:
si un runtime omite una retirada o etiqueta mal una cita real, el validador no lo descubre por sí solo.
No se declara resuelto ese riesgo con las respuestas programadas. No quedan bloqueos técnicos para
el checkpoint offline; ownership, fuentes autorizadas e integración productiva siguen pendientes.

Checks nuevos sobre la corrección: `npx vitest run tests/unit/follow-up-plan.test.ts` **54/54 PASS**;
`npx tsc --noEmit --incremental false` **PASS**. Diff completo revisado, incluidos archivos nuevos;
`git diff --check` y `git diff --cached --check` **PASS** para los siete archivos del checkpoint.

Evidencia anterior reutilizada como regresión histórica: **47/47**, relacionados **169/169** y suite
**3406 PASS / 67 SKIPPED**. No son ejecuciones sobre la corrección final; no se repite la suite completa
porque el cambio se limita a instrucciones COV2 y una precondición de sus citas, cubierta focalmente.
Sin cambios en COV1, M5, D1/D2, E2 o dependencias; sin OpenAI/live, DB, migraciones ni push.
