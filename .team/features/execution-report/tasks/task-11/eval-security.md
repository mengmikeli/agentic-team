# Security Evaluation — task-11: `agt report no-such-feature` exits 1 with "not found"

**Reviewer role:** Security
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commits:** e2539c8..21f38a5

---

## Files Actually Read

- `bin/lib/report.mjs` (194 lines) — full implementation of `cmdReport` and `buildReport`
- `test/report.test.mjs` (609 lines) — full test suite including unit and integration tests
- `bin/agt.mjs` (879 lines) — CLI entry point, verified `report` routing at line 75
- `bin/lib/util.mjs:190-198` — `readState` function (JSON.parse with try/catch)
- `git diff e2539c8^..21f38a5 -- test/report.test.mjs bin/lib/report.mjs` — exact diff for task-11
- `.team/features/execution-report/tasks/task-11/handshake.json` — builder claims

---

## Builder Claims vs Evidence

| Claim | Evidence | Verified? |
|-------|----------|-----------|
| Behavior already implemented at report.mjs:171-175 | Lines 171-175: `if (!_existsSync(featureDir))` → stderr "not found" → exit(1) | Yes |
| Added integration test for end-to-end behavior | test/report.test.mjs:534-542: `spawnSync("node", [agtPath, "report", "no-such-feature"])` asserts exit 1 + "not found" | Yes |
| Artifact: `test/report.test.mjs` | File exists, diff confirms 12-line addition (integration test block) | Yes |

---

## Security Criteria

### 1. Path Traversal — PASS

report.mjs:163-167 validates the feature name before constructing a filesystem path:

```js
if (featureName !== basename(featureName) || featureName === "." || featureName === "..") {
  _stderr.write(`report: invalid feature name: ${featureName}\n`);
  _exit(1);
  return;
}
```

This rejects any input containing `/` or `\` (via `basename` comparison), as well as `.` and `..`. Three test cases cover this at test/report.test.mjs:589-608:
- `../../etc` → exit 1 + "invalid feature name"
- `.` → exit 1 + "invalid feature name"
- `..` → exit 1 + "invalid feature name"

The path is then constructed deterministically at line 169: `join(_cwd(), ".team", "features", featureName)` — no user-controlled directory separators can reach this.

### 2. Input Validation — PASS

All user-facing entry points are validated before use:

| Input | Guard | Line | Test |
|-------|-------|------|------|
| No feature name | `if (!featureName)` → exit 1 | 151-155 | test:453-458 |
| Invalid `--output` value | `outputVal !== "md"` → exit 1 | 157-161 | test:571-585 |
| Path traversal in name | `basename` check → exit 1 | 163-167 | test:589-608 |
| Missing feature dir | `!_existsSync(featureDir)` → exit 1 | 171-175 | test:462-466, 534-542 |
| Missing STATE.json | `!state` → exit 1 | 178-182 | test:471-476 |

All error messages are written to stderr, not stdout — correct separation of concerns.

### 3. Error Message Information Disclosure — PASS (acceptable for context)

Line 172 includes the full path: `report: feature directory not found: ${featureDir}`. This reveals the absolute filesystem path, but since this is a local CLI tool where the user already has filesystem access, this is expected behavior and aids debugging. No network-facing exposure.

### 4. Injection Vectors — PASS

- **Terminal escape injection:** User-controlled values (featureName, outputVal) are reflected to stderr. Terminal escape sequences in these values could theoretically alter terminal display, but this is standard behavior for all CLI tools and not a meaningful security concern.
- **Markdown table injection:** `escapeCell` (line 8-10) escapes pipe characters in task titles to prevent Markdown table corruption. This is a formatting function, not a security boundary.
- **JSON parsing:** `readState` (util.mjs:190-198) uses `JSON.parse` wrapped in try/catch. `JSON.parse` does not execute code, so malformed STATE.json files are handled safely.

### 5. Dependency Injection Surface — PASS

`cmdReport` accepts a `deps` object for test injection (lines 141-149). The defaults are real fs/process objects. This parameter is not exposed to CLI args — only test code can pass custom deps. No injection pathway from user input to deps.

### 6. Secrets / Credentials — N/A

No secrets, tokens, API keys, or credentials are involved in this feature. The report reads STATE.json (project metadata) and writes to stdout or REPORT.md.

---

## Edge Cases Checked

- [x] Path traversal (`../../etc`, `.`, `..`) — tested and rejected
- [x] Missing feature name — tested, exit 1 with usage
- [x] Invalid `--output` format — tested, exit 1
- [x] `--output` without value — tested, exit 1
- [x] Missing feature directory — tested, exit 1 with "not found"
- [x] Missing STATE.json — tested, exit 1
- [x] Pipe characters in task titles — tested, escaped for Markdown
- [x] Invalid date strings (NaN) — tested, renders "N/A"
- [x] `--output md` before feature name — tested, correct arg parsing

---

## Findings

No findings.

---

## Summary

The task-11 implementation is a 12-line integration test addition that validates pre-existing behavior in `cmdReport`. The underlying `cmdReport` function has robust input validation: path traversal is blocked via `basename` comparison, all error paths exit with code 1 and write to stderr, and the feature name is never used in an unsafe context. The security posture is appropriate for a local CLI tool — no over-engineering, no missing guards.

**Overall verdict: PASS**
