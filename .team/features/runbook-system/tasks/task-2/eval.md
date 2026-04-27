## Parallel Review Findings

🟡 [architect] `bin/lib/runbooks.mjs:12-78` — Custom YAML parser handles only flat runbook schema. Track replacement with `js-yaml` if schema evolves to need multi-line strings, flow collections, or deeper nesting.
🟡 [architect] `SPEC.md:88-94` — Scoring Algorithm pseudocode references stale field names (`pattern`/`keywords`/`threshold` vs shipped `patterns`/`minScore`). Reconcile to avoid confusing future contributors.
🟡 [engineer] `bin/lib/runbooks.mjs:208` — `scoreRunbook` guards against falsy `description` but not non-string types; a truthy non-string (e.g. `42`) would throw `TypeError` at `.toLowerCase()`. Public export — add type guard.
🟡 [engineer] `test/runbooks.test.mjs:393` — ReDoS guard, YAML comment, and per-element validation test blocks use inline `rmSync` cleanup instead of `beforeEach`/`afterEach`; temp dirs leak on assertion failure.
🟡 [product] `bin/lib/runbooks.mjs:247` — Tie-break filename vs id divergence undocumented; benign but needs a comment
🟡 [product] `.team/runbooks/*.yml` — Scoring thresholds need validation with real usage data (single regex match can trigger)
🟡 [product] SPEC.md — No user-facing guidance for creating/debugging custom runbooks; file as follow-up UX task
🟡 [tester] `test/runbooks.test.mjs` — No subprocess test for `--runbook <name>` CLI flag wiring. Unit tests cover `selectRunbook()` but not the CLI→function path at `run.mjs:825→1000`.
🟡 [tester] `test/runbooks.test.mjs` — No test for console output format (`[runbook] matched: {name} (score {n})`). SPEC requires this; could silently regress.
🟡 [tester] `test/runbooks.test.mjs` — No subprocess test for `--runbook <unknown>` warning + fallthrough behavior.
🟡 [tester] `test/runbooks.test.mjs:83-88` — Only tests missing `id` field. Missing per-field validation tests for `name`, `patterns`, `minScore`, `tasks` individually.
🟡 [tester] `test/runbook-dir.test.mjs` — No test verifying the 3 built-in runbooks have valid schema and ≥4 tasks each (SPEC acceptance criterion 10).
🟡 [security] `bin/lib/runbooks.mjs:105-111` — `isSafeRegex` heuristic misses alternation-based ReDoS patterns like `(a|a)+$`. Backlog: adopt a proper safe-regex library before enabling user-contributed runbooks.
🟡 [security] `bin/lib/runbooks.mjs:218` — No timeout on regex execution. If a ReDoS pattern bypasses the heuristic, the process hangs. Backlog: consider `RE2` or execution timeout for untrusted patterns.
🟡 [security] `bin/lib/run.mjs:1005` — `FLOWS[runbookFlow]` uses bracket notation on a plain object. A crafted YAML `flow: "constructor"` would resolve to `Object` via prototype chain, causing a crash. Add `Object.hasOwn(FLOWS, runbookFlow)` guard.
🟡 [security] `bin/lib/runbooks.mjs:51-62` — Custom YAML parser sets arbitrary keys from file content on plain objects. Prototype pollution possible with `__proto__` keys. Low risk given controlled authorship.
🔵 [architect] `bin/lib/runbooks.mjs:209` — Double `isSafeRegex` guard (load-time + score-time) is documented as defensive-in-depth. Score-time check is unreachable in production path. Acceptable.
🔵 [architect] `bin/lib/runbooks.mjs:201,231` — `scoreRunbook`/`matchRunbook` exported but only consumed by tests (not `run.mjs`). Common test-export pattern. Minor public API surface concern.
🔵 [architect] `bin/lib/runbooks.mjs:259-278` — `include` resolution has zero consumers among built-in runbooks. Spec-mandated, minimal cost (20 lines), no action needed.
🔵 [engineer] `bin/lib/runbooks.mjs:110` — `isSafeRegex` catches `(a+)+` but not all ReDoS vectors (e.g. `(a|a)*$`). Acceptable for trusted local YAML; consider hardening if community-contributed runbooks are supported.
🔵 [engineer] `bin/lib/runbooks.mjs:24` — Custom YAML parser can silently misproduce output for malformed input without warning (catch at line 197 handles only exceptions, not silent misparsing).
🔵 [product] `bin/lib/runbooks.mjs:221` — Keyword substring matching could cause false positives with short keywords
🔵 [product] `bin/lib/runbooks.mjs:12` — Custom YAML parser limitations should be documented in runbook files
🔵 [tester] `test/runbooks.test.mjs` — Consider testing `scoreRunbook` with empty `patterns` array (public export, bypasses `loadRunbooks` validation).
🔵 [tester] `test/runbooks.test.mjs` — No test for task with both `title` and `include` fields — documents which takes precedence.
🔵 [tester] `test/runbooks.test.mjs:392-418` — ReDoS load-time test uses inline cleanup instead of `beforeEach`/`afterEach` pattern.
🔵 [security] `bin/lib/runbooks.mjs:120-122` — `readdirSync` errors silently return `[]`. Add `console.warn` for debuggability.
🔵 [security] `bin/lib/runbooks.mjs:211` — No validation that `weight` is positive/finite. Negative weights could distort scoring.
🔵 [security] `bin/lib/runbooks.mjs:427` — CLI `--runbook` value interpolated into console output. No risk in terminal; note for future structured logging.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**