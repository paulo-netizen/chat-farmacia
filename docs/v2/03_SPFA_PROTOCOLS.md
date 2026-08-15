# 03 — SPFA Protocols

Este documento define la arquitectura clínica de los SPFA de entrada, su transición hacia otros servicios, la evaluación de PRM/RNM, adherencia, estrategias, intervenciones y derivación.
Los contenidos concretos de cada protocolo deben versionarse y quedar configurables.

## 13. SPFA de entrada

Los casos v2 deben poder comenzar al menos mediante:

1. Dispensación;
2. Indicación Farmacéutica.

El alumno no recibe la etiqueta del servicio antes de la entrevista.

Debe reconocerlo por la demanda.

La arquitectura debe permitir ampliar posteriormente a otros SPFA sin rediseñar el sistema.

---

## 14. Módulo de Dispensación

Debe diferenciar como mínimo:

- tratamiento de inicio;
- tratamiento de continuación.

La especificación detallada de los elementos evaluables debe almacenarse en una versión de protocolo, no hardcodearse de forma dispersa por el frontend.

El evaluador debe comprobar si el estudiante obtuvo la información necesaria, no si formuló una frase concreta.

Si el paciente ya aportó espontáneamente un dato, el estudiante no tiene que volver a preguntarlo para obtener puntuación.

Cada requisito del protocolo debe poder marcarse:

- crítico;
- relevante;
- opcional;
- no aplicable.

Los elementos concretos se definirán en `03_SPFA_PROTOCOLS.md` y en la configuración/versionado del protocolo.

---

## 15. Módulo de Indicación Farmacéutica

La evaluación se realizará por dominios de información y seguridad.

Debe poder representar:

- demanda por problema de salud;
- duración/evolución;
- acciones previas;
- medicamentos utilizados;
- alergias/intolerancias cuando proceda;
- enfermedades/situaciones especiales relevantes;
- criterios generales y específicos de derivación;
- posibilidad de intervención desde la farmacia;
- derivación;
- detección de otras necesidades/SPFA.

No se debe evaluar por «número exacto de preguntas» ni por coincidencia literal.

El sistema debe reconocer información ya aportada espontáneamente.

---

## 16. Transición entre SPFA

Una conversación puede comenzar en un servicio y detectar la necesidad de otro.

Ejemplos válidos:

- Dispensación → Adherencia Terapéutica.
- Indicación → detección de PRM → Adherencia Terapéutica.
- Indicación → recomendación de medicamento → actuación asociada a su correcta utilización.
- Dispensación → problema de seguridad → derivación.

El sistema debe evaluar la actuación como un recorrido asistencial integrado, no como tres chats independientes.

---

## 17. PRM y RNM

El modelo de casos debe permitir registrar explícitamente:

- existencia o ausencia de PRM;
- uno o varios PRM;
- existencia o ausencia de RNM;
- RNM manifestado;
- riesgo de RNM, cuando la taxonomía/protocolo empleado lo contemple;
- relación causal esperada;
- evidencias del caso.

Las taxonomías deben:

- estar versionadas;
- ser editables/actualizables por configuración;
- no depender de strings dispersos en código;
- utilizar la terminología que se valide para el protocolo seleccionado.

El alumno puede expresar conceptos con sinónimos; la evaluación no puede limitarse a igualdad textual.

---

## 18. Adherencia terapéutica

Cuando aplique, el caso debe definir:

- adherente / no adherente / no determinable;
- tipo de falta de adherencia;
- barrera principal;
- barreras secundarias;
- evidencia factual;
- información necesaria para detectarla;
- estrategia de intervención;
- intervenciones aceptables;
- intervenciones inadecuadas;
- necesidad de seguimiento;
- necesidad de derivación.

Tipos iniciales:

- intencionada;
- no intencionada;
- combinada.

La arquitectura debe permitir actualizar estas categorías si se modifica el marco docente.

---

## 19. Estrategia de intervención vs intervención concreta

Deben ser conceptos separados.

## 19.1. Estrategia

Categorías iniciales propuestas:

- educativa/informativa;
- conductual;
- técnica;
- organizativa;
- motivacional;
- apoyo social/familiar;
- coordinación con otros profesionales;
- combinada.

**CONFIGURABLE.**

## 19.2. Intervención concreta

Es lo que el farmacéutico propone o realiza realmente.

Debe evaluarse según:

- adecuación a la barrera;
- personalización;
- viabilidad;
- aceptación por el paciente;
- seguridad;
- priorización;
- seguimiento;
- coordinación/derivación cuando proceda.

Una intervención genéricamente correcta no debe obtener puntuación máxima si no está adaptada al paciente.

---

## 20. Derivación e informe

Cada caso debe poder definir:

- no requiere derivación;
- derivación no urgente;
- derivación urgente;
- profesional de destino;
- motivo;
- información que debe transmitirse;
- necesidad o conveniencia de informe;
- contenido mínimo esperado del informe.

La IA evaluadora no decide libremente si «debería» existir informe: compara la actuación con el ground truth validado por el profesor.

---

## 30. Requisitos críticos, relevantes y no aplicables

Cada caso/protocolo debe permitir clasificar requisitos como:

- `CRITICAL`
- `RELEVANT`
- `OPTIONAL`
- `NOT_APPLICABLE`

Un criterio crítico omitido puede:

- reducir fuertemente la puntuación;
- generar alerta;
- activar revisión docente si implica seguridad.

No todos los elementos tienen el mismo peso.

---
