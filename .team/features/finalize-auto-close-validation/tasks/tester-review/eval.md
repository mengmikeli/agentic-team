# Tester Review — finalize-auto-close-validation
## Task: "Test: tasks without `issueNumber` are skipped silently and do not affect the count"
## Commit: e74a1af

---

## Overall Verdict: PASS

All 518 tests pass. The specific test case is present, executes correctly, and the assertion
`issuesClosed: 1` provides meaningful coverage of the production guard in `finalize.mjs:118`.
Two backlog items flagged below.

---

## Files Examined

- `test/harness.test.mjs` — lines 468–506 (the new test)
- `bin/lib/finalize.mjs` — lines 114–131 (production guard under test)
- `bin/lib/github.mjs` — lines 137–142 (`closeIssue`, null-guard at line 138)
- `.team/features/finalize-auto-close-validation/tasks/task-4/artifacts/test-output.txt` — test run evidence

---

## Per-Criterion Results

### 1. Test exists and passes
**PASS** — `test/harness.test.mjs:468` is present and reported as ✔ in `test-output.txt:394`:
```
✔ silently skips tasks without issueNumber and does not affect count (217.125542ms)
```

### 2. Count contract is verified
**PASS** — `assert.equal(result.issuesClosed, 1)` at line 502 directly verifies that t2
(no `issueNumber`) did not increment the counter. The production counter increment lives
inside `if (task.issueNumber)` (`finalize.mjs:118`), so removing the guard would push the
count to 2 and fail the assertion.

### 3. The "silent" part of the claim is not verified
**PARTIAL** — The test name says "silently skips" but no assertion checks that no
warning or log is emitted for t2. If a future change adds `console.warn("task t2 has
no issueNumber")`, this test would not detect it. The test only parses the last JSON
line (`lines[lines.length - 1]`), so any intermediate output for t2 is ignored.

Production code (`finalize.mjs:117–131`) currently emits nothing for the no-issueNumber
case — so the implementation is silent — but the test does not lock this in.

### 4. No gh-call log for absence-of-call verification
**PARTIAL** — Peer tests (e.g., the comment-passed and comment-skipped tests at lines
~305 and ~356) use a `gh-calls.log` pattern to verify what arguments were passed to `gh`.
This test does not. The count assertion (`issuesClosed: 1`) is sufficient to detect the
most likely regressions, but it does not directly prove that `gh issue close` was never
invoked for t2. (Note: `closeIssue(undefined)` exits early at `github.mjs:138`, so no
actual gh call would occur even without the `finalize.mjs` guard — meaning the count
assertion alone can't distinguish "guard blocks the call" from "closeIssue no-ops".)

### 5. All-tasks-missing-issueNumber edge case not covered
**GAP** — No test verifies `issuesClosed: 0` when a feature has zero tasks with an
`issueNumber`. This is the boundary value for the skip-all path.

---

## Findings

🟡 test/harness.test.mjs:499 — "Silently skips" is asserted via count only; add a check that the output lines contain no unexpected content for t2 (e.g., assert no lines between status lines reference "t2" or "undefined"), to lock in the silence contract

🟡 test/harness.test.mjs:468 — No gh-calls.log in this test (unlike peer finalize tests at ~line 305/356); the count assertion distinguishes correct guard from `closeIssue(undefined)` no-op but does not directly prove `gh` was never invoked for t2 — add a log file assertion consistent with peer tests

🔵 test/harness.test.mjs:468 — Missing edge: all tasks lack issueNumber → expected `issuesClosed: 0`; add a separate test or extend this fixture with an all-no-issue scenario

🔵 test/harness.test.mjs:479 — Only covers `status: "passed"` + no issueNumber; the `status: "skipped"` + no issueNumber combo is not tested (same guard applies, but explicit coverage would close the matrix)

---

## Regression Risk

**Low.** The production guard (`if (task.issueNumber)` in `finalize.mjs:118`) is simple and
the count assertion would detect its removal. The two 🟡 items are test-quality gaps, not
production safety gaps — `closeIssue` has its own null-guard at `github.mjs:138` as a
backstop. Backlog both yellows.
