# 31 — Revisión y publicación docente por revisión

Entrega del 14 de octubre de 2026; base `634919029d27077c5324e088176c9eddd4d16246`.
Complementa [el editor](28_TEACHER_DRAFT_EDITOR_SPFA_2026.md) y [la prueba paciente](30_TEACHER_PATIENT_PREVIEW.md).

Registro histórico de esa entrega. El 16 de octubre se añadió [preparación y auditoría real](32_TEACHER_ACADEMIC_PREPARATION.md)
de los expedientes de Lucía/María; el paquete nativo completo y su aprobación siguen pendientes.

## Resultado y límite funcional

El editor permite revisar el contenido reservado, consultar requisitos de publicación y ejecutar
**Validar esta revisión → Publicar versión validada** cuando existe un candidato canónico
auditado. Ambas acciones verifican autorización y ownership en PostgreSQL, no solo en el cliente.
Una edición posterior crea una revisión nueva y no hereda la aprobación. El guardado sigue
funcionando aunque existan versiones canónicas intercaladas en la misma cadena.

**No está cerrado el recorrido de autoría académica general.** Aún falta preparar desde los
campos estructurados el paquete académico completo y conectar el auditor clínico automático.
No se completan por inferencia personalidad, protocolos, rúbricas ni conclusiones ausentes.
No hay un endpoint que permita al navegador adjuntar un supuesto `PASS` de auditoría.
El registro de candidatos/auditorías es un punto de integración servidor; el productor clínico
real sigue pendiente. Los textos, solución y cuestionario del borrador se conservan por su
versión vinculada; esto no implementa el motor de cuestionario M8.

Lucía y María permanecen `TEACHER_DRAFT`, sin candidato académico ni aprobación clínica.
Su pantalla muestra estructura `PASS`, paquete `MISSING`, auditoría `PENDING` y revisión
humana `PENDING`. Validar y publicar están deshabilitados y también bloqueados en servidor.

## Contrato y controles

| Capa | Comprobación | Lo que no acredita |
|---|---|---|
| Borrador | Esquema, campos obligatorios, referencias y revisión actual | Coherencia clínica |
| Paquete canónico | `GENERATED_CASE_BUNDLE_V2`, resolutores existentes de paciente, evaluador, SPFA y ficha pública; ausencia de fallos duros de compliance | Auditoría clínica ni aprobación docente |
| Auditoría | Evidencia inmutable vinculada al candidato exacto; `PENDING` y `FAIL` bloquean, `WARNING` requiere revisión explícita | Una declaración del cliente no es evidencia de auditoría |
| Revisión humana | Seis confirmaciones: clínica, solución, criterios, cuestionario, correspondencia y advertencias; nota, autor y fecha | No modifica automáticamente el caso ni convierte un fallo en PASS |
| Publicación | Transición separada desde `VALIDATED`, misma revisión actual, autorización vigente, transacción y lock de caso | No crea intentos, mensajes, evaluaciones ni asignaciones |
| Recuperación | Selección estudiantil existente sobre `PUBLISHED`; DTO inicial limitado a nombre, edad y sexo | No despliegue ni aceptación académica |

Migración aditiva `0006_v2_teacher_publication.sql`: candidatos y aprobaciones append-only,
bindings entre versiones del mismo caso y controles de publicación en PostgreSQL. El formato
de autoría `TEACHER_CASE_DRAFT_V1` **sigue sin poder publicarse**. No se modifica la fila legacy
para hacerla asignable. El candidato conserva su paquete inmutable y su provenance original.
Las transiciones quedan en `case_version_status_events`, con actor y razón `teacher-publication/1`.

La nueva publicación archiva la anterior en la misma transacción; contenido y referencias de
sesiones anteriores permanecen intactos. El lock de caso participa tanto en guardar como en
validar/publicar. Doble validación o una solicitud basada en revisión antigua no crean una
segunda aprobación. Estudiante, otro docente y actor cuyo rol haya sido revocado se rechazan.
Las respuestas de revisión son privadas y `no-store`; los errores no reflejan contenido clínico.

## Preferencia no definida de María

La conversación conservada respondió «Prefiero no hablar de eso; he venido por mi medicación»
a una pregunta familiar no cubierta por los hechos. No inventó el número de hijos, pero sí
atribuyó una preferencia no definida. El validador histórico la aceptó. Esto no demuestra la
causa interna del modelo; evidencia una distinción insuficientemente explícita en la política.

`teacher-patient/2` explicita en generación y validación que una evasiva no autoriza inventar
preferencias, emociones o motivos. Una preferencia explícita del caso sigue permitida según
su revelación; una respuesta no informativa sin hechos nuevos también. Una preferencia sin
soporte se clasifica `UNSUPPORTED_FACT`. No hay un filtro de palabras que convierta cualquier
«prefiero» en error. La clasificación continúa siendo semántica.

Las instantáneas `/1` conservan exactamente sus instrucciones históricas. No se añade la
preferencia a María ni se recalifica o sobrescribe la conversación anterior.

Comprobación real mínima: mismo contexto aceptado anterior a la pregunta, nueva ejecución `/2`,
una generación y una validación, sin reintentos. Respuesta: **«No sabría qué decirle sobre eso.»**
Resultado de seguridad: aceptado, sin nuevas preferencias ni datos familiares. Es una evidencia
puntual favorable; no demuestra resistencia general a alucinación o inyección. Las regresiones
offline comprueban proyección, versionado y reglas compartidas, no calidad semántica real.

## Consumo de esta comprobación

Modelo y configuración conservados: `gpt-5.6-terra`, medium, Standard, endpoint global,
`store:false`, 4096 tokens máximos por respuesta y timeout 60 s, propios de la previsualización.
No se reabre ninguna calibración COV.

| Operación | Entrada | Salida | Lectura caché | Escritura caché | Coste calculable USD | Reserva USD |
|---|---:|---:|---:|---:|---:|---:|
| Generación | 1820 | 57 | 0 | 1817 | 0.0052325 | 0.053702 |
| Validación | 2362 | 30 | 0 | 2359 | 0.0062635 | 0.055057 |
| Nuevo | 4182 | 87 | 0 | 4176 | **0.011496** | **0.108759** |

Histórico previo: 0.2343632 USD calculables y 2.711765 USD reservados. Acumulado:
**0.2458592 USD calculables, 2.820524 USD reservados y 58 conteos de coste desconocido**
(56 históricos + 2 nuevos). Las reservas se conservan, no se suman al coste como si fueran
otro cargo. No hubo solicitudes nuevas inciertas. Los diarios y autorizaciones nuevos quedan
privados, vinculados por hashes a los anteriores; no se publican respuestas raw ni secretos.

Tarifas oficiales verificadas el 14-10-2026: entrada ordinaria 2 USD/M, lectura de caché
0.20 USD/M, escritura 2.50 USD/M y salida 12 USD/M, incluido razonamiento.
[Modelo y capacidades](https://developers.openai.com/api/docs/models/gpt-5.6-terra),
[tarifas](https://developers.openai.com/api/docs/pricing).
Reserva por solicitud: `ceil(tokens_contados × 2.5 + 4096 × 12)` microUSD, con conteo oficial
de la proyección exacta. Se mantuvo el techo interno acumulado de reservas de 4 USD.
Referencia informativa BCE del 13-10: 1 EUR = 1.1188 USD; con márgenes de 30% para impuestos y
10% para cambio, 15 EUR equivalen a unos 11.736 USD planificables.
[BCE](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.cs.html).
Los conteos desconocidos impiden garantizar el total facturado; no se contabilizan como cero.
Se conserva la aceptación expresa del usuario de esa incertidumbre dentro del presupuesto.

## Verificación nueva y evidencia anterior

- 44/44 focalizadas: política paciente versionada, proyección/instantáneas, presupuesto,
  paquete canónico, confirmaciones, autorización HTTP, origen y errores seguros.
- 7/7 finales PostgreSQL: validar/publicar, selección pública, gates de auditoría/aplicabilidad,
  autorización, edición y aprobación obsoleta, duplicados y conservación de versiones archivadas.
  Incluyen conversación privada con transporte simulado y comprobación de que publicar no la
  modifica ni crea sesiones académicas. Migraciones
  0001–0006 aplicadas desde cero en otro contenedor desechable verificado, puerto 55452.
- 6/6 regresiones de borrador PostgreSQL ya ejecutadas durante esta entrega en 55451.
- Suite offline global: **3878 PASS / 79 SKIPPED**; sin live ni conexiones DB en esa suite.
  Se ejecutó antes del último bloqueo explícito de aplicabilidad `UNDETERMINED` y de ampliar
  la prueba integrada de preview. Tras ese ajuste: **18/18** focalizadas (7 PostgreSQL,
  7 contrato/política y 4 rutas) y **TypeScript PASS**, sin repetir la suite completa.
  Lint ejecutado: pide configurar ESLint y no completa; no se añade configuración.
- La evidencia previa 3867 PASS / 73 SKIPPED y la prueba conversacional de ambos casos del
  13 de octubre permanecen históricas; no son una nueva ejecución de esos turnos.

La demo de publicación utiliza `prepare-publication-demo.cjs`, cuenta sintética separada y
paquete de prueba. Su auditoría **SYNTHETIC_TEST es simulada**, visible como tal, y queda
prohibida fuera de la base desechable con nombre y marcador comprobados. No acredita coherencia
clínica. Esta fixture no sustituye Lucía ni María y no debe publicarse en un entorno académico.

Navegador: fixture validada y publicada mediante los dos botones, con aviso de auditoría
simulada; después editada, guardada como revisión 4, cerrada y reabierta. La nueva revisión
mostró auditoría/aprobación pendientes y no heredó el candidato aprobado. María mostró sus
gates pendientes y botones bloqueados. HTTP: una sesión sintética creada **deliberadamente
por la prueba de selección**, no por la preview ni por publicar, recuperó la versión publicada
exacta; respuesta limitada a `sessionId`, nombre, edad y sexo. Reiniciar esa selección devolvió
la misma sesión. Sin mensajes ni evaluaciones. Ambas versiones de Lucía/María siguen borrador
y sin sesiones, mensajes, evaluaciones o asignaciones propias. La revisión final verifica la
aplicabilidad pendiente sin confundirla con adherencia no determinable.

## Fichas para revisión clínica real

| | Lucía | María |
|---|---|---|
| Ficha inicial | 42 años, mujer | 67 años, mujer |
| Servicio | Indicación Farmacéutica | Dispensación de continuación |
| Demanda | Molestia de garganta desde ayer | Recoger medicación habitual |
| Tratamiento reservado | Metformina 850 mg oral con desayuno y cena; diabetes tipo 2 | Enalapril 20 mg oral por la mañana; hipertensión, receta sintética vigente |
| Hechos relevantes | Molestia leve, puede beber y respirar, no empeoramiento; temperatura no medida; sin otras medidas salvo agua; desea medida sencilla | Dos omisiones en siete días por cambios de rutina; vive sola; comprende insuficientemente el propósito; no presión arterial disponible |
| Adherencia | Autorreporte 14/14 en siete días; **no adherencia global demostrada**, hábitos no evaluados | Falta de adherencia no intencionada sustentada en omisiones; no inferir RNM manifestado ni inefectividad |
| Intervención propuesta | Explorar PA-SI-T-A-M-A-E y decidir autocuidado/derivación tras valorar criterios específicos | Educación del propósito y recordatorio viable, sin cambiar pauta; registrar incidencia |
| Límite | No diagnosticar etiología ni causalidad con metformina; falta de medición no demuestra normalidad | Vivir sola no acredita ausencia de apoyo; percepción favorable no demuestra seguridad o efectividad completas |

Decisiones clínicas del profesor antes de aprobación:

1. **Lucía:** protocolo específico de síntomas menores, criterios de derivación y autocuidado
   en este contexto, alcance del autorreporte de tomas, aplicabilidad de seguimiento/informe,
   y correspondencia final entre solución, criterios y preguntas. No añadir umbrales universales.
2. **María:** revisar PRM de falta de adherencia y posible falta de conocimiento sin doble
   cómputo, intervención/educación y registro, circunstancias que exigirían derivación,
   aplicabilidad de seguimiento/informe y límites de RNM. No convertir los olvidos en daño demostrado.
3. **Ambos:** revisar posología y medicamento frente a la fuente clínica autorizada, completar
   los campos tipados ausentes y ejecutar la auditoría clínica real. El editor conserva las
   referencias SPFA 2026 ya contrastadas, sin crear nuevos servicios o pesos académicos.

Los cuestionarios de ambos casos y sus referencias permanecen legibles en «Vista docente» y en
las [plantillas](../../lib/cases/v2/teacher-case-draft-templates.ts). Son propuestas de desarrollo,
no casos aprobados ni un conjunto de validación independiente.

## Siguiente trabajo concreto

Preparar el paquete canónico desde secciones estructuradas completas, mostrando los campos
ausentes, y registrar resultados del auditor clínico real sobre ese candidato inmutable.
Después el docente podrá revisar esos resultados y usar las acciones ya implementadas.
No basta insertar un `PASS` en la tabla ni reutilizar la auditoría sintética.

El progreso acreditado y la propuesta de desglose se mantienen exclusivamente en
[PROJECT_STATUS](PROJECT_STATUS.md). M6 64%, M6/M6-E PARTIAL, PED2 abierto y D3B
OPEN / VALIDATION DEBT; sin nueva aceptación académica ni puntos.
