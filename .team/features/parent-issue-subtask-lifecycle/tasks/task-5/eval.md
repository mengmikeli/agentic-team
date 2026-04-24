## Parallel Review Findings

🟡 [architect] `bin/lib/finalize.mjs:116–128` — `readTrackingConfig()` is called and a `projMatch` regex is computed, but both are immediately discarded — the block's only content is a comment. Remove this dead stub or implement it; leaving dead code here misleads future contributors about board cleanup being wired up.
🟡 [architect] `bin/lib/finalize.mjs:129` — silent `catch {}` on task-issue close is acceptable (best-effort cleanup), but the *identical* silent catch at line 138 for the approval issue means a `closeIssue` failure inflates `issuesClosed` — callers read `issuesClosed: 1` and believe the parent was closed when it wasn't. Emit a warning field or log to stderr on failure.
🟡 [engineer] `bin/lib/finalize.mjs:9` — `setProjectItemStatus` is imported but never called in the file. Dead import.
🟡 [engineer] `bin/lib/finalize.mjs:124-127` — `projMatch` is computed but never read. The project-board "done" update is a comment-only stub. Remove or implement.
🟡 [engineer] `bin/lib/finalize.mjs:123` — `issuesClosed++` fires unconditionally after `closeIssue(...)` even when `closeIssue` returns `false` (gh exited non-zero). Since `runGh` never throws, the `catch {}` never fires. The counter claims "closed" on silent failure. Fix: `if (closeIssue(...)) issuesClosed++` at lines 123 and 136.
🟡 [product] `test/integration.test.mjs:244` — Integration test asserts only `typeof result.issuesClosed === "number"`; removing the approval-close block leaves this test green (`0` is still a number); strengthen to `assert.equal(result.issuesClosed, 1)` — log to backlog (covered by harness test, not a blocker)
🟡 [tester] `test/harness.test.mjs:419-422` — Test asserts `ghCalls.includes("500")` but does not assert the comment text `"Feature finalized — all tasks complete."`. Both task-comment tests (passed/skipped) assert their exact comment strings; the approval-close test does not. Add: `assert.ok(ghCalls.includes("Feature finalized — all tasks complete."))` — backlog item, inconsistent coverage.
🟡 [tester] `test/integration.test.mjs:244` — `assert.ok(typeof result.issuesClosed === "number")` passes even when `issuesClosed === 0` (gh unavailable, close silently fails). No fake `gh` binary is used here so this assertion gives no signal that the close actually occurred. Tighten with a fake `gh` binary or assert the specific count — backlog item.
🟡 [security] `bin/lib/finalize.mjs:128` — `issuesClosed++` fires unconditionally; `closeIssue()` returns `false` (not throws) when `gh` is unavailable, so reported count overstates actual GitHub closures; check return value before incrementing
🟡 [security] `bin/lib/finalize.mjs:21` — `_written_by === "at-harness"` tamper check uses a constant visible in source — trivially forgeable by anyone who can write STATE.json; do not document as a security boundary
🟡 [simplicity] `bin/lib/finalize.mjs:9` — `setProjectItemStatus` is imported but never called; remove from import
🟡 [simplicity] `bin/lib/finalize.mjs:116` — `readTrackingConfig()` runs a file read on every finalize call; result is used only in a dead block (lines 124-126) that computes `projMatch` and does nothing — remove both or complete the implementation
🟡 [simplicity] `bin/lib/finalize.mjs:123` — `issuesClosed` increments unconditionally after `closeIssue(...)` even when it returns `false` (gh silently failed); counter is inflated on failure — change to `if (closeIssue(...)) issuesClosed++`; same issue at line 136
[simplicity] The core behavior is correctly implemented and verified. `harness.test.mjs:377-426` uses a fake `gh` binary, asserts `issuesClosed === 2`, and confirms issue `500` appears in the `gh` call log — direct evidence the close fires. The three 🟡 warnings are backlog cleanup items around dead code left over from an abandoned "move to done on project board" implementation.
🔵 [architect] `bin/lib/outer-loop.mjs:738–741` — `approvalIssueNumber` has dual storage (signed `approval.json` + STATE.json recovery copy). The two copies can diverge silently; the comment documents intent but future mutations to the brainstorm step could drop the STATE.json copy and lose the recovery path.
🔵 [architect] `bin/lib/finalize.mjs:1` — header comment says `at-harness finalize` but the binary is `agt-harness`. Minor internal doc inconsistency.
🔵 [engineer] `bin/lib/finalize.mjs:116` — `readTrackingConfig()` file read is pointless until the dead `projMatch` block is implemented. Remove.
🔵 [product] `bin/lib/finalize.mjs:124-128` — Dead code: `projMatch` is computed but never used; comment says "Best-effort: move to done on project board" but no call follows — remove or implement
🔵 [tester] `bin/lib/finalize.mjs:134` — `if (freshState.approvalIssueNumber)` silently skips falsy-but-present values (`0`, `""`). Invalid but untested edge cases.
🔵 [security] `bin/lib/finalize.mjs:125` — `projMatch` computed but never used (dead code); either implement the board-move call or remove the regex
🔵 [security] `bin/lib/finalize.mjs:134` — `approvalIssueNumber` is only falsy-checked before use; add `Number.isInteger(freshState.approvalIssueNumber)` guard to prevent silent failures from malformed STATE.json
🔵 [simplicity] `test/integration.test.mjs:244` — `assert.ok(typeof result.issuesClosed === "number")` passes for 0; no fake `gh` binary so it adds no signal — the real test is `harness.test.mjs:416`

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs