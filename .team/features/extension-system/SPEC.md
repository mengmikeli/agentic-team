# Feature: Extension System

## Goal
Allow users to augment pipeline behavior by dropping `.mjs` modules into `.team/extensions/`, with four capability-routed hooks protected by timeouts and circuit breakers so extensions can never block or crash a run.

## Requirements

- Load `*.mjs` files from two directories: `.team/extensions/` (project-level) and `~/.agentic-team/extensions/` (global); project-level wins on name collision
- Support four hook types as named exports from each extension module:
  - **`promptAppend(ctx)`** — called before each agent dispatch; returns a string appended to the brief
  - **`verdictAppend(ctx)`** — called after `computeVerdict()`; returns a findings array merged into the verdict
  - **`executeRun(ctx)`** — called after task build dispatch, before gate; returns `{ command, cwd?, required? }` to spawn; stdout/stderr captured as `cli-output` artifact
  - **`artifactEmit(ctx)`** — called after task completion; returns artifact descriptor array written to the task artifacts directory
- Each hook invocation is wrapped in a configurable timeout (default 5 s; 30 s for `executeRun`); timeout skips that extension for the invocation and logs `[ext warn]`
- Circuit breaker: 3 consecutive failures per extension disables it for the remainder of the run with a banner log
- Entirely optional — missing directories or zero extension files is a no-op with zero overhead
- Load errors (syntax, missing file, bad module shape) are caught at load time; the offending extension is excluded; other extensions still load
- Runtime hook errors do not propagate to the pipeline; they count toward the circuit breaker

## Acceptance Criteria

- [ ] `promptAppend` return value is appended to the agent brief before `dispatchToAgent()` — for brainstorm, build, and review phases
- [ ] `verdictAppend` findings are merged into `computeVerdict()` output before the compound gate runs
- [ ] `executeRun` spawns the returned command in the task's `cwd`; stdout/stderr stored as `{taskDir}/artifacts/ext-{name}-run.txt`; non-zero exit with `required: true` causes task FAIL
- [ ] `artifactEmit` returned descriptors are written to the task artifact directory and listed in the handshake
- [ ] Hook calls exceeding timeout are skipped; pipeline proceeds; `[ext warn]` is logged to stderr
- [ ] An extension with 3 consecutive failures is circuit-broken; subsequent calls are skipped without invoking the function
- [ ] Missing `.team/extensions/` directory produces no error and no behavior change
- [ ] An extension with a syntax error or missing named export loads partially (only valid hooks registered); other extensions unaffected
- [ ] All hook contexts include: `phase`, `taskId`, `featureName`, `cwd`
- [ ] `promptAppend` context additionally includes: `brief` (current string), `role` (reviewer role, if review phase)
- [ ] `verdictAppend` context additionally includes: `verdict` (string), `findings` (current array)
- [ ] `executeRun` context additionally includes: `taskTitle`
- [ ] `artifactEmit` context additionally includes: `taskDir`, `verdict`
- [ ] Registry is built once per `_runSingleFeature()` call, not re-scanned per hook invocation

## Technical Approach

### New file: `bin/lib/extensions.mjs`

Exports:

| Function | Purpose |
|---|---|
| `loadExtensions(teamDir)` | Scan `.team/extensions/*.mjs` + `~/.agentic-team/extensions/*.mjs`; `import()` each; catch errors; return `ExtensionRegistry` |
| `callHook(registry, hookName, ctx, opts)` | For each enabled extension exporting `hookName`: `Promise.race([fn(ctx), timeout])`. On throw/timeout: increment `consecutiveFailures`, check circuit breaker (3 = disable). On success: reset failures to 0. Return array of successful results. |
| `mergePromptAppend(registry, ctx)` | Call `callHook('promptAppend', ...)`, join non-empty strings with `\n` |
| `mergeVerdictAppend(registry, ctx)` | Call `callHook('verdictAppend', ...)`, `flat()` the findings arrays |
| `runExecuteRun(registry, ctx)` | Call `callHook('executeRun', ...)`, `spawnSync` each returned command sequentially. Write output to `{taskDir}/artifacts/ext-{name}-run.txt`. If `required: true` and non-zero exit, return `{ failed: true }`. |
| `runArtifactEmit(registry, ctx)` | Call `callHook('artifactEmit', ...)`, write each descriptor to disk |

**ExtensionRegistry shape:**
```js
{
  extensions: [
    {
      name,              // filename without .mjs
      path,              // absolute path
      hooks: {           // only hooks that are exported functions
        promptAppend?,
        verdictAppend?,
        executeRun?,
        artifactEmit?
      },
      consecutiveFailures: 0,
      disabled: false
    }
  ]
}
```

### Integration points (files modified)

**`bin/lib/run.mjs`:**
- Line ~781 (`_runSingleFeature` entry): call `loadExtensions(teamDir)` to build registry
- Pass `registry` to brief-building and dispatch helpers
- After build dispatch, before `runGateInline()`: call `runExecuteRun(registry, ctx)`
- After task transitions to passed/failed: call `runArtifactEmit(registry, ctx)`

**`bin/lib/flows.mjs`:**
- `buildBrainstormBrief()` (line 65): append `mergePromptAppend()` result before return
- `buildReviewBrief()` (line 84): append `mergePromptAppend()` result before return

**`bin/lib/run.mjs` (also):**
- `buildTaskBrief()` (line 440): append `mergePromptAppend()` result before return

**`bin/lib/synthesize.mjs`:**
- `computeVerdict()` (line 40): after computing findings, call `mergeVerdictAppend()` and concat results into findings before severity counting

### Timeout implementation
```js
Promise.race([
  fn(ctx),
  new Promise((_, rej) => setTimeout(() => rej(new Error('ext timeout')), ms))
])
```

### Shell execution for `executeRun`
```js
spawnSync(command, { shell: true, cwd: ctx.cwd, timeout: 30_000 })
```

## Testing Strategy

**Unit tests** (`test/extension-system.test.mjs` using `node:test`):

1. `loadExtensions` — returns empty registry when dir missing
2. `loadExtensions` — skips malformed module (syntax error, no valid exports)
3. `loadExtensions` — loads valid extension and registers only exported hooks
4. `loadExtensions` — project-level wins over global on name collision
5. `mergePromptAppend` — appends returned strings to brief
6. `mergeVerdictAppend` — merges returned findings into verdict
7. `runExecuteRun` — spawns command, captures output, writes artifact file
8. `runExecuteRun` — `required: true` + non-zero exit returns `{ failed: true }`
9. `runArtifactEmit` — writes descriptors to task artifacts directory
10. Timeout — mock hook that never resolves; assert skip + `[ext warn]` logged
11. Circuit breaker — mock hook that always throws; assert disabled after 3 calls; assert 4th call skipped without invocation
12. Multiple extensions — results from all enabled extensions are merged

**Integration smoke test**: fixture extension in a temp `.team/extensions/` dir that appends a sentinel string; assert sentinel appears in the brief passed to `dispatchToAgent`.

## Out of Scope

- VM isolation or `worker_threads` sandboxing (same-process timeout is sufficient for v1)
- Per-extension configuration files
- TypeScript type definitions for the extension API
- Ordering/priority controls between extensions (load order = filesystem glob order)
- Extension marketplace, versioning, or dependency management
- `executeRun` returning multiple commands per invocation
- Extensions modifying STATE.json directly
- Hot-reloading extensions mid-run
- `agt doctor` reporting extension count (deferred to a follow-up)

## Done When

- [ ] `bin/lib/extensions.mjs` exists with `loadExtensions`, `callHook`, `mergePromptAppend`, `mergeVerdictAppend`, `runExecuteRun`, `runArtifactEmit`
- [ ] `run.mjs` calls `loadExtensions()` at `_runSingleFeature` entry and threads the registry through to dispatch helpers
- [ ] `flows.mjs` calls `mergePromptAppend` before returning any brief string
- [ ] `run.mjs:buildTaskBrief` calls `mergePromptAppend` before returning
- [ ] `synthesize.mjs` calls `mergeVerdictAppend` before returning verdict
- [ ] All four hook types have at least one passing unit test
- [ ] Timeout enforcement has a passing unit test
- [ ] Circuit breaker has a passing unit test (disable after 3 consecutive failures)
- [ ] `test/extension-system.test.mjs` passes with `node --test`
- [ ] Existing test suite (`npm test`) still passes with no regressions
- [ ] A working example extension exists at `examples/extensions/log-phases.mjs` demonstrating all four hooks
