# M8 — Cuestionario vinculado a la versión de la sesión

Entrega técnica, 27-10-2026. Base: da3532a81425b90b8a21e3ac91342d86f735286e.

## Recorrido y garantías

El estudiante titular finaliza explícitamente su entrevista. Una transacción bloquea la misma fila de sesión que utiliza el trigger M5 de escritura de mensajes, fija el cuestionario nativo y su política y cierra la sesión. Una segunda finalización devuelve el mismo cuestionario. No se ejecuta IA ni la evaluación farmacéutica al cerrar. Nuevos mensajes, incluidas respuestas tardías, no se pueden persistir; la sesión no puede reabrirse una vez existe el cuestionario.

La definición procede exclusivamente de `case_version_id`, no de la revisión más reciente. Preguntas, opciones, claves y política se conservan en una instantánea inmutable. Guardar requiere la revisión esperada; dos pestañas no pueden sobrescribirse silenciosamente. Recargar o volver desde «Mis cuestionarios» recupera la entrega. La entrega definitiva es inmutable; repetir exactamente la misma entrega devuelve el recibo existente.

Las APIs verifican autenticación, rol de estudiante y ownership real en PostgreSQL. Proyectan únicamente enunciados, opciones, respuestas propias y recibo. Claves, justificaciones, solución docente y nota permanecen en servidor incluso después de entregar. El endpoint anterior de evaluaciones también retiene resultados de paquetes nativos hasta una política explícita de M9. No se cambian resultados históricos de formatos anteriores.

## Contratos y migración

`0011_v2_session_questionnaires.sql` añade políticas inmutables por versión y entregas por sesión; no migra ni recalifica entregas históricas. `questionnaire-policy/1`, `session-questionnaire/1`, `questionnaire-grade/1`: configuración explícita por pregunta de acierto, error, blanco, obligatoriedad y coincidencia exacta de conjuntos. No hay valores por defecto ni crédito parcial implícito. El mínimo cero forma parte de esta versión del contrato. El resultado normalizado no se integra en la nota global.

La única política creada para comprobar el recorrido es `m8-synthetic-exact-set-1`: dos preguntas sintéticas, un punto por acierto, cero por error/blanco, sin obligación de responder ambas. Se identifica como SYNTHETIC_TEST y la base exige el marcador desechable para registrarla. No constituye ponderación ni aprobación productiva. ACADEMIC_APPROVED requiere referencia explícita; esta entrega no crea ninguna política académica ni un editor para aprobarla.

Un caso sin paquete nativo válido o sin política configurada no se cierra por esta vía: devuelve un error comprensible. No se inventa cuestionario para formatos históricos. Esto requiere habilitación explícita antes de usar M8 con casos académicos.

## Lucía y María: revisión nueva, no aprobación

Las 16 preguntas (ocho por caso) se ofrecen mediante «Cargar cuestionario revisado», sin cambiar hechos, perfil ni solución. Guardar crea otra revisión y conserva los paquetes anteriores. La metadata opcional `question-review/1` mantiene compatibilidad histórica. PENDING_CLINICAL_DECISION impide convertir la nueva revisión a paquete ejecutable; READY_FOR_REVIEW no sustituye auditoría ni aprobación docente.

Se sustituyen distractores ajenos al caso por alternativas sobre dosis, evidencia, interpretación, intervención o derivación. Se eliminan referencias a «la propuesta» en los enunciados. Las claves abiertas continúan provisionales y reservadas:

| Caso | Preguntas pendientes | Decisión |
|---|---|---|
| Lucía | 5 y 7 | Criterio de derivación, urgencia y manejo aceptable; diabetes no equivale a mal control |
| María | 3, 6 y 8 | Clasificación PRM, intervención y condiciones de derivación |

Las otras once preguntas tienen una única clave propuesta respecto a los hechos; siguen pendientes de revisión docente. El autorreporte de Lucía no acredita adherencia global; los olvidos de María no demuestran RNM. El documento 33 conserva los cuestionarios históricos; la revisión completa reside en `teacher-questionnaire-revision.ts` y es legible/editable en la interfaz docente.

## Evidencia y límites

Pruebas nuevas: políticas y corrección determinista, aislamiento de claves antes/después de entrega, entradas inválidas, permisos, origen, errores seguros, revisiones concurrentes, cierre duplicado, entrega idempotente, versiones históricas y bloqueo real de mensajes. PostgreSQL se prueba exclusivamente en `chatusal_editor_disposable`, con marcador `teacher-editor-20261012-disposable` verificado.

La demostración usa un caso sintético independiente, una entrevista sintética persistida de tres mensajes y un alumno de prueba. No se publican Lucía ni María ni se simula una aprobación clínica real. No hay inferencias, conteos, calibraciones COV ni gasto nuevo.

M9 pendiente: aprobar configuración académica, definir autorización y momento de liberación, agregar componentes M6/M7/M8 sin dobles pesos y presentar feedback con DTOs autorizados y trazabilidad. También faltan aceptación docente de las preguntas y habilitación académica de los casos. M8 queda funcional parcial; no se acredita porcentaje nuevo. Proyecto: **51,53% acreditado / 57,23% propuesto**. M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT.

### Verificaciones nuevas de esta entrega

Suite offline final: **3954 PASS / 102 SKIPPED**. Primera ejecución: errores EPERM de temporales en sandbox; segunda: nueve regresiones Legacy cuyo doble SQL desconocía la nueva consulta de retención M9. Se amplió únicamente ese doble y sus aserciones de ownership; nueve regresiones focalizadas PASS y suite final completa PASS. TypeScript PASS. PostgreSQL M8 **6/6** (incluida reapertura rechazada); preparación de demostración sintética **1/1**; focalizadas de políticas/API/evaluaciones **102/102**. Lint intentado: solicita configurar ESLint; no se modifica configuración y no se declara PASS.

Navegador: entrevista sintética recuperada → finalizar → dos preguntas → guardar revisión 1 → recargar y recuperar selecciones → confirmar entrega → recargar recibo inmutable revisión 2. No se exponen claves, explicaciones ni score. La entrevista era un fixture persistido, no una conversación live. Esta evidencia es nueva; los resultados de auditorías clínicas y calibraciones anteriores no acreditan M8.

Después de la suite se añadió una regresión de la ruta de revisión docente: **10/10 PASS** en esa selección, TypeScript vuelto a comprobar; sin cambios funcionales posteriores. En el editor desechable se guardaron Lucía v7 y María v5 con las preguntas revisadas, conservando las revisiones y paquetes previos. Ambas siguen TEACHER_DRAFT, sin auditoría nueva ni publicación.
