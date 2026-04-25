# Simplicity Review — task-5

## Verdict: PASS

## Evidence
- Read `bin/lib/run.mjs` lines 1011–1530. The change replaces the prior `} finally { removeWorktree(...) }` block with `} catch (err) { log; throw err; }` and an unconditional success-path `removeWorktree` after the try. Logic path: success → falls through catch → reaches `removeWorktree` (line 1530); thrown error → catch logs preservation message → rethrows → cleanup is skipped, worktree remains for `createWorktreeIfNeeded` reuse on next invocation.
- Reuse path verified by reading `createWorktreeIfNeeded` test at `test/worktree.test.mjs:380-394` — confirms `mockExec` is never invoked when the worktree dir already exists.
- Diff is minimal: ~6 lines of behavior change. No new abstractions, no flags, no helpers introduced.

## Per-Criterion
- **Dead code**: none introduced.
- **Premature abstraction**: none — change is inline in the single call site.
- **Unnecessary indirection**: none.
- **Gold-plating**: none in production code. Test file has minor smell (see below).

## Findings
🟡 test/worktree.test.mjs:355-372 — Two of the three new tests assert against `run.mjs` source via regex (`!/finally\s*{[^}]*removeWorktree/`, `/catch.*preserving worktree.*throw err/`). They test code shape rather than behavior and will break on innocuous refactors (renaming `err`, reformatting). The third test (line 376) covers actual behavior. Consider replacing the two source-regex tests with a single behavioral test that injects a throwing dispatch and asserts the worktree dir still exists after `_runSingleFeature` rejects. Not blocking — backlog.

🔵 bin/lib/run.mjs:1521-1523 — Comment is helpful but slightly long. Could compress to one line; optional.

## Notes
- Test output captured was truncated mid-run but showed only passes; no failures observed in the visible portion.
- The catch block intentionally has no `finally` — that's the whole point of the change and is correct.
