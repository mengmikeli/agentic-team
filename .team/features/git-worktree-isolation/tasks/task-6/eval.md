# Engineer Eval — task-6 (concurrent worktree isolation)

## Verdict: PASS

## Evidence

### Files reviewed
- `test/worktree.test.mjs` (full read, 456 lines)
- `bin/lib/run.mjs` lines 160–180 (`createWorktreeIfNeeded`, `removeWorktree`)
- `.team/features/git-worktree-isolation/tasks/task-6/handshake.json`

### Test execution
Ran `node --test test/worktree.test.mjs`: **34/34 tests pass**, 0 fail. The two new concurrent-isolation tests both pass:
- `two concurrent invocations on different features produce two independent worktrees` (95ms) — uses real `git init` + `Promise.all` race + asserts distinct paths, on-disk existence, and presence in `git worktree list`.
- `parent .team/worktrees/ directory is not corrupted by concurrent creation` (135ms) — runs 4 parallel slugs and verifies all paths are unique and exist.

### Spec satisfaction
The handshake claim — "two concurrent `agt run` invocations on different features produce two independent worktrees and do not race on `.team/worktrees/`" — is exercised by:
1. Real-git race in a temp repo (not mocked).
2. Assertions on git's own bookkeeping (`worktree list`) which would catch lockfile or index corruption.
3. Cleanup via `removeWorktree` so the test doesn't leak.

### Edge cases checked
- Same-slug concurrency: NOT covered by these tests, but also not in scope per the task statement ("different features"). The `existsSync` → `git worktree add` pattern in `run.mjs:163-172` has a TOCTOU window if the same slug were raced, but git itself would fail the second `worktree add` (path exists), so it is bounded.
- 4-way parallelism (`f1..f4`) verified in addition to the 2-way case — gives confidence in the underlying git lockfile handling.

## Findings

🔵 bin/lib/run.mjs:166 — `existsSync` → `git worktree add` is TOCTOU-racy for *same* slug (out of scope for this task, but worth a backlog note if same-slug re-entry is ever supported).
🔵 test/worktree.test.mjs:392-393 — Cleanup `removeWorktree` calls outside a try/finally; if assertions above them fail, the temp repo `rmSync` in `afterEach` still runs but git's `.git/worktrees/<name>` admin entries leak briefly. Not a real problem since `repoDir` is fully removed.

No 🔴 or 🟡 findings.

---

# Architect Eval — task-6

## Verdict: PASS

## Per-Criterion

| Criterion | Result | Evidence |
|---|---|---|
| Test exists for the claim | PASS | `test/worktree.test.mjs:370-394` and `:396-411` |
| Test uses real git (not mocks) | PASS | `execFileSync("git", ["init", ...])` in beforeEach `:360-363` |
| Verifies independence | PASS | `assert.notEqual(pathA, pathB)` + per-path `existsSync` |
| Verifies no `.team/worktrees/` race | PASS | Asserts both entries appear in `git worktree list` post-race |
| Tests pass | PASS | Local `node --test test/worktree.test.mjs`: 34 pass, 0 fail |

## Architectural Review

- `createWorktreeIfNeeded` (`bin/lib/run.mjs:163`) is appropriately thin: existsSync check, then `git worktree add -B`. The reuse-on-exists branch is the right boundary for crash-recovery and re-entry.
- The concurrency claim is exercised at the **git level**, not just JS path math — correct boundary for the test.
- Dependency injection via `_execFn` parameter is consistent across `createWorktreeIfNeeded` / `removeWorktree` / `dispatchToAgent` / `runGateInline`. No new abstractions or shared state introduced — good.
- No new dependencies; no module boundary changes; scales linearly with feature count (each slug → its own path → its own git worktree entry).

## Files Read
- `.team/features/git-worktree-isolation/tasks/task-6/handshake.json`
- `test/worktree.test.mjs` (full)
- `bin/lib/run.mjs:155-179` plus grep of call sites at `:1016`, `:1523`

## Findings

🔵 bin/lib/run.mjs:170 — `git worktree add` creates `.team/worktrees/` implicitly today; if a future caller needs the parent dir before git runs, an explicit `mkdirSync(dirname(worktreePath), { recursive: true })` would make the contract obvious. Not required now.
🔵 test/worktree.test.mjs:396 — 4-slug parallel test is a good stress nudge; consider 8–16 in a follow-up if real concurrency expands.

No 🔴 or 🟡 findings.

---

# Product Manager Eval — task-6

## Verdict: PASS

## Requirement under review
"Two concurrent `agt run` invocations on different features produce two independent worktrees and do not race on `.team/worktrees/`."

## Per-criterion results

| Criterion | Result | Evidence |
|---|---|---|
| Two concurrent invocations on **different features** succeed | PASS | `test/worktree.test.mjs:370-394` (in-process race) and `:413-450` (real OS-level race via two spawned Node child processes); both assert distinct paths, on-disk existence, and presence in `git worktree list`. |
| Worktrees are **independent** (different paths, no shared state) | PASS | `assert.notEqual(pathA, pathB)` + per-path `existsSync` + `git worktree list` includes both — git's own bookkeeping confirms no collision. |
| No race on `.team/worktrees/` parent dir | PASS | `:396-411` runs 4 slugs in parallel; all paths unique and exist. The OS-level child-process test (`:413-450`) is the strongest evidence — `Promise.all` over sync calls would not exercise true concurrency, so spawning real children was the right call. |
| Test suite passes | PASS | Local re-run of `node --test test/worktree.test.mjs` → 38 pass / 0 fail. |
| Scope discipline (no out-of-scope features added) | PASS | Diff is bounded: slug-sanitization hardening in `createWorktreeIfNeeded` (`bin/lib/run.mjs:163-174`) and three new tests. Slug sanitization is defensible because it directly affects whether two "different" slugs can collide on disk. |

## User-value lens
A developer running `agt run` on feature A while another `agt run` runs on feature B will get two independent worktrees, no cross-contamination, and no corrupted `.git/worktrees/` admin dir. Same-slug race (`:452-472`) degrades gracefully to "one wins, other reuses or errors cleanly" — acceptable since same-slug concurrent runs are not a documented use case.

## Acceptance criteria
The handshake claim is directly verifiable from the spec sentence alone; tests map 1:1 to it. A reviewer reading only the spec could write the same assertions.

## Files actually opened
- `.team/features/git-worktree-isolation/tasks/task-{1..6}/handshake.json`
- `bin/lib/run.mjs:150-181`
- `test/worktree.test.mjs:353-506`
- `.team/features/git-worktree-isolation/tasks/task-6/eval.md` (engineer + architect evals)

## Findings

🔵 .team/features/git-worktree-isolation/tasks/task-6 — No `artifacts/test-output.txt` was persisted alongside the handshake; the gate output lives only in the harness log. Backlog: persist test output as a task artifact so PM reviews are self-contained.
🔵 test/worktree.test.mjs:452 — Same-slug race tests the post-condition but doesn't assert which user-facing message the loser prints. Backlog only.

---

# Engineer Eval (re-review) — task-6

## Verdict: PASS

## Evidence
- Ran full suite: `npm test` → 552 pass / 0 fail / 2 skipped (matches handshake's "All 552 tests pass" claim).
- Reproduced edge case via direct call: `slugToBranch("..")` returns `".."` (truthy), and `slugToBranch(".")` returns `"."`.
- Read full `bin/lib/run.mjs` and full `test/worktree.test.mjs`; cross-checked `createWorktreeIfNeeded` (run.mjs:163), call sites at run.mjs:1018 and the catch/preserve/rethrow at run.mjs:1526–1531.

## Per-criterion
| Criterion | Result | Evidence |
|---|---|---|
| Two concurrent invocations on different features → independent worktrees | PASS | worktree.test.mjs:413 (real-subprocess race) and :370 (in-proc race) both pass |
| `.team/worktrees/` not corrupted under concurrency | PASS | :396 4-slug parallel test; both real-subproc paths appear in `git worktree list` |
| Same-slug race handled cleanly | PASS | :452 — at least one succeeds, subsequent reuse returns the same path |
| Slug sanitization (path traversal via `--slug ../foo`) | PASS w/ caveat | :478 proves `../evil` cannot escape; `:498` proves all-special-char throws. See finding below for an uncovered subcase. |
| Worktree preserved on thrown error for retry | PASS | source-assertion tests at :511/:521 + run.mjs:1526–1531 |

## Findings

🟡 bin/lib/run.mjs:165 — Slug sanitization rejects empty strings but not strings consisting only of dots. `slugToBranch("..")` returns `".."` (truthy), so the guard `if (!safeSlug)` does not fire; the resulting path `.team/worktrees/..` resolves to `.team/`, which `existsSync` then sees as truthy and the function "reuses" it as a worktree. `slugToBranch(".")` is the same. Add an explicit reject (e.g. `if (/^\.+$/.test(safeSlug)) throw new Error(\`invalid slug: ${JSON.stringify(slug)}\`)`) and a regression test next to the existing traversal test.

🔵 test/worktree.test.mjs:370 — The "Promise.all on different slugs" case wraps `createWorktreeIfNeeded` (synchronous `execFileSync` underneath) in `Promise.resolve().then(...)`. Because the inner work is sync, the two `.then`s effectively run sequentially on the event loop — this case is structural, not a true race. The real-subprocess test at :413 covers the actual race; a one-line comment here would prevent future readers from over-trusting this case.

🔵 bin/lib/run.mjs:163 — `createWorktreeIfNeeded` has no in-process lock; correctness for different-slug concurrency relies on git's own atomicity in `.git/worktrees/`. Fine for current scope, but worth a comment so a future maintainer doesn't strip the existsSync-then-add pattern thinking it's redundant.

## Notes
- Code quality, error handling, and performance are appropriate for the scope.
- Handshake artifact paths (`bin/lib/run.mjs`, `test/worktree.test.mjs`) match the actual modified files.
- The 🟡 finding is an edge case (a user must explicitly pass `--slug ..`) and per the format rules goes to backlog — does not block the merge.
