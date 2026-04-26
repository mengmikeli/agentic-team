# Feature: Self-Simplification Pass

## Goal
Before finalizing a feature, automatically review all changed files in the feature branch for deletability, inlining, and over-engineering, and either apply fixes or block finalization until addressed — countering AI-accumulated bloat across the full changeset.

## Requirements
- After all tasks in a feature pass review (and before `finalize` runs), a dedicated simplification pass executes against the full feature-branch diff.
- The pass dispatches a simplification agent with the full `git diff main..HEAD` output as context, not just the last task's changes.
- The agent is prompted to find: dead code, unnecessary abstraction layers, inlinable helpers, gold-plating, and over-engineered solutions.
- Critical findings (🔴) must be resolved before `finalize` proceeds — the pass enters a fix-then-re-verify loop (max 2 rounds).
- Warning findings (🟡) are logged to `progress.md` and the feature's eval artifacts, but do not block finalization.
- The pass is skippable with a `--no-simplify` flag on `agt run` / inner loop invocation.
- Pass results are written to `.team/features/<slug>/simplify-eval.md` alongside existing `eval.md` artifacts.
- Token usage and duration for the simplification pass are tracked in STATE.json under a `simplifyPass` key.

## Acceptance Criteria
- [ ] Self-simplification pass runs automatically after all tasks pass review, before `finalize`, in the feature execution flow (`run.mjs` / `outer-loop.mjs`).
- [ ] Pass uses full `git diff main..HEAD` (or the feature branch base), not a per-task diff.
- [ ] Critical simplicity findings block `finalize`; the harness enters a fix loop (max 2 rounds before escalating to human).
- [ ] Warning findings appear in `simplify-eval.md` and `progress.md` but do not block.
- [ ] `--no-simplify` flag skips the pass and logs a skip notice to `progress.md`.
- [ ] `simplify-eval.md` is written with the agent's structured findings (same severity format as `eval.md`).
- [ ] Token cost and duration for the simplification pass are captured in STATE.json `simplifyPass` field.
- [ ] Existing review flow (per-task simplicity veto) is unchanged.
- [ ] Unit tests cover: pass-triggers-before-finalize, critical-blocks, warning-passes-through, skip-flag, max-rounds-escalation.

## Technical Approach

### Where to insert
In `bin/lib/run.mjs`, after the last task transitions to `"passed"` and before the `harness("finalize", ...)` call (currently around line 1501), add a `runSelfSimplificationPass()` call.

### New function: `runSelfSimplificationPass(agent, featureSlug, cwd, opts)`
1. Get full diff: `git diff $(git merge-base HEAD main)..HEAD` executed in `cwd`.
2. If diff is empty (no changes), skip with a log notice.
3. Dispatch agent with `roles/simplicity.md` system prompt + diff as context. Prompt asks for structured findings in the same `🔴/🟡/🔵 [simplicity] ...` format as the existing review roles.
4. Parse findings using existing `parseFindings()` from `bin/lib/synthesize.mjs`.
5. Write findings to `<featureDir>/simplify-eval.md`.
6. If any `critical` findings: enter fix loop — dispatch a fix agent (same agent, same cwd), then re-run step 3–5. Max 2 fix rounds; after round 2, write escalation notice and throw to trigger human review (same pattern as `review-escalation.mjs`).
7. Log warning findings to `progress.md`.
8. Append `simplifyPass: { critical, warning, rounds, tokens, durationMs }` to STATE.json via existing `writeState()`.

### Files to change
- `bin/lib/run.mjs` — insert `runSelfSimplificationPass()` call + implement function (or extract to new `bin/lib/simplify-pass.mjs`).
- `bin/lib/state-sync.mjs` — add `simplifyPass` field to state schema if schema is enforced.
- `bin/lib/outer-loop.mjs` — pass `--no-simplify` flag through to inner loop invocation when user supplies it.
- `bin/agt.mjs` (CLI entry) — add `--no-simplify` flag to `run` subcommand.

### Reuse
- `parseFindings()` from `synthesize.mjs` — unchanged.
- `roles/simplicity.md` — reused as system prompt; no new role file needed.
- `writeState()` / state atomic write — unchanged.
- `appendProgress()` — unchanged.

## Testing Strategy
- **Unit tests** (`test/simplify-pass.test.mjs`):
  - Empty diff → skip, no findings written.
  - Diff with critical findings → fix loop entered, escalation after round 2.
  - Diff with warning-only findings → `simplify-eval.md` written, `finalize` proceeds.
  - `--no-simplify` flag → pass skipped, skip notice in progress.
  - `simplifyPass` key written to STATE.json with correct shape.
- **Integration**: Existing `test/run.test.mjs` or an integration fixture verifies the pass is called in the right sequence (after last task passes, before finalize).
- **Manual check**: Run a feature end-to-end with a deliberate over-engineered file; confirm simplify-eval.md is created and critical findings block finalize.

## Out of Scope
- Making the simplification agent apply code edits autonomously (it only produces findings; a separate fix agent applies them via the standard build-gate path).
- Per-task simplification (the existing per-task simplicity reviewer role already handles this).
- Surfacing simplify-eval.md findings in the dashboard (deferred to a future dashboard update).
- Configurable simplification rules beyond the existing `roles/simplicity.md` definition.
- Running the pass in non-feature (ad-hoc) `agt run` invocations without a feature branch.

## Done When
- [ ] `runSelfSimplificationPass()` is implemented and wired in `run.mjs` between last-task-pass and finalize.
- [ ] Critical findings block finalize; warning findings do not.
- [ ] `--no-simplify` flag is accepted by `agt run` and skips the pass.
- [ ] `simplify-eval.md` is written for every non-skipped feature run.
- [ ] `simplifyPass` metrics are present in STATE.json after a run.
- [ ] All new unit tests pass; existing test suite remains green.
