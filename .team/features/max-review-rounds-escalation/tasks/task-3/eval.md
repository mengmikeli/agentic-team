## Parallel Review Findings

[tester] No 🔴. PASS — yellow items are coverage gaps for adjacent failure modes, appropriate for backlog. Eval written to `.team/features/max-review-rounds-escalation/tasks/task-3/eval.md`.
[security] No 🔴 or 🟡 findings. Shell-injection vector is closed via `spawnSync(gh, args, ...)` with array args. JSON parsing of round files is wrapped in try/catch. No secrets/credential handling. Gate `npm test` exit code 0 verified against artifact. Detailed eval written to `tasks/task-3/eval-security.md`.
🟡 [tester] bin/lib/run.mjs:1352 — `commentIssue` is fire-and-forget with no try/catch; an API throw would skip the subsequent `markChecklistItemBlocked` + `harness("transition")` calls and lose the block transition. Wrap in try/catch + warn-log, plus a test injecting a throwing `commentIssue`.
🟡 [tester] test/review-escalation.test.mjs:243 — Acceptance test exercises `buildEscalationSummary` directly; a regression removing the `commentIssue(...)` line at run.mjs:1352 would still pass. Add a thin integration test that stubs `commentIssue` and asserts it's called with `(task.issueNumber, body)`.
🔵 [architect] bin/lib/review-escalation.mjs:39 — Dedup keys on `text` only; consider `${severity}|${text}` if cross-severity duplicates ever appear.
🔵 [architect] bin/lib/review-escalation.mjs:56 — No row cap on the rendered table; not a v1 issue, but flag if MAX_REVIEW_ROUNDS ever rises significantly.
🔵 [engineer] bin/lib/run.mjs:1341 — `synth.critical > 0 && task.reviewRounds` — second clause is redundant after `incrementReviewRounds` at 1317; could simplify to `if (synth.critical > 0)`.
🔵 [engineer] bin/lib/review-escalation.mjs:79 — Silent `catch {}` hides corrupted round archives; a `console.warn` would surface them.
🔵 [tester] bin/lib/review-escalation.mjs:76 — `Array.isArray` guard uncovered; one test with `{findingsList: "oops"}`.
🔵 [tester] bin/lib/review-escalation.mjs:79 — silent JSON-parse catch uncovered; one test writing `"not json"`.
🔵 [tester] bin/lib/run.mjs:1352 — `task.issueNumber` falsy branch untested.
🔵 [security] bin/lib/review-escalation.mjs:54 — Newline in finding `text` would break table row; replace `\n` with space before emitting cell.
🔵 [security] bin/lib/review-escalation.mjs:54 — `taskTitle` and finding `text` interpolated into GitHub comment without sanitizing markdown/HTML/`@mentions`; low risk today (trusted agent output), but worth stripping `@` and HTML if prompts ever ingest untrusted issue content.
🔵 [security] bin/lib/review-escalation.mjs:79 — Silent `catch {}` on `JSON.parse` hides corruption of round archives; add `console.warn`.
🔵 [security] bin/lib/review-escalation.mjs:53 — No length cap on rendered comment; could exceed GitHub's 65535-char body limit and silently fail (commentIssue return value ignored at run.mjs:1352).

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs