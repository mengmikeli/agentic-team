# Tester Evaluation — cron-based-outer-loop

**Role:** Test Strategist
**Date:** 2026-04-24
**Files read:**
- `bin/lib/cron.mjs` (full, 147 lines)
- `test/cron-tick.test.mjs` (full, 324 lines)
- `task-1/handshake.json`, `task-2/handshake.json`
- `task-2/artifacts/test-output.txt` (lines 1–254)
- `task-1/eval.md` (prior-iteration parallel review — noted for context only)

**Test evidence:** test-output.txt lines 239–253 — 7 `cmdCronTick` tests + 5 `cmdCronSetup` tests, all pass, exit code 0 (task-2 gate confirms).

---

## Overall Verdict: PASS

The core feature — `Ready → In Progress → Done` with failure revert and advisory lock — is correctly implemented and directly exercised by passing tests. The success-path ordering is now enforced by `findIndex`-based assertions (test #3, lines 153–157). No critical test gaps block merge.

Two 🟡 warnings go to backlog. Four 🔵 suggestions optional.

---

## Per-Criterion Results

### Ready → In Progress before execution — PASS

`cron.mjs:105` calls `_setProjectItemStatus(issueNumber, projectNumber, "in-progress")` before `await _runSingleFeature(args, title)` at line 108. Test #3 (`cron-tick.test.mjs:153`) records transitions and asserts `inProgressIdx < doneIdx` via `findIndex`. Ordering is enforced.

### → Done on success — PASS

`cron.mjs:110` calls `_setProjectItemStatus(..., "done")` in the success branch. Same test #3 asserts `doneIdx !== -1`. Confirmed in test-output.txt line 242.

### Revert to Ready + comment on failure — PASS (ordering: ⚠ partial)

`cron.mjs:114–115` reverts to "ready" then posts a comment. Test #4 (`cron-tick.test.mjs:184`) verifies both transitions and that `"agent exploded"` appears in the comment body. Confirmed in test-output.txt line 235. However, ordering of "in-progress" → "ready" is asserted with `.some()` only — see 🟡 below.

### Advisory lock prevents concurrent runs — PASS

Lock acquired with `timeout: 0` at line 78. Lines 79–82 exit 0 when `!lock.acquired`. Test #2 verifies "already running" log and `exitCode === 0`. Confirmed test-output.txt line 241.

### Pre-flight guards — PASS

Tests #5, #6, #7 each verify `exitCode === 1` for missing tracking config, missing project number, and missing Ready option ID. All pass (test-output.txt lines 244–246).

### First ready item dispatched only — PARTIAL (🟡)

Test #3 presents two ready items (issue #7 and #8) but uses a boolean `runCalled`. No call-count assertion. No assertion that issue #8 transitions were NOT recorded. A regression that dispatches all ready items sequentially would still pass.

### PATH safety in cron-setup — PASS (fixed)

`cron.mjs:140` now uses `quotePath(process.env.PATH ?? "")` — PATH is single-quoted and null-guarded. The prior security finding is resolved.

---

## Edge Cases Checked

| Path | Covered? |
|---|---|
| No ready items | ✅ test #1 |
| Lock already held | ✅ test #2 |
| in-progress → done (success, ordered) | ✅ test #3 (`findIndex` assertion) |
| Revert to ready + comment (failure) | ✅ test #4 (ordering: ⚠ `.some()` only) |
| Missing tracking config | ✅ test #5 |
| Missing project number | ✅ test #6 |
| Missing Ready option ID | ✅ test #7 |
| Multiple ready items — only first dispatched | ⚠ partial (boolean flag, no call count) |
| Case-insensitive status match ("READY") | ⚠ implicit ("Ready" used in all tests) |
| Title with control chars / >200 chars | ❌ no test |
| `_listProjectItems` returns null | ❌ no guard, no test |
| `_setProjectItemStatus` returns false on revert | ❌ no test, no log |
| Non-numeric `--interval` | ❌ no test |

---

## Findings

🟡 `test/cron-tick.test.mjs:184` — Failure-path ordering not enforced: `.some()` used for both "in-progress" and "ready" assertions; a bug that records "ready" before "in-progress" (or skips "in-progress") passes undetected — mirror test #3's `findIndex` approach (`inProgressIdx < readyIdx`)

🟡 `test/cron-tick.test.mjs:125` — "First item only" contract incompletely tested: `runCalled` is boolean, not a count; no assertion that issue #8 transitions were NOT recorded — add a `runCallCount` counter asserting exactly 1 call and verify `statusTransitions` contains no entries for `issueNumber === 8`

🔵 `bin/lib/cron.mjs:89` — No `?? []` guard before `.filter()`; `_listProjectItems` is documented to return `[]` on error but a null return throws an uncontextual TypeError — change to `(items ?? []).filter(...)`

🔵 `bin/lib/cron.mjs:115` — `_setProjectItemStatus` return value discarded on the failure revert path; if revert fails item is permanently stuck in "in-progress" with no warning and subsequent cron-tick runs skip it — add a test for `false` return and log a warning

🔵 `bin/lib/cron.mjs:100` — Title sanitization (control-char strip + 200-char truncation) has no dedicated test; add cases for a title containing `\n` and a 300-char title

🔵 `test/cron-tick.test.mjs` — Non-numeric `--interval` (e.g. `"abc"`) untested; NaN fallback to 30 is correct but the path has no coverage

---

# Simplicity Review — cron-based-outer-loop

**Reviewer:** Simplicity
**Feature:** `agt cron-tick` transitions board item Ready → In Progress → Done
**Files read:** `bin/lib/cron.mjs` (all 147 lines), `bin/lib/util.mjs` (lines 90–166), `test/cron-tick.test.mjs` (all 324 lines), `task-1/eval.md` (all prior reviews), `task-2/handshake.json`, `task-2/artifacts/test-output.txt` (lines 230–254)

---

## Overall Verdict: FAIL

One 🔴 critical finding (dead code guard in `finally` block). Two 🟡 warnings must go to backlog.

---

## Per-Criterion Results

### Dead code — FAIL

**`cron.mjs:119`** — `if (lock.release)` is a dead guard.

`util.mjs:153–162` shows `lockFile` has exactly two return shapes:
- `{ acquired: false, holder: ... }` — no `release` field
- `{ acquired: true, release }` — `release` is always a function

The `finally` block (line 118) is only reachable when `lock.acquired === true`, because `!lock.acquired` triggers `process.exit(0)` at line 81 — before the `try` block is entered. Therefore inside `finally`, `lock.release` is unconditionally a function. The `if (lock.release)` branch can never be false.

The Architect reviewer (eval.md:277) noted this guard is "slightly defensive but harmless." Harmless is correct; dead is also correct and triggers the 🔴 veto under the dead code category.

Note: this is the same class of dead code identified in the prior iteration (`lock.acquired &&` at the old line 120, per Engineer eval line 38). The fix replaced one dead guard with another.

### Premature abstraction — PASS

`readProjectNumber` is injected as a dep (one call site, line 70), but this follows the uniform testability pattern applied to all external I/O in the module. Every injected dep has one production call site by design; the pattern earns its keep through consistent testability. Not a violation.

### Unnecessary indirection — PASS

No wrapper-only-delegates pattern introduced in this PR.

### Gold-plating — PASS

No speculative config options, unused feature flags, or extensibility hooks in the new code.

---

## Findings

🔴 bin/lib/cron.mjs:119 — Dead guard `if (lock.release)`: `util.mjs:162` proves `release` is always a function when `acquired === true`; `finally` is only reachable when `acquired === true`; replace `if (lock.release) { lock.release(); }` with `lock.release();`

🟡 test/cron-tick.test.mjs:184 — Failure path ordering unverified: `.some()` on statusTransitions accepts "ready" before "in-progress"; apply the same `findIndex`-based order assertion already used for the success path at lines 153–157

🟡 test/cron-tick.test.mjs:67 — Dead test setup: `writeProjectMd(teamDir)` is called in tests 1–4 but both `readTrackingConfig` and `readProjectNumber` are fully mocked via deps so PROJECT.md is never read; remove to eliminate false signal that file content affects test outcomes

---

# Security Review — cron-based-outer-loop

**Reviewer:** Security
**Files read:** `bin/lib/cron.mjs` (all 147 lines), `bin/lib/github.mjs` (lines 1–30, 200–285), `test/cron-tick.test.mjs` (all 324 lines), `bin/lib/util.mjs` (lines 90–150), `task-2/handshake.json`

---

## Overall Verdict: PASS

No critical (🔴) findings. One 🟡 warning must go to backlog.

---

## Note on Prior Security Review (run_1)

The previous iteration's security review listed a 🟡 finding: `process.env.PATH` unquoted in the crontab template. On direct inspection of `cron.mjs:140`, this finding **does not exist** in the current code:

```js
PATH=${quotePath(process.env.PATH ?? "")} ${quotePath(agtPath)} cron-tick ...
```

PATH is wrapped in `quotePath()` and `?? ""` guards against undefined. The prior review showed a fabricated snippet (`PATH=${process.env.PATH}`) that never matched the actual code. Finding retracted.

---

## Threat Model

**Adversaries considered:**
- Attacker crafting a malicious GitHub issue title for prompt injection against the Claude agent
- Passive observer reading public GitHub issue comments to harvest local paths or auth details

**Out of scope:** GitHub API auth (delegated to `gh` CLI), lock-file races (OS-level, `util.mjs`), SSRF (no JS-layer HTTP).

---

## Per-Criterion Results

### Shell Injection (cron-setup) — PASS

`cron.mjs:140` — all variable content in the crontab template is wrapped with `quotePath()`:
- `cwd` → `quotePath(cwd)` ✓
- `PATH` → `quotePath(process.env.PATH ?? "")` ✓ (undefined handled)
- `agtPath` → `quotePath(agtPath)` ✓
- log path → `quotePath(cwd + "/.team/cron.log")` ✓

`interval` is `parseInt(...)` clamped to a positive integer — not user content, safe for bare interpolation. `quotePath` uses standard `'...'` POSIX escaping with single-quote escape sequences. No injection surface.

### Information Disclosure via Error Message — WARN

`cron.mjs:116` — raw `err.message` is posted verbatim to a public GitHub issue comment:

```js
_commentIssue(issueNumber, `cron-tick failed: ${err.message || String(err)}`);
```

Error messages from `_runSingleFeature` or its transitive deps can include local absolute paths (ENOENT: `/Users/...`), `gh` CLI auth details, or internal state. On a public repo this is world-readable. The `commentIssue` path uses `spawnSync` with array args and no `shell: true`, so no secondary shell injection from the body — risk is data disclosure only.

Fix: strip absolute paths and truncate before posting:
```js
err.message.replace(/\/[^\s:'"]+/g, "<path>").slice(0, 300)
```

### Prompt Injection via Title — PASS (with observation)

`cron.mjs:100` — sanitization strips ASCII control characters and newlines before the title reaches `_runSingleFeature`:

```js
(item.title || "").replace(/[\r\n\x00-\x1f\x7f]/g, " ").trim().slice(0, 200)
```

Covers the primary injection vector (newline-based prompt stuffing). Unicode bidi overrides (U+202A–U+202E, U+2066–U+2069) are not filtered — minor terminal spoofing, unlikely to affect Claude API behavior. Flagged 🔵.

### Argument Forwarding — PASS

Status strings ("in-progress", "done", "ready") are hardcoded literals. `issueNumber` and `projectNumber` reach `gh` via `spawnSync` array args without `shell: true`. No injection path.

### Secrets Management — PASS

No credentials or tokens in `cron.mjs`. GitHub auth fully delegated to `gh` CLI. Error comments post only runtime error text (see WARN above), not tokens or keys.

### Lock File — PASS

Lock path derived from `process.cwd()` (not user input). `timeout: 0` = single try-once, no polling loop. `finally` block always releases (noting the Simplicity reviewer's 🔴 finding that `if (lock.release)` is a dead guard — does not affect security).

---

## Findings

🟡 bin/lib/cron.mjs:116 — Raw `err.message` posted to public GitHub issue comment; ENOENT and auth errors expose local paths and internal state; strip paths and truncate to ≤300 chars before posting.

🔵 bin/lib/cron.mjs:100 — Title sanitization omits Unicode bidi overrides (U+202A–U+202E, U+2066–U+2069); extend regex if terminal display integrity matters.

---

# Product Manager Review — cron-based-outer-loop

**Reviewer:** PM
**Feature:** `agt cron-tick` transitions board item Ready → In Progress → Done
**Files read:** `bin/lib/cron.mjs` (all 147 lines), `bin/lib/util.mjs` (lines 140–165), `test/cron-tick.test.mjs` (all 324 lines), `task-2/artifacts/test-output.txt` (lines 232–254), `task-1/eval.md` (all prior reviews in this file)

---

## Overall Verdict: ITERATE

Core feature requirements are met and all 12 tests pass. One 🔴 blocker from the Simplicity review must be resolved before merge (`if (lock.release)` dead guard at line 119, confirmed via `util.mjs:162`). Fix is one line. Four 🟡 backlog items remain; none block merge once the 🔴 is cleared.

---

## Per-Criterion Results

### Requirement: Ready → In Progress before execution — PASS

Direct evidence: `cron.mjs:105` calls `_setProjectItemStatus("in-progress")` before `await _runSingleFeature(args, title)` at line 108. Test #3 (`cron-tick.test.mjs:153–157`) enforces this with `findIndex`-based ordering (`inProgressIdx < doneIdx`). The spec's "before execution" invariant is contractually tested.

### Requirement: → Done on success — PASS

Direct evidence: `cron.mjs:110` calls `_setProjectItemStatus("done")` in the success branch after `_runSingleFeature` resolves. Test #3 verifies `doneIdx !== -1` and ordering. Confirmed test-output.txt line 242.

### Failure revert (defensive behavior) — PASS with gap

`cron.mjs:114–115` reverts to "ready" and posts error as a comment. Test #4 verifies both transitions and comment body content. The failure path test uses `.some()` — ordering of "in-progress" before execution and before the revert is not enforced by the test (see 🟡).

### Pre-flight guards — PASS

All three guards (missing tracking config, project number, Ready option ID) fire before any board mutations and produce `exitCode === 1`. Confirmed test-output.txt lines 244–246.

### Simplicity gate 🔴 blocker — FAIL

`cron.mjs:119`: `if (lock.release)` is dead. `util.mjs:162` proves the acquired-true return shape always includes `release` as a function. The `finally` block is only reachable when `lock.acquired === true` (the `!lock.acquired` branch calls `process.exit(0)` at line 81 before `try` is entered). The guard is unconditionally true inside `finally`. Lock release behavior is correct today — this is a code quality issue, not a behavioral defect — but it is a 🔴 under the simplicity gate and blocks merge.

---

## Findings

🔴 bin/lib/cron.mjs:119 — Dead guard `if (lock.release)`: `util.mjs:162` confirms `release` is always a function when `acquired === true`; `finally` only reachable after acquisition; replace `if (lock.release) { lock.release(); }` with `lock.release();`

🟡 test/cron-tick.test.mjs:184 — Failure path ordering not enforced; `.some()` assertions pass even if "ready" is recorded before "in-progress" or "in-progress" is skipped entirely; apply `findIndex`-based order assertion matching the success path at lines 153–157

🟡 bin/lib/cron.mjs:114 — `_setProjectItemStatus` return discarded on the failure-revert path; a `false` return means the board item is permanently stuck in "in-progress" and silently falls out of the queue (future runs filter for "ready" only); log a warning at minimum

🟡 bin/lib/cron.mjs:116 — Raw `err.message` posted to a public GitHub issue comment (already flagged by Security); strip absolute paths and truncate before posting

🟡 test/cron-tick.test.mjs:125 — "First item only" contract not fully enforced; no call-count assertion on `runSingleFeature` and no check that issue #8 transitions were NOT recorded; a regression dispatching all ready items sequentially would pass

---

# Engineer Review — cron-based-outer-loop (run_2)

**Reviewer:** Engineer
**Feature:** `agt cron-tick` transitions board item Ready → In Progress → Done
**Files read (directly verified):**
- `bin/lib/cron.mjs` — full, 147 lines
- `test/cron-tick.test.mjs` — full, 323 lines
- `bin/lib/github.mjs` — lines 1–65 and lines 200–285
- `bin/lib/util.mjs` — lines 85–165 (`lockFile` implementation)
- `task-1/handshake.json`, `task-2/handshake.json`

---

## Overall Verdict: PASS

No correctness bugs found. Two 🟡 warnings go to backlog. Three 🔵 suggestions optional.

The Simplicity reviewer's 🔴 at `cron.mjs:119` (dead `if (lock.release)` guard) is confirmed by direct inspection of `util.mjs:162,165`. All `acquired: false` return paths omit `release` (lines 121, 140, 142, 148, 165); the only `acquired: true` path at line 162 always includes `release` as a function. The `finally` block is only reachable when `acquired === true` (`!lock.acquired` exits at `cron.mjs:81` before `try` is entered). The guard is dead. I endorse the Simplicity finding — but from an engineering correctness lens this does not block merge.

---

## Per-Criterion Results

### Correctness — PASS

**Happy path** (`cron.mjs:105–111`):
- `_setProjectItemStatus(..., "in-progress")` at line 105 precedes `await _runSingleFeature(args, title)` at line 108. ✓
- `_setProjectItemStatus(..., "done")` at line 110 follows successful dispatch. ✓

**Failure path** (`cron.mjs:112–116`):
- `catch (err)` catches all thrown values. `err.message || String(err)` handles non-Error throws. ✓
- Revert at line 114, comment at line 115. ✓

**Lock lifecycle** (verified against `util.mjs:98–165`):
- Six return paths total: lines 121, 140, 142, 148, 165 all yield `{ acquired: false, ... }` (no `release`); line 162 yields `{ acquired: true, release }` as the only success path. ✓
- Code is functionally correct. The `if (lock.release)` guard at line 119 is dead but harmless.

**Edge cases verified:**
- `item.title` null/undefined: `(item.title || "")` at line 100. ✓
- Multiple ready items: `readyItems[0]` — first item only. ✓
- Empty board: early `return` at line 93, `finally` releases lock. ✓

### Code Quality — WARN

The dead `if (lock.release)` guard at line 119 (confirmed dead against `util.mjs`) misleads maintainers into thinking `release` might be absent when the lock is held. Fix is one line.

Otherwise: DI via `deps` is consistent, `readProjectNumber` is a clear single-responsibility helper, nested try/catch is correct for this use case.

### Error Handling — WARN

**`_setProjectItemStatus` return values discarded** (lines 105, 110, 114):

The most consequential case is line 114 (failure revert): if `setProjectItemStatus` returns `false`, the item stays in "in-progress" permanently. Future cron-tick runs filter for `status === "ready"` at line 89 — the item silently falls out of the queue with no diagnostic. At minimum a warning should be logged on `false` return.

Lines 105 and 110 are lower severity: execution proceeds regardless of board update success.

### Performance — PASS

`github.mjs:266` calls `readTrackingConfig()` with no args inside `setProjectItemStatus`, re-reading PROJECT.md per transition (four reads per cron-tick run total). File is small, reads are synchronous — no material impact. Flagged 🔵.

### Test Coverage — PASS (failure-path ordering gap)

**Success path** (`cron-tick.test.mjs:153–157`): `findIndex` with `inProgressIdx < doneIdx` — ordering enforced. ✓

**Failure path** (`cron-tick.test.mjs:184–187`): `.some()` only — reversed order would pass undetected.

**"First item only"**: title assertion inside `runSingleFeature` mock catches wrong-item dispatch. No assertion that `statusTransitions` has zero entries for `issueNumber === 8`.

---

## Findings

🟡 bin/lib/cron.mjs:114 — `_setProjectItemStatus` return value discarded on failure revert; if call returns `false`, item is permanently stuck in "in-progress" and silently dropped from future runs; log a warning on `false` return
🟡 test/cron-tick.test.mjs:184 — Failure-path test ordering not enforced; `.some()` cannot detect reversed "in-progress"/"ready" order; mirror the `findIndex`-based assertion from test #3 at lines 153–157
🔵 bin/lib/cron.mjs:105 — `_setProjectItemStatus` return value discarded on "in-progress" pre-execution transition; failed board update goes unlogged
🔵 bin/lib/cron.mjs:110 — `_setProjectItemStatus` return value discarded on "done" transition; failed board update goes unlogged
🔵 bin/lib/github.mjs:266 — `readTrackingConfig()` called with no args causes redundant PROJECT.md read per transition; thread the caller's already-loaded config
