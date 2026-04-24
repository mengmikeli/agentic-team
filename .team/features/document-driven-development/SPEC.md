# Feature: Document-Driven Development

## Goal
Enforce that every feature is backed by a complete PRD before any build task is dispatched, and ensure agents receive full spec context (requirements, acceptance criteria, technical approach) with every task brief.

## Requirements
- `templates/SPEC.md` must include all seven sections: Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When — each with a comment explaining what to write there.
- `agt brainstorm` interactive mode must prompt for Requirements, Acceptance Criteria, Technical Approach, and Testing Strategy in addition to existing prompts.
- `agt brainstorm` agent mode brief must instruct the agent to populate all seven sections; output must be parsed and written to `SPEC.md` with all sections present.
- The outer-loop autonomous brainstorm brief must instruct agents to produce a full PRD; resulting `SPEC.md` files must contain all seven sections.
- A `validateSpec(specContent)` function must return a list of missing or empty section names.
- `_runSingleFeature` must call `validateSpec` before `planTasks`; if any required section is missing or empty, it must log a clear error listing the offending sections and exit non-zero without dispatching any agent.
- Each task brief must include the Acceptance Criteria and Technical Approach sections verbatim from the spec so agents know what "done" looks like.
- Validation must reject sections that contain only unsubstituted placeholder text (e.g. `{Requirement 1}`).

## Acceptance Criteria
- [ ] `templates/SPEC.md` contains all seven required sections with explanatory comments in each.
- [ ] `agt brainstorm` (interactive) prompts for all seven sections.
- [ ] `agt brainstorm` (agent mode) brief produces specs with all seven sections populated.
- [ ] Outer-loop brainstorm brief produces `SPEC.md` files with all seven sections.
- [ ] `validateSpec` rejects a spec with any missing section and names the missing sections in its return value.
- [ ] `validateSpec` rejects a spec with a section containing only placeholder text.
- [ ] `validateSpec` accepts a spec with all sections present and non-empty.
- [ ] `_runSingleFeature` exits non-zero before dispatching any agent when the spec is incomplete.
- [ ] Task briefs include Acceptance Criteria and Technical Approach verbatim from the spec.
- [ ] All existing tests continue to pass.

## Technical Approach

**`templates/SPEC.md`** — expand to seven sections, add one-line comment in each explaining what belongs there.

**New file `bin/lib/spec-validator.mjs`**
- Export `validateSpec(specContent: string): { valid: boolean; errors: string[] }`
- Required section headers: `['## Goal', '## Requirements', '## Acceptance Criteria', '## Technical Approach', '## Testing Strategy', '## Out of Scope', '## Done When']`
- Section body = text between consecutive `##` headers, stripped of whitespace
- Invalid if: body length < 20 chars, or body matches `/\{[^}]+\}/` (unsubstituted placeholder)
- Returns `{ valid: true }` or `{ valid: false, errors: ['Missing section: ## Goal', ...] }`

**`bin/lib/run.mjs`** — `_runSingleFeature` flow
- After loading or synthesizing `SPEC.md` (around lines 897–922), call `validateSpec()` before `planTasks()`
- On failure: log errors and throw/exit non-zero; no tasks dispatched
- Task brief builder: replace truncated spec snippet with verbatim Acceptance Criteria + Technical Approach sections

**`bin/lib/context.mjs`** — remove or raise the 1500-char truncation on `SPEC.md` content

**`bin/lib/outer-loop.mjs`** — after autonomous brainstorm writes `SPEC.md`, call `validateSpec()`; if invalid, log errors and skip the feature (do not create approval issue)

**`bin/lib/brainstorm-cmd.mjs`** — interactive prompts and agent brief updated to request all seven sections explicitly

**`bin/lib/flows.mjs`** — brainstorm brief template updated to enumerate all required PRD sections with per-section instructions

## Testing Strategy
- **Unit tests** (`test/spec-validator.test.mjs`): ≥6 cases — missing section, empty section, placeholder text, fully valid, partial placeholder, all sections present but one empty.
- **Integration test** (`test/run.test.mjs`): mock a feature directory with an incomplete `SPEC.md`; assert `_runSingleFeature` exits before any agent dispatch.
- **Integration test** for outer loop: mock brainstorm output that produces an incomplete spec; assert no approval GitHub issue is created and the feature is skipped cleanly.
- **Manual check**: run `agt run` against a hand-crafted SPEC.md missing one section; confirm error names the missing section.

## Out of Scope
- Per-requirement acceptance criteria linked to individual tasks (roadmap item #18 — parent issue + subtask lifecycle).
- Spec versioning or change history.
- Comment-based feedback round-trips on the GitHub approval issue.
- Automatic test stub generation from the Testing Strategy section.
- Spec linting rules beyond section presence and non-emptiness.
- Changes to the human approval gate flow — the approval gate already handles human sign-off; this feature adds spec completeness validation independently.

## Done When
- [ ] `templates/SPEC.md` contains all seven sections with explanatory comments.
- [ ] `agt brainstorm` (interactive) prompts for all seven sections.
- [ ] `agt brainstorm` (agent mode) brief populates all seven sections.
- [ ] Outer-loop brainstorm brief produces `SPEC.md` files with all seven sections.
- [ ] `validateSpec` in `bin/lib/spec-validator.mjs` is exported and unit-tested (≥6 cases, all pass).
- [ ] `_runSingleFeature` exits non-zero before dispatching any agent when spec is incomplete.
- [ ] Task briefs include Acceptance Criteria and Technical Approach verbatim from the spec.
- [ ] All existing tests pass (`npm test` green).
