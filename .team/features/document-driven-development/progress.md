# Progress: document-driven-development

**Started:** 2026-04-24T04:07:53.118Z
**Tier:** functional
**Tasks:** 10

## Plan
1. `templates/SPEC.md` contains all seven sections: Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When — each with a brief comment explaining what to write there.
2. `agt brainstorm` (interactive mode) prompts the user for Requirements, Acceptance Criteria, Technical Approach, and Testing Strategy in addition to the existing prompts.
3. `agt brainstorm` (agent mode) brief instructs the agent to populate all seven sections; the agent output is parsed and written to `SPEC.md` with all sections present.
4. Outer-loop autonomous brainstorm brief instructs the agent to produce a full PRD; resulting `SPEC.md` files produced by the outer loop contain all seven sections.
5. `validateSpec(specContent)` function in `bin/lib/run.mjs` (or a dedicated `spec-validator.mjs`) returns an array of missing/empty section names.
6. `_runSingleFeature` calls `validateSpec` before `planTasks`; if any required section is missing or empty, it logs a clear error listing the missing sections and exits non-zero without dispatching any task.
7. Each task brief includes the Acceptance Criteria and Technical Approach sections verbatim from the spec.
8. Unit tests: `validateSpec` rejects a spec missing any required section; accepts a spec with all sections non-empty; error output names the specific missing sections.
9. Integration test: running `agt run` (or equivalent inner-loop invocation) against a feature with an incomplete `SPEC.md` exits before any agent is dispatched.
10. All existing tests continue to pass.

## Execution Log

### 2026-04-24 04:16:40
**Task 1: `templates/SPEC.md` contains all seven sections: Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When — each with a brief comment explaining what to write there.**
- Verdict: 🟡 Review FAIL (attempt 1)
- Will retry with review feedback

