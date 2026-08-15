# Initial Codex prompt — ChatUSAL-FarmaBot v2

We are evolving the existing ChatUSAL-FarmaBot repository to v2.

Do **not** implement the v2 yet.

Your first task is an architecture, security, schema and gap audit grounded in the actual repository.

## Mandatory reading

Read completely:

- `AGENTS.md`
- `docs/v2/00_MASTER_SPEC.md`
- all files under `docs/v2/`
- `PLAN.md`

Treat the v2 documentation as the product specification.

## Then inspect the real repository

Inspect at minimum:

- application structure;
- authentication;
- authorization;
- database schema and migrations;
- seed data;
- case creation/editing;
- AI case generation;
- session creation;
- case assignment;
- chat/patient prompt;
- OpenAI calls;
- message persistence;
- evaluation;
- questionnaire if any;
- teacher dashboard;
- student-facing API payloads;
- configuration/environment variables;
- tests;
- deployment assumptions.

Do not assume that previous descriptions of v1 are still exact. Confirm everything in code.

## Required output

Update `PLAN.md` with a concrete repository-specific audit containing:

1. current architecture;
2. current database schema and migration state;
3. endpoint/action inventory;
4. confirmed security issues;
5. confirmed data-model inconsistencies;
6. confirmed protected-data exposure risks;
7. current patient-prompt weaknesses;
8. current evaluation limitations;
9. reusable v1 components;
10. components that should be replaced;
11. proposed target architecture;
12. migration strategy preserving existing data where reasonably possible;
13. milestone dependency graph;
14. detailed M0 implementation scope;
15. exact files expected to change in M0;
16. tests required for M0;
17. open decisions requiring human input.

## Non-negotiable constraints

- Do not expose `ground_truth` or answer keys to student clients.
- Do not simplify the patient-role safety requirements.
- Do not let the patient invent undefined facts.
- Do not allow AI-generated cases to publish without explicit teacher validation.
- Do not hardcode clinical taxonomies, protocol versions, scoring weights or AI models across the codebase.
- Do not redesign the whole application in one change.
- Do not modify production data destructively.
- Do not silently reinterpret clinical or pedagogical requirements.

## Working style

Use the smallest number of repository reads/commands necessary to form a reliable audit, but inspect all relevant code paths.

Do not write implementation code in this first task unless a tiny non-behavioral change is strictly required to produce the audit (normally it should not be).

At the end, report:

- what you inspected;
- the most important confirmed risks;
- the proposed M0;
- unresolved questions;
- whether the repository is ready to begin M0.
