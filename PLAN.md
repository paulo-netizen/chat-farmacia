# PLAN.md — ChatUSAL-FarmaBot v2

## Status

**Current phase:** Architecture and v1 audit  
**Implementation authorization:** Do not implement the complete v2 in one change.

This plan must be updated by Codex as the repository is audited and milestones are completed.

---

# 1. Immediate objective

Audit the current ChatUSAL-FarmaBot repository against the v2 specification and produce an implementation plan grounded in the real codebase.

Before changing product behavior:

- inspect authentication and authorization;
- inspect database schema and migration history;
- inspect case creation/editing;
- inspect session creation and case assignment;
- inspect chat prompt construction and model calls;
- inspect evaluation;
- inspect teacher dashboard;
- inspect student-visible API responses;
- inspect test coverage;
- inspect deployment/configuration assumptions.

Do not assume that historical descriptions of v1 remain exact.

---

# 2. Questions the audit must answer

## Architecture

- What framework/version is currently used?
- How are server and client boundaries implemented?
- Where are OpenAI calls made?
- What schemas/types currently describe cases, sessions, messages and evaluations?
- What can be reused safely?

## Database

- What tables and migrations actually exist?
- Are `case_assignments`, `service_type`, `updated_at`, or equivalent fields present?
- Are status vocabularies consistent?
- Are there production data compatibility concerns?
- How should case versioning be added?

## Security

- Does any student API response expose `ground_truth` or other protected fields?
- Can students request another student's session?
- Are teacher/admin checks server-side?
- Are questionnaire answer keys ever sent before submission?
- Is session ownership enforced everywhere?
- Can prompt injection cause role escape or solution leakage?

## Sessions

- Does mounting/reloading `/chat` create a session?
- Can an active session be resumed?
- Are duplicate sessions possible?
- Can a teacher preview without creating academic data?

## Patient model

- How is the current prompt built?
- Which case fields are sent to the patient model?
- Can the model invent facts?
- Can it reveal ground truth?
- What output-validation layer exists?

## Evaluation

- Is scoring based on exact strings?
- Which data are persisted?
- Can transcript evidence be linked to rubric criteria?
- How should the current 0–3 score migrate or coexist with v2 scores?

## Teacher UI

- Can teachers view transcripts?
- Can they edit structured case data without JSON?
- Can cases be versioned?
- Can AI drafts be reviewed and validated?
- Can teacher overrides of AI evaluation be stored non-destructively?

---

# 3. Target architecture principles

1. Separate AI generator, auditor, patient and evaluator responsibilities.
2. Separate `student_public_view`, `patient_runtime_view` and `evaluator_view`.
3. Version cases, protocols, rubrics and questionnaires.
4. Link each session to an immutable case version.
5. Keep protected content server-side.
6. Evaluate by covered information and transcript evidence, not literal question strings.
7. Keep scoring/taxonomies/protocol versions configurable.
8. Require teacher validation before publication.
9. Add automatic case QA and adversarial patient tests.
10. Preserve auditable original AI scores when teachers override them.

---

# 4. Proposed milestone sequence

## M0 — v1 safety and schema stabilization

Goals:
- audit real schema;
- create/repair migration baseline;
- unify status vocabulary;
- remove protected-data leakage;
- correct session ownership/auth checks;
- stop accidental session creation on page mount;
- fix obvious field-name inconsistencies;
- establish regression tests.

Acceptance:
- no protected case solution in student session API;
- reload does not create duplicate academic sessions;
- role/ownership tests pass;
- schema can be created from migrations from a clean environment.

## M1 — Case versioning and v2 data foundation

Goals:
- introduce immutable case versions;
- introduce protocol/rubric/questionnaire version references;
- define public/patient/evaluator projections;
- preserve legacy cases through migration strategy.

Acceptance:
- modifying a published case creates a new version;
- old session still resolves to old version;
- public projection excludes protected content.

## M2 — Structured teacher case editor

Goals:
- replace required JSON editing with structured forms;
- support public data, hidden data, patient profile, protocol, PRM/RNM, adherence, interventions, derivation, questionnaire;
- retain optional technical JSON/debug view if useful.

Acceptance:
- teacher can create a complete publishable case without manually editing JSON.

## M3 — AI case generation + audit

Goals:
- generate structured draft;
- validate schema;
- run automated clinical/logical audit;
- show warnings/failures;
- require teacher validation.

Acceptance:
- generated case cannot be assigned before explicit validation;
- audit results are stored/displayed;
- generated case includes questionnaire and explanations.

## M4 — Patient runtime v2

Goals:
- natural initial demand;
- personality;
- progressive disclosure;
- explicit handling of unknown facts;
- role fidelity;
- output validation/regeneration;
- preview mode.

Acceptance:
- adversarial role/leakage/hallucination tests pass;
- teacher preview does not contaminate student analytics.

## M5 — SPFA protocol engine

Goals:
- versioned protocol definitions;
- Dispensación: inicio/continuación;
- Indicación Farmacéutica;
- critical/relevant/optional/not-applicable requirements;
- evaluate coverage by information obtained.

Acceptance:
- patient-supplied information counts as covered;
- no need for literal question matching;
- critical omissions are identified.

## M6 — PRM/RNM/adherence/intervention evaluator

Goals:
- semantic normalization;
- detect PRM/RNM;
- adherence state/type/barriers;
- strategy vs intervention;
- derivation/report/follow-up;
- evidence linking.

Acceptance:
- semantic equivalent answers score correctly;
- correct final guess without interview evidence is distinguishable from demonstrated reasoning.

## M7 — Communication evaluator

Goals:
- greeting/welcome;
- early open question;
- appropriate closed-question use;
- empathy/non-judgment;
- active listening;
- summary/emphasis;
- closing/help offer/farewell.

Acceptance:
- every score includes evidence;
- evaluator does not reward generic politeness as full empathy.

## M8 — Post-case questionnaire

Goals:
- fixed graded questionnaire tied to case version;
- single/multi-select;
- explanations;
- optional personalized formative questions.

Acceptance:
- answer keys not sent before submission;
- same case version gives same graded questions;
- adaptive questions do not affect grade initially.

## M9 — Results and feedback

Goals:
- protocol score;
- pharmaceutical score;
- communication score;
- overall performance;
- comprehension score;
- detailed evidence-based feedback.

Acceptance:
- all five results display correctly;
- weighting configurable;
- feedback references actual transcript evidence.

## M10 — Teacher analytics/review

Goals:
- transcript viewer;
- rubric evidence;
- confidence/safety flags;
- teacher override with audit trail;
- case/version analytics.

Acceptance:
- original AI evaluation preserved after teacher correction.

## M11 — Hardening and observability

Goals:
- adversarial regression suite;
- system-quality metrics;
- failure/retry behavior;
- cost/token observability;
- production security review.

Acceptance:
- acceptance suite green;
- no known critical protected-data leak;
- role-fidelity suite passes target threshold.

---

# 5. Open decisions

Codex must add unresolved implementation questions here instead of silently deciding clinical/pedagogical behavior.

Initial configurable decisions:

- final scoring weights;
- exact PRM/RNM taxonomy version;
- exact protocol version data structure;
- final intervention-strategy taxonomy;
- confidence thresholds;
- AI model selection;
- number of patient-response regeneration attempts;
- final number of graded questionnaire items;
- exact course/group assignment model.

---

# 6. Required audit output before M0 implementation

Codex must update this file with:

- current architecture summary;
- real schema inventory;
- endpoint inventory;
- confirmed v1 issues;
- target architecture proposal;
- migration strategy;
- risk register;
- detailed M0 file list;
- M0 tests;
- estimated dependency graph between milestones.

No broad v2 implementation should start before this audit is written.
