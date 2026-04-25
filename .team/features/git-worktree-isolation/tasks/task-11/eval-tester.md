# Eval: task-11 — Tester

**Overall Verdict: PASS**

---

## Files Actually Read

- `bin/lib/run.mjs` (full)
- `bin/lib/gate.mjs` (full)
- `test/worktree.test.mjs` (full)
- `bin/lib/review.mjs` (L140–190, to assess dispatch scope)
- `bin/lib/outer-loop.mjs` (L590–620, to assess dispatch scope)
- Grep of all `process.cwd()` occurrences across `bin/lib/*.mjs`

---

## Per-Criterion Results

### 1. `dispatchToAgent` body — no `process.cwd()` PASS

`run.mjs:287` guard fires before any spawn call. `_spawnFn` receives the caller-supplied `cwd`. No `process.cwd()` in the function body. Test at `worktree.test.mjs:298-303` verifies the throw on `undefined`.

### 2. `dispatchToAgentAsync` body — no `process.cwd()` PASS

`run.mjs:346` guard fires synchronously before the `return new Promise(...)`. Tests at `worktree.test.mjs:306-318` verify the synchronous throw on `undefined`.

### 3. `gate.mjs` — no `cwd: process.cwd()` object property PASS

`gate.mjs:21` uses `const cwd = getFlag(args, "cwd") || process.cwd()`. No `cwd: process.cwd()` object-property pattern exists. The grep audit test correctly verifies this form. Note: `cmdGate` is not in the active worktree dispatch path (`_runSingleFeature` uses `runGateInline` exclusively at line 1202), so the `|| process.cwd()` fallback is only exercised by legacy subprocess callers.

### 4. Wiring — `cwd` flows to all dispatch/gate call sites PASS

`run.mjs:1020-1021` sets `cwd = worktreePath`. Lines 1089, 1169, 1202, and the parallel review path at 1306 all pass `cwd` explicitly. Source-assertion test at `worktree.test.mjs:262-270` verifies the `runGateInline` call signature.

### 5. Required-cwd tests PASS

`runGateInline` throws on omitted/undefined cwd. `dispatchToAgent` and `dispatchToAgentAsync` throw on undefined. All covered at `worktree.test.mjs:273-319`.

---

## Findings

🟡 `test/worktree.test.mjs:596-636` — Function-body extraction uses brace counting per line. String literals or template literals containing unbalanced `{`/`}` characters (e.g., a future error message like `` `expected {key}` ``) can cause the scanner to exit the function body early, producing a false negative that silently misses a violation. The current code is safe, but the fragility is latent. Backlog: add a comment warning about this, or switch to an AST-based check.

🟡 `test/worktree.test.mjs:581-637` — The grep audit does not cover `run.mjs:harness()` (line 38), which retains `cwd: process.cwd()`. The exclusion is justified — `harness()` is state management, not agent dispatch — but there is no documentary evidence of the deliberate carve-out. A future contributor adding agent-dispatch behavior inside `harness()` would not be warned by the audit. Backlog: add an inline comment in the test or the function marking the explicit exclusion.

🔵 `run.mjs:32-49` — `harness()` uses `cwd: process.cwd()` with no injectable parameter, unlike the three hardened functions. Since no `chdir` occurs in `_runSingleFeature`, the value equals `mainCwd` at runtime. The invariant is untested. Consider an optional `_cwd` parameter for consistency and future testability.

---

## Edge Cases Verified

- `null` cwd: `if (!cwd)` catches both `null` and `undefined` — no dedicated test for `null` but the guard covers it.
- Empty-string slug: `createWorktreeIfNeeded` throws `invalid slug` — tested at `worktree.test.mjs:526-533`.
- All-dots slug: throws `invalid slug` — tested at `worktree.test.mjs:511-524`.
- Path traversal via `../`: slug sanitization strips `/`, leaving `..evil` which is a valid dir name with no traversal — tested at `worktree.test.mjs:492-509`.
- Same-slug race: tested at `worktree.test.mjs:466-486`.
- OS-level concurrency (true child processes): tested at `worktree.test.mjs:427-464`.

---

## Summary

The core requirement is met: no agent dispatch or gate command in `bin/lib/` uses `process.cwd()` implicitly when a worktree is active. Two structural weaknesses in the grep audit tests are flagged as backlog items. No blocking issues.
