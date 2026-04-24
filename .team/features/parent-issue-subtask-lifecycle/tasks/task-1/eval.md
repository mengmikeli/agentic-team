## Parallel Review Findings

[architect] The prior 🔴 critical (data-loss on `getIssueBody` null) **is already fixed** — `run.mjs:956` has `if (currentBody === null) return;`. The prior eval's red findings are stale.
🔴 [engineer] `bin/lib/run.mjs:956` — `if (currentBody === null) return;` exits the entire enclosing function, silently aborting all task execution on any `getIssueBody` failure; replace with a graceful skip: log `⚠ Could not fetch parent body — skipping checklist` and continue past the block
🔴 [engineer] `bin/lib/github.mjs:126` — `runGh(...) || null` coerces an empty body string `""` to `null`; an approval issue with no body triggers the `return` at line 956 and aborts the run; fix `getIssueBody` to return `""` on an empty-but-successful call, and `null` only on actual CLI failure
[engineer] The Architect reviewer's PASS was premature. The null-guard fix at line 956 introduced a new critical: the bare `return` exits the entire `runSingleFeature` function, aborting all task execution whenever `getIssueBody` returns null. This is reachable in production any time the approval issue has an empty body (coerced to null by `|| null`) or when `gh` has a transient failure. Both 🔴s need to be fixed — the scope of the `return` and the `getIssueBody` empty-body handling — before this ships.
🔴 [product] bin/lib/run.mjs:1117 — Criteria 2 unimplemented: no code updates parent checklist from `- [ ]` to `- [x]` when a task gate passes; the only `editIssue` call in the entire codebase is the initial append at `run.mjs:958`; add line-replacement logic after gate PASS transition
🔴 [product] bin/lib/run.mjs:1088 — Criteria 3 unimplemented: no code adds `⚠️ blocked` marker to parent checklist when a task is blocked/escalated; block paths at `run.mjs:1088`, `1298`, `1357` call `commentIssue` on the **task** issue only — the parent issue checklist is never updated
[tester] 602/602 tests pass. The prior 🔴 data-loss bug (`getIssueBody || ""` overwriting parent body) is **already fixed** in `run.mjs:956` — confirmed by reading the code directly. No critical findings.
🔴 [security] bin/lib/run.mjs:956 — `if (currentBody === null) return;` exits `_runSingleFeature` (declared line 716), silently aborting all task execution when `getIssueBody` returns null; replace with a conditional skip: `if (currentBody !== null && !currentBody.includes("## Tasks")) { editIssue(...); }`
🔴 [security] bin/lib/github.mjs:126 — `runGh(...) || null` coerces an empty issue body `""` to `null`; an approval issue with no body (created without SPEC content, or manually edited empty) triggers the abort at run.mjs:956 with no log or warning; return `""` for empty body and `null` only when `result.status !== 0`
[security] **Two 🔴 criticals block merge** — both are in the same code region and stem from the same fix attempt:
🔴 [simplicity] bin/lib/run.mjs:956 — `return` inside three nested conditionals exits all of `_runSingleFeature`, silently aborting task execution when `getIssueBody` returns null; the simpler correct replacement: `if (currentBody !== null && !currentBody.includes("## Tasks")) { editIssue(...); }` — zero hidden exits, one fewer nesting level
🟡 [architect] `bin/lib/run.mjs:937-941` — PROJECT.md re-read inside per-task loop; `projectNum` already parsed at line 924; replace with `if (projectNum) addToProject(issueNum, projectNum)`
🟡 [architect] `bin/lib/run.mjs:957` — `!currentBody.includes("## Tasks")` too broad; any parent body with that heading permanently suppresses the checklist with no diagnostic; use a unique sentinel (e.g. `<!-- agt-tasks -->`) in `buildTasksChecklist`
🟡 [architect] `bin/lib/run.mjs:958` — `editIssue(...)` return value discarded; silent failure on GitHub API error; check and log `⚠ Could not append Tasks checklist to issue #N`
🟡 [architect] `bin/lib/run.mjs:1324` — Tasks injected by `applyReplan` never get GitHub issues created and the parent checklist is never updated; checklist becomes stale after any replan — highest-priority backlog item
🟡 [architect] `test/parent-checklist.test.mjs:60` — back-link tests assert on their own inline template (lines 64, 72-73), not production code; regressions at `run.mjs:929` pass silently
🟡 [engineer] `bin/lib/run.mjs:937-940` — PROJECT.md re-read per task inside the creation loop; `projectNum` already parsed at line 924 — replace inner `readFileSync`+re-parse with `if (projectNum) addToProject(issueNum, projectNum)`
🟡 [engineer] `bin/lib/run.mjs:958` — `editIssue()` return value is discarded; silent failure leaves checklist unappended with no user warning; check return and log `⚠ Could not append Tasks checklist to issue #N`
🟡 [engineer] `test/parent-checklist.test.mjs:59` — back-link tests construct the body template inline rather than calling production code at `run.mjs:929`; a regression passes silently; refactor to call production code
🟡 [product] test/parent-checklist.test.mjs:60 — Back-link tests assert on their own inline string literal, not `run.mjs:929`; a regression in the production template passes silently; rewrite to mock `createIssue` and assert on the `body` argument actually passed
🟡 [product] bin/lib/run.mjs:957 — `editIssue()` return value is discarded; checklist-append failures are invisible to the user; check return value and log a warning
🟡 [tester] test/parent-checklist.test.mjs:60 — Back-link tests assert on self-constructed string literals, not production code at run.mjs:929; a production regression is invisible to these tests; refactor to call a helper or mock `createIssue` and inspect the body argument
🟡 [tester] bin/lib/run.mjs:951 — The `getIssueBody` → null guard → `## Tasks` check → `editIssue` orchestration (lines 951–960) has zero test coverage; add integration test mocking both functions covering three paths: null body, body already containing `## Tasks`, and clean body triggering edit
🟡 [tester] bin/lib/run.mjs:956 — Null guard preventing data loss has no regression test; add assertion that `editIssue` is NOT called when `getIssueBody` returns null, otherwise a future refactor can silently remove the guard
🟡 [tester] bin/lib/run.mjs:951 — Tasks added via `applyReplan` bypass the issue-creation loop and the checklist update entirely; stale-checklist behavior after a replan is untested — add a test or document as known limitation
🟡 [security] bin/lib/github.mjs:139 — `t.title` interpolated without stripping newlines; a title containing `\n- [x] Fake task (#0)` injects a pre-checked list item into the parent issue body, misleading approval stakeholders about task completion state; add `.replace(/[\r\n]+/g, " ")` before interpolation
[security] The 🟡 (newline injection into checklist) is a workflow-integrity concern that goes to backlog — low-severity given the personal-tool context but warrants a one-line fix before wider use.
🟡 [simplicity] bin/lib/github.mjs:136 — `buildTasksChecklist` is a pure string formatter (no `gh` I/O, no side effects); placing it in `github.mjs` alongside CLI-backed functions creates a false expectation that all exports are I/O operations — move to `util.mjs` (prior reviews labeled this 🔵; escalating because the import line `getIssueBody, editIssue, buildTasksChecklist` actively misleads)
🟡 [simplicity] test/parent-checklist.test.mjs:60 — "back-link template" tests build the expected string inline without calling `run.mjs:929`; they test their own literal, not production code; a template change in `run.mjs` passes these tests silently — remove or label as documentation-only
[simplicity] The two 🟡 items are backlog candidates. 🔵 is cosmetic.
🔵 [architect] `bin/lib/run.mjs:929` — `backLink` recomputed on every loop iteration but is constant; hoist above the `for` loop
🔵 [architect] `bin/lib/github.mjs:136` — `buildTasksChecklist` is a pure formatter with no I/O; move to `util.mjs` to keep `github.mjs` as a pure I/O boundary
🔵 [architect] `bin/lib/github.mjs:139` — `t.title` embedded without newline stripping; an LLM-generated title containing `\n` produces a broken checklist item; add `.replace(/[\r\n]+/g, " ")`
🔵 [engineer] `bin/lib/github.mjs:139` — `t.title` interpolated without newline stripping; an LLM-generated title with `\n` produces a broken checklist item; add `.replace(/[\r\n]+/g, " ")`
🔵 [engineer] `bin/lib/run.mjs:929` — `backLink` is constant per call but recomputed on each loop iteration; hoist above the `for` loop
🔵 [tester] bin/lib/github.mjs:124 — `getIssueBody` and `editIssue` have no null-input guard tests unlike `commentIssue`; add parity tests for consistency
🔵 [security] bin/lib/github.mjs:138 — `t.issueNumber` passes only a truthiness check; add `Number.isInteger(t.issueNumber) && t.issueNumber > 0` as defence-in-depth (low risk given HMAC tamper detection on STATE.json)
🔵 [simplicity] bin/lib/run.mjs:929 — `backLink` is recomputed on every loop iteration; `state.approvalIssueNumber` does not change in the loop; hoist above the `for` to make the invariant visible

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs