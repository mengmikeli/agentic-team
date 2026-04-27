## Parallel Review Findings

🟡 [architect] `bin/lib/runbooks.mjs:229` — Substring keyword matching ("api" matches "capital") will produce false positives as runbook library grows. Backlog: add word-boundary pattern type.
🟡 [architect] `bin/lib/runbooks.mjs:12-78` — Custom YAML parser lacks edge-case tests (tabs, `\r\n`, quoted colons). Backlog: harden or replace if schema grows.
🟡 [architect] `bin/lib/runbooks.mjs:110` — ReDoS heuristic misses some patterns like `(a|a)+`. Defense-in-depth mitigates. Backlog: document limitation.
🟡 [engineer] `bin/lib/runbooks.mjs:222` — Keyword substring matching ("api" matches "capital") is intentional but will produce false positives as runbook library grows. Backlog: add `word_boundary` pattern type.
🟡 [engineer] `bin/lib/runbooks.mjs:105` — ReDoS heuristic misses variants like `(a|a)+`. Mitigated by short input strings. Backlog: consider regex-safe library or execution timeout.
🟡 [product] SPEC.md:22 — AC4 signature says `matchRunbook(description, runbooksDir)` but implementation is `(description, runbooks)`. Update spec to match code.
🟡 [product] SPEC.md:23 — AC5 says "regex narrows candidate set" but scoring algorithm is additive. Reword to match actual behavior.
🟡 [product] bin/lib/run.mjs:425 — `--runbook` with empty runbooks directory produces same "not found" warning as a genuinely missing ID. Add context to distinguish the two cases.
🟡 [tester] bin/lib/runbooks.mjs:224 — Keyword `p.value` not coerced to string; YAML `value: 123` would crash `scoreRunbook` with `TypeError`. Add `String(p.value)` coercion or type validation in `loadRunbooks`.
🟡 [tester] bin/lib/run.mjs:1014 — No test verifies `--flow` flag takes precedence over runbook `flow` field. If precedence chain accidentally reordered, user flags would be silently overridden. Add a test combining both flags.
🟡 [security] `bin/lib/runbooks.mjs:13` — YAML parser uses `{}` for parsed objects; `__proto__`/`constructor` keys pass the key regex. Use `Object.create(null)` to prevent prototype pollution. Not currently exploitable (downstream only accesses known fields), but a landmine for future changes.
🟡 [security] `bin/lib/runbooks.mjs:105` — `isSafeRegex()` heuristic misses ReDoS via alternation patterns (e.g. `(a|a)+`). Defense-in-depth mitigates risk (checked at both load and score time), and threat model requires repo write access. Consider a regex complexity library or execution timeout.
🔵 [architect] `bin/lib/run.mjs:420` — `process.cwd()` fallback for `runbooksDir` only exercised in production.
🔵 [architect] `bin/lib/runbooks.mjs:271` — Linear `find()` for include resolution fine at 4 runbooks, would need a map at 100+.
🔵 [architect] `bin/lib/run.mjs:428` — `Infinity` as forced-runbook score is clear but unconventional for serialization.
🔵 [engineer] `bin/lib/runbooks.mjs:12-78` — Custom YAML parser lacks edge-case coverage for tabs, `\r\n`, multi-line values in user-authored runbooks.
🔵 [engineer] `bin/lib/run.mjs:428` — `score: Infinity` for forced runbook is harmless but a named constant would be clearer.
🔵 [engineer] `bin/lib/runbooks.mjs:271` — Linear `find()` for include resolution is fine at current scale; Map lookup at 50+ runbooks.
🔵 [product] .team/runbooks/ — No user-facing authoring guide for custom runbooks. Substring matching, minScore tuning, and include semantics only documented in source comments.
🔵 [product] tasks/task-13/artifacts/, tasks/task-14/artifacts/ — No test-output.txt artifacts persisted for final build tasks despite handshake claims. Process gap.
🔵 [tester] test/runbooks.test.mjs — No test for `matchRunbook(null, [...])` or `matchRunbook("", [...])` directly.
🔵 [tester] test/runbooks.test.mjs — No test for `planTasks(null, null, {})` — produces a task with `title: null`.
🔵 [tester] test/runbooks.test.mjs — No test for mutual circular includes (A→B→A); behavior is correct but undocumented.
🔵 [security] `bin/lib/runbooks.mjs:218` — Cap `description.length` before regex matching to bound worst-case execution time.
🔵 [security] `bin/lib/runbooks.mjs:24` — Alternatively, reject `__proto__`/`constructor`/`prototype` in the key regex.
🔵 [simplicity] `bin/lib/runbooks.mjs:207` — `scoreRunbook` exported solely for test access; consider `@visibleForTesting` annotation
🔵 [simplicity] `.team/runbooks/shared-setup.yml:4-7` — Dummy patterns array for include-only runbook is the simpler alternative to adding a new schema type; worth a comment
🔵 [simplicity] `test/runbook-dir.test.mjs:26-42` — Source-code regex matching is fragile but pragmatic

---

## Simplicity Review

**Reviewer:** Simplicity Advocate (veto authority)
**Verdict:** PASS
**Date:** 2026-04-27

### Files Actually Read

| File | Lines | Purpose |
|---|---|---|
| `bin/lib/runbooks.mjs` | 293 | Core module: YAML parser, scoring, matching, resolution |
| `bin/lib/run.mjs` | 1636 | Modified: `planTasks()` integration, CLI flag extraction |
| `bin/agt.mjs` | 896 | Modified: help text, `--runbook` flag docs |
| `test/runbooks.test.mjs` | 1028 | New: comprehensive test suite |
| `test/cli-commands.test.mjs` | 582 | Modified: `--runbook` CLI tests |
| `.team/runbooks/*.yml` | 102 | 4 built-in runbook files |
| `bin/lib/flows.mjs` | (grep) | Verified `build-verify` exists in `FLOWS` |

### Veto Category Audit

#### 1. Dead Code — CLEAR

Every function, variable, and import in `runbooks.mjs` is consumed:

- `parseYaml()` → called at line 133 (`loadRunbooks`)
- `stripInlineComment()` → called at line 93 (`castValue`)
- `castValue()` → called at lines 55, 63, 69, 76 (`parseYaml`)
- `isSafeRegex()` → called at lines 167 and 221 (load-time + score-time)
- `tieBreakKey()` → called twice at line 251 (`matchRunbook`)
- All 3 imported functions in `run.mjs:26` are consumed in `planTasks()`
- `scoreRunbook` — exported, consumed internally by `matchRunbook()` and directly by test suite

Data fields traced end-to-end:
- `_filename` → `tieBreakKey()` (line 260)
- `hint` → `resolveRunbookTasks()` → `planTasks()` → `buildTaskBrief()` (run.mjs:515)
- `flow` → `runbookFlow` → flow selection (run.mjs:1018), consumed by `FLOWS["build-verify"]`

No commented-out code, no unreachable branches.

#### 2. Premature Abstraction — CLEAR

- Custom YAML parser (lines 15-103): 1 call site, but the alternative is an external dependency. Lines 10-13 document migration path. Dependency-avoidance decision, not premature abstraction.
- `tieBreakKey()` (lines 258-261): 2 call sites on line 251. Extracting it names the policy. Passes.
- `stripInlineComment()` (lines 83-90): 1 call site inside parser internals. Naming a concept, not prematurely abstracting.

#### 3. Unnecessary Indirection — CLEAR

The pipeline `planTasks()` → `loadRunbooks()` → `matchRunbook()` → `resolveRunbookTasks()` is direct. Each function performs meaningful work. No passthrough wrappers or re-exports.

#### 4. Gold-plating — CLEAR

- `flow` field: Consumed end-to-end. `add-cli-command.yml` sets `flow: build-verify`, used at run.mjs:1018. Not gold-plating.
- `hint` field: Consumed in agent briefs (run.mjs:515). All 4 built-in runbooks use hints. Not gold-plating.
- `include` mechanism: 1 current consumer (`add-cli-command → shared-setup`). Explicitly spec'd. 25 lines of code. Borderline, but spec'd features aren't gold-plating. Flagged 🟡 below.
- ReDoS guard: 6 lines, 2 call sites. Proportional safety for user-authored regexes. Not gold-plating.

### Simplicity Findings

🟡 `bin/lib/runbooks.mjs:267` — `include` mechanism has 1 consumer across all shipped runbooks (`add-cli-command.yml` → `shared-setup`). The 25 lines of include-resolution code + a separate `shared-setup.yml` could be replaced by duplicating 2 tasks inline. Explicitly spec'd so not a veto. Track: if no additional include users appear, consider removing the indirection.

🟡 `bin/lib/runbooks.mjs:113` — `isSafeRegex` heuristic rejects ALL `(group|alternation)+` patterns, including benign ones like `(foo|bar)+`. Over-broad check that may block legitimate runbook patterns as the library grows.

🔵 `bin/lib/runbooks.mjs:199` — `_filename` is internal metadata exposed on the public return shape. Underscore convention signals "private" but consumers of `loadRunbooks()` see it. Could use a WeakMap.

🔵 `bin/lib/run.mjs:428` — `score: Infinity` sentinel for forced runbooks. A named constant (`FORCED_SCORE`) would be marginally clearer.

🔵 `bin/lib/run.mjs:846` — `mkdirSync(join(teamDir, "runbooks"), { recursive: true })` runs on every `agt run` invocation. Could be hoisted into `cmdInit`.

### Cognitive Load Assessment

The implementation has **low cognitive load**:

1. `runbooks.mjs` is a self-contained module with zero external dependencies. Four exported functions map directly to the data pipeline: load → score → match → resolve.
2. `planTasks()` integration adds a ~35-line block (run.mjs:419-458) with clear fallthrough semantics: runbook → spec → single-task.
3. CLI integration is minimal: one `getFlag()` call, one help entry, one example.
4. Test suite (1028 lines) is proportional — ~3:1 test-to-implementation ratio is appropriate for a scoring/matching module.

### Edge Cases Checked

| Edge case | Handling | Tested? |
|---|---|---|
| Null/undefined description | Returns score 0 | Yes |
| Empty/nonexistent runbooks dir | Returns `[]` | Yes |
| Forced nonexistent runbook | Warns + falls through | Yes |
| Self-include | Warns + skips | Yes |
| Nested include | Warns + skips | Yes |
| All patterns invalid | Skips runbook | Yes |
| All tasks invalid | Skips runbook | Yes |
| Duplicate IDs | Second skipped | Yes |
| Unsafe regex | Dropped at load + score time | Yes |
| Zero resolved tasks | Falls through | Yes |
| Tie-breaking | Alphabetical by filename | Yes |

### Verdict: PASS

The implementation is focused, correctly layered, and well-tested. No dead code, no premature abstractions, no unnecessary indirection. The `include` mechanism is the only borderline gold-plating concern, but it was explicitly spec'd and implemented minimally (25 lines). The custom YAML parser is a reasonable zero-dependency trade-off with a documented migration path. Cognitive load is low. Diff is proportional to feature scope.

## Compound Gate

**Verdict:** PASS
**Layers tripped:** 0/5
**All layers passed**
