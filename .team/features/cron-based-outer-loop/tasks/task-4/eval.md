# Tester Eval — task-4 (run_2): commentIssue guard + title sanitization coverage

**Reviewer role:** Tester
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json`
- `bin/lib/cron.mjs` (full, 162 lines)
- `test/cron-tick.test.mjs` (full, 554 lines)
- `bin/lib/github.mjs` (function signatures — `listProjectItems`, `setProjectItemStatus`, `commentIssue`, `readTrackingConfig` — all synchronous)
- `bin/agt.mjs` (cron-tick wire-up at line 72)

## Tests Run

```
node --test test/cron-tick.test.mjs
ℹ tests 20 | pass 20 | fail 0 | skipped 0
```

Executed directly. Builder claimed 549 total suite tests; cron-tick suite is 20/20. Task-4 added 4 new tests to the prior 16:
- "warns when commentIssue returns false on dispatch failure" (line 224)
- "swallows commentIssue throw and preserves original error log" (line 249)
- "strips newlines and control chars from issue title" (line 281)
- "truncates issue title to 200 characters" (line 305)

All 4 pass and directly exercise the claimed changes.

---

## Per-Criterion Results

### CR1: commentIssue wrapped in try-catch — PASS

`cron.mjs:125-132`: `_commentIssue` is inside `try { } catch (commentErr) { console.warn(...) }`.
Test at line 249 verifies: `commentIssue: () => { throw new Error("GH auth error") }` → original error in `console.error`, comment error in `console.warn`. ✅

### CR2: commentIssue false return emits console.warn — PASS

`cron.mjs:127-129`: `if (!commented) console.warn(...)`.
Test at line 224 verifies: `commentIssue: () => false` → `warns.some(w => w.includes("failed to comment"))`. ✅

### CR3: Title sanitization — PASS

`cron.mjs:100`: `.replace(/[\r\n\x00-\x1f\x7f]/g, " ").trim().slice(0, 200)`.
Test at line 281 passes a title with `\r`, `\n`, `\x01`, `\x1f` and asserts all control chars removed. ✅
Test at line 305 passes a 300-char title and asserts `length <= 200`. ✅

### CR4: lock.release() in finally — PASS (logic only, no spy)

`cron.mjs:135-137`: outer `try/finally` releases lock unconditionally. Code path traced; correct.
Gap: no test spies on `release()` to assert it is actually invoked — see findings.

---

## Coverage Gaps

### 🟡 Console mocks not restored in try/finally — test pollution risk

Tests at lines 70, 166, 224, and 249 set `console.log/warn/error` to a stub inline, then restore **after** `await cmdCronTick()`. If `cmdCronTick` throws unexpectedly, the restore never runs and the mock leaks into subsequent tests.

### 🟡 lock.release() is never spied or asserted

Every test mocks `lockFile: () => ({ acquired: true, release: () => {} })` with a no-op. No test asserts that `release()` was actually called. The `finally` block at `cron.mjs:135` is the critical lock-cleanup path — exercised by code, not verified by any assertion.

### 🔵 No test for all-control-char title (empty after sanitization)

`cron.mjs:100`: if `item.title` is `"\x01\x02\x03"`, after replace+trim the result is `""`. `runSingleFeature` is called with an empty string. No test covers this.

### 🔵 Revert-returns-false path in failure scenario — carry-forward

`cron.mjs:122-124`: warning when `setProjectItemStatus` returns false during revert. The failure test at line 193 uses `setProjectItemStatus: () => true`, so this warning branch has no coverage.

---

## Findings

🟡 `test/cron-tick.test.mjs:90,185,243,271` — `console.log/warn/error` restored inline after `await`, not in a `try/finally`; an unexpected throw leaves the mock active for subsequent tests — move restores to `afterEach` or wrap in `try/finally`

🟡 `test/cron-tick.test.mjs:86,103,134,176,199,237,262,286,314` — `lock.release` stub has no spy; the `finally` at `cron.mjs:135` is never asserted to execute — add a spy and assert `release` was called in success and failure tests

🔵 `bin/lib/cron.mjs:100` — No test for title composed entirely of control characters (empty string after sanitization); verify `runSingleFeature` handles `""` or add a guard

🔵 `test/cron-tick.test.mjs:205` — Failure test uses `setProjectItemStatus: () => true`; `cron.mjs:122-124` warning path when revert returns false has no coverage (carry-forward from prior Architect eval)

---

## Summary

**Verdict: PASS**

Task-4 correctly closes both prior 🟡 findings (commentIssue not wrapped, return value not checked) and adds title-sanitization test coverage. All 20 tests pass. Two new 🟡 backlog items: console mock cleanup and lock.release() assertion.

---

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

---

# Simplicity Review — task-4: cron-tick failure path reverts to Ready and comments issue

**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26
**Handshake run:** run_2
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json`
- `bin/lib/cron.mjs` (full, 161 lines)
- `test/cron-tick.test.mjs` (full, 553 lines)
- `bin/lib/github.mjs` (lines 215–254: `commentIssue`, `listProjectItems`)
- `bin/lib/outer-loop.mjs` (lines 115–127: `readProjectNumber`)

---

## Four Veto Categories

### 1. Dead Code — PASS

No dead code in task-4 changes. All new code paths are reachable and tested:
- `cron.mjs:125-132` (try/catch around `_commentIssue`): exercised by test 4c (commentIssue throws) and title sanitization tests.
- `cron.mjs:127-129` (`if (!commented)` warn branch): exercised by test 4b (commentIssue returns false).
- All four new tests (4b, 4c, 4d×2) run and pass per gate output.

### 2. Premature Abstraction — PASS

No new abstractions introduced. The deps injection pattern was established in prior tasks and `_commentIssue` is exercised at ≥5 distinct test call sites.

### 3. Unnecessary Indirection — PASS

The nested try/catch at `cron.mjs:125-132` performs real work: it prevents a throwing `_commentIssue` from propagating into the outer catch and swallowing `err`. Not a wrapper — it is error isolation with observability (`console.warn`).

### 4. Gold-Plating — PASS

No config options, feature flags, or speculative extensibility. Both the try/catch and return-value check are exercised by distinct failing tests today.

---

## Additional Complexity Review

### `readProjectNumber` duplication — carry-forward 🟡

`cron.mjs:20-31` and `outer-loop.mjs:117-127` are near-identical: same regex, same try/catch, same return contract. Param differs only in name (`cwd` vs `teamDir`) and path construction. If the project URL regex changes, both copies need updating. Pre-existing, not introduced by task-4.

### Inline `TRACKING_CONFIG` duplicate in test — 🔵

`test/cron-tick.test.mjs:354-363` inlines a full tracking-config object identical to the shared `TRACKING_CONFIG` constant at lines 23-31. Pre-existing duplication. The four new task-4 tests correctly use the shared constant.

### Asymmetric error shielding in catch block — 🔵

`cron.mjs:121` calls `_setProjectItemStatus` bare; `cron.mjs:125-132` wraps `_commentIssue` in try/catch. In production both are safe (`runGh` never throws). But an injected stub that throws at line 121 would skip `_commentIssue` and propagate out of the catch block — a surprising contract difference. Task-4 intentionally fixed only the comment side; the asymmetry is a hidden trap for future test authors.

---

## Findings

🟡 `bin/lib/cron.mjs:20` — `readProjectNumber` duplicates `outer-loop.mjs:117` body-for-body; extract to a shared utility to avoid split maintenance for the project-URL regex

🔵 `test/cron-tick.test.mjs:354` — inline tracking config duplicates `TRACKING_CONFIG` at line 23; use the shared constant

🔵 `bin/lib/cron.mjs:121` — `_setProjectItemStatus` in the catch block is bare while `_commentIssue` (line 125) is wrapped in try/catch; document or equalize the shielding contract so future test authors don't assume both are guarded

---

## Summary

Task-4 changes are minimal and proportional: a single nested try/catch (~8 lines) and four targeted tests. No veto-category violations. The `readProjectNumber` duplication is a pre-existing maintenance hazard worth a follow-up but does not block merge.

**Simplicity Verdict: PASS**

---

# Security Eval — task-4: cron-tick failure path reverts to Ready and comments issue

**Reviewer role:** Security Specialist
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json`
- `bin/lib/cron.mjs` (full, 161 lines)
- `test/cron-tick.test.mjs` (full, 553 lines)
- `bin/lib/github.mjs` — `commentIssue` (line 219), `runGh` (line 8), `setProjectItemStatus` (line 258), `listProjectItems` (lines 243-254)

---

## Threat Model

Adversary: an attacker who controls GitHub issue titles (any user with write access to the repo, or read access if issues are public). Attack surface: the `title` field from `listProjectItems` is used as a prompt to `runSingleFeature`, making it the primary injection vector.

Secondary surface: error messages from `runSingleFeature` are posted back to the originating issue as a comment via `commentIssue`.

---

## Per-Criterion Results

### Shell injection via `gh` CLI arguments — PASS

`runGh` at `github.mjs:8` uses `spawnSync("gh", args, ...)` with arguments as an array and no shell. All values (`issueNumber`, `body`, `projectNumber`) are passed as separate array elements. Shell metacharacters in these values cannot cause injection. Safe.

### Prompt injection via issue title — PARTIAL

`cron.mjs:100` sanitizes the title with:
```js
(item.title || "").replace(/[\r\n\x00-\x1f\x7f]/g, " ").trim().slice(0, 200)
```
This correctly strips ASCII control characters (U+0000–U+001F) and DEL (U+007F). However, it misses three Unicode characters that LLMs commonly treat as line breaks:
- U+0085 NEL (Next Line)
- U+2028 Line Separator
- U+2029 Paragraph Separator

A title containing `U+2028` or `U+2029` passes through unsanitized and lands in the LLM prompt as a structural line break. The code's own comment ("to prevent prompt injection") establishes this as an intentional security control — the control is incomplete.

### `err.message` as GitHub comment body — PASS (low residual risk noted)

`cron.mjs:126`: `_commentIssue(issueNumber, \`cron-tick failed: ${err.message || String(err)}\`)` posts the error message as a GitHub comment. `commentIssue` calls `runGh` with array args — no shell injection. The comment goes to the originating issue only, so blast radius is limited. No critical concern; noted as suggestion below.

### Lock prevents concurrent dispatch — PASS

`cron.mjs:77-82`: advisory lock with `timeout: 0` (try-once). A second concurrent process exits 0 cleanly without dispatching. Verified by test `cron-tick.test.mjs:97` and CLI integration test at line 513.

### `commentIssue` exception containment — PASS

`cron.mjs:125-131`: `_commentIssue` is wrapped in a dedicated `try/catch`. A throwing comment call cannot swallow the original `runSingleFeature` error. The original error is logged via `console.error` after the comment block. Tests at lines 249-278 verify both the throwing case and the false-return case.

### `cmdCronSetup` cron line construction — PASS

`cron.mjs:154`: `quotePath` single-quotes all user-controlled paths and escapes embedded single quotes with `'\\''`. `process.env.PATH`, `cwd`, and `agtPath` are all single-quoted before being written into the cron line. The output is printed for user review before being copy-pasted into crontab — no automatic execution.

---

## Findings

🟡 `bin/lib/cron.mjs:100` — Title sanitization misses Unicode line separators U+2028 (Line Separator) and U+2029 (Paragraph Separator), which LLMs treat as structural newlines and are valid prompt-injection characters; extend the regex character class to include `\u0085\u2028\u2029`

🔵 `bin/lib/cron.mjs:126` — `err.message` from `runSingleFeature` is posted verbatim as a GitHub comment; if the run surfaces agent-generated text in its error message, that LLM output lands on the issue unchecked — limited blast radius (same issue only) but creates an indirect reflection path

---

## Summary

**Verdict: PASS**

The primary attack surface (issue title → LLM prompt) is partially sanitized: ASCII control characters are stripped but three Unicode newline equivalents (U+0085, U+2028, U+2029) are not. The gap is real and the code's own comment identifies this as an intentional security control, so the incomplete coverage is a genuine finding. It does not block merge — the risk is narrow and the fix is a one-line regex change — but it warrants a backlog item.

All GitHub API interactions use `spawnSync` with array arguments; no shell injection is possible. Lock, error-containment, and comment-failure handling are all correct and tested.

**Security Verdict: PASS**

---

# Architect Eval — task-4: run_2 (comment-guard hardening)

**Reviewer role:** Software Architect
**Date:** 2026-04-26
**Handshake run:** run_2
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json` (run_2)
- `bin/lib/cron.mjs` (full, 162 lines)
- `test/cron-tick.test.mjs` (full, 553 lines)
- `bin/lib/github.mjs` (commentIssue, setProjectItemStatus, readTrackingConfig)
- `bin/lib/util.mjs` (lockFile implementation)
- `bin/lib/run.mjs` (runSingleFeature signature and flag parsing)

---

## Tests Run

```
node --test test/cron-tick.test.mjs
tests 20 | pass 20 | fail 0
```

Verified directly. Builder claimed 549 total; gate output matches.

---

## Per-Criterion Results

### run_2 task: wrap _commentIssue in try-catch, check return value — PASS

Prior reviews flagged two gaps in the failure path:
1. `_commentIssue` return value not checked
2. A throwing `_commentIssue` could swallow the original run error

Both are now addressed:
- `cron.mjs:125-131` wraps `_commentIssue` in a nested try/catch
- `cron.mjs:127-129` checks the return value and emits `console.warn` on false
- `cron.mjs:131` catches throws from `commentIssue` and warns without re-throwing

Tests 4b (line 224) and 4c (line 249) exercise both new branches. Both pass.

### Title sanitization tests — PASS

Prior review flagged zero test coverage for the sanitization at `cron.mjs:100`. Four new tests added (4d, lines 281-326): control chars/newlines stripped, and 300-char title truncated to 200. Both pass.

---

## New Architectural Findings

### `args` forwarded verbatim to `runSingleFeature`

`cron.mjs:111`: `await _runSingleFeature(args, title)` passes raw CLI args from `cmdCronTick` to `runSingleFeature`. At `run.mjs:790`, `runSingleFeature` reads `--dry-run` from those args. A user calling `agt cron-tick --dry-run` silently runs features in dry-run mode with no documentation or guard.

This is a behavioral leak through parameter pass-through. Not a correctness bug in production cron invocations (which have no extra flags), but a latent footgun for debugging.

### Failure path exits 0

When `runSingleFeature` throws, `cmdCronTick` catches the error, reverts, comments, and returns normally (exit 0). The cron scheduler sees a clean exit; failure is visible only in the GitHub comment and `console.error`. Defensible design, but if the GH API is also down, the failure is entirely silent at the OS level.

---

## Findings

🟡 `bin/lib/cron.mjs:111` — `args` forwarded verbatim to `runSingleFeature`; `run.mjs:790` reads `--dry-run` from those args, so `agt cron-tick --dry-run` silently runs features in dry-run mode with no documentation or guard; pass `[]` or a filtered allowlist instead

🔵 `bin/lib/cron.mjs:133` — feature run failure exits 0; if both board revert and comment also fail (GH API down), the failure is invisible at the OS level; consider exit(1) when all side-effects fail as a future operational improvement

🔵 `bin/lib/github.mjs:275` — `setProjectItemStatus` re-reads tracking config internally via `readTrackingConfig()` with no args (implicit `process.cwd()`), duplicating the explicit path read in `cmdCronTick:57`; pass tracking as a parameter to eliminate the implicit dependency

---

## Summary

The run_2 hardening is correct: `_commentIssue` is now guarded (return-value check + nested try/catch) and four new sanitization tests fill the prior coverage gaps. All 20 tests pass (verified directly).

One new warning: `args` pass-through to `runSingleFeature` creates an undocumented flag tunnel. The two suggestions are operational/design hygiene with no correctness impact.

**Architect Verdict: PASS**

---

# PM Eval — task-4: cron-tick failure path (revert to Ready + comment issue)

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json`
- `.team/features/cron-based-outer-loop/tasks/task-3/eval.md` (all sections)
- `bin/lib/cron.mjs` (full, 162 lines)
- `test/cron-tick.test.mjs` (full, 554 lines)
- `bin/lib/github.mjs` (lines 218–222: `commentIssue`)

---

## Requirement

> `agt cron-tick` when feature run fails reverts the board item to "Ready" and comments on the GitHub issue.

No SPEC.md exists for this feature. All acceptance criteria are inferred from the task title alone.

---

## Per-Criterion Results

### CR1: Failure reverts board item to "Ready" — PASS

`cron.mjs:121`: `_setProjectItemStatus(issueNumber, projectNumber, "ready")` called inside
`catch(err)`. Test at `cron-tick.test.mjs:217` asserts
`statusTransitions.some(t => t.issueNumber === 5 && t.status === "ready")` — direct spy evidence.

### CR2: Failure posts a comment to the GitHub issue — PASS

`cron.mjs:126`: `_commentIssue(issueNumber, "cron-tick failed: ...")`. Test at
`cron-tick.test.mjs:219–220` asserts the comment is posted to the correct issue with the
error message in the body.

### CR3: Comment failure does not swallow the original error (task-4 fix) — PASS

`cron.mjs:125–132`: `_commentIssue` is wrapped in a `try/catch`. A false return emits
`console.warn` (lines 127–129); a thrown exception is warned without swallowing the original
run error (lines 130–131). Tests 4b (line 224) and 4c (line 249) verify both paths.

### CR4: Board revert precedes comment — PASS

`cron.mjs:121` (revert) executes before `cron.mjs:126` (comment). Both calls are synchronous.
Sequential structure enforces ordering.

---

## Process Gaps

### No SPEC.md

No `.team/features/cron-based-outer-loop/SPEC.md` exists. Requirements are inferred from the
task title only. No PM-approved acceptance criteria to validate against. Filed as backlog.

### No test-output.txt artifacts

Handshake claims "All 549 tests pass" but no `artifacts/test-output.txt` is stored. The gate
output provided is truncated and does not show cron-tick test results.

---

## Backlog Items (not blocking merge)

1. **Stranded in-progress on SIGKILL** — board item stays "in-progress" permanently if the
   process is killed mid-run; no recovery equivalent to the lock's stale-PID cleanup.
2. **Title sanitization misses U+2028/U+2029** — Unicode line separators bypass the
   anti-injection regex (`cron.mjs:100`); one-line fix.
3. **Raw err.message in GitHub comment** — may expose internal paths/API output in public repos.
4. **readProjectNumber duplication** — exact copy of `outer-loop.mjs:117`.
5. **.cron-lock.lock not gitignored** — visible in `git status` after a kill.

---

## Findings

🟡 `.team/features/cron-based-outer-loop/` — No SPEC.md; acceptance criteria exist only as a task title with no PM-approved requirements document — create a minimal SPEC.md for traceability

🟡 `bin/lib/cron.mjs:89` — SIGKILL mid-run leaves board item permanently "in-progress"; only graceful failures trigger revert — add pre-flight stale "in-progress" recovery (carry-forward from architect)

🟡 `bin/lib/cron.mjs:100` — Title sanitization misses Unicode line separators U+2028 and U+2029; code comment explicitly labels this as an anti-injection control — extend regex to include \u0085\u2028\u2029 (carry-forward from security)

🔵 `test/cron-tick.test.mjs` — No `artifacts/test-output.txt` stored for any task; claimed test count (549) not independently verifiable from the truncated gate output

---

## Summary

Both user-facing behaviors are implemented and tested:
1. Failed feature run reverts the board item to "Ready" (`cron.mjs:121`)
2. Comment is posted to the GitHub issue with the failure reason (`cron.mjs:126`)

Task-4 hardened the comment path with try-catch and return-value checking, closing two 🟡
carry-forward warnings. The three 🟡 backlog items do not regress currently shipped behavior.
The most operationally significant gap is the stranded in-progress board item on SIGKILL —
users relying on the board as a scheduler will need to manually revert if cron-tick is killed
mid-run.

**PM Verdict: PASS**

---

# Engineer Eval — task-4 run_2 (cron-tick: _commentIssue guard + title-sanitization tests)

**Reviewer role:** Software Engineer
**Date:** 2026-04-26
**Handshake run:** run_2
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json`
- `bin/lib/cron.mjs` (full, 162 lines)
- `test/cron-tick.test.mjs` (full, 553 lines)
- `bin/lib/github.mjs` (lines 1–60: readTrackingConfig; lines 219–294: commentIssue, listProjectItems, setProjectItemStatus)
- `bin/lib/util.mjs` (lines 90–166: lockFile, release)

---

## Claim Verification

### Claim 1: `_commentIssue` wrapped in try-catch — VERIFIED

`cron.mjs:125–132` wraps the `_commentIssue` call in its own `try/catch(commentErr)`. A throwing
comment call logs a `console.warn` and does not re-throw, so the original run error at
`cron.mjs:133` is always emitted. Test 4c at `cron-tick.test.mjs:249–278` reproduces the throw and
asserts both that `console.error` contains "run exploded" and `console.warn` contains "GH auth error".

### Claim 2: Return-value check on `_commentIssue` with console.warn — VERIFIED

`cron.mjs:127–129`: `const commented = _commentIssue(...); if (!commented) console.warn(...)`.
Test 4b at `cron-tick.test.mjs:224–246` injects `commentIssue: () => false` and asserts
`warns.some(w => w.includes("failed to comment"))`. Pattern is consistent with the
`setProjectItemStatus` warning guards at lines 106–108 and 114–116.

### Claim 3: Four new unit tests — VERIFIED

- 4b (`cron-tick.test.mjs:224`): `commentIssue` returns false → warning logged
- 4c (`cron-tick.test.mjs:249`): `commentIssue` throws → swallowed, original error preserved
- 4d-1 (`cron-tick.test.mjs:281`): title with `\r\n` and control chars → stripped
- 4d-2 (`cron-tick.test.mjs:305`): title of 300 chars → sliced to ≤200

All four test the specific behaviors introduced or fixed by run_2.

---

## Correctness

### Failure path sequencing — PASS

`cron.mjs:118–134`:
1. `_setProjectItemStatus(..., "ready")` — revert
2. `try { _commentIssue(...) } catch` — comment, non-fatal
3. `console.error(...)` — log original failure

Ordering is correct. Lock is released unconditionally in the outer `finally` at line 135. The
try-catch around `_commentIssue` ensures neither a false return nor a throw can prevent the
`console.error` log or the `finally`.

### `lock.release()` safety — PASS

`lock.release()` is called at `cron.mjs:136` inside the outer `finally`. `lockFile` only returns
a `release` function when `acquired: true` (`util.mjs:153–162`). The early-exit path for
`!lock.acquired` calls `process.exit(0)` at line 81, which either terminates the process
(production) or throws (tests), so the `try/finally` block is never entered with
`lock.acquired === false`. `lock.release()` is therefore always defined at the call site.

### Title sanitization — PASS

`cron.mjs:100`: `(item.title || "").replace(/[\r\n\x00-\x1f\x7f]/g, " ").trim().slice(0, 200)`.
Logic is correct for ASCII control chars. Tests 4d-1 and 4d-2 verify the strip and truncate
behaviors. (Unicode newlines U+0085/U+2028/U+2029 are a separate security finding already
raised by the Security eval and carried to backlog.)

---

## Edge Cases Checked

| Case | Covered? | Evidence |
|---|---|---|
| `commentIssue` returns false on failure path | Yes | test 4b, cron.mjs:127-129 |
| `commentIssue` throws on failure path | Yes | test 4c, cron.mjs:125-132 |
| Title with `\r\n` and control chars | Yes | test 4d-1, cron.mjs:100 |
| Title > 200 chars | Yes | test 4d-2, cron.mjs:100 |
| Revert (`setProjectItemStatus`) returns false | Yes | test 3b, cron.mjs:121-123 |
| Lock released on failure path | Yes | outer finally, cron.mjs:135 |
| `_setProjectItemStatus` throws inside catch | Not tested | `_commentIssue` would be skipped |

The last gap is noted by the Simplicity eval's "asymmetric error shielding" finding. Production
implementations of both functions never throw (both wrap `spawnSync` in try/catch), so not a
runtime risk today.

---

## Findings

🔵 `bin/lib/cron.mjs:86` — `_listProjectItems` is called without `await`; the real implementation is synchronous and all test fixtures are synchronous, but the dep-injection API has no JSDoc to communicate this constraint — an async injection would cause `items.filter` to throw `TypeError`; add a comment to signal the sync requirement

---

## Summary

run_2 directly addresses the two open engineer findings from the prior eval: `_commentIssue` is
now wrapped in try-catch and its return value is checked with an operator-visible warning. All
four claimed tests exist, are correctly structured, and directly exercise the code paths they
target. Failure path sequencing, lock release, and title sanitization are all correct.

**Engineer Verdict: PASS**

---

# Security Review — task-4 run_3 (cron-tick: Unicode sanitization, args fix, stale recovery)

**Reviewer role:** Security Specialist
**Date:** 2026-04-26
**Handshake run:** run_3
**Verdict: PASS**

---

## Files Actually Read

- `bin/lib/cron.mjs` (full, 179 lines)
- `bin/lib/github.mjs` (full)
- `bin/lib/run.mjs` (runSingleFeature signature and flag parsing)
- `bin/lib/util.mjs` (lockFile, isPidAlive)
- `test/cron-tick.test.mjs` (full)
- All four `handshake.json` files

---

## Threat Model

Adversary: anyone who can write GitHub issues visible to the project board (repo collaborators, or any user if issues are public). Primary vector: issue title injected into an LLM agent prompt. Secondary vector: error messages from agent runs reflected back to the originating issue.

---

## Per-Criterion Results

### 1. Title sanitization — PASS (prior finding closed)

`cron.mjs:118` now strips `\r\n\x00-\x1f\x7f\u0085\u2028\u2029`. The prior 🟡 finding about Unicode line separators (U+0085/U+2028/U+2029) is closed. Tests at `test/cron-tick.test.mjs:346-395` verify all three Unicode separators are stripped.

Residual gap: Unicode bidirectional control characters (U+200E, U+200F, U+202A–U+202E, U+2066–U+2069) are not stripped. These appear in known LLM prompt-injection obfuscation payloads. The threat is narrow (requires a crafted issue title and a sophisticated attacker) but real if the project board is accessible beyond a single developer.

### 2. Args no longer forwarded to runSingleFeature — PASS (prior finding closed)

`cron.mjs:129`: `await _runSingleFeature([], title)` — empty array confirmed. The prior 🟡 finding about `--dry-run` flag leakage is closed. Test at `cron-tick.test.mjs:177` asserts `runArgs` is `[]`.

### 3. Stale in-progress recovery — PASS

New code at `cron.mjs:88-103`. Recovery executes while holding the advisory lock (acquired at `cron.mjs:78-82`). Since only one process can hold the lock at a time, treating "in-progress" items as ownerless is correct — no TOCTOU window. The `setProjectItemStatus` call uses hardcoded `"ready"` status (no user-controlled value flows). No new attack surface.

### 4. Shell injection via gh CLI — PASS (unchanged)

All `github.mjs` calls use `spawnSync("gh", args, ...)` with an array and no `shell: true`. The `commentIssue` body at `cron.mjs:144` is passed as a positional argument — not interpolated into a shell string. No injection surface regardless of body content.

### 5. `err.message` in GitHub comment — suggestion (unchanged)

`cron.mjs:144`: `` `cron-tick failed: ${err.message || String(err)}` `` posted verbatim. In common failure modes this includes internal file paths (e.g., `Cannot create worktree for "feature": ENOENT /home/user/...`). If the repo is public or shared, internal paths are disclosed. Acceptable risk for a personal CLI tool; worth capping for shared use.

### 6. Lock file / PID recycling — acceptable

`util.mjs:89-96`: `isPidAlive` uses `process.kill(pid, 0)`. If a cron-tick dies and its PID is recycled by an unrelated process, the lock appears still held. Impact: next cron-tick exits 0 with "already running" and defers to the following interval. Not a security vulnerability — an operational nuisance bounded by one cron interval.

---

## Findings

🔵 `bin/lib/cron.mjs:118` — Unicode bidirectional control characters (U+200E, U+200F, U+202A–U+202E, U+2066–U+2069) are not stripped from the issue title before LLM prompt injection; used in known prompt-obfuscation attacks — extend the regex to include `\u200e\u200f\u202a-\u202e\u2066-\u2069`

🔵 `bin/lib/cron.mjs:144` — `err.message` posted verbatim to GitHub issues may expose internal file paths in shared/public repos — consider capping to first line and 200 chars: `(err.message || String(err)).split('\n')[0].slice(0, 200)`

---

## Summary

**Verdict: PASS**

The two previously flagged security findings are closed: Unicode line separators (U+0085/U+2028/U+2029) are now stripped, and CLI args are no longer forwarded to `runSingleFeature`. The new stale-in-progress recovery introduces no new attack surface. Two suggestions remain, both calibrated to narrow threat scenarios for a personal developer tool.

---

# Simplicity Review — task-4 (run_3): stale in-progress recovery + Unicode sanitization + empty-args fix

**Reviewer role:** Simplicity Advocate
**Date:** 2026-04-26
**Handshake run:** run_3
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json`
- `bin/lib/cron.mjs` (full, 180 lines)
- `test/cron-tick.test.mjs` (full, 727 lines)
- `bin/lib/github.mjs` (lines 38–65: `readTrackingConfig`)
- `bin/lib/outer-loop.mjs` (lines 117–127: `readProjectNumber`)
- `.team/features/cron-based-outer-loop/SPEC.md`

---

## Four Veto Categories

### 1. Dead Code — PASS

No dead code in run_3 changes. All new code paths are reachable and tested:
- `cron.mjs:91-103` (stale recovery loop): exercised by three new tests at lines 399–499.
- `cron.mjs:118` (Unicode regex extension `\u0085\u2028\u2029`): exercised by test at line 346.
- `cron.mjs:129` (`[]` instead of `args`): exercised by the successful-dispatch test assertion at line 177 (`assert.deepEqual(runArgs, [])`).

One carry-forward note: `args` at line 42 is accepted by `cmdCronTick` but never read. JSDoc says "(unused for now)". This follows the codebase calling convention for all cmd* functions and is not harmful; flagged 🔵 below.

### 2. Premature Abstraction — PASS

No new abstractions. The stale-recovery logic is 13 lines of inline iteration at `cron.mjs:91–103`. Not extracted.

### 3. Unnecessary Indirection — PASS

No new wrappers or delegates.

### 4. Gold-Plating — PASS

No new config options, feature flags, or speculative extensibility.

---

## Additional Complexity Review

### Mutation to feed downstream filter (new in run_3) — 🟡

`cron.mjs:101`: `staleItem.status = "ready"; // include in ready pool below`

The recovery loop mutates the status field of an element in the `items` array so that the filter at line 106 (`items.filter(i => i.status?.toLowerCase() === "ready")`) picks up the recovered item. This works correctly and the comment explains the intent, but the coupling is non-obvious: a reader must look 5 lines ahead to understand why the mutation happens. An explicit variable (`recoveredItems.push(staleItem); ... readyItems = [...explicitReadyItems, ...recoveredItems]`) would make the data flow visible without mutation. Not a veto violation, but a genuine complexity concern.

### `readProjectNumber` duplication — carry-forward 🟡

`cron.mjs:20-31` and `outer-loop.mjs:117-127` are body-for-body identical. Both read PROJECT.md with the same regex and the same try/catch return contract. The only difference is the parameter name (`cwd` vs `teamDir`). Not introduced by run_3; carry-forward from prior simplicity eval.

### Inline tracking config duplicate in tests — carry-forward 🔵

`test/cron-tick.test.mjs:526-535` inlines a full tracking-config object (with "ready" key) that is structurally identical to the shared `TRACKING_CONFIG` constant at lines 23-31. The "missing Ready option" test at line 556 intentionally omits "ready" and cannot use the constant. The one at line 526 could. Carry-forward from run_2.

---

## Findings

🟡 `bin/lib/cron.mjs:101` — `staleItem.status = "ready"` mutates the input array element to include recovered items in the ready pool via a filter 5 lines later; coupling is implicit — collect recovered items into an explicit variable and merge with `readyItems` to make the data flow visible

🟡 `bin/lib/cron.mjs:20` — `readProjectNumber` duplicates `outer-loop.mjs:117` body-for-body; if the project-URL regex ever changes, both copies need updating — extract to a shared utility (carry-forward, not introduced by run_3)

🔵 `bin/lib/cron.mjs:42` — `args` accepted by `cmdCronTick` but never read; SPEC guarantees flags are not forwarded — drop the "for now" annotation or remove the parameter

🔵 `test/cron-tick.test.mjs:526` — inline tracking config duplicates `TRACKING_CONFIG` constant at line 23; use the shared constant (carry-forward from run_2)

---

## Summary

Run_3 changes are minimal and proportional: inline stale-recovery logic (13 lines), a one-line regex extension, an empty-array pass-through fix, and targeted test hardening (try/finally restores, lock-release spies, three new recovery tests, one Unicode test). No veto-category violations. The mutation-feeds-filter pattern at line 101 is the only new complexity concern worth a backlog item.

**Simplicity Verdict: PASS**

---

# Engineer Eval — task-4 run_3 (stale in-progress recovery + run_2 findings)

**Reviewer role:** Software Engineer
**Date:** 2026-04-26
**Handshake run:** run_3
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json` (run_3)
- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 727 lines)
- `bin/lib/github.mjs` (lines 218–294: commentIssue, listProjectItems, setProjectItemStatus)
- Prior eval sections for run_1 and run_2 (all roles)

---

## Tests Run

```
node --test test/cron-tick.test.mjs
ℹ tests 24 | pass 24 | fail 0
```

Executed directly. 24 tests = 20 from run_2 + 3 stale-recovery + 1 Unicode sanitization. All pass.

---

## Claim Verification (run_3 handshake)

### Claim 1: Empty array passed to `runSingleFeature` — VERIFIED

`cron.mjs:129`: `await _runSingleFeature([], title)` — empty array, not the forwarded `args`.
Test at `cron-tick.test.mjs:177`: `assert.deepEqual(runArgs, [], "runSingleFeature must be called with empty args")`. ✅
Prior architect finding (--dry-run flag leakage) is closed.

### Claim 2: Unicode line separators added to title sanitization regex — VERIFIED

`cron.mjs:118`: `.replace(/[\r\n\x00-\x1f\x7f\u0085\u2028\u2029]/g, " ")` — U+0085, U+2028, U+2029 present.
New test at `cron-tick.test.mjs:346–370` passes title `"Inject\u0085NEL\u2028LS\u2029PS"` and asserts all three are stripped. ✅
Prior security finding is closed.

### Claim 3: Stale in-progress recovery pre-flight — VERIFIED

`cron.mjs:88–103`: filters items for "in-progress"/"in progress" (case-insensitive), calls `_setProjectItemStatus(..., "ready")` on each, logs warning on failure, and mutates `staleItem.status = "ready"` on success so the item enters the ready pool below.
Three new tests at lines 399–499 cover: mixed stale+ready (stale reverted, run called), only-stale (reverted → dispatched), stale revert failure (warning, no dispatch).
The mutation at line 101 is the bridge between recovery and re-dispatch — traced correctly. ✅

### Claim 4: Console mock restores and lock.release() spies — VERIFIED

All tests that set `console.log/warn/error` now restore via `try {} finally {}`:
- Line 98–103 (no ready items) ✅
- Lines 206–210 (board API warning) ✅
- Lines 271–274 (commentIssue false) ✅
- Lines 304–309 (commentIssue throws) ✅
- Lines 487–492 (stale revert warning) ✅

All acquired-lock tests use `makeLockSpy()` and assert `lockSpy.releaseCalls === 1`. Tests 5–7 (early-exit via `process.exit(1)`) are correctly exempted — `lockFile` is never called in those paths because pre-flight guards at lines 58–74 run before `lockFile` at line 78. ✅

---

## Correctness

### Stale recovery → ready pool interaction — PASS

`inProgressItems` at line 91 is a filtered snapshot of `items`. The `for...of` loop at line 95 mutates `staleItem.status = "ready"` on the shared object, which is also referenced in `items`. When `readyItems` is computed at line 106 from `items`, the recovered stale items appear as "ready". Recovered items appearing before other ready items in the original array are dispatched first (FIFO from board order). Logic is correct; test at line 431 traces this exact path.

### Recovered-then-dispatched item sequencing — PASS

For the only-stale case (test line 431): stale item is first reverted to "ready" via `_setProjectItemStatus(..., "ready")`, then picked up by `readyItems`, then transitions to in-progress via `_setProjectItemStatus(..., "in-progress")`, then runs, then transitions to "done". Three calls to `setProjectItemStatus` for the same issue. Test records all transitions and asserts all three statuses. ✅

### `lock.release()` safety — PASS (carry-forward: still holds)

Lock is acquired at line 78 only when `!lock.acquired` is false (meaning lock IS acquired). `process.exit(0/1)` paths at lines 61, 66, 73, 81 are all before the `try` block at line 84. `lock.release()` at line 154 is inside the outer `finally`, unconditional. ✅

---

## Edge Cases Checked

| Case | Covered? | Evidence |
|---|---|---|
| Stale item + ready items present | Yes | test line 399 |
| Only stale item (no independent ready) | Yes | test line 431 |
| Stale revert fails (returns false) | Yes | test line 468 |
| Stale item reverted, still gets dispatched first | Yes | test line 431 (traced above) |
| `runSingleFeature` receives empty args | Yes | test line 177 |
| Title with U+0085 / U+2028 / U+2029 | Yes | test line 346 |
| Multiple stale items (> 1) | Not tested | All reverted; only first becomes ready[0] |
| Stale item where `issueNumber` is null | Not tested | `setProjectItemStatus` guards on `!issueNumber` and returns false; stale item gets the "could not recover" warning path |

---

## Findings

🔵 `bin/lib/cron.mjs:86` — `_listProjectItems(projectNumber)` called without `await`; carry-forward from run_2 engineer eval; no comment or JSDoc signals the synchronous contract; an injected async stub would return a Promise and `items.filter` would throw `TypeError: items.filter is not a function`

🔵 `bin/lib/cron.mjs:101` — `staleItem.status = "ready"` mutates the object in-place to include recovered items in the ready pool; relies on an implicit (undocumented) contract that objects returned by `_listProjectItems` are mutable; works correctly in all current production/test paths

---

## Summary

All four run_3 claims are verified against code and tests. The three prior open findings (--dry-run leakage, Unicode sanitization gap, stale in-progress stranding) are closed with code and tests. Console mock restores and lock.release() spies have been hardened across all applicable tests. 24 tests pass, verified by direct execution.

No new correctness or safety issues. Two 🔵 suggestions are carry-forward quality notes with no runtime risk in current code.

**Engineer Verdict: PASS**

---

# Architect Eval — task-4 run_3 (stale recovery + empty-args fix + Unicode sanitization)

**Reviewer role:** Software Architect
**Date:** 2026-04-26
**Handshake run:** run_3
**Verdict: PASS**

---

## Files Actually Read

- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 726 lines)
- `bin/lib/github.mjs` (full, ~295 lines)
- `bin/lib/util.mjs` (lockFile section, lines 95–166)
- `bin/lib/run.mjs` (`_runSingleFeature` signature, line 780)
- `.team/features/cron-based-outer-loop/SPEC.md` (full)
- All four `handshake.json` files

---

## Per-Criterion Results (SPEC AC1–AC7)

### AC1: Dispatch — PASS
`cron.mjs:113–129`: picks `readyItems[0]`, transitions to "in-progress", calls `_runSingleFeature([], title)`. Empty-args fix: `[]` passed explicitly, not forwarded CLI args. Asserted at `test/cron-tick.test.mjs:177`.

### AC2: Success path — PASS
`cron.mjs:131–135`: `_setProjectItemStatus(..., "done")` on success. Warning on false return is non-fatal.

### AC3: Failure path — PASS
`cron.mjs:136–152`: catch block reverts to "ready", wraps `_commentIssue` in its own try/catch so a throwing comment call cannot suppress the original `console.error`. Tests 4b and 4c cover false return and throwing respectively.

### AC4: Stale in-progress recovery — PASS
`cron.mjs:88–103`: filters `status.toLowerCase()` against `"in-progress"` and `"in progress"` (covers both internal key and GitHub API capitalization). On successful revert, `staleItem.status = "ready"` mutates the object reference in-place so the item enters `readyItems` at line 106 without an extra API call. Three stale-recovery tests at lines 399–498: stale+fresh, stale-only, stale-revert-fails.

### AC5: Concurrent execution guard — PASS
`cron.mjs:76–82`: `lockFile(lockPath, { timeout: 0 })`. CLI integration test at line 686 writes a live-PID lock file and asserts the subprocess exits 0 with "already running".

### AC6: Pre-flight validation — PASS
`cron.mjs:56–74`: three sequential guards before lock acquisition. No lock is held during pre-flight; no release needed.

### AC7: Title sanitization — PASS
`cron.mjs:118`: regex `/[\r\n\x00-\x1f\x7f\u0085\u2028\u2029]/g` covers all SPEC-required characters. Truncated to 200 chars. Tests at lines 320–394 cover ASCII injection, Unicode injection, and length overflow.

---

## Architectural Findings

### Redundant PROJECT.md reads
`cron.mjs:57` (`_readTrackingConfig`) and `cron.mjs:70` (`_readProjectNumber`) both read the same file. In production, `setProjectItemStatus` (github.mjs:275) calls `readTrackingConfig()` again per status transition. A full tick with stale recovery + dispatch reads PROJECT.md 4–5 times. Acceptable for a cron-period operation.

### `setProjectItemStatus` re-reads config with implicit `process.cwd()`
`github.mjs:275`: `readTrackingConfig()` with no arguments. If cwd diverges from project root during a run, status transitions silently return false while pre-flight passed with an explicit path. Carry-forward risk; bounded by current `process.cwd()` usage in `runSingleFeature`.

### `process.exit()` for pre-flight errors
`cron.mjs:60, 66, 73, 81`: direct `process.exit()` calls break the async interface contract and require monkey-patching in all pre-flight tests. A thrown error would be more composable.

### `_listProjectItems` sync contract undocumented
`cron.mjs:86`: called without `await`. An async injection fixture would silently produce a Promise in `items`, causing `filter` to iterate over `[Promise]`. Low risk today; a comment would prevent a future footgun.

---

## Edge Cases Checked

| Case | Result |
|---|---|
| No ready items | exits 0, "no ready items" logged |
| Lock already held (live PID) | exits 0, "already running" |
| runSingleFeature throws | reverts to ready, comments, exits 0 |
| commentIssue returns false | warns, does not throw |
| commentIssue throws | inner catch absorbs it; original error logged |
| title with ASCII control chars | stripped |
| title with U+0085/U+2028/U+2029 | stripped |
| title > 200 chars | truncated |
| stale in-progress + fresh ready | stale reverted, fresh dispatched |
| stale in-progress only | reverted, re-dispatched |
| stale revert fails | warning, item not re-queued |
| tracking config missing | exits 1 |
| Ready option ID missing | exits 1 |
| project number missing | exits 1 |
| args forwarded to runSingleFeature | FIXED: `[]` passed explicitly |

---

## Findings

🔵 `bin/lib/github.mjs:275` — `setProjectItemStatus` calls `readTrackingConfig()` with implicit `process.cwd()`; pass tracking config as a parameter to eliminate the implicit dependency and avoid silent failures if cwd changes

🔵 `bin/lib/cron.mjs:60` — pre-flight errors call `process.exit()` directly; consider throwing instead for composability and cleaner test setup

🔵 `bin/lib/cron.mjs:86` — `_listProjectItems` called without `await` with no comment documenting the sync requirement; add a JSDoc note to prevent a future async fixture from silently breaking the filter chain

---

## Summary

All seven SPEC acceptance criteria are met with direct code evidence. The run_3 hardening correctly addresses all prior 🟡 warnings: empty args fix (AC1), Unicode line-separator sanitization (AC7), stale in-progress recovery (AC4), and test quality improvements (try/finally console restores, lock spy assertions). No critical or warning-level findings against the current implementation.

**Architect Verdict: PASS**

---

# PM Eval — task-4 run_3: cron-based-outer-loop (final feature review)

**Reviewer role:** Product Manager
**Date:** 2026-04-26
**Handshake run:** run_3
**Verdict: PASS**

---

## Files Actually Read

- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 553 lines)
- `bin/lib/github.mjs` (`commentIssue` excerpt, lines 218–222)
- `.team/features/cron-based-outer-loop/SPEC.md` (full, 65 lines)
- `tasks/task-{1,2,3,4}/handshake.json` (all four)

No `tasks/*/artifacts/test-output.txt` files exist — see finding below.

---

## Requirement (from SPEC.md)

> `agt cron-tick` when feature run fails reverts the board item to "Ready" and comments on the GitHub issue.

SPEC.md exists and was read in full; all seven acceptance criteria were verified against code.

---

## Per-Criterion Results

### AC1: Dispatch — PASS

`cron.mjs:130`: first `readyItems[0]` is selected. `runSingleFeature` called with `([], title)` — empty args, not forwarded CLI flags (prior 🟡 `args` leakage closed in run_3). Test at `cron-tick.test.mjs:177` asserts `assert.deepEqual(runArgs, [])`.

### AC2: Success path — PASS

Board item transitions in-progress → done (`cron.mjs:131–135`). Function returns normally (no explicit `process.exit`) → OS exit 0. Transition ordering verified at test lines 104–109.

### AC3: Failure path — PASS

`cron.mjs:137–153`: inner `catch(err)` reverts to "ready", then wraps `_commentIssue` in its own try-catch so a throwing comment call never masks the original error. `console.error` emits the failure to stderr (captured by cron's `2>&1` log). Process exits 0 (no `process.exit(1)` in catch). Tests 4, 4b, and 4c cover revert + comment, comment returns false, and comment throws.

### AC4: Stale in-progress recovery — PASS

Pre-flight loop at `cron.mjs:89–103` runs after lock acquisition and before ready-item filtering. Handles `"in-progress"` and `"in progress"` casing. Mutates `staleItem.status = "ready"` so recovered items enter `readyItems` in the same tick. Three tests cover: recovery + dispatch of normal item, recovery + dispatch of recovered-only item, and warning on failed revert.

### AC5: Concurrent execution guard — PASS

`_lockFile(lockPath, { timeout: 0 })` tries once; if not acquired, exits 0 with "already running". CLI integration test at `cron-tick.test.mjs:330` writes a real lock file owned by the live test-runner PID and asserts the spawned subprocess exits 0.

### AC6: Pre-flight validation — PASS

Three guards before lock acquisition: (1) no tracking config → exit 1 "not configured", (2) `"ready"` option absent → exit 1, (3) project number unparseable → exit 1. All three exercised by unit tests; two by CLI integration tests.

### AC7: Title sanitization — PASS

`cron.mjs:118`: regex extended in run_3 to include U+0085/U+2028/U+2029 (prior 🟡 security finding closed). Truncates to 200 chars. Tests cover control chars, Unicode separators, and truncation.

---

## Scope Check

run_3 delivered exactly the four fixes stated in handshake.json: empty-args pass-through, Unicode regex extension, stale in-progress pre-flight, and test hardening. No out-of-spec additions detected.

---

## Findings

🟡 `.team/features/cron-based-outer-loop/tasks/*/artifacts/` — No `test-output.txt` stored in any task's artifact directory; test counts in handshakes (549, 553) cannot be independently verified from artifacts alone — store test runner output as a task artifact in future runs.

🔵 `bin/lib/cron.mjs:89–103` — Stale recovered items are always retried immediately in the same tick; if a feature was killed due to resource limits it will be dispatched again immediately; no spec prohibition but may surprise operators — file backlog item for optional retry-count cap.

---

## Summary

All seven SPEC acceptance criteria have direct code evidence and test coverage. Both primary user-facing behaviors (revert to "Ready" + failure comment) are implemented and hardened across four runs. The two open prior 🟡 findings (args leakage, Unicode sanitization) are confirmed closed in run_3. No blocking issues found.

**PM Verdict: PASS**

---

# Tester Eval — task-4 run_3 (stale recovery, Unicode sanitization, args fix, test hardening)

**Reviewer role:** Test Strategist
**Date:** 2026-04-26
**Handshake run:** run_3
**Verdict: PASS**

---

## Files Actually Read

- `.team/features/cron-based-outer-loop/tasks/task-4/handshake.json` (run_3)
- `bin/lib/cron.mjs` (full, 179 lines)
- `test/cron-tick.test.mjs` (full, 727 lines)
- `.team/features/cron-based-outer-loop/SPEC.md` (full)
- `bin/lib/github.mjs` (`listProjectItems` — confirmed synchronous, line 238)

## Tests Run

```
node --test test/cron-tick.test.mjs
tests 24 | pass 24 | fail 0 | skipped 0

npm test (full suite)
tests 555 | pass 553 | fail 0 | skipped 2
```

Executed directly. Builder claimed 553 pass; verified.

---

## Per-Criterion Results

### AC1: Dispatch — PASS
Test at line 146 verifies `runSingleFeature` called with `[]` (`assert.deepEqual(runArgs, [])`), correct title, correct status sequence.

### AC2: Success path — PASS
Same test asserts `done` transition follows `in-progress` transition in order.

### AC3: Failure path — PASS
Tests at lines 220, 253, 283 cover: revert to ready, comment with error message, comment returns false warning, comment throws warning. Prior finding (commentIssue not wrapped) is closed.

### AC4: Stale in-progress recovery — PASS
Three tests at lines 399, 431, 468. All pass. All use "In Progress" (space format) — see findings.

### AC5: Concurrent execution guard — PASS
Unit test (line 111) and CLI integration test (line 686).

### AC6: Pre-flight validation — PASS
Three unit tests (lines 503, 525, 555) and two CLI integration tests (lines 649, 668).

### AC7: Title sanitization — PASS
Tests at lines 320, 346, 372 cover control chars, Unicode line separators, truncation. Prior security finding closed.

---

## Findings

🟡 `cron.mjs:86` — `listProjectItems` called bare inside the outer `try` with no inner catch; if the GH API throws (network failure, auth expiry), the exception propagates as an unhandled rejection with no `console.error` log — the `finally` block releases the lock but the failure is invisible in the cron log; add a test where `listProjectItems` throws and assert `console.error` is invoked with a useful message

🟡 `test/cron-tick.test.mjs:399` — Stale+ready coexistence: dispatch priority not asserted; after stale recovery, item #3 (mutated to "ready") appears first in `readyItems` and gets dispatched ahead of item #4 (originally "Ready"), but the test asserts only `runCalled === true` — a regression that changes dispatch ordering would pass silently; add an assertion on the dispatched `issueNumber`

🔵 `test/cron-tick.test.mjs:409` — All stale recovery tests use `status: "In Progress"` (space format); the `s === "in-progress"` (hyphen) branch at `cron.mjs:93` is never exercised by a stale-scenario test; add one fixture item with `status: "in-progress"` (hyphen)

🔵 `cron.mjs:118` — No test for `item.title` being `null` or `undefined`; the `|| ""` guard is correct but untested

---

## Summary

All 24 cron-tick tests pass (553/555 full suite). All seven SPEC acceptance criteria have direct test coverage with evidence. Prior 🟡 warnings from runs 1–2 (commentIssue guard, Unicode sanitization, args forwarding, lock-release spies, try/finally console-restore) are all closed. Two new 🟡 backlog items: `listProjectItems` error path lacks test coverage and error logging; stale+ready dispatch priority is untested. No critical findings.

**Tester Verdict: PASS**
