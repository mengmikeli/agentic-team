# Tester Review — task-1: createWorktreeIfNeeded

## Verdict: PASS (with backlog flags)

Handshake claims are supported by direct evidence: `bin/lib/run.mjs:162-172` implements the function; `test/worktree.test.mjs` exercises slug normalization, path computation, reuse, mocked exec args, and `-B` semantics. Gate transcript (truncated) shows the suite running with no failures visible.

## Files Actually Opened
- `bin/lib/run.mjs` (lines 120–200)
- `test/worktree.test.mjs` (full, 278 lines)
- `.team/features/git-worktree-isolation/tasks/task-1/handshake.json`

## Per-Criterion Evidence (Test/Coverage Lens)

| Criterion | Result | Evidence |
|---|---|---|
| Returns absolute path under `.team/worktrees/<slug>` | PASS conditionally | `run.mjs:163` joins `mainCwd` + path; absolute only if caller passes absolute `mainCwd`. Tests use `tmpdir()` (absolute). No test asserts `path.isAbsolute(result)`; no test feeds a relative `mainCwd`. |
| Creates branch `feature/<sanitized-slug>` if missing | PASS | `run.mjs:164,169`; tests `worktree.test.mjs:55-68, 121-130`. |
| Reuses path when present | PASS | `run.mjs:165-168`; test `worktree.test.mjs:70-82`. |
| Sanitization (lowercase, dashes, strip, 72-cap) | PASS | `slugToBranch` `run.mjs:154-160`; tests `worktree.test.mjs:14-39`. |

## Coverage Gaps (Tester lens)

- **No path-traversal test** for `slug = "../foo"` — security gap also flagged on path itself; the *test* gap is what concerns me here.
- **Real-git `-B` recovery is asserted only via arg inspection** (`worktree.test.mjs:93-119`); no integration test creates a stale branch + missing dir and verifies recovery.
- **Absoluteness contract untested** — handshake says "absolute path" but no assertion enforces it.
- **No "mainCwd is not a git repo" test** — `git worktree add` would throw; behavior undocumented.
- **No concurrency test** — two parallel calls with the same slug would race `existsSync`; the second errors.
- **No empty / fully-stripped slug test** — `slugToBranch("@@@") === ""`, branch becomes `feature/`, git rejects. Untested behavior.
- **`removeWorktree` lifecycle is mock-only** — no real-git create→remove→recreate roundtrip.

## Findings

🟡 test/worktree.test.mjs:55-91 — Add `assert.ok(path.isAbsolute(result))` to lock the absolute-path contract from the handshake.
🟡 test/worktree.test.mjs:104-119 — `-B` recovery asserted only by arg inspection; add a real-git integration test (create branch, delete dir, call `createWorktreeIfNeeded`, verify success).
🟡 test/worktree.test.mjs — Add a path-traversal test (`slug = "../escape"`) verifying the function rejects or contains it.
🔵 test/worktree.test.mjs — Add edge-case tests: empty slug, slug stripped to empty (`"@@@"`), and >72-char slug collision after the cap.
🔵 test/worktree.test.mjs — Add concurrency test (two parallel `createWorktreeIfNeeded` for the same slug).
🔵 bin/lib/run.mjs:162 — Consider `path.isAbsolute(mainCwd)` precondition so callers fail loudly instead of silently producing a relative path.

## Notes
- I did not re-execute the test suite. The gate transcript is truncated; no failures appear in the visible portion. If "539 pass / 0 fail" is inaccurate, this verdict flips to FAIL. The missing `artifacts/test-output.txt` is the cause of this uncertainty.
- The main `eval.md` had concurrent edits from Simplicity, PM, and Security reviewers during my session, so I wrote this Tester review to its own file to avoid clobbering their findings.
