## Parallel Review Findings

🟡 [tester] `test/runbooks.test.mjs` — No test for negative pattern weights. `scoreRunbook` at `bin/lib/runbooks.mjs:233` would subtract from score with `weight: -1`, potentially causing a runbook to silently never match. Pin the expected behavior with a test.
🟡 [tester] `test/runbooks.test.mjs` — No test for `scoreRunbook` with an empty-string keyword value. The guard at `bin/lib/runbooks.mjs:225` (`if (!kw) continue`) is untested directly.
🟡 [security] `bin/lib/runbooks.mjs:218` — No execution timeout on `RegExp.test()`. The `isSafeRegex` heuristic catches nested quantifiers but not all ReDoS vectors (e.g., alternation-based `(a|a)+`). Low risk for a local CLI reading committed YAML — add to backlog.
🟡 [simplicity] `bin/lib/runbooks.mjs:12-100` — Custom YAML parser (88 lines) is well-scoped but adds maintenance cost if schema evolves. Track as backlog.
🔵 [architect] `bin/lib/runbooks.mjs:8-10` — YAML parser scope underdocumented; list unsupported constructs (multiline, anchors, flow syntax) for future maintainers
🔵 [architect] `bin/lib/runbooks.mjs:105-111` — ReDoS heuristic is reasonable but not exhaustive; acceptable since runbook authors are trusted
🔵 [architect] `bin/lib/runbooks.mjs:222` — Keyword substring matching is intentional but could cause false positives at scale; `minScore` threshold mitigates
🔵 [architect] `bin/lib/run.mjs:428` — `score: Infinity` for forced runbooks could break if score is ever serialized
🔵 [engineer] `bin/lib/runbooks.mjs:218` — RegExp constructed on every `scoreRunbook` call; could cache compiled patterns if scale grows
🔵 [engineer] `bin/lib/runbooks.mjs:12-78` — Custom YAML parser is correctly scoped but unsupported features (multiline strings, anchors) would silently produce wrong results; consider noting parser constraints in runbook files for future contributors
🔵 [tester] `test/runbooks.test.mjs` — No test for YAML quoted strings containing `#` (e.g., `value: "hello # world"`). The `stripInlineComment` logic at `bin/lib/runbooks.mjs:83` handles this but isn't verified.
🔵 [tester] `bin/lib/runbooks.mjs:110` — `isSafeRegex` doesn't catch alternation-based ReDoS (e.g., `(a|a)+`). Known limitation, low risk since runbooks are author-controlled files.
🔵 [tester] `.team/runbooks/` — Only 1 of 3 user-facing runbooks uses `include:`, reducing real-world integration coverage of includes.
🔵 [security] `bin/lib/runbooks.mjs:105-111` — Consider extending `isSafeRegex` to detect alternation-based patterns or adding a regex execution timeout wrapper.
🔵 [simplicity] `test/runbooks.test.mjs:8-9` — Two separate `path` imports could be consolidated.
🔵 [simplicity] `test/runbooks.test.mjs:974` — `minScore < 100` heuristic for internal vs. user-facing runbooks is implicit.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**