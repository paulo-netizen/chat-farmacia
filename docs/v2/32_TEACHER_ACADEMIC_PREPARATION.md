# Preparación y auditoría de Lucía y María — 16 de octubre de 2026

Base: `7f78a0e90f69805fd0b8b1ae696ab2d7d620916a`. Complementa el
[editor](28_TEACHER_DRAFT_EDITOR_SPFA_2026.md), la [prueba paciente](30_TEACHER_PATIENT_PREVIEW.md)
y la [revisión/publicación](31_TEACHER_REVIEW_PUBLICATION.md). Son casos de desarrollo;
ninguno está aprobado ni publicado académicamente.

## Recorrido entregado y límite

Desde `/profesor/casos/borradores`: abrir Lucía o María → **Revisión y publicación** →
seleccionar la ficha comparativa pertinente → **Preparar y comprobar fuentes**.
Se conserva un expediente inmutable de la revisión guardada: hechos, proyección paciente,
ficha inicial estudiante (solo nombre, edad y sexo), referencia SPFA 2026, requisitos,
solución y preguntas/respuestas con referencias. Se recupera en la misma vista/servicio
de revisión y publicación, sin sustituir los dos casos por paquetes de pruebas.

**Solicitar juicio del auditor** requiere autorización privada del servidor vinculada al
expediente. Las dos solicitudes autorizadas de esta entrega se han ejecutado desde el editor;
no se habilita gasto general a cualquier docente. El resultado estructurado se conserva y se
muestra con hallazgos y propuestas, sin aplicarlos automáticamente. Una edición crea otra
revisión y no hereda esta preparación ni su auditoría. Las anteriores siguen conservadas.

**No se ha construido todavía un `GENERATED_CASE_BUNDLE_V2` ejecutable para estos casos.**
El expediente `teacher-academic-preparation/1` localiza los campos que faltan; no es una
conversión completa al formato nativo. Ambos casos llegan al mecanismo existente de revisión,
pero todavía no a su registro de candidatos publicables. Validar y publicar permanecen
bloqueados en servidor y UI. No se ha simulado un PASS para franquear ese límite.

| Pendiente | Motivo y resolución necesaria |
|---|---|
| Perfil comunicativo tipado | No deducir personalidad de vivir sola o de los olvidos; completar explícitamente los campos exigidos por el modelo paciente. |
| RNM no determinable | El contrato nativo actual exige `no_rnm`, riesgo o RNM. La información de ambos borradores no acredita ausencia de RNM. Es necesaria una representación versionada de incertidumbre, no cambiar la solución para encajar. |
| Decisión de derivación | El contrato nativo es binario; Lucía requiere protocolo específico y ambos requieren decisión docente contextualizada. |
| Mapeo de taxonomías/protocolo | La referencia a páginas y requisitos textuales no equivale al protocolo ejecutable y sus relaciones tipadas aprobadas. |
| Cuestionario | Conservar las preguntas abiertas propuestas; no inventar opciones de respuesta única para satisfacer el contrato existente. M8 no se implementa aquí. |

Estas limitaciones requieren completar autoría/representación y revisión clínica. No son
motivo para inventar hechos, convertir «desconocido» en «negativo» o modificar COV.

## Cuatro comprobaciones distintas

| Capa | Resultado conservado | Alcance |
|---|---|---|
| Estructura | PASS para ambos expedientes | Esquema, referencias, proyecciones y revisión; no valida un bundle nativo inexistente. |
| Fuentes | CIMA AVAILABLE para ambos | HTTPS con verificación explícita de certificado, URL cerrada, fecha, SHA-256, extracto y marca de truncamiento. No declara adecuación individual. |
| Juicio del auditor | Dos respuestas técnicamente válidas, `teacher-clinical-auditor/1` | Doce dimensiones exactas y referencias elegibles; significado clínico sujeto a revisión humana. |
| Aprobación docente | PENDING | Ninguna aprobación, publicación, asignación o intento estudiantil creado. |

Las fuentes son [metformina 850 mg, CIMA 68167](https://cima.aemps.es/cima/dochtml/ft/68167/FichaTecnica_68167.html)
y [enalapril 20 mg, CIMA 63355](https://cima.aemps.es/cima/dochtml/ft/63355/FT_63355.html).
Son referencias comparativas; **no atribuyen esas marcas al paciente**. Se recuperaron de nuevo
con TLS estricto al detectar que la inicialización legacy de DB desactiva la verificación
global. El transporte nuevo la fuerza expresamente sin modificar ese módulo legacy.
El extracto de enalapril alcanza el límite de 24.000 caracteres y está marcado como truncado.
No se afirma revisión exhaustiva de la ficha ni de todas las interacciones/contraindicaciones.

La guía SPFA 2026 aportada ya fue contrastada en la entrega 28: PRM/RNM pp. 33–37,
Dispensación pp. 40–48, Indicación pp. 51–56 y Adherencia pp. 80–82.
Esta entrega conserva esa procedencia y no inventa nuevos protocolos o servicios.
El auditor recibe esos requisitos/referencias y extractos CIMA, **no el PDF completo de la guía**.

## Resultado real del auditor

Revisiones guardadas utilizadas: Lucía v3 y María v2 de la demostración docente, con sus
hechos originales; los títulos editados previamente se han conservado. La procedencia exacta,
identificadores de revisión/preparación, hashes y uso están en los registros privados.

| Dimensión | Lucía | María |
|---|---|---|
| Problema y tratamiento | INSUFFICIENT | PASS |
| Pauta | PASS | PASS |
| Contexto | PASS | PASS |
| PRM | PASS | WARNING |
| RNM | INSUFFICIENT | PASS |
| Adherencia y barrera | PASS | PASS |
| Barrera y estrategia | PASS | PASS |
| Intervención | INSUFFICIENT | PASS |
| Derivación | INSUFFICIENT | WARNING |
| Coherencia interna | PASS | WARNING |
| Adecuación a España | INSUFFICIENT | WARNING |
| Cuestionario | WARNING | WARNING |

Lucía: 6 PASS, 5 INSUFFICIENT, 1 WARNING. María: 7 PASS, 5 WARNING.
Esto describe los juicios recibidos, **no doce criterios académicos superados**. No hay una
referencia clínica aprobada contra la que calcular precisión del auditor.
Un PASS de pauta expresa consistencia de la pauta descrita, no certificación de seguridad
individual. El PASS de RNM en María reconoce la prudencia de «no determinable», no ausencia de RNM.

Hallazgos principales: protocolo de garganta e intervención/derivación sin cerrar en Lucía;
mapeo PRM y decisión de derivación pendientes en María; representación nativa de incertidumbre
y revisión de preguntas pendientes en ambos. El auditor no añade diagnósticos ni daño.
La mención de viabilidad de recordatorios en María se apoya en la disponibilidad **condicional**
del hecho F6: no acredita que un estudiante ya haya propuesto, comprobado o conseguido esa
intervención. Esta precisión debe conservarse al revisar el juicio del auditor.

## Fichas de decisión para Paulo

### Lucía — Indicación Farmacéutica

**Inicial visible:** Lucía, 42 años, mujer. **Demanda del paciente:** «Desde ayer me molesta
la garganta. ¿Qué puedo hacer?». El tratamiento se revela solo al preguntar.

| Hecho reservado | Contenido y límite |
|---|---|
| F1 | Molestia leve desde ayer, estable; bebe y respira con normalidad. |
| F2 | No ha observado fiebre ni placas, no ha medido temperatura; sin malestar, dificultad respiratoria o para beber referidos. No embarazo/lactancia; sin alergias o intolerancias conocidas según refiere. No inferir otras ausencias. |
| F3 | Diabetes tipo 2; metformina 850 mg oral con desayuno y cena, prescrita y estable. |
| F4 | Refiere 14/14 tomas en siete días. Sin diario, recuento, dispensaciones ni cuestionario validado; hábitos no evaluados. |
| F5 | Solo bebió agua para la molestia; no otros medicamentos o productos en este caso. |
| F6 | Quiere una medida sencilla y puede beber líquidos. |
| F7 | Consulta para sí misma; sin glucemias ni evaluación médica de esta molestia. No etiología ni causalidad farmacológica acreditadas. |

**Solución propuesta:** explorar PA-SI-T-A-M-A-E, uso de medicación y condiciones relevantes;
justificar qué puede concluirse y qué falta. Autocuidado no farmacológico es una alternativa
pendiente de protocolo y revisión, no una recomendación ya aprobada para este contexto.
No atribuir la molestia a metformina ni afirmar etiología viral/bacteriana. No se configura
antibiótico ni una pauta nueva.

**Derivación:** decisión todavía no determinada. Paulo debe seleccionar el protocolo específico
de garganta, sus criterios/umbrales y el manejo de diabetes en ese protocolo. La guía general
SPFA no basta para inventarlos. La capacidad de beber/respirar y la evolución son información
para esa decisión, no un descarte universal de derivación.

**Aplicabilidad:** entrevista, valoración/derivación, uso referido y personalización son
requisitos propuestos. Informe y resultados longitudinales no se exigen por defecto.
Adherencia global **no determinable**; tipo/barrera de falta de adherencia no aplicables sin
problema identificado. PRM/RNM no demostrados, sin convertirlo en ausencia confirmada.

| Pregunta | Respuesta propuesta y justificación |
|---|---|
| ¿Servicio de entrada? | Indicación: solicita solución para una molestia; F1, F7. |
| ¿Tratamiento a descubrir? | Metformina 850 mg oral desayuno/cena, oculto al inicio; F3. |
| ¿Adherencia demostrada? | No globalmente: 14/14 autorreferidas en siete días con límites; F4. |
| ¿Tipo y barrera? | No aplicables sin falta identificada; no inventarlas; F4. |
| ¿PRM/RNM demostrado? | No demostrado; síntoma sin causalidad acreditada, sin parámetros de resultado; F1, F3, F7. |
| ¿Actuación? | Valorar derivación y límites; autocuidado pendiente de protocolo específico, sin diagnóstico etiológico ni antibiótico configurado; F1, F2, F7. |

**Decisiones imprescindibles:** protocolo de garganta; intervención aceptable y motivos de
derivación; correspondencia final entre solución, requisitos y preguntas; representación de
incertidumbre y perfil del personaje. No se propone completar hechos retrospectivamente.

### María — Dispensación de continuación

**Inicial visible:** María, 67 años, mujer. **Demanda:** recoger su medicación habitual.
El estudiante debe descubrir qué toma, cómo lo usa y los olvidos.

| Hecho reservado | Contenido y límite |
|---|---|
| F1 | Hipertensión desde hace ocho años; enalapril 20 mg oral cada mañana. |
| F2 | Tratamiento de continuación, conocido y estable desde hace años, sin cambios de dosis. |
| F3 | Dos dosis omitidas en los últimos siete días por olvido asociado a cambios de rutina, no abandono voluntario. |
| F4 | Vive sola y no comprende bien el propósito del medicamento; no inferir falta de apoyo, personalidad ni daño. |
| F5 | Sin reacciones adversas, otros medicamentos ni alergias conocidas referidos; sin presión arterial actual ni datos de daño clínico. |
| F6 | Puede usar alarma y recordatorio asociado a una rutina elegida con ella; acepta después de propuesta y comprobación de viabilidad. No inventar la rutina elegida. |
| F7 | Consulta para sí misma, receta sintética vigente, sin cambios recientes; sentirse igual y no notar molestias no acredita control, seguridad o efectividad completos. |

**Solución propuesta:** verificar Dispensación de continuación, pauta/uso real, percepción e
incidencias. Explorar olvidos, comprensión y contexto; educación del propósito y recordatorio
adaptado con viabilidad comprobada, sin cambiar dosis. Registrar incidencia y actuación;
no afirmar que ya se ha conseguido adherencia o mejorado la presión arterial.

**Adherencia/PRM/RNM:** falta no intencionada sustentada en omisiones y barrera práctica.
Propuesta de PRM por no toma/falta de adherencia; valorar conocimiento insuficiente sin
doble cómputo ni convertir vivir sola en PRM. RNM manifestado **no determinable**: no hay
presión arterial ni daño documentado. La fuente CIMA contextualiza el medicamento, pero no
certifica la adecuación individual de esta pauta.

**Derivación:** falta explicitar decisión y criterios aplicables. No exigir informe sin
derivación configurada ni inferir «nunca derivar». Seguimiento/informe condicionados al caso;
sin nuevo servicio ni resultados longitudinales exigidos.

| Pregunta | Respuesta propuesta y justificación |
|---|---|
| ¿Servicio y subtipo? | Dispensación de continuación para sí misma; F2, F7. |
| ¿Pauta frente a uso? | 20 mg cada mañana; dos omisiones en siete días; F1, F3. |
| ¿Falta de adherencia y barrera? | No intencionada, olvidos/cambios de rutina, barrera práctica; F3, F4. |
| ¿PRM? | No toma/falta de adherencia; valorar conocimiento, sin atribuir PRM a vivir sola; F3, F4. |
| ¿RNM manifestado? | No determinable, sin presión arterial ni daño documentado; F5, F7. |
| ¿Intervención? | Educación del propósito y recordatorio adaptado, comprobando viabilidad; sin modificar pauta; F4, F6. |
| ¿Seguimiento/informe? | Registrar incidencia y actuación; no informe ni resultado longitudinal por defecto; F3, F6. |

**Decisiones imprescindibles:** confirmar mapeo PRM y tratamiento del conocimiento insuficiente;
actuaciones aceptables, comprensión/viabilidad y registro; decisión/criterios de derivación;
límites RNM, preguntas y perfil comunicativo. Nada de esto queda aprobado por el auditor IA.

## Uso y presupuesto

Dos conteos oficiales y dos inferencias, una por expediente, sin reintentos/fallback.
`gpt-5.6-terra`, medium, Standard/global, `store:false`, máximo 8.000 tokens de salida
incluido razonamiento, timeout 60 s. No calibraciones COV ni conversaciones nuevas.

| Caso | Entrada contada/utilizada | Salida | Lectura / escritura caché | Coste calculable USD | Reserva USD |
|---|---:|---:|---:|---:|---:|
| Lucía | 7325 | 2897 | 0 / 7322 | 0.053075 | 0.114313 |
| María | 9115 | 2001 | 0 / 9112 | 0.046798 | 0.118788 |
| Nuevo | 16440 | 4898 | 0 / 16434 | **0.099873** | **0.233101** |

Acumulado conservado: **0.3457322 USD calculables**, **3.053625 USD reservados** y
**60 conteos de coste desconocido** (58 anteriores + 2). No solicitudes nuevas inciertas.
Las reservas no son cargos adicionales. No se conoce el total facturado ni se considera cero
el coste de conteo. Se conserva el techo interno de reservas de 4 USD y la autorización
acumulada de 15 EUR con aceptación de esa incertidumbre; no se promete un máximo facturado
garantizado. La referencia de cambio/márgenes de la entrega 31 se mantiene como histórica.

[Tarifas oficiales](https://developers.openai.com/api/docs/pricing) y
[modelo](https://developers.openai.com/api/docs/models/gpt-5.6-terra), comprobados 16-10-2026:
2 USD/M entrada ordinaria, 0.20 lectura, 2.50 escritura de caché y 12 salida.
Reserva `ceil(conteo × 2.5 + 8000 × 12)` microUSD previa al envío; conteo vinculado a
instrucciones, entrada y esquema exactos. Diarios/autorizaciones privados, hashes de históricos,
lock exclusivo y bloqueo de duplicados. Uso e identificadores se conservan incluso ante fallo
de parseo; no se guardan respuestas raw ni errores arbitrarios del proveedor.

## Verificación y pendientes

- 31/31 pruebas focalizadas offline nuevas: preparación, fuentes, TLS, permisos HTTP,
  presupuesto/reserva, duplicados, concurrencia, timeout, parseo seguro, uso y aislamiento asíncrono.
- PostgreSQL desechable verificado: 6/6 preparación/auditoría, incluyendo ambos borradores,
  permisos reales, edición concurrente, revocación, recuperación, inmutabilidad y ausencia de
  sesiones/asignaciones. Regresión de publicación previa de esta entrega: 7/7.
- Suite offline final: **3909 PASS / 86 SKIPPED**, ejecutada una vez con live/DB desactivados.
  TypeScript PASS. Lint sigue pendiente de configuración del repositorio; no se configura aquí.
- Navegador: expedientes reales de desarrollo recuperados; fuentes y juicios visibles en la
  revisión exacta; validación/publicación bloqueadas. No se usaron paquetes sintéticos como
  sustitutos de Lucía/María. Las pruebas de publicación sintética de la entrega 31 son históricas.
- Migraciones aditivas 0007/0008 solo en entorno desechable. Sin despliegue ni cambios en base
  productiva. Los nueve archivos COV preexistentes se preservan fuera del commit.

Siguiente trabajo: completar los campos de autoría nativa y la representación versionada de
incertidumbre, incorporar el protocolo clínico específico elegido por Paulo, revisar las dos
soluciones/cuestionarios y volver a auditar **las nuevas revisiones** antes de aprobarlas.
No volver a ejecutar por defecto los expedientes ya auditados ni sustituir incertidumbre por PASS.
El [desglose propuesto de progreso](PROJECT_STATUS.md#propuesta-de-desglose-m1m3--pendiente-de-aprobación-sin-acreditar)
es explícito y no se acredita automáticamente: M6 64%, proyecto 51.53%, M6/M6-E PARTIAL,
PED2 abierto, perfiles productivos no aprobados y D3B OPEN / VALIDATION DEBT.
