# Simplicity Review — task-6 (slug sanitization + real-subprocess race tests)

## Verdict: PASS

## Evidence
- Read handshake at `tasks/task-6/handshake.json` — claims slug sanitization in `createWorktreeIfNeeded` plus stronger concurrency tests.
- Read `bin/lib/run.mjs:155-175` — change is +4 / −2 lines: hoist `slugToBranch(slug)` into `safeSlug`, throw if empty, use it for both path and branch.
- Read `git diff 948e5aa~1 948e5aa` — only `bin/lib/run.mjs` (+6/−4) and `test/worktree.test.mjs` (+94/0). No new files, modules, or exports.
- Ran `node --test test/worktree.test.mjs` directly: 38/38 pass, including the three new tests (real-subprocess race, same-slug race, slug sanitization). Output captured in this session.
- Logic path: `slugToBranch` strips `/`, lowercases, drops chars outside `[a-z0-9.-]`, slices to 72. After that step, `..` cannot be reassembled into a path component because `/` is gone. The empty-slug guard prevents `join(..., "")` from collapsing to the parent dir. Both are real boundary checks, not speculative.

## Per-Criterion (veto categories)
- **Dead code**: none. The previous code called `slugToBranch` only for the branch and used raw `slug` for the path — that latent inconsistency is removed.
- **Premature abstraction**: none. No new helper or interface — inline rename + one-line guard.
- **Unnecessary indirection**: none. `safeSlug` is a local binding used twice in the same function.
- **Gold-plating**: none in production code.

## Findings
🟡 test/worktree.test.mjs:497 — The `result.startsWith(... + "\\")` Windows-path branch is speculative: this repo runs on darwin, POSIX `join` never emits `\`, and there is no Windows test target. The first branch alone covers every platform the test runs on. Backlog.

🔵 test/worktree.test.mjs:415-435 — The 20-line inline `spawn` + stdout-marker `runChild` helper is used by exactly one test. Fine for now; if a second real-subprocess test is added, factor it into `test/helpers/`.

🔵 bin/lib/run.mjs:165 — `invalid slug: "..."` could mention which characters are allowed for a friendlier diagnostic. Optional.

## Pass Rationale
- Closes a real path-traversal class (`--slug ../foo` previously joined raw and could escape `.team/worktrees/`).
- Adds true OS-level concurrency coverage that the prior in-process `Promise.all`-over-`execFileSync` test could not exercise (event-loop serialization).
- Production diff is 4 lines. Zero red findings across the four veto categories.
