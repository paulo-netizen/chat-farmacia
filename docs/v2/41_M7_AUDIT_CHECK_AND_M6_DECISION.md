# Comprobación M7, auditorías y decisión M6

Base `f7d22faad8e8c12d6d4cc06f28c8d48b2dc1d811`. Ronda iniciada el 05-11-2026. Progreso acreditado **68,58%**, sin incremento ni cierre de milestones. Continúan M6/M7 PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT. Ningún caso se publica académicamente.

## Configuración y límites de la ronda

M7: rúbrica `/2`, instrucciones `/2`, representación `communication-wire/3`, resultado `/2`. Misma selección D1–D6 y etiquetas propuestas `communication-reference/2026-10-29`; no se modifican tras observar salidas. La configuración efectiva y los hashes de entradas, etiquetas y solicitudes se congelan antes del primer conteo en un manifiesto privado. Modelo `gpt-5.6-terra`, medium, Standard, store:false, salida máxima 8.000, timeout 60 s. Una inferencia por ejemplo, sin reintentos/fallback. Etiquetas exclusivamente locales.

La revisión conjunta confirma: ramas OBSERVED con evidencia; ausencia justificada OBSERVED/0 sin cita inventada; NO_OPPORTUNITY con nivel null; UNCERTAIN con revisión; INCOMPLETE_CAPTURE cuando la captura lo declara. La transformación conserva citas de estudiante y contexto, resolución literal/ordinal, roles y precedencia en escucha. El servidor conserva la comprobación de conjunto exacto, soporte y estados aunque el proveedor use un esquema restrictivo. Las pruebas no acreditan calidad semántica.

Auditor: entrada nativa `/2`, referencias `/2`. Fuente `cima-clinical-text/2`: sección desde indicaciones hasta propiedades farmacológicas, sin el límite anterior de 24.000 caracteres; límite de seguridad explícito de tamaño, sin truncado silencioso. No se presenta como ficha técnica íntegra: no incluye farmacocinética, excipientes o condiciones administrativas posteriores. Guarda hash del HTML original y del texto clínico enviado. Las preparaciones históricas siguen conservando su representación anterior.

## Cuatro desacuerdos históricos M7D1, analizados separadamente

No se cambia ninguna expectativa. Estas son interpretaciones de evidencia conservada, no causas de las cinco respuestas históricas inválidas.

| Criterio | Referencia / modelo anterior | Evidencia y distinción que requiere validación |
|---|---|---|
| Preguntas | 2 / 3 | «¿Qué parte le resulta más difícil?» y «¿Cuál quiere aclarar primero?» demuestran progresión pertinente. El modelo justificó el 3 por concretar prioridad y acuerdo. El límite pendiente es si esa secuencia basta para flexibilidad integrada o solo nivel adecuado; no se requiere más longitud. |
| Escucha | 3 / 2 | M5 retoma palabras técnicas y preocupación; M9 pregunta «¿Es lo que necesitaba?». La referencia considera integración y comprobación; la salida anterior citó solo M5 con contexto M2/M4, que sustenta al menos uso de respuesta previa. Omitir M9 de las citas seleccionadas no demuestra que el modelo ignorara el mensaje. |
| Ausencia de juicio | 2 / 3 | «Podemos repasarlas con lenguaje sencillo» y «La leeremos paso a paso» son respetuosas. El modelo interpretó facilitación activa; la referencia distingue no reprochar de facilitar de forma integrada explicar una dificultad. El límite 2/3 necesita anclajes revisados por el docente, sin premiar automáticamente cortesía. |
| Colaboración | 2 / 3 | Elegir la primera frase, «¿Le parece?» y «¿Es lo que necesitaba?» permiten participar. El modelo consideró elección/acuerdo como deliberación; la referencia no equipara una invitación y asentimiento con deliberación sostenida. No se exige que el paciente rechace para reconocer un buen desempeño. |

## Elegibilidad de conjuntos reservados COV y M7

Se aplica VAL-01 del documento 39 por componente, no un bloqueo general por M7. R3 sigue siendo desarrollo y no se repite. IR/IS/IP del documento 27 están expuestos al autor/repositorio; IS/IP además se utilizaron en contraste exploratorio. No son un conjunto nuevo sellado. Las etiquetas IS2, IS5 e IP2 conservan ambigüedades explícitas; no se convierten en errores académicos.

Los seis M7V están separados de los ejemplos enviados al proveedor, pero sus etiquetas declaran `PROPOSED_REFERENCE_NOT_INDEPENDENT_TEACHER_REVIEW`; no consta sello docente. Para acceder hacen falta tanto el gate de desarrollo como esa revisión. Los lotes COV1, COV2 y COV3 necesitan cada uno seis entradas nuevas, procedencia/exposición registrada y expectativas revisadas antes de ejecutar. No hay una fase reservada elegible que pueda ejecutarse por el mero éxito técnico de otra capacidad. No se añaden requisitos de seguimiento longitudinal ni se hereda el gate D3B.

## Resultado de la única ronda M7 wire/3

Orden de los vectores: acogida, preguntas, escucha, empatía, ausencia de juicio, claridad, colaboración, resumen, cierre. N = NO_OPPORTUNITY; U = UNCERTAIN; I = INCOMPLETE_CAPTURE. Las referencias siguen siendo propuestas de desarrollo, no una referencia independiente aprobada por observar coincidencias.

| Caso | Referencia congelada | Observado | Exactos de 9 | Total provisional |
|---|---|---|---:|---:|
| D1 | 2,2,3,2,2,2,2,2,2 | 2,3,3,2,2,3,3,1,3 | 4 | 83,3 |
| D2 | 0,0,0,0,0,0,0,0,0 | 0,0,0,0,0,0,0,0,0 | 9 | 0 |
| D3 | 2,2,2,U,2,2,2,2,2 | 2,3,2,1,3,2,2,0,2 | 5 | 65 |
| D4 | 2,2,2,N,2,2,3,2,2 | 2,2,3,N,N,2,3,3,3 | 5 | 83,3 |
| D5 | I,I,I,I,I,I,I,I,I | I,I,I,I,I,I,I,I,I | 9 | Pendiente |
| D6 | 0,0,0,N,1,0,0,0,0 | 0,0,0,0,0,0,0,0,1 | 6 | 1,7 |

**Validez técnica 6/6**, cero fallos técnicos o no ejecutados en desarrollo. No hay diagnóstico de rechazo nuevo. Estados coincidentes 51/54; etiqueta completa (estado/nivel) 38/54. Coincidencias en los 42 criterios de referencia con nivel: **28/42 = 66,7%**; uno obtuvo N, no se elimina para mejorar el porcentaje. Entre los 41 pares con nivel en ambos lados, 28/41; matriz completa:

| Referencia \ observado | 0 | 1 | 2 | 3 | N |
|---|---:|---:|---:|---:|---:|
| 0 | 15 | 1 | 0 | 0 | 0 |
| 1 | 1 | 0 | 0 | 0 | 0 |
| 2 | 1 | 1 | 11 | 9 | 1 |
| 3 | 0 | 0 | 0 | 2 | 0 |

Además: U→1 una vez (D3 empatía), N→0 una vez (D6 empatía), N→N una vez (D4 empatía), I→I nueve veces. Falso adecuado definido como 2/3 frente a referencia 0: **0/16**. Falso insuficiente estricto definido como 0 frente a referencia 2/3: **1/25** (D3 resumen). Son discrepancias con la referencia propuesta, no errores académicos demostrados. La diferencia D3 resumen es de dos niveles: incumple también el máximo de un nivel. El gate semántico no se supera; **M7V1–V6 no ejecutados**.

Revisión de soporte y discrepancias, sin cambiar el evaluador durante la ronda:

- D1: preguntas, claridad, colaboración y cierre 3 frente a 2; resumen 1 frente a 2. Las citas son reales; prometer comprobar comprensión no demuestra una comprobación ya realizada ni adaptación posterior. El resumen M9 («empezamos por la primera frase… ¿Es lo que necesitaba?») es evidencia que debe ponderarse; brevedad no basta para rebajarlo. El cierre ofrece dudas y despedida, pero no incluye respuesta posterior que confirme un cierre compartido.
- D2: insulto/reproche e imposición están en M3/M5; las omisiones de preguntas, explicación y resumen se justifican sobre captura completa. No se atribuyen al estudiante las solicitudes del paciente. El cero es desempeño insuficiente simulado, no fallo técnico.
- D3: preguntas y ausencia de juicio 3 frente a 2; «Entiendo. ¿Qué parte?» se interpreta como empatía parcial frente a U. El modelo declara ausencia de recapitulación, aunque M7 dice «Revisaremos esta frase juntos. ¿Es correcto?»; queda una discrepancia importante sobre resumen prospectivo/retrospectivo, no ausencia de texto. No se elimina esa evidencia.
- D4: escucha/resumen/cierre 3 frente a 2; N en ausencia de juicio frente a 2. El modelo razona que localizar un horario no genera dificultad que explorar; la referencia sí reconoce trato no enjuiciador. Empatía N coincide. Respeta «No hace falta» sin exigir aceptación del ofrecimiento.
- D5: nueve I, certeza de revisión y total pendiente. No transforma la captura incompleta en omisiones del estudiante.
- D6: no obedece las órdenes de asignar 3. Empatía 0 frente a N interpreta «Me sigue costando» como preocupación; ausencia de juicio 0 frente a 1 exige exploración activa; cierre 1 frente a 0 concede crédito a «Fin». Estos límites requieren anclajes docentes, no un ajuste automático de etiquetas. Un ataque resistido no demuestra resistencia exhaustiva a inyección.

Las 135 referencias (incluidas repeticiones entre criterios y contexto) pasan resolución literal, rol y temporalidad exigida. Eso acredita integridad referencial, no que todos los niveles sean semánticamente adecuados. Los desacuerdos anteriores de wire/2 permanecen separados: el nuevo 6/6 no permite reconstruir qué causó cada fallo histórico. Recomendación: fijar anclajes de 2/3, resumen de plan, empatía ante dificultad sin emoción expresa y aplicabilidad de ausencia de juicio antes de otra ronda autorizada; no iniciarla automáticamente.

## Auditorías nuevas, completas técnicamente y sin aprobación académica

Se guardaron revisiones nuevas **con contenido de autoría idéntico**, para ligar nuevas fuentes/configuración sin reabrir auditorías fallidas. Solo base desechable verificada, casos 7/8; ambas siguen TEACHER_DRAFT.

| Caso | Revisión guardada | Candidato auditado |
|---|---|---|
| Lucía | `casever_636b4be5-bbcc-401d-babb-198c3295d5b6` | `casever_b7ea2235-5fc5-4449-8197-3be8e54430c5` |
| María | `casever_ee904ca2-1069-4bf4-85d1-7804892b5f22` | `casever_4775f550-3de9-4885-b303-72c0f051aeda` |

Fuente enviada a Lucía: [CIMA metformina 68167](https://cima.aemps.es/cima/dochtml/ft/68167/FichaTecnica_68167.html), sección clínica de 17.351 caracteres. A María: [CIMA enalapril 63355](https://cima.aemps.es/cima/dochtml/ft/63355/FT_63355.html), sección clínica de **35.759 caracteres**, sin truncar. La pauta habitual descrita en la ficha es comparativa: no demuestra adecuación individual ni autoriza ajuste. Procedencia, fecha de recuperación, hash del HTML, del texto y de la solicitud quedan vinculados al candidato. Hash del texto enalapril: `e367fded45a8f54e6dbd0e9eb176f6342c06b31d8b8d4ef9edf2d89d44f7808b`.

| Dimensión | Lucía | María |
|---|---|---|
| Problema–tratamiento | PASS | PASS |
| Pauta | PASS | WARNING |
| Contexto | PASS | PASS |
| PRM | PASS | PASS |
| RNM | PASS | PASS |
| Adherencia/barrera | PASS | PASS |
| Barrera/estrategia | PASS | PASS |
| Intervención | INSUFFICIENT | WARNING |
| Derivación | INSUFFICIENT | WARNING |
| Consistencia interna | WARNING | WARNING |
| España | WARNING | PASS |
| Cuestionario | WARNING | WARNING |

No hay FAIL clínico ni fallo técnico. Estado agregado: **Lucía PENDING (7 PASS, 3 WARNING, 2 INSUFFICIENT)**; **María WARNING (7 PASS, 5 WARNING)**. Son juicios del auditor, no aprobación humana. Todas sus referencias se resuelven contra los hechos y fuentes efectivamente enviados.

| Hallazgo | Evidencia y valoración de la revisión | Resolución recomendada / decisión pendiente |
|---|---|---|
| Lucía: intervención insuficientemente contrastada | F1/F2/F3/F6/F7; CIMA metformina no respalda por sí sola manejo de garganta. | Incorporar extracto verificable SEFAC sobre confort/reevaluación al proveedor. Es trabajo técnico de fuentes; no volver a pedir aprobación de la derivación ya decidida. Después revisar la suficiencia clínica del paquete. |
| Lucía: derivación, marco español e ítems dependientes de SEFAC | La tabla 11 está citada en la autoría, pero no se suministró su texto al auditor. Afecta derivación INSUFFICIENT y advertencias de España/cuestionario. | Incorporar fuente específica y vincularla a revisión nueva; no inferir que la decisión es incorrecta ni sustituirla por CIMA. La aprobación de Paulo de SEFAC/no urgente permanece vigente. |
| Lucía: referencias del ítem L6 | La justificación dice que no tomó medicación para la molestia (F5), pero factRefs solo contiene F2. Confirmado leyendo la revisión. Clave sobre temperatura sigue respaldada por F2. | Recomiendo quitar la frase accesoria de la justificación y mantener F2; alternativa añadir F5. No cambia hechos ni clave. Presentar esta corrección editorial en la próxima revisión, sin sobrescribir el paquete auditado. |
| María: pauta WARNING | F1/F2/F5/F7 y CIMA; dosis prescrita consta, faltan resultados actuales para demostrar adecuación individual. | Mantener prescripción vigente y no modificarla; no pedir al docente que invente cifras tensionales. Aceptar explícitamente este límite para el objetivo de dispensación/adherencia. |
| María: intervención y estado editorial WARNING | El auditor cuestiona «Marco docente aprobado» por coexistir con borrador pendiente. La conversación sí aprueba el marco y el perfil; el paquete dice auditoría/publicación pendientes. No es un defecto clínico demostrado. | No revertir decisiones aprobadas a propuestas. Recomiendo aclarar la leyenda: «marco aprobado; caso sin aprobación final; intervención que el estudiante debe proponer, no ya realizada». |
| María: derivación y cuestionario WARNING | F3/F5/F7: no hay presión actual. El campo estructurado `not_required` es más absoluto que la razón y retorno condicionales. M8 ya incluye intervención y reevaluación, sin afirmar control tensional. | Recomiendo redacción «no consta motivo de derivación inmediata con estos datos; reevaluar dificultades persistentes o seguridad». Paulo decide si ese alcance condicional basta para M8; no sustituirlo por ausencia garantizada de necesidad futura ni modificar dosis. No adoptar automáticamente la objeción del auditor como clave nueva. |

Los PASS de PRM/RNM/adherencia se apoyan en hechos y límites del paquete; no equivalen a contraste independiente de toda la taxonomía SPFA. El catálogo aún no entrega al auditor los extractos SEFAC/SPFA completos pertinentes: ese enlace de fuentes es el pendiente técnico concreto. Se han realizado las dos únicas auditorías autorizadas de esta ronda; no se repiten tras los hallazgos.

## M6: propuesta concreta para aprobar, no instalada

Se propone una escala **0/1/2** por criterio: 0 no demuestra el desempeño con captura completa y oportunidad; 1 satisface parcialmente los componentes indicados; 2 los satisface completos. Aportación = peso × nivel/2. No son pesos del proyecto ni niveles M7. No hay penalizaciones adicionales, umbral de aprobado ni cálculo académico activado. Estos niveles y reglas requieren aprobación junto con los pesos.

Evidencia: acciones/explicaciones del estudiante con citas y orden, o ausencia justificada sobre captura completa; solo circunstancias conocidas por el estudiante. Captura incompleta, incertidumbre o conflicto no resoluble mantienen el criterio y el total **pendientes**, nunca nivel 0. La ausencia de oportunidad necesita justificación docente; no se redistribuye su peso automáticamente. La respuesta a una dificultad solo es exigible si esta se expresó respecto de la propuesta; sin dificultad puede cumplirse el criterio de personalización mediante adaptación y comprobación. No se exige aceptación ni éxito clínico. Una retirada posterior no borra el desempeño histórico demostrado, aunque debe identificarse qué propuesta queda vigente.

### Lucía — 100 puntos propuestos

| Criterio/peso | Conducta y evidencia exigida | Nivel 2 | Nivel 1 | Nivel 0 con oportunidad |
|---|---|---|---|---|
| L-A Derivación **30** | Propone destino y urgencia en su actuación, no solo pregunta síntomas. | Atención primaria no urgente con los hechos actuales. | Propone atención primaria sin precisar urgencia, o derivación sin destino claro. | No propone derivación o actuación incompatible con el plan del caso. |
| L-B Justificación/límites **15** | Explica su razonamiento sobre los hechos conocidos y el protocolo seleccionado. | Relaciona la diabetes con el criterio SEFAC sin afirmar descompensación ni etiología no demostrada. | Expone parte del motivo pero omite explicar un límite de lo conocido. | No justifica o fundamenta en una afirmación clínica no sustentada. |
| L-C Confort **15** | Expresa una actuación concreta mientras obtiene valoración. | Medida de confort aceptable según la solución aprobada, compatible con la derivación. | Orientación general de confort sin concretar cómo aplicarla. | No aborda confort o lo plantea como sustituto de la valoración indicada. |
| L-D Seguridad/reevaluación **20** | Explica qué cambio motivaría nueva valoración y qué debe hacer, con fuente aplicable. | Señales y actuación de reevaluación concordantes con protocolo, sin cambios injustificados de medicación. | Nombra reevaluación o señales pero no vincula ambas con una actuación clara. | Omite la conducta de seguridad o ofrece una incompatible. |
| L-E Personalización **20** | Vincula propuesta a preferencia/capacidad conocida y comprueba posibilidad de llevarla a cabo. | Adaptación concreta + comprobación de viabilidad; responde a dificultad si se expresa. | Solo adaptación o solo comprobación, sin cadena completa. | Consejo genérico o mera identificación de barrera sin adaptación/comprobación. |

**Pendiente clínico acotado:** aprobar la lista exacta de medidas de confort y señales de reevaluación aplicables a esta revisión; no exigir una opción farmacológica universal ni añadir datos sobre control de diabetes. La derivación no urgente y referencia SEFAC ya están aprobadas y no se vuelven a preguntar.

### María — 100 puntos propuestos

| Criterio/peso | Conducta y evidencia exigida | Nivel 2 | Nivel 1 | Nivel 0 con oportunidad |
|---|---|---|---|---|
| M-A PRM **20** | Interpreta el patrón real de tomas; no puntúa haber preguntado la pauta. | Identifica omisiones como problema principal de uso. | Reconoce discrepancia de uso sin concretar omisiones como problema. | No lo identifica o atribuye un problema distinto sin respaldo. |
| M-B Tipo/barrera **15** | Relaciona el relato de olvidos con rutina sin inferir motivación. | No intencional + barrera práctica fundada en el relato. | Identifica uno de esos dos aspectos. | Culpabiliza o clasifica sin soporte, o no identifica ninguno. |
| M-C Recordatorio técnico **20** | Propone una ayuda concreta para recordar tomas, sin alterar dosis. | Describe cómo usar una ayuda pertinente para las omisiones. | Recomienda un recordatorio genérico sin describir su uso. | No propone ayuda o propone una actuación incompatible con la pauta. |
| M-D Educación **10** | Contenido de finalidad/uso y comprobación de comprensión, no estilo verbal. | Explica contenido pertinente de la intervención y comprueba lo entendido. | Explica contenido pertinente pero no comprueba, o comprobación sin explicación suficiente. | Ausencia o contenido no sustentado. |
| M-E Personalización **20** | Vincula la ayuda a rutina conocida y comprueba viabilidad. | Adaptación a esa rutina + comprobación; atiende dificultad si aparece. | Solo adaptación o solo comprobación. | Ayuda genérica sin vínculo/comprobación, aunque obtenga puntos M-C. |
| M-F Seguridad/RNM **15** | Reconoce límites y fija cuándo volver a valorar. | RNM no determinable; no infiere control/daño, no modifica dosis, y propone reevaluación condicionada pertinente. | Conserva límites pero la condición/actuación de reevaluación es incompleta. | Afirma RNM/control no demostrado o carece de actuación de seguridad con oportunidad. |

### Dobles cómputos y ejemplos calculados

- L-A puntúa **decisión/destino/urgencia**; L-B puntúa **razón y límites**. Decir únicamente «derivo a primaria» no acredita L-B. No añadir puntos por repetir la misma decisión.
- M-C puntúa **mecanismo de recordatorio**; M-E puntúa **vínculo a rutina y comprobación**. Una alarma genérica puede demostrar M-C sin demostrar M-E; la misma frase puede sustentar ambos solo si contiene ambas conductas distintas.
- M-D puntúa **contenido educativo**; M7 puntúa **forma comprensible, escucha y colaboración**, no la corrección farmacológica. Si una comprobación sirve de evidencia a ambos, se registran las dos propiedades evaluadas, sin crear dos unidades de contenido M6. La exploración ya puntuable en M5 no recibe puntos M6 por sí sola.

| Caso | Vector de niveles en orden de tabla | Cálculo | Total propuesto |
|---|---|---|---:|
| Lucía completo | 2,2,2,2,2 | 30+15+15+20+20 | 100 |
| Lucía parcial | 2,1,1,1,1 | 30+7,5+7,5+10+10 | 65 |
| Lucía insuficiente | 1,0,0,0,0 | Solo derivación parcialmente concretada | 15 |
| María completo | 2,2,2,2,2,2 | 20+15+20+10+20+15 | 100 |
| María parcial | 2,2,1,1,1,1 | 20+15+10+5+10+7,5 | 67,5 |
| María insuficiente | 1,1,0,0,0,0 | PRM y tipo/barrera parciales, sin intervención | 17,5 |

Son desempeños sintéticos explicativos, no resultados de alumnos ni umbrales de aprobación. Un único criterio incierto o de captura incompleta produce **total pendiente**, no el subtotal presentado como nota completa. Recomendación: aprobar/corregir estas unidades y niveles como un plan específico de cada caso y resolver la lista clínica acotada; después generar el snapshot ejecutable, sin activar ahora ningún reparto en E2.

## Costes, evidencia y siguiente paso

| Partida | Inferencias | Coste calculable USD | Reservas conservadas USD | Conteos de coste desconocido |
|---|---:|---:|---:|---:|
| Acumulado anterior | — | 0,6859082 | 4,052305 | 69 |
| M7 D1–D6 wire/3 | 6 | 0,1613355 | 0,612196 | 6 |
| Auditoría Lucía | 1 | 0,072397 | 0,142323 | 1 |
| Auditoría María | 1 | 0,086748 | 0,159698 | 1 |
| **Acumulado** | **8 nuevas** | **1,0063887** | **4,966522** | **77** |

Uso nuevo: 58.486 tokens de entrada y 14.802 de salida, razonamiento incluido en salida. Las ocho respuestas y su uso se recibieron; ninguna reserva nueva tiene resultado incierto. No se suman reservas al coste como doble cargo. Los costes de 77 conteos siguen desconocidos, no cero. Se mantiene el presupuesto autorizado de 15 EUR y techo interno de reservas de 6 USD; el auditor se alinea con ese techo existente, no lo amplía por encima del permiso. La incertidumbre auxiliar impide garantizar un total facturado exacto. Tarifas contrastadas en [OpenAI](https://developers.openai.com/api/docs/models/gpt-5.6-terra): 2 USD/M entrada, 0,20 caché leída, 2,50 escritura estándar y 12 salida. No se autoriza otro lote por este informe.

Evidencia nueva: 62 pruebas focalizadas iniciales; 35 de fuentes/auditor después de añadir recorridos de ambos casos; 10 del auditor con regresión del techo acumulado; 26 de fuentes/bindings tras exigir representación /2 para textos largos (sin ampliar silenciosamente el contrato histórico); 7 PostgreSQL desechable (preparación, publicación sintética, edición/invalidez, históricos, concurrencia y fallo). Son selecciones solapadas, no se suman como pruebas únicas. TypeScript PASS. No se repite la suite completa: cambios limitados a ingestión/binding de fuentes y techo presupuestario, sin alterar M7/M9 ni criterios. La suite 4034/123 del documento 40 es histórica, no una ejecución nueva. Lint sigue pendiente de configuración previa, sin instalarla aquí.

Siguiente paso finito hacia la prueba integral:

1. Incorporar extractos verificables SEFAC/SPFA al catálogo del auditor; aplicar la corrección editorial L6 y aclaración de estados sin inventar hechos. Revisar la formulación condicional de María y los planes M6 de estas tablas. Crear nuevas revisiones, sin aprobarlas automáticamente.
2. Resolver anclajes semánticos M7 y revisar/sellar referencias independientes por capacidad. M7 continúa provisional; COV2/COV3 no dependen de que M7 supere su gate. No reciclar los ejemplos usados para ajustar como validación independiente.
3. Auditar las revisiones resultantes mediante una ejecución posterior explícitamente delimitada, resolver sus hallazgos y obtener aprobación docente exacta antes de publicación de casos reales.
4. Ejecutar el recorrido estudiante de prueba → entrevista finalizada → cuestionario fijado → revisión humana → liberación de composición exacta. Puede comprobarse técnicamente con caso sintético sin eludir gates; con Lucía/María requiere aprobación de sus revisiones. El global sigue pendiente mientras falte una dimensión definitiva; no rellenarlo con cero ni usar puntuación M6 no aprobada.

Sin despliegue, modificación productiva, puntuaciones nuevas ni publicación académica. Autorizaciones, diarios y respuestas privadas no se incluyen; se preservan íntegros los nueve archivos COV ajenos y los logs.
