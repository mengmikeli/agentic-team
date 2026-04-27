## Parallel Review Findings

🟡 [architect] `bin/lib/runbooks.mjs:12` — Custom YAML parser (78 lines) constrains schema evolution. Add a header comment documenting supported vs unsupported YAML features so future developers know the boundary.
🟡 [architect] `bin/lib/runbooks.mjs:196` — `_filename` internal metadata exposed on the public runbook shape. Only used for tie-breaking; underscore prefix is weak coupling protection.
🟡 [engineer] `bin/lib/run.mjs:423` — `--runbook` flag silently ignored when runbooks directory is empty. The `runbooks.length > 0` guard at line 423 prevents the "not found" warning at line 432 from firing. User gets no feedback that their flag was ignored.
🟡 [engineer] `bin/lib/runbooks.mjs:110` — `isSafeRegex` only catches nested quantifiers after groups `(a+)+`. Alternation-based ReDoS and non-group quantifier stacking are not detected. Low risk for repo-local files.
🟡 [product] `bin/lib/runbooks.mjs:229` — Keyword substring matching ("api" matches inside "capital") could cause false-positive runbook matches. Track as future improvement: consider a `wordBoundary: true` pattern option.
🟡 [tester] test/runbooks.test.mjs:12 — `parseYaml` has no direct unit tests; adversarial YAML (tabs, BOM, `\r\n`) goes through `loadRunbooks` with well-formed helper output only. Add targeted parser edge-case tests.
🟡 [tester] bin/lib/runbooks.mjs:110 — `isSafeRegex` only catches classic `(x+)+` ReDoS; patterns like `(\w+\w+)+` slip through. Document limitations and consider a timeout guard.
🟡 [tester] bin/lib/run.mjs:471 — `planTasks(null, null, {})` produces `title: null` in the single-task fallback. No test covers this path.
🟡 [security] `bin/lib/runbooks.mjs`:110 — `isSafeRegex` heuristic misses alternation-based ReDoS patterns like `(a|a)+$`. Low exploitability — requires repo write access, which already grants arbitrary code execution via package.json/CI. Backlog item.
[simplicity] | Gold-plating | CLEAR — previous 🟡 findings resolved (flow + include now exercised) |
🔵 [architect] `bin/lib/run.mjs:427` — `score: Infinity` for forced runbook. Consider `{ score: -1, forced: true }` to avoid numeric surprises.
🔵 [architect] `bin/lib/runbooks.mjs:221` — Keyword substring matching ("api" matches "capital") is documented as intentional. Consider optional `word_boundary: true` if false positives emerge at scale.
🔵 [engineer] `bin/lib/runbooks.mjs:12` — Custom YAML parser doesn't support block scalars (`|`, `>`). Known limitation but may surprise users authoring runbooks.
🔵 [engineer] `bin/lib/runbooks.mjs:266` — `allRunbooks.find()` is O(n*m) for include resolution. Fine at current scale.
🔵 [product] `bin/lib/runbooks.mjs:12` — Custom YAML parser limitations aren't documented for end users authoring custom runbooks. Consider noting supported YAML subset in example files.
🔵 [tester] bin/lib/runbooks.mjs:194 — Invalid `flow` values (e.g., `flow: banana`) silently fall through to `selectFlow`. Safe behavior but no test documents it.
🔵 [tester] test/runbooks.test.mjs:436 — ReDoS `loadRunbooks` test manually calls `rmSync` instead of using `beforeEach`/`afterEach`; could leak temp dirs on failure.
🔵 [tester] bin/lib/runbooks.mjs:229 — Keyword loop is O(n) per occurrence; not a practical issue but could be documented for pathological inputs.
🔵 [tester] test/runbooks.test.mjs:587 — Substring matching test (`api` matches `capital`) exists at `scoreRunbook` level but not at `matchRunbook` level where the false-positive risk is user-facing.
🔵 [security] `bin/lib/runbooks.mjs`:13 — `parseYaml` uses `{}` for object construction; `Object.create(null)` would be cleaner. Not exploitable (prior review empirically verified `__proto__` assignment does not pollute `Object.prototype` globally, and `loadRunbooks` constructs new objects with explicit fields only).
🔵 [security] `bin/lib/runbooks.mjs`:218 — `new RegExp(pv, "i").test(description)` has no execution timeout. Defense-in-depth against guard bypass — consider wrapping with a timeout.
🔵 [simplicity] bin/lib/runbooks.mjs:247 — Tie-breaking comparison is dense; inline comment would aid readability
🔵 [simplicity] bin/lib/runbooks.mjs:274,279 — Hint spread pattern appears twice; watch for proliferation

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**