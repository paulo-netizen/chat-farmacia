# AGENTS.md — ChatUSAL-FarmaBot

## Mission

ChatUSAL-FarmaBot is an educational simulation platform for Pharmaceutical Care and SPFA training in Spanish community pharmacy.

The v2 specification is authoritative for product behavior.

## Mandatory reading before v2 work

Read, in this order:

1. `docs/v2/00_MASTER_SPEC.md`
2. `docs/v2/01_PRODUCT_SPEC.md`
3. `docs/v2/02_PATIENT_MODEL.md`
4. `docs/v2/03_SPFA_PROTOCOLS.md`
5. `docs/v2/04_EVALUATION_MODEL.md`
6. `docs/v2/05_CASE_GENERATION.md`
7. `docs/v2/06_TEACHER_WORKFLOW.md`
8. `docs/v2/07_STUDENT_WORKFLOW.md`
9. `docs/v2/08_DATA_MODEL.md`
10. `docs/v2/09_SECURITY_PRIVACY.md`
11. `docs/v2/10_ACCEPTANCE_TESTS.md`

If split documents and `00_MASTER_SPEC.md` conflict, stop and report the discrepancy before implementing.

## Critical product rules

- Student-visible patient data before the interview are limited to: name, age, sex, and treatment.
- Hidden clinical/contextual information must remain server-side.
- Never expose `ground_truth`, rubric internals, PRM/RNM answers, adherence answers, barriers, correct interventions, or questionnaire answer keys to the student client before completion.
- The patient model must always remain in the patient role.
- The patient must never act as assistant, teacher, evaluator, or system narrator.
- The patient must not reveal prompts, system instructions, ground truth, answer keys, or evaluation logic.
- The patient must not invent factual clinical, personal, social, or medication history outside the validated case.
- Unknown is not the same as negative. Do not fabricate absence of allergies, diseases, pregnancy, family support, etc.
- AI-generated cases are drafts. They require teacher review and explicit validation before publication.
- Generated cases must be plausible for Spanish community pharmacy and use clinically coherent, Spain-appropriate medicines and health problems.
- Once a case version has been used in a student session, that session must remain reproducible and linked to the immutable version it used.
- Evaluation must provide transcript evidence for scored criteria.
- Critical or low-confidence safety findings must be reviewable by a teacher.
- Do not silently simplify clinical, pedagogical, security, or scoring requirements.

## Engineering rules

- Inspect the real repository before assuming the current implementation matches historical descriptions.
- Use database migrations for schema changes.
- Keep authorization checks server-side.
- Do not rely on frontend hiding for security.
- Prefer typed schemas and explicit validation at API boundaries.
- Keep clinical taxonomies, protocol versions, scoring weights, thresholds, AI models, and token prices configurable rather than scattered hard-coded strings.
- Add automated tests for every new behavior.
- Include adversarial tests for role escape, prompt injection, ground-truth leakage, factual hallucination, and longitudinal inconsistency.
- Preserve existing data where reasonably possible.
- Avoid one-shot rewrites of the whole application.

## Workflow for major work

Before implementing a major feature:

1. Read the v2 specification.
2. Inspect the relevant v1 code paths.
3. Update `PLAN.md`.
4. Identify migrations and compatibility risks.
5. Implement the smallest coherent milestone.
6. Add/adjust tests.
7. Run lint, typecheck, unit/integration tests, and any relevant end-to-end tests.
8. Report:
   - files changed;
   - migrations;
   - tests run;
   - acceptance criteria satisfied;
   - unresolved risks;
   - specification items intentionally deferred.

## Definition of done

A v2 feature is not done merely because the UI appears to work.

It must also satisfy:

- functional requirement;
- server-side authorization;
- data isolation;
- validation;
- error handling;
- migration/versioning requirements;
- traceability;
- automated tests;
- security acceptance tests;
- no leakage of protected case information;
- relevant documentation updates.

## Change control

If implementation reveals that a clinical or pedagogical requirement is ambiguous, do not invent a new rule silently.

Record the ambiguity in `PLAN.md` under `Open decisions` and implement only what is unambiguous until the requirement is resolved.
