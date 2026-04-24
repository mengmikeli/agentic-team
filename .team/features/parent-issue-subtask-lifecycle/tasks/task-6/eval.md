## Parallel Review Findings

🟡 [architect] `bin/lib/finalize.mjs:9` — `setProjectItemStatus` imported but never called; dead import overstates the module's board-sync capability; remove or implement
🟡 [architect] `bin/lib/finalize.mjs:116` — `readTrackingConfig()` feeds only a dead block (lines 124–127); `projMatch` computed but discarded; misleads contributors about board-move intent — remove until implemented
🟡 [architect] `bin/lib/finalize.mjs:128` — `issuesClosed++` fires unconditionally; `closeIssue()` returns `false` on failure (never throws), `catch {}` at line 129 is dead; change to `if (closeIssue(...)) issuesClosed++` (also line 136)
🟡 [architect] `bin/lib/run.mjs:937` — `PROJECT.md` re-read inside per-task loop; `projectNum` already extracted at lines 922–924; replace lines 937–940 with `if (projectNum) addToProject(issueNum, projectNum)`
🟡 [architect] `bin/lib/run.mjs:1310` — `escalationFired` blocked path transitions task without calling `markChecklistItemBlocked`; parent checklist stays `- [ ]`; review-escalation path (line 1296) correctly marks it — lifecycle asymmetry
🟡 [architect] `bin/lib/run.mjs:1085` — User-skip path calls `commentIssue` but skips checklist update; no `markChecklistItemSkipped` function exists
🟡 [product] `bin/lib/finalize.mjs:9` — `setProjectItemStatus` imported but never called; dead import misleads contributors into thinking board status is updated at finalize time; remove to accurately reflect no board config changes are needed
🟡 [product] `bin/lib/finalize.mjs:123` — `issuesClosed++` fires unconditionally after `closeIssue()` which returns `false` (never throws) on gh failure; `catch {}` at lines 129/138 is dead code; caller-visible count overstates actual GitHub closures; fix: `if (closeIssue(...)) issuesClosed++` at both call sites
🟡 [product] `bin/lib/run.mjs:1311` — `escalationFired` (iteration-escalation) path does not call `markChecklistItemBlocked`; tasks blocked via compound-gate recurrence stay `- [ ] title (#N)` while review-escalated tasks show `⚠️ blocked`; inconsistent parent-issue state visible to users; add `getIssueBody`/`markChecklistItemBlocked`/`editIssue` pattern matching run.mjs:1296–1302 → backlog
🟡 [product] `bin/lib/run.mjs:1086` — user-skip path does not update the parent checklist; SPEC body requires `- [x] Task title (#N) *(skipped)*`; no `markChecklistItemSkipped` function exists → backlog
[product] Four 🟡 warnings go to backlog. The two most user-visible gaps are the iteration-escalation path that leaves tasks silently `- [ ]` in the parent issue, and the skip path that never writes its checklist marker — both are spec body requirements absent from "Done When."
🟡 [tester] `bin/lib/run.mjs:1310` — `escalationFired` block path does not call `markChecklistItemBlocked`; parent checklist item stays `- [ ]` on iteration-escalation; no test exercises this path's checklist state; add the same `getIssueBody`/`markChecklistItemBlocked`/`editIssue` pattern used at lines 1297–1302
🟡 [tester] `bin/lib/run.mjs:1087` — User-skip path calls only `commentIssue` on the task issue; parent checklist receives no update (no skipped marker, no blocked marker); no test covers parent-checklist behavior on user-skip; add checklist update before `break`
🟡 [tester] `bin/lib/run.mjs:1386` — Gate-fail maxRetries blocked branches (lines 1386–1389, 1391–1395) call `commentIssue` only; parent approval issue body is never updated to show the blocked state; no test; add `markChecklistItemBlocked` call mirroring the review-escalation pattern at lines 1296–1302
🟡 [tester] `bin/lib/finalize.mjs:123` — `closeIssue()` returns `false` on `gh` failure (never throws); `catch {}` at line 129 is dead code; `issuesClosed++` fires unconditionally, overstating closures when `gh` is unavailable; `harness.test.mjs:315` passes only because the test stubs `gh` to succeed; change to `if (closeIssue(...)) issuesClosed++` (same at line 137)
🟡 [security] `bin/lib/finalize.mjs:21` / `finalize.mjs:76` — TOCTOU: `_written_by` tamper check runs on pre-lock `state`; `freshState` re-read inside the lock is never re-checked; re-apply check to `freshState` before use (→ backlog, pre-existing)
🟡 [security] `bin/lib/finalize.mjs:123,128` — `issuesClosed++` fires unconditionally; `closeIssue()` returns `false` (never throws) on gh failure; `catch {}` is dead code; change to `if (closeIssue(...)) issuesClosed++` at both call sites (→ backlog, pre-existing)
[security] - **`run.mjs:929` Markdown injection (previous 🟡) — FIXED.** `buildTaskIssueBody` now validates `Number.isInteger(approvalIssueNumber) && approvalIssueNumber > 0` before emitting the backlink. The test at line 1260 of the test output confirms `"55\n\n**evil**"` is rejected.
[security] - **`run.mjs:1298/1356` falsy body guard (previous 🟡) — FIXED.** Both `if (parentBody)` guards are now `if (parentBody !== null)`, correctly handling empty-string issue bodies.
[security] - The two remaining 🟡 items are pre-existing `finalize.mjs` debt not introduced or worsened by this commit.
🟡 [simplicity] `bin/lib/finalize.mjs:116` — `readTrackingConfig()` called, `projMatch` computed, block ends with a comment and no code. Silent no-op that forces readers to trace into `readTrackingConfig`, understand the return shape, and discover nothing happens. Remove the call or implement the board-move.
🟡 [simplicity] `bin/lib/finalize.mjs:9` — `setProjectItemStatus` imported but never called anywhere in this file; leftover from deferred board-sync. Remove from import.
🟡 [simplicity] `bin/lib/finalize.mjs:123` — `issuesClosed++` fires unconditionally; `closeIssue()` returns `false` on gh failure (never throws); `catch {}` is dead. Change to `if (closeIssue(...)) issuesClosed++` at both L123 and L136.
🟡 [simplicity] `bin/lib/run.mjs:937` — `PROJECT.md` re-read inside per-task loop; `projectNum` already extracted at L922–924. Replace lines 937–940 with `if (projectNum) addToProject(issueNum, projectNum)`.
🟡 [simplicity] `bin/lib/run.mjs:1310` — `escalationFired` exit path does not call `markChecklistItemBlocked`; the structurally adjacent `shouldEscalate()` path at L1296–1302 does. Asymmetric exit paths leave the parent issue silently stale on iteration-escalation blocks.
🟡 [simplicity] `bin/lib/run.mjs:1085` — User-skip exit path calls `commentIssue` but never updates parent checklist; all other terminal paths update it. Asymmetry is invisible at a glance.
🔵 [architect] `dashboard-ui/src/components/feature-detail.tsx:8,116` — (commit `bacb532`) unrelated UI changes (`toFixed` precision, Tokens column) bundled in a board-config verification commit; breaks atomic commit discipline
🔵 [architect] `bin/lib/github.mjs:145` — `tickChecklistItem` and `markChecklistItemBlocked` share identical regex/escape/replace boilerplate; extract a shared `replaceChecklistItem` helper
🔵 [architect] `bin/lib/github.mjs:146` — regex lacks `m` flag and `^` anchor; could match mid-line in pathological issue bodies (same at line 161)
🔵 [product] `dashboard-ui/src/components/feature-detail.tsx` — unrelated token display formatting changes bundled in the "no-config-changes" verification commit (bacb532); correct changes but violates atomic-commit discipline
🔵 [product] `bin/lib/finalize.mjs:124-127` — dead code: `projMatch` computed but never used; comment "Best-effort: move to done on project board" has no implementation; remove to prevent misleading contributors
🔵 [tester] `bin/lib/github.mjs:146` — `tickChecklistItem` regex lacks `m` flag and `^` anchor; same at `markChecklistItemBlocked:161`; no test covers a multi-section issue body where the item appears after a non-`##` heading; add multiline flag to avoid mid-line false matches
🔵 [tester] `bin/lib/run.mjs:937` — PROJECT.md read again inside the per-task loop; `projectNum` already extracted at line 922–924 before the loop; replace lines 936–940 with `if (projectNum) addToProject(issueNum, projectNum)`
🔵 [security] `bin/lib/finalize.mjs:134` — `if (freshState.approvalIssueNumber)` accepts non-integer truthy values; add `Number.isInteger(freshState.approvalIssueNumber) && freshState.approvalIssueNumber > 0`
🔵 [security] `bin/lib/github.mjs:176` — `featureName` and `title` embedded raw in issue body; a crafted value renders arbitrary markdown in the GitHub issue; low risk for a local dev tool
🔵 [simplicity] `bin/lib/github.mjs:141` — `tickChecklistItem` and `markChecklistItemBlocked` duplicate guard + escape + regex; extract `replaceChecklistItem(body, title, issueNumber, replacement)` helper to keep them in sync.
🔵 [simplicity] `bin/lib/github.mjs:145` — Regex in both checklist functions lacks `^` anchor and `m` flag; could match mid-line on unusual bodies. One-char fix per function.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs