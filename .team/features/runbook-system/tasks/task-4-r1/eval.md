# Simplicity Review — runbook-system

**Verdict: PASS**

**Reviewer:** Simplicity advocate
**Scope:** `matchRunbook(description, runbooks)` returns `{ runbook, score }` for the best match above threshold, or `null`.

## Files Actually Read

| File | Lines |
|---|---|
| `bin/lib/runbooks.mjs` | 1–278 (complete) |
| `test/runbooks.test.mjs` | 1–642 (complete) |
| `test/runbook-dir.test.mjs` | 1–105 (complete) |
| `.team/runbooks/add-cli-command.yml` | 1–29 (complete) |
| `.team/runbooks/add-github-integration.yml` | 1–29 (complete) |
| `.team/runbooks/add-test-suite.yml` | 1–29 (complete) |
| `.team/features/runbook-system/SPEC.md` | 1–125 (complete) |
| `bin/lib/run.mjs` | lines 23–29, 417–475, 828–839, 1003–1014 (grep) |
| `bin/lib/init.mjs` | line 45 (grep) |
| `.team/features/runbook-system/tasks/task-4/eval.md` | 1–25 (complete, prior review) |

## Veto Category Audit

### 1. Dead Code — CLEAN

- All 4 exports consumed: `loadRunbooks` (run.mjs:26), `scoreRunbook` (internally by `matchRunbook` at line 245 + spec-mandated public API), `matchRunbook` (run.mjs:429), `resolveRunbookTasks` (run.mjs:443).
- All private functions called: `parseYaml` (line 129), `castValue` (lines 52, 60, 66, 73), `stripInlineComment` (line 90), `isSafeRegex` (lines 163, 217).
- No commented-out code, no unreachable branches.
- fs imports (`readdirSync`, `readFileSync`) and `join` from `path` all used in `loadRunbooks`.

### 2. Premature Abstraction — CLEAN

- Prior review (task-4/eval.md) raised 🔴 on `selectRunbook` having 1 call site. **Verified fixed**: `selectRunbook` no longer exists; its logic is correctly inlined into `planTasks()` (run.mjs:420–443).
- `isSafeRegex`: 2 call sites (lines 163, 217). Justified — the comment at line 216 explains the defense-in-depth rationale.
- `parseYaml`: 1 call site but 66 lines of complex logic. Extracting it is standard practice, not premature abstraction.
- `castValue`: 4 call sites within `parseYaml`. Justified.
- `stripInlineComment`: 1 call site (private helper). Borderline, but 7 lines of distinct logic. See 🔵 below.

### 3. Unnecessary Indirection — CLEAN

No delegation-only wrappers found. Every function transforms its input.

### 4. Gold-Plating — CLEAN

- `flow` field: Plumbed but 0/3 shipped runbooks use it. However, it is a **stated requirement** in SPEC.md (lines 1, 33, 53, 84). Implementation cost is minimal (1 read + 1 return + 1 consume). Does not meet the veto criterion "no stated requirement."
- `include` resolution: Implemented but 0/3 shipped runbooks use it. Also a **stated requirement** in SPEC.md (line 13, AC #5). Does not meet the veto criterion.
- Both flagged as 🟡 below since they add untested-in-production surface area.

## Findings

🟡 `bin/lib/runbooks.mjs:12-78` — Custom YAML parser (66 lines) is self-contained and correct for the flat runbook schema, but becomes a maintenance liability if the schema grows (nested objects, multi-line strings, anchors). The "NOT a general-purpose YAML parser" comment is honest but doesn't prevent scope creep. Consider adding a comment listing the exact schema subset supported and when to switch to a real parser.

🟡 `bin/lib/runbooks.mjs:247` — Tie-breaking condition is a dense 120-char expression: `(score === best.score && (rb._filename || rb.id) < (best.runbook._filename || best.runbook.id))`. Hard to scan visually. An extracted `tiebreakKey` variable would cost 1 line and improve readability.

🟡 `bin/lib/runbooks.mjs:194` — `flow` field is plumbed through 5 code points (runbooks.mjs:194, run.mjs:451, run.mjs:464, run.mjs:474, run.mjs:1011) but 0/3 built-in runbooks set it. Exercised only by a test fixture. If no runbook uses it by the time a second feature ships, delete it.

🟡 `bin/lib/runbooks.mjs:258-276` — `include` resolution (19 lines + 20 test lines) is implemented and tested but 0/3 built-in runbooks use it. Same tracking recommendation as `flow`.

🔵 `bin/lib/runbooks.mjs:80` — `stripInlineComment` has 1 call site; could be inlined into `castValue` for locality. Low priority.

🔵 `bin/lib/runbooks.mjs:196` — `_filename` exposes internal sort metadata in the public runbook shape. Not harmful today, but future consumers may accidentally depend on it.

## Edge Cases Checked

| Edge Case | Verified |
|---|---|
| `matchRunbook(null, runbooks)` | Yes — returns `null` via `scoreRunbook`'s guard at line 208 |
| `matchRunbook("x", [])` | Yes — returns `null` (empty loop, `best` stays null) |
| Tie-break: equal scores | Yes — tested at test:228-241, uses `_filename` then `id` fallback |
| Below-threshold runbooks | Yes — filtered by `score < rb.minScore` at line 246 |
| Invalid regex in pattern | Yes — caught by try/catch at line 219 |
| ReDoS regex in pattern | Yes — filtered by `isSafeRegex` at line 217 |

## Cognitive Load Assessment

The module is 278 lines with 4 public functions and 4 private helpers. Each public function has a single clear responsibility. The YAML parser is the densest section but is isolated behind `parseYaml()` and never leaks into the scoring/matching logic. Overall cognitive load is **low** — you can understand `matchRunbook` without reading the parser, and vice versa.

## Summary

| Category | Result |
|---|---|
| Dead code | CLEAN |
| Premature abstraction | CLEAN (prior 🔴 fixed) |
| Unnecessary indirection | CLEAN |
| Gold-plating | CLEAN (spec-mandated) |
| Overall | **PASS** (0 critical, 4 warning, 2 suggestion) |
