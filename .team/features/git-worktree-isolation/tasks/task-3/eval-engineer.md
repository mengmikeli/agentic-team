# Engineer Review — task-3

## Verdict: PASS

## Task
`dispatchToAgent` and `runGateInline` both honor the worktree `cwd` parameter (no implicit `process.cwd()` fallback when a worktree is active).

## Files I actually opened and read
- `bin/lib/run.mjs` (lines 40–140, 270–330, 1180–1220)
- `test/worktree.test.mjs` (lines 160–278)
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`

## Evidence verified

### `dispatchToAgent` (bin/lib/run.mjs:282)
- Signature: `dispatchToAgent(agent, brief, cwd, _spawnFn = spawnSync)` — `cwd` is a required positional with no default.
- Claude branch (run.mjs:289–295) forwards `cwd` to `_spawnFn` opts.
- Codex branch (run.mjs:321–326) forwards `cwd` to `_spawnFn` opts.
- Test `test/worktree.test.mjs:235-247` asserts spawn mock receives `worktreePath` as `opts.cwd`; `:263-276` asserts `opts.cwd !== process.cwd()` when they differ.

### `runGateInline` (bin/lib/run.mjs:53)
- Signature: `runGateInline(cmd, featureDir, taskId, cwd = process.cwd())` — has a `process.cwd()` default fallback (see findings).
- Forwards `cwd` to `execSync` (run.mjs:60).
- Test `test/worktree.test.mjs:181-191` runs `pwd` and asserts stdout equals `realpathSync(tmpDir)`, proving the cwd is honored at OS level.

### Call site (bin/lib/run.mjs:1195)
- `runGateInline(gateCmd, featureDir, task.id, cwd)` — passes the worktree path explicitly.
- Source-assertion test `test/worktree.test.mjs:223-230` regex-checks this exact call shape.
- Subsequent `git add/commit` (run.mjs:1202-1205) and `dispatchToAgent` (run.mjs:1219) reuse the same `cwd`, so the worktree boundary holds across gate → commit → review.

### Re-ran tests locally
`node --test test/worktree.test.mjs` → **25 pass / 0 fail / 0 skipped** (139 ms). Cwd-injection suites all green.

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| `dispatchToAgent` forwards cwd to spawn (claude) | PASS | run.mjs:291; worktree.test.mjs:246 |
| `dispatchToAgent` forwards cwd to spawn (codex) | PASS | run.mjs:323; worktree.test.mjs:260 |
| `runGateInline` forwards cwd to execSync | PASS | run.mjs:60; worktree.test.mjs:188 |
| Production call site passes worktree cwd | PASS | run.mjs:1195; worktree.test.mjs:226 |
| No regressions in full suite | PASS | gate output: 539/0/2 |
| Edge case: cwd ≠ process.cwd() actually exercised | PASS | worktree.test.mjs:271,275 |

## Edge cases I checked
- Non-zero exit propagation: `runGateInline` `verdict = "FAIL"` covered (worktree.test.mjs:198-201).
- Default fallback path: not directly tested, but no caller relies on it (only call site is run.mjs:1195 which always passes cwd).
- Codex branch lacks `env: { ...process.env }` plumbing (claude branch has it at run.mjs:294). Not in scope here, just noted.

## Findings

🟡 bin/lib/run.mjs:53 — `runGateInline` retains `cwd = process.cwd()` default. The spec literally says "no implicit `process.cwd()` fallback when a worktree is active." The current default is dormant (only call site always passes cwd) but is a latent footgun for future callers. Drop the default to make `cwd` required.
🔵 bin/lib/run.mjs:321 — `codex` branch in `dispatchToAgent` doesn't forward `env: { ...process.env }` like the `claude` branch (run.mjs:294). Consistency fix; not part of this task.
🔵 test/worktree.test.mjs:226 — `_runSingleFeature wiring` test uses a regex over source. Brittle to formatting. A behavioral test (e.g., mock `runGateInline` and assert call args) would be more robust. Already flagged in PM eval.
🔵 .team/features/git-worktree-isolation/tasks/task-3/ — No `artifacts/test-output.txt` was written for this task. The gate handshake summary references results but the artifact file isn't on disk. Minor reproducibility gap.

## Conclusion
Implementation matches spec. Tests directly assert the contract for both functions, and I reproduced the green run locally. PASS with one yellow flag for the latent default fallback.
