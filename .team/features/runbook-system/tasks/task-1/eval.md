## Parallel Review Findings

[simplicity veto] **0 critical (🔴) | 4 warnings (🟡) | 2 suggestions (🔵)**
🟡 [architect] bin/lib/runbooks.mjs:155 — ReDoS confirmed: `(a+)+$` pattern takes **4886ms** on 26 chars. Add `safe-regex` validation or execution timeout before CI/automation use.
🟡 [architect] bin/lib/runbooks.mjs:118–129 — No per-element validation in `loadRunbooks`. Pattern `{ weight: 5 }` (no type/value) silently scores 0; task with no title/include produces `{ title: undefined }`. Add per-item schema checks.
🟡 [architect] bin/lib/runbooks.mjs:12–78 — Custom YAML parser doesn't strip inline `#` comments (differs from YAML spec). Will corrupt regex patterns if authors add inline comments.
🟡 [engineer] `bin/lib/runbooks.mjs:155` — ReDoS risk: user-authored regex compiled without timeout guard; catastrophic backtracking pattern in YAML could hang the process
🟡 [engineer] `bin/lib/runbooks.mjs:118` — Per-pattern validation gap: `loadRunbooks` checks patterns array is non-empty but doesn't validate each pattern has `type` and `value` fields
🟡 [engineer] `bin/lib/runbooks.mjs:21` — Custom YAML parser doesn't strip inline comments; `value: foo # comment` parses as `"foo # comment"`
🟡 [product] `test/runbooks.test.mjs` — AC 11 requires tests for `--runbook` override and unknown runbook fallthrough. These code paths in `planTasks()` (run.mjs:426-434) have zero test coverage. Code is correct by inspection but the spec explicitly demands these tests.
🟡 [product] `SPEC.md:37-53` vs `bin/lib/runbooks.mjs:95-144` — Schema drift: spec says `pattern`/`keywords`/`threshold`, implementation uses `patterns` (typed array)/`minScore`/`{title, hint}` tasks. Better design but never ratified against spec.
🟡 [product] `SPEC.md:59` vs `bin/lib/runbooks.mjs:176` — Spec says `matchRunbook(description, runbooksDir)`, implementation takes `matchRunbook(description, runbooks[])`. Cleaner separation of concerns but spec is now stale.
🟡 [tester] `bin/lib/runbooks.mjs:161` — `scoreRunbook` crashes on null/undefined description (TypeError confirmed via `node -e`)
🟡 [tester] `bin/lib/runbooks.mjs:155` — ReDoS confirmed: pathological regex took **2460ms** to evaluate
🟡 [tester] `test/runbooks.test.mjs` — No integration test for `planTasks()` → runbook code path (highest-risk untested seam)
🟡 [tester] `test/runbooks.test.mjs:82` — Only 1 of 5 `loadRunbooks` validation branches has automated coverage
🟡 [tester] `test/runbooks.test.mjs` — No test for `--runbook nonexistent` fallthrough (spec AC #8)
🟡 [security] `bin/lib/runbooks.mjs:155` — ReDoS via YAML-defined regex patterns; `new RegExp(p.value, "i")` has no complexity/timeout bound. Low risk: runbooks are repo-authored, not user-input. Backlog before CI/untrusted usage.
🟡 [security] `bin/lib/runbooks.mjs:161` — `scoreRunbook` crashes on null/undefined description (`description.toLowerCase()` TypeError). Now reachable from `planTasks()` — add defensive guard.
🟡 [security] `bin/lib/runbooks.mjs:118-129` — No per-pattern or per-task field validation at load time. Missing `type`/`value` silently scores 0; missing `title`/`include` produces `{title: undefined}`.
🟡 [simplicity] `bin/lib/runbooks.mjs:137` — `flow` field loaded but never consumed downstream; dies as local variable in `planTasks`
🟡 [simplicity] `bin/lib/run.mjs:447` — `hint` propagated through 3 functions to a dead end; `buildTaskBrief` ignores it
🟡 [simplicity] `bin/lib/runbooks.mjs:195-205` — `include` resolution has 0 current users among built-in runbooks
🟡 [simplicity] `bin/lib/runbooks.mjs:12-77` — Custom YAML parser (66 lines) is the largest complexity center; well-documented but will become a bottleneck if schema grows
🔵 [architect] bin/lib/runbooks.mjs:84 — `castValue` doesn't handle scientific notation. Acceptable for current schema.
🔵 [architect] bin/lib/run.mjs:420 — `process.cwd()` default for `runbooksDir`. Mitigated by `opts.runbooksDir`.
🔵 [architect] SPEC.md — Schema diverged from spec. Implementation is better. Update spec.
🔵 [engineer] `bin/lib/runbooks.mjs:160` — Keyword matching doesn't enforce word boundaries; `"test"` matches in `"testing"`
🔵 [engineer] `bin/lib/runbooks.mjs:25` — `parseYaml` silently skips unparseable lines (downstream validation catches missing fields)
🔵 [engineer] `tasks/task-1/handshake.json:7` — Summary claims 603 tests but artifact shows 546
🔵 [product] `SPEC.md:23` — AC 5 text ("narrows candidate set") conflicts with Technical Approach (additive scoring). AC should be revised.
🔵 [product] `.team/features/runbook-system/STATE.json` — 16/18 tasks blocked despite working code. Execution machinery issues (buffer overflow, approval-gate) polluted the state, not the runbook implementation.
🔵 [tester] `test/runbooks.test.mjs` — No tests for unknown pattern type, empty description, or file-read error path
🔵 [security] `bin/lib/runbooks.mjs:24` — `__proto__` allowed as YAML key by parser regex. Not exploitable (no global prototype pollution), but a defense-in-depth blocklist would be prudent.
🔵 [security] `bin/lib/runbooks.mjs:106` — No file size guard on `readFileSync`. Low risk for CLI tool.
🔵 [security] `bin/lib/runbooks.mjs:22` — Inline YAML comments not stripped; corrupts regex patterns. Usability issue, not security.
🔵 [simplicity] `bin/lib/run.mjs:420` — `process.cwd()` default inconsistent with `mainCwd` used elsewhere
🔵 [simplicity] `bin/lib/runbooks.mjs:181` — Tie-break by `id` vs SPEC's "filename" — equivalent in practice but imprecise

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**