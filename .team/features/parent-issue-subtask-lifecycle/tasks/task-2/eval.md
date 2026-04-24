## Parallel Review Findings

[architect] The prior tester review (task-1) contained two fabricated 🔴 bugs — both cited code paths don't exist in the current codebase. The compound gate correctly identified `fabricated-refs`. The feature itself is cleanly implemented.
[engineer] ### Key finding: Prior 🔴 criticals are fabricated
[engineer] The previous parallel review round (task-2/eval.md) had multiple roles citing two 🔴 bugs:
[product] **Critical note on the prior review (task-1 FAIL):** The two 🔴 criticals that blocked task-1 — `run.mjs:956` bare `return` and `github.mjs:126` `|| null` coercion — **do not exist in the current code.** I read both files directly:
[tester] **Prior eval.md critique:** The two 🔴 criticals in the prior Tester evaluation were verified as **fabricated**:
[security] The prior 🔴 criticals cited by the tester (task-1 handshake) were fabricated — confirmed absent:
🟡 [architect] `bin/lib/run.mjs:1352` — `editIssue(...)` return value discarded; a gh CLI failure silently drops the checklist tick with no warning to the user; assign return and log on `false`
🟡 [architect] `test/parent-checklist.test.mjs:97` — back-link template tests construct body inline, not via production code at `run.mjs:929–932`; a template regression passes silently; refactor to share a constant or call production code
🟡 [engineer] `bin/lib/run.mjs:1352` — `editIssue(...)` return value discarded; gh CLI failure during tick is invisible; check return and log a warning on false
🟡 [engineer] `test/parent-checklist.test.mjs:97` — back-link template tests construct body inline without calling `run.mjs:929–932`; production template regression passes silently; refactor to call production code
[engineer] **Verdict: PASS.** The core feature (gate-pass checklist tick) is correctly implemented. No critical issues found. Two 🟡 warnings must go to backlog.
🟡 [product] `bin/lib/run.mjs:1352` — `editIssue(...)` return value discarded; a GitHub API failure silently leaves the checklist un-ticked with no user-visible warning; log `⚠ Could not tick checklist for task #N` when return is false
🟡 [product] `.team/features/parent-issue-subtask-lifecycle/SPEC.md:20–21` — blocked and skipped checklist markers (spec items 3) not yet implemented; file as backlog before closing the feature
[product] 1. `editIssue` silent-failure warning (🟡)
🟡 [tester] `test/parent-checklist.test.mjs:97` — back-link template tests assert on self-constructed inline strings, not `run.mjs:929`; a template regression passes silently; extract template to a testable helper or call production code
🟡 [tester] `bin/lib/run.mjs:1348` — no integration test covers gate-pass → `getIssueBody` → `tickChecklistItem` → `editIssue` path; only the pure function is tested; add a mocked test asserting `editIssue` is called with ticked body after gate PASS
🟡 [tester] `bin/lib/run.mjs:1352` — `editIssue(...)` return value discarded; failed checklist tick is invisible to the user; log a warning on false return
🟡 [security] `bin/lib/run.mjs:1352` — `editIssue(...)` return value discarded; checklist tick failure is invisible; assign return and log a warning on false (backlog — confirmed by multiple reviewers)
🟡 [simplicity] `bin/lib/run.mjs:937-941` — PROJECT.md is re-read inside the for loop on every issue creation. `projectNum` (line 924) already holds the parsed value. Replace the inner try-catch with `if (projectNum) addToProject(issueNum, projectNum);`
[simplicity] The two 🟡 items from the prior tester review (`run.mjs:1352` discarded return, `test/parent-checklist.test.mjs:97` tautological back-link tests) remain unresolved and are confirmed still in backlog. No new criticals. **PASS.**
🔵 [architect] `bin/lib/run.mjs:929` — `backLink` is constant across loop iterations (depends only on `state.approvalIssueNumber`); hoist above the `for` loop for clarity
🔵 [engineer] `bin/lib/run.mjs:937` — `PROJECT.md` re-read and re-parsed per loop iteration despite `projectNum` already in scope from line 924; replace inner try-catch with `if (projectNum) addToProject(issueNum, projectNum);`
🔵 [product] `bin/lib/run.mjs:1350` — `if (parentBody)` guard coerces `""` (valid empty body) to falsy; use `if (parentBody !== null)` to match the `getIssueBody` return contract
🔵 [tester] `bin/lib/run.mjs:1350` — `if (parentBody)` truthy check silently skips tick when `getIssueBody` returns `""` (empty body on success vs. `null` on CLI failure); prefer `if (parentBody !== null)` to distinguish the two cases
🔵 [tester] `test/parent-checklist.test.mjs:60` — no test covers title containing regex-special characters (e.g. `"Fix (v2.0)"` or `"Add [flag]"`); add a case verifying the escaping at `github.mjs:143` handles these correctly
🔵 [security] `bin/lib/github.mjs:146` — `issueNumber` interpolated directly into regex without type coercion; add `String(issueNumber).replace(/\D/g, "")` guard for defence-in-depth (safe today — source is always integer from GitHub API or tamper-detected STATE.json)
🔵 [simplicity] `bin/lib/github.mjs:127` — `return result === null ? null : result` is identical to `return result`. The ternary adds no semantic content; remove it.
🔵 [simplicity] `bin/lib/github.mjs:146` — `body.replace(new RegExp(...), () => replacement)` — the callback wrapper adds indirection with no benefit since the replacement string has no `$`-special sequences. Pass `replacement` directly (caveat: keep callback if task titles could ever contain `$&`).

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs