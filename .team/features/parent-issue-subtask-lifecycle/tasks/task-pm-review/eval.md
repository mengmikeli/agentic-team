## PM Review — parent-issue-subtask-lifecycle

**Reviewer role:** Product Manager (independent audit)
**Task reviewed:** No extra project board columns or config changes are required — existing status flow is sufficient
**Scope:** Full feature "Done When" criteria verification
**Files read:**
- `.team/features/parent-issue-subtask-lifecycle/SPEC.md`
- `.team/features/parent-issue-subtask-lifecycle/progress.md`
- All task handshake.json files (task-1 through task-6)
- All task eval.md files (task-1 through task-6, task-engineer, task-pm-review, task-security)
- `bin/lib/run.mjs` lines 1082–1093, 1290–1370
- `bin/lib/finalize.mjs` (full, 150 lines)
- `bin/lib/github.mjs` (git diff for new `buildTaskIssueBody`, lines 141–173)
- `test/parent-checklist.test.mjs` (git diff for updated tests)
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-6/artifacts/test-output.txt` (lines 1–200)
- `git show 9715e63` (final commit diff)
- `git show bacb532` (prior commit stat)

---

## Overall Verdict: PASS

All seven "Done When" criteria are met. The test suite passes (617/617, exit 0). No critical findings. Seven 🟡 warnings are appropriate for backlog — none block merge.

---

## Per-Criterion Results

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1 | `## Tasks` checklist appended to parent after planning | ✅ PASS | `run.mjs:952–960`; `buildTasksChecklist` unit-tested in `parent-checklist.test.mjs:8–57` |
| 2 | Gate pass → `- [x]` in checklist | ✅ PASS | `run.mjs:1354–1360`; guard fixed to `if (parentBody !== null)` in commit 9715e63 |
| 3 | Max review rounds (escalated) → `⚠️ blocked` marker | ✅ PASS | `run.mjs:1292–1308` (`shouldEscalate` path) calls `markChecklistItemBlocked`; criterion naming maps to this path |
| 4 | Each task issue body contains `Part of #N` | ✅ PASS | `buildTaskIssueBody` in `github.mjs` (added commit 9715e63) includes `Number.isInteger()` guard; injection risk addressed |
| 5 | `agt finalize` closes parent approval issue | ✅ PASS | `finalize.mjs:133–139`; `harness.test.mjs:377–426` subprocess test confirms with fake `gh`, asserts `issuesClosed === 2` |
| 6 | **No extra project board columns or config required** | ✅ PASS | No new columns, fields, or option IDs in any changed file; `run.mjs:940` and `run.mjs:1353` reuse existing project infrastructure; dead code in `finalize.mjs:116–127` confirms board-move was explicitly deferred |
| 7 | All existing tests still pass | ✅ PASS | Gate output (task-6): 617 pass, 0 fail, exit 0 |

---

## Criterion 6 Detail (Task Under Review)

**Evidence for PASS:**
- `run.mjs:940` — task issues call `addToProject(issueNum, projectNum)` using the pre-existing project number from `PROJECT.md`. No new board configuration.
- `run.mjs:1353` — `setProjectItemStatus(task.issueNumber, projectNum, "done")` uses the pre-existing `"done"` status option. No new status value.
- `finalize.mjs:116–127` — `readTrackingConfig()` and `projMatch` are dead code; the "move to done on project board" comment has no implementation, confirming the deliberate decision to stay within existing board config.
- No changes to `PROJECT.md`, any tracking config file, or board option IDs across all commits in the feature branch.
- The parent approval issue is already added to the project board by the approval gate in `outer-loop.mjs` — this feature adds nothing on top of that.

---

## Spec Gap: Iteration-Escalation and Skipped-Task Checklist Markers

**Not in "Done When" — backlog only.**

The SPEC body specifies two additional checklist update cases not covered by Done When criteria:

1. `run.mjs:1311` — `escalationFired` (iteration-escalation) path does NOT call `markChecklistItemBlocked`. Tasks blocked via compound-gate recurrence stay `- [ ] title (#N)` while review-escalated tasks show `⚠️ blocked`. Inconsistent parent-issue state visible to users.

2. `run.mjs:1086` — User-skip path calls `commentIssue` but never updates the parent checklist. SPEC body requires `- [x] Task title (#N) *(skipped)*`. No `markChecklistItemSkipped` function exists.

Neither is in the "Done When" checklist; neither blocks merge. Both go to backlog.

---

## Note on Eval File Staleness

The `task-engineer/eval.md`, this file (prior version), and `task-security/eval.md` were all written as part of the parallel review cycle for the first attempt at task-6. They flag `if (parentBody)` at `run.mjs:1299/1357` and Markdown injection at `run.mjs:929` as open 🟡 items. These issues were **fixed in the same commit (9715e63)** that added those eval files:
- `if (parentBody !== null)` applied at both locations (confirmed by reading current `run.mjs:1298` and `run.mjs:1356`)
- `buildTaskIssueBody` with `Number.isInteger()` guard replaces the inline interpolation

The eval files are artifacts of an intermediate review state. The current code is correct.

---

## Findings

🟡 `bin/lib/finalize.mjs:9` — `setProjectItemStatus` imported but never called; dead import misleads contributors into thinking board status is updated at finalize time; remove to accurately reflect that no board config changes are needed

🟡 `bin/lib/finalize.mjs:123` — `issuesClosed++` fires unconditionally after `closeIssue()`; `closeIssue` returns `false` (never throws) on gh failure; `catch {}` at lines 129 and 138 is dead; `issuesClosed` count overstates actual GitHub closures; fix: `if (closeIssue(...)) issuesClosed++` at both call sites

🟡 `bin/lib/run.mjs:1311` — iteration-escalation (`escalationFired`) path does not call `markChecklistItemBlocked`; blocked tasks via compound-gate recurrence leave parent checklist as `- [ ]` while review-escalated tasks show `⚠️ blocked`; inconsistent user-visible state in parent issue; add `getIssueBody`/`markChecklistItemBlocked`/`editIssue` pattern matching run.mjs:1296–1302 → backlog

🟡 `bin/lib/run.mjs:1086` — user-skip path does not update parent checklist; SPEC body requires `- [x] Task title (#N) *(skipped)*`; no `markChecklistItemSkipped` function exists → backlog

🔵 `dashboard-ui/src/components/feature-detail.tsx` — unrelated dashboard UI formatting changes (token display `toFixed(4)→toFixed(2)`, new "Tokens" column) bundled in the "no-config-changes" verification commit (bacb532); correct changes but violates atomic-commit discipline; file separately in future

🔵 `bin/lib/finalize.mjs:124-127` — dead code: `projMatch` computed from `readTrackingConfig()` but never used; comment says "Best-effort: move to done on project board" with no implementation; remove to prevent misleading future contributors about whether board sync is wired
