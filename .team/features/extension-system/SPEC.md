# Feature: Extension System

## Goal
Allow users to inject custom logic into the execution pipeline via capability-routed hook files that are dynamically loaded, sandboxed with timeouts, and protected by circuit breakers so extension failures never crash the main loop.

## Requirements

- Extensions are `.mjs` files that export named async hook functions
- Four hook types supported: `promptAppend`, `verdictAppend`, `executeRun`, `artifactEmit`
- Extensions are auto-loaded from `.team/extensions/` (project-local) and `~/.agt/extensions/` (user-global) at run start
- `AGT_EXTENSIONS_DIR` env var can override or supplement the search dirs
- Each hook invocation is wrapped in a per-call timeout (default 30s, configurable via `AGT_EXTENSION_TIMEOUT`)
- Circuit breaker per extension: 3 consecutive failures → extension is disabled for the remainder of the run; failure is logged to `progress.md`
- Extension errors are isolated — they never propagate exceptions to the caller; callers receive a no-op fallback (empty string / empty array)
- Multiple extensions can register the same hook; results are merged in load order (strings concatenated, arrays unioned)
- Extensions are loaded once at startup and cached; no hot-reload during a run
- The loader emits a single log line per loaded extension (name, version, hooks registered)
- No new CLI commands required for this feature

## Acceptance Criteria

- [ ] An extension placed in `.team/extensions/my-ext.mjs` is auto-loaded when `agt run` starts
- [ ] `promptAppend` return value is appended to task briefs and review briefs
- [ ] `verdictAppend` return value (array of findings) is merged into synthesized findings before verdict computation
- [ ] `executeRun` return value (`{ stdout, exitCode }`) is captured as additional gate evidence in the task artifacts
- [ ] `artifactEmit` return value (array of `{ path, content }`) is written to `tasks/{taskId}/artifacts/` on task completion
- [ ] A hook that takes longer than the timeout is aborted and logged as a failure (no exception propagates)
- [ ] After 3 consecutive failures, the extension is skipped for all subsequent hook calls in the run
- [ ] An extension with a syntax error or missing exports is skipped at load time with a warning; other extensions continue loading
- [ ] All four hook types are exercised by at least one unit test with a mock extension
- [ ] Circuit breaker behavior is verified by a unit test that injects 3 consecutive failures and asserts the extension is disabled

## Technical Approach

### New module: `bin/lib/extensions.mjs`

Central loader and dispatcher:

```
loadExtensions(dirs: string[]) → ExtensionRegistry
  - Glob *.mjs from each dir
  - Dynamic import() each file
  - Validate exports (name, version, optional hook functions)
  - Register to internal map: hookType → [{ name, fn, failCount }]
  - Log loaded extensions to stdout

applyHook(registry, hookType, context) → Promise<merged result>
  - For each registered handler:
      - If failCount >= 3, skip
      - Call fn(context) with AbortSignal timeout
      - On success: reset failCount, accumulate result
      - On error/timeout: failCount++, log to progress.md, return no-op value
  - Return merged results (strings joined by \n\n, arrays concatenated)
```

### Extension interface (what a `.mjs` file exports)

```javascript
export const name = "my-extension";       // required
export const version = "1.0.0";           // required

// All hooks optional:
export async function promptAppend({ phase, taskTitle, featureName, cwd }) → string
export async function verdictAppend({ phase, taskId, gateOutput, existingFindings, cwd }) → Finding[]
export async function executeRun({ phase, taskId, cwd, spec }) → { stdout: string, exitCode: number }
export async function artifactEmit({ phase, taskId, cwd, verdict }) → { path: string, content: string }[]
```

### Injection points

| Hook | Where | Change |
|---|---|---|
| `promptAppend` | `run.mjs` `buildTaskBrief()` + `flows.mjs` `buildReviewBrief()` | Append `await applyHook(reg, 'promptAppend', ctx)` to returned string |
| `verdictAppend` | `synthesize.mjs` after parsing findings | Merge `await applyHook(reg, 'verdictAppend', ctx)` into findings array before verdict computation |
| `executeRun` | `run.mjs` `runGateInline()` after primary gate command | Collect results, write to `tasks/{id}/artifacts/ext-{name}-output.txt`, fold exit code into overall verdict |
| `artifactEmit` | `run.mjs` after task reaches terminal state (passed/failed) | Write each `{ path, content }` to `tasks/{id}/artifacts/{path}` |

### Registry lifecycle

- Created once in `run.mjs` `_runSingleFeature()` before the task loop
- Passed as parameter through `runGateInline`, `buildTaskBrief`, and review dispatch calls
- If no extensions loaded, all `applyHook` calls are no-ops with zero overhead

### Circuit breaker

- In-memory per-run, keyed by extension `name`
- `failCount` integer; threshold 3 (constant `EXTENSION_CIRCUIT_OPEN_THRESHOLD`)
- First open triggers one `progress.md` append: `[extension-disabled] ${name} after ${n} failures`

## Testing Strategy

**Unit tests** (`test/extensions.test.mjs`):
- `loadExtensions` skips files with missing `name`/`version`
- `loadExtensions` isolates syntax-error files and continues loading others
- `applyHook promptAppend` concatenates output from two mock extensions
- `applyHook verdictAppend` merges findings from two extensions
- `applyHook executeRun` returns combined stdout/exitCode
- `applyHook artifactEmit` returns merged artifact list
- Timeout enforcement: mock fn that never resolves → aborted after timeout; no exception propagated
- Circuit breaker: 3 injected failures → extension skipped on 4th call; success resets count

**Integration check** (manual or `test/extensions.integration.test.mjs`):
- Place a `test-ext.mjs` in `.team/extensions/` that appends a sentinel string to `promptAppend`
- Run a single-task feature in dry-run mode
- Assert sentinel appears in the task brief captured in progress artifacts

## Out of Scope

- Hot-reload of extensions during a run
- Extension marketplace or registry
- `agt extension install/remove/list` CLI commands
- Cross-process isolation (extensions run in-process, sandboxed only via timeout + error catch)
- TypeScript type declarations for the extension interface
- Extension dependencies (npm packages) — extensions must be self-contained
- UI for managing extensions in the dashboard
- Extension signing or trust verification

## Done When

- [ ] `bin/lib/extensions.mjs` exists with `loadExtensions` and `applyHook` exports
- [ ] All four hook types are wired into their injection points in `run.mjs`, `flows.mjs`, and `synthesize.mjs`
- [ ] Extensions auto-load from `.team/extensions/` and `~/.agt/extensions/`
- [ ] Timeout enforcement works (verified by test with a never-resolving mock)
- [ ] Circuit breaker disables an extension after 3 failures (verified by unit test)
- [ ] A bad extension (syntax error, missing exports) does not prevent other extensions from loading
- [ ] Unit tests pass (`npm test` green)
- [ ] At least one example extension placed in `.team/extensions/example-ext.mjs` demonstrating all four hooks
