## Parallel Review Findings

🟡 [architect] bin/lib/gate.mjs:235 — 3rd private detection function in gate.mjs compounds design debt; co-locate with parsers before adding 4th parser (generic JSON)
🟡 [architect] bin/lib/gate.mjs:111 — No integration test for gate→isProblemMatcher→parseProblemMatcher→finalVerdict pipeline; same gap as JUnit and TAP
🟡 [architect] bin/lib/gate.mjs:115 — Stale comment says "JUnit XML" but code now handles 3 formats; flagged in 2 prior reviews, still unfixed
🟡 [engineer] bin/lib/parsers.mjs:167 — CRLF bug: `text.split("\n")` leaves `\r` on lines; regex fails silently on Windows `\r\n` output. Verified: 2-error CRLF input → 1 finding vs 2 with LF. Fix: `text.split(/\r?\n/)`.
🟡 [engineer] bin/lib/run.mjs:80 — `runGateInline` has no parser integration; verdict is exit-code-only. SPEC line 14 requires parity with `cmdGate`. The `agt run` path (run.mjs:1199) won't detect GHA `::error` findings.
🟡 [engineer] bin/lib/gate.mjs:236 — `isProblemMatcher` detection requires `file=` param but parser handles missing `file=`. `::error line=5::msg` works in unit tests but never triggers through gate flow.
🟡 [engineer] bin/lib/parsers.mjs:171 — `::error::message` (no space, valid GHA) silently dropped by both parser and detector.
🟡 [product] `test/parsers.test.mjs:404` — SPEC.md:12 says `::warning` should map to `warning` severity, but the implementation explicitly ignores `::warning` lines. Task-3's acceptance criterion only covers `::error` → critical, so this isn't a blocker here, but it's an untracked spec gap — file as future work.
🟡 [product] `test/integration.test.mjs` — No end-to-end test exercises `cmdGate` with exit-0 + `::error` → FAIL verdict. The wiring at `gate.mjs:111-119` is correct (I traced the logic path), but a regression that disconnects the parser from the gate would pass all existing tests undetected. This is the feature's primary behavioral promise.
🟡 [tester] `bin/lib/parsers.mjs:167` — `text.split("\n")` leaves trailing `\r` on CRLF lines; JS `.` doesn't match `\r`, so `::error` lines are silently dropped on Windows output. Verified: 2-error CRLF input → 1 finding. Fix: `text.split(/\r?\n/)`
🟡 [tester] `bin/lib/gate.mjs:236` — `isProblemMatcher` requires `file=` but `parseProblemMatcher` handles `::error` without `file=`. Unit test at parsers.test.mjs:390 passes in isolation but never triggers through gate.mjs. Fix: relax to `/^::error\s/m`
🟡 [tester] `test/parsers.test.mjs:336` — No integration test through `cmdGate` for the problem matcher path. 12 unit tests validate the parser in isolation but the detection → parsing → verdict wiring (gate.mjs:111-112) has zero coverage
🟡 [security] bin/lib/gate.mjs:19,123 — `taskId` used unsanitized in path construction; pre-existing, mitigated by `--cmd` giving equivalent attack surface; fix: reject `taskId` with `../` or path separators
🟡 [security] bin/lib/gate.mjs:105 — stdout+stderr concatenated before format detection; stderr with `::error` lines could trigger false-positive parsing
🟡 [security] bin/lib/gate.mjs:235 vs bin/lib/parsers.mjs:171 — `isProblemMatcher` detection requires `file=` param but `parseProblemMatcher` does not; test at parsers.test.mjs:391 validates a code path unreachable through the gate
🔵 [architect] bin/lib/parsers.mjs:171 — Bare `::error::message` (no params/space) won't match; acceptable for v1
🔵 [architect] bin/lib/parsers.mjs:168 — `::warning`/`::notice` silently dropped; could map to lower severities
🔵 [architect] bin/lib/gate.mjs:107 — Multi-format output silently drops non-first-match findings
🔵 [engineer] bin/lib/gate.mjs:107 — Detection cascade silently drops GHA findings when JUnit/TAP markers also present.
🔵 [engineer] bin/lib/parsers.mjs:162 — `::warning`/`::notice` GHA commands ignored; could map to warning/suggestion severities.
🔵 [engineer] tasks/task-3/artifacts/test-output.txt — Stale evidence references `parseGithubActions`/`getParser` from prior build iteration.
🔵 [product] `bin/lib/parsers.mjs:171` — Non-greedy `(.*?)` splits at first `::` after properties; messages containing `::` get truncated. GHA spec forbids unencoded `::`, so narrow real-world impact, but worth a test to document the boundary.
🔵 [tester] `bin/lib/gate.mjs:236` — Detection fails when title param has a colon before `file=` (e.g., `title=TypeError: x,file=a.js`)
🔵 [tester] `bin/lib/gate.mjs:107` — Format priority (JUnit > TAP > ProblemMatcher) is untested for mixed-format output
🔵 [tester] `bin/lib/parsers.mjs:175` — GHA percent-encoded values (`%0A`) passed through raw; no test documents this
🔵 [security] bin/lib/parsers.mjs:73 — `extractAttr` regex injection (latent, all callers hardcoded)
🔵 [security] bin/lib/parsers.mjs:171 — `::error::msg` (no params/space) silently ignored per regex `\s+` requirement
🔵 [security] bin/lib/gate.mjs:107-113 — First-match detection priority means mixed-format output loses non-primary findings
🔵 [simplicity] bin/lib/gate.mjs:115 — Stale comment says "JUnit XML" but code now handles 3 formats; fix: s/JUnit XML/structured output/

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**