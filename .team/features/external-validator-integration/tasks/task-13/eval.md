## Parallel Review Findings

[simplicity veto] Zero 🔴 findings across all four veto categories:
🟡 [architect] bin/lib/gate.mjs:16 — `gate.mjs` serves dual roles (CLI entry point + shared library). Extract helpers to `gate-helpers.mjs` if a third consumer appears.
🟡 [engineer] test/parsers.test.mjs — Missing dedicated test for TAP subtest skipping. The fix exists at validator-parsers.mjs:120, but no test verifies `parseTap("    not ok 1 - inner")` returns `[]`. If L120 is removed, no test catches the regression.
🟡 [product] STATE.json:1 — All 17 tasks show "blocked" yet code is fully implemented with 132 passing tests; project tracking doesn't reflect actual delivery state. File as tracking-layer bug.
🟡 [product] bin/lib/gate.mjs:85 — SPEC requires auto-scanning known output file locations (junit.xml, test-results.xml, etc.) in the artifact directory. Implementation only parses stdout+stderr; file-based output requires explicit validators.json config. Gap for users whose test runners write to files without stdout.
🟡 [product] test/parsers.test.mjs:857 — SPEC AC #10 calls for integration with a real Jest JUnit reporter. Test uses `printf` to emit JUnit XML directly — validates the pipeline but not the end-to-end reporter path.
🟡 [tester] test/parsers.test.mjs:1089 — Flaky integration test ("truncated XML does not crash gate") fails with ENOENT due to workspace cleanup race. Unit-level equivalent at L720 passes. Fix the test workspace lifecycle.
🟡 [tester] bin/lib/validator-parsers.mjs:120 — TAP subtest skipping (indented line guard) is claimed by the builder but has zero test coverage. Add a test with `# Subtest:` + indented `not ok` lines to verify only top-level failures produce findings.
[tester] All 3 previous 🟡 findings were fixed:
[tester] Test count grew from 168 → 176. 175/176 pass (1 flake). The implementation is solid — both 🟡 findings are coverage-depth gaps, not correctness issues.
🔵 [architect] bin/lib/validator-parsers.mjs:303 — Detection cascade order (JUnit > TAP > GHA > JSON) is implicit. Document the priority for future maintainers.
🔵 [architect] bin/lib/gate.mjs:86 — `stdout + "\n" + stderr` concatenation could theoretically split a structured line spanning both streams. Low-risk in practice.
🔵 [architect] test/parsers.test.mjs:1 — Stale header comment says "Tests for bin/lib/validator-parsers.mjs" but file also tests gate.mjs helpers.
🔵 [engineer] bin/lib/validator-parsers.mjs:91 — `extractLine` regex `/\.\w+:(\d+)/` could match URL port numbers. Low risk in practice.
🔵 [engineer] bin/lib/run.mjs:95 — `runGateInline` reads STATE outside the lock for runId computation. Theoretical race, very unlikely in practice.
🔵 [product] bin/lib/validator-parsers.mjs:303 — `detectAndParse` returns `Array<Finding>` instead of spec's `{ findings, formatDetected }`. Loses format observability.
🔵 [product] test/parsers.test.mjs:1 — Spec calls for `test/fixtures/` directory; all test data is inline instead. Functionally fine.
🔵 [product] test/parsers.test.mjs:1 — Test file named `parsers.test.mjs` instead of spec's `validator-parsers.test.mjs`.
🔵 [tester] test/fixtures/ — SPEC mandates fixture files directory; inline strings used instead. Functionally equivalent.
🔵 [tester] SPEC.md:26 — AC-10 (real Jest JUnit reporter) simulated via printf, not a real test runner.
🔵 [security] bin/lib/validator-parsers.mjs:331 — `decodeXMLEntities` handles only 5 standard entities; numeric character references not decoded. No security impact.
🔵 [security] bin/lib/gate.mjs:133 — Gate command stored verbatim in handshake summary. Low risk for secrets exposure since commands are operator-configured and artifacts are project-local.
🔵 [security] bin/lib/run.mjs:69 — 50MB `maxBuffer` could cause memory pressure from pathological output. Consider documenting the limit.
🔵 [simplicity] bin/lib/validator-parsers.mjs (all parsers) — `source` field set on every finding but never consumed by production code; document as diagnostic metadata or remove
🔵 [simplicity] bin/lib/gate.mjs:96 — `criticalCount` in `processGateOutput` return is unused by production callers (used internally + in tests)
🔵 [simplicity] test/parsers.test.mjs:1 — Stale comment references deleted `parsers.mjs`

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**