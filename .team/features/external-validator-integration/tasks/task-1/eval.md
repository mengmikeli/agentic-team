## Parallel Review Findings

[architect] Both Simplicity run_2 🔴 (lambda indirection) and Architect run_2 🟡 (asymmetric signature) are resolved. No 🔴 findings remain. No new issues introduced.
[engineer] run_3 makes two targeted changes — standardising the `parseJunitXml` signature to `(stdout, stderr, exitCode)` and replacing the unnecessary lambda wrapper in `PARSERS` with a direct function reference. Both claims verified against the code. No logic change; 8/8 tests still pass. The **Simplicity run_2 🔴** and **Architect run_2 🟡** blockers are resolved.
[product] run_3 resolved the last blocking 🔴 finding — the Simplicity run_2 flag on the unnecessary lambda wrapper at `PARSERS["junit-xml"]`. Both changes claimed in the handshake are confirmed in the code:
[product] The stated requirement is met end-to-end: one `<failure>` element → one `findings.critical`, formatted exactly as `file:line — classname: message`. All three prior 🔴 blockers (dead try/catch, unhandled `<error>` elements, lambda indirection) are now resolved across runs 2 and 3.
[security] **Verdict: PASS** (two carried 🟡 warnings to backlog; no 🔴 blocking findings)
[security] Prior Simplicity run_2 🔴 (unnecessary lambda) is **resolved**.
[simplicity veto] The run_2 Simplicity 🔴 (unnecessary lambda indirection at line 77) is **resolved**. The builder fixed it correctly — standardised `parseJunitXml` to `(stdout, stderr, exitCode)` and replaced the wrapper with a direct registry reference, matching `parseExitCode`.
🟡 [architect] `bin/lib/validator-parsers.mjs:53` — `totalMatch` picks the first `tests="N"` from the raw XML string; multi-`<testsuite>` aggregate reports produce a wrong `summary` count (carried from run_1/run_2, not addressed in run_3)
🟡 [engineer] `bin/lib/validator-parsers.mjs:53` — `totalMatch` picks the first `tests="N"` in the raw string; multi-`<testsuite>` aggregate reports produce a wrong `summary` count (carried from run_1/run_2, not in run_3 scope)
🟡 [engineer] `bin/lib/validator-parsers.mjs:9` — `extractAttrs` silently drops single-quoted attribute values; `<failure message='broke'/>` produces `message=""` and finding `"f.java:1 — X: "` (carried from run_1/run_2)
🟡 [product] `.team/features/external-validator-integration/tasks/task-1/handshake.json` — gate output truncated before `validator-parsers.test.mjs` results; no `artifacts/test-output.txt` saved; future reviewers cannot confirm pass count without re-running (carried from run_1, run_2)
🟡 [product] `bin/lib/validator-parsers.mjs:1` — module has no callers in `bin/`; inert in production until integration task lands; confirm follow-up is tracked before marking feature shippable (carried from run_1, run_2)
[product] The two carried 🟡 items (no test-output artifact, no integration callers) are **backlog**, not merge blockers — both were flagged in prior PM reviews and represent follow-on integration work outside the scope of this task.
🟡 [tester] `test/validator-parsers.test.mjs:97` — `getParser("junit-xml")` test only asserts `typeof parser === "function"`; run_3 specifically changed the registry entry to a direct reference — add `parser(xml, "", 0)` with real XML asserting `findings.critical === 1` to lock down the interface change (elevated from 🔵 given run_3 scope; carried from run_2)
🟡 [tester] `test/validator-parsers.test.mjs` — no test for `file`-present/`line`-absent path; branch at `validator-parsers.mjs:48` confirmed correct via direct execution (`"a.java — A: oops"`) but unlocked; add a case with `file="X.java"` and no `line` attribute (carried from run_1/run_2)
🟡 [tester] `test/validator-parsers.test.mjs:72` — `<error>` test always provides a `message` attribute; add a case with `<error type="NPE"/>` (no message attr) to document that critical is still incremented and finding text is `"file:line — classname: "` (carried from run_2)
🟡 [security] `bin/lib/validator-parsers.mjs:49` — `message`, `classname`, and `file` from attacker-controlled XML are concatenated into finding text without stripping control characters; a crafted `<failure message="\x1b[2J...">` injects terminal escape sequences. Strip `/[\x00-\x1f\x7f]/g` before `messages.push()`. *(Carried from run_2 — unresolved in run_3)*
🟡 [security] `bin/lib/validator-parsers.mjs:56` — `meta` has no signal to distinguish a genuine zero-finding run from a structural parse failure; once wired into the gate, a misconfigured validator silently passes. Add `meta.parseWarning = true` when `findings.critical === 0 && stdout.length > 0 && !stdout.includes('<testcase')`. *(Carried from run_2 — unresolved in run_3)*
🟡 [simplicity] `bin/lib/validator-parsers.mjs:23` — JSDoc says "Each `<failure>` element produces one critical finding" but the implementation also matches `<error>` (line 39); update the doc comment to name both element types
🔵 [architect] `bin/lib/validator-parsers.mjs:76` — `PARSERS` is exported as a mutable object; a consumer can silently overwrite or delete entries; use `Object.freeze(PARSERS)` or remove the export in favour of `getParser`-only access (carried from run_2)
🔵 [engineer] `test/validator-parsers.test.mjs:97` — `getParser("junit-xml")` test asserts only `typeof`; add a call with valid XML and assert `findings.critical === 1` to confirm the direct reference passes `stdout` correctly (carried from run_2)
🔵 [engineer] `bin/lib/validator-parsers.mjs:29` — `stderr` and `exitCode` are declared but never read; add an inline comment explaining they are accepted for interface conformance only so future maintainers don't treat them as a latent bug
🔵 [tester] `test/validator-parsers.test.mjs` — no test calls `parseJunitXml(xml, stderrValue, exitCodeValue)` with all 3 args; one test exercising the full 3-arg calling convention would document that `stderr` and `exitCode` are intentionally ignored
🔵 [tester] `bin/lib/validator-parsers.mjs:11` — `extractAttrs` silently drops single-quoted attribute values (confirmed: `"c.java:3 — C: "`); add an inline comment documenting the constraint (carried from run_1/run_2)
🔵 [security] `bin/lib/validator-parsers.mjs:11` — `extractAttrs` silently discards single-quoted XML attribute values; document as a known limitation with an inline comment so future maintainers aren't surprised.
🔵 [simplicity] `test/validator-parsers.test.mjs:97` — `getParser("junit-xml")` only asserts `typeof`; invoke the returned parser with real XML and assert `findings.critical === 1` to verify registry wire-up end-to-end (carried from prior reviews)

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**