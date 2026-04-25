# Simplicity Review — git-worktree-isolation (task-13 / full feature)

**Reviewer:** simplicity
**Verdict:** FAIL
**Date:** 2026-04-25

---

## Files Read (actual)

- `bin/lib/run.mjs` — full file, lines 1–1601
- `bin/lib/gate.mjs` — full file, lines 1–189
- `test/worktree.test.mjs` — full file, lines 1–731
- All 9 `handshake.json` files (tasks 1–6, 11–13)
- `tasks/task-12/test-output.txt` — full file

---

## Veto Category Checks

### 1. Dead Code — FAIL (blocks merge)

`bin/lib/run.mjs` imports four symbols that are never referenced anywhere in the file body. Confirmed by full-file grep: zero call sites.

| Symbol | Source | Import line |
|---|---|---|
| `generateNonce` | `./util.mjs` | run.mjs:10 |
| `WRITER_SIG` | `./util.mjs` | run.mjs:11 |
| `ALLOWED_TRANSITIONS` | `./util.mjs` | run.mjs:11 |
| `closeIssue` | `./github.mjs` | run.mjs:13 |

None of these are imported for side-effects. They are named destructuring bindings that are never read after import. This inflates cognitive load for every future reader who must scan the entire 1,600-line file to confirm each is truly unused.

Note: the previous simplicity eval on this task read only line ranges 53–182, 286–395, 787–902, 1010–1040, and 1520–1535 and declared dead code PASS. It missed the import block (lines 1–30) entirely. That is the anti-rationalization failure mode: "Reviewed all files" — but selected ranges were skipped.

### 2. Premature Abstraction — PASS

`slugToBranch`, `createWorktreeIfNeeded`, `removeWorktree`, and `runGateInline`'s cwd parameter all have ≥2 call sites (production + tests). The `_execFn`/`_spawnFn` injection slots follow the established pattern in this codebase and serve real testability.

### 3. Unnecessary Indirection — PASS

`export const runSingleFeature = _runSingleFeature` (run.mjs:1601) is consumed by `outer-loop.mjs` at line 597 as `deps.runSingleFeature`. It is the documented public API for external callers; the underscore prefix marks internal use. Not a pure delegation wrapper.

### 4. Gold-Plating — PASS

The `--cwd` fallback in `gate.mjs:21` (`getFlag(args, "cwd") || process.cwd()`) has a documented backward-compatibility purpose (existing subprocess callers that do not pass `--cwd`). Not speculative.

---

## Non-Veto Warning

🟡 `test/worktree.test.mjs:663–729` — two grep-audit tests detect function boundaries by counting `{`/`}` characters. Braces inside string literals, template literals, or regex literals can shift the depth counter and produce a false PASS. The behavioral invariant (no `cwd: process.cwd()` reaching spawnSync) is already covered by the mock tests at lines 322–364. Flagging for backlog.

---

## Fix Required

🔴 `bin/lib/run.mjs:10-13` — Remove the four dead imports (`generateNonce`, `WRITER_SIG`, `ALLOWED_TRANSITIONS`, `closeIssue`) before merge. Deleting four tokens from two import lines — no logic changes needed.
