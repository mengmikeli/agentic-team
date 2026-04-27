# Simplicity Review — runbook-system (resolveRunbookTasks focus)

**Verdict: PASS**

**Reviewer:** Simplicity Advocate
**Date:** 2026-04-27
**Scope:** `resolveRunbookTasks` implementation + full `bin/lib/runbooks.mjs` module

---

## Files Actually Read

| File | Lines Read |
|---|---|
| `bin/lib/runbooks.mjs` | 1–284 (complete) |
| `bin/lib/run.mjs` | 1–30 (imports), 410–475 (planTasks), 1006–1011 (runbookFlow usage) |
| `test/runbooks.test.mjs` | 1–820 (complete) |
| `.team/runbooks/shared-setup.yml` | 1–13 (complete) |
| `.team/runbooks/add-cli-command.yml` | 1–31 (complete) |
| `.team/runbooks/add-test-suite.yml` | 1–29 (complete) |
| `.team/runbooks/add-github-integration.yml` | 1–29 (complete) |
| `.team/features/runbook-system/SPEC.md` | 1–125 (complete) |
| `.team/features/runbook-system/tasks/task-5/handshake.json` | 1–20 (complete) |
| `.team/features/runbook-system/tasks/task-5/artifacts/test-output.txt` | 1–60 |
| `.team/features/runbook-system/tasks/task-pm-review/eval.md` | 1–119 (complete) |
| `.team/features/runbook-system/tasks/task-5/eval.md` | 1–31 (compound gate) |

---

## Veto Category Assessment

### 1. Dead Code — CLEAR

| Check | Result |
|---|---|
| Unused exports | None. All 4 exports (`loadRunbooks`, `scoreRunbook`, `matchRunbook`, `resolveRunbookTasks`) have call sites in production code (`run.mjs:26,421,429,443`) or are spec-required public API with extensive test usage (15+ `scoreRunbook` invocations in tests). |
| Unused private helpers | None. `parseYaml` called at line 129, `castValue` called at lines 52/60/66/73, `stripInlineComment` called at line 90, `isSafeRegex` called at lines 163/217. |
| Unreachable branches | None. Every `if`/`else` branch is exercised by tests. |
| Commented-out code | None in any file read. |
| Unused imports | None. `readdirSync`, `readFileSync`, `join` all used. |

### 2. Premature Abstraction — CLEAR

| Check | Result |
|---|---|
| `scoreRunbook` — 1 internal call site | Exported per spec requirement. Used by `matchRunbook` at line 245. 15+ direct test invocations. Extracting scoring into a pure function enables independent unit testing of the scoring algorithm — a legitimate design choice, not premature. |
| YAML parser as separate function | Private, single call site (line 129). But it's 67 lines of parsing logic that would make `loadRunbooks` unreadable if inlined. Extraction justified by cognitive load, not reuse. |
| `isSafeRegex` — 2 call sites | Lines 163 and 217. Two call sites. Not premature. |

### 3. Unnecessary Indirection — CLEAR

| Check | Result |
|---|---|
| Wrapper functions | None. Every function transforms its input. |
| Re-exports | `run.mjs:26` imports 3 of 4 exports — legitimate integration, not re-export. |
| Delegate-only functions | None. `matchRunbook` calls `scoreRunbook` but adds selection logic (best-match, threshold, tie-breaking). |

### 4. Gold-Plating — CLEAR

| Check | Result |
|---|---|
| `flow` field | Used at `run.mjs:1011` for flow selection. Set by `add-cli-command.yml` (`build-verify`). Not speculative — actively consumed. |
| `_filename` field | Used for tie-breaking at line 247. Tested at `runbooks.test.mjs:230-242`. Earns its keep. |
| `hint` field | Used in `shared-setup.yml`, `add-cli-command.yml`, and integration tests. Consumed by task briefs via `planTasks`. Not speculative. |
| Defensive `isSafeRegex` in `scoreRunbook` | 1-line check at line 217. Comment at lines 215-216 explains: `scoreRunbook()` is a public export callable with unfiltered data. Defense-in-depth for security is not gold-plating. |
| `stripInlineComment` | Required for correct YAML parsing — inline comments are standard YAML. |

---

## Complexity Budget

| Component | Lines | Justification |
|---|---|---|
| YAML parser (`parseYaml` + `castValue` + `stripInlineComment`) | 88 | Zero-dependency project constraint. Parser scoped to flat runbook schema only. Alternative (adding `js-yaml`) contradicts project's design philosophy. |
| `loadRunbooks` | 86 | Reads, parses, validates 6 fields + per-element validation. Each validation step earns its line — bad input produces a specific warning message. |
| `scoreRunbook` | 30 | Two pattern types (regex + keyword), weight handling, ReDoS guard. Minimal. |
| `matchRunbook` | 10 | Selection loop with threshold + tie-breaking. |
| `resolveRunbookTasks` | 25 | Include expansion with 3 guards (self, missing, nested). Clean loop. |
| **Total module** | **284** | For 4 exported functions + YAML parsing + ReDoS safety. Lean. |

---

## Edge Cases Checked

| Edge Case | Handled | Evidence |
|---|---|---|
| Self-include | Yes — line 262-264, warns + skips | Test line 345 |
| Missing include ref | Yes — line 267-268, warns + skips | Test line 312 |
| Nested include (depth > 1) | Yes — line 271-272, warns + skips | Test line 324 |
| Empty tasks array | Yes — loop doesn't execute | Test line 406 |
| Interspersed includes + tasks | Yes — ordering preserved | Test line 357 |
| null/undefined description | Yes — line 208 early return | Tests lines 183-195 |
| Invalid regex | Yes — try/catch at line 219 | Test line 172 |
| Unsafe regex (ReDoS) | Yes — filtered at load + score time | Tests lines 416-461 |
| Duplicate runbook IDs | Yes — `seenIds` set at line 136 | Test line 560 |

---

## Corrections to Prior Reviews

The prior PM review (`task-pm-review/eval.md:100`) and compound gate (`task-5/eval.md:11`) both state:
> "No built-in runbook uses `include:`"

**This is incorrect.** `add-cli-command.yml:22` has `- include: shared-setup`, and `shared-setup.yml` exists with 2 tasks. The `include:` feature IS exercised by a shipped built-in runbook.

Similarly, the compound gate's architect and engineer findings (task-5/eval.md:13,17) flag self-include as unguarded — but the guard exists at `runbooks.mjs:262-264` with a test at `runbooks.test.mjs:345-355`. These findings were stale from a pre-fix iteration.

---

## Findings

🟡 `bin/lib/runbooks.mjs:131-155` — `loadRunbooks` validation requires `patterns` and `minScore` on all runbooks, including include-only ones like `shared-setup.yml`. This forces include-only runbooks to carry a placeholder pattern (`shared-setup-internal`, minScore 100) they'll never match. Consider allowing runbooks with `minScore: Infinity` or an `includeOnly: true` flag to skip pattern requirements. Minor schema design smell — does not block merge.

🔵 `bin/lib/runbooks.mjs:247` — Tie-breaking condition is a dense single-line compound boolean. An inline comment explaining the `_filename` fallback to `id` would reduce reader cognitive load.

🔵 `bin/lib/runbooks.mjs:274,279` — Hint spread pattern `{ title: t.title, ...(t.hint ? { hint: t.hint } : {}) }` appears twice. Not worth extracting for 2 uses, but watch for a third.

---

## Summary

The implementation is **lean and well-scoped**. 284 lines for 4 exported functions, a bespoke YAML parser, and ReDoS safety. No dead code, no premature abstractions, no unnecessary indirection, no gold-plating. Every function does real work. The bespoke YAML parser earns its 88 lines by maintaining the project's zero-dependency constraint.

`resolveRunbookTasks` itself is 25 lines with 3 safety guards (self-include, missing ref, nested include), all tested. The include feature is exercised by a shipped built-in (`add-cli-command.yml` includes `shared-setup`).

One 🟡 for backlog (include-only runbook schema smell). Two 🔵 suggestions for readability. Zero veto-category violations.

**PASS — no simplicity blocks.**
