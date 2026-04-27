## Parallel Review Findings

🟡 [architect] `bin/lib/runbooks.mjs:12` — Custom YAML parser (78 lines) will need replacement if schema evolves beyond flat structure. Document supported/unsupported YAML features at the parser header.
🟡 [architect] `bin/lib/runbooks.mjs:196` — `_filename` leaks internal metadata into the public runbook data shape. Consider encapsulating tie-break logic to avoid exposing the field.
🟡 [engineer] `bin/lib/run.mjs:831` — No CLI E2E test for `--runbook <name>` flag. Risk: flag parsing could break without detection.
[engineer] - The prior engineer review's 🟡 about untested `planTasks()` has been **fully resolved** — 6 direct unit tests now exist
🟡 [product] SPEC.md:22 — AC signature `matchRunbook(description, runbooksDir)` conflicts with Technical Approach at line 72 which says `matchRunbook(description, runbooks)`. Implementation follows the correct design. Update AC.
🟡 [product] SPEC.md:23 — AC wording "regex match correctly narrows candidate set" implies two-phase filtering, but implementation (and Technical Approach) use additive scoring. Reword AC.
🟡 [product] bin/lib/runbooks.mjs:221 — Keyword substring matching ("api" matches "capital") is intentional and code-documented, but no user-facing authoring guidance exists. Users writing custom runbooks need to know this.
🟡 [product] tasks/task-4-p1-p1/handshake.json — Stale FAIL verdict despite passing code. Breaks audit trail.
🟡 [tester] test/runbooks.test.mjs:542 — No CLI integration test invokes `agt run --runbook <name>` end-to-end; the `--runbook` flag parsing (run.mjs:831) and opts.runbook code path (run.mjs:425-427) are tested only via direct `planTasks()` calls, not actual CLI invocation
🟡 [tester] test/runbooks.test.mjs:434 — Console output (`[runbook] matched:` / `[runbook] forced:` at run.mjs:436-438) is never asserted; no test captures stdout to verify the matched runbook name and score appear
🟡 [security] `bin/lib/runbooks.mjs:110` — `isSafeRegex` heuristic misses alternation-based ReDoS patterns like `(a|a)+$` (verified: 544ms on 22 chars, exponential growth). Low exploitability — requires repo write access to plant malicious YAML, and that access already grants arbitrary code execution via package.json. Add to backlog.
🔵 [architect] `bin/lib/run.mjs:427` — Forced runbook returns `score: Infinity`. Magic value; consider a named constant or `forced: true` flag.
🔵 [architect] `bin/lib/runbooks.mjs:211` — `typeof p.weight === "number"` accepts `NaN`/`Infinity`/negatives. Tighter guard would be safer.
🔵 [architect] `bin/lib/runbooks.mjs:25` — Silent skip on unrecognized YAML lines; a `console.warn` would aid debugging.
🔵 [engineer] `bin/lib/runbooks.mjs:247` — Tie-break condition spans 120+ chars; consider extracting to a helper.
🔵 [engineer] `bin/lib/runbooks.mjs:159` — `!p.value` truthiness check could falsely reject numeric value `0`.
🔵 [engineer] `bin/lib/runbooks.mjs:221` — Substring keyword matching is intentional and documented. No action needed.
🔵 [product] bin/lib/runbooks.mjs:211 — No validation that `weight` is positive. Negative weights would subtract from score.
🔵 [product] bin/lib/run.mjs:427 — Forced runbook uses `score: Infinity` — a named sentinel would be clearer.
🔵 [tester] bin/lib/runbooks.mjs:242 — `matchRunbook` crashes on null/undefined `runbooks` parameter (`for...of` on null); safe in practice since `loadRunbooks` always returns `[]`, but the public export has no defensive guard
🔵 [tester] bin/lib/runbooks.mjs:207 — No test for `minScore: 0` catch-all or negative pattern weights; low risk with trusted authors
🔵 [tester] test/runbooks.test.mjs:526 — Keyword substring matching ("api" matches inside "capital") is documented as intentional but could produce false positives with short keywords
🔵 [security] `bin/lib/runbooks.mjs:13` — `parseYaml` uses `{}` instead of `Object.create(null)`. Verified NOT exploitable for prototype pollution — `loadRunbooks()` constructs output objects with only named fields. Cosmetic hardening only.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**