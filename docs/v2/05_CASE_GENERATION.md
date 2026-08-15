# 05 — AI Case Generation

Este documento define la generación asistida por IA, la auditoría automática, la revisión docente y las condiciones de publicación de un caso.
La IA generadora propone; el profesor valida.

## 22. Generación asistida de casos

El profesor debe poder elegir:

- crear manualmente;
- generar borrador con IA.

La generación con IA debe producir un **paquete docente completo**.

## 22.1. Contenido del paquete

- título interno;
- descripción docente;
- ficha pública;
- demanda inicial;
- problemas de salud;
- antecedentes;
- tratamiento;
- contexto;
- personalidad;
- estilo comunicativo;
- reglas de revelación;
- SPFA inicial;
- subtipo de protocolo;
- requisitos del protocolo;
- PRM;
- RNM;
- adherencia;
- tipo;
- barreras;
- estrategia;
- intervenciones aceptables;
- intervenciones incorrectas relevantes;
- derivación;
- informe;
- seguimiento;
- riesgos/puntos críticos;
- ground truth;
- rúbrica;
- cuestionario post-caso;
- explicaciones de respuestas;
- tests automáticos del caso.

---

## 23. Realismo de los borradores IA

Antes de aceptar un borrador, la IA auditora debe comprobar:

## 23.1. Coherencia farmacológica

- cada medicamento tiene una indicación plausible;
- dosis y pauta son plausibles;
- vía y forma farmacéutica son plausibles;
- duración es coherente cuando aplica;
- edad/contexto no contradicen de forma evidente el tratamiento;
- un error farmacológico solo existe si es deliberado.

## 23.2. Contexto español

Priorizar:

- medicamentos utilizados/autorizados en España;
- práctica de farmacia comunitaria española;
- problemas de salud frecuentes;
- nomenclatura profesional española;
- español de España.

Debe existir una vía técnica para contrastar medicamentos frente a CIMA/AEMPS durante creación/auditoría o validación docente.

## 23.3. Dificultad

La dificultad debe depender de factores definidos, no de una etiqueta arbitraria.

Ejemplos:

- cantidad de información oculta;
- coexistencia de varias barreras;
- personalidad;
- umbral de revelación;
- necesidad de derivación;
- presencia de varios PRM;
- ambivalencia;
- información aparentemente contradictoria programada.

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

## 55. Pruebas clínicas de casos generados

Antes de publicación:

- problema–tratamiento coherente;
- medicamentos plausibles en España;
- pauta plausible;
- ausencia de interacciones/contraindicaciones accidentales críticas;
- PRM deliberados identificados;
- RNM coherente;
- adherencia coherente;
- barreras coherentes;
- intervención coherente;
- derivación coherente;
- cuestionario coherente.

La auditoría puede emitir warnings cuando requiera juicio docente.

---
