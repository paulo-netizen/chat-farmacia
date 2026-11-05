# Marco aprobado: aplicación y validación por fases

Decisión de Paulo registrada el 29-10-2026. Ejecuciones del 30-10-2026; cierre técnico del 05-11-2026. Base: `9573cc517c8a7119f9a3308505d70bcaeac3cd60`.

## Decisiones aplicadas

El progreso canónico pasa a **68,58% acreditado**, con el desglose aprobado del [documento 39](39_ACADEMIC_DECISION_PROPOSAL.md). No se añaden puntos por esta validación. M6 permanece 64/100, M7 PARTIAL sin acreditación nueva, PED2 abierto y D3B OPEN / VALIDATION DEBT. Las cifras 51,53% acreditado y 68,58% propuesto quedan como históricos anteriores a la decisión.

`academic-framework/2026-10-29` registra la aprobación. `questionnaire-policy/2` aplica ocho preguntas iguales, acierto 1 y error/blanco 0, sin penalización; `result-policy/2` aplica 35% SPFA, 35% actuación y 30% comunicación, con comprensión separada, un decimal y liberación docente de la composición exacta. Una dimensión ausente o provisional mantiene pendiente el global. Son políticas aprobadas, pero no publican casos ni convierten resultados semánticamente pendientes en definitivos.

Rúbrica M7 `/2`: nueve criterios, pesos 10/15/15/10/10/15/10/10/5 y niveles 0–3. Total solo con cobertura observable ≥80% y certeza suficiente. Se excluyen únicamente criterios justificadamente sin oportunidad; la omisión observada sigue en el denominador con nivel 0. Captura incompleta, incertidumbre o fallo técnico mantienen el total pendiente. Ejemplo: ocho criterios nivel 2 y escucha nivel 3 dan 71,7; si empatía carece justificadamente de oportunidad, cobertura 90% y total 72,2. Esta aprobación es para validación, no aceptación semántica.

## Lucía y María: revisiones nuevas

El editor incorpora **Aplicar marco aprobado**. Verifica revisión actual, autorización, origen y coincidencia de hechos/identidad/tratamiento antes de ofrecer los cambios; guardar crea otra revisión. No sobrescribe versiones utilizadas ni publica automáticamente.

| Caso | Decisión aplicada | Preguntas revisadas y límites |
|---|---|---|
| Lucía | SEFAC 2024 como referencia explícita; atención primaria no urgente con los hechos descritos. No se infiere descompensación ni etiología. Confort y reevaluación, sin antibiótico ni cambio de pauta. PRM/RNM no determinables; autorreporte de tomas no demuestra adherencia global. | L5 se refiere expresamente a SEFAC. L7 pregunta por el plan más completo: derivación no urgente + confort + señales de reevaluación. Distractores plausibles omiten componentes o subordinan indebidamente toda la decisión a una temperatura aún no medida. |
| María | PRM principal por omisiones; no adherencia no intencional y barrera práctica. Recordatorio técnico con educación y adaptación a su rutina; RNM no determinable. No se presume control tensional ni se modifica dosis. | M3 y M6 justifican clasificación e intervención aprobadas. M8 contrasta revisión de pauta prematura, ajuste basado solo en omisiones, espera pasiva y actuación con reevaluación condicionada. Clave: intervenir ahora y reevaluar si persisten dificultades o aparecen señales de seguridad. |

Los perfiles comunicativos aprobados se conservan como autoría explícita; no se deducen de edad, enfermedad o adherencia. Las cinco preguntas dejan de figurar como decisiones clínicas abiertas: pasan a revisión del paquete y auditoría, sin atribuir aprobación académica final al caso.

Revisiones creadas y recuperables exclusivamente en PostgreSQL desechable:

| Caso | Borrador nuevo | Candidato nativo |
|---|---|---|
| Lucía | `casever_a824f330-6f00-4646-9a06-a2b501033b6c` | `casever_878b5655-5d3e-469e-92bf-a58542991bbd` |
| María | `casever_b70fcefc-f539-4cd3-a2d2-8ad09ed19e02` | `casever_1674fb29-2b36-4c6d-b3f9-c84cbe1bac82` |

Ambas conversiones nativas son READY; aprobación y publicación permanecen pendientes. Sus predecesoras, sesiones e históricos no se modifican. Referencias clínicas y hechos íntegros: [33](33_NATIVE_TEACHER_AUTHORING.md) y [39](39_ACADEMIC_DECISION_PROPOSAL.md); sus frases de decisión pendiente se leen como históricos, sustituidas por este marco. La tabla 11 de [SEFAC 2024, p. 41](https://www.sefac.org/system/files/2025-04/GUIA%20IRAS.pdf) y la referencia CCFC a diabetes mal controlada no autorizan a inventar ese estado en Lucía.

## Resultados reales, sin seleccionar intentos favorables

Configuración común: `gpt-5.6-terra`, medium, Standard, endpoint global Responses, store:false, salida máxima 8.000 y timeout 60 s. Una inferencia por ejemplo; cero reintentos/fallback. Conteos oficiales exactos por solicitud; etiquetas exclusivamente locales. No se repiten lotes históricos.

### Desarrollo M7

Se congelaron entradas y etiquetas propuestas separadas en `tools/communication-validation/inputs.ts` y `labels.ts`. Rúbrica/instrucciones `/2`, representación del proveedor `/2`. Las referencias de este desarrollo no son etiquetas independientes revisadas por Paulo.

| Ejemplo | Resultado técnico | Esperado / observado |
|---|---|---|
| M7D1 | Válido | Esperado 2,2,3,2,2,2,2,2,2; observado 2,3,2,2,3,2,3,2,2 |
| M7D2 | STATE_INVALID | No entra en denominador semántico |
| M7D3 | STATE_INVALID | No entra en denominador semántico |
| M7D4 | STATE_INVALID | No entra en denominador semántico |
| M7D5 | STATE_INVALID | No entra en denominador semántico |
| M7D6 | STATE_INVALID | No entra en denominador semántico |

Orden: acogida, preguntas, escucha, empatía, ausencia de juicio, claridad, colaboración, resumen, cierre. Validez **1/6**; coincidencias exactas **5/9 criterios válidos**. Cuatro diferencias de un nivel: preguntas, ausencia de juicio y colaboración +1; escucha −1. Cero falsos adecuados (nivel 2/3 frente a referencia 0) en el único ejemplo válido; no generalizable. Los cinco fallos no son 45 errores académicos ni ceros. Total provisional D1: 78,3. Las citas se resuelven literalmente y pertenecen al estudiante; el desacuerdo está en los niveles atribuidos, no se convierte en aceptación semántica por esa validez.

El gate 6/6 válido y ≥90% exacto no se supera. M7V1–M7V6 **no ejecutados**. La inspección offline demuestra que el esquema `/2` permitía combinaciones que el validador rechazaba. No permite saber cuál ocurrió en cada respuesta fallida: no se conservó raw y no se reconstruye.

Corrección posterior **solo offline**: `communication-wire/3` expresa ramas de estado compatibles, manteniendo `/2` reproducible. `OBSERVED` exige nivel y oportunidad; ausencia exige nivel 0 y ninguna cita inventada; no observados tienen nivel null y absence=false; captura incompleta/uncertainty exigen revisión. `communication-diagnostic/1` informa criterio, campo y todas las infracciones de estado independientes mediante códigos cerrados. No transforma una adjudicación inválida ni cambia etiquetas. Las cinco familias de salidas legítimas atraviesan esquema y validador en tests. `/3` **no tiene validación live** y requerirá nuevos conteos.

### COV1 R3

Primero se verificó offline una adjudicación completa usando el fixture real: único mensaje «Me mareo.» e informe «Presenta sensación de giro. Inicio desconocido.». La cita del transcript cubre toda la fuente disponible; no prueba literalmente la ausencia de un dato, que depende de la captura completa declarada. No se inventa inicio ni se equiparan mareo y giro.

La única nueva inferencia resultó válida: fidelidad **INSUFFICIENT**, inicio **DEMONSTRATED**, afirmación específica **UNSUPPORTED**, inicio desconocido **SUPPORTED**. Coincidencias 2/2 criterios y 2/2 afirmaciones previstas; ningún extra. UNSUPPORTED no equivale a falsedad ni peligrosidad. Citas literales y offsets resueltos por servidor correctos. Revisión semántica: la mayor especificidad no está sustentada; desconocimiento del inicio es coherente con la única fuente y su completitud. Es calibración, no validación independiente ni explicación retrospectiva de errores anteriores.

Se conserva la proyección publicada: request/1, instructions/2, `referral-report-sources-adjudication/3`. El nuevo permiso `cov-framework-r3/1` autoriza únicamente este R3 en un diario separado, concilia padres/reservas, vincula conteo exacto y bloquea duplicados. No abre otros ejemplos.

### Auditorías de los nuevos paquetes

| Caso | Ejecución | Consecuencia |
|---|---|---|
| Lucía | Respuesta recibida, AUDITOR_REFERENCE_INVALID | Auditoría pendiente; ninguna aprobación |
| María | Respuesta recibida, AUDITOR_REFERENCE_INVALID | Auditoría pendiente; ninguna aprobación |

No conocemos qué referencia concreta fue inválida. La inspección confirma una incoherencia de diseño: el paquete contiene identificadores nativos y de autoría, mientras el esquema admitía cualquier string y el validador solo admitía IDs de autoría. Eso es un defecto comprobado del contrato, **no la causa demostrada de las dos respuestas perdidas**.

Corrección offline: `teacher-native-audit-input/2` / `audit-references/2` exponen IDs elegibles por campo en el esquema, sin reasignarlos ni descartar referencias inválidas. Las preparaciones nuevas usan `/2`; las históricas se reconstruyen con `/1`. El diario futuro distingue FACT_REFERENCE_UNKNOWN y SOURCE_REFERENCE_UNAVAILABLE por dimensión y campo, sin valores recibidos. Se mantienen uso e identificadores. No hubo repetición tras corregir.

CIMA metformina disponible y sin truncar; enalapril disponible **truncada**. Se corrige el gate para que fuentes truncadas mantengan PENDING incluso ante un juicio PASS. Los extractos CIMA no sustituyen la fuente específica de garganta ni el protocolo SPFA completo. Antes de auditar nuevamente: completar fuentes pertinentes, crear/preparar revisión vinculada y efectuar nuevo conteo. No se reutilizan las dos auditorías fallidas.

## Fases independientes y referencia docente

La conformidad de R3 permite preparar el lote independiente COV1. COV2/COV3 mantienen su evidencia favorable histórica, sin repetirla y sin adjudicarles los fallos M7. Los lotes nuevos de seis por capacidad siguen sujetos al requisito VAL-01 del documento 39: conjunto nuevo con etiquetas revisadas/selladas por Paulo. La aprobación de criterios generales no convierte las etiquetas nuevas propuestas por un agente en referencia docente independiente. No se han ejecutado ni declarado superados esos tres lotes. Esta parte del plan permanece pendiente; no se atribuye a falta de presupuesto ni a R3.

## Propuesta M6 por caso — pendiente, cálculo académico bloqueado

Se descarta el reparto 70/30 de Lucía. Estos son **pesos propuestos de nota**, no puntos del proyecto. No se instalan en E2 ni se deriva una puntuación de D2. Hasta aprobar la lista exacta: valoración cualitativa.

| Lucía: criterio | Peso propuesto | Evidencia distinta de la mera exploración M5 |
|---|---:|---|
| Decisión de atención primaria no urgente | 30 | Actuación expresada y destino/urgencia coherentes con hechos F1–F3/F7 obtenidos |
| Justificación y límites de conclusión | 15 | Relaciona diabetes con protocolo seleccionado sin afirmar descompensación o diagnóstico |
| Confort mientras obtiene valoración | 15 | Propuesta concreta de confort, sin sustituir derivación ni instaurar tratamiento no sustentado |
| Seguridad y condiciones de reevaluación | 20 | Explica conducta ante empeoramiento/señales sustentadas y evita cambios de medicación no indicados |
| Personalización y comprobación | 20 | Tras conocer F6, vincula una opción sencilla a su preferencia y capacidad referidas y comprueba viabilidad; no basta nombrar una barrera ni exigir aceptación |
| **Total** | **100** | Sin puntos por preguntar algo ya puntuado en SPFA |

| María: criterio | Peso propuesto | Evidencia |
|---|---:|---|
| Identificación del PRM principal por omisiones | 20 | Interpretación explícita del uso real; no solo preguntar la pauta |
| Tipo no intencional y barrera práctica | 15 | Relación razonada entre olvidos y rutina, sin culpa o inferencia psicológica |
| Recordatorio técnico pertinente | 20 | Propone ayuda concreta para omisiones, sin modificar dosis |
| Educación y comprensión | 10 | Explicación de finalidad/uso y comprobación; aquí se valora contenido de intervención, no estilo M7 |
| Personalización y viabilidad | 20 | Adapta la ayuda a rutina conocida, comprueba posibilidad de uso y atiende dificultad pertinente si se expresa |
| Seguridad, reevaluación y límites RNM | 15 | RNM no determinable, sin atribuir daño/control; condiciones de nueva valoración sustentadas |
| **Total** | **100** | Sin premiar aceptación, resultados longitudinales o hechos ocultos |

Decisión nueva requerida: aprobar/corregir estas unidades y pesos para cada revisión. La respuesta a dificultades es condicionada; no se fuerza su aparición ni se redistribuyen pesos silenciosamente. El plan ejecutable deberá separar adaptación/comprobación/respuesta condicional y fijar aplicabilidad antes de calcular. Seguridad necesita criterios aceptados para estos casos; D2 UNSUPPORTED/CONTRADICTORY sigue review-only. Informe y seguimiento no reciben exigencias adicionales por esta propuesta.

## Consumo y reservas

| Partida | Inferencias nuevas | USD calculables | Reserva conservada USD | Conteos de coste desconocido |
|---|---:|---:|---:|---:|
| Histórico previo | — | 0,3457322 | 3,053625 | 60 |
| Desarrollo M7 | 6 | 0,150582 | 0,602596 | 6 |
| Auditoría Lucía | 1 | 0,086578 | 0,142008 | 1 |
| Auditoría María | 1 | 0,087146 | 0,152068 | 1 |
| R3 | 1 | 0,015870 | 0,102008 | 1 |
| **Acumulado** | **9 nuevas** | **0,6859082** | **4,052305** | **69** |

Reservas no son cargos facturados y no se suman al coste como consumo doble. Se conservan íntegramente por prudencia. Los nueve intentos recibieron respuesta y uso: no hay una nueva inferencia de resultado incierto. Los fallos de validación sí consumieron tokens. M7: 10.638 entrada / 10.333 salida. Auditorías: 18.403 y 22.427 entradas; R3: 2.403 entrada / 822 salida (incluye 496 razonamiento).

Tarifas verificadas 30-10-2026: [modelo](https://developers.openai.com/api/docs/models/gpt-5.6-terra), [caché](https://developers.openai.com/api/docs/guides/prompt-caching): 2 USD/M entrada ordinaria, 0,20 lectura caché, 2,50 escritura TTL predeterminado 30 min, 12 salida incluido razonamiento. Reserva por solicitud `ceil(tokensEntrada × 2,5 + 8.000 × 12)` microUSD. Sin crédito de caché anticipado. Los conteos no se registran como gratuitos.

Referencia cambiaria consultada para la ejecución: [BCE, 29-10-2026](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.hr.html), 1 EUR = 1,1130 USD. El techo interno de 6 USD de reservas equivalía a 5,39 EUR; una provisión ilustrativa de 21% impuestos y 5% cambio lo situaba en 6,85 EUR, dejando margen frente a 15 EUR. No es el tipo efectivo del cargo ni una prueba de total facturado: **69 costes auxiliares desconocidos impiden garantizar un máximo monetario comprobado**. No se incrementó la autorización de 15 EUR.

## Evidencia técnica y pendientes

- Suite offline antes de las correcciones posteriores a live: **4.016 PASS / 123 SKIPPED**, una ejecución; no evidencia semántica.
- Gate final tras las correcciones de esquemas y compatibilidad: **4.034 PASS / 123 SKIPPED**. La segunda suite se justifica por cambios posteriores en el esquema M7, la reconstrucción de auditorías y el soporte de sesión COV; no fue repetición sin cambio.
- Pruebas focalizadas posteriores: 34 PASS (auditor, referencias, transporte M7 y permiso R3); 16 PASS (ramas M7 y adaptador). TypeScript y diff-check PASS.
- Revisión final: se corrigió la etiqueta de versión de origen para intentos M7 `/2` pendientes/fallidos; 16 PASS focalizados de marco/store y TypeScript PASS. No se repitió la suite por ese cambio localizado; 4.034 sigue siendo la evidencia de la suite anterior a esta corrección de metadatos.
- PostgreSQL desechable: nueva rúbrica `/2`, cobertura y score provisionales recuperados por M9, una sola adjudicación, acceso ajeno denegado y liberación anterior invalidada. Evidencia histórica de esta entrega: 25 PASS / 1 SKIPPED en selección mixta antes de las correcciones del auditor.
- PostgreSQL final: **13 PASS / 1 SKIPPED**, incluyendo auditoría `/2`, historial, concurrencia y M9. Un intento previo falló por Docker apagado (ECONNREFUSED); tras verificar y arrancar únicamente el contenedor desechable del editor, se completó esta selección. No se usó una base de aplicación.
- Lint no ejecutable: `next lint` abre el asistente inicial de ESLint. No se configuró ni se cambiaron dependencias.
- Sin migraciones nuevas, despliegue ni cambios productivos. Los nueve archivos COV ajenos y logs locales quedan fuera del commit.
- Los checks del checkpoint se ejecutaron con los nueve cambios COV ajenos aislados temporalmente; se restauran íntegros al finalizar. No se atribuye este PASS a la combinación con trabajo ajeno no publicado.

Para uso docente faltan: validar la nueva representación M7 con el plan acotado sin reciclar desarrollo como reservado; sellar referencias independientes COV y ejecutar sus fases; completar fuentes y auditar representaciones definitivas de Lucía/María; aprobar planes M6 exactos; resolver PED2/D3B y capacidades M6 restantes; integración académica de dimensiones definitivas; aceptación de usabilidad y preparación operativa M0/M11. El marco, los perfiles y las políticas ya aprobados no se vuelven a someter como decisiones abiertas.
