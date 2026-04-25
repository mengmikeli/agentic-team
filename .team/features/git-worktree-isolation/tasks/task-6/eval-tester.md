# Tester Review — cwd-audit AC

## AC under review
> No agent dispatch or gate command in `bin/lib/` references `process.cwd()` directly when a worktree is active (verified by grep audit).

## Verdict: ITERATE

The two named functions (`runGateInline`, `dispatchToAgent`) meet the contract and are locked by negative tests. But the AC says "verified by **grep audit**" — and a literal grep audit of `bin/lib/` surfaces two unaddressed sites: `dispatchToAgentAsync` (silent fallback via `spawn({cwd: undefined})`) and `gate.mjs` (explicit `cwd: process.cwd()`). One has been previously flagged and is still unfixed; the other is not on the active `agt run` worktree path but would still appear in any literal audit.

## Files actually opened
- `bin/lib/run.mjs` lines 25–105, 280–340, 343–380
- `bin/lib/gate.mjs` lines 1–80
- `test/worktree.test.mjs` lines 270–350
- `.team/features/git-worktree-isolation/tasks/task-3/eval-tester.md` (prior findings)
- `.team/features/git-worktree-isolation/tasks/task-6/handshake.json`

## Verification I actually ran

`Grep "process\.cwd\(\)" -r bin/lib` — relevant hits:
- `bin/lib/run.mjs:38` — `harness()` wrapper. **Acceptable** — wraps infra commands (init/transition/notify/finalize), not gate or dispatch; runs in the orchestrator's main cwd by design (`mainCwd` is captured at run.mjs:792).
- `bin/lib/run.mjs:54` — `runGateInline` **throws** if cwd omitted. ✅
- `bin/lib/run.mjs:287` — `dispatchToAgent` **throws** if cwd omitted. ✅
- `bin/lib/run.mjs:659`, `:718`, `:721`, `:792` — main-process bootstrapping; not dispatch/gate paths. ✅
- `bin/lib/gate.mjs:59` — **`execSync(cmd, { cwd: process.cwd(), ... })`** in the gate command. Literal violation of "gate command in bin/lib/ references process.cwd() directly". Not currently called during `agt run` (which uses `runGateInline`), but `agt-harness gate` exposes this entry point and the AC text covers it.
- `bin/lib/run.mjs:345` (`dispatchToAgentAsync`) — **no guard**, passes `cwd` straight to `spawn(...)`. If a caller forgets cwd, `spawn({cwd: undefined})` silently inherits `process.cwd()`. Same surface area as `dispatchToAgent` but the contract isn't enforced.
- `bin/lib/run.mjs:373` (`runParallelReviews`) — propagates undefined `cwd` to `dispatchToAgentAsync` and `buildReviewBrief` without validation.

Negative tests run:
- `runGateInline` cwd omitted → throws ✅ (`test/worktree.test.mjs:284`)
- `runGateInline` cwd `undefined` explicit → throws ✅ (`:291`)
- `dispatchToAgent` cwd omitted → throws ✅ (`:298`)
- **No** negative test for `dispatchToAgentAsync` with missing cwd. ❌

Gate output: 552 pass / 0 fail (per handshake summary; gate output snippet provided shows green run).

## Per-criterion

| Criterion | Result | Evidence |
|---|---|---|
| `runGateInline` no implicit fallback | PASS | run.mjs:54 throw + 2 negative tests |
| `dispatchToAgent` no implicit fallback | PASS | run.mjs:287 throw + 1 negative test |
| All gate commands in `bin/lib/` audit-clean | FAIL | `bin/lib/gate.mjs:59` — literal `cwd: process.cwd()` |
| All agent dispatch in `bin/lib/` audit-clean | FAIL | `bin/lib/run.mjs:345` — `dispatchToAgentAsync` has no guard; `spawn({cwd: undefined})` silently falls back |
| AC verifiable by automated grep audit | FAIL | No test asserts the audit; verification is manual and will rot |
| Existing tests pass | PASS | Gate green: 552/0 |

## Edge cases checked

- ✅ cwd === "" → `if (!cwd)` is truthy-false, throws ✅
- ✅ cwd === undefined explicit → throws (`runGateInline`, `dispatchToAgent`)
- ❌ cwd === undefined for `dispatchToAgentAsync` → `spawn` falls back to `process.cwd()` silently; **no test covers this**
- ❌ cwd === undefined for `runParallelReviews` → forwards undefined to `dispatchToAgentAsync` (same fallback)
- ❌ Behavior of `cmdGate` when `agt-harness gate` is invoked from inside a worktree but with `--dir` pointing to a different feature dir — gate command runs in `process.cwd()` (the harness child's cwd), not necessarily the worktree the feature lives in. Not tested.
- ❌ No grep-audit test pinning the AC; future code changes can re-introduce `process.cwd()` in dispatch/gate paths with all tests still green.

## Findings

🔴 bin/lib/run.mjs:345 — `dispatchToAgentAsync` lacks the `if (!cwd) throw` guard that `dispatchToAgent` enforces. `spawn(..., { cwd: undefined })` silently inherits `process.cwd()`, which is the exact failure mode the AC forbids. Add the guard and a negative test.
🟡 bin/lib/gate.mjs:59 — `execSync(cmd, { cwd: process.cwd(), ... })` is a literal `process.cwd()` in a gate command in `bin/lib/`. A grep audit (the AC's stated verification method) flags this. Not on the active `agt run` path today (which uses `runGateInline`), but `agt-harness gate` exposes this code and it should accept a `--cwd` flag (or use `dir`) instead of reading `process.cwd()`.
🟡 bin/lib/run.mjs:373 — `runParallelReviews` doesn't validate `cwd` before forwarding to `dispatchToAgentAsync`. Add an early `if (!cwd) throw` to make the contract symmetric across the parallel sibling.
🟡 test/worktree.test.mjs — No automated grep-audit test. The AC says "verified by grep audit" but the verification is a one-shot manual check. Add a unit test that reads `bin/lib/run.mjs` and `bin/lib/gate.mjs`, scans for `process.cwd()`, and asserts only an allowlist of lines (e.g., the `harness()` wrapper, `mainCwd` capture).
🟡 test/worktree.test.mjs — No negative test for `dispatchToAgentAsync(_, _, undefined)`. Add a coverage twin matching the existing `dispatchToAgent` negative case at `:298`.
🔵 bin/lib/gate.mjs:17 — `cmdGate` already accepts `--dir`; consider running `execSync` with `cwd: dir` instead of `process.cwd()`. Aligns gate-command behavior with `runGateInline` and removes the literal `process.cwd()`.

## Notes
The two functions called out in task-3 are clean. The 🔴 is for `dispatchToAgentAsync`, which was already raised as 🟡 in `task-3/eval-tester.md:45` and remains unfixed; given the AC explicitly covers "agent dispatch ... in `bin/lib/`", a silent-fallback sibling of `dispatchToAgent` should be treated as a critical gap, not a backlog item. Once that is closed (and ideally pinned by an automated grep test), the AC is met.
