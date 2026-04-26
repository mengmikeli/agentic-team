# Security Review — execution-report / task-16

**Reviewer role:** Security
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commit:** b4c8026 (HEAD of feature/execution-report)

---

## Files Actually Read

- `bin/lib/report.mjs` (209 lines, full) — production implementation
- `bin/agt.mjs` (879 lines, full) — CLI wiring, help text, dashboard server
- `test/report.test.mjs` (800 lines, full) — test suite (61 tests)
- `bin/lib/util.mjs:190-198` — `readState` function
- `.team/features/execution-report/tasks/task-16/handshake.json` — builder claim
- `.team/features/execution-report/tasks/task-16/eval.md` — PM review
- `.team/features/execution-report/tasks/task-20/eval.md` — PM review (final round)
- `.team/features/execution-report/tasks/task-21/eval.md` — engineer review

---

## Tests Independently Run

```
$ node --test test/report.test.mjs
tests 61  |  suites 2  |  pass 61  |  fail 0  |  duration_ms 289
```

```
$ node bin/agt.mjs help report
(exits 0, prints usage with "agt report <feature>", "--output md", and examples)
```

---

## Builder Handshake Verification

**Task-16 handshake claims:**
- `agt help report` already exits 0 with correct output
- The existing integration test at `test/report.test.mjs` line 665-674 covers this behavior
- No code changes needed

**Verified:**
- `bin/agt.mjs:188-195` contains the `report` help entry with usage, description, `--output md` flag, and two examples. Confirmed present and correct.
- `test/report.test.mjs:665-674` runs `node bin/agt.mjs help report` and asserts exit 0, presence of "agt report", "--output", and "agt report my-feature". Confirmed present and passing.
- Commit b4c8026 changes 0 production code files — only adds documentation artifacts (handshake.json, eval.md files). Consistent with "no code changes needed" claim.

---

## Security Audit — `bin/lib/report.mjs`

### 1. Path Traversal Protection (line 172-176) — PASS

```js
if (featureName !== basename(featureName) || featureName === "." || featureName === "..") {
```

This check rejects any feature name containing path separators (since `basename("../etc")` !== `"../etc"`), and explicitly blocks `.` and `..`. The result is joined via `join(cwd, ".team", "features", featureName)`, so an attacker cannot escape the features directory. Test coverage at lines 708-727 and 781-786 confirms traversal variants (`../../etc`, `.`, `..`, `foo/bar`) are all rejected with exit 1.

### 2. ANSI Escape Injection Prevention (lines 13-16) — PASS

```js
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "");
}
```

Applied to user-supplied values before echoing to stderr (lines 167, 173). Prevents terminal escape injection where a crafted feature name or `--output` value could inject ANSI sequences to manipulate terminal rendering. The regex covers standard CSI sequences.

### 3. Markdown Table Injection — escapeCell (lines 8-10) — PASS

```js
function escapeCell(text) {
  return text.replace(/[\r\n]+/g, " ").replace(/\|/g, "\\|");
}
```

Applied to `task.title` in the Task Summary table (line 69). Prevents pipe characters from breaking markdown table structure and newlines from splitting rows. Test coverage at lines 286-321 validates both pipe escaping and newline stripping.

**Note:** `escapeCell` is not applied to `task.id`, `task.status`, or `lastVerdict` in the table, nor to `task.lastReason` in the Blocked/Failed section. These are harness-controlled values (written by `writeState` in `util.mjs:200-205`) and not user-facing input. For a local CLI tool, this is an acceptable risk posture. Already tracked as a backlog yellow in prior reviews.

### 4. writeFileSync Error Handling (lines 197-203) — PASS

The `--output md` write path is wrapped in try/catch. Filesystem errors (EACCES, ENOSPC, etc.) are caught and reported to stderr with exit 1, not thrown as unhandled exceptions. Test at line 790-798 confirms this behavior.

### 5. Duration NaN/Infinity Guard (lines 31-33) — PASS

```js
const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
if (!Number.isFinite(mins)) { duration = "N/A"; }
```

Invalid ISO dates produce NaN through `new Date("not-a-date").getTime()` -> NaN -> `Number.isFinite(NaN)` -> false -> falls back to "N/A". Negative durations (clock skew) are clamped to 0 via `Math.max(0, ...)`. Tests at lines 323-331 and 432-443 verify both cases.

### 6. --output Format Validation (lines 166-170) — PASS

Only `md` is accepted. Any other value (including undefined when `--output` is the last arg) triggers exit 1 with an error message. The invalid value is passed through `stripAnsi` before output. Tests at lines 690-704.

### 7. readState Failure Handling (lines 186-191) — PASS

`readState` (util.mjs:190-198) returns `null` on missing file or malformed JSON (try/catch around `JSON.parse`). `cmdReport` checks for null and exits 1 with a descriptive error. This prevents crashes from corrupted STATE.json.

### 8. No Secrets or Credentials Exposure — PASS

The report module reads only STATE.json (task status, cost data, gate results). It does not handle authentication tokens, API keys, PII, or any sensitive credentials. The output is written to stdout or a local file. No network calls are made.

### 9. No Command Injection — PASS

No shell execution (`exec`, `spawn`, `spawnSync`) occurs in `report.mjs`. Feature names and args are used only for filesystem path construction (via `path.join`, which does not execute shell commands) and string interpolation in markdown output. The integration tests use `spawnSync` to invoke `node bin/agt.mjs`, but this is test infrastructure only.

### 10. Help Text (agt.mjs:188-195) — PASS

The `help report` entry at `agt.mjs:188-195` is entirely static text. No user input is interpolated into the help output. The `sub` variable (from `args[0]`) is used only as a key lookup into the `helps` object — if it doesn't match, the unknown-command branch (line 221-224) echoes it back, but this is a local CLI context (not a web service).

---

## Edge Cases Checked

| Edge Case | Verified | Evidence |
|-----------|----------|----------|
| Path traversal (`../../etc`) | Yes | test:708-713, exits 1 |
| Dot name (`.`, `..`) | Yes | test:715-727, exits 1 |
| Slash in name (`foo/bar`) | Yes | test:781-786, exits 1 |
| Missing feature name | Yes | test:572-577, exits 1 |
| Missing feature directory | Yes | test:581-586, exits 1 |
| Missing STATE.json | Yes | test:590-595, exits 1 |
| Invalid ISO date (NaN duration) | Yes | test:323-331, renders "N/A" |
| Negative duration (clock skew) | Yes | test:432-443, clamps to 0m |
| Pipe in task.title | Yes | test:286-304, escaped |
| Newline in task.title | Yes | test:306-321, replaced |
| `\r\n` in task.title | Yes | test:485-496, replaced |
| writeFileSync throws | Yes | test:790-798, exits 1 |
| --output with no value | Yes | test:699-704, exits 1 |
| --output with unsupported format | Yes | test:690-695, exits 1 |
| Empty tasks array | Yes | test:498-504, no crash |
| costUsd is 0 | Yes | test:506-512, renders $0.0000 |
| costUsd is NaN/Infinity | Yes | Number.isFinite guard at line 78 |
| Task with no title | Yes | test:63-72, test:333-342, test:524-532 |
| Task with no lastReason | Yes | test:163-171, test:173-181 |
| Help text for unknown command | Yes | agt.mjs:221-224, exits 1 |

---

## Findings

🟡 `bin/lib/report.mjs:57` — `task.title` in What Shipped section (`- ${task.title || task.id}`) is not passed through `escapeCell`. If a task title contains markdown syntax (e.g., `[link](url)` or `![img](url)`), it would render as active markdown in REPORT.md. Low risk since titles are harness-controlled, but inconsistent with escaping applied in the Task Summary table. Backlog item.

🟡 `bin/lib/report.mjs:99-100` — `task.title` and `task.lastReason` in the Blocked/Failed section are not escaped. Same risk profile as above. Backlog item.

🔵 `bin/lib/report.mjs:15` — The `stripAnsi` regex `\x1b\[[0-9;]*[a-zA-Z]` covers standard CSI sequences but misses OSC sequences (`\x1b]...ST`) and some rare 8-bit CSI variants (`\x9b`). For a local CLI tool this is fine; for defense-in-depth, a library like `strip-ansi` would be more comprehensive.

---

## Overall Verdict: PASS

The execution-report feature demonstrates solid security practices for a local CLI tool:

1. **Path traversal** is blocked with `basename` comparison plus explicit `.`/`..` rejection, with 4 test cases covering variants.
2. **Input sanitization** includes ANSI stripping on stderr output and pipe/newline escaping in markdown tables.
3. **Error handling** is defensive — all failure paths (missing args, missing directory, missing STATE.json, malformed JSON, writeFileSync errors) exit cleanly with descriptive messages.
4. **No injection surface** — no shell execution, no network calls, no credential handling.
5. **NaN/Infinity guards** prevent garbage output from invalid dates or costs.

The two yellows (inconsistent `escapeCell` application) are pre-existing backlog items from prior reviews, not regressions from task-16. Task-16 itself made zero production code changes — it is purely a verification gate confirming that `agt help report` already works. The builder's claim is accurate.

61 tests pass, including 3 integration tests that exercise the real CLI binary. All security-relevant edge cases have explicit test coverage.
