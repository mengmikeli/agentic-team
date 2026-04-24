# Architect Review — parent-issue-subtask-lifecycle
## Task: No extra project board columns or config changes are required

**Overall Verdict: PASS**

Gate passed (exit 0). All tests green. No new critical architectural violations or broken boundaries introduced. The warnings below are pre-existing debt confirmed this cycle — they belong in the backlog.

---

## Files Actually Read

- `.team/features/parent-issue-subtask-lifecycle/tasks/task-{1..6}/handshake.json`
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-6/artifacts/test-output.txt`
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-6/eval.md`
- `bin/lib/finalize.mjs` (full file, 151 lines)
- `bin/lib/github.mjs` (lines 1–200)
- `bin/lib/run.mjs` (lines 910–1010, 1075–1130, 1280–1410)
- `test/parent-checklist.test.mjs` (full file, 168 lines)
- `git show --stat HEAD` and `git show --stat bacb532`
- `git show bacb532 -- dashboard-ui/src/components/feature-detail.tsx`

---

## Per-Criterion Results

### 1. No New Project Board Columns or Config Required — PASS
Evidence: The commit diff for HEAD (`9715e63`) touches only `bin/lib/github.mjs` (+13),
`bin/lib/run.mjs` (+9/-?), `test/parent-checklist.test.mjs` (+47/-?), and `.team/` state
files. No new status fields, option IDs, or `readTrackingConfig` keys were added.
`setProjectItemStatus` calls the existing `done` option at `run.mjs:1353` — no new column needed.

### 2. `buildTaskIssueBody` Extraction — PASS
The back-link logic was correctly extracted from an inline template literal in `run.mjs` to a
named function `buildTaskIssueBody` in `github.mjs:170`. Integer guard
(`Number.isInteger(approvalIssueNumber) && approvalIssueNumber > 0`) prevents Markdown injection
via a crafted `STATE.json`. Tests at `test/parent-checklist.test.mjs:135–166` directly exercise
the extracted function including the injection guard.

### 3. Gate Passes — PASS
`npm test` exit code 0. All 60+ test cases pass (verified in `task-6/artifacts/test-output.txt`).
No fabricated test output — test durations are plausible (ms-range unit tests, 700ms sleep-based
waitForApproval tests).

### 4. Lifecycle Symmetry — FAIL (partial, backlog)
Three blocked paths do not update the parent checklist:
- `escalationFired` branch (`run.mjs:1310–1316`) — no `markChecklistItemBlocked` call.
  Compare: review-escalation (`run.mjs:1296–1302`) correctly calls it.
- User-skip branch (`run.mjs:1085–1091`) — only calls `commentIssue`; no checklist marker.
- Gate-fail maxRetries branch (`run.mjs:1368–1396`) — no checklist update on final block.
These are pre-existing gaps confirmed since prior cycles. No new regression introduced here.

### 5. Dead Code in `finalize.mjs` — FAIL (backlog, 3rd cycle)
`setProjectItemStatus` is imported (`finalize.mjs:9`) but never called anywhere in the file.
`readTrackingConfig()` is called (`finalize.mjs:116`) but its result feeds only a dead block
(`lines 124–127`) that computes `projMatch` and immediately discards it. The comment
"Best-effort: move to done on project board" signals intent without implementation, misleading
future contributors about the finalize boundary's actual behavior.

### 6. Inaccurate Issue-Close Counter — FAIL (backlog, 3rd cycle)
`closeIssue()` returns `bool` (never throws). `runGh` wraps all gh calls in try/catch and returns
null on failure. The `catch {}` at `finalize.mjs:129,138` is dead. `issuesClosed++` fires
unconditionally at lines 128 and 136 regardless of whether the gh call succeeded, overstating
the reported closed count in the JSON output.

### 7. Commit Scope Creep — INFO
Commit `bacb532` (one of two "No extra project board columns" commits) bundles unrelated dashboard
UI changes in `dashboard-ui/src/components/feature-detail.tsx`: `toFixed(4) → toFixed(2)` and a
new "Tokens" column in the By Phase table. The changes are correct but violate atomic-commit
discipline. The task title and its changes should be self-contained.

---

## Findings

🟡 bin/lib/finalize.mjs:9 — `setProjectItemStatus` imported but never called; dead import overstates the module's board-sync capability; remove or implement
🟡 bin/lib/finalize.mjs:116 — `readTrackingConfig()` result only feeds dead block at lines 124–127; `projMatch` computed but discarded; signals unfinished board-move feature to future contributors — remove until implemented
🟡 bin/lib/finalize.mjs:128 — `issuesClosed++` fires unconditionally; `closeIssue()` returns `false` on gh failure (never throws), making `catch {}` dead; change to `if (closeIssue(...)) issuesClosed++` at lines 128 and 136
🟡 bin/lib/run.mjs:937 — `PROJECT.md` re-read inside per-task loop; `projectNum` already extracted at line 922–924; replace lines 937–940 with `if (projectNum) addToProject(issueNum, projectNum)`
🟡 bin/lib/run.mjs:1310 — `escalationFired` block path transitions task to `blocked` but never calls `markChecklistItemBlocked`; parent checklist stays `- [ ]` while review-escalation path (line 1296) correctly marks it blocked — lifecycle asymmetry, move to backlog
🟡 bin/lib/run.mjs:1085 — User-skip path calls `commentIssue` but makes no checklist update on parent issue; SPEC body requires a `*(skipped)*` marker; no `markChecklistItemSkipped` function exists
🔵 dashboard-ui/src/components/feature-detail.tsx:8,116 — (commit bacb532) unrelated UI changes (`toFixed` precision, Tokens column) bundled in a task commit scoped to board config verification; breaks atomic commit discipline and makes history harder to bisect
🔵 bin/lib/github.mjs:145 — `tickChecklistItem` and `markChecklistItemBlocked` share identical regex/escape/replace structure; extract a `replaceChecklistItem(body, title, issueNumber, replacement)` helper to DRY both functions
🔵 bin/lib/github.mjs:146 — regex `- \\[ \\] ${escaped} \\(#${issueNumber}\\)` has no `m` flag; could match mid-line text in pathological issue bodies; add multiline flag and `^` anchor (same issue in markChecklistItemBlocked:161)

---

## Summary

The task's stated goal — confirming no new board columns or config are needed — is verified:
`setProjectItemStatus` uses the existing `done` status, and the existing `pending-approval` /
`ready` options handle the approval gate. No schema changes required.

The 🟡 findings are all pre-existing debt (confirmed across 3+ prior review cycles). The two
most architecturally significant are the dead `finalize.mjs` board-sync block (which creates a
false expectation about finalize's scope) and the lifecycle asymmetry between blocked paths (some
update the checklist, others silently don't). Both belong in the backlog with an explicit owner.
