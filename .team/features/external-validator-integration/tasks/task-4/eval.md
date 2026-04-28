## Parallel Review Findings

🟡 [architect] bin/lib/gate.mjs:245 — `isGenericJson` uses `JSON.parse(combinedOutput)` which fails when stderr is non-empty, silently dropping JSON findings. Other detectors use regex and tolerate mixed output.
🟡 [architect] bin/lib/gate.mjs:245 — 4th private detection function in gate.mjs. The SPEC's `detectAndParse()` dispatcher was never built despite prior warnings. All 4 parsers are now complete — consolidation point.
🟡 [architect] bin/lib/gate.mjs:107 — No integration test for detection→parsing→verdict pipeline across all 4 parser paths.
🟡 [architect] bin/lib/gate.mjs:162 — Handshake `findings.warning`/`findings.suggestion` don't reflect parsed output severities, limiting observability of the severity-mapping feature.
🟡 [tester] bin/lib/gate.mjs:113 — No integration test for `isGenericJson → parseGenericJson → effectiveCritical → finalVerdict` pipeline. Same gap as all 4 parsers.
🟡 [tester] bin/lib/gate.mjs:245 — `isGenericJson` requires entire output to be valid JSON; fails silently if command prints any non-JSON text (logs, progress) before/after. Unlike regex-based JUnit/TAP/GHA detectors.
🟡 [tester] bin/lib/gate.mjs:245 — 4th private detection function in gate.mjs. Design debt compounds — migrate to `detectAndParse()` dispatcher per SPEC.md L39.
🟡 [tester] bin/lib/gate.mjs:117 — Comment still says "JUnit XML" but now covers 4 formats.
🟡 [tester] bin/lib/gate.mjs:162 — Handshake `findings.warning/suggestion` don't reflect parsed severity counts (uses backlog system instead). Severity data only in `validator-findings.json`.
🔵 [architect] bin/lib/gate.mjs:117 — Stale comment references "JUnit XML" but applies to 4 formats.
🔵 [architect] bin/lib/gate.mjs:245 — Double JSON parse (detect then parse again).
🔵 [engineer] bin/lib/gate.mjs:117 — Stale comment says "JUnit XML" but code handles 4 formats; update to "structured output"
🔵 [engineer] bin/lib/gate.mjs:249 — `isGenericJson` + `parseGenericJson` double-parse the same JSON string; minor inefficiency
🔵 [engineer] bin/lib/gate.mjs:162 — Handshake `findings.warning` reflects backlog count, not parsed-finding severity count; pre-existing design
🔵 [product] `bin/lib/parsers.mjs:224` — Severity matching is case-sensitive; `"Warning"` or `"CRITICAL"` from custom tools defaults to `critical`. Consider `entry.severity?.toLowerCase()` for robustness since this is the "escape hatch" parser.
🔵 [tester] test/parsers.test.mjs:432 — No test for `severity` as non-string type (e.g., `1`, `true`, `null`)
🔵 [tester] bin/lib/gate.mjs:245 — Double JSON.parse (detection + parsing)
🔵 [tester] test/parsers.test.mjs:432 — No large-array stress test
🔵 [security] bin/lib/gate.mjs:105 — `combinedOutput` mixes stdout+stderr before JSON detection; if stderr has content, `isGenericJson` silently fails. Safe because exit code fallback is authoritative, but JSON findings are lost when stderr is non-empty.
🔵 [security] bin/lib/parsers.mjs:218 — No cap on `errors` array iteration. Bounded by subprocess timeout. Could add a limit for defense in depth.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**