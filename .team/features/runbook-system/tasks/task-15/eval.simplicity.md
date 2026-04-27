# Simplicity Review — runbook-system (task-15)

**Reviewer**: Simplicity Advocate
**Verdict**: **PASS**
**Date**: 2026-04-27

---

## Files Actually Read

| File | Lines | Method |
|---|---|---|
| `bin/lib/runbooks.mjs` | 303 (new) | git diff main...feature/runbook-system |
| `bin/lib/run.mjs` | 1594 (full) + diff | Read tool + git diff |
| `bin/agt.mjs` | 898 (full) + diff | Read tool + git diff |
| `bin/lib/util.mjs` | Lines 35-38 | Grep (getFlag) |
| `.team/runbooks/*.yml` | 4 files (98 lines) | git diff |
| `test/runbooks.test.mjs` | 1093 (new) | git diff |
| `test/cli-commands.test.mjs` | diff (96 added) | git diff |
| `tasks/task-15/handshake.json` | 20 | Read tool |
| `tasks/task-15/artifacts/test-output.txt` | 966 | Read tool |

## Veto Category Assessment

### 1. Dead Code — NO VIOLATIONS

Every function, import, and variable in `runbooks.mjs` is reachable and used:
- `parseYaml` → called by `loadRunbooks`
- `castValue` → called by `parseYaml`
- `stripInlineComment` → called by `castValue`
- `isSafeRegex` → called by `loadRunbooks` (line 176) and `scoreRunbook` (line 225)
- `tieBreakKey` → called by `matchRunbook`
- All 4 exports (`loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks`) → imported by `run.mjs` and `test/runbooks.test.mjs`
- `hint: null` added to non-runbook task objects → consumed by `buildTaskBrief` (line 512)

No commented-out code. No unreachable branches.

### 2. Premature Abstraction — NO VIOLATIONS

| Abstraction | Call sites in PR | Justified? |
|---|---|---|
| `loadRunbooks(dir)` | `planTasks` + tests | Yes — reusable unit |
| `scoreRunbook(desc, rb)` | `matchRunbook` + tests | Yes — pure scoring, independently testable |
| `matchRunbook(desc, rbs)` | `planTasks` + tests | Yes — best-match selection |
| `resolveRunbookTasks(rb, all)` | `planTasks` + tests + contract tests | Yes — include resolution |
| `isSafeRegex(pattern)` | `loadRunbooks` + `scoreRunbook` | Yes — 2 call sites, defense-in-depth |
| `parseYaml(text)` | `loadRunbooks` only | Borderline (1 site) but 72 lines — extraction improves readability |

No interfaces with a single implementation. No abstract base classes.

### 3. Unnecessary Indirection — NO VIOLATIONS

No wrappers that merely delegate. Each function transforms its input:
- `planTasks` orchestrates: load → match → resolve → format
- `matchRunbook` iterates + filters by minScore + selects best
- `resolveRunbookTasks` walks tasks, inlines includes, skips self-refs

The import chain `run.mjs → runbooks.mjs` is a single hop with no re-exports.

### 4. Gold-Plating — NO VIOLATIONS

| Feature | Used in PR? | Speculative? |
|---|---|---|
| `flow` field on runbooks | Yes — `add-cli-command.yml` sets `flow: build-verify`, consumed at `run.mjs:1013` | No — directly wired |
| `weight` field on patterns | Yes — all 4 YAMLs use different weights | No |
| `hint` field on tasks | Yes — all 3 user-facing YAMLs use hints, rendered in `buildTaskBrief` | No |
| `include` mechanism | Yes — `add-cli-command.yml` includes `shared-setup` | 1 usage site but bounded (27 lines + one-level guard) |
| `opts.runbooksDir` on `planTasks` | Yes — main call site + all tests | Required for testability |
| `_filename` on runbook objects | Yes — tie-breaking in `matchRunbook` | Tiny, useful |

No config options with only one value. No feature flags with no planned variation.

## Findings

🟡 bin/lib/runbooks.mjs:18 — Custom YAML parser (72 lines) is the largest single-function complexity; if the runbook schema stays flat, consider JSON format to eliminate the parser entirely
🔵 bin/lib/runbooks.mjs:259 — `tieBreakKey` is a 1-call-site 1-line helper; could be inlined as `rb._filename || rb.id`
🔵 bin/lib/util.mjs:37 — `getFlag(args, "runbook")` returns `"--dry-run"` when `--runbook` precedes `--dry-run` with no value; degrades gracefully (warns + fallthrough) but could validate the value doesn't start with `--`

## Edge Cases Checked

| Edge case | Behavior | Verified by |
|---|---|---|
| Nonexistent runbook id via `--runbook` | Warns, falls through to default planning | test: "forced nonexistent runbook falls through to spec parsing" |
| Empty/falsy `--runbook` value | Auto-matching | test: "--runbook with falsy value (empty string)" |
| `--runbook` with no following arg | `getFlag` returns next arg, treated as unknown id, fallthrough | CLI test: "without a value falls through" |
| Self-referential include | Skipped with warning | test: "skips self-referential include" |
| Nested includes (depth > 1) | Skipped with warning (one level deep only) | test: "does not recurse into nested includes" |
| ReDoS regex patterns | Filtered at load time AND score time | tests: "ReDoS guard" suite (4 tests) |
| Prototype pollution via YAML keys | `DANGEROUS_KEYS` set blocks `__proto__`, `constructor`, `prototype` | tests: "prototype pollution guard" suite |
| Duplicate runbook IDs across files | Second file skipped with warning | test: "skips second runbook with duplicate id" |
| All resolved tasks empty (includes → nothing) | Falls through to default planning with warning | test: "falls through when matched runbook resolves to zero tasks" |

## Complexity Budget

| Metric | Value | Assessment |
|---|---|---|
| New production code | 303 lines (runbooks.mjs) + ~60 lines (run.mjs diff) | Modest |
| New test code | 1093 lines (runbooks.test.mjs) + 96 lines (cli-commands diff) | 3.3:1 test ratio — thorough |
| New files | 1 module + 4 YAMLs + 1 test | Appropriate |
| New exports | 4 functions + 1 re-export (planTasks) | Minimal |
| Cognitive load | Read runbooks.mjs top-to-bottom; changes to run.mjs are localized to `planTasks` and 2 call sites | Low |

## Test Evidence

All 656 tests pass (654 pass, 2 skipped, 0 fail) as verified in `task-15/artifacts/test-output.txt`. The runbook-specific tests include:

- **loadRunbooks**: 8 tests (empty dir, valid YAML, sorted loading, missing fields, non-YAML files, flow, .yaml extension)
- **scoreRunbook**: 11 tests (regex, keyword, combined, weights, edge cases)
- **matchRunbook**: 8 tests (best match, minScore threshold, tie-breaking, boundary)
- **resolveRunbookTasks**: 7 tests (flat, include, missing, nested, self-ref, ordering, empty)
- **ReDoS guard**: 4 tests
- **YAML comments**: 1 test
- **Validation**: 3 tests (pattern/task dropping, all-invalid)
- **Duplicate IDs**: 2 tests
- **Prototype pollution**: 2 tests
- **Keyword substring**: 3 tests
- **planTasks integration**: 19 tests (end-to-end, forced, fallthrough, logging, includes)
- **Built-in contract**: 3 tests (schema, task count, required fields)
- **CLI integration**: 4 tests (--runbook forced, nonexistent, no-value, help text)

## Verdict

**PASS** — The implementation is well-scoped and avoids the four veto-category anti-patterns. The custom YAML parser is the only notable complexity addition, and it's documented with an explicit migration path. The diff to `run.mjs` is surgical (2 changed call sites, 1 new import, 1 new flag parse). No dead code, no premature abstractions, no unnecessary wrappers, no speculative features.
