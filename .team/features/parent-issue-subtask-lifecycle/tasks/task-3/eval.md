## Architect Review — parent-issue-subtask-lifecycle

**Task:** Each task issue body contains `Part of #N` linking back to the parent approval issue

---

## Files Read

- `.team/features/parent-issue-subtask-lifecycle/tasks/task-1/handshake.json`
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-2/handshake.json`
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-3/handshake.json`
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-4/handshake.json`
- `.team/features/parent-issue-subtask-lifecycle/tasks/task-4/artifacts/test-output.txt`
- `bin/lib/run.mjs` (lines 880–962, 1290–1365)
- `bin/lib/github.mjs` (lines 131–173)
- `bin/lib/outer-loop.mjs` (lines 567–820)
- `test/parent-checklist.test.mjs` (lines 134–152)

---

## Implementation Verification

The back-link feature is implemented at `run.mjs:929-932`:

```js
const backLink = state?.approvalIssueNumber ? `\n\nPart of #${state.approvalIssueNumber}` : "";
const issueNum = createIssue(
  `...${task.title}`,
  `Auto-created by \`agt run\` for feature **...${featureName}**.\n\nTask: ${task.title}${backLink}`,
);
```

**Lifecycle correctness confirmed:**
- `approvalIssueNumber` is written to STATE.json at `outer-loop.mjs:778` before `runSingleFeature` is invoked at `outer-loop.mjs:820`
- `runSingleFeature` reads STATE.json at `run.mjs:892` (`const state = readState(featureDir)`)
- By the time task issues are created at `run.mjs:927-944`, `state.approvalIssueNumber` is already populated
- The conditional correctly omits the back-link when no approval issue exists

**Test suite:** 614 pass, 0 fail. Back-link tests at `test/parent-checklist.test.mjs:135-152` pass.

---

## Findings

🟡 test/parent-checklist.test.mjs:140 — Tautological test: hardcodes `Part of #${approvalIssueNumber}` directly into the body string being constructed, then asserts the body includes it; does not import or invoke any production function from `run.mjs`; would pass even if `run.mjs:929` were deleted; replace with a test that mirrors the run.mjs backLink conditional (`approvalIssueNumber ? \`\n\nPart of #N\` : ""`) or exercises the actual body construction path

🟡 bin/lib/run.mjs:1311 — Iteration-escalation (`escalationFired`) branch does not call `markChecklistItemBlocked`; tasks blocked via iteration escalation show `- [ ] title (#N)` (unchecked) in the parent checklist while review-escalation-blocked tasks show `- [ ] ~~title~~ (#N) ⚠️ blocked`; add the same `getIssueBody`/`markChecklistItemBlocked`/`editIssue` pattern from `run.mjs:1297-1302` to maintain consistent parent-issue UI (pre-existing backlog item)

🟡 bin/lib/run.mjs:1299 — `if (parentBody)` coerces `""` to falsy; `getIssueBody` returns `""` for a valid issue with no body content, silently skipping the blocked-marker write; use `if (parentBody !== null)` to match the documented return contract (pre-existing backlog item)

🔵 bin/lib/github.mjs:141 — `tickChecklistItem` and `markChecklistItemBlocked` duplicate the guard check, title-escaping expression, and regex skeleton; extract `replaceChecklistItem(body, title, issueNumber, replacement)` helper to eliminate duplication and make future format changes touch a single location

🔵 bin/lib/github.mjs:161 — Regex not anchored with `^` and multiline flag `m`; could match mid-line in edge-case issue bodies with indented list items; use `new RegExp(\`^- \\\\[ \\\\] ${escaped} \\\\(#${issueNumber}\\\\)\`, 'm')` for robustness

---

## Per-Criterion Results

| Criterion | Result | Evidence |
|---|---|---|
| Feature implemented | ✅ PASS | `run.mjs:929-932` constructs `backLink` and appends to issue body |
| Lifecycle correct | ✅ PASS | `approvalIssueNumber` written to STATE.json (outer-loop.mjs:778) before `runSingleFeature` (outer-loop.mjs:820) |
| Conditional omission works | ✅ PASS | `state?.approvalIssueNumber` guard; test line 148-150 mirrors the logic and passes |
| Tests pass | ✅ PASS | 614/614, 0 fail |
| Test quality | 🟡 WARN | Back-link "positive" test (line 140) is tautological — does not exercise run.mjs |
| Checklist coherence | 🟡 WARN | Iteration-escalation branch skips `markChecklistItemBlocked` |
| Guard correctness | 🟡 WARN | `if (parentBody)` falsy coercion on empty-string body |

---

## Overall Verdict: PASS

The feature is correctly implemented and structurally sound. The `Part of #N` back-link flows cleanly through the outer-loop → STATE.json → task issue creation pipeline. No critical issues found.

Three 🟡 warnings go to backlog: one test coverage gap (tautological test), two pre-existing patterns flagged in prior review rounds. No new regressions introduced.
