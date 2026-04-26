# Tester Review — task-4 (removeWorktree on completion)

## Verdict: PASS (with backlog items)

Test suite: 543 pass / 0 fail / 2 skipped. Real-git integration test added.

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| `removeWorktree` invoked on successful run completion | PASS | `bin/lib/run.mjs:1519-1521` — `} finally { if (worktreePath) removeWorktree(worktreePath, mainCwd); }` wraps the post-create block (try opens at `:1019`). |
| Directory removed | PASS | `removeWorktree` shells `git worktree remove --force` (`bin/lib/run.mjs:176`); real-git test asserts `!existsSync(wtPath)` at `test/worktree.test.mjs:198`. |
| Tracking entry removed (`git worktree list` no longer shows it) | PASS | `test/worktree.test.mjs:201-203` — runs real `git worktree list` and asserts the path is absent (both raw and `realpath`). |
| Errors are non-fatal (worktree already gone) | PASS | `bin/lib/run.mjs:175-177` swallows; `test/worktree.test.mjs:136-140, 162-165` cover. |

## Coverage gaps / risks (backlog candidates)

1. **No test asserts the call site (lifecycle integration).** The "lifecycle: removeWorktree is called on completion" test (`test/worktree.test.mjs:155-160`) only exercises the function in isolation — the name is misleading. There is a source-regex wiring test for `runGateInline` (`:223-230`) but no equivalent regex/integration test asserting the `finally { … removeWorktree(...) }` exists in `_runSingleFeature`. A code refactor that drops the finally block would not fail any test.
2. **No failure-path test.** The whole point of putting `removeWorktree` in `finally` is exception safety. No test asserts that an exception thrown inside the inner `try` (lines 1019-1518) still triggers cleanup. Easy to regress by accidentally moving the call into the success branch.
3. **`-B` re-creation interaction.** After auto-removal, the next run with the same slug will hit `existsSync === false` and execute `git worktree add … -B feature/{slug}` (`bin/lib/run.mjs:169`). `-B` resets the branch to HEAD. If the prior run committed but the auto-push (`:1514`) failed (try/catch swallowed), those local commits are lost on re-run. Combined with auto-removal this is more dangerous than before. No test covers "branch retains commits and survives re-run."
4. **`--force` destroys uncommitted/untracked files.** `git worktree remove --force` will wipe any agent scratch files not committed by the time the run reaches `finally`. Acceptable per spec, but no regression test pins this trade-off (e.g., that branch HEAD commits are preserved while working tree is gone).
5. **Real-git integration test asserts directory + tracking entry only.** It does not assert the branch persists (`git branch --list feature/remove-me`), so a future change that adds `--delete-branch` semantics would silently pass.
6. **Wiring regex is brittle.** `test/worktree.test.mjs:227` matches exact spacing of `runGateInline(gateCmd, featureDir, task.id, cwd)`. Reformatting breaks the test without any behavioral change.

## Findings

🟡 test/worktree.test.mjs:155 — "lifecycle" test is misnamed; it does not assert run.mjs invokes removeWorktree. Add a source-regex assertion (mirroring `:223`) for `finally { … removeWorktree(worktreePath, mainCwd) }`.
🟡 test/worktree.test.mjs:166 — Add a failure-path test: simulate `_runSingleFeature` body throwing and assert removeWorktree still fires (currently only happy path is implicitly covered).
🟡 bin/lib/run.mjs:169 — `-B` resets the branch on re-run after auto-removal; if prior auto-push (`:1514`) failed silently, local commits are wiped. Add a test pinning behavior, or guard `-B` with "branch tip differs from origin" check.
🟡 test/worktree.test.mjs:185 — Real-git integration should also assert `git branch --list feature/remove-me` still shows the branch (so future regressions that delete the branch are caught).
🔵 test/worktree.test.mjs:227 — Spacing-sensitive regex is brittle; loosen to `runGateInline\([^)]*cwd[^)]*\)` or assert via behavior instead of source string.
🔵 bin/lib/run.mjs:1520 — `mainCwd` is closed-over from `:786`. Consider asserting in test that removal targets the *original* cwd, not the worktree cwd, to prevent a future bug where the wrong cwd is passed and `git worktree remove` runs from inside the soon-to-be-deleted dir.
