# Product Manager Review — runbook-system

**Verdict: PASS**

**Reviewer:** Product Manager
**Date:** 2026-04-27
**Task reviewed:** task-12 — Full test suite (`npm test`) passes with no regressions.

---

## Files Actually Read

| File | Lines Read |
|---|---|
| `.team/features/runbook-system/SPEC.md` | 1-125 (complete) |
| `bin/lib/runbooks.mjs` | 1-289 (complete) |
| `bin/lib/run.mjs` | line 26 (import), 415-478 (planTasks), 829-834 (CLI flag parsing), 1009-1014 (feature wiring) |
| `.team/runbooks/add-cli-command.yml` | 1-31 (complete) |
| `.team/runbooks/add-github-integration.yml` | 1-29 (complete) |
| `.team/runbooks/add-test-suite.yml` | 1-29 (complete) |
| `.team/runbooks/shared-setup.yml` | 1-13 (complete) |
| `test/runbooks.test.mjs` | all `it()` declarations counted (67 test cases) |
| `test/runbook-dir.test.mjs` | all `it()` declarations counted (4 test cases) |
| `test/cli-commands.test.mjs` | lines 266-299 (--runbook CLI test), 324-331 (--runbook help test) |
| `tasks/task-12/handshake.json` | 1-20 (complete) |
| `tasks/task-12/artifacts/test-output.txt` | 1-955 (complete) |
| `tasks/task-pm-review/handshake.json` | 1-20 (complete) |

## Independent Verification

Test suite executed independently: `npm test` — **649 tests, 647 pass, 0 fail, 2 skipped.** Exit code 0.

The 2 skipped tests are pre-existing disabled tests in `test/synthesize-compound.test.mjs` (fabricated-refs feature), unrelated to the runbook system.

---

## Acceptance Criteria Verification

| # | Criterion | Status | Evidence |
|---|---|---|---|
| AC1 | `bin/lib/runbooks.mjs` exists with 4 exports | **PASS** | `export function` at lines 116 (`loadRunbooks`), 207 (`scoreRunbook`), 242 (`matchRunbook`), 263 (`resolveRunbookTasks`). Import at `run.mjs:26`. |
| AC2 | `loadRunbooks(dir)` reads `.yml` files, validates schema, returns array | **PASS** | Lines 116-202. Validates id, name, patterns (non-empty), minScore (number), tasks (non-empty), flow (optional). Per-element validation drops bad patterns/tasks. Duplicate ID guard. 8 unit tests. |
| AC3 | `scoreRunbook(description, runbook)` returns numeric score with correct algorithm | **PASS** | Lines 207-237. Regex match adds weight; keyword counts non-overlapping occurrences × weight. Case-insensitive. 11 unit tests including null/undefined/empty description edge cases. |
| AC4 | `matchRunbook(description, runbooks)` returns `{ runbook, score }` for best match or null | **PASS** | Lines 242-252. Highest score wins. Ties broken by `_filename` alphabetically (tieBreakKey at line 256). 8 unit tests including boundary test at exact minScore. |
| AC5 | `resolveRunbookTasks(runbook, allRunbooks)` expands `include:` one level deep | **PASS** | Lines 263-288. Guards: self-include skip (line 267), missing include skip (line 268), nested include skip with warning (line 272). 7 unit tests. |
| AC6 | `planTasks()` integrates runbook matching before brainstorm fallback | **PASS** | `run.mjs:418-478`. Loads from dir, matches, resolves, maps to `{ id, title, hint, status, attempts }`. Falls through to spec-parse then single-task if no match. 12 unit tests. |
| AC7 | `agt run --runbook add-cli-command` forces runbook by id | **PASS** | Flag parsed at `run.mjs:834` via `getFlag(args, "runbook")`. Forced lookup at `run.mjs:427` sets score to `Infinity` to bypass minScore. CLI test at `cli-commands.test.mjs:266`. |
| AC8 | `agt run --runbook nonexistent` warns + falls through | **PASS** | Warning at `run.mjs:434-435`. Falls through to spec parsing. Unit test at `runbooks.test.mjs:790`. |
| AC9 | Console output names matched runbook + score | **PASS** | `run.mjs:440`: `[runbook] matched: ${name} (score ${n})`. Forced variant at line 438 (no score). Test output at task-12 artifact lines 693-697 confirms both formats. |
| AC10 | 3 built-in runbooks, valid schema, ≥4 tasks each | **PASS** | `add-cli-command.yml`: 5 entries (1 include + 4 tasks, resolves to 6 via shared-setup). `add-github-integration.yml`: 4 tasks. `add-test-suite.yml`: 4 tasks. Test at `runbooks.test.mjs:965` verifies ≥3 load and `runbooks.test.mjs:970` verifies ≥4 resolved tasks each. |
| AC11 | Unit tests ≥10 cases covering scoring, matching, loading, includes, CLI override | **PASS** | 67 test cases in `runbooks.test.mjs` + 4 in `runbook-dir.test.mjs` + 2 in `cli-commands.test.mjs` = 73 total runbook-related tests. Covers: scoring (regex, keyword, combined, below threshold, null input), matching (best-of-many, tie-break, no-match, exact boundary), loading (valid, invalid, empty, duplicate IDs, .yaml extension), includes (inline, missing, nested, self-ref), CLI override (forced, nonexistent, log output), ReDoS guard, per-element validation, duplicate IDs, built-in runbook validation. |
| AC12 | Full test suite passes with no regressions | **PASS** | **Independently verified: 649 tests, 647 pass, 0 fail, 2 skipped.** Exit 0. |

---

## Scope Discipline

**Within spec:** All 12 acceptance criteria are met with direct evidence. No SPEC exclusions were violated — no recursive includes, no validation CLI, no remote registry, no brainstorm merging, no extension hooks.

**Minor scope addition:** `shared-setup.yml` is a 4th runbook file not listed in the SPEC's "3 built-in runbooks." It serves as an include target for `add-cli-command.yml` and uses `minScore: 100` to prevent accidental direct matching. This is a justified addition that exercises the `include:` feature with a real built-in example. Does not block merge, but the SPEC should be updated to document it.

**No behavior change for unmatched features:** Confirmed — when no runbook matches, `planTasks` falls through to spec-parse (line 457) then single-task fallback (line 471), preserving the existing brainstorm/checkbox-parse path.

---

## Edge Cases Checked

| Edge case | Status | Evidence |
|---|---|---|
| Empty/nonexistent runbooks directory | OK | `loadRunbooks` returns `[]`, falls through to spec parsing |
| Malformed YAML | OK | `parseYaml` catches errors, `loadRunbooks` skips with warning |
| ReDoS patterns in regex | OK | `isSafeRegex` guard at load time + defense-in-depth in `scoreRunbook` |
| Duplicate runbook IDs | OK | Second file with same ID skipped with warning |
| `--runbook` with no value | Not explicitly tested | `getFlag` would return empty string or undefined; forced lookup would find nothing; warning logged; falls through. Safe behavior, but no explicit test. |
| Runbook with invalid `flow` value | OK | `run.mjs:1014` — invalid flow results in `FLOWS[runbookFlow]` = undefined, falls through to `selectFlow()` auto-detection |

---

## Findings

🟡 `.team/runbooks/shared-setup.yml` — 4th runbook file not in SPEC's "3 built-in runbooks" list. Justified addition for `include:` support, but SPEC.md should be updated to acknowledge it. Backlog as spec maintenance.

🟡 `SPEC.md:62` — SPEC defines `resolveRunbookTasks(rb, all) → Task[]` without specifying the `Task` shape (`{ title, hint? }`). The implementation is correct per the example at SPEC lines 48-52, but the return type contract should be made explicit. Backlog as spec clarity improvement.

🟡 `tasks/task-pm-review/handshake.json:7` — Prior PM review handshake summary says "628/0/2" but that review's own eval.md body says "635 pass". Neither matches the actual task-12 artifact which shows 649 pass. The prior review referenced task-5's artifact rather than the latest gate. Internal inconsistency in prior review metadata; does not affect code correctness.

🔵 `bin/lib/runbooks.mjs:221` — Keyword matching uses substring search (e.g., keyword "api" matches inside "capital"). This is documented in a code comment (line 221-223) and is intentional per a dedicated test ("keyword matches as substring inside longer words"). Consider adding a `type: keyword-word` variant in a future iteration if precision matters for specific runbooks.

🔵 `test/runbooks.test.mjs:324,359` — Two separate tests ("does not recurse into nested includes" and "skips self-referential include") build similar fixture structures. Both pass and cover distinct edge cases, but the nested-include test doesn't assert the warning message. Minor test quality improvement opportunity.

---

## Summary

The runbook-system feature delivers exactly what the SPEC defined: a YAML-based task recipe system that auto-matches feature descriptions, supports forced selection via `--runbook`, handles `include:` references one level deep, and integrates cleanly into `planTasks()` without affecting the existing brainstorm fallback path.

**Key evidence:**
- 4 module exports match spec (AC1-AC5)
- `planTasks()` integration works end-to-end (AC6)
- `--runbook` flag parsed and wired through (AC7-AC8)
- Console output includes matched name and score (AC9)
- 3 built-in runbooks + 1 utility runbook, all with valid schema and ≥4 resolved tasks (AC10)
- 73 runbook-related tests far exceed the ≥10 requirement (AC11)
- Full suite independently verified: **649 tests, 647 pass, 0 fail, 2 skipped** (AC12)

Three yellow findings go to backlog (spec documentation, return type clarity, prior review metadata inconsistency). None block merge. Two blue suggestions for future improvement.

**PASS — ready for merge.**
