# ChatUSAL-FarmaBot v2 specification package

This folder is intended to be copied into the root of the ChatUSAL-FarmaBot repository.

## Files

- `AGENTS.md` — persistent instructions for Codex.
- `PLAN.md` — living implementation plan; Codex must update it after auditing the repository.
- `CODEX_START_PROMPT.md` — the first prompt to give Codex.
- `docs/v2/00_MASTER_SPEC.md` — master source of truth.
- `docs/v2/01_PRODUCT_SPEC.md`
- `docs/v2/02_PATIENT_MODEL.md`
- `docs/v2/03_SPFA_PROTOCOLS.md`
- `docs/v2/04_EVALUATION_MODEL.md`
- `docs/v2/05_CASE_GENERATION.md`
- `docs/v2/06_TEACHER_WORKFLOW.md`
- `docs/v2/07_STUDENT_WORKFLOW.md`
- `docs/v2/08_DATA_MODEL.md`
- `docs/v2/09_SECURITY_PRIVACY.md`
- `docs/v2/10_ACCEPTANCE_TESTS.md`

## Recommended first use

1. Copy these files to the repository root preserving paths.
2. Commit them as specification-only changes.
3. Give Codex the contents of `CODEX_START_PROMPT.md`.
4. Let Codex inspect the repository and update `PLAN.md`.
5. Review the resulting `PLAN.md` before authorizing M0 implementation.

Do not ask Codex to build all v2 functionality in one task.
