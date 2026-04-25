# Security Review — task-6 (concurrent worktree isolation)

## Verdict: PASS (with backlog flags)

## Evidence

- Ran `node --test --test-concurrency=1 test/worktree.test.mjs` → 34/34 pass, including the two new concurrency cases (`two concurrent invocations on different features produce two independent worktrees`, `parent .team/worktrees/ directory is not corrupted by concurrent creation`).
- Read `bin/lib/run.mjs:155-179` (`slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree`).
- Read `bin/lib/run.mjs:807-818` (slug derivation from CLI args / description).
- Read `test/worktree.test.mjs` (full file, 456 lines) — added tests use real `git init` in `mkdtempSync` temp dirs, run `createWorktreeIfNeeded` in parallel via `Promise.all`, assert distinct paths, on-disk existence, and `git worktree list` membership. Cleanup via `removeWorktree` before `rm -rf` to avoid stale git locks.

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| Two concurrent runs on different slugs produce two independent worktrees | PASS | `worktree.test.mjs:370-394`; real-git assertion that `git worktree list` includes both `realA` and `realB`. |
| No race on `.team/worktrees/` parent dir | PASS | `worktree.test.mjs:396-411` runs 4 parallel creations, asserts unique set + existence. `mkdirSync(..., {recursive:true})` is idempotent so concurrent parent creation is safe; `git worktree add` itself serializes through `.git` locks. |
| Tests use real git, not mocks, for the concurrency claim | PASS | `execFileSync("git", ["init", ...])` in `beforeEach`, real `git worktree list` parsing in assertions. |

## Security findings

- `bin/lib/run.mjs:164` — `worktreePath` is built from the raw `slug` (`join(mainCwd, ".team", "worktrees", slug)`), but only `slugToBranch(slug)` sanitizes the branch name. A slug containing `..` or `/` would write outside `.team/worktrees/`. Description-derived slugs at `run.mjs:813-817` strip `[^a-z0-9]+`, but `explicitSlug` (CLI override) appears to bypass that filter. Low real-world risk (developer-supplied input, local tool) but the inconsistency is a latent path-traversal vector — apply the same normalization to the directory path component, or validate `slug` at the entry point.
- `bin/lib/run.mjs:60-67` — `runGateInline` uses `execSync(cmd, { shell: true })` with the gate command. `cmd` originates from local config files, not network input, so the threat model is limited; flagging only because shell:true on operator-controlled config is worth noting.
- `bin/lib/run.mjs:177` — `removeWorktree` swallows all errors silently. Intentional for the "already gone" case (tests confirm at `worktree.test.mjs:163-166`) but masks permission denials or corruption. Defensive-coding observation only.
- No new secrets, auth, or external integration surface introduced by this task.

## Findings (line-format)

🟡 bin/lib/run.mjs:164 — `worktreePath` uses raw `slug` while branch uses `slugToBranch(slug)`; normalize/validate `slug` (or use `slugToBranch(slug)`) before joining into the on-disk path to close the latent path-traversal via a malicious `--slug ../foo` CLI override.
🔵 bin/lib/run.mjs:177 — `removeWorktree` swallows all exceptions; consider logging at debug level so permission/corruption failures don't disappear.
🔵 bin/lib/run.mjs:60 — `execSync(cmd, { shell: true })` on a config-supplied gate command; document explicitly that gate strings are trusted operator input.

## Note

Per security-reviewer policy, I analyzed the existing test/source code but did not modify or augment any source files.
