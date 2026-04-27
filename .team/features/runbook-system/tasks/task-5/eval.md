## Parallel Review Findings

🟡 [architect] `bin/lib/runbooks.mjs:12` — Custom YAML parser will need replacement if schema evolves beyond flat structure
🟡 [architect] `bin/lib/runbooks.mjs:196` — `_filename` leaks internal metadata into public runbook shape
[architect] Both 🟡 items are carried forward from the prior review. No new warnings, no critical findings.
🟡 [product] SPEC.md:62 — Return type `Task[]` undefined; implementation returns `{ title, hint? }[]`. Update spec to be explicit.
🟡 [product] `bin/lib/runbooks.mjs:262` — `resolveRunbookTasks` trusts `title` exists on referenced tasks. Safe today (all paths go through `loadRunbooks`), but fragile if function becomes public API.
🟡 [product] `.team/runbooks/shared-setup.yml` — 4th runbook file not listed in SPEC's "3 built-in runbooks". Justified addition for `include:` support, but SPEC should acknowledge it.
🟡 [tester] test/runbooks.test.mjs:385 — Test "warns on nested includes" doesn't assert `console.warn` was called; only checks return value. Builder claims warning emission but tests don't verify it. Mock `console.warn` to close this gap.
🟡 [security] `bin/lib/runbooks.mjs`:110 — `isSafeRegex()` heuristic misses alternation-based ReDoS patterns like `(a|a)+$` (verified: 550ms on 22 chars). Low exploitability — requires repo write access, which already grants arbitrary code execution. Backlog item.
🟡 [simplicity] `bin/lib/runbooks.mjs:131-155` — `loadRunbooks` validation forces include-only runbooks (like `shared-setup.yml`) to carry placeholder patterns they'll never match (`minScore: 100`, keyword `shared-setup-internal`). Schema design smell — consider an `includeOnly` flag or relaxed validation for internal-use runbooks. Backlog.
[architect] `resolveRunbookTasks` is architecturally sound — a 25-line pure function with structural one-level-deep enforcement, no recursion risk, and clean positional inlining. The self-include guard from the prior 🔵 finding has been implemented. 60/60 tests pass. All 5 builder claims verified against code evidence.
🔵 [architect] `.team/runbooks/shared-setup.yml:3` — `minScore: 100` as include-only marker needs a comment explaining the pattern
🔵 [architect] `SPEC.md:73` — Spec says `string[]` return type but impl returns `{ title, hint? }[]`
🔵 [architect] `bin/lib/runbooks.mjs:266` — Linear scan per include; consider Map at scale
🔵 [engineer] `test/runbooks.test.mjs:385` — "warns on nested includes" test verifies return value but does not spy on `console.warn` to assert the warning message was actually emitted
🔵 [engineer] `bin/lib/runbooks.mjs:247` — `matchRunbook` tie-breaking comparison is a dense one-liner; a `tieBreakKey(rb)` helper would improve readability (logic is correct as-is)
🔵 [product] `test/runbooks.test.mjs:385` — "warns on nested includes" test duplicates the scenario at line 324 without asserting the warning was emitted (no stderr capture). Tests are functionally identical.
🔵 [product] `test/runbooks.test.mjs:324` — Nested-include test could add a negative assertion confirming deep tasks are explicitly absent.
🔵 [tester] test/runbooks.test.mjs:345 — Self-include test also doesn't verify `console.warn` output; same pattern.
🔵 [tester] bin/lib/runbooks.mjs:261 — Task with both `include` and `title` silently discards `title`; consider warning.
🔵 [tester] bin/lib/run.mjs:442 — If `resolveRunbookTasks` returns `[]`, `planTasks` returns empty task list instead of falling through to default planning.
🔵 [security] `bin/lib/runbooks.mjs`:13 — `Object.create(null)` in parseYaml would be cleaner but NOT exploitable (verified empirically).
🔵 [security] `bin/lib/runbooks.mjs`:263 — `task.include` passed to `console.warn` unsanitized could contain ANSI escapes. Same trust boundary — cosmetic.
🔵 [simplicity] `bin/lib/runbooks.mjs:247` — Tie-breaking condition is a dense single-line boolean. An inline comment would reduce cognitive load.
🔵 [simplicity] `bin/lib/runbooks.mjs:274,279` — Hint spread pattern repeated twice. Fine for 2 uses; watch for a third.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**