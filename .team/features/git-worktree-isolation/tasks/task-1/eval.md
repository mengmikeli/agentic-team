## Simplicity Review — git-worktree-isolation
**Task:** Agent dispatches pass `cwd: worktreePath` to `spawnSync`/`spawn`
**Verdict:** PASS

### Files Read
- `tasks/task-1/handshake.json`, `tasks/task-2/handshake.json`
- `tasks/task-2/eval.md`, `tasks/task-2/artifacts/test-output.txt`
- `bin/lib/run.mjs` (lines 145–350, 882–950, 1045–1180, 1450–1530)
- `test/worktree.test.mjs` (full, 236 lines)

### Claim Verification
**Claimed:** `dispatchToAgent` and `dispatchToAgentAsync` forward `cwd: worktreePath` to `spawnSync`/`spawn`.

Direct code trace:
- `dispatchToAgent(agent, brief, cwd, _spawnFn)` at `run.mjs:279` ✓
- Claude `spawnSync(..., { cwd, ... })` at `run.mjs:284` ✓
- Codex `spawnSync(..., { cwd, ... })` at `run.mjs:307` ✓
- `dispatchToAgentAsync` `spawn(..., { cwd, ... })` at `run.mjs:333` ✓
- Caller: `cwd = worktreePath` at `run.mjs:944`; passed to `dispatchToAgent(agent, brief, cwd)` at `run.mjs:1115` ✓
- Tests at `worktree.test.mjs:190–235`: mock `_spawnFn`, assert `opts.cwd === worktreePath` for claude and codex ✓
- Gate: npm test exit 0 ✓

Previous 🔴 status:
- `run.mjs:888` orphaned comment — FIXED (commit ef5290a) ✓
- `run.mjs:1055` `return "paused"` without cleanup — FIXED by `try/finally` at line 1472; JS `finally` executes before function return ✓

### Per-Criterion Results
- **Dead code**: No unused imports/vars introduced. `dispatchToAgent` import at test line 10 is used. PASS
- **Premature abstraction**: No new abstractions. `slugToBranch` (1 production call site) was prior-task scope. PASS
- **Unnecessary indirection**: `cwd` flows directly `worktreePath → cwd → dispatchToAgent arg → spawnSync option`. PASS
- **Gold-plating**: No config options, flags, or speculative extension points. PASS

### Findings

🟡 test/worktree.test.mjs:221 — "cwd is distinct from process.cwd()" test asserts a tautology: hardcoded `/worktrees/my-feature` will never equal `process.cwd()`; the only non-trivial assertion (`calls[0].opts.cwd === worktreePath`) is already covered by the test at line 193; remove this test
🟡 test/worktree.test.mjs:176 — `describe("slugToBranch normalization")` never calls `createWorktreeIfNeeded`; both tests (lines 177–187) call `slugToBranch` directly, duplicating the `describe("slugToBranch")` suite at line 14; remove or replace with a `createWorktreeIfNeeded` mock-based test
🔵 test/worktree.test.mjs:158 — `tmpDir.split("/").pop()` checks only the last path segment; use `assert.equal(result.stdout.trim(), tmpDir)` for a stronger assertion
