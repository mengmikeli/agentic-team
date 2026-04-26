## Parallel Review Findings

🔴 [simplicity veto] `bin/lib/runbooks.mjs:188` — Gold-plating: `flow` field stored but never consumed by any production code; not in SPEC.md; none of the 3 built-in runbooks use it. Delete `flow: doc.flow || null` and the test at `test/runbooks.test.mjs:96-106`.
🟡 [architect] `bin/lib/run.mjs:437` — `planTasks()` discards runbook `flow` field; flow selection at line 1004 runs independently via `selectFlow()`, ignoring any runbook-specified flow. Wire or remove.
🟡 [architect] `bin/lib/run.mjs:441` — `hint` field propagated through 3 functions and 2 modules to task objects but `buildTaskBrief()` never reads it. Dead-end data path.
🟡 [architect] `bin/lib/runbooks.mjs:105` — `isSafeRegex` heuristic catches nested quantifiers but not overlapping alternations (`(a|a)+`) or polynomial-time patterns. Must upgrade before untrusted sources.
🟡 [architect] `SPEC.md` — Schema diverged: SPEC says `pattern`/`keywords`/`threshold`, implementation ships `patterns`/`minScore`. Implementation is better but SPEC is misleading.
🟡 [architect] `bin/lib/run.mjs:420` — Default `runbooksDir` uses `process.cwd()` while caller stores `mainCwd` at line 817. Could diverge in daemon mode.
🟡 [engineer] `bin/lib/runbooks.mjs:213` — `scoreRunbook` crashes on null/undefined description (`description.toLowerCase()` throws TypeError). Guard needed.
🟡 [engineer] `bin/lib/run.mjs:500` — `buildTaskBrief` never reads `task.hint`. Runbook hints flow through the entire pipeline and are silently discarded. Highest-impact improvement to wire in.
🟡 [engineer] `bin/lib/runbooks.mjs:188` — `flow` field loaded but never consumed downstream. Dead data path.
🟡 [engineer] `test/runbooks.test.mjs` — No integration test for `planTasks()` → runbook code path. Highest-risk untested seam.
🟡 [product] `SPEC.md:34-53` — Schema diverged from spec without update. Implementation uses `patterns`/`minScore` instead of spec's `pattern`/`keywords`/`threshold`. Update the spec.
🟡 [product] `SPEC.md:23` (AC #5) — Behavioral deviation. Spec says "regex narrows candidates before keyword scoring." Implementation uses additive scoring — both contribute to one total score. Not a two-phase filter.
🟡 [product] `bin/lib/run.mjs:441` — **`hint` is a dead-end data path.** All 3 built-in runbooks include per-task hints (e.g., "Define flags, positional args, and --help output") that flow through the pipeline but `buildTaskBrief` never shows them to the agent. This is the single highest-impact fix to make.
🟡 [product] `bin/lib/runbooks.mjs:188` — `flow` field loaded from YAML but never consumed by flow selection. Dead data.
🟡 [product] `test/runbooks.test.mjs` — No integration test for `planTasks()` → runbook code path. Highest-risk untested seam.
🟡 [tester] bin/lib/runbooks.mjs:213 — `scoreRunbook` crashes on null/undefined description (`description.toLowerCase()` TypeError); reachable from `planTasks()`. Add `if (!description) return 0;` guard.
🟡 [tester] test/runbooks.test.mjs — No integration test for `planTasks()` → runbook matching path. This is the highest-risk untested seam — the SPEC Testing Strategy explicitly calls for it.
🟡 [tester] test/runbooks.test.mjs — No test for `--runbook nonexistent` CLI fallthrough (SPEC AC #8). Unit test covers `selectRunbook` return value but not the console warning or actual brainstorm fallthrough.
🟡 [tester] bin/lib/run.mjs:437 — Runbook `flow` field loaded and stored but never consumed downstream. Dead data propagated through 3 functions.
🟡 [security] `bin/lib/runbooks.mjs`:110 — `isSafeRegex` heuristic misses alternation-based ReDoS patterns like `(a|a)+$`. Verified: bypasses the guard and causes 4.3s backtracking on 25 chars. Fix: detect alternation in quantified groups, add regex timeout, or use `safe-regex2`.
🔵 [architect] `bin/lib/runbooks.mjs` — No `schema: v1` version field in YAML format for future migration.
🔵 [architect] `bin/lib/runbooks.mjs:213` — Keyword matching is substring-based; `"test"` matches `"testing"`. Word boundaries would reduce false positives.
🔵 [architect] `bin/lib/runbooks.mjs:24` — YAML parser accepts `__proto__` as a key. Not exploitable but worth a blocklist.
🔵 [architect] `bin/lib/run.mjs:832` + `bin/lib/init.mjs:45` — `.team/runbooks/` mkdir in two independent call sites. Extract when next directory is added.
🔵 [engineer] `bin/lib/runbooks.mjs:214` — Keyword matching uses substring `indexOf`, not word boundaries.
🔵 [engineer] `bin/lib/run.mjs:420` — `process.cwd()` default vs `mainCwd` used elsewhere.
🔵 [engineer] `SPEC.md` — Schema diverged from implementation; needs updating.
🔵 [engineer] `bin/lib/runbooks.mjs:25` — `parseYaml` silently skips unparseable lines.
🔵 [product] `bin/lib/runbooks.mjs:245` — `selectRunbook` exported but not in SPEC. Useful; just document it.
🔵 [product] `progress.md` — Execution cost was high ($23.85, 200 min, 1/26 initial pass rate) due to ENOBUFS infrastructure issues, not implementation bugs.
🔵 [tester] test/runbooks.test.mjs:82 — Only 1 of 5 `loadRunbooks` validation branches has a dedicated test (missing id). Other 4 branches share same pattern so risk is low.
🔵 [tester] bin/lib/runbooks.mjs:110 — `isSafeRegex` misses non-quantifier ReDoS vectors like `(a|a)+b`. Low risk for repo-authored runbooks.
🔵 [tester] test/runbooks.test.mjs — No test for empty string description or unknown pattern type. Both safe (score 0) but documenting behavior is good hygiene.
🔵 [tester] test/runbooks.test.mjs:209 — Tie-break test verifies `id` (matches code) but SPEC says "filename". Equivalent in practice.
🔵 [security] `bin/lib/runbooks.mjs`:13 — `parseYaml` uses `{}` instead of `Object.create(null)` — theoretical prototype pollution via YAML keys like `__proto__`. Low risk given repo-local files.
🔵 [security] `bin/lib/runbooks.mjs`:127 — No size limit on `readFileSync` for YAML files. Low risk (attacker already has repo write access).
🔵 [simplicity] `bin/lib/runbooks.mjs:207` — Double `isSafeRegex` check (also at load time, line 158). Defense-in-depth is fine; a comment would clarify intent.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**