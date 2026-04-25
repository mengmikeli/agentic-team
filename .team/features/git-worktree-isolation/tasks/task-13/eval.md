# Architect Review — git-worktree-isolation (task-13)

## Overall Verdict: PASS

---

## Files Read

- `bin/lib/run.mjs` (lines 150–185, 286–364, 1010–1060, 1195–1215, 1510–1540)
- `bin/lib/gate.mjs` (lines 1–40; grep for `cwd` patterns)
- `test/worktree.test.mjs` (lines 645–704)
- `.team/features/git-worktree-isolation/tasks/task-12/test-output.txt` (all 861 lines)
- `.team/PRODUCT.md` (grep match at line 58)
- All 9 `handshake.json` files (tasks 1–6, 11–13)

---

## Per-Criterion Results

### 1. Worktree creation — `createWorktreeIfNeeded`
**PASS**

`run.mjs:163–176`: Function exists, sanitizes slug via `slugToBranch` before path join, guards against empty/all-dot slugs, reuses existing worktree, invokes `git worktree add -B` for new ones.
Evidence: test-output.txt lines 776–783 — all `createWorktreeIfNeeded` tests pass.

### 2. Slug sanitization — `slugToBranch`
**PASS**

`run.mjs:155–161`: Lowercases, maps `[\s_]+` to `-`, strips `[^a-z0-9\-\.]`, truncates at 72 chars.
Evidence: test-output.txt lines 768–775 — all 6 slug normalization tests pass.

Path-traversal note: `../evil` sanitizes to `..evil` (strips `/`), which is a valid directory name — not an escape. Guard at `run.mjs:166` catches all-dot slugs (`/^\.+$/.test(safeSlug)`). Test at test-output.txt:829 confirms traversal protection.

### 3. Explicit `cwd` enforcement (no `process.cwd()` fallback in dispatch/gate inline paths)
**PASS**

- `run.mjs:54`: `runGateInline` throws when `cwd` omitted — verified by read.
- `run.mjs:287`: `dispatchToAgent` throws when `cwd` omitted — verified by read.
- `run.mjs:346`: `dispatchToAgentAsync` throws when `cwd` omitted — verified by read.
- Evidence: test-output.txt lines 805–811 — all 5 required-cwd contract tests pass.

`gate.mjs:21`: CLI entry point uses `getFlag(args, "cwd") || process.cwd()` fallback. This is safe: agents are spawned with `cwd: worktreePath` (run.mjs:296), so `process.cwd()` within the agent process resolves to the worktree. The fallback does not bypass isolation.

### 4. Worktree lifecycle (create → preserve-on-error → remove-on-success)
**PASS**

- `run.mjs:1020–1024`: worktree created, `cwd` reassigned to worktreePath immediately.
- `run.mjs:1526–1532`: catch block logs preservation and rethrows — no `finally` teardown.
- `run.mjs:1534`: `removeWorktree` only called on success path (after try block exits normally).
- Evidence: test-output.txt lines 833–837 — worktree-preserved-on-error tests pass; line 791 — real-git removeWorktree lifecycle test passes.

### 5. Concurrent isolation
**PASS**

Different slugs produce independent worktrees. Same-slug race handled gracefully via `existsSync` reuse path.
Evidence: test-output.txt lines 817–832 — concurrent tests with real child processes pass.

### 6. PLAYBOOK.md documentation contract
**PASS**

Evidence: test-output.txt lines 838–847 — all 8 documentation contract tests pass (git worktree list, cleanup commands, inspect commands, slug/branch descriptions).

### 7. PRODUCT.md roadmap update (task-13 specific)
**PASS**

`.team/PRODUCT.md:58`: Entry #20 reads "Git worktree isolation — ... ✅ Done". Roadmap moved from Deferred to completed as claimed.

### 8. Test suite
**PASS**

test-output.txt line 855–856: `pass 566`, `fail 0`. Two skipped tests are intentionally disabled (fabricated-refs tests with `# SKIP` marker in synthesize suite — unrelated to this feature).

---

## Findings

🔵 `bin/lib/gate.mjs:648–654` — Grep audit checks for `cwd: process.cwd()` property pattern only; a future `{foo: process.cwd()}` spelling would not be caught. Consider extending the regex to `process\.cwd\(\)` without the property-key prefix, or add an explicit inline-comment explaining the intentional fallback.

---

## Summary

All nine task handshakes were verified against evidence. Core architecture is sound: worktree path is sanitized before use on disk, `cwd` is propagated explicitly through every dispatch and gate call, error paths preserve the worktree for resumability, and removal happens only on the success path. The two-path gate design (inline `runGateInline` for harness, CLI `cmdGate` for agents) is coherent and correctly isolated. Test coverage is thorough including real-git integration, concurrency, and path-traversal cases.
