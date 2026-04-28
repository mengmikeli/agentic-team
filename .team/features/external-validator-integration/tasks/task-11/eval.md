## Parallel Review Findings

🟡 [architect] bin/lib/gate.mjs:38 — `loadValidatorConfig` hardcodes directory traversal assuming `features/<name>/` nesting depth; consider parameterizing the `.team` root
[architect] All three 🟡 from the prior architect review (task-13) have been **resolved**: false-PASS on internal error → fixed to `verdict: "FAIL"`, config-loading duplication → `buildConfigOverride` extracted, path-traversal duplication → `isUnsafeTaskId` extracted.
🟡 [engineer] bin/lib/run.mjs:100 — `writeGateArtifacts()` called without try/catch in `runGateInline`; `cmdGate` has equivalent protection at gate.mjs:286. Error-handling parity gap.
🟡 [engineer] bin/lib/validator-parsers.mjs:121 — `line.trim()` before regex match causes indented TAP subtests to match as top-level failures, producing duplicate findings in nested TAP.
[engineer] - Prior review 🟡s resolved: shared `isUnsafeTaskId`, shared `buildConfigOverride`, TAP bare-description fix, `parseWithFormat` export
🟡 [product] SPEC.md:39 — `detectAndParse` signature drift: spec says `(stdout, artifactDir, config)` returning `{ findings, formatDetected }`, actual is `(text)` returning `Array<Finding>`. Config/I/O concerns were moved to `gate.mjs`. Spec should be updated before downstream tasks build against stale contract.
🟡 [product] STATE.json:4 — Feature status is `"completed"` but all 17 tasks show `"blocked"`. Contradictory metadata will confuse downstream automation.
🟡 [tester] `test/parsers.test.mjs` — No test for `processGateOutput` when structured findings exist only in stderr. The gate combines stdout+stderr before parsing, but this path is never tested with stderr-only findings.
🟡 [tester] `bin/lib/validator-parsers.mjs:120` — `parseTap` doesn't handle TAP v14 subtests (indented `not ok` lines). No test exists. If a TAP14 runner emits nested failures, they'll be silently missed.
🟡 [simplicity] test/parsers.test.mjs:1 — Stale header comment references deleted `bin/lib/parsers.mjs`; update to say `validator-parsers.mjs`
🟡 [simplicity] bin/lib/validator-parsers.mjs:288 — `parseWithFormat` default case silently falls back to auto-detection for unknown format strings, masking `validators.json` typos
🔵 [architect] bin/lib/validator-parsers.mjs:312 — Comment could better explain `parseGenericJsonObj` as double-parse avoidance
🔵 [architect] bin/lib/gate.mjs:91 — `criticalCount` returned but unused by callers
🔵 [engineer] bin/lib/validator-parsers.mjs:91 — `extractLine` regex could match port numbers in URLs; tighter pattern would reduce false matches.
🔵 [engineer] test/parsers.test.mjs:1 — Stale header comment says "Tests for bin/lib/parsers.mjs" but that file was deleted; import on L5 correctly references `validator-parsers.mjs`.
🔵 [product] bin/lib/validator-parsers.mjs:281 — `parseWithFormat` exported but not in spec's required 5. Minor scope creep, justified by `gate.mjs` usage.
🔵 [product] test/parsers.test.mjs:45 — Export verification only checks `typeof === "function"`, not distinct `source` values per parser.
🔵 [tester] `test/parsers.test.mjs` — No test for `detectAndParse` with ambiguous input matching multiple format detectors simultaneously. The JUnit > TAP > GHA > JSON priority chain is only implicitly validated.
🔵 [tester] `test/parsers.test.mjs` — No test for JUnit XML with `<![CDATA[...]]>` inside `<failure>` elements (common in Maven Surefire output).
🔵 [tester] `bin/lib/gate.mjs:86` — Nullish coalescing means empty string `""` from an empty outputFile gets parsed instead of falling back to stdout. Correct but subtle — a clarifying test would prevent regressions.
🔵 [security] bin/lib/validator-parsers.mjs:287 — `parseWithFormat` silently falls back to `detectAndParse` for unrecognized format strings; a typo in `validators.json` would go unnoticed
🔵 [security] bin/lib/validator-parsers.mjs:328 — `decodeXMLEntities` missing numeric character reference support (`&#x41;`); could garble some JUnit messages
🔵 [security] bin/lib/gate.mjs:69 — `buildConfigOverride` doesn't prevent symlink traversal in `outputFile`; mitigated by config being a trusted project file
🔵 [simplicity] bin/lib/validator-parsers.mjs:76 — Regex meta-character escaping in `extractAttr` is harmless defense-in-depth; all callers pass literal strings

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**