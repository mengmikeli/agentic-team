## Parallel Review Findings

🔴 [product] `.team/runbooks/` — 3 built-in runbook YAMLs do not exist on HEAD. Commits that added them are orphaned/unreachable. Spec ACs #1–#3 unmet.
🔴 [product] `bin/lib/run.mjs:800` — `planTasks()` never calls `loadRunbooks`/`matchRunbook`/`resolveRunbookTasks`. Only a `mkdirSync` was added. Spec ACs #6, #9 unmet.
🔴 [product] `bin/agt.mjs` — No `--runbook <name>` flag exists. Spec ACs #7, #8 unmet.
🔴 [simplicity veto] `bin/lib/runbooks.mjs:138` — `_file: file` stored on every runbook object but never read by any consumer, not in SPEC, no test asserts it. Gold-plating. **Fix:** delete the line.
[simplicity veto] The implementation is well-scoped overall — 211 lines, 4 focused exports, justified custom YAML parser. The 🔴 is a one-line fix (`_file` removal). After that, this is clean to merge.
🟡 [architect] `task-1/artifacts/test-output.txt:3` — Stale artifact references test files that no longer exist (`test/runbook-add-cli-command.test.mjs`, `test/active-task-utils.test.mjs`); regenerate from current `npm test`
🟡 [architect] `bin/lib/runbooks.mjs:12` — Custom YAML parser (66 lines) handles only flat schema; no inline comments, multi-line strings, or flow syntax support; document subset or plan `js-yaml` migration before schema evolves
🟡 [architect] `bin/lib/runbooks.mjs:197` — `resolveRunbookTasks` silently drops missing `include` refs with no warning, unlike `loadRunbooks` which `console.warn`s; make error reporting consistent
🟡 [engineer] `bin/lib/runbooks.mjs:118` — `loadRunbooks` validates `patterns` as non-empty array but doesn't validate individual pattern objects for `type`/`value` fields; a malformed pattern silently scores 0 with no warning. Add per-pattern validation in the load loop.
🟡 [engineer] `bin/lib/runbooks.mjs:126` — Tasks validated only as non-empty array. A task with neither `title` nor `include` produces `{ title: undefined }` in `resolveRunbookTasks`. Add per-task schema check.
🟡 [engineer] `bin/lib/runbooks.mjs:22` — YAML parser doesn't strip inline comments. `value: foo # comment` parses as `"foo # comment"`. Will bite runbook authors adding comments to regex patterns.
🟡 [engineer] `bin/lib/runbooks.mjs:156` — `new RegExp(p.value, "i")` compiled on every `scoreRunbook` call. Minor perf concern at scale.
🟡 [product] `SPEC.md:40-46` — Schema divergence: spec says `pattern`/`keywords`/`threshold`, implementation uses `patterns[]`/`minScore`. Spec never updated.
🟡 [product] `SPEC.md:22` — `matchRunbook` API takes `(description, runbooks)` not `(description, runbooksDir)` as spec states.
🟡 [product] `SPEC.md:23` — "Regex narrows candidate set" is misleading; scores are accumulated additively.
🟡 [product] `SPEC.md:29` — AC #11 claims `--runbook` override test coverage, but those features don't exist.
🟡 [tester] `bin/lib/runbooks.mjs:161` — `scoreRunbook` crashes on null/undefined description; `description.toLowerCase()` throws TypeError. Confirmed via `node -e`. Add a guard before the module is consumed by `planTasks()`.
🟡 [tester] `test/runbooks.test.mjs:82` — Only 1 of 5 `loadRunbooks` validation skip branches is tested (missing `id`). Lines 113-129 have 4 untested code paths (missing `name`, `patterns`, `minScore`, `tasks`). All 4 work correctly (confirmed manually), but no regression protection exists.
🟡 [tester] `test/runbooks.test.mjs:1-298` — No test for the try/catch at `bin/lib/runbooks.mjs:140` (file-read error path). No regression protection for graceful error handling.
🟡 [security] bin/lib/runbooks.mjs:156 — `new RegExp(p.value, "i").test(description)` compiles regex from YAML without a time/complexity bound; a catastrophically backtracking pattern (e.g., `(a+)+$`) hangs the process. The `try/catch` only catches `SyntaxError`, not ReDoS. Backlog: add a regex execution timeout or compile-time complexity check before use in CI/automation contexts.
🟡 [simplicity] `test/runbook-dir.test.mjs:34-41` — Tests source-code ordering via `src.indexOf()`, not runtime behavior. Fragile.
🟡 [simplicity] `bin/lib/runbooks.mjs` — Zero production consumers (only test imports it). Phased delivery by design, but creates orphan risk.
🟡 [simplicity] Prior eval references `test/runbook-add-cli-command.test.mjs` and `.team/runbooks/add-cli-command.yml` — neither file exists in the current codebase.
🔵 [architect] `bin/lib/runbooks.mjs:84` — `castValue` number regex skips scientific notation; fine for runbook schema
🔵 [architect] `bin/lib/runbooks.mjs:156` — Regex compiled on every `scoreRunbook` call; cache if scoring becomes hot path
🔵 [engineer] `bin/lib/runbooks.mjs:182` — Tie-breaking uses `rb.id` not filename per SPEC. No practical impact; update SPEC.
🔵 [engineer] `bin/lib/runbooks.mjs` — Schema (`patterns` + `minScore`) deviates from SPEC's documented schema (`pattern` + `keywords` + `threshold`). Implementation is better; SPEC needs updating.
🔵 [engineer] `test/runbooks.test.mjs` — No explicit test for unknown pattern type. Behavior is correct (scores 0) but undocumented.
🔵 [product] `bin/lib/runbooks.mjs:156` — ReDoS risk from user-authored regex (low priority, trusted authors).
🔵 [product] `progress.md:155` — 1/26 tasks completed; $23.85 burned. ENOBUFS infrastructure failure blocked remaining work.
🔵 [tester] `bin/lib/runbooks.mjs:138` — `_file` property captured but never asserted in tests.
🔵 [tester] `test/runbooks.test.mjs:123-178` — No test for unknown pattern type or empty description edge cases.
🔵 [tester] `bin/lib/runbooks.mjs:156` — No ReDoS protection on regex patterns. Acceptable for v1 (project-authored runbooks, not user input).
🔵 [security] bin/lib/runbooks.mjs:106 — `readFileSync` has no file size guard; a very large YAML file could cause memory pressure. Low risk for local CLI.
🔵 [security] bin/lib/runbooks.mjs:24 — Custom YAML parser accepts `__proto__` as a key name. Not exploitable (doesn't pollute `Object.prototype`, downstream validation rejects malformed runbooks), but worth noting if parser is reused.
🔵 [simplicity] `castValue()` boolean/null paths have no test coverage through the YAML parser.
🔵 [simplicity] `flow` field loaded but has no downstream consumer yet (expected per SPEC phasing).

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**