# Tester Evaluation — task-13 (run_2): grep-audit test + PRODUCT.md update

**Role:** Tester
**Date:** 2026-04-25
**Overall Verdict:** PASS (3 warnings → backlog)

---

## Files Actually Opened and Read

| File | What I checked |
|------|----------------|
| `.team/features/git-worktree-isolation/tasks/task-13/handshake.json` | Builder claims, artifacts list, run count |
| `.team/features/git-worktree-isolation/tasks/task-12/handshake.json` | Prior task claims |
| `.team/features/git-worktree-isolation/tasks/task-12/test-output.txt` | Verified test counts (566 pass / 2 skip) |
| `test/worktree.test.mjs` (full file, 731 lines) | All worktree tests including new grep-audit |
| `bin/lib/run.mjs` (full file, 1601 lines) | Core isolation wiring |
| `bin/lib/gate.mjs` (full file, 189 lines) | process.cwd() usage and cmdGate boundary |
| `.team/PRODUCT.md` line 58 | Roadmap entry #20 status |
| `test/synthesize-compound.test.mjs` | Permanently-skipped tests |

---

## What Builder Claimed (task-13 run_2)

- Added a second grep-audit assertion to `test/worktree.test.mjs` catching the `|| process.cwd()` fallback pattern in `gate.mjs`
- New test verifies any `process.cwd()` reference in `gate.mjs` is contained within `cmdGate`
- Would fail if `process.cwd()` appeared outside `cmdGate`
- All 567 tests pass

**Artifacts listed:** `test/worktree.test.mjs` (code only — no test-output.txt)

---

## Per-Criterion Results

### 1. PRODUCT.md roadmap entry #20 marked Done
**PASS.** `PRODUCT.md:58` reads:
> `20. **Git worktree isolation** — ... ✅ Done`

The description accurately reflects the delivered feature. This is the primary deliverable of the feature.

### 2. New grep-audit test exists and is structurally correct
**PASS with caveat.**

`test/worktree.test.mjs:657–681` adds a test that:
- Finds the `cmdGate` function boundary using brace-counting (lines 663–671)
- Checks that `process.cwd()` only appears *inside* `cmdGate`, not outside

Confirmed `gate.mjs:21` has `const cwd = getFlag(args, "cwd") || process.cwd()` inside `cmdGate` — test correctly isolates this. The previous test (line 648) only matched `cwd: process.cwd()` (key-value form), missing the `|| process.cwd()` fallback; this new test closes that gap.

**Caveat:** The brace-counting boundary detector (lines 663–671) counts `{`/`}` characters in every line including strings and comments. A brace in a string literal could produce a wrong function boundary. For the current `gate.mjs` this is fine, but it's brittle as a regression guard.

### 3. Test count claim: "567 tests pass"
**UNVERIFIABLE — no artifact.**

Task-13 lists no `test-output.txt` in its artifacts. The only available test artifact is from task-12 (`test-output.txt`), which shows `pass 566, skipped 2, fail 0` (568 total). Task-13 adds exactly 1 test; the expected count would be 567 pass. Without a captured run, I cannot confirm the +1 test passes. The claim of 567 is plausible but unverified.

### 4. Core cwd isolation wiring (unchanged from prior review)
**PASS** — verified directly in source:
- `run.mjs:54`: `runGateInline` guard: `if (!cwd) throw new Error("cwd is required")`
- `run.mjs:287`: `dispatchToAgent` guard: `if (!cwd) throw`
- `run.mjs:346`: `dispatchToAgentAsync` guard: `if (!cwd) throw`
- `run.mjs:1020–1021`: `cwd = worktreePath` after worktree creation
- `run.mjs:1202`: `runGateInline(gateCmd, featureDir, task.id, cwd)` passes worktreePath ✓

### 5. Worktree lifecycle: preserved on error
**PASS** — verified in source:
- `run.mjs:1526–1534`: catch block logs "preserving worktree for retry" and rethrows ✓
- `run.mjs:1534`: `removeWorktree` only called after successful try-block exit ✓

### 6. Pre-existing gap: builder handshake path in worktree context
**GAP — unresolved across multiple rounds.**

`run.mjs:495` instructs the agent to write handshake to a project-relative path. Agent runs with `cwd = worktreePath`, so it writes to `worktreePath/.team/features/.../handshake.json`. The validator at `run.mjs:1185–1198` reads from `featureDir = join(mainCwd, ".team", "features", ...)` — a different directory. The `existsSync` check silently returns false; validation never runs. No test covers this path.

### 7. Pre-existing gap: two security tests permanently disabled
`test/synthesize-compound.test.mjs:70,81` — `it.skip("fabricated eval.md...")` and `it.skip("path traversal...")` — disabled with no documented rationale. Flagged in prior two reviews; still untracked in backlog.

---

## Findings

🟡 `test/worktree.test.mjs:663` — Brace-counting boundary detector for `cmdGate` scope will misparse if `gate.mjs` ever contains a brace in a string literal or comment, silently widening/narrowing the function boundary; replace with a regex boundary (e.g., `export function cmdGate` to next `^export function`) or add a comment acknowledging the brittleness

🟡 `bin/lib/run.mjs:1185` — Builder handshake written by agent into `worktreePath/.team/...` is never found by the validator reading from `mainCwd/.team/...`; `existsSync` silently returns false every time a worktree is used — fix agent brief to use absolute path `join(worktreePath, ".team", "features", ...)` and add a test verifying the handshake is discoverable post-write

🟡 `test/synthesize-compound.test.mjs:70` — Two security-relevant tests ("fabricated-refs trips" and "path traversal blocked") permanently skipped with `it.skip`; flagged 2+ rounds ago and still absent from backlog; document the skip rationale or restore the tests

🔵 `test/worktree.test.mjs:617` — Inspect-log regex `/git -C .+worktrees.+log/` is too loose; any path containing "worktrees" matches — tighten to `/git -C \.team\/worktrees\/\S+ log/` to prevent false passes on non-standard paths

🔵 `test/worktree.test.mjs` (no line) — No behavioral test for the core isolation invariant: writing a file inside `worktreePath` must NOT appear at `mainCwd`; this is the primary contract of the feature and is tested only indirectly

🔵 `bin/lib/run.mjs:345` — `dispatchToAgentAsync` returns `ok:false` for any agent other than `"claude"` with no log; if `findAgent()` returns `"codex"`, all parallel reviews silently return failed; add a warning log and a test for this case

---

## Summary

**Primary deliverable confirmed:** PRODUCT.md roadmap entry #20 is marked ✅ Done with an accurate description. The feature itself (cwd injection, worktree lifecycle, slug sanitization, concurrent safety) was verified in prior rounds; task-13's only new artifact is the grep-audit structural test and the roadmap update.

The new grep-audit test closes a real pattern-matching gap from task-12 and is logically correct for the current state of `gate.mjs`. The 567 test count is plausible but unverifiable without a captured artifact — this is the recurring unverifiability concern raised since run_2 of task-12.

Three 🟡 items warrant backlog entries: the brittle brace-counter, the silent handshake path mismatch (builder writes to wrong location relative to validator), and the permanently-disabled security tests.

**Verdict: PASS** — core feature and roadmap update verified; three warnings to backlog.
