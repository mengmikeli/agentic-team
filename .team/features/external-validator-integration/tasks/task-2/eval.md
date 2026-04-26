## Parallel Review Findings

[architect] **Verdict: PASS** — The double-counting fix (raw line) and control-char stripping are both present and correct. No 🔴 blockers. The 🟡 at line 49 (JUnit parser asymmetry) is the only item requiring backlog tracking before integration.
[engineer] The one new 🟡 (untested stripping) must go to backlog. No 🔴 blockers — the implementation is correct for all specified criteria.
[simplicity veto] **Findings (no 🔴, no 🟡 from simplicity lens):**
🟡 [architect] `bin/lib/validator-parsers.mjs:49` — `parseJunitXml` still pushes attacker-controlled `message`, `classname`, and `file` verbatim to `messages[]` without control-character stripping; `parseTap` (line 81) now sanitizes — inconsistent security posture across parsers sharing the same interface contract; apply the same `/[\x00-\x1f\x7f]/g` strip before `messages.push()` in `parseJunitXml`
🟡 [architect] `bin/lib/validator-parsers.mjs:1` — module has no callers in `bin/`; inert in production; confirm integration task is tracked before marking feature shippable
[engineer] **Prior 🟡 resolved in current HEAD:**
🟡 [engineer] `test/validator-parsers.test.mjs` — control char stripping at `validator-parsers.mjs:81` is not test-locked; removing that `.replace(...)` call leaves all 14 tests passing undetected; add a test with `"not ok 1 - test\x1b[2J"` asserting `meta.messages[0]` contains no C0 bytes
[product] **Prior 🟡 findings resolved by this run:**
🟡 [product] `.team/features/external-validator-integration/tasks/task-2/handshake.json` — Gate output truncated; no `artifacts/test-output.txt` saved; cannot confirm the claimed 553-test pass without re-running (carried from task-1 through every PM review — process gap must close)
🟡 [product] `bin/lib/validator-parsers.mjs:1` — No callers in `bin/`; module is inert until integration task lands; confirm follow-up is tracked before marking feature shippable
🟡 [product] `bin/lib/validator-parsers.mjs:49` — JUnit parser still writes `message`/`classname`/`file` from attacker-controlled XML to `messages[]` without control char stripping; TAP parser was fixed in this run but JUnit was not updated; file as backlog item to close the asymmetry
🟡 [tester] `test/validator-parsers.test.mjs` (after line 163) — handshake claims control char stripping as a distinct fix; no test locks it in; removing `validator-parsers.mjs:81` passes all 14 tests without failure; add a case with `"not ok 1 - test\x1b[2J"` input and assert `meta.messages[0]` contains no bytes in `[\x00-\x1f]`
🟡 [security] `test/validator-parsers.test.mjs` — no test locks in the control-character stripping behaviour; removing `validator-parsers.mjs:81` silently regresses with all 14 current tests still passing; add a case with `"not ok 1 - test\x1b[2J\x00"` asserting `meta.messages[0]` contains no bytes below `\x20`
🟡 [security] `bin/lib/validator-parsers.mjs:87` — non-TAP stdout (empty string, stack trace, JSON) returns `critical: 0` indistinguishable from a clean TAP run; once `getParser("tap")` is wired into the gate, a misconfigured validator silently passes; add `meta.parseWarning = true` when stdout is non-empty but contains no TAP structure (carried from Security run_1 / run_2)
[security] **Verdict: PASS** — No critical blockers. Two warnings for the backlog (missing test for control-char contract; silent parse failure). Prior control-char injection 🟡 and double-count 🟡 are both resolved by the current code.
[simplicity] - Gold-plating: PASS — control char stripping responds to concrete Security 🟡; regression test directly guards the fix
🔵 [architect] `test/validator-parsers.test.mjs` — no test locks in control-char stripping (line 81); removing it passes all 14 tests silently; add a case with `not ok 1 - test\x1b[2J` input asserting `meta.messages[0]` contains no control bytes
🔵 [architect] `test/validator-parsers.test.mjs:167` — `getParser("tap")` test only asserts `typeof`; add `parser(tapInput, "", 1)` asserting `findings.critical === 1` to verify registry wire-up end-to-end
🔵 [architect] `bin/lib/validator-parsers.mjs:115` — `PARSERS[format]` has no `Object.hasOwn` guard; `format = "__proto__"` returns `Object.prototype` (truthy), bypasses exit-code fallback, and throws `TypeError`; use `Object.hasOwn(PARSERS, format) ? PARSERS[format] : PARSERS["exit-code"]`
🔵 [architect] `bin/lib/validator-parsers.mjs:109` — `PARSERS` exported as a plain mutable object; a consumer can silently overwrite or delete parser entries; `Object.freeze(PARSERS)` or remove the export
🔵 [engineer] `test/validator-parsers.test.mjs:167` — `getParser("tap")` never called with real input; add `getParser("tap")(tapInput, "", 1)` asserting `findings.critical === 1` to cover registry wire-up end-to-end
🔵 [engineer] `bin/lib/validator-parsers.mjs:114` — `PARSERS[format]` lacks `Object.hasOwn` guard; `"__proto__"` as format returns `Object.prototype` (truthy), bypasses fallback, throws `TypeError`
🔵 [engineer] `bin/lib/validator-parsers.mjs:70` — JSDoc `@param` documents only `stdout`; missing `@param {string} stderr` and `@param {number} exitCode`
🔵 [product] `bin/lib/validator-parsers.mjs:84` — `meta.parseWarning` absent; non-TAP stdout silently returns `critical: 0`, indistinguishable from a clean run; add `meta.parseWarning` before wiring into the gate
🔵 [tester] `test/validator-parsers.test.mjs:167` — `getParser("tap")` test only asserts `typeof`; add `parser(tapInput, "", 1)` with a `not ok` line asserting `findings.critical === 1` to verify registry wire-up end-to-end (carried from all prior reviews; behavior verified correct via direct probe, just not tested)
🔵 [security] `bin/lib/validator-parsers.mjs:116` — `PARSERS[format]` has no `Object.hasOwn` guard; `format = "__proto__"` returns `Object.prototype` (truthy), bypasses the exit-code fallback, and throws `TypeError` at invocation; use `Object.hasOwn(PARSERS, format) ? PARSERS[format] : PARSERS["exit-code"]` (carried from Security run_2)
🔵 [simplicity] `bin/lib/validator-parsers.mjs:67` — JSDoc says "excluding TODO directives" but SKIP is also excluded; update to "excluding TODO and SKIP directives"
🔵 [simplicity] `test/validator-parsers.test.mjs:166` — `getParser("tap")` never retrieved in the `getParser` describe block; add `getParser("tap")(tap, "", 1)` asserting `findings.critical === 1` to confirm registry wire-up end-to-end

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**