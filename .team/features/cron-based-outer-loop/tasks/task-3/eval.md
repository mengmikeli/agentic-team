# PM Eval — task-3: Concurrent `agt cron-tick` lock behavior

**Verdict: PASS**

---

## Files read

- `.team/features/cron-based-outer-loop/tasks/task-3/handshake.json`
- `bin/lib/cron.mjs`
- `bin/lib/util.mjs` (lines 90–166)
- `test/cron-tick.test.mjs` (full file)

## Per-criterion results

### 1. Lock acquired with `timeout: 0` (fail-fast, no waiting)

**PASS**

`cron.mjs:78` calls `_lockFile(lockPath, { timeout: 0, command: "cron-tick" })`.

In `util.mjs:98–99`, `lockFile` sets `deadline = Date.now() + timeout`. With `timeout: 0`, `deadline` equals the call-time clock value. The earliest possible check `Date.now() >= deadline` is always true (monotonic clock). On the first loop iteration, if the lock file exists with a live holder PID, the function returns `{ acquired: false, holder }` immediately — no sleep, no retry.

### 2. Second process exits 0 with "already running" message

**PASS**

`cron.mjs:79–82`:
```js
if (!lock.acquired) {
  console.log("cron-tick: tick already running (lock held by another process)");
  process.exit(0);
}
```

Both the message string and the exit code match the requirement.

### 3. `runSingleFeature` is NOT called when lock is not acquired

**PASS**

The `process.exit(0)` at `cron.mjs:82` fires before `listProjectItems` or `runSingleFeature` are ever reached. The unit test at `test/cron-tick.test.mjs:107` also injects `runSingleFeature: async () => { throw new Error("should not be called") }` and passes — direct evidence that the happy path never reaches dispatch when the lock is withheld.

### 4. Unit test: lock-held path via dep injection

**PASS**

`test/cron-tick.test.mjs:97–125` injects `lockFile: () => ({ acquired: false, holder: { pid: 99999, command: "cron-tick" } })`, asserts `logs.some(l => l.includes("already running"))` and `exitCode === 0`. Structurally correct.

### 5. CLI integration test: real filesystem lock with live PID

**PASS**

`test/cron-tick.test.mjs:408–447` creates a `.cron-lock.lock` file owned by `process.pid` (the live test-runner), then spawns `agt cron-tick` as a subprocess. The real `lockFile` implementation calls `isPidAlive(process.pid)` via `process.kill(pid, 0)` — this returns `true` because the test-runner is alive during the test. The subprocess exits 0 and emits "already running". Assertions on both `exitStatus === 0` and `output.includes("already running")` are correct.

### 6. Lock file path consistency

**PASS**

`cron.mjs:77` sets `lockPath = join(teamDir, ".cron-lock")`. `util.mjs:100` appends `.lock`, making the real path `.team/.cron-lock.lock`. The CLI test at line 424 writes to `join(tmpDir, ".team", ".cron-lock.lock")` — matches exactly.

---

## Edge cases checked

- `timeout: 0` with no existing lock file → `writeFileSync` with `flag: "wx"` succeeds on first try → lock acquired ✓
- `timeout: 0` with existing lock file and dead PID → `isPidAlive` returns false → stale lock deleted → loop continues → lock acquired ✓ (handled by `util.mjs:115–117`)
- `timeout: 0` with existing lock file and live PID → `Date.now() >= deadline` → returns `{ acquired: false }` immediately ✓

---

## Gaps

None blocking. One procedural note: no `artifacts/test-output.txt` was stored for task-3. The handshake did not claim one, and the gate output was provided externally (truncated). The omission has no impact on this verdict since the code logic is directly verifiable.

---

# Security Review — task-3: Concurrent cron-tick lock behavior

**Reviewer role:** Security
**Verdict:** PASS (one 🟡 warning flagged for backlog)

---

## Additional Files Read (Security Pass)

- `bin/lib/github.mjs` (lines 1–65, 219–232: `runGh`, `commentIssue`)

---

## Security Criteria

### Input sanitization — PASS

`cron.mjs:100` strips control characters (`\r`, `\n`, `\x00–\x1f`, `\x7f`) from the issue title and truncates to 200 chars before passing it to `runSingleFeature`. This directly prevents newline injection / prompt injection from a maliciously crafted issue title.

### Shell injection in cron-setup output — PASS

`cmdCronSetup` constructs a crontab line at `cron.mjs:146–147`. The `quotePath` helper correctly single-quotes all dynamic values (cwd, PATH, agt binary path, log path) and handles embedded single quotes via the standard POSIX `'\''` substitution. `runGh` uses `spawnSync` with an args array — no shell interpretation.

### Lock file concurrency safety — PASS

`writeFileSync(..., { flag: "wx" })` is the correct POSIX atomic primitive for advisory locking. `isPidAlive` stale-lock detection via `process.kill(pid, 0)` is standard. The `release()` function re-validates PID before unlinking, preventing one process from releasing another's lock.

### Error information disclosure — WARNING

`cron.mjs:124`: `_commentIssue(issueNumber, \`cron-tick failed: ${err.message}\`)` posts the raw `err.message` from `runSingleFeature` to the GitHub issue. If the agent throws an error containing a file path, environment variable, or internal API output, it will appear in a public GitHub comment.

### Secrets management — PASS (not applicable)

No credentials or tokens are introduced or modified. The lock file stores only `{ pid, timestamp, command }`.

---

## Security Findings

🟡 `bin/lib/cron.mjs:124` — Raw `err.message` from agent posted to GitHub issue; could expose internal paths, env data, or API output in public repos. Sanitize/truncate before posting (e.g., `err.message.slice(0, 300).replace(/[^\x20-\x7e]/g, '?')`).

🔵 `bin/lib/cron.mjs:141` — No upper bound on `--interval`; `--interval 99999` generates invalid cron syntax (`*/99999 * * * *`) that cron silently ignores. Add a cap (e.g., max 1440).

---

# Engineer Eval — task-3: Concurrent `agt cron-tick` lock behavior

**Reviewer role:** Engineer
**Verdict:** PASS (one 🟡 warning flagged for backlog)

---

## Files Read

- `bin/lib/cron.mjs` (full file)
- `bin/lib/util.mjs` (lines 83–166: `sleepMs`, `isPidAlive`, `lockFile`)
- `bin/lib/github.mjs` (lines 41–65, 235–255, 258–290: `readTrackingConfig`, `listProjectItems`, `setProjectItemStatus`)
- `test/cron-tick.test.mjs` (full file)

---

## Correctness

### Lock fail-fast with `timeout: 0`

**PASS**

`cron.mjs:78` passes `{ timeout: 0 }` to `lockFile`. In `util.mjs:101`, `deadline = Date.now() + 0`. On the first loop iteration, after `isPidAlive` confirms the holder is alive, `Date.now() >= deadline` is true (monotonic clock is at or past the call-time snapshot). Returns `{ acquired: false, holder }` immediately — no `sleepMs` call, no retry.

Stale-lock path also traced: if the holder PID is dead, `util.mjs:115–117` unlinks the stale lock and `continue`s. On the next iteration the lock file is absent, `writeFileSync(..., { flag: "wx" })` succeeds atomically. Correct behavior with `timeout: 0`.

### Second process exits 0 and does not call `runSingleFeature`

**PASS**

`cron.mjs:79–82` exits before the `try` block that contains `listProjectItems`, `setProjectItemStatus`, and `runSingleFeature`. The unit test at `cron-tick.test.mjs:107` injects `runSingleFeature: async () => { throw new Error("should not be called") }` on the lock-held path and passes — direct evidence that dispatch is never reached.

### All called functions are synchronous — no missing `await`

**PASS**

`listProjectItems` (github.mjs:238), `setProjectItemStatus` (github.mjs:258), and `commentIssue` (github.mjs:219) are all synchronous. `cron.mjs:86` calls `_listProjectItems` without `await`, which is correct.

### Error paths

**PASS**

`cron.mjs:118–126`: `runSingleFeature` failure caught, board item reverted to `ready`, failure comment posted to issue. `cron.mjs:106–108` and `114–116`: `setProjectItemStatus` returning false emits a `console.warn` but does not abort the run — correct non-fatal treatment for a best-effort board sync operation.

---

## Edge Cases Checked

- `timeout: 0`, lock held by live PID → immediate `{ acquired: false }` ✓
- `timeout: 0`, no lock file → `wx` write succeeds on first iteration → `{ acquired: true }` ✓
- `timeout: 0`, stale lock (dead PID) → stale file deleted, fresh lock acquired ✓
- `runSingleFeature` throws → revert to `ready` + comment, lock released in `finally` ✓
- `setProjectItemStatus` returns false → warning logged, execution continues ✓

---

## Findings

🟡 `bin/lib/cron.mjs:128` — `lock.release()` is called unconditionally in the `finally` block, but `lock.release` is `undefined` when `lock.acquired === false` (the `{ acquired: false }` return values from `lockFile` never carry a `release` function). The current code is safe only because `process.exit(0)` at line 81 always either terminates the process (production) or throws (current test pattern), so the `try` block is never entered with an unacquired lock. If a future test mocks `process.exit` as a no-op instead of a throw, the `finally` will execute and crash with `TypeError: lock.release is not a function`. Fix: `if (lock.acquired) lock.release()` or `lock.release?.()`.

🔵 `test/cron-tick.test.mjs:424` — The integration test hardcodes `.cron-lock.lock`, coupling it to the internal convention in `util.mjs:100` that appends `.lock`. This will fail visibly (not silently) if the suffix changes, so it is acceptable. Noted for awareness.

---

# Tester Eval — cron-based-outer-loop / task-3

**Reviewer role:** Test strategist
**Date:** 2026-04-26
**Verdict:** PASS

---

## Files Read

- `.team/features/cron-based-outer-loop/tasks/task-3/handshake.json`
- `bin/lib/cron.mjs` (full, 154 lines)
- `bin/lib/util.mjs` (lines 98–166 — `lockFile`)
- `test/cron-tick.test.mjs` (full, 448 lines)
- `.team/features/cron-based-outer-loop/tasks/task-3/eval.md` (PM, Security, Engineer sections)

No `artifacts/test-output.txt` found. Gate output from the review prompt used as evidence (all tests pass, 0 failures).

---

## Per-Criterion Results

### 1. Core behavior: second process exits 0 without running a feature — PASS

`cron.mjs:79–82`: when `_lockFile` returns `{ acquired: false }`, the function logs "already
running" and calls `process.exit(0)`. This happens before the `try` block at line 84 — no
items are fetched, no feature is dispatched.

### 2. Unit test (cron-tick.test.mjs:97–125) — PASS (limited scope)

Mocks `lockFile` to return `{ acquired: false }` directly. Correctly verifies `cmdCronTick`'s
response contract (log message + exit 0 asserted at lines 120-124). Injects
`runSingleFeature: async () => { throw new Error("should not be called") }` as a sentinel — if
dispatch were reached the test would fail. Structural correctness confirmed.

This test only covers `cmdCronTick`'s response to not-acquired; it does not exercise the `lockFile`
primitive's concurrency behavior at all.

### 3. CLI integration test (cron-tick.test.mjs:408–447) — PASS (simulated concurrency)

Writes `.cron-lock.lock` with `process.pid` (live test-runner PID) before spawning the subprocess.
Lock-path consistency confirmed: `cron.mjs:77` → `join(teamDir, ".cron-lock")` + `.lock` suffix
appended by `util.mjs:100` = `join(tmpDir, ".team", ".cron-lock.lock")` — matches the test's
write path at line 424 exactly.

`isPidAlive(process.pid)` via `process.kill(pid, 0)` returns `true` (test-runner alive). With
`timeout: 0`, `deadline = Date.now()` — any subsequent `Date.now() >= deadline` check is true.
`lockFile` returns `{ acquired: false }` on the first iteration. Subprocess exits 0 and emits
"already running". Both assertions correct.

### 4. Lock release when not acquired — CORRECT (regression risk)

`process.exit(0)` at `cron.mjs:81` fires before the `try` block, so the `finally` at line 127
never executes when the lock was not acquired. No leak.

However, as the Engineer noted: `{ acquired: false }` return values from `lockFile` carry no
`release` function, so if `process.exit` were ever mocked as a no-op instead of a throw,
the `finally` would crash with `TypeError: lock.release is not a function`. No test exercises
this failure mode. The current test pattern (mock throws on exit) happens to avoid it.

---

## Coverage Gaps

### Gap A: EEXIST race path (util.mjs:133–150) never exercised

The only code path that fires in a truly simultaneous double-invocation is when two processes
both observe the lock file absent, then race on `writeFileSync({flag:"wx"})`. The loser gets
`EEXIST`. With `timeout: 0`, the EEXIST handler reads the winner's lock and returns
`{ acquired: false, holder: existing }`.

The integration test pre-writes the lock before spawning the subprocess — the subprocess sees
the file on its first `existsSync` check and never reaches the write path. The EEXIST handler
at `util.mjs:136–147` has no test coverage whatsoever.

The logic is correct (reviewed directly), but a regression in this path would be invisible.

### Gap B: No lock-release spy in unit test

`test/cron-tick.test.mjs:104`: `lockFile: () => ({ acquired: false, ... })` — no `release`
function is provided. This is correct for the not-acquired path, but the same pattern appears
on the acquired-lock tests where `release: () => {}` is a no-op with no spy. If `finally`
stopped calling `release()`, no test would catch it (carry-forward from task-2 tester review).

### Gap C: CLI integration test has no dispatch-sentinel

`cron-tick.test.mjs:408–447` asserts exit 0 and "already running" but provides no guarantee
that `runSingleFeature` was not called. If the subprocess somehow logged "already running" and
then proceeded, the test would still pass. The throwing sentinel is unit-test-only.

---

## Prior Backlog Items (carry forward from task-2 tester review)

- 🟡 `revert-also-fails` path untested (`cron-tick.test.mjs:193`)
- 🟡 `_commentIssue` not try-caught inside `catch(err)` (`cron.mjs:124`)
- 🟡 issue number not forwarded to `runSingleFeature` (`cron.mjs:111`)
- 🟡 no spy on `lockFile.release` in no-ready-items test
- 🔵 title sanitization has no adversarial input test (`cron.mjs:100`)

---

## Findings

🟡 test/cron-tick.test.mjs:408 — Integration test never exercises `util.mjs:133–150` (EEXIST race path) — the only path that fires when two processes actually start simultaneously with no pre-existing lock; add a test that spawns two concurrent `agt cron-tick` processes without a pre-written lock to exercise the atomic write race

🔵 test/cron-tick.test.mjs:408 — CLI integration test has no negative assertion that `runSingleFeature` was skipped; the unit test's throwing sentinel at line 107 covers this for the mocked path but the subprocess test relies solely on exit code and log message

---

## Summary

Core behavior is correctly implemented and tested at two levels. The lock-not-acquired path
exits 0 before entering the try block — no lock leak, no dispatch. The integration test
correctly simulates a live-PID holder and exercises the real `lockFile` filesystem path.

Primary gap: the EEXIST concurrent-write-race path in `util.mjs:133–150` is never exercised
by any test. This is the only code path active in a truly simultaneous double-invocation, and
a regression there would be invisible. Flagged as 🟡 backlog. No 🔴 findings.

---

# Simplicity Review — task-3: Concurrent cron-tick lock behavior

**Reviewer role:** Simplicity advocate
**Verdict:** PASS (one 🟡 backlog item)

---

## Files Read (Simplicity Pass)

- `bin/lib/cron.mjs` (full)
- `test/cron-tick.test.mjs` (full)
- `bin/lib/util.mjs` lines 82–166 (`lockFile`, `sleepMs`, `isPidAlive`)
- `bin/lib/outer-loop.mjs` lines 117–127 (`readProjectNumber` duplicate check)

---

## Per-Criterion Results

### Dead Code — PASS

All imports in `cron.mjs` are used. All imports in `test/cron-tick.test.mjs` are used (the previously-blocked `existsSync` unused import was removed in task-1). No commented-out code, no unreachable branches.

### Premature Abstraction — PASS

The deps injection pattern is the established codebase testing idiom. All injected deps have ≥ 7 call sites across the unit test cases. `readProjectNumber` as an injectable dep is consistent with the rest of the pattern and has 7 injection sites in tests.

### Unnecessary Indirection — PASS

`lockFile` in `util.mjs` performs real work (atomic write, stale-PID detection, timeout semantics). No pure-delegation wrappers introduced in this feature.

### Gold-Plating — PASS

No config keys with a single valid value, no feature flags, no speculative extension points. `timeout: 0` is precisely the required semantics for the "try once, don't wait" behavior.

### DRY / Duplication — WARNING

`readProjectNumber` at `cron.mjs:20–31` duplicates the private function at `outer-loop.mjs:117–127` line-for-line. Same regex (`/\/projects\/(\d+)/`), same null-safety, same return type. The only structural difference: `cron.mjs` accepts `cwd` and derives `teamDir` internally; `outer-loop.mjs` accepts `teamDir` directly. If the parsing logic changes (e.g., org-owned project URLs have a different path), both must be updated in lockstep.

---

## Simplicity Findings

🟡 `bin/lib/cron.mjs:20` — `readProjectNumber` duplicates `outer-loop.mjs:117`; extract to `util.mjs` or `github.mjs` before a third caller appears

🔵 `bin/lib/cron.mjs:57,70` — `PROJECT.md` parsed twice per invocation (`readTrackingConfig` + `readProjectNumber`); consider combining reads if performance matters at scale

---

# Architect Review: cron-based-outer-loop / task-3

**Reviewer role:** Software Architect
**Date:** 2026-04-26
**Handshake run:** run_1
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-3/handshake.json`
- `bin/lib/cron.mjs` (full, 130 lines)
- `bin/lib/util.mjs` (lines 83–166 — `isPidAlive`, `lockFile`)
- `test/cron-tick.test.mjs` (full, 449 lines)
- `.team/features/cron-based-outer-loop/tasks/task-1/eval.md` (all prior review sections)
- `.team/features/cron-based-outer-loop/tasks/task-2/eval.md` (all prior review sections)
- `.gitignore` (root — searched for lock/cron entries, found none)

Live test run: `node --test test/cron-tick.test.mjs` — **16 tests, 0 failures**.

---

## Per-Criterion Results

### 1. Handshake claim: CLI integration test added — PASS

Builder claimed a CLI integration test at `test/cron-tick.test.mjs` that pre-creates a lock
file owned by the live test-runner PID and asserts `agt cron-tick` exits 0 with "already
running". Verified directly at lines 408–447. Test:

- Writes `.team/.cron-lock.lock` with `pid: process.pid` — since the test runner is alive,
  `isPidAlive(pid)` at `util.mjs:115` returns `true`, so `lockFile` sees a live holder and
  returns `{ acquired: false }` at `util.mjs:121`.
- Spawns `agt cron-tick` as a real subprocess via `execFileSync`.
- Asserts `exitStatus === 0` and `output.includes("already running")`.

Both assertions confirmed by live test run. The test exercises the real `lockFile`
implementation with filesystem I/O — not a stub.

### 2. Implementation at cron.mjs:76-82 — PASS

`timeout: 0` sets `deadline = Date.now() + 0`. When a live lock holder exists,
`Date.now() >= deadline` is satisfied immediately, returning `{ acquired: false, holder }`.
The bail-out happens before the `try` block (lines 84–129), so the `finally` at line 128 is
never reached from this path — no `release()` call on a non-acquired lock, no crash.

### 3. Lock atomicity — PASS

`lockFile` uses `writeFileSync(lockPath, ..., { flag: "wx" })` (O_CREAT|O_EXCL) at
`util.mjs:134`. Atomic exclusive-create: two concurrent processes racing to acquire will have
exactly one succeed and one get EEXIST. No TOCTOU window.

### 4. Stale lock recovery — PASS

`util.mjs:115–118`: if the lock holder PID is dead (`!isPidAlive(holder.pid)`), the lock file
is deleted and the loop continues. With `timeout: 0` this still works — a dead lock on the
first iteration causes deletion + retry, which succeeds without waiting. Correct behavior.

### 5. Lock lifecycle correctness — PASS

Pre-flight checks (lines 57–74) all exit before lock acquisition. Lock only acquired at
line 78, after all guard conditions pass — no pre-flight failure can leak a lock.
Non-acquired path: `process.exit(0)` at line 81 short-circuits before `try` — `finally`
not reached, no lock was held to release.
Acquired path: lock released via `finally` at line 128 unconditionally on all other paths.

### 6. Test design — PASS

Using `process.pid` (live test-runner PID) as the simulated lock holder is the correct
approach: deterministically live on every platform, no background process needed, no timing
races. The full-stack CLI subprocess validates end-to-end wiring
(agt.mjs routing → cmdCronTick → lockFile → process.exit).

### 7. `readProjectNumber` duplication — CARRY FORWARD (escalated severity)

`cron.mjs:20–31` duplicates `outer-loop.mjs:117–127` line-for-line (same regex, same
null-safety, same return type). Flagged as 🟡 by Simplicity review above. From an
architectural lens: this is now two callers of identical logic in different modules, with no
shared home. The natural home is `github.mjs` (already owns all PROJECT.md parsing) or
`util.mjs`. Prior reviews noted this as a suggestion; with a second confirmed duplicate it
warrants a backlog entry.

### 8. Prior backlog items — CARRY FORWARD UNCHANGED

From task-1 and task-2 reviews:
- `github.mjs:275` — `setProjectItemStatus` re-reads `PROJECT.md` via implicit `process.cwd()`; silent false under worktree/cwd mismatch
- `github.mjs:266-267` — redundant full item-list refetch per status transition
- `cron.mjs:134` — `cmdCronSetup` uses `process.argv[1]` for agt path; fragile under npx/symlink
- `cron.mjs:111` — if `runSingleFeature` calls `process.exit` synchronously, `catch` and `finally` don't run; item stranded in "In Progress"
- `cron.mjs:124` — `_commentIssue` not try-caught inside `catch(err)`
- `cron.mjs:111` — issue number not forwarded to `runSingleFeature`

None introduced or resolved by task-3.

---

## Findings

🟡 `.gitignore` (root) — `.team/.cron-lock.lock` is a runtime artifact but is not gitignored; a cron-tick process killed mid-run (SIGKILL, OOM) leaves the lock file visible in `git status` until the next tick's stale-PID cleanup runs — add `.team/.cron-lock.lock` to `.gitignore`

🟡 `bin/lib/cron.mjs:20` — `readProjectNumber` is an exact duplicate of `outer-loop.mjs:117`; two callers of the same regex with no shared home — extract to `github.mjs` (which already owns all PROJECT.md parsing) before a third caller appears (escalation of prior 🔵 suggestion now that both copies are confirmed)

🔵 `bin/lib/cron.mjs:128` — `lock.release()` called unconditionally in `finally` but `lock.release` is `undefined` on non-acquired lock objects; safe today because `process.exit(0)` at line 81 always fires or throws before `try` is entered, but a future test mocking `process.exit` as a no-op would crash here — use `lock.release?.()` to make this structurally safe

---

## Edge Cases Checked

- Concurrent processes: second exits 0 with "already running" ✅ (CLI integration test, live run)
- Stale lock (dead PID): cleaned up and lock acquired ✅ (structurally verified via `util.mjs:115-118`)
- Lock not released on non-acquired path: `process.exit(0)` before `try` — no release needed ✅
- Pre-flight failure does not leak lock: all guard exits precede lock acquisition at line 78 ✅
- `timeout: 0` with live holder: first iteration hits `Date.now() >= deadline` immediately ✅

---

## Summary

The implementation is architecturally sound. Advisory file-based locking with O_CREAT|O_EXCL
is the correct primitive for a CLI scheduler — atomic, portable, and self-cleaning via PID
liveness. The `timeout: 0` pattern correctly implements "try once, bail immediately" without
spin-waiting. Task-3's CLI integration test closes the last coverage gap on the concurrent
path.

Two new findings: the lock file is not gitignored (🟡, low operational impact but will show
in `git status` after crashes), and `readProjectNumber` is now a confirmed duplicate across
two modules (🟡, extract to `github.mjs` before a third copy appears). The `lock.release?.()` 
defensive fix (🔵) eliminates a latent crash mode. Neither 🟡 blocks merge.
