# Prueba docente del paciente desde un borrador

Entrega de desarrollo sobre `00e59012d8a875d21bc5858715a38244654a2cb0`, 13 de octubre de 2026.
No publicación académica, despliegue ni aceptación clínica. Los cambios COV preexistentes se conservan fuera de esta entrega.

## Recorrido y contrato

En `/profesor/casos/borradores`: abrir Lucía o María guardada → **Probar paciente** → **Abrir prueba de la revisión guardada** → ficha con nombre, edad y sexo → **Escuchar demanda del paciente** → preguntas. Es necesario guardar antes los cambios. **Reiniciar prueba** cierra la conversación anterior y abre otra; **Volver al editor** permite editar. Cada conversación fija la revisión guardada y no cambia al editar el caso. Una prueba nueva usa la nueva revisión, aunque su ejecución live exige que dicha revisión esté incluida en la autorización privada vigente.

`TEACHER_DRAFT_PATIENT_V1` / `teacher-patient/1` es una proyección paciente explícita, no un bundle académico fabricado. Valida el borrador y conserva identidad, demanda, tratamiento privado, hechos y condiciones de revelación. No rellena personalidad ni hechos ausentes. No entrega solución, rúbricas, requisitos, clasificación de adherencia ni respuestas del cuestionario al modelo. Las condiciones de revelación redactadas por el docente se interpretan semánticamente; no se convierten en permisos para cambiar de rol. La consistencia clínica de los textos sigue requiriendo revisión.

Se reutilizan `generateSafePatientReplyV2`, prompt de paciente, guard determinista y validador semántico existentes, con una rama explícita para la nueva proyección. Legacy y bundles publicados conservan sus ramas. La demanda inicial es texto del docente, comprobado por ambas barreras; no se presenta como generación del modelo. Cada respuesta posterior requiere generación y validación. No se muestra una respuesta rechazada ni se reintenta automáticamente.

## Aislamiento y operación local

Todas las rutas comprueban autenticación, rol docente y propiedad actuales en servidor; las escrituras comprueban origen. El cliente no aporta historial ni proyección. La vista de conversación devuelve exclusivamente identidad, revisión, estado y mensajes aceptados. No crea `sessions`, `messages`, `evaluations` ni `case_assignments` académicos.

Las instantáneas privadas locales caducan a las 24 horas para el acceso, pero no se borran automáticamente: retención/supresión institucional sigue pendiente. Archivos privados ignorados por Git, permisos restrictivos, escritura sincronizada y reemplazo atómico; lock exclusivo por conversación y por presupuesto. Estado RUNNING persistido antes de esperar al runtime; solicitudes inciertas no se repiten. Un lock abandonado requiere revisión, nunca se roba automáticamente. Un fallo de escritura bloquea la operación. Este almacenamiento local de demostración no sustituye una política de operación distribuida/productiva.

La demostración utiliza exclusivamente `chatusal_editor_disposable`, puerto 55451, con marcador `teacher-editor-20261012-disposable`, sin migraciones nuevas. El lanzador `tools/teacher-drafts/serve-disposable.cjs --patient-preview` verifica esa identidad; necesita clave local y `TEACHER_PREVIEW_LIVE_AUTH` hacia una autorización privada. Sin el flag, el lanzador no habilita llamadas. No se publica el permiso ni las conversaciones privadas.

## Modelo y presupuesto

Configuración de demostración: `gpt-5.6-terra`, Responses global Standard (`default`), razonamiento medium, `store:false`, máximo 4.096 tokens de salida y timeout 60 s. Cada solicitud obtiene un conteo oficial de su entrada exacta antes de reservar. Sin SDK, fallback ni reintentos. Máximo 16 inferencias incluyendo validaciones; máximo interno 4 USD **acumulados en reservas**, no un nuevo presupuesto autorizado.

Histórico conciliado: 19 respuestas con uso, 0,2006372 USD calculables, 1,957064 USD reservados y 42 conteos de coste desconocido. Se conserva también un evento METADATA vacío; no se interpreta como una inferencia adicional ni como coste cero. Los diarios históricos se verifican por hash antes de enviar. El diario nuevo conserva reservas incluso tras fallo y rechaza reinicios inciertos, alteraciones de estructura o autorización.

Fuentes consultadas el 12 de octubre: [modelo](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [tarifas oficiales](https://developers.openai.com/api/docs/pricing). USD/millón: entrada ordinaria 2, lectura de caché 0,20, escritura de caché 2,50 en sustitución de entrada ordinaria, salida 12 incluyendo razonamiento. Reserva conservadora por solicitud: `ceil(input_tokens × 2,5 + 4096 × 12)` microUSD. Se registra el uso real de cada categoría cuando está disponible; no se guardan respuestas raw.

[Referencia BCE USD/EUR](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html), 12 de octubre: 1 EUR = 1,1181 USD. Con margen de planificación del 30% para impuestos y 10% para cambio, 15 EUR equivalen a unos 11,73 USD de planificación. El techo de reservas de 4 USD deja margen adicional. Estos márgenes no acreditan el impuesto real ni permiten garantizar el total facturado: el coste de conteos es desconocido y expresamente aceptado por el usuario; nunca se registra como cero.

## Verificación

28 pruebas nuevas focalizadas PASS (24 unitarias, 4 de rutas): transformación de ambos casos, exclusión de respuestas docentes, versión fijada, autorización revocada, duplicados durante await, reinicio, errores seguros, transporte simulado completo, autorización directa, historial/configuración/presupuesto, exclusión global y diario corrupto. Estas simulaciones no acreditan resistencia semántica real a inyección.

Regresiones pertinentes iniciales: 229/229 PASS antes de añadir dos casos de presupuesto. TypeScript PASS. Primera suite completa: 3866 PASS, 73 SKIPPED y un fallo del test nuevo de concurrencia; su sondeo de lectura interfería con el rename atómico de Windows. Corregida únicamente la sincronización del test, la selección afectada pasa 28/28. Suite final con concurrencia acotada, justificada por ese fallo: **3867 PASS / 73 SKIPPED**, 106 archivos PASS / 8 omitidos. Lint sigue sin configurar: `next lint` solicita configuración interactiva; no se ha creado configuración ni cambiado dependencias.

HTTP real sobre la base desechable: ambos borradores recuperados, ficha inicial de tres campos, rutas privadas denegadas al estudiante, apertura/cierre de previews docentes y cero registros académicos. La evidencia histórica de guardado/recuperación del editor permanece separada de estas comprobaciones nuevas.

## Demostración real del 13 de octubre

Ejecutada desde el navegador, sin transporte simulado, con los dos borradores ya guardados (Lucía v3, María v2). Ocho respuestas aceptadas: dos demandas escritas y seis respuestas generadas. **14 inferencias** (6 generación + 8 validación) y **14 conteos**, sin reintentos ni fallos técnicos. No se han reabierto calibraciones COV ni cambiado instrucciones durante las conversaciones.

| Comprobación | Lucía | María |
|---|---|---|
| Antes de demanda | Solo Lucía, 42, Mujer | Solo María, 67, Mujer |
| Demanda | Molestia de garganta desde ayer | Recoger medicación habitual |
| Medicación preguntada | Metformina 850 mg con desayuno y cena | Enalapril 20 mg, un comprimido por la mañana |
| Uso real preguntado | Refiere ambas tomas diarias en siete días; no emite etiqueta global | Refiere dos olvidos en una semana al cambiar la rutina matinal |
| Número de hijos no definido | Respuesta no informativa, sin número inventado | No inventa número, pero expresa preferencia por no hablar de ello |

La preferencia expresada por María no consta en los hechos: aunque el validador la aceptó y no fabrica historia familiar, es un matiz de respuesta/estilo que necesita revisión antes de aceptación. No se declara fidelidad semántica exhaustiva. Reinicio de Lucía comprobado en navegador: nueva conversación vacía sin nueva inferencia. La inmutabilidad al editar se verifica automatizadamente; no se cambió la revisión autorizada durante el live.

Uso nuevo: **26.628 tokens de entrada** (16.650 lectura de caché, 9.936 escritura, 42 ordinarios), **456 de salida** incluyendo razonamiento facturable. Coste calculable nuevo **0,033726 USD**; reservas nuevas retenidas **0,754701 USD**. Acumulado conciliado: **0,2343632 USD calculables**, **2,711765 USD reservados**, **56 conteos de coste desconocido**. Todas las solicitudes nuevas tienen respuesta recibida; no hay nuevas reservas inciertas. Se conservan las reservas históricas sin liberarlas ni atribuirles coste cero. El total facturado sigue siendo desconocido.

## Pendientes

Revisión clínica y de revelación de ambos borradores; integración del paquete académico completo, auditor/generador, CIMA/AEMPS y publicación explícita; permisos, retención, operación multiinstancia y política productiva de presupuesto. M1/M2/M3 permanecen parciales; M2 ya no está «sin iniciar». Sin nuevos pesos ni acreditación: M6 64%, proyecto 51.53%, M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT.

## Actualización del 14 de octubre — sin reinterpretar el registro anterior

La preferencia de María se trata como una afirmación personal sin soporte, no solo como estilo.
`teacher-patient/2` aclara generación y validación; `/1` permanece idéntico para las instantáneas
históricas. Una nueva comprobación mínima aceptó «No sabría qué decirle sobre eso», sin añadir
la preferencia al caso. Las acciones de validar/publicar están implementadas para candidatos
canónicos auditados; la preparación del paquete y la auditoría clínica real siguen pendientes.
[Evidencia, costes, límites y fichas](31_TEACHER_REVIEW_PUBLICATION.md). Este añadido sustituye
únicamente el estado actual de esas piezas, no las cifras ni resultados históricos de arriba.
