## Parallel Review Findings

🟡 [architect] `bin/lib/gate.mjs:207` — `validators.json` `outputFile` has no path traversal guard; could read arbitrary files into artifacts. Apply same `..`/separator check used for taskId.
🟡 [architect] `bin/lib/run.mjs:94` — Same `outputFile` path traversal gap in inline gate runner.
🟡 [architect] `bin/lib/gate.mjs:199-211` + `bin/lib/run.mjs:88-98` — Config override assembly (~12 lines) duplicated between two gate paths. Extract to shared helper to prevent drift.
🟡 [engineer] `bin/lib/gate.mjs:268` — Catch-block fallback uses `exitCode === 0 ? "PASS" : "FAIL"`, discarding the verdict `processGateOutput` already computed. If a write operation throws after parsing finds failures, the catch block produces the exact false PASS this feature exists to prevent. Fix: capture `gateOutput.verdict` in a variable scoped outside the inner try.
🟡 [engineer] `bin/lib/gate.mjs:269` — Fallback emits `ok: true` alongside `internalError`, masking the failure from consumers that only check `ok`.
🟡 [engineer] `bin/lib/run.mjs:133` vs `bin/lib/gate.mjs:226` — STATE.json gate records have field asymmetry between `cmdGate` and `runGateInline` (different fields recorded).
🟡 [product] `bin/lib/parsers.mjs:173` — SPEC says GHA `::warning` should map to warning severity, but only `::error` is parsed. File for backlog.
🟡 [product] `bin/lib/parsers.mjs:148` — TAP `not ok # TODO` and `not ok # SKIP` emit as critical findings; TAP convention treats these as expected failures. Future iteration should downgrade to warning.
🟡 [product] `bin/lib/gate.mjs:266-278` — cmdGate's catch block falls back to exit-code verdict but doesn't persist the `internalError` detail in handshake.json (only in JSON stdout).
🟡 [product] `bin/lib/gate.mjs:201` — Inconsistent parameter naming (`dir` vs `featureDir`) between cmdGate and runGateInline for the same logical value.
🟡 [tester] bin/lib/gate.mjs:266 — `internalError` catch block falls back to exit-code verdict with no direct test; could mask failures as false PASS when exit=0
🟡 [tester] test/worktree.test.mjs — `runGateInline` tests verify return values only; no disk artifact verification (`validator-findings.json`, `handshake.json`)
🟡 [tester] test/parsers.test.mjs — No `runGateInline` integration test with `validators.json` config (all 4 config tests use `cmdGate`)
🟡 [security] bin/lib/gate.mjs:207 — `outputFile` from `validators.json` not validated for path traversal; `join(cwd, "../../etc/shadow")` resolves outside project. Low risk (requires repo write access), but add `resolve()` + `startsWith(cwd)` check.
🟡 [security] bin/lib/run.mjs:94 — Same `outputFile` path traversal as gate.mjs:207. Apply identical fix.
🟡 [security] bin/lib/gate.mjs:268 — Catch-all handler falls back to `exitCode === 0 ? "PASS" : "FAIL"`, bypassing structured output parsing. If `processGateOutput` throws, exit 0 + structured failures = false PASS. Consider defaulting to FAIL when `internalError` is present.
🟡 [simplicity] bin/lib/gate.mjs:200 + bin/lib/run.mjs:88 — Validator config loading duplicated (~10 lines). Extract a shared `buildConfigOverride(featureDir, cwd)` helper.
🟡 [simplicity] bin/lib/gate.mjs:118 + bin/lib/run.mjs:56 — Path-traversal sanitization regex duplicated identically. Extract a shared helper.
[simplicity] Clean architecture: 4 pure parsers (no I/O) + detection cascade + 3 shared gate helpers. Cognitive load is low. Deletability is high (revert ~15 lines to restore exit-code-only verdicts). 1501 lines of tests covering all formats, edge cases, and integration paths. The two 🟡 findings are duplicated code sequences (~10 lines each) that should go to backlog but don't block merge.
🔵 [architect] `bin/lib/parsers.mjs:27` — Regex-based XML parsing won't handle CDATA/namespaces. Document limitation.
🔵 [architect] `bin/lib/parsers.mjs:173` — `parseProblemMatcher` only captures `::error`, not `::warning`.
🔵 [architect] `test/parsers.test.mjs:757` + `:1382` — `harnessJSON` test helper copy-pasted across describe blocks.
🔵 [engineer] `bin/lib/gate.mjs:60-62` — Three `filter()` passes where one `reduce` suffices (negligible impact).
🔵 [engineer] `bin/lib/gate.mjs:207` — `outputFile` from validators.json lacks path traversal guard (low risk — team-controlled config).
🔵 [product] `bin/lib/parsers.mjs:1` — Generic filename `parsers.mjs` vs SPEC's `validator-parsers.mjs`; could cause confusion if non-validator parsers are added.
🔵 [product] `test/parsers.test.mjs:757` — `harnessJSON` helper duplicated across two describe blocks.
🔵 [product] `SPEC.md:12` — `<system-err>` element mentioned in spec requirements but not implemented.
🔵 [tester] bin/lib/parsers.mjs:117 — TAP parser matches indented subtests; could double-count failures
🔵 [tester] test/parsers.test.mjs:757,1382 — `harnessJSON` helper duplicated across two describe blocks
🔵 [tester] bin/lib/parsers.mjs:89 — `extractLine` regex may match version strings as line numbers
🔵 [security] bin/lib/gate.mjs:268 — Catch-all emits `ok: true` even on internal error. Downstream consumers checking only `ok` would miss the failure.
🔵 [security] bin/lib/parsers.mjs:75 — `extractAttr` interpolates `name` into `new RegExp()` without escaping. Currently safe (only hardcoded strings), but fragile if callers change. Add `@internal` annotation or escape metacharacters.
🔵 [simplicity] bin/lib/parsers.mjs:309 — Stale comment references deleted `isGenericJson`.
🔵 [simplicity] bin/lib/gate.mjs:60-62 — `criticalCount` returned from `processGateOutput` but never destructured by callers.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**