# Feature: Document-Driven Development

## Goal
Enforce that every feature is backed by a complete PRD before any build task is dispatched, and ensure agents receive full spec context (requirements, acceptance criteria, technical approach) with every task brief.

## Background
Currently `SPEC.md` has four sections: Goal, Scope, Out of Scope, Done When. Tasks are extracted from the Done When checklist, but agents only receive the task title and gate command — they have no visibility into the broader requirements, acceptance criteria, or technical approach. There is also no enforcement that the spec is complete before execution begins. This feature adds structured PRD sections to the template, updates brainstorm to populate them, validates completeness before dispatch, and threads the relevant spec sections into task briefs.

## Scope
- **Expand SPEC.md template** (`templates/SPEC.md`) to include: Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When. Each section has a brief description comment explaining what belongs there.
- **Update `agt brainstorm`** (`bin/lib/brainstorm-cmd.mjs`) — both the interactive prompts and the agent brief — to produce specs with all required sections populated.
- **Update outer-loop brainstorm brief** (`bin/lib/outer-loop.mjs`) — the brief agents receive for the autonomous brainstorm phase must instruct them to produce all required PRD sections.
- **Add spec validation** (`bin/lib/run.mjs`) — before `planTasks()` is called, validate that all required sections (Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When) are present and non-empty. Exit with a clear, actionable error listing missing sections if validation fails.
- **Thread spec context into task briefs** — each task brief includes the full Acceptance Criteria and Technical Approach sections from the spec, so agents know what "done" looks like and how to approach the work.
- **Tests** — unit tests for spec validation (rejects incomplete specs, accepts complete specs, error message names missing sections). Integration test that `agt run` with an incomplete spec exits non-zero before dispatching any task.

## Out of Scope
- Per-requirement acceptance criteria linked to individual tasks (that's roadmap item #18 — parent issue + subtask lifecycle).
- Spec versioning or change history.
- Comment-based feedback round-trips on the GitHub approval issue.
- Automatic test stub generation from the Testing Strategy section.
- Spec linting rules beyond section presence and non-emptiness.
- Changes to the human approval gate flow — the approval gate already handles human sign-off; this feature adds spec completeness validation which is independent.

## Done When
- [ ] `templates/SPEC.md` contains all seven sections: Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When — each with a brief comment explaining what to write there.
- [ ] `agt brainstorm` (interactive mode) prompts the user for Requirements, Acceptance Criteria, Technical Approach, and Testing Strategy in addition to the existing prompts.
- [ ] `agt brainstorm` (agent mode) brief instructs the agent to populate all seven sections; the agent output is parsed and written to `SPEC.md` with all sections present.
- [ ] Outer-loop autonomous brainstorm brief instructs the agent to produce a full PRD; resulting `SPEC.md` files produced by the outer loop contain all seven sections.
- [ ] `validateSpec(specContent)` function in `bin/lib/run.mjs` (or a dedicated `spec-validator.mjs`) returns an array of missing/empty section names.
- [ ] `_runSingleFeature` calls `validateSpec` before `planTasks`; if any required section is missing or empty, it logs a clear error listing the missing sections and exits non-zero without dispatching any task.
- [ ] Each task brief includes the Acceptance Criteria and Technical Approach sections verbatim from the spec.
- [ ] Unit tests: `validateSpec` rejects a spec missing any required section; accepts a spec with all sections non-empty; error output names the specific missing sections.
- [ ] Integration test: running `agt run` (or equivalent inner-loop invocation) against a feature with an incomplete `SPEC.md` exits before any agent is dispatched.
- [ ] All existing tests continue to pass.
