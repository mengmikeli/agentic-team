# Product Manager Evaluation — task-17

## Task
`flows.mjs` calls `mergePromptAppend` before returning any brief string

## Overall Verdict: PASS

## Files Actually Read
- `.team/features/extension-system/SPEC.md` (full, 147 lines)
- `.team/features/extension-system/tasks/task-17/handshake.json` (full)
- `.team/features/extension-system/tasks/task-17/artifacts/test-output.txt` (full, 1027 lines)
- `bin/lib/flows.mjs` (worktree, full, 224 lines)
- `bin/lib/extensions.mjs` (worktree, full, 335 lines)
- `bin/lib/run.mjs` (worktree, grep for integration call sites)
- `test/extension-system.test.mjs` (worktree, full, 2359 lines)
- `test/flows.test.mjs` (worktree, grep for extension integration tests)
- `examples/extensions/log-phases.mjs` (worktree, full, 36 lines)

## Spec Alignment

### "Done When" Criterion Under Review
> `flows.mjs` calls `mergePromptAppend` before returning any brief string

### Evidence of Compliance

**Both brief-producing functions in flows.mjs call `mergePromptAppend` before returning:**

1. `buildBrainstormBrief` (line 66): Now `async`. Lines 84-89 call `mergePromptAppend(registry, { phase: "brainstorm", taskId, featureName, cwd, brief, role: null })` and append the result. The call is guarded by `if (registry)` for backward compatibility.

2. `buildReviewBrief` (line 94): Now `async`. Lines 166-171 call `mergePromptAppend(registry, { phase: "review", taskId, featureName, cwd, brief, role })` and append the result. Same guard pattern.

There are no other brief-returning functions in flows.mjs, so "before returning **any** brief string" is satisfied.

### Acceptance Criteria Trace

| AC | Status | Evidence |
|---|---|---|
| `promptAppend` appended to agent brief before dispatch — for brainstorm, build, and review phases | PASS | brainstorm: flows.mjs:85, review: flows.mjs:167, build: run.mjs:1169 |
| `promptAppend` context includes `brief`, `role` | PASS | flows.mjs:86 and :168 both pass `brief` and `role` |
| `promptAppend` context includes `phase`, `taskId`, `featureName`, `cwd` | PASS | All four base fields present at both call sites |
| Registry built once per `_runSingleFeature()` | PASS | run.mjs:912 calls `loadExtensions(teamDir)` once; registry threaded to all call sites |

### Backward Compatibility

The functions changed from sync to async, which is a breaking API change. However:
- All callers in `run.mjs` properly `await` them (lines 1092, 1245, 370)
- The `registry` parameter is optional — omitting it produces identical pre-extension behavior
- Tests verify the no-registry path: `buildBrainstormBrief("feat", "desc", "/cwd")` returns the base brief

### User Value Assessment

The extension system's prompt-append integration delivers clear user value:
- Extension authors can inject context into brainstorm, build, and review briefs with a single `promptAppend` hook
- The integration is non-intrusive — zero overhead when no extensions exist
- Truncation limits (4KB per extension, 16KB total) prevent extensions from overwhelming the brief

### Test Evidence

Full suite: **694 tests, 0 fail, 2 skipped** (test-output.txt:1019-1024)

Directly relevant passing tests:
- `buildBrainstormBrief — extension integration` (3 tests): append works, empty registry no-op, missing registry no-op
- `buildReviewBrief — extension integration` (2 tests): append works, empty registry no-op
- `_runSingleFeature extension wiring (source assertions)` (11 tests): verifies registry threading through run.mjs to flows.mjs

## Findings

🟡 examples/extensions/log-phases.mjs:22 — Shell injection in example code: `ctx.taskTitle` (LLM-generated) is interpolated into an `echo` command. Users copying this example will inherit the risk. File as backlog item with fix: use `JSON.stringify()` for the interpolation.

🔵 bin/lib/flows.mjs:86 — The `taskId` sentinel value for brainstorm phase is `null` (via `taskId ?? null`). This convention is undocumented in SPEC.md's hook context table but is tested (`callHook accepts taskId: null`). Consider documenting in extension API docs when they're created.

## Scope Check

No scope creep detected. The implementation is tightly scoped to the spec's requirements:
- No new hooks were added beyond the four specified
- No configuration surface was introduced beyond what the spec defines
- The `contextBrief` parameter addition to `buildReviewBrief` is an orthogonal concern that was needed for correct ordering (extensions should see the full brief including spec/progress context)

## Verdict: PASS

The implementation matches the spec criterion exactly. Both brief-producing functions in flows.mjs call `mergePromptAppend` before returning. The integration is backward-compatible, well-tested, and delivers the expected user value for extension authors.
