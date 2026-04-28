# Architect Review: External Validator Integration (Feature-Wide)

**Reviewer:** Architect
**Scope:** Full feature — tasks 1-9, all commits on `feature/external-validator-integration`
**Verdict:** PASS

## Files Actually Read

| File | Lines Read | Purpose |
|---|---|---|
| `bin/lib/gate.mjs` | 1-285 (full) | Core gate logic, shared helpers |
| `bin/lib/parsers.mjs` | 1-333 (full) | All parser implementations |
| `bin/lib/run.mjs` | 1-1597 (full) | Inline gate runner, feature execution |
| `bin/lib/handshake.mjs` | 1-199 (full) | Handshake protocol, validation |
| `test/parsers.test.mjs` | 1-1500 (full) | Parser unit + integration tests |
| `test/worktree.test.mjs` | 1-356 (full) | Gate structured output tests |
| `package.json` | diff only | Dependency check |
| All 9 `handshake.json` | full | Builder claims verification |
| `task-9/eval.md` | 1-30 | Previous review context |

## Architecture Assessment

### Boundaries and Coupling

**Good.** The implementation introduces a clean new module (`parsers.mjs`) that is purely functional — zero I/O, zero side effects, only string-in/findings-out. This is the right boundary. The module is independently testable without filesystem setup.

The shared gate helpers (`processGateOutput`, `writeGateArtifacts`, `loadValidatorConfig`) are correctly extracted into `gate.mjs` and consumed by both `cmdGate` (subprocess path) and `runGateInline` (in-process path). This eliminates the duplication that existed before where artifact writing was inlined in `cmdGate`.

The `handshake.mjs` change is minimal: one string added to `VALID_ARTIFACT_TYPES`. No schema changes, no contract breaks.

### Verdict Logic Correctness

The core invariant — "exit code 0 + structured failures in output → FAIL verdict" — is implemented at `gate.mjs:63-64`:

```js
const effectiveCritical = parsedFindings.length > 0 ? criticalCount : (exitCode === 0 ? 0 : 1);
const verdict = effectiveCritical > 0 ? "FAIL" : (exitCode === 0 ? "PASS" : "FAIL");
```

Logic paths verified:
- **Structured failures found (criticalCount > 0):** `effectiveCritical = criticalCount > 0` → verdict = FAIL. Correct regardless of exit code.
- **Structured output, warnings only (criticalCount = 0):** `effectiveCritical = 0` → verdict depends on exit code. PASS if exit 0. Correct.
- **No structured output detected (parsedFindings empty), exit 0:** `effectiveCritical = 0` → PASS. Correct backward-compatible behavior.
- **No structured output, exit non-zero:** `effectiveCritical = 1` → FAIL. Correct.

Defense-in-depth: `handshake.mjs:133` rejects PASS verdict when `findings.critical > 0`. This catches any bug in the verdict computation.

### Format Detection Cascade

`detectAndParse` (`parsers.mjs:297-320`) checks formats in order: JUnit XML → TAP → Problem Matcher → JSON. This ordering is correct:
1. JUnit XML is the most specific (requires `<testsuite` tag)
2. TAP has distinctive markers (`TAP version`, `N..M` plan)
3. Problem Matcher is line-level (`::error`)
4. JSON is the most generic (any `{` prefix), so it goes last

### Scalability at 10x

At 10x the current number of validators/formats, the current design holds. Adding a new parser requires:
1. Write a `parseNewFormat()` function in `parsers.mjs`
2. Add detection logic to `detectAndParse`
3. Add a case to `parseWithFormat`

The `validators.json` config path (`parser: "format-name"`) makes this extensible without code changes for users who configure explicitly.

### Dependencies

No new runtime dependencies. The only `package.json` change adds `test/parsers.test.mjs` to the test script. The regex-based XML parsing avoids an npm dependency on an XML parser, which is appropriate for the limited subset of JUnit XML being parsed.

### Safety Net

`gate.mjs:266-278` adds a try/catch around the entire processing pipeline inside `cmdGate`'s finally block. If any internal error occurs (e.g., a parser bug), it falls back to exit-code-based verdict and always emits valid JSON. This prevents the gate from crashing and leaving the harness in an inconsistent state.

### Test Coverage

1500 lines of tests covering:
- All 4 parsers with edge cases (null input, missing fields, malformed data)
- Auto-detection cascade (correct format picked, no false triggers)
- Malformed input (truncated XML, invalid JSON → graceful fallback)
- Full gate integration via subprocess (cmdGate end-to-end)
- `validators.json` config (forced parser, outputFile, missing config)
- The core invariant: exit 0 + structured failures → FAIL (7 test cases)
- Handshake validation: PASS + critical > 0 → rejected

## Structured Findings

🟡 bin/lib/gate.mjs:207 — `validators.json` `outputFile` joined with `process.cwd()` without path traversal guard; a malicious config could read arbitrary files into artifacts. Add `..` and separator check matching the taskId sanitization at line 118.
🟡 bin/lib/run.mjs:94 — Same `outputFile` path traversal gap in the inline gate runner path (joins with `cwd` param). Apply same fix.
🟡 bin/lib/gate.mjs:199-211 + bin/lib/run.mjs:88-98 — Config override assembly (~12 lines) duplicated between `cmdGate` and `runGateInline`. Extract to shared helper (e.g., `buildConfigOverride(validatorConfig, basePath)`) to prevent drift.
🔵 bin/lib/parsers.mjs:27 — Regex-based JUnit XML parsing won't handle CDATA sections, XML namespaces, or attribute values containing `>`. Document as known limitation; consider dependency-free SAX parser if scope grows.
🔵 bin/lib/parsers.mjs:173 — `parseProblemMatcher` only captures `::error`, ignoring `::warning`. Map to warning-severity findings in a future iteration.
🔵 test/parsers.test.mjs:757 + test/parsers.test.mjs:1382 — `harnessJSON` test helper is copy-pasted across two describe blocks. Extract to shared test utility.

## Edge Cases Checked

| Edge Case | Status | Evidence |
|---|---|---|
| Exit 0 + JUnit failures → FAIL | Verified | `parsers.test.mjs:1283-1297`, `gate.mjs:63-64` logic |
| Exit 0 + warnings only → PASS | Verified | `parsers.test.mjs:1328-1336` |
| Truncated XML → fallback to exit code | Verified | `parsers.test.mjs:667-691`, `parsers.mjs:301-304` |
| Invalid JSON → fallback to exit code | Verified | `parsers.test.mjs:694-719`, `parsers.mjs:315-317` |
| Path traversal in taskId → rejected | Verified | `parsers.test.mjs:927-936`, `gate.mjs:118-121` |
| No structured output → exit-code verdict | Verified | `parsers.test.mjs:1338-1343` |
| Internal error in processing → JSON always emitted | Verified | `gate.mjs:266-278` |
| PASS + critical > 0 in handshake → validation error | Verified | `parsers.test.mjs:1358-1372`, `handshake.mjs:133` |

## Verdict

**PASS** — The architecture is clean, well-bounded, and well-tested. The `parsers.mjs` module is purely functional with zero coupling to I/O. The shared helpers eliminate duplication between gate paths. No new dependencies. The core invariant (structured failures override exit code) is implemented with defense-in-depth and verified by comprehensive tests.

The two 🟡 findings (outputFile path traversal, config assembly duplication) should go to backlog but do not block merge. The path traversal issue is lower risk than it appears because `validators.json` lives in `.team/` which is harness-controlled, not builder-writable. But it should be hardened for defense-in-depth.
