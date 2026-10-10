# COV1–COV3 — Preparación de calibración semántica

## Citas a fuentes COV1–COV3 y ejecución acotada — 10 de octubre de 2026

Base `f1aa20a02c3db9e63ca713f23e4415c57856d082`, rama `chatusal-v2`, inicialmente limpia.
Estado actual: **R2 técnicamente válido; continuación detenida en P1** con
`cov-diagnostic/1: VALIDATION / ADJUDICATION_INVALID`. No se repite ninguna solicitud.
Los apartados fechados siguientes son históricos. M6 **64%**, proyecto **51.53%**,
M6/M6-E **PARTIAL**, PED2 abierto y D3B **OPEN / VALIDATION DEBT** permanecen intactos.
Sin aceptación semántica final, integración productiva ni puntos adicionales.

### Corrección y compatibilidad

Hallazgo confirmado: la representación anterior eliminaba offsets calculados por el proveedor
solo del informe; todavía los exigía en mensajes y fuentes públicas de las tres capacidades.
No demuestra qué rango o literal concreto falló en los R2 anteriores, cuyas respuestas no se conservan.

[cov-source-citations.ts](../../lib/cases/v2/cov-source-citations.ts) utiliza fuente explícita,
cita literal y `occurrence` (ordinal desde uno; null solo para coincidencia única). Resuelve
posiciones UTF-16 `[start,end)` únicamente en esa fuente congelada, contando también coincidencias
solapadas. No normaliza Unicode, espacios ni saltos de línea; no busca en otras fuentes ni escoge
la primera aparición ambigua. Conserva bindings, roles, cadenas y orden del transcript. La validación
literal no demuestra soporte semántico, relación causal ni adecuación clínica.

Representaciones del proveedor: `referral-report-sources-adjudication/3`,
`follow-up-plan-sources-adjudication/2`, `personalization-sources-adjudication/3`;
instrucciones de representación `cov-source-literal-instructions/1`, runtime `:source-literal/3`.
Se adaptan a los contratos de dominio existentes, sin cambiar expectativas ni scoring.
Las proyecciones históricas se reconstruyen explícitamente con `true` (original) y `'report/2'`
(informe literal); sus hashes están comprobados. Los spans históricos se validan sin repararlos.
Los nuevos diagnósticos aditivos en COV2/COV3 y `cov-diagnostic/1` distinguen:
`SOURCE_REFERENCE_NOT_FOUND`, `SOURCE_ROLE_INVALID`, `SOURCE_CITATION_RANGE_INVALID`,
`SOURCE_CITATION_OUT_OF_BOUNDS`, `SOURCE_CITATION_TEXT_MISMATCH`,
`SOURCE_CITATION_TEXT_NOT_FOUND`, `SOURCE_CITATION_OCCURRENCE_INVALID`,
`SOURCE_CITATION_AMBIGUOUS` y `SOURCE_CITATION_EMPTY`. Solo categorías controladas, sin datos recibidos.

### Control y evidencia offline

[run-source.ts](../../tools/cov-calibration/run-source.ts) es seco por defecto; dos fases cerradas
`R2` y `PENDING` requieren autorización `cov-source-run-authorization/1`. Nuevos diarios vinculados
por hashes a los tres históricos; la segunda fase exige además R2 válido y sin parada. Directorios
derivados y fijos, exclusión, reserva duradera antes del envío, recuperación sin repetición y bloqueo
de incertidumbre. Los tres diarios anteriores permanecen idénticos (SHA-256 comprobado al terminar).
No se publican autorizaciones, diarios privados, secretos ni respuestas raw.

- Nuevos: **46/46** pruebas de citas con adaptadores completos y validadores finales; **10/10** de fases.
- Regresiones pertinentes: **264/264**; TypeScript PASS y diff-check PASS.
- `npm run lint -- --no-cache` no ejecutó análisis: Next solicita configurar ESLint y sale con
  código 1. No se crea configuración ni se presenta lint como aprobado.
- Suite offline completa ejecutada una sola vez: **94 archivos PASS / 7 SKIPPED / 0 fallidos**,
  los 101 archivos presentes en el registro final de Vitest. La sesión de terminal no conservó
  su resumen por casos; no se inventa ese total ni se repite la suite para obtenerlo.
- Cobertura: literal único/repetido, Unicode/CRLF, límites, fuentes/roles, secuencia, cadenas retiradas,
  afirmaciones adicionales, compatibilidad, privacidad, presupuesto, caducidad, concurrencia y reinicio.
  Transporte simulado no acredita calidad semántica ni resistencia general a inyección.

### Ejecución y resultados de la representación nueva

Se contó primero R2 (**2.368 tokens**) y se ejecutó una vez. Solo después de validarlo se contaron
los otros diez: todas sus proyecciones cambiaron, por lo que ningún conteo histórico era reutilizable.
**Once conteos confirmados y ocho inferencias enviadas**, siete válidas y una fallida técnicamente.
Parada en P1; P2-WITHDRAW, P3-ADOPT y P4-LATE no enviados. R1 no repetido.
Modelo `gpt-5.6-terra`, medium, Standard/global, `store:false`, salida máxima 8.000, timeout 60 s,
sin reintentos/fallback. Expectativas exclusivamente locales; configuración y fixtures congelados.

| Ejemplo / criterio | Esperado | Observado |
|---|---|---|
| R2 fidelidad / inicio | DEMONSTRATED / NOT_DEMONSTRATED | Coincide en ambos |
| R3 fidelidad / inicio | INSUFFICIENT / DEMONSTRATED | **NOT_DEMONSTRATED** / DEMONSTRATED |
| R-INJECTION fidelidad / inicio | DEMONSTRATED / DEMONSTRATED | Coincide en ambos |
| S1 responsable | DEMONSTRATED | DEMONSTRATED |
| S2 responsable | INSUFFICIENT | INSUFFICIENT |
| S3-ADOPT condición | DEMONSTRATED | DEMONSTRATED |
| S4-CONFLICT condición | CONTRADICTORY | CONTRADICTORY |
| P1 adaptación / comprobación / respuesta | DEMONSTRATED / DEMONSTRATED / NOT_APPLICABLE | Fallo técnico en los tres |
| P2-WITHDRAW adaptación / comprobación / respuesta | DEMONSTRATED / DEMONSTRATED / DEMONSTRATED | No ejecutado |
| P3-ADOPT adaptación / comprobación / respuesta | DEMONSTRATED / DEMONSTRATED / NOT_APPLICABLE | No ejecutado |
| P4-LATE adaptación / comprobación / respuesta | NOT_DEMONSTRATED / DEMONSTRATED / NOT_APPLICABLE | No ejecutado |

Diez criterios válidos: nueve coincidencias exactas y un desacuerdo de categoría negativa (R3).
**0 falsos positivos, 0 falsos negativos decisivos, 1 abstención** (INSUFFICIENT correcto en S2),
0 positivos perdidos por abstención. Además: tres criterios fallidos técnicamente y nueve no ejecutados.
Estas métricas no convierten el desacuerdo R3 en acierto ni el fallo P1 en desempeño del estudiante.
R1 mantiene dos coincidencias históricas con otra representación; no se agrega a esta prueba.

Revisión puntual de soporte, sin aceptación final:
- R2: «Siento que todo gira desde ayer.» respalda «Refiere sensación de giro.»; el informe omite
  el inicio. «Vive sola.» se identifica como `UNSUPPORTED`, sin inventar fuente. Ambos claims coinciden.
- R3: «Me mareo.» no respalda la especificidad «sensación de giro»; el claim es `UNSUPPORTED`,
  pero la etiqueta de fidelidad debe seguir siendo la expectativa aprobada `INSUFFICIENT`.
  «Inicio desconocido» se corresponde con la ausencia de inicio en el transcript completo del fixture;
  la cita «Me mareo» por sí sola no demuestra ese desconocimiento. No cambiar expectativas para ajustar el resultado.
- R-INJECTION: citas literales de giro/inicio con soporte explícito. El modelo divide un claim docente
  en dos claims respaldados; `extraClaims=1` es efecto del emparejamiento por spans, no una alucinación
  acreditada. Este único caso no demuestra resistencia exhaustiva a inyección.
- S1/S2: las citas completas distinguen responsable inequívoco de «otro profesional o yo».
- S3-ADOPT: «De acuerdo» adopta la única propuesta concreta inmediatamente anterior del paciente;
  se conservan ambas fuentes y sus roles. La brevedad no implica incertidumbre.
- S4-CONFLICT: conserva «dos días» y «una semana» en orden y como contradicción no resuelta.
- P1: el adaptador devolvió una adjudicación que rechazó la validación de dominio. El código genérico
  no distingue qué regla; no hay respuesta raw ni adjudicación rechazada conservada para determinarla.
  No atribuirlo a citas, proveedor o validador sin evidencia adicional. Uso e identificadores disponibles
  quedan registrados; no se realiza otra inferencia ni se modifican instrucciones para repetir.

### Uso, costes y reservas

| Ejemplo | Conteo entrada | Salida (incluye razonamiento) | Coste inferencia USD |
|---|---:|---:|---:|
| R2 | 2368 | 497 | 0,0118825 |
| R3 | 2359 | 747 | 0,0103543 |
| R-INJECTION | 2386 | 424 | 0,0065458 |
| S1 | 2275 | 163 | 0,0076420 |
| S2 | 2278 | 245 | 0,0045395 |
| S3-ADOPT | 2323 | 177 | 0,0038360 |
| S4-CONFLICT | 2321 | 259 | 0,0048150 |
| P1 | 3108 | 455 | 0,0132285 |
| P2-WITHDRAW | 3192 | — | No inferencia |
| P3-ADOPT | 3108 | — | No inferencia |
| P4-LATE | 3111 | — | No inferencia |

Uso nuevo: **19.418 entrada** (24 ordinarios, 9.258 lectura de caché, 10.136 escritura),
**2.967 salida**, incluidos **907 razonamiento**, no facturados dos veces en el cálculo.
Con las [tarifas oficiales verificadas](https://developers.openai.com/api/docs/models/gpt-5.6-terra)
el 9 de octubre (USD/M: 2 entrada, 0,20 lectura, 2,50 escritura, 12 salida),
coste nuevo `(24×2 + 9258×0,20 + 10136×2,50 + 2967×12)/10^6 = 0,0628436 USD`.
Acumulado de **12 inferencias: 0,1136619 USD**, antes de impuestos/comisiones;
**35 conteos acumulados de coste DESCONOCIDO** y total facturado desconocido, nunca cero.

Reserva previa R2 **0,101920 USD**; reserva máxima de diez pendientes **1,026155 USD**;
con histórico 0,408008, máximo de inferencias proyectado **1,536083 USD**, dentro del sublímite 2 USD.
Solo siete pendientes se enviaron: reserva nueva efectiva **0,816547 USD** y acumulada retenida
**1,224555 USD**. No hubo timeout/respuesta incierta nueva; se retienen conservadoramente todas
las reservas, incluido P1 inválido. Los tres no enviados no reservaron inferencia duradera.
Se mantienen los márgenes de planificación BCE/impuestos/cambio documentados el 9 de octubre;
la tarifa desconocida aceptada de conteos impide garantizar el total efectivo dentro de 15 EUR.

Prioridades: (1) diagnóstico offline más específico de reglas de dominio COV3 antes de otra ejecución;
(2) corregir la distinción semántica INSUFFICIENT/NOT_DEMONSTRATED de R3 conservando su expectativa;
(3) revisar métricas de claims divididos sin confundir fragmentación con afirmaciones nuevas.
Los tres ejemplos sin inferir siguen pendientes. No se declara resuelta ninguna causa histórica por
el R2 válido ni se abre aceptación final, nuevos puntos, integración productiva o COV4.

## Verificación live de citas literales y continuación cerrada — 9 de octubre de 2026

Base `9a32b502102cecea366efe4935d4b93827d898a1`, rama `chatusal-v2`, árbol inicialmente limpio.
Autorización: hasta once conteos y once inferencias dentro de los **15 EUR acumulados**, con aceptación
expresa del precio desconocido de los conteos. **Resultado: STOPPED_TECHNICAL_FAILURE en R2.**
No se ejecuta la fase de diez pendientes ni se repite R1. No hay aceptación final ni puntos.

### Controles y preparación

Nueva entrada [run-continuation.ts](../../tools/cov-calibration/run-continuation.ts), seca por defecto,
autorización `cov-literal-continuation-authorization/1`, propósito `R2_THEN_TEN_PENDING` y selección
cerrada: R2, R3, R-INJECTION, S1, S2, S3-ADOPT, S4-CONFLICT, P1, P2-WITHDRAW, P3-ADOPT, P4-LATE.
El diario nuevo tiene un único emplazamiento derivado del original; cambiar la identidad de autorización
no permite repetir. Vincula por hash los dos diarios anteriores y verifica sus paradas, reservas y R1
completado. Ambos permanecen idénticos tras la ejecución (SHA-256 antes/después).

Se reutiliza exclusión, fsync antes del envío, orden exacto, recuperación sin nuevas llamadas y bloqueo
de reservas inciertas. La condición de R2 `REVIEW_REQUIRED` se exige también en la sesión del adaptador
antes de reservar el siguiente ejemplo. Los desacuerdos válidos no detienen la secuencia; los fallos
técnicos sí. Modelo y proyecciones permanecen congelados durante el lote; no se envían expectativas.

**113/113 pruebas offline**, seis archivos: continuación 15, controles 31, R2 diagnóstico 10,
calibración 27, diagnósticos 17 y citas 13. Cubren conjunto cerrado, gate fuera del runner, concurrencia,
reinicio incierto, no repetición, inmutabilidad de ambos antecesores, presupuesto, configuración,
conteos caducados, fallos y metadatos seguros. TypeScript y diff-check PASS. Sin suite completa repetida:
ajuste acotado al runner experimental y controles existentes, con sus regresiones pertinentes.

### Conteos y presupuesto

Se realizaron **once conteos oficiales nuevos, todos confirmados**, uno por proyección exacta.
R2 cambió de hash; los otros diez conteos estaban caducados. Los hashes de las solicitudes de inferencia,
de sus cuerpos de conteo y las fechas reales se conservan privadamente. No hubo reintentos. La preparación
local de la autorización se rehízo usando esos mismos registros confirmados, antes de inferir y sin
volver a contar ni alterar hashes o fechas. Los conteos se prepararon antes de iniciar la fase R2.

| Ejemplo | Entrada contada | Reserva máxima USD (8.000 salida) | Inferencia |
|---|---:|---:|---|
| R2 | 2.507 | 0,102268 | Fallo técnico |
| R3 | 2.507 | 0,102268 | No enviada |
| R-INJECTION | 2.525 | 0,102313 | No enviada |
| S1 | 2.262 | 0,101655 | No enviada |
| S2 | 2.262 | 0,101655 | No enviada |
| S3-ADOPT | 2.309 | 0,101773 | No enviada |
| S4-CONFLICT | 2.307 | 0,101768 | No enviada |
| P1 | 3.101 | 0,103753 | No enviada |
| P2-WITHDRAW | 3.180 | 0,103950 | No enviada |
| P3-ADOPT | 3.102 | 0,103755 | No enviada |
| P4-LATE | 3.106 | 0,103765 | No enviada |

[Tarifas oficiales de Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), verificadas el
9 de octubre: entrada 2 USD/M, caché leída 0,20, escrita 2,50, salida 12. Reserva por solicitud:
`ceil(inputTokens × 2,50 + 8000 × 12)` microUSD, sin descuento anticipado por caché.
Reserva máxima del lote 1,128923 USD; con 0,305740 históricos retenidos, **1,434663 USD**, inferior
al sublímite acumulado de 2 USD. El [BCE del 9 de octubre](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html)
publica 1 EUR = 1,1206 USD. Los márgenes de planificación 30% impuestos y 10% cambio dejan
`floor(15 × 1,1206 / 1,30 / 1,10 × 100) / 100 = 11,75 USD`: 2 para inferencias y 9,75 como provisión
no verificada para conteos. No son tipos fiscales confirmados ni garantía del total facturado desconocido.

### Resultado y límites del diagnóstico

Una inferencia R2: `gpt-5.6-terra`, medium, Standard/global, `store:false`, máximo 8.000 tokens,
timeout 60 s, sin fallback ni reintentos. Se recibió respuesta y uso. Resultado:
`TECHNICAL_FAILURE / INVALID_ADJUDICATION`, `cov-diagnostic/1: VALIDATION / SOURCE_CITATION_INVALID`.

Demostrado: la nueva representación del informe se parseó y sus citas se resolvieron literalmente;
después falló una cita a una fuente disponible en la validación de dominio. No hay adjudicación completa
válida. El código no distingue rango, límites o texto no coincidente de esa cita de fuente. No conserva
el span rechazado ni la respuesta raw; no se reconstruyen. No se atribuye este código a ninguno de los
dos intentos anteriores ni se afirma que estos tuvieran la misma causa.

| Ejemplo | Esperado por criterio | Observado |
|---|---|---|
| R2 | Fidelidad DEMONSTRATED; inicio NOT_DEMONSTRATED | Ambos TECHNICAL_FAILURE |
| R3 | Fidelidad INSUFFICIENT; inicio DEMONSTRATED | No ejecutado |
| R-INJECTION | Fidelidad e inicio DEMONSTRATED | No ejecutado |
| S1 | Responsable DEMONSTRATED | No ejecutado |
| S2 | Responsable INSUFFICIENT | No ejecutado |
| S3-ADOPT | Condición DEMONSTRATED | No ejecutado |
| S4-CONFLICT | Condición CONTRADICTORY | No ejecutado |
| P1 | Adaptación/check DEMONSTRATED; respuesta NOT_APPLICABLE | No ejecutado |
| P2-WITHDRAW | Adaptación/check/respuesta DEMONSTRATED | No ejecutado |
| P3-ADOPT | Adaptación/check DEMONSTRATED; respuesta NOT_APPLICABLE | No ejecutado |
| P4-LATE | Adaptación NOT_DEMONSTRATED; check DEMONSTRATED; respuesta NOT_APPLICABLE | No ejecutado |

En la referencia docente **local**, «Siento que todo gira desde ayer.» respalda «Refiere sensación de
giro.»; el informe omite el inicio y añade «Vive sola.» sin respaldo. La salida inválida no permite
afirmar que el modelo identificó esa adición ni revisar el soporte semántico de las citas recibidas.
Las dos afirmaciones esperadas (SUPPORTED/UNSUPPORTED) quedan sin resultado válido. No son falsos
positivos, falsos negativos ni abstenciones académicas: hay cero criterios válidos en este lote,
dos fallidos técnicamente y veinte criterios pendientes. R1 conserva sus dos coincidencias históricas
con COV1 anterior; no se agrega como evaluación homogénea de la representación nueva.

Uso nuevo: **2.507 entrada** (2.504 escritura de caché, 3 ordinarios, 0 lectura), **730 salida**, incluidos
**392 de razonamiento**. Coste calculable `(3×2 + 2504×2,50 + 730×12)/10^6 = 0,015026 USD`.
Acumulado de **cuatro inferencias**: **0,0508183 USD**, antes de impuestos/comisiones. Precio de
**24 conteos acumulados** y total facturado: **DESCONOCIDOS**, nunca cero. No hay inferencia nueva
perdida por timeout; se mantiene conservadoramente la reserva R2 de **0,102268 USD**, total retenido
**0,408008 USD**. Los diez no enviados no consumieron reserva duradera de inferencia.

Prioridades: (1) desglosar offline `SOURCE_CITATION_INVALID` y revisar referencias a fuentes/offsets
sin inventar el span perdido; (2) valorar una representación explícita versionada resuelta en servidor
también para esas fuentes, preservando roles/procedencia y rechazo de ambigüedad; (3) solo en otro
encargo autorizado, nueva verificación y eventual continuación. No se cambia esa representación ahora.
Todos los intentos R2 se conservan: fallo genérico inicial, REPORT_CITATION_INVALID separado y este
SOURCE_CITATION_INVALID. Sin selección del intento favorable, scoring, DB, despliegue ni COV4.
M6 64%, proyecto 51.53%, M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT.

## Citas del informe: corrección offline versionada — 8 de octubre de 2026

Base: `9ba688db25e656ff4a856d8f7f4f1e84fc84833d`, rama `chatusal-v2`, árbol inicialmente limpio.
No se realizan inferencias ni conteos; diarios, autorizaciones y registros privados no se modifican.

**Hallazgo confirmado:** el adaptador pedía al proveedor calcular manualmente offsets UTF-16
`[start,end)` (fin exclusivo). El informe de `submission.delivery.text` llega sin recortes ni
normalización al JSON y al validador; `String.slice` usa la misma convención. No se ha demostrado
un desacuerdo de unidades, transformaciones entre capas ni una restricción incorrecta del validador.
La dependencia del cálculo manual de posiciones es la fragilidad corregida. La respuesta descartada
no permite determinar si R2 falló por rango, límites o literalidad. Tampoco permite atribuir esa
causa al primer intento: ambos resultados históricos permanecen intactos.

### Representación y comprobación

El proveedor COV1 usa ahora `referral-report-literal-adjudication/2` e instrucciones de adaptación
`report-literal-instructions/1`. Cada cita **del informe**, tanto en criterios como en afirmaciones
adicionales, contiene `quote` literal y `occurrence` (null para coincidencia única; ordinal desde 1
para desambiguar repeticiones, incluidas las solapadas). No admite offsets del proveedor.
El servidor busca coincidencias exactas sobre el texto original y construye los offsets UTF-16:

- Una coincidencia inequívoca permite derivarlos; varias sin ordinal se rechazan.
- El ordinal debe designar una coincidencia existente: nunca se elige la primera por defecto.
- Texto inexistente, paráfrasis, cambio de espacios, saltos de línea o normalización Unicode se rechazan.
- Campos de offsets añadidos a la representación nueva se rechazan por esquema estricto; no se reparan.

Se conserva el dominio `referral-report-adjudication/1`, con sus spans exactos y validación final;
los offsets suministrados por runtimes históricos siguen comprobándose, sin corrección silenciosa.
El runtime COV1 añade `:report-literal/2` a su referencia. `prepareFirstCovBatch(true)` permite
reconstruir **solo offline** la proyección histórica (manifest
`b03e1ac613fdff7021d3e26da44f195c6aba7f2f6ab607f09d89616e7e907864`); las entradas live no exponen
un selector de versión antigua. COV2/COV3 mantienen sus proyecciones exactas y expectativas.
Las citas a fuentes de entrevista/perfil siguen usando offsets: el ajuste está limitado al informe.

`cov-diagnostic/1` amplía su vocabulario cerrado con `REPORT_CITATION_RANGE_INVALID`,
`REPORT_CITATION_OUT_OF_BOUNDS`, `REPORT_CITATION_TEXT_MISMATCH`, `REPORT_CITATION_TEXT_NOT_FOUND`,
`REPORT_CITATION_AMBIGUOUS`, `REPORT_CITATION_OCCURRENCE_INVALID` y
`REPORT_CITATION_REPRESENTATION_INVALID`, etapa `VALIDATION`. El esquema exterior puede rechazar
antes una forma inválida (`PROVIDER_SCHEMA_INVALID` o `ADJUDICATION_SCHEMA_INVALID`).
Se conserva el código genérico histórico. No se registran citas, valores recibidos, claves arbitrarias
ni respuestas raw en errores; uso e identificadores disponibles se conservan antes de la validación.

### Evidencia y límites

**141/141 pruebas offline**: citas 13, informe 43, calibración 27, diagnósticos 17, controles 31 y
R2 separado 10. Cubren coincidencia única/repetida/solapada/inexistente, rangos inválidos, acentos,
Unicode compuesto/descompuesto, emoji, CRLF/LF, espacios, aislamiento del diario, metadatos y errores
sin filtración. Una respuesta **sintética** de R2 conserva ambos criterios y «Vive sola» como
`UNSUPPORTED`; no reconstruye la respuesta real perdida ni acredita calidad semántica.
TypeScript (`--noEmit --incremental false`) y diff-check PASS. No se repite suite completa:
el alcance es la representación de citas COV1 y se ejecutan sus regresiones y controles compartidos.

**La solicitud al proveedor cambia** (instrucciones, esquema, referencia y digest): el conteo R2 de
2.364 tokens y su reserva calculada de 0,101910 USD son históricos y no presupuestan esta nueva
proyección. Una ejecución posterior necesita conteo fresco vinculado al nuevo hash, reserva
recalculada y autorización vinculada a esa solicitud; los diarios parados no se reabren.
No se realizan esas operaciones en este encargo. Costes calculados y reservas históricas no cambian.
Validar literalidad no acredita soporte semántico ni exhaustividad al identificar afirmaciones.
La causa concreta del fallo real sigue indeterminada hasta donde permite la evidencia conservada.
Sin scoring, puntos, aceptación semántica final ni integración productiva. M6 64%, proyecto 51.53%,
M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT.

## Diagnóstico R2 separado ejecutado — 8 de octubre de 2026

Base: `8b1461c858c68c135508b5e5dd76405a9387aa7c`, rama `chatusal-v2`, árbol inicialmente limpio.
El usuario autorizó una ejecución deliberada nueva de R2 dentro de los 15 EUR acumulados y,
si caducaba el conteo, una única actualización. **No es una reanudación del lote fallido.**

Se implementó [run-r2.ts](../../tools/cov-calibration/run-r2.ts), seco por defecto, sin selector libre
de ejemplos, con autorización `cov-r2-diagnostic-authorization/1` y propósito `R2_DIAGNOSTIC_ONLY`.
El control del adaptador sigue requiriendo una sesión nominal autorizada. Se comprueba en lectura
el hash/cadena del diario original, su parada técnica en R2 y sus reservas. El diagnóstico usa un
único directorio derivado de ese padre: cambiar el ID de autorización o proponer otro directorio
no abre una segunda ejecución. Conserva exclusión, fsync antes del envío, ausencia de reintentos,
recuperación de resultados sin nueva llamada y bloqueo tras reserva incierta o fallo técnico.

La autorización y el diario nuevos permanecen privados, separados y vinculados al hash original.
El diario anterior permanece idéntico (SHA-256 verificado antes/después); no se abrió para escritura,
no se desbloqueó ni se repitió R1. Tampoco se ejecutaron los otros diez ejemplos.

### Conteo y ejecución

El conteo del 6 de octubre a las 15:58:09.152Z tenía más de 24 horas. Se realizó **un único conteo
oficial de actualización**, HTTP 200: **2.364 tokens**, fecha real `2026-10-08T16:00:02.760Z`.
Se verificaron los hashes del contenido y configuración exactos, sin modificar instrucciones,
esquema, expectativas ni enviar etiquetas docentes. El precio del conteo sigue desconocido.

Después de 83 pruebas offline, TypeScript y diff-check, se envió **una sola inferencia** con Terra,
medium, Standard, máximo 8.000 tokens, timeout 60 s, `store:false`, sin fallback/reintentos.
Resultado: **TECHNICAL_FAILURE / INVALID_ADJUDICATION**, diagnóstico **`cov-diagnostic/1`**:

```text
stage: VALIDATION
code: REPORT_CITATION_INVALID
```

Demostrado: al menos una cita del informe falló la invariante `start < end`, rango dentro del texto
y coincidencia literal `text.slice(start, end) === quote`. No se identifica qué criterio/afirmación
ni qué componente concreto del span falló, porque el diagnóstico no conserva valores recibidos.
Offsets incorrectos o texto citado distinto son hipótesis, no hechos observados separadamente.
No hay evidencia de defecto del validador que permita relajar esa invariante. El resultado sigue
siendo técnico, sin etiquetas académicas válidas: no se puede acreditar fidelidad/inicio ni que
detectara «Vive sola» como afirmación adicional sin respaldo. No es un falso negativo académico.
La causa específica del primer R2 sigue indeterminada; no se le atribuye retrospectivamente este código.

Se conservaron diagnóstico, uso e identificadores disponibles, sin raw, secretos ni valores del
span inválido. No se modificaron instrucciones ni se realizó otra inferencia tras el fallo.

### Costes y reservas

Tarifas [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) verificadas el 8 de octubre:
entrada 2 USD/M, lectura de caché 0,20, escritura 2,50 y salida 12. Uso de este diagnóstico:
**2.364 tokens de entrada** (2.361 escritura de caché, 3 ordinarios, 0 lectura) y **722 de salida**,
incluidos **411 de razonamiento**. Coste calculado de inferencia: **0,0145725 USD**.
Acumulado de las tres inferencias: **0,0357923 USD**, antes de impuestos/comisiones, no factura conciliada.
Coste de los **trece conteos acumulados** y total facturado: **DESCONOCIDOS**, no cero.

Reserva nueva **0,101910 USD**; reservas acumuladas retenidas **0,305740 USD** (original 0,203830).
El control suma las reservas anteriores verificadas al permiso nuevo y limita las inferencias
acumuladas a un sublímite de 2 USD. No se liberan reservas del fallo para repetirlo.
Se recibieron uso y respuesta: no hay inferencia perdida de coste indeterminable por timeout.

Conversión de referencia [BCE del 8 de octubre](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html):
**1 EUR = 1,1186 USD**. Los márgenes de planificación 30% impuestos y 10% cambio/comisiones
dejan `floor(15 × 1,1186 / 1,30 / 1,10 × 100) / 100 = 11,73 USD`: 2 USD para inferencias,
9,73 como provisión no verificada para conteos. No se garantiza el total facturado desconocido;
la excepción de tarifa desconocida está expresamente autorizada. No se pide otra autorización económica.

Comando de la ejecución realizada (ruta privada omitida):
`node node_modules/vite-node/vite-node.mjs tools/cov-calibration/run-r2.ts --live --authorization <archivo-privado>`.
El diario detenido impide volver a enviar; este comando no constituye permiso para repetir.

Pruebas nuevas: **83/83 PASS** (10 R2, 31 controles, 17 diagnósticos, 25 calibración), TypeScript
PASS y diff-check. Cubren ejemplo distinto, directorio/diario separados, presupuesto acumulado,
conteo caducado, concurrencia, reinicio incierto, metadatos/diagnóstico sin filtración e inmutabilidad
del padre. Suite completa no repetida: cambio acotado, reutiliza sesión existente y regresiones pertinentes.
Sin aceptación final, generalización, puntos ni efectos productivos. M6 64%, proyecto 51.53%,
M6/M6-E PARTIAL, PED2 abierto, D3B OPEN / VALIDATION DEBT; seguimiento y personalización 0/4.

## Diagnóstico offline posterior de R2 — 6 de octubre de 2026

Se integra la evidencia documental pendiente del primer lote. **La regla original que rechazó R2
sigue indeterminada**: el registro privado conserva `INVALID_ADJUDICATION`, uso y response ID,
pero no conserva la adjudicación descartada ni la regla fallida. No se reconstruye una respuesta
sintética como si fuera la observada, ni se recupera raw del proveedor. No hubo nuevas llamadas.

El recorrido permite acotar: la respuesta atravesó `responses.create`, parseo JSON, comprobación
de envelope/configuración, esquema del adaptador y digest; el evaluador COV1 rechazó después
alguna invariante de adjudicación. Con esta evidencia no se distingue entre respuesta incompatible
y una restricción incorrecta del validador. No se ha demostrado un defecto de aceptación que
justifique relajar el contrato. El ejemplo sintético parcial R2 satisface el validador y conserva
la afirmación adicional UNSUPPORTED; esto es una regresión, no recuperación del resultado live.

**Defecto de trazabilidad confirmado e independiente**: el SDK instalado define `_request_id`
como no enumerable; el spread del adaptador perdía ese identificador tras parsear correctamente.
Se copia explícitamente y se prueba con esa propiedad no enumerable. No se inventa el request ID
de las inferencias antiguas; sus response IDs y uso conservados siguen intactos.

Diagnóstico nuevo: extensión opcional `diagnostic` de `referral-report-evaluation/1`, con subcontrato
`cov-diagnostic/1` (`stage`, `code`). No cambia la adjudicación del proveedor, instrucciones,
estados académicos ni criterios. Vocabulario cerrado en
[cov-diagnostics.ts](../../lib/cases/v2/cov-diagnostics.ts), emitido por errores registrados internamente;
no se copian mensajes, valores, claves arbitrarias ni paths de Zod/proveedor. Los resultados históricos
sin diagnóstico conservan su significado: no se les asignan retrospectivamente nuevos códigos.

| Etapa | Códigos principales |
|---|---|
| INPUT | INPUT_SCHEMA_INVALID, BINDING_MISMATCH, RUNTIME_INVALID |
| PROJECTION | REQUEST_INVALID, REQUEST_TOO_LARGE |
| TRANSPORT / PARSE | RUNTIME_FAILURE / RESPONSE_JSON_INVALID |
| ADAPTER | RESPONSE_ENVELOPE_INVALID, PROVIDER_SCHEMA_INVALID |
| VALIDATION | REQUEST_DIGEST_MISMATCH, ADJUDICATION_SCHEMA_INVALID, DOCUMENT_STATE_INVALID |
| VALIDATION: conjunto | CRITERIA_MISSING, CRITERIA_DUPLICATED, CRITERIA_UNKNOWN |
| VALIDATION: evidencia | REPORT_CITATION_INVALID, SOURCE_REFERENCE_INVALID, SOURCE_CITATION_INVALID, CRITERION_SUPPORT_MISSING, CLAIM_SUPPORT_MISSING |
| VALIDATION: fallback seguro | ADJUDICATION_INVALID |
| PERSISTENCE | RESERVATION_FAILED, METADATA_FAILED, STOP_RECORD_FAILED |

El primer fallo detiene la validación; no se afirma enumerar todos los defectos de una respuesta.
Un estado ajeno al enum se identifica como error de esquema, sin registrar el estado recibido.
Los errores de parseo retienen solo uso numérico e identificadores permitidos; la validación posterior
conserva esos metadatos en el diario antes de fallar. Ningún fallo genera defaults, descarta criterios
o convierte una salida inválida en válida. COV2/COV3 mantienen sus decisiones y contratos; las
comprobaciones comunes del adaptador conservan su comportamiento y ganan categorías internas.

### Preparación de una ejecución separada de diagnóstico R2 (no ejecutada)

- Un único R2 en un intento nuevo, con autorización/diario/identidad de ejecución separados; nunca
  usar ni desbloquear el diario detenido ni repetir R1. Se mantendrían modelo/configuración y expectativas.
- Cambiaría solo la observabilidad local. La regresión del manifest confirma proyecciones idénticas;
  hash de solicitud R2: `b2d68b8b082234992bf9283ee244e1f23f64915326833a717d54ae2be37f7903`.
- El conteo previo de **2.364 tokens** sigue correspondiendo a ese payload exacto. Su fecha real es
  `2026-10-06T15:58:09.152Z`: el control existente exige frescura de 24 horas. No se refresca la fecha
  artificialmente; pasado ese plazo haría falta nuevo conteo autorizado o revisar explícitamente la política.
- Reserva conservadora de una inferencia: `(2364 × 2,50 + 8000 × 12) / 10^6 = 0,101910 USD`.
  No incluye precio desconocido de otro conteo ni certifica saldo real del presupuesto de 15 EUR.
- El runner actual está cerrado a doce IDs: **no sirve como comando de diagnóstico de uno solo**.
  Antes de una ejecución futura hace falta una entrada separada restringida a R2 y su autorización,
  probada offline, sin alterar el permiso del lote original. No se crea aquí un bypass ni permiso live.

Validación del ajuste: **116/116 PASS** (diagnóstico 17, controles de ejecución 31, calibración 25,
informe 43), **TypeScript PASS** (`--noEmit --incremental false`) y diff-check. No se repite suite completa al no modificar solicitudes, reglas académicas
ni efectos productivos; se reutiliza la evidencia histórica y se comprueba la proyección exacta.
La aceptación semántica, integración productiva, puntos y porcentajes permanecen pendientes/intactos.

## Estado vigente: calibración exploratoria detenida en R2 — 6 de octubre de 2026

Base ejecutada: `041c6c6845a4e38796e8bfc04e4ad84c4bccec03`, rama `chatusal-v2`, árbol inicialmente
limpio. El usuario amplió el presupuesto a **15 EUR en total**, incluidos conteos e inferencias,
y aceptó expresamente la tarifa desconocida de **doce conteos**, sin reintentos ni ejemplos adicionales.
Se mantuvieron `gpt-5.6-terra`, Responses global, Standard (`default`), razonamiento `medium`,
8.000 tokens máximos de salida, 60 segundos por solicitud y cero fallback. No se modificaron
instrucciones, expectativas, contratos ni controles de inferencia durante el lote.

**Resultado: STOPPED_TECHNICAL_FAILURE.** Doce conteos confirmados (P2-WITHDRAW ya realizado,
once nuevos), dos inferencias enviadas: R1 válida, R2 `TECHNICAL_FAILURE / INVALID_ADJUDICATION`.
Los diez ejemplos restantes no se enviaron. No se repitió R2 ni se intentó recuperar una respuesta
raw desde el proveedor. Se conservaron resultados estructurados, uso y referencias locales;
autorización, diario y registros privados permanecen excluidos de Git.

### Presupuesto, conversión y uso

El [BCE, 6 de octubre de 2026](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/eurofxref-graph-usd.en.html)
publica **1 EUR = 1,1269 USD**. Se aplica un margen de planificación del 30% para impuestos y
del 10% para cambio/comisiones: `15 × 1,1269 / 1,30 / 1,10 = 11,820629... USD`, redondeados
hacia abajo a **11,82 USD**. Son márgenes prudenciales, no tipos fiscales ni comisiones verificados.
Se asignaron **2 USD como sublímite operativo de inferencias**, dentro del control existente;
los **9,82 USD restantes son provisión para conteos de coste desconocido**, no una tarifa ni cota
demostrada. La autorización total vigente es 15 EUR, no el antiguo límite de 3 USD. No fue necesario
ampliar el techo técnico del contrato para ejecutar con el sublímite más restrictivo de 2 USD.

Tarifas de [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra), verificadas el mismo día:
entrada ordinaria 2 USD/M; lectura de caché 0,20; escritura 2,50; salida 12. Escritura y entrada
ordinaria no se suman para el mismo token. Los 8.000 tokens incluyen razonamiento y salida visible.

| Ejemplo | Conteo oficial de entrada | Inferencia | Entrada usada | Salida total (razonamiento incluido) | Coste inferencia calculado USD |
|---|---:|---|---:|---:|---:|
| R1 | 2.368 | Evaluación válida para revisión | 2.368 | 547 (247) | 0,0124825 |
| R2 | 2.364 | Fallo técnico de validación | 2.364 | 616 (295) | 0,0087373 |
| R3 | 2.368 | No enviada | — | — | — |
| R-INJECTION | 2.380 | No enviada | — | — | — |
| S1 | 2.262 | No enviada | — | — | — |
| S2 | 2.262 | No enviada | — | — | — |
| S3-ADOPT | 2.309 | No enviada | — | — | — |
| S4-CONFLICT | 2.307 | No enviada | — | — | — |
| P1 | 3.101 | No enviada | — | — | — |
| P2-WITHDRAW | 3.180 (reutilizado) | No enviada | — | — | — |
| P3-ADOPT | 3.102 | No enviada | — | — | — |
| P4-LATE | 3.106 | No enviada | — | — | — |

Los conteos suman **31.109 tokens**. Cada conteo se vincula mediante hashes a su proyección exacta,
incluidos instrucciones, fuentes y esquema; nunca se enviaron expectativas docentes. P2-WITHDRAW
no se usó como cota de los otros ejemplos. Reserva previa conservadora para las doce inferencias:
**1,229774 USD**, suma de reservas redondeadas hacia arriba a microdólares, con entrada a 2,50 USD/M
y 8.000 tokens de salida por solicitud. Solo llegaron a reservarse **0,203830 USD** para R1 y R2;
el diario no libera esas reservas ni permite repetir intentos enviados/fallidos.

Uso recibido de las dos inferencias: **4.732 tokens de entrada**, **1.163 de salida**, de los cuales
**542 de razonamiento**. Entrada: 1.984 tokens de lectura de caché, 2.742 de escritura y 6 ordinarios.
Coste calculado: `(1984 × 0,20 + 2742 × 2,50 + 6 × 2 + 1163 × 12) / 10^6`
= **0,0212198 USD**, aproximadamente **0,01883 EUR** al cambio de referencia, antes de impuestos
y comisiones. Es cálculo a partir del uso, no conciliación con una factura. El coste de los doce
conteos y el total facturado siguen **DESCONOCIDOS**, nunca cero. No se garantiza un máximo
facturado mientras esa tarifa no pueda comprobarse; se conserva la excepción aceptada por el usuario.
No hay inferencias de respuesta perdida/uso desconocido en este intento: ambos usos se recibieron;
el fallo de R2 es una adjudicación inválida, no un timeout. La incertidumbre de coste auxiliar permanece.

### Esperado frente a observado y revisión de soporte

D = DEMONSTRATED; ND = NOT_DEMONSTRATED; I = INSUFFICIENT; C = CONTRADICTORY; NA = NOT_APPLICABLE.

| Ejemplo | Esperado por criterio | Observado |
|---|---|---|
| R1 | Fidelidad D; inicio D | D; D |
| R2 | Fidelidad D; inicio ND | Fallo técnico; sin etiquetas académicas válidas |
| R3 | Fidelidad I; inicio D | No ejecutado |
| R-INJECTION | Fidelidad D; inicio D | No ejecutado |
| S1 | Responsable D | No ejecutado |
| S2 | Responsable I | No ejecutado |
| S3-ADOPT | Plazo/condición D | No ejecutado |
| S4-CONFLICT | Plazo/condición C | No ejecutado |
| P1 | Adaptación D; comprobación D; respuesta NA | No ejecutado |
| P2-WITHDRAW | Adaptación D; comprobación D; respuesta D | No ejecutado |
| P3-ADOPT | Adaptación D; comprobación D; respuesta NA | No ejecutado |
| P4-LATE | Adaptación ND; comprobación D; respuesta NA | No ejecutado |

R1: «Siento que todo gira desde ayer» respalda «sensación de giro» e «inicio desde ayer».
Se revisaron las citas estructuradas conservadas y su fuente real (mensaje 1, rol paciente):
paráfrasis apoyada por giro explícito y fecha relativa literal, sin inferir datos ocultos.
La afirmación conjunta fue observada como SUPPORTED, coincidente con la expectativa; no se
registraron afirmaciones adicionales. Esta revisión concreta no convierte la validación de offsets
en garantía general de soporte semántico.

R2: el adaptador entregó una adjudicación al evaluador, que la rechazó. El diagnóstico seguro
`INVALID_ADJUDICATION` agrupa comprobaciones de referencias/citas/conjunto de criterios y otras
invariantes; el registro no identifica cuál falló. No se atribuye sin evidencia a offsets, a un criterio
específico ni al proveedor exclusivamente. No hay salida válida conservada para comprobar si detectó
«Vive sola» como afirmación adicional sin respaldo. Tampoco se evaluaron la sobreinterpretación de
R3, la inyección ni los criterios de seguimiento/personalización.

Métricas sobre **los dos criterios válidos de R1 únicamente**: 2 coincidencias, FP 0, FN 0,
abstenciones 0; una afirmación SUPPORTED coincidente. R2 aporta un fallo técnico de ejemplo
(1/2 solicitudes de inferencia), no dos falsos negativos ni una abstención semántica. Otros veinte
criterios no ejecutados. No procede presentar exactitud de 24 criterios ni extrapolar a COV2/COV3.

Conclusión: funcionan el conteo vinculado, reserva previa, resultado positivo simple de R1 y parada
duradera ante una adjudicación inválida. Hace falta diagnóstico seguro más granular de validación
para aislar defectos futuros sin guardar raw, y una revisión offline antes de cualquier nuevo lote.
No se ajustan prompts, expectativas ni validadores para hacer pasar este intento; no se reanuda
el lote detenido. Esto no constituye aceptación final, generalización ni resistencia a inyección.

Comprobaciones nuevas: proyección seca, doce conteos oficiales, dos inferencias, revisión de citas
válidas y cadena hash del diario PASS. Sin código versionado cambiado, sin suites/TypeScript
repetidos; evidencia offline anterior conservada como histórica. Documentación actualizada sin
crear entonces otro commit exclusivamente documental; ahora se integra con el ajuste diagnóstico autorizado. Personalización y seguimiento 0/4, M6 64%, proyecto
51.53%, M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT; sin cambios productivos.

## Histórico: autorizado, detenido antes del gasto — 6 de octubre de 2026

El usuario ha autorizado **la primera CALIBRACIÓN EXPLORATORIA**, con **máximo conjunto de 3 USD
de consumo API antes de impuestos**, incluyendo operaciones auxiliares facturables. Modelo/lote y
configuración son los ya definidos: Terra, endpoint global, Standard, medium, salida 8.000 tokens,
doce inferencias secuenciales, sin reintentos ni fallback. No se necesita ratificar esta autorización.
Base comprobada: rama `chatusal-v2`, HEAD `04776b25fd8df1f1005b011e05c46e61052e626f`, árbol limpio.

**Resultado: BLOCKED_BEFORE_API.** Se consultaron de nuevo las fuentes oficiales:

- [Counting tokens](https://developers.openai.com/api/docs/guides/token-counting) documenta
  `POST /v1/responses/input_tokens`, que devuelve el conteo completo sin generar una respuesta.
- [Referencia de conteo](https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens/methods/count):
  mecanismo identificado en el índice oficial; la recuperación directa de esta página falló y no
  se interpreta como un fallo de la API ni como evidencia sobre su precio.
- [Pricing](https://developers.openai.com/api/docs/pricing), la guía de conteo y búsquedas dirigidas
  en documentación oficial **no permitieron verificar una declaración de gratuidad ni una tarifa
  aplicable al endpoint de conteo**. La ausencia de una tarifa en esas páginas no demuestra coste cero.
- [Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra) y
  [caché](https://developers.openai.com/api/docs/guides/prompt-caching) mantienen las tarifas de
  inferencia usadas por el control: entrada 2 USD/M, lectura 0,20, escritura 2,50 y salida 12.
  Estas tarifas de inferencia no se extrapolan al conteo sin generación.

Se aplica la condición expresa del usuario: si no se puede determinar el coste del conteo,
**no ejecutarlo**. No se llamó al endpoint de conteo ni al de inferencia. No se leyeron credenciales,
crearon autorizaciones ejecutables con conteos ficticios, reservas, locks ni registros sensibles.
La aprobación de la conversación es válida; el archivo privado ejecutable queda pendiente de
conteos verificables y de justificar el máximo conjunto. No se modifica ni debilita ningún control.

| Operación / medida | Resultado de este intento |
|---|---|
| Conteos API realizados | 0; coste sin verificar, no se enviaron solicitudes |
| Inferencias realizadas / fallidas | 0 / 0 |
| Inferencias omitidas | 12, por bloqueo previo al gasto |
| Tokens API consumidos / coste conocido | 0 / 0 USD |
| Reservas pendientes por incertidumbre | 0 USD; ninguna solicitud enviada |
| FP / FN / abstenciones | No calculables; no existen observaciones |
| Soporte de citas y afirmaciones adicionales del evaluador | No evaluable, sin respuestas del proveedor |

Expectativas recuperadas localmente de los fixtures existentes, **sin modificarlas**. D = DEMONSTRATED,
ND = NOT_DEMONSTRATED, I = INSUFFICIENT, C = CONTRADICTORY, NA = NOT_APPLICABLE.
NO_EJECUTADO es el estado de este intento, no una etiqueta académica ni una abstención del modelo.

| Ejemplo | Esperado por criterio | Observado por criterio |
|---|---|---|
| R1 | Fidelidad D; inicio D | Ambos NO_EJECUTADO |
| R2 | Fidelidad D; inicio ND | Ambos NO_EJECUTADO |
| R3 | Fidelidad I; inicio D | Ambos NO_EJECUTADO |
| R-INJECTION | Fidelidad D; inicio D | Ambos NO_EJECUTADO |
| S1 | Responsable D | NO_EJECUTADO |
| S2 | Responsable I | NO_EJECUTADO |
| S3-ADOPT | Plazo/condición D | NO_EJECUTADO |
| S4-CONFLICT | Plazo/condición C | NO_EJECUTADO |
| P1 | Adaptación D; comprobación D; respuesta NA | Todos NO_EJECUTADO |
| P2-WITHDRAW | Adaptación D; comprobación D; respuesta D | Todos NO_EJECUTADO |
| P3-ADOPT | Adaptación D; comprobación D; respuesta NA | Todos NO_EJECUTADO |
| P4-LATE | Adaptación ND; comprobación D; respuesta NA | Todos NO_EJECUTADO |

Siguen como expectativas, **no hallazgos del evaluador**: «Vive sola» de R2 carece de respaldo;
«sensación de giro» de R3 introduce especificidad no acreditada por «Me mareo». No hay citas
producidas por un modelo cuyo soporte pueda revisarse. La evidencia offline anterior permanece
válida para controles estructurales; no demuestra calidad semántica real.

Para desbloquear falta una fuente oficial que acredite gratuidad o permita acotar el precio de
conteo. Después se requieren los conteos de las solicitudes exactas y comprobar:
`coste_auxiliar_máximo + suma(reservas_inferencia) <= 3 USD`. Si el conteo resulta facturable,
hay que reservar primero su máximo y descontarlo del presupuesto de inferencia; el enlace técnico
deberá probarse offline antes de usarlo. No se implementa una tarifa ficticia ni se llama para descubrirla.
Este intento solo actualiza documentación; sin tests repetidos, cambios funcionales ni datos privados.
Sin aceptación final, generalización, puntos, DB, despliegue ni COV4; porcentajes/estados intactos.

## Histórico: controles del primer lote antes de la autorización — 6 de octubre de 2026

**No existe autorización de gasto.** La propuesta de 65 USD no fue aprobada y queda descartada.
La única propuesta pendiente es **3 USD de consumo API antes de impuestos**. No es permiso de ejecución.
La implementación anterior está publicada en `2747fb1e5e7e0f2f234611327a9c334429dfadd2`.
Este ajuste añade controles offline; no realiza inferencia, DB, instalaciones ni cambios productivos.
La preparación de calibración y las evidencias anteriores se conservan abajo como histórico.

### Candidato, tarifas y límite que aún no está demostrado

Fuentes oficiales consultadas el 6 de octubre de 2026:

- [GPT-5.6 Terra](https://developers.openai.com/api/docs/models/gpt-5.6-terra): identificador
  `gpt-5.6-terra`, Responses y Structured Outputs; entrada 2 USD/M, lectura de caché 0,20 USD/M,
  salida 12 USD/M, contexto corto hasta 272.000 tokens de entrada.
- [Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching): para GPT-5.6 y posteriores,
  también en Responses, escritura a 1,25 veces la entrada ordinaria (2,50 USD/M); no es un
  recargo que se deba sumar nuevamente a la entrada ordinaria de esos mismos tokens.
- [Responses](https://developers.openai.com/api/reference/python/resources/responses/methods/create):
  `service_tier: default` selecciona Standard. `max_output_tokens` incluye razonamiento y salida visible.
- [Counting tokens](https://developers.openai.com/api/docs/guides/token-counting): el conteo completo
  incluye estructura de mensajes y esquemas; un tokenizer local del texto no reproduce necesariamente
  ese conteo. El endpoint de conteo acepta la solicitud completa. **No se ha llamado**.

Configuración cerrada en [cov-experiment-policy.ts](../../lib/cases/v2/cov-experiment-policy.ts):
Terra, endpoint global `https://api.openai.com/v1`, Standard explícito, razonamiento `medium`,
8.000 tokens de salida, 20.000 bytes de entrada proyectada, 60.000 ms, cero reintentos/fallback,
sin herramientas, `store:false`. Disponibilidad/permisos de cuenta no comprobados. La elegibilidad
D1/D2 no es autorización COV ni aprobación productiva. La versión del adaptador pasa a `/2`;
se fijan razonamiento/servicio en el cuerpo y en la identidad. No cambian los criterios docentes.

Medición local exacta de bytes UTF-8 de input + instrucciones + formato/schema: R1 12.378;
R2 12.378; R3 12.365; R-INJECTION 12.459; S1 11.566; S2 11.543; S3-ADOPT 11.705;
S4-CONFLICT 11.712; P1 16.167; P2-WITHDRAW 16.457; P3-ADOPT 16.174; P4-LATE 16.160.
Total **161.064 bytes**. Es un límite de contenido serializado, **no una cota de todos los tokens**.
La estructura final interna del proveedor no tiene una cota publicada que se haya podido verificar.
No se usa bytes/3, otra constante heurística ni toda la ventana de contexto como máximo garantizado.

Con conteos completos verificados `T_i`, el máximo conservador de consumo es:

```text
reserva_i (micro-USD) = ceil(2,5 × T_i + 12 × 8.000)
máximo_lote = suma de las 12 reservas
salida total máxima = 96.000 tokens = 1,152 USD (razonamiento incluido, no sumado dos veces)
```

Se reserva toda entrada al mayor precio aplicable de contexto corto (escritura de caché), sin
descontar hits. Un conteo completo de **hasta 61.600 tokens por solicitud** es una condición
suficiente para que las doce reservas sumen como máximo **3 USD**. Esto es una condición de
financiación, no un conteo observado ni una cota inferida de los bytes. El cálculo exacto admite
repartos distintos; rechaza contexto largo o un presupuesto insuficiente sin reducir salida.
El máximo del lote real sigue **NO VERIFICADO**: el modo seco devuelve `maximumCostMicroUsd: null`.
No se inventan costes ni gratuidad de una eventual adquisición de conteos: esa operación auxiliar
requiere primero verificar su tarifa/ausencia de cargo y su autorización; no está implementada ni
incluida como una llamada oculta del runner. El runner de inferencia hace exactamente doce solicitudes.

### Autorización, durabilidad y privacidad

[first-batch.ts](../../tools/cov-calibration/first-batch.ts) selecciona exclusivamente y en orden:
R1, R2, R3, R-INJECTION, S1, S2, S3-ADOPT, S4-CONFLICT, P1, P2-WITHDRAW, P3-ADOPT, P4-LATE.
Congela un manifiesto de fingerprints de fixtures y cuerpos proyectados. Las expectativas docentes
solo se usan localmente para métricas, nunca en solicitudes al proveedor.

La autorización es un documento administrativo local de confianza, formato `cov-authorization/1`,
validado estrictamente: aprobación humana expresa, ID, vigencia máxima de 24 horas, configuración,
endpoint/servicio, tarifa, presupuesto, hash del manifiesto, ruta absoluta del journal y doce conteos
completos por hash de solicitud con fecha (máximo 24 horas). `inputCounts.source` debe ser
`PROVIDER_COMPLETE_INPUT_COUNT`: una atestación del operador basada en mediciones verificadas,
no un entero inventado ni una estimación. No se genera ningún documento aprobado en este cambio.
El JSON no demuestra por sí solo consentimiento humano ni autenticidad del proveedor: la ruta y
su contenido son autoridad administrativa del operador; no se aceptan desde UI/alumnos/HTTP.

[cov-execution-session.ts](../../lib/cases/v2/cov-execution-session.ts) exige la misma autorización en
la vía real del adaptador. No basta con saltarse el CLI ni fabricar un objeto con métodos similares.
El punto de inyección de transporte simulado queda explícito para tests y rechaza objetos con
endpoint SDK; no constituye un sandbox contra código JavaScript malicioso del operador.

- Un lock exclusivo `wx` cubre toda la ejecución, también los awaits. No se roba un lock obsoleto.
- Journal append-only con secuencia/hash encadenado y `fsync` **antes** de cada envío; un error al
  escribir o confirmar la reserva impide la solicitud. La reserva ya implica posible envío.
- Reinicio con reserva sin resultado, STOP o journal truncado/inválido: bloqueo. Nunca reenviar.
  Un reinicio tras éxito recupera resultados guardados sin crear cliente ni llamar al proveedor.
- Todas las reservas se conservan, incluso en timeout, respuesta perdida, error o coste observado
  inferior. No se reutiliza saldo para repeticiones. No se cambia de carpeta para reanudar el mismo
  permiso. Un lock residual requiere revisión manual, nunca borrar journal para recuperar permiso.
- Se comprueba presupuesto total antes de crear cliente y saldo antes de cada envío; se para ante
  fallos técnicos, modelo/servicio/configuración distintos, uso superior al conteo atestado o fallo
  de registro. Los desacuerdos semánticos válidos no se descartan ni detienen por conveniencia.
- Se conservan evaluaciones estructuradas, citas seleccionadas, métricas, IDs y uso numérico. No se
  guarda respuesta raw, error completo, headers, credenciales, transcript completo ni testigos.
  Se excluye `evidenceTimeline` de COV2 al guardar. Si falla el parseo, se proyectan solo ID/uso
  disponibles y error constante; no se guarda texto inválido. No se almacena razonamiento raw.

Garantía local de un único host y filesystem del operador, frente a concurrencia/reinicio del
proceso. No protege contra eliminación/edición deliberada del journal, pérdida del disco o copias
independientes de la autoridad administrativa. Se recomienda carpeta privada fuera del repositorio;
las pruebas usan exclusivamente carpetas temporales y transportes simulados.

### Comandos preparados

```powershell
# Ejecutable ahora: doce ejemplos, sin credenciales, red ni escritura de journal.
node node_modules/vite-node/vite-node.mjs tools/cov-calibration/run.ts --dry

# Implementado pero NO autorizado: exige aprobación y conteos completos verificados.
node node_modules/vite-node/vite-node.mjs tools/cov-calibration/run.ts --live --authorization C:\ruta-privada\cov-autorizacion.json
```

La autorización debe ajustarse a `covGrantSchema`; no hay archivo de aprobación de ejemplo que pueda
activarse accidentalmente. `runCalibration` conserva el harness offline anterior de 33 variantes;
su vía live sigue bloqueada. El CLI utiliza el nuevo lote cerrado. Sin fallback entre ambos.

La ejecución futura será **CALIBRACIÓN EXPLORATORIA**, no aceptación final, conjunto reservado,
generalización ni acreditación. No se selecciona la mejor respuesta ni se modifican instrucciones
durante el lote. Permanecen personalización 0/4, seguimiento 0/4, M6 64%, proyecto 51.53%,
M6/M6-E PARTIAL, PED2 abierto y D3B OPEN / VALIDATION DEBT.

Evidencia de este ajuste:
- Controles nuevos **29/29**, con transporte simulado y autorizaciones/conteos sintéticos solo en tests.
  Incluyen presupuesto insuficiente, vía directa, timeout, concurrencia, reinicio, journal incompleto,
  fallo de fsync antes del envío, fallo de registro posterior, modelo/configuración y parseo seguro.
- Focalizados finales controles + calibración **54/54** y TypeScript **PASS**.
- Selección COV1–COV3 + controles durante el desarrollo **216/216**, antes de las dos regresiones finales.
- Suite offline única por gate **3533 PASS / 67 SKIPPED**, antes del último ajuste localizado que
  reconstruye STOP desde un resultado técnico si el proceso cae entre ambos registros. Ese ajuste
  y su regresión están cubiertos por los 54 focalizados finales y TypeScript; no se atribuye a la suite previa.
- Modo seco ejecutado: doce solicitudes previstas, ninguna real; máximo de entrada/coste completo
  aún no verificado. Diff-check correcto. Sin nuevas verificaciones live/PostgreSQL ni configuración de ESLint.

## Histórico: preparación del 5 de octubre de 2026

5 de octubre de 2026. Implementación y pruebas **offline**; aceptación semántica **PENDING**.
Base publicada verificada: `0ef136f4f1bade4f7bf0fd3da6b36d3be8238e4c` (COV3 `/1`).
No se realizan llamadas reales, gasto API, DB, migraciones, instalaciones ni despliegues.
No se inicia COV4 ni se reabre D3B. [PROJECT_STATUS](PROJECT_STATUS.md) sigue siendo canónico:
personalización 0/4, M6 64%, proyecto 51.53%, M6/M6-E PARTIAL, PED2 abierto,
perfiles productivos no aprobados, D3B OPEN / VALIDATION DEBT.

## Correspondencia con decisiones docentes aprobadas

| Criterio | Implementación |
|---|---|
| «Me mareo» no acredita «sensación de giro» | COV1 instrucciones `/2`: fidelidad `INSUFFICIENT`, afirmación específica `UNSUPPORTED` con captura completa. No cambiar a `UNCERTAIN` para acomodar el contrato. |
| «Revisaremos» contextual | COV2 instrucciones `/3`: puede demostrar actor si inequívoco; varias interpretaciones → `INSUFFICIENT`. Sin fórmula universal. |
| «De acuerdo» ante propuesta única | COV2 `/3` y COV3 `/3`: puede acreditar adopción; brevedad no implica incertidumbre. «He oído su propuesta» no basta. |
| Historia separada de vigencia | COV3 request/adjudicación/evaluación `/2`, instrucciones `/3`; `assessmentBasis: OBSERVED_PERFORMANCE`. Vigencia conservada en cada cadena. |
| Retirada no borra ni concede positivos | Adaptación/comprobación demostradas se conservan; atender una dificultad requiere evidencia propia, no la mera etiqueta WITHDRAWN. |
| Comprobar ≠ resultar viable | Una comprobación concreta es desempeño observable; no prueba viabilidad efectiva, aceptación, seguridad ni eficacia. |

Los estados COV1/COV2 ya permiten estas distinciones: solo cambian instrucciones y su fingerprint,
sin reinterpretar evaluaciones previas. COV3 `/1` y su evaluador permanecen intactos. `/2` es una
frontera explícita separada que rechaza adjudicación `/1` y conserva bindings, citas, roles, secuencia,
aislamiento, criterios exactos y errores seguros. Se mantiene una copia acotada del evaluador para no
introducir una refactorización transversal ni alterar el comportamiento publicado `/1`.

En `/2` no se degradan automáticamente positivos por standing retirado/incierto o incompatibilidad
posterior. Se conservan incompatibilidades y clasificación semántica del criterio afectado. Cada
criterio referencia una cadena: validar esa referencia no descubre causalidad, autoría, mezclas
semánticas dentro de ella ni contradicciones omitidas. Eso sigue pendiente de aceptación real.

## Materiales y primer lote

[fixtures.ts](../../tools/cov-calibration/fixtures.ts) materializa **33 variantes de desarrollo**:
requisitos explícitos/versionados, perfil público, transcript M5, bindings, entrega escrita cuando
corresponde, etiquetas por criterio, citas con offsets, justificaciones y errores que detectan.
Las variantes de intake reutilizan expresamente fuentes congeladas. La referencia sintética COV1 es
independiente de D3: no se importan sus matrices, expectativas ni resultados. Los resultados esperados
proceden de criterios docentes, no de runtimes falsos. Hechos ocultos no se atribuyen al estudiante.

| Capacidad | IDs y cobertura |
|---|---|
| COV1 | R1 positivo; R2 omisión y afirmación adicional; R3 especificidad mareo/giro; R4 captura incompleta; R-INJECTION; R-ABSENT, R-EMPTY, R-INTENT_ONLY y R-CAPTURE_FAILED. |
| COV2 | S1/S2 actor inequívoco/ambiguo; S3-ADOPT/S3-QUOTE acuerdo/cita; S4-CONFLICT/S4-WITHDRAW contradicción/rectificación; S5-PARTIAL/S5-INCOMPLETE intención/captura; S-INJECTION; S-COMPLETE/S-PARTIAL cuatro elementos completos/parciales; COV2-NA. |
| COV3 | P1 adaptación/comprobación; P2-REJECT/P2-WITHDRAW/P2-BARE rechazo, retirada razonada y retirada con referente ambiguo; P3-ADOPT/P3-QUOTE; P4-LATE/P4-INCOMPLETE/P4-REFORMULATE; P-INJECTION; P-CONFLICT; COV3-NA. |

Ejemplo R3: paciente «Me mareo»; informe «Presenta sensación de giro. Inicio desconocido».
Requisitos: describir fielmente la molestia y declarar inicio o desconocimiento. Fidelidad
`INSUFFICIENT`, inicio `DEMONSTRATED`, afirmación de giro `UNSUPPORTED`. No se equiparan mareo/giro.

Ejemplo P2-WITHDRAW: paciente comunica dificultad para leer letra pequeña; alumno adapta el tamaño
y pregunta si puede leerlo/usarlo; paciente dice que tampoco puede; alumno retira específicamente
ese formato por esa dificultad. Adaptación y comprobación históricas siguen demostradas. Atención
se sustenta en la respuesta concreta. P2-BARE incluye dos propuestas y retirada no identificada:
evidencia insuficiente de cuál se atiende; no impone explicación universal si el contexto es inequívoco.

Primer lote propuesto: **12 solicitudes**, un candidato, sin reintentos:
R1, R2, R3, R-INJECTION; S1, S2, S3-ADOPT, S4-CONFLICT;
P1, P2-WITHDRAW, P3-ADOPT, P4-LATE. Después, contrastes restantes si se autoriza.
Conjunto entero: **27 solicitudes potenciales** y **6 variantes sin proveedor**.
Estos ejemplos son calibración, no conjunto reservado ni evidencia de generalización. Antes de
aceptación se necesita un conjunto nuevo reservado por el docente, no simples paráfrasis, congelado
antes de ejecutar y sin ajustar prompts después de abrir sus resultados. Umbrales de aceptación
pendientes; no se hereda el gate de D3B ni se inventan pesos o penalizaciones académicas.

## Adaptadores reales, probados con transporte simulado

[cov-semantic-runtime.ts](../../lib/cases/v2/cov-semantic-runtime.ts) proporciona tres adaptadores
compatibles con `OpenAI.responses.parse`. Construyen solicitudes reales y validan respuestas; no
son respuestas enlatadas. El transporte es inyectado, sin cliente implícito, credenciales o red al
importar. Los tests usan exclusivamente transporte simulado; el runner no construye cliente real.

Elegibilidad experimental: identificadores exactos `gpt-5.6-sol` y `gpt-5.6-terra`, reutilizando la lista
farmacéutica sin cambiar D1/D2. No hay modelo por defecto ni fallback. Esto no confirma disponibilidad,
permisos de cuenta, precios ni aceptación del candidato para COV. Configuración explícita: modelo,
maxOutputTokens, maxInputBytes y timeoutMs. `response.model` debe coincidir exactamente.

Patrón del SDK existente y [Structured Outputs oficial](https://developers.openai.com/api/docs/guides/structured-outputs):
JSON schema estricto, `store:false`, `maxRetries:0`. Opcionales de cadenas son required/nullable en
transporte y null se convierte solo a ausencia del campo opcional interno. No se reparan citas ni
etiquetas. Modelo distinto, estado incompleto, refusal, digest/payload inválido o excepción producen
error seguro; evaluadores vuelven a comprobar integridad y referencias, no soporte semántico real.

La solicitud se proyecta desde requisitos y fuentes, nunca desde el fixture completo. No se envían
expectativas, justificaciones, métricas ni claves docentes. Requisitos del caso sí son entrada
necesaria y no deben confundirse con expectativas de desempeño del ejemplo.

## Runner y métricas

Sin instalación ni cambios de package.json:

```powershell
node node_modules/vite-node/vite-node.mjs tools/cov-calibration/run.ts
```

Equivale a `--dry`: valida fuentes con evaluadores, cuenta solicitudes potenciales y devuelve
manifiestos con fingerprints. No devuelve adjudicaciones falsas ni ceros que aparenten acierto:
métricas null, `measurementsPerformed:false`, `acceptance:NOT_ASSESSED`.
`--live` está bloqueado antes de construir fuentes/cliente: no hay autorización de modelo/presupuesto
ni variable de entorno que lo desbloquee. La función `simulated` requiere cliente explícito para
pruebas offline; no se expone en CLI como atajo live.

Lote limitado a 42 entradas; límites explícitos por solicitud: salida ≤10000 tokens, entrada
serializada incluyendo schema/instrucciones ≤100000 bytes, timeout ≤60000 ms. Bytes no son tokens ni
límite monetario. El bloqueo live es la protección actual contra gasto. Antes de habilitar ejecución
real: autorización expresa de modelo/presupuesto, tarifas verificadas y reserva conservadora de coste
por llamada. No se inventan precios ni se presenta un límite de llamadas como presupuesto monetario.

Métricas: confusión por capacidad/criterio, falsos positivos, falsos negativos decisivos, abstenciones
I/U y positivos perdidos por abstención separados, fallos técnicos, estado global y claims
omitidos/adicionales. Fallos técnicos no se convierten en suspensos. Evaluaciones y citas se conservan
en la salida simulada para revisión. Claims se emparejan uno a uno por solapamiento de spans: orienta
revisión, no certifica equivalencia/soporte semántico; fusiones/divisiones necesitan revisión humana.
No hay aceptación automática; hasta una simulación perfecta conserva `NOT_ASSESSED`.

## Evidencia nueva y pendientes

- Focalizados **189 PASS**: 43 COV1, 54 COV2, 67 COV3, 25 calibración/transporte.
- Los 62 tests anteriores COV3 `/1` siguen intactos en sus expectativas históricas; cinco nuevos
  cubren `/2`, conservación histórica, no positivos automáticos, conflictos y rechazo de `/1`.
- `npx tsc --noEmit --incremental false`: **PASS**.
- Suite offline final: **3505 PASS / 67 SKIPPED**, 87 archivos pass y 7 omitidos; gates live/PG a `0`.
- Runner seco: 33 variantes, 27 solicitudes potenciales; **cero llamadas reales**.
- Evidencia previa 56/56, 153/153, 3469/67 y PostgreSQL anteriores permanece histórica.

No se configura ESLint. Los mocks prueban transporte, aislamiento, exclusión de expectativas,
límites y errores, no calidad semántica ni resistencia real a inyección. Aceptación real, integración
productiva, ownership, reevaluación/publicación y retención/supresión siguen pendientes. No reabren
las decisiones docentes aprobadas; impiden declarar aceptación productiva o ejecutar live ahora.
