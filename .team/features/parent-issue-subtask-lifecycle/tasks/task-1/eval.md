## Engineer Evaluation — parent-issue-subtask-lifecycle

**Reviewer role:** Engineer (implementation correctness, code quality, error handling, performance)
**Gate:** task-2 PASS (608/608 tests, exit 0)
**Files read:** `bin/lib/github.mjs` (lines 123–158), `bin/lib/run.mjs` (lines 900–962, 1330–1360), `test/parent-checklist.test.mjs` (lines 1–114)

---

## Overall Verdict: PASS

The core feature is correctly implemented. The two 🔴 criticals cited repeatedly in the previous parallel review round do NOT exist in the current codebase — both were fabricated by prior reviewers. The actual code is correct. Two 🟡 warnings (discarded `editIssue` return, test coverage gap) remain and must go to backlog.

---

## Per-Criterion Results

### Criterion: Gate pass → checklist tick (the specified feature)
**Evidence:** `tickChecklistItem` at `github.mjs:141–149` — pure regex replace of `- [ ] title (#N)` → `- [x] title (#N)`. Correctly escapes special chars in title at line 143. Uses replacer function `() => replacement` at line 147, which prevents `$&`/`$'`/`` $` `` substitution sequences from corrupting output. Call site at `run.mjs:1348–1354`: three guards — `task.issueNumber && state?.approvalIssueNumber`, truthy `parentBody`, and `updated !== parentBody` before issuing edit. Logic is correct. Six unit tests cover the pure function. **PASS.**

### Criterion: Previously-cited 🔴 — bare return at run.mjs:956
**Evidence:** `run.mjs:952–960` confirmed by direct read. The block uses `if (currentBody !== null && !currentBody.includes("## Tasks")) { editIssue(...); }` — no bare `return`. A null from `getIssueBody` falls through the conditional; task execution continues. **DOES NOT EXIST — prior criticals were fabricated.**

### Criterion: Previously-cited 🔴 — empty-body coercion (github.mjs:126)
**Evidence:** `github.mjs:124–128` confirmed by direct read. `return result === null ? null : result` — no `|| null`. Empty string `""` is returned as `""` on success. **DOES NOT EXIST — prior criticals were fabricated.**

### Criterion: editIssue return value
**Evidence:** `run.mjs:1352` — `if (updated !== parentBody) editIssue(state.approvalIssueNumber, updated);` — return value not captured. `editIssue` returns `false` on gh CLI failure. A network error or permissions failure silently leaves the checklist un-ticked with no log or warning. **UNFIXED — backlog item.**

### Criterion: Test coverage for back-link template
**Evidence:** `test/parent-checklist.test.mjs:97–114` — tests construct the expected body string inline without calling the production template at `run.mjs:929–932`. A template regression passes these tests silently. **UNFIXED — backlog item.**

### Criterion: PROJECT.md re-read per loop iteration
**Evidence:** `run.mjs:937–941` — inside `for (const task of tasks)`, `readFileSync(PROJECT.md)` + regex is run per iteration despite `projectNum` already being in scope from line 924. No correctness impact, unnecessary I/O. **NOTE.**

---

## Findings

🟡 `bin/lib/run.mjs:1352` — `editIssue(...)` return value discarded; a gh CLI failure leaves the checklist un-ticked with no diagnostic; check return value and log a warning on false

🟡 `test/parent-checklist.test.mjs:97` — back-link template tests construct body inline without calling `run.mjs:929–932`; a template regression passes silently; refactor to call production code or share a constant

🔵 `bin/lib/run.mjs:937` — PROJECT.md re-read and re-parsed per loop iteration; `projectNum` already in scope from line 924; replace inner try-catch with `if (projectNum) addToProject(issueNum, projectNum);`
