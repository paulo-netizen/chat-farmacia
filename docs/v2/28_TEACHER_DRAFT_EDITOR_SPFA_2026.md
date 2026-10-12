# Editor docente de borradores y contraste SPFA 2026

Fecha: 2026-10-12. Base: `5b03ac05a70d9fc2a9699c7a8f4478a1d3c3aa2d`.
Entrega de desarrollo: edición y recuperación de Lucía y María, sin publicación, conversación ni aceptación académica. [Casos completos para revisión](27_SPFA_DEVELOPMENT_DRAFTS.md). [Progreso canónico](PROJECT_STATUS.md): sin puntos nuevos.

## Fuente y contraste

Guía práctica de Servicios Profesionales Farmacéuticos Asistenciales, Foro AF-FC, edición 2026, ISBN 978-84-09-92184-3, archivo facilitado `GUIA_SPFA_FORO_2026_V5_DO.pdf`. SHA-256: `cf297b516c9134d064cd765c49d0b73d8168207120601669f4e6e73a94906387`. Las referencias siguientes son páginas **impresas**; el PDF contiene pliegos de dos páginas. Se extrajeron los capítulos pertinentes y se inspeccionaron visualmente sus tablas y diagramas. No se incorpora una copia del PDF al repositorio.

| Asunto | Referencia | Aplicación concreta |
|---|---|---|
| Dispensación: destinatario, comprobaciones normativas, inicio/continuación y cambios | 40–43 (figura 3 en 40–41) | María especifica destinataria, prescripción válida ficticia, continuación sin cambios, uso real, percepción y ausencia de cifras de PA disponibles. No deducir efectividad de «me encuentro igual». |
| Incidencia y Episodio de Seguimiento | 44 | Estudio puntual de la incidencia; no convertirlo en otro servicio de SFT ni exigir resultados longitudinales para este editor. |
| PRM | 33–37; tabla de falta de adherencia/conocimiento en 34 | Los olvidos sustentan falta de adherencia. Considerar conocimiento del uso en continuación; no aplicarlo por defecto al inicio. No convertir PRM en RNM manifestado. |
| RNM: necesidad, efectividad y seguridad | 44–46, 54–55 | María carece de resultados clínicos que demuestren un RNM manifestado; se conserva ese límite en solución y cuestionario. Sin nuevas categorías ni pesos. |
| Indicación: PA-SI-T-A-M-A-E, derivación y tratamiento | 51–56 (esquema en 52–53) | Lucía explicita información que debe obtenerse y revelación del tratamiento. La selección concreta de medicamento/derivación requiere protocolo clínico específico; la guía general no aporta un umbral universal para su dolor de garganta. Si se propone medicamento, corresponde su Dispensación. |
| Adherencia: evaluación y métodos | 80–82 | Lucía refiere 14/14 dosis en siete días: es autorreporte delimitado, no demostración de adherencia global. Conclusión global no determinable; tipo y barrera no aplicables mientras no se identifique falta de adherencia. María refiere dos omisiones concretas por olvido. |
| Tipos de falta de adherencia | 81 | La categoría errática ya existe en el contrato del evaluador. Se corrige su omisión en las listas documentales; no se crea una taxonomía nueva ni se reetiquetan históricos. |

Discrepancia de la propia fuente: p. 33 anuncia nueve dimensiones PRM y pp. 33–37 enumeran ocho. Se registra en PLAN; no se inventa una novena. Los hechos de los dos casos son sintéticos para desarrollo, no afirmaciones extraídas de pacientes reales. La especificación maestra y los documentos de producto/protocolos quedan alineados con estas precisiones. La ausencia previa de la guía queda resuelta; la revisión clínica específica de los borradores sigue pendiente.

## Recorrido implementado

Ruta `/profesor/casos/borradores`, accesible desde Casos del docente:

1. Abrir Lucía o María crea una copia de trabajo propia, una sola vez. Abrir de nuevo conserva las ediciones.
2. Editar identidad, demanda, tratamiento reservado, hechos y revelación, adherencia, solución, requisitos con aplicabilidad y soporte, y preguntas/respuestas. Formularios y selectores, sin JSON.
3. Guardar valida campos obligatorios, límites y referencias. Cada guardado crea una versión inmutable con padre; una edición obsoleta obtiene conflicto, sin sobrescribir la ajena.
4. Cerrar y volver a abrir recupera la última versión persistida. Cambios sin guardar requieren guardar o descartar; también se avisa al abandonar la página.
5. Vista estudiante muestra exclusivamente nombre, edad y sexo. Vista docente muestra hechos, tratamiento, solución y respuestas. Es una previsualización dentro del área docente, no una sesión estudiantil.

Los borradores utilizan `teacher-case-draft/1`, formato `TEACHER_CASE_DRAFT_V1`, procedencia `TEACHER_AUTHORED` y referencia `foro-2026-development/1`. La migración `0005_v2_teacher_case_drafts.sql` añade el formato a las tablas existentes de versiones, conserva las ramas de contratos históricos y no efectúa backfill. Era necesaria porque el esquema anterior rechazaba toda inserción TEACHER_AUTHORED. No se presenta este formato como `GENERATED_CASE_BUNDLE_V2` ni se inventan aprobaciones.

Las versiones solo pueden permanecer TEACHER_DRAFT o archivarse; la base impide revisión/publicación de este formato. La fila lógica utiliza el estado legacy no disponible `rejected`, sin contenido clínico en sus columnas legacy. Un guard impide convertirla en approved por la ruta antigua. La lista legacy omite estos casos de autoría. Los snapshots, su padre y los eventos preservan trazabilidad; no hay recalificación ni modificación de sesiones históricas.

## Autorización y aislamiento

API `/api/teacher-drafts`: exige sesión docente/administrador, comprueba de nuevo el rol real en PostgreSQL y limita lectura/edición al propietario (administrador autorizado puede acceder). Las mutaciones comprueban origen, las respuestas son `private, no-store` y los errores usan categorías controladas. No se reflejan excepciones SQL ni claves arbitrarias recibidas.

`/api/teacher-drafts/:id/preview` devuelve únicamente los tres campos iniciales, tras autorización y ownership. La API editorial completa solo es accesible al docente autorizado. Los datos reservados se conservan para futura revelación legítima, sin trasladarlos a la ficha inicial. La validación del editor es estructural: no certifica corrección clínica ni aceptación pedagógica.

No se escriben sesiones, mensajes, evaluaciones ni asignaciones. El resolver estudiantil y los guards de base rechazan iniciar estos borradores. No se implementa un segundo simulador ni se invoca OpenAI.

## Demostración y evidencia nueva

Entorno local exclusivamente desechable: PostgreSQL 17.10, contenedor etiquetado `chatusal-editor-20261012`, puerto de loopback 55451, base `chatusal_editor_disposable`, marcador `teacher-editor-20261012-disposable`. Se verificaron identidad, etiqueta y puerto antes de aplicar las migraciones 0001–0005. No se utilizaron bases de aplicación ni compartidas.

`tools/teacher-drafts/serve-disposable.cjs` verifica la identidad de esa base y la migración; inicia la demostración en `http://127.0.0.1:3105/profesor/casos/borradores`, sobrescribiendo ambas variables de conexión con la base desechable. Usa cuentas sintéticas locales, no copia credenciales de aplicación. No ejecuta migraciones automáticamente. `verify-disposable-http.cjs` comprueba acceso y aislamiento con HTTP real después de abrir ambos casos.

- Navegador real: apertura, cambio de título, guardado, cierre y recuperación de ambos casos; error comprensible al vaciar el nombre; descarte sin perder la versión guardada; ambas vistas y ficha inicial con tres campos.
- HTTP real: sin sesión 401, estudiante 403, previews de tres campos, caché desactivada. Recuento final de sesiones, mensajes, evaluaciones y asignaciones: cero.
- PostgreSQL desechable: **6/6**, incluyendo recuperación desde conexión independiente, snapshots inmutables, apertura concurrente idempotente, conflicto de guardado, rol/ownership, rechazo de publicación/uso académico y aislamiento antes de await.
- Selección offline de editor y fronteras estudiantiles: **200/200**, incluidos **15** tests de contrato y **9** de rutas nuevas.
- Suite offline final: **3839 PASS / 73 SKIPPED** (incluye seis pruebas nuevas PostgreSQL desactivadas en esa ejecución; se ejecutaron aparte en la base desechable). TypeScript: PASS. Diff-check de trabajo y staged: PASS al cierre.
- Lint permanece bloqueado por la configuración interactiva de ESLint del repositorio; no se configura ni se añaden dependencias en esta entrega.

La suite **3815 PASS / 67 SKIPPED** pertenece a la entrega anterior de visibilidad; no sustituye las comprobaciones nuevas. Los cambios COV preexistentes se conservan aparte y no forman parte de esta entrega ni de sus resultados.

## Siguiente incremento concreto, aún no implementado

Para conversar en previsualización: convertir una versión de borrador revisada a las proyecciones validadas de hechos/revelación del runtime de paciente existente, con contexto de prueba inequívocamente separado de sesiones y evaluación académicas. El formato actual no permite fingir que esa conversión ya está hecha.

Para publicación docente: completar la revisión clínica específica, validar taxonomía/solución/requisitos y cuestionario, integrar la transformación al contrato ejecutable y el workflow explícito de revisión/publicación. Mantener versiones usadas inmutables y verificar de nuevo autorización y aislamiento. No habilitar simplemente un botón que apruebe la fila legacy.

Seguimiento e informe continúan condicionados al caso; no son servicios nuevos de esta entrega. Estos borradores son material de desarrollo, no validación independiente. M6 64%, proyecto 51.53%, M6/M6-E PARTIAL, PED2 abierto, perfiles productivos no aprobados y D3B OPEN / VALIDATION DEBT.
