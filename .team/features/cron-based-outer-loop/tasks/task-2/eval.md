# Eval — task-2: `agt cron-tick` no-ready-items exits 0

**Verdict: PASS**

---

## Files Read

- `.team/features/cron-based-outer-loop/tasks/task-2/handshake.json`
- `bin/lib/cron.mjs` (lines 55–130)
- `test/cron-tick.test.mjs` (lines 1–93)

No `artifacts/test-output.txt` was found — gate output from the parent prompt was used as test evidence instead (544 tests, 0 failures).

---

## Per-Criterion Results

### 1. Exits 0 when no Ready items
**PASS (with caveat)**

`bin/lib/cron.mjs:91-94`: When `readyItems.length === 0`, the function logs the message and `return`s. It does **not** call `process.exit()`. The `finally` block at line 127 runs and calls `lock.release()`. The process exits 0 implicitly on normal return — this is correct.

The caveat: `test/cron-tick.test.mjs:92` asserts the log message but **never asserts the exit code**. The `beforeEach` at line 58-59 sets up `exitCode = null` and spies on `process.exit`, but after `cmdCronTick` resolves, the test does not check `exitCode`. A bare `assert.equal(exitCode, null)` would make the "exits 0" guarantee explicit and machine-verifiable.

### 2. Logs "no ready items"
**PASS**

`bin/lib/cron.mjs:92` logs `"cron-tick: no ready items on project board"`.
`test/cron-tick.test.mjs:92` asserts `logs.some(l => l.includes("no ready items"))`. The substring match is sufficient; the assertion message on failure is informative.

### 3. Lock is released on early return
**PASS**

The early return at line 93 is inside the outer `try` (line 84). The `finally` at line 127 unconditionally calls `lock.release()`. No leak.

### 4. runSingleFeature is NOT called
**PASS**

The test injects `runSingleFeature: async () => { throw new Error("should not be called") }`. If the code path reaches dispatch, the test would throw and fail. The test passes, confirming the guard is effective.

---

## Finding

🟡 test/cron-tick.test.mjs:92 — Test name says "exits 0" but never asserts it; add `assert.equal(exitCode, null, "process.exit should not have been called")` after line 90 to machine-verify the exit-0 claim.

---

## Summary

The implementation is correct. The no-ready-items guard (lines 91-94) is simple, the lock is cleaned up, and dispatch is not reached. The one gap is that the test's exit-code claim is unverified — it's a test quality issue, not a correctness defect.

---

# Security Review: cron-based-outer-loop / task-2

**Reviewer role:** Security specialist
**Date:** 2026-04-26
**Handshake run:** run_1
**Verdict:** PASS

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-2/handshake.json`
- `bin/lib/cron.mjs` (full, 154 lines)
- `bin/lib/github.mjs` (lines 1–20 — `runGh`; lines 219–222 — `commentIssue`)
- `bin/lib/util.mjs` (lines 98–165 — `lockFile`)
- `test/cron-tick.test.mjs` (lines 68–93 — no-ready-items test; lines 1–14 — imports)
- `.team/features/cron-based-outer-loop/tasks/task-1/eval.md` (prior security reviews: run_1, run_2, run_3)

---

## Threat Model

This task covers a single code path: `cron-tick` when no board items have status `"ready"`. No user-controlled data touches this path — item statuses are compared and discarded before the early return. Adversary surface: none in this path.

---

## Per-Criterion Results

### 1. No-ready-items path — PASS

`cron.mjs:91-94`:
```js
if (readyItems.length === 0) {
  console.log("cron-tick: no ready items on project board");
  return;
}
```

- Logged string is a **static literal** — no user-controlled data interpolated.
- `return` leaves the `try` block cleanly; `finally` at line 127 releases the lock unconditionally.
- No file I/O, no external API calls, no `process.exit` in this path — process exits 0 implicitly.
- No injection surface of any kind.

### 2. Lock release on early exit — PASS

Early return at `cron.mjs:93` is inside the `try` block (line 84). The `finally` at line 127 runs regardless. No lock leak on this path.

### 3. Test does not expose new security surface — PASS

`test/cron-tick.test.mjs:70–93` uses fully-injected deps with controlled input. No filesystem writes, no subprocesses, no environment variable reads in this test. The `runSingleFeature: async () => { throw ... }` guard confirms dispatch is unreachable — and therefore none of the higher-risk post-dispatch paths (title sanitization, `commentIssue` with `err.message`, bypassPermissions agent launch) can be triggered from this code path.

### 4. Prior architectural security findings — UNCHANGED

The two 🟡 findings from task-1 security reviews are unaffected:

- `cron.mjs:100` + `run.mjs:470` — Natural-language prompt injection via issue title reaching agent with `--permission-mode bypassPermissions`. Not reachable from the no-ready-items early-return path.
- `cron.mjs:124` — Raw `err.message` posted to GitHub issue comment. Not reachable from this path.

Both remain open backlog items. Neither is relevant to task-2.

---

## Findings

No findings.

---

## Summary

The no-ready-items path (`cron.mjs:91-94`) is a static log + clean return with no user-controlled data, no I/O, and guaranteed lock release via `finally`. Task-2 introduced no new code — it verified a feature that was already present. No new security surface exists. The two 🟡 architectural warnings from task-1 carry forward as open backlog items.

---

# Architect Review: cron-based-outer-loop / task-2

**Reviewer role:** Software Architect
**Date:** 2026-04-26
**Handshake run:** run_1
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-2/handshake.json`
- `bin/lib/cron.mjs` (full, 153 lines)
- `test/cron-tick.test.mjs` (full, 407 lines)
- `.team/features/cron-based-outer-loop/tasks/task-1/eval.md` (all prior review sections)

---

## Per-Criterion Results

### 1. Handshake claim: feature at cron.mjs:91-94 — PASS

Verified directly. The `return` at line 93 is inside the `try` block (lines 84–129), so `finally` at line 127 fires unconditionally — `lock.release()` is called. No `process.exit` is invoked. Function resolves normally; process exits 0.

### 2. Handshake claim: unit test exists — PASS

`test/cron-tick.test.mjs:70`: provides items with `"Todo"` and `"In Progress"` statuses; neither matches `"ready"` (case-insensitive at `cron.mjs:89`). The stubbed `process.exit` throws for any invocation — if called, the `await` would propagate the throw and the assertion line would never execute. The test passing therefore implicitly verifies exit 0 as well as the explicit log-message assertion at line 92. Both requirements are covered.

The prior eval's 🟡 about adding `assert.equal(exitCode, null)` is valid — explicit beats implicit for documentation purposes — but it is a test-quality concern, not a behavioral defect.

### 3. Status filter semantics — PASS

`cron.mjs:89`: `i.status?.toLowerCase() === "ready"`. Optional chaining handles `undefined` status safely (returns `undefined`, not equal to `"ready"`). Case-insensitive match is correct for GitHub Project status names.

### 4. No new architectural surface — PASS

Task-2 introduces no new modules, imports, exports, or shared infrastructure. The 4-line early-exit branch is inside an existing function. DI pattern, lock acquisition, and lifecycle state machine are identical to task-1 reviewed state.

### 5. Lock lifecycle on this path — PASS

Lock acquired (line 78) → enter `try` (line 84) → items fetched and filtered → `return` (line 93) → `finally` fires → `lock.release()`. No leak.

### 6. Prior backlog items — CARRY FORWARD UNCHANGED

- `github.mjs:275` — `setProjectItemStatus` uses implicit `process.cwd()` for tracking config; silent false return under cwd mismatch
- `github.mjs:266-267` — redundant full item-list refetch on each status transition
- `cron.mjs:20-31` — `readProjectNumber` re-parses the same `PROJECT.md` that `readTrackingConfig` already parsed
- `cron.mjs:143` — `cmdCronSetup` uses `process.argv[1]` for agt path; fragile under npx/symlink

Task-2 neither introduced nor resolved any of these.

---

## Edge Cases Checked

- Items with `undefined` status: safely excluded via optional chaining ✅
- Empty item list `[]`: `readyItems.length === 0` triggers early exit ✅
- Lock released on early return: `finally` block confirmed ✅
- `runSingleFeature` not called: throwing stub in test — test would fail if dispatch reached ✅

---

## Findings

No findings.

---

## Summary

The no-ready-items early-exit path is correctly implemented, positioned inside `try` so the lock is released, and exits 0 via normal function resolution. The unit test is functionally correct — the implicit exit-0 verification via the throwing `process.exit` stub is sound. No new architectural concerns introduced. All prior backlog items carry forward unchanged.

---

# PM Review: cron-based-outer-loop / task-2

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Handshake run:** run_1
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-2/handshake.json`
- `bin/lib/cron.mjs` (full, 153 lines)
- `test/cron-tick.test.mjs` (lines 68–93 — no-ready-items test)
- `bin/agt.mjs` (line 72 — CLI wire-up confirming exit code path)
- `git show 967239a --stat` (confirmed task-2 changed no production code)

---

## Task Requirements

1. `agt cron-tick` with no "Ready" items **exits 0**
2. `agt cron-tick` with no "Ready" items **logs "no ready items"**

---

## Per-Criterion Results

### 1. Exits 0 — PASS

The no-ready-items branch at `cron.mjs:91-94` uses `return`, not `process.exit()`. The CLI entry point at `agt.mjs:72` is `await cmdCronTick(args)` with no surrounding `process.exit` — a clean return from the async function results in Node.js exiting with 0. Exit code 0 is the correct outcome and is achieved.

### 2. Logs "no ready items" — PASS

`cron.mjs:92` logs `"cron-tick: no ready items on project board"`. The substring "no ready items" is present. Requirement satisfied.

### 3. Test coverage — PASS (with gap)

`test/cron-tick.test.mjs:70–93` provides items with status "Todo" and "In Progress" only, awaits `cmdCronTick`, then asserts `logs.some(l => l.includes("no ready items"))`. The function returns cleanly. Exit code 0 is implied (clean return) but `exitCode` is never explicitly asserted. A future regression adding `process.exit(1)` to this branch would be caught by the test throwing, but the specific exit code value is not verified.

### 4. Artifact claims match reality — PASS

Builder claimed artifacts `bin/lib/cron.mjs` and `test/cron-tick.test.mjs`. Both exist. `git show 967239a --stat` confirms task-2 made zero changes to either file — the behavior was already present from task-1. Builder correctly described this as a verification task ("Verified that...already exits 0").

### 5. Gate output — PARTIAL EVIDENCE

Gate output in the review prompt is truncated before cron-tick-specific results. Handshake claims 544 tests, 0 failures. No contradicting evidence. Prior task-1 reviews ran `node --test test/cron-tick.test.mjs` directly and confirmed 14–15 tests, 0 failures.

---

## Findings

🟡 `test/cron-tick.test.mjs:70` — Test name promises "exits 0" but asserts only the log message; `exitCode` (initialized to `null` in `beforeEach`) is never asserted — add `assert.equal(exitCode, null, "should not call process.exit")` to make the exit-0 contract explicit and regression-proof

---

## Summary

Both requirements are met: `agt cron-tick` with no Ready items returns cleanly (exit 0) and logs "no ready items on project board". The implementation was delivered as part of task-1; task-2 correctly identified and verified it. One 🟡 backlog item: the test asserts the log message but not the exit code explicitly.

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-2/handshake.json`
- `bin/lib/cron.mjs` (full, 153 lines)
- `test/cron-tick.test.mjs` (full, 407 lines)
- `.team/features/cron-based-outer-loop/tasks/task-1/eval.md` (all prior review sections)

---

## Per-Criterion Results

### 1. Handshake claim: feature at cron.mjs:91-94 — PASS

Verified directly. The `return` at line 93 is inside the `try` block (lines 84–129), so `finally` at line 127 fires unconditionally — `lock.release()` is called. No `process.exit` is invoked. Function resolves normally; process exits 0.

### 2. Handshake claim: unit test exists — PASS

`test/cron-tick.test.mjs:70`: provides items with `"Todo"` and `"In Progress"` statuses; neither matches `"ready"` (case-insensitive at `cron.mjs:89`). The stubbed `process.exit` throws for any invocation — if called, the `await` would propagate the throw and the assertion line would never execute. The test passing therefore implicitly verifies exit 0 as well as the explicit log-message assertion at line 92. Both requirements are covered.

The prior eval's 🟡 about adding `assert.equal(exitCode, null)` is valid — explicit beats implicit for documentation purposes — but it is a test-quality concern, not a behavioral defect.

### 3. Status filter semantics — PASS

`cron.mjs:89`: `i.status?.toLowerCase() === "ready"`. Optional chaining handles `undefined` status safely (returns `undefined`, not equal to `"ready"`). Case-insensitive match is correct for GitHub Project status names.

### 4. No new architectural surface — PASS

Task-2 introduces no new modules, imports, exports, or shared infrastructure. The 4-line early-exit branch is inside an existing function. DI pattern, lock acquisition, and lifecycle state machine are identical to task-1 reviewed state.

### 5. Lock lifecycle on this path — PASS

Lock acquired (line 78) → enter `try` (line 84) → items fetched and filtered → `return` (line 93) → `finally` fires → `lock.release()`. No leak.

### 6. Prior backlog items — CARRY FORWARD UNCHANGED

- `github.mjs:275` — `setProjectItemStatus` uses implicit `process.cwd()` for tracking config; silent false return under cwd mismatch
- `github.mjs:266-267` — redundant full item-list refetch on each status transition
- `cron.mjs:20-31` — `readProjectNumber` re-parses the same `PROJECT.md` that `readTrackingConfig` already parsed
- `cron.mjs:143` — `cmdCronSetup` uses `process.argv[1]` for agt path; fragile under npx/symlink

Task-2 neither introduced nor resolved any of these.

---

## Edge Cases Checked

- Items with `undefined` status: safely excluded via optional chaining ✅
- Empty item list `[]`: `readyItems.length === 0` triggers early exit ✅
- Lock released on early return: `finally` block confirmed ✅
- `runSingleFeature` not called: throwing stub in test — test would fail if dispatch reached ✅

---

## Findings

No findings.

---

## Summary

The no-ready-items early-exit path is correctly implemented, positioned inside `try` so the lock is released, and exits 0 via normal function resolution. The unit test is functionally correct — the implicit exit-0 verification via the throwing `process.exit` stub is sound. No new architectural concerns introduced. All prior backlog items carry forward unchanged.

---

# Simplicity Review: cron-based-outer-loop / task-2

**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26
**Handshake run:** run_1
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-2/handshake.json`
- `.team/features/cron-based-outer-loop/tasks/task-1/handshake.json` (context)
- `bin/lib/cron.mjs` (full, 153 lines)
- `test/cron-tick.test.mjs` (full, 407 lines)
- git log for `bin/lib/cron.mjs` (full commit history on this branch)
- git show `967239a` stat (the "no ready items" task commit)

---

## Claim Verification

Builder claimed: feature was already implemented — verified. Commit `967239a` stat shows it
added only `tasks/task-2/handshake.json` and `tasks/task-1/eval.md`; the four-line guard at
`bin/lib/cron.mjs:91-94` was delivered in prior commit `b9f27a2`. The test at
`test/cron-tick.test.mjs:70-93` exercises it directly.

---

## Four Veto Categories

### 1. Dead Code — PASS

All imports in both files are used. `existsSync` removed by task-1; confirmed absent.
Remaining test imports (`mkdirSync`, `writeFileSync`, `rmSync`, `join`, `tmpdir`,
`execFileSync`, `fileURLToPath`, `cmdCronTick`, `cmdCronSetup`) are all exercised.

### 2. Premature Abstraction — PASS

`readProjectNumber` (cron.mjs:20-31) has one production call site (line 70), extracted for
dep injection testability. No new abstractions introduced by this task.

### 3. Unnecessary Indirection — PASS

No wrapper-only functions or re-exports added.

### 4. Gold-Plating — PASS

No speculative config options or unused feature flags introduced.

---

## Findings

🔵 test/cron-tick.test.mjs:71 — `writeProjectMd(teamDir)` is superfluous; `readTrackingConfig`
and `readProjectNumber` are both mocked in `deps` so the file is never read. Same at line 98.
Harmless but implies file I/O that doesn't happen.

---

## Overall Verdict: PASS

No 🔴 critical findings. One 🔵 suggestion (superfluous `writeProjectMd` calls in two test
cases). The feature is four lines of production code and one focused test — no excess.

---

# Tester Eval — cron-based-outer-loop / task-2

**Reviewer role:** Test strategist
**Date:** 2026-04-26
**Verdict:** PASS

---

## Files Read

- `.team/features/cron-based-outer-loop/tasks/task-2/handshake.json`
- `bin/lib/cron.mjs` (full, 153 lines)
- `test/cron-tick.test.mjs` (full, 407 lines)
- `bin/lib/github.mjs` (lines 233–243 — `listProjectItems`)
- `.team/features/cron-based-outer-loop/tasks/task-1/eval.md` (all prior review sections)

Live test run: `node --test test/cron-tick.test.mjs` — **15 tests, 0 failures**.

---

## Per-Criterion Results

### 1. Implementation — PASS

`cron.mjs:91–94` checks `readyItems.length === 0`, logs the static literal "cron-tick: no ready items on project board", and `return`s. The `return` is inside the `try` block (lines 84–126); the `finally` at line 127 runs unconditionally and releases the lock. No `process.exit` call — function returns normally (exit 0). Confirmed by direct read.

### 2. Test covers the criterion — PASS

`cron-tick.test.mjs:70–93` injects two non-ready items (`"Todo"`, `"In Progress"`), asserts `logs.some(l => l.includes("no ready items"))`, and uses `runSingleFeature: async () => { throw new Error("should not be called") }` as a sentinel. No try/catch wraps the `await cmdCronTick` call — any `process.exit` invocation (mocked to throw) would propagate and fail the test. Dispatch guard works.

### 3. Exit 0 — PASS (implicit only)

The test structure guarantees exit 0 indirectly: `process.exit` is mocked to throw, there is no try/catch around `cmdCronTick`, so any call would propagate and fail the test. However the `exitCode` variable (initialized to `null` in `beforeEach`) is never explicitly asserted after the call. The acceptance criterion is met but the exit-code contract is not directly machine-verifiable.

### 4. Lock released on no-ready-items path — STRUCTURALLY CORRECT, UNTESTED

`cron.mjs:93` `return` is inside `try`; `finally` at line 127 runs. The stub is `release: () => {}` — a no-op with no spy. If the `return` were ever refactored outside the try-finally, the lock would silently leak on every empty-board tick, deadlocking all subsequent cron runs until process restart. No test would catch this.

### 5. `listProjectItems` null-return safety — PASS (by implementation)

`github.mjs:238–241` shows `listProjectItems` returns `[]` on failure — never null. `items.filter(...)` at `cron.mjs:89` is safe.

---

## Prior Backlog Items (carry forward from task-1)

Not re-flagging here — all carry forward unchanged. Key open items:
- 🟡 revert-also-fails path untested (`cron-tick.test.mjs:193`)
- 🟡 `_commentIssue` not try-caught inside `catch(err)` (`cron.mjs:124`)
- 🟡 issue number not forwarded to `runSingleFeature` (`cron.mjs:111`)
- 🟡 `github.mjs:275` implicit cwd coupling in `setProjectItemStatus`
- 🔵 title sanitization has no unit test (`cron.mjs:100`)

---

## Findings

🟡 `test/cron-tick.test.mjs:70` — No spy on `lockFile.release`; if `cron.mjs:93` return were moved outside the try-finally the lock would leak permanently and no test would catch it — replace `release: () => {}` with a spy and assert it was called in the no-ready-items test

🔵 `test/cron-tick.test.mjs:92` — Exit-0 acceptance criterion only implicitly verified; add `assert.equal(exitCode, null, "process.exit should not be called for empty board")` to make the contract explicit

---

## Summary

The acceptance criterion is met: `cron.mjs:91–94` correctly logs the message and returns without calling `process.exit`, achieving exit 0. 15/15 tests pass on live run. The 🟡 finding is a coverage gap on the lock-release path specific to no-ready-items — structurally correct today but unprotected against regression. The 🔵 makes the exit-0 contract explicit. Neither blocks merge. All prior task-1 backlog items carry forward.
