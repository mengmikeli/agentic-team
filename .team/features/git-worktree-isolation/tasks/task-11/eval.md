# Eval: task-11 — No process.cwd() in agent dispatch / gate (worktree-active path)

**Verdict: PASS**

---

## Files Actually Read

- `bin/lib/run.mjs` (full)
- `bin/lib/gate.mjs` (full)
- `test/worktree.test.mjs` (full)
- `bin/lib/outer-loop.mjs` (full, to verify dispatch call sites)
- Grep of all `process.cwd()` occurrences across `bin/lib/`

---

## Per-Criterion Results

### 1. `dispatchToAgent` has no `process.cwd()` fallback — PASS

Evidence: `run.mjs:287` — `if (!cwd) throw new Error("dispatchToAgent: cwd is required (no implicit process.cwd() fallback)")`. No `process.cwd()` anywhere in the function body. spawnSync receives the caller-supplied `cwd` directly.

### 2. `dispatchToAgentAsync` has no `process.cwd()` fallback — PASS

Evidence: `run.mjs:346` — same guard. `spawn()` receives the caller-supplied `cwd`. No `process.cwd()` in function body.

### 3. `runGateInline` has no `process.cwd()` fallback — PASS

Evidence: `run.mjs:54` — throws if `cwd` is falsy. execSync receives the explicit `cwd`.

### 4. `_runSingleFeature` passes `worktreePath` as `cwd` to dispatch and gate — PASS

Evidence: `run.mjs:1020-1021` sets `cwd = worktreePath` after `createWorktreeIfNeeded`. `run.mjs:1202` calls `runGateInline(gateCmd, featureDir, task.id, cwd)`. `run.mjs:1089,1169` call `dispatchToAgent(agent, brief, cwd)`. The source-assertion test at `worktree.test.mjs:265-269` verifies the call signature via regex on the source.

### 5. Tests for required-cwd contract — PASS

`worktree.test.mjs:284-318` covers: `runGateInline` throws on missing cwd, `dispatchToAgent` throws on undefined cwd, `dispatchToAgentAsync` throws on undefined cwd. These are verified by running the test suite (gate output shows all tests passing).

### 6. Worktree lifecycle and path-traversal — PASS

Tests at lines 170-204 (real-git remove integration), 427-464 (OS-level concurrency), 492-533 (slug sanitization, `../` traversal, all-dots rejection) all pass per gate output.

### 7. Crash recovery reuse — PASS

`createWorktreeIfNeeded` returns existing path without calling git when the directory already exists (tested at `worktree.test.mjs:71-83`).

---

## Findings

### 🟡 gate.mjs:21 — audit test regex too narrow; `process.cwd()` still called as fallback

`gate.mjs:21`: `const cwd = getFlag(args, "cwd") || process.cwd()`

`process.cwd()` is still invoked as a fallback for standalone/backward-compatible subprocess invocations of `cmdGate`. The handshake says "hardcoded `cwd: process.cwd()` is eliminated" — technically true for the object-property pattern, but `process.cwd()` is still called.

More critically, the grep audit test at `worktree.test.mjs:585` checks regex `!/cwd\s*:\s*process\.cwd\s*\(\)/` (colon-property pattern). This regex does NOT match the variable-assignment form `= getFlag(...) || process.cwd()`, so the test passes while the reference remains.

**Why this is not a blocker:** `cmdGate` is no longer in the active worktree dispatch path. `_runSingleFeature` uses `runGateInline` exclusively (line 1202). `cmdGate` only runs via the harness subprocess, which is never called for gate execution in the current code. The fallback is a backward-compatibility measure, not an active process.cwd() bug.

**Backlog action:** Tighten the audit test to also reject `process\.cwd\s*\(\)` in gate function bodies (not just the colon-property variant), so future changes can't silently re-introduce the pattern.

### 🟡 task-11/artifacts/ missing — handshake claims 558 tests pass but no artifact

The handshake at `task-11/handshake.json` claims "All 558 tests pass" but the task directory contains only `handshake.json` — no `artifacts/` directory, no `test-output.txt`. The gate output provided in the review prompt shows the test suite passing, but that evidence is external to the task artifact chain and cannot be independently reproduced from task-11 alone.

**Why this is not a blocker:** The gate output attached to this review confirms all tests pass. The handshake is structurally valid. Missing artifacts are a process gap, not a correctness gap.

---

## Overall Verdict: PASS

All three named functions (`dispatchToAgent`, `dispatchToAgentAsync`, gate via `runGateInline`) require explicit `cwd` and throw on omission. The active worktree path in `_runSingleFeature` correctly passes `worktreePath` as `cwd` throughout. Tests verify the contract end-to-end. Two backlog items flagged above.

---

## Security Review (appended)

**Reviewer:** Security
**Files read:** `bin/lib/run.mjs` (full), `bin/lib/gate.mjs` (full), `test/worktree.test.mjs` (full), both task-6 and task-11 handshakes. Confirmed with grep scan of all `process.cwd()` occurrences in `bin/lib/`.

### Additional findings

**🟡 bin/lib/gate.mjs:21** — Audit test regex misses `|| process.cwd()` form (see existing finding above); accepted as backlog since `cmdGate` is not in the active worktree dispatch path.

**🟡 bin/lib/run.mjs:65** — `execSync(cmd, { shell: true })` where `cmd` comes from user-controlled `PROJECT.md` / `package.json` via `detectGateCommand`. No sanitization between file read and shell execution. Running `agt run` on a malicious cloned repo executes arbitrary shell commands. Accepted risk for a local dev tool; add to backlog.

**🔵 bin/lib/run.mjs:354** — `dispatchToAgentAsync` spawns `claude` with no `timeout` option. The sync counterpart `dispatchToAgent` has `timeout: 600000` (lines 297, 329). A hung async agent dispatch blocks indefinitely with no recovery path.

**🔵 bin/lib/run.mjs:294** — `--permission-mode bypassPermissions` is intentional but undocumented; a short comment stating this is a deliberate trust decision would prevent accidental removal.

**Security verdict: PASS** — No critical findings. Core contract (explicit cwd required, path-traversal guarded, no implicit fallback in dispatch/gate hot paths) is correctly implemented.

---

## Simplicity Review (appended)

**Reviewer:** Simplicity
**Files read:** `bin/lib/run.mjs` (full), `bin/lib/gate.mjs` (full), `test/worktree.test.mjs` (full). Grep scan of all `process.cwd()` occurrences in `bin/lib/`. Confirmed `harness("gate")` has zero callers in `bin/`.

### Veto Categories

| Category | Result | Evidence |
|---|---|---|
| Dead code | CLEAR | All three guards are live paths; no unreachable branches or commented-out code introduced |
| Premature abstraction | CLEAR | No new abstractions; `_spawnFn`/`_execFn` injection pre-existed; no interface with a single implementation |
| Unnecessary indirection | CLEAR | No new wrapper layers; `--cwd` parameter is a direct fix, not indirection |
| Gold-plating | CLEAR | Grep-audit tests are explicitly required by task spec; no speculative config options |

### Warnings (backlog)

🟡 `test/worktree.test.mjs:591` — Brace-counting source-parse loop for `dispatchToAgent` (lines 595–613) and `dispatchToAgentAsync` (lines 615–636) are copy-pasted verbatim (~18 lines each). Extract into a shared helper `auditFunctionForProcessCwd(src, fnName)` to halve maintenance burden when audit logic changes.

🟡 `test/worktree.test.mjs:244` — "slugToBranch normalization" describe block (lines 244–257) duplicates assertions already in "slugToBranch" block (lines 15–40): clean-slug passthrough and underscore→dash conversion are both covered. Remove or collapse into the existing suite.

**Simplicity verdict: PASS** — Implementation is targeted and minimal. Two test-file duplication warnings added to backlog. No veto-category violations found.

---

## Architect Review

**Reviewer:** Architect
**Date:** 2026-04-25
**Files actually read:** `bin/lib/run.mjs` (full), `bin/lib/gate.mjs` (full), `bin/lib/notify.mjs` (full), `test/worktree.test.mjs` (lines 215–638), `bin/agt-harness.mjs` (full), grep scan of all `process.cwd()` and `cwd: process.cwd()` occurrences in `bin/lib/`.

---

### Structural Assessment

The core isolation boundary is correctly placed. `dispatchToAgent`, `dispatchToAgentAsync`, and `runGateInline` all require an explicit `cwd` and throw on omission. The wiring in `_runSingleFeature` threads `worktreePath` through as `cwd` at line 1021, reaching all three call sites. This is sound.

### Finding: Undocumented structural invariant in `harness()` wrapper

`run.mjs:38` — `harness()` uses `cwd: process.cwd()` as its subprocess working directory. This function is called 20+ times during feature execution, including after `worktreePath` is active (lines 998, 1121, 1127, 1142, 1437, 1460, 1493, 1502, 1591). The grep audit tests at `worktree.test.mjs:581–637` cover `gate.mjs`, `dispatchToAgent`, and `dispatchToAgentAsync` — but not `harness()`.

The code is currently correct because `_runSingleFeature` never calls `process.chdir()`, so `process.cwd()` remains `mainCwd` throughout. However, this is an **implicit invariant with no test coverage**:

- `ensureProjectReady()` (called from `cmdRun` pre-flight) DOES call `process.chdir()` on lines 700 and 712 to handle path redirection.
- If the execution order were ever modified to call `ensureProjectReady()` mid-run, or if a future task dispatches via a different code path, `harness()` would silently run in the wrong directory.
- The notify commands (`harness("notify", ...)`) don't pass `--dir` flags, so they depend entirely on `process.cwd()` pointing to the main repo for `notify.mjs:114–116` to find the correct `.team/.notify-stream`.

This is not a current bug but a design fragility. The architectural remedy is either: (a) add a `cwd` parameter to `harness()` so callers pass `mainCwd` explicitly, or (b) document the invariant with a comment and add a test asserting `process.cwd()` is unchanged after `_runSingleFeature` returns.

### Grep Audit Scope Gap

The grep audit tests verify the three named functions but leave `harness()` — the most widely-called subprocess wrapper in the module — outside the audit boundary. Future reviewers relying on the audit as a comprehensive `process.cwd()` exclusion will have a false assurance. The audit scope should be documented or widened.

### Architecture verdict: PASS with backlog

The task goal (worktree isolation for agent dispatch and gate execution) is achieved. The `harness()` fragility is a structural debt item, not a current failure.

🟡 bin/lib/run.mjs:38 — `harness()` relies on `process.cwd() === mainCwd` as an implicit invariant with no test coverage; add explicit `cwd` parameter or a comment + test asserting the invariant holds throughout `_runSingleFeature`
🟡 test/worktree.test.mjs:581 — Grep audit scope excludes `harness()` wrapper which also contains `cwd: process.cwd()`; document the exclusion reasoning or extend the audit

---

## Product Manager Review

**Reviewer:** Product Manager
**Date:** 2026-04-25
**Files actually read:** `task-11/handshake.json`, `bin/lib/run.mjs` (full), `bin/lib/gate.mjs` (full), `test/worktree.test.mjs` (full), `bin/agt-harness.mjs` (header), all `tasks/task-{1,2,3,4,5,6}/handshake.json`, grep scan of all `bin/lib/*.mjs` for `process.cwd()`.

### Does the implementation match the stated task?

Task: "No agent dispatch or gate command in `bin/lib/` references `process.cwd()` directly when a worktree is active (verified by grep audit)."

**Core claim: VERIFIED**
- `dispatchToAgent` (`run.mjs:287`) — explicit guard, no `process.cwd()` in body.
- `dispatchToAgentAsync` (`run.mjs:346`) — explicit guard, no `process.cwd()` in body.
- `runGateInline` (`run.mjs:54`) — explicit guard, no `process.cwd()` in body.
- `_runSingleFeature` wires `worktreePath` as `cwd` at line 1021 before any dispatch or gate call.
- `gate.mjs cmdGate` no longer has `cwd: process.cwd()` property assignment.
- Grep audit tests in `test/worktree.test.mjs:581–637` cover the three function bodies.

**Scope gap (backlog, not a blocker):**
`cmdGate` (`gate.mjs:21`) still calls `process.cwd()` as an `||`-fallback. The audit regex checks only the `cwd: process.cwd()` property-assignment form and passes, but the fallback remains. Since `cmdGate` is not in the active worktree dispatch path (`runGateInline` is used instead), this is latent rather than active.

### Missing artifact evidence

`task-11/artifacts/` does not exist. The handshake claims "All 558 tests pass" without a `test-output.txt` to back it. The gate output attached to this review confirms the tests pass externally, but the task's own artifact chain is incomplete.

### PM findings

🟡 bin/lib/gate.mjs:21 — `cmdGate` still references `process.cwd()` as a fallback (`getFlag(args, "cwd") || process.cwd()`). Audit test regex misses this form. Add backlog item: tighten the regex to cover `|| process.cwd()` in gate function bodies.

🟡 .team/features/git-worktree-isolation/tasks/task-11 — No `artifacts/test-output.txt` persisted. The claim "558 tests pass" is unsupported by task-internal evidence. Add backlog item: ensure gate run for self-audit tasks writes `test-output.txt` to the task artifacts dir.

### PM verdict: PASS

The core requirement is met. Both yellow findings go to the backlog; neither blocks merge.
