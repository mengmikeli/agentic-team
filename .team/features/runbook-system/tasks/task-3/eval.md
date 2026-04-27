## Parallel Review Findings

🟡 [architect] `bin/lib/run.mjs:420` — `planTasks()` defaults `runbooksDir` to `process.cwd()` instead of accepting `mainCwd` from the caller. Latent coupling to execution order — currently safe because it's called before worktree chdir, but fragile. Pass `mainCwd` explicitly.
🟡 [architect] `bin/lib/run.mjs:418` — `planTasks()` has no direct unit test. Task shape mapping and `runbookFlow` return are verified only by code reading (carried forward from prior review).
🟡 [product] SPEC.md:23 — AC wording "regex match correctly narrows candidate set before keyword scoring" implies two-phase filtering, but the actual algorithm is additive scoring. Reword for clarity.
🟡 [product] bin/lib/runbooks.mjs:221 — Keyword substring matching ("api" matches inside "capital") is intentional but undocumented for end users. Needs runbook-authoring guidance.
🟡 [product] tasks/task-4*/handshake.json — All four task-4 handshakes show FAIL verdict, but code now passes 49/49. Stale audit trail.
🟡 [product] commit 6feae86 — Commit message claims `scoreRunbook` implementation, but diff contains zero source code changes. `scoreRunbook` was implemented in earlier commits alongside `loadRunbooks`.
🟡 [tester] `bin/lib/runbooks.mjs:210` — `scoreRunbook` is a public export but crashes on `scoreRunbook("desc", {})` (undefined patterns). Add a null guard or document the contract with a test.
🟡 [tester] `test/runbooks.test.mjs:122` — No test for negative weights. `weight: -3` produces negative scores, which interact with `minScore` in untested ways. Document whether negative weights are accepted or rejected.
🟡 [tester] `test/runbooks.test.mjs:122` — `NaN` weight via programmatic API poisons scoring. If a NaN-weighted runbook becomes `best` first in `matchRunbook`, no valid runbook can replace it (`score > NaN` is always false). YAML loading prevents this, but the public API is unprotected.
🔵 [architect] `bin/lib/runbooks.mjs:261` — `score: Infinity` for forced selections is a magic value. Consider `{ runbook, score, forced: true }` for clarity.
🔵 [architect] `bin/lib/runbooks.mjs:12-78` — Custom YAML parser is well-scoped for v1. Document as a migration candidate if schema grows beyond flat scalars/lists.
🔵 [architect] `bin/lib/runbooks.mjs:196` — `_filename` leaks through the public API for tie-breaking. Consider using `id` instead or documenting the field.
🔵 [engineer] `bin/lib/runbooks.mjs:210` — `scoreRunbook` doesn't guard against malformed `runbook` objects (missing `patterns`). Unreachable via normal pipeline but it's a public export. Add `if (!runbook?.patterns) return 0;`.
🔵 [engineer] `bin/lib/runbooks.mjs:279` — `resolveRunbookTasks` silently drops nested `include` entries (one-level-deep rule) without a diagnostic warning, unlike missing references which do warn at line 275.
🔵 [engineer] `bin/lib/runbooks.mjs:218` — `new RegExp()` allocated per call per pattern. Fine for CLI; cache if ever used in a hot path.
🔵 [product] bin/lib/runbooks.mjs:211 — No validation that `weight` is positive. Negative weights would subtract from score.
🔵 [product] SPEC.md:74 — SPEC doesn't specify edge-case behavior (null description, invalid regex) that the implementation handles gracefully.
🔵 [tester] `test/runbooks.test.mjs:122` — No test for empty patterns array (`{ patterns: [] }`). Code returns 0 correctly but contract is undocumented.
🔵 [tester] `bin/lib/runbooks.mjs:231` — Non-overlapping keyword counting (`idx += kw.length`) is untested. Keyword `"aa"` in `"aaa"` counts 1, not 2.
🔵 [tester] `bin/lib/runbooks.mjs:105-111` — `isSafeRegex` heuristic misses patterns like `([\w]+)+` where quantifier is inside a character class before group close.
🔵 [simplicity] bin/lib/runbooks.mjs:247 — Tie-break expression is dense; extract to a named variable for readability
🔵 [simplicity] bin/lib/runbooks.mjs:280 — Spread pattern `...(t.hint ? { hint: t.hint } : {})` could be simplified to `hint: t.hint || undefined`

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**