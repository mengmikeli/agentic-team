# Security Review — git-worktree-isolation

**Reviewer role:** Security
**Overall Verdict: PASS**

---

## Files Read

- `bin/lib/run.mjs` (lines 40–185, 280–360, 396–420, 895–910, 1013–1025, 1183–1215, 1515–1540)
- `bin/lib/gate.mjs` (full file, 190 lines)
- `bin/lib/github.mjs` (lines 1–30, 188–195)
- All 9 `handshake.json` files (tasks 1–6, 11–13)
- `.team/features/git-worktree-isolation/tasks/task-12/test-output.txt`

---

## Per-Criterion Results

### 1. Path traversal via slug  PASS

`bin/lib/run.mjs:155–176` read and verified.

`slugToBranch` strips `/` (not in `[a-z0-9\-\.]`), so `../foo` becomes `..foo`. `path.join` treats `..foo` as a literal directory name — not a traversal. Bare `..` matches the `^\.+$` guard at line 166 and throws. Empty slug throws at line 165.

Edge case checked: `path.join("/base", ".team", "worktrees", "..foo")` = `/base/.team/worktrees/..foo` — correctly confined. I traced this path manually; it does not escape.

Test evidence (test-output.txt lines 828–832): path-traversal blocked, all-dots rejected, empty-slug rejected — all PASS.

### 2. Explicit cwd contract (no implicit process.cwd() fallback in agent/gate paths)  PASS

`bin/lib/run.mjs:53–54, 287, 346` — all three worker entry points verified by read to throw `Error` when `cwd` is falsy:
- `runGateInline` line 54
- `dispatchToAgent` line 287
- `dispatchToAgentAsync` line 346

Test evidence (test-output.txt lines 805–811): 5 required-cwd contract tests — PASS.

Grep audit test (lines 848–852): no `cwd: process.cwd()` in `dispatchToAgent` body, `dispatchToAgentAsync` body, or `gate.mjs` body — PASS.

### 3. Shell injection surface  PASS (pre-existing, not introduced by this feature)

`bin/lib/run.mjs:60` and `bin/lib/gate.mjs:61` both call `execSync(cmd, { shell: true })`. The gate command comes from `detectGateCommand(mainCwd)` which reads `PROJECT.md` from the **main repo working directory** (not the worktree). An agent running in the worktree cannot inject into the gate command by modifying the worktree's `PROJECT.md`.

All other subprocess calls use array arguments (`execFileSync("git", [...])`, `spawnSync("claude", [...])`, `spawnSync("gh", [...])`) — no shell expansion possible regardless of argument content.

This `execSync(cmd, { shell: true })` pattern predates this feature. PROJECT.md is a developer-controlled config file (analogous to Makefile or package.json scripts), and the design is intentional. Not a new vulnerability.

### 4. Agent spawned with bypassPermissions  PASS (design intent)

`bin/lib/run.mjs:294, 354` — agents are spawned with `--permission-mode bypassPermissions`, giving unrestricted filesystem access. The `cwd` setting constrains the working directory but does not prevent path-absolute access outside the worktree.

This is intentional for an agentic build tool. The worktree isolation is at the **git branch** level, not the filesystem access level. Documented behavior.

### 5. GitHub integration  PASS

`bin/lib/github.mjs` uses `spawnSync("gh", args, ...)` with an array of arguments for all `gh` CLI calls — no shell interpolation of user-controlled values. Issue titles containing feature names/labels are passed safely.

### 6. Test evidence  PASS

test-output.txt lines 853–860: `pass 566 / fail 0 / skipped 2`. The 2 skipped tests have explicit `# SKIP` markers in the synthesize suite (unrelated to this feature). Test names match specific assertions verified in code.

---

## Findings

🟡 `bin/lib/gate.mjs:21` — `cmdGate` falls back to `process.cwd()` when `--cwd` is not passed. If an agent invokes `agt-harness gate --cmd ...` directly (without `--cwd`), the gate runs in the calling process's working directory rather than the worktree — silently breaking isolation. The required-cwd contract is enforced in `runGateInline`, `dispatchToAgent`, and `dispatchToAgentAsync` but NOT in `cmdGate`. Add a visible warning or strict throw here, or document the caller obligation.

🔵 `bin/lib/run.mjs:167` — After computing `worktreePath = join(mainCwd, ".team", "worktrees", safeSlug)`, there is no `path.resolve()` containment assertion. Current sanitization is sound, but a single `if (!resolve(worktreePath).startsWith(resolve(join(mainCwd, ".team", "worktrees")))) throw` would make path confinement independently verifiable without reasoning through `slugToBranch` invariants.

---

## Summary

No critical findings. Slug sanitization correctly blocks path traversal. The explicit `cwd` contract is enforced at all three worker entry points and tested. Git and GitHub subprocess calls use array arguments throughout — no shell injection surface. The sole warning (`cmdGate` fallback to `process.cwd()`) is the only path where worktree isolation could be silently bypassed; it should go to backlog.
