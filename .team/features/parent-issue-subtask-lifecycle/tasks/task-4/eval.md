## Parallel Review Findings

🟡 [architect] `test/parent-checklist.test.mjs:140` — Tautological test: hardcodes `Part of #${approvalIssueNumber}` directly into the body string, then asserts the body includes it; does not import or invoke any production function from `run.mjs`; would pass even if `run.mjs:929` were deleted; replace with a test that mirrors the run.mjs backLink conditional or exercises the actual body construction path
🟡 [architect] `bin/lib/run.mjs:1311` — Iteration-escalation (`escalationFired`) branch does not call `markChecklistItemBlocked`; tasks blocked via iteration escalation show `- [ ] title (#N)` (unchecked) in the parent checklist while review-escalation-blocked tasks show `- [ ] ~~title~~ (#N) ⚠️ blocked`; add the same `getIssueBody`/`markChecklistItemBlocked`/`editIssue` pattern from `run.mjs:1297-1302` (pre-existing backlog item)
🟡 [architect] `bin/lib/run.mjs:1299` — `if (parentBody)` coerces `""` to falsy; `getIssueBody` returns `""` for a valid issue with no body content, silently skipping the blocked-marker write; use `if (parentBody !== null)` (pre-existing backlog item)
[architect] The tautological test (🟡) is the only finding specific to this feature. The other two 🟡s are pre-existing backlog patterns flagged in prior review rounds, not regressions. No criticals.
🟡 [engineer] `test/parent-checklist.test.mjs:136` — Both tests are tautologies: the body string is constructed inline in the test itself, not via production code; deleting `backLink` from `run.mjs:929` leaves both tests green; extract a `buildTaskIssueBody` helper and test it directly
🟡 [engineer] `bin/lib/run.mjs:1086` — Skip-by-user path does not update the parent checklist; `SPEC.md` requires `- [x] Task title (#N) *(skipped)*` on skip; no `markChecklistItemSkipped` function exists; add the call mirroring the `shouldEscalate` block at lines 1297–1302
🟡 [engineer] `bin/lib/run.mjs:937` — `PROJECT.md` is read a second time inside the per-task loop; `projectNum` is already available from line 924 and should be used in the `addToProject` call directly
🟡 [product] test/parent-checklist.test.mjs:136 — Test constructs body string in-test rather than calling production code; removing `backLink` from `run.mjs:932` leaves both tests green; add a mocked integration test that sets `state.approvalIssueNumber`, stubs `createIssue`, and asserts the stub receives a body containing `Part of #${approvalIssueNumber}`
🟡 [tester] test/parent-checklist.test.mjs:136 — Test is a tautology: `Part of #N` is hard-coded into the body string inside the test itself; removing `backLink` from `run.mjs:932` entirely leaves this test green; add a mocked integration test that stubs `createIssue`, passes a state with `approvalIssueNumber` set, runs the task-issue-creation loop, and asserts the stub received a body containing `Part of #${approvalIssueNumber}`
🟡 [tester] test/parent-checklist.test.mjs:144 — Same issue for the null-branch: the conditional is re-implemented inline in the test rather than calling `run.mjs`; extend the integration test to cover `approvalIssueNumber === null` and assert `Part of` is absent from the captured body argument
🟡 [security] bin/lib/run.mjs:929 — `state.approvalIssueNumber` is interpolated directly into the GitHub issue body; `readState()` skips tamper detection (`transition.mjs` guards it, `run.mjs` does not); a corrupted STATE.json with `approvalIssueNumber: "123\n\n**evil**"` injects arbitrary Markdown; add `Number.isInteger(state.approvalIssueNumber)` guard before interpolation
🟡 [simplicity] test/parent-checklist.test.mjs:136 — Both tests construct the template string inline (tautologies) and do not call production code; removing `backLink` from `run.mjs:932` leaves both tests green. To add real coverage: extract a `buildTaskIssueBody(title, featureName, approvalIssueNumber)` helper and test it, or add an integration test that stubs `createIssue` and asserts the body arg contains `Part of #${approvalIssueNumber}`.
🔵 [architect] `bin/lib/github.mjs:141` — `tickChecklistItem` and `markChecklistItemBlocked` duplicate guard, escaping, and regex; extract a shared `replaceChecklistItem(body, title, issueNumber, replacement)` helper
🔵 [architect] `bin/lib/github.mjs:161` — Regex not anchored with `^` and multiline flag; add `new RegExp(..., 'm')` with `^` prefix for robustness against mid-line matches
🔵 [engineer] `bin/lib/run.mjs:1311` — `escalationFired` path blocks the task but skips `markChecklistItemBlocked`; parent checklist stays unchecked for iteration-escalated tasks (pre-existing from prior round)
🔵 [engineer] `bin/lib/run.mjs:1299` — `if (parentBody)` falsy-coerces `""` (valid empty body), silently skipping the blocked-marker write; use `if (parentBody !== null)` (pre-existing from prior round)
🔵 [security] bin/lib/github.mjs:161 — `issueNumber` is interpolated into a regex in `markChecklistItemBlocked` without explicit `parseInt` coercion; add `parseInt(issueNumber, 10)` to prevent unexpected regex behavior if a non-integer value reaches this path

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs

---

## Security Deep-Dive — `agt finalize` closes parent approval issue

**Reviewer:** security specialist
**Verdict:** PASS

### Files read
- `bin/lib/finalize.mjs` (full, 150 lines)
- `bin/lib/github.mjs` (lines 1–230)
- `bin/lib/util.mjs` (lines 1–210)
- `test/harness.test.mjs` (lines 370–466)
- `test/integration.test.mjs` (lines 210–286)

### Criteria

**Approval issue closure — PASS**
`finalize.mjs:133-139` reads `freshState.approvalIssueNumber` and calls `closeIssue(freshState.approvalIssueNumber, "Feature finalized — all tasks complete.")`. Wrapped in `try/catch` for best-effort semantics. `test/harness.test.mjs:377-426` exercises the full subprocess path with a fake `gh` binary, asserts `issuesClosed === 2`, and verifies issue `500` appears in the captured CLI call log. Test passes in gate output.

**Shell/command injection — PASS**
`github.mjs:8-20` uses `spawnSync("gh", args, {...})` where `args` is a JS array; no shell is invoked. `task.status` interpolated into the comment string (`finalize.mjs:121`) is passed as a discrete `--comment <value>` argument — shell metacharacters are inert.

**STATE.json tamper guards — PASS (calibrated to threat model)**
`finalize.mjs:21-24` rejects state where `_written_by !== "at-harness"`. `finalize.mjs:58-60` rejects state missing `_write_nonce`. Appropriate for a developer tool on a trusted local filesystem.

### Findings

🟡 `bin/lib/finalize.mjs:128` — `issuesClosed++` executes unconditionally after `closeIssue()`; `closeIssue` returns `false` (does not throw) when `gh` is unavailable, so the reported count can overstate actual GitHub closures. Check the return value: `if (closeIssue(...)) issuesClosed++`.

🟡 `bin/lib/finalize.mjs:21-24` — `_written_by === "at-harness"` is a constant visible in source; trivially forgeable by anyone who can write STATE.json. Do not document as a security boundary.

🔵 `bin/lib/finalize.mjs:125` — `projMatch` is computed but never used (dead code). Either implement the board-move call or remove the regex.

🔵 `bin/lib/finalize.mjs:134` — `approvalIssueNumber` is falsy-checked but not validated as a positive integer; non-integer truthy values silently fail inside `gh`'s error (swallowed by `catch`). Add `Number.isInteger(freshState.approvalIssueNumber)` guard.