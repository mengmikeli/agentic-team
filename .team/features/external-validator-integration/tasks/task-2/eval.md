## Parallel Review Findings

🟡 [architect] `bin/lib/parsers.mjs:121` — `not ok # TODO` and `not ok # SKIP` emit critical findings; per TAP spec these are not real failures. Will produce false-positive gate FAILs in projects using TODO/SKIP annotations. Skip the finding or downgrade severity.
🟡 [architect] `bin/lib/parsers.mjs:116` — `line.trim()` matches indented subtest `not ok` lines as top-level failures, producing duplicate findings in TAP 14 subtest output. Match raw line without `.trim()`.
🟡 [architect] `bin/lib/gate.mjs:222` — `isTAP()` placed as private function in gate.mjs, compounding the detection-placement debt flagged for `isJUnitXml()` in the prior review. Co-locate with parsers before adding the 3rd parser (GHA).
🟡 [architect] `bin/lib/gate.mjs:109` — No integration test for gate→isTAP→parseTAP→finalVerdict pipeline. Two untested wiring paths now exist (JUnit + TAP). This is the layer where the prior critical verdict bug lived.
🟡 [engineer] `bin/lib/parsers.mjs:121` — `not ok ... # TODO` and `# SKIP` lines produce critical findings; TAP spec treats these as non-failures; strips directive text but still creates finding; causes false FAIL verdicts in projects with TODO tests
🟡 [engineer] `bin/lib/parsers.mjs:116` — `line.trim()` matches indented subtest `not ok` lines, risking double-counted failures; should match raw line with `^not ok` anchor
🟡 [engineer] `bin/lib/parsers.mjs:129` — Unterminated YAML diagnostic block (`---` without `...`) silently consumes all remaining lines, dropping subsequent `not ok` entries
🟡 [tester] `bin/lib/parsers.mjs:116` — `line.trim()` before regex match means indented TAP 14 subtest `not ok` lines are matched as top-level failures, causing double-counting; guard against leading whitespace on original line
🟡 [tester] `test/parsers.test.mjs:297` — `# TODO` and `# SKIP` directives produce critical findings (test asserts `findings.length === 2`); per TAP spec these are expected/skipped failures, not real errors; would cause false FAIL verdicts in projects with TODO tests
🟡 [tester] `bin/lib/parsers.mjs:129` — unclosed YAML diagnostic block (`---` without `...`) silently eats all remaining lines, dropping subsequent `not ok` entries; add a line-count guard
🟡 [tester] `bin/lib/gate.mjs:109` — no integration test exercises `isTAP() → parseTAP() → FAIL verdict` through the full gate pipeline
🟡 [tester] `bin/lib/gate.mjs:222` — `isTAP()` is not exported or unit-tested; plan-based detection could false-positive on non-TAP output
🟡 [tester] `tasks/task-2/artifacts/test-output.txt` — stale artifact from prior code state (shows 6 tests with different names/behavior vs. current 11 tests)
🟡 [security] bin/lib/parsers.mjs:121 — `not ok ... # TODO` and `# SKIP` lines produce critical findings despite TAP spec defining these as expected/skipped; causes false FAIL verdicts; fix by skipping lines matching `/#\s*(TODO|SKIP)/i` before creating findings
🟡 [security] bin/lib/parsers.mjs:117 — `line.trim()` matches indented subtest `not ok` lines as top-level failures; inflates critical counts; fix by checking `line` without trim or skipping lines with leading whitespace
🟡 [security] bin/lib/parsers.mjs:129 — Missing YAML `...` terminator swallows all subsequent `not ok` lines; verified: 2 failures → only 1 finding; fix by breaking on `ok`/`not ok` patterns inside the diagnostic loop
🟡 [security] bin/lib/gate.mjs:105 — stdout+stderr concatenated before TAP/JUnit detection; stderr containing `TAP version` triggers false-positive parsing; fix by checking stdout first
🟡 [simplicity] `bin/lib/parsers.mjs:116` — `line.trim()` strips indentation before regex match, causing indented subtest `not ok` lines (TAP v14) to produce duplicate findings alongside parent failures; match against the raw line to only capture top-level results
🟡 [simplicity] `tasks/task-3/artifacts/test-output.txt:3` — Artifact is stale; shows tests for `parseGithubActions`/`getParser`/`validator-parsers.test.mjs` that don't exist in current codebase
🔵 [architect] `bin/lib/parsers.mjs:129` — Unterminated YAML diagnostic block (`---` without `...`) consumes all remaining lines silently.
🔵 [architect] `bin/lib/gate.mjs:113` — Comment says "JUnit XML" but code handles both JUnit and TAP. Stale.
🔵 [architect] `bin/lib/gate.mjs:107` — JUnit-over-TAP detection priority is implicit; should be documented.
🔵 [tester] `bin/lib/parsers.mjs:105` — TAP `Bail out!` directive not handled; could be a critical finding in real-world TAP
🔵 [tester] `bin/lib/gate.mjs:107` — JUnit/TAP detection priority is implicit and undocumented; add a comment or test
🔵 [security] bin/lib/parsers.mjs:73 — `extractAttr` interpolates into regex without escaping; safe with current hardcoded callers but fragile
🔵 [security] bin/lib/parsers.mjs:132 — TAP YAML `file:` value unsanitized in finding text; no execution path so no injection risk
🔵 [security] bin/lib/gate.mjs:209 — `isJUnitXml()` / `isTAP()` detection functions lack dedicated unit tests
🔵 [simplicity] `bin/lib/parsers.mjs:115` — `notOkRe` compiled inside loop on every iteration; could be hoisted to module scope
🔵 [simplicity] `bin/lib/gate.mjs:113` — Comment says "JUnit XML" but code now handles TAP too; stale comment

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**