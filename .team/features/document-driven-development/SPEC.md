# Feature: Document-driven development

## Goal
Make a complete, validated PRD (`SPEC.md`) a hard precondition for any code-writing phase, so no task in `agt run` ever executes against a missing, partial, or auto-stubbed spec.

## Context (what already exists)
- `templates/SPEC.md` is the canonical PRD template with the seven sections: Goal, Requirements, Acceptance Criteria, Technical Approach, Testing Strategy, Out of Scope, Done When.
- `validateSpecFile(specPath)` in `bin/lib/outer-loop.mjs` already returns `{ valid, sections, missing }` against those seven sections.
- The outer loop (`runOuterLoop`) already invokes the brainstorm/spec-exploration agent and creates a GitHub approval issue for human sign-off before dispatching execution. This is the "approved" gate.
- `agt brainstorm` writes `SPEC.md` from the same template.

## The gap
- `bin/lib/run.mjs` (around lines 925–938) silently auto-writes a 4-line minimal spec when `SPEC.md` is absent and proceeds with task planning. This bypasses the PRD requirement entirely when `agt run <feature>` is invoked outside the outer loop, or after a SPEC.md was deleted.
- `validateSpecFile` is only called from the outer loop's spec-exploration step; the inner run loop never enforces it.
- The brainstorm agent brief in `bin/lib/brainstorm-cmd.mjs` lists six sections in its required output (missing `Testing Strategy` mention is fine but it doesn't include `Done When` consistently with `validateSpecFile`'s seven). The two definitions of "complete spec" must align on a single canonical list.

## Requirements
- A single canonical "PRD section list" constant is the source of truth for what a complete `SPEC.md` contains: `Goal`, `Requirements`, `Acceptance Criteria`, `Technical Approach`, `Testing Strategy`, `Out of Scope`, `Done When`. `validateSpecFile`, `agt brainstorm`'s agent brief, and any new gate read from this constant.
- `agt run <feature>` MUST fail fast with a clear error if `.team/features/<slug>/SPEC.md` is missing or fails validation. It MUST NOT silently auto-write a minimal spec.
- The error message tells the user how to produce a valid spec (`agt brainstorm "<idea>"`) and lists the missing sections.
- The outer loop's existing behavior is preserved: it still runs the spec-exploration agent, validates the result, and creates the human approval issue. If validation fails after exploration, it surfaces a clear error and halts that feature (does not silently fall through).
- An `--allow-stub-spec` escape hatch is NOT added. The whole point is "no code without approved spec".
- Existing features with a valid SPEC.md continue to run unchanged.
- `agt run` invoked with no arguments (resume mode) also enforces the gate per resumed feature.

## Acceptance Criteria
- [ ] A single exported constant (e.g. `PRD_SECTIONS` in `bin/lib/outer-loop.mjs` or a new `bin/lib/spec.mjs`) defines the seven required sections; all spec-related code paths import it.
- [ ] `agt run my-feature` with no `SPEC.md` exits non-zero with a message naming the missing file and pointing at `agt brainstorm`.
- [ ] `agt run my-feature` with a `SPEC.md` that is missing one or more required sections exits non-zero, lists the missing sections, and does NOT modify the file or run any tasks.
- [ ] `agt run my-feature` with a fully valid `SPEC.md` proceeds exactly as today (planning, dispatch, gates).
- [ ] The auto-stub branch in `bin/lib/run.mjs` (`writeFileSync(specPath, specContent)` for the minimal spec) is removed.
- [ ] The brainstorm agent brief and template advertise the same seven sections that `validateSpecFile` checks for.
- [ ] Outer loop, after spec-exploration, re-runs `validateSpecFile` and halts the feature with a clear failure if the spec is still incomplete (no silent minimal-spec fallback).
- [ ] `npm test` is green; new tests cover (a) gate blocks missing spec, (b) gate blocks partial spec, (c) gate allows valid spec.

## Technical Approach

### 1. Centralize the section list
Add `export const PRD_SECTIONS = ["Goal", "Requirements", "Acceptance Criteria", "Technical Approach", "Testing Strategy", "Out of Scope", "Done When"];` to `bin/lib/outer-loop.mjs` (or extract a small `bin/lib/spec.mjs` if it keeps `outer-loop.mjs` cleaner). Refactor `validateSpecFile` to use it. Have `bin/lib/brainstorm-cmd.mjs` import this constant and render the section names into the agent brief, so brief and validator can never drift.

### 2. Enforce in `agt run`
In `bin/lib/run.mjs` around lines 925–938:
- Replace the "if not exists, write minimal spec" block with a call to `validateSpecFile(specPath)`.
- On `valid === false`:
  - Print red error: `SPEC.md missing required sections: <list>` (or `SPEC.md not found`).
  - Print hint: `Run: agt brainstorm "<feature description>"`.
  - Notify via `harness("notify", "--event", "feature-blocked", ...)`.
  - `process.exit(2)` (distinct exit code so callers / outer loop can detect spec-gate failure).
- Only proceed to `planTasks` after the gate passes.

### 3. Outer loop hardening
In `bin/lib/outer-loop.mjs` after the spec-exploration agent runs:
- Keep `validateSpecFile` call.
- Remove the "Agent didn't write SPEC.md — Creating minimal spec" branch.
- On invalid spec: log error, mark the feature as blocked in STATE.json (`status: "blocked-no-spec"` or similar already-supported status), append to `progress.md`, and `continue` to the next feature instead of dispatching execution.

### 4. Tests
- Add `test/document-driven-development.test.mjs`:
  - Unit: `validateSpecFile` with valid file → `valid: true, missing: []`.
  - Unit: `validateSpecFile` with file missing `Testing Strategy` → returns it in `missing`.
  - Unit: `validateSpecFile` with no file → `valid: false`, all sections missing.
  - Integration: spawn `agt run <feature>` against a tmp dir with no `SPEC.md` → exit code 2, no `STATE.json` task list created.
  - Integration: same with a stub SPEC.md missing `Out of Scope` → exit code 2, file is unchanged on disk.
  - Integration: with a complete SPEC.md → run proceeds (mock or stub the agent dispatch to keep test fast).
- Update any existing tests that relied on the auto-stub behavior (most likely none, since the stub was undocumented behavior).

### 5. Documentation
Touch only what users actually read:
- `PLAYBOOK.md`: one-liner under the run section: "`agt run` requires a valid `SPEC.md`. Use `agt brainstorm` first."
- No new doc files.

## Testing Strategy
- **Unit**: `validateSpecFile` cases above; pure function, no I/O mocking required.
- **Integration**: drive `agt run` end-to-end in a tmp dir using the existing test harness pattern (see `test/run.simplicity-veto.test.mjs` for a model). Stub `findAgent`/`dispatchToAgent` so we never invoke a real LLM.
- **Manual sanity** (one-off): in a scratch repo, `rm SPEC.md && agt run feature-x` and confirm the failure message.
- **Regression**: full `npm test` green, including outer-loop and brainstorm tests.

## Out of Scope
- Changing the PRD section list itself (the seven sections are already fixed by the roadmap entry).
- Any UI/dashboard surface for spec status — covered separately if needed.
- Stricter content validation (e.g. requiring at least N bullets per section, banning `TBD`). The gate is structural only.
- Linting `Done When` checkboxes for completeness — that's a different feature (could be a future "PRD lint").
- Spec versioning, diffing, or history — out of scope.
- Changing the human-approval gate or its GitHub issue flow.
- Adding `--allow-stub-spec` or any bypass flag.
- Refactoring `agt brainstorm` interactive mode UX — only the agent-mode brief alignment is in scope.
- Migrating older feature folders that may have minimal stub specs — they will simply fail the gate the next time `agt run` is invoked, and the user re-runs `agt brainstorm`.

## Done When
- [ ] `PRD_SECTIONS` constant is defined once and consumed by `validateSpecFile`, the brainstorm agent brief, and the `agt run` gate.
- [ ] `bin/lib/run.mjs` no longer contains a code path that writes a minimal `SPEC.md`; running against a missing or partial spec exits with a non-zero status and a clear message.
- [ ] `bin/lib/outer-loop.mjs` halts a feature (does not auto-stub) when the spec-exploration agent fails to produce a complete spec.
- [ ] New unit + integration tests cover the missing-spec, partial-spec, and valid-spec paths and pass.
- [ ] `npm test` is green.
- [ ] PLAYBOOK.md mentions the spec requirement under the `agt run` section.
- [ ] Manually verified: `agt brainstorm` → produces a complete SPEC.md → `agt run` proceeds.
