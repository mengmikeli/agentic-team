# Feature: Extension System

## Goal
Allow users to augment pipeline behavior by dropping JavaScript modules into `.team/extensions/`, with four capability-routed hooks protected by timeouts and circuit breakers so extensions can never block or crash a run.

## Requirements

- Load all `*.mjs` files from `.team/extensions/` at run start, resolving both project-level (`.team/extensions/`) and global (`~/.agentic-team/extensions/`) directories; project-level takes precedence on name collision
- Support four hook types as named exports: `promptAppend`, `verdictAppend`, `executeRun`, `artifactEmit`
- **`promptAppend(ctx)`** — called before each agent dispatch; return value (string) is appended to the brief
- **`verdictAppend(ctx)`** — called after verdict computation; return value (findings array) is merged into the verdict's findings
- **`executeRun(ctx)`** — called after task agent dispatch and before gate; return value specifies a shell command to run (`{ command, cwd?, required? }`); stdout/stderr captured as a `cli-output` artifact
- **`artifactEmit(ctx)`** — called after task completes; return value (artifact descriptors array) are written to the task artifacts directory
- Each hook invocation is wrapped in a configurable timeout (default 5 s for prompt/verdict/artifact, 30 s for executeRun); timeout = skip that extension for this invocation + log warning
- Circuit breaker: after 3 consecutive hook failures per extension, disable that extension for the remainder of the run and log a banner
- Extensions are entirely optional — missing `.team/extensions/` dir or zero extension files is a no-op
- Load errors (syntax, bad module shape, missing file) are caught at load time; the run continues with a warning; the offending extension is excluded
- Extension hook errors at invocation time do not propagate to the pipeline; they count toward the circuit breaker

## Acceptance Criteria

- [ ] `promptAppend` return string is appended to the agent brief before `dispatchToAgent()`
- [ ] `verdictAppend` findings are merged into `computeVerdict()` output before compound gate runs
- [ ] `executeRun` spawns the returned command in task `cwd`; stdout/stderr are stored as a `cli-output` artifact; non-zero exit with `required: true` causes task FAIL
- [ ] `artifactEmit` returned artifact descriptors are written to the task artifact directory and included in the handshake
- [ ] Hook calls exceeding the timeout are skipped; pipeline proceeds normally; a `[ext warn]` line is logged
- [ ] An extension with 3 consecutive failures is circuit-broken; subsequent invocations are skipped without calling the function
- [ ] Missing `.team/extensions/` directory produces no error and no behavior change
- [ ] An extension with a syntax error or missing named export is skipped at load time with a warning; other extensions still load
- [ ] All hook contexts include: `phase`, `taskId`, `featureName`, `cwd`
- [ ] `promptAppend` context additionally includes: `brief` (current brief string), `role` (reviewer role if review phase)
- [ ] `verdictAppend` context additionally includes: `verdict`, `findings` (current findings array)
- [ ] `executeRun` context additionally includes: `taskTitle`, `phase`
- [ ] `artifactEmit` context additionally includes: `taskDir`, `verdict`
- [ ] Extensions directory is loaded once per `_runSingleFeature` call (not re-read per hook invocation)

## Technical Approach

**New file: `bin/lib/extensions.mjs`**

```
loadExtensions(teamDir)
  → scans .team/extensions/*.mjs + ~/.agentic-team/extensions/*.mjs
  → dynamic import() each, catch load errors
  → returns ExtensionRegistry

callHook(registry, hookName, ctx, opts?)
  → for each enabled extension that exports hookName
  → Promise.race([ext[hookName](ctx), timeout(opts.timeoutMs)])
  → on throw/timeout: increment failures, check circuit breaker
  → return array of results (one per extension that succeeded)

mergePromptAppend(registry, ctx)      → calls callHook, joins strings
mergeVerdictAppend(registry, ctx)     → calls callHook, flattens findings arrays
runExecuteRun(registry, ctx)          → calls callHook, spawns commands sequentially
runArtifactEmit(registry, ctx)        → calls callHook, writes descriptors to disk
```

**ExtensionRegistry shape:**
```js
{
  extensions: [
    {
      name: string,          // filename without .mjs
      path: string,          // absolute path
      hooks: {               // only hooks that are exported functions
        promptAppend?,
        verdictAppend?,
        executeRun?,
        artifactEmit?
      },
      consecutiveFailures: number,
      disabled: boolean
    }
  ]
}
```

**Dispatch points (files modified):**
- `bin/lib/run.mjs` — call `loadExtensions()` at start of `_runSingleFeature()`, pass registry to dispatch helpers; call `runExecuteRun()` after implement phase, `runArtifactEmit()` after task transitions to passed/failed
- `bin/lib/flows.mjs` — call `mergePromptAppend()` inside `buildBrief()`, `buildReviewBrief()`, `buildBrainstormBrief()` before returning the brief string
- `bin/lib/synthesize.mjs` — call `mergeVerdictAppend()` inside `computeVerdict()`, appending to findings before severity counting

**Timeout implementation:** `Promise.race([fn(ctx), new Promise((_, rej) => setTimeout(() => rej(new Error('ext timeout')), ms))])`

**Circuit breaker:** track `consecutiveFailures` per extension; on success reset to 0; on failure increment; at 3 disable extension (set `disabled: true`, log banner).

**Shell execution for `executeRun`:** `spawnSync(cmd, { shell: true, cwd, timeout: 30000 })`; result written to `{taskDir}/artifacts/ext-{name}-run.txt`.

## Testing Strategy

- **Unit tests** (`test/extensions.test.mjs`):
  - `loadExtensions` returns empty registry for missing dir
  - `loadExtensions` skips malformed module (bad syntax, no export)
  - `promptAppend` result is appended to brief
  - `verdictAppend` findings are merged
  - `executeRun` runs command, captures output, writes artifact
  - `artifactEmit` writes descriptors to disk
  - Timeout: mock hook that stalls; assert skip + warning
  - Circuit breaker: mock hook that always throws; assert disabled after 3 failures; assert 4th call is skipped without invoking hook
  - Multiple extensions: results from all are merged

- **Integration smoke test**: place a fixture extension in a temp `.team/extensions/` dir that appends a known sentinel string; run `_runSingleFeature` against a stub; assert sentinel appears in the captured dispatch brief.

- **Manual verification**: drop an example extension into `.team/extensions/` in the project and run `agt run` on a feature; confirm hook output appears in logs.

## Out of Scope

- VM isolation or `worker_threads` sandboxing (same-process with timeout is sufficient for v1)
- Extension configuration files (no per-extension config in v1)
- TypeScript type definitions for the extension API
- Ordering/priority controls between multiple extensions (load order = glob order)
- Extension marketplace, versioning, or dependency management
- `executeRun` returning multiple commands per invocation (one command per extension per task)
- Extensions modifying STATE.json directly
- Hot-reloading extensions mid-run

## Done When

- [ ] `bin/lib/extensions.mjs` exists with `loadExtensions`, `callHook`, and the four merge/run helpers
- [ ] `run.mjs` loads extensions at `_runSingleFeature` entry and passes registry through to dispatch helpers
- [ ] `flows.mjs` calls `mergePromptAppend` before returning any brief string
- [ ] `synthesize.mjs` calls `mergeVerdictAppend` before returning verdict
- [ ] All four hook types have at least one passing unit test
- [ ] Timeout enforcement has a passing unit test using a stalling mock hook
- [ ] Circuit breaker has a passing unit test (disable after 3 consecutive failures)
- [ ] A working example extension exists at `examples/extensions/log-phases.mjs` demonstrating all four hooks
- [ ] `agt doctor` reports loaded extension count (0 if none)
- [ ] `test/extensions.test.mjs` passes with `node --test`
