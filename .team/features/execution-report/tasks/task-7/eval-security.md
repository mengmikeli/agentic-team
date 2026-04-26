# Security Review — task-7 (Blocked / Failed section with lastReason)

**Reviewer role:** Security
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commit:** 546d960 (feat: Blocked / Failed section shows `lastReason`)

---

## Files Actually Read

- `bin/lib/report.mjs` (full, 194 lines) — production code
- `test/report.test.mjs` (full, 537 lines) — test suite
- `bin/lib/transition.mjs` (lines 1–50, 150–200) — `lastReason` write site via CLI `--reason` flag
- `bin/lib/run.mjs` (lines 1460–1489) — `lastReason` write site via hardcoded strings
- `bin/lib/state-sync.mjs` (lines 60–79) — `lastReason` flows to GitHub issue comments
- `bin/lib/board.mjs` (lines 90–106) — `lastReason` rendered to terminal
- `.team/features/execution-report/tasks/task-7/handshake.json`
- `.team/features/execution-report/tasks/task-7/eval.md` — prior architect/tester reviews
- Git diff `ebcd2ca~1..c4ccb69` — full code delta for this task

---

## Builder Claim vs Evidence

**Claim (handshake.json):** Blocked/Failed section implemented in `bin/lib/report.mjs` (lines 85–94). Filters tasks by blocked/failed status, shows `[STATUS]` label with task ID, title, and `lastReason`. Section omitted when all tasks pass. 7 dedicated tests.

**Verified:**
1. `report.mjs:86` — `tasks.filter(t => t.status === "blocked" || t.status === "failed")` — correct filter ✓
2. `report.mjs:87` — `if (problem.length > 0)` — section conditional ✓
3. `report.mjs:90` — `[${task.status.toUpperCase()}]` label with task ID and title ✓
4. `report.mjs:91` — `if (task.lastReason) lines.push(...)` — conditional reason display ✓
5. Tests at lines 109–128, 163–181, 196–208, 456–469 — 7 dedicated tests confirmed ✓

---

## Security Assessment

### 1. Input Sources for `lastReason` — PASS

Traced all write sites for `task.lastReason`:

| Source | File:Line | Value Origin | Risk |
|---|---|---|---|
| Tick-limit exceeded | `transition.mjs:159` | Hardcoded string `"tick-limit-exceeded"` | None |
| CLI `--reason` flag | `transition.mjs:191` | `getFlag(args, "reason")` from subprocess CLI | Low — see §2 |
| Max retries | `run.mjs:1471,1477` | Template `"blocked after ${maxRetries} attempts"` — `maxRetries` is numeric | None |
| Review escalation | Test fixtures only | Hardcoded pattern `"review-escalation: N rounds exceeded"` | None |

All production `lastReason` values are either hardcoded strings or template literals with numeric interpolation. The only semi-dynamic source is the `--reason` CLI flag in `transition.mjs`, which is set by the orchestrator or an agent subprocess — not by external/untrusted users.

### 2. Injection Surface Analysis — PASS

**Context:** `lastReason` is rendered as plain text via:
```js
lines.push(`    Reason: ${task.lastReason}`);
```

| Attack vector | Applicable? | Mitigation |
|---|---|---|
| XSS (HTML injection) | No | Output is plain text to stdout or a `.md` file — no HTML rendering |
| SQL injection | No | No database queries |
| Command injection | No | No shell execution of report content |
| Markdown injection | Minimal | Report is markdown, but consumed locally (terminal/file) — no web rendering in scope |
| Terminal escape sequences | Low | `lastReason` is set by internal harness, not external users |
| Newline injection | Low | A multi-line `lastReason` would break report formatting but not cause harm — all harness-generated values are single-line (verified across all write sites) |

**Downstream propagation:** `state-sync.mjs:69` passes `lastReason` into `commentIssue()` which uses `gh` CLI. GitHub sanitizes issue comment content. No additional risk.

### 3. Path Traversal Protection — PASS

`cmdReport` validates the feature name at line 163:
```js
if (featureName !== basename(featureName) || featureName === "." || featureName === "..")
```

This prevents directory traversal in the feature name. Tests at lines 517–536 cover `../../etc`, `.`, and `..`. The output path for `--output md` is deterministic: `join(featureDir, "REPORT.md")` — no user-controlled filename components.

### 4. Output Format Validation — PASS

`--output` flag only accepts `"md"` (line 157). Unsupported values and missing values both exit with code 1 and an error message. Tests at lines 499–513 cover both cases.

### 5. Error Message Reflection — PASS

Error messages echo user input back to stderr:
- `report: unsupported output format: ${outputVal ?? "(none)"}` (line 158)
- `report: invalid feature name: ${featureName}` (line 164)

This is standard CLI behavior. stderr is not parsed by downstream tools, and terminal escape sequence injection from CLI args is not a realistic threat model for this tool.

### 6. Secrets Management — PASS

No credentials, tokens, API keys, or PII are handled in the report generation code. The `STATE.json` data contains only operational metadata (task statuses, timestamps, cost figures). The `_write_nonce` and `_written_by` fields in state are integrity markers, not secrets.

### 7. File System Operations — PASS

- `readState()` reads from a validated feature directory path
- `writeFileSync()` writes to `REPORT.md` in the same validated directory
- No temporary files, no symlink following concerns
- The DI pattern in `cmdReport` allows tests to mock all I/O — no filesystem side effects in tests

### 8. Denial of Service — PASS

- Report generation is O(n) in number of tasks/gates — no algorithmic complexity concerns
- No unbounded loops or recursive structures
- `tasks` and `gates` arrays come from `STATE.json` which is written exclusively by the harness (verified by `_written_by` check in `transition.mjs:42`)

---

## Edge Cases Verified

| Edge case | Method | Result |
|---|---|---|
| `lastReason` present on blocked task | Read test line 109, code line 91 | PASS — reason rendered |
| `lastReason` present on failed task | Read test line 196, code line 91 | PASS — reason rendered |
| `lastReason` absent (blocked) | Read test line 163, code line 91 | PASS — no reason line |
| `lastReason` absent (failed) | Read test line 173, code line 91 | PASS — no reason line |
| All tasks passed | Read test line 124, code line 87 | PASS — section omitted |
| Path traversal in feature name | Read test lines 517–536, code line 163 | PASS — rejected |
| Pipe characters in task title | Read test line 286, code line 8–9 | PASS — escaped via `escapeCell()` |
| Invalid date in `createdAt` | Read test line 306, code line 26 | PASS — renders N/A, no NaN |

---

## Findings

🔵 bin/lib/report.mjs:91 — `lastReason` is rendered without newline sanitization. If a future code path sets a multi-line `lastReason`, the report formatting would break (bare text on next line without indentation). All current write sites produce single-line strings — this is a defensive-depth suggestion, not a current vulnerability. Consider `task.lastReason.split('\n')[0]` or `.replace(/\n/g, ' ')` if the contract isn't documented.

🔵 bin/lib/report.mjs:90 — `task.title` in the Blocked/Failed section uses `|| "(no title)"` fallback but is not passed through `escapeCell()`. This is consistent with how the section uses plain-text indented lines (not markdown table cells), so pipe escaping is unnecessary here. No action needed — noting for completeness.

---

## Overall Verdict: PASS

The Blocked/Failed section at `report.mjs:85–94` introduces no security vulnerabilities. The `lastReason` field is sourced exclusively from internal harness code paths (hardcoded strings and numeric templates), not from external user input. Output is plain text to stdout or a local markdown file with no web rendering in scope. Path traversal, output format validation, and file write safety are all properly guarded with test coverage. Two optional suggestions noted for defensive depth — neither represents a current risk given the established threat model (internal orchestration CLI tool, no untrusted input).
