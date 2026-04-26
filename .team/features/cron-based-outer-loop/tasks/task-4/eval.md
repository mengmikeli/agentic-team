# Tester Eval — task-4: cron-tick failure path reverts to Ready and comments issue

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json`
- `bin/lib/cron.mjs` (full, 154 lines)
- `test/cron-tick.test.mjs` (full, 449 lines)
- `bin/lib/github.mjs` (full, ~294 lines)

---

## Tests Run

```
node --test test/cron-tick.test.mjs
ℹ tests 16 | pass 16 | fail 0 | skipped 0
```

All 16 tests pass. Run directly, not taken from the handshake.

---

## Per-Criterion Results

### CR1: runSingleFeature failure reverts board item to "Ready"

**PASS** — `cron.mjs:120` calls `_setProjectItemStatus(issueNumber, projectNumber, "ready")` inside `catch(err)`. Test at `cron-tick.test.mjs:217` asserts `statusTransitions.some(t => t.issueNumber === 5 && t.status === "ready")`. Test passes.

### CR2: failure posts a comment to the GitHub issue

**PASS** — `cron.mjs:124` calls `_commentIssue(issueNumber, \`cron-tick failed: ${err.message || String(err)}\`)`. Test at `cron-tick.test.mjs:219-220` asserts `comments.some(c => c.issueNumber === 5 && c.body.includes("agent exploded"))`. Test passes.

### CR3: in-progress transition before run, revert after failure

**PASS** — Test at `cron-tick.test.mjs:215-218` verifies both `in-progress` and `ready` transitions exist on issue #5. Sequential structure of `cron.mjs:105-126` enforces ordering.

### CR4: lock released unconditionally on failure path

**PASS** — `cron.mjs:127-129` uses `finally { lock.release(); }` wrapping both success and failure paths.

---

## Coverage Gaps

### 🟡 Title sanitization is a documented security control with zero test coverage

`cron.mjs:100` explicitly comments "Sanitize title: strip newlines and control chars to prevent prompt injection", but no test passes a title with `\n`, `\r`, or other control characters to verify the replace-and-truncate logic.

### 🟡 No test for revert+comment when revert call throws

`cron.mjs:120-124` calls `_setProjectItemStatus` then `_commentIssue` bare inside the `catch(err)` block. If `_setProjectItemStatus` throws, `_commentIssue` is never called. If `_commentIssue` throws, the original `err` is silently swallowed. The production implementations in `github.mjs` both wrap `spawnSync` in try/catch and return false rather than throwing, so production is safe today — but the failure path is fragile and untested for the throwing case.

### 🔵 No CLI integration test for the failure/revert/comment path

The three CLI integration tests cover: missing PROJECT.md, missing tracking config, and concurrent locking. None exercises a subprocess where a feature run fails and triggers the revert+comment. Unit tests cover the behavior; the CLI wiring for this specific path has no subprocess coverage.

### 🔵 No guard for null/undefined issueNumber on a board item

If `listProjectItems` returns an item where `issueNumber` is null (malformed GitHub API response), cron-tick logs `dispatching issue #undefined` and proceeds. Real `setProjectItemStatus` guards on `!issueNumber`, so no crash — but the item is silently skipped with no explicit rejection.

---

## Findings

🟡 `bin/lib/cron.mjs:100` — Title sanitization documented as anti-injection security control but has zero test coverage; add tests for titles with `\n`, `\r`, control chars, and strings >200 chars

🟡 `bin/lib/cron.mjs:120-124` — `_setProjectItemStatus` and `_commentIssue` called bare inside `catch(err)`; if either throws, original error is swallowed and comment may be skipped; add test coverage and consider a try/catch fallback around the comment call

🔵 `test/cron-tick.test.mjs:356` — No CLI integration test for the failure/revert/comment path; add a subprocess test where a feature run fails and assert cron-tick exits 0 with the expected side effects

🔵 `bin/lib/cron.mjs:97` — No early guard for null/undefined issueNumber on board items; add an explicit check before dispatching

---

## Summary

**Verdict: PASS**

---

# Engineer Eval — task-4 (cron-tick failure path: revert to Ready + comment)

**Reviewer role:** Software Engineer
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json`
- `bin/lib/cron.mjs` (154 lines, full)
- `test/cron-tick.test.mjs` (449 lines, full)
- `bin/lib/github.mjs` (`commentIssue`, `runGh` implementation)
- `bin/agt.mjs` (CLI wire-up for cron-tick)

---

## Correctness

### Failure path — PASS

`cron.mjs:118–126`: the inner `catch(err)` on `runSingleFeature` calls `setProjectItemStatus(..., "ready")` then `commentIssue(...)`. Both are injected via `deps`, enabling deterministic unit testing.

Test `cron-tick.test.mjs:193–221` verifies all three outcomes from a single thrown error:
- `status === "in-progress"` was recorded before dispatch
- `status === "ready"` was recorded after failure
- `comments` body contains the error message

Code path traced; logic is correct for the specified requirement.

### Lock release under failure — PASS

`cron.mjs:127–129`: the outer `try/finally` guarantees `lock.release()` runs even when the inner `catch` executes. `runGh` (and therefore `commentIssue`/`setProjectItemStatus`) catches all exceptions internally and returns null — neither call can throw and bypass the finally in production.

### Error message content — PASS

`cron.mjs:124`: `err.message || String(err)` handles both `Error` instances and non-Error throws. Safe.

---

## Error Handling

### `setProjectItemStatus` failure is warned — PASS

`cron.mjs:121–123`: return value checked; `console.warn` emitted on false. Operator-visible.

### `commentIssue` failure is silently swallowed — WARNING

`cron.mjs:124`: return value of `_commentIssue` is not checked. Both `setProjectItemStatus` calls (lines 106–108, 114–116) check their return and warn on false; `commentIssue` does not. If the GH API call fails (expired token, rate limit), the operator gets no indication. `runGh` never throws (wraps `spawnSync` in try/catch), so this is a silent false-return scenario only — not a safety risk, but an observability gap.

---

## Edge Cases Checked

| Case | Covered? | Where |
|---|---|---|
| No ready items | Yes | `cron-tick.test.mjs:70` |
| Lock already held | Yes | `cron-tick.test.mjs:97` |
| Successful dispatch (in-progress → done) | Yes | `cron-tick.test.mjs:129` |
| Board API returns false (warning) | Yes | `cron-tick.test.mjs:166` |
| runSingleFeature throws (revert + comment) | Yes | `cron-tick.test.mjs:193` |
| Missing tracking config | Yes | `cron-tick.test.mjs:225` |
| Missing project number | Yes | `cron-tick.test.mjs:247` |
| Missing "ready" option ID | Yes | `cron-tick.test.mjs:277` |
| Revert itself returns false | Not tested | — |

The "revert returns false" case is the only uncovered gap: the item strands in "in-progress" with a warning but no further recovery. Not blocking given the warning is present.

---

## Findings

🟡 `bin/lib/cron.mjs:124` — `_commentIssue` return value not checked; a failed comment (GH auth, rate limit) is silently swallowed unlike `setProjectItemStatus`. Add: `if (!_commentIssue(issueNumber, msg)) console.warn("cron-tick: warning — failed to comment on issue #" + issueNumber)`.

**Engineer Verdict: PASS**

---

# Architect Eval — task-4: failure-revert behavior

**Reviewer role:** Software Architect
**Date:** 2026-04-26
**Handshake run:** run_1
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json`
- `.team/features/cron-based-outer-loop/tasks/task-3/eval.md` (all prior review sections)
- `bin/lib/cron.mjs` (full, 154 lines)
- `test/cron-tick.test.mjs` (full, 449 lines)
- `bin/lib/github.mjs` (lines 215–294: `commentIssue`, `listProjectItems`, `setProjectItemStatus`)
- `bin/lib/util.mjs` (lines 82–166: `lockFile`)

---

## Per-Criterion Results

### 1. Failure-revert implementation (cron.mjs:118-126) — PASS

Inner catch block:
- Line 120: `_setProjectItemStatus(issueNumber, projectNumber, "ready")` — reverts board item
- Lines 121-123: logs warning if revert fails (non-fatal, correct)
- Line 124: `_commentIssue(issueNumber, ...)` — posts failure comment
- Line 125: `console.error` logs the failure

Sequence is correct: revert before comment. `issueNumber` and `projectNumber` are in-scope from
the outer closure. The `finally` at line 127 releases the lock unconditionally on all paths
from the catch block, including if `_commentIssue` itself throws.

### 2. Unit test at cron-tick.test.mjs:193-221 — PASS

Test "reverts to ready and comments on failed dispatch":
- `runSingleFeature: async () => { throw new Error("agent exploded") }` forces the failure path
- `setProjectItemStatus` spy records all `{ issueNumber, projectNumber, status }` transitions
- `commentIssue` spy records all `{ issueNumber, body }` calls
- Assertions at lines 215-220 verify: "in-progress" transition occurred, "ready" revert occurred,
  comment body contains error message

All three assertions structurally correct. Test directly exercises `cron.mjs:118`.

### 3. Pre-flight guard for Ready option ID (cron.mjs:64) — PASS

`cron.mjs:64` checks `tracking.statusOptions["ready"]` and exits 1 if absent, before lock
acquisition or dispatch. This guarantees the revert path always has a resolvable option ID.
`setProjectItemStatus` at `github.mjs:277` also checks `optionId` and returns false if missing —
two defense layers.

### 4. Lock lifecycle on failure path — PASS

`runSingleFeature` throws → inner catch runs (revert + comment) → outer `finally` runs
(`lock.release()`) → lock file deleted. No lock leak on the failure path. Traced via the
try/catch/finally nesting at `cron.mjs:84-129`.

### 5. Split config ownership (github.mjs:275) — CARRY-FORWARD

`setProjectItemStatus` at `github.mjs:275` calls `readTrackingConfig()` with no arguments —
implicit `process.cwd()`. The pre-flight in `cron.mjs:57` uses `_readTrackingConfig(join(cwd, ".team", "PROJECT.md"))` —
explicit path. If `process.cwd()` diverges from the project root, the revert silently returns
false while pre-flight passes. Not introduced by task-4.

---

## New Architectural Finding

### Stranded "in-progress" items when process is killed

If cron-tick is killed (SIGKILL, OOM) while `runSingleFeature` is running:
- Lock file is cleaned up by the next tick's stale-PID detection (`util.mjs:115-118`).
- Board item **stays "in-progress" permanently**. `cron.mjs:89` filters for `"ready"` only,
  so the stranded item is invisible to the scheduler indefinitely.

The lock has a dead-man recovery mechanism; the board state does not. A future task should add
a pre-flight step: detect "in-progress" items with no active cron-tick lock and revert them to
"ready" before processing new items.

---

## Carry-Forward Items (unchanged from prior reviews)

- `bin/lib/cron.mjs:124` — `_commentIssue` not wrapped in try-catch inside catch(err)
- `bin/lib/cron.mjs:111` — `issueNumber` not forwarded to `_runSingleFeature`
- `bin/lib/cron.mjs:128` — `lock.release()` unconditional; `lock.release?.()` safer
- `bin/lib/github.mjs:275` — `readTrackingConfig()` called with implicit `process.cwd()`
- `bin/lib/cron.mjs:20` — `readProjectNumber` duplicates `outer-loop.mjs:117` line-for-line

---

## Edge Cases Checked

- `runSingleFeature` throws → revert to ready + comment + log ✅ (cron.mjs:118-126, test:193-221)
- `setProjectItemStatus` returns false on revert → warning logged, continues ✅ (cron.mjs:121-123)
- Lock released after failure path ✅ (outer finally at cron.mjs:127)
- Pre-flight exits 1 when "ready" option not configured ✅ (cron.mjs:64, test:277)
- Process killed mid-run → board item stranded "in-progress" ⚠️ (no recovery mechanism)

---

## Findings

🟡 `bin/lib/cron.mjs:89` — No "in-progress" stale-item recovery: if cron-tick is SIGKILL'd while a feature runs, the board item stays "in-progress" indefinitely; the lock has stale-PID recovery (`util.mjs:115`) but board state does not — add a pre-flight step that detects "in-progress" items with no live cron-tick lock and reverts them to "ready"

🔵 `test/cron-tick.test.mjs:193` — Failure test uses `setProjectItemStatus: () => true`; the warning branch at `cron.mjs:121-123` (revert returns false) has no test coverage

---

## Summary

Implementation is architecturally correct for the "agent throws" failure path. The catch block
properly sequences board revert → issue comment → lock release. The unit test directly exercises
the code path with appropriate spies. No critical findings.

Primary architectural gap: board state has no equivalent of the lock's stale-PID recovery.
A SIGKILL'd cron-tick leaves the board inconsistent in a way that only human intervention or
a future recovery step can resolve. Backlog item warranted; does not block merge.

**Architect Verdict: PASS**
