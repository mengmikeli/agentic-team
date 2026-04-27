## Parallel Review Findings

🟡 [product] `bin/lib/run.mjs:423` — `--runbook` silently ignored when runbooks dir is empty (no warning to user). Move the check outside the `runbooks.length > 0` guard.
🟡 [product] `SPEC.md:22` — AC signature still says `matchRunbook(description, runbooksDir)` but implementation takes `(description, runbooks)`.
🟡 [product] `SPEC.md:23` — AC says "narrows candidate set" but algorithm is additive scoring. Reword to match.
🟡 [tester] `test/cli-commands.test.mjs:290` — No test for `--runbook` as the last argument (missing value); `getFlag()` would return the next arg (`--dry-run`) as the runbook id. Add a test proving `agt run "desc" --runbook --dry-run` handles this gracefully instead of treating `--dry-run` as the runbook id.
🟡 [security] `bin/lib/runbooks.mjs`:110 — `isSafeRegex` heuristic misses alternation-based ReDoS patterns like `(a|a)+$`. Pre-existing, low exploitability (requires repo write access). Backlog item.
🟡 [simplicity] `test/runbooks.test.mjs:385` — Duplicate test: "warns on nested includes" is identical to "does not recurse into nested includes" (line 324). Same setup, same assertion. Delete one or differentiate by verifying `console.warn` was emitted.
🟡 [simplicity] `bin/lib/runbooks.mjs:12` — Custom YAML parser (90 lines) is a deliberate zero-dependency trade-off, but should document which YAML constructs it does NOT support to prevent future debugging confusion.
🔵 [architect] bin/lib/runbooks.mjs:222 — Keyword substring matching ("api" matches "capital") is intentional per comments but could cause false positives at scale; consider word-boundary matching if runbook count grows
🔵 [architect] bin/lib/runbooks.mjs:12 — Hand-rolled YAML parser is appropriate for current flat schema but would need replacement if schema gains nested objects; document this constraint
🔵 [product] `bin/lib/run.mjs:425` — `score: Infinity` works but a string sentinel like `"forced"` would be more explicit for future consumers.
🔵 [product] `.team/runbooks/` — No user-facing authoring guide for custom runbook authors (keyword substring behavior, minScore tuning, include semantics).
🔵 [tester] `test/runbooks.test.mjs:773` — Consider adding a test where forced runbook overrides a different naturally-matching runbook to prove mutual exclusivity.
🔵 [tester] `test/runbooks.test.mjs:773` — Consider testing that forced runbook preserves `runbookFlow` in the returned object.
🔵 [security] `bin/lib/runbooks.mjs`:13 — `parseYaml` uses `{}` instead of `Object.create(null)`. Cosmetic hardening, not exploitable.
🔵 [security] `bin/lib/runbooks.mjs`:218 — No regex execution timeout on `new RegExp(pv, "i").test()`. Defense-in-depth suggestion.
🔵 [simplicity] `.team/runbooks/shared-setup.yml:1` — Only included by one runbook. Fine as a feature demo; consider inlining if no second consumer appears.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**