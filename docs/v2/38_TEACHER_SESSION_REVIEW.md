# Revisión docente de sesiones y liberación — 29-10-2026

## Recorrido y alcance

Desde `/profesor`, el docente localiza las últimas 100 sesiones v2 de sus casos por
estudiante, título y presencia de revisiones. El administrador puede revisar todas.
El filtro «con revisiones» indica historial, no aprobación vigente. El detalle muestra
transcripción, versión fijada, respuestas, recibo y dimensiones automáticas con evidencias.
Las conversaciones de previsualización usan sus propias tablas y quedan excluidas.
La antigua tabla legacy sin filtro de propietario se sustituye por esta vista v2;
los registros históricos no se migran ni recalifican. Analítica de uso/costes queda pendiente.

Aceptar, corregir o comentar crea una revisión inmutable con autor, fecha, motivo,
revisión secuencial y huella de la composición automática. Se permiten correcciones
textuales de criterios existentes y puntuación explícita de dimensiones AVAILABLE.
Una corrección de criterio sin nueva puntuación deja la dimensión PENDING_REVIEW y sin
nota: no se inventa una fórmula. El recibo, claves y evaluación automática no cambian.
Un fallo técnico admite comentario, nunca se transforma en cero. Aceptar comunicación
provisional no aprueba su rúbrica ni habilita su incorporación a una nota académica.

Se reutiliza la liberación M9. Toda revisión cambia la huella y requiere una liberación
explícita exacta, incluso bajo AFTER_SUBMISSION. Si cambia la composición automática,
las revisiones anteriores siguen visibles como históricas y dejan de aplicarse; también
caduca la liberación. Recargar solo lee. Conflictos de revisión concurrente devuelven 409.
La autorización de propietario/admin y los controles de origen se ejecutan en servidor.

Migración aditiva `0014_v2_teacher_result_reviews.sql`: historial append-only, guardas de
rol/propiedad/sesión finalizada/revisión/motivo y RLS. Aplicada solo al PostgreSQL desechable
identificado por su marcador; requiere aplicación controlada antes de desplegar esta versión.
No despliegue, nuevas inferencias, cambios de rúbricas ni aprobación de casos.

## Evidencia nueva y demostración

- Navegador: filtros combinados; aceptación con motivo, corrección Q2 de 50 automático a
  75 revisado, liberación exacta, lectura/recarga como estudiante y comentario de fallo técnico sin nota.
- PostgreSQL desechable: 16 PASS / 2 SKIPPED en regresiones M7/M9/revisión; los dos omitidos
  son creación de demos ya existentes. Comprobados permisos, concurrencia, recibo intacto,
  liberación invalidada tras corrección y recuperación sin nuevas evaluaciones.
- Suite offline final: 3996 PASS / 121 SKIPPED. Incluye cinco pruebas unitarias/API nuevas.
  No incluye la regresión adicional de cambio de composición: check posterior focalizado 11 PASS / 1 SKIPPED (seis PostgreSQL y cinco unitarias/API), más TypeScript PASS.
- TypeScript PASS; diff-check PASS. Lint intentado: repositorio sin configuración ESLint,
  Next solicita crearla y termina sin ejecutar análisis. No se configura ni se declara PASS.
- La evidencia semántica de M7 continúa siendo simulada; la inspección visual recupera un
  resultado ya persistido, sin repetir evaluación: 10/100 sintético, PROVISIONAL, nueve criterios y global no calculado, comprobados visualmente. No equivale a aprobación de la rúbrica.

Las demos son sesiones sintéticas independientes. Aunque el fixture reutiliza contenido
base y título de Lucía, no publica el borrador real de Lucía ni el de María. Se conservan
sus cinco decisiones de cuestionario y demás pendientes clínicos. Los nueve archivos COV
ajenos y logs locales no pertenecen al checkpoint.

## Propuesta consolidada, no acreditación

La tabla canónica está en [PROJECT_STATUS](PROJECT_STATUS.md). Se conservan las propuestas
M1 90, M2 45, M3 65, M8 80 y M9 75. No se vuelve a contar la liberación M9 ni la corrección
automática M8. M7 sigue PARTIAL y sin incremento numérico propuesto en esta entrega:
visualizarlo no resuelve aprobación de rúbrica, adaptador ni aceptación semántica.

El nuevo trabajo pertenece a M10: se propone un desglose de 100 puntos internos,
**50 completados propuestos**, sin aprobarlo automáticamente:

| Entregable M10 | Total | Completado propuesto |
|---|---:|---:|
| Listado autorizado y filtros básicos | 15 | 15 |
| Detalle docente de sesión y evidencias existentes | 10 | 10 |
| Revisión/corrección humana trazable, concurrencia e históricos | 25 | 25 |
| Analítica agregada y seguimiento de cohortes | 25 | 0 |
| Paginación, búsqueda avanzada y exportación autorizada | 10 | 0 |
| Aceptación de usabilidad y operación académica real | 15 | 0 |
| Total | 100 | 50 |

Peso global M10 intacto 4%: +2,00 puntos propuestos. Nueva propuesta acumulada:
**66,58 + 2,00 = 68,58%**; acreditado **51,53%**. Las cifras anteriores 57,23 y 66,58
se conservan como históricos. Todos los bloques citados siguen PARTIAL.

Pendientes: criterios/rúbricas y políticas académicas aprobados, aceptación docente del
flujo, analítica, selección de múltiples intenciones y validación semántica de M7.
Este panel revisa resultados existentes; no crea evaluaciones ausentes ni decide cómo
puntuar una corrección textual sin configuración.
