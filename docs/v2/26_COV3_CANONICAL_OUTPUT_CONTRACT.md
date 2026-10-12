# COV3 — Contrato canónico de salida y revisión integral offline

> Compatibilidad histórica (2026-10-12): las referencias a tratamiento público de este contrato describen fixtures/versiones offline anteriores. La política actual del producto solo expone nombre, edad y sexo. No reutilizar esas fuentes públicas para acreditar conocimiento del tratamiento en nuevos casos; debe proceder de la entrevista. No se reescriben resultados ni expectativas históricas. No hay integración productiva COV autorizada.


11 de octubre de 2026. Base `4e44048d972dd2879351f406e0920d17801a7fec`, rama `chatusal-v2`,
árbol inicialmente limpio. Alcance: contrato, proyección, adaptación, validación y pruebas COV3.
**Sin inferencias ni conteos.** No se cambian fixtures, expectativas, scoring ni porcentajes.

## Hallazgos y versiones

Defectos de representación demostrados por inspección y pruebas sintéticas:

1. El estado global de dificultad repetía el de las propuestas y exigía al proveedor producir
   un resumen redundante exacto. La versión nueva elimina ese resumen de solicitud de salida y resultado.
2. La misma dificultad podía representarse en `difficulty.evidence`, `patientResponse` y
   `responseToDifficulty.difficulty`. Ahora se cita una sola vez por propuesta; la actuación del
   estudiante señala su índice. `patientResponse` queda para aceptación o interpretación incierta.
3. Las citas de mensajes tenían la misma forma para ambos roles; la restricción se descubría al
   adaptar. Ahora el esquema distingue `STUDENT_MESSAGE`, `PATIENT_MESSAGE` y `PUBLIC`, y la
   proyección enumera los identificadores elegibles por tipo. El servidor sigue comprobando el rol real.
4. El diagnóstico identificaba una regla sin su campo. La versión /3 conserva campo, rol exigido,
   tipo de referencia y etapa, todos de vocabulario cerrado, y acumula infracciones independientes.

Esto **no identifica las causas de los P1 históricos**. La respuesta rechazada no se conservó;
SOURCE_ROLE_INVALID no permite recuperar qué campo falló. Ningún test sintético se presenta como
reproducción de una respuesta real perdida.

| Capa | Versión y entrada explícita |
|---|---|
| Dominio | `personalization-request/4`, `personalization-adjudication/4`, `personalization-evaluation/4` |
| Instrucciones | `personalization-instructions/5` |
| Proveedor | `personalization-canonical-sources-adjudication/5`, proyección `canonical/5` |
| Diagnóstico localizado | `cov-diagnostic/3`; /1 y /2 siguen interpretables |
| Adaptadores | Opt-in `canonical`; valores por defecto y runners live anteriores conservan su versión |

[Contrato/adaptador](../../lib/cases/v2/cov3-canonical-contract.ts),
[evaluador](../../lib/cases/v2/evaluate-personalization-v4.ts),
[proyección y transporte](../../lib/cases/v2/cov-semantic-runtime.ts),
[pruebas completas](../../tests/unit/cov3-canonical-contract.test.ts).
No se convierten silenciosamente resultados históricos. V1–V3 siguen disponibles.

## Convenciones comunes

Todas las citas al proveedor son literales: tipo de fuente, `messageId` o campo público,
`quote` y `occurrence`. Este último es null solo ante coincidencia única; en repeticiones exige
ordinal de base 1, contando coincidencias solapadas. El servidor resuelve posiciones UTF-16
`[start,end)` sin normalizar Unicode, espacios ni saltos de línea y sin buscar en otra fuente.
No acepta offsets del proveedor en esta versión. Las ausencias opcionales son null en el wire
y se convierten a ausencia de propiedad en el dominio; una referencia inválida nunca se descarta.

Los objetos del esquema generado son estrictos y sus campos requeridos; los opcionales usan null,
conforme a [Structured Outputs oficial](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses),
consultado el 11 de octubre. La prueba inspecciona recursivamente el esquema JSON generado por el SDK.
No prueba disponibilidad del modelo ni aceptación del esquema por una llamada real.

El transcript vinculado determina roles y orden, no el orden declarado por el modelo. La sesión,
versión del caso y fingerprint se validan antes del runtime; `requestDigest` liga la salida a la
solicitud congelada. Los arrays de evidencia no afirman orden temporal: sus referencias lo permiten
comprobar. Las cadenas finales se ordenan por posición real de su propuesta.

## Matriz de contrato de las cuatro capas

En la columna proveedor, E = `STUDENT_MESSAGE`, P = `PATIENT_MESSAGE`, U = `PUBLIC`.
La adaptación E/P elimina el discriminador wire, verifica rol y literal, y calcula el span;
U conserva el campo público. Todas las referencias finales vuelven a validarse incluso si un
runtime propio omite el adaptador. «Demostrado» siempre requiere juicio semántico además de estructura.

| Campo / significado | Fuentes y roles | Obligación / ausencia | Tiempo y propuesta | Proveedor | Adaptador | Regla final |
|---|---|---|---|---|---|---|
| `circumstances`: hechos conocidos que fundamentan adaptación | P o nombre/edad/sexo/tratamiento U; nunca hechos ocultos | Array; no vacío para ADAPTATION demostrado; vacío permitido para comprobar/atender dificultad | P anterior a propuesta; U disponible inicialmente | Array P/U | Resuelve solo origen indicado | CIRCUMSTANCE_NOT_PRIOR / ADAPTATION_CIRCUMSTANCE_MISSING |
| `proposal`: acto del estudiante, incluida adopción o cita | E | Obligatorio por cadena; no inventar cadena si no existe acto | Ancla cronológica de esa cadena | Cita E | Rol estudiante real | Referencia/literal válidos; no equivale a adaptación adecuada |
| `attribution` | Clasificación OWN_PROPOSAL / EXPLICIT_ADOPTION / QUOTATION | Obligatoria | No confundir propuesta paciente con acto estudiante | Enum | Conserva sin reinterpretar | QUOTATION no permite criterio demostrado |
| `patientProposal`: propuesta original adoptada | P | Obligatoria para EXPLICIT_ADOPTION; opcional en otros casos | Anterior al acto estudiante | P o null | Resuelve P | ADOPTION_SOURCE_MISSING / ADOPTION_NOT_PRIOR; adopción semántica pendiente |
| `feasibilityCheck`: comprobación realizada | E | Obligatoria para FEASIBILITY demostrado; opcional en otros casos | No anterior a propuesta; puede estar en mismo turno | E o null | Resuelve E | FEASIBILITY_CHECK_MISSING / FEASIBILITY_PRECEDES_PROPOSAL; no prueba viabilidad ni aceptación |
| `patientResponse`: aceptación o respuesta de interpretación incierta | P | Opcional; nunca exigir respuesta | Posterior a propuesta, puede preceder a comprobación | `{kind: ACCEPTANCE/UNCERTAIN, evidence:P}` o null | Resuelve P | PATIENT_RESPONSE_NOT_LATER; no sustituye comprobación |
| `difficulty.status/evidence`: dificultad sobre esta alternativa | P para evidencia; estado PRESENT/NOT_OBSERVED/UNCERTAIN | Obligatorio por cadena; PRESENT exige evidencia, NOT_OBSERVED exige array vacío; UNCERTAIN admite evidencia o ninguna | Citas posteriores a propuesta pertinente, no barrera inicial | Estado y array P, solo aquí | Resuelve cada P, sin inferir ni cambiar estado | DIFFICULTY_EVIDENCE_MISSING / DIFFICULTY_STATE_CONFLICT / DIFFICULTY_EVIDENCE_NOT_AFTER_PROPOSAL |
| `responseToDifficulty.difficultyIndex`: dificultad atendida | Referencia al array de dificultad de esta cadena | Obligatorio si existe responseToDifficulty | Índice de base 0 local, no referencia a otra propuesta | Entero | Conserva índice | RESPONSE_DIFFICULTY_REFERENCE_INVALID; no se evalúa su tiempo si no existe |
| `responseToDifficulty.response`: actuación ante dificultad | E | Con índice obligatorio; necesaria para RESPONSE_TO_DIFFICULTY demostrado y dificultad PRESENT | Posterior a evidencia indexada; no anterior a propuesta | E | Resuelve E | RESPONSE_NOT_AFTER_DIFFICULTY / RESPONSE_PRECEDES_PROPOSAL / DIFFICULTY_RESPONSE_MISSING |
| `standing/withdrawal`: vigencia y retirada confirmada | Estado CURRENT/WITHDRAWN/UNCERTAIN; retirada E | WITHDRAWN exige cita; cita de retirada exige WITHDRAWN; ausencia null | Retirada posterior a propuesta | Enum y E/null | Sin inferir vigencia | WITHDRAWAL_NOT_LATER / WITHDRAWAL_STATE_CONFLICT / WITHDRAWAL_EVIDENCE_MISSING; no borra desempeño histórico |
| `criteria.studentEvidence`: desempeño, no contexto paciente | E exclusivamente | Array, puede estar vacío si el soporte exigido está en la cadena | Criterio ligado a una cadena coherente; no prueba causalidad por coexistencia | Array E | No mueve citas P a otro campo | Roles/literales; soporte obligatorio según aspecto en cadena |
| `criteria.requirementId/status/linkRef` | Requisito configurado / enum / referencia a cadena | Conjunto exacto, sin duplicados; linkRef null para ausencia/incertidumbre sin cadena | Un criterio usa una cadena; no unión oportunista | IDs y enum, no expectativas de fixtures | Conserva | CRITERIA_* / LINK_REFERENCE_INVALID; DEMONSTRATED exige autoría y soporte; NOT_APPLICABLE solo respuesta condicionada sin dificultad en su cadena |
| `incompatibilities.first/second` | Dos linkId diferentes existentes | Array, vacío si no se detecta incompatibilidad | Conserva conflicto, no elige ganador | Pares de IDs | Conserva | INCOMPATIBILITY_REFERENCE_INVALID; significado de incompatibilidad semántico |
| `requestDigest` | Identidad server-owned de solicitud | Obligatorio, exacto | Fuentes/configuración congeladas | Hash | Conserva | REQUEST_DIGEST_MISMATCH |

Sin propuestas, el criterio condicionado puede usar linkRef null y NOT_APPLICABLE porque no se
observa dificultad sobre una alternativa propuesta; con captura incompleta se conserva INSUFFICIENT.
Con propuestas, NOT_APPLICABLE necesita la referencia pertinente y NOT_OBSERVED. No exime adaptación
o comprobación. NOT_DEMONSTRATED requiere captura completa y oportunidad; la captura ausente no es
una omisión académica. Esas salvaguardas operan **después** de rechazar adjudicaciones inválidas.

Una dificultad de otra propuesta no se importa por índice. Que dos referencias posteriores sean
válidas no demuestra que traten el mismo asunto: esa relación necesita revisión semántica. La retirada
ambigua puede quedar en evidencia de criterio y standing UNCERTAIN; `withdrawal` representa retirada
identificada, no una frase arbitrariamente asignada. Nunca se otorgan positivos por retirar sin más.

## Diagnósticos seguros y orden de comprobación

1. Parseo estricto: localiza campos mediante mapa cerrado; no exporta paths Zod, índices, claves
   arbitrarias ni valores recibidos. Estructuras inválidas bloquean validaciones dependientes.
2. Referencias/citas: acumula errores independientes de campos válidamente estructurados. Incluye
   fuente inexistente, rol real incompatible, literal vacío/inexistente, ordinal inválido,
   ambigüedad, rango inválido, fuera de límites y texto no coincidente.
3. Identidades y conjuntos: duplicados o requisitos desconocidos/ausentes bloquean búsquedas ambiguas.
4. Relaciones: acumula estados, aplicabilidad, retirada, soporte y temporalidad independientes;
   nunca accede a una dificultad o cadena inexistente para validar su orden.

Ejemplo seguro: `{code: SOURCE_ROLE_INVALID, field: FEASIBILITY_CHECK, stage: ADAPTER,
requiredRole: STUDENT, referenceType: MESSAGE}`. Esto es ilustrativo, **no** el campo histórico de P1.
`issues` y `causes` conservan todas las infracciones comprobadas en la fase alcanzada. El runtime
mantiene esta localización al envolver errores; uso e identificadores conservan la ruta previa de metadata.
No hay nuevas respuestas raw ni registros privados publicados.

## Recorridos completos y evidencia nueva

Las salidas se construyeron a partir de los mensajes originales, sin añadir contenido al fixture
ni copiar respuestas reales. Orden de etiquetas: adaptación / comprobación / respuesta a dificultad.

| Ejemplo | Cadena sintética legítima y justificación | Esperado = obtenido offline |
|---|---|---|
| P1 | P1 «Me cuesta leer letra pequeña» → E2 registro grande → E3 pregunta concreta; sin respuesta/dificultad sobre alternativa | DEMONSTRATED / DEMONSTRATED / NOT_APPLICABLE |
| P2-WITHDRAW | Misma adaptación/comprobación; P4 tampoco puede leer; E5 retira por esa dificultad. Dificultad indexada, retirada y actuación son trazables | DEMONSTRATED / DEMONSTRATED / DEMONSTRATED |
| P3-ADOPT | P1 barrera y única propuesta concreta → E2 «De acuerdo» como adopción → E3 comprobación; sin dificultad de alternativa | DEMONSTRATED / DEMONSTRATED / NOT_APPLICABLE |
| P4-LATE | E1 propone antes de P2 revelar barrera; `circumstances=[]` evita atribución retrospectiva; E3 comprueba | NOT_DEMONSTRATED / DEMONSTRATED / NOT_APPLICABLE |

**4/4 recorridos técnicamente válidos; 12/12 etiquetas transportadas coincidentes con las expectativas
conservadas. No son 12 aciertos de un modelo real.** No se encontró contradicción que obligue a
inventar fuentes para representar esos cuatro ejemplos.

63/63 pruebas nuevas: recorridos, todas las posiciones de cita, roles/fuentes erróneos, secuencia,
retirada, adopción, no aplicabilidad, varias propuestas, Unicode/saltos de línea/repeticiones,
referencias de dificultad, captura incompleta, aislamiento asíncrono, diagnóstico sin filtraciones,
esquema generado y autorización del adaptador. Los ataques incrustados solo prueban separación
estructural de datos e instrucciones, no resistencia semántica real.

394 regresiones COV previas pasan en la suite final (COV1/COV2 y versiones anteriores conservadas).
Suite offline final ejecutada **una vez: 3.786 PASS / 67 SKIPPED**, 100 archivos PASS / 7 SKIPPED.
Gates live/PG desactivados. TypeScript y ambos diff-check PASS. Lint no completado: `next lint`
solicita configurar ESLint; no se configura ni se cambian dependencias. Los fallos intermedios de
tests/compilación se corrigieron antes de la suite final; no se presentan como evidencia semántica.

## Proyección, límites y continuación

La proyección cambia para COV3: instrucciones, schema, referencias tipadas y catálogo elegible.
Los cuatro conteos COV3 anteriores **no son reutilizables** para esta versión: harían falta conteos
nuevos vinculados a cada solicitud exacta y frescos. COV1/COV2 y sus hashes no cambian por este ajuste;
su eventual frescura se comprobaría aparte. No se obtuvo ningún conteo ahora.

`prepareFirstCovBatch('canonical/5')` construye la proyección sin red; el adaptador requiere opt-in
`canonical`. No se cambia el comportamiento de los CLI live históricos ni se reabre ningún diario.
Una ejecución posterior necesitará selección explícita de esta versión, nuevo diario y autorización
local ligada a hashes nuevos mediante los controles existentes; este encargo no la ejecuta.

Solo una prueba real posterior podrá observar si el modelo elige roles/campos correctos, interpreta
la relación causal, detecta dificultad pertinente, conserva retirada y resuelve adopción contextual.
La validez literal no acredita soporte semántico, eficacia o seguridad clínica. No se garantiza
exhaustividad de la extracción ni generalización. Los P1 históricos siguen fallidos e indeterminados
en su campo concreto; no se subsana retroactivamente su evidencia.

No hay gasto nuevo. Se conserva el registro previo de costes calculables y costes desconocidos.
Personalización 0/4; M6 64%, proyecto 51.53%, M6/M6-E PARTIAL, PED2 abierto, perfiles productivos
no aprobados y D3B OPEN / VALIDATION DEBT. Sin aceptación final, DB, despliegues ni COV4.
