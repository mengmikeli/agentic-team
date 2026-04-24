## Tester Evaluation — parent-issue-subtask-lifecycle

**Reviewer role:** Tester (coverage gaps, edge cases, regression risks)
**Gate:** task-2 PASS (608/608 tests)
**Files read:** `bin/lib/github.mjs` (lines 124–147), `bin/lib/run.mjs` (lines 895–965, 1337–1360), `test/parent-checklist.test.mjs`

---

## Overall Verdict: FAIL

Two 🔴 criticals from the prior review remain unfixed. The gate-pass tick implementation itself (`run.mjs:1349–1355`) is correct and simple, but the adjacent issue-creation block still has a silent-abort bug that prevents execution from ever reaching the tick.

---

## Per-Criterion Results

### Criterion: Gate pass → checklist tick
**Evidence:** `tickChecklistItem` implemented at `github.mjs:140–147` (7-line pure regex replacement). Called at `run.mjs:1349–1355` with correct guards (`if (task.issueNumber && state?.approvalIssueNumber)`, `if (parentBody)`, `if (updated !== parentBody)`). Unit tests pass (6 cases). Implementation is simple and correct. **PASS.**

### Criterion: Silent abort on getIssueBody failure
**Evidence:** `run.mjs:956` reads `if (currentBody === null) return;` — confirmed by direct read. This `return` exits `_runSingleFeature` (declared line 716), aborting all task execution including any future gate-pass ticks. Bug is unchanged from prior review. **FAIL.**

### Criterion: Empty-body coercion
**Evidence:** `github.mjs:126` reads `return runGh(...) || null;` — confirmed by direct read. An approval issue with no body (`""` from `gh`) is coerced to `null`, which triggers the abort at line 956. Bug unchanged. **FAIL.**

### Criterion: Test coverage of gate-pass path
**Evidence:** No integration test mocks `getIssueBody`/`editIssue` to verify the run.mjs:1349–1355 path is exercised after a gate PASS. Only the pure function is tested. The full path (create issues → execute → gate PASS → tick parent) has no test.

### Criterion: Back-link template tests
**Evidence:** `test/parent-checklist.test.mjs:97–114` — tests construct the expected body inline without calling `run.mjs:929`. A regression in the production template would pass these tests silently. Prior review's 🟡 unfixed.

---

## Findings

🔴 `bin/lib/run.mjs:956` — `return` exits `_runSingleFeature` silently; any `getIssueBody` null (transient failure or empty body) aborts all task execution; replace with `if (currentBody && !currentBody.includes("## Tasks")) { editIssue(...); }`

🔴 `bin/lib/github.mjs:126` — `|| null` coerces empty issue body `""` to `null`; approval issue with no body triggers the abort at run.mjs:956; return `""` for empty-but-successful calls and `null` only when `result.status !== 0`

🟡 `test/parent-checklist.test.mjs:97` — back-link template tests assert on self-constructed inline strings, not `run.mjs:929`; a template regression passes silently; remove or refactor to exercise production code

🟡 `bin/lib/run.mjs:1353` — `editIssue(...)` return value discarded; checklist tick failure is invisible to the user; log a warning on false return

🔵 `bin/lib/run.mjs:929` — `backLink` is constant but recomputed on every loop iteration; hoist above the `for` loop
