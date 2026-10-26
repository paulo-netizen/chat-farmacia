# Auditoría vinculada al paquete nativo

26-10-2026. Conexión técnica, sin nuevas inferencias ni aprobación docente.

## Recorrido

En el editor: abrir el borrador guardado → Revisión y publicación → candidato nativo existente → seleccionar ficha CIMA → Vincular fuentes sin ejecutar IA. Se recuperan procedencia, disponibilidad, truncamiento y configuración junto al mismo candidato; no se crea otro expediente de caso. La auditoría autorizada posterior reutiliza el auditor clínico existente sobre el paquete nativo íntegro, incluidas las propuestas de solución y cuestionario, sin ratificarlas automáticamente.

`teacher-native-audit-input/1` contiene candidato, revisión, huella del contenido JSONB y bundle canónico. `teacher-native-audit/1` fija la evidencia de fuentes, su hash, instrucciones, esquema, modelo/configuración y hash de la solicitud efectiva. Ordenación estable de objetos conserva la identidad tras persistencia JSONB. Las referencias del juicio se validan contra los hechos de autoría y las fuentes disponibles.

La migración 0010 añade únicamente vínculos, reservas de ejecución y resultados inmutables al candidato existente. No duplica paquetes ni modifica históricos. El gate de publicación nativo consume esta evidencia; el histórico conserva su mecanismo anterior. Se aplicó solo a PostgreSQL desechable con identidad y marcador verificados. Requiere aplicar la migración mediante el proceso habitual antes de usar el código en otro entorno; no hubo despliegue.

## Cuatro comprobaciones diferentes

| Capa | Qué demuestra | Qué no demuestra |
|---|---|---|
| Estructura | Contratos, campos, referencias y proyecciones válidos | Adecuación clínica |
| Fuentes | Ficha recuperada, URL, fecha, hash y extracto exacto | Adecuación de la pauta a este paciente |
| Juicio del auditor | Doce dimensiones estructuradas y referencias válidas | Aprobación docente o exhaustividad de la fuente |
| Revisión humana | Aprobación explícita del candidato y advertencias | Aprobación de versiones futuras |

FAIL e INSUFFICIENT bloquean publicación; fuentes no disponibles nunca pasan. WARNING exige resolución docente explícita. Ausencia de juicio mantiene PENDING. Cambio de contenido/revisión exige nuevo candidato, auditoría y aprobación; cambio de configuración efectiva deja obsoleto el vínculo. No se traslada la auditoría de un candidato anterior al nuevo. Los resultados recibidos después de una edición se conservan en su candidato histórico.

Una reserva confirmada precede al auditor y se libera la transacción antes de su ejecución. No se repite una reserva existente, aunque falte resultado o la respuesta de completion se pierda. Errores conservados como NATIVE_AUDIT_FAILED sin texto clínico; la persistencia fallida se propaga y la reserva permanece. Uso y metadatos de fallos del proveedor siguen en el diario privado del auditor existente, nunca respuestas raw en el expediente público. El endpoint exige autorización docente y configuración privada antes de reservar. El adaptador mantiene además autorización específica, presupuesto y diario privados.

Para renovar fuentes/configuración o volver a auditar tras un intento fallido se necesita una nueva revisión explícita; no hay desbloqueo ni reintento automático. La autorización privada anterior no habilita el paquete nuevo. El límite de entrada del formato histórico sigue en 80.000 bytes; el nativo admite 120.000, porque el paquete ejecutable completo de María más un extracto de 24.000 caracteres supera 80.000. Es un límite técnico, no un conteo de tokens ni autorización económica: permanecen conteo oficial, reserva previa, salida máxima y presupuesto del auditor. Excederlo bloquea el envío.

## Demostración sin IA

Desde el navegador se recuperaron Lucía v5 y María v3, con sus candidatos nativos reales de desarrollo. Se vincularon respectivamente CIMA 68167 (metformina) y 63355 (enalapril). Ambas fuentes AVAILABLE; enalapril muestra extracto truncado. Vínculo vigente SÍ, ejecución PREPARED, auditoría y revisión humana PENDING. Validar/publicar deshabilitados. Consulta directa de la base confirmó TEACHER_DRAFT, sin reserva de ejecución ni resultado en ambos candidatos. No se cambiaron sus decisiones clínicas, textos o preguntas.

El resultado clínico no se ha simulado para Lucía/María. Solo las pruebas con casos sintéticos separados usan juicios falsos y publicación en base desechable. No hubo conteos ni llamadas IA, gasto nuevo, sesiones o asignaciones académicas para estos casos. Costes históricos y partidas desconocidas permanecen sin cambios.

## Evidencia nueva y límites

- 10/10 unitarias del vínculo/validación y 13/13 regresiones de paquete nativo.
- 7/7 integración del ciclo de auditoría y 2/2 de conversión, ejecutadas secuencialmente en PostgreSQL desechable: permisos, reserva concurrente, edición durante await, conservación histórica, invalidación de aprobación y publicación sintética con proyección pública de tres campos.
- Suite offline: 3932 PASS / 95 SKIPPED, antes del ajuste localizado de tamaño. Después: 21/21 focalizadas (incluye dos de tamaño, nueve del auditor y diez del vínculo) y TypeScript PASS. No se atribuye a la suite anterior cobertura del ajuste posterior.
- El primer pase PostgreSQL detectó un acceso a un campo exclusivo de resultados desde el trigger de reservas; corregido y 9/9 posteriores PASS. La instalación simultánea de la migración desde dos archivos de pruebas colisionó: bootstrap ejecutado secuencialmente con `--no-file-parallelism`.
- Regresión PostgreSQL del gate histórico de publicación: 7/7 PASS en la misma base desechable, sin cambiar el protocolo legado.
- Lint no acreditado: el repositorio sigue sin configuración de ESLint; no se introduce configuración en esta entrega.

La evidencia offline demuestra compatibilidad técnica y gates. No acredita calidad clínica del nuevo juicio, que no se ha solicitado. La disponibilidad CIMA no resuelve la elección de derivación de Lucía. Las decisiones y las **16 preguntas totales (ocho por caso)**, opciones, claves y justificaciones siguen en [documento 33](33_NATIVE_TEACHER_AUTHORING.md), sin cambios de expectativa ni aprobación.

## Progreso y siguiente paso

51,53 % acreditado / 57,23 % propuesto. M1–M3 PARTIAL; M6 64 %, M6/M6-E PARTIAL; PED2 abierto, perfiles productivos no aprobados, D3B OPEN / VALIDATION DEBT. Sin nuevos puntos.

Paulo revisa derivación/urgencia de Lucía, PRM/intervención/reevaluación de María y perfiles/requisitos/cuestionarios de ambas. Después se guardan las decisiones en nuevas revisiones, se vinculan fuentes a esos paquetes definitivos y se auditan con autorización privada específica. Solo tras resultado admisible y revisión humana explícita podrán validarse y publicarse. Este cierre no aprueba clínicamente los borradores.
