# Simplicity Review — max-review-rounds-escalation

**Reviewer role:** simplicity
**Date:** 2026-04-24
**Overall verdict:** ITERATE

---

## Files Read

- `bin/lib/review-escalation.mjs` (full file, 29 lines)
- `test/review-escalation.test.mjs` (full file, 101 lines)
- `bin/lib/run.mjs` (lines 1150–1290, grep for all `reviewRounds`/`shouldEscalate` hits)
- `.team/features/max-review-rounds-escalation/SPEC.md`
- `.team/features/max-review-rounds-escalation/tasks/task-1/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/handshake.json`
- `.team/features/max-review-rounds-escalation/tasks/task-2/artifacts/test-output.txt`

---

## Per-Criterion Results

### 1. `review-escalation.mjs` module — is the abstraction earned?

PASS. The module is 29 lines, pure functions, no I/O, no side effects. `incrementReviewRounds` and `shouldEscalate` are the right size and have clear single responsibilities. The module boundary earns its keep by isolating the cap logic from `run.mjs`.

One defect: `typeof task.reviewRounds !== "number"` passes NaN (NaN has type "number"). Post-increment: `NaN + 1 = NaN`. `NaN >= 3` is always false, so escalation is permanently disabled for a task whose `reviewRounds` becomes NaN. This is a one-token fix (`!Number.isFinite`).

### 2. Counter increment in run.mjs — duplicate read-state→write-state blocks

FAIL (backlog-level). The 6-line read-state→find-task→write-state block that persists `reviewRounds` is copy-pasted verbatim at `run.mjs:1163–1168` and `run.mjs:1242–1247`. The same structure also exists for `gateWarningHistory` at ~1144 and ~1220. That is four identical blocks with the same silent-discard risk when `rrTask` is null. Cognitive load: a reader must verify each copy individually. A future bug fix must be applied to all four. This should be a `persistTaskField(featureDir, taskId, field, value)` helper.

### 3. Block logic at shouldEscalate — correct and simple

PASS. Lines 1270–1278 correctly fire after `reviewFailed = true`, call `shouldEscalate(task)`, transition to `blocked`, write `progress.md`, and log the event. The early `break` prevents further retries. No unnecessary indirection.

### 4. SPEC Done When item 3 — GitHub comment on escalation

FAIL. The SPEC requires: "A GitHub comment is posted to the task's linked issue containing: task title, rounds attempted, and deduplicated critical findings from each round's handshake.json." The escalation block at `run.mjs:1270–1278` contains no `commentIssue` call. This criterion is not implemented.

Evidence: grepping `run.mjs` for `commentIssue` near line 1270 finds nothing. The handshake task-1 also lists this as a 🔴 critical from the engineer and tester roles.

### 5. SPEC Done When item 9 — integration test: 3 review FAILs → task blocked

FAIL. `test/review-escalation.test.mjs` has 14 unit tests covering `incrementReviewRounds`, `shouldEscalate`, and the constant — all testing the pure module in isolation. No test exercises the run-loop path "task receives 3 critical-finding review FAILs → `task.status === 'blocked'` in STATE.json with `lastReason === 'review-escalation: 3 rounds exceeded'`". The test at line 78 ("counter only increments on review FAIL") is a caller-semantics stub that never calls `run.mjs` code.

Evidence: test output shows `incrementReviewRounds` suite (5 tests), `shouldEscalate` suite (8 tests), `MAX_REVIEW_ROUNDS constant` suite (1 test). No suite named "integration" for this feature's run-loop path.

### 6. Test coverage for "summary generation with deduplication"

FAIL. SPEC Done When item 8 requires: "Unit tests cover: counter increment on review FAIL, no increment on build/gate FAIL, block fires at round 3, summary generation with deduplication." Summary generation and deduplication are unimplemented entirely — no code, no test.

### 7. Gate result (566/566 tests pass)

PASS. The gate task-2 handshake shows exit code 0, 566 tests pass, 0 fail. The existing test suite is green.

---

## Findings

🔴 bin/lib/run.mjs:1270 — GitHub comment on escalation (SPEC Done When item 3) is absent; add `if (task.issueNumber) await commentIssue(task.issueNumber, buildEscalationSummary(task, featureDir))` before the `break`, where `buildEscalationSummary` deduplicates critical findings across prior handshake.json files

🔴 test/review-escalation.test.mjs:1 — No integration test for run-loop path "3 review FAILs → task blocked"; add a simulated-loop test asserting `task.status === 'blocked'` and `lastReason === 'review-escalation: 3 rounds exceeded'` in STATE.json after three critical-finding review rounds (SPEC Done When item 9)

🟡 bin/lib/run.mjs:1163 — Read-state→find-task→write-state for `reviewRounds` is copy-pasted verbatim at lines 1163–1168 and 1242–1247; same pattern for `gateWarningHistory` at ~1144 and ~1220 — four identical 6-line blocks with the same silent-discard bug; extract `persistTaskField(featureDir, taskId, field, value)` helper before this adds a fifth copy

🟡 bin/lib/review-escalation.mjs:14 — `typeof NaN === "number"` is true; NaN passes the guard, `NaN + 1` stays NaN, and `shouldEscalate` permanently returns false (`NaN >= 3` is false); change guard to `!Number.isFinite(task.reviewRounds)`

---

## Summary

The core escalation mechanic (counter + block at round 3 + progress.md entry) is cleanly implemented. The `review-escalation.mjs` module is appropriately scoped and simple. Two SPEC Done When items are unimplemented: the GitHub comment with deduplicated findings (item 3) and the run-loop integration test (item 9). The duplication of the read-state→write-state pattern across four sites in `run.mjs` is the primary simplicity concern — it adds maintenance cost and masks a silent-discard bug at each copy.
