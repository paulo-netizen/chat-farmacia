# 06 — Teacher Workflow

Este documento define el flujo del profesor: creación, generación IA, revisión, edición, previsualización, validación, publicación y revisión de evaluaciones.

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

## 24. Interfaz del profesor para creación/edición

El profesor no debe editar JSON salvo en un modo técnico opcional.

Debe existir una interfaz estructurada con secciones.

Propuesta:

1. Identificación del caso.
2. Ficha pública.
3. Demanda inicial.
4. Problemas de salud y antecedentes.
5. Tratamiento.
6. Contexto.
7. Personalidad.
8. Reglas de revelación.
9. SPFA/protocolo.
10. PRM/RNM.
11. Adherencia.
12. Estrategia/intervención.
13. Derivación/informe.
14. Rúbrica.
15. Cuestionario.
16. Pruebas automáticas.
17. Previsualización.
18. Validación/publicación.

---

## 25. Previsualización docente

Debe existir un modo de prueba separado de las sesiones académicas.

El profesor puede conversar con el paciente antes de publicar.

Estas pruebas:

- no cuentan como intento del alumno;
- no contaminan estadísticas académicas;
- no aparecen como sesión estudiantil;
- pueden reiniciarse;
- deben permitir visualizar internamente qué información se está revelando.

---

## 26. Auditoría automática previa a publicación

Antes de permitir publicación se ejecutan pruebas automáticas.

Resultado visible al profesor, por ejemplo:

- fidelidad al personaje;
- resistencia a prompt injection;
- ausencia de filtración de ground truth;
- consistencia farmacológica;
- consistencia longitudinal;
- manejo de datos no definidos;
- coherencia PRM/RNM;
- coherencia adherencia–barrera;
- coherencia intervención;
- coherencia cuestionario;
- campos clínicos obligatorios completos.

La herramienta debe distinguir:

- PASS;
- WARNING;
- FAIL.

Los fallos críticos impiden publicación hasta revisión/corrección.

---

## 44. Panel del profesor

Debe permitir consultar:

- estudiante;
- caso;
- versión del caso;
- fecha;
- duración;
- número de turnos;
- transcripción;
- respuestas finales;
- cuestionario;
- nota global;
- notas por dimensiones;
- desglose por criterios;
- evidencias;
- confianza;
- alertas;
- feedback;
- consumo/tokens/coste;
- estado de revisión;
- posible nota corregida por profesor;
- motivo de corrección.

---

## 45. Revisión docente de evaluaciones

El profesor debe poder:

- aceptar evaluación;
- corregir puntuación;
- corregir un criterio;
- añadir comentario;
- marcar falso positivo de seguridad;
- marcar fallo del evaluador;
- registrar motivo de cambio.

Conservar:

- nota automática original;
- nota revisada;
- autor;
- fecha;
- motivo.

No sobrescribir silenciosamente la evaluación automática.

---
