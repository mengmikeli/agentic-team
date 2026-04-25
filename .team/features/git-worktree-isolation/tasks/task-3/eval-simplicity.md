# Simplicity Review — task-3 (run_2)

## Verdict: PASS

## Scope reviewed
- `bin/lib/run.mjs` lines 50-60, 280-335 (read directly)
- `test/worktree.test.mjs` lines 231-266 (read directly via diff)
- Callers of `dispatchToAgent`/`runGateInline` in `bin/lib/review.mjs`, `bin/lib/brainstorm-cmd.mjs`, `bin/lib/outer-loop.mjs`, `bin/lib/run.mjs` (grepped)
- Re-ran `node --test test/worktree.test.mjs` → 28/28 pass

## Per-criterion

### 1. Dead code — PASS
No unused imports, unreachable branches, or commented-out code introduced. The two `if (!cwd) throw` guards are exercised by the new negative tests.

### 2. Premature abstraction — PASS
Guard is inlined at each function (2 sites). Resisting the temptation to extract `requireCwd(name, cwd)` is correct here — at 2 call sites with a one-line check, a helper would add more cognitive load than it removes.

### 3. Unnecessary indirection — PASS
The throw is direct, no wrapper layer. Tests assert behavior at the public surface.

### 4. Gold-plating — PASS
No new config knobs, flags, or extensibility hooks. The change is exactly the contract change described in the handshake — nothing more.

## Cognitive load
The diff is 5 lines of production code + 35 lines of test. A reader can understand the contract in seconds: "cwd must be passed explicitly." The error message names the function and explains the absence of fallback, which is the right level of detail for a developer hitting it.

## Deletability check
Could this be smaller? The two guards could be unified, but that would be premature for 2 call sites. Could they be removed? No — without the throw, a missing-cwd bug would silently run in the wrong directory (the original problem this feature exists to prevent). The cost-to-benefit is right.

## Minor note (non-blocking)
`env: { ...process.env }` added to the codex spawn call (run.mjs:328) is functionally equivalent to omitting `env` entirely (spawnSync defaults to inheriting `process.env`). The same redundancy already existed on the claude spawn (run.mjs:296), so this is "parity with existing redundancy" rather than new complexity. Not worth blocking for; flagged as a 🔵 suggestion only.

## Findings

🔵 bin/lib/run.mjs:296,328 — `env: { ...process.env }` is a no-op vs spawnSync's default env inheritance; both call sites could drop the option. Not blocking — current form is consistent across both agents.

## Test evidence
```
▶ required-cwd contract (no implicit fallback)
  ✔ runGateInline throws when cwd is omitted
  ✔ runGateInline throws when cwd is undefined explicitly
  ✔ dispatchToAgent throws when cwd is omitted
✔ required-cwd contract (no implicit fallback) (0.668167ms)
ℹ tests 28  pass 28  fail 0
```

Caller audit confirms no production caller relies on the removed default:
- `review.mjs:202` passes `cwd` (set from `process.cwd()` at line 152)
- `brainstorm-cmd.mjs:254` passes `cwd` (set at line 237)
- `run.mjs:1085,1165,1198,1222,1410,1460` all pass `cwd` from the active feature's worktree path
- `outer-loop.mjs:676,750,876` all pass `cwd` from outer-loop scope
