# Tester Eval — task-6 (concurrent worktree isolation, hardened)

## Verdict: PASS (with backlog)

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| Two concurrent runs on different features → independent worktrees | PASS | `test/worktree.test.mjs:370-394` — `Promise.all` race in real git repo, asserts distinct paths + both in `git worktree list` |
| 4-way parallelism on `.team/worktrees/` | PASS | `test/worktree.test.mjs:396-411` — 4 slugs raced, all unique, all on disk |
| True OS-level concurrency (separate processes) | PASS | `test/worktree.test.mjs:413-450` — spawns two child node processes, asserts both succeed and git bookkeeping intact (closes the prior 🟡 about Promise.all-over-sync) |
| Same-slug race produces no corruption | PASS | `test/worktree.test.mjs:452-472` — `Promise.allSettled`, asserts ≥1 success and subsequent reuse works (closes the prior 🟡 about same-slug coverage) |
| Worktree preserved on thrown error (re-run reuse) | PASS | `test/worktree.test.mjs:510-548` |
| Slug sanitization (path-traversal claim from handshake) | PARTIAL | `test/worktree.test.mjs:477-505` only covers `"../evil"` (which sanitizes to harmless `"..evil"`). `".."` itself is NOT covered and DOES escape (see findings) |
| Tests actually pass | PASS | `node --test test/worktree.test.mjs` → 38 pass, 0 fail, 633 ms (verified locally) |

## Verification I actually ran
- `node --test test/worktree.test.mjs` → 38/38 pass.
- Direct probe: `createWorktreeIfNeeded("..", "/tmp/testfoo123", () => {})` returned `/tmp/testfoo123/.team` — i.e. the path **escapes** `.team/worktrees/`. Confirms the security hardening claim in the handshake is incomplete.

## Edge cases checked
- ✅ Different-slug race (covered)
- ✅ Same-slug race (covered)
- ✅ Real-process race vs. event-loop race (covered)
- ✅ 4-way parallelism (covered)
- ✅ Empty-after-sanitization slug → throws (`:498-505`)
- ✅ Slug = `"../evil"` (covered but sanitizes to harmless `"..evil"`)
- ❌ Slug = `".."` — NOT covered, and DOES escape (verified by hand)
- ❌ Slug = `"..."` / `"...."` — NOT covered
- ❌ Slug = `"."` — NOT covered; sanitizes to `"."`, `existsSync` returns true, returns the worktrees dir itself
- ❌ Concurrent `removeWorktree` + `createWorktreeIfNeeded` on same slug — TOCTOU when one process is tearing down while another creates
- ❌ Stale `.git/worktrees/<slug>` admin entry recovery (dir gone but git still has bookkeeping) — `git worktree add -B` would fail with "already registered"

## Findings

🟡 bin/lib/run.mjs:164 — Slug sanitization is incomplete. `slugToBranch("..")` returns `".."` (dots are permitted by the regex), so `createWorktreeIfNeeded("..", cwd)` resolves to `cwd/.team` — escaping `.team/worktrees/`. The handshake claims path-traversal via `--slug ../foo` is closed, but only the `../foo` → `..foo` case is. Reject slugs that are purely dots, or strip leading dots after the regex pass.
🟡 test/worktree.test.mjs:486 — Path-traversal test only covers `"../evil"` (sanitizes to safe `"..evil"`). Add explicit cases for `".."`, `"..."`, `"."` to actually exercise the traversal vector and pin the sanitizer's behavior.
🔵 test/worktree.test.mjs:166 — No test for stale `.git/worktrees/<slug>` admin entry where the directory was removed but git's bookkeeping wasn't pruned. Re-run with `-B` may fail.
🔵 bin/lib/run.mjs:168 — Same-slug TOCTOU between `existsSync` and `git worktree add` is empirically bounded (one of the calls in `:452-472` is allowed to throw), but no test covers the three-way scenario where one process is mid-`removeWorktree` while another tries to create.

## Notes
The core concurrency claim — the actual scope of this task — is fully verified with real git, real processes, and assertions on git's own bookkeeping. The same-slug race and true-OS-concurrency tests added in this iteration close the two 🟡 findings from the previous tester eval.

The 🟡 findings here are about the *added* path-traversal hardening, not the in-scope concurrency work. They don't undermine the concurrency PASS but should go to backlog before the path-traversal claim in the handshake can be considered fully closed.

## Findings summary

🟡 bin/lib/run.mjs:164 — Slug sanitization allows `".."` to escape `.team/worktrees/`; reject pure-dots slugs.
🟡 test/worktree.test.mjs:486 — Path-traversal test misses the actually-traversing inputs (`".."`, `"..."`, `"."`).
🔵 test/worktree.test.mjs:166 — No coverage for stale `.git/worktrees/<slug>` admin entry recovery.
🔵 bin/lib/run.mjs:168 — No test for create/remove TOCTOU on the same slug.
