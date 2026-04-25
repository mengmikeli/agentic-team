# Simplicity Review — git-worktree-isolation (task-13 / full feature)

**Reviewer:** simplicity
**Verdict:** PASS
**Date:** 2026-04-25

---

## Files Read

- `bin/lib/run.mjs` (lines 53–182, 286–395, 787–902, 1010–1040, 1520–1535)
- `bin/lib/gate.mjs` (lines 1–60)
- `test/worktree.test.mjs` (entire file, 704 lines)
- `.team/PRODUCT.md` (entire file)
- All 9 `handshake.json` files (tasks 1–6, 11–13)
- `tasks/task-12/test-output.txt` (first 60 lines)

---

## Veto Category Checks

### 1. Dead Code
**PASS — no dead code found**

Every new export is live:
- `slugToBranch` (run.mjs:155) — called at run.mjs:164 (inside `createWorktreeIfNeeded`) and imported directly in tests.
- `createWorktreeIfNeeded` (run.mjs:163) — called at run.mjs:1020.
- `removeWorktree` (run.mjs:178) — called at run.mjs:1534.
- `dispatchToAgentAsync` (run.mjs:345) — called at run.mjs:377 inside `runParallelReviews`.

No commented-out code. No unreachable branches in new additions.

### 2. Premature Abstraction
**PASS — all abstractions earn their keep**

Each helper (`slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree`) has a clear single responsibility and ≥1 production call site. The `_execFn`/`_spawnFn` dependency-injection parameters follow the established pattern already present before this feature and serve testability with real call sites in tests.

### 3. Unnecessary Indirection
**PASS — no delegation-without-transformation**

`runGateInline` does real work (execSync + artifact writes + STATE.json update). `createWorktreeIfNeeded` does real work (path computation + git invocation). No re-exports.

### 4. Gold-Plating
**PASS — no speculative extensibility**

No config options with a single value, no feature flags, no hooks for hypothetical future callers. The `--cwd` flag added to `gate.mjs` has a real current consumer and a documented backward-compatibility fallback.

---

## Warnings (🟡 — backlog)

### W1: Source-assertion test depends on log message wording
**`test/worktree.test.mjs:549-556`**

The test `"run.mjs catches errors during the run and preserves the worktree before rethrowing"` greps for the literal string `"preserving worktree"` in the source. It will break on any log message reword that doesn't change behavior. The *behavioral* invariant it intends to protect — worktree still exists after an error and can be reused — is already verified at lines 558-576 (the `createWorktreeIfNeeded` reuse test). The source-regex test adds fragility without adding coverage.

### W2: Brace-tracking source scanners duplicate behavioral coverage
**`test/worktree.test.mjs:657-703`**

Two tests (~80 lines total) implement manual brace-depth tracking to scan `dispatchToAgent` and `dispatchToAgentAsync` source for `cwd: process.cwd()`. This invariant is already covered by the behavioral mock tests at lines 322-364, which assert `calls[0].opts.cwd === worktreePath` directly. The source scanners are redundant, significantly more complex than the behavioral tests they shadow, and brittle to formatting changes.

---

## Per-Criterion Notes

**PRODUCT.md update (task-13):** Entry #20 at line 58 correctly reads `✅ Done`. Clean change, no issues.

**Worktree lifecycle:** The catch-not-finally pattern at run.mjs:1526-1534 is the minimal correct implementation for "preserve on error, remove on success." Cognitive load is proportionate to the feature.

**Concurrency tests:** The real child-process race test (test/worktree.test.mjs:427-464) is complex but the complexity is justified — in-process Promise.all over sync JS would serialize on the event loop and not exercise true OS-level concurrent git operations. The complexity lives in the test, not in production code.

**Wiring assertion (test/worktree.test.mjs:261-270):** Source-assertion that verifies `runGateInline(gateCmd, featureDir, task.id, cwd)` appears in `_runSingleFeature`. Given the size of `_runSingleFeature`, this is the only practical way to verify cwd plumbing without a large mock harness. Fragile but unique coverage — not flagged.

---

## Verdict: PASS

No 🔴 critical findings. Two 🟡 warnings flagged for the backlog. Production code is clean and appropriately scoped.
