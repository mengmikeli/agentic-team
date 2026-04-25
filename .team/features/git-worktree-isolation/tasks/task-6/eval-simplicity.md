# Simplicity Review — task-6 (concurrent worktree integration tests)

## Verdict: PASS

## Evidence
- Read `test/worktree.test.mjs` (full file, 456 lines).
- Read handshake at `tasks/task-6/handshake.json`.
- Diffed `git diff HEAD~2 HEAD~1 -- test/worktree.test.mjs` — task-6 adds exactly one new `describe` block (lines 355–412, 61 added lines).
- Re-ran `node --test test/worktree.test.mjs` → 34/34 pass, including both new "concurrent createWorktreeIfNeeded" tests.

## Per-Criterion

### Dead code (🔴 veto category)
None. Every variable in the new block is used; no commented-out code; no unreachable branches.

### Premature abstraction (🔴 veto category)
None. No new helpers, no new modules — tests call existing `createWorktreeIfNeeded`/`removeWorktree` directly.

### Unnecessary indirection (🔴 veto category)
None. Direct `Promise.all([...createWorktreeIfNeeded(...)])` with no wrapper layers.

### Gold-plating (🔴 veto category)
None blocking. The second test (`f1..f4`, 4 slugs) does broaden coverage past the minimal "two concurrent" claim — but it's a single 14-line test covering parent-dir non-corruption, which is a stated requirement in the task description ("do not race on `.team/worktrees/`"). It earns its keep.

### Cognitive load (🟡 warning band)
The two new tests share 100% of the `beforeEach`/`afterEach` git-init scaffolding with the existing `removeWorktree real-git lifecycle` block (lines 174–184 vs 358–368). This is duplication, not abstraction debt — fine for a test file, but a future tidy-up could share the fixture.

## Honest Caveat (🟡)
`createWorktreeIfNeeded` is **synchronous** (uses `execFileSync`). Wrapping it in `Promise.resolve().then(...)` does not create real concurrency — it queues two microtasks that run sequentially on the event loop. The test therefore proves *idempotent sequential safety*, not *true parallel race-freedom*. The handshake summary slightly oversells the rigor ("run createWorktreeIfNeeded in parallel via Promise.all"). Genuine race-detection would require `child_process.fork` or `worker_threads`. Given that the production caller invokes the same sync function from one Node process, the current test does match the realistic threat model — but the wording is misleading.

## Findings
🟡 test/worktree.test.mjs:375 — `Promise.all` on a sync function does not exercise real concurrency; either (a) replace with `child_process.fork` / `worker_threads` for an actual race test, or (b) soften the comment ("Race them in parallel") to reflect that this is sequential-on-microtask ordering.
🔵 test/worktree.test.mjs:358-368 — `beforeEach` git-init fixture duplicates lines 174–184; consider hoisting to a shared helper if a third such block is ever added.
🔵 .team/features/git-worktree-isolation/tasks/task-6/handshake.json:7 — Summary claims "run createWorktreeIfNeeded in parallel via Promise.all"; since the function is sync this is microtask-ordered, not parallel. Word-smithing only.

## Pass Rationale
Zero red findings across the four veto categories. New code is minimal (61 lines), concrete, uses real git via `execFileSync`, and the assertions (distinct paths, on-disk existence, `git worktree list` membership) are the right things to check. The yellow on `Promise.all`-vs-sync is a precision concern, not a correctness one — the test still catches the regression it was written for.
