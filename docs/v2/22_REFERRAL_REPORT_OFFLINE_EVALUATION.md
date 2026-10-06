# M6-COV1 — Evaluación offline del informe de derivación escrito

Actualización: [calibración COV1–COV3](25_COV_SEMANTIC_CALIBRATION.md), instrucciones `/2`.
«Me mareo» no respalda «sensación de giro»: evidencia de fidelidad INSUFFICIENT y afirmación específica
UNSUPPORTED con captura completa. Se mantienen contratos de estados; no se reetiquetan resultados
anteriores. Adaptador real probado solo con transporte simulado; live bloqueado y aceptación pendiente.
El registro siguiente conserva el estado y evidencia del checkpoint original.

Estado: **IMPLEMENTADO / REVISADO OFFLINE**. Checkpoint local de COV1; no publicado.
Base: `6e579233dfd5054b0eec6d060670bf050cddc788`. No acredita automáticamente los 3 puntos de Informe.
Progreso canónico: [PROJECT_STATUS](PROJECT_STATUS.md), M6 **64%**, proyecto **51.53%**.
M6/M6-E **PARTIAL**, PED2 abierto, perfiles productivos no aprobados ni instalados,
D3B **OPEN / VALIDATION DEBT**.

## Aprobación y alcance

El docente aprobó: personalización según circunstancias conocidas y viabilidad sin exigir aceptación;
seguridad con criterios explícitos del caso y revisión sin penalización automática D2; seguimiento del
plan exigible por caso sin evaluar resultados futuros; informe de derivación efectivamente escrito,
contenido requerido y fidelidad a información disponible; coherencia entre conclusión final identificada
y justificada y entrevista conservando contradicciones/rectificaciones. Registro en [PLAN](../../PLAN.md#aprobación-docente-de-cobertura--27-de-septiembre-de-2026).

Solo se implementa el informe escrito. Las otras cuatro capacidades quedan pendientes. La fidelidad
local del informe no constituye la evaluación general de coherencia entrevista/conclusión final.
No se aprueban pesos de nota, umbrales, penalizaciones ni perfiles. Los puntos del proyecto no son pesos académicos.

## Contratos y recorrido

- [referral-report-contract.ts](../../lib/cases/v2/referral-report-contract.ts): entrega `/1`, contexto `/1`,
  request `/1`, adjudicación `/1` y evaluación `/1`. Zod estricto en entradas y respuesta semántica.
- [evaluate-referral-report.ts](../../lib/cases/v2/evaluate-referral-report.ts): valida referencia clínica
  existente y snapshot M5, comprueba sesión/caseVersion/fingerprint, aísla fuentes por copia, proyecta
  requisitos identificados y fuentes disponibles, llama una vez al runtime explícito y valida sus citas.
- [Pruebas offline](../../tests/unit/referral-report.test.ts): fixtures sintéticos y runtimes falsos;
  no acreditan exactitud, exhaustividad ni resistencia real a inyección de un modelo.

Necesidad del contrato nuevo: las APIs D1/D2 representan evidencia de entrevista, no un documento
entregado aparte. COV1 añade identidad de entrega y su vínculo al transcript sin insertar mensajes,
cambiar M5 o ampliar el esquema clínico. Reutiliza `identified-report-requirement/1`, con `contentId`
del caso; los contenidos históricos `string[]` requieren identificación docente y nunca reciben IDs inventados.

La entrada es interna del servidor. `approvalRef`, oportunidad, integridad/completitud de captura y
perfil público son afirmaciones de un futuro adaptador autorizado, no datos que pueda autorizar el alumno.
La validación offline comprueba coherencia estructural e integridad de los snapshots; **no prueba por sí sola
ownership, aprobación docente, finalización de sesión ni completitud real de captura**. El adaptador productivo
deberá obtenerlos de fuentes autorizadas de la sesión/caso inmutable y verificar estos precondicionantes.
El perfil público permite exclusivamente nombre, edad, sexo y tratamiento. La referencia clínica se valida
pero solo sus requisitos de informe se proyectan al runtime; no se envían otras respuestas ni hechos ocultos.

`SUBMITTED` contiene texto real, incluido texto vacío. `ABSENT`, `INTENT_ONLY` y `CAPTURE_FAILED`
son distintos. `deliveryStatus` conserva la distinción incluso en un caso no aplicable o histórico;
el texto vacío se identifica como `EMPTY`. Un texto presentado como informe que solo promete redactarlo
requiere adjudicación semántica y puede resultar `INTENT_ONLY`; la etiqueta de entrega no prueba su naturaleza.

No aplicabilidad se deriva exclusivamente de `referral.status=not_required` o `report.status=not_required`.
`appropriate` y `required` admiten revisión del informe según los contenidos explícitos del caso;
no se convierten en una obligación académica o penalización. Ausencia/vacío/intención solo producen
`NOT_DEMONSTRATED` como estado de entrega cuando la oportunidad está confirmada y la captura completa;
en otro caso producen `INSUFFICIENT`. No equivalen a conducta incorrecta ni a omisión clínicamente peligrosa.

Por contenido se conservan `DEMONSTRATED`, `NOT_DEMONSTRATED`, `INSUFFICIENT`, `CONTRADICTORY`
y `UNCERTAIN`. Una inferencia `NOT_DEMONSTRATED` se degrada a insuficiente si faltan oportunidad,
captura completa o evidencia de información disponible. La indisponibilidad semántica de un dato debe
ser identificada por el adjudicador: una cita literal por sí sola no demuestra esa disponibilidad.

Fidelidad se expresa por afirmación: `SUPPORTED`, `UNSUPPORTED`, `CONTRADICTORY`, `UNCERTAIN`.
UNSUPPORTED con transcript incompleto se convierte en UNCERTAIN. No es falsedad, peligrosidad ni
penalización. El runtime debe revisar afirmaciones de todo el informe, no solo sus contenidos exigidos.
La exhaustividad y relevancia semántica de esa revisión no pueden probarse con validación de spans.
`claims` es independiente de los criterios: permite señalar, por ejemplo, una afirmación adicional
«Vive sola» sin respaldo aunque los dos contenidos exigidos estén cubiertos. No existe inventario
determinista de todas las afirmaciones; una lista vacía u omisiones del runtime no se detectan como
fallo estructural. Nunca certifican fidelidad completa: el resultado sigue `REVIEW_REQUIRED`,
`STRUCTURAL_ONLY` y aceptación `PENDING`. Una prueba explícita conserva este límite visible.

Las citas llevan offsets UTF-16 `[start,end)` y literal; sus fuentes son campos públicos o mensajes
con identidad dentro del snapshot vinculado. Se verifican IDs exactos, conjunto completo de criterios,
ausencia de duplicados y literal/offsets. Demostración/contradicción y afirmaciones respaldadas requieren
al menos una fuente pública o del paciente; una pregunta/afirmación del alumno no basta como hecho del paciente.
Toda la secuencia de entrevista se conserva, incluidas contradicciones y rectificaciones. Nunca se atribuye
exploración retrospectiva por haber escrito un dato al final.

`sourceDigest` fija entrega, contexto, referencia y transcript; `requestDigest` fija proyección, instrucciones
versionadas y runtimeRef. El runtime devuelve ese digest para impedir cruces de peticiones. Esto no autentica
al proveedor ni certifica retención futura. Request/result quedan congelados; entradas del llamante no se alteran.
La revisión comprueba una espera real de una promesa: mutar entrega, contexto, transcript y referencia
del llamante mientras está pendiente no cambia request ni resultado; mutar después la respuesta del
proveedor tampoco cambia el resultado. La congelación alcanza objetos y arrays anidados.

## Frontera semántica y errores

La dependencia `ReferralReportRuntimeV1` es obligatoria y explícita. COV1 no instala un proveedor/modelo.
No utiliza coincidencias de palabras como prueba de corrección. Instrucciones separadas del contenido no
convierten una prueba con runtime falso en garantía anti-inyección. Campos extra, citas falsas, IDs cruzados
y respuestas incompatibles se rechazan de forma estructural.

Toda salida es `TEACHER_REVIEW_ONLY`, `STRUCTURAL_ONLY`, aceptación semántica `PENDING`.
No hay función de elevación a aceptación ni adaptación al scorer E2. D1/D2 conservan APIs y significados.
Entradas inválidas lanzan solo `INVALID_REFERRAL_REPORT_INPUT`, sin cause/payload. Fallos del runtime
y respuestas inválidas generan `TECHNICAL_FAILURE` con código constante y sin texto clínico del error.
No hay reintento automático ni transformación de fallos técnicos en desempeño negativo.
Resultados con evidencia clínica son internos, nunca DTOs públicos del estudiante.

## Ejemplo sintético

Caso sintético aprobado: contenidos identificados «describir el síntoma comunicado» e «identificar al
paciente». Perfil público: Ana. Entrevista: paciente «Me mareo.»; estudiante «Redactaré un informe.».
Entrega `synthetic-report-1`: «Refiere mareo. Paciente: Ana.».

Un runtime **falso** adjudica ambos contenidos `DEMONSTRATED`, citando el documento y respectivamente
el mensaje del paciente y el nombre público. Resultado: `REVIEW_REQUIRED`, ambos contenidos demostrados,
fidelidad `SUPPORTED` para la afirmación sintética, sin score; aceptación semántica sigue `PENDING`.
El ejemplo positivo conserva lo declarado sin añadir sensación de giro. La versión anterior
«Me mareo» → «Presenta sensación de giro» podía sobreinterpretar el síntoma; se retira como ejemplo
positivo, no se acredita esa equivalencia clínica. Las respuestas programadas del runtime falso no
son autoridad clínica. Otra prueba muestra que una cita literal válida pero semánticamente irrelevante
puede superar el validador estructural: citar «Ana» no respalda el síntoma. Por ello la aceptación
semántica permanece pendiente y requiere revisión independiente de las citas.
Si solo se entrega la primera oración, el segundo contenido puede quedar `NOT_DEMONSTRATED` con su
fuente pública disponible. Si no se entregó texto y solo consta la promesa en la entrevista, `ABSENT`
no se convierte en un informe realizado. Si falla la captura, resulta `TECHNICAL_FAILURE`.

## Cierre parcial y pendientes

Cumplidos técnicamente: entrada escrita diferenciada, bindings e integridad, requisitos explícitos,
recorrido offline con adjudicación inyectada, trazabilidad estructural, ausencia/incertidumbre/fallo separados,
errores seguros y pruebas sintéticas. No hay migraciones ni cambios de dependencias, configuración, M5 o scoring.

Pendientes antes de considerar el cierre del entregable Informe y sus 3 puntos:
aceptación semántica docente del adjudicador (incluidas exhaustividad, accesibilidad, fidelidad e inyección),
y acuerdo explícito sobre el cierre según el desglose existente. No se acredita porcentaje en este incremento.
Integración productiva requiere captura M8 o adaptador autorizado, fuente pública ligada al caso, ownership,
estado/completitud de sesión, revisión/liberación M9–M10, permisos y retención/supresión. Las políticas
pedagógicas productivas siguen pendientes; no bloquean el recorrido offline solicitado.
No se construye M8 completo, UI, endpoints, persistencia, replay ni archivo de testigos.

## Verificación de esta revisión

Evidencia anterior sobre COV1, 27 de septiembre de 2026 (antes de corregir el ejemplo y ampliar tests):

- Tests COV1: **39/39 PASS**.
- Selección COV1 + referencia clínica + targets + adjudicación D1 + claims D2 + scorer E2:
  **287/287 PASS**, seis archivos (incluye los 39 COV1).
- `npx tsc --noEmit --incremental false`: **PASS** tras corregir la proyección de IDs de contenido
  del tipo existente DeepReadonly a strings validados; no se modificó el contrato clínico.
- `npm test`, suite offline completa ejecutada una vez: **3355 PASS / 67 SKIPPED**,
  84 archivos pass y siete omitidos. Gates live y PostgreSQL explícitamente desactivados;
  7 pruebas live y 60 PostgreSQL omitidas. El primer intento no arrancó Vitest por EPERM del sandbox;
  la ejecución fuera del sandbox completó correctamente el gate offline.
- `git diff --check`, whitespace de archivos nuevos y enlaces locales: **PASS**.
- Lint: **NO COMPLETADO**. Tras superar EPERM del sandbox, `npm run lint -- --no-cache`
  solicita configurar ESLint porque falta configuración; termina con código 1.
  No se instaló ni cambió configuración para resolverlo.

Los resultados históricos P3/PG/suite conservados en PROJECT_STATUS no se presentan como ejecutados
sobre COV1. En esa ejecución no se ejecutó PostgreSQL, OpenAI/live, build ni despliegue, ni se hizo staging, commit o push.

### Revisión focalizada del checkpoint — 28 de septiembre de 2026

Revisados los siete archivos, incluidos los nuevos: bindings, citas, conjunto exacto de criterios,
afirmaciones adicionales, estados de entrega, fuentes disponibles, separación entrevista/informe,
contenido no confiable, aislamiento asíncrono y errores seguros. Sin defectos bloqueantes dentro
del alcance offline. El código de los dos módulos permanece sin cambios respecto al gate anterior.
Se corrigen el ejemplo y sus fixtures y se añaden cuatro pruebas de límites/aislamiento.

Checks nuevos: `npx vitest run tests/unit/referral-report.test.ts` **43/43 PASS** y
`npx tsc --noEmit --incremental false` **PASS**. Diff completo revisado, incluidos los archivos
nuevos; diff-check de trabajo y staged **PASS** para los siete archivos del checkpoint.

La suite completa **3355 PASS / 67 SKIPPED** y la selección **287/287** se reutilizan como evidencia
anterior del código de implementación sin cambios; no se afirma una ejecución nueva de esas suites.
Lint sigue no completado por configuración ausente; no se configura ESLint ni se cambian dependencias.
Aceptación semántica, integración productiva y puntos de Informe siguen pendientes. Sin push.
