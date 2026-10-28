# M9 — Resultados por sesión y liberación explícita

Entrega iniciada el 27-10-2026 y cerrada el 28-10-2026, base `a589e024373685495deadb85d9fbfc454e56260d`.

## Recorrido y contratos

«Ver resultados» abre `/resultados/{sessionId}` después de entregar el cuestionario. Las
lecturas verifican rol y titular en PostgreSQL; no crean sesiones, invocan IA, reclaman
evaluaciones ni corrigen nuevamente el cuestionario. Recuperan su `questionnaire-grade/1`
persistido. La validación de integridad SPFA reutiliza el lector existente, incluida su
comprobación determinista de consistencia del score, sin sustituir el resultado guardado.

`session-results/1` vincula sesión, versión del caso, política, recibo y versiones/huellas
de evaluaciones persistidas. Una transacción con snapshot consistente evita mezclar lecturas.
M5 aporta protocolo; P1–P3 aportan actuación mediante sus contratos protegidos, sin ejecutar
E3. Varias intenciones farmacéuticas requieren selección docente futura, nunca elegir
silenciosamente la última o la mejor. M7 permanece ausente.

| Estado | Información visible tras liberación |
|---|---|
| AVAILABLE | Nota existente y procedencia |
| PROVISIONAL | Nota provisional, sin elevar aceptación semántica |
| PENDING_REVIEW | Nota existente si la hay, pendiente; excluida de global |
| PENDING | Sin nota, nunca cero |
| TECHNICAL_FAILURE | Error técnico sin contenido clínico, sin nota |
| NOT_SCORABLE | No puntuable, sin sustituirlo por cero |

La global es desempeño: protocolo + actuación + comunicación. Comprensión sigue independiente
(especificación 04 §§28/38/43). Solo se calcula con las tres dimensiones AVAILABLE y pesos
explícitos que sumen 100; no se renormalizan pesos. Los pesos 20/30/50 de tests son sintéticos,
no una propuesta académica. La demostración muestra global pendiente porque falta M7.

## Liberación y seguridad

Migración aditiva `0012_v2_session_results.sql`: políticas inmutables por versión y liberaciones
append-only. `result-policy/1` distingue SYNTHETIC_TEST y ACADEMIC_APPROVED con referencia de
aprobación. Las políticas sintéticas requieren base marcada desechable. No se configura
ninguna política académica ni se implementa su aprobación institucional en esta entrega.

- SUBMISSION_PENDING: antes de entregar, sin claves ni notas.
- POLICY_PENDING: sin política, resultados retenidos.
- AFTER_SUBMISSION: libera después de entrega definitiva.
- TEACHER_REVIEW: HELD sin dimensiones, claves o explicaciones hasta liberación autorizada.
- `/profesor/resultados/{sessionId}` permite al propietario docente del caso o administrador
  revisar y liberar la composición exacta. Huellas obsoletas se rechazan. Cambiar una
  evaluación exige nueva liberación y conserva la instantánea histórica.

Liberar permite visualizar; no aprueba dimensiones provisionales, corrige notas ni certifica
clínica. APIs no-store, control de origen en escritura y errores seguros. El endpoint legacy
de evaluaciones continúa reteniendo paquetes nativos; no se habilitan inferencias por M9.

Respuestas, claves y justificaciones proceden de la definición fijada, no latest. Las citas
provienen de evaluaciones existentes y se comprueban contra mensajes y roles de esa sesión.
No se envían paquete docente, prompts, fuentes ocultas o hallazgos raw de D2. Validar una cita
no certifica su interpretación semántica. No se generan conclusiones clínicas nuevas.
Quedan pendientes selección entre múltiples intenciones, edición docente de notas y feedback
adicional. La liberación existente no pretende implementar toda la revisión de M10.

## Contraste completo de M8

§§27/39/41 y AT-010/011: cierre, preguntas fijas por versión, selección única/múltiple,
persistencia, entrega, corrección determinista y protección de claves implementados.
§38: comprensión independiente visible bajo liberación. §39: ocho preguntas propuestas por
caso real; las dos de demostración verifican técnica, no adecuación académica. §41: distractores
revisados, sin sustituir aceptación docente de claves. §42: refuerzo adaptativo formativo
opcional no implementado. Faltan políticas académicas, cuestionarios aceptados y habilitación
real. M8 continúa PARTIAL; M9 también, con M7 e integración/aceptación académicas pendientes.

Lucía y María no se modifican: borradores, claves Lucía 5/7 y María 3/6/8 pendientes.
M6/M6-E PARTIAL, PED2 abierto, D3B OPEN / VALIDATION DEBT. Sin auditorías/calibraciones,
IA, gasto, despliegue ni cambios productivos.

## Evidencia nueva

Focalizadas y regresiones: **132/132**. PostgreSQL M9 **6/6**, regresión M8 **6/6**,
preparación de demostración **1/1**, en `chatusal_editor_disposable` con marcador
`teacher-editor-20261012-disposable` verificado. Lectura repetida/concurrente sin nuevas
evaluaciones ni cambios del recibo; retención/liberación exacta, acceso ajeno, fallo SPFA,
edición posterior, invalidación e históricos. M6 usa artefactos completos sintéticos y
validadores existentes; no acredita calidad semántica live.

Suite offline final **3973 PASS / 109 SKIPPED**; TypeScript PASS. Lint intentado:
Next solicita configurar ESLint; no se declara PASS ni se introduce configuración.
Las pruebas de M8 del documento 35 son evidencia histórica, salvo la regresión 6/6 repetida
expresamente aquí para comprobar la integración. No se repiten auditorías clínicas.

La propuesta de progreso y cálculo canónicos están en [PROJECT_STATUS](PROJECT_STATUS.md).
51,53% sigue acreditado; 57,23% es propuesta histórica anterior a M8, no medición actualizada.

Navegador, 27–28 de octubre: recorrido sintético entrevista finalizada → respuestas guardadas
y recuperadas tras recarga → entrega → resultados, con comprensión 50/100 y global pendiente.
Segundo escenario: retención sin notas/claves, revisión del docente propietario, liberación
explícita y recuperación por el estudiante. El fallo SPFA sintético sigue como fallo técnico,
no como cero; actuación y comunicación permanecen pendientes. Acceso de otro estudiante
denegado. La recarga conserva el resultado. Son demostraciones sobre versiones sintéticas
en la base desechable, no resultados de Lucía o María ni aceptación académica.
