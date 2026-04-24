## Parallel Review Findings

🟡 [architect] `bin/lib/finalize.mjs:116` — `readTrackingConfig()` called unconditionally on every finalize but its result feeds only a dead no-op block at lines 124–127 (`projMatch` computed, never used); remove both the call and the block to eliminate a wasted filesystem read with no observable effect
[architect] The 🟡 at line 116 is pre-existing debt, not introduced by this task. All prior reviews already flagged it. The gate task itself is clean. Eval written to `.team/features/finalize-auto-close-validation/tasks/task-7/eval.md`.
🟡 [engineer] `bin/lib/finalize.mjs:122` — `closeIssue` return value discarded; `issuesClosed++` always fires even when `gh` returns non-zero (closeIssue returns `false` without throwing); fix: `if (closeIssue(task.issueNumber, comment)) issuesClosed++`
🟡 [engineer] `bin/lib/finalize.mjs:135` — Same semantic bug for approval issue close — counter increments regardless of whether the close succeeded
🟡 [product] `.team/features/finalize-auto-close-validation/tasks/task-{1..6}/handshake.json:21` — `fabricated-refs` compound gate layer trips on all 6 review nodes; review agents are citing file paths that do not exist in repoRoot — add backlog item to audit review briefs for spurious path citations
[product] The 🟡 warning (fabricated-refs WARN on all 6 review tasks) does not block merge — it is a systemic quality signal for the backlog.
🟡 [tester] `test/harness.test.mjs:419` — Approval-issue close test asserts the issue number (`"500"`) but not the comment body; add `assert.ok(ghCalls.includes("Feature finalized — all tasks complete."))` to match the contract in `finalize.mjs:136` — the analogous task-issue tests (lines 318, 369) both assert their comment bodies
🟡 [security] bin/lib/finalize.mjs:123 — `closeIssue()` return value discarded; `issuesClosed++` fires inside `try` even when gh exits non-zero; callers cannot trust the count as a success indicator — fix: `if (closeIssue(...)) issuesClosed++`
🟡 [simplicity] `bin/lib/finalize.mjs:116` — `readTrackingConfig()` result is never used; delete lines 116 and 124–127 (dead `if (tracking)` block containing never-used `projMatch`)
🔵 [architect] `bin/lib/finalize.mjs:134` — approval-issue close is a second parallel loop after the task loop; a unified close pass (single loop over a mixed list) would keep the pattern co-located and prevent structural divergence if project-board moves are ever added
🔵 [engineer] `bin/lib/finalize.mjs:124-127` — Dead code: `projMatch` declared but never read; intended project board status update not implemented; remove or implement
🔵 [engineer] `bin/lib/finalize.mjs:129,138` — `catch {}` blocks are unreachable since `closeIssue` cannot throw (`runGh` catches internally); add a comment to clarify intent
🔵 [tester] `bin/lib/finalize.mjs:138` — `closeIssue` failure on approval issue silently skips count increment; add a test with a failing `gh` stub to document this best-effort behavior explicitly
🔵 [tester] `test/harness.test.mjs:468` — Only missing-property case tested for no-`issueNumber` skip; add `issueNumber: null` and `issueNumber: 0` variants to close the falsy-boundary gap
🔵 [security] bin/lib/finalize.mjs:134 — `approvalIssueNumber` passes only a falsy check before reaching `String(number)` in `closeIssue`; add `Number.isInteger(n) && n > 0` guard for defense-in-depth (no shell injection risk due to `spawnSync`, but worth hardening)
🔵 [security] bin/lib/finalize.mjs:116 — `readTrackingConfig()` only feeds dead code at lines 124-127 (`projMatch` assigned, never used); delete both (already flagged by Simplicity reviewer)
🔵 [simplicity] `test/harness.test.mjs:278` — Six tests repeat identical fake-gh scaffold (~15 lines each); extract a `withFakeGh(state, fn)` helper if this pattern grows

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs