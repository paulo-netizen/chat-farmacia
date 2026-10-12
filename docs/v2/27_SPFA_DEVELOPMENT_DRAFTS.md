# 27 — Visibilidad inicial y dos borradores de desarrollo

Fecha: 2026-10-12. Versión de borradores: `development-draft/1`. Estado: **BORRADOR — REVISIÓN DOCENTE PENDIENTE**. No son casos publicados, paquetes importables validados, ni evidencia independiente. Sin `approvalRef`, pesos nuevos o puntuaciones. Fuente canónica de progreso: [PROJECT_STATUS](PROJECT_STATUS.md); M6 64%, proyecto 51.53%, M6/M6-E PARTIAL, PED2 abierto, D3B OPEN / VALIDATION DEBT.

## Cambio funcional y conservación

La API de creación y recuperación de sesiones aplica una lista positiva: `sessionId` y solo nombre, edad y sexo. Se elimina el tratamiento del chat. El snapshot clínico se conserva íntegro para los consumidores autorizados; el resolver clínico legacy obtiene tratamiento del snapshot, no del DTO público. No hay migraciones, borrado de hechos, reevaluación ni edición de sesiones históricas. Una sesión reanudada también recibe la nueva proyección; esto no puede retirar conocimientos que el estudiante ya vio anteriormente.

El prompt actual incorpora `identity-only/1` mediante `buildPatientChatSystemPromptV3`; V2 se conserva para reconstrucción histórica. Los datos del paciente siguen presentes. El nombre interno legacy `publicProfile` no equivale a permiso de exposición. La instrucción exige preguntas para descubrir medicación, sin bloquear respuestas legítimas. No se ha ejecutado inferencia para certificar este comportamiento.

SPFA ya restringe `PUBLIC_PROFILE` a edad/sexo: los objetivos de medicación requieren evidencia semántica de mensajes del paciente, no se cubren por existir en el caso. Se conservan sin reescritura los contratos y resultados históricos de COV; sus ejemplos no deben reutilizarse como perfiles públicos de estos borradores.

## Contraste SPFA 2026: fuente pendiente

No hay guía 2026 adjunta accesible ni enlace confirmado. La búsqueda oficial devuelve la [guía Foro AF-FC 2024](https://www.farmaceuticos.com/wp-content/uploads/2024/02/GUIA_SPFA_FORO_2024_V15_AC-digital.pdf), que **no se utiliza como sustitución de 2026**. Por tanto no se atribuyen diferencias ni páginas a una edición no leída y no se cambia una versión de protocolo clínico.

| Área | Contrato existente | Contraste que falta con 2026 |
|---|---|---|
| Dispensación | Inicio/continuación y requisitos configurados; información obtenida, no frases exactas | Procedimiento, incidencias y criterios de derivación, con páginas |
| Indicación | Demanda, evolución, medidas previas, medicamentos, situaciones relevantes, derivación | Procedimiento y límites de intervención, con páginas |
| PRM/RNM | Hechos diferenciados de conclusiones; taxonomías y versiones configurables | Categorías/definiciones y distinción entre riesgo y resultado, con páginas |
| Adherencia | Intencionada/no intencionada/otras situaciones configuradas y barreras | Método de evaluación, clasificación y actuación, con páginas |

La decisión docente de visibilidad sí es inequívoca y se aplica ahora. Los dos servicios de entrada son Indicación y Dispensación; seguimiento e informe solo se activan cuando el caso los requiere. No se desarrollan nuevos servicios.

## IF-DEV-01 — Molestia de garganta, sin falta de adherencia

**Origen:** adaptación de los dominios de Indicación del documento 03 y cuestionario del documento 04; hechos sintéticos nuevos. Identidad visible: **Lucía, 42 años, mujer**. Todo lo siguiente queda en la vista docente/paciente autorizada.

**Demanda inicial:** «Desde ayer me molesta la garganta. ¿Qué puedo hacer?». No adelanta su tratamiento ni la solución.

**Hechos definidos y revelación:**

| Fuente interna | Hecho completo | Revelación |
|---|---|---|
| IF-F1 | Molestia leve desde ayer, sin empeoramiento; puede tragar líquidos y respirar con normalidad | Pregunta sobre evolución, intensidad y síntomas |
| IF-F2 | No fiebre medida, no placas observadas, no malestar general; no embarazo, ni alergias conocidas según refiere | Preguntas pertinentes; no inferir otras ausencias |
| IF-F3 | Diabetes tipo 2 conocida; metformina 850 mg por vía oral con desayuno y cena, pauta prescrita estable | Pregunta sobre enfermedades/medicación: «Tomo metformina de 850 con el desayuno y la cena» |
| IF-F4 | En el periodo explorado, última semana, tomó todas las dosis según pauta; describe correctamente cómo la utiliza, sin dificultad ni rechazo | Pregunta de uso real y posibles olvidos; no adelantar etiqueta de adherencia |
| IF-F5 | No tomó medicamentos para esta molestia; solo bebió agua. No otros medicamentos ni productos de autocuidado en este caso | Preguntas sobre acciones previas y tratamiento completo |
| IF-F6 | Quiere una medida sencilla; puede beber líquidos con normalidad | Pregunta sobre preferencias y viabilidad |

Lo no especificado es desconocido: el paciente no inventa exploraciones, valores de glucemia, diagnóstico etiológico ni apoyo familiar. Esta pauta describe a un personaje y requiere revisión farmacológica antes de publicación; no es una recomendación universal.

**Solución docente propuesta:** reconocer Indicación, obtener duración/evolución, datos relevantes de seguridad, patología y tratamiento, actuaciones previas y uso real. Proponer inicialmente autocuidado no farmacológico compatible con lo conocido (por ejemplo hidratación), con explicación de cuándo volver a consultar si empeora. No atribuir etiología viral/bacteriana ni prescribir antibióticos a partir de estos hechos. No se exige seleccionar un medicamento ni una pauta nueva. Como orientación de revisión, el [Consejo General, Punto Farmacológico 191, 2025](https://www.farmaceuticos.com/wp-content/uploads/2025/07/PF-191-La-farmacia-y-el-autocuidado-de-la-salud.pdf) describe explorar síntomas y priorizar medidas no farmacológicas cuando procede; no es la guía SPFA 2026 ni fija el protocolo evaluable de este borrador.

**Criterios aplicables propuestos:** identificar demanda/servicio; obtener IF-F1–F5 antes de concluir; diferenciar uso referido de resultados clínicos; adaptar consejo y comprobar posibilidad de aplicarlo (IF-F6). Adherencia: sin problema descrito en el periodo definido, no garantía indefinida. No PRM ni RNM demostrados por estos hechos. No informe exigible ni episodio longitudinal; la indicación de volver si empeora es un componente de la actuación. El docente debe confirmar seguridad y condiciones concretas de consulta antes de validar.

**Cuestionario docente (respuestas propuestas, nunca visibles antes del cierre):**

| Pregunta | Respuesta y fundamento |
|---|---|
| ¿Servicio inicial? | Indicación: demanda de ayuda por síntoma, no petición de un medicamento concreto |
| ¿Qué tratamiento había que descubrir? | Metformina 850 mg desayuno/cena; IF-F3, requiere pregunta |
| ¿Qué hizo ya para la molestia? | Beber agua, sin medicamentos para ella; IF-F5 |
| ¿Hay falta de adherencia? | No descrita en la última semana; IF-F4, sin extrapolar al resto de su vida |
| ¿Tipo/barrera de falta de adherencia? | No aplicable en este caso, no inventar barreras |
| ¿PRM/RNM demostrado? | No; ni el síntoma ni la diabetes aislados demuestran un problema de la farmacoterapia |
| ¿Actuación propuesta? | Autocuidado no farmacológico tras explorar; justificar seguridad y condiciones de consulta según protocolo revisado |
| ¿Informe/seguimiento longitudinal? | No exigibles en este borrador; no crear otro servicio |

## DIS-DEV-01 — Continuación con olvidos

**Origen:** adaptación de María y la barrera de olvidos de `db/seed.sql`; no se importa ni cambia ese registro histórico. Identidad visible: **María, 67 años, mujer**. Se convierte la demanda de entrada en Dispensación de continuación; se mantiene el problema de uso para descubrirlo.

**Demanda inicial:** «Vengo a recoger mi medicación habitual». No enumera el tratamiento automáticamente.

| Fuente interna | Hecho completo | Revelación |
|---|---|---|
| DIS-F1 | Hipertensión conocida desde hace ocho años. Enalapril 20 mg oral, una vez al día por la mañana, prescripción habitual | Pregunta sobre qué medicamento necesita y cómo está prescrito |
| DIS-F2 | No es un tratamiento de inicio; lo utiliza desde hace años, sin cambio de pauta reciente | Pregunta sobre inicio/continuación y cambios |
| DIS-F3 | En la última semana omitió dos tomas por olvido al cambiar la rutina; no desea abandonar el medicamento | Preguntas sobre uso real, olvidos y motivos |
| DIS-F4 | Vive sola, rutinas variables; cree que la medicación es importante pero no tiene claro para qué sirve | Preguntas sobre comprensión y circunstancias; no adelantar barrera docente |
| DIS-F5 | No refiere reacciones adversas, otros medicamentos ni alergias conocidas en este caso. No hay mediciones actuales de presión ni datos de daño clínico | Preguntas pertinentes; no inventar control tensional ni ausencia de todos los riesgos |
| DIS-F6 | Puede usar una alarma del móvil y acepta probar un recordatorio asociado a una rutina elegida con ella | Tras propuesta y comprobación concreta, nunca como dato inicial |

**Ejemplo de revelación:** estudiante: «¿Qué toma y cómo lo está tomando realmente?»; paciente: «Enalapril de 20, por la mañana. Esta semana se me olvidó dos veces». Otras formulaciones pertinentes también habilitan estos hechos. Ante preguntas sobre medidas que desconoce contesta que no dispone de ellas.

**Solución docente propuesta:** identificar Dispensación de continuación, contrastar pauta y uso, detectar falta de adherencia no intencionada y su barrera, explorar comprensión y acordar una ayuda viable. No modificar dosis ni afirmar fracaso terapéutico/RNM manifestado sin datos. La dificultad de uso es un problema identificado; su codificación PRM/RNM debe vincularse al catálogo aprobado, no crearse una categoría nueva. La decisión de dispensar exige las comprobaciones del protocolo vigente; estos datos narrativos no sustituyen la verificación de la prescripción. No convertir el recordatorio en un servicio longitudinal nuevo.

**Criterios aplicables propuestos:** obtención de DIS-F1–F5, reconocimiento de continuación y discrepancia pauta/uso, explicación comprensible del propósito, propuesta vinculada a olvidos/rutina y comprobación DIS-F6. No exigir aceptación para acreditar personalización, ni atribuir control de presión por aceptar una alarma. No informe exigible; cualquier seguimiento posterior queda condicionado a configuración docente explícita, sin resultados longitudinales exigidos.

**Cuestionario docente (respuestas propuestas):**

| Pregunta | Respuesta y fundamento |
|---|---|
| ¿Servicio inicial? | Dispensación: solicita recoger medicación habitual |
| ¿Inicio o continuación? | Continuación, DIS-F2 |
| ¿Pauta frente a uso? | Prescrita diaria por la mañana; dos omisiones en última semana, DIS-F1/F3 |
| ¿Hay falta de adherencia? | Sí, no intencionada: olvidos, sin decisión de abandonar |
| ¿Barrera principal? | Rutina variable/olvido; explorar además comprensión, DIS-F4 |
| ¿PRM/RNM? | Problema de uso identificado; no RNM manifestado demostrado. Selección de códigos pendiente del catálogo docente, sin inventar categoría |
| ¿Intervención coherente? | Explicación y recordatorio acordado con viabilidad comprobada; no cambiar dosis |
| ¿Derivación/informe/seguimiento? | No exigidos automáticamente por el olvido; aplicar condiciones autorizadas del caso. No afirmar que nunca necesitará derivación |

## Siguiente entrega concreta: creación y previsualización docente

1. Incorporar la guía exacta y registrar edición/páginas; resolver únicamente diferencias reales, versionando protocolo/catálogos mediante mecanismos existentes.
2. Revisar estos hechos, solución y aplicabilidad; vincular cada criterio y pregunta a identificadores estables del protocolo/taxonomías aprobados. Ningún peso nuevo.
3. Convertir los borradores legibles en bundles validados del editor, con estado de borrador explícito. La ruta legacy de creación tiene un valor por defecto de aprobación: no se debe usar para cargar estos materiales automáticamente.
4. Previsualización autorizada con dos vistas separadas: estudiante (solo identidad) y docente (hechos, revelaciones, solución y cuestionario); guardar/reabrir versión borrador y ejecutar conversación simulada de revelación, sin publicación automática.
5. Solo tras revisión docente explícita tramitar publicación; no acreditar M6 por disponer de estos documentos.

## Verificación de esta entrega

- Selección inicial: 288/288 (DTO, proyecciones legacy/v2, creación/recuperación de sesiones, conservación clínica, prompt y baseline SPFA).
- Dos expectativas antiguas detectadas por la primera suite se actualizaron: etiqueta de tratamiento visible y prompt V2 en el generador actual. Regresiones afectadas: 30/30.
- Suite offline final: **3815 PASS / 67 SKIPPED**, con gates live/PostgreSQL desactivados. TypeScript: PASS. `git diff --check`: PASS.
- Lint no ejecutado hasta análisis: `next lint --no-cache` solicita configurar ESLint; no se ha configurado ni cambiado dependencias.
- Sin llamadas de modelo, conteos, conexiones DB, despliegues ni carga de borradores. La evidencia anterior de COV no se mezcla con esta verificación.
