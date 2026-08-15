# 08 — Data Model and Versioning Requirements

Este documento establece los requisitos conceptuales del modelo de datos, versionado, sesiones, estados y migraciones.
Codex debe diseñar el esquema físico final después de auditar la v1.

## 4. Tres vistas de un mismo caso

La implementación debe separar tres representaciones del caso.

## 4.1. `student_public_view`

Puede contener únicamente lo que el estudiante puede conocer antes de la entrevista.

Mínimo:

- case session id;
- nombre;
- edad;
- sexo;
- tratamiento.

No contiene:

- demanda inicial como dato estructurado previo;
- motivo;
- antecedentes;
- contexto;
- ground truth;
- PRM;
- RNM;
- adherencia;
- personalidad;
- rúbrica;
- preguntas correctas;
- respuestas correctas.

La demanda inicial llega como mensaje del paciente.

---

## 4.2. `patient_runtime_view`

Contiene exclusivamente lo necesario para interpretar al paciente:

- ficha pública;
- demanda inicial;
- problemas de salud relevantes;
- antecedentes definidos;
- tratamiento;
- síntomas;
- contexto definido;
- hechos clínicos ocultos;
- personalidad;
- estilo comunicativo;
- reglas de revelación;
- información que puede/no puede revelar;
- respuestas seguras para datos no definidos;
- estado dinámico conversacional.

Debe excluir en lo posible:

- respuesta correcta del cuestionario;
- puntuaciones;
- rúbrica;
- etiquetas académicas que no sean necesarias para representar al paciente.

---

## 4.3. `evaluator_view`

Contiene la solución docente completa:

- SPFA de entrada;
- protocolo y versión;
- tratamiento inicial/continuación cuando aplique;
- requisitos del protocolo;
- elementos críticos;
- PRM;
- RNM;
- adherencia;
- tipo;
- barreras;
- estrategias;
- intervenciones válidas;
- necesidad de derivación;
- necesidad de informe;
- criterios de seguridad;
- rúbrica;
- cuestionario;
- claves de respuesta;
- explicaciones docentes.

---

## 5. Ciclo de vida de los casos

Estados recomendados conceptualmente:

1. `AI_DRAFT`
2. `TEACHER_DRAFT`
3. `IN_REVIEW`
4. `VALIDATED`
5. `PUBLISHED`
6. `ARCHIVED`

No es obligatorio usar exactamente estos nombres técnicos si la arquitectura justifica otros, pero debe existir una semántica única y consistente en base de datos, API y frontend.

## Reglas

- `AI_DRAFT`: generado automáticamente; no disponible a estudiantes.
- `TEACHER_DRAFT`: editado manualmente; no disponible.
- `IN_REVIEW`: preparado para revisión.
- `VALIDATED`: contenido aprobado por docente pero no necesariamente asignado/publicado.
- `PUBLISHED`: disponible para sesiones.
- `ARCHIVED`: no se asigna a nuevas sesiones; sesiones históricas permanecen intactas.

---

## 6. Versionado e inmutabilidad

**CRÍTICO.**

Cada publicación/modificación relevante debe generar una versión.

Una sesión debe estar vinculada a una versión inmutable del caso.

Si el profesor modifica posteriormente:

- ficha;
- personalidad;
- tratamiento;
- protocolo;
- PRM/RNM;
- ground truth;
- rúbrica;
- preguntas;
- prompt;
- reglas de revelación;

las sesiones anteriores no pueden cambiar retrospectivamente.

Cada sesión debe conservar referencia o snapshot suficiente para reproducir:

- versión del caso;
- versión del protocolo;
- versión de la rúbrica;
- versión del prompt del paciente;
- versión del evaluador;
- modelo utilizado;
- parámetros relevantes;
- fecha.

---

## 46. Gestión de sesiones

Estados conceptuales posibles:

- created;
- active;
- finished_interview;
- questionnaire_in_progress;
- completed;
- evaluation_pending;
- teacher_review_required;
- reviewed;
- abandoned;
- technical_failure.

Evitar vocabularios inconsistentes entre esquema y código.

---

## 47. Creación explícita de sesión

Una sesión académica debe crearse cuando el estudiante realiza una acción explícita de comienzo.

No debe crearse una sesión nueva simplemente porque:

- se monta el componente;
- se recarga la página;
- se vuelve atrás;
- React re-renderiza.

Debe poder:

- recuperar una sesión activa;
- evitar duplicados;
- manejar abandono;
- impedir evaluaciones múltiples incoherentes.

---

## 48. Modelo de datos: requisitos conceptuales

Codex debe diseñar el modelo concreto, pero debe soportar como mínimo:

- usuarios;
- roles;
- cursos/grupos si se incorporan;
- casos;
- versiones;
- perfiles de paciente;
- protocolos y versiones;
- requisitos del protocolo;
- ground truth;
- reglas de revelación;
- preguntas;
- opciones;
- claves;
- asignaciones;
- sesiones;
- mensajes;
- snapshots/versiones;
- evaluaciones;
- dimensiones;
- criterios;
- evidencias;
- alertas;
- respuestas al cuestionario;
- revisión docente;
- métricas técnicas;
- costes.

Usar migraciones.

No modificar manualmente el esquema de producción sin migración reproducible.

---

## 58. Estrategia de migración recomendada

## Fase 0. Saneamiento de v1

- auditar repositorio;
- sincronizar esquema/migraciones;
- unificar estados;
- eliminar fuga de ground truth;
- corregir sesiones;
- revisar autorización;
- tests de regresión.

## Fase 1. Infraestructura v2

- versionado;
- protocolos;
- vistas del caso;
- nuevo modelo de datos;
- migraciones.

## Fase 2. Creador de casos

- formularios estructurados;
- generación IA;
- auditoría;
- validación;
- publicación.

## Fase 3. Paciente v2

- demanda inicial;
- personalidad;
- revelación;
- role fidelity;
- seguridad.

## Fase 4. SPFA

- Dispensación;
- Indicación;
- reglas/versionado.

## Fase 5. Adherencia/PRM/RNM/intervención

## Fase 6. Comunicación

## Fase 7. Evaluación con evidencias

## Fase 8. Cuestionario

## Fase 9. Resultados y feedback

## Fase 10. Panel docente

## Fase 11. Seguridad, validación y observabilidad

Cada fase debe tener pruebas y criterios de aceptación antes de pasar a la siguiente.

---

## 61. Decisiones configurables que NO deben hardcodearse

- pesos de las tres dimensiones del desempeño;
- número de preguntas del cuestionario;
- presets de personalidad;
- taxonomías PRM/RNM;
- versiones de protocolos;
- categorías exactas de estrategias;
- umbrales de confianza;
- umbrales de revisión;
- modelos de IA;
- precios/token;
- número de reintentos;
- criterios específicos por problema de salud.

---
