## Parallel Review Findings

🟡 [product] `.team/runbooks/shared-setup.yml` — 4th runbook file not in SPEC's "3 built-in runbooks" list. Justified but SPEC should acknowledge it. Backlog.
🟡 [product] `SPEC.md:62` — `resolveRunbookTasks` return type `Task[]` shape not specified in spec. Implementation is correct but contract should be explicit. Backlog.
🟡 [product] `tasks/task-pm-review/handshake.json:7` — Prior PM review metadata has inconsistent test counts (628 vs 635 vs actual 649). Does not affect code.
🟡 [tester] `bin/lib/run.mjs:444` — `planTasks` can return empty task array when a matched runbook's tasks all resolve to missing `include:` refs. Doesn't crash, but silently does nothing. Should warn and fall through to default planning.
🔵 [architect] `bin/lib/runbooks.mjs:12-100` — Custom YAML parser covers only the flat runbook schema. If the schema evolves to need multi-line strings, anchors, or deeper nesting, this requires a rewrite. Acceptable for v1 given the zero-dependency constraint.
🔵 [architect] `bin/lib/runbooks.mjs:221-233` — Keyword substring matching ("api" matches "capital") favors recall over precision. The `minScore` threshold mitigates false positives, but worth monitoring for spurious matches.
🔵 [architect] `bin/lib/run.mjs:842` — Lazy `mkdirSync` for `.team/runbooks/` on every `agt run` duplicates what `init.mjs` already does. Idempotent and harmless, but mixes directory provisioning into the run path.
🔵 [product] `bin/lib/runbooks.mjs:221` — Keyword substring matching (e.g., "api" matches "capital") is intentional and documented. Consider word-boundary variant for future precision needs.
🔵 [product] `test/runbooks.test.mjs:324` — Nested-include test doesn't assert the warning message was emitted. Minor test quality improvement.
🔵 [tester] `bin/lib/runbooks.mjs:12` — Custom YAML parser not directly unit-tested (tested indirectly through 8+ `loadRunbooks` tests). Low risk but worth exporting/testing if parser grows.
🔵 [tester] `bin/lib/runbooks.mjs:105` — `isSafeRegex` heuristic is basic. Adequate for author-controlled YAML; would need hardening for user-submitted patterns.
🔵 [tester] `test/runbooks.test.mjs:582` — Substring keyword matching (`"api"` matches `"capital"`) is intentional and documented. Consider word-boundary opt-in for precision-sensitive runbooks.
🔵 [security] `bin/lib/runbooks.mjs:110` — `isSafeRegex` heuristic misses some exotic ReDoS patterns (e.g., backreference-based). Acceptable given runbooks are authored by trusted repo contributors. Consider `safe-regex2` or `re2` if runbooks ever become externally sourced.
🔵 [security] `bin/lib/runbooks.mjs:218` — No timeout on regex execution. Could block if a pattern bypasses the heuristic. Low risk given the trust model.
[simplicity] ### Non-blocking suggestions (🔵)
🔵 [simplicity] `test/runbooks.test.mjs:6,9` — Consolidate two `path` imports into one
🔵 [simplicity] `bin/lib/runbooks.mjs:217` — Add comment linking defense-in-depth check back to primary check at line 163
🔵 [simplicity] `test/runbooks.test.mjs:974` — `minScore < 100` as "user-facing" heuristic is implicit; consider a constant if more internal runbooks are added

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**