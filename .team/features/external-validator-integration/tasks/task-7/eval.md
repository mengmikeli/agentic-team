## Parallel Review Findings

🟡 [architect] `bin/lib/parsers.mjs:1` — Module header says "pure functions, no I/O" but `console.warn` at L284/L297 introduces side effects. Return warnings as data instead.
🟡 [architect] `bin/lib/parsers.mjs:284` — Warning says "falling back to exit-code verdict" but when XML is *partially* truncated, `parseJUnit` still extracts complete findings that the gate uses. Message is misleading.
🟡 [architect] `bin/lib/parsers.mjs:284` — SPEC requires warnings in `artifacts/gate-stderr.txt` but `console.warn` goes to process stderr, not the artifact file.
🟡 [engineer] `bin/lib/parsers.mjs:284` — Warning message says "falling back to exit-code verdict" but in the partial-truncation case (some `<testcase>` elements complete, XML not closed), findings ARE extracted and returned. The gate uses those findings, not the exit code. The warning is misleading. Consider: "parsed findings may be incomplete".
🟡 [product] bin/lib/parsers.mjs:284 — Warning says "falling back to exit-code verdict" but when XML is truncated *after* complete `<failure>` elements, those findings ARE returned and used by the gate — not falling back to exit-code. The log message is misleading in the partial-truncation case. File as backlog.
🟡 [product] test/parsers.test.mjs:664 — No test covers partially-truncated XML where some failures are extractable before the truncation point. Only full truncation (mid-attribute, returns `[]`) is tested. File as backlog.
🟡 [tester] `bin/lib/parsers.mjs:284,297` — Warning uses `console.warn()` (parent stderr) but the spec says it should go to `artifacts/gate-stderr.txt`. The warning never reaches artifact files. No test checks artifact presence.
🟡 [tester] `bin/lib/parsers.mjs:284` — Warning says "falling back to exit-code verdict" but when XML is partially truncated (one valid testcase + one truncated), findings ARE returned — it doesn't actually fall back. Verified manually: `<testsuite><testcase...><failure>...</failure></testcase><testcase...(truncated)` returns 1 finding + misleading warning.
🟡 [tester] `test/parsers.test.mjs:664` — Only tests completely-truncated XML (zero extractable testcases). The more dangerous partial-truncation edge case is untested.
🟡 [tester] `bin/lib/parsers.mjs:288-289` — TAP and GHA problem matcher have no malformed-input handling or warnings, creating asymmetric behavior across parsers.
🔵 [architect] `test/parsers.test.mjs:667` — Six tests repeat the `console.warn` monkey-patch pattern; extract a helper.
🔵 [engineer] `test/parsers.test.mjs` — No test for partial-truncation scenario. Consider adding one to document the actual behavior.
🔵 [product] bin/lib/parsers.mjs:297 — JSON malformed warning only fires for `{`-prefixed input. Array-shaped JSON (`[{...}]`) silently falls through. Correct behavior, but no warning for unexpected formats.
🔵 [tester] `test/parsers.test.mjs:667` — `console.warn` monkey-patching is fragile; consider `test.mock`.
🔵 [tester] `bin/lib/parsers.mjs:292` — Non-JSON output starting with `{` triggers false "malformed JSON" warning.
🔵 [security] bin/lib/parsers.mjs:284 — Warning message says "falling back to exit-code verdict" but partial findings from complete testcases before the truncation point ARE used. Behavior is correct (fail-safe); message is slightly misleading.
🔵 [security] bin/lib/parsers.mjs:296 — Bare `catch {}` swallows all error types, not just `SyntaxError`. Safe in current minimal scope but fragile if scope grows.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**