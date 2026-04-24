## Engineer Review — parent-issue-subtask-lifecycle

**Reviewer role:** Software Engineer
**Task:** No extra project board columns or config changes are required — existing status flow is sufficient
**Scope:** Full feature implementation review (correctness, code quality, error handling, performance)

---

## Files Read

- `bin/lib/run.mjs` (lines 1–20, 915–962, 1075–1115, 1280–1370)
- `bin/lib/github.mjs` (lines 120–190)
- `bin/lib/finalize.mjs` (full, 151 lines)
- `bin/lib/outer-loop.mjs` (lines 730–820)
- `test/parent-checklist.test.mjs` (full, 153 lines)
- `.team/features/parent-issue-subtask-lifecycle/SPEC.md`
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-6/artifacts/test-output.txt` (lines 1–200)
- Handshake files for task-1 through task-6

---

## Implementation Verification

### Back-link in task issue body (`Part of #N`)
`run.mjs:929–932` constructs `backLink` conditionally on `state?.approvalIssueNumber` and appends it to the issue body passed to `createIssue`. The lifecycle is correct: `approvalIssueNumber` is written to STATE.json at `outer-loop.mjs:778` before `runSingleFeature` is called, and `run.mjs:892` reads it back before the issue creation loop at line 927.

**Gap:** No integer validation on `state.approvalIssueNumber` before string interpolation.

### `## Tasks` checklist appended to parent issue
`run.mjs:952–960` calls `buildTasksChecklist(tasks)` then `getIssueBody` and `editIssue` to append the checklist. The idempotency guard `!currentBody.includes("## Tasks")` prevents double-appending. Functions `buildTasksChecklist`, `tickChecklistItem`, `markChecklistItemBlocked` are all present and tested in `test/parent-checklist.test.mjs`.

### Gate pass → tick checklist
`run.mjs:1355–1361`: confirmed. Guard `if (parentBody)` is falsy — see warning below.

### Review-round escalation → blocked marker
`run.mjs:1297–1303`: `markChecklistItemBlocked` called. Correct.

### Iteration-escalation blocked path
`run.mjs:1311–1317`: no `markChecklistItemBlocked` call. SPEC body requires the blocked marker for all blocked/escalated paths. Missing.

### User-skip path
`run.mjs:1086–1092`: no checklist update. SPEC body requires `- [x] Task title (#N) *(skipped)*` when a task is skipped. No `markChecklistItemSkipped` function was implemented. Missing.

### `agt finalize` closes parent approval issue
`finalize.mjs:133–139`: reads `freshState.approvalIssueNumber`, calls `closeIssue`, increments `issuesClosed`. `closeIssue` never throws (returns `false` on failure), so the `catch {}` never fires and `issuesClosed++` always runs. Counter is inflated on silent failure.

### No new project board config
Confirmed: no new board columns, status fields, or option IDs added anywhere in the implementation.

### Tests pass
Gate output (task-6): `npm test` exit 0. All existing tests pass.

---

## Findings

🟡 test/parent-checklist.test.mjs:136 — Both back-link tests are tautologies: the body string is built inline in the test (`Part of #${approvalIssueNumber}` hardcoded), not via any production function; deleting `run.mjs:929` leaves both tests green; add a test that stubs `createIssue`, runs the task-issue creation path with `state.approvalIssueNumber` set, and asserts the stub received a body containing `Part of #N`

🟡 bin/lib/run.mjs:1086 — User-skip path calls `commentIssue` and `harness transition --status blocked` but never updates the parent checklist; SPEC explicitly requires `- [x] Task title (#N) *(skipped)*` when a task is skipped; add a `markChecklistItemSkipped` function in `github.mjs` mirroring `markChecklistItemBlocked`, and call it here

🟡 bin/lib/run.mjs:1311 — `escalationFired` (iteration-escalation) blocked path does not call `markChecklistItemBlocked`; SPEC says "when a task is blocked/escalated: prefix with blocked marker"; the `shouldEscalate()` path at line 1297 has the call but iteration-escalation does not; add the same `getIssueBody`/`markChecklistItemBlocked`/`editIssue` pattern here

🟡 bin/lib/run.mjs:1299 — `if (parentBody)` coerces `""` to falsy; `getIssueBody`'s own docstring says it "Returns string (may be '') on success, null on CLI failure"; an approval issue with an empty body silently skips the blocked-marker write; change to `if (parentBody !== null)`

🟡 bin/lib/run.mjs:1357 — Same `if (parentBody)` falsy guard as line 1299 in the gate-pass checklist tick path; same fix: `if (parentBody !== null)`

🟡 bin/lib/run.mjs:929 — `state.approvalIssueNumber` is interpolated directly into the GitHub issue body string without integer validation; a corrupt STATE.json with `approvalIssueNumber: "99\n\n**evil**"` injects arbitrary Markdown into the task issue body; add `Number.isInteger(state.approvalIssueNumber)` guard before interpolation

🟡 bin/lib/finalize.mjs:123 — `issuesClosed++` fires unconditionally after `closeIssue(task.issueNumber, comment)` even when `closeIssue` returns `false` (gh unavailable, not thrown); reported count overstates actual GitHub closures; change to `if (closeIssue(task.issueNumber, comment)) issuesClosed++`; same issue at line 136 for the approval issue close

🟡 bin/lib/finalize.mjs:9 — `setProjectItemStatus` is imported but never called anywhere in `finalize.mjs`; dead import

🟡 bin/lib/run.mjs:938 — `PROJECT.md` is read from disk again inside the per-task loop; `projectNum` was already extracted at `run.mjs:922–924` before the loop; replace lines 938–940 with `if (projectNum) addToProject(issueNum, projectNum)` to eliminate redundant I/O on every task

🔵 bin/lib/github.mjs:141 — `tickChecklistItem` and `markChecklistItemBlocked` duplicate the guard check, title-escaping expression, and regex skeleton; extract a shared `replaceChecklistItem(body, title, issueNumber, replacement)` helper to make future format changes touch a single location

🔵 bin/lib/github.mjs:146 — Regex is not anchored with `^` or multiline flag `m`; could match a mid-line occurrence in unusual body layouts; use `new RegExp(\`^- \\\\[ \\\\] ${escaped} \\\\(#${issueNumber}\\\\)\`, 'm')`; same issue at line 161

🔵 bin/lib/finalize.mjs:116 — `readTrackingConfig()` and `projMatch` are dead code — result is read but the block at lines 124–127 does nothing; remove until the board-move is actually implemented to avoid misleading contributors

---

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| `## Tasks` checklist appended to parent after planning | ✅ PASS | `run.mjs:952–960`; `buildTasksChecklist` tested in `parent-checklist.test.mjs` |
| Gate pass → `[x]` in checklist | ✅ PASS | `run.mjs:1355–1361` calls `tickChecklistItem`; guarded by `if (task.issueNumber && state?.approvalIssueNumber)` |
| Review-round escalation → blocked marker | ✅ PASS | `run.mjs:1297–1303` calls `markChecklistItemBlocked` |
| Iteration-escalation → blocked marker | 🟡 WARN | `run.mjs:1311` has no `markChecklistItemBlocked` call; parent checklist stays unchecked |
| User-skip → skipped marker in checklist | 🟡 WARN | `run.mjs:1086` has no checklist update; `markChecklistItemSkipped` not implemented |
| `Part of #N` back-link in task issue body | ✅ PASS | `run.mjs:929–932`; `state.approvalIssueNumber` guard correct |
| Back-link test quality | 🟡 WARN | `parent-checklist.test.mjs:136–152` both tests tautological; no production-code coverage |
| `agt finalize` closes parent approval issue | ✅ PASS | `finalize.mjs:133–139`; confirmed by `harness.test.mjs` subprocess test |
| `issuesClosed` counter accuracy | 🟡 WARN | `finalize.mjs:123,136` increments unconditionally; `closeIssue` returns false on failure |
| No new project board config | ✅ PASS | No new columns, status fields, or option IDs in any changed file |
| All existing tests pass | ✅ PASS | Gate output: npm test exit 0 |
| `if (parentBody)` guard correctness | 🟡 WARN | `run.mjs:1299,1357` coerces `""` to falsy; should be `!== null` |

---

## Overall Verdict: PASS

The core feature is correctly implemented and the test suite passes (exit 0). The checklist append, gate-pass tick, review-round escalation blocked marker, `Part of #N` back-link, and approval-issue closure all function correctly.

Nine 🟡 warnings go to backlog. The two most material are:
1. The user-skip path and iteration-escalation blocked path both miss checklist updates (SPEC body requirements, not in Done When); and
2. The `if (parentBody)` falsy guard silently skips writes on empty-body issues.

No new project board columns or config changes were added — the existing status flow is sufficient, as required by this task's spec criterion.
