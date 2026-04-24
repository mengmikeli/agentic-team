# Feature: Self-Simplification Pass

## Goal
After all tasks complete and before the feature branch is pushed, run an automated agent pass over every file changed in the feature branch to identify and apply simplifications — deleting dead code, inlining unnecessary wrappers, removing premature abstractions — then re-run the gate to ensure nothing broke.

## Requirements
- After the task loop completes and before `git push`, dispatch a simplification agent that reviews all files changed in the feature branch
- The agent is given the list of changed files (via `git diff`) and the simplicity role definition, and instructed to apply any clear simplifications directly
- If the agent makes any changes, re-run the configured quality gate; gate must pass before proceeding to push
- Commit simplification changes (if any) with message `chore: self-simplification pass`
- If no files changed or no simplifications are found, the pass is a no-op and execution continues normally
- Provide `--skip-simplification` flag on `agt run` to bypass the pass (escape hatch for emergencies)
- The pass runs inside the feature worktree (same `cwd` as rest of execution)
- Results (files changed, simplifications applied, gate outcome) are appended to `progress.md`

## Acceptance Criteria
- [ ] `_runSingleFeature()` in `bin/lib/run.mjs` includes a self-simplification step after the task loop and before the push
- [ ] Changed files are identified with `git diff --name-only $(git merge-base HEAD main) HEAD` (or equivalent) run in the worktree
- [ ] A simplification brief is built referencing `roles/simplicity.md` vocabulary and listing the changed files with their content
- [ ] Agent is dispatched and its output parsed for whether it made any file edits
- [ ] If changes are detected (via `git diff`), the gate command re-runs and must exit 0
- [ ] Simplification changes are committed before the push
- [ ] If gate fails after simplification, the run logs a warning and proceeds to push anyway (non-blocking — simplification is best-effort, not a hard gate)
- [ ] `--skip-simplification` flag skips the step entirely
- [ ] No-op path (nothing changed) completes silently without error

## Technical Approach

**New function**: `runSelfSimplificationPass(opts)` in `bin/lib/run.mjs`

**Step 1 — Identify changed files:**
```
git merge-base HEAD main  →  base SHA
git diff --name-only {base} HEAD  →  list of relative paths
```
Filter to source files only (exclude `STATE.json`, `progress.md`, `handshake.json`, lock files).

**Step 2 — Build brief:**
Construct a simplification brief that:
- Embeds `roles/simplicity.md` as the reviewer definition
- Lists each changed file with its current content
- Instructs the agent to apply simplifications inline (not just report them): delete dead code, inline wrappers used once, remove abstractions with <2 call sites, cut speculative config/flags
- Instructs agent to leave a summary comment at top of response listing what it changed and why

**Step 3 — Dispatch agent:**
Reuse existing `dispatchAgent()` / brief dispatch pattern from `flows.mjs`. Agent `cwd` = worktree path.

**Step 4 — Check for changes and gate:**
```
git diff --quiet  →  if non-zero, changes exist
git add -A && git commit -m "chore: self-simplification pass"
{gateCmd}  →  re-run configured gate
```
Gate failure = log warning + continue (non-blocking).

**Step 5 — Record in progress.md:**
Append a `## Self-Simplification Pass` section with: files reviewed, simplifications applied (list), gate result.

**Modified files:**
- `bin/lib/run.mjs` — add `runSelfSimplificationPass()`, call it in `_runSingleFeature()` post-task-loop
- `bin/agt.mjs` (or equivalent CLI entry) — add `--skip-simplification` flag
- `bin/lib/flows.mjs` — optionally extract brief-building helper

## Testing Strategy
- **Unit tests** (`test/self-simplification.test.mjs`):
  - `getChangedFiles()` correctly parses `git diff` output (mock git)
  - Brief builder includes simplicity role content and all changed file paths
  - No-op path: empty changed-files list → skip dispatch entirely
  - Gate-fail-after-simplification path: logs warning, does not throw
- **Integration test** (`test/integration/self-simplification-integration.test.mjs`):
  - Create a feature branch with a file containing obvious dead code
  - Run the simplification pass
  - Assert dead code is removed and gate passes
  - Assert commit appears with correct message
- **Manual smoke test**: Run `agt run` on a feature, verify `progress.md` contains simplification section and git log shows `chore: self-simplification pass` commit (when changes exist)

## Out of Scope
- Interactive / human-in-the-loop simplification review
- Per-file separate agent dispatches (one combined pass only)
- Replacing the existing per-task simplicity reviewer in the review flow
- Hard-blocking the push on gate failure after simplification (best-effort only)
- Simplifying files outside the feature diff (e.g., unrelated files in main)
- Automatic PR creation (the push is already implemented; PR creation is manual)

## Done When
- [ ] `runSelfSimplificationPass()` function implemented in `bin/lib/run.mjs`
- [ ] Function is called in `_runSingleFeature()` after task loop, before `git push`
- [ ] Changed files identified via `git diff --name-only` against merge-base
- [ ] Agent dispatched with simplicity brief covering all changed files
- [ ] Gate re-runs after agent-applied changes; commit made with `chore: self-simplification pass`
- [ ] `--skip-simplification` flag on `agt run` bypasses the step
- [ ] `progress.md` updated with simplification results
- [ ] Unit tests cover changed-file detection, no-op path, and gate-fail path
- [ ] Quality gate passes (`npm test` or equivalent)
