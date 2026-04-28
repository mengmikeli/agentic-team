## Parallel Review Findings

[simplicity veto] ## Simplicity Review — FAIL (2 🔴)
🔴 [simplicity veto] `bin/lib/parsers.mjs:273` — `isGenericJson` is dead code: exported function with zero consumers. `detectAndParse` replaced it with inline detection at L298-304 (even has a comment saying so), but the function was never deleted.
🔴 [simplicity veto] `bin/lib/gate.mjs:160` — `const verdict = exitCode === 0 ? "PASS" : "FAIL"` is a dead variable. All downstream code uses `finalVerdict` from `processGateOutput` (L172). This is a leftover from before the refactoring extracted the shared helper.
[simplicity veto] Both 🔴 fixes are one-liners (delete the dead function, delete the dead variable). After that, this is a clean PASS. The overall design is solid — pure-function parsers, clean detection cascade, shared helpers used at exactly 2 call sites each.
[architect] | 🟡 | bin/lib/gate.mjs:160 | Dead variable `verdict` computed but never read; `finalVerdict` is used instead |
[architect] | 🟡 | bin/lib/parsers.mjs:292 | SPEC acceptance criterion #8 (`.team/validators.json` config) not implemented — `detectAndParse` has no config parameter |
[architect] | 🟡 | bin/lib/parsers.mjs:164 | `::warning`/`::notice` GHA lines silently dropped; could map to warning/suggestion findings |
🟡 [tester] bin/lib/gate.mjs:160 — Dead variable `verdict` computed but never read; `finalVerdict` is used everywhere instead
🟡 [tester] bin/lib/parsers.mjs:273 — `isGenericJson` is exported dead code; `detectAndParse` uses inline detection instead
🟡 [tester] bin/lib/gate.mjs:25 — `processGateOutput` has no direct unit tests; verdict logic only exercised through integration tests
🟡 [tester] test/parsers.test.mjs — No test for format priority conflicts (output containing signals from multiple formats)
🟡 [security] bin/lib/gate.mjs:48 — `validator-findings.json` written without size cap; a gate command producing thousands of structured failures could create an arbitrarily large artifact file; add `parsedFindings.slice(0, MAX_FINDINGS)` before writing
🟡 [security] bin/lib/parsers.mjs:75 — `extractAttr` uses `new RegExp(\`...\${name}...\`)` with unsanitized interpolation; currently only called with hardcoded strings, but latent regex injection vector if API surface expands; consider using string search or escaping `name`
🟡 [simplicity] `parsers.mjs:250-268` — `isJUnitXml`, `isTAP`, `isProblemMatcher` are exported but have zero external importers; remove `export` keyword.
🟡 [simplicity] `gate.mjs:86` / `run.mjs:56` — Path-traversal sanitization regex duplicated identically; extract shared helper.
[architect] | 🔵 | bin/lib/parsers.mjs:250 | `isGenericJson` exported but no longer used by `detectAndParse` (uses inline detection) |
[architect] | 🔵 | bin/lib/parsers.mjs:27 | Regex-based JUnit XML parsing won't handle CDATA or XML comments |
[architect] | 🔵 | bin/lib/gate.mjs:26 | stdout+stderr concatenation deserves a comment explaining the `\n` join |
🔵 [engineer] bin/lib/gate.mjs:160 — Dead code: `const verdict = exitCode === 0 ? "PASS" : "FAIL"` is computed but never used; remove to avoid confusion
🔵 [engineer] bin/lib/parsers.mjs:250 — `isGenericJson` is exported but no longer called internally; consider unexporting
🔵 [tester] bin/lib/parsers.mjs:131 — TAP YAML parser missing test for unclosed `...` marker
🔵 [tester] bin/lib/parsers.mjs:250 — `isJUnitXml`/`isTAP`/`isProblemMatcher` exported but only used internally
🔵 [tester] bin/lib/parsers.mjs:292 — `detectAndParse` cascade priority order undocumented
🔵 [security] bin/lib/parsers.mjs:164 — `parseProblemMatcher` only extracts `::error` lines; `::warning` annotations from security linters are silently dropped, reducing security visibility
🔵 [security] bin/lib/gate.mjs:26 — `processGateOutput` concatenates stdout+stderr with literal `\n` before parsing; not exploitable since the gate command runs under user control

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**