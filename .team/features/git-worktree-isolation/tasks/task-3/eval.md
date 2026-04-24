## Parallel Review Findings

[architect] **No 🔴 critical findings.** The core implementation is correct: `runGateInline` at `:52` accepts `cwd`, `execSync` at `:58` uses it, worktree path is assigned at `:948`, and passed at `:1148`. Tests verify both behavioral (`pwd` execution in a real tempdir) and structural (source regex asserting the call site shape) properties. All tests pass. The prior 🔴 (`completed`/`blocked`/`startTime` scoping) is confirmed fixed at lines 942–945.
[product] | Attempt-1 🔴 block-scope ReferenceError | `run.mjs:943–945` — declarations hoisted before `try {}` | Fixed ✓ |
🟡 [architect] `bin/lib/gate.mjs:59` — `cmdGate` hardcodes `cwd: process.cwd()`; `agt-harness gate` CLI invocations will not get worktree isolation — document the divergence or accept an injected path via `--cwd` flag
🟡 [architect] `bin/lib/run.mjs:747` — `let cwd = mainCwd` is silently reassigned to `worktreePath` at line 948; rename at point of reassignment to a distinct variable (`execCwd`) to make the semantic shift explicit across ~500 lines of scope
🟡 [architect] `bin/lib/run.mjs:52` — `cwd = process.cwd()` default on the exported `runGateInline` is a silent footgun; any future call site omitting the 4th arg runs the gate in the main repo without warning — remove the default to require explicit passing
🟡 [engineer] `test/worktree.test.mjs:222` — Source assertion checks only that the variable named `cwd` appears as the 4th arg; removing `cwd = worktreePath` at `run.mjs:948` (so `cwd` reverts to `mainCwd`) still passes the regex — backlog a spy-based test on `_runSingleFeature` asserting the actual path value
🟡 [engineer] `bin/lib/run.mjs:52` — `cwd = process.cwd()` default on exported `runGateInline` is a silent footgun for any future caller that omits the 4th arg — remove the default to require explicit passing
🟡 [engineer] `bin/lib/gate.mjs:59` — `cmdGate` hardcodes `cwd: process.cwd()` while `runGateInline` accepts an injected path; undocumented API divergence will mislead future maintainers — add a comment marking `cmdGate` as not worktree-aware
🟡 [product] `bin/lib/run.mjs:52` — `cwd = process.cwd()` default on `runGateInline`; any future call site omitting the 4th arg silently runs the gate against the main repo — remove default to require explicit passing
🟡 [product] `bin/lib/run.mjs:948` — `cwd` variable reused for two semantically different directories; rename the reassignment to a separate variable (`execCwd`) to protect against future accidental reassignment between lines 948–1148
🟡 [product] `test/worktree.test.mjs:204` — `describe("slugToBranch normalization")` duplicates `describe("slugToBranch")` at line 14; both tests call `slugToBranch` directly — delete or replace with a genuine `createWorktreeIfNeeded` integration test
🟡 [product] `bin/lib/gate.mjs:59` — `cwd: process.cwd()` hardcoded in legacy harness gate runner; diverges silently from `runGateInline`'s worktree-aware API — document the divergence or add a `cwd` parameter for consistency
🟡 [product] `bin/lib/run.mjs:161` — raw `slug` used in `path.join` for worktree path; `path.join` resolves `..` segments, allowing path traversal out of `.team/worktrees/` — add a `startsWith` bounds check after construction
🟡 [tester] `bin/lib/run.mjs:66` — Signal kill path (`err.signal`, fires on 120s timeout) has no test; a verdict regression here would be silent
🟡 [tester] `test/worktree.test.mjs:226` — Source-regex assertion is a brittle proxy: reformatting run.mjs breaks it without behavioral change; a wrong `cwd` value passes it since it only checks the variable name
🟡 [tester] `bin/lib/run.mjs:82` — Artifact writing path (lines 82–112) is never exercised; all tests pass `taskId = null`, skipping the entire handshake creation block
🟡 [tester] `bin/lib/run.mjs:326` — `dispatchToAgentAsync` has no `_spawnFn` injection; async parallel-dispatch cwd passing is untestable via mock (production path, not dead code)
🟡 [tester] `bin/lib/run.mjs:52` — `cwd = process.cwd()` default silently runs gate against main repo if caller omits arg 4 *(carried from simplicity review)*
🟡 [tester] `test/worktree.test.mjs:204` — Duplicate `slugToBranch normalization` block; both tests already covered at lines 16 and 22 *(carried from simplicity review)*
🟡 [security] `bin/lib/run.mjs:161` — Path traversal in exported `createWorktreeIfNeeded(slug)`: raw `slug` is used in `path.join()` without a bounds check. The current call site sanitizes `featureName` to `[a-z0-9-]+` before passing it, so production is safe. But the exported function has no internal guard — a future caller with unsanitized input escapes `.team/worktrees/` via `..` resolution. Fix: add a `resolve`+`startsWith` guard after line 161.
🟡 [security] `bin/lib/run.mjs:58` — Gate command executed in AI-writable worktree: `execSync(gateCmd, { cwd: worktreePath, shell: true })`. The `cmd` is correctly detected from `mainCwd` (line 839, confirmed — not the worktree), so the command string itself is untampered. However, `npm test` executed in `worktreePath` reads the worktree's `package.json` for the test script. A prompt-injected AI that writes `"scripts": {"test": "malicious cmd"}` achieves code execution on the next gate run. Consider either running the gate with `cwd: mainCwd`, or validating that `cmd` matches known-safe patterns.
🟡 [simplicity] `test/worktree.test.mjs:204` — `describe("slugToBranch normalization")` duplicates `describe("slugToBranch")` at line 14; tests at lines 207 and 213 are already covered by lines 16 and 22–24. Delete both or replace with a genuine `createWorktreeIfNeeded` integration test.
🟡 [simplicity] `bin/lib/run.mjs:948` — `cwd = worktreePath` silently overloads the outer `cwd` variable; rename to `execCwd` at that line to make the semantic switch explicit.
🟡 [simplicity] `bin/lib/run.mjs:52` — `cwd = process.cwd()` default on exported `runGateInline` is a footgun; omitting the argument silently runs the gate against the main repo. Remove the default to force callers to be explicit.
🔵 [architect] `bin/lib/run.mjs:839` — `detectGateCommand(mainCwd)` reads gate config from main repo, not the worktree; document the implicit contract (feature tasks that modify `scripts.test` won't affect the gate until merged)
🔵 [architect] `bin/lib/run.mjs:326` — `dispatchToAgentAsync` passes `cwd` correctly to `spawn` but lacks `_spawnFn` injection unlike `dispatchToAgent`; the parallel-review cwd path is untestable via mock
🔵 [engineer] `bin/lib/run.mjs:948` — `cwd = worktreePath` silently reuses the outer `cwd` variable across a semantic boundary; rename to a separate variable (`execCwd`) to make the shift explicit
🔵 [tester] `bin/lib/run.mjs:948` — `cwd` variable reuse obscures which directory governs gate and dispatch; rename to `execCwd` *(carried from simplicity review)*
🔵 [security] `.team/features/git-worktree-isolation/tasks/task-3/security-eval.md` (prior) — Corrected errata: the prior eval stated `detectGateCommand(cwd)` "reads from the worktree directory." This is wrong — line 839 calls `detectGateCommand(mainCwd)` before `cwd` is reassigned at line 948. The risk is real but the mechanism was mis-described; update to avoid confusing future maintainers.
🔵 [simplicity] `bin/lib/run.mjs:326` — `dispatchToAgentAsync` lacks `_spawnFn` injection, leaving the async path's cwd injection untestable via mock.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs
🔴 iteration-escalation — Persistent eval warning: fabricated-refs recurred in iterations 1, 2

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs