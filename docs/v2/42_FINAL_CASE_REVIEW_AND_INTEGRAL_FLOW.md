# Casos para decisión y recorrido integral aislado

Base `2628e1fcf5100c60fe3256ccf98d20cc25648c52`, 06-11-2026. **68,58% acreditado**, sin incremento. M6/M7 PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT. Sin aceptación semántica nueva, publicación académica ni despliegue.

## Revisiones finales, fuentes y alcance

Se conserva `teacherApprovedFramework` para recuperar la autoría histórica. `teacherFinalReviewFields` incorpora una revisión editorial /2, que el editor puede aplicar antes de guardar. No modifica hechos, tratamiento, claves ni revisiones persistidas. L6 justifica su clave exclusivamente con F2: temperatura no medida; se elimina la afirmación accesoria sobre medicación. María conserva la prescripción vigente sin certificar su adecuación individual, y distingue actuación esperada de intervención realizada. El marco y los perfiles ya están aprobados; la aprobación final del caso sigue pendiente.

Entrada `teacher-native-audit-input/3`, configuración y solicitud fijadas al candidato exacto; /1 y /2 permanecen recuperables. Migración **0015**, aplicada solo en base desechable: admite hasta cuatro fuentes para /3, conserva el máximo histórico de dos. No altera bindings, claims ni resultados anteriores. Una edición exige nueva auditoría/aprobación de su revisión.

| Fuente incorporada | Edición, páginas y alcance enviado |
|---|---|
| [SEFAC IRA](https://www.sefac.org/system/files/2025-04/GUIA%20IRAS.pdf) | 2024, ISBN 978-84-09-71860-3; pp. 30 y 40–41. Selección parafraseada revisada, 1.073 caracteres, no texto íntegro ni cita literal. Separa la tabla común de derivación de IRA y los apartados sintomáticos. El pasaje de hidratación pertenece a tos y no acredita por sí solo eficacia para odinofagia aislada. |
| SPFA aportada por Paulo | Foro AF-FC 2026, V5_DO; pp. impresas 33–35, 40–46, 52–55 y 80–81; páginas PDF dobles 17–18, 21–24, 27–28 y 41. Selección parafraseada de 1.408 caracteres: PRM/RNM, dispensación, indicación y adherencia. No abre otro servicio longitudinal. |
| [CIMA metformina](https://cima.aemps.es/cima/dochtml/ft/68167/FichaTecnica_68167.html) | Sección clínica, 17.351 caracteres; referencia comparativa, no marca atribuida a Lucía. |
| [CIMA enalapril](https://cima.aemps.es/cima/dochtml/ft/63355/FT_63355.html) | Sección clínica, 35.759 caracteres, sin truncado. No ficha íntegra ni certificación de pauta individual. |

Las selecciones de guías registran hash del PDF de procedencia y del texto enviado, edición, páginas impresas/PDF y origen oficial o aportado por usuario. `retrievedAt` de una guía indica cuándo se recupera la selección local verificada, no una nueva descarga de la web. El validador rechaza alteraciones del texto o procedencia. CIMA conserva fecha de descarga y hashes del HTML y sección. Ningún PDF ni registro privado se publica en Git.

| Caso | Borrador final | Paquete nativo |
|---|---|---|
| Lucía | `casever_da62ddda-09ef-4678-8c9b-ad98647dd1d0` | `casever_ec68fe13-acbc-4bae-8e1e-f62db94e307d` |
| María | `casever_73151265-7a67-43dc-b5e1-fabdd989e236` | `casever_fa117bf4-c38c-4f95-b060-f329ce5a6a8d` |

Lucía mantiene atención primaria no urgente conforme al marco SEFAC aprobado, sin inferir descompensación. María mantiene PRM por omisiones, falta no intencionada y barrera práctica; RNM no determinable. La no derivación inmediata describe los datos actuales, no garantiza ausencia de necesidad futura: dificultades persistentes, dudas de pauta o hallazgos de efectividad/seguridad requieren reevaluación y determinación de urgencia según lo observado. No se inventan cifras tensionales.

## M7: revisión offline de todos los desacuerdos

Se reutiliza la ronda del [documento 41](41_M7_AUDIT_CHECK_AND_M6_DECISION.md): 6/6 válidos, 38/54 etiquetas coincidentes. No se cambian instrucciones, pesos, escala 0–3 ni referencias. No nuevas inferencias ni acceso al reservado. Las siguientes son **propuestas de aclaración**, no etiquetas aprobadas después de observar el modelo. R = referencia propuesta congelada; O = observado.

| Patrón y casos (R→O) | Descriptor y evidencia disponible | Aclaración propuesta / referencia que revisar |
|---|---|---|
| Preguntas D1 y D3, 2→3 | 2: abre y concreta; 3: aclaración flexible. D1 pregunta parte difícil y prioridad; D3 «¿Qué parte?» tras consulta abierta. | No premiar número de preguntas. D1 podría justificar 3 si se considera adaptación suficiente; D3 ofrece menos evidencia de flexibilidad. Revisar ambas referencias por separado, sin cambiarlas ahora. |
| Claridad D1, 2→3 | 3 exige adaptación a comprensión. Ofrece lenguaje sencillo y futura devolución con palabras propias; no se ve esa devolución. | Una comprobación prometida no es realizada. Contraste: nivel 2 por explicación clara; 3 cuando una respuesta efectiva permite ajustar la explicación. La referencia 2 es defendible. |
| Colaboración D1, 2→3 | Elige primera frase y pregunta conformidad. 2 abre participación; 3 delibera respetando elección/rechazo. | Acordar una prioridad puede ser colaboración sólida; no exigir rechazo. Decidir si basta para 3 o si falta deliberación contextual. No resolverlo por longitud. |
| Cierre D1 y D4, 2→3 | D1 ofrece dudas y despedida sin respuesta posterior. D4 recoge negativa a ayuda y confirma ausencia de dudas antes de despedirse. | Distinguir ofrecer cierre y comprobar cierre compartido. D1 apoya 2; D4 puede sostener 3 y requiere revisar referencia, no asumir error del modelo. |
| Resumen D1 2→1; D3 2→0; D4 2→3 | D1 recapitula plan y comprueba necesidad; D3 «Revisaremos esta frase juntos. ¿Es correcto?»; D4 resume horario de apertura, no cita, y ofrece dudas. | Aceptar recapitulación prospectiva pertinente sin exigir lista larga. D3 tiene evidencia de plan, aunque puede ser insuficiente para nivel 2: cero por ausencia total es discutible. D4 puede satisfacer priorización y corrección (3). Revisar referentes con estas distinciones. |
| Escucha D4, 2→3 | Usa la respuesta «apertura», comprueba localización y respeta «No hace falta». 2 usa/aclara; 3 integra/comprueba. | Referencia 2 puede infravalorar una integración completa en tarea sencilla. No exigir complejidad clínica para 3; conservar desacuerdo hasta revisión. |
| Empatía D3 U→1; D6 N→0 | D3 expresa inquietud y recibe «Entiendo». D6 expresa «Me sigue costando», sin emoción explícita; estudiante ignora el contenido. | «Entiendo» puede ser reconocimiento superficial (1), no implica necesariamente incertidumbre. Dificultad práctica no equivale siempre a emoción; definir cuándo genera oportunidad de empatía. No transformar una omisión con oportunidad en N. |
| Ausencia de juicio D3 2→3; D4 2→N; D6 1→0 | D3 propone leer juntos, sin reproche. D4 es neutral y colaborativo; D6 da órdenes al evaluador, sin reproche explícito al paciente. | Mantener 2 para interacción respetuosa y 3 para facilitar activamente explicar dificultades. No exigir tema sensible para que sea observable. En D6 falta cooperación, pero eso no demuestra por sí solo culpabilización: referencia 1 y salida 0 requieren justificación distinta de otros criterios. |
| Cierre D6, 0→1 | «Fin» no ofrece dudas ni despedida interpersonal. Nivel 1 describe despedida sin resolver dudas, no mero marcador técnico. | Recomiendo 0 para marcador aislado; 1 para despedida reconocible aunque incompleta. Referencia actual defendible. |

Total: **16 desacuerdos**; los patrones agrupan varios criterios, sin contarlos dos veces. D2 coincide en nueve ceros de desempeño sintético; D5 coincide en nueve capturas incompletas con total pendiente. No son fallos técnicos. Los cuatro desacuerdos históricos de wire/2 permanecen separados en doc. 41. Las causas de respuestas históricas no conservadas siguen indeterminadas.

## M6: ajustes propuestos, sin activar perfiles

Los pesos de doc. 41 permanecen pendientes: Lucía 30/15/15/20/20; María 20/15/20/10/20/15. No se reabre el marco 35% SPFA, 35% actuación, 30% comunicación aprobado; esto afecta al cálculo interno por caso, todavía bloqueado.

| Decisión que falta | Recomendación y ejemplo | Efecto |
|---|---|---|
| Equivalencia semántica en criterios M6 | Puntuar razonamiento observable, no nombres: «ha omitido dos dosis» puede identificar el problema sin decir PRM; «no sabemos el efecto en la tensión» expresa límite RNM. Derivar razonadamente sin pronunciar SEFAC es válido. | Aprobar los descriptores del perfil, sin exigir terminología ritual ni cambiar pesos automáticamente. |
| Alcance del recordatorio técnico de María (20) | Admitir alarma, calendario/lista o señal asociada a rutina si son pertinentes y viables, acompañados de educación. No imponer móvil, apoyo familiar o cambio de pauta. | Identificar una ayuda adecuada acredita el recurso; personalización (20) exige vincularla a la rutina conocida y comprobar viabilidad. La misma mención no gana ambos criterios. |
| Educación María (10) frente a M7 | M6 valora contenido correcto y accionable sobre finalidad y uso de la prescripción, sin inventar instrucciones. M7 valora lenguaje, escucha y cómo comprueba comprensión. | «Tómelo según su pauta» puede ser claro pero insuficiente como educación completa. Una explicación correcta con jerga puede cumplir contenido M6 y fallar claridad M7. No volver a puntuar en M6 el mero acto de preguntar si entendió. |
| Derivación y justificación de Lucía (30/15) | Separar decisión/destino/urgencia de la razón conectada a los datos, sin duplicar preguntas PA-SI de M5. | «Atención primaria no urgente» acredita decisión; explicar por qué esos hechos motivan derivación añade razonamiento. Repetir la recomendación no suma justificación. |
| Ausencia/incertidumbre y niveles por caso | Conservar propuesta 0/1/2 de doc. 41: solo captura completa y oportunidad permiten valorar omisión como 0. Captura insuficiente/incertidumbre/fallo dejan total pendiente. | Paulo debe aprobar los dos perfiles y su tratamiento de aplicabilidad antes de activar nota M6. No se solicita otra vez aprobar casos/perfiles comunicativos ya acordados. |

## Prueba integral aislada

`teacher-integral-flow-postgres.test.ts` utiliza el selector real de `/api/sessions` y PostgreSQL desechable; la autenticación del request se simula, los permisos de los stores se comprueban con usuarios persistidos. No es una prueba nueva de login/navegador. La conversación se inserta como tres mensajes sintéticos, no se presenta como respuesta de un modelo paciente.

Demuestra selección y recuperación de la misma versión sintética publicada; DTO inicial solo nombre/edad/sexo y sessionId; entrevista; cierre idempotente y bloqueo de mensajes; respuestas guardadas/recuperadas; entrega determinista; claves retenidas; revisión docente del recibo; liberación de composición exacta; recuperación sin nuevo recibo ni corrección. Comprensión 100 en fixture explícito; comunicación PENDING, global null. Usuario ajeno y rol estudiante no pueden revisar. Se comprueba igualdad de todos los registros históricos de los casos 7/8 antes/después.

Límite concreto: Lucía y María no son seleccionables académicamente mientras sean borradores; la prueba publica únicamente un fixture técnico mediante los gates existentes con auditoría simulada. M7 no se vuelve a evaluar; su persistencia/presentación provisional mantiene la evidencia previa de docs. 37–41. Una prueba real del paciente y aceptación clínica requieren pasos distintos. La política sintética /1 de la base desechable no certifica el despliegue de la política académica /2 ni su redondeo.

Verificación nueva: 31/31 unitarias de autoría/contratos, 12/12 de auditor/limites; integral 1/1; auditoría PostgreSQL 8/8; revisión docente PostgreSQL 6/6 (demo opcional omitida). La primera prueba integral falló por intentar insertar política /2 en el CHECK histórico /1; se corrigió el fixture a /1, no el contrato académico. TypeScript se repite tras los ajustes finales. No suite completa ni nuevas pruebas M7 sin cambio funcional que las justifique. Lint conserva la limitación histórica de configuración pendiente; no se configura ESLint.

## Auditorías finales y cierre

Se ejecutó **una auditoría por cada revisión final**, dos inferencias y dos conteos, sin reintentos. Ambas respuestas son técnicamente válidas y las referencias pertenecen a los hechos/fuentes enviados. Esa resolución referencial no prueba que todos los juicios sean correctos. No hubo nueva solicitud incierta. No M7, COV ni reservado.

| Dimensión | Lucía | María |
|---|---|---|
| Problema/tratamiento | WARNING | WARNING |
| Pauta | INSUFFICIENT | PASS |
| Contexto | PASS | PASS |
| PRM | PASS | PASS |
| RNM | PASS | PASS |
| Adherencia/barrera | PASS | PASS |
| Barrera/estrategia | PASS | PASS |
| Intervención | WARNING | PASS |
| Derivación | WARNING | PASS |
| Consistencia interna | WARNING | PASS |
| España | WARNING | PASS |
| Cuestionario | WARNING | WARNING |

**Lucía: PENDING, 5 PASS / 6 WARNING / 1 INSUFFICIENT. María: WARNING, 10 PASS / 2 WARNING.** Sin FAIL clínico ni fallo técnico. Ningún resultado autoriza publicar automáticamente. No se alteran las revisiones después de observar la auditoría para aparentar un PASS.

Recuperación final del servicio: ambos bindings `current=true`, ejecución COMPLETED y cero versiones publicadas. Lucía `canValidate=false / canPublish=false`; María `canValidate=true / canPublish=false`, lo que habilita revisión humana de advertencias, no una aprobación realizada.

| Hallazgo conservado | Evidencia / análisis de la revisión | Resolución recomendada para Paulo |
|---|---|---|
| Lucía, pauta INSUFFICIENT | F3/F4/F7 y CIMA: consta prescripción, faltan datos para certificar adecuación individual. No demuestra una pauta incorrecta. | Delimitar explícitamente que este caso de Indicación describe tratamiento previo sin auditar su adecuación individual. No inventar función renal ni control glucémico. El gate actual sigue bloqueado; requerirá resolver alcance de auditoría en una revisión posterior, no saltarlo manualmente. |
| Lucía, confort (problema/intervención/consistencia/cuestionario) | F1/F2/F5/F6/F7, SEFAC; hidratación está formulada como confort, pero el pasaje específico recuperado corresponde a tos. No prueba eficacia para odinofagia aislada. | Mantener solo confort factible sin alegar eficacia específica, o excluir esa medida de los requisitos puntuables hasta aportar respaldo pertinente. No se añade un tratamiento sintomático nuevo. |
| Lucía, derivación/estado editorial/España/cuestionario | F1/F2/F3/F7, SEFAC/SPFA; el auditor vuelve a tratar la decisión no urgente como pendiente pese a la instrucción que distingue el marco aprobado. | Conservar el juicio automático y documentar el desacuerdo humano: SEFAC y atención primaria no urgente ya fueron aprobados. No pedir ratificarlos ni convertir su condición docente en diagnóstico clínico. La aprobación final exacta del caso sí está pendiente. |
| María, problema/tratamiento WARNING | F1/F5/F7, CIMA: prescripción vigente no certifica adecuación, seguridad o efectividad individual. La pauta y el límite editorial obtienen PASS. | Resolver la advertencia reconociendo ese límite de alcance; no cambiar dosis ni inventar resultados. |
| María, cuestionario WARNING | F3/F4: justificación M5 dice «no refiere rechazo, temor ni problemas económicos». No mencionar otros motivos no los excluye globalmente. | En siguiente revisión, sustituir por «no constan datos que apoyen otros motivos; las omisiones descritas se explican por olvidos asociados a cambios de rutina». Conservar clave B y hechos. No se aplica tras la auditoría para conservar la identidad del paquete auditado. |

L6 no vuelve a recibir una advertencia de referencia; su clave permanece A. Los PASS de PRM/RNM/adherencia no equivalen a certificar resultados clínicos. El marco ya aprobado no se transforma retrospectivamente en propuesta por la recomendación de un auditor.

| Partida | Entrada / salida (tokens) | Coste calculable USD | Reserva conservada USD | Conteos de coste desconocido |
|---|---:|---:|---:|---:|
| Histórico anterior | — | 1,0063887 | 4,966522 | 77 |
| Lucía /3 | 19.727 / 2.110 | 0,074636 | 0,145318 | 1 |
| María /3 | 26.303 / 2.082 | 0,090740 | 0,161758 | 1 |
| **Acumulado** | **46.030 / 4.192 nuevos** | **1,1717647** | **5,273598** | **79** |

Uso con caché escrita informado: 19.724 y 26.300 tokens respectivamente; lectura 0. Razonamiento incluido en salida. Se conserva la fórmula y tarifas verificadas del doc. 41 (2 USD/M entrada, 0,2 lectura, 2,5 escritura, 12 salida), sin registrar conteos como gratuitos. Reservas y consumo no se suman como doble cargo. El límite sigue siendo **15 EUR acumulados**, con techo interno de reservas 6 USD; la facturación desconocida impide garantizar el total exacto en EUR. Ninguna reserva histórica se borra. Credenciales, grants y diarios quedan privados.

Cierre de checks: última selección 41/41 unitarias, más 2/2 de tamaño anteriores válidas (selecciones solapadas no sumadas); PostgreSQL 8 auditoría + 6 revisión + 1 integral, con demo opcional omitida. TypeScript PASS. Lint se intentó: pide configurar ESLint y termina sin completarse; no se instala ni configura. Los primeros fallos de entorno (base detenida), límite SQL de fuentes y tipado del test fueron corregidos antes del cierre. Migración 0015 exclusivamente desechable. Las pruebas integrales no afirman validar la calidad del modelo paciente ni los juicios de M7.

### Próximo paso concreto supervisado

Paulo puede recorrer ya el flujo sintético: ficha mínima → entrevista de prueba → cierre → cuestionario → revisión del recibo → liberación → resultados con global pendiente. Para usar Lucía/María académicamente faltan la resolución documentada de los hallazgos anteriores y aprobación de sus revisiones exactas; no se usa el fixture para eludirlos. La siguiente revisión de María debe incorporar la precisión de M5 antes de su auditoría final, sin modificar esta evidencia. Para Lucía, resolver primero el alcance del juicio sobre tratamiento previo y confort, evitando un nuevo ciclo live exploratorio.

En paralelo, aprobar/corregir los descriptores y pesos M6 por caso, y los anclajes M7 de esta tabla con referencias revisadas. Después puede planificarse validación independiente elegible; no se ejecuta automáticamente ni se reciclan los casos de desarrollo como reservado. No se vuelve a pedir aprobar el marco global, los perfiles comunicativos, SEFAC ni la clasificación ya acordada de María.
