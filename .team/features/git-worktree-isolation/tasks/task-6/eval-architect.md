# Architect Eval — task-6 (git-worktree-isolation, run_2)

## Verdict: PASS

## Per-Criterion

| Criterion | Result | Evidence |
|---|---|---|
| Module boundaries clean | PASS | `createWorktreeIfNeeded` / `removeWorktree` are thin, single-purpose, DI-friendly (`bin/lib/run.mjs:163-181`) |
| No new dependencies | PASS | Only `child_process.execFileSync` + `path.join` + `fs.existsSync` — already in scope |
| Concurrency claim exercised at correct boundary | PASS | Real `git init` + true OS-level child-process race in `test/worktree.test.mjs:413-450`, not just `Promise.all` over event-loop |
| Same-slug race covered | PASS | `:452-472` — `Promise.allSettled` proves at least one succeeds and reuse stays consistent (no corruption) |
| Path-traversal hardened | PASS | `safeSlug = slugToBranch(slug)` then guard `if (!safeSlug) throw` at `bin/lib/run.mjs:164-165`; test at `:478-496` |
| Preserve-on-error contract | PASS | `catch(err) { ... preserving worktree ... throw err }` at `bin/lib/run.mjs:1526-1531`; source-level test at `:521-528` |
| Scalability at 10× | PASS | Path is `feature → slug → distinct .team/worktrees/{slug}`; git's own admin dir handles parallelism. 4-slug parallel test passes; no shared mutable state in our layer |

## Architectural Review

- **Boundary**: `createWorktreeIfNeeded` correctly delegates the concurrency-critical step (directory creation + index update) to git itself. We don't try to lock `.team/worktrees/` ourselves — the right call. Different slugs → different paths → no contention; same slug → git rejects duplicate adds, our existsSync-then-reuse handles re-entry.
- **DI consistency**: `_execFn` injection mirrors `runGateInline` / `dispatchToAgent` patterns. Clean.
- **Sanitization layering**: `slugToBranch` is reused both for the on-disk path *and* the branch name, so the same allowlist (`[a-z0-9.\-]`) governs both. Single source of truth — good.
- **Lifecycle**: try/catch around the run with `removeWorktree` only on success — preserve-on-error is now an explicit, tested contract.
- **No cross-cutting concerns introduced**: no new caching/auth/error-handling abstractions; no API surface change.

## Files Read

- `.team/features/git-worktree-isolation/tasks/task-6/handshake.json`
- `bin/lib/run.mjs:153-181, 1011-1023, 1517-1532` (worktree create/remove + lifecycle)
- `test/worktree.test.mjs` (full, 549 lines)
- Existing reviews: `eval.md`, `eval-tester.md`, `eval-simplicity.md`, `eval-security.md`

## Findings

🔵 bin/lib/run.mjs:166 — Path computed via `join(mainCwd, ".team", "worktrees", safeSlug)` without explicit `mkdirSync(dirname(...), { recursive: true })`; today git creates parents implicitly, but if a future code path needs to write into `.team/worktrees/` before git runs, the implicit dependency will surprise. Consider an explicit ensure-dir.
🔵 bin/lib/run.mjs:163 — `createWorktreeIfNeeded` mixes path computation, side effects, and `console.log`. Fine for v1; if reused programmatically (e.g. from outer-loop or a daemon), separate the logging from the core function.
🔵 test/worktree.test.mjs:413 — The real-child-process race is the right shape. If feature concurrency grows beyond 2-4, bump to 8 or 16 children to keep the test honest.

No 🔴 or 🟡 findings.
