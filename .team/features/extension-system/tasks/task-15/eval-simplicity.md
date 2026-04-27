# Simplicity Review — Extension System

**Reviewer**: Simplicity Advocate
**Verdict**: **PASS**
**Feature**: `bin/lib/extensions.mjs` — loadExtensions, callHook, mergePromptAppend, mergeVerdictAppend, runExecuteRun, runArtifactEmit

---

## Files Actually Read

| File | Lines |
|---|---|
| `bin/lib/extensions.mjs` | 1–330 (full) |
| `test/extension-system.test.mjs` | 1–2079 (full) |
| `examples/extensions/log-phases.mjs` | 1–35 (full) |
| `bin/lib/run.mjs` | 26, 360–390, 910–940, 1090–1270, 1280–1440 |
| `bin/lib/doctor.mjs` | 210–280 (extensions check) |
| `.team/features/.../task-15/handshake.json` | 1–21 (full) |

---

## Veto Category Assessment

### 1. Dead Code — CLEAR

All six exported functions are used:
- `loadExtensions` — called at `run.mjs:916`
- `callHook` — used internally by `mergePromptAppend`, `mergeVerdictAppend`, `runArtifactEmit`; directly tested in `extension-system.test.mjs`; part of the spec's required public API
- `mergePromptAppend` — called at `run.mjs:371`, `run.mjs:1097`, `run.mjs:1177`, `run.mjs:1254`
- `mergeVerdictAppend` — called at `run.mjs:1295`, `run.mjs:1387`
- `runExecuteRun` — called at `run.mjs:1217`
- `runArtifactEmit` — called at `run.mjs:1321`, `run.mjs:1408`

All 8 constants are consumed. All 2 helper functions (`validateContext`, `trackFailure`) are called from >=2 sites. No unused imports. No commented-out code. No unreachable branches.

### 2. Premature Abstraction — CLEAR

| Abstraction | Production call sites | Assessment |
|---|---|---|
| `callHook` | 3 (mergePromptAppend, mergeVerdictAppend, runArtifactEmit) | Justified — common iteration + timeout + circuit-breaker |
| `validateContext` | 2 (callHook, runExecuteRun) | Justified — DRY enforcement of required context fields |
| `trackFailure` | 2 (callHook, runExecuteRun) | Justified — consistent circuit-breaker behavior |
| `mergePromptAppend` | 4 call sites in run.mjs | Justified — non-trivial string filtering + truncation |
| `mergeVerdictAppend` | 2 call sites in run.mjs | Justified — array flattening + validation |
| `runArtifactEmit` | 2 call sites in run.mjs | Justified — file writing + path sanitization |

No interface with a single implementation. No abstraction with fewer than 2 call sites.

### 3. Unnecessary Indirection — CLEAR

Every wrapper function adds meaningful transformation beyond delegation:

- `mergePromptAppend` = callHook + string type filtering + per-extension truncation (4096) + total truncation (16384) + join
- `mergeVerdictAppend` = callHook + array flattening + `{severity, text}` schema validation
- `runExecuteRun` = hook invocation + spawnSync + artifact writing + required/non-required exit-code handling
- `runArtifactEmit` = callHook + path sanitization via basename + containment check + file writing + descriptor collection

None are pure pass-throughs or re-exports.

### 4. Gold-plating — CLEAR

- No config options that could be hardcoded — the two timeout constants (`DEFAULT_TIMEOUT_MS = 5000`, `EXECUTE_RUN_TIMEOUT_MS = 30000`) are used directly, not exposed as config
- The `opts.timeoutMs` parameter exists in `callHook` and `runExecuteRun` for testability (tests use 50ms timeouts to avoid 5-second waits); this is pragmatic, not speculative
- `desc.cwd` in `runExecuteRun` (line 234) is a one-liner that allows extensions to specify a working directory. Tested once. The cost is `const spawnCwd = desc.cwd || ctx.cwd;` — zero complexity
- No feature flags. No plugin architecture beyond what the task specified. No unused extensibility hooks

---

## Complexity Assessment

The implementation is a single 330-line file with a clean layered architecture:

```
loadExtensions()  →  registry { extensions[] }
                         ↓
callHook()        →  iterate, timeout, circuit-break
                         ↓
merge*/run*       →  domain-specific transformation
```

**Cognitive load**: Low. You need to understand one pattern (iterate extensions, race with timeout, track failures) to understand the whole file. The four public merge/run functions are independent — understanding one doesn't require understanding the others.

**Deletability**: High. The entire file can be deleted and run.mjs would only need to remove the import + ~15 lines of integration code per call site. The registry is a plain object with no global state.

---

## Findings

🔵 `bin/lib/extensions.mjs:218-230` — The timeout/race/circuit-breaker pattern in `runExecuteRun` duplicates `callHook:124-138`. The comment at line 197 explains why ("correct name attribution"), and the justification is valid — `callHook` aggregates results, losing per-extension identity needed for artifact naming. Factoring this out would introduce yet another abstraction. Current duplication is ~15 lines. Acceptable trade-off.

🔵 `bin/lib/extensions.mjs:55` — The registry shape `{ extensions: [] }` wraps a single array in an object. Marginal cost, and provides a clean namespace boundary for future metadata. Not worth changing.

---

## Edge Cases Checked

- **Empty extensions dir**: Tested (test line 86), returns `{ extensions: [] }`, no warnings
- **Missing extensions dir**: Tested (test line 76), returns `{ extensions: [] }`, no warnings
- **Syntax error in extension**: Tested (test line 128), skips broken, loads others, warns
- **Hook timeout**: Tested (test line 342), skips result, increments circuit-breaker
- **Circuit breaker**: Tested (test line 377), disables after 3 consecutive failures, cross-hook
- **Path traversal**: Tested (test line 1741), sanitized via basename + containment check
- **Oversized output**: Tested (test line 848), truncated at 4096 per extension + 16384 total
- **Required command failure**: Tested (test line 1141), returns `{ failed: true }` with attribution
- **Non-required command failure**: Tested (test line 1176), returns `{ failed: false }`
- **Null/undefined hook returns**: Tested (test line 426), filtered out

---

## Verdict

**PASS** — No critical findings. The implementation is appropriately simple for what it does: a hook system with timeout protection, circuit-breaking, and safe artifact writing. No dead code, no premature abstractions, no unnecessary indirection, no gold-plating. The two blue suggestions are genuine micro-observations, not actionable improvements.
