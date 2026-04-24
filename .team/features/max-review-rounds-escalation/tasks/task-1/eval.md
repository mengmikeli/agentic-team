## Parallel Review Findings

🔴 [tester] `bin/lib/run.mjs:18` — `shouldEscalate` is never imported; the `MAX_REVIEW_ROUNDS` cap is computed in STATE.json but never enforced — add `shouldEscalate` to the import and call it after `incrementReviewRounds` in both review code paths (lines 1163 and 1242) to actually block the task when the cap is hit
🟡 [architect] bin/lib/run.mjs:1161 — `incrementReviewRounds` + STATE.json write block is duplicated verbatim at lines 1161–1168 and 1240–1247; when task-2 adds `shouldEscalate` + block transition + lastReason, it will land in both branches too — extract `handleReviewFail(featureDir, task)` before task-2 to prevent divergence
🟡 [engineer] bin/lib/run.mjs:1166 — If `rrTask` is null (task absent from fresh STATE.json snapshot), the `reviewRounds` write is silently dropped; add a `console.warn` to make this visible in diagnostics.
🟡 [engineer] bin/lib/run.mjs:1244 — Same silent discard in the multi-review path; same fix.
🟡 [product] test/review-escalation.test.mjs:78 — "no increment on build/gate FAIL" is a caller-semantics stub with no run.mjs path coverage; task-8 must add a direct integration test asserting the counter is not touched on gate-fail or build-fail iterations
🟡 [tester] `test/review-escalation.test.mjs:1` — No integration test exercises the run-loop path "3 consecutive review FAILs → task blocked via review-rounds cap"; the only test file touching `reviewRounds` is the unit test; add a simulated-loop test asserting the task transitions to `blocked` after exactly `MAX_REVIEW_ROUNDS` FAILs
🟡 [tester] `test/review-escalation.test.mjs:78` — The compound-gate-FAIL → `incrementReviewRounds` path (compound gate FAIL injects a synthetic critical finding which triggers the counter) is not directly tested; add a test asserting that a `runCompoundGate` FAIL result causes `task.reviewRounds` to increment
🟡 [security] bin/lib/run.mjs:18 — `shouldEscalate` not imported; review-round cap never fires regardless of `task.reviewRounds` value — an adversarial or buggy review agent that emits critical findings every round will not be stopped by the cap mechanism; task falls through to tick-limit enforcement instead. Track in backlog pending task-2.
🟡 [simplicity] bin/lib/run.mjs:1163 — The 6-line read-state-find-task-write-state block for persisting a task field is now duplicated 4 times in this file (:1144, :1163, :1218, :1242). Extract `persistTaskField(featureDir, task, field, value)` before task-2 adds a fifth copy; each additional copy multiplies the chance of a silent-discard bug going unnoticed.
🔵 [architect] bin/lib/review-escalation.mjs:26 — `shouldEscalate` has no consumer in production until task-2; add a `// wired in task-2 (run.mjs)` comment to prevent future readers from treating it as orphaned dead code
🔵 [engineer] bin/lib/review-escalation.mjs:14 — `typeof NaN === "number"` is true in JS, so a corrupt `NaN` value passes the type guard and produces `NaN + 1 = NaN`, silently poisoning the counter. Guard with `!Number.isFinite(task.reviewRounds)` as well.
🔵 [product] SPEC.md:31 — "field exists in STATE.json" is ambiguous (initialized at 0 on task creation vs. present only after first FAIL); task-9's integration test should assert initial absence explicitly to prevent a false "field missing = bug" call
🔵 [security] bin/lib/review-escalation.mjs:14 — `typeof NaN === "number"` is `true` in JS; if `task.reviewRounds` is `NaN`, the type guard passes, `NaN + 1` stays `NaN`, and `shouldEscalate` permanently returns `false` (`NaN >= 3` is `false`). Fix: add `|| !Number.isFinite(task.reviewRounds)` to the guard. STATE.json tamper detection substantially mitigates real-world risk.
🔵 [simplicity] bin/lib/review-escalation.mjs:26 — `shouldEscalate` is exported with no in-repo consumer until task-2. A one-line comment `// called by run.mjs — added in task-2` prevents future readers from treating it as dead code.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs