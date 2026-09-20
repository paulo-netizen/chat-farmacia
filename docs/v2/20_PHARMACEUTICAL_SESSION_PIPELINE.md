# M6-E3 — Offline pharmaceutical session pipeline integration

M6-E3: **CLOSED / COMPLETE — OFFLINE INTEGRATION COMPLETE**. Publicado en Git mediante
`11e10724b8ca1032c29edf6f85553e28395ab62b`. No implica despliegue ni activación académica. **NO INDEPENDENT WEIGHT**.
M6-E permanece **PARTIAL**. E1/E2 siguen CLOSED / COMPLETE; E1 STRUCTURAL_ONLY.
PED2 OPEN / NOT FROZEN / TEACHER APPROVAL REQUIRED; perfiles productivos NOT APPROVED / NOT INSTALLED.
D3B OPEN / VALIDATION DEBT. Estado actual aprobado: M6 56% / proyecto 50.57%; ningún histórico live se modifica.
La regularización reconoce trabajo E1/E2/E3 ya completado dentro de E, no puntos propios E3.
[E4](21_PHARMACEUTICAL_EVALUATION_PERSISTENCE_DESIGN.md) es diseño documental sin peso; persistencia todavía no implementada.

## API server-owned

`evaluatePharmaceuticalSessionV2(input, dependencies)` recibe contextSource, contexto a validar,
configuración explícita, d1SemanticAcceptance y selección D2 (REQUESTED con semanticAcceptance,
o NOT_PROVIDED / NOT_REQUESTED). El estado de aceptación proviene del caller server-owned;
esta función no es una frontera de autorización para datos enviados por un cliente.
Las dependencias son runtimes D1/D2 y allocators de IDs existentes. No hay OpenAI directo, IO,
reloj, random, retries, fallback, reparación ni aritmética nueva.

Orden: snapshot privado de entradas → validación/reconstrucción del contexto existente y configuración
→ D1 real → D2 real solicitado → buildPharmaceuticalScoreInputV2 → calculatePharmaceuticalSessionScoreV2.
La reconstrucción existente comprueba las fuentes suministradas; E3 no genera otro target set.
Errores de configuración, bindings, fingerprint o versiones se propagan sin convertirlos indiscriminadamente
en ausencia de configuración pedagógica. Fallos detienen las etapas posteriores.
El contrato de configuración aprobado se reutiliza, sin defaults ni aprobar perfiles nuevos.

## Testigos internos y compatibilidad

- `adjudicatePharmaceuticalD1ContextWithWitnessesV2(context, runtime, allocateExecutionId)` devuelve
  `{ set, acceptedBatches }` usando la ejecución y validación compartidas con la API anterior.
- `adjudicatePharmaceuticalD2ClaimsWithWitnessesV2(context, runtime, allocateExecutionId, requestContractVersion?, promptVersion?)`
  devuelve `{ adjudication, request, providerResult }`. Conserva el resultado efectivamente utilizado,
  no lo reconstruye a partir de findings canónicos.
- Las APIs anteriores delegan en estas variantes y devuelven su resultado anterior. Sus defaults no cambian.
  E3 selecciona explícitamente request D2 /2 y prompt /5, sin modificar sus contenidos ni contratos.
- Contextos y requests se copian/deep-freeze antes de delegar; receipts se copian antes de callbacks
  de asignación. Los resultados y testigos se devuelven deep-frozen. No se congela el objeto original del caller.
- DeepScoringReadonly conserva branded primitives y tuplas mediante mapeo homomórfico;
  es un ajuste de tipos, no una modificación de validación o aritmética E1/E2.

Los testigos existen solo para validación interna. La salida E3 contiene `{ d1, d2, score }`:
d1 adjudication set; d2 ausencia explícita o findingSet/executions; score es PharmaceuticalSessionScoreV2,
incluyendo result/fingerprint/receipt. No contiene acceptedBatches, requests ni providerResult.
La salida sigue siendo server-owned, no una DTO estudiantil ni autorización para publicar feedback.

## Semántica preservada

D2 no solicitado es distinto de D2 solicitado sin mensajes: el segundo produce finding set vacío válido
y cero ejecuciones. Un error nunca se convierte en ninguno de ellos.
D1 concede crédito conforme a E2; D2 es REVIEW_ONLY. UNCERTAIN requiere revisión sin crédito confirmado.
VALIDATION_DEBT conserva UPSTREAM_VALIDATION_DEBT y provisionalidad para resultados calculables,
sin penalización. possible cero sigue NOT_SCORABLE. SINGLE/ALL_OF/ONE_OF, pesos y rounding son exclusivos E2.

Los tests usan configuración identificada E3-SYNTHETIC-TEST-ONLY. Fuentes técnicas validadas reutilizadas
no se convierten en perfiles docentes. Los runtimes falsos ejercitan los orquestadores y scorer reales.
La integración offline no demuestra aceptación semántica live, aprobación docente, integración de nota
académica, persistencia, API/UI ni workflow de publicación. D3B no se reabre; no hay matrix /14.

## Verificación histórica de E3 — no reejecutada en E4 documental

- E3: 35/35 PASS, composición real con runtimes falsos; compatibilidad de variantes, aislamiento de
  mutaciones, testigos manipulados, configuración ausente/no aprobada/no configurada, bindings,
  detención ante errores, D2 vacío/no solicitado, UNCERTAIN, review-only, deuda, NOT_SCORABLE,
  grupos sin doble cómputo, determinismo y ausencia de testigos en salida serializable.
- Selección relacionada: 500/500 PASS (E3 35, scorer 98, E1 156, D1 runtime/orquestación 89,
  D2 runtime/orquestación 122). Las regresiones adicionales están incluidas en la suite completa.
- `npx tsc --noEmit --incremental false`: PASS.
- `npm test -- --maxWorkers=2 --minWorkers=1`: 3220 PASS / 25 SKIPPED; 79 archivos PASS y 5 SKIPPED.
  Gates explícitamente desactivados: 7 live y 18 PostgreSQL. Cero OpenAI real y cero DB.
  Primer arranque bloqueado por EPERM del sandbox antes de tests; repetición autorizada fuera
  del sandbox, con los mismos gates offline. No se modificó tooling.
- `git diff --check`: PASS. Revisión final y checkpoint E3 completados, posteriormente publicados en Git.
- Lint no ejecutado: limitación interactiva preexistente documentada en E2; no se configura ESLint.
- Durante la implementación original no hubo staging/commit/push; el checkpoint y push fueron posteriores.
  Entonces se corrigió la fila Actual obsoleta 49.25% a 49.37%; la regularización aprobada posterior la lleva a 50.57%.
