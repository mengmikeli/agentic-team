# Architect Review — task-3 (git-worktree-isolation)

## Verdict: PASS

## Files actually opened
- `bin/lib/run.mjs` (lines 25–170, 270–342, harness/cmdGate call sites)
- `bin/lib/gate.mjs` (lines 30–80)
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`
- grep audit of `process.cwd()` across `bin/lib/`

## Verifying the claim
Builder claims: removed implicit `process.cwd()` fallback from `runGateInline` and `dispatchToAgent`; codex spawn now passes `env: { ...process.env }` for parity with claude.

Code verification:
- `bin/lib/run.mjs:53–54` — `runGateInline(cmd, featureDir, taskId, cwd)` throws if `cwd` is missing; the value is forwarded to `execSync` at line 61. No default. ✓
- `bin/lib/run.mjs:286–287` — `dispatchToAgent(agent, brief, cwd, _spawnFn)` throws if `cwd` is missing; forwarded at lines 296 (claude) and 328 (codex). ✓
- `bin/lib/run.mjs:299` and `:331` — codex now has `env: { ...process.env }` matching claude. ✓
- Production call sites at `bin/lib/run.mjs:1201` (gate) and the dispatchToAgent invocation pass the worktree-aware `cwd`. ✓
- Gate output (552 tests pass) corroborates non-regression.

## Architectural assessment
- **Boundary enforcement**: making `cwd` a required argument (fail-loud rather than fall back to `process.cwd()`) is the correct way to encode the worktree-isolation invariant in code. A future regression would surface as an immediate error rather than a silent escape from the worktree.
- **Coupling/cohesion**: dispatch and gate paths now share the same contract. Symmetry between claude/codex spawns (env propagation) reduces accidental drift.
- **Residual surface**: `bin/lib/gate.mjs:59` (`cmdGate`) still passes `cwd: process.cwd()` to `execSync`. It's reachable via the harness subprocess but the production runner uses `runGateInline` (inline path) — so it isn't on the worktree-run hot path. The literal grep claim ("no gate command in `bin/lib/` references `process.cwd()` directly") is therefore slightly stronger than what the diff delivers. Flagging as a suggestion, not a blocker.
- **Test coverage**: negative tests lock in the required-cwd contract for both functions, which is the right architectural shape (test the invariant, not the happy path only).

## Findings

🔵 bin/lib/gate.mjs:59 — `cmdGate` still uses `cwd: process.cwd()`; on the inline-runner production path this is dead, but if the harness-subprocess gate is ever re-enabled it will silently leave the worktree. Either delete `cmdGate` or accept a `cwd` arg via CLI flag for symmetry with `runGateInline`.
🔵 bin/lib/run.mjs:32 — The `harness()` wrapper spawns the harness subprocess with `cwd: process.cwd()`. For non-gate commands (transition/notify/init/finalize) this is intentional (state lives in the main repo), but worth a one-line comment recording that decision so future readers don't try to "fix" it by threading the worktree cwd through.

## Per-criterion
| Criterion | Result | Evidence |
|---|---|---|
| Boundary encoded as a hard contract | PASS | run.mjs:54, run.mjs:287 throws |
| Symmetric agent dispatch | PASS | env propagated to both branches (run.mjs:299, run.mjs:331) |
| Production call sites pass worktree cwd | PASS | run.mjs:1201 + the single dispatchToAgent site |
| Tests lock the invariant | PASS | required-cwd negative tests |
| No new dependencies / scope discipline | PASS | diff is local to run.mjs + worktree.test.mjs |
