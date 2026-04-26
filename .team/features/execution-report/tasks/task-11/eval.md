# Tester Review — task-11: `agt report no-such-feature` exits 1 with "not found"

**Reviewer role:** Tester
**Verdict: PASS**
**Date:** 2026-04-26

---

## Handshake Claims vs Evidence

| Claim | Evidence | Result |
|-------|----------|--------|
| Added integration test verifying `agt report no-such-feature` exits 1 with 'not found' | Test at `test/report.test.mjs:534-542` uses `spawnSync` to invoke the real CLI | PASS |
| Behavior already implemented in cmdReport (lines 171-175) | `report.mjs:171-175` checks `_existsSync(featureDir)` and writes "not found" to stderr | PASS |
| Artifact: `test/report.test.mjs` | File exists, test present in `cmdReport` describe block | PASS |

---

## Tests Independently Run

```
$ node --test test/report.test.mjs
tests 48  |  pass 48  |  fail 0  |  duration_ms 174

$ node --test --test-name-pattern="no-such-feature" test/report.test.mjs
tests 1  |  pass 1  |  fail 0  |  duration_ms 113
```

Manual CLI verification:
```
$ node bin/agt.mjs report no-such-feature
(exit code: 1)
stderr: "report: feature directory not found: .../.team/features/no-such-feature"
stdout: (empty)
```

---

## Files Actually Read

- `bin/lib/report.mjs` (full, 194 lines) — production implementation
- `test/report.test.mjs` (full, 609 lines) — test suite
- `bin/agt.mjs` (lines 180-210, plus grep for "report") — CLI wiring
- `.team/features/execution-report/tasks/task-11/handshake.json` — builder's claims
- Git diff for commit `e2539c8` — the actual code change

---

## Test Coverage Analysis

### "Not found" error path coverage

| Test | Level | Lines Exercised |
|------|-------|-----------------|
| `exits 1 when feature directory does not exist` (line 462) | Unit (mocked deps) | report.mjs:171-174 |
| `agt report no-such-feature: exits 1 with 'not found' in output` (line 534) | Integration (spawnSync) | Full CLI: bin/agt.mjs:75 → cmdReport → existsSync → stderr + exit(1) |

Both unit and integration levels are covered for this error path.

### Adjacent error paths also covered

| Error Path | Test Location | Lines |
|------------|---------------|-------|
| No feature name → exit 1 + "Usage:" | test:453-458 | report.mjs:151-154 |
| STATE.json missing → exit 1 | test:471-476 | report.mjs:178-181 |
| Path traversal → exit 1 + "invalid feature name" | test:589-607 | report.mjs:163-167 |
| Unsupported `--output` format → exit 1 | test:571-585 | report.mjs:157-161 |
| `--output` without value → exit 1 | test:580-585 | report.mjs:157-161 |

### Edge cases checked during review

| Edge Case | Outcome |
|-----------|---------|
| Empty string feature name (`""`) | Manually tested: falls through to "Usage:" guard (line 151) since empty string is falsy — correct |
| Feature name with spaces | Not tested, but `basename()` handles it correctly and `existsSync` returns false for nonexistent dirs — low risk |
| Feature dir exists but STATE.json absent | Covered by unit test at line 471 |
| Feature name is `"."` or `".."` | Covered by path traversal tests at lines 596-607 |
| Feature name containing `/` | Caught by `basename()` check at line 163 |

---

## Code Path Trace

The "not found" path through `cmdReport` is:

1. `cmdReport(["no-such-feature"])` called from `bin/agt.mjs:75`
2. `featureName` extracted as `"no-such-feature"` (line 139)
3. Guards pass: featureName is truthy (line 151), no `--output` (line 157), basename matches (line 163)
4. `featureDir` constructed as `<cwd>/.team/features/no-such-feature` (line 169)
5. `_existsSync(featureDir)` returns `false` (line 171)
6. stderr: `"report: feature directory not found: <featureDir>"` (line 172)
7. `_exit(1)` (line 173)
8. `return` (line 174) — prevents fallthrough

This path is deterministic and has no side effects beyond stderr output and exit code.

---

## Findings

🔵 test/report.test.mjs:540 — The integration test checks `combined` (stdout + stderr) for "not found", but the message is written only to stderr. Asserting `result.stderr.includes("not found")` directly would be more precise and would catch regressions where the message accidentally moves to stdout. Not a correctness issue.

---

## Summary

The task is narrow and well-executed. One `spawnSync`-based integration test was added (commit `e2539c8`) for a behavior that was already implemented in `cmdReport` at `report.mjs:171-175`. The implementation logic is correct and straightforward — checks `existsSync`, writes a clear error message to stderr, exits 1. The test exercises the full CLI path end-to-end. The unit-level test at line 462 provides additional coverage with mocked deps. All 48 report tests pass with no regressions.

**Overall verdict: PASS**
