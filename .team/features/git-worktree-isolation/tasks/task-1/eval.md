## Parallel Review Findings

🔴 [architect] `bin/lib/run.mjs:1469` — Auto-push silently fails for all new feature branches: `git rev-list --count @{u}..HEAD` throws when no upstream is set (newly created worktree branches never have one); `catch {}` swallows the error and push is skipped on every first run. Fix: use `git push --set-upstream origin HEAD` (or pass `branchName` through from `createWorktreeIfNeeded`).
🔴 [architect] `test/worktree.test.mjs:57` — Test named "calls git worktree add when directory does not exist" pre-creates the target directory (lines 63–64) then calls `createWorktreeIfNeeded("already-there", ...)`, exercising only the **reuse** path. The actual `git worktree add` invocation at `run.mjs:166` has zero unit test coverage. Rename to reflect actual behavior; add a test that verifies `execSync` is called with the correct `git worktree add` arguments.
🔴 [engineer] `bin/lib/run.mjs:896` — Worktree created before dry-run guard at line 946; function returns at line 950 without cleanup; every `--dry-run` leaks a worktree permanently
🔴 [product] `bin/lib/run.mjs:898` — Silent `catch` continues with `cwd = mainCwd` when worktree creation fails; re-throw or `process.exit(1)` to enforce the isolation contract (agents/commits would otherwise run against `main`)
🔴 [tester] `test/worktree.test.mjs:57` — Test "calls git worktree add when directory does not exist" pre-creates the directory and tests the reuse branch; `run.mjs:166` (`execSync git worktree add`) is never exercised by any test — add a mock-based test for the new-creation path
🔴 [tester] `test/worktree.test.mjs:1` — No test asserts that `dispatchToAgent` or `runGateInline` receives the worktree path as `cwd`; SPEC `Done When` item 10 explicitly requires this coverage — add spy-based tests for cwd injection
🔴 [tester] `test/worktree.test.mjs:97` — No lifecycle test verifies `removeWorktree` is called on feature done or blocked; only a no-throw test for already-gone path exists — add tests simulating completion and blocked-exit paths
🔴 [security] bin/lib/run.mjs:166 — `execSync` with `shell: true` and template literal path; if `mainCwd` contains `"` or `$(...)` (legal in POSIX paths), shell metacharacters execute. Replace with `execFileSync("git", ["worktree", "add", worktreePath, "-b", branchName], { cwd: mainCwd, stdio: "pipe" })`.
🔴 [security] bin/lib/run.mjs:173 — Same `shell: true` injection vector in `removeWorktree`. Replace with `execFileSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: mainCwd, stdio: "pipe" })`.
🔴 [security] bin/lib/run.mjs:898 — Silent worktree-creation failure causes all agent dispatches, auto-commits, and pushes to run against the main repo instead of the feature branch. A branch-name collision on the remote is the likely trigger. Re-throw the error (or `process.exit(1)`) rather than degrading silently.
[simplicity] **Verdict: FAIL** — two 🔴 dead code findings block merge.
🔴 [simplicity] `bin/lib/run.mjs:1480` — Dead assignment: `cwd = mainCwd` is never read after this line; delete it
🔴 [simplicity] `bin/lib/run.mjs:177` — Dead code: orphaned `// ── Agent dispatch` section header with no dispatch code beneath it; remove it
🔴 [simplicity] `bin/lib/run.mjs:181` — Dead code: duplicate `// ── Token usage tracking` comment (appears on both line 179 and 181); remove one
🟡 [architect] `bin/lib/run.mjs:155` — `slugToBranch` regex `[^a-z0-9\-\.]` silently strips uppercase A-Z. Current callers are safe (featureName is lowercased at line 773 first), but the exported function is a trap for future callers. Add `.toLowerCase()` as the first transform.
🟡 [engineer] `bin/lib/run.mjs:1469` — `git rev-list --count @{u}..HEAD` throws for every new feature branch (no upstream after `git worktree add -b`); push is silently skipped on first run; use `git push --set-upstream origin HEAD` instead
🟡 [engineer] `bin/lib/run.mjs:894` — No `try/finally` around task-execution body; uncaught exception between lines 900–1476 leaks the worktree
🟡 [engineer] `test/worktree.test.mjs:57` — Test titled "calls git worktree add when directory does not exist" tests the opposite (reuse path); the actual `execSync` path has zero test coverage
🟡 [product] `test/worktree.test.mjs:57` — Test titled "calls git worktree add when directory does not exist" pre-creates the directory and exercises the reuse path only; rename to match actual behavior
🟡 [tester] `bin/lib/run.mjs:155` — `slugToBranch` strips uppercase without `.toLowerCase()` first; `"MyFeature"` → `"yeature"`; no test covers mixed-case slugs — add `.toLowerCase()` at start of chain and a regression test
🟡 [tester] `bin/lib/run.mjs:1469` — Auto-push uses `@{u}` which throws for every new worktree branch (no upstream configured); push is silently swallowed, feature commits are stranded — no test covers this path
🟡 [security] bin/lib/run.mjs:1469 — Auto-push uses `@{u}` which throws `fatal: no upstream configured` on every fresh worktree branch; the exception is swallowed and the push silently skips. SPEC requirement "auto-push pushes `feature/{slug}`" is never fulfilled. Use `execFileSync("git", ["push", "--set-upstream", "origin", branchName])`.
🟡 [security] bin/lib/run.mjs:1 — Zero unit tests cover `createWorktreeIfNeeded`, `removeWorktree`, `slugToBranch`, or `cwd` injection. SPEC task-10 (unit test coverage) is still pending; the gate PASS reflects only pre-existing tests.
🟡 [simplicity] `bin/lib/run.mjs:152` — `slugToBranch` strips uppercase without lowercasing first; `My-Feature` → `y-eature` (branch corruption); prepend `.toLowerCase()`
🟡 [simplicity] `test/worktree.test.mjs:57` — Test title claims "calls git worktree add when directory does not exist" but only exercises the reuse path; rename or add a genuine non-existing-path test
🔵 [engineer] `bin/lib/run.mjs:155` — `slugToBranch` strips uppercase without lowercasing first; `"MyFeature"` → `"yeature"`; add `.toLowerCase()` before first replace
🔵 [security] bin/lib/run.mjs:154 — `slugToBranch` allows `.` characters; consecutive dots (`..`) in a git branch name are invalid per `git-check-ref-format`. Add `.replace(/\.{2,}/g, ".")` before the `slice`.

🟡 compound-gate.mjs:0 — Thin review warning: fabricated-refs

## Compound Gate

**Verdict:** WARN
**Layers tripped:** 1/5
**Tripped layers:** fabricated-refs