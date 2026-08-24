# 17 — Diseño versionado de protocolo SPFA y cobertura de información

## 1. Estado y alcance

Este documento fija el contrato conceptual de M5-A para describir, aplicar y
evaluar protocolos SPFA versionados. No contiene todavía catálogos clínicos,
checklists completos, extracción de evidencia, scoring, prompts, llamadas a IA,
persistencia ni interfaz.

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
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'NOT_COVERED';
      coveredTargetRefs: readonly [];
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
      evidence: readonly SpfaSessionEvidenceRefV2[];
    }>
  | Readonly<{
      status: 'NOT_APPLICABLE';
      evidence: readonly [];
    }>;
```

`PARTIALLY_COVERED` identifica exactamente qué targets se satisficieron y cuáles
faltan. El excerpt es una ayuda de presentación; la autoridad es `messageRef` y
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
      evidence: NonEmptyArray<SpfaSessionEvidenceRefV2>;
    }>
  | Readonly<{
      status: 'NOT_PERFORMED';
      remainingTargetRefs: NonEmptyArray<SpfaRequirementTargetId>;
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

#### M5-D3C2 — Executor OpenAI y normalización D3A — PENDING

Pendiente ejecutar el provider, normalizar su transport sin excerpts y someter
el resultado a la autoridad estructural D3A.

#### M5-D3C3 — Aceptación live controlada — PENDING

Pendiente validar el adjudicador con escenarios live controlados después de
cerrar executor y normalización.

#### M5-D3D — Integración y aceptación — PENDING

Pendiente integrar la adjudicación validada y demostrar sus fronteras mediante
pruebas de aceptación, sin confundirla todavía con el resultado final de
cobertura.

Invariantes de D3: candidato no equivale a evidencia semántica; evidencia
semántica no equivale a cobertura final; `UNCERTAIN` no equivale a
`NOT_SUPPORTED`; cada par citado procede del universo D2; una pregunta de origen
es metadata D1 y no evidencia factual; no se inventan referencias; y no se
deduce semántica mediante búsquedas o coincidencias textuales en esta frontera.

### M5-E — Evaluador de sesión SPFA

Componer aplicaciones, transcript y evidencia para producir cobertura y
resultados de actuación, sin scoring numérico todavía.

### M5-F — Scoring y omisiones críticas

Introducir configuración versionada de pesos, cálculo 0–100, alertas, caps y
revisión para omisiones críticas, con trazabilidad por requisito.

### M5-G — Integración y aceptación

Integrar finalización/persistencia/feedback autorizado y añadir pruebas de
concurrencia, versionado histórico, seguridad, adversariales y de aceptación.

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
