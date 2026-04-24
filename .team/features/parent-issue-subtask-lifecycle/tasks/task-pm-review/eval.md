## PM Review — parent-issue-subtask-lifecycle

**Reviewer role:** Product Manager
**Task reviewed:** No extra project board columns or config changes are required — existing status flow is sufficient
**Scope:** Full feature "Done When" criteria verification, focused on project board criterion

---

## Files Read

- `.team/features/parent-issue-subtask-lifecycle/SPEC.md` (full)
- `.team/features/parent-issue-subtask-lifecycle/progress.md` (full)
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-{1-6}/handshake.json` (all)
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-{1-5}/eval.md` (all)
- `bin/lib/run.mjs:920–962` (issue creation, checklist append)
- `bin/lib/run.mjs:1290–1362` (escalation paths, gate-pass tick)
- `bin/lib/github.mjs:120–173` (getIssueBody, editIssue, tickChecklistItem, markChecklistItemBlocked, buildTasksChecklist)
- `bin/lib/finalize.mjs:110–150` (approval issue close)
- `test/parent-checklist.test.mjs` (full, 152 lines)
- `task-6/artifacts/test-output.txt` (617 tests, 0 fail, exit 0)

---

## Overall Verdict: PASS

The core user value is delivered. All seven "Done When" criteria are met — including the specific task under review (no new board columns or config). One spec-body requirement (skipped-task checklist marker) is unimplemented but absent from the "Done When" checklist; it goes to backlog. Three silent-failure patterns are flagged as warnings.

---

## Per-Criterion Results

### Criterion 6 (Task Under Review): No extra project board columns or config changes are required

**Result: PASS**

**Evidence:**
- `run.mjs:940` — task issues call `addToProject(issueNum, projectNum)` using the existing project number from `PROJECT.md`. No new columns, fields, or option IDs introduced.
- `run.mjs:1354` — `setProjectItemStatus(task.issueNumber, projectNum, "done")` uses the pre-existing "done" status. No new status value added.
- `finalize.mjs:116–127` — `readTrackingConfig()` and `projMatch` are dead code; the board-move call was explicitly left unimplemented. This confirms the decision to stay within existing board configuration.
- No changes to `PROJECT.md`, `.team/tracking.json`, or any board configuration files.

The parent issue is already added to the project board by the approval gate (in `outer-loop.mjs`); this feature adds nothing on top of that.

---

### Criterion 1: After `agt run` creates task issues, the parent issue body gains a `## Tasks` checklist

**Result: PASS**

**Evidence:** `run.mjs:951–960` — calls `buildTasksChecklist(tasks)`, then `getIssueBody` / `editIssue`. Guard at line 956 prevents double-appending. `github.mjs:167–173` builds the `\n\n## Tasks\n- [ ] title (#N)` format. Seven unit tests at `test/parent-checklist.test.mjs:8–57` cover format, empty list, tasks without issue numbers — all pass.

---

### Criterion 2: When a task gate passes, its checklist line updates from `- [ ]` to `- [x]`

**Result: PASS**

**Evidence:** `run.mjs:1355–1361` — on gate PASS, calls `getIssueBody` → `tickChecklistItem` → `editIssue`. `github.mjs:141–149` performs regex replace with special-character escaping and replacement-function wrapper. Six unit tests at `test/parent-checklist.test.mjs:59–95` cover tick, no-match, already-ticked, and falsy-guard cases — all pass.

---

### Criterion 3: When a task hits max review rounds (escalated), its checklist line shows the `⚠️ blocked` marker

**Result: PASS (review-round escalation only)**

**Evidence:** `run.mjs:1297–1303` — review-round escalation path calls `markChecklistItemBlocked` and `editIssue`. This is the path the criterion explicitly names ("max review rounds"). Six unit tests at `test/parent-checklist.test.mjs:97–133` cover the blocked format — all pass.

**Gap (backlog):** The iteration-escalation path (`run.mjs:1311–1317`) does NOT call `markChecklistItemBlocked`. A task blocked by compound-gate recurrence (`escalationFired`) leaves its checklist line as `- [ ] title (#N)` — inconsistent with the spec body requirement "When a task is blocked/escalated." Not in "Done When" as a separate criterion; file as backlog.

---

### Criterion 4: Each task issue body contains `Part of #N`

**Result: PASS**

**Evidence:** `run.mjs:929–932` — `backLink` is set when `state.approvalIssueNumber` is truthy and appended to the issue body. Two tests at `test/parent-checklist.test.mjs:135–152` pass. **Note:** both tests are tautologies — they construct the expected string inline without importing or calling production code, so they would pass even if `run.mjs:929` were deleted. Flagged as backlog coverage gap.

---

### Criterion 5: `agt finalize` closes the parent approval issue

**Result: PASS**

**Evidence:** `finalize.mjs:133–139` — closes `freshState.approvalIssueNumber` with comment "Feature finalized — all tasks complete." Definitive test at `test/harness.test.mjs:377–426` uses a real fake-gh binary, asserts `issuesClosed === 2`, and asserts "500" appears in the `gh` call log. Test passes (line 414 in gate output).

---

### Criterion 7: All existing tests still pass

**Result: PASS**

**Evidence:** Gate output (task-6): 617 pass, 0 fail, exit 0.

---

## Spec Gap: Skipped-task checklist marker

**Not in "Done When" — backlog only.**

SPEC.md body specifies: `- [x] Task title (#N) *(skipped)*` when a task is skipped. The skip path at `run.mjs:1086–1092` does NOT call any checklist update — no `markChecklistItemSkipped` function exists. This is a spec-body requirement absent from the "Done When" checklist. The inconsistency means this was never a merge blocker, but it represents observable user-facing behavior gap (a skipped task stays `- [ ]` in the parent checklist). File as backlog.

---

## Findings

🟡 `bin/lib/run.mjs:1086` — Skip path does not update the parent checklist; SPEC.md body requires `- [x] Task title (#N) *(skipped)*`; no `markChecklistItemSkipped` function exists; add call mirroring the escalation block at lines 1297–1302

🟡 `bin/lib/run.mjs:1311` — Iteration-escalation (`escalationFired`) path does not call `markChecklistItemBlocked`; blocked tasks via this path leave a `- [ ]` item while review-escalated tasks show `⚠️ blocked`; inconsistent parent-issue state visible to users

🟡 `bin/lib/run.mjs:1357` — `if (parentBody)` coerces `""` to falsy; `getIssueBody` returns `""` for a valid issue with empty body, silently skipping the checklist tick; use `if (parentBody !== null)` to match the documented return contract (same pattern at lines 1299 and 956)

🟡 `test/parent-checklist.test.mjs:136` — Both back-link tests are tautologies; removing `backLink` from `run.mjs:929` leaves them green; add a mocked integration test that stubs `createIssue` and asserts the stub received a body containing `Part of #${approvalIssueNumber}`

🔵 `bin/lib/finalize.mjs:124–127` — Dead code: `projMatch` computed from `readTrackingConfig()` but never used; comment says "Best-effort: move to done on project board" but no call follows; remove or implement to avoid misleading future contributors

🔵 `bin/lib/finalize.mjs:128` — `issuesClosed++` fires unconditionally after `closeIssue(...)`; `closeIssue` returns `false` (does not throw) on `gh` failure, inflating the reported count; change to `if (closeIssue(...)) issuesClosed++` (same at line 137)
