# Security Review — task-13 (git-worktree-isolation, final state)

**Reviewer role:** Security
**Overall Verdict: PASS**

---

## Files Read

- `bin/lib/run.mjs` (full, 1602 lines)
- `bin/lib/gate.mjs` (full, 190 lines)
- `test/worktree.test.mjs` (full, 731 lines)
- All 9 handshake.json files (tasks 1–6, 11–13)
- `.team/features/git-worktree-isolation/tasks/task-12/test-output.txt` (full)
- `.team/features/git-worktree-isolation/tasks/task-6/eval-security.md`
- `.team/features/git-worktree-isolation/tasks/task-13/eval-security.md` (prior reviewer's draft)

---

## Per-Criterion Results

### 1. Path traversal via slug  PASS

Read `bin/lib/run.mjs:163–176`. `createWorktreeIfNeeded` uses `safeSlug = slugToBranch(slug)` for the on-disk path (not raw `slug`). This resolves the 🟡 finding from task-6's security review.

`slugToBranch` strips `/` (not in `[a-z0-9\-\.]`), converting `../evil` → `..evil`. The `^\.+$` guard at line 166 rejects bare all-dot slugs. Empty slugs throw at line 165.

Edge cases traced manually:
- `path.join("/base", ".team", "worktrees", "..evil")` = `/base/.team/worktrees/..evil` — confined, no traversal.
- `"."` → safeSlug = `"."` → matches `/^\.+$/` → throws.
- `"@@@///"` → safeSlug = `""` → falsy → throws.

Test evidence (`test-output.txt` lines 828–832): path-traversal, all-dots, and empty-slug tests all PASS.

### 2. Explicit cwd contract  PASS

`bin/lib/run.mjs:53–54, 287, 346` — all three worker entry points verified by direct read to throw when `cwd` is falsy:

```js
// run.mjs:54
if (!cwd) throw new Error("runGateInline: cwd is required (no implicit process.cwd() fallback)");
// run.mjs:287
if (!cwd) throw new Error("dispatchToAgent: cwd is required (no implicit process.cwd() fallback)");
// run.mjs:346
if (!cwd) throw new Error("dispatchToAgentAsync: cwd is required (no implicit process.cwd() fallback)");
```

Test evidence (`test-output.txt` lines 805–811): 5 required-cwd contract tests — PASS.

### 3. New grep-audit test (task-13's claim)  PASS (code verified)

`test/worktree.test.mjs:657–682` — the new test "gate.mjs process.cwd() fallback is contained within cmdGate arg parsing only" was read and verified to exist in the current file. The test:
1. Finds `cmdGate` function boundaries by brace-depth counting.
2. Scans for `process.cwd()` occurrences OUTSIDE `cmdGate`.
3. Asserts zero violations.

`gate.mjs:21` places the fallback exclusively in the arg-parsing line of `cmdGate`. The test correctly enforces this invariant.

The test-output.txt (from task-12) shows only 3 tests in this suite — consistent with task-13 adding the 4th test after that artifact was captured. The test file itself contains the 4th assertion.

### 4. cmdGate fallback (🟡 from prior review, backlog)

`bin/lib/gate.mjs:21` — `process.cwd() || ...` fallback still present. An agent invoking `agt-harness gate --cmd ... --dir ...` directly without `--cwd` would run the gate in the caller's directory, silently bypassing worktree isolation.

In current usage, `cmdGate` is NOT called by the harness itself — `runGateInline` replaced the harness gate path. The fallback serves CLI direct invocations only.

This is a known backlog item. The task-13 grep-audit test correctly verifies the fallback is contained in cmdGate's arg-parsing block and not present in any other function. No escalation needed.

### 5. Shell injection surface  PASS (pre-existing, unchanged)

`bin/lib/run.mjs:60` and `bin/lib/gate.mjs:61` — `execSync(cmd, { shell: true })`. Gate command originates from `detectGateCommand(mainCwd)` reading `PROJECT.md` from the **main repo** (not the worktree). An agent running in the worktree cannot inject into the gate command. PROJECT.md is developer-controlled config — analogous to `Makefile` or `package.json#scripts`. Pre-existing design, no new surface introduced by this feature.

All other subprocess calls use array arguments (`execFileSync("git", [...])`, `spawnSync("claude", [...])`) — no shell expansion possible.

### 6. Agent bypassPermissions  PASS (design intent)

`bin/lib/run.mjs:294, 354` — agents spawned with `--permission-mode bypassPermissions`. Worktree isolation is at git branch level, not filesystem ACL level. This is documented, intentional behavior.

### 7. No new secrets / auth surface  PASS

No credentials, tokens, or external auth flows introduced. GitHub integration (`spawnSync("gh", [...])`) uses array args throughout.

---

## Findings

🟡 `bin/lib/gate.mjs:21` — `cmdGate` falls back to `process.cwd()` when `--cwd` is absent. If invoked directly without `--cwd`, the gate runs in the wrong directory and worktree isolation silently fails. Backlog item from task-6 security review; grep-audit test now verifies containment but does not enforce strict requirement. (No new action required for this task — already tracked.)

🔵 `bin/lib/run.mjs:167` — No `path.resolve()` containment assertion after computing `worktreePath`. Current `slugToBranch` invariants are sound, but an independent assertion `if (!resolve(worktreePath).startsWith(resolve(join(mainCwd, ".team", "worktrees")))) throw` would make path confinement verifiable without reasoning through sanitization logic.

---

## Summary

No critical findings. Slug sanitization correctly prevents path traversal; the prior 🟡 finding (raw slug used for path) was fixed — `safeSlug` is now used throughout. The explicit cwd contract is enforced at all three worker entry points. The new task-13 grep-audit test correctly verifies the `|| process.cwd()` fallback is confined to `cmdGate`'s arg-parsing section. One pre-existing backlog 🟡 remains (cmdGate fallback without `--cwd`). No new vulnerabilities introduced.
