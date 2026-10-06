# COV1–COV3 — Preparación de calibración semántica

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
