# Architect Review — git-worktree-isolation (gate-validate)

## Verdict: PASS

## Files Read
- `bin/lib/run.mjs` (lines 50–60, 280–340)
- `test/worktree.test.mjs` (added "required-cwd contract" suite)
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`
- `.team/features/git-worktree-isolation/tasks/task-3/artifacts/test-output.txt`
- Commits `97f0f47`, `29567bd`, `3ffe4e4`

## Per-Criterion Evaluation

### 1. Boundary / contract clarity — PASS
The change converts `cwd` from an implicit-default parameter to a required
contract. Both `runGateInline(cmd, featureDir, taskId, cwd)` and
`dispatchToAgent(agent, brief, cwd, _spawnFn)` now throw a clear
`Error("…: cwd is required (no implicit process.cwd() fallback)")` when the
caller omits it. This is the architecturally correct direction for worktree
isolation — fail-fast at the API boundary instead of silently leaking the
parent process's cwd into a worktree-scoped operation.

### 2. Test evidence — PASS
`test-output.txt` reports `pass 542 / fail 0 / skipped 2` across 544 tests.
The new suite `required-cwd contract (no implicit fallback)` covers:
- `runGateInline` with `cwd = null`
- `runGateInline` with `cwd = undefined` explicitly
- `dispatchToAgent` with `cwd = undefined`

All three throw with `/cwd is required/`. Existing cwd-injection suites
(`runGateInline cwd injection`, `dispatchToAgent cwd injection`) continue to
pass, confirming no regression in the happy path.

### 3. Modularity / coupling — PASS
The guard is one line at the top of each function and does not change the
call signature for existing callers (which already pass `cwd`). The 9-commit
branch shows a clean, layered build-up: slug normalization → worktree
creation → cwd injection → required-cwd contract.

### 4. Long-term maintainability — PASS with one flagged inconsistency
The commit message of `97f0f47` claims *"Adds env propagation to codex spawn
for parity with claude"*, but the diff shows `env: { ...process.env }` was
added to the **claude** branch (line 294), while the **codex** branch
(lines 321–326) still has no `env` option. The two branches are now
**less** consistent than before, not more. This is a soft warning, not a
blocker — codex inherits the parent env by default when `env` is omitted,
so behavior is unchanged — but the asymmetry is now codified and the commit
message is misleading for future archaeology.

### 5. Scalability — N/A
Pure validation contract; no load characteristics changed.

## Findings

🟡 bin/lib/run.mjs:321 — codex spawn lacks `env: { ...process.env }`; commit `97f0f47` message claims parity with claude was added but only claude got the explicit env. Add the same `env` option to the codex branch (or remove it from claude) so the two spawns are symmetric, and amend the commit narrative.
🔵 bin/lib/run.mjs:53 — `if (!cwd)` also rejects empty string `""`, which is correct here, but consider `if (typeof cwd !== "string" || !cwd)` to make the type contract explicit and produce a clearer error if a caller passes a number/object.
🔵 bin/lib/run.mjs:282 — `dispatchToAgent` returns `{ ok: false, output: "", error: "no agent available" }` if `agent` is neither `"claude"` nor `"codex"`, but the required-cwd guard fires before that. Consider validating `agent` at the top alongside `cwd` so both invariants are enforced uniformly.
🔵 test/worktree.test.mjs:235 — the negative-test suite covers `null` and `undefined` for `cwd`; consider also asserting that empty string `""` is rejected, since that's the one case `if (!cwd)` does treat as missing and a future maintainer might "fix" the guard to allow it.

## Specific, Actionable Feedback

1. **Backlog item (warning)**: reconcile the env-propagation asymmetry in
   `dispatchToAgent`. Either pass `env: { ...process.env }` in both branches
   or drop it from claude — pick one. The current state will mislead the
   next reader.
2. The required-cwd contract is the right design and is well-tested. Ship it.
