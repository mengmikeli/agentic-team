# Simplicity Review — execution-report

**Reviewer role:** Simplicity Advocate
**Verdict: PASS**
**Date:** 2026-04-26
**Reviewed commit:** b4c8026 (HEAD of feature/execution-report)

---

## Files Actually Read

| File | Lines | Read? |
|------|-------|-------|
| `bin/lib/report.mjs` | 1-209 | Full |
| `test/report.test.mjs` | 1-800 | Full |
| `bin/agt.mjs` | 1-879 | Full |
| `bin/lib/util.mjs` | 190-198 (readState) | Partial |
| `git diff main..HEAD -- bin/lib/report.mjs` | Full diff | Yes |
| `git diff main..HEAD -- test/report.test.mjs` | Full diff | Yes |
| `git diff main..HEAD -- bin/agt.mjs` | Full diff | Yes |

---

## Veto-Category Audit

### 1. Dead Code

**Result: PASS**

Every import in `report.mjs` is consumed:
- `existsSync` -> default for `_existsSync` (L180)
- `writeFileSync` -> default for `_writeFileSync` (L153)
- `basename` -> path traversal check (L172)
- `join` -> path construction (L178, L196)
- `readState` -> default for `_readState` (L150)

Both internal helpers (`escapeCell`, `stripAnsi`) are called:
- `escapeCell` at L69 (table row rendering)
- `stripAnsi` at L167, L173 (stderr output sanitization)

Both exports (`buildReport`, `cmdReport`) are consumed:
- `cmdReport` imported at `bin/agt.mjs:19`, dispatched at L75
- `buildReport` used internally at L193 and imported in tests

No commented-out code. No unreachable branches.

### 2. Premature Abstraction

**Result: PASS**

- `escapeCell` (1 call site): A 1-line function, not an abstraction layer. It clarifies intent — "this value needs escaping for a markdown table cell." The alternative (inlining the two chained `.replace()` calls in the template literal at L69) would hurt readability. Justified.
- `stripAnsi` (2 call sites): Prevents ANSI escape injection in user-facing error messages. Two callers, defensive in nature. Justified.
- `buildReport` separated from `cmdReport`: This separation is the standard testability pattern in this codebase. `buildReport` is a pure function tested with 42 unit tests independently of CLI plumbing. This is not premature — it is earned.

### 3. Unnecessary Indirection

**Result: PASS**

The dependency injection pattern in `cmdReport` injects 7 dependencies (`readState`, `existsSync`, `writeFileSync`, `stdout`, `stderr`, `exit`, `cwd`). This is the most complex pattern in the module. Assessed:

- All 7 are genuinely used in tests (19 test cases via `makeDeps`)
- ESM modules can't be easily monkey-patched, so constructor injection is the pragmatic alternative to import mocking
- No wrapper functions exist that merely delegate — `cmdReport` performs real logic (arg parsing, validation, orchestration, output routing)
- `buildReport` is not a thin wrapper; it performs all report generation logic (6 sections, conditional rendering, formatting)

No re-exports, no passthrough wrappers.

### 4. Gold-Plating

**Result: PASS**

Checked for speculative extensibility:

- `--output md` flag: Specified in SPEC.md, tested via e2e tests, two arg orderings validated. Not speculative.
- Path traversal validation (`basename` check, `.`/`..` rejection): Security hardening with 4 tests. Necessary for a CLI that constructs filesystem paths from user input.
- ANSI stripping: Prevents terminal escape injection in error messages. 1 function, 2 call sites. Proportionate defense.
- Duration formatting (minutes vs hours): SPEC.md requirement. Tested with 3 explicit format assertions.
- `blocked`/`failed`/`run in progress` status labels: All 4 branches tested. No unused status paths.
- No config options, no feature flags, no plugin points, no unused enum values.

---

## Non-Veto Observations

These are 🔵 suggestions — not blocking, no backlog impact.

🔵 `bin/agt.mjs:226-253` vs `bin/agt.mjs:841-873` — The general help listing is duplicated between `case "help"` (no subcommand) and `default` (no command). Pre-existing pattern, not introduced by this PR, but each new command (including `report`) adds one more line to both copies. Consider extracting a `printGeneralHelp()` function someday.

🔵 `test/report.test.mjs:546` — `process.exit` is monkey-patched in `beforeEach` as a safety net, but `cmdReport` never calls `process.exit` directly (it uses `deps.exit`), and e2e tests run in child processes. The patching is harmless but never exercised. Could be removed for clarity.

---

## Summary

| Criterion | Verdict | Evidence |
|-----------|---------|----------|
| Dead code | PASS | All imports, helpers, and exports consumed. Verified via grep. |
| Premature abstraction | PASS | `escapeCell` (1-liner), `stripAnsi` (2 callers), `buildReport` (42 test consumers). All earn their keep. |
| Unnecessary indirection | PASS | DI pattern serves 19 test cases. No passthrough wrappers. |
| Gold-plating | PASS | Every feature (--output md, path validation, ANSI strip, duration format) is spec-required or security-necessary. No speculative extensibility. |

**Overall: PASS**

The `report.mjs` module is 209 lines with zero dead code, no premature abstractions, and every feature traceable to a spec requirement or security concern. The dependency injection pattern is the most complex aspect, and it is fully justified by 19 test cases that depend on it. The module follows the established `bin/lib/<command>.mjs` convention used by every other CLI command in the project.

---

## Test Verification

```
$ node --test test/report.test.mjs
# 61 tests, 61 pass, 0 fail, 0 skip
# Duration: 287ms
```
