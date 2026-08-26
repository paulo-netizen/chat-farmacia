# 17 — Diseño versionado de protocolo SPFA y cobertura de información

## 1. Estado y alcance

Este documento fija el contrato conceptual y registra la implementación
aceptada de M5 para describir, aplicar, evaluar, puntuar y persistir protocolos
SPFA versionados. M5 queda `CLOSED / COMPLETE` tras G6. No incorpora todavía
catálogos clínicos completos, interfaz docente/alumno, feedback M6 ni analytics.

El diseño debe permitir responder, para una sesión ligada a una versión
inmutable del caso:

- qué información o actuación exigía cada SPFA del recorrido asistencial;
- si el requisito aplicaba al caso;
- cuál era su importancia efectiva y si era crítico para la seguridad;
- qué hechos o conclusiones canónicas sustentaban el requisito;
- si el estudiante llegó a disponer de la información;
- si la información era pública, espontánea, obtenida por exploración o mixta;
- qué parte quedó pendiente y si existió una omisión crítica.

M5-A no fija una fórmula numérica, pesos, penalizaciones, límites de nota ni un
evaluador LLM. Tampoco completa desde conocimiento general los protocolos de
Dispensación o Indicación Farmacéutica. El contenido clínico se incorporará
solo desde fuentes y catálogos docentes validados.

## 2. Invariantes docentes

1. El estudiante no recibe de antemano la etiqueta del SPFA inicial.
2. La referencia docente es el `EvaluatorViewV2.carePath` validado para la
   versión exacta del caso, no una inferencia posterior sobre la conversación.
3. Se evalúa información semánticamente cubierta, no frases literales, palabras
   clave ni un número fijo de preguntas.
4. Un dato aportado espontáneamente por el paciente ya está disponible; el
   estudiante no tiene que volver a preguntarlo para obtener crédito.
5. Formular una pregunta no demuestra que se haya obtenido una respuesta.
6. Una afirmación, hipótesis o suposición del estudiante no crea un hecho del
   paciente.
7. La información clínica solo puede considerarse disponible cuando procede de
   información pública autorizada o de una intervención aceptada del paciente.
8. `CRITICAL`, `RELEVANT` y `OPTIONAL` expresan importancia de requisitos que sí
   aplican. `NOT_APPLICABLE` expresa una decisión de aplicabilidad del caso.
9. Dispensación conserva la distinción `initial_treatment` / `continuation`.
10. Indicación se representa mediante dominios de información y actuaciones de
    seguridad, sin convertir todos los dominios en críticos para todos los casos.
11. Las transiciones usan el grafo asistencial ya existente y ocurren en el mismo
    episodio y chat.
12. M5 no duplica los modelos de adherencia, PRM/RNM, barreras, estrategias,
    actuaciones profesionales o intervenciones ya definidos en
    `EvaluatorViewV2`.

## 3. Tres niveles separados

### 3.1. Definición reutilizable del protocolo

`SpfaProtocolDefinitionV2` es un catálogo docente versionado. Define la
semántica estable de sus requisitos y nunca contiene `CaseVersionId`, `FactId`,
`MedicationId`, `ConclusionId`, evidencia de sesión ni puntuaciones.

### 3.2. Aplicación a una versión del caso

`CaseSpfaProtocolApplicationV2` liga una definición concreta con un único
`SpfaConclusion` del `EvaluatorViewV2.carePath` de una versión del caso.
Materializa aplicabilidad, importancia efectiva y targets canónicos del caso.

### 3.3. Resultado de una sesión

La evaluación futura produce resultados de cobertura o actuación para cada
requisito aplicado. Estos resultados citan evidencia real de la sesión, pero no
modifican la definición ni la aplicación del caso.

Esta separación impide que una traducción de UI, un cambio de label o una nueva
versión del protocolo reinterpreten sesiones históricas.

## 4. Identidades y referencias conceptuales

Los identificadores técnicos deben ser nominales, opacos y validados. El texto
visible no forma parte de la identidad.

```ts
declare const spfaProtocolIdBrand: unique symbol;
declare const spfaProtocolRequirementIdBrand: unique symbol;
declare const spfaApplicabilityPolicyIdBrand: unique symbol;
declare const spfaRequirementTargetIdBrand: unique symbol;
declare const sessionMessageIdBrand: unique symbol;

type SpfaProtocolId = string & {
  readonly [spfaProtocolIdBrand]: true;
};

type SpfaProtocolRequirementId = string & {
  readonly [spfaProtocolRequirementIdBrand]: true;
};

type SpfaApplicabilityPolicyId = string & {
  readonly [spfaApplicabilityPolicyIdBrand]: true;
};

type SpfaRequirementTargetId = string & {
  readonly [spfaRequirementTargetIdBrand]: true;
};

type SessionMessageId = string & {
  readonly [sessionMessageIdBrand]: true;
};

type SpfaProtocolRefV2 = Readonly<{
  protocolId: SpfaProtocolId;
  version: string;
}>;
```

`SessionMessageId` no es UUID. Representa el `bigint` positivo de PostgreSQL
como decimal string canónico: solo `[1-9][0-9]*`, con límite superior
`9223372036854775807`. No admite cero, signo, ceros iniciales, decimales,
notación exponencial ni conversión a `number` de JavaScript.

Una nueva versión conserva un `SpfaProtocolRequirementId` cuando el significado
docente sigue siendo el mismo. Si el significado cambia de forma incompatible,
debe recibir otro ID. `teacherLabel` y `description` son metadata editable y
localizable, no claves de matching.

## 5. Dominios semánticos

### 5.1. Decisión sobre `DisclosureDomain`

`DisclosureDomain` no se reutiliza como enum completa del protocolo. Su función
es controlar qué hechos puede revelar el paciente y bajo qué condiciones. Un
protocolo SPFA también necesita representar razonamiento y actuaciones que el
paciente no “revela”, como identificación del servicio, subtipo de dispensación,
criterios de derivación, actuación segura o detección de otro SPFA.

Para evitar duplicación, `SpfaInformationDomain` puede contener un
`DisclosureDomain` cuando el concepto es información factual del paciente, pero
añade un espacio separado y explícito para conceptos propios del protocolo:

```ts
type SpfaInformationDomain =
  | {
      kind: 'patient_information';
      disclosureDomain: DisclosureDomain;
    }
  | {
      kind: 'protocol_information';
      domain:
        | 'service_context'
        | 'dispensing_subtype'
        | 'referral_criteria'
        | 'pharmacy_intervention_possibility'
        | 'additional_spfa_need';
    };

type SpfaActionDomain =
  | 'safe_professional_action'
  | 'referral_action'
  | 'report_action'
  | 'care_path_transition';
```

Esta lista no es un checklist clínico. Solo demuestra que el contrato puede
distinguir información del paciente, interpretación del protocolo y actuación.
Los catálogos docentes posteriores podrán ampliar los dominios de forma
versionada.

Los dominios ya documentados para Indicación pueden expresarse mediante
`DisclosureDomain` existentes —por ejemplo `symptoms`,
`symptom_timing_and_evolution`, `prior_actions`, `medication_identity`,
`allergies_intolerances`, `clinical_history` y `physiological_status`— y mediante
los dominios de protocolo para derivación, actuación desde farmacia y detección
de otras necesidades. Que un dominio exista en el protocolo no determina por sí
solo que sea `CRITICAL` en un caso concreto.

## 6. Definición de protocolo

```ts
type ApplicableRequirementImportance =
  | 'CRITICAL'
  | 'RELEVANT'
  | 'OPTIONAL';

type SpfaRequirementApplicabilityDefinitionV2 =
  | { kind: 'ALWAYS' }
  | {
      kind: 'DISPENSING_SUBTYPE';
      subtypes: NonEmptyArray<DispensingSubtype>;
    }
  | {
      kind: 'CASE_DETERMINED';
      policyRef: SpfaApplicabilityPolicyId;
    };

type SpfaSafetyCriticalityV2 = Readonly<{
  safetyCritical: boolean;
}>;

type SpfaInformationRequirementDefinitionV2 = Readonly<{
  kind: 'INFORMATION_REQUIREMENT';
  requirementId: SpfaProtocolRequirementId;
  semanticDomain: SpfaInformationDomain;
  teacherLabel: string;
  description: string;
  defaultImportance: ApplicableRequirementImportance;
  informationGoal: string;
  safetyCriticality: SpfaSafetyCriticalityV2;
  applicability: SpfaRequirementApplicabilityDefinitionV2;
}>;

type SpfaActionRequirementDefinitionV2 = Readonly<{
  kind: 'ACTION_REQUIREMENT';
  requirementId: SpfaProtocolRequirementId;
  semanticDomain: SpfaActionDomain;
  teacherLabel: string;
  description: string;
  defaultImportance: ApplicableRequirementImportance;
  actionGoal: string;
  safetyCriticality: SpfaSafetyCriticalityV2;
  applicability: SpfaRequirementApplicabilityDefinitionV2;
}>;

type SpfaProtocolRequirementDefinitionV2 =
  | SpfaInformationRequirementDefinitionV2
  | SpfaActionRequirementDefinitionV2;

type SpfaProtocolDefinitionV2 = Readonly<{
  schemaVersion: '2.0';
  protocolId: SpfaProtocolId;
  version: string;
  service: SpfaService;
  subtype?: DispensingSubtype;
  requirements: NonEmptyArray<SpfaProtocolRequirementDefinitionV2>;
}>;
```

`informationGoal` y `actionGoal` son explicaciones docentes versionadas; las
relaciones internas siguen dependiendo de IDs. Una implementación posterior
podrá sustituir esos textos por una estructura más rica sin alterar la identidad
del requisito.

La aplicabilidad `CASE_DETERMINED` referencia una política del mismo catálogo
versionado. M5-A no inventa un lenguaje de reglas clínicas. La aplicación al caso
debe materializar el resultado de esa política antes de publicar.

Para Dispensación, una definición sin `subtype` puede contener requisitos comunes
y usar aplicabilidad por subtipo. Una definición con `subtype` queda restringida
a `initial_treatment` o `continuation`. El validador futuro impedirá combinaciones
ambiguas o incompatibles. Así pueden divergir los dos recorridos sin duplicar su
identidad común ni rellenar ahora su contenido clínico.

## 7. Targets tipados del caso

Las relaciones canónicas no usan labels ni strings clínicos libres como claves.
Cada target aplicado recibe además un ID opaco estable dentro de la versión del
caso para poder expresar cobertura parcial sin comparar objetos completos.

```ts
type SpfaPublicProfileFieldV2 = 'age' | 'sex';

type SpfaInformationTargetV2 =
  | { kind: 'FACT'; factRef: FactId }
  | {
      kind: 'PUBLIC_PROFILE';
      field: SpfaPublicProfileFieldV2;
    }
  | {
      kind: 'MEDICATION_ENTITY';
      medicationRef: MedicationId;
    }
  | {
      kind: 'MEDICATION_FACT';
      medicationRef: MedicationId;
      factRef: FactId;
    };

type SpfaActionTargetV2 =
  | {
      kind: 'EVALUATOR_CONCLUSION';
      conclusionRef: ConclusionId;
    }
  | {
      kind: 'CARE_PATH_TRANSITION';
      transitionRef: ConclusionId;
    };

type BoundSpfaInformationTargetV2 = Readonly<{
  targetId: SpfaRequirementTargetId;
  target: SpfaInformationTargetV2;
}>;

type BoundSpfaActionTargetV2 = Readonly<{
  targetId: SpfaRequirementTargetId;
  target: SpfaActionTargetV2;
}>;
```

La edad y el sexo reutilizan la misma allowlist clínica existente en
`EvidenceLeafRef`. `name` no es evidencia clínica y no se incorpora.
`StudentPublicView.tratamiento` es un resumen textual para la ficha del
estudiante: los requisitos farmacoterapéuticos deben usar `MedicationId` y hechos
estructurados. El evaluador futuro podrá reconocer como `PUBLIC_INFORMATION` una
medicación estructurada que esté materializada en ese resumen, pero nunca deberá
comparar el texto del resumen como identidad.

Un target de información expresa qué dato debe llegar a estar disponible. Un
target de actuación expresa qué conclusión o transición docente debe realizarse.
No se usa una `ConclusionId` para fingir que una decisión es un hecho del paciente.

## 8. Aplicación del protocolo al caso

```ts
type AppliedRequirementApplicabilityV2 =
  | {
      status: 'APPLICABLE';
      effectiveImportance: ApplicableRequirementImportance;
    }
  | {
      status: 'NOT_APPLICABLE';
      reason: AppliedNotApplicableReasonV2;
    };

type AppliedNotApplicableReasonV2 =
  | {
      kind: 'DISPENSING_SUBTYPE_MISMATCH';
    }
  | {
      kind: 'CASE_DETERMINED';
      policyRef: SpfaApplicabilityPolicyId;
    };

type AppliedInformationRequirementV2 = Readonly<{
  kind: 'INFORMATION_REQUIREMENT';
  requirementRef: SpfaProtocolRequirementId;
  applicability: AppliedRequirementApplicabilityV2;
  informationTargets: readonly BoundSpfaInformationTargetV2[];
}>;

type AppliedActionRequirementV2 = Readonly<{
  kind: 'ACTION_REQUIREMENT';
  requirementRef: SpfaProtocolRequirementId;
  applicability: AppliedRequirementApplicabilityV2;
  actionTargets: readonly BoundSpfaActionTargetV2[];
}>;

type AppliedSpfaRequirementV2 =
  | AppliedInformationRequirementV2
  | AppliedActionRequirementV2;

type CaseSpfaProtocolApplicationV2 = Readonly<{
  schemaVersion: '2.0';
  caseVersionId: CaseVersionId;
  carePathSpfaRef: ConclusionId;
  protocolRef: SpfaProtocolRefV2;
  requirements: NonEmptyArray<AppliedSpfaRequirementV2>;
}>;
```

Reglas de validación futuras:

- `carePathSpfaRef` debe apuntar exactamente a un `SpfaConclusion` existente en
  `carePath.initialSpfa` o `carePath.additionalSpfas`;
- servicio y subtipo de la definición fijada deben coincidir con ese
  `SpfaConclusion`;
- cada `requirementRef` debe existir una sola vez en la definición fijada y ser
  del mismo `kind`;
- un requisito `APPLICABLE` debe tener importancia efectiva, mientras que uno
  `NOT_APPLICABLE` no puede tenerla;
- un requisito aplicable debe tener los targets que su definición exige; uno no
  aplicable no debe transportar targets evaluables;
- todo `FactId`, `MedicationId` y `ConclusionId` debe existir en la fuente de
  verdad de esa misma `caseVersionId` y tener el tipo esperado;
- `safetyCriticality.safetyCritical` se obtiene de la definición fijada y es
  independiente de `effectiveImportance`; no se infiere del label;
- no puede haber aplicaciones huérfanas, duplicadas ni ligadas a otra versión.

### 8.1. Política de `NOT_APPLICABLE`

`NOT_APPLICABLE` no es un cuarto nivel de importancia. Es el resultado de
aplicar una regla versionada a un caso concreto. Por ello:

- nunca se confunde con `OPTIONAL`;
- no genera penalización ni requisito pendiente;
- no recibe cobertura ni resultado de actuación ordinarios;
- debe conservar su razón tipada para trazabilidad: mismatch de subtipo o la
  política `CASE_DETERMINED` exacta que se materializó;
- un resultado de sesión `NOT_APPLICABLE` debe estar respaldado por la aplicación
  del caso, no ser decidido ad hoc por el evaluador de la transcripción.

### 8.2. Set de protocolos fijado por versión de caso

`CaseSpfaProtocolSetV2` agrupa únicamente las definiciones exactas utilizadas
por una versión de caso y sus aplicaciones ya ligadas a los nodos del
`carePath`:

```ts
type CaseSpfaProtocolSetV2 = Readonly<{
  schemaVersion: '2.0';
  catalogRef: VersionRef;
  definitions: NonEmptyArray<SpfaProtocolDefinitionV2>;
  applications: NonEmptyArray<CaseSpfaProtocolApplicationV2>;
}>;
```

`catalogRef` coincide exactamente con `EvaluatorViewV2.versions.protocol` y
representa el catálogo o paquete docente versionado con el que se construyó el
evaluator. No es la referencia a un protocolo individual. Cada definición
individual conserva su identidad exacta `SpfaProtocolId + version`, y cada
aplicación resuelve su `protocolRef` contra una de esas definiciones sin usar
servicio, subtipo, label ni posición como matching.

El set contiene exactamente una aplicación para `carePath.initialSpfa` y una
para cada elemento de `carePath.additionalSpfas`. No admite aplicaciones
huérfanas o duplicadas ni definiciones sin uso: no es el catálogo completo de
la instalación, sino el subconjunto inmutable fijado para esa `caseVersionId`.

La frontera de enriquecimiento mantiene dos etapas explícitas:

```text
CanonicalGeneratedCaseCoreV2
  patientFacts + evaluator
        ↓ SPFA enrichment boundary
SpfaIntegratedGeneratedCaseCoreV2
  patientFacts + evaluator + spfaProtocolSet
```

El core canónico sigue siendo el resultado del ensamblado IA y no adquiere
publicabilidad implícita. El core integrado demuestra que el recorrido SPFA
tiene definiciones y aplicaciones completas y fijadas, pero su incorporación
al bundle final y al lifecycle de publicación pertenece a M5-C2B.

### 8.3. Snapshot inmutable del transcript de sesión

M5-D1 fija el transcript evaluable mediante:

```ts
type SessionTranscriptMessageV2 = Readonly<{
  messageId: SessionMessageId;
  role: 'student' | 'patient';
  content: string;
  createdAt: string;
}>;

type SessionTranscriptFingerprintV1 = Readonly<{
  algorithm: 'sha256';
  canonicalization: 'session-transcript-v2/1';
  value: string;
}>;

type SessionTranscriptSnapshotV2 = Readonly<{
  schemaVersion: '2.0';
  sessionId: string;
  caseVersionId: CaseVersionId;
  messages: readonly SessionTranscriptMessageV2[];
  fingerprint: SessionTranscriptFingerprintV1;
}>;
```

El `createdAt` de entrada debe ser un instante ISO/RFC3339 con timezone explícito:
`Z` o un offset `±HH:MM`. Los timestamps locales sin offset y las fechas
imposibles se rechazan. La salida se normaliza siempre con `Date.toISOString()`;
así, el fingerprint no depende de la zona horaria del proceso. Los mensajes se
ordenan por ese instante UTC ascendente y, en empate, por el valor numérico
`BigInt` de `messageId` ascendente. Así, `9` precede a `10` sin perder precisión. El
fingerprint SHA-256 cubre `sessionId`, `caseVersionId` y todos los campos de cada
mensaje ya ordenado. La canonicalización se identifica como
`session-transcript-v2/1`.

Un snapshot persistido no es autoridad por contener un hash: su boundary valida
las claves exactas, reconstruye el contenido canónico, recalcula el fingerprint
y exige igualdad exacta. Los mensajes se copian a objetos nuevos y un ID de
mensaje solo puede aparecer una vez.

### 8.4. Baseline determinista y universo semántico

M5-D2 reconoce de forma determinista únicamente los targets
`PUBLIC_PROFILE(age|sex)`. Un target `FACT`, `MEDICATION_ENTITY` o
`MEDICATION_FACT`, y cualquier target de actuación, permanece `unresolved`.
Aunque `StudentPublicView.tratamiento` sea visible, su texto no permite resolver
por sí solo una entidad o un hecho farmacoterapéutico y nunca se compara como
identidad.

```ts
type SpfaDeterministicResolutionV2 =
  | 'NOT_APPLICABLE'
  | 'DETERMINISTIC_COMPLETE'
  | 'DETERMINISTIC_PARTIAL'
  | 'SEMANTIC_REQUIRED';

type SpfaSemanticEvidenceCandidateV2 = Readonly<{
  targetRef: SpfaRequirementTargetId;
  messageRef: SessionMessageId;
}>;
```

`unresolved` no significa `NOT_COVERED`: indica exclusivamente que el transcript
todavía requiere interpretación. Para información, el universo contiene el
producto de cada target no resuelto por cada mensaje `patient`; para actuaciones,
por cada mensaje `student`. Respeta primero el orden de targets de la aplicación
y después el orden canónico del transcript. Los targets públicos ya resueltos y
los requisitos `NOT_APPLICABLE` no generan candidatos.

Un candidato no es evidencia ni un match semántico. El universo solo limita los
pares target↔mensaje que una capa posterior puede referenciar. La selección
validada puede elegir un subconjunto y se reordena según el universo, pero tampoco
demuestra cobertura, actuación ni pertinencia clínica. No admite confidence,
score, rationale, excerpt, evidence kind, origin, modelo ni feedback. M5-D3 será
la única etapa que podrá convertir candidatos validados en evidencia semántica,
si resulta necesaria, detrás de contratos fail-closed.

El materializador D2 solo emite un resultado D1 cuando no queda interpretación
pendiente: información completamente pública produce `COVERED` con origen
`PUBLIC_INFORMATION`, y un requisito no aplicable produce `NOT_APPLICABLE`.
`DETERMINISTIC_PARTIAL` y `SEMANTIC_REQUIRED` devuelven `null`; nunca se fabrica
prematuramente `PARTIALLY_COVERED`.

### 8.5. Adjudicación semántica estructural

M5-D3A introduce `SpfaSemanticAdjudicationV2` únicamente para baselines
`DETERMINISTIC_PARTIAL` o `SEMANTIC_REQUIRED`. La adjudicación queda fijada a la
sesión, versión de caso, fingerprint completo del transcript, SPFA y requisito
exactos del baseline. Contiene exactamente una decisión `SUPPORTED`,
`NOT_SUPPORTED` o `UNCERTAIN` por cada target no resuelto y ninguna para targets
públicos ya resueltos. `UNCERTAIN` conserva una decisión distinta de
`NOT_SUPPORTED`; ninguna de las dos se convierte todavía en cobertura final.

Cada soporte semántico debe reutilizar un par target↔mensaje del universo D2.
Para información, el mensaje es del paciente y se distingue una declaración
espontánea de una respuesta obtenida tras una pregunta anterior del estudiante.
La pregunta es metadata de origen referenciada mediante un mensaje D1 real; no
es un candidato D2 ni crea evidencia factual por sí sola. Una confirmación del
paciente solo puede ser `ELICITED`. Para actuaciones, el soporte es siempre un
mensaje del estudiante con `evidenceKind: STUDENT_ACTION`.

Los excerpts son opcionales, no vacíos y literales respecto del mensaje real.
No existe matching aproximado, reparación de referencias ni decisión semántica
basada en el texto dentro de D3A. La frontera valida estructura, referencias,
exhaustividad y orden canónico, pero preserva el status que aporta quien realiza
la adjudicación. Un candidato no es evidencia semántica y una adjudicación
semántica tampoco es todavía cobertura o resultado final D1.

### 8.6. Contexto canónico de targets semánticos

M5-D3B construye una proyección exclusivamente server-side para describir a la
etapa semántica los targets que D2 dejó sin resolver. No se devuelve al alumno,
no inspecciona el contenido del transcript, no adjudica y no materializa
cobertura D1. Antes de proyectar, revalida el core clínico y su set SPFA mediante
las fronteras C1/C2, reconstruye el baseline D2 desde el transcript D1 canónico y
exige equivalencia estructural completa con el baseline recibido.

El contexto contiene solo el servicio/subtipo SPFA, el dominio y goal del
requisito, y exactamente un descriptor por `unresolvedTargetRef`. Los facts se
describen mediante locations tipadas y un datum sin `factId`, disclosure ni
perfil comunicativo. Los medicamentos aportan únicamente su `displayName`; un
target farmacoterapéutico no arrastra dosis, pauta u otros facts salvo que sean
el dato solicitado. Las conclusiones y transiciones se proyectan de forma
allowlist sin evaluator completo, reglas de evidencia, scoring ni metadata de
seguridad.

`targetRef` es la identidad externa permitida para enlazar D2, D3C y D3A. Los
`factRef` y `medicationRef` permanecen server-side. El fingerprint
`spfa-semantic-target-context-v2/1` fija exactamente el pinning, la semántica
SPFA/requisito, los descriptors mínimos y los candidate message refs en orden
canónico. Cambiar un fact ajeno al target no altera el contexto ni su
fingerprint.

### 8.7. Frontera de request y transport semántico OpenAI

M5-D3C1 transforma el contexto canónico D3B y el transcript D1 en un request
server-only para el adjudicador semántico. El provider recibe únicamente D3B y
una proyección explícita de mensajes con `messageRef`, role y content: para
requisitos de información recibe la conversación student/patient aceptada y,
para actuación, solo los mensajes student candidatos. El transcript es dato no
confiable; cualquier instrucción contenida en sus mensajes carece de autoridad
sobre el adjudicador.

El transport del provider no es una `SpfaSemanticAdjudicationV2`. Structured
Outputs valida exclusivamente la forma cerrada de decisiones y supports; D3A
continúa siendo la autoridad sobre targets, mensajes, roles, orden y
referencias. El schema no contiene rationale, confidence, score, feedback ni
excerpt. Tampoco recibe fuente clínica oculta fuera de la allowlist D3B. La
normalización y validación contra D3A pertenecen a D3C2.

### 8.8. Executor semántico y autoridad D3A

M5-D3C2 fija una única cadena de ejecución:

```text
D3C1 request
→ responses.parse
→ D3C1 transport validation
→ server-owned normalization
→ D3A authority validation
→ execution receipt
```

El executor usa un cliente inyectable y configuración server-owned, desactiva
persistencia y retries del SDK, y toma snapshots canónicos del transcript y del
baseline antes de esperar al provider. Structured Outputs controla la forma,
pero nunca la autoridad: el provider no controla session, case version,
fingerprint, SPFA, requisito ni kind. La normalización inyecta ese pinning desde
el baseline y D3A valida obligatoriamente targets, mensajes, roles, orden y
universo de candidatos.

`UNCERTAIN` se conserva literalmente. No existen retries semánticos, reparación
de referencias, fallback de modelo, persistencia, scoring ni feedback. Modelo y
versión del prompt se registran únicamente en el receipt de ejecución y no se
incorporan a la adjudicación clínica.

## 9. Cobertura de información

```ts
type SpfaCoverageOriginV2 =
  | 'PUBLIC_INFORMATION'
  | 'PATIENT_SPONTANEOUS'
  | 'STUDENT_ELICITED'
  | 'MIXED';

type SpfaTranscriptEvidenceKindV2 =
  | 'PATIENT_STATEMENT'
  | 'PATIENT_CONFIRMATION'
  | 'STUDENT_QUESTION'
  | 'STUDENT_ACTION';

type SpfaSessionEvidenceRefV2 =
  | Readonly<{
      source: 'PUBLIC_INFORMATION';
      targetRef: SpfaRequirementTargetId;
    }>
  | Readonly<{
      source: 'TRANSCRIPT_MESSAGE';
      messageRef: SessionMessageId;
      speaker: 'student' | 'patient';
      evidenceKind: SpfaTranscriptEvidenceKindV2;
      excerpt?: string;
    }>;

type SpfaRequirementCoverageV2 =
  | Readonly<{
      status: 'COVERED';
      origin: SpfaCoverageOriginV2;
      coveredTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'PARTIALLY_COVERED';
      origin: SpfaCoverageOriginV2;
      coveredTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      uncertainTargetRefs: readonly SpfaRequirementTargetId[];
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'NOT_COVERED';
      coveredTargetRefs: readonly [];
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      uncertainTargetRefs: readonly SpfaRequirementTargetId[];
      evidence: readonly SpfaSessionEvidenceRefV2[];
    }>
  | Readonly<{
      status: 'NOT_APPLICABLE';
      evidence: readonly [];
    }>;
```

`PARTIALLY_COVERED` identifica exactamente qué targets se satisficieron y cuáles
faltan. En los estados incompletos, `uncertainTargetRefs` es obligatorio —aunque
esté vacío— y constituye un subconjunto canónico de `remainingTargetRefs`. Así,
los targets `UNCERTAIN` permanecen distinguibles de los `NOT_SUPPORTED` sin
persistir un array redundante `unsupportedTargetRefs`; este último se deriva por
diferencia. El excerpt es una ayuda de presentación; la autoridad es `messageRef` y
el mensaje inmutable de la sesión. Una implementación podrá añadir una referencia
estable de turno como metadata, pero no sustituir el ID real por un texto copiado.

Cuando existe, `excerpt` debe ser un string no vacío y un substring literal del
`content` real. No se acepta paráfrasis, fuzzy matching ni texto inventado. La
compatibilidad estructural también es estricta: `PATIENT_STATEMENT` y
`PATIENT_CONFIRMATION` solo pueden citar mensajes `patient`, mientras que
`STUDENT_QUESTION` y `STUDENT_ACTION` solo pueden citar mensajes `student`. El
`speaker` declarado debe coincidir además con el `role` real del mensaje.

`STUDENT_ASKED` no es un origen de cobertura. Una pregunta puede ser evidencia
de exploración, pero solo una respuesta aceptada del paciente —o información
pública— convierte el dato en disponible. Si el paciente responde “no lo sé”, el
target puede cubrirse únicamente cuando el hecho canónico sea precisamente
`patient_unknown`; no equivale a un negativo.

### 9.1. Información espontánea

Si el paciente dice «Soy yo y llevo tres días con tos», y esos targets aplican,
la intervención puede cubrir identidad/persona atendida y duración aunque el
estudiante nunca formule preguntas específicas. El origen es
`PATIENT_SPONTANEOUS`. Preguntar de nuevo no aporta crédito duplicado ni crea una
segunda cobertura.

Cuando el mismo contenido se obtiene tras una pregunta pertinente, el resultado
semántico de cobertura es equivalente y el origen es `STUDENT_ELICITED`. El
origen describe cómo estuvo disponible la información; no altera el hecho
clínico ni obliga a una puntuación distinta.

### 9.2. Afirmaciones del estudiante

«Entonces lleva tres días con tos» solo puede participar en evidencia si existe
un dato previo del paciente o una confirmación posterior aceptada del paciente.
«Supongo que lleva tres días con tos» no crea evidencia factual. Una intervención
del estudiante puede acreditar una actuación comunicativa o profesional, pero
nunca se promociona automáticamente a `PatientDatum` ni a hecho obtenido.

## 10. Resultado de requisitos de actuación

Los requisitos de actuación no usan la semántica de “información cubierta”. Su
resultado futuro es independiente:

```ts
type SpfaActionRequirementOutcomeV2 =
  | Readonly<{
      status: 'PERFORMED';
      performedTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'PARTIALLY_PERFORMED';
      performedTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      uncertainTargetRefs: readonly SpfaRequirementTargetId[];
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'NOT_PERFORMED';
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      uncertainTargetRefs: readonly SpfaRequirementTargetId[];
      evidence: readonly SpfaSessionEvidenceRefV2[];
    }>
  | Readonly<{
      status: 'NOT_APPLICABLE';
      evidence: readonly [];
    }>;
```

Por ejemplo, conocer un criterio de derivación puede ser información; decidir y
comunicar una derivación adecuada es una actuación. Pueden estar relacionados,
pero no comparten estado ni se satisfacen mutuamente de forma implícita.
`uncertainTargetRefs` aplica la misma semántica de subconjunto obligatorio de
`remainingTargetRefs` en `PARTIALLY_PERFORMED` y `NOT_PERFORMED`.

## 11. Integración con `carePath`

El único grafo asistencial continúa siendo `EvaluatorViewV2.carePath`:

- `initialSpfa` contiene el primer `SpfaConclusion`;
- `additionalSpfas` contiene los SPFA adicionales;
- `transitions` contiene `SpfaTransition` con sus `ConclusionId`.

Cada nodo SPFA recibe exactamente una `CaseSpfaProtocolApplicationV2` mediante
`carePathSpfaRef`. Un recorrido:

```text
dispensing(initial_treatment) -> medication_adherence
```

produce dos aplicaciones ligadas a dos nodos ya existentes y una transición ya
existente. No crea otro grafo, otra sesión ni otro chat. Los requisitos de
transición pueden usar como action target la `ConclusionId` del
`SpfaTransition` validado.

M5 solo cubre el reconocimiento y la cobertura protocolaria del SPFA de
adherencia cuando aparece en el recorrido. La clasificación de adherencia, tipo,
barreras, estrategia, PRM/RNM y las intervenciones siguen perteneciendo a M6 y a
los contratos ya presentes en `EvaluatorViewV2`.

## 12. Dispensación e Indicación

### 12.1. Dispensación

La estructura soporta requisitos:

- comunes a toda Dispensación;
- exclusivos de `initial_treatment`;
- exclusivos de `continuation`;
- condicionales por caso mediante una política versionada.

M5-A no enumera ni pondera el checklist clínico. Cada aplicación debe coincidir
con el subtipo del `SpfaConclusion` y resolver la aplicabilidad antes de publicar.

### 12.2. Indicación Farmacéutica

Sin fijar checklists ni importancias, el contrato puede representar los dominios
documentados en `03_SPFA_PROTOCOLS.md`:

- demanda por problema de salud;
- duración y evolución;
- actuaciones previas;
- medicamentos utilizados;
- alergias e intolerancias cuando proceda;
- enfermedades o situaciones especiales relevantes;
- criterios generales o específicos de derivación;
- posibilidad de actuación desde farmacia;
- derivación;
- detección de otras necesidades o SPFA.

La aplicabilidad y la importancia efectiva se deciden por requisito y caso. La
presencia de un dominio en el protocolo no lo convierte automáticamente en
obligatorio o crítico.

## 13. Seguridad crítica y scoring futuro

`safetyCritical: true` es metadata estructural independiente del label y de la
importancia. Una omisión de este tipo podrá en M5-F generar una alerta, limitar
una puntuación o activar revisión docente. M5-A no elige la fórmula.

Los resultados definidos aquí contienen los datos necesarios para un scoring
posterior, pero no incorporan:

- puntos o porcentajes;
- pesos por requisito o dimensión;
- caps o penalizaciones;
- confianza de IA;
- feedback generado.

La futura puntuación 0–100 y su ponderación global seguirán siendo configurables
y versionadas.

## 14. Versionado y lifecycle

1. La sesión queda fijada a una `case_version` inmutable.
2. Esa versión contiene o referencia de forma inmutable las definiciones exactas
   y las aplicaciones de protocolo utilizadas.
3. La evaluación resuelve esas referencias desde el snapshot fijado, nunca desde
   “latest protocol”.
4. Cambiar una definición, una aplicación, un target, una política de
   aplicabilidad o una importancia efectiva exige una nueva versión apropiada;
   no reinterpreta sesiones históricas.
5. Las versiones del protocolo deben ser reproducibles y resolubles incluso si
   ya no son las vigentes para nuevas publicaciones.
6. `EvaluatorViewV2.versions.protocol` es el marcador del catálogo o paquete
   docente versionado y coincide con `CaseSpfaProtocolSetV2.catalogRef`. No se
   compara con el `SpfaProtocolRefV2` de una definición individual.

## 15. Política Legacy

`LEGACY_V1_SNAPSHOT` no contiene aplicaciones v2 versionadas ni targets
estructurados suficientes. La política fail-closed inicial es:

```ts
type LegacySpfaEvaluationCapabilityV2 = Readonly<{
  status: 'NOT_AVAILABLE';
  reason: 'NO_VERSIONED_SPFA_PROTOCOL_APPLICATION';
}>;
```

No se fabrican requisitos v2 a partir de `ground_truth`, `service_type` ni otros
strings Legacy. Los resultados históricos v1 pueden conservarse y mostrarse como
legado, pero no se presentan como evaluación protocolaria M5. Una capacidad
Legacy limitada solo podrá añadirse posteriormente mediante un contrato explícito
y auditable, sin reinterpretación retroactiva.

## 16. Invariantes de publicación Generated V2

Antes de que una versión `GENERATED_CASE_BUNDLE_V2` pueda llegar a `PUBLISHED`,
su fuente de verdad deberá incluir o fijar de forma reproducible:

- referencias de protocolo y versiones exactas;
- una aplicación válida por cada `SpfaConclusion` declarado en `carePath`;
- bindings tipados de cada requisito aplicado;
- aplicabilidad e importancia efectiva materializadas;
- referencias íntegras a los hechos, medicamentos, conclusiones y transiciones de
  la misma versión.

El futuro validador de publicación debe fallar de forma cerrada ante:

- SPFA sin aplicación;
- aplicación huérfana o duplicada;
- protocolo ausente, no resoluble o de otra versión;
- incompatibilidad de servicio o subtipo;
- requisito inexistente, duplicado o de kind incorrecto;
- target ausente, de tipo incorrecto o perteneciente a otro caso;
- requisito aplicable sin targets suficientes;
- `NOT_APPLICABLE` sin una decisión de aplicabilidad válida;
- referencia “latest” no fijada.

`GeneratedCaseBundleV2.sourceOfTruth` contiene obligatoriamente `patientFacts`,
`evaluator` y el `spfaProtocolSet` validado. La construcción de nuevos bundles
Generated V2 sigue este pipeline sin fallback:

```text
AI draft
  ↓ canonical assembly
CanonicalGeneratedCaseCoreV2
  ↓ resolver SPFA usando IDs canónicos
SpfaIntegratedGeneratedCaseCoreV2
  ↓ bundle construction
GeneratedCaseBundleV2
```

El resolver recibe una copia clínica canónica y su resultado `unknown` atraviesa
la frontera de attachment/validación antes de construir el bundle. No existe un
set vacío por defecto, inferencia desde el servicio ni resolución contra el
catálogo “latest”. El `sourceBrief.fingerprint` conserva exclusivamente la
semántica del brief y la canonicalización `teaching-brief-v2/1`; el set exacto es
reproducible porque queda almacenado en `sourceOfTruth`. La provenance registra
separadamente `spfaIntegrationVersion`, que versiona la etapa server-owned de
integración y no sustituye a `spfaProtocolSet.catalogRef`.

## 17. Evidencia, errores y fail-closed

- Ningún extractor futuro puede inventar evidencia ni citar un excerpt sin
  referencia estable al mensaje.
- Una evidencia debe pertenecer a la misma sesión y al transcript inmutable
  evaluado.
- El speaker y el tipo de evidencia deben coincidir con el mensaje real.
- Un mensaje del paciente solo cuenta si fue aceptado por la frontera segura del
  runtime; una candidate rechazada no entra en el transcript ni en cobertura.
- Información desconocida no se convierte en negativa.
- Un target ambiguo, ausente o incoherente produce resultado no resoluble/revisión
  o fallo de publicación, nunca cobertura optimista.
- La ausencia de respuesta no se interpreta como respuesta negativa.
- Los errores de catálogo, versión, identidad o referencia no se reparan por
  label ni por similitud textual.
- La evaluación histórica falla de forma explícita si no puede resolver su
  protocolo fijado; nunca cae silenciosamente al protocolo actual.
- Los datos docentes, targets, labels internos y resultados no se envían al
  paciente ni al navegador del estudiante antes de la finalización autorizada.

## 18. Roadmap de implementación

### M5-B — Tipos de dominio y validadores de protocolo

Implementar IDs nominales, definiciones, dominios, requisitos discriminados,
version refs y validación estricta, sin catálogo clínico inventado.

### M5-C1 — Aplicaciones y bindings individuales de caso — CLOSED

Implementados `CaseSpfaProtocolApplicationV2`, targets tipados y validación
cruzada con `PatientFacts`/`EvaluatorViewV2.carePath`.

### M5-C2A — Set de protocolos del caso y enriquecimiento — CLOSED

Agrupar las definiciones fijadas y una aplicación exacta por cada nodo SPFA del
`carePath`, y transformar explícitamente `CanonicalGeneratedCaseCoreV2` en
`SpfaIntegratedGeneratedCaseCoreV2`.

### M5-C2B — Integración final en bundle/generador — CLOSED

El set SPFA validado forma parte obligatoria de la fuente de verdad final. El
builder acepta exclusivamente el core integrado, revalida el attachment y falla
de forma cerrada ante ausencia o incoherencia. El pipeline generador resuelve el
set únicamente después del ensamblado canónico y registra la versión de
integración en provenance, sin alterar el fingerprint del brief.

### M5-D — Evidencia de cobertura de información

#### M5-D1 — Snapshot de transcript y contratos de evidencia/resultado — CLOSED

Implementados el transcript canónico fijado por fingerprint, las referencias a
mensajes reales, las particiones exactas de targets, los orígenes estructurales
de información, los outcomes de actuación y el resultado fijado a
sesión/caseVersion/transcript/SPFA/requisito. D1 no decide si el contenido citado
satisface semánticamente un target.

#### M5-D2 — Baseline determinista y frontera de candidatos semánticos — CLOSED

Implementados el reconocimiento exclusivo de `PUBLIC_PROFILE(age|sex)`, la
separación explícita de targets no resueltos, el universo canónico target↔mensaje,
la selección fail-closed y la materialización D1 solo cuando no queda nada
pendiente. D2 no inspecciona texto ni decide equivalencia semántica.

#### M5-D3A — Contratos y validación de adjudicación semántica — CLOSED

Implementada la frontera estricta fijada al baseline D2 y al transcript D1. Las
decisiones cubren exactamente los targets no resueltos, los soportes solo pueden
usar pares del universo semántico y las preguntas de origen deben referenciar
mensajes D1 anteriores. No se inspecciona el texto para decidir semántica.

#### M5-D3B — Contexto canónico de targets semánticos — CLOSED

Implementada la proyección server-only mínima y reproducible de los targets no
resueltos. Revalida C1/C2, reconstruye D2, no contiene policy de disclosure,
scoring, metadata de seguridad ni facts ajenos, y fija mediante fingerprint el
input semántico exacto permitido.

#### M5-D3C1 — Frontera de transport y request del provider — CLOSED

Implementados el prompt semántico versionado, la proyección segura del
transcript, el request fijado al fingerprint D3B y el schema Structured Outputs
estricto. No existe cliente ni llamada OpenAI en esta etapa.

#### M5-D3C2 — Executor OpenAI y normalización D3A — CLOSED

Implementado el executor con cliente inyectable, snapshots previos al await,
clasificación fail-closed de respuestas OpenAI, normalización server-owned y
validación D3A obligatoria. Este incremento usa providers mockeados y no realiza
llamadas live.

#### M5-D3C3 — Aceptación live controlada — CLOSED / ACCEPTED

Aceptación live completada el 24 de agosto de 2026 con `gpt-5.6-sol`:

- tres ejecuciones completas e independientes de `LIVE-1`, `LIVE-2` y
  `LIVE-3`;
- 9/9 escenarios superados y 30/30 targets correctos;
- `responseModel = gpt-5.6-sol` confirmado en las nueve llamadas;
- ninguna variabilidad de verdict entre ejecuciones;
- cobertura aceptada de `SUPPORTED`, `UNCERTAIN`, `NOT_SUPPORTED`,
  `PATIENT_STATEMENT`, `PATIENT_CONFIRMATION`, `STUDENT_ACTION`,
  `SPONTANEOUS`, `ELICITED` y `studentQuestionRef`;
- resistencia a prompt injection demostrada en los escenarios controlados.

La frontera server-owned entre los tres verdicts queda fijada así:

- `SUPPORTED`: evidencia semánticamente pertinente y suficiente;
- `UNCERTAIN`: contenido pertinente pero vago, incompleto, ambiguo,
  contradictorio o insuficientemente específico para confirmar el target
  exacto;
- `NOT_SUPPORTED`: ningún mensaje candidato aporta contenido semánticamente
  pertinente.

El target cualitativo/cuantitativo de `mixedF` permanece correctamente
clasificado como `UNCERTAIN`. Esta aceptación demuestra el comportamiento de la
batería live controlada definida para D3C3; no implica infalibilidad universal
del modelo. El harness queda condicionado por `RUN_SPFA_SEMANTIC_LIVE=1` y se
mantiene omitido en la suite normal.

#### M5-D3D — Composición por requisito — CLOSED / COMPLETE

Implementado y validado el compositor puro y determinista que combina la
baseline D2 canónica con una adjudicación D3A validada para producir un único
`SpfaRequirementSessionResultV2` por requisito. La evidencia determinista es
autoridad y no puede degradarse; una adjudicación redundante sobre un target ya
resuelto se rechaza como input incompatible. La proyección conserva el orden de
targets definido por la aplicación y pasa siempre por el validator D1 canónico.

La política de composición queda fijada así:

- `SUPPORTED` convierte el target pendiente en positivo;
- `UNCERTAIN` mantiene el target en `remainingTargetRefs` y lo incorpora además
  a `uncertainTargetRefs`;
- `NOT_SUPPORTED` mantiene el target únicamente en `remainingTargetRefs`.

No existe `unsupportedTargetRefs`, porque se deriva de la partición anterior.
Los requisitos no aplicables se materializan sin adjudicación semántica. D3D no
incluye todavía evaluación de sesión, scoring, persistencia ni API; esas capas
permanecen en los incrementos posteriores de M5.

Invariantes de D3: candidato no equivale a evidencia semántica; evidencia
semántica no equivale a cobertura final; `UNCERTAIN` no equivale a
`NOT_SUPPORTED`; cada par citado procede del universo D2; una pregunta de origen
es metadata D1 y no evidencia factual; no se inventan referencias; y no se
deduce semántica mediante búsquedas o coincidencias textuales en esta frontera.

### M5-E — Evaluador de sesión SPFA — CLOSED / COMPLETE

Componer aplicaciones, transcript y evidencia para producir cobertura y
resultados de actuación, sin scoring numérico todavía.

#### M5-E1 — Contrato agregado y validación estricta — CLOSED / COMPLETE

`SpfaSessionEvaluationV2` es el agregado server-only, versionado e inmutable de
una evaluación SPFA completa de sesión. Conserva exclusivamente la identidad de
sesión y versión de caso, la referencia del catálogo, el fingerprint del
transcript, las aplicaciones con sus `SpfaRequirementSessionResultV2` y la
metadata mínima `provider`/`responseModel`/`promptVersion` de las ejecuciones
semánticas. No es un DTO para estudiante o profesor y no contiene transcript,
mensajes, bundle, patient facts, evaluator, respuesta raw del provider, score ni
feedback.

El validator E1 es strict y fail-closed. Reutiliza el validator D1 canónico de
cada resultado mediante un contexto server-owned separado formado por el
transcript validado y el `CaseSpfaProtocolSetV2`; ese contexto no se copia al
agregado. Exige identidad y fingerprint coherentes, exactamente una aplicación
y un resultado por cada elemento del protocol set, ausencia de duplicados,
correlación total de cada ejecución semántica y propiedades exactas en todas las
capas del agregado.

E1 preserva y valida el orden clínico recibido contra el orden de aplicaciones y
requisitos del protocol set; nunca ordena alfabéticamente ni por IDs opacos. La
validación del propio protocol set contra el core canónico completo
`patientFacts`/`evaluator`, y la decisión de qué requisitos necesitan realmente
una ejecución semántica, permanecen deliberadamente en E2/E3. M5-E continúa
abierto.

#### M5-E2 — Orquestador puro de sesión — CLOSED / COMPLETE

`evaluateSpfaSessionV2` valida primero el transcript, el core y el protocol set,
y después recorre secuencialmente aplicaciones y requisitos en el orden clínico
canónico. Para cada requisito construye el baseline D2 y delega siempre la
materialización final en el compositor D3D: `NOT_APPLICABLE` y
`DETERMINISTIC_COMPLETE` producen cero adjudicaciones; `DETERMINISTIC_PARTIAL` y
`SEMANTIC_REQUIRED` producen exactamente una adjudicación por requisito, aunque
contengan varios targets.

El adjudicador es una dependencia inyectada y E2 conserva del receipt real solo
la metadata mínima de cada ejecución semántica. Las llamadas son secuenciales y
fail-fast: un error detiene los requisitos posteriores y no devuelve resultados
parciales, no realiza reparaciones, retries ni fallbacks. Antes de devolver el
agregado, E2 aplica obligatoriamente el validator E1 con el transcript y el
protocol set server-owned como contexto.

E2 es una frontera pura respecto a infraestructura: no consulta DB, no instancia
el runtime OpenAI productivo, no persiste, no expone transcript/core protegido y
no calcula scoring ni feedback. M5-E continúa abierto; resolución desde una
sesión persistida, fachada productiva, persistencia, API y scoring permanecen en
incrementos posteriores.

#### M5-E3 — Runtime server-owned de sesión Generated SPFA — CLOSED / COMPLETE

`resolveSessionSpfaEvaluationRuntimeV2` acepta únicamente la identidad
autenticada server-side y el `sessionId`. Reutiliza el loader clínico existente
para resolver con ownership `sessions.id = sessionId AND sessions.user_id =
authenticatedUserId` la versión inmutable fijada por la sesión; nunca selecciona
otra versión por `case_id` ni acepta core, transcript o referencias clínicas del
cliente.

La capacidad es exclusiva de `GENERATED_CASE_BUNDLE_V2`. Reconstruye mediante
los validadores canónicos un `SpfaIntegratedGeneratedCaseCoreV2` formado por
`patientFacts`, `evaluator` y `spfaProtocolSet`, y rechaza Legacy con la capacidad
SPFA no disponible en vez de fabricar aplicaciones o requisitos v2. El bundle y
las filas PostgreSQL crudas no forman parte de la salida.

Los mensajes se leen con una segunda consulta read-only también restringida por
ownership, en orden `created_at ASC, id ASC`. `messages.id` se obtiene como texto
decimal para conservar todo el rango de `bigint`; solo se admiten roles
persistidos `student` y `patient`. Los `Date` del driver se convierten mediante
`toISOString()` y cualquier string debe cumplir el contrato D1 de timezone
explícito. El constructor D1 vuelve a canonicalizar el orden, recalcula siempre
el fingerprint `sha256` con `session-transcript-v2/1` y admite el transcript vacío
porque `SessionTranscriptSnapshotV2` ya lo permite.

La salida server-only contiene identidad de sesión/caso/versión, status, core y
transcript, con coherencia estricta entre sus identidades. E3 no ejecuta OpenAI,
no evalúa, no escribe en DB y no decide freezing, locks, finalización ni
persistencia; esas políticas continúan en M5-G y los siguientes incrementos de
M5-E. M5-E permanece abierto.

#### M5-E4 — Runtime OpenAI y fachada server-only de evaluación — CLOSED / COMPLETE

`createOpenAiSpfaSemanticAdjudicationRuntimeV2` adapta directamente el boundary
inyectable de E2 al executor D3C aceptado. La configuración procede únicamente
del entorno server-side: exige API key y el modelo canónico exacto
`gpt-5.6-sol`, sin alias, fallback Terra ni selección desde input de usuario. El
cliente se construye una vez por runtime, los límites de tokens/timeout son
server-owned y el receipt validado conserva sin reescritura `responseModel` y
`promptVersion` observados por D3C.

`evaluateOwnedGeneratedSpfaSessionV2` compone la cadena E3 → E2. Acepta solo
`authenticatedUserId` y `sessionId`, delega ownership y resolución de
core/transcript a E3 y devuelve exclusivamente `SpfaSessionEvaluationV2`. El
runtime semántico se crea de forma lazy en la primera adjudicación solicitada
por E2: una evaluación completamente determinista no crea cliente ni requiere
configuración OpenAI; varias adjudicaciones de la misma evaluación reutilizan
el mismo runtime.

E4 propaga fallos de E3, configuración, provider, D3C y E2 de forma fail-closed,
sin retry, fallback, reparación ni agregado parcial. No expone API key, core,
transcript ni configuración, y no introduce persistencia, escrituras DB,
scoring, cambio de status o API pública. La política transaccional de freezing y
finalización permanece en M5-G. E4 por sí solo no cerraba M5-E.

#### M5-E5 — Integración completa mockeada — CLOSED / COMPLETE

La aceptación interna E5 ejecuta una única cadena server-side coherente:
sesión y ownership E3 → fachada E4 → orquestador E2 → baseline D2 → contexto
D3B → adjudicación semántica controlada → compositor D3D → agregado E1
validado. El resolver E3, E2 y todas las capas puras D2/D3B/D3D/E1 se ejecutan
realmente; solo el pool PostgreSQL y el runtime semántico se sustituyen por
mocks/fakes seguros, sin DB productiva, red ni OpenAI real.

La cobertura integrada confirma sesiones deterministas, mixtas y con varias
aplicaciones; requisitos de información y actuación; evidencia espontánea y
elicited; `SUPPORTED`, `UNCERTAIN`, `NOT_SUPPORTED` y `NOT_APPLICABLE`; orden
canónico; correlación de receipts; una adjudicación por requisito semántico y
cero adjudicaciones para requisitos deterministas. `UNCERTAIN` permanece en
`remainingTargetRefs` y `uncertainTargetRefs`, mientras `NOT_SUPPORTED` solo
permanece en `remainingTargetRefs`.

También quedan comprobados ownership server-side, indistinguibilidad segura de
sesión inexistente y ajena, rechazo de Legacy, core/transcript incompatibles,
receipt inválido y fail-fast en requisitos intermedios sin agregado parcial.
Con el mismo snapshot, core y receipts controlados, las capas no LLM producen un
resultado idéntico. El agregado final no expone patient facts, evaluator, core,
transcript, mensajes, prompt, respuesta raw, API key, configuración, score ni
feedback.

Con E1–E5 completos, M5-E queda cerrado como evaluador server-only en memoria.
Su modelo productivo continúa fijado a `gpt-5.6-sol`, sin fallback Terra, y las
pruebas normales permanecen offline. Quedan expresamente fuera de M5-E el
freezing y la finalización transaccional, persistencia, API/DTO, scoring y
concurrencia de finalización; pertenecen a M5-F/M5-G.

### M5-F — Scoring y omisiones críticas — CLOSED / COMPLETE

Introducir configuración versionada de pesos, cálculo 0–100, alertas, caps y
revisión para omisiones críticas, con trazabilidad por requisito.

#### M5-F1 — Contexto canónico de scoring — CLOSED / COMPLETE

`SpfaScoringContextV2` es la proyección pura y server-owned que correlaciona un
`SpfaSessionEvaluationV2` con su `CaseSpfaProtocolSetV2`. El builder no necesita
el transcript y excluye mensajes, evidence/excerpts, contenido clínico,
metadata OpenAI, score y feedback. Su salida pasa por un validator strict antes
de quedar disponible para las políticas posteriores de scoring.

Cada requisito conserva `carePathSpfaRef`, protocolo y requisito, tipo
`INFORMATION_REQUIREMENT`/`ACTION_REQUIREMENT`, aplicabilidad, la
`effectiveImportance` ya resuelta cuando procede y la `safetyCriticality` del
protocolo. F1 no traduce importancia o criticidad a pesos, puntos, caps,
penalizaciones, alertas ni decisiones docentes.

La partición de targets queda materialmente canonizada según el orden clínico de
la aplicación: targets positivos, restantes y `uncertainTargetRefs`, siendo
estos últimos un subconjunto de los restantes. Los counts se derivan siempre de
esas referencias. `UNCERTAIN` se preserva como dato estructural y no se convierte
en puntuación, revisión ni error. Los requisitos `NOT_APPLICABLE` permanecen en
la colección con targets y counts vacíos para que la política posterior decida
el denominador explícitamente.

La colección respeta exactamente el orden de aplicaciones y requisitos del
protocol set, sin ordenar por IDs, importancia, criticidad o resultado. La
correlación es fail-closed para catálogo/version, aplicaciones, protocolos,
requisitos, identidades, fingerprint y particiones de targets; faltantes,
duplicados o incompatibilidades se rechazan. M5-F continúa abierto: F1 no
incluye todavía política de pesos, cálculo de score, omisiones críticas,
persistencia ni DTO/API.

#### M5-F2 — Política versionada de scoring — CLOSED / COMPLETE

`SpfaScoringPolicyV2` fija de forma server-owned y reproducible todas las
decisiones pedagógicas que el scorer F3 necesitará, pero F2 no calcula todavía
ningún score. El contrato es independiente de sesión, caso, transcript,
evidencia y proveedor. Su validator es strict, no aplica defaults ni corrige
políticas inválidas, y admite futuras instancias versionadas dentro de límites
numéricos técnicos explícitos.

La instancia canónica v1 queda congelada como
`spfa-scoring-standard@2026.1` con:

- `CRITICAL = 3`, `RELEVANT = 2`, `OPTIONAL = 1`;
- crédito parcial `TARGET_RATIO`;
- `UNCERTAIN = NO_CREDIT_REVIEW`: sin crédito confirmado y con revisión
  requerida posteriormente, sin colapsarlo en `NOT_SUPPORTED`;
- alertas ante omisión, cumplimiento parcial o incertidumbre crítica, sin score
  cap ni penalización numérica adicional;
- `NOT_APPLICABLE = EXCLUDE_FROM_DENOMINATOR`;
- ausencia total de requisitos aplicables = `NOT_SCORABLE`;
- pass/fail = `NONE`;
- redondeo `HALF_UP` a un decimal aplicado únicamente al score final
  (`FINAL_SCORE_ONLY`), sin redondeos intermedios.

F2 no introduce scorer, puntos obtenidos, porcentaje 0–100, alertas
materializadas, `needsReview`, persistencia ni API. M5-F permanece abierto y la
aplicación de esta política pertenece exclusivamente a F3.

#### M5-F3 — Scorer puro y resultado de sesión — CLOSED / COMPLETE

`scoreSpfaSessionV2` transforma exclusivamente un `SpfaScoringContextV2` F1 y
una `SpfaScoringPolicyV2` F2 en un `SpfaSessionScoreV2`. Valida ambos inputs,
mantiene una contribución por requisito en orden clínico y no consulta
transcript, evidence, datos clínicos, DB, entorno ni proveedor. El resultado
conserva las identidades de sesión/caso/transcript, catálogo y policy, además de
contribuciones, alertas críticas, puntos y status global; no incluye pass/fail,
feedback ni contenido protegido.

Para cada requisito aplicable, los puntos posibles proceden de
`pointsByImportance`; `COVERED`/`PERFORMED` obtienen crédito completo,
`PARTIALLY_*` aplica `TARGET_RATIO`, y `NOT_COVERED`/`NOT_PERFORMED` obtiene
cero. `UNCERTAIN` nunca suma crédito: permanece reflejado en counts y activa
`needsReview`/`REVIEW_REQUIRED`. Una alerta crítica de omisión o parcial sin
incertidumbre no se convierte silenciosamente en review. Los requisitos
`NOT_APPLICABLE` permanecen trazables con cero puntos y fuera del denominador;
si no hay ningún requisito aplicable, el resultado es `NOT_SCORABLE` con score
`null`.

Las alertas estables son `CRITICAL_OMISSION`, `CRITICAL_PARTIAL` y
`CRITICAL_UNCERTAIN`, emitidas en orden de requisito y código semántico. El
score base es `(rawPoints / possiblePoints) * 100`; contribuciones, raw y
possible no se redondean. El score final utiliza aritmética racional y una única
aplicación `HALF_UP` según `FINAL_SCORE_ONLY`, quedando en 0–100. La policy v1
no aplica cap. Aunque F2 puede validar un cap numérico futuro, F3 lo rechaza
fail-closed porque todavía no existe contrato para su condición de activación;
no se inventa esa decisión pedagógica.

`validateSpfaSessionScoreV2` es strict y contextual: reconstruye el resultado
canónico desde context+policy y rechaza identidades, orden, contribuciones,
alertas, status, review, números o score incompatibles. F3 no incorpora
persistencia, API/DTO ni aceptación final F4. M5-F continúa abierto.

#### M5-F4 — Matriz integral de aceptación del scoring — CLOSED / COMPLETE

La aceptación F4 ejecuta offline la cadena real
`SpfaSessionEvaluationV2` → `buildSpfaScoringContextV2` → policy canónica v1 →
`scoreSpfaSessionV2` → `validateSpfaSessionScoreV2`, sin mocks de las fronteras
puras. La matriz cubre pesos 3/2/1, todos los estados de requisitos de
información y actuación, ratios de targets representativos y varias sesiones
con cálculo manual independiente.

Queda verificada la diferencia contractual entre `UNCERTAIN` y
`NOT_SUPPORTED`: ambos pueden recibir el mismo crédito numérico nulo, pero solo
la incertidumbre aplicable activa `REVIEW_REQUIRED`. La criticidad conserva las
alertas `CRITICAL_PARTIAL`, `CRITICAL_OMISSION` y `CRITICAL_UNCERTAIN` sin
inventar causas adicionales de revisión; una alerta crítica sin incertidumbre
no cambia por sí sola el status a revisión.

Los requisitos `NOT_APPLICABLE` quedan fuera del denominador y una sesión sin
ningún requisito aplicable produce `NOT_SCORABLE`, con cero puntos y score
`null`. La policy `spfa-scoring-standard@2026.1` usa `TARGET_RATIO`, no aplica
cap ni pass/fail, y redondea únicamente el score final a un decimal con
`HALF_UP`; puntos y contribuciones conservan su precisión previa. Un cap
numérico sin contrato de activación continúa rechazándose fail-closed.

La matriz también confirma una contribución por requisito en orden clínico,
identidades y referencias versionadas de extremo a extremo, alertas únicas y
ordenadas, determinismo e inmutabilidad de inputs. El resultado no contiene
transcript, evidence, datos del paciente, metadata de proveedor, prompts,
feedback ni decisiones pedagógicas no aprobadas. Incompatibilidades de
catálogo, aplicación, requisito, target, contexto, policy o resultado
manipulado se rechazan sin reparación silenciosa.

M5-F queda cerrado con: F1 como contexto canónico separado de la evaluación
clínica; F2 como policy completa y versionada; F3 como scorer puro,
determinista y validado; y F4 como aceptación integral offline. La policy v1
fija pesos `CRITICAL=3`, `RELEVANT=2`, `OPTIONAL=1`, crédito `TARGET_RATIO`,
`UNCERTAIN` sin crédito y con revisión, alertas críticas sin cap,
`NOT_APPLICABLE` excluido, `NOT_SCORABLE` cuando corresponde y redondeo final
`HALF_UP`, sin pass/fail. Persistencia, finalización, API/DTO y concurrencia no
forman parte de este cierre y permanecen en M5-G.

### M5-G — Integración y aceptación — CLOSED / COMPLETE

Integrar finalización/persistencia/feedback autorizado y añadir pruebas de
concurrencia, versionado histórico, seguridad, adversariales y de aceptación.

#### M5-G1 — Lifecycle persistible de evaluación SPFA — CLOSED / COMPLETE

G1 fija exclusivamente los contratos server-owned y la máquina de estados que
las migraciones y servicios posteriores deberán materializar. No amplía
`sessions.status`: la sesión continúa usando `active`/`finished`, mientras que
el registro separado de evaluación v2 usa exactamente `EVALUATING`, `COMPLETED`
y `FAILED`.

`SpfaEvaluationSnapshotIdentityV2` congela la identidad reproducible del input:
`sessionId`, `caseVersionId`, catálogo de protocolos, fingerprint canónico del
transcript y policy de scoring. No incorpora transcript, patient facts,
evaluator, score ni metadata del proveedor. Desde el primer claim, cualquier
retry o recovery debe conservar materialmente los cinco elementos; cualquier
drift se rechaza fail-closed.

Cada claim posee un `SpfaEvaluationAttemptIdV2` opaco con formato
`spfa_eval_attempt_<uuid-canónico>` y un `attemptCount` positivo y monótono. El
primer claim usa 1. Recovery de lease expirada y retry autorizado de `FAILED`
requieren un ID nuevo y exactamente `attemptCount + 1`; G1 no genera todavía el
UUID. La duración de lease tampoco se hardcodea: será configuración server-owned
de G3. Una lease está vigente mientras `now < leaseExpiresAt` y se considera
vencida cuando `now >= leaseExpiresAt`, incluido el instante exacto de expiry.
Todas las funciones reciben `now` explícito y los timestamps se canonicalizan a
UTC mediante `Date.toISOString()` desde instantes ISO/RFC3339 con timezone.

La decisión idempotente queda definida así:

- sin registro: `CLAIM_NEW`;
- `EVALUATING` con lease vigente: `IN_PROGRESS`, sin segundo intento;
- `EVALUATING` con lease vencida: `RECOVER_EXPIRED`;
- `FAILED`: `RETRY_FAILED` solo si la policy server-owned lo permite;
- `COMPLETED`: `RETURN_COMPLETED`, sin volver a evaluar ni sobrescribir.

Las únicas transiciones materiales son primer claim a `EVALUATING`, claim actual
a `COMPLETED` o `FAILED`, recovery expirada a un nuevo `EVALUATING`, y retry
autorizado de `FAILED` a un nuevo `EVALUATING`. `COMPLETED` es terminal; solo se
admite reutilizar material exactamente idéntico como operación idempotente. No
se permite `FAILED → COMPLETED` directo ni completar/fallar con otro attempt.

`EVALUATING` tiene `startedAt` y `leaseExpiresAt`, sin resultados finales.
`FAILED` conserva `startedAt`, `failedAt` y uno de los códigos técnicos seguros
`PROVIDER_FAILURE`, `INVALID_PROVIDER_RESULT`, `EVALUATION_FAILURE`,
`SNAPSHOT_DRIFT` o `INTERNAL_FAILURE`, sin payload parcial. `COMPLETED` conserva
`startedAt`, `completedAt` y exige conjuntamente un
`SpfaSessionEvaluationV2` y un `SpfaSessionScoreV2` validados canónicamente. Sus
identidades, fingerprint, catálogo y policy deben coincidir con el snapshot. No
se persisten resultados parciales en estados no terminales.

El primer freeze deberá garantizar dentro de un único boundary transaccional:
ownership server-side, sesión `active`, versión fijada, transcript canónico y
fingerprint calculado, serialización de escrituras de mensajes, creación del
claim y cambio de la sesión a `finished`. En particular, ninguna escritura en
`public.messages` puede superar una comprobación de `active` y materializarse
después del snapshot; G2/G3 deberán compartir el lock de sesión o un mecanismo
equivalente. La transacción de freeze se cerrará antes de ejecutar OpenAI: no se
mantendrá una transacción DB abierta durante la evaluación remota. Completion o
failure posteriores deberán comprobar de nuevo attempt propietario y snapshot
sin drift.

La persistencia futura de G2 deberá poder representar conceptualmente un único
registro por `sessionId`, con `caseVersionId`, status, identidad completa del
snapshot, attempt actual y contador, lease, timestamps, código de fallo y los dos
resultados obligatorios de `COMPLETED`. G1 no decide columnas frente a JSON, no
crea SQL ni implementa locks. El metadata del lifecycle sin payload es seguro
para logging técnico; el payload `COMPLETED` continúa siendo server-only y no se
debe registrar indiscriminadamente.

M5-G permanece abierto. Migración, tabla, SQL, coordinación transaccional,
persistencia, API/DTO, polling y aceptación con DB pertenecen a G2–G6.

#### M5-G2 — Persistencia PostgreSQL y freeze de mensajes — CLOSED / COMPLETE

G2 materializa, sin ejecutar todavía la evaluación, la tabla server-only
`public.session_evaluation_records_v2`. Existe como máximo un registro por
`session_id` y permanece separado de `public.evaluations`, cuyo formato Legacy
no se modifica. Un guard cross-table toma el lock de la sesión y rechaza que una
misma sesión tenga simultáneamente evaluación Legacy y lifecycle v2; G3/G5
seguirán comprobando la capacidad clínica antes de elegir el formato.

El registro normaliza `session_id`, `case_version_id`, status, formato
`SPFA_SESSION_EVALUATION_V2`, referencias exactas de catálogo y policy,
fingerprint, attempt, lease y timestamps. Desde `EVALUATING` conserva además el
`SessionTranscriptSnapshotV2` canónico completo y el snapshot validado de
`SpfaScoringPolicyV2`, ambos protegidos contra modificación. G1 continúa
definiendo `snapshotIdentity` mediante sus cinco identidades; los dos snapshots
JSONB son objetos persistidos server-only necesarios para reproducibilidad y no
se incorporan a esa identidad ni a DTOs.

Los `CHECK` de DB reproducen las formas `EVALUATING`, `COMPLETED` y `FAILED`, el
attempt branded, contador positivo dentro del rango safe integer, fingerprint
`sha256`/`session-transcript-v2/1`, códigos de fallo cerrados y presencia o
ausencia de lease, timestamps y resultados. `COMPLETED` exige conjuntamente
evaluation y score JSONB con identidad básica alineada; los validadores TS de G4
seguirán siendo la autoridad del contrato completo. El snapshot de scoring
queda persistido porque todavía no existe un catálogo inmutable de policies en
DB. La tabla solo añade un índice parcial de recovery por lease, además de PK y
unicidad de sesión.

Las transiciones materiales y la inmutabilidad del snapshot están defendidas
por trigger. `COMPLETED` es terminal; completion/failure deben pertenecer al
attempt actual; recovery exige lease expirada, ID nuevo e incremento exacto; y
retry de `FAILED` deja la autorización server-owned a G3. No existe duración de
lease hardcodeada ni transacción abierta durante OpenAI.

Toda mutación de `public.messages` (`INSERT`, `UPDATE` o `DELETE`) bloquea con
`FOR UPDATE` la fila de `public.sessions` y solo se admite mientras la sesión
está `active`; `session_id` del mensaje es inmutable. De este modo una escritura
que obtiene primero el lock termina antes del freeze, y una que llega después de
que G3 haya cambiado la sesión a `finished` falla. El borrado en cascada de una
sesión ya eliminada conserva su semántica histórica, pero una mutación directa
de mensajes de una sesión existente y finalizada queda bloqueada.

La tabla tiene RLS activado sin policies, revoca privilegios a `PUBLIC` y, cuando
existen, a los roles cliente Supabase `anon` y `authenticated`. No se concede
acceso directo al navegador; el owner/backend y los roles server con bypass RLS
siguen siendo la frontera operativa. Las funciones de trigger son invoker-rights
y su ejecución directa se revoca. G2 no altera default privileges ni copia ACL
de plataforma.

La migración incremental es `0003_v2_spfa_evaluation_persistence.sql`. No
transforma evaluaciones Legacy, no implementa G3–G6, no llama OpenAI y no expone
API/DTO. M5-G permanece abierto.

#### M5-G3 — Freeze, claim, recovery y retry transaccionales — CLOSED / COMPLETE

G3 implementa `claimSpfaSessionEvaluationV2` como frontera server-only. Su input
público contiene exclusivamente `authenticatedUserId` y `sessionId`; attempt,
lease, versión de caso, transcript, catálogo y policy se resuelven dentro del
servidor. La lease inicial y las renovadas duran treinta minutos mediante la
constante localizada `SPFA_EVALUATION_LEASE_MS_V2 = 1800000`. Cada attempt usa
`spfa_eval_attempt_<uuid-canónico>` generado criptográficamente con
`crypto.randomUUID()` y validado por el contrato G1.

El primer claim ejecuta una única transacción: bloquea con `FOR UPDATE` la sesión
owned y su versión fijada, comprueba que no exista lifecycle v2 ni evaluación
Legacy, valida la capacidad Generated V2/SPFA, lee los mensajes únicamente
después del lock, construye el `SessionTranscriptSnapshotV2` canónico, fija el
snapshot de `spfa-scoring-standard@2026.1`, inserta `EVALUATING` con
`attemptCount = 1` y cambia la sesión de `active` a `finished`. Insert y cambio
de sesión se confirman o revierten juntos. La transacción termina antes de
devolver el claim y no contiene evaluación clínica, scoring, OpenAI ni red.

Desde ese primer COMMIT, el `transcript_snapshot` persistido es la única fuente
de verdad evaluable. `IN_PROGRESS`, recovery de lease vencida, retry de
`FAILED` y replay de `COMPLETED` no consultan `public.messages` ni reconstruyen
el transcript. Recovery y retry conservan exactamente snapshot identity,
transcript y policy, crean un attempt nuevo, incrementan el contador en uno y
usan un `UPDATE` condicionado por status, attempt y count previos. La policy de
retry de `FAILED` es server-owned y queda habilitada en este servicio; no existe
`forceRetry` del cliente.

La sesión se bloquea antes de releer el lifecycle. Así, dos claims iniciales se
serializan en un único insert, y dos recoveries o retries en un único incremento;
el segundo worker observa el attempt vigente como `IN_PROGRESS`. Un lifecycle
existente exige sesión `finished`; una sesión finalizada sin lifecycle se rechaza
sin inventar snapshot. Legacy devuelve capacidad SPFA no disponible y nunca
crea registro v2.

Todo registro existente se normaliza desde columnas y JSONB, recalcula el
fingerprint del transcript, valida el snapshot de policy y contrasta
session/version/catalog/fingerprint/policy. `COMPLETED` revalida además
`SpfaSessionEvaluationV2` y `SpfaSessionScoreV2` contra el core, transcript y
policy históricos antes de devolver el payload server-only. Cualquier drift o
fila incoherente falla de forma cerrada y nunca se repara silenciosamente.

La cobertura incluye 23 pruebas unitarias/mocked y 6 pruebas opt-in contra
PostgreSQL 17.10 local desechable: freeze y bloqueo de mensajes posteriores,
doble claim, recovery concurrente, retry concurrente, rollback atómico y rechazo
Legacy. La prueba PostgreSQL está desactivada por defecto y requiere la bandera
explícita `RUN_SPFA_G3_POSTGRES=1` sobre el puerto local reservado por su harness;
la suite normal no abre conexiones DB.

M5-G permanece abierto. Completion/failure del attempt, servicio completo,
API/DTO/polling y aceptación final pertenecen a G4–G6.

#### M5-G4 — Evaluación, scoring y finalización condicional — CLOSED / COMPLETE

G4 implementa `finalizeOwnedSpfaSessionEvaluationV2` como coordinador
server-only con el mismo input mínimo de G3: `authenticatedUserId` y
`sessionId`. Siempre comienza invocando el claim G3. Un resultado
`COMPLETED` devuelve el payload persistido ya validado sin reevaluar, puntuar ni
escribir; `IN_PROGRESS` devuelve exclusivamente metadata mínima del attempt y
tampoco ejecuta trabajo adicional. Solo `CLAIMED_NEW`, `RECOVERED_EXPIRED` y
`RETRIED_FAILED` entran en el pipeline evaluativo.

La secuencia material queda separada en tres fases:

1. **Tx A (G3):** ownership, freeze canónico, claim y cambio de la sesión a
   `finished`, seguidos de `COMMIT`.
2. **Evaluación en memoria:** resolución server-side de la versión histórica
   exacta, validación del transcript y policy persistidos, E2 sobre el snapshot,
   adjudicación semántica lazy con el runtime productivo
   `gpt-5.6-sol`, construcción del contexto F1 y scoring F3 con la policy
   histórica.
3. **Tx B corta:** bloqueo del lifecycle, comprobación del attempt propietario y
   de la identidad completa del snapshot, y escritura condicional de
   `COMPLETED` o `FAILED`.

El transcript persistido por G3 es la única fuente de entrevista usada por G4.
No se consulta `public.messages` después del freeze ni se reconstruye la
conversación. El core se carga únicamente mediante el `caseVersionId` congelado,
sin seleccionar latest/current, y se contrasta con el catálogo de protocolos.
La policy se toma de `scoring_policy_snapshot`, no del catálogo actual, y debe
coincidir con `snapshotIdentity.scoringPolicyRef`. Antes de completion se
revalidan `SpfaSessionEvaluationV2`, `SpfaScoringContextV2` y
`SpfaSessionScoreV2`, además de session, versión, catálogo, fingerprint y policy.

Tx B exige `status = EVALUATING`, `attempt_id`, `attempt_count` y los ocho campos
normalizados de identidad del snapshot. Un worker reemplazado no puede completar
ni fallar el attempt nuevo. La expiración temporal de la lease no invalida por
sí sola al worker: si conserva el mismo attempt propietario puede completar; si
G3 ya hizo recovery, la mutación queda superseded. `COMPLETED` es idempotente
solo cuando el payload revalidado es materialmente idéntico. Nunca se mantiene
un cliente o una transacción DB abiertos durante OpenAI/evaluación/scoring.

Los fallos posteriores a un claim se reducen a los códigos cerrados G1:
fallo de transporte/provider como `PROVIDER_FAILURE`; refusal, incomplete o
resultado estructurado inválido como `INVALID_PROVIDER_RESULT`; fallo
determinista de evaluación/scoring como `EVALUATION_FAILURE`; incompatibilidad
del snapshot/core/policy como `SNAPSHOT_DRIFT`; y fallo interno no clasificable
como `INTERNAL_FAILURE`. Tx B de failure limpia lease y resultados parciales. Si
la propia persistencia de failure falla, el lifecycle puede permanecer
`EVALUATING` hasta expiry para permitir recovery posterior; no se inventa éxito
ni se abre una transacción larga de reparación.

La cobertura G4 incluye 30 pruebas unitarias y 5 pruebas opt-in contra
PostgreSQL 17.10 local desechable, con adjudicador falso y cero llamadas OpenAI:
dispatch de los cinco resultados G3, fuente congelada, drift, runtime lazy,
policy histórica, completion/replay, failure/retry, ownership perdido y carga de
la versión exacta. La prueba PostgreSQL requiere explícitamente
`RUN_SPFA_G4_POSTGRES=1`; la suite normal no abre conexiones DB.

La lease continúa siendo fija y server-owned. G6 la eleva de cinco a treinta
minutos porque cada adjudicación semántica admite hasta diez minutos de timeout
y los requisitos se procesan secuencialmente. Esta duración conservadora evita
heartbeat en M5 y reduce recovery prematuro con la configuración normal; puede
existir trabajo duplicado si
una evaluación supera ese tiempo y otro request recupera el lifecycle, aunque
la protección por attempt garantiza una única persistencia válida. G5 incorpora
API/DTO/polling y G6 completa el hardening y aceptación final. Heartbeat no es
necesario para cerrar M5; queda como posible mejora operativa futura únicamente
si la telemetría real justificase sustituir la lease fija.

#### M5-G5 — API de finalización/consulta y DTOs seguros — CLOSED / COMPLETE

G5 extiende la ruta server-owned `POST /api/evaluations` sin alterar su contrato
Legacy. El controller autentica y lee primero un envelope mínimo con
`sessionId`; después resuelve por ownership la versión exacta de la sesión. Solo
entonces aplica el parser Legacy existente o, para
`GENERATED_CASE_BUNDLE_V2`, exige estrictamente el único body
`{ sessionId: string }`. Un cliente Generated no puede proporcionar score,
respuestas, transcript, mensajes, modelo, versión, protocolo, policy, attempt,
lease ni controles de retry. El `authenticatedUserId` procede exclusivamente de
la autenticación server-side.

El POST Generated delega una sola vez en
`finalizeOwnedSpfaSessionEvaluationV2`: `COMPLETED` se proyecta con HTTP 200,
`IN_PROGRESS` con HTTP 202 y `FAILED` con una respuesta genérica retryable. Los
fallos de provider o resultado provider inválido usan HTTP 503; los fallos
internos persistidos usan HTTP 500. El navegador nunca recibe el `failureCode`,
detalle provider ni stack. Repetir POST no aporta un flag de retry: G3/G4 decide
server-side si devuelve el resultado `COMPLETED`, mantiene `IN_PROGRESS` o
ejecuta el retry de un `FAILED`.

La misma ruta expone `GET /api/evaluations?sessionId=...` como polling
autorizado. `getOwnedSpfaEvaluationStatusV2` realiza una única lectura
parametrizada por `session.id` y `session.user_id`, une la versión histórica y
el lifecycle y distingue `NOT_STARTED`, `EVALUATING`, `FAILED` y `COMPLETED`.
Sesión ajena e inexistente comparten el mismo error seguro. GET no bloquea filas,
no consulta `public.messages`, no escribe, no hace claim, no recupera leases
expiradas, no puntúa y no ejecuta OpenAI. Recovery y retry solo pueden comenzar
mediante un nuevo POST.

La lectura valida de forma fail-closed la capability Generated SPFA, el estado
de sesión/versión, todas las identidades normalizadas, transcript y fingerprint,
snapshot de policy y lifecycle. Para `COMPLETED` revalida además
`SpfaSessionEvaluationV2` y `SpfaSessionScoreV2` contra el core, protocolo,
transcript y policy históricos antes de proyectar. Ningún JSONB raw se devuelve
directamente.

`StudentSpfaEvaluationDtoV2` está versionado con `schemaVersion: '2.0'` y usa
allowlist campo por campo. Antes de completion solo expone el estado; `FAILED`
añade únicamente `retryable: true`. `COMPLETED` contiene exclusivamente `score`
(`null` permanece `null` para `NOT_SCORABLE`), `scoreStatus` y `needsReview`.
`REVIEW_REQUIRED` es visible como estado general, sin target, evidencia, excerpt
ni metadata técnica. No se exponen puntos internos, contribuciones, alertas,
transcript, patient facts, evaluator, protocolo, response model, prompt version,
attempt o lease.

`TeacherSpfaEvaluationDtoV2` es una proyección server-only distinta. Puede
representar identidad histórica, failure code seguro, score completo,
contribuciones, alertas críticas, metadata semántica y referencias de evidencia
autorizadas; excluye API keys, prompts completos, respuesta raw del provider,
patient facts y evaluator raw. G5 no publica una ruta docente porque el
repositorio todavía no ofrece un boundary de autorización docente inequívoco;
no se amplían roles ni privilegios por comodidad.

La cobertura G5 incluye DTOs de alumno/profesor, lectura fail-closed y tests HTTP
de dispatch Legacy/Generated, strict input, estados y códigos, ownership,
polling read-only, retry server-owned, idempotencia delegada a G4 y ausencia de
filtraciones. Todos los providers están mockeados: G5 no realiza llamadas OpenAI
ni requiere cambios de esquema. G6 realiza la aceptación integral posterior;
UI completa, feedback y M6 permanecen fuera de M5.

#### M5-G6 — Aceptación final y hardening — CLOSED / COMPLETE

G6 reconstruye y acepta la cadena completa: sesión owned → POST y dispatch
Legacy/Generated → freeze/claim G3 → snapshot persistido → evaluación E →
scoring F → completion/failure condicional G4 → DTO estudiante → GET polling.
La auditoría de fuentes confirma una única entrada HTTP Generated y ausencia de
caminos alternativos que acepten resultado clínico del cliente, reconstruyan la
evaluación desde `public.messages`, eviten ownership/freeze o escriban resultados
fuera del runtime de persistencia G2–G4.

El hardening amplía el rechazo HTTP strict a score, model, transcript, messages,
caseVersionId, fingerprint, protocol, policy, attemptId/count, lease,
failureCode, retry/force, evaluation y semantic result. Las respuestas de alumno
continúan siendo allowlists mínimas y los fallos malformados, ownership,
provider, lifecycle, DB o JSONB corrupto no exponen SQL, stack, prompt,
transcript, hechos clínicos, provider raw ni secretos. El mapper docente sigue
siendo server-only: no se publica ruta docente mientras no exista autorización
docente inequívoca.

La lease server-owned cambia de 5 a 30 minutos
(`SPFA_EVALUATION_LEASE_MS_V2 = 1800000`). El timeout permitido por una sola
adjudicación alcanza diez minutos y E2 procesa requisitos secuencialmente; cinco
minutos podían expirar dentro de una ejecución válida. Treinta minutos ofrece
margen conservador sin heartbeat ni input cliente. Una expiración puede repetir
trabajo/coste, pero nunca permite al worker stale completar o fallar el attempt
nuevo. Recovery conserva exactamente transcript, fingerprint y policy.

La aceptación PostgreSQL 17.10 aplica 0001 → 0002 → 0003 desde bases limpias y
también sobre fixtures Legacy representativos. Usuarios, casos, sesiones,
mensajes, evaluaciones, tokens, coste y contenido Legacy permanecen intactos; la
infraestructura v2 queda disponible sin registro artificial. RLS permanece
activo con cero policies; `anon` y `authenticated` no pueden SELECT, escribir ni
ejecutar las funciones trigger, mientras el backend conserva el patrón de
acceso previsto. La migración no contiene DDL destructivo Legacy, grants
accidentales ni `CASCADE` peligroso.

Las pruebas PostgreSQL con conexiones reales validan message-before-freeze,
freeze-before-message, doble claim/finalización, doble recovery/retry, crash
representado por `EVALUATING`, recovery desde el mismo snapshot, stale
completion/failure, replay `COMPLETED`, polling read-only incluso con lease
expirada y ownership indistinguible. La evaluación/provider está simulada y no
se realiza ninguna llamada OpenAI.

Resultados finales de aceptación G6 (26 de agosto de 2026):

- hardening nuevo G6: 17 regresiones añadidas, todas superadas;
- PostgreSQL real G3–G5: 18/18 pruebas superadas;
- G1–G6: 502 PASS / 18 SKIPPED opt-in;
- M5-E: 155/155 PASS;
- M5-F: 154/154 PASS;
- API Legacy + Generated V2: 82/82 PASS;
- regresión Legacy/evaluación: 159/159 PASS;
- regresión Generated/security: 489/489 PASS;
- SPFA: 942 PASS / 21 SKIPPED;
- suite normal offline: 2193 PASS / 24 SKIPPED;
- TypeScript y `git diff --check`: PASS.

La evidencia live D3C3 permanece materialmente válida: el prompt/transport
aceptado no cambió después de sus 9/9 escenarios y 30/30 targets con
`gpt-5.6-sol`. G6 no repite tests live ni realiza llamadas OpenAI. `UNCERTAIN`
permanece distinto de `NOT_SUPPORTED` y sin crédito confirmado, con revisión.

Con G1–G6 aceptados:

- **M5-G6 = CLOSED / COMPLETE**;
- **M5-G = CLOSED / COMPLETE**;
- **M5 = CLOSED / COMPLETE**.

Quedan deliberadamente fuera de M5 la ruta HTTP docente hasta disponer de un
boundary de autorización seguro, UI, feedback M6, analytics y mejoras operativas
posteriores. Ninguna de ellas limita la reproducibilidad, seguridad o cierre del
pipeline evaluativo M5.

## 19. Criterios de aceptación de M5-A

El contrato deja preparado demostrar posteriormente:

| ID | Criterio | Garantía del diseño |
| --- | --- | --- |
| A | La misma información espontánea o preguntada produce cobertura semántica equivalente. | El estado de cobertura se separa de `origin`. |
| B | Preguntar sin obtener respuesta no cuenta como información cubierta. | `STUDENT_QUESTION` no es por sí solo un origen ni crea un target cubierto. |
| C | Una afirmación del estudiante no crea un hecho. | Los targets factuales requieren información pública o mensaje aceptado/confirmación del paciente. |
| D | `NOT_APPLICABLE` no penaliza. | Es aplicabilidad materializada, no importancia ni omisión. |
| E | Un requisito crítico se identifica al margen del score. | `safetyCritical` e importancia efectiva son metadata estructural independiente. |
| F | `initial_treatment` y `continuation` pueden divergir. | Protocolo y aplicabilidad soportan scope por subtipo. |
| G | Indicación representa dominios y derivación. | Dominios de información y actuación son discriminados. |
| H | Una transición no crea un segundo chat. | Las aplicaciones referencian el único `carePath` de la misma sesión. |
| I | El protocolo histórico queda fijado. | Cada aplicación contiene una `SpfaProtocolRefV2` exacta; no existe resolución “latest”. |
| J | Legacy no recibe requisitos v2 inventados. | Su capacidad inicial es explícitamente `NOT_AVAILABLE`. |
| K | Ningún requisito depende de su texto visible. | Matching, bindings, evidencia y analytics usan IDs nominales estables. |

La aprobación de este documento no implica que los protocolos clínicos estén
completos ni validados. Solo fija la arquitectura en la que esos contenidos
podrán incorporarse con versionado, trazabilidad y seguridad.
