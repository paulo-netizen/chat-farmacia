# 19 — Pharmaceutical scoring contracts and deterministic engine (M6-E1/E2)

## Estado y alcance

M6-E0: **AUDIT COMPLETED**. M6-E1: **CLOSED / COMPLETE**, contratos y validación estructural offline.
M6-E2: **CLOSED / COMPLETE**, motor determinista genérico.
M6-E3: **CLOSED / COMPLETE — OFFLINE INTEGRATION COMPLETE**, implementación local para revisión,
no publicada; **NO INDEPENDENT WEIGHT**. [Pipeline y testigos internos](20_PHARMACEUTICAL_SESSION_PIPELINE.md).
M6-E global: **PARTIAL**, pendientes PED2/configuración e integración académica productiva.
Verificación E3: 35/35; selección relacionada 500/500; suite 3220 PASS / 25 SKIPPED;
TypeScript `--incremental false` y diff-check PASS. No cambia la validación estructural E1 ni el cálculo E2.
Scoring engine: **IMPLEMENTED / CONFIGURATION-GATED**. Configuración pedagógica: **REQUIRED / NOT YET APPROVED**.
Production pedagogical profiles: **NOT APPROVED / NOT INSTALLED**. M6-E-PED1 y PED2A: **AUDIT COMPLETED**;
M6-E-PED2: **OPEN / NOT FROZEN / TEACHER APPROVAL REQUIRED**.
El motor calcula únicamente sobre snapshots aprobados server-owned. Los únicos planes/pesos usados para probarlo
son sintéticos test-only: no se convierten fixtures M6/D3/SPFA en rúbricas académicas productivas.
La aplicación todavía no dispone de una nota académica productiva integrada.

M6-D3B permanece **OPEN / VALIDATION DEBT**; M6-D3 / M6-D, **PARTIAL / OPEN**.
Matrix `/13` sigue históricamente `REJECT`; no se crea `/14` ni se reinterpreta ningún histórico.
M6 sigue en **46%**, proyecto **49.37%**: no hay ponderación explícita de E1/E2 que autorice sumar progreso.

## Contratos y versiones

Los nombres TypeScript conservan el sufijo `V2` y `schemaVersion: '2.0'`; `/1` identifica la primera versión de cada contrato nuevo.
Los schemas Zod strict y sus tipos readonly inferidos comparten una única definición en `pharmaceutical-scoring-types.ts`.

| Tipo | contractVersion | Canonicalization SHA-256 |
|---|---|---|
| PharmaceuticalScoringPolicyV2 | pharmaceutical-scoring-policy/1 | pharmaceutical-scoring-policy-v2/1 |
| PharmaceuticalScoringPlanV2 | pharmaceutical-scoring-plan/1 | pharmaceutical-scoring-plan-v2/1 |
| PharmaceuticalScoringWeightsV2 | pharmaceutical-scoring-weights/1 | pharmaceutical-scoring-weights-v2/1 |
| PharmaceuticalScoringThresholdsV2 | pharmaceutical-scoring-thresholds/1 | pharmaceutical-scoring-thresholds-v2/1 |
| PharmaceuticalScoringRoundingV2 | pharmaceutical-scoring-rounding/1 | pharmaceutical-scoring-rounding-v2/1 |
| PharmaceuticalScoreInputV2 | pharmaceutical-score-input/1 | pharmaceutical-score-input-v2/1 |
| PharmaceuticalSessionScoreV2 | pharmaceutical-session-score/1 | pharmaceutical-session-score-v2/1 |
| PharmaceuticalScoreReceiptV2 | pharmaceutical-score-receipt/1 | Remite al fingerprint del resultado y del input, sin hash circular |

Policy, plan, weights, thresholds y rounding tienen `ref: { id, version }` independientes y fingerprint.
`rulesVersion` es `pharmaceutical-scoring-rules/1`; no se deduce de weightsVersion ni thresholdsVersion.

## Policy: reglas congeladas, sin cifras pedagógicas por defecto

- Fuente automática: `VALIDATED_D1_ONLY`.
- `CORRECTLY_DEMONSTRATED → CREDIT`.
- `INCORRECT_OR_CONTRADICTED → NO_CREDIT`.
- `UNCERTAIN → NO_CONFIRMED_CREDIT_REVIEW_REQUIRED`; conserva denominador en unidades aplicables.
- `NOT_DEMONSTRATED → NO_CREDIT`.
- `STRUCTURAL_NO_STUDENT_CANDIDATES → NO_CREDIT_STRUCTURAL`: nunca se fabrica un verdict o una ejecución semántica.
- D2 `CONTRADICTORY` / `UNSUPPORTED → REVIEW_ONLY`. Las tres claim forms no modifican aritmética.
- Puntuación negativa prohibida; sin hard-fail clínico ni pass/fail.
- ALL_OF: `ALL_MEMBERS_REQUIRED_FOR_UNIT_CREDIT`.
- ONE_OF: `ANY_CORRECT_MEMBER_YIELDS_SINGLE_UNIT_CREDIT`.
- Sin aplicables: `NOT_SCORABLE`, nunca 100 por defecto.
- Referencias separadas obligatorias a weights, thresholds y rounding.
- La preferencia explícita `reviewIncorrectD1` puede añadir revisión; no puede suprimir las señales obligatorias de incertidumbre, D2 o deuda.

Estos identificadores representan reglas; E1 no las ejecuta para asignar puntos.
M5 SPFA es una subescala independiente. Comunicación, cuestionario, feedback narrativo y agregación global quedan fuera.

## Plan y partición puntuable

El plan canónico contiene caso, target-set binding, expectation-set binding, weightsRef, aprobación y unidades.
Cada unidad contiene `scoringUnitId`, domain, operador `SINGLE | ALL_OF | ONE_OF`, miembros, aplicabilidad,
sourceExpectationGroupRefs y weightBinding. No hay unidades generadas por heurísticas pedagógicas.

Los dominios proceden del contexto clínico M6-C (PRM, RNM, PRM_RNM_RELATION, ADHERENCE, BARRIER,
STRATEGY, PROFESSIONAL_ACTION, PHARMACEUTICAL_INTERVENTION, REFERRAL, REPORT), no de pesos de batches D1.
En esta primera partición una unidad no puede mezclar dominios. Un grupo upstream cruzado requiere decisión explícita posterior: se rechaza, no se divide automáticamente.

La validación reconstruye el contexto con los builders M6-A/B/C y exige:

- Cobertura exacta de todos los targets, incluidos los explícitamente no aplicables.
- Cada target pertenece a una sola unidad; ninguna unidad duplica un grupo y sus miembros.
- SINGLE tiene exactamente un miembro, sin grupos upstream pendientes de representar.
- ALL_OF / ONE_OF coincide exactamente con un grupo upstream y su operador.
- Todos los grupos upstream están representados. Solapamientos ambiguos, grupos ignorados,
  miembros duplicados/inexistentes/vacíos y IDs de unidad duplicados fallan con error tipado.
- `APPLICABLE` / `NOT_APPLICABLE` provienen exclusivamente del plan aprobado, nunca de D1 ni de ausencia de evidencia.

Los IDs `pharm_scoring_unit_<sha256>` dependen del caso, ID lógico del plan, dominio, operador, miembros y grupos ordenados.
No dependen del orden de arrays, de la versión del plan ni de aplicabilidad; estos últimos cambios sí alteran su fingerprint.
Cambiar un grupo/miembros/dominio cambia la identidad de unidad. No se modifican IDs clínicos ni targets upstream.

M6-B carece de fingerprint propio de expectation set. E1 añade un binding de snapshot
`pharmaceutical-scoring-expectation-binding-v2/1`, con grupos/miembros canónicos, sin alterar el contrato M6-B.

## Weights exactos

Representación `SCALED_INTEGER`: `scale` explícita (0–18), `expectedTotal: '1'` y entradas
`{ scoringUnitId, units }`, donde units es decimal string entero canónico no negativo.
Se exige exactamente una entrada por unidad del plan, también para las unidades NOT_APPLICABLE.
La suma de units, calculada mediante BigInt, debe ser exactamente `10^scale`.
No epsilon, floats tolerantes, valores negativos/no finitos, entradas faltantes/extra/duplicadas ni renormalización.
La representación y escala forman parte del snapshot y fingerprint.

La elección técnica usa aritmética entera exacta, coherente con las fracciones BigInt de M5,
pero **no copia los pesos ni reglas pedagógicas SPFA**. No existe export de pesos clínicos reales/default.
Los pesos de tests son artificiales y no son una rúbrica aprobada.

## Thresholds, rounding y aprobación

Thresholds tiene estado discriminado:

- `NO_THRESHOLDS`: decisión explícita admisible bajo rules/1.
- `UNCONFIGURED / DECISION_REQUIRED`: snapshot válido, input calculable bloqueado.
- `DEFINED`: lista explícita de `{ thresholdId, minimumScore }`, representable y validada como snapshot futuro;
  no utilizable bajo rules/1 / passFail NONE. Necesita autorización/versionado posterior de reglas, no activa un aprobado.

Rounding admite `UNCONFIGURED / DECISION_REQUIRED` o `CONFIGURED` con escala, modo y `FINAL_SCORE_ONLY`.
Se pueden representar HALF_UP, HALF_EVEN o DOWN; ninguno se selecciona por defecto ni se aplica en E1.

Plan, weights, thresholds y rounding requieren `approval: APPROVED` para construir un score input.
La falta de cualquiera, su no aprobación, rounding no configurada o thresholds no activables produce
`PEDAGOGICAL_CONFIGURATION_REQUIRED`, distinguible de un error técnico. No se fabrica configuración de sustitución.
Approval es metadata de un snapshot **server-owned**, no autorización para confiar en JSON del cliente.
La autenticación docente y el workflow de aprobación no se implementan en E1.

## Frontera de input y deuda D3B

`buildPharmaceuticalScoreInputV2` recibe configuración y witnesses server-owned:

- Fuente canónica M6-C completa y contexto a validar por reconstrucción.
- D1 set y accepted batches, revalidados contra ese contexto con validadores existentes.
- D2 explícitamente `NOT_PROVIDED / NOT_REQUESTED` o `PROVIDED` con request, provider result y finding set,
  revalidados por reconstrucción. No se acepta convertir un fallo o dato ausente en findings vacíos.
- Estado de aceptación semántica por lane: VALIDATED_OFFLINE, LIVE_ACCEPTED o VALIDATION_DEBT.

Los witnesses con texto/raw provider **no se serializan** al input ni al receipt. Solo se usa el output canónico validado.
El input conserva bindings de sesión/caso/transcript, policy/plan/weights/thresholds/rounding, targets/expectations/contexto/D1/D2,
sus versiones/fingerprints, outcomes D1 mínimos y review flags. Las evidencias siguen trazables
mediante los artefactos canónicos identificados por sus fingerprints; los modelos/ejecuciones D1, mediante el set y sus semanticExecutionRefs.
No contiene hechos del paciente, texto libre para decidir puntos, raw prompts, raw responses, CoT ni confidence.

Los estados de aceptación deben provenir del registro server-owned, no de un provider ni de su respuesta.
La agregación da prioridad a VALIDATION_DEBT; no promueve VALIDATED_OFFLINE a LIVE_ACCEPTED.
Si D2 no se proporciona, el binding lo expresa: no implica aceptación de D2. El estado agregado describe solo las fuentes presentes.
El validador reconstruye los estados/bindings desde esos witnesses y rechaza una promoción de deuda en el input persistido.
**Validado estructuralmente no significa clínicamente correcto ni live-accepted**. D3B sigue abierto.

Flags mínimos: UNCERTAIN_D1 (targetRef), CONTRADICTORY_D2 / UNSUPPORTED_D2 (claimId),
UPSTREAM_VALIDATION_DEBT (lane). INCORRECT_D1 es una preferencia adicional explícita.
No hay severidad safety ni penalización asociada a estos flags.

## Validación E1 de resultados y receipt: solo estructura

`PharmaceuticalSessionScoreV2` es el sobre `{ result, fingerprint, receipt }`.
result admite SCORED, PROVISIONAL_REVIEW_REQUIRED, NOT_SCORABLE e INVALID.
SCORED/provisional requieren normalizedScore finito entre 0–100 y denominador positivo.
NOT_SCORABLE requiere null y cero posible; INVALID requiere valores numéricos null, código y ninguna contribución parcial.
earned/possible se expresan como fracciones exactas no negativas; el validador reduce su representación.

Contribuciones conservan unidad/dominio/operador/aplicabilidad y todos los memberOutcomes; desglose de dominio conserva refs de unidades.
Se comprueban cobertura, fuentes, rangos y que no se atribuya crédito positivo a miembros no elegibles.
M6-E1F1: **COMPLETE**. No se deriva possible desde weights, escala o aplicabilidad ni se compara con una reconstrucción aritmética.
Se preservan todos los flags. SCORED no puede ocultar revisión obligatoria.

**Límite deliberado:** el validador no agrega earned/possible, no aplica ALL_OF/ONE_OF para generar puntos,
no calcula normalizedScore ni redondea. No certifica equivalencia aritmética entre desglose y total.
`validationScope: STRUCTURAL_ONLY` es obligatorio en result y receipt; esta validación no es autorización de publicación académica.
El cálculo numérico pertenece exclusivamente al scorer E2; no se ha reintroducido aritmética de scoring en E1.

El receipt contiene rulesVersion, todos los source bindings, inputFingerprint y resultFingerprint.
El fingerprint del resultado cubre el cuerpo canónico (incluidas fuentes/flags), excluyendo el propio receipt para evitar circularidad.
Se valida la igualdad exacta del receipt reconstruido; no se permiten campos libres con prompts/respuestas/secretos.

## M6-E2 — motor determinista configuration-gated

API pura en `lib/cases/v2/calculate-pharmaceutical-session-score.ts`:

```ts
calculatePharmaceuticalSessionScoreV2(input, configuration, source)
// configuration = { policy, plan, weights, thresholds, rounding }
// source: PharmaceuticalScoreSourceV2, witnesses exclusivamente server-owned
// returns PharmaceuticalSessionScoreV2 = { result, fingerprint, receipt }
```

El resultado representa el **Subscore de demostración farmacéutica sobre objetivos canónicos del caso**,
no una evaluación farmacéutica integral. No cambia DTO/UI ni agrega SPFA, comunicación, cuestionario o safety.
No usa IO, reloj, aleatoriedad, lookup mutable ni conocimiento externo. La reconstrucción estructural upstream
E1 verifica las fuentes; el scorer no interpreta semánticamente texto ni vuelve a adjudicar mensajes.

Antes de calcular valida input persistido, configuración y aprobación, bindings/fingerprints, cobertura del plan,
pesos exactos y witnesses reconstruidos D1/D2. No confía en un hash declarado ni en JSON de aprobación del cliente.
Sin configuración aprobada/configurada: `PEDAGOGICAL_CONFIGURATION_REQUIRED`. Fuentes inválidas fallan con
errores tipados E1, sin resultado numérico parcial. D2 `NOT_PROVIDED / NOT_REQUESTED` es distinto de un fallo
o `PROVIDED` incompleto: estos últimos no se sustituyen por un set vacío.

| Regla | Cálculo E2 |
|---|---|
| SINGLE | Un miembro exacto; crédito 1 solo para CORRECTLY_DEMONSTRATED. |
| ALL_OF | Crédito 1 si todos son CORRECTLY_DEMONSTRATED; en otro caso 0, sin crédito parcial. |
| ONE_OF | Crédito 1 si al menos uno es CORRECTLY_DEMONSTRATED; nunca se multiplica por miembros correctos. |
| Otros outcomes D1 | Crédito 0, también shells STRUCTURAL_NO_STUDENT_CANDIDATES; no se fabrica verdict. |
| APPLICABLE | possible = peso; earned = peso si crédito 1, si no 0. |
| NOT_APPLICABLE | earned y possible = 0, exclusivamente por plan aprobado; no redistribuye pesos. |
| D2, cualquiera de sus claim forms | Sin efecto numérico; CONTRADICTORY/UNSUPPORTED únicamente añaden revisión. |

Los acumuladores son BigInt con denominador común `10^weights.scale`. Totales, unidades y dominios se serializan
como fracciones exactas reducidas. No se cuentan de nuevo targets/medicamentos/PRM/RNM/barreras; solo unidades
y pesos explícitos. Una conclusión negativa, incluido `REFERRAL_NEED = not_required`, no implica NOT_APPLICABLE.

Con possible > 0 se calcula exactamente `100 × earned / possible`. Rounding debe estar configurado/aprobado;
se aplica una sola vez, al normalizedScore final. Se ejecuta el modo explícito HALF_UP, HALF_EVEN o DOWN y escala
0–18, sin redondeos intermedios ni defaults. Solo al serializar el decimal ya redondeado se convierte al `number`
finito 0–100 exigido por E1; la representación final tiene la precisión IEEE-754 de ese campo, no la de los
acumuladores exactos. No se añaden normalizedDomainScore ni academic pass/fail. Solo NO_THRESHOLDS es utilizable
bajo rules/1; DEFINED sigue bloqueado.

Estado, en este orden:

1. possible = 0: NOT_SCORABLE, normalizedScore null y cero exacto, incluso si hay review flags (se conservan).
2. possible > 0 con cualquier flag obligatorio/preferencia configurada: PROVISIONAL_REVIEW_REQUIRED.
3. possible > 0 sin flags: SCORED. No equivale a aprobación académica ni LIVE_ACCEPTED.

Los flags canónicos reconstruidos E1 se preservan literalmente: UNCERTAIN_D1 por target, CONTRADICTORY_D2 /
UNSUPPORTED_D2 por claim e UPSTREAM_VALIDATION_DEBT por lane. INCORRECT_D1 solo si reviewIncorrectD1 es true.
No se duplican al calcular; no se pueden borrar/promover flags en un input persistido. La deuda D3B fuerza
provisional si es calculable, sin penalizar al alumno ni cambiar la aritmética.

Se conserva el shape E1 exacto: unit contributions contienen IDs, domain, operator, applicability y memberOutcomes
(estos llevan targetRef y estado semántico/estructural), earned/possible; no se inventa un campo creditState ni
flags por unidad. Las señales se vinculan mediante targetRef/claimId en result.reviewFlags. Domain breakdown
contiene todas y solo las unidades de cada dominio presente, incluidos dominios con possible 0.

El receipt conserva sources (policy/plan/weights/rounding/thresholds, sesión/caso, targets/expectations/contexto,
transcript, D1 y D2), inputFingerprint y resultFingerprint. La derivación se audita con los bindings del plan/pesos,
outcomes por unidad y flags del result; no se agregan campos no contemplados por E1 ni texto raw al receipt.
SHA-256 cubre el result canónico con fuentes y flags, no el propio receipt; después se valida el sobre con
`validatePharmaceuticalSessionScoreV2`. Snapshots y permutations de arrays canónicos reproducen el mismo resultado;
cambios materiales de outcome, configuración, aplicabilidad, rounding, review preference o deuda cambian su huella.

**Coverage profile:** no es precondición matemática adicional. Plan/weights aprobados bastan para calcular;
el perfil de cobertura sigue pendiente para interpretación/comparabilidad académica en PED2. No se amplían schemas.
La arquitectura curricular prevista CASE_PROFILE_DOMAIN_BUDGET no instala perfiles docentes ni cifras en E2.

## Canonicalización y errores

SHA-256 sobre JSON de `[canonicalization, core]` con claves de objetos ordenadas recursivamente.
Arrays de unidades, pesos, flags, outcomes, grupos y referencias se ordenan por identidad, nunca por locale del proceso.
Builders/validators devuelven snapshots copiados y profundamente congelados. No normalizan texto clínico ni dependen del reloj o de lookup mutable.

Errores tipados: UNSUPPORTED_VERSION, SOURCE_BINDING_MISMATCH, FINGERPRINT_MISMATCH,
INVALID_TARGET_COVERAGE, INVALID_SCORING_PLAN, INVALID_WEIGHT_CONFIGURATION, INCOMPLETE_UPSTREAM,
UNVALIDATED_SOURCE, INVALID_NUMERIC_STATE, PEDAGOGICAL_CONFIGURATION_REQUIRED e INVALID_CONTRACT.
Mensajes de error: código y path estructural únicamente, sin valores ni causas raw upstream.

## Validación y trabajo pendiente

Validación M6-E2: **98/98 tests nuevos del scorer**, **156/156 E1**, **142/142 D1**, **228/228 D2**.
Suite completa: **3185 PASS / 25 SKIPPED**, 78 archivos PASS / 5 SKIPPED. TypeScript `--incremental false`
y diff-check PASS. Cero OpenAI/live/DB: gates explícitamente desactivados; 7 live y 18 PostgreSQL omitidos.
La primera invocación multi-worker necesitó fijar minWorkers=1 junto a maxWorkers=2;
el primer arranque de la suite completa fue bloqueado por EPERM del sandbox antes de ejecutar tests.
La repetición offline autorizada con esos límites completó la suite sin cambios de código por esos problemas.
Check adicional de lint: `next lint --no-cache` solicita configurar ESLint (no hay configuración existente),
por lo que no se ejecutó lint ni se aceptó el setup. Queda explícito como limitación preexistente, fuera de E2.

Cobertura E2: SINGLE (5), ALL_OF/ONE_OF y no doble conteo (14), applicability/NOT_SCORABLE (6),
aritmética exacta/rounding/desglose (21), revisión/D2/deuda (9), receipt/fingerprints/frontera E1 (9),
precondiciones negativas/adversariales (34). Todas las configuraciones son test-only; el caso básico tiene
tres unidades artificiales 50/30/20. Los casos agrupados respetan relaciones clínicas upstream con unidades
relacionales explícitas de peso cero; ampliar miembros/medicamentos no amplía el presupuesto de la unidad.

Validación tras M6-E1F1: **156/156 tests E1** (129 previos + 27 de frontera estructural).
Validación anterior a F1: **493/493 incluyendo contratos upstream relacionados**,
**3060 PASS / 25 SKIPPED** en la suite normal completa (77 archivos PASS, 5 SKIPPED).
TypeScript `npx tsc --noEmit --incremental false`: PASS. `git diff --check`: PASS.
Suite ejecutada con dos workers y gates live/PostgreSQL desactivados: 7 live + 18 PostgreSQL SKIPPED.
No OpenAI real, live ni DB. El primer arranque de la suite tuvo un EPERM del sandbox antes de ejecutar tests;
la repetición offline con permisos adecuados completó toda la suite sin cambiar código para ello.

Tests offline con fuentes M6-A/B/C reales y adjudicaciones sintéticas validadas: versiones, bindings,
overlaps, cobertura, aplicabilidad, pesos exactos, configuración ausente, D2 review-only, deuda,
reproducibilidad, sensibilidad de fingerprints, inmutabilidad, resultados/receipt strict y ausencia de raw data.
No se cambian fixtures ni contratos D1/D2, matrices históricas, runtime, API o DB.

Pendiente: aprobación de plan/unidades/dominios/aplicabilidad y pesos; rounding; autorización de umbrales futuros si se desean.
No existe una política clínica por defecto. El cálculo E2 se mantiene separado de la validación estructural E1.
Persistencia, integración productiva, liberación de feedback, UI docente, agregación global y safety/hard-fail
quedan para incrementos posteriores explícitos y no se consideran implementados por este motor.
