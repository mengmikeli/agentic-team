# Architect Review — max-review-rounds-escalation

**Reviewer role:** architect
**Date:** 2026-04-24
**Overall verdict:** FAIL

---

## Files Read

- `.team/features/max-review-rounds-escalation/tasks/task-1/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/artifacts/test-output.txt`
- `.team/features/max-review-rounds-escalation/SPEC.md`
- `bin/lib/review-escalation.mjs` (full file)
- `test/review-escalation.test.mjs` (full file)
- `bin/lib/run.mjs:13–18, 1127–1184, 1268–1290`

---

## Per-Criterion Results

### 1. `task.reviewRounds` increments on review FAIL — PASS
Evidence: `review-escalation.mjs:13–18` defines `incrementReviewRounds`; `run.mjs:1165–1172` calls it when `synth.critical > 0` (serial path); `run.mjs:1241–1248` calls it in the parallel path. 566/566 tests pass. Unit tests at `test/review-escalation.test.mjs:12–46` directly verify increment from absent, 0, and existing values.

### 2. Block at `reviewRounds >= 3` with correct `lastReason` — PASS
Evidence: `run.mjs:1274` calls `shouldEscalate(task)` inside `if (reviewFailed)`. When it returns true, `harness("transition", "--task", task.id, "--status", "blocked", "--dir", featureDir, "--reason", \`review-escalation: ${task.reviewRounds} rounds exceeded\`)` at `run.mjs:1276–1277` fires. At that point `task.reviewRounds` is 3 (incremented at 1167), producing `"review-escalation: 3 rounds exceeded"` — matching SPEC exactly. `break` at line 1281 ensures no further retry.

### 3. GitHub comment posted on escalation — FAIL
Evidence: I read every line of the escalation block (`run.mjs:1273–1282`). The block contains `harness("transition"...)`, `appendProgress(...)`, `console.log(...)`, and `break`. There is NO `commentIssue(task.issueNumber, ...)` call anywhere in this block or nearby. SPEC Done When item 3 is explicitly: "A GitHub comment is posted to the task's linked issue containing: task title, rounds attempted, and deduplicated critical findings from each round's handshake.json." This is entirely absent — not deferred, not partially implemented.

### 4. progress.md escalation entry — PASS
Evidence: `run.mjs:1279` calls `appendProgress(featureDir, ...)` unconditionally inside the escalation block. The message includes task title and round count.

### 5. No regression to existing limits — PASS
Evidence: The escalation block is a new `if (shouldEscalate(task))` clause inserted before the existing `if (escalationFired)` check (`run.mjs:1283`). Each guard fires independently via separate `if` blocks. The `break` in the review-rounds escalation path is consistent with the `break` in the iteration-escalation path. Gate output confirms 566/566 pass including tick-limit and oscillation tests.

### 6. Unit tests — PARTIAL PASS
Evidence: `test/review-escalation.test.mjs` covers `incrementReviewRounds`, `shouldEscalate`, and `MAX_REVIEW_ROUNDS` with 13 unit tests. "No increment on build/gate FAIL" is tested as caller-controlled semantics (line 78–94) — acceptable. "Summary generation with deduplication" is listed in SPEC Done When item 8 but no summary generation code exists to test, so this portion is unimplementable at present.

### 7. Integration test: 3 FAILs → blocked — FAIL
Evidence: I read the entirety of `test/review-escalation.test.mjs`. The file contains only unit tests for pure functions. No test simulates the run-loop path (init → build → review-fail × 3 → shouldEscalate → harness transition → blocked). SPEC Done When item 9 explicitly requires this. The test suite passes, but the feature's run-loop wiring has no automated integration coverage.

---

## Findings

🔴 bin/lib/run.mjs:1273 — No `commentIssue` call in escalation block; add `if (task.issueNumber) commentIssue(task.issueNumber, escalationSummary)` before `break`, where `escalationSummary` includes task title, round count, and deduplicated critical findings from each prior-round `handshake.json` (SPEC Done When item 3 — GitHub comment)

🔴 test/review-escalation.test.mjs:1 — No integration test for run-loop path "3 consecutive review FAILs → task.status === blocked, lastReason === review-escalation: 3 rounds exceeded"; SPEC Done When item 9 requires it; add a simulated-loop test alongside existing iteration-escalation integration tests in `test/*.test.mjs`

🟡 bin/lib/review-escalation.mjs:14 — `typeof NaN === "number"` is `true`; a corrupt `NaN` value in `task.reviewRounds` passes the guard, `NaN += 1` stays `NaN`, and `shouldEscalate` permanently returns `false` (`NaN >= 3 === false`); replace guard with `!Number.isFinite(task.reviewRounds)`

🟡 bin/lib/run.mjs:1167 — Read-state → find-task → assign-field → write-state pattern is duplicated verbatim at lines 1167–1172 and 1246–1251, with two more copies for `gateWarningHistory` at ~1148–1152 and ~1150; four identical 6-line blocks each carry the same silent null-task discard risk; extract `persistTaskField(featureDir, taskId, field, value)` before a fifth copy is added

🟡 bin/lib/run.mjs:1170 — If `rrTask` is `null` (task absent from fresh STATE snapshot), `reviewRounds` is silently not persisted; same silent discard at line 1247 for parallel path; add `console.warn("[review-rounds] task not found in state — reviewRounds not persisted")` to surface state-sync races in diagnostics

🔵 bin/lib/review-escalation.mjs:26 — `shouldEscalate` has no comment indicating its caller; add `// Called by run.mjs after review FAIL; maxRounds param is test-only, not wired to external config` to prevent readers from treating it as dead code or wiring `maxRounds` from untrusted input

---

## Summary

The counter logic and block-at-cap path are correctly implemented and tested at the unit level. The two critical gaps are architectural: the GitHub comment (SPEC item 3) is entirely absent from the escalation block — the code was never written, not just deferred — and there is no integration test proving the run-loop path actually terminates with `status: blocked` after three review FAILs. Both are required by the SPEC's Done When checklist and cannot be deferred. The NaN guard and duplicated state-write pattern are backlog-worthy warnings that worsen with each new task field added.

---

# PM Evaluation — max-review-rounds-escalation

**Reviewer role:** Product Manager
**Date:** 2026-04-24
**Overall verdict:** FAIL

Files read: `bin/lib/review-escalation.mjs`, `bin/lib/run.mjs` (lines 1120–1359), `test/review-escalation.test.mjs`, `SPEC.md`, `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`, `tasks/task-2/artifacts/test-output.txt`

---

## Per-Criterion Results (SPEC "Done When")

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `task.reviewRounds` increments on review FAIL | ✅ PASS | `run.mjs:1163`, `1242`; persisted at `1167`, `1246`; 13 unit tests pass |
| 2 | Block at round 3 with `lastReason = "review-escalation: 3 rounds exceeded"` | ✅ PASS | `run.mjs:1270–1277`, `transition.mjs:191`; string matches spec at `reviewRounds === 3` |
| 3 | GitHub comment with title, rounds, deduplicated findings | 🔴 FAIL | No `commentIssue` call in escalation block (`run.mjs:1270–1277`); no summary generation code exists |
| 4 | No GitHub issue → progress.md only, no crash | ✅ PASS | `appendProgress` at `run.mjs:1275` fires unconditionally; no `commentIssue` means no crash |
| 5 | `progress.md` receives a dated escalation entry | ✅ PASS | `appendProgress` at `run.mjs:1275` |
| 6 | Existing behavior unchanged when `reviewRounds < 3` | ✅ PASS | Guard at `run.mjs:1270`; 566/566 tests pass |
| 7 | Tick-limit, oscillation, iteration-escalation fire independently | ✅ PASS | Separate `if` blocks; confirmed by test suite |
| 8 | Unit tests: increment, no build/gate increment, block at 3, summary+dedup | ⚠ PARTIAL | Increment and block-at-3 covered; summary generation unimplemented and untestable |
| 9 | Integration test: 3 FAILs → blocked with correct `lastReason` and comment/fallback | 🔴 FAIL | `test/review-escalation.test.mjs` is 101 lines of pure-function unit tests only; no run-loop path test |

**Passed: 6/9. Failed: 2 (criteria 3, 9). Partial: 1 (criterion 8 — tied to missing criterion 3).**

---

## Findings

🔴 bin/lib/run.mjs:1270 — GitHub comment never posted on review-round escalation; add `if (task.issueNumber) commentIssue(task.issueNumber, escalationSummary)` before `break`, where `escalationSummary` is built by reading prior-round `handshake.json` files in `taskDir` and deduplicating critical/warning findings — SPEC Done When item 3

🔴 bin/lib/run.mjs:1270 — No deduplicated findings summary is generated from prior-round `handshake.json` files; implement `buildEscalationSummary(taskDir, taskTitle, reviewRounds)` that reads each round's `handshake.json` and deduplicates findings — SPEC scope "Generate an escalation summary"

🔴 test/review-escalation.test.mjs:1 — Integration test for "3 review FAILs → task blocked" absent; add a simulated-loop test asserting `task.status === "blocked"` and `lastReason === "review-escalation: 3 rounds exceeded"` in STATE.json after three critical-finding review rounds — SPEC Done When item 9
