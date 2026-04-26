# Security Review — execution-report / task-3

**Reviewer:** Security Specialist
**Verdict:** PASS (with backlog items)

## Scope

Reviewed the Title column addition to the Task Summary table and the broader security posture of `bin/lib/report.mjs` and `test/report.test.mjs`. This covers commit `62d246c` and the cumulative branch diff (`main...HEAD`).

## Files Actually Read

- `bin/lib/report.mjs` (188 lines) — full implementation
- `test/report.test.mjs` (415 lines) — full test suite
- `bin/lib/util.mjs:190-198` — `readState` function
- `.team/features/execution-report/tasks/task-3/handshake.json` — builder claims
- `.team/features/execution-report/tasks/task-8/eval.md` — prior tester eval
- `git diff main...HEAD` — full branch diff for report.mjs + report.test.mjs

## Handshake Verification

| Claim | Verified |
|-------|----------|
| Title column in table header (report.mjs:52) | Yes — `\| Task \| Title \| Status \| Attempts \| Gate Verdict \|` |
| Row uses `task.title \|\| "—"` (report.mjs:57) | Yes — `${task.title \|\| "—"}` |
| Tests cover both present/absent title | Yes — test:53-61 (present), test:63-72 (absent) |
| Artifacts exist (report.mjs, report.test.mjs) | Yes — both exist and match claimed paths |

## Per-Criterion Security Results

### 1. Input Validation — Path Traversal

**PASS (with backlog warning)**

The path traversal guard at line 157 (`featureName !== basename(featureName)`) correctly rejects `../../etc` and similar multi-component paths. Test at line 409 covers this.

**However**, the guard is incomplete for `.` and `..`:
- `basename(".")` returns `"."` → guard passes
- `basename("..")` returns `".."` → guard passes
- With `..`, `join(cwd, ".team", "features", "..")` resolves to `<cwd>/.team/` — reading STATE.json from the `.team/` root instead of a feature subdirectory

Verified via Node.js:
```
> join("/project", ".team", "features", "..")
"/project/.team"
```

**Impact assessment:** Low. The traversal is contained within `.team/` — the attacker cannot escape the `.team` directory tree. The worst case is reading a STATE.json from `.team/` (if one exists), which would produce a confusing but non-dangerous report. The tool only reads, never writes to attacker-controlled paths (write goes to `join(featureDir, "REPORT.md")` which would be `.team/REPORT.md`). There is no command injection — the read data flows only into string formatting.

### 2. Input Validation — `--output` Flag

**PASS**

- Unsupported format → exit 1 (line 151-154, test:391)
- Missing value → exit 1 (line 151-154, test:400)
- Only `"md"` accepted as valid format

### 3. Data Source Trust

**PASS**

`readState` at `util.mjs:190-198` reads from `<cwd>/.team/features/<name>/STATE.json` — a local file written by the harness (`_written_by: "at-harness"`). JSON.parse handles the deserialization; malformed JSON returns `null` (caught by try/catch at util.mjs:193-196), and `null` triggers a clean exit at report.mjs:172-176.

The trust boundary is appropriate: STATE.json is a harness-internal file, not user-supplied external input.

### 4. Output Injection (Markdown)

**PASS (noted)**

`task.title`, `task.id`, `task.lastReason`, and `state.feature` are interpolated directly into markdown at lines 34, 45, 57, 84, 94, 100. A title containing `|` would break markdown table formatting; a title with markdown links or HTML could be rendered misleadingly in a GitHub preview.

This is acceptable because: (a) the data source is trusted (see criterion 3), (b) the output is written to a local file or stdout, not served over the network, and (c) the harness controls task title generation.

### 5. Error Message Information Disclosure

**PASS**

Error messages at lines 146, 152, 158, 166, 173 echo user-supplied values (feature name, output format) and internal paths (feature directory). In a CLI context this is standard practice — the user already knows the input they typed, and the resolved path helps them debug.

No credentials, tokens, or secrets are exposed in error messages.

### 6. File Write Safety

**PASS (noted)**

`writeFileSync` at line 182 has no try/catch. A disk-full or permission error would produce an uncaught exception with a stack trace. This is a robustness concern, not exploitable — no sensitive data appears in the stack trace (only the file path, which is deterministic from the feature name).

### 7. Secrets Management

**PASS — N/A**

No credentials, tokens, API keys, or secrets are handled by this code path. The only external interaction is reading/writing local files.

## Findings

🟡 bin/lib/report.mjs:157 — Path traversal guard bypassed by `.` and `..` as feature names. `basename(".")` returns `"."` which passes the check. With `..`, the feature dir resolves to `<cwd>/.team/` and `--output md` would write `REPORT.md` there. Add an explicit reject: `if (featureName === "." || featureName === "..")` or use a regex allowlist `/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/`.

🔵 bin/lib/report.mjs:57 — Task titles containing `|` would break the markdown table row. Low risk since titles come from trusted STATE.json. Consider escaping pipe characters in table cells if titles ever accept external input.

🔵 bin/lib/report.mjs:182 — `writeFileSync` without try/catch. Stack trace on permission error exposes internal paths (non-sensitive). Consider wrapping for a cleaner UX.

## Edge Cases Checked

| Edge Case | Status | Evidence |
|-----------|--------|----------|
| `../../etc` path traversal | Blocked | test:409, guard at line 157 |
| `.` as feature name | Bypasses guard | `basename(".")` = `"."` — should be backlogged |
| `..` as feature name | Bypasses guard | `basename("..")` = `".."` — resolves to `.team/` |
| `--output txt` (unsupported) | Blocked | test:391 |
| `--output` (no value) | Blocked | test:400 |
| Malformed STATE.json | Handled | `readState` returns null → clean exit |
| Missing feature dir | Handled | test:294 |
| Missing STATE.json | Handled | test:303 |
| No feature name | Handled | test:285 |
| Title absent → `—` fallback | Correct | test:63-72 |
| Title present → rendered | Correct | test:53-61 |

## Summary

The implementation is secure for its threat model. The code reads trusted local files (STATE.json written by the harness), performs no network I/O, handles no credentials, and outputs only to stdout or local files. Input validation covers the primary attack surface (CLI args) with one incomplete case (`.`/`..` bypass of the path traversal guard). The Title column change introduces no new security surface — it reads `task.title` from the already-trusted STATE.json and renders it into markdown output.

The `.`/`..` bypass is the only actionable finding and should go to backlog. It does not block merge because the impact is contained within `.team/` and there is no data exfiltration, command injection, or privilege escalation path.

---

# Architect Evaluation — execution-report / task-3

**Reviewer role:** Architect
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commit:** 62d246c (HEAD of feature/execution-report)

---

## Files Actually Read

- `bin/lib/report.mjs` (full, 188 lines) — implementation
- `test/report.test.mjs` (full, 415 lines) — test suite
- `.team/features/execution-report/tasks/task-3/handshake.json` — builder claim
- `.team/features/execution-report/tasks/task-8/eval.md` — tester evaluation (full, 107 lines)
- `git diff ab254c0~1 ab254c0 -- bin/lib/report.mjs test/report.test.mjs` — commit that added Title column
- `git diff HEAD~1` — latest commit changes

---

## Tests Independently Run

```
node --test test/report.test.mjs
tests 33  |  pass 33  |  fail 0  |  duration_ms 153
```

---

## Builder Claim Verification

The task-3 handshake claims:
1. "Title column in Task Summary table header" — **Confirmed.** report.mjs:52 renders `| Task | Title | Status | Attempts | Gate Verdict |` (5-column header). Line 57 populates each row with `task.title || "—"`.
2. "Tests at report.test.mjs lines 53-71 cover both cases" — **Confirmed.** Line 53: test with `title: "Do something"` asserts the title appears. Line 63: test with no `title` property asserts `| task-1 | — |` appears.
3. "All 551 tests pass" — **Not independently verified for full suite** (ran the 33 report tests only; gate output in prompt shows all suites passing).

---

## Architectural Assessment

### Module Boundaries — PASS

`buildReport` is a **pure function**: state in, string out, no side effects. `cmdReport` handles all I/O (file reads, writes, stdout, stderr, exit) through an injectable `deps` object. This separation is correct and well-maintained — the Title column change did not blur the boundary.

### Coupling — PASS

The report module depends only on `util.mjs` (for `readState`) and Node built-ins (`fs`, `path`). The `task.title` field is read with a `|| "—"` fallback, so there is no coupling to task creation logic or schema enforcement. The report gracefully handles absent fields rather than demanding upstream guarantees.

### Pattern Consistency — PASS

The Title column follows the exact same pattern as the existing columns (Task, Status, Attempts, Gate Verdict):
- Header added at line 52
- Data interpolated at line 57 with a fallback for missing values

The `task.title || "—"` fallback is consistent with how `lastVerdict` falls back to `"—"` on line 56 when no gate runs exist.

### Scalability — PASS

`buildReport` iterates tasks once per section (What Shipped filter, Task Summary loop, Cost Breakdown filter, Blocked/Failed filter, Recommendations filters). For expected scale (tens of tasks per feature), this linear-pass approach is appropriate. No premature optimization needed.

### Dependency Injection — PASS

The DI pattern in `cmdReport` (lines 135-143) is well-structured: each I/O dependency has a production default and can be overridden in tests. The test helper `makeDeps` (test line 267) cleanly captures all outputs. No new dependencies were introduced by the Title column change.

---

## Findings

🟡 bin/lib/report.mjs:157 — Path traversal guard uses `basename()` which passes `.` and `..` through unchanged. `basename(".")` returns `"."`, so the check `featureName !== basename(featureName)` evaluates to `false`. This allows `.` and `..` as feature names, resolving to `.team/features/.` or `.team/features/..` — a directory escape. Verified by running `basename(".")` and `basename("..")` in Node. Add an allowlist regex like `/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/` or explicit rejection of `.` and `..`. (Pre-existing — not introduced by this task.)

🟡 bin/lib/report.mjs:21 — Invalid `createdAt` ISO string produces `NaN` from `new Date().getTime()`, flowing through arithmetic to render `"NaNh"` in the header. Verified by running `new Date("garbage").getTime()` in Node. Add a `Number.isFinite(mins)` guard to fall back to `"N/A"`. (Pre-existing — not introduced by this task.)

🔵 bin/lib/report.mjs:57 — `task.title` is interpolated directly into a markdown table cell. If a title contains `|` or newline characters, it would break table formatting. Risk is low since STATE.json is machine-written, but `title.replace(/[|\n]/g, " ")` would harden it.

---

## Edge Cases Checked

| Scenario | Verified? | Method |
|----------|-----------|--------|
| Title present in table row | Yes | Test line 53-60, ran passing |
| Title absent shows `—` | Yes | Test line 63-71, ran passing |
| Title in What Shipped section | Yes | Test line 74-79, ran passing |
| What Shipped fallback to `task.id` when no title | Partial | Code path at line 45 confirmed by reading; no dedicated test |
| `.` as feature name bypasses guard | Yes | Ran `basename(".")` in Node — confirmed bypass |
| `..` as feature name bypasses guard | Yes | Ran `basename("..")` in Node — confirmed bypass |
| Invalid `createdAt` produces NaN | Yes | Ran `new Date("garbage")` in Node — confirmed `NaNh` output |

---

## Summary

The Title column implementation is architecturally clean. It's a minimal, well-scoped change that follows established patterns, introduces no new dependencies or abstractions, and maintains the pure-function / DI-for-IO boundary that makes this module testable. The two yellow findings are pre-existing issues in the surrounding code (path traversal guard gap, NaN duration), not regressions from this change. Neither blocks merge; both should go to backlog.

---

# Engineer Evaluation — execution-report / task-3

**Reviewer:** Engineer
**Verdict:** PASS
**Date:** 2026-04-26

---

## Handshake Verification

| Claim | Verified | Evidence |
|-------|----------|----------|
| Title column in table header (report.mjs:52) | Yes | `| Task | Title | Status | Attempts | Gate Verdict |` |
| Row uses `task.title \|\| "—"` (report.mjs:57) | Yes | `${task.title \|\| "—"}` |
| Tests cover both present/absent title | Yes | test:53-61 (present), test:63-71 (absent) |
| All tests pass | Yes | Ran `node --test test/report.test.mjs` — 33/33 pass, 0 fail |
| Artifact `bin/lib/report.mjs` exists | Yes | 187 lines |
| Artifact `test/report.test.mjs` exists | Yes | 415 lines |
| Artifact `test-output.txt` exists | **No** | `task-3/artifacts/` directory does not exist |

---

## Files Actually Read

- `.team/features/execution-report/tasks/task-3/handshake.json`
- `bin/lib/report.mjs` (187 lines — full file)
- `test/report.test.mjs` (415 lines — full file)
- `git show ab254c0 -- bin/lib/report.mjs test/report.test.mjs` (actual code diff)
- `git show 4b5fea9 --stat` (commit metadata — only STATE.json workspace files changed)
- `.team/features/execution-report/tasks/task-8/eval.md` (prior tester eval)

---

## Per-Criterion Results

### 1. Implementation Correctness — PASS

The diff (commit `ab254c0`) shows the table header changed from 4 to 5 columns and the row template adds `${task.title || "—"}` in the second position. The separator row column count matches (5 dash groups).

Edge cases traced through code:

| Input | Expression | Output | Correct? |
|-------|-----------|--------|----------|
| `task.title = "Do X"` | `"Do X" \|\| "—"` | `"Do X"` | Yes |
| `task.title = undefined` | `undefined \|\| "—"` | `"—"` | Yes |
| `task.title = null` | `null \|\| "—"` | `"—"` | Yes |
| `task.title = ""` | `"" \|\| "—"` | `"—"` | Yes |
| `task.title = "foo \| bar"` | renders `foo \| bar` | **6 columns** | Breaks table |

Confirmed pipe breakage via execution:
```
Header cols: 5
Row cols: 6
```

### 2. Code Quality — PASS

- One column added to header, separator, and row template — no over-engineering.
- `task.title || "—"` matches the existing fallback idiom (`task.attempts ?? 0`, verdict `"—"`).
- Comment numbering updated (Section 2 → What Shipped, Section 3 → Task Summary).
- No dead code or leftover scaffolding.

### 3. Test Quality — PASS

- `report.test.mjs:53-61`: Asserts exact 5-column header string and title value ("Do something") appears. Catches column ordering regressions.
- `report.test.mjs:63-71`: Asserts `"| task-1 | — |"` substring — uniquely identifies the fallback (only appears if Title column exists and uses `"—"`).
- `makeState()` fixture includes `title` on both default tasks, ensuring the happy path always exercises title rendering.

### 4. Error Handling — PASS

No new error paths introduced. The `||` fallback handles missing titles without throwing. The change only affects string formatting within `buildReport()`, which has no I/O or exception sources.

### 5. Performance — PASS

Adds one string interpolation per task row: O(n) where n = tasks. No new iterations, filters, or I/O. The gate lookup `gates.filter(g => g.taskId === task.id)` was pre-existing.

---

## Findings

🟡 bin/lib/report.mjs:57 — `task.title` containing a pipe `|` breaks the markdown table. Confirmed: row renders 6 columns vs 5 in header. Title is the first free-text column in this table (other columns are system-generated IDs, enums, or numbers). Escape with `(task.title || "—").replace(/\|/g, '\\|')`, or document that titles must not contain pipes.

🔵 test/report.test.mjs — What Shipped fallback to `task.id` (report.mjs:45) is untested. The absent-title test at line 63 creates a passed task without title but only asserts on the Task Summary table row, not the `"- task-1"` bullet in What Shipped.

🔵 task-3/artifacts/ — Missing `test-output.txt` evidence file. Builder claims all tests pass (confirmed by running them), but the standard artifact was not produced.

---

## Edge Cases Verified

| Edge Case | Tested? | Behavior |
|-----------|---------|----------|
| Title present | Yes (test:53-61) | Renders in table cell |
| Title undefined | Yes (test:63-71) | Shows `—` |
| Title null | No explicit test | `null \|\| "—"` → correct via JS semantics |
| Title empty string | No explicit test | `"" \|\| "—"` → correct via JS semantics |
| Title with pipe char | No test | Breaks table — 6 cols vs 5 (confirmed via execution) |
| No tasks array | Implicit | `state.tasks \|\| []` at line 12 — header renders, no rows |
| What Shipped with title | Yes (test:74-79) | Bullet uses title |
| What Shipped without title | Not tested | Falls back to `task.id` (code is correct) |

---

## Summary

The Title column implementation is correct, minimal, and well-tested. The `||` fallback handles all falsy values. Both primary paths have explicit test assertions specific enough to catch regressions. The one yellow — unescaped pipe characters in free-text titles breaking markdown table rendering — is a genuine gap introduced by this change and should be backlogged. It does not block merge because task titles are authored by the planning system from SPEC.md, not from untrusted external input.
