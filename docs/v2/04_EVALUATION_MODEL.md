# 04 — Evaluation Model

Este documento define las dos capas de evaluación: desempeño durante la entrevista y comprensión del caso mediante cuestionario.
Toda puntuación automatizada debe ser trazable a evidencia y revisable por el profesor.

## 28. RESULTADO 1: desempeño durante la entrevista

Debe existir una **nota global de desempeño**, pero además deben mostrarse siempre las notas por dimensiones.

## 28.1. Puntuaciones obligatorias visibles

- **Aplicación del protocolo SPFA adecuado: 0–100**
- **Detección de PRM, adherencia e intervención farmacéutica: 0–100**
- **Comunicación farmacéutico-paciente: 0–100**
- **Desempeño global: 0–100**

Los nombres de las dimensiones deben mantenerse conceptualmente aunque el texto de interfaz pueda ajustarse posteriormente.

## 28.2. Ponderación global inicial

Propuesta provisional:

- protocolo SPFA: 35 %;
- PRM/adherencia/intervención: 35 %;
- comunicación: 30 %.

**PROVISIONAL / CONFIGURABLE.**

No hardcodear de forma que sea difícil modificarlo.

---

## 29. Dimensión 1: protocolo SPFA

La rúbrica depende del SPFA de entrada.

Debe valorar:

- reconocimiento implícito de la demanda mediante la actuación;
- obtención de información necesaria;
- cobertura de dominios esenciales;
- identificación de criterios de derivación;
- actuación segura;
- adecuación al subtipo inicio/continuación cuando corresponda;
- integración con otros SPFA.

## Regla fundamental

Se evalúa **información cubierta**, no «preguntas literales realizadas».

Si el paciente ya dijo:

> «Soy yo y llevo tres días con tos.»

el estudiante ya dispone de identidad del paciente y duración.

No debe penalizarse por no volver a preguntar.

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

## 31. Dimensión 2: PRM, adherencia e intervención

Debe poder desglosarse internamente en:

1. detección de PRM;
2. identificación/interpretación de RNM cuando aplique;
3. detección de falta de adherencia;
4. clasificación del tipo;
5. identificación de barrera principal;
6. identificación de barreras secundarias;
7. estrategia de intervención;
8. intervención concreta;
9. personalización;
10. seguridad;
11. derivación;
12. informe;
13. seguimiento.

No todos los subcriterios aplican a todos los casos.

---

## 32. Dimensión 3: comunicación

Propuesta de subcriterios internos:

- saludo y acogida;
- inicio abierto;
- estructura/progresión;
- calidad de preguntas;
- uso apropiado de preguntas cerradas;
- escucha activa;
- uso de respuestas previas;
- empatía;
- ausencia de juicio;
- colaboración/autonomía;
- lenguaje comprensible;
- resumen;
- énfasis de hallazgos;
- cierre;
- ofrecimiento de ayuda;
- despedida.

La puntuación debe ser trazable a evidencias de la transcripción.

---

## 33. Evaluación basada en evidencia

**CRÍTICO.**

La IA evaluadora no puede otorgar puntuación relevante sin indicar evidencia.

Por criterio debe devolver, cuando sea aplicable:

```json
{
  "criterion_id": "communication_empathy",
  "level": 3,
  "score": 7.5,
  "evidence": [
    {
      "turn": 12,
      "speaker": "student",
      "excerpt": "Entiendo que con esos cambios de turno sea difícil mantener siempre la misma rutina."
    }
  ],
  "justification": "El estudiante valida de forma explícita la dificultad del paciente.",
  "improvement": "Podría haber comprobado después qué solución encajaría mejor con su rutina.",
  "confidence": 0.92
}
```

No debe inventar turnos ni citas.

---

## 34. Equivalencia semántica

La evaluación no puede depender de igualdad textual.

Debe aceptar equivalentes contextual y clínicamente válidos.

Ejemplo:

- «no intencional»
- «no intencionada»
- «incumplimiento involuntario»
- «quiere tomarlo, pero se le olvida»

pueden corresponder al mismo concepto si el caso lo sustenta.

Sin embargo, la equivalencia semántica no debe fusionar conceptos clínicamente distintos.

---

## 35. Detección de incoherencias entre entrevista y conclusión

La IA debe diferenciar:

- haber descubierto un hallazgo;
- haberlo escrito en la respuesta final;
- haber acertado por casualidad.

Ejemplo:

El alumno selecciona «olvido» pero nunca exploró la toma real.

Puede obtener parte de la puntuación por conclusión correcta, pero no la puntuación máxima de razonamiento/coherencia.

También debe ocurrir lo contrario:

si el alumno describe correctamente una barrera con otras palabras, no debe ser penalizado por no usar el término exacto del ground truth.

---

## 36. Seguridad de la actuación del estudiante

El evaluador debe buscar:

- recomendaciones peligrosas;
- suspensión/modificación inapropiada de tratamiento;
- ignorar signos de alarma;
- derivación omitida crítica;
- información farmacológica falsa relevante;
- culpabilización grave;
- actuación fuera de competencias.

Cuando exista una alerta crítica:

- registrar la evidencia;
- marcar la evaluación;
- poder dejar la nota `PENDING_TEACHER_REVIEW`.

No delegar automáticamente decisiones académicas graves a la IA sin trazabilidad.

---

## 37. Confianza de la evaluación

La evaluación debe incluir una medida interna de confianza o al menos un estado de certeza.

Estados posibles:

- HIGH_CONFIDENCE;
- REVIEW_RECOMMENDED;
- REVIEW_REQUIRED.

Causas de revisión:

- evidencia ambigua;
- transcripción incompleta;
- contradicción;
- posible actuación insegura;
- diferencia entre evaluación determinista e IA;
- baja confianza;
- error del modelo.

---

## 38. RESULTADO 2: cuestionario post-caso

Debe existir una segunda puntuación independiente:

**Comprensión del caso: 0–100**

Esta puntuación no sustituye al desempeño.

Mide:

- comprensión del SPFA;
- interpretación de PRM/RNM;
- adherencia;
- razonamiento;
- estrategia;
- intervención;
- derivación;
- síntesis.

---

## 39. Cuestionario calificable fijo

Cada caso debe incluir, idealmente, entre 8 y 10 preguntas calificables.

Estas preguntas:

- son generadas inicialmente por IA;
- son revisadas por el profesor;
- quedan vinculadas a la versión del caso;
- son iguales para todos los estudiantes que realizan esa versión;
- tienen soluciones predefinidas;
- incluyen explicación docente;
- pueden ser de respuesta única o múltiple.

No deben generarse al azar para cada estudiante si afectan a la nota comparativa.

---

## 40. Banco de preguntas conceptuales por caso

El generador puede seleccionar/adaptar preguntas de los siguientes tipos.

## Q1. SPFA inicial

«¿Qué SPFA estaba realizando inicialmente el farmacéutico?»

Opciones según catálogo validado.

## Q2. Detección de otra necesidad/SPFA

«Durante la actuación, ¿se identificó una necesidad que justificara otro SPFA?»

## Q3. Existencia de PRM

«¿Se identificó algún PRM?»

## Q4. Tipo(s) de PRM

Selección simple o múltiple.

## Q5. RNM

«¿Existía algún RNM o situación relacionada con un RNM según el marco utilizado?»

La formulación exacta debe seguir el protocolo/taxonomía validada.

## Q6. Adherencia

«¿Era adherente a su tratamiento?»

## Q7. Tipo de falta de adherencia

Intencionada / no intencionada / combinada / no determinable.

## Q8. Barrera principal

Opciones específicas del caso.

## Q9. Estrategia

Educativa, conductual, técnica, organizativa, motivacional, etc., según configuración.

## Q10. Intervención concreta

Elegir la actuación más adecuada para ese paciente.

## Q11. Derivación

No / no urgente / urgente / según taxonomía configurada.

## Q12. Informe

Cuándo y cómo debe acompañarse una derivación si el caso lo exige.

## Q13. Específica de Dispensación

Inicio/continuación, dato esencial omitido, elemento de seguridad, etc.

## Q14. Específica de Indicación

Información relevante, criterio de derivación, dato no explorado, etc.

## Q15. Mejor síntesis del caso

Cuatro síntesis plausibles; una representa mejor el conjunto de hallazgos.

## Q16. Evidencia que sustenta la conclusión

Seleccionar la frase/dato del paciente que justifica una clasificación.

No todas las preguntas se aplican a todos los casos.

---

## 41. Calidad de las opciones del cuestionario

Los distractores deben ser:

- plausibles;
- clínicamente distintos;
- no absurdos;
- de longitud similar cuando sea razonable;
- no revelar la respuesta por estilo;
- no depender de pistas gramaticales.

Una pregunta de respuesta única debe tener una única opción inequívocamente correcta según el caso validado.

La auditoría debe comprobarlo.

---

## 42. Preguntas adaptativas formativas

Después de la parte calificable, el sistema puede generar 2–3 preguntas personalizadas basadas en errores reales de la entrevista.

Ejemplo:

si el alumno no exploró alergias cuando eran relevantes:

> «Antes de recomendar un medicamento en este caso, ¿qué información importante faltó comprobar?»

Estas preguntas:

- son formativas;
- pueden variar entre estudiantes;
- inicialmente no modifican la nota principal;
- deben centrarse en omisiones reales.

---

## 43. Feedback final al estudiante

Debe mostrar al menos:

## 43.1. Resultados

- desempeño global;
- protocolo SPFA;
- PRM/adherencia/intervención;
- comunicación;
- comprensión del caso/cuestionario.

Ejemplo:

- Desempeño global: 81/100
- Protocolo SPFA: 85/100
- PRM/adherencia/intervención: 78/100
- Comunicación: 80/100
- Comprensión del caso: 90/100

## 43.2. Feedback

- fortalezas;
- áreas prioritarias de mejora;
- información importante no descubierta;
- errores de razonamiento;
- aspectos comunicativos;
- intervención;
- seguridad;
- conceptos a revisar;
- ejemplos de reformulación cuando sea útil.

El feedback no debe ser genérico.

Debe apoyarse en la transcripción.

---
