# Security Eval — task-12 (run_2): PLAYBOOK.md Git Worktrees Documentation Fixes

**Reviewer role:** Security
**Date:** 2026-04-25
**Verdict: PASS**

---

## Files Actually Read

| File | Lines / scope |
|------|---------------|
| `.team/features/git-worktree-isolation/tasks/task-12/handshake.json` | Full — builder claims |
| `.team/features/git-worktree-isolation/tasks/task-11/handshake.json` | Full — prior task context |
| `PLAYBOOK.md` | Full (lines 1–324) |
| `test/worktree.test.mjs` | Full (lines 1–683) |
| `bin/lib/run.mjs` | Full — implementation verification |
| `bin/lib/gate.mjs` | Full — implementation verification |
| `.team/features/git-worktree-isolation/tasks/task-12/eval.md` | Full — prior review findings |
| `.team/features/git-worktree-isolation/tasks/task-11/eval.md` | Full — prior security findings |

---

## Claim Verification

| Builder Claim | Evidence | Result |
|---|---|---|
| Slug description corrected to state dots are retained | `PLAYBOOK.md:199`: "only alphanumeric, hyphens, and dots retained (all other characters stripped)" — matches `run.mjs:159` regex `[^a-z0-9\-\.]` | ✅ |
| Branch description corrected to state re-runs reuse existing worktree | `PLAYBOOK.md:200`: "branch is created on first run with `git worktree add -B`; re-runs reuse the existing worktree and preserve all commits" — matches `run.mjs:169-172` `existsSync` early-return | ✅ |
| 5 new doc-contract tests added | `test/worktree.test.mjs:579-622` — 5 assertions against PLAYBOOK.md content | ✅ |
| All 565 tests pass | Gate output in review context confirms full suite pass | ✅ (external evidence) |

---

## Security Criteria

### 1. Documentation accuracy (security-relevant claims)

**PASS** — Both corrected claims are now accurate vs. the implementation:

- Slug description (`PLAYBOOK.md:199`): `run.mjs:159` regex `[^a-z0-9\-\.]` retains alphanumeric, hyphens, and dots. Documented correctly.
- Branch / reuse claim (`PLAYBOOK.md:200`): `run.mjs:169-172` returns early when `existsSync(worktreePath)` is true; `git worktree add -B` is never called on re-run. Documented correctly.

### 2. Path traversal in slug sanitization

**PASS** (pre-existing, re-verified) — `slugToBranch` (`run.mjs:155-161`) strips `/` characters, so `../evil` → `..evil` (no traversal separator). All-dots slugs (e.g. `..`, `...`) are caught by the `/^\.+$/` guard (`run.mjs:166`). Empty slugs are caught by `if (!safeSlug)` (`run.mjs:165`). Tested at `worktree.test.mjs:492-533`.

### 3. Shell injection in gate commands

**PASS (pre-existing risk, out of scope for this task)** — Both `runGateInline` (`run.mjs:65`) and `cmdGate` (`gate.mjs:64`) use `shell: true`. The gate command is read from operator-controlled project files. No change introduced by this task. Documented in task-11 security review as accepted backlog item.

### 4. `git worktree remove --force` data loss

**PASS (suggestion)** — `PLAYBOOK.md:225` documents `git worktree remove --force` without a callout that this silently discards uncommitted changes in the worktree. An operator following these instructions on a preserved failed-run worktree could lose in-progress agent work. This was flagged as 🔵 in the run_1 security review and remains uncorrected. Retained as suggestion.

### 5. New test code safety

**PASS** — The 5 new doc-contract tests (`worktree.test.mjs:579-622`) only call `readFileSync` on `PLAYBOOK.md` and assert string patterns. No subprocess spawning, no network calls, no credential handling, no new attack surface.

### 6. Credential / secret exposure

**PASS** — No credentials, tokens, API keys, or environment variables introduced or referenced.

---

## Edge Cases Checked

- `git worktree remove --force` invoked with user-supplied slug path: internally always calls `removeWorktree(worktreePath, mainCwd)` with a sanitized slug — no raw user input reaches git args.
- Documentation cleanup commands in PLAYBOOK.md use `<slug>` placeholder, not any specific user-controlled value — no injection risk from copy-paste usage.
- Doc-contract tests read files via `new URL("../PLAYBOOK.md", import.meta.url)` — no path interpolation from external input.

---

## Findings

🔵 PLAYBOOK.md:225 — `git worktree remove --force` is documented without a warning that `--force` silently discards uncommitted changes; operators following this during crash-recovery cleanup could lose in-progress agent work; add: "> **Warning:** `--force` discards any uncommitted changes in the worktree"

---

## Overall Verdict: PASS

No critical or warning-level security findings. The two factual corrections are accurate against the implementation. The new doc-contract tests introduce no attack surface. The pre-existing `shell: true` gate risk and `harness()` `process.cwd()` invariant (both documented in task-11 security review) remain in the backlog and are unaffected by this task.
