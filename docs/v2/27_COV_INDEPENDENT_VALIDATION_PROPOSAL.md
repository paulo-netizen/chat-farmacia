# COV1–COV3 — candidato y propuesta de validación independiente

12 de octubre de 2026. **Propuesta pendiente de revisión docente; no ejecutada ni aceptada.**

## Comprobación única R3

Base `4fdcbe3bfbe9016eececb6bdb91f4baf29b9f7c2`, rama `chatusal-v2`, árbol inicialmente limpio.
Se ejecutó una inferencia R3 con las instrucciones corregidas ya publicadas, sin modificarlas.
Resultado: **TECHNICAL_FAILURE / INVALID_ADJUDICATION**, diagnóstico `cov-diagnostic/1`, etapa
`VALIDATION`, código **CRITERION_SUPPORT_MISSING**. No hubo reintento ni fallback; ninguno de los
cuatro ejemplos COV3 se volvió a ejecutar. Diarios nuevos, ocho antecedentes enlazados por hash.

| Comprobación | Esperado | Observado validado |
|---|---|---|
| Fidelidad | INSUFFICIENT | No disponible: fallo técnico |
| Inicio | DEMONSTRATED | No disponible: fallo técnico |
| «Presenta sensación de giro.» | UNSUPPORTED, no falsedad | No hay claims validados |
| «Inicio desconocido.» | SUPPORTED | No hay claims validados |

La regla que falló exige, para un criterio DEMONSTRATED o CONTRADICTORY, cita del informe y al
menos una fuente factual disponible (`hasAvailableFact`). El registro conservado no identifica
el criterio ni cuál de las dos condiciones faltó. No inferir que falló precisamente el inicio,
ni reconstruir el contenido descartado. No hay respuesta raw conservada. Las comprobaciones
de cita anteriores al fallo no equivalen a una revisión semántica completa de todo el resultado.
Se conserva como resultado técnico: **0/1 ejemplos válidos**, **0 criterios válidos**; exactitud,
FP/FN y abstenciones semánticas no calculables, no «dos errores académicos».
El ajuste semántico de R3 **no queda verificado**. No se corrige ni se repite en este encargo.

El conteo previo de R3, 2.359 tokens, era de 10-10-2026 07:01:15 UTC, estaba caducado (>24 h) y
su hash no coincidía. Un conteo oficial nuevo: **2.403 tokens**, proyección SHA-256
`4a8a1da5a3eb755b34cff234b29ef3acf177180a952f6071461d117a41d9c7ad`.
Reserva **0.102008 USD** anterior al envío. Uso recibido: input 2.403, output 669, razonamiento
387 incluido en output, cache read 0, cache write 2.400. Uso e identificadores quedan en el diario
privado, sin texto raw ni secretos. Coste calculable **0.014034 USD**.

Acumulado: **19 inferencias**, **0.2006372 USD** calculables y **1.957064 USD** de reservas
retenidas bajo el techo interno de 2 USD. No hay reserva nueva sin respuesta ni resultado de
transporte incierto; la adjudicación recibida es inválida. Se mantienen las reservas históricas.
**42 conteos de coste desconocido** (uno nuevo). No afirmar un total facturado ni tratar conteos
como gratuitos. Presupuesto autorizado acumulado 15 EUR; márgenes de cambio/impuestos previos
conservados, sin prometer un máximo facturado verificable mientras el coste de conteo sea desconocido.
Tarifas contrastadas el 12-10-2026 en [precios oficiales](https://developers.openai.com/api/docs/pricing)
y [modelo](https://developers.openai.com/api/docs/models/gpt-5.6-terra): USD/M input ordinario 2,
cache read 0.20, cache write 2.50, output 12; escritura no aditiva y razonamiento incluido en output.

El runner [r3-check.ts](../../tools/cov-calibration/r3-check.ts) es seco por defecto, cerrado a R3,
con autorización versionada `/1`, reserva fsync, exclusión y recuperación sin reenvío. No acepta
una selección arbitraria ni reabre diarios fallidos. Mantiene parada general ante fallo técnico.
9 pruebas nuevas PASS y 63 regresiones PASS; TypeScript y ambos diff-check PASS. Un defecto del
doble de transporte (baseURL ausente) se corrigió offline antes de llamar; no se relajó el control.
Suite completa anterior reutilizada; no repetida por documentos/datos.

## Candidato congelado y evidencia por versión

El código evaluador y sus dependencias quedan identificados por el commit base completo anterior
y por los hashes de instrucciones efectivas/schema de [CANDIDATE_CONFIG.json](acceptance-candidates/CANDIDATE_CONFIG.json).
Esta entrega solo añade orquestación R3 y documentos; no cambia ningún evaluador, adaptador de
citas, fixture de calibración o instrucciones. Los nuevos ejemplos no se utilizaron para ajustarlos.
Hashes calculados como SHA-256 de JSON.stringify del valor exacto (instrucciones y text.format);
requestHash de calibración es una referencia de trazabilidad, no el hash de entradas nuevas.

| Capacidad | API de dominio (request/adjudication/evaluation) | Instrucciones efectivas / representación proveedor | Evidencia de la configuración candidata |
|---|---|---|---|
| COV1 | referral-report /1 | Base referral-report-instructions/2 más aclaración general report-evidence/2 y citas source-literal/3; referral-report-sources-adjudication/3 | R3 actual falla técnicamente. R2/R-INJECTION favorables y R3 discrepante anteriores usan instrucciones previas; no acreditan esta variante. R1 es todavía anterior. COV1 bloqueado para aceptación hasta diagnóstico offline. |
| COV2 | follow-up-plan /1 | follow-up-plan-instructions/3; follow-up-plan-sources-adjudication/2 | S1, S2, S3-ADOPT y S4-CONFLICT favorables históricos; los hashes de solicitud coinciden exactamente con los actuales. Cuatro criterios, no cobertura exhaustiva de planes complejos. |
| COV3 | personalization /4 | personalization-instructions/5; personalization-canonical-sources-adjudication/5 | Ronda canónica del 11-10: 4/4 válidos, 12/12 etiquetas y soporte revisados. Preparado para validación independiente; no repetir ni sumar versiones anteriores. |

Modelo único `gpt-5.6-terra`; alias, **no snapshot inmutable garantizado**. Medium, Standard/global,
Responses API, `service_tier:default`, `store:false`, máximo 8.000 output, 20.000 bytes de entrada
proyectada, timeout 60 s, sin reintentos/fallback. Structured Outputs con schemas citados, sin
herramientas auxiliares de inferencia. Fijar estas propiedades antes de una futura prueba y registrar
modelo/uso reales; no sustituir silenciosamente un alias o aceptar cambio de proveedor/configuración.
Los límites en bytes no son conteos; cada entrada futura necesitará presupuesto/conteo propio.

Archivos autoritativos: evaluate-referral-report.ts + referral-report-contract.ts;
evaluate-follow-up-plan.ts + follow-up-plan-contract.ts; evaluate-personalization-v4.ts +
cov3-canonical-contract.ts + personalization-contract.ts. Comunes: cov-semantic-runtime.ts,
cov-source-citations.ts, report-citations.ts, cov-diagnostics.ts y constructores de fuentes.
Todos bajo lib/cases/v2 en el commit congelado; recuperar ese árbol, no versiones latest.

## Conjunto propuesto: 18 casos, sin ejecutar

[Entradas completas](acceptance-candidates/COV_18_INPUTS.md) y
[tabla de 18 expectativas, citas y justificaciones](acceptance-candidates/COV_18_LABELS.md).
Seis por capacidad; COV1 dos criterios por caso, COV2 cuatro, COV3 tres: **54 etiquetas propuestas**.
Incluye fuentes, entregas, requisitos versionados, oportunidad/captura y vínculos lógicos independientes.
No son copias de las entradas de calibración: incluyen atribución familiar, rectificación factual,
cuantificación no obtenida, canales de acceso, dos propuestas/dificultades y replanteamiento posterior.
No se ejecutó ninguna ni se obtuvo respuesta del modelo evaluado para redactar sus etiquetas.

Separación: directorio documental propio, entradas y etiquetas en archivos distintos, sin imports
desde lib/tools/tests ni incorporación al prompt. No se generaron adjudicaciones falsas para validar
expectativas. Materialización de IDs/fingerprints y esquema aprobados queda para preparación futura.
Los requisitos pedagógicos generales están aprobados; **estos requisitos específicos y etiquetas no**.

Registro de exposición: el asistente autor ha visto código, instrucciones, calibración histórica y
ambos documentos; se publican en el repositorio y se enlazan en la conversación. Por tanto son
candidatos reservados de ejecución, pero **no un holdout ciego frente al autor ni al repositorio**.
El proveedor evaluado no los ha recibido mediante la API. No afirmar desconocimiento por futuros
agentes/humanos que accedan al repo. Para independencia fuerte, docentes ajenos al ajuste deben
crear/custodiar sustitutos inéditos en un canal separado o completar una batería privada adicional.
Si se usa cualquier caso aquí para modificar el evaluador, reclasificarlo DEVELOPMENT y reemplazarlo.

## Protocolo de aceptación propuesto (requiere aprobación)

1. Dos docentes revisan independientemente requisitos, fuentes, todas las etiquetas y afirmaciones
   COV1, sin salidas del modelo. Adjudican desacuerdos y congelan versión/hash. Resolver especialmente
   IS2 A/C, IS5 C e IP2 D. Excluir casos no consensuados antes del cierre, reemplazándolos y registrando
   el motivo; nunca eliminar un caso porque el evaluador falle después.
2. COV1 no se ejecuta para aceptación hasta resolver offline CRITERION_SUPPORT_MISSING y decidir si
   cambia el candidato. COV2/COV3 pueden avanzar independientemente tras aprobación docente. No
   trasladar automáticamente D3B ni sus gates. Cualquier cambio produce otra versión y nueva declaración
   de exposición; el resultado R3 técnico permanece histórico.
3. Congelar la referencia docente antes de ejecución; expectativas separadas del proveedor. Una salida
   por caso, secuencial, sin selección de mejor respuesta. Modelo/configuración fijados; nueva autorización
   de ejecución y presupuesto del lote independiente, conteos frescos, diario privado y reservas.
   Este encargo no autoriza ni ejecuta esos 18 casos. Ninguna métrica determina notas académicas.
4. Fallos técnicos conservados por caso: validez técnica = casos válidos/6 por capacidad. Separar no
   enviados/6. Nunca convertir un fallo en dos, tres o cuatro errores académicos. Exactitud semántica
   = etiquetas coincidentes/etiquetas de casos válidos: máximo 12 COV1, 24 COV2, 18 COV3.
   Publicar matriz de confusión completa de D/ND/I/C/U/NA con ceros y n, sin mezclar versiones.
5. FP = D observado frente a cualquier etiqueta esperada no D; denominador no D esperado de casos
   válidos. FN decisivo = ND/C/NA observado frente a D esperado; denominador D esperado de casos
   válidos. I y U se cuentan por separado; positivos perdidos en I/U se declaran aparte. Si no hay
   denominador, informar N/A. La propuesta actual contiene D/no-D: COV1 6/6, COV2 13/11, COV3 11/7;
   los denominadores reales solo se fijan tras revisión y validez técnica. C/NA correctos son aciertos,
   no abstenciones. Etiqueta I esperada y observada es acierto, aunque refleje insuficiencia.
6. Revisión humana por criterio: soporte de citas, sujeto, procedencia, oportunidad, temporalidad,
   rectificación, cadena y vigencia. Denominador todas las citas/relaciones emitidas; listar faltantes
   requeridas aparte, sin premiar ausencia de citas. COV1 inventario docente de afirmaciones atómicas
   de cada informe, incluidos extras: cobertura = afirmaciones evaluadas/inventario; comparar status
   y soporte por afirmación, adjudicar fusiones/segmentaciones antes de contar. No bastan spans solapados.
7. Gate pequeño propuesto: **6/6 técnicamente válidos por capacidad; todas las etiquetas del conjunto
   aprobado coincidentes (12/12, 24/24, 18/18); cero FP; cero FN decisivos; cero I/U injustificados**.
   Cero errores de atribución/temporalidad/aplicabilidad y 100% de citas/relaciones exigidas con soporte
   verificado; COV1 cobertura completa del inventario y clasificación correcta de todas las afirmaciones.
   Un desacuerdo no se corrige repitiendo: bloquea el gate de esa capacidad, conserva resultados y se
   estudia aparte. Es una propuesta estricta porque el conjunto es pequeño y dirigido, **no un umbral
   aprobado**, no un peso de nota y no certifica seguridad clínica. Abstenciones correctas sí pasan.

Seis ejemplos no estiman robustamente sensibilidad/especificidad ni generalización. Incluso 6/6 casos
independientes aleatorios sin fallos darían un límite superior unilateral binomial 95% de tasa de fallo
aproximadamente 39%; estos casos dirigidos ni siquiera justifican ese supuesto de muestreo. No tratar
criterios del mismo caso como observaciones independientes ni afirmar resistencia exhaustiva a inyección.
La batería tampoco cubre todas las formas de no aplicabilidad global, entregas fallidas o incertidumbre
interpretativa: tests offline existentes complementan integridad, no sustituyen validación semántica.

Antes de puntos/uso académico: aprobación docente explícita del entregable, más casos inéditos variados
por servicio y contexto, acuerdo entre revisores, análisis de errores críticos, estabilidad en ejecuciones
autorizadas posteriores y aprobación de perfiles/roles, integración, privacidad y retención. Las pruebas
deberán cubrir captura incompleta, oportunidades, multicausalidad y variación lingüística real. No hay
activación automática de scoring, E2, M5, pesos nuevos ni equivalencia con despliegue.

Personalización y seguimiento 0/4; M6 64%, aporte 7.68, proyecto 51.53%; M6/M6-E PARTIAL,
PED2 abierto, perfiles productivos no aprobados, D3B OPEN / VALIDATION DEBT. Sin aceptación final.
