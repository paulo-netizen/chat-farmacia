# COV1–COV3 — Preparación de calibración semántica

## Estado vigente: autorizado, detenido antes del gasto — 6 de octubre de 2026

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
